/**
 * canonical-forecast-alerts.js
 *
 * FX-41 (backlog de noviembre, el cambio de Hoy de la semana del 23/11/2026): avisos de previsión con umbral. La previsión avisa cuando
 * CRUZA un umbral, no cuando cambia (eso ya lo cuenta FX-40): hoy se está por encima y la trayectoria baja de él en los próximos 90 días.
 * Si hoy ya se está por debajo, no es un aviso de previsión sino el estado de hoy (lo dice Hoy); y un umbral que la previsión nunca
 * alcanza tampoco avisa cada semana: un aviso que salta siempre se acaba ignorando.
 *
 * Cuatro umbrales (docs/PROPUESTA_OCTAVA_AUDITORIA_2026-11-05.md, FX-41):
 *   · suelo: la liquidez total baja del suelo del hogar;
 *   · cuenta: la cuenta corriente baja de su mínimo operativo (la reserva, o 0 €) con el total por encima del suelo;
 *   · colchón: los meses de gasto que cubre la liquidez bajan del objetivo de Ajustes (si no hay aviso de suelo, que ya lo incluye);
 *   · fin de año: el 31 de diciembre cae más de un 10 % frente a la última visita a la Previsión (la foto de FX-40).
 * Cada aviso lleva sus euros en juego (lo que falta para no cruzar, o lo que cae), y salen de más a menos euros: Hoy enseña 3 como mucho.
 *
 * Motor puro: sin DOM, red ni almacenamiento; los textos los pone quien lo pinta. No ejecuta nada (A11-4).
 */

