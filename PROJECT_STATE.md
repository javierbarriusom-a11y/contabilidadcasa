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
- `Actualizar` abre la matriz temporal editable del Cuadro de mandos, con importes previstos, impacto futuro, resultados y mínimos; el registro individual de reales sigue disponible en Datos.
- El plan visual de deuda sin WiZink se ha incorporado como sección independiente tras `Deuda y proyectos`; su estado forma parte de la copia local y del payload sincronizado con Supabase.
- P0-6 está verificado de extremo a extremo: el selector remoto, la vista previa comparativa y `restore_finance_snapshot` crean una versión nueva, mueven el puntero activo y conservan el historial.
- La función de restauración está desplegada en el Supabase real y se ejecutó con rol `authenticated` y `auth.uid()` del usuario. La recuperación generó un snapshot nuevo idéntico al objetivo, actualizó la cabecera, completó el registro de sincronización y preservó las 234 versiones existentes tras la operación.
- La suite local actual pasa completa: 109 pruebas, 0 fallos.
- El commit funcional `787c3db` está publicado en `origin/main` y desplegado correctamente mediante GitHub Pages desde la raíz de `main`, con HTTPS activo.
- E1 — Continuidad entre sesiones está verificada: la aplicación carga primero la copia local, conserva
  en IndexedDB una bandeja de salida por usuario y fuente, reanuda revisiones pendientes y detiene la
  publicación ante un conflicto remoto sin sobrescribir el estado local.
- El estado de durabilidad es visible en todas las vistas y distingue copia local, pendiente remoto,
  sincronización completada y conflicto con una acción comprensible para el usuario.
- La prueba E2E controlada cerró la pestaña con el servicio remoto interrumpido, abrió una sesión nueva
  tras recuperar la conexión y confirmó una única escritura automática, sin pérdida ni duplicados.
- El nuevo backlog maestro prioriza continuidad, privacidad y recuperación antes de ampliar P1 o P3.

## Pendiente

- Hacer una conciliación autenticada fila por fila entre el libro canónico local y `finance_ledger_entries` (conteo, IDs, importes y huella). La evidencia actual confirma el flujo remoto y la copia completa, pero no documenta este contraste exhaustivo de todos los movimientos.
- Completar E2: puerta de despliegue, comprobación de disponibilidad publicada, rollback probado y retirada de datos personales del artefacto web estático.
- Completar E3: apertura offline del shell, recuperación guiada y copia de emergencia reimportable.
- Completar P1: cobertura diaria aprendida, datos obligatorios de deuda, efectos legales/fiscales, frontera multiobjetivo, escenarios probabilísticos, procedencia/confianza por KPI, cierre mensual remoto y deshacer importaciones por lote.
- P3 sigue pendiente: proveedor bancario regulado, backend privado de IA y acciones conversacionales confirmables y auditadas.

## Próximo paso

Abordar E2 — despliegue y privacidad sin degradar la continuidad verificada en E1.

## Decisiones importantes

- El estado y los motores canónicos son la única fuente de verdad; el motor histórico no decide cifras ni actúa como fallback silencioso.
- `Implementado` no equivale a `Verificado`: el cierre exige pruebas extremo a extremo, persistencia, restauración y validación en escritorio y móvil.
- Una invariante rota bloquea la publicación compartida, pero conserva localmente cambios y borradores.
- P0-5 se considera completada por la implementación, sus pruebas y la validación remota; roadmap y estado del proyecto ya están alineados.
- Supabase normalizado debe ser la fuente autoritativa; `finance_dashboard_states` queda solo para migración o fallback controlado.
- Las operaciones destructivas requieren confirmación, auditoría y recuperación mediante versiones; restaurar crea una versión nueva y no borra el historial.
- El plan visual de deuda se mantiene aislado del motor canónico hasta revisar su integración de datos al terminar la hoja de ruta, pero se conserva dentro del estado versionado compartido.
- Las decisiones financieras protegen reserva y pagos hasta el siguiente ingreso; la deuda suspendida no libera ahorro ficticio y los horizontes mayores de 24 meses se expresan como rangos.

## Errores conocidos y riesgos

- No hay fallos automatizados conocidos en el estado local revisado (109/109 pruebas pasan).
- La validación de cierre confirmó GitHub Pages en estado `built`, el workflow de despliegue completado con éxito y la presencia pública de `Actualizar`, `Plan de deuda` y los recursos versionados actuales.
- La concurrencia entre sesiones queda protegida mediante comparación del puntero `finance_source_heads`; una sesión obsoleta conserva su copia local y exige recarga en vez de sobrescribir la revisión vigente.
- No consta pérdida de movimientos en pruebas ni en la verificación remota documentada, pero falta conservar evidencia de un recuento remoto exhaustivo por ID e importe; por ello no se da por cerrada todavía esa confirmación.
- La restauración remota transaccional está desplegada y verificada sin pérdida en el Supabase real; el cierre mensual remoto y el deshacer remoto por lote siguen incompletos.
- E1 fue comprobada en navegador real contra un servicio remoto local controlado: durante la caída el
  servidor recibió cero escrituras; tras cerrar y reabrir recibió exactamente una; una tercera apertura
  confirmó la bandeja vacía. No hubo errores de consola.
- La validación visual del indicador global pasó en escritorio y a 390 px sin desbordamiento horizontal.
- Durante el QA previo, el navegador local recuperó una sesión Supabase ya autenticada y sincronizó la
  copia local normal; no se introdujeron datos de prueba en el proyecto remoto.
- La cobertura de procedencia y confianza no alcanza todavía todos los KPI; los efectos legales y fiscales requieren fuentes verificadas y revisión profesional.
- La documentación de backlog y la hoja de ruta discrepan en varios estados y fechas de corte, por lo que `ROADMAP_EXECUTION.md` se toma como criterio conservador de finalización.

## Último commit estable

- `f7e8144` — `feat: preserve remote saves across sessions` (31 de julio de 2026).
- Contiene la entrega funcional E1, sus pruebas unitarias, el escenario E2E reproducible y el backlog actualizado.
- La suite local pasa con 109 pruebas y 0 fallos; `git diff --check` también pasa.
- El cierre documental anterior quedó publicado mediante `9f7777d` (`docs: close E1 continuity session`).
- La rama de trabajo es `main`; antes de esta revisión estaba sincronizada con `origin/main`.
- El único archivo local ajeno a los commits sigue siendo la carpeta `.agents/` sin seguimiento, que
  se ha preservado.
