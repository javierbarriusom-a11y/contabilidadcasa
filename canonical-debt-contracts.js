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
    };
  }

  function known(value) {
    return value !== undefined && value !== null && String(value).trim() !== "" && String(value).toLowerCase() !== "unknown";
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

  function summarizeContracts(result = {}) {
    const contracts = result.contracts || [];
    return {
      currentPrincipal: round2(contracts.reduce((sum, item) => sum + item.currentPrincipal, 0)),
      suspendedPrincipal: round2(contracts.filter((item) => item.paymentStatus === "suspended").reduce((sum, item) => sum + item.currentPrincipal, 0)),
      scheduledPayment: round2(contracts.reduce((sum, item) => sum + item.scheduledPayment, 0) + number(result.unifiedPlan?.scheduledPayment)),
      arrearsEstimated: round2(contracts.reduce((sum, item) => sum + item.arrearsEstimated, 0)),
    };
  }

  return {
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
  };
});
