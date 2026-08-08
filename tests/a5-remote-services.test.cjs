const assert = require("node:assert/strict");
const test = require("node:test");
const household = require("../canonical-e9-household.js");
const remote = require("../a5-remote-services.js");

test("las invitaciones remotas solo persisten hashes y bloquean revisiones obsoletas", () => {
  const secrets = new Map();
  const service = remote.createHouseholdService({ store: secrets });
  let state = household.createHousehold({ ownerId: "javi", at: "2026-08-08T10:00:00Z" });
  const issued = service.issueInvitation(state, { actorId: "javi", expectedRevision: 1, invitee: "tere@example.test", role: "viewer", areas: ["planning"], expiresAt: "2026-08-09T10:00:00Z", at: "2026-08-08T10:01:00Z" });
  state = issued.state;
  assert.equal(JSON.stringify([...secrets.values()]).includes(issued.invitation.token), false);
  const accepted = service.acceptInvitation(state, { userId: "tere", invitationId: issued.invitation.id, token: issued.invitation.token, expectedRevision: 2, at: "2026-08-08T10:02:00Z" });
  assert.equal(service.can(accepted, "tere", "household:read", "planning"), true);
  assert.throws(() => service.acceptInvitation(state, { userId: "otro", invitationId: issued.invitation.id, token: issued.invitation.token, expectedRevision: 2 }), /no válida/);
  assert.throws(() => service.revokeMember(accepted, { actorId: "javi", userId: "tere", expectedRevision: 2 }), /Otra sesión/);
});

test("las suscripciones push se cifran, se revocan y solo entregan mensajes seguros", async () => {
  const sent = [];
  const service = remote.createPushService({ encryptionKey: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef", send: async (subscription, payload) => { sent.push({ subscription, payload }); return { status: "delivered", providerMessageId: "provider-1" }; }, now: () => "2026-08-08T12:00:00Z" });
  const subscription = service.register({ userId: "u1", sourceKey: "household", endpoint: "https://push.test/secret-endpoint", p256dh: "public-key", auth: "auth-key" });
  const stored = service.store.get(subscription.id);
  assert.equal(Object.hasOwn(stored, "endpoint"), false);
  const preferences = { enabled: true, frequency: "immediate", quietStart: "22:00", quietEnd: "08:00", subscriptionId: subscription.id };
  const result = await service.deliver({ preferences, consentActive: true, localTime: "12:00", alert: { id: "a1", category: "cash", amount: 1000, bank: "Privado" }, reviewKey: "r1" });
  assert.equal(result.receipt.status, "delivered");
  assert.equal(sent[0].payload.containsSensitiveAmounts, false);
  assert.doesNotMatch(JSON.stringify(sent[0].payload), /1000|Privado/);
  assert.deepEqual(await service.deliver({ preferences, consentActive: true, localTime: "12:00", alert: { id: "a1", category: "cash" }, reviewKey: "r1" }), { send: false, reason: "duplicate", fallback: "app", dedupeKey: "web-push:a1:r1" });
  service.revoke(subscription.id);
  assert.equal((await service.deliver({ preferences: { ...preferences, subscriptionId: subscription.id }, consentActive: true, localTime: "12:00", alert: { id: "a2", category: "cash" }, reviewKey: "r2" })).reason, "subscription-revoked");
});
