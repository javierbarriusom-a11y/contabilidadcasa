(function attachCanonicalDataAge(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalDataAge = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createCanonicalDataAge() {
  "use strict";

  // S4 (docs/OLA2_RECALIBRACION.md §3): la edad de los saldos, dicha junto a la cifra. El 2/10/2026
  // la medición con datos reales encontró que Hoy calculaba sobre saldos del 27/9 sin decirlo.
  // Es puro: la fecha de los saldos, el día de hoy y el modo llegan por parámetro (sin reloj ni
  // estado de la app), así que se prueba sin navegador.

  // Con importación del extracto tres veces por semana, el hueco normal entre dos cargas es de
  // 3 días: a partir del cuarto se ha saltado una carga y la cifra puede estar desfasada.
  const STALE_AFTER_DAYS = 4;

  function parseIso(value) {
    const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return null;
    const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
    const time = Date.UTC(year, month - 1, day);
    const check = new Date(time);
    // Rechaza fechas que JavaScript «corrige» en silencio (31 de febrero → 3 de marzo).
    if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null;
    return { year, month, day, time };
  }

  function dateLabel(date, today) {
    const base = `${date.day}/${date.month}`;
    return today && today.year === date.year ? base : `${base}/${date.year}`;
  }

  function ageLabel(ageDays) {
    if (ageDays === 0) return "hoy";
    if (ageDays === 1) return "ayer";
    return `hace ${ageDays} días`;
  }

  // input: { asOfDate: "2026-09-27", today: "2026-10-02", mode: "manual" | "auto", staleAfterDays }
  function describe(input = {}) {
    const asOf = parseIso(input.asOfDate);
    const today = parseIso(input.today);
    const staleAfter = Number.isFinite(Number(input.staleAfterDays)) && Number(input.staleAfterDays) > 0
      ? Number(input.staleAfterDays)
      : STALE_AFTER_DAYS;
    if (!asOf || !today) {
      return { known: false, tone: "unknown", stale: false, ageDays: null, dateLabel: "", ageLabel: "", label: "Saldos sin fecha", warning: "" };
    }
    const label = dateLabel(asOf, today);
    const ageDays = Math.round((today.time - asOf.time) / 86400000);
    if (input.mode === "auto") {
      // Calculados por el calendario de cobros y pagos hasta esa fecha: no son una foto del banco
      // que envejezca, así que no hay aviso de antigüedad.
      return { known: true, tone: "current", stale: false, ageDays, dateLabel: label, ageLabel: "", label: `Saldos calculados por calendario a ${label}`, warning: "" };
    }
    if (ageDays < 0) {
      return { known: true, tone: "future", stale: false, ageDays, dateLabel: label, ageLabel: "", label: `Saldos con fecha del ${label} (posterior a hoy)`, warning: "" };
    }
    const age = ageLabel(ageDays);
    const stale = ageDays >= staleAfter;
    return {
      known: true,
      tone: stale ? "stale" : ageDays <= 1 ? "current" : "recent",
      stale,
      ageDays,
      dateLabel: label,
      ageLabel: age,
      label: `Saldos del ${label} · ${age}`,
      warning: stale ? "Pueden faltar movimientos posteriores a esa fecha." : "",
    };
  }

  return { STALE_AFTER_DAYS, describe };
});
