(function attachCanonicalE15(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalE15 = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function canonicalE15Factory() {
  "use strict";

  const SCHEMA_ID = "finance-e15-goals/v1";
  const number = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
  const round2 = (value) => Math.round((number(value) + Number.EPSILON) * 100) / 100;
  const text = (value) => String(value ?? "").trim();
  const monthKey = (value) => (text(value).match(/^\d{4}-\d{2}/) || [])[0] || "";
  const priorityWeight = { critical: 4, high: 3, medium: 2, low: 1 };

  function normalizeGoal(raw = {}) {
    const target = Math.max(0, round2(raw.target));
    const saved = Math.max(0, round2(raw.saved ?? (raw.contributions || []).reduce((sum, item) => sum + number(item.amount), 0)));
    const priority = Object.hasOwn(priorityWeight, raw.priority) ? raw.priority : "medium";
    return {
      id: text(raw.id) || `goal-${Date.now()}`,
      name: text(raw.name) || "Nuevo objetivo",
      target,
      saved,
      remaining: round2(Math.max(0, target - saved)),
      targetDate: text(raw.targetDate),
      owner: ["household", "javi", "tere"].includes(raw.owner) ? raw.owner : "household",
      priority,
      flexibility: ["fixed", "flexible"].includes(raw.flexibility) ? raw.flexibility : "flexible",
      fundingSource: ["savings", "income", "debt", "other"].includes(raw.fundingSource) ? raw.fundingSource : "savings",
      status: ["active", "paused", "completed", "cancelled"].includes(raw.status) ? raw.status : "active",
    };
  }

  function monthsUntil(targetDate, startMonth) {
    const target = monthKey(targetDate);
    const start = monthKey(startMonth);
    if (!target || !start) return 0;
    const [ty, tm] = target.split("-").map(Number);
    const [sy, sm] = start.split("-").map(Number);
    return Math.max(0, (ty - sy) * 12 + tm - sm + 1);
  }

  function contributionPlan(input = {}) {
    const goals = (input.goals || []).map(normalizeGoal).filter((goal) => goal.status === "active" && goal.remaining > 0);
    const startMonth = monthKey(input.startMonth || input.forecast?.series?.[0]?.monthKey);
    const capacity = Math.max(0, round2(input.monthlyCapacity));
    const reserve = Math.max(0, round2(input.reserve));
    const plans = goals.sort((left, right) => priorityWeight[right.priority] - priorityWeight[left.priority] || left.targetDate.localeCompare(right.targetDate)).map((goal) => {
      const months = monthsUntil(goal.targetDate, startMonth) || Math.max(1, Number(input.defaultMonths) || 12);
      const required = round2(goal.remaining / months);
      return { ...goal, months, requiredMonthly: required, proposedMonthly: 0, delayed: false, explanation: "Pendiente de asignación compatible con caja." };
    });
    let available = capacity;
    plans.forEach((plan) => {
      const proposed = round2(Math.min(plan.requiredMonthly, available));
      plan.proposedMonthly = proposed;
      available = round2(Math.max(0, available - proposed));
      plan.delayed = proposed + 0.005 < plan.requiredMonthly;
      plan.explanation = plan.delayed
        ? `Faltan ${round2(plan.requiredMonthly - proposed)} €/mes para llegar en fecha sin bajar de la reserva de ${reserve} €.`
        : "Aportación compatible con caja, deuda y reserva.";
    });
    return { schemaId: `${SCHEMA_ID}/contributions/v1`, readOnly: true, confirmRequired: true, monthlyCapacity: capacity, reserve, unassignedCapacity: available, plans };
  }

  function financialCalendar(input = {}) {
    const series = Array.isArray(input.forecast?.series) ? input.forecast.series : [];
    const goals = (input.goals || []).map(normalizeGoal);
    const debts = Array.isArray(input.debts) ? input.debts : [];
    const reviews = Array.isArray(input.reviews) ? input.reviews : [];
    const rows = series.map((month) => {
      const key = monthKey(month.monthKey);
      const events = [];
      const debtTotal = debts.reduce((sum, debt) => sum + Math.max(0, number(debt.currentPayment)), 0);
      if (debtTotal) events.push({ type: "debt", label: "Cuotas de deuda", amount: round2(debtTotal), source: "contratos canónicos" });
      goals.filter((goal) => monthKey(goal.targetDate) === key).forEach((goal) => events.push({ type: "goal", label: `Fecha objetivo: ${goal.name}`, amount: goal.remaining, source: "objetivos" }));
      reviews.filter((review) => monthKey(review.monthKey) === key).forEach(() => events.push({ type: "review", label: "Revisión mensual", amount: 0, source: "E15" }));
      events.push({ type: "forecast", label: "Previsión canónica", amount: round2(month.totals?.closingLiquidity), source: "forecast canónico" });
      return { monthKey: key, label: text(month.label || key), closingLiquidity: round2(month.totals?.closingLiquidity), events };
    });
    return { schemaId: `${SCHEMA_ID}/calendar/v1`, readOnly: true, source: "forecast/deuda/objetivos", rows };
  }

  function detectConflicts(plan = {}) {
    const plans = Array.isArray(plan.plans) ? plan.plans : [];
    const required = round2(plans.reduce((sum, goal) => sum + number(goal.requiredMonthly), 0));
    const proposed = round2(plans.reduce((sum, goal) => sum + number(goal.proposedMonthly), 0));
    const capacity = Math.max(0, round2(plan.monthlyCapacity));
    const conflicts = plans.filter((goal) => goal.delayed).map((goal) => ({
      goalId: goal.id, goal: goal.name, shortage: round2(goal.requiredMonthly - goal.proposedMonthly),
      alternatives: goal.flexibility === "flexible"
        ? ["Retrasar la fecha", "Reducir el importe", "Bajar la prioridad"]
        : ["Aumentar la capacidad disponible", "Revisar otros objetivos flexibles"],
    }));
    return { schemaId: `${SCHEMA_ID}/conflicts/v1`, capacity, required, proposed, conflicts, valid: conflicts.length === 0 };
  }

  function monthlyReview(input = {}) {
    const month = monthKey(input.monthKey || input.forecast?.series?.[0]?.monthKey);
    const actuals = Array.isArray(input.actuals) ? input.actuals : [];
    const planned = Array.isArray(input.planned) ? input.planned : [];
    const changes = actuals.map((actual) => {
      const matching = planned.find((item) => text(item.id) === text(actual.id) || text(item.label) === text(actual.label));
      const delta = round2(number(actual.amount) - number(matching?.amount));
      return { label: text(actual.label || matching?.label || "Partida"), planned: round2(matching?.amount), actual: round2(actual.amount), delta };
    }).filter((item) => item.delta !== 0);
    return {
      schemaId: `${SCHEMA_ID}/monthly-review/v1`, monthKey: month, readOnly: true, confirmRequired: true,
      changes, summary: changes.length ? `${changes.length} desviaciones requieren revisión antes de actualizar el forecast.` : "Sin desviaciones registradas; confirma la conciliación para continuar.",
      proposedActions: ["Conciliar movimientos", "Revisar desviaciones", "Actualizar forecast", "Preparar decisiones del mes siguiente"],
    };
  }

  return { SCHEMA_ID, normalizeGoal, contributionPlan, financialCalendar, detectConflicts, monthlyReview };
});
