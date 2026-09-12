const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const ui = read("p2-ui.js");
const E16 = require("../canonical-e16-monitoring.js");
const E9Assistant = require("../canonical-e9-assistant.js");
const RecommendationCitation = require("../canonical-recommendation-citation.js");
const Portfolio = require("../canonical-portfolio.js");

// GOB17 (Oleada 4, Bloque 7 — bandera del diagnóstico, VER-5 sesión 166b): el asistente cita hoy
// solo un id de categoría (`alert:cash-2026-10`, `metric:idle-cash`) que no identifica el archivo o
// función `canonical-*.js` real que sustenta el dato. `validateResponse()`
// (canonical-e9-assistant.js) exige `citations`, pero `sourceCatalog()` no llevaba `source`/`method`
// más que en las métricas — nunca en alertas o decisiones — y ni CP1 ni CP2 rellenaban esos campos.
// Esta tarea: (1) sourceCatalog() propaga source/method también en alertas y decisiones; (2) CP1 y
// CP2 declaran la función real que los sustenta (predictiveAlerts en canonical-e16-monitoring.js;
// cushionFloor/opportunityCost en canonical-cushion.js/canonical-portfolio.js); (3) esa cita real se
// muestra al hogar, no solo el id interno.

test("sourceCatalog · las alertas propagan source/method cuando se declaran, no solo las métricas", () => {
  const sources = E9Assistant.sourceCatalog({
    alerts: [{ id: "cash-2026-10", label: "Caja prevista", source: "canonical-e16-monitoring.js", method: "predictiveAlerts()" }],
  });
  assert.equal(sources[0].id, "alert:cash-2026-10");
  assert.equal(sources[0].source, "canonical-e16-monitoring.js");
  assert.equal(sources[0].method, "predictiveAlerts()");
});

test("sourceCatalog · las decisiones también propagan source/method", () => {
  const sources = E9Assistant.sourceCatalog({
    decisions: [{ id: "d1", title: "Amortizar", source: "canonical-debt-comparator.js", method: "compareAmortizeVsInvest()" }],
  });
  assert.equal(sources[0].id, "decision:d1");
  assert.equal(sources[0].source, "canonical-debt-comparator.js");
  assert.equal(sources[0].method, "compareAmortizeVsInvest()");
});

test("sourceCatalog · sin declarar source/method, sigue sin inventar nada (cadena vacía, no 'unknown')", () => {
  const sources = E9Assistant.sourceCatalog({ alerts: [{ id: "x", label: "y" }] });
  assert.equal(sources[0].source, "");
  assert.equal(sources[0].method, "");
});

function extractFunction(name) {
  const start = ui.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `No existe la función ${name} en p2-ui.js`);
  const parenStart = ui.indexOf("(", start);
  let parenDepth = 0;
  let bodyStart = -1;
  for (let index = parenStart; index < ui.length; index += 1) {
    if (ui[index] === "(") parenDepth += 1;
    else if (ui[index] === ")") {
      parenDepth -= 1;
      if (parenDepth === 0) { bodyStart = ui.indexOf("{", index); break; }
    }
  }
  assert.ok(bodyStart >= 0, `No se encontró el cuerpo de ${name}`);
  let depth = 0;
  for (let index = bodyStart; index < ui.length; index += 1) {
    if (ui[index] === "{") depth += 1;
    else if (ui[index] === "}") {
      depth -= 1;
      if (depth === 0) return ui.slice(start, index + 1);
    }
  }
  throw new Error(`La función ${name} no cierra sus llaves`);
}

function extractConst(name) {
  const start = ui.indexOf(`const ${name} =`);
  assert.ok(start >= 0, `No existe la constante ${name} en p2-ui.js`);
  const end = ui.indexOf(";", start);
  return ui.slice(start, end + 1);
}

function cp1Sandbox() {
  const context = {
    root: { FinanceCanonicalE9Assistant: E9Assistant, FinanceCanonicalRecommendationCitation: RecommendationCitation },
    esc: (value) => String(value ?? ""),
  };
  vm.createContext(context);
  vm.runInContext(`const CP1_SEVERITY_RANK = ${JSON.stringify({ critical: 0, high: 1, medium: 2 })};`, context);
  vm.runInContext(`const CP1_ALERT_LABELS = ${JSON.stringify({ cash: "Revisar la caja prevista", variation: "Revisar la variación prevista", debt: "Revisar el ratio de deuda" })};`, context);
  vm.runInContext(extractConst("CP1_SOURCE"), context);
  vm.runInContext(extractConst("CP1_METHOD"), context);
  vm.runInContext(extractFunction("cp1NextBestAction"), context);
  vm.runInContext(extractFunction("rgx4TwoLevelExplanationHtml"), context);
  return context;
}

