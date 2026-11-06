/**
 * canonical-stress-scenarios.js
 *
 * FX-21 (BACKLOG_NOVIEMBRE_OLEADA_1.md §5.1; docs/PROPUESTA_OCTAVA_AUDITORIA_2026-11-05.md §7): las pruebas de estrés del hogar.
 * Cada una cambia la entrada del plan (los mismos meses que lee el motor canónico) de una forma concreta, se recalcula el plan con
 * el motor mensual y el diario de siempre, y se compara con el plan sin tocar. No pide ningún dato nuevo y no ejecuta nada (A11-4).
 *
 * Cada prueba responde, siempre en este orden: ¿bajamos del suelo?, ¿cuándo?, ¿cuánto falta? y qué recorte lo arreglaría.
 * Motor puro: los motores se le pasan (deps), así se prueba en Node con motores falsos.
 *
 * Las tres de D-N3 (decidida por el hogar el 6/11/2026): un sueldo menos por titular durante 3 o 6 meses, el Euribor +1 o +2 puntos
 * en la próxima revisión de la hipoteca (con los datos de WP-20) y un imprevisto de 3.000 € el peor día. «Gasto variable +10 %» se
 * construyó primero y queda en la biblioteca (applyGastoMas) para el resto de pruebas de FX-21; no sale en la fila.
 */

