# Estado del proyecto

Fecha de revisión: 31 de julio de 2026.

## Terminado

- Arquitectura canónica implantada para estado, libro mayor, cálculo mensual y diario, decisiones, workflow, deuda, comparación de acuerdos y persistencia normalizada.
- P0-2 (Supabase normalizado como fuente autoritativa), P0-3 (máquina de estados y auditoría inmutable) y P0-4 (motor único de cálculo) verificados de extremo a extremo.
- P2-1 a P2-6 verificados: huchas, modelo Javi/Tere/Hogar, alertas, indicadores de comportamiento, documentos y exportación para asesor.
- UX-1 a UX-6 verificadas: navegación principal, vista Hoy, centro de acciones, modo familiar, centro de alertas, accesibilidad y responsive.
- Puerta de invariantes para impedir la publicación remota de estados canónicos incoherentes.
- Cola remota verificada con dos sesiones autenticadas: conserva el último cambio durante una escritura, bloquea una sesión obsoleta y recupera la revisión vigente al recargar.
- La suite local actual pasa completa: 100 pruebas, 0 fallos.

## Pendiente

- Completar la verificación remota de P0-1: crear y eliminar una entidad de prueba, recargar en dos sesiones y confirmar que la baja no reaparece.
- Consolidar en Git la cola de guardado remoto y el control optimista ya verificados contra Supabase.
- Cerrar P0-5 para todos los guardados/publicaciones y completar P0-6 con selector remoto y restauración transaccional guiada.
- Completar P1: cobertura diaria aprendida, datos obligatorios de deuda, efectos legales/fiscales, frontera multiobjetivo, escenarios probabilísticos, procedencia/confianza por KPI, cierre mensual remoto y deshacer importaciones por lote.
- P3 sigue pendiente: proveedor bancario regulado, backend privado de IA y acciones conversacionales confirmables y auditadas.
- Alinear `BACKLOG_STATUS.md` (corte del 18 de julio) con `ROADMAP_EXECUTION.md` (actualizado localmente el 30 de julio): el primero usa “entregado” para elementos que la hoja de ruta aún considera parciales por faltar validación extremo a extremo.

## Próximo paso

Cerrar P0-1 con una prueba remota de baja: crear una entidad identificable de prueba, sincronizarla, eliminarla, recargar desde las dos sesiones y confirmar que no reaparece. Después consolidar los cambios en Git y abordar el cierre mensual transaccional.

## Decisiones importantes

- El estado y los motores canónicos son la única fuente de verdad; el motor histórico no decide cifras ni actúa como fallback silencioso.
- `Implementado` no equivale a `Verificado`: el cierre exige pruebas extremo a extremo, persistencia, restauración y validación en escritorio y móvil.
- Una invariante rota bloquea la publicación compartida, pero conserva localmente cambios y borradores.
- Supabase normalizado debe ser la fuente autoritativa; `finance_dashboard_states` queda solo para migración o fallback controlado.
- Las operaciones destructivas requieren confirmación, auditoría y recuperación mediante versiones; restaurar crea una versión nueva y no borra el historial.
- Las decisiones financieras protegen reserva y pagos hasta el siguiente ingreso; la deuda suspendida no libera ahorro ficticio y los horizontes mayores de 24 meses se expresan como rangos.

## Errores conocidos y riesgos

- No hay fallos automatizados conocidos en el estado local revisado (100/100 pruebas pasan).
- La concurrencia entre sesiones queda protegida mediante comparación del puntero `finance_source_heads`; una sesión obsoleta conserva su copia local y exige recarga en vez de sobrescribir la revisión vigente.
- La restauración remota transaccional, el cierre mensual remoto y el deshacer remoto por lote están incompletos.
- La cobertura de procedencia y confianza no alcanza todavía todos los KPI; los efectos legales y fiscales requieren fuentes verificadas y revisión profesional.
- La documentación de backlog y la hoja de ruta discrepan en varios estados y fechas de corte, por lo que `ROADMAP_EXECUTION.md` se toma como criterio conservador de finalización.

## Último commit estable

- `fc7e04d` — `feat: gate remote sync with canonical invariants` (18 de julio de 2026).
- Es el `HEAD` compartido por `main`, `origin/main` y la rama actual `fix/persistence-save-queue`.
- Los cambios locales posteriores de la cola de guardado remoto no forman parte aún de este commit estable.
