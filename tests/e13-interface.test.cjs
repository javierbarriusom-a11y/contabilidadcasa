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
  assert.match(worker, /finanzas-casa-shell-20260814-f1a1/);
});

test("el laboratorio ofrece eventos, comparación y aviso inequívoco de solo simulación", () => {
  assert.match(html, /Pérdida de ingreso/);
  assert.match(html, /Gasto extraordinario/);
  assert.match(html, /Coche/);
  assert.match(html, /Mudanza/);
  assert.match(html, /Pago de deuda/);
  assert.match(html, /Simular no modifica el plan/);
  assert.match(app, /E13\.buildLab\(forecast, e13ScenarioEvents/);
  assert.match(app, /Simular no modifica el plan/);
  assert.doesNotMatch(app.slice(app.indexOf("function addE13ScenarioEvent"), app.indexOf("function removeE13ScenarioEvent")), /queueRemoteSave|storageSet|saveScenarioSettings/);
});

test("E12b/E13b muestra aprendizaje, prudencia, sensibilidad y guardado reproducible", () => {
  assert.match(app, /learnFromHistory\(history/);
  assert.match(app, /adaptiveHorizon\(forecast\.series/);
  assert.match(app, /prudentSimulation\(forecast/);
  assert.match(app, /E13\.sensitivity\(forecast/);
  assert.match(app, /E13\.saveScenario\(forecast/);
  assert.match(app, /recalculateSavedScenario\(saved, forecast/);
  assert.match(app, /storageKey\("e13SavedScenarios"\)/);
  assert.match(html, /Guardar escenario reproducible/);
});
