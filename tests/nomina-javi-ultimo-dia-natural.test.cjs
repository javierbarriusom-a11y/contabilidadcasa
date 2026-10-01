const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// Decisión del hogar (1 de octubre de 2026): Javi cobra el último día NATURAL del mes y nunca el día 1.
// La app lo fechaba el último día HÁBIL (`lastBusinessDayOfMonth`): uno o dos días antes que la
// realidad en los meses que acaban en fin de semana (oct 2026: sáb 31 → vie 30; ene, feb y jul 2027).
// Fechar el ingreso antes de lo real es lo menos prudente para «hasta cuándo llega el dinero».
//
// Lo que NO se cambia, y esta prueba también lo fija:
// - Tere: la app la fecha el 25 aunque cobra el 22, A PROPÓSITO (más prudente). No «corregirlo».
// - Local: día 1.
// - La regla de diciembre (día 15) para «bonus/bono», Hacienda, «extra» o cualquier ingreso >= 2.500 € que no sea la nómina
//   de Javi, Tere o el local. La partida «Hacienda-otros ingresos» (3.000 €) llega sobre el 10/12 y la app la fecha el 15 a
//   propósito (más tarde es más prudente, como en Tere). La regla del «bonus» del resto de meses no se usa en los datos del hogar.
//
// Fallo que esta prueba cierra (1/10/2026): la regla de diciembre se evaluaba ANTES que la de la nómina de Javi y fechaba el
// día 15 cualquier ingreso >= 2.500 €. La nómina de Javi (3.400 € todos los meses) quedaba fechada el 15 de diciembre en vez
// del 31: 16 días ANTES de lo real, lo contrario de prudente.

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

function block(startMarker, endMarker) {
  const start = app.indexOf(startMarker);
  const end = app.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `No se encontró el bloque ${startMarker}`);
  return app.slice(start, end);
}

function loadSandbox() {
  const source = [
    block("function dateFromMonthKey", "function defaultBalanceDate"),
    block("function normalizedText", "function isCarPlanningRow"),
    block("function isPrePayrollIncomeRow", "function incomeTimingFromMovements"),
    block("function incomeTimingForRow", "function isEndOfMonthExpenseRow"),
    "function displayLabelForRow(row) { return row.label; }",
    "function incomeTimingFromMovements() { return null; }",
    "this.incomeTimingForRow = incomeTimingForRow;",
  ].join("\n");
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return sandbox;
}

function timing(sandbox, label, monthKey, amount = 2000) {
  return sandbox.incomeTimingForRow({ label }, { key: monthKey }, amount);
}

test("la nómina de Javi cae el último día natural, también cuando es fin de semana", () => {
  const sandbox = loadSandbox();
  const cases = [
    ["2026-10", 31, "sáb"],
    ["2027-01", 31, "dom"],
    ["2027-02", 28, "dom"],
    ["2027-07", 31, "sáb"],
    ["2026-11", 30, "lun"],
    ["2026-12", 31, "jue"],
  ];
  for (const [monthKey, day, weekday] of cases) {
    const result = timing(sandbox, "Nómina Javi", monthKey);
    assert.equal(result.day, day, `${monthKey} (${weekday})`);
    assert.equal(result.date, `${monthKey}-${String(day).padStart(2, "0")}`, `${monthKey} (${weekday})`);
    assert.equal(result.confidence, "rule");
    assert.equal(result.role, "main-payroll");
    assert.equal(result.source, "regla nómina Javi");
  }
});

test("la nómina de Javi nunca cae el día 1 del mes siguiente ni se adelanta al viernes", () => {
  const sandbox = loadSandbox();
  for (let month = 1; month <= 12; month += 1) {
    const monthKey = `2027-${String(month).padStart(2, "0")}`;
    const result = timing(sandbox, "Nómina Javi", monthKey);
    const lastDay = new Date(2027, month, 0).getDate();
    assert.equal(result.day, lastDay, monthKey);
    assert.ok(result.date.startsWith(monthKey), `${monthKey}: dentro del mes`);
  }
});

test("Tere sigue el día 25 y el local el día 1: el hogar decidió no tocar lo de Tere por prudencia", () => {
  const sandbox = loadSandbox();
  const tere = timing(sandbox, "Nómina Tere", "2026-10");
  assert.equal(tere.day, 25);
  assert.equal(tere.source, "regla salario Tere");
  const salario = timing(sandbox, "Salario Tere", "2026-10");
  assert.equal(salario.day, 25);
  const local = timing(sandbox, "Local", "2026-10", 800);
  assert.equal(local.day, 1);
  assert.equal(local.source, "regla local");
});

