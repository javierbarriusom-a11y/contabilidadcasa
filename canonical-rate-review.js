/**
 * canonical-rate-review.js
 *
 * WP-20 (docs/WP20_DISENO.md): revisión del tipo variable de la hipoteca. Dice cuándo es la próxima
 * revisión, qué dato del índice se leerá según la regla del contrato y entre qué cuotas caerá la nueva
 * cuota (tipo central ± 1 punto), con avisos a 60 y 30 días. Motor puro, sin DOM ni almacenamiento: la
 * tarjeta vive en revision-tipo-ui.js y el valor del índice llega de canonical-rate-indices.js.
 *
 * No predice el mercado: usa el último valor del índice que el hogar ha tecleado y lo mueve ±1 punto como
 * convención de rango, nunca como pronóstico. No ejecuta nada (A11-4).
 */

(function attachRateReview(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalRateReview = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function rateReviewFactory() {
  "use strict";

  const SCHEMA_ID = "finanzas-casa-rate-review/v1";
  const BAND_POINTS = 1;
  const NOTICE_DAYS = Object.freeze([60, 30]);
  const MONTH_NAMES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

  function number(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  function round2(value) {
    return Math.round((number(value) + Number.EPSILON) * 100) / 100;
  }

  function isIsoDate(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }

  function dayNumber(iso) {
    return Math.round(new Date(`${iso}T00:00:00Z`).getTime() / 86400000);
  }

  function daysBetween(fromIso, toIso) {
    return dayNumber(toIso) - dayNumber(fromIso);
  }

  function addDays(iso, days) {
    return new Date((dayNumber(iso) + days) * 86400000).toISOString().slice(0, 10);
  }

  function addMonths(monthKey, delta) {
    const [year, month] = monthKey.split("-").map(Number);
    const index = year * 12 + (month - 1) + delta;
    return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
  }

  // Suma meses a una fecha sin pasarse de fin de mes (31 de enero + 1 mes = 28 de febrero).
  function addMonthsToDate(iso, delta) {
    const [year, month, day] = iso.split("-").map(Number);
    const target = addMonths(`${year}-${String(month).padStart(2, "0")}`, delta);
    const [ty, tm] = target.split("-").map(Number);
    const last = new Date(Date.UTC(ty, tm, 0)).getUTCDate();
    return `${target}-${String(Math.min(day, last)).padStart(2, "0")}`;
  }

  function monthLabel(monthKey) {
    const [year, month] = monthKey.split("-").map(Number);
    return `${MONTH_NAMES[month - 1]} de ${year}`;
  }

  // 7/10/2026
  function shortDate(iso) {
    const [year, month, day] = iso.split("-").map(Number);
    return `${day}/${month}/${year}`;
  }

  function longDate(iso) {
    const [year, month, day] = iso.split("-").map(Number);
    return `${day} de ${MONTH_NAMES[month - 1]} de ${year}`;
  }

  // Cuota francesa. Con tipo 0 es lineal; el tipo nunca baja de 0 (un tipo negativo no existe en la cuota).
  function payment(principal, annualRatePercent, months) {
    const p = Math.max(0, number(principal));
    const n = Math.max(1, Math.round(number(months)));
    const r = Math.max(0, number(annualRatePercent)) / 100 / 12;
    if (p <= 0) return 0;
    if (r === 0) return round2(p / n);
    const factor = Math.pow(1 + r, n);
    return round2((p * r * factor) / (factor - 1));
  }

  // Capital pendiente tras `payments` cuotas de `pay` € a `annualRatePercent`.
  function balanceAfter(principal, annualRatePercent, pay, payments) {
    const p = Math.max(0, number(principal));
    const n = Math.max(0, Math.round(number(payments)));
    const r = Math.max(0, number(annualRatePercent)) / 100 / 12;
    if (n === 0) return p;
    const balance = r === 0 ? p - pay * n : p * Math.pow(1 + r, n) - pay * ((Math.pow(1 + r, n) - 1) / r);
    return Math.max(0, balance);
  }

  // Qué dato del índice se leerá en la revisión, según la regla del contrato.
  function readingFor(settings) {
    const review = settings.nextReview;
    if (settings.rule === "dayValue") {
      const days = Math.max(0, Math.round(number(settings.ruleLag)));
      const date = addDays(review, -days);
      return { kind: "dayValue", date, label: days === 0 ? `el valor del Euribor del propio día de la revisión (${longDate(date)})` : `el valor del Euribor de ${days} días antes (${longDate(date)})` };
    }
    const lag = Math.min(3, Math.max(1, Math.round(number(settings.ruleLag) || 1)));
    const month = addMonths(review.slice(0, 7), -lag);
    return { kind: "monthlyAverage", month, label: `la media mensual del Euribor de ${monthLabel(month)}` };
  }

  function noticeState(daysToReview) {
    if (daysToReview <= 30) return "notice30";
    if (daysToReview <= 60) return "notice60";
    return "far";
  }

  /**
   * `input.contract`: capital, plazo y cuota actuales del contrato. `input.settings`: lo que el contrato no tiene (diferencial, fecha de
   * revisión, regla del índice…). `input.index`: último valor del índice y su estado, o null si no hay.
   * @typedef {{principal?: number, remainingMonths?: number, payment?: number}} ReviewContract
   * @typedef {{spread?: number, bonusPoints?: number, nextReview?: string, periodMonths?: number, rule?: string, ruleLag?: number, currentRate?: number|null}} ReviewSettings
   * @typedef {{value: number, date: string, state: string, ageDays: number|null}} ReviewIndex
   * @param {{today?: string, contract?: ReviewContract, settings?: ReviewSettings, index?: ReviewIndex|null}} [input]
   */
  function evaluate(input = {}) {
    const today = /** @type {string} */ (input.today);
    /** @type {ReviewContract} */
    const contract = input.contract || {};
    /** @type {ReviewSettings} */
    const settings = input.settings || {};
    const index = input.index || null;
    const missing = [];
    if (!isIsoDate(today)) missing.push("la fecha de hoy");
    if (!(number(contract.principal) > 0)) missing.push("el capital pendiente del contrato");
    if (!(number(contract.remainingMonths) > 0)) missing.push("los plazos restantes (o el vencimiento) del contrato");
    if (settings.spread === undefined || settings.spread === null || !Number.isFinite(Number(settings.spread))) missing.push("el diferencial");
    if (!isIsoDate(settings.nextReview)) missing.push("la fecha de la próxima revisión");
    if (!index || !Number.isFinite(Number(index.value))) missing.push("el valor del Euribor (tarjeta de índices)");
    if (missing.length) return { schemaId: SCHEMA_ID, status: "incomplete", missing };

    // Una revisión ya pasada se desplaza por periodos completos (6 o 12 meses) hasta la siguiente: el contrato sigue revisándose.
    const period = Number(settings.periodMonths) === 6 ? 6 : 12;
    let review = settings.nextReview;
    let rolled = false;
    for (let guard = 0; daysBetween(today, review) < 0 && guard < 240; guard += 1) {
      review = addMonthsToDate(review, period);
      rolled = true;
    }
    const daysToReview = daysBetween(today, review);
    const phase = noticeState(daysToReview);
    const reading = readingFor({ ...settings, nextReview: review });
    const spread = number(settings.spread);
    const bonus = Math.max(0, number(settings.bonusPoints));
    const indexValue = number(index.value);
    const centralRate = round2(indexValue + spread);

    // Capital y plazo en la fecha de revisión. Con tipo aplicado y cuota se proyecta; sin ellos, se usa el de hoy y se dice.
    const monthsToReview = daysToReview > 0 ? Math.max(0, Math.round(daysToReview / 30.4375)) : 0;
    const currentRate = settings.currentRate !== undefined && settings.currentRate !== null && Number.isFinite(Number(settings.currentRate)) ? number(settings.currentRate) : null;
    const currentPayment = number(contract.payment) > 0 ? round2(contract.payment) : (currentRate !== null ? payment(contract.principal, currentRate, contract.remainingMonths) : null);
    const interestOnly = currentRate !== null && currentPayment !== null ? number(contract.principal) * (currentRate / 100 / 12) : 0;
    const canProject = currentRate !== null && currentPayment !== null && currentPayment > interestOnly && monthsToReview > 0;
    const principalAtReview = canProject ? round2(balanceAfter(contract.principal, currentRate, currentPayment, monthsToReview)) : round2(contract.principal);
    const remainingAtReview = Math.max(1, Math.round(number(contract.remainingMonths)) - (canProject ? monthsToReview : 0));

    const at = (rate) => payment(principalAtReview, rate, remainingAtReview);
    const central = at(centralRate);
    const low = at(centralRate - BAND_POINTS);
    const high = at(centralRate + BAND_POINTS);
    const warnings = [];
    if (index.state === "stale") warnings.push(`El Euribor tecleado está caducado (del ${shortDate(index.date)}${index.ageDays !== null ? `, hace ${index.ageDays} días` : ""}): la estimación usa un dato viejo.`);
    if (!canProject) warnings.push(currentRate === null
      ? "Sin el tipo aplicado actualmente no se puede proyectar el capital hasta la revisión: se usa el capital de hoy (la cuota sale algo más alta de lo que será)."
      : "No se ha podido proyectar el capital (la cuota actual no cubre los intereses o la revisión es inmediata): se usa el de hoy.");
    if (rolled) warnings.push(`La fecha guardada (${longDate(settings.nextReview)}) ya pasó: se asume una revisión cada ${period} meses y la siguiente cae el ${longDate(review)}. Compruébalo con la carta del banco.`);
    if (central > 0 && currentPayment && central < currentPayment * 0.5) warnings.push("La cuota estimada es menos de la mitad de la actual: revisa el diferencial y los plazos.");

    const notices = NOTICE_DAYS.map((days) => ({ days, date: addDays(review, -days), active: daysToReview <= days }));
    return {
      schemaId: SCHEMA_ID,
      status: "ok",
      today,
      nextReview: review,
      savedReview: settings.nextReview,
      rolled,
      periodMonths: period,
      daysToReview,
      phase,
      notices,
      reading,
      indexValue,
      indexDate: index.date,
      indexState: index.state,
      spread,
      centralRate,
      principalAtReview,
      remainingAtReview,
      projected: canProject,
      currentPayment,
      payment: { low, central, high, bandPoints: BAND_POINTS, lowRate: round2(Math.max(0, centralRate - BAND_POINTS)), highRate: round2(centralRate + BAND_POINTS) },
      deltaMonthly: currentPayment === null ? null : round2(central - currentPayment),
      deltaYearly: currentPayment === null ? null : round2((central - currentPayment) * 12),
      // Si el diferencial incluye una bonificación (vinculaciones) y se pierde: la cuota central con ese punto más.
      withoutBonus: bonus > 0 ? { points: bonus, rate: round2(centralRate + bonus), central: at(centralRate + bonus) } : null,
      warnings,
    };
  }

  return { SCHEMA_ID, BAND_POINTS, NOTICE_DAYS, payment, balanceAfter, readingFor, noticeState, evaluate, longDate, shortDate, monthLabel, addDays, addMonths, addMonthsToDate, isIsoDate, daysBetween };
});
