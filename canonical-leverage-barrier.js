(function attachCanonicalLeverageBarrier(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalLeverageBarrier = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createCanonicalLeverageBarrier() {
  "use strict";

  // AP4 — guardarraíl de seguridad para el bloque de apalancamiento (AP1-AP6), el único punto del
  // backlog donde la app pasaría de comparar decisiones a sugerir tomar deuda nueva. Se construye
  // antes que el simulador que lo consumirá (AP3): sin condiciones mínimas verificadas, no hay
  // simulación de apalancamiento que mostrar. Motor puro, sin DOM ni estado global, igual que
  // canonical-commit-barrier.js.

  const SCHEMA_ID = "finance-canonical-leverage-barrier/v1";

  // Umbral prudente: por encima de este porcentaje del ingreso mensual neto ya comprometido en
  // cuotas de deuda existente, sumar deuda nueva para invertir no se considera razonable. No es un
  // límite legal ni bancario, es el criterio conservador de este guardarraíl.
  const DEBT_SERVICE_RATIO_LIMIT = 0.35;

  function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function round2(value) {
    return Math.round((number(value) + Number.EPSILON) * 100) / 100;
  }

  function issue(id, level, title, detail) {
    return { id, level, title, detail };
  }

  function evaluateCushion(input, blockers, checks) {
    const cushion = input.cushion;
    const value = cushion ? Number(cushion.value) : NaN;
    const floor = cushion ? Number(cushion.floor) : NaN;
    if (!Number.isFinite(value) || !Number.isFinite(floor)) {
      blockers.push(issue(
        "cushion-missing",
        "blocker",
        "Colchón de emergencia sin calcular",
        "Calcula el colchón de emergencia (cushionFloor) antes de explorar apalancamiento.",
      ));
      return;
    }
    const passed = value >= floor;
    checks.push({ id: "cushion-floor", label: "Colchón de emergencia por encima del suelo", passed });
    if (!passed) {
      blockers.push(issue(
        "cushion-below-floor",
        "blocker",
        "El colchón de emergencia no llega al suelo",
        `El colchón actual (${value.toFixed(2)}) no llega al suelo configurado (${floor.toFixed(2)}). Sin ese margen, pedir deuda nueva para invertir no es prudente.`,
      ));
    }
  }

  function evaluateDebtQuality(input, blockers, checks) {
    const issues = Array.isArray(input.debtQualityIssues) ? input.debtQualityIssues : [];
    const critical = issues.filter((entry) =>
      ["error", "critical"].includes(String(entry?.severity || entry?.level || "").toLowerCase()));
    checks.push({ id: "debt-quality", label: "Deuda existente sin incidencias críticas", passed: critical.length === 0 });
    critical.forEach((entry, index) => {
      blockers.push(issue(
        `debt-quality-${index}`,
        "blocker",
        "Incidencia crítica en la deuda existente",
        String(entry?.message || entry?.detail || "Resuelve la incidencia antes de considerar deuda nueva."),
      ));
    });
  }

  function evaluateDebtServiceRatio(input, blockers, checks) {
    const income = number(input.monthlyIncome, NaN);
    if (!Number.isFinite(income) || income <= 0) {
      blockers.push(issue(
        "income-missing",
        "blocker",
        "Ingreso mensual neto sin calcular",
        "Calcula el ingreso mensual neto antes de explorar apalancamiento.",
      ));
      return;
    }
    const service = Math.max(0, number(input.monthlyDebtService));
    const ratio = service / income;
    const passed = ratio < DEBT_SERVICE_RATIO_LIMIT;
    checks.push({
      id: "debt-service-ratio",
      label: `Cuota de deuda actual por debajo del ${Math.round(DEBT_SERVICE_RATIO_LIMIT * 100)}% del ingreso`,
      passed,
      value: ratio,
    });
    if (!passed) {
      blockers.push(issue(
        "debt-service-ratio-too-high",
        "blocker",
        "La deuda actual ya compromete demasiado ingreso",
        `Las cuotas actuales representan el ${(ratio * 100).toFixed(1)}% del ingreso mensual neto, por encima del ${Math.round(DEBT_SERVICE_RATIO_LIMIT * 100)}% que este guardarraíl considera prudente antes de sumar deuda nueva.`,
      ));
    }
  }

  function evaluateLeverageBarrier(input = {}) {
    const blockers = [];
    const warnings = [];
    const checks = [];

    evaluateCushion(input, blockers, checks);
    evaluateDebtQuality(input, blockers, checks);
    evaluateDebtServiceRatio(input, blockers, checks);

    const status = blockers.length ? "blocked" : warnings.length ? "warning" : "ready";
    return {
      schemaId: SCHEMA_ID,
      evaluatedAt: new Date().toISOString(),
      valid: blockers.length === 0,
      status,
      blockers,
      warnings,
      checks,
      summary: { blockerCount: blockers.length, warningCount: warnings.length, checkCount: checks.length },
    };
  }

  // LEV1 (Oleada 3, Bloque 2) — política de apalancamiento del hogar: un límite máximo, declarado de
  // antemano por el hogar, sobre cuánta deuda-para-invertir se permite frente a su patrimonio neto o
  // su ingreso anual — nunca un porcentaje "prudente" inventado por este motor. Guardarraíl
  // complementario a evaluateLeverageBarrier: ese exige condiciones mínimas para explorar CUALQUIER
  // deuda nueva; este limita el TOTAL acumulado (deuda ya tomada vía AP3/AP6 más lo que se esté
  // explorando ahora) frente al techo declarado. A propósito no cubre el crédito Lombard de
  // APX2/APX3: su propia nota ya deja constancia de que ese instrumento queda fuera del guardarraíl
  // general por tener garantía real y un perfil de riesgo distinto — el mismo motivo por el que APX2
  // se salta evaluateLeverageBarrier. Motor puro: nunca bloquea nada por sí solo, solo informa —
  // quien lo consuma decide si exige confirmación explícita antes de seguir.
  function evaluateLeveragePolicy({ limitPct, basis, referenceValue, currentLeverageDebt = 0, proposedAdditionalDebt = 0 } = {}) {
    const limit = Math.max(0, number(limitPct));
    const reference = Math.max(0, number(referenceValue));
    if (!(limit > 0) || !(reference > 0)) {
      return { schemaId: SCHEMA_ID, calculable: false, basis: basis || null };
    }
    const limitAmount = round2(reference * (limit / 100));
    const current = round2(Math.max(0, number(currentLeverageDebt)));
    const proposed = round2(Math.max(0, number(proposedAdditionalDebt)));
    const totalDebt = round2(current + proposed);
    const withinLimit = totalDebt <= limitAmount;
    return {
      schemaId: SCHEMA_ID,
      calculable: true,
      basis,
      limitPct: limit,
      referenceValue: reference,
      limitAmount,
      currentLeverageDebt: current,
      proposedAdditionalDebt: proposed,
      totalDebt,
      withinLimit,
      excessAmount: withinLimit ? 0 : round2(totalDebt - limitAmount),
      usedPct: limitAmount > 0 ? round2((totalDebt / limitAmount) * 100) : null,
    };
  }

  return { SCHEMA_ID, DEBT_SERVICE_RATIO_LIMIT, evaluateLeverageBarrier, evaluateLeveragePolicy };
});
