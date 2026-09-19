const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const analisisSource = fs.readFileSync(path.join(root, "views/analisis.js"), "utf8");
const indexHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");
const buildScript = fs.readFileSync(path.join(root, "tools/build-public-site.mjs"), "utf8");
const GhostExpenseDetector = require(path.join(root, "canonical-ghost-expense-detector.js"));

// P8 (BACKLOG_CONTABILIDADCASA_2_0.md): "gasto fantasma" — sobre lo que ya detecta A16-3
// (detectRecurringSubscriptions), sin repetir esa detección: solo vincula grupos del mismo concepto
// con precio distinto y meses que no se solapan para ver si el más reciente subió frente al más
// antiguo.

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

function sandboxWith(names, extra = {}) {
  const context = { ...extra };
  vm.createContext(context);
  names.forEach((name) => vm.runInContext(extractFunction(name), context));
  return context;
}

function baseHelpers(extra = {}) {
  return {
    money: (value, precise) => `${Number(value || 0).toFixed(precise ? 2 : 0)} €`,
    escapeHtml: (value) => String(value ?? ""),
    ledgerMonthLabel: (key) => `MES-${key}`,
    ...extra,
  };
}

// --- canonical-ghost-expense-detector.js (motor) -------------------------------------------------

test("ghostExpenseCandidates · con un único precio por concepto, ningún candidato", () => {
  const result = GhostExpenseDetector.ghostExpenseCandidates([
    { pattern: "netflix", label: "Netflix", category: "Ocio", monthlyCost: 12.99, monthsSeen: ["2026-01", "2026-02", "2026-03"] },
  ]);
  assert.deepEqual(result.candidates, []);
});

test("ghostExpenseCandidates · dos precios sin solape y con subida real, un candidato con las cifras correctas", () => {
  const result = GhostExpenseDetector.ghostExpenseCandidates([
    { pattern: "netflix", label: "Netflix", category: "Ocio", monthlyCost: 12.99, monthsSeen: ["2025-10", "2025-11", "2025-12"] },
    { pattern: "netflix", label: "Netflix", category: "Ocio", monthlyCost: 15.99, monthsSeen: ["2026-01", "2026-02", "2026-03"] },
  ]);
  assert.equal(result.candidates.length, 1);
  const [candidate] = result.candidates;
  assert.equal(candidate.pattern, "netflix");
  assert.equal(candidate.fromAmount, 12.99);
  assert.equal(candidate.toAmount, 15.99);
  assert.equal(candidate.increaseAmount, 3);
  assert.equal(candidate.increasePct, 23.09);
  assert.equal(candidate.increaseAnnualAmount, 36);
  assert.equal(candidate.sinceMonth, "2026-01");
  assert.equal(candidate.priceStepsSeen, 2);
});

test("ghostExpenseCandidates · el precio bajó (o se mantuvo), no es gasto fantasma", () => {
  const result = GhostExpenseDetector.ghostExpenseCandidates([
    { pattern: "gimnasio", label: "Gimnasio", monthlyCost: 40, monthsSeen: ["2025-10", "2025-11", "2025-12"] },
    { pattern: "gimnasio", label: "Gimnasio", monthlyCost: 35, monthsSeen: ["2026-01", "2026-02", "2026-03"] },
  ]);
  assert.deepEqual(result.candidates, []);
});

test("ghostExpenseCandidates · meses solapados entre los dos precios, no se etiqueta (podrían ser dos suscripciones distintas)", () => {
  const result = GhostExpenseDetector.ghostExpenseCandidates([
    { pattern: "spotify", label: "Spotify", monthlyCost: 9.99, monthsSeen: ["2025-11", "2025-12", "2026-01"] },
    { pattern: "spotify", label: "Spotify", monthlyCost: 12.99, monthsSeen: ["2026-01", "2026-02", "2026-03"] },
  ]);
  assert.deepEqual(result.candidates, []);
});