test("los sitios que fechan la nómina usan el último día natural y solo el bonus conserva el día hábil", () => {
  // Cuatro sitios derivan la fecha de la nómina del mes: la regla del ingreso, el corte de ingresos
  // previos a la nómina, y los dos cálculos de `mainPayrollDate`; más el respaldo de la auditoría diaria.
  assert.equal((app.match(/const payrollDate = monthEndDate\(monthDate\);/g) || []).length, 2);
  assert.match(app, /const payrollDay = monthEndDate\(monthDate\)\.getDate\(\);/);
  // S1 (sesión 286): el respaldo de la auditoría diaria se extrajo de app.js a canonical-daily-input.js.
  const dailyInput = fs.readFileSync(path.join(root, "canonical-daily-input.js"), "utf8");
  assert.match(dailyInput, /dailyAuditFallbackDate\(month\.monthKey, monthEndDate\(dateFromMonthKey\(month\.monthKey\)\)\.getDate\(\)\)/);
  assert.match(app, /const day = monthEndDate\(date\)\.getDate\(\); \/\/ último día natural/);
  // Solo quedan la definición y la regla del bonus de Javi (no la nómina).
  const uses = app.match(/lastBusinessDayOfMonth\(/g) || [];
  assert.equal(uses.length, 2, "definición + regla del bonus");
  assert.match(app, /const day = date\.getMonth\(\) === 11 \? 15 : lastBusinessDayOfMonth\(date\)\.getDate\(\);/);
});

test("la nómina de Javi de diciembre (3.400 €) cae el 31 y no el 15, aunque supere los 2.500 € de la regla de diciembre", () => {
  const sandbox = loadSandbox();
  for (const amount of [3400, 2500, 2400, 6800]) {
    const result = timing(sandbox, "Nómina Javi", "2026-12", amount);
    assert.equal(result.day, 31, `importe ${amount}`);
    assert.equal(result.source, "regla nómina Javi", `importe ${amount}`);
    assert.equal(result.role, "main-payroll");
  }
  // El resto del año ya caía bien: se fija para que ningún reordenamiento lo estropee.
  for (let month = 1; month <= 11; month += 1) {
    const monthKey = `2026-${String(month).padStart(2, "0")}`;
    const result = timing(sandbox, "Nómina Javi", monthKey, 3400);
    assert.equal(result.day, new Date(2026, month, 0).getDate(), monthKey);
    assert.equal(result.source, "regla nómina Javi", monthKey);
  }
});

test("la regla de diciembre sigue fechando el día 15 lo que no es la nómina: Hacienda, extra, bonus y cualquier ingreso >= 2.500 €", () => {
  const sandbox = loadSandbox();
  const december = [
    ["Hacienda-otros ingresos", 3000],
    ["Paga extra", 2000],
    ["Bonus", 500],
    ["Otros ingresos", 2600],
  ];
  for (const [label, amount] of december) {
    const result = timing(sandbox, label, "2026-12", amount);
    assert.equal(result.day, 15, label);
    assert.equal(result.source, "regla bono diciembre", label);
  }
  // Fuera de diciembre «Hacienda-otros ingresos» no tiene regla: cae en la estimación de relleno (día 8).
  const october = timing(sandbox, "Hacienda-otros ingresos", "2026-10", 3000);
  assert.equal(october.day, 8);
  assert.equal(october.confidence, "estimated");
});

test("Tere (día 25) y el local (día 1) no cambian en diciembre aunque superen los 2.500 €", () => {
  const sandbox = loadSandbox();
  assert.equal(timing(sandbox, "Nómina Tere", "2026-12", 2600).day, 25);
  assert.equal(timing(sandbox, "Local", "2026-12", 800).day, 1);
});

test("en incomeTimingForRow la regla de la nómina de Javi se evalúa antes que la de diciembre", () => {
  const fn = block("function incomeTimingForRow", "function isEndOfMonthExpenseRow");
  const payroll = fn.indexOf("isMainPayrollIncomeRow(row)");
  const december = fn.indexOf("date.getMonth() === 11 && (label.includes(\"hacienda\")");
  assert.ok(payroll > 0 && december > 0, "no se encontraron las dos reglas");
  assert.ok(payroll < december, "la nómina de Javi debe evaluarse antes que la regla de diciembre");
});
