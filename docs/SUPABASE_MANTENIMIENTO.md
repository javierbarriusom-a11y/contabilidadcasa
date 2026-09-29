# Mantenimiento de Supabase: copias del estado y espacio

Origen: 29 de septiembre de 2026 (sesión 265). El proyecto del hogar superó el límite del plan gratuito
(0,521 de 0,5 GB, 104 %). Este documento recoge cómo se diagnosticó y cómo se limpia, para repetirlo sin
reconstruirlo. **Todas las consultas se ejecutan a mano en el SQL Editor de Supabase**: la app no puede borrar
copias (`finance_state_snapshots` solo concede `select, insert` al rol de la app).

## Qué ocupa el espacio (solo lectura)

```sql
select c.relname as tabla, pg_size_pretty(pg_total_relation_size(c.oid)) as total
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by pg_total_relation_size(c.oid) desc limit 8;

select
  (select count(*) from finance_state_snapshots) as copias,
  (select count(distinct fingerprint) from finance_state_snapshots) as huellas_distintas,
  (select count(*) from finance_month_closures) as cierres,
  pg_size_pretty(pg_database_size(current_database())) as tamano_base_de_datos;
```

Caso real (29-sep-2026): 878 copias con solo 548 huellas distintas (38 % duplicadas), tabla de copias 341 MB,
`finance_audit_log` 97 MB, base 482 MB. Cada guardado con sesión subía la copia completa del estado (~0,4 MB
comprimida) y ~3.700 filas aunque nada hubiera cambiado; desde la sesión 265 los guardados idénticos se omiten.

## Regla de retención

Se conservan: las copias que otras tablas referencian (`finance_source_heads`, `finance_month_closures`,
`finance_month_reopenings`, `finance_backup_checks.sample_snapshot_id`), las últimas 30 y la última de cada día
de los últimos 60 días. Las claves foráneas rechazan borrar una copia referenciada, así que un error en la regla
no puede llevarse por delante la copia activa ni las de los cierres de mes. La tabla de copias no tiene
disparador de auditoría: borrar no genera filas nuevas.

**Antes de borrar**: descargar la copia local en Ajustes › Datos y exportación y guardarla fuera del navegador.
En el plan gratuito no hay copias automáticas de la base. No borrar los datos del navegador mientras la
sincronización no esté sana: la copia local es la más fiable.

## Borrado con freno de seguridad

Sustituir `N` por el número que devuelva antes la consulta de recuento (`se_borrarian`). Si el número real
difiere, el bloque se cancela entero sin borrar nada.

```sql
do $$
declare
  borradas integer;
begin
  with protegidas as (
    select snapshot_id as id from public.finance_source_heads
    union select snapshot_id from public.finance_month_closures
    union select snapshot_id from public.finance_month_reopenings
    union select sample_snapshot_id from public.finance_backup_checks where sample_snapshot_id is not null
  ),
  recientes as (select id from public.finance_state_snapshots order by created_at desc limit 30),
  una_por_dia as (
    select distinct on (created_at::date) id from public.finance_state_snapshots
    where created_at >= now() - interval '60 days'
    order by created_at::date, created_at desc
  ),
  conservar as (select id from protegidas union select id from recientes union select id from una_por_dia)
  delete from public.finance_state_snapshots s where s.id not in (select id from conservar);

  get diagnostics borradas = row_count;
  if borradas <> N then
    raise exception 'Se iban a borrar % copias y se esperaban N. No se ha borrado nada.', borradas;
  end if;
end $$;
```

Recuento previo (mismo criterio, solo lectura): sustituir el `delete` por
`select count(*) filter (where id not in (select id from conservar)) as se_borrarian from public.finance_state_snapshots;`.

Después, para que el espacio se libere de verdad (sin esto el medidor del panel puede no bajar), como **única
sentencia**: `vacuum full public.finance_state_snapshots;`

## Qué queda por vigilar

- `finance_audit_log` crece con cada actualización real de filas de `finance_ledger_entries`/`finance_concepts`
  (31.193 actualizaciones frente a 1.963 altas en el caso real: ~16 por fila). No se toca sin causa: primero
  averiguar qué campo cambia en cada guardado.
- Al arrancar con sesión, la app descarga el contenido completo de las últimas 20 copias
  (`loadRemoteState`); con copias grandes eso puede superar el tiempo límite de Supabase (error 500).
