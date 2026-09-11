const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// LEV9 (Oleada 4, Bloque 2 — bandera del diagnóstico "El Libro Vivo", F-07, sin precedente en la
// Oleada 3): comparador cruzado de instrumentos de apalancamiento (Lombard / hipoteca / línea de
// crédito) para una misma necesidad de capital. Reutiliza lombardCreditCapacity (APX2) y
// evaluateEmergencyCreditLine (DI2) sin reimplementar sus fórmulas.

const Comparator = require("../canonical-leverage-cross-comparator.js");
const LeverageSimulator = require("../canonical-leverage-simulator.js");
const EmergencyCreditLine = require("../canonical-emergency-credit-line.js");

const appSource = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const indexSource = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function frenchMonthlyPayment(principal, annualRatePct, months) {
  const monthlyRate = annualRatePct / 100 / 12;
  if (monthlyRate === 0) return round2(principal / months);
  const factor = Math.pow(1 + monthlyRate, months);
  return round2((principal * monthlyRate * factor) / (factor - 1));
}

test("crossInstrumentLeverageComparison · sin importe declarado, no calculable", () => {
  const result = Comparator.crossInstrumentLeverageComparison({ amount: 0, months: 12, lombardEngine: LeverageSimulator, creditLineEngine: EmergencyCreditLine });
  assert.equal(result.calculable, false);
  assert.equal(result.reason, "missing-amount");
});

test("crossInstrumentLeverageComparison · sin los motores de Lombard/línea de crédito, no calculable", () => {
  const result = Comparator.crossInstrumentLeverageComparison({ amount: 1000, months: 12 });
  assert.equal(result.calculable, false);
  assert.equal(result.reason, "missing-engines");
});

test("crossInstrumentLeverageComparison · instrumento sin datos declarados queda marcado como no disponible, nunca inventado", () => {
  const result = Comparator.crossInstrumentLeverageComparison({
    amount: 10000, months: 12,
    lombard: {}, mortgage: {}, creditLine: {},
    lombardEngine: LeverageSimulator, creditLineEngine: EmergencyCreditLine,
  });
  assert.equal(result.calculable, true);
  result.instruments.forEach((item) => assert.equal(item.available, false));
  assert.equal(result.evaluatedCount, 0);
  assert.equal(result.cheapestId, null);
});

test("crossInstrumentLeverageComparison · Lombard sin capacidad suficiente marca shortfall, nunca lo oculta", () => {
  const result = Comparator.crossInstrumentLeverageComparison({
    amount: 60000, months: 12,
    lombard: { portfolioValue: 100000, ltvPct: 50, annualRatePct: 4 },
    lombardEngine: LeverageSimulator, creditLineEngine: EmergencyCreditLine,
  });
  const lombard = result.instruments.find((item) => item.id === "lombard");
  assert.equal(lombard.available, true);
  assert.equal(lombard.feasible, false);
  assert.equal(lombard.capacity, 50000);
  assert.equal(lombard.shortfall, 10000);
  assert.equal(lombard.ap4Applies, false);
});

test("crossInstrumentLeverageComparison · línea de crédito cubre el importe y calcula el coste con evaluateEmergencyCreditLine tal cual", () => {
  const result = Comparator.crossInstrumentLeverageComparison({
    amount: 5000, months: 6,
    creditLine: { limit: 10000, annualRatePct: 6 },
    lombardEngine: LeverageSimulator, creditLineEngine: EmergencyCreditLine,
  });
  const creditLine = result.instruments.find((item) => item.id === "credit-line");
  assert.equal(creditLine.available, true);
  assert.equal(creditLine.feasible, true);
  assert.equal(creditLine.totalCost, 150); // 5000 * 6% * (6/12)
});

test("crossInstrumentLeverageComparison · línea de crédito insuficiente marca el hueco exacto", () => {
  const result = Comparator.crossInstrumentLeverageComparison({
    amount: 8000, months: 6,
    creditLine: { limit: 5000, annualRatePct: 6 },
    lombardEngine: LeverageSimulator, creditLineEngine: EmergencyCreditLine,
  });
  const creditLine = result.instruments.find((item) => item.id === "credit-line");
  assert.equal(creditLine.feasible, false);
  assert.equal(creditLine.shortfall, 3000);
});

test("crossInstrumentLeverageComparison · hipoteca sin tipo declarado queda no disponible", () => {
  const result = Comparator.crossInstrumentLeverageComparison({
    amount: 40000, months: 12,
    mortgage: {},
    lombardEngine: LeverageSimulator, creditLineEngine: EmergencyCreditLine,
  });
  const mortgage = result.instruments.find((item) => item.id === "mortgage");
  assert.equal(mortgage.available, false);
});

