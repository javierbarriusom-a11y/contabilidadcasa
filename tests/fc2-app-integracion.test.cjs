const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const appSource = fs.readFileSync(require.resolve("../app.js"), "utf8");
const indexSource = fs.readFileSync(require.resolve("../index.html"), "utf8");

test("FC2: la tarjeta de cartera tiene el selector de traspaso y su botón", () => {
  assert.match(indexSource, /id="iv1TransferSource"/);
  assert.match(indexSource, /id="iv1PositionTransfer"/);
});

test("FC2: saveIv1Transfer rechaza el traspaso si origen o destino no son «Fondo»", () => {
  const block = appSource.slice(appSource.indexOf("function saveIv1Transfer"), appSource.indexOf("function saveIv1Transfer") + 900);
  assert.match(block, /engine\.isFundToFundTransfer\(source\.type, targetType\)/);
  assert.match(block, /El traspaso sin peaje fiscal \(FC2\) solo aplica entre fondos de inversión/);
});

test("FC2: saveIv1Transfer llama a applyFundTransfer y sustituye la posición por su id", () => {
  const block = appSource.slice(appSource.indexOf("function saveIv1Transfer"), appSource.indexOf("function saveIv1Transfer") + 1400);
  assert.match(block, /engine\.applyFundTransfer\(source, \{ type: targetType, label, quantity, currentValue \}\)/);
  assert.match(block, /position\.id === sourceId \? transferred : position/);
});

test("FC2: el botón de traspaso está cableado a saveIv1Transfer", () => {
  assert.match(appSource, /qs\("iv1PositionTransfer"\)\?\.addEventListener\("click", saveIv1Transfer\);/);
});
