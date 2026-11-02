const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const { codigoApp } = require("./helpers/codigo-app.cjs");
const fs = require("node:fs");
const path = require("node:path");

// 2/11/2026 · partidas de un solo mes con reglas «para siempre». Una partida personalizada solo existe en los meses que
// tienen su fila (customRowsForSection). Cierre («Crear partida»), Planificación de partidas («Solo un mes») y Registrar la
// creaban para un mes; si una regla de Movimientos la apuntaba, el real de los demás meses se escribía en una clave que
// ningún mes suma. Comprueba (1) que aplicar las reglas crea la fila que falta con previsto 0 € en los meses sin firmar con
// movimientos, respeta una supresión expresa y no toca las partidas del plan base; (2) que el real cuenta en ese mes; y
// (3) que Cierre crea la partida del mes del movimiento al final del plan. Cifras inventadas.

const app = codigoApp();
const cierre = fs.readFileSync(path.join(__dirname, "..", "views", "cierre.js"), "utf8");
const helpers = app.slice(app.indexOf("function ensureCustomRowsForBankActuals("), app.indexOf("function transactionIdentity("));
const MONTHS = ["2026-09", "2026-10", "2026-11", "2026-12"].map((key) => ({ key }));

function extract(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, name);
  let depth = 0;
  for (let i = source.indexOf("{", start); i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    else if (source[i] === "}" && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(name);
}

function sandbox({ custom = [], transactions = [], signed = [], deleted = {}, base = [] } = {}) {
  const calls = [];
  const store = {};
  const context = {
    baseData: { transactions, monthlyPlanning: { months: MONTHS } },
    customPlanningRows: custom,
    deletedPlanningRows: deleted,
    isSignedClosedMonthKey: (key) => signed.includes(key),
    isClosedMonthKey: (key) => signed.includes(key),
    isPlanningRowDeleted: (row, month) => Boolean(deleted[`${row.kind}|${row.id}|${month.key}`]),
    saveCustomPlanningRows: () => calls.push("saveCustomPlanningRows"),
    monthByKey: (key, months) => months.find((month) => month.key === key) || null,
    actualKeyForRow: (row, month) => `${row.id}|${month.key}`,
    round2: (value) => Math.round(value * 100) / 100,
    incomeActuals: {},
    expenseActuals: {},
    storageKey: (name) => name,
    storageGet: (key, fallback) => (key in store ? store[key] : fallback),
    storageSet: (key, value) => { store[key] = value; },
  };
  const rows = Object.fromEntries([...custom, ...base].map((row) => [row.id, row]));
  context.mappingForMovement = (tx) => (rows[tx.partida] ? { kind: "expense", row: rows[tx.partida] } : null);
  context.actualsForKind = (kind) => (kind === "income" ? context.incomeActuals : context.expenseActuals);
  vm.createContext(context);
  vm.runInContext(helpers, context);
  return { context, calls };
}
const mov = (partida, amount, month) => ({ partida, amount: -amount, month, date: `${month}-05` });
const plain = (value) => JSON.parse(JSON.stringify(value));
const unaFila = () => [{ id: "custom-expense-1", custom: true, kind: "expense", sectionName: "Gastos fijos", label: "Financiaciones", monthKey: "2026-10", plannedValue: 59 }];

test("aplicar las reglas crea la fila que falta, con previsto 0 €, en cada mes con movimientos de esa partida", () => {
  const { context, calls } = sandbox({ custom: unaFila(), transactions: [mov("custom-expense-1", 59, "2026-10"), mov("custom-expense-1", 61, "2026-11"), mov("custom-expense-1", 7, "2026-11")] });
  context.applyMovementMappingsToActuals();
  assert.deepEqual(plain(context.customPlanningRows.map((row) => [row.monthKey, row.plannedValue])), [["2026-10", 59], ["2026-11", 0]], "octubre conserva su previsto; noviembre nace a 0 €; diciembre, sin movimientos, no");
  assert.deepEqual(plain(context.customPlanningRows[1]), { id: "custom-expense-1", custom: true, kind: "expense", sectionName: "Gastos fijos", label: "Financiaciones", monthKey: "2026-11", plannedValue: 0 });
  assert.equal(context.expenseActuals["custom-expense-1|2026-11"], 68, "y el real de noviembre está en la clave que ahora sí suma su mes");
  assert.deepEqual(calls, ["saveCustomPlanningRows"]);
  context.applyMovementMappingsToActuals();
  assert.equal(context.customPlanningRows.length, 2, "una segunda vez no duplica");
  assert.deepEqual(calls, ["saveCustomPlanningRows"], "ni vuelve a guardar si no hay nada que añadir");
});

test("también repara los meses pasados sin firmar; los firmados y una supresión expresa del mes se respetan", () => {
  const { context } = sandbox({
    custom: unaFila(),
    transactions: [mov("custom-expense-1", 10, "2026-09"), mov("custom-expense-1", 20, "2026-11"), mov("custom-expense-1", 30, "2026-12")],
    signed: ["2026-09"],
    deleted: { "expense|custom-expense-1|2026-12": true },
  });
  context.applyMovementMappingsToActuals();
  assert.deepEqual(context.customPlanningRows.map((row) => row.monthKey), ["2026-10", "2026-11"]);
});

test("las partidas del plan base (existen en todos los meses) no se tocan", () => {
  const { context, calls } = sandbox({ base: [{ id: "super", kind: "expense" }], transactions: [mov("super", 80, "2026-11")] });
  context.applyMovementMappingsToActuals();
  assert.deepEqual(plain(context.customPlanningRows), []);
  assert.deepEqual(calls, []);
});

test("customSeriesMonthsFrom: del mes dado al final del plan, sin los firmados", () => {
  const { context } = sandbox({ signed: ["2026-11"] });
  assert.deepEqual(plain(context.customSeriesMonthsFrom("2026-10").map((month) => month.key)), ["2026-10", "2026-12"]);
});

test("Cierre · «Crear partida» va del mes del movimiento al final del plan: ese mes con lo que costó, los demás a 0 €", () => {
  const entry = { id: "e1", kind: "expense", monthKey: "2026-10", amount: 62.3, description: "Cargo", movement: "COMERCIO", details: "" };
  const pushed = [];
  const context = {
    cierreClassifyEntryId: "e1",
    customPlanningRows: pushed,
    saveCustomPlanningRows() {},
    cierreLedgerEntryById: () => entry,
    cierreClassifyApply() {},
    refreshAllSectionsAfterDataChange() {},
    announceStatus() {},
    baseData: { monthlyPlanning: { months: MONTHS } },
    isSignedClosedMonthKey: (key) => key === "2026-12",
    qs: (id) => ({ cierreClassifyNewLabel: { value: "Suscripción", focus() {} }, cierreClassifyNewSection: { value: "Gastos variables" }, cierreClassifyDialog: { close() {} } })[id] || null,
  };
  vm.createContext(context);
  vm.runInContext(extract(app, "customSeriesMonthsFrom"), context);
  vm.runInContext(extract(cierre, "handleCierreTaskCreatePartidaConfirm"), context);
  context.handleCierreTaskCreatePartidaConfirm();
  assert.deepEqual(plain(pushed.map((row) => [row.monthKey, row.plannedValue])), [["2026-10", 62.3], ["2026-11", 0]], "diciembre está firmado");
  assert.equal(new Set(pushed.map((row) => row.id)).size, 1, "una sola serie");
});

test("cableado: aplicar las reglas pasa por la reparación, y Clasificar usa el mismo rango que Cierre", () => {
  assert.match(app, /function applyMovementMappingsToActuals\(\) \{\s*const totals = bankActualTotals\(\);\s*if \(typeof ensureCustomRowsForBankActuals === "function"\) ensureCustomRowsForBankActuals\(totals\);/);
  assert.match(fs.readFileSync(path.join(__dirname, "..", "views", "clasificar-v2.js"), "utf8"), /return customSeriesMonthsFrom\(from\);/);
  assert.match(cierre, /customSeriesMonthsFrom\(entry\.monthKey\)/);
});
