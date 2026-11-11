/**
 * canonical-variable-pace.js
 *
 * FX-14 · el mes en curso al ritmo real (XPR-04 de la séptima auditoría; backlog de noviembre, Oleada 1 «si da tiempo»).
 *
 * A mitad de mes, la previsión cuenta el gasto variable como «lo mayor entre lo previsto y lo gastado» (`actualAwareInfo` de app.js):
 * nunca baja aunque se gaste menos y sube tarde si se gasta más. Es prudente y SIGUE MANDANDO. Este motor solo dice, al lado, a qué
 * ritmo va el mes con el perfil del propio hogar: qué parte del gasto variable de un mes se lleva gastada, de media, al llegar al
 * día N (la nómina, el súper de principio de mes y lo demás quedan dentro del perfil, sin suponerlos).
 *
 *   · Perfil: para cada mes completo con extracto, la fracción del gasto variable gastada hasta cada día; la media de los meses.
 *   · Puerta (XPR-04): al menos 3 meses completos con gasto variable en el extracto. Sin ella, no hay estimación.
 *   · Estimación: lo gastado hasta el último día con extracto, entre la fracción del perfil a ese día. Nunca menos de lo gastado.
 *     Demasiado pronto (antes del día 5 o con menos del 15 % del perfil) no se estima: dividir por casi nada da cualquier cosa.
 *   · Banda y acierto, sin trampa: cada mes pasado se estima con el perfil de LOS DEMÁS (dejando ese mes fuera). La banda son el
 *     menor y el mayor cociente real/estimado de esos ensayos aplicados a la estimación; el acierto, el error medio al día 15.
 *
 * Motor puro: sin DOM, red ni almacenamiento; recibe los movimientos ya clasificados y devuelve números. No ejecuta nada (A11-4).
 */

