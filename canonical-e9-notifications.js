(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.FinanceCanonicalE9Notifications = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const SCHEMA_ID = "finance-e9-notifications/v1";
  const CHANNEL = "web-push";
  const FREQUENCIES = { immediate: 0, daily: 86400000, weekly: 7 * 86400000, monthly: 28 * 86400000 };
  const SAFE_MESSAGES = Object.freeze({
    cash: "Tienes una alerta de liquidez pendiente.",
    planning: "Tienes una revisión de planificación pendiente.",
    quality: "Tienes una revisión de datos pendiente.",
    general: "Tienes una alerta financiera pendiente.",
  });
  const TARGETS = new Set(["alerts-center", "data-audit", "update-data", "executive-advisor"]);
  const text = (value) => String(value ?? "").trim();
  function validTime(value, fallback) { return /^([01]\d|2[0-3]):[0-5]\d$/.test(text(value)) ? text(value) : fallback; }
  function minutes(value) { const [hour, minute] = value.split(":").map(Number); return hour * 60 + minute; }
  function normalizePreferences(input = {}) {
    return {
      schemaId: SCHEMA_ID,
      channel: CHANNEL,
      enabled: input.enabled === true,
      frequency: Object.hasOwn(FREQUENCIES, input.frequency) ? input.frequency : "daily",
      quietStart: validTime(input.quietStart, "22:00"),
      quietEnd: validTime(input.quietEnd, "08:00"),
      mutedUntil: text(input.mutedUntil),
      subscriptionId: text(input.subscriptionId),
      updatedAt: text(input.updatedAt) || new Date().toISOString(),
    };
  }
  function inQuietHours(preferences, localTime) {
    const now = minutes(validTime(localTime, "12:00"));
    const start = minutes(preferences.quietStart), end = minutes(preferences.quietEnd);
    return start === end ? false : start < end ? now >= start && now < end : now >= start || now < end;
  }
  function safePayload(alert = {}) {
    const category = Object.hasOwn(SAFE_MESSAGES, alert.category) ? alert.category : "general";
    const target = TARGETS.has(alert.target) ? alert.target : "alerts-center";
    return { schemaId: SCHEMA_ID, alertId: text(alert.id), category, title: "Finanzas Casa", body: SAFE_MESSAGES[category], target, containsSensitiveAmounts: false };
  }
  function dedupeKey(alert = {}, reviewKey = "") { return `${CHANNEL}:${text(alert.id)}:${text(reviewKey || alert.reviewDate || "current")}`; }
  function deliveryDecision(input = {}) {
    const preferences = normalizePreferences(input.preferences);
    const now = new Date(input.now || Date.now());
    if (!preferences.enabled) return { send: false, reason: "channel-disabled", fallback: "app" };
    if (!input.consentActive) return { send: false, reason: "consent-missing", fallback: "app" };
    if (!preferences.subscriptionId) return { send: false, reason: "subscription-missing", fallback: "app" };
    if (preferences.mutedUntil && preferences.mutedUntil >= now.toISOString().slice(0, 10)) return { send: false, reason: "muted", fallback: "app" };
    if (inQuietHours(preferences, input.localTime)) return { send: false, reason: "quiet-hours", fallback: "app", retryAfter: preferences.quietEnd };
    const key = dedupeKey(input.alert, input.reviewKey);
    if (new Set(input.deliveredKeys || []).has(key)) return { send: false, reason: "duplicate", fallback: "app", dedupeKey: key };
    const lastAt = input.lastDeliveredAt ? new Date(input.lastDeliveredAt).getTime() : 0;
    if (lastAt && now.getTime() - lastAt < FREQUENCIES[preferences.frequency]) return { send: false, reason: "frequency-limited", fallback: "app", dedupeKey: key };
    return { send: true, channel: CHANNEL, dedupeKey: key, payload: safePayload(input.alert), fallback: "app" };
  }
  function deliveryReceipt(decision, input = {}) {
    if (!decision?.send) throw new Error("No se puede registrar como entregada una notificación bloqueada.");
    const status = ["sent", "delivered", "failed"].includes(input.status) ? input.status : "sent";
    return { schemaId: SCHEMA_ID, id: text(input.id) || `delivery:${decision.dedupeKey}`, channel: CHANNEL, dedupeKey: decision.dedupeKey, status, providerMessageId: text(input.providerMessageId), occurredAt: text(input.at) || new Date().toISOString(), payload: { alertId: decision.payload.alertId, category: decision.payload.category, target: decision.payload.target } };
  }
  return { SCHEMA_ID, CHANNEL, SAFE_MESSAGES, TARGETS, dedupeKey, deliveryDecision, deliveryReceipt, inQuietHours, normalizePreferences, safePayload };
});
