const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// INV2 (Oleada 3, Bloque 5): la desviación de rebalanceo (IV6, ya calculada por
// rebalanceSuggestions) solo era visible al abrir Ajustes › Patrimonio e inversión. Se conecta al
// framework de alertas ya existente (V6-2/UxSettings) como un nuevo metric, en vez de un mecanismo
// de aviso en paralelo — sin objetivos declarados o sin posiciones, la métrica vale 0 y la alerta
// nunca dispara, mismo guardia que el resto del contrato de IV6.

const appSource = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");

test("wiring: UX_ALERT_METRICS declara rebalanceDeviationPct con su propia etiqueta y formato", () => {
  const start = appSource.indexOf("const UX_ALERT_METRICS = {");
  const block = appSource.slice(start, start + 1100);
  assert.match(block, /rebalanceDeviationPct: \{ label: "Desviación de rebalanceo de cartera"/);
});

test("wiring: defaultUxAlerts incluye la regla de rebalanceo, con el mismo umbral que REBALANCE_THRESHOLD_PCT (10)", () => {
  const start = appSource.indexOf("function defaultUxAlerts(");
  const block = appSource.slice(start, start + 2500);
  assert.match(block, /id: "alert-portfolio-rebalance"/);
  assert.match(block, /metric: "rebalanceDeviationPct"/);
  assert.match(block, /operator: "above"/);
  assert.match(block, /threshold: 10,/);
});

test("wiring: portfolioRebalanceDeviationPct reutiliza normalizePositions/rebalanceSuggestions, sin motor propio", () => {
  const start = appSource.indexOf("function portfolioRebalanceDeviationPct(");
  assert.ok(start >= 0, "No existe portfolioRebalanceDeviationPct");
  const block = appSource.slice(start, start + 500);
  assert.match(block, /iv1PositionsList\(\)/);
  assert.match(block, /engine\.normalizePositions\(rows\)/);
  assert.match(block, /engine\.rebalanceSuggestions\(/);
  assert.match(block, /iv6PortfolioTargets\(\)/);
});

test("wiring: sin posiciones, la métrica es 0 (guardia explícito, antes de llamar al motor)", () => {
  const start = appSource.indexOf("function portfolioRebalanceDeviationPct(");
  const block = appSource.slice(start, start + 300);
  assert.match(block, /if \(!engine \|\| !rows\.length\) return 0;/);
});

test("wiring: alertMetricSnapshot expone rebalanceDeviationPct", () => {
  const start = appSource.indexOf("function alertMetricSnapshot(");
  const block = appSource.slice(start, start + 1200);
  assert.match(block, /rebalanceDeviationPct: round2\(portfolioRebalanceDeviationPct\(\)\)/);
});
