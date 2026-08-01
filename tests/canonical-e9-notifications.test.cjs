const assert = require("node:assert/strict");
const test = require("node:test");
const notifications = require("../canonical-e9-notifications.js");
const enabled = { enabled: true, frequency: "daily", quietStart: "22:00", quietEnd: "08:00", subscriptionId: "subscription-1" };
test("web push nace desactivado y siempre conserva el centro local", () => {
  const result = notifications.deliveryDecision({ preferences: {}, consentActive: true });
  assert.deepEqual(result, { send: false, reason: "channel-disabled", fallback: "app" });
});
test("requiere consentimiento y una suscripción opaca", () => {
  assert.equal(notifications.deliveryDecision({ preferences: enabled, consentActive: false }).reason, "consent-missing");
  assert.equal(notifications.deliveryDecision({ preferences: { ...enabled, subscriptionId: "" }, consentActive: true }).reason, "subscription-missing");
});
test("el mensaje bloqueado nunca contiene importes, bancos ni deudas", () => {
  const payload = notifications.safePayload({ id: "alert-1", category: "cash", target: "alerts-center", amount: 1234, bank: "Banco", debt: "Tarjeta" });
  assert.deepEqual(payload, { schemaId: notifications.SCHEMA_ID, alertId: "alert-1", category: "cash", title: "Finanzas Casa", body: "Tienes una alerta de liquidez pendiente.", target: "alerts-center", containsSensitiveAmounts: false });
  assert.doesNotMatch(JSON.stringify(payload), /1234|Banco|Tarjeta/);
});
test("respeta silencio, silenciado manual y frecuencia", () => {
  assert.equal(notifications.deliveryDecision({ preferences: enabled, consentActive: true, localTime: "23:30", now: "2026-08-01T21:30:00Z" }).reason, "quiet-hours");
  assert.equal(notifications.deliveryDecision({ preferences: { ...enabled, mutedUntil: "2026-08-02" }, consentActive: true, localTime: "12:00", now: "2026-08-01T10:00:00Z" }).reason, "muted");
  assert.equal(notifications.deliveryDecision({ preferences: enabled, consentActive: true, localTime: "12:00", now: "2026-08-01T10:00:00Z", lastDeliveredAt: "2026-08-01T09:00:00Z" }).reason, "frequency-limited");
});
test("deduplica reintentos de la misma alerta y revisión", () => {
  const alert = { id: "alert-1", category: "quality" }; const key = notifications.dedupeKey(alert, "review-1");
  assert.equal(notifications.deliveryDecision({ preferences: enabled, consentActive: true, alert, reviewKey: "review-1", deliveredKeys: [key], localTime: "12:00" }).reason, "duplicate");
});
test("una entrega segura produce un recibo mínimo", () => {
  const decision = notifications.deliveryDecision({ preferences: enabled, consentActive: true, alert: { id: "alert-1", category: "planning", target: "update-data" }, reviewKey: "review-1", localTime: "12:00" });
  assert.equal(decision.send, true);
  const receipt = notifications.deliveryReceipt(decision, { status: "delivered", providerMessageId: "msg-1", at: "2026-08-01T12:00:00Z" });
  assert.deepEqual(receipt.payload, { alertId: "alert-1", category: "planning", target: "update-data" });
  assert.equal(receipt.status, "delivered");
});
