const test = require("node:test");
const assert = require("node:assert/strict");

const invariants = require("../canonical-scenario-invariants.js");
const legacy = require("../legacy-debt-roadmap-engine.js");
const engine = require("../canonical-engine.js");
const { mulberry32, rangeFactory, intRangeFactory } = require("./golden/prng.cjs");

const TRIALS = 40;

function randomAccountConfig(rng) {
  const range = rangeFactory(rng);
  const intRange = intRangeFactory(rng);
  return {
    amount: Math.round(range(1000, 15000)),
    apr: Math.round(range(0, 20) * 10) / 10,
    term: intRange(6, 84),
  };
}

function randomHouseholdMonths(rng, horizonMeses) {
  const range = rangeFactory(rng);
  const income = range(2000, 7000);
  const coreSpend = range(1200, income * 0.7);
  const variableOperationalSpend = range(300, 1200);
  const months = [];
  for (let index = 0; index < horizonMeses; index += 1) {
    months.push({
      month: `mes ${index + 1}`,
      monthKey: `2026-${String((index % 12) + 1).padStart(2, "0")}`,
      income: Math.round(income * 100) / 100,
      coreSpend: Math.round(coreSpend * 100) / 100,
      variableOperationalSpend: Math.round(variableOperationalSpend * 100) / 100,
      car: 0,
      refi: Math.round(range(0, 300) * 100) / 100,
    });
  }
  return months;
}

test("T-META · el catálogo declara las 15 invariantes y ninguna verificable hoy queda sin marcar", () => {
  assert.equal(invariants.INVARIANTS.length, 15);
  const ids = invariants.INVARIANTS.map((item) => item.id);
  for (let index = 1; index <= 15; index += 1) {
    assert.ok(ids.includes(`I-${String(index).padStart(2, "0")}`), `Falta I-${index} en el catálogo`);
  }
  const verificablesHoy = invariants.INVARIANTS.filter((item) => item.verificableHoy).map((item) => item.id);
  assert.deepEqual(verificablesHoy.sort(), ["I-01", "I-02", "I-03", "I-04", "I-07", "I-08"]);
});

test("I-01 · determinismo — legacy-debt-roadmap-engine.simulate(config) es idéntico en dos ejecuciones", () => {
  const rng = mulberry32(101);
  for (let trial = 0; trial < TRIALS; trial += 1) {
    const account = randomAccountConfig(rng);
    const config = { baseMonth: "2026-08", months: account.term + 2, capacity: 1000, accounts: [{ amount: account.amount, strategy: "refi", discount: 0, start: 1, apr: account.apr, term: account.term, financePct: 100 }] };
    const runA = legacy.simulate(config);
    const runB = legacy.simulate(config);
    const result = invariants.checkDeterminism(runA, runB);
    assert.equal(result.valid, true, `trial ${trial}: ${JSON.stringify(result.differences)}`);
  }
});

test("I-01 · determinismo — canonical-engine.buildScenario(input) es idéntico en dos ejecuciones", () => {
  const rng = mulberry32(102);
  for (let trial = 0; trial < TRIALS; trial += 1) {
    const input = {
      openingBalances: { checking: Math.round(rangeFactory(rng)(1000, 8000)), savings: Math.round(rangeFactory(rng)(0, 15000)) },
      policy: { incomeFactor: 1, annualIncomeGrowth: 0, expenseFactor: 1, annualInflation: 0, plannedMonthlySaving: 200, autoCapSavings: true },
      months: randomHouseholdMonths(rng, 12),
    };
    const runA = engine.buildScenario(input, null, { generatedAt: "2026-08-08T00:00:00.000Z" });
    const runB = engine.buildScenario(input, null, { generatedAt: "2026-08-08T00:00:00.000Z" });
    const result = invariants.checkDeterminism(runA.rows, runB.rows);
    assert.equal(result.valid, true, `trial ${trial}: ${JSON.stringify(result.differences)}`);
  }
});

test("I-02/I-03 · conservación de caja y cierre de cuentas con 40 hogares generados aleatoriamente", () => {
  const rng = mulberry32(203);
  for (let trial = 0; trial < TRIALS; trial += 1) {
    const horizonte = intRangeFactory(rng)(6, 36);
    const input = {
      openingBalances: { checking: Math.round(rangeFactory(rng)(500, 9000)), savings: Math.round(rangeFactory(rng)(0, 20000)) },
      policy: {
        incomeFactor: 1,
        annualIncomeGrowth: Math.round(rangeFactory(rng)(-2, 4) * 10) / 10,
        expenseFactor: 1,
        annualInflation: Math.round(rangeFactory(rng)(0, 5) * 10) / 10,
        plannedMonthlySaving: Math.round(rangeFactory(rng)(0, 600)),
        autoCapSavings: true,
      },
      months: randomHouseholdMonths(rng, horizonte),
    };
    const scenario = engine.buildScenario(input, null, { generatedAt: "2026-08-08T00:00:00.000Z" });
    assert.equal(scenario.invariants.valid, true, `trial ${trial}: ${JSON.stringify(scenario.invariants.issues)}`);
    assert.equal(scenario.invariants.checks.accountConservation, true, `trial ${trial}: I-03 rota`);
    assert.equal(scenario.invariants.checks.liquidityConservation, true, `trial ${trial}: I-02 rota`);
  }
});

