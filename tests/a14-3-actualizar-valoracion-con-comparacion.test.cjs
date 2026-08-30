const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const appSource = fs.readFileSync(require.resolve("../app.js"), "utf8");
const indexSource = fs.readFileSync(require.resolve("../index.html"), "utf8");

test("A14-3: actualizar un activo existente no sobrescribe en silencio, pide confirmación", () => {
  assert.match(appSource, /function findA14AssetMatch\(type, label\)/);
  assert.match(appSource, /function renderA14AssetPendingCompare\(\)/);
  const saveBlock = appSource.slice(appSource.indexOf("function saveA14Asset"), appSource.indexOf("function saveA14Asset") + 1300);
  assert.match(saveBlock, /findA14AssetMatch/);
  assert.match(saveBlock, /a14PendingAssetUpdate = \{ existing, next:/);
});

test("A14-3: confirmar la actualización sustituye el activo existente, cancelar lo deja intacto", () => {
  assert.match(appSource, /function confirmA14AssetUpdate\(\)/);
  assert.match(appSource, /function cancelA14AssetUpdate\(\)/);
  const confirmBlock = appSource.slice(appSource.indexOf("function confirmA14AssetUpdate"), appSource.indexOf("function confirmA14AssetUpdate") + 500);
  assert.match(confirmBlock, /asset\.id === existing\.id/);
});

test("A14-3: la comparación muestra valor y fecha anteriores frente a los nuevos", () => {
  const block = appSource.slice(appSource.indexOf("function renderA14AssetPendingCompare"), appSource.indexOf("function renderA14AssetPendingCompare") + 700);
  assert.match(block, /Valor anterior/);
  assert.match(block, /Valor nuevo/);
});

test("A14-3: la tarjeta de Ajustes tiene el contenedor de comparación pendiente", () => {
  assert.match(indexSource, /id="a14AssetPendingCompare"/);
});
