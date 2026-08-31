(function attachCanonicalHomeInsurance(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalHomeInsurance = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createCanonicalHomeInsurance() {
  "use strict";

  // SP3 — compara la cobertura del seguro de hogar (contenido) con el valor de reposición
  // declarado de los bienes: si hubiera un siniestro total, ¿la indemnización basta para
  // reponerlo todo? Motor puro, sin DOM ni estado global, mismo patrón que
  // canonical-life-coverage.js (SP2): un gap simple, sin inventario de pólizas.

  const SCHEMA_ID = "finance-canonical-home-insurance/v1";

  function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function round2(value) {
    return Math.round((number(value) + Number.EPSILON) * 100) / 100;
  }

  function evaluateHomeInsuranceGap(coverage, replacementValue) {
    const cobertura = round2(Math.max(0, number(coverage)));
    const reposicion = round2(Math.max(0, number(replacementValue)));
    const gap = round2(Math.max(0, reposicion - cobertura));
    return {
      schemaId: SCHEMA_ID,
      coverage: cobertura,
      replacementValue: reposicion,
      gap,
      covered: gap === 0,
      // null cuando no hay valor de reposición declarado: el ratio no significa nada sin denominador.
      coverageRatio: reposicion > 0 ? round2(cobertura / reposicion) : null,
    };
  }

  return { SCHEMA_ID, evaluateHomeInsuranceGap };
});
