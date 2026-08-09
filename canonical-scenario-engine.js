(function attachCanonicalScenarioEngine(root, factory) {
  const Schema = typeof module === "object" && module.exports ? require("./canonical-scenario-schema.js") : root?.FinanceCanonicalScenarioSchema;
  const api = factory(Schema);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalScenarioEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function canonicalScenarioEngineFactory(Schema) {
  "use strict";

  // ---------------------------------------------------------------------------------------------
  // Día 1 de E20-0: resolución de decisiones sobre el estado de las deudas (canonical-debt-contracts).
  // No compone todavía la serie mensual del forecast (canonical-engine) — eso es el día 2, cuando el
  // efecto cascada (C040/C041) se prueba de extremo a extremo. Este módulo cubre, verificable hoy:
  //   - I-05 (neutralidad de inactivas): una decisión con activa:false no se resuelve ni muta estado.
  //   - I-06 (conmutatividad de independientes): dos decisiones sobre deudas distintas, sin
  //     dependeDe entre ellas, producen el mismo estado final de deudas sea cual sea su `orden`.
  //   - Conflictos bloqueantes (C042, C043): una decisión sobre una deuda ya cerrada por OTRA
  //     decisión de este mismo escenario se rechaza explícitamente, nunca calcula un número
  //     silenciosamente incorrecto.
  //   - Reunificación (C005): construida de cero, no es una migración de código existente.
  // I-09 (escenario vacío ≡ Plan canónico) queda pendiente hasta que este módulo componga la serie
  // mensual del forecast — no se cierra por omisión.
  // ---------------------------------------------------------------------------------------------

  const SCHEMA_ID = "finance-e20-scenario-engine/v1";

  // Los cinco tipos de decisión de deuda que E19_INFORME_FINAL.md §4 confirma en paridad exacta
  // hoy entre el motor heredado y el canónico, más reunificación (construida de cero, no migrada).
  const DEBT_DECISION_TYPES = Object.freeze([
    "amortizacion", "refinanciacion", "retomar_pagos", "acuerdo_quita", "reunificacion",
  ]);

  function number(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function round2(value) {
    return Math.round((number(value) + Number.EPSILON) * 100) / 100;
  }

  function isPlainObject(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
  }

  function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  function decisionTargets(decision) {
    if (decision.tipo === "reunificacion") {
      return Array.isArray(decision.params?.deudaIds) ? decision.params.deudaIds.slice() : [];
    }
    const id = decision.params?.deudaId;
    return id ? [id] : [];
  }

  function buildDebtState(debtContracts) {
    const state = new Map();
    (Array.isArray(debtContracts) ? debtContracts : []).forEach((contract) => {
      if (!isPlainObject(contract) || !contract.id) return;
      state.set(contract.id, { ...clone(contract), closedByDecisionId: null });
    });
    return state;
  }

  // Un objetivo es un conflicto bloqueante cuando otra decisión de ESTE escenario ya lo cerró
  // (§2.3 regla 3 del modelo de Escenario). Una deuda que ya estaba cerrada al importar el
  // escenario no es un conflicto ENTRE decisiones — es un objetivo inválido, y se distingue con un
  // código propio para no confundir ambos casos en la interfaz.
  function checkTargets(targets, debtState) {
    for (const deudaId of targets) {
      const contract = debtState.get(deudaId);
      if (!contract) return { code: "deuda-desconocida", deudaId };
      if (contract.closedByDecisionId) return { code: "conflicto-bloqueante", deudaId, cerradaPor: contract.closedByDecisionId };
      if ((contract.paymentStatus === "settled" || contract.paymentStatus === "reunified")) {
        return { code: "deuda-ya-cerrada", deudaId };
      }
    }
    return null;
  }

  function closeContract(contract, decisionId) {
    contract.currentPrincipal = 0;
    contract.currentPayment = 0;
    contract.remainingInstallments = 0;
    contract.paymentStatus = "settled";
    contract.closedByDecisionId = decisionId;
  }

  function applyAmortizacion(decision, debtState) {
    const contract = debtState.get(decision.params.deudaId);
    const importe = number(decision.params.importe);
    const parcial = decision.params.parcial === true;
    if (!parcial && importe >= contract.currentPrincipal) {
      closeContract(contract, decision.id);
      return { resultado: "aplicada", efecto: "cierre-total" };
    }
    contract.currentPrincipal = round2(Math.max(0, contract.currentPrincipal - importe));
    if (contract.currentPrincipal <= 0) {
      closeContract(contract, decision.id);
      return { resultado: "aplicada", efecto: "cierre-total" };
    }
    return { resultado: "aplicada", efecto: "amortizacion-parcial" };
  }

  function applyRefinanciacion(decision, debtState) {
    const contract = debtState.get(decision.params.deudaId);
    contract.currentPrincipal = round2(number(decision.params.nuevoPrincipal));
    contract.currentPayment = round2(number(decision.params.nuevaCuota));
    contract.apr = number(decision.params.nuevoTIN);
    contract.remainingInstallments = Math.max(0, Math.floor(number(decision.params.nuevoPlazo)));
    contract.paymentStatus = "active";
    return { resultado: "aplicada", efecto: "refinanciada" };
  }

  function applyRetomarPagos(decision, debtState) {
    const contract = debtState.get(decision.params.deudaId);
    if (contract.paymentStatus !== "suspended") {
      return { resultado: "rechazada", motivo: "deuda-no-suspendida" };
    }
    contract.paymentStatus = "active";
    contract.currentPayment = round2(number(decision.params.cuota));
    return { resultado: "aplicada", efecto: "pagos-reanudados" };
  }

  function applyAcuerdoQuita(decision, debtState) {
    const contract = debtState.get(decision.params.deudaId);
    closeContract(contract, decision.id);
    contract.settlementAmount = round2(number(decision.params.importePactado));
    return { resultado: "aplicada", efecto: "cierre-total" };
  }

  // Nueva (no migrada, ver E19_INFORME_FINAL.md §4 y el caso dorado C005): cierra N deudas
  // existentes y abre una única cuenta nueva con el capital, cuota y plazo pactados.
  function applyReunificacion(decision, debtState) {
    const targets = decisionTargets(decision);
    const newId = `reunificada-${decision.id}`;
    targets.forEach((deudaId) => {
      const contract = debtState.get(deudaId);
      closeContract(contract, decision.id);
      contract.paymentStatus = "reunified";
      contract.reunifiedInto = newId;
    });
    debtState.set(newId, {
      id: newId,
      paymentStatus: "active",
      currentPrincipal: round2(number(decision.params.nuevoPrincipal)),
      currentPayment: round2(number(decision.params.nuevaCuota)),
      apr: number(decision.params.nuevoTIN),
      remainingInstallments: Math.max(0, Math.floor(number(decision.params.nuevoPlazo))),
      componentIds: targets.slice(),
      closedByDecisionId: null,
    });
    return { resultado: "aplicada", efecto: "reunificada", nuevaDeudaId: newId };
  }

  const APPLIERS = Object.freeze({
    amortizacion: applyAmortizacion,
    refinanciacion: applyRefinanciacion,
    retomar_pagos: applyRetomarPagos,
    acuerdo_quita: applyAcuerdoQuita,
    reunificacion: applyReunificacion,
  });

  function resolveDecision(decision, debtState) {
    if (!DEBT_DECISION_TYPES.includes(decision.tipo)) {
      return { id: decision.id, tipo: decision.tipo, resultado: "tipo-no-soportado-aun" };
    }
    const targets = decisionTargets(decision);
    if (!targets.length) {
      return { id: decision.id, tipo: decision.tipo, resultado: "rechazada", motivo: "sin-objetivo" };
    }
    const conflict = checkTargets(targets, debtState);
    if (conflict) {
      return { id: decision.id, tipo: decision.tipo, resultado: conflict.code, objetivos: targets, ...conflict };
    }
    const outcome = APPLIERS[decision.tipo](decision, debtState);
    return { id: decision.id, tipo: decision.tipo, objetivos: targets, ...outcome };
  }

  // Punto de entrada del día 1: resuelve únicamente el estado de las deudas, en el orden real de
  // ejecución (canonical-scenario-schema.resolveExecutionOrder), filtrando antes las decisiones
  // inactivas (I-05) y deteniendo cualquier decisión que choque con otra ya resuelta (C042/C043).
  // No compone la serie mensual del forecast — ver la cabecera del módulo.
  function resolveDecisiones(decisiones, context = {}) {
    const todas = Array.isArray(decisiones) ? decisiones : [];
    const activas = todas.filter((decision) => isPlainObject(decision) && decision.activa !== false);
    const inactivas = todas.filter((decision) => isPlainObject(decision) && decision.activa === false);

    if (!Schema) {
      return { valid: false, reason: "missing-schema-dependency", resultados: [] };
    }
    const orderResult = Schema.resolveExecutionOrder(activas);
    if (orderResult.hasCycle) {
      return { valid: false, reason: "dependency-cycle", unresolved: orderResult.unresolved, resultados: [] };
    }

    const byId = new Map(activas.map((decision) => [decision.id, decision]));
    const debtState = buildDebtState(context.debtContracts);
    const resultados = orderResult.resolvedOrder.map((id) => resolveDecision(byId.get(id), debtState));
    inactivas.forEach((decision) => {
      resultados.push({ id: decision.id, tipo: decision.tipo, resultado: "inactiva" });
    });

    return {
      valid: true,
      schemaId: SCHEMA_ID,
      resolvedOrder: orderResult.resolvedOrder,
      declaredOrderMatches: orderResult.declaredOrderMatches,
      resultados,
      debtStateFinal: Array.from(debtState.values()),
    };
  }

  return {
    SCHEMA_ID,
    DEBT_DECISION_TYPES,
    resolveDecisiones,
  };
});
