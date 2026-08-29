const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const engine = require("../canonical-engine.js");
const forecast = require("../canonical-forecast.js");
const root = path.resolve(__dirname, "..");

function fixture() {
  return {
    openingBalances: { checking: 1200, savings: 800 },
    policy: {
      incomeFactor: 1.05,
      annualIncomeGrowth: 0,
      expenseFactor: 1.1,
      annualInflation: 0,
      plannedMonthlySaving: 250,
      autoCapSavings: true,
    },
    months: [{
      index: 1,
      month: "ago 26",
      monthKey: "2026-08",
      income: 3000,
      coreSpend: 1500,
      variableOperationalSpend: 500,
      car: 200,
      refi: 300,
      projectOutflow: 100,
    }],
  };
}

test("E12a crea un registro central, versionado y estable de supuestos", () => {
  const input = fixture();
  const first = forecast.buildAssumptionRegistry(input, {}, { generatedAt: "2026-08-02T08:00:00.000Z" });
  const second = forecast.buildAssumptionRegistry(input, first, { generatedAt: "2026-08-02T09:00:00.000Z" });

  assert.equal(first.schemaId, forecast.ASSUMPTIONS_SCHEMA_ID);
  assert.equal(first.items.length, 8);
  assert.equal(first.items.find((item) => item.id === "annualInflation").value, 0);
  assert.equal(second.fingerprint, first.fingerprint);
  assert.equal(second.items[0].updatedAt, first.items[0].updatedAt);
});

test("E12a explica cada mes y mantiene paridad exacta con el motor canónico", () => {
  const input = fixture();
  const scenario = engine.buildScenario(input, null, { generatedAt: "2026-08-02T08:00:00.000Z" });
  const result = forecast.buildForecast(input, scenario, {}, { generatedAt: "2026-08-02T08:00:00.000Z" });
  const month = result.series[0];

  assert.equal(result.schemaId, forecast.SCHEMA_ID);
  assert.equal(result.valid, true);
  assert.equal(result.parity.matched, true);
  assert.equal(month.components.income.recurrence, 3000);
  assert.equal(month.components.income.manualAdjustment, 150);
  assert.equal(month.components.outflow.recurrence, 1500);
  assert.equal(month.components.outflow.manualAdjustment, 150);
  assert.equal(month.components.outflow.debt, 500);
  assert.equal(month.components.outflow.project, 100);
  assert.equal(month.totals.closingLiquidity, scenario.rows[0].totalLiquidity);
});

test("la barrera de paridad detecta una salida alterada", () => {
  const input = fixture();
  const scenario = engine.buildScenario(input);
  const result = forecast.buildForecast(input, scenario);
  result.series[0].totals.closingLiquidity += 1;

  const parity = forecast.validateParity(result.series, scenario.rows);
  assert.equal(parity.matched, false);
  assert.equal(parity.differences[0].field, "closingLiquidity");
});

test("el contrato E12a se carga antes que la app y forma parte del shell offline", () => {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const worker = fs.readFileSync(path.join(root, "service-worker.js"), "utf8");
  assert.ok(html.indexOf("canonical-forecast.js") < html.indexOf("app.js"));
  assert.match(worker, /canonical-forecast\.js/);
  assert.match(worker, /finanzas-casa-shell-20260821-d1a1/);
});

test("E12b aprende desviaciones y estacionalidad solo de histórico conciliado", () => {
  const learned = forecast.learnFromHistory([
    { monthKey: "2026-01", conceptId: "salary", label: "Nómina", planned: 2000, actual: 2100, reconciled: true },
    { monthKey: "2026-02", conceptId: "salary", label: "Nómina", planned: 2000, actual: 2200, reconciled: true },
    { monthKey: "2026-03", conceptId: "salary", planned: 2000, actual: 9000, reconciled: false },
  ], { generatedAt: "2026-08-02T12:00:00.000Z" });
  assert.equal(learned.schemaId, forecast.LEARNING_SCHEMA_ID);
  assert.equal(learned.includedRecords, 2);
  assert.equal(learned.excludedRecords, 1);
  assert.equal(learned.deviations[0].suggestedAdjustment, 150);
  assert.equal(learned.deviations[0].confirmRequired, true);
  assert.equal(learned.deviations[0].applied, false);
});

// PV2 · Bloque 2: la desviación media en euros no dice por sí sola si una partida va poco o muy
// desviada — deviationSeverity normaliza contra lo previsto medio para dar tres bandas comparables.

test("deviationSeverity · tres bandas según el ratio frente a lo previsto medio", () => {
  assert.equal(forecast.deviationSeverity(5, 1000), "low"); // 0.5%
  assert.equal(forecast.deviationSeverity(150, 1000), "medium"); // 15%
  assert.equal(forecast.deviationSeverity(300, 1000), "high"); // 30%
});

test("deviationSeverity · los límites de cada banda son estrictos (10% y 25%)", () => {
  assert.equal(forecast.deviationSeverity(100, 1000), "medium", "justo en el 10% ya cuenta como moderada");
  assert.equal(forecast.deviationSeverity(99.99, 1000), "low");
  assert.equal(forecast.deviationSeverity(250, 1000), "high", "justo en el 25% ya cuenta como alta");
});

test("deviationSeverity · sin previsto medio conocido (0), cualquier desviación real es alta, ninguna es baja por defecto", () => {
  assert.equal(forecast.deviationSeverity(50, 0), "high");
  assert.equal(forecast.deviationSeverity(0, 0), "low");
});

