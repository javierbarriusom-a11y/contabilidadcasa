const test = require("node:test");
const assert = require("node:assert/strict");
const Period = require("../canonical-period.js");

// PER-1 (BACKLOG_CONTABILIDADCASA_3_0.md §2.1): generaliza lo que CanonicalBudgetSchema resolvía
// por separado para trimestre/año (BUD-3, quarterRange/annualRange) a las cuatro cadencias que la
// app necesita nombrar -- mes, trimestre, semestre y año -- en un solo módulo, motor puro sin DOM
// ni red. PER-2 migrará CanonicalBudgetSchema para delegar aquí sin romper su API pública; estas
// pruebas fijan el comportamiento que esa migración tiene que conservar.

// --- periodKey -----------------------------------------------------------------------------------

test("periodKey · mes de una fecha concreta", () => {
  assert.equal(Period.periodKey("month", new Date(2026, 8, 15)), "2026-09");
});

test("periodKey · trimestre de una fecha concreta, en los cuatro tramos", () => {
  assert.equal(Period.periodKey("quarter", new Date(2026, 0, 1)), "2026-Q1");
  assert.equal(Period.periodKey("quarter", new Date(2026, 3, 30)), "2026-Q2");
  assert.equal(Period.periodKey("quarter", new Date(2026, 6, 15)), "2026-Q3");
  assert.equal(Period.periodKey("quarter", new Date(2026, 11, 31)), "2026-Q4");
});

test("periodKey · semestre de una fecha concreta, en los dos tramos", () => {
  assert.equal(Period.periodKey("semester", new Date(2026, 0, 1)), "2026-S1");
  assert.equal(Period.periodKey("semester", new Date(2026, 5, 30)), "2026-S1");
  assert.equal(Period.periodKey("semester", new Date(2026, 6, 1)), "2026-S2");
  assert.equal(Period.periodKey("semester", new Date(2026, 11, 31)), "2026-S2");
});

test("periodKey · año de una fecha concreta", () => {
  assert.equal(Period.periodKey("year", new Date(2026, 5, 1)), "2026");
});

test("periodKey · una cadencia desconocida devuelve null, nunca una clave inventada", () => {
  assert.equal(Period.periodKey("week", new Date(2026, 5, 1)), null);
});

// --- periodUnit ------------------------------------------------------------------------------------

test("periodUnit · reconoce las cuatro formas de clave", () => {
  assert.equal(Period.periodUnit("2026-09"), "month");
  assert.equal(Period.periodUnit("2026-Q3"), "quarter");
  assert.equal(Period.periodUnit("2026-S1"), "semester");
  assert.equal(Period.periodUnit("2026"), "year");
});

test("periodUnit · una clave corrupta o de otra cadencia (semana) no es ninguna de las cuatro", () => {
  assert.equal(Period.periodUnit("2026-W37"), null);
  assert.equal(Period.periodUnit("2026-Q5"), null);
  assert.equal(Period.periodUnit("2026-S3"), null);
  assert.equal(Period.periodUnit(""), null);
  assert.equal(Period.periodUnit(undefined), null);
});

// --- periodRange -----------------------------------------------------------------------------------

test("periodRange · mes normal y mes de 31 días", () => {
  assert.deepEqual(Period.periodRange("2026-09"), { start: "2026-09-01", end: "2026-09-30" });
  assert.deepEqual(Period.periodRange("2026-01"), { start: "2026-01-01", end: "2026-01-31" });
});

test("periodRange · febrero respeta el año bisiesto sin caso especial a mano", () => {
  assert.deepEqual(Period.periodRange("2026-02"), { start: "2026-02-01", end: "2026-02-28" });
  assert.deepEqual(Period.periodRange("2028-02"), { start: "2028-02-01", end: "2028-02-29" });
});

test("periodRange · los cuatro trimestres naturales", () => {
  assert.deepEqual(Period.periodRange("2026-Q1"), { start: "2026-01-01", end: "2026-03-31" });
  assert.deepEqual(Period.periodRange("2026-Q2"), { start: "2026-04-01", end: "2026-06-30" });
  assert.deepEqual(Period.periodRange("2026-Q3"), { start: "2026-07-01", end: "2026-09-30" });
  assert.deepEqual(Period.periodRange("2026-Q4"), { start: "2026-10-01", end: "2026-12-31" });
});

