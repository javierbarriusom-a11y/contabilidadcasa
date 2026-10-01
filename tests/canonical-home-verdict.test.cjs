const test = require("node:test");
const assert = require("node:assert/strict");

const Verdict = require("../canonical-home-verdict.js");
const dailyEngine = require("../canonical-daily-engine.js");

// Ola 2 · O2-1: «¿cuánto podemos gastar hasta el próximo ingreso?» como cálculo puro. Sin DOM ni
// estado global: la pantalla (O2-2) solo llamará a `computeHomeVerdict` y pintará el resultado.
// Estos datos son sintéticos y construidos a mano (el repositorio es público): no son los del hogar.

function out(id, date, amount, extra = {}) {
  return { id, date, kind: "outflow", amount, label: id, accountId: "checking", confidence: "rule", ...extra };
}

function income(id, date, amount = 2000, extra = {}) {
  return { id, date, kind: "income", amount, label: id, accountId: "checking", confidence: "observed", ...extra };
}

function base(overrides = {}) {
  return {
    asOfDate: "2026-09-30",
    checkingBalance: 6140,
    reserveFloor: 2500,
    savingsBalance: 3400,
    events: [
      out("alquiler", "2026-10-03", 900),
      out("luz", "2026-10-05", 80),
      income("nomina", "2026-10-08"),
      out("despues-del-ingreso", "2026-10-15", 500),
    ],
    ...overrides,
  };
}

test("la cascada resta suelo y salidas previstas hasta el próximo ingreso, y reparte el margen por día", () => {
  const verdict = Verdict.computeHomeVerdict(base());
  assert.equal(verdict.schema, Verdict.SCHEMA_ID);
  assert.equal(verdict.status, "ok");
  assert.equal(verdict.nextIncomeDate, "2026-10-08");
  assert.equal(verdict.nextIncomeSource, "events");
  assert.equal(verdict.days, 8);
  assert.deepEqual(verdict.lines, { cash: 6140, floor: 2500, plannedOutflows: 980, margin: 2660 });
  assert.equal(verdict.margin, 2660);
  assert.equal(verdict.shortfall, 0);
  assert.equal(verdict.perDay, 332.5);
  assert.deepEqual(verdict.missing, []);
});

test("un margen negativo se dice con su signo y su importe: nunca se recorta a 0", () => {
  const verdict = Verdict.computeHomeVerdict(base({ checkingBalance: 3000 }));
  assert.equal(verdict.status, "negative");
  assert.equal(verdict.margin, -480);
  assert.equal(verdict.lines.margin, -480);
  assert.equal(verdict.shortfall, 480);
  // «por día» no tiene sentido con un margen negativo: sin cifra, no un 0.
  assert.equal(verdict.perDay, null);
});

test("un margen justo en cero es «ok», no negativo, y no tiene cifra por día inventada", () => {
  const verdict = Verdict.computeHomeVerdict(base({ checkingBalance: 3480 }));
  assert.equal(verdict.status, "ok");
  assert.equal(verdict.margin, 0);
  assert.equal(verdict.perDay, 0);
});

test("si falta un dato no hay cifra —ni siquiera un 0— y se nombra cuál falta", () => {
  const cases = [
    [{ checkingBalance: undefined }, "checkingBalance", "absent"],
    [{ reserveFloor: undefined }, "reserveFloor", "absent"],
    [{ asOfDate: "" }, "asOfDate", "absent"],
    [{ events: [] }, "plannedCalendar", "absent"],
    [{ events: [out("solo-salida", "2026-10-03", 100)] }, "nextIncomeDate", "absent"],
  ];
  for (const [override, key, reason] of cases) {
    const verdict = Verdict.computeHomeVerdict(base(override));
    assert.equal(verdict.status, "missing", key);
    assert.equal(verdict.margin, null, key);
    assert.equal(verdict.lines, null, key);
    assert.equal(verdict.perDay, null, key);
    const named = verdict.missing.find((item) => item.key === key);
    assert.ok(named, `${key} debe nombrarse en missing`);
    assert.equal(named.reason, reason, key);
    assert.ok(named.label.length > 3, `${key} lleva una etiqueta legible`);
  }
});

