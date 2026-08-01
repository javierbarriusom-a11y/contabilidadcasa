-- E9-1: hogares compartidos. Ejecutar después de supabase_schema.sql.
-- Las invitaciones reciben únicamente hashes generados por el backend privado.

create table if not exists public.finance_households (
  id uuid primary key,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  name text not null check (length(trim(name)) > 0),
  revision bigint not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.finance_household_members (
  household_id uuid not null references public.finance_households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','admin','member','viewer')),
  areas jsonb not null default '[]'::jsonb check (jsonb_typeof(areas) = 'array'),
  status text not null check (status in ('active','revoked')),
  joined_at timestamptz not null default now(),
  revoked_at timestamptz,
  primary key (household_id, user_id),
  check ((status = 'revoked' and revoked_at is not null) or status = 'active')
);

create table if not exists public.finance_household_invitations (
  id uuid primary key,
  household_id uuid not null references public.finance_households(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  invitee_hash text not null check (length(invitee_hash) >= 32),
  token_hash text not null unique check (length(token_hash) >= 32),
  role text not null check (role in ('admin','member','viewer')),
  areas jsonb not null default '[]'::jsonb check (jsonb_typeof(areas) = 'array'),
  status text not null check (status in ('pending','accepted','revoked','expired')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id),
  check (expires_at > created_at)
);

create table if not exists public.finance_household_events (
  id uuid primary key,
  household_id uuid not null references public.finance_households(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  revision bigint not null check (revision > 0),
  details jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  unique (household_id, revision)
);

alter table public.finance_households enable row level security;
alter table public.finance_household_members enable row level security;
alter table public.finance_household_invitations enable row level security;
alter table public.finance_household_events enable row level security;

create or replace function public.finance_household_role(p_household_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select m.role
  from public.finance_household_members m
  where m.household_id = p_household_id
    and m.user_id = (select auth.uid())
    and m.status = 'active'
  limit 1
$$;

revoke all on function public.finance_household_role(uuid) from public;
grant execute on function public.finance_household_role(uuid) to authenticated;

drop policy if exists finance_households_select_member on public.finance_households;
create policy finance_households_select_member on public.finance_households for select to authenticated
using (public.finance_household_role(id) is not null);

drop policy if exists finance_household_members_select_member on public.finance_household_members;
create policy finance_household_members_select_member on public.finance_household_members for select to authenticated
using (public.finance_household_role(household_id) is not null);

drop policy if exists finance_household_invitations_select_manager on public.finance_household_invitations;
create policy finance_household_invitations_select_manager on public.finance_household_invitations for select to authenticated
using (public.finance_household_role(household_id) in ('owner','admin'));

drop policy if exists finance_household_events_select_member on public.finance_household_events;
create policy finance_household_events_select_member on public.finance_household_events for select to authenticated
using (public.finance_household_role(household_id) is not null);

-- Las escrituras quedan reservadas al backend/RPC. El cliente autenticado solo lee.
grant select on public.finance_households to authenticated;
grant select on public.finance_household_members to authenticated;
grant select on public.finance_household_invitations to authenticated;
grant select on public.finance_household_events to authenticated;

create index if not exists finance_household_members_user_idx
  on public.finance_household_members (user_id, status, household_id);
create index if not exists finance_household_invitations_household_idx
  on public.finance_household_invitations (household_id, status, expires_at);
create index if not exists finance_household_events_timeline_idx
  on public.finance_household_events (household_id, revision desc);
