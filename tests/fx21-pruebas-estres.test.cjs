const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Stress = require("../canonical-stress-scenarios.js");

// FX-20 / FX-21 y D-N3 (BACKLOG_NOVIEMBRE_OLEADA_1.md §5.1; porqué en docs/PROPUESTA_OCTAVA_AUDITORIA_2026-11-05.md §7): las pruebas de
// estrés del hogar. El motor no pide datos nuevos ni ejecuta nada: cambia la entrada del plan, recalcula con los motores de siempre
// (aquí falsos, para probarlo en Node) y compara con el plan. La pantalla («Comparar con…» en Plan › Previsión) solo lo pinta.

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");

const TODAY = "2026-11-06";
const round = (value) => Math.round(value * 100) / 100;
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

test("FX-21 · las tres pruebas de D-N3 (decidida el 6/11): un sueldo menos, el Euribor y un imprevisto; gasto +10 % queda en la biblioteca", () => {
  assert.equal(Stress.SCHEMA_ID, "finance-canonical-stress-scenarios/v2");
  assert.deepEqual(Stress.PRESETS.map((p) => p.id), ["sueldo-menos", "euribor", "imprevisto"]);
  assert.ok(Object.isFrozen(Stress.PRESETS) && Stress.PRESETS.every(Object.isFrozen));
  Stress.PRESETS.forEach((p) => assert.ok(p.label && p.short && p.short.length <= 20, `${p.id}: etiqueta corta para la píldora`));
  assert.deepEqual([...Stress.SUELDO_MESES], [3, 6]);
  assert.deepEqual([...Stress.EURIBOR_PUNTOS], [1, 2]);
  assert.equal(typeof Stress.applyGastoMas, "function");
});

test("FX-21 · titulares: los ingresos que llegan casi todos los meses, del mayor al menor; un cobro suelto no es un sueldo", () => {
  const base = input();
  base.months[1].incomeEvents.push({ concept: "Venta suelta", amount: 9000, date: "2026-12-10" });
  assert.deepEqual(Stress.titulares(base, TODAY), [{ concept: "Nómina A", average: 3000 }, { concept: "Nómina B", average: 1200 }]);
  assert.deepEqual(Stress.titulares({ months: [] }, TODAY), []);
});

test("FX-21 · el sueldo que falta empieza en el primer mes sin cobrar, de ese titular", () => {
  const months = input().months;
  assert.equal(Stress.firstUnpaidMonthIndex(months, TODAY), 0, "la nómina del 25 de noviembre aún no ha llegado");
  assert.equal(Stress.firstUnpaidMonthIndex(months, "2026-11-29"), 1, "cobradas las dos de noviembre, empieza en diciembre");
  assert.equal(Stress.firstUnpaidMonthIndex(months, "2026-11-26", "Nómina A"), 1, "la A ya llegó el 25");
  assert.equal(Stress.firstUnpaidMonthIndex(months, "2026-11-26", "Nómina B"), 0, "la B llega el 28");
});

test("FX-21 · un sueldo menos por titular: quita ese cobro 3 o 6 meses y deja el resto, sin tocar la entrada", () => {
  const base = input();
  const before = JSON.stringify(base);
  const out = Stress.applySueldoMenos(base, { today: TODAY });
  assert.equal(JSON.stringify(base), before, "no muta el plan");
  assert.equal(out.applied, true);
  assert.deepEqual(out.info, { concept: "Nómina A", months: 3, from: "2026-11", to: "2027-01" }, "sin titular, el mayor");
  out.input.months.slice(0, 3).forEach((m) => {
    assert.equal(m.income, 1200);
    assert.equal(m.prePayrollIncome, 1200);
    assert.deepEqual(m.incomeEvents.map((e) => e.concept), ["Nómina B"]);
  });
  assert.equal(out.input.months[3].income, 4200, "el cuarto mes vuelve a cobrar");
  const b6 = Stress.applySueldoMenos(base, { today: TODAY, months: 6, concept: "Nómina B" });
  assert.deepEqual(b6.info, { concept: "Nómina B", months: 6, from: "2026-11", to: "2027-03" }, "solo hay 5 meses en la entrada");
  b6.input.months.forEach((m) => assert.deepEqual(m.incomeEvents.map((e) => e.concept), ["Nómina A"]));
  assert.equal(Stress.applySueldoMenos(base, { today: TODAY, concept: "No existe" }).applied, false);
  assert.equal(Stress.applySueldoMenos({ months: [] }, { today: TODAY }).applied, false);
});

