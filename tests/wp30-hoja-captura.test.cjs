const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const purchases = require("../canonical-card-purchases.js");
const cycles = require("../canonical-card-cycles.js");

// WP-30 · PR-2 (docs/WP30_DISENO.md §5): la hoja de captura de compras con tarjeta. El motor puro (canonical-card-purchases.js), su
// pantalla (captura-ui.js en un vm) y el cableado en app.js, index.html y las listas de ficheros. Los ciclos de estas pruebas son
// inventados: los reales los introduce el hogar y no van al repositorio.

const ROW = "expense|fila-tarjeta-1";
const CARD_A = { id: "t1", label: "Tarjeta A", rowKey: ROW, cutDay: 10, chargeMonthOffset: 1, chargeDay: 5, trackedFrom: "" };
const CARD_B = { id: "t2", label: "Tarjeta B", rowKey: "expense|fila-tarjeta-2", cutDay: "fin", chargeMonthOffset: 2, chargeDay: 1, trackedFrom: "" };
const TODAY = "2026-10-20";
const NOW = "2026-10-20T10:30:00.000Z";

function purchase(overrides = {}) {
  return { id: `c-${Math.random().toString(16).slice(2)}`, date: "2026-10-08", concept: "Mercadona", card: "t1", amount: 40, capturedAt: "2026-10-08T18:00:00.000Z", seconds: 6, ...overrides };
}

function storeOf(...list) {
  return purchases.normalizeStore({ purchases: list });
}

// ---- Validación y alta ----
test("buildPurchase: una compra válida sale limpia, con su fecha de hoy por defecto y un id propio", () => {
  const result = purchases.buildPurchase({ amount: 23.456, concept: "  Mercadona  centro ", card: "t1" }, { today: TODAY, now: NOW, cards: [CARD_A] });
  assert.deepEqual(result.errors, {});
  assert.equal(result.purchase.amount, 23.46);
  assert.equal(result.purchase.concept, "Mercadona centro");
  assert.equal(result.purchase.date, TODAY);
  assert.equal(result.purchase.capturedAt, NOW);
  assert.equal(result.purchase.seconds, null, "sin tiempo medido no se inventa uno");
  assert.match(result.purchase.id, /^compra-/);
  const other = purchases.buildPurchase({ amount: 23.456, concept: "Mercadona centro", card: "t1" }, { today: TODAY, now: NOW, cards: [CARD_A] });
  assert.notEqual(other.purchase.id, result.purchase.id, "dos compras iguales el mismo día son dos compras");
});

test("buildPurchase: cada error dice qué falta, en el idioma del hogar, y nada se guarda", () => {
  const bad = (input, field, pattern) => {
    const result = purchases.buildPurchase(input, { today: TODAY, now: NOW, cards: [CARD_A] });
    assert.equal(result.purchase, null, JSON.stringify(input));
    assert.match(result.errors[field], pattern, JSON.stringify(input));
  };
  bad({ amount: null, concept: "x", card: "t1" }, "amount", /importe mayor que 0/);
  bad({ amount: 0, concept: "x", card: "t1" }, "amount", /importe mayor que 0/);
  bad({ amount: -5, concept: "x", card: "t1" }, "amount", /importe mayor que 0/);
  bad({ amount: 100001, concept: "x", card: "t1" }, "amount", /demasiado grande/);
  bad({ amount: 5, concept: "   ", card: "t1" }, "concept", /concepto/);
  bad({ amount: 5, concept: "x", card: "" }, "card", /Elige la tarjeta/);
  bad({ amount: 5, concept: "x", card: "otra" }, "card", /Elige la tarjeta/);
  bad({ amount: 5, concept: "x", card: "t1", date: "2026-10-21" }, "date", /futura/);
  bad({ amount: 5, concept: "x", card: "t1", date: "2026-02-31" }, "date", /no es válida/);
  bad({ amount: 5, concept: "x", card: "t1", date: "2025-01-01" }, "date", /más de un año/);
});

test("el concepto no admite caracteres de control ni se pasa de largo", () => {
  const result = purchases.buildPurchase({ amount: 5, concept: `a\u0000b\nc${"x".repeat(100)}`, card: "t1" }, { today: TODAY, now: NOW, cards: [CARD_A] });
  assert.ok(!/[\u0000-\u001f]/.test(result.purchase.concept));
  assert.equal(result.purchase.concept.length, purchases.MAX_CONCEPT);
});

