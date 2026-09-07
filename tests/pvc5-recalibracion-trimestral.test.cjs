const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const E13 = require(path.join(root, "canonical-e13-scenarios.js"));
const appSource = fs.readFileSync(path.join(root, "app.js"), "utf8");
const indexSource = fs.readFileSync(path.join(root, "index.html"), "utf8");

// PVC5 (Oleada 3, Bloque 4): recalibración trimestral del triángulo Monte Carlo. Decisión del hogar
// (sesión 159): ventana de 8 trimestres (24 meses), con confirmación explícita del hogar antes de
// aplicar (nunca automático). Reutiliza prudentSimulation() tal cual, comparando todo el histórico
// contra el recortado a la ventana — sin motor nuevo de percentiles.

function buildForecast() {
  return {
    schemaId: "finance-canonical-forecast/v1",
    valid: true,
    fingerprint: "test",
    assumptions: { items: [{ id: "openingChecking", value: 1000 }, { id: "openingSavings", value: 0 }] },
    series: Array.from({ length: 6 }, (_, index) => ({
      monthKey: `2026-${String(index + 1).padStart(2, "0")}`,
      label: `Mes ${index + 1}`,
      totals: { income: 3000, outflowsBeforeSaving: 2000, saving: 0 },
    })),
  };
}

function historyEntry(monthKey, amount) {
  return { monthKey, conceptId: "monthly-net", label: monthKey, planned: amount, actual: amount, amount, reconciled: true };
}

test("windowedHistory · recorta a los últimos N*3 meses (incluido el mes de referencia)", () => {
  const history = [
    historyEntry("2024-01", 100),
    historyEntry("2024-06", 100),
    historyEntry("2025-01", 100),
    historyEntry("2025-06", 100),
    historyEntry("2026-01", 100),
    historyEntry("2026-06", 100),
  ];
  const windowed = E13.windowedHistory(history, "2026-06", 8); // 24 meses: desde 2024-07 en adelante
  const monthKeys = windowed.map((item) => item.monthKey);
  assert.deepEqual(monthKeys, ["2025-01", "2025-06", "2026-01", "2026-06"]);
});

test("windowedHistory · sin monthKey de referencia válido, devuelve el histórico completo sin recortar", () => {
  const history = [historyEntry("2026-01", 100)];
  const windowed = E13.windowedHistory(history, "", 8);
  assert.equal(windowed.length, 1);
});

test("windowedHistory · una ventana de 1 trimestre recorta a los últimos 3 meses", () => {
  const history = [historyEntry("2026-01", 100), historyEntry("2026-04", 100), historyEntry("2026-06", 100)];
  const windowed = E13.windowedHistory(history, "2026-06", 1);
  assert.deepEqual(windowed.map((item) => item.monthKey), ["2026-04", "2026-06"]);
});

test("quarterlyRecalibrationProposal · sin histórico, ambos triángulos caen al rango manual (sin cambio)", () => {
  const forecast = buildForecast();
  const result = E13.quarterlyRecalibrationProposal(forecast, [], {
    history: [],
    asOfMonthKey: "2026-06",
    quarters: 8,
    manualRange: { min: -500, base: 0, max: 500 },
  });
  assert.equal(result.windowMonths, 24);
  assert.equal(result.changed, false);
  assert.deepEqual(result.currentPercentiles, { p10: -500, p50: 0, p90: 500 });
  assert.deepEqual(result.proposedPercentiles, { p10: -500, p50: 0, p90: 500 });
});

test("quarterlyRecalibrationProposal · con histórico suficiente pero disperso en el tiempo, la ventana recorta la muestra y cambia el triángulo", () => {
  const forecast = buildForecast();
  // 6 observaciones antiguas (fuera de la ventana de 24 meses) con un valor, y 6 recientes con otro
  // muy distinto — solo las recientes deberían sobrevivir a la ventana.
  const oldHistory = ["2020-01", "2020-02", "2020-03", "2020-04", "2020-05", "2020-06"].map((m) => historyEntry(m, -1000));
  const recentHistory = ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"].map((m) => historyEntry(m, 500));
  const result = E13.quarterlyRecalibrationProposal(forecast, [], {
    history: [...oldHistory, ...recentHistory],
    asOfMonthKey: "2026-06",
    quarters: 8,
    manualRange: { min: -500, base: 0, max: 500 },
  });
  assert.equal(result.currentSampleSize, 12);
  assert.equal(result.proposedSampleSize, 6);
  assert.equal(result.proposedCalibrated, true);
  assert.equal(result.proposedPercentiles.p50, 500);
  assert.equal(result.changed, true);
});

test("quarterlyRecalibrationProposal está exportado", () => {
  assert.equal(typeof E13.quarterlyRecalibrationProposal, "function");
  assert.equal(typeof E13.windowedHistory, "function");
});

// --- Wiring ---

test("wiring: la tarjeta de PVC5 vive en index.html, en el Laboratorio de escenarios", () => {
  assert.match(indexSource, /id="pvc5RecalibrationNote"/);
});

test("wiring: renderPvc5RecalibrationNote usa quarterlyRecalibrationProposal", () => {
  const start = appSource.indexOf("function renderPvc5RecalibrationNote(");
  assert.ok(start >= 0, "No existe renderPvc5RecalibrationNote");
  const block = appSource.slice(start, start + 2000);
  assert.match(block, /quarterlyRecalibrationProposal\(/);
});

test("wiring: aplicar la ventana exige confirmación explícita (botón), nunca se aplica sola", () => {
  assert.match(appSource, /function savePvc5WindowConfirmation\(/);
  assert.match(appSource, /pvc5ApplyWindow/);
});

test("wiring: una vez confirmada, esx1HistoryForCalibration devuelve el histórico recortado; si no, el completo", () => {
  const start = appSource.indexOf("function esx1HistoryForCalibration(");
  assert.ok(start >= 0, "No existe esx1HistoryForCalibration");
  const block = appSource.slice(start, start + 500);
  assert.match(block, /pvc5QuarterlyWindowConfirmed\(\)/);
  assert.match(block, /windowedHistory\(/);
});

test("wiring: el Laboratorio de escenarios (renderE13ScenarioLab) usa esx1HistoryForCalibration para el triángulo, no el histórico crudo directamente en prudentSimulation/monteCarloSimulation", () => {
  const start = appSource.indexOf("function renderE13ScenarioLab(");
  assert.ok(start >= 0, "No existe renderE13ScenarioLab");
  const block = appSource.slice(start, start + 6200);
  assert.match(block, /E13\.prudentSimulation\(forecast, e13ScenarioEvents, \{ history: esx1HistoryForCalibration\(history\)/);
  assert.match(block, /E13\.monteCarloSimulation\(forecast, e13ScenarioEvents, \{ history: esx1HistoryForCalibration\(history\)/);
});
