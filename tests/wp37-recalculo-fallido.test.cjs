// WP-37 (8/11/2026) · un recálculo del plan que falla no corta la app en silencio: render() sigue con las últimas cifras buenas,
// lo dice en #recalculoError y la firma no queda como calculada, para que el siguiente pintado lo reintente.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const leer = (fichero) => fs.readFileSync(path.join(__dirname, "..", fichero), "utf8");

test("render() recalcula con recomputeModelSafely, que reabre la firma al fallar y avisa", () => {
  const app = leer("app.js");
  const render = app.slice(app.indexOf("function render() {"), app.indexOf("function scheduleRender() {"));
  assert.match(render, /populateSelectors\(\);\n  recomputeModelSafely\(\);\n  writeDerivedControls\(lastSimulation\);/);
  assert.doesNotMatch(render.slice(0, render.indexOf("function recomputeModelSafely")), /\n  recomputeModelIfNeeded\(\);/, "render ya no llama al recálculo sin red");
  const seguro = app.slice(app.indexOf("function recomputeModelSafely() {"), app.indexOf("function scheduleRender() {"));
  assert.match(seguro, /\n    simulationSignature = "";/, "sin esto, el siguiente pintado daba el cambio por calculado");
  // Atómico: al fallar vuelve todo lo que el recálculo pudo cambiar antes de romperse.
  ["canonicalEngineRuns = antes.runs;", "canonicalScenarioResults = antes.results;", "canonicalDailyEngineRuns = antes.daily;", "({ lastSimulation, lastBaseSimulation, lastPlannedSimulation, projectPlan } = antes);", "scenarioSettings.forecastAssumptions = antes.assumptions;", "pvc8MaterialityAlert = antes.alert;"]
    .forEach((linea) => assert.ok(seguro.includes(linea), linea));
  assert.match(seguro, /modelRecomputeError = null;/);
  assert.match(seguro, /box\.hidden = !modelRecomputeError;/);
  assert.match(seguro, /!\(Array\.isArray\(lastSimulation\) && lastSimulation\.length\)\) throw/, "sin cifras buenas previas, falla como antes");
});

test("el aviso está en index.html, oculto de entrada, como alerta y con su detalle técnico plegado", () => {
  const html = leer("index.html");
  const at = html.indexOf('id="recalculoError"');
  assert.ok(at > html.indexOf('<main id="mainContent"'), "dentro de <main>, en todas las pantallas");
  assert.ok(at < html.indexOf('<section class="home-dashboard view-section e19-home" id="home">'), "antes de la primera vista");
  const div = html.slice(html.lastIndexOf("<div", at), html.indexOf("</div>", at));
  assert.match(div, /role="alert" hidden>/);
  assert.match(div, /<details><summary>Detalle técnico<\/summary><p data-recalculo-detalle><\/p><\/details>/);
  const css = leer("styles.css");
  assert.match(css, /\.recalculo-error \{[^}]*var\(--e19-danger-soft\)/);
  assert.match(css, /\.recalculo-error\[hidden\] \{\n  display: none;/);
});

test("sin suelo fijado, la Previsión nueva lo dice y lleva a Ajustes; Ajustes dice quién usa el suelo", () => {
  const view = leer("views/prevision-v2.js");
  assert.match(view, /function previsionV2SueloInicial\(\) \{\n  const raw = state\?\.liquidityFloor;\n  return raw === null \|\| raw === undefined \|\| raw === "";/);
  assert.match(view, /No habéis fijado vuestro suelo: la app usa \$\{escapeHtml\(money\(floor\)\)\} de inicio\./);
  assert.match(view, /data-prevision-v2-suelo\]"\)\) \{[\s\S]{0,300}setActiveView\("ajustes"\);[\s\S]{0,200}qs\("ajustesLiquidityFloor"\)/);
  const html = leer("index.html");
  assert.match(html, /Lo usan el «Disponible» de Hoy, el punto más bajo de Plan › Previsión y sus pruebas de estrés/);
  assert.doesNotMatch(html, /Solo lo usa el «Disponible» de Hoy/);
});
