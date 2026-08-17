(function attachCanonicalScenarioEngine(root, factory) {
  const Schema = typeof module === "object" && module.exports ? require("./canonical-scenario-schema.js") : root?.FinanceCanonicalScenarioSchema;
  const Engine = typeof module === "object" && module.exports ? require("./canonical-engine.js") : root?.FinanceCanonicalEngine;
  const api = factory(Schema, Engine);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalScenarioEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function canonicalScenarioEngineFactory(Schema, Engine) {
  "use strict";

  // ---------------------------------------------------------------------------------------------
  // E20-0. Día 1: resolución de decisiones sobre el estado de las deudas (canonical-debt-contracts).
  //   - I-05 (neutralidad de inactivas): una decisión con activa:false no se resuelve ni muta estado.
  //   - I-06 (conmutatividad de independientes): dos decisiones sobre deudas distintas, sin
  //     dependeDe entre ellas, producen el mismo estado final de deudas sea cual sea su `orden`.
  //   - Conflictos bloqueantes (C042, C043): una decisión sobre una deuda ya cerrada por OTRA
  //     decisión de este mismo escenario se rechaza explícitamente, nunca calcula un número
  //     silenciosamente incorrecto.
  //   - Reunificación (C005): construida de cero, no es una migración de código existente.
  //
  // Día 2: composición de la serie mensual (`resolveEscenario`). Cada deuda tocada por una decisión
  // reemplaza su aportación a `refi` desde el mes resuelto (`planificacion.mesResuelto/mesManual`)
  // en adelante; los meses anteriores quedan intactos por construcción (delta cero). Una `compra`
  // aporta a `projectOutflow`, de golpe o financiada. El resultado se delega íntegro a
  // canonical-engine.buildRows — este módulo no reimplementa la aritmética de liquidez, solo
  // transforma la entrada según las decisiones, igual que el resto de módulos E14 envuelven en vez
  // de sustituir. Con 0 decisiones, la serie es exactamente `Engine.buildRows(context.baseInput)`
  // sin tocar nada (cierra I-09). Cuando el escenario declara `guardarrailes.saldoMinimoAbsoluto`,
  // cada decisión con efecto en la serie se comprueba contra la liquidez mínima resultante hasta ese
  // punto de la resolución — y se rechaza (`guardarril-incumplido`) si la rompe. Esto es lo que hace
  // que el orden real importe (C040 vs. C041): la misma compra financiada puede ser inviable antes
  // de amortizar una deuda y viable después, porque la cuota liberada cambia la liquidez mínima
  // disponible en ese punto de la resolución, no solo el total final.
  //
  // Día 3: las dos piezas que E19_INFORME_FINAL.md §4 recomendaba aplazar a F2/F3 por no bloquear
  // que F1 fuera útil con los otros cinco tipos — ya no aplazadas, a petición expresa del usuario.
  //   - `amortizacion_fraccionada` (C004): igual que una amortización, pero como pago mensual
  //     recurrente durante `meses` en vez de un único golpe. Si `importeMensual * meses` alcanza el
  //     principal antes de agotar `meses`, la deuda cierra anticipadamente (en el mes real en que se
  //     agota, no en el mes declarado); si no, la deuda sigue activa con el principal reducido y su
  //     cuota original intacta — la misma simplificación que ya usaba la amortización parcial.
  //   - `planificacion.modo === "optimo"` (C003, mes óptimo): busca, entre los meses del horizonte
  //     y en orden cronológico, el primero en el que la decisión pueda aplicarse sin romper
  //     `guardarrailes.saldoMinimoAbsoluto`. Es una interpretación deliberadamente limitada de
  //     «óptimo» (el primer mes viable, no el más barato ni el de mejor VAN); sin guardarraíles
  //     declarados no hay nada que buscar y se usa directamente el primer mes del horizonte. Si
  //     ningún mes es viable, se rechaza explícitamente (`sin-mes-viable`) en vez de forzar uno.
  //
  // Día 4: los tipos de decisión que no tocan deuda, fuera del alcance original de F1 pero
  // implementados a petición expresa del usuario (excepto dos, ver abajo).
  //   - `imprevisto`: gasto de golpe en `mes`, o recurrente cada `recurrenciaMeses` si se declara.
  //   - `cambio_ingreso` / `cambio_gasto`: delta mensual (importe o, para gasto, porcentaje
  //     fraccionario del gasto de ese mes) aplicado a `income`/`coreSpend` desde `mesInicio` hasta
  //     `mesFin` (o hasta el final del horizonte si no se declara `mesFin`).
  //   - `proyecto`: modalidad "hucha" reparte `importeObjetivo` en cuotas iguales desde el mes
  //     resuelto hasta `mesObjetivo`; "pago_unico" y "financiado" lo cargan de golpe en
  //     `mesObjetivo` (el esquema de `proyecto` no da plazo/cuota propios como sí hace `compra`,
  //     así que "financiado" no puede distinguirse numéricamente de "pago_unico" hoy).
  //   Los cuatro reutilizan `projectOutflow`/`income`/`coreSpend` como bucket genérico, igual que
  //   `compra`, y participan en la búsqueda de mes óptimo igual que los tipos de deuda.
  //
  //   Dos tipos siguen sin soportarse — no por pereza, por límite real del contrato de entrada de
  //   `canonical-engine`, documentado explícitamente en vez de forzar un número fabricado:
  //   - `traspaso`: mover saldo entre caixabank/mediolanum no cambia `totalLiquidity`, pero
  //     `canonical-engine.buildRows` no acepta un ajuste puntual del reparto checking/savings por
  //     mes — solo calcula `saving` a partir de la política declarada. Modelarlo bien exige ampliar
  //     el motor canónico, no este envoltorio.
  //   - `cambio_presupuesto`: un techo presupuestario es un objetivo a vigilar, no un flujo de caja;
  //     aplicarlo como si moviera `coreSpend` fabricaría un gasto que nadie ha declarado todavía.
  //
  // Simplificaciones que siguen en pie (no aplican a los seis tipos de deuda, compra, ni a los
  // cuatro de este día):
  //   - Reunificación y refinanciación no modelan comisiones como flujo de caja aparte (el campo
  //     `comisiones` existe en el esquema pero no se usa todavía).
  //   - `retomar_pagos` no recalcula duración; reutiliza `remainingInstallments` original.
  // ---------------------------------------------------------------------------------------------

  const SCHEMA_ID = "finance-e20-scenario-engine/v1";

  // Los cinco tipos de decisión de deuda que E19_INFORME_FINAL.md §4 confirma en paridad exacta
  // hoy entre el motor heredado y el canónico, más reunificación y amortización fraccionada,
  // construidas de cero (ninguna de las dos es una migración de código existente).
  const DEBT_DECISION_TYPES = Object.freeze([
    "amortizacion", "amortizacion_fraccionada", "refinanciacion", "retomar_pagos", "acuerdo_quita", "reunificacion",
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
      const base = clone(contract);
      state.set(contract.id, {
        ...base,
        closedByDecisionId: null,
        scheduleEffectiveFrom: null,
        lumpSumAt: null,
        fraccionadaAt: null,
        original: { paymentStatus: base.paymentStatus, currentPayment: number(base.currentPayment), remainingInstallments: Math.max(0, Math.floor(number(base.remainingInstallments))) },
      });
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

  // El mes en que una decisión surte efecto en la serie mensual: el ya resuelto (por el usuario en
  // modo:"manual", o por la búsqueda de mes óptimo en `resolveEscenario`, día 3) o `mesManual` si
  // `mesResuelto` no está todavía. Sin ninguno de los dos (modo:"optimo" resuelto solo con
  // `resolveDecisiones`, día 1, sin contexto de forecast), el efecto se limita al estado de la deuda.
  function resolvedMonthOf(decision) {
    return decision.planificacion?.mesResuelto || decision.planificacion?.mesManual || null;
  }

  function addMonthsToKey(monthKey, offset) {
    const match = String(monthKey || "").match(/^(\d{4})-(\d{2})/);
    if (!match) return "";
    const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1 + Math.max(0, Math.floor(offset)), 1));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  }

  function closeContract(contract, decisionId, resolvedMonth) {
    contract.currentPrincipal = 0;
    contract.currentPayment = 0;
    contract.remainingInstallments = 0;
    contract.paymentStatus = "settled";
    contract.closedByDecisionId = decisionId;
    contract.scheduleEffectiveFrom = resolvedMonth;
  }

  function applyAmortizacion(decision, debtState) {
    const contract = debtState.get(decision.params.deudaId);
    const importe = number(decision.params.importe);
    const parcial = decision.params.parcial === true;
    const resolvedMonth = resolvedMonthOf(decision);
    if (resolvedMonth) contract.lumpSumAt = { monthKey: resolvedMonth, amount: round2(importe) };
    if (!parcial && importe >= contract.currentPrincipal) {
      closeContract(contract, decision.id, resolvedMonth);
      return { resultado: "aplicada", efecto: "cierre-total" };
    }
    contract.currentPrincipal = round2(Math.max(0, contract.currentPrincipal - importe));
    if (contract.currentPrincipal <= 0) {
      closeContract(contract, decision.id, resolvedMonth);
      return { resultado: "aplicada", efecto: "cierre-total" };
    }
    return { resultado: "aplicada", efecto: "amortizacion-parcial" };
  }

  // Nueva (no migrada, caso dorado C004): pago mensual recurrente de `importeMensual` durante
  // `meses`. Si agota el principal antes de completar `meses`, la deuda cierra en el mes real en
  // que eso ocurre (no en el mes declarado, que puede ser mayor); si no, sigue activa con el
  // principal reducido y su cuota original intacta, igual que la amortización parcial.
  function applyAmortizacionFraccionada(decision, debtState) {
    const contract = debtState.get(decision.params.deudaId);
    const importeMensual = number(decision.params.importeMensual);
    const mesesDeclarados = Math.max(1, Math.floor(number(decision.params.meses)));
    const resolvedMonth = resolvedMonthOf(decision);
    const capacidadTotal = round2(importeMensual * mesesDeclarados);
    const cierraAnticipado = importeMensual > 0 && capacidadTotal >= contract.currentPrincipal;
    const mesesReales = cierraAnticipado ? Math.max(1, Math.ceil(contract.currentPrincipal / importeMensual)) : mesesDeclarados;
    if (resolvedMonth) contract.fraccionadaAt = { startMonth: resolvedMonth, monthlyAmount: importeMensual, meses: mesesReales };
    if (cierraAnticipado) {
      const lastMonth = resolvedMonth ? addMonthsToKey(resolvedMonth, mesesReales - 1) : null;
      closeContract(contract, decision.id, lastMonth);
      return { resultado: "aplicada", efecto: "cierre-total-fraccionado" };
    }
    contract.currentPrincipal = round2(Math.max(0, contract.currentPrincipal - capacidadTotal));
    return { resultado: "aplicada", efecto: "amortizacion-fraccionada-parcial" };
  }

  function applyRefinanciacion(decision, debtState) {
    const contract = debtState.get(decision.params.deudaId);
    contract.currentPrincipal = round2(number(decision.params.nuevoPrincipal));
    contract.currentPayment = round2(number(decision.params.nuevaCuota));
    contract.apr = number(decision.params.nuevoTIN);
    contract.remainingInstallments = Math.max(0, Math.floor(number(decision.params.nuevoPlazo)));
    contract.paymentStatus = "active";
    contract.scheduleEffectiveFrom = resolvedMonthOf(decision);
    return { resultado: "aplicada", efecto: "refinanciada" };
  }

  function applyRetomarPagos(decision, debtState) {
    const contract = debtState.get(decision.params.deudaId);
    if (contract.paymentStatus !== "suspended") {
      return { resultado: "rechazada", motivo: "deuda-no-suspendida" };
    }
    contract.paymentStatus = "active";
    contract.currentPayment = round2(number(decision.params.cuota));
    contract.scheduleEffectiveFrom = decision.params.mesInicio || resolvedMonthOf(decision);
    return { resultado: "aplicada", efecto: "pagos-reanudados" };
  }

  function applyAcuerdoQuita(decision, debtState) {
    const contract = debtState.get(decision.params.deudaId);
    const resolvedMonth = resolvedMonthOf(decision);
    closeContract(contract, decision.id, resolvedMonth);
    contract.settlementAmount = round2(number(decision.params.importePactado));
    if (resolvedMonth) contract.lumpSumAt = { monthKey: resolvedMonth, amount: contract.settlementAmount };
    return { resultado: "aplicada", efecto: "cierre-total" };
  }

  // Nueva (no migrada, ver E19_INFORME_FINAL.md §4 y el caso dorado C005): cierra N deudas
  // existentes y abre una única cuenta nueva con el capital, cuota y plazo pactados.
  function applyReunificacion(decision, debtState) {
    const targets = decisionTargets(decision);
    const newId = `reunificada-${decision.id}`;
    const resolvedMonth = resolvedMonthOf(decision);
    targets.forEach((deudaId) => {
      const contract = debtState.get(deudaId);
      closeContract(contract, decision.id, resolvedMonth);
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
      scheduleEffectiveFrom: resolvedMonth,
      lumpSumAt: null,
      fraccionadaAt: null,
      original: { paymentStatus: "settled", currentPayment: 0, remainingInstallments: 0 },
      __synthetic: true,
    });
    return { resultado: "aplicada", efecto: "reunificada", nuevaDeudaId: newId };
  }

  const APPLIERS = Object.freeze({
    amortizacion: applyAmortizacion,
    amortizacion_fraccionada: applyAmortizacionFraccionada,
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

  // ---------------------------------------------------------------------------------------------
  // Día 2 · composición de la serie mensual
  // ---------------------------------------------------------------------------------------------

  function cloneMonths(months) {
    return (Array.isArray(months) ? months : []).map((month) => ({ ...month }));
  }

  function monthIndexOf(months, monthKey) {
    return months.findIndex((month) => month.monthKey === monthKey);
  }

  // Aportación de una deuda a `refi` usando ÚNICAMENTE su estado original (antes de cualquier
  // decisión), desde el primer mes del horizonte. Sirve como término a restar: los meses en los que
  // una deuda tocada por una decisión seguía intacta no deben cambiar.
  function buildBaselineSchedule(original, months) {
    const schedule = new Map();
    if (original.paymentStatus !== "active") return schedule;
    const span = Math.min(months.length, original.remainingInstallments);
    for (let index = 0; index < span; index += 1) schedule.set(months[index].monthKey, round2(original.currentPayment));
    return schedule;
  }

  // Aportación final de una deuda a `refi`: original hasta (e incluyendo) el mes resuelto de la
  // última decisión que la tocó, estado post-decisión desde el mes siguiente, más cualquier importe
  // de golpe (amortización, quita) sumado sobre el mes resuelto.
  function buildContractSchedule(contract, months) {
    const changeIndex = contract.scheduleEffectiveFrom ? monthIndexOf(months, contract.scheduleEffectiveFrom) : -1;
    const schedule = new Map();
    months.forEach((month, index) => {
      const beforeOrAtChange = changeIndex < 0 || index <= changeIndex;
      if (beforeOrAtChange) {
        if (contract.original.paymentStatus === "active" && index < contract.original.remainingInstallments) {
          schedule.set(month.monthKey, round2(contract.original.currentPayment));
        }
      } else {
        const monthsSinceChange = index - changeIndex - 1;
        if (contract.paymentStatus === "active" && monthsSinceChange < contract.remainingInstallments) {
          schedule.set(month.monthKey, round2(contract.currentPayment));
        }
      }
    });
    if (contract.lumpSumAt) {
      schedule.set(contract.lumpSumAt.monthKey, round2((schedule.get(contract.lumpSumAt.monthKey) || 0) + contract.lumpSumAt.amount));
    }
    if (contract.fraccionadaAt) {
      for (let offset = 0; offset < contract.fraccionadaAt.meses; offset += 1) {
        const monthKey = addMonthsToKey(contract.fraccionadaAt.startMonth, offset);
        schedule.set(monthKey, round2((schedule.get(monthKey) || 0) + contract.fraccionadaAt.monthlyAmount));
      }
    }
    return schedule;
  }

  // Suma a `refi`, mes a mes, el delta (nuevo - original) de cada deuda tocada por al menos una
  // decisión. Una deuda intacta no aporta ningún delta: sus meses quedan exactamente como en
  // `baseMonths`, que es lo que garantiza I-09 con 0 decisiones (la función ni se llama).
  function applyDebtDeltasToMonths(months, debtState) {
    debtState.forEach((contract) => {
      if (!contract.scheduleEffectiveFrom && !contract.lumpSumAt && !contract.fraccionadaAt) return;
      const originalSchedule = buildBaselineSchedule(contract.original, months);
      const finalSchedule = buildContractSchedule(contract, months);
      months.forEach((month, index) => {
        const delta = round2((finalSchedule.get(month.monthKey) || 0) - (originalSchedule.get(month.monthKey) || 0));
        if (delta !== 0) months[index].refi = round2(number(month.refi) + delta);
      });
    });
  }

  // Una compra aporta a `projectOutflow`: de golpe si no hay financiación, o como cuota recurrente
  // desde el mes resuelto durante `financiacion.plazo` meses.
  function applyCompraToMonths(months, decision) {
    const resolvedMonth = resolvedMonthOf(decision);
    const startIndex = resolvedMonth ? monthIndexOf(months, resolvedMonth) : -1;
    if (startIndex < 0) return;
    const financiacion = decision.params.financiacion;
    if (!financiacion) {
      months[startIndex].projectOutflow = round2(number(months[startIndex].projectOutflow) + number(decision.params.importe));
      return;
    }
    const plazo = Math.max(1, Math.floor(number(financiacion.plazo)));
    const cuota = number(financiacion.cuota);
    for (let index = startIndex; index < Math.min(months.length, startIndex + plazo); index += 1) {
      months[index].projectOutflow = round2(number(months[index].projectOutflow) + cuota);
    }
  }

  // Un imprevisto aporta a `projectOutflow`: de golpe en `mes`, o repetido cada `recurrenciaMeses`
  // durante el resto del horizonte si se declara.
  function applyImprevistoToMonths(months, decision) {
    const startIndex = monthIndexOf(months, decision.params.mes);
    if (startIndex < 0) return;
    const importe = number(decision.params.importe);
    const recurrenciaMeses = decision.params.recurrenciaMeses;
    if (recurrenciaMeses === undefined || recurrenciaMeses === null) {
      months[startIndex].projectOutflow = round2(number(months[startIndex].projectOutflow) + importe);
      return;
    }
    const paso = Math.max(1, Math.floor(number(recurrenciaMeses)));
    for (let index = startIndex; index < months.length; index += paso) {
      months[index].projectOutflow = round2(number(months[index].projectOutflow) + importe);
    }
  }

  // Reparte `importeObjetivo` en cuotas iguales entre el mes resuelto y `mesObjetivo` (modalidad
  // "hucha"); "pago_unico" y "financiado" lo cargan de golpe en `mesObjetivo` (ver cabecera).
  function applyProyectoToMonths(months, decision) {
    const objetivoIndex = monthIndexOf(months, decision.params.mesObjetivo);
    if (objetivoIndex < 0) return;
    const importe = number(decision.params.importeObjetivo);
    if (decision.params.modalidad === "hucha") {
      const resolvedMonth = resolvedMonthOf(decision);
      const startIndex = Math.max(0, resolvedMonth ? monthIndexOf(months, resolvedMonth) : 0);
      if (objetivoIndex > startIndex) {
        const meses = objetivoIndex - startIndex + 1;
        const cuota = round2(importe / meses);
        for (let index = startIndex; index <= objetivoIndex; index += 1) {
          months[index].projectOutflow = round2(number(months[index].projectOutflow) + cuota);
        }
        return;
      }
    }
    months[objetivoIndex].projectOutflow = round2(number(months[objetivoIndex].projectOutflow) + importe);
  }

  function monthRangeIndices(months, mesInicio, mesFin) {
    const startIndex = monthIndexOf(months, mesInicio);
    if (startIndex < 0) return null;
    const declaredEndIndex = mesFin ? monthIndexOf(months, mesFin) : months.length - 1;
    const endIndex = declaredEndIndex < 0 ? months.length - 1 : declaredEndIndex;
    return { startIndex, endIndex };
  }

  // Delta mensual de ingreso desde `mesInicio` hasta `mesFin` (o el final del horizonte).
  function applyCambioIngresoToMonths(months, decision) {
    const range = monthRangeIndices(months, decision.params.mesInicio, decision.params.mesFin);
    if (!range) return;
    const delta = number(decision.params.deltaMensual);
    for (let index = range.startIndex; index <= range.endIndex && index < months.length; index += 1) {
      months[index].income = round2(number(months[index].income) + delta);
    }
  }

  // Delta mensual de gasto desde `mesInicio` hasta `mesFin` (o el final del horizonte): importe fijo
  // (`deltaMensual`) o porcentaje fraccionario del gasto de ese mes (`deltaPct`, p. ej. 0,1 = +10%).
  function applyCambioGastoToMonths(months, decision) {
    const range = monthRangeIndices(months, decision.params.mesInicio, decision.params.mesFin);
    if (!range) return;
    for (let index = range.startIndex; index <= range.endIndex && index < months.length; index += 1) {
      const delta = decision.params.deltaMensual !== undefined
        ? number(decision.params.deltaMensual)
        : round2(number(months[index].coreSpend) * number(decision.params.deltaPct));
      months[index].coreSpend = round2(number(months[index].coreSpend) + delta);
    }
  }

  // E-1 (Escenarios.pdf, 17 de agosto): un préstamo nuevo entra de golpe en `mes` (resta de
  // `projectOutflow`, sube la liquidez) y sale como `cuota` fija durante `plazo` meses desde el
  // siguiente. No crea contrato en `debtState` — ver la nota del validador en
  // canonical-scenario-schema.js sobre por qué no cuenta para «Fecha libre de deuda».
  function applyDeudaNuevaToMonths(months, decision) {
    const resolvedMonth = resolvedMonthOf(decision);
    const startIndex = resolvedMonth ? monthIndexOf(months, resolvedMonth) : -1;
    if (startIndex < 0) return;
    months[startIndex].projectOutflow = round2(number(months[startIndex].projectOutflow) - number(decision.params.principal));
    const plazo = Math.max(1, Math.floor(number(decision.params.plazo)));
    const cuota = number(decision.params.cuota);
    for (let index = startIndex + 1; index < Math.min(months.length, startIndex + 1 + plazo); index += 1) {
      months[index].projectOutflow = round2(number(months[index].projectOutflow) + cuota);
    }
  }

  // E-1: dinero prestado o cobrado a familia. `direccion` fija el signo del importe en `mes`
  // ("prestamos" sale, "nos_prestan" entra); la devolución declarada (opcional) va en sentido
  // contrario desde el mes siguiente, sin comprobar que su suma cuadre con el importe inicial —
  // son las cifras que ha escrito la persona, no un cálculo que deba cerrar solo.
  function applyPrestamoFamiliarToMonths(months, decision) {
    const startIndex = monthIndexOf(months, decision.params.mes);
    if (startIndex < 0) return;
    const sale = decision.params.direccion === "prestamos";
    const importe = number(decision.params.importe);
    months[startIndex].projectOutflow = round2(number(months[startIndex].projectOutflow) + (sale ? importe : -importe));
    if (decision.params.devolucionMensual === undefined || decision.params.meses === undefined) return;
    const devolucion = number(decision.params.devolucionMensual);
    const meses = Math.max(1, Math.floor(number(decision.params.meses)));
    for (let index = startIndex + 1; index < Math.min(months.length, startIndex + 1 + meses); index += 1) {
      months[index].projectOutflow = round2(number(months[index].projectOutflow) + (sale ? -devolucion : devolucion));
    }
  }

  // E-1b: un tipo propio solo lleva los campos que su definición eligió — `importe` es un golpe en
  // `mes`, `mensualidad` + `plazo` es un recurrente desde `mes` (inclusive). Ambos pueden coexistir
  // (golpe inicial más cuotas) o faltar el que no se eligió; nunca fabrica un valor para el que sí.
  function applyPropioToMonths(months, decision) {
    const startIndex = monthIndexOf(months, decision.params.mes);
    if (startIndex < 0) return;
    if (decision.params.importe !== undefined) {
      months[startIndex].projectOutflow = round2(number(months[startIndex].projectOutflow) + number(decision.params.importe));
    }
    if (decision.params.mensualidad !== undefined && decision.params.plazo !== undefined) {
      const plazo = Math.max(1, Math.floor(number(decision.params.plazo)));
      const mensualidad = number(decision.params.mensualidad);
      for (let index = startIndex; index < Math.min(months.length, startIndex + plazo); index += 1) {
        months[index].projectOutflow = round2(number(months[index].projectOutflow) + mensualidad);
      }
    }
  }

  // Tipos sin efecto en el estado de las deudas que sí aportan a la serie mensual (día 2: compra;
  // día 4: el resto; E-1: los tres últimos). `traspaso` y `cambio_presupuesto` quedan fuera a
  // propósito — ver cabecera.
  const NON_DEBT_APPLIERS = Object.freeze({
    compra: applyCompraToMonths,
    imprevisto: applyImprevistoToMonths,
    proyecto: applyProyectoToMonths,
    cambio_ingreso: applyCambioIngresoToMonths,
    cambio_gasto: applyCambioGastoToMonths,
    deuda_nueva: applyDeudaNuevaToMonths,
    prestamo_familiar: applyPrestamoFamiliarToMonths,
    propio: applyPropioToMonths,
  });

  function minimumLiquidity(input) {
    const rows = Engine.buildRows(input);
    return rows.length ? Math.min(...rows.map((row) => number(row.totalLiquidity))) : Infinity;
  }

  // Punto de entrada del día 2: resuelve el estado de las deudas (igual que `resolveDecisiones`) Y
  // compone la serie mensual resultante delegando en `canonical-engine.buildRows`. Si el escenario
  // declara `guardarrailes.saldoMinimoAbsoluto`, cada decisión con efecto en la serie se comprueba
  // contra la liquidez mínima resultante hasta ese punto de la resolución antes de darla por
  // aplicada — y se deshace (`guardarril-incumplido`) si la rompe, en vez de aceptarla en silencio.
  function resolveEscenario(decisiones, context = {}) {
    if (!context.baseInput || !Array.isArray(context.baseInput.months)) {
      return { valid: false, reason: "missing-base-input", resultados: [] };
    }
    const todas = Array.isArray(decisiones) ? decisiones : [];
    const activas = todas.filter((decision) => isPlainObject(decision) && decision.activa !== false);
    const inactivas = todas.filter((decision) => isPlainObject(decision) && decision.activa === false);

    if (!Schema || !Engine) {
      return { valid: false, reason: "missing-engine-dependency", resultados: [] };
    }
    const orderResult = Schema.resolveExecutionOrder(activas);
    if (orderResult.hasCycle) {
      return { valid: false, reason: "dependency-cycle", unresolved: orderResult.unresolved, resultados: [] };
    }

    const byId = new Map(activas.map((decision) => [decision.id, decision]));
    const debtState = buildDebtState(context.debtContracts);
    const baseMonths = cloneMonths(context.baseInput.months);
    const appliedExtras = [];
    const saldoMinimo = number(context.guardarrailes?.saldoMinimoAbsoluto);
    const hasGuardrail = context.guardarrailes?.saldoMinimoAbsoluto !== undefined;

    // Recompone siempre desde `baseMonths`: el estado de deudas y la lista de decisiones sin deuda
    // ya aplicadas (compra, imprevisto, proyecto, cambio de ingreso/gasto) son la única fuente de
    // verdad, así que cada intento (incluido el que se acaba de rechazar) es idempotente y no puede
    // arrastrar un efecto ya aplicado ni perder uno anterior.
    function composeCandidateMonths(extraDecision) {
      const candidate = cloneMonths(baseMonths);
      applyDebtDeltasToMonths(candidate, debtState);
      appliedExtras.forEach((extra) => NON_DEBT_APPLIERS[extra.tipo](candidate, extra));
      if (extraDecision) NON_DEBT_APPLIERS[extraDecision.tipo](candidate, extraDecision);
      return candidate;
    }

    // modo:"optimo" (día 3, C003): sustituye mesResuelto/mesInicio por cada mes candidato antes de
    // intentar la decisión — nunca muta el objeto original, así que un intento fallido no deja rastro.
    // `imprevisto` usa `params.mes` en vez de la planificación; `cambio_ingreso`/`cambio_gasto` usan
    // `params.mesInicio` (conservando `mesFin` tal cual); `proyecto` ya lee `mesResuelto` a través de
    // `resolvedMonthOf`, así que no necesita tocar sus params.
    function withResolvedMonth(decision, monthKey) {
      const planificacion = { ...decision.planificacion, mesResuelto: monthKey };
      let params = decision.params;
      if (decision.tipo === "retomar_pagos") params = { ...decision.params, mesInicio: monthKey };
      else if (decision.tipo === "imprevisto" || decision.tipo === "prestamo_familiar" || decision.tipo === "propio") params = { ...decision.params, mes: monthKey };
      else if (decision.tipo === "cambio_ingreso" || decision.tipo === "cambio_gasto") params = { ...decision.params, mesInicio: monthKey };
      return { ...decision, planificacion, params };
    }

    const resultados = orderResult.resolvedOrder.map((id) => {
      const decision = byId.get(id);
      const isOptimo = decision.planificacion?.modo === "optimo" && !resolvedMonthOf(decision);
      // Sin guardarraíles no hay nada que optimizar: el primer mes del horizonte basta. Con
      // guardarraíles, se prueba cada mes en orden cronológico hasta el primero viable.
      const monthCandidates = isOptimo ? (hasGuardrail ? baseMonths.map((month) => month.monthKey) : [baseMonths[0]?.monthKey || null]) : [resolvedMonthOf(decision)];

      let outcomeFinal = null;
      for (const monthKey of monthCandidates) {
        const attemptDecision = isOptimo ? withResolvedMonth(decision, monthKey) : decision;

        if (NON_DEBT_APPLIERS[attemptDecision.tipo]) {
          const candidateMonths = composeCandidateMonths(attemptDecision);
          if (hasGuardrail) {
            const candidateMinimum = minimumLiquidity({ ...context.baseInput, months: candidateMonths });
            if (candidateMinimum < saldoMinimo) {
              if (isOptimo) continue;
              outcomeFinal = { id: decision.id, tipo: decision.tipo, resultado: "guardarril-incumplido", motivo: "saldo-minimo-absoluto", minimoResultante: round2(candidateMinimum) };
              break;
            }
          }
          appliedExtras.push(attemptDecision);
          outcomeFinal = { id: decision.id, tipo: decision.tipo, resultado: "aplicada", efecto: decision.tipo, mesResuelto: monthKey || undefined };
          break;
        }

        const debtStateSnapshot = new Map(Array.from(debtState.entries()).map(([debtId, debtContract]) => [debtId, clone(debtContract)]));
        const outcome = resolveDecision(attemptDecision, debtState);
        if (outcome.resultado !== "aplicada") {
          // Rechazo estructural (deuda desconocida, ya cerrada, conflicto...): no depende del mes,
          // así que probar otros meses no cambiaría nada.
          outcomeFinal = outcome;
          break;
        }
        if (hasGuardrail) {
          const candidateMonths = composeCandidateMonths(null);
          const candidateMinimum = minimumLiquidity({ ...context.baseInput, months: candidateMonths });
          if (candidateMinimum < saldoMinimo) {
            debtState.clear();
            debtStateSnapshot.forEach((debtContract, debtId) => debtState.set(debtId, debtContract));
            if (isOptimo) continue;
            outcomeFinal = { id: decision.id, tipo: decision.tipo, resultado: "guardarril-incumplido", motivo: "saldo-minimo-absoluto", minimoResultante: round2(candidateMinimum) };
            break;
          }
        }
        outcomeFinal = { ...outcome, mesResuelto: monthKey || undefined };
        break;
      }
      return outcomeFinal || { id: decision.id, tipo: decision.tipo, resultado: "sin-mes-viable" };
    });
    const months = composeCandidateMonths(null);
    inactivas.forEach((decision) => {
      resultados.push({ id: decision.id, tipo: decision.tipo, resultado: "inactiva" });
    });

    const finalInput = { ...context.baseInput, months };
    const scenario = Engine.buildScenario(finalInput, null, context.meta || {});

    return {
      valid: true,
      schemaId: SCHEMA_ID,
      resolvedOrder: orderResult.resolvedOrder,
      declaredOrderMatches: orderResult.declaredOrderMatches,
      resultados,
      debtStateFinal: Array.from(debtState.values()),
      months,
      series: scenario.rows,
      invariants: scenario.invariants,
    };
  }

  return {
    SCHEMA_ID,
    DEBT_DECISION_TYPES,
    resolveDecisiones,
    resolveEscenario,
  };
});
