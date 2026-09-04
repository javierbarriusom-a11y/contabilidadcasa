-- E9-1 continuación (RGX1/RGX2, Oleada 2 Bloque 2/3): funciones de escritura para el hogar
-- compartido. La migración original (20260801_e9_household.sql) reservó las escrituras a
-- "backend/RPC" asumiendo un backend propio (`backend/server.mjs`) que nunca llegó a desplegarse en
-- ningún sitio — mismo hallazgo que ya documentó A19-1 sobre ese mismo backend inexistente. Esta
-- migración resuelve el hueco exactamente como A19-1 resolvió el suyo: funciones `security definer`
-- en la propia base de datos en vez de un servicio Node sin desplegar.
--
-- `canonical-e9-household.js` (el motor JS puro, ya construido) sigue siendo la referencia de las
-- reglas de negocio — roles, permisos, invariantes (el owner nunca se puede revocar, una invitación
-- exige al menos un área). Estas funciones SQL las reflejan, no las sustituyen: app.js sigue usando
-- `can()`/`activeMember()`/`ROLES`/`SHARED_AREAS` de ese motor para decidir qué mostrar en la
-- interfaz, y llama a estas funciones solo para escribir en Supabase.
--
-- Ejecutar después de 20260801_e9_household.sql.

create extension if not exists pgcrypto;

