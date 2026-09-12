const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const LeverageSimulator = require("../canonical-leverage-simulator.js");

// LEV14 (Oleada 4, Bloque 5): apalancamiento parcial escalonado (dollar-cost leverage) — simetría
// con INV8 (DCA) aplicada al lado de la deuda. Alcance confirmado por el hogar (sesión 171): solo
// simulador informativo, nunca ejecuta ni programa ninguna toma de deuda real. Mismo guardarraíl
// AP4 que simulateLeverage(), y reutiliza tal cual simulateLeverage() para la comparación de
// referencia (lumpSum), sin reimplementar su aritmética.

const VALID_BARRIER = { valid: true, blockers: [] };
const BLOCKED_BARRIER = { valid: false, blockers: [{ title: "Colchón insuficiente", detail: "..." }] };
const SCENARIOS = { pessimisticPercent: 1, basePercent: 4, optimisticPercent: 7 };

test("staggeredLeverageDeployment · guardarraíl no superado, no calculable", () => {
  const result = LeverageSimulator.staggeredLeverageDeployment({
    barrierResult: BLOCKED_BARRIER,
    totalDebtAmount: 40000,
    numTranches: 4,
    trancheIntervalMonths: 3,
    newDebtAnnualRatePercent: 3,
    expectedReturnScenarios: SCENARIOS,
  });
  assert.equal(result.calculable, false);
  assert.equal(result.reason, "barrier-blocked");
  assert.equal(result.blockers.length, 1);
});

test("staggeredLeverageDeployment · sin barrera en absoluto, no calculable", () => {
  const result = LeverageSimulator.staggeredLeverageDeployment({ totalDebtAmount: 40000, numTranches: 4 });
  assert.equal(result.calculable, false);
  assert.equal(result.reason, "barrier-blocked");
});

test("staggeredLeverageDeployment · sin importe de deuda, no calculable", () => {
  const result = LeverageSimulator.staggeredLeverageDeployment({ barrierResult: VALID_BARRIER, totalDebtAmount: 0, numTranches: 4 });
  assert.equal(result.calculable, false);
  assert.equal(result.reason, "missing-debt-amount");
});

test("staggeredLeverageDeployment · menos de 2 tramos, no calculable (1 tramo es el simulador normal, sin escalonar)", () => {
  const result = LeverageSimulator.staggeredLeverageDeployment({ barrierResult: VALID_BARRIER, totalDebtAmount: 40000, numTranches: 1, trancheIntervalMonths: 3 });
  assert.equal(result.calculable, false);
  assert.equal(result.reason, "at-least-two-tranches-required");
});

test("staggeredLeverageDeployment · 4 tramos de 3 meses reparten el importe y el calendario correctamente", () => {
  const result = LeverageSimulator.staggeredLeverageDeployment({
    barrierResult: VALID_BARRIER,
    totalDebtAmount: 40000,
    numTranches: 4,
    trancheIntervalMonths: 3,
    newDebtAnnualRatePercent: 3,
    expectedReturnScenarios: SCENARIOS,
  });
  assert.equal(result.calculable, true);
  assert.equal(result.trancheAmount, 10000);
  assert.equal(result.tranches.length, 4);
  assert.deepEqual(result.tranches.map((t) => t.monthOffset), [0, 3, 6, 9]);
  assert.deepEqual(result.tranches.map((t) => t.amount), [10000, 10000, 10000, 10000]);
  assert.deepEqual(result.tranches.map((t) => t.cumulativeDeployed), [10000, 20000, 30000, 40000]);
  assert.deepEqual(result.tranches.map((t) => t.cumulativeDeployedPct), [25, 50, 75, 100]);
  assert.equal(result.fullyDeployedAtMonth, 9);
});

test("staggeredLeverageDeployment · el intervalo por defecto es 1 mes si no se declara", () => {
  const result = LeverageSimulator.staggeredLeverageDeployment({
    barrierResult: VALID_BARRIER,
    totalDebtAmount: 3000,
    numTranches: 3,
    newDebtAnnualRatePercent: 3,
    expectedReturnScenarios: SCENARIOS,
  });
  assert.equal(result.trancheIntervalMonths, 1);
  assert.deepEqual(result.tranches.map((t) => t.monthOffset), [0, 1, 2]);
});

test("staggeredLeverageDeployment · lumpSum reutiliza tal cual simulateLeverage(), sin reimplementar su aritmética", () => {
  const result = LeverageSimulator.staggeredLeverageDeployment({
    barrierResult: VALID_BARRIER,
    totalDebtAmount: 40000,
    numTranches: 4,
    trancheIntervalMonths: 3,
    newDebtAnnualRatePercent: 3,
    expectedReturnScenarios: SCENARIOS,
  });
  const directLumpSum = LeverageSimulator.simulateLeverage({
    barrierResult: VALID_BARRIER,
    newDebtAmount: 40000,
    newDebtAnnualRatePercent: 3,
    expectedReturnScenarios: SCENARIOS,
  });
  assert.deepEqual(result.lumpSum, directLumpSum);
  assert.equal(result.lumpSum.calculable, true);
});

test("staggeredLeverageDeployment · lleva el aviso profesional, igual que el resto de AP3/simulateLeverage", () => {
  const result = LeverageSimulator.staggeredLeverageDeployment({
    barrierResult: VALID_BARRIER,
    totalDebtAmount: 5000,
    numTranches: 2,
    trancheIntervalMonths: 6,
    newDebtAnnualRatePercent: 2,
    expectedReturnScenarios: SCENARIOS,
  });
  assert.equal(result.warning, LeverageSimulator.PROFESSIONAL_WARNING);
  assert.match(result.note, /no mejora ni empeora/);
});

// --- Wiring: app.js reutiliza los campos ya declarados del simulador AP3, e index.html expone la
// tarjeta con sus propios campos de tramos/intervalo, sin duplicar importe/tipo/escenarios. ---

const appSource = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const indexSource = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

test("wiring: la tarjeta LEV14 en index.html tiene sus propios campos, sin duplicar los de AP3", () => {
  ["lev14NumTranches", "lev14IntervalMonths", "lev14SimulateRun", "lev14StaggeredNote"].forEach((id) => {
    assert.match(indexSource, new RegExp(`id="${id}"`), `Falta #${id} en la tarjeta de LEV14`);
  });
});

test("wiring: handleLev14Simulate reutiliza tal cual los campos de AP3 (importe, tipo y escenarios), sin duplicarlos", () => {
  const start = appSource.indexOf("function handleLev14Simulate(");
  assert.ok(start >= 0);
  const block = appSource.slice(start, start + 900);
  assert.match(block, /renderAp3BarrierStatus\(\)/);
  assert.match(block, /qs\("ap3DebtAmount"\)/);
  assert.match(block, /qs\("ap3DebtRate"\)/);
  assert.match(block, /qs\("ap3ReturnPessimistic"\)/);
  assert.match(block, /qs\("lev14NumTranches"\)/);
  assert.match(block, /qs\("lev14IntervalMonths"\)/);
  assert.match(block, /engine\.staggeredLeverageDeployment\(/);
});

test("wiring: el botón LEV14 está enlazado a handleLev14Simulate", () => {
  assert.match(appSource, /qs\("lev14SimulateRun"\)\?\.addEventListener\("click", handleLev14Simulate\)/);
});
