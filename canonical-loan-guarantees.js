(function attachCanonicalLoanGuarantees(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalLoanGuarantees = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createCanonicalLoanGuarantees() {
  "use strict";

  // DI4 — impacto de un aval dado (garantía de la deuda de otra persona) en la capacidad de
  // endeudamiento futura propia (D-12: margen antes de superar el umbral de deuda/ingresos). Un
  // banco descuenta la cuota del aval de la capacidad como si fuera deuda propia, aunque hoy no se
  // esté pagando — es una obligación contingente, no hipotética. Motor puro, sin DOM ni estado
  // global, mismo patrón de campo único declarado que canonical-emergency-credit-line.js (DI2): sin
  // inventario de avales todavía, solo la cuota mensual equivalente agregada.

  const SCHEMA_ID = "finance-canonical-loan-guarantees/v1";

  function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function round2(value) {
    return Math.round((number(value) + Number.EPSILON) * 100) / 100;
  }

  function guaranteeCapacityImpact(marginEuros, guaranteedMonthlyTotal) {
    const margin = round2(Math.max(0, number(marginEuros)));
    const guaranteed = round2(Math.max(0, number(guaranteedMonthlyTotal)));
    const remainingMargin = round2(Math.max(0, margin - guaranteed));
    return {
      schemaId: SCHEMA_ID,
      marginBeforeGuarantees: margin,
      guaranteedMonthlyTotal: guaranteed,
      remainingMargin,
      // El aval ya consume, él solo, toda la capacidad que quedaba antes de tocar el umbral de
      // deuda/ingresos — no hay margen real para deuda nueva aunque D-12 todavía no lo refleje.
      exceedsCapacity: guaranteed > margin,
    };
  }

  return { SCHEMA_ID, guaranteeCapacityImpact };
});
