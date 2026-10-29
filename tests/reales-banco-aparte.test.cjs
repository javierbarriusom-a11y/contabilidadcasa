const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const { codigoApp } = require("./helpers/codigo-app.cjs");

// Decisión del hogar del 29/10/2026, «Sumar banco + lo anotado aparte»: el real de una partida con movimientos del
// extracto es lo del banco más lo anotado aparte. Antes, clasificar o importar pisaba el real con la suma del banco y lo
// pagado en efectivo se perdía sin avisar.
const app = codigoApp();
const body = app.slice(app.indexOf("function bankActualTotals() {"), app.indexOf("function transactionIdentity("));

function sandbox({ expense = {}, store = {}, transactions = [], closed = [] } = {}) {
  const rows = { super: { id: "super", kind: "expense" }, gasolina: { id: "gasolina", kind: "expense" } };
  const context = {
    baseData: { transactions, monthlyPlanning: { months: [{ key: "2026-09" }, { key: "2026-10" }] } },
    mappingForMovement: (tx) => (rows[tx.partida] ? { kind: "expense", row: rows[tx.partida] } : null),
    monthByKey: (key, months) => months.find((month) => month.key === key) || null,
    isClosedMonthKey: (key) => closed.includes(key),
    actualKeyForRow: (row, month) => `${row.id}|${month.key}`,
    round2: (value) => Math.round(value * 100) / 100,
    incomeActuals: {},
    expenseActuals: expense,
    storageKey: (name) => name,
    storageGet: (key, fallback) => (key in store ? store[key] : fallback),
    storageSet: (key, value) => { store[key] = value; },
  };
  context.actualsForKind = (kind) => (kind === "income" ? context.incomeActuals : context.expenseActuals);
  vm.createContext(context);
  vm.runInContext(body, context);
  return { context, store, setTransactions: (list) => { context.baseData.transactions = list; } };
}
const mov = (partida, amount, month = "2026-10") => ({ partida, amount: -amount, month, date: `${month}-05` });
const plain = (value) => JSON.parse(JSON.stringify(value));
const aplicado = (store) => JSON.parse(store["bank-actuals-applied"]).expense;

test("un real tecleado antes de que llegue el banco: lo que pasa de la suma del banco se queda aparte", () => {
  const { context, store } = sandbox({ expense: { "super|2026-10": 120 }, transactions: [mov("super", 80)] });
  context.applyMovementMappingsToActuals();
  assert.equal(context.expenseActuals["super|2026-10"], 120, "80 del banco + 40 en efectivo");
  assert.equal(context.bankActualAparte("expense", "super|2026-10"), 40);
  assert.deepEqual(aplicado(store), { "super|2026-10": 80 });
});

test("con un real menor que el banco, manda el banco (el tecleado era un parcial)", () => {
  const { context } = sandbox({ expense: { "super|2026-10": 50 }, transactions: [mov("super", 80)] });
  context.applyMovementMappingsToActuals();
  assert.equal(context.expenseActuals["super|2026-10"], 80);
  assert.equal(context.bankActualAparte("expense", "super|2026-10"), 0);
});

test("lo anotado aparte después de importar se conserva cuando llegan más movimientos del banco", () => {
  const { context, setTransactions } = sandbox({ transactions: [mov("super", 80)] });
  context.applyMovementMappingsToActuals();
  assert.equal(context.expenseActuals["super|2026-10"], 80);
  context.expenseActuals["super|2026-10"] = 95; // el hogar suma 15 € pagados en efectivo, desde Registrar
  setTransactions([mov("super", 80), mov("super", 30)]);
  context.applyMovementMappingsToActuals();
  assert.equal(context.expenseActuals["super|2026-10"], 125, "110 del banco + 15 aparte");
  assert.equal(context.bankActualAparte("expense", "super|2026-10"), 15);
});

test("al reclasificar un movimiento a otra partida, cada una se queda con su banco y lo aparte no se inventa", () => {
  const { context, setTransactions } = sandbox({ transactions: [mov("super", 80), mov("super", 20)] });
  context.applyMovementMappingsToActuals();
  assert.equal(context.expenseActuals["super|2026-10"], 100);
  setTransactions([mov("super", 80), mov("gasolina", 20)]);
  context.applyMovementMappingsToActuals();
  assert.deepEqual(plain(context.expenseActuals), { "super|2026-10": 80, "gasolina|2026-10": 20 });
});

test("una partida que se queda sin movimientos conserva solo lo anotado aparte, o se queda sin real", () => {
  const { context, setTransactions } = sandbox({ transactions: [mov("super", 80), mov("gasolina", 40)] });
  context.applyMovementMappingsToActuals();
  context.expenseActuals["super|2026-10"] = 90; // 10 € aparte
  setTransactions([]);
  context.applyMovementMappingsToActuals();
  assert.deepEqual(plain(context.expenseActuals), { "super|2026-10": 10 }, "gasolina, sin banco ni nada aparte, queda sin real");
});

test("un mes cerrado no se toca, y un real sin banco (efectivo) tampoco", () => {
  const { context } = sandbox({ expense: { "super|2026-09": 300, "gasolina|2026-10": 60 }, transactions: [mov("super", 80, "2026-09")], closed: ["2026-09"] });
  context.applyMovementMappingsToActuals();
  assert.deepEqual(plain(context.expenseActuals), { "super|2026-09": 300, "gasolina|2026-10": 60 });
});

test("al abrir la app por primera vez, el punto de partida es el banco de hoy y ningún real cambia", () => {
  const { context, store, setTransactions } = sandbox({ expense: { "super|2026-10": 70 }, transactions: [mov("super", 80)] });
  context.ensureBankActualsBaseline();
  assert.equal(store["bank-actuals-applied"], undefined, "abrir la app no escribe nada");
  assert.deepEqual(plain(context.loadBankActualsApplied().expense), { "super|2026-10": 80 });
  assert.equal(context.expenseActuals["super|2026-10"], 70, "no toca el real al abrir");
  // Lo que el hogar dejó por debajo del banco a mano se respeta como ajuste cuando el banco cambia.
  setTransactions([mov("super", 80), mov("super", 20)]);
  context.applyMovementMappingsToActuals();
  assert.equal(context.expenseActuals["super|2026-10"], 90, "100 del banco − 10 que el hogar quitó");
  assert.deepEqual(aplicado(store), { "super|2026-10": 100 }, "al aplicar el banco, se guarda");
});

test("el libro compara el banco con su parte del real: lo anotado aparte no es una diferencia", () => {
  const ledgerBody = app.slice(app.indexOf("function canonicalLedgerActuals() {"), app.indexOf("\n}\n", app.indexOf("function canonicalLedgerActuals() {")) + 3);
  const { context, store } = sandbox({ expense: { "super|2026-10": 120 }, transactions: [mov("super", 80)] });
  context.applyMovementMappingsToActuals();
  context.availableSeriesRows = (kind) => (kind === "expense" ? [{ id: "super" }] : []);
  context.seriesKeyForRow = (row) => `expense|${row.id}`;
  context.displayLabelForRow = () => "Súper";
  vm.runInContext(ledgerBody, context);
  const [actual] = context.canonicalLedgerActuals();
  assert.equal(actual.amount, 80);
  assert.ok(store["bank-actuals-applied"]);
});
