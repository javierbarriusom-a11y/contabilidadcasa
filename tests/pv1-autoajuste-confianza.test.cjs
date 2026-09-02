const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const forecast = require("../canonical-forecast.js");
const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

// PV1 (BACKLOG_ULTIMATE_SEPTIEMBRE.md bloque 8, ampliación "previsión viva" — depende de PV5):
// "autoajuste de la previsión por niveles de confianza — el ajuste que hoy nunca se aplica solo".
// learnFromHistory() (E12b) ya calculaba una desviación media por concepto, pero siempre con
// `confirmRequired: true`/`applied: false` — a propósito, y esa regla no cambia aquí (ver
// tests/pv3-pv5-recalibracion-diario.test.cjs). PV1 abre un canal nuevo y explícito
// (applyLearnedBias), separado de esa marca, que solo actúa con confianza alta (≥12 meses
// conciliados) y solo sobre el forecast "base" — nunca sobre el libro real ni sobre las
// simulaciones "active"/"planned" que el usuario está explorando a propósito.

function month(overrides = {}) {
  return {
    index: 1,
    monthKey: "2026-09",
    label: "sep 26",
    totals: {
      income: 3000, outflowsBeforeSaving: 2500, saving: 250,
      closingChecking: 1200, closingSavings: 800, closingLiquidity: 2000,
    },
    components: { income: {}, outflow: {} },
    explanation: { origin: "x", method: "y", confidence: "rule" },
    ...overrides,
  };
}

function series(count = 3) {
  return Array.from({ length: count }, (_, i) => month({ index: i + 1, monthKey: `2026-${String(9 + i).padStart(2, "0")}` }));
}

function learningWith(deviation) {
  return { deviations: deviation ? [deviation] : [] };
}

function highDeviation(overrides = {}) {
  return { conceptId: "monthly-net", label: "Flujo mensual", averageDelta: 40, confidence: "high", sampleMonths: 14, ...overrides };
}

test("applyLearnedBias · confianza alta y activado: desplaza closingChecking/closingLiquidity de forma acumulada, mes a mes", () => {
  const out = forecast.applyLearnedBias(series(3), learningWith(highDeviation()), { enabled: true });
  assert.equal(out[0].totals.closingChecking, 1240);
  assert.equal(out[0].totals.closingLiquidity, 2040);
  assert.equal(out[1].totals.closingChecking, 1280);
  assert.equal(out[1].totals.closingLiquidity, 2080);
  assert.equal(out[2].totals.closingChecking, 1320);
  assert.equal(out[2].totals.closingLiquidity, 2120);
  assert.equal(out[0].learnedBias.applied, true);
  assert.equal(out[0].learnedBias.confidence, "high");
  assert.equal(out[0].learnedBias.monthlyAmount, 40);
  assert.equal(out[2].learnedBias.cumulativeAmount, 120);
});

test("applyLearnedBias · nunca toca ingreso, gasto antes de ahorro ni el ahorro aplicado — solo el cierre de caja", () => {
  const out = forecast.applyLearnedBias(series(1), learningWith(highDeviation()), { enabled: true });
  assert.equal(out[0].totals.income, 3000);
  assert.equal(out[0].totals.outflowsBeforeSaving, 2500);
  assert.equal(out[0].totals.saving, 250);
});

test("applyLearnedBias · confianza media o baja: no desplaza nada, sigue como sugerencia sin aplicar", () => {
  ["medium", "low"].forEach((confidence) => {
    const out = forecast.applyLearnedBias(series(2), learningWith(highDeviation({ confidence })), { enabled: true });
    assert.equal(out[0].totals.closingChecking, 1200);
    assert.equal(out[1].totals.closingChecking, 1200);
    assert.equal(out[0].learnedBias.applied, false);
    assert.equal(out[0].learnedBias.confidence, confidence);
  });
});

test("applyLearnedBias · con el interruptor desactivado, no aplica aunque la confianza sea alta", () => {
  const out = forecast.applyLearnedBias(series(2), learningWith(highDeviation()), { enabled: false });
  assert.equal(out[0].totals.closingChecking, 1200);
  assert.equal(out[0].learnedBias.applied, false);
  assert.equal(out[0].learnedBias.enabled, false);
  assert.equal(out[0].learnedBias.confidence, "high", "el estado de confianza se informa igual, aunque no se aplique");
});

