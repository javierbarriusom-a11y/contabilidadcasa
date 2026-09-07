const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// PVC6 (Oleada 3, Bloque 3): previsión con control de versiones. Mismo patrón local que C-13/D-2b
// (#5): un snapshot congelado del registro de supuestos versionado (A7-2/E12a) en cada cierre de
// mes firmado (A1-2), para poder comparar "qué preveíamos entonces" contra "qué prevemos ahora"
// con diffAssumptionSnapshots (canonical-forecast.js) — sin tocar el RPC transaccional.

const appSource = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const indexSource = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

test("la tarjeta de control de versiones vive en Ajustes, junto al autoajuste de la previsión", () => {
  const autoAdjustPos = indexSource.indexOf('id="ajustesAutoAdjustForecastBiasNote"');
  const pvc6Pos = indexSource.indexOf('id="pvc6SnapshotSelect"');
  assert.ok(autoAdjustPos >= 0 && pvc6Pos > autoAdjustPos);
  ["pvc6SnapshotSelect", "pvc6SnapshotCompare", "pvc6SnapshotDiffNote"].forEach((id) => {
    assert.match(indexSource, new RegExp(`id="${id}"`));
  });
});

test("recordPvc6ForecastSnapshot guarda el registro de supuestos del escenario base, sin recalcular nada", () => {
  const block = appSource.slice(appSource.indexOf("function recordPvc6ForecastSnapshot("), appSource.indexOf("function recordPvc6ForecastSnapshot(") + 500);
  assert.match(block, /canonicalScenarioResults\.base\?\.forecast\?\.assumptions/);
});

test("el cierre de mes firmado (A1-2) registra el snapshot de PVC6, mismo espíritu que C-13/D-2b", () => {
  assert.match(appSource, /recalibrateForecastLearning\(month, closedAt\);[\s\S]{0,200}recordPvc6ForecastSnapshot\(month, closedAt\);/);
});

test("handlePvc6SnapshotCompare reutiliza FinanceCanonicalForecast.diffAssumptionSnapshots, sin motor propio", () => {
  const block = appSource.slice(appSource.indexOf("function handlePvc6SnapshotCompare("), appSource.indexOf("function handlePvc6SnapshotCompare(") + 700);
  assert.match(block, /window\.FinanceCanonicalForecast/);
  assert.match(block, /diffAssumptionSnapshots\(/);
});

test("el botón de comparar está conectado y el select se rellena en el arranque de la app", () => {
  assert.match(appSource, /qs\("pvc6SnapshotCompare"\)\?\.addEventListener\("click", handlePvc6SnapshotCompare\)/);
  assert.match(appSource, /renderDeb4RefinancingRadar\(\);\s*\n\s*renderPvc6SnapshotOptions\(\);/);
});
