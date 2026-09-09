const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const F = require("../canonical-forecast.js");

// PVC8 (Oleada 3, Bloque 5): recomputeModelIfNeeded() ya recalcula el forecast al instante en cada
// cambio (PVX3) — lo que faltaba era decidir cuándo ese recálculo es lo bastante grande para avisar.
// Umbral doble (absoluto Y relativo a la caja disponible ahora mismo): solo avisa si supera los dos
// a la vez, para no ser ni demasiado sensible con colchones grandes ni demasiado laxo con pequeños.

test("reforecastMaterialityAlert · sin un antes/después numérico, nunca es material", () => {
  const result = F.reforecastMaterialityAlert(null, 1000, 5000);
  assert.equal(result.material, false);
});

test("reforecastMaterialityAlert · cambio pequeño en términos absolutos, no es material aunque el % sea alto", () => {
  // delta 50€ (bajo el umbral absoluto de 200€) sobre una caja de 100€ (50%, sobre el umbral relativo)
  const result = F.reforecastMaterialityAlert(50, 100, 100);
  assert.equal(result.material, false);
});

test("reforecastMaterialityAlert · cambio grande en términos absolutos, no es material si es % pequeño de la caja", () => {
  // delta 500€ (sobre el umbral absoluto) sobre una caja de 100.000€ (0.5%, bajo el umbral relativo)
  const result = F.reforecastMaterialityAlert(50000, 50500, 100000);
  assert.equal(result.material, false);
});

test("reforecastMaterialityAlert · material solo cuando supera los dos umbrales a la vez", () => {
  const result = F.reforecastMaterialityAlert(1000, 1500, 2000); // delta 500€, 25% de la caja de 2000€
  assert.equal(result.delta, 500);
  assert.equal(result.deltaPct, 25);
  assert.equal(result.material, true);
});

test("reforecastMaterialityAlert · admite umbrales personalizados", () => {
  const result = F.reforecastMaterialityAlert(1000, 1050, 2000, { absoluteThreshold: 10, relativeThresholdPct: 1 });
  assert.equal(result.material, true);
});

test("reforecastMaterialityAlert está exportada con sus umbrales por defecto", () => {
  assert.equal(typeof F.reforecastMaterialityAlert, "function");
  assert.deepEqual(F.REFORECAST_MATERIALITY_DEFAULT, { absoluteThreshold: 200, relativeThresholdPct: 10 });
});

// --- Wiring ---

const appSource = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const p2UiSource = fs.readFileSync(path.join(__dirname, "..", "p2-ui.js"), "utf8");

test("wiring: recomputeModelIfNeeded captura la caja mínima ANTES de sobrescribir lastSimulation", () => {
  const start = appSource.indexOf("function recomputeModelIfNeeded(");
  const block = appSource.slice(start, start + 2100);
  const beforeIndex = block.indexOf("pvc8PreviousMinChecking");
  const overwriteIndex = block.indexOf("lastSimulation = activeScenario.rows;");
  assert.ok(beforeIndex >= 0 && beforeIndex < overwriteIndex, "pvc8PreviousMinChecking debe calcularse antes de sobrescribir lastSimulation");
  assert.match(block, /window\.FinanceCanonicalForecast\.reforecastMaterialityAlert\(/);
});

test("wiring: FinanceP2Bridge expone reforecastMaterialityAlert", () => {
  const block = appSource.slice(appSource.indexOf("window.FinanceP2Bridge = {"), appSource.indexOf("window.FinanceP2Bridge = {") + 700);
  assert.match(block, /reforecastMaterialityAlert: \(\) => pvc8MaterialityAlert/);
});

test("wiring: reforecastMaterialityHtml lee del puente P2 y solo pinta si alert.material", () => {
  const block = p2UiSource.slice(p2UiSource.indexOf("function reforecastMaterialityHtml("), p2UiSource.indexOf("function reforecastMaterialityHtml(") + 500);
  assert.match(block, /bridge\(\)\?\.reforecastMaterialityAlert\?\.\(\)/);
  assert.match(block, /if \(!alert\?\.material\) return "";/);
});

test("wiring: E15 y E16 muestran la alerta de materialidad junto al indicador de recálculo", () => {
  const e15Block = p2UiSource.slice(p2UiSource.indexOf("function renderE15Planning("), p2UiSource.indexOf("function renderE15Planning(") + 2000);
  assert.match(e15Block, /\$\{recomputedAgoHtml\(\)\}\$\{reforecastMaterialityHtml\(\)\}/);
  const e16Block = p2UiSource.slice(p2UiSource.indexOf("function renderE16Monitoring("), p2UiSource.indexOf("function renderE16Monitoring(") + 1600);
  assert.match(e16Block, /\$\{recomputedAgoHtml\(\)\}\$\{reforecastMaterialityHtml\(\)\}/);
});