test("crossInstrumentLeverageComparison · hipoteca calcula el coste total con la misma cuota francesa, y elige el más barato de verdad", () => {
  const amount = 40000;
  const months = 12;
  const mortgageRatePct = 3;
  const result = Comparator.crossInstrumentLeverageComparison({
    amount, months,
    lombard: { portfolioValue: 100000, ltvPct: 50, annualRatePct: 4 }, // capacidad 50000, coste anual 2000 → totalCost 2000
    mortgage: { annualRatePct: mortgageRatePct },
    creditLine: { limit: 50000, annualRatePct: 5 }, // drawn 40000 * 5% * 1 año = 2000
    lombardEngine: LeverageSimulator, creditLineEngine: EmergencyCreditLine,
  });
  const expectedMortgagePayment = frenchMonthlyPayment(amount, mortgageRatePct, months);
  const expectedMortgageCost = round2(expectedMortgagePayment * months - amount);
  const mortgage = result.instruments.find((item) => item.id === "mortgage");
  assert.equal(mortgage.totalCost, expectedMortgageCost);
  assert.ok(mortgage.totalCost > 0);
  // Al 3% la hipoteca sale más barata que Lombard/línea de crédito al 4-5% sobre el mismo importe.
  assert.equal(result.cheapestId, "mortgage");
  assert.equal(result.feasibleCount, 3);
});

test("crossInstrumentLeverageComparison · guardarraíles: AP4 no aplica a Lombard, LEV1 aplica a los tres", () => {
  const result = Comparator.crossInstrumentLeverageComparison({
    amount: 10000, months: 12,
    lombard: { portfolioValue: 100000, ltvPct: 50, annualRatePct: 4 },
    mortgage: { annualRatePct: 3 },
    creditLine: { limit: 20000, annualRatePct: 5 },
    barrierResult: { valid: false },
    leveragePolicy: { calculable: true, withinLimit: true },
    lombardEngine: LeverageSimulator, creditLineEngine: EmergencyCreditLine,
  });
  const lombard = result.instruments.find((item) => item.id === "lombard");
  const mortgage = result.instruments.find((item) => item.id === "mortgage");
  const creditLine = result.instruments.find((item) => item.id === "credit-line");
  assert.equal(lombard.ap4Applies, false);
  assert.equal(mortgage.ap4Applies, true);
  assert.equal(creditLine.ap4Applies, true);
  assert.equal(result.barrierValid, false);
  assert.equal(result.policyWithinLimit, true);
});

test("crossInstrumentLeverageComparison está exportada y trae advertencia — nunca ejecuta ni recomienda pedir deuda", () => {
  assert.equal(typeof Comparator.crossInstrumentLeverageComparison, "function");
  const result = Comparator.crossInstrumentLeverageComparison({
    amount: 1000, months: 12,
    creditLine: { limit: 2000, annualRatePct: 5 },
    lombardEngine: LeverageSimulator, creditLineEngine: EmergencyCreditLine,
  });
  assert.match(result.warning, /nunca garantizados|no es una recomendación/i);
});

test("wiring: la tarjeta LEV9 vive en index.html entre APX3 y el comparador AP1, cargando el módulo nuevo", () => {
  const apx3Pos = indexSource.indexOf('id="apx3MarginCallNote"');
  const lev9Pos = indexSource.indexOf('id="lev9CompareRun"');
  const ap1Pos = indexSource.indexOf('id="ap1CompareRun"');
  assert.ok(apx3Pos >= 0 && lev9Pos > apx3Pos && lev9Pos < ap1Pos);
  ["lev9Amount", "lev9Months", "lev9MortgageRatePct", "lev9CreditLineLimit", "lev9CreditLineRatePct", "lev9ComparisonNote"].forEach((id) => {
    assert.match(indexSource, new RegExp(`id="${id}"`));
  });
  assert.match(indexSource, /canonical-leverage-cross-comparator\.js/);
});

test("wiring: handleLev9Compare reutiliza lombardCreditCapacity/evaluateEmergencyCreditLine vía el comparador cruzado, sin motor propio", () => {
  const block = appSource.slice(appSource.indexOf("function handleLev9Compare("), appSource.indexOf("function handleLev9Compare(") + 1600);
  assert.match(block, /window\.FinanceCanonicalLeverageCrossComparator/);
  assert.match(block, /window\.FinanceCanonicalLeverageSimulator/);
  assert.match(block, /window\.FinanceCanonicalEmergencyCreditLine/);
  assert.match(block, /crossInstrumentLeverageComparison\(/);
  assert.match(appSource, /qs\("lev9CompareRun"\)\?\.addEventListener\("click", handleLev9Compare\)/);
});