test("ghostExpenseCandidates · una subida pequeña por debajo del umbral no se avisa", () => {
  const result = GhostExpenseDetector.ghostExpenseCandidates([
    { pattern: "seguro", label: "Seguro", monthlyCost: 100, monthsSeen: ["2025-10", "2025-11", "2025-12"] },
    { pattern: "seguro", label: "Seguro", monthlyCost: 101, monthsSeen: ["2026-01", "2026-02", "2026-03"] },
  ], { minIncreasePct: 5 });
  assert.deepEqual(result.candidates, []);
});

test("ghostExpenseCandidates · con tres precios seguidos, compara el más antiguo con el más reciente", () => {
  const result = GhostExpenseDetector.ghostExpenseCandidates([
    { pattern: "netflix", label: "Netflix", monthlyCost: 10, monthsSeen: ["2025-01", "2025-02", "2025-03"] },
    { pattern: "netflix", label: "Netflix", monthlyCost: 12, monthsSeen: ["2025-07", "2025-08", "2025-09"] },
    { pattern: "netflix", label: "Netflix", monthlyCost: 15, monthsSeen: ["2026-01", "2026-02", "2026-03"] },
  ]);
  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0].fromAmount, 10);
  assert.equal(result.candidates[0].toAmount, 15);
  assert.equal(result.candidates[0].priceStepsSeen, 3);
});

test("ghostExpenseCandidates · varios conceptos, ordenados por subida anual de mayor a menor", () => {
  const result = GhostExpenseDetector.ghostExpenseCandidates([
    { pattern: "netflix", label: "Netflix", monthlyCost: 10, monthsSeen: ["2025-01", "2025-02", "2025-03"] },
    { pattern: "netflix", label: "Netflix", monthlyCost: 12, monthsSeen: ["2026-01", "2026-02", "2026-03"] },
    { pattern: "gimnasio", label: "Gimnasio", monthlyCost: 40, monthsSeen: ["2025-01", "2025-02", "2025-03"] },
    { pattern: "gimnasio", label: "Gimnasio", monthlyCost: 60, monthsSeen: ["2026-01", "2026-02", "2026-03"] },
  ]);
  assert.equal(result.candidates.length, 2);
  assert.equal(result.candidates[0].pattern, "gimnasio");
  assert.equal(result.candidates[1].pattern, "netflix");
});

// --- ghostExpenseCandidatesResult (app.js) ---------------------------------------------------

test("ghostExpenseCandidatesResult · sin motores disponibles, devuelve null en vez de fallar", () => {
  const context = sandboxWith(["ghostExpenseCandidatesResult"], baseHelpers({
    window: {},
    baseData: { transactions: [] },
    movementMappingKey: () => "x",
    movementDisplayName: () => "X",
  }));
  assert.equal(context.ghostExpenseCandidatesResult(), null);
});

test("ghostExpenseCandidatesResult · filtra solo gastos y arma el mismo shape que analisisSubscriptionsResult antes de llamar al detector", () => {
  const capturedMovements = [];
  const context = sandboxWith(["ghostExpenseCandidatesResult"], baseHelpers({
    baseData: {
      transactions: [
        { amount: -10, category: "Ocio", date: "2026-03-01" },
        { amount: 500, category: "Nómina", date: "2026-03-01" },
      ],
    },
    movementMappingKey: (row) => `key-${row.amount}`,
    movementDisplayName: (row) => `label-${row.amount}`,
    window: {
      FinanceCanonicalForecast: {
        detectRecurringSubscriptions: (movements) => {
          capturedMovements.push(...movements);
          return { detected: [{ pattern: "key--10" }] };
        },
      },
      FinanceCanonicalGhostExpenseDetector: {
        ghostExpenseCandidates: (subscriptions) => ({ candidates: subscriptions }),
      },
    },
  }));
  const result = context.ghostExpenseCandidatesResult();
  assert.equal(capturedMovements.length, 1);
  assert.equal(capturedMovements[0].pattern, "key--10");
  assert.equal(capturedMovements[0].label, "label--10");
  assert.equal(Array.from(result.candidates).length, 1);
});

