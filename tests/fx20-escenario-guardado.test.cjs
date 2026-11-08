// FX-20 · un escenario guardado en «Comparar con» de la Previsión (8/11/2026): Escenarios lo resuelve por meses y aquí se recalcula
// por días con los motores de siempre. Los cierres de mes son los de Escenarios; el día es aproximado. Cifras INVENTADAS.
const test = require("node:test");
const assert = require("node:assert/strict");

const S = require("../canonical-stress-scenarios.js");
const engine = require("../canonical-engine.js");
const dailyInput = require("../canonical-daily-input.js");
const daily = require("../canonical-daily-engine.js");
const scenarioEngine = require("../canonical-scenario-engine.js");

const hoy = "2026-11-07";
const deps = { monthly: engine, dailyInput, daily, dailyOptions: { operatingReserve: 800 } };
function mes(monthKey) {
  return {
    month: monthKey, monthKey, income: 3000, coreSpend: 2000, variableOperationalSpend: 600, car: 0, refi: 0, projectOutflow: 0, endOfMonthOutflows: 0,
    incomeEvents: [{ concept: "Nómina INVENTADA", amount: 2100, day: 25, date: `${monthKey}-25` }, { concept: "Otro sueldo INVENTADO", amount: 900, day: 28, date: `${monthKey}-28` }],
    expenseEvents: [{ concept: "Alquiler INVENTADO", amount: 900, field: "fixedCoreSpend", day: 3, date: `${monthKey}-03` }],
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
const conId = (decisions) => decisions.map((decision, orden) => ({ id: `dec_${String(seq++).padStart(26, "0")}`, orden, activa: true, planificacion: { modo: "manual", mesManual: decision.params.mes || decision.params.mesInicio }, ...decision }));
const ultimo = (rows, hasta) => rows.filter((row) => row.date <= hasta).at(-1);
const finDeMes = (monthKey) => { const [y, m] = monthKey.split("-").map(Number); return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); };

function prepara(decisions) {
  const base = input();
  const baseRows = S.run(base, deps).rows;
  const resolved = scenarioEngine.resolveEscenario(conId(decisions), { baseInput: base, debtContracts: [] });
  const opts = { today: hoy, to: "2027-04-30", floor: 1500, checkingFloor: 800, label: "Obra y menos sueldo INVENTADOS", short: "Obra" };
  return { base, baseRows, resolved, result: S.evaluateResolved(resolved, base, baseRows, deps, opts) };
}

test("FX-20 · el escenario guardado da, al cierre de cada mes, la liquidez de Escenarios", () => {
  const { resolved, result } = prepara([
    { tipo: "imprevisto", titulo: "Obra INVENTADA", params: { importe: 1500, mes: "2027-01" } },
    { tipo: "cambio_ingreso", titulo: "Menos sueldo INVENTADO", params: { titular: "hogar", deltaMensual: -900, mesInicio: "2026-12", mesFin: "2027-02" } },
  ]);
  assert.equal(result.applied, true);
  assert.equal(result.saved, true);
  assert.equal(result.valid, true, "el diario supera sus invariantes");
  assert.deepEqual(result.info, { aplicadas: 2, rechazadas: 0 });
  assert.equal(result.preset.id, "guardado");
  assert.equal(result.preset.short, "Obra");
  resolved.series.forEach((row) => {
    const key = row.detailMonthKey || row.monthKey;
    const dia = ultimo(result.rows, finDeMes(key));
    assert.ok(Math.abs(Number(dia.total) - Number(row.totalLiquidity)) < 0.02, `${key}: ${dia.total} frente a ${row.totalLiquidity} de Escenarios`);
  });
  // Frente al plan: abril queda 1.500 € + 3 × 900 € más abajo.
  assert.ok(Math.abs(result.comparison.end.diff - -4200) < 0.02, `al final, ${result.comparison.end.diff}`);
  assert.ok(result.comparison.low.value < result.comparison.baseLow.value);
});

test("FX-20 · sin cambios, el escenario guardado es el plan día a día", () => {
  const base = input();
  const baseRows = S.run(base, deps).rows;
  const resolved = scenarioEngine.resolveEscenario(conId([{ tipo: "cambio_gasto", titulo: "Nada INVENTADO", params: { bloque: "Ocio", deltaMensual: 0, mesInicio: "2026-12", mesFin: "2026-12" } }]), { baseInput: base, debtContracts: [] });
  const result = S.evaluateResolved(resolved, base, baseRows, deps, { today: hoy, to: "2027-04-30" });
  assert.equal(result.applied, true);
  assert.equal(result.rows.length, baseRows.length);
  result.rows.forEach((row, index) => assert.ok(Math.abs(row.total - baseRows[index].total) < 0.005, row.date));
});

test("FX-20 · sin ninguna decisión aplicada, o sin resolver, no hay nada que comparar; las rechazadas se cuentan", () => {
  const rechazada = { tipo: "amortizacion", titulo: "Deuda que no existe INVENTADA", params: { deudaId: "no-existe", importe: 1000 } };
  const sola = prepara([rechazada]).result;
  assert.equal(sola.applied, false);
  assert.equal(sola.reason, "ninguna-aplicada");
  const mixta = prepara([rechazada, { tipo: "imprevisto", titulo: "Obra INVENTADA", params: { importe: 500, mes: "2027-01" } }]).result;
  assert.equal(mixta.applied, true);
  assert.deepEqual(mixta.info, { aplicadas: 1, rechazadas: 1 });
  const base = input();
  const baseRows = S.run(base, deps).rows;
  assert.equal(S.evaluateResolved({ valid: false, reason: "dependency-cycle" }, base, baseRows, deps, {}).reason, "dependency-cycle");
  assert.equal(S.evaluateResolved(null, base, baseRows, deps, {}).applied, false);
  assert.equal(S.evaluateResolved({ valid: true, months: [] }, base, baseRows, deps, {}).applied, false, "otros meses que el plan");
  assert.equal(S.evaluateResolved({ valid: true, months: base.months }, null, baseRows, deps, {}), null);
});

test("FX-20 · lo que el escenario paga de golpe cae el día más bajo de su mes, no tras la nómina", () => {
  const { baseRows, result } = prepara([{ tipo: "imprevisto", titulo: "Obra INVENTADA", params: { importe: 1500, mes: "2027-01" } }]);
  const enero = baseRows.filter((row) => row.date >= "2027-01-01" && row.date <= "2027-01-31");
  const peor = enero.reduce((low, row) => (row.total < low.total ? row : low));
  const mismoDia = result.rows.find((row) => row.date === peor.date);
  assert.ok(Math.abs(mismoDia.total - (peor.total - 1500)) < 0.02, `el ${peor.date} baja 1.500 €: ${mismoDia.total} frente a ${peor.total}`);
  const evento = (mismoDia.events || []).find((event) => event.label === "Pago del escenario");
  assert.ok(evento, "con su nombre");
  assert.equal(Math.round(evento.amount), 1500);
  // Un día antes, igual que el plan.
  const antes = result.rows.filter((row) => row.date < peor.date).at(-1);
  const antesPlan = baseRows.filter((row) => row.date < peor.date).at(-1);
  assert.ok(Math.abs(antes.total - antesPlan.total) < 0.005);
});

test("FX-20 · la entrada diaria sin projectOutflowSplit no cambia; con él, parte el pago de golpe sin cambiar el total del mes", () => {
  const base = input();
  base.months[1].projectOutflow = 1000;
  const rows = engine.buildScenario(base, null, { reason: "test" }).rows;
  const sin = dailyInput.build(base, rows, { operatingReserve: 800 });
  const conVacio = dailyInput.build(base, rows, { operatingReserve: 800, projectOutflowSplit: {} });
  assert.deepEqual(conVacio, sin);
  const con = dailyInput.build(base, rows, { operatingReserve: 800, projectOutflowSplit: { "2026-12": { amount: 400, date: "2026-12-05", label: "Pago del escenario" } } });
  const pagos = (built) => built.events.filter((event) => event.field === "projectOutflow" && event.date.startsWith("2026-12"));
  assert.deepEqual(pagos(sin).map((event) => event.amount), [1000]);
  assert.deepEqual(pagos(con).map((event) => [event.date, event.amount]), [["2026-12-05", 400], [pagos(sin)[0].date, 600]]);
  // Nunca más de lo que hay, ni sobre un mes sin pago.
  const tope = dailyInput.build(base, rows, { projectOutflowSplit: { "2026-12": { amount: 5000, date: "2026-12-05" }, "2027-01": { amount: 300, date: "2027-01-05" } } });
  assert.deepEqual(pagos(tope).map((event) => event.amount), [1000]);
  assert.equal(tope.events.filter((event) => event.field === "projectOutflow" && event.date.startsWith("2027-01")).length, 0);
});
