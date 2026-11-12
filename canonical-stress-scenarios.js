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
  const IMPREVISTO_IMPORTES = Object.freeze([1000, 3000, 6000]); // FX-21 (7/11/2026): el importe se elige; 3.000 € sigue siendo el de D-N3
  // FX-22 (9/11/2026): «¿Y si…?», la prueba que escribe el hogar (gasto único, cambio de ingreso o de gasto al mes). No está en la
  // fila de las de D-N3 ni se combina con ellas: responde «¿nos lo podemos permitir?».
  const YSI = Object.freeze({ id: "ysi", label: "¿Y si…?", short: "¿Y si…?" });

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
    return rateShocks(reviews, (review) => Number(review.centralRate) + points, payment);
  }

  /** La cuota de cada hipoteca desde su revisión con el tipo que dé `rateFor(review)` (FX-27: también un tipo fijo ofrecido). */
  function rateShocks(reviews, rateFor, payment) {
    return (reviews || [])
      .filter((review) => review?.status === "ok" && finite(review.currentPayment) && Number(review.currentPayment) > 0)
      .map((review) => {
        const rate = round2(rateFor(review));
        const to = round2(payment(review.principalAtReview, rate, review.remainingAtReview));
        // FX-20 (10/11/2026): con el capital en la revisión, para saber cuánto se debe de más a 24 meses (canonical-debt-horizon.js).
        return { date: review.nextReview, from: round2(review.currentPayment), to, extra: round2(to - Number(review.currentPayment)), rate, months: Math.max(1, Number(review.remainingAtReview) || 1), principal: round2(Number(review.principalAtReview) || 0) };
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
   * @param {{ date?: string, amount?: number, concept?: string }} [options]
   */
  function applyImprevisto(input, { date, amount = 3000, concept = "Imprevisto (prueba de estrés)" } = {}) {
    const next = clone(input);
    const month = (next.months || []).find((item) => item.monthKey === String(date || "").slice(0, 7));
    if (!month) return { input: next, applied: false };
    month.coreSpend = round2(Number(month.coreSpend || 0) + amount);
    month.expenseEvents = [...(month.expenseEvents || []), { concept, amount, field: "fixedCoreSpend", day: Number(date.slice(8, 10)), date, source: "prueba de estrés", confidence: "rule", role: "" }];
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

  // ---- FX-22 PR-2 · aplazar un pago (10/11/2026) --------------------------------------------------------------------------
  // Un cargo del plan (un gasto fijo, el coche, una financiación o un proyecto) se mueve 1, 2 o 3 meses, al mismo día del mes. Sale de
  // su mes por su partida y entra en el de destino como gasto fijo de ese día, igual que el imprevisto: así el total de cada mes es el
  // de Escenarios con dos «Cambio de gasto» (−importe en su mes, +importe en el de destino) y el diario lo pone justo ese día.
  const APLAZAR_MESES = Object.freeze([1, 2, 3]);
  const APLAZABLES = Object.freeze(["fixedCoreSpend", "car", "refi"]);

  function addMonthsToDate(iso, months) {
    const [year, month, day] = String(iso).split("-").map(Number);
    const index = year * 12 + (month - 1) + months;
    const targetYear = Math.floor(index / 12);
    const targetMonth = (index % 12) + 1;
    const lastDay = new Date(targetYear, targetMonth, 0).getDate();
    return `${targetYear}-${String(targetMonth).padStart(2, "0")}-${String(Math.min(day, lastDay)).padStart(2, "0")}`;
  }

  /**
   * Los pagos que se pueden aplazar entre `from` y `to` (AAAA-MM-DD), del mayor al menor: los cargos fechados de su partida (no el gasto
   * variable estimado, que no es un pago) y lo que paga de golpe un proyecto o decisión el día de la nómina. `key` los identifica.
   * @param {any} input la entrada del plan
   * @param {{ from: string, to: string, minAmount?: number }} options
   */
  function pagosAplazables(input, { from, to, minAmount = 0 }) {
    const pagos = [];
    (input?.months || []).forEach((month) => {
      (month.expenseEvents || []).forEach((event) => {
        if (!APLAZABLES.includes(event.field) || !event.date || event.date < from || event.date > to) return;
        if (!(Number(event.amount) > 0) || Number(event.amount) < minAmount) return;
        const key = `${event.date}|${event.field}|${event.concept || ""}`;
        if (!pagos.some((pago) => pago.key === key)) pagos.push({ key, monthKey: month.monthKey, field: event.field, concept: event.concept || "Pago", date: event.date, amount: round2(event.amount) });
      });
      const proyecto = round2(Number(month.projectOutflow) || 0);
      const date = month.mainPayrollDate;
      if (proyecto > 0 && proyecto >= minAmount && date && date >= from && date <= to) pagos.push({ key: `${date}|projectOutflow|`, monthKey: month.monthKey, field: "projectOutflow", concept: "Proyecto o decisión", date, amount: proyecto });
    });
    return pagos.sort((a, b) => b.amount - a.amount || a.date.localeCompare(b.date));
  }

  /**
   * Aplaza un pago `months` meses (APLAZAR_MESES). Sin el pago, o si el destino cae fuera del plan, no se aplica nada.
   * @param {any} input
   * @param {{ key: string, months?: number }} options
   */
  function applyAplazar(input, { key, months = 1 }) {
    const next = clone(input);
    const [date, field, concept = ""] = String(key || "").split("|");
    const n = APLAZAR_MESES.includes(Number(months)) ? Number(months) : 1;
    const origen = (next.months || []).find((month) => month.monthKey === String(date).slice(0, 7));
    if (!origen || !field) return { input: next, applied: false };
    const index = (origen.expenseEvents || []).findIndex((event) => event.date === date && event.field === field && (event.concept || "") === concept);
    const amount = round2(field === "projectOutflow" ? Number(origen.projectOutflow) || 0 : index >= 0 ? origen.expenseEvents[index].amount : 0);
    const valido = field === "projectOutflow" ? origen.mainPayrollDate === date : APLAZABLES.includes(field) && index >= 0;
    if (!valido || !(amount > 0)) return { input: next, applied: false };
    const toDate = addMonthsToDate(date, n);
    const destino = (next.months || []).find((month) => month.monthKey === toDate.slice(0, 7));
    if (!destino) return { input: next, applied: false };
    if (field === "projectOutflow") origen.projectOutflow = round2(Number(origen.projectOutflow) - amount);
    else {
      origen.expenseEvents = origen.expenseEvents.filter((event, i) => i !== index);
      if (field === "fixedCoreSpend") origen.coreSpend = round2(Number(origen.coreSpend || 0) - amount);
      else origen[field] = round2(Number(origen[field] || 0) - amount);
    }
    const nombre = field === "projectOutflow" ? "Proyecto o decisión" : concept || "Pago";
    destino.coreSpend = round2(Number(destino.coreSpend || 0) + amount);
    destino.expenseEvents = [...(destino.expenseEvents || []), { concept: `${nombre} (aplazado)`, amount, field: "fixedCoreSpend", day: Number(toDate.slice(8, 10)), date: toDate, source: "¿y si…? · aplazado", confidence: "rule", role: "" }];
    return { input: next, applied: true, info: { concept: nombre, amount, from: date, to: toDate, months: n, field } };
  }

  /**
   * FX-22 · «¿Y si…?»: hasta tres palancas a la vez sobre la entrada del plan. Un gasto único (importe y día, como el imprevisto), un
   * cambio de ingreso al mes y un cambio de gasto al mes (importe con signo, desde un mes, durante N meses o hasta el final). Cambian
   * los mismos campos que los tipos de Escenarios («Imprevisto», «Cambio de ingreso», «Cambio de gasto»), así que al guardarla los meses
   * cuadran. Sin ningún importe, no se aplica nada.
   * @param {any} input
   * Desde el 10/11/2026 (FX-22 PR-2), una cuarta: aplazar un pago 1, 2 o 3 meses (applyAplazar).
   * @param {{ unico?: {amount?: number, date?: string}|null, ingreso?: {delta?: number, from?: string, months?: number}|null, gasto?: {delta?: number, from?: string, months?: number}|null, aplazar?: {key: string, months?: number}|null }} [params]
   */
  function applyYSi(input, { unico = null, ingreso = null, gasto = null, aplazar = null } = {}) {
    let next = clone(input);
    const info = {};
    // FX-22 PR-2: el pago aplazado va primero, sobre el plan tal cual (sus meses no dependen de las otras palancas).
    if (aplazar?.key) {
      const changed = applyAplazar(next, aplazar);
      if (changed.applied) {
        next = changed.input;
        info.aplazar = changed.info;
      }
    }
    if (unico && Number(unico.amount) > 0 && unico.date) {
      const changed = applyImprevisto(next, { date: unico.date, amount: round2(unico.amount), concept: "Gasto único (¿y si…?)" });
      if (changed.applied) {
        next = changed.input;
        info.unico = { date: unico.date, amount: round2(unico.amount) };
      }
    }
    const tramo = (lever) => {
      const all = (next.months || []).filter((month) => month.monthKey >= String(lever.from || ""));
      return Number(lever.months) > 0 ? all.slice(0, Math.floor(Number(lever.months))) : all;
    };
    [["ingreso", "income"], ["gasto", "coreSpend"]].forEach(([key, field]) => {
      const lever = key === "ingreso" ? ingreso : gasto;
      const delta = round2(Number(lever?.delta) || 0);
      if (!lever || !delta || !lever.from) return;
      const months = tramo(lever);
      if (!months.length) return;
      months.forEach((month) => { month[field] = round2(Number(month[field] || 0) + delta); });
      info[key] = { delta, from: months[0].monthKey, to: months.at(-1).monthKey, months: months.length };
    });
    const applied = Boolean(info.unico || info.ingreso || info.gasto || info.aplazar);
    return { input: next, applied, info, missing: applied ? [] : ["un importe o un pago que aplazar en alguna de las palancas"] };
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
   * El suelo también en la cuenta corriente (decisión del hogar del 6/11/2026): el primer día del tramo en que la cuenta corriente
   * baja de su suelo (la reserva operativa de Ajustes, o 0 € si no hay: no quedar en descubierto), su punto más bajo, lo que habría
   * que pasar del ahorro antes de ese día, si el ahorro de ese día alcanza y, si lo hay y basta, el traspaso al ahorro de antes que
   * habría que hacer más pequeño. Null si las filas no separan la cuenta del ahorro.
   * @param {any[]} rows
   * @param {{ today?: string, to?: string, checkingFloor?: number }} [options]
   */
  function checkingShortfall(rows, { today, to, checkingFloor = 0 } = {}) {
    const tramo = (rows || []).filter((row) => row.date >= today && row.date <= to && finite(row.checking));
    if (!tramo.length) return null;
    const floor = Math.max(0, Number(checkingFloor) || 0);
    const lowest = tramo.reduce((low, row) => (Number(row.checking) < Number(low.checking) ? row : low));
    const first = tramo.find((row) => Number(row.checking) < floor - 0.5) || null;
    const gap = first ? round2(floor - Number(lowest.checking)) : 0;
    // El último traspaso de la cuenta al ahorro antes de cruzar: si basta, el remedio es traspasar menos ese día, no deshacerlo después.
    let sweep = null;
    if (first) {
      tramo.filter((row) => row.date <= first.date).forEach((row) => (row.events || []).forEach((event) => {
        const out = round2(Number(event.beforeChecking) - Number(event.checking));
        if (event.kind === "transfer" && out > 0) sweep = { date: row.date, label: event.label || "", amount: out };
      }));
    }
    return {
      floor,
      low: { date: lowest.date, value: round2(lowest.checking) },
      crossDate: first?.date || null,
      gap,
      coveredBySavings: first ? Number(lowest.savings || 0) >= gap : true,
      sweep: sweep && sweep.amount >= gap ? sweep : null,
    };
  }

  /**
   * La comparación que enseña la pantalla: el punto más bajo del plan y del escenario, si se baja del suelo y cuándo, cuánto falta,
   * cuánto cambia el 31/12 y al final del horizonte (`to`), y el recorte mensual de gasto que lo arreglaría (repartido entre hoy y el día más bajo).
   * @param {any[]} baseRows
   * @param {any[]} shockedRows
   * @param {{ today?: string, to?: string, floor?: number, checkingFloor?: number }} [options]
   */
  function compare(baseRows, shockedRows, { today, to, floor = 0, checkingFloor = 0 } = {}) {
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
      checking: { base: checkingShortfall(baseRows, { today, to, checkingFloor }), shocked: checkingShortfall(shockedRows, { today, to, checkingFloor }) },
      end: baseLast && shockLast ? { date: baseLast.date, base: round2(baseLast.total), shocked: round2(shockLast.total), diff: round2(Number(shockLast.total) - Number(baseLast.total)) } : null,
    };
  }

  /**
   * Una prueba sobre una entrada. El imprevisto cae el día `lowDate` (el peor de la trayectoria de la que parte).
   * @param {any} preset
   * @param {any} input
   * @param {{ today?: string, params?: any, lowDate?: string }} [options]
   * @returns {any}
   */
  function applyPart(preset, input, { today, params = {}, lowDate } = {}) {
    if (preset.id === "ysi") return applyYSi(input, params);
    if (preset.id === "sueldo-menos") return applySueldoMenos(input, { today, months: params.months || 3, concept: params.concept || "" });
    if (preset.id === "euribor") {
      if (!params.shocks?.length) return { input, applied: false, missing: params.missing || [] };
      return applyEuribor(input, { shocks: params.shocks });
    }
    return applyImprevisto(input, { date: lowDate, amount: Number(params?.amount) > 0 ? Number(params.amount) : preset.amount });
  }

  // FX-27 (XDO-02 en parte, 12/11/2026): la revisión de la hipoteca como escenario con fecha. A 120 días o menos de una revisión, la prueba
  // del Euribor pasa a la primera posición de «Comparar con» y la revisión se enseña en tres caminos (el Euribor tecleado sin cambio, +1 y +2
  // puntos) y, si el hogar ha tecleado una oferta a tipo fijo (DEB-4), el fijo desde ese mismo día. Sin tipos de mercado en vivo.
  const REVIEW_SOON_DAYS = 120;
  const REVIEW_PATH_POINTS = Object.freeze([0, 1, 2]);

  /** La revisión más cercana de las que están por venir (`daysToReview` ≥ 0), o null. */
  function nearestReview(reviews) {
    return (reviews || []).filter((review) => review?.status === "ok" && finite(review.daysToReview) && Number(review.daysToReview) >= 0)
      .sort((a, b) => Number(a.daysToReview) - Number(b.daysToReview))[0] || null;
  }

  /** ¿Hay una revisión a `REVIEW_SOON_DAYS` días o menos? */
  function reviewSoon(reviews, windowDays = REVIEW_SOON_DAYS) {
    const next = nearestReview(reviews);
    return Boolean(next && Number(next.daysToReview) <= windowDays);
  }

  /**
   * Los caminos de la revisión: `{ id, label, rate, shocks }` para sin cambio, +1 y +2 y, con `fixedRate` (> 0) y una sola hipoteca, el
   * fijo. Con varias hipotecas la oferta fija no se sabe a cuál va (DEB-4 guarda una), y no se inventa: sale sin el camino fijo.
   * @param {any[]} reviews
   * @param {{ payment: (principal: number, rate: number, months: number) => number, fixedRate?: number|null, points?: readonly number[] }} options
   */
  function reviewPaths(reviews, { payment, fixedRate = null, points = REVIEW_PATH_POINTS } = /** @type {any} */ ({})) {
    const ok = (reviews || []).filter((review) => review?.status === "ok");
    if (!ok.length || typeof payment !== "function") return [];
    const paths = points.map((p) => ({ id: p ? `mas-${p}` : "sin-cambio", label: p ? `Euribor +${p} ${p === 1 ? "punto" : "puntos"}` : "Euribor sin cambio", points: p, shocks: euriborShocks(ok, p, payment) }))
      .map((path) => ({ ...path, rate: path.shocks[0]?.rate ?? null }));
    if (finite(fixedRate) && Number(fixedRate) > 0 && ok.length === 1) {
      const shocks = rateShocks(ok, () => Number(fixedRate), payment);
      paths.push({ id: "fija", label: "Oferta a tipo fijo", points: null, rate: shocks[0]?.rate ?? null, shocks });
    }
    return paths.filter((path) => path.shocks.length);
  }

  /**
   * Corre una prueba entera: aplica el cambio, recalcula y compara. Devuelve también la trayectoria, para pintarla, y en `info` lo
   * que ha cambiado (de quién y cuántos meses, la cuota de antes y la de después, el día del imprevisto) para decirlo en la pantalla.
   * `params`: { concept, months } para el sueldo; { shocks, missing } para el Euribor (ya calculados con euriborShocks).
   * @param {string} presetId
   * @param {any} baseInput
   * @param {any[]} baseRows
   * @param {any} deps
   * @param {{ today?: string, to?: string, floor?: number, checkingFloor?: number, params?: any }} [options]
   */
  function evaluate(presetId, baseInput, baseRows, deps, { today, to, floor = 0, checkingFloor = 0, params = {} } = {}) {
    const preset = PRESETS.find((item) => item.id === presetId) || (presetId === YSI.id ? YSI : null);
    if (!preset || !baseInput?.months?.length || !baseRows?.length) return null;
    const changed = applyPart(preset, baseInput, { today, params, lowDate: lowIn(baseRows, today, to)?.date });
    if (!changed.applied) return { preset, applied: false, missing: changed.missing || [] };
    const result = run(changed.input, deps, `prueba de estrés: ${preset.id}`);
    return { preset, applied: true, valid: result.valid, info: changed.info, rows: result.rows, comparison: compare(baseRows, result.rows, { today, to, floor, checkingFloor }) };
  }

  /**
   * FX-20 · dos pruebas a la vez (7/11/2026): las dos sobre la misma entrada del plan, una detrás de otra, y un solo recálculo. Lo que
   * de verdad preocupa no es cada golpe por separado sino que coincidan (un sueldo menos el año en que la hipoteca sube).
   * El imprevisto va siempre el último y cae el peor día de la trayectoria que ya lleva la otra prueba: «el peor día» es el de la
   * combinación, no el del plan. Si una de las dos no se puede aplicar, no hay combinación (se dice cuál y por qué falta).
   * @param {Array<{ id: string, params?: any }>} parts dos pruebas distintas
   * @param {any} baseInput
   * @param {any[]} baseRows
   * @param {any} deps
   * @param {{ today?: string, to?: string, floor?: number, checkingFloor?: number }} [options]
   */
  function evaluateCombined(parts, baseInput, baseRows, deps, { today, to, floor = 0, checkingFloor = 0 } = {}) {
    const elegidas = (Array.isArray(parts) ? parts : []).map((part) => ({ preset: PRESETS.find((item) => item.id === part?.id), params: part?.params || {} }));
    if (elegidas.length !== 2 || elegidas.some((part) => !part.preset) || elegidas[0].preset.id === elegidas[1].preset.id) return null;
    if (!baseInput?.months?.length || !baseRows?.length) return null;
    const ordenadas = elegidas.slice().sort((a, b) => Number(a.preset.id === "imprevisto") - Number(b.preset.id === "imprevisto"));
    const combinada = { id: "combinada", label: ordenadas.map((part) => part.preset.label).join(" y "), short: ordenadas.map((part) => part.preset.short).join(" + ") };
    let input = baseInput;
    let rows = baseRows;
    const hechas = [];
    for (const [index, part] of ordenadas.entries()) {
      if (part.preset.id === "imprevisto" && index > 0) rows = run(input, deps, "prueba de estrés: combinada (antes del imprevisto)").rows;
      const changed = applyPart(part.preset, input, { today, params: part.params, lowDate: lowIn(rows, today, to)?.date });
      if (!changed.applied) return { preset: combinada, combined: true, applied: false, failed: part.preset, missing: changed.missing || [] };
      input = changed.input;
      hechas.push({ preset: part.preset, params: part.params, info: changed.info });
    }
    const result = run(input, deps, "prueba de estrés: combinada");
    return { preset: combinada, combined: true, parts: hechas, applied: true, valid: result.valid, info: null, rows: result.rows, comparison: compare(baseRows, result.rows, { today, to, floor, checkingFloor }) };
  }

  /**
   * FX-20 · un escenario guardado en la previsión (8/11/2026). Escenarios lo resuelve por meses (canonical-scenario-engine.js
   * resolveEscenario, con sus guardarraíles y sus deudas); aquí sus meses entran en el mismo recálculo diario que las pruebas, y se
   * compara igual con el plan. Los meses del motor mensual son los mismos que ve Escenarios (mismo buildScenario sobre la misma
   * entrada); el día es aproximado: los cambios de ingreso y gasto caen en los días de cobros y pagos de su tipo en ese mes, y lo que
   * se paga de golpe, el día más bajo del plan en ese mes. Sin ninguna decisión aplicada, no hay nada que comparar.
   * @param {any} resolved la salida de resolveEscenario()
   * @param {any} baseInput la entrada del plan con la que se resolvió
   * @param {any[]} baseRows
   * @param {any} deps
   * @param {{ today?: string, to?: string, floor?: number, checkingFloor?: number, label?: string, short?: string }} [options]
   */
  function evaluateResolved(resolved, baseInput, baseRows, deps, { today, to, floor = 0, checkingFloor = 0, label = "Escenario guardado", short = "Escenario" } = {}) {
    const preset = { id: "guardado", label, short };
    if (!baseInput?.months?.length || !baseRows?.length) return null;
    const resultados = Array.isArray(resolved?.resultados) ? resolved.resultados : [];
    const aplicadas = resultados.filter((item) => item.resultado === "aplicada");
    const rechazadas = resultados.filter((item) => item.resultado !== "aplicada" && item.resultado !== "inactiva");
    if (!resolved?.valid || !Array.isArray(resolved.months) || resolved.months.length !== baseInput.months.length) {
      return { preset, saved: true, applied: false, missing: [], reason: resolved?.reason || "sin-resolver" };
    }
    if (!aplicadas.length) return { preset, saved: true, applied: false, missing: [], reason: "ninguna-aplicada", info: { aplicadas: 0, rechazadas: rechazadas.length } };
    // Lo que el escenario paga de golpe en un mes (una compra, un imprevisto, una cuota) cae el día más bajo del plan en ese mes, no
    // el de la nómina: tras la nómina no se vería en el punto más bajo, que es lo que la Previsión enseña. Es lo prudente, y lo que
    // hace la prueba del imprevisto. Lo que entra (un préstamo nuevo) sigue el día de la nómina.
    const projectOutflowSplit = {};
    resolved.months.forEach((month, index) => {
      const extra = round2(Number(month.projectOutflow || 0) - Number(baseInput.months[index]?.projectOutflow || 0));
      if (!(extra > 0)) return;
      const low = lowIn(baseRows, today && today > `${month.monthKey}-01` ? today : `${month.monthKey}-01`, `${month.monthKey}-31`);
      if (low) projectOutflowSplit[month.monthKey] = { amount: extra, date: low.date, label: "Pago del escenario" };
    });
    const dailyDeps = { ...deps, dailyOptions: { ...(deps.dailyOptions || {}), projectOutflowSplit } };
    const result = run({ ...baseInput, months: resolved.months }, dailyDeps, "escenario guardado");
    return { preset, saved: true, applied: true, valid: result.valid, info: { aplicadas: aplicadas.length, rechazadas: rechazadas.length }, rows: result.rows, comparison: compare(baseRows, result.rows, { today, to, floor, checkingFloor }) };
  }

  function euros(value) {
    const n = Math.round(Math.abs(Number(value) || 0));
    return `${Number(value) < 0 ? "−" : ""}${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".")} €`;
  }

  function nextMonthKey(monthKey) {
    const [year, month] = String(monthKey).split("-").map(Number);
    return month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, "0")}`;
  }

  /**
   * «Guardar como escenario» (FX-21, 7/11/2026): la prueba ya aplicada, dicha con los tipos de fábrica de Escenarios
   * (canonical-scenario-engine.js), para seguir con ella allí. Cada decisión cambia la entrada del plan igual que la prueba:
   *   · un sueldo menos → «Cambio de ingreso» negativo, un tramo por cada importe distinto (una paga extra no se promedia);
   *   · el Euribor → «Cambio de gasto» con lo que sube la cuota, del mes de la revisión a su último plazo dentro del plan;
   *   · el imprevisto → «Imprevisto» del mismo importe en su mes.
   * Todas con el mes fijado (planificación «manual»): el modo «óptimo» de Escenarios movería la prueba a otro mes.
   * Lo único que no pasa es el día: Escenarios cuenta por meses. Sin `id` ni `orden`: los pone quien guarda.
   * @param {any} result la salida de evaluate()
   * @param {any} baseInput la entrada del plan con la que se evaluó
   */
  function toDecisions(result, baseInput) {
    // Dos pruebas a la vez: las decisiones de cada una, en el orden en que se aplicaron.
    if (result?.applied && Array.isArray(result.parts)) return result.parts.flatMap((part) => toDecisions({ preset: part.preset, applied: true, info: part.info }, baseInput));
    if (!result?.applied || !result.info) return [];
    const months = baseInput?.months || [];
    const decision = (tipo, titulo, mes, params) => ({ tipo, titulo: String(titulo).slice(0, 60), activa: true, planificacion: { modo: "manual", mesManual: mes }, params });
    const id = result.preset?.id;
    if (id === "ysi") {
      const info = result.info;
      const lista = [];
      if (info.unico) {
        const mes = String(info.unico.date).slice(0, 7);
        if (months.some((month) => month.monthKey === mes)) lista.push(decision("imprevisto", `Gasto único de ${euros(info.unico.amount)}`, mes, { importe: info.unico.amount, mes }));
      }
      if (info.ingreso) lista.push(decision("cambio_ingreso", `Ingreso ${info.ingreso.delta < 0 ? "−" : "+"}${euros(Math.abs(info.ingreso.delta))} al mes`, info.ingreso.from, { titular: "hogar", deltaMensual: info.ingreso.delta, mesInicio: info.ingreso.from, mesFin: info.ingreso.to }));
      if (info.gasto) lista.push(decision("cambio_gasto", `Gasto ${info.gasto.delta < 0 ? "−" : "+"}${euros(Math.abs(info.gasto.delta))} al mes`, info.gasto.from, { bloque: "Gasto del mes", deltaMensual: info.gasto.delta, mesInicio: info.gasto.from, mesFin: info.gasto.to }));
      // FX-22 PR-2: aplazar es quitarlo de su mes y ponerlo en el de destino; en Escenarios, dos «Cambio de gasto» de un mes.
      if (info.aplazar) {
        const { concept, amount, from, to } = info.aplazar;
        const desde = String(from).slice(0, 7);
        const hasta = String(to).slice(0, 7);
        if (months.some((month) => month.monthKey === desde) && months.some((month) => month.monthKey === hasta)) {
          lista.unshift(
            decision("cambio_gasto", `Aplazar «${concept}»: sale de su mes`, desde, { bloque: `Aplazar «${concept}»`, deltaMensual: -amount, mesInicio: desde, mesFin: desde }),
            decision("cambio_gasto", `Aplazar «${concept}»: entra ${euros(amount)}`, hasta, { bloque: `Aplazar «${concept}»`, deltaMensual: amount, mesInicio: hasta, mesFin: hasta }),
          );
        }
      }
      return lista;
    }
    if (id === "imprevisto") {
      const mes = String(result.info.date || "").slice(0, 7);
      const importe = round2(result.info.amount);
      if (!months.some((month) => month.monthKey === mes) || !(importe > 0)) return [];
      return [decision("imprevisto", `Imprevisto de ${euros(importe)}`, mes, { importe, mes })];
    }
    if (id === "sueldo-menos") {
      const { concept, from, to } = result.info;
      const tramos = [];
      months.filter((month) => month.monthKey >= from && month.monthKey <= to).forEach((month) => {
        const lost = round2((month.incomeEvents || []).filter((event) => event.concept === concept).reduce((sum, event) => sum + Number(event.amount || 0), 0));
        if (!(lost > 0)) return;
        const last = tramos.at(-1);
        if (last && last.lost === lost && nextMonthKey(last.to) === month.monthKey) last.to = month.monthKey;
        else tramos.push({ from: month.monthKey, to: month.monthKey, lost });
      });
      return tramos.map((tramo) => decision("cambio_ingreso", `Sin «${concept}»`, tramo.from, { titular: "hogar", deltaMensual: -tramo.lost, mesInicio: tramo.from, mesFin: tramo.to }));
    }
    if (id === "euribor") {
      return (result.info.shocks || []).filter((shock) => shock.extra > 0).map((shock) => {
        const startKey = String(shock.date).slice(0, 7);
        const tocados = months.filter((month) => month.monthKey >= startKey).slice(0, shock.months);
        if (!tocados.length) return null;
        return decision("cambio_gasto", `Hipoteca: cuota de ${euros(shock.from)} a ${euros(shock.to)}`, tocados[0].monthKey, { bloque: "Cuota de la hipoteca", deltaMensual: round2(shock.extra), mesInicio: tocados[0].monthKey, mesFin: tocados.at(-1).monthKey });
      }).filter(Boolean);
    }
    return [];
  }

  return Object.freeze({ SCHEMA_ID, PRESETS, YSI, SUELDO_MESES, EURIBOR_PUNTOS, IMPREVISTO_IMPORTES, APLAZAR_MESES, REVIEW_SOON_DAYS, REVIEW_PATH_POINTS, pagosAplazables, applyAplazar, titulares, firstUnpaidMonthIndex, applySueldoMenos, euriborShocks, rateShocks, nearestReview, reviewSoon, reviewPaths, applyEuribor, applyImprevisto, applyYSi, applyGastoMas, run, checkingShortfall, compare, evaluate, evaluateCombined, evaluateResolved, toDecisions });
});
