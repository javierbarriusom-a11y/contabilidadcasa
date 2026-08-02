# Estado del proyecto

Fecha de revisión: 2 de agosto de 2026.

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
- La suite local actual pasa completa: 136 pruebas, 0 fallos.
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
- E5 está implementada localmente de A1-3 a A1-6: reapertura de mes y deshacer importaciones crean
  revisiones nuevas con motivo, vista previa, confirmación, auditoría y control de concurrencia.
- La persistencia ya no escribe silenciosamente en `finance_dashboard_states`: si falta el esquema
  normalizado conserva la copia local y exige una migración explícita confirmada.
- Las copias disponen de política operativa: 30 revisiones recientes, una muestra mensual durante
  24 meses y protección permanente de cierres, reaperturas, importaciones, deshacer y restauraciones.
  La comprobación valida huellas, registra el resultado y ensaya una copia de muestra sin borrado automático.
- La puerta local de E5 pasa completa: 135 pruebas, construcción pública, privacidad, smoke test y
  `git diff --check`; la interfaz fue validada sin errores ni desbordamiento en escritorio y a 390×844.
- La implementación local de E5 está consolidada y publicada en `origin/main` mediante `6b452d5`
  (`feat: implement E5 operational recovery controls`).
- E5 está verificada en el Supabase real: el esquema se desplegó, una sesión autenticada cerró,
  reabrió y volvió a cerrar agosto, y un lote temporal se importó y deshizo mediante revisiones nuevas.
- La aceptación confirmó el bloqueo optimista de una sesión obsoleta, la migración heredada únicamente
  mediante confirmación explícita y 306/306 copias con huella válida; la muestra restaurable quedó registrada.
- Los cuadros nativos de las operaciones E5 se sustituyeron por un diálogo accesible con motivo obligatorio.
- El cierre completo de E5 quedó publicado en `origin/main` mediante `4431939`
  (`feat: verify and close E5 remote recovery`).
- E6 queda iniciada localmente con contratos canónicos para aprender patrones de caja únicamente desde
  movimientos conciliados, calcular cobertura hasta el siguiente ingreso y admitir ajustes manuales.
- Los contratos de deuda exponen una matriz de calidad para capital, mora, TAE, suspensión, vencimiento,
  titular, acuerdo y procedencia; los datos ausentes permanecen visibles como avisos y no se inventan.
- Hoy y el centro de acciones consumen ya una lectura ejecutiva común y versionada. Sus KPI incluyen
  fecha, fuente, método, cobertura y confianza, y el contrato limita la salida a tres decisiones ordenadas.
- La puerta local de este avance E6 pasa completa con 142 pruebas, construcción pública, privacidad,
  smoke test y `git diff --check`; Hoy fue validado sin errores ni desbordamiento en escritorio y 390×844.
- E6 está verificada de extremo a extremo: Hoy permite editar y retirar la cobertura aprendida; Datos y
  auditoría muestran los campos desconocidos y la calidad de cada deuda, además de fuente, fecha, método,
  cobertura y confianza de los KPI mediante una lectura ejecutiva única y versionada.
- La aceptación autenticada guardó y sincronizó un ajuste de cobertura, lo recuperó después de recargar,
  restauró el aprendizaje automático y volvió a recuperarlo vacío. La suite completa pasa con 148 pruebas,
  construcción pública, privacidad, smoke test y `git diff --check`.
- Se restauró en Supabase la copia remota válida más reciente del 01/08/2026 07:11:45 mediante una revisión
  nueva. La vista previa y la autorización confirmaron eliminar un gasto real; el historial anterior se conserva.
- La restauración confirmada retira ahora la revisión local pendiente que expresamente sustituye, evitando
  que la cola local bloquee una recuperación autorizada. La consulta mantiene 20 copias para atravesar tandas
  recientes inválidas.
- El scroll de escritorio es único para navegación y contenido: la rueda sobre la barra lateral desplaza
  la página; el menú móvil conserva su desplazamiento interno. La comprobación real pasó a 1280 px y
  390×844 sin desbordamiento horizontal.
