(function attachCanonicalDebtCancelOrHoldSynthesis(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalDebtCancelOrHoldSynthesis = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createCanonicalDebtCancelOrHoldSynthesis() {
  "use strict";

  // DEB9 (Oleada 4, Bloque 2 — bandera del diagnóstico "El Libro Vivo", F-10, sin precedente en la
  // Oleada 3): síntesis única "cancelar vs. mantener deuda", con las cuatro piezas siempre visibles.
  // DEB1 (Oleada 3) solo vigila si el veredicto binario de AP1 (compareAmortizeVsInvest) cambió de
  // sentido; no cruza netDebtCostAfterTax (APX1, canonical-debt-comparator.js) + waitingOptionValue
  // (DEB3, canonical-debt-comparator.js) + dimensionOptimalPrepayment (DEB2, canonical-cushion.js) +
  // liquidez real (INV7/liquidityLadder, canonical-portfolio.js) en una sola recomendación explicada.
  // No reimplementa ninguna fórmula: recibe los resultados YA calculados de esos cuatro motores (más
  // el veredicto de AP1 y el guardarraíl de colchón DLX1/amortizeCushionGuardrail) y los compone en
  // un único veredicto, mostrando siempre las cuatro cifras que lo sustentan — mismo principio que la
  // advertencia de PVC14 (Oleada 4): combinar varias piezas en una única lectura "mejorada" sin
  // enseñar de dónde sale cada parte genera falsa precisión, no mejor decisión. El colchón manda
  // primero (regla 1): sin margen tras cancelar, ninguna otra cifra puede recomendar cancelar. Nunca
  // ejecuta ni decide por el hogar — mismo contrato que A11-4.

  const SCHEMA_ID = "finance-canonical-debt-cancel-or-hold-synthesis/v1";

  function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function round2(value) {
    return Math.round((number(value) + Number.EPSILON) * 100) / 100;
  }

  function ap1Piece(ap1) {
    if (!ap1 || !ap1.calculable) return { calculable: false };
    return {
      calculable: true,
      assessment: ap1.assessment,
      amortizeSavings: ap1.amortizeSavings,
      investGain: ap1.investGain,
    };
  }

  function netDebtCostPiece(netDebtCost) {
    if (!netDebtCost || !netDebtCost.calculable) return { calculable: false };
    return {
      calculable: true,
      breakEvenAnnualReturnPct: netDebtCost.breakEvenAnnualReturnPct,
      requiredPretaxReturnPct: netDebtCost.requiredPretaxReturnPct,
      savingsTaxRatePct: netDebtCost.savingsTaxRatePct,
    };
  }

  function waitingOptionPiece(waitingOption) {
    if (!waitingOption || !waitingOption.calculable) return { calculable: false };
    return {
      calculable: true,
      waitMonths: waitingOption.waitMonths,
      waitingCost: waitingOption.waitingCost,
      liquidityRunwayMonths: waitingOption.liquidityRunwayMonths,
    };
  }

  function prepaymentDimensionPiece(prepaymentDimension) {
    if (!prepaymentDimension || !prepaymentDimension.calculable) return { calculable: false };
    return {
      calculable: true,
      amount: prepaymentDimension.amount,
      penaltyCost: prepaymentDimension.penaltyCost,
      totalCash: prepaymentDimension.totalCash,
      fullPayoff: prepaymentDimension.fullPayoff,
    };
  }

  function liquidityPiece(liquidity) {
    if (!liquidity) return { calculable: false };
    return {
      calculable: true,
      floorValue: liquidity.floorValue,
      floorCovered: liquidity.floorCovered,
      floorCoveredBy: liquidity.floorCoveredBy,
    };
  }

  function cushionGuardrailPiece(cushionGuardrail) {
    if (!cushionGuardrail) return { calculable: false };
    return {
      calculable: true,
      status: cushionGuardrail.status,
      remaining: cushionGuardrail.remaining,
      shortfall: cushionGuardrail.shortfall,
    };
  }

  function cancelOrHoldDebtSynthesis({
    ap1 = null, netDebtCost = null, waitingOption = null, prepaymentDimension = null, liquidity = null, cushionGuardrail = null,
  } = {}) {
    if (!ap1 || !ap1.calculable) return { schemaId: SCHEMA_ID, calculable: false, reason: "missing-ap1" };

    const pieces = {
      ap1: ap1Piece(ap1),
      netDebtCost: netDebtCostPiece(netDebtCost),
      waitingOption: waitingOptionPiece(waitingOption),
      prepaymentDimension: prepaymentDimensionPiece(prepaymentDimension),
      liquidity: liquidityPiece(liquidity),
      cushionGuardrail: cushionGuardrailPiece(cushionGuardrail),
    };

    // Regla 1: el colchón manda. Sin margen tras cancelar (DLX1 en "insostenible"), ninguna otra
    // pieza puede recomendar cancelar — ni el veredicto financiero de AP1 ni el coste de esperar.
    if (pieces.cushionGuardrail.calculable && pieces.cushionGuardrail.status === "insostenible") {
      return {
        schemaId: SCHEMA_ID,
        calculable: true,
        verdict: "no-cancelar-ahora",
        liquidityCaution: false,
        headline: `Cancelar ahora dejaría el colchón de emergencia por debajo de su suelo (faltarían ${round2(pieces.cushionGuardrail.shortfall)}€) — ninguna otra cifra de esta síntesis cambia esa prioridad.`,
        pieces,
      };
    }

    // Regla 2: la escalera de liquidez real (INV7) puede contradecir un colchón "sostenible" en
    // balance total si el dinero que en teoría lo cubre no está disponible a tiempo de verdad.
    const liquidityCaution = pieces.liquidity.calculable && pieces.liquidity.floorCovered === false;

    const verdict = ap1.assessment === "amortizar" ? "cancelar" : ap1.assessment === "invertir" ? "mantener" : "revisar";

    const parts = [];
    if (verdict === "cancelar") {
      parts.push(`AP1: cancelar ahorra ${round2(ap1.amortizeSavings)}€ frente a invertir ese importe.`);
    } else if (verdict === "mantener") {
      parts.push(`AP1: invertir ese importe generaría ${round2(ap1.investGain)}€ frente a cancelar.`);
    } else {
      parts.push("AP1: sin veredicto financiero claro (empate o rentabilidad de cartera no calculable).");
    }
    if (pieces.netDebtCost.calculable) {
      parts.push(`Ajustado por fiscalidad (APX1): la inversión necesitaría rendir al menos ${pieces.netDebtCost.requiredPretaxReturnPct}% anual antes de impuestos para batir de verdad el coste de esta deuda.`);
    }
    if (pieces.waitingOption.calculable) {
      parts.push(`Esperar (DEB3): posponer ${pieces.waitingOption.waitMonths} mes(es) esta decisión cuesta con seguridad ${round2(pieces.waitingOption.waitingCost)}€ de interés no evitado.`);
    }
    if (pieces.prepaymentDimension.calculable) {
      parts.push(`Importe dimensionado (DEB2): ${round2(pieces.prepaymentDimension.amount)}€${pieces.prepaymentDimension.fullPayoff ? " (liquida la deuda entera)" : ""}, más ${round2(pieces.prepaymentDimension.penaltyCost)}€ de comisión.`);
    }
    if (liquidityCaution) {
      parts.push(`Aviso de liquidez (INV7): el suelo del colchón no queda cubierto por tramos de liquidez inmediata o corta todavía, aunque el balance total sea suficiente.`);
    }

    return {
      schemaId: SCHEMA_ID,
      calculable: true,
      verdict,
      liquidityCaution,
      headline: parts.join(" "),
      pieces,
    };
  }

  return { SCHEMA_ID, cancelOrHoldDebtSynthesis };
});
