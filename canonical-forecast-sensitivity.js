(function attachCanonicalForecastSensitivity(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalForecastSensitivity = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createCanonicalForecastSensitivity() {
  "use strict";

  // PV6 — sensibilidad: qué previsión cambiaría el veredicto. No recalcula el forecast — toma el
  // mínimo ajustado ya calculado por previsionMetric() para el mes del punto delicado, junto con
  // sus dos componentes móviles (el ingreso previo a nómina y el gasto anterior al cobro), y
  // resuelve algebraicamente qué multiplicador de cada uno haría que el mínimo ajustado cruzara
  // cero — el veredicto (positivo/negativo) que el resto de la app ya usa para decidir si "hay que
  // proteger caja". Motor puro, sin DOM ni estado global.

  const SCHEMA_ID = "finance-canonical-forecast-sensitivity/v1";

  function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function round2(value) {
    return Math.round((number(value) + Number.EPSILON) * 100) / 100;
  }

  // adjustedMin = base + income - expense, donde base es todo lo que no se mueve al simular un
  // cambio de ingreso o gasto (el resto de partidas ya fijas del mes). Se reconstruye a partir de
  // los tres valores que sí se conocen — el llamante no tiene por qué exponer "base" por separado.
  function verdictSensitivity(input = {}) {
    const adjustedMin = round2(input.adjustedMin);
    const income = Math.max(0, round2(input.income));
    const expense = Math.max(0, round2(input.expense));
    const base = round2(adjustedMin - income + expense);
    const verdict = adjustedMin >= 0 ? "safe" : "danger";

    // Multiplicador de ingreso que anularía el mínimo ajustado, manteniendo el gasto igual:
    // base + income·x - expense = 0  →  x = (expense - base) / income.
    let incomeDropPercent = null;
    let incomeThreshold = null;
    if (income > 0) {
      const multiplier = round2((expense - base) / income);
      incomeThreshold = round2(income * multiplier);
      // Positivo: el ingreso puede caer ese % antes de romper el veredicto (verdict "safe").
      // Negativo: el ingreso necesitaría subir ese % (en valor absoluto) para dejar de estar roto
      // (verdict "danger") — el signo distingue "aguanta hasta" de "necesitarías".
      incomeDropPercent = round2((1 - multiplier) * 100);
    }

    // Multiplicador de gasto que anularía el mínimo ajustado, manteniendo el ingreso igual:
    // base + income - expense·x = 0  →  x = (base + income) / expense.
    let expenseRisePercent = null;
    let expenseThreshold = null;
    if (expense > 0) {
      const multiplier = round2((base + income) / expense);
      expenseThreshold = round2(expense * multiplier);
      expenseRisePercent = round2((multiplier - 1) * 100);
    }

    return {
      schemaId: SCHEMA_ID,
      adjustedMin,
      verdict,
      incomeDropPercent,
      incomeThreshold,
      expenseRisePercent,
      expenseThreshold,
    };
  }

  return { SCHEMA_ID, verdictSensitivity };
});
