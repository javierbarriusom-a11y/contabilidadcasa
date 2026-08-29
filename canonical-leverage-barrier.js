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

  return { SCHEMA_ID, DEBT_SERVICE_RATIO_LIMIT, evaluateLeverageBarrier };
});
