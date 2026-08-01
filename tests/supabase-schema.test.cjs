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
  "finance_month_closures",
  "finance_state_snapshots",
  "finance_source_heads",
  "finance_audit_log",
  "finance_external_consents",
  "finance_external_events",
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
  assert.match(schema, /create or replace function public\.restore_finance_snapshot/);
  assert.match(schema, /for update/);
  assert.match(schema, /grant execute on function public\.restore_finance_snapshot/);
});

test("el cierre mensual es transaccional, append-only y protegido contra sesiones obsoletas", () => {
  assert.match(schema, /create table if not exists public\.finance_month_closures/);
  assert.match(schema, /drop constraint if exists finance_month_closures_user_id_source_key_month_key_key/);
  assert.match(schema, /max\(r\.reopened_at\)/);
  assert.match(schema, /create or replace function public\.close_finance_month/);
  assert.match(schema, /from public\.finance_source_heads h[\s\S]*for update/);
  assert.match(schema, /current_head_snapshot_id is distinct from p_expected_head_snapshot_id/);
  assert.match(schema, /insert into public\.finance_state_snapshots/);
  assert.match(schema, /insert into public\.finance_month_closures/);
  assert.match(schema, /grant select on public\.finance_month_closures to authenticated/);
  assert.match(schema, /revoke execute on function public\.close_finance_month[\s\S]*from public/);
  assert.doesNotMatch(schema, /grant select, insert on public\.finance_month_closures/);
});

test("E5 añade reapertura, deshacer y verificación de copias como operaciones transaccionales", () => {
  assert.match(schema, /create table if not exists public\.finance_month_reopenings/);
  assert.match(schema, /create table if not exists public\.finance_import_batches/);
  assert.match(schema, /create table if not exists public\.finance_backup_checks/);
  assert.match(schema, /create or replace function public\.reopen_finance_month/);
  assert.match(schema, /create or replace function public\.undo_finance_import_batch/);
  assert.match(schema, /create or replace function public\.record_finance_backup_check/);
  assert.match(schema, /Otra sesión publicó una revisión más reciente/);
});

test("la auditoría registra antes y después mediante trigger", () => {
  assert.match(schema, /create or replace function public\.finance_append_audit/);
  assert.match(schema, /before_data, after_data, changed_by, sync_id/);
  assert.match(schema, /after insert or update or delete/);
  assert.match(schema, /if tg_op = 'DELETE' then\s+row_user := old\.user_id/);
});

test("la auditoría no bloquea la cascada al eliminar un usuario", () => {
  assert.match(schema, /not exists \(select 1 from auth\.users where id = row_user\)/);
  assert.match(schema, /if tg_op = 'DELETE' then return old; end if/);
});

test("E9-0 persiste consentimientos sin exponer secretos y conserva eventos append-only", () => {
  assert.match(schema, /create table if not exists public\.finance_external_consents/);
  assert.match(schema, /create table if not exists public\.finance_external_events/);
  assert.match(schema, /status text not null check \(status in \('active','revoked','expired'\)\)/);
  assert.match(schema, /grant select, insert, update on public\.finance_external_consents to authenticated/);
  assert.match(schema, /grant select, insert on public\.finance_external_events to authenticated/);
  assert.doesNotMatch(schema, /grant select, insert, update on public\.finance_external_events/);
  assert.doesNotMatch(schema, /finance_external_(consents|events)[\s\S]{0,500}(access_token|refresh_token|client_secret)/i);
});
