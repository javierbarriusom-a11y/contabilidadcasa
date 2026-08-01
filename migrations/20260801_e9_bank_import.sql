-- E9-3: ejecuciones programadas y bandeja bancaria previa al libro canónico.
create table if not exists public.finance_bank_sync_runs (
  id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
  source_key text not null, connection_id uuid not null references public.finance_bank_connections(id) on delete cascade,
  idempotency_key text not null, status text not null check (status in ('running','complete','failed','review-pending')),
  attempt integer not null default 1, started_at timestamptz not null default now(), completed_at timestamptz,
  next_attempt_at timestamptz, error_code text not null default '', unique (connection_id, idempotency_key)
);
create table if not exists public.finance_bank_inbox (
  id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
  source_key text not null, connection_id uuid not null references public.finance_bank_connections(id) on delete cascade,
  sync_run_id uuid not null references public.finance_bank_sync_runs(id) on delete cascade,
  bank_identity text not null, status text not null check (status in ('pending-review','corrected','accepted','excluded','undone')),
  booking_date date not null, value_date date, amount numeric not null, currency text not null,
  description text not null default '', counterparty text not null default '', previous_data jsonb,
  created_at timestamptz not null default now(), reviewed_at timestamptz,
  unique (connection_id, bank_identity)
);
alter table public.finance_bank_sync_runs enable row level security;
alter table public.finance_bank_inbox enable row level security;
drop policy if exists finance_bank_sync_runs_select_own on public.finance_bank_sync_runs;
create policy finance_bank_sync_runs_select_own on public.finance_bank_sync_runs for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists finance_bank_inbox_select_own on public.finance_bank_inbox;
create policy finance_bank_inbox_select_own on public.finance_bank_inbox for select to authenticated using ((select auth.uid()) = user_id);
grant select on public.finance_bank_sync_runs to authenticated;
grant select on public.finance_bank_inbox to authenticated;
-- El backend escribe; la aceptación se realizará mediante una RPC transaccional posterior y auditada.