- E7 está verificada de extremo a extremo: el comparador expone efectos legales/fiscales con fuente oficial,
  fecha, jurisdicción y advertencia profesional; calcula una frontera no dominada; calibra escenarios
  solo con histórico conciliado; y exige una comparación integral antes/después antes de aplicar CSV,
  lotes pegados o libros XLS/XLSX completos.
- La caché offline se versionó para incluir el contrato E7. La puerta local pasa con 161 pruebas,
  construcción pública, privacidad, smoke test y `git diff --check`; la interfaz se validó sin errores
  de consola en un origen limpio.
- La aceptación autenticada de E7 importó y recuperó un lote sintético tras recargar, bloqueó una sesión
  obsoleta sin sobrescribir, deshizo el lote mediante una revisión nueva y restauró una copia anterior
  conservando 19 versiones recuperables. El estado final no contiene los dos conceptos sintéticos usados.
- La aceptación detectó y corrigió un reintento que intentaba actualizar `finance_import_batches` después
  de deshacer. El guardado general inserta ahora lotes nuevos sin modificar duplicados; solo la RPC
  transaccional autorizada cambia su estado. La repetición importación-deshacer-recarga pasó sin errores RLS.
- E7 está publicada en GitHub Pages mediante `ba56333`. El workflow de despliegue terminó correctamente,
  Pages figura en estado `built` con HTTPS obligatorio y `version.json` sirve la revisión completa
  `ba56333577db65e2c6dcf870663c302cfe25152d`.
- La comprobación pública confirmó el contrato E7, `app.js` e7b, el service worker e7b y los recursos
  críticos. El monitor manual `Published availability` de `ba56333` terminó con éxito.
- E8 está verificada de extremo a extremo de A3-1 a A3-7: historial operativo unificado, comparación detallada
  de versiones, centro de calidad, acciones seguras desde alertas, adjuntos cifrados privados,
  accesibilidad continua y presupuesto de rendimiento con 10.000 filas.
- Los adjuntos multidispositivo usan AES-GCM con clave derivada mediante PBKDF2; la clave no se guarda ni
  se sincroniza. El esquema define un bucket privado, límite de tamaño, aislamiento por usuario y
  eliminación recuperable durante 30 días antes del borrado definitivo.
- La puerta local E8 pasa completa con 172 pruebas, accesibilidad estructural, prueba de rendimiento,
  construcción pública, privacidad, smoke test y `git diff --check`. El QA pasó a 1280 px y 390×844 sin
  errores de consola ni desbordamiento horizontal.
- El bucket privado E8 y sus cuatro políticas RLS están desplegados en el Supabase real. Una cuenta
  sintética confirmó cifrado, subida, recuperación de ficha en una segunda sesión independiente,
  descarga, descifrado exacto, eliminación recuperable, restauración y borrado definitivo.
- La aceptación dejó el bucket sin el objeto sintético y eliminó la cuenta temporal y sus revisiones.
  Durante la limpieza se corrigió `finance_append_audit` para que una cascada autorizada de `auth.users`
  no quede bloqueada por una auditoría con clave foránea ya eliminada.
- E8 quedó publicada en `origin/main` mediante `939acc6` y `dfe3bb2`. El workflow de cierre
  `30698057298` completó correctamente la verificación y el despliegue de GitHub Pages.
- E9 está implementada y publicada con servicios externos apagados por defecto: fundamento común de
  consentimiento y minimización, hogar compartido, asistente, borradores confirmables, web push,
  conexión PSD2 de solo lectura e importación bancaria programada e idempotente.
- La decisión de IA queda registrada como «OpenAI API, Responses API, almacenamiento desactivado y
  backend privado». El modelo se elegirá más adelante mediante pruebas de calidad, coste y latencia.
- La interfaz reúne las dependencias externas en un panel gris de «Pendiente de activación» y conserva
  CSV, Excel, entrada manual, alertas locales y asistente local. No ofrece conexiones, invitaciones ni
  acciones remotas prematuras y no se ha compartido ningún dato.
