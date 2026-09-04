const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const indexSource = fs.readFileSync(path.join(root, "index.html"), "utf8");
const MortgageScenarios = require(path.join(root, "canonical-mortgage-rate-scenarios.js"));

// APX5 (Oleada 2 Bloque 2): coste total de refinanciar, no solo el tipo. Depende de DI1
// (canonical-mortgage-rate-scenarios.js), calculadora puntual sin persistir nada. Extiende su
// escenario "base" con el punto de equilibrio en meses entre el ahorro mensual real y la comisión
// de cancelación/subrogación + gastos de novación que declara el hogar.

function scenariosFor(currentVariableRate, fixedRateOffer) {
  return MortgageScenarios.evaluateMortgageRateScenarios({
    principal: 100000,
    months: 240,
    currentVariableRate,
    fixedRateOffer,
  }).scenarios;
}

test("refinancingBreakEvenMonths · la fija sale más barata en base: calcula meses de equilibrio con el coste declarado", () => {
  const scenarios = scenariosFor(4, 2.5);
  const result = MortgageScenarios.refinancingBreakEvenMonths(scenarios, 1200);
  assert.equal(result.calculable, true);
  assert.ok(result.monthlySavings > 0);
  assert.equal(result.months, Math.ceil(1200 / result.monthlySavings));
});

test("refinancingBreakEvenMonths · sin coste de refinanciar (0€), el equilibrio es inmediato (0 meses), no 'no calculable'", () => {
  const scenarios = scenariosFor(4, 2.5);
  const result = MortgageScenarios.refinancingBreakEvenMonths(scenarios, 0);
  assert.equal(result.calculable, true);
  assert.equal(result.months, 0);
});

test("refinancingBreakEvenMonths · la fija NO ahorra cuota en base (variable más barata o igual): nunca divide, no calculable", () => {
  const scenarios = scenariosFor(2, 4);
  const result = MortgageScenarios.refinancingBreakEvenMonths(scenarios, 1200);
  assert.equal(result.calculable, false);
  assert.equal(result.months, null);
});

test("refinancingBreakEvenMonths · sin escenario base en la lista, no calculable (nunca asume otro escenario)", () => {
  const result = MortgageScenarios.refinancingBreakEvenMonths([{ id: "stress", variableMonthlyPayment: 500, fixedMonthlyPayment: 400 }], 1000);
  assert.equal(result.calculable, false);
});

test("app.js: apx5RefinancingBreakEvenHtml lee el coste de refinanciar declarado y llama al motor de DI1", () => {
  const block = app.slice(app.indexOf("function apx5RefinancingBreakEvenHtml("), app.indexOf("function apx5RefinancingBreakEvenHtml(") + 700);
  assert.match(block, /qs\("ajustesMortgageRefinancingCost"\)\?\.value/);
  assert.match(block, /engine\.refinancingBreakEvenMonths\(scenarios, refinancingCost\)/);
});

test("app.js: handleDi1CompareMortgageScenarios pinta también el punto de equilibrio de APX5", () => {
  const block = app.slice(app.indexOf("function handleDi1CompareMortgageScenarios("), app.indexOf("function handleDi1CompareMortgageScenarios(") + 1800);
  assert.match(block, /apx5RefinancingBreakEvenHtml\(result\.scenarios\)/);
});

test("index.html: el campo de coste de refinanciar está en la misma tarjeta de DI1, sin formulario nuevo", () => {
  assert.match(indexSource, /id="ajustesMortgageRefinancingCost"/);
  const block = indexSource.slice(indexSource.indexOf("Hipoteca variable"), indexSource.indexOf("Hipoteca variable") + 2500);
  assert.match(block, /ajustesMortgageRefinancingCost/);
});
