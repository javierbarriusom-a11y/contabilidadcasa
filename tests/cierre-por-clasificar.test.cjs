// 3/11/2026 · Cierre: «Dejar N en Por clasificar». Decisión del hogar en su primer cierre real: firmar sin haber asignado todo,
// pero sin que el mes pierda ese dinero. Se cargan en un vm las funciones reales de views/cierre.js. Movimientos INVENTADOS.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const cierre = read("views/cierre.js");

function extractFunction(name) {
  const start = cierre.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `No existe la función ${name}`);
  const bodyStart = cierre.indexOf("{", cierre.indexOf(")", start));
  let depth = 0;
  for (let index = bodyStart; index < cierre.length; index += 1) {
    if (cierre[index] === "{") depth += 1;
    else if (cierre[index] === "}") {
      depth -= 1;
      if (depth === 0) return cierre.slice(start, index + 1);
    }
  }
  throw new Error(`La función ${name} no cierra sus llaves`);
}

const NOMBRES = [
  "cierrePorClasificarFilas", "cierrePorClasificarResumen", "cierrePorClasificarAvisoHtml", "cierreMesAnterior", "cierreMovimientos", "cierrePorClasificarContados",
  "cierrePorClasificarHtml", "cierrePorClasificarRecuerdoHtml", "cierrePorClasificarPartida", "cierrePorClasificarRefresca",
  "handleCierrePorClasificar", "handleCierrePorClasificarDeshacer",
];

const tx = (date, movement, amount) => ({ date, month: date.slice(0, 7), movement, details: "", amount });
const TXS = [
  tx("2026-10-03", "SUPER FICTICIO", -40),
  tx("2026-10-03", "SUPER FICTICIO", -40), // duplicado del extracto: el mismo movimiento
  tx("2026-10-09", "TIENDA RARA FICTICIA", -12.5),
  tx("2026-10-15", "TRANSFERENCIA FICTICIA", 30),
  tx("2026-10-20", "LUZ FICTICIA", -60), // ya tiene partida
  tx("2026-09-20", "OTRO MES FICTICIO", -15), // de otro mes
];

function cargar({ movementMappings = {}, customPlanningRows = [], firmados = [] } = {}) {
  const calls = [];
  const ctx = {
    console, Date, Math, Number, String, Set, Object,
    baseData: {
      transactions: TXS.map((row) => ({ ...row })),
      monthlyPlanning: { sections: [{ kind: "expense", name: "Gastos fijos" }, { kind: "expense", name: "Gastos variables" }, { kind: "income", name: "Ingresos" }] },
    },
    movementMappings,
    customPlanningRows,
    pendingMovementMappings: [],
    transactionIdentity: (row) => `${row.date}|${row.movement}|${row.amount}`,
    mappingForMovement: (row) => (row.movement === "LUZ FICTICIA" || movementMappings[`${row.date}|${row.movement}|${row.amount}`] ? { row: {} } : null),
    movementKindFromAmount: (amount) => (Number(amount) < 0 ? "expense" : "income"),
    isSignedClosedMonthKey: (mes) => firmados.includes(mes),
    ledgerMonthLabel: (mes) => (mes === "2026-10" ? "octubre de 2026" : mes),
    money: (value) => `${String(value).replace(".", ",")} €`,
    escapeHtml: (value) => String(value),
    saveMovementMappings: () => calls.push("saveMovementMappings"),
    saveCustomPlanningRows: () => calls.push("saveCustomPlanningRows"),
    applyMovementMappingsToActuals: () => calls.push("applyMovementMappingsToActuals"),
    buildPendingMovementMappings: () => [],
    saveIncomeActuals: () => calls.push("saveIncomeActuals"),
    saveExpenseActuals: () => calls.push("saveExpenseActuals"),
    refreshAllSectionsAfterDataChange: () => calls.push("refreshAllSectionsAfterDataChange"),
    announceStatus: (message) => calls.push(["announceStatus", message]),
    renderCierre: () => calls.push("renderCierre"),
  };
  vm.createContext(ctx);
  vm.runInContext(`const CIERRE_POR_CLASIFICAR = "Por clasificar";\nlet cierrePorClasificarHecho = null;\n${NOMBRES.map(extractFunction).join("\n")}\nthis.hecho = () => cierrePorClasificarHecho;`, ctx);
  return { ctx, calls };
}

const SOLO_SIN_PARTIDA = [{ cause: "unclassified" }, { cause: "unclassified" }, { cause: "unclassified" }];

test("se ofrece solo cuando lo único abierto del mes son movimientos sin partida, con cuántos son y cuánto suman", () => {
  const { ctx } = cargar();
  const html = ctx.cierrePorClasificarHtml(SOLO_SIN_PARTIDA, "2026-10");
  assert.match(html, /Quedan <strong>3 movimientos de octubre de 2026 sin partida<\/strong> \(52,5 € de gasto y 30 € de ingreso\)/);
  assert.match(html, /si firmaras así, octubre de 2026 se quedaría sin ese dinero/);
  assert.match(html, /sin crear reglas: esos conceptos te seguirán esperando en la bandeja/);
  assert.match(html, /data-cierre-por-clasificar="2026-10">Dejar 3 movimientos en «Por clasificar»<\/button>/);
  assert.equal(ctx.cierrePorClasificarHtml([...SOLO_SIN_PARTIDA, { cause: "balance-gap" }], "2026-10"), "", "un descuadre de saldos no se tapa así");
  assert.equal(ctx.cierrePorClasificarHtml([], "2026-10"), "");
});

