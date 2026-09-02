const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const Simulator = require("../canonical-leverage-simulator.js");
const { evaluateLeverageBarrier } = require("../canonical-leverage-barrier.js");

// AP3 · Bloque 9: simulador de apalancamiento (pedir deuda nueva para invertir) — explorar, no
// ejecutar. Depende de AP4 (canonical-leverage-barrier.js), a propósito: sin sus condiciones
// mínimas verificadas no hay simulación que mostrar. Los tres escenarios de rentabilidad esperada
// (pesimista/base/optimista) los declara el hogar — el motor no inventa ninguna cifra de mercado.

test("expone FinanceCanonicalLeverageSimulator al cargarse directamente en navegador", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "canonical-leverage-simulator.js"), "utf8");
  const context = { globalThis: {} };
  vm.runInNewContext(source, context, { filename: "canonical-leverage-simulator.js" });
  assert.equal(typeof context.globalThis.FinanceCanonicalLeverageSimulator?.simulateLeverage, "function");
});

function readyBarrier() {
  return evaluateLeverageBarrier({
    cushion: { value: 6000, floor: 4000 },
    debtQualityIssues: [],
    monthlyIncome: 4000,
    monthlyDebtService: 800,
  });
}

function blockedBarrier() {
  return evaluateLeverageBarrier({
    cushion: { value: 2000, floor: 4000 },
    debtQualityIssues: [],
    monthlyIncome: 4000,
    monthlyDebtService: 800,
  });
}

test("sin el guardarraíl en estado ready, no calcula nada y devuelve sus bloqueadores", () => {
  const barrier = blockedBarrier();
  const result = Simulator.simulateLeverage({ barrierResult: barrier, newDebtAmount: 10000, newDebtAnnualRatePercent: 5 });
  assert.equal(result.calculable, false);
  assert.equal(result.reason, "barrier-blocked");
  assert.equal(result.blockers.length, barrier.blockers.length);
});

test("sin barrierResult en absoluto, tampoco calcula (fallo cerrado)", () => {
  const result = Simulator.simulateLeverage({ newDebtAmount: 10000, newDebtAnnualRatePercent: 5 });
  assert.equal(result.calculable, false);
  assert.equal(result.reason, "barrier-blocked");
});

test("con el guardarraíl ready pero sin importe de deuda, no calcula", () => {
  const result = Simulator.simulateLeverage({ barrierResult: readyBarrier(), newDebtAmount: 0, newDebtAnnualRatePercent: 5 });
  assert.equal(result.calculable, false);
  assert.equal(result.reason, "missing-debt-amount");
});

test("con guardarraíl ready e importe de deuda, calcula el coste y los tres escenarios", () => {
  const result = Simulator.simulateLeverage({
    barrierResult: readyBarrier(),
    newDebtAmount: 10000,
    newDebtAnnualRatePercent: 5,
    expectedReturnScenarios: { pessimisticPercent: 2, basePercent: 6, optimisticPercent: 10 },
  });
  assert.equal(result.calculable, true);
  assert.equal(result.newDebtAmount, 10000);
  assert.equal(result.annualDebtCost, 500);
  assert.equal(result.scenarios.pessimistic.expectedAnnualReturn, 200);
  assert.equal(result.scenarios.base.expectedAnnualReturn, 600);
  assert.equal(result.scenarios.optimistic.expectedAnnualReturn, 1000);
});

test("la lectura favorable/desfavorable de cada escenario compara rendimiento esperado contra coste de la deuda, nada más", () => {
  const result = Simulator.simulateLeverage({
    barrierResult: readyBarrier(),
    newDebtAmount: 10000,
    newDebtAnnualRatePercent: 5,
    expectedReturnScenarios: { pessimisticPercent: 2, basePercent: 5, optimisticPercent: 10 },
  });
  assert.equal(result.scenarios.pessimistic.assessment, "desfavorable");
  assert.equal(result.scenarios.base.assessment, "neutral");
  assert.equal(result.scenarios.optimistic.assessment, "favorable");
});

test("sin escenarios de rentabilidad declarados, el rendimiento esperado es 0 — nunca una cifra de mercado inventada", () => {
  const result = Simulator.simulateLeverage({ barrierResult: readyBarrier(), newDebtAmount: 10000, newDebtAnnualRatePercent: 5 });
  assert.equal(result.calculable, true);
  assert.equal(result.scenarios.base.expectedAnnualReturn, 0);
  assert.equal(result.scenarios.base.assessment, "desfavorable");
});

test("el aviso profesional deja claro que la lectura se puede aceptar o descartar, nunca es una orden", () => {
  const result = Simulator.simulateLeverage({
    barrierResult: readyBarrier(),
    newDebtAmount: 10000,
    newDebtAnnualRatePercent: 5,
    expectedReturnScenarios: { pessimisticPercent: 2, basePercent: 6, optimisticPercent: 10 },
  });
  assert.match(result.warning, /acéptala o descártala/);
  assert.match(result.warning, /no es una recomendación de pedir deuda/i);
});

test("saveScenario guarda una fotografía del resultado, con su propio schemaId, nunca una posición real", () => {
  const result = Simulator.simulateLeverage({
    barrierResult: readyBarrier(),
    newDebtAmount: 10000,
    newDebtAnnualRatePercent: 5,
    expectedReturnScenarios: { pessimisticPercent: 2, basePercent: 6, optimisticPercent: 10 },
  });
  const saved = Simulator.saveScenario(result, { name: "Hipoteca para invertir" });
  assert.equal(saved.schemaId, Simulator.SAVED_SCHEMA_ID);
  assert.equal(saved.name, "Hipoteca para invertir");
  assert.equal(saved.result.newDebtAmount, 10000);
  assert.ok(saved.id);
  assert.ok(saved.createdAt);
});

test("saveScenario sin nombre declarado cae a un nombre por defecto, nunca vacío", () => {
  const result = Simulator.simulateLeverage({
    barrierResult: readyBarrier(),
    newDebtAmount: 5000,
    newDebtAnnualRatePercent: 4,
    expectedReturnScenarios: { pessimisticPercent: 1, basePercent: 5, optimisticPercent: 9 },
  });
  const saved = Simulator.saveScenario(result, {});
  assert.equal(saved.name, "Escenario explorado");
});
