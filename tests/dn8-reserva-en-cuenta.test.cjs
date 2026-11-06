// D-N8 · el traspaso automático al ahorro deja la reserva operativa en la cuenta corriente.
// Antes el suelo del traspaso era solo un mes de gastos: con los gastos estimados el día 8 y la nómina
// el 15, la cuenta corriente tocaba 0 € cada mes aunque el hogar hubiera fijado una reserva. Cifras
// INVENTADAS: ninguna sale del hogar.
const test = require("node:test");
const assert = require("node:assert/strict");
const { codigoApp } = require("./helpers/codigo-app.cjs");

const engine = require("../canonical-engine.js");
const forecastContract = require("../canonical-forecast.js");
const scenarios = require("../canonical-e13-scenarios.js");

function input(policy = {}, overrides = {}) {
  return {
    openingBalances: { checking: 2000, savings: 1000 },
    policy: { incomeFactor: 1, annualIncomeGrowth: 0, expenseFactor: 1, annualInflation: 0, plannedMonthlySaving: 800, autoCapSavings: true, ...policy },
    months: [
      { month: "ene 27", monthKey: "2027-01", income: 3000, coreSpend: 1800, car: 100, refi: 100 },
      { month: "feb 27", monthKey: "2027-02", income: 3000, coreSpend: 1800, car: 100, refi: 100 },
      { month: "mar 27", monthKey: "2027-03", income: 3000, coreSpend: 1800, car: 100, refi: 100 },
    ],
    ...overrides,
  };
}

test("D-N8 · sin reserva (0 o sin dato) el plan es exactamente el de antes", () => {
  const sinDato = engine.buildRows(input());
  const cero = engine.buildRows(input({ operatingReserve: 0 }));
  const negativa = engine.buildRows(input({ operatingReserve: -500 }));
  assert.deepEqual(cero, sinDato);
  assert.deepEqual(negativa, sinDato, "una reserva negativa no es una reserva");
  // Antes: el traspaso dejaba un mes de gastos (2.000 €) y nada más.
  assert.equal(sinDato[0].saving, 800);
  assert.equal(sinDato[0].checking, 2200);
});

test("D-N8 · con reserva, el traspaso deja en la cuenta un mes de gastos más la reserva; la liquidez total no cambia", () => {
  const antes = engine.buildRows(input());
  const rows = engine.buildRows(input({ operatingReserve: 1000 }));
  // Enero: 2.000 + 3.000 − 2.000 = 3.000 disponibles; hay que dejar 2.000 + 1.000 → se traspasan 0 €.
  assert.equal(rows[0].saving, 0);
  assert.equal(rows[0].checking, 3000);
  // Febrero: 3.000 + 3.000 − 2.000 = 4.000; deja 3.000 → 1.000 posibles, tope 800.
  assert.equal(rows[1].saving, 800);
  rows.forEach((row, index) => {
    assert.ok(row.checking >= row.outflowsBeforeSaving + 1000 - 0.01, `${row.detailMonthKey}: la cuenta cierra con un mes de gastos más la reserva`);
    assert.equal(row.totalLiquidity, antes[index].totalLiquidity, "solo cambia en qué cuenta está el dinero");
  });
  assert.equal(engine.validateRows(rows).valid, true);
  // El primer traspaso baja una vez lo que vale la reserva (800 → 0 y el resto se recupera después).
  const ahorroAntes = antes.reduce((sum, row) => sum + row.saving, 0);
  const ahorroAhora = rows.reduce((sum, row) => sum + row.saving, 0);
  assert.equal(ahorroAntes - ahorroAhora, 800);
  assert.equal(antes.at(-1).checking + 1000 - 200, rows.at(-1).checking, "la cuenta queda con la reserva (menos lo que el tope de 800 ya no deja recuperar)");
});

test("D-N8 · si la reserva no cabe, el plan no traspasa nada y no inventa dinero", () => {
  const rows = engine.buildRows(input({ operatingReserve: 50000 }));
  rows.forEach((row) => assert.equal(row.saving, 0));
  assert.equal(rows[0].checking, 3000);
  assert.equal(rows.at(-1).totalLiquidity, engine.buildRows(input()).at(-1).totalLiquidity);
  // Con el ajuste automático apagado, el hogar decide el traspaso: la reserva no lo toca.
  const manual = engine.buildRows(input({ operatingReserve: 1000, autoCapSavings: false }));
  manual.forEach((row) => assert.equal(row.saving, 800));
});

