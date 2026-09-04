(function initDebtComparator(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceDebtComparator = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function debtComparatorFactory() {
  "use strict";

  const SCHEMA_ID = "finance.debt-comparison";
  const SCHEMA_VERSION = 1;
  const STRATEGIES = Object.freeze({
    NO_ACTION: "no-action",
    SINGLE: "single-payment",
    INSTALLMENTS: "installments",
    REFINANCE: "refinance",
    RESUME: "resume",
  });

  function finite(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function round2(value) {
    return Math.round((finite(value) + Number.EPSILON) * 100) / 100;
  }

  function distributeCents(total, duration) {
    const months = Math.max(1, Math.floor(finite(duration, 1)));
    const cents = Math.round(round2(total) * 100);
    const sign = cents < 0 ? -1 : 1;
    const absolute = Math.abs(cents);
    const base = Math.floor(absolute / months);
    const remainder = absolute - base * months;
    return Array.from({ length: months }, (_, index) => sign * (base + (index < remainder ? 1 : 0)) / 100);
  }

  function strategyLabel(strategy) {
    if (strategy === STRATEGIES.SINGLE) return "Pago único";
    if (strategy === STRATEGIES.INSTALLMENTS) return "Pago fraccionado";
    if (strategy === STRATEGIES.REFINANCE) return "Reunificación";
    if (strategy === STRATEGIES.RESUME) return "Retomar pagos";
    return "No actuar";
  }

  function normalizeAlternative(input, reserve) {
    const strategy = Object.values(STRATEGIES).includes(input?.strategy) ? input.strategy : STRATEGIES.NO_ACTION;
    const minChecking = round2(input?.minChecking);
    const isReference = strategy === STRATEGIES.NO_ACTION;
    const reserveSafe = Number.isFinite(Number(input?.minChecking)) && minChecking >= reserve;
    return {
      id: String(input?.id || strategy),
      strategy,
      label: String(input?.label || strategyLabel(strategy)),
      detail: String(input?.detail || ""),
      startIndex: Math.max(0, Math.floor(finite(input?.startIndex))),
      startLabel: String(input?.startLabel || "-"),
      duration: Math.max(0, Math.floor(finite(input?.duration))),
      closeIndex: input?.closeIndex === null || input?.closeIndex === undefined
        ? null
        : Math.max(0, Math.floor(finite(input.closeIndex))),
      closeLabel: String(input?.closeLabel || "-"),
      monthlyPayment: round2(input?.monthlyPayment),
      totalCost: round2(input?.totalCost),
      remainingDebt: Math.max(0, round2(input?.remainingDebt)),
      minChecking,
      minLiquidity: round2(input?.minLiquidity),
      finalLiquidityImpact: round2(input?.finalLiquidityImpact),
      reserve,
      reserveMargin: round2(minChecking - reserve),
      reserveSafe,
      feasible: reserveSafe,
      isReference,
      payload: input?.payload || null,
    };
  }

  function compareActionAlternatives(left, right) {
    if (left.reserveSafe !== right.reserveSafe) return left.reserveSafe ? -1 : 1;
    if (left.remainingDebt !== right.remainingDebt) return left.remainingDebt - right.remainingDebt;
    if (left.totalCost !== right.totalCost) return left.totalCost - right.totalCost;
    const leftClose = left.closeIndex === null ? Number.POSITIVE_INFINITY : left.closeIndex;
    const rightClose = right.closeIndex === null ? Number.POSITIVE_INFINITY : right.closeIndex;
    if (leftClose !== rightClose) return leftClose - rightClose;
    if (left.minChecking !== right.minChecking) return right.minChecking - left.minChecking;
    return left.id.localeCompare(right.id);
  }

  function recommendationReason(recommended, reference) {
    if (!recommended || recommended.isReference) {
      return "No se recomienda comprometer caja ahora: ninguna alternativa respeta la reserva operativa configurada.";
    }
    const debtText = recommended.remainingDebt === 0
      ? "deja la deuda cerrada"
      : `deja ${recommended.remainingDebt.toFixed(2)} de deuda`;
    const reserveText = `mantiene ${recommended.reserveMargin.toFixed(2)} sobre la reserva`;
    const impact = reference ? round2(recommended.finalLiquidityImpact - reference.finalLiquidityImpact) : recommended.finalLiquidityImpact;
    return `${recommended.label} es la primera opción viable: ${debtText}, ${reserveText} e impacta ${impact >= 0 ? "+" : ""}${impact.toFixed(2)} en la liquidez final frente a no actuar.`;
  }

  function compareAgreements({ contractId = "", principal = 0, reserve = 0, alternatives = [] } = {}) {
    const safeReserve = Math.max(0, round2(reserve));
    const normalized = alternatives.map((item) => normalizeAlternative(item, safeReserve));
    let reference = normalized.find((item) => item.isReference) || null;
    if (!reference) {
      reference = normalizeAlternative({
        id: "no-action",
        strategy: STRATEGIES.NO_ACTION,
        label: "No actuar",
        remainingDebt: principal,
        minChecking: safeReserve,
      }, safeReserve);
      normalized.unshift(reference);
    }
    const actions = normalized.filter((item) => !item.isReference).sort(compareActionAlternatives);
    const viable = actions.filter((item) => item.reserveSafe);
    const recommended = viable[0] || reference;
    return {
      schema: SCHEMA_ID,
      version: SCHEMA_VERSION,
      contractId: String(contractId || ""),
      principal: Math.max(0, round2(principal)),
      reserve: safeReserve,
      reference,
      alternatives: [reference, ...actions],
      recommendedId: recommended.id,
      recommended,
      reason: recommendationReason(recommended, reference),
      viableCount: viable.length,
    };
  }

  const AMORTIZE_VS_INVEST_SCHEMA_ID = "finance.amortize-vs-invest";

  // AP1: comparador amortizar vs. invertir. Depende de IV1/IV2 (canonical-portfolio.js) e IV5, que
  // habilita esta tarea a propósito: el lado de "invertir" es exactamente
  // FinanceCanonicalPortfolio.opportunityCost() ya calculado — quien llama lo pasa resuelto
  // (`investmentResult`), mismo patrón de composición que AP3 con el guardarraíl de AP4. Este motor
  // no reimplementa esa cuenta ni inventa ninguna cifra de mercado: el tipo de la deuda
  // (`debtAnnualRatePct`) lo declara el hogar, igual que AP3 con el tipo de la deuda nueva. Nunca
  // decide por el hogar — da los dos números y una lectura que se puede aceptar o descartar.
  function knownFinite(value) {
    return typeof value === "number" && Number.isFinite(value);
  }

  function compareAmortizeVsInvest({ amount = 0, months = 0, debtAnnualRatePct = null, remainingPrincipal = null, investmentResult = null } = {}) {
    const cashAmount = Math.max(0, round2(amount));
    const horizonMonths = Math.max(0, Math.floor(finite(months)));
    // `Number(null)` es 0, así que un TIN o un principal pendiente ausentes (null/undefined) no
    // pueden pasar por `Number()` directamente sin colarse como un 0 asumido — se exige un número
    // real de partida, mismo criterio que opportunityCost (IV5).
    const debtRate = knownFinite(debtAnnualRatePct) ? debtAnnualRatePct : NaN;
    if (cashAmount <= 0 || horizonMonths <= 0 || !Number.isFinite(debtRate)) {
      return { schema: AMORTIZE_VS_INVEST_SCHEMA_ID, calculable: false };
    }
    const cappedAmount = knownFinite(remainingPrincipal)
      ? Math.min(cashAmount, Math.max(0, round2(remainingPrincipal)))
      : cashAmount;
    const years = horizonMonths / 12;
    const amortizeSavings = round2(cappedAmount * (debtRate / 100) * years);
    const investCalculable = Boolean(investmentResult && investmentResult.calculable);
    const investGain = investCalculable ? round2(investmentResult.gain) : null;
    const assessment = !investCalculable
      ? "invertir-no-calculable"
      : investGain > amortizeSavings ? "invertir" : investGain < amortizeSavings ? "amortizar" : "neutral";
    return {
      schema: AMORTIZE_VS_INVEST_SCHEMA_ID,
      calculable: true,
      amount: cappedAmount,
      months: horizonMonths,
      debtAnnualRatePct: round2(debtRate),
      amortizeSavings,
      investGain,
      assessment,
    };
  }

  const BREAK_EVEN_SCHEMA_ID = "finance.amortize-vs-invest-break-even";

  // AP2: punto de equilibrio entre el TIN de una deuda y la rentabilidad de inversión esperada.
  // Depende de IV2 y usa exactamente las mismas dos fórmulas que compareAmortizeVsInvest (AP1):
  // interés simple sobre la deuda amortizada, compuesto sobre la inversión. El importe se cancela
  // en ambos lados de la ecuación — no hace falta declararlo para saber a qué rentabilidad de
  // inversión el resultado sería neutral (ni amortizar ni invertir gana). Nunca inventa el TIN ni
  // el horizonte: ambos los declara el hogar, igual que en AP1.
  function breakEvenInvestmentRatePct(debtAnnualRatePct, months) {
    const debtRate = knownFinite(debtAnnualRatePct) ? debtAnnualRatePct : NaN;
    const horizonMonths = Math.max(0, Math.floor(finite(months)));
    if (!Number.isFinite(debtRate) || horizonMonths <= 0) {
      return { schema: BREAK_EVEN_SCHEMA_ID, calculable: false };
    }
    const years = horizonMonths / 12;
    // (1 + r/100)^years - 1 = (debtRate/100) × years  →  despeja r.
    const breakEvenPct = round2(100 * (Math.pow(1 + (debtRate / 100) * years, 1 / years) - 1));
    return {
      schema: BREAK_EVEN_SCHEMA_ID,
      calculable: true,
      debtAnnualRatePct: round2(debtRate),
      months: horizonMonths,
      breakEvenAnnualReturnPct: breakEvenPct,
    };
  }

  const REDUCE_QUOTA_VS_TERM_SCHEMA_ID = "finance.amortize-reduce-quota-vs-term";

  // Cuota francesa estándar — misma fórmula que canonical-mortgage-rate-scenarios.js (DI1),
  // duplicada aquí a propósito en vez de importada: mismo criterio de autonomía que ya sigue el
  // resto de motores canónicos de este repo (ver DI5 sobre por qué no comparten módulo).
  function amortizedMonthlyPayment(principal, annualRatePct, months) {
    const p = Math.max(0, round2(finite(principal)));
    const n = Math.max(1, Math.round(finite(months)));
    const monthlyRate = finite(annualRatePct) / 100 / 12;
    if (p <= 0) return 0;
    if (monthlyRate === 0) return round2(p / n);
    const factor = Math.pow(1 + monthlyRate, n);
    return round2((p * monthlyRate * factor) / (factor - 1));
  }

  // APX6: amortizar reduciendo cuota (misma duración, cuota más baja) frente a reduciendo plazo
  // (misma cuota, menos meses) — dos formas reales de aplicar el mismo importe extra que
  // compareAmortizeVsInvest (AP1) no distingue: esa función solo estima el ahorro total con interés
  // simple, nunca recalcula la cuota ni el plazo nuevos con la fórmula de amortización real.
  // "Reducir plazo" despeja n de la fórmula de anualidad (n = -ln(1 - r·P/M) / ln(1+r)): cuántos
  // meses hacen falta para pagar el principal restante manteniendo la cuota actual.
  function amortizeReduceQuotaVsTerm({ principal = 0, annualRatePct = null, months = 0, lumpSum = 0 } = {}) {
    const p = Math.max(0, round2(finite(principal)));
    const n = Math.max(1, Math.round(finite(months)));
    const rate = knownFinite(annualRatePct) ? annualRatePct : NaN;
    const extra = Math.max(0, round2(finite(lumpSum)));
    if (p <= 0 || n <= 0 || !Number.isFinite(rate) || extra <= 0 || extra >= p) {
      return { schema: REDUCE_QUOTA_VS_TERM_SCHEMA_ID, calculable: false };
    }
    const remainingPrincipal = round2(p - extra);
    const currentPayment = amortizedMonthlyPayment(p, rate, n);
    const monthlyRate = rate / 100 / 12;
    const reducedPayment = amortizedMonthlyPayment(remainingPrincipal, rate, n);
    // Si la cuota actual no llegaría ni a cubrir el interés del principal restante, no se puede
    // despejar un plazo más corto — se queda en el plazo actual (hueco, no un número inventado).
    const reducedMonths = monthlyRate === 0
      ? Math.max(1, Math.ceil(remainingPrincipal / currentPayment))
      : currentPayment > remainingPrincipal * monthlyRate
        ? Math.max(1, Math.ceil(-Math.log(1 - (remainingPrincipal * monthlyRate) / currentPayment) / Math.log(1 + monthlyRate)))
        : n;
    const currentTotalCost = round2(currentPayment * n);
    const reduceQuotaTotalCost = round2(reducedPayment * n);
    const reduceTermTotalCost = round2(currentPayment * reducedMonths);
    return {
      schema: REDUCE_QUOTA_VS_TERM_SCHEMA_ID,
      calculable: true,
      principal: p,
      remainingPrincipal,
      months: n,
      annualRatePct: round2(rate),
      lumpSum: extra,
      currentPayment,
      currentTotalCost,
      reduceQuota: { newPayment: reducedPayment, paymentReduction: round2(currentPayment - reducedPayment), months: n, totalCost: reduceQuotaTotalCost, interestSaved: round2(currentTotalCost - reduceQuotaTotalCost) },
      reduceTerm: { payment: currentPayment, newMonths: reducedMonths, monthsReduced: Math.max(0, n - reducedMonths), totalCost: reduceTermTotalCost, interestSaved: round2(currentTotalCost - reduceTermTotalCost) },
    };
  }

  const NET_DEBT_COST_SCHEMA_ID = "finance.net-debt-cost-after-tax";

  // APX1: el punto de equilibrio de AP2 (breakEvenInvestmentRatePct) asume implícitamente una
  // rentabilidad de inversión libre de impuestos — nunca lo fue de verdad. El interés de la deuda
  // del hogar no es deducible (deuda personal, no de una actividad económica ni un alquiler
  // declarado), pero la plusvalía de invertir sí tributa al tipo del ahorro. Así que el rendimiento
  // PREVIO a impuestos que hace falta para igualar de verdad el coste de la deuda es mayor que el
  // punto de equilibrio nominal: hay que "elevarlo" para compensar el mordisco fiscal a la salida.
  // Reutiliza el mismo tipo del ahorro que declara el hogar en FC4 (dividendSpanishSavingsRatePct) —
  // ni un tramo de IRPF inventado ni un segundo campo duplicado para el mismo dato.
  function netDebtCostAfterTax(breakEven, savingsTaxRatePct) {
    if (!breakEven || !breakEven.calculable) return { schema: NET_DEBT_COST_SCHEMA_ID, calculable: false };
    const rate = finite(savingsTaxRatePct);
    if (!(rate > 0) || rate >= 100) return { schema: NET_DEBT_COST_SCHEMA_ID, calculable: false };
    const requiredPretaxReturnPct = round2(breakEven.breakEvenAnnualReturnPct / (1 - rate / 100));
    return {
      schema: NET_DEBT_COST_SCHEMA_ID,
      calculable: true,
      breakEvenAnnualReturnPct: breakEven.breakEvenAnnualReturnPct,
      savingsTaxRatePct: round2(rate),
      requiredPretaxReturnPct,
    };
  }

  return {
    SCHEMA_ID,
    SCHEMA_VERSION,
    STRATEGIES,
    distributeCents,
    strategyLabel,
    normalizeAlternative,
    compareActionAlternatives,
    BREAK_EVEN_SCHEMA_ID,
    breakEvenInvestmentRatePct,
    compareAgreements,
    AMORTIZE_VS_INVEST_SCHEMA_ID,
    compareAmortizeVsInvest,
    REDUCE_QUOTA_VS_TERM_SCHEMA_ID,
    amortizeReduceQuotaVsTerm,
    NET_DEBT_COST_SCHEMA_ID,
    netDebtCostAfterTax,
  };
});
