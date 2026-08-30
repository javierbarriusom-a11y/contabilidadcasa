(function attachPortfolioContracts(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalPortfolio = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function portfolioContractsFactory() {
  "use strict";

  const SCHEMA_ID = "finanzas-casa-portfolio";
  const SCHEMA_VERSION = 1;
  const POSITION_TYPES = ["fondo", "accion", "etf", "cripto", "otro"];
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

  function positionType(value) {
    const normalized = String(value || "").trim().toLocaleLowerCase("es");
    return POSITION_TYPES.includes(normalized) ? normalized : "otro";
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

  // IV1 (núcleo): sin procedencia declarada, la posición se marca "unknown" —
  // mismo guardia que A14-1 contra "campo ausente == valor por defecto".
  function positionQuality(position = {}, raw = {}) {
    const fields = {
      quantity: knownNumber(raw.quantity),
      costBasis: knownNumber(raw.costBasis),
      currentValue: knownNumber(raw.currentValue),
      asOf: known(position.asOf),
      provenance: known(raw.provenance) && position.provenance !== "unknown",
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

  function normalizePosition(raw = {}, index = 0) {
    const provenance = provenanceOf(raw);
    const quantity = knownNumber(raw.quantity) ? number(raw.quantity) : 0;
    const costBasis = knownNumber(raw.costBasis) ? nonNegative(raw.costBasis) : 0;
    const currentValue = knownNumber(raw.currentValue) ? nonNegative(raw.currentValue) : 0;
    const position = {
      id: String(raw.id || `position-${index + 1}`),
      schemaId: SCHEMA_ID,
      schemaVersion: SCHEMA_VERSION,
      type: positionType(raw.type),
      label: String(raw.label || raw.name || raw.ticker || "Posición sin nombre").trim(),
      ticker: known(raw.ticker) ? String(raw.ticker).trim().toUpperCase() : "",
      quantity,
      costBasis,
      currentValue,
      gainLoss: round2(currentValue - costBasis),
      gainLossPct: costBasis > 0 ? round2(((currentValue - costBasis) / costBasis) * 100) : 0,
      asOf: asOfDate(raw.asOf || raw.valuationDate || raw.date),
      provenance,
      notes: known(raw.notes) ? String(raw.notes).trim() : "",
    };
    return { ...position, dataQuality: positionQuality(position, raw) };
  }

  function validatePositions(positions = []) {
    const issues = [];
    const seen = new Set();
    positions.forEach((position) => {
      if (seen.has(position.id)) issues.push({ severity: "error", code: "duplicate-position-id", positionId: position.id });
      seen.add(position.id);
      if (position.provenance === "unknown") {
        issues.push({ severity: "warning", code: "unknown-provenance", positionId: position.id });
      }
      (position.dataQuality?.missing || []).forEach((field) => {
        issues.push({ severity: "warning", code: "missing-required-field", field, positionId: position.id });
      });
    });
    return { valid: !issues.some((item) => item.severity === "error"), issues };
  }

  function summarizePositions(positions = []) {
    const totalsByType = POSITION_TYPES.reduce((acc, type) => ({ ...acc, [type]: 0 }), {});
    let totalCost = 0;
    let totalValue = 0;
    positions.forEach((position) => {
      totalsByType[position.type] = round2((totalsByType[position.type] || 0) + position.currentValue);
      totalCost = round2(totalCost + position.costBasis);
      totalValue = round2(totalValue + position.currentValue);
    });
    const gainLoss = round2(totalValue - totalCost);
    return {
      totalCost,
      totalValue,
      gainLoss,
      gainLossPct: totalCost > 0 ? round2((gainLoss / totalCost) * 100) : 0,
      totalsByType,
      count: positions.length,
    };
  }

  // IV1 (núcleo): una cartera sin posiciones registradas produce totales en
  // cero sin romper el cálculo — ninguna vista existente cambia de
  // comportamiento por la sola presencia de este contrato.
  function normalizePositions(rows = []) {
    const positions = (Array.isArray(rows) ? rows : []).map((row, index) => normalizePosition(row, index));
    return {
      schemaId: SCHEMA_ID,
      schemaVersion: SCHEMA_VERSION,
      positions,
      summary: summarizePositions(positions),
      quality: validatePositions(positions),
    };
  }

  return {
    SCHEMA_ID,
    SCHEMA_VERSION,
    POSITION_TYPES,
    PROVENANCE_VALUES,
    normalizePosition,
    normalizePositions,
    validatePositions,
    positionQuality,
    summarizePositions,
  };
});
