(function attachDebtContracts(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceDebtContracts = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function debtContractsFactory() {
  "use strict";

  const SCHEMA_ID = "finanzas-casa-debt-contracts";
  const SCHEMA_VERSION = 1;
  const DEFAULT_SUSPENSION_START = "2026-01";
  const MONTH_NAMES = {
    ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6,
    jul: 7, ago: 8, sep: 9, sept: 9, oct: 10, nov: 11, dic: 12,
  };

  function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function round2(value) {
    return Math.round((number(value) + Number.EPSILON) * 100) / 100;
  }

  function nonNegative(value) {
    return Math.max(0, round2(value));
  }

  function monthKey(value) {
    if (!value) return "";
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}`;
    }
    const direct = String(value).trim().match(/^(\d{4})-(\d{1,2})$/);
    if (direct) return `${direct[1]}-${String(Number(direct[2])).padStart(2, "0")}`;
    return "";
  }

  function maturityMonth(value) {
    const direct = monthKey(value);
    if (direct) return direct;
    const text = String(value || "").trim().toLocaleLowerCase("es");
    const numeric = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (numeric) {
      const year = Number(numeric[3]) < 100 ? Number(numeric[3]) + 2000 : Number(numeric[3]);
      return `${year}-${String(Number(numeric[2])).padStart(2, "0")}`;
    }
    const named = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").match(/([a-z]{3,5})[-\s/]+(\d{2,4})/);
    if (!named) return "";
    const month = Object.entries(MONTH_NAMES).find(([name]) => named[1].startsWith(name))?.[1];
    if (!month) return "";
    const year = Number(named[2]) < 100 ? Number(named[2]) + 2000 : Number(named[2]);
    return `${year}-${String(month).padStart(2, "0")}`;
  }

  function monthDistance(from, to) {
    const start = monthKey(from);
    const end = monthKey(to);
    if (!start || !end) return 0;
    const [startYear, startMonth] = start.split("-").map(Number);
    const [endYear, endMonth] = end.split("-").map(Number);
    return (endYear - startYear) * 12 + (endMonth - startMonth);
  }

  function normalizedAgreement(raw = {}) {
    const agreement = raw.agreement && typeof raw.agreement === "object" ? raw.agreement : {};
    const settlementAmount = nonNegative(agreement.settlementAmount ?? raw.settlementAmount ?? raw.agreedAmount);
    return {
      status: String(agreement.status || raw.agreementStatus || (settlementAmount ? "proposed" : "none")).toLocaleLowerCase("es"),
      settlementAmount,
      payment: nonNegative(agreement.payment ?? raw.agreementPayment),
      duration: Math.max(0, Math.floor(number(agreement.duration ?? raw.agreementDuration))),
      startMonth: monthKey(agreement.startMonth || raw.agreementStartMonth),
      source: String(agreement.source || raw.agreementSource || "").trim(),
      // SVD-3 (17/11/2026): un acuerdo aceptado desde el simulador visual de deuda guarda también de qué tipo es, cuándo se
      // aceptó, el justificante (D-N21: obligatorio) y la decisión del plan que lleva su dinero, para poder deshacerlo todo
      // junto. Solo se copian si vienen: los acuerdos de antes no cambian.
      ...agreementTrace(agreement),
    };
  }

  // SVD-5: `fulfilledAt` y `paymentDate`, cuando el hogar confirma que el pago pactado ya salió en el extracto.
  const AGREEMENT_TRACE_FIELDS = ["type", "acceptedAt", "documentId", "documentName", "documentStorage", "decisionId", "principalAtAcceptance", "fulfilledAt", "paymentDate", "paymentLabel"];

  function agreementTrace(agreement) {
    const trace = {};
    AGREEMENT_TRACE_FIELDS.forEach((field) => {
      const value = agreement[field];
      if (value === undefined || value === null || value === "") return;
      trace[field] = field === "principalAtAcceptance" ? nonNegative(value) : String(value).trim();
    });
    return trace;
  }

  function known(value) {
    return value !== undefined && value !== null && String(value).trim() !== "" && String(value).toLowerCase() !== "unknown";
  }

  const REVOLVING_TYPE_PATTERN = /revolving|tarjeta/i;

  // DI3: detección solo por lo que el hogar ya declaró en `type` (p. ej. "Tarjeta",
  // "Tarjeta de crédito") — nunca infiere revolving de un TAE alto por sí solo, que
  // también existe en préstamos personales sin ser revolving.
  function isRevolvingType(type) {
    return REVOLVING_TYPE_PATTERN.test(String(type || ""));
  }

  function contractQuality(contract = {}, raw = {}) {
    const agreementKnown = contract.agreement?.status === "none" || known(contract.agreement?.source);
    const fields = {
      capital: contract.currentPrincipal > 0 || contract.paymentStatus === "settled",
      arrears: known(raw.arrearsAmount) || contract.paymentStatus !== "suspended" || contract.arrearsEstimated > 0,
      apr: known(raw.apr ?? raw.tae),
      suspension: contract.paymentStatus !== "suspended" || known(contract.suspensionStart),
      maturity: known(contract.maturityMonth),
      owner: known(raw.owner),
      agreement: agreementKnown,
      provenance: known(raw.provenance) && known(raw.source),
    };
    const missing = Object.entries(fields).filter(([, complete]) => !complete).map(([field]) => field);
    const completeness = Math.round(((Object.keys(fields).length - missing.length) / Object.keys(fields).length) * 100);
    return {
      fields,
      missing,
      completeness,
      confidence: completeness === 100 ? "high" : completeness >= 75 ? "medium" : "low",
      complete: missing.length === 0,
    };
  }

  function normalizeContract(raw = {}, index = 0, options = {}) {
    const initialPrincipal = nonNegative(raw.initialPrincipal ?? raw.originalPrincipal ?? raw.principal);
    const currentPrincipal = nonNegative(raw.currentPrincipal ?? raw.principal ?? initialPrincipal);
    const reunified = Boolean(raw.reunified);
    const contractualPayment = nonNegative(raw.originalPayment ?? raw.payment);
    const explicitStatus = String(raw.paymentStatus || raw.contractStatus || "").toLocaleLowerCase("es");
    const settled = !reunified && currentPrincipal <= 0;
    const paymentsSuspended = !settled && !reunified && (explicitStatus === "suspended" || explicitStatus === "suspendido" || raw.paymentsSuspended === true || (!explicitStatus && nonNegative(raw.currentPayment) <= 0));
    const paymentStatus = settled ? "settled" : reunified ? "reunified" : paymentsSuspended ? "suspended" : "active";
    const suspensionStart = paymentStatus === "suspended"
      ? monthKey(raw.suspensionStart || options.suspensionStart || DEFAULT_SUSPENSION_START)
      : "";
    const contract = {
      ...raw,
      id: String(raw.id || `debt-${index + 1}`),
      schemaId: SCHEMA_ID,
      schemaVersion: SCHEMA_VERSION,
      entity: String(raw.entity || "Deuda").trim(),
      type: String(raw.type || "Crédito").trim(),
      number: String(raw.number || "").trim(),
      initialPrincipal,
      currentPrincipal,
      originalPayment: contractualPayment,
      currentPayment: paymentStatus === "active" ? nonNegative(raw.currentPayment || contractualPayment) : 0,
      scheduledPayment: paymentStatus === "active" ? nonNegative(raw.currentPayment || contractualPayment) : 0,
      contractualPayment,
      reunified,
      paymentsSuspended,
      paymentStatus,
      suspensionStart,
      maturityMonth: maturityMonth(raw.maturityMonth || raw.maturity),
      remainingInstallments: Math.max(0, Math.floor(number(raw.remainingInstallments))),
      agreement: normalizedAgreement(raw),
      provenance: raw.provenance || "declared",
      source: raw.source || "workbook",
      owner: raw.owner || "household",
      apr: known(raw.apr ?? raw.tae) ? nonNegative(raw.apr ?? raw.tae) : null,
      revolving: isRevolvingType(raw.type),
      // DEB5 (Oleada 3, Bloque 4): % del interés de ESTA deuda deducible fiscalmente (p. ej.
      // deducción autonómica vigente de una hipoteca), declarado a mano por contrato — nunca
      // inferido de tipo/entidad. Sin declarar, 0: el TAE efectivo coincide con el nominal, así
      // que un contrato sin este dato se comporta exactamente como antes de que existiera el campo.
      fiscalDeductionPct: Math.min(100, nonNegative(raw.fiscalDeductionPct)),
    };
    const arrears = estimateArrears(contract, options.asOfMonthKey);
    const normalized = { ...contract, arrearsMonths: arrears.months, arrearsEstimated: arrears.amount };
    return { ...normalized, dataQuality: contractQuality(normalized, raw) };
  }

  function estimateArrears(contract = {}, asOfMonthKey = "") {
    if (contract.paymentStatus !== "suspended") return { months: 0, amount: 0 };
    const start = contract.suspensionStart || DEFAULT_SUSPENSION_START;
    const asOf = monthKey(asOfMonthKey) || start;
    const months = Math.max(0, monthDistance(start, asOf));
    return { months, amount: round2(months * nonNegative(contract.contractualPayment ?? contract.originalPayment)) };
  }

  function validateContracts(contracts = []) {
    const issues = [];
    const seen = new Set();
    contracts.forEach((contract) => {
      const identity = `${contract.entity}|${contract.type}|${contract.number}`.toLocaleLowerCase("es");
      if (seen.has(identity)) issues.push({ severity: "warning", code: "duplicate-contract", contractId: contract.id });
      seen.add(identity);
      if (contract.paymentStatus === "active" && contract.scheduledPayment <= 0 && contract.currentPrincipal > 0) {
        issues.push({ severity: "warning", code: "active-without-scheduled-payment", contractId: contract.id });
      }
      if (contract.paymentStatus === "suspended" && contract.scheduledPayment !== 0) {
        issues.push({ severity: "error", code: "suspended-with-scheduled-payment", contractId: contract.id });
      }
      (contract.dataQuality?.missing || []).forEach((field) => {
        issues.push({ severity: "warning", code: "missing-required-field", field, contractId: contract.id });
      });
    });
    return { valid: !issues.some((item) => item.severity === "error"), issues };
  }

  function normalizeContracts(rows = [], options = {}) {
    const contracts = (Array.isArray(rows) ? rows : []).map((row, index) => normalizeContract(row, index, options));
    const components = contracts.filter((contract) => contract.reunified);
    const payment = nonNegative(options.reunifiedPayment);
    const installments = Math.max(0, ...components.map((contract) => contract.remainingInstallments));
    const unifiedPlan = components.length ? {
      id: "reunified-plan-current",
      schemaId: SCHEMA_ID,
      schemaVersion: SCHEMA_VERSION,
      kind: "reunified-plan",
      label: "Plan refinanciado actual",
      paymentStatus: "active",
      currentPayment: payment,
      scheduledPayment: payment,
      remainingInstallments: installments,
      currentPrincipal: round2(components.reduce((sum, contract) => sum + contract.initialPrincipal, 0)),
      totalCost: nonNegative(options.reunifiedCost || payment * installments),
      componentIds: components.map((contract) => contract.id),
      provenance: "declared",
    } : null;
    return { schemaId: SCHEMA_ID, schemaVersion: SCHEMA_VERSION, contracts, unifiedPlan, quality: validateContracts(contracts) };
  }

  function resumePlan(contract = {}, options = {}) {
    const normalized = normalizeContract(contract, 0, { asOfMonthKey: options.startMonthKey || options.asOfMonthKey });
    const startMonth = monthKey(options.startMonthKey || options.asOfMonthKey) || normalized.suspensionStart || DEFAULT_SUSPENSION_START;
    const arrears = estimateArrears(normalized, startMonth);
    const maturityDuration = normalized.maturityMonth ? Math.max(0, monthDistance(startMonth, normalized.maturityMonth) + 1) : 0;
    const estimatedDuration = normalized.contractualPayment > 0
      ? Math.ceil(normalized.currentPrincipal / normalized.contractualPayment)
      : 0;
    const recurringDuration = maturityDuration || normalized.remainingInstallments || estimatedDuration;
    return {
      startMonth,
      arrearsMonths: arrears.months,
      arrears: arrears.amount,
      recurringAmount: normalized.contractualPayment,
      recurringDuration,
      total: round2(arrears.amount + normalized.contractualPayment * recurringDuration),
    };
  }

  // DI3: prioriza las deudas revolving activas por TAE descendente — mismo criterio que la
  // ruta avalancha (A16-5/D-2), aplicado solo al subconjunto revolving en vez de a toda la
  // cartera, porque el revolving suele concentrar el TAE más alto y conviene señalarlo aparte.
  function prioritizeRevolving(contracts = []) {
    return contracts
      .filter((contract) => contract.revolving && contract.paymentStatus === "active")
      .sort((a, b) => (b.apr ?? 0) - (a.apr ?? 0));
  }

  function summarizeContracts(result = {}) {
    const contracts = result.contracts || [];
    return {
      currentPrincipal: round2(contracts.reduce((sum, item) => sum + item.currentPrincipal, 0)),
      suspendedPrincipal: round2(contracts.filter((item) => item.paymentStatus === "suspended").reduce((sum, item) => sum + item.currentPrincipal, 0)),
      scheduledPayment: round2(contracts.reduce((sum, item) => sum + item.scheduledPayment, 0) + number(result.unifiedPlan?.scheduledPayment)),
      arrearsEstimated: round2(contracts.reduce((sum, item) => sum + item.arrearsEstimated, 0)),
    };
  }

  // DEB8 (Oleada 3, Bloque 3): ventana de comisión decreciente. Muchos contratos con comisión de
  // amortización anticipada la reducen en un escalón declarado por contrato (p. ej. 2% los primeros
  // años, 1% después) — sin este aviso, `DEB2` podría dimensionar una amortización justo antes de que
  // esa comisión bajase de precio por pura impaciencia. `tiers` es la lista de escalones declarados
  // por el hogar (nunca inventados): cada uno con el mes en que deja de aplicar (`untilMonth`, o
  // `null` para el escalón final sin fecha de fin) y el porcentaje de esa comisión mientras aplica.
  // Motor puro: solo lee el escalón vigente y el siguiente, nunca decide amortizar por su cuenta.
  function nextCheaperPrepaymentWindow(tiers, asOfMonthKey) {
    const list = (Array.isArray(tiers) ? tiers : [])
      .map((tier) => ({ untilMonth: monthKey(tier?.untilMonth) || null, pct: Math.max(0, number(tier?.pct)) }))
      .filter((tier) => tier.pct >= 0)
      .sort((a, b) => {
        if (!a.untilMonth) return 1;
        if (!b.untilMonth) return -1;
        return monthDistance(b.untilMonth, a.untilMonth);
      });
    if (!list.length) return { calculable: false };
    const asOf = monthKey(asOfMonthKey);
    if (!asOf) return { calculable: false };
    const currentIndex = list.findIndex((tier) => !tier.untilMonth || monthDistance(asOf, tier.untilMonth) >= 0);
    if (currentIndex === -1) return { calculable: false };
    const current = list[currentIndex];
    const next = list[currentIndex + 1] || null;
    if (!next || !current.untilMonth) {
      return { calculable: true, currentPct: current.pct, hasUpcomingWindow: false, nextPct: null, nextFromMonth: null, monthsUntil: null };
    }
    return {
      calculable: true,
      currentPct: current.pct,
      hasUpcomingWindow: next.pct < current.pct,
      nextPct: next.pct,
      nextFromMonth: current.untilMonth,
      monthsUntil: Math.max(0, monthDistance(asOf, current.untilMonth)),
    };
  }

  // DEB5 (Oleada 3, Bloque 4): prioridad multideuda ajustada por fiscalidad. El orden por "mayor
  // coste" no es el TAE nominal cuando una deuda tiene deducción fiscal vigente (p. ej. hipoteca con
  // deducción autonómica) y otra no (p. ej. préstamo personal): el TAE efectivo tras la deducción es
  // el que de verdad compara el coste de mantener cada deuda. Opera sobre TODAS las deudas activas
  // con TAE declarado — sin el filtro restringido de entidades que usa el asesor de amortización
  // (AP1/DEB1), porque aquí no hay optimización automática, solo un orden informativo a la vista.
  function fiscalAdjustedDebtPriority(contracts = []) {
    const candidates = (Array.isArray(contracts) ? contracts : [])
      .filter((contract) => contract.paymentStatus === "active" && contract.currentPrincipal > 0 && number(contract.apr) > 0)
      .map((contract) => {
        const nominalAprPct = round2(number(contract.apr));
        const fiscalDeductionPct = Math.min(100, Math.max(0, number(contract.fiscalDeductionPct)));
        const effectiveAprPct = round2(nominalAprPct * (1 - fiscalDeductionPct / 100));
        return {
          id: contract.id,
          entity: contract.entity,
          type: contract.type,
          owner: contract.owner,
          currentPrincipal: contract.currentPrincipal,
          nominalAprPct,
          fiscalDeductionPct,
          effectiveAprPct,
        };
      });
    if (!candidates.length) return { schemaId: SCHEMA_ID, schemaVersion: SCHEMA_VERSION, calculable: false, rows: [] };
    const byNominalIds = [...candidates].sort((a, b) => b.nominalAprPct - a.nominalAprPct).map((row) => row.id);
    const byEffective = [...candidates].sort((a, b) => b.effectiveAprPct - a.effectiveAprPct);
    const rows = byEffective.map((row, index) => ({ ...row, priorityRank: index + 1 }));
    return {
      schemaId: SCHEMA_ID,
      schemaVersion: SCHEMA_VERSION,
      calculable: true,
      rows,
      reorderedByFiscal: byNominalIds.join("|") !== byEffective.map((row) => row.id).join("|"),
    };
  }

  // DEB6 (Oleada 3, Bloque 4): simulador de consolidación de varias deudas activas en un préstamo
  // nuevo declarado (TAE y plazo a mano, nunca supuestos). Coste ANTES = suma de lo que queda por
  // pagar de cada deuda seleccionada con su cuota y plazo actuales; coste DESPUÉS = amortización
  // francesa estándar del préstamo nuevo sobre la suma de principales. Es una simulación hipotética,
  // distinta del plan ya reunificado (`reunified`/`unifiedPlan` de `normalizeContracts`) — aquí
  // ninguna deuda cambia de estado hasta que el hogar decida ejecutarlo de verdad.
  /** @param {{contracts?: Array, contractIds?: Array<string>, newLoan?: {annualRatePct?: number, termMonths?: number}}} [params] */
  function simulateDebtConsolidation({ contracts = [], contractIds = [], newLoan = {} } = {}) {
    const ids = Array.isArray(contractIds) ? contractIds : [];
    const selected = (Array.isArray(contracts) ? contracts : [])
      .filter((contract) => ids.includes(contract.id) && contract.paymentStatus === "active" && contract.currentPrincipal > 0);
    if (selected.length < 2) {
      return { schemaId: SCHEMA_ID, schemaVersion: SCHEMA_VERSION, calculable: false, reason: "need-at-least-two-debts" };
    }
    const newRatePct = number(newLoan.annualRatePct, -1);
    const newTermMonths = Math.max(0, Math.floor(number(newLoan.termMonths)));
    if (!(newRatePct >= 0) || !(newTermMonths > 0)) {
      return { schemaId: SCHEMA_ID, schemaVersion: SCHEMA_VERSION, calculable: false, reason: "missing-new-loan-terms" };
    }
    const totalPrincipal = round2(selected.reduce((sum, contract) => sum + contract.currentPrincipal, 0));
    const currentMonthlyPayment = round2(selected.reduce((sum, contract) => sum + contract.currentPayment, 0));
    const currentTotalCost = round2(selected.reduce((sum, contract) => {
      const months = contract.remainingInstallments > 0
        ? contract.remainingInstallments
        : (contract.currentPayment > 0 ? Math.ceil(contract.currentPrincipal / contract.currentPayment) : 0);
      return sum + (contract.currentPayment > 0 && months > 0 ? contract.currentPayment * months : contract.currentPrincipal);
    }, 0));
    const monthlyRate = newRatePct / 100 / 12;
    const newMonthlyPayment = monthlyRate > 0
      ? round2((totalPrincipal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -newTermMonths)))
      : round2(totalPrincipal / newTermMonths);
    const newTotalCost = round2(newMonthlyPayment * newTermMonths);
    return {
      schemaId: SCHEMA_ID,
      schemaVersion: SCHEMA_VERSION,
      calculable: true,
      contractIds: selected.map((contract) => contract.id),
      totalPrincipal,
      currentMonthlyPayment,
      currentTotalCost,
      newRatePct: round2(newRatePct),
      newTermMonths,
      newMonthlyPayment,
      newTotalCost,
      totalCostDelta: round2(newTotalCost - currentTotalCost),
      monthlyPaymentDelta: round2(newMonthlyPayment - currentMonthlyPayment),
      worthIt: newTotalCost < currentTotalCost,
    };
  }

  // «Dar de alta varios contratos a la vez» (15/11/2026, petición del hogar: tenía siete y en el móvil no hay otra forma que
  // teclearlos uno a uno). Una línea por contrato, con los campos separados por punto y coma o tabulador:
  //   Entidad ; tipo ; capital pendiente ; TAE ; cuota mensual
  // Solo la entidad y el capital son obligatorios; el tipo se puede saltar («Entidad ; 1.234,56»). Los importes se aceptan
  // como se escriben en España («2.754,03») o con punto decimal («2754.03»). No valida reglas de negocio (eso lo hace el alta
  // de siempre): solo separa los campos y dice qué línea no se entiende.
  const BULK_TYPES = { credito: "Crédito", tarjeta: "Tarjeta", prestamo: "Préstamo", hipoteca: "Hipoteca", otro: "Otro" };

  function bulkFold(text) {
    return String(text ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  }

  /** «2.754,03», «2754.03», «2 754,03 €» o «8,5 %» → número; null si no lo es. */
  function parseSpanishNumber(text) {
    const raw = String(text ?? "").replace(/[€%\s]/g, "");
    if (raw === "") return null;
    if (!/^\d[\d.,]*$/.test(raw)) return null;
    let normal = raw;
    if (raw.includes(",")) normal = raw.replace(/\./g, "").replace(",", ".");
    else if (/^\d{1,3}(\.\d{3})+$/.test(raw)) normal = raw.replace(/\./g, "");
    const value = Number(normal);
    return Number.isFinite(value) ? value : null;
  }

  function parseBulkContracts(text) {
    /** @type {Array<Record<string, any>>} */
    const rows = [];
    /** @type {Array<{ line: number, text: string, error: string }>} */
    const errors = [];
    String(text ?? "").split(/\r?\n/).forEach((raw, index) => {
      const line = raw.trim();
      if (!line) return;
      const parts = line.split(/[;\t]/).map((part) => part.trim());
      const fail = (error) => { errors.push({ line: index + 1, text: line, error }); };
      const entity = parts[0];
      if (!entity) return fail("falta el nombre de la entidad");
      let rest = parts.slice(1);
      let type = "Crédito";
      if (rest.length && rest[0] !== "" && parseSpanishNumber(rest[0]) === null) {
        const known = BULK_TYPES[bulkFold(rest[0])];
        if (!known) return fail(`no reconozco el tipo «${rest[0]}» (crédito, tarjeta, préstamo, hipoteca u otro)`);
        type = known;
        rest = rest.slice(1);
      } else if (rest.length && rest[0] === "") {
        rest = rest.slice(1);
      }
      const principal = parseSpanishNumber(rest[0]);
      if (principal === null) return fail(rest[0] ? `no entiendo el capital «${rest[0]}»` : "falta el capital pendiente");
      const optional = (value, label) => {
        if (value === undefined || value === "") return { value: null, error: "" };
        const parsed = parseSpanishNumber(value);
        return parsed === null ? { value: null, error: `no entiendo ${label} «${value}»` } : { value: parsed, error: "" };
      };
      const apr = optional(rest[1], "la TAE");
      if (apr.error) return fail(apr.error);
      const payment = optional(rest[2], "la cuota");
      if (payment.error) return fail(payment.error);
      if (rest.slice(3).some((part) => part !== "")) return fail("sobran campos: entidad; tipo; capital; TAE; cuota");
      rows.push({ line: index + 1, entity, type, principal, apr: apr.value, payment: payment.value });
    });
    return { rows, errors };
  }

  // SVD-R1 (17/11/2026, «ponerlos realistas»): ¿la cuota de cada contrato ya está en el plan? La previsión cuenta como deuda
  // las partidas del plan que la app clasifica como financiación (isFinancingPlanningRow: sección «Financi…» o un concepto con
  // préstamo, tarjeta, crédito…), así que la pregunta se contesta cruzando cada contrato con esas partidas de un mes:
  //  - «en-plan»: una partida lleva el nombre de la entidad (o los 4 últimos dígitos del número) y el mismo importe (±2 % o ±1 €);
  //  - «importe-distinto»: lleva su nombre pero el importe no coincide (la previsión paga otra cifra);
  //  - «por-importe»: ninguna lleva su nombre, pero una sin dueño tiene el mismo importe (parece, sin seguridad);
  //  - «fuera-del-plan»: nada; la previsión no paga esa cuota (es optimista en esa cifra);
  //  - «suspendido-en-plan»: el contrato no paga (suspendido o sin cuota) pero una partida con su nombre sí (pesimista).
  // Cada partida se asigna a un contrato como mucho. Lo que sobra son partidas de financiación sin contrato. Puro: no escribe nada.
  const PLAN_MATCH_STOPWORDS = new Set(["banco", "caja", "financiera", "financiacion", "credito", "creditos", "prestamo", "prestamos",
    "tarjeta", "tarjetas", "hipoteca", "cuenta", "consumo", "personal", "deuda", "de", "del", "la", "el", "los", "las", "y", "sa", "slu", "sl",
    "establecimiento", "entidad", "bank", "card", "spain", "espana"]);

  function foldText(value) {
    return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es");
  }

  function entityTokens(contract) {
    const tokens = foldText(contract.entity).split(/[^a-z0-9]+/).filter((token) => token.length >= 3 && !PLAN_MATCH_STOPWORDS.has(token));
    const digits = String(contract.number || "").replace(/\D/g, "");
    if (digits.length >= 4) tokens.push(digits.slice(-4));
    return tokens;
  }

  function sameAmount(a, b) {
    return Math.abs(a - b) <= Math.max(1, Math.abs(b) * 0.02);
  }

  function matchPlanInstallments(contracts = [], planRows = []) {
    const rows = (Array.isArray(planRows) ? planRows : [])
      .map((row, index) => ({ index, label: String(row?.label || row?.concept || "").trim(), amount: round2(number(row?.amount)), words: foldText(row?.label || row?.concept) }))
      .filter((row) => row.amount > 0);
    const used = new Set();
    const named = (contract) => {
      const tokens = entityTokens(contract);
      return tokens.length ? rows.filter((row) => !used.has(row.index) && tokens.some((token) => row.words.includes(token))) : [];
    };
    const list = (Array.isArray(contracts) ? contracts : [])
      .filter((contract) => contract && contract.paymentStatus !== "settled" && contract.paymentStatus !== "reunified" && number(contract.currentPrincipal) > 0);
    const results = new Map();
    const paying = (contract) => contract.paymentStatus === "active" && number(contract.currentPayment) > 0;
    const take = (contract, row, status) => {
      used.add(row.index);
      results.set(contract.id, { status, row: { label: row.label, amount: row.amount }, diff: round2(row.amount - round2(number(contract.currentPayment))) });
    };
    // 1) Nombre e importe. 2) Nombre solo. 3) Importe solo, si hay una única partida libre con ese importe.
    list.filter(paying).forEach((contract) => {
      const row = named(contract).find((candidate) => sameAmount(candidate.amount, round2(number(contract.currentPayment))));
      if (row) take(contract, row, "en-plan");
    });
    list.filter((contract) => !results.has(contract.id)).forEach((contract) => {
      const row = named(contract)[0];
      if (row) take(contract, row, paying(contract) ? "importe-distinto" : "suspendido-en-plan");
    });
    list.filter((contract) => paying(contract) && !results.has(contract.id)).forEach((contract) => {
      const candidates = rows.filter((row) => !used.has(row.index) && sameAmount(row.amount, round2(number(contract.currentPayment))));
      if (candidates.length === 1) take(contract, candidates[0], "por-importe");
    });
    const items = list.map((contract) => {
      const found = results.get(contract.id);
      const payment = paying(contract) ? round2(number(contract.currentPayment)) : 0;
      return {
        id: String(contract.id),
        label: [contract.entity, contract.type].filter(Boolean).join(" · "),
        payment,
        paymentStatus: contract.paymentStatus,
        status: found ? found.status : paying(contract) ? "fuera-del-plan" : "sin-cuota",
        row: found ? found.row : null,
        diff: found && found.status !== "suspendido-en-plan" ? found.diff : null,
      };
    });
    const sum = (filter, pick) => round2(items.filter(filter).reduce((total, item) => total + pick(item), 0));
    const withPayment = items.filter((item) => item.payment > 0);
    return {
      items,
      orphanRows: rows.filter((row) => !used.has(row.index)).map((row) => ({ label: row.label, amount: row.amount })),
      totals: {
        contractsPayment: sum((item) => item.payment > 0, (item) => item.payment),
        missingPayment: sum((item) => item.status === "fuera-del-plan", (item) => item.payment),
        planFinancing: round2(rows.reduce((total, row) => total + row.amount, 0)),
        suspendedInPlan: sum((item) => item.status === "suspendido-en-plan", (item) => item.row.amount),
      },
      // Para el simulador: si todas las cuotas que se pagan están en el plan por su nombre, ninguna, o algunas.
      coverage: !withPayment.length ? "sin-cuotas"
        : withPayment.every((item) => item.status === "en-plan" || item.status === "importe-distinto") ? "todas"
          : withPayment.some((item) => item.status === "en-plan" || item.status === "importe-distinto") ? "algunas" : "ninguna",
    };
  }

  // SVD-5 (17/11/2026, «la vuelta»): qué ha pasado fuera del simulador con cada acuerdo aceptado. Puro.
  //  - plan: «en-plan» si su decisión sigue en el plan; «sin-decision» si alguien la quitó (Plan › Decisiones): entonces Ruta
  //    sigue el acuerdo pero la previsión ya no paga su dinero, y hay que decir algo.
  //  - pago: el pago único pactado en los extractos, en su mes o uno antes o después, por importe (±1 % o ±2 €) y, si se puede,
  //    por el nombre de la entidad («por-nombre»); si ninguno lleva el nombre pero hay uno solo con ese importe, «por-importe».
  //  - cuotas: cuántas cuotas pactadas se ven pagadas desde su mes (una por mes, por importe y nombre).
  //  - estado: «cumplido» (pago único visto y, si hay cuotas, todas vistas), «en-curso», «pendiente» (aún no ha llegado el mes),
  //    «sin-pago» (el mes del pago único ya pasó y no se ve en los extractos) o «ya-liquidado» (el contrato ya está saldado).
  function monthIndexKey(key) {
    const [year, month] = String(key || "").split("-").map(Number);
    return Number.isFinite(year) && Number.isFinite(month) ? year * 12 + (month - 1) : null;
  }

  function agreementFollowUp(contracts = [], options = {}) {
    const decisions = Array.isArray(options.decisions) ? options.decisions : [];
    const todayIndex = monthIndexKey(monthKey(options.todayKey || ""));
    const movements = (Array.isArray(options.movements) ? options.movements : [])
      .map((row, index) => ({ index, date: String(row?.date || "").slice(0, 10), amount: round2(number(row?.amount)), label: String(row?.label || ""), words: foldText(`${row?.label || ""} ${row?.details || ""}`) }))
      .filter((row) => row.amount < 0 && /^\d{4}-\d{2}-\d{2}$/.test(row.date));
    const near = (target, value) => Math.abs(Math.abs(value) - target) <= Math.max(2, target * 0.01);
    return (Array.isArray(contracts) ? contracts : [])
      .filter((contract) => contract?.agreement && String(contract.agreement.status || "").toLowerCase() === "accepted")
      .map((contract) => {
        const agreement = contract.agreement;
        const start = monthIndexKey(agreement.startMonth);
        const tokens = entityTokens(contract);
        const named = (row) => tokens.some((token) => row.words.includes(token));
        const decision = decisions.find((item) => (agreement.decisionId && item.id === agreement.decisionId) || (item.svdAcuerdo && item.targetId === contract.id));
        let pago = null;
        const lump = round2(number(agreement.settlementAmount));
        if (lump > 0 && start !== null) {
          const window = movements.filter((row) => Math.abs(monthIndexKey(row.date.slice(0, 7)) - start) <= 1 && near(lump, row.amount));
          const byName = window.find(named);
          const only = window.length === 1 ? window[0] : null;
          const row = byName || only;
          if (row) pago = { date: row.date, amount: round2(Math.abs(row.amount)), label: row.label, match: byName ? "por-nombre" : "por-importe" };
        }
        const payment = round2(number(agreement.payment));
        const duration = Math.max(0, Math.floor(number(agreement.duration)));
        let cuotas = 0;
        if (payment > 0 && duration > 0 && start !== null) {
          const months = new Set();
          movements.filter((row) => near(payment, row.amount) && named(row)).forEach((row) => {
            const offset = monthIndexKey(row.date.slice(0, 7)) - start;
            if (offset >= 0 && offset < duration) months.add(offset);
          });
          cuotas = months.size;
        }
        const lumpOk = !(lump > 0) || Boolean(pago);
        const cuotasOk = !(payment > 0 && duration > 0) || cuotas >= duration;
        const estado = contract.paymentStatus === "settled" ? "ya-liquidado"
          : lumpOk && cuotasOk && (pago || cuotas) ? "cumplido"
            : start !== null && todayIndex !== null && todayIndex < start ? "pendiente"
              : lump > 0 && !pago && todayIndex !== null && start !== null && todayIndex > start + 1 ? "sin-pago"
                : "en-curso";
        return {
          id: String(contract.id),
          plan: decision ? "en-plan" : "sin-decision",
          decisionId: decision ? decision.id : null,
          pago,
          cuotas: payment > 0 && duration > 0 ? { vistas: cuotas, pactadas: duration } : null,
          estado,
        };
      });
  }

  return {
    parseBulkContracts,
    parseSpanishNumber,
    SCHEMA_ID,
    SCHEMA_VERSION,
    DEFAULT_SUSPENSION_START,
    monthKey,
    maturityMonth,
    monthDistance,
    estimateArrears,
    normalizeContract,
    normalizeContracts,
    validateContracts,
    contractQuality,
    resumePlan,
    summarizeContracts,
    isRevolvingType,
    prioritizeRevolving,
    nextCheaperPrepaymentWindow,
    fiscalAdjustedDebtPriority,
    simulateDebtConsolidation,
    matchPlanInstallments,
    agreementFollowUp,
  };
});
