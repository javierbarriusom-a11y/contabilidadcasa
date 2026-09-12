const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const forecast = require("../canonical-forecast.js");
const E16 = require("../canonical-e16-monitoring.js");

// PVC13 (Oleada 4, Bloque 3): cierra el bucle entre predictionQuality() (E16) y confidenceBands()
// (PV4) — hasta ahora ningún mecanismo de la Oleada 3 usaba el error medido para ensanchar o
// estrechar la banda de confianza, que solo se basaba en el sesgo medio de learnFromHistory. Por
// desigualdad triangular, el MAE real (predictionQuality, medido sobre cada muestra) nunca es menor
// que |sesgo medio| (averageDelta ya promediado por concepto), así que la banda solo puede
// ensancharse cuando hay medición real disponible, nunca estrecharse por debajo de lo que ya decía
// el sesgo.

function seriesFixture(values) {
  return values.map((value, index) => ({ monthKey: `2026-${String(index + 1).padStart(2, "0")}`, label: `Mes ${index + 1}`, totals: { closingLiquidity: value } }));
}

test("confidenceBands · sin options.quality, se comporta exactamente igual que antes (compatibilidad)", () => {
  const learning = { deviations: [{ conceptId: "a", sampleMonths: 6, averageDelta: 100, confidence: "high" }] };
  const bands = forecast.confidenceBands(seriesFixture([1000]), learning);
  assert.equal(bands[0].margin, 100);
  assert.equal(bands[0].marginSource, "bias");
  assert.equal(bands[0].measuredMae, null);
});

test("confidenceBands · con un MAE medido mayor que el sesgo, la banda se ensancha hasta el MAE", () => {
  const learning = { deviations: [{ conceptId: "a", sampleMonths: 6, averageDelta: 20, confidence: "high" }] };
  // Errores +100 y -100 en meses distintos: sesgo medio (averageDelta) llega a 20 (dato ya dado por
  // learnFromHistory), pero el MAE real sobre las muestras es mucho mayor.
  const quality = E16.predictionQuality({ samples: [
    { actual: 1100, predicted: 1000 }, // error +100
    { actual: 900, predicted: 1000 }, // error -100
  ] });
  const bands = forecast.confidenceBands(seriesFixture([1000]), learning, { quality });
  assert.equal(quality.meanAbsoluteError, 100);
  assert.equal(bands[0].margin, 100); // ensanchado hasta el MAE medido, no el sesgo (20)
  assert.equal(bands[0].marginSource, "measured-error");
  assert.equal(bands[0].measuredMae, 100);
});

test("confidenceBands · con un MAE medido menor o igual que el sesgo, el margen no cambia (nunca se estrecha)", () => {
  const learning = { deviations: [{ conceptId: "a", sampleMonths: 6, averageDelta: 100, confidence: "high" }] };
  const quality = E16.predictionQuality({ samples: [{ actual: 1010, predicted: 1000 }] }); // MAE = 10
  const bands = forecast.confidenceBands(seriesFixture([1000]), learning, { quality });
  assert.equal(quality.meanAbsoluteError, 10);
  assert.equal(bands[0].margin, 100); // se queda en el sesgo, más ancho que el MAE medido
  assert.equal(bands[0].marginSource, "bias");
});

test("confidenceBands · sin muestras válidas en quality (no calculable), se comporta como si no se hubiera pasado", () => {
  const learning = { deviations: [{ conceptId: "a", sampleMonths: 6, averageDelta: 100, confidence: "high" }] };
  const quality = E16.predictionQuality({ samples: [] });
  const bands = forecast.confidenceBands(seriesFixture([1000]), learning, { quality });
  assert.equal(bands[0].margin, 100);
  assert.equal(bands[0].marginSource, "bias");
  assert.equal(bands[0].measuredMae, null);
});

test("confidenceBands · la anchura por meses hacia delante se sigue aplicando sobre el margen ya ensanchado por MAE", () => {
  const learning = { deviations: [{ conceptId: "a", sampleMonths: 6, averageDelta: 10, confidence: "high" }] };
  const quality = E16.predictionQuality({ samples: [{ actual: 1100, predicted: 1000 }, { actual: 900, predicted: 1000 }] }); // MAE 100
  const bands = forecast.confidenceBands(seriesFixture([1000, 1000, 1000, 1000]), learning, { quality });
  assert.equal(bands[0].margin, 100); // mes 1: ×1
  assert.equal(bands[3].margin, 200); // mes 4: ×2 (sqrt(4)) sobre el margen base de 100
});

const appSource = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");

function extractFunction(name) {
  const start = appSource.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `No existe la función ${name} en app.js`);
  const parenStart = appSource.indexOf("(", start);
  let parenDepth = 0;
  let bodyStart = -1;
  for (let index = parenStart; index < appSource.length; index += 1) {
    if (appSource[index] === "(") parenDepth += 1;
    else if (appSource[index] === ")") {
      parenDepth -= 1;
      if (parenDepth === 0) { bodyStart = appSource.indexOf("{", index); break; }
    }
  }
  assert.ok(bodyStart >= 0, `No se encontró el cuerpo de ${name}`);
  let depth = 0;
  for (let index = bodyStart; index < appSource.length; index += 1) {
    if (appSource[index] === "{") depth += 1;
    else if (appSource[index] === "}") {
      depth -= 1;
      if (depth === 0) return appSource.slice(start, index + 1);
    }
  }
  throw new Error(`La función ${name} no cierra sus llaves`);
}

test("wiring: renderE13ScenarioLab construye las muestras de predictionQuality desde el histórico conciliado y las pasa a confidenceBands", () => {
  const block = extractFunction("renderE13ScenarioLab");
  // PVC17 (Oleada 4, Bloque 3): el mapeo histórico → muestras se factorizó en
  // pvc17QualitySamplesFromHistory() (un único algoritmo, dos usos: aquí y en el índice único de
  // salud predictiva) — renderE13ScenarioLab ya no lo reimplementa inline, solo la llama.
  assert.match(block, /const qualitySamples = pvc17QualitySamplesFromHistory\(history\);/);
  assert.match(block, /window\.FinanceCanonicalE16\?\.predictionQuality\(\{ samples: qualitySamples \}\)/);
  assert.match(block, /confidenceBands\(forecast\.series\.slice\(0, 12\), learning, \{ quality: predictionQuality \}\)/);
  const helper = extractFunction("pvc17QualitySamplesFromHistory");
  assert.match(helper, /actual: record\.actual, predicted: record\.planned/);
});

test("wiring: pv4ConfidenceBandHtml explica cuándo la banda se ensanchó por error medido, nunca en silencio", () => {
  const block = extractFunction("pv4ConfidenceBandHtml");
  assert.match(block, /marginSource === "measured-error"/);
  assert.match(block, /Ensanchada hasta el error medio real medido/);
});
