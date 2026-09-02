const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const appSource = fs.readFileSync(require.resolve("../app.js"), "utf8");
const indexSource = fs.readFileSync(require.resolve("../index.html"), "utf8");
const buildScript = fs.readFileSync(require.resolve("../tools/build-public-site.mjs"), "utf8");

test("A15-2: la tarjeta de registro de escalas y la de estimación tienen todos sus campos", () => {
  ["irpfScaleKind", "irpfScaleRegion", "irpfScaleYear", "irpfScaleBrackets", "irpfScaleSourceTitle", "irpfScaleSourceUrl", "irpfScaleCheckedAt", "irpfScaleAdd", "irpfBracketScaleList"].forEach((id) => {
    assert.match(indexSource, new RegExp(`id="${id}"`), `Falta #${id} en la tarjeta de escalas de IRPF`);
  });
  ["irpfBaseLow", "irpfBaseHigh", "irpfWithholdingsPaid", "irpfEstimateRun", "irpfEstimatorNote"].forEach((id) => {
    assert.match(indexSource, new RegExp(`id="${id}"`), `Falta #${id} en la tarjeta del estimador de IRPF`);
  });
});

test("A15-2: saveIrpfBracketScale nunca fabrica una fuente — usa exactamente lo que declara el hogar", () => {
  const block = appSource.slice(appSource.indexOf("function saveIrpfBracketScale("), appSource.indexOf("function saveIrpfBracketScale(") + 900);
  assert.match(block, /engine\.parseBracketScaleInput\(brackets\)/);
  assert.match(block, /authority: "Declarado por el hogar"/);
});

test("A15-2: handleAjustesEstimateIrpf usa la última escala registrada de cada tipo (estatal y autonómica)", () => {
  const block = appSource.slice(appSource.indexOf("function handleAjustesEstimateIrpf("), appSource.indexOf("function handleAjustesEstimateIrpf(") + 900);
  assert.match(block, /latestIrpfScale\("state"\)/);
  assert.match(block, /latestIrpfScale\("regional"\)/);
  assert.match(block, /engine\.estimateIrpfResult\(/);
});

test("A15-2: irpfResultLabel nunca inventa un resultado cuando faltan tramos — pide registrarlos", () => {
  const block = appSource.slice(appSource.indexOf("function irpfResultLabel("), appSource.indexOf("function irpfResultLabel(") + 500);
  assert.match(block, /if \(!result\.calculable\)/);
  assert.match(block, /Faltan tramos fiscales/);
});

test("A15-2: los controles y el listado están cableados", () => {
  assert.match(appSource, /qs\("irpfScaleAdd"\)\?\.addEventListener\("click", saveIrpfBracketScaleFromControls\);/);
  assert.match(appSource, /qs\("irpfBracketScaleList"\)\?\.addEventListener\("click"/);
  assert.match(appSource, /removeIrpfBracketScale\(removeButton\.dataset\.irpfScaleRemove\)/);
  assert.match(appSource, /qs\("irpfEstimateRun"\)\?\.addEventListener\("click", handleAjustesEstimateIrpf\);/);
});

test("A15-2: renderIrpfBracketScales se llama en el arranque de la app", () => {
  assert.match(appSource, /renderTaxTables\(\);\s*\n\s*renderIrpfBracketScales\(\);/);
});

test("canonical-irpf-estimator.js está versionado en index.html y en la whitelist del sitio público", () => {
  assert.match(indexSource, /canonical-irpf-estimator\.js\?v=/);
  assert.match(buildScript, /"canonical-irpf-estimator\.js"/);
});
