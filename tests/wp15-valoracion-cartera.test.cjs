const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const valuation = require("../canonical-portfolio-valuation.js");
const portfolio = require("../canonical-portfolio.js");

// WP-15 (docs/WP15_DISENO.md): la hoja de valoración de la cartera. El motor puro (canonical-portfolio-valuation.js), la pantalla
// (valoracion-ui.js en un vm) y el cableado. Las posiciones de estas pruebas son ficticias: las reales viven en el almacén privado.

const TODAY = "2026-10-20";

function position(overrides = {}) {
  return { id: "p1", type: "fondo", label: "Fondo Global", quantity: 10, costBasis: 1000, currentValue: 1200, asOf: "2026-09-20", acquisitionDate: "2025-01-10", provenance: "unknown", contributions: [], disposals: [], scheduledContributions: [], ...overrides };
}

const save = (overrides = {}) => valuation.buildSave({ positions: [position()], rows: [{ id: "p1", mode: "value", value: 1250 }], date: TODAY, today: TODAY, now: "2026-10-20T09:00:00.000Z", portfolio, ...overrides });

// ---- Almacén ----
test("normalizeStore tolera copias dañadas, descarta lo inválido y funde fechas repetidas", () => {
  assert.deepEqual(valuation.normalizeStore(null), { valuations: [], timings: [] });
  assert.deepEqual(valuation.normalizeStore("texto"), { valuations: [], timings: [] });
  assert.deepEqual(valuation.normalizeStore({ valuations: "no" }).valuations, []);
  const store = valuation.normalizeStore({
    valuations: [
      { date: "2026-10-01", points: [{ id: "a", value: 10, cost: 5 }, { id: "a", value: 99, cost: 5 }, { id: "b c", value: 1 }, { id: "d", value: -3 }, { id: "e", value: "x" }, null] },
      { date: "2026-10-01", points: [{ id: "f", value: 7, cost: 7 }] },
      { date: "2026-13-01", points: [{ id: "a", value: 1 }] },
      { date: "2026-10-02", points: [] },
      null,
    ],
    timings: [{ seconds: 12 }, { seconds: -1 }, { seconds: "x" }, { seconds: 99999 }],
  });
  assert.equal(store.valuations.length, 1);
  assert.deepEqual(store.valuations[0].points.map((point) => [point.id, point.value]), [["a", 10], ["f", 7]]);
  assert.deepEqual(store.timings.map((item) => item.seconds), [12]);
});

test("addValuation: una valoración por fecha (sustituye las filas de esa fecha, no duplica) y la serie sale ordenada", () => {
  let store = valuation.addValuation({}, { date: "2026-10-01", points: [{ id: "a", value: 100, cost: 90 }, { id: "b", value: 50, cost: 50 }], savedAt: "2026-10-01T10:00:00.000Z", today: TODAY });
  store = valuation.addValuation(store, { date: "2026-09-01", points: [{ id: "a", value: 80, cost: 80 }], savedAt: "2026-09-01T10:00:00.000Z", today: TODAY });
  store = valuation.addValuation(store, { date: "2026-10-01", points: [{ id: "a", value: 110, cost: 90 }], savedAt: "2026-10-01T18:00:00.000Z", today: TODAY });
  assert.equal(store.valuations.length, 2);
  assert.deepEqual(valuation.series(store, "a").map((point) => [point.date, point.value]), [["2026-09-01", 80], ["2026-10-01", 110]]);
  assert.deepEqual(valuation.series(store, "b").map((point) => [point.date, point.value]), [["2026-10-01", 50]], "la fila de otra posición de la misma fecha se conserva");
  assert.deepEqual(valuation.series(store, "nada"), []);
});

test("retención: lo de más de 24 meses se reduce al último punto de cada posición en cada mes; lo reciente queda entero", () => {
  let store = {};
  ["2024-01-05", "2024-01-20", "2024-02-03", "2026-09-01", "2026-09-15"].forEach((date, index) => {
    store = valuation.addValuation(store, { date, points: [{ id: "a", value: 100 + index, cost: 100 }], savedAt: `${date}T10:00:00.000Z`, today: TODAY });
  });
  assert.deepEqual(valuation.series(store, "a").map((point) => point.date), ["2024-01-20", "2024-02-03", "2026-09-01", "2026-09-15"]);
  assert.equal(valuation.series(store, "a")[0].value, 101, "queda el último punto de enero de 2024");
});

