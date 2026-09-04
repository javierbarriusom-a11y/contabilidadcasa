(function attachCanonicalIrpfEstimator(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalIrpfEstimator = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function canonicalIrpfEstimatorFactory() {
  "use strict";

  // A15-2 — estimador de resultado de IRPF (a devolver o a pagar), depende de A15-1 (registro de
  // supuestos fiscales, ya construido) y reutiliza el mismo estándar que A2-3
  // (canonical-e7-analysis.js): resultado como rango, fecha de referencia, aviso de que no
  // sustituye asesoría fiscal, fuente citada.
  //
  // Este motor NUNCA trae tramos de IRPF de fábrica — ni la escala general estatal ni la
  // autonómica de ninguna comunidad. Los tramos cambian cada año y por comunidad autónoma; A15-5
  // (canonical-tax-tables.js) ya advertía "ninguna cifra fiscal se fabrica aquí", y este motor
  // sigue el mismo criterio: sin una escala registrada por el hogar, con su fuente y fecha,
  // no hay ningún resultado que calcular — nunca un número con apariencia de correcto construido
  // sobre un tramo inventado o desactualizado.
  //
  // La base imponible se declara como un rango (mín-máx), no como una única cifra: ningún cálculo
  // de este motor conoce la base liquidable real del hogar (eso exigiría reproducir todo el
  // cálculo de rendimientos netos, reducciones y mínimos personales, fuera de alcance). El rango
  // de salida refleja honestamente esa incertidumbre de entrada, no un margen inventado.

  const SCHEMA_ID = "finance-a15-2-irpf-estimator/v1";
  const PROFESSIONAL_WARNING = "Estimación orientativa: confirma el resultado con un profesional o con el simulador oficial de la Agencia Tributaria antes de decidir.";

  function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  function round2(value) {
    return Math.round((number(value) + Number.EPSILON) * 100) / 100;
  }
  function text(value) {
    return String(value ?? "").trim();
  }

  // Una fuente incompleta (sin título, autoridad, URL https o fecha de comprobación AAAA-MM-DD)
  // nunca se acepta como "verificada" — mismo criterio de completitud que A2-3.
  function hasCompleteSource(source) {
    const candidate = source || {};
    return Boolean(
      text(candidate.title) &&
      text(candidate.authority) &&
      /^https:\/\//.test(text(candidate.url)) &&
      /^\d{4}-\d{2}-\d{2}$/.test(text(candidate.checkedAt)),
    );
  }

  // Un tramo válido: importes de límite estrictamente crecientes, el último sin límite superior
  // (tramo abierto), tipos entre 0 y 100. Cualquier desviación invalida la escala entera — nunca
  // se calcula con una escala a medias.
  function validateBracketScale(scale = {}) {
    const issues = [];
    const brackets = Array.isArray(scale.brackets) ? scale.brackets : [];
    if (!brackets.length) issues.push("sin-tramos");
    brackets.forEach((bracket, index) => {
      const rate = Number(bracket?.rate);
      if (!Number.isFinite(rate) || rate < 0 || rate > 100) issues.push(`tipo-invalido-tramo-${index + 1}`);
      const isLast = index === brackets.length - 1;
      if (isLast) {
        if (bracket?.limit !== null) issues.push("ultimo-tramo-debe-quedar-abierto");
      } else {
        const limit = Number(bracket?.limit);
        if (!Number.isFinite(limit) || limit <= 0) issues.push(`limite-invalido-tramo-${index + 1}`);
        const previous = index > 0 ? Number(brackets[index - 1]?.limit) : 0;
        if (Number.isFinite(limit) && Number.isFinite(previous) && limit <= previous) issues.push(`limites-no-crecientes-tramo-${index + 1}`);
      }
    });
    if (!hasCompleteSource(scale.source)) issues.push("fuente-incompleta");
    return { valid: issues.length === 0, issues };
  }

  // Cuota íntegra por tramos (progresiva): solo la porción de base que cae dentro de cada tramo
  // tributa a su tipo — nunca el tipo marginal aplicado a toda la base.
  function progressiveTax(taxableBase, brackets) {
    const base = Math.max(0, number(taxableBase));
    let tax = 0;
    let previousLimit = 0;
    for (const bracket of brackets) {
      const upper = bracket.limit === null ? Infinity : number(bracket.limit);
      if (base <= previousLimit) break;
      const portion = Math.min(base, upper) - previousLimit;
      if (portion > 0) tax += portion * (number(bracket.rate) / 100);
      previousLimit = upper;
    }
    return round2(tax);
  }

  function scaleCitation(scale) {
    return { id: text(scale.id), region: text(scale.region), year: scale.year ?? null, source: scale.source || null };
  }

  // Estima el resultado (a devolver si es positivo, a pagar si es negativo) a partir de un rango
  // de base imponible declarado por el hogar — nunca una única cifra que finja una precisión que
  // el resto de la app no puede respaldar. Sin las dos escalas (estatal + autonómica) registradas
  // y con fuente completa, no hay resultado que calcular: calculable queda en false, con el motivo
  // exacto, nunca un 0 o un rango inventado.
  function estimateIrpfResult({ taxableBaseRange, withholdingsPaid, stateScale, regionalScale, year } = {}) {
    const low = Math.max(0, number(taxableBaseRange?.low));
    const high = Math.max(low, number(taxableBaseRange?.high, low));
    const withholdings = Math.max(0, number(withholdingsPaid));
    const stateCheck = validateBracketScale(stateScale || {});
    const regionalCheck = validateBracketScale(regionalScale || {});
    if (!stateCheck.valid || !regionalCheck.valid) {
      return {
        schemaId: SCHEMA_ID,
        calculable: false,
        reason: "missing-brackets",
        issues: { state: stateCheck.issues, regional: regionalCheck.issues },
        warning: PROFESSIONAL_WARNING,
      };
    }
    const quotaAt = (base) => round2(progressiveTax(base, stateScale.brackets) + progressiveTax(base, regionalScale.brackets));
    const quotaAtLow = quotaAt(low);
    const quotaAtHigh = quotaAt(high);
    // A más base imponible, más cuota y por tanto menos a devolver (o más a pagar): el resultado
    // en el extremo alto de base es el extremo bajo de resultado, y viceversa.
    const resultAtLow = round2(withholdings - quotaAtLow);
    const resultAtHigh = round2(withholdings - quotaAtHigh);
    const range = { low: Math.min(resultAtLow, resultAtHigh), high: Math.max(resultAtLow, resultAtHigh) };
    const midpoint = round2((range.low + range.high) / 2);
    return {
      schemaId: SCHEMA_ID,
      calculable: true,
      year: year ?? stateScale.year ?? null,
      generatedAt: new Date().toISOString(),
      taxableBaseRange: { low, high },
      withholdingsPaid: withholdings,
      quotaRange: { low: Math.min(quotaAtLow, quotaAtHigh), high: Math.max(quotaAtLow, quotaAtHigh) },
      resultRange: range,
      direction: midpoint > 0 ? "refund" : midpoint < 0 ? "payment" : "neutral",
      sources: [scaleCitation(stateScale), scaleCitation(regionalScale)],
      warning: PROFESSIONAL_WARNING,
    };
  }

  // Entrada en texto plano "límite:tipo, límite:tipo, ..." con el último tramo sin límite
  // ("35200:37, 60000:45, :47") — evita construir un editor de filas dinámicas para un primer
  // registro de tramos; se valida igual que cualquier otra fuente antes de poder calcular nada.
  function parseBracketScaleInput(raw = "") {
    const parts = text(raw).split(",").map((part) => part.trim()).filter(Boolean);
    if (!parts.length) return null;
    const brackets = parts.map((part) => {
      const [limitRaw, rateRaw] = part.split(":").map((piece) => piece.trim());
      const limitText = limitRaw ?? "";
      const limit = limitText === "" ? null : Number(limitText);
      return { limit, rate: Number(rateRaw) };
    });
    return brackets;
  }

  // FC5: venta parcial optimizando el tramo del ahorro. Depende de IV2 y reutiliza tal cual
  // validateBracketScale/progressiveTax — mismo motor que A15-2, sin escala nueva que inventar: el
  // hogar registra la escala del tramo del ahorro con la misma tarjeta de escalas de IRPF (un
  // `kind` más, "savings"). Dado lo que ya se ha realizado este año (la base del ahorro ya generada,
  // por ejemplo el resultado de FC3) y la plusvalía de una venta que se está valorando, dice cuánto
  // de esa plusvalía cabe todavía en el tramo actual antes de saltar al siguiente, y el coste
  // marginal de vender el excedente ahora. Nunca decide por el hogar — la venta sigue siendo suya.
  function bracketFor(brackets, base) {
    let previousLimit = 0;
    for (const bracket of brackets) {
      const upper = bracket.limit === null ? Infinity : number(bracket.limit);
      if (base < upper) return { bracket, previousLimit, upper };
      previousLimit = upper;
    }
    return { bracket: brackets[brackets.length - 1], previousLimit, upper: Infinity };
  }

  function optimizePartialSale({ scale, alreadyRealizedGain, proposedGain } = {}) {
    const check = validateBracketScale(scale || {});
    if (!check.valid) {
      return { schemaId: SCHEMA_ID, calculable: false, reason: "missing-scale", issues: check.issues, warning: PROFESSIONAL_WARNING };
    }
    const gain = Math.max(0, number(proposedGain));
    if (gain <= 0) {
      return { schemaId: SCHEMA_ID, calculable: false, reason: "missing-gain", warning: PROFESSIONAL_WARNING };
    }
    const base = Math.max(0, number(alreadyRealizedGain));
    const { bracket: currentBracket, upper } = bracketFor(scale.brackets, base);
    const roomInCurrentBracket = upper === Infinity ? null : round2(Math.max(0, upper - base));
    const withinBracket = roomInCurrentBracket === null || gain <= roomInCurrentBracket;
    const suggestedAmountWithinBracket = roomInCurrentBracket === null ? gain : round2(Math.min(gain, roomInCurrentBracket));
    const excessOverBracket = round2(Math.max(0, gain - suggestedAmountWithinBracket));
    const taxBefore = progressiveTax(base, scale.brackets);
    const taxAfter = progressiveTax(round2(base + gain), scale.brackets);
    return {
      schemaId: SCHEMA_ID,
      calculable: true,
      alreadyRealizedGain: base,
      proposedGain: gain,
      currentBracketRatePct: round2(number(currentBracket.rate)),
      roomInCurrentBracket,
      withinBracket,
      suggestedAmountWithinBracket,
      excessOverBracket,
      marginalTax: round2(taxAfter - taxBefore),
      warning: PROFESSIONAL_WARNING,
    };
  }

  // FCX1: coste marginal de sumar un importe (p. ej. un rescate de pensiones en forma de capital)
  // a la renta general ya prevista del año — mismo principio que optimizePartialSale (coste
  // marginal por tramos), pero sobre la escala general (estatal + autonómica) en vez de la del
  // ahorro, y sin partir de una plusvalía ya realizada sino de la renta general estimada del hogar.
  // Sin las dos escalas registradas con fuente completa, no hay tramo real que aplicar — se informa
  // así, nunca con un tipo marginal inventado.
  function marginalTaxOnAdditionalIncome({ amount, currentAnnualIncome, stateScale, regionalScale } = {}) {
    const additional = Math.max(0, round2(amount));
    if (!(additional > 0)) return { schemaId: SCHEMA_ID, calculable: false, reason: "missing-amount", warning: PROFESSIONAL_WARNING };
    const stateCheck = validateBracketScale(stateScale || {});
    const regionalCheck = validateBracketScale(regionalScale || {});
    if (!stateCheck.valid || !regionalCheck.valid) {
      return { schemaId: SCHEMA_ID, calculable: false, reason: "missing-brackets", issues: { state: stateCheck.issues, regional: regionalCheck.issues }, warning: PROFESSIONAL_WARNING };
    }
    const base = Math.max(0, number(currentAnnualIncome));
    const combinedTax = (value) => round2(progressiveTax(value, stateScale.brackets) + progressiveTax(value, regionalScale.brackets));
    const marginalTax = round2(combinedTax(round2(base + additional)) - combinedTax(base));
    return {
      schemaId: SCHEMA_ID,
      calculable: true,
      amount: additional,
      currentAnnualIncome: base,
      marginalTax,
      netAmount: round2(additional - marginalTax),
      effectiveRatePct: additional > 0 ? round2((marginalTax / additional) * 100) : 0,
      sources: [scaleCitation(stateScale), scaleCitation(regionalScale)],
      warning: PROFESSIONAL_WARNING,
    };
  }

  return {
    SCHEMA_ID,
    PROFESSIONAL_WARNING,
    hasCompleteSource,
    validateBracketScale,
    progressiveTax,
    estimateIrpfResult,
    parseBracketScaleInput,
    optimizePartialSale,
    marginalTaxOnAdditionalIncome,
  };
});