test("FX-21 · Euribor: la cuota con +1 o +2 puntos desde la revisión, frente a la que lleva el plan, hasta el último plazo", () => {
  const Review = require("../canonical-rate-review.js");
  const review = Review.evaluate({
    today: TODAY,
    contract: { principal: 120000, remainingMonths: 240, payment: 640 },
    settings: { spread: 0.99, nextReview: "2027-01-15", periodMonths: 12, rule: "monthlyAverage", ruleLag: 1, currentRate: 3.1 },
    index: { value: 2.35, date: "2026-11-02", state: "fresh", ageDays: 4 },
  });
  assert.equal(review.status, "ok");
  const [uno] = Stress.euriborShocks([review], 1, Review.payment);
  const [dos] = Stress.euriborShocks([review], 2, Review.payment);
  assert.equal(uno.date, "2027-01-15");
  assert.equal(uno.rate, 4.34, "Euribor 2,35 + diferencial 0,99 + 1 punto");
  assert.equal(uno.from, 640);
  assert.ok(uno.extra > 0 && dos.extra > uno.extra, "dos puntos cuestan más que uno");
  assert.equal(uno.extra, Math.round((uno.to - 640) * 100) / 100);
  assert.deepEqual(Stress.euriborShocks([{ status: "incomplete" }], 1, Review.payment), [], "sin datos no hay prueba");
  const out = Stress.applyEuribor(input(), { shocks: [{ ...uno, date: "2027-01-31" }] });
  assert.deepEqual(out.input.months.map((m) => m.coreSpend), [2500, 2500, round(2500 + uno.extra), round(2500 + uno.extra), round(2500 + uno.extra)]);
  const feb = out.input.months[3].expenseEvents.at(-1);
  assert.deepEqual([feb.date, feb.day, feb.field], ["2027-02-28", 28, "fixedCoreSpend"], "el 31 cae el último día de febrero");
  const corto = Stress.applyEuribor(input(), { shocks: [{ ...uno, months: 1 }] });
  assert.equal(corto.input.months.filter((m) => m.coreSpend > 2500).length, 1, "no pasa del último plazo");
  const baja = Stress.applyEuribor(input(), { shocks: [{ ...uno, extra: -20 }] });
  assert.ok(baja.input.months.every((m) => m.coreSpend === 2500), "si la cuota no sube, no se añade nada");
});

test("FX-21 · un imprevisto: un pago fijo ese día y en su mes; sin mes, no se aplica", () => {
  const out = Stress.applyImprevisto(input(), { date: "2026-12-08", amount: 3000 });
  const dic = out.input.months[1];
  assert.equal(dic.coreSpend, 5500);
  const ev = dic.expenseEvents.at(-1);
  assert.deepEqual([ev.amount, ev.date, ev.day, ev.field], [3000, "2026-12-08", 8, "fixedCoreSpend"]);
  assert.equal(Stress.applyImprevisto(input(), { date: "2030-01-01" }).applied, false);
  assert.equal(Stress.applyImprevisto(input(), {}).applied, false);
});

test("FX-21 · biblioteca: gasto variable un 10 % más alto en todos los meses, y el gasto total sube lo mismo", () => {
  const out = Stress.applyGastoMas(input(), { factor: 1.1 });
  out.input.months.forEach((m) => {
    assert.equal(m.variableOperationalSpend, 1100);
    assert.equal(m.coreSpend, 2600);
  });
});

