const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

// Real parcial del mes en curso (decisión del hogar del 5/10/2026, docs/WP30_DISENO.md §10): un real de
// «Gasto variable estimado» que aún no cubre el mes (p. ej. una importación de extracto a mitad de mes) no
// sustituye al previsto. Mientras el mes no pasa, el valor es max(previsto, real); en «Real manual», el mes de
// arranque vale max(previsto − real, 0) porque lo ya gastado está en el saldo. Meses pasados, otras partidas
// y los reales sin parcialidad no cambian.

function extractFunction(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `No existe la función ${name} en app.js`);
  let parenDepth = 0;
  let bodyStart = -1;
  for (let index = app.indexOf("(", start); index < app.length; index += 1) {
    if (app[index] === "(") parenDepth += 1;
    else if (app[index] === ")") {
      parenDepth -= 1;
      if (parenDepth === 0) {
        bodyStart = app.indexOf("{", index);
        break;
      }
    }
  }
  let depth = 0;
  for (let index = bodyStart; index < app.length; index += 1) {
    if (app[index] === "{") depth += 1;
    else if (app[index] === "}") {
      depth -= 1;
      if (depth === 0) return app.slice(start, index + 1);
    }
  }
  throw new Error(`La función ${name} no cierra sus llaves`);
}

function world({ planned, actual, rowId = "variable-operational-spend", kind = "expense", override, mode = "auto", openKey = "2026-10", startKey = "2026-10" }) {
  const context = {
    state: { balanceMode: mode },
    VARIABLE_OPERATIONAL_ROW_ID: "variable-operational-spend",
    actualsForKind: () => (actual === undefined ? {} : { "r|2026-10": actual }),
    actualKeyForRow: () => "r|2026-10",
    seriesOverrideForRow: () => override,
    plannedValueForRow: () => planned,
    cardAccruedForRow: () => 0,
    openMonthCutoffKey: () => openKey,
    monthKey: () => startKey,
    modelStartDate: () => new Date(),
  };
  vm.createContext(context);
  ["isVariableOperationalRow", "actualAwareInfo", "forwardPlanningInfo"].forEach((name) => vm.runInContext(extractFunction(name), context));
  const row = { id: rowId, kind };
  const month = { key: "2026-10" };
  return { info: context.actualAwareInfo(row, month), forward: context.forwardPlanningInfo(row, month) };
}

test("mes en curso: un real parcial de Gasto variable no rebaja el previsto", () => {
  const { info, forward } = world({ planned: 1750, actual: 200 });
  assert.equal(info.value, 1750);
  assert.equal(info.hasActual, true);
  assert.equal(info.actual, 200);
  assert.equal(info.inProgress, true);
  assert.equal(forward.value, 1750);
});

test("mes en curso: un real que supera el previsto manda (max)", () => {
  assert.equal(world({ planned: 1750, actual: 2100 }).info.value, 2100);
});

test("«Real manual», mes de arranque en curso: vale lo que falta por gastar", () => {
  const { forward } = world({ planned: 1750, actual: 200, mode: "manual" });
  assert.equal(forward.value, 1550);
  assert.match(forward.source, /En curso/);
});

test("«Real manual», real mayor que el previsto: no sale negativo", () => {
  assert.equal(world({ planned: 1750, actual: 2100, mode: "manual" }).forward.value, 0);
});

test("mes pasado sin firmar: sigue como hoy (el real sustituye al previsto)", () => {
  const { info, forward } = world({ planned: 1750, actual: 200, openKey: "2026-11" });
  assert.equal(info.value, 200);
  assert.equal(info.inProgress, false);
  assert.equal(forward.value, 200);
});

test("otras partidas: un real sigue sustituyendo al previsto", () => {
  const { info } = world({ planned: 80, actual: 40, rowId: "gasto-luz" });
  assert.equal(info.value, 40);
  assert.equal(info.inProgress, false);
});

test("otras partidas en «Real manual», mes de arranque: sigue valiendo 0", () => {
  assert.equal(world({ planned: 80, actual: 40, rowId: "gasto-luz", mode: "manual" }).forward.value, 0);
});

test("sin real o cancelada: sin cambios", () => {
  assert.equal(world({ planned: 1750 }).info.value, 1750);
  assert.equal(world({ planned: 1750, actual: 200, override: { actualStatus: "cancelled" } }).info.value, 0);
});

test("ingresos y real con 0 explícito: sin cambios en lo que no es gasto variable parcial", () => {
  assert.equal(world({ planned: 1750, actual: 200, kind: "income" }).info.inProgress, false);
});
