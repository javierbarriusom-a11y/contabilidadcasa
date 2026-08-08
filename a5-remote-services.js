"use strict";

const crypto = require("node:crypto");
const household = require("./canonical-e9-household.js");
const notifications = require("./canonical-e9-notifications.js");

const text = (value) => String(value ?? "").trim();
const hash = (value) => crypto.createHash("sha256").update(text(value)).digest("hex");
const clone = (value) => JSON.parse(JSON.stringify(value));

function createHouseholdService(options = {}) {
  const now = options.now || (() => new Date().toISOString());
  const store = options.store || new Map();
  const readSecret = (id) => typeof store.get === "function" ? store.get(id) : undefined;
  const writeSecret = (id, value) => typeof store.set === "function" ? store.set(id, value) : undefined;

  function issueInvitation(state, input = {}) {
    const token = crypto.randomBytes(32).toString("base64url");
    const invitationId = crypto.randomUUID();
    const at = text(input.at) || now();
    const next = household.invite(state, { ...input, invitationId, at });
    writeSecret(invitationId, { tokenHash: hash(token), inviteeHash: hash(input.invitee), createdAt: at });
    return { state: next, invitation: { id: invitationId, token, expiresAt: text(input.expiresAt) } };
  }

  function acceptInvitation(state, input = {}) {
    const record = readSecret(text(input.invitationId));
    if (!record || record.tokenHash !== hash(input.token)) throw new Error("Invitación no válida o caducada.");
    const next = household.acceptInvitation(state, input);
    if (typeof store.delete === "function") store.delete(text(input.invitationId));
    return next;
  }

  return { issueInvitation, acceptInvitation, revokeMember: household.revokeMember, can: household.can, activeMember: household.activeMember, store };
}

function createPushService(options = {}) {
  const key = Buffer.isBuffer(options.encryptionKey) ? options.encryptionKey : Buffer.from(text(options.encryptionKey), "hex");
  if (key.length !== 32) throw new Error("Las suscripciones push requieren una clave AES-256 del backend.");
  const store = options.store || new Map();
  const deliveries = options.deliveries || new Map();
  const send = options.send || (async () => ({ status: "sent", providerMessageId: "" }));
  const now = options.now || (() => new Date().toISOString());

  function encrypt(subscription) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    const ciphertext = Buffer.concat([cipher.update(JSON.stringify(subscription), "utf8"), cipher.final()]);
    return { iv: iv.toString("base64url"), ciphertext: ciphertext.toString("base64url"), tag: cipher.getAuthTag().toString("base64url"), keyId: text(options.keyId) || "push-key-1" };
  }
  function decrypt(record) {
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(record.iv, "base64url"));
    decipher.setAuthTag(Buffer.from(record.tag, "base64url"));
    return JSON.parse(Buffer.concat([decipher.update(Buffer.from(record.ciphertext, "base64url")), decipher.final()]).toString("utf8"));
  }
  function register(input = {}) {
    const endpoint = text(input.endpoint);
    if (!endpoint || !text(input.p256dh) || !text(input.auth)) throw new Error("La suscripción push está incompleta.");
    const id = crypto.randomUUID();
    const opaque = { endpoint, p256dh: text(input.p256dh), auth: text(input.auth) };
    const encrypted = encrypt(opaque);
    store.set(id, { id, userId: text(input.userId), sourceKey: text(input.sourceKey) || "default", subscriptionHash: hash(endpoint), ...encrypted, status: "active", createdAt: now() });
    return { id, keyId: encrypted.keyId, status: "active" };
  }
  function revoke(id) {
    const record = store.get(text(id));
    if (!record) return false;
    record.status = "revoked"; record.revokedAt = now(); store.set(record.id, record); return true;
  }
  async function deliver(input = {}) {
    const decision = notifications.deliveryDecision({ ...input, deliveredKeys: [...deliveries.keys()] });
    if (!decision.send) return decision;
    const record = store.get(text(input.preferences.subscriptionId));
    if (!record || record.status !== "active") return { send: false, reason: "subscription-revoked", fallback: "app" };
    const provider = await send(decrypt(record), decision.payload);
    const receipt = notifications.deliveryReceipt(decision, { ...provider, at: now() });
    deliveries.set(decision.dedupeKey, receipt);
    return { ...decision, receipt };
  }

  return { register, revoke, deliver, decryptForDelivery: decrypt, store, deliveries };
}

module.exports = { createHouseholdService, createPushService, hash };
