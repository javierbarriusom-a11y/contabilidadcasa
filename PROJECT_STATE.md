# Estado del proyecto

Fecha de revisión: 1 de agosto de 2026.

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
- La suite local actual pasa completa: 127 pruebas, 0 fallos.
- La revisión estable `2c793d4` está publicada en `origin/main`; el cierre funcional de E4 quedó consolidado en `d32b02a` y superó pruebas, privacidad y smoke test.
- E1 — Continuidad entre sesiones está verificada: la aplicación carga primero la copia local, conserva
  en IndexedDB una bandeja de salida por usuario y fuente, reanuda revisiones pendientes y detiene la
  publicación ante un conflicto remoto sin sobrescribir el estado local.
- El estado de durabilidad es visible en todas las vistas y distingue copia local, pendiente remoto,
  sincronización completada y conflicto con una acción comprensible para el usuario.
- La prueba E2E controlada cerró la pestaña con el servicio remoto interrumpido, abrió una sesión nueva
  tras recuperar la conexión y confirmó una única escritura automática, sin pérdida ni duplicados.
- El nuevo backlog maestro prioriza continuidad, privacidad y recuperación antes de ampliar P1 o P3.
- E2 queda implementada localmente: el paquete público usa datos sintéticos, el artefacto se construye
  mediante una lista cerrada, CI bloquea el despliegue ante fallos de pruebas, privacidad o arranque y
  existe un monitor programado de HTTPS, recursos críticos y versión.
- La caché de `data.js`, `app.js` y el plan visual de deuda se invalida mediante una versión nueva para
  evitar que visitas anteriores conserven recursos estáticos antiguos.
- E2 está verificada en producción: Pages publica mediante Actions, la URL sirve únicamente el paquete
  demo permitido, `version.json` identifica la revisión, el monitor manual pasa y un revert no destructivo
  entre revisiones seguras superó nuevamente las 109 pruebas, privacidad y smoke test.
- E3 está implementada y verificada localmente: un service worker cachea solo el shell público del mismo
  origen, excluye Supabase y recursos remotos, y permitió reabrir la aplicación después de apagar por
  completo el servidor local.
- El arranque con cola pendiente o conflicto ya no publica ni sustituye silenciosamente: compara fechas
  y huellas y permite reanudar, continuar localmente, descargar la copia o elegir la nube.
- La copia de emergencia usa un sobre versionado con checksum, vista previa y confirmación; la prueba de
  ida y vuelta conserva el payload y su huella en un perfil limpio simulado.
- E3 está publicada y verificada en Pages mediante `e149c9c`: el service worker y el manifiesto se sirven
  correctamente, el navegador abre la interfaz sin errores y la revisión pública conserva el shell demo.
- E4 está verificada de extremo a extremo: la sincronización autenticada concilia
  `finance_ledger_entries` por conteo, identificador, importe y huella; el cierre mensual de julio creó
  una copia nueva, auditoría append-only y un puntero transaccional en Supabase.
- Tras recargar una sesión autenticada, el cierre se recuperó desde `finance_month_closures`; julio
  permaneció visible como histórico de solo lectura y el botón quedó desactivado, impidiendo repetirlo.
- La suite local de cierre pasa completa: 125 pruebas, construcción pública, privacidad y smoke test.
- La interfaz distingue ya los cambios pendientes de la matriz temporal del guardado automático de
  reales: muestra confirmación al salir de una casilla y exige «Preparar cambio pendiente» en el ajuste rápido.
- El Cuadro de mandos separa «Planificar futuro» de «Registrar lo ocurrido» y muestra por partida el
  previsto, el real y el importe usado por el cálculo. Un real vacío recupera la previsión y un cero
  explícito permanece como real; la cobertura automatizada asciende a 127 pruebas.
- El rediseño previsto/real/usado y la aclaración del guardado están publicados en `origin/main`; el
  cierre del 01/08/2026 repitió con éxito pruebas, construcción, privacidad y smoke test.

## Pendiente

- Completar E5: reapertura controlada de mes, deshacer importaciones por lote, retirada del fallback remoto silencioso y política de retención/verificación de copias.
- Completar P1: cobertura diaria aprendida, datos obligatorios de deuda, efectos legales/fiscales, frontera multiobjetivo, escenarios probabilísticos y procedencia/confianza por KPI.
- P3 sigue pendiente: proveedor bancario regulado, backend privado de IA y acciones conversacionales confirmables y auditadas.

## Próximo paso

