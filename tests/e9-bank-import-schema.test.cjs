const assert = require("node:assert/strict"); const fs = require("node:fs"); const path = require("node:path"); const test = require("node:test");
const sql = fs.readFileSync(path.join(__dirname, "..", "migrations", "20260801_e9_bank_import.sql"), "utf8");
test("E9-3 separa ejecuciones y bandeja previa al libro", () => { assert.match(sql, /finance_bank_sync_runs/); assert.match(sql, /finance_bank_inbox/); assert.match(sql, /review-pending/); assert.match(sql, /unique \(connection_id, idempotency_key\)/); assert.match(sql, /unique \(connection_id, bank_identity\)/); });
test("el cliente no escribe directamente la bandeja", () => { assert.match(sql, /grant select on public\.finance_bank_inbox/); assert.doesNotMatch(sql, /grant select, insert|grant update|grant delete/i); });