test("I-04 · capital acotado — el saldo financiado nunca es negativo ni se amortiza más capital del financiado", () => {
  const rng = mulberry32(404);
  for (let trial = 0; trial < TRIALS; trial += 1) {
    const account = randomAccountConfig(rng);
    const config = { baseMonth: "2026-08", months: account.term + 2, capacity: 1000, accounts: [{ amount: account.amount, strategy: "refi", discount: 0, start: 1, apr: account.apr, term: account.term, financePct: 100 }] };
    const result = legacy.simulate(config);
    const check = invariants.checkBoundedPrincipal(result, 0, account.amount);
    assert.equal(check.valid, true, `trial ${trial} (${JSON.stringify(account)}): ${JSON.stringify(check.issues)}`);
  }
});

test("I-07 · monotonía de amortización — amortizar más nunca encarece el coste total ni retrasa el fin de la deuda", () => {
  const rng = mulberry32(707);
  const range = rangeFactory(rng);
  for (let trial = 0; trial < TRIALS; trial += 1) {
    const account = randomAccountConfig(rng);
    const term = Math.max(12, account.term);
    const lumpBase = Math.round(range(0, account.amount * 0.4));
    const lumpExtra = Math.round(lumpBase + range(100, account.amount * 0.3));
    const build = (lump) => ({
      baseMonth: "2026-08", months: term + 2, capacity: 1000,
      accounts: [{ amount: account.amount, strategy: "hybrid", discount: 0, start: 1, lump: Math.min(lump, account.amount), apr: account.apr, term, financePct: 100 }],
    });
    const baseResult = legacy.simulate(build(lumpBase));
    const higherResult = legacy.simulate(build(lumpExtra));
    const check = invariants.checkAmortizationMonotonicity(baseResult, higherResult);
    assert.equal(check.valid, true, `trial ${trial} (${JSON.stringify(account)}, lump ${lumpBase}->${lumpExtra}): ${JSON.stringify(check.issues)}`);
  }
});

test("I-08 · monotonía de tipo — subir el TIN nunca reduce el coste financiero total", () => {
  const rng = mulberry32(808);
  const range = rangeFactory(rng);
  for (let trial = 0; trial < TRIALS; trial += 1) {
    const account = randomAccountConfig(rng);
    const deltaPuntosBase = range(0.1, 5);
    const build = (apr) => ({
      baseMonth: "2026-08", months: account.term + 2, capacity: 1000,
      accounts: [{ amount: account.amount, strategy: "refi", discount: 0, start: 1, apr, term: account.term, financePct: 100 }],
    });
    const baseResult = legacy.simulate(build(account.apr));
    const higherResult = legacy.simulate(build(account.apr + deltaPuntosBase));
    const check = invariants.checkRateMonotonicity(baseResult, higherResult);
    assert.equal(check.valid, true, `trial ${trial} (${JSON.stringify(account)}, +${deltaPuntosBase.toFixed(2)}pp): ${JSON.stringify(check.issues)}`);
  }
});

test("presupuesto de rendimiento · canonical-engine.buildScenario con 120 meses bajo 150 ms (umbral del futuro motor de Escenario, doc §6)", () => {
  const rng = mulberry32(999);
  const input = {
    openingBalances: { checking: 4000, savings: 9000 },
    policy: { incomeFactor: 1, annualIncomeGrowth: 1.5, expenseFactor: 1, annualInflation: 2.5, plannedMonthlySaving: 300, autoCapSavings: true },
    months: randomHouseholdMonths(rng, 120),
  };
  const start = process.hrtime.bigint();
  const scenario = engine.buildScenario(input, null, { generatedAt: "2026-08-08T00:00:00.000Z" });
  const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;
  assert.equal(scenario.invariants.valid, true);
  assert.ok(elapsedMs < 150, `buildScenario tardó ${elapsedMs.toFixed(2)} ms, por encima del umbral de 150 ms`);
});

test.todo("I-05 · neutralidad de inactivas — pendiente del motor de Escenario (E20-0): no existe hoy el concepto de decisión activa/inactiva ejecutable");
test.todo("I-06 · conmutatividad de independientes — pendiente del motor de Escenario (E20-0): no existe hoy una resolución ordenada de decisiones");
test.todo("I-09 · escenario vacío ≡ base — pendiente del motor de Escenario (E20-0): no existe hoy un `motor(Escenario)` que comparar contra el Plan canónico");
