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
