const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

test("Actualizar abre la matriz temporal y Movimientos queda dentro de Datos", () => {
  const home = html.indexOf('href="#home"');
  const update = html.indexOf('href="#update-hub"');
  const primaryPlan = html.indexOf('href="#new-life-definitive"');
  const debtProjects = html.indexOf('href="#new-life-simulation"');
  const debtRoadmap = html.indexOf('href="#debt-roadmap"');
  const dataLabel = html.indexOf('class="advanced-nav-label">Datos');
  const dataEntry = html.indexOf('href="#data-entry"');
  const movements = html.indexOf('href="#movements"');
  const dataAudit = html.indexOf('href="#data-audit"');

  assert.ok(home < update && update < primaryPlan, "Actualizar debe aparecer inmediatamente después de Hoy");
  assert.ok(debtProjects < debtRoadmap, "Plan de deuda debe aparecer tras Deuda y proyectos");
  assert.ok(dataLabel < dataEntry && dataEntry < movements && movements < dataAudit, "Movimientos debe estar tras Carga de datos");
  assert.match(html, /id="visual-detail"[^>]*view-section|view-section[^>]*id="visual-detail"/);
  assert.match(html, /id="update-hub"[^>]*view-section|view-section[^>]*id="update-hub"/);
  assert.match(html, /id="debt-roadmap"[^>]*view-section|view-section[^>]*id="debt-roadmap"/);
  assert.match(app, /case "update-data":\s*renderMonthlyDetails\(\)/);
  assert.match(app, /case "visual-detail":\s*renderVisualDetail\(\)/);
  assert.match(app, /case "update-hub":\s*renderUpdateHub\(\)/);
});
