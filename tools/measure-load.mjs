import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

// Rendimiento (30 de septiembre de 2026): mide la carga de `dist/` en un móvil emulado con la CPU frenada,
// en dos situaciones —primera visita y visita repetida con el service worker ya instalado, que es la del
// uso diario— y las imprime.
//
// Dos modos:
//   `npm run measure:load`      informativo: primera visita + visita repetida. No falla nunca.
//   `npm run test:load-budget`  PUERTA (`--budget=5000`): tres visitas repetidas y falla si la MEDIANA del
//                               tiempo hasta que Hoy tiene contenido supera el presupuesto. Sustituye, para el
//                               uso real del hogar, a la puerta de LCP de Lighthouse, que solo pasaba porque un
//                               titular provisional contaba como contenido (ver `.lighthouserc.cjs`). Se engancha
//                               en `.github/workflows/pages.yml`. Fuera de `npm run verify`: necesita un navegador.
//
// Presupuesto: 5000 ms a CPU 4x (el «móvil lento» de Lighthouse). Medido en un contenedor de CPU compartida: 3,6-4,4 s
// tras ocultar las pantallas de partida y 5,8-6,0 s antes. Se usa la mediana de tres visitas, no la mejor, para que un
// arranque atípico no decida por sí solo. Un iPhone actual queda muy por debajo: el presupuesto protege de regresiones
// grandes, no mide la experiencia real de un teléfono rápido.
//
// Opciones por entorno: `MEASURE_CPU` (por defecto 4), `PLAYWRIGHT_CHROMIUM_PATH` para fijar el navegador. Sirve `dist/`
// con gzip, como GitHub Pages, porque sin compresión la red se sobrestima ~4x. Las cifras absolutas dependen de la
// máquina que mida: sirven las diferencias entre dos ejecuciones en la misma máquina.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = process.env.BUILD_PUBLIC_SITE_DEST ? path.resolve(process.env.BUILD_PUBLIC_SITE_DEST) : path.join(root, "dist");
if (!fs.existsSync(path.join(dist, "index.html"))) {
  throw new Error("No existe dist/index.html — ejecuta `npm run build:site` antes de `npm run measure:load`.");
}
const cpu = Number(process.env.MEASURE_CPU || 4);
const budgetArg = process.argv.find((arg) => arg.startsWith("--budget="));
const budget = budgetArg ? Number(budgetArg.slice("--budget=".length)) : null;
const REPEATS = 3;
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json" };

const server = http.createServer((request, response) => {
  const relative = decodeURIComponent(new URL(request.url, "http://localhost").pathname).replace(/^\/+/, "") || "index.html";
  const file = path.join(dist, relative);
  if (!file.startsWith(dist) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    response.writeHead(404);
    response.end();
    return;
  }
  const type = TYPES[path.extname(file)];
  const body = fs.readFileSync(file);
  const headers = { "Content-Type": type || "application/octet-stream", "Cache-Control": "max-age=600" };
  if (type && /gzip/.test(request.headers["accept-encoding"] || "")) {
    const zipped = zlib.gzipSync(body, { level: 6 });
    response.writeHead(200, { ...headers, "Content-Encoding": "gzip", "Content-Length": zipped.length });
    response.end(zipped);
    return;
  }
  response.writeHead(200, { ...headers, "Content-Length": body.length });
  response.end(body);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const url = `http://127.0.0.1:${server.address().port}/index.html`;

// Observadores instalados antes de que corra la página: desplazamientos de layout, tareas largas y el momento en
// que el bloque de cifras de Hoy (#homeKpis) recibe su primer contenido, que es «Hoy ya dice algo».
function observe() {
  window.__load = { cls: 0, long: 0, longMax: 0, hoy: null };
  new PerformanceObserver((list) => list.getEntries().forEach((entry) => { if (!entry.hadRecentInput) window.__load.cls += entry.value; })).observe({ type: "layout-shift", buffered: true });
  new PerformanceObserver((list) => list.getEntries().forEach((entry) => {
    window.__load.long += entry.duration;
    window.__load.longMax = Math.max(window.__load.longMax, entry.duration);
  })).observe({ type: "longtask", buffered: true });
  new MutationObserver(() => {
    const kpis = document.getElementById("homeKpis");
    if (window.__load.hoy === null && kpis && kpis.children.length > 0) window.__load.hoy = performance.now();
  }).observe(document, { childList: true, subtree: true });
}

async function visit(context, name) {
  const page = await context.newPage();
  const session = await context.newCDPSession(page);
  await session.send("Network.enable");
  await session.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
  await session.send("Emulation.setCPUThrottlingRate", { rate: cpu });
  await page.addInitScript(observe);
  await page.goto(url, { waitUntil: "load" });
  await page.waitForTimeout(2500);
  const result = await page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0];
    const paint = Object.fromEntries(performance.getEntriesByType("paint").map((entry) => [entry.name, Math.round(entry.startTime)]));
    const resources = performance.getEntriesByType("resource");
    return {
      fcp: paint["first-contentful-paint"],
      hoyConContenido: window.__load.hoy === null ? null : Math.round(window.__load.hoy),
      dcl: Math.round(nav.domContentLoadedEventEnd),
      transferKB: Math.round(resources.reduce((sum, entry) => sum + entry.transferSize, 0) / 1024),
      tareasLargasMs: Math.round(window.__load.long),
      tareaMasLargaMs: Math.round(window.__load.longMax),
      cls: Number(window.__load.cls.toFixed(4)),
      visibles: [...document.querySelectorAll(".view-section")].filter((section) => !section.hidden).length,
    };
  });
  await page.close();
  return { visita: name, ...result };
}

const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined;
const browser = await chromium.launch(executablePath ? { executablePath } : {});
let failure = null;
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: "allow" });
  const rows = [];
  if (budget === null) rows.push(await visit(context, "primera visita"));
  else await visit(context, "calentamiento"); // instala el service worker; no se mide
  await new Promise((resolve) => setTimeout(resolve, 6000)); // deja que el service worker precachee el shell
  const repeats = budget === null ? 1 : REPEATS;
  for (let index = 0; index < repeats; index += 1) rows.push(await visit(context, budget === null ? "visita repetida" : `visita repetida ${index + 1}`));
  console.log(`Carga en móvil emulado (CPU ${cpu}x, 1,6 Mbps, gzip). «hoyConContenido» = momento en que #homeKpis recibe contenido.`);
  console.table(rows);
  if (budget !== null) {
    const values = rows.map((row) => row.hoyConContenido);
    if (values.some((value) => value === null)) {
      failure = "Hoy no llegó a pintar #homeKpis en alguna visita repetida: la medida no es válida.";
    } else {
      const mid = median(values);
      console.log(`Mediana de «Hoy con contenido» en visita repetida: ${mid} ms (presupuesto ${budget} ms).`);
      if (mid > budget) failure = `Hoy tarda ${mid} ms en tener contenido en visita repetida (CPU ${cpu}x), por encima del presupuesto de ${budget} ms.`;
    }
  }
} finally {
  await browser.close();
  server.close();
}
if (failure) throw new Error(failure);
