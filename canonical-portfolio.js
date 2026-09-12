(function attachPortfolioContracts(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalPortfolio = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function portfolioContractsFactory() {
  "use strict";

  const SCHEMA_ID = "finanzas-casa-portfolio";
  const SCHEMA_VERSION = 1;
  // INV11 (Oleada 4, Bloque 4): "plan-pension" se añade como tipo de instrumento propio, no como
  // variante de "otro" — es la única forma de que una posición de plan de pensiones entre en las
  // funciones ya construidas (XIRR real de IV2, rebalanceo de IV6, glide path de IVX6) sin motor
  // nuevo: todas ya son genéricas sobre POSITION_TYPES/ASSET_CLASS_TYPES, solo hacía falta un valor
  // de tipo que las active.
  const POSITION_TYPES = ["fondo", "accion", "etf", "cripto", "plan-pension", "otro"];
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
      // IVX4: comisión anual declarada por el hogar (TER/gastos de gestión, %). 0 significa "sin
      // comisión declarada", nunca "comisión cero confirmada" — igual que el resto de campos
      // opcionales de este contrato.
      feePct: knownNumber(raw.feePct) ? nonNegative(raw.feePct) : 0,
      // LEV6 (Oleada 3, Bloque 4): convicción declarada por el hogar (1-5, menor = vender antes al
      // desapalancar) — opcional, null si no se declara, nunca un valor medio inventado.
      convictionScore: knownNumber(raw.convictionScore) ? Math.max(1, Math.min(5, Math.round(number(raw.convictionScore)))) : null,
      // INV8 (Oleada 3, Bloque 5): plan de aportación periódica declarado — opcional, null si no
      // se declara (mismos dos campos crudos que el resto del formulario, dcaMonthlyAmount/
      // dcaStartDate; aquí se agrupan en un solo objeto de conveniencia). dcaPlanStatus() (más
      // abajo) lo compara contra las aportaciones reales (contributions, arriba) ya registradas,
      // nunca inventa un calendario de aportaciones.
      dcaPlan: (knownNumber(raw.dcaMonthlyAmount) && number(raw.dcaMonthlyAmount) > 0 && asOfDate(raw.dcaStartDate))
        ? { monthlyAmount: nonNegative(raw.dcaMonthlyAmount), startDate: asOfDate(raw.dcaStartDate) }
        : null,
      // INV14 (Oleada 4, Bloque 4): divisa y geografía declaradas — opcionales, "" si no se
      // declaran (nunca EUR/España asumidos por defecto). La divisa es texto libre en mayúsculas
      // (código ISO habitual, p. ej. USD) porque esta app no valida contra una lista de divisas
      // reales; la geografía sí usa una lista cerrada (GEOGRAPHY_REGIONS, más abajo).
      currency: known(raw.currency) ? String(raw.currency).trim().toLocaleUpperCase("es") : "",
      region: GEOGRAPHY_REGIONS.includes(raw.region) ? raw.region : "",
      // INV15 (Oleada 4, Bloque 4): coste de custodia/corretaje anual declarado (€/año) — 0 significa
      // "sin coste declarado", igual que feePct. Se declara como importe fijo, no como %, porque la
      // mayoría de brokers cobran lo mismo tenga la posición 1.000€ o 100.000€.
      custodyFeeAnnual: knownNumber(raw.custodyFeeAnnual) ? nonNegative(raw.custodyFeeAnnual) : 0,
      // INV20 (Oleada 4, Bloque 4): anulación declarada de la liquidez que INV7 (liquidityLadder,
      // más abajo) infiere por tipo de instrumento — null si no se declara, nunca inferido de otro
      // dato. Solo para cuando el tipo no refleja la liquidez real de esta posición concreta.
      liquidityTierOverride: LIQUIDITY_TIERS.some((tier) => tier.tier === raw.liquidityTierOverride) ? raw.liquidityTierOverride : null,
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

  // INV17 (Oleada 4, Bloque 4): revisión de rebalanceo por calendario — rebalanceSuggestions (IV6,
  // arriba) solo avisa cuando la desviación cruza el umbral de un salto; una cartera que se
  // desalinea despacio (unos pocos puntos cada mes) puede tardar años en cruzarlo sin que nadie la
  // revise mientras tanto. Complementa, no sustituye, el aviso por umbral: un recordatorio simple
  // por tiempo transcurrido desde la última revisión CONFIRMADA por el hogar (nunca inferida de
  // otra acción, mismo criterio que PVC15 con la caducidad de un supuesto) — sin ninguna revisión
  // registrada, se considera vencida desde el principio, nunca "recién revisada" por defecto.
  const REBALANCE_CALENDAR_REVIEW_SCHEMA_ID = "finance-inv17-rebalance-calendar-review/v1";
  const REBALANCE_CALENDAR_REVIEW_DEFAULT_MONTHS = 6;

  function monthsSinceDate(dateIso, referenceDate = new Date()) {
    const start = asOfDate(dateIso);
    const reference = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);
    if (!start || Number.isNaN(reference.getTime())) return null;
    const [sy, sm, sd] = start.split("-").map(Number);
    const startUtc = Date.UTC(sy, sm - 1, sd);
    const referenceUtc = Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), reference.getUTCDate());
    if (referenceUtc < startUtc) return 0;
    let months = (reference.getUTCFullYear() - sy) * 12 + (reference.getUTCMonth() - (sm - 1));
    if (reference.getUTCDate() < sd) months -= 1;
    return Math.max(0, months);
  }

  function rebalanceCalendarReviewStatus({ lastReviewedAt, intervalMonths = REBALANCE_CALENDAR_REVIEW_DEFAULT_MONTHS } = {}, referenceDate = new Date()) {
    const effectiveInterval = knownNumber(intervalMonths) && number(intervalMonths) > 0 ? number(intervalMonths) : REBALANCE_CALENDAR_REVIEW_DEFAULT_MONTHS;
    if (!known(lastReviewedAt)) {
      return { schemaId: REBALANCE_CALENDAR_REVIEW_SCHEMA_ID, reviewed: false, due: true, monthsSinceReview: null, intervalMonths: effectiveInterval, lastReviewedAt: "" };
    }
    const monthsElapsed = monthsSinceDate(lastReviewedAt, referenceDate);
    return {
      schemaId: REBALANCE_CALENDAR_REVIEW_SCHEMA_ID,
      reviewed: true,
      due: monthsElapsed === null || monthsElapsed >= effectiveInterval,
      monthsSinceReview: monthsElapsed,
      intervalMonths: effectiveInterval,
      lastReviewedAt: asOfDate(lastReviewedAt),
    };
  }

  // LEV6 (Oleada 3, Bloque 4): plan de desapalancamiento con prioridad — al reducir deuda de
  // apalancamiento vendiendo posiciones, tres criterios de prioridad. Dos son directos (menor coste
  // fiscal de liquidar, menor convicción declarada); el tercero, decisión del hogar (sesión 159): en
  // vez de "mayor correlación con el resto del patrimonio" (exige el mismo histórico de rendimientos
  // que ya bloqueó APX4), "misma clase de activo ya sobreexpuesta" — reutiliza rebalanceSuggestions
  // (IV6, ya existente) en vez de un motor nuevo: una posición cuyo tipo ya supera el objetivo
  // declarado en más del umbral de rebalanceo se prioriza, porque venderla también corrige esa
  // sobreexposición. El coste fiscal se deriva de la plusvalía ya calculada (gainLoss) y el tipo del
  // ahorro que el hogar ya declara para FC4/APX1 — nunca un tipo impositivo inventado; sin él, el
  // coste fiscal se trata como 0 (no como "desconocido"), igual que rebalanceSuggestions trata la
  // ausencia de objetivo declarado.
  function deleveragingPriority({ positions = [], totalsByType = {}, totalValue = 0, targets = {}, savingsTaxRatePct = 0, thresholdPct = REBALANCE_THRESHOLD_PCT } = {}) {
    const overexposedTypes = new Set(
      rebalanceSuggestions(totalsByType, totalValue, targets, thresholdPct)
        .filter((row) => row.action === "vender")
        .map((row) => row.type),
    );
    const rate = knownNumber(savingsTaxRatePct) ? Math.max(0, Math.min(100, number(savingsTaxRatePct))) : 0;
    const candidates = (Array.isArray(positions) ? positions : [])
      .filter((position) => number(position.currentValue) > 0)
      .map((position) => {
        const gain = number(position.gainLoss);
        const taxCost = gain > 0 ? round2(gain * (rate / 100)) : 0;
        return {
          id: position.id,
          label: position.label,
          type: position.type,
          currentValue: round2(number(position.currentValue)),
          taxCost,
          convictionScore: knownNumber(position.convictionScore) ? number(position.convictionScore) : null,
          overexposed: overexposedTypes.has(position.type),
        };
      });
    if (!candidates.length) return { calculable: false, rows: [] };
    const rows = [...candidates]
      .sort((a, b) => {
        if (a.overexposed !== b.overexposed) return a.overexposed ? -1 : 1;
        if (a.taxCost !== b.taxCost) return a.taxCost - b.taxCost;
        const aConviction = a.convictionScore ?? 99;
        const bConviction = b.convictionScore ?? 99;
        return aConviction - bConviction;
      })
      .map((row, index) => ({ ...row, priorityRank: index + 1 }));
    return { calculable: true, rows };
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

  const BENCHMARK_COMPARISON_SCHEMA_ID = "finance.portfolio-benchmark-comparison";

  // IVX2: comparación contra un índice de referencia. La XIRR de la cartera es ponderada por dinero
  // (money-weighted); el índice se compara con la rentabilidad anualizada que el hogar declara para
  // el mismo periodo — una comparación aproximada por construcción (el índice no vive las mismas
  // entradas/salidas de caja que la cartera real), así que se dice así, nunca como una cifra exacta.
  function compareAgainstBenchmark(xirrResult, benchmarkAnnualReturnPct) {
    const portfolioPct = xirrResult && xirrResult.ratePct !== null ? number(xirrResult.ratePct, null) : null;
    const benchmarkPct = typeof benchmarkAnnualReturnPct === "number" && Number.isFinite(benchmarkAnnualReturnPct) ? benchmarkAnnualReturnPct : null;
    if (portfolioPct === null || benchmarkPct === null) return { schema: BENCHMARK_COMPARISON_SCHEMA_ID, calculable: false };
    const deltaPct = round2(portfolioPct - benchmarkPct);
    return {
      schema: BENCHMARK_COMPARISON_SCHEMA_ID,
      calculable: true,
      portfolioPct: round2(portfolioPct),
      benchmarkPct: round2(benchmarkPct),
      deltaPct,
      beatsBenchmark: deltaPct > 0,
    };
  }

  const GLIDE_PATH_SCHEMA_ID = "finance.portfolio-glide-path";
  const GLIDE_PATH_BANDS = {
    OVERDUE: "overdue",
    CONSERVATIVE: "conservative",
    TRANSITION: "transition",
    GROWTH: "growth",
  };

  // IVX6: banda de horizonte por objetivo asociado — no una recomendación de a qué posición mover
  // cada euro, porque esta app no clasifica el riesgo/volatilidad real de cada posición (fondo,
  // acción, ETF y cripto son etiquetas de tipo, no un rating de riesgo). Se dice la fase estándar
  // (crecimiento/transición/conservador) y se deja la decisión de qué posición concreta ajustar al
  // hogar — inventar una regla de "vende X% de cripto" sin datos de riesgo sería fabricar precisión
  // que no existe.
  function glidePathBand(monthsRemaining) {
    if (!Number.isFinite(monthsRemaining)) return GLIDE_PATH_BANDS.OVERDUE;
    if (monthsRemaining < 0) return GLIDE_PATH_BANDS.OVERDUE;
    if (monthsRemaining < 24) return GLIDE_PATH_BANDS.CONSERVATIVE;
    if (monthsRemaining < 60) return GLIDE_PATH_BANDS.TRANSITION;
    return GLIDE_PATH_BANDS.GROWTH;
  }

  function monthsBetween(targetDate, fromDate) {
    const target = asOfDate(targetDate);
    const from = asOfDate(fromDate);
    if (!target || !from) return null;
    const [ty, tm] = target.split("-").map(Number);
    const [fy, fm] = from.split("-").map(Number);
    return (ty - fy) * 12 + (tm - fm);
  }

  // INV12 (Oleada 4, Bloque 4): qué posiciones financian un objetivo se resuelve, por orden de
  // preferencia, desde `fundingPositions` (declarado en el propio objetivo, la fuente formal desde
  // esta tarea) y solo si ese array está vacío se recurre al escaneo histórico por `position.goalId`
  // (campo de fortuna, anterior a INV12, que se mantiene por compatibilidad con datos ya guardados).
  function linkedPositionsForGoal(goalId, positions, fundingPositionIds) {
    const list = Array.isArray(positions) ? positions : [];
    const declared = Array.isArray(fundingPositionIds) ? fundingPositionIds.filter(known) : [];
    if (declared.length) {
      const idSet = new Set(declared);
      return list.filter((position) => idSet.has(position.id));
    }
    return list.filter((position) => position.goalId === goalId);
  }

  function glidePathForGoal({ goalId, goalName, targetDate, positions = [], fundingPositionIds } = {}, now = new Date()) {
    if (!known(goalId) || !known(targetDate)) return { schema: GLIDE_PATH_SCHEMA_ID, calculable: false };
    const nowKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const monthsRemaining = monthsBetween(targetDate, nowKey);
    const linked = linkedPositionsForGoal(goalId, positions, fundingPositionIds);
    const totalValue = round2(linked.reduce((sum, position) => sum + number(position.currentValue), 0));
    const rows = linked
      .map((position) => ({
        id: position.id,
        label: position.label,
        value: round2(number(position.currentValue)),
        pct: totalValue > 0 ? Math.round((number(position.currentValue) / totalValue) * 100) : 0,
      }))
      .sort((a, b) => b.value - a.value);
    return {
      schema: GLIDE_PATH_SCHEMA_ID,
      calculable: true,
      goalId,
      goalName: String(goalName || "Objetivo"),
      monthsRemaining,
      band: glidePathBand(monthsRemaining),
      totalValue,
      positions: rows,
    };
  }

  // INV1 (Oleada 3, Bloque 4): clase de activo por posición, declarada a mano — vive en el registro
  // RAW de la posición (`position.assetClass`), exactamente el mismo patrón que `goalId` (IVX6):
  // solo hace falta para esta comparación, no para el resto de la cartera, así que no se añade a
  // `normalizePosition()` (que expone un contrato con campos fijos). Es un tipo propio, distinto del
  // tipo de instrumento (POSITION_TYPES: fondo/acción/ETF/cripto/otro) — aquí interesa el perfil de
  // riesgo declarado, no el vehículo.
  const ASSET_CLASS_TYPES = Object.freeze(["renta-variable", "renta-fija", "monetario", "alternativo"]);
  const ASSET_CLASS_RISK_PROFILE = Object.freeze({
    "renta-variable": "growth",
    alternativo: "growth",
    "renta-fija": "defensive",
    monetario: "defensive",
  });

  // Lectura real (composición por clase declarada, de las posiciones ligadas a ESE objetivo) frente
  // a la banda de horizonte que ya calcula IVX6 — nunca una regla automática de "vende X%": IVX6 ya
  // avisa de que esta app no clasifica riesgo/volatilidad real, así que esto solo hace visible el
  // contraste. `mismatch` usa el mismo umbral del 50% que ya usa IVX8 para "dominante" (aquí:
  // creciente vs. defensivo), no una cifra objetivo inventada por banda.
  function assetClassVsGlidePath({ goalId, positions = [], fundingPositionIds } = {}, band) {
    const linked = linkedPositionsForGoal(goalId, positions, fundingPositionIds);
    const totalValue = round2(linked.reduce((sum, position) => sum + number(position.currentValue), 0));
    if (!linked.length || !(totalValue > 0)) return { calculable: false };
    const byClass = {};
    linked.forEach((position) => {
      const value = number(position.currentValue);
      const assetClass = ASSET_CLASS_TYPES.includes(position.assetClass) ? position.assetClass : "sin-clasificar";
      byClass[assetClass] = round2((byClass[assetClass] || 0) + value);
    });
    const rows = Object.entries(byClass)
      .map(([assetClass, value]) => ({ assetClass, value, pct: Math.round((value / totalValue) * 100) }))
      .sort((a, b) => b.value - a.value);
    const growthValue = round2(ASSET_CLASS_TYPES.filter((type) => ASSET_CLASS_RISK_PROFILE[type] === "growth").reduce((sum, type) => sum + (byClass[type] || 0), 0));
    const defensiveValue = round2(ASSET_CLASS_TYPES.filter((type) => ASSET_CLASS_RISK_PROFILE[type] === "defensive").reduce((sum, type) => sum + (byClass[type] || 0), 0));
    const growthPct = Math.round((growthValue / totalValue) * 100);
    const defensivePct = Math.round((defensiveValue / totalValue) * 100);
    const unclassifiedPct = Math.max(0, 100 - growthPct - defensivePct);
    const mismatch = (band === "conservative" || band === "overdue") && growthPct > 50
      ? "growth-heavy-for-defensive-band"
      : band === "growth" && defensivePct > 50
        ? "defensive-heavy-for-growth-band"
        : null;
    return { calculable: true, band, totalValue, rows, growthPct, defensivePct, unclassifiedPct, mismatch };
  }

  // IVX4: coste compuesto de comisiones — aísla el efecto puro de la comisión anual declarada
  // (feePct) sobre el valor actual a lo largo de un horizonte, sin asumir ninguna rentabilidad de
  // mercado (eso exigiría inventar un supuesto de crecimiento que el hogar no ha declarado). El
  // valor "neto de comisión" se calcula igual que un capital que pierde feePct% compuesto cada año
  // — la misma mecánica de interés compuesto que ya usa el resto de la app, aplicada en sentido
  // contrario.
  const FEE_COST_SCHEMA_ID = "finanzas-casa-portfolio-fee-cost";

  function compoundedFeeCost({ currentValue, feePct, years } = {}) {
    if (!(number(currentValue) > 0) || !(number(feePct) > 0) || !(number(years) > 0)) {
      return { schema: FEE_COST_SCHEMA_ID, calculable: false };
    }
    const grossValue = round2(currentValue);
    const netValue = round2(grossValue * Math.pow(1 - number(feePct) / 100, number(years)));
    return {
      schema: FEE_COST_SCHEMA_ID,
      calculable: true,
      feePct: number(feePct),
      years: number(years),
      grossValue,
      netValue,
      totalFeeCost: round2(grossValue - netValue),
    };
  }

  // INV15 (Oleada 4, Bloque 4): coste total de propiedad real — IVX4 (compoundedFeeCost, arriba)
  // solo aísla el efecto del TER/gestión declarado. El otro coste habitual de mantener una posición
  // es la custodia/corretaje, casi siempre un importe FIJO anual (€/año) más que un % sobre el
  // valor — se declara así, no como otro %, para no fingir que escala con el valor cuando muchos
  // brokers cobran lo mismo tenga la posición 1.000€ o 100.000€. Por eso no compone sobre sí mismo
  // (un coste fijo anual no crece exponencialmente): se suma sin componer al coste compuesto de
  // feePct que ya calcula compoundedFeeCost.
  const TOTAL_COST_OF_OWNERSHIP_SCHEMA_ID = "finance-inv15-total-cost-of-ownership/v1";

  function totalCostOfOwnership({ currentValue, feePct, custodyFeeAnnual, years } = {}) {
    const horizonYears = Math.max(0, number(years));
    const custodyAnnual = Math.max(0, number(custodyFeeAnnual));
    const managementFeeCost = compoundedFeeCost({ currentValue, feePct, years });
    if (!(horizonYears > 0) || !(custodyAnnual > 0 || managementFeeCost.calculable)) {
      return { schema: TOTAL_COST_OF_OWNERSHIP_SCHEMA_ID, calculable: false };
    }
    const managementCost = managementFeeCost.calculable ? managementFeeCost.totalFeeCost : 0;
    const custodyCost = round2(custodyAnnual * horizonYears);
    return {
      schema: TOTAL_COST_OF_OWNERSHIP_SCHEMA_ID,
      calculable: true,
      years: horizonYears,
      managementFeeCost: managementCost,
      custodyFeeCost: custodyCost,
      totalCost: round2(managementCost + custodyCost),
    };
  }

  // INV19 (Oleada 4, Bloque 4): el coste de no tocar nunca tu cartera (dejar corriendo la comisión
  // anual declarada de cada posición) visto como trayectoria, no como una única cifra puntual —
  // compoundedFeeCost (IVX4) ya da el número final a un horizonte, pero una curva que se acelera es
  // más fácil de entender que leer "12.345€" sin más contexto. Suma, año a año, el valor neto de
  // CADA posición con comisión declarada por separado (cada una compone a su propio feePct) — nunca
  // un % medio inventado sobre el conjunto, que distorsionaría el resultado si las comisiones
  // declaradas son distintas entre posiciones.
  const FEE_COST_TRAJECTORY_SCHEMA_ID = "finance-inv19-fee-cost-trajectory/v1";
  const FEE_COST_TRAJECTORY_DEFAULT_YEARS = 20;

  function portfolioFeeCostTrajectory(positions = [], years = FEE_COST_TRAJECTORY_DEFAULT_YEARS) {
    const horizonYears = Math.max(1, Math.round(number(years, FEE_COST_TRAJECTORY_DEFAULT_YEARS)));
    const feeBearing = (Array.isArray(positions) ? positions : []).filter((position) => number(position?.currentValue) > 0 && number(position?.feePct) > 0);
    if (!feeBearing.length) return { schema: FEE_COST_TRAJECTORY_SCHEMA_ID, calculable: false };
    const grossValue = round2(feeBearing.reduce((sum, position) => sum + number(position.currentValue), 0));
    const points = [];
    for (let year = 0; year <= horizonYears; year += 1) {
      const netValue = round2(feeBearing.reduce((sum, position) => sum + number(position.currentValue) * Math.pow(1 - number(position.feePct) / 100, year), 0));
      points.push({ year, netValue, cumulativeFeeCost: round2(grossValue - netValue) });
    }
    return {
      schema: FEE_COST_TRAJECTORY_SCHEMA_ID,
      calculable: true,
      years: horizonYears,
      positionsCount: feeBearing.length,
      grossValue,
      points,
      totalFeeCost: points[points.length - 1].cumulativeFeeCost,
    };
  }

  // INV6 (Oleada 3, Bloque 5; VER-3 confirmó que FC3 solo cubre pérdidas ya realizadas vía FIFO):
  // candidatas a compensación de pérdidas y ganancias ANTES de vender — el dato base (gainLoss no
  // realizado por posición) ya lo calcula normalizePositions() arriba, esta función solo filtra y
  // ordena. Nunca sugiere ejecutar nada (regla transversal 04): es una lista de candidatas, con el
  // aviso explícito de la norma española de no recompra (2 meses en cotizados, 1 año en no
  // cotizados) para no inducir a vender y recomprar antes de que la pérdida sea deducible.
  const LATENT_LOSS_SCHEMA_ID = "finanzas-casa-portfolio-latent-loss-harvesting";

  function latentLossHarvestingCandidates(positions = []) {
    const candidates = (Array.isArray(positions) ? positions : [])
      .filter((position) => number(position.gainLoss) < 0)
      .map((position) => ({
        id: position.id, label: position.label, type: position.type,
        gainLoss: round2(position.gainLoss), gainLossPct: round2(position.gainLossPct),
        currentValue: round2(position.currentValue), costBasis: round2(position.costBasis),
      }))
      .sort((a, b) => a.gainLoss - b.gainLoss);
    return {
      schemaId: LATENT_LOSS_SCHEMA_ID,
      candidates,
      totalLatentLoss: round2(candidates.reduce((sum, item) => sum + item.gainLoss, 0)),
    };
  }

  // INV7 (Oleada 3, Bloque 5): escalera de liquidez de la cartera — a cuántos días puede
  // convertirse cada posición en caja sin penalización severa, cruzado con el suelo del colchón
  // (canonical-cushion.js). Distinto de LPX2 (runway de patrimonio neto total): aquí importa la
  // VELOCIDAD de conversión, no el valor total. El día de liquidación por tipo es un valor típico
  // de mercado (T+2 en bolsa para acción/ETF, T+3 habitual en fondos españoles, mercado cripto sin
  // ventana de liquidación) — nunca inventado para "otro", que queda fuera de la escalera como "sin
  // clasificar" en vez de fingir una velocidad que no se conoce.
  // INV11 (Oleada 4, Bloque 4): "bloqueada" es un tramo distinto de "sin-clasificar" a propósito —
  // de un plan de pensiones SÍ se conoce la velocidad de conversión: cero, salvo jubilación o un
  // supuesto tasado (fallecimiento, incapacidad, paro de larga duración...), nunca a demanda. Tratarlo
  // como "sin-clasificar" diría "no sabemos", cuando en realidad "sabemos que no es líquida". El
  // override declarado de INV20 sigue disponible por si el hogar ya está en fase de rescate.
  const LIQUIDITY_TIER_BY_TYPE = {
    accion: "inmediata", etf: "inmediata", cripto: "inmediata",
    fondo: "corta",
    "plan-pension": "bloqueada",
    otro: "sin-clasificar",
  };
  const LIQUIDITY_TIERS = [
    { tier: "inmediata", label: "Inmediata (0-2 días)", maxDays: 2 },
    { tier: "corta", label: "Corta (3-7 días)", maxDays: 7 },
    { tier: "bloqueada", label: "Bloqueada hasta jubilación o supuesto tasado", maxDays: null },
    { tier: "sin-clasificar", label: "Sin clasificar", maxDays: null },
  ];
  const LIQUIDITY_LADDER_SCHEMA_ID = "finanzas-casa-portfolio-liquidity-ladder";

  function liquidityLadder(positions = [], floorValue = 0) {
    const byTier = new Map(LIQUIDITY_TIERS.map((tier) => [tier.tier, { ...tier, value: 0, types: [], overriddenValue: 0 }]));
    (Array.isArray(positions) ? positions : []).forEach((position) => {
      // INV20: el tramo declarado por el hogar para ESTA posición manda sobre el que se infiere por
      // tipo de instrumento — solo cuando el hogar lo declara explícitamente (el tipo no siempre
      // refleja la liquidez real, p. ej. un ETF de nicho menos líquido que uno indexado grande).
      const overridden = LIQUIDITY_TIERS.some((tier) => tier.tier === position.liquidityTierOverride);
      const tierId = overridden ? position.liquidityTierOverride : (LIQUIDITY_TIER_BY_TYPE[positionType(position.type)] || "sin-clasificar");
      const entry = byTier.get(tierId);
      entry.value = round2(entry.value + number(position.currentValue));
      if (overridden) entry.overriddenValue = round2(entry.overriddenValue + number(position.currentValue));
      if (!entry.types.includes(position.type)) entry.types.push(position.type);
    });
    const tiers = LIQUIDITY_TIERS.map((tier) => byTier.get(tier.tier));
    let cumulative = 0;
    let tierCoveringFloor = null;
    const floor = number(floorValue);
    tiers.forEach((tier) => {
      // "sin-clasificar": velocidad desconocida. "bloqueada": velocidad conocida y es cero. Ninguna
      // de las dos cuenta para cubrir el colchón.
      if (tier.tier === "sin-clasificar" || tier.tier === "bloqueada") return;
      cumulative = round2(cumulative + tier.value);
      if (tierCoveringFloor === null && floor > 0 && cumulative >= floor) tierCoveringFloor = tier.tier;
    });
    return {
      schemaId: LIQUIDITY_LADDER_SCHEMA_ID,
      tiers,
      floorValue: round2(floor),
      floorCoveredBy: tierCoveringFloor,
      floorCovered: tierCoveringFloor !== null,
    };
  }

  // INV8 (Oleada 3, Bloque 5): seguimiento de plan de aportación periódica (DCA) — IVX7 (arriba)
  // ya muestra el coste medio hacia atrás; esto mira hacia delante. Reutiliza `contributions`
  // (IV2) y `acquisitionDate`/`initialCost` (ya normalizados) para saber cuánto se ha aportado de
  // verdad desde que empezó el plan, sin duplicar ese dato en un registro aparte.
  function dcaMonthsElapsed(startIso, endIso) {
    const start = new Date(`${startIso}T00:00:00Z`);
    const end = new Date(`${endIso}T00:00:00Z`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return 0;
    const months = (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + (end.getUTCMonth() - start.getUTCMonth());
    return Math.max(0, months) + 1; // el propio mes de inicio ya cuenta como un periodo cumplido
  }

  const DCA_PLAN_SCHEMA_ID = "finanzas-casa-portfolio-dca-plan-status";

  function dcaPlanStatus(position = {}, asOf = "") {
    const plan = position.dcaPlan || {};
    const monthlyAmount = number(plan.monthlyAmount);
    const startDate = asOfDate(plan.startDate);
    if (!(monthlyAmount > 0) || !startDate || !asOf) {
      return { schemaId: DCA_PLAN_SCHEMA_ID, calculable: false };
    }
    const monthsElapsed = dcaMonthsElapsed(startDate, asOf);
    const plannedCumulative = round2(monthsElapsed * monthlyAmount);
    const sinceStart = [];
    if (position.acquisitionDate && position.acquisitionDate >= startDate) sinceStart.push(number(position.initialCost));
    (Array.isArray(position.contributions) ? position.contributions : []).forEach((contribution) => {
      if (contribution.date >= startDate && contribution.date <= asOf) sinceStart.push(number(contribution.amount));
    });
    const actualCumulative = round2(sinceStart.reduce((sum, amount) => sum + amount, 0));
    const delay = round2(plannedCumulative - actualCumulative);
    return {
      schemaId: DCA_PLAN_SCHEMA_ID,
      calculable: true,
      monthsElapsed,
      plannedCumulative,
      actualCumulative,
      delay,
      behindSchedule: delay > 0,
      delayMonths: delay > 0 ? round2(delay / monthlyAmount) : 0,
    };
  }

  // INV16 (Oleada 4, Bloque 4): correlación cualitativa entre clases de activo, DECLARADA por el
  // hogar — el código ya descarta correlación cuantitativa real en INV1/IVX6 (arriba) por falta de
  // un histórico de valoraciones que esta app no guarda; calcularla igualmente sería falsa
  // precisión, no una mejora. Alcance confirmado por el hogar (sesión 171): declarada y editable,
  // nunca una tabla fija de mercado con valores por defecto. Sin correlación declarada para un par,
  // ese par queda fuera del todo — nunca se le asume "media" ni ningún otro valor. Solo avisa de
  // concentración cuando dos clases con correlación "alta" declarada pesan de verdad en la cartera
  // real (ambas con valor > 0) — nunca decide ni bloquea nada, mismo criterio que el resto de
  // avisos de concentración de este módulo (IVX8, `mismatch` de assetClassVsGlidePath).
  const ASSET_CLASS_CORRELATION_LEVELS = Object.freeze(["alta", "media", "baja", "negativa"]);
  const CONCENTRATION_DOMINANT_THRESHOLD_PCT = 50; // mismo umbral que assetClassVsGlidePath (arriba)
  const INV16_SCHEMA_ID = "finance-inv16-asset-class-correlation/v1";

  function assetClassCorrelationPairKey(classA, classB) {
    return [classA, classB].sort().join("|");
  }

  function assetClassCorrelationPairs() {
    const pairs = [];
    for (let i = 0; i < ASSET_CLASS_TYPES.length; i += 1) {
      for (let j = i + 1; j < ASSET_CLASS_TYPES.length; j += 1) {
        const classA = ASSET_CLASS_TYPES[i];
        const classB = ASSET_CLASS_TYPES[j];
        pairs.push({ classA, classB, key: assetClassCorrelationPairKey(classA, classB) });
      }
    }
    return pairs;
  }

  function qualitativeConcentrationWarnings({ positions = [], correlationDeclarations = {} } = {}) {
    const list = Array.isArray(positions) ? positions : [];
    const totalValue = round2(list.reduce((sum, position) => sum + Math.max(0, number(position?.currentValue)), 0));
    if (!(totalValue > 0)) return { schemaId: INV16_SCHEMA_ID, calculable: false };
    const byClass = {};
    list.forEach((position) => {
      const value = Math.max(0, number(position?.currentValue));
      const assetClass = ASSET_CLASS_TYPES.includes(position?.assetClass) ? position.assetClass : null;
      if (!assetClass || value <= 0) return; // sin clasificar queda fuera, nunca un reparto asumido
      byClass[assetClass] = round2((byClass[assetClass] || 0) + value);
    });
    const declared = correlationDeclarations && typeof correlationDeclarations === "object" ? correlationDeclarations : {};
    const pairs = assetClassCorrelationPairs();
    const warnings = pairs
      .map((pair) => ({ ...pair, level: ASSET_CLASS_CORRELATION_LEVELS.includes(declared[pair.key]) ? declared[pair.key] : null }))
      .filter((pair) => pair.level === "alta" && number(byClass[pair.classA]) > 0 && number(byClass[pair.classB]) > 0)
      .map((pair) => {
        const combinedValue = round2(number(byClass[pair.classA]) + number(byClass[pair.classB]));
        const combinedPct = Math.round((combinedValue / totalValue) * 100);
        return {
          classA: pair.classA,
          classB: pair.classB,
          classAPct: Math.round((number(byClass[pair.classA]) / totalValue) * 100),
          classBPct: Math.round((number(byClass[pair.classB]) / totalValue) * 100),
          combinedPct,
          dominant: combinedPct >= CONCENTRATION_DOMINANT_THRESHOLD_PCT,
        };
      })
      .sort((a, b) => b.combinedPct - a.combinedPct);
    return {
      schemaId: INV16_SCHEMA_ID,
      calculable: true,
      totalValue,
      declaredPairs: pairs.filter((pair) => ASSET_CLASS_CORRELATION_LEVELS.includes(declared[pair.key])).length,
      totalPairs: pairs.length,
      warnings,
    };
  }

  // INV14 (Oleada 4, Bloque 4): exposición por divisa y geografía, DECLARADA por el hogar — mismo
  // criterio que INV1 (clase de activo) e INV16 (correlación): esta app no trae ningún dato de
  // mercado sobre la divisa o geografía real de un fondo/ETF (dependería de su cartera subyacente,
  // que cambia sin avisar), así que se pregunta directamente. Sin declarar, la posición cuenta como
  // "sin-declarar" en cada dimensión — nunca se asume EUR/España por defecto solo porque el hogar
  // viva ahí.
  const GEOGRAPHY_REGIONS = Object.freeze(["espana", "zona-euro", "europa-no-euro", "estados-unidos", "mercados-emergentes", "global", "otro"]);
  const EXPOSURE_UNDECLARED = "sin-declarar";
  const EXPOSURE_DOMINANT_THRESHOLD_PCT = 50; // mismo umbral que el resto de avisos de concentración (INV16/IVX8)
  const CURRENCY_GEOGRAPHY_SCHEMA_ID = "finance-inv14-currency-geography-exposure/v1";

  function currencyGeographyExposure(positions = []) {
    const list = Array.isArray(positions) ? positions : [];
    const totalValue = round2(list.reduce((sum, position) => sum + Math.max(0, number(position?.currentValue)), 0));
    if (!(totalValue > 0)) return { schemaId: CURRENCY_GEOGRAPHY_SCHEMA_ID, calculable: false };
    const byCurrency = {};
    const byRegion = {};
    list.forEach((position) => {
      const value = Math.max(0, number(position?.currentValue));
      if (value <= 0) return;
      const currency = known(position?.currency) ? String(position.currency).trim().toLocaleUpperCase("es") : EXPOSURE_UNDECLARED;
      byCurrency[currency] = round2((byCurrency[currency] || 0) + value);
      const region = GEOGRAPHY_REGIONS.includes(position?.region) ? position.region : EXPOSURE_UNDECLARED;
      byRegion[region] = round2((byRegion[region] || 0) + value);
    });
    const toRows = (map) => Object.entries(map)
      .map(([key, value]) => ({ key, value, pct: Math.round((value / totalValue) * 100) }))
      .sort((a, b) => b.value - a.value);
    const currencyRows = toRows(byCurrency);
    const regionRows = toRows(byRegion);
    const dominantOf = (rows) => rows.find((row) => row.key !== EXPOSURE_UNDECLARED && row.pct >= EXPOSURE_DOMINANT_THRESHOLD_PCT) || null;
    return {
      schemaId: CURRENCY_GEOGRAPHY_SCHEMA_ID,
      calculable: true,
      totalValue,
      currencyRows,
      regionRows,
      dominantCurrency: dominantOf(currencyRows),
      dominantRegion: dominantOf(regionRows),
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
    latentLossHarvestingCandidates,
    liquidityLadder,
    dcaPlanStatus,
    rebalanceSuggestions,
    REBALANCE_CALENDAR_REVIEW_SCHEMA_ID,
    REBALANCE_CALENDAR_REVIEW_DEFAULT_MONTHS,
    rebalanceCalendarReviewStatus,
    deleveragingPriority,
    isFundToFundTransfer,
    applyFundTransfer,
    xirr,
    YEAR_END_COMPENSATION_SCHEMA_ID,
    LOSS_CARRYFORWARD_YEARS,
    yearEndCompensation,
    fifoLedger,
    opportunityCost,
    BENCHMARK_COMPARISON_SCHEMA_ID,
    compareAgainstBenchmark,
    GLIDE_PATH_SCHEMA_ID,
    GLIDE_PATH_BANDS,
    glidePathBand,
    linkedPositionsForGoal,
    glidePathForGoal,
    ASSET_CLASS_TYPES,
    ASSET_CLASS_RISK_PROFILE,
    assetClassVsGlidePath,
    FEE_COST_SCHEMA_ID,
    compoundedFeeCost,
    TOTAL_COST_OF_OWNERSHIP_SCHEMA_ID,
    totalCostOfOwnership,
    FEE_COST_TRAJECTORY_SCHEMA_ID,
    FEE_COST_TRAJECTORY_DEFAULT_YEARS,
    portfolioFeeCostTrajectory,
    ASSET_CLASS_CORRELATION_LEVELS,
    assetClassCorrelationPairKey,
    assetClassCorrelationPairs,
    qualitativeConcentrationWarnings,
    GEOGRAPHY_REGIONS,
    currencyGeographyExposure,
  };
});