- La puerta local E9 pasa con 229 pruebas, accesibilidad estructural, rendimiento con 10.000 filas,
  construcción pública, privacidad, smoke test y `git diff --check`. El panel se validó a 1280 px y
  390×844 sin errores de consola ni desbordamiento horizontal.
- E9 queda verificada como publicación segura mediante `ef57e9b`: el workflow `30712474715` terminó
  correctamente, Pages figura como `built` con HTTPS obligatorio y `version.json` sirve el SHA completo
  `ef57e9bf361fef67247648e222d5cebf7c981ccd`.
- El QA publicado confirmó cuatro tarjetas grises, dos columnas a 1280 px y una columna a 390×844, sin
  desbordamiento ni errores de consola. Una sesión con caché E8 necesitó una recarga para activar el
  service worker e9c; la segunda carga mostró el shell E9 correcto.
- Se creó `BACKLOG_PRODUCT_EVOLUTION.md` como referencia para la evolución posterior a E9. E10 queda
  expresamente para el final y el producto local avanza primero por datos, forecast, escenarios y deuda.
- E11a está implementada, verificada y publicada en `origin/main` mediante `992a678`: `Actualizar` abre un centro guiado para saldos,
  reales, movimientos, previsiones, cargas masivas y conciliación; cada ruta explica su guardado y
  muestra frescura y siguiente paso recomendado.
- La semántica previsto/real/usado es visible también en el registro mensual. La aplicación mantiene
  vacío como «sin real», cero como real explícito y diferencia el guardado automático de reales de la
  confirmación de cambios futuros.
- La puerta completa de cierre de E11a pasa con 232 pruebas, accesibilidad estructural, rendimiento con 10.000
  filas, construcción pública, privacidad, smoke test y `git diff --check`. El QA pasó a 1280 px y
  390×844 sin errores de consola ni desbordamiento horizontal.
- El shell offline se versionó como e11a2. Durante el QA se corrigió el menú móvil cerrado, que heredaba
  una altura mínima de pantalla completa y desplazaba el contenido fuera de la primera vista.
- El cierre posterior al push repitió la puerta completa con 232/232 pruebas y `git diff --check`. El
  commit `992a678` está en `main` y `origin/main`; la publicación de GitHub Pages no se volvió a comprobar
  en esta sesión y no se presenta como validada.
- E11b está implementada, verificada y publicada mediante `989f20d`: tablas pegadas, CSV, libros Excel
  y extractos bancarios pasan por una bandeja previa común con comparación y confirmación antes de
  modificar saldos, reales o movimientos.
- El flujo genera recibos recuperables, permite deshacer por lote, agrupa la conciliación en tareas
  seguras y muestra frescura de saldos, movimientos, reales, previsión y deuda. Las copias anteriores
  se migran sin pérdida y la bandeja puede desactivarse conservando los flujos clásicos.
- La puerta completa de E11b pasa con 242/242 pruebas, accesibilidad estructural, rendimiento con 10.000
  filas, construcción pública, privacidad, smoke test y `git diff --check`. El QA en navegador real a
  390×844 no mostró errores de consola ni desbordamiento horizontal.
- El shell offline se versionó como e11b1 e incluye el nuevo contrato. Una primera carga controlada por
  la caché e11a necesitó recargar para activar el nuevo service worker; la segunda carga sirvió E11b.
- E12a está implementada, publicada y verificada: `finance-canonical-forecast/v1` envuelve el motor mensual
  sin introducir un cálculo alternativo, registra ocho supuestos versionados y expone una serie mensual
  explicable con recurrencia, deuda, proyectos y ajustes.
- Las vistas actuales consumen la serie E12a conservando sus cifras; una barrera de paridad bloquea el
  forecast si ingresos, salidas, ahorro o saldos difieren más de dos céntimos del motor canónico.
