const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { codigoApp } = require("./helpers/codigo-app.cjs");

// 2/11/2026, a petición del hogar antes de su primer cierre:
// (1) «Octubre primero»: Clasificar enseña antes los grupos con movimientos del mes que se cierra (el de Cierre, sin
//     firmar) y el contador cuenta esos: «faltan N de octubre (M en total)».
// (2) Reglas que no dependen del mes: CaixaBank pone el mes en el concepto («FINANCIE-OCTUBRE»). La regla de un mes sirve
//     para el mismo concepto de cualquier otro, y Clasificar los agrupa en uno. Los números de contrato no se tocan.
// Conceptos y cifras inventados.

const app = codigoApp();
const clas = fs.readFileSync(path.join(__dirname, "..", "views", "clasificar-v2.js"), "utf8");
let keys = "";

function extract(source, name) {
  const start = source.indexOf(`function ${name}(`);
  let depth = 0;
  for (let i = source.indexOf("{", start); i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    else if (source[i] === "}" && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(name);
}

keys = ["movementMappingKey", "movementMappingMonthlessKey", "movementMappingGroupKey", "movementMappingForAnyMonth"].map((name) => extract(app, name)).join("\n");

const PARTIDAS = {
  expense: [
    { id: "deuda", kind: "expense", sectionName: "Financiaciones", label: "Créditos" },
    { id: "luz", kind: "expense", sectionName: "Gastos fijos", label: "Luz" },
  ],
  income: [{ id: "nomina", kind: "income", sectionName: "Ingresos", label: "Nómina" }],
};

function base(extra = {}) {
  const context = {
    normalizedText: (value) => String(value ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""),
    movementKindFromAmount: (amount) => (Number(amount) >= 0 ? "income" : "expense"),
    transactionIdentity: (row) => `${row.date}|${row.movement}|${row.amount}`,
    planningRowBySeriesKey: (kind, key) => PARTIDAS[kind].find((row) => `${row.kind}|${row.id}` === key) || null,
    exactMovementPlanningMatch: () => null,
    movementMappings: {},
    ...extra,
  };
  vm.createContext(context);
  vm.runInContext(keys, context);
  vm.runInContext(extract(app, "mappingForMovement"), context);
  return context;
}
const tx = (date, movement, amount, details = "") => ({ date, month: date.slice(0, 7), movement, details, amount });
const rule = (kind, rowKey, updatedAt = "2026-10-01T00:00:00Z") => ({ kind, rowKey, label: rowKey, updatedAt });

test("la clave sin mes: cambia el mes (entero o como lo corta el banco) y su año, y nada más", () => {
  const c = base();
  assert.equal(c.movementMappingMonthlessKey("expense|financie octubre|recibo entidad de financiacion"), "expense|financie mes|recibo entidad de financiacion");
  assert.equal(c.movementMappingMonthlessKey("expense|financie septiemb|x"), "expense|financie mes|x");
  assert.equal(c.movementMappingMonthlessKey("expense|financie noviembr|x"), "expense|financie mes|x");
  assert.equal(c.movementMappingMonthlessKey("income|empresa ficticia|nomina mayo 2026 empresa"), "income|empresa ficticia|nomina mes empresa");
  assert.equal(c.movementMappingMonthlessKey("expense|bar del mar|"), "expense|bar del mar|", "«mar» no es un mes");
  assert.equal(c.movementMappingMonthlessKey("expense|crd01097111111|"), "expense|crd01097111111|", "los números de contrato se quedan");
  assert.equal(c.movementMappingGroupKey(tx("2026-10-30", "FINANCIE-OCTUBRE", -50, "Recibo entidad de financiación")), "expense|financie mes|recibo entidad de financiacion");
});

test("la regla de un mes sirve para el mismo concepto de otro; la exacta manda y el tipo tiene que coincidir", () => {
  const c = base({ movementMappings: { "expense|financie septiemb|recibo": rule("expense", "expense|deuda") } });
  const oct = tx("2026-10-30", "FINANCIE-OCTUBRE", -50, "Recibo");
  assert.equal(c.mappingForMovement(oct)?.row.id, "deuda");
  assert.equal(c.mappingForMovement(oct)?.source, "dictionary");
  assert.equal(c.mappingForMovement(tx("2026-10-30", "FINANCIE-OCTUBRE", 50, "Recibo")), null, "un ingreso no usa una regla de gasto");
  c.movementMappings["expense|financie octubre|recibo"] = rule("expense", "expense|luz");
  assert.equal(c.mappingForMovement(oct)?.row.id, "luz", "la exacta de octubre gana");
  assert.equal(c.mappingForMovement(tx("2026-10-02", "OTRA COSA", -5)), null, "un concepto sin mes no busca en otros");
});

test("si hay reglas de varios meses del mismo concepto, la más reciente; y la guardada sin mes también sirve", () => {
  const c = base({
    movementMappings: {
      "expense|financie agosto|recibo": rule("expense", "expense|luz", "2026-09-01T00:00:00Z"),
      "expense|financie septiemb|recibo": rule("expense", "expense|deuda", "2026-10-01T00:00:00Z"),
    },
  });
  assert.equal(c.mappingForMovement(tx("2026-10-30", "FINANCIE-OCTUBRE", -50, "Recibo"))?.row.id, "deuda");
  const d = base({ movementMappings: { "expense|financie mes|recibo": rule("expense", "expense|deuda") } });
  assert.equal(d.mappingForMovement(tx("2026-11-30", "FINANCIE-NOVIEMBR", -50, "Recibo"))?.row.id, "deuda", "noviembre se clasifica solo");
});

function clasificar({ transactions, closeMonth = "2026-10", signed = [] }) {
  const dialog = { open: false, innerHTML: "", dataset: {}, addEventListener() {}, querySelector: () => null, showModal() { this.open = true; }, close() { this.open = false; } };
  const context = base({
    escapeHtml: (value) => String(value ?? "").replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]),
    money: (value) => `${Number(value).toFixed(2).replace(".", ",")} €`,
    round2: (value) => Math.round(Number(value) * 100) / 100,
    movementDisplayName: (row) => (row.details ? `${row.movement} · ${row.details}` : row.movement),
    displayLabelForRow: (row) => row.label,
    seriesKeyForRow: (row) => `${row.kind}|${row.id}`,
    availableSeriesRows: (kind) => PARTIDAS[kind],
    closeTargetMonthKey: () => closeMonth,
    isSignedClosedMonthKey: (key) => signed.includes(key),
    isClosedMonthKey: () => false,
    monthByKey: (key) => ({ key }),
    actualKeyForRow: (row, month) => `${row.id}|${month.key}`,
    saveMovementMappings() {},
    applyMovementMappingsToActuals: () => 0,
    buildPendingMovementMappings: () => [],
    datosImportarRefreshRowsForMappings() {},
    saveIncomeActuals() {},
    saveExpenseActuals() {},
    refreshAllSectionsAfterDataChange() {},
    showUndoToast() {},
    announceStatus() {},
    baseData: { transactions, monthlyPlanning: { months: [] } },
    incomeActuals: {},
    expenseActuals: {},
    pendingMovementMappings: [],
    qs: (id) => (id === "clasificarV2" ? dialog : null),
    Intl,
    globalThis: {},
  });
  vm.runInContext(clas, context);
  return { context, dialog };
}

