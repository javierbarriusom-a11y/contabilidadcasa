const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const app = read("app.js");
const forecast = require("../canonical-forecast.js");

// P6 (Horizonte 1, sesión 199): puntuación de acierto histórico como KPI fijo en Hoy. Convierte el
// informe detallado de pvx1BacktestHtml (PVX1, hoy en Análisis) en una sola cifra permanente —
// mismo ratio que ya clasifica deviationSeverity (PV2), invertido a un porcentaje de acierto, sin
// duplicar la fórmula ni el informe completo.

function extractFunction(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `No existe la función ${name} en app.js`);
  const parenStart = app.indexOf("(", start);
  let parenDepth = 0;
  let bodyStart = -1;
  for (let index = parenStart; index < app.length; index += 1) {
    if (app[index] === "(") parenDepth += 1;
    else if (app[index] === ")") {
      parenDepth -= 1;
      if (parenDepth === 0) { bodyStart = app.indexOf("{", index); break; }
    }
  }
  assert.ok(bodyStart >= 0, `No se encontró el cuerpo de ${name}`);
  let depth = 0;
  for (let index = bodyStart; index < app.length; index += 1) {
    if (app[index] === "{") depth += 1;
    else if (app[index] === "}") {
      depth -= 1;
      if (depth === 0) return app.slice(start, index + 1);
    }
  }
  throw new Error(`La función ${name} no cierra sus llaves`);
}

// --- Parte A: historicalAccuracyScore() (canonical-forecast.js) -----------------------------

test("historicalAccuracyScore · sin desviación disponible, no calculable", () => {
  assert.equal(forecast.historicalAccuracyScore(undefined).calculable, false);
  assert.equal(forecast.historicalAccuracyScore(null).calculable, false);
  assert.equal(forecast.historicalAccuracyScore({ sampleMonths: 0, averageDelta: 0, averagePlanned: 100 }).calculable, false);
});

test("historicalAccuracyScore · sin desviación (previsto = real), 100% de acierto", () => {
  const result = forecast.historicalAccuracyScore({ sampleMonths: 6, averageDelta: 0, averagePlanned: 2000, confidence: "medium" });
  assert.equal(result.calculable, true);
  assert.equal(result.score, 100);
  assert.equal(result.severity, "low");
  assert.equal(result.sampleMonths, 6);
  assert.equal(result.confidence, "medium");
});

test("historicalAccuracyScore · desviación media igual a lo previsto, 0% (no negativo)", () => {
  const result = forecast.historicalAccuracyScore({ sampleMonths: 3, averageDelta: 500, averagePlanned: 500, confidence: "low" });
  assert.equal(result.score, 0);
});

test("historicalAccuracyScore · desviación mayor que lo previsto, se recorta en 0%, nunca negativo", () => {
  const result = forecast.historicalAccuracyScore({ sampleMonths: 12, averageDelta: 1500, averagePlanned: 500, confidence: "high" });
  assert.equal(result.score, 0);
});

test("historicalAccuracyScore · una desviación del 20% de lo previsto da 80% de acierto y severidad media, igual que deviationSeverity", () => {
  const result = forecast.historicalAccuracyScore({ sampleMonths: 8, averageDelta: -100, averagePlanned: 500, confidence: "high" });
  assert.equal(result.score, 80);
  assert.equal(result.severity, forecast.deviationSeverity(-100, 500));
  assert.equal(result.severity, "medium");
});

test("historicalAccuracyScore está exportado", () => {
  assert.equal(typeof forecast.historicalAccuracyScore, "function");
});

// --- Parte B: cableado en renderHomeDashboard() (app.js) -------------------------------------

test("renderHomeDashboard calcula la puntuación de acierto con reconciledMonthlyNetHistory/learnFromHistory, sin repetir el informe completo de PVX1", () => {
  const source = extractFunction("renderHomeDashboard");
  assert.match(source, /window\.FinanceCanonicalForecast\?\.learnFromHistory\(\s*reconciledMonthlyNetHistory\(\)/);
  assert.match(source, /window\.FinanceCanonicalForecast\?\.historicalAccuracyScore\(accuracyLearning\.deviations\?\.\[0\]\)/);
  assert.doesNotMatch(source, /pvx1BacktestHtml\(/);
});

test("renderHomeDashboard pinta el KPI «Acierto histórico de la previsión» dentro de homeKpis, con estado según severidad y enlace al backtesting", () => {
  const source = extractFunction("renderHomeDashboard");
  const start = source.indexOf('label: "Acierto histórico de la previsión"');
  assert.ok(start >= 0, "No existe el KPI de acierto histórico");
  const block = source.slice(start, start + 700);
  assert.match(block, /accuracyScore\.calculable \? `\$\{accuracyScore\.score\}%` : "Sin datos"/);
  assert.match(block, /accuracyScore\.severity === "high" \? "danger" : accuracyScore\.severity === "medium" \? "warn" : "good"/);
  assert.match(block, /cta: "Ver backtesting"/);
  assert.match(block, /target: "herramientas-analizar"/);
});
