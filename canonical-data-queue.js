(function attachCanonicalDataQueue(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalDataQueue = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function canonicalDataQueueFactory() {
  "use strict";

  // WP-45 (ND-09 + CAP-07, docs/WP45_DISENO.md): la frescura de cada fuente de datos y una cola de tareas de datos ordenada por «euros de incertidumbre por minuto».
  //   · freshnessCard: la edad de una fuente (saldos, extracto, cartera, índices, cierre) con tono, icono Y texto.
  //   · unloggedEstimate: cuánto puede haberse movido el dinero desde que un dato se actualizó por última vez (gasto diario medio × días, con tope).
  //   · buildQueue: ordena las tareas por incertidumbre que quitan por minuto, con el tiempo MEDIDO cuando existe y marcado como supuesto cuando no.
  // Motor puro: ni DOM, ni red, ni almacenamiento, ni reloj. NUNCA hace la tarea ni cambia un dato (A11-4): ordena y enseña.
  //
  // Reglas de honestidad:
  //   · una tarea cuya incertidumbre no se sabe estimar NO se ordena por un euro inventado: va aparte, «sin estimar», con el motivo.
  //   · el tiempo de una tarea es el MEDIDO (mediana de ≥ 3 usos) o, si no hay, un supuesto que se dice «sin medir»; nunca se presenta como medido.
  //   · dos tareas que resuelven la misma incertidumbre (importar el extracto y actualizar el saldo) no suman dos veces: por familia cuenta solo la mayor.
  //   · la estimación «gasto diario × días» es un modelo mío, no un dato: se rotula «puede moverse hasta».

  const SCHEMA_ID = "finance-data-queue/v1";
  const MIN_MEASURED_SAMPLES = 3;
  const DEFAULT_BUDGET_MINUTES = 3; // «con 3 minutos hoy»
  const MAX_ESTIMATE_DAYS = 30; // más allá, la estimación deja de ser creíble y se queda en el tope (se dice)

  const number = (value, fallback = 0) => (Number.isFinite(Number(value)) && value !== "" && value !== null && value !== undefined ? Number(value) : fallback);
  const known = (value) => value !== "" && value !== null && value !== undefined && Number.isFinite(Number(value));
  const round2 = (value) => Math.round((number(value) + Number.EPSILON) * 100) / 100;
  const text = (value) => String(value ?? "").trim();
  const isIso = (value) => /^\d{4}-\d{2}-\d{2}/.test(text(value));

  function daysBetween(fromIso, toIso) {
    const parse = (iso) => { const [y, m, d] = iso.slice(0, 10).split("-").map(Number); return Date.UTC(y, m - 1, d); };
    return Math.round((parse(toIso) - parse(fromIso)) / 86400000);
  }

  function ageText(days) {
    if (days === null) return "sin dato";
    if (days <= 0) return "hoy";
    if (days === 1) return "ayer";
    return `hace ${days} días`;
  }

  /**
   * La ficha de frescura de una fuente.
   * @param {{id?: string, label?: string, lastDate?: string|null, today?: string, staleAfterDays?: number, unknownText?: string, action?: {label?: string, href?: string}|null, expired?: boolean}} [params]
   */
  function freshnessCard({ id = "", label = "", lastDate = null, today = "", staleAfterDays = 7, unknownText = "Sin dato", action = null, expired = false } = {}) {
    const base = { id: text(id), label: text(label), action };
    if (!isIso(today) || !isIso(lastDate)) return { ...base, tone: "unknown", icon: "?", ageDays: null, ageText: "sin dato", status: unknownText };
    const ageDays = Math.max(0, daysBetween(text(lastDate), today));
    const stale = expired || ageDays >= staleAfterDays;
    const tone = stale ? "stale" : ageDays <= Math.max(1, Math.floor(staleAfterDays / 4)) ? "current" : "recent";
    return {
      ...base, tone, ageDays, ageText: ageText(ageDays),
      icon: tone === "stale" ? "⚠" : tone === "current" ? "✓" : "◐",
      status: tone === "stale" ? "Antiguo" : tone === "current" ? "Al día" : "Reciente",
    };
  }

  /**
   * Cuánto puede haberse movido el dinero desde que un dato se actualizó: gasto diario medio × días, con un tope (a más días la estimación deja de ser creíble).
   * Sin gasto medio o sin fecha no hay estimación (null), no 0.
   * @param {{dailyOutflow?: number|null, ageDays?: number|null, capDays?: number}} [params]
   */
  function unloggedEstimate({ dailyOutflow = null, ageDays = null, capDays = MAX_ESTIMATE_DAYS } = {}) {
    if (!(known(dailyOutflow) && number(dailyOutflow) > 0) || !known(ageDays) || number(ageDays) < 0) return { value: null, capped: false, days: null };
    const days = Math.min(number(ageDays), capDays);
    return { value: round2(number(dailyOutflow) * days), capped: number(ageDays) > capDays, days };
  }

  /** El tiempo de una tarea: la mediana medida si hay ≥ 3 usos; si no, el supuesto, marcado como no medido. */
  function taskMinutes({ measuredSeconds = [], assumedMinutes = 1 } = {}) {
    const samples = (Array.isArray(measuredSeconds) ? measuredSeconds : []).map(Number).filter((value) => Number.isFinite(value) && value > 0).sort((a, b) => a - b);
    if (samples.length >= MIN_MEASURED_SAMPLES) {
      const middle = Math.floor(samples.length / 2);
      const median = samples.length % 2 ? samples[middle] : (samples[middle - 1] + samples[middle]) / 2;
      return { value: round2(median / 60), measured: true, samples: samples.length };
    }
    return { value: round2(Math.max(0.05, number(assumedMinutes, 1))), measured: false, samples: samples.length };
  }

  /**
   * Ordena las tareas por incertidumbre que quitan por minuto y propone qué hacer con un presupuesto de minutos.
   * @param {{tasks?: Array<{id: string, label: string, family?: string, uncertainty?: number|null, basis?: string, reasonUnknown?: string, minutes?: {value: number, measured: boolean, samples?: number}, action?: any, deadline?: string, absorbs?: string[]}>, budgetMinutes?: number}} [params]
   */
  function buildQueue({ tasks = [], budgetMinutes = DEFAULT_BUDGET_MINUTES } = {}) {
    const list = (Array.isArray(tasks) ? tasks : []).filter((task) => task && text(task.id));
    const deadlines = list.filter((task) => text(task.deadline));
    const estimated = list.filter((task) => !text(task.deadline) && known(task.uncertainty) && number(task.uncertainty) > 0)
      .map((task) => {
        const minutes = task.minutes && number(task.minutes.value) > 0 ? task.minutes : { value: 1, measured: false, samples: 0 };
        return { ...task, uncertainty: round2(task.uncertainty), minutes, valuePerMinute: round2(number(task.uncertainty) / minutes.value) };
      })
      .sort((a, b) => b.valuePerMinute - a.valuePerMinute || b.uncertainty - a.uncertainty);
    const unestimated = list.filter((task) => !text(task.deadline) && !(known(task.uncertainty) && number(task.uncertainty) > 0))
      .map((task) => ({ ...task, uncertainty: null, reason: text(task.reasonUnknown) || "No sé cuánto cambia una cifra por esta tarea." }));
    // Selección voraz con el presupuesto; una tarea que otra ya elegida «absorbe» no se repite, y por familia solo cuenta la mayor incertidumbre.
    const budget = Math.max(0, number(budgetMinutes, DEFAULT_BUDGET_MINUTES));
    const chosen = [];
    const absorbed = new Set();
    const familyValue = new Map();
    let spent = 0;
    estimated.forEach((task) => {
      if (absorbed.has(task.id)) return;
      const family = text(task.family) || task.id;
      if (task.uncertainty - (familyValue.get(family) || 0) <= 0) return; // no añade nada a lo que ya se resuelve en su familia
      if (spent + task.minutes.value > budget + 1e-9) return;
      chosen.push(task);
      spent = round2(spent + task.minutes.value);
      familyValue.set(family, Math.max(familyValue.get(family) || 0, task.uncertainty));
      (Array.isArray(task.absorbs) ? task.absorbs : []).forEach((id) => {
        absorbed.add(id);
        const index = chosen.findIndex((other) => other.id === id);
        if (index >= 0) { spent = round2(spent - chosen[index].minutes.value); chosen.splice(index, 1); } // ya elegida y ahora innecesaria: libera su tiempo
      });
    });
    const keep = chosen;
    const byFamily = new Map();
    keep.forEach((task) => { const family = text(task.family) || task.id; byFamily.set(family, Math.max(byFamily.get(family) || 0, task.uncertainty)); });
    const resolved = round2([...byFamily.values()].reduce((sum, value) => sum + value, 0));
    const total = round2([...estimated.reduce((map, task) => { const family = text(task.family) || task.id; map.set(family, Math.max(map.get(family) || 0, task.uncertainty)); return map; }, new Map()).values()].reduce((sum, value) => sum + value, 0));
    return {
      schemaId: SCHEMA_ID, budgetMinutes: budget,
      deadlines, ranked: estimated.map((task, index) => ({ ...task, rank: index + 1, absorbed: absorbed.has(task.id) })), unestimated,
      plan: { ids: keep.map((task) => task.id), minutes: round2(keep.reduce((sum, task) => sum + task.minutes.value, 0)), resolved, total, anyUnmeasured: keep.some((task) => !task.minutes.measured) },
      allClear: !deadlines.length && !estimated.length,
    };
  }

  return { SCHEMA_ID, MIN_MEASURED_SAMPLES, DEFAULT_BUDGET_MINUTES, MAX_ESTIMATE_DAYS, daysBetween, ageText, freshnessCard, unloggedEstimate, taskMinutes, buildQueue };
});
