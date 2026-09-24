const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const app = read("app.js");
const view = read("views/savings-agent.js");
const index = read("index.html");

// ARQ-4 (BACKLOG_CONTABILIDADCASA_3_0.md §2.2, tercer incremento, sesión 237): «Agente de ahorro»
// (`#savings-agent`) pasa a views/savings-agent.js con carga diferida. T14 la había dado por
// bloqueada porque applyAgentRouteSimulation() — disparable desde Hoy y desde otras cuatro pantallas —
// llamaba a renderSavingsAgent() sin guarda. Estos tests protegen la guarda y el reparto: la pantalla
// en la vista, el motor compartido en app.js y su núcleo puro en canonical-savings-agent.js.

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `No existe la función ${name}`);
  const bodyStart = source.indexOf("{", source.indexOf(") {", start));
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
  "renderSavingsAgent",
  "agentYears",
  "populateAgentYearSelect",
  "agentRowsForYear",
  "agentInsightCards",
  "agentTodayCards",
  "renderAgentToday",
  "renderAgentQuarterPlan",
  "agentPriorityQueue",
  "renderAgentPriorityQueue",
  "renderAgentDecisionBoard",
  "renderAgentExecutive",
  "renderAgentDebtOptimizerControls",
  "renderAgentRouteSimulationPanel",
  "renderAgentDebtOptimization",
  "renderAgentPlanSummary",
  "renderAgentRecommendationCard",
  "renderAgentTable",
];

// Motor y ajustes que leen Hoy y otras pantallas: se quedan en app.js.
const SHARED = [
  "buildSavingsAgentPlan",
  "agentVisibleRows",
  "immediateSavingsTransfer",
  "agentDebtRecommendations",
  "agentOptimalDebtPayoffPlan",
  "cachedAgentDebtOptimization",
  "emptyAgentDebtOptimization",
  "agentLifeProjectRecommendations",
  "agentPlanSummary",
  "agentTwelveMonthCapacity",
  "applyAgentRouteSimulation",
  "clearAgentRouteSimulation",
  "prepareAgentDebtDecision",
  "prepareAgentProjectDecision",
  "agentCaixaFloor",
  "executiveToneForAmount",
  "renderProjectSavingsProgress",
  "routeSimulationSummaryFromActive",
];

const strip = (source) => source.split("\n").filter((line) => !line.trim().startsWith("//")).join("\n");

test("ARQ-4 · las funciones de la pantalla viven en views/savings-agent.js; el motor compartido, en app.js", () => {
  MOVED.forEach((name) => {
    assert.ok(!app.includes(`function ${name}(`), `${name} sigue definida en app.js`);
    assert.ok(view.includes(`function ${name}(`), `${name} falta en views/savings-agent.js`);
  });
  SHARED.forEach((name) => {
    assert.ok(app.includes(`function ${name}(`), `${name} debe seguir en app.js`);
    assert.ok(!view.includes(`function ${name}(`), `${name} no debe duplicarse en la vista`);
  });
});

test("ARQ-4 · ninguna función movida se usa desde app.js ni desde otra vista, salvo renderSavingsAgent con guarda", () => {
  const others = fs.readdirSync(path.join(root, "views"))
    .filter((name) => name.endsWith(".js") && name !== "savings-agent.js")
    .map((name) => [name, strip(read(`views/${name}`))]);
  MOVED.filter((name) => name !== "renderSavingsAgent").forEach((name) => {
    const pattern = new RegExp(`\\b${name}\\b`);
    assert.doesNotMatch(strip(app), pattern, `app.js usa ${name}, que ahora vive en una vista diferida`);
    others.forEach(([file, source]) => assert.doesNotMatch(source, pattern, `${file} usa ${name}`));
  });
  others.forEach(([file, source]) => assert.doesNotMatch(source, /\brenderSavingsAgent\b/, `${file} llama a renderSavingsAgent`));
});

