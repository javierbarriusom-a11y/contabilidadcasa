(function attachCanonicalTariffComparator(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalTariffComparator = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createCanonicalTariffComparator() {
  "use strict";

  // A19-3 — comparador educativo de tarifas fijas frente a variables (luz, gas, cualquier tarifa con
  // precio por unidad de consumo). No trae ningún precio de mercado real — el hogar declara su
  // consumo y ambos precios, y el comparador dice cuál sale más barata este mes y, sobre todo, a qué
  // precio variable ambas costarían lo mismo (el break-even): la pregunta educativa real no es "¿cuál
  // es más barata hoy?" sino "¿cuánto tendría que subir/bajar la variable para que cambie la
  // respuesta?". Motor puro, sin DOM ni estado global, mismo patrón que canonical-life-coverage.js.

  const SCHEMA_ID = "finance-canonical-tariff-comparator/v1";

  function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function round2(value) {
    return Math.round((number(value) + Number.EPSILON) * 100) / 100;
  }

  function compareFixedVsVariableTariff(input = {}) {
    const consumption = Math.max(0, round2(input.monthlyConsumption));
    const fixedPrice = Math.max(0, round2(input.fixedPricePerUnit));
    const variablePrice = Math.max(0, round2(input.variablePricePerUnit));
    const fixedFee = Math.max(0, round2(input.fixedStandingCharge));
    const variableFee = Math.max(0, round2(input.variableStandingCharge));
    const fixedMonthlyCost = round2(consumption * fixedPrice + fixedFee);
    const variableMonthlyCost = round2(consumption * variablePrice + variableFee);
    const difference = round2(fixedMonthlyCost - variableMonthlyCost);
    return {
      schemaId: SCHEMA_ID,
      consumption,
      fixedMonthlyCost,
      variableMonthlyCost,
      difference: round2(Math.abs(difference)),
      cheaper: difference === 0 ? "tie" : difference > 0 ? "variable" : "fixed",
      // El precio variable (por unidad) al que ambas tarifas costarían lo mismo, dado el consumo y
      // los cargos fijos declarados. null sin consumo: la pregunta no tiene sentido sin unidades que
      // comparar.
      breakEvenVariablePrice: consumption > 0 ? round2((fixedMonthlyCost - variableFee) / consumption) : null,
    };
  }

  return { SCHEMA_ID, compareFixedVsVariableTariff };
});