- La puerta completa pasa con 247/247 pruebas, accesibilidad estructural, rendimiento con 10.000 filas,
  construcción pública, privacidad, smoke test y `git diff --check`.
- GitHub Pages sirve el commit `6269093`; el workflow `30724247136` y el monitor manual
  `30724361841` terminaron correctamente. El shell e12a1 tomó el control tras una recarga desde la caché
  anterior y pasó QA a 1280 px y 390×844 sin errores ni desbordamiento.
- E13a está implementada y validada localmente mediante `finance-e13-scenario-lab/v1`: genera base,
  favorable y tensión desde el forecast canónico, admite pérdida de ingreso, gasto extraordinario,
  coche, mudanza y deuda, y compara caja mínima, meses negativos, ahorro, deuda y recuperación.
- Los eventos E13a viven únicamente en memoria y recalculan una copia temporal; no usan almacenamiento,
  guardado remoto ni sincronización. La puerta completa pasa con 252/252 pruebas y el QA local pasó en
  escritorio y móvil sin errores de consola ni desbordamiento horizontal.
- El commit E13a `e5ad5ef` está publicado: el workflow `30724627149`, Pages con HTTPS y el monitor
  `30724683958` terminaron correctamente, y `version.json` sirve el SHA exacto.
- La aceptación en navegador detectó que el shell e13a1 podía llenar su caché nueva con un `app.js`
  antiguo del caché HTTP. La corrección e13a2 fuerza `cache: reload` al descargar cada recurso y pasa
  localmente la puerta completa con 252/252 pruebas.
- La corrección e13a2 quedó publicada mediante `26b26fb`: el workflow `30724860320`, Pages con HTTPS,
  `version.json` y el monitor `30724880379` terminaron correctamente. La misma sesión atrapada en E12a
  actualizó a E13a tras una recarga y el QA pasó a 1280 px y 390×844 sin errores ni desbordamiento.
- E13a queda verificada de extremo a extremo. El laboratorio publicado creó un evento temporal, recalculó
  base, favorable y tensión y confirmó expresamente que no guardó ni modificó el plan.
- E14a está implementada, validada y publicada en `origin/main` mediante `a0a65c7`: el plan visual recibe
  contratos, liquidez, capacidad y forecast desde `finance-e14-debt-roadmap-read-model/v1` sin escribir
  esos campos en `debtRoadmapState` ni modificar el estado canónico.
- El inventario E14a clasifica cada campo como canónico, operativo, supuesto o nota. Las correspondencias
  de Entidad A y Entidad B solo se aplican si existe un contrato único; un forecast inválido o cualquier
  correspondencia ambigua conserva el valor anterior y no activa una migración automática.
- `finance-debt-strategy/v1` normaliza quita, pago único, refinanciación, suspensión, mora, reanudación de
  pagos y espera. E14a solo valida y expone estrategias; su aplicación confirmada continúa fuera de alcance.
- La puerta completa E14a pasa con 260/260 pruebas, accesibilidad, rendimiento con 10.000 filas,
  construcción pública, privacidad, smoke test y `git diff --check`. El QA pasó a 1280 px y 390×844 sin
  desbordamiento horizontal y confirmó los controles canónicos bloqueados.
- El workflow de Pages usa ya las acciones con Node.js 24: `configure-pages@v6`,
  `upload-pages-artifact@v5` y `deploy-pages@v5`. La ejecución `30731502159` pasó verificación y despliegue
  sin anotaciones de Node.js 20; la puerta completa mantiene 260/260 pruebas y el YAML es válido.
- E12b/E13b están verificadas localmente: el forecast aprende desviaciones y estacionalidad únicamente
  desde meses conciliados, adapta el horizonte y el laboratorio añade percentiles prudentes, reglas de
  correlación, sensibilidad y escenarios guardados reproducibles sin promoverlos al plan.
- La aceptación a 1280 px y 390×844 confirmó ausencia de errores y desbordamiento. Un escenario se guardó,
  recuperó tras recargar y recalculó como copia conservando el original. La puerta completa pasa con
  266/266 pruebas, accesibilidad, rendimiento, construcción, privacidad, smoke test y `git diff --check`.
