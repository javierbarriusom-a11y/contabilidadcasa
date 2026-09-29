const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// Ola 1 · P1: `normalizedText` se cachea y planningBreakdownForForecastMonth se memoiza con ALCANCE
// ACOTADO, porque ambas se llaman dentro de bucles (medido en Asesor virtual: >2 s de tiempo propio en
// normalizedText y 40.176 llamadas al desglose para 248 combinaciones distintas). Estas pruebas fijan
// que el resultado es idéntico al original y que la memoria nunca sobrevive a su alcance.

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

function block(startMarker, endMarker) {
  const start = app.indexOf(startMarker);
  const end = app.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `No se encontró el bloque ${startMarker}`);
  return app.slice(start, end);
}

function refNormalized(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

test("normalizedText con caché coincide con la implementación original (acentos, vacíos, no-string) y sigue acotada", () => {
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(`${block("function normalizedText", "function isCarPlanningRow")}\nthis.normalizedText = normalizedText;`, sandbox);
  const samples = ["Refinanciación Cetelem", "ÁÉÍÓÚ ñ Ü", "", null, undefined, 0, 12.5, "  Coche  BMW ", "Ça va", "Refinanciación Cetelem"];
  for (const value of samples) assert.equal(sandbox.normalizedText(value), refNormalized(value));
  for (let i = 0; i < 12000; i += 1) assert.equal(sandbox.normalizedText(`Concepto ${i} ÁÑ`), refNormalized(`Concepto ${i} ÁÑ`));
  assert.ok(sandbox.normalizedText.cache.size <= 5000, "la caché no crece sin límite");
  assert.equal(sandbox.normalizedText("Refinanciación Cetelem"), "refinanciacion cetelem");
});

function loadBreakdownSandbox() {
  const source = [
    block("let planningBreakdownMemo", "const HEAVY_RENDER_VIEWS"),
    block("function withPlanningBreakdownMemo", "function canonicalEngineInput"),
  ].join("\n");
  const sandbox = {
    calls: 0,
    monthKey: (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
    planningBreakdownForForecastMonth(index, date, options) { sandbox.calls += 1; return { index, options, id: sandbox.calls }; },
    Map,
  };
  vm.createContext(sandbox);
  vm.runInContext(`${source}\nthis.api = { withPlanningBreakdownMemo, planningBreakdownMemoized, isActive: () => planningBreakdownMemo !== null };`, sandbox);
  return sandbox;
}

test("fuera de withPlanningBreakdownMemo nunca se cachea (cada llamada recalcula)", () => {
  const sb = loadBreakdownSandbox();
  const date = new Date(2026, 8, 1);
  sb.api.planningBreakdownMemoized(0, date, {});
  sb.api.planningBreakdownMemoized(0, date, {});
  assert.equal(sb.calls, 2);
});

test("dentro del alcance se calcula una vez por (índice, mes, useActuals) y la memoria se libera al salir", () => {
  const sb = loadBreakdownSandbox();
  const date = new Date(2026, 8, 1);
  const other = new Date(2026, 9, 1);
  sb.api.withPlanningBreakdownMemo(() => {
    assert.ok(sb.api.isActive());
    const first = sb.api.planningBreakdownMemoized(0, date, {});
    for (let i = 0; i < 50; i += 1) assert.equal(sb.api.planningBreakdownMemoized(0, date, {}), first);
    sb.api.planningBreakdownMemoized(0, other, {});
    sb.api.planningBreakdownMemoized(1, date, {});
    sb.api.planningBreakdownMemoized(0, date, { useActuals: false });
    sb.api.withPlanningBreakdownMemo(() => assert.equal(sb.api.planningBreakdownMemoized(0, date, {}), first, "el alcance anidado reutiliza la misma memoria"));
  });
  assert.equal(sb.calls, 4);
  assert.equal(sb.api.isActive(), false);
  sb.api.planningBreakdownMemoized(0, date, {});
  assert.equal(sb.calls, 5, "tras salir del alcance vuelve a recalcular");
});

test("la memoria se libera también cuando el cálculo lanza una excepción", () => {
  const sb = loadBreakdownSandbox();
  assert.throws(() => sb.api.withPlanningBreakdownMemo(() => { throw new Error("boom"); }), /boom/);
  assert.equal(sb.api.isActive(), false);
});

test("el motor recibe copias de los arrays de eventos, la variable se declara antes de usarse y los tres bucles de deuda usan el alcance", () => {
  assert.match(app, /const incomeEvents = planningBreakdownMemo \? \(detail\.incomeEvents \|\| \[\]\)\.slice\(\)/);
  assert.match(app, /expenseEvents: planningBreakdownMemo \? \(detail\.expenseEvents \|\| \[\]\)\.slice\(\)/);
  assert.ok(app.indexOf("let planningBreakdownMemo") < app.indexOf("function withPlanningBreakdownMemo"));
  assert.ok(app.indexOf("let planningBreakdownMemo") < app.indexOf("normalizedText("), "declarada antes de cualquier uso durante la carga (sin zona muerta temporal)");
  assert.match(app, /withPlanningBreakdownMemo\(\(\) => evaluateDebtCandidate\(target, amount \|\| originalPrincipal/);
  const controlView = fs.readFileSync(path.join(root, "views/debt-control.js"), "utf8");
  const definitiveView = fs.readFileSync(path.join(root, "views/new-life-definitive.js"), "utf8");
  assert.match(controlView, /withPlanningBreakdownMemo\(\(\) => evaluateDebtCandidate\(/);
  assert.match(definitiveView, /withPlanningBreakdownMemo\(\(\) => evaluateDebtCandidate\(/);
});