(function attachCanonicalVariablePace(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalVariablePace = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function canonicalVariablePaceFactory() {
  "use strict";

  const SCHEMA_ID = "finance-variable-pace/v1";
  const MIN_MONTHS = 3;
  const MAX_MONTHS = 6;
  const MIN_DAY = 5;
  const MIN_SHARE = 0.15;
  const CHECK_DAY = 15;

  const finite = (value) => Number.isFinite(Number(value)) && value !== null && value !== "";
  const daysIn = (monthKey) => {
    const [year, month] = String(monthKey).split("-").map(Number);
    return new Date(Date.UTC(year, month, 0)).getUTCDate() || 30;
  };

  /**
   * Agrupa los movimientos por mes: lo gastado en variable cada día (los cargos suman, las devoluciones restan) y el último día con
   * cualquier movimiento (hasta dónde llega el extracto). `isVariable(transaction)` decide qué movimiento es gasto variable.
   */
  function byMonth(transactions, isVariable) {
    const months = new Map();
    (Array.isArray(transactions) ? transactions : []).forEach((transaction) => {
      const date = String(transaction?.date || "").slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !finite(transaction.amount)) return;
      const key = date.slice(0, 7);
      if (!months.has(key)) months.set(key, { key, days: daysIn(key), daily: new Array(32).fill(0), lastDay: 0 });
      const month = months.get(key);
      const day = Number(date.slice(8, 10));
      month.lastDay = Math.max(month.lastDay, day);
      if (isVariable(transaction)) month.daily[day] -= Number(transaction.amount);
    });
    return months;
  }

  /** Lo gastado hasta el día `day` incluido (en un mes más corto, hasta su último día). */
  function cumulative(month, day) {
    let sum = 0;
    for (let d = 1; d <= Math.min(day, month.days); d += 1) sum += month.daily[d];
    return sum;
  }

  function shareAt(months, day) {
    const shares = months.map((month) => Math.min(1, Math.max(0, cumulative(month, day) / month.total)));
    return shares.length ? shares.reduce((sum, value) => sum + value, 0) / shares.length : 0;
  }

  /**
   * El perfil del hogar con los meses completos anteriores a `monthKey` (los `MAX_MONTHS` más recientes). Un mes es completo si el
   * extracto sigue después de él (hay movimientos de un mes posterior) y tiene gasto variable.
   * @param {Array<object>} transactions
   * @param {{ monthKey?: string, isVariable?: (transaction: object) => boolean }} [options]
   */
  function profile(transactions, options) {
    const { monthKey, isVariable } = options || {};
    if (typeof isVariable !== "function" || !/^\d{4}-\d{2}$/.test(String(monthKey || ""))) return { ready: false, months: [], count: 0 };
    const all = byMonth(transactions, isVariable);
    const keys = [...all.keys()].sort();
    const months = keys
      .filter((key) => key < monthKey && keys.some((later) => later > key))
      .map((key) => all.get(key))
      .map((month) => ({ ...month, total: cumulative(month, 31) }))
      .filter((month) => month.total > 0)
      .slice(-MAX_MONTHS);
    return { ready: months.length >= MIN_MONTHS, months, count: months.length, current: all.get(monthKey) || null };
  }

  /**
   * La estimación del cierre del gasto variable del mes `monthKey` al ritmo de lo que lleva el extracto. Devuelve
   * `{ ready, reason, ... }`: `reason` dice por qué no hay cifra («pocos-meses», «sin-extracto», «pronto»).
   *   · spent: lo gastado en variable hasta `asOfDay`; asOfDay: el último día del mes con extracto (no hoy: el extracto puede ir atrás).
   *   · projected / low / high: el cierre estimado y su banda, sin redondear (lo redondea quien lo pinta, FX-04).
   *   · error15: el error medio de la estimación del día 15 en los meses pasados (cada uno con el perfil de los demás), en tanto por uno.
   * @param {Array<object>} transactions
   * @param {{ monthKey?: string, isVariable?: (transaction: object) => boolean, today?: string }} [options]
   */
  function estimate(transactions, options) {
    const { monthKey, isVariable, today } = options || {};
    const base = profile(transactions, { monthKey, isVariable });
    const out = { schema: SCHEMA_ID, monthKey, monthsUsed: base.count, ready: false };
    if (!base.ready) return { ...out, reason: "pocos-meses" };
    const current = base.current;
    const todayDay = String(today || "").slice(0, 7) === monthKey ? Number(String(today).slice(8, 10)) : 31;
    const asOfDay = current ? Math.min(current.lastDay, todayDay || 31) : 0;
    if (!current || !asOfDay) return { ...out, reason: "sin-extracto" };
    const days = daysIn(monthKey);
    const spent = cumulative(current, asOfDay);
    const share = asOfDay >= days ? 1 : shareAt(base.months, asOfDay);
    if (asOfDay < MIN_DAY || share < MIN_SHARE) return { ...out, reason: "pronto", asOfDay, spent };
    const projected = Math.max(spent, spent / share);
    // Ensayos sin trampa: cada mes, con el perfil de los demás, al mismo día y al día 15.
    const ratios = [];
    const errors = [];
    base.months.forEach((month, at) => {
      const others = base.months.filter((_, other) => other !== at);
      const trial = (day) => {
        const otherShare = shareAt(others, day);
        const so = cumulative(month, day);
        return otherShare > 0 && so > 0 ? Math.max(so, so / otherShare) : null;
      };
      const atDay = trial(asOfDay);
      if (atDay) ratios.push(month.total / atDay);
      const at15 = trial(CHECK_DAY);
      if (at15) errors.push(Math.abs(at15 - month.total) / month.total);
    });
    const low = ratios.length ? Math.max(spent, projected * Math.min(...ratios)) : projected;
    const high = ratios.length ? Math.max(projected, projected * Math.max(...ratios)) : projected;
    return {
      ...out,
      ready: true,
      asOfDay,
      days,
      spent,
      share,
      projected,
      low: Math.min(low, projected),
      high,
      error15: errors.length ? errors.reduce((sum, value) => sum + value, 0) / errors.length : null,
    };
  }

  /**
   * Frente al plan: cuánto se va el ritmo del previsto (projected − planned) y en qué sentido. «En línea» si la diferencia no pasa del
   * mayor de 25 € o el 5 % del previsto: una diferencia menor no cambia ninguna decisión.
   */
  function versusPlan(result, planned) {
    if (!result?.ready || !finite(planned)) return null;
    const diff = Number(result.projected) - Number(planned);
    const tolerance = Math.max(25, Math.abs(Number(planned)) * 0.05);
    return { diff, status: Math.abs(diff) <= tolerance ? "en-linea" : diff > 0 ? "por-encima" : "por-debajo" };
  }

  return Object.freeze({ SCHEMA_ID, MIN_MONTHS, MAX_MONTHS, MIN_DAY, MIN_SHARE, CHECK_DAY, profile, estimate, versusPlan });
});
