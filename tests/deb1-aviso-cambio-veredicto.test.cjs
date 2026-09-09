const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// DEB1 (Oleada 3, Bloque 2) · aviso de cambio de veredicto de AP1 entre un cierre y el siguiente.
// Alcance confirmado por VER-2: AP1 ya se recalcula solo por firma (agentDebtOptimizationCacheKey),
// así que esta tarea no construye ningún motor nuevo — solo guarda la última comparación que el
// hogar miró de verdad y avisa si, recalculada con los datos vivos actuales, el veredicto cambió.

const appSource = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const indexSource = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const deudaSource = fs.readFileSync(path.join(__dirname, "..", "views", "deuda.js"), "utf8");

test("la tarjeta de AP1 tiene el hueco del aviso de cambio de veredicto, visible sin pulsar Comparar", () => {
  assert.match(indexSource, /id="deb1VerdictChangeAlert"/);
  const cardStart = indexSource.indexOf("Comparador: amortizar vs. invertir");
  const alertPos = indexSource.indexOf('id="deb1VerdictChangeAlert"');
  const buttonPos = indexSource.indexOf('id="ap1CompareRun"');
  assert.ok(cardStart >= 0 && alertPos > cardStart, "El aviso debe vivir dentro de la tarjeta de AP1");
  assert.ok(alertPos < buttonPos, "El aviso debe verse antes del botón Comparar, no solo tras pulsarlo");
});

test("ap1TrackedComparison lee de scenarioSettings, sin estado propio aparte", () => {
  const block = appSource.slice(appSource.indexOf("function ap1TrackedComparison("), appSource.indexOf("function ap1TrackedComparison(") + 200);
  assert.match(block, /scenarioSettings\.ap1TrackedComparison/);
});

test("deb1RecomputeTrackedAssessment reutiliza FinanceDebtComparator/FinanceCanonicalPortfolio, sin motor nuevo", () => {
  const block = appSource.slice(appSource.indexOf("function deb1RecomputeTrackedAssessment("), appSource.indexOf("function deb1RecomputeTrackedAssessment(") + 900);
  assert.match(block, /window\.FinanceDebtComparator/);
  assert.match(block, /window\.FinanceCanonicalPortfolio/);
  assert.match(block, /compareAmortizeVsInvest\(/);
  assert.match(block, /opportunityCost\(/);
  assert.match(block, /iv5PortfolioAnnualReturnPct\(\)/);
});

test("deb1RecomputeTrackedAssessment usa el principal vivo de la deuda, no el guardado en el momento de comparar", () => {
  const block = appSource.slice(appSource.indexOf("function deb1RecomputeTrackedAssessment("), appSource.indexOf("function deb1RecomputeTrackedAssessment(") + 900);
  assert.match(block, /p2DebtRows\(\)\.find\(/);
  assert.match(block, /remainingPrincipal: debt \? debt\.currentPrincipal : null/);
});

test("deb1VerdictChangeHtml no avisa sin comparación guardada ni cuando el veredicto no ha cambiado", () => {
  const block = appSource.slice(appSource.indexOf("function deb1VerdictChangeHtml("), appSource.indexOf("function deb1VerdictChangeHtml(") + 700);
  assert.match(block, /if \(!tracked\) return "";/);
  assert.match(block, /if \(!currentAssessment \|\| currentAssessment === tracked\.assessment\) return "";/);
});

test("handleAp1Compare guarda la comparación solo con un veredicto real, nunca con 'invertir-no-calculable'", () => {
  const start = appSource.indexOf("function handleAp1Compare(");
  const block = appSource.slice(start, appSource.indexOf("\n}\n", start) + 3);
  assert.match(block, /\["amortizar", "invertir", "neutral"\]\.includes\(result\.assessment\)/);
  assert.match(block, /saveAp1TrackedComparison\(/);
  assert.match(block, /renderDeb1VerdictChangeAlert\(\);/);
});

test("saveScenarioSettings persiste ap1TrackedComparison", () => {
  const block = appSource.slice(appSource.indexOf("function saveScenarioSettings("), appSource.indexOf("function saveScenarioSettings(") + 3200);
  assert.match(block, /ap1TrackedComparison: scenarioSettings\.ap1TrackedComparison \|\| null/);
});

test("el aviso se recalcula al abrir Deuda › Apalancamiento (OPT-24: ya no es un ajuste, es una herramienta), no solo tras pulsar Comparar", () => {
  const initBlock = deudaSource.slice(deudaSource.indexOf("renderLev1PolicyStatus();\n  renderDeb1VerdictChangeAlert();"), deudaSource.indexOf("renderLev1PolicyStatus();\n  renderDeb1VerdictChangeAlert();") + 60);
  assert.match(initBlock, /renderDeb1VerdictChangeAlert\(\);/);
});
