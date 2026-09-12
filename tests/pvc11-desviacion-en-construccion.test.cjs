const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// PVC11 (Oleada 4, Bloque 3): hoy el único disparador de learnFromHistory() es
// recalibrateForecastLearning(), que solo corre en el cierre de mes firmado (PV3/E12b) — un mes
// ya conciliado en canonicalLedgerSnapshot.reconciliation.months puede llevar semanas esperando
// ese cierre sin que se note. pvc11PendingLearningPreview() recalcula learnFromHistory() con el
// histórico conciliado disponible AHORA y lo compara contra la última foto ya guardada
// (loadPv3LearningSnapshot) para contar cuántos meses nuevos están conciliados pero sin aprender
// — de solo lectura, nunca guarda nada ni aplica ningún ajuste.

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

function sandbox({ learning, snapshot, elements = {} } = {}) {
  const context = {
    window: { FinanceCanonicalForecast: { learnFromHistory: () => learning } },
    reconciledMonthlyNetHistory: () => [],
    loadPv3LearningSnapshot: () => snapshot || {},
    money: (value, precise) => (precise ? `${Number(value).toFixed(2)}€` : `${Math.round(Number(value))}€`),
    qs: (id) => elements[id] || null,
  };
  vm.createContext(context);
  vm.runInContext(extractFunction("pvc11PendingLearningPreview"), context);
  vm.runInContext(extractFunction("renderPvc11PendingLearning"), context);
  return context;
}

test("pvc11PendingLearningPreview · sin deviations (motor sin datos), no hay nada pendiente", () => {
  const ctx = sandbox({ learning: null, snapshot: {} });
  const preview = ctx.pvc11PendingLearningPreview();
  assert.equal(preview.pending, false);
  assert.equal(preview.pendingMonths, 0);
});

test("pvc11PendingLearningPreview · sin concepto monthly-net en el aprendizaje actual, no hay nada pendiente", () => {
  const ctx = sandbox({ learning: { deviations: [] }, snapshot: {} });
  const preview = ctx.pvc11PendingLearningPreview();
  assert.equal(preview.pending, false);
});

test("pvc11PendingLearningPreview · mismo número de meses que la última foto guardada, al día", () => {
  const learning = { deviations: [{ conceptId: "monthly-net", sampleMonths: 8, averageDelta: 30, severity: "medium", confidence: "high" }] };
  const snapshot = { "monthly-net": { sampleMonths: 8, averageDelta: 30, severity: "medium", confidence: "high" } };
  const ctx = sandbox({ learning, snapshot });
  const preview = ctx.pvc11PendingLearningPreview();
  assert.equal(preview.pending, false);
  assert.equal(preview.pendingMonths, 0);
});

test("pvc11PendingLearningPreview · hay meses conciliados nuevos desde la última foto: cuenta la diferencia exacta", () => {
  const learning = { deviations: [{ conceptId: "monthly-net", sampleMonths: 11, averageDelta: 55, severity: "medium", confidence: "high" }] };
  const snapshot = { "monthly-net": { sampleMonths: 9, averageDelta: 40, severity: "medium", confidence: "high" } };
  const ctx = sandbox({ learning, snapshot });
  const preview = ctx.pvc11PendingLearningPreview();
  assert.equal(preview.pending, true);
  assert.equal(preview.pendingMonths, 2);
  assert.equal(preview.currentDelta, 55);
  assert.equal(preview.previousDelta, 40);
  assert.equal(preview.currentConfidence, "high");
});

test("pvc11PendingLearningPreview · primera vez con historial (sin foto previa): previousDelta null, no revienta", () => {
  const learning = { deviations: [{ conceptId: "monthly-net", sampleMonths: 6, averageDelta: 20, severity: "low", confidence: "medium" }] };
  const ctx = sandbox({ learning, snapshot: {} });
  const preview = ctx.pvc11PendingLearningPreview();
  assert.equal(preview.pending, true);
  assert.equal(preview.pendingMonths, 6);
  assert.equal(preview.previousDelta, null);
});

test("pvc11PendingLearningPreview · el histórico conciliado retrocede (dato corregido a la baja), nunca cuenta meses negativos", () => {
  const learning = { deviations: [{ conceptId: "monthly-net", sampleMonths: 5, averageDelta: 10, severity: "low", confidence: "medium" }] };
  const snapshot = { "monthly-net": { sampleMonths: 9, averageDelta: 40, severity: "medium", confidence: "high" } };
  const ctx = sandbox({ learning, snapshot });
  const preview = ctx.pvc11PendingLearningPreview();
  assert.equal(preview.pending, false);
  assert.equal(preview.pendingMonths, 0);
});

test("renderPvc11PendingLearning · sin nada pendiente, dice que el aprendizaje está al día", () => {
  const note = { textContent: "" };
  const learning = { deviations: [{ conceptId: "monthly-net", sampleMonths: 8, averageDelta: 30, severity: "medium", confidence: "high" }] };
  const snapshot = { "monthly-net": { sampleMonths: 8, averageDelta: 30, severity: "medium", confidence: "high" } };
  const ctx = sandbox({ learning, snapshot, elements: { pvc11PendingLearningNote: note } });
  ctx.renderPvc11PendingLearning();
  assert.match(note.textContent, /al día/);
});

test("renderPvc11PendingLearning · con meses pendientes, cuenta cuántos y el desplazamiento de la desviación, sin aplicar nada", () => {
  const note = { textContent: "" };
  const learning = { deviations: [{ conceptId: "monthly-net", sampleMonths: 11, averageDelta: 55, severity: "medium", confidence: "high" }] };
  const snapshot = { "monthly-net": { sampleMonths: 9, averageDelta: 40, severity: "medium", confidence: "high" } };
  const ctx = sandbox({ learning, snapshot, elements: { pvc11PendingLearningNote: note } });
  ctx.renderPvc11PendingLearning();
  assert.match(note.textContent, /2 meses conciliados nuevos/);
  assert.match(note.textContent, /No se aplica nada hasta que cierres el mes/);
});

test("renderPvc11PendingLearning · sin elemento en el DOM, no revienta", () => {
  const ctx = sandbox({ learning: { deviations: [] }, snapshot: {}, elements: {} });
  assert.doesNotThrow(() => ctx.renderPvc11PendingLearning());
});

test("pvc11PendingLearningPreview nunca guarda snapshot ni aplica el sesgo aprendido: es de solo lectura", () => {
  const block = extractFunction("pvc11PendingLearningPreview");
  assert.doesNotMatch(block, /savePv3LearningSnapshot/);
  assert.doesNotMatch(block, /applyLearnedBias/);
});

test("wiring: renderPvc11PendingLearning se llama junto a renderPv5Diary en el ciclo de render", () => {
  assert.match(appSource, /renderPv5Diary\(\);\s*\n\s*renderPvc11PendingLearning\(\);/);
});
