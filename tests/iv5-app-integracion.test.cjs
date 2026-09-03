const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const appSource = fs.readFileSync(require.resolve("../app.js"), "utf8");
const indexSource = fs.readFileSync(require.resolve("../index.html"), "utf8");

test("IV5: iv5PortfolioAnnualReturnPct reutiliza la XIRR real de la cartera (IV1/IV2), sin cartera devuelve null", () => {
  const block = appSource.slice(appSource.indexOf("function iv5PortfolioAnnualReturnPct("), appSource.indexOf("function iv5PortfolioAnnualReturnPct(") + 400);
  assert.match(block, /iv1PositionsList\(\)/);
  assert.match(block, /normalizePositions\(rows\)\.summary\.xirr\.ratePct/);
  assert.match(block, /if \(!engine \|\| !rows\.length\) return null;/);
});

test("IV5: partidasSimuladorOpportunityCostFor solo aplica a una compra sin financiar", () => {
  const block = appSource.slice(appSource.indexOf("function partidasSimuladorOpportunityCostFor("), appSource.indexOf("function partidasSimuladorOpportunityCostFor(") + 700);
  assert.match(block, /decision\.tipo !== "compra"/);
  assert.match(block, /decision\.params\?\.financiacion/);
  assert.match(block, /engine\.opportunityCost\(/);
});

test("IV5: sin XIRR calculable, partidasSimuladorOpportunityCostFor no calcula nada", () => {
  const block = appSource.slice(appSource.indexOf("function partidasSimuladorOpportunityCostFor("), appSource.indexOf("function partidasSimuladorOpportunityCostFor(") + 700);
  assert.match(block, /if \(annualReturnPct === null\) return null;/);
});

test("IV5: el horizonte usado es el número de meses restantes del plan desde el mes de la decisión", () => {
  const block = appSource.slice(appSource.indexOf("function partidasSimuladorOpportunityCostFor("), appSource.indexOf("function partidasSimuladorOpportunityCostFor(") + 700);
  assert.match(block, /months\.length - monthIndex/);
});

test("IV5: partidasSimuladorOpportunityCostHtml no dibuja nada cuando no es calculable", () => {
  const block = appSource.slice(appSource.indexOf("function partidasSimuladorOpportunityCostHtml("), appSource.indexOf("function partidasSimuladorOpportunityCostHtml(") + 300);
  assert.match(block, /if \(!opportunityCost \|\| !opportunityCost\.calculable\) return "";/);
});

test("IV5: el modo manual y el modo de mejor mes calculan y muestran el coste de oportunidad", () => {
  const evaluateBlock = appSource.slice(appSource.indexOf("function partidasSimuladorEvaluate("), appSource.indexOf("function partidasSimuladorEvaluate(") + 2000);
  assert.match(evaluateBlock, /partidasSimuladorOpportunityCostFor\(built\.decision, month, baseInput\)/);
  assert.match(evaluateBlock, /scan\.best\.opportunityCost = partidasSimuladorOpportunityCostFor\(scan\.best\.decision, scan\.best\.month, baseInput\)/);
  const resultHtmlBlock = appSource.slice(appSource.indexOf("function partidasSimuladorResultHtml("), appSource.indexOf("function partidasSimuladorResultHtml(") + 3000);
  assert.match(resultHtmlBlock, /partidasSimuladorOpportunityCostHtml\(opportunityCost\)/g);
});

test("canonical-portfolio.js sigue versionado en index.html (motor compartido de IV1/IV2/IV5)", () => {
  assert.match(indexSource, /canonical-portfolio\.js\?v=/);
});
