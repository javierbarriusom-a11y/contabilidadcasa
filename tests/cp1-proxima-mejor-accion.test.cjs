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
  vm.runInContext(`const CPX3_IGNORED_DAYS_THRESHOLD = 3;`, context);
  vm.runInContext(extractFunction("cpx3IgnoredNoteHtml"), context);
  vm.runInContext(extractFunction("cp1NextBestAction"), context);
  vm.runInContext(extractFunction("rgx4TwoLevelExplanationHtml"), context);
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
  assert.match(ui, /cp1NextBestActionHtml\(nextBestAction, cpx3Entry\)/);
});

test("p2-ui.js está versionado en index.html", () => {
  assert.match(html, /p2-ui\.js\?v=/);
});

// ---------------------------------------------------------------------------------------------
// CPX3 (Oleada 2, Bloque 2) · transparencia de recomendaciones ignoradas — no cambia qué recomienda
// CP1, solo hace visible cuánto lleva abierta la misma recomendación sin resolverse, con un botón
// para descartarla a propósito. El registro (firstShownAt/dismissedAt) se guarda en app.js
// (scenarioSettings) y llega aquí ya calculado vía window.FinanceP2Bridge.trackRecommendation.
// ---------------------------------------------------------------------------------------------

const SAMPLE_ACTION = { label: "Revisar la caja prevista", message: "La caja prevista queda en -100 €.", severity: "critical", citations: ["alert:cash-2026-10"] };

test("cpx3IgnoredNoteHtml · sin entrada, no avisa de nada", () => {
  const ctx = sandbox();
  assert.equal(ctx.cpx3IgnoredNoteHtml(null), "");
});

test("cpx3IgnoredNoteHtml · recién mostrada (menos del umbral), todavía no avisa", () => {
  const ctx = sandbox();
  const entry = { signature: "alert:cash-2026-10", firstShownAt: new Date().toISOString() };
  assert.equal(ctx.cpx3IgnoredNoteHtml(entry), "");
});

test("cpx3IgnoredNoteHtml · pasado el umbral de días, avisa con el número de días y un botón de descartar", () => {
  const ctx = sandbox();
  const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
  const entry = { signature: "alert:cash-2026-10", firstShownAt: fiveDaysAgo };
  const output = ctx.cpx3IgnoredNoteHtml(entry);
  assert.match(output, /5 día\(s\)/);
  assert.match(output, /data-cpx3-dismiss="alert:cash-2026-10"/);
  assert.match(output, /Descartar/);
});

test("cp1NextBestActionHtml · con una entrada de seguimiento reciente, no añade el aviso de ignorada", () => {
  const ctx = sandbox();
  const entry = { signature: "alert:cash-2026-10", firstShownAt: new Date().toISOString() };
  const output = ctx.cp1NextBestActionHtml(SAMPLE_ACTION, entry);
  assert.doesNotMatch(output, /Descartar/);
});

test("cp1NextBestActionHtml · con una entrada de seguimiento antigua, añade el aviso y el botón dentro de la misma tarjeta", () => {
  const ctx = sandbox();
  const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
  const entry = { signature: "alert:cash-2026-10", firstShownAt: tenDaysAgo };
  const output = ctx.cp1NextBestActionHtml(SAMPLE_ACTION, entry);
  assert.match(output, /10 día\(s\)/);
  assert.match(output, /Revisar la caja prevista/); // sigue mostrando la acción normal
});

test("p2-ui.js: la recomendación se registra en cada render, vía el puente de app.js", () => {
  assert.match(ui, /const cpx3Entry = bridge\(\)\?\.trackRecommendation\?\.\(nextBestAction\) \|\| null;/);
});

test("p2-ui.js: el botón de descartar llama a dismissRecommendation y vuelve a renderizar", () => {
  const block = ui.slice(ui.indexOf('target.querySelectorAll("[data-cpx3-dismiss]")'), ui.indexOf('target.querySelectorAll("[data-cpx3-dismiss]")') + 300);
  assert.match(block, /bridge\(\)\?\.dismissRecommendation\?\.\(button\.dataset\.cpx3Dismiss\)/);
  assert.match(block, /renderE16Monitoring\(\)/);
});

// ---------------------------------------------------------------------------------------------
// RGX4 (Oleada 2, Bloque 2) · explicación en dos niveles — capa sobre A7-3/A11-4/CP1, sin motor
// nuevo. Nivel 1 (siempre visible): etiqueta + mensaje en lenguaje llano, igual que antes. Nivel 2
// (<details>/<summary> nativo, sin estado de JS): la evidencia real de E16 (evidence[]/confidence)
// y la cita verificada por CP3, para quien quiera comprobar el porqué.
// ---------------------------------------------------------------------------------------------

test("cp1NextBestAction · lleva la evidencia y la confianza reales de la alerta, no solo la etiqueta y el mensaje", () => {
  const ctx = sandbox();
  const model = {
    alerts: E16.predictiveAlerts(forecastWith(-100), { minimumLiquidity: 500, maximumMonthlyVariation: 0, maximumDebtRatio: 100 }, { debtRatio: 0 }),
  };
  const action = ctx.cp1NextBestAction(model);
  const sourceAlert = model.alerts.alerts[0];
  assert.deepEqual(action.evidence, sourceAlert.evidence);
  assert.equal(action.confidence, sourceAlert.confidence);
});

test("rgx4TwoLevelExplanationHtml · envuelve la evidencia, la confianza y la cita dentro de un <details> plegado por defecto", () => {
  const ctx = sandbox();
  const html = ctx.rgx4TwoLevelExplanationHtml({ evidence: ["forecast canónico", "umbral de caja 500 €"], confidence: "alta", citations: ["alert:cash-2026-10"] });
  assert.match(html, /^<details class="p2-details"><summary>Ver por qué<\/summary>/);
  assert.match(html, /forecast canónico/);
  assert.match(html, /umbral de caja 500 €/);
  assert.match(html, /Confianza del dato: alta/);
  assert.match(html, /Cita: alert:cash-2026-10/);
});

test("rgx4TwoLevelExplanationHtml · sin evidencia ni confianza declaradas, no inventa ninguna línea — solo la cita", () => {
  const ctx = sandbox();
  const html = ctx.rgx4TwoLevelExplanationHtml({ citations: ["alert:debt-ratio"] });
  assert.doesNotMatch(html, /Confianza del dato/);
  assert.match(html, /<ul class="p2-help"><li>Cita: alert:debt-ratio<\/li><\/ul>/);
});

test("cp1NextBestActionHtml · el mensaje en lenguaje llano queda fuera del <details> (nivel 1 siempre visible)", () => {
  const ctx = sandbox();
  const action = { label: "Revisar la caja prevista", message: "La caja prevista queda en -100 €.", severity: "critical", citations: ["alert:cash-2026-10"], evidence: ["forecast canónico"], confidence: "alta" };
  const output = ctx.cp1NextBestActionHtml(action);
  const messageIndex = output.indexOf("La caja prevista queda en -100");
  const detailsIndex = output.indexOf("<details");
  assert.ok(messageIndex >= 0 && detailsIndex >= 0 && messageIndex < detailsIndex, "el mensaje debe aparecer antes del <details>, nunca solo dentro de él");
});