test("retención: tope de 500 fechas (se pierden las más antiguas)", () => {
  const valuations = Array.from({ length: 520 }, (_, index) => ({ date: new Date(Date.UTC(2026, 0, 1 + index)).toISOString().slice(0, 10), points: [{ id: "a", value: 1, cost: 1 }] }));
  const normalized = valuation.normalizeStore({ valuations });
  assert.equal(normalized.valuations.length, valuation.MAX_POINTS);
  assert.equal(normalized.valuations.at(-1).date, valuations.at(-1).date);
});

// ---- Frescura ----
test("frescura: hoy, ayer, hace N días, 35 días vale y 36 es antigua; sin fecha es antigua", () => {
  const check = (asOf) => valuation.freshness({ asOf }, TODAY);
  assert.deepEqual(check("2026-10-20"), { days: 0, stale: false, label: "valorada hoy" });
  assert.equal(check("2026-10-19").label, "valorada ayer");
  assert.equal(check("2026-10-08").label, "valorada hace 12 días");
  assert.equal(check("2026-09-15").stale, false, "35 días: todavía vale");
  assert.equal(check("2026-09-14").stale, true, "36 días");
  assert.deepEqual(check(""), { days: null, stale: true, label: "sin fecha de valoración" });
  assert.equal(valuation.freshness({ asOf: "2026-10-25" }, TODAY).days, 0, "una fecha futura no da días negativos");
});

test("M-VAL1: qué parte de la cartera está al día; sin posiciones no hay nada que medir", () => {
  assert.equal(valuation.freshnessSummary([], TODAY), null);
  const summary = valuation.freshnessSummary([position({ asOf: "2026-10-10" }), position({ id: "p2", asOf: "2026-06-01" }), position({ id: "p3", asOf: "" }), position({ id: "p4", asOf: "2026-10-19" })], TODAY);
  assert.deepEqual(summary, { total: 4, fresh: 2, stale: 2, never: 1, percentFresh: 50 });
});

test("orderRows: las que nunca se fecharon primero, luego las más antiguas y, a igualdad, las de más valor", () => {
  const rows = [
    position({ id: "nueva", asOf: "2026-10-18", currentValue: 9999 }),
    position({ id: "vieja-pequena", asOf: "2026-06-01", currentValue: 10 }),
    position({ id: "vieja-grande", asOf: "2026-06-01", currentValue: 500 }),
    position({ id: "sin-fecha", asOf: "", currentValue: 1 }),
  ];
  assert.deepEqual(valuation.orderRows(rows, TODAY).map((item) => item.id), ["sin-fecha", "vieja-grande", "vieja-pequena", "nueva"]);
  assert.deepEqual(valuation.orderRows(null, TODAY), []);
});

// ---- Variación de mercado ----
test("variación de mercado: descuenta las aportaciones y las ventas desde la valoración anterior (una aportación no es ganancia)", () => {
  const withContribution = position({ contributions: [{ id: "c1", date: "2026-10-01", amount: 500, quantity: 0 }] });
  const result = valuation.marketVariation({ position: withContribution, newValue: 1750, date: TODAY });
  assert.deepEqual({ calculable: result.calculable, amount: result.amount, flows: result.flows, pct: result.pct }, { calculable: true, amount: 50, flows: 500, pct: 4.2 });
  const withSale = position({ disposals: [{ id: "d1", date: "2026-10-05", quantitySold: 1, saleProceeds: 300 }] });
  assert.equal(valuation.marketVariation({ position: withSale, newValue: 950, date: TODAY }).amount, 50, "1.200 − 300 de venta = 900; 950 − 900 = +50 de mercado");
  const before = position({ contributions: [{ id: "c0", date: "2026-09-10", amount: 500, quantity: 0 }] });
  assert.equal(valuation.marketVariation({ position: before, newValue: 1260, date: TODAY }).flows, 0, "una aportación anterior a la valoración anterior ya está en ese valor");
  const sameDay = position({ contributions: [{ id: "c2", date: TODAY, amount: 100, quantity: 0 }] });
  assert.equal(valuation.marketVariation({ position: sameDay, newValue: 1300, date: TODAY }).flows, 100, "una aportación fechada el mismo día de la valoración cuenta");
  const onPrevious = position({ contributions: [{ id: "c3", date: "2026-09-20", amount: 100, quantity: 0 }] });
  assert.equal(valuation.marketVariation({ position: onPrevious, newValue: 1300, date: TODAY }).flows, 0, "una aportación del mismo día que la valoración anterior ya estaba en ella");
});

