const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const F = require("../canonical-forecast.js");

// PVC4 (Oleada 3, Bloque 5): extiende learnFromHistory()/deviations (A11-3) — un único promedio
// sobre todo el histórico reconciliado — a tres ventanas de tiempo (3/6/12 meses) por partida, para
// distinguir sesgo sistemático (misma dirección de desviación en las ventanas con datos) de una
// desviación reciente que no se sostiene en el histórico largo.

function record(conceptId, monthKey, planned, actual) {
  return { conceptId, label: conceptId, monthKey, planned, actual, reconciled: true };
}

test("categoryDriftWindows · sin histórico, no hay partidas", () => {
  assert.deepEqual(F.categoryDriftWindows([]), []);
});

test("categoryDriftWindows · ignora registros no reconciliados o sin planned/actual numéricos", () => {
  const records = [
    { conceptId: "ocio", label: "Ocio", monthKey: "2026-01", planned: 100, actual: 130, reconciled: false },
    { conceptId: "ocio", label: "Ocio", monthKey: "2026-02", planned: 100, actual: null, reconciled: true },
  ];
  assert.deepEqual(F.categoryDriftWindows(records), []);
});

test("categoryDriftWindows · sesgo sistemático cuando la desviación va siempre en la misma dirección", () => {
  const months = ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"];
  const records = months.map((m) => record("ocio", m, 100, 130));
  const [result] = F.categoryDriftWindows(records, [3, 6, 12]);
  assert.equal(result.systematic, true);
  assert.equal(result.windows[0].sampleMonths, 3);
  assert.equal(result.windows[0].averageDelta, 30);
  assert.equal(result.windows[1].sampleMonths, 6);
  assert.equal(result.windows[2].sampleMonths, 6); // solo hay 6 meses de histórico: la ventana de 12 usa los 6 disponibles, no menos
});

test("categoryDriftWindows · sin sesgo sistemático cuando la desviación cambia de signo", () => {
  const records = [
    record("ocio", "2026-01", 100, 130),
    record("ocio", "2026-02", 100, 70),
    record("ocio", "2026-03", 100, 130),
  ];
  const [result] = F.categoryDriftWindows(records, [3]);
  assert.equal(result.systematic, false);
});

test("categoryDriftWindows · trend detecta empeoramiento cuando la ventana corta desvía más que la larga", () => {
  const oldMonths = ["2025-01", "2025-02", "2025-03", "2025-04", "2025-05", "2025-06"].map((m) => record("ocio", m, 100, 105));
  const recentMonths = ["2026-01", "2026-02", "2026-03"].map((m) => record("ocio", m, 100, 150));
  const [result] = F.categoryDriftWindows([...recentMonths, ...oldMonths], [3, 9]);
  assert.equal(result.trend, "empeorando");
});

test("categoryDriftWindows está exportada", () => {
  assert.equal(typeof F.categoryDriftWindows, "function");
});

// --- Wiring ---

const appSource = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const indexSource = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

test("wiring: la tarjeta de PVC4 vive en Ajustes › Presupuesto y operación", () => {
  assert.match(indexSource, /id="pvc4CategoryDrift"/);
  assert.match(indexSource, /Marcador de deriva por partida/);
});

test("wiring: pvc4CategoryHistoryRecords reutiliza registrarMesCollect() sobre los meses ya archivados en cierre, no un histórico inventado", () => {
  const start = appSource.indexOf("function pvc4CategoryHistoryRecords(");
  assert.ok(start >= 0, "No existe pvc4CategoryHistoryRecords");
  const block = appSource.slice(start, start + 700);
  assert.match(block, /loadCierreReportArchive\(\)/);
  assert.match(block, /registrarMesCollect\(/);
});

test("wiring: renderPvc4CategoryDrift usa categoryDriftWindows y se llama en renderAjustes", () => {
  const start = appSource.indexOf("function renderPvc4CategoryDrift(");
  assert.ok(start >= 0, "No existe renderPvc4CategoryDrift");
  const block = appSource.slice(start, start + 300);
  assert.match(block, /categoryDriftWindows\(pvc4CategoryHistoryRecords\(\)\)/);
  assert.match(appSource, /renderPvx5CausalTree\(\);\s*\n\s*renderPvc4CategoryDrift\(\);/);
});
