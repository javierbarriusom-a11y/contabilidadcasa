const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// WP-30 · PR-1: ciclos de las tarjetas de crédito. Con tarjeta, el dinero sale el día del CARGO y las compras sueltas no están en el
// extracto: solo su liquidación. Cada tarjeta tiene su ciclo (corte, meses hasta el cargo, día de cargo) y la fila donde se liquida.
// Una compra va a esa fila en el mes del cargo; mientras no llega el cargo, la fila vale max(previsto, acumulado); al llegar, manda
// el cargo. Sin compras, la previsión es idéntica a la de antes. Los ciclos de estas pruebas son inventados: los reales los
// introduce el hogar en la app y no van al repositorio.

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const engine = require("../canonical-card-cycles.js");
const monthClose = require("../canonical-month-close-balances.js");
const app = read("app.js");
const plain = (value) => JSON.parse(JSON.stringify(value));

// Tres formas de ciclo, todas inventadas.
const A = { cutDay: 10, chargeMonthOffset: 1, chargeDay: 5 }; // corte el 10, cargo el 5 del mes siguiente
const B = { cutDay: "fin", chargeMonthOffset: 2, chargeDay: 3 }; // corte a fin de mes, cargo el 3 dos meses después
const C = { cutDay: 15, chargeMonthOffset: 0, chargeDay: "fin" }; // corte el 15, cargo a fin del mismo mes

const ROW = "expense|fila-tarjeta-1";
const card = (id, shape, extra = {}) => ({ id, label: `Tarjeta ${id}`, rowKey: ROW, trackedFrom: "", ...shape, ...extra });
const buy = (date, amount, cardId = "t1", extra = {}) => ({ date, valueDate: date, month: date.slice(0, 7), movement: "Compra", amount: -Math.abs(amount), source: "captura-hoja", card: cardId, ...extra });

test("fecha de cargo: una compra hasta el día de corte (incluido) cierra en su mes; una posterior, en el siguiente", () => {
  assert.deepEqual(plain(engine.cycleFor("2026-10-08", A)), { cycleStart: "2026-09-11", cycleEnd: "2026-10-10", chargeMonth: "2026-11", chargeDate: "2026-11-05" });
  assert.equal(engine.cycleFor("2026-10-10", A).chargeDate, "2026-11-05", "el propio día de corte entra en el ciclo que cierra");
  assert.deepEqual(plain(engine.cycleFor("2026-10-11", A)), { cycleStart: "2026-10-11", cycleEnd: "2026-11-10", chargeMonth: "2026-12", chargeDate: "2026-12-05" });
  assert.equal(engine.cycleFor("2026-10-01", A).cycleStart, "2026-09-11");
});

test("fecha de cargo: corte a fin de mes con cargo dos meses después, y los cambios de año", () => {
  assert.deepEqual(plain(engine.cycleFor("2026-10-15", B)), { cycleStart: "2026-10-01", cycleEnd: "2026-10-31", chargeMonth: "2026-12", chargeDate: "2026-12-03" });
  assert.equal(engine.cycleFor("2026-10-31", B).chargeDate, "2026-12-03", "el último día natural aún es del ciclo de octubre");
  assert.equal(engine.cycleFor("2026-11-01", B).chargeDate, "2027-01-03", "el 1 de noviembre ya es del ciclo siguiente");
  assert.equal(engine.cycleFor("2026-12-31", B).chargeDate, "2027-02-03", "cambio de año");
  assert.equal(engine.cycleFor("2026-12-28", A).chargeDate, "2027-02-05", "corte el 10: una compra de finales de diciembre cierra en enero y se carga en febrero");
  assert.equal(engine.cycleFor("2028-02-29", B).cycleEnd, "2028-02-29", "año bisiesto: el fin de febrero es el 29");
  assert.equal(engine.cycleFor("2028-02-29", B).chargeDate, "2028-04-03");
});

test("fecha de cargo: cargo a fin del mismo mes y el día de cargo nunca se sale de un mes corto", () => {
  assert.deepEqual(plain(engine.cycleFor("2026-10-15", C)), { cycleStart: "2026-09-16", cycleEnd: "2026-10-15", chargeMonth: "2026-10", chargeDate: "2026-10-31" });
  assert.equal(engine.cycleFor("2026-10-16", C).chargeDate, "2026-11-30", "«último día» en un mes de 30 días");
  assert.equal(engine.cycleFor("2027-02-10", C).chargeDate, "2027-02-28", "y en febrero");
  assert.equal(engine.cycleFor("2026-11-10", { cutDay: 28, chargeMonthOffset: 3, chargeDay: 28 }).chargeDate, "2027-02-28", "día 28 existe en todos los meses");
  assert.equal(engine.cycleFor("no-es-fecha", A), null);
  assert.equal(engine.cycleFor("2026-02-30", A), null);
});