test("variación de mercado: sin valoración anterior fiable no se inventa y dice por qué", () => {
  assert.deepEqual(valuation.marketVariation({ position: position({ asOf: "" }), newValue: 5, date: TODAY }), { calculable: false, reason: "primera-valoracion", amount: null, pct: null, flows: 0 });
  assert.equal(valuation.marketVariation({ position: position({ currentValue: 0 }), newValue: 5, date: TODAY }).reason, "sin-valor-anterior");
  assert.equal(valuation.marketVariation({ position: position(), newValue: 5, date: "2026-08-01" }).reason, "fecha-anterior");
});

// ---- Salvaguardas ----
test("salvaguardas: 0 explícito, salto de más del 20 % (40 % en cripto) y factor 100; lo normal no avisa", () => {
  const check = (overrides, newValue) => valuation.checkRow({ position: position(overrides), newValue, date: TODAY });
  assert.deepEqual(check({}, 0), ["cero"]);
  assert.deepEqual(check({}, 1250), []);
  assert.deepEqual(check({}, 1440), [], "+20 % justo: no avisa");
  assert.deepEqual(check({}, 1441), ["salto"]);
  assert.deepEqual(check({}, 800), ["salto"]);
  assert.deepEqual(check({ type: "cripto" }, 1441), [], "en cripto el umbral es del 40 %");
  assert.deepEqual(check({ type: "cripto" }, 1700), ["salto"]);
  assert.deepEqual(check({}, 120000), ["escala"], "una coma de más: solo escala, no también salto");
  assert.deepEqual(check({}, 12), ["escala"], "una coma de menos");
  assert.deepEqual(check({ currentValue: 0, asOf: "" }, 5000), [], "sin valor anterior no hay con qué comparar");
  const flowing = position({ contributions: [{ id: "c1", date: "2026-10-01", amount: 1000, quantity: 0 }] });
  assert.deepEqual(valuation.checkRow({ position: flowing, newValue: 2250, date: TODAY }), [], "la aportación de 1.000 € no es un salto de mercado");
});

test("los textos de aviso están en el idioma del hogar y citan el porcentaje y el umbral", () => {
  assert.match(valuation.warningText("cero"), /vale 0|es 0/i);
  assert.match(valuation.warningText("escala"), /coma/);
  assert.match(valuation.warningText("salto", { pct: 33.3, limit: 20 }), /33,3 %.*20 %/);
  assert.equal(valuation.warningText("otro"), "");
});

// ---- Guardar ----
test("guardar un valor: la posición cambia de valor, fecha y procedencia; el punto lleva el coste; lo demás no se toca", () => {
  const original = [position(), position({ id: "p2", label: "Otra", currentValue: 300, asOf: "2026-08-01" })];
  const snapshot = JSON.stringify(original);
  const result = valuation.buildSave({ positions: original, rows: [{ id: "p1", mode: "value", value: 1250.456 }, { id: "p2", mode: "skip" }], date: TODAY, today: TODAY, now: "2026-10-20T09:00:00.000Z", portfolio });
  assert.equal(result.ok, true);
  assert.equal(JSON.stringify(original), snapshot, "no muta lo guardado");
  const [first, second] = result.plan.nextPositions;
  assert.deepEqual({ value: first.currentValue, asOf: first.asOf, provenance: first.provenance }, { value: 1250.46, asOf: TODAY, provenance: "declared" });
  assert.equal(second, original[1], "una fila omitida queda igual, la misma referencia");
  assert.deepEqual(result.plan.points, [{ id: "p1", value: 1250.46, cost: 1000 }]);
  assert.deepEqual(result.plan.counts, { updated: 1, same: 0, historic: 0 });
  assert.equal(result.plan.savedAt, "2026-10-20T09:00:00.000Z");
});