-- 1) Arranque: el usuario autenticado crea su propio hogar y queda como "owner". Un usuario con un
--    hogar propio ya creado no puede crear un segundo — sí puede además ser miembro invitado de
--    otro hogar distinto, eso no lo bloquea esta función.
create or replace function public.finance_household_create(p_household_id uuid, p_name text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_name text := coalesce(nullif(trim(p_name), ''), 'Hogar');
begin
  if v_uid is null then raise exception 'Requiere sesión.'; end if;
  if exists (select 1 from public.finance_households where owner_user_id = v_uid) then
    raise exception 'Ya tienes un hogar propio.';
  end if;
  insert into public.finance_households (id, owner_user_id, name, revision)
    values (p_household_id, v_uid, v_name, 1);
  insert into public.finance_household_members (household_id, user_id, role, areas, status, joined_at)
    values (p_household_id, v_uid, 'owner', to_jsonb(array['planning', 'movements', 'debts', 'goals', 'documents', 'scenarios']), 'active', now());
  insert into public.finance_household_events (id, household_id, actor_user_id, event_type, revision, details)
    values (gen_random_uuid(), p_household_id, v_uid, 'household-created', 1, jsonb_build_object());
  return jsonb_build_object('householdId', p_household_id);
end;
$$;

revoke all on function public.finance_household_create(uuid, text) from public;
grant execute on function public.finance_household_create(uuid, text) to authenticated;

-- 2) Invitar: solo owner/admin del hogar. El token en crudo nunca llega a esta función — el cliente
--    envía únicamente su hash, generado con Web Crypto (mismo criterio que finance_share_links.
--    token_hash / A19-1, reutilizando literalmente FinanceCanonicalShareLink.hashToken en app.js).
create or replace function public.finance_household_invite(
  p_household_id uuid, p_invitation_id uuid, p_invitee_hash text, p_token_hash text,
  p_role text, p_areas jsonb, p_ttl_days int
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_role text := coalesce(nullif(trim(p_role), ''), 'member');
  v_ttl int := least(90, greatest(1, coalesce(p_ttl_days, 14)));
begin
  if v_uid is null then raise exception 'Requiere sesión.'; end if;
  if public.finance_household_role(p_household_id) not in ('owner', 'admin') then
    raise exception 'No tienes permiso para invitar.';
  end if;
  if v_role not in ('admin', 'member', 'viewer') then raise exception 'Rol no permitido.'; end if;
  if length(coalesce(p_invitee_hash, '')) < 32 or length(coalesce(p_token_hash, '')) < 32 then
    raise exception 'Faltan los hashes de la invitación.';
  end if;
  if jsonb_array_length(coalesce(p_areas, '[]'::jsonb)) = 0 then
    raise exception 'La invitación requiere al menos un área compartida.';
  end if;
  insert into public.finance_household_invitations
    (id, household_id, created_by, invitee_hash, token_hash, role, areas, status, expires_at)
    values (p_invitation_id, p_household_id, v_uid, p_invitee_hash, p_token_hash, v_role, p_areas, 'pending', now() + (v_ttl || ' days')::interval);
  insert into public.finance_household_events (id, household_id, actor_user_id, event_type, revision, details)
    values (gen_random_uuid(), p_household_id, v_uid, 'member-invited',
      (select revision + 1 from public.finance_households where id = p_household_id),
      jsonb_build_object('invitationId', p_invitation_id, 'role', v_role));
  update public.finance_households set revision = revision + 1, updated_at = now() where id = p_household_id;
  return jsonb_build_object('invitationId', p_invitation_id);
end;
$$;

revoke all on function public.finance_household_invite(uuid, uuid, text, text, text, jsonb, int) from public;
grant execute on function public.finance_household_invite(uuid, uuid, text, text, text, jsonb, int) to authenticated;

-- 3) Aceptar: quien acepta todavía no es miembro — sin fila en finance_household_members no hay
--    visibilidad RLS sobre el hogar — así que "security definer" es imprescindible aquí, mismo
--    motivo por el que get_finance_share_link (A19-1) necesita saltarse RLS para el rol "anon". Se
--    compara el hash del email propio (tabla auth.users, nunca expuesta directamente al cliente)
--    contra invitee_hash: la invitación solo la puede aceptar la persona a la que se destinó, nunca
--    "quien tenga el enlace" — a diferencia de A19-1, donde precisamente sí basta con tener el
--    enlace porque comparte una vista redactada, no acceso de escritura a datos reales.
create or replace function public.finance_household_accept(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_invitation record;
begin
  if v_uid is null then raise exception 'Requiere sesión.'; end if;
  select email into v_email from auth.users where id = v_uid;
  select * into v_invitation from public.finance_household_invitations
    where token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex')
    for update;
  if v_invitation.id is null or v_invitation.status <> 'pending' or v_invitation.expires_at <= now() then
    raise exception 'Invitación no válida o caducada.';
  end if;
  if v_invitation.invitee_hash <> encode(digest(lower(trim(coalesce(v_email, ''))), 'sha256'), 'hex') then
    raise exception 'Esta invitación no es para esta cuenta.';
  end if;
  update public.finance_household_invitations
    set status = 'accepted', accepted_at = now(), accepted_by = v_uid
    where id = v_invitation.id;
  insert into public.finance_household_members (household_id, user_id, role, areas, status, joined_at)
    values (v_invitation.household_id, v_uid, v_invitation.role, v_invitation.areas, 'active', now())
    on conflict (household_id, user_id) do update
      set role = excluded.role, areas = excluded.areas, status = 'active', joined_at = now(), revoked_at = null;
  insert into public.finance_household_events (id, household_id, actor_user_id, event_type, revision, details)
    values (gen_random_uuid(), v_invitation.household_id, v_uid, 'member-joined',
      (select revision + 1 from public.finance_households where id = v_invitation.household_id),
      jsonb_build_object('invitationId', v_invitation.id, 'role', v_invitation.role));
  update public.finance_households set revision = revision + 1, updated_at = now() where id = v_invitation.household_id;
  return jsonb_build_object('householdId', v_invitation.household_id, 'role', v_invitation.role, 'areas', v_invitation.areas);
end;
$$;

revoke all on function public.finance_household_accept(text) from public;
grant execute on function public.finance_household_accept(text) to authenticated;

-- 4) Revocar: solo owner/admin, nunca a la persona propietaria — mismo invariante que
--    canonical-e9-household.js#revokeMember.
create or replace function public.finance_household_revoke(p_household_id uuid, p_user_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_target_role text;
begin
  if v_uid is null then raise exception 'Requiere sesión.'; end if;
  if public.finance_household_role(p_household_id) not in ('owner', 'admin') then
    raise exception 'No tienes permiso para retirar miembros.';
  end if;
  select role into v_target_role from public.finance_household_members
    where household_id = p_household_id and user_id = p_user_id and status = 'active';
  if v_target_role is null then raise exception 'Esa persona no es miembro activo.'; end if;
  if v_target_role = 'owner' then raise exception 'No se puede retirar a la persona propietaria.'; end if;
  update public.finance_household_members
    set status = 'revoked', revoked_at = now()
    where household_id = p_household_id and user_id = p_user_id;
  insert into public.finance_household_events (id, household_id, actor_user_id, event_type, revision, details)
    values (gen_random_uuid(), p_household_id, v_uid, 'member-revoked',
      (select revision + 1 from public.finance_households where id = p_household_id),
      jsonb_build_object('userId', p_user_id, 'reason', coalesce(nullif(trim(p_reason), ''), '')));
  update public.finance_households set revision = revision + 1, updated_at = now() where id = p_household_id;
  return jsonb_build_object('userId', p_user_id, 'status', 'revoked');
end;
$$;

revoke all on function public.finance_household_revoke(uuid, uuid, text) from public;
grant execute on function public.finance_household_revoke(uuid, uuid, text) to authenticated;
