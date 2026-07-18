const test = require("node:test");
const assert = require("node:assert/strict");

const engine = require("../canonical-engine.js");

function inputFixture(overrides = {}) {
  return {
    openingBalances: { checking: 1000, savings: 500 },
    policy: {
      incomeFactor: 1,
      annualIncomeGrowth: 0,
      expenseFactor: 1,
      annualInflation: 0,
      plannedMonthlySaving: 200,
      autoCapSavings: true,
    },
    months: [
      {
        month: "ene 27",
        monthKey: "2027-01",
        income: 2000,
        coreSpend: 1100,
        variableOperationalSpend: 300,
        car: 100,
        refi: 50,
        projectOutflow: 100,
      },
      {
        month: "feb 27",
        monthKey: "2027-02",
        income: 2000,
        coreSpend: 800,
        variableOperationalSpend: 200,
        car: 0,
        refi: 0,
        projectOutflow: 0,
      },
    ],
    ...overrides,
  };
}

test("el motor calcula saldos mensuales deterministas y conserva las cuentas", () => {
  const rows = engine.buildRows(inputFixture());

  assert.equal(rows.length, 2);
  assert.equal(rows[0].outflowsBeforeSaving, 1350);
  assert.equal(rows[0].saving, 200);
  assert.equal(rows[0].checking, 1450);
  assert.equal(rows[0].savings, 700);
  assert.equal(rows[0].totalLiquidity, 2150);
  assert.equal(rows[0].netBeforeSaving, 650);

  assert.equal(rows[1].startChecking, 1450);
  assert.equal(rows[1].startLiquidity, 2150);
  assert.equal(rows[1].checking, 2450);
  assert.equal(rows[1].savings, 900);
  assert.equal(rows[1].totalLiquidity, 3350);
  assert.equal(engine.validateRows(rows).valid, true);
});

test("el ahorro automático se reduce a cero cuando falta caja", () => {
  const rows = engine.buildRows(inputFixture({
    openingBalances: { checking: 1000, savings: 0 },
    policy: {
      incomeFactor: 1,
      annualIncomeGrowth: 0,
      expenseFactor: 1,
      annualInflation: 0,
      plannedMonthlySaving: 300,
      autoCapSavings: true,
    },
    months: [{ monthKey: "2027-01", income: 500, coreSpend: 1000 }],
  }));

  assert.equal(rows[0].saving, 0);
  assert.equal(rows[0].checking, 500);
  assert.equal(rows[0].totalLiquidity, 500);
});

test("las invariantes detectan saldos manipulados y discontinuidad", () => {
  const rows = engine.buildRows(inputFixture()).map((row) => ({ ...row }));
  rows[0].totalLiquidity += 10;
  rows[1].startChecking += 5;

  const validation = engine.validateRows(rows);

  assert.equal(validation.valid, false);
  assert.equal(validation.checks.accountConservation, false);
  assert.equal(validation.checks.liquidityConservation, false);
  assert.equal(validation.checks.continuity, false);
});

test("la paridad acepta diferencias de redondeo y rechaza cambios materiales", () => {
  const canonical = engine.buildRows(inputFixture());
  const withinTolerance = canonical.map((row) => ({ ...row, checking: row.checking + 0.01 }));
  const outsideTolerance = canonical.map((row) => ({ ...row }));
  outsideTolerance[1].checking += 0.03;

  assert.equal(engine.compareRows(canonical, canonical).matched, true);
  assert.equal(engine.compareRows(canonical, withinTolerance).matched, true);
  assert.equal(engine.compareRows(canonical, outsideTolerance).matched, false);
  assert.equal(engine.compareRows(canonical, outsideTolerance).differences[0].field, "checking");
});

test("la auditoría solo registra cambios financieros reales", () => {
  const first = engine.buildSnapshot(inputFixture(), null, {
    reason: "initial",
    generatedAt: "2026-07-13T10:00:00.000Z",
  });
  const same = engine.buildSnapshot(inputFixture(), first, {
    reason: "recheck",
    generatedAt: "2026-07-13T11:00:00.000Z",
  });
  const changedInput = inputFixture();
  changedInput.months[0].income = 2100;
  const changed = engine.buildSnapshot(changedInput, same, {
    reason: "income-change",
    generatedAt: "2026-07-13T12:00:00.000Z",
  });

  assert.equal(first.auditTrail.length, 1);
  assert.equal(same.fingerprint, first.fingerprint);
  assert.equal(same.auditTrail.length, 1);
  assert.notEqual(changed.fingerprint, first.fingerprint);
  assert.equal(changed.auditTrail.length, 2);
  assert.equal(changed.auditTrail[1].reason, "income-change");
});

test("el resumen anual usa cierres de cuenta y suma los flujos", () => {
  const snapshot = engine.buildSnapshot(inputFixture());
  const summary = snapshot.annualSummary[0];

  assert.equal(summary.year, "2027");
  assert.equal(summary.income, 4000);
  assert.equal(summary.outflows, 2150);
  assert.equal(summary.saving, 400);
  assert.equal(summary.closingChecking, 2450);
  assert.equal(summary.closingSavings, 900);
  assert.equal(summary.closingLiquidity, 3350);
});

test("el escenario canónico expone filas, resumen e invariantes desde la misma instantánea", () => {
  const scenario = engine.buildScenario(inputFixture(), null, {
    reason: "scenario-test",
    generatedAt: "2026-07-18T10:00:00.000Z",
  });

  assert.equal(scenario.source, "canonical-engine");
  assert.strictEqual(scenario.rows, scenario.snapshot.rows);
  assert.deepEqual(scenario.annualSummary, scenario.snapshot.annualSummary);
  assert.equal(scenario.invariants.valid, true);
});
