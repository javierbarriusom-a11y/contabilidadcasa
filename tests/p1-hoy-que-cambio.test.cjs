const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const app = read("app.js");
const html = read("index.html");

// P1 (Horizonte 1, sesión 199): «qué cambió desde la última vez» en Hoy. Sin motor nuevo — trae a
// Hoy lo que ya calculaba PVX5 (causalTreeForMonth/previsionChangeOneLiner) y PVC6/PVC18
// (diffAssumptionSnapshots + causas), hoy solo visibles entrando a Ajustes. "La última vez" es el
// cierre firmado más reciente con snapshot guardado, sin selector manual.

function extractFunction(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `No existe la función ${name} en app.js`);
  const parenStart = app.indexOf("(", start);
  let parenDepth = 0;
  let bodyStart = -1;
  for (let index = parenStart; index < app.length; index += 1) {
    if (app[index] === "(") parenDepth += 1;
    else if (app[index] === ")") {
      parenDepth -= 1;
      if (parenDepth === 0) { bodyStart = app.indexOf("{", index); break; }
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
  const context = { escapeHtml: (v) => String(v ?? ""), ...extra };
  vm.createContext(context);
  names.forEach((name) => vm.runInContext(extractFunction(name), context));
  return context;
}

function panelSandbox({ engine, forecast, history = [], snapshot, diaryEntries = [] } = {}) {
  const elements = {
    homeForecastChangeCard: { hidden: false },
    homeForecastChangeOneLiner: { textContent: "" },
    homeForecastChangeDiff: { innerHTML: "" },
  };
  const calls = {};
  const context = sandboxWith(["renderHomeForecastChangePanel"], {
    qs: (id) => elements[id] || null,
    canonicalScenarioResults: { base: { forecast } },
    window: { FinanceCanonicalForecast: engine },
    reconciledMonthlyNetHistory: () => history,
    loadPv5Diary: () => diaryEntries,
    loadPvc6ForecastSnapshots: () => (snapshot ? [snapshot] : []),
    pvc18ChangeCauses: (...args) => { calls.pvc18ChangeCauses = args; return ["supuesto-editado"]; },
    pvc6DiffResultHtml: (...args) => { calls.pvc6DiffResultHtml = args; return "<p>diff html</p>"; },
  });
  return { context, elements, calls };
}

function stubEngine(overrides = {}) {
  return {
    causalTreeForMonth: (monthKey, opts) => ({ monthKey, opts }),
    detectStructuralChange: (history) => ({ isStructural: true, direction: "up", requiredConsecutiveMonths: 3, history }),
    previsionChangeOneLiner: (tree, structuralChange) => `oneliner:${tree.monthKey}:${structuralChange.direction}`,
    diffAssumptionSnapshots: (previous, current) => ({ calculable: true, changed: [], unchangedCount: 2, previous, current }),
    ...overrides,
  };
}

// --- Sin previsión calculable -----------------------------------------------------------------

test("renderHomeForecastChangePanel · sin motor o sin previsión, oculta la tarjeta y no toca nada más", () => {
  const { context, elements } = panelSandbox({ engine: null, forecast: { assumptions: {} } });
  context.renderHomeForecastChangePanel();
  assert.equal(elements.homeForecastChangeCard.hidden, true);
  assert.equal(elements.homeForecastChangeOneLiner.textContent, "");

  const { context: context2, elements: elements2 } = panelSandbox({ engine: stubEngine(), forecast: null });
  context2.renderHomeForecastChangePanel();
  assert.equal(elements2.homeForecastChangeCard.hidden, true);
});

// --- Frase de causalTreeForMonth/previsionChangeOneLiner (PVX5) ------------------------------

test("renderHomeForecastChangePanel · sin meses conciliados, lo dice en vez de fingir un cambio estructural", () => {
  const { context, elements } = panelSandbox({ engine: stubEngine(), forecast: { assumptions: {}, series: [] }, history: [] });
  context.renderHomeForecastChangePanel();
  assert.equal(elements.homeForecastChangeCard.hidden, false);
  assert.match(elements.homeForecastChangeOneLiner.textContent, /Todavía no hay meses conciliados/);
});

test("renderHomeForecastChangePanel · con historial, usa el mes conciliado más reciente (no el primero de la lista)", () => {
  const calls = { causalTreeForMonth: [], detectStructuralChange: [] };
  const engine = stubEngine({
    causalTreeForMonth: (monthKey, opts) => { calls.causalTreeForMonth.push([monthKey, opts]); return { monthKey, opts }; },
    detectStructuralChange: (history) => { calls.detectStructuralChange.push(history); return { isStructural: true, direction: "down", requiredConsecutiveMonths: 2 }; },
  });
  const forecast = { assumptions: {}, series: [{ monthKey: "2026-06" }, { monthKey: "2026-07" }, { monthKey: "2026-08" }] };
  const history = [{ monthKey: "2026-06" }, { monthKey: "2026-08" }, { monthKey: "2026-07" }];
  const diaryEntries = [{ conceptId: "monthly-net", monthKey: "2026-08" }];
  const { context, elements } = panelSandbox({ engine, forecast, history, diaryEntries });
  context.renderHomeForecastChangePanel();
  assert.equal(calls.causalTreeForMonth.length, 1);
  const [monthKey, opts] = calls.causalTreeForMonth[0];
  assert.equal(monthKey, "2026-08"); // el más reciente por monthKey, no el primero del array
  assert.equal(opts.series, forecast.series);
  assert.equal(opts.diary, diaryEntries);
  assert.deepEqual(calls.detectStructuralChange[0], history);
  assert.equal(elements.homeForecastChangeOneLiner.textContent, "oneliner:2026-08:down");
});

// --- Comparación de supuestos (PVC6/PVC18) ---------------------------------------------------

test("renderHomeForecastChangePanel · sin ningún cierre firmado con snapshot, lo dice en vez de comparar nada", () => {
  const { context, elements } = panelSandbox({
    engine: stubEngine(), forecast: { assumptions: {}, series: [] }, history: [], snapshot: undefined,
  });
  context.renderHomeForecastChangePanel();
  assert.match(elements.homeForecastChangeDiff.innerHTML, /Todavía no hay ningún cierre firmado/);
});

test("renderHomeForecastChangePanel · con snapshot, compara contra el último cierre firmado y reutiliza pvc18ChangeCauses/pvc6DiffResultHtml", () => {
  const currentAssumptions = { items: [{ id: "a", value: 2 }] };
  const forecast = { assumptions: currentAssumptions, series: [] };
  const snapshot = { monthKey: "2026-07", closedAt: "2026-08-01T00:00:00.000Z", assumptions: { items: [{ id: "a", value: 1 }] } };
  const { context, elements, calls } = panelSandbox({ engine: stubEngine(), forecast, history: [], snapshot });
  context.renderHomeForecastChangePanel();
  assert.equal(elements.homeForecastChangeDiff.innerHTML, "<p>diff html</p>");
  const [causesResult, closedAt] = calls.pvc18ChangeCauses;
  assert.equal(closedAt, snapshot.closedAt);
  assert.equal(causesResult.calculable, true);
  assert.equal(causesResult.previous, snapshot.assumptions);
  assert.equal(causesResult.current, currentAssumptions);
  const [htmlResult, htmlCauses] = calls.pvc6DiffResultHtml;
  assert.equal(htmlResult, causesResult);
  assert.deepEqual(htmlCauses, ["supuesto-editado"]);
});

// --- Cableado en renderHomeDashboard() y en el documento -------------------------------------

test("renderHomeDashboard llama a renderHomeForecastChangePanel junto al resto de tarjetas de detalle", () => {
  const source = extractFunction("renderHomeDashboard");
  assert.match(source, /renderHomeHealthScoreTrend\(\);\s*renderHomeForecastChangePanel\(\);/);
});

test("la tarjeta vive en #home, dentro de .home-secondary-section, oculta por defecto", () => {
  const openTag = /<section[^>]*id="home"[^>]*>/.exec(html);
  assert.ok(openTag, "No existe la sección #home");
  const start = openTag.index + openTag[0].length;
  const end = html.indexOf("<section", start);
  const home = html.slice(start, end);
  const secondaryStart = home.indexOf('<div class="home-secondary-section">');
  assert.ok(secondaryStart >= 0, "No existe .home-secondary-section");
  const secondary = home.slice(secondaryStart);
  assert.match(secondary, /id="homeForecastChangeCard" hidden/);
  assert.match(secondary, /id="homeForecastChangeOneLiner"/);
  assert.match(secondary, /id="homeForecastChangeDiff"/);
  assert.match(secondary, /Qué cambió desde la última vez/);
});
