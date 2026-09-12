const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const E16 = require("../canonical-e16-monitoring.js");

// PVC17 (Oleada 4, Bloque 3): agrega el MAE que predictionQuality() (E16) ya calcula, hoy disperso
// por categoría y sin ningún sitio que lo mostrara como cifra única, en un índice de salud
// predictiva con tendencia frente a la última medición guardada (mismo cierre de mes que PV3/PVC11).
// No inventa una escala 0-100: el índice ES el meanAbsoluteError global ya ponderado por muestra.

test("predictiveHealthIndex · sin medición previa, tendencia 'sin-historial' (nunca 'estable' por defecto)", () => {
  const quality = E16.predictionQuality({ samples: [{ actual: 1010, predicted: 1000, category: "monthly-net" }] });
  const index = E16.predictiveHealthIndex(quality, null);
  assert.equal(index.trend, "sin-historial");
  assert.equal(index.previousMeanAbsoluteError, null);
  assert.equal(index.delta, null);
  assert.equal(index.meanAbsoluteError, 10);
});

test("predictiveHealthIndex · MAE menor que el anterior: mejorando", () => {
  const quality = E16.predictionQuality({ samples: [{ actual: 1005, predicted: 1000 }] }); // MAE 5
  const index = E16.predictiveHealthIndex(quality, 40);
  assert.equal(index.trend, "mejorando");
  assert.equal(index.delta, -35);
});

test("predictiveHealthIndex · MAE mayor que el anterior: empeorando", () => {
  const quality = E16.predictionQuality({ samples: [{ actual: 1100, predicted: 1000 }] }); // MAE 100
  const index = E16.predictiveHealthIndex(quality, 40);
  assert.equal(index.trend, "empeorando");
  assert.equal(index.delta, 60);
});

test("predictiveHealthIndex · MAE prácticamente igual (dentro de 0,005): estable", () => {
  const quality = E16.predictionQuality({ samples: [{ actual: 1040, predicted: 1000 }] }); // MAE 40
  const index = E16.predictiveHealthIndex(quality, 40);
  assert.equal(index.trend, "estable");
});

test("predictiveHealthIndex · propaga las categorías de predictionQuality tal cual, sin recalcularlas", () => {
  const quality = E16.predictionQuality({
    samples: [
      { actual: 1010, predicted: 1000, category: "monthly-net" },
      { actual: 1300, predicted: 1000, category: "ocio" },
    ],
  });
  const index = E16.predictiveHealthIndex(quality, null);
  assert.equal(index.categories.length, 2);
  assert.equal(index.categories[0].category, "ocio"); // predictionQuality ya ordena por MAE descendente
  assert.equal(index.samples, 2);
});

test("predictiveHealthIndex · sin muestras, meanAbsoluteError 0 y samples 0, nunca revienta", () => {
  const quality = E16.predictionQuality({ samples: [] });
  const index = E16.predictiveHealthIndex(quality, null);
  assert.equal(index.meanAbsoluteError, 0);
  assert.equal(index.samples, 0);
  assert.equal(index.trend, "sin-historial");
});

// ---------------------------------------------------------------------------------------------
// Wiring en app.js: pvc17QualitySamplesFromHistory (factorizado desde renderE13ScenarioLab),
// el snapshot guardado en el cierre de mes (recalibrateForecastLearning) y la lectura/render de
// solo lectura (pvc17PredictiveHealthIndex/renderPvc17PredictiveHealth).
// ---------------------------------------------------------------------------------------------

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

function sandbox({ storage = {}, elements = {}, history = [] } = {}) {
  const store = { ...storage };
  const context = {
    storageGet: (key, fallback) => (key in store ? store[key] : fallback),
    storageSet: (key, value) => { store[key] = value; },
    storageKey: (key) => key,
    reconciledMonthlyNetHistory: () => history,
    window: { FinanceCanonicalE16: E16 },
    escapeHtml: (value) => String(value ?? ""),
    money: (value) => `${value}€`,
    qs: (id) => elements[id] || null,
    __store: store,
  };
  vm.createContext(context);
  [
    "pvc17QualitySamplesFromHistory",
    "loadPvc17HealthSnapshot",
    "savePvc17HealthSnapshot",
    "pvc17PredictiveHealthIndex",
    "renderPvc17PredictiveHealth",
  ].forEach((name) => vm.runInContext(extractFunction(name), context));
  return context;
}

