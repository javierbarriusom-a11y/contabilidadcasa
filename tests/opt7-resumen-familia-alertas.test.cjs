const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");

// OPT-7 (BACKLOG_ULTIMATE_SEPTIEMBRE.md bloque 3, BACKLOG_OPTIMIZACION.md): «modo familiar» y
// «alertas» eran paneles completos en «Hoy» duplicando contenido que ya vive en su propio sitio
// (el selector lateral de contexto, el Centro de alertas). Bajan a una línea de estado cada uno.

function renderHomeFamilyAndAlertsBody() {
  const start = app.indexOf("function renderHomeFamilyAndAlerts(");
  assert.ok(start >= 0, "No existe renderHomeFamilyAndAlerts en app.js");
  const end = app.indexOf("\nfunction ", start + 1);
  assert.ok(end > start, "No se encontró el final de renderHomeFamilyAndAlerts");
  return app.slice(start, end);
}

test("el panel de familia ya no repite el desglose completo (ingresos/gastos/margen)", () => {
  const body = renderHomeFamilyAndAlertsBody();
  assert.doesNotMatch(body, /home-family-grid/, "el grid de tres cifras debía desaparecer");
  assert.doesNotMatch(body, /Ingresos medios/);
  assert.doesNotMatch(body, /Gastos imputados/);
  assert.match(body, /home-status-line/, "debe quedar como una sola línea de estado");
});

test("el panel de familia enlaza al selector lateral de contexto, no a una vista propia", () => {
  const body = renderHomeFamilyAndAlertsBody();
  assert.match(body, /data-scroll-focus="familyContextSwitch"/);
  assert.match(body, /Cambiar contexto/);
});

test("el panel de alertas ya no repite el desglose de la primera alerta, solo el recuento y el botón", () => {
  const body = renderHomeFamilyAndAlertsBody();
  assert.doesNotMatch(body, /UX_ALERT_METRICS\[first\.metric\]/, "no debe seguir formateando la primera alerta");
  assert.match(body, /alertas activas/);
  assert.match(body, /data-home-nav="alerts-center"/, "el botón Configurar sigue existiendo");
});

test("data-scroll-focus lleva el foco al elemento indicado sin navegar de vista", () => {
  const start = app.indexOf("function setupE17Experience(");
  assert.ok(start >= 0);
  const end = app.indexOf("\nfunction ", start + 1);
  const body = app.slice(start, end);
  assert.match(body, /data-scroll-focus/);
  assert.match(body, /scrollIntoView/);
});

test("styles.css ya no define el grid de tres cifras y sí la línea de estado compacta", () => {
  assert.doesNotMatch(css, /\.home-family-grid\b/);
  assert.match(css, /\.home-status-line\s*\{/);
});
