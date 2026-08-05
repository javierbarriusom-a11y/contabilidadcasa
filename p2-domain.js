(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.P2Domain = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const OWNER_VALUES = ["household", "javi", "tere"];
  const ALERT_CHANNELS = ["app", "browser", "email"];

  const number = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  const round2 = (value) => Math.round((number(value) + Number.EPSILON) * 100) / 100;
  const text = (value) => String(value || "").trim();
  const id = (prefix = "p2") => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  function inferOwner(label) {
    const normalized = text(label).toLowerCase();
    if (/\btere\b|teresa|nomina tere|salario tere/.test(normalized)) return "tere";
    if (/\bjavi\b|javier|nomina javi|bonus javi/.test(normalized)) return "javi";
    return "household";
  }

  function normalizeOwner(value, fallbackLabel = "") {
    return OWNER_VALUES.includes(value) ? value : inferOwner(fallbackLabel);
  }

  function normalizeGoal(goal = {}) {
    const target = Math.max(0, number(goal.target));
    const contributions = Array.isArray(goal.contributions) ? goal.contributions : [];
    const unique = [];
    const movementIds = new Set();
    contributions.forEach((entry) => {
      const movementId = text(entry.movementId);
      if (movementId && movementIds.has(movementId)) return;
      if (movementId) movementIds.add(movementId);
      unique.push({
        id: text(entry.id) || id("contribution"),
        movementId,
        amount: round2(Math.max(0, number(entry.amount))),
        date: text(entry.date),
        month: text(entry.month),
        label: text(entry.label) || "Aportación real",
        source: text(entry.source) || (movementId ? "movement" : "manual"),
      });
    });
    return {
      id: text(goal.id) || id("goal"),
      name: text(goal.name) || "Nuevo objetivo",
      type: ["emergency", "car", "project", "other"].includes(goal.type) ? goal.type : "other",
      owner: normalizeOwner(goal.owner, goal.name),
      priority: ["critical", "high", "medium", "low"].includes(goal.priority) ? goal.priority : "medium",
      flexibility: ["fixed", "flexible"].includes(goal.flexibility) ? goal.flexibility : "flexible",
      fundingSource: ["savings", "income", "debt", "other"].includes(goal.fundingSource) ? goal.fundingSource : "savings",
      target: round2(target),
      targetDate: text(goal.targetDate),
      status: ["active", "completed", "paused", "cancelled"].includes(goal.status) ? goal.status : "active",
      contributions: unique,
      createdAt: text(goal.createdAt) || new Date().toISOString(),
      updatedAt: text(goal.updatedAt) || new Date().toISOString(),
    };
  }

  function goalSnapshot(goal) {
    const normalized = normalizeGoal(goal);
    const saved = round2(normalized.contributions.reduce((sum, item) => sum + item.amount, 0));
    const remaining = round2(Math.max(0, normalized.target - saved));
    return {
      ...normalized,
      saved,
      remaining,
      progress: normalized.target > 0 ? Math.min(100, round2((saved / normalized.target) * 100)) : 0,
      contributionCount: normalized.contributions.length,
    };
  }

  function addGoalContribution(goal, contribution) {
    const normalized = normalizeGoal(goal);
    const movementId = text(contribution?.movementId);
    if (movementId && normalized.contributions.some((item) => item.movementId === movementId)) {
      return { goal: normalized, added: false, reason: "duplicate-movement" };
    }
    const next = normalizeGoal({
      ...normalized,
      contributions: [...normalized.contributions, contribution],
      updatedAt: new Date().toISOString(),
    });
    return { goal: next, added: true, reason: "added" };
  }

  function addContributionToState(state, goalId, contribution) {
    const normalized = normalizeState(state);
    const movementId = text(contribution?.movementId);
    if (
      movementId &&
      normalized.goals.some((goal) => goal.contributions.some((item) => item.movementId === movementId))
    ) {
      return { state: normalized, added: false, reason: "duplicate-movement" };
    }
    let added = false;
    const goals = normalized.goals.map((goal) => {
      if (goal.id !== goalId) return goal;
      const result = addGoalContribution(goal, contribution);
      added = result.added;
      return result.goal;
    });
    return { state: normalizeState({ ...normalized, goals }), added, reason: added ? "added" : "goal-not-found" };
  }

  function removeGoalContribution(state, goalId, contributionId) {
    const normalized = normalizeState(state);
    return normalizeState({
      ...normalized,
      goals: normalized.goals.map((goal) =>
        goal.id === goalId
          ? normalizeGoal({
              ...goal,
              contributions: goal.contributions.filter((item) => item.id !== contributionId),
              updatedAt: new Date().toISOString(),
            })
          : goal,
      ),
    });
  }

  function normalizeAlert(alert = {}) {
    const channel = ALERT_CHANNELS.includes(alert.channel) ? alert.channel : "app";
    return {
      ...alert,
      channel,
      externalTarget: text(alert.externalTarget),
      muteUntil: text(alert.muteUntil),
      lastNotifiedAt: text(alert.lastNotifiedAt),
    };
  }

  function alertMuted(alert, now = new Date()) {
    if (!alert?.muteUntil) return false;
    const until = new Date(`${alert.muteUntil}T23:59:59`);
    return Number.isFinite(until.getTime()) && until >= now;
  }

  function median(values) {
    const sorted = values.map(Number).filter(Number.isFinite).sort((a, b) => a - b);
    if (!sorted.length) return 0;
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  function behaviorAnalytics(transactions = [], isReconciled = () => false) {
    const reconciled = transactions.filter((row) => isReconciled(row));
    const expenses = reconciled.filter((row) => number(row.amount) < 0);
    const byMonth = new Map();
    const byCategory = new Map();
    expenses.forEach((row) => {
      const amount = Math.abs(number(row.amount));
      const month = text(row.month) || text(row.date).slice(0, 7);
      const category = text(row.category) || "Sin categoría";
      byMonth.set(month, round2((byMonth.get(month) || 0) + amount));
      byCategory.set(category, round2((byCategory.get(category) || 0) + amount));
    });
    const months = [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b));
    const recent = months.slice(-3);
    const previous = months.slice(-6, -3);
    const recentAverage = recent.length ? round2(recent.reduce((sum, [, value]) => sum + value, 0) / recent.length) : 0;
    const previousAverage = previous.length ? round2(previous.reduce((sum, [, value]) => sum + value, 0) / previous.length) : 0;
    const trendPercent = previousAverage ? round2(((recentAverage - previousAverage) / previousAverage) * 100) : 0;
    const expenseAmounts = expenses.map((row) => Math.abs(number(row.amount)));
    const baseline = median(expenseAmounts);
    const anomalies = expenses
      .filter((row) => Math.abs(number(row.amount)) > Math.max(100, baseline * 2.5))
      .sort((a, b) => Math.abs(number(b.amount)) - Math.abs(number(a.amount)))
      .slice(0, 8);
    const categories = [...byCategory.entries()].sort((a, b) => b[1] - a[1]);
    return {
      totalTransactions: transactions.length,
      reconciledTransactions: reconciled.length,
      reconciledExpenses: expenses.length,
      reconciledAmount: round2(expenses.reduce((sum, row) => sum + Math.abs(number(row.amount)), 0)),
      recentAverage,
      previousAverage,
      trendPercent,
      months,
      categories,
      anomalies,
      provenance: "Solo movimientos conciliados con una partida del cuadro de mandos",
    };
  }

  function normalizeDocument(document = {}) {
    return {
      id: text(document.id) || id("document"),
      debtId: text(document.debtId),
      title: text(document.title) || "Documento de acuerdo",
      fileName: text(document.fileName),
      mimeType: text(document.mimeType) || "application/octet-stream",
      size: Math.max(0, number(document.size)),
      deadline: text(document.deadline),
      status: ["offer", "call", "evidence", "signed"].includes(document.status) ? document.status : "evidence",
      verified: Boolean(document.verified),
      notes: text(document.notes),
      deviceOnly: document.deviceOnly !== false,
      storage: document.storage === "cloud" ? "cloud" : "device",
      encrypted: Boolean(document.encrypted),
      remotePath: text(document.remotePath),
      deletedAt: text(document.deletedAt),
      recoverUntil: text(document.recoverUntil),
      createdAt: text(document.createdAt) || new Date().toISOString(),
      updatedAt: text(document.updatedAt) || new Date().toISOString(),
    };
  }

  function normalizeState(state = {}) {
    return {
      goals: (Array.isArray(state.goals) ? state.goals : []).map(normalizeGoal),
      ownership:
        state.ownership && typeof state.ownership === "object"
          ? Object.fromEntries(
              Object.entries(state.ownership).map(([key, value]) => [key, normalizeOwner(value, key)]),
            )
          : {},
      documents: (Array.isArray(state.documents) ? state.documents : []).map(normalizeDocument),
      exportVersion: Math.max(1, Math.floor(number(state.exportVersion, 1))),
      exportHistory: (Array.isArray(state.exportHistory) ? state.exportHistory : []).slice(-25).map((entry) => ({
        id: text(entry.id) || id("export"),
        version: Math.max(1, Math.floor(number(entry.version, 1))),
        format: ["pdf", "xlsx"].includes(entry.format) ? entry.format : "pdf",
        createdAt: text(entry.createdAt) || new Date().toISOString(),
      })),
      alertDeliveries:
        state.alertDeliveries && typeof state.alertDeliveries === "object" ? { ...state.alertDeliveries } : {},
      e15: state.e15 && typeof state.e15 === "object" ? {
        reviews: (Array.isArray(state.e15.reviews) ? state.e15.reviews : []).slice(-24).map((review) => ({ monthKey: text(review.monthKey), completedAt: text(review.completedAt), notes: text(review.notes) })),
      } : { reviews: [] },
      e16: state.e16 && typeof state.e16 === "object" ? {
        riskBudget: {
          minimumLiquidity: Math.max(0, round2(number(state.e16.riskBudget?.minimumLiquidity))),
          maximumMonthlyVariation: Math.max(0, round2(number(state.e16.riskBudget?.maximumMonthlyVariation))),
          maximumDebtRatio: Math.max(0, round2(number(state.e16.riskBudget?.maximumDebtRatio, 40))),
        },
        predictionSamples: (Array.isArray(state.e16.predictionSamples) ? state.e16.predictionSamples : []).slice(-120).map((sample) => ({ ...sample })),
      } : { riskBudget: { minimumLiquidity: 0, maximumMonthlyVariation: 0, maximumDebtRatio: 40 }, predictionSamples: [] },
    };
  }

  return {
    OWNER_VALUES,
    ALERT_CHANNELS,
    addContributionToState,
    addGoalContribution,
    alertMuted,
    behaviorAnalytics,
    goalSnapshot,
    id,
    inferOwner,
    normalizeAlert,
    normalizeDocument,
    normalizeGoal,
    normalizeOwner,
    normalizeState,
    removeGoalContribution,
    round2,
  };
});
