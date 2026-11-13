// FX-03 (el cambio de Hoy de la semana del 16/11/2026) · una sola forma de la trayectoria: el motor diario reparte el gasto variable
// por los días del mes, como la banda de caja, en vez de cargarlo entero el día 8. El total de cada mes no cambia (la invariante
// `monthly-parity` del motor diario); cambia la forma dentro del mes. Cifras INVENTADAS.
const test = require("node:test");
const assert = require("node:assert/strict");

const engine = require("../canonical-engine.js");
const dailyInput = require("../canonical-daily-input.js");
const daily = require("../canonical-daily-engine.js");

function mes(monthKey) {
  return {
    month: monthKey, monthKey, income: 3000, coreSpend: 2750, variableOperationalSpend: 1750, car: 0, refi: 0, projectOutflow: 0, endOfMonthOutflows: 0,
    mainPayrollDate: `${monthKey}-25`,
    incomeEvents: [{ concept: "Nómina INVENTADA", amount: 3000, date: `${monthKey}-25` }],
    expenseEvents: [
      { concept: "Alquiler INVENTADO", amount: 1000, field: "fixedCoreSpend", date: `${monthKey}-03`, confidence: "rule" },
      { concept: "Gasto variable estimado", amount: 1750, field: "variableOperationalSpend", date: `${monthKey}-08`, confidence: "estimated" },
    ],
  };
}
function input() {
  return {
    openingBalances: { checking: 4000, savings: 6000 },
    policy: { incomeFactor: 1, annualIncomeGrowth: 0, expenseFactor: 1, annualInflation: 0, plannedMonthlySaving: 0, autoCapSavings: true },
    months: ["2026-12", "2027-01", "2027-02"].map(mes),
  };
}
const variables = (built, monthKey) => built.events.filter((event) => event.field === "variableOperationalSpend" && event.date.startsWith(monthKey));

test("FX-03 · el gasto variable, un trozo cada día del mes en euros enteros, con el mismo total", () => {
  const base = input();
  const rows = engine.buildScenario(base, null, { reason: "test" }).rows;
  const built = dailyInput.build(base, rows, {});
  const dic = variables(built, "2026-12");
  assert.equal(dic.length, 31, "un trozo por día de diciembre");
  assert.equal(dic.reduce((sum, event) => sum + event.amount, 0), 1750, "el mismo total del mes");
  // 1.750 / 31 = 56 y sobran 14: los 14 primeros días, 57 €; el resto, 56 €. Sin céntimos.
  assert.deepEqual([...new Set(dic.map((event) => event.amount))].sort(), [56, 57]);
  assert.equal(dic.filter((event) => event.amount === 57).length, 14);
  assert.ok(dic.every((event) => Number.isInteger(event.amount)));
  assert.equal(dic[0].label, "Gasto variable estimado", "con el nombre de la partida");
  assert.equal(variables(built, "2027-02").length, 28, "febrero, 28 días");
  // Lo demás no se mueve: el alquiler sigue el día 3.
  assert.deepEqual(built.events.filter((event) => event.field === "fixedCoreSpend").map((event) => event.date), ["2026-12-03", "2027-01-03", "2027-02-03"]);
});

test("FX-03 · el motor diario sigue cuadrando con el mensual cada mes y ya no hay un mínimo artificial el día 8", () => {
  const base = input();
  const rows = engine.buildScenario(base, null, { reason: "test" }).rows;
  const nuevo = daily.buildSnapshot(dailyInput.build(base, rows, {}), null, { reason: "test" });
  const antes = daily.buildSnapshot(dailyInput.build(base, rows, { spreadVariable: false }), null, { reason: "test" });
  assert.equal(nuevo.invariants.valid, true, JSON.stringify(nuevo.invariants.issues));
  assert.equal(nuevo.invariants.checks.monthlyParity, true);
  // El cierre de cada mes, igual en las dos formas.
  ["2026-12-31", "2027-01-31", "2027-02-28"].forEach((date) => {
    const a = antes.rows.find((row) => row.date === date).total;
    const n = nuevo.rows.find((row) => row.date === date).total;
    assert.ok(Math.abs(a - n) < 0.005, `${date}: ${a} frente a ${n}`);
  });
  // Antes, el 8 caía de golpe 1.750 €; ahora, solo lo de ese día.
  const dia = (snap, date) => snap.rows.find((row) => row.date === date);
  assert.ok(dia(antes, "2026-12-07").total - dia(antes, "2026-12-08").total >= 1750);
  assert.ok(dia(nuevo, "2026-12-07").total - dia(nuevo, "2026-12-08").total <= 57);
  // El punto más bajo de diciembre es la víspera de la nómina (el 24), no el día 8.
  const diciembre = nuevo.rows.filter((row) => row.date.startsWith("2026-12"));
  assert.equal(diciembre.reduce((low, row) => (row.total < low.total ? row : low)).date, "2026-12-24");
});

test("FX-03 · con spreadVariable: false, la forma de antes (todo el día estimado)", () => {
  const base = input();
  const rows = engine.buildScenario(base, null, { reason: "test" }).rows;
  const built = dailyInput.build(base, rows, { spreadVariable: false });
  assert.deepEqual(variables(built, "2026-12").map((event) => [event.date, event.amount]), [["2026-12-08", 1750]]);
});