- La implementación y su documentación quedaron publicadas en `origin/main` mediante `bdf6367`
  (`feat: complete E12b and E13b forecasting`). GitHub Pages no se comprobó en este cierre.

## Pendiente

- E14b y E15 a E18 permanecen pendientes según `BACKLOG_PRODUCT_EVOLUTION.md`.
- E10 reúne la activación y aceptación externa por servicio: desplegar el backend privado, elegir el
  modelo de OpenAI, desplegar políticas de hogar y web push y, al final, contratar y validar el proveedor
  PSD2 antes de habilitar la importación programada. Por decisión de producto se ejecutará al final.

## Próximo paso

Iniciar E14b con ofertas y negociación, optimización bajo restricciones reales, integración con
escenarios, aplicación confirmada y retirada gradual del `iframe`. E10 se mantiene al final.

## Decisiones importantes

- El estado y los motores canónicos son la única fuente de verdad; el motor histórico no decide cifras ni actúa como fallback silencioso.
- `Implementado` no equivale a `Verificado`: el cierre exige pruebas extremo a extremo, persistencia, restauración y validación en escritorio y móvil.
- Una invariante rota bloquea la publicación compartida, pero conserva localmente cambios y borradores.
- P0-5 se considera completada por la implementación, sus pruebas y la validación remota; roadmap y estado del proyecto ya están alineados.
- Supabase normalizado debe ser la fuente autoritativa; `finance_dashboard_states` queda solo para migración o fallback controlado.
- Las operaciones destructivas requieren confirmación, auditoría y recuperación mediante versiones; restaurar crea una versión nueva y no borra el historial.
- La retención nunca borra automáticamente: solo identifica candidatas para revisión manual y protege las revisiones operativas.
- Los datos heredados solo se migran mediante una acción explícita; un error del esquema normalizado no autoriza escritura remota compatible.
- El plan visual de deuda se mantiene aislado del motor canónico hasta revisar su integración de datos al terminar la hoja de ruta, pero se conserva dentro del estado versionado compartido.
- Las decisiones financieras protegen reserva y pagos hasta el siguiente ingreso; la deuda suspendida no libera ahorro ficticio y los horizontes mayores de 24 meses se expresan como rangos.
- El forecast E12a es una capa de lectura sobre el motor mensual: no recalcula cifras, no aplica supuestos
  por sí solo y exige paridad antes de entregar una serie a las vistas.
- Simular continúa siendo efímero y de solo lectura. E13b permite guardar una copia reproducible y
  recalcularla sin sobrescribir el original; promoverla al plan sigue fuera de alcance y exige A8-8.
- E14a aplica una frontera equivalente: el adaptador clona sus entradas, solo envía lecturas al `iframe`
  y excluye del guardado los campos canónicos. Tareas, notas y supuestos continúan versionados; aplicar
  ofertas o estrategias al plan requiere E14b y confirmación recuperable.

## Errores conocidos y riesgos

- No hay fallos automatizados conocidos en E12a; su publicación, disponibilidad y arranque responsive
  están verificados.
- No hay fallos automatizados conocidos en E13a: 252/252 pruebas y la puerta completa pasan.
- No hay fallos conocidos en E13a. La actualización defectuosa de e13a1 quedó corregida y aceptada
  públicamente mediante e13a2.
- No hay fallos automatizados conocidos en E14a. El navegador de inspección registró un error de
  `MutationObserver` generado por el entorno de control; el repositorio no contiene ese API y pruebas,
  construcción y smoke test no reproducen un fallo de aplicación.
- No hay fallos conocidos en E12b/E13b. Durante el QA se detectó que el primer escenario guardado podía
  desaparecer tras recargar; se añadió una copia local dedicada y la repetición confirmó su recuperación.