test("null, cadena vacía y NaN son «no hay dato», no un cero (Number(null) valdría 0)", () => {
  for (const bad of [null, "", Number.NaN, "abc"]) {
    const noBalance = Verdict.computeHomeVerdict(base({ checkingBalance: bad }));
    assert.equal(noBalance.status, "missing", String(bad));
    assert.equal(noBalance.missing[0].key, "checkingBalance");
    const noFloor = Verdict.computeHomeVerdict(base({ reserveFloor: bad }));
    assert.equal(noFloor.status, "missing", String(bad));
    assert.equal(noFloor.missing[0].key, "reserveFloor");
  }
});

test("un suelo de 0 escrito a propósito es válido; uno negativo no lo es", () => {
  const zero = Verdict.computeHomeVerdict(base({ reserveFloor: 0 }));
  assert.equal(zero.status, "ok");
  assert.equal(zero.lines.floor, 0);
  const negative = Verdict.computeHomeVerdict(base({ reserveFloor: -100 }));
  assert.equal(negative.status, "missing");
  assert.equal(negative.missing.find((item) => item.key === "reserveFloor").reason, "invalid");
});

test("una fecha de ingreso ya pasada no sirve: se dice, no se calcula con días negativos", () => {
  const verdict = Verdict.computeHomeVerdict(base({ nextIncomeDate: "2026-09-25" }));
  assert.equal(verdict.status, "missing");
  assert.equal(verdict.missing.find((item) => item.key === "nextIncomeDate").reason, "past");
  assert.equal(verdict.days, null);
});

test("fechas imposibles o con formato distinto se tratan como ausentes", () => {
  assert.equal(Verdict.computeHomeVerdict(base({ asOfDate: "2026-02-30" })).status, "missing");
  assert.equal(Verdict.computeHomeVerdict(base({ asOfDate: "30/09/2026" })).status, "missing");
  // Un `Date` depende de la zona horaria del navegador: no se admite en silencio.
  assert.equal(Verdict.computeHomeVerdict(base({ asOfDate: new Date(2026, 8, 30) })).status, "missing");
});

test("ventana de salidas: lo fechado hoy ya está en el saldo; lo del día del ingreso cuenta; lo posterior no", () => {
  const verdict = Verdict.computeHomeVerdict(base({
    events: [
      out("hoy", "2026-09-30", 1000),
      out("manana", "2026-10-01", 100),
      out("dia-del-ingreso", "2026-10-08", 200),
      income("nomina", "2026-10-08"),
      out("despues", "2026-10-09", 4000),
    ],
  }));
  assert.equal(verdict.lines.plannedOutflows, 300);
  assert.deepEqual(verdict.breakdown.items.map((item) => item.id), ["manana", "dia-del-ingreso"]);
  assert.equal(verdict.sameDayOutflows, 200);
  assert.equal(verdict.margin, 3340);
  assert.equal(verdict.marginIfSameDayAfterIncome, 3540);
});

test("el primer ingreso futuro de los eventos fija la fecha; un ingreso pasado o de otra cuenta se ignora", () => {
  const verdict = Verdict.computeHomeVerdict(base({
    events: [
      income("pasado", "2026-09-20"),
      income("en-ahorro", "2026-10-02", 500, { accountId: "savings" }),
      income("nomina", "2026-10-10"),
      income("siguiente", "2026-11-10"),
      out("alquiler", "2026-10-03", 900),
    ],
  }));
  assert.equal(verdict.nextIncomeDate, "2026-10-10");
  assert.equal(verdict.days, 10);
});

test("la fecha que pasa el llamante manda sobre los eventos y queda marcada como «given»", () => {
  const verdict = Verdict.computeHomeVerdict(base({ nextIncomeDate: "2026-10-04" }));
  assert.equal(verdict.nextIncomeDate, "2026-10-04");
  assert.equal(verdict.nextIncomeSource, "given");
  assert.equal(verdict.days, 4);
  assert.equal(verdict.lines.plannedOutflows, 900);
});

test("si el ingreso llega hoy no hay ventana: margen = saldo − suelo y sin cifra por día", () => {
  const verdict = Verdict.computeHomeVerdict(base({ nextIncomeDate: "2026-09-30" }));
  assert.equal(verdict.days, 0);
  assert.equal(verdict.lines.plannedOutflows, 0);
  assert.equal(verdict.margin, 3640);
  assert.equal(verdict.perDay, null);
});

