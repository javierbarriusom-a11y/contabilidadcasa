const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

test("Actualizar queda en el menú principal y Movimientos dentro de Datos", () => {
  const home = html.indexOf('href="#home"');
  const update = html.indexOf('href="#update-data"');
  const primaryPlan = html.indexOf('href="#new-life-definitive"');
  const dataLabel = html.indexOf('class="advanced-nav-label">Datos');
  const dataEntry = html.indexOf('href="#data-entry"');
  const movements = html.indexOf('href="#movements"');
  const dataAudit = html.indexOf('href="#data-audit"');

  assert.ok(home < update && update < primaryPlan, "Actualizar debe aparecer inmediatamente después de Hoy");
  assert.ok(dataLabel < dataEntry && dataEntry < movements && movements < dataAudit, "Movimientos debe estar tras Carga de datos");
  assert.match(html, /id="update-data"[^>]*view-section|view-section[^>]*id="update-data"/);
  assert.match(app, /case "update-data":\s*renderMonthlyDetails\(\)/);
});
