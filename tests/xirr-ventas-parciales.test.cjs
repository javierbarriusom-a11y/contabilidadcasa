const test = require("node:test");
const assert = require("node:assert/strict");

const Portfolio = require("../canonical-portfolio.js");

// Hallazgo de WP-15 (7/10/2026, deducido leyendo el código y ahora reproducido): `positionCashFlows` no recibía las ventas
// parciales, así que el dinero cobrado al vender no entraba en la rentabilidad anualizada (XIRR) de la posición ni en la de la
// cartera. Tras vender una parte, la rentabilidad salía más baja que la real, y sin ninguna venta posterior a la valoración la
// diferencia era enorme. Caso con solución exacta: se compran 1.000 € el 1/1/2024, se vende la mitad por 700 € el 1/1/2025 y lo
// que queda vale 600 € el 1/1/2026. -1000 + 700/(1+r) + 600/(1+r)² = 0 → r = 20 % exacto (x = 1/(1+r): 600x² + 700x − 1000 = 0 → x = 5/6).
// Los años se cuentan con 365 días (2024 es bisiesto), así que se compara con una tolerancia de 0,3 puntos.

const base = {
  id: "p1", type: "fondo", label: "Fondo de prueba", quantity: 10, costBasis: 1000, currentValue: 600,
  asOf: "2026-01-01", acquisitionDate: "2024-01-01", provenance: "declared",
};
const sale = (overrides = {}) => ({ id: "d1", date: "2025-01-01", quantitySold: 5, saleProceeds: 700, ...overrides });

test("XIRR · una venta parcial cuenta como dinero devuelto: la rentabilidad real es ≈ 20 %, no −22,5 %", () => {
  const position = Portfolio.normalizePosition({ ...base, disposals: [sale()] });
  assert.ok(position.xirr.rate !== null, `no se calculó: ${position.xirr.reason}`);
  assert.ok(Math.abs(position.xirr.ratePct - 20) < 0.3, `XIRR = ${position.xirr.ratePct} %, esperado ≈ 20 %`);
  assert.ok(position.cashFlows.some((flow) => flow.date === "2025-01-01" && flow.amount === 700), "la venta es un flujo positivo con su fecha");
  assert.equal(position.cashFlows.filter((flow) => flow.amount < 0).length, 1, "las compras siguen siendo una salida cada una; la venta no las sustituye");
});

test("XIRR · sin ventas el resultado no cambia (retrocompatible)", () => {
  const position = Portfolio.normalizePosition({ ...base, quantity: 10, currentValue: 1200 });
  assert.deepEqual(position.cashFlows, [{ date: "2024-01-01", amount: -1000 }, { date: "2026-01-01", amount: 1200 }]);
  assert.ok(Math.abs(position.xirr.ratePct - 9.54) < 0.1, `√1,2 − 1 ≈ 9,54 %: ${position.xirr.ratePct}`);
});

test("XIRR · varias ventas y aportaciones: cada una con su fecha y su signo", () => {
  const position = Portfolio.normalizePosition({
    ...base, quantity: 10, costBasis: 1000, currentValue: 500,
    contributions: [{ id: "c1", date: "2024-07-01", amount: 500, quantity: 5 }],
    disposals: [sale({ id: "d1", date: "2025-01-01", quantitySold: 4, saleProceeds: 600 }), sale({ id: "d2", date: "2025-07-01", quantitySold: 3, saleProceeds: 450 })],
  });
  const flows = position.cashFlows.map((flow) => `${flow.date}:${flow.amount}`);
  assert.deepEqual(flows, ["2024-01-01:-1000", "2024-07-01:-500", "2025-01-01:600", "2025-07-01:450", "2026-01-01:500"], "compras, ventas y valor final");
  assert.equal(position.cashFlows.filter((flow) => flow.amount > 0).length, 3);
  assert.ok(position.xirr.rate !== null);
});

test("XIRR · vender todo (queda valor 0) también se calcula: antes salía «sin flujos suficientes»", () => {
  const position = Portfolio.normalizePosition({ ...base, quantity: 10, currentValue: 0, disposals: [sale({ quantitySold: 10, saleProceeds: 1500 })] });
  assert.ok(position.xirr.rate !== null, `no se calculó: ${position.xirr.reason}`);
  assert.ok(Math.abs(position.xirr.ratePct - 50) < 0.5, `1.000 → 1.500 en 1 año ≈ 50 %: ${position.xirr.ratePct}`);
});

test("XIRR · una venta sin importe cobrado no se inventa: la rentabilidad queda «no calculable» con su motivo", () => {
  for (const proceeds of [0, undefined, null, "", "abc"]) {
    const position = Portfolio.normalizePosition({ ...base, disposals: [sale({ saleProceeds: proceeds })] });
    assert.equal(position.xirr.rate, null, `saleProceeds = ${JSON.stringify(proceeds)}`);
    assert.equal(position.xirr.reason, "disposal-proceeds-unknown");
  }
});

test("XIRR · la cartera agrupa los flujos con sus ventas, y una venta sin importe invalida solo la cifra agregada, con motivo", () => {
  const other = { ...base, id: "p2", label: "Otro", quantity: 4, costBasis: 400, currentValue: 480 };
  const summary = Portfolio.summarizePositions([Portfolio.normalizePosition({ ...base, disposals: [sale()] }), Portfolio.normalizePosition(other)]);
  assert.ok(summary.xirr.rate !== null);
  assert.ok(summary.xirr.ratePct > 10, `con las ventas la cartera rinde bastante más que sin ellas: ${summary.xirr.ratePct}`);
  const unknown = Portfolio.summarizePositions([Portfolio.normalizePosition({ ...base, disposals: [sale({ saleProceeds: 0 })] }), Portfolio.normalizePosition(other)]);
  assert.equal(unknown.xirr.rate, null);
  assert.equal(unknown.xirr.reason, "disposal-proceeds-unknown");
  assert.equal(unknown.totalValue, 1080, "el resto de la cartera no se ve afectado");
});

test("XIRR · la plusvalía realizada FIFO no cambia con este arreglo", () => {
  const position = Portfolio.normalizePosition({ ...base, disposals: [sale()] });
  assert.equal(position.realizedGain, 200, "700 cobrados − 500 de coste consumido");
  assert.equal(position.costBasis, 500);
});
