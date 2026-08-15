const test = require("node:test");
const assert = require("node:assert/strict");
const Cushion = require("../canonical-cushion.js");

// F1 · Cimientos: "colchón por mes" y "peor mes" vivían como lógica de vista embebida en
// mapaCalorFloor/mapaCalorTone/renderMapaCalor (app.js). Este módulo las extrae como cálculo puro
// y compartido -- sin DOM, sin estado global -- para que Hoy, Plan y Análisis lean la misma
// función en vez de reimplementarla cada una a su manera.

test("cushionFloor · con reserva operativa configurada, el suelo es la reserva", () => {
  const floor = Cushion.cushionFloor([{ coreSpend: 900 }], 1200);
  assert.equal(floor.value, 1200);
  assert.equal(floor.basis, "operating-reserve");
  assert.equal(floor.basisValue, 1200);
});

test("cushionFloor · sin reserva, el suelo es un mes de salidas del primer mes del horizonte", () => {
  const floor = Cushion.cushionFloor([{ coreSpend: 500, car: 120, refi: 30 }], 0);
  assert.equal(floor.basis, "one-month-outflow");
  assert.equal(floor.basisValue, 650);
  assert.equal(floor.value, 650);
});

test("cushionFloor · sin reserva y sin filas, el suelo nunca baja de 1 (evita dividir tonos por cero)", () => {
  const floor = Cushion.cushionFloor([], 0);
  assert.equal(floor.basis, "one-month-outflow");
  assert.equal(floor.basisValue, 0);
  assert.equal(floor.value, 1);
});

test("cushionTone · negativo, por debajo del suelo, holgado y muy holgado, en los cuatro tramos", () => {
  assert.equal(Cushion.cushionTone(-5, 1000), "is-negative");
  assert.equal(Cushion.cushionTone(500, 1000), "is-tight");
  assert.equal(Cushion.cushionTone(1500, 1000), "is-ok");
  assert.equal(Cushion.cushionTone(3500, 1000), "is-good");
});

test("cushionTone · los límites de tramo son estrictos: justo en el suelo ya no es \"tight\"", () => {
  assert.equal(Cushion.cushionTone(1000, 1000), "is-ok");
  assert.equal(Cushion.cushionTone(3000, 1000), "is-good");
});

test("worstMonthOf · encuentra el mes con menor liquidez, no el primero ni el último", () => {
  const rows = [
    { detailMonthKey: "2026-09", totalLiquidity: 1800 },
    { detailMonthKey: "2026-10", totalLiquidity: 400 },
    { detailMonthKey: "2026-11", totalLiquidity: 900 },
  ];
  const worst = Cushion.worstMonthOf(rows);
  assert.equal(worst.key, "2026-10");
  assert.equal(worst.value, 400);
  assert.equal(worst.row, rows[1]);
});

test("worstMonthOf · sin filas, no hay peor mes que inventar", () => {
  assert.equal(Cushion.worstMonthOf([]), null);
  assert.equal(Cushion.worstMonthOf(null), null);
});

test("cushionLevel · negativo, ajustado y holgado, en los tres tramos (P-9/A-2)", () => {
  assert.equal(Cushion.cushionLevel(-5, 1000), "negativo");
  assert.equal(Cushion.cushionLevel(500, 1000), "ajustado");
  assert.equal(Cushion.cushionLevel(3500, 1000), "holgado");
});

test("cushionLevel · el límite es estricto: justo en el suelo ya es \"holgado\"", () => {
  assert.equal(Cushion.cushionLevel(1000, 1000), "holgado");
});

test("worstMonthOf · admite nombres de campo distintos, para reutilizarse con otros horizontes", () => {
  const rows = [
    { month: "2026-01", liquidity: 200 },
    { month: "2026-02", liquidity: 50 },
  ];
  const worst = Cushion.worstMonthOf(rows, { liquidityField: "liquidity", monthKeyField: "month" });
  assert.equal(worst.key, "2026-02");
  assert.equal(worst.value, 50);
});
