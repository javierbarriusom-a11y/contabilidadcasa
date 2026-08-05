const test = require("node:test");
const assert = require("node:assert/strict");
const E15 = require("../canonical-e15-goals.js");

const forecast = { series: [
  { monthKey: "2026-08", label: "ago 26", totals: { closingLiquidity: 1400 } },
  { monthKey: "2026-09", label: "sep 26", totals: { closingLiquidity: 1600 } },
] };

test("E15 normaliza objetivos con prioridad, flexibilidad y fuente", () => {
  const goal = E15.normalizeGoal({ id: "car", name: "Coche", target: 6000, saved: 1000, targetDate: "2026-12-01", priority: "high", flexibility: "fixed", fundingSource: "income" });
  assert.equal(goal.remaining, 5000);
  assert.equal(goal.priority, "high");
  assert.equal(goal.flexibility, "fixed");
  assert.equal(goal.fundingSource, "income");
});

test("E15 propone aportaciones sin consumir la reserva ni aplicar cambios", () => {
  const plan = E15.contributionPlan({ startMonth: "2026-08", monthlyCapacity: 300, reserve: 1000, goals: [
    { id: "fixed", name: "Matrícula", target: 600, targetDate: "2026-09", priority: "high", flexibility: "fixed" },
    { id: "trip", name: "Viaje", target: 600, targetDate: "2026-09", priority: "low", flexibility: "flexible" },
  ] });
  assert.equal(plan.readOnly, true);
  assert.equal(plan.confirmRequired, true);
  assert.equal(plan.plans[0].proposedMonthly, 300);
  assert.equal(plan.plans[1].proposedMonthly, 0);
  assert.equal(E15.detectConflicts(plan).conflicts.length, 1);
});

test("E15 reúne forecast, deuda, objetivos y revisión en un calendario temporal", () => {
  const calendar = E15.financialCalendar({ forecast, debts: [{ currentPayment: 125 }], goals: [{ id: "g", name: "Coche", target: 500, targetDate: "2026-09" }], reviews: [{ monthKey: "2026-08" }] });
  assert.equal(calendar.rows.length, 2);
  assert.equal(calendar.rows[0].events.some((event) => event.type === "debt"), true);
  assert.equal(calendar.rows[1].events.some((event) => event.type === "goal"), true);
});

test("E15 revisa desviaciones sin cambiar el forecast ni preparar escritura automática", () => {
  const review = E15.monthlyReview({ monthKey: "2026-08", planned: [{ id: "food", amount: 300 }], actuals: [{ id: "food", label: "Comida", amount: 340 }] });
  assert.equal(review.readOnly, true);
  assert.equal(review.confirmRequired, true);
  assert.equal(review.changes[0].delta, 40);
});
