const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const appSource = fs.readFileSync(require.resolve("../app.js"), "utf8");
const indexSource = fs.readFileSync(require.resolve("../index.html"), "utf8");

test("A14-5: el laboratorio de escenarios (E13) ofrece los dos eventos de patrimonio en el selector", () => {
  assert.match(indexSource, /<option value="market-crash">Caída de mercado \(%\)<\/option>/);
  assert.match(indexSource, /<option value="property-revaluation">Revalorización del inmueble \(%\)<\/option>/);
});

test("A14-5: e13EventLabel etiqueta los dos nuevos tipos de evento", () => {
  const block = appSource.slice(appSource.indexOf("function e13EventLabel("), appSource.indexOf("function e13EventLabel(") + 400);
  assert.match(block, /"market-crash": "Caída de mercado"/);
  assert.match(block, /"property-revaluation": "Revalorización del inmueble"/);
});

test("A14-5: e13EventAmountLabel muestra un porcentaje para los eventos de patrimonio, nunca money()", () => {
  const block = appSource.slice(appSource.indexOf("function e13EventAmountLabel("), appSource.indexOf("function e13EventAmountLabel(") + 300);
  assert.match(block, /E13_ASSET_SHOCK_TYPES\.includes\(event\.type\)/);
  assert.match(block, /`\$\{event\.amount\}%`/);
});

test("A14-5: e13AssetsForLab delega en FinanceCanonicalAssets.normalizeAssets sin motor propio", () => {
  const block = appSource.slice(appSource.indexOf("function e13AssetsForLab("), appSource.indexOf("function e13AssetsForLab(") + 300);
  assert.match(block, /window\.FinanceCanonicalAssets/);
  assert.match(block, /normalizeAssets\(assetsList\(\)\)\.assets/);
});

test("A14-5: renderE13ScenarioLab construye el laboratorio con los activos declarados y pinta la tarjeta de patrimonio simulado", () => {
  const block = appSource.slice(appSource.indexOf("function renderE13ScenarioLab("), appSource.indexOf("function renderE13ScenarioLab(") + 6400);
  assert.match(block, /E13\.buildLab\(forecast, e13ScenarioEvents, \{ generatedAt: forecast\.generatedAt, assets: e13AssetsForLab\(\) \}\)/);
  assert.match(block, /Patrimonio simulado \(A14-5\)/);
  assert.match(block, /e13AssetImpactHtml\(lab\.assetImpact\)/);
});

test("A14-5: saveE13ReproducibleScenario y rerunE13SavedScenario también pasan los activos declarados al motor", () => {
  const saveBlock = appSource.slice(appSource.indexOf("function saveE13ReproducibleScenario("), appSource.indexOf("function saveE13ReproducibleScenario(") + 500);
  assert.match(saveBlock, /assets: e13AssetsForLab\(\)/);
  const rerunBlock = appSource.slice(appSource.indexOf("function rerunE13SavedScenario("), appSource.indexOf("function rerunE13SavedScenario(") + 500);
  assert.match(rerunBlock, /assets: e13AssetsForLab\(\)/);
});

test("A14-5: e13AssetImpactHtml nunca inventa una cifra cuando no hay activos o eventos de patrimonio", () => {
  const block = appSource.slice(appSource.indexOf("function e13AssetImpactHtml("), appSource.indexOf("function e13AssetImpactHtml(") + 900);
  assert.match(block, /if \(!assetImpact\)/);
  assert.match(block, /Registra activos en Patrimonio/);
  assert.match(block, /Añade un evento de caída de mercado o revalorización/);
});

test("canonical-e13-scenarios.js está versionado en index.html", () => {
  assert.match(indexSource, /canonical-e13-scenarios\.js\?v=/);
});
