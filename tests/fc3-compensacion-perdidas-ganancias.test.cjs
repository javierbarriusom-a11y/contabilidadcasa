const test = require("node:test");
const assert = require("node:assert/strict");

const Portfolio = require("../canonical-portfolio.js");

// FC3 · Bloque 10: compensación de pérdidas y ganancias patrimoniales a cierre de año. Depende de
// IV1/IV2 y reutiliza las plusvalías/minusvalías realizadas por venta que ya calcula FC1 (fifoLedger,
// dentro de normalizePositions) — sin motor de cálculo nuevo. Solo neta transmisiones contra
// transmisiones (Ley IRPF art. 49, ventana de 4 ejercicios), nunca contra rendimientos del capital
// mobiliario.

function positionWithDisposals(disposals) {
  return { disposals };
}

test("sin año declarado, no calcula nada", () => {
  const result = Portfolio.yearEndCompensation({ positions: [], year: "" });
  assert.equal(result.calculable, false);
  assert.equal(result.reason, "missing-year");
});

test("con una venta con shortfall (realizedGain null) en el año, la compensación de ese año no es calculable", () => {
  const positions = [positionWithDisposals([{ date: "2026-03-01", realizedGain: null }])];
  const result = Portfolio.yearEndCompensation({ positions, year: "2026" });
  assert.equal(result.calculable, false);
  assert.equal(result.reason, "incomplete-disposal");
});

test("neta ganancias y pérdidas realizadas dentro del año, ignorando otros años", () => {
  const positions = [
    positionWithDisposals([
      { date: "2026-02-01", realizedGain: 500 },
      { date: "2026-06-01", realizedGain: -200 },
      { date: "2025-12-01", realizedGain: 1000 },
    ]),
  ];
  const result = Portfolio.yearEndCompensation({ positions, year: "2026" });
  assert.equal(result.calculable, true);
  assert.equal(result.yearGains, 500);
  assert.equal(result.yearLosses, -200);
  assert.equal(result.netResult, 300);
});

test("sin pérdidas arrastradas, la base imponible tras compensar es el propio resultado neto", () => {
  const positions = [positionWithDisposals([{ date: "2026-01-01", realizedGain: 300 }])];
  const result = Portfolio.yearEndCompensation({ positions, year: "2026", priorLosses: [] });
  assert.equal(result.taxableNet, 300);
  assert.deepEqual(result.priorLossesApplied, []);
});

test("aplica pérdidas arrastradas de años anteriores, de la más antigua a la más nueva primero", () => {
  const positions = [positionWithDisposals([{ date: "2026-01-01", realizedGain: 1000 }])];
  const priorLosses = [
    { year: "2024", amount: 300 },
    { year: "2023", amount: 200 },
  ];
  const result = Portfolio.yearEndCompensation({ positions, year: "2026", priorLosses });
  assert.equal(result.totalPriorLossesApplied, 500);
  assert.equal(result.priorLossesApplied[0].year, "2023");
  assert.equal(result.priorLossesApplied[1].year, "2024");
  assert.equal(result.taxableNet, 500);
});

test("una pérdida arrastrada fuera de la ventana de 4 ejercicios no se aplica", () => {
  const positions = [positionWithDisposals([{ date: "2026-01-01", realizedGain: 1000 }])];
  const priorLosses = [{ year: "2020", amount: 500 }];
  const result = Portfolio.yearEndCompensation({ positions, year: "2026", priorLosses });
  assert.equal(result.totalPriorLossesApplied, 0);
  assert.equal(result.taxableNet, 1000);
});

test("un año con pérdida neta genera un nuevo arrastre, nunca compensa contra sí mismo", () => {
  const positions = [positionWithDisposals([{ date: "2026-01-01", realizedGain: -400 }])];
  const result = Portfolio.yearEndCompensation({ positions, year: "2026" });
  assert.equal(result.netResult, -400);
  assert.equal(result.taxableNet, -400);
  assert.deepEqual(result.newCarryForward, { year: "2026", amount: 400 });
});

test("una pérdida arrastrada mayor que la ganancia del año deja el sobrante disponible para años futuros", () => {
  const positions = [positionWithDisposals([{ date: "2026-01-01", realizedGain: 300 }])];
  const priorLosses = [{ year: "2024", amount: 1000 }];
  const result = Portfolio.yearEndCompensation({ positions, year: "2026", priorLosses });
  assert.equal(result.totalPriorLossesApplied, 300);
  assert.equal(result.taxableNet, 0);
  assert.deepEqual(result.remainingPriorLosses, [{ year: "2024", amount: 700 }]);
});

test("yearEndCompensation está expuesta en el motor canónico", () => {
  assert.equal(typeof Portfolio.yearEndCompensation, "function");
  assert.equal(Portfolio.LOSS_CARRYFORWARD_YEARS, 4);
});
