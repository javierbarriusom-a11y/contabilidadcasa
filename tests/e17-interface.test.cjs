const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const html = read("index.html");
const app = read("app.js");
const css = read("styles.css");
const worker = read("service-worker.js");

// T-1 sustituye los cuatro verbos (Hoy, Actualizar, Prever, Decidir) por las seis vistas del
// rediseño: Hoy, Plan, Deuda, Datos, Cierre y Ajustes. «Prever» y «Decidir» dejan de ser pestaña
// principal — el primero sigue accesible desde el menú avanzado, el segundo se releva.
test("E17 prioriza las seis vistas del rediseño y conserva las herramientas en segundo nivel", () => {
  const home = html.indexOf('<a href="#home" class="nav-primary-link active">');
  const plan = html.indexOf('<a href="#plan" class="nav-primary-link">');
  const deuda = html.indexOf('<a href="#deuda-ruta" class="nav-primary-link">');
  const datos = html.indexOf('<a href="#update-hub" class="nav-primary-link">');
  const cierre = html.indexOf('<a href="#cierre" class="nav-primary-link">');
  const ajustes = html.indexOf('<a href="#ajustes" class="nav-primary-link">');
  const advanced = html.indexOf('id="advancedNav"');
  assert.ok(
    home < plan && plan < deuda && deuda < datos && datos < cierre && cierre < ajustes && ajustes < advanced,
    "las seis vistas deben aparecer en orden Hoy, Plan, Deuda, Datos, Cierre, Ajustes, antes del menú avanzado",
  );
  assert.match(html, /Herramientas avanzadas/);
  assert.ok(!html.includes('<a href="#forecast" class="nav-primary-link">'), "Prever ya no es pestaña principal");
  assert.ok(!html.includes('<a href="#new-life-definitive" class="nav-primary-link">'), "Decidir ya no es pestaña principal");
});

test("E17 ofrece estado, ayuda contextual, lanzador y preferencias locales", () => {
  assert.match(html, /id="e17ViewGuide"/);
  assert.match(html, /id="e17LauncherDialog"/);
  assert.match(html, /id="e17PreferencesDialog"/);
  assert.match(app, /function renderE17ViewGuide/);
  assert.match(app, /function renderE17Launcher/);
  assert.match(app, /function applyE17Preferences/);
  assert.match(app, /E17_PREFERENCES_KEY/);
  assert.match(html, /e17-experience\.js/);
  assert.match(app, /FinanceE17Experience/);
  assert.match(app, /storageSet\(storageKey\(E17_PREFERENCES_KEY\)/);
  assert.match(app, /La pantalla actual no envía datos fuera/);
  assert.match(css, /\.e17-view-guide/);
});

test("E17 queda disponible con el shell offline versionado", () => {
  assert.match(worker, /20260814-f1a1/);
  assert.match(html, /app\.js\?v=20260814f1a1/);
  assert.match(html, /styles\.css\?v=20260808e18a4/);
});

test("E18 enlaza una guía offline específica desde cada flujo crítico", () => {
  assert.match(app, /data-e17-open="guide"/);
  assert.match(app, /guideTopicFor\(activeViewId\)/);
  assert.match(html, /id="e17FlowGuideDialog"/);
});
