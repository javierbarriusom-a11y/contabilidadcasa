const test = require("node:test");
const assert = require("node:assert/strict");

const engine = require("../canonical-engine.js");
const forecastContract = require("../canonical-forecast.js");
const scenarios = require("../canonical-e13-scenarios.js");
const Assets = require("../canonical-assets.js");

// A14-5 (BACKLOG_ULTIMATE_SEPTIEMBRE.md bloque 8, depende de A14-1): "un evento simulado puede
// afectar también a activos («caída de mercado del 20%», «revalorización del inmueble»), reutilizando
// canonical-e13-scenarios.js sin motor nuevo". Los eventos de patrimonio no tocan la caja proyectada
// (a diferencia de los cinco eventos ya existentes) y no dependen del perfil (Base/Favorable/Tensión):
// solo cambian el valor de los activos declarados (A14-1) cuyo tipo coincide con el evento.

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

function assetsFixture() {
  return Assets.normalizeAssets([
    { id: "a1", type: "inversion", label: "Fondo indexado", value: 10000, provenance: "declared" },
    { id: "a2", type: "inmueble", label: "Vivienda habitual", value: 200000, provenance: "declared" },
    { id: "a3", type: "cuenta", label: "Cuenta corriente", value: 2000, provenance: "declared" },
  ]).assets;
}

test("una caída de mercado del 20% no toca la caja proyectada (a diferencia de un gasto)", () => {
  const forecast = fixture();
  const withoutEvent = scenarios.buildLab(forecast, []);
  const withCrash = scenarios.buildLab(forecast, [{ id: "crash", type: "market-crash", monthKey: "2026-08", amount: 20 }]);
  const base1 = withoutEvent.scenarios.find((item) => item.id === "base");
  const base2 = withCrash.scenarios.find((item) => item.id === "base");
  assert.deepEqual(base2.rows.map((row) => row.closingChecking), base1.rows.map((row) => row.closingChecking));
  assert.equal(base2.metrics.debtImpact, 0);
});

test("assetImpact: sin activos o sin eventos de patrimonio, no hay nada que comparar (null, no un 0 inventado)", () => {
  const forecast = fixture();
  assert.equal(scenarios.buildLab(forecast, []).assetImpact, null, "sin eventos");
  assert.equal(scenarios.buildLab(forecast, [], { assets: [] }).assetImpact, null, "sin activos");
  assert.equal(
    scenarios.buildLab(forecast, [{ id: "expense", type: "expense", monthKey: "2026-08", amount: 100 }], { assets: assetsFixture() }).assetImpact,
    null,
    "eventos que no son de patrimonio",
  );
});

test("assetImpact: una caída de mercado del 20% solo afecta a los activos de tipo inversión", () => {
  const forecast = fixture();
  const lab = scenarios.buildLab(forecast, [{ id: "crash", type: "market-crash", monthKey: "2026-08", amount: 20 }], { assets: assetsFixture() });
  assert.equal(lab.assetImpact.netWorthBefore, 212000);
  assert.equal(lab.assetImpact.netWorthAfter, 210000);
  assert.equal(lab.assetImpact.delta, -2000);
  assert.equal(lab.assetImpact.shocks.length, 1);
  assert.equal(lab.assetImpact.shocks[0].targetType, "inversion");
});

test("assetImpact: una revalorización del inmueble suma, no resta", () => {
  const forecast = fixture();
  const lab = scenarios.buildLab(forecast, [{ id: "reval", type: "property-revaluation", monthKey: "2026-08", amount: 10 }], { assets: assetsFixture() });
  assert.equal(lab.assetImpact.netWorthAfter, 232000);
  assert.equal(lab.assetImpact.delta, 20000);
});

test("assetImpact: dos caídas de mercado del mismo tipo se componen, no se suman", () => {
  const forecast = fixture();
  const lab = scenarios.buildLab(forecast, [
    { id: "crash1", type: "market-crash", monthKey: "2026-08", amount: 20 },
    { id: "crash2", type: "market-crash", monthKey: "2026-09", amount: 20 },
  ], { assets: assetsFixture() });
  // 10000 * 0.8 * 0.8 = 6400 (una caída del 36%, no del 40%)
  assert.equal(lab.assetImpact.netWorthAfter, 200000 + 6400 + 2000);
});

test("assetImpact: el valor de un activo nunca baja de cero aunque la caída supere el 100%", () => {
  const forecast = fixture();
  const lab = scenarios.buildLab(forecast, [{ id: "crash", type: "market-crash", monthKey: "2026-08", amount: 150 }], { assets: assetsFixture() });
  assert.equal(lab.assetImpact.netWorthAfter, 200000 + 0 + 2000);
});

test("assetImpact: eventos de caja (gasto, coche, deuda...) nunca entran en el cálculo de patrimonio", () => {
  const forecast = fixture();
  const lab = scenarios.buildLab(forecast, [
    { id: "expense", type: "expense", monthKey: "2026-08", amount: 500 },
    { id: "crash", type: "market-crash", monthKey: "2026-08", amount: 20 },
  ], { assets: assetsFixture() });
  assert.equal(lab.assetImpact.shocks.length, 1, "el gasto no cuenta como shock de patrimonio");
});

test("backward compatibility: buildLab sin metadata.assets se comporta exactamente igual que antes de A14-5", () => {
  const forecast = fixture();
  const lab = scenarios.buildLab(forecast, [{ id: "expense", type: "expense", monthKey: "2026-08", amount: 500 }]);
  assert.equal(lab.assetImpact, null);
  assert.ok(Array.isArray(lab.scenarios));
});

test("EVENT_TYPES y ASSET_SHOCK_TARGET_TYPE exponen los dos nuevos tipos de A14-5", () => {
  assert.ok(scenarios.EVENT_TYPES.includes("market-crash"));
  assert.ok(scenarios.EVENT_TYPES.includes("property-revaluation"));
  assert.deepEqual(scenarios.ASSET_SHOCK_TARGET_TYPE, { "market-crash": "inversion", "property-revaluation": "inmueble" });
});
