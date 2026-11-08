// FX-20 · dos pruebas a la vez (7/11/2026): las dos sobre la misma entrada del plan y un solo recálculo, con motores falsos como en
// tests/fx21-pruebas-estres.test.cjs. Cifras INVENTADAS.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Stress = require("../canonical-stress-scenarios.js");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");

const TODAY = "2026-11-06";
const month = (monthKey, { nomina = 3000, extra = 0, nominaDay = "25", core = 2500, variable = 1000 } = {}) => ({
  monthKey,
  month: monthKey,
  income: nomina + extra,
  prePayrollIncome: nomina + extra,
  coreSpend: core,
  variableOperationalSpend: variable,
  incomeEvents: [
    { concept: "Nómina A", amount: nomina, date: `${monthKey}-${nominaDay}` },
    ...(extra ? [{ concept: "Nómina B", amount: extra, date: `${monthKey}-28` }] : []),
  ],
  expenseEvents: [{ concept: "Hipoteca", amount: core - variable, date: `${monthKey}-05`, field: "fixedCoreSpend" }],
});
const input = () => ({
  openingBalances: { cash: 4000 },
  months: ["2026-11", "2026-12", "2027-01", "2027-02", "2027-03"].map((key) => month(key, { extra: 1200 })),
});

/** Motores falsos: un saldo que suma cobros y resta pagos el día de cada evento y el gasto variable el día 20. */
function fakeDeps(calls = []) {
  return {
    monthly: { buildScenario: (inp, _x, opts) => (calls.push(opts.reason), { rows: inp.months.map((m) => ({ monthKey: m.monthKey })) }) },
    dailyInput: { build: (inp) => inp },
    daily: {
      buildSnapshot: (inp) => {
        const moves = [];
        inp.months.forEach((m) => {
          (m.incomeEvents || []).forEach((e) => moves.push([e.date, Number(e.amount)]));
          (m.expenseEvents || []).forEach((e) => moves.push([e.date, -Number(e.amount)]));
          moves.push([`${m.monthKey}-20`, -Number(m.variableOperationalSpend || 0)]);
        });
        moves.sort((a, b) => a[0].localeCompare(b[0]));
        let total = Number(inp.openingBalances.cash);
        const rows = [{ date: TODAY, monthKey: "2026-11", total }];
        moves.forEach(([date, amount]) => {
          total += amount;
          const last = rows[rows.length - 1];
          if (last.date === date) last.total = total;
          else rows.push({ date, monthKey: date.slice(0, 7), total });
        });
        rows.push({ date: "2026-12-31", monthKey: "2026-12", total: rows.filter((r) => r.date <= "2026-12-31").pop().total });
        rows.sort((a, b) => a.date.localeCompare(b.date));
        return { rows, invariants: { valid: true } };
      },
    },
  };
}


const opts = { today: TODAY, to: "2027-03-31", floor: 1000 };
const shock = { date: "2027-01-15", from: 640, to: 790, extra: 150, rate: 5.34, months: 240 };

test("FX-20 · un sueldo menos y el Euribor juntos: las dos sobre la misma entrada, un solo recálculo", () => {
  const base = input();
  const baseRows = fakeDeps().daily.buildSnapshot(base).rows;
  const calls = [];
  const r = Stress.evaluateCombined([{ id: "sueldo-menos", params: { months: 3 } }, { id: "euribor", params: { shocks: [shock] } }], base, baseRows, fakeDeps(calls), opts);
  assert.equal(r.applied, true);
  assert.equal(r.combined, true);
  assert.equal(r.preset.id, "combinada");
  assert.equal(r.preset.short, "Un sueldo menos + Euribor");
  assert.deepEqual(r.parts.map((part) => part.preset.id), ["sueldo-menos", "euribor"]);
  assert.deepEqual(calls, ["prueba de estrés: combinada"], "un solo recálculo");
  // Es exactamente aplicar una y luego la otra.
  const a = Stress.applySueldoMenos(base, { today: TODAY, months: 3 });
  const b = Stress.applyEuribor(a.input, { shocks: [shock] });
  assert.deepEqual(r.rows, fakeDeps().daily.buildSnapshot(b.input).rows);
  // Juntas bajan más que cada una por separado.
  const sola = (id, params) => Stress.evaluate(id, base, baseRows, fakeDeps(), { ...opts, params });
  const sueldo = sola("sueldo-menos", { months: 3 });
  const euribor = sola("euribor", { shocks: [shock] });
  assert.ok(r.comparison.low.value < sueldo.comparison.low.value && r.comparison.low.value < euribor.comparison.low.value);
  // No toca la entrada del plan.
  assert.deepEqual(base, input());
});