- No hay fallos automatizados conocidos en el cierre E11b: 242/242 pruebas y la puerta completa pasan.
- No hay fallos automatizados conocidos en E5; el esquema y las operaciones remotas están verificados.
- No hay fallos automatizados conocidos en E6; la suite asciende a 148/148 pruebas y la persistencia y
  recuperación autenticadas están verificadas.
- La validación de cierre confirmó GitHub Pages en estado `built`, el workflow de `e51fe07` completado
  con éxito y `version.json` sirviendo esa revisión pública.
- La validación de cierre E7 confirmó el workflow de `ba56333`, la revisión pública exacta, el contrato
  E7, el shell e7b y el monitor manual de disponibilidad sin fallos.
- La validación publicada E9 confirmó el workflow `30712474715`, Pages `built`, el SHA exacto en
  `version.json`, los recursos E9 y el panel gris responsive. La actualización desde una caché E8 exige
  una recarga para que el service worker e9c tome el control.
- La concurrencia entre sesiones queda protegida mediante comparación del puntero `finance_source_heads`; una sesión obsoleta conserva su copia local y exige recarga en vez de sobrescribir la revisión vigente.
- La conciliación, el cierre, la reapertura, el deshacer por lote y la verificación de copias están
  desplegados y aceptados en el Supabase real. Durante la aceptación se corrigieron referencias SQL
  ambiguas en las funciones de reapertura y deshacer.
- E1 fue comprobada en navegador real contra un servicio remoto local controlado: durante la caída el
  servidor recibió cero escrituras; tras cerrar y reabrir recibió exactamente una; una tercera apertura
  confirmó la bandeja vacía. No hubo errores de consola.
- La validación visual del indicador global pasó en escritorio y a 390 px sin desbordamiento horizontal.
- Tras la publicación, una pestaña mostró el aviso de formato remoto antiguo. El aviso es protector:
  no carga ni sobrescribe automáticamente; primero debe recargarse el shell y, si persiste, ejecutar
  la migración explícita conservando una copia local antes de elegir entre revisiones.
- Durante el QA previo, el navegador local recuperó una sesión Supabase ya autenticada y sincronizó la
  copia local normal; no se introdujeron datos de prueba en el proyecto remoto.
- Todos los KPI ejecutivos exponen procedencia y confianza; los que carecen de respaldo suficiente quedan
  marcados con confianza baja. Los efectos legales y fiscales de E7 requieren fuentes verificadas y revisión profesional.
- La capa legal/fiscal E7 es informativa: no calcula automáticamente una obligación tributaria ni sustituye
  asesoramiento. Las referencias BOE quedaron consultadas el 01/08/2026 y deben revisarse si cambia la norma.
- La documentación de backlog y la hoja de ruta discrepan en varios estados y fechas de corte, por lo que `ROADMAP_EXECUTION.md` se toma como criterio conservador de finalización.
- A3-5 está verificada en el Supabase real. El objeto sintético se descargó y descifró desde una segunda
  sesión, se restauró después de moverlo a recuperación y terminó borrado; la cuenta temporal también
  quedó eliminada sin afectar al usuario real.
- El workflow de cierre de E8 terminó correctamente. El aviso posterior por acciones basadas en Node.js 20
  quedó resuelto mediante las versiones mayores que usan Node.js 24; el workflow remoto `30731502159`
  verificó y desplegó Pages sin repetir la anotación.
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

- La revisión estable actual es `bdf6367` (`feat: complete E12b and E13b forecasting`) en `main` y
  `origin/main`. Contiene E12b/E13b, sus pruebas y documentación. Solo este cierre documental queda
  sin commit; `.agents/` continúa sin seguimiento y queda excluida.
- La revisión estable actual es `590e9aa` (`ci: migrate Pages actions to Node 24`) en `main` y
  `origin/main`. El workflow `30731502159` verificó y desplegó Pages correctamente. Solo este cierre
  documental queda sin commit; `.agents/` continúa sin seguimiento y queda excluida.
