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
 * Primera entrega (6/11/2026): un sueldo menos durante 3 meses, un imprevisto el peor día y el gasto variable un 10 % más alto.
 * El Euribor (+1/+2 en la revisión de la hipoteca) necesita los datos de Deuda › Contratos (WP-20) y llega en la siguiente.
 */

(function attachCanonicalStressScenarios(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalStressScenarios = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function canonicalStressScenariosFactory() {
  "use strict";

  const SCHEMA_ID = "finance-canonical-stress-scenarios/v1";
  const round2 = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
  const clone = (value) => JSON.parse(JSON.stringify(value ?? null));
  const finite = (value) => Number.isFinite(Number(value));

  const PRESETS = Object.freeze([
    Object.freeze({ id: "sueldo-menos", label: "Un sueldo menos 3 meses", short: "Un sueldo menos" }),
    Object.freeze({ id: "imprevisto", label: "Imprevisto de 3.000 € el peor día", short: "Imprevisto 3.000 €", amount: 3000 }),
    Object.freeze({ id: "gasto-mas", label: "Gasto variable un 10 % más alto", short: "Gasto +10 %", factor: 1.1 }),
  ]);

  /** El primer mes cuyo cobro principal todavía no ha llegado (el del mes en curso, si es futuro). */
  function firstUnpaidMonthIndex(months, today) {
    return months.findIndex((month) => (month.incomeEvents || []).some((event) => event.date && event.date >= today) || month.monthKey > String(today).slice(0, 7));
  }

  /**
   * Un sueldo menos: el ingreso más grande del primer mes sin cobrar desaparece durante `months` meses (por su concepto).
   * @param {any} input
   * @param {{ today?: string, months?: number }} [options]
   */
  function applySueldoMenos(input, { today, months = 3 } = {}) {
    const next = clone(input);
    const start = firstUnpaidMonthIndex(next.months || [], today);
    if (start < 0) return { input: next, applied: false };
    const biggest = (next.months[start].incomeEvents || []).reduce((best, event) => (Number(event.amount) > Number(best?.amount || 0) ? event : best), null);
    if (!biggest?.concept) return { input: next, applied: false };
    next.months.slice(start, start + months).forEach((month) => {
      const lost = (month.incomeEvents || []).filter((event) => event.concept === biggest.concept).reduce((sum, event) => sum + Number(event.amount || 0), 0);
      if (!lost) return;
      month.income = round2(Math.max(0, Number(month.income || 0) - lost));
      month.prePayrollIncome = round2(Math.max(0, Number(month.prePayrollIncome || 0) - lost));
      month.incomeEvents = (month.incomeEvents || []).filter((event) => event.concept !== biggest.concept);
    });
    return { input: next, applied: true, detail: `${biggest.concept}, ${months} meses desde ${next.months[start].month || next.months[start].monthKey}` };
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
    return { input: next, applied: true, detail: `${amount} € el ${date}` };
  }

  /**
   * El gasto variable un `factor` más alto en todos los meses.
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
    return { input: next, applied: true, detail: `×${factor}` };
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
   * cuánto cambia el 31/12 y el recorte mensual de gasto que lo arreglaría (repartido entre hoy y el día más bajo).
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
    };
  }

  /**
   * Corre una prueba entera: aplica el cambio, recalcula y compara. Devuelve también la trayectoria, para pintarla.
   * @param {string} presetId
   * @param {any} baseInput
   * @param {any[]} baseRows
   * @param {any} deps
   * @param {{ today?: string, to?: string, floor?: number }} [options]
   */
  function evaluate(presetId, baseInput, baseRows, deps, { today, to, floor = 0 } = {}) {
    const preset = PRESETS.find((item) => item.id === presetId);
    if (!preset || !baseInput?.months?.length || !baseRows?.length) return null;
    const baseLow = lowIn(baseRows, today, to);
    const changed = preset.id === "sueldo-menos"
      ? applySueldoMenos(baseInput, { today })
      : preset.id === "imprevisto"
        ? applyImprevisto(baseInput, { date: baseLow?.date, amount: preset.amount })
        : applyGastoMas(baseInput, { factor: preset.factor });
    if (!changed.applied) return { preset, applied: false };
    const result = run(changed.input, deps, `prueba de estrés: ${preset.id}`);
    return { preset, applied: true, valid: result.valid, detail: changed.detail, rows: result.rows, comparison: compare(baseRows, result.rows, { today, to, floor }) };
  }

  return Object.freeze({ SCHEMA_ID, PRESETS, firstUnpaidMonthIndex, applySueldoMenos, applyImprevisto, applyGastoMas, run, compare, evaluate });
});
