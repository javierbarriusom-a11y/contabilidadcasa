const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const Band = require("../canonical-cash-band.js");
const DailyInput = require("../canonical-daily-input.js");

// WP-14 + WP-27, PR-2 (docs/WP14_WP27_DISENO.md §4): «Aún no» / «Llegará tarde» mueven la FECHA de la partida al día en que se vuelve a preguntar,
// para que el motor diario y la banda de WP-16 la cuenten todavía pendiente. Sin esto, un cobro retrasado con fecha cierta ya vencida se daba por
// ocurrido (la banda descarta lo anterior al saldo) y un cargo aplazado, por pagado.

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const app = read("app.js");

function block(startMarker, endMarker) {
  const start = app.indexOf(startMarker);
  const end = app.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `No se encontró el bloque ${startMarker}`);
  return app.slice(start, end);
}

// El motor real de fechas con las utilidades reales de app.js, como en tests/ntc1-motor-fechas.test.cjs, más el gancho de aplazamientos.
function loadEngine({ transactions = [], deferral, chargeDay } = {}) {
  const sandbox = { transactionsForTest: transactions, deferralForTest: deferral, chargeDayForTest: chargeDay };
  vm.createContext(sandbox);
  vm.runInContext([
    block("function dateFromMonthKey", "function defaultBalanceDate"),
    block("function normalizedText", "function isCarPlanningRow"),
    "function displayLabelForRow(row) { return row.label; }",
    read("canonical-timing.js"),
    "this.engine = FinanceCanonicalTiming.createTimingEngine({ displayLabelForRow, normalizedText, dateFromMonthKey, monthEndDate, lastBusinessDayOfMonth, isoLocalDate, localDateFromIso, shortDate, dateWithMonthLabel, transactions: () => transactionsForTest, chargeDay: chargeDayForTest, deferral: deferralForTest });",
  ].join("\n"), sandbox);
  return sandbox.engine;
}
const plain = (value) => JSON.parse(JSON.stringify(value));
const SEPT = { key: "2026-09" };
const NOMINA = { label: "Nómina Javi" };

// ---- el motor de fechas ----
test("sin aplazamiento el motor es el de siempre; con un aplazamiento que no es posterior, también", () => {
  const original = plain(loadEngine().incomeTimingForRow(NOMINA, SEPT, 3000));
  assert.equal(original.date, "2026-09-30");
  assert.deepEqual(plain(loadEngine({ deferral: () => null }).incomeTimingForRow(NOMINA, SEPT, 3000)), original);
  assert.deepEqual(plain(loadEngine({ deferral: () => ({ date: "2026-09-30" }) }).incomeTimingForRow(NOMINA, SEPT, 3000)), original, "mismo día: no mueve");
  assert.deepEqual(plain(loadEngine({ deferral: () => ({ date: "2026-09-12" }) }).incomeTimingForRow(NOMINA, SEPT, 3000)), original, "anterior: no adelanta");
});

test("un cobro por regla aplazado mueve la fecha, la etiqueta y el origen; no el día del mes ni la confianza", () => {
  const engine = loadEngine({ deferral: () => ({ date: "2026-10-03" }) });
  const moved = plain(engine.incomeTimingForRow(NOMINA, SEPT, 3000));
  assert.equal(moved.date, "2026-10-03");
  assert.equal(moved.deferredFrom, "2026-09-30");
  assert.equal(moved.day, 30, "`day` ordena el mes y decide qué va antes de la nómina: no se toca");
  assert.equal(moved.confidence, "rule");
  assert.equal(moved.role, "main-payroll");
  assert.match(moved.source, /regla nómina Javi, aplazado hasta el /);
  assert.match(moved.label, /3/);
});

test("un cargo declarado o de fin de mes aplazado se mueve igual; la fecha original sigue disponible para el detector", () => {
  const declared = loadEngine({ deferral: () => ({ date: "2026-10-06" }), chargeDay: () => ({ day: 5, source: "indicado" }) });
  const seguro = plain(declared.expenseTimingForRow({ label: "Seguro coche" }, { key: "2026-10" }, -300));
  assert.equal(seguro.date, "2026-10-06");
  assert.equal(seguro.confidence, "declared");
  assert.equal(seguro.day, 5);
  assert.equal(plain(declared.expenseTimingForRow({ label: "Seguro coche" }, { key: "2026-10" }, -300, { ignoreDeferral: true })).date, "2026-10-05");
  assert.equal(plain(declared.incomeTimingForRow(NOMINA, SEPT, 3000, { ignoreDeferral: true })).date, "2026-09-30");
  const trastero = plain(loadEngine({ deferral: () => ({ date: "2026-11-02" }) }).expenseTimingForRow({ label: "Trastero" }, SEPT, -60));
  assert.deepEqual([trastero.date, trastero.endOfMonth, trastero.day], ["2026-11-02", true, 30]);
});

