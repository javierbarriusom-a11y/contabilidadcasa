const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const engine = require(path.join(root, "canonical-engine.js"));
const forecast = require(path.join(root, "canonical-forecast.js"));
const appSource = fs.readFileSync(path.join(root, "app.js"), "utf8");
const indexSource = fs.readFileSync(path.join(root, "index.html"), "utf8");

// PVX5 (Oleada 2 Bloque 5): árbol causal navegable de una cifra. No es un motor nuevo — combina la
// serie ya decompuesta del forecast (A7-3, decomposeMonth) con el diario de recalibración (PV5).
// El hogar elige el mes; nunca hay un mes "representativo" inventado por este motor.

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

function buildSeries() {
  const input = fixture();
  const scenario = engine.buildScenario(input, null, { generatedAt: "2026-08-02T08:00:00.000Z" });
  return forecast.buildForecast(input, scenario, {}, { generatedAt: "2026-08-02T08:00:00.000Z" }).series;
}

test("causalTreeForMonth · sin mes o mes inexistente en la serie, no calculable", () => {
  const series = buildSeries();
  assert.equal(forecast.causalTreeForMonth("", { series }).calculable, false);
  assert.equal(forecast.causalTreeForMonth("2099-01", { series }).calculable, false);
  assert.equal(forecast.causalTreeForMonth("2026-08", { series: [] }).calculable, false);
});

test("causalTreeForMonth · la raíz es el flujo neto exacto y las ramas cuadran con los totales del mes", () => {
  const series = buildSeries();
  const month = series[0];
  const tree = forecast.causalTreeForMonth("2026-08", { series });
  assert.equal(tree.calculable, true);
  assert.equal(tree.monthKey, "2026-08");
  const income = tree.branches.find((branch) => branch.id === "income");
  const outflow = tree.branches.find((branch) => branch.id === "outflow");
  assert.equal(income.amount, month.totals.income);
  assert.equal(outflow.amount, month.totals.outflowsBeforeSaving);
  assert.equal(tree.root.amount, Math.round((month.totals.income - month.totals.outflowsBeforeSaving) * 100) / 100);
});

test("causalTreeForMonth · las hojas son el mismo desglose real/recurrencia/evento/deuda/proyecto/ajuste que A7-3, sin inventar nada nuevo", () => {
  const series = buildSeries();
  const tree = forecast.causalTreeForMonth("2026-08", { series });
  const income = tree.branches.find((branch) => branch.id === "income");
  const outflow = tree.branches.find((branch) => branch.id === "outflow");
  const leaf = (branch, id) => branch.leaves.find((item) => item.id === id).amount;
  assert.equal(leaf(income, "recurrence"), 3000);
  assert.equal(leaf(income, "manualAdjustment"), 150);
  assert.equal(leaf(income, "event"), 0);
  assert.equal(leaf(outflow, "recurrence"), 1500);
  assert.equal(leaf(outflow, "debt"), 500);
  assert.equal(leaf(outflow, "project"), 100);
  assert.equal(leaf(outflow, "manualAdjustment"), 150);
  assert.equal(leaf(outflow, "event"), 0);
  ["income", "outflow"].forEach((branchId) => {
    const branch = tree.branches.find((item) => item.id === branchId);
    assert.deepEqual(branch.leaves.map((item) => item.id), ["real", "recurrence", "event", "debt", "project", "manualAdjustment"]);
  });
});

test("causalTreeForMonth · la explicación causal de la raíz solo viene del diario de PV5 cuando hay una entrada exacta para ese mes y ese concepto", () => {
  const series = buildSeries();
  const diary = [
    { conceptId: "monthly-net", monthKey: "2026-08", reason: "Pasó de 10 € a 40 € de desviación media (confianza high).", at: "2026-09-01T00:00:00.000Z" },
    { conceptId: "monthly-net", monthKey: "2026-07", reason: "No debería aparecer, es de otro mes.", at: "2026-08-01T00:00:00.000Z" },
    { conceptId: "otro-concepto", monthKey: "2026-08", reason: "No debería aparecer, es de otro concepto.", at: "2026-09-01T00:00:00.000Z" },
  ];
  const tree = forecast.causalTreeForMonth("2026-08", { series, diary });
  assert.equal(tree.root.diary.length, 1);
  assert.match(tree.root.diary[0].reason, /Pasó de 10/);

  const withoutMatch = forecast.causalTreeForMonth("2026-08", { series, diary: [] });
  assert.equal(withoutMatch.root.diary.length, 0);
});

test("canonical-forecast.js: exporta CAUSAL_TREE_SCHEMA_ID y causalTreeForMonth", () => {
  assert.equal(typeof forecast.CAUSAL_TREE_SCHEMA_ID, "string");
  assert.equal(typeof forecast.causalTreeForMonth, "function");
});

test("index.html: la tarjeta del árbol causal tiene el selector de mes y el contenedor", () => {
  ["pvx5MonthSelect", "pvx5CausalTree"].forEach((id) => {
    assert.match(indexSource, new RegExp(`id="${id}"`), `Falta #${id} en la tarjeta de PVX5`);
  });
});

test("app.js: renderPvx5CausalTree usa causalTreeForMonth con la serie base y el diario de PV5, y está cableada en Ajustes y en el selector", () => {
  const block = appSource.slice(appSource.indexOf("function renderPvx5CausalTree("), appSource.indexOf("function renderPvx5CausalTree(") + 900);
  assert.match(block, /canonicalScenarioResults\.base\?\.forecast/);
  assert.match(block, /engine\.causalTreeForMonth\(/);
  assert.match(block, /loadPv5Diary\(\)/);
  assert.match(block, /selectableMonths\(\{ includeClosed: true \}\)/);
  assert.match(appSource, /renderPv5Diary\(\);\s*\n\s*renderPvx5CausalTree\(\);/);
  assert.match(appSource, /qs\("pvx5MonthSelect"\)\?\.addEventListener\("change", renderPvx5CausalTree\);/);
});

test("app.js: pvx5CausalTreeHtml declara explícitamente que «evento puntual» sale en 0 en vez de omitir la hoja", () => {
  const block = appSource.slice(appSource.indexOf("function pvx5CausalTreeHtml("), appSource.indexOf("function pvx5CausalTreeHtml(") + 1600);
  assert.match(block, /Elige un mes con previsión calculada/);
  assert.match(block, /Evento puntual.*sale siempre en 0/);
  assert.match(block, /Sin cambio de aprendizaje \(PV5\) registrado/);
});