test("FX-20 · la comparación: punto más bajo de los dos, cruce del suelo del plan y de la prueba, lo que falta y el 31/12", () => {
  const r = (date, total) => ({ date, total });
  const base = [r("2026-11-06", 5000), r("2026-12-08", 3000), r("2026-12-31", 6000), r("2027-01-10", 4000)];
  const shock = [r("2026-11-06", 5000), r("2026-12-08", 1000), r("2026-12-31", 2000), r("2027-01-10", 500)];
  const c = Stress.compare(base, shock, { today: TODAY, to: "2027-12-31", floor: 1500 });
  assert.deepEqual(c.baseLow, { date: "2026-12-08", value: 3000 });
  assert.deepEqual(c.low, { date: "2027-01-10", value: 500 });
  assert.equal(c.lowDiff, -2500);
  assert.equal(c.baseCrossesFloor, false);
  assert.equal(c.crossesFloor, true);
  assert.equal(c.crossDate, "2026-12-08", "el primer día por debajo, no el más bajo");
  assert.equal(c.shortfall, 1000);
  assert.equal(c.monthlyCut, 333.33, "repartido de noviembre a enero: 3 meses");
  assert.deepEqual(c.yearEnd, { date: "2026-12-31", base: 6000, shocked: 2000 });
  assert.deepEqual(c.end, { date: "2027-01-10", base: 4000, shocked: 500, diff: -3500 }, "el último día del horizonte");
  assert.equal(c.yearEndDiff, -4000);
  const both = Stress.compare(shock, shock, { today: TODAY, to: "2027-12-31", floor: 1500 });
  assert.equal(both.baseCrossesFloor, true, "si el plan ya baja del suelo, la tabla no puede decir «No»");
  assert.equal(Stress.compare([], shock, { today: TODAY, to: "2027-12-31" }), null);
});

test("Suelo en la cuenta corriente (6/11): cuándo baja de su reserva o queda en descubierto, cuánto pasar y si basta con traspasar menos", () => {
  const r = (date, checking, savings, events = []) => ({ date, checking, savings, total: checking + savings, events });
  const traspaso = { kind: "transfer", label: "Traspaso a Mediolanum", beforeChecking: 4730 + 620, checking: 4730 };
  const rows = [r("2026-11-06", 5080, 5000), r("2026-11-30", 4730, 5620, [traspaso]), r("2026-12-08", 0, 5620), r("2026-12-15", 4800, 5620)];
  const opts = { today: TODAY, to: "2027-02-05" };
  const cero = Stress.checkingShortfall(rows, opts);
  assert.deepEqual([cero.floor, cero.crossDate, cero.gap, cero.low.value], [0, null, 0, 0], "tocar 0 € no es quedar en descubierto");
  const quinientos = Stress.checkingShortfall(rows, { ...opts, checkingFloor: 500 });
  assert.deepEqual([quinientos.crossDate, quinientos.gap, quinientos.coveredBySavings], ["2026-12-08", 500, true]);
  assert.deepEqual(quinientos.sweep, { date: "2026-11-30", label: "Traspaso a Mediolanum", amount: 620 }, "bastaría con traspasar menos el 30 nov");
  const mil = Stress.checkingShortfall(rows, { ...opts, checkingFloor: 1000 });
  assert.equal(mil.sweep, null, "620 € no bastan para 1.000 €: hay que pasar del ahorro");
  const seco = Stress.checkingShortfall([r("2026-11-06", 100, 50), r("2026-11-20", -400, 50)], opts);
  assert.deepEqual([seco.crossDate, seco.gap, seco.coveredBySavings], ["2026-11-20", 400, false], "el ahorro no alcanza");
  assert.equal(Stress.checkingShortfall([{ date: TODAY, total: 10 }], opts), null, "sin cuenta corriente separada no se inventa");
  const c = Stress.compare(rows, [r("2026-11-06", 5080, 5000), r("2026-12-08", -2510, 5000)], { ...opts, floor: 1500 });
  assert.equal(c.checking.base.crossDate, null);
  assert.deepEqual([c.checking.shocked.crossDate, c.checking.shocked.gap], ["2026-12-08", 2510]);
});

