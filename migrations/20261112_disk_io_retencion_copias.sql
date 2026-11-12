-- DISK-IO · Retención de copias de la nube (12/11/2026)
--
-- Por qué: el 12/11/2026 Supabase avisó de que el proyecto agotaba su presupuesto de disco (Disk IO). La base ocupaba
-- unos 381 MB de los 500 del plan gratuito, y 229 MB eran `finance_state_snapshots`: 264 copias completas del estado,
-- de unos 830 kB cada una, que nunca se borraban.
--
-- Regla aprobada por el hogar el 12/11/2026 («ok a la regla de retención»). Se conserva SIEMPRE:
--   1. las 30 copias más recientes;
--   2. una copia por día (la última de cada día, hora de Madrid) de los últimos 90 días;
--   3. la copia vigente (finance_source_heads) y las de cada cierre y reapertura de mes, las de una verificación de
--      copias y las de cualquier operación especial (restaurar, deshacer una importación…). Las cuatro primeras están
--      además protegidas por claves ajenas: aunque esta consulta se equivocara, la base no dejaría borrarlas.
-- Todo lo demás se borra. No toca movimientos, cuentas, deudas ni la auditoría (`finance_audit_log`).
--
-- Cómo usarlo, en Supabase → SQL Editor, cada paso por separado:
--   PASO 1 · solo lectura: cuántas copias salen y cuánto pesan. Si algo no cuadra, para ahí.
--   PASO 2 · borrado, dentro de una transacción.
--   PASO 3 · VACUUM FULL, solo en su propia ejecución: devuelve el espacio al disco (sin él, la tabla no encoge).
--   PASO 4 (opcional) · dejarlo programado cada semana con pg_cron.

-- ============================== PASO 1 · solo lectura ==============================
with ranked as (
  select s.id, s.created_at, pg_column_size(s.state) as bytes,
         row_number() over (partition by s.user_id, s.source_key order by s.created_at desc) as rn,
         row_number() over (partition by s.user_id, s.source_key, (s.created_at at time zone 'Europe/Madrid')::date
                            order by s.created_at desc) as rn_dia
  from public.finance_state_snapshots s
), keep as (
  select id from ranked where rn <= 30
  union select id from ranked where rn_dia = 1 and created_at >= now() - interval '90 days'
  union select snapshot_id from public.finance_source_heads
  union select snapshot_id from public.finance_month_closures
  union select snapshot_id from public.finance_month_reopenings
  union select sample_snapshot_id from public.finance_backup_checks where sample_snapshot_id is not null
  union select s.id from public.finance_state_snapshots s
        join public.finance_sync_runs r on r.id = s.sync_id
        where r.metadata ? 'operation'
)
select count(*) filter (where k.id is null) as se_borran,
       pg_size_pretty(coalesce(sum(r.bytes) filter (where k.id is null), 0)) as peso_que_sale,
       count(*) filter (where k.id is not null) as se_quedan,
       pg_size_pretty(coalesce(sum(r.bytes) filter (where k.id is not null), 0)) as peso_que_queda
from ranked r left join keep k on k.id = r.id;

-- ============================== PASO 2 · borrado ==============================
begin;
with ranked as (
  select s.id, s.created_at,
         row_number() over (partition by s.user_id, s.source_key order by s.created_at desc) as rn,
         row_number() over (partition by s.user_id, s.source_key, (s.created_at at time zone 'Europe/Madrid')::date
                            order by s.created_at desc) as rn_dia
  from public.finance_state_snapshots s
), keep as (
  select id from ranked where rn <= 30
  union select id from ranked where rn_dia = 1 and created_at >= now() - interval '90 days'
  union select snapshot_id from public.finance_source_heads
  union select snapshot_id from public.finance_month_closures
  union select snapshot_id from public.finance_month_reopenings
  union select sample_snapshot_id from public.finance_backup_checks where sample_snapshot_id is not null
  union select s.id from public.finance_state_snapshots s
        join public.finance_sync_runs r on r.id = s.sync_id
        where r.metadata ? 'operation'
)
delete from public.finance_state_snapshots s
where not exists (select 1 from keep k where k.id = s.id);
commit;

-- ============================== PASO 3 · devolver el espacio (ejecútalo solo) ==============================
vacuum full public.finance_state_snapshots;

-- ============================== PASO 4 (opcional) · cada semana, solo ==============================
-- Requiere la extensión pg_cron (Database → Extensions → pg_cron). Lunes a las 04:17 UTC. El borrado semanal no
-- encoge la tabla (no hace VACUUM FULL), pero el espacio que libera se reutiliza para las copias nuevas.
create or replace function public.finance_prune_state_snapshots()
returns integer
language plpgsql
set search_path = public
as $$
declare
  removed integer;
begin
  with ranked as (
    select s.id, s.created_at,
           row_number() over (partition by s.user_id, s.source_key order by s.created_at desc) as rn,
           row_number() over (partition by s.user_id, s.source_key, (s.created_at at time zone 'Europe/Madrid')::date
                              order by s.created_at desc) as rn_dia
    from public.finance_state_snapshots s
  ), keep as (
    select id from ranked where rn <= 30
    union select id from ranked where rn_dia = 1 and created_at >= now() - interval '90 days'
    union select snapshot_id from public.finance_source_heads
    union select snapshot_id from public.finance_month_closures
    union select snapshot_id from public.finance_month_reopenings
    union select sample_snapshot_id from public.finance_backup_checks where sample_snapshot_id is not null
    union select s.id from public.finance_state_snapshots s
          join public.finance_sync_runs r on r.id = s.sync_id
          where r.metadata ? 'operation'
  )
  delete from public.finance_state_snapshots s
  where not exists (select 1 from keep k where k.id = s.id);
  get diagnostics removed = row_count;
  return removed;
end;
$$;

revoke execute on function public.finance_prune_state_snapshots() from public, anon, authenticated;

-- select cron.schedule('finance-prune-state-snapshots', '17 4 * * 1', 'select public.finance_prune_state_snapshots()');