test("D-N8 · la reserva es un supuesto más del registro central, con su valor", () => {
  const registry = forecastContract.buildAssumptionRegistry(input({ operatingReserve: 1200 }), {}, { generatedAt: "2026-11-06T10:00:00.000Z" });
  const item = registry.items.find((candidate) => candidate.id === "operatingReserve");
  assert.ok(item, "la reserva operativa entra en el registro");
  assert.equal(item.value, 1200);
  assert.equal(item.unit, "EUR");
  assert.match(item.label, /Reserva operativa/);
  const sin = forecastContract.buildAssumptionRegistry(input(), {}, { generatedAt: "2026-11-06T10:00:00.000Z" });
  assert.equal(sin.items.find((candidate) => candidate.id === "operatingReserve").value, 0);
});

test("D-N8 · los escenarios E13 respetan la misma reserva al recalcular el traspaso", () => {
  const build = (policy) => {
    const raw = input(policy);
    const scenario = engine.buildScenario(raw, null, { generatedAt: "2026-11-06T10:00:00.000Z" });
    return forecastContract.buildForecast(raw, scenario, {}, { generatedAt: "2026-11-06T10:00:00.000Z" });
  };
  const forecast = build({ operatingReserve: 1000 });
  const base = scenarios.simulate(forecast, { id: "base", incomeFactor: 1, expenseFactor: 1 }, []);
  assert.deepEqual(base.rows.map((row) => row.saving), forecast.series.map((month) => month.totals.saving), "la base reproduce el plan");
  // Un gasto extra de 500 € en febrero: 3.000 + 3.000 − 2.500 = 3.500 disponibles y hay que dejar 2.500 + 1.000,
  // así que no se traspasa nada y la cuenta cierra con su reserva.
  const shocked = scenarios.simulate(forecast, { id: "base", incomeFactor: 1, expenseFactor: 1 }, [{ id: "x", type: "expense", monthKey: "2027-02", amount: 500, duration: 1 }]);
  const feb = shocked.rows.find((row) => row.monthKey === "2027-02");
  assert.equal(feb.saving, 0);
  assert.ok(feb.closingChecking >= feb.outflows + 1000 - 0.01);
  const sinReserva = scenarios.simulate(build({}), { id: "base", incomeFactor: 1, expenseFactor: 1 }, [{ id: "x", type: "expense", monthKey: "2027-02", amount: 500, duration: 1 }]);
  // Sin reserva, como antes: enero ya traspasó 800 € (cuenta en 2.200), y en febrero 2.200 + 3.000 − 2.500 − 2.500 = 200.
  assert.equal(sinReserva.rows.find((row) => row.monthKey === "2027-02").saving, 200, "sin reserva, como antes");
});

test("D-N8 · app.js pasa la reserva al motor y la aplica igual en sus dos cálculos de referencia", () => {
  const source = codigoApp();
  const body = (name) => {
    const start = source.indexOf(`function ${name}(`);
    assert.ok(start >= 0, `${name} existe`);
    return source.slice(start, source.indexOf("\nfunction ", start + 10));
  };
  const reserva = /Math\.max\(0, Number\(state\?\.operatingReserve\) \|\| 0\)/;
  assert.match(body("canonicalEngineInput"), /operatingReserve: Math\.max\(0, Number\(state\?\.operatingReserve\) \|\| 0\)/);
  assert.match(body("assumptionRegistryInput"), /operatingReserve: Math\.max\(0, Number\(state\?\.operatingReserve\) \|\| 0\)/);
  // La referencia histórica (paridad con el motor) y la proyección de saldos hasta hoy usan el mismo suelo.
  assert.match(body("simulateHistoricalReference"), new RegExp(`oneMonthFloor = outflowsBeforeSaving \\+ ${reserva.source}`));
  assert.match(body("projectedAccountBalancesForStartIndex"), new RegExp(`availableBeforeSaving - outflowsBeforeSaving - ${reserva.source}`));
  // Y la firma de la caché incluye la reserva, para que cambiarla recalcule el plan.
  assert.match(body("modelComputationSignature"), /operatingReserve: round2\(Math\.max\(0, Number\(state\.operatingReserve \|\| 0\)\)\)/);
});