test("vacío frente a cero: una fila vacía (o «skip») no cambia nada; un 0 explícito pide confirmar y, confirmado, vale cero", () => {
  const empty = valuation.buildSave({ positions: [position()], rows: [{ id: "p1", mode: "skip" }], date: TODAY, today: TODAY, portfolio });
  assert.equal(empty.ok, false);
  assert.equal(empty.errors[0].code, "vacio");
  const zero = save({ rows: [{ id: "p1", mode: "value", value: 0 }] });
  assert.equal(zero.ok, false);
  assert.equal(zero.errors[0].code, "confirmar");
  assert.deepEqual(zero.errors[0].ids, ["p1"]);
  const confirmed = save({ rows: [{ id: "p1", mode: "value", value: 0, confirmed: true }] });
  assert.equal(confirmed.ok, true);
  assert.equal(confirmed.plan.nextPositions[0].currentValue, 0);
  assert.equal(save({ rows: [{ id: "p1", mode: "value", value: null }] }).errors[0].code, "valor");
  assert.equal(save({ rows: [{ id: "p1", mode: "value", value: -5 }] }).errors[0].code, "valor");
  assert.equal(save({ rows: [{ id: "p1", mode: "value", value: Number.NaN }] }).errors[0].code, "valor");
});

test("un salto o una coma de más piden confirmar; confirmado, se guarda", () => {
  const jump = save({ rows: [{ id: "p1", mode: "value", value: 2000 }] });
  assert.equal(jump.ok, false);
  assert.equal(jump.errors[0].code, "confirmar");
  assert.equal(save({ rows: [{ id: "p1", mode: "value", value: 2000, confirmed: true }] }).ok, true);
  const scale = save({ rows: [{ id: "p1", mode: "value", value: 125000 }] });
  assert.equal(scale.ok, false);
  assert.deepEqual(scale.needsConfirm[0].warnings, ["escala"]);
});

test("«Sin cambios»: conserva el valor y renueva la fecha; con una fecha anterior a la valoración se ignora", () => {
  const result = save({ rows: [{ id: "p1", mode: "same" }] });
  assert.equal(result.ok, true);
  assert.deepEqual({ value: result.plan.nextPositions[0].currentValue, asOf: result.plan.nextPositions[0].asOf }, { value: 1200, asOf: TODAY });
  assert.deepEqual(result.plan.counts, { updated: 0, same: 1, historic: 0 });
  assert.deepEqual(result.plan.points, [{ id: "p1", value: 1200, cost: 1000 }]);
  const past = save({ rows: [{ id: "p1", mode: "same" }], date: "2026-08-01" });
  assert.equal(past.ok, false);
  assert.deepEqual(past.ignored, [{ id: "p1", code: "sin-cambios-pasado" }]);
});

test("una fecha anterior a la de la posición añade un punto histórico y NO mueve el valor actual ni su fecha", () => {
  const result = save({ rows: [{ id: "p1", mode: "value", value: 1100 }], date: "2026-08-15" });
  assert.equal(result.ok, true);
  assert.equal(result.plan.nextPositions[0].currentValue, 1200);
  assert.equal(result.plan.nextPositions[0].asOf, "2026-09-20");
  assert.deepEqual(result.plan.points, [{ id: "p1", value: 1100, cost: 1000 }]);
  assert.deepEqual(result.plan.counts, { updated: 1, same: 0, historic: 1 });
  assert.equal(result.plan.undo[0].applied, false);
});

test("una posición sin fecha se actualiza con cualquier fecha", () => {
  const result = save({ positions: [position({ asOf: "" })], rows: [{ id: "p1", mode: "value", value: 1210 }], date: "2026-08-15" });
  assert.equal(result.plan.nextPositions[0].asOf, "2026-08-15");
});

