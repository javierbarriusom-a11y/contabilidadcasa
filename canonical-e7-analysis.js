(function attachE7Analysis(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalE7 = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function e7AnalysisFactory() {
  "use strict";

  const SCHEMA_ID = "finance-advanced-comparison";
  const SCHEMA_VERSION = 1;
  const PROFESSIONAL_WARNING = "Información orientativa: confirma los efectos jurídicos y fiscales con un profesional antes de decidir.";
  const OFFICIAL_SOURCES_ES = Object.freeze({
    earlyRepayment: Object.freeze({
      id: "boe-credit-consumer-article-30",
      title: "Ley 16/2011, artículo 30 · reembolso anticipado",
      authority: "BOE",
      jurisdiction: "ES",
      url: "https://www.boe.es/buscar/act.php?id=BOE-A-2011-10970#a30",
      checkedAt: "2026-08-01",
    }),
    incomeTax: Object.freeze({
      id: "boe-irpf-article-33",
      title: "Ley 35/2006, artículo 33 · ganancias y pérdidas patrimoniales",
      authority: "BOE",
      jurisdiction: "ES",
      url: "https://www.boe.es/buscar/act.php?id=BOE-A-2006-20764#a33",
      checkedAt: "2026-08-01",
    }),
    insolvency: Object.freeze({
      id: "boe-insolvency-exoneration",
      title: "Ley Concursal, artículos 486 a 502 · exoneración del pasivo",
      authority: "BOE",
      jurisdiction: "ES",
      url: "https://www.boe.es/buscar/act.php?id=BOE-A-2020-4859",
      checkedAt: "2026-08-01",
    }),
  });

  function finite(value, fallback = 0) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : fallback; }
  function round2(value) { return Math.round((finite(value) + Number.EPSILON) * 100) / 100; }
  function text(value) { return String(value ?? "").trim(); }
  function clone(value) { return JSON.parse(JSON.stringify(value ?? null)); }

  function legalEffect(input = {}) {
    const source = input.source || {};
    const status = ["possible", "verified", "not-applicable"].includes(input.status) ? input.status : "possible";
    const completeSource = Boolean(text(source.title) && text(source.authority) && text(source.jurisdiction)
      && /^https:\/\//.test(text(source.url)) && /^\d{4}-\d{2}-\d{2}$/.test(text(source.checkedAt)));
    return {
      id: text(input.id) || "effect",
      kind: text(input.kind) || "legal",
      title: text(input.title) || "Efecto por revisar",
      summary: text(input.summary),
      status: completeSource ? status : "possible",
      source: completeSource ? clone(source) : null,
      confidence: completeSource && status === "verified" ? "medium" : "low",
      professionalReviewRequired: true,
      warning: PROFESSIONAL_WARNING,
    };
  }

  function buildAgreementEffects(strategy, options = {}) {
    const effects = [];
    if (strategy !== "no-action") effects.push(legalEffect({
      id: "early-repayment", kind: "legal", title: "Coste de reembolso o modificación contractual",
      summary: "El coste aplicable depende del tipo de crédito y del contrato; debe comprobarse antes de confirmar el importe.",
      status: "verified", source: OFFICIAL_SOURCES_ES.earlyRepayment,
    }));
    if (finite(options.debtReduction) > 0) effects.push(legalEffect({
      id: "debt-reduction-tax", kind: "tax", title: "Posible efecto tributario de la reducción de deuda",
      summary: "La variación patrimonial necesita calificación individual; el comparador no calcula una cuota fiscal automática.",
      source: OFFICIAL_SOURCES_ES.incomeTax,
    }));
    if (options.insolvency === true) effects.push(legalEffect({
      id: "insolvency", kind: "legal", title: "La exoneración exige un procedimiento y requisitos legales",
      summary: "No debe tratarse una deuda como exonerada solo por incluirla en un escenario financiero.",
      status: "verified", source: OFFICIAL_SOURCES_ES.insolvency,
    }));
    return effects;
  }

  const MINIMIZE = ["remainingDebt", "totalCost"];
  const MAXIMIZE = ["minChecking", "reserveMargin", "carFund"];
  function dominates(left, right) {
    const noWorse = MINIMIZE.every((key) => finite(left[key], Infinity) <= finite(right[key], Infinity))
      && MAXIMIZE.every((key) => finite(left[key], -Infinity) >= finite(right[key], -Infinity));
    const better = MINIMIZE.some((key) => finite(left[key], Infinity) < finite(right[key], Infinity))
      || MAXIMIZE.some((key) => finite(left[key], -Infinity) > finite(right[key], -Infinity));
    return noWorse && better;
  }

  function paretoFrontier(alternatives = [], constraints = {}) {
    const reserve = Math.max(0, finite(constraints.reserve));
    const feasible = alternatives.map((item) => ({ ...item,
      feasible: item.feasible !== false && finite(item.minChecking, -Infinity) >= reserve,
      constraintIssues: finite(item.minChecking, -Infinity) < reserve ? ["reserve-breached"] : [],
    })).filter((item) => item.feasible);
    const frontier = feasible.filter((candidate) => !feasible.some((other) => other.id !== candidate.id && dominates(other, candidate)));
    return {
      schema: `${SCHEMA_ID}/pareto`, version: SCHEMA_VERSION, reserve,
      alternatives: feasible.map((item) => ({ ...item, dominatedBy: feasible.filter((other) => other.id !== item.id && dominates(other, item)).map((other) => other.id) })),
      frontierIds: frontier.map((item) => item.id),
      reason: frontier.length ? `${frontier.length} alternativa(s) no dominada(s) respetan las restricciones de caja.` : "Ninguna alternativa respeta las restricciones de caja.",
    };
  }

  function quantile(values, position) {
    if (!values.length) return 0;
    const ordered = values.slice().sort((a, b) => a - b);
    const index = (ordered.length - 1) * position;
    const lower = Math.floor(index); const upper = Math.ceil(index);
    return round2(ordered[lower] + (ordered[upper] - ordered[lower]) * (index - lower));
  }

  function calibrateScenarios(entries = [], options = {}) {
    const reconciled = entries.filter((item) => item?.reconciled === true && Number.isFinite(Number(item.amount)));
    const monthly = new Map();
    reconciled.forEach((item) => {
      const month = text(item.date).slice(0, 7);
      if (!/^\d{4}-\d{2}$/.test(month)) return;
      monthly.set(month, round2((monthly.get(month) || 0) + finite(item.amount)));
    });
    const observations = [...monthly.values()];
    const sampleMonths = observations.length;
    const confidence = sampleMonths >= 12 ? "high" : sampleMonths >= 6 ? "medium" : "low";
    const horizonMonths = Math.max(1, Math.floor(finite(options.horizonMonths, 12)));
    const scenario = (id, percentile) => ({ id, percentile, monthlyNet: quantile(observations, percentile), calibrated: sampleMonths >= 3 });
    return {
      schema: `${SCHEMA_ID}/scenarios`, version: SCHEMA_VERSION, source: "reconciled-ledger-only",
      sampleMonths, excludedEntries: entries.length - reconciled.length, confidence, horizonMonths,
      display: horizonMonths > 24 ? "range" : "point",
      scenarios: [scenario("stress", 0.2), scenario("base", 0.5), scenario("optimistic", 0.8)],
      warning: sampleMonths < 6 ? "Muestra corta: usa estos escenarios como bandas prudentes, no como probabilidades precisas." : "",
    };
  }

  function identity(item, index) { return text(item?.id || item?.key || item?.uuid) || `row-${index}`; }
  function compareImport(before = [], after = [], options = {}) {
    const previous = new Map(before.map((item, index) => [identity(item, index), item]));
    const next = new Map(after.map((item, index) => [identity(item, index), item]));
    const additions = []; const removals = []; const changes = []; const duplicates = [];
    const seen = new Set();
    after.forEach((item, index) => { const id = identity(item, index); if (seen.has(id)) duplicates.push(id); seen.add(id); });
    next.forEach((item, id) => {
      if (!previous.has(id)) additions.push({ id, after: clone(item) });
      else if (JSON.stringify(previous.get(id)) !== JSON.stringify(item)) changes.push({ id, before: clone(previous.get(id)), after: clone(item) });
    });
    previous.forEach((item, id) => { if (!next.has(id)) removals.push({ id, before: clone(item) }); });
    const beforeMonthly = round2(before.reduce((sum, item) => sum + finite(item?.monthlyAmount ?? item?.amount), 0));
    const afterMonthly = round2(after.reduce((sum, item) => sum + finite(item?.monthlyAmount ?? item?.amount), 0));
    const invariants = { uniqueIds: duplicates.length === 0, custom: options.invariants || {} };
    return { schema: `${SCHEMA_ID}/import-diff`, version: SCHEMA_VERSION, additions, changes, duplicates, removals,
      monthlyEffect: round2(afterMonthly - beforeMonthly), invariants, valid: invariants.uniqueIds && !Object.values(invariants.custom).includes(false) };
  }

  return { SCHEMA_ID, SCHEMA_VERSION, PROFESSIONAL_WARNING, OFFICIAL_SOURCES_ES, legalEffect,
    buildAgreementEffects, dominates, paretoFrontier, calibrateScenarios, compareImport };
});
