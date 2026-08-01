(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.FinanceCanonicalE9Banking = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const SCHEMA_ID = "finance-e9-banking/v1";
  const PROVIDER_CONTRACT = "psd2-ais-read-only/v1";
  const STATUSES = ["disconnected", "authorizing", "active", "reauth-required", "revoked", "error"];
  const text = (value) => String(value ?? "").trim();
  const list = (value) => (Array.isArray(value) ? value : []);
  function createConnection(input = {}) {
    const status = STATUSES.includes(input.status) ? input.status : "disconnected";
    return { schemaId: SCHEMA_ID, providerContract: PROVIDER_CONTRACT, id: text(input.id), provider: text(input.provider), status, readOnly: true, scopes: ["accounts:read", "balances:read", "transactions:read"], consentId: text(input.consentId), consentExpiresAt: text(input.consentExpiresAt), lastSyncedAt: text(input.lastSyncedAt), nextSyncAt: text(input.nextSyncAt), errorCode: text(input.errorCode), fallback: "manual-import" };
  }
  function transition(connection, nextStatus, options = {}) {
    if (!STATUSES.includes(nextStatus)) throw new Error("Estado bancario no permitido.");
    const allowed = {
      disconnected: ["authorizing"], authorizing: ["active", "error", "disconnected"], active: ["reauth-required", "revoked", "error"],
      "reauth-required": ["authorizing", "revoked"], error: ["authorizing", "revoked", "disconnected"], revoked: [],
    };
    if (!allowed[connection.status]?.includes(nextStatus)) throw new Error("Transición bancaria no permitida.");
    return createConnection({ ...connection, status: nextStatus, consentId: nextStatus === "revoked" ? "" : connection.consentId, consentExpiresAt: nextStatus === "revoked" ? "" : connection.consentExpiresAt, errorCode: text(options.errorCode), lastSyncedAt: options.lastSyncedAt || connection.lastSyncedAt });
  }
  function maskIban(value) { const iban = text(value).replace(/\s+/g, ""); return iban.length >= 8 ? `${iban.slice(0, 4)}••••${iban.slice(-4)}` : "Cuenta protegida"; }
  function normalizeAccount(provider, input = {}) {
    const providerId = text(input.id || input.resourceId);
    if (!providerId) throw new Error("La cuenta externa requiere identificador estable.");
    return { provider, providerAccountId: providerId, currency: text(input.currency || "EUR"), label: text(input.displayName || input.name || input.details || "Cuenta bancaria"), maskedReference: maskIban(input.iban || input.bban), accountType: text(input.cashAccountType || input.type || "account"), ownerNameAvailable: Boolean(input.ownerName || input.name), rawStored: false };
  }
  function normalizeBalance(input = {}) {
    const source = input.balanceAmount || input;
    const amount = Number(source.amount ?? input.amount);
    if (!Number.isFinite(amount)) throw new Error("Saldo bancario no válido.");
    return { amount: Math.round(amount * 100) / 100, currency: text(source.currency || input.currency || "EUR"), type: text(input.balanceType || input.type || "booked"), asOf: text(input.referenceDate || input.lastChangeDateTime || input.asOf) };
  }
  function normalizeTransaction(provider, accountId, input = {}, status = "booked") {
    const amountSource = input.transactionAmount || {};
    const amount = Number(amountSource.amount ?? input.amount);
    if (!Number.isFinite(amount)) throw new Error("Movimiento bancario no válido.");
    const externalId = text(input.transactionId || input.internalTransactionId || input.entryReference || input.id);
    const bookingDate = text(input.bookingDate || input.bookingDateTime || input.date);
    if (!bookingDate) throw new Error("El movimiento bancario requiere fecha.");
    return { provider, providerAccountId: text(accountId), externalId, status: status === "pending" ? "pending" : "booked", bookingDate: bookingDate.slice(0, 10), valueDate: text(input.valueDate || input.valueDateTime).slice(0, 10), amount: Math.round(amount * 100) / 100, currency: text(amountSource.currency || input.currency || "EUR"), description: text(input.remittanceInformationUnstructured || input.additionalInformation || input.description || input.merchantName), counterparty: text(input.creditorName || input.debtorName || input.counterpartyName), rawStored: false };
  }
  function normalizeTransactionResponse(provider, accountId, response = {}) {
    const transactions = response.transactions || response;
    return [...list(transactions.booked).map((row) => normalizeTransaction(provider, accountId, row, "booked")), ...list(transactions.pending).map((row) => normalizeTransaction(provider, accountId, row, "pending"))];
  }
  function accessDecision(connection, options = {}) {
    if (connection?.status !== "active") return { allowed: false, reason: connection?.status || "disconnected", fallback: "manual-import" };
    if (!options.consentActive) return { allowed: false, reason: "consent-missing", fallback: "manual-import" };
    if (connection.consentExpiresAt && connection.consentExpiresAt <= text(options.now || new Date().toISOString())) return { allowed: false, reason: "consent-expired", nextStatus: "reauth-required", fallback: "manual-import" };
    if (options.remoteAvailable === false) return { allowed: false, reason: "provider-unavailable", fallback: "manual-import" };
    return { allowed: true, readOnly: true, fallback: "manual-import" };
  }
  return { SCHEMA_ID, PROVIDER_CONTRACT, STATUSES, accessDecision, createConnection, maskIban, normalizeAccount, normalizeBalance, normalizeTransaction, normalizeTransactionResponse, transition };
});
