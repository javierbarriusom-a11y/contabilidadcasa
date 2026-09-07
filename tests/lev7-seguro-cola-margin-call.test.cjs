const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const Leverage = require(path.join(root, "canonical-leverage-simulator.js"));
const appSource = fs.readFileSync(path.join(root, "app.js"), "utf8");
const indexSource = fs.readFileSync(path.join(root, "index.html"), "utf8");

// LEV7 (Oleada 3, Bloque 4): seguro de cola frente a margin call. Decisión del hogar (sesión 159):
// "el peor 5%" se define sobre la banda P10/P50/P90 YA calibrada del Monte Carlo de ESX1
// (minCheckingPercentiles), sin abrir una calibración de cola de mercado nueva. Pregunta que
// responde: si la llamada de garantía se disparase justo en el peor escenario de liquidez ya
// simulado (P10), ¿la caja mínima de ese escenario cubre la garantía adicional exigida?

test("tailRiskAgainstMarginCall · sin margin call calculable, no calculable", () => {
  const result = Leverage.tailRiskAgainstMarginCall({ marginCallResult: { calculable: false }, minCheckingPercentiles: { p10: 1000 } });
  assert.equal(result.calculable, false);
  assert.equal(result.reason, "margin-call-not-calculable");
});

test("tailRiskAgainstMarginCall · margin call calculable pero no disparado, no hay nada que cubrir", () => {
  const result = Leverage.tailRiskAgainstMarginCall({
    marginCallResult: { calculable: true, marginCallTriggered: false },
    minCheckingPercentiles: { p10: 1000 },
  });
  assert.equal(result.calculable, true);
  assert.equal(result.marginCallTriggered, false);
});

test("tailRiskAgainstMarginCall · margin call disparado sin P10 calibrado (sin histórico de Monte Carlo), no calculable", () => {
  const result = Leverage.tailRiskAgainstMarginCall({
    marginCallResult: { calculable: true, marginCallTriggered: true, additionalCollateralNeeded: 5000 },
    minCheckingPercentiles: {},
  });
  assert.equal(result.calculable, false);
  assert.equal(result.reason, "missing-p10");
});

test("tailRiskAgainstMarginCall · la caja del peor escenario (P10) cubre la garantía exigida", () => {
  const result = Leverage.tailRiskAgainstMarginCall({
    marginCallResult: { calculable: true, marginCallTriggered: true, additionalCollateralNeeded: 3000 },
    minCheckingPercentiles: { p10: 5000, p50: 8000, p90: 12000 },
  });
  assert.equal(result.calculable, true);
  assert.equal(result.marginCallTriggered, true);
  assert.equal(result.worstCaseLiquidityP10, 5000);
  assert.equal(result.covered, true);
  assert.equal(result.shortfall, 0);
});

test("tailRiskAgainstMarginCall · la caja del peor escenario no cubre la garantía: hay hueco (falta seguro de cola)", () => {
  const result = Leverage.tailRiskAgainstMarginCall({
    marginCallResult: { calculable: true, marginCallTriggered: true, additionalCollateralNeeded: 8000 },
    minCheckingPercentiles: { p10: 5000, p50: 8000, p90: 12000 },
  });
  assert.equal(result.covered, false);
  assert.equal(result.shortfall, 3000);
});

test("tailRiskAgainstMarginCall · un P10 negativo (caja ya en negativo en el peor escenario) se trata como 0 de liquidez, nunca resta", () => {
  const result = Leverage.tailRiskAgainstMarginCall({
    marginCallResult: { calculable: true, marginCallTriggered: true, additionalCollateralNeeded: 1000 },
    minCheckingPercentiles: { p10: -500 },
  });
  assert.equal(result.worstCaseLiquidityP10, 0);
  assert.equal(result.covered, false);
  assert.equal(result.shortfall, 1000);
});

test("tailRiskAgainstMarginCall está exportado", () => {
  assert.equal(typeof Leverage.tailRiskAgainstMarginCall, "function");
});

// --- Wiring ---

test("wiring: la tarjeta de LEV7 vive en index.html, junto al simulador de margin call (APX3)", () => {
  const apx3Pos = indexSource.indexOf('id="apx3MarginCallNote"');
  const lev7Pos = indexSource.indexOf('id="lev7TailRiskNote"');
  assert.ok(apx3Pos >= 0 && lev7Pos >= 0, "Faltan los contenedores de APX3 o LEV7");
});

test("wiring: renderLev7TailRisk compone lombardMarginCallSimulation con monteCarloSimulation (ESX1)", () => {
  const start = appSource.indexOf("function renderLev7TailRisk(");
  assert.ok(start >= 0, "No existe renderLev7TailRisk");
  const block = appSource.slice(start, start + 1600);
  assert.match(block, /tailRiskAgainstMarginCall\(/);
  assert.match(block, /monteCarloSimulation\(/);
  assert.match(block, /lombardMarginCallSimulation\(/);
});

test("wiring: el botón de margin call también dispara renderLev7TailRisk", () => {
  const start = appSource.indexOf("function handleApx3MarginCallSimulate(");
  const block = appSource.slice(start, start + 1200);
  assert.match(block, /renderLev7TailRisk\(\);/);
});