test("FX-20 · el imprevisto va el último y cae el peor día de la trayectoria que ya lleva la otra prueba", () => {
  const base = input();
  const baseRows = fakeDeps().daily.buildSnapshot(base).rows;
  const sueldo = Stress.evaluate("sueldo-menos", base, baseRows, fakeDeps(), { ...opts, params: { months: 3 } });
  const calls = [];
  const r = Stress.evaluateCombined([{ id: "imprevisto", params: { amount: 1000 } }, { id: "sueldo-menos", params: { months: 3 } }], base, baseRows, fakeDeps(calls), opts);
  assert.deepEqual(r.parts.map((part) => part.preset.id), ["sueldo-menos", "imprevisto"], "el imprevisto, siempre el último");
  assert.equal(r.parts[1].info.date, sueldo.comparison.low.date, "el peor día de la combinación, no el del plan");
  assert.equal(r.parts[1].info.amount, 1000);
  assert.equal(calls.length, 2, "un recálculo para buscar el peor día y otro para la combinación");
  // El orden en que se eligen no cambia el resultado.
  const otra = Stress.evaluateCombined([{ id: "sueldo-menos", params: { months: 3 } }, { id: "imprevisto", params: { amount: 1000 } }], base, baseRows, fakeDeps(), opts);
  assert.deepEqual(otra.rows, r.rows);
});

test("FX-20 · si una de las dos no se puede aplicar no hay combinación, y se dice cuál; dos iguales no son dos pruebas", () => {
  const base = input();
  const baseRows = fakeDeps().daily.buildSnapshot(base).rows;
  const sinRevision = Stress.evaluateCombined([{ id: "sueldo-menos" }, { id: "euribor", params: { shocks: [], missing: ["la revisión del tipo"] } }], base, baseRows, fakeDeps(), opts);
  assert.equal(sinRevision.applied, false);
  assert.equal(sinRevision.failed.id, "euribor");
  assert.deepEqual(sinRevision.missing, ["la revisión del tipo"]);
  assert.equal(Stress.evaluateCombined([{ id: "euribor" }, { id: "euribor" }], base, baseRows, fakeDeps(), opts), null);
  assert.equal(Stress.evaluateCombined([{ id: "sueldo-menos" }], base, baseRows, fakeDeps(), opts), null);
  assert.equal(Stress.evaluateCombined([{ id: "sueldo-menos" }, { id: "no-existe" }], base, baseRows, fakeDeps(), opts), null);
});

test("FX-20 · «Guardar como escenario» de la combinación lleva las decisiones de las dos", () => {
  const base = input();
  const baseRows = fakeDeps().daily.buildSnapshot(base).rows;
  const r = Stress.evaluateCombined([{ id: "sueldo-menos", params: { months: 3 } }, { id: "imprevisto", params: { amount: 3000 } }], base, baseRows, fakeDeps(), opts);
  const decisions = Stress.toDecisions(r, base);
  assert.deepEqual(decisions.map((decision) => decision.tipo), ["cambio_ingreso", "imprevisto"]);
  assert.equal(decisions[1].params.mes, r.parts[1].info.date.slice(0, 7));
});

test("FX-20 · cableado: la Previsión nueva suma una segunda prueba y la calcula con evaluateCombined", () => {
  const vista = read("views/prevision-v2.js");
  assert.match(vista, /let previsionV2Segunda = ""/);
  assert.match(vista, /S\.evaluateCombined\(/);
  assert.match(vista, /data-prevision-v2-segunda/);
  assert.match(vista, /Sumar otra prueba/);
});
