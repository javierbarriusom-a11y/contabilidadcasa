-- P0-1 / P0-2 incremental migration.
-- Run this in Supabase SQL Editor for existing installations.

create table if not exists public.finance_source_heads (
  user_id uuid not null references auth.users(id) on delete cascade,
  source_key text not null,
  sync_id uuid references public.finance_sync_runs(id) on delete set null,
  snapshot_id uuid not null references public.finance_state_snapshots(id) on delete restrict,
  fingerprint text not null,
  schema_version text not null,
  updated_at timestamptz not null default now(),
  primary key(user_id, source_key)
);

create index if not exists finance_source_heads_snapshot_idx
  on public.finance_source_heads (snapshot_id);

alter table public.finance_source_heads enable row level security;

drop policy if exists "finance_source_heads_own_select" on public.finance_source_heads;
create policy "finance_source_heads_own_select" on public.finance_source_heads
  for select using (auth.uid() = user_id);

drop policy if exists "finance_source_heads_own_insert" on public.finance_source_heads;
create policy "finance_source_heads_own_insert" on public.finance_source_heads
  for insert with check (auth.uid() = user_id);

drop policy if exists "finance_source_heads_own_update" on public.finance_source_heads;
create policy "finance_source_heads_own_update" on public.finance_source_heads
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select, insert, update on public.finance_source_heads to authenticated;
