(function attachCanonicalLeverageSustainability(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalLeverageSustainability = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createCanonicalLeverageSustainability() {
  "use strict";

  // AP6 — alerta cuando el líquido ya no sostiene la deuda de apalancamiento tomada. Depende de AP3
  // (canonical-leverage-simulator.js): la única deuda de apalancamiento que existe en la app es la
  // que el hogar exploró y guardó allí. AP3 guarda siempre una fotografía exploratoria, nunca una
  // posición real ("nunca guarda una posición real de deuda ni de inversión"), así que este motor
  // solo vigila los escenarios que el propio hogar ha marcado explícitamente como tomados
  // (`takenAt`) — el mismo tipo de hecho declarado que ya usa el resto de la app (activos en A14,
  // escalas de IRPF en A15-1), nunca una inferencia ni una acción automática. Motor puro, sin DOM ni
  // estado global, mismo patrón que canonical-leverage-barrier.js/canonical-leverage-simulator.js.

  const SCHEMA_ID = "finance-canonical-leverage-sustainability/v1";
  // Mismo margen que cushionFloorDrift (canonical-cushion.js): 20% por encima del suelo como aviso
  // temprano, ni "casi igual" ni ruido de un mes suelto.
  const EARLY_WARNING_MARGIN = 0.2;

  function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function round2(value) {
    return Math.round((number(value) + Number.EPSILON) * 100) / 100;
  }

  function takenScenariosOf(scenarios) {
    return (Array.isArray(scenarios) ? scenarios : []).filter((row) => row && row.takenAt);
  }

  function monthlyDebtServiceOf(scenario) {
    return number(scenario?.result?.annualDebtCost) / 12;
  }

  function totalMonthlyDebtService(takenScenarios) {
    return round2(takenScenarios.reduce((sum, row) => sum + monthlyDebtServiceOf(row), 0));
  }

  // Sin ningún escenario marcado como tomado, no hay nada que alertar — status "sin-deuda-tomada",
  // nunca un falso "sostenible" sobre una deuda que no existe.
  function evaluateLeverageSustainability(input = {}) {
    const takenScenarios = takenScenariosOf(input.scenarios);
    const evaluatedAt = new Date().toISOString();
    if (!takenScenarios.length) {
      return { schemaId: SCHEMA_ID, evaluatedAt, status: "sin-deuda-tomada", hasTakenDebt: false, takenCount: 0, monthlyDebtService: 0 };
    }

    const monthlyDebtService = totalMonthlyDebtService(takenScenarios);
    const takenSummary = takenScenarios.map((row) => ({
      id: row.id,
      name: row.name,
      takenAt: row.takenAt,
      monthlyDebtService: round2(monthlyDebtServiceOf(row)),
    }));

    const cushion = input.cushion || {};
    const value = number(cushion.value, NaN);
    const floor = number(cushion.floor, NaN);
    if (!Number.isFinite(value) || !Number.isFinite(floor)) {
      return {
        schemaId: SCHEMA_ID,
        evaluatedAt,
        status: "colchon-sin-calcular",
        hasTakenDebt: true,
        takenCount: takenScenarios.length,
        monthlyDebtService,
        takenScenarios: takenSummary,
      };
    }

    const earlyWarningFloor = round2(floor * (1 + EARLY_WARNING_MARGIN));
    const status = value < floor ? "insostenible" : value < earlyWarningFloor ? "ajustado" : "sostenible";
    return {
      schemaId: SCHEMA_ID,
      evaluatedAt,
      status,
      hasTakenDebt: true,
      takenCount: takenScenarios.length,
      cushionValue: round2(value),
      cushionFloor: round2(floor),
      monthlyDebtService,
      shortfall: status === "insostenible" ? round2(floor - value) : 0,
      takenScenarios: takenSummary,
    };
  }

  return { SCHEMA_ID, EARLY_WARNING_MARGIN, takenScenariosOf, evaluateLeverageSustainability };
});
