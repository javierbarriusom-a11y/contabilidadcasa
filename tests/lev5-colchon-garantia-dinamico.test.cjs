const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const Leverage = require(path.join(root, "canonical-leverage-simulator.js"));
const appSource = fs.readFileSync(path.join(root, "app.js"), "utf8");
const indexSource = fs.readFileSync(path.join(root, "index.html"), "utf8");

// LEV5 (Oleada 3, Bloque 4): colchón de garantía dinámico según volatilidad declarada. Decisión del
// hogar (sesión 159): banda de volatilidad declarada a mano por clase de activo (mismo criterio que
// el triángulo de ESX1), no calculada de un histórico que la app no guarda. Alimenta el
// `stressDropPct` de APX3 (margin call) con una caída ponderada por la composición REAL de la
// cartera pignorada, en vez de un valor único escrito a mano en cada simulación.

test("weightedPortfolioStressDropPct · sin posiciones, no calculable", () => {
  const result = Leverage.weightedPortfolioStressDropPct({ positions: [], volatilityBands: { "renta-variable": 40 } });
  assert.equal(result.calculable, false);
});

test("weightedPortfolioStressDropPct · sin ninguna banda declarada, no calculable (nunca una caída inventada)", () => {
  const positions = [{ id: "p1", currentValue: 10000, assetClass: "renta-variable" }];
  const result = Leverage.weightedPortfolioStressDropPct({ positions, volatilityBands: {} });
  assert.equal(result.calculable, false);
});

test("weightedPortfolioStressDropPct · pondera la caída declarada por el valor de cada clase presente en la cartera", () => {
  const positions = [
    { id: "p1", currentValue: 7000, assetClass: "renta-variable" },
    { id: "p2", currentValue: 3000, assetClass: "renta-fija" },
  ];
  const result = Leverage.weightedPortfolioStressDropPct({
    positions,
    volatilityBands: { "renta-variable": 40, "renta-fija": 10 },
  });
  assert.equal(result.calculable, true);
  // (7000*40 + 3000*10) / 10000 = 31
  assert.equal(result.weightedDropPct, 31);
  assert.equal(result.coveragePct, 100);
});

test("weightedPortfolioStressDropPct · una posición sin clase declarada, o cuya clase no tiene banda, queda fuera del cálculo", () => {
  const positions = [
    { id: "p1", currentValue: 6000, assetClass: "renta-variable" },
    { id: "p2", currentValue: 4000 }, // sin assetClass
    { id: "p3", currentValue: 2000, assetClass: "alternativo" }, // sin banda declarada para "alternativo"
  ];
  const result = Leverage.weightedPortfolioStressDropPct({
    positions,
    volatilityBands: { "renta-variable": 40 },
  });
  assert.equal(result.calculable, true);
  assert.equal(result.weightedDropPct, 40);
  assert.equal(result.classifiedValue, 6000);
  assert.equal(result.totalValue, 12000);
  assert.equal(result.unclassifiedValue, 6000);
  assert.equal(result.coveragePct, 50);
});

test("weightedPortfolioStressDropPct · una banda declarada fuera de 0-100 se recorta", () => {
  const positions = [{ id: "p1", currentValue: 5000, assetClass: "renta-variable" }];
  const result = Leverage.weightedPortfolioStressDropPct({ positions, volatilityBands: { "renta-variable": 150 } });
  assert.equal(result.weightedDropPct, 100);
});

test("weightedPortfolioStressDropPct alimenta lombardMarginCallSimulation (APX3) igual que un stressDropPct declarado a mano", () => {
  const positions = [{ id: "p1", currentValue: 100000, assetClass: "renta-variable" }];
  const stress = Leverage.weightedPortfolioStressDropPct({ positions, volatilityBands: { "renta-variable": 30 } });
  const result = Leverage.lombardMarginCallSimulation({
    portfolioValue: 100000,
    loanAmount: 60000,
    maintenanceLtvPct: 70,
    stressDropPct: stress.weightedDropPct,
  });
  assert.equal(result.calculable, true);
  assert.equal(result.stressDropPct, 30);
});

test("weightedPortfolioStressDropPct está exportado", () => {
  assert.equal(typeof Leverage.weightedPortfolioStressDropPct, "function");
});

// --- Wiring ---

test("wiring: el formulario declara la banda de volatilidad por clase de activo", () => {
  ["lev5VolatilityRentaVariable", "lev5VolatilityRentaFija", "lev5VolatilityMonetario", "lev5VolatilityAlternativo"].forEach((id) => {
    assert.match(indexSource, new RegExp(`id="${id}"`), `Falta #${id} en index.html`);
  });
});

test("wiring: la tarjeta de LEV5 vive en index.html, junto al simulador de margin call (APX3)", () => {
  const apx3Pos = indexSource.indexOf('id="apx3MarginCallNote"');
  const lev5Pos = indexSource.indexOf('id="lev5DynamicStressNote"');
  assert.ok(apx3Pos >= 0, "Falta el contenedor de APX3");
  assert.ok(lev5Pos >= 0, "Falta #lev5DynamicStressNote");
});

test("wiring: renderLev5DynamicStress usa weightedPortfolioStressDropPct y normalizePositions", () => {
  const start = appSource.indexOf("function renderLev5DynamicStress(");
  assert.ok(start >= 0, "No existe renderLev5DynamicStress");
  const block = appSource.slice(start, start + 1500);
  assert.match(block, /weightedPortfolioStressDropPct\(/);
  assert.match(block, /normalizePositions\(/);
});

test("wiring: hay un guardado de bandas de volatilidad persistido (scenarioSettings)", () => {
  assert.match(appSource, /function saveLev5VolatilityBands\(/);
  assert.match(appSource, /function lev5VolatilityBands\(/);
});
