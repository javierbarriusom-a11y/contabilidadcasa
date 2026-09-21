const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// I2 (Contabilidadcasa 2.0, sesión 217): serie histórica real de valoraciones por posición — hueco
// de datos documentado desde la Oleada 2 (APX4/IVX1/IVX5). No se fabrica historial que no existe:
// esto solo arranca su captura desde hoy, un snapshot por cierre firmado, mismo patrón local que
// ya usan C-13/D-2b/PVC6 (recalibrateForecastLearning, saveDebtCapitalSnapshotAtClose,
// recordPvc6ForecastSnapshot) — no toca el RPC transaccional ni el esquema remoto de Supabase.

const appSource = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const indexSource = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const inversionViewSource = fs.readFileSync(path.join(__dirname, "..", "views", "inversion.js"), "utf8");

test("recordIv1ValuationSnapshot lee las posiciones reales (iv1PositionsList), nunca fabrica datos", () => {
  const block = appSource.slice(appSource.indexOf("function recordIv1ValuationSnapshot("), appSource.indexOf("function recordIv1ValuationSnapshot(") + 500);
  assert.match(block, /const rows = iv1PositionsList\(\);/);
  assert.match(block, /if \(!rows\.length\) return;/, "sin posiciones reales no debe guardar ningún snapshot");
  assert.match(block, /currentValue: round2\(position\.currentValue \|\| 0\)/);
  assert.match(block, /costBasis: round2\(position\.costBasis \|\| 0\)/);
});

test("recordIv1ValuationSnapshot es idempotente: un cierre repetido del mismo mes sustituye, no duplica", () => {
  const block = appSource.slice(appSource.indexOf("function recordIv1ValuationSnapshot("), appSource.indexOf("function recordIv1ValuationSnapshot(") + 500);
  assert.match(block, /\.filter\(\(entry\) => entry\.monthKey !== monthKey\)/);
  assert.match(block, /history\.unshift\(\{ monthKey, closedAt, positions \}\)/);
});

test("saveIv1ValuationHistory limita el historial, mismo criterio de tope que PVC6", () => {
  assert.match(appSource, /const IV1_VALUATION_SNAPSHOTS_MAX = 60;/);
  const block = appSource.slice(appSource.indexOf("function saveIv1ValuationHistory("), appSource.indexOf("function saveIv1ValuationHistory(") + 300);
  assert.match(block, /list\.slice\(0, IV1_VALUATION_SNAPSHOTS_MAX\)/);
});

test("loadIv1ValuationHistory nunca revienta con un almacenamiento corrupto o vacío", () => {
  const block = appSource.slice(appSource.indexOf("function loadIv1ValuationHistory("), appSource.indexOf("function loadIv1ValuationHistory(") + 400);
  assert.match(block, /catch \{\s*\n\s*return \[\];\s*\n\s*\}/);
  assert.match(block, /storageGet\(storageKey\("iv1-valuation-snapshots"\), "\[\]"\)/);
});

test("el cierre de mes firmado registra el snapshot de I2, mismo espíritu que C-13/D-2b/PVC6", () => {
  assert.match(appSource, /recordCierreReportArchive\(month, closedAt\);[\s\S]{0,200}recordIv1ValuationSnapshot\(month, closedAt\);/);
});

// --- renderIv1ValuationHistoryNote (única superficie visible, nunca en silencio) ----------------

test("renderIv1ValuationHistoryNote · sin historial, lo dice explícitamente y explica cómo se llena", () => {
  const block = appSource.slice(appSource.indexOf("function renderIv1ValuationHistoryNote("), appSource.indexOf("function renderIv1ValuationHistoryNote(") + 700);
  assert.match(block, /if \(!history\.length\) \{/);
  assert.match(block, /sin capturar todavía/);
  assert.match(block, /se registra sola en cada cierre de mes/);
});

test("renderIv1ValuationHistoryNote · con historial, ordena de más antiguo a más reciente antes de mostrar el rango", () => {
  const block = appSource.slice(appSource.indexOf("function renderIv1ValuationHistoryNote("), appSource.indexOf("function renderIv1ValuationHistoryNote(") + 900);
  assert.match(block, /\.sort\(\(a, b\) => a\.monthKey\.localeCompare\(b\.monthKey\)\)/);
  assert.match(block, /registrarMesLongMonth\(sorted\[0\]\.monthKey\)/);
  assert.match(block, /registrarMesLongMonth\(sorted\[count - 1\]\.monthKey\)/);
});

test("renderIv1ValuationHistoryNote · nunca promete una correlación que I3 todavía no puede calcular", () => {
  const block = appSource.slice(appSource.indexOf("function renderIv1ValuationHistoryNote("), appSource.indexOf("function renderIv1ValuationHistoryNote(") + 900);
  assert.doesNotMatch(block, /correlaci[oó]n/i);
});

// --- wiring de pantalla ---------------------------------------------------------------------

test("index.html · la nota de la serie histórica vive en Cartera, junto al gráfico de I9", () => {
  assert.match(indexSource, /id="iv1ValuationHistoryNote"/);
  const chartIndex = indexSource.indexOf('id="iv1ChartCard"');
  const noteIndex = indexSource.indexOf('id="iv1ValuationHistoryNote"');
  const listIndex = indexSource.indexOf('id="iv1PositionList"');
  assert.ok(chartIndex >= 0 && chartIndex < noteIndex && noteIndex < listIndex, "el orden debe ser: gráfico, nota de historial, lista de posiciones");
});

test("wiring: renderInversionCartera (views/inversion.js) refresca la nota de historial al abrir la pantalla", () => {
  assert.match(inversionViewSource, /renderIv1PositionChart\(\);\s*\n\s*renderIv1ValuationHistoryNote\(\);/);
});

test("wiring: cerrar el mes también refresca la nota en pantalla, no solo el guardado", () => {
  assert.match(appSource, /recordIv1ValuationSnapshot\(month, closedAt\);\s*\n\s*renderIv1ValuationHistoryNote\(\);/);
});
