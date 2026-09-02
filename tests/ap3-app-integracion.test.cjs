const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const appSource = fs.readFileSync(require.resolve("../app.js"), "utf8");
const indexSource = fs.readFileSync(require.resolve("../index.html"), "utf8");
const buildScript = fs.readFileSync(require.resolve("../tools/build-public-site.mjs"), "utf8");

test("AP3: la tarjeta del simulador de apalancamiento tiene todos sus campos", () => {
  [
    "ap3BarrierStatus",
    "ap3DebtAmount",
    "ap3DebtRate",
    "ap3ReturnPessimistic",
    "ap3ReturnBase",
    "ap3ReturnOptimistic",
    "ap3SimulateRun",
    "ap3SimulatorNote",
    "ap3ScenarioName",
    "ap3ScenarioSave",
    "ap3ScenarioList",
  ].forEach((id) => {
    assert.match(indexSource, new RegExp(`id="${id}"`), `Falta #${id} en la tarjeta de AP3`);
  });
});

test("AP3: nunca se anuncia como ejecutable — la tarjeta se declara exploratoria en el propio texto", () => {
  const cardStart = indexSource.indexOf('Simulador de apalancamiento (explorar, no ejecutar)');
  assert.ok(cardStart >= 0, "Falta el título exacto de la tarjeta AP3");
  const card = indexSource.slice(cardStart, cardStart + 1200);
  assert.match(card, /Ninguna cifra de mercado se inventa aquí/);
  assert.match(card, /ningún resultado es una recomendación de actuar/);
});

test("AP3: ap3LeverageBarrierInput reutiliza las mismas fuentes que SP4/SP5 y E16 — nada nuevo que declarar", () => {
  const block = appSource.slice(appSource.indexOf("function ap3LeverageBarrierInput("), appSource.indexOf("function ap3LeverageBarrierInput(") + 700);
  assert.match(block, /accountBalancesFromState\(\)\.total/);
  assert.match(block, /FinanceCanonicalCushion\.cushionFloor\(lastSimulation, cuadroMandosReserve\(\)\)/);
  assert.match(block, /p2DebtRows\(\)\.reduce/);
  assert.match(block, /debtQualityIssues: \[\]/);
});

test("AP3: handleAp3Simulate llama al guardarraíl antes de simular — nunca calcula por su cuenta", () => {
  const block = appSource.slice(appSource.indexOf("function handleAp3Simulate("), appSource.indexOf("function handleAp3Simulate(") + 700);
  assert.match(block, /renderAp3BarrierStatus\(\)/);
  assert.match(block, /engine\.simulateLeverage\(/);
  assert.match(block, /barrierResult,/);
});

test("AP3: ap3ResultHtml nunca presenta la lectura favorable/desfavorable como una orden", () => {
  const block = appSource.slice(appSource.indexOf("function ap3ResultHtml("), appSource.indexOf("function ap3ResultHtml(") + 1500);
  assert.match(block, /no una orden/);
});

test("AP3: guardar un escenario exige haber simulado antes — nunca guarda sin resultado calculable", () => {
  const block = appSource.slice(appSource.indexOf("function saveAp3Scenario("), appSource.indexOf("function saveAp3Scenario(") + 700);
  assert.match(block, /if \(!ap3LastResult\)/);
  assert.match(block, /engine\.saveScenario\(ap3LastResult/);
});

test("AP3: los controles y el listado están cableados", () => {
  assert.match(appSource, /qs\("ap3SimulateRun"\)\?\.addEventListener\("click", handleAp3Simulate\);/);
  assert.match(appSource, /qs\("ap3ScenarioSave"\)\?\.addEventListener\("click", saveAp3Scenario\);/);
  assert.match(appSource, /qs\("ap3ScenarioList"\)\?\.addEventListener\("click"/);
  assert.match(appSource, /removeAp3Scenario\(removeButton\.dataset\.ap3ScenarioRemove\)/);
});

test("AP3: el guardarraíl y el listado de escenarios se renderizan en el arranque de la app", () => {
  assert.match(appSource, /renderIrpfBracketScales\(\);\s*\n\s*renderAp3BarrierStatus\(\);\s*\n\s*renderAp3ScenarioList\(\);/);
});

test("canonical-leverage-simulator.js está versionado en index.html, cargado antes que app.js y en la whitelist del sitio público", () => {
  const simulatorScript = indexSource.indexOf("canonical-leverage-simulator.js");
  const appScript = indexSource.indexOf('app.js?v=');
  assert.ok(simulatorScript >= 0, "canonical-leverage-simulator.js no está en index.html");
  assert.ok(simulatorScript < appScript, "canonical-leverage-simulator.js debe cargarse antes que app.js");
  assert.match(buildScript, /"canonical-leverage-simulator\.js"/);
});