test("addPurchase recuerda la última tarjeta y mide el tiempo; removePurchase la quita sin tocar el resto", () => {
  const a = purchase({ id: "a", card: "t2", seconds: 5.5 });
  const b = purchase({ id: "b", seconds: null });
  let store = purchases.addPurchase({}, a);
  assert.equal(store.lastCard, "t2");
  assert.deepEqual(store.timings.map((item) => item.seconds), [5.5]);
  store = purchases.addPurchase(store, b);
  assert.equal(store.lastCard, "t1");
  assert.equal(store.timings.length, 1, "una compra sin tiempo no añade uno");
  assert.deepEqual(purchases.removePurchase(store, "a").purchases.map((item) => item.id), ["b"]);
  assert.equal(purchases.removePurchase(store, "no-existe").purchases.length, 2);
});

// ---- Lectura tolerante ----
test("normalizeStore tolera copias dañadas, descarta lo inválido, duplicados y lo que sobra", () => {
  assert.deepEqual(purchases.normalizeStore(null), { purchases: [], timings: [], lastCard: "" });
  assert.deepEqual(purchases.normalizeStore("texto"), { purchases: [], timings: [], lastCard: "" });
  assert.deepEqual(purchases.normalizeStore({ purchases: "no" }).purchases, []);
  const store = purchases.normalizeStore({
    purchases: [purchase({ id: "ok" }), purchase({ id: "ok" }), purchase({ id: "sin-concepto", concept: "" }), purchase({ id: "importe", amount: -3 }), purchase({ id: "fecha", date: "2026-13-01" }), null, 7, purchase({ id: "x y" })],
    timings: [{ kind: "hoja", seconds: 4 }, { kind: "otro", seconds: 4 }, { kind: "hoja", seconds: -1 }, { kind: "dialogo", seconds: "9" }],
  });
  assert.deepEqual(store.purchases.map((item) => item.id), ["ok"]);
  assert.deepEqual(store.timings.map((item) => item.kind), ["hoja", "dialogo"]);
  const many = purchases.normalizeStore({ purchases: Array.from({ length: purchases.MAX_PURCHASES + 50 }, (_, index) => purchase({ id: `p${index}`, date: `2026-${String(1 + (index % 9)).padStart(2, "0")}-05` })) });
  assert.equal(many.purchases.length, purchases.MAX_PURCHASES);
});

// ---- Integración con el motor de ciclos ----
test("toMovements alimenta a accruedByRowMonth: cada compra va a su fila en el mes de cargo de su tarjeta", () => {
  const store = storeOf(
    purchase({ id: "a", date: "2026-10-08", amount: 40 }), // corta el 10/10 → cargo 5/11
    purchase({ id: "b", date: "2026-10-12", amount: 25.5 }), // corta el 10/11 → cargo 5/12
    purchase({ id: "c", date: "2026-10-09", amount: 10, card: "t2" }), // fin de mes + 2 → cargo 1/12 en otra fila
    purchase({ id: "d", date: "2026-10-09", amount: 99, card: "quitada" }),
  );
  const moves = purchases.toMovements(store);
  assert.equal(moves.length, 4);
  assert.deepEqual({ source: moves[0].source, amount: moves[0].amount, month: moves[0].month, movement: moves[0].movement }, { source: "captura-hoja", amount: -40, month: "2026-10", movement: "Mercadona" });
  const map = cycles.accruedByRowMonth({ cards: [CARD_A, CARD_B] }, moves);
  assert.equal(map.get(`${ROW}|2026-11`), 40);
  assert.equal(map.get(`${ROW}|2026-12`), 25.5);
  assert.equal(map.get("expense|fila-tarjeta-2|2026-12"), 10);
  assert.equal(map.size, 3, "una tarjeta quitada no acumula");
});

test("dos compras idénticas el mismo día (mismo concepto e importe) suman las dos", () => {
  const a = purchases.buildPurchase({ amount: 2.5, concept: "Café", card: "t1" }, { today: TODAY, now: NOW, cards: [CARD_A] }).purchase;
  const b = purchases.buildPurchase({ amount: 2.5, concept: "Café", card: "t1" }, { today: TODAY, now: NOW, cards: [CARD_A] }).purchase;
  const store = purchases.addPurchase(purchases.addPurchase({}, a), b);
  assert.equal(store.purchases.length, 2);
  assert.equal(cycles.accruedByRowMonth({ cards: [CARD_A] }, purchases.toMovements(store)).get(`${ROW}|2026-12`), 5);
});