test("tarjetas: una copia o una nube corrupta no puede colar una tarjeta inválida, repetida o de más", () => {
  const good = card("t1", A);
  const store = engine.normalizeStore({
    cards: [good, card("t1", B), { ...good, id: "mala id!" }, { ...good, id: "t2", label: "" }, { ...good, id: "t3", rowKey: "income|x" }, { ...good, id: "t4", cutDay: 31 },
      { ...good, id: "t5", chargeMonthOffset: 9 }, { ...good, id: "t6", chargeDay: "0" }, null, "texto", { ...good, id: "t7", trackedFrom: "no-fecha" }],
  });
  assert.deepEqual(store.cards.map((item) => item.id), ["t1", "t7"], "la repetida y las inválidas se descartan; una fecha «anoto desde» rota solo se limpia");
  assert.equal(store.cards[1].trackedFrom, "");
  assert.deepEqual(plain(engine.normalizeStore(null)), { cards: [] });
  assert.deepEqual(plain(engine.normalizeStore({ cards: "x" })), { cards: [] });
  const many = engine.normalizeStore({ cards: Array.from({ length: 20 }, (_, index) => card(`t${index}`, A)) });
  assert.equal(many.cards.length, engine.MAX_CARDS);
});

test("alta, cambio y baja de una tarjeta, con sus errores en el idioma del hogar", () => {
  const empty = { cards: [] };
  const bad = engine.upsertCard(empty, { label: " ", rowKey: "", cutDay: 40, chargeMonthOffset: 7, chargeDay: "x", trackedFrom: "ayer" });
  assert.deepEqual(Object.keys(bad.errors).sort(), ["chargeDay", "chargeMonthOffset", "cutDay", "label", "rowKey", "trackedFrom"]);
  assert.equal(bad.card, null);
  assert.deepEqual(plain(bad.store), { cards: [] });
  const added = engine.upsertCard(empty, { label: "  Mi tarjeta  ", rowKey: ROW, cutDay: "15", chargeMonthOffset: "1", chargeDay: "fin", trackedFrom: "2026-10-12" });
  assert.deepEqual(plain(added.errors), {});
  assert.deepEqual(plain(added.card), { id: "tarjeta-1", label: "Mi tarjeta", rowKey: ROW, cutDay: 15, chargeMonthOffset: 1, chargeDay: "fin", trackedFrom: "2026-10-12" });
  const second = engine.upsertCard(added.store, { label: "Otra", rowKey: ROW, cutDay: "fin", chargeMonthOffset: 2, chargeDay: 1 });
  assert.equal(second.card.id, "tarjeta-2");
  assert.equal(second.card.cutDay, "fin");
  const edited = engine.upsertCard(second.store, { id: "tarjeta-1", label: "Renombrada", rowKey: ROW, cutDay: 20, chargeMonthOffset: 1, chargeDay: 1 });
  assert.deepEqual(edited.store.cards.map((item) => item.label), ["Renombrada", "Otra"], "cambiar una tarjeta no la duplica");
  assert.deepEqual(engine.removeCard(edited.store, "tarjeta-1").cards.map((item) => item.id), ["tarjeta-2"]);
  assert.deepEqual(plain(engine.removeCard(edited.store, "no-existe").cards.map((item) => item.id)), ["tarjeta-1", "tarjeta-2"]);
  assert.match(engine.upsertCard(empty, { label: "x", rowKey: "expense|otra", cutDay: 1, chargeMonthOffset: 0, chargeDay: 1 }, { rowKeys: [ROW] }).errors.rowKey, /ya no está en el plan/);
});

