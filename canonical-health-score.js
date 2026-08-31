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

  // A16-2: guarda como mucho un registro por día — releer la misma jornada actualiza el valor en
  // vez de duplicar la fecha. Sin valor conocido (null/undefined) no se guarda nada: la tendencia
  // solo se acumula con puntuaciones reales, nunca con un hueco fingido como cero.
  function recordSnapshot(history = [], date, value) {
    const list = Array.isArray(history) ? [...history] : [];
    if (value === null || value === undefined) return list;
    const day = String(date || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return list;
    const roundedValue = round1(value);
    const existingIndex = list.findIndex((entry) => entry.date === day);
    if (existingIndex >= 0) list[existingIndex] = { date: day, value: roundedValue };
    else list.push({ date: day, value: roundedValue });
    return list.sort((a, b) => a.date.localeCompare(b.date));
  }

  // Compara el primer y el último registro disponibles — no una regresión lineal ni una media
  // móvil, solo "de dónde veníamos a dónde estamos", que es todo lo que A16-2 pide como núcleo.
  function trendSummary(history = []) {
    const list = Array.isArray(history) ? history : [];
    if (list.length < 2) return null;
    const first = list[0];
    const last = list[list.length - 1];
    return { first, last, delta: round1(last.value - first.value), count: list.length };
  }

  return { COMPONENTS, compositeHealthScore, recordSnapshot, trendSummary };
});
