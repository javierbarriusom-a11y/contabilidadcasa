(function attachCanonicalLedger(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalLedger = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function canonicalLedgerFactory() {
  "use strict";

  const SCHEMA_ID = "finance-canonical-ledger/v1";
  const TOLERANCE = 0.02;

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

  function transactionFingerprint(transaction) {
    return [
      text(transaction.date), text(transaction.valueDate), text(transaction.movement).toLowerCase(),
      text(transaction.details).toLowerCase(), round(transaction.amount),
      transaction.balance === null || transaction.balance === undefined ? "" : round(transaction.balance),
      text(transaction.accountId || "caixabank"),
    ].join("|");
  }

  function normalizeTransaction(transaction, index, seen) {
    const fingerprint = transactionFingerprint(transaction);
    const occurrence = (seen.get(fingerprint) || 0) + 1;
    seen.set(fingerprint, occurrence);
    const amount = round(transaction.amount);
    const mapping = transaction.mapping?.status === "classified"
      ? {
          status: "classified",
          rowKey: text(transaction.mapping.rowKey),
          rowId: text(transaction.mapping.rowId),
          label: text(transaction.mapping.label),
          sectionName: text(transaction.mapping.sectionName),
          source: text(transaction.mapping.source || "manual"),
        }
      : { status: "unclassified" };
    return {
      id: `tx-${hash(fingerprint)}-${occurrence}`,
      fingerprint,
      duplicateOf: occurrence > 1 ? `tx-${hash(fingerprint)}-1` : null,
      date: text(transaction.date),
      valueDate: text(transaction.valueDate || transaction.date),
      monthKey: text(transaction.month || transaction.date).slice(0, 7),
      kind: amount >= 0 ? "income" : "expense",
      signedAmount: amount,
      amount: Math.abs(amount),
      balanceAfter: transaction.balance === null || transaction.balance === undefined ? null : round(transaction.balance),
      accountId: text(transaction.accountId || "caixabank"),
      description: text(transaction.details ? `${transaction.movement} · ${transaction.details}` : transaction.movement),
      source: text(transaction.source || "extracto bancario"),
      sourceRow: Number.isFinite(Number(transaction.sourceRow ?? transaction.statementOrder))
        ? Number(transaction.sourceRow ?? transaction.statementOrder)
        : index,
      mapping,
    };
  }

  function evaluateContinuity(rows, orientation) {
    const ordered = rows.slice().sort((a, b) => a.sourceRow - b.sourceRow);
    const chronological = orientation === "oldest-first" ? ordered : ordered.reverse();
    const gaps = [];
    let totalError = 0;
    for (let index = 1; index < chronological.length; index += 1) {
      const previous = chronological[index - 1];
      const current = chronological[index];
      if (previous.balanceAfter === null || current.balanceAfter === null) continue;
      const expected = round(previous.balanceAfter + current.signedAmount);
      const error = Math.abs(round(current.balanceAfter - expected));
      totalError += error;
      if (error > TOLERANCE) gaps.push({ previousId: previous.id, currentId: current.id, expected, actual: current.balanceAfter, error: round(error) });
    }
    return { orientation, gaps, totalError: round(totalError), checkedPairs: Math.max(0, chronological.length - 1) };
  }

  function buildBalanceChecks(entries) {
    const grouped = new Map();
    entries.forEach((entry) => {
      if (entry.balanceAfter === null) return;
      if (!grouped.has(entry.accountId)) grouped.set(entry.accountId, []);
      grouped.get(entry.accountId).push(entry);
    });
    return [...grouped.entries()].map(([accountId, rows]) => {
      const oldest = evaluateContinuity(rows, "oldest-first");
      const newest = evaluateContinuity(rows, "newest-first");
      const selected = oldest.gaps.length < newest.gaps.length ||
        (oldest.gaps.length === newest.gaps.length && oldest.totalError <= newest.totalError) ? oldest : newest;
      return { accountId, transactionCount: rows.length, ...selected };
    });
  }

  function normalizeActual(actual, index) {
    return {
      id: text(actual.id || `actual-${index}`),
      kind: actual.kind === "income" ? "income" : "expense",
      rowId: text(actual.rowId),
      rowKey: text(actual.rowKey),
      label: text(actual.label || "Dato real"),
      monthKey: text(actual.monthKey).slice(0, 7),
      amount: Math.abs(round(actual.amount)),
      source: text(actual.source || "detalle mensual"),
    };
  }

  function buildReconciliation(entries, actuals) {
    const bankMonths = new Set(entries.map((entry) => entry.monthKey).filter(Boolean));
    const months = [...bankMonths].sort();
    const rows = months.map((monthKey) => {
      const monthEntries = entries.filter((entry) => entry.monthKey === monthKey && !entry.duplicateOf);
      const monthActuals = actuals.filter((actual) => actual.monthKey === monthKey);
      const bankIncome = round(monthEntries.filter((entry) => entry.kind === "income").reduce((sum, entry) => sum + entry.amount, 0));
      const bankExpense = round(monthEntries.filter((entry) => entry.kind === "expense").reduce((sum, entry) => sum + entry.amount, 0));
      const actualIncome = round(monthActuals.filter((actual) => actual.kind === "income").reduce((sum, actual) => sum + actual.amount, 0));
      const actualExpense = round(monthActuals.filter((actual) => actual.kind === "expense").reduce((sum, actual) => sum + actual.amount, 0));
      const unclassifiedCount = monthEntries.filter((entry) => entry.mapping.status !== "classified").length;
      const duplicateCount = entries.filter((entry) => entry.monthKey === monthKey && entry.duplicateOf).length;
      const incomeDelta = round(bankIncome - actualIncome);
      const expenseDelta = round(bankExpense - actualExpense);
      const status = unclassifiedCount ? "pending-classification"
        : Math.abs(incomeDelta) <= TOLERANCE && Math.abs(expenseDelta) <= TOLERANCE ? "matched" : "difference";
      return { monthKey, bankIncome, bankExpense, actualIncome, actualExpense, incomeDelta, expenseDelta, unclassifiedCount, duplicateCount, status };
    });

    const lineMap = new Map();
    entries.filter((entry) => !entry.duplicateOf && entry.mapping.status === "classified").forEach((entry) => {
      const key = `${entry.monthKey}|${entry.kind}|${entry.mapping.rowKey}`;
      if (!lineMap.has(key)) lineMap.set(key, { monthKey: entry.monthKey, kind: entry.kind, rowKey: entry.mapping.rowKey, label: entry.mapping.label, bankAmount: 0, actualAmount: 0 });
      lineMap.get(key).bankAmount += entry.amount;
    });
    actuals.filter((actual) => bankMonths.has(actual.monthKey)).forEach((actual) => {
      const key = `${actual.monthKey}|${actual.kind}|${actual.rowKey}`;
      if (!lineMap.has(key)) lineMap.set(key, { monthKey: actual.monthKey, kind: actual.kind, rowKey: actual.rowKey, label: actual.label, bankAmount: 0, actualAmount: 0 });
      lineMap.get(key).actualAmount += actual.amount;
    });
    const lines = [...lineMap.values()].map((line) => ({
      ...line,
      bankAmount: round(line.bankAmount), actualAmount: round(line.actualAmount),
      delta: round(line.bankAmount - line.actualAmount),
    })).sort((a, b) => `${b.monthKey}|${a.label}`.localeCompare(`${a.monthKey}|${b.label}`, "es"));
    return { months: rows, lines };
  }

  function buildLedgerSnapshot(input = {}, previousSnapshot = null, meta = {}) {
    const seen = new Map();
    const entries = (input.transactions || []).map((transaction, index) => normalizeTransaction(transaction, index, seen));
    const actuals = (input.actuals || []).map(normalizeActual);
    const balanceChecks = buildBalanceChecks(entries.filter((entry) => !entry.duplicateOf));
    const reconciliation = buildReconciliation(entries, actuals);
    const duplicateCount = entries.filter((entry) => entry.duplicateOf).length;
    const unclassifiedCount = entries.filter((entry) => !entry.duplicateOf && entry.mapping.status !== "classified").length;
    const balanceGapCount = balanceChecks.reduce((sum, check) => sum + check.gaps.length, 0);
    const usableCount = entries.length - duplicateCount;
    const classifiedCount = usableCount - unclassifiedCount;
    const coverage = usableCount ? Math.round((classifiedCount / usableCount) * 100) : 100;
    const differenceMonths = reconciliation.months.filter((month) => month.status !== "matched").length;
    const score = Math.max(0, Math.min(100, coverage - duplicateCount * 2 - balanceGapCount * 5 - differenceMonths));
    const fingerprint = hash(JSON.stringify({ entries, actuals, reconciliation, balanceChecks }));
    const previousFingerprint = previousSnapshot?.fingerprint || null;
    return {
      schemaId: SCHEMA_ID,
      generatedAt: new Date().toISOString(),
      reason: text(meta.reason || "rebuild"),
      fingerprint,
      entries,
      actuals,
      reconciliation,
      balanceChecks,
      quality: { score, coverage, transactionCount: entries.length, usableCount, classifiedCount, unclassifiedCount, duplicateCount, balanceGapCount, differenceMonths },
      auditTrail: [
        ...(Array.isArray(previousSnapshot?.auditTrail) ? previousSnapshot.auditTrail.slice(-19) : []),
        ...(fingerprint !== previousFingerprint ? [{ at: new Date().toISOString(), reason: text(meta.reason || "rebuild"), fingerprint, previousFingerprint }] : []),
      ],
    };
  }

  return { SCHEMA_ID, buildLedgerSnapshot, transactionFingerprint };
});