test("periodRange · coincide exactamente con CanonicalBudgetSchema.quarterRange (BUD-3)", () => {
  const { CanonicalBudgetSchema } = require("../canonical-budget-schema.js");
  ["2026-Q1", "2026-Q2", "2026-Q3", "2026-Q4"].forEach((key) => {
    assert.deepEqual(Period.periodRange(key), CanonicalBudgetSchema.quarterRange(key));
  });
});

test("periodRange · los dos semestres", () => {
  assert.deepEqual(Period.periodRange("2026-S1"), { start: "2026-01-01", end: "2026-06-30" });
  assert.deepEqual(Period.periodRange("2026-S2"), { start: "2026-07-01", end: "2026-12-31" });
});

test("periodRange · año completo, coincide con CanonicalBudgetSchema.annualRange (BUD-3)", () => {
  const { CanonicalBudgetSchema } = require("../canonical-budget-schema.js");
  assert.deepEqual(Period.periodRange("2026"), { start: "2026-01-01", end: "2026-12-31" });
  assert.deepEqual(Period.periodRange("2026"), CanonicalBudgetSchema.annualRange("2026"));
});

test("periodRange · una clave corrupta o con formato ajeno (semana) devuelve null, nunca un rango inventado", () => {
  assert.equal(Period.periodRange("no-es-una-clave"), null);
  assert.equal(Period.periodRange("2026-W37"), null);
  assert.equal(Period.periodRange("2026-Q5"), null);
  assert.equal(Period.periodRange(null), null);
});

// --- periodLabel -----------------------------------------------------------------------------------

test("periodLabel · una etiqueta corta por cadencia", () => {
  assert.equal(Period.periodLabel("2026-09"), "sep 2026");
  assert.equal(Period.periodLabel("2026-Q3"), "T3 2026");
  assert.equal(Period.periodLabel("2026-S1"), "S1 2026");
  assert.equal(Period.periodLabel("2026"), "2026");
});

test("periodLabel · una clave sin formato reconocido se devuelve tal cual, nunca \"undefined\"", () => {
  assert.equal(Period.periodLabel("basura"), "basura");
  assert.equal(Period.periodLabel(undefined), "");
});

// --- adjacentPeriod --------------------------------------------------------------------------------

test("adjacentPeriod · el mes siguiente y el anterior, incluido el cruce de año", () => {
  assert.equal(Period.adjacentPeriod("2026-09", 1), "2026-10");
  assert.equal(Period.adjacentPeriod("2026-09", -1), "2026-08");
  assert.equal(Period.adjacentPeriod("2026-12", 1), "2027-01");
  assert.equal(Period.adjacentPeriod("2026-01", -1), "2025-12");
});

test("adjacentPeriod · el trimestre siguiente cruza de año en Q4 → Q1", () => {
  assert.equal(Period.adjacentPeriod("2026-Q4", 1), "2027-Q1");
  assert.equal(Period.adjacentPeriod("2027-Q1", -1), "2026-Q4");
});

test("adjacentPeriod · el semestre siguiente cruza de año en S2 → S1", () => {
  assert.equal(Period.adjacentPeriod("2026-S2", 1), "2027-S1");
  assert.equal(Period.adjacentPeriod("2027-S1", -1), "2026-S2");
});

test("adjacentPeriod · el año siguiente y el anterior", () => {
  assert.equal(Period.adjacentPeriod("2026", 1), "2027");
  assert.equal(Period.adjacentPeriod("2026", -1), "2025");
});

test("adjacentPeriod · sin offset, por defecto avanza uno", () => {
  assert.equal(Period.adjacentPeriod("2026-09"), "2026-10");
});

test("adjacentPeriod · saltos de varios periodos a la vez, no solo ±1", () => {
  assert.equal(Period.adjacentPeriod("2026-Q1", 3), "2026-Q4");
  assert.equal(Period.adjacentPeriod("2026-Q1", 4), "2027-Q1");
  assert.equal(Period.adjacentPeriod("2026-01", -13), "2024-12");
});

test("adjacentPeriod · una clave corrupta devuelve null, nunca una clave inventada", () => {
  assert.equal(Period.adjacentPeriod("no-es-una-clave", 1), null);
});

// --- UNITS -------------------------------------------------------------------------------------

test("UNITS · expone las cuatro cadencias, sin más ni menos", () => {
  assert.deepEqual([...Period.UNITS], ["month", "quarter", "semester", "year"]);
});
