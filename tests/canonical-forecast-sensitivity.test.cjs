const test = require("node:test");
const assert = require("node:assert/strict");
const Sensitivity = require("../canonical-forecast-sensitivity.js");

// PV6 · Bloque 5: sensibilidad del veredicto de la previsión. No recalcula el forecast — resuelve
// algebraicamente qué cambio de ingreso o gasto haría que el mínimo ajustado cruzara cero, a partir
// de los mismos tres valores que previsionMetric() ya calcula (base implícita, ingreso, gasto).

test("verdictSensitivity · en positivo, dice cuánto puede caer el ingreso o subir el gasto antes de cruzar cero", () => {
  // base=1000, income=500, expense=1200 → adjustedMin = 300 (positivo)
  const result = Sensitivity.verdictSensitivity({ adjustedMin: 300, income: 500, expense: 1200 });
  assert.equal(result.verdict, "safe");
  assert.equal(result.incomeDropPercent, 60); // el ingreso puede caer un 60% (de 500 a 200)
  assert.equal(result.incomeThreshold, 200);
  assert.equal(result.expenseRisePercent, 25); // el gasto puede subir un 25% (de 1200 a 1500)
  assert.equal(result.expenseThreshold, 1500);
});

test("verdictSensitivity · en negativo, el signo indica que hace falta el cambio contrario para recuperarse", () => {
  // base=1000, income=500, expense=2000 → adjustedMin = -500 (negativo)
  const result = Sensitivity.verdictSensitivity({ adjustedMin: -500, income: 500, expense: 2000 });
  assert.equal(result.verdict, "danger");
  assert.equal(result.incomeDropPercent, -100); // el ingreso necesitaría duplicarse (+100%), no caer
  assert.equal(result.incomeThreshold, 1000);
  assert.equal(result.expenseRisePercent, -25); // el gasto necesitaría bajar un 25%, no subir
  assert.equal(result.expenseThreshold, 1500);
});

test("verdictSensitivity · sin ingreso, no fabrica un porcentaje sobre cero", () => {
  const result = Sensitivity.verdictSensitivity({ adjustedMin: 100, income: 0, expense: 500 });
  assert.equal(result.incomeDropPercent, null);
  assert.equal(result.incomeThreshold, null);
  assert.ok(result.expenseRisePercent !== null);
});

test("verdictSensitivity · sin gasto, no fabrica un porcentaje sobre cero", () => {
  const result = Sensitivity.verdictSensitivity({ adjustedMin: 100, income: 500, expense: 0 });
  assert.equal(result.expenseRisePercent, null);
  assert.equal(result.expenseThreshold, null);
  assert.ok(result.incomeDropPercent !== null);
});

test("verdictSensitivity · el umbral resuelto de verdad cruza cero (comprobación algebraica)", () => {
  const result = Sensitivity.verdictSensitivity({ adjustedMin: 300, income: 500, expense: 1200 });
  const base = 1000; // adjustedMin - income + expense = 300 - 500 + 1200
  assert.equal(base + result.incomeThreshold - 1200, 0);
  assert.equal(base + 500 - result.expenseThreshold, 0);
});