- La revisión estable actual es `97c4ae7` (`docs: close validated E14a session`) en `main` y
  `origin/main`. Quedan sin commit únicamente la actualización de acciones de Pages y este cierre
  documental; `.agents/` continúa sin seguimiento y queda excluida.
- El último commit funcional estable es `a0a65c7` (`feat: integrate canonical debt roadmap`) en `main` y
  `origin/main`. Contiene E14a, su inventario, adaptador de solo lectura, contrato de estrategia, pruebas y
  shell offline versionado. Antes del commit documental solo quedan estos cambios de cierre; `.agents/`
  continúa sin seguimiento y queda excluida.
- La revisión estable actual es `26b26fb` (`fix: refresh offline shell assets on upgrade`) en `main` y
  `origin/main`, publicada y verificada en GitHub Pages. Incluye el cierre técnico de E13a sobre
  `e5ad5ef` (`feat: implement E13a scenario lab`).
- Solo quedan sin commit estas actualizaciones documentales de aceptación. `.agents/` continúa sin
  seguimiento y debe excluirse.
- El último commit estable del repositorio es `1cb3a5a` (`docs: record E11b publication`) en `main` y
  `origin/main`. No quedan cambios locales del producto pendientes de commit.
- El último commit funcional estable es `989f20d` (`feat: implement E11b guided import workflow`) en
  `main` y `origin/main`. La puerta completa local y el QA responsive pasan.
- El cierre documental E11b es `ea18151` (`docs: close validated E11b session`) en `main` y
  `origin/main`. `.agents/` continúa sin seguimiento, pertenece a las instrucciones locales de trabajo
  y queda excluida de los commits.
- El último commit estable de E11a es `992a678` (`feat: implement E11a guided data updates`) en
  `main` y `origin/main`.
- El último commit estable es `ef57e9b` (`feat: prepare E9 external integrations safely`) en `main` y
  `origin/main`. El workflow `30712474715` verificó y desplegó correctamente GitHub Pages.
- `939acc6` — `feat: implement E8 operational improvements` (1 de agosto de 2026), publicado en
  `origin/main`; contiene la implementación funcional de A3-1 a A3-7.

- `e51fe07` — cierre funcional y documental de E6 (1 de agosto de 2026), publicado y desplegado en Pages;
  incluye la interfaz de cobertura/calidad, persistencia, recuperación autenticada y 148 pruebas.

- `4431939` — `feat: verify and close E5 remote recovery` (1 de agosto de 2026), publicado en
  `origin/main`; incluye la aceptación remota, las correcciones SQL, el diálogo accesible y el cierre documental.
- `29bfd93` — `docs: close E5 implementation session` (1 de agosto de 2026), publicado en `origin/main` y base de la aceptación remota actual.
- `6b452d5` — `feat: implement E5 operational recovery controls` (1 de agosto de 2026), publicado en `origin/main`; la puerta local de cierre pasa con 135 pruebas, construcción, privacidad y smoke test.
- `c4eeb01` — `docs: close dashboard workflow session` (1 de agosto de 2026), base estable anterior.

- `cceb3c2` — `docs: record dashboard value workflow` (1 de agosto de 2026), publicado en `origin/main`.
- `c44563a` — `feat: clarify planned actual and calculated dashboard values` (1 de agosto de 2026), validado localmente antes de publicar.
- `43e1124` — `fix: clarify dashboard save behavior` (1 de agosto de 2026), validado localmente antes de publicar.
- `2c793d4` — `docs: close validated E4 delivery` (31 de julio de 2026), publicado en `origin/main`; la revisión funcional `d32b02a` fue verificada tras recarga autenticada.
- La puerta local pasa con 136 pruebas, construcción de `dist/`, revisión de privacidad y smoke test; `git diff --check` también pasa.
- Antes de este cierre documental, `main` y `origin/main` están sincronizadas en `ef57e9b`. Solo este
  cierre de publicación modifica `PROJECT_STATE.md` y `BACKLOG_STATUS.md`; `.agents/` continúa sin
  seguimiento y queda excluida del commit propuesto.
