const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const html = read("index.html");
const worker = read("service-worker.js");
const ui = read("p2-ui.js");

test("E16 carga su contrato antes de la interfaz y se conserva sin conexión", () => {
  assert.ok(html.indexOf("canonical-e16-monitoring.js") < html.indexOf("app.js"));
  assert.match(worker, /canonical-e16-monitoring\.js/);
  assert.match(worker, /f1a1/);
});

test("E16 muestra alertas, cambios, calidad, recomendaciones y presupuesto de riesgo", () => {
  assert.match(ui, /renderE16Monitoring/);
  assert.match(ui, /data-e16-budget-form/);
  assert.match(ui, /Alertas anticipadas de caja/);
  assert.match(ui, /Qué cambió desde la última revisión/);
  assert.match(ui, /Calidad de predicción/);
  assert.match(ui, /Recomendaciones trazables/);
});
