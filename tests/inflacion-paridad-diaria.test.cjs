// 8/11/2026 · con una inflación anual distinta de 0, el recálculo de la app se cortaba: el motor mensual da importes con fracciones
// de céntimo, la entrada diaria redondeaba cada concepto al céntimo y el desfase se acumulaba mes a mes hasta superar la tolerancia
// de la paridad diaria-mensual (0,02 €), que lanza un error dentro de render(). Plan INVENTADO de 10 años.
const test = require("node:test");
const assert = require("node:assert/strict");

const engine = require("../canonical-engine.js");
const DailyInput = require("../canonical-daily-input.js");
const DailyEngine = require("../canonical-daily-engine.js");

function plan({ inflation = 0, growth = 0, reserve = 0 } = {}) {
  const months = Array.from({ length: 120 }, (_, index) => {
    const year = 2026 + Math.floor((10 + index) / 12);
    const month = ((10 + index) % 12) + 1;
    const key = `${year}-${String(month).padStart(2, "0")}`;
    return {
      monthKey: key, month: key, mainPayrollDate: `${key}-25`,
      income: 4321.37, coreSpend: 2987.41, variableOperationalSpend: 813.29, car: 211.17, refi: 97.53, projectOutflow: index % 7 === 0 ? 123.45 : 0, endOfMonthOutflows: 0,
      incomeEvents: [{ concept: "Nómina INVENTADA", amount: 3100.11, date: `${key}-25` }, { concept: "Otra nómina INVENTADA", amount: 1221.26, date: `${key}-28` }],
      expenseEvents: [
        { field: "fixedCoreSpend", concept: "Hipoteca INVENTADA", amount: 1350.33, date: `${key}-05` },
        { field: "fixedCoreSpend", concept: "Recibos INVENTADOS", amount: 823.79, date: `${key}-12` },
        { field: "variableOperationalSpend", concept: "Súper INVENTADO", amount: 813.29, date: `${key}-20` },
        { field: "car", concept: "Coche INVENTADO", amount: 211.17, date: `${key}-03` },
        { field: "refi", concept: "Préstamo INVENTADO", amount: 97.53, date: `${key}-10` },
      ],
    };
  });
  return {
    openingBalances: { checking: 4876.54, savings: 9123.45 },
    policy: { incomeFactor: 1, annualIncomeGrowth: growth, expenseFactor: 1, annualInflation: inflation, plannedMonthlySaving: 450, autoCapSavings: true, operatingReserve: reserve },
    months,
  };
}

function auditar(input) {
  const rows = engine.buildRows(input);
  const daily = DailyInput.build(input, rows, { operatingReserve: input.policy.operatingReserve });
  return DailyEngine.buildSnapshot(daily, null, { reason: "prueba" });
}

for (const caso of [{ inflation: 0 }, { inflation: 1 }, { inflation: 3.5 }, { inflation: 2.2, growth: 1.7 }, { inflation: 3.5, reserve: 1500 }]) {
  test(`paridad diaria-mensual a 10 años con inflación ${caso.inflation} %${caso.growth ? ` y subida de ingresos ${caso.growth} %` : ""}${caso.reserve ? " y reserva operativa" : ""}`, () => {
    const snap = auditar(plan(caso));
    const fallos = snap.invariants.issues.slice(0, 3).map((issue) => `${issue.type} ${issue.monthKey || issue.date || ""} ${JSON.stringify(issue.deltas || {})}`);
    assert.equal(snap.invariants.valid, true, fallos.join(" | "));
  });
}

test("la corrección solo absorbe céntimos: una fila que no cuadra de verdad sigue sin cuadrar (la auditoría la marca)", () => {
  const input = plan({ inflation: 1 });
  const rows = engine.buildRows(input);
  rows[5] = { ...rows[5], checking: rows[5].checking + 50 };
  const snap = DailyEngine.buildSnapshot(DailyInput.build(input, rows, {}), null, { reason: "prueba" });
  assert.equal(snap.invariants.valid, false);
  assert.ok(snap.invariants.issues.some((issue) => issue.type === "monthly-parity" && issue.monthKey === input.months[5].monthKey));
});
