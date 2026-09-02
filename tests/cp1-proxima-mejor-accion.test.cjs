const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const ui = read("p2-ui.js");
const html = read("index.html");
const E16 = require("../canonical-e16-monitoring.js");
const E9Assistant = require("../canonical-e9-assistant.js");
const RecommendationCitation = require("../canonical-recommendation-citation.js");

// CP1 (BACKLOG_ULTIMATE_SEPTIEMBRE.md bloque 8, ampliación "copiloto proactivo" — depende de CP3):
// "motor de próxima mejor acción". De las alertas anticipadas que ya calcula E16 (A11-1), toma la
// más urgente, la cita contra el catálogo de fuentes de canonical-e9-assistant.js (sourceCatalog,
// el mismo vocabulario que usaba el asistente retirado) y la verifica con CP3
// (canonical-recommendation-citation.js) antes de mostrarla — sin revivir ninguna consulta a IA.

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

function sandbox() {
  const context = {
    root: { FinanceCanonicalE9Assistant: E9Assistant, FinanceCanonicalRecommendationCitation: RecommendationCitation },
    esc: (value) => String(value ?? ""),
  };
  vm.createContext(context);
  vm.runInContext(`const CP1_SEVERITY_RANK = ${JSON.stringify({ critical: 0, high: 1, medium: 2 })};`, context);
  vm.runInContext(`const CP1_ALERT_LABELS = ${JSON.stringify({ cash: "Revisar la caja prevista", variation: "Revisar la variación prevista", debt: "Revisar el ratio de deuda" })};`, context);
  vm.runInContext(extractFunction("cp1NextBestAction"), context);
  vm.runInContext(extractFunction("cp1NextBestActionHtml"), context);
  return context;
}

function forecastWith(liquidity) {
  return { series: [{ monthKey: "2026-10", confidence: "high", totals: { closingLiquidity: liquidity } }] };
}

test("cp1NextBestAction · elige la alerta más urgente (critical antes que high) y la cita", () => {
  const ctx = sandbox();
  const model = {
    alerts: E16.predictiveAlerts(forecastWith(-100), { minimumLiquidity: 500, maximumMonthlyVariation: 0, maximumDebtRatio: 100 }, { debtRatio: 0 }),
  };
  const action = ctx.cp1NextBestAction(model);
  assert.equal(action.severity, "critical");
  assert.equal(action.label, "Revisar la caja prevista");
  assert.equal(action.citations.length, 1);
  assert.equal(action.citations[0], `alert:${model.alerts.alerts[0].id}`);
});

test("cp1NextBestAction · una alerta de deuda se etiqueta distinto de una de caja", () => {
  const ctx = sandbox();
  const model = {
    alerts: E16.predictiveAlerts(forecastWith(2000), { minimumLiquidity: 0, maximumMonthlyVariation: 0, maximumDebtRatio: 30 }, { debtRatio: 45 }),
  };
  const action = ctx.cp1NextBestAction(model);
  assert.equal(action.label, "Revisar el ratio de deuda");
});

test("cp1NextBestAction · sin alertas, no hay próxima mejor acción que inventar", () => {
  const ctx = sandbox();
  const model = { alerts: E16.predictiveAlerts(forecastWith(2000), { minimumLiquidity: 0, maximumMonthlyVariation: 0, maximumDebtRatio: 100 }, { debtRatio: 0 }) };
  assert.equal(model.alerts.alerts.length, 0, "fixture sin riesgos");
  assert.equal(ctx.cp1NextBestAction(model), null);
});

test("cp1NextBestAction · las citas siempre existen en el catálogo de canonical-e9-assistant.js (nunca citation-unknown)", () => {
  const ctx = sandbox();
  const model = { alerts: E16.predictiveAlerts(forecastWith(-100), { minimumLiquidity: 500, maximumMonthlyVariation: 0, maximumDebtRatio: 100 }, { debtRatio: 0 }) };
  const action = ctx.cp1NextBestAction(model);
  const sources = E9Assistant.sourceCatalog({ alerts: model.alerts.alerts.map((item) => ({ id: item.id, label: item.message })) });
  const availableSources = new Set(sources.map((item) => item.id));
  const validation = RecommendationCitation.validateRecommendation(action, { availableSources });
  assert.equal(validation.valid, true);
});

test("cp1NextBestActionHtml · sin acción, dice explícitamente que no hay nada citable, no deja la tarjeta en blanco", () => {
  const ctx = sandbox();
  assert.match(ctx.cp1NextBestActionHtml(null), /No hay ninguna alerta con evidencia citable/);
});

test("cp1NextBestActionHtml · con acción, muestra la etiqueta, el mensaje y la cita", () => {
  const ctx = sandbox();
  const output = ctx.cp1NextBestActionHtml({ label: "Revisar la caja prevista", message: "La caja prevista queda en -100 €.", severity: "critical", citations: ["alert:cash-2026-10"] });
  assert.match(output, /Revisar la caja prevista/);
  assert.match(output, /alert:cash-2026-10/);
});

test("p2-ui.js: renderE16Monitoring pinta la próxima mejor acción (CP1) en su propia sección", () => {
  assert.match(ui, /Próxima mejor acción \(CP1\)/);
  assert.match(ui, /cp1NextBestAction\(model\)/);
  assert.match(ui, /cp1NextBestActionHtml\(nextBestAction\)/);
});

test("p2-ui.js está versionado en index.html", () => {
  assert.match(html, /p2-ui\.js\?v=/);
});
