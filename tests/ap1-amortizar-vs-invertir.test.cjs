const test = require("node:test");
const assert = require("node:assert/strict");

const DebtComparator = require("../canonical-debt-comparator.js");
const Portfolio = require("../canonical-portfolio.js");

// AP1 · Bloque 10: comparador amortizar vs. invertir. Depende de IV1/IV2 e IV5
// (FinanceCanonicalPortfolio.opportunityCost, ya construido) — el lado de "invertir" nunca lo
// recalcula este motor, lo recibe ya resuelto (`investmentResult`), mismo patrón de composición que
// AP3 con el guardarraíl de AP4.

test("sin importe, no calcula nada", () => {
  const result = DebtComparator.compareAmortizeVsInvest({ amount: 0, months: 12, debtAnnualRatePct: 10 });
  assert.equal(result.calculable, false);
});

test("sin horizonte en meses, no calcula nada", () => {
  const result = DebtComparator.compareAmortizeVsInvest({ amount: 1000, months: 0, debtAnnualRatePct: 10 });
  assert.equal(result.calculable, false);
});

test("sin TIN de la deuda declarado, no calcula nada", () => {
  const result = DebtComparator.compareAmortizeVsInvest({ amount: 1000, months: 12, debtAnnualRatePct: null });
  assert.equal(result.calculable, false);
});

test("con los tres datos, calcula el ahorro de intereses de amortizar", () => {
  const result = DebtComparator.compareAmortizeVsInvest({ amount: 1000, months: 12, debtAnnualRatePct: 8 });
  assert.equal(result.calculable, true);
  assert.equal(result.amount, 1000);
  assert.equal(result.amortizeSavings, 80);
});

test("el importe se limita al principal pendiente de la deuda — nunca amortiza más de lo que se debe", () => {
  const result = DebtComparator.compareAmortizeVsInvest({ amount: 5000, months: 12, debtAnnualRatePct: 8, remainingPrincipal: 1000 });
  assert.equal(result.amount, 1000);
  assert.equal(result.amortizeSavings, 80);
});

test("sin principal pendiente declarado, usa el importe tal cual", () => {
  const result = DebtComparator.compareAmortizeVsInvest({ amount: 1000, months: 12, debtAnnualRatePct: 8, remainingPrincipal: null });
  assert.equal(result.amount, 1000);
});

test("sin investmentResult, la lectura es invertir-no-calculable — nunca compara contra una cifra inventada", () => {
  const result = DebtComparator.compareAmortizeVsInvest({ amount: 1000, months: 12, debtAnnualRatePct: 8, investmentResult: null });
  assert.equal(result.investGain, null);
  assert.equal(result.assessment, "invertir-no-calculable");
});

test("con investmentResult no calculable (sin cartera), la lectura sigue siendo invertir-no-calculable", () => {
  const investmentResult = Portfolio.opportunityCost({ amount: 1000, months: 12, annualReturnPct: null });
  const result = DebtComparator.compareAmortizeVsInvest({ amount: 1000, months: 12, debtAnnualRatePct: 8, investmentResult });
  assert.equal(result.assessment, "invertir-no-calculable");
});

test("cuando invertir gana más que el ahorro de intereses, la lectura es invertir", () => {
  const investmentResult = Portfolio.opportunityCost({ amount: 1000, months: 12, annualReturnPct: 15 });
  const result = DebtComparator.compareAmortizeVsInvest({ amount: 1000, months: 12, debtAnnualRatePct: 8, investmentResult });
  assert.equal(result.assessment, "invertir");
  assert.equal(result.investGain, 150);
});

test("cuando amortizar ahorra más que lo que ganaría invertido, la lectura es amortizar", () => {
  const investmentResult = Portfolio.opportunityCost({ amount: 1000, months: 12, annualReturnPct: 3 });
  const result = DebtComparator.compareAmortizeVsInvest({ amount: 1000, months: 12, debtAnnualRatePct: 8, investmentResult });
  assert.equal(result.assessment, "amortizar");
});

test("cuando ambos coinciden exactamente, la lectura es neutral", () => {
  const investmentResult = Portfolio.opportunityCost({ amount: 1000, months: 12, annualReturnPct: 8 });
  const result = DebtComparator.compareAmortizeVsInvest({ amount: 1000, months: 12, debtAnnualRatePct: 8, investmentResult });
  assert.equal(result.assessment, "neutral");
});

test("compareAmortizeVsInvest está expuesta en el motor canónico", () => {
  assert.equal(typeof DebtComparator.compareAmortizeVsInvest, "function");
});