function forecastWith(liquidity) {
  return { series: [{ monthKey: "2026-10", confidence: "high", totals: { closingLiquidity: liquidity } }] };
}

test("cp1NextBestAction · cita la función real (predictiveAlerts, canonical-e16-monitoring.js), no solo el id", () => {
  const ctx = cp1Sandbox();
  const model = { alerts: E16.predictiveAlerts(forecastWith(-100), { minimumLiquidity: 500, maximumMonthlyVariation: 0, maximumDebtRatio: 100 }, { debtRatio: 0 }) };
  const action = ctx.cp1NextBestAction(model);
  assert.equal(action.citedSource, "canonical-e16-monitoring.js · predictiveAlerts()");
});

test("rgx4TwoLevelExplanationHtml · con citedSource, añade la línea 'Fuente real' además de la cita interna", () => {
  const ctx = cp1Sandbox();
  const html = ctx.rgx4TwoLevelExplanationHtml({ citations: ["alert:cash-2026-10"], citedSource: "canonical-e16-monitoring.js · predictiveAlerts()" });
  assert.match(html, /Fuente real: canonical-e16-monitoring\.js · predictiveAlerts\(\)/);
  assert.match(html, /Cita: alert:cash-2026-10/);
});

test("rgx4TwoLevelExplanationHtml · sin citedSource, no inventa ninguna línea de fuente (comportamiento previo intacto)", () => {
  const ctx = cp1Sandbox();
  const html = ctx.rgx4TwoLevelExplanationHtml({ citations: ["alert:debt-ratio"] });
  assert.doesNotMatch(html, /Fuente real/);
});

function cp2Sandbox(idleCash) {
  const context = {
    root: {
      FinanceCanonicalE9Assistant: E9Assistant,
      FinanceCanonicalRecommendationCitation: RecommendationCitation,
      FinanceP2Bridge: { idleCash: () => idleCash },
    },
    esc: (value) => String(value ?? ""),
    euro: (value) => `${Number(value || 0).toFixed(2)} €`,
  };
  vm.createContext(context);
  vm.runInContext("const bridge = () => root.FinanceP2Bridge;", context);
  vm.runInContext(extractConst("CP2_SOURCE"), context);
  vm.runInContext(extractConst("CP2_METHOD"), context);
  vm.runInContext(extractFunction("cp2IdleCashSignal"), context);
  vm.runInContext(extractFunction("cp2IdleCashHtml"), context);
  return context;
}

test("cp2IdleCashSignal · cita la función real (cushionFloor/opportunityCost), no solo 'metric:idle-cash'", () => {
  const opportunityCost = Portfolio.opportunityCost({ amount: 2000, months: 12, annualReturnPct: 5 });
  const ctx = cp2Sandbox({ idleAmount: 2000, floor: 3000, total: 5000, opportunityCost });
  const signal = ctx.cp2IdleCashSignal();
  assert.match(signal.citedSource, /canonical-cushion\.js/);
  assert.match(signal.citedSource, /canonical-portfolio\.js/);
});

test("cp2IdleCashHtml · muestra la fuente real junto a la cita interna", () => {
  const ctx = cp2Sandbox({});
  const output = ctx.cp2IdleCashHtml({ label: "Dinero parado", idleAmount: 1000, floor: 2000, opportunityCost: null, citations: ["metric:idle-cash"], citedSource: "canonical-cushion.js + canonical-portfolio.js · cushionFloor() / opportunityCost() vía cp2IdleCashSummary (app.js)" });
  assert.match(output, /Fuente real: canonical-cushion\.js \+ canonical-portfolio\.js/);
});

test("cp2IdleCashHtml · sin citedSource, sigue mostrando solo la cita interna (compatibilidad hacia atrás)", () => {
  const ctx = cp2Sandbox({});
  const output = ctx.cp2IdleCashHtml({ label: "Dinero parado", idleAmount: 1000, floor: 2000, opportunityCost: null, citations: ["metric:idle-cash"] });
  assert.doesNotMatch(output, /Fuente real/);
  assert.match(output, /Cita: metric:idle-cash/);
});
