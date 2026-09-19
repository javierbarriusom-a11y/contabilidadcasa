/**
 * canonical-ghost-expense-detector.js
 *
 * P8 (BACKLOG_CONTABILIDADCASA_2_0.md): detector de "gasto fantasma" — una suscripción que subió de
 * precio sin que el hogar necesariamente lo notara. Se apoya en lo que ya detecta A16-3
 * (canonical-forecast.js · detectRecurringSubscriptions), que agrupa cargos por concepto + importe
 * EXACTO a propósito: una subida de tarifa real crea un grupo nuevo con el mismo `pattern` pero
 * distinto `monthlyCost`, sin vincularlo con el grupo anterior. Este motor no repite esa detección:
 * solo agrupa los resultados que ya devolvió A16-3 por `pattern` y, cuando encuentra dos o más
 * precios distintos para el mismo concepto cuyos meses vistos no se solapan entre sí, compara el más
 * antiguo con el más reciente. Motor puro, sin DOM ni estado global; nunca decide, solo señala.
 */

(function attachCanonicalGhostExpenseDetector(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalGhostExpenseDetector = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createCanonicalGhostExpenseDetector() {
  "use strict";

  const SCHEMA_ID = "finance-canonical-ghost-expense-detector/v1";

  function round2(value) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.round((n + Number.EPSILON) * 100) / 100 : 0;
  }

  function groupByPattern(subscriptions) {
    const map = new Map();
    (subscriptions || []).forEach((item) => {
      if (!item || !item.pattern) return;
      if (!map.has(item.pattern)) map.set(item.pattern, []);
      map.get(item.pattern).push(item);
    });
    return map;
  }

  function firstMonth(item) {
    const months = Array.isArray(item.monthsSeen) ? item.monthsSeen : [];
    return months.length ? months[0] : null;
  }

  function lastMonth(item) {
    const months = Array.isArray(item.monthsSeen) ? item.monthsSeen : [];
    return months.length ? months[months.length - 1] : null;
  }

  // Dos precios del mismo concepto solo cuentan como una subida real si sus meses vistos no se
  // solapan — si se solapan, no es una tarifa que cambió en el tiempo sino dos importes coexistiendo
  // (p. ej. dos suscripciones distintas que comparten nombre de comercio), y no hay forma honesta de
  // distinguir cuál es la buena.
  function monthsOverlap(a, b) {
    const setB = new Set(b.monthsSeen || []);
    return (a.monthsSeen || []).some((month) => setB.has(month));
  }

  function ghostExpenseCandidates(subscriptions = [], options = {}) {
    const minIncreasePct = Math.max(0, Number(options.minIncreasePct) || 5);
    const groups = groupByPattern(subscriptions);
    const candidates = [];

    groups.forEach((items) => {
      const withMonths = items.filter((item) => firstMonth(item) && lastMonth(item));
      if (withMonths.length < 2) return;
      const sorted = [...withMonths].sort((a, b) => (firstMonth(a) < firstMonth(b) ? -1 : firstMonth(a) > firstMonth(b) ? 1 : 0));
      const anyOverlap = sorted.some((item, index) => index > 0 && monthsOverlap(sorted[index - 1], item));
      if (anyOverlap) return;

      const oldest = sorted[0];
      const newest = sorted[sorted.length - 1];
      if (newest.monthlyCost <= oldest.monthlyCost) return;

      const increaseAmount = round2(newest.monthlyCost - oldest.monthlyCost);
      const increasePct = oldest.monthlyCost > 0 ? round2((increaseAmount / oldest.monthlyCost) * 100) : 0;
      if (increasePct < minIncreasePct) return;

      candidates.push({
        pattern: oldest.pattern,
        label: newest.label || oldest.label,
        category: newest.category || oldest.category,
        fromAmount: oldest.monthlyCost,
        toAmount: newest.monthlyCost,
        increaseAmount,
        increasePct,
        increaseAnnualAmount: round2(increaseAmount * 12),
        sinceMonth: firstMonth(newest),
        priceStepsSeen: sorted.length,
      });
    });

    return {
      schemaId: SCHEMA_ID,
      generatedAt: options.generatedAt || new Date().toISOString(),
      minIncreasePct,
      candidates: candidates.sort((a, b) => b.increaseAnnualAmount - a.increaseAnnualAmount),
    };
  }

  return { SCHEMA_ID, ghostExpenseCandidates };
});