// --- decisionInboxItems (app.js) — sexta fuente ----------------------------------------------

test("wiring: decisionInboxItems añade el gasto fantasma como sexta fuente cuando hay candidatos", () => {
  assert.match(app, /const ghostExpenses = ghostExpenseCandidatesResult\(\);/);
  assert.match(app, /id: "decision-inbox-ghost-expense"/);
  assert.match(app, /source: "Gasto fantasma"/);
  assert.match(app, /target: "analisis"/);
});

// --- Análisis: analisisGhostExpenseCandidates / analisisGhostExpenseNote ----------------------

test("analisisGhostExpenseCandidates · sin resultado de suscripciones, lista vacía", () => {
  const start = analisisSource.indexOf("function analisisGhostExpenseCandidates");
  const end = analisisSource.indexOf("\n}", start) + 2;
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(analisisSource.slice(start, end), context);
  assert.deepEqual(Array.from(context.analisisGhostExpenseCandidates(null)), []);
});

test("analisisGhostExpenseNote · sin candidatos, cadena vacía (nunca una lista vacía visible)", () => {
  const start = analisisSource.indexOf("function analisisGhostExpenseNote");
  const end = analisisSource.indexOf("\n}", start) + 2;
  const context = baseHelpers();
  vm.createContext(context);
  vm.runInContext(analisisSource.slice(start, end), context);
  assert.equal(context.analisisGhostExpenseNote([]), "");
});

test("analisisGhostExpenseNote · con candidatos, lista cada uno con su subida", () => {
  const start = analisisSource.indexOf("function analisisGhostExpenseNote");
  const end = analisisSource.indexOf("\n}", start) + 2;
  const context = baseHelpers();
  vm.createContext(context);
  vm.runInContext(analisisSource.slice(start, end), context);
  const html = context.analisisGhostExpenseNote([
    { label: "Netflix", fromAmount: 12.99, toAmount: 15.99, increasePct: 23.09, increaseAnnualAmount: 36, sinceMonth: "2026-01" },
  ]);
  assert.match(html, /Netflix/);
  assert.match(html, /12\.99 €/);
  assert.match(html, /15\.99 €/);
  assert.match(html, /\+23\.09%/);
  assert.match(html, /MES-2026-01/);
});

test("wiring: renderAnalisis calcula el resultado de suscripciones una vez y lo reutiliza para el aviso de gasto fantasma", () => {
  const start = analisisSource.indexOf("const subscriptionsResult = analisisSubscriptionsResult(");
  assert.ok(start >= 0, "debe reutilizar subscriptionsResult en vez de recalcular A16-3");
  const block = analisisSource.slice(start, start + 700);
  assert.match(block, /analisisGhostExpenseCandidates\(subscriptionsResult\)/);
  assert.match(block, /qs\("analisisGhostExpenseNote"\)/);
});

// --- wiring general: index.html / build whitelist ----------------------------------------------

test("wiring: index.html registra canonical-ghost-expense-detector.js y el hueco del aviso en Análisis", () => {
  assert.match(indexHtml, /canonical-ghost-expense-detector\.js\?v=/);
  assert.match(indexHtml, /id="analisisGhostExpenseNote"/);
  const subscriptionsIdx = indexHtml.indexOf('id="analisisSubscriptions"');
  const noteIdx = indexHtml.indexOf('id="analisisGhostExpenseNote"');
  assert.ok(subscriptionsIdx > 0 && noteIdx > subscriptionsIdx && noteIdx - subscriptionsIdx < 200, "el aviso debe vivir junto a la lista de suscripciones");
});

test("wiring: canonical-ghost-expense-detector.js está en la whitelist del sitio público", () => {
  assert.match(buildScript, /"canonical-ghost-expense-detector\.js"/);
});
