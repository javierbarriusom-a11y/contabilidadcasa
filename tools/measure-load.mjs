import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

// Rendimiento (30 de septiembre de 2026): mide la carga de `dist/` en un móvil emulado con la CPU frenada,
// en dos situaciones —primera visita y visita repetida con el service worker ya instalado, que es la del
// uso diario— y las imprime. Es INFORMATIVO: no compara con ningún umbral ni forma parte de `npm run verify`
// ni del CI (los presupuestos viven en `.lighthouserc.cjs`); existe para que un cambio de rendimiento se
// pueda medir antes y después con el mismo método, en vez de fiarse de una sola cifra de Lighthouse.
//
// Uso: `npm run build:site && npm run measure:load` (opcional: `MEASURE_CPU=2` para un móvil de gama media;
// `PLAYWRIGHT_CHROMIUM_PATH` para fijar el navegador). Sirve `dist/` con gzip, como GitHub Pages, porque sin
// compresión la red se sobrestima ~4x. Las cifras absolutas dependen de la máquina que mida (un contenedor con
// CPU compartida es lento y ruidoso): sirven las diferencias entre dos ejecuciones en la misma máquina.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = process.env.BUILD_PUBLIC_SITE_DEST ? path.resolve(process.env.BUILD_PUBLIC_SITE_DEST) : path.join(root, "dist");
if (!fs.existsSync(path.join(dist, "index.html"))) {
  throw new Error("No existe dist/index.html — ejecuta `npm run build:site` antes de `npm run measure:load`.");
}
const cpu = Number(process.env.MEASURE_CPU || 4);
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

// Observadores instalados antes de que corra la página: pintado, desplazamientos de layout y tareas largas.
function observe() {
  window.__load = { cls: 0, long: 0, longMax: 0 };
  new PerformanceObserver((list) => list.getEntries().forEach((entry) => { if (!entry.hadRecentInput) window.__load.cls += entry.value; })).observe({ type: "layout-shift", buffered: true });
  new PerformanceObserver((list) => list.getEntries().forEach((entry) => {
    window.__load.long += entry.duration;
    window.__load.longMax = Math.max(window.__load.longMax, entry.duration);
  })).observe({ type: "longtask", buffered: true });
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
      contenido: Math.round(nav.domContentLoadedEventEnd),
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

const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined;
const browser = await chromium.launch(executablePath ? { executablePath } : {});
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: "allow" });
  const first = await visit(context, "primera visita");
  await new Promise((resolve) => setTimeout(resolve, 6000)); // deja que el service worker precachee el shell
  const second = await visit(context, "visita repetida");
  console.log(`Carga en móvil emulado (CPU ${cpu}x, 1,6 Mbps, gzip). «contenido» = DOMContentLoaded: app.js ya pintó Hoy.`);
  console.table([first, second]);
} finally {
  await browser.close();
  server.close();
}
