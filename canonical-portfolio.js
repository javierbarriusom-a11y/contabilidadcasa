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

  // IV2: XIRR real (Newton-Raphson vía bisección, mismo criterio que Excel — flujos negativos
  // para dinero aportado, positivos para dinero devuelto/valor final) sobre una lista genérica de
  // flujos de caja con fecha. No asume dos flujos: funciona igual con 2 que con 20, para que siga
  // siendo correcta el día que una posición acumule varias aportaciones en fechas distintas — el
  // caso de dos flujos (una aportación + el valor actual) es solo el caso particular más simple.
  // Sin margen para inventar una tasa cuando no hay datos suficientes o no converge (regla
  // transversal: dato ausente no es cero, tampoco se estima en silencio) — se devuelve `rate: null`
  // con el motivo explícito en vez de una cifra que parezca cierta sin serlo.
  const MS_PER_DAY = 86400000;
  const XIRR_TOLERANCE = 1e-6;
  const XIRR_MAX_ITERATIONS = 100;
  const XIRR_MAX_EXPANSIONS = 40;

  function xirrNpv(flows, years, rate) {
    return flows.reduce((sum, flow, index) => sum + flow.amount / Math.pow(1 + rate, years[index]), 0);
  }

  function xirr(flows = []) {
    const valid = (Array.isArray(flows) ? flows : [])
      .map((flow) => ({ date: asOfDate(flow.date), amount: number(flow.amount) }))
      .filter((flow) => flow.date && flow.amount !== 0)
      .sort((a, b) => a.date.localeCompare(b.date));
    if (valid.length < 2) return { rate: null, ratePct: null, converged: false, reason: "insufficient-flows" };
    if (!valid.some((flow) => flow.amount > 0) || !valid.some((flow) => flow.amount < 0)) {
      return { rate: null, ratePct: null, converged: false, reason: "single-direction-flows" };
    }
    const t0 = Date.parse(`${valid[0].date}T00:00:00Z`);
    const years = valid.map((flow) => (Date.parse(`${flow.date}T00:00:00Z`) - t0) / (MS_PER_DAY * 365));
    if (years[years.length - 1] === 0) return { rate: null, ratePct: null, converged: false, reason: "same-date-flows" };

    let lo = -0.999999;
    let hi = 10;
    let fLo = xirrNpv(valid, years, lo);
    let fHi = xirrNpv(valid, years, hi);
    let expansions = 0;
    while (fLo * fHi > 0 && expansions < XIRR_MAX_EXPANSIONS) {
      hi *= 2;
      fHi = xirrNpv(valid, years, hi);
      expansions += 1;
    }
    if (fLo * fHi > 0) return { rate: null, ratePct: null, converged: false, reason: "no-bracket" };

    let mid = 0;
    let fMid = 0;
    let converged = false;
    for (let iteration = 0; iteration < XIRR_MAX_ITERATIONS; iteration += 1) {
      mid = (lo + hi) / 2;
      fMid = xirrNpv(valid, years, mid);
      if (Math.abs(fMid) < XIRR_TOLERANCE) { converged = true; break; }
      if ((fLo < 0) === (fMid < 0)) { lo = mid; fLo = fMid; } else { hi = mid; }
    }
    return { rate: round2(mid * 10000) / 100, ratePct: round2(mid * 100), converged, reason: converged ? "" : "not-converged" };
  }

  // IV2: aportaciones adicionales de una posición ya registrada — cada una con su propia fecha,
  // para que la XIRR de la posición deje de coincidir con la rentabilidad simple en cuanto haya
  // más de un movimiento. Solo dinero aportado (importe > 0); una retirada parcial cambiaría el
  // coste base según qué lote se vende (FIFO, tarea FC1 aparte) y queda fuera de aquí a propósito.
  function normalizeContributions(rows = []) {
    return (Array.isArray(rows) ? rows : [])
      .map((row, index) => ({
        id: String(row?.id || `contribution-${index + 1}`),
        date: asOfDate(row?.date),
        amount: knownNumber(row?.amount) ? nonNegative(row.amount) : 0,
      }))
      .filter((row) => row.date && row.amount > 0)
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  function positionCashFlows({ acquisitionDate, initialCost, contributions, asOf, currentValue }) {
    const flows = [];
    if (acquisitionDate && initialCost > 0) flows.push({ date: acquisitionDate, amount: -initialCost });
    contributions.forEach((contribution) => flows.push({ date: contribution.date, amount: -contribution.amount }));
    if (asOf && currentValue > 0) flows.push({ date: asOf, amount: currentValue });
    return flows;
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
    const initialCost = knownNumber(raw.costBasis) ? nonNegative(raw.costBasis) : 0;
    const currentValue = knownNumber(raw.currentValue) ? nonNegative(raw.currentValue) : 0;
    const asOf = asOfDate(raw.asOf || raw.valuationDate || raw.date);
    // IV2: fecha de la primera aportación (el coste declarado en el formulario principal).
    // Sin ella no hay flujo de caja inicial que fechar, y la XIRR de esa aportación no es
    // calculable — se informa así, nunca con una fecha inventada.
    const acquisitionDate = asOfDate(raw.acquisitionDate);
    const contributions = normalizeContributions(raw.contributions);
    const additionalContributed = round2(contributions.reduce((sum, contribution) => sum + contribution.amount, 0));
    const costBasis = round2(initialCost + additionalContributed);
    const cashFlows = positionCashFlows({ acquisitionDate, initialCost, contributions, asOf, currentValue });
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
      asOf,
      acquisitionDate,
      contributions,
      provenance,
      notes: known(raw.notes) ? String(raw.notes).trim() : "",
    };
    return { ...position, dataQuality: positionQuality(position, raw), cashFlows, xirr: xirr(cashFlows) };
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

  // IV2: XIRR de toda la cartera — todos los flujos de todas las posiciones juntos en una sola
  // ecuación, no la media de las XIRR individuales (mezclar tasas anualizadas de distinto tamaño
  // así sería una media sin sentido económico). Cada posición ya trae sus propios flujos con
  // fecha (positionCashFlows), así que agregarlos es solo concatenar la lista.
  function summarizePositions(positions = []) {
    const totalsByType = POSITION_TYPES.reduce((acc, type) => ({ ...acc, [type]: 0 }), {});
    let totalCost = 0;
    let totalValue = 0;
    const pooledCashFlows = [];
    positions.forEach((position) => {
      totalsByType[position.type] = round2((totalsByType[position.type] || 0) + position.currentValue);
      totalCost = round2(totalCost + position.costBasis);
      totalValue = round2(totalValue + position.currentValue);
      pooledCashFlows.push(...(position.cashFlows || []));
    });
    const gainLoss = round2(totalValue - totalCost);
    return {
      totalCost,
      totalValue,
      gainLoss,
      gainLossPct: totalCost > 0 ? round2((gainLoss / totalCost) * 100) : 0,
      totalsByType,
      count: positions.length,
      xirr: xirr(pooledCashFlows),
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

  // FC2: un traspaso entre fondos de inversión no es un hecho imponible en España — solo
  // fondo→fondo cumple esa regla fiscal; cualquier otro par de tipos es una venta+compra normal.
  function isFundToFundTransfer(sourceType, targetType) {
    return sourceType === "fondo" && targetType === "fondo";
  }

  function applyFundTransfer(position = {}, changes = {}) {
    const merged = {
      ...position,
      type: changes.type !== undefined ? changes.type : position.type,
      label: changes.label !== undefined ? changes.label : position.label,
      ticker: changes.ticker !== undefined ? changes.ticker : position.ticker,
      quantity: changes.quantity !== undefined ? changes.quantity : position.quantity,
      currentValue: changes.currentValue !== undefined ? changes.currentValue : position.currentValue,
      // El coste y la fecha de adquisición originales se conservan para el futuro cálculo FIFO
      // (FC1) — un traspaso sin peaje fiscal nunca reinicia la base de coste. Por la misma razón,
      // el histórico de aportaciones (IV2) tampoco se reinicia: la XIRR del traspaso sigue
      // contando desde la primera aportación real, no desde la fecha del traspaso.
      costBasis: position.contributions.length ? round2(position.costBasis - position.contributions.reduce((sum, c) => sum + c.amount, 0)) : position.costBasis,
      acquisitionDate: position.acquisitionDate,
      contributions: position.contributions,
      asOf: position.asOf,
      provenance: position.provenance,
    };
    return normalizePosition(merged, 0);
  }

  const REBALANCE_THRESHOLD_PCT = 10;

  function hasAnyTarget(targets = {}) {
    return POSITION_TYPES.some((type) => knownNumber(targets[type]) && number(targets[type]) > 0);
  }

  // IV6: sugerencia de rebalanceo solo cuando el usuario ha declarado objetivos —
  // sin objetivos, no hay "desviación" que sugerir (mismo guardia que el resto del
  // contrato contra inferir un dato que nadie ha declarado).
  function rebalanceSuggestions(totalsByType = {}, totalValue = 0, targets = {}, thresholdPct = REBALANCE_THRESHOLD_PCT) {
    if (!hasAnyTarget(targets) || totalValue <= 0) return [];
    return POSITION_TYPES.map((type) => {
      const currentValue = totalsByType[type] || 0;
      const currentPct = round2((currentValue / totalValue) * 100);
      const targetPct = knownNumber(targets[type]) ? number(targets[type]) : 0;
      const deviation = round2(currentPct - targetPct);
      const targetValue = round2((targetPct / 100) * totalValue);
      const amount = round2(targetValue - currentValue);
      const action = Math.abs(deviation) <= thresholdPct ? "ok" : amount > 0 ? "comprar" : "vender";
      return { type, currentPct, targetPct, deviation, amount, action };
    }).filter((row) => row.currentPct > 0 || row.targetPct > 0);
  }

  return {
    SCHEMA_ID,
    SCHEMA_VERSION,
    POSITION_TYPES,
    PROVENANCE_VALUES,
    REBALANCE_THRESHOLD_PCT,
    normalizePosition,
    normalizePositions,
    validatePositions,
    positionQuality,
    summarizePositions,
    rebalanceSuggestions,
    isFundToFundTransfer,
    applyFundTransfer,
    xirr,
  };
});
