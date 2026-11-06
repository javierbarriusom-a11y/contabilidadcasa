/**
 * canonical-forecast-contract.js
 *
 * FX-01 (BACKLOG_NOVIEMBRE_OLEADA_1.md §5.1, docs/PROPUESTA_OCTAVA_AUDITORIA_2026-11-05.md §5): el contrato de las cifras de
 * previsión. Cada cifra que la app enseña sobre el futuro se declara aquí una vez (qué mide, en qué unidad, de qué motor sale y
 * con qué precisión se enseña), para que la misma etiqueta dé el mismo valor en todas las pantallas. Motor puro, sin DOM ni estado.
 *
 * Primera entrega (S0, 6/11/2026):
 * - FX-02 · el punto más bajo sale del motor diario (el mismo que usa Hoy), solo desde hoy y con su fecha real; más allá de 90 días
 *   se dice el mes, sin día. Antes, Previsión lo sacaba del motor mensual con la fecha fija en el día 1 del mes, así que el 5/11
 *   anunciaba una caída «el 01 nov», ya pasada, y unos 4.500 € por debajo de lo que decía el motor diario (demo).
 * - FX-04 · la precisión depende de lo lejos que esté la fecha: a la decena hasta 30 días, a la centena hasta un año, al millar
 *   después. Nunca céntimos en una previsión.
 * - FX-30 · el lenguaje de la incertidumbre, en palabras de hogar (TERMS).
 */

