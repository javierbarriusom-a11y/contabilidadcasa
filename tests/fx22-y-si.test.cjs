// FX-22 (9/11/2026) · «¿Y si…?» desde la Previsión: un gasto único, un cambio de ingreso y un cambio de gasto al mes sobre la entrada del
// plan; guardado como escenario, Escenarios da los mismos meses. Cifras INVENTADAS.
const test = require("node:test");
const assert = require("node:assert/strict");

const S = require("../canonical-stress-scenarios.js");
const engine = require("../canonical-engine.js");
const scenarioEngine = require("../canonical-scenario-engine.js");
const schema = require("../canonical-scenario-schema.js");

function mes(monthKey) {
  return {
    month: monthKey, monthKey, income: 3000, coreSpend: 2000, variableOperationalSpend: 600, car: 0, refi: 0, projectOutflow: 0, endOfMonthOutflows: 0,
    incomeEvents: [{ concept: "Nómina INVENTADA", amount: 3000, date: `${monthKey}-25` }], expenseEvents: [],
  };
}
function input() {
  return {
    openingBalances: { checking: 4000, savings: 6000 },
    policy: { incomeFactor: 1, annualIncomeGrowth: 0, expenseFactor: 1, annualInflation: 0, plannedMonthlySaving: 300, autoCapSavings: true },
    months: ["2026-11", "2026-12", "2027-01", "2027-02", "2027-03", "2027-04"].map(mes),
  };
}
let seq = 0;
const conId = (decisions) => decisions.map((decision, orden) => ({ ...decision, id: `dec_${String(seq++).padStart(26, "0")}`, orden }));

function paridad(base, cambiado, decisions) {
  const prueba = engine.buildRows(cambiado);
  const escenario = scenarioEngine.resolveEscenario(conId(decisions), { baseInput: base, debtContracts: [] });
  assert.equal(escenario.valid, true);
  escenario.resultados.forEach((item) => assert.equal(item.resultado, "aplicada", `${item.tipo}: se aplica en Escenarios`));
  escenario.series.forEach((row, index) => {
    assert.equal(row.totalLiquidity, prueba[index].totalLiquidity, `${row.detailMonthKey || index}: la misma liquidez`);
    assert.equal(row.checking, prueba[index].checking, `${row.detailMonthKey || index}: la misma cuenta corriente`);
  });
  conId(decisions).forEach((decision) => {
    const issues = [];
    schema.validateDecision(decision, "$", issues);
    assert.deepEqual(issues.filter((issue) => issue.severity === "error"), [], `${decision.tipo} pasa el esquema`);
  });
}

test("FX-22 · las tres palancas a la vez cambian los campos de sus tipos de Escenarios, y guardadas dan los mismos meses", () => {
  const base = input();
  const params = { unico: { amount: 2500, date: "2026-12-10" }, ingreso: { delta: -500, from: "2027-01", months: 3 }, gasto: { delta: 200, from: "2027-02", months: 0 } };
  const changed = S.applyYSi(base, params);
  assert.equal(changed.applied, true);
  assert.deepEqual(changed.info, {
    unico: { date: "2026-12-10", amount: 2500 },
    ingreso: { delta: -500, from: "2027-01", to: "2027-03", months: 3 },
    gasto: { delta: 200, from: "2027-02", to: "2027-04", months: 3 },
  });
  assert.equal(changed.input.months[1].coreSpend, 4500, "el gasto único, en su mes");
  assert.deepEqual(changed.input.months.map((month) => month.income), [3000, 3000, 2500, 2500, 2500, 3000]);
  assert.deepEqual(changed.input.months.map((month) => month.coreSpend), [2000, 4500, 2000, 2200, 2200, 2200], "«hasta el final» con 0 meses");
  assert.equal(base.months[1].coreSpend, 2000, "la entrada del plan no se toca");
  const decisions = S.toDecisions({ preset: S.YSI, applied: true, info: changed.info }, base);
  assert.deepEqual(decisions.map((d) => [d.tipo, d.params.mes || d.params.mesInicio, d.params.importe ?? d.params.deltaMensual, d.params.mesFin || null]), [
    ["imprevisto", "2026-12", 2500, null],
    ["cambio_ingreso", "2027-01", -500, "2027-03"],
    ["cambio_gasto", "2027-02", 200, "2027-04"],
  ]);
  decisions.forEach((d) => assert.deepEqual(d.planificacion, { modo: "manual", mesManual: d.params.mesInicio || d.params.mes }));
  paridad(base, changed.input, decisions);
});

test("FX-22 · sin ningún importe, o con un día fuera del plan, no se aplica nada y dice qué falta", () => {
  const base = input();
  const vacio = S.applyYSi(base, { unico: { amount: 0, date: "2026-12-10" }, ingreso: { delta: 0, from: "2027-01" }, gasto: null });
  assert.equal(vacio.applied, false);
  assert.deepEqual(vacio.missing, ["un importe o un pago que aplazar en alguna de las palancas"]); // FX-22 PR-2: cuatro palancas
  assert.equal(S.applyYSi(base, { unico: { amount: 900, date: "2031-01-01" } }).applied, false, "un día que el plan no tiene");
  // evaluate lo acepta con su id; evaluateCombined no lo combina con las de D-N3.
  const deps = { monthly: engine, dailyInput: require("../canonical-daily-input.js"), daily: require("../canonical-daily-engine.js"), dailyOptions: {} };
  const baseRows = S.run(base, deps).rows;
  const result = S.evaluate("ysi", base, baseRows, deps, { today: "2026-11-09", to: "2027-04-30", params: { unico: { amount: 1000, date: "2026-12-10" } } });
  assert.equal(result.applied, true);
  assert.equal(result.preset.id, "ysi");
  const dia = result.rows.find((row) => row.date === "2026-12-10");
  const antes = baseRows.find((row) => row.date === "2026-12-10");
  assert.ok(Math.abs(dia.total - (antes.total - 1000)) < 0.02, "el gasto único cae su día");
  assert.equal(S.evaluateCombined([{ id: "ysi" }, { id: "imprevisto" }], base, baseRows, deps, {}), null);
});
