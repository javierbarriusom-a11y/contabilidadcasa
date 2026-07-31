# Estado del proyecto

Fecha de revisión: 31 de julio de 2026.

## Terminado

- Arquitectura canónica implantada para estado, libro mayor, cálculo mensual y diario, decisiones, workflow, deuda, comparación de acuerdos y persistencia normalizada.
- P0-1 a P0-5 verificados: libro e identidades estables, Supabase autoritativo, auditoría inmutable, motor único e invariantes como barrera de sincronización.
- P2-1 a P2-6 verificados: huchas, modelo Javi/Tere/Hogar, alertas, indicadores de comportamiento, documentos y exportación para asesor.
- UX-1 a UX-6 verificadas: navegación principal, vista Hoy, centro de acciones, modo familiar, centro de alertas, accesibilidad y responsive.
- La puerta P0-5 impide publicar en Supabase escenarios incompletos, diferencias diaria/mensual, deuda duplicada y errores canónicos críticos; los avisos no críticos no bloquean.
- Cola remota verificada con dos sesiones autenticadas: conserva el último cambio durante una escritura, bloquea una sesión obsoleta y recupera la revisión vigente al recargar.
- Los movimientos del libro canónico se proyectan en `finance_ledger_entries` y la copia completa versionada permite una ida y vuelta verificable sin pérdida en las pruebas.
- Control optimista y cola remota consolidados en Git mediante `cedac92` (`fix: protect remote saves across sessions`).
- Navegación operativa reorganizada: `Actualizar` queda tras `Hoy` para registrar reales uno a uno y `Movimientos` pasa al bloque Datos tras `Carga de datos`.
- La suite local actual pasa completa: 101 pruebas, 0 fallos.

## Pendiente

- Completar P0-6 con selector remoto, vista previa y restauración transaccional guiada.
- Hacer una conciliación autenticada fila por fila entre el libro canónico local y `finance_ledger_entries` (conteo, IDs, importes y huella). La evidencia actual confirma el flujo remoto y la copia completa, pero no documenta este contraste exhaustivo de todos los movimientos.
- Completar P1: cobertura diaria aprendida, datos obligatorios de deuda, efectos legales/fiscales, frontera multiobjetivo, escenarios probabilísticos, procedencia/confianza por KPI, cierre mensual remoto y deshacer importaciones por lote.
- P3 sigue pendiente: proveedor bancario regulado, backend privado de IA y acciones conversacionales confirmables y auditadas.

## Próximo paso

Cerrar P0-6 con selector remoto, vista previa y restauración transaccional guiada. Después, abordar el cierre mensual transaccional y la conciliación remota exhaustiva de movimientos.

## Decisiones importantes

- El estado y los motores canónicos son la única fuente de verdad; el motor histórico no decide cifras ni actúa como fallback silencioso.
- `Implementado` no equivale a `Verificado`: el cierre exige pruebas extremo a extremo, persistencia, restauración y validación en escritorio y móvil.
- Una invariante rota bloquea la publicación compartida, pero conserva localmente cambios y borradores.
- P0-5 se considera completada por la implementación, sus pruebas y la validación remota; roadmap y estado del proyecto ya están alineados.
- Supabase normalizado debe ser la fuente autoritativa; `finance_dashboard_states` queda solo para migración o fallback controlado.
- Las operaciones destructivas requieren confirmación, auditoría y recuperación mediante versiones; restaurar crea una versión nueva y no borra el historial.
- Las decisiones financieras protegen reserva y pagos hasta el siguiente ingreso; la deuda suspendida no libera ahorro ficticio y los horizontes mayores de 24 meses se expresan como rangos.

## Errores conocidos y riesgos

- No hay fallos automatizados conocidos en el estado local revisado (101/101 pruebas pasan).
- La concurrencia entre sesiones queda protegida mediante comparación del puntero `finance_source_heads`; una sesión obsoleta conserva su copia local y exige recarga en vez de sobrescribir la revisión vigente.
- No consta pérdida de movimientos en pruebas ni en la verificación remota documentada, pero falta conservar evidencia de un recuento remoto exhaustivo por ID e importe; por ello no se da por cerrada todavía esa confirmación.
- La restauración remota transaccional, el cierre mensual remoto y el deshacer remoto por lote están incompletos.
- La cobertura de procedencia y confianza no alcanza todavía todos los KPI; los efectos legales y fiscales requieren fuentes verificadas y revisión profesional.
- La documentación de backlog y la hoja de ruta discrepan en varios estados y fechas de corte, por lo que `ROADMAP_EXECUTION.md` se toma como criterio conservador de finalización.

## Último commit estable

- `cedac92` — `fix: protect remote saves across sessions` (31 de julio de 2026).
- Es el commit funcional verificado de la rama `fix/persistence-save-queue`; incluye la cola, el control optimista, el bloqueo de sesiones obsoletas, las pruebas y la actualización de P0-2.
- El `HEAD` actual, `e3a8daa`, solo actualiza documentación sobre esa verificación remota.
- `main` y `origin/main` permanecen en `fc7e04d` hasta integrar esta rama.
