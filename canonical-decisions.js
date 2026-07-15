(function initCanonicalDecisions(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalDecisions = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function canonicalDecisionsFactory() {
  "use strict";

  const SCHEMA_ID = "finance-canonical-decisions/v1";
  const TOLERANCE = 0.02;
  const ACTIVE_STATES = new Set(["approved", "fixed"]);

  function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function round2(value) {
    return Math.round((number(value) + Number.EPSILON) * 100) / 100;
  }

  function monthIndexFromKey(months, key) {
    if (!key) return -1;
    return months.findIndex((month) => month.key === key);
  }

  function normalizedState(decision = {}) {
    return String(decision.lifecycleState || decision.decisionState || decision.status || "pending").trim().toLowerCase();
  }

  function shouldSchedule(decision = {}) {
    const state = normalizedState(decision);
    return ACTIVE_STATES.has(state);
  }

  function isResumeMode(mode) {
    return mode === "retomar" || mode === "retomar-optimize";
  }

  function isSuspendedTarget(target) {
    return Boolean(target) && !target.reunified && (
      target.paymentStatus === "suspended" ||
      target.paymentsSuspended === true ||
      (number(target.currentPrincipal ?? target.principal) > 0 && number(target.currentPayment) <= 0)
    );
  }

  function normalizeTarget(raw = {}) {
    return {
      ...raw,
      id: String(raw.id || raw.targetId || ""),
      currentPrincipal: Math.max(0, number(raw.currentPrincipal ?? raw.principal)),
      currentPayment: Math.max(0, number(raw.currentPayment ?? raw.payment)),
      scheduledPayment: Math.max(0, number(raw.scheduledPayment ?? raw.currentPayment ?? raw.payment)),
      originalPayment: Math.max(0, number(raw.originalPayment ?? raw.payment)),
      remainingInstallments: Math.max(0, number(raw.remainingInstallments)),
      reunified: Boolean(raw.reunified),
      paymentStatus: String(raw.paymentStatus || ""),
      paymentsSuspended: Boolean(raw.paymentsSuspended),
    };
  }

  function targetMap(targets = []) {
    return new Map(targets.map((target) => normalizeTarget(target)).filter((target) => target.id).map((target) => [target.id, target]));
  }

  function parseMaturityIndex(value, months = []) {
    if (!value || !months.length) return null;
    const text = String(value).trim().toLowerCase();
    let year = null;
    let month = null;
    const numeric = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (numeric) {
      month = Number(numeric[2]);
      year = Number(numeric[3]);
    } else {
      const names = { ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, sep: 9, sept: 9, oct: 10, nov: 11, dic: 12 };
      const match = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").match(/([a-z]{3,5})[-\s/]+(\d{2,4})/);
      if (match) {
        month = Object.entries(names).find(([name]) => match[1].startsWith(name))?.[1] || null;
        year = Number(match[2]);
      }
    }
    if (!year || !month) return null;
    if (year < 100) year += 2000;
    const key = `${year}-${String(month).padStart(2, "0")}`;
    const exact = monthIndexFromKey(months, key);
    if (exact >= 0) return exact;
    const first = String(months[0].key || "").match(/^(\d{4})-(\d{2})$/);
    if (!first) return null;
    return (year - Number(first[1])) * 12 + (month - Number(first[2]));
  }

  function reliefMonths(decision, target, reliefStartIndex, months) {
    const relief = Math.max(0, number(decision.monthlyRelief));
    if (!relief || isResumeMode(decision.payoffMode || decision.mode) || isSuspendedTarget(target)) return 0;
    if (Number.isFinite(Number(decision.reliefMonths)) && Number(decision.reliefMonths) >= 0) {
      return Math.max(0, Math.floor(Number(decision.reliefMonths)));
    }
    const maturityIndex = parseMaturityIndex(target?.maturity, months);
    if (maturityIndex !== null) return Math.max(0, maturityIndex - reliefStartIndex + 1);
    const installments = number(target?.remainingInstallments ?? decision.remainingInstallments);
    if (installments > 0) return Math.max(0, Math.ceil(installments - reliefStartIndex));
    const principal = Math.max(0, number(decision.targetPrincipal ?? decision.originalPrincipal ?? target?.currentPrincipal ?? decision.amount));
    return Math.max(0, Math.ceil((principal + relief * 2) / relief));
  }

  function resolveStartIndex(decision, months) {
    const byKey = monthIndexFromKey(months, decision.monthKey);
    if (byKey >= 0) return byKey;
    return Math.min(Math.max(0, Math.floor(number(decision.startIndex ?? decision.monthIndex))), Math.max(0, months.length - 1));
  }

  function normalizeDecision(raw = {}, index = 0, months = []) {
    const source = raw.source === "debt" ? "debt" : "project";
    return {
      ...raw,
      id: String(raw.id || `${source}-${index + 1}`),
      source,
      name: String(raw.name || raw.label || `${source === "debt" ? "Deuda" : "Proyecto"} ${index + 1}`),
      amount: number(raw.amount),
      duration: Math.max(1, Math.floor(number(raw.duration, 1))),
      creditCapital: Math.max(0, number(raw.creditCapital)),
      recurringAmount: number(raw.recurringAmount),
      recurringDuration: Math.max(0, Math.floor(number(raw.recurringDuration))),
      recurringStartOffset: Math.max(0, Math.floor(number(raw.recurringStartOffset))),
      monthlyRelief: Math.max(0, number(raw.monthlyRelief)),
      startIndex: resolveStartIndex(raw, months),
      lifecycleState: normalizedState(raw),
    };
  }

  function emptyMonth(month, index) {
    return {
      index,
      monthKey: month.key,
      monthLabel: month.label || month.key,
      initialCost: 0,
      recurringCost: 0,
      externalIncome: 0,
      debtRelief: 0,
      projectOutflow: 0,
      debtOutflow: 0,
      netOutflow: 0,
      events: [],
    };
  }

  function addEvent(row, decision, component, amount) {
    row.events.push({
      decisionId: decision.id,
      targetId: decision.targetId || null,
      source: decision.source,
      name: decision.name,
      component,
      amount: round2(amount),
    });
  }

  function addAt(rows, index, field, amount, decision, component) {
    if (index < 0 || index >= rows.length || !amount) return;
    rows[index][field] = round2(rows[index][field] + amount);
    addEvent(rows[index], decision, component, amount);
  }

  function applyDecision(rows, decision, target, months) {
    const start = decision.startIndex;
    const monthlyInitial = decision.amount / decision.duration;
    for (let offset = 0; offset < decision.duration; offset += 1) {
      const index = start + offset;
      addAt(rows, index, "initialCost", monthlyInitial, decision, "initial-cost");
      addAt(rows, index, decision.source === "debt" ? "debtOutflow" : "projectOutflow", monthlyInitial, decision, "principal-outflow");
    }
    addAt(rows, start, "externalIncome", decision.creditCapital, decision, "external-credit");
    for (let offset = 0; offset < decision.recurringDuration; offset += 1) {
      const index = start + decision.recurringStartOffset + offset;
      addAt(rows, index, "recurringCost", decision.recurringAmount, decision, "recurring-cost");
      addAt(rows, index, decision.source === "debt" ? "debtOutflow" : "projectOutflow", decision.recurringAmount, decision, "recurring-outflow");
    }
    const reliefStart = Math.min(rows.length, start + decision.duration);
    const reliefDuration = reliefMonths(decision, target, reliefStart, months);
    for (let offset = 0; offset < reliefDuration; offset += 1) {
      addAt(rows, reliefStart + offset, "debtRelief", decision.monthlyRelief, decision, "debt-relief");
    }
  }

  function stableFingerprint(value) {
    const input = JSON.stringify(value);
    let hash = 2166136261;
    for (let index = 0; index < input.length; index += 1) {
      hash ^= input.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return `d${(hash >>> 0).toString(16).padStart(8, "0")}`;
  }

  function validateSchedule(schedule) {
    const issues = [];
    schedule.months.forEach((month) => {
      ["initialCost", "recurringCost", "externalIncome", "debtRelief", "projectOutflow", "debtOutflow", "netOutflow"].forEach((field) => {
        if (!Number.isFinite(month[field])) issues.push({ type: "non-finite", monthKey: month.monthKey, field });
      });
      const expected = round2(month.projectOutflow + month.debtOutflow - month.externalIncome - month.debtRelief);
      if (Math.abs(expected - month.netOutflow) > TOLERANCE) {
        issues.push({ type: "monthly-conservation", monthKey: month.monthKey, expected, actual: month.netOutflow });
      }
    });
    schedule.duplicateDebtTargets.forEach((targetId) => issues.push({ type: "duplicate-debt-target", targetId }));
    return {
      passed: issues.length === 0,
      issues,
      checks: {
        finite: !issues.some((issue) => issue.type === "non-finite"),
        monthlyConservation: !issues.some((issue) => issue.type === "monthly-conservation"),
        uniqueDebtTargets: !issues.some((issue) => issue.type === "duplicate-debt-target"),
      },
    };
  }

  function buildSchedule(input = {}) {
    const months = Array.isArray(input.months) ? input.months.map((month, index) => ({ key: month.key || String(index), label: month.label || month.key || String(index) })) : [];
    const targets = targetMap(input.debtTargets || []);
    const decisions = (input.decisions || []).map((decision, index) => normalizeDecision(decision, index, months)).filter(shouldSchedule);
    const rows = months.map(emptyMonth);
    const targetCounts = new Map();
    decisions.forEach((decision) => {
      const target = targets.get(String(decision.targetId || "")) || normalizeTarget(decision.target || {});
      if (decision.source === "debt" && decision.targetId) targetCounts.set(decision.targetId, (targetCounts.get(decision.targetId) || 0) + 1);
      applyDecision(rows, decision, target, months);
    });
    rows.forEach((row) => {
      row.netOutflow = round2(row.projectOutflow + row.debtOutflow - row.externalIncome - row.debtRelief);
    });
    const duplicateDebtTargets = [...targetCounts.entries()].filter(([, count]) => count > 1).map(([targetId]) => targetId);
    const schedule = {
      schemaId: SCHEMA_ID,
      generatedAt: new Date().toISOString(),
      months: rows,
      outflows: rows.map((row) => row.netOutflow),
      decisions,
      duplicateDebtTargets,
      totals: {
        projectOutflow: round2(rows.reduce((sum, row) => sum + row.projectOutflow, 0)),
        debtOutflow: round2(rows.reduce((sum, row) => sum + row.debtOutflow, 0)),
        externalIncome: round2(rows.reduce((sum, row) => sum + row.externalIncome, 0)),
        debtRelief: round2(rows.reduce((sum, row) => sum + row.debtRelief, 0)),
        netOutflow: round2(rows.reduce((sum, row) => sum + row.netOutflow, 0)),
      },
    };
    schedule.invariants = validateSchedule(schedule);
    schedule.fingerprint = stableFingerprint({ months: schedule.months, decisions: schedule.decisions.map((decision) => decision.id) });
    return schedule;
  }

  function compareOutflows(canonical = [], legacy = [], tolerance = TOLERANCE) {
    const length = Math.max(canonical.length, legacy.length);
    const differences = [];
    let maxDelta = 0;
    for (let index = 0; index < length; index += 1) {
      const delta = Math.abs(number(canonical[index]) - number(legacy[index]));
      maxDelta = Math.max(maxDelta, delta);
      if (delta > tolerance) differences.push({ index, canonical: round2(canonical[index]), legacy: round2(legacy[index]), delta: round2(delta) });
    }
    return { matched: differences.length === 0, maxDelta: round2(maxDelta), differences, tolerance };
  }

  function transferForMonth(input = {}) {
    const checkingBeforeTransfer = number(input.checkingBeforeTransfer);
    const reserveFloor = Math.max(0, number(input.reserveFloor));
    const nextMonthOutflows = Math.max(0, number(input.nextMonthOutflows));
    const protectNextMonth = input.protectNextMonth !== false;
    const requiredReserve = round2(reserveFloor + (protectNextMonth ? nextMonthOutflows : 0));
    const transfer = round2(Math.max(0, checkingBeforeTransfer - requiredReserve));
    return {
      requiredReserve,
      transfer,
      checkingAfterTransfer: round2(checkingBeforeTransfer - transfer),
      savingsAfterTransfer: round2(number(input.savingsBeforeTransfer) + transfer),
      shortfall: round2(Math.max(0, requiredReserve - checkingBeforeTransfer)),
      protectedNextMonth: protectNextMonth,
    };
  }

  return {
    SCHEMA_ID,
    TOLERANCE,
    buildSchedule,
    compareOutflows,
    transferForMonth,
    validateSchedule,
    isSuspendedTarget,
    isResumeMode,
  };
});
