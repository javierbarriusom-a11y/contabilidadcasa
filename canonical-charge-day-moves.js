/**
 * canonical-charge-day-moves.js
 *
 * XPR-11 (séptima auditoría; backlog de noviembre, P1): mover los días de cargo a donde menos duelen. El punto más bajo del mes suele
 * caer justo antes de cobrar porque la hipoteca, los seguros y los recibos se cargan el día que eligió cada empresa, y muchas dejan
 * cambiarlo con una llamada. Este motor prueba a mover cada recibo con día conocido a cada día del 1 al 28, sobre la trayectoria
 * diaria de la previsión, y se queda con el cambio que más sube el punto más bajo de los próximos días; luego repite, hasta tres.
 *
 *   · Solo recibos con día CONOCIDO (indicado por el hogar o visto en el extracto): mover un día estimado es mover una suposición.
 *   · Puerta (XPR-11): días conocidos en al menos el 70 % del gasto fijo de los próximos días. Sin ella, no hay propuesta.
 *   · Mover un cargo del día a al b cambia el saldo de los días entre los dos: más tarde, esos días hay más; antes, menos. Se mueve
 *     en todos los meses del horizonte (es un cambio de día de cargo, no de un pago) y nunca a un día ya pasado.
 *   · Solo se propone si sube el punto más bajo al menos `minGain` €: un cambio que no se nota no merece una llamada.
 *
 * Motor puro: sin DOM, red ni almacenamiento. No cambia nada (A11-4): propone; el hogar llama y lo marca.
 */

