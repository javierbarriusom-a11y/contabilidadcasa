(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.FinanceCanonicalE9BankImport = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const SCHEMA_ID = "finance-e9-bank-import/v1";
  const text = (value) => String(value ?? "").trim();
  const list = (value) => (Array.isArray(value) ? value : []);
  function hash(value) { let result = 2166136261; const source = JSON.stringify(value); for (let i = 0; i < source.length; i += 1) { result ^= source.charCodeAt(i); result = Math.imul(result, 16777619); } return (result >>> 0).toString(36); }
  function identity(row = {}) {
    return text(row.externalId) ? `${text(row.provider)}:${text(row.providerAccountId)}:id:${text(row.externalId)}` : `${text(row.provider)}:${text(row.providerAccountId)}:fp:${hash([row.bookingDate, Number(row.amount), row.currency, text(row.description).toLowerCase()])}`;
  }
  function comparable(row = {}) { return { status: row.status, bookingDate: row.bookingDate, valueDate: row.valueDate, amount: Number(row.amount), currency: row.currency, description: row.description, counterparty: row.counterparty }; }
  function createInboxBatch(input = {}) {
    const existing = new Map(list(input.existingEntries).map((row) => [row.identity || identity(row), row]));
    const added = [], unchanged = [], corrected = [];
    list(input.transactions).forEach((row) => {
      const key = identity(row); const previous = existing.get(key);
      const entry = { schemaId: SCHEMA_ID, identity: key, connectionId: text(input.connectionId), ...row, inboxStatus: "pending-review", importedAt: text(input.at) || new Date().toISOString(), rawStored: false };
      if (!previous) { existing.set(key, entry); added.push(entry); }
      else if (JSON.stringify(comparable(previous)) === JSON.stringify(comparable(entry))) unchanged.push(previous);
      else { const revision = { ...entry, inboxStatus: "corrected", previous: comparable(previous) }; existing.set(key, revision); corrected.push(revision); }
    });
    const batchId = text(input.id) || `bank-batch:${text(input.connectionId)}:${hash([...added, ...corrected].map((row) => row.identity))}`;
    return { schemaId: SCHEMA_ID, id: batchId, connectionId: text(input.connectionId), status: "pending-review", createdAt: text(input.at) || new Date().toISOString(), added, corrected, unchangedCount: unchanged.length, entries: [...added, ...corrected], writesLedgerImmediately: false };
  }
  function compareWithLedger(batch, ledger = []) {
    const ledgerKeys = new Set(list(ledger).map((row) => text(row.bankIdentity || row.externalIdentity || row.identity)).filter(Boolean));
    const duplicates = batch.entries.filter((row) => ledgerKeys.has(row.identity));
    const candidates = batch.entries.filter((row) => !ledgerKeys.has(row.identity));
    const monthlyEffect = candidates.reduce((acc, row) => { const month = text(row.bookingDate).slice(0, 7); acc[month] = Math.round(((acc[month] || 0) + Number(row.amount || 0)) * 100) / 100; return acc; }, {});
    return { schemaId: SCHEMA_ID, batchId: batch.id, candidates, duplicates, monthlyEffect, valid: candidates.every((row) => row.identity && /^\d{4}-\d{2}-\d{2}$/.test(row.bookingDate) && Number.isFinite(Number(row.amount))), writesLedgerImmediately: false };
  }
  function confirmImport(batch, comparison, options = {}) {
    if (!options.userConfirmed) throw new Error("La importación bancaria requiere confirmación explícita.");
    const reason = text(options.reason); if (!reason) throw new Error("La importación bancaria requiere un motivo.");
    if (batch.status !== "pending-review" || comparison.batchId !== batch.id || !comparison.valid) throw new Error("La comparación bancaria no es válida.");
    return { batch: { ...batch, status: "confirmed", confirmedAt: text(options.at) || new Date().toISOString(), reason }, handoff: { type: "confirmed-bank-import", batchId: batch.id, entries: comparison.candidates, requiresCanonicalImport: true, executed: false } };
  }
  function scheduleDecision(input = {}) {
    const now = new Date(input.now || Date.now());
    if (input.connectionStatus !== "active") return { due: false, reason: "connection-inactive" };
    if (!input.consentActive) return { due: false, reason: "consent-missing" };
    if (input.pendingBatchCount > 0) return { due: false, reason: "review-pending" };
    const nextAt = input.nextSyncAt ? new Date(input.nextSyncAt) : null;
    if (nextAt && nextAt > now) return { due: false, reason: "not-due", nextSyncAt: nextAt.toISOString() };
    return { due: true, reason: "scheduled", requestedAt: now.toISOString(), idempotencyKey: `sync:${text(input.connectionId)}:${now.toISOString().slice(0, 10)}` };
  }
  function nextAttempt(input = {}) {
    const attempt = Math.max(1, Number(input.attempt || 1));
    const delayMinutes = Math.min(1440, 5 * (2 ** (attempt - 1)));
    return new Date(new Date(input.at || Date.now()).getTime() + delayMinutes * 60000).toISOString();
  }
  return { SCHEMA_ID, compareWithLedger, confirmImport, createInboxBatch, identity, nextAttempt, scheduleDecision };
});