(function attachCanonicalForecastContract(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalForecastContract = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function canonicalForecastContractFactory() {
  "use strict";

  const SCHEMA_ID = "finance-canonical-forecast-contract/v1";
  /** Hasta aquí el punto más bajo lleva día; más allá, solo el mes (FX-02). */
  const DAY_PRECISION_DAYS = 90;

  /** Cada cifra de previsión, una vez. `label` es la etiqueta única que la enseña en cualquier pantalla. */
  const METRICS = Object.freeze([
    Object.freeze({ id: "saldo-previsto", label: "Saldo previsto", unit: "€", engine: "diario", definition: "Liquidez total prevista al acabar el día." }),
    Object.freeze({ id: "margen-suelo", label: "Margen sobre el suelo", unit: "€", engine: "diario", definition: "Saldo previsto menos el suelo de liquidez." }),
    Object.freeze({ id: "disponible-hasta-cobrar", label: "Disponible hasta cobrar", unit: "€", engine: "diario", definition: "El menor margen sobre el suelo entre hoy y el próximo cobro." }),
    Object.freeze({ id: "punto-mas-bajo", label: "Punto más bajo", unit: "€ y fecha", engine: "diario", definition: "El menor saldo previsto desde hoy hasta el final del horizonte, con su fecha (con día hasta 90 días; después, el mes)." }),
    Object.freeze({ id: "colchon-meses", label: "Colchón", unit: "meses", engine: "mensual", definition: "Liquidez prevista a fin de mes dividida entre las salidas de un mes." }),
  ]);

  /** FX-30: las palabras de la incertidumbre. Lo técnico (percentiles, trayectorias) va en «¿Cómo se calcula?». */
  const TERMS = Object.freeze({
    range: "Rango probable",
    rangeHint: "8 de cada 10 casos",
    central: "Lo más probable",
    worst: "Peor caso razonable",
    plan: "Según el plan",
  });

  const number = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
  const isIsoDate = (value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);

  function daysBetween(fromIso, toIso) {
    if (!isIsoDate(fromIso) || !isIsoDate(toIso)) return 0;
    const from = Date.UTC(Number(fromIso.slice(0, 4)), Number(fromIso.slice(5, 7)) - 1, Number(fromIso.slice(8, 10)));
    const to = Date.UTC(Number(toIso.slice(0, 4)), Number(toIso.slice(5, 7)) - 1, Number(toIso.slice(8, 10)));
    return Math.round((to - from) / 86400000);
  }

  /** FX-04: el paso de redondeo según lo lejos que esté la fecha de la cifra (días desde hoy). */
  function roundingStep(daysAhead) {
    const days = Math.max(0, number(daysAhead));
    if (days < 30) return 10;
    if (days <= 365) return 100;
    return 1000;
  }

  /** FX-04: la cifra redondeada a su paso. Nunca devuelve céntimos; −0 pasa a 0. */
  function roundForHorizon(value, daysAhead) {
    const step = roundingStep(daysAhead);
    const rounded = Math.round(number(value) / step) * step;
    return Object.is(rounded, -0) ? 0 : rounded;
  }

  /**
   * FX-04 para diferencias: dos cifras significativas (322 → 320, 26.907 → 27.000), nunca por debajo de la decena. La regla de
   * los niveles (millar más allá de un año) borraría una diferencia de unos cientos de euros, que sí importa.
   */
  function roundDifference(value) {
    const amount = number(value);
    if (amount === 0) return 0;
    const step = Math.max(10, 10 ** (Math.floor(Math.log10(Math.abs(amount))) - 1));
    const rounded = Math.round(amount / step) * step;
    return Object.is(rounded, -0) ? 0 : rounded;
  }

  /** «Unos» delante cuando el redondeo ha quitado algo: así no parece exacta una cifra que no lo es. */
  function isApproximate(value, daysAhead) {
    return roundForHorizon(value, daysAhead) !== Math.round(number(value));
  }

  /**
   * FX-02: el punto más bajo de las filas del motor diario entre `from` y `to` (ambos incluidos, fechas ISO). Con empate, el
   * primer día. `rows` son las de canonicalDailyEngineRuns.active.rows: { date, monthKey, total }.
   * Devuelve null si no hay ninguna fila en el tramo.
   * @param {Array<{date: string, total: number}>} rows
   * @param {{from?: string, to?: string}} [range]
   */
  function lowPoint(rows, { from, to } = {}) {
    let low = null;
    (Array.isArray(rows) ? rows : []).forEach((row) => {
      if (!row || !isIsoDate(row.date) || !Number.isFinite(Number(row.total))) return;
      if (from && row.date < from) return;
      if (to && row.date > to) return;
      if (!low || Number(row.total) < low.value) low = { date: row.date, monthKey: row.date.slice(0, 7), value: Number(row.total) };
    });
    return low;
  }

  /**
   * FX-02: el punto más bajo de cada mes, solo desde hoy (el mes en curso cuenta desde hoy, no desde el día 1).
   * @param {Array<{date: string, total: number}>} rows
   * @param {{today?: string, monthKeys?: string[]}} [options]
   */
  function monthLows(rows, { today, monthKeys } = {}) {
    const wanted = new Set(Array.isArray(monthKeys) ? monthKeys : []);
    const lows = new Map();
    (Array.isArray(rows) ? rows : []).forEach((row) => {
      if (!row || !isIsoDate(row.date) || !Number.isFinite(Number(row.total))) return;
      if (today && row.date < today) return;
      const monthKey = row.date.slice(0, 7);
      if (wanted.size && !wanted.has(monthKey)) return;
      const current = lows.get(monthKey);
      if (!current || Number(row.total) < current.value) lows.set(monthKey, { date: row.date, monthKey, value: Number(row.total) });
    });
    return lows;
  }

  const MONTHS = Object.freeze(["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]);

  /** «5 dic»; con el año solo si no es el de hoy («5 ene 2027»). */
  function shortDateLabel(iso, todayIso) {
    if (!isIsoDate(iso)) return "";
    const label = `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]}`;
    return isIsoDate(todayIso) && todayIso.slice(0, 4) === iso.slice(0, 4) ? label : `${label} ${iso.slice(0, 4)}`;
  }

  /**
   * FX-02 + FX-04: cómo decir el punto más bajo. Con día hasta 90 días («el 5 dic»); después, el mes («en mar 27»). `dateLabel`
   * y `monthLabel` los pone quien llama (la app ya tiene los suyos).
   * @param {{date: string, monthKey: string, value: number} | null} low
   * @param {{today?: string, dateLabel?: (iso: string) => string, monthLabel?: (monthKey: string) => string}} [options]
   */
  function describeLow(low, { today, dateLabel, monthLabel } = {}) {
    if (!low) return null;
    const daysAhead = Math.max(0, daysBetween(today, low.date));
    const withDay = daysAhead <= DAY_PRECISION_DAYS;
    const isToday = daysAhead === 0;
    const when = isToday
      ? "hoy"
      : withDay
        ? `el ${typeof dateLabel === "function" ? dateLabel(low.date) : shortDateLabel(low.date, today)}`
        : `en ${typeof monthLabel === "function" ? monthLabel(low.monthKey) : low.monthKey}`;
    return {
      ...low,
      daysAhead,
      withDay,
      isToday,
      when,
      value: roundForHorizon(low.value, daysAhead),
      approximate: isApproximate(low.value, daysAhead),
    };
  }

  /**
   * FX-51: lo que mueve cada supuesto general de la previsión. Cada uno se mueve en su sentido desfavorable (un punto más de
   * inflación, un punto menos de subida de ingresos, un 5 % más de gasto, un 5 % menos de ingresos), se recalcula el plan con el
   * mismo motor y se mide la liquidez en cada fecha pedida. El motor es puro y tarda ~1 ms por recálculo (demo).
   */
  const ASSUMPTION_SHOCKS = Object.freeze([
    Object.freeze({ id: "annualInflation", label: "Inflación del gasto", delta: 1, phrase: "un punto más de inflación" }),
    Object.freeze({ id: "annualIncomeGrowth", label: "Subida anual de los ingresos", delta: -1, phrase: "un punto menos de subida de los ingresos" }),
    Object.freeze({ id: "expenseFactor", label: "Gasto previsto", delta: 0.05, phrase: "un 5 % más de gasto" }),
    Object.freeze({ id: "incomeFactor", label: "Ingresos previstos", delta: -0.05, phrase: "un 5 % menos de ingresos" }),
  ]);

  /**
   * @param {(input: any) => {rows: Array<{detailMonthKey: string, totalLiquidity: number}>}} runScenario el motor (buildScenario)
   * @param {{policy?: Record<string, any>}} input la entrada del motor, sin tocar
   * @param {{targets?: string[]}} [options] las claves de mes (AAAA-MM) en que se mide; sin ellas, el último mes
   */
  function assumptionImpacts(runScenario, input, { targets } = {}) {
    if (typeof runScenario !== "function" || !input?.policy) return [];
    const liquidityAt = (rows, keys) => keys.map((key) => {
      const row = (rows || []).find((item) => item.detailMonthKey === key);
      return row && Number.isFinite(Number(row.totalLiquidity)) ? Number(row.totalLiquidity) : null;
    });
    const baseRows = runScenario(input)?.rows || [];
    const keys = Array.isArray(targets) && targets.length ? targets : [baseRows.at(-1)?.detailMonthKey].filter(Boolean);
    const base = liquidityAt(baseRows, keys);
    return ASSUMPTION_SHOCKS.map((shock) => {
      const current = number(input.policy[shock.id], shock.id.endsWith("Factor") ? 1 : 0);
      const shocked = runScenario({ ...input, policy: { ...input.policy, [shock.id]: current + shock.delta } })?.rows || [];
      const after = liquidityAt(shocked, keys);
      return {
        ...shock,
        value: current,
        effects: keys.map((monthKey, index) => ({
          monthKey,
          base: base[index],
          shocked: after[index],
          diff: base[index] === null || after[index] === null ? null : after[index] - base[index],
        })),
      };
    }).sort((a, b) => Math.abs(b.effects.at(-1)?.diff || 0) - Math.abs(a.effects.at(-1)?.diff || 0));
  }

  return Object.freeze({
    SCHEMA_ID,
    ASSUMPTION_SHOCKS,
    assumptionImpacts,
    DAY_PRECISION_DAYS,
    METRICS,
    TERMS,
    daysBetween,
    shortDateLabel,
    roundingStep,
    roundForHorizon,
    roundDifference,
    isApproximate,
    lowPoint,
    monthLows,
    describeLow,
  });
});
