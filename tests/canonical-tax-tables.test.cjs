const test = require("node:test");
const assert = require("node:assert/strict");
const TaxTables = require("../canonical-tax-tables.js");

// A15-5 · Bloque 2: tablas fiscales versionadas y su actualización anual. No calcula nada fiscal —
// solo registra qué año está cubierto, infraestructura para A15-1/A15-2 (más adelante). Ninguna
// cifra fiscal se fabrica: taxTableStatus solo compara años.

test("taxTableStatus · sin tablas registradas, el año en curso no está cubierto", () => {
  const status = TaxTables.taxTableStatus([], 2026);
  assert.equal(status.currentYearCovered, false);
  assert.equal(status.stale, true);
  assert.equal(status.latestYear, null);
  assert.deepEqual(status.yearsRegistered, []);
});

test("taxTableStatus · el año en curso registrado no está obsoleto", () => {
  const status = TaxTables.taxTableStatus([{ year: 2025 }, { year: 2026 }], 2026);
  assert.equal(status.currentYearCovered, true);
  assert.equal(status.stale, false);
  assert.equal(status.latestYear, 2026);
});

test("taxTableStatus · solo hay tablas de años anteriores, el actual sigue sin cubrir", () => {
  const status = TaxTables.taxTableStatus([{ year: 2024 }, { year: 2025 }], 2026);
  assert.equal(status.currentYearCovered, false);
  assert.equal(status.stale, true);
  assert.equal(status.latestYear, 2025);
});

test("taxTableStatus · años duplicados no se cuentan dos veces", () => {
  const status = TaxTables.taxTableStatus([{ year: 2026 }, { year: 2026 }, { year: 2025 }], 2026);
  assert.deepEqual(status.yearsRegistered, [2025, 2026]);
});

test("taxTableStatus · sin año en curso determinable, stale queda en null, no en un booleano inventado", () => {
  const status = TaxTables.taxTableStatus([{ year: 2026 }], null);
  assert.equal(status.stale, null);
  assert.equal(status.currentYear, null);
});

test("taxTableStatus · entradas con año inválido se ignoran, no rompen el cálculo", () => {
  const status = TaxTables.taxTableStatus([{ year: "no-es-un-año" }, { year: 2026 }], 2026);
  assert.deepEqual(status.yearsRegistered, [2026]);
});
