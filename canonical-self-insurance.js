(function attachCanonicalSelfInsurance(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalSelfInsurance = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createCanonicalSelfInsurance() {
  "use strict";

  // SP4 — autoseguro vs. comprar seguro para riesgos pequeños. Usa cushionFloor() (canonical-
  // cushion.js) como referencia, igual que SP5 (deducible óptimo): un golpe que el colchón no puede
  // absorber sin caer bajo el suelo protegido se asegura siempre, pase lo que pase con la prima —
  // eso es un gate duro, no una comparación de coste. Solo por debajo de ese suelo entra en juego
  // la economía de la prima: con una probabilidad anual declarada, compara el coste esperado de
  // autoasegurarse contra la prima; sin probabilidad, no fabrica una recomendación — se limita a
  // decir cuántos años de prima equivalen al golpe potencial, para que el hogar juzgue.

  const SCHEMA_ID = "finance-canonical-self-insurance/v1";

  function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function round2(value) {
    return Math.round((number(value) + Number.EPSILON) * 100) / 100;
  }

  function evaluateSelfInsurance(input = {}) {
    const potentialLoss = Math.max(0, round2(input.potentialLoss));
    const annualPremium = Math.max(0, round2(input.annualPremium));
    const cushionFloorValue = Math.max(0, round2(input.cushionFloorValue));
    // Number(null) es 0, no NaN — sin este guardia explícito, "sin probabilidad declarada" se
    // leería como "probabilidad cero" y fabricaría un coste esperado de 0€ en vez de reconocer que
    // el dato simplemente no existe (mismo bugfix que clamp01 en canonical-health-score.js, A16-1).
    const hasProbability = input.probabilityPercent !== null && input.probabilityPercent !== undefined && input.probabilityPercent !== "";
    const probability = hasProbability && Number.isFinite(Number(input.probabilityPercent)) && Number(input.probabilityPercent) >= 0
      ? Math.min(100, Number(input.probabilityPercent))
      : null;

    const affordableWithinCushion = cushionFloorValue > 0 ? potentialLoss <= cushionFloorValue : null;
    const breakEvenYears = annualPremium > 0 ? round2(potentialLoss / annualPremium) : null;
    const expectedAnnualLoss = probability === null ? null : round2(potentialLoss * (probability / 100));
    // Cuánto de la prima es margen del asegurador por encima del coste esperado — cuanto mayor,
    // más caro sale delegar ese riesgo concreto frente a asumirlo uno mismo.
    const premiumMarkupPercent = expectedAnnualLoss === null || expectedAnnualLoss === 0
      ? null
      : round2(((annualPremium - expectedAnnualLoss) / expectedAnnualLoss) * 100);

    let recommendation;
    if (affordableWithinCushion === false) recommendation = "insure";
    else if (expectedAnnualLoss !== null) recommendation = annualPremium > expectedAnnualLoss ? "self-insure" : "insure";
    else recommendation = "unknown";

    return {
      schemaId: SCHEMA_ID,
      potentialLoss,
      annualPremium,
      cushionFloorValue,
      probability,
      affordableWithinCushion,
      breakEvenYears,
      expectedAnnualLoss,
      premiumMarkupPercent,
      recommendation,
    };
  }

  return { SCHEMA_ID, evaluateSelfInsurance };
});
