(function attachAssetContracts(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalAssets = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function assetContractsFactory() {
  "use strict";

  const SCHEMA_ID = "finanzas-casa-assets";
  const SCHEMA_VERSION = 1;
  const ASSET_TYPES = ["cuenta", "inversion", "pension", "inmueble", "vehiculo", "otro"];
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
  function assetQuality(asset = {}, raw = {}) {
    const fields = {
      value: knownNumber(raw.value),
      asOf: known(asset.asOf),
      provenance: known(raw.provenance) && asset.provenance !== "unknown",
      type: known(raw.type),
      owner: known(raw.owner),
    };
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

  function normalizeAsset(raw = {}, index = 0) {
    const provenance = provenanceOf(raw);
    const asset = {
      id: String(raw.id || `asset-${index + 1}`),
      schemaId: SCHEMA_ID,
      schemaVersion: SCHEMA_VERSION,
      type: assetType(raw.type),
      label: String(raw.label || raw.name || "Activo sin nombre").trim(),
      value: knownNumber(raw.value) ? nonNegative(raw.value) : 0,
      asOf: asOfDate(raw.asOf || raw.valuationDate || raw.date),
      provenance,
      owner: String(raw.owner || "household").trim(),
      source: known(raw.source) ? String(raw.source).trim() : "",
      notes: known(raw.notes) ? String(raw.notes).trim() : "",
    };
    return { ...asset, dataQuality: assetQuality(asset, raw) };
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

  return {
    SCHEMA_ID,
    SCHEMA_VERSION,
    ASSET_TYPES,
    PROVENANCE_VALUES,
    normalizeAsset,
    normalizeAssets,
    validateAssets,
    assetQuality,
    summarizeAssets,
  };
});
