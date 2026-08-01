const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const migration = fs.readFileSync(path.join(__dirname, "..", "migrations", "20260801_e9_household.sql"), "utf8");
const tables = ["finance_households", "finance_household_members", "finance_household_invitations", "finance_household_events"];

test("E9-1 define hogares, miembros, invitaciones y eventos", () => {
  tables.forEach((name) => assert.match(migration, new RegExp(`create table if not exists public\\.${name}`)));
  assert.match(migration, /role in \('owner','admin','member','viewer'\)/);
  assert.match(migration, /status in \('pending','accepted','revoked','expired'\)/);
  assert.match(migration, /unique \(household_id, revision\)/);
});

test("las invitaciones solo persisten hashes y caducan", () => {
  assert.match(migration, /invitee_hash text not null/);
  assert.match(migration, /token_hash text not null unique/);
  assert.match(migration, /expires_at timestamptz not null/);
  assert.doesNotMatch(migration, /invitee_email\s+text|invitation_token\s+text/i);
});

test("RLS permite leer solo a miembros y gestores autorizados", () => {
  tables.forEach((name) => assert.match(migration, new RegExp(`alter table public\\.${name} enable row level security`)));
  assert.match(migration, /security definer[\s\S]*set search_path = ''/);
  assert.match(migration, /finance_household_role\(household_id\) in \('owner','admin'\)/);
  assert.match(migration, /finance_household_role\(household_id\) is not null/);
});

test("el cliente no puede escribir directamente hogares ni eventos", () => {
  tables.forEach((name) => assert.match(migration, new RegExp(`grant select on public\\.${name} to authenticated`)));
  assert.doesNotMatch(migration, /grant select, insert|grant select, insert, update|grant (insert|update|delete)/i);
});
