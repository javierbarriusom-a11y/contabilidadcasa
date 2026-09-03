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
  // coste base según qué lote se vende (FIFO — FC1, más abajo). `quantity` es opcional: sin ella,
  // la aportación sigue sumando al coste total de la posición pero no entra en el reparto FIFO de
  // FC1 (no hay unidades que atribuirle en una venta futura) — un hueco honesto, no una unidad
  // inventada.
  function normalizeContributions(rows = []) {
    return (Array.isArray(rows) ? rows : [])
      .map((row, index) => ({
        id: String(row?.id || `contribution-${index + 1}`),
        date: asOfDate(row?.date),
        amount: knownNumber(row?.amount) ? nonNegative(row.amount) : 0,
        quantity: knownNumber(row?.quantity) ? nonNegative(row.quantity) : 0,
      }))
      .filter((row) => row.date && row.amount > 0)
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  // IV3: aportaciones programadas (planificadas, todavía no ejecutadas) — solo fecha, importe y
  // una nota opcional. A diferencia de `contributions` (IV2), nunca suman al coste ni entran en la
  // XIRR o el FIFO: son un plan, no un movimiento real. Su único destino es el calendario
  // financiero (E15/A10-2), igual que ya hacen los vencimientos de pólizas (SP1) o la Campaña de la
  // Renta (A15-3) — la fecha se declara, el resultado no se inventa.
  function normalizeScheduledContributions(rows = []) {
    return (Array.isArray(rows) ? rows : [])
      .map((row, index) => ({
        id: String(row?.id || `scheduled-${index + 1}`),
        date: asOfDate(row?.date),
        amount: knownNumber(row?.amount) ? nonNegative(row.amount) : 0,
        note: known(row?.note) ? String(row.note).trim() : "",
      }))
      .filter((row) => row.date && row.amount > 0)
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  // FC1: ventas parciales de una posición — unidades vendidas e importe recibido, con su fecha.
  // El reparto de qué lote se vende (fifoLedger, más abajo) es responsabilidad del motor, no de
  // esta normalización: aquí solo se descarta lo que no tiene ni fecha ni unidades vendidas.
  function normalizeDisposals(rows = []) {
    return (Array.isArray(rows) ? rows : [])
      .map((row, index) => ({
        id: String(row?.id || `disposal-${index + 1}`),
        date: asOfDate(row?.date),
        quantitySold: knownNumber(row?.quantitySold) ? nonNegative(row.quantitySold) : 0,
        saleProceeds: knownNumber(row?.saleProceeds) ? nonNegative(row.saleProceeds) : 0,
      }))
      .filter((row) => row.date && row.quantitySold > 0)
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  function positionCashFlows({ acquisitionDate, initialCost, contributions, asOf, currentValue }) {
    const flows = [];
    if (acquisitionDate && initialCost > 0) flows.push({ date: acquisitionDate, amount: -initialCost });
    contributions.forEach((contribution) => flows.push({ date: contribution.date, amount: -contribution.amount }));
    if (asOf && currentValue > 0) flows.push({ date: asOf, amount: currentValue });
    return flows;
  }

  // FC1: FIFO real sobre los lotes con unidades conocidas (adquisición inicial + aportaciones con
  // `quantity`), procesados en orden cronológico estricto — nunca por el orden en que se
  // introdujeron. Una venta solo consume lotes con fecha igual o anterior a la suya (no se puede
  // vender lo que aún no se había comprado); si las unidades disponibles a esa fecha no cubren la
  // venta, se marca `shortfall` y la plusvalía de esa venta queda `null` — nunca una cifra a medias
  // que parezca completa (regla transversal: dato ausente no es cero, tampoco se estima en
  // silencio). El coste y las unidades que quedan tras todas las ventas son los que definen la
  // posición restante — la plusvalía/minusvalía no realizada (gainLoss) se calcula sobre eso, nunca
  // sobre lo ya vendido.
  function fifoLedger({ acquisitionDate, initialCost, initialQuantity, contributions = [], disposals = [] }) {
    const lots = [];
    if (acquisitionDate && initialQuantity > 0) lots.push({ date: acquisitionDate, cost: initialCost, quantity: initialQuantity });
    contributions.forEach((contribution) => {
      if (contribution.quantity > 0) lots.push({ date: contribution.date, cost: contribution.amount, quantity: contribution.quantity });
    });
    lots.sort((a, b) => a.date.localeCompare(b.date));
    const pool = lots.map((lot) => ({ ...lot }));

    const realizedDisposals = disposals.map((disposal) => {
      let remaining = disposal.quantitySold;
      let consumedCost = 0;
      pool.forEach((lot) => {
        if (remaining <= 0 || lot.quantity <= 0 || lot.date > disposal.date) return;
        const costPerUnit = lot.cost / lot.quantity;
        const consumedQuantity = Math.min(lot.quantity, remaining);
        consumedCost += costPerUnit * consumedQuantity;
        lot.quantity = round2(lot.quantity - consumedQuantity);
        lot.cost = round2(lot.cost - costPerUnit * consumedQuantity);
        remaining = round2(remaining - consumedQuantity);
      });
      const shortfall = round2(Math.max(0, remaining));
      const roundedConsumedCost = round2(consumedCost);
      return {
        ...disposal,
        consumedCost: roundedConsumedCost,
        shortfall,
        realizedGain: shortfall > 0 ? null : round2(disposal.saleProceeds - roundedConsumedCost),
      };
    });

    const remainingQuantity = round2(pool.reduce((sum, lot) => sum + Math.max(0, lot.quantity), 0));
    const remainingCost = round2(pool.reduce((sum, lot) => sum + Math.max(0, lot.cost), 0));
    // Sin ventas, no hay plusvalía realizada que informar — null, no cero (cero significaría "se
    // vendió y no hubo ganancia ni pérdida", una afirmación distinta de "no se ha vendido nada").
    const totalRealizedGain = !realizedDisposals.length || realizedDisposals.some((disposal) => disposal.realizedGain === null)
      ? null
      : round2(realizedDisposals.reduce((sum, disposal) => sum + disposal.realizedGain, 0));
    return { lots, disposals: realizedDisposals, remainingQuantity, remainingCost, totalRealizedGain };
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
    const initialQuantity = knownNumber(raw.quantity) ? number(raw.quantity) : 0;
    const initialCost = knownNumber(raw.costBasis) ? nonNegative(raw.costBasis) : 0;
    const currentValue = knownNumber(raw.currentValue) ? nonNegative(raw.currentValue) : 0;
    const asOf = asOfDate(raw.asOf || raw.valuationDate || raw.date);
    // IV2: fecha de la primera aportación (el coste declarado en el formulario principal).
    // Sin ella no hay flujo de caja inicial que fechar, y la XIRR de esa aportación no es
    // calculable — se informa así, nunca con una fecha inventada.
    const acquisitionDate = asOfDate(raw.acquisitionDate);
    const contributions = normalizeContributions(raw.contributions);
    const disposals = normalizeDisposals(raw.disposals);
    const additionalContributed = round2(contributions.reduce((sum, contribution) => sum + contribution.amount, 0));
    // FC1: solo con al menos una venta registrada se sustituyen coste y unidades por lo que
    // realmente queda tras el reparto FIFO — sin ventas, la posición se comporta exactamente como
    // antes de FC1 (retrocompatible con IV1/IV2).
    const hasDisposals = disposals.length > 0;
    const ledger = fifoLedger({ acquisitionDate, initialCost, initialQuantity, contributions, disposals });
    const untrackedContributionsCost = round2(
      contributions.filter((contribution) => contribution.quantity <= 0).reduce((sum, contribution) => sum + contribution.amount, 0),
    );
    const quantity = hasDisposals
      ? ledger.remainingQuantity
      : round2(initialQuantity + contributions.reduce((sum, contribution) => sum + contribution.quantity, 0));
    const costBasis = hasDisposals
      ? round2(ledger.remainingCost + untrackedContributionsCost)
      : round2(initialCost + additionalContributed);
    const cashFlows = positionCashFlows({ acquisitionDate, initialCost, contributions, asOf, currentValue });
    const position = {
      id: String(raw.id || `position-${index + 1}`),
      schemaId: SCHEMA_ID,
      schemaVersion: SCHEMA_VERSION,
      type: positionType(raw.type),
      label: String(raw.label || raw.name || raw.ticker || "Posición sin nombre").trim(),
      ticker: known(raw.ticker) ? String(raw.ticker).trim().toUpperCase() : "",
      quantity,
      initialQuantity,
      costBasis,
      initialCost,
      currentValue,
      gainLoss: round2(currentValue - costBasis),
      gainLossPct: costBasis > 0 ? round2(((currentValue - costBasis) / costBasis) * 100) : 0,
      asOf,
      acquisitionDate,
      contributions,
      disposals: ledger.disposals,
      realizedGain: ledger.totalRealizedGain,
      // IV3: plan, no movimiento — nunca toca costBasis/quantity/cashFlows/FIFO de arriba.
      scheduledContributions: normalizeScheduledContributions(raw.scheduledContributions),
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
    // FC1: plusvalía realizada agregada de toda la cartera — solo si todas las posiciones con
    // ventas registradas pudieron calcularla sin `shortfall`; si una sola queda incompleta, el
    // total se informa como no calculable en vez de sumar solo lo que sí se pudo (entendería un
    // total más bajo del real, silenciosamente).
    let realizedGain = 0;
    let realizedGainKnown = true;
    positions.forEach((position) => {
      totalsByType[position.type] = round2((totalsByType[position.type] || 0) + position.currentValue);
      totalCost = round2(totalCost + position.costBasis);
      totalValue = round2(totalValue + position.currentValue);
      pooledCashFlows.push(...(position.cashFlows || []));
      // Sin ventas, `realizedGain` es null pero no contamina el total (no hay nada que sumar);
      // con ventas y sin poder calcularla (shortfall), sí lo hace — ahí sí falta un dato real.
      if (position.disposals.length && position.realizedGain === null) realizedGainKnown = false;
      else if (realizedGainKnown) realizedGain = round2(realizedGain + (position.realizedGain || 0));
    });
    const gainLoss = round2(totalValue - totalCost);
    return {
      totalRealizedGain: realizedGainKnown ? realizedGain : null,
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
    // El coste, las unidades y la fecha de adquisición originales se conservan para que la XIRR
    // (IV2) y el FIFO (FC1) de la posición no se reinicien con el traspaso — un traspaso sin peaje
    // fiscal nunca reinicia la base de coste. Se reconstruyen desde `initialCost`/`initialQuantity`
    // (los que ya trae la posición normalizada), no desde `costBasis`/`quantity` finales: esos son
    // el resultado ya neto de aportaciones y ventas, no la entrada que espera normalizePosition().
    // Si el traspaso declara una cantidad nueva (fondo de destino con un NAV distinto, unidades no
    // comparables con las del origen), las unidades de cada aportación dejan de ser válidas en la
    // nueva denominación — se conserva su coste en euros (sigue contando para la XIRR) pero se
    // limpian sus unidades, de modo que el reparto FIFO no mezcle unidades de dos fondos distintos.
    const quantityOverridden = changes.quantity !== undefined;
    const merged = {
      ...position,
      type: changes.type !== undefined ? changes.type : position.type,
      label: changes.label !== undefined ? changes.label : position.label,
      ticker: changes.ticker !== undefined ? changes.ticker : position.ticker,
      quantity: quantityOverridden ? changes.quantity : position.initialQuantity,
      currentValue: changes.currentValue !== undefined ? changes.currentValue : position.currentValue,
      costBasis: position.initialCost,
      acquisitionDate: position.acquisitionDate,
      contributions: quantityOverridden
        ? position.contributions.map((contribution) => ({ ...contribution, quantity: 0 }))
        : position.contributions,
      disposals: position.disposals,
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

  // IV5: coste de oportunidad de un importe de caja frente a haberlo dejado invertido en la cartera
  // real del hogar. `annualReturnPct` es siempre un dato que quien llama ya calculó (la XIRR real de
  // summarizePositions, IV2) — este motor no inventa ninguna cifra de mercado ni de rendimiento
  // futuro, mismo criterio que AP3 con los escenarios de rentabilidad esperada. Sin importe, sin
  // horizonte o sin una rentabilidad anual conocida, no hay coste de oportunidad que mostrar, nunca
  // un 0% asumido en su lugar.
  function opportunityCost({ amount, months, annualReturnPct } = {}) {
    const principal = Math.max(0, number(amount));
    const horizonMonths = Math.max(0, number(months));
    // `Number(null)` es 0, así que una rentabilidad ausente (null/undefined) no puede pasar por
    // `Number()` directamente sin colarse como un 0% asumido — se exige un número real de partida.
    const rate = typeof annualReturnPct === "number" && Number.isFinite(annualReturnPct) ? annualReturnPct : NaN;
    if (principal <= 0 || horizonMonths <= 0 || !Number.isFinite(rate)) {
      return {
        calculable: false,
        amount: principal,
        months: horizonMonths,
        annualReturnPct: Number.isFinite(rate) ? round2(rate) : null,
        projectedValue: null,
        gain: null,
      };
    }
    const years = horizonMonths / 12;
    const projectedValue = round2(principal * Math.pow(1 + rate / 100, years));
    return {
      calculable: true,
      amount: principal,
      months: horizonMonths,
      annualReturnPct: round2(rate),
      projectedValue,
      gain: round2(projectedValue - principal),
    };
  }

  const YEAR_END_COMPENSATION_SCHEMA_ID = "finance-canonical-portfolio/year-end-compensation-v1";
  // Ley IRPF art. 49: una pérdida patrimonial no compensada arrastra 4 ejercicios frente a
  // ganancias patrimoniales futuras. Este motor solo neta transmisiones (las plusvalías/minusvalías
  // realizadas de FC1) contra transmisiones — nunca contra rendimientos del capital mobiliario
  // (dividendos, intereses), que necesitarían un dato que esta app no declara; ese 25% cruzado de la
  // ley queda fuera de alcance a propósito, no simulado.
  const LOSS_CARRYFORWARD_YEARS = 4;

  // FC3: compensación de pérdidas y ganancias patrimoniales a cierre de año. Depende de IV1/IV2 y
  // reutiliza tal cual las plusvalías/minusvalías realizadas por venta que ya calcula FC1
  // (fifoLedger, dentro de normalizePositions) — sin motor de cálculo nuevo, solo la agregación por
  // año natural y el arrastre. Una sola venta con `realizedGain: null` (shortfall de FIFO) invalida
  // la compensación de ese año entero — nunca neta un resultado a medias que parezca completo.
  function yearEndCompensation({ positions = [], year, priorLosses = [] } = {}) {
    const targetYear = String(year || "");
    if (!/^\d{4}$/.test(targetYear)) {
      return { schemaId: YEAR_END_COMPENSATION_SCHEMA_ID, calculable: false, reason: "missing-year" };
    }
    const yearDisposals = (Array.isArray(positions) ? positions : [])
      .flatMap((position) => (Array.isArray(position?.disposals) ? position.disposals : []))
      .filter((disposal) => String(disposal?.date || "").startsWith(`${targetYear}-`));
    if (yearDisposals.some((disposal) => disposal.realizedGain === null)) {
      return { schemaId: YEAR_END_COMPENSATION_SCHEMA_ID, calculable: false, reason: "incomplete-disposal", year: targetYear };
    }
    const yearGains = round2(yearDisposals.reduce((sum, disposal) => sum + Math.max(0, number(disposal.realizedGain)), 0));
    const yearLosses = round2(yearDisposals.reduce((sum, disposal) => sum + Math.min(0, number(disposal.realizedGain)), 0));
    const netResult = round2(yearGains + yearLosses);

    // Las pérdidas de años anteriores dentro de la ventana de 4 ejercicios se aplican de la más
    // antigua a la más nueva primero — así son las que antes caducan las que primero se consumen.
    const targetYearNum = Number(targetYear);
    const eligiblePriorLosses = (Array.isArray(priorLosses) ? priorLosses : [])
      .map((entry) => ({ year: String(entry?.year || ""), amount: round2(Math.max(0, number(entry?.amount))) }))
      .filter((entry) => /^\d{4}$/.test(entry.year) && Number(entry.year) < targetYearNum && Number(entry.year) >= targetYearNum - LOSS_CARRYFORWARD_YEARS)
      .sort((a, b) => Number(a.year) - Number(b.year));

    let remainingGainToOffset = Math.max(0, netResult);
    const priorLossesApplied = [];
    const remainingPriorLosses = [];
    eligiblePriorLosses.forEach((entry) => {
      if (remainingGainToOffset <= 0 || entry.amount <= 0) {
        if (entry.amount > 0) remainingPriorLosses.push({ year: entry.year, amount: entry.amount });
        return;
      }
      const applied = round2(Math.min(entry.amount, remainingGainToOffset));
      remainingGainToOffset = round2(remainingGainToOffset - applied);
      priorLossesApplied.push({ year: entry.year, amount: applied });
      const leftover = round2(entry.amount - applied);
      if (leftover > 0) remainingPriorLosses.push({ year: entry.year, amount: leftover });
    });
    const totalPriorLossesApplied = round2(priorLossesApplied.reduce((sum, entry) => sum + entry.amount, 0));
    const taxableNet = netResult > 0 ? round2(netResult - totalPriorLossesApplied) : netResult;
    const newCarryForward = netResult < 0 ? { year: targetYear, amount: round2(Math.abs(netResult)) } : null;

    return {
      schemaId: YEAR_END_COMPENSATION_SCHEMA_ID,
      calculable: true,
      year: targetYear,
      yearGains,
      yearLosses,
      netResult,
      priorLossesApplied,
      totalPriorLossesApplied,
      taxableNet,
      newCarryForward,
      remainingPriorLosses,
    };
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
    YEAR_END_COMPENSATION_SCHEMA_ID,
    LOSS_CARRYFORWARD_YEARS,
    yearEndCompensation,
    fifoLedger,
    opportunityCost,
  };
});
