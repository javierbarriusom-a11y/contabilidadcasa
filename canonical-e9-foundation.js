(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.FinanceCanonicalE9Foundation = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const SCHEMA_ID = "finance-e9-foundation/v1";
  const SERVICES = Object.freeze({
    household: { scopes: ["household:read", "household:share"], allowedData: ["householdProfile", "ownership", "permissions"] },
    assistant: { scopes: ["finance:read", "assistant:query"], allowedData: ["question", "readModel", "provenance"] },
    actions: { scopes: ["finance:read", "drafts:prepare"], allowedData: ["draft", "preview", "provenance"] },
    notifications: { scopes: ["alerts:read", "notifications:send"], allowedData: ["alertId", "category", "safeMessage", "target"] },
    banking: { scopes: ["accounts:read", "transactions:read"], allowedData: ["connectionId", "accounts", "transactions", "cursor"] },
  });
  const SECRET_KEYS = /(^|_)(secret|token|password|credential|api[_-]?key|access[_-]?key|refresh[_-]?token)($|_)/i;
  const SENSITIVE_NOTIFICATION_KEYS = new Set(["amount", "balance", "bank", "creditor", "debt", "accountNumber", "iban"]);

  const text = (value) => String(value ?? "").trim();
  const list = (value) => (Array.isArray(value) ? value : []);
  const object = (value) => (value && typeof value === "object" && !Array.isArray(value) ? value : {});
  const unique = (values) => [...new Set(list(values).map(text).filter(Boolean))];
  const nowIso = (value) => text(value) || new Date().toISOString();

  function serviceDefinition(service) {
    const definition = SERVICES[text(service)];
    if (!definition) throw new Error("Servicio externo no reconocido.");
    return definition;
  }

  function createFoundation(seed = {}) {
    const enabled = object(seed.enabled);
    return {
      schemaId: SCHEMA_ID,
      localFirst: true,
      enabled: Object.fromEntries(Object.keys(SERVICES).map((service) => [service, enabled[service] === true])),
      consents: list(seed.consents).map((row) => ({ ...row })),
      audit: list(seed.audit).map((row) => ({ ...row })).slice(-500),
      updatedAt: nowIso(seed.updatedAt),
    };
  }

  function normalizeFoundation(value) {
    return value?.schemaId === SCHEMA_ID ? createFoundation(value) : createFoundation();
  }

  function auditEvent(type, service, at, details = {}) {
    const safeDetails = rejectClientSecrets(details);
    return {
      id: `${type}:${service}:${at}`,
      type,
      service,
      at,
      details: safeDetails,
    };
  }

  function grantConsent(foundation, input = {}) {
    const next = normalizeFoundation(foundation);
    const service = text(input.service);
    const definition = serviceDefinition(service);
    const scopes = unique(input.scopes);
    if (!scopes.length || scopes.some((scope) => !definition.scopes.includes(scope))) {
      throw new Error("El consentimiento contiene permisos no autorizados para el servicio.");
    }
    const purpose = text(input.purpose);
    if (!purpose) throw new Error("El consentimiento requiere una finalidad concreta.");
    const at = nowIso(input.at);
    const record = {
      id: text(input.id) || `consent:${service}:${at}`,
      service,
      purpose,
      scopes,
      status: "active",
      grantedAt: at,
      expiresAt: text(input.expiresAt),
      revokedAt: "",
    };
    next.consents = [
      ...next.consents.map((row) => row.service === service && row.status === "active"
        ? { ...row, status: "revoked", revokedAt: at }
        : row),
      record,
    ];
    next.enabled[service] = true;
    next.audit = [...next.audit, auditEvent("consent-granted", service, at, { consentId: record.id, purpose, scopes })].slice(-500);
    next.updatedAt = at;
    return next;
  }

  function revokeConsent(foundation, serviceValue, options = {}) {
    const next = normalizeFoundation(foundation);
    const service = text(serviceValue);
    serviceDefinition(service);
    const at = nowIso(options.at);
    let changed = false;
    next.consents = next.consents.map((row) => {
      if (row.service !== service || row.status !== "active") return row;
      changed = true;
      return { ...row, status: "revoked", revokedAt: at };
    });
    next.enabled[service] = false;
    if (changed) next.audit = [...next.audit, auditEvent("consent-revoked", service, at, { reason: text(options.reason) })].slice(-500);
    next.updatedAt = at;
    return next;
  }

  function activeConsent(foundation, serviceValue, atValue) {
    const state = normalizeFoundation(foundation);
    const service = text(serviceValue);
    serviceDefinition(service);
    const at = nowIso(atValue);
    return state.consents.find((row) => row.service === service && row.status === "active"
      && (!row.expiresAt || row.expiresAt > at)) || null;
  }

  function serviceAccess(foundation, serviceValue, requiredScopes = [], options = {}) {
    const state = normalizeFoundation(foundation);
    const service = text(serviceValue);
    serviceDefinition(service);
    if (!state.enabled[service]) return { allowed: false, reason: "service-disabled", fallback: "local" };
    if (options.remoteAvailable === false) return { allowed: false, reason: "remote-unavailable", fallback: "local" };
    const consent = activeConsent(state, service, options.at);
    if (!consent) return { allowed: false, reason: "consent-missing-or-expired", fallback: "local" };
    const missingScopes = unique(requiredScopes).filter((scope) => !consent.scopes.includes(scope));
    if (missingScopes.length) return { allowed: false, reason: "scope-missing", missingScopes, fallback: "local" };
    return { allowed: true, consentId: consent.id, fallback: "local" };
  }

  function rejectClientSecrets(value, path = "payload") {
    if (Array.isArray(value)) return value.map((item, index) => rejectClientSecrets(item, `${path}[${index}]`));
    if (!value || typeof value !== "object") return value;
    const result = {};
    Object.entries(value).forEach(([key, child]) => {
      if (SECRET_KEYS.test(key)) throw new Error(`Secreto no permitido en cliente: ${path}.${key}`);
      result[key] = rejectClientSecrets(child, `${path}.${key}`);
    });
    return result;
  }

  function minimizePayload(serviceValue, payload = {}) {
    const service = text(serviceValue);
    const definition = serviceDefinition(service);
    const source = rejectClientSecrets(object(payload));
    const minimized = Object.fromEntries(definition.allowedData.filter((key) => Object.hasOwn(source, key)).map((key) => [key, source[key]]));
    if (service === "notifications") {
      Object.keys(minimized).forEach((key) => {
        if (SENSITIVE_NOTIFICATION_KEYS.has(key)) delete minimized[key];
      });
    }
    return minimized;
  }

  return {
    SCHEMA_ID,
    SERVICES,
    activeConsent,
    createFoundation,
    grantConsent,
    minimizePayload,
    normalizeFoundation,
    rejectClientSecrets,
    revokeConsent,
    serviceAccess,
  };
});
