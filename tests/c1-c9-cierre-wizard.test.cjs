const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

// Fase 5 · Cierre (pantalla 08, Cierre.pdf, auditado el 16 de agosto): ritual secuencial de tres
// pasos reales — Conciliar cuentas, Resolver diferencias, Firmar y archivar — en vez de los cuatro
// del mockup, porque Sobres (P-14/P-15/P-16) no existe todavía. Estas pruebas cubren las funciones
// puras del nuevo #cierre: C-1 (bloqueo secuencial de pasos), C-2 (declarado frente a calculado por
// cuenta), C-3 (tareas agrupadas por causa), C-5 (las tres comprobaciones antes de firmar) y C-9
// (contadores).

function extractFunction(name) {
  let start = app.indexOf(`function ${name}(`);
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
  assert.ok(bodyStart >= 0, `No se encontró el cuerpo de ${name}`);
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

function extractConst(name) {
  const start = app.indexOf(`const ${name} `);
  assert.ok(start >= 0, `No existe la constante ${name} en app.js`);
  const end = app.indexOf(";\n", start);
  return app.slice(start, end + 1);
}

function sandboxWith(names, extra = {}) {
  const context = { ...extra };
  vm.createContext(context);
  vm.runInContext(extractConst("CIERRE_ACCOUNT_LABELS"), context);
  vm.runInContext(extractConst("CIERRE_TASK_CAUSE_LABELS"), context);
  names.forEach((name) => vm.runInContext(extractFunction(name), context));
  return context;
}

function baseContext(names, extra = {}) {
  return sandboxWith(names, {
    round2: (v) => Math.round((Number(v || 0) + Number.EPSILON) * 100) / 100,
    money: (v) => `${v}€`,
    escapeHtml: (v) => String(v),
    accountBalancesFromState: () => ({ caixa: 1000, mediolanum: 500 }),
    monthClosures: [],
    ...extra,
  });
}

// --- cierreAccountReconciliation (C-2) -----------------------------------------------------------

test("C-2 · una cuenta sin ningún movimiento de extracto queda «sin-conciliar», no «cuadra»", () => {
  const context = baseContext(["cierreAccountReconciliation"]);
  const rows = context.cierreAccountReconciliation([]);
  const mediolanum = rows.find((row) => row.id === "mediolanum");
  assert.equal(mediolanum.status, "sin-conciliar");
  assert.equal(mediolanum.calculated, null);
  assert.equal(mediolanum.diff, null);
});

test("C-2 · declarado igual a calculado (dentro de tolerancia) cuadra", () => {
  const context = baseContext(["cierreAccountReconciliation"]);
  const rows = context.cierreAccountReconciliation([
    { accountId: "caixabank", balanceAfter: 1000, date: "2026-08-01", sourceRow: 1 },
  ]);
  const caixa = rows.find((row) => row.id === "caixabank");
  assert.equal(caixa.status, "cuadra");
  assert.equal(caixa.diff, 0);
});

test("C-2 · una diferencia real por encima de la tolerancia descuadra con la cifra exacta", () => {
  const context = baseContext(["cierreAccountReconciliation"]);
  const rows = context.cierreAccountReconciliation([
    { accountId: "caixabank", balanceAfter: 938, date: "2026-08-01", sourceRow: 1 },
  ]);
  const caixa = rows.find((row) => row.id === "caixabank");
  assert.equal(caixa.status, "descuadra");
  assert.equal(caixa.diff, 62);
});

test("C-2 · se queda con el movimiento de fecha más reciente, ignora duplicados", () => {
  const context = baseContext(["cierreAccountReconciliation"]);
  const rows = context.cierreAccountReconciliation([
    { accountId: "caixabank", balanceAfter: 500, date: "2026-08-01", sourceRow: 1 },
    { accountId: "caixabank", balanceAfter: 1000, date: "2026-08-10", sourceRow: 2 },
    { accountId: "caixabank", balanceAfter: 9999, date: "2026-08-15", sourceRow: 3, duplicateOf: "tx-1" },
  ]);
  const caixa = rows.find((row) => row.id === "caixabank");
  assert.equal(caixa.calculated, 1000);
  assert.equal(caixa.status, "cuadra");
});

// --- cierreStepsStatus (C-1) --------------------------------------------------------------------

test("C-1 · el paso 1 siempre está desbloqueado; 2 y 3 empiezan bloqueados si las cuentas descuadran", () => {
  const context = baseContext(["cierreStepsStatus", "cierreAccountsSettled"]);
  const steps = context.cierreStepsStatus([{ status: "descuadra" }], []);
  assert.equal(steps[0].unlocked, true);
  assert.equal(steps[0].done, false);
  assert.equal(steps[1].unlocked, false);
  assert.equal(steps[2].unlocked, false);
});

test("C-1 · el paso 2 se desbloquea cuando las cuentas cuadran, el 3 solo cuando además no hay tareas", () => {
  const context = baseContext(["cierreStepsStatus", "cierreAccountsSettled"]);
  const settled = [{ status: "cuadra" }, { status: "sin-conciliar" }];
  const withTasks = context.cierreStepsStatus(settled, [{ cause: "unclassified" }]);
  assert.equal(withTasks[1].unlocked, true);
  assert.equal(withTasks[1].done, false);
  assert.equal(withTasks[2].unlocked, false);

  const noTasks = context.cierreStepsStatus(settled, []);
  assert.equal(noTasks[1].done, true);
  assert.equal(noTasks[2].unlocked, true);
});

// --- cierreFirmChecks (C-5) ----------------------------------------------------------------------

test("C-5 · las tres comprobaciones fallan por separado, no todas a la vez", () => {
  const context = baseContext(["cierreFirmChecks", "cierreAccountsSettled"]);
  const checks = context.cierreFirmChecks([{ status: "descuadra" }], [{ cause: "unclassified" }], 0);
  assert.equal(checks.length, 3);
  assert.equal(checks[0].met, false);
  assert.equal(checks[1].met, false);
  assert.equal(checks[2].met, false);
});

test("C-5 · con todo en orden las tres comprobaciones cumplen", () => {
  const context = baseContext(["cierreFirmChecks", "cierreAccountsSettled"]);
  const checks = context.cierreFirmChecks([{ status: "cuadra" }], [], 41);
  assert.ok(checks.every((check) => check.met));
});

// --- cierreGroupTasksByCause (C-3) ----------------------------------------------------------------

test("C-3 · agrupa las tareas por causa y omite los grupos vacíos", () => {
  const context = baseContext(["cierreGroupTasksByCause"]);
  const groups = context.cierreGroupTasksByCause([
    { cause: "unclassified", id: "a" },
    { cause: "unclassified", id: "b" },
    { cause: "balance-gap", id: "c" },
  ]);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].cause, "unclassified");
  assert.equal(groups[0].items.length, 2);
  assert.equal(groups[1].cause, "balance-gap");
  assert.equal(groups[1].items.length, 1);
});

