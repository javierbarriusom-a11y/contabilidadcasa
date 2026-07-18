(function attachCanonicalEngine(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function canonicalEngineFactory() {
  "use strict";

  const SCHEMA_ID = "finance-canonical-engine/v1";
  const TOLERANCE = 0.02;
  const NUMERIC_FIELDS = [
    "startChecking", "startLiquidity", "income", "coreSpend", "fixedCoreSpend",
    "variableOperationalSpend", "car", "refi", "projectOutflow", "outflowsBeforeSaving",
    "endOfMonthOutflows", "prePayrollIncome", "saving", "checking", "savings",
    "totalLiquidity", "netBeforeSaving",
  ];

  function number(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function round(value) {
    return Math.round((number(value) + Number.EPSILON) * 100) / 100;
  }

  function text(value) {
    return String(value ?? "").trim();
  }

  function hash(value) {
    let result = 2166136261;
    const source = String(value);
    for (let index = 0; index < source.length; index += 1) {
      result ^= source.charCodeAt(index);
      result = Math.imul(result, 16777619);
    }
    return (result >>> 0).toString(36);
  }

  function normalizeMonth(month, index) {
    const incomeEvents = Array.isArray(month?.incomeEvents) ? month.incomeEvents.map((event) => ({ ...event })) : [];
    return {
      index: Number.isFinite(Number(month?.index)) ? Number(month.index) : index + 1,
      month: text(month?.month || month?.monthKey || `Mes ${index + 1}`),
      monthKey: text(month?.monthKey || month?.detailMonthKey),
      baseIncome: number(month?.income ?? month?.baseIncome),
      baseCoreSpend: number(month?.coreSpend ?? month?.baseCoreSpend),
      baseVariableOperationalSpend: number(month?.variableOperationalSpend ?? month?.baseVariableOperationalSpend),
      car: number(month?.car),
      refi: number(month?.refi),
      projectOutflow: number(month?.projectOutflow),
      baseEndOfMonthOutflows: number(month?.endOfMonthOutflows ?? month?.baseEndOfMonthOutflows),
      prePayrollIncome: number(month?.prePayrollIncome),
      incomeEvents,
      firstIncomeDateLabel: text(month?.firstIncomeDateLabel),
      mainPayrollDateLabel: text(month?.mainPayrollDateLabel),
      lastIncomeDateLabel: text(month?.lastIncomeDateLabel),
      transferDateLabel: text(month?.transferDateLabel),
      minDateLabel: text(month?.minDateLabel),
      adjustedMinDateLabel: text(month?.adjustedMinDateLabel),
    };
  }

  function normalizeInput(input = {}) {
    const policy = input.policy || {};
    return {
      openingBalances: {
        checking: number(input.openingBalances?.checking),
        savings: number(input.openingBalances?.savings),
      },
      policy: {
        incomeFactor: number(policy.incomeFactor ?? 1),
        annualIncomeGrowth: number(policy.annualIncomeGrowth),
        expenseFactor: number(policy.expenseFactor ?? 1),
        annualInflation: number(policy.annualInflation),
        plannedMonthlySaving: number(policy.plannedMonthlySaving),
        autoCapSavings: policy.autoCapSavings !== false,
      },
      months: (Array.isArray(input.months) ? input.months : []).map(normalizeMonth),
    };
  }

  function buildRows(rawInput = {}) {
    const input = normalizeInput(rawInput);
    let checking = input.openingBalances.checking;
    let savings = input.openingBalances.savings;
    return input.months.map((month, index) => {
      const income = month.baseIncome * input.policy.incomeFactor *
        Math.pow(1 + input.policy.annualIncomeGrowth / 100, index / 12);
      const expenseMultiplier = input.policy.expenseFactor *
        Math.pow(1 + input.policy.annualInflation / 100, index / 12);
      const variableOperationalSpend = month.baseVariableOperationalSpend * expenseMultiplier;
      const fixedCoreSpend = Math.max(0, month.baseCoreSpend - month.baseVariableOperationalSpend) * expenseMultiplier;
      const coreSpend = fixedCoreSpend + variableOperationalSpend;
      const endOfMonthOutflows = month.baseEndOfMonthOutflows * expenseMultiplier;
      const outflowsBeforeSaving = coreSpend + month.car + month.refi + month.projectOutflow;
      const startChecking = checking;
      const startLiquidity = checking + savings;
      const availableBeforeSaving = checking + income - outflowsBeforeSaving;
      const oneMonthFloor = outflowsBeforeSaving;
      const saving = input.policy.autoCapSavings
        ? Math.max(0, Math.min(input.policy.plannedMonthlySaving, availableBeforeSaving - oneMonthFloor))
        : input.policy.plannedMonthlySaving;
      checking = availableBeforeSaving - saving;
      savings += saving;
      const totalLiquidity = checking + savings;
      return {
        index: month.index,
        month: month.month,
        detailMonthKey: month.monthKey,
        startChecking,
        startLiquidity,
        income,
        coreSpend,
        fixedCoreSpend,
        variableOperationalSpend,
        car: month.car,
        refi: month.refi,
        projectOutflow: month.projectOutflow,
        outflowsBeforeSaving,
        endOfMonthOutflows,
        prePayrollIncome: month.prePayrollIncome,
        incomeEvents: month.incomeEvents,
        firstIncomeDateLabel: month.firstIncomeDateLabel,
        mainPayrollDateLabel: month.mainPayrollDateLabel,
        lastIncomeDateLabel: month.lastIncomeDateLabel,
        transferDateLabel: month.transferDateLabel,
        minDateLabel: month.minDateLabel,
        adjustedMinDateLabel: month.adjustedMinDateLabel,
        saving,
        checking,
        savings,
        totalLiquidity,
        netBeforeSaving: income - outflowsBeforeSaving,
      };
    });
  }

  function validateRows(rows = [], tolerance = TOLERANCE) {
    const issues = [];
    rows.forEach((row, index) => {
      NUMERIC_FIELDS.forEach((field) => {
        if (!Number.isFinite(Number(row?.[field]))) issues.push({ type: "non-finite", index, monthKey: row?.detailMonthKey, field });
      });
      if (Math.abs(number(row.checking) + number(row.savings) - number(row.totalLiquidity)) > tolerance) {
        issues.push({ type: "account-conservation", index, monthKey: row.detailMonthKey });
      }
      if (Math.abs(number(row.startLiquidity) + number(row.netBeforeSaving) - number(row.totalLiquidity)) > tolerance) {
        issues.push({ type: "liquidity-conservation", index, monthKey: row.detailMonthKey });
      }
      if (index > 0) {
        const previous = rows[index - 1];
        if (Math.abs(number(previous.checking) - number(row.startChecking)) > tolerance ||
          Math.abs(number(previous.totalLiquidity) - number(row.startLiquidity)) > tolerance) {
          issues.push({ type: "month-continuity", index, monthKey: row.detailMonthKey });
        }
      }
    });
    const counts = issues.reduce((summary, issue) => {
      summary[issue.type] = (summary[issue.type] || 0) + 1;
      return summary;
    }, {});
    return {
      valid: issues.length === 0,
      checkedRows: rows.length,
      issues,
      counts,
      checks: {
        finite: !counts["non-finite"],
        accountConservation: !counts["account-conservation"],
        liquidityConservation: !counts["liquidity-conservation"],
        continuity: !counts["month-continuity"],
      },
    };
  }

  function compareRows(canonicalRows = [], legacyRows = [], tolerance = TOLERANCE) {
    const differences = [];
    let maxDelta = 0;
    const rowCount = Math.max(canonicalRows.length, legacyRows.length);
    let checkedValues = 0;
    for (let index = 0; index < rowCount; index += 1) {
      const canonical = canonicalRows[index];
      const legacy = legacyRows[index];
      if (!canonical || !legacy) {
        differences.push({ index, monthKey: canonical?.detailMonthKey || legacy?.detailMonthKey || "", field: "row", canonical: Boolean(canonical), legacy: Boolean(legacy), delta: null });
        continue;
      }
      if (canonical.detailMonthKey !== legacy.detailMonthKey) {
        differences.push({ index, monthKey: canonical.detailMonthKey, field: "detailMonthKey", canonical: canonical.detailMonthKey, legacy: legacy.detailMonthKey, delta: null });
      }
      NUMERIC_FIELDS.forEach((field) => {
        checkedValues += 1;
        const canonicalValue = number(canonical[field]);
        const legacyValue = number(legacy[field]);
        const delta = Math.abs(canonicalValue - legacyValue);
        maxDelta = Math.max(maxDelta, delta);
        if (delta > tolerance && differences.length < 100) {
          differences.push({ index, monthKey: canonical.detailMonthKey, field, canonical: canonicalValue, legacy: legacyValue, delta });
        }
      });
    }
    return {
      matched: differences.length === 0,
      tolerance,
      checkedRows: Math.min(canonicalRows.length, legacyRows.length),
      checkedValues,
      maxDelta,
      differences,
    };
  }

  function annualSummary(rows = []) {
    const years = new Map();
    rows.forEach((row) => {
      const year = text(row.detailMonthKey).slice(0, 4) || "sin-fecha";
      if (!years.has(year)) years.set(year, { year, income: 0, outflows: 0, saving: 0, netBeforeSaving: 0, closingChecking: 0, closingSavings: 0, closingLiquidity: 0 });
      const summary = years.get(year);
      summary.income += number(row.income);
      summary.outflows += number(row.outflowsBeforeSaving);
      summary.saving += number(row.saving);
      summary.netBeforeSaving += number(row.netBeforeSaving);
      summary.closingChecking = number(row.checking);
      summary.closingSavings = number(row.savings);
      summary.closingLiquidity = number(row.totalLiquidity);
    });
    return [...years.values()].map((summary) => Object.fromEntries(Object.entries(summary).map(([key, value]) => [key, key === "year" ? value : round(value)])));
  }

  function snapshotFingerprint(input, rows) {
    return hash(JSON.stringify({ input: normalizeInput(input), rows: rows.map((row) => ({ monthKey: row.detailMonthKey, ...Object.fromEntries(NUMERIC_FIELDS.map((field) => [field, round(row[field])])) })) }));
  }

  function buildSnapshot(input = {}, previousSnapshot = null, meta = {}) {
    const rows = buildRows(input);
    const invariants = validateRows(rows, meta.tolerance ?? TOLERANCE);
    const fingerprint = snapshotFingerprint(input, rows);
    const previousTrail = Array.isArray(previousSnapshot?.auditTrail) ? previousSnapshot.auditTrail : [];
    const changed = previousSnapshot?.fingerprint !== fingerprint;
    const auditTrail = changed
      ? [...previousTrail, { at: meta.generatedAt || new Date().toISOString(), reason: text(meta.reason || "calculation"), fingerprint }].slice(-50)
      : previousTrail.slice();
    return {
      schemaId: SCHEMA_ID,
      generatedAt: meta.generatedAt || new Date().toISOString(),
      reason: text(meta.reason || "calculation"),
      fingerprint,
      source: "canonical-engine",
      rows,
      annualSummary: annualSummary(rows),
      invariants,
      auditTrail,
    };
  }

  // A scenario is the single public calculation contract consumed by the app.
  // The snapshot remains available for audit and persistence compatibility.
  function buildScenario(input = {}, previousSnapshot = null, meta = {}) {
    const snapshot = buildSnapshot(input, previousSnapshot, meta);
    return {
      schemaId: SCHEMA_ID,
      source: "canonical-engine",
      generatedAt: snapshot.generatedAt,
      fingerprint: snapshot.fingerprint,
      snapshot,
      rows: snapshot.rows,
      annualSummary: snapshot.annualSummary,
      invariants: snapshot.invariants,
    };
  }

  return {
    SCHEMA_ID,
    TOLERANCE,
    NUMERIC_FIELDS,
    buildRows,
    buildSnapshot,
    buildScenario,
    validateRows,
    compareRows,
  };
});
