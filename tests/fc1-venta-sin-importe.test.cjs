const test = require("node:test");
const assert = require("node:assert/strict");

const Portfolio = require("../canonical-portfolio.js");

// Hallazgo vecino de WP-15 anotado el 7/10/2026 y comprobado el 15/10: el formulario de venta deja el importe cobrado vacío y se
// guardaba como 0; `realizedGain = saleProceeds − coste consumido` salía entonces «menos el coste entero», una minusvalía que no
// existe, y `yearEndCompensation` la netaba contra plusvalías reales del mismo año. Dato ausente no es cero: sin importe cobrado
// la plusvalía de esa venta es «no calculable» (null), con el mismo criterio con el que la XIRR ya devuelve «disposal-proceeds-unknown».

const base = {
  id: "p1", type: "fondo", label: "Fondo de prueba", quantity: 10, costBasis: 1000, currentValue: 600,
  asOf: "2026-01-01", acquisitionDate: "2024-01-01", provenance: "declared",
};
const sale = (overrides = {}) => ({ id: "d1", date: "2025-01-01", quantitySold: 5, saleProceeds: 700, ...overrides });

test("venta con importe: la plusvalía sigue siendo cobrado − coste (retrocompatible)", () => {
  const position = Portfolio.normalizePosition({ ...base, disposals: [sale()] });
  assert.equal(position.disposals[0].realizedGain, 200);
  assert.equal(position.disposals[0].proceedsMissing, false);
  assert.equal(position.realizedGain, 200);
});

for (const [nombre, saleProceeds] of [["ausente", undefined], ["vacío", ""], ["cero", 0], ["no numérico", "abc"]]) {
  test(`venta con importe ${nombre}: plusvalía no calculable, nunca «menos el coste»`, () => {
    const position = Portfolio.normalizePosition({ ...base, disposals: [sale({ saleProceeds })] });
    assert.equal(position.disposals[0].realizedGain, null, "no es −500");
    assert.equal(position.disposals[0].proceedsMissing, true);
    assert.equal(position.realizedGain, null, "la posición tampoco enseña una cifra a medias");
    assert.equal(position.disposals[0].consumedCost, 500, "el coste consumido sí se conoce y no cambia");
  });
}

test("una venta con importe y otra sin: el total de la posición y de la cartera es no calculable, no una suma a medias", () => {
  const { positions, summary } = Portfolio.normalizePositions([
    { ...base, disposals: [sale({ id: "d1", quantitySold: 3, saleProceeds: 450 }), sale({ id: "d2", date: "2025-06-01", quantitySold: 2, saleProceeds: 0 })] },
    { ...base, id: "p2", disposals: [sale({ id: "d3" })] },
  ]);
  assert.equal(positions[0].disposals[0].realizedGain, 150, "la que tiene importe sí se calcula");
  assert.equal(positions[0].disposals[1].realizedGain, null);
  assert.equal(positions[0].realizedGain, null);
  assert.equal(summary.totalRealizedGain, null, "una sola venta sin importe invalida el total de la cartera");
});

test("la compensación fiscal del año no se calcula con una venta sin importe (antes sumaba una minusvalía falsa)", () => {
  const positions = [
    Portfolio.normalizePosition({ ...base, disposals: [sale({ id: "g", date: "2026-02-01", saleProceeds: 900 })] }),
    Portfolio.normalizePosition({ ...base, id: "p2", disposals: [sale({ id: "s", date: "2026-03-01", saleProceeds: undefined })] }),
  ];
  const result = Portfolio.yearEndCompensation({ positions, year: "2026" });
  assert.equal(result.calculable, false);
  assert.equal(result.reason, "incomplete-disposal");
});

test("las ventas de otros años sin importe no estropean la compensación de este año", () => {
  const positions = [
    Portfolio.normalizePosition({ ...base, disposals: [sale({ id: "g", date: "2026-02-01", saleProceeds: 900 })] }),
    Portfolio.normalizePosition({ ...base, id: "p2", disposals: [sale({ id: "s", date: "2025-03-01", saleProceeds: 0 })] }),
  ];
  const result = Portfolio.yearEndCompensation({ positions, year: "2026" });
  assert.equal(result.calculable, true);
  assert.equal(result.yearGains, 400);
});
