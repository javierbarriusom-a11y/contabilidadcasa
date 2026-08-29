const test = require("node:test");
const assert = require("node:assert/strict");
const Tariff = require("../canonical-tariff-comparator.js");

// A19-3 · Bloque 2: comparador educativo de tarifas fijas frente a variables. Sin precios de
// mercado reales — el hogar declara consumo y ambos precios; el motor solo hace la comparación y el
// cálculo de break-even.

test("compareFixedVsVariableTariff · la tarifa fija sale más barata", () => {
  const result = Tariff.compareFixedVsVariableTariff({
    monthlyConsumption: 300, fixedPricePerUnit: 0.15, variablePricePerUnit: 0.20,
  });
  assert.equal(result.fixedMonthlyCost, 45);
  assert.equal(result.variableMonthlyCost, 60);
  assert.equal(result.cheaper, "fixed");
  assert.equal(result.difference, 15);
});

test("compareFixedVsVariableTariff · la tarifa variable sale más barata", () => {
  const result = Tariff.compareFixedVsVariableTariff({
    monthlyConsumption: 300, fixedPricePerUnit: 0.20, variablePricePerUnit: 0.15,
  });
  assert.equal(result.cheaper, "variable");
});

test("compareFixedVsVariableTariff · mismo coste con estos precios es un empate, no un desempate arbitrario", () => {
  const result = Tariff.compareFixedVsVariableTariff({
    monthlyConsumption: 300, fixedPricePerUnit: 0.15, variablePricePerUnit: 0.15,
  });
  assert.equal(result.cheaper, "tie");
  assert.equal(result.difference, 0);
});

test("compareFixedVsVariableTariff · los cargos fijos de cada tarifa entran en el coste mensual", () => {
  const result = Tariff.compareFixedVsVariableTariff({
    monthlyConsumption: 100, fixedPricePerUnit: 0.10, fixedStandingCharge: 5,
    variablePricePerUnit: 0.10, variableStandingCharge: 2,
  });
  assert.equal(result.fixedMonthlyCost, 15); // 10 + 5
  assert.equal(result.variableMonthlyCost, 12); // 10 + 2
  assert.equal(result.cheaper, "variable");
});

test("compareFixedVsVariableTariff · breakEvenVariablePrice es el precio variable al que ambas costarían lo mismo", () => {
  const result = Tariff.compareFixedVsVariableTariff({
    monthlyConsumption: 300, fixedPricePerUnit: 0.15, fixedStandingCharge: 0,
    variablePricePerUnit: 0.10, variableStandingCharge: 0,
  });
  // fixedMonthlyCost = 45; sin cargo variable, breakeven = 45/300 = 0.15 -- el propio precio fijo
  assert.equal(result.breakEvenVariablePrice, 0.15);
});

test("compareFixedVsVariableTariff · sin consumo, breakEvenVariablePrice es null, no una división por cero", () => {
  const result = Tariff.compareFixedVsVariableTariff({ monthlyConsumption: 0, fixedPricePerUnit: 0.15, variablePricePerUnit: 0.10 });
  assert.equal(result.breakEvenVariablePrice, null);
  assert.equal(result.fixedMonthlyCost, 0);
});

test("compareFixedVsVariableTariff · valores negativos se recortan a cero, no rompen el cálculo", () => {
  const result = Tariff.compareFixedVsVariableTariff({ monthlyConsumption: -50, fixedPricePerUnit: -0.1, variablePricePerUnit: -0.2 });
  assert.equal(result.consumption, 0);
  assert.equal(result.fixedMonthlyCost, 0);
});