(function attachCanonicalChargeDayMoves(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalChargeDayMoves = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function canonicalChargeDayMovesFactory() {
  "use strict";

  const SCHEMA_ID = "finance-charge-day-moves/v1";
  const FIXED_FIELDS = Object.freeze(["fixedCoreSpend", "refi"]);
  const KNOWN = Object.freeze(["declared", "observed"]);
  const GATE = 0.7;
  const MAX_DAY = 28;
  const HORIZON_DAYS = 90;

  const finite = (value) => Number.isFinite(Number(value));
  const dayOf = (iso) => Number(String(iso).slice(8, 10));
  const withDay = (iso, day) => `${String(iso).slice(0, 8)}${String(day).padStart(2, "0")}`;

  /** Los recibos fijos del horizonte, agrupados por partida (etiqueta y campo), con su día si es el mismo todos los meses. */
  function receipts(rows) {
    const byKey = new Map();
    let fixed = 0;
    let known = 0;
    rows.forEach((row) => (row.events || []).forEach((event) => {
      if (event.kind !== "outflow" || !FIXED_FIELDS.includes(event.field) || !(Number(event.amount) > 0)) return;
      const amount = Number(event.amount);
      fixed += amount;
      if (!KNOWN.includes(event.confidence)) return;
      known += amount;
      const key = `${event.field}|${event.label}`;
      if (!byKey.has(key)) byKey.set(key, { key, label: String(event.label || ""), field: event.field, charges: [] });
      byKey.get(key).charges.push({ date: event.date, amount });
    }));
    const items = [...byKey.values()]
      .map((item) => {
        const days = [...new Set(item.charges.map((charge) => dayOf(charge.date)))];
        return { ...item, day: days.length === 1 ? days[0] : null, amount: Math.max(...item.charges.map((charge) => charge.amount)) };
      })
      .filter((item) => item.day !== null);
    return { items, knownShare: fixed > 0 ? known / fixed : 0, fixed };
  }

  /** El saldo de cada día si `item` se carga el día `toDay`: los días entre el día de siempre y el nuevo cambian en su importe. */
  function shifted(balances, dates, item, toDay, today) {
    const out = balances.slice();
    item.charges.forEach((charge) => {
      const from = charge.date;
      const to = withDay(from, toDay);
      if (to < today || to === from) return;
      const [start, end, sign] = to > from ? [from, to, 1] : [to, from, -1];
      for (let at = 0; at < dates.length; at += 1) if (dates[at] >= start && dates[at] < end) out[at] += sign * charge.amount;
    });
    return out;
  }

  const lowOf = (balances, dates) => balances.reduce((low, value, at) => (value < low.value ? { value, date: dates[at] } : low), { value: Infinity, date: "" });

  /** El mínimo de cada mes (la métrica de XPR-11: el mínimo mensual, no el del horizonte, cuyo primer mes quizá ya no se puede mover). */
  function monthLows(balances, dates) {
    const lows = new Map();
    dates.forEach((date, at) => {
      const key = date.slice(0, 7);
      if (!lows.has(key) || balances[at] < lows.get(key)) lows.set(key, balances[at]);
    });
    return lows;
  }

  const median = (values) => {
    const sorted = values.slice().sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length ? (sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2) : 0;
  };

  /**
   * Hasta `maxMoves` cambios de día de cargo que suben el mínimo de cada mes de los próximos `horizonDays` días.
   * `rows`: la trayectoria diaria (con `date`, `total` y `events`). Un cambio vale por cuánto sube, sumado, el mínimo de cada mes, y no
   * se propone si baja el de alguno. Devuelve `{ ready, reason, knownShare, low, moves, gain }`:
   *   · reason: «pocos-dias» (no llega a la puerta), «sin-datos» o «nada-que-mover» (ningún cambio sube el mínimo lo bastante).
   *   · moves: `{ key, label, field, amount, fromDay, toDay, gain, months, monthKeys, low }`, en el orden en que se aplican (cada uno sobre
   *     el anterior): `gain`, lo que sube el mínimo de un mes típico de los que cambian (la mediana); `months` y `monthKeys`, en cuáles se nota.
   *   · gain: lo mismo para todos los cambios juntos; low: el punto más bajo del horizonte antes y después (`low.before`, `low.after`).
   * `canMove(item)` deja fuera lo que no se puede mover (por defecto, nada).
   */
  function suggest(rows, options) {
    const { today = "", horizonDays = HORIZON_DAYS, maxMoves = 3, minGain = 50, canMove = () => true } = options || {};
    const tramo = (Array.isArray(rows) ? rows : []).filter((row) => row && row.date >= today && finite(row.total)).slice(0, horizonDays);
    const base = { schema: SCHEMA_ID, ready: false, knownShare: 0, moves: [], gain: 0 };
    if (!tramo.length) return { ...base, reason: "sin-datos" };
    const dates = tramo.map((row) => row.date);
    const balances0 = tramo.map((row) => Number(row.total));
    const { items, knownShare } = receipts(tramo);
    const before = lowOf(balances0, dates);
    if (knownShare < GATE) return { ...base, knownShare, low: { before, after: before }, reason: "pocos-dias" };
    const lows0 = monthLows(balances0, dates);
    const deltasOf = (trial, reference) => {
      const lows = monthLows(trial, dates);
      return [...reference.keys()].map((key) => lows.get(key) - reference.get(key));
    };
    const keys = [...lows0.keys()];
    const moves = [];
    let balances = balances0;
    let lows = lows0;
    const pending = items.filter((item) => canMove(item)); // p. ej., solo las partidas cuyo día se puede guardar
    while (moves.length < maxMoves && pending.length) {
      let best = null;
      pending.forEach((item) => {
        for (let toDay = 1; toDay <= MAX_DAY; toDay += 1) {
          if (toDay === item.day) continue;
          const trial = shifted(balances, dates, item, toDay, today);
          const deltas = deltasOf(trial, lows);
          if (deltas.some((delta) => delta < -0.5)) continue; // ningún mes peor
          const score = deltas.reduce((sum, delta) => sum + delta, 0);
          const better = deltas.filter((delta) => delta > 0.5);
          // Empate: el día más cercano al de siempre (la petición más fácil de aceptar).
          if (!best || score > best.score + 0.005 || (Math.abs(score - best.score) <= 0.005 && Math.abs(toDay - item.day) < Math.abs(best.toDay - item.day) && best.item === item)) {
            best = { item, toDay, score, trial, gain: median(better), months: better.length, monthKeys: keys.filter((_, at) => deltas[at] > 0.5) };
          }
        }
      });
      if (!best || best.gain < minGain) break;
      moves.push({ key: best.item.key, label: best.item.label, field: best.item.field, amount: best.item.amount, fromDay: best.item.day, toDay: best.toDay, gain: best.gain, months: best.months, monthKeys: best.monthKeys, low: lowOf(best.trial, dates) });
      balances = best.trial;
      lows = monthLows(balances, dates);
      pending.splice(pending.indexOf(best.item), 1);
    }
    const together = deltasOf(balances, lows0).filter((delta) => delta > 0.5);
    return { ...base, ready: true, knownShare, low: { before, after: lowOf(balances, dates) }, moves, gain: median(together), reason: moves.length ? "" : "nada-que-mover" };
  }

  return Object.freeze({ SCHEMA_ID, GATE, MAX_DAY, HORIZON_DAYS, receipts, monthLows, suggest });
});