(function attachCanonicalStressScenarios(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalStressScenarios = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function canonicalStressScenariosFactory() {
  "use strict";

  const SCHEMA_ID = "finance-canonical-stress-scenarios/v2";
  const round2 = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
  const clone = (value) => JSON.parse(JSON.stringify(value ?? null));
  const finite = (value) => Number.isFinite(Number(value));

  const PRESETS = Object.freeze([
    Object.freeze({ id: "sueldo-menos", label: "Un sueldo menos", short: "Un sueldo menos" }),
    Object.freeze({ id: "euribor", label: "Sube el Euribor en la revisión", short: "Euribor" }),
    Object.freeze({ id: "imprevisto", label: "Imprevisto de 3.000 € el peor día", short: "Imprevisto 3.000 €", amount: 3000 }),
  ]);
  const SUELDO_MESES = Object.freeze([3, 6]);
  const EURIBOR_PUNTOS = Object.freeze([1, 2]);

  function monthLength(monthKey) {
    const [year, month] = String(monthKey).split("-").map(Number);
    return new Date(Date.UTC(year, month, 0)).getUTCDate();
  }

  /**
   * Los sueldos de cada titular: los ingresos que llegan casi todos los meses (3 de cada 4 de los próximos 12), del mayor al menor
   * importe medio. La app no guarda de quién es cada ingreso; cada partida de ingreso con su nombre hace de titular.
   * @param {any} input
   * @param {string} today
   */
  function titulares(input, today) {
    const months = (input?.months || []).filter((month) => month.monthKey >= String(today).slice(0, 7)).slice(0, 12);
    if (!months.length) return [];
    const seen = new Map();
    months.forEach((month) => {
      const byConcept = new Map();
      (month.incomeEvents || []).forEach((event) => {
        if (!event.concept || !(Number(event.amount) > 0)) return;
        byConcept.set(event.concept, (byConcept.get(event.concept) || 0) + Number(event.amount));
      });
      byConcept.forEach((amount, concept) => {
        const item = seen.get(concept) || { concept, months: 0, total: 0 };
        item.months += 1;
        item.total += amount;
        seen.set(concept, item);
      });
    });
    const needed = Math.ceil(months.length * 0.75);
    return [...seen.values()]
      .filter((item) => item.months >= needed)
      .map((item) => ({ concept: item.concept, average: round2(item.total / item.months) }))
      .sort((a, b) => b.average - a.average || a.concept.localeCompare(b.concept))
      .slice(0, 3);
  }

  /** El primer mes cuyo cobro todavía no ha llegado (el del mes en curso, si es futuro); con `concept`, el de ese ingreso. */
  function firstUnpaidMonthIndex(months, today, concept = "") {
    const current = String(today).slice(0, 7);
    return months.findIndex((month) => month.monthKey > current
      || (month.incomeEvents || []).some((event) => (!concept || event.concept === concept) && event.date && event.date >= today));
  }

  /**
   * Un sueldo menos: el ingreso de un titular (por defecto, el mayor del primer mes sin cobrar) desaparece `months` meses.
   * @param {any} input
   * @param {{ today?: string, months?: number, concept?: string }} [options]
   */
  function applySueldoMenos(input, { today, months = 3, concept = "" } = {}) {
    const next = clone(input);
    const all = next.months || [];
    let target = concept;
    if (!target) {
      const first = firstUnpaidMonthIndex(all, today);
      target = first < 0 ? "" : (all[first].incomeEvents || []).reduce((best, event) => (Number(event.amount) > Number(best?.amount || 0) ? event : best), null)?.concept || "";
    }
    const start = target ? firstUnpaidMonthIndex(all, today, target) : -1;
    if (start < 0) return { input: next, applied: false };
    const touched = [];
    all.slice(start, start + months).forEach((month) => {
      const lost = (month.incomeEvents || []).filter((event) => event.concept === target).reduce((sum, event) => sum + Number(event.amount || 0), 0);
      if (!lost) return;
      month.income = round2(Math.max(0, Number(month.income || 0) - lost));
      month.prePayrollIncome = round2(Math.max(0, Number(month.prePayrollIncome || 0) - lost));
      month.incomeEvents = (month.incomeEvents || []).filter((event) => event.concept !== target);
      touched.push(month.monthKey);
    });
    if (!touched.length) return { input: next, applied: false };
    return { input: next, applied: true, info: { concept: target, months, from: touched[0], to: touched.at(-1) } };
  }

  /**
   * La cuota de cada hipoteca con el Euribor `points` puntos por encima del último tecleado, desde su próxima revisión.
   * `reviews` son resultados con estado «ok» de FinanceCanonicalRateReview.evaluate; `payment` es su cuota francesa.
   * @param {any[]} reviews
   * @param {number} points
   * @param {(principal: number, rate: number, months: number) => number} payment
   */
  function euriborShocks(reviews, points, payment) {
    return (reviews || [])
      .filter((review) => review?.status === "ok" && finite(review.currentPayment) && Number(review.currentPayment) > 0)
      .map((review) => {
        const rate = round2(Number(review.centralRate) + points);
        const to = round2(payment(review.principalAtReview, rate, review.remainingAtReview));
        return { date: review.nextReview, from: round2(review.currentPayment), to, extra: round2(to - Number(review.currentPayment)), rate, months: Math.max(1, Number(review.remainingAtReview) || 1) };
      });
  }

  /**
   * El Euribor más alto: cada hipoteca paga `extra` más al mes desde el mes de su revisión y hasta su último plazo. Si la cuota nueva no
   * sube (el tipo de hoy ya era más alto), no se añade nada.
   * @param {any} input
   * @param {{ shocks?: any[] }} [options]
   */
  function applyEuribor(input, { shocks = [] } = {}) {
    const next = clone(input);
    if (!shocks.length) return { input: next, applied: false };
    shocks.forEach((shock) => {
      if (!(shock.extra > 0)) return;
      const startKey = String(shock.date).slice(0, 7);
      const day = Number(String(shock.date).slice(8, 10)) || 1;
      (next.months || []).filter((month) => month.monthKey >= startKey).slice(0, shock.months).forEach((month) => {
        const dd = String(Math.min(day, monthLength(month.monthKey))).padStart(2, "0");
        month.coreSpend = round2(Number(month.coreSpend || 0) + shock.extra);
        month.expenseEvents = [...(month.expenseEvents || []), { concept: "Subida de la cuota de la hipoteca (prueba de estrés)", amount: shock.extra, field: "fixedCoreSpend", day: Number(dd), date: `${month.monthKey}-${dd}`, source: "prueba de estrés", confidence: "rule", role: "" }];
      });
    });
    return { input: next, applied: true, info: { shocks } };
  }

  /**
   * Un imprevisto en un día: un gasto fijo más ese día, en su mes (así el diario lo pone justo ahí).
   * @param {any} input
   * @param {{ date?: string, amount?: number }} [options]
   */
  function applyImprevisto(input, { date, amount = 3000 } = {}) {
    const next = clone(input);
    const month = (next.months || []).find((item) => item.monthKey === String(date || "").slice(0, 7));
    if (!month) return { input: next, applied: false };
    month.coreSpend = round2(Number(month.coreSpend || 0) + amount);
    month.expenseEvents = [...(month.expenseEvents || []), { concept: "Imprevisto (prueba de estrés)", amount, field: "fixedCoreSpend", day: Number(date.slice(8, 10)), date, source: "prueba de estrés", confidence: "rule", role: "" }];
    return { input: next, applied: true, info: { date, amount } };
  }

  /**
   * El gasto variable un `factor` más alto en todos los meses (biblioteca: fuera de la fila desde D-N3).
   * @param {any} input
   * @param {{ factor?: number }} [options]
   */
  function applyGastoMas(input, { factor = 1.1 } = {}) {
    const next = clone(input);
    (next.months || []).forEach((month) => {
      const variable = Number(month.variableOperationalSpend || 0);
      const extra = round2(variable * (factor - 1));
      month.variableOperationalSpend = round2(variable + extra);
      month.coreSpend = round2(Number(month.coreSpend || 0) + extra);
    });
    return { input: next, applied: true, info: { factor } };
  }

  /** El plan y su trayectoria diaria con los motores de siempre. */
  function run(input, deps, reason = "prueba de estrés") {
    const scenario = deps.monthly.buildScenario(input, null, { reason });
    const dailyInput = deps.dailyInput.build(input, scenario.rows, deps.dailyOptions || {});
    const snapshot = deps.daily.buildSnapshot(dailyInput, null, { reason });
    return { rows: snapshot.rows || [], valid: snapshot.invariants?.valid !== false };
  }

  function lowIn(rows, from, to) {
    let low = null;
    rows.forEach((row) => {
      if (row.date < from || row.date > to || !finite(row.total)) return;
      if (!low || Number(row.total) < low.value) low = { date: row.date, value: Number(row.total) };
    });
    return low;
  }

  function monthsBetween(fromIso, toIso) {
    const [y1, m1] = String(fromIso).split("-").map(Number);
    const [y2, m2] = String(toIso).split("-").map(Number);
    return Math.max(1, (y2 - y1) * 12 + (m2 - m1) + 1);
  }

  /**
   * La comparación que enseña la pantalla: el punto más bajo del plan y del escenario, si se baja del suelo y cuándo, cuánto falta,
   * cuánto cambia el 31/12 y al final del horizonte (`to`), y el recorte mensual de gasto que lo arreglaría (repartido entre hoy y el día más bajo).
   * @param {any[]} baseRows
   * @param {any[]} shockedRows
   * @param {{ today?: string, to?: string, floor?: number }} [options]
   */
  function compare(baseRows, shockedRows, { today, to, floor = 0 } = {}) {
    const baseLow = lowIn(baseRows, today, to);
    const low = lowIn(shockedRows, today, to);
    if (!baseLow || !low) return null;
    const firstBelow = (rows) => rows.find((row) => row.date >= today && row.date <= to && Number(row.total) < floor) || null;
    const below = firstBelow(shockedRows);
    const baseBelow = firstBelow(baseRows);
    const shortfall = low.value < floor ? round2(floor - low.value) : 0;
    const yearEnd = `${String(today).slice(0, 4)}-12-31`;
    const baseEnd = baseRows.find((row) => row.date === yearEnd);
    const shockEnd = shockedRows.find((row) => row.date === yearEnd);
    // El saldo de un día es el de su última fila hasta ese día (el saldo se arrastra entre movimientos).
    const lastBy = (rows, until) => rows.reduce((last, row) => (row.date <= until && finite(row.total) && (!last || row.date > last.date) ? row : last), null);
    const baseLast = lastBy(baseRows, to);
    const shockLast = baseLast ? lastBy(shockedRows, baseLast.date) : null;
    return {
      baseLow,
      low,
      lowDiff: round2(low.value - baseLow.value),
      baseCrossesFloor: Boolean(baseBelow),
      baseCrossDate: baseBelow?.date || null,
      crossesFloor: Boolean(below),
      crossDate: below?.date || null,
      shortfall,
      monthlyCut: shortfall ? round2(shortfall / monthsBetween(today, low.date)) : 0,
      yearEnd: baseEnd && shockEnd ? { date: yearEnd, base: round2(baseEnd.total), shocked: round2(shockEnd.total) } : null,
      yearEndDiff: baseEnd && shockEnd ? round2(Number(shockEnd.total) - Number(baseEnd.total)) : null,
      end: baseLast && shockLast ? { date: baseLast.date, base: round2(baseLast.total), shocked: round2(shockLast.total), diff: round2(Number(shockLast.total) - Number(baseLast.total)) } : null,
    };
  }

  /**
   * Corre una prueba entera: aplica el cambio, recalcula y compara. Devuelve también la trayectoria, para pintarla, y en `info` lo
   * que ha cambiado (de quién y cuántos meses, la cuota de antes y la de después, el día del imprevisto) para decirlo en la pantalla.
   * `params`: { concept, months } para el sueldo; { shocks, missing } para el Euribor (ya calculados con euriborShocks).
   * @param {string} presetId
   * @param {any} baseInput
   * @param {any[]} baseRows
   * @param {any} deps
   * @param {{ today?: string, to?: string, floor?: number, params?: any }} [options]
   */
  function evaluate(presetId, baseInput, baseRows, deps, { today, to, floor = 0, params = {} } = {}) {
    const preset = PRESETS.find((item) => item.id === presetId);
    if (!preset || !baseInput?.months?.length || !baseRows?.length) return null;
    const baseLow = lowIn(baseRows, today, to);
    let changed;
    if (preset.id === "sueldo-menos") changed = applySueldoMenos(baseInput, { today, months: params.months || 3, concept: params.concept || "" });
    else if (preset.id === "euribor") {
      if (!params.shocks?.length) return { preset, applied: false, missing: params.missing || [] };
      changed = applyEuribor(baseInput, { shocks: params.shocks });
    } else changed = applyImprevisto(baseInput, { date: baseLow?.date, amount: preset.amount });
    if (!changed.applied) return { preset, applied: false, missing: [] };
    const result = run(changed.input, deps, `prueba de estrés: ${preset.id}`);
    return { preset, applied: true, valid: result.valid, info: changed.info, rows: result.rows, comparison: compare(baseRows, result.rows, { today, to, floor }) };
  }

  return Object.freeze({ SCHEMA_ID, PRESETS, SUELDO_MESES, EURIBOR_PUNTOS, titulares, firstUnpaidMonthIndex, applySueldoMenos, euriborShocks, applyEuribor, applyImprevisto, applyGastoMas, run, compare, evaluate });
});
