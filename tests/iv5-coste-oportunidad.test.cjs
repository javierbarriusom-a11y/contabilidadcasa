const test = require("node:test");
const assert = require("node:assert/strict");

const Portfolio = require("../canonical-portfolio.js");

// IV5 · Bloque 10: coste de oportunidad de un importe de caja frente a haberlo dejado invertido en
// la cartera real del hogar (depende de IV1/IV2). `annualReturnPct` siempre lo calcula quien llama
// (la XIRR real de summarizePositions) — este motor no inventa ninguna cifra de mercado ni de
// rendimiento futuro, mismo criterio que AP3 con los escenarios de rentabilidad esperada.

test("sin importe, no hay coste de oportunidad calculable", () => {
  const result = Portfolio.opportunityCost({ amount: 0, months: 12, annualReturnPct: 5 });
  assert.equal(result.calculable, false);
});

test("sin horizonte en meses, no hay coste de oportunidad calculable", () => {
  const result = Portfolio.opportunityCost({ amount: 1000, months: 0, annualReturnPct: 5 });
  assert.equal(result.calculable, false);
});

test("sin una rentabilidad anual conocida, no hay coste de oportunidad calculable — nunca un 0% asumido", () => {
  const result = Portfolio.opportunityCost({ amount: 1000, months: 12, annualReturnPct: null });
  assert.equal(result.calculable, false);
  assert.equal(result.annualReturnPct, null);
});

test("con los tres datos, calcula el valor proyectado y la ganancia frente a haber gastado el importe", () => {
  const result = Portfolio.opportunityCost({ amount: 1000, months: 12, annualReturnPct: 10 });
  assert.equal(result.calculable, true);
  assert.equal(result.amount, 1000);
  assert.equal(result.months, 12);
  assert.equal(result.annualReturnPct, 10);
  assert.equal(result.projectedValue, 1100);
  assert.equal(result.gain, 100);
});

test("compone sobre un horizonte de menos de un año, proporcional a los meses", () => {
  const result = Portfolio.opportunityCost({ amount: 1000, months: 6, annualReturnPct: 10 });
  assert.equal(result.calculable, true);
  // (1 + 0.10)^0.5 ≈ 1.0488
  assert.ok(Math.abs(result.projectedValue - 1048.81) < 0.5);
});

test("una rentabilidad negativa reduce el valor proyectado, nunca lo trunca a la baja artificialmente", () => {
  const result = Portfolio.opportunityCost({ amount: 1000, months: 12, annualReturnPct: -5 });
  assert.equal(result.calculable, true);
  assert.equal(result.projectedValue, 950);
  assert.equal(result.gain, -50);
});

test("un importe negativo se trata como cero — nunca un coste de oportunidad de un gasto inexistente", () => {
  const result = Portfolio.opportunityCost({ amount: -500, months: 12, annualReturnPct: 5 });
  assert.equal(result.calculable, false);
  assert.equal(result.amount, 0);
});

test("opportunityCost está expuesta en el motor canónico", () => {
  assert.equal(typeof Portfolio.opportunityCost, "function");
});
