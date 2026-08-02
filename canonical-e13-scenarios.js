(function attachCanonicalE13(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalE13 = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function canonicalE13Factory() {
  "use strict";

  const SCHEMA_ID = "finance-e13-scenario-lab/v1";
  const EVENT_TYPES = Object.freeze(["income-loss", "expense", "car", "move", "debt"]);
  const PROFILES = Object.freeze([
    { id: "base", label: "Base", incomeFactor: 1, expenseFactor: 1 },
    { id: "favorable", label: "Favorable", incomeFactor: 1.03, expenseFactor: 0.97 },
    { id: "stress", label: "Tensión", incomeFactor: 0.9, expenseFactor: 1.1 },
  ]);

  const number = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
  const round = (value) => Math.round((number(value) + Number.EPSILON) * 100) / 100;
  const text = (value) => String(value ?? "").trim();

  function assumptionValue(forecast, id, fallback = 0) {
    const item = (forecast?.assumptions?.items || []).find((candidate) => candidate.id === id);
    return item ? item.value : fallback;
  }

  function normalizeEvent(raw = {}, index = 0) {
    const type = EVENT_TYPES.includes(raw.type) ? raw.type : "expense";
    return {
      id: text(raw.id || `event-${index + 1}`),
      type,
      label: text(raw.label || type),
      monthKey: text(raw.monthKey),
      amount: Math.max(0, round(raw.amount)),
      duration: Math.max(1, Math.round(number(raw.duration) || 1)),
    };
  }

  function eventImpact(event, monthIndex, startIndex) {
    if (startIndex < 0 || monthIndex < startIndex || monthIndex >= startIndex + event.duration) return { income: 0, outflow: 0, debt: 0 };
    if (event.type === "income-loss") return { income: -event.amount, outflow: 0, debt: 0 };
    return { income: 0, outflow: event.amount, debt: event.type === "debt" ? event.amount : 0 };
  }

  function recoveryMonth(rows) {
    const firstNegative = rows.findIndex((row) => row.closingChecking < 0);
    if (firstNegative < 0) return null;
    const recovered = rows.find((row, index) => index > firstNegative && row.closingChecking >= 0);
    return recovered?.monthKey || "not-recovered";
  }

  function simulate(forecast = {}, profile = PROFILES[0], rawEvents = []) {
    const source = Array.isArray(forecast?.series) ? forecast.series : [];
    const events = rawEvents.map(normalizeEvent);
    let checking = number(assumptionValue(forecast, "openingChecking"));
    let savings = number(assumptionValue(forecast, "openingSavings"));
    const autoCapSavings = assumptionValue(forecast, "autoCapSavings", true) !== false;
    let debtImpact = 0;
    const rows = source.map((month, index) => {
      const impacts = events.reduce((total, event) => {
        const impact = eventImpact(event, index, source.findIndex((item) => item.monthKey === event.monthKey));
        total.income += impact.income;
        total.outflow += impact.outflow;
        total.debt += impact.debt;
        return total;
      }, { income: 0, outflow: 0, debt: 0 });
      const income = round(number(month.totals?.income) * number(profile.incomeFactor || 1) + impacts.income);
      const outflows = round(number(month.totals?.outflowsBeforeSaving) * number(profile.expenseFactor || 1) + impacts.outflow);
      const targetSaving = number(month.totals?.saving);
      const available = checking + income - outflows;
      const saving = autoCapSavings ? round(Math.max(0, Math.min(targetSaving, available - outflows))) : round(targetSaving);
      checking = round(available - saving);
      savings = round(savings + saving);
      debtImpact = round(debtImpact + impacts.debt);
      return {
        monthKey: month.monthKey,
        label: month.label,
        income,
        outflows,
        saving,
        closingChecking: checking,
        closingSavings: savings,
        closingLiquidity: round(checking + savings),
        eventIncome: round(impacts.income),
        eventOutflow: round(impacts.outflow),
        debtImpact: round(impacts.debt),
      };
    });
    const negativeMonths = rows.filter((row) => row.closingChecking < 0).length;
    return {
      id: profile.id,
      label: profile.label,
      profile: { incomeFactor: profile.incomeFactor, expenseFactor: profile.expenseFactor },
      rows,
      metrics: {
        minChecking: rows.length ? Math.min(...rows.map((row) => row.closingChecking)) : 0,
        negativeMonths,
        finalSavings: rows.at(-1)?.closingSavings || savings,
        finalLiquidity: rows.at(-1)?.closingLiquidity || checking + savings,
        debtImpact,
        recoveryMonth: recoveryMonth(rows),
      },
    };
  }

  function buildLab(forecast = {}, events = [], metadata = {}) {
    if (forecast?.schemaId !== "finance-canonical-forecast/v1" || forecast?.valid !== true) {
      throw new Error("E13a requiere un forecast canónico válido.");
    }
    const normalizedEvents = events.map(normalizeEvent);
    return {
      schemaId: SCHEMA_ID,
      generatedAt: metadata.generatedAt || new Date().toISOString(),
      sourceForecastFingerprint: forecast.fingerprint,
      readOnly: true,
      writesPlan: false,
      events: normalizedEvents,
      scenarios: PROFILES.map((profile) => simulate(forecast, profile, normalizedEvents)),
    };
  }

  return { SCHEMA_ID, EVENT_TYPES, PROFILES, buildLab, normalizeEvent, simulate };
});
