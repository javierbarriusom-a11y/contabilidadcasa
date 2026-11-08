(function attachCanonicalForecastChanges(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalForecastChanges = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function canonicalForecastChangesFactory() {
  "use strict";

  // FX-40 (BACKLOG_NOVIEMBRE_OLEADA_1.md; docs/PROPUESTA_OCTAVA_AUDITORIA_2026-11-05.md §9): «qué ha cambiado desde tu última
  // visita». La Previsión guarda una foto ligera de su trayectoria en cada visita (una por día, en este dispositivo) y, en la
  // siguiente, explica cuánto se ha movido el punto más bajo y por qué, en un puente con cuatro causas fijas:
  //   · el paso del tiempo: la trayectoria de entonces vista con la ventana de hoy (lo ya cobrado o pagado sale; entran días nuevos);
  //   · datos nuevos: los saldos de hoy frente a lo que la previsión de entonces esperaba para hoy (saldos puestos, reales importados);
  //   · supuestos: lo que cambia al recalcular con los supuestos de entonces (inflación, ajustes, ahorro previsto, reserva…);
  //   · cambios del plan: lo que queda, SOLO si el plan ha cambiado (partidas, escenarios aplicados). Si no ha cambiado, lo que queda
  //     va a «Otros», a la vista: es lo que la app no sabe separar.
  // Reglas de honestidad (las de WP-43): el puente cuadra SIEMPRE con la diferencia total; lo que no se sabe atribuir no se reparte a
  // ojo; si «Otros» o «Cambios del plan» explican mucho, se dice. Motor puro: ni DOM, ni almacenamiento, ni reloj. Solo explica: no
  // cambia la previsión (A11-4).

  const SCHEMA_ID = "finance-forecast-changes/v1";
  const DAILY_DAYS = 800; // día a día hasta aquí (cubre la ventana de 24 meses con más de dos meses entre visitas); después, por meses
  const MAX_SNAPSHOTS = 8;
  const WEAK_SHARE = 0.4; // si lo que queda sin separar pesa al menos el 40 % del cambio, se avisa (el criterio de WP-43)
  const POLICY_LABELS = Object.freeze({
    incomeFactor: "el ajuste de ingresos",
    annualIncomeGrowth: "la subida anual de ingresos",
    expenseFactor: "el ajuste de gastos",
    annualInflation: "la inflación anual",
    plannedMonthlySaving: "el ahorro mensual previsto",
    autoCapSavings: "el ajuste automático del ahorro",
    operatingReserve: "la reserva operativa",
  });
  const PLAN_FIELDS = Object.freeze(["income", "coreSpend", "variableOperationalSpend", "car", "refi", "projectOutflow", "endOfMonthOutflows"]);

  const finite = (value) => value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));
  const isDate = (value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
  const dayNumber = (iso) => Math.round(Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))) / 86400000);
  const isoOf = (day) => new Date(day * 86400000).toISOString().slice(0, 10);

  function addDays(iso, days) {
    return isoOf(dayNumber(iso) + days);
  }

  function normalizePolicy(policy = {}) {
    return Object.fromEntries(Object.keys(POLICY_LABELS).map((key) => [key, key === "autoCapSavings" ? policy[key] !== false : finite(policy[key]) ? Number(policy[key]) : 0]));
  }

  /**
   * La foto de hoy: la trayectoria día a día (en euros enteros) hasta DAILY_DAYS y, después, el mínimo y el cierre de cada mes;
   * los supuestos y, del plan, las cifras de los meses que vienen (para saber si ha cambiado).
   * @param {{ today?: string, rows?: Array<{date: string, total: number}>, policy?: any, planMonths?: Array<any> }} [input]
   */
  function snapshot({ today, rows = [], policy = {}, planMonths = [] } = {}) {
    if (!isDate(today)) return null;
    const futuras = (Array.isArray(rows) ? rows : []).filter((row) => row && isDate(row.date) && row.date >= today && finite(row.total)).sort((a, b) => (a.date < b.date ? -1 : 1));
    if (!futuras.length || futuras[0].date !== today) return null;
    const start = dayNumber(today);
    const lastDay = dayNumber(futuras.at(-1).date);
    const byDay = new Map(futuras.map((row) => [dayNumber(row.date), Math.round(Number(row.total))]));
    const days = [];
    let previous = byDay.get(start);
    for (let day = start; day <= Math.min(lastDay, start + DAILY_DAYS - 1); day += 1) {
      if (byDay.has(day)) previous = byDay.get(day);
      days.push(previous);
    }
    const months = [];
    const beyond = futuras.filter((row) => dayNumber(row.date) >= start + DAILY_DAYS);
    beyond.forEach((row) => {
      const key = row.date.slice(0, 7);
      const value = Math.round(Number(row.total));
      const last = months.at(-1);
      if (!last || last[0] !== key) months.push([key, value, row.date, value]);
      else {
        if (value < last[1]) { last[1] = value; last[2] = row.date; }
        last[3] = value;
      }
    });
    const plan = {};
    (Array.isArray(planMonths) ? planMonths : []).forEach((month) => {
      if (month && /^\d{4}-\d{2}$/.test(String(month.monthKey)) && month.monthKey > today.slice(0, 7)) {
        plan[month.monthKey] = PLAN_FIELDS.map((field) => Math.round(Number(month[field]) || 0));
      }
    });
    return { schemaId: SCHEMA_ID, date: today, end: futuras.at(-1).date, days, months, policy: normalizePolicy(policy), plan };
  }

  function valid(snap) {
    return Boolean(snap && snap.schemaId === SCHEMA_ID && isDate(snap.date) && isDate(snap.end) && Array.isArray(snap.days) && snap.days.length && Array.isArray(snap.months));
  }

  /** Las fotos guardadas, bien formadas, de la más reciente a la más antigua, una por día. */
  function normalizeStore(raw) {
    const seen = new Set();
    return (Array.isArray(raw) ? raw : []).filter(valid).sort((a, b) => (a.date < b.date ? 1 : -1))
      .filter((snap) => (seen.has(snap.date) ? false : (seen.add(snap.date), true))).slice(0, MAX_SNAPSHOTS);
  }

  function upsert(store, snap) {
    return valid(snap) ? normalizeStore([snap, ...normalizeStore(store).filter((item) => item.date !== snap.date)]) : normalizeStore(store);
  }

  /** La visita con la que se compara: la última de un día anterior a hoy. */
  function previousVisit(store, today) {
    return normalizeStore(store).find((snap) => snap.date < today) || null;
  }

  /** El saldo que la foto preveía para un día (o null si no lo cubre día a día). */
  function valueAt(snap, date) {
    if (!valid(snap) || !isDate(date)) return null;
    const offset = dayNumber(date) - dayNumber(snap.date);
    return offset >= 0 && offset < snap.days.length ? snap.days[offset] : null;
  }

  /** El punto más bajo que preveía la foto entre dos días (día a día donde lo cubre; después, el mínimo de cada mes). */
  function lowIn(snap, from, to) {
    if (!valid(snap) || !isDate(from) || !isDate(to) || to < from) return null;
    const start = dayNumber(snap.date);
    let best = null;
    const consider = (value, date) => {
      if (best === null || value < best.value) best = { value, date };
    };
    for (let day = Math.max(dayNumber(from), start); day <= Math.min(dayNumber(to), start + snap.days.length - 1); day += 1) consider(snap.days[day - start], isoOf(day));
    snap.months.forEach(([, min, minDate]) => {
      if (minDate >= from && minDate <= to) consider(min, minDate);
    });
    return best;
  }

  /** Qué supuestos han cambiado entre dos fotos (o entre una foto y los de ahora). */
  function policyChanges(before = {}, after = {}) {
    const a = normalizePolicy(before);
    const b = normalizePolicy(after);
    return Object.keys(POLICY_LABELS).filter((key) => (key === "autoCapSavings" ? a[key] !== b[key] : Math.abs(Number(a[key]) - Number(b[key])) > 0.0001));
  }

  /** Si el plan de los meses que vienen ha cambiado: compara los meses que están en las dos fotos (desde el mes siguiente). */
  /** @param {Record<string, number[]>} [before] @param {Record<string, number[]>} [after] */
  function planChanges(before = {}, after = {}) {
    return Object.keys(before || {}).filter((key) => after?.[key]).sort().filter((key) => before[key].some((value, index) => Math.abs(Number(value) - (Number(after[key][index]) || 0)) > 1));
  }

  /**
   * El puente entre la visita anterior y hoy, para el punto más bajo de una ventana de `windowDays` días (Infinity: hasta el final).
   * @param {{ previous?: any, today?: string, windowDays?: number, current?: { low: {value: number, date: string}, start: number, end: string, policy?: any, plan?: any }, oldPolicyLow?: {value: number, date: string}|null, oldPolicyStart?: number|null, startEstimated?: boolean }} [input]
   *   `oldPolicyLow`: el punto más bajo de hoy recalculado con los supuestos de la foto (lo calcula quien llama con los motores de
   *   siempre); sin él, o si los supuestos no han cambiado, la barra de supuestos es 0. `oldPolicyStart`: el saldo de hoy en ese mismo
   *   recálculo. Los datos nuevos se miden con él: si los supuestos mueven también el saldo de hoy, eso es de los supuestos, no de los datos.
   *   `startEstimated`: los saldos se calculan por calendario a partir del plan (no son del banco). Entonces el saldo de hoy cambia
   *   también con el plan y los supuestos, y la barra se llama «Saldo de hoy (calculado)» en vez de «Datos nuevos»: no se presenta
   *   como dato nuevo lo que es una estimación.
   */
  function bridge({ previous, today, windowDays, current, oldPolicyLow = null, oldPolicyStart = null, startEstimated = false } = {}) {
    if (!valid(previous)) return { calculable: false, reason: "Todavía no hay una visita anterior con la que comparar." };
    if (!isDate(today) || !(previous.date < today)) return { calculable: false, reason: "La visita anterior tiene que ser de otro día." };
    if (!current?.low || !finite(current.low.value) || !finite(current.start)) return { calculable: false, reason: "Falta la previsión de hoy." };
    if (today > previous.end) return { calculable: false, reason: "La previsión de entonces no llega hasta hoy." };
    const finEntonces = windowDays === Infinity ? previous.end : addDays(previous.date, windowDays);
    const finHoy = windowDays === Infinity ? current.end : addDays(today, windowDays);
    const antes = lowIn(previous, previous.date, finEntonces < previous.end ? finEntonces : previous.end);
    const conTiempo = lowIn(previous, today, finHoy < previous.end ? finHoy : previous.end);
    if (!antes || !conTiempo) return { calculable: false, reason: "La previsión de entonces no cubre esta ventana." };
    const esperado = valueAt(previous, today);
    const supuestosCambiados = policyChanges(previous.policy, current.policy);
    const planCambiado = planChanges(previous.plan, current.plan);
    const total = Number(current.low.value) - antes.value;
    const tiempo = conTiempo.value - antes.value;
    const recalculado = supuestosCambiados.length && oldPolicyLow && finite(oldPolicyLow.value);
    const inicio = recalculado && finite(oldPolicyStart) ? Number(oldPolicyStart) : Number(current.start);
    const datos = esperado === null ? 0 : inicio - esperado;
    const supuestos = recalculado ? Number(current.low.value) - Number(oldPolicyLow.value) : 0;
    const resto = total - tiempo - datos - supuestos;
    const hayPlan = planCambiado.length > 0;
    const rows = [
      { id: "tiempo", label: "El paso del tiempo", value: tiempo },
      { id: "datos", label: startEstimated ? "Saldo de hoy (calculado)" : "Datos nuevos", value: datos },
      { id: "supuestos", label: "Supuestos", value: supuestos },
      { id: hayPlan ? "plan" : "otros", label: hayPlan ? "Cambios del plan" : "Otros", value: resto },
    ];
    const notes = [];
    notes.push("El paso del tiempo: lo que ya se ha cobrado o pagado sale de la cuenta y entran días nuevos al final.");
    notes.push(esperado === null
      ? "Datos nuevos: la previsión de entonces no tenía el saldo de hoy día a día; lo que haya cambiado va al resto."
      : startEstimated
        ? "Saldo de hoy (calculado): los saldos se calculan por calendario a partir del plan, así que cambian con el plan y los supuestos, no solo con datos nuevos. Con los saldos del banco, esta barra sería solo de datos nuevos."
        : "Datos nuevos: el saldo de hoy frente al que la previsión de entonces esperaba para hoy (saldos puestos al día, movimientos importados).");
    notes.push(supuestosCambiados.length
      ? `Supuestos: han cambiado ${supuestosCambiados.map((key) => POLICY_LABELS[key]).join(", ")}.${oldPolicyLow ? "" : " No se ha podido recalcular con los de entonces: su efecto va al resto."}`
      : "Supuestos: no han cambiado.");
    notes.push(hayPlan
      ? "Cambios del plan: han cambiado partidas o decisiones de los meses que vienen. Esta barra incluye también lo que la app no sabe separar."
      : "Otros: el plan no ha cambiado. Es lo que la app no sabe separar (redondeos, movimientos importados que cambian lo previsto…).");
    const weak = Math.abs(total) >= 1 && Math.abs(resto) >= WEAK_SHARE * Math.abs(total) && Math.abs(resto) >= 10;
    return {
      calculable: true, schemaId: SCHEMA_ID, previousDate: previous.date, total, before: antes, after: { value: Number(current.low.value), date: current.low.date },
      rows, notes, weak, changedPolicy: supuestosCambiados, changedPlanMonths: planCambiado,
    };
  }

  /** La causa que más pesa en la dirección del cambio (para la frase), o null si no hay cambio. */
  function mainCause(result) {
    if (!result?.calculable || !result.total) return null;
    const sign = Math.sign(result.total);
    return result.rows.filter((row) => Math.sign(row.value) === sign).sort((a, b) => Math.abs(b.value) - Math.abs(a.value))[0] || null;
  }

  return Object.freeze({ SCHEMA_ID, DAILY_DAYS, MAX_SNAPSHOTS, WEAK_SHARE, POLICY_LABELS, PLAN_FIELDS, addDays, snapshot, normalizeStore, upsert, previousVisit, valueAt, lowIn, policyChanges, planChanges, bridge, mainCause });
});