test("pvc17QualitySamplesFromHistory · descarta registros sin previsto/real numéricos", () => {
  const ctx = sandbox();
  const samples = ctx.pvc17QualitySamplesFromHistory([
    { planned: 1000, actual: 1010 },
    { planned: NaN, actual: 900 },
    { planned: 800, actual: null },
  ]);
  assert.equal(samples.length, 1);
  assert.equal(samples[0].predicted, 1000);
  assert.equal(samples[0].actual, 1010);
});

test("pvc17PredictiveHealthIndex · sin historial guardado, sin-historial", () => {
  const ctx = sandbox({ history: [{ planned: 1000, actual: 1050 }] });
  const index = ctx.pvc17PredictiveHealthIndex();
  assert.equal(index.trend, "sin-historial");
  assert.equal(index.meanAbsoluteError, 50);
});

test("pvc17PredictiveHealthIndex · con historial guardado en el snapshot, calcula la tendencia", () => {
  const ctx = sandbox({
    history: [{ planned: 1000, actual: 1010 }], // MAE 10 ahora
    storage: { "pvc17-health-snapshot": JSON.stringify({ meanAbsoluteError: 80, samples: 3, at: "2026-08-01T00:00:00.000Z" }) },
  });
  const index = ctx.pvc17PredictiveHealthIndex();
  assert.equal(index.trend, "mejorando");
  assert.equal(index.previousMeanAbsoluteError, 80);
});

test("renderPvc17PredictiveHealth · sin muestras, mensaje explícito y lista vacía", () => {
  const note = { textContent: "" };
  const list = { innerHTML: "prev" };
  const ctx = sandbox({ history: [], elements: { pvc17HealthNote: note, pvc17HealthCategories: list } });
  ctx.renderPvc17PredictiveHealth();
  assert.match(note.textContent, /Sin muestras completas/);
  assert.equal(list.innerHTML, "");
});

test("renderPvc17PredictiveHealth · con muestras, cifra única y lista de categorías", () => {
  const note = { textContent: "" };
  const list = { innerHTML: "" };
  const ctx = sandbox({
    history: [{ planned: 1000, actual: 1050 }],
    elements: { pvc17HealthNote: note, pvc17HealthCategories: list },
  });
  ctx.renderPvc17PredictiveHealth();
  assert.match(note.textContent, /Error medio absoluto de la previsión: 50€/);
  assert.match(note.textContent, /Sin medición previa/);
  assert.match(list.innerHTML, /monthly-net/);
});

test("renderPvc17PredictiveHealth · sin elemento en el DOM, no revienta", () => {
  const ctx = sandbox({ history: [] });
  assert.doesNotThrow(() => ctx.renderPvc17PredictiveHealth());
});

test("wiring: recalibrateForecastLearning guarda el snapshot de salud predictiva en el cierre de mes", () => {
  const block = extractFunction("recalibrateForecastLearning");
  assert.match(block, /savePvc17HealthSnapshot\(/);
  assert.match(block, /pvc17QualitySamplesFromHistory\(reconciledMonthlyNetHistory\(\)\)/);
});

test("wiring: renderPvc17PredictiveHealth se llama junto a renderPvc16NonRecurringMonths en el ciclo de render", () => {
  assert.match(appSource, /renderPvc16NonRecurringMonths\(\);\s*\n\s*renderPvc17PredictiveHealth\(\);/);
});

test("index.html: la tarjeta de salud predictiva existe con nota y lista de categorías", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  assert.match(html, /id="pvc17HealthNote"/);
  assert.match(html, /id="pvc17HealthCategories"/);
});