test("la fecha: futura, imposible o de hace más de diez años no guardan", () => {
  assert.equal(save({ date: "2026-10-21" }).errors[0].code, "fecha");
  assert.equal(save({ date: "2026-02-31" }).errors[0].code, "fecha");
  assert.equal(save({ date: "2010-01-01" }).errors[0].code, "fecha");
  assert.equal(save({ date: "" }).errors[0].code, "fecha");
});

test("el coste del punto sale de la posición normalizada (con aportaciones), no del alta", () => {
  const result = save({ positions: [position({ contributions: [{ id: "c1", date: "2026-10-01", amount: 500, quantity: 0 }] })], rows: [{ id: "p1", mode: "value", value: 1750 }] });
  assert.equal(result.plan.points[0].cost, 1500);
});

test("deshacer devuelve valor, fecha y procedencia anteriores a las posiciones que la valoración movió, y solo a ellas", () => {
  const original = [position(), position({ id: "p2", currentValue: 300, asOf: "2026-08-01" })];
  const result = valuation.buildSave({ positions: original, rows: [{ id: "p1", mode: "value", value: 1250 }, { id: "p2", mode: "value", value: 310 }], date: "2026-08-15", today: TODAY, portfolio });
  const moved = valuation.undoPositions(result.plan.nextPositions, result.plan.undo);
  assert.deepEqual(moved, original, "con fecha pasada nada se movió y nada hay que devolver");
  const today = valuation.buildSave({ positions: original, rows: [{ id: "p1", mode: "value", value: 1250 }], date: TODAY, today: TODAY, portfolio });
  const touchedInBetween = today.plan.nextPositions.map((item) => (item.id === "p2" ? { ...item, currentValue: 999 } : item));
  const restored = valuation.undoPositions(touchedInBetween, today.plan.undo);
  assert.equal(restored[0].currentValue, 1200);
  assert.equal(restored[0].asOf, "2026-09-20");
  assert.equal(restored[0].provenance, "unknown");
  assert.equal(restored[1].currentValue, 999, "lo que se cambió después no se pisa");
});

// ---- Aviso del cierre y tiempos ----
test("aviso del cierre: solo si hay posiciones sin valorar hace más de 35 días; no bloquea y dice cuáles", () => {
  assert.equal(valuation.closeNote([], TODAY), "");
  assert.equal(valuation.closeNote([position({ asOf: "2026-10-10" })], TODAY), "");
  const note = valuation.closeNote([position({ asOf: "2026-06-01", label: "Fondo A" }), position({ id: "b", asOf: "", label: "Fondo B" }), position({ id: "c", asOf: "2026-10-10" })], TODAY);
  assert.match(note, /2 de 3 posiciones sin valorar hace más de 35 días \(Fondo A, Fondo B\)/);
  assert.match(note, /no impide cerrar el mes/);
  assert.match(valuation.closeNote(Array.from({ length: 6 }, (_, index) => position({ id: `x${index}`, asOf: "", label: `F${index}` })), TODAY), /y 3 más/);
});

test("tiempos de la hoja: mediana; un valor imposible no se guarda", () => {
  let store = {};
  [30, 10, 20, 40].forEach((seconds) => { store = valuation.recordTiming(store, seconds, "2026-10-20T10:00:00.000Z"); });
  assert.deepEqual(valuation.timingSummary(store), { count: 4, median: 25 });
  assert.equal(valuation.recordTiming(store, Number.NaN, "").timings.length, 4);
  assert.equal(valuation.recordTiming(store, -1, "").timings.length, 4);
  assert.deepEqual(valuation.timingSummary({}), { count: 0, median: null });
});

// ---- La pantalla (valoracion-ui.js) en un vm ----
function fakeElement(extra = {}) {
  const listeners = {};
  return { value: "", innerHTML: "", textContent: "", hidden: false, max: "", open: false, title: "", className: "", disabled: false, listeners, closed: [], shown: 0, focused: 0, attrs: {},
    addEventListener(type, handler) { listeners[type] = handler; },
    setAttribute(name, value) { this.attrs[name] = value; },
    querySelector() { return null; },
    showModal() { this.open = true; this.shown += 1; },
    close(value) { this.open = false; this.closed.push(value); },
    focus() { this.focused += 1; },
    ...extra };
}