test("solo restan las salidas de CaixaBank; las de otra cuenta no", () => {
  const verdict = Verdict.computeHomeVerdict(base({
    events: [
      out("caixa", "2026-10-03", 100),
      out("de-ahorro", "2026-10-04", 5000, { accountId: "savings" }),
      income("nomina", "2026-10-08"),
    ],
  }));
  assert.equal(verdict.lines.plannedOutflows, 100);
});

test("los traspasos a ahorro no restan del margen pero se informan; Mediolanum es solo «ahorro aparte»", () => {
  const verdict = Verdict.computeHomeVerdict(base({
    events: [
      out("alquiler", "2026-10-03", 900),
      { id: "ahorro", date: "2026-10-06", kind: "transfer", fromAccountId: "checking", toAccountId: "savings", amount: 700, confidence: "rule" },
      { id: "otro-origen", date: "2026-10-07", kind: "transfer", fromAccountId: "savings", toAccountId: "checking", amount: 300 },
      income("nomina", "2026-10-08"),
    ],
  }));
  assert.equal(verdict.lines.plannedOutflows, 900);
  assert.equal(verdict.plannedTransfers, 700);
  assert.equal(verdict.savingsAside, 3400);
  // El ahorro no entra en el margen: con 3.400 € más en Mediolanum el margen no cambia.
  const richer = Verdict.computeHomeVerdict({ ...base(), savingsBalance: 99999, events: [out("alquiler", "2026-10-03", 900), income("nomina", "2026-10-08")] });
  assert.equal(richer.margin, verdict.margin);
});

test("sin saldo de ahorro informado, «ahorro aparte» es null y no 0", () => {
  assert.equal(Verdict.computeHomeVerdict(base({ savingsBalance: undefined })).savingsAside, null);
});

test("la confianza del margen es la de su peor salida y se reparte el importe por confianza", () => {
  const verdict = Verdict.computeHomeVerdict(base({
    events: [
      out("a", "2026-10-02", 100, { confidence: "observed" }),
      out("b", "2026-10-03", 200, { confidence: "rule" }),
      out("c", "2026-10-04", 300, { confidence: "estimated" }),
      out("d", "2026-10-05", 400, { confidence: "valor-raro" }),
      income("nomina", "2026-10-08"),
    ],
  }));
  assert.deepEqual(verdict.breakdown.byConfidence, { observed: 100, rule: 200, estimated: 700 });
  assert.equal(verdict.breakdown.confidence, "estimated");
  assert.equal(verdict.breakdown.estimatedShare, 0.7);
  const observedOnly = Verdict.computeHomeVerdict(base({ events: [out("a", "2026-10-02", 100, { confidence: "observed" }), income("n", "2026-10-08")] }));
  assert.equal(observedOnly.breakdown.confidence, "observed");
  assert.equal(observedOnly.breakdown.estimatedShare, 0);
});

test("sin salidas en la ventana la confianza no inventa un porcentaje de estimado", () => {
  const verdict = Verdict.computeHomeVerdict(base({ events: [income("nomina", "2026-10-08")] }));
  assert.equal(verdict.lines.plannedOutflows, 0);
  assert.equal(verdict.breakdown.estimatedShare, null);
});

test("si el calendario previsto termina antes del próximo ingreso se avisa en calendar.coversWindow", () => {
  const short = Verdict.computeHomeVerdict(base({ nextIncomeDate: "2026-11-05", events: [out("alquiler", "2026-10-03", 900)] }));
  assert.equal(short.status, "ok");
  assert.equal(short.calendar.coversWindow, false);
  assert.equal(short.calendar.lastDate, "2026-10-03");
  const full = Verdict.computeHomeVerdict(base());
  assert.equal(full.calendar.coversWindow, true);
});

test("los céntimos suman exactos: 0,10 + 0,20 son 0,30", () => {
  const verdict = Verdict.computeHomeVerdict(base({
    checkingBalance: 2500.3,
    events: [out("a", "2026-10-02", 0.1), out("b", "2026-10-03", 0.2), income("nomina", "2026-10-08")],
  }));
  assert.equal(verdict.lines.plannedOutflows, 0.3);
  assert.equal(verdict.margin, 0);
  assert.equal(verdict.status, "ok");
});

test("el cálculo no modifica sus entradas", () => {
  const input = base();
  const snapshot = JSON.stringify(input);
  Verdict.computeHomeVerdict(input);
  assert.equal(JSON.stringify(input), snapshot);
});