test("FX-21 · evaluate: aplica, recalcula con los motores de siempre y compara; el imprevisto cae el día más bajo del plan", () => {
  const deps = fakeDeps();
  const baseInput = input();
  const baseRows = Stress.run(baseInput, deps).rows;
  const opts = { today: TODAY, to: "2027-03-31", floor: 1500 };
  const calls = [];
  const res = Stress.evaluate("imprevisto", baseInput, baseRows, fakeDeps(calls), opts);
  assert.equal(res.applied, true);
  assert.equal(res.valid, true);
  assert.deepEqual(calls, ["prueba de estrés: imprevisto"]);
  assert.deepEqual(res.info, { date: res.comparison.baseLow.date, amount: 3000 });
  assert.equal(res.comparison.lowDiff, -3000);
  // FX-21 (7/11): el importe del imprevisto se elige entre los de IMPREVISTO_IMPORTES; sin elegir, el de D-N3.
  assert.deepEqual([...Stress.IMPREVISTO_IMPORTES], [1000, 3000, 6000]);
  const seis = Stress.evaluate("imprevisto", baseInput, baseRows, deps, { ...opts, params: { amount: 6000 } });
  assert.equal(seis.info.amount, 6000);
  assert.equal(seis.comparison.lowDiff, -6000);
  const sueldo = Stress.evaluate("sueldo-menos", baseInput, baseRows, deps, opts);
  assert.ok(sueldo.comparison.lowDiff < 0 && sueldo.comparison.yearEndDiff === -6000, "dos nóminas de 3.000 antes del 31/12");
  const b6 = Stress.evaluate("sueldo-menos", baseInput, baseRows, deps, { ...opts, params: { concept: "Nómina B", months: 6 } });
  assert.equal(b6.info.concept, "Nómina B");
  assert.equal(b6.comparison.end.diff, -6000, "cinco nóminas de 1.200 hasta el 31 de marzo");
  const sinDatos = Stress.evaluate("euribor", baseInput, baseRows, deps, { ...opts, params: { missing: ["el diferencial"] } });
  assert.deepEqual([sinDatos.applied, sinDatos.missing], [false, ["el diferencial"]], "sin hipoteca calculable, dice qué falta");
  const euribor = Stress.evaluate("euribor", baseInput, baseRows, deps, { ...opts, params: { shocks: [{ date: "2027-02-05", from: 640, to: 750, extra: 110, rate: 4.34, months: 240 }] } });
  assert.equal(euribor.comparison.end.diff, -220, "febrero y marzo con 110 € más de cuota");
  assert.equal(Stress.evaluate("gasto-mas", baseInput, baseRows, deps, opts), null, "fuera de la fila desde D-N3");
  assert.equal(Stress.evaluate("imprevisto", { months: [] }, baseRows, deps, opts), null);
});

test("FX-21 · motor puro y cableado: sin DOM ni estado; antes de app.js, en el service worker, en el sitio y con consumidor real", () => {
  const src = read("canonical-stress-scenarios.js");
  assert.doesNotMatch(src, /document\.|localStorage|\bstate\./);
  const html = read("index.html");
  const at = html.indexOf('<script defer src="canonical-stress-scenarios.js?v=');
  assert.ok(at > 0 && at < html.indexOf('<script defer src="views/prevision-v2.js?v=') && at < html.indexOf('<script defer src="app.js'));
  assert.match(read("service-worker.js"), /"\.\/canonical-stress-scenarios\.js"/);
  assert.match(read("tools/build-public-site.mjs"), /"canonical-stress-scenarios\.js",/);
  const vista = read("views/prevision-v2.js");
  assert.match(vista, /S\.evaluate\(/);
  assert.match(vista, /no cambia el plan ni mueve dinero/, "A11-4: una prueba no ejecuta nada");
  assert.match(vista, /anotar\("prevision-v2", "accion"\)/);
});
