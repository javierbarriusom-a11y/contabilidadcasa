(function attachCanonicalCardCycles(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalCardCycles = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createCanonicalCardCycles() {
  "use strict";

  // WP-30 · PR-1 (docs/WP30_DISENO.md): ciclos de las tarjetas de crédito. Con tarjeta, el dinero sale de la cuenta el día del
  // CARGO, no el de la compra, y las compras sueltas no aparecen en el extracto: solo su liquidación. Cada tarjeta lleva su
  // ciclo (día de corte, meses hasta el cargo y día de cargo) y la fila del plan que recibe su liquidación. Una compra va a esa
  // fila en el MES DEL CARGO, y mientras no llega el cargo del extracto la fila vale `max(previsto, acumulado)` (lo aplica
  // `actualAwareInfo`, app.js). Cuando llega el cargo, manda el cargo: las compras provisionales dejan de sumar y se comparan.
  //
  // Las compras provisionales son movimientos con `source: "captura-hoja"` y el id de su tarjeta en `card`. No dependen de las
  // reglas de asignación de movimientos: van a la fila de su tarjeta por la configuración, y si cambia el ciclo se reasignan.
  // Los días de corte y de cargo los introduce el hogar en la app: viven en un almacén privado, nunca en el repositorio.

  const STORE_NAME = "card-cycles";
  const SOURCE = "captura-hoja";
  const MAX_CARDS = 8;
  const MAX_NAME = 40;
  const MAX_OFFSET = 3;
  const MAX_CYCLES_SHOWN = 6;
  const TOLERANCE = 1;
  const END = "fin";
  const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

  function text(value) {
    return String(value ?? "").trim();
  }

  function round2(value) {
    return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  }

  function validIsoDate(value) {
    const match = text(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return false;
    const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
    return date.getUTCMonth() === Number(match[2]) - 1 && date.getUTCDate() === Number(match[3]);
  }

  function formatDate(iso) {
    return iso.split("-").reverse().join("/");
  }

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function daysIn(year, month) {
    return new Date(Date.UTC(year, month, 0)).getUTCDate();
  }

  function shiftMonth({ year, month }, count) {
    const index = year * 12 + (month - 1) + count;
    return { year: Math.floor(index / 12), month: (index % 12) + 1 };
  }

  function isoOf({ year, month }, day) {
    return `${year}-${pad(month)}-${pad(day)}`;
  }

  function addDaysIso(iso, count) {
    const [year, month, day] = iso.split("-").map(Number);
    return new Date(Date.UTC(year, month - 1, day + count)).toISOString().slice(0, 10);
  }

  // «fin» es el último día natural del mes; un día numérico (1-28) existe en todos los meses.
  function dayIn(ym, rule) {
    return rule === END ? daysIn(ym.year, ym.month) : Math.min(Number(rule), daysIn(ym.year, ym.month));
  }

  function validDay(value) {
    if (value === END) return END;
    const number = Number(value);
    return Number.isInteger(number) && number >= 1 && number <= 28 ? number : null;
  }

  function monthName(monthKey) {
    return MONTHS[Number(monthKey.slice(5, 7)) - 1] || monthKey;
  }

  function monthLabel(monthKey) {
    return `${monthName(monthKey)} de ${monthKey.slice(0, 4)}`;
  }

  /** Una tarjeta válida o null: lo que no es válido no entra (una copia o una nube corrupta no rompe la previsión). */
  function normalizeCard(raw) {
    if (!raw || typeof raw !== "object") return null;
    const id = text(raw.id);
    const label = text(raw.label).slice(0, MAX_NAME);
    const rowKey = text(raw.rowKey);
    const cutDay = validDay(raw.cutDay);
    const chargeDay = validDay(raw.chargeDay);
    const offset = Number(raw.chargeMonthOffset);
    if (!/^[A-Za-z0-9_.:-]{1,60}$/.test(id) || !label || !/^expense\|[^\u0000-\u001f]{1,160}$/.test(rowKey)) return null;
    if (cutDay === null || chargeDay === null || !Number.isInteger(offset) || offset < 0 || offset > MAX_OFFSET) return null;
    return { id, label, rowKey, cutDay, chargeMonthOffset: offset, chargeDay, trackedFrom: validIsoDate(raw.trackedFrom) ? text(raw.trackedFrom) : "" };
  }

  function normalizeStore(raw) {
    const list = raw && typeof raw === "object" && !Array.isArray(raw) && Array.isArray(raw.cards) ? raw.cards : [];
    const seen = new Set();
    const cards = [];
    list.forEach((item) => {
      const card = normalizeCard(item);
      if (!card || seen.has(card.id) || cards.length >= MAX_CARDS) return;
      seen.add(card.id);
      cards.push(card);
    });
    return { cards };
  }

  /**
   * Alta o cambio de una tarjeta, con sus errores en el idioma del hogar. Sin errores, devuelve el almacén nuevo.
   * @param {{ cards: Array<any> }} store
   * @param {{ id?: string, label?: string, rowKey?: string, cutDay?: any, chargeMonthOffset?: any, chargeDay?: any, trackedFrom?: string }} input
   * @param {{ rowKeys?: string[] }} [options] filas del plan entre las que se puede elegir
   */
  function upsertCard(store, input, options = {}) {
    const current = normalizeStore(store);
    const errors = {};
    const label = text(input.label).slice(0, MAX_NAME);
    if (!label) errors.label = "Pon un nombre a la tarjeta.";
    if (!text(input.rowKey)) errors.rowKey = "Elige la fila del plan donde se liquida la tarjeta.";
    else if (options.rowKeys && !options.rowKeys.includes(text(input.rowKey))) errors.rowKey = "Esa fila ya no está en el plan.";
    if (validDay(input.cutDay) === null) errors.cutDay = "El día de corte va del 1 al 28, o el último día del mes.";
    const offset = Number(input.chargeMonthOffset);
    if (!Number.isInteger(offset) || offset < 0 || offset > MAX_OFFSET) errors.chargeMonthOffset = `Los meses hasta el cargo van de 0 a ${MAX_OFFSET}.`;
    if (validDay(input.chargeDay) === null) errors.chargeDay = "El día de cargo va del 1 al 28, o el último día del mes.";
    if (text(input.trackedFrom) && !validIsoDate(input.trackedFrom)) errors.trackedFrom = "La fecha desde la que anotas no es válida.";
    const isNew = !text(input.id);
    if (isNew && current.cards.length >= MAX_CARDS) errors.label = `Como mucho ${MAX_CARDS} tarjetas.`;
    if (Object.keys(errors).length) return { store: current, card: null, errors };
    const used = new Set(current.cards.map((card) => card.id));
    let id = text(input.id);
    for (let n = current.cards.length + 1; !id; n += 1) if (!used.has(`tarjeta-${n}`)) id = `tarjeta-${n}`;
    const card = normalizeCard({ id, label, rowKey: text(input.rowKey), cutDay: input.cutDay === END ? END : Number(input.cutDay), chargeMonthOffset: offset, chargeDay: input.chargeDay === END ? END : Number(input.chargeDay), trackedFrom: text(input.trackedFrom) });
    if (!card) return { store: current, card: null, errors: { label: "No se puede guardar esa tarjeta." } };
    const cards = used.has(id) ? current.cards.map((item) => (item.id === id ? card : item)) : [...current.cards, card];
    return { store: { cards }, card, errors: {} };
  }

  function removeCard(store, id) {
    return { cards: normalizeStore(store).cards.filter((card) => card.id !== id) };
  }

  /**
   * El ciclo al que pertenece una compra: cuándo empieza y acaba, en qué mes se carga y qué día. Una compra hasta el día de
   * corte (incluido) cierra en su propio mes; una posterior, en el siguiente. El cargo cae `chargeMonthOffset` meses después
   * del mes de cierre.
   * @param {string} dateIso fecha de la compra, AAAA-MM-DD
   * @param {{ cutDay: any, chargeMonthOffset: number, chargeDay: any }} card
   */
  function cycleFor(dateIso, card) {
    if (!validIsoDate(dateIso)) return null;
    const [year, month, day] = dateIso.split("-").map(Number);
    const own = { year, month };
    const endMonth = day <= dayIn(own, card.cutDay) ? own : shiftMonth(own, 1);
    const previous = shiftMonth(endMonth, -1);
    const chargeMonth = shiftMonth(endMonth, card.chargeMonthOffset);
    return {
      cycleStart: addDaysIso(isoOf(previous, dayIn(previous, card.cutDay)), 1),
      cycleEnd: isoOf(endMonth, dayIn(endMonth, card.cutDay)),
      chargeMonth: `${chargeMonth.year}-${pad(chargeMonth.month)}`,
      chargeDate: isoOf(chargeMonth, dayIn(chargeMonth, card.chargeDay)),
    };
  }

  function isCapture(transaction) {
    return transaction && transaction.source === SOURCE && validIsoDate(text(transaction.date).slice(0, 10)) && Number.isFinite(Number(transaction.amount));
  }

  /**
   * Compras provisionales sin su cargo: importe acumulado por «fila|mes de cargo». Solo cuenta lo anotado con la hoja y con una
   * tarjeta configurada. Es el dato que `actualAwareInfo` usa mientras la fila no tiene real.
   * @param {{ cards: Array<any> }} store
   * @param {Array<any>} transactions
   * @returns {Map<string, number>}
   */
  function accruedByRowMonth(store, transactions) {
    const cards = new Map(normalizeStore(store).cards.map((card) => [card.id, card]));
    const totals = new Map();
    if (!cards.size) return totals;
    (Array.isArray(transactions) ? transactions : []).forEach((transaction) => {
      if (!isCapture(transaction)) return;
      const card = cards.get(text(transaction.card));
      const cycle = card && cycleFor(text(transaction.date).slice(0, 10), card);
      if (!cycle) return;
      const key = `${card.rowKey}|${cycle.chargeMonth}`;
      totals.set(key, round2((totals.get(key) || 0) + Math.abs(Number(transaction.amount))));
    });
    return totals;
  }

  /**
   * Los ciclos de cada tarjeta con lo anotado y, si ya llegó, el cargo. `realFor(rowKey, monthKey)`: el real de esa fila ese mes
   * (número) o null. La comparación solo se hace en ciclos COMPLETOS: uno que empezó antes de la primera compra anotada (o de
   * «anoto desde») no se compara, porque faltarían compras que la hoja nunca vio.
   * @param {{ store: any, transactions?: Array<any>, realFor?: (rowKey: string, monthKey: string) => number|null, today: string }} input
   */
  function cyclesView({ store, transactions = [], realFor = () => null, today }) {
    return normalizeStore(store).cards.map((card) => {
      const purchases = (Array.isArray(transactions) ? transactions : []).filter((transaction) => isCapture(transaction) && text(transaction.card) === card.id);
      const firstCapture = purchases.map((transaction) => text(transaction.date).slice(0, 10)).sort()[0] || "";
      const trackedFrom = card.trackedFrom || firstCapture;
      const byCharge = new Map();
      purchases.forEach((transaction) => {
        const cycle = cycleFor(text(transaction.date).slice(0, 10), card);
        if (!cycle) return;
        const entry = byCharge.get(cycle.chargeMonth) || { ...cycle, count: 0, total: 0 };
        entry.count += 1;
        entry.total = round2(entry.total + Math.abs(Number(transaction.amount)));
        byCharge.set(cycle.chargeMonth, entry);
      });
      const current = validIsoDate(today) ? cycleFor(today, card) : null;
      if (current && !byCharge.has(current.chargeMonth)) byCharge.set(current.chargeMonth, { ...current, count: 0, total: 0 });
      const cycles = [...byCharge.values()].sort((left, right) => right.chargeMonth.localeCompare(left.chargeMonth)).slice(0, MAX_CYCLES_SHOWN).map((entry) => {
        const real = realFor(card.rowKey, entry.chargeMonth);
        const hasReal = typeof real === "number" && Number.isFinite(real);
        const incomplete = !trackedFrom || trackedFrom > entry.cycleStart;
        const diff = hasReal && !incomplete ? round2(real - entry.total) : null;
        return {
          ...entry,
          real: hasReal ? round2(real) : null,
          status: hasReal ? "cargado" : (validIsoDate(today) && today <= entry.cycleEnd ? "sin-facturar" : "facturado"),
          incomplete,
          diff,
          reconcile: diff === null ? null : Math.abs(diff) <= TOLERANCE ? "cuadra" : diff > 0 ? "faltan-compras" : "compras-de-mas",
        };
      });
      return { card, trackedFrom, cycles };
    });
  }

  /** Un ejemplo para comprobar la configuración de un vistazo: una compra del día 15 del mes de hoy. */
  function previewText(card, today) {
    const sample = validIsoDate(today) ? `${today.slice(0, 8)}15` : "";
    const cycle = sample && cycleFor(sample, card);
    if (!cycle) return "";
    return `Ejemplo: una compra del ${formatDate(sample)} entra en el ciclo del ${formatDate(cycle.cycleStart)} al ${formatDate(cycle.cycleEnd)} y se carga el ${formatDate(cycle.chargeDate)}.`;
  }

  function summaryText(store) {
    const { cards } = normalizeStore(store);
    return cards.length ? `Tarjetas de crédito: ${cards.map((card) => card.label).join(", ")}` : "Tarjetas de crédito (ciclos de corte y cargo)";
  }

  function cycleLine(cycle, money) {
    const head = `Ciclo ${formatDate(cycle.cycleStart)} al ${formatDate(cycle.cycleEnd)} · cargo ${formatDate(cycle.chargeDate)} (${monthLabel(cycle.chargeMonth)})`;
    const bought = cycle.count ? `${cycle.count} compra${cycle.count === 1 ? "" : "s"}, ${money(cycle.total)}` : "sin compras anotadas";
    const state = { "sin-facturar": "sin facturar", facturado: "facturado, esperando el cargo", cargado: `cargado: ${cycle.real === null ? "" : money(cycle.real)}` }[cycle.status];
    let note = "";
    if (cycle.status === "cargado" && cycle.incomplete) note = " Ciclo incompleto: empezó antes de la primera compra anotada, no se compara.";
    else if (cycle.reconcile === "cuadra") note = " Cuadra con tus compras.";
    else if (cycle.reconcile === "faltan-compras") note = ` Tus compras suman ${money(cycle.total)} y el cargo fue ${money(cycle.real)}: faltan ${money(cycle.diff)} (compras sin anotar, intereses o comisiones).`;
    else if (cycle.reconcile === "compras-de-mas") note = ` Tus compras suman ${money(cycle.total)} y el cargo fue ${money(cycle.real)}: anotaste ${money(Math.abs(cycle.diff))} de más.`;
    return `${head} · ${bought} · ${state}.${note}`;
  }

  function dayOptions(selected) {
    return Array.from({ length: 28 }, (_, index) => index + 1).map((day) => `<option value="${day}"${String(selected) === String(day) ? " selected" : ""}>${day}</option>`).join("")
      + `<option value="${END}"${selected === END ? " selected" : ""}>Último día del mes</option>`;
  }

  /**
   * La ficha de Plan › Partidas. `rows`: las filas de Financiaciones entre las que elegir (`{ key, label, section }`).
   * @param {{ store: any, views: ReturnType<typeof cyclesView>, rows: Array<{ key: string, label: string, section?: string }>, today: string }} model
   * @param {{ money?: (value: number) => string, status?: string }} [options]
   */
  function renderHtml(model, options = {}) {
    const money = options.money || ((value) => `${value.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`);
    const { rows = [], views = [], today } = model;
    const offsetOptions = (selected) => [[0, "El mismo mes del corte"], [1, "El mes siguiente"], [2, "Dos meses después"], [3, "Tres meses después"]]
      .map(([value, label]) => `<option value="${value}"${Number(selected) === value ? " selected" : ""}>${label}</option>`).join("");
    const rowOptions = (selected) => `<option value="">Elige una fila</option>` + rows.map((row) => `<option value="${escapeHtml(row.key)}"${row.key === selected ? " selected" : ""}>${escapeHtml(row.section ? `${row.section} · ${row.label}` : row.label)}</option>`).join("");
    const form = (card, index) => {
      const id = card ? card.id : "nueva";
      const prefix = `tarjeta-${index}`;
      return `<form class="asignacion-persona" data-tarjeta="${escapeHtml(id)}" novalidate>`
        + `<p class="asignacion-titulo"><strong>${card ? escapeHtml(card.label) : "Añadir una tarjeta"}</strong></p>`
        + `<div class="asignacion-campos">`
        + `<label for="${prefix}-nombre"><span>Nombre</span><input id="${prefix}-nombre" name="label" type="text" maxlength="${MAX_NAME}" autocomplete="off" value="${card ? escapeHtml(card.label) : ""}" required /></label>`
        + `<label for="${prefix}-fila"><span>Fila donde se liquida</span><select id="${prefix}-fila" name="rowKey">${rowOptions(card ? card.rowKey : "")}</select></label>`
        + `<label for="${prefix}-corte"><span>Día de corte</span><select id="${prefix}-corte" name="cutDay">${dayOptions(card ? card.cutDay : 20)}</select></label>`
        + `<label for="${prefix}-meses"><span>Se carga</span><select id="${prefix}-meses" name="chargeMonthOffset">${offsetOptions(card ? card.chargeMonthOffset : 1)}</select></label>`
        + `<label for="${prefix}-cargo"><span>Día de cargo</span><select id="${prefix}-cargo" name="chargeDay">${dayOptions(card ? card.chargeDay : 1)}</select></label>`
        + `<label for="${prefix}-desde"><span>Anoto desde (opcional)</span><input id="${prefix}-desde" name="trackedFrom" type="date" value="${card ? escapeHtml(card.trackedFrom) : ""}" /></label>`
        + `</div>`
        + (card ? `<p class="e19-kpi-note">${escapeHtml(previewText(card, today))}</p>` : "")
        + `<p class="e19-kpi-note asignacion-error" id="${prefix}-error" role="alert"></p>`
        + `<div class="asignacion-acciones"><button type="submit" class="secondary-button">${card ? "Guardar cambios" : "Añadir"}</button>`
        + (card ? ` <button type="button" class="ghost-button" data-tarjeta-quitar="${escapeHtml(card.id)}">Quitar</button>` : "")
        + `</div></form>`;
    };
    const cycles = (view) => (view.cycles.length
      ? view.cycles.map((cycle) => `<p class="e19-kpi-note">${escapeHtml(cycleLine(cycle, money))}</p>`).join("")
      : "");
    const missing = (view) => (rows.some((row) => row.key === view.card.rowKey) ? "" : `<p class="e19-kpi-note is-warn">La fila de esta tarjeta ya no está en el plan: elige otra para que sus compras cuenten.</p>`);
    const intro = `<p class="e19-kpi-note">Con tarjeta de crédito, el dinero sale de la cuenta el día del <strong>cargo</strong>, no el de la compra. Cada tarjeta tiene su ciclo: las compras hasta el día de corte se cargan unos meses después, en la fila del plan donde ya liquidas esa tarjeta. Hasta que llega el cargo del extracto, esa fila vale lo mayor entre lo previsto y lo que llevas anotado; cuando llega, manda el cargo.</p>`;
    const list = views.map((view, index) => `<div class="asignacion-lista">${form(view.card, index)}${missing(view)}${cycles(view)}</div>`).join("");
    const add = views.length < MAX_CARDS ? `<div class="asignacion-lista">${form(null, views.length)}</div>` : "";
    const status = options.status ? `<p class="e19-kpi-note" role="status">${escapeHtml(options.status)}</p>` : "";
    return `${intro}${status}${list}${add}`;
  }

  return { STORE_NAME, SOURCE, MAX_CARDS, MAX_OFFSET, END, normalizeStore, normalizeCard, upsertCard, removeCard, cycleFor, accruedByRowMonth, cyclesView, previewText, summaryText, renderHtml };
});
