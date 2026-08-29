/**
 * canonical-joint-restructuring.js
 *
 * DI5: reestructuración conjunta ante una caída de ingresos. A diferencia de comparar una deuda a
 * la vez, mira TODOS los contratos activos juntos frente al ingreso reducido, y propone en qué
 * orden aliviarlos (el tipo más caro primero) hasta cubrir el alivio que hace falta para volver a
 * un ratio de deuda/ingresos sostenible.
 *
 * Ningún cálculo nuevo de amortización: la misma cuota francesa estándar que ya usa DI1
 * (canonical-mortgage-rate-scenarios.js) — módulo independiente a propósito, mismo criterio de
 * autonomía que el resto de motores canónicos de este proyecto (ninguno depende de otro).
 */

(function attachJointRestructuring(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalJointRestructuring = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function jointRestructuringFactory() {
  "use strict";

  const DEFAULT_SAFE_RATIO = 0.35;
  const EXTENSION_FACTOR = 1.5;

  function number(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  function round2(value) {
    return Math.round((number(value) + Number.EPSILON) * 100) / 100;
  }

  function monthlyPayment(principal, annualRatePercent, months) {
    const p = Math.max(0, number(principal));
    const n = Math.max(1, Math.round(number(months)));
    const monthlyRate = number(annualRatePercent) / 100 / 12;
    if (p <= 0) return 0;
    if (monthlyRate === 0) return round2(p / n);
    const factor = Math.pow(1 + monthlyRate, n);
    return round2((p * monthlyRate * factor) / (factor - 1));
  }

  // Alarga el plazo un EXTENSION_FACTOR (50% más meses) para bajar la cuota — la propuesta más
  // simple y menos lesiva (no toca el tipo ni el capital, solo reparte el pago en más tiempo).
  function restructureContract(contract) {
    const currentMonths = Math.max(1, Math.round(number(contract.monthsRemaining)));
    const extendedMonths = Math.round(currentMonths * EXTENSION_FACTOR);
    const currentMonthlyPayment = round2(contract.monthlyPayment);
    const newMonthlyPayment = monthlyPayment(contract.balance, contract.rate, extendedMonths);
    return {
      id: contract.id, label: contract.label, action: "alargar plazo",
      currentMonths, extendedMonths, currentMonthlyPayment, newMonthlyPayment,
      relief: round2(Math.max(0, currentMonthlyPayment - newMonthlyPayment)),
    };
  }

  function unchangedContract(contract) {
    const currentMonthlyPayment = round2(contract.monthlyPayment);
    return {
      id: contract.id, label: contract.label, action: "sin cambios",
      currentMonthlyPayment, newMonthlyPayment: currentMonthlyPayment, relief: 0,
    };
  }

  function jointRestructuringPlan(input = {}) {
    const contracts = (Array.isArray(input.contracts) ? input.contracts : []).filter((contract) => number(contract.monthlyPayment) > 0);
    const monthlyIncome = Math.max(0, number(input.monthlyIncome));
    const safeRatio = number(input.safeRatio) > 0 ? number(input.safeRatio) : DEFAULT_SAFE_RATIO;
    const currentTotalPayment = round2(contracts.reduce((sum, contract) => sum + number(contract.monthlyPayment), 0));
    const currentRatio = monthlyIncome > 0 ? round2(currentTotalPayment / monthlyIncome) : null;
    const maxSustainablePayment = round2(monthlyIncome * safeRatio);
    const overBudget = currentRatio !== null && currentRatio > safeRatio;
    const reliefNeeded = round2(Math.max(0, currentTotalPayment - maxSustainablePayment));
    // El tipo más caro primero: aliviar esa deuda ahorra más intereses por cada mes de plazo que se
    // añade, así que se prioriza antes de tocar una deuda más barata.
    const ordered = contracts.slice().sort((a, b) => number(b.rate) - number(a.rate));
    let remaining = reliefNeeded;
    const proposals = ordered.map((contract) => {
      if (remaining <= 0) return unchangedContract(contract);
      const proposal = restructureContract(contract);
      remaining = round2(Math.max(0, remaining - proposal.relief));
      return proposal;
    });
    const totalReliefAchieved = round2(proposals.reduce((sum, proposal) => sum + proposal.relief, 0));
    return {
      schemaId: "finance-di5-joint-restructuring/v1",
      currentTotalPayment, monthlyIncome, safeRatio, currentRatio, maxSustainablePayment,
      overBudget, reliefNeeded, proposals, totalReliefAchieved,
      sufficient: reliefNeeded <= 0 || totalReliefAchieved >= reliefNeeded,
    };
  }

  return { DEFAULT_SAFE_RATIO, EXTENSION_FACTOR, monthlyPayment, jointRestructuringPlan };
});