test("ARQ-4 · app.js nunca llama a renderSavingsAgent() sin garantizar que su fichero está cargado", () => {
  const lines = strip(app).split("\n");
  const calls = lines.map((line, index) => ({ line, prev: lines[index - 1] || "" })).filter(({ line }) => /\brenderSavingsAgent\b/.test(line));
  assert.ok(calls.length >= 6);
  calls.forEach(({ line, prev }) => {
    const guarded = /if \(viewChunkLoaded\("savings-agent"\)\) renderSavingsAgent\(\);/.test(line);
    const activeSection = /^\s*renderSavingsAgent\(\);$/.test(line) && /case "savings-agent":/.test(prev);
    const heavyRefresh = /else if \(viewId === "savings-agent"\) renderSavingsAgent\(\{ forceHeavy: true \}\);/.test(line);
    // Control de su propia sección; flecha para no leer el global al cablear en init().
    const ownControl = /qs\("agentYear"\)\?\.addEventListener\("change", \(\) => renderSavingsAgent\(\)\);/.test(line);
    assert.ok(guarded || activeSection || heavyRefresh || ownControl, `Llamada sin guarda a renderSavingsAgent(): ${line.trim()}`);
  });
  ["applyAgentRouteSimulation", "handleAgentCaixaFloorChange", "saveAgentDebtOptimizerSettingsFromForm"].forEach((name) => {
    assert.match(extractFunction(app, name), /if \(viewChunkLoaded\("savings-agent"\)\) renderSavingsAgent\(\);/, `${name} debe llevar la guarda`);
  });
});

test("ARQ-4 · todos los nodos que pinta la vista viven dentro de su sección", () => {
  const start = index.indexOf('<section class="savings-agent view-section" id="savings-agent">');
  assert.ok(start >= 0, "Falta la sección savings-agent en index.html");
  const section = index.slice(start, index.indexOf('id="virtual-advisor"', start));
  const targets = [...new Set([...view.matchAll(/qs\("([A-Za-z0-9]+)"\)/g)].map((match) => match[1]))];
  assert.ok(targets.length >= 10);
  // #agentPriorityQueue no existe en index.html (ni dentro ni fuera de la sección): renderAgentPriorityQueue()
  // sale en su primera línea y no pinta nada. Ya era así antes de ARQ-4; queda anotado en PROJECT_STATE.md
  // (sesión 237) en vez de borrarlo sin decisión. Si algún día se añade el nodo, debe ir dentro de la sección.
  const DEAD_TARGETS = new Set(["agentPriorityQueue"]);
  targets.forEach((id) => {
    if (DEAD_TARGETS.has(id)) {
      assert.doesNotMatch(index.slice(0, start) + index.slice(start + section.length), new RegExp(`id="${id}"`), `#${id} apareció fuera de savings-agent`);
      return;
    }
    assert.match(section, new RegExp(`id="${id}"`), `#${id} no está dentro de savings-agent`);
  });
});

test("ARQ-4 · la pantalla está registrada como vista diferida, en el build publicado y en la caché offline", () => {
  assert.match(app, /"savings-agent": \{ src: "views\/savings-agent\.js\?v=[^"]+", rootId: "savings-agent" \}/);
  assert.match(read("tools/build-public-site.mjs"), /"views\/savings-agent\.js"/);
  assert.match(read("service-worker.js"), /"\.\/views\/savings-agent\.js"/);
  assert.match(app, /case "savings-agent":\s*\n\s*renderSavingsAgent\(\);/);
});

test("ARQ-4 · «simular ruta» desde Hoy sin nada que aplicar y sin la pantalla cargada no lanza", () => {
  const calls = [];
  const context = {
    clearAgentRouteSimulation: () => calls.push("clear"),
    recomputeModelIfNeeded: () => calls.push("recompute"),
    agentOptimalDebtPayoffPlan: () => ({ steps: [] }),
    viewChunkLoaded: () => false,
    savingsAgentPlanCache: null,
    agentDebtOptimizationCache: null,
  };
  vm.createContext(context);
  vm.runInContext(extractFunction(app, "applyAgentRouteSimulation"), context);
  let result;
  assert.doesNotThrow(() => { result = context.applyAgentRouteSimulation(); });
  assert.equal(result, 0);
  assert.deepEqual(calls, ["clear", "recompute"]);
});
