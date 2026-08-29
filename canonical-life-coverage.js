(function attachCanonicalLifeCoverage(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalLifeCoverage = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createCanonicalLifeCoverage() {
  "use strict";

  // SP2 — compara el capital asegurado de un seguro de vida con la deuda pendiente total: si la
  // persona asegurada faltara, ¿la indemnización cubre lo que queda por pagar de toda la deuda
  // viva? Sin inventario de pólizas todavía (SP1, más adelante, sin relación de dependencia con
  // esta tarea): un único capital agregado es suficiente para esta primera comprobación. Motor
  // puro, sin DOM ni estado global, mismo patrón que canonical-cushion.js.

  const SCHEMA_ID = "finance-canonical-life-coverage/v1";

  function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function round2(value) {
    return Math.round((number(value) + Number.EPSILON) * 100) / 100;
  }

  function evaluateLifeCoverageGap(capitalAsegurado, deudaPendiente) {
    const capital = round2(Math.max(0, number(capitalAsegurado)));
    const deuda = round2(Math.max(0, number(deudaPendiente)));
    const gap = round2(Math.max(0, deuda - capital));
    return {
      schemaId: SCHEMA_ID,
      capital,
      deuda,
      gap,
      covered: gap === 0,
      // null cuando no hay deuda que cubrir: el ratio no significa nada sin denominador.
      coverageRatio: deuda > 0 ? round2(capital / deuda) : null,
    };
  }

  return { SCHEMA_ID, evaluateLifeCoverageGap };
});
