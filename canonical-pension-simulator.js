(function attachCanonicalPensionSimulator(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalPensionSimulator = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createCanonicalPensionSimulator() {
  "use strict";

  // A15-4 — simulador de aportación a plan de pensiones. Compara el ahorro fiscal estimado de una
  // aportación frente a la liquidez que queda inmovilizada (un plan de pensiones no se puede
  // rescatar libremente antes de jubilación salvo supuestos tasados), usando el límite deducible
  // vigente — no el importe que el hogar quiera aportar sin más. Motor puro, sin DOM ni estado
  // global, mismo patrón que canonical-tariff-comparator.js.

  const SCHEMA_ID = "finance-canonical-pension-simulator/v1";

  // Límite general de aportación deducible a plan de pensiones individual en España, versionado
  // por año (mismo espíritu que canonical-tax-tables.js, A15-5, para no mezclar años fiscales
  // distintos). No incluye el margen adicional por aportación de empresa a plan de empleo (hasta
  // 8.500€ combinados) — la app no registra si existe un plan de empleo, así que ese supuesto
  // quedaría inventado; se limita al límite general individual, siempre correcto como mínimo.
  const DEDUCTION_LIMITS = Object.freeze([
    { year: 2021, limit: 2000 },
    { year: 2022, limit: 1500 },
  ]);

  function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function round2(value) {
    return Math.round((number(value) + Number.EPSILON) * 100) / 100;
  }

  function limitForYear(year) {
    const known = DEDUCTION_LIMITS.filter((row) => Number(row.year) <= Number(year));
    if (!known.length) return null;
    return known[known.length - 1].limit;
  }

  // marginalRatePercent: la retención declarada en el registro de supuestos fiscales (A15-1) hace
  // de estimación del tipo marginal — la app no calcula tramos reales de IRPF todavía (A15-2, sin
  // construir), así que se usa el dato ya disponible en vez de fabricar un tramo. Sin ese dato, el
  // ahorro fiscal es null (hueco explícito, nunca una cifra inventada).
  function simulateContribution(input = {}) {
    const contribution = Math.max(0, round2(input.contribution));
    const year = Number.isFinite(Number(input.year)) ? Number(input.year) : new Date().getFullYear();
    const limit = limitForYear(year);
    const deductibleAmount = limit === null ? contribution : Math.min(contribution, limit);
    const exceedsLimit = limit !== null && contribution > limit;
    const marginalRate = Number.isFinite(Number(input.marginalRatePercent)) && Number(input.marginalRatePercent) > 0
      ? Math.min(1, Number(input.marginalRatePercent) / 100)
      : null;
    const estimatedTaxSaving = marginalRate === null ? null : round2(deductibleAmount * marginalRate);
    const netCost = estimatedTaxSaving === null ? null : round2(contribution - estimatedTaxSaving);

    // Liquidez inmovilizada: cuánto queda de colchón (respecto a la reserva protegida) después de
    // restar la aportación completa — el importe entero se inmoviliza, no solo la parte deducible.
    const hasBalanceData = Number.isFinite(Number(input.checkingBalance)) && Number.isFinite(Number(input.protectedReserve));
    const marginAfter = hasBalanceData
      ? round2(Number(input.checkingBalance) - Number(input.protectedReserve) - contribution)
      : null;
    const breaksReserve = marginAfter !== null && marginAfter < 0;

    return {
      schemaId: SCHEMA_ID,
      contribution,
      year,
      limit,
      deductibleAmount,
      exceedsLimit,
      remainingRoom: limit === null ? null : round2(Math.max(0, limit - contribution)),
      marginalRate,
      estimatedTaxSaving,
      netCost,
      marginAfter,
      breaksReserve,
    };
  }

  return { SCHEMA_ID, DEDUCTION_LIMITS, limitForYear, simulateContribution };
});
