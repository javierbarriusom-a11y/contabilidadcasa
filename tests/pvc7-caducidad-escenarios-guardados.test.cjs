const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const E13 = require("../canonical-e13-scenarios.js");

// PVC7 (Oleada 3, Bloque 5): los escenarios guardados (A8-7) no caducaban — reutiliza
// recalculateSavedScenario() (misma comparación que ya usa el botón «Recalcular copia») para
// decidir si la caja mínima del escenario base se movió más de un umbral porcentual desde que se
// guardó. Solo cuenta como "desactualizado" si ADEMÁS cambió la huella del forecast — una huella
// distinta sin cambio material no es caducidad.

function recalculation({ before, after, originalFingerprint = "fp-1", currentFingerprint = "fp-1" }) {
  return {
    original: { scenarios: [{ metrics: { minChecking: before } }] },
    recalculated: { scenarios: [{ metrics: { minChecking: after } }] },
    originalForecastFingerprint: originalFingerprint,
    currentForecastFingerprint: currentFingerprint,
  };
}

test("savedScenarioStaleness · sin datos suficientes, no se marca desactualizado", () => {
  const result = E13.savedScenarioStaleness({});
  assert.equal(result.stale, false);
  assert.equal(result.reason, "sin-datos-suficientes");
});

test("savedScenarioStaleness · huella distinta pero caja mínima igual, no es caducidad", () => {
  const result = E13.savedScenarioStaleness(recalculation({ before: 1000, after: 1000, originalFingerprint: "fp-1", currentFingerprint: "fp-2" }));
  assert.equal(result.fingerprintChanged, true);
  assert.equal(result.deltaPct, 0);
  assert.equal(result.stale, false);
});

test("savedScenarioStaleness · huella igual (forecast no ha cambiado), nunca desactualizado aunque hipotéticamente moviera la cifra", () => {
  const result = E13.savedScenarioStaleness(recalculation({ before: 1000, after: 1500, originalFingerprint: "fp-1", currentFingerprint: "fp-1" }));
  assert.equal(result.fingerprintChanged, false);
  assert.equal(result.stale, false);
});

test("savedScenarioStaleness · huella distinta y caja mínima movida por encima del umbral, sí es caducidad", () => {
  const result = E13.savedScenarioStaleness(recalculation({ before: 1000, after: 1300, originalFingerprint: "fp-1", currentFingerprint: "fp-2" }));
  assert.equal(result.deltaPct, 30);
  assert.equal(result.stale, true);
});

test("savedScenarioStaleness · huella distinta pero por debajo del umbral, no es caducidad", () => {
  const result = E13.savedScenarioStaleness(recalculation({ before: 1000, after: 1050, originalFingerprint: "fp-1", currentFingerprint: "fp-2" }));
  assert.equal(result.deltaPct, 5);
  assert.equal(result.stale, false);
});

test("savedScenarioStaleness · admite un umbral distinto por opción", () => {
  const result = E13.savedScenarioStaleness(recalculation({ before: 1000, after: 1050, originalFingerprint: "fp-1", currentFingerprint: "fp-2" }), { thresholdPct: 5 });
  assert.equal(result.stale, true);
});

test("savedScenarioStaleness y SAVED_SCENARIO_STALE_THRESHOLD_PCT están exportadas", () => {
  assert.equal(typeof E13.savedScenarioStaleness, "function");
  assert.equal(E13.SAVED_SCENARIO_STALE_THRESHOLD_PCT, 20);
});

// --- Wiring ---

const appSource = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");

test("wiring: renderE13ScenarioLab pinta el badge de desactualizado usando recalculateSavedScenario + savedScenarioStaleness", () => {
  const start = appSource.indexOf('qs("e13SavedScenarios").innerHTML');
  assert.ok(start >= 0, "No existe el render de e13SavedScenarios");
  const block = appSource.slice(start, start + 900);
  assert.match(block, /E13\.recalculateSavedScenario\(/);
  assert.match(block, /E13\.savedScenarioStaleness\(/);
  assert.match(block, /staleness\.stale/);
});
