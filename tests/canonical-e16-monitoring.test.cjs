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

// CP5 · Bloque 2: el umbral de caja pasa del binario (alerta solo por debajo del mínimo) a tres
// bandas — critical (negativa), high (por debajo del mínimo, como siempre) y medium, nueva, dentro
// de un margen por encima del mínimo, para avisar antes de cruzarlo.

test("cashSeverityBand · las tres bandas, en orden: critical, high y medium", () => {
  assert.equal(E16.cashSeverityBand(-50, 500), "critical");
  assert.equal(E16.cashSeverityBand(300, 500), "high");
  assert.equal(E16.cashSeverityBand(550, 500), "medium"); // dentro del 20% por encima del mínimo
  assert.equal(E16.cashSeverityBand(700, 500), null); // fuera de cualquier margen, sin alerta
});

test("cashSeverityBand · los límites de cada banda son estrictos", () => {
  assert.equal(E16.cashSeverityBand(0, 500), "high", "cero justo no es negativo, sigue por debajo del mínimo");
  assert.equal(E16.cashSeverityBand(500, 500), "medium", "justo en el mínimo ya no es \"high\", cuenta como \"cerca\"");
  assert.equal(E16.cashSeverityBand(600, 500), null, "justo en el margen del 20% ya no alerta");
});

test("cashSeverityBand · sin mínimo configurado (0), la banda media no significa nada y se omite", () => {
  assert.equal(E16.cashSeverityBand(50, 0), null);
  assert.equal(E16.cashSeverityBand(-50, 0), "critical", "negativa sigue alertando aunque no haya mínimo configurado");
});

test("predictiveAlerts · añade la alerta media cuando la caja se acerca al mínimo sin cruzarlo", () => {
  const acercandose = { series: [{ monthKey: "2026-09", confidence: "high", totals: { closingLiquidity: 550 } }] };
  const result = E16.predictiveAlerts(acercandose, { minimumLiquidity: 500 }, {});
  const alert = result.alerts.find((item) => item.type === "cash");
  assert.ok(alert, "debe avisar aunque la caja siga por encima del mínimo");
  assert.equal(alert.severity, "medium");
  assert.match(alert.message, /cerca del mínimo/);
});

test("predictiveAlerts · sin acercarse al mínimo, sigue sin alertar (nada cambia fuera del margen nuevo)", () => {
  const holgada = { series: [{ monthKey: "2026-09", confidence: "high", totals: { closingLiquidity: 950 } }] };
  const result = E16.predictiveAlerts(holgada, { minimumLiquidity: 500 }, {});
  assert.equal(result.alerts.some((item) => item.type === "cash"), false);
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
