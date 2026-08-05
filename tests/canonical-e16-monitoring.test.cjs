const test = require("node:test");
const assert = require("node:assert/strict");
const E16 = require("../canonical-e16-monitoring.js");

const forecast = { series: [
  { monthKey: "2026-09", confidence: "high", totals: { closingLiquidity: 950 } },
  { monthKey: "2026-10", confidence: "medium", totals: { closingLiquidity: 300 } },
] };

test("E16 anticipa riesgos de caja con horizonte, confianza y evidencia", () => {
  const result = E16.predictiveAlerts(forecast, { minimumLiquidity: 500, maximumMonthlyVariation: 400, maximumDebtRatio: 30 }, { debtRatio: 42 });
  assert.equal(result.readOnly, true);
  assert.equal(result.alerts.some((item) => item.type === "cash" && item.monthKey === "2026-10"), true);
  assert.equal(result.alerts.some((item) => item.type === "variation"), true);
  assert.equal(result.alerts.some((item) => item.type === "debt"), true);
  assert.equal(result.alerts.find((item) => item.type === "cash").evidence.includes("forecast canónico"), true);
});

test("E16 resume cambios sin inventar una revisión previa", () => {
  const changes = E16.changeSummary({ movements: [{ label: "Supermercado", amount: -80, date: "2026-08-05" }], deviations: [{ label: "Comida", delta: 25 }] });
  assert.equal(changes.readOnly, true);
  assert.equal(changes.movements.length, 1);
  assert.equal(changes.deviations[0].delta, 25);
});

test("E16 mide la calidad solo con periodos completos", () => {
  const quality = E16.predictionQuality({ samples: [
    { category: "Gasto", predicted: 100, actual: 120, complete: true },
    { category: "Gasto", predicted: 100, actual: 0, complete: false },
  ] });
  assert.equal(quality.samples, 1);
  assert.equal(quality.meanAbsoluteError, 20);
  assert.equal(quality.categories[0].category, "Gasto");
});

test("E16 entrega recomendaciones trazables y no ejecutables", () => {
  const model = E16.buildReadModel({ forecast, riskBudget: { minimumLiquidity: 500 }, predictionSamples: [] });
  assert.equal(model.readOnly, true);
  assert.equal(model.recommendations.recommendations.some((item) => item.confirmRequired), true);
  assert.match(model.recommendations.note, /no modifican el plan/);
});