Iniciar E5 por la reapertura controlada de un mes como revisión nueva, confirmada y auditable.

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

- No hay fallos automatizados conocidos en el estado local revisado (127/127 pruebas pasan).
- La validación de cierre confirmó GitHub Pages en estado `built`, el workflow de despliegue completado con éxito y la presencia pública de `Actualizar`, `Plan de deuda` y los recursos versionados actuales.
- La concurrencia entre sesiones queda protegida mediante comparación del puntero `finance_source_heads`; una sesión obsoleta conserva su copia local y exige recarga en vez de sobrescribir la revisión vigente.
- La conciliación remota exhaustiva y el cierre mensual transaccional están desplegados y verificados en el Supabase real. El deshacer remoto por lote y la reapertura controlada siguen pendientes para E5.
- E1 fue comprobada en navegador real contra un servicio remoto local controlado: durante la caída el
  servidor recibió cero escrituras; tras cerrar y reabrir recibió exactamente una; una tercera apertura
  confirmó la bandeja vacía. No hubo errores de consola.
- La validación visual del indicador global pasó en escritorio y a 390 px sin desbordamiento horizontal.
- Durante el QA previo, el navegador local recuperó una sesión Supabase ya autenticada y sincronizó la
  copia local normal; no se introdujeron datos de prueba en el proyecto remoto.
- La cobertura de procedencia y confianza no alcanza todavía todos los KPI; los efectos legales y fiscales requieren fuentes verificadas y revisión profesional.
- La documentación de backlog y la hoja de ruta discrepan en varios estados y fechas de corte, por lo que `ROADMAP_EXECUTION.md` se toma como criterio conservador de finalización.
- El 31/07/2026 Pages cambió de `build_type: legacy` a `workflow`; el commit funcional de E2
  `23d07dd` quedó publicado en `origin/main`. La primera ejecución de CI detectó una opción de caché
  incompatible con la ausencia de `package-lock.json`; se retiró antes de reintentar el despliegue.
- El despliegue corregido `6396fde` superó la puerta completa y la URL pública sirvió el paquete demo
  junto con un `version.json` que identifica ese commit. El primer disparo manual del monitor confirmó
  la disponibilidad, pero expuso un código 23 de `curl` por cierre temprano de tubería; el monitor se
  ajustó para descargar y validar cada recurso por separado.
- La revisión `048a48b` desplegó el monitor corregido; su ejecución manual comprobó HTTPS, arranque,
  `app.js`, paquete demo y `version.json` sin fallos.
- La prueba de rollback creó un revert aislado de `048a48b` en un worktree temporal, ejecutó de nuevo
  `npm run verify` con 109/109 pruebas y eliminó el worktree sin alterar `main` ni el sitio publicado.
- La puerta local `npm run verify` pasa completa tras el rediseño previsto/real/usado: 127 pruebas, construcción de `dist/`, revisión de
  privacidad y smoke test. `git diff --check` también pasa.
- QA del artefacto `dist/`: escritorio a 1280 px y móvil a 390×844, sin desbordamiento horizontal ni
  errores de consola; el menú móvil abre correctamente.
- QA E3 local: tras una visita inicial se apagó el servidor y el shell reabrió sin red en escritorio y
  a 390×844, sin errores de consola ni desbordamiento horizontal. La interfaz de recuperación queda
  disponible en ambos tamaños.
- QA E3 publicado: `version.json` sirvió `e149c9c`, Pages entregó el service worker y el manifiesto con
  ámbito relativo correcto, y la carga real en navegador no mostró errores de consola ni desbordamiento.

## Último commit estable

- `cceb3c2` — `docs: record dashboard value workflow` (1 de agosto de 2026), publicado en `origin/main`.
- `c44563a` — `feat: clarify planned actual and calculated dashboard values` (1 de agosto de 2026), validado localmente antes de publicar.
- `43e1124` — `fix: clarify dashboard save behavior` (1 de agosto de 2026), validado localmente antes de publicar.
- `2c793d4` — `docs: close validated E4 delivery` (31 de julio de 2026), publicado en `origin/main`; la revisión funcional `d32b02a` fue verificada tras recarga autenticada.
- La puerta local pasa con 127 pruebas, construcción de `dist/`, revisión de privacidad y smoke test; `git diff --check` también pasa.
- La rama de trabajo es `main` y estaba sincronizada con `origin/main` en `cceb3c2` al iniciar este cierre. No hay cambios funcionales pendientes; la carpeta `.agents/` permanece sin seguimiento, preservada y fuera de los commits.
