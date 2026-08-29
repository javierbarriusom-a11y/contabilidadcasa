/**
 * canonical-health-score.js
 *
 * A16-1: puntuación compuesta de salud financiera. No recalcula nada — combina cinco componentes ya
 * calculados en otros motores canónicos (colchón, ratio deuda/ingresos, cumplimiento de presupuesto,
 * progreso de objetivos, frescura de datos), cada uno normalizado a 0-1 por quien llama, con su peso
 * explícito. Mismo espíritu de transparencia que A2-6 (executive-read-model.js): cada componente se
 * puede explicar, no solo el número final.
 *
 * Un componente desconocido (null/undefined, p. ej. un hogar sin objetivos activos) no cuenta como
 * cero — se excluye y su peso se redistribuye entre los componentes conocidos, para no fabricar una
 * cifra a partir de un dato que simplemente no existe todavía. `complete` y `missing` dejan claro
 * cuándo la puntuación es parcial.
 */

(function attachCanonicalHealthScore(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalHealthScore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function canonicalHealthScoreFactory() {
  "use strict";

  const COMPONENTS = Object.freeze([
    { id: "cushion", label: "Colchón de liquidez", weight: 0.2 },
    { id: "debtRatio", label: "Ratio deuda/ingresos", weight: 0.2 },
    { id: "budgetCompliance", label: "Cumplimiento de presupuesto", weight: 0.2 },
    { id: "goalsProgress", label: "Progreso de objetivos", weight: 0.2 },
    { id: "dataFreshness", label: "Frescura de datos", weight: 0.2 },
  ]);

  function clamp01(value) {
    // Number(null) es 0, no NaN — sin este guardia explícito, un componente "no calculable todavía"
    // se puntuaría como el peor caso posible en vez de excluirse (mismo bugfix que taxTableStatus en
    // canonical-tax-tables.js, A15-5).
    if (value === null || value === undefined) return null;
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    return Math.max(0, Math.min(1, n));
  }

  function round1(value) {
    return Math.round(value * 10) / 10;
  }

  function compositeHealthScore(input = {}) {
    const components = COMPONENTS.map((definition) => {
      const score = clamp01(input[definition.id]);
      return { ...definition, score };
    });
    const known = components.filter((component) => component.score !== null);
    const knownWeight = known.reduce((sum, component) => sum + component.weight, 0);
    const value = knownWeight > 0
      ? round1((known.reduce((sum, component) => sum + component.score * component.weight, 0) / knownWeight) * 100)
      : null;
    return {
      value,
      complete: known.length === components.length,
      missing: components.filter((component) => component.score === null).map((component) => component.id),
      components: components.map((component) => ({
        id: component.id,
        label: component.label,
        weight: component.weight,
        score: component.score === null ? null : round1(component.score * 100),
      })),
    };
  }

  return { COMPONENTS, compositeHealthScore };
});
