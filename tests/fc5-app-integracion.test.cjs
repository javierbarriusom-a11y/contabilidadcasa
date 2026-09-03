const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const appSource = fs.readFileSync(require.resolve("../app.js"), "utf8");
const indexSource = fs.readFileSync(require.resolve("../index.html"), "utf8");

test("FC5: la tarjeta de venta parcial tiene todos sus campos", () => {
  ["fc5AlreadyRealized", "fc5ProposedGain", "fc5OptimizeRun", "fc5OptimizeNote"].forEach((id) => {
    assert.match(indexSource, new RegExp(`id="${id}"`), `Falta #${id} en la tarjeta de FC5`);
  });
  assert.match(indexSource, /Venta parcial: optimizar el tramo del ahorro/);
});

test("FC5: la escala del tramo del ahorro se declara con la misma tarjeta de escalas de IRPF (kind \"savings\")", () => {
  assert.match(indexSource, /<option value="savings">Tramo del ahorro/);
});

test("FC5: saveIrpfBracketScale ya no colapsa \"savings\" a \"state\" (bug corregido antes de publicar)", () => {
  const block = appSource.slice(appSource.indexOf("function saveIrpfBracketScale("), appSource.indexOf("function saveIrpfBracketScale(") + 700);
  assert.match(block, /kind === "regional" \? "regional" : kind === "savings" \? "savings" : "state"/);
});

test("FC5: handleFc5Optimize delega en FinanceCanonicalIrpfEstimator.optimizePartialSale con la escala \"savings\"", () => {
  const block = appSource.slice(appSource.indexOf("function handleFc5Optimize("), appSource.indexOf("function handleFc5Optimize(") + 600);
  assert.match(block, /latestIrpfScale\("savings"\)/);
  assert.match(block, /engine\.optimizePartialSale\(/);
});

test("FC5: fc5ResultHtml nunca presenta el resultado como una recomendación de vender", () => {
  const block = appSource.slice(appSource.indexOf("function fc5ResultHtml("), appSource.indexOf("function fc5ResultHtml(") + 1500);
  assert.match(block, /No es una recomendación de vender/);
});

test("FC5: sin escala o sin plusvalía, fc5ResultHtml pide el dato en vez de inventar un resultado", () => {
  const block = appSource.slice(appSource.indexOf("function fc5ResultHtml("), appSource.indexOf("function fc5ResultHtml(") + 500);
  assert.match(block, /if \(!result\.calculable\)/);
  assert.match(block, /missing-scale/);
});

test("FC5: el botón está cableado", () => {
  assert.match(appSource, /qs\("fc5OptimizeRun"\)\?\.addEventListener\("click", handleFc5Optimize\);/);
});
