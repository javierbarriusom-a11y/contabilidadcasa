const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const html = read("index.html");
const app = read("app.js");
const worker = read("service-worker.js");

test("E13a carga su contrato después del forecast y antes de la aplicación", () => {
  assert.ok(html.indexOf("canonical-forecast.js") < html.indexOf("canonical-e13-scenarios.js"));
  assert.ok(html.indexOf("canonical-e13-scenarios.js") < html.indexOf("app.js"));
  assert.match(worker, /canonical-e13-scenarios\.js/);
  assert.match(worker, /finanzas-casa-shell-20260802-e13a2/);
});

test("el laboratorio ofrece eventos, comparación y aviso inequívoco de solo simulación", () => {
  assert.match(html, /Pérdida de ingreso/);
  assert.match(html, /Gasto extraordinario/);
  assert.match(html, /Coche/);
  assert.match(html, /Mudanza/);
  assert.match(html, /Pago de deuda/);
  assert.match(html, /nunca modifica ni guarda el plan vigente/);
  assert.match(app, /E13\.buildLab\(forecast, e13ScenarioEvents/);
  assert.match(app, /Nada se ha guardado/);
  assert.doesNotMatch(app.slice(app.indexOf("function addE13ScenarioEvent"), app.indexOf("function removeE13ScenarioEvent")), /queueRemoteSave|storageSet|saveScenarioSettings/);
});
