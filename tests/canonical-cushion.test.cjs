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

// TT1 · Bloque 1: reparto del colchón entre corriente (acceso inmediato) y remunerado (rendimiento).
// Reutiliza el mismo cálculo de salidas mensuales que cushionFloor, no un umbral aparte.

test("cushionAccountSplit · deja en corriente solo los días de acceso inmediato, el resto va a remunerado", () => {
  const rows = [{ coreSpend: 900, car: 0, refi: 0 }]; // 900/mes -> 30/día
  const split = Cushion.cushionAccountSplit(3000, rows, { instantAccessDays: 7 });
  assert.equal(split.total, 3000);
  assert.equal(split.instantAccessAmount, 210); // 30 * 7
  assert.equal(split.corriente, 210);
  assert.equal(split.remunerado, 2790);
});

test("cushionAccountSplit · el colchón nunca llega a cubrir ni el acceso inmediato: todo se queda en corriente", () => {
  const rows = [{ coreSpend: 900, car: 0, refi: 0 }];
  const split = Cushion.cushionAccountSplit(100, rows, { instantAccessDays: 7 });
  assert.equal(split.corriente, 100);
  assert.equal(split.remunerado, 0);
});

test("cushionAccountSplit · admite un número de días de acceso inmediato distinto del valor por defecto", () => {
  const rows = [{ coreSpend: 900, car: 0, refi: 0 }];
  const split = Cushion.cushionAccountSplit(3000, rows, { instantAccessDays: 14 });
  assert.equal(split.instantAccessAmount, 420); // 30 * 14
  assert.equal(split.corriente, 420);
  assert.equal(split.remunerado, 2580);
});

test("cushionAccountSplit · por defecto usa 7 días de acceso inmediato", () => {
  const rows = [{ coreSpend: 900, car: 0, refi: 0 }];
  const split = Cushion.cushionAccountSplit(3000, rows);
  assert.equal(split.instantAccessDays, 7);
  assert.equal(split.instantAccessAmount, 210);
});

test("cushionAccountSplit · sin salidas conocidas (sin filas), el acceso inmediato es cero y todo va a remunerado", () => {
  const split = Cushion.cushionAccountSplit(1000, []);
  assert.equal(split.instantAccessAmount, 0);
  assert.equal(split.corriente, 0);
  assert.equal(split.remunerado, 1000);
});

test("cushionAccountSplit · un total negativo o inválido no reparte de más: se trata como cero", () => {
  const rows = [{ coreSpend: 900, car: 0, refi: 0 }];
  const split = Cushion.cushionAccountSplit(-500, rows);
  assert.equal(split.total, 0);
  assert.equal(split.corriente, 0);
  assert.equal(split.remunerado, 0);
});

test("cushionAccountSplit · ignora una reserva operativa configurada: usa siempre las salidas mensuales para el acceso inmediato", () => {
  const rows = [{ coreSpend: 900, car: 0, refi: 0 }];
  // cushionFloor con reserva devolvería basis "operating-reserve"; cushionAccountSplit no debe heredarlo.
  const split = Cushion.cushionAccountSplit(3000, rows, { instantAccessDays: 7 });
  assert.equal(split.instantAccessAmount, 210);
});

// TT5 · Bloque 1: el suelo del colchón (reserva operativa) como parámetro vivo — cushionFloorDrift
// no cambia cushionFloor, solo compara el número fijo configurado con lo que el gasto real actual
// sugeriría ahora mismo.

test("cushionFloorDrift · sin reserva configurada, no hay nada que comparar", () => {
  const rows = [{ coreSpend: 900, car: 0, refi: 0 }];
  const drift = Cushion.cushionFloorDrift(0, rows);
  assert.equal(drift.configured, 0);
  assert.equal(drift.live, 900);
  assert.equal(drift.driftRatio, null);
  assert.equal(drift.stale, false);
});

test("cushionFloorDrift · reserva alineada con el gasto real actual: no está desfasada", () => {
  const rows = [{ coreSpend: 900, car: 0, refi: 0 }];
  const drift = Cushion.cushionFloorDrift(950, rows); // ~5.6% de diferencia
  assert.equal(drift.configured, 950);
  assert.equal(drift.live, 900);
  assert.equal(drift.stale, false);
});

test("cushionFloorDrift · reserva muy por debajo del gasto real actual: desfasada (stale)", () => {
  const rows = [{ coreSpend: 900, car: 0, refi: 0 }];
  const drift = Cushion.cushionFloorDrift(600, rows); // -33%
  assert.equal(drift.driftRatio, -0.33);
  assert.equal(drift.stale, true);
});

test("cushionFloorDrift · reserva muy por encima del gasto real actual: también desfasada", () => {
  const rows = [{ coreSpend: 900, car: 0, refi: 0 }];
  const drift = Cushion.cushionFloorDrift(1500, rows); // +67%
  assert.equal(drift.driftRatio, 0.67);
  assert.equal(drift.stale, true);
});

test("cushionFloorDrift · el umbral del 20% es el límite exacto: justo en el 20% ya cuenta como desfasada", () => {
  const rows = [{ coreSpend: 1000, car: 0, refi: 0 }];
  const drift = Cushion.cushionFloorDrift(1200, rows); // exactamente +20%
  assert.equal(drift.driftRatio, 0.2);
  assert.equal(drift.stale, true);
  assert.equal(Cushion.CUSHION_DRIFT_THRESHOLD, 0.2);
});

test("cushionFloorDrift · sin gasto real conocido (sin filas) y con reserva configurada, no divide por cero", () => {
  const drift = Cushion.cushionFloorDrift(500, []);
  assert.equal(drift.live, 0);
  assert.equal(drift.driftRatio, null);
  assert.equal(drift.stale, false);
});
