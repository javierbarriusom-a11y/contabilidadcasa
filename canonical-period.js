/**
 * canonical-period.js
 *
 * PER-1 (BACKLOG_CONTABILIDADCASA_3_0.md §2.1): generaliza a un solo módulo lo que
 * `CanonicalBudgetSchema` ya resolvió por separado para trimestre/año (`BUD-3`) — mismo shape que
 * `quarterRange`/`annualRange`, ya en producción — para las cuatro cadencias que la app necesita
 * nombrar: mes, trimestre, semestre y año. Sin motor de negocio propio: solo cálculo de claves y
 * rangos de fecha, determinista y sin `Intl`/zona horaria (mismo criterio que el resto de
 * `canonical-*.js`), para que el resultado no dependa del entorno de ejecución.
 *
 * Claves: mes "YYYY-MM", trimestre "YYYY-Qn" (n=1..4, natural: Q1 ene-mar... Q4 oct-dic), semestre
 * "YYYY-Sn" (n=1..2: S1 ene-jun, S2 jul-dic), año "YYYY". Los cuatro formatos son mutuamente
 * excluyentes, así que `periodRange`/`periodLabel`/`adjacentPeriod`/`periodUnit` infieren la
 * cadencia a partir de la propia clave — no hace falta pasarla aparte y no puede haber
 * contradicción entre clave y cadencia declarada.
 */

(function attachCanonicalPeriod(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalPeriod = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function canonicalPeriodFactory() {
  "use strict";

  const UNITS = Object.freeze(["month", "quarter", "semester", "year"]);
  const MONTHS_PER_UNIT = { month: 1, quarter: 3, semester: 6, year: 12 };
  const MONTH_LABELS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

  function pad2(value) {
    return String(value).padStart(2, "0");
  }

  function isoDateString(date) {
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  }

  // Última fecha del mes en el que cae `monthIndex0` meses después de enero de `year` — deja que
  // el propio `Date` normalice el desbordamiento de mes/año (funciona igual para bisiestos).
  function lastDayOfMonth(year, monthIndex0) {
    return new Date(year, monthIndex0 + 1, 0);
  }

  /**
   * Clave de la cadencia `unit` ("month"|"quarter"|"semester"|"year") a la que pertenece `date`.
   * `unit` inválido devuelve null.
   */
  function periodKey(unit, date = new Date()) {
    const year = date.getFullYear();
    const month = date.getMonth(); // 0-indexado
    switch (unit) {
      case "month":
        return `${year}-${pad2(month + 1)}`;
      case "quarter":
        return `${year}-Q${Math.floor(month / 3) + 1}`;
      case "semester":
        return `${year}-S${month < 6 ? 1 : 2}`;
      case "year":
        return `${year}`;
      default:
        return null;
    }
  }

  /**
   * Cadencia de una clave ya formada, inferida de su forma. null si no coincide con ninguna.
   */
  function periodUnit(key) {
    const value = String(key ?? "");
    if (/^\d{4}-\d{2}$/.test(value)) return "month";
    if (/^\d{4}-Q[1-4]$/.test(value)) return "quarter";
    if (/^\d{4}-S[1-2]$/.test(value)) return "semester";
    if (/^\d{4}$/.test(value)) return "year";
    return null;
  }

  /**
   * Rango de fechas (ambos extremos incluidos, "YYYY-MM-DD") de una clave de periodo. null si la
   * clave no tiene un formato reconocido — nunca un rango inventado sobre un dato corrupto.
   */
  function periodRange(key) {
    const unit = periodUnit(key);
    if (!unit) return null;
    const value = String(key);
    const year = Number(value.slice(0, 4));
    if (unit === "year") return { start: `${value}-01-01`, end: `${value}-12-31` };
    if (unit === "month") {
      const month = Number(value.slice(5, 7)); // 1-indexado
      const start = new Date(year, month - 1, 1);
      return { start: isoDateString(start), end: isoDateString(lastDayOfMonth(year, month - 1)) };
    }
    const n = Number(value.slice(-1));
    const startMonth = unit === "quarter" ? (n - 1) * 3 : (n - 1) * 6; // "semester"
    const start = new Date(year, startMonth, 1);
    const end = lastDayOfMonth(year, startMonth + MONTHS_PER_UNIT[unit] - 1);
    return { start: isoDateString(start), end: isoDateString(end) };
  }

  /**
   * Etiqueta corta en español de una clave de periodo — "sep 2026", "T3 2026", "S1 2026", "2026".
   * Sin `Intl`/zona horaria, tabla fija (mismo criterio que el resto del módulo). Una clave sin
   * formato reconocido se devuelve tal cual, nunca "undefined" ni una etiqueta inventada.
   */
  function periodLabel(key) {
    const unit = periodUnit(key);
    const value = String(key ?? "");
    if (!unit) return value;
    const year = value.slice(0, 4);
    if (unit === "year") return year;
    if (unit === "quarter") return `T${value.slice(-1)} ${year}`;
    if (unit === "semester") return `S${value.slice(-1)} ${year}`;
    const month = Number(value.slice(5, 7));
    return `${MONTH_LABELS[month - 1]} ${year}`;
  }

  /**
   * Clave del periodo de la misma cadencia que hay `offset` periodos después de `key` (`offset`
   * negativo va hacia atrás). Se apoya en `periodRange` para no duplicar el cálculo de fechas:
   * desplaza el inicio del periodo `offset × meses-por-cadencia` meses y vuelve a leer la clave de
   * la fecha resultante — `Date` normaliza solo el cruce de año. null si `key` no es válida.
   */
  function adjacentPeriod(key, offset = 1) {
    const unit = periodUnit(key);
    const range = unit ? periodRange(key) : null;
    if (!unit || !range) return null;
    const [year, month, day] = range.start.split("-").map(Number);
    const shifted = new Date(year, (month - 1) + MONTHS_PER_UNIT[unit] * offset, day);
    return periodKey(unit, shifted);
  }

  return {
    UNITS,
    periodKey,
    periodUnit,
    periodRange,
    periodLabel,
    adjacentPeriod,
  };
});
