const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const appSource = fs.readFileSync(require.resolve("../app.js"), "utf8");
const indexSource = fs.readFileSync(require.resolve("../index.html"), "utf8");

test("A14-4: app.js define el registro y el desglose de activos", () => {
  assert.match(appSource, /function assetsList\(\)/);
  assert.match(appSource, /function saveA14Asset\(\)/);
  assert.match(appSource, /function renderA14AssetBreakdown\(\)/);
});

// T5 extrajo este cálculo a a14NetWorthToday() (para que la cascada mensual lo reutilice sin
// duplicarlo) — renderA14AssetBreakdown ahora delega en esa función en vez de llamar a
// FinanceCanonicalAssets directamente.
test("A14-4: renderA14AssetBreakdown delega en a14NetWorthToday(), que a su vez delega en FinanceCanonicalAssets (A14-1), sin motor propio", () => {
  const renderBlock = appSource.slice(appSource.indexOf("function renderA14AssetBreakdown"), appSource.indexOf("function renderA14AssetBreakdown") + 300);
  assert.match(renderBlock, /a14NetWorthToday\(\)/);

  const todayBlock = appSource.slice(appSource.indexOf("function a14NetWorthToday"), appSource.indexOf("function a14NetWorthToday") + 500);
  assert.match(todayBlock, /window\.FinanceCanonicalAssets/);
  assert.match(todayBlock, /normalizeAssets/);
});

test("A14-4: sin activos, la tarjeta pide registrar antes de mostrar desglose (A14-6, sin romper nada)", () => {
  const block = appSource.slice(appSource.indexOf("function a14NetWorthToday"), appSource.indexOf("function a14NetWorthToday") + 500);
  assert.match(block, /rows\.length/);
});

test("A14-4: la tarjeta de Ajustes registra tipo, valor, fecha y procedencia obligatorios", () => {
  assert.match(indexSource, /id="a14AssetType"/);
  assert.match(indexSource, /id="a14AssetValue"/);
  assert.match(indexSource, /id="a14AssetDate"/);
  assert.match(indexSource, /id="a14AssetProvenance"/);
});

test("A14-4: el listado de activos permite quitar cada uno (data-a14-asset-remove)", () => {
  assert.match(appSource, /data-a14-asset-remove/);
  assert.match(appSource, /function removeA14Asset\(id\)/);
});
