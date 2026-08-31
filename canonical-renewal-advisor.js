(function attachCanonicalRenewalAdvisor(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalRenewalAdvisor = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createCanonicalRenewalAdvisor() {
  "use strict";

  // A16-4 — avisos de renovación con acción sugerida, sobre lo que ya detecta A16-3
  // (canonical-forecast.js · detectRecurringSubscriptions). A16-3 no guardaba ninguna fecha, solo un
  // recuento de meses vistos — se le añadió `monthsSeen` (los meses reales, ordenados) para que este
  // motor pueda estimar cuándo vuelve a cobrarse. Nunca inventa una cadencia: solo la infiere cuando
  // el hueco entre TODAS las apariciones vistas es exactamente el mismo; con menos de dos apariciones,
  // o con huecos irregulares, dice explícitamente que no hay fecha estimable en vez de adivinar una.
  // Motor puro, sin DOM ni estado global.

  const SCHEMA_ID = "finance-canonical-renewal-advisor/v1";
  const MONTH_KEY_PATTERN = /^\d{4}-\d{2}$/;

  function monthsBetween(fromKey, toKey) {
    const [fy, fm] = fromKey.split("-").map(Number);
    const [ty, tm] = toKey.split("-").map(Number);
    return (ty - fy) * 12 + (tm - fm);
  }

  function addMonths(monthKey, count) {
    const [y, m] = monthKey.split("-").map(Number);
    const total = y * 12 + (m - 1) + count;
    const nextYear = Math.floor(total / 12);
    const nextMonth = (total % 12) + 1;
    return `${nextYear}-${String(nextMonth).padStart(2, "0")}`;
  }

  // Cadencia solo si el hueco entre cada par consecutivo de meses vistos es idéntico — un solo hueco
  // distinto (una suscripción anual con un mes saltado, por ejemplo) ya no cuenta como regular.
  function inferCadence(monthsSeen = []) {
    const sorted = [...new Set((monthsSeen || []).filter((key) => MONTH_KEY_PATTERN.test(key)))].sort();
    if (sorted.length < 2) return null;
    const gaps = [];
    for (let index = 1; index < sorted.length; index += 1) gaps.push(monthsBetween(sorted[index - 1], sorted[index]));
    const [firstGap] = gaps;
    if (firstGap <= 0 || !gaps.every((gap) => gap === firstGap)) return null;
    return { cadenceMonths: firstGap, lastSeen: sorted[sorted.length - 1] };
  }

  function renewalAdvisory(subscription = {}, referenceMonth, options = {}) {
    const warnWithinMonths = Math.max(1, Math.round(Number(options.warnWithinMonths) || 2));
    const base = { schemaId: SCHEMA_ID, pattern: subscription.pattern, label: subscription.label };
    if (!MONTH_KEY_PATTERN.test(String(referenceMonth || ""))) return null;

    const cadence = inferCadence(subscription.monthsSeen);
    if (!cadence) {
      return {
        ...base, cadenceMonths: null, nextRenewal: null, monthsUntilRenewal: null,
        action: "sin-fecha-estimable",
        note: "Sin patrón de fechas regular todavía: hacen falta al menos dos apariciones con el mismo hueco entre ellas para estimar cuándo vuelve a cobrarse.",
      };
    }
    if (cadence.cadenceMonths <= 1) {
      return {
        ...base, cadenceMonths: cadence.cadenceMonths, nextRenewal: null, monthsUntilRenewal: null,
        action: "sin-fecha-distinguible",
        note: "Se cobra cada mes: no hay una fecha de renovación distinta que avisar.",
      };
    }

    const nextRenewal = addMonths(cadence.lastSeen, cadence.cadenceMonths);
    const monthsUntilRenewal = monthsBetween(referenceMonth, nextRenewal);
    const action = monthsUntilRenewal <= warnWithinMonths ? "decidir-antes-de-renovar" : "sin-accion-todavia";
    const note = action === "decidir-antes-de-renovar"
      ? `Se renueva ${monthsUntilRenewal <= 0 ? "este mes o ya debería haberse cobrado" : `en ${monthsUntilRenewal} mes(es)`}: decide si la mantienes, la renegocias o la cancelas antes de que se cobre otra vez.`
      : `Próxima renovación estimada en ${nextRenewal}, todavía sin acción pendiente.`;
    return { ...base, cadenceMonths: cadence.cadenceMonths, nextRenewal, monthsUntilRenewal, action, note };
  }

  function renewalAdvisories(subscriptions = [], referenceMonth, options = {}) {
    return (subscriptions || [])
      .map((subscription) => renewalAdvisory(subscription, referenceMonth, options))
      .filter(Boolean);
  }

  return { SCHEMA_ID, inferCadence, renewalAdvisory, renewalAdvisories };
});
