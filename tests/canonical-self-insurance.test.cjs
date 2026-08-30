const test = require("node:test");
const assert = require("node:assert/strict");
const SelfInsurance = require("../canonical-self-insurance.js");

// SP4 · Bloque 5: autoseguro vs. comprar seguro para riesgos pequeños. cushionFloor() es un gate
// duro: un golpe que rompería el suelo protegido se asegura siempre, sin importar la prima.

test("evaluateSelfInsurance · un golpe mayor que el suelo protegido, recomienda seguro pase lo que pase con la prima", () => {
  const result = SelfInsurance.evaluateSelfInsurance({ potentialLoss: 5000, annualPremium: 20, cushionFloorValue: 1000, probabilityPercent: 1 });
  assert.equal(result.affordableWithinCushion, false);
  assert.equal(result.recommendation, "insure");
});

test("evaluateSelfInsurance · golpe absorbible y prima cara frente al coste esperado, recomienda autoseguro", () => {
  // pérdida 300€, probabilidad 5% → coste esperado 15€/año; prima 60€/año es mucho más cara
  const result = SelfInsurance.evaluateSelfInsurance({ potentialLoss: 300, annualPremium: 60, cushionFloorValue: 2000, probabilityPercent: 5 });
  assert.equal(result.affordableWithinCushion, true);
  assert.equal(result.expectedAnnualLoss, 15);
  assert.equal(result.recommendation, "self-insure");
  assert.equal(result.premiumMarkupPercent, 300); // (60-15)/15 × 100
});

test("evaluateSelfInsurance · golpe absorbible pero prima barata frente al coste esperado, recomienda seguro", () => {
  // pérdida 300€, probabilidad 30% → coste esperado 90€/año; prima 40€/año es más barata
  const result = SelfInsurance.evaluateSelfInsurance({ potentialLoss: 300, annualPremium: 40, cushionFloorValue: 2000, probabilityPercent: 30 });
  assert.equal(result.recommendation, "insure");
});

test("evaluateSelfInsurance · sin probabilidad declarada, no fabrica una recomendación", () => {
  const result = SelfInsurance.evaluateSelfInsurance({ potentialLoss: 300, annualPremium: 40, cushionFloorValue: 2000 });
  assert.equal(result.expectedAnnualLoss, null);
  assert.equal(result.recommendation, "unknown");
  assert.equal(result.breakEvenYears, 7.5); // sigue pudiendo decir los años de prima, sin necesitar probabilidad
});

test("evaluateSelfInsurance · probabilidad null explícito (no solo ausente) tampoco se lee como cero", () => {
  // Number(null) es 0, no NaN — probabilityPercent: null debe tratarse igual que "ausente", nunca
  // como "probabilidad cero" (mismo bugfix que clamp01 en canonical-health-score.js).
  const result = SelfInsurance.evaluateSelfInsurance({ potentialLoss: 300, annualPremium: 40, cushionFloorValue: 2000, probabilityPercent: null });
  assert.equal(result.probability, null);
  assert.equal(result.expectedAnnualLoss, null);
  assert.equal(result.recommendation, "unknown");
});

test("evaluateSelfInsurance · sin suelo de colchón conocido, la asequibilidad es desconocida, no falsa", () => {
  const result = SelfInsurance.evaluateSelfInsurance({ potentialLoss: 300, annualPremium: 40 });
  assert.equal(result.affordableWithinCushion, null);
});

test("evaluateSelfInsurance · sin prima, no fabrica un break-even sobre cero", () => {
  const result = SelfInsurance.evaluateSelfInsurance({ potentialLoss: 300, cushionFloorValue: 2000 });
  assert.equal(result.breakEvenYears, null);
});