test("compras acumuladas: solo las de la hoja, solo de tarjetas configuradas, en la fila y el mes de su cargo", () => {
  const store = { cards: [card("t1", A), card("t2", B, { rowKey: "expense|fila-tarjeta-2" })] };
  const transactions = [
    buy("2026-10-08", 40.5), // t1 → cargo 5/11
    buy("2026-10-09", 10.25), // t1 → cargo 5/11
    buy("2026-10-12", 100), // t1 → cargo 5/12
    buy("2026-10-15", 33, "t2"), // t2 → cargo 3/12 en su fila
    buy("2026-10-08", 999, "desconocida"), // sin tarjeta configurada
    buy("2026-10-08", 5, "t1", { source: "manual-quick-capture" }), // no es de la hoja
    { date: "2026-10-08", amount: -77, movement: "Cargo del banco", source: "extracto", card: "t1" }, // movimiento del banco
    buy("fecha-rota", 1),
    { ...buy("2026-10-08", 1), amount: "x" },
  ];
  const map = engine.accruedByRowMonth(store, transactions);
  assert.equal(map.get(`${ROW}|2026-11`), 50.75, "las dos compras del ciclo, con redondeo a céntimos");
  assert.equal(map.get(`${ROW}|2026-12`), 100);
  assert.equal(map.get("expense|fila-tarjeta-2|2026-12"), 33);
  assert.equal(map.size, 3);
  assert.equal(engine.accruedByRowMonth({ cards: [] }, transactions).size, 0, "sin tarjetas no se acumula nada");
  assert.equal(engine.accruedByRowMonth(store, undefined).size, 0);
});

test("si cambia el ciclo de la tarjeta, las compras se reasignan solas a su nuevo mes de cargo", () => {
  const transactions = [buy("2026-10-12", 60)];
  assert.equal(engine.accruedByRowMonth({ cards: [card("t1", A)] }, transactions).get(`${ROW}|2026-12`), 60);
  assert.equal(engine.accruedByRowMonth({ cards: [card("t1", { ...A, cutDay: 20 })] }, transactions).get(`${ROW}|2026-11`), 60, "con corte el 20, la del 12 entra en el ciclo que cierra en octubre");
});

test("ciclos de una tarjeta: sin facturar, facturado, cargado, y lo que falta o sobra frente al cargo", () => {
  const store = { cards: [card("t1", A, { trackedFrom: "2026-09-01" })] };
  const transactions = [buy("2026-09-20", 100), buy("2026-10-02", 50), buy("2026-10-12", 30)];
  const reals = { "2026-11": 168 }; // el cargo del ciclo 11/09-10/10 fue de 168 y las compras sumaban 150
  const [view] = engine.cyclesView({ store, transactions, realFor: (rowKey, monthKey) => (rowKey === ROW && reals[monthKey] !== undefined ? reals[monthKey] : null), today: "2026-10-20" });
  const byCharge = Object.fromEntries(view.cycles.map((cycle) => [cycle.chargeMonth, cycle]));
  assert.equal(byCharge["2026-11"].status, "cargado");
  assert.equal(byCharge["2026-11"].total, 150);
  assert.equal(byCharge["2026-11"].count, 2);
  assert.equal(byCharge["2026-11"].diff, 18, "el cargo fue 18 € mayor que las compras: compras sin anotar, intereses o comisiones");
  assert.equal(byCharge["2026-11"].reconcile, "faltan-compras");
  assert.equal(byCharge["2026-12"].status, "sin-facturar", "el ciclo del 11/10 al 10/11 sigue abierto el 20/10");
  assert.equal(byCharge["2026-12"].total, 30);
  assert.equal(byCharge["2026-12"].reconcile, null, "sin cargo no hay nada que comparar");
  const closed = engine.cyclesView({ store, transactions, realFor: () => null, today: "2026-10-20" })[0].cycles.find((cycle) => cycle.chargeMonth === "2026-11");
  assert.equal(closed.status, "facturado", "pasó el corte y aún no llegó el cargo");
  const over = engine.cyclesView({ store, transactions, realFor: () => 140, today: "2026-10-20" })[0].cycles.find((cycle) => cycle.chargeMonth === "2026-11");
  assert.equal(over.diff, -10);
  assert.equal(over.reconcile, "compras-de-mas");
  const exact = engine.cyclesView({ store, transactions, realFor: () => 150.5, today: "2026-10-20" })[0].cycles.find((cycle) => cycle.chargeMonth === "2026-11");
  assert.equal(exact.reconcile, "cuadra", "dentro de la tolerancia de 1 €");
});

