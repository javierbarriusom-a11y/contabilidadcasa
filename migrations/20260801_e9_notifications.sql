-- E9-6: preferencias seguras, suscripciones cifradas y recibos de web push.
create table if not exists public.finance_notification_preferences (
  user_id uuid not null references auth.users(id) on delete cascade,
  source_key text not null,
  enabled boolean not null default false,
  frequency text not null check (frequency in ('immediate','daily','weekly','monthly')),
  quiet_start time not null default '22:00',
  quiet_end time not null default '08:00',
  muted_until date,
  subscription_id uuid,
  updated_at timestamptz not null default now(),
  primary key (user_id, source_key)
);
create table if not exists public.finance_push_subscriptions (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  source_key text not null,
  subscription_hash text not null unique,
  endpoint_ciphertext bytea not null,
  encryption_key_id text not null,
  status text not null check (status in ('active','revoked','expired')),
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'finance_notification_preferences_subscription_fk') then
    alter table public.finance_notification_preferences
      add constraint finance_notification_preferences_subscription_fk
      foreign key (subscription_id) references public.finance_push_subscriptions(id) on delete set null;
  end if;
end $$;
create table if not exists public.finance_notification_deliveries (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  source_key text not null,
  subscription_id uuid references public.finance_push_subscriptions(id) on delete set null,
  dedupe_key text not null,
  status text not null check (status in ('sent','delivered','failed')),
  category text not null,
  target text not null,
  provider_message_id text not null default '',
  occurred_at timestamptz not null default now(),
  unique (user_id, source_key, dedupe_key)
);
alter table public.finance_notification_preferences enable row level security;
alter table public.finance_push_subscriptions enable row level security;
alter table public.finance_notification_deliveries enable row level security;
drop policy if exists finance_notification_preferences_own on public.finance_notification_preferences;
create policy finance_notification_preferences_own on public.finance_notification_preferences to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists finance_notification_deliveries_select_own on public.finance_notification_deliveries;
create policy finance_notification_deliveries_select_own on public.finance_notification_deliveries for select to authenticated
using ((select auth.uid()) = user_id);
grant select, insert, update on public.finance_notification_preferences to authenticated;
grant select on public.finance_notification_deliveries to authenticated;
-- finance_push_subscriptions y las inserciones de recibos quedan exclusivamente en el backend service_role.
