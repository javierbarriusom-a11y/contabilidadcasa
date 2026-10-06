(function attachCanonicalPortfolioValuation(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalPortfolioValuation = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createCanonicalPortfolioValuation() {
  "use strict";

  // WP-15 (docs/WP15_DISENO.md): la hoja de valoración de la cartera. Hasta ahora una posición solo se podía crear o quitar: su
  // valor era el del alta. Este módulo (puro, sin DOM) decide qué cambia al valorar: el valor y la fecha de cada posición, los
  // puntos de la serie de valoraciones con fecha (almacén `portfolio-valuations`, distinto de las instantáneas de cierre de I2, que
  // repiten el valor del alta y no son una serie), la variación DE MERCADO (descuenta aportaciones y ventas), la frescura y las
  // salvaguardas. La pantalla vive en valoracion-ui.js.

  const STORE_NAME = "portfolio-valuations";
  const STALE_DAYS = 35;
  const MAX_POINTS = 500;
  const THIN_AFTER_MONTHS = 24;
  const MAX_TIMINGS = 100;
  const MAX_AGE_DAYS = 3650;
  const MAX_VALUE = 1e9;
  const BIG_MOVE_PCT = 20;
  const BIG_MOVE_PCT_CRYPTO = 40;
  const SCALE_FACTOR = 100;
  const MAX_SECONDS = 3600;

  function text(value) {
    return String(value ?? "").trim();
  }

  function round2(value) {
    return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
  }

  function validIsoDate(value) {
    const match = text(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return false;
    const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
    return date.getUTCMonth() === Number(match[2]) - 1 && date.getUTCDate() === Number(match[3]);
  }

  function daysBetween(fromIso, toIso) {
    const parse = (iso) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
    return Math.round((parse(toIso) - parse(fromIso)) / 86400000);
  }

  function addMonthsIso(iso, count) {
    const [year, month, day] = iso.split("-").map(Number);
    const target = new Date(Date.UTC(year, month - 1 + count, 1));
    const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
    return new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), Math.min(day, last))).toISOString().slice(0, 10);
  }

  function formatDate(iso) {
    return iso.split("-").reverse().join("/");
  }

  function validId(value) {
    return /^[A-Za-z0-9_.:-]{1,80}$/.test(text(value));
  }

  // ---- Almacén -----------------------------------------------------------------------------------------------------------

  function normalizePoint(raw) {
    if (!raw || typeof raw !== "object" || !validId(raw.id)) return null;
    const value = Number(raw.value);
    const cost = Number(raw.cost);
    if (!Number.isFinite(value) || value < 0 || value > MAX_VALUE) return null;
    return { id: text(raw.id), value: round2(value), cost: Number.isFinite(cost) && cost >= 0 && cost <= MAX_VALUE ? round2(cost) : 0 };
  }

  function normalizeValuation(raw) {
    if (!raw || typeof raw !== "object" || !validIsoDate(raw.date)) return null;
    const seen = new Set();
    const points = [];
    (Array.isArray(raw.points) ? raw.points : []).forEach((item) => {
      const point = normalizePoint(item);
      if (!point || seen.has(point.id)) return;
      seen.add(point.id);
      points.push(point);
    });
    if (!points.length) return null;
    return { date: text(raw.date), savedAt: Number.isFinite(Date.parse(text(raw.savedAt))) ? text(raw.savedAt) : "", points };
  }

  /** Lo que no es válido no entra: una copia o una nube dañada no rompe la pantalla de Cartera. */
  function normalizeStore(raw) {
    const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
    const byDate = new Map();
    (Array.isArray(source.valuations) ? source.valuations : []).forEach((item) => {
      const valuation = normalizeValuation(item);
      if (!valuation) return;
      const previous = byDate.get(valuation.date);
      if (!previous) return byDate.set(valuation.date, valuation);
      const merged = new Map(previous.points.map((point) => [point.id, point]));
      valuation.points.forEach((point) => merged.set(point.id, point));
      byDate.set(valuation.date, { date: valuation.date, savedAt: valuation.savedAt || previous.savedAt, points: [...merged.values()] });
    });
    const valuations = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(-MAX_POINTS);
    const timings = (Array.isArray(source.timings) ? source.timings : [])
      .map((item) => ({ seconds: Number(item?.seconds), at: Number.isFinite(Date.parse(text(item?.at))) ? text(item.at) : "" }))
      .filter((item) => Number.isFinite(item.seconds) && item.seconds >= 0 && item.seconds <= MAX_SECONDS)
      .slice(-MAX_TIMINGS);
    return { valuations, timings };
  }

  /**
   * Retención: lo de más de 24 meses se reduce al último punto de cada posición en cada mes (no se borra); tope de 500 fechas.
   * @param {Array<{ date: string, savedAt: string, points: Array<{ id: string, value: number, cost: number }> }>} valuations
   * @param {string} today
   */
  function thin(valuations, today) {
    if (!validIsoDate(today)) return valuations;
    const cutoff = addMonthsIso(today, -THIN_AFTER_MONTHS);
    const recent = valuations.filter((item) => item.date >= cutoff);
    const old = valuations.filter((item) => item.date < cutoff);
    const months = new Map();
    old.forEach((item) => {
      const key = item.date.slice(0, 7);
      const entry = months.get(key) || { date: item.date, savedAt: item.savedAt, points: new Map() };
      if (item.date >= entry.date) { entry.date = item.date; entry.savedAt = item.savedAt || entry.savedAt; }
      item.points.forEach((point) => entry.points.set(point.id, point));
      months.set(key, entry);
    });
    const reduced = [...months.values()].map((entry) => ({ date: entry.date, savedAt: entry.savedAt, points: [...entry.points.values()] }));
    return [...reduced, ...recent].sort((a, b) => a.date.localeCompare(b.date)).slice(-MAX_POINTS);
  }

  /** Una valoración por fecha: guardar otra vez la misma fecha sustituye las filas de esas posiciones, no duplica. */
  function addValuation(store, { date, points, savedAt, today }) {
    const current = normalizeStore(store);
    const incoming = normalizeValuation({ date, points, savedAt });
    if (!incoming) return current;
    const existing = current.valuations.find((item) => item.date === date);
    const merged = existing ? new Map(existing.points.map((point) => [point.id, point])) : new Map();
    incoming.points.forEach((point) => merged.set(point.id, point));
    const entry = { date, savedAt: text(savedAt) || (existing ? existing.savedAt : ""), points: [...merged.values()] };
    const valuations = thin([...current.valuations.filter((item) => item.date !== date), entry].sort((a, b) => a.date.localeCompare(b.date)), today);
    return { ...current, valuations };
  }

  /** Los puntos de una posición, de la fecha más antigua a la más reciente. */
  function series(store, id) {
    return normalizeStore(store).valuations
      .map((item) => ({ item, point: item.points.find((point) => point.id === id) }))
      .filter((entry) => entry.point)
      .map((entry) => ({ date: entry.item.date, value: entry.point.value, cost: entry.point.cost }));
  }

  function median(values) {
    const sorted = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
    if (!sorted.length) return null;
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : round2((sorted[middle - 1] + sorted[middle]) / 2);
  }

  /** M-VAL2: los segundos hasta guardar la hoja. Un valor imposible no se guarda. */
  function recordTiming(store, seconds, at) {
    const current = normalizeStore(store);
    const value = Number(seconds);
    if (!Number.isFinite(value) || value < 0 || value > MAX_SECONDS) return current;
    return { ...current, timings: [...current.timings, { seconds: round2(value), at: text(at) }].slice(-MAX_TIMINGS) };
  }

  function timingSummary(store) {
    const { timings } = normalizeStore(store);
    return { count: timings.length, median: median(timings.map((item) => item.seconds)) };
  }

  // ---- Frescura ----------------------------------------------------------------------------------------------------------

  /** Días desde la valoración de la posición; `null` si nunca se fechó. */
  function ageDays(position, today) {
    const asOf = text(position?.asOf);
    if (!validIsoDate(asOf) || !validIsoDate(today)) return null;
    return Math.max(0, daysBetween(asOf, today));
  }

  /** «valorada hace 12 días» / «sin fecha de valoración». Antigua: más de 35 días o sin fecha. */
  function freshness(position, today) {
    const days = ageDays(position, today);
    if (days === null) return { days: null, stale: true, label: "sin fecha de valoración" };
    const label = days === 0 ? "valorada hoy" : days === 1 ? "valorada ayer" : `valorada hace ${days} días`;
    return { days, stale: days > STALE_DAYS, label };
  }

  /** M-VAL1: qué parte de las posiciones está valorada hace ≤ 35 días. Sin posiciones, `null`: no hay nada que medir. */
  function freshnessSummary(positions, today) {
    const list = Array.isArray(positions) ? positions : [];
    if (!list.length) return null;
    const results = list.map((position) => freshness(position, today));
    const fresh = results.filter((item) => !item.stale).length;
    return { total: list.length, fresh, stale: list.length - fresh, never: results.filter((item) => item.days === null).length, percentFresh: Math.round((fresh / list.length) * 100) };
  }

  /** Las más antiguas primero (las que nunca se fecharon, las primeras) y, a igualdad, las de más valor. */
  function orderRows(positions, today) {
    return (Array.isArray(positions) ? positions : []).slice().sort((a, b) => {
      const ageA = ageDays(a, today);
      const ageB = ageDays(b, today);
      if (ageA !== ageB) return (ageB === null ? Infinity : ageB) - (ageA === null ? Infinity : ageA);
      return (Number(b?.currentValue) || 0) - (Number(a?.currentValue) || 0);
    });
  }

  // ---- Variación de mercado ----------------------------------------------------------------------------------------------

  /** Aportaciones menos ventas fechadas en (desde, hasta]: lo que entró o salió sin ser mercado. */
  function netFlows(position, fromDate, toDate) {
    const inRange = (date) => validIsoDate(date) && date > fromDate && date <= toDate;
    const contributed = (Array.isArray(position?.contributions) ? position.contributions : []).filter((item) => inRange(text(item?.date))).reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const sold = (Array.isArray(position?.disposals) ? position.disposals : []).filter((item) => inRange(text(item?.date))).reduce((sum, item) => sum + (Number(item.saleProceeds) || 0), 0);
    return round2(contributed - sold);
  }

  /**
   * Variación de mercado = valor nuevo − valor anterior − aportaciones netas desde la valoración anterior. Sin valoración anterior
   * fiable no se inventa: se dice por qué no se calcula.
   * @param {{ position: any, newValue: number, date: string }} input `position`: la posición tal como está guardada (con su valor y fecha anteriores)
   */
  function marketVariation({ position, newValue, date }) {
    const previousDate = text(position?.asOf);
    const previousValue = Number(position?.currentValue);
    if (!validIsoDate(previousDate)) return { calculable: false, reason: "primera-valoracion", amount: null, pct: null, flows: 0 };
    if (!Number.isFinite(previousValue) || previousValue <= 0) return { calculable: false, reason: "sin-valor-anterior", amount: null, pct: null, flows: 0 };
    if (!validIsoDate(date) || date < previousDate) return { calculable: false, reason: "fecha-anterior", amount: null, pct: null, flows: 0 };
    const flows = netFlows(position, previousDate, date);
    const amount = round2(Number(newValue) - previousValue - flows);
    return { calculable: true, reason: "", amount, pct: Math.round((amount / previousValue) * 1000) / 10, flows };
  }

  /**
   * Las salvaguardas de una fila: avisan y piden confirmar, no bloquean. Un 0 explícito, un salto de mercado de más del 20 % (40 % en
   * cripto) y un cambio que parece una coma de más o de menos (factor ≥ 100).
   * @returns {Array<"cero"|"salto"|"escala">}
   */
  function checkRow({ position, newValue, date }) {
    const warnings = [];
    const previous = Number(position?.currentValue);
    if (newValue === 0 && previous > 0) warnings.push("cero");
    if (newValue > 0 && previous > 0) {
      const ratio = newValue / previous;
      if (ratio >= SCALE_FACTOR || ratio <= 1 / SCALE_FACTOR) warnings.push("escala");
      else {
        const variation = marketVariation({ position, newValue, date });
        const limit = text(position?.type) === "cripto" ? BIG_MOVE_PCT_CRYPTO : BIG_MOVE_PCT;
        if (variation.calculable && Math.abs(variation.pct) > limit) warnings.push("salto");
      }
    }
    return warnings;
  }

  function warningText(code, context = {}) {
    if (code === "cero") return "El valor nuevo es 0: ¿ya no tienes esta posición? Si es así, quítala; si no, revisa el importe.";
    if (code === "escala") return "El valor cambia por un factor de 100 o más: ¿falta o sobra una coma?";
    if (code === "salto") return `La variación de mercado es de ${String(context.pct ?? "").replace(".", ",")} %, por encima del ${context.limit ?? BIG_MOVE_PCT} %: confirma que es correcto.`;
    return "";
  }

  // ---- Guardar -----------------------------------------------------------------------------------------------------------

  /**
   * Qué cambia al guardar la hoja, sin tocar nada: las posiciones nuevas, los puntos de la serie y lo necesario para deshacer.
   * Una fila vacía no se toca (vacío = «no cambia»; 0 = «vale cero»). Una fecha anterior a la de la posición solo añade un punto
   * histórico y no mueve el valor actual. «Sin cambios» renueva la fecha y no admite una fecha anterior.
   * @param {{ positions: Array<any>, rows: Array<{ id: string, mode: "value"|"same"|"skip", value?: number|null, confirmed?: boolean }>, date: string, today: string, now?: string, portfolio?: any }} input
   */
  function buildSave({ positions, rows, date, today, now, portfolio }) {
    const engine = portfolio || (typeof globalThis !== "undefined" ? globalThis.FinanceCanonicalPortfolio : null);
    const errors = [];
    if (!validIsoDate(date)) errors.push({ id: "", code: "fecha", message: "La fecha no es válida." });
    else if (validIsoDate(today) && date > today) errors.push({ id: "", code: "fecha", message: "La valoración no puede ser de una fecha futura." });
    else if (validIsoDate(today) && daysBetween(date, today) > MAX_AGE_DAYS) errors.push({ id: "", code: "fecha", message: "Esa fecha es de hace más de diez años." });
    const list = Array.isArray(positions) ? positions : [];
    const byId = new Map(list.map((position) => [position.id, position]));
    const touched = [];
    const ignored = [];
    const needsConfirm = [];
    (Array.isArray(rows) ? rows : []).forEach((row) => {
      const position = byId.get(row?.id);
      if (!position || !row || row.mode === "skip" || !row.mode) return;
      if (row.mode === "same") {
        if (position.asOf && date < position.asOf) return ignored.push({ id: position.id, code: "sin-cambios-pasado" });
        const stored = Number(position.currentValue);
        return touched.push({ id: position.id, value: Number.isFinite(stored) && stored >= 0 ? stored : 0, same: true, warnings: [] });
      }
      const value = Number(row.value);
      if (row.value === null || row.value === undefined || !Number.isFinite(value) || value < 0 || value > MAX_VALUE) {
        return errors.push({ id: position.id, code: "valor", message: `El valor de «${position.label || position.id}» no es un importe válido.` });
      }
      const warnings = checkRow({ position, newValue: round2(value), date });
      if (warnings.length && !row.confirmed) needsConfirm.push({ id: position.id, warnings });
      touched.push({ id: position.id, value: round2(value), same: false, warnings });
    });
    if (needsConfirm.length) errors.push({ id: "", code: "confirmar", message: "Confirma las filas marcadas antes de guardar.", ids: needsConfirm.map((item) => item.id) });
    if (errors.length) return { ok: false, errors, needsConfirm, ignored, plan: null };
    if (!touched.length) return { ok: false, errors: [{ id: "", code: "vacio", message: "No hay ningún valor que guardar: rellena alguna fila o pulsa «Sin cambios»." }], needsConfirm, ignored, plan: null };
    const savedAt = text(now) || `${text(today) || date}T12:00:00.000Z`;
    const undo = [];
    const points = [];
    const nextPositions = list.map((position) => {
      const change = touched.find((item) => item.id === position.id);
      if (!change) return position;
      const normalized = engine ? engine.normalizePositions([position]).positions[0] : null;
      points.push({ id: position.id, value: change.value, cost: normalized ? round2(normalized.costBasis) : round2(position.costBasis || 0) });
      const apply = !position.asOf || date >= position.asOf;
      undo.push({ id: position.id, applied: apply, previous: { currentValue: position.currentValue, asOf: position.asOf, provenance: position.provenance } });
      return apply ? { ...position, currentValue: change.value, asOf: date, provenance: "declared" } : position;
    });
    return {
      ok: true, errors: [], needsConfirm: [], ignored,
      plan: {
        date, savedAt, nextPositions, points, undo,
        counts: { updated: touched.filter((item) => !item.same).length, same: touched.filter((item) => item.same).length, historic: undo.filter((item) => !item.applied).length },
      },
    };
  }

  /** Deshacer: cada posición vuelve a su valor, fecha y procedencia anteriores (solo las que la valoración movió). */
  function undoPositions(positions, undo) {
    const reverts = new Map((Array.isArray(undo) ? undo : []).filter((item) => item.applied).map((item) => [item.id, item.previous]));
    return (Array.isArray(positions) ? positions : []).map((position) => (reverts.has(position.id) ? { ...position, ...reverts.get(position.id) } : position));
  }

  // ---- Aviso del cierre --------------------------------------------------------------------------------------------------

  /**
   * El aviso no bloqueante del cierre de mes (decisión del hogar): qué posiciones llevan más de 35 días sin valorar.
   * @returns {string} vacío si no hay nada que avisar
   */
  function closeNote(positions, today) {
    const list = Array.isArray(positions) ? positions : [];
    const stale = list.filter((position) => freshness(position, today).stale);
    if (!list.length || !stale.length) return "";
    const names = stale.slice(0, 3).map((position) => position.label || "posición").join(", ");
    const more = stale.length > 3 ? ` y ${stale.length - 3} más` : "";
    return `Cartera: ${stale.length} de ${list.length} ${list.length === 1 ? "posición" : "posiciones"} sin valorar hace más de ${STALE_DAYS} días (${names}${more}). Actualiza la valoración en Inversión › Cartera; no impide cerrar el mes.`;
  }

  return {
    STORE_NAME, STALE_DAYS, MAX_POINTS, BIG_MOVE_PCT, BIG_MOVE_PCT_CRYPTO, SCALE_FACTOR,
    normalizeStore, addValuation, series, thin, recordTiming, timingSummary,
    ageDays, freshness, freshnessSummary, orderRows,
    netFlows, marketVariation, checkRow, warningText, buildSave, undoPositions, closeNote, formatDate,
  };
});