test("deja cada movimiento del mes en «Por clasificar» por su identidad, sin reglas, y crea la partida de gasto y la de ingreso", () => {
  const movementMappings = { "expense|regla-ajena": { kind: "expense", rowKey: "expense|x" } };
  const customPlanningRows = [];
  const { ctx, calls } = cargar({ movementMappings, customPlanningRows });
  ctx.handleCierrePorClasificar("2026-10");
  const claves = Object.keys(movementMappings).filter((key) => movementMappings[key].porClasificar).sort();
  assert.deepEqual(claves, ["2026-10-03|SUPER FICTICIO|-40", "2026-10-09|TIENDA RARA FICTICIA|-12.5", "2026-10-15|TRANSFERENCIA FICTICIA|30"]);
  assert.ok(!Object.keys(movementMappings).some((key) => key.includes("OTRO MES")), "lo de otros meses no se toca");
  assert.equal(customPlanningRows.length, 2);
  const gasto = customPlanningRows.find((row) => row.kind === "expense");
  const ingreso = customPlanningRows.find((row) => row.kind === "income");
  assert.deepEqual([gasto.label, gasto.sectionName, gasto.monthKey, gasto.plannedValue, gasto.custom], ["Por clasificar", "Gastos variables", "2026-10", 0, true]);
  assert.equal(ingreso.sectionName, "Ingresos");
  assert.equal(movementMappings["2026-10-03|SUPER FICTICIO|-40"].rowKey, `expense|${gasto.id}`);
  assert.equal(movementMappings["2026-10-15|TRANSFERENCIA FICTICIA|30"].rowKey, `income|${ingreso.id}`);
  assert.deepEqual(calls.slice(0, 6), ["saveCustomPlanningRows", "saveMovementMappings", "applyMovementMappingsToActuals", "saveIncomeActuals", "saveExpenseActuals", "refreshAllSectionsAfterDataChange"]);
  assert.equal(ctx.hecho().texto, "3 movimientos (52,5 € de gasto y 30 € de ingreso) van a «Por clasificar». Ya puedes firmar.");
  assert.equal(calls.at(-1), "renderCierre");
});

test("reutiliza la «Por clasificar» que el hogar ya creó, y le añade la fila del mes si no la tenía", () => {
  const customPlanningRows = [{ id: "custom-expense-hogar", custom: true, kind: "expense", sectionName: "Gastos variables", label: "Por clasificar ", monthKey: "2026-11", plannedValue: 0 }];
  const movementMappings = {};
  const { ctx } = cargar({ movementMappings, customPlanningRows });
  ctx.handleCierrePorClasificar("2026-10");
  assert.equal(customPlanningRows.filter((row) => row.id === "custom-expense-hogar").length, 2);
  assert.ok(customPlanningRows.some((row) => row.id === "custom-expense-hogar" && row.monthKey === "2026-10"));
  assert.equal(movementMappings["2026-10-09|TIENDA RARA FICTICIA|-12.5"].rowKey, "expense|custom-expense-hogar");
});

test("«Deshacer» devuelve los movimientos a sin partida y quita lo que creó", () => {
  const movementMappings = {};
  const customPlanningRows = [{ id: "custom-otra", custom: true, kind: "expense", label: "Otra", monthKey: "2026-10" }];
  const { ctx, calls } = cargar({ movementMappings, customPlanningRows });
  ctx.handleCierrePorClasificar("2026-10");
  ctx.handleCierrePorClasificarDeshacer();
  assert.deepEqual(movementMappings, {});
  assert.deepEqual(customPlanningRows.map((row) => row.id), ["custom-otra"]);
  assert.equal(ctx.hecho(), null);
  assert.ok(calls.some((call) => Array.isArray(call) && call[1] === "Deshecho: esos movimientos vuelven a estar sin partida."));
});

test("un mes ya firmado no se toca, ni para dejar ni para deshacer", () => {
  const movementMappings = {};
  const { ctx, calls } = cargar({ movementMappings, firmados: ["2026-10"] });
  ctx.handleCierrePorClasificar("2026-10");
  assert.deepEqual(movementMappings, {});
  assert.deepEqual(calls, []);
});

test("el mes firmado lo recuerda, y el cierre siguiente también (contado de las asignaciones, no guardado aparte)", () => {
  const movementMappings = {
    "2026-10-03|SUPER FICTICIO|-40": { porClasificar: true },
    "2026-10-09|TIENDA RARA FICTICIA|-12.5": { porClasificar: true },
    "2026-10-20|LUZ FICTICIA|-60": { rowKey: "expense|luz" },
  };
  const { ctx } = cargar({ movementMappings });
  assert.match(ctx.cierrePorClasificarRecuerdoHtml("2026-10"), /octubre de 2026 se firmó con 2 movimientos en «Por clasificar»/);
  assert.equal(ctx.cierrePorClasificarRecuerdoHtml("2026-09"), "");
  assert.equal(ctx.cierreMesAnterior("2026-11"), "2026-10");
  assert.equal(ctx.cierreMesAnterior("2027-01"), "2026-12");
});

test("cableado: Cierre pinta la tarjeta en el paso 2 y junto a la firma, y los dos botones llegan a sus funciones", () => {
  assert.match(cierre, /body\.innerHTML = cierrePorClasificarRecuerdoHtml\(cierreMesAnterior\(currentMonthKey\)\) \+ cierreStep2Html\(tasks, currentMonthKey\);/);
  assert.match(cierre, /\$\{cierrePorClasificarHtml\(tasks, currentMonthKey\)\}/);
  assert.match(cierre, /\$\{cierrePorClasificarRecuerdoHtml\(currentMonthKey\)\}\$\{savedBalances/);
  const app = read("app.js");
  assert.match(app, /handleCierrePorClasificar\(porClasificar\.dataset\.cierrePorClasificar\)/);
  assert.match(app, /\[data-cierre-por-clasificar-deshacer\]"\)\) \{ handleCierrePorClasificarDeshacer\(\); return; \}/);
});
