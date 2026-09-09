const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// INV4 (Oleada 3, Bloque 5): alcance reducido a propósito — sin serie histórica de rendimientos ni
// clasificación de sector/divisa por posición (mismo hueco que ya bloqueó APX4/IVX1/IVX5), no hay
// correlación estadística real que calcular. Lo que sí es calculable hoy (y ya calculaba
// renderIv1PositionConcentration() como nota pasiva) es un umbral simple de "% del total en una
// única posición" — esta tarea lo conecta al framework de alertas ya existente (V6-2), igual que
// INV2, en vez de un mecanismo de aviso en paralelo.

const appSource = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");

test("wiring: UX_ALERT_METRICS declara topPositionConcentrationPct con su propia etiqueta y formato", () => {
  const start = appSource.indexOf("const UX_ALERT_METRICS = {");
  const block = appSource.slice(start, start + 1300);
  assert.match(block, /topPositionConcentrationPct: \{ label: "Concentración en la mayor posición"/);
});

test("wiring: defaultUxAlerts incluye la regla de concentración, con el mismo umbral (50%) que ya usaba renderIv1PositionConcentration()", () => {
  const start = appSource.indexOf("function defaultUxAlerts(");
  const block = appSource.slice(start, start + 3200);
  assert.match(block, /id: "alert-portfolio-concentration"/);
  assert.match(block, /metric: "topPositionConcentrationPct"/);
  assert.match(block, /operator: "above"/);
  assert.match(block, /threshold: 50,/);
});

test("wiring: iv1TopPositionConcentrationPct reutiliza normalizePositions, sin motor de correlación nuevo", () => {
  const start = appSource.indexOf("function iv1TopPositionConcentrationPct(");
  assert.ok(start >= 0, "No existe iv1TopPositionConcentrationPct");
  const block = appSource.slice(start, start + 550);
  assert.match(block, /iv1PositionsList\(\)/);
  assert.match(block, /engine\.normalizePositions\(rows\)/);
  assert.match(block, /if \(!engine \|\| !rows\.length\) return 0;/);
  assert.match(block, /if \(totalValue <= 0\) return 0;/);
});

test("wiring: el cálculo del % del top es el mismo que renderIv1PositionConcentration() (posición mayor / total, redondeado)", () => {
  const startConcentration = appSource.indexOf("function iv1TopPositionConcentrationPct(");
  const startRender = appSource.indexOf("function renderIv1PositionConcentration(");
  const concentrationBlock = appSource.slice(startConcentration, startConcentration + 550);
  const renderBlock = appSource.slice(startRender, startRender + 1400);
  assert.match(concentrationBlock, /\.sort\(\(a, b\) => b\.currentValue - a\.currentValue\)\[0\]/);
  assert.match(renderBlock, /\.sort\(\(a, b\) => b\.currentValue - a\.currentValue\)\[0\]/);
});

test("wiring: alertMetricSnapshot expone topPositionConcentrationPct", () => {
  const start = appSource.indexOf("function alertMetricSnapshot(");
  const block = appSource.slice(start, start + 1400);
  assert.match(block, /topPositionConcentrationPct: round2\(iv1TopPositionConcentrationPct\(\)\)/);
});