test("elige el mismo próximo ingreso que la tarjeta actual (coverageUntilNextIncome) con los mismos eventos", () => {
  // O2-2 sustituirá esa tarjeta: el veredicto no debe discrepar de ella en el día del ingreso.
  const input = base();
  const engine = dailyEngine.coverageUntilNextIncome({ asOfDate: input.asOfDate, checkingBalance: input.checkingBalance, events: input.events });
  assert.equal(Verdict.computeHomeVerdict(input).nextIncomeDate, engine.nextIncomeDate);
});

// Reconstrucción de lo medido en la app real con el dataset demo público (1 oct 2026; CaixaBank
// 5.610 €, suelo 2.500 €). Sin histórico de movimientos, `expenseTimingForRow` fecha cada partida de
// gasto del mes con la fecha de relleno «día 8» (`confidence: "estimated"`), la misma fecha que el
// ingreso: 4.730 € en seis partidas. La «reserva protegida» de Hoy (7.230 €) es exactamente suelo +
// esos 4.730 €, así que aquí el veredicto da el mismo −1.620 € que esa tarjeta recorta a 0; y la
// lectura «esas salidas llegan después del ingreso» da +3.110 €. El número depende de un supuesto
// de calendario, y por eso el resultado lo declara en vez de darlo por cierto.
test("con fechas de relleno el día del ingreso, el margen depende del supuesto y el resultado lo declara", () => {
  const partidas = [["Vivienda", 750], ["Gastos del hogar", 1350], ["Servicios", 400], ["Gasto variable estimado", 1750], ["Refinanciación", 180], ["Acuerdo", 300]];
  const verdict = Verdict.computeHomeVerdict({
    asOfDate: "2026-10-01",
    checkingBalance: 5610,
    reserveFloor: 2500,
    events: [
      income("persona-a", "2026-10-08", 3000, { confidence: "estimated" }),
      income("persona-b", "2026-10-08", 2000, { confidence: "estimated" }),
      ...partidas.map(([label, amount]) => out(label, "2026-10-08", amount, { confidence: "estimated" })),
    ],
  });
  assert.equal(verdict.status, "negative");
  assert.equal(verdict.days, 7);
  assert.equal(verdict.lines.plannedOutflows, 4730);
  assert.equal(verdict.margin, -1620);
  assert.equal(verdict.shortfall, 1620);
  assert.equal(verdict.sameDayOutflows, 4730);
  assert.equal(verdict.marginIfSameDayAfterIncome, 3110);
  assert.equal(verdict.signDependsOnSameDay, true);
  assert.equal(verdict.breakdown.estimatedShare, 1);
  // Coincide con el margen sobre la «reserva protegida» (suelo + salidas del mes siguiente).
  assert.equal(5610 - (2500 + 4730), verdict.margin);
});

test("con fechas fiables antes del ingreso el signo no depende de ningún supuesto", () => {
  const verdict = Verdict.computeHomeVerdict(base());
  assert.equal(verdict.sameDayOutflows, 0);
  assert.equal(verdict.marginIfSameDayAfterIncome, verdict.margin);
  assert.equal(verdict.signDependsOnSameDay, false);
  // Un negativo claro (salidas antes del ingreso) tampoco depende: no se suaviza.
  const negative = Verdict.computeHomeVerdict(base({ checkingBalance: 3000 }));
  assert.equal(negative.status, "negative");
  assert.equal(negative.signDependsOnSameDay, false);
});

test("las salidas del día del ingreso solo marcan dependencia si cambian el signo", () => {
  // Hay 100 € el día del ingreso, pero el margen es holgado con o sin ellas.
  const holgado = Verdict.computeHomeVerdict(base({ events: [out("a", "2026-10-08", 100), income("nomina", "2026-10-08")] }));
  assert.equal(holgado.sameDayOutflows, 100);
  assert.equal(holgado.signDependsOnSameDay, false);
  // Con solo 50 € por encima del suelo, 100 € el día del ingreso lo ponen en negativo.
  const justo = Verdict.computeHomeVerdict(base({ checkingBalance: 2550, events: [out("a", "2026-10-08", 100), income("nomina", "2026-10-08")] }));
  assert.equal(justo.status, "negative");
  assert.equal(justo.margin, -50);
  assert.equal(justo.marginIfSameDayAfterIncome, 50);
  assert.equal(justo.signDependsOnSameDay, true);
});