test("lo estimado y lo observado no se aplazan: lo primero no se pregunta, lo segundo ya llegó", () => {
  const defer = () => ({ date: "2026-12-20" });
  const estimated = plain(loadEngine({ deferral: defer }).expenseTimingForRow({ label: "Gimnasio" }, SEPT, -30));
  assert.deepEqual([estimated.date, estimated.confidence], ["2026-09-08", "estimated"]);
  const observed = plain(loadEngine({ deferral: defer, transactions: [{ month: "2026-09", date: "2026-09-04", amount: -45.9, movement: "IBERDROLA LUZ", details: "", category: "" }] }).expenseTimingForRow({ label: "Luz Iberdrola" }, SEPT, -45.9));
  assert.deepEqual([observed.date, observed.confidence], ["2026-09-04", "observed"]);
  const incomeEstimated = plain(loadEngine({ deferral: defer }).incomeTimingForRow({ label: "Wash" }, SEPT, 400));
  assert.deepEqual([incomeEstimated.date, incomeEstimated.confidence], ["2026-09-08", "estimated"]);
});

// ---- la banda de caja ----
test("sin el aplazamiento, un cobro cierto ya vencido se descarta; con él, entra el día al que se aplazó", () => {
  const input = { asOf: "2026-10-03", openingTotal: 1000, floor: 500, horizonDays: 29, trajectories: 200, seed: 2 };
  const dropped = Band.simulate({ ...input, events: [{ id: "n", kind: "income", amount: 3000, date: "2026-09-30", confidence: "rule" }] });
  assert.equal(dropped.days.at(-1).p50, 1000, "descartado: se da por contado en el saldo");
  const moved = Band.simulate({ ...input, events: [{ id: "n", kind: "income", amount: 3000, date: "2026-10-05", confidence: "rule" }] });
  assert.equal(moved.days[1].p50, 1000);
  assert.equal(moved.days[2].p50, 4000, "entra el 5/10");
  assert.equal(moved.quality, "exact");
});

test("un día de cargo declarado (WP-08) cuenta como fecha cierta en la banda, no como estimada", () => {
  const input = { asOf: "2026-10-01", openingTotal: 2000, floor: 0, horizonDays: 29, trajectories: 200, seed: 4 };
  const result = Band.simulate({ ...input, events: [{ id: "s", kind: "outflow", amount: 600, date: "2026-10-12", confidence: "declared" }] });
  assert.equal(result.quality, "exact");
  result.days.forEach((day) => assert.equal(day.p10, day.p90));
  assert.equal(result.days[10].p50, 2000);
  assert.equal(result.days[11].p50, 1400, "el 12/10 y no repartido por una ventana");
});

// ---- la ejecución diaria guardada ----
test("la firma de fechas de gasto cambia cuando un cargo cambia de día y solo entonces", () => {
  const month = (date, amount = 300) => ({ months: [{ monthKey: "2026-10", expenseEvents: [{ date, field: "fixedCoreSpend", amount, confidence: "declared" }] }] });
  const sig = DailyInput.datesSignature(month("2026-10-05"));
  assert.equal(DailyInput.datesSignature(month("2026-10-05")), sig);
  assert.notEqual(DailyInput.datesSignature(month("2026-10-06")), sig);
  assert.notEqual(DailyInput.datesSignature(month("2026-10-05", 310)), sig);
  assert.equal(DailyInput.datesSignature({}), DailyInput.datesSignature({ months: [] }));
});

// ---- cableado ----
test("cableado: el motor recibe el aplazamiento de esperados-ui, el detector pregunta por la fecha original y la ejecución diaria se invalida", () => {
  assert.match(app, /chargeDay: chargeDayForRow, deferral: expectedDeferralForRow \}\)\)/);
  const ui = read("esperados-ui.js");
  assert.match(ui, /function expectedDeferralForRow\(row, month\)/);
  assert.match(ui, /isoLocalDate\(new Date\(\)\) < snooze\.until/, "solo mientras dura el aplazamiento");
  assert.match(ui, /ignoreDeferral: true/);
  assert.match(ui, /resolved\.patch\?\.type === "snooze"\) refreshAllSectionsAfterDataChange\(\)/, "responder «aún no» recalcula la previsión");
  assert.match(app, /previous\.datesSignature === datesSignature/);
  assert.match(app, /snapshot\.datesSignature = datesSignature/);
  const lines = app.split("\n").length;
  assert.ok(lines <= 37495, `app.js tiene ${lines} líneas (techo ARQ-4: 37.495)`);
});