// ---- Sugerencias de concepto ----
test("conceptSuggestions: los más repetidos, con la grafía más reciente, hasta cinco", () => {
  const list = [];
  const add = (concept, times, date = "2026-10-01", extra = {}) => Array.from({ length: times }, (_, index) => list.push(purchase({ id: `p${list.length}`, concept, date, ...extra })));
  add("Mercadona", 4);
  add("mercadona", 1, "2026-10-15");
  add("Gasolina", 3);
  add("Farmacia", 2);
  add("Café", 2, "2026-10-12");
  add("Cine", 1, "2026-10-18");
  add("Parking", 1, "2026-09-30");
  const result = purchases.conceptSuggestions(storeOf(...list), { now: NOW, limit: 5 });
  assert.deepEqual(result, ["mercadona", "Gasolina", "Café", "Farmacia", "Cine"], "5 de 6 conceptos: Parking (1, el más antiguo) queda fuera; entre Café y Farmacia, el más reciente");
  assert.equal(purchases.conceptSuggestions(storeOf(...list), { now: NOW, limit: 2 }).length, 2);
});

test("conceptSuggestions: respeta la tarjeta, ignora lo de hace más de 120 días y agrupa sin acentos ni mayúsculas", () => {
  const store = storeOf(
    purchase({ id: "1", concept: "Café", card: "t1" }),
    purchase({ id: "2", concept: "CAFE", card: "t1", date: "2026-10-10" }),
    purchase({ id: "3", concept: "Pan", card: "t2" }),
    purchase({ id: "4", concept: "Antiguo", card: "t1", date: "2026-05-01" }),
  );
  assert.deepEqual(purchases.conceptSuggestions(store, { now: NOW, cardId: "t1" }), ["CAFE"]);
  assert.deepEqual(purchases.conceptSuggestions(store, { now: NOW, cardId: "t2" }), ["Pan"]);
  assert.deepEqual(purchases.conceptSuggestions(store, { now: NOW }), ["CAFE", "Pan"], "sin tarjeta, de todas; lo de hace más de 120 días, fuera");
  assert.deepEqual(purchases.conceptSuggestions({}, { now: NOW }), []);
});

test("conceptSuggestions: a igualdad, gana el concepto de la misma franja horaria", () => {
  const store = storeOf(
    purchase({ id: "m", concept: "Desayuno", capturedAt: "2026-10-10T08:00:00.000Z" }),
    purchase({ id: "n", concept: "Cena", capturedAt: "2026-10-10T21:00:00.000Z" }),
  );
  assert.equal(purchases.conceptSuggestions(store, { now: "2026-10-20T09:00:00.000Z" })[0], "Desayuno");
  assert.equal(purchases.conceptSuggestions(store, { now: "2026-10-20T20:00:00.000Z" })[0], "Cena");
});

// ---- Medida M-CAPT ----
test("timingSummary: medianas de la hoja y de la ventana anterior, y cuánto se anota el mismo día o el siguiente", () => {
  assert.deepEqual(purchases.timingSummary({}), { hoja: { count: 0, median: null }, dialogo: { count: 0, median: null }, within48h: null });
  let store = {};
  [4, 10, 6].forEach((seconds) => { store = purchases.addPurchase(store, purchase({ id: `s${seconds}`, seconds })); });
  [20, 30].forEach((seconds) => { store = purchases.recordTiming(store, "dialogo", seconds, NOW); });
  const summary = purchases.timingSummary(store);
  assert.deepEqual(summary.hoja, { count: 3, median: 6 });
  assert.deepEqual(summary.dialogo, { count: 2, median: 25 });
  assert.deepEqual(summary.within48h, { count: 3, percent: 100 });
  const late = purchases.addPurchase(store, purchase({ id: "late", date: "2026-10-01", capturedAt: "2026-10-09T10:00:00.000Z", seconds: null }));
  assert.deepEqual(purchases.timingSummary(late).within48h, { count: 4, percent: 75 });
  assert.equal(purchases.recordTiming({}, "otro", 5, NOW).timings.length, 0, "un tipo desconocido no se mide");
  assert.equal(purchases.recordTiming({}, "hoja", Number.NaN, NOW).timings.length, 0);
});

