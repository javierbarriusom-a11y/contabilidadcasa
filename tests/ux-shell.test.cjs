const test = require("node:test");
const assert = require("node:assert/strict");

const shell = require("../ux-shell.js");

test("evita recalcular una vista sin cambios de modelo", () => {
  assert.equal(shell.shouldRenderView({ viewId: "home", lastView: "home", revision: 4, lastRevision: 4 }), false);
  assert.equal(shell.shouldRenderView({ viewId: "home", lastView: "home", revision: 5, lastRevision: 4 }), true);
  assert.equal(shell.shouldRenderView({ viewId: "movements", lastView: "home", revision: 4, lastRevision: 4 }), true);
});

test("permite forzar el render para cambios de tamaño", () => {
  assert.equal(shell.shouldRenderView({ viewId: "home", lastView: "home", revision: 4, lastRevision: 4, force: true }), true);
});

test("genera títulos y mensajes accesibles", () => {
  assert.equal(shell.makeDocumentTitle("Hoy"), "Hoy | Finanzas Casa");
  assert.equal(shell.statusMessage("Plan familiar", { busy: true }), "Calculando Plan familiar.");
  assert.equal(shell.statusMessage("Plan familiar"), "Plan familiar lista.");
});
