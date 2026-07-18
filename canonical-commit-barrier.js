(function attachCanonicalCommitBarrier(root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalCommitBarrier = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createCanonicalCommitBarrier() {
  const SCHEMA_ID = "finance-canonical-commit-barrier/v1";
  const monthlyContexts = ["base", "active", "planned"];
  const monthlyChecks = ["finite", "accountConservation", "liquidityConservation", "continuity"];
  const dailyChecks = ["finite", "accountConservation", "dailyConservation", "continuity", "monthlyParity", "transferConservation"];
  const decisionChecks = ["monthlyConservation", "uniqueDebtTargets"];

  function asObject(value) {
    return value && typeof value === "object" ? value : null;
  }

  function issue(id, level, title, detail) {
    return { id, level, title, detail };
  }

  function invariantFor(run) {
    const candidate = asObject(run);
    return asObject(candidate?.invariants) || asObject(candidate?.validation) || candidate;
  }

  function engineLabel(kind, context) {
    if (kind === "daily") return "Motor diario";
    if (kind === "decision") return "Calendario de decisiones";
    return `Motor mensual ${context}`;
  }

  function fieldLabel(field) {
    return {
      finite: "valores finitos",
      accountConservation: "conservación entre cuentas",
      liquidityConservation: "conservación de liquidez",
      continuity: "continuidad de saldos",
      dailyConservation: "conservación diaria",
      monthlyParity: "paridad con el cálculo mensual",
      transferConservation: "neutralidad de traspasos",
      monthlyConservation: "conservación mensual de decisiones",
      uniqueDebtTargets: "una decisión por deuda",
    }[field] || field;
  }

  function evaluateRun(kind, context, run, fields, blockers, checks) {
    const invariant = invariantFor(run);
    const label = engineLabel(kind, context);
    if (!invariant) {
      blockers.push(issue(`${kind}-${context}-missing`, "blocker", `${label} sin calcular`, "Recalcula el escenario antes de sincronizar."));
      return;
    }
    const validFlag = invariant.valid ?? invariant.passed;
    if (validFlag === false) {
      blockers.push(issue(`${kind}-${context}-invalid`, "blocker", `${label} con invariantes rotas`, "El cálculo no puede publicarse hasta corregir sus diferencias."));
    }
    const sourceChecks = asObject(invariant.checks) || {};
    fields.forEach((field) => {
      const passed = sourceChecks[field] === true;
      checks.push({ id: `${kind}-${context}-${field}`, label: `${label}: ${fieldLabel(field)}`, passed });
      if (!passed) {
        blockers.push(issue(`${kind}-${context}-${field}`, "blocker", `${label}: ${fieldLabel(field)}`, "La comprobación canónica no ha superado la validación."));
      }
    });
  }

  function evaluateCommitBarrier(input = {}) {
    const blockers = [];
    const warnings = [];
    const checks = [];
    const snapshot = asObject(input.snapshot);
    if (!snapshot) {
      blockers.push(issue("state-missing", "blocker", "Estado canónico sin calcular", "Recarga el modelo antes de sincronizar."));
    }
    const qualityIssues = Array.isArray(snapshot?.quality?.issues) ? snapshot.quality.issues : [];
    qualityIssues
      .filter((entry) => ["error", "critical"].includes(String(entry?.severity || entry?.level || "").toLowerCase()))
      .forEach((entry, index) => blockers.push(issue(`state-quality-${index}`, "blocker", "Estado canónico con error", String(entry?.message || entry?.detail || "Revisa la fuente canónica."))));

    const engineRuns = asObject(input.engineRuns) || {};
    monthlyContexts.forEach((context) => evaluateRun("monthly", context, engineRuns[context], monthlyChecks, blockers, checks));
    const dailyRuns = asObject(input.dailyEngineRuns) || {};
    evaluateRun("daily", "active", dailyRuns.active, dailyChecks, blockers, checks);

    if (input.decisionRun) {
      evaluateRun("decision", "active", input.decisionRun, decisionChecks, blockers, checks);
    } else {
      warnings.push(issue("decision-missing", "warning", "Sin decisión compuesta registrada", "No hay una decisión compuesta para validar; no bloquea la sincronización."));
    }

    const ledger = asObject(input.ledgerSnapshot);
    if (!ledger) {
      warnings.push(issue("ledger-missing", "warning", "Libro mayor pendiente", "No hay un libro mayor disponible; la sincronización conserva el estado, pero no puede mostrar conciliación."));
    } else {
      const quality = asObject(ledger.quality) || {};
      const unclassified = Number(quality.unclassifiedCount || 0);
      const gaps = Number(quality.balanceGapCount || 0);
      if (unclassified > 0) warnings.push(issue("ledger-unclassified", "warning", `${unclassified} movimiento(s) sin clasificar`, "Clasifica los movimientos para mejorar la conciliación."));
      if (gaps > 0) warnings.push(issue("ledger-balance-gaps", "warning", `${gaps} diferencia(s) de saldo sin conciliar`, "Revisa los saltos de saldo antes de confiar en el histórico."));
    }

    const status = blockers.length ? "blocked" : warnings.length ? "warning" : "ready";
    return {
      schemaId: SCHEMA_ID,
      evaluatedAt: new Date().toISOString(),
      context: input.context || "unknown",
      valid: blockers.length === 0,
      status,
      blockers,
      warnings,
      checks,
      summary: { blockerCount: blockers.length, warningCount: warnings.length, checkCount: checks.length },
    };
  }

  return { SCHEMA_ID, evaluateCommitBarrier };
});
