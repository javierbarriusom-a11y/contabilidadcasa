const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const appSource = fs.readFileSync(require.resolve("../app.js"), "utf8");
const indexSource = fs.readFileSync(require.resolve("../index.html"), "utf8");
const buildScript = fs.readFileSync(require.resolve("../tools/build-public-site.mjs"), "utf8");

test("AP6: la tarjeta de alerta de sostenibilidad de la deuda tomada tiene su contenedor", () => {
  assert.match(indexSource, /id="ap6SustainabilityAlert"/);
  const cardStart = indexSource.indexOf("Alerta: colchón frente a la deuda de apalancamiento tomada");
  assert.ok(cardStart >= 0, "Falta el título exacto de la tarjeta AP6");
  const card = indexSource.slice(cardStart, cardStart + 700);
  assert.match(card, /solo mira los escenarios que tú mismo has marcado como tomados/);
});

test("AP6: la lista de escenarios AP3 ofrece marcar/desmarcar como tomada", () => {
  assert.match(indexSource, /Marcar como tomada|Desmarcar como tomada/);
  const block = appSource.slice(appSource.indexOf("function renderAp3ScenarioList("), appSource.indexOf("function renderAp3ScenarioList(") + 900);
  assert.match(block, /data-ap3-scenario-taken-toggle/);
});

test("AP6: toggleAp3ScenarioTaken alterna takenAt sin tocar el resto del escenario", () => {
  const block = appSource.slice(appSource.indexOf("function toggleAp3ScenarioTaken("), appSource.indexOf("function toggleAp3ScenarioTaken(") + 500);
  assert.match(block, /row\.takenAt \? null : new Date\(\)\.toISOString\(\)/);
  assert.match(block, /renderAp3ScenarioList\(\);/);
  assert.match(block, /renderAp6Alert\(\);/);
});

test("AP6: ap6SustainabilityInput reutiliza exactamente la misma fuente de colchón que AP4/AP3 — nada nuevo que declarar", () => {
  const block = appSource.slice(appSource.indexOf("function ap6SustainabilityInput("), appSource.indexOf("function ap6SustainabilityInput(") + 500);
  assert.match(block, /accountBalancesFromState\(\)\.total/);
  assert.match(block, /FinanceCanonicalCushion\.cushionFloor\(lastSimulation, cuadroMandosReserve\(\)\)/);
  assert.match(block, /scenarios: ap3LeverageScenarios\(\)/);
});

test("AP6: guardar o eliminar un escenario AP3 también refresca la alerta de sostenibilidad", () => {
  const saveBlock = appSource.slice(appSource.indexOf("function saveAp3Scenario("), appSource.indexOf("function saveAp3Scenario(") + 700);
  assert.match(saveBlock, /renderAp6Alert\(\);/);
  const removeBlock = appSource.slice(appSource.indexOf("function removeAp3Scenario("), appSource.indexOf("function removeAp3Scenario(") + 300);
  assert.match(removeBlock, /renderAp6Alert\(\);/);
});

test("AP6: el listener de la lista de escenarios distingue el toggle de tomada del botón de eliminar", () => {
  const block = appSource.slice(appSource.indexOf('qs("ap3ScenarioList")?.addEventListener'), appSource.indexOf('qs("ap3ScenarioList")?.addEventListener') + 500);
  assert.match(block, /data-ap3-scenario-taken-toggle/);
  assert.match(block, /toggleAp3ScenarioTaken\(toggleButton\.dataset\.ap3ScenarioTakenToggle\)/);
  assert.match(block, /removeAp3Scenario\(removeButton\.dataset\.ap3ScenarioRemove\)/);
});

test("AP6: la alerta se renderiza en el arranque de la app, justo después de la lista de escenarios AP3", () => {
  assert.match(appSource, /renderAp3BarrierStatus\(\);\s*\n\s*renderAp3ScenarioList\(\);\s*\n\s*renderAp6Alert\(\);/);
});

test("AP6: sin escenarios tomados nunca finge sostenibilidad, y una vez insostenible nunca se silencia", () => {
  const block = appSource.slice(appSource.indexOf("function ap6ResultHtml("), appSource.indexOf("function ap6ResultHtml(") + 1400);
  assert.match(block, /AP6_STATUS_LABEL\[result\.status\]/);
  assert.match(block, /insostenible/);
  assert.match(block, /negative/);
});

test("canonical-leverage-sustainability.js está versionado en index.html, cargado antes que app.js y en la whitelist del sitio público", () => {
  const sustainabilityScript = indexSource.indexOf("canonical-leverage-sustainability.js");
  const appScript = indexSource.indexOf('app.js?v=');
  assert.ok(sustainabilityScript >= 0, "canonical-leverage-sustainability.js no está en index.html");
  assert.ok(sustainabilityScript < appScript, "canonical-leverage-sustainability.js debe cargarse antes que app.js");
  assert.match(buildScript, /"canonical-leverage-sustainability\.js"/);
});
