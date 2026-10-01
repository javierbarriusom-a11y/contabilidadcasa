const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const DailyInput = require("../canonical-daily-input.js");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

// S1 (docs/OLA2_SUELO_Y_DISPONIBLE.md §8, sesión 286): `canonicalDailyInput` y sus tres ayudantes se
// extrajeron de app.js a canonical-daily-input.js sin cambiar el comportamiento, para liberar líneas
// bajo el techo ARQ-4 (`arq4-techo-app-js`). Los datasets dorados y el resto de pruebas fijan la
// salida del motor diario; esta prueba fija el contrato del módulo y que la extracción no se deshaga.

const monthlyInput = {
  openingBalances: { checking: 5610, savings: 1200 },
  months: [
    {
      monthKey: "2026-10",
      month: "oct 2026",
      mainPayrollDate: "2026-10-31",
      incomeEvents: [
        { amount: 3000, concept: "Nómina Javi", date: "2026-10-31", confidence: "rule", role: "main-payroll" },
        { amount: 2000, label: "Nómina Tere", date: "2026-10-25" },
      ],
      expenseEvents: [
        { field: "fixedCoreSpend", amount: 1000, concept: "Alquiler", date: "2026-10-01" },
        { field: "fixedCoreSpend", amount: 500 },
        { field: "car", amount: 300 },
      ],
    },
    { monthKey: "2026-11", month: "nov 2026", incomeEvents: [], expenseEvents: [] },
  ],
};
const rows = [
  { income: 5000, fixedCoreSpend: 1500, variableOperationalSpend: 200, car: 300, refi: 0, projectOutflow: 800, saving: 500, checking: 4000, savings: 1700, totalLiquidity: 5700, outflowsBeforeSaving: 2800 },
  { income: 5000, coreSpend: 2600, variableOperationalSpend: 300, saving: 0 },
];

test("build devuelve la entrada del motor diario con la reserva operativa que se le pasa", () => {
  const input = DailyInput.build(monthlyInput, rows, { operatingReserve: 1500 });
  assert.deepEqual(input.openingBalances, monthlyInput.openingBalances);
  assert.equal(input.policy.operatingReserve, 1500);
  assert.equal(input.startDate, "2026-10-01");
  assert.equal(input.endDate, "2026-11-30");
  assert.deepEqual(input.months.map((month) => month.monthKey), ["2026-10", "2026-11"]);
  // Sin la opción, la reserva es 0: el módulo ya no lee el estado de la app.
  assert.equal(DailyInput.build(monthlyInput, rows).policy.operatingReserve, 0);
  assert.equal(DailyInput.build(monthlyInput, rows, { operatingReserve: null }).policy.operatingReserve, 0);
});

test("reparte cada importe mensual entre sus eventos con fechas observadas y de relleno", () => {
  const { events } = DailyInput.build(monthlyInput, rows, { operatingReserve: 1500 });
  const income = events.filter((event) => event.field === "income" && event.date.startsWith("2026-10"));
  assert.deepEqual(income.map((event) => [event.date, event.amount]), [["2026-10-31", 3000], ["2026-10-25", 2000]]);
  // El gasto fijo (1.500) se reparte en proporción a sus dos partidas; la segunda no trae fecha y cae en el relleno (día 8).
  const fixed = events.filter((event) => event.field === "fixedCoreSpend" && event.date.startsWith("2026-10"));
  assert.deepEqual(fixed.map((event) => [event.date, event.amount]), [["2026-10-01", 1000], ["2026-10-08", 500]]);
  assert.equal(fixed.reduce((sum, event) => sum + event.amount, 0), 1500);
  // El proyecto y el traspaso a ahorro se fechan en la nómina principal.
  const project = events.find((event) => event.field === "projectOutflow");
  assert.equal(project.date, "2026-10-31");
  assert.equal(project.confidence, "rule");
  const saving = events.find((event) => event.kind === "transfer" && event.date.startsWith("2026-10"));
  assert.equal(saving.amount, 500);
  assert.equal(saving.role, "main-payroll");
  // Los importes a cero no generan evento y la secuencia es correlativa.
  assert.ok(events.every((event) => Math.abs(event.amount) >= 0.005));
  assert.deepEqual(events.map((event) => event.sequence), events.map((_, index) => index + 1));
});

test("sin fecha de nómina, el mes se fecha en su último día natural (no en el hábil)", () => {
  // Octubre de 2026 acaba en sábado: el respaldo debe ser el 31 y no el viernes 30 (último día hábil).
  const input = DailyInput.build({ months: [{ monthKey: "2026-10" }] }, [{ projectOutflow: 100 }], {});
  assert.equal(input.months[0].mainPayrollDate, "2026-10-31");
  assert.equal(input.events[0].date, "2026-10-31");
});

test("la entrada vacía no rompe y un monthKey inválido no genera fechas", () => {
  const empty = DailyInput.build({ months: [] }, [], { operatingReserve: 1500 });
  assert.deepEqual(empty.events, []);
  assert.equal(empty.startDate, "");
  assert.equal(empty.endDate, "");
});

test("app.js ya no define la entrada diaria y la pide al módulo, registrado y cargado antes que app.js", () => {
  const app = read("app.js");
  for (const name of ["canonicalDailyInput", "distributeDailyAuditEvents", "pushDailyAuditEvent", "dailyAuditFallbackDate"]) {
    assert.ok(!app.includes(`function ${name}(`), `${name} debe vivir solo en canonical-daily-input.js`);
  }
  assert.match(app, /window\.FinanceCanonicalDailyInput/);
  assert.match(app, /inputBuilder\.build\(monthlyInput, rows, \{ operatingReserve: state\.operatingReserve \}\)/);

  const html = read("index.html");
  const moduleAt = html.indexOf('src="canonical-daily-input.js');
  const engineAt = html.indexOf('src="canonical-daily-engine.js');
  const appAt = html.indexOf('src="app.js');
  assert.ok(engineAt >= 0 && moduleAt > engineAt, "el módulo se carga después del motor diario");
  assert.ok(moduleAt > 0 && moduleAt < appAt, "el módulo se carga antes que app.js");
  assert.match(read("service-worker.js"), /"\.\/canonical-daily-input\.js"/);
  assert.match(read("tools/build-public-site.mjs"), /"canonical-daily-input\.js"/);
});
