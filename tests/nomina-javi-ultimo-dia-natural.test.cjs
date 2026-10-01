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
// - El bonus de Javi (que no es la nómina) conserva su regla del último día hábil: el hogar no dijo nada de él.

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
  assert.match(app, /dailyAuditFallbackDate\(month\.monthKey, monthEndDate\(dateFromMonthKey\(month\.monthKey\)\)\.getDate\(\)\)/);
  assert.match(app, /const day = monthEndDate\(date\)\.getDate\(\); \/\/ último día natural/);
  // Solo quedan la definición y la regla del bonus de Javi (no la nómina).
  const uses = app.match(/lastBusinessDayOfMonth\(/g) || [];
  assert.equal(uses.length, 2, "definición + regla del bonus");
  assert.match(app, /const day = date\.getMonth\(\) === 11 \? 15 : lastBusinessDayOfMonth\(date\)\.getDate\(\);/);
});
