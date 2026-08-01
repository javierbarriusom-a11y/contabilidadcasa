const test = require("node:test");
const assert = require("node:assert/strict");

const dailyEngine = require("../canonical-daily-engine.js");

function auditedInput(overrides = {}) {
  return {
    openingBalances: { checking: 1000, savings: 500 },
    policy: { operatingReserve: 800 },
    months: [{
      monthKey: "2026-07",
      label: "jul 26",
      mainPayrollDate: "2026-07-31",
      expected: {
        income: 1000,
        outflowsBeforeSaving: 450,
        saving: 550,
        closingChecking: 1000,
        closingSavings: 1050,
        closingLiquidity: 2050,
      },
    }],
    events: [
      { id: "income", date: "2026-07-01", kind: "income", accountId: "checking", field: "income", label: "Ingreso", amount: 1000, confidence: "observed" },
      { id: "fixed", date: "2026-07-03", kind: "outflow", accountId: "checking", field: "fixedCoreSpend", label: "Fijo", amount: 100, confidence: "rule" },
      { id: "variable", date: "2026-07-04", kind: "outflow", accountId: "checking", field: "variableOperationalSpend", label: "Variable", amount: 50, confidence: "estimated" },
      { id: "car", date: "2026-07-05", kind: "outflow", accountId: "checking", field: "car", label: "Coche", amount: 100, confidence: "rule" },
      { id: "refi", date: "2026-07-06", kind: "outflow", accountId: "checking", field: "refi", label: "Refinanciacion", amount: 100, confidence: "rule" },
      { id: "project", date: "2026-07-07", kind: "outflow", accountId: "checking", field: "projectOutflow", label: "Proyecto", amount: 100, confidence: "rule" },
      { id: "saving", date: "2026-07-31", kind: "transfer", fromAccountId: "checking", toAccountId: "savings", field: "saving", label: "Ahorro", amount: 550, confidence: "rule", role: "main-payroll" },
    ],
    ...overrides,
  };
}

test("el calendario diario cuadra con el flujo mensual canonico", () => {
  const snapshot = dailyEngine.buildSnapshot(auditedInput());
  assert.equal(snapshot.schema, dailyEngine.SCHEMA_ID);
  assert.equal(snapshot.invariants.valid, true);
  assert.equal(snapshot.monthly.length, 1);
  assert.equal(snapshot.monthly[0].matched, true);
  assert.equal(snapshot.monthly[0].closingChecking, 1000);
  assert.equal(snapshot.monthly[0].closingSavings, 1050);
});

test("un traspaso conserva la liquidez total", () => {
  const snapshot = dailyEngine.buildSnapshot(auditedInput({
    months: [{
      monthKey: "2026-07",
      expected: { income: 0, outflowsBeforeSaving: 0, saving: 200, closingChecking: 800, closingSavings: 700, closingLiquidity: 1500 },
    }],
    events: [{ id: "transfer", date: "2026-07-01", kind: "transfer", fromAccountId: "checking", toAccountId: "savings", field: "saving", label: "Traspaso", amount: 200 }],
  }));
  assert.equal(snapshot.invariants.checks.transferConservation, true);
  assert.equal(snapshot.rows.at(-1).total, 1500);
  assert.equal(snapshot.monthly[0].matched, true);
});

test("la auditoria marca una paridad mensual incorrecta", () => {
  const input = auditedInput();
  input.months[0].expected.closingLiquidity = 2049;
  const snapshot = dailyEngine.buildSnapshot(input);
  assert.equal(snapshot.invariants.checks.monthlyParity, false);
  assert.equal(snapshot.invariants.valid, false);
  assert.ok(snapshot.invariants.issues.some((issue) => issue.type === "monthly-parity"));
});

test("aprende la cobertura hasta el siguiente ingreso solo de movimientos conciliados", () => {
  const movements = [
    { date: "2026-05-25", amount: 2000, reconciled: true, kind: "income" },
    { date: "2026-06-25", amount: 2100, reconciled: true, kind: "income" },
    { date: "2026-07-25", amount: 2050, reconciled: true, kind: "income" },
    { date: "2026-07-10", amount: -300, reconciled: true, kind: "outflow" },
    { date: "2026-07-11", amount: -9999, reconciled: false, kind: "outflow" },
  ];
  const learned = dailyEngine.learnCashflowPatterns(movements);
  assert.equal(learned.typicalIncomeDay, 25);
  assert.equal(learned.incomeCount, 3);
  assert.equal(learned.reconciledMovementCount, 4);
  assert.equal(learned.confidence, "rule");

  const coverage = dailyEngine.coverageUntilNextIncome({
    asOfDate: "2026-08-20",
    checkingBalance: 500,
    movements,
    override: { dailyOutflow: 50 },
  });
  assert.equal(coverage.nextIncomeDate, "2026-08-25");
  assert.equal(coverage.days, 5);
  assert.equal(coverage.required, 250);
  assert.equal(coverage.covered, true);
  assert.equal(coverage.editable, true);
});

test("una fecha manual prevalece y queda identificada como ajuste", () => {
  const coverage = dailyEngine.coverageUntilNextIncome({
    asOfDate: "2026-08-20",
    checkingBalance: 100,
    override: { nextIncomeDate: "2026-08-24", dailyOutflow: 40 },
  });
  assert.equal(coverage.source, "manual-override");
  assert.equal(coverage.confidence, "observed");
  assert.equal(coverage.margin, -60);
});