function uiSandbox({ positions = [position(), position({ id: "p2", label: "Fondo Dos", currentValue: 300, asOf: "2026-06-01", type: "cripto" })], store = {}, today = TODAY } = {}) {
  const ids = ["valoracionDialog", "valoracionForm", "valoracionFechas", "valoracionFecha", "valoracionFilas", "valoracionError", "valoracionResumen", "valoracionAbrir", "valoracionCancelar"];
  const elements = Object.fromEntries(ids.map((id) => [id, fakeElement()]));
  const state = { positions: JSON.parse(JSON.stringify(positions)), store: valuation.normalizeStore(store), storage: {}, now: Date.parse(`${today}T10:00:00.000Z`) };
  const calls = { render: 0, refresh: [], toasts: [], status: [], saved: 0, errors: [] };
  const dom = {};
  const sandbox = {
    FinanceCanonicalPortfolioValuation: valuation,
    FinanceCanonicalPortfolio: portfolio,
    console: { error: (message) => calls.errors.push(message) },
    globalThis: null,
    CSS: { escape: (value) => String(value) },
    document: {
      getElementById: (id) => elements[id] || null,
      querySelector: (selector) => dom[selector] || null,
    },
    qs: (id) => elements[id] || null,
    cachedLocalStore: () => state.store,
    storageKey: (name) => `${name}:demo`,
    storageSet: (key, value) => { state.storage[key] = value; state.store = valuation.normalizeStore(JSON.parse(value)); },
    iv1PositionsList: () => state.positions,
    saveIv1PositionsList: (next) => { state.positions = next; calls.saved += 1; },
    isoLocalDate: () => today,
    escapeHtml: (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char])),
    money: (value) => `${value} €`,
    parseAmountField: (value) => (String(value).trim() ? Number(String(value).replace(",", ".")) : null),
    announceStatus: (message) => calls.status.push(message),
    render: () => { calls.render += 1; },
    showUndoToast: (message, undo, timeout) => calls.toasts.push({ message, undo, timeout }),
    renderIv1PositionList: () => calls.refresh.push("renderIv1PositionList"),
    renderIvx6GlidePath: () => calls.refresh.push("renderIvx6GlidePath"),
    renderLev5DynamicStress: () => { throw new Error("falla uno de los repintados"); },
    IV1_POSITION_TYPE_LABELS: { fondo: "Fondo", cripto: "Cripto" },
    Date: class extends Date { constructor(...args) { super(...(args.length ? args : [state.now])); } static now() { return state.now; } },
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(`${read("valoracion-ui.js")}\nthis.api = { openValoracionHoja, saveValoracionHoja, handleValoracionClick, handleValoracionInput, handleValoracionSubmit, renderValuationSummary, refreshInvestmentViews, valuationRowHtml, valuationSelectedDate, setSheet: (value) => { valuationSheet = value; }, getSheet: () => valuationSheet };`, sandbox);
  return { sandbox, api: sandbox.api, elements, state, calls, dom };
}

test("la hoja: sin posiciones no se abre; con ellas, las más antiguas primero y la fecha de hoy", () => {
  const none = uiSandbox({ positions: [] });
  assert.equal(none.api.openValoracionHoja(), false);
  assert.equal(none.elements.valoracionDialog.shown, 0);
  const { api, elements } = uiSandbox();
  assert.equal(api.openValoracionHoja(), true);
  assert.equal(elements.valoracionDialog.shown, 1);
  const html = elements.valoracionFilas.innerHTML;
  assert.ok(html.indexOf("Fondo Dos") < html.indexOf("Fondo Global"), "la de junio, antes que la de septiembre");
  assert.match(html, /Valor anterior 300 € · valorada hace 141 días/);
  assert.match(elements.valoracionFechas.innerHTML, /aria-pressed="true"[^>]*>Hoy|data-valoracion-fecha="hoy" aria-pressed="true"/);
  assert.equal(elements.valoracionFecha.hidden, true);
  assert.equal(elements.valoracionFecha.max, TODAY);
  assert.equal(api.openValoracionHoja(), false, "ya abierta: no se abre dos veces");
});

