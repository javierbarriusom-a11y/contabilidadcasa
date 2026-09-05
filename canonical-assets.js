(function attachAssetContracts(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalAssets = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function assetContractsFactory() {
  "use strict";

  const SCHEMA_ID = "finanzas-casa-assets";
  const SCHEMA_VERSION = 1;
  // IVX3: "alternativo" es un tipo propio, no una entrada más de "otro" — a diferencia del resto,
  // aquí interesa la rentabilidad frente a lo invertido (cripto, participaciones no cotizadas, arte,
  // coleccionables...), y eso exige un importe invertido que los demás tipos no necesitan declarar.
  const ASSET_TYPES = ["cuenta", "inversion", "pension", "inmueble", "vehiculo", "alternativo", "otro"];
  const PROVENANCE_VALUES = ["declared", "estimated", "unknown"];

  function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function round2(value) {
    return Math.round((number(value) + Number.EPSILON) * 100) / 100;
  }

  function known(value) {
    return value !== undefined && value !== null && String(value).trim() !== "";
  }

  function knownNumber(value) {
    return known(value) && Number.isFinite(Number(value));
  }

  function nonNegative(value) {
    return Math.max(0, round2(value));
  }

  function assetType(value) {
    const normalized = String(value || "").trim().toLocaleLowerCase("es");
    return ASSET_TYPES.includes(normalized) ? normalized : "otro";
  }

  function asOfDate(value) {
    if (!value) return "";
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return value.toISOString().slice(0, 10);
    }
    const text = String(value).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
    if (/^\d{4}-\d{2}$/.test(text)) return `${text}-01`;
    return "";
  }

  function provenanceOf(raw = {}) {
    const declared = String(raw.provenance || "").trim().toLocaleLowerCase("es");
    return PROVENANCE_VALUES.includes(declared) ? declared : "unknown";
  }

  // A14-1: sin procedencia declarada, el activo se marca "unknown" — nunca se
  // reinterpreta como "declared" ni se estima en silencio (mismo guardia de
  // A16-1/SP4 contra "campo ausente == valor por defecto").
  // IVX3: para un activo "alternativo" el importe invertido cuenta para la completitud igual que el
  // resto de campos — sin él no hay rentabilidad que calcular, así que es tan "dato que falta" como
  // la procedencia. Para el resto de tipos no se pide (no lo necesitan).
  function assetQuality(asset = {}, raw = {}) {
    const fields = {
      value: knownNumber(raw.value),
      asOf: known(asset.asOf),
      provenance: known(raw.provenance) && asset.provenance !== "unknown",
      type: known(raw.type),
      owner: known(raw.owner),
    };
    if (asset.type === "alternativo") fields.investedAmount = knownNumber(raw.investedAmount);
    const missing = Object.entries(fields).filter(([, complete]) => !complete).map(([field]) => field);
    const completeness = Math.round(((Object.keys(fields).length - missing.length) / Object.keys(fields).length) * 100);
    return {
      fields,
      missing,
      completeness,
      confidence: completeness === 100 ? "high" : completeness >= 60 ? "medium" : "low",
      complete: missing.length === 0,
    };
  }

  // IVX3: rentabilidad = valor actual declarado (mismo campo que ya usan todos los activos) menos
  // el importe invertido declarado, sobre ese importe. Nunca se calcula sin un importe invertido
  // conocido y positivo — dividir por 0 o por "sin dato" daría una cifra con apariencia de precisión
  // que no existe; se declara `calculable: false` en su lugar, igual que el resto de motores de la
  // casa ante un hueco de datos real.
  function alternativeAssetReturn({ value, investedAmount } = {}) {
    const invested = knownNumber(investedAmount) ? nonNegative(investedAmount) : null;
    if (invested === null || invested <= 0) return { calculable: false };
    const current = knownNumber(value) ? nonNegative(value) : 0;
    return {
      calculable: true,
      investedAmount: invested,
      value: current,
      returnAmount: round2(current - invested),
      returnPct: round2(((current - invested) / invested) * 100),
    };
  }

  function normalizeAsset(raw = {}, index = 0) {
    const provenance = provenanceOf(raw);
    const type = assetType(raw.type);
    const value = knownNumber(raw.value) ? nonNegative(raw.value) : 0;
    const investedAmount = knownNumber(raw.investedAmount) ? nonNegative(raw.investedAmount) : null;
    const asset = {
      id: String(raw.id || `asset-${index + 1}`),
      schemaId: SCHEMA_ID,
      schemaVersion: SCHEMA_VERSION,
      type,
      label: String(raw.label || raw.name || "Activo sin nombre").trim(),
      value,
      asOf: asOfDate(raw.asOf || raw.valuationDate || raw.date),
      provenance,
      owner: String(raw.owner || "household").trim(),
      source: known(raw.source) ? String(raw.source).trim() : "",
      notes: known(raw.notes) ? String(raw.notes).trim() : "",
      category: known(raw.category) ? String(raw.category).trim() : "",
      investedAmount,
    };
    return { ...asset, returnInfo: alternativeAssetReturn({ value, investedAmount }), dataQuality: assetQuality(asset, raw) };
  }

  function validateAssets(assets = []) {
    const issues = [];
    const seen = new Set();
    assets.forEach((asset) => {
      if (seen.has(asset.id)) issues.push({ severity: "error", code: "duplicate-asset-id", assetId: asset.id });
      seen.add(asset.id);
      if (asset.provenance === "unknown") {
        issues.push({ severity: "warning", code: "unknown-provenance", assetId: asset.id });
      }
      (asset.dataQuality?.missing || []).forEach((field) => {
        issues.push({ severity: "warning", code: "missing-required-field", field, assetId: asset.id });
      });
    });
    return { valid: !issues.some((item) => item.severity === "error"), issues };
  }

  function summarizeAssets(assets = []) {
    const totalsByType = ASSET_TYPES.reduce((acc, type) => ({ ...acc, [type]: 0 }), {});
    let netWorth = 0;
    let knownValue = 0;
    assets.forEach((asset) => {
      totalsByType[asset.type] = round2((totalsByType[asset.type] || 0) + asset.value);
      netWorth = round2(netWorth + asset.value);
      if (asset.provenance !== "unknown") knownValue = round2(knownValue + asset.value);
    });
    return { netWorth, knownValue, totalsByType, count: assets.length };
  }

  // A14-6: un hogar sin activos configurados obtiene exactamente el mismo
  // resultado neutro — ninguna vista existente cambia de comportamiento por
  // la sola presencia de este contrato.
  function normalizeAssets(rows = []) {
    const assets = (Array.isArray(rows) ? rows : []).map((row, index) => normalizeAsset(row, index));
    return {
      schemaId: SCHEMA_ID,
      schemaVersion: SCHEMA_VERSION,
      assets,
      summary: summarizeAssets(assets),
      quality: validateAssets(assets),
    };
  }

  const FINANCIAL_INDEPENDENCE_SCHEMA_ID = "finance.financial-independence";

  // LPX1: capital objetivo = gasto anual declarado / tasa de retirada objetivo (regla de la renta
  // perpetua, sin motor de proyección de mercado). La tasa la declara el hogar (nunca un 4% por
  // defecto que nadie ha elegido) — mismo criterio que el tipo del ahorro de FC4 o la retención de
  // A15-1: un supuesto del hogar, no uno que la app dé por hecho.
  function financialIndependenceTarget({ annualExpenses, withdrawalRatePct, netWorth } = {}) {
    const expenses = number(annualExpenses, null);
    const rate = number(withdrawalRatePct, null);
    const worth = number(netWorth, null);
    if (!knownNumber(expenses) || expenses <= 0 || !knownNumber(rate) || rate <= 0 || !knownNumber(worth)) {
      return { schema: FINANCIAL_INDEPENDENCE_SCHEMA_ID, calculable: false };
    }
    const targetCorpus = round2(expenses / (rate / 100));
    const gap = round2(Math.max(0, targetCorpus - worth));
    const progressPct = targetCorpus > 0 ? Math.round(Math.min(100, Math.max(0, (worth / targetCorpus) * 100))) : 0;
    return {
      schema: FINANCIAL_INDEPENDENCE_SCHEMA_ID,
      calculable: true,
      annualExpenses: round2(expenses),
      withdrawalRatePct: round2(rate),
      targetCorpus,
      netWorth: round2(worth),
      gap,
      progressPct,
      reached: worth >= targetCorpus,
    };
  }

  const NET_WORTH_RUNWAY_SCHEMA_ID = "finance.net-worth-runway";

  // LPX2: cuántos meses aguantaría el patrimonio neto completo si el ingreso se cortara del todo
  // (gasto mensual medio, mismo criterio que cushionFloor). A diferencia del colchón (solo líquido),
  // aquí se cuenta TODO el patrimonio neto — así que se avisa aparte de qué parte no es líquida
  // (inmueble/vehículo/pensión: no se puede gastar sin vender o pedir prestado sobre ello) para que
  // la cifra no se lea como "dinero disponible ya", que no lo es.
  const ILLIQUID_ASSET_TYPES = ["inmueble", "vehiculo", "pension"];

  function netWorthRunway({ netWorth, monthlyBurn, totalsByType } = {}) {
    const worth = number(netWorth, null);
    const burn = number(monthlyBurn, null);
    if (!knownNumber(worth) || !knownNumber(burn) || burn <= 0) {
      return { schema: NET_WORTH_RUNWAY_SCHEMA_ID, calculable: false };
    }
    const months = worth <= 0 ? 0 : Math.floor(worth / burn);
    const byType = totalsByType && typeof totalsByType === "object" ? totalsByType : {};
    const illiquidTotal = round2(ILLIQUID_ASSET_TYPES.reduce((sum, type) => sum + number(byType[type]), 0));
    const grossTotal = round2(Object.values(byType).reduce((sum, value) => sum + number(value), 0));
    const illiquidPct = grossTotal > 0 ? Math.round((illiquidTotal / grossTotal) * 100) : 0;
    return {
      schema: NET_WORTH_RUNWAY_SCHEMA_ID,
      calculable: true,
      netWorth: round2(worth),
      monthlyBurn: round2(burn),
      months,
      illiquidTotal,
      illiquidPct,
    };
  }

  return {
    SCHEMA_ID,
    SCHEMA_VERSION,
    ASSET_TYPES,
    PROVENANCE_VALUES,
    normalizeAsset,
    normalizeAssets,
    validateAssets,
    assetQuality,
    alternativeAssetReturn,
    summarizeAssets,
    FINANCIAL_INDEPENDENCE_SCHEMA_ID,
    financialIndependenceTarget,
    NET_WORTH_RUNWAY_SCHEMA_ID,
    ILLIQUID_ASSET_TYPES,
    netWorthRunway,
  };
});
