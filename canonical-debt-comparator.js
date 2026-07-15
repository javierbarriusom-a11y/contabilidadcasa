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

  return {
    SCHEMA_ID,
    SCHEMA_VERSION,
    STRATEGIES,
    distributeCents,
    strategyLabel,
    normalizeAlternative,
    compareActionAlternatives,
    compareAgreements,
  };
});