test("la hoja escapa lo que pinta (el nombre de una posición viene del hogar)", () => {
  const { api } = uiSandbox({ positions: [position({ label: "<img src=x onerror=alert(1)>" })] });
  const html = api.valuationRowHtml(portfolio.normalizePositions([position({ label: "<img src=x onerror=alert(1)>" })]).positions[0], TODAY);
  assert.ok(!html.includes("<img"));
  assert.match(html, /&lt;img src=x/);
});

test("guardar desde la hoja: actualiza posiciones, añade el punto a la serie, mide el tiempo, repinta y deja deshacer 8 s", () => {
  const { api, state, calls, sandbox } = uiSandbox();
  api.openValoracionHoja();
  api.setSheet({ openedAt: state.now - 12500, dateMode: "hoy", modes: new Map() });
  // Lo que el hogar teclea: p1 = 1.250 €; p2 vacío.
  vm.runInContext(`readValuationRows = () => [{ id: "p1", mode: "value", value: 1250, confirmed: false }, { id: "p2", mode: "skip" }];`, sandbox);
  assert.equal(api.saveValoracionHoja(), true);
  assert.equal(state.positions[0].currentValue, 1250);
  assert.equal(state.positions[0].asOf, TODAY);
  assert.equal(state.positions[1].currentValue, 300, "una fila vacía no cambia");
  assert.deepEqual(valuation.series(state.store, "p1").map((point) => [point.date, point.value, point.cost]), [[TODAY, 1250, 1000]]);
  assert.equal(valuation.timingSummary(state.store).median, 12.5, "el tiempo hasta guardar queda medido (M-VAL2)");
  assert.equal(calls.render, 1);
  assert.ok(calls.refresh.includes("renderIv1PositionList") && calls.refresh.includes("renderIvx6GlidePath"), "repinta la cadena de Inversión");
  assert.equal(calls.toasts.length, 1);
  assert.equal(calls.toasts[0].timeout, 8000);
  assert.match(calls.toasts[0].message, /Valoración del 20\/10\/2026 guardada: 1 valorada/);
  calls.toasts[0].undo();
  assert.equal(state.positions[0].currentValue, 1200, "deshacer devuelve el valor anterior");
  assert.equal(state.positions[0].asOf, "2026-09-20");
  assert.deepEqual(valuation.series(state.store, "p1"), [], "y quita su punto de la serie");
  assert.equal(calls.render, 2);
});

test("un repintado que falla no impide los demás ni la valoración", () => {
  const { api, calls } = uiSandbox();
  api.refreshInvestmentViews();
  assert.deepEqual(calls.refresh, ["renderIv1PositionList", "renderIvx6GlidePath"]);
  assert.match(calls.errors[0], /renderLev5DynamicStress: falla uno de los repintados/);
});

test("el resumen de la tarjeta: frescura, pendientes y tiempo de la hoja; sin posiciones lo dice y desactiva el botón", () => {
  const empty = uiSandbox({ positions: [] });
  empty.api.renderValuationSummary();
  assert.match(empty.elements.valoracionResumen.textContent, /Todavía no hay posiciones/);
  assert.equal(empty.elements.valoracionAbrir.disabled, true);
  const { api, elements } = uiSandbox({ store: { timings: [{ seconds: 20, at: "" }, { seconds: 10, at: "" }] } });
  api.renderValuationSummary();
  assert.match(elements.valoracionResumen.textContent, /Valoradas hace 35 días o menos: 1 de 2 \(50 %\)\. Pendientes: Fondo Dos\./);
  assert.match(elements.valoracionResumen.textContent, /Tiempo de la hoja: mediana 15 s en 2 valoraciones\./);
  assert.equal(elements.valoracionAbrir.disabled, false);
});

