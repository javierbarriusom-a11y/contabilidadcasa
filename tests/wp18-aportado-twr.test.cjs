const test = require("node:test");
const assert = require("node:assert/strict");
const valuation = require("../canonical-portfolio-valuation.js");

// WP-18 (NIN-03): aportado frente a valor y rentabilidad ponderada por tiempo (TWR) sobre la serie de valoraciones de WP-15.
// Cifras inventadas, calculadas a mano.

const store = (entries) => valuation.normalizeStore({ valuations: entries.map(([date, points]) => ({ date, savedAt: `${date}T10:00:00Z`, points: points.map(([id, value]) => ({ id, value, cost: 0 })) })) });

test("un tramo sin flujos es la variación simple; los flujos al final del tramo no cuentan como mercado", () => {
  assert.equal(Math.round(valuation.dietzReturn({ from: "2026-01-01", to: "2026-02-01", startValue: 1000, endValue: 1100, flows: [] }) * 1000) / 10, 10);
  // 500 € aportados el último día: el valor sube 600, pero el mercado solo puso 100 sobre 1.100.
  const r = valuation.dietzReturn({ from: "2026-02-01", to: "2026-03-01", startValue: 1100, endValue: 1700, flows: [{ date: "2026-03-01", amount: 500 }] });
  assert.equal(Math.round(r * 10000) / 100, 9.09);
  // Sin base (todo vendido al empezar el tramo) no hay rentabilidad que inventar.
  assert.equal(valuation.dietzReturn({ from: "2026-01-01", to: "2026-02-01", startValue: 0, endValue: 0, flows: [] }), null);
});

test("la TWR encadena los tramos, no anualiza con menos de un año y no depende de cuándo se aportó", () => {
  const points = [{ date: "2026-01-01", value: 1000 }, { date: "2026-02-01", value: 1100 }, { date: "2026-03-01", value: 1700 }];
  const twr = valuation.chainTwr(points, [{ date: "2026-03-01", amount: 500 }]);
  assert.equal(twr.calculable, true);
  assert.equal(twr.cumulativePct, 20); // 1,10 × 1,0909 − 1
  assert.equal(twr.annualizedPct, null, "con 59 días no se anualiza");
  assert.equal(twr.periods, 2);
  // El mismo mercado (+10 % y +9,09 %) con la aportación en otro momento da la misma TWR.
  const otra = valuation.chainTwr([{ date: "2026-01-01", value: 1500 }, { date: "2026-02-01", value: 1650 }, { date: "2026-03-01", value: 1800 }], []);
  assert.equal(otra.cumulativePct, 20);
  // Con un año o más, también anualizada.
  const anual = valuation.chainTwr([{ date: "2025-01-01", value: 1000 }, { date: "2027-01-01", value: 1210 }], []);
  assert.equal(anual.cumulativePct, 21);
  assert.equal(anual.annualizedPct, 10);
});

test("con menos de dos puntos, datos insuficientes, nunca una cifra", () => {
  assert.deepEqual(valuation.chainTwr([], []), { calculable: false, reason: "sin-puntos", points: 0 });
  assert.deepEqual(valuation.chainTwr([{ date: "2026-01-01", value: 1000 }], []), { calculable: false, reason: "un-punto", points: 1 });
  // Una posición sin fecha de alta ni valoraciones no tiene puntos.
  assert.equal(valuation.positionTwr({ id: "x", currentValue: 900 }, store([])).calculable, false);
});

test("los puntos de una posición: el alta, el valor declarado y la hoja; a igual fecha manda la hoja", () => {
  const position = { id: "fondo", acquisitionDate: "2026-01-01", initialCost: 1000, asOf: "2026-03-01", currentValue: 1650, contributions: [{ date: "2026-02-15", amount: 300 }], disposals: [{ date: "2026-02-20", quantitySold: 1, saleProceeds: 100 }] };
  const s = store([["2026-02-01", [["fondo", 1080]]], ["2026-03-01", [["fondo", 1700]]]]);
  assert.deepEqual(valuation.positionPoints(position, s), [{ date: "2026-01-01", value: 1000 }, { date: "2026-02-01", value: 1080 }, { date: "2026-03-01", value: 1700 }]);
  assert.deepEqual(valuation.positionFlows(position), [{ date: "2026-02-15", amount: 300 }, { date: "2026-02-20", amount: -100 }]);
  const twr = valuation.positionTwr(position, s);
  assert.equal(twr.calculable, true);
  assert.equal(twr.points, 3);
});

test("la cartera cuenta el alta de cada posición como aportación y dice cuántos valores arrastra", () => {
  const a = { id: "a", acquisitionDate: "2026-01-01", initialCost: 1000 };
  const b = { id: "b", acquisitionDate: "2026-02-01", initialCost: 500 };
  // a vale 1.100 el 1/2 y 1.210 el 1/3; b no se valora el 1/3 (cuenta con sus 500).
  const s = store([["2026-02-01", [["a", 1100]]], ["2026-03-01", [["a", 1210]]]]);
  const twr = valuation.portfolioTwr([a, b], s);
  assert.equal(twr.calculable, true);
  // Tramo 1: 1.000 → 1.600 con 500 de alta el último día: +10 %. Tramo 2: 1.600 → 1.710 sin flujos: +6,875 %.
  assert.equal(twr.cumulativePct, 17.6);
  assert.equal(twr.carried, 1);
});

test("aportado frente a valor: de cada 100 €, cuánto pusisteis y cuánto el mercado; en pérdidas, cuánto se ha llevado", () => {
  assert.deepEqual(valuation.contributedVsValue({ totalCost: 7800, totalValue: 10000 }), { calculable: true, gain: 2200, cost: 7800, value: 10000, direction: "gana", yoursPer100: 78, marketPer100: 22 });
  assert.deepEqual(valuation.contributedVsValue({ totalCost: 10000, totalValue: 9200 }), { calculable: true, gain: -800, cost: 10000, value: 9200, direction: "pierde", lostPct: 8 });
  assert.equal(valuation.contributedVsValue({ totalCost: 0, totalValue: 500 }).calculable, false);
  assert.equal(valuation.contributedVsValue({ totalCost: 500, totalValue: 0 }).reason, "sin-valor");
});
