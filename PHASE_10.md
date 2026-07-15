# Fase 10 - Persistencia normalizada, auditoría y restauración

## Objetivo

Sustituir progresivamente el único documento JSON remoto por entidades financieras separadas, sin romper sesiones ni datos existentes.

## Entidades remotas

- Cuentas.
- Conceptos y partidas.
- Apuntes del libro mayor.
- Contratos de deuda.
- Proyectos.
- Decisiones y eventos de su ciclo de vida.
- Ejecuciones de conciliación.
- Copias completas versionadas.
- Registro de auditoría antes/después.

## Compatibilidad

La escritura remota conserva temporalmente `finance_dashboard_states`. Después crea una ejecución normalizada y sus proyecciones. Si el esquema nuevo aún no está desplegado, la app informa de modo compatible y continúa usando el estado anterior.

La lectura compara la fecha del estado histórico y la última copia normalizada; utiliza la versión más reciente válida.

## Trazabilidad

- Cada sincronización tiene `sync_id`, huella y número de entidades.
- Los eventos de decisión son append-only e idempotentes mediante `event_key`.
- Los cambios en entidades normalizadas generan auditoría SQL con valor anterior y posterior.
- Las copias son append-only y tienen checksum.
- Restaurar una copia crea una versión nueva; nunca modifica la copia original.

## Activación

La estructura debe aplicarse una vez ejecutando `supabase_schema.sql` en el editor SQL de Supabase. No había credenciales de administración ni Supabase CLI enlazada en el entorno local, por lo que la publicación del código no ejecuta DDL remotamente.

## Validación

- Pruebas de normalización e idempotencia.
- Pruebas del esquema, RLS y permisos append-only.
- Batería financiera completa.
- Carga visual sin error ni valores `Infinity`.
