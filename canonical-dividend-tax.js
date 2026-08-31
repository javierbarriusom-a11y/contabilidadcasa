(function attachCanonicalDividendTax(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalDividendTax = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createCanonicalDividendTax() {
  "use strict";

  // FC4 — retención de dividendos extranjeros y deducción por doble imposición internacional.
  // Regla fiscal española real: la retención practicada en origen es deducible en la cuota española
  // solo hasta el límite de lo que esa misma renta tributaría aquí (art. 80 LIRPF) — nunca la
  // retención completa. Lo que exceda ese límite es un "peaje" no recuperable sin reclamarlo aparte
  // (procedimiento de convenio con el país de origen), fuera del alcance de este núcleo. Motor puro,
  // sin DOM ni estado global, mismo patrón que canonical-home-insurance.js (SP3).

  const SCHEMA_ID = "finance-canonical-dividend-tax/v1";

  function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function round2(value) {
    return Math.round((number(value) + Number.EPSILON) * 100) / 100;
  }

  function knownPositive(value) {
    return typeof value === "number" && Number.isFinite(value) && value > 0;
  }

  // Sin importe bruto declarado o sin tipo de gravamen del ahorro declarado no hay cálculo que
  // fabricar — mismo guardia que el resto del contrato: un dato ausente nunca se lee como cero.
  function calculateDividendTax(input = {}) {
    const { grossAmount, foreignWithholdingPct, spanishSavingsRatePct } = input;
    if (!knownPositive(grossAmount) || !knownPositive(spanishSavingsRatePct)) return null;
    const foreignPct = knownPositive(foreignWithholdingPct) ? foreignWithholdingPct : 0;

    const foreignWithheld = round2((grossAmount * foreignPct) / 100);
    const spanishTaxDue = round2((grossAmount * spanishSavingsRatePct) / 100);
    // Deducción por doble imposición internacional: lo menor entre lo retenido fuera y lo que esa
    // renta tributaría en España — nunca más, aunque la retención de origen haya sido mayor.
    const creditableForeignTax = round2(Math.min(foreignWithheld, spanishTaxDue));
    const additionalSpanishTax = round2(spanishTaxDue - creditableForeignTax);
    const excessForeignWithholding = round2(foreignWithheld - creditableForeignTax);
    const netAmount = round2(grossAmount - foreignWithheld - additionalSpanishTax);

    return {
      schemaId: SCHEMA_ID,
      grossAmount: round2(grossAmount),
      foreignWithholdingPct: foreignPct,
      spanishSavingsRatePct,
      foreignWithheld,
      spanishTaxDue,
      creditableForeignTax,
      additionalSpanishTax,
      excessForeignWithholding,
      netAmount,
    };
  }

  return { SCHEMA_ID, calculateDividendTax };
});
