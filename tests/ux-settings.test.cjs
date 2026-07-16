const test = require("node:test");
const assert = require("node:assert/strict");
const ux = require("../ux-settings.js");

test("detecta titularidad por campo o concepto sin duplicar partidas", () => {
  assert.equal(ux.inferOwner({ owner: "Tere", label: "Nómina" }), "tere");
  assert.equal(ux.inferOwner({ label: "Nómina Javi" }), "javi");
  assert.equal(ux.inferOwner({ label: "Hipoteca hogar" }), "household");
});

test("hogar suma todo y la vista personal prorratea solo gastos compartidos", () => {
  const month = { key: "2026-08" };
  const sections = {
    income: [{ name: "Ingresos", rows: [{ label: "Nómina Javi", value: 3000 }, { label: "Nómina Tere", value: 2000 }] }],
    expense: [{ name: "Gastos fijos", rows: [{ label: "Hipoteca", value: 1000 }, { label: "Seguro Tere", value: 100 }] }],
  };
  const options = {
    months: [month],
    sectionsForMonth: (kind) => sections[kind],
    valueForRow: (row) => row.value,
  };
  const household = ux.aggregateFamilyContext({ ...options, context: "household" });
  const javi = ux.aggregateFamilyContext({ ...options, context: "javi" });
  const tere = ux.aggregateFamilyContext({ ...options, context: "tere" });
  assert.deepEqual([household.income, household.expenses, household.net], [5000, 1100, 3900]);
  assert.deepEqual([javi.income, javi.expenses, javi.net], [3000, 500, 2500]);
  assert.deepEqual([tere.income, tere.expenses, tere.net], [2000, 600, 1400]);
});

test("evalúa alertas por encima, por debajo y pausadas", () => {
  const below = ux.evaluateAlert({ metric: "caixaBalance", operator: "below", threshold: 2500, action: "Reducir traspasos." }, { caixaBalance: 2000 });
  const above = ux.evaluateAlert({ metric: "debtRatio", operator: "above", threshold: 32 }, { debtRatio: 35 });
  const paused = ux.evaluateAlert({ metric: "freeCapacity", operator: "below", threshold: 0, paused: true }, { freeCapacity: -100 });
  assert.equal(below.triggered, true);
  assert.equal(below.action, "Reducir traspasos.");
  assert.equal(above.triggered, true);
  assert.equal(paused.status, "paused");
  assert.equal(paused.triggered, false);
});
