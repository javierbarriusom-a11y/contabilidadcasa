-- A19-1: enlace de solo lectura, redactado y caducable para compartir una vista concreta (plan de
-- deuda o forecast a 6 meses) con un asesor externo, sin cuenta propia ni acceso a movimientos
-- individuales. Ejecutar después de supabase_schema.sql.
--
-- Solo se almacena el hash del token (mismo criterio que
-- finance_household_invitations.token_hash) — un volcado de esta tabla nunca expone un token
-- utilizable. El rol "anon" no tiene ningún privilegio directo sobre la tabla: la única puerta de
-- lectura es get_finance_share_link(token), que decide expiración/revocación aquí y solo devuelve
-- el payload ya redactado en el momento de compartir — nunca una consulta en vivo a las tablas
-- reales del hogar.

create extension if not exists pgcrypto;

create table if not exists public.finance_share_links (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique check (length(token_hash) >= 32),
  view_type text not null check (view_type in ('debt-plan', 'forecast-6m')),
  payload jsonb not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null check (expires_at > created_at),
  revoked_at timestamptz
);

alter table public.finance_share_links enable row level security;

-- El hogar (autenticado) gestiona sus propios enlaces: los crea, los lista y los revoca. Nunca los
-- edita más allá de eso — un enlace revocado no se reactiva, se crea uno nuevo (with check exige
-- que revoked_at quede a no-nulo en cualquier update, así que un cliente no puede reescribir el
-- payload ni la caducidad de un enlace ya emitido).
drop policy if exists finance_share_links_select_own on public.finance_share_links;
create policy finance_share_links_select_own
  on public.finance_share_links for select
  to authenticated
  using ((select auth.uid()) = owner_user_id);

drop policy if exists finance_share_links_insert_own on public.finance_share_links;
create policy finance_share_links_insert_own
  on public.finance_share_links for insert
  to authenticated
  with check ((select auth.uid()) = owner_user_id);

drop policy if exists finance_share_links_revoke_own on public.finance_share_links;
create policy finance_share_links_revoke_own
  on public.finance_share_links for update
  to authenticated
  using ((select auth.uid()) = owner_user_id)
  with check ((select auth.uid()) = owner_user_id and revoked_at is not null);

grant select, insert, update on public.finance_share_links to authenticated;

-- Cero privilegios directos para "anon" — nunca se hace un select de esta tabla desde fuera de la
-- función de abajo, así que un fallo de configuración de RLS no puede filtrar enlaces ajenos.
revoke all on public.finance_share_links from anon;

create or replace function public.get_finance_share_link(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  select payload into result
  from public.finance_share_links
  where token_hash = encode(digest(p_token, 'sha256'), 'hex')
    and revoked_at is null
    and expires_at > now();
  return result;
end;
$$;

revoke all on function public.get_finance_share_link(text) from public;
grant execute on function public.get_finance_share_link(text) to anon, authenticated;

create index if not exists finance_share_links_owner_idx
  on public.finance_share_links (owner_user_id, created_at desc);
