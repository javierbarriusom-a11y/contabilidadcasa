const test = require("node:test");
const assert = require("node:assert/strict");
const Mortgage = require("../canonical-mortgage-rate-scenarios.js");

// DI1 · Bloque 4: hipoteca variable → fija bajo escenarios de tipos. Mismo marco de tres escenarios
// que ya usa el Laboratorio de escenarios (E13: base/favorable/tensión), aplicado al tipo de interés.
// Sin tipos de mercado reales — el hogar declara capital, plazo, tipo variable actual y la oferta de
// tipo fijo; el motor solo calcula la cuota francesa estándar bajo cada escenario.

test("monthlyPayment · cuota francesa estándar (fórmula estándar, verificada aparte)", () => {
  // P·r·(1+r)^n / ((1+r)^n - 1), r = 0,03/12, n = 240 → 665,5171... redondeado a 665,52.
  const payment = Mortgage.monthlyPayment(120000, 3, 240);
  assert.equal(payment, 665.52);
});

test("monthlyPayment · con tipo 0, la cuota es lineal (principal / meses), sin dividir por cero", () => {
  assert.equal(Mortgage.monthlyPayment(12000, 0, 12), 1000);
});

test("monthlyPayment · sin capital, la cuota es 0", () => {
  assert.equal(Mortgage.monthlyPayment(0, 3, 240), 0);
});

test("evaluateMortgageRateScenarios · tres escenarios (base/favorable/tensión), mismo marco que E13", () => {
  const result = Mortgage.evaluateMortgageRateScenarios({
    principal: 120000, months: 240, currentVariableRate: 3, fixedRateOffer: 3.5,
  });
  assert.equal(result.scenarios.length, 3);
  assert.deepEqual(result.scenarios.map((s) => s.id), ["base", "favorable", "stress"]);
  const base = result.scenarios.find((s) => s.id === "base");
  assert.equal(base.variableRate, 3);
  const favorable = result.scenarios.find((s) => s.id === "favorable");
  assert.equal(favorable.variableRate, 2); // -1 punto
  const stress = result.scenarios.find((s) => s.id === "stress");
  assert.equal(stress.variableRate, 4.5); // +1.5 puntos
});

test("evaluateMortgageRateScenarios · en el escenario de tensión, la variable puede salir más cara que la fija", () => {
  const result = Mortgage.evaluateMortgageRateScenarios({
    principal: 120000, months: 240, currentVariableRate: 3, fixedRateOffer: 3.2,
  });
  const stress = result.scenarios.find((s) => s.id === "stress"); // variable al 4.5%
  assert.equal(stress.cheaper, "fixed");
  const favorable = result.scenarios.find((s) => s.id === "favorable"); // variable al 2%
  assert.equal(favorable.cheaper, "variable");
});

test("evaluateMortgageRateScenarios · el delta de tipo nunca deja un tipo negativo", () => {
  const result = Mortgage.evaluateMortgageRateScenarios({
    principal: 120000, months: 240, currentVariableRate: 0.5, fixedRateOffer: 3,
  });
  const favorable = result.scenarios.find((s) => s.id === "favorable"); // 0.5 - 1 = -0.5, recortado a 0
  assert.equal(favorable.variableRate, 0);
});

test("evaluateMortgageRateScenarios · empate real cuando ambas cuestan lo mismo", () => {
  const result = Mortgage.evaluateMortgageRateScenarios({
    principal: 120000, months: 240, currentVariableRate: 3, fixedRateOffer: 3,
  });
  const base = result.scenarios.find((s) => s.id === "base");
  assert.equal(base.cheaper, "tie");
  assert.equal(base.difference, 0);
});
