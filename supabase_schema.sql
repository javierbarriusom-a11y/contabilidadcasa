create table if not exists public.finance_dashboard_states (
  user_id uuid not null references auth.users(id) on delete cascade,
  source_key text not null,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (user_id, source_key)
);

alter table public.finance_dashboard_states enable row level security;

drop policy if exists "finance_dashboard_states_select_own" on public.finance_dashboard_states;
drop policy if exists "finance_dashboard_states_insert_own" on public.finance_dashboard_states;
drop policy if exists "finance_dashboard_states_update_own" on public.finance_dashboard_states;
drop policy if exists "finance_dashboard_states_delete_own" on public.finance_dashboard_states;

create policy "finance_dashboard_states_select_own"
on public.finance_dashboard_states
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "finance_dashboard_states_insert_own"
on public.finance_dashboard_states
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "finance_dashboard_states_update_own"
on public.finance_dashboard_states
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "finance_dashboard_states_delete_own"
on public.finance_dashboard_states
for delete
to authenticated
using ((select auth.uid()) = user_id);

-- Phase 10: normalized, versioned persistence. The legacy table above remains
-- available so existing installations can migrate without losing data.

create table if not exists public.finance_sync_runs (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  source_key text not null,
  status text not null check (status in ('running', 'complete', 'failed')),
  schema_version text not null,
  fingerprint text not null,
  entity_count integer not null default 0,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.finance_accounts (
  user_id uuid not null references auth.users(id) on delete cascade,
  source_key text not null,
  entity_id text not null,
  sync_id uuid not null references public.finance_sync_runs(id),
  label text not null default '',
  status text not null default 'fixed',
  provenance text not null default 'declared',
  owner text not null default 'household',
  month_key text not null default '',
  amount numeric not null default 0,
  active boolean not null default true,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, source_key, entity_id)
);

create table if not exists public.finance_concepts (like public.finance_accounts including all);
create table if not exists public.finance_ledger_entries (like public.finance_accounts including all);
create table if not exists public.finance_debts (like public.finance_accounts including all);
create table if not exists public.finance_projects (like public.finance_accounts including all);
create table if not exists public.finance_decisions (like public.finance_accounts including all);

create table if not exists public.finance_decision_events (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  source_key text not null,
  sync_id uuid not null references public.finance_sync_runs(id),
  event_key text not null,
  entity_id text not null,
  event_type text not null,
  status text not null default 'executed',
  amount numeric not null default 0,
  occurred_at timestamptz not null default now(),
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, source_key, event_key)
);

create table if not exists public.finance_reconciliation_runs (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  source_key text not null,
  sync_id uuid not null references public.finance_sync_runs(id),
  fingerprint text not null,
  quality_score numeric not null default 0,
  difference_months integer not null default 0,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.finance_state_snapshots (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  source_key text not null,
  sync_id uuid not null references public.finance_sync_runs(id),
  version integer not null default 1,
  fingerprint text not null,
  checksum text not null,
  state jsonb not null,
  created_at timestamptz not null default now()
);

-- The active pointer makes the normalized snapshot store authoritative. Legacy
-- dashboard state is retained only as a one-time migration fallback.
create table if not exists public.finance_source_heads (
  user_id uuid not null references auth.users(id) on delete cascade,
  source_key text not null,
  sync_id uuid references public.finance_sync_runs(id) on delete set null,
  snapshot_id uuid not null references public.finance_state_snapshots(id) on delete restrict,
  fingerprint text not null,
  schema_version text not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, source_key)
);

create table if not exists public.finance_audit_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  source_key text not null,
  table_name text not null,
  entity_id text not null,
  action text not null,
  before_data jsonb,
  after_data jsonb,
  changed_at timestamptz not null default now(),
  changed_by uuid references auth.users(id),
  sync_id uuid references public.finance_sync_runs(id)
);

create index if not exists finance_snapshots_latest_idx
  on public.finance_state_snapshots (user_id, source_key, created_at desc);
create index if not exists finance_source_heads_snapshot_idx
  on public.finance_source_heads (snapshot_id);
create index if not exists finance_audit_entity_idx
  on public.finance_audit_log (user_id, source_key, table_name, entity_id, changed_at desc);
create index if not exists finance_ledger_month_idx
  on public.finance_ledger_entries (user_id, source_key, month_key) where active;

create or replace function public.finance_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.finance_append_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  prior jsonb;
  current jsonb;
  row_user uuid;
  row_source text;
  row_entity text;
  row_sync uuid;
begin
  prior := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  current := case when tg_op = 'DELETE' then null else to_jsonb(new) end;

  if tg_op = 'DELETE' then
    row_user := old.user_id;
    row_source := old.source_key;
    row_entity := old.entity_id;
    row_sync := old.sync_id;
  else
    row_user := new.user_id;
    row_source := new.source_key;
    row_entity := new.entity_id;
    row_sync := new.sync_id;
  end if;

  if tg_op = 'UPDATE' and
     (prior - 'updated_at' - 'sync_id') = (current - 'updated_at' - 'sync_id') then
    return new;
  end if;

  insert into public.finance_audit_log (
    user_id, source_key, table_name, entity_id, action,
    before_data, after_data, changed_by, sync_id
  ) values (
    row_user, row_source, tg_table_name, row_entity, lower(tg_op),
    prior, current, auth.uid(), row_sync
  );
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

