(function attachCanonicalLeverageSimulator(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalLeverageSimulator = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createCanonicalLeverageSimulator() {
  "use strict";

  // AP3 — simulador de apalancamiento: explorar qué pasaría si se pide deuda nueva para invertirla,
  // nunca ejecutar nada. Depende de AP4 (canonical-leverage-barrier.js), a propósito: sin sus
  // condiciones mínimas verificadas (colchón por encima del suelo, deuda actual sin incidencias
  // críticas, cuota actual contenida), este motor rechaza calcular — no hay simulación de
  // apalancamiento que mostrar sin guardarraíl superado. Motor puro, sin DOM ni estado global,
  // mismo patrón que canonical-leverage-barrier.js.

  const SCHEMA_ID = "finance-canonical-leverage-simulator/v1";
  const SAVED_SCHEMA_ID = "finance-canonical-leverage-simulator-saved/v1";

  // Los tres escenarios de rentabilidad esperada (pesimista/base/optimista) los declara el hogar —
  // este motor no inventa ninguna cifra de mercado ni de rendimiento futuro, mismo criterio que
  // A15-2 con los tramos de IRPF. La lectura favorable/desfavorable de cada escenario es una
  // sugerencia que se explica con los números de abajo, nunca una orden ni una acción automática:
  // quien simula ve el desglose completo y decide si la acepta.
  const PROFESSIONAL_WARNING =
    "Exploración con los supuestos de rentabilidad que tú has declarado, nunca garantizados. " +
    "No es una recomendación de pedir deuda: la lectura que ofrece este simulador es solo eso, " +
    "una lectura — acéptala o descártala tú, y verifica cualquier decisión con un profesional.";

  function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function round2(value) {
    return Math.round((number(value) + Number.EPSILON) * 100) / 100;
  }

  function scenarioResult(label, ratePercent, debtAmount, annualDebtCost) {
    const rate = round2(number(ratePercent));
    const expectedAnnualReturn = round2(debtAmount * (rate / 100));
    const netAnnualResult = round2(expectedAnnualReturn - annualDebtCost);
    const assessment = netAnnualResult > 0 ? "favorable" : netAnnualResult < 0 ? "desfavorable" : "neutral";
    return { label, ratePercent: rate, expectedAnnualReturn, netAnnualResult, assessment };
  }

  // Sin el guardarraíl (AP4) en estado "ready" (valid === true), no se calcula nada — se devuelven
  // sus propios bloqueadores, para que quien explora sepa exactamente qué resolver antes de seguir.
  function simulateLeverage(input = {}) {
    const barrier = input.barrierResult;
    if (!barrier || typeof barrier !== "object" || barrier.valid !== true) {
      return {
        schemaId: SCHEMA_ID,
        calculable: false,
        reason: "barrier-blocked",
        blockers: Array.isArray(barrier?.blockers) ? barrier.blockers : [],
      };
    }
    const debtAmount = Math.max(0, round2(input.newDebtAmount));
    if (debtAmount <= 0) {
      return { schemaId: SCHEMA_ID, calculable: false, reason: "missing-debt-amount", blockers: [] };
    }
    const ratePercent = Math.max(0, number(input.newDebtAnnualRatePercent));
    const annualDebtCost = round2(debtAmount * (ratePercent / 100));
    const scenarios = input.expectedReturnScenarios || {};
    return {
      schemaId: SCHEMA_ID,
      calculable: true,
      evaluatedAt: new Date().toISOString(),
      newDebtAmount: debtAmount,
      newDebtAnnualRatePercent: round2(ratePercent),
      annualDebtCost,
      scenarios: {
        pessimistic: scenarioResult("Pesimista", scenarios.pessimisticPercent, debtAmount, annualDebtCost),
        base: scenarioResult("Base", scenarios.basePercent, debtAmount, annualDebtCost),
        optimistic: scenarioResult("Optimista", scenarios.optimisticPercent, debtAmount, annualDebtCost),
      },
      warning: PROFESSIONAL_WARNING,
    };
  }

  // Guarda una exploración ya calculada — nunca una decisión tomada ni algo que se ejecuta. Mismo
  // patrón que canonical-e13-scenarios.js (saveScenario): una fotografía con schemaId propio, nunca
  // una posición real de deuda ni de inversión.
  function saveScenario(result, metadata = {}) {
    return {
      schemaId: SAVED_SCHEMA_ID,
      id: String(metadata.id || `ap3-${Date.now()}`),
      name: String(metadata.name || "").trim() || "Escenario explorado",
      createdAt: new Date().toISOString(),
      result,
    };
  }

  return { SCHEMA_ID, SAVED_SCHEMA_ID, PROFESSIONAL_WARNING, simulateLeverage, saveScenario };
});
