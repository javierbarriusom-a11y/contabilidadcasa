const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const app = read("app.js");
const view = read("views/reconciliation.js");

// ARQ-4 (BACKLOG_CONTABILIDADCASA_3_0.md §2.2, continúa T14): «Conciliación» (`#reconciliation`)
// pasa a views/reconciliation.js con carga diferida. T14 la había dado por bloqueada de forma
// permanente porque renderReconciliation() se llamaba sin guarda desde cerrar/reabrir mes, que
// también se disparan desde #conciliar — tras moverla, esa llamada habría lanzado un ReferenceError
// sin haber visitado antes la pantalla. Lo que la desbloquea es refreshReconciliationView() (app.js):
// pinta solo con la pantalla abierta y su fichero cargado y, si no, conserva los efectos de estado.

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `No existe la función ${name}`);
  const bodyStart = source.indexOf("{", source.indexOf(")", start));
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    else if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`La función ${name} no cierra sus llaves`);
}

const MOVED = [
  "renderReconciliation",
  "renderLedgerInvariant",
  "renderCanonicalEngineStatus",
  "renderCanonicalDailyEngineStatus",
  "renderCanonicalCommitBarrierStatus",
];

test("ARQ-4 · las funciones de la pantalla viven en views/reconciliation.js y ya no en app.js", () => {
  MOVED.forEach((name) => {
    assert.ok(!app.includes(`function ${name}(`), `${name} sigue definida en app.js`);
    assert.ok(view.includes(`function ${name}(`), `${name} falta en views/reconciliation.js`);
  });
  assert.ok(view.includes("const ledgerStatusLabels = {"));
  // Compartidas con Hoy/Análisis/Cierre/Deuda/Presupuesto: se quedan en app.js.
  ["ledgerMonthLabel", "ledgerDifferenceTotal", "downloadCanonicalLedger", "refreshCanonicalLedger"].forEach((name) => {
    assert.ok(app.includes(`function ${name}(`), `${name} debe seguir en app.js`);
    assert.ok(!view.includes(`function ${name}(`), `${name} no debe duplicarse en la vista`);
  });
});

test("ARQ-4 · la pantalla está registrada como vista diferida, en el build publicado y en la caché offline", () => {
  assert.match(app, /reconciliation: \{ src: "views\/reconciliation\.js\?v=[^"]+", rootId: "reconciliation" \}/);
  assert.match(read("tools/build-public-site.mjs"), /"views\/reconciliation\.js"/);
  assert.match(read("service-worker.js"), /"\.\/views\/reconciliation\.js"/);
  assert.match(read("index.html"), /<section class="reconciliation view-section" id="reconciliation">/);
});

test("ARQ-4 · app.js nunca llama a renderReconciliation() sin garantizar que su fichero está cargado", () => {
  const calls = [...app.matchAll(/renderReconciliation\(\)/g)].map((match) => {
    const lineStart = app.lastIndexOf("\n", match.index) + 1;
    const lineEnd = app.indexOf("\n", match.index);
    return { index: match.index, line: app.slice(lineStart, lineEnd) };
  });
  const bridge = extractFunction(app, "refreshReconciliationView");
  const bridgeStart = app.indexOf(bridge);
  const activeSection = extractFunction(app, "renderActiveSection");
  const activeStart = app.indexOf(activeSection);
  calls.forEach(({ index, line }) => {
    if (line.trim().startsWith("//")) return;
    const insideBridge = index > bridgeStart && index < bridgeStart + bridge.length;
    const insideActiveSection = index > activeStart && index < activeStart + activeSection.length
      && /case "reconciliation":\s*\n\s*renderReconciliation\(\);/.test(app.slice(index - 60, index + 30));
    const guardedInline = /viewChunkLoaded\("reconciliation"\)\) renderReconciliation\(\)/.test(line);
    assert.ok(insideBridge || insideActiveSection || guardedInline, `Llamada sin guarda a renderReconciliation(): ${line.trim()}`);
  });
  // Los llamadores que antes pintaban a ciegas pasan por el puente.
  ["async function closeCurrentMonthTransaction(", "async function reopenLatestMonthTransaction("].forEach((signature) => {
    const start = app.indexOf(signature);
    assert.ok(start >= 0, `Falta ${signature}`);
    const body = app.slice(start, app.indexOf("\n}\n", start));
    assert.match(body, /refreshReconciliationView\(\);/);
  });
});

function bridgeSandbox({ view: currentView, loaded, ledgerSnapshot = { ok: true } }) {
  const calls = [];
  const context = {
    window: { FinanceCanonicalLedger: {}, FinanceCanonicalCommitBarrier: {} },
    viewFromHash: () => currentView,
    viewChunkLoaded: (id) => id === "reconciliation" && loaded,
    refreshCanonicalLedger: (reason) => { calls.push(`ledger:${reason}`); return ledgerSnapshot; },
    evaluateCanonicalCommitBarrier: (context) => { calls.push(`barrier:${context}`); return {}; },
  };
  // Con el fichero cargado, la función existe como global (script clásico); sin cargar, no existe.
  if (loaded) context.renderReconciliation = () => calls.push("render");
  vm.createContext(context);
  vm.runInContext(extractFunction(app, "refreshReconciliationView"), context);
  return { run: () => context.refreshReconciliationView(), calls };
}

test("ARQ-4 · cerrar el mes desde otra pantalla, sin haber cargado Conciliación, no lanza y conserva los efectos de estado", () => {
  const { run, calls } = bridgeSandbox({ view: "conciliar", loaded: false });
  assert.doesNotThrow(run);
  assert.deepEqual(calls, ["ledger:reconciliation-view", "barrier:reconciliation-view"]);
});

test("ARQ-4 · con Conciliación abierta pero su fichero todavía descargándose, tampoco lanza", () => {
  const { run, calls } = bridgeSandbox({ view: "reconciliation", loaded: false });
  assert.doesNotThrow(run);
  assert.deepEqual(calls, ["ledger:reconciliation-view", "barrier:reconciliation-view"]);
});

test("ARQ-4 · con Conciliación abierta y cargada, pinta la pantalla completa como antes", () => {
  const { run, calls } = bridgeSandbox({ view: "reconciliation", loaded: true });
  run();
  assert.deepEqual(calls, ["render"]);
});

test("ARQ-4 · sin libro conciliado no evalúa la barrera, igual que el retorno temprano de renderReconciliation()", () => {
  const { run, calls } = bridgeSandbox({ view: "home", loaded: true, ledgerSnapshot: null });
  run();
  assert.deepEqual(calls, ["ledger:reconciliation-view"]);
});
