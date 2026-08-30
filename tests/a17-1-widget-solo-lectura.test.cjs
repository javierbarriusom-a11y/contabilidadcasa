const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.webmanifest"), "utf8"));

// A17-1 (BACKLOG_ULTIMATE_SEPTIEMBRE.md bloque 3, BACKLOG_PATRIMONIO_Y_FINANZAS.md E24a): un
// widget de solo lectura (saldo, próximo evento, colchón) alcanzable por atajo del icono
// instalado. Un widget de pantalla de inicio nativo y una complicación de reloj no son
// construibles desde un sitio estático sin app nativa — se documenta esa decisión de alcance en
// vez de fingir construirlos.

function sectionRange(id) {
  const openTag = new RegExp(`<section[^>]*id="${id}"[^>]*>`).exec(html);
  assert.ok(openTag, `No existe la sección #${id}`);
  const start = openTag.index + openTag[0].length;
  const end = html.indexOf("<section", start);
  assert.ok(end > start, `No se encontró el final de la sección #${id}`);
  return html.slice(start, end);
}

test("existe la sección #widget con las tres cifras, sin ningún control de escritura", () => {
  const widget = sectionRange("widget");
  assert.match(widget, /id="widgetBalance"/);
  assert.match(widget, /id="widgetNextEvent"/);
  assert.match(widget, /id="widgetCushion"/);
  assert.doesNotMatch(widget, /<input/, "el widget es de solo lectura: ningún <input>");
  assert.doesNotMatch(widget, /<select/, "el widget es de solo lectura: ningún <select>");
  assert.doesNotMatch(widget, /<button[^>]*data-alert-action|data-home-nav="registrar"/, "sin accesos de escritura");
});

test("el widget enlaza de vuelta a Hoy para cualquier edición", () => {
  const widget = sectionRange("widget");
  assert.match(widget, /data-home-nav="home"/);
});

test("renderWidgetView reutiliza los mismos cálculos que Hoy, sin un motor paralelo", () => {
  const start = app.indexOf("function widgetSnapshot(");
  assert.ok(start >= 0, "No existe widgetSnapshot en app.js");
  const end = app.indexOf("\nfunction renderWidgetView(");
  assert.ok(end > start);
  const body = app.slice(start, end);
  assert.match(body, /unifiedActionCenterModel\(\)/, "el saldo debe salir del mismo modelo que Hoy");
  assert.match(body, /rangeKpiMetric\(homeRowsForHorizon\(\)\)/, "el colchón debe salir del mismo cálculo que Hoy");
  assert.match(body, /window\.FinanceCanonicalE15/, "el próximo evento debe salir del calendario financiero (A15-3/E15)");
});

test("el router despacha #widget a renderWidgetView y tiene título propio", () => {
  assert.match(app, /case "widget":\s*\n\s*renderWidgetView\(\);\s*\n\s*break;/);
  assert.match(app, /widget:\s*\{\s*\n\s*eyebrow:/);
});

test("el widget es localizable desde el buscador (E17) y desde el menú avanzado", () => {
  const e17 = fs.readFileSync(path.join(root, "e17-experience.js"), "utf8");
  assert.match(e17, /target:\s*"widget"/);
  assert.match(html, /href="#widget"/);
});

test("manifest.webmanifest ofrece un atajo al widget, la aproximación web real a un widget de inicio", () => {
  assert.ok(Array.isArray(manifest.shortcuts) && manifest.shortcuts.length > 0);
  const shortcut = manifest.shortcuts.find((entry) => entry.url === "./#widget");
  assert.ok(shortcut, "debe existir un atajo a ./#widget");
  assert.match(html, /manifest\.webmanifest\?v=/);
});
