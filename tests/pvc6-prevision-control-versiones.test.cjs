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

// OPT-25 (fase 5, 11 sept. 2026): la tarjeta se trasladó de Ajustes › Presupuesto y operación a
// Herramientas avanzadas → Analizar (#herramientas-analizar) — mismos ids, misma función, solo
// cambia dónde vive en el DOM. El autoajuste de la previsión se queda en Ajustes.
test("la tarjeta de control de versiones vive en Herramientas avanzadas → Analizar", () => {
  const openTag = /<section[^>]*id="herramientas-analizar"[^>]*>/.exec(indexSource);
  assert.ok(openTag, "No existe la sección #herramientas-analizar");
  const start = openTag.index + openTag[0].length;
  const end = indexSource.indexOf("</section>", start);
  const herramientasAnalizar = indexSource.slice(start, end);
  ["pvc6SnapshotSelect", "pvc6SnapshotCompare", "pvc6SnapshotDiffNote"].forEach((id) => {
    assert.match(herramientasAnalizar, new RegExp(`id="${id}"`));
  });
  assert.match(indexSource, /id="ajustesAutoAdjustForecastBiasNote"/, "el autoajuste de la previsión debe seguir en Ajustes");
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
  assert.match(appSource, /renderFc3PriorLossList\(\);\s*\n\s*renderPvc6SnapshotOptions\(\);/);
});