// ---- Cableado ----
test("cableado: app.js pinta la frescura de cada posición y el resumen; el almacén va en la copia y la nube", () => {
  const app = read("app.js");
  assert.match(app, /"portfolio-valuations", \/\/ WP-15/);
  assert.match(app, /const age = globalThis\.FinanceCanonicalPortfolioValuation\?\.freshness\(position, isoLocalDate\(new Date\(\)\)\);/);
  assert.match(app, /valor \$\{money\(position\.currentValue, true\)\}\$\{age \? ` \(\$\{escapeHtml\(age\.label\)\}\)` : ""\}/);
  assert.match(app, /function renderIv1PositionList\(\) \{\n\s+const list = qs\("iv1PositionList"\);\n\s+if \(!list\) return;\n\s+globalThis\.renderValuationSummary\?\.\(\);/);
  const lines = app.split("\n").length;
  assert.ok(lines <= 37495, `app.js tiene ${lines} líneas (techo 37.495)`);
});

test("cableado: el cierre avisa, sin bloquear, de la cartera sin valorar", () => {
  const cierre = read("views/cierre.js");
  assert.match(cierre, /window\.FinanceCanonicalPortfolioValuation\.closeNote\(valuationPositions\(\), isoLocalDate\(new Date\(\)\)\)/);
  assert.match(cierre, /valuationNote\.hidden = !note;/);
  assert.match(read("index.html"), /id="cierreValoracionAviso"[^>]*hidden/);
});

test("cableado: index.html tiene la tarjeta, el diálogo y sus scripts antes de app.js; las listas de ficheros los incluyen", () => {
  const index = read("index.html");
  ["valoracionCard", "valoracionResumen", "valoracionAbrir", "valoracionDialog", "valoracionForm", "valoracionFechas", "valoracionFecha", "valoracionFilas", "valoracionError", "valoracionCancelar", "valoracionGuardar", "cierreValoracionAviso"].forEach((id) => {
    assert.equal((index.match(new RegExp(`id="${id}"`, "g")) || []).length, 1, `#${id}`);
  });
  const form = index.slice(index.indexOf('id="valoracionForm"'), index.indexOf("</form>", index.indexOf('id="valoracionForm"')));
  assert.equal((form.match(/type="submit"/g) || []).length, 1, "Guardar es el único botón de envío: «Hecho» del teclado guarda");
  assert.match(form, /id="valoracionCancelar"/);
  const at = (name) => index.indexOf(`src="${name}`);
  assert.ok(at("canonical-portfolio-valuation.js") > 0 && at("canonical-portfolio-valuation.js") < at("valoracion-ui.js"));
  assert.ok(at("valoracion-ui.js") < at("app.js"));
  ["canonical-portfolio-valuation.js", "valoracion-ui.js"].forEach((name) => {
    assert.match(read("service-worker.js"), new RegExp(`"\\./${name.replace(".", "\\.")}",`));
    assert.match(read("tools/build-public-site.mjs"), new RegExp(`"${name.replace(".", "\\.")}",`));
  });
});

test("valoracion-ui.js no usa `qs` al cargarse (se ejecuta antes que app.js) y los chips escapan lo que pintan", () => {
  const source = read("valoracion-ui.js");
  const topLevel = source.split("\n").filter((line) => /^(valuationListen\(|qs\()/.test(line));
  assert.ok(topLevel.length >= 5 && topLevel.every((line) => line.startsWith("valuationListen")), "los listeners se ponen con document.getElementById");
  assert.match(source, /function valuationChip\(label, attribute, value, pressed\) \{\n\s+return `.*\$\{escapeHtml\(value\)\}.*\$\{escapeHtml\(label\)\}/);
});

test("el módulo de valoración no se carga con las instantáneas de cierre de I2: son cosas distintas", () => {
  const app = read("app.js");
  assert.match(app, /function recordIv1ValuationSnapshot\(monthKey, closedAt\)/, "I2 sigue como estaba");
  assert.ok(!/portfolio-valuations/.test(app.slice(app.indexOf("function recordIv1ValuationSnapshot("), app.indexOf("function recordIv1ValuationSnapshot(") + 600)));
});