test("un ciclo que empezó antes de la primera compra anotada es incompleto y no se compara", () => {
  const store = { cards: [card("t1", A)] };
  const transactions = [buy("2026-10-11", 60)]; // primera compra anotada: el primer día del ciclo 11/10-10/11
  const reals = { "2026-11": 500, "2026-12": 55 };
  const [view] = engine.cyclesView({ store, transactions, realFor: (rowKey, monthKey) => reals[monthKey] ?? null, today: "2026-12-20" });
  const byCharge = Object.fromEntries(view.cycles.map((cycle) => [cycle.chargeMonth, cycle]));
  assert.equal(byCharge["2026-12"].incomplete, false, "la primera compra es del primer día del ciclo: la hoja lo vio entero");
  assert.equal(byCharge["2026-12"].diff, -5);
  const late = engine.cyclesView({ store, transactions: [buy("2026-10-12", 60)], realFor: (rowKey, monthKey) => reals[monthKey] ?? null, today: "2026-12-20" })[0].cycles.find((cycle) => cycle.chargeMonth === "2026-12");
  assert.equal(late.incomplete, true, "si la primera compra es de un día después de empezar el ciclo, ese día no lo vio la hoja");
  assert.equal(late.reconcile, null);
  const withTracked = engine.cyclesView({ store: { cards: [card("t1", A, { trackedFrom: "2026-09-01" })] }, transactions: [], realFor: () => 200, today: "2026-10-05" })[0].cycles;
  assert.equal(withTracked.find((cycle) => cycle.chargeMonth === "2026-11").incomplete, false, "«anoto desde» antes del ciclo lo da por completo aunque aún no haya compras");
  const never = engine.cyclesView({ store, transactions: [], realFor: () => 200, today: "2026-10-05" })[0].cycles.find((cycle) => cycle.chargeMonth === "2026-11");
  assert.equal(never.incomplete, true, "sin compras ni fecha de inicio, nada es comparable");
  assert.equal(never.diff, null);
});

test("siempre se enseña el ciclo actual aunque no tenga compras, y como mucho los 6 más recientes", () => {
  const store = { cards: [card("t1", A)] };
  const [empty] = engine.cyclesView({ store, transactions: [], today: "2026-10-20" });
  assert.deepEqual(empty.cycles.map((cycle) => [cycle.chargeMonth, cycle.count, cycle.status]), [["2026-12", 0, "sin-facturar"]]);
  const many = Array.from({ length: 10 }, (_, index) => buy(`2026-${String(index + 1).padStart(2, "0")}-05`, 10));
  const [crowded] = engine.cyclesView({ store, transactions: many, today: "2026-10-20" });
  assert.equal(crowded.cycles.length, 6);
  assert.deepEqual(crowded.cycles.map((cycle) => cycle.chargeMonth), [...crowded.cycles.map((cycle) => cycle.chargeMonth)].sort().reverse(), "de más reciente a más antiguo");
});

test("la ficha: ejemplo del ciclo, aviso si la fila ya no existe, importes y textos sin HTML ajeno", () => {
  const store = { cards: [card("t1", B, { label: "<b>Mi</b> tarjeta & Cía" })] };
  const views = engine.cyclesView({ store, transactions: [buy("2026-10-15", 12.5)], today: "2026-10-20" });
  const html = engine.renderHtml({ store, views, rows: [{ key: ROW, label: "Tarjeta X", section: "Financiaciones" }], today: "2026-10-20" }, { money: (value) => `${value} €` });
  assert.doesNotMatch(html, /<b>Mi<\/b>/, "el nombre se escapa");
  assert.match(html, /&lt;b&gt;Mi&lt;\/b&gt; tarjeta &amp; Cía/);
  assert.match(html, /Ejemplo: una compra del 15\/10\/2026 entra en el ciclo del 01\/10\/2026 al 31\/10\/2026 y se carga el 03\/12\/2026\./);
  assert.match(html, /1 compra, 12.5 €/);
  assert.match(html, /<option value="expense\|fila-tarjeta-1" selected>Financiaciones · Tarjeta X<\/option>/);
  assert.doesNotMatch(html, /ya no está en el plan/);
  assert.doesNotMatch(html, /undefined|NaN/);
  const lost = engine.renderHtml({ store, views, rows: [], today: "2026-10-20" });
  assert.match(lost, /La fila de esta tarjeta ya no está en el plan/);
  assert.match(html, /data-tarjeta="nueva"/, "siempre hay un formulario para añadir otra");
  const full = engine.normalizeStore({ cards: Array.from({ length: 8 }, (_, index) => card(`t${index}`, A)) });
  assert.doesNotMatch(engine.renderHtml({ store: full, views: engine.cyclesView({ store: full, today: "2026-10-20" }), rows: [], today: "2026-10-20" }), /data-tarjeta="nueva"/, "con el máximo de tarjetas no se ofrece otra");
});

