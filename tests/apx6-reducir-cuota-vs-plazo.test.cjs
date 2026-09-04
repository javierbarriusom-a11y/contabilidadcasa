const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const DebtComparator = require(path.join(root, "canonical-debt-comparator.js"));

// APX6 (Oleada 2 Bloque 2): amortizar reduciendo cuota (misma duración, cuota más baja) frente a
// reduciendo plazo (misma cuota, menos meses) — extiende compareAmortizeVsInvest() (AP1) y A9-3 con
// la fórmula de amortización real (cuota francesa), en vez de la estimación de interés simple que
// ya usa compareAmortizeVsInvest.

test("amortizeReduceQuotaVsTerm · reducir cuota mantiene el plazo y baja la cuota mensual", () => {
  const result = DebtComparator.amortizeReduceQuotaVsTerm({ principal: 100000, annualRatePct: 4, months: 240, lumpSum: 10000 });
  assert.equal(result.calculable, true);
  assert.equal(result.reduceQuota.months, 240);
  assert.ok(result.reduceQuota.newPayment < result.currentPayment);
  assert.ok(result.reduceQuota.interestSaved > 0);
});

test("amortizeReduceQuotaVsTerm · reducir plazo mantiene la cuota y acorta los meses", () => {
  const result = DebtComparator.amortizeReduceQuotaVsTerm({ principal: 100000, annualRatePct: 4, months: 240, lumpSum: 10000 });
  assert.equal(result.reduceTerm.payment, result.currentPayment);
  assert.ok(result.reduceTerm.newMonths < 240);
  assert.ok(result.reduceTerm.monthsReduced > 0);
  assert.ok(result.reduceTerm.interestSaved > 0);
});

test("amortizeReduceQuotaVsTerm · reducir plazo ahorra siempre al menos tanto interés como reducir cuota (mismo capital amortizado, menos tiempo pagando intereses)", () => {
  const result = DebtComparator.amortizeReduceQuotaVsTerm({ principal: 100000, annualRatePct: 4, months: 240, lumpSum: 10000 });
  assert.ok(result.reduceTerm.interestSaved >= result.reduceQuota.interestSaved);
});

test("amortizeReduceQuotaVsTerm · importe extra mayor o igual que el principal, no calculable (no se puede amortizar más de lo que se debe)", () => {
  const result = DebtComparator.amortizeReduceQuotaVsTerm({ principal: 10000, annualRatePct: 4, months: 120, lumpSum: 10000 });
  assert.equal(result.calculable, false);
});

test("amortizeReduceQuotaVsTerm · sin TIN declarado (null), no calculable — nunca asume un tipo por defecto", () => {
  const result = DebtComparator.amortizeReduceQuotaVsTerm({ principal: 100000, annualRatePct: null, months: 240, lumpSum: 10000 });
  assert.equal(result.calculable, false);
});

test("amortizeReduceQuotaVsTerm · sin importe extra (0 o negativo), no calculable", () => {
  assert.equal(DebtComparator.amortizeReduceQuotaVsTerm({ principal: 100000, annualRatePct: 4, months: 240, lumpSum: 0 }).calculable, false);
  assert.equal(DebtComparator.amortizeReduceQuotaVsTerm({ principal: 100000, annualRatePct: 4, months: 240, lumpSum: -500 }).calculable, false);
});

test("amortizeReduceQuotaVsTerm · con TIN 0%, la cuota es lineal y el plazo reducido se calcula sin logaritmos", () => {
  const result = DebtComparator.amortizeReduceQuotaVsTerm({ principal: 12000, annualRatePct: 0, months: 12, lumpSum: 6000 });
  assert.equal(result.calculable, true);
  assert.equal(result.currentPayment, 1000);
  assert.equal(result.reduceTerm.newMonths, 6);
});

test("app.js: apx6ReduceQuotaVsTermHtml usa el plazo REAL restante del contrato (remainingInstallments), nunca el horizonte de comparación de AP1", () => {
  const block = app.slice(app.indexOf("function apx6ReduceQuotaVsTermHtml("), app.indexOf("function apx6ReduceQuotaVsTermHtml(") + 900);
  assert.match(block, /debtContractSourceRows\(\)\.find\(\(row\) => row\.id === debt\.id\)/);
  assert.match(block, /contract\?\.remainingInstallments/);
  assert.doesNotMatch(block, /qs\("ap1Months"\)/, "no debe leer el horizonte de comparación de AP1, es un dato distinto");
});

test("app.js: handleAp1Compare pinta también la comparación de APX6", () => {
  assert.match(app, /apx6ReduceQuotaVsTermHtml\(debt, amount, debtAnnualRatePct\)/);
});
