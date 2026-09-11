(function attachCanonicalLeverageCrossComparator(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalLeverageCrossComparator = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createCanonicalLeverageCrossComparator() {
  "use strict";

  // LEV9 (Oleada 4, Bloque 2 — bandera del diagnóstico "El Libro Vivo", F-07, sin precedente en la
  // Oleada 3): comparador cruzado de instrumentos de apalancamiento para UNA MISMA necesidad de
  // capital. LEV4 (Oleada 3) solo compara ofertas Lombard entre entidades; INV10 (Oleada 3) solo
  // compara vender vs. pedir prestado contra Lombard. Ninguno de los dos cruza los tres instrumentos
  // reales que el hogar podría usar para levantar el mismo capital: crédito con garantía de cartera
  // (lombardCreditCapacity, canonical-leverage-simulator.js), hipoteca o ampliación hipotecaria
  // (misma fórmula de cuota francesa que canonical-mortgage-rate-scenarios.js) y línea de crédito
  // (evaluateEmergencyCreditLine, canonical-emergency-credit-line.js, reutilizada aquí con el propio
  // importe necesitado como "suelo" a cubrir en vez del suelo del colchón — misma fórmula, otro
  // propósito). No reimplementa ninguna fórmula de coste: solo alimenta los motores existentes con
  // la misma necesidad de capital y compone el resultado, señalando además qué guardarraíl aplica a
  // cada instrumento — AP4 no cubre Lombard (garantía real, perfil de riesgo distinto, ya documentado
  // en canonical-leverage-simulator.js); LEV1 sí incluye el techo total de apalancamiento para los
  // tres instrumentos, pero no sustituye unas condiciones mínimas propias de Lombard, que hoy no
  // existen — este motor solo deja constancia de ese hueco, no lo cierra. Motor puro, sin DOM ni
  // estado global: nunca decide ni ejecuta nada, mismo contrato que AP3/A11-4.

  const SCHEMA_ID = "finance-canonical-leverage-cross-comparator/v1";

  const WARNING =
    "Comparación de coste financiero con los supuestos que tú has declarado, nunca garantizados. " +
    "No es una recomendación de pedir deuda por ninguno de los tres instrumentos: acepta o descarta " +
    "esta lectura tú, y verifica cualquier decisión real con un profesional.";

  function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function round2(value) {
    return Math.round((number(value) + Number.EPSILON) * 100) / 100;
  }

  // Cuota francesa estándar — misma fórmula que canonical-mortgage-rate-scenarios.js/monthlyPayment
  // y canonical-debt-comparator.js/amortizedMonthlyPayment, duplicada aquí a propósito: mismo
  // criterio de autonomía entre motores canónicos que ya sigue el resto del repositorio (DI5).
  function amortizedMonthlyPayment(principal, annualRatePct, months) {
    const p = Math.max(0, round2(principal));
    const n = Math.max(1, Math.round(number(months)));
    const monthlyRate = number(annualRatePct) / 100 / 12;
    if (p <= 0) return 0;
    if (monthlyRate === 0) return round2(p / n);
    const factor = Math.pow(1 + monthlyRate, n);
    return round2((p * monthlyRate * factor) / (factor - 1));
  }

  function lombardInstrument(amount, months, lombard, lombardEngine) {
    const input = lombard || {};
    const capacityResult = lombardEngine.lombardCreditCapacity({
      portfolioValue: input.portfolioValue,
      ltvPct: input.ltvPct,
      annualRatePct: input.annualRatePct,
    });
    if (!capacityResult.calculable) {
      return { id: "lombard", label: "Crédito con garantía de cartera (Lombard)", available: false, reason: "missing-inputs" };
    }
    const feasible = capacityResult.capacity >= amount;
    return {
      id: "lombard",
      label: "Crédito con garantía de cartera (Lombard)",
      available: true,
      feasible,
      capacity: capacityResult.capacity,
      shortfall: feasible ? 0 : round2(amount - capacityResult.capacity),
      annualRatePct: capacityResult.annualRatePct,
      totalCost: round2(capacityResult.annualCost * (months / 12)),
      ap4Applies: false,
      lev1Applies: true,
      guardrailNote: "Fuera del guardarraíl AP4 (garantía real, perfil de riesgo distinto) — sin condiciones mínimas propias equivalentes a AP4 todavía; solo el techo total de LEV1 le aplica.",
    };
  }

  function mortgageInstrument(amount, months, mortgage) {
    const input = mortgage || {};
    const rate = number(input.annualRatePct, NaN);
    if (!(amount > 0) || !Number.isFinite(rate) || rate < 0) {
      return { id: "mortgage", label: "Hipoteca o ampliación hipotecaria", available: false, reason: "missing-inputs" };
    }
    const monthly = amortizedMonthlyPayment(amount, rate, months);
    const totalCost = round2(monthly * Math.max(1, Math.round(months)) - amount);
    return {
      id: "mortgage",
      label: "Hipoteca o ampliación hipotecaria",
      available: true,
      feasible: true,
      capacity: null,
      shortfall: 0,
      annualRatePct: round2(rate),
      totalCost,
      ap4Applies: true,
      lev1Applies: true,
      guardrailNote: "Sujeta al guardarraíl de condiciones mínimas (AP4) y al techo total de apalancamiento (LEV1).",
    };
  }

  function creditLineInstrument(amount, months, creditLine, creditLineEngine) {
    const input = creditLine || {};
    const limit = number(input.limit);
    if (!(limit > 0)) {
      return { id: "credit-line", label: "Línea de crédito", available: false, reason: "missing-inputs" };
    }
    const result = creditLineEngine.evaluateEmergencyCreditLine(amount, limit, input.annualRatePct, months);
    return {
      id: "credit-line",
      label: "Línea de crédito",
      available: true,
      feasible: result.covered,
      capacity: result.creditLimit,
      shortfall: result.gap,
      annualRatePct: result.creditRate,
      totalCost: result.estimatedDrawCost,
      ap4Applies: true,
      lev1Applies: true,
      guardrailNote: "Sujeta al guardarraíl de condiciones mínimas (AP4) y al techo total de apalancamiento (LEV1).",
    };
  }

  function crossInstrumentLeverageComparison({
    amount, months, lombard, mortgage, creditLine, barrierResult, leveragePolicy, lombardEngine, creditLineEngine,
  } = {}) {
    const need = Math.max(0, round2(amount));
    const horizonMonths = Math.max(1, Math.round(number(months)));
    if (!(need > 0)) return { schemaId: SCHEMA_ID, calculable: false, reason: "missing-amount" };
    if (!lombardEngine || !creditLineEngine) return { schemaId: SCHEMA_ID, calculable: false, reason: "missing-engines" };

    const instruments = [
      lombardInstrument(need, horizonMonths, lombard, lombardEngine),
      mortgageInstrument(need, horizonMonths, mortgage),
      creditLineInstrument(need, horizonMonths, creditLine, creditLineEngine),
    ];
    const evaluated = instruments.filter((item) => item.available);
    const feasible = evaluated.filter((item) => item.feasible);
    const ranked = [...feasible].sort((a, b) => a.totalCost - b.totalCost);
    const cheapest = ranked[0] || null;
    const barrierValid = barrierResult && typeof barrierResult === "object" ? barrierResult.valid === true : null;
    const policyWithinLimit = leveragePolicy && leveragePolicy.calculable ? leveragePolicy.withinLimit : null;

    return {
      schemaId: SCHEMA_ID,
      calculable: true,
      amount: need,
      months: horizonMonths,
      instruments,
      evaluatedCount: evaluated.length,
      feasibleCount: feasible.length,
      cheapestId: cheapest ? cheapest.id : null,
      cheapestLabel: cheapest ? cheapest.label : null,
      barrierValid,
      policyWithinLimit,
      warning: WARNING,
    };
  }

  return { SCHEMA_ID, crossInstrumentLeverageComparison };
});
