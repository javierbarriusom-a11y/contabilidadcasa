const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const schema = fs.readFileSync(path.join(__dirname, "..", "supabase_schema.sql"), "utf8");

const normalizedTables = [
  "finance_sync_runs",
  "finance_accounts",
  "finance_concepts",
  "finance_ledger_entries",
  "finance_debts",
  "finance_projects",
  "finance_decisions",
  "finance_decision_events",
  "finance_reconciliation_runs",
  "finance_state_snapshots",
  "finance_source_heads",
  "finance_audit_log",
];

test("el esquema incluye todas las entidades normalizadas y conserva compatibilidad", () => {
  assert.match(schema, /create table if not exists public\.finance_dashboard_states/);
  normalizedTables.forEach((tableName) => {
    assert.match(schema, new RegExp(tableName));
  });
});

test("las tablas normalizadas tienen aislamiento por usuario", () => {
  assert.match(
    schema,
    /execute format\('alter table public\.%I enable row level security', table_name\)/,
  );
  normalizedTables.forEach((tableName) => {
    assert.match(schema, new RegExp(`'${tableName}'`));
  });
  assert.match(schema, /auth\.uid\(\)\) = user_id/);
});

test("eventos, conciliaciones, copias y auditoría son append-only para el cliente", () => {
  assert.match(schema, /grant select, insert on public\.finance_decision_events to authenticated/);
  assert.match(schema, /grant select, insert on public\.finance_reconciliation_runs to authenticated/);
  assert.match(schema, /grant select, insert on public\.finance_state_snapshots to authenticated/);
  assert.match(schema, /grant select on public\.finance_audit_log to authenticated/);
  assert.doesNotMatch(schema, /grant select, insert, update on public\.finance_decision_events/);
  assert.doesNotMatch(schema, /grant select, insert, update on public\.finance_state_snapshots/);
});

test("el puntero activo solo permite al usuario seleccionar su copia normalizada", () => {
  assert.match(schema, /create table if not exists public\.finance_source_heads/);
  assert.match(schema, /source_key text not null/);
  assert.match(schema, /snapshot_id uuid not null references public\.finance_state_snapshots/);
  assert.match(schema, /grant select, insert, update on public\.finance_source_heads to authenticated/);
});

test("la auditoría registra antes y después mediante trigger", () => {
  assert.match(schema, /create or replace function public\.finance_append_audit/);
  assert.match(schema, /before_data, after_data, changed_by, sync_id/);
  assert.match(schema, /after insert or update or delete/);
  assert.match(schema, /if tg_op = 'DELETE' then\s+row_user := old\.user_id/);
});
