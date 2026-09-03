const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const Sustainability = require("../canonical-leverage-sustainability.js");

// AP6 · Bloque 10: alerta cuando el líquido ya no sostiene la deuda de apalancamiento tomada.
// Depende de AP3 (canonical-leverage-simulator.js) — la única deuda de apalancamiento que existe en
// la app es la que el hogar exploró y guardó allí. AP3 nunca guarda una posición real, así que este
// motor solo vigila los escenarios explícitamente marcados como tomados (`takenAt`).

test("expone FinanceCanonicalLeverageSustainability al cargarse directamente en navegador", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "canonical-leverage-sustainability.js"), "utf8");
  const context = { globalThis: {} };
  vm.runInNewContext(source, context, { filename: "canonical-leverage-sustainability.js" });
  assert.equal(typeof context.globalThis.FinanceCanonicalLeverageSustainability?.evaluateLeverageSustainability, "function");
});

function exploredScenario({ id = "ap3-1", annualDebtCost = 1200, takenAt = null } = {}) {
  return {
    id,
    name: `Escenario ${id}`,
    createdAt: "2026-09-01T00:00:00.000Z",
    takenAt,
    result: { newDebtAmount: 20000, annualDebtCost },
  };
}

test("sin ningún escenario guardado, no hay nada que alertar: sin-deuda-tomada", () => {
  const result = Sustainability.evaluateLeverageSustainability({ cushion: { value: 6000, floor: 4000 }, scenarios: [] });
  assert.equal(result.status, "sin-deuda-tomada");
  assert.equal(result.hasTakenDebt, false);
});

test("con escenarios guardados pero ninguno marcado como tomado, sigue en sin-deuda-tomada", () => {
  const result = Sustainability.evaluateLeverageSustainability({
    cushion: { value: 6000, floor: 4000 },
    scenarios: [exploredScenario({ takenAt: null })],
  });
  assert.equal(result.status, "sin-deuda-tomada");
});

test("con deuda tomada pero sin colchón calculable, colchon-sin-calcular — nunca inventa una lectura", () => {
  const result = Sustainability.evaluateLeverageSustainability({
    cushion: {},
    scenarios: [exploredScenario({ takenAt: "2026-09-02T00:00:00.000Z" })],
  });
  assert.equal(result.status, "colchon-sin-calcular");
  assert.equal(result.hasTakenDebt, true);
  assert.equal(result.takenCount, 1);
});

test("colchón muy por encima del suelo con deuda tomada: sostenible", () => {
  const result = Sustainability.evaluateLeverageSustainability({
    cushion: { value: 10000, floor: 4000 },
    scenarios: [exploredScenario({ takenAt: "2026-09-02T00:00:00.000Z", annualDebtCost: 1200 })],
  });
  assert.equal(result.status, "sostenible");
  assert.equal(result.cushionValue, 10000);
  assert.equal(result.cushionFloor, 4000);
  assert.equal(result.monthlyDebtService, 100);
  assert.equal(result.takenCount, 1);
});

test("colchón por encima del suelo pero dentro del margen del 20%: ajustado (aviso temprano)", () => {
  const result = Sustainability.evaluateLeverageSustainability({
    cushion: { value: 4400, floor: 4000 },
    scenarios: [exploredScenario({ takenAt: "2026-09-02T00:00:00.000Z" })],
  });
  assert.equal(result.status, "ajustado");
});

test("colchón por debajo del suelo con deuda tomada: insostenible, con el hueco exacto", () => {
  const result = Sustainability.evaluateLeverageSustainability({
    cushion: { value: 3000, floor: 4000 },
    scenarios: [exploredScenario({ takenAt: "2026-09-02T00:00:00.000Z" })],
  });
  assert.equal(result.status, "insostenible");
  assert.equal(result.shortfall, 1000);
});

test("suma la cuota mensual de todas las deudas tomadas, ignorando las solo exploradas", () => {
  const result = Sustainability.evaluateLeverageSustainability({
    cushion: { value: 10000, floor: 4000 },
    scenarios: [
      exploredScenario({ id: "ap3-1", takenAt: "2026-09-02T00:00:00.000Z", annualDebtCost: 1200 }),
      exploredScenario({ id: "ap3-2", takenAt: "2026-09-03T00:00:00.000Z", annualDebtCost: 600 }),
      exploredScenario({ id: "ap3-3", takenAt: null, annualDebtCost: 999999 }),
    ],
  });
  assert.equal(result.takenCount, 2);
  assert.equal(result.monthlyDebtService, 150);
  assert.equal(result.takenScenarios.length, 2);
});

test("takenScenariosOf filtra exactamente por la presencia de takenAt", () => {
  const scenarios = [exploredScenario({ id: "a", takenAt: null }), exploredScenario({ id: "b", takenAt: "2026-09-01T00:00:00.000Z" })];
  const taken = Sustainability.takenScenariosOf(scenarios);
  assert.equal(taken.length, 1);
  assert.equal(taken[0].id, "b");
});
