(function attachE14DebtAdapter(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalE14DebtAdapter = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function e14DebtAdapterFactory() {
  "use strict";

  const SCHEMA_ID = "finance-e14-debt-roadmap-read-model/v1";
  const STRATEGY_SCHEMA_ID = "finance-debt-strategy/v1";

  const FIELD_INVENTORY = Object.freeze({
    canonical: Object.freeze(["liquidity", "monthly", "cb_amount", "bk_amount", "baseMonth"]),
    operational: Object.freeze(["tasks", "scenario", "agreement", "wizink_hito_mes"]),
    assumption: Object.freeze([
      "profile", "buffer", "preserveCash", "cb_strategy", "cb_discount", "cb_start", "cb_lump",
      "cb_apr", "cb_term", "cb_finance_pct", "bk_strategy", "bk_discount", "bk_start", "bk_lump",
      "bk_apr", "bk_term", "bk_finance_pct", "fc_months", "referenceAPR",
    ]),
    note: Object.freeze(["notes"]),
  });

  const STRATEGY_TYPES = Object.freeze(["settlement", "single-payment", "refinancing", "suspension", "arrears", "resume-payments", "hold"]);

  function number(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function round2(value) {
    return Math.round((number(value) + Number.EPSILON) * 100) / 100;
  }

  function clone(value) {
    if (value === undefined) return undefined;
    return JSON.parse(JSON.stringify(value));
  }

  function monthKey(value) {
    const match = String(value || "").match(/^(\d{4})-(\d{1,2})/);
    return match ? `${match[1]}-${String(Number(match[2])).padStart(2, "0")}` : "";
  }

  function classifyField(field) {
    const match = Object.entries(FIELD_INVENTORY).find(([, fields]) => fields.includes(field));
    return match?.[0] || "ambiguous";
  }

  function inventoryRoadmapState(state = {}) {
    return Object.keys(state).sort().map((field) => ({ field, classification: classifyField(field) }));
  }

  function findUniqueContract(contracts, entity) {
    const normalized = String(entity).trim().toLocaleLowerCase("es");
    const matches = contracts.filter((contract) => String(contract?.entity || "").trim().toLocaleLowerCase("es") === normalized);
    return matches.length === 1 ? matches[0] : null;
  }

  function canonicalForecastSummary(forecast = {}) {
    const series = Array.isArray(forecast?.series) ? forecast.series : [];
    const first = series[0] || null;
    const minimumLiquidity = series.length
      ? Math.min(...series.map((month) => number(month?.totals?.closingLiquidity)))
      : null;
    const averageFreeCapacity = series.length
      ? round2(series.reduce((sum, month) => sum + Math.max(0, number(month?.totals?.income) - number(month?.totals?.outflowsBeforeSaving)), 0) / series.length)
      : null;
    return {
      schemaId: forecast?.schemaId || "",
      fingerprint: forecast?.fingerprint || "",
      valid: forecast?.valid === true,
      months: series.length,
      startMonth: monthKey(first?.monthKey),
      openingLiquidity: first ? round2(number(first?.totals?.closingLiquidity) - number(first?.totals?.income) + number(first?.totals?.outflowsBeforeSaving)) : null,
      minimumLiquidity: minimumLiquidity === null ? null : round2(minimumLiquidity),
      averageFreeCapacity,
    };
  }

  function buildReadModel(input = {}) {
    const contracts = clone(Array.isArray(input.contracts) ? input.contracts : []);
    const priorState = clone(input.roadmapState && typeof input.roadmapState === "object" ? input.roadmapState : {});
    const forecast = canonicalForecastSummary(input.forecast);
    const entityA = findUniqueContract(contracts, "Entidad A");
    const entityB = findUniqueContract(contracts, "Entidad B");
    const ambiguous = [];
    if (!entityA) ambiguous.push("cb_amount");
    if (!entityB) ambiguous.push("bk_amount");
    if (!forecast.valid || forecast.openingLiquidity === null) ambiguous.push("liquidity", "monthly", "baseMonth");

    const canonicalValues = {};
    if (entityA) canonicalValues.cb_amount = round2(entityA.currentPrincipal);
    if (entityB) canonicalValues.bk_amount = round2(entityB.currentPrincipal);
    if (forecast.valid && forecast.openingLiquidity !== null) {
      canonicalValues.liquidity = forecast.openingLiquidity;
      canonicalValues.monthly = forecast.averageFreeCapacity;
      canonicalValues.baseMonth = forecast.startMonth;
    }

    return {
      schemaId: SCHEMA_ID,
      version: 1,
      mode: "read-only",
      generatedAt: input.generatedAt || new Date().toISOString(),
      source: "canonical-debt-contracts+canonical-forecast",
      fieldInventory: FIELD_INVENTORY,
      canonicalValues,
      ambiguous: [...new Set(ambiguous)],
      contracts: { entityA, entityB, all: contracts },
      forecast,
      roadmapState: priorState,
    };
  }

  function strategyType(value) {
    const aliases = { settlement: "settlement", quita: "settlement", fixed: "single-payment", optimize: "single-payment", refi: "refinancing", refinancing: "refinancing", hybrid: "refinancing", suspended: "suspension", suspension: "suspension", arrears: "arrears", resume: "resume-payments", "resume-payment": "resume-payments", hold: "hold" };
    return aliases[String(value || "").trim().toLocaleLowerCase("es")] || "hold";
  }

  function normalizeStrategy(raw = {}, contract = {}) {
    const type = strategyType(raw.type || raw.strategy || raw.mode);
    const startMonth = monthKey(raw.startMonth || raw.monthKey);
    const normalized = {
      schemaId: STRATEGY_SCHEMA_ID,
      version: 1,
      id: String(raw.id || "").trim(),
      contractId: String(raw.contractId || raw.targetId || contract.id || "").trim(),
      type,
      principal: round2(raw.principal ?? contract.currentPrincipal),
      settlementAmount: round2(raw.settlementAmount ?? raw.lumpSum ?? raw.amount),
      discountPercent: round2(raw.discountPercent ?? raw.discount),
      apr: round2(raw.apr ?? raw.tae),
      installment: round2(raw.installment ?? raw.payment),
      termMonths: Math.max(0, Math.floor(number(raw.termMonths ?? raw.duration))),
      startMonth,
      maturityMonth: monthKey(raw.maturityMonth || contract.maturityMonth),
      arrears: round2(raw.arrears ?? contract.arrearsEstimated),
      paymentStatus: String(raw.paymentStatus || contract.paymentStatus || "unknown"),
      source: String(raw.source || "roadmap-assumption"),
    };
    const issues = [];
    if (!normalized.contractId) issues.push("missing-contract");
    if (normalized.principal < 0 || normalized.settlementAmount < 0 || normalized.arrears < 0) issues.push("negative-amount");
    if (normalized.discountPercent < 0 || normalized.discountPercent > 100) issues.push("invalid-discount");
    if (["refinancing", "resume-payments"].includes(type) && normalized.termMonths < 1) issues.push("missing-term");
    if (!["hold", "suspension", "arrears"].includes(type) && !startMonth) issues.push("missing-start-month");
    return { ...normalized, valid: issues.length === 0, issues };
  }

  return {
    SCHEMA_ID,
    STRATEGY_SCHEMA_ID,
    FIELD_INVENTORY,
    STRATEGY_TYPES,
    classifyField,
    inventoryRoadmapState,
    buildReadModel,
    normalizeStrategy,
  };
});
