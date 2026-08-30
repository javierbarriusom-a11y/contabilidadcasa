const test = require("node:test");
const assert = require("node:assert/strict");
const Simulator = require("../canonical-pension-simulator.js");

// A15-4 · Bloque 5: motor puro de simulación de aportación a plan de pensiones. Compara el ahorro
// fiscal estimado frente al límite deducible vigente y frente a la liquidez que la aportación
// inmoviliza, sin fabricar ninguna cifra que no venga de un dato de entrada real.

test("simulateContribution · dentro del límite, calcula ahorro fiscal con el tipo marginal dado", () => {
  const result = Simulator.simulateContribution({ contribution: 1000, year: 2026, marginalRatePercent: 30 });
  assert.equal(result.limit, 1500);
  assert.equal(result.deductibleAmount, 1000);
  assert.equal(result.exceedsLimit, false);
  assert.equal(result.remainingRoom, 500);
  assert.equal(result.estimatedTaxSaving, 300);
  assert.equal(result.netCost, 700);
});

test("simulateContribution · por encima del límite, solo la parte deducible cuenta para el ahorro", () => {
  const result = Simulator.simulateContribution({ contribution: 2000, year: 2026, marginalRatePercent: 30 });
  assert.equal(result.exceedsLimit, true);
  assert.equal(result.deductibleAmount, 1500);
  assert.equal(result.remainingRoom, 0);
  assert.equal(result.estimatedTaxSaving, 450); // 1500 × 0.30, no 2000 × 0.30
});

test("simulateContribution · sin tipo marginal conocido, el ahorro es un hueco explícito, no cero", () => {
  const result = Simulator.simulateContribution({ contribution: 1000, year: 2026 });
  assert.equal(result.marginalRate, null);
  assert.equal(result.estimatedTaxSaving, null);
  assert.equal(result.netCost, null);
});

test("simulateContribution · usa el límite del año más reciente cubierto, no el más antiguo", () => {
  const result2021 = Simulator.simulateContribution({ contribution: 1800, year: 2021 });
  const result2026 = Simulator.simulateContribution({ contribution: 1800, year: 2026 });
  assert.equal(result2021.limit, 2000);
  assert.equal(result2026.limit, 1500);
});

test("simulateContribution · sin año registrado (anterior a la primera tabla), el límite es desconocido", () => {
  const result = Simulator.simulateContribution({ contribution: 1000, year: 2019 });
  assert.equal(result.limit, null);
  assert.equal(result.deductibleAmount, 1000); // sin límite conocido, no se recorta nada
  assert.equal(result.exceedsLimit, false);
});

test("simulateContribution · marca si la aportación completa rompe la reserva protegida", () => {
  const breaks = Simulator.simulateContribution({ contribution: 1000, checkingBalance: 1500, protectedReserve: 1000 });
  assert.equal(breaks.marginAfter, -500);
  assert.equal(breaks.breaksReserve, true);

  const safe = Simulator.simulateContribution({ contribution: 1000, checkingBalance: 5000, protectedReserve: 1000 });
  assert.equal(safe.marginAfter, 3000);
  assert.equal(safe.breaksReserve, false);
});

test("simulateContribution · sin saldo o reserva conocidos, no fabrica un margen", () => {
  const result = Simulator.simulateContribution({ contribution: 1000 });
  assert.equal(result.marginAfter, null);
  assert.equal(result.breaksReserve, false);
});