(function attachCanonicalForecastAlerts(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalForecastAlerts = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function canonicalForecastAlertsFactory() {
  "use strict";

  const SCHEMA_ID = "finance-forecast-alerts/v1";
  const HORIZON_DAYS = 90;
  const YEAR_END_DROP = 0.1;
  const TOLERANCE = 0.5;

  const isDate = (value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
  const finite = (value) => value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));
  const round2 = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

  function addDays(iso, days) {
    const date = new Date(`${iso}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
  }

  /** El día más bajo de un campo en el tramo (el primero, si hay empate). */
  function lowest(tramo, field) {
    return tramo.reduce((low, row) => (Number(row[field]) < Number(low[field]) ? row : low), tramo[0]);
  }

  function sueloAlert(tramo, floor) {
    if (!(Number(tramo[0].total) >= floor)) return null;
    const cruce = tramo.find((row) => Number(row.total) < floor - TOLERANCE);
    if (!cruce) return null;
    const low = lowest(tramo, "total");
    return { id: "suelo", date: cruce.date, euros: round2(floor - Number(low.total)), data: { floor, crossDate: cruce.date, lowDate: low.date, lowValue: round2(low.total) } };
  }

  function cuentaAlert(tramo, checkingFloor) {
    const conCuenta = tramo.filter((row) => finite(row.checking));
    if (!conCuenta.length || conCuenta[0].date !== tramo[0].date || !(Number(conCuenta[0].checking) >= checkingFloor - TOLERANCE)) return null;
    const cruce = conCuenta.find((row) => Number(row.checking) < checkingFloor - TOLERANCE);
    if (!cruce) return null;
    const low = lowest(conCuenta, "checking");
    const gap = round2(checkingFloor - Number(low.checking));
    return { id: "cuenta", date: cruce.date, euros: gap, data: { checkingFloor, crossDate: cruce.date, lowDate: low.date, lowValue: round2(low.checking), coveredBySavings: finite(low.savings) && Number(low.savings) >= gap } };
  }

  function colchonAlert(tramo, targetMonths, monthlySpend) {
    if (!(targetMonths > 0) || !(monthlySpend > 0)) return null;
    const objetivo = targetMonths * monthlySpend;
    if (!(Number(tramo[0].total) >= objetivo)) return null;
    const cruce = tramo.find((row) => Number(row.total) < objetivo - TOLERANCE);
    if (!cruce) return null;
    const low = lowest(tramo, "total");
    return { id: "colchon", date: cruce.date, euros: round2(objetivo - Number(low.total)), data: { targetMonths, monthlySpend: round2(monthlySpend), crossDate: cruce.date, lowDate: low.date, lowMonths: Math.round((Number(low.total) / monthlySpend) * 10) / 10 } };
  }

  function finDeAnoAlert(rows, today, previousYearEnd) {
    const prev = previousYearEnd;
    if (!prev || !(Number(prev.value) > 0) || !isDate(prev.visitDate) || prev.visitDate >= today) return null;
    const date = `${today.slice(0, 4)}-12-31`;
    const row = rows.find((item) => item.date === date);
    if (!row || !finite(row.total)) return null;
    const drop = round2(Number(prev.value) - Number(row.total));
    if (!(drop > Number(prev.value) * YEAR_END_DROP)) return null;
    return { id: "fin-de-ano", date, euros: drop, data: { before: round2(prev.value), after: round2(row.total), visitDate: prev.visitDate, share: Math.round((drop / Number(prev.value)) * 100) } };
  }

  /**
   * Los avisos de la previsión, de más a menos euros en juego.
   * @param {{
   *   rows: Array<{date: string, total: number, checking?: number, savings?: number}>,
   *   today: string,
   *   floor?: number,
   *   checkingFloor?: number,
   *   cushionTargetMonths?: number,
   *   monthlySpend?: number,
   *   previousYearEnd?: {value: number, visitDate: string}|null,
   *   horizonDays?: number,
   * }} input
   */
  function evaluate({ rows = [], today, floor = 0, checkingFloor = 0, cushionTargetMonths = 0, monthlySpend = 0, previousYearEnd = null, horizonDays = HORIZON_DAYS }) {
    if (!isDate(today)) return { schemaId: SCHEMA_ID, status: "missing", missing: ["la fecha de hoy"], alerts: [] };
    const fin = addDays(today, horizonDays);
    const ordenadas = (Array.isArray(rows) ? rows : []).filter((row) => row && isDate(row.date) && finite(row.total)).sort((a, b) => (a.date < b.date ? -1 : 1));
    const tramo = ordenadas.filter((row) => row.date >= today && row.date <= fin);
    if (!tramo.length || tramo[0].date !== today) return { schemaId: SCHEMA_ID, status: "missing", missing: ["la previsión desde hoy"], alerts: [] };
    const suelo = sueloAlert(tramo, Number(floor) || 0);
    const alerts = [
      suelo,
      cuentaAlert(tramo, Math.max(0, Number(checkingFloor) || 0)),
      suelo ? null : colchonAlert(tramo, Number(cushionTargetMonths) || 0, Number(monthlySpend) || 0),
      finDeAnoAlert(ordenadas, today, previousYearEnd),
    ].filter((alert) => alert && alert.euros > 0);
    // Si la cuenta corriente solo baja porque baja el total (mismo día o después del suelo), el aviso de suelo ya lo dice.
    const sinDoble = alerts.filter((alert) => !(alert.id === "cuenta" && suelo && alert.date >= suelo.date));
    sinDoble.sort((a, b) => b.euros - a.euros || (a.date < b.date ? -1 : 1));
    return { schemaId: SCHEMA_ID, status: "ok", missing: [], alerts: sinDoble };
  }

  /**
   * El 31 de diciembre que preveía una foto de FX-40 (canonical-forecast-changes.js): el día exacto si la foto lo cubre día a día; si
   * no, el saldo con que acababa diciembre en su resumen mensual. null si no lo cubre.
   * @param {any} snap
   * @param {string} year AAAA
   */
  function yearEndFromSnapshot(snap, year) {
    if (!snap || !isDate(snap.date) || !Array.isArray(snap.days)) return null;
    const date = `${year}-12-31`;
    const offset = Math.round((Date.parse(`${date}T12:00:00Z`) - Date.parse(`${snap.date}T12:00:00Z`)) / 86400000);
    if (offset >= 0 && offset < snap.days.length && finite(snap.days[offset])) return Number(snap.days[offset]);
    const month = (Array.isArray(snap.months) ? snap.months : []).find((item) => Array.isArray(item) && item[0] === `${year}-12`);
    return month && finite(month[3]) ? Number(month[3]) : null;
  }

  return Object.freeze({ SCHEMA_ID, HORIZON_DAYS, YEAR_END_DROP, evaluate, yearEndFromSnapshot });
});