test("applyLearnedBias · sin desviación para el concepto, no inventa un ajuste", () => {
  const out = forecast.applyLearnedBias(series(1), learningWith(null), { enabled: true });
  assert.equal(out[0].totals.closingChecking, 1200);
  assert.equal(out[0].learnedBias.applied, false);
  assert.equal(out[0].learnedBias.confidence, "low");
  assert.equal(out[0].learnedBias.sampleMonths, 0);
});

test("applyLearnedBias · admite un conceptId distinto de monthly-net sin romper el filtro", () => {
  const out = forecast.applyLearnedBias(series(1), learningWith(highDeviation({ conceptId: "otro-concepto" })), { enabled: true, conceptId: "otro-concepto" });
  assert.equal(out[0].learnedBias.applied, true);
  assert.equal(out[0].learnedBias.conceptId, "otro-concepto");
});

function functionBody(name, source = app) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `No existe ${name} en app.js`);
  const end = source.indexOf("\nfunction ", start + 1);
  assert.ok(end > start);
  return source.slice(start, end);
}

test("computeCanonicalScenario solo aplica el autoajuste sobre el escenario base, nunca sobre active/planned", () => {
  const body = functionBody("computeCanonicalScenario");
  assert.match(body, /if \(persistedContext === "base"\)/);
  assert.match(body, /applyLearnedBias\(scenario\.forecast\.series, biasLearning/);
  assert.match(body, /enabled: state\?\.autoAdjustForecastBias !== false/);
});

test("modelComputationSignature incluye autoAdjustForecastBias, o el interruptor no forzaría recalcular", () => {
  const body = functionBody("modelComputationSignature");
  assert.match(body, /autoAdjustForecastBias: state\.autoAdjustForecastBias !== false/);
});

test("saveScenarioSettings persiste autoAdjustForecastBias, mismo criterio que autoCapSavings", () => {
  const body = functionBody("saveScenarioSettings");
  assert.match(body, /autoAdjustForecastBias: state\.autoAdjustForecastBias,/);
});

test("el interruptor de Ajustes guarda, recalcula y refresca la nota al cambiar", () => {
  const body = functionBody("handleAutoAdjustForecastBiasChange");
  assert.match(body, /state\.autoAdjustForecastBias = Boolean\(event\.target\.checked\)/);
  assert.match(body, /saveScenarioSettings\(\)/);
  assert.match(body, /render\(\)/);
});

test("la transición de confianza (entra o sale de alta) queda anunciada en el diario de PV5", () => {
  const body = functionBody("pv1AutoAdjustTransitionNote");
  assert.match(body, /newConfidence === "high" && entry\.previousConfidence !== "high"/);
  assert.match(body, /previousConfidence === "high" && entry\.newConfidence !== "high"/);
  const recalibrate = functionBody("recalibrateForecastLearning");
  assert.match(recalibrate, /confidence: deviation\.confidence/, "el snapshot debe guardar la confianza para poder detectar el cruce");
  assert.match(recalibrate, /before\.confidence !== deviation\.confidence/);
});

test("nunca se aplica un ajuste solo dentro de recalibrateForecastLearning: PV1 vive en un canal aparte", () => {
  const body = functionBody("recalibrateForecastLearning");
  assert.doesNotMatch(body, /applied:\s*true/);
});

test("el interruptor está declarado en index.html, versionado y cableado en Ajustes", () => {
  assert.match(html, /id="ajustesAutoAdjustForecastBias"/);
  assert.match(html, /id="ajustesAutoAdjustForecastBiasNote"/);
  assert.match(app, /qs\("ajustesAutoAdjustForecastBias"\)\?\.addEventListener\("change", handleAutoAdjustForecastBiasChange\)/);
  assert.match(app, /syncAutoAdjustForecastBiasControl\(\);\s*\n\s*renderAjustesAutoAdjustForecastBiasNote\(\);/);
});

test("el Laboratorio de escenarios (E13) muestra el estado del autoajuste junto al resto del aprendizaje", () => {
  const body = functionBody("renderE13ScenarioLab");
  assert.match(body, /PV1 · autoajuste de la previsión/);
  assert.match(body, /pv1AutoAdjustBiasNote\(forecast\.series\[0\]\?\.learnedBias\)/);
});
