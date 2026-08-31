const test = require("node:test");
const assert = require("node:assert/strict");

const Portfolio = require("../canonical-portfolio.js");

test("FC2: fondo a fondo es un traspaso sin peaje fiscal", () => {
  assert.equal(Portfolio.isFundToFundTransfer("fondo", "fondo"), true);
});

test("FC2: cualquier otro par de tipos no cumple la regla fiscal (venta+compra normal)", () => {
  assert.equal(Portfolio.isFundToFundTransfer("fondo", "etf"), false);
  assert.equal(Portfolio.isFundToFundTransfer("accion", "fondo"), false);
});

test("FC2: applyFundTransfer conserva el coste y la fecha de adquisición originales", () => {
  const original = Portfolio.normalizePosition({ id: "p1", label: "Fondo A", type: "fondo", quantity: 10, costBasis: 1000, currentValue: 1200, asOf: "2025-01-15", provenance: "declared" }, 0);
  const transferred = Portfolio.applyFundTransfer(original, { label: "Fondo B", currentValue: 1250 });
  assert.equal(transferred.costBasis, 1000);
  assert.equal(transferred.asOf, "2025-01-15");
  assert.equal(transferred.label, "Fondo B");
  assert.equal(transferred.currentValue, 1250);
});

test("FC2: applyFundTransfer recalcula la plusvalía sobre el nuevo valor con el coste original", () => {
  const original = Portfolio.normalizePosition({ id: "p1", label: "Fondo A", type: "fondo", quantity: 10, costBasis: 1000, currentValue: 1200, asOf: "2025-01-15", provenance: "declared" }, 0);
  const transferred = Portfolio.applyFundTransfer(original, { currentValue: 1500 });
  assert.equal(transferred.gainLoss, 500);
  assert.equal(transferred.gainLossPct, 50);
});

test("FC2: applyFundTransfer mantiene el mismo id — es la misma posición, no una nueva", () => {
  const original = Portfolio.normalizePosition({ id: "p1", label: "Fondo A", type: "fondo", quantity: 10, costBasis: 1000, currentValue: 1200, provenance: "declared" }, 0);
  const transferred = Portfolio.applyFundTransfer(original, { label: "Fondo B" });
  assert.equal(transferred.id, "p1");
});

test("FC2: sin cambios declarados, applyFundTransfer deja la posición intacta salvo el traspaso en sí", () => {
  const original = Portfolio.normalizePosition({ id: "p1", label: "Fondo A", type: "fondo", quantity: 10, costBasis: 1000, currentValue: 1200, provenance: "declared" }, 0);
  const transferred = Portfolio.applyFundTransfer(original, {});
  assert.equal(transferred.label, "Fondo A");
  assert.equal(transferred.currentValue, 1200);
  assert.equal(transferred.quantity, 10);
});