// ---- Informe por concepto y ciclo ----
test("conceptReport: por tarjeta, ciclo y concepto, lo más caro primero y los ciclos recientes primero", () => {
  const store = storeOf(
    purchase({ id: "1", date: "2026-10-08", concept: "Mercadona", amount: 40 }),
    purchase({ id: "2", date: "2026-10-09", concept: "mercadona", amount: 20 }),
    purchase({ id: "3", date: "2026-10-09", concept: "Gasolina", amount: 70 }),
    purchase({ id: "4", date: "2026-10-12", concept: "Cine", amount: 12 }),
    purchase({ id: "5", date: "2026-10-12", concept: "Otra", amount: 1, card: "t2" }),
  );
  const report = purchases.conceptReport(store, { cards: [CARD_A, CARD_B] }, cycles);
  assert.equal(report.length, 2);
  const [first] = report;
  assert.deepEqual(first.cycles.map((cycle) => [cycle.chargeMonth, cycle.total, cycle.count]), [["2026-12", 12, 1], ["2026-11", 130, 3]]);
  assert.deepEqual(first.cycles[1].concepts.map((item) => [item.concept, item.total, item.count]), [["Gasolina", 70, 1], ["mercadona", 60, 2]]);
  assert.equal(report[1].cycles.length, 1);
  assert.deepEqual(purchases.conceptReport({}, { cards: [CARD_A] }, cycles)[0].cycles, []);
});

// ---- Apartado de Plan › Partidas ----
function html(store, cards = [CARD_A, CARD_B]) {
  const normalized = purchases.normalizeStore(store);
  return purchases.renderHtml({ store: normalized, cards, report: purchases.conceptReport(normalized, { cards }, cycles), summary: purchases.timingSummary(normalized) });
}

