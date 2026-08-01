const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const sql = fs.readFileSync(path.join(__dirname, "..", "migrations", "20260801_e9_notifications.sql"), "utf8");
test("E9-6 separa preferencias, suscripciones cifradas y recibos", () => {
  assert.match(sql, /finance_notification_preferences/); assert.match(sql, /finance_push_subscriptions/); assert.match(sql, /finance_notification_deliveries/);
  assert.match(sql, /endpoint_ciphertext bytea not null/); assert.match(sql, /encryption_key_id text not null/);
  assert.doesNotMatch(sql, /endpoint\s+text|p256dh\s+text|auth_secret\s+text/i);
});
test("el cliente no puede leer suscripciones ni insertar recibos", () => {
  assert.match(sql, /grant select, insert, update on public\.finance_notification_preferences/);
  assert.match(sql, /grant select on public\.finance_notification_deliveries/);
  assert.doesNotMatch(sql, /grant .*finance_push_subscriptions to authenticated/i);
  assert.doesNotMatch(sql, /grant select, insert on public\.finance_notification_deliveries/i);
});
