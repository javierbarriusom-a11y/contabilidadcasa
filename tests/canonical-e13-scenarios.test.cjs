const test = require("node:test");
const assert = require("node:assert/strict");

const engine = require("../canonical-engine.js");
const forecastContract = require("../canonical-forecast.js");
const scenarios = require("../canonical-e13-scenarios.js");

function fixture() {
  const input = {
    openingBalances: { checking: 2000, savings: 1000 },
    policy: { incomeFactor: 1, annualIncomeGrowth: 0, expenseFactor: 1, annualInflation: 0, plannedMonthlySaving: 200, autoCapSavings: true },
    months: [
      { month: "ago 26", monthKey: "2026-08", income: 2500, coreSpend: 1600, car: 100, refi: 200 },
      { month: "sep 26", monthKey: "2026-09", income: 2500, coreSpend: 1600, car: 100, refi: 200 },
      { month: "oct 26", monthKey: "2026-10", income: 2500, coreSpend: 1600, car: 100, refi: 200 },
    ],
  };
  const engineScenario = engine.buildScenario(input, null, { generatedAt: "2026-08-02T10:00:00.000Z" });
  return forecastContract.buildForecast(input, engineScenario, {}, { generatedAt: "2026-08-02T10:00:00.000Z" });
}

test("E13a construye base, favorable y tensión desde el forecast canónico", () => {
  const forecast = fixture();
  const lab = scenarios.buildLab(forecast, [], { generatedAt: "2026-08-02T11:00:00.000Z" });

  assert.equal(lab.schemaId, scenarios.SCHEMA_ID);
  assert.deepEqual(lab.scenarios.map((item) => item.id), ["base", "favorable", "stress"]);
  assert.deepEqual(lab.scenarios[0].rows.map((row) => row.closingLiquidity), forecast.series.map((month) => month.totals.closingLiquidity));
  assert.equal(lab.readOnly, true);
  assert.equal(lab.writesPlan, false);
});

test("los eventos afectan solo a la copia simulada y comparan deuda y recuperación", () => {
  const forecast = fixture();
  const before = JSON.stringify(forecast);
  const lab = scenarios.buildLab(forecast, [
    { id: "loss", type: "income-loss", monthKey: "2026-08", amount: 3000, duration: 2 },
    { id: "debt", type: "debt", monthKey: "2026-09", amount: 400, duration: 1 },
  ]);
  const base = lab.scenarios.find((item) => item.id === "base");

  assert.equal(JSON.stringify(forecast), before);
  assert.equal(base.metrics.debtImpact, 400);
  assert.equal(base.metrics.negativeMonths > 0, true);
  assert.ok(base.metrics.recoveryMonth);
  assert.equal(base.rows[0].eventIncome, -3000);
  assert.equal(base.rows[1].debtImpact, 400);
});

test("E13a rechaza fuentes que no sean un forecast válido", () => {
  assert.throws(() => scenarios.buildLab({ schemaId: "otro", valid: true }), /forecast canónico válido/);
  assert.throws(() => scenarios.buildLab({ schemaId: "finance-canonical-forecast\/v1", valid: false }), /forecast canónico válido/);
});