test("el cargo del extracto se explica en lenguaje del hogar: cuadra, faltan compras, de más, incompleto", () => {
  const store = { cards: [card("t1", A, { trackedFrom: "2026-09-01" })] };
  const line = (real) => {
    const views = engine.cyclesView({ store, transactions: [buy("2026-10-02", 100)], realFor: () => real, today: "2026-10-20" });
    return engine.renderHtml({ store, views, rows: [{ key: ROW, label: "T" }], today: "2026-10-20" }, { money: (value) => `${value} €` });
  };
  assert.match(line(100), /Cuadra con tus compras\./);
  assert.match(line(130), /Tus compras suman 100 € y el cargo fue 130 €: faltan 30 € \(compras sin anotar, intereses o comisiones\)\./);
  assert.match(line(80), /anotaste 20 € de más\./);
  assert.match(line(null), /facturado, esperando el cargo/);
});

// ---- Integración con app.js (valor de la partida, suma de reales, almacén, cierre) ----
function sliceBetween(source, start, end) {
  const from = source.indexOf(start);
  assert.ok(from >= 0, start);
  const to = source.indexOf(end, from);
  assert.ok(to > from, end);
  return source.slice(from, to);
}

function valueSandbox({ transactions = [], store = { cards: [card("t1", A)] }, revision = 1, planned = 600, actuals = {}, override = null } = {}) {
  const sandbox = {
    globalThis: null,
    FinanceCanonicalCardCycles: engine,
    applicationRenderRevision: revision,
    baseData: { transactions },
    cachedLocalStore: () => store,
    seriesKeyForRow: (row) => `${row.kind}|${row.id}`,
    actualsForKind: () => actuals,
    actualKeyForRow: (row, month) => `${row.id}|${month.key}`,
    seriesOverrideForRow: () => override,
    plannedValueForRow: () => planned,
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(`${sliceBetween(app, "// WP-30 (canonical-card-cycles.js): compras con tarjeta aún sin su cargo", "function forwardPlanningInfo")}\nthis.api = { actualAwareInfo, cardAccruedForRow };`, sandbox);
  return { sandbox, api: sandbox.api };
}

const ROW_OBJ = { kind: "expense", id: "fila-tarjeta-1" };
const NOV = { key: "2026-11" };

test("valor de la partida SIN compras: idéntico al de antes, también con un previsto negativo o a cero", () => {
  [600, 0, -40, 12.34].forEach((planned) => {
    const { api } = valueSandbox({ planned });
    const info = api.actualAwareInfo(ROW_OBJ, NOV);
    assert.equal(info.value, planned, `previsto ${planned}`);
    assert.equal(info.hasActual, false);
    assert.equal(info.status, "pending");
    assert.equal(info.source, "Pendiente");
    assert.equal(info.accrued, 0);
  });
});

test("con compras y sin cargo: la fila vale lo mayor entre lo previsto y lo anotado, y el primer ticket NO la hunde", () => {
  const first = valueSandbox({ transactions: [buy("2026-10-08", 40)], planned: 600 }).api.actualAwareInfo(ROW_OBJ, NOV);
  assert.equal(first.value, 600, "un primer ticket de 40 € en una fila prevista en 600 € no deja el mes en 40 €");
  assert.equal(first.accrued, 40);
  assert.equal(first.hasActual, false, "sigue sin haber real: no se da por registrado");
  assert.equal(first.source, "Acumulado con tarjeta");
  const over = valueSandbox({ transactions: [buy("2026-10-08", 450), buy("2026-10-09", 300)], planned: 600 }).api.actualAwareInfo(ROW_OBJ, NOV);
  assert.equal(over.value, 750, "pasarse de lo previsto sube la fila");
  const none = valueSandbox({ transactions: [buy("2026-10-08", 40)], planned: 0 }).api.actualAwareInfo(ROW_OBJ, NOV);
  assert.equal(none.value, 40, "sin previsto, lo anotado");
});

test("al llegar el cargo del extracto (o un real tecleado), manda el cargo: las compras provisionales dejan de sumar", () => {
  const { api } = valueSandbox({ transactions: [buy("2026-10-08", 450)], planned: 600, actuals: { "fila-tarjeta-1|2026-11": 520 } });
  const info = api.actualAwareInfo(ROW_OBJ, NOV);
  assert.equal(info.value, 520);
  assert.equal(info.hasActual, true);
  assert.equal(info.status, "realized");
  assert.equal(info.accrued, 0, "con real no se acumula");
  const zero = valueSandbox({ transactions: [buy("2026-10-08", 450)], planned: 600, actuals: { "fila-tarjeta-1|2026-11": 0 } }).api.actualAwareInfo(ROW_OBJ, NOV);
  assert.equal(zero.value, 0, "un real cero también manda");
  const typed = valueSandbox({ transactions: [buy("2026-10-08", 450)], planned: 600, override: { actual: 480 } }).api.actualAwareInfo(ROW_OBJ, NOV);
  assert.equal(typed.value, 480, "un real de la serie también");
});

test("lo cancelado o eliminado no se acumula; los ingresos y otros meses ni se enteran", () => {
  const purchases = [buy("2026-10-08", 450)];
  assert.equal(valueSandbox({ transactions: purchases, override: { actualStatus: "cancelled" } }).api.actualAwareInfo(ROW_OBJ, NOV).value, 0);
  assert.equal(valueSandbox({ transactions: purchases, override: { deleted: true } }).api.actualAwareInfo(ROW_OBJ, NOV).value, 0);
  const { api } = valueSandbox({ transactions: purchases, planned: 600 });
  assert.equal(api.actualAwareInfo({ kind: "income", id: "fila-tarjeta-1" }, NOV).accrued, 0, "un ingreso con el mismo id no acumula");
  assert.equal(api.actualAwareInfo(ROW_OBJ, { key: "2026-12" }).accrued, 0, "otro mes de cargo");
  assert.equal(api.actualAwareInfo({ kind: "expense", id: "otra-fila" }, NOV).accrued, 0, "otra fila");
});

test("la acumulación se recalcula una vez por render: dentro de un render es estable y cada render la rehace", () => {
  const transactions = [buy("2026-10-08", 40)];
  const { sandbox, api } = valueSandbox({ transactions });
  assert.equal(api.cardAccruedForRow(ROW_OBJ, NOV), 40);
  transactions.push(buy("2026-10-09", 10));
  assert.equal(api.cardAccruedForRow(ROW_OBJ, NOV), 40, "mismo render: no se vuelve a recorrer el libro por cada llamada");
  sandbox.applicationRenderRevision += 1;
  assert.equal(api.cardAccruedForRow(ROW_OBJ, NOV), 50, "el render siguiente ya la ve");
  const none = valueSandbox({ transactions, store: { cards: [] } });
  assert.equal(none.api.cardAccruedForRow(ROW_OBJ, NOV), 0, "sin tarjetas configuradas, siempre 0");
});

test("sin el motor cargado (copia antigua, fallo de carga) la partida se comporta como siempre", () => {
  const { sandbox, api } = valueSandbox({ transactions: [buy("2026-10-08", 450)], planned: 600 });
  sandbox.FinanceCanonicalCardCycles = undefined;
  sandbox.applicationRenderRevision += 1;
  assert.equal(api.actualAwareInfo(ROW_OBJ, NOV).value, 600);
});

test("los movimientos de la hoja no se suman como real por reglas de asignación (cuentan por su ciclo)", () => {
  const body = sliceBetween(app, "function applyMovementMappingsToActuals() {", "function transactionIdentity(");
  const expenseActuals = {};
  const incomeActuals = {};
  const row = { id: "fila-tarjeta-1", kind: "expense" };
  const sandbox = {
    baseData: { transactions: [{ ...buy("2026-10-08", 40), month: "2026-11" }, { date: "2026-11-01", month: "2026-11", amount: -520, movement: "CARGO TARJETA", source: "extracto" }], monthlyPlanning: { months: [{ key: "2026-11" }] } },
    mappingForMovement: () => ({ kind: "expense", row }),
    monthByKey: (key, months) => months.find((month) => month.key === key) || null,
    isClosedMonthKey: () => false,
    actualKeyForRow: (item, month) => `${item.id}|${month.key}`,
    round2: (value) => Math.round(value * 100) / 100,
    expenseActuals,
    incomeActuals,
  };
  vm.createContext(sandbox);
  vm.runInContext(`${body}\nthis.applied = applyMovementMappingsToActuals();`, sandbox);
  assert.deepEqual(plain(expenseActuals), { "fila-tarjeta-1|2026-11": 520 }, "solo el cargo del banco: la compra provisional no suma");
  assert.equal(sandbox.applied, 1);
});

test("la hoja no es del banco: no entra en el cuadre del cierre", () => {
  const previous = { date: "2026-09-30", accounts: { caixabank: 1000 }, mode: "manual" };
  const current = { date: "2026-10-31", accounts: { caixabank: 900 }, mode: "manual" };
  const transactions = [
    { date: "2026-10-05", amount: -100, accountId: "caixabank", source: "extracto" },
    { date: "2026-10-06", amount: -250, accountId: "caixabank", source: "captura-hoja" },
  ];
  const [row] = monthClose.continuity({ previous, current, transactions });
  assert.equal(row.status, "cuadra", "la compra con tarjeta aún no ha salido de la cuenta");
  assert.equal(row.movements, -100);
});

// ---- Cableado ----
test("cableado: el almacén viaja con la copia y la nube; la ficha se pinta con las de Partidas; el motor carga antes que su pantalla", () => {
  const html = read("index.html");
  const stores = sliceBetween(app, "const BACKUP_LOCAL_STORES = [", "];");
  assert.match(stores, /"card-cycles", \/\/ WP-30/);
  assert.match(app, /renderPersonalAllowances\(\);\n\s+renderCardCycles\(\); \/\/ WP-30 \(partidas-ui\.js\)/);
  assert.match(html, /<details class="e19-card prevision-calidad-card asignacion-card" id="tarjetasCard">\s*<summary id="tarjetasResumen">/);
  assert.match(html, /<div id="tarjetasCiclo"><\/div>/);
  const at = (file) => html.indexOf(`<script defer src="${file}?v=`);
  assert.ok(at("canonical-card-cycles.js") > 0 && at("canonical-card-cycles.js") < at("partidas-ui.js") && at("partidas-ui.js") < at("app.js"));
  assert.ok(html.indexOf('id="tarjetasCard"') > html.indexOf('id="cargoDiaCard"'), "justo después de Días de cargo");
  assert.match(read("service-worker.js"), /"\.\/canonical-card-cycles\.js",/);
  assert.match(read("tools/build-public-site.mjs"), /"canonical-card-cycles\.js",/);
});

// ---- La ficha (partidas-ui.js) en un vm ----
function uiSandbox({ stored = { cards: [] }, rows = [{ key: ROW, label: "Tarjeta X", section: "Financiaciones" }, { key: "expense|gas", label: "Gas", section: "Gastos fijos" }], transactions = [], today = "2026-10-20" } = {}) {
  const elements = { tarjetasCiclo: { innerHTML: "" }, tarjetasResumen: { textContent: "" } };
  const storage = {};
  const calls = { render: 0, undo: [] };
  const state = { store: stored };
  const sandbox = {
    window: { FinanceCanonicalCardCycles: engine },
    document: { getElementById: () => null },
    qs: (id) => elements[id] || null,
    loadCardCycles: () => state.store,
    chargeDayRows: () => rows,
    normalizedText: (value) => String(value || "").toLowerCase(),
    isoLocalDate: () => today,
    baseData: { transactions },
    expenseActuals: {},
    money: (value) => `${value} €`,
    storageKey: (name) => `${name}:demo`,
    storageSet: (key, value) => { storage[key] = value; state.store = JSON.parse(value); },
    render: () => { calls.render += 1; },
    showUndoToast: (message, undo) => calls.undo.push({ message, undo }),
  };
  vm.createContext(sandbox);
  vm.runInContext(`${sliceBetweenUi("let cardCyclesPending", '["submit", "click"].forEach((type) => document.getElementById("tarjetasCiclo")')}\nthis.api = { renderCardCycles, handleCardCycleEvent, cardCycleRows, cardCyclesReal };`, sandbox);
  return { sandbox, api: sandbox.api, elements, storage, calls, state };
}

function sliceBetweenUi(start, end) {
  return sliceBetween(read("partidas-ui.js"), start, end);
}

function fakeForm(dataset, values) {
  const errorBox = { textContent: "" };
  const fields = Object.fromEntries(Object.entries(values).map(([name, value]) => [name, { value, attrs: {}, focused: false, setAttribute(key, val) { this.attrs[key] = val; }, removeAttribute(key) { delete this.attrs[key]; }, focus() { this.focused = true; } }]));
  return { dataset, elements: { namedItem: (name) => fields[name] }, querySelector: () => errorBox, fields, errorBox };
}

test("ficha: solo se ofrecen filas de Financiaciones, y el real de una fila se lee de los reales guardados", () => {
  const { api, sandbox } = uiSandbox();
  assert.deepEqual(plain(api.cardCycleRows()), [{ key: ROW, label: "Tarjeta X", section: "Financiaciones" }]);
  sandbox.expenseActuals["fila-tarjeta-1|2026-11"] = 123.45;
  assert.equal(api.cardCyclesReal(ROW, "2026-11"), 123.45);
  assert.equal(api.cardCyclesReal(ROW, "2026-12"), null);
  sandbox.expenseActuals["fila-tarjeta-1|2026-12"] = "";
  assert.equal(api.cardCyclesReal(ROW, "2026-12"), null, "vacío es «sin real», no cero");
  sandbox.expenseActuals["fila-tarjeta-1|2027-01"] = 0;
  assert.equal(api.cardCyclesReal(ROW, "2027-01"), 0, "cero es un real");
});

test("ficha: se pinta con su resumen y no se repinta si no cambia (no se lleva lo que se escribe)", () => {
  const { api, elements } = uiSandbox({ stored: { cards: [card("t1", A, { label: "Mi tarjeta" })] } });
  api.renderCardCycles();
  assert.match(elements.tarjetasCiclo.innerHTML, /Mi tarjeta/);
  assert.equal(elements.tarjetasResumen.textContent, "Tarjetas de crédito: Mi tarjeta");
  elements.tarjetasCiclo.innerHTML = "lo que el usuario está escribiendo";
  api.renderCardCycles();
  assert.equal(elements.tarjetasCiclo.innerHTML, "lo que el usuario está escribiendo", "mismo contenido: no se toca el DOM");
});

test("ficha: añadir una tarjeta guarda, recalcula la previsión y dice qué ha guardado; un error no guarda y enfoca el campo", () => {
  const { api, storage, calls, state } = uiSandbox();
  const bad = fakeForm({ tarjeta: "nueva" }, { label: "", rowKey: ROW, cutDay: "20", chargeMonthOffset: "1", chargeDay: "1", trackedFrom: "" });
  api.handleCardCycleEvent({ type: "submit", target: { closest: () => bad }, preventDefault() {} });
  assert.match(bad.errorBox.textContent, /Pon un nombre/);
  assert.equal(bad.fields.label.attrs["aria-invalid"], "true");
  assert.equal(bad.fields.label.focused, true);
  assert.equal(bad.fields.rowKey.attrs["aria-invalid"], undefined);
  assert.deepEqual(Object.keys(storage), [], "con errores no se guarda");
  const good = fakeForm({ tarjeta: "nueva" }, { label: "Mi tarjeta", rowKey: ROW, cutDay: "20", chargeMonthOffset: "1", chargeDay: "1", trackedFrom: "" });
  let prevented = false;
  api.handleCardCycleEvent({ type: "submit", target: { closest: () => good }, preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.deepEqual(state.store.cards.map((item) => [item.label, item.cutDay, item.chargeMonthOffset, item.chargeDay]), [["Mi tarjeta", 20, 1, 1]]);
  assert.ok(storage["card-cycles:demo"]);
  assert.equal(calls.render, 1, "guardar recalcula la previsión");
  assert.equal(good.errorBox.textContent, "");
});

test("ficha: una fila que ya no existe en Financiaciones no se acepta", () => {
  const { api, storage } = uiSandbox();
  const form = fakeForm({ tarjeta: "nueva" }, { label: "X", rowKey: "expense|gas", cutDay: "20", chargeMonthOffset: "1", chargeDay: "1", trackedFrom: "" });
  api.handleCardCycleEvent({ type: "submit", target: { closest: () => form }, preventDefault() {} });
  assert.match(form.errorBox.textContent, /ya no está en el plan/, "«Gas» es de Gastos fijos, no de Financiaciones");
  assert.deepEqual(Object.keys(storage), []);
});

test("ficha: quitar una tarjeta se puede deshacer", () => {
  const { api, calls, state } = uiSandbox({ stored: { cards: [card("t1", A, { label: "Mi tarjeta" })] } });
  api.handleCardCycleEvent({ type: "click", target: { closest: (selector) => (selector === "[data-tarjeta-quitar]" ? { dataset: { tarjetaQuitar: "t1" } } : null) } });
  assert.deepEqual(state.store.cards, []);
  assert.equal(calls.undo.length, 1);
  assert.match(calls.undo[0].message, /Mi tarjeta quitada/);
  calls.undo[0].undo();
  assert.deepEqual(state.store.cards.map((item) => item.id), ["t1"], "deshacer devuelve la tarjeta");
});