const MOVS = [
  tx("2026-09-12", "SEGURO GRANDE", -900),
  tx("2026-08-12", "SEGURO GRANDE", -900),
  tx("2026-10-05", "PANADERIA", -12),
  tx("2026-09-30", "FINANCIE-SEPTIEMB", -50, "Recibo"),
  tx("2026-10-30", "FINANCIE-OCTUBRE", -55, "Recibo"),
  tx("2026-09-03", "GIMNASIO", -30),
];

test("Octubre primero: los grupos del mes que se cierra van delante, y el concepto con mes es un solo grupo", () => {
  const { context } = clasificar({ transactions: MOVS });
  const groups = context.clasV2PendingGroups();
  assert.deepEqual(Array.from(groups, (g) => g.name), ["FINANCIE-OCTUBRE · Recibo", "PANADERIA", "SEGURO GRANDE", "GIMNASIO"], "el seguro suma más, pero no es de octubre");
  assert.equal(groups[0].rows.length, 2, "septiembre y octubre, juntos");
  assert.equal(groups[0].key, "expense|financie mes|recibo");
  assert.equal(groups[0].anyMonth, true);
  assert.deepEqual(Array.from(groups, (g) => g.inClose), [true, true, false, false]);
});

test("el contador cuenta lo del mes que se cierra y, hecho eso, lo dice; la tarjeta dice que es del cierre y de cualquier mes", () => {
  const { context, dialog } = clasificar({ transactions: MOVS });
  context.clasificarV2Open();
  assert.match(dialog.innerHTML, /1 de 4 · faltan 2 de octubre \(4 en total\) · menos de un minuto \(aún sin medir\)/);
  assert.match(dialog.innerHTML, /Grupo · mismo concepto, cualquier mes · gasto · cierre de octubre/);
  assert.match(dialog.innerHTML, /En octubre<\/span><span class="clas-v2-num">55,00 €/, "la cifra es la del mes que se cierra");
  vm.runInContext('clasV2Choice = "expense|deuda"; clasV2Render();', context);
  assert.match(dialog.innerHTML, /para siempre, con el concepto de cualquier mes/);
  context.clasV2Accept();
  assert.deepEqual(JSON.parse(JSON.stringify(context.movementMappings["expense|financie mes|recibo"])).rowKey, "expense|deuda", "la regla se guarda sin el mes");
  assert.equal(context.mappingForMovement(tx("2026-11-30", "FINANCIE-NOVIEMBR", -60, "Recibo"))?.row.id, "deuda", "y noviembre ya tendrá partida");
  assert.match(dialog.innerHTML, /2 de 4 · falta 1 de octubre \(3 en total\)/);
  context.clasV2Skip();
  assert.match(dialog.innerHTML, /3 de 4 · Octubre ya está · faltan 2 de otros meses/);
  assert.ok(!/cierre de octubre/.test(dialog.innerHTML), "el seguro no es del cierre");
});

