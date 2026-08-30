const test = require("node:test");
const assert = require("node:assert/strict");

const Portfolio = require("../canonical-portfolio.js");

test("IV1 (núcleo): normaliza una posición con procedencia declarada y calcula plusvalía", () => {
  const result = Portfolio.normalizePositions([
    { label: "Fondo Global", type: "fondo", quantity: 10, costBasis: 1000, currentValue: 1200, provenance: "declared", asOf: "2026-08-01" },
  ]);
  assert.equal(result.positions.length, 1);
  const position = result.positions[0];
  assert.equal(position.gainLoss, 200);
  assert.equal(position.gainLossPct, 20);
  assert.equal(position.dataQuality.confidence, "high");
});

test("IV1 (núcleo): sin procedencia declarada, la posición se marca 'unknown', nunca 'declared' por defecto", () => {
  const result = Portfolio.normalizePositions([{ label: "Cripto sin dato", type: "cripto", quantity: 1, costBasis: 500, currentValue: 400 }]);
  assert.equal(result.positions[0].provenance, "unknown");
  assert.equal(result.quality.issues.some((issue) => issue.code === "unknown-provenance"), true);
});

test("IV1 (núcleo): un valor null/undefined no se confunde con un coste declarado de cero", () => {
  const result = Portfolio.normalizePositions([{ label: "Acción X", type: "accion", quantity: 5, costBasis: null, currentValue: undefined, provenance: "declared" }]);
  assert.equal(result.positions[0].costBasis, 0);
  assert.equal(result.positions[0].dataQuality.fields.costBasis, false);
  assert.equal(result.positions[0].dataQuality.fields.currentValue, false);
});

test("IV1 (núcleo): summarizePositions agrega coste y valor total por tipo y calcula la plusvalía global", () => {
  const result = Portfolio.normalizePositions([
    { label: "Fondo A", type: "fondo", quantity: 1, costBasis: 1000, currentValue: 1100, provenance: "declared" },
    { label: "ETF B", type: "etf", quantity: 1, costBasis: 500, currentValue: 450, provenance: "declared" },
  ]);
  assert.equal(result.summary.totalCost, 1500);
  assert.equal(result.summary.totalValue, 1550);
  assert.equal(result.summary.gainLoss, 50);
  assert.equal(result.summary.totalsByType.fondo, 1100);
  assert.equal(result.summary.totalsByType.etf, 450);
});

test("IV1 (núcleo): una cartera vacía produce totales en cero sin romper el cálculo", () => {
  const result = Portfolio.normalizePositions([]);
  assert.equal(result.summary.totalCost, 0);
  assert.equal(result.summary.totalValue, 0);
  assert.equal(result.summary.gainLossPct, 0);
  assert.equal(result.quality.valid, true);
});

test("IV1 (núcleo): validatePositions marca error por id duplicado", () => {
  const result = Portfolio.normalizePositions([
    { id: "p1", label: "Fondo A", type: "fondo", quantity: 1, costBasis: 100, currentValue: 100, provenance: "declared" },
    { id: "p1", label: "Fondo B", type: "fondo", quantity: 1, costBasis: 100, currentValue: 100, provenance: "declared" },
  ]);
  assert.equal(result.quality.valid, false);
  assert.equal(result.quality.issues.some((issue) => issue.code === "duplicate-position-id"), true);
});
