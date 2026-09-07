const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const Assets = require(path.join(root, "canonical-assets.js"));
const appSource = fs.readFileSync(path.join(root, "app.js"), "utf8");
const indexSource = fs.readFileSync(path.join(root, "index.html"), "utf8");

// INV9 (Oleada 3, Bloque 4): inmueble en alquiler como activo con P&L propio. Caso real del hogar
// (confirmado antes de construir, no hipotético): un ingreso de alquiler ya registrado con línea
// propia, declarado NETO (sin gastos que restar). Mismo patrón que IVX3 (importe invertido en
// "alternativo"): el ingreso se declara una vez, la rentabilidad se deriva — nunca un porcentaje
// aparte que el hogar tendría que mantener sincronizado a mano.

test("rentalAssetPnL · sin ingreso de alquiler declarado, no calculable (nunca un 0% inventado)", () => {
  assert.equal(Assets.rentalAssetPnL({ value: 200000 }).calculable, false);
  assert.equal(Assets.rentalAssetPnL({ value: 200000, monthlyRentIncome: null }).calculable, false);
  assert.equal(Assets.rentalAssetPnL({ value: 200000, monthlyRentIncome: 0 }).calculable, false);
});

test("rentalAssetPnL · con ingreso neto declarado, anualiza y calcula la rentabilidad bruta sobre el valor", () => {
  const result = Assets.rentalAssetPnL({ value: 200000, monthlyRentIncome: 800 });
  assert.equal(result.calculable, true);
  assert.equal(result.monthlyRentIncome, 800);
  assert.equal(result.annualRentIncome, 9600);
  assert.equal(result.grossYieldPct, 4.8);
});

test("rentalAssetPnL · sin valor declarado del inmueble, sigue anualizando el ingreso pero sin rentabilidad (no divide por 0)", () => {
  const result = Assets.rentalAssetPnL({ monthlyRentIncome: 800 });
  assert.equal(result.calculable, true);
  assert.equal(result.annualRentIncome, 9600);
  assert.equal(result.grossYieldPct, null);
});

test("normalizeAsset adjunta rentalPnL derivado del valor y el ingreso de alquiler ya declarados", () => {
  const asset = Assets.normalizeAsset({ id: "local-1", type: "inmueble", label: "Local", value: 200000, monthlyRentIncome: 800, provenance: "declared" });
  assert.equal(asset.monthlyRentIncome, 800);
  assert.equal(asset.rentalPnL.calculable, true);
  assert.equal(asset.rentalPnL.grossYieldPct, 4.8);
});

test("normalizeAsset guarda monthlyRentIncome vacío como null, nunca como 0", () => {
  const asset = Assets.normalizeAsset({ id: "casa-1", type: "inmueble", label: "Casa", value: 300000, provenance: "declared" });
  assert.equal(asset.monthlyRentIncome, null);
  assert.equal(asset.rentalPnL.calculable, false);
});

test("canonical-assets.js: rentalAssetPnL está exportado", () => {
  assert.equal(typeof Assets.rentalAssetPnL, "function");
});

test("index.html: el formulario de patrimonio tiene el campo de ingreso de alquiler neto mensual", () => {
  assert.match(indexSource, /id="a14AssetMonthlyRentIncome"/);
});

test("app.js: saveA14Asset guarda un ingreso de alquiler vacío como null, nunca como 0", () => {
  const start = appSource.indexOf("function saveA14Asset(");
  const block = appSource.slice(start, start + 1600);
  assert.match(block, /monthlyRentIncomeRaw === "" \|\| monthlyRentIncomeRaw === undefined \? null/);
});

test("app.js: a14AssetRentalLabel usa rentalAssetPnL y no pinta nada cuando no es calculable", () => {
  const start = appSource.indexOf("function a14AssetRentalLabel(");
  const block = appSource.slice(start, start + 500);
  assert.match(block, /engine\.rentalAssetPnL\(/);
  assert.match(block, /if \(!result\.calculable\) return "";/);
});

test("app.js: renderA14AssetList pinta el P&L de alquiler de cada activo", () => {
  const start = appSource.indexOf("function renderA14AssetList(");
  const block = appSource.slice(start, start + 800);
  assert.match(block, /a14AssetRentalLabel\(asset\)/);
});

test("app.js: clearA14AssetForm limpia también el campo de ingreso de alquiler", () => {
  const start = appSource.indexOf("function clearA14AssetForm(");
  const block = appSource.slice(start, start + 600);
  assert.match(block, /a14AssetMonthlyRentIncome/);
});