test("C-3 · sin tareas no hay ningún grupo", () => {
  const context = baseContext(["cierreGroupTasksByCause"]);
  assert.equal(context.cierreGroupTasksByCause([]).length, 0);
});

// --- cierreCountersHtml (C-9) ---------------------------------------------------------------------

test("C-9 · los cuatro contadores reflejan cifras reales, no fijas", () => {
  const context = baseContext(["cierreCountersHtml"], { monthClosures: [{ status: "closed" }, { status: "closed" }] });
  const html = context.cierreCountersHtml(
    [{ status: "descuadra" }, { status: "cuadra" }],
    [{ cause: "unclassified" }],
    5
  );
  assert.match(html, /Cuentas descuadradas[\s\S]*?<span class="e19-kpi-value">1<\/span>/);
  assert.match(html, /Tareas pendientes[\s\S]*?<span class="e19-kpi-value">1<\/span>/);
  assert.match(html, /Movimientos sin clasificar[\s\S]*?<span class="e19-kpi-value">5<\/span>/);
  assert.match(html, /Meses cerrados[\s\S]*?<span class="e19-kpi-value">2<\/span>/);
});

// --- cierreStepsHtml / cierreFirmChecksHtml (render smoke) -----------------------------------------

test("cierreStepsHtml marca el paso bloqueado y explica por qué", () => {
  const context = baseContext(["cierreStepsStatus", "cierreAccountsSettled", "cierreStepsHtml"]);
  const steps = context.cierreStepsStatus([{ status: "descuadra" }], []);
  const html = context.cierreStepsHtml(steps, 1);
  assert.match(html, /is-locked/);
  assert.match(html, /Se abre al completar el paso anterior/);
});

test("cierreFirmChecksHtml colorea cada comprobación por su propio estado", () => {
  const context = baseContext(["cierreFirmChecks", "cierreAccountsSettled", "cierreFirmChecksHtml"]);
  const checks = context.cierreFirmChecks([{ status: "cuadra" }], [{ cause: "unclassified" }], 10);
  const html = context.cierreFirmChecksHtml(checks);
  assert.match(html, /is-ok">Las cuentas cuadran/);
  assert.match(html, /is-danger">Ninguna diferencia abierta/);
  assert.match(html, /is-ok">Extracto incorporado/);
});
