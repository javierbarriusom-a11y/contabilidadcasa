/**
 * canonical-long-horizon.js
 *
 * FX-50 (backlog de noviembre, P1): «Hasta 2036», legible. A diez años, una línea diaria con su cifra al euro dice más de lo que se sabe.
 * Este motor pasa la previsión a año a año: la liquidez de cada 31 de diciembre, con un abanico que se abre con los años, y los hitos
 * que importan a esa distancia (deuda cero, fin de la hipoteca, colchón completo).
 *
 *   · El abanico no se inventa: es cuánto cambia la liquidez de cada 31/12 si los supuestos del plan salen un punto peor o mejor (los de
 *     FX-51: inflación, subida de los ingresos, gasto e ingresos previstos, recalculados con el mismo motor). Los cuatro se combinan
 *     como errores independientes (raíz de la suma de cuadrados) y se aplican hacia los dos lados. Se abre solo, porque cada año
 *     arrastra el efecto compuesto de los anteriores.
 *   · Los hitos salen de la deuda mes a mes (canonical-debt-horizon.js, la misma que la tabla de impacto de FX-20) y de la liquidez de
 *     cada fin de mes: el primer mes en que la deuda viva llega a cero, en que la hipoteca queda pagada, en que la liquidez cubre el
 *     colchón objetivo. Lo que ya se cumple hoy no es un hito; lo que no llega antes del final del plan, se dice.
 *
 * Motor puro: sin DOM, red ni almacenamiento. No cambia nada (A11-4).
 */

(function attachCanonicalLongHorizon(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalLongHorizon = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function canonicalLongHorizonFactory() {
  "use strict";

  const SCHEMA_ID = "finance-long-horizon/v1";
  const ZERO = 0.5;

  const finite = (value) => value !== null && value !== "" && Number.isFinite(Number(value));

  /** El saldo del último día de cada mes y de cada 31 de diciembre de la trayectoria diaria (`rows` con `date` y `total`), desde `today`. */
  function monthEnds(rows, today) {
    const ends = new Map();
    (Array.isArray(rows) ? rows : []).forEach((row) => {
      if (!row || String(row.date) < String(today || "") || !finite(row.total)) return;
      ends.set(String(row.date).slice(0, 7), { monthKey: String(row.date).slice(0, 7), date: String(row.date), total: Number(row.total) });
    });
    return [...ends.values()];
  }

  /** Un punto por año: el 31/12 (o el último día del plan, si acaba antes de diciembre). */
  function yearEnds(rows, today) {
    const months = monthEnds(rows, today);
    const byYear = new Map();
    months.forEach((month) => byYear.set(month.monthKey.slice(0, 4), month));
    return [...byYear.values()];
  }

  /**
   * El abanico de cada año: `impacts` es la salida de assumptionImpacts (canonical-forecast-contract.js) con un objetivo por 31/12
   * (`effects[].monthKey`, `effects[].diff`). Cada supuesto mueve la cifra `diff`; juntos, como errores independientes.
   */
  function fan(points, impacts) {
    return (points || []).map((point) => {
      const diffs = (impacts || []).map((impact) => (impact.effects || []).find((effect) => effect.monthKey === point.monthKey)?.diff).filter(finite).map(Number);
      const spread = Math.sqrt(diffs.reduce((sum, diff) => sum + diff * diff, 0));
      return { ...point, low: point.total - spread, center: point.total, high: point.total + spread, spread, shocks: diffs.length };
    });
  }

  /**
   * Los hitos del horizonte, en orden de llegada. `debt`: `[{ monthKey, total, mortgage }]` (deuda viva y la de la hipoteca a fin de
   * cada mes; `mortgage` null si no hay hipoteca); `liquidity`: `[{ monthKey, total }]`; `cushionTarget`: la liquidez del colchón
   * objetivo (meses × gasto), 0 sin objetivo. Devuelve `{ hitos, pendientes }`: lo que llega (con su mes) y lo que no llega antes del final.
   * @param {{ debt?: Array<{monthKey: string, total: number, mortgage?: number|null}>, liquidity?: Array<{monthKey: string, total: number}>, cushionTarget?: number }} [input]
   */
  function milestones(input) {
    const { debt = [], liquidity = [], cushionTarget = 0 } = input || {};
    const hitos = [];
    const pendientes = [];
    const firstWhere = (series, test) => series.find(test)?.monthKey || "";
    const check = (id, label, series, value, test) => {
      if (!series.length || !finite(value(series[0]))) return;
      if (test(series[0])) return; // ya se cumple hoy: no es un hito
      const monthKey = firstWhere(series, (item) => finite(value(item)) && test(item));
      if (monthKey) hitos.push({ id, label, monthKey });
      else pendientes.push({ id, label });
    };
    check("deuda-cero", "Deuda cero", debt, (item) => item.total, (item) => Number(item.total) <= ZERO);
    check("fin-hipoteca", "Fin de la hipoteca", debt.filter((item) => finite(item.mortgage)), (item) => item.mortgage, (item) => Number(item.mortgage) <= ZERO);
    if (Number(cushionTarget) > 0) check("colchon", "Colchón completo", liquidity, (item) => item.total, (item) => Number(item.total) >= Number(cushionTarget));
    hitos.sort((a, b) => a.monthKey.localeCompare(b.monthKey));
    return { hitos, pendientes };
  }

  return Object.freeze({ SCHEMA_ID, monthEnds, yearEnds, fan, milestones });
});
