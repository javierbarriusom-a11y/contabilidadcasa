const test = require("node:test");
const assert = require("node:assert/strict");

const decisions = require("../canonical-decisions.js");

const months = ["2026-07", "2026-08", "2026-09", "2026-10", "2026-11", "2026-12"]
  .map((key) => ({ key, label: key }));

test("combina pago inicial, recurrencia y financiación externa sin perder contrapartidas", () => {
  const schedule = decisions.buildSchedule({
    months,
    decisions: [{
      id: "coche",
      source: "project",
      amount: 6000,
      duration: 2,
      creditCapital: 2000,
      recurringAmount: 250,
      recurringDuration: 3,
      recurringStartOffset: 1,
      startIndex: 1,
      status: "approved",
    }],
  });

  assert.deepEqual(schedule.outflows, [0, 1000, 3250, 250, 250, 0]);
  assert.deepEqual(schedule.totals, {
    projectOutflow: 6750,
    debtOutflow: 0,
    externalIncome: 2000,
    debtRelief: 0,
    netOutflow: 4750,
  });
  assert.equal(schedule.invariants.passed, true);
});

test("una deuda pagada aplica alivio solo después de la amortización", () => {
  const schedule = decisions.buildSchedule({
    months,
    debtTargets: [{ id: "loan", currentPrincipal: 1000, currentPayment: 100, remainingInstallments: 4 }],
    decisions: [{
      id: "pay-loan",
      targetId: "loan",
      source: "debt",
      amount: 1000,
      duration: 1,
      monthlyRelief: 100,
      reliefMonths: 2,
      startIndex: 1,
      status: "approved",
    }],
  });

  assert.deepEqual(schedule.outflows, [0, 1000, -100, -100, 0, 0]);
  assert.equal(schedule.totals.debtRelief, 200);
});

test("una deuda suspendida no inventa una cuota liberada", () => {
  const schedule = decisions.buildSchedule({
    months,
    debtTargets: [{ id: "suspended", currentPrincipal: 1000, currentPayment: 0, originalPayment: 100, reunified: false }],
    decisions: [{
      id: "pay-suspended",
      targetId: "suspended",
      source: "debt",
      amount: 1000,
      monthlyRelief: 100,
      startIndex: 0,
      status: "approved",
    }],
  });

  assert.deepEqual(schedule.outflows, [1000, 0, 0, 0, 0, 0]);
  assert.equal(schedule.totals.debtRelief, 0);
});

test("retomar pagos mantiene las cuotas como gasto y nunca como ingreso", () => {
  const schedule = decisions.buildSchedule({
    months,
    debtTargets: [{ id: "resume", currentPrincipal: 2000, currentPayment: 0, originalPayment: 200 }],
    decisions: [{
      id: "resume-plan",
      targetId: "resume",
      source: "debt",
      amount: 400,
      recurringAmount: 200,
      recurringDuration: 3,
      monthlyRelief: 200,
      payoffMode: "retomar",
      startIndex: 0,
      status: "approved",
    }],
  });

  assert.deepEqual(schedule.outflows, [600, 200, 200, 0, 0, 0]);
  assert.equal(schedule.totals.debtRelief, 0);
});

test("ignora decisiones canceladas o ejecutadas", () => {
  const schedule = decisions.buildSchedule({
    months,
    decisions: [
      { id: "cancelled", amount: 500, status: "cancelled" },
      { id: "executed", amount: 900, status: "executed" },
    ],
  });
  assert.deepEqual(schedule.outflows, [0, 0, 0, 0, 0, 0]);
});

test("las decisiones simuladas o pendientes no alteran el plan", () => {
  const schedule = decisions.buildSchedule({
    months,
    decisions: [
      { id: "simulated", amount: 500, status: "simulated" },
      { id: "pending", amount: 900, status: "pending" },
    ],
  });
  assert.deepEqual(schedule.outflows, [0, 0, 0, 0, 0, 0]);
  assert.deepEqual(schedule.decisions, []);
});

test("impide programar dos veces la misma deuda", () => {
  const schedule = decisions.buildSchedule({
    months,
    decisions: [
      { id: "one", source: "debt", targetId: "same", amount: 100, status: "approved" },
      { id: "two", source: "debt", targetId: "same", amount: 200, status: "fixed" },
    ],
  });
  assert.equal(schedule.invariants.passed, false);
  assert.equal(schedule.invariants.checks.uniqueDebtTargets, false);
});

test("la paridad tolera un céntimo y bloquea diferencias materiales", () => {
  assert.equal(decisions.compareOutflows([100, 200], [100.01, 200]).matched, true);
  assert.equal(decisions.compareOutflows([100, 200], [100.03, 200]).matched, false);
});

test("el traspaso prudente protege suelo y gastos del mes siguiente", () => {
  const prudent = decisions.transferForMonth({
    checkingBeforeTransfer: 10000,
    savingsBeforeTransfer: 500,
    reserveFloor: 2200,
    nextMonthOutflows: 3000,
    protectNextMonth: true,
  });
  assert.deepEqual(prudent, {
    requiredReserve: 5200,
    transfer: 4800,
    checkingAfterTransfer: 5200,
    savingsAfterTransfer: 5300,
    shortfall: 0,
    protectedNextMonth: true,
  });

  const floorOnly = decisions.transferForMonth({
    checkingBeforeTransfer: 10000,
    reserveFloor: 2200,
    nextMonthOutflows: 3000,
    protectNextMonth: false,
  });
  assert.equal(floorOnly.transfer, 7800);
  assert.equal(floorOnly.checkingAfterTransfer, 2200);
});
