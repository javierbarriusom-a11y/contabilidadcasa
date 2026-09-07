const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const Portfolio = require(path.join(root, "canonical-portfolio.js"));
const appSource = fs.readFileSync(path.join(root, "app.js"), "utf8");
const indexSource = fs.readFileSync(path.join(root, "index.html"), "utf8");

// INV1 (Oleada 3, Bloque 4): clase de activo por posición, declarada a mano, comparada contra la
// banda de horizonte de IVX6 — decisión del hogar de abrir esta dimensión de datos nueva, aceptando
// que exige mantenerla actualizada. Vive en el registro RAW de la posición (igual que goalId), no en
// normalizePosition — solo hace falta para esta comparación, nunca para el resto de la cartera.

test("ASSET_CLASS_TYPES define las cuatro clases declarables, y su perfil de riesgo (creciente/defensivo)", () => {
  assert.deepEqual(Portfolio.ASSET_CLASS_TYPES, ["renta-variable", "renta-fija", "monetario", "alternativo"]);
  assert.equal(Portfolio.ASSET_CLASS_RISK_PROFILE["renta-variable"], "growth");
  assert.equal(Portfolio.ASSET_CLASS_RISK_PROFILE.alternativo, "growth");
  assert.equal(Portfolio.ASSET_CLASS_RISK_PROFILE["renta-fija"], "defensive");
  assert.equal(Portfolio.ASSET_CLASS_RISK_PROFILE.monetario, "defensive");
});

test("assetClassVsGlidePath · sin posiciones ligadas a ese objetivo, no calculable", () => {
  const result = Portfolio.assetClassVsGlidePath({ goalId: "casa", positions: [] }, "conservative");
  assert.equal(result.calculable, false);
});

test("assetClassVsGlidePath · ignora posiciones de otros objetivos", () => {
  const positions = [
    { id: "p1", goalId: "otro-objetivo", currentValue: 10000, assetClass: "renta-variable" },
  ];
  const result = Portfolio.assetClassVsGlidePath({ goalId: "casa", positions }, "conservative");
  assert.equal(result.calculable, false);
});

test("assetClassVsGlidePath · agrega valor y % por clase declarada, agrupa lo no clasificado aparte", () => {
  const positions = [
    { id: "p1", goalId: "casa", currentValue: 6000, assetClass: "renta-variable" },
    { id: "p2", goalId: "casa", currentValue: 3000, assetClass: "renta-fija" },
    { id: "p3", goalId: "casa", currentValue: 1000 }, // sin assetClass declarado
  ];
  const result = Portfolio.assetClassVsGlidePath({ goalId: "casa", positions }, "transition");
  assert.equal(result.calculable, true);
  assert.equal(result.totalValue, 10000);
  const byClass = Object.fromEntries(result.rows.map((row) => [row.assetClass, row]));
  assert.equal(byClass["renta-variable"].pct, 60);
  assert.equal(byClass["renta-fija"].pct, 30);
  assert.equal(byClass["sin-clasificar"].pct, 10);
});

test("assetClassVsGlidePath · un assetClass declarado que no está en la lista válida cae en 'sin-clasificar'", () => {
  const positions = [{ id: "p1", goalId: "casa", currentValue: 5000, assetClass: "cripto-de-toda-la-vida" }];
  const result = Portfolio.assetClassVsGlidePath({ goalId: "casa", positions }, "growth");
  assert.equal(result.rows[0].assetClass, "sin-clasificar");
});

test("assetClassVsGlidePath · banda conservadora con más de 50% en clases de crecimiento: aviso de descuadre", () => {
  const positions = [
    { id: "p1", goalId: "casa", currentValue: 7000, assetClass: "renta-variable" },
    { id: "p2", goalId: "casa", currentValue: 3000, assetClass: "renta-fija" },
  ];
  const result = Portfolio.assetClassVsGlidePath({ goalId: "casa", positions }, "conservative");
  assert.equal(result.growthPct, 70);
  assert.equal(result.mismatch, "growth-heavy-for-defensive-band");
});

test("assetClassVsGlidePath · banda de crecimiento con más de 50% defensivo: aviso en el otro sentido", () => {
  const positions = [
    { id: "p1", goalId: "casa", currentValue: 2000, assetClass: "renta-variable" },
    { id: "p2", goalId: "casa", currentValue: 8000, assetClass: "monetario" },
  ];
  const result = Portfolio.assetClassVsGlidePath({ goalId: "casa", positions }, "growth");
  assert.equal(result.defensivePct, 80);
  assert.equal(result.mismatch, "defensive-heavy-for-growth-band");
});

test("assetClassVsGlidePath · sin descuadre cuando la composición ya encaja con la banda", () => {
  const positions = [
    { id: "p1", goalId: "casa", currentValue: 8000, assetClass: "renta-variable" },
    { id: "p2", goalId: "casa", currentValue: 2000, assetClass: "renta-fija" },
  ];
  const result = Portfolio.assetClassVsGlidePath({ goalId: "casa", positions }, "growth");
  assert.equal(result.mismatch, null);
});

test("assetClassVsGlidePath está exportado", () => {
  assert.equal(typeof Portfolio.assetClassVsGlidePath, "function");
});

// --- Wiring ---

test("wiring: el formulario de posiciones (IV1) tiene un campo de clase de activo", () => {
  assert.match(indexSource, /id="iv1PositionAssetClass"/);
});

test("wiring: saveIv1Position guarda assetClass en el registro de la posición (mismo patrón que goalId)", () => {
  const start = appSource.indexOf("function saveIv1Position(");
  const block = appSource.slice(start, start + 2200);
  assert.match(block, /iv1PositionAssetClass/);
  assert.match(block, /assetClass/);
});

test("wiring: renderIvx6GlidePath también pinta la comparación de clase de activo (INV1)", () => {
  const start = appSource.indexOf("function renderIvx6GlidePath(");
  assert.ok(start >= 0, "No existe renderIvx6GlidePath");
  const block = appSource.slice(start, start + 1800);
  assert.match(block, /assetClassVsGlidePath\(/);
});

test("wiring: la tarjeta de INV1 vive en index.html", () => {
  assert.match(indexSource, /id="inv1AssetClassNote"/);
});
