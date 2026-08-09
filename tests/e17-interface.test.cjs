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

test("E17 prioriza Hoy, Actualizar, Prever y Decidir y conserva las herramientas en segundo nivel", () => {
  const home = html.indexOf('<a href="#home" class="nav-primary-link active">');
  const update = html.indexOf('<a href="#update-hub" class="nav-primary-link">');
  const forecast = html.indexOf('<a href="#forecast" class="nav-primary-link">');
  const decide = html.indexOf('<a href="#new-life-definitive" class="nav-primary-link">');
  const advanced = html.indexOf('id="advancedNav"');
  assert.ok(home < update && update < forecast && forecast < decide && decide < advanced);
  assert.match(html, /Herramientas avanzadas/);
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
  assert.match(worker, /20260808-e19a4/);
  assert.match(html, /app\.js\?v=20260808e19a3/);
  assert.match(html, /styles\.css\?v=20260808e18a4/);
});

test("E18 enlaza una guía offline específica desde cada flujo crítico", () => {
  assert.match(app, /data-e17-open="guide"/);
  assert.match(app, /guideTopicFor\(activeViewId\)/);
  assert.match(html, /id="e17FlowGuideDialog"/);
});
