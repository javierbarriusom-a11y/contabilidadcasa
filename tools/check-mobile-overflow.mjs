import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

// T9 (24 de septiembre de 2026): recorre todas las pantallas del `dist/` ya construido en un móvil
// pequeño, una tableta y un portátil, y falla si algún elemento queda a la derecha del borde de la
// pantalla sin un contenedor con desplazamiento que lo recoja. `html`/`body` recortan el
// desbordamiento horizontal (no hay barra de desplazamiento), así que un elemento que se sale no se
// ve ni se puede pulsar: así estuvieron 13 de 59 pantallas en móvil y 5-6 en escritorio (el botón
// «Añadir» de Planificación de partidas, fuera de pantalla en un portátil de 1280px) sin que ninguna
// prueba lo notase. Mismo patrón que `check-lighthouse-budget.mjs`: fuera de `npm run verify` porque
// necesita un navegador, y enganchado en `.github/workflows/pages.yml` para que corra en cada PR.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// BUILD_PUBLIC_SITE_DEST: el mismo override de destino que ya acepta `tools/build-public-site.mjs`.
const dist = process.env.BUILD_PUBLIC_SITE_DEST ? path.resolve(process.env.BUILD_PUBLIC_SITE_DEST) : path.join(root, "dist");
if (!fs.existsSync(path.join(dist, "index.html"))) {
  throw new Error("No existe dist/index.html — ejecuta `npm run build:site` antes de `npm run test:mobile-overflow`.");
}

const WIDTHS = [360, 768, 1280];
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".json": "application/json", ".webmanifest": "application/manifest+json" };

const server = http.createServer((request, response) => {
  const relative = decodeURIComponent(new URL(request.url, "http://localhost").pathname).replace(/^\/+/, "") || "index.html";
  const file = path.join(dist, relative);
  if (!file.startsWith(dist) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    response.writeHead(404);
    response.end();
    return;
  }
  response.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(response);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const baseUrl = `http://127.0.0.1:${server.address().port}/index.html`;

// Elementos de la pantalla `id` que quedan a la derecha del borde sin un contenedor que los recoja.
function clippedIn(page, id) {
  return page.evaluate((sectionId) => {
    const viewport = document.documentElement.clientWidth;
    const section = document.getElementById(sectionId);
    if (!section) return [];
    const scrolls = (element) => ["auto", "scroll", "hidden", "clip"].includes(getComputedStyle(element).overflowX);
    const insideScroller = (element) => {
      for (let parent = element.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
        if (scrolls(parent)) return true;
      }
      return false;
    };
    // Invisible a propósito (radios ocultos tras su etiqueta, texto solo para lectores de pantalla).
    const intentionallyHidden = (element) => {
      const style = getComputedStyle(element);
      return style.opacity === "0" || style.visibility === "hidden" || (style.position === "absolute" && style.clip !== "auto");
    };
    const offenders = [...section.querySelectorAll("*")].filter((element) => {
      const box = element.getBoundingClientRect();
      return box.width > 1 && box.right > viewport + 1 && !intentionallyHidden(element) && !insideScroller(element);
    });
    const set = new Set(offenders);
    // Solo el elemento más externo que se sale: sus descendientes se salen por arrastre.
    return offenders.filter((element) => !set.has(element.parentElement)).slice(0, 3).map((element) => {
      const box = element.getBoundingClientRect();
      const name = `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ""}${[...element.classList].slice(0, 2).map((cls) => `.${cls}`).join("")}`;
      return `${name} (de ${Math.round(box.left)} a ${Math.round(box.right)}px)`;
    });
  }, id);
}

const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined;
const browser = await chromium.launch(executablePath ? { executablePath } : {});
const failures = [];
let visited = 0;
try {
  for (const width of WIDTHS) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: "block" });
    const page = await context.newPage();
    await page.goto(baseUrl);
    await page.waitForFunction(() => document.querySelectorAll("section.view-section[id]").length > 0);
    await page.waitForTimeout(1500);
    const ids = await page.evaluate(() => [...document.querySelectorAll("section.view-section[id]")].map((section) => section.id));
    for (const id of ids) {
      await page.evaluate((hash) => { location.hash = hash; }, `#${id}`);
      await page.waitForTimeout(500);
      visited += 1;
      const clipped = await clippedIn(page, id);
      if (clipped.length) failures.push(`${width}px · #${id}: ${clipped.join(", ")}`);
      // ARQ-6 (25 sept. 2026): también cada pestaña interna de la pantalla (botones con aria-selected).
      // Solo se visitaba la pestaña por defecto, y la tarjeta «Cámara» de Registrar › Lote y Excel
      // estuvo cortada a 1280px sin que esta comprobación lo viera.
      const initiallySelected = await page.evaluate((sectionId) => [...(document.getElementById(sectionId)?.querySelectorAll("button[aria-selected]") || [])].map((tab) => tab.getAttribute("aria-selected") === "true"), id);
      for (const [position, selected] of initiallySelected.entries()) {
        if (selected) continue;
        const label = await page.evaluate(({ sectionId, index }) => {
          const tab = document.getElementById(sectionId)?.querySelectorAll("button[aria-selected]")[index];
          if (!tab || tab.offsetParent === null) return "";
          tab.click();
          return tab.textContent.trim().replace(/\s+/g, " ").slice(0, 40);
        }, { sectionId: id, index: position });
        if (!label) continue;
        await page.waitForTimeout(400);
        visited += 1;
        const clippedTab = await clippedIn(page, id);
        if (clippedTab.length) failures.push(`${width}px · #${id} › ${label}: ${clippedTab.join(", ")}`);
      }
    }
    await context.close();
  }
} finally {
  await browser.close();
  server.close();
}

if (failures.length) {
  console.error(`Contenido cortado fuera de la pantalla (${failures.length}):\n  ${failures.join("\n  ")}`);
  throw new Error("Hay pantallas con contenido fuera del borde derecho — ver el detalle arriba.");
}
console.log(`Sin contenido cortado: ${visited} visitas (${WIDTHS.join("/")}px, todas las pantallas).`);
