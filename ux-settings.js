(function exposeFinanceUxSettings(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceUxSettings = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createFinanceUxSettings() {
  "use strict";

  const FAMILY_CONTEXTS = ["household", "javi", "tere"];
  const ALERT_METRICS = ["caixaBalance", "minimumCash12m", "minimumCashMonths", "debtRatio", "freeCapacity"];

  function normalizeText(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }

  function normalizeFamilyContext(value) {
    return FAMILY_CONTEXTS.includes(value) ? value : "household";
  }

  function inferOwner(row = {}, sectionName = "") {
    const explicit = normalizeText(row.owner || row.holder || row.titular || row.person || "");
    const haystack = normalizeText([
      row.label,
      row.name,
      row.concept,
      row.description,
      row.group,
      sectionName,
    ].filter(Boolean).join(" "));
    if (/\btere\b|teresa/.test(explicit) || /\btere\b|teresa/.test(haystack)) return "tere";
    if (/\bjavi\b|javier/.test(explicit) || /\bjavi\b|javier/.test(haystack)) return "javi";
    if (explicit === "hogar" || explicit === "household" || explicit === "familia") return "household";
    return "household";
  }

  function familyWeight(owner, context, kind) {
    const selected = normalizeFamilyContext(context);
    if (selected === "household") return 1;
    if (owner === selected) return 1;
    if (owner !== "household") return 0;
    return kind === "expense" ? 0.5 : 0;
  }

  function aggregateFamilyContext({ months = [], sectionsForMonth, valueForRow, context = "household" } = {}) {
    const selected = normalizeFamilyContext(context);
    const result = { context: selected, income: 0, expenses: 0, net: 0, months: [] };
    if (typeof sectionsForMonth !== "function" || typeof valueForRow !== "function") return result;

    months.forEach((month) => {
      let income = 0;
      let expenses = 0;
      ["income", "expense"].forEach((kind) => {
        const sections = sectionsForMonth(kind, month) || [];
        sections.forEach((section) => {
          (section.rows || []).forEach((row) => {
            const owner = inferOwner(row, section.name || section.label || "");
            const weighted = Number(valueForRow(row, month) || 0) * familyWeight(owner, selected, kind);
            if (kind === "income") income += weighted;
            else expenses += weighted;
          });
        });
      });
      const monthResult = {
        key: month && (month.key || month.label) ? (month.key || month.label) : String(month || ""),
        income: Math.round(income * 100) / 100,
        expenses: Math.round(expenses * 100) / 100,
        net: Math.round((income - expenses) * 100) / 100,
      };
      result.months.push(monthResult);
      result.income += monthResult.income;
      result.expenses += monthResult.expenses;
    });
    result.income = Math.round(result.income * 100) / 100;
    result.expenses = Math.round(result.expenses * 100) / 100;
    result.net = Math.round((result.income - result.expenses) * 100) / 100;
    return result;
  }

  function normalizeAlert(alert = {}) {
    const metric = ALERT_METRICS.includes(alert.metric) ? alert.metric : "caixaBalance";
    return {
      id: String(alert.id || `alert-${Date.now()}`),
      name: String(alert.name || "Nueva alerta").trim() || "Nueva alerta",
      metric,
      operator: alert.operator === "above" ? "above" : "below",
      threshold: Number.isFinite(Number(alert.threshold)) ? Number(alert.threshold) : 0,
      action: String(alert.action || "Revisar el indicador y ajustar el plan antes de confirmar nuevas decisiones.").trim(),
      reviewDate: String(alert.reviewDate || ""),
      frequency: ["daily", "weekly", "monthly"].includes(alert.frequency) ? alert.frequency : "monthly",
      paused: Boolean(alert.paused),
      createdAt: String(alert.createdAt || new Date().toISOString()),
      updatedAt: String(alert.updatedAt || new Date().toISOString()),
    };
  }

  function evaluateAlert(alert, snapshot = {}, today = new Date()) {
    const normalized = normalizeAlert(alert);
    const rawValue = Number(snapshot[normalized.metric]);
    const value = Number.isFinite(rawValue) ? rawValue : null;
    const triggered = !normalized.paused && value !== null && (
      normalized.operator === "above"
        ? value > normalized.threshold
        : value < normalized.threshold
    );
    const reviewTime = normalized.reviewDate ? new Date(`${normalized.reviewDate}T00:00:00`).getTime() : NaN;
    const todayTime = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    return {
      ...normalized,
      value,
      triggered,
      overdue: !normalized.paused && Number.isFinite(reviewTime) && reviewTime < todayTime,
      status: normalized.paused ? "paused" : triggered ? "triggered" : "ok",
    };
  }

  return {
    FAMILY_CONTEXTS,
    ALERT_METRICS,
    normalizeFamilyContext,
    inferOwner,
    familyWeight,
    aggregateFamilyContext,
    normalizeAlert,
    evaluateAlert,
  };
});
