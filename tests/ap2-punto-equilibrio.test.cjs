const test = require("node:test");
const assert = require("node:assert/strict");

const DebtComparator = require("../canonical-debt-comparator.js");
const Portfolio = require("../canonical-portfolio.js");

// AP2 · Bloque 10: punto de equilibrio entre el TIN de una deuda y la rentabilidad de inversión
// esperada. Depende de IV2 y reutiliza las mismas dos fórmulas que AP1 (interés simple sobre la
// deuda, compuesto sobre la inversión) — el importe se cancela en la ecuación, así que no hace falta
// declararlo.

test("sin TIN de la deuda declarado, no calcula nada", () => {
  const result = DebtComparator.breakEvenInvestmentRatePct(null, 12);
  assert.equal(result.calculable, false);
});

test("sin horizonte en meses, no calcula nada", () => {
  const result = DebtComparator.breakEvenInvestmentRatePct(8, 0);
  assert.equal(result.calculable, false);
});

test("con un horizonte de un año, el punto de equilibrio coincide exactamente con el TIN — interés simple y compuesto coinciden al primer año", () => {
  const result = DebtComparator.breakEvenInvestmentRatePct(8, 12);
  assert.equal(result.calculable, true);
  assert.equal(result.breakEvenAnnualReturnPct, 8);
});

test("con un horizonte de varios años, el punto de equilibrio es menor que el TIN — el interés compuesto de la inversión adelanta al simple de la deuda", () => {
  const result = DebtComparator.breakEvenInvestmentRatePct(8, 36);
  assert.equal(result.calculable, true);
  assert.ok(result.breakEvenAnnualReturnPct < 8);
  assert.ok(result.breakEvenAnnualReturnPct > 0);
});

test("el punto de equilibrio calculado deja invertir y amortizar prácticamente empatados (a redondeo de 2 decimales)", () => {
  const debtAnnualRatePct = 8;
  const months = 36;
  const breakEven = DebtComparator.breakEvenInvestmentRatePct(debtAnnualRatePct, months);
  const investmentResult = Portfolio.opportunityCost({ amount: 1000, months, annualReturnPct: breakEven.breakEvenAnnualReturnPct });
  const comparison = DebtComparator.compareAmortizeVsInvest({ amount: 1000, months, debtAnnualRatePct, investmentResult });
  assert.ok(["neutral", "invertir", "amortizar"].includes(comparison.assessment));
  assert.ok(Math.abs(comparison.investGain - comparison.amortizeSavings) < 1);
});

test("breakEvenInvestmentRatePct está expuesta en el motor canónico", () => {
  assert.equal(typeof DebtComparator.breakEvenInvestmentRatePct, "function");
});
