const test = require("node:test");
const assert = require("node:assert/strict");

const Estimator = require("../canonical-irpf-estimator.js");

// FC5 · Bloque 10: venta parcial optimizando el tramo del ahorro. Depende de IV2 y reutiliza tal
// cual validateBracketScale/progressiveTax (A15-2) — el hogar declara la escala del tramo del
// ahorro, este motor no inventa ningún tipo. Dice cuánto de una plusvalía cabe en el tramo actual
// antes de saltar al siguiente, nunca una recomendación de vender.

function scaleWith(brackets) {
  return {
    brackets,
    source: { title: "Agencia Tributaria", authority: "Declarado por el hogar", url: "https://sede.agenciatributaria.gob.es/x", checkedAt: "2026-01-01" },
  };
}

const SAVINGS_SCALE = scaleWith([
  { limit: 6000, rate: 19 },
  { limit: 50000, rate: 21 },
  { limit: null, rate: 23 },
]);

test("sin escala válida, no calcula nada", () => {
  const result = Estimator.optimizePartialSale({ scale: {}, alreadyRealizedGain: 0, proposedGain: 1000 });
  assert.equal(result.calculable, false);
  assert.equal(result.reason, "missing-scale");
});

test("sin plusvalía propuesta, no calcula nada", () => {
  const result = Estimator.optimizePartialSale({ scale: SAVINGS_SCALE, alreadyRealizedGain: 0, proposedGain: 0 });
  assert.equal(result.calculable, false);
  assert.equal(result.reason, "missing-gain");
});

test("una plusvalía que cabe entera en el tramo actual: withinBracket true, sin excedente", () => {
  const result = Estimator.optimizePartialSale({ scale: SAVINGS_SCALE, alreadyRealizedGain: 0, proposedGain: 4000 });
  assert.equal(result.calculable, true);
  assert.equal(result.currentBracketRatePct, 19);
  assert.equal(result.roomInCurrentBracket, 6000);
  assert.equal(result.withinBracket, true);
  assert.equal(result.suggestedAmountWithinBracket, 4000);
  assert.equal(result.excessOverBracket, 0);
});

test("una plusvalía que salta al siguiente tramo: reparte lo que cabe y lo que excede", () => {
  const result = Estimator.optimizePartialSale({ scale: SAVINGS_SCALE, alreadyRealizedGain: 5000, proposedGain: 3000 });
  assert.equal(result.calculable, true);
  assert.equal(result.roomInCurrentBracket, 1000);
  assert.equal(result.withinBracket, false);
  assert.equal(result.suggestedAmountWithinBracket, 1000);
  assert.equal(result.excessOverBracket, 2000);
});

test("con una base ya en el último tramo (abierto), no hay límite superior que informar", () => {
  const result = Estimator.optimizePartialSale({ scale: SAVINGS_SCALE, alreadyRealizedGain: 60000, proposedGain: 5000 });
  assert.equal(result.calculable, true);
  assert.equal(result.currentBracketRatePct, 23);
  assert.equal(result.roomInCurrentBracket, null);
  assert.equal(result.withinBracket, true);
});

test("calcula el coste marginal real (progresivo), no el tipo marginal aplicado a toda la base", () => {
  const result = Estimator.optimizePartialSale({ scale: SAVINGS_SCALE, alreadyRealizedGain: 5000, proposedGain: 3000 });
  // 1000 al 19% + 2000 al 21% = 190 + 420 = 610
  assert.equal(result.marginalTax, 610);
});

test("el aviso profesional deja claro que no es una recomendación de vender", () => {
  const result = Estimator.optimizePartialSale({ scale: SAVINGS_SCALE, alreadyRealizedGain: 0, proposedGain: 1000 });
  assert.match(result.warning, /confirma el resultado con un profesional/i);
});

test("optimizePartialSale está expuesta en el motor canónico", () => {
  assert.equal(typeof Estimator.optimizePartialSale, "function");
});
