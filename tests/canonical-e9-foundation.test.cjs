const assert = require("node:assert/strict");
const test = require("node:test");
const e9 = require("../canonical-e9-foundation.js");

test("todos los servicios externos nacen apagados y conservan fallback local", () => {
  const foundation = e9.createFoundation({ updatedAt: "2026-08-01T10:00:00.000Z" });
  Object.keys(e9.SERVICES).forEach((service) => assert.equal(foundation.enabled[service], false));
  assert.deepEqual(e9.serviceAccess(foundation, "assistant"), {
    allowed: false, reason: "service-disabled", fallback: "local",
  });
});

test("el consentimiento exige finalidad y scopes cerrados", () => {
  const foundation = e9.createFoundation();
  assert.throws(() => e9.grantConsent(foundation, { service: "assistant", scopes: ["finance:write"], purpose: "Ayuda" }), /permisos no autorizados/);
  assert.throws(() => e9.grantConsent(foundation, { service: "assistant", scopes: ["finance:read"] }), /finalidad concreta/);
});

test("conceder y revocar consentimiento deja trazabilidad e impide nuevos accesos", () => {
  const granted = e9.grantConsent(e9.createFoundation(), {
    service: "assistant", purpose: "Responder preguntas financieras", scopes: ["finance:read", "assistant:query"], at: "2026-08-01T11:00:00.000Z",
  });
  assert.equal(e9.serviceAccess(granted, "assistant", ["assistant:query"], { at: "2026-08-01T11:01:00.000Z" }).allowed, true);
  const revoked = e9.revokeConsent(granted, "assistant", { at: "2026-08-01T11:02:00.000Z", reason: "Decisión del usuario" });
  assert.equal(e9.serviceAccess(revoked, "assistant", ["assistant:query"]).allowed, false);
  assert.deepEqual(revoked.audit.map((row) => row.type), ["consent-granted", "consent-revoked"]);
});

test("renovar un consentimiento conserva la concesión anterior como revocada", () => {
  const first = e9.grantConsent(e9.createFoundation(), {
    id: "consent-1", service: "assistant", purpose: "Primera finalidad", scopes: ["finance:read"], at: "2026-08-01T10:00:00.000Z",
  });
  const renewed = e9.grantConsent(first, {
    id: "consent-2", service: "assistant", purpose: "Finalidad renovada", scopes: ["finance:read"], at: "2026-08-01T12:00:00.000Z",
  });
  assert.deepEqual(renewed.consents.map((row) => [row.id, row.status]), [["consent-1", "revoked"], ["consent-2", "active"]]);
});

test("una caída remota nunca impide continuar en local", () => {
  const granted = e9.grantConsent(e9.createFoundation(), {
    service: "notifications", purpose: "Avisos solicitados", scopes: ["alerts:read", "notifications:send"],
  });
  assert.deepEqual(e9.serviceAccess(granted, "notifications", [], { remoteAvailable: false }), {
    allowed: false, reason: "remote-unavailable", fallback: "local",
  });
});

test("el cliente rechaza secretos y minimiza cada payload", () => {
  assert.throws(() => e9.rejectClientSecrets({ nested: { access_token: "no" } }), /Secreto no permitido/);
  assert.deepEqual(e9.minimizePayload("assistant", {
    question: "¿Qué puedo ahorrar?", readModel: { capacity: 10 }, provenance: { revision: 2 }, fullState: { private: true },
  }), {
    question: "¿Qué puedo ahorrar?", readModel: { capacity: 10 }, provenance: { revision: 2 },
  });
});

test("las notificaciones solo aceptan el mensaje seguro y referencias opacas", () => {
  assert.deepEqual(e9.minimizePayload("notifications", {
    alertId: "alert-1", category: "cash", safeMessage: "Tienes una alerta pendiente", target: "alerts", amount: 1200, iban: "ES00",
  }), { alertId: "alert-1", category: "cash", safeMessage: "Tienes una alerta pendiente", target: "alerts" });
});
