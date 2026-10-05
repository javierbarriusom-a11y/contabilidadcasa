(function attachCanonicalCardPurchases(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalCardPurchases = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createCanonicalCardPurchases() {
  "use strict";

  // WP-30 · PR-2 (docs/WP30_DISENO.md §4.2): las compras con tarjeta anotadas con la hoja de captura. Cada compra lleva su
  // importe, su concepto, su tarjeta y su fecha; el mes de cargo y la fila salen de la configuración de la tarjeta
  // (canonical-card-cycles.js), no se guardan aquí.
  //
  // Viven en un almacén propio (`card-purchases`, en la copia y la nube) y NO en los movimientos del banco: una compra con
  // tarjeta todavía no es un movimiento de la cuenta (solo lo será su liquidación), así que no debe contar en la conciliación
  // del libro, en el análisis por categorías ni en el aprendizaje del día de cargo, y deshacerla no puede exigir una foto del
  // estado entero por cada ticket. `toMovements` las presenta con la forma de movimiento que ya entiende
  // `accruedByRowMonth` / `cyclesView`.

  const STORE_NAME = "card-purchases";
  const SOURCE = "captura-hoja";
  const MAX_PURCHASES = 4000;
  const MAX_TIMINGS = 200;
  const MAX_CONCEPT = 60;
  const MAX_AMOUNT = 100000;
  const MAX_AGE_DAYS = 366;
  const MAX_SECONDS = 3600;
  const KINDS = ["hoja", "dialogo"];
  const SUGGESTION_WINDOW_DAYS = 120;
  const HOUR_WINDOW = 2;

  function text(value) {
    return String(value ?? "").trim();
  }

  function round2(value) {
    return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
  }

  function cleanText(value, max) {
    return text(value).replace(/[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u2028\u2029\uFEFF]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
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

  function formatDate(iso) {
    return iso.split("-").reverse().join("/");
  }

  function conceptKey(value) {
    return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  }

  function normalizePurchase(raw) {
    if (!raw || typeof raw !== "object") return null;
    const id = text(raw.id);
    const concept = cleanText(raw.concept, MAX_CONCEPT);
    const amount = Number(raw.amount);
    const card = text(raw.card);
    const date = text(raw.date);
    if (!/^[A-Za-z0-9_.:-]{1,80}$/.test(id) || !concept || !card || !validIsoDate(date)) return null;
    if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_AMOUNT) return null;
    const seconds = raw.seconds === null || raw.seconds === undefined || raw.seconds === "" ? NaN : Number(raw.seconds);
    return {
      id, date, concept, card, amount: round2(amount),
      capturedAt: Number.isFinite(Date.parse(text(raw.capturedAt))) ? text(raw.capturedAt) : "",
      seconds: Number.isFinite(seconds) && seconds >= 0 && seconds <= MAX_SECONDS ? seconds : null,
    };
  }

  function normalizeTiming(raw) {
    if (!raw || typeof raw !== "object" || !KINDS.includes(raw.kind)) return null;
    const seconds = Number(raw.seconds);
    if (!Number.isFinite(seconds) || seconds < 0 || seconds > MAX_SECONDS) return null;
    return { kind: raw.kind, seconds, at: Number.isFinite(Date.parse(text(raw.at))) ? text(raw.at) : "" };
  }

  /** Lo que no es válido no entra: una copia o una nube dañada no rompe la previsión. */
  function normalizeStore(raw) {
    const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
    const seen = new Set();
    const purchases = [];
    (Array.isArray(source.purchases) ? source.purchases : []).forEach((item) => {
      const purchase = normalizePurchase(item);
      if (!purchase || seen.has(purchase.id)) return;
      seen.add(purchase.id);
      purchases.push(purchase);
    });
    purchases.sort((left, right) => left.date.localeCompare(right.date) || left.id.localeCompare(right.id));
    const timings = (Array.isArray(source.timings) ? source.timings : []).map(normalizeTiming).filter(Boolean);
    return { purchases: purchases.slice(-MAX_PURCHASES), timings: timings.slice(-MAX_TIMINGS), lastCard: cleanText(source.lastCard, 60) };
  }

  /**
   * Valida lo que se ha tecleado y, si todo está bien, devuelve la compra lista para guardar. Los errores van en el idioma del hogar.
   * @param {{ amount?: any, concept?: any, card?: any, date?: any, seconds?: any }} input importe ya leído como número (o null)
   * @param {{ today: string, now?: string, cards?: Array<{ id: string }>, id?: string }} options
   */
  function buildPurchase(input, options) {
    const errors = {};
    const today = text(options?.today);
    const amount = Number(input?.amount);
    const concept = cleanText(input?.concept, MAX_CONCEPT);
    const card = text(input?.card);
    const date = text(input?.date) || today;
    if (!Number.isFinite(amount) || amount <= 0) errors.amount = "Pon un importe mayor que 0.";
    else if (amount > MAX_AMOUNT) errors.amount = "Ese importe es demasiado grande.";
    if (!concept) errors.concept = "Pon el concepto de la compra.";
    if (!card || (options?.cards && !options.cards.some((item) => item.id === card))) errors.card = "Elige la tarjeta.";
    if (!validIsoDate(date)) errors.date = "La fecha no es válida.";
    else if (validIsoDate(today) && date > today) errors.date = "La compra no puede ser de una fecha futura.";
    else if (validIsoDate(today) && daysBetween(date, today) > MAX_AGE_DAYS) errors.date = "Esa fecha es de hace más de un año.";
    if (Object.keys(errors).length) return { purchase: null, errors };
    const now = text(options?.now) || `${today}T12:00:00.000Z`;
    const id = text(options?.id) || `compra-${Date.parse(now) || 0}-${Math.random().toString(16).slice(2, 8)}`;
    const seconds = Number(input?.seconds);
    const purchase = normalizePurchase({ id, date, concept, card, amount: round2(amount), capturedAt: now, seconds: Number.isFinite(seconds) ? seconds : null });
    return purchase ? { purchase, errors: {} } : { purchase: null, errors: { amount: "No se puede guardar esa compra." } };
  }

  function addPurchase(store, purchase) {
    const current = normalizeStore(store);
    const next = normalizeStore({ ...current, purchases: [...current.purchases, purchase], lastCard: purchase.card });
    const withTiming = purchase.seconds === null ? next : recordTiming(next, "hoja", purchase.seconds, purchase.capturedAt);
    return withTiming;
  }

  function removePurchase(store, id) {
    const current = normalizeStore(store);
    return { ...current, purchases: current.purchases.filter((item) => item.id !== id) };
  }

  /** Un tiempo de captura: `hoja` (la hoja nueva) o `dialogo` (la ventana anterior «Registrar gasto»), para decir «de X a Y segundos». */
  function recordTiming(store, kind, seconds, at) {
    const current = normalizeStore(store);
    const timing = normalizeTiming({ kind, seconds: round2(seconds), at: text(at) });
    if (!timing) return current;
    return { ...current, timings: [...current.timings, timing].slice(-MAX_TIMINGS) };
  }

  /** Las compras con la forma de un movimiento, para `accruedByRowMonth` y `cyclesView` de canonical-card-cycles.js. */
  function toMovements(store) {
    return normalizeStore(store).purchases.map((purchase) => ({
      id: purchase.id, date: purchase.date, valueDate: purchase.date, month: purchase.date.slice(0, 7),
      movement: purchase.concept, details: "", amount: -purchase.amount, source: SOURCE, card: purchase.card,
    }));
  }

  /**
   * Hasta cinco conceptos para tocar en vez de teclear: los más repetidos en los últimos 120 días (de esa tarjeta, si se dice), con
   * un empujón a los de la misma franja horaria (±2 h) y, a igualdad, los más recientes. Se muestra la grafía más reciente.
   * @param {any} store
   * @param {{ now?: string, cardId?: string, limit?: number }} [options]
   */
  function conceptSuggestions(store, options = {}) {
    const limit = options.limit || 5;
    const now = Number.isFinite(Date.parse(text(options.now))) ? new Date(options.now) : null;
    const today = now ? now.toISOString().slice(0, 10) : "";
    const hour = now ? now.getUTCHours() : null;
    const groups = new Map();
    normalizeStore(store).purchases.forEach((purchase) => {
      if (options.cardId && purchase.card !== options.cardId) return;
      if (today && daysBetween(purchase.date, today) > SUGGESTION_WINDOW_DAYS) return;
      const key = conceptKey(purchase.concept);
      const entry = groups.get(key) || { concept: purchase.concept, score: 0, last: "" };
      const captured = Date.parse(purchase.capturedAt);
      const sameHour = hour !== null && Number.isFinite(captured) && Math.min(Math.abs(new Date(captured).getUTCHours() - hour), 24 - Math.abs(new Date(captured).getUTCHours() - hour)) <= HOUR_WINDOW;
      entry.score += sameHour ? 2 : 1;
      if (purchase.date >= entry.last) { entry.last = purchase.date; entry.concept = purchase.concept; }
      groups.set(key, entry);
    });
    return [...groups.values()].sort((a, b) => b.score - a.score || b.last.localeCompare(a.last) || a.concept.localeCompare(b.concept, "es")).slice(0, limit).map((entry) => entry.concept);
  }

  /** Mediana de una lista de números (null si está vacía). */
  function median(values) {
    const sorted = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
    if (!sorted.length) return null;
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : round2((sorted[middle - 1] + sorted[middle]) / 2);
  }

  /**
   * M-CAPT: tiempo hasta guardar (mediana de la hoja y de la ventana anterior) y qué parte de las compras se anotó el mismo día o el
   * siguiente a su fecha (≈ «registrado en < 48 h»). Sin tiempos, `null`: no se inventa una cifra.
   * @param {any} store
   */
  function timingSummary(store) {
    const current = normalizeStore(store);
    const pick = (kind) => current.timings.filter((item) => item.kind === kind).map((item) => item.seconds);
    const hoja = pick("hoja");
    const dialogo = pick("dialogo");
    const dated = current.purchases.filter((item) => item.capturedAt);
    const fast = dated.filter((item) => daysBetween(item.date, item.capturedAt.slice(0, 10)) <= 1).length; // el mismo día o el siguiente
    return {
      hoja: { count: hoja.length, median: median(hoja) },
      dialogo: { count: dialogo.length, median: median(dialogo) },
      within48h: dated.length ? { count: dated.length, percent: Math.round((fast / dated.length) * 100) } : null,
    };
  }

  /**
   * Compras por tarjeta, ciclo (mes de cargo) y concepto, de la más reciente a la más antigua.
   * @param {any} store
   * @param {{ cards: Array<any> }} cardsStore almacén de tarjetas
   * @param {{ cycleFor: Function }} cycles motor de ciclos
   * @param {{ months?: number }} [options] cuántos ciclos por tarjeta
   */
  function conceptReport(store, cardsStore, cycles, options = {}) {
    const maxCycles = options.months || 3;
    const purchases = normalizeStore(store).purchases;
    return (cardsStore?.cards || []).map((card) => {
      const byCycle = new Map();
      purchases.filter((purchase) => purchase.card === card.id).forEach((purchase) => {
        const cycle = cycles.cycleFor(purchase.date, card);
        if (!cycle) return;
        const entry = byCycle.get(cycle.chargeMonth) || { ...cycle, total: 0, count: 0, concepts: new Map() };
        entry.total = round2(entry.total + purchase.amount);
        entry.count += 1;
        const key = conceptKey(purchase.concept);
        const concept = entry.concepts.get(key) || { concept: purchase.concept, total: 0, count: 0 };
        concept.total = round2(concept.total + purchase.amount);
        concept.count += 1;
        concept.concept = purchase.concept; // las compras van por fecha: queda la grafía más reciente, como en las sugerencias
        entry.concepts.set(key, concept);
        byCycle.set(cycle.chargeMonth, entry);
      });
      const list = [...byCycle.values()].sort((a, b) => b.chargeMonth.localeCompare(a.chargeMonth)).slice(0, maxCycles).map((entry) => ({
        cycleStart: entry.cycleStart, cycleEnd: entry.cycleEnd, chargeMonth: entry.chargeMonth, chargeDate: entry.chargeDate, total: entry.total, count: entry.count,
        concepts: [...entry.concepts.values()].sort((a, b) => b.total - a.total || a.concept.localeCompare(b.concept, "es")),
      }));
      return { card, cycles: list };
    });
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  }

  /**
   * El apartado de Plan › Partidas con las compras anotadas: tiempos, compras por concepto y ciclo, y las últimas con «Quitar».
   * @param {{ store: any, report: ReturnType<typeof conceptReport>, cards: Array<any>, summary: ReturnType<typeof timingSummary> }} model
   * @param {{ money?: (value: number) => string, recent?: number }} [options]
   */
  function renderHtml(model, options = {}) {
    const money = options.money || ((value) => `${value.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`);
    const store = normalizeStore(model.store);
    const names = new Map((model.cards || []).map((card) => [card.id, card.label]));
    const seconds = (value) => `${String(value).replace(".", ",")} s`;
    const { hoja, dialogo, within48h } = model.summary || timingSummary(store);
    const lines = [];
    if (hoja.count) lines.push(`Tiempo para anotar una compra: mediana ${seconds(hoja.median)} en la hoja (${hoja.count} compra${hoja.count === 1 ? "" : "s"}; objetivo ≤ 8 s)${dialogo.count ? `, frente a ${seconds(dialogo.median)} en la ventana anterior (${dialogo.count})` : ""}.`);
    else if (dialogo.count) lines.push(`Tiempo en la ventana anterior «Registrar gasto»: mediana ${seconds(dialogo.median)} (${dialogo.count}). La hoja aún no tiene compras para compararlo.`);
    if (within48h) lines.push(`${within48h.percent} % de las compras se anotó el mismo día o el siguiente (${within48h.count} anotadas).`);
    const head = lines.map((line) => `<p class="e19-kpi-note">${escapeHtml(line)}</p>`).join("");
    const cycles = (model.report || []).map((entry) => {
      if (!entry.cycles.length) return "";
      const body = entry.cycles.map((cycle) => `<p class="e19-kpi-note"><strong>${escapeHtml(entry.card.label)} · cargo ${formatDate(cycle.chargeDate)}:</strong> ${money(cycle.total)} en ${cycle.count} compra${cycle.count === 1 ? "" : "s"}. ${cycle.concepts.map((item) => `${escapeHtml(item.concept)} ${money(item.total)}${item.count > 1 ? ` (${item.count})` : ""}`).join(" · ")}</p>`).join("");
      return body;
    }).join("");
    const recent = store.purchases.slice().sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)).slice(0, options.recent || 8);
    const list = recent.length
      ? `<ul class="e19-kpi-note">${recent.map((item) => `<li>${formatDate(item.date)} · ${escapeHtml(item.concept)} · ${money(item.amount)} · ${escapeHtml(names.get(item.card) || "tarjeta quitada")} <button type="button" class="ghost-button" data-compra-quitar="${escapeHtml(item.id)}" aria-label="Quitar la compra ${escapeHtml(item.concept)} del ${formatDate(item.date)}">Quitar</button></li>`).join("")}</ul>`
      : `<p class="e19-kpi-note">Todavía no hay compras anotadas. Se anotan con «+ Registrar gasto» en Hoy.</p>`;
    return `<h3 class="asignacion-titulo">Compras anotadas</h3>${head}${cycles}${list}`;
  }

  return { STORE_NAME, SOURCE, MAX_PURCHASES, MAX_CONCEPT, MAX_AMOUNT, MAX_AGE_DAYS, normalizeStore, buildPurchase, addPurchase, removePurchase, recordTiming, toMovements, conceptSuggestions, timingSummary, conceptReport, renderHtml, median };
});