test("sin mes por cerrar (o ya firmado) todo sigue como antes", () => {
  const firmado = clasificar({ transactions: MOVS, signed: ["2026-10"] });
  assert.equal(firmado.context.clasV2PendingGroups()[0].name, "SEGURO GRANDE");
  firmado.context.clasificarV2Open();
  assert.match(firmado.dialog.innerHTML, /1 de 4 · faltan 4 grupos · /);
  const sin = clasificar({ transactions: MOVS, closeMonth: "" });
  assert.equal(sin.context.clasV2PendingGroups()[0].name, "SEGURO GRANDE");
  const vacio = clasificar({ transactions: MOVS.filter((row) => row.month !== "2026-10") });
  vacio.context.clasificarV2Open();
  assert.match(vacio.dialog.innerHTML, /1 de 3 · faltan 3 grupos · /, "sin movimientos de octubre no dice «Octubre ya está»");
});

test("la bandeja de Movimientos cuenta los conceptos igual que Clasificar, sin el mes", () => {
  const mov = fs.readFileSync(path.join(__dirname, "..", "views", "movimientos-v2.js"), "utf8");
  assert.match(mov, /const groupKey = typeof movementMappingGroupKey === "function" \? movementMappingGroupKey : movementMappingKey;/);
  assert.match(app, /if \(!keys\.has\(key\) && !keys\.has\(movementMappingMonthlessKey\(key\)\)\) return;/, "Importar refresca también el mismo concepto de otro mes");
});
