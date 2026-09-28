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

  // D1 (Fase 2): cualquier contrato canónico real que no sea Entidad A/B, no esté ya liquidado y
  // no sea el plan reunificado sintético (`debt-reunified-cetelem`, una vista derivada de las
  // mismas deudas, no una deuda aparte) se expone como cuenta adicional simulable en el sandbox.
  // Entidad A/B siguen viajando tal cual (cb_amount/bk_amount) para no romper la paridad histórica
  // ya verificada (A9-8) — esto solo añade, nunca sustituye ese contrato.
  function extraDebtAccounts(contracts, entityA, entityB) {
    return contracts
      .filter((contract) => contract && contract !== entityA && contract !== entityB)
      .filter((contract) => contract.id !== "debt-reunified-cetelem")
      .filter((contract) => contract.paymentStatus !== "settled" && number(contract.currentPrincipal) > 0)
      .map((contract) => ({
        id: String(contract.id || "").trim(),
        entity: String(contract.entity || "Deuda sin nombre").trim(),
        type: String(contract.type || "").trim(),
        currentPrincipal: round2(contract.currentPrincipal),
        paymentStatus: String(contract.paymentStatus || "unknown"),
      }))
      .filter((account) => account.id);
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
      extraDebts: extraDebtAccounts(contracts, entityA, entityB),
      forecast,
      roadmapState: priorState,
    };
  }

  // D1 (Fase 2/3): mismo saneado de clave que accountKey() en debt-roadmap.html — se duplica a
  // propósito en vez de compartir código entre un script de navegador sin módulos (el sandbox) y
  // esta librería, pero ambos deben producir siempre la misma clave para una cuenta dada.
  function dynamicAccountKey(id) {
    return `acct_${String(id).replace(/[^a-zA-Z0-9_-]/g, "_")}`;
  }

  // D1 (Fase 3): resuelve qué contrato real corresponde a una cuenta del sandbox (cb/bk/dinámica)
  // desde el propio modelo canónico ya calculado — nunca a partir de un contractId que llegue por
  // postMessage desde el iframe, para que el sandbox no pueda apuntar a un contrato arbitrario.
  function resolveAccountContract(accountKey, canonical) {
    if (accountKey === "cb") return canonical?.contracts?.entityA || null;
    if (accountKey === "bk") return canonical?.contracts?.entityB || null;
    return (canonical?.extraDebts || []).find((account) => dynamicAccountKey(account.id) === accountKey) || null;
  }

  // D1 (Fase 3): construye (o actualiza) la oferta borrador que el sandbox propone para una cuenta.
  // Función pura: no escribe nada, deja la mutación de estado y el aviso al llamador. Nunca inventa
  // una vigencia — si la oferta ya existía conserva la que el hogar hubiera puesto; si es nueva
  // queda en blanco a propósito, para que el hogar la complete antes de poder aplicarla.
  function buildDraftOffer(input = {}) {
    const key = String(input.accountKey || "");
    const account = input.account;
    const canonical = input.canonical;
    const existingOffers = input.existingOffers;
    const normalizeOffer = input.normalizeOffer;
    if (!key || !account || typeof normalizeOffer !== "function") return { ok: false, accountKey: key, message: "Datos incompletos." };
    const contract = resolveAccountContract(key, canonical);
    if (!contract) return { ok: false, accountKey: key, message: "Esta cuenta todavía no está vinculada a un contrato real único." };
    const amount = round2(number(account.lump) + number(account.financed));
    if (amount <= 0) return { ok: false, accountKey: key, message: "Esta estrategia no tiene ningún desembolso que proponer todavía — elige quita, refinanciación o híbrido." };
    const offers = Array.isArray(existingOffers) ? existingOffers : [];
    const replaceIndex = offers.findIndex((offer) => offer.source === "sandbox" && offer.contractId === contract.id && offer.status === "draft");
    const existing = replaceIndex >= 0 ? offers[replaceIndex] : null;
    const offer = normalizeOffer({
      id: existing?.id, contractId: contract.id, counterpart: contract.entity, expiresAt: existing?.expiresAt || "",
      amount, principal: contract.currentPrincipal, paymentType: account.strategy, installment: account.monthly,
      termMonths: account.term, apr: account.apr, documents: existing?.documents || [], status: "draft", source: "sandbox",
      notes: "Generada automáticamente desde el sandbox de deuda (D1 Fase 3). Completa la vigencia antes de poder aplicarla.",
    }, contract);
    return { ok: true, accountKey: key, offer, replaceIndex, message: "Oferta borrador guardada en Plan de deuda. Completa la vigencia allí antes de poder aplicarla." };
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
    dynamicAccountKey,
    resolveAccountContract,
    buildDraftOffer,
  };
});
