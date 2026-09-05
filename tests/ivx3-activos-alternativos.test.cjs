const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const Assets = require(path.join(root, "canonical-assets.js"));
const appSource = fs.readFileSync(path.join(root, "app.js"), "utf8");
const indexSource = fs.readFileSync(path.join(root, "index.html"), "utf8");

// IVX3 (Oleada 2 Bloque 5): activos alternativos. El usuario pidió, en vez del tipo genérico "otro"
// que ya cubría cualquier activo, un tipo propio con su propio formulario de alta (nombre, volumen
// de inversión, rentabilidad...) — mismo patrón que el alta de créditos. La rentabilidad nunca se
// pide como un porcentaje aparte: se deriva del valor actual y el importe invertido, los dos datos
// que el hogar ya declara para cualquier activo.

test("ASSET_TYPES incluye 'alternativo' como tipo propio, no fundido en 'otro'", () => {
  assert.ok(Assets.ASSET_TYPES.includes("alternativo"));
});

test("normalizeAsset acepta el tipo 'alternativo' sin caer a 'otro'", () => {
  const asset = Assets.normalizeAsset({ id: "btc", type: "alternativo", label: "Bitcoin", value: 12000, provenance: "declared" });
  assert.equal(asset.type, "alternativo");
});

test("alternativeAssetReturn · sin importe invertido conocido, no calculable (nunca un 0% inventado)", () => {
  assert.equal(Assets.alternativeAssetReturn({ value: 12000 }).calculable, false);
  assert.equal(Assets.alternativeAssetReturn({ value: 12000, investedAmount: null }).calculable, false);
  assert.equal(Assets.alternativeAssetReturn({ value: 12000, investedAmount: 0 }).calculable, false);
});

test("alternativeAssetReturn · con importe invertido positivo, calcula ganancia y porcentaje exactos", () => {
  const result = Assets.alternativeAssetReturn({ value: 12000, investedAmount: 8000 });
  assert.equal(result.calculable, true);
  assert.equal(result.returnAmount, 4000);
  assert.equal(result.returnPct, 50);
});

test("alternativeAssetReturn · admite pérdida (valor por debajo de lo invertido)", () => {
  const result = Assets.alternativeAssetReturn({ value: 6000, investedAmount: 8000 });
  assert.equal(result.calculable, true);
  assert.equal(result.returnAmount, -2000);
  assert.equal(result.returnPct, -25);
});

test("normalizeAsset adjunta returnInfo derivado del valor y el importe invertido ya declarados", () => {
  const asset = Assets.normalizeAsset({ id: "btc", type: "alternativo", label: "Bitcoin", value: 12000, investedAmount: 8000, provenance: "declared" });
  assert.equal(asset.returnInfo.calculable, true);
  assert.equal(asset.returnInfo.returnPct, 50);
});

test("assetQuality solo exige investedAmount para el tipo 'alternativo', no para el resto", () => {
  const alternativo = Assets.normalizeAsset({ id: "btc", type: "alternativo", label: "Bitcoin", value: 12000, provenance: "declared", owner: "household", asOf: "2026-09-01" });
  assert.ok("investedAmount" in alternativo.dataQuality.fields);
  assert.equal(alternativo.dataQuality.fields.investedAmount, false);
  assert.ok(alternativo.dataQuality.missing.includes("investedAmount"));

  const cuenta = Assets.normalizeAsset({ id: "c1", type: "cuenta", label: "Cuenta", value: 1000, provenance: "declared", owner: "household", asOf: "2026-09-01" });
  assert.ok(!("investedAmount" in cuenta.dataQuality.fields));
  assert.equal(cuenta.dataQuality.complete, true);
});

test("canonical-assets.js: alternativeAssetReturn está exportado", () => {
  assert.equal(typeof Assets.alternativeAssetReturn, "function");
});

test("index.html: el formulario de patrimonio tiene el tipo 'alternativo' y los campos de categoría/importe invertido", () => {
  assert.match(indexSource, /<option value="alternativo">/);
  ["a14AssetCategory", "a14AssetInvestedAmount"].forEach((id) => {
    assert.match(indexSource, new RegExp(`id="${id}"`), `Falta #${id} en el formulario de patrimonio`);
  });
});

test("app.js: saveA14Asset guarda un importe invertido vacío como null, nunca como 0 (0 significaría 'invertiste nada')", () => {
  const start = appSource.indexOf("function saveA14Asset(");
  const block = appSource.slice(start, start + 1400);
  assert.match(block, /investedAmountRaw === "" \|\| investedAmountRaw === undefined \? null/);
});

test("app.js: a14AssetReturnLabel usa alternativeAssetReturn y no pinta nada cuando no es calculable", () => {
  const start = appSource.indexOf("function a14AssetReturnLabel(");
  const block = appSource.slice(start, start + 500);
  assert.match(block, /engine\.alternativeAssetReturn\(/);
  assert.match(block, /if \(!result\.calculable\) return "";/);
});

test("app.js: renderA14AssetList pinta la categoría y la rentabilidad de cada activo", () => {
  const start = appSource.indexOf("function renderA14AssetList(");
  const block = appSource.slice(start, start + 700);
  assert.match(block, /a14AssetReturnLabel\(asset\)/);
  assert.match(block, /asset\.category/);
});
