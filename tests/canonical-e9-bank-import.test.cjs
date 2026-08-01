const assert = require("node:assert/strict"); const test = require("node:test"); const imports = require("../canonical-e9-bank-import.js");
const tx = { provider: "gocardless", providerAccountId: "acc-1", externalId: "tx-1", status: "booked", bookingDate: "2026-08-01", valueDate: "2026-08-01", amount: -10, currency: "EUR", description: "Compra", counterparty: "Comercio" };
test("la sincronización entra en bandeja y no escribe el libro", () => {
  const batch = imports.createInboxBatch({ connectionId: "connection-1", transactions: [tx], at: "2026-08-01T10:00:00Z" });
  assert.equal(batch.entries.length, 1); assert.equal(batch.status, "pending-review"); assert.equal(batch.writesLedgerImmediately, false);
});
test("reintentar el mismo movimiento es idempotente y una corrección queda visible", () => {
  const first = imports.createInboxBatch({ connectionId: "connection-1", transactions: [tx] });
  const same = imports.createInboxBatch({ connectionId: "connection-1", transactions: [tx], existingEntries: first.entries });
  assert.equal(same.entries.length, 0); assert.equal(same.unchangedCount, 1);
  const changed = imports.createInboxBatch({ connectionId: "connection-1", transactions: [{ ...tx, amount: -12 }], existingEntries: first.entries });
  assert.equal(changed.corrected.length, 1); assert.equal(changed.corrected[0].previous.amount, -10);
});
test("sin identificador externo usa una huella estable", () => {
  const left = imports.identity({ ...tx, externalId: "" }); const right = imports.identity({ ...tx, externalId: "" }); assert.equal(left, right);
});
test("la comparación separa duplicados y efectos mensuales", () => {
  const batch = imports.createInboxBatch({ connectionId: "connection-1", transactions: [tx, { ...tx, externalId: "tx-2", amount: 100 }] });
  const comparison = imports.compareWithLedger(batch, [{ bankIdentity: imports.identity(tx) }]);
  assert.equal(comparison.duplicates.length, 1); assert.equal(comparison.candidates.length, 1); assert.equal(comparison.monthlyEffect["2026-08"], 100);
});
test("confirmar exige gesto y motivo y no ejecuta automáticamente", () => {
  const batch = imports.createInboxBatch({ connectionId: "connection-1", transactions: [tx] }); const comparison = imports.compareWithLedger(batch, []);
  assert.throws(() => imports.confirmImport(batch, comparison, {}), /confirmación explícita/);
  assert.throws(() => imports.confirmImport(batch, comparison, { userConfirmed: true }), /motivo/);
  const confirmed = imports.confirmImport(batch, comparison, { userConfirmed: true, reason: "Movimientos revisados" });
  assert.equal(confirmed.handoff.requiresCanonicalImport, true); assert.equal(confirmed.handoff.executed, false);
});
test("el programador espera revisiones pendientes y aplica backoff acotado", () => {
  assert.equal(imports.scheduleDecision({ connectionStatus: "active", consentActive: true, pendingBatchCount: 1 }).reason, "review-pending");
  assert.equal(imports.scheduleDecision({ connectionStatus: "active", consentActive: true, pendingBatchCount: 0, connectionId: "c1", now: "2026-08-01T10:00:00Z" }).due, true);
  assert.equal(imports.nextAttempt({ attempt: 20, at: "2026-08-01T00:00:00Z" }), "2026-08-02T00:00:00.000Z");
});
