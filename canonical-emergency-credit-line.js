(function attachCanonicalEmergencyCreditLine(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalEmergencyCreditLine = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createCanonicalEmergencyCreditLine() {
  "use strict";

  // DI2 — línea de crédito de emergencia frente a colchón líquido. Compara el colchón operativo de
  // referencia (el mismo suelo que ya usan Plan y el mapa de calor, vía cushionFloor) con el límite
  // de una línea de crédito de emergencia: si la línea cubre el colchón entero, ¿cuánto costaría en
  // intereses tener que disponer de ella de verdad, frente a mantener ese dinero inmovilizado sin
  // rendimiento? Motor puro, sin DOM ni estado global, mismo patrón que canonical-life-coverage.js.

  const SCHEMA_ID = "finance-canonical-emergency-credit-line/v1";

  // Meses de disposición asumidos para estimar el coste si la línea llegara a usarse de verdad: ni
  // "un mes" (subestima una emergencia real, que rara vez se resuelve en 30 días) ni "un año entero"
  // (sobrestima; una línea de emergencia se piensa para amortizar rápido, no como deuda a largo
  // plazo). Exportado para que quien lo use pueda citar la cifra, no solo el resultado.
  const DEFAULT_DRAW_MONTHS = 3;

  function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function round2(value) {
    return Math.round((number(value) + Number.EPSILON) * 100) / 100;
  }

  function evaluateEmergencyCreditLine(cushionFloor, creditLimit, creditRate, drawMonths = DEFAULT_DRAW_MONTHS) {
    const floor = round2(Math.max(0, number(cushionFloor)));
    const limit = round2(Math.max(0, number(creditLimit)));
    const rate = round2(Math.max(0, number(creditRate)));
    const months = Math.max(0, number(drawMonths, DEFAULT_DRAW_MONTHS));
    // Sin colchón de referencia (reserva operativa sin configurar) no hay nada que comparar: null,
    // no un "false" que fingiría una brecha inventada.
    if (floor <= 0) {
      return { schemaId: SCHEMA_ID, cushionFloor: 0, creditLimit: limit, creditRate: rate, drawMonths: months, covered: null, gap: null, estimatedDrawCost: null, coverageRatio: null };
    }
    const gap = round2(Math.max(0, floor - limit));
    const drawnAmount = Math.min(floor, limit);
    return {
      schemaId: SCHEMA_ID,
      cushionFloor: floor,
      creditLimit: limit,
      creditRate: rate,
      drawMonths: months,
      covered: gap === 0,
      gap,
      estimatedDrawCost: round2(drawnAmount * (rate / 100) * (months / 12)),
      coverageRatio: round2(limit / floor),
    };
  }

  return { SCHEMA_ID, DEFAULT_DRAW_MONTHS, evaluateEmergencyCreditLine };
});
