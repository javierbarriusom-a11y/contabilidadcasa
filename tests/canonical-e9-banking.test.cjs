const assert = require("node:assert/strict");
const test = require("node:test");
const bank = require("../canonical-e9-banking.js");
test("la conexión PSD2 es siempre de solo lectura y conserva fallback manual", () => {
  const connection = bank.createConnection({ provider: "gocardless-bank-account-data" });
  assert.equal(connection.readOnly, true); assert.deepEqual(connection.scopes, ["accounts:read", "balances:read", "transactions:read"]); assert.equal(connection.fallback, "manual-import");
});
test("el ciclo de autorización, reautorización y revocación es explícito", () => {
  let connection = bank.createConnection({ id: "connection-1" });
  connection = bank.transition(connection, "authorizing"); connection = bank.transition(connection, "active"); connection = bank.transition(connection, "reauth-required"); connection = bank.transition(connection, "authorizing"); connection = bank.transition(connection, "active"); connection = bank.transition(connection, "revoked");
  assert.equal(connection.status, "revoked"); assert.equal(connection.consentId, ""); assert.throws(() => bank.transition(connection, "active"), /no permitida/);
});
test("normaliza cuenta, saldo y movimientos sin conservar respuestas crudas", () => {
  const account = bank.normalizeAccount("gocardless", { id: "acc-1", iban: "ES0012345678901234567890", currency: "EUR", displayName: "Principal" });
  assert.equal(account.maskedReference, "ES00••••7890"); assert.equal(account.rawStored, false);
  assert.deepEqual(bank.normalizeBalance({ balanceAmount: { amount: "1200.55", currency: "EUR" }, balanceType: "closingBooked", referenceDate: "2026-08-01" }), { amount: 1200.55, currency: "EUR", type: "closingBooked", asOf: "2026-08-01" });
  const rows = bank.normalizeTransactionResponse("gocardless", "acc-1", { transactions: { booked: [{ transactionId: "tx-1", bookingDate: "2026-08-01", transactionAmount: { amount: "-12.34", currency: "EUR" }, remittanceInformationUnstructured: "Compra" }], pending: [] } });
  assert.equal(rows[0].amount, -12.34); assert.equal(rows[0].rawStored, false);
});
test("caducidad, revocación y caída nunca bloquean la importación manual", () => {
  const connection = bank.createConnection({ id: "connection-1", status: "active", consentExpiresAt: "2026-08-02T00:00:00Z" });
  assert.equal(bank.accessDecision(connection, { consentActive: true, now: "2026-08-03T00:00:00Z" }).nextStatus, "reauth-required");
  assert.equal(bank.accessDecision(connection, { consentActive: true, remoteAvailable: false }).fallback, "manual-import");
  assert.equal(bank.accessDecision(bank.createConnection(), { consentActive: true }).fallback, "manual-import");
});