test("el apartado de compras: vacío dice cómo anotar; con compras, escapa el HTML y ofrece «Quitar»", () => {
  assert.match(html({}), /Todavía no hay compras anotadas/);
  assert.ok(!/Tiempo para anotar/.test(html({})), "sin tiempos no se afirma ninguno");
  const out = html(storeOf(purchase({ id: "x1", concept: "<img src=x onerror=alert(1)>", amount: 12.5 })));
  assert.ok(!out.includes("<img"), "el concepto no entra como HTML");
  assert.match(out, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(out, /data-compra-quitar="x1"/);
  assert.match(out, /cargo 05\/11/);
  assert.match(out, /Tarjeta A/);
});

test("el apartado de compras: dice los tiempos y no promete lo que no mide", () => {
  let store = purchases.addPurchase({}, purchase({ id: "a", seconds: 6 }));
  store = purchases.recordTiming(store, "dialogo", 25, NOW);
  const out = html(store);
  assert.match(out, /mediana 6 s en la hoja \(1 compra; objetivo ≤ 8 s\), frente a 25 s en la ventana anterior \(1\)/);
  assert.match(out, /100 % de las compras se anotó el mismo día o el siguiente/);
  const onlyOld = html(purchases.recordTiming({}, "dialogo", 25, NOW));
  assert.match(onlyOld, /ventana anterior «Registrar gasto»: mediana 25 s/);
  assert.match(onlyOld, /La hoja aún no tiene compras para compararlo/);
  const decimal = html(purchases.addPurchase({}, purchase({ id: "d", seconds: 7.5 })));
  assert.match(decimal, /mediana 7,5 s/);
});

test("el apartado de compras: una tarjeta quitada no rompe la lista", () => {
  assert.match(html(storeOf(purchase({ id: "z", card: "quitada" }))), /tarjeta quitada/);
});

// ---- La pantalla (captura-ui.js) en un vm ----
function fakeElement(extra = {}) {
  const listeners = {};
  return { value: "", innerHTML: "", textContent: "", hidden: false, max: "", open: false, listeners, focused: 0, closed: [], shown: 0,
    addEventListener(type, handler) { listeners[type] = handler; },
    focus() { this.focused += 1; },
    showModal() { this.open = true; this.shown += 1; },
    close(value) { this.open = false; this.closed.push(value); },
    ...extra };
}

function sheetSandbox({ cards = [CARD_A, CARD_B], stored = {}, today = TODAY } = {}) {
  const ids = ["capturaHojaDialog", "capturaHojaForm", "capturaHojaAmount", "capturaHojaConcept", "capturaHojaSuggest", "capturaHojaCards", "capturaHojaDates", "capturaHojaDate", "capturaHojaPreview", "capturaHojaNote", "capturaHojaError", "capturaHojaSubmit", "capturaHojaCancel", "capturaHojaLegacy", "tarjetasCompras"];
  const elements = Object.fromEntries(ids.map((id) => [id, fakeElement()]));
  const storage = {};
  const calls = { render: 0, toasts: [], status: [], legacy: 0 };
  const state = { cards: { cards }, store: purchases.normalizeStore(stored), now: Date.parse(`${today}T10:30:00.000Z`) };
  const sandbox = {
    FinanceCanonicalCardPurchases: purchases,
    FinanceCanonicalCardCycles: cycles,
    globalThis: null,
    document: { getElementById: (id) => elements[id] || null },
    qs: (id) => elements[id] || null,
    cachedLocalStore: (name) => (name === "card-purchases" ? state.store : state.cards),
    loadCardCycles: () => state.cards,
    storageKey: (name) => `${name}:demo`,
    storageSet: (key, value) => { storage[key] = value; state.store = JSON.parse(value); },
    isoLocalDate: () => today,
    normalizedText: (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(),
    escapeHtml: (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char])),
    money: (value) => `${value} €`,
    parseAmountField: (value) => (String(value).trim() ? Number(String(value).replace(",", ".")) : null),
    formatAmountField: (value) => String(value).replace(".", ","),
    announceStatus: (message) => calls.status.push(message),
    render: () => { calls.render += 1; },
    showUndoToast: (message, undo, timeout) => calls.toasts.push({ message, undo, timeout }),
    openHomeQuickExpenseDialog: () => { calls.legacy += 1; },
    Date: class extends Date { constructor(...args) { super(...(args.length ? args : [state.now])); } static now() { return state.now; } },
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(`${read("captura-ui.js")}\nthis.api = { openCapturaHoja, saveCapturaSheet, renderCardPurchases, recordLegacyCaptureTime, handleCapturaClick, handleCapturaSubmit, handleCardPurchaseRemove, captureLinkSheetNote, getSheet: () => capturaSheet };`, sandbox);
  return { sandbox, api: sandbox.api, elements, storage, calls, state };
}

const click = (target) => ({ target: { closest: () => target }, preventDefault() {} });
const chip = (name, value) => ({ dataset: { [name]: value }, id: "" });

test("la hoja: sin tarjetas no se abre (el llamador usa la ventana anterior); con tarjetas, abre con el importe enfocado", () => {
  const none = sheetSandbox({ cards: [] });
  assert.equal(none.api.openCapturaHoja(), false);
  assert.equal(none.elements.capturaHojaDialog.shown, 0);
  const { api, elements } = sheetSandbox();
  assert.equal(api.openCapturaHoja(), true);
  assert.equal(elements.capturaHojaDialog.shown, 1);
  assert.equal(elements.capturaHojaAmount.focused, 1, "importe primero");
  assert.equal(elements.capturaHojaAmount.value, "");
  assert.match(elements.capturaHojaCards.innerHTML, /Tarjeta A/);
  assert.match(elements.capturaHojaCards.innerHTML, /Tarjeta B/);
  assert.match(elements.capturaHojaDates.innerHTML, /Hoy/);
  assert.equal(elements.capturaHojaDate.hidden, true);
  assert.equal(api.openCapturaHoja(), false, "ya abierta: no se abre dos veces");
});

test("la hoja: guarda con importe, concepto, tarjeta y fecha; muestra cuándo se carga y deja deshacer 8 s", () => {
  const { api, elements, calls, storage, state } = sheetSandbox();
  api.openCapturaHoja();
  elements.capturaHojaAmount.value = "23,40";
  elements.capturaHojaConcept.value = "Mercadona";
  api.handleCapturaClick(click(chip("capturaTarjeta", "t1")));
  assert.equal(elements.capturaHojaPreview.textContent, "Se carga el 05/12/2026 (ciclo del 11/10/2026 al 10/11/2026).", "una compra del 20/10 corta el 10/11 y se carga el 5/12");
  assert.equal(api.saveCapturaSheet(), true);
  const saved = JSON.parse(storage["card-purchases:demo"]);
  assert.equal(saved.purchases.length, 1);
  assert.deepEqual({ amount: saved.purchases[0].amount, concept: saved.purchases[0].concept, card: saved.purchases[0].card, date: saved.purchases[0].date }, { amount: 23.4, concept: "Mercadona", card: "t1", date: TODAY });
  assert.equal(saved.lastCard, "t1");
  assert.ok(saved.purchases[0].capturedAt);
  assert.equal(saved.timings.length, 1, "el tiempo hasta guardar queda medido (M-CAPT)");
  assert.equal(calls.render, 1, "recalcula la previsión");
  assert.equal(calls.toasts.length, 1);
  assert.equal(calls.toasts[0].timeout, 8000);
  assert.match(calls.toasts[0].message, /Anotada: 23\.4 € · Mercadona · Tarjeta A\. Se carga el 05\/12\/2026\./);
  calls.toasts[0].undo();
  assert.equal(state.store.purchases.length, 0, "deshacer quita la compra");
  assert.equal(calls.render, 2);
});

test("la hoja: ayer y otra fecha; una fecha futura o un campo vacío no guardan y dicen por qué", () => {
  const { api, elements, calls, state } = sheetSandbox();
  api.openCapturaHoja();
  elements.capturaHojaAmount.value = "5";
  elements.capturaHojaConcept.value = "Pan";
  api.handleCapturaClick(click(chip("capturaTarjeta", "t2")));
  api.handleCapturaClick(click(chip("capturaFecha", "ayer")));
  assert.equal(api.saveCapturaSheet(), true);
  assert.equal(state.store.purchases[0].date, "2026-10-19");
  api.openCapturaHoja();
  elements.capturaHojaAmount.value = "5";
  elements.capturaHojaConcept.value = "Pan";
  api.handleCapturaClick(click(chip("capturaFecha", "otra")));
  assert.equal(elements.capturaHojaDate.hidden, false);
  assert.equal(elements.capturaHojaDate.max, TODAY, "no se puede elegir el futuro");
  elements.capturaHojaDate.value = "2026-10-25";
  assert.equal(api.saveCapturaSheet(), false);
  assert.match(elements.capturaHojaError.textContent, /futura/);
  elements.capturaHojaDate.value = "2026-10-01";
  elements.capturaHojaConcept.value = "";
  assert.equal(api.saveCapturaSheet(), false);
  assert.match(elements.capturaHojaError.textContent, /concepto/);
  assert.equal(elements.capturaHojaConcept.focused > 0, true, "enfoca lo que falta");
  assert.equal(state.store.purchases.length, 1, "los errores no guardan nada");
  assert.equal(calls.toasts.length, 1);
});

test("la hoja: una sola tarjeta se elige sola; la última usada se recuerda; el enlace nombra la suya", () => {
  const one = sheetSandbox({ cards: [CARD_B] });
  one.api.openCapturaHoja();
  assert.equal(one.api.getSheet().cardId, "t2");
  const remembered = sheetSandbox({ stored: { purchases: [], lastCard: "t2" } });
  remembered.api.openCapturaHoja();
  assert.equal(remembered.api.getSheet().cardId, "t2");
  const twoNone = sheetSandbox();
  twoNone.api.openCapturaHoja();
  assert.equal(twoNone.api.getSheet().cardId, "", "con dos tarjetas y ninguna usada, hay que elegir");
  assert.equal(twoNone.api.saveCapturaSheet(), false);
  const link = sheetSandbox();
  link.api.openCapturaHoja({ amount: 23.4, label: "Mercadona", date: "2026-10-19", account: "tarjeta a", note: "Rellenado desde un enlace." });
  assert.equal(link.api.getSheet().cardId, "t1", "«tarjeta a» es la Tarjeta A, sin mayúsculas");
  assert.equal(link.api.getSheet().dateMode, "ayer");
  assert.equal(link.elements.capturaHojaAmount.value, "23,4");
  assert.equal(link.elements.capturaHojaConcept.value, "Mercadona");
  assert.equal(link.elements.capturaHojaNote.hidden, false);
  assert.equal(link.elements.capturaHojaSubmit.focused, 1, "con todo relleno, el foco va a Guardar");
  const ambiguous = sheetSandbox({ cards: [{ ...CARD_A, label: "Carrefour Javi" }, { ...CARD_A, id: "t2", label: "Carrefour Tere" }] });
  ambiguous.api.openCapturaHoja({ account: "Carrefour" });
  assert.equal(ambiguous.api.getSheet().cardId, "", "un nombre que vale para dos tarjetas no elige ninguna");
});

test("la hoja: los conceptos habituales se tocan en vez de teclear, y «Gasto sin tarjeta» abre la ventana anterior", () => {
  const stored = { purchases: [purchase({ id: "1", concept: "Mercadona" }), purchase({ id: "2", concept: "Mercadona" }), purchase({ id: "3", concept: "Gasolina" })] };
  const { api, elements, calls } = sheetSandbox({ stored });
  api.openCapturaHoja();
  assert.match(elements.capturaHojaSuggest.innerHTML, /data-captura-concepto="Mercadona"/);
  api.handleCapturaClick(click(chip("capturaConcepto", "Gasolina")));
  assert.equal(elements.capturaHojaConcept.value, "Gasolina");
  api.handleCapturaClick(click({ dataset: {}, id: "capturaHojaLegacy" }));
  assert.deepEqual(elements.capturaHojaDialog.closed, ["cancel"]);
  assert.equal(calls.legacy, 1);
  api.openCapturaHoja();
  api.handleCapturaClick(click({ dataset: {}, id: "capturaHojaCancel" }));
  assert.deepEqual(elements.capturaHojaDialog.closed, ["cancel", "cancel"]);
});

test("«Hecho» del teclado guarda: el envío del formulario guarda y cierra la hoja", () => {
  const { api, elements, state } = sheetSandbox({ cards: [CARD_A] });
  api.openCapturaHoja();
  elements.capturaHojaAmount.value = "9,90";
  elements.capturaHojaConcept.value = "Café";
  let prevented = 0;
  api.handleCapturaSubmit({ preventDefault: () => { prevented += 1; } });
  assert.equal(prevented, 1);
  assert.equal(state.store.purchases.length, 1);
  assert.deepEqual(elements.capturaHojaDialog.closed, ["confirm"]);
  const empty = sheetSandbox({ cards: [CARD_A] });
  empty.api.openCapturaHoja();
  empty.api.handleCapturaSubmit({ preventDefault() {} });
  assert.deepEqual(empty.elements.capturaHojaDialog.closed, [], "con errores se queda abierta");
});

test("el tiempo de la ventana anterior se guarda para poder comparar; un valor raro no", () => {
  const { api, state } = sheetSandbox();
  api.recordLegacyCaptureTime(21.5);
  api.recordLegacyCaptureTime(Number.NaN);
  api.recordLegacyCaptureTime(-3);
  assert.deepEqual(state.store.timings.map((item) => [item.kind, item.seconds]), [["dialogo", 21.5]]);
});

test("quitar una compra desde el informe se puede deshacer", () => {
  const stored = { purchases: [purchase({ id: "q1", concept: "Cine", amount: 12 })] };
  const { api, elements, calls, state } = sheetSandbox({ stored });
  api.renderCardPurchases();
  assert.match(elements.tarjetasCompras.innerHTML, /data-compra-quitar="q1"/);
  api.handleCardPurchaseRemove({ target: { closest: () => ({ dataset: { compraQuitar: "q1" } }) } });
  assert.equal(state.store.purchases.length, 0);
  assert.match(calls.toasts[0].message, /Compra quitada: Cine/);
  calls.toasts[0].undo();
  assert.equal(state.store.purchases.length, 1);
  assert.equal(calls.render, 2);
});

test("el texto que trae un enlace de registro se enseña como texto plano y cuenta lo que no se usó", () => {
  const { api } = sheetSandbox();
  const note = api.captureLinkSheetNote({ fields: { origin: "applepay", originLabel: "Apple Pay", account: "Carrefour", date: TODAY, dateDefaulted: true }, errors: { importe: "importe no reconocido: «abc»" }, warnings: ["concepto recortado a 80 caracteres"] });
  assert.match(note, /Rellenado desde un enlace \(Apple Pay · tarjeta o cuenta Carrefour · hoy, 20\/10\/2026\)\. Revisa los datos: no se guarda nada hasta que pulses «Guardar»\./);
  assert.match(note, /Del enlace no se ha usado: importe no reconocido/);
  assert.match(note, /Aviso: concepto recortado/);
});

// ---- Cableado ----
test("cableado: app.js usa la hoja con tarjetas, la ventana anterior sin ellas, y mide la ventana anterior", () => {
  const app = read("app.js");
  assert.match(app, /qs\("homeQuickExpenseOpen"\)\?\.addEventListener\("click", \(\) => \{ if \(!globalThis\.openCapturaHoja\?\.\(\)\) openHomeQuickExpenseDialog\(\); \}\)/);
  assert.match(app, /history\.replaceState\(null, "", "#registrar"\);\n\s+if \(globalThis\.openCapturaHoja\?\.\(\{ amount: link\.fields\.amount, label: link\.fields\.label, date: link\.fields\.date, account: link\.fields\.account, note: captureLinkSheetNote\(link\) \}\)\) return;/);
  assert.match(app, /globalThis\.recordLegacyCaptureTime\?\.\(\(Date\.now\(\) - openedAt\) \/ 1000\)/);
  assert.match(app, /accruedByRowMonth\(loadCardCycles\(\), globalThis\.FinanceCanonicalCardPurchases\?\.toMovements\(loadCardPurchases\(\)\)\)/);
  assert.ok(!/accruedByRowMonth\(loadCardCycles\(\), baseData/.test(app), "las compras ya no salen de los movimientos del banco");
  assert.match(app, /"card-purchases", \/\/ WP-30 \(PR-2\)/);
  const lines = app.split("\n").length;
  assert.ok(lines <= 37495, `app.js tiene ${lines} líneas (techo 37.495)`);
});

test("cableado: index.html tiene la hoja y sus scripts, antes de app.js; las listas de ficheros los incluyen", () => {
  const index = read("index.html");
  ["capturaHojaDialog", "capturaHojaForm", "capturaHojaAmount", "capturaHojaConcept", "capturaHojaSuggest", "capturaHojaCards", "capturaHojaDates", "capturaHojaDate", "capturaHojaPreview", "capturaHojaNote", "capturaHojaError", "capturaHojaSubmit", "capturaHojaCancel", "capturaHojaLegacy", "tarjetasCompras"].forEach((id) => {
    assert.equal((index.match(new RegExp(`id="${id}"`, "g")) || []).length, 1, `#${id}`);
  });
  assert.equal((index.match(/type="submit"/g) || []).length >= 1, true);
  const form = index.slice(index.indexOf('id="capturaHojaForm"'), index.indexOf("</form>", index.indexOf('id="capturaHojaForm"')));
  assert.equal((form.match(/type="submit"/g) || []).length, 1, "Guardar es el único botón de envío: «Hecho» del teclado guarda");
  const at = (name) => index.indexOf(`src="${name}`);
  assert.ok(at("canonical-card-cycles.js") < at("canonical-card-purchases.js"));
  assert.ok(at("canonical-card-purchases.js") < at("partidas-ui.js"));
  assert.ok(at("partidas-ui.js") < at("captura-ui.js"));
  assert.ok(at("captura-ui.js") < at("app.js"));
  ["canonical-card-purchases.js", "captura-ui.js"].forEach((name) => {
    assert.match(read("service-worker.js"), new RegExp(`"\\./${name.replace(".", "\\.")}",`));
    assert.match(read("tools/build-public-site.mjs"), new RegExp(`"${name.replace(".", "\\.")}",`));
  });
});

test("cableado: las compras viajan con la copia y la nube y la ficha las lee de su almacén", () => {
  assert.ok(read("app.js").includes('"card-purchases"'));
  const ui = read("partidas-ui.js");
  assert.match(ui, /transactions: globalThis\.FinanceCanonicalCardPurchases\?\.toMovements\(loadCardPurchases\(\)\) \|\| \[\]/);
  assert.match(ui, /renderCardPurchases\(\);/);
});

test("captura-ui.js no usa `qs` al cargarse (se ejecuta antes que app.js) y no deja HTML sin escapar", () => {
  const source = read("captura-ui.js");
  const topLevel = source.split("\n").filter((line) => /^(capturaListen|qs\()/.test(line));
  assert.ok(topLevel.every((line) => line.startsWith("capturaListen")), "los listeners se ponen con document.getElementById");
  assert.match(source, /function capturaChip\(label, attribute, value, pressed\) \{\n\s+return `.*\$\{escapeHtml\(value\)\}.*\$\{escapeHtml\(label\)\}/, "los chips escapan lo que pintan (el concepto y el nombre de la tarjeta vienen del hogar)");
});