test("learnFromHistory · cada desviación lleva su previsto medio y severidad, sin recalcular fuera", () => {
  const learned = forecast.learnFromHistory([
    { monthKey: "2026-01", conceptId: "salary", label: "Nómina", planned: 2000, actual: 2100, reconciled: true },
    { monthKey: "2026-02", conceptId: "salary", label: "Nómina", planned: 2000, actual: 2200, reconciled: true },
  ], { generatedAt: "2026-08-02T12:00:00.000Z" });
  const salary = learned.deviations[0];
  assert.equal(salary.averagePlanned, 2000);
  assert.equal(salary.averageDelta, 150);
  assert.equal(salary.severity, "low"); // 150/2000 = 7,5%, por debajo del 10%
});

test("learnFromHistory · una partida con desviación grande frente a lo previsto sale como alta", () => {
  const learned = forecast.learnFromHistory([
    { monthKey: "2026-01", conceptId: "leisure", label: "Ocio", planned: 100, actual: 160, reconciled: true },
    { monthKey: "2026-02", conceptId: "leisure", label: "Ocio", planned: 100, actual: 140, reconciled: true },
  ], { generatedAt: "2026-08-02T12:00:00.000Z" });
  assert.equal(learned.deviations[0].averageDelta, 50);
  assert.equal(learned.deviations[0].severity, "high"); // 50/100 = 50%
});

test("E12b adapta el horizonte sin mostrar puntos falsamente precisos a largo plazo", () => {
  const series = Array.from({ length: 40 }, (_, index) => ({ monthKey: `${2026 + Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`, totals: { closingLiquidity: 1000 + index } }));
  const horizon = forecast.adaptiveHorizon(series, { monthlyUntil: 12, quarterlyUntil: 36 });
  assert.equal(horizon[0].resolution, "month");
  assert.equal(horizon.find((item) => item.resolution === "quarter").display, "range");
  assert.equal(horizon.at(-1).resolution, "year");
});

// --- A16-3: detectRecurringSubscriptions ------------------------------------------------------

function subscriptionMovements(pattern, amount, months, category = "Suscripciones") {
  return months.map((month) => ({ pattern, label: pattern, category, amount: -amount, month }));
}

test("detectRecurringSubscriptions · un cargo igual repetido 3+ meses se detecta, con coste mensual y anualizado", () => {
  const result = forecast.detectRecurringSubscriptions(
    subscriptionMovements("NETFLIX", 12.99, ["2026-05", "2026-06", "2026-07"]),
  );
  assert.equal(result.detected.length, 1);
  const item = result.detected[0];
  assert.equal(item.monthlyCost, 12.99);
  assert.equal(item.annualCost, 155.88);
  assert.equal(item.sampleMonths, 3);
  assert.equal(item.confirmRequired, true);
  assert.equal(item.confirmed, false);
});

test("detectRecurringSubscriptions · por debajo del mínimo de meses, no se detecta", () => {
  const result = forecast.detectRecurringSubscriptions(
    subscriptionMovements("GIMNASIO", 30, ["2026-06", "2026-07"]),
  );
  assert.equal(result.detected.length, 0);
});

test("detectRecurringSubscriptions · un cambio de precio real cuenta como grupo aparte, no se fusiona con el histórico", () => {
  const rows = [
    ...subscriptionMovements("SPOTIFY", 9.99, ["2026-01", "2026-02", "2026-03"]),
    ...subscriptionMovements("SPOTIFY", 11.99, ["2026-04", "2026-05", "2026-06"]),
  ];
  const result = forecast.detectRecurringSubscriptions(rows);
  assert.equal(result.detected.length, 2);
  assert.deepEqual(result.detected.map((item) => item.monthlyCost).sort((a, b) => a - b), [9.99, 11.99]);
});

test("detectRecurringSubscriptions · ingresos y movimientos sin patrón se ignoran", () => {
  const result = forecast.detectRecurringSubscriptions([
    { pattern: "NOMINA", label: "Nómina", amount: 2000, month: "2026-06" }, // ingreso, no cuenta
    { pattern: "", label: "", amount: -20, month: "2026-06" }, // sin patrón
    ...subscriptionMovements("NETFLIX", 12.99, ["2026-05", "2026-06", "2026-07"]),
  ]);
  assert.equal(result.detected.length, 1);
  assert.equal(result.detected[0].pattern, "NETFLIX");
});

test("detectRecurringSubscriptions · totales agregados y confianza reutilizan el mismo criterio que learnFromHistory", () => {
  const result = forecast.detectRecurringSubscriptions([
    ...subscriptionMovements("NETFLIX", 12.99, ["2026-05", "2026-06", "2026-07"]),
    ...subscriptionMovements("GIMNASIO", 30, ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"]),
  ]);
  assert.equal(result.totalMonthlyCost, 42.99);
  assert.equal(result.totalAnnualCost, 515.88);
  const gym = result.detected.find((item) => item.pattern === "GIMNASIO");
  assert.equal(gym.confidence, "medium"); // 6 meses: confidence() da "medium" a partir de 6
  const netflix = result.detected.find((item) => item.pattern === "NETFLIX");
  assert.equal(netflix.confidence, "low"); // 3 meses: por debajo de 6
});

test("detectRecurringSubscriptions · nunca escribe nada, solo detecta (mismo criterio que learnFromHistory)", () => {
  assert.doesNotMatch(fs.readFileSync(path.join(root, "canonical-forecast.js"), "utf8").split("function detectRecurringSubscriptions")[1].split("\n\n  function adaptiveHorizon")[0], /localStorage|save|persist/i);
});
