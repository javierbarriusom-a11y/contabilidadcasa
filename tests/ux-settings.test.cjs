const test = require("node:test");
const { NOMBRE } = require("./helpers/miembros.cjs");
const assert = require("node:assert/strict");
const ux = require("../ux-settings.js");

test("detecta titularidad por campo o concepto sin duplicar partidas", () => {
  assert.equal(ux.inferOwner({ owner: `${NOMBRE.p2}`, label: "Nómina" }), "p2");
  assert.equal(ux.inferOwner({ label: `Nómina ${NOMBRE.p1}` }), "p1");
  assert.equal(ux.inferOwner({ label: "Hipoteca hogar" }), "household");
});

test("hogar suma todo y la vista personal prorratea solo gastos compartidos", () => {
  const month = { key: "2026-08" };
  const sections = {
    income: [{ name: "Ingresos", rows: [{ label: `Nómina ${NOMBRE.p1}`, value: 3000 }, { label: `Nómina ${NOMBRE.p2}`, value: 2000 }] }],
    expense: [{ name: "Gastos fijos", rows: [{ label: "Hipoteca", value: 1000 }, { label: `Seguro ${NOMBRE.p2}`, value: 100 }] }],
  };
  const options = {
    months: [month],
    sectionsForMonth: (kind) => sections[kind],
    valueForRow: (row) => row.value,
  };
  const household = ux.aggregateFamilyContext({ ...options, context: "household" });
  const vistaP1 = ux.aggregateFamilyContext({ ...options, context: "p1" });
  const vistaP2 = ux.aggregateFamilyContext({ ...options, context: "p2" });
  assert.deepEqual([household.income, household.expenses, household.net], [5000, 1100, 3900]);
  assert.deepEqual([vistaP1.income, vistaP1.expenses, vistaP1.net], [3000, 500, 2500]);
  assert.deepEqual([vistaP2.income, vistaP2.expenses, vistaP2.net], [2000, 600, 1400]);
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
