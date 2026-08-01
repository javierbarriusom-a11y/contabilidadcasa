const assert = require("node:assert/strict"); const fs = require("node:fs"); const path = require("node:path"); const test = require("node:test");
const sql = fs.readFileSync(path.join(__dirname, "..", "migrations", "20260801_e9_banking.sql"), "utf8");
test("E9-2 cifra referencias y solo expone metadatos enmascarados", () => {
  assert.match(sql, /provider_reference_ciphertext bytea not null/); assert.match(sql, /encryption_key_id text not null/); assert.match(sql, /masked_reference text not null/);
  assert.doesNotMatch(sql, /access_token|refresh_token|client_secret|iban text/i);
});
test("el cliente solo puede leer sus propias conexiones", () => {
  assert.match(sql, /enable row level security/); assert.match(sql, /auth\.uid\(\)\) = user_id/); assert.match(sql, /grant select on public\.finance_bank_connections/);
  assert.doesNotMatch(sql, /grant select, insert|grant select, insert, update|grant update/i);
});
