const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// WP-07 (NTC-01): el motor de fechas se extrajo de app.js a canonical-timing.js SIN CAMBIO DE COMPORTAMIENTO.
// Antes de borrar nada se ejecutaron el original (app.js de la sesión 299, en un vm) y el módulo sobre 60.276
// casos —36 meses de 2025 a 2027, 17 etiquetas de ingreso y 14 de gasto, 9 importes, con y sin movimientos
// casables, fechas vacías, inválidas y con hora— con 0 diferencias campo a campo (day, date, source, label,
// confidence, role, endOfMonth). Una muestra de 493 casos que cubre todas las reglas quedó como oro en
// tests/fixtures/ntc1-timing-golden.json: esta prueba exige que el módulo la reproduzca exactamente.

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const app = read("app.js");
const golden = require("./fixtures/ntc1-timing-golden.json");
const { buildTransactions } = require("./fixtures/ntc1-timing-transactions.cjs");

function block(startMarker, endMarker) {
  const start = app.indexOf(startMarker);
  const end = app.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `No se encontró el bloque ${startMarker}`);
  return app.slice(start, end);
}

// Las utilidades reales de app.js y el módulo, en el mismo contexto (como en el navegador: `instanceof Date`
// no cruza contextos de vm).
function loadEngine(transactions) {
  const sandbox = { transactionsForTest: transactions };
  vm.createContext(sandbox);
  vm.runInContext([
    block("function dateFromMonthKey", "function defaultBalanceDate"),
    block("function normalizedText", "function isCarPlanningRow"),
    "function displayLabelForRow(row) { return row.label; }",
    read("canonical-timing.js"),
    "this.engine = FinanceCanonicalTiming.createTimingEngine({ displayLabelForRow, normalizedText, dateFromMonthKey, monthEndDate, lastBusinessDayOfMonth, isoLocalDate, localDateFromIso, shortDate, dateWithMonthLabel, transactions: () => transactionsForTest });",
  ].join("\n"), sandbox);
  return sandbox.engine;
}

test("oro: el módulo reproduce campo a campo lo que fechaba app.js antes de la extracción", () => {
  const engines = { "sin movimientos": loadEngine([]), "con movimientos": loadEngine(buildTransactions()) };
  assert.equal(golden.cases.length, 493);
  for (const item of golden.cases) {
    const result = JSON.parse(JSON.stringify(engines[item.scenario][item.fn](...item.args)));
    assert.deepEqual(result, item.out, `${item.fn} · ${item.scenario} · ${JSON.stringify(item.args)}`);
  }
});

test("el oro cubre todas las reglas, con y sin movimientos", () => {
  const sources = new Set(golden.cases.map((item) => `${item.scenario}|${item.out.source}`));
  for (const scenario of ["sin movimientos", "con movimientos"]) {
    for (const source of ["regla local", "regla salario Tere", "regla nómina Javi", "regla bonus Javi", "regla bono diciembre", "regla gasto fin de mes", "estimación alisada 1-15"]) {
      assert.ok(sources.has(`${scenario}|${source}`), `${scenario}: falta «${source}»`);
    }
  }
  assert.ok(sources.has("con movimientos|movimiento real identificado"), "falta el emparejamiento con un movimiento real");
});

test("un movimiento real casado fecha el gasto el día en que ocurrió; si no casa, día 8", () => {
  const engine = loadEngine([
    { month: "2026-10", date: "2026-10-03", amount: -45.9, movement: "IBERDROLA LUZ", details: "", category: "" },
    { month: "2026-10", date: "2026-10-20", amount: -12, movement: "COMPRA SUPER", details: "", category: "" },
  ]);
  const luz = engine.expenseTimingForRow({ label: "Luz Iberdrola" }, { key: "2026-10" }, -45.9);
  assert.equal(luz.day, 3);
  assert.equal(luz.confidence, "observed");
  const gimnasio = engine.expenseTimingForRow({ label: "Gimnasio" }, { key: "2026-10" }, -30);
  assert.equal(gimnasio.day, 8);
  assert.equal(gimnasio.confidence, "estimated");
  const trastero = engine.expenseTimingForRow({ label: "Trastero" }, { key: "2026-02" }, -60);
  assert.deepEqual([trastero.day, trastero.endOfMonth], [28, true]);
});

test("los movimientos se leen en cada llamada: importar un extracto cambia la fecha sin recrear el motor", () => {
  const transactions = [];
  const engine = loadEngine(transactions);
  assert.equal(engine.expenseTimingForRow({ label: "Seguro hogar" }, { key: "2026-11" }, -300).day, 8);
  transactions.push({ month: "2026-11", date: "2026-11-14", amount: -300, movement: "SEGURO HOGAR", details: "", category: "" });
  assert.equal(engine.expenseTimingForRow({ label: "Seguro hogar" }, { key: "2026-11" }, -300).day, 14);
});

test("el módulo es puro: sin DOM, sin estado global de la app", () => {
  const source = read("canonical-timing.js");
  assert.doesNotMatch(source, /\bwindow\b|\bdocument\b|\bbaseData\b|\blocalStorage\b|\bstate\./);
});

test("app.js delega en el módulo y ya no contiene las reglas", () => {
  for (const name of ["incomeTimingForRow", "isEndOfMonthExpenseRow", "expenseTimingFromMovements", "expenseTimingForRow"]) {
    assert.match(app, new RegExp(`function ${name}\\(([^)]*)\\) \\{ return timingEngine\\(\\)\\.${name}\\(\\1\\); \\}`), name);
  }
  for (const gone of ["function incomeTimingFromMovements", "function isMainPayrollIncomeRow", "regla salario Tere", "regla gasto fin de mes", "estimación alisada 1-15"]) {
    assert.ok(!app.includes(gone), `app.js aún contiene «${gone}»`);
  }
  assert.match(app, /timingEngineInstance \|\|= window\.FinanceCanonicalTiming\.createTimingEngine\(\{ displayLabelForRow, normalizedText, dateFromMonthKey, monthEndDate, lastBusinessDayOfMonth, isoLocalDate, localDateFromIso, shortDate, dateWithMonthLabel, transactions: \(\) => baseData\?\.transactions \|\| \[\], chargeDay: chargeDayForRow \}\)/);
});

test("registro: el módulo carga antes que app.js y está en la caché offline y en el sitio publicado", () => {
  const html = read("index.html");
  const at = html.indexOf('<script defer src="canonical-timing.js?v=');
  assert.ok(at > 0 && at < html.indexOf('<script defer src="app.js?v='));
  assert.match(read("service-worker.js"), /"\.\/canonical-timing\.js",/);
  assert.match(read("tools/build-public-site.mjs"), /"canonical-timing\.js",/);
});
