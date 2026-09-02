const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const appSource = fs.readFileSync(require.resolve("../app.js"), "utf8");
const indexSource = fs.readFileSync(require.resolve("../index.html"), "utf8");

test("FC1: la tarjeta de cartera tiene el formulario de venta parcial y las unidades opcionales de la aportación", () => {
  assert.match(indexSource, /id="iv1ContributionQuantity"/);
  assert.match(indexSource, /id="iv1DisposalTarget"/);
  assert.match(indexSource, /id="iv1DisposalQuantity"/);
  assert.match(indexSource, /id="iv1DisposalProceeds"/);
  assert.match(indexSource, /id="iv1DisposalDate"/);
  assert.match(indexSource, /id="iv1DisposalAdd"/);
});

test("FC1: saveIv1Disposal valida posición, unidades y fecha antes de guardar la venta", () => {
  const block = appSource.slice(appSource.indexOf("function saveIv1Disposal("), appSource.indexOf("function saveIv1Disposal(") + 1400);
  assert.match(block, /Selecciona qué posición vendes en parte/);
  assert.match(block, /Indica cuántas unidades vendes, mayor que cero/);
  assert.match(block, /Indica la fecha de la venta/);
  assert.match(block, /nextDisposals/);
});

test("FC1: saveIv1Contribution lee las unidades opcionales de la aportación", () => {
  const block = appSource.slice(appSource.indexOf("function saveIv1Contribution("), appSource.indexOf("function saveIv1Contribution(") + 1400);
  assert.match(block, /qs\("iv1ContributionQuantity"\)\?\.value/);
  assert.match(block, /quantity: quantity > 0 \? quantity : 0/);
});

test("FC1: el botón de venta parcial está cableado a saveIv1Disposal", () => {
  assert.match(appSource, /qs\("iv1DisposalAdd"\)\?\.addEventListener\("click", saveIv1Disposal\);/);
});

test("FC1: renderIv1DisposalOptions existe y se llama junto al resto de renders de cartera", () => {
  assert.match(appSource, /function renderIv1DisposalOptions/);
  const saveBlock = appSource.slice(appSource.indexOf("function saveIv1Position("), appSource.indexOf("function saveIv1Position(") + 1400);
  assert.match(saveBlock, /renderIv1DisposalOptions\(\);/);
  const transferBlock = appSource.slice(appSource.indexOf("function saveIv1Transfer("), appSource.indexOf("function saveIv1Transfer(") + 1400);
  assert.match(transferBlock, /renderIv1DisposalOptions\(\);/);
  const removeBlock = appSource.slice(appSource.indexOf("function removeIv1Position("), appSource.indexOf("function removeIv1Position(") + 400);
  assert.match(removeBlock, /renderIv1DisposalOptions\(\);/);
});

test("FC1: renderIv1PositionList muestra la plusvalía realizada de cada posición junto al resto de cifras", () => {
  const block = appSource.slice(appSource.indexOf("function renderIv1PositionList("), appSource.indexOf("function renderIv1PositionList(") + 1400);
  assert.match(block, /fc1RealizedGainLabel\(position\.realizedGain, position\.disposals\.length\)/);
});

test("FC1: renderIv1PositionSummary muestra la plusvalía realizada agregada, aparte de la no realizada", () => {
  const block = appSource.slice(appSource.indexOf("function renderIv1PositionSummary("), appSource.indexOf("function renderIv1PositionSummary(") + 1600);
  assert.match(block, /totalRealizedGain/);
  assert.match(block, /no es calculable hasta corregirlas/);
});

test("FC1: fc1RealizedGainLabel nunca inventa una cifra cuando hay shortfall", () => {
  const block = appSource.slice(appSource.indexOf("function fc1RealizedGainLabel"), appSource.indexOf("function fc1RealizedGainLabel") + 400);
  assert.match(block, /no calculable/);
});

test("el motor canónico de cartera (con fifoLedger) está versionado en index.html", () => {
  assert.match(indexSource, /canonical-portfolio\.js\?v=/);
});
