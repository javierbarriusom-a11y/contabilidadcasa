const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { CanonicalBudgetAnalyzer } = require("../canonical-budget-analyzer.js");

// PVC2 (Oleada 3, Bloque 5): reutiliza budgetAnalysisForCategory()/PVX4 (p25/p75/stdDev históricos
// por categoría) y los aplica a la banda del horizonte largo (P10-P90 de ESX1) para decidir qué
// categoría explica más incertidumbre, en vez de repartirla por igual entre categorías con
// volatilidad muy distinta. Bajo el supuesto de independencia entre categorías (sin correlación
// real declarada), el peso de cada categoría es su varianza propia sobre la varianza total.

test("categoryConfidenceShare · sin categorías con histórico, no hay nada que repartir", () => {
  const result = CanonicalBudgetAnalyzer.categoryConfidenceShare([], 1000);
  assert.deepEqual(result, []);
});

test("categoryConfidenceShare · ignora categorías sin análisis o sin stdDev > 0", () => {
  const result = CanonicalBudgetAnalyzer.categoryConfidenceShare(
    [
      { categoryId: "sin-datos", analysis: null },
      { categoryId: "sin-variacion", analysis: { stdDev: 0 } },
      { categoryId: "ocio", analysis: { stdDev: 50 } },
    ],
    1000
  );
  assert.equal(result.length, 1);
  assert.equal(result[0].categoryId, "ocio");
  assert.equal(result[0].sharePct, 100);
});

test("categoryConfidenceShare · reparte según varianza (stdDev²), no según stdDev directo", () => {
  // ocio: stdDev 30 -> varianza 900; super: stdDev 40 -> varianza 1600. Total 2500.
  const result = CanonicalBudgetAnalyzer.categoryConfidenceShare(
    [
      { categoryId: "ocio", analysis: { stdDev: 30 } },
      { categoryId: "super", analysis: { stdDev: 40 } },
    ],
    1000
  );
  const ocio = result.find((item) => item.categoryId === "ocio");
  const superMercado = result.find((item) => item.categoryId === "super");
  assert.equal(ocio.sharePct, 36); // 900/2500
  assert.equal(superMercado.sharePct, 64); // 1600/2500
  assert.equal(ocio.explainedWidth, 360); // 1000 * 0.36
  assert.equal(superMercado.explainedWidth, 640);
});

test("categoryConfidenceShare · ordena de mayor a menor peso", () => {
  const result = CanonicalBudgetAnalyzer.categoryConfidenceShare(
    [
      { categoryId: "a", analysis: { stdDev: 10 } },
      { categoryId: "b", analysis: { stdDev: 100 } },
      { categoryId: "c", analysis: { stdDev: 50 } },
    ],
    500
  );
  assert.deepEqual(result.map((item) => item.categoryId), ["b", "c", "a"]);
});

test("categoryConfidenceShare · una banda negativa se trata como su valor absoluto", () => {
  const result = CanonicalBudgetAnalyzer.categoryConfidenceShare([{ categoryId: "ocio", analysis: { stdDev: 10 } }], -800);
  assert.equal(result[0].explainedWidth, 800);
});

// --- Wiring ---

const appSource = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const indexSource = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

test("wiring: pvc2CategoryConfidenceShare usa budgetAnalysisForCategory y CanonicalBudgetAnalyzer.categoryConfidenceShare", () => {
  const start = appSource.indexOf("function pvc2CategoryConfidenceShare(");
  assert.ok(start >= 0, "No existe pvc2CategoryConfidenceShare");
  const block = appSource.slice(start, start + 600);
  assert.match(block, /budgetAnalysisForCategory\(/);
  assert.match(block, /CanonicalBudgetAnalyzer\.categoryConfidenceShare\(/);
});

test("wiring: renderE13ScenarioLab calcula la banda con prudent.percentiles.p90 - p10 y pinta la tarjeta de PVC2", () => {
  const start = appSource.indexOf("function renderE13ScenarioLab(");
  assert.ok(start >= 0, "No existe renderE13ScenarioLab");
  // +700 sobre la ventana anterior: PVC13 (Oleada 4, Bloque 3) añadió las muestras de
  // predictionQuality antes de esta llamada, dentro de la misma función.
  const block = appSource.slice(start, start + 9700);
  assert.match(block, /pvc2CategoryConfidenceShare\(prudent\.percentiles\.p90 - prudent\.percentiles\.p10\)/);
  assert.match(block, /pvc2ConfidenceShareHtml\(pvc2Shares\)/);
});

test("wiring: la tarjeta de PVC2 vive en la comparación avanzada del Laboratorio de escenarios (index.html)", () => {
  assert.match(indexSource, /id="e13AdvancedAnalysis"/);
});
