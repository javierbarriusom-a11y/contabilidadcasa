const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const html = read("index.html");
const worker = read("service-worker.js");
const ui = read("p2-ui.js");

test("E15 carga el contrato antes de la app y queda disponible sin conexión", () => {
  assert.ok(html.indexOf("canonical-e15-goals.js") < html.indexOf("app.js"));
  assert.match(worker, /canonical-e15-goals\.js/);
  assert.match(worker, /f1a1/);
});

test("E15 ofrece objetivos completos, calendario, conflictos y revisión confirmable", () => {
  assert.match(ui, /name="priority"/);
  assert.match(ui, /name="flexibility"/);
  assert.match(ui, /name="fundingSource"/);
  assert.match(ui, /renderE15Planning/);
  assert.match(ui, /data-e15-review/);
  assert.match(ui, /No hay conflictos de capacidad/);
});
