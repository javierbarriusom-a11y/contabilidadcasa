/**
 * canonical-mortgage-rate-scenarios.js
 *
 * DI1: hipoteca variable → fija bajo escenarios de tipos. Mismo marco de tres escenarios que ya usa
 * el Laboratorio de escenarios (E13: base/favorable/tensión, canonical-e13-scenarios.js), aplicado
 * aquí a la variación del tipo de interés en vez de a los factores de ingreso/gasto de E13 — motor
 * distinto, misma idea de tres lecturas en vez de una. Sin ningún tipo de mercado real: el hogar
 * declara su tipo variable actual, la oferta de tipo fijo y cuánto se moverían los tipos en cada
 * escenario (con un valor de partida razonable, editable).
 */

(function attachMortgageRateScenarios(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalMortgageRateScenarios = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function mortgageRateScenariosFactory() {
  "use strict";

  const RATE_SCENARIOS = Object.freeze([
    { id: "base", label: "Base", deltaPoints: 0 },
    { id: "favorable", label: "Favorable", deltaPoints: -1 },
    { id: "stress", label: "Tensión", deltaPoints: 1.5 },
  ]);

  function number(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  function round2(value) {
    return Math.round((number(value) + Number.EPSILON) * 100) / 100;
  }

  // Cuota francesa estándar (amortización a cuota constante). Con tipo 0 la cuota es lineal
  // (principal / meses), sin dividir por cero.
  function monthlyPayment(principal, annualRatePercent, months) {
    const p = Math.max(0, number(principal));
    const n = Math.max(1, Math.round(number(months)));
    const monthlyRate = number(annualRatePercent) / 100 / 12;
    if (p <= 0) return 0;
    if (monthlyRate === 0) return round2(p / n);
    const factor = Math.pow(1 + monthlyRate, n);
    return round2((p * monthlyRate * factor) / (factor - 1));
  }

  function totalCost(principal, annualRatePercent, months) {
    return round2(monthlyPayment(principal, annualRatePercent, months) * Math.max(1, Math.round(number(months))));
  }

  function evaluateMortgageRateScenarios(input = {}) {
    const principal = Math.max(0, number(input.principal));
    const months = Math.max(1, Math.round(number(input.months)));
    const currentVariableRate = Math.max(0, number(input.currentVariableRate));
    const fixedRateOffer = Math.max(0, number(input.fixedRateOffer));
    const scenarios = RATE_SCENARIOS.map((scenario) => {
      const variableRate = Math.max(0, round2(currentVariableRate + scenario.deltaPoints));
      const variableMonthlyPayment = monthlyPayment(principal, variableRate, months);
      const variableTotalCost = totalCost(principal, variableRate, months);
      const fixedMonthlyPayment = monthlyPayment(principal, fixedRateOffer, months);
      const fixedTotalCost = totalCost(principal, fixedRateOffer, months);
      return {
        id: scenario.id, label: scenario.label, variableRate,
        variableMonthlyPayment, variableTotalCost, fixedMonthlyPayment, fixedTotalCost,
        cheaper: variableTotalCost === fixedTotalCost ? "tie" : variableTotalCost < fixedTotalCost ? "variable" : "fixed",
        difference: round2(Math.abs(variableTotalCost - fixedTotalCost)),
      };
    });
    return {
      schemaId: "finance-di1-mortgage-rate-scenarios/v1",
      principal, months, currentVariableRate, fixedRateOffer, scenarios,
    };
  }

  // APX5: coste total de refinanciar, no solo el tipo. El ahorro mensual de pasarse a fijo no basta
  // por sí solo para decidir — hay que descontar la comisión de cancelación/subrogación y los gastos
  // de novación antes de saber si compensa y en cuántos meses. Usa el escenario "base" (tipos sin
  // cambio) como referencia: es la comparación que el hogar puede verificar hoy mismo, no una
  // proyección de qué harán los tipos en el futuro. Sin ahorro mensual real (la fija no sale más
  // barata en base), el punto de equilibrio no es calculable — nunca se divide por un ahorro
  // negativo o cero, ni se inventa un plazo.
  function refinancingBreakEvenMonths(scenarios, refinancingCost) {
    const cost = Math.max(0, number(refinancingCost));
    const base = (Array.isArray(scenarios) ? scenarios : []).find((scenario) => scenario.id === "base");
    if (!base) return { calculable: false, monthlySavings: 0, cost, months: null };
    const monthlySavings = round2(base.variableMonthlyPayment - base.fixedMonthlyPayment);
    if (monthlySavings <= 0) return { calculable: false, monthlySavings, cost, months: null };
    return { calculable: true, monthlySavings, cost, months: Math.ceil(cost / monthlySavings) };
  }

  return { RATE_SCENARIOS, monthlyPayment, evaluateMortgageRateScenarios, refinancingBreakEvenMonths };
});