-- Restoring never rewrites an old snapshot. It clones the selected version and
-- moves the authoritative pointer under the same database transaction. The
-- expected head prevents an obsolete browser session from restoring over a
-- newer revision.
create or replace function public.restore_finance_snapshot(
  p_source_key text,
  p_target_snapshot_id uuid,
  p_expected_head_snapshot_id uuid,
  p_new_snapshot_id uuid,
  p_new_sync_id uuid
)
returns table (snapshot_id uuid, fingerprint text, restored_from uuid, created_at timestamptz)
language plpgsql
security invoker
set search_path = public
as $$
declare
  target_snapshot public.finance_state_snapshots%rowtype;
  current_head_snapshot_id uuid;
  restored_at timestamptz := now();
begin
  select * into target_snapshot
  from public.finance_state_snapshots
  where id = p_target_snapshot_id
    and user_id = auth.uid()
    and source_key = p_source_key;

  if not found then
    raise exception 'La versión solicitada no existe o no pertenece al usuario.' using errcode = 'P0002';
  end if;

  select h.snapshot_id into current_head_snapshot_id
  from public.finance_source_heads h
  where h.user_id = auth.uid() and h.source_key = p_source_key
  for update;

  if current_head_snapshot_id is distinct from p_expected_head_snapshot_id then
    raise exception 'Otra sesión publicó una revisión más reciente.' using errcode = '40001';
  end if;

  insert into public.finance_sync_runs (
    id, user_id, source_key, status, schema_version, fingerprint,
    entity_count, started_at, completed_at, metadata
  ) values (
    p_new_sync_id, auth.uid(), p_source_key, 'complete',
    'finanzas-casa-supabase-v1', target_snapshot.fingerprint,
    coalesce((target_snapshot.state #>> '{canonicalSnapshot,quality,entityCount}')::integer, 0),
    restored_at, restored_at,
    jsonb_build_object('operation', 'restore', 'restoredFrom', p_target_snapshot_id)
  );

  insert into public.finance_state_snapshots (
    id, user_id, source_key, sync_id, version, fingerprint, checksum, state, created_at
  ) values (
    p_new_snapshot_id, auth.uid(), p_source_key, p_new_sync_id,
    target_snapshot.version, target_snapshot.fingerprint, target_snapshot.checksum,
    target_snapshot.state, restored_at
  );

  update public.finance_source_heads
  set sync_id = p_new_sync_id,
      snapshot_id = p_new_snapshot_id,
      fingerprint = target_snapshot.fingerprint,
      schema_version = 'finanzas-casa-supabase-v1',
      updated_at = restored_at
  where user_id = auth.uid() and source_key = p_source_key;

  if not found then
    raise exception 'No existe un puntero remoto que restaurar.' using errcode = 'P0002';
  end if;

  return query select p_new_snapshot_id, target_snapshot.fingerprint, p_target_snapshot_id, restored_at;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'finance_accounts', 'finance_concepts', 'finance_ledger_entries',
    'finance_debts', 'finance_projects', 'finance_decisions'
  ] loop
    execute format('drop trigger if exists finance_touch_updated_at on public.%I', table_name);
    execute format(
      'create trigger finance_touch_updated_at before update on public.%I for each row execute function public.finance_touch_updated_at()',
      table_name
    );
    execute format('drop trigger if exists finance_append_audit on public.%I', table_name);
    execute format(
      'create trigger finance_append_audit after insert or update or delete on public.%I for each row execute function public.finance_append_audit()',
      table_name
    );
  end loop;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'finance_sync_runs', 'finance_accounts', 'finance_concepts',
    'finance_ledger_entries', 'finance_debts', 'finance_projects',
    'finance_decisions', 'finance_decision_events',
    'finance_reconciliation_runs', 'finance_state_snapshots', 'finance_source_heads',
    'finance_audit_log'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_select_own', table_name);
    execute format(
      'create policy %I on public.%I for select to authenticated using ((select auth.uid()) = user_id)',
      table_name || '_select_own', table_name
    );
  end loop;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'finance_sync_runs', 'finance_accounts', 'finance_concepts',
    'finance_ledger_entries', 'finance_debts', 'finance_projects',
    'finance_decisions', 'finance_decision_events',
    'finance_reconciliation_runs', 'finance_state_snapshots', 'finance_source_heads'
  ] loop
    execute format('drop policy if exists %I on public.%I', table_name || '_insert_own', table_name);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)',
      table_name || '_insert_own', table_name
    );
  end loop;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'finance_sync_runs', 'finance_accounts', 'finance_concepts',
    'finance_ledger_entries', 'finance_debts', 'finance_projects',
    'finance_decisions', 'finance_source_heads'
  ] loop
    execute format('drop policy if exists %I on public.%I', table_name || '_update_own', table_name);
    execute format(
      'create policy %I on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)',
      table_name || '_update_own', table_name
    );
  end loop;
end;
$$;

grant select, insert, update on public.finance_sync_runs to authenticated;
grant select, insert, update on public.finance_accounts to authenticated;
grant select, insert, update on public.finance_concepts to authenticated;
grant select, insert, update on public.finance_ledger_entries to authenticated;
grant select, insert, update on public.finance_debts to authenticated;
grant select, insert, update on public.finance_projects to authenticated;
grant select, insert, update on public.finance_decisions to authenticated;
grant select, insert on public.finance_decision_events to authenticated;
grant select, insert on public.finance_reconciliation_runs to authenticated;
grant select, insert on public.finance_state_snapshots to authenticated;
grant select, insert, update on public.finance_source_heads to authenticated;
grant select on public.finance_audit_log to authenticated;
grant execute on function public.restore_finance_snapshot(text, uuid, uuid, uuid, uuid) to authenticated;
