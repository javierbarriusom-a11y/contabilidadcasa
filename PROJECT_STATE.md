# Estado del proyecto

Fecha de revisión: 18 de agosto de 2026.

## Cierre de sesión — 18 de agosto de 2026: cierre de la pantalla Análisis (A-4/A-5/A-8/A-9/A-11)

Continuación directa del incremento de Análisis del 16 de agosto (A-1/A-2/A-6, ya fusionado). Se
construyen las cinco tareas restantes no bloqueadas de la pantalla 07: cascada del resultado (A-4),
patrimonio neto proyectado (A-5), reparto del ingreso (A-8), patrones recurrentes (A-9) y exportación
CSV/PDF (A-11). Ningún cálculo financiero nuevo — cada lectura reutiliza piezas canónicas ya
construidas (`#cashflow`, `#forecast`, `#movimientos`) y enlaza a la pantalla de origen, manteniendo
la arquitectura de solo lectura con procedencia de A-1.

- **A-4**: `analisisResultGrid()` agrupa la ventana por año y suma ingresos/gasto/ahorro con tasa de
  ahorro. **A-5**: `renderAnalisisNetWorthChart()` dibuja un SVG de tres series (liquidez, reserva,
  colchón). **A-8**: `analisisIncomeGrid()` suma y porcentúa los componentes del ingreso. **A-9**:
  `analisisPatternsList()` lista patrones recurrentes marcando los estables. **A-11**:
  `analisisCsvContent()` + `handleAnalisisExport()` (CSV vía Blob, PDF vía `window.print()`).

**Validación**: `npm test`, exit 0, **1131/1131 pruebas** (8 nuevas en
`tests/a4-a5-a8-a9-a11-analisis.test.cjs`). Verificado con Playwright contra el build local: la
cascada y el reparto suman sobre los meses simulados; el SVG se dibuja con las tres series; los
patrones estables se marcan; el selector de ventana recorta banda y gráfico; el CSV se descarga con
cabecera y una fila por mes. Sin errores de consola propios.

**Backlog actualizado**: `docs/BACKLOG_NUEVE_PANTALLAS.md` — A-4/A-5/A-8/A-9/A-11 pasan a `Hecho`.
De la pantalla 07 (Análisis, 13 tareas) solo quedan A-3 (E-2), A-7 (Cierre), A-10 (Cierre), A-12
(Fase 7) y A-13 (A-9/A-10/M-8). Siguiente: Cierre (C-3b, C-6, C-7, C-13, C-14) y Deuda, o bien
retomar Escenarios (E-11b, E-13, E-14) — por acordar con el usuario.

## Cierre de sesión — 17 de agosto de 2026: historial de versiones y evidencia en Cierre (C-10/C-11/C-12)

Segunda fase de la lista acordada con el usuario («cerremos primero» Escenarios, Cierre y Análisis),
continuación directa de la entrada anterior (Escenarios, ya fusionada). Ningún cálculo financiero
nuevo: las tres tareas leen `monthClosures`, que C-9 ya dejaba con IDs estables.

- **C-10 (historial de versiones)**: `cierreVersionRows()` lee todas las entradas de
  `monthClosures` (no solo el mes en curso), ordenadas de más reciente a más antigua, marcando
  «Vigente» la más reciente de cada mes — reabrir no borra el cierre anterior, lo deja «no vigente»
  en la lista. El campo «autor» que faltaba se resuelve con la decisión ya tomada el 14 de agosto:
  `closeCurrentMonthTransaction()`/`reopenLatestMonthTransaction()` pasan `remoteUser?.email` como
  `metadata.author` a `FinanceCanonicalMonthClose.closeMonth`/`FinanceCanonicalE5.reopenMonth`.
- **C-11 (reapertura notificada, parcial)**: el motivo obligatorio y la versión nueva ya existían.
  De los tres dependientes que nombra el criterio (Análisis, cobertura aprendida de Hoy, fiabilidad
  del plan) solo Análisis tiene una relación mes→dato verificable hoy — la banda de A-2 es una serie
  por mes. `cierreMonthsCurrentlyReopened()` calcula qué meses siguen reabiertos (última operación
  = reapertura, sin volver a cerrarse); `renderAnalisis()` cruza esos meses con la ventana visible y
  muestra un aviso. Hoy y A-7 quedan fuera del aviso cruzado — forzarlos habría significado inventar
  una relación que no se puede verificar (regla transversal 04), documentado explícitamente en vez
  de en silencio.
- **C-12 (evidencia en PDF y CSV)**: CSV con el patrón ya existente (`downloadCsv`, Blob + URL de
  objeto) — una fila por cuenta más las columnas de versión repetidas en cada fila. El PDF usa
  `window.print()` sobre un contenedor dedicado fuera de `.app-shell` (para que `@media print` pueda
  esconder el resto) en vez de añadir una librería nueva a una app sin backend — el «guardar como
  PDF» real del navegador. Ninguno de los dos incluye sobres (Fase 6 desactivada, lo dicen
  explícitamente); «tareas resueltas» se representa como el recuento de diferencias abiertas en el
  momento de la descarga, no como un registro histórico que no existe.
- **C-3b**: revisado de nuevo y sigue pendiente — el bloqueo técnico (las `entries` del ledger no
  llevan de vuelta a la fila cruda de `state.transactions`) no ha cambiado.

**Validación**: `npm test`, exit 0, **1123/1123 pruebas** (15 nuevas en
`tests/c10-c11-c12-cierre-historial.test.cjs`). Verificado con Playwright contra el build local: el
historial muestra fecha/mes/autor/resumen/estado con la fila vigente distinguida; reabrir julio 2026
hace aparecer en Análisis el aviso de reapertura; el botón CSV descarga sin error y el contenedor de
impresión se rellena correctamente antes de `window.print()`. Sin errores de consola propios.

**Backlog actualizado**: `docs/BACKLOG_NUEVE_PANTALLAS.md` — C-10/C-11/C-12 pasan a `Hecho` (C-11
parcial, documentado). De Cierre (15 tareas) solo quedan C-3b (pendiente, sin bloqueo), C-6/C-7
(Sobres), C-13 (A-7) y C-14 (Fase 7). Siguiente: Análisis (A-4/A-5/A-8/A-9/A-11, pantalla 07), mismo
orden acordado con el usuario.

## Cierre de sesión — 17 de agosto de 2026: cierre de los huecos no bloqueados de Escenarios

A petición explícita del usuario («cerremos primero» la lista de huecos ya identificados en la
auditoría del 16 de agosto), segunda fase de construcción sobre Escenarios: E-1, E-2 y E-8 pasan de
«parcial» a `Hecho`, y se construyen desde cero E-1b, E-6b, E-7, E-9 y E-12 — las cinco tareas no
bloqueadas que quedaban pendientes de la pantalla 06. Ningún cálculo financiero nuevo salvo los tres
tipos de decisión de E-1/E-1b, que siguen el mismo patrón ya existente (`NON_DEBT_APPLIERS`) que
compra/imprevisto/proyecto/cambio de ingreso/cambio de gasto.

- **E-1**: el mockup real (rasterizado a 400dpi para leer la lista exacta) confirma seis tipos de
  Deuda. `refinanciacion`→«Cambiar condiciones» y `reunificacion`→«Reunificar deuda» se renombran
  (mismo `id`, Deuda › Comparar no se entera). `deuda_nueva` («Pedir deuda nueva») y
  `prestamo_familiar` («Prestar o cobrar a familia») son nuevos: un efecto de caja de la simulación
  (principal/importe de golpe más cuota/devolución recurrente), sin crear contrato real en
  `DEBT_PORTFOLIO` — no cuentan para «Fecha libre de deuda», documentado en el propio esquema.
- **E-1b**: constructor de tipos propios (nombre, familia informativa, hasta tres campos: importe,
  mensualidad, plazo — el mes siempre se incluye). Todos comparten el tipo real `propio` en el motor
  y el esquema (`params.definicionId` distingue cuál definición es cada decisión); se validan contra
  el mismo `PARAMS_VALIDATORS.propio`, no una segunda vía.
- **E-2**: el único recálculo completo mientras se teclea (no al salir del campo) era el saldo
  mínimo — 120 ms de debounce sobre ese punto.
- **E-6b**: un escenario rechazado se guarda con estado `"aviso"` (nuevo), motivo reutilizado de
  `escenarioMotorRejectionInfo`, etiqueta fija «límite conocido». No se puede aplicar directamente y
  queda fuera de los selectores de E-12.
- **E-7**: veredicto en prosa reutilizando las cuatro comprobaciones de E-5 — nombra la decisión que
  rompe la reserva (o la capacidad, o las condiciones) como «la palanca», con dirección genérica
  (importe/mes), no una cifra recalculada.
- **E-8**: «Doce meses, cuenta por cuenta» — banda apilada CaixaBank/Mediolanum con la misma serie de
  dos cuentas que ya calcula el motor. Sin un «mínimo operativo» configurado en la app, el mes se
  tiñe cuando CaixaBank queda literalmente en negativo, en vez de inventar un umbral.
- **E-9**: conmutador «Vista familiar»/«Vista técnica» — sustituye la comparativa de seis indicadores
  y la validación por una tarjeta con cuatro cifras en lenguaje llano, mismos datos de E-3.
- **E-12**: pantalla nueva `#escenario-comparar` — dos selectores y la tabla de seis indicadores con
  una columna más (plan / A / B), sin color de dirección. Los avisos de E-6b quedan fuera.

**Validación**: `npm test`, exit 0, **1108/1108 pruebas** (19 nuevas en
`tests/e1-e1b-escenarios-tipos-nuevos.test.cjs`: los tres tipos de decisión contra el motor real de
`canonical-scenario-engine.js`, más las funciones puras de presentación). Verificado con Playwright
contra el build local: tipos renombrados y nuevos en el selector, «Pedir deuda nueva» resuelve
«Aplicada», crear un tipo propio deja su propio formulario listo para usar, la vista familiar oculta
la comparativa técnica, forzar un guardarraíl roto muestra el veredicto con la palanca y permite
guardar como aviso (tarjeta roja con «límite conocido»), comparar dos escenarios pinta las tres
columnas. Sin errores de consola propios.

**Backlog actualizado**: `docs/BACKLOG_NUEVE_PANTALLAS.md` — E-1/E-1b/E-2/E-6b/E-7/E-8/E-9/E-12 pasan
a `Hecho` con nota de cierre. De Escenarios (17 tareas) solo quedan E-11b (bloqueada por Cierre),
E-13 (bloqueada por D-10, parcial) y E-14 (bloqueada por Fase 7). Siguiente: Cierre (C-3b/C-10/C-11/
C-12) y Análisis (A-4/A-5/A-8/A-9/A-11), mismo orden acordado con el usuario.

## Cierre de sesión — 16 de agosto de 2026: primer incremento real de Análisis (Fase 6)

Punto 3 del plan de construcción (Cierre, punto 2, ya fusionado — ver la entrada siguiente). Fase 6
(Análisis) estaba a cero código propio; este incremento construye A-1 (pantalla de solo lectura,
accesible desde «Herramientas avanzadas › Analizar › Análisis (nuevo)», no pestaña principal), A-2
(banda de doce meses de colchón) y A-6 (selector de ventana 12/24/todo el plan).

A-2 pide el colchón **en meses**, no la liquidez absoluta que ya colorea `#mapa-calor`/la fila de
colchón de P-9 — esa serie mensual no existía todavía. Se calculó reutilizando piezas ya
construidas: `escenarioMotorAverageCoreSpend` (gasto medio, mismo cálculo que el resumen de
Escenarios) para el denominador, `state.emergencyBufferMonths` (el mismo «colchón objetivo» que ya
usan la barra lateral y Deuda) como umbral, y `FinanceCanonicalCushion.cushionLevel` para el
color — la función de tres niveles que el propio comentario de P-9 ya señalaba como «compartida con
A-2 cuando se construya», escrito en una sesión anterior sin que nadie lo hubiera conectado todavía.
Un mes sin fila de simulación o sin gasto medio con el que dividir queda «sin dato», nunca en cero.

**Validación**: `npm test`, exit 0, **1089/1089 pruebas** (7 nuevas en
`tests/a1-a2-a6-analisis-colchon.test.cjs`, más 1 prueba de navegación ajustada porque contaba los
enlaces exactos del menú avanzado). Verificado con Playwright contra el build local: la banda
muestra 12 y 24 meses reales, cambia de color al cruzar el objetivo de `emergencyBufferMonths`
(marrón «a vigilar» → verde «sobre objetivo», visible en el cambio de ventana), el peor mes se marca
con su cifra exacta. Sin errores de consola propios.

**Backlog actualizado**: `docs/BACKLOG_NUEVE_PANTALLAS.md` — A-1/A-2/A-6 pasan a `Hecho` con nota de
cierre. A-4 y A-5 están marcadas «CONSERVADO» en el inventario del propio mockup (ya existen en
`#cashflow`/`#forecast`) pero extraerlas con su procedencia no se ha hecho todavía; A-7/A-10 dependen
de piezas de Cierre que este incremento no cubre (historial de versiones dedicado); A-3 depende de
E-2, todavía parcial; A-8/A-9/A-11/A-12/A-13 sin bloquear pero sin construir.

## Cierre de sesión — 16 de agosto de 2026: primer incremento real de Cierre (Fase 5)

Punto 2 del plan de construcción acordado con el usuario (Escenarios, punto 1, ya cerrado — ver la
entrada siguiente). Fase 5 (Cierre) estaba a cero código propio; este incremento construye el
ritual secuencial real, no toda la lista de 15 tareas del backlog.

Nueva pantalla `#cierre`, ahora destino de la pestaña principal «Cierre» (antes apuntaba a
`#conciliar`, que sigue viva sin cambios en «Herramientas avanzadas › Datos»). Tres pasos
secuenciales — Conciliar cuentas → Resolver diferencias → Firmar y archivar — en vez de los cuatro
del mockup: Sobres (P-14/P-15/P-16) no existe todavía, y el propio mockup contempla explícitamente
este caso («con la fase 6 apagada el cierre tiene tres pasos y lo dice»). Cada paso permanece
bloqueado hasta que el anterior está completo; un paso ya completado se puede reabrir para
consultarlo.

No se fabricó ningún cálculo financiero nuevo: reutiliza `FinanceCanonicalLedger` (extracto
bancario), `E11bInbox.reconciliationTasks` (tareas por causa) y `closeCurrentMonthTransaction()` /
`reopenLatestMonthTransaction()` — la misma puerta transaccional con Supabase que ya usaba
`#reconciliation`, con `FinanceCanonicalMonthClose`/E5 de versionado detrás. La conciliación por
cuenta (declarado vs. calculado) compara `accountBalancesFromState()` (lo escrito en Registrar) con
el `balanceAfter` más reciente del extracto ya incorporado; una cuenta sin extracto (Mediolanum no
trae extracto bancario en este modelo) se marca «Sin conciliar», nunca «Cuadra» — comparar con cero
habría sido inventar un dato y habría bloqueado el cierre para siempre.

Decisión de alcance documentada: el modal de resolución de dos rutas (C-3b) se dejó pendiente
porque la ruta «resolver aquí mismo» cruzaría dos modelos de datos que hoy no se pueden enlazar de
forma fiable (las `entries` del ledger no llevan de vuelta a la fila cruda de `state.transactions`
que necesita la reclasificación de Movimientos) — forzar el cruce a ciegas era más riesgo que valor.
C-10/C-11 (historial de versiones dedicado, aviso cruzado a Análisis) y C-12 (exportar PDF/CSV)
también quedan pendientes. C-6/C-7 (sobres) y C-14 (retirar heredadas) siguen bloqueadas como estaba
previsto.

**Validación**: `npm test`, exit 0, **1082/1082 pruebas** (13 nuevas en
`tests/c1-c9-cierre-wizard.test.cjs`, más 2 pruebas existentes de E17/T-1 actualizadas porque fijaban
`#conciliar` como destino literal de la pestaña «Cierre»). Verificado con Playwright contra el build
local: los tres pasos se recorren en orden con el candado correcto, el paso 3 muestra el botón
deshabilitado con «Firmar · 1 sin cumplir» cuando falta el extracto del mes y sin sesión de
Supabase, `#conciliar` sigue funcionando sin cambios. Sin errores de consola propios.

**Backlog actualizado**: `docs/BACKLOG_NUEVE_PANTALLAS.md` — C-1/C-2/C-3/C-4/C-5/C-8/C-9 pasan a
`Hecho` con nota de cierre. Queda pendiente el punto 3 del plan (Análisis, Fase 6), que depende de
Cierre para varias de sus tareas (A-4, A-7, A-10, A-13).

## Cierre de sesión — 16 de agosto de 2026: E-5, panel de cuatro comprobaciones en Escenarios

Continuación directa del punto 1 del plan de Escenarios (misma sesión, PR #63/E-11 ya fusionado).
El motor ya validaba cada decisión contra el contrato real (`Schema.validateDecision`), pero solo
por decisión — el mockup pide un panel agregado de la simulación entera con cuatro comprobaciones
propias: origen de fondos, reserva protegida, umbral de capacidad, condiciones registradas, cada
una con su estado.

Nueva `escenarioMotorValidationChecks(result, scenarioSummary, guardrailValue)` no inventa ninguna
comprobación paralela: reutiliza señales que la pantalla ya calcula. *Origen de los fondos* lee
`state.balanceMode` (el mismo indicador que Registrar usa para «saldo real» vs. «saldo calculado»).
*Reserva protegida* mira si alguna decisión se rechazó por `guardarril-incumplido`, el único
guardarraíl que el motor resuelve hoy. *Umbral de capacidad* reutiliza el `capacidadLibre` que E-3
ya muestra como «Capacidad libre real». *Condiciones registradas* agrupa cualquier otro rechazo del
motor (`sin-mes-viable`, `sin-objetivo`, etc.), deliberadamente separado del guardarraíl para que
cada comprobación falle por su propia razón — verificado con Playwright forzando un guardarraíl
imposible: «Reserva protegida» se pone en rojo sin arrastrar a «Condiciones registradas», que sigue
en verde porque el rechazo fue por el guardarraíl, no por una condición del contrato. Cuando no hay
nada que comprobar (sin guardarraíl, sin decisiones todavía) el estado es «sin dato», nunca «cumple»
— regla transversal 04. Reutiliza el componente `.deuda-ruta-check` que ya usa Deuda (D-6/D-9), con
dos estados propios que allí no hacían falta (`is-warn`, `is-neutral`).

**Validación**: `npm test`, exit 0, **1069/1069 pruebas** (14 nuevas en
`tests/e5-escenario-validacion.test.cjs`). Verificado con Playwright contra el build local: el panel
aparece en `#escenario-simular` (oculto sin decisiones) y `#escenario-aplicar`; añadir una decisión
que agota la capacidad libre marca esa fila en rojo con la cifra real; sin errores de consola
propios.

**Backlog actualizado**: `docs/BACKLOG_NUEVE_PANTALLAS.md` — E-5 pasa a `Hecho` con nota de cierre.
Del punto 1 del plan quedan: E-1 (catálogo de deuda, toca el motor canónico, más riesgo), E-2
(necesita diseñar una vista previa en vivo, no solo un debounce), E-8 (banda por cuenta), y construir
desde cero E-1b/E-6b/E-7/E-9/E-12.

## Cierre de sesión — 16 de agosto de 2026: E-11, revisión opcional al aplicar un escenario

Continuación directa del punto 1 del plan de Escenarios (misma sesión, PR #62/E-3 ya fusionado).
Faltaba el campo de revisión opcional al aplicar un escenario («misma barra que Deuda: motivo
obligatorio, revisión opcional que genera recordatorio en Hoy»). Añadido `<input type="date">`
opcional en `#escenarioAplicarForm`; si se rellena, `handleEscenarioAplicarConfirm` lo guarda como
`reviewDate` en el escenario aplicado, y `homeEscenarioReviewReminders()` (nueva, mismo patrón que
`homeDebtReviewReminders()` de D-8) lo asoma en «Tres decisiones» de Hoy, en rojo si ya venció.

**Validación**: `npm test`, exit 0, **1056/1056 pruebas** (9 nuevas en
`tests/e11-escenario-revision.test.cjs`, más 4 pruebas existentes de D-8/H-5/H-10 ajustadas porque
sandboxaban `homeDecisionCandidates` sin conocer la función nueva). Verificado con Playwright: al
aplicar un escenario con fecha de revisión pasada, aparece en Hoy como «Revisar escenario
aplicado... Vence 01 ago 26», primero en la lista por ser el más urgente. Sin errores de consola.

**Backlog actualizado**: `docs/BACKLOG_NUEVE_PANTALLAS.md` — E-11 pasa a `Hecho`. Del punto 1 del
plan quedan: E-1 (catálogo de deuda, toca el motor canónico), E-5 (panel de 4 comprobaciones), E-8
(banda por cuenta), y construir desde cero E-1b/E-6b/E-7/E-9/E-12. E-2 necesita más diseño del
previsto (no es solo añadir debounce, ver nota de sesión anterior).

## Cierre de sesión — 16 de agosto de 2026: E-3, comparativa de seis indicadores en Escenarios

Continuación directa de la auditoría de Escenarios (misma sesión, PR #61 ya fusionado). Primer
"parcial" cerrado del punto 1 del plan acordado con el usuario. La comparativa de
`#escenario-simular` solo daba 3 de los 6 indicadores del criterio real (liquidez final, caja
mínima, libre de deuda) en tarjetas sueltas sin columna de plan. Sustituida por una tabla
Indicador/Plan/Simulado/Diferencia (`escenarioMotorKpiCardsHtml`, compartida con
`#escenario-aplicar`) con los seis: reserva protegida, meses de colchón (nuevo: liquidez final ÷
gasto corriente medio de 12 meses), fecha libre de deuda, ahorro anual (nuevo: suma de `saving` de
12 meses), peor mes (nuevo: mes + valor vía `FinanceCanonicalCushion.worstMonthOf`) y capacidad
libre real (reutiliza `monthlyFreeCapacity`, la misma de Hoy). Diferencia coloreada por dirección de
mejora, no por signo bruto.

Dos bugs de layout reales, atrapados en verificación visual con Playwright y no en las pruebas
unitarias: (1) una regla genérica `th, td { white-space: nowrap }` de `styles.css` hacía que las
celdas más largas se solaparan con la columna vecina — corregido con `white-space: normal`
explícito; (2) una regla también genérica `table { min-width: 1120px }` forzaba scroll horizontal
pese a `table-layout: fixed` — corregido con `min-width: 0`, el mismo parche que ya usaba la tabla
de «Aplicar». Ninguno de los dos habría aparecido sin abrir la app de verdad.

**Validación**: `npm test`, exit 0, **1047/1047 pruebas** (15 nuevas en
`tests/e3-escenario-comparativa.test.cjs`). Verificación visual con Playwright contra el build
local (el sitio publicado en GitHub Pages no es accesible desde este entorno — egress bloqueado a
`github.io` — así que la comprobación fue contra `dist/` servido en local, código idéntico al que
se despliega): las 6 filas caben sin scroll ni solapes en `#escenario-simular` y
`#escenario-aplicar`, con datos de demostración reales, sin errores de consola propios.

**Backlog actualizado**: `docs/BACKLOG_NUEVE_PANTALLAS.md` — E-3 pasa a `Hecho` con nota de cierre.
Quedan del punto 1 del plan: E-1 (catálogo de deuda — este sí toca el motor canónico, más riesgo),
E-2 (debounce), E-5 (panel de 4 comprobaciones), E-8 (banda por cuenta), E-11 (revisión opcional),
y construir desde cero E-1b/E-6b/E-7/E-9/E-12.

## Cierre de sesión — 16 de agosto de 2026: auditoría de Fase 4-7 contra los PDF fuente (Escenarios, Análisis, Cierre, Laboratorio)

Continuación de la sesión de Prioridad 4 (M-2/M-6 ya fusionada). El usuario aportó los PDF fuente de
las cuatro pantallas que faltaban por auditar (`Escenarios.pdf`, `Analisis.pdf`, `Cierre.pdf`,
`Laboratorio.pdf`, más `Backlog_Global.pdf` de referencia) — no estaban en el repositorio y hasta
ahora solo existía la línea de una frase por tarea en `docs/BACKLOG_NUEVE_PANTALLAS.md`. Se
extrajeron con `pdftoppm` a alta resolución (el texto plano de estos PDF viene vacío: son capturas
de pantalla del prototipo, no texto seleccionable) y se leyeron sus tablas «Backlog de X» completas,
con el criterio de aceptación real de cada tarea.

**Hallazgo antes de auditar**: `#escenario-simular` no está vacío. Lleva desde la epic E20 (10 de
agosto) un motor real (`canonical-scenario-engine.js`/`canonical-scenario-schema.js`,
`ESCENARIO_MOTOR_TYPES` con once tipos de decisión, formulario dinámico, gráfico plan-vs-simulación,
guardado y aplicación) construido antes de que existiera este backlog y nunca reconciliado con él —
el mismo patrón que la mockup 2c heredada encontrada para P-8 el 15 de agosto. Auditado contra
`Escenarios.pdf`: E-4/E-6/E-10 hechas sin matices; E-1/E-2/E-3/E-5/E-8/E-11 parciales (el catálogo de
Deuda diverge en dos tipos, sin debounce de 120 ms, 3 de 6 indicadores, sin panel de cuatro
comprobaciones, banda agregada en vez de por cuenta, sin revisión opcional al aplicar);
E-1b/E-6b/E-7/E-9/E-12 pendientes de construir, sin bloqueo; E-11b/E-13/E-14 bloqueadas como ya
preveía el backlog. Detalle completo en la nota bajo la tabla de la pantalla 06.

Análisis, Cierre y Laboratorio se confirmaron **sin ningún código propio** — arrancan de cero, tal
como ya decía el backlog; auditar sus PDF solo sirvió para fijar el criterio real de cada tarea antes
de construir, no cambió ningún estado.

**Sin cambios de código en esta sesión**: solo se corrigió el estado en
`docs/BACKLOG_NUEVE_PANTALLAS.md` (tabla de la pantalla 06 y el resumen de fases). `npm test`,
1032/1032 pruebas, sin tocar `app.js` — se ejecutó para confirmar que la auditoría documental no
afecta al comportamiento antes de publicar.

**Próximo paso disponible, sin bloqueo**: cerrar los seis «parcial» de Escenarios (E-1, E-2, E-3,
E-5, E-8, E-11) y construir E-1b/E-6b/E-7/E-9/E-12 desde cero. Cierre (Fase 5) es la pieza que más
desbloquea después (M-8c, D-2b, P-8b, E-11b, y toda Análisis depende de ella) — candidata a
siguiente sesión de construcción.

## Cierre de sesión — 16 de agosto de 2026: Prioridad 4 de la auditoría (tercera tanda) — M-2/M-6

Continuación directa de la tanda R-3 (misma sesión, PR #59 ya fusionado). M-2/M-6 (cuenta por
movimiento) tenía la misma clase de decisión de alcance que R-3: no existe ningún atributo de cuenta
por movimiento en el modelo de datos, y no hay forma honesta de reconstruirlo para el extracto
histórico ya cargado — el propio importador ya declaraba en un comentario que «cuenta» ahí es
descriptiva del fichero, no una cuenta bancaria real. Consultado con el usuario junto con R-3, se
confirmó la lectura de menor riesgo: etiquetar solo hacia delante.

**M-2/M-6**: el paso 1 del asistente de Importar extracto (R-8, tanto en `#registrar` como en la
heredada `#datos-importar`) gana un selector «¿De qué cuenta es este extracto?»
(`DATOS_IMPORTAR_ACCOUNTS`: CaixaBank/Mediolanum/Efectivo, más «Sin especificar» por defecto).
`datosImportarIncludedTransactions(rows, bankAccount)` estampa esa cuenta en los movimientos de esa
tanda al incorporarlos — el resto del extracto histórico no se toca. La tabla de Movimientos gana la
columna «Cuenta» junto a «Origen» (M-2), y el panel de detalle su campo «Cuenta» (M-6); ambos
muestran «—» cuando el movimiento no la tiene, en vez de fabricar un valor. El CSV exportado (M-10)
también la incluye.

**Validación**: `npm run verify`, exit 0, **1032/1032 pruebas**, 700 IDs de accesibilidad,
rendimiento/build/privacidad/smoke en verde. Verificación visual con Playwright de punta a punta:
subir un extracto CSV real en Registrar › Importar, elegir «Mediolanum» en el paso 1, clasificar
(ignorar, sin necesidad de partida real para esta comprobación) y confirmar con motivo — la fila
nueva en Movimientos y su panel de detalle muestran «Mediolanum» correctamente. Sin errores de
consola.

**Backlog actualizado**: `docs/BACKLOG_NUEVE_PANTALLAS.md` — M-2 y M-6 pasan a `Hecho` (sin
«parcial») en la tabla y ganan nota de cierre conjunta. **Con esto, la Prioridad 4 queda cerrada en
la práctica**: de sus 6 tareas, 5 están hechas (R-2, P-4, P-1, R-3, M-2/M-6) y solo M-8 sigue
pendiente, bloqueada por depender de la pieza compartida «Historial de versiones» que tampoco tienen
R-6 ni Cierre (Fase 5, sin empezar) — no hay más trabajo posible ahí sin construir esa pieza primero.
No queda ninguna prioridad más definida en la auditoría del 15 de agosto; el trabajo que sigue es
Fase 4 en adelante (Previsión/Escenarios completos, Cierre, Análisis, Laboratorio), sin empezar.

## Cierre de sesión — 16 de agosto de 2026: Prioridad 4 de la auditoría (segunda tanda) — R-3

Continuación directa de la tanda R-2/P-4/P-1 (misma sesión, PR #58 ya fusionado). R-3 (cuenta
Efectivo editable) tenía una decisión de alcance real que no correspondía tomar en silencio: el
modelo de liquidez de la app solo conoce dos cuentas (`caixa`/`mediolanum`, sumadas en
`accountBalancesFromState().total` y usadas en más de cuarenta puntos del motor de proyección).
Añadir Efectivo tal como pide el mockup («cuenta editable, con su aviso de que no tiene extracto que
lo respalde») exigía decidir si participa en ese total (rehacer el motor de proyección) o queda
informativo. Consultado con el usuario, se eligió la lectura de menor riesgo: informativa.

**R-3**: `balanceSettings.efectivoBalance` guarda la cifra — mismo mecanismo persistido y
sincronizado que ya usa `balanceSettings` para fecha/modo/saldos manuales (`efectivoBalanceValue`/
`saveEfectivoBalance`), sin tocar el payload de sincronización remota ni el cargador de estado.
`accountBalancesFromState()` no la toca, así que el total de liquidez proyectada no cambia al
editarla — verificado con una prueba de fuente dedicada, además de con Playwright. Tercera fila en
Registrar › Saldo de cuentas (`registrarEfectivoBalance`), con el aviso «Efectivo no tiene extracto
que lo respalde: se guarda como referencia y no se suma al total de liquidez proyectada».

**Validación**: `npm run verify`, exit 0, **1022/1022 pruebas**, 700 IDs de accesibilidad,
rendimiento/build/privacidad/smoke en verde. Verificación visual con Playwright contra el sitio
construido: editar Efectivo a 250,75 € no mueve el Total liquidez (se queda en 9.270,00 €), el aviso
aparece bajo el campo, y el valor persiste tras recargar la página (localStorage). Sin errores de
consola.

**Backlog actualizado**: `docs/BACKLOG_NUEVE_PANTALLAS.md` — R-3 pasa a `Hecho` (sin «parcial») en la
tabla y gana nota de cierre. De la Prioridad 4 quedan dos tareas: M-2/M-6 (cuenta por movimiento — no
existe el atributo en el modelo de datos, y el propio importador ya decidió explícitamente no fingir
haber identificado una cuenta bancaria real; el usuario ya dio el visto bueno a la lectura propuesta:
etiquetar solo hacia delante, en la importación, dejando «—» en los movimientos históricos sin ese
dato) y M-8 (bloqueada, depende de la pieza compartida «Historial de versiones» que tampoco tienen
R-6/Cierre). Siguiente paso: construir M-2/M-6.

## Cierre de sesión — 16 de agosto de 2026: Prioridad 4 de la auditoría (primera tanda) — R-2, P-4, P-1

Continuación directa del cierre de Prioridad 3 (misma sesión, PR anterior ya fusionado). El usuario
confirmó seguir con la Prioridad 4 (R-2, P-4, P-1, R-3, M-2/M-6, M-8); se cerraron las tres tareas
sin ambigüedad de alcance y se dejan pendientes de una decisión del usuario las tres que sí la tienen
(ver más abajo).

**R-2**: `registrarTabBadges()` devolvía el marcador de «ausente» permanente para las pestañas
Importar y Lote, nunca un recuento vivo. Corregido de forma distinta para cada una, porque su
naturaleza real es distinta: Importar sí tiene un recuento real — los movimientos de la sesión de
importación en curso que piden decisión (`datosImportarCounters`, el mismo que ya usaba
`homeImportSessionCandidate` de H-5) —, así que pasa a decir «N por decidir» o queda vacía sin sesión
abierta; Lote y Excel es una acción de un solo paso sin sesión que dejar a medias, así que se deja
vacía en vez de fabricar un cero (regla transversal 04), el mismo trato que ya recibía «Saldo de
cuentas» cuando no hay nada que avisar.

**P-4**: la celda «Usado» de Plan · Mes no tenía ningún hover de procedencia. `planMesUsadoTitle`
construye el texto a partir de `planMesUsadoMovementCount` (cuenta los movimientos del mes mapeados
a la fila con el mismo diccionario `mappingForMovement` que ya usa la detección de partida anual):
con real y movimientos mapeados, «Real: N movimiento(s) de [mes]»; con real pero sin ningún
movimiento mapeado, avisa de que es un ajuste a mano en vez de fingir un recuento; sin real, dice que
es previsto y que no hay movimientos todavía.

**P-1**: verificado con Playwright que el horizonte de Previsión (12/24/48 meses u horizonte
completo) ya sobrevive al cambio de pestaña — `planPrevisionHorizonKey` es una variable de módulo que
solo cambia `handlePlanPrevisionHorizon`, nunca el armazón de pestañas (`setPlanTab`/
`renderPlanTabs`), así que persiste por diseño. La mitad «se comparte entre las tres pestañas» del
criterio no se extendió a Mes (selector de un único mes, concepto distinto) ni a Ahorro (sigue sin
contenido propio) — no había ningún consumidor real al que compartírselo sin fabricar un control
redundante.

**Validación**: `npm run verify`, exit 0, **1016/1016 pruebas**, 699 IDs de accesibilidad,
rendimiento/build/privacidad/smoke en verde. Verificación visual con Playwright contra el sitio
construido: insignias de Importar/Lote vacías sin sesión de importación; hover de «Usado» con el
texto correcto en las filas de Plan · Mes (el demo público se publica sin movimientos reales,
`transactions: []`, por privacidad, así que todas muestran «Previsto: sin movimientos»); horizonte de
Previsión intacto (24m, mismas columnas) tras ir a Mes y volver. Sin errores de consola.

**Backlog actualizado**: `docs/BACKLOG_NUEVE_PANTALLAS.md` — R-2, P-4 y P-1 pasan a `Hecho` (sin
«parcial») en sus tablas y ganan nota de cierre. Quedan tres tareas de la Prioridad 4, cada una con
un motivo de bloqueo real (no solo trabajo pendiente):

- **R-3** (cuenta Efectivo editable) — el modelo de liquidez de la app solo conoce dos cuentas
  (`caixa`/`mediolanum`, sumadas en `total` y usadas en toda la proyección financiera, en más de
  cuarenta puntos del código). Añadir Efectivo tal como pide el PDF exige decidir si participa en ese
  total (rehace el motor de proyección) o queda informativo (mucho más simple, pero no es
  exactamente «una cuenta más» como sugiere el mockup) — decisión de alcance real, no una cuestión de
  código, que se deja pendiente de resolver con el usuario.
- **M-2/M-6** (cuenta por movimiento) — no existe el atributo «cuenta» en el modelo de datos de
  movimientos, y el propio importador ya decidió explícitamente no fingir haber identificado una
  cuenta bancaria real (comentario en el código: «cuenta aquí es descriptiva, no una cuenta con id
  propio»). Construirlo bien exige una decisión de producto sobre qué significa «cuenta» por
  movimiento de aquí en adelante, no solo escribir el campo.
- **M-8** (una sola entrada revertible del historial) — sigue bloqueada, como ya documentaba el
  backlog: depende de la pieza compartida «Historial de versiones», que tampoco tienen R-6 ni Cierre
  (Fase 5, sin empezar).

Siguiente paso: consultar con el usuario el alcance de R-3 y M-2/M-6 antes de tocar código.

## Cierre de sesión — 16 de agosto de 2026: Prioridad 3 de la auditoría cerrada por completo — P-2

Continuación directa de la tanda H-5 (misma sesión, PR anterior ya fusionado). P-2 era la última
tarea pendiente de la Prioridad 3 — con este cierre, las cinco tareas de la prioridad (M-3, D-6,
D-4, H-5, P-2) quedan hechas. Solo la Prioridad 4 completa (6 tareas: R-2, P-4, P-1, R-3, M-2/M-6,
M-8) sigue pendiente.

**P-2**: el mockup mostraba una sola tabla «Presupuesto de [mes]» con cabeceras de sección y
subtotal por bloque, plegable; el código tenía dos tarjetas planas y separadas (Ingresos/Gastos),
ambas itemizadas sin agrupar, con «Bloque» como una simple columna de texto repetida en cada fila.

La tarjeta de Gastos se sustituye por una tabla única «Presupuesto de [mes]», agrupada por los
nombres de sección reales de `baseData.monthlyPlanning.sections` — Gastos fijos, Gastos variables,
Financiaciones — en vez de la taxonomía del mockup (que incluía una «Ahorro» que no existe como
sección propia en el modelo de datos real; no se fabricó para igualar el mockup al pixel). Cada
bloque es una fila de cabecera propia (`planMesBlockRowHtml`) con su subtotal de previsto
(`planMesGroupBySection`, suma de la misma columna Previsto) y un botón plegable con `aria-expanded`
(`handlePlanMesBlockToggle`) que oculta/muestra sus filas. La columna «Bloque» por fila se retira —
redundante una vez que la cabecera de bloque ya lo dice — y la fila de solo lectura de Financiaciones
(P-3, cuotas de deuda con enlace a Deuda) sigue intacta dentro de su bloque, sin ningún cambio de
comportamiento. Ingresos se queda como estaba, sin agrupar: el mockup tampoco la itemiza dentro de
la tabla de presupuesto — su previsto ya vive en los KPI de arriba (`planMesKpis`).

**Validación**: `npm run verify`, exit 0, **1008/1008 pruebas** (995 + 13 nuevas en
`tests/p1-p7-plan-mes.test.cjs`), 699 IDs de accesibilidad, rendimiento/build/privacidad/smoke en
verde. Verificación visual con Playwright: tres bloques (Gastos fijos 2.500 €, Gastos variables
1.750 €, Financiaciones 480 €) con sus subtotales reales, plegar/desplegar funcionando (filas
ocultas/mostradas, `aria-expanded` correcto), cabecera de 4 columnas sin «Bloque», y la fila de
Financiaciones con su enlace a Deuda intacta dentro del bloque. Sin errores de consola.

**Backlog actualizado**: `docs/BACKLOG_NUEVE_PANTALLAS.md` — P-2 pasa a `Hecho` (sin «parcial») en
la tabla y gana nota de cierre. La Prioridad 3 queda cerrada por completo. Siguiente objetivo: la
Prioridad 4, sin empezar todavía (R-2, P-4, P-1, R-3, M-2/M-6, M-8).

## Cierre de sesión — 16 de agosto de 2026: Prioridad 3 de la auditoría (tercera tanda) — H-5

Continuación directa de la tanda D-4 (misma sesión, PR anterior ya fusionado). H-5 era la última
tarea M de la Prioridad 3: solo queda P-2 (talla M, tabla del mes agrupada por bloques) para cerrar
la prioridad entera.

**H-5**: el criterio exigía «el primer botón sea primario y navegue a vista y pestaña (01 abre
Registrar › Importar extracto)». Dos gaps reales, no uno: `homeDecisionCandidates` no tenía ningún
candidato sobre movimientos sin incorporar — el ejemplo «01» del propio criterio — y ningún `target`
navegaba más allá de la vista, nunca a una pestaña concreta.

`homeImportSessionCandidate` añade la candidata que faltaba: cuando hay un extracto a medio importar
(`datosImportarSession`, persistido entre sesiones por `datosImportarPersistDraft` y restaurado al
arrancar), nombra el fichero y cuántos movimientos piden decisión (reutilizando
`datosImportarCounters`, el mismo recuento que ya pinta el propio asistente), con destino
`datos-importar`. Esa clave no es un id de vista real, sino una de las heredadas de
`REGISTRAR_LEGACY_HASH_TABS` — `setActiveView` ya sabía traducirla a «registrar» + su pestaña
«import» (el mismo mecanismo que usan los enlaces de las heredadas desde hace sesiones), pero el
guardarraíl de cada manejador de `data-home-nav` (pensado para no pasarle basura a `setActiveView`
con un id inventado) bloqueaba también esas claves legítimas. `homeNavTargetIsValid` sustituye ese
chequeo en el manejador de clics de `#home` para aceptar las dos formas, sin abrir una segunda vía
de navegación — el resto de manejadores de `data-home-nav` (Registrar, Plan, Asesor ejecutivo...)
quedan intactos, con su propio guardarraíl de siempre, porque ninguno de ellos necesitaba todavía
navegar a una clave heredada.

**Validación**: `npm run verify`, exit 0, **995/995 pruebas** (985 + 10 nuevas en
`tests/h5-hoy-decision-navegacion.test.cjs`; se ajustaron dos pruebas existentes en
`tests/d8-d9-deuda-oferta-aplicar.test.cjs` y `tests/f1-hoy-dato-ausente.test.cjs` que ejecutaban
`homeDecisionCandidates()` en un sandbox y no stubaban la función nueva), 699 IDs de accesibilidad,
rendimiento/build/privacidad/smoke en verde. Verificación visual con Playwright de punta a punta:
subir un CSV real en Registrar › Importar, ir a Hoy, ver la tarjeta «Movimientos por incorporar» con
el recuento correcto, y comprobar que su botón navega de vuelta a la pestaña «Importar extracto» con
la misma sesión en curso intacta (el fichero seguía ahí). Sin errores de consola.

**Backlog actualizado**: `docs/BACKLOG_NUEVE_PANTALLAS.md` — H-5 pasa a `Hecho` (sin «parcial») en
la tabla y gana nota de cierre. Solo queda P-2 para cerrar la Prioridad 3 entera; la Prioridad 4
completa (6 tareas) sigue pendiente: R-2, P-4, P-1, R-3, M-2/M-6, M-8.

## Cierre de sesión — 16 de agosto de 2026: Prioridad 3 de la auditoría (segunda tanda) — D-4

Continuación directa de la tanda M-3/D-6 (misma sesión, PR anterior ya fusionado). D-4 era la
tercera y última pieza «L» de la Prioridad 3: el calendario de amortización de `#deuda-ruta` se
proyectaba contrato a contrato, cada uno solo con su propio calendario declarado, sin aplicar nunca
el reparto real de la estrategia activa (quién recibe el pago de golpe primero) ni comparar el coste
en intereses contra un escenario de solo mínimos — justo lo que pedía el criterio.

**D-4**: `debtStrategyAggregateCalendar` añade el gráfico agregado que faltaba (capital vivo mes a
mes, sumando todos los contratos) encima del calendario por contrato ya existente, sin tocarlo.
Reutiliza `debtAmortizationSchedule` (la misma cuota francesa ya construida y probada el 15 de
agosto) para cada contrato, truncada en el mes en que la ruta activa lo liquida de golpe —
`debtStrategyPayoffPlan` lee el `mesResuelto` real de cada decisión aplicada del motor de
escenarios, el mismo dato que ya usaba el escalón de «Deuda viva» para su propio gráfico (más
simple, sin amortización mes a mes). Una reunificación añade el préstamo nuevo a la serie desde el
mes en que se firma. Debajo del gráfico, tres cifras: primer contrato liquidado (mes + nombre),
intereses totales del plan aplicado, y su diferencia frente a `debtAmortizationTotalInterest` — la
misma suma «solo mínimos» que ya pintaba cada `<details>` por contrato, sin decisión alguna. Con 0
decisiones (estrategia «No tocar nada») el agregado coincide exactamente con solo mínimos por
construcción, no por casualidad: se dice explícitamente en vez de enseñar un «0 €» sin explicar.

**Bug real encontrado con Playwright, no con las pruebas**: una deuda sin cuota declarada (dos de
los tres contratos de la cartera demo) solo genera una fila en `debtAmortizationSchedule` — un corte
deliberado para no fingir una amortización que no ocurre. Sumarla tal cual al agregado la hacía
desaparecer del total a partir del segundo mes, como si se hubiera pagado sola, cuando en realidad
sigue ahí, sin amortizar. Corregido manteniendo su saldo congelado en cada mes siguiente hasta que
la ruta la liquide de golpe (si lo hace) o se acabe el horizonte — verificado con la pestaña «No
tocar nada» pasando de 33 a 125 barras (la longitud real del horizonte) al aplicar la corrección.

**Validación**: `npm run verify`, exit 0, **985/985 pruebas** (969 + 16 nuevas en
`tests/d4-d5-d6-deuda-calendario-modos.test.cjs`, incluidas dos que fijan el bug de las deudas sin
cuota declarada), 699 IDs de accesibilidad, rendimiento/build/privacidad/smoke en verde.
Verificación visual con Playwright en las cuatro pestañas de estrategia (avalancha, bola de nieve,
consolidar, no tocar): gráfico y estadísticas correctos en las cuatro, sin errores de consola.

**Backlog actualizado**: `docs/BACKLOG_NUEVE_PANTALLAS.md` — D-4 pasa a `Hecho` (sin «parcial») en
la tabla y gana nota de cierre. De la Prioridad 3 solo quedan P-2 y H-5; la Prioridad 4 completa (7
tareas) sigue pendiente: R-2, P-4, P-1, R-3, M-2/M-6, M-8.

## Cierre de sesión — 16 de agosto de 2026: Prioridad 3 de la auditoría (primera tanda) — M-3 y D-6

Continuación directa de la Prioridad 2 (M-7/D-9/D-8/H-6), sesión siguiente. El usuario pidió seguir
por prioridad con M-3, D-6, D-4, P-2 y H-5; tras construir y verificar M-3 y D-6, eligió publicar
esa tanda ahora y continuar con D-4 después en la misma sesión.

**M-3**: el `<select>` de mes de Movimientos se sustituyó por seis chips con recuento vivo (Todos,
Sin clasificar, Gastos, Ingresos, Manual, Duplicado revisado — `MOVEMENT_CHIPS`, cada uno con su
`test(row)`) y cuatro atajos de rango (Este mes, Últimos 3 meses, Año en curso, Todo —
`movementsRangeShortcutBounds`, aritmética de mes natural sobre Desde/Hasta). La lista base
(`movementsRangeAndSearchList`, rango + búsqueda) alimenta tanto el recuento de cada chip
(`movementsChipCounts`) como la lista filtrada final (`movementsFilteredList`); la búsqueda ahora
compara también contra el importe en texto, no solo concepto/detalle/categoría. El chip «Duplicado
revisado» necesitó un campo nuevo y acotado: `datosImportarIncludedTransactions` descartaba la
decisión «distinto» del asistente de duplicados al construir los movimientos finales; ahora estampa
`duplicateReviewed: true` en esos movimientos. «Manual» cuenta 0 hoy con honestidad — no existe
todavía alta manual de movimientos.

**D-6**: sin mockup visual que fijara contra qué se colorean los «cinco indicadores» del criterio,
se propuso el diseño al usuario antes de construir (`AskUserQuestion`) en vez de adivinarlo: comparar
cada uno de los ocho modos contra un escenario «Plan» (el motor de escenarios con cero decisiones de
deuda, mismo patrón que el baseline «no-tocar» ya usado en la comparación de las 4 estrategias) — el
usuario confirmó la propuesta. La tabla de `#deuda-comparar` gana cinco columnas por modo (mes, caja
mínima coloreada frente al Plan, coste coloreado frente al capital vivo, cuota resultante coloreada
frente a la cuota actual, resultado con insignia), reutilizando siempre `debtModeResultForContract` —
el mismo cálculo del panel del modo activo. `renderDeudaCompararModeInsight` añade el veredicto en
prosa, nombrando el modo viable con mejor caja mínima y el supuesto principal, oculto si ningún modo
es viable.

**Bug real encontrado con Playwright, no con las pruebas**: dar a los seis chips envueltos en varias
filas la misma clase de píldora de una sola fila que ya usaban los atajos de rango
(`.registrar-mes-filters`) rompía visualmente al hacer wrap — una mancha redondeada rota cruzando las
tres filas. Corregido quitando esa clase del contenedor de chips y dándole su propio
`display:flex; flex-wrap:wrap` sin fondo de píldora; la clase compartida queda solo en botones
individuales y en contenedores de una fila.

**Validación**: `npm run verify`, exit 0, **969/969 pruebas** (954 + 15 nuevas, repartidas entre
`tests/m1-m11-movimientos.test.cjs` reescrito para M-3 (32 pruebas en el archivo) y
`tests/d4-d5-d6-deuda-calendario-modos.test.cjs` (49 pruebas en el archivo tras D-6)), 697 IDs de
accesibilidad, rendimiento/build/privacidad/smoke en verde. Verificación visual con Playwright:
chips con recuento correcto y wrap limpio sin mancha de píldora, atajos de rango escribiendo
Desde/Hasta, búsqueda por importe, tabla de ocho modos con las cinco columnas coloreadas
verde/rojo y el veredicto en prosa visible bajo la tabla.

**Backlog actualizado**: `docs/BACKLOG_NUEVE_PANTALLAS.md` — M-3 y D-6 pasan a `Hecho` (sin
«parcial») en la tabla y ganan nota de cierre. Quedan pendientes D-4, P-2 y H-5 de la Prioridad 3,
y la Prioridad 4 completa: R-2, P-4, P-1, R-3, M-2/M-6, M-8. Siguiente objetivo en esta misma
sesión: D-4 (calendario de amortización aplicando el reparto real de la estrategia activa, con
comparación agregada frente a solo-mínimos).

## Cierre de sesión — 15 de agosto de 2026: Prioridad 2 de la auditoría — M-7, D-9, D-8 y H-6

Continuación directa de la Prioridad 1 (R-11/P-3), misma sesión. El usuario pidió seguir por
prioridad con M-7, D-9, D-8 y H-6.

**M-7**: faltaba la casilla «recordar para los que empiecen igual», desmarcada por defecto, para
que aprender una regla de concepto en Movimientos fuera un acto deliberado. `mappingForMovement`
mira ahora primero una clave de un solo movimiento (`transactionIdentity`) antes que la de concepto
(`movementMappingKey`); la casilla nueva decide cuál escribe `handleMovementReclassify`.

**D-9/D-8**: el criterio real no era el checklist de Deuda › Ruta (que ya existía, pero comprobaba
solo reserva y mes viable) — era la tarjeta «Oferta en curso», que solo enrutaba a la heredada
`#debt-roadmap` para aplicar. Reconstruida en el sitio: `deudaRutaOfferChecklist` pinta los cuatro
requisitos reales (oferta aceptada, documentos completos, reserva protegida, motivo al confirmar) y
el botón «Aplicar al plan» llama a `applyE14bOffer()`, el mismo motor que ya usaba `#debt-roadmap`
(regla transversal 01). `requestOperationConfirmation` (el diálogo de motivo compartido con
Escenarios y otras cinco operaciones) gana un campo opcional de fecha de revisión tras
`allowReviewDate`; si se rellena, genera un recordatorio real en Hoy vía `homeDebtReviewReminders()`
(H-5).

**Bug real encontrado con Playwright, no con las pruebas**: la deuda demo ya tenía una decisión
aplicada, y el checklist salía en verde igual mientras `applyE14bOffer()` bloqueaba en silencio (su
aviso vivía en `#e14bStatus`, dentro de `#debt-roadmap`, invisible desde Ruta). Corregido con un
aviso explícito bajo el checklist y copiando el resultado de `#e14bStatus` a la tarjeta tras cada
intento — mismo patrón que el bug de `worstMonthOf` en la sesión de P-8/P-9: la verificación visual
atrapó algo que las pruebas unitarias, con sus propios dobles, no podían ver.

**H-6**: el bloque «El mes en una línea» de Hoy mostraba solo cifras reales (Ingresos reales /
Gastos reales / Margen del mes / Movimientos registrados), sin comparar contra lo previsto.
Corregido a Ingresos / Gasto previsto / Gasto real a hoy / Desviación, leyendo
`plannedValueForVisualRow` del mes actual — el mismo previsto guardado que ya usa Plan › Previsión.
Sin mes encontrado, dice «—» en vez de fabricar un previsto de 0€.

**Validación**: `npm run verify`, exit 0, **954/954 pruebas** (935 + 19 nuevas, repartidas entre
`tests/m1-m11-movimientos.test.cjs`/`tests/m8-m8b-movimientos-lote.test.cjs` (M-7),
`tests/d8-d9-deuda-oferta-aplicar.test.cjs` nuevo (17 pruebas) y `tests/v3-4-oferta-en-curso.test.cjs`
reescrito (D-8/D-9), y `tests/f1-hoy-dato-ausente.test.cjs` (H-6)), 692 IDs de accesibilidad,
build/privacidad/smoke en verde. Verificación visual con Playwright en los tres flujos (M-7, D-8/D-9
de punta a punta con oferta real aplicada y recordatorio en Hoy, H-6).

**Backlog corregido**: M-7, D-8, D-9 y H-6 vuelven a `Hecho` en `docs/BACKLOG_NUEVE_PANTALLAS.md`,
con sus notas de auditoría actualizadas. Quedan pendientes las Prioridades 3-4 (11 tareas): M-3,
D-6, D-4, P-2, H-5 · R-2, P-4, P-1, R-3, M-2/M-6, M-8.

## Cierre de sesión — 15 de agosto de 2026: Prioridad 1 de la auditoría — R-11 y P-3

Continuación directa del cierre de la auditoría. El usuario pidió seguir por prioridad, empezando
por la Prioridad 1: los dos gaps que tocaban la regla transversal 01 (una sola puerta de escritura).

**R-11**: `#visual-detail` (Cuadro de mandos) seguía escribiendo saldos sin ninguna guarda — sus
campos `visualCaixaBalance`/`visualMediolanumBalance`/`visualBalanceDate`/`visualBalanceMode`
llamaban sin condición a `handleVisualAccountBalanceInput`/`handleVisualBalanceControlChange`.
Mismo patrón que `REGISTRAR_MES_LEGACY_READONLY`: la lógica real se extrajo a
`applyVisualAccountBalanceInput`/`applyVisualBalanceControlChange` (el motor legítimo, que
Registrar sigue llamando directamente), y los manejadores que escuchan los propios campos de
`#visual-detail` quedan inertes tras `VISUAL_DETAIL_BALANCE_LEGACY_READONLY`. Los cuatro campos se
deshabilitan siempre (antes solo fuera de modo manual) y el aviso enlaza a Registrar › Saldo de
cuentas.

**P-3**: las cuotas de deuda eran editables en Plan · Mes cuando D-2 (Deuda › Contratos) ya es su
puerta canónica. `planMesIsFinancingRowKey` identifica las filas del bloque Financiaciones;
`planMesRowHtml` les pinta un texto de solo lectura con enlace «Deuda» (a `#deuda-contratos`, con
el mismo patrón `data-home-nav` que ya usaba Registrar) en vez de un `<input>`, y
`handlePlanMesPlannedChange` lleva su propia guarda contra escribir a mano. El enlace no tenía
listener propio en `planMesTables` — se añadió, mismo patrón que `registrarActualsBody`.

**Bug encontrado con Playwright antes de darlo por bueno**: el primer intento del enlace «Deuda»
no navegaba (el hash se quedaba en `#plan`) porque `planMesTables` no tenía ningún manejador de
`data-home-nav` — cada pantalla cablea el suyo por contenedor, no hay un listener global. Corregido
añadiéndolo al bloque de clic ya existente de `planMesTables`.

**Validación**: `npm run verify`, exit 0, **935/935 pruebas** (929 + 6 nuevas: 1 en
`tests/r1-r4-registrar.test.cjs`, 5 en `tests/p1-p7-plan-mes.test.cjs`), 692 IDs de accesibilidad,
build/privacidad/smoke en verde. Verificación visual con Playwright: los cuatro campos de
`#visual-detail` aparecen `disabled`, forzar el DOM y disparar `change` a mano no cambia el saldo,
editar desde Registrar sigue propagando el valor con normalidad, la fila de Financiaciones en
Plan · Mes no tiene `<input>`, y clicar «Deuda» navega de verdad a `#deuda-contratos`.

**Backlog corregido**: R-11 y P-3 vuelven a `Hecho` en `docs/BACKLOG_NUEVE_PANTALLAS.md`, con sus
notas de auditoría actualizadas para documentar la corrección. Quedan pendientes las Prioridades
2-4 (15 tareas): M-7, D-9, D-8, H-6 · M-3, D-6, D-4, P-2, H-5 · R-2, P-4, P-1, R-3, M-2/M-6, M-8.

## Cierre de sesión — 15 de agosto de 2026: auditoría completa contra los nueve PDF de mockups

Continuación directa del cierre anterior (P-8/P-9). Tras fusionar esa matriz, el usuario compartió
los cinco PDF que faltaban (`Deuda.pdf`, `Plan.pdf`, `Movimientos.pdf`, `Registrar.pdf`, `Hoy.pdf`)
y pidió auditarlo todo contra los mockups, corrigiendo el backlog donde hiciera falta — tanto en el
repositorio como en un artefacto.

**Método**: cinco auditorías en paralelo (una por pantalla — Hoy, Registrar, Movimientos, Deuda,
Plan), cada una leyendo su PDF fuente con `pdftoppm`/`pdftotext`, comparando el criterio literal
contra `docs/BACKLOG_NUEVE_PANTALLAS.md` y contra el código real (`app.js`/`index.html`/tests), sin
tocar ningún archivo — solo investigación. Ninguna tarea marcada `Hecho` resultó estar sin
construir del todo, pero **17 de 124 tareas** cumplían solo una parte del criterio real:

- **Hoy**: H-5 (ninguna decisión navega a vista+pestaña concreta), H-6 (el bloque de resumen
  mensual muestra solo cifras reales, el mockup pide previsto‑vs‑real con desviación). Las otras 8
  tareas de Hoy coinciden con precisión.
- **Registrar**: R-2 (faltan recuentos en las insignias de Importar/Lote), R-3 (falta la cuenta
  Efectivo), **R-11** (grave: `#visual-detail`/Cuadro de mandos se quedó fuera del cierre de
  escritura de las heredadas y sigue escribiendo saldos sin ninguna guarda — viola la regla
  transversal 01).
- **Movimientos**: M-2/M-6 (falta el campo «cuenta», limitación de modelo de datos), M-3 (faltan
  los 6 chips de filtro y los atajos de rango), M-7 (falta la casilla «recordar regla» desmarcada
  por defecto — hoy aprende siempre, lo contrario de «deliberado»), M-8 (confirma el hueco de
  historial ya admitido).
- **Plan**: **P-8/P-9 se confirman correctas sin matices** frente a `Plan.pdf` — la reconstrucción
  de la sesión anterior era la correcta. El resto sí tiene gaps: P-2 (dos tarjetas planas en vez de
  una tabla con subtotal por bloque y plegado), **P-3** (grave: las cuotas de deuda son editables
  en Plan · Mes cuando deberían ser de solo lectura con enlace a Deuda — segunda puerta de
  escritura para un dato cuya puerta canónica ya es D-2), P-4 (falta el hover de procedencia con
  recuento de movimientos), P-1 (el horizonte de Previsión no se comparte con las otras pestañas).
- **Deuda**: D-4 (el calendario de amortización es deliberadamente independiente de la estrategia
  activa, cuando el criterio pide lo contrario), D-6 (comparativa de 8 modos sin color mejor/peor
  ni veredicto en prosa), D-8 (falta la fecha de revisión opcional y su recordatorio en Hoy), D-9
  (el checklist verifica reserva+mes viable, no los cuatro requisitos del criterio).

**Backlog corregido** (`docs/BACKLOG_NUEVE_PANTALLAS.md`): las 17 filas pasan de `Hecho` a `Hecho
(parcial, ver nota)`, con una nota nueva bajo cada tabla de pantalla citando el criterio del PDF,
lo que hay en el código y por qué difieren — mismo nivel de detalle que la nota de P-8 de la sesión
anterior. El resumen de "Estado de fases" (§3) gana un párrafo señalando R-11 y P-3 como los dos
gaps más urgentes por tocar la regla transversal 01 directamente.

**Alcance de esta sesión**: solo auditoría y corrección de documentación — no se ha tocado ningún
código de producto. Los 17 gaps quedan como trabajo pendiente explícito, con motivo, listo para
una sesión de reconstrucción dirigida (mismo patrón que P-8).

**Validación**: solo cambios de documentación (`docs/BACKLOG_NUEVE_PANTALLAS.md`,
`PROJECT_STATE.md`); `npm run verify` re-ejecutado igualmente antes de publicar, sin tocar código.

## Cierre de sesión — 15 de agosto de 2026: P-8/P-9 real — la matriz de Plan › Previsión, tras un conflicto de especificación

Continuación directa del cierre anterior del mismo día. El usuario compartió los PDF fuente del
backlog "Nueve pantallas" (`Backlog_Global.pdf` V4 y las fichas de alineación por pantalla) y pidió
"contrastar todo de nuevo" antes de seguir construyendo P-9.

**Conflicto detectado antes de tocar código**: el P-8 recién marcado `Hecho` (cierre anterior, mockup
2c en `#prevision`) **no era el P-8 real**. `Backlog_Global.pdf` especifica P-8 así: *"Una fila por
bloque y una columna por mes del horizonte. Los meses cerrados se distinguen visualmente y llevan
candado"* — una matriz bloque×mes, nada que ver con el titular/banda/panel día a día construido
antes. Se preguntó al usuario cómo resolverlo (`AskUserQuestion`); eligió reconstruir P-8 como la
matriz real. Investigando el destino correcto se confirmó que P-8 nunca fue sobre `#prevision`: su
sitio es la pestaña «Previsión» de `#plan` (hasta entonces un enlace de vuelta a `#prevision`, mismo
patrón de placeholder que R-2 con Registrar) — así que el trabajo del mockup 2c no se tocó ni se
perdió, son dos pantallas legítimas y distintas, cada una fiel a su propia fuente.

**P-8 construido**: `renderPlanPrevision()` — matriz de solo lectura con los bloques de Cuadro de
mandos (`cuadroMandosSections`: Ingresos, Gastos fijos, Gastos variables, Financiaciones) más
Ahorro (sintética, `row.saving`) y Resultado del mes; horizonte 12/24/48/completo desde el primer
mes del plan, con candado en los cerrados; previsto guardado (no borradores de sesión, para no
recalcular la simulación completa en cada tecla de otra pantalla).

**P-9 construido junto a P-8** (su criterio es literalmente "la fila final de la previsión"): fila
de Colchón con `cushionLevel`, una escala nueva de **tres** niveles (negativo/ajustado/holgado) en
`canonical-cushion.js`, más compacta que la de cuatro que ya usa el mapa de calor y pensada para
compartirse tal cual con A-2 de Análisis cuando se construya. El peor mes del horizonte se marca en
Colchón y en Resultado del mes.

**Bug real atrapado en verificación visual con Playwright, no en las pruebas primero**: el peor mes
no se marcaba en el sitio (0 celdas) por pasar `{key: ...}` a `worstMonthOf`, que por defecto busca
`detailMonthKey`. El test de integración original usaba un `worstMonthOf` de imitación que no
reproducía ese detalle, así que pasaba en verde con el bug presente. Corregido el código
(`{ monthKeyField: "key" }`) y el test (ahora importa `canonical-cushion.js` real).

**Documentación corregida**: `docs/E19_SISTEMA_DISENO.md` §13 separaba mal el mockup 2c de P-8 (los
atribuía como la misma pieza); reescrito para dejar explícito que son dos pantallas distintas.
`docs/BACKLOG_NUEVE_PANTALLAS.md` — P-8 y P-9 pasan a `Hecho` con nota extensa bajo la tabla de la
pantalla 04 que documenta el conflicto, la matriz y el bug.

**Pruebas nuevas**: `tests/p8-p9-plan-prevision.test.cjs` (13 pruebas) y 2 más en
`tests/canonical-cushion.test.cjs` para `cushionLevel`; se corrigió una prueba de
`tests/p1-p7-plan-mes.test.cjs` que asumía la pestaña Previsión todavía sin construir.

**Validación** (`npm run verify`, exit 0): **929/929 pruebas** (913 + 15 nuevas), **692 IDs
únicos** de accesibilidad, diff 10.000 filas en 43,1 ms, forecast y escenarios en 249,9 ms,
recursos 1430 KB, build del sitio, privacidad y smoke test en verde.

**Pendiente**: la auditoría de Hoy/Registrar/Movimientos/Deuda/Plan contra los PDF nuevos se hizo en
la sesión siguiente, el mismo 15 de agosto — ver la entrada de arriba.

## Cierre de sesión — 15 de agosto de 2026: Previsión — P-8, corrección de dos documentos y pantalla nueva

El usuario retomó la sesión con un pantallazo de la conversación anterior y pidió revisar todo lo
publicado hasta ahora contra los mockups y el backlog antes de seguir, no solo confiar en que
«pendiente de fases futuras» fuera siempre la explicación correcta.

**Hallazgo antes de tocar código**: `docs/E19_SISTEMA_DISENO.md` daba el mockup 2c (Previsión) por
«✅ Migrada (E19-5)» y `BACKLOG.md` —el backlog operativo vigente— también lo marcaba «✅» sin
matices. Los dos estaban equivocados: E19-5 solo aplicó la piel visual del rediseño a las
pantallas heredadas `#prevision`/`#forecast` (tokens, tipografía, tarjetas), sin construir el
contenido real del mockup. `docs/BACKLOG_NUEVE_PANTALLAS.md` sí tenía razón — P-8 «Previsión mes a
mes por bloque» figuraba `Pendiente`, así que no había ninguna inconsistencia entre el sitio
publicado y *ese* backlog, solo en los otros dos documentos. Se corrigieron los dos antes de
construir nada.

**Auditoría del resto del catálogo**: se comprobaron 1a (`#home`), 1f (`#update-hub`) y 2b
(`#data-entry`) —el mismo lote de migración E19 que incluía la 2c con el error— contra sus
mockups. Las tres sí tienen contenido real construido (decisiones/KPI dinámicos, los seis tiles
del hub, el stepper de 4 pasos de la bandeja), no un simple reskin. El resto del catálogo (1b-1e,
1g, 2d, 2e, 3a-3c) ya tenía secciones propias en `E19_SISTEMA_DISENO.md` con funciones citadas y
verificación en navegador. Conclusión: el error de 2c era aislado, no un patrón sistemático.

**P-8 construida esta sesión**: `renderPrevision()` sustituye por completo la tabla anual
heredada por año natural. Titular en prosa sobre el mes más delicado del horizonte
(`previsionHeadlineHtml`/`previsionWorstOf`), selector de horizonte 12/24/48 meses o el horizonte
completo (`previsionHorizonRows`), una banda vertical por mes con la reserva marcada y el mismo
tono de color que ya usaba el mapa de calor (`mapaCalorFloor`/`mapaCalorTone`, sin fabricar una
segunda escala), tabla mensual Ingresos/Gastos/Deuda/Ahorro/Mínimo, y un panel día a día del mes
seleccionado. Reutiliza tal cual `previsionMetric` (ya usado por la tabla heredada) y
`planningBreakdownForForecastMonth` (el mismo motor de timing que ya alimentaba el forecast) —no
se construyó un segundo motor de cálculo.

**Decisión de datos del panel día a día, confirmada explícitamente por el usuario**: combina
movimientos reales (`baseData.transactions`, con el saldo que declara el propio extracto) cuando
el mes ya los tiene, y partidas con fecha conocida (`incomeEvents`/`expenseEvents`, saldo simulado
desde el inicio de mes) cuando no — nunca los dos mezclados dentro del mismo mes, simplificación
deliberada y documentada.

**Sugerencia accionable** (`previsionSuggestion`): simulación local real, no un texto fabricado —
mueve la partida de gasto más grande anterior al mínimo del mes justo después del siguiente cobro
y recalcula el mínimo resultante; solo se ofrece si de verdad mejora, nunca sobre un mes real ya
cerrado.

**Verificación visual con Playwright**: con los datos de demostración, `#prevision` mostró el
titular calculado, 12 columnas de banda en el horizonte por defecto (24 al cambiar a «24 m»), la
tabla mensual y el panel día a día con las partidas fechadas del mes más delicado; al hacer clic
en otro mes de la tabla, el panel cambió al mes correcto. Sin errores de consola propios de este
cambio (el único aviso de red, `ERR_TUNNEL_CONNECTION_FAILED` hacia el CDN de Supabase, es
preexistente y aparece igual en `#home`).

**Pruebas nuevas**: `tests/p8-prevision.test.cjs` (19 pruebas) — recorte por horizonte, titular,
columnas de la tabla mensual, banda con reserva y tono por mes, movimientos reales filtrados y
ordenados, partidas proyectadas con saldo simulado, la decisión real-vs-proyectado, la sugerencia
(con mejora, sin cobro posterior que la permita, y nunca sobre un mes real) y el marcado HTML de
la pantalla nueva. Se eliminó `selectMonthlyDetailByKey` (código muerto tras quitarle su única
llamada al reemplazar la navegación de la tabla anual por el panel día a día in-situ).

**Validación** (`npm run verify`, exit 0): **913/913 pruebas** (894 + 19 nuevas), **689 IDs
únicos** de accesibilidad, diff 10.000 filas en **41,1 ms**, forecast y escenarios en **240,4 ms**,
recursos **1422 KB**, build del sitio, privacidad y smoke test en verde.

**Backlog actualizado**: `docs/BACKLOG_NUEVE_PANTALLAS.md` (P-8 pasa a `Hecho`, con nota extensa
bajo la tabla de la pantalla 04), `docs/E19_SISTEMA_DISENO.md` (tabla del catálogo y §13
corregidas) y `BACKLOG.md` (fila de 2c corregida, con nota bajo la tabla de los quince mockups).

**Publicado en dos tandas**: la corrección de `docs/E19_SISTEMA_DISENO.md` se comiteó, publicó y
fusionó primero por separado (PR #48, sin tocar código) porque el hook de cierre de sesión exigía
no dejar cambios sin publicar a mitad de la investigación; la construcción de P-8 y el resto de
documentos corregidos van en un segundo commit/PR de esta misma sesión, según lo autorizado en
`CLAUDE.md`.

## Cierre de sesión — 15 de agosto de 2026: Movimientos — M-8/M-8b, selección múltiple y lote

Continuación directa del cierre anterior del mismo día (Deuda D-4/D-5/D-6, PR #46 fusionado). El
usuario pidió seguir con M-8 y M-8b, las dos tareas de Movimientos que habían quedado aparcadas
para su propia sesión desde que se cerró el resto de M-1 a M-11.

**M-8 (selección múltiple y acción en lote)**: casilla por fila más «seleccionar todo» en la
cabecera, y una barra de acción en lote que reutiliza el mismo componente visual `.e19-impact-bar`
que ya usan Registrar, Plan y Cuadro de mandos (cada uno con su propio contenido sobre la misma
base, mismo patrón aquí). No abre una tercera puerta de escritura: `movementsSelectedConceptKeys`
agrupa las filas seleccionadas por el mismo `movementMappingKey` que ya usaba M-7 (una regla por
concepto, no por movimiento — seleccionar 40 movimientos de 3 conceptos escribe 3 reglas, no 40), y
`handleMovementsBulkApply` corre exactamente la misma secuencia que `handleMovementReclassify`
(M-7) y `applyPendingMovementMappings` de la revisión de importación. Una selección que mezcla
ingresos y gastos se bloquea con el motivo explícito («selecciona movimientos del mismo tipo») en
vez de ofrecer una lista de partidas que solo valdría para la mitad de lo marcado.

**M-8b (consistencia con Registrar y el importador)**: se descubrió que la sesión de importación de
4 pasos (`datosImportarSession`) no se resetea al navegar a otra pantalla, así que un usuario a
medio importar que fuera a Movimientos y reclasificara en lote un concepto que esa sesión tenía
pendiente de decidir se encontraría, al volver, con el paso 2 pidiéndole una decisión que el lote
ya había tomado. `datosImportarRefreshRowsForMappings` cierra ese hueco: tras cualquier escritura
en `movementMappings` (M-7 o M-8, se enganchó en los dos) recalcula `prior`/`suggestion` solo en
las filas de la sesión abierta cuyo concepto coincide y que el usuario no había decidido ya a mano
(nunca pisa una decisión explícita). Deliberadamente no se construyó un mecanismo de «historial de
acciones» nuevo aunque la tabla de piezas compartidas menciona M-8b junto a R-6/C-3b bajo
«Componente de guardado»: ese historial depende de Cierre (Fase 5), que no existe todavía, y R-6
tampoco lo tiene hoy — construirlo aquí habría sido adelantarse a una dependencia que ninguna otra
pieza cumple aún.

**Verificación visual con Playwright**: con tres movimientos de prueba, marcar dos filas mostró la
barra de lote («2 movimiento(s) seleccionados · 2 concepto(s) distinto(s)») con el selector de
partida deshabilitado hasta elegir una; «Seleccionar todo» amplió a los tres; aplicar reclasificó
los tres, ocultó la barra, vació la selección, y el panel de «Comportamiento conciliado» (aguas
abajo, sin tocarlo) pasó de 0/0 a 3/3 conciliados con el importe correcto — confirmando que
Registrar/Análisis ven el cambio sin ningún paso adicional.

**Pruebas nuevas**: `tests/m8-m8b-movimientos-lote.test.cjs` (28 pruebas) — selección por índice,
agrupación por concepto, la barra de lote (oculta sin selección, tipo mixto bloqueado, aviso de
sobrescritura), seleccionar todo/cancelar, el refresco de una sesión de importación a medias y la
escritura real con la misma secuencia que M-7. Se ajustó `tests/m1-m11-movimientos.test.cjs` (M-11
ahora sí lleva un `<input>` por fila: la casilla de selección, de tipo `checkbox` — la prueba pasó
a comprobarlo específicamente en vez de exigir cero inputs, y sigue verificando que el importe se
pinta como texto) y se le añadió el stub del nuevo refresco que M-7 ya invoca.

**Validación** (`npm run verify`, exit 0): **894/894 pruebas** (866 + 28 nuevas), **686 IDs
únicos** de accesibilidad, diff 10.000 filas en **31,2 ms**, forecast y escenarios en **179,3 ms**,
recursos **1412 KB**, build del sitio, privacidad y smoke test en verde.

**Backlog actualizado**: `docs/BACKLOG_NUEVE_PANTALLAS.md` — M-8 y M-8b pasan a `Hecho` en la tabla
de la pantalla 03, con nota extensa bajo la tabla. De las 13 tareas de Movimientos solo queda M-8c,
bloqueada hasta que exista Cierre (Fase 5).

**Pendiente de publicar**: misma rama `claude/finanzas-casa-deuda-2zdzgv`, con estos cambios como
nuevos commits encima del que ya se fusionó como PR #46; commit y PR en borrador según lo
autorizado en `CLAUDE.md`.

## Cierre de sesión — 15 de agosto de 2026: Deuda — D-4/D-5/D-6, las tres tareas L/M que quedaban

Continuación directa del cierre anterior del mismo día (D-1/D-2, PR #45 fusionado). El usuario pidió
seguir con el resto de Deuda del backlog «Nueve pantallas»: D-4 (calendario de amortización), D-5
(ocho modos de liquidación heredados de `#debt-control`) y D-6 (comparativa plan frente a modo),
las tres tareas de talla L/M que la sesión anterior había dejado aparcadas a propósito «para su
propia sesión». Se abordaron en el orden D-5 → D-6 → D-4, propuesto y confirmado con el usuario
antes de tocar código.

**D-5 no reimplementa un motor de liquidación**: antes de escribir nada se descubrió que los ocho
modos heredados (`debtModeLabel`: amortización óptima/manual, fraccionada óptima/manual, retomar
pagos óptimo/manual, refinanciación óptima/manual) son exactamente los cuatro tipos de decisión de
deuda de un solo contrato que `canonical-scenario-engine.js` ya resolvía (`amortizacion`,
`amortizacion_fraccionada`, `refinanciacion`, `retomar_pagos`) cruzados con las dos planificaciones
que el motor ya sabía resolver (`planificacion.modo`: óptimo busca el primer mes viable, manual usa
el mes elegido). `DEBT_MODE_DEFINITIONS` declara el cruce; `debtModeDecisionForContract` construye
la decisión reutilizando tal cual `params()`/`mes()`/`titulo()` de `ESCENARIO_MOTOR_TYPES` —el
mismo catálogo que ya usaba la Escenarios heredada, sin un segundo constructor de decisiones de
deuda—, con el interruptor óptimo/manual que ese catálogo no exponía. Nunca manda un cero inventado
al motor: sin TIN ni plazo, «Refinanciación» se queda sin cifras a propósito (igual que
«Consolidar» sin oferta); la única cifra que sí se sugiere sola es la cuota de refinanciación una
vez escritos TIN y plazo, con la misma fórmula francesa que ya usaba «Consolidar»
(`debtConsolidationMonthlyPayment`), sin pisar lo que el usuario ya haya tecleado.

**D-6** (`renderDeudaCompararModes`) añade a `#deuda-comparar` un selector de contrato + modo con
sus campos propios y, debajo, una tabla que evalúa los ocho modos a la vez sobre ese mismo
contrato — reutilizando el mismo `debtModeResultForContract` que alimenta el panel del modo activo,
nunca un cálculo distinto según desde dónde se mire. «Retomar pagos» sobre un contrato que no está
suspendido no se envía en silencio al motor: se dice explícitamente que solo aplica a una deuda con
los pagos suspendidos, la misma regla que ya exigía `#debt-control`.

**D-4** (`debtAmortizationSchedule`, `renderDeudaRutaCalendar`) añade a `#deuda-ruta` un calendario
de amortización mes a mes por contrato, de solo lectura y deliberadamente independiente de las
decisiones de la ruta: proyecta el calendario declarado (TAE + cuota, amortización francesa), en el
mismo orden de ataque que la pestaña activa. Responde a la limitación que la propia pantalla ya
declaraba junto al gráfico de «Deuda viva» («no es un calendario de amortización mes a mes»). Nunca
aproxima en silencio: si la cuota no cubre ni el interés lo dice, si el horizonte se acaba antes de
saldo cero lo dice, y una deuda sin cuota declarada (dos de los tres contratos de la cartera demo
tienen `currentPayment: 0`) lo distingue de una cuota simplemente insuficiente.

**Verificación visual con Playwright**: en `#deuda-comparar`, cambiar el modo a «Refinanciación con
inicio óptimo» mostró los cuatro campos nuevos y la nota «Faltan datos para simular este modo»; la
comparativa de los ocho modos pintó sus ocho filas. Un primer vistazo mostró el panel de resultado
del modo activo con las etiquetas visibles pero los valores casi pegados al borde derecho —
`.deuda-decidir-strategy-kpis` se había pensado para la columna estrecha de una tarjeta de
estrategia, no para el ancho completo de un fieldset; se le dio una clase propia
(`.deuda-decidir-mode-result`) con una rejilla de verdad y quedó legible. En `#deuda-ruta`, el
calendario mostró un `<details>` por contrato en el orden de Avalancha, distinguiendo la
reunificación sintética (saldada en un mes con su interés total) de las dos deudas demo sin cuota
declarada.

**Pruebas nuevas**: `tests/d4-d5-d6-deuda-calendario-modos.test.cjs` (42 pruebas) — catálogo de los
ocho modos, construcción de la decisión por modo con validación real contra
`canonical-scenario-schema.js` y resolución real contra `canonical-scenario-engine.js`, la
sugerencia de cuota de refinanciación, la comparativa de los ocho modos, la amortización francesa
(cuota insuficiente, sin TAE, horizonte agotado, tope de 600 filas) y el pintado del calendario.

**Validación** (`npm run verify`, exit 0): **866/866 pruebas** (824 + 42 nuevas), **679 IDs
únicos** de accesibilidad, diff 10.000 filas en **35,4 ms**, forecast y escenarios en **180,0 ms**,
recursos **1402 KB**, build del sitio, privacidad y smoke test en verde.

**Backlog actualizado**: `docs/BACKLOG_NUEVE_PANTALLAS.md` — D-4, D-5 y D-6 pasan a `Hecho` en la
tabla de la pantalla 05, con nota extensa bajo la tabla. Con esto, de las 15 tareas de Deuda solo
quedan D-2b (bloqueada por Cierre), D-10/D-11/D-13 (ampliaciones puntuales, parciales), D-12 (sin
cifra canónica de ingreso mensual) y D-14 (choca con T-4, bloqueada a propósito).

**Pendiente de publicar**: rama `claude/finanzas-casa-deuda-2zdzgv`, commit y PR en borrador según
lo autorizado en `CLAUDE.md`.

## Cierre de sesión — 15 de agosto de 2026: Deuda — D-1/D-2 nuevas, D-3/D-7/D-8/D-9 reconciliadas

El usuario pidió seguir con la Fase 3 (Deuda) del backlog «Nueve pantallas». Antes de escribir
nada se descubrió que `#deuda-ruta` y `#deuda-comparar` ya existían, completas y funcionando,
desde el 10 de agosto (epic «V3», anterior a este backlog reescrito el 14 de agosto) — el
backlog las daba por "Pendiente" sin conocerlas. Se hizo una reconciliación tarea por tarea (ver
la nota extensa bajo la tabla de la pantalla 05 en `docs/BACKLOG_NUEVE_PANTALLAS.md`) antes de
decidir qué construir esta sesión.

**Reconciliado, sin escribir código**: D-3 (orden de ataque por estrategia,
`debtStrategyOrderedContracts`/`debtStrategyDecisions`), D-7 (comparar no escribe, confirmado por
diseño y por código), D-8 (aplicar con motivo obligatorio, `handleEscenarioAplicarConfirm`) y D-9
(comprobaciones previas, `deudaRutaChecklist`) ya estaban hechas. El backlog se corrigió para
reflejarlo, con cita de función/línea.

**Construido esta sesión — D-1 (pestañas Ruta/Comparar/Contratos)**: Ruta y Comparar no se
fusionaron ni se tocó una línea de su DOM interno (los tests V3-3/V3-4/V3-5/V1-3/V6 siguen
intactos y en verde) — se enlazan como pestañas reales (`<a href="#...">`, no botones con JS)
reutilizando tal cual la clase `.e19-registrar-tab`/`.e19-registrar-tabs` de Registrar/Plan (regla
transversal 01: ninguna barra de pestañas nueva). Cada pantalla sigue siendo su propio
`view-section` con su propio hash; solo se añadió un `<nav>` vacío al principio de cada una,
poblado por `renderDeudaScreenTabs()` al pintarse.

**Construido esta sesión — D-2 (contratos como dato canónico editable)**: pantalla nueva
`#deuda-contratos`, la primera puerta de escritura real de `DEBT_PORTFOLIO` en toda la app —
hasta ahora era una constante del código sin ningún mecanismo para corregirla (comentario
explícito que lo decía en `app.js`, ahora corregido). Solo tres campos editables: capital
pendiente, TAE y cuota — no entidad, tipo ni estado, que siguen siendo los declarados. Los
ajustes viven en `debtContractOverrides`, persistidos exactamente como `movementMappings`/
`rowLabelOverrides` (misma carga/guardado/`localStorage`, incluidos en el payload de
sincronización remota con su propia etiqueta canónica «Contrato de deuda») y se combinan con
`DEBT_PORTFOLIO` dentro de `debtContractBundle()` — el único punto por el que ya pasaban Ruta,
Comparar, Hoy (`homeDebtOutlook`) y el motor de escenarios, así que un contrato corregido se ve
en todas partes sin tocar ninguna otra función. Vaciar una celda no escribe un cero: borra el
ajuste y la celda vuelve a mostrar el valor declarado (regla transversal 04) — verificado en vivo
con Playwright, no solo en test.

**Verificación visual con Playwright**: navegación a `#deuda-contratos` mostró la barra
Ruta/Comparar/Contratos y las tres filas de la cartera demo con sus inputs; editar el capital
pendiente de un contrato a 1234,56 € actualizó la nota («1 de 3 contrato(s) con... corregidos»),
añadió la insignia «Editado» a esa fila y persistió en `localStorage` bajo la clave con el prefijo
del usuario; vaciar esa misma celda la devolvió a 6000 (el valor declarado), no a 0.

**Deliberadamente fuera de esta sesión, con motivo explícito** (detalle completo en la nota del
backlog): D-2b (bloqueada por Cierre, que no existe), D-4/D-5/D-6 (calendario de amortización y
migrar los ocho modos heredados de `#debt-control`, las tres tallas L que quedaban, sesión propia
como M-8/M-8b), D-10/D-11/D-13 (ampliaciones concretas sobre lo que ya existe: caducidad activa
de una oferta, coste marginal por mes de demora, guardar comparación sin aplicar), D-12
(capacidad de endeudamiento — no hay todavía una cifra canónica de ingreso mensual del hogar para
un ratio defendible) y D-14, que tal como está escrita («retirar» las heredadas) choca con T-4,
una decisión de producto ya tomada y bloqueada a propósito — las tres heredadas de Deuda ya están
relegadas desde el 10 de agosto (V3-5), que es el trato que ha recibido cada heredada migrada
hasta ahora.

**Pruebas nuevas**: `tests/d1-d2-deuda-tabs-contratos.test.cjs` (31 pruebas) — orden y pintado de
las pestañas, combinación de overrides sobre `DEBT_PORTFOLIO`, validación de la celda (vacío ≠
cero, negativos rechazados, TAE tope 60%, coma decimal), escritura y borrado del override,
insignia «Editado», persistencia con el mismo patrón que `movementMappings`, y el shell offline
versionado. Se ajustó `tests/navigation-structure.test.cjs` (el menú avanzado gana un enlace,
`#deuda-contratos`).

**Validación** (`npm run verify`, exit 0): **824/824 pruebas** (793 + 31 nuevas), **671 IDs
únicos** de accesibilidad, diff 10.000 filas en **37,0 ms**, forecast y escenarios en **193,0 ms**,
recursos **1381 KB**, build del sitio, privacidad y smoke test en verde.

**Publicado en el camino**: PR #44 (Plan · Mes) tenía el CI en verde; se fusionó a `main` al
arrancar esta sesión, según la autorización permanente de `CLAUDE.md`.

**Pendiente de publicar**: rama `claude/finanzas-casa-workflow-r11-jkz5z0` (reiniciada desde
`main` tras la fusión anterior), commit y PR en borrador según lo autorizado en `CLAUDE.md`.

## Cierre de sesión — 15 de agosto de 2026: Plan · Mes (P-1 a P-7) — Fase 2 completa salvo el lote

Continuación directa del cierre anterior del mismo día (Movimientos, fusionado como PR #43). El
usuario pidió seguir con la pestaña Mes de Plan, cerrando así toda la Fase 2 del backlog «Nueve
pantallas» salvo la selección múltiple en lote de Movimientos (M-8/M-8b, con su propia sesión) y
M-8c (bloqueada por Cierre, que no existe todavía).

**Decisión de arquitectura**: pantalla nueva `#plan`, junto a `#cuadro-mandos` (que sigue intacta y
accesible desde «Herramientas avanzadas»), no en su lugar — el mismo patrón que Registrar usó con
`#update-data`. El enlace de menú «Plan» pasa a apuntar a `#plan` en vez de a `#cuadro-mandos`
directamente. Solo la pestaña «Mes» tiene contenido propio esta sesión; «Previsión» y «Ahorro»
enlazan de vuelta a `#prevision`/`#savings-plan` hasta que se construyan (P-8 en adelante son Fase
4, no Fase 2).

**Qué se construyó**:
- **P-1 · armazón de tres pestañas**: migajas «Plan › <pestaña>», mismo patrón `data-plan-tab` que
  ya usaba Registrar con `data-registrar-tab`.
- **P-2/P-3 · tabla del mes por bloques, previsto editable**: una fila por partida (Bloque,
  Concepto, Previsto, Usado, Desviación), agrupada en dos tarjetas (Ingresos/Gastos) igual que la
  pestaña Reales del mes de Registrar. El previsto se edita aquí y **no se guarda al salir de la
  casilla** — a diferencia de la regla de Registrar (R-6), aquí se acumula como borrador de sesión:
  reutiliza tal cual `visualDraftCells`/`cuadroMandosStageCell`, el mismo motor que `#cuadro-mandos`
  usa desde E11 (regla transversal 01). Un cambio en Plan aparece también en Cuadro de mandos y en
  Cambios pendientes sin duplicar nada.
- **P-4 · gastado con procedencia**: la celda «Usado» muestra el real cuando existe y, si no, el
  previsto en borrador — y lo etiqueta («real»/«previsto») en vez de dejarlo ambiguo (regla
  transversal 05).
- **P-5 · techo de asignación**: una lectura, no un bloqueo — si el previsto de gastos supera el de
  ingresos del mes, la tarjeta correspondiente se pinta en aviso.
- **P-6 · pie de impacto compartido con Registrar**: mismo componente `.e19-impact-bar` que ya usa
  Registrar (R-7), mismo cálculo de antes/después que ya tenía Cuadro de mandos (`cuadroMandosImpact`,
  sobre los mismos borradores). Las cuatro cifras son las que de verdad se mueven al editar previsto
  —mínimo de liquidez del horizonte, meses bajo la reserva, liquidez al final, peor mes— y no las
  cuatro de Registrar (reserva actual, cobertura, fecha libre de deuda), que dependen de saldo y
  deuda y no se mueven al tocar un previsto futuro. «Guardar cambios»/«Descartar todo» son
  literalmente `saveVisualChanges`/`discardVisualChanges`, las mismas que ya usaba `#visual-detail`.
- **P-7 · copiar el previsto del mes anterior**: solo copia las partidas donde el previsto realmente
  difiere, y lo hace con el mismo `cuadroMandosStageCell` que una edición manual — se revisa en el
  pie de impacto antes de guardar, nunca se escribe directo.

**Verificación visual con Playwright** (datos reales de la demo, ya cargados por defecto —a
diferencia de Movimientos, `baseData.monthlyPlanning` no depende de una importación): edición de un
previsto de ingresos (+100 €) recalculó en vivo el KPI de techo de asignación y mostró el pie de
impacto con las cuatro cifras correctas; el mismo borrador apareció al navegar a `#cuadro-mandos` y
viceversa; «Guardar cambios» persistió el valor y ocultó el pie; una edición posterior descartada
volvió exactamente al último valor guardado (no al original ni a un intermedio); las pestañas
Previsión y Ahorro mostraron su aviso con enlace a la heredada correspondiente.

**Pruebas nuevas**: `tests/p1-p7-plan-mes.test.cjs` (26 pruebas) — armazón y migajas, cambio de
pestaña, previsto draft-aware con y sin real, techo de asignación, fila sin borrado y deshabilitada
en mes cerrado, procedencia del usado, guarda de mes cerrado en el manejador de escritura, vaciar
la casilla como 0, candidatos de copia solo donde cambia, confirmación de copia vía
`cuadroMandosStageCell`, las cuatro ramas del pie de impacto (oculto/error/completo/cálculo
correcto) y el cableado completo. Se ajustaron `tests/e17-interface.test.cjs`,
`tests/t1-seis-vistas.test.cjs` (el enlace «Plan» del menú ahora es `#plan`) y un comentario
desactualizado en `tests/v2-8-relegar-plan.test.cjs`.

**Validación** (`npm run verify`, exit 0): **793/793 pruebas** (767 + 26 nuevas), **665 IDs
únicos** de accesibilidad, diff 10.000 filas en **39,6 ms**, forecast y escenarios en **191,4 ms**,
recursos **1373 KB**, build del sitio, privacidad y smoke test en verde.

**Publicado en el camino**: PR #43 (Movimientos, M-1 a M-11 salvo lote) tenía el CI en verde; se
fusionó a `main` al arrancar esta sesión, según la autorización permanente de `CLAUDE.md`.

**Pendiente de publicar**: rama `claude/finanzas-casa-workflow-r11-jkz5z0` (reiniciada desde `main`
tras cada fusión previa), commit y PR en borrador según lo autorizado en `CLAUDE.md`. Con esto la
Fase 2 del backlog «Nueve pantallas» queda completa salvo M-8/M-8b (lote de Movimientos, sesión
propia) y M-8c (bloqueada por Cierre). Siguiente: Fase 3 (Deuda) o cerrar el lote de Movimientos,
a decidir con el usuario.

## Cierre de sesión — 15 de agosto de 2026: Movimientos completa (M-1 a M-11 salvo lote)

Continuación directa del cierre anterior del mismo día (R-11). Con la Fase 2 de Registrar
cerrada, el usuario pidió seguir con Movimientos y la pestaña Mes de Plan. Se abordó primero
Movimientos como unidad completa.

**Qué se construyó**: `#movements` se evoluciona en el mismo sitio, no al lado — el enlace de
menú «Movimientos» ya apuntaba aquí desde la Fase 3 (menú compartido), así que no hay una
heredada que adoptar o sustituir, solo contenido pendiente de completar. La tarjeta de
importación por Excel y la lista de comercios de arriba de la tabla no se tocaron.

- **M-1 · migajas**: «Movimientos › Extracto real» sobre la tabla, con el mismo estilo
  (`e19-registrar-crumb`) que ya usaba Registrar.
- **M-2/M-11 · tabla ampliada, importes de solo lectura**: se añaden dos columnas (Partida y un
  botón «Ver») a la tabla heredada; los importes siguen siendo texto plano, nunca un `<input>`.
- **M-3 · filtros**: rango de fechas (Desde/Hasta) además del mes y la búsqueda que ya existían.
- **M-4 · marca sin partida**: `movementPartidaBadge` lee `mappingForMovement` (el mismo
  diccionario que ya usan `#datos-importar` y `#data-entry`) y pinta «Sin partida» en vez de
  fabricar una clasificación — regla transversal 04.
- **M-5 · aviso de cola sin clasificar**: cuenta sobre la misma vista filtrada que pinta la
  tabla, nunca sobre el extracto completo.
- **M-6 · panel de detalle**: diálogo nativo (mismo patrón que `unifiedActionDialog`) con los ocho
  campos del movimiento. Sin id estable en los movimientos importados, la fila se identifica por
  su posición en la lista filtrada recalculada en el momento del clic, no por un id inventado.
- **M-7 · cambio de partida con regla**: reutiliza tal cual el diccionario `movementMappings` y el
  camino de escritura de `applyPendingMovementMappings` (regla transversal 01) — reclasificar
  desde el panel es la misma regla persistente por concepto que ya aplicaba el importador, nunca
  una segunda puerta. El panel lo deja explícito: «se aplicará a todos los movimientos con el
  mismo concepto, incluidos los futuros».
- **M-9 · totales**: ingresos, gastos y neto de la vista filtrada, recalculados del mismo
  `filtered` que pinta la tabla.
- **M-10 · exportar**: CSV de exactamente la vista filtrada (con la partida ya resuelta), no del
  extracto completo — mismo patrón `csvValue`/`Blob` que ya usaba la exportación de escenarios.

**Deliberadamente fuera de esta sesión**: M-8/M-8b (selección múltiple y acción en lote, talla L,
depende de R-7 y R-8) queda para una sesión propia, igual que R-8/R-9 la tuvieron en Registrar.
M-8c depende de Cierre (Fase 5), que todavía no existe — queda bloqueada, no pendiente por omisión.

**Pruebas nuevas**: `tests/m1-m11-movimientos.test.cjs` (22 pruebas) — migajas, columna Partida,
ausencia de `<input>` en la tabla, badge sin partida/con partida, filtro por mes/rango de
fechas/búsqueda, aviso de cola sobre la vista filtrada, apertura/cierre del panel de detalle por
índice de la lista filtrada, reclasificación con y sin partida elegida (mismo diccionario que el
importador), totales de ingresos/gastos, exportación CSV de la vista filtrada, y el cableado de
los nuevos controles.

**Validación** (`npm run verify`, exit 0): **767/767 pruebas** (745 + 22 nuevas), **658 IDs
únicos** de accesibilidad, diff 10.000 filas en **38,9 ms**, forecast y escenarios en **327,9 ms**,
recursos **1357 KB**, build del sitio, privacidad y smoke test en verde. Verificación visual con
Playwright (datos sintéticos inyectados, ya que la sesión no tiene un extracto real cargado):
migajas, filtros con rango de fechas, aviso de cola sin clasificar en tres movimientos, tabla con
badges de partida, apertura del panel de detalle al pulsar «Ver», y reclasificación de un ingreso
— el aviso bajó de 3 a 2 movimientos sin partida y el «Diccionario activo» de la tarjeta de
importación (arriba, sin tocar) se actualizó igual, confirmando la puerta de escritura única.

**Pendiente de publicar**: rama `claude/finanzas-casa-workflow-r11-jkz5z0` (reiniciada desde
`main` tras fusionarse R-11), commit y PR en borrador según lo autorizado en `CLAUDE.md`. Sigue
la pestaña Mes de Plan en esta misma sesión.

## Cierre de sesión — 15 de agosto de 2026: R-11, cierre de escritura de las heredadas de Registrar

Continuación directa del cierre anterior del mismo día (R-8, R-9, R-10 parcial, R-12), fusionado
entre tanto a `main` como PR #41. El usuario pidió seguir con R-11 y con la decisión pendiente
sobre `#registrar-mes`, dejando claro que ambas necesitaban su confirmación explícita antes de
tocar nada — tal y como pedía `CLAUDE.md` para retirar capacidad de escritura de una pantalla en
uso. Se le presentaron cuatro opciones (redirigir `#registrar-mes` también, mantenerla accesible
pero de solo lectura, dejarla intacta, o cerrar solo las otras cuatro) y eligió la segunda, con la
condición explícita de que cumpliera exactamente el criterio de R-11 y de la regla transversal 01
(«la heredada pierde su capacidad de escribir, no desaparece»), sin ir más allá.

**Qué se encontró al investigar el alcance real de R-11**: el hash router (`viewFromHash`) ya
redirigía `#update-hub`, `#update-data`, `#datos-importar` y `#data-entry` a Registrar desde R-10,
pero `setActiveView` solo aplicaba esa redirección cuando se llegaba a través del hash. Los clics
del menú lateral y los botones `data-home-nav` (que existen en varios sitios: la cabecera, las
tarjetas de ruta de Hoy) llaman a `setActiveView` con el id heredado directamente, sin pasar antes
por el hash, así que hasta ahora seguían abriendo la pantalla vieja, plenamente editable — R-10
quedaba resuelto solo a medias en la práctica.

**Qué se construyó**:
1. `setActiveView` normaliza ahora el id heredado explícito (`REGISTRAR_LEGACY_HASH_TABS[viewId]`)
   antes de decidir cualquier otra cosa, así que ninguna vía de navegación —hash, clic de menú o
   botón `data-home-nav`— deja ya una de las cuatro heredadas como destino final. No se tocó
   ningún enlace de `index.html`: todos siguen apuntando a los hashes de siempre, y ahora todos
   redirigen de verdad.
2. `#registrar-mes` pasa a solo lectura mediante la constante `REGISTRAR_MES_LEGACY_READONLY`
   (siempre `true`): el real editable se deshabilita, no se ofrece alta ni baja de partidas
   personalizadas, ni copiar el mes anterior, ni confirmar el aviso «¿es anual?» — las cuatro
   acciones que escriben. Cada tarjeta explica el porqué con un enlace `data-home-nav="registrar"`
   a Registrar › Reales del mes. Los siete manejadores de escritura llevan además su propia
   guarda, mismo patrón que ya usaban con el mes cerrado: la escritura es imposible aunque se
   llame a la función a mano, no solo inalcanzable desde la interfaz. La pantalla sigue en el
   menú, sigue en `index.html`, sigue mostrando sus KPI — la promesa de la sesión de R-5 de que
   seguiría accesible desde «Herramientas avanzadas» se mantiene tal cual.

**Pruebas nuevas**: `tests/r11-cierre-escritura-heredadas.test.cjs` (16 pruebas) — la redirección
por id explícito en `setActiveView`, que las cuatro heredadas conservan su código en
`index.html`, que la fila de `#registrar-mes` deshabilita el real y oculta el botón de quitar
aunque el mes esté abierto, que el aviso «¿es anual?» ni se evalúa ni se pinta, que el pie de cada
tarjeta remite a Registrar, y que los siete manejadores de escritura no hacen nada en solo
lectura. Se ajustaron `tests/r10-redireccion-hashes.test.cjs` (la fuente de `setActiveView` cambió
de forma) y `tests/v4-3-v4-5-partida-anual.test.cjs` (el manejador del aviso anual ahora se guarda
tras la constante de solo lectura; se añadieron casos para los dos caminos).

**Validación** (`npm run verify`, exit 0): **745/745 pruebas** (729 + 16 nuevas), **649 IDs
únicos** de accesibilidad, diff 10.000 filas en **39,0 ms**, forecast y escenarios en **182,7 ms**,
recursos **1347 KB**, build del sitio, privacidad y smoke test en verde.

**Publicado en el camino**: PR #41 (R-8, R-9, R-10 parcial, R-12) tenía el CI en verde y sin
conflictos desde antes de empezar esta sesión — se marcó listo y se fusionó a `main` al arrancar,
según la autorización permanente de `CLAUDE.md`, para poder trabajar R-11 sobre una base al día.

**Pendiente de publicar**: rama `claude/finanzas-casa-workflow-r11-jkz5z0`, commit y PR en
borrador según lo autorizado en `CLAUDE.md`. Con R-11 cerrado, la Fase 2 (Registrar) queda
completa (R-1 a R-12); queda la parte de Fase 2 que vive en Movimientos y en la pestaña Mes de
Plan, y las fases 3-7 del backlog «Nueve pantallas», para sesiones posteriores.

## Cierre de sesión — 15 de agosto de 2026: Registrar completa Importar extracto, Lote y Excel, redirecciones y una prueba pendiente (R-8, R-9, R-10 parcial, R-12)

Continuación directa del cierre anterior (R-6/R-6b/R-7, fusionado a `main`). Antes de programar,
se revisó el backlog «Nueve pantallas» (124 tareas, 9 pantallas, 7 fases) que hasta ahora solo
vivía como artifact de claude.ai — se guardó una copia operativa en
`docs/BACKLOG_NUEVE_PANTALLAS.md` para que futuras sesiones no dependan de un enlace externo. El
usuario aprobó el orden propuesto (R-10 → R-12 → R-9 → R-8, con R-11 aparte) y pidió acometerlo
hasta el final; R-10 se reordenó al final en la práctica porque su alcance seguro solo quedó claro
una vez Registrar tuvo tabs reales que sustituir.

**R-12 · distinción vacío/cero, verificada donde faltaba**: la lógica ya era correcta
(`actualAwareInfo`: clave ausente → «sin real», usado toma el previsto; clave con `0` explícito →
«ocurrió por cero», usado es 0), pero no había una prueba directa sobre el campo `used` derivado
de `registrarMesCollect`. `tests/r12-vacio-vs-cero.test.cjs` (4 pruebas) la añade.

**R-9 · pestaña «Lote y Excel»**: pegar tabla, subir o arrastrar un fichero (el primer arrastre
real de toda la app — `#data-entry` nunca lo tuvo, solo un `<input type=file>` disfrazado) y
plantilla CSV descargable. No es una segunda puerta de escritura (regla transversal 01):
`stageE7Import`/`stageE7Workbook`/`showImportLog` se parametrizaron con un `target` («data» por
defecto, sin cambiar nada para `#data-entry`; «registrar» para el destino nuevo), así que ambas
pantallas comparten el mismo motor de comparación E7, la misma bandeja E11b y el mismo
`processDataRecords`/`applyImportedWorkbookData`. `#data-entry` sigue intacta, con sus propios
controles y sin tocar.

**R-8 · pestaña «Importar extracto»**: el asistente heredado de cuatro pasos (cargar, clasificar,
resolver duplicados, confirmar) de `#datos-importar`, no una copia. `datosImportarSession` sigue
siendo la única fuente de verdad; todas las funciones del asistente (una quincena, del paso 1 al
4, más la barra de navegación) pasaron a leer sus ids de `datosImportarTarget()`, que decide entre
los ids de `#datos-importar` o los nuevos de Registrar según `activeViewId` — incluidos los
botones que el asistente inyecta dinámicamente (confirmar, cambiar de fichero...), para que nunca
convivan dos elementos con el mismo id. `#datos-importar` sigue intacta y accesible por su cuenta.

**R-10 · redirección de hashes, parcial a propósito**: su criterio pide redirigir cinco hashes
heredados a la pestaña equivalente de Registrar. Se redirigieron cuatro —`#update-hub`,
`#update-data`, `#datos-importar`, `#data-entry`— porque ninguno tenía una promesa de
accesibilidad propia: R-2 solo los citaba como destino «mientras tanto» de las pestañas de
Registrar sin construir, provisionalidad que R-8/R-9 ya resolvieron. `#registrar-mes` se dejó
**fuera**: la sesión de R-5 prometió explícitamente en este mismo documento que seguiría intacta y
accesible desde «Herramientas avanzadas», y redirigir su hash la habría dejado inalcanzable por
navegación sin que el usuario lo confirmara — el mismo tipo de decisión que ya hizo falta acotar
en R-6. Se deja agrupada con R-11 para una consulta conjunta, porque ambas tratan en el fondo la
misma pregunta: cuánto se cierra el acceso directo a las heredadas de Registrar. Ninguna de las
cinco pantallas heredadas perdió código ni funcionalidad; solo cambió a qué destino apunta cada
hash.

**Pruebas nuevas**: `tests/r9-registrar-lote-excel.test.cjs` (13), `tests/r8-registrar-importar-extracto.test.cjs`
(14), `tests/r10-redireccion-hashes.test.cjs` (10), `tests/r12-vacio-vs-cero.test.cjs` (4) — 41
pruebas nuevas en total. Se ajustaron `tests/r1-r4-registrar.test.cjs` y
`tests/r6-r6b-r7-registrar.test.cjs`: las aserciones que comprobaban que Importar/Lote seguían
enlazando a la heredada (ciertas mientras R-8/R-9 no existían) se sustituyeron por las que
comprueban que ahora tienen contenido propio sin fabricar un segundo motor.

**Validación** (`npm run verify`, exit 0): **727/727 pruebas** (684 de partida + 41 nuevas de los
cuatro ficheros de arriba + 2 netas por el ajuste de las pruebas existentes), **649 IDs únicos**
de accesibilidad, diff 10.000 filas en **47,5 ms**, forecast y escenarios en **254,7 ms**,
recursos **1345 KB**, build del sitio, privacidad y smoke test en
verde.

**Pendiente de publicar**: rama `claude/finanzas-casa-workflow-plan-vtp087`, commit y PR en
borrador según lo autorizado en `CLAUDE.md`. Queda **R-11** (cierre de escritura de las
heredadas) y la decisión sobre redirigir `#registrar-mes` para una consulta explícita con el
usuario antes de tocarlas; después, Fase 2 sigue con las piezas de Movimientos y de la pestaña Mes
de Plan que también forman parte de ella según `docs/BACKLOG_NUEVE_PANTALLAS.md`.

## Cierre de sesión — 15 de agosto de 2026: regla de guardado, previsto solo en Plan y pie de impacto (R-6, R-6b, R-7)

Continuación directa del cierre anterior (R-5, fusionado a `main`). El usuario pidió seguir con
R-6, R-6b y R-7. R-6 tenía una ambigüedad real: su criterio de aceptación menciona «se retiran las
reglas de confirmar por bloque e incorporar en lote fuera de las pestañas de importación», que
apunta a dos mecanismos de pantallas heredadas fuera de Registrar (el panel «Guardar
cambios/Descartar» de Cuadro de mandos y la carga por lote de Datos). Retirar la escritura de una
pantalla en uso se consulta siempre según `CLAUDE.md`, así que se preguntó antes de tocar nada: el
usuario eligió acotar R-6 a lo que ya pasa **dentro** de Registrar, sin retirar nada de las
heredadas.

**R-6 · una sola regla de guardado (acotada a Registrar)**: Saldo de cuentas (R-3) y Reales del mes
(R-5) ya guardaban al salir de la casilla sin paso de confirmar — R-6 no cambia ese
comportamiento, lo deja fijado con pruebas nuevas que comprueban que ninguna de las dos pestañas
tiene un botón de confirmar por bloque y que Importar/Lote siguen enlazando a la heredada en vez de
fabricar una incorporación en lote propia. El panel de Cuadro de mandos y la carga por lote de
Datos quedan intactos, con una prueba que lo deja constatado.

**R-6b · el previsto solo se edita en Plan**: la celda de previsto de Reales del mes ya era de solo
lectura (heredado de R-5); lo nuevo es el enlace «Ver en Plan» en cada fila, que navega a Plan
(`#cuadro-mandos`) con el mismo patrón `data-home-nav` que usa el resto de la aplicación. Una
prueba comprueba que `handleRegistrarActualsChange` nunca escribe en `planned`.

**R-7 · pie de impacto de la sesión**: aparece con el primer cambio (de saldo o de un real) desde
que se abrió Registrar o desde el último consolidar/descartar, y se queda visible al cambiar de
pestaña (vive fuera de las cuatro `data-registrar-panel`, como `<aside>` propio con
`position:sticky`). Reutiliza el componente `.e19-impact-bar` que ya usaba el pie de impacto de
Plan (cuadro-mandos-impact) y las mismas fuentes que la tarjeta de R-4
(`unifiedActionCenterModel`/`homeDebtOutlook`/`FinanceCanonicalCushion.worstMonthOf`) — no hay un
segundo motor de cálculo. Las cuatro cifras son de la sesión completa (delta desde la foto tomada
antes del primer cambio, no desde la última casilla tocada): reserva sobre el mínimo (liquidez
menos la reserva protegida — la única que de verdad se mueve al editar saldo), cobertura hasta el
siguiente ingreso, fecha libre de deuda y peor mes del horizonte. Como Registrar guarda al salir de
la casilla (R-6), «Descartar todo» no descarta cambios sin guardar — revierte cada casilla tocada a
su valor anterior a la sesión por los mismos caminos de escritura que el guardado normal
(`setStateAccountBalances`/`actualsForKind`), y «Guardar cambios» simplemente cierra el
seguimiento y dejar una nota de dos segundos. Si la reserva sobre el mínimo queda en negativo, esa
cifra se pinta en aviso (fondo del pie en rojo) y «Guardar cambios» pide una confirmación explícita
antes de cerrar la sesión.

**Pruebas nuevas**: `tests/r6-r6b-r7-registrar.test.cjs` (17 pruebas) — guardado por `change` en
las dos pestañas, ausencia de confirmar por bloque, Importar/Lote sin incorporación propia, panel
de Cuadro de mandos intacto, previsto de solo lectura, enlace a Plan, las cuatro cifras del pie
leídas de los mismos motores que R-4, el pie oculto sin cambios, que solo se registra el primer
valor anterior de cada casilla en la sesión (no el más reciente), el aviso de reserva bajo mínimo,
que consolidar sin cambios pendientes no hace nada, que consolidar con la reserva bajo mínimo pide
confirmación y respeta un «cancelar», que el pie vive fuera de las pestañas, y el cableado de
Descartar/Guardar. Se ajustaron `tests/r1-r4-registrar.test.cjs` (las dos funciones de guardado de
saldo ahora también registran el cambio de sesión y refrescan el pie de impacto) y
`tests/r5-registrar-reales.test.cjs` (tres pruebas de `handleRegistrarActualsChange` necesitaban
`registrarRecordSessionChange` como mock).

**Validación** (`npm run verify`, exit 0): **684/684 pruebas** (667 + 17 nuevas), **636 IDs
únicos** de accesibilidad, diff 10.000 filas en **38,8 ms**, forecast y escenarios en **200,6 ms**,
recursos **1336 KB**, build del sitio, privacidad y smoke test en verde. Verificación visual con
Playwright: editar el saldo de CaixaBank hasta bajar de la reserva muestra el pie de impacto en
aviso con las cuatro cifras y el delta de la sesión; «Descartar todo» devuelve el saldo exacto y
oculta el pie; en Reales del mes, la celda de previsto no tiene ningún `<input>` y el enlace «Ver en
Plan» navega a `#cuadro-mandos`; editar un real también dispara el pie de impacto (persiste al
cambiar de pestaña); «Guardar cambios» deja la nota de consolidado y el pie se oculta a los dos
segundos. Sin errores de consola atribuibles a los cambios (los dos avisos de red observados
aparecen igual en Hoy sin tocar Registrar, ruido del sandbox).

**Pendiente de publicar**: rama `claude/finanzas-casa-workflow-missing-hudou6`, commit y PR en
borrador según lo autorizado en `CLAUDE.md`. Queda R-8/R-9/R-10 (Importar extracto, Lote y Excel,
redirección de hashes) para una sesión posterior.

## Cierre de sesión — 14 de agosto de 2026: pestaña Reales del mes en Registrar (R-5)

Continuación directa del cierre anterior del mismo día (R-1 a R-4). Con el PR de los cimientos
fusionado, el usuario pidió seguir con R-5 en cuanto estuviera en `main`.

**Qué se construyó**: la pestaña «Reales del mes» de Registrar — tabla única (ingresos + gastos,
antes repartidos en dos tarjetas separadas en la heredada `#registrar-mes`) con real editable,
previsto de solo lectura, usado derivado, desviación, columna **Estado** (Sin real/Registrado/A
favor/Desviación) y **fila de totales** — ninguna de las dos existía en la heredada. Selector de
mes (incluye meses cerrados, marcados «· cerrado») y **filtro por bloque** (Ingresos, Gastos
fijos...), distinto del filtro por estado que ya tenía `#registrar-mes`.

**Una sola puerta de escritura (regla transversal 01), no una segunda tabla con su propio
guardado**: reutiliza tal cual `registrarMesCollect()` (el modelo de datos de `#registrar-mes`,
sin tocarlo) y `actualsForKind()`/`saveActualsForKind()` (el mismo almacén que ya escribía
`#registrar-mes` y `#update-data`) — un real guardado en cualquiera de las tres pantallas aparece
en las demás sin migrar nada. La pantalla heredada `#registrar-mes` sigue intacta y accesible
desde «Herramientas avanzadas»; no se le retiró nada.

La insignia de la pestaña en el armazón de R-2 pasa de mostrar «—» (dato ausente, pestaña sin
construir) a un recuento real: "N sin real" o "Al día" si no falta ninguno — nunca un "0 sin real"
fabricado, sigue la regla transversal 04 igual que el resto de Registrar.

**Pruebas nuevas**: `tests/r5-registrar-reales.test.cjs` (14 pruebas) — estructura de la pestaña
(columnas, mes, filtro, totales), que el real editable escribe en el mismo almacén que
`#registrar-mes` y respeta el mes cerrado, que vaciar un real lo borra (no lo pone a 0) y que
escribir un 0 explícito sí se guarda, las cuatro combinaciones de Estado, la deduplicación de
bloques, que la fila de totales no fabrica una desviación sobre partidas sin real, y la insignia
«Al día» sin cero fabricado. Se ajustó `tests/r1-r4-registrar.test.cjs`: la prueba que verificaba
que la pestaña de Reales mostraba «—» ya no aplica (R-5 la construyó); se sustituyó por una que
sigue cubriendo Importar/Lote.

**Validación** (`npm run verify`, exit 0): **667/667 pruebas**, **635 IDs únicos** de
accesibilidad, diff 10.000 filas en **46,9 ms**, forecast y escenarios en **250,0 ms**, recursos
**1326 KB**, build del sitio, privacidad y smoke test en verde. Verificación visual con Playwright
en la pestaña Reales del mes: filtro por bloque con recuentos reales, guardado de un real con
recálculo inmediato de Usado/Desviación/Estado y de la insignia de la pestaña, mes cerrado con
inputs deshabilitados y aviso, fila de totales, sin errores de consola.

**Pendiente de publicar**: rama `claude/finanzas-casa-workflow-missing-hudou6`, commit y PR en
borrador según lo autorizado en `CLAUDE.md`.

## Cierre de sesión — 14 de agosto de 2026: Registrar arranca — cabecera, cuatro pestañas y Saldo de cuentas (R-1 a R-4)

Continuación directa del cierre anterior del mismo día (menú compartido). Con R-2 ya desbloqueada,
el usuario eligió seguir con Registrar y acotó el alcance a los cimientos: R-1 a R-4, dejando
R-5/R-6/R-6b/R-7/R-8/R-9/R-10 (Reales del mes, regla de guardado, pie de impacto, Importar
extracto, Lote y Excel, redirección de hashes) para una sesión posterior.

**Qué se construyó:**
- **R-1 · Cabecera de Registrar**: nueva sección `#registrar`, con eyebrow/título/subtítulo propios,
  fuente del libro + guía del flujo (`renderRegistrarHeaderMeta`) y la regla previsto/real/usado en
  tres celdas — no se repite en ninguna pestaña, tal como pide el criterio de aceptación. El título
  global de la vista (`viewTitles.registrar`) se redactó con texto propio, distinto al de la
  sección, para no duplicar literalmente la misma frase dos veces en la misma pantalla (se detectó
  visualmente con Playwright y se corrigió antes de publicar).
- **R-2 · Armazón de cuatro pestañas**: Saldo de cuentas, Reales del mes, Importar extracto y Lote y
  Excel, con migajas (`Registrar › <pestaña activa>`) e insignia de pendientes por pestaña. Solo
  Saldo de cuentas tiene contenido propio esta sesión; las otras tres enlazan de vuelta a su
  pantalla heredada (`update-data`, `datos-importar`, `data-entry`) en vez de fabricar un contenido
  que no existe todavía, y su insignia usa el mismo `HOME_MISSING_VALUE` ("—") de H-10 en lugar de
  un recuento inventado. Nuevo enlace de menú "Registrar" bajo "Día a día", entre Hoy y Movimientos.
- **R-3 · Pestaña Saldo de cuentas**: saldo por cuenta editable, fecha, modo, total liquidez y
  bloque de procedencia. Reutiliza exactamente el mismo estado que ya sincronizaba Cuadro de mandos
  (`accountBalancesFromState`, `balanceSettings`, `applyBalanceModeChange`) — los campos de
  Registrar son un espejo más añadido a los mismos arrays de sincronización
  (`renderAccountBalancePanels`, `updateBalanceModeUi`) y los mismos manejadores de guardado
  (`handleVisualBalanceControlChange`, `handleVisualAccountBalanceInput`), no una segunda puerta de
  escritura (regla transversal 01). El delta "frente al guardado por cuenta" es nuevo: una foto del
  saldo ya persistido que se retoma en cada guardado (`resetRegistrarBalanceBaseline`) y se compara
  en vivo contra lo tecleado (`renderRegistrarBalanceDelta`), sin guardar nada por su cuenta.
- **R-4 · Tarjeta "qué se recalcula al guardar"**: reserva protegida, cobertura hasta el siguiente
  ingreso, fecha libre de deuda y peor mes del horizonte, siempre visibles (no solo al editar).
  Reutiliza `unifiedActionCenterModel()` y `homeDebtOutlook()` (ya usados en Hoy) más
  `FinanceCanonicalCushion.worstMonthOf()` sobre el horizonte completo — sin recalcular nada por su
  cuenta. Cobertura y peor mes muestran "—" en vez de un cero fabricado cuando no son calculables.

**Pruebas nuevas**: `tests/r1-r4-registrar.test.cjs` (14 pruebas) — estructura del menú y las cuatro
pestañas, despacho de la vista, que los campos de saldo son un espejo del mismo estado y no una
segunda puerta de escritura, el delta frente al guardado (incluida la fabricación cero cuando el
campo no es numérico), la insignia "—" de las pestañas sin construir, y las cuatro cifras de la
tarjeta de recálculo con y sin datos disponibles.

**Validación** (`npm run verify`, exit 0): **653/653 pruebas**, **629 IDs únicos** de accesibilidad,
diff 10.000 filas en **59,8 ms**, forecast y escenarios en **246,0 ms**, recursos **1319 KB**, build
del sitio, privacidad y smoke test en verde. Verificación visual con Playwright en `#registrar`:
cabecera sin título duplicado, tira de estado (H-8) visible, tarjeta de recálculo con cifras reales,
cambio de modo auto→manual con delta en vivo por cuenta que vuelve a "Sin cambios" tras guardar, y
cambio de pestaña con migajas y enlace de vuelta a la heredada funcionando sin errores de consola.

**Pendiente de publicar**: rama `claude/finanzas-casa-workflow-missing-hudou6`, commit y PR en
borrador según lo autorizado en `CLAUDE.md`.

## Cierre de sesión — 14 de agosto de 2026: menú compartido de las nueve pantallas, cierra H-2/H-8

Continuación directa del cierre anterior del mismo día. Al preguntar cómo seguir tras fusionar la
nueva Hoy, se detectó que **cuatro tareas** (no solo H-2/H-8) dependían de un menú compartido entre
las nueve pantallas que no existe: H-2, H-8, **R-2** (armazón de pestañas de Registrar) y **M-1**
(entrada de menú de Movimientos) — y M-1 bloquea transitivamente casi toda la cadena de Movimientos
(M-2 a M-10). Revisado el documento técnico completo: **no hay tareas propias para el menú dentro de
las 124** — "Fase 3 · menú" es solo una etiqueta de dependencia sin desarrollo propio detrás. El
usuario eligió construirlo ahora, con el alcance propuesto y confirmado explícitamente:

1. Entrada de menú para Movimientos, bajo un nuevo grupo "Día a día" junto a Hoy.
2. Chip de sincronización (H-2), extendiendo el que ya existía en el topbar.
3. Tira de cuatro cifras (H-8) en la cabecera de las ocho vistas que no son Hoy — el usuario
   confirmó que fueran las mismas cuatro de la rejilla de Hoy (Liquidez, Deuda pendiente,
   Capacidad libre real, Reserva protegida), sin inventar una quinta fuente.

**Qué se construyó:**
- **Movimientos** se promueve de "Versiones anteriores" (heredada, relegada en V4-6 el 12 de
  agosto) a enlace principal bajo "Día a día", apuntando al mismo `#movements` de siempre — mismo
  patrón que Hoy: se promueve el hueco en el menú, el contenido heredado se reconstruye más
  adelante (M-2 en adelante), sin enlaces rotos.
- **Chip de sincronización**: se añadió `lastLocalSaveAt`, mostrado como "Guardado a las HH:MM"
  dentro del chip existente (`durabilityStatus`), más un `title` con el mismo texto de fuente que
  ya calculaba `updateSourceNote` — sin fabricar una segunda frase para lo mismo.
- **Tira de estado**: `topbarStatusFigures()` reutiliza exactamente las mismas llamadas que ya usan
  los primeros KPI de Hoy (`unifiedActionCenterModel()`, `homeDebtOutlook()`), sin una fórmula
  paralela; se pinta/oculta desde `setActiveView()`, ausente en `#home`.

**H-2 y H-8 pasan a Hecho.** R-2 y M-1 siguen `Pendiente` (no se construyó Registrar ni Movimientos
en sí esta sesión), pero ya no están bloqueadas por el menú.

**Ajuste de pruebas existentes**: `tests/navigation-structure.test.cjs` y
`tests/v4-6-relegar-datos.test.cjs` verificaban explícitamente que Movimientos se quedaba en
"Versiones anteriores" (V4-6, 12 de agosto) — se actualizaron para reflejar que M-1 (14 de agosto)
supera esa relegación a propósito, dejando constancia en el propio test de qué decisión reemplaza a
cuál.

**Validación** (`npm run verify`, exit 0): **639/639 pruebas**, **613 IDs únicos** de accesibilidad,
diff 10.000 filas en **31,4 ms**, forecast y escenarios en **166,7 ms**, recursos **1309 KB**, build
del sitio, privacidad y smoke test en verde. Verificación visual con Playwright en Hoy, Plan y
Movimientos: la tira de cuatro cifras aparece correctamente en Plan y Movimientos, está ausente en
Hoy, y el nuevo enlace de menú funciona sin errores de consola.

**Pendiente de publicar**: rama `claude/finanzas-casa-workflow-missing-hudou6`, commit y PR en
borrador según lo autorizado en `CLAUDE.md`.

## Cierre de sesión — 14 de agosto de 2026: la nueva Hoy (H-1 a H-10) sobre los cimientos de la Fase 1

Continuación directa del cierre anterior del mismo día: con los cimientos de la Fase 1 ya
publicados (canonical-cushion.js, deuda pendiente/fecha libre de deuda en el contrato ejecutivo),
el usuario pidió seguir con la nueva pantalla Hoy (H-1 a H-10 del backlog de nueve pantallas
publicado como Artifact la sesión anterior).

**Antes de tocar código**, se detectó que H-2 (chip de sincronización en la barra) y H-8 (tira de
cuatro cifras en la cabecera de las otras ocho vistas) dependen de un menú/topbar compartido entre
las nueve pantallas que todavía no existe — solo Hoy se está construyendo. El usuario eligió
**aplazarlas explícitamente a cuando exista ese menú** (probablemente Fase 3 en la numeración del
propio documento técnico), en vez de construir una versión parcial o inventar el menú antes de
tiempo. Con eso, la sesión cierra 9 de las 11 tareas: H-1, H-3, H-3b, H-4, H-5, H-6, H-7, H-9, H-10.

**Qué se construyó, tarea a tarea:**
- **H-9 (umbrales configurables)**: en vez de montar un panel nuevo en Ajustes, se localizó que el
  propio código ya documentaba la regla a seguir (nota V6-2: los umbrales tipo metric+threshold se
  resuelven con el framework de alertas existente, `UX_ALERT_METRICS`/`alerts-center`, no con un
  mecanismo nuevo). Se añadió `alertThresholdOverride(metricId)` y se cablearon a él los umbrales de
  «Deuda pendiente» y «Capacidad libre real», que además tenían un umbral duplicado y distinto
  (250 € hardcodeado en Hoy contra 500 € ya configurado en Ajustes › Alertas) — exactamente la
  duplicidad que la regla transversal 09 del backlog pide eliminar.
- **H-1 (cabecera)**: añadida una línea de estado agregado + fecha de análisis + fuente + guía bajo
  el subtítulo existente, sin tocar las tres frases que ya traía.
- **H-3/H-3b (cobertura)**: la lógica de datos ya existía casi entera (`executiveCoverageSnapshot`,
  `saveE6Coverage`/`resetE6Coverage`). Se dividió en dos tarjetas —una oscura con la cifra de días,
  insignia de confianza, margen y fecha; otra con el editor y su insignia de estado
  (requiere tu dato/aprendido/guardado)—, con previsualización en vivo al escribir (sin guardar) y
  el botón Guardar apagado si nada cambió.
- **H-4 (rejilla)**: insignia visible («Fuera de umbral»/«Cerca del umbral») además de la barra de
  color ya existente, ahora leyendo los umbrales de H-9.
- **H-5 (decisiones abiertas)**: «Lectura de hoy» pasa de una pila de tarjetas a una única banda con
  la lectura más urgente. Lo que antes se duplicaba ahí (deuda candidata, oferta abierta, proyectos
  en plan) compite ahora por un hueco en las «tres decisiones» junto con las alertas disparadas,
  ordenadas por caducidad real cuando existe (vencimiento de oferta, fecha de revisión de alerta) y
  por rango fijo cuando no. No se tocó `unifiedActionCenterModel`/`executiveActions` — las reutiliza
  también Asesor ejecutivo con su propio orden.
- **H-6 (mes en una línea)**: nuevo, con `p2MovementRows()` como única fuente (la misma que ya
  alimenta la cobertura): ingresos/gastos/margen/movimientos reales del mes, más las dos señales
  (sin clasificar, irá a ahorro con el ahorro previsto del plan) y una nota de confianza.
- **H-7 (cuatro tarjetas de contexto, talla L)**: la estructura de cuatro tarjetas ya existía
  (próximos hitos, meses a vigilar, lectura del hogar, señales). Se le añadió a «Meses a vigilar» la
  mini banda de doce meses que ya usaba Plan (`cuadroMandosMonthBandHtml`, V2-7), mismo cálculo y
  color que el mapa de calor — sin fabricar una segunda escala.
- **H-10 (dato ausente)**: convención `HOME_MISSING_VALUE` («—») aplicada donde hacía falta. De
  paso, verificando visualmente la pantalla, apareció un caso real que el propio H-10 pedía cazar:
  con fecha de ingreso conocida pero sin gasto diario, la «necesidad» se rellenaba con 0 € en vez de
  decir que no se puede calcular — corregido. También se detectó y corrigió que la fecha de
  vencimiento de una alerta disparada (formato completo `AAAA-MM-DD`) se desfiguraba al pasar por
  `escenarioMotorMonthLabel` (pensada para claves de mes `AAAA-MM`), mostrando «vence sept 26-13»;
  ahora cada tipo de decisión precalcula su propia etiqueta con el formateador correcto.

**Validación** (`npm run verify`, exit 0): **639/639 pruebas** (628 antes + 11 nuevas en
`f1-hoy-dato-ausente.test.cjs`, una por indicador con dato ausente; una prueba existente de V1-2 se
actualizó para seguir el nuevo camino de código, sin cambiar lo que verifica), **611 IDs únicos** de
accesibilidad, diff 10.000 filas en **47,9 ms**, forecast y escenarios en **274,0 ms**, recursos
**1306 KB**, build del sitio, privacidad y smoke test en verde. Verificación visual con Playwright
(captura de pantalla + inspección del DOM) antes y después de los dos arreglos de H-10.

**Qué no cambió**: ninguna otra pantalla se tocó. H-2 y H-8 quedan explícitamente pendientes del
menú de las nueve pantallas (fuera de esta sesión, decisión del usuario).

**Pendiente de publicar**: rama `claude/finanzas-casa-workflow-missing-hudou6`, commit y PR en
borrador según lo autorizado en `CLAUDE.md`.

## Cierre de sesión — 14 de agosto de 2026: arranca la Fase 1 del refactor a nueve pantallas

El usuario pidió un refactor visual y funcional grande basado en nueve mockups nuevos (Hoy,
Registrar, Movimientos, Plan, Deuda, Escenarios, Análisis, Cierre, Laboratorio) más una
especificación técnica de 124 tareas en 7 fases (`Backlog_Global.pdf` V4). Antes de tocar código
se publicó un backlog de seguimiento como Artifact y se resolvieron con el usuario las cuatro
decisiones de arquitectura que la propia especificación señalaba como bloqueantes: **10 planes
paralelos como máximo por hogar** (con archivado manual y modal de bloqueo al llegar al límite),
**extractos bancarios previstos en el modelo pero desactivados en la interfaz** hasta que se
acometa la E10 histórica, **tres usuarios con los mismos permisos de edición y acceso** (activando
`A5-3 · Hogar compartido`, que ya existía implementada localmente), y **cálculo de las piezas caras
de Análisis en cliente**, decidido por el asistente con criterio propio (la app no tiene backend
para el libro y `A13-2` ya probó 10.000 periodos en 60,5 ms).

**Primer commit de la Fase 1 · Cimientos**, exploración previa incluida: gran parte de los
cimientos ya existía (`stableId()` en `canonical-state.js`, procedencia de primera clase en
`canonical-ledger.js`, el contrato versionado `finance-executive-read-model/v1` en
`executive-read-model.js`). El hueco real era más estrecho que lo que sugería la especificación:

- Nuevo `canonical-cushion.js`: extrae "colchón por mes"/"peor mes" de `mapaCalorFloor`,
  `mapaCalorTone` y el reduce de `renderMapaCalor` (lógica de vista embebida en `app.js`) a un
  módulo puro y compartido (`cushionFloor`, `cushionTone`, `worstMonthOf`), sin DOM ni estado
  global. `mapaCalorFloor`/`mapaCalorTone` en `app.js` pasan a delegar en él, sin cambiar de
  comportamiento — cero cambio visual.
- El contrato ejecutivo (`unifiedActionCenterModel()`) gana dos métricas más —**deuda pendiente**
  y **fecha libre de deuda**—, reutilizando `homeDebtOutlook()` tal cual, con su propia
  procedencia (`source`/`method`/`coverage`/`confidence`) en vez de quedar calculadas ad hoc solo
  dentro de `renderHomeDashboard`.
- `service-worker.js` y `tools/build-public-site.mjs` actualizados para precachear y publicar
  `canonical-cushion.js`; `CACHE_NAME` y las versiones de `app.js`/`design-tokens.css` bumped a
  `20260814-f1a1` / `20260814f1a1`.

**Validación** (`npm run verify`, exit 0): **628/628 pruebas** (616 antes + 12 nuevas: 8 de
`canonical-cushion.test.cjs`, 4 de `f1-contrato-ejecutivo-deuda.test.cjs`), **600 IDs únicos** de
accesibilidad, diff 10.000 filas en **52,0 ms**, forecast y escenarios en **272,5 ms**, recursos
**1289 KB**, build del sitio, privacidad y smoke test en verde.

**Qué no cambió**: ninguna pantalla visible se tocó. `#home` sigue siendo `renderHomeDashboard()`
tal cual; la nueva Hoy (H-1 a H-10) es el siguiente paso, ahora sobre estos cimientos.

**Pendiente de publicar**: rama `claude/app-refactor-visual-forecast-49bplp`, commit y PR en
borrador según lo autorizado en `CLAUDE.md`.

## Cierre de sesión — 12 de agosto de 2026: reclasifica 1d/2e, cierra la inconsistencia de V3-3 y añade T-6

El usuario pidió cerrar los dos últimos 🟡 de `BACKLOG.md` (1d Asesor ejecutivo, 2e Escenarios
guardados) y arreglar la inconsistencia de documentación detectada en la sesión anterior (§6 de
`docs/E19_SISTEMA_DISENO.md`, que seguía diciendo "solo tres estrategias" pese a que V3-3 añadió
Consolidar como cuarta el 10 de agosto).

**Antes de tocar nada se preguntó qué significa "acometer" 1d/2e**, porque las dos comparten la
misma raíz: dependen de un "motor de recomendación genérico" (decisión recomendada / escenario
caducado) que el proyecto decidió explícitamente no fabricar — está documentado en
`docs/E19_SISTEMA_DISENO.md` §5 y §8 desde el principio, y construirlo ahora habría revertido esa
decisión de producto sin que existiera un criterio real definido. El usuario eligió: **reclasificar
sin fabricar nada, y guardar el motor de recomendación real como tarea explícita para la próxima
versión.**

**Qué cambió, exactamente:**
- `BACKLOG.md`: 1d y 2e pasan de 🟡 a ✅ — las dos pantallas están construidas al completo sobre
  datos reales, la nota permanente sobre lo que no se fabrica no es un hueco de construcción, es
  una decisión de producto ya tomada. Nueva tarea **T-6** ("Motor de recomendación real"), ⏳,
  prioridad Media, con su nota explicando el porqué y la petición del usuario de guardarla para la
  siguiente versión.
- `docs/E19_SISTEMA_DISENO.md` §6: corregido el párrafo que documentaba "solo tres estrategias, no
  cuatro" — desde V3-3 (10 de agosto) hay cuatro (avalancha, bola de nieve, **consolidar**, no
  tocar nada), con "consolidar" pidiendo la oferta real (TIN/plazo/comisión) en vez de fabricarla.
- `npm test`: **616/616 pruebas**, sin cambios (cambio de solo documentación).

**Con esto, `BACKLOG.md` no tiene ningún 🟡 ni ⏳ bloqueante pendiente del cierre de backlog
pedido**: los únicos ⏳ que quedan son T-3 (E10, activación real de IA/hogar/push/PSD2, sin
bloqueo) y el nuevo T-6, ambos explícitamente fuera de esta sesión y guardados para el futuro.

**Siguiente paso pedido por el usuario:** generar un documento de entrega visual (estilo
dashboard, con badges) que resuma todos los cambios de esta sesión como base para planificar la
próxima versión — pendiente de publicar como Artifact.

## Cierre de sesión — 12 de agosto de 2026: confirmación en el sitio de V2-6 y V4-3/V4-5

El usuario confirmó en el sitio publicado (`javierbarriusom-a11y.github.io/contabilidadcasa`) las
dos últimas piezas del cierre de backlog que quedaban pendientes: V2-6 (cuarto indicador del pie
de impacto de Plan) y V4-3/V4-5 (aviso «¿es anual?» en Registrar el mes). **Con esto, las siete
tareas del cierre de backlog pedido por el usuario (V1-2, V2-5, V2-6, V2-7, V3-4, V4-3, V4-5)
quedan hechas y confirmadas.**

**Vistas que cierran por completo con esta confirmación:**
- **2 · Plan** — las ocho tareas de V2 en ✅.
- **4 · Datos** — las seis tareas de V4 en ✅.

Sumadas a las que ya habían cerrado en la entrada anterior (1 · Hoy y 3 · Deuda), **las seis
vistas del rediseño quedan con su función construida, publicada y confirmada en el sitio**. Solo
quedan sin construir dos omisiones documentadas y permanentes, sin relación con el cierre de
backlog pedido: `#asesor-decision` (1d, sin motor de recomendación genérico, decisión de producto
explícita) y `#escenario-guardados` (2e).

**Qué cambió en el repositorio:** solo documentación, sin tocar código ni versión del shell.
- `BACKLOG.md`: V2-6, V4-3 y V4-5 pasan de 🟡 a ✅. La tabla de cobertura por vista (§2) y el
  resumen del catálogo de quince mockups (§1) se ponen al día — dos filas (2a, 3c) llevaban desde
  rondas anteriores marcadas como pendientes cuando ya estaban confirmadas, un descuido corregido
  de paso.
- `docs/E19_SISTEMA_DISENO.md`: §12 actualizado — «la fecha libre de deuda no está en el pie» era
  cierto antes de V2-6 y dejó de serlo; el catálogo de mockups (§1) y el cierre de §12 marcan 3c
  como migrada completa, no parcial.
- `npm test`: **616/616 pruebas**, sin cambios respecto a la entrega anterior (cambio de solo
  documentación).

**Pendiente, fuera del cierre de backlog pedido:** se detectó de pasada que §6 de
`docs/E19_SISTEMA_DISENO.md` («Deuda: comparar estrategias → ruta») sigue documentando «solo tres
estrategias, no cuatro» pese a que V3-3 (10 de agosto) añadió Consolidar como cuarta — inconsistencia
real, pero anterior a esta sesión y no relacionada con V2-6/V4-3/V4-5, así que no se toca aquí. Queda
anotado para una futura pasada de documentación.

## Cierre de sesión — 12 de agosto de 2026: confirmación en el sitio de V1-2, V2-5, V2-7 y V3-4

Sesión de verificación, sin cambios de código: el usuario revisó en el sitio publicado
(`javierbarriusom-a11y.github.io/contabilidadcasa`) las cuatro entregas del cierre de backlog
descritas en la entrada anterior.

**Primer intento: tres piezas no se veían.** Con capturas de pantalla, el usuario reportó que V2-5
mostraba el enlace genérico de siempre («Mover o recortar una partida de ese mes») en vez del
personalizado, que el pie de impacto de Plan solo traía tres indicadores (faltaba V2-6) y ninguna
banda de doce meses entre la tabla y el pie (V2-7), y que en `#deuda-ruta` no aparecía la tarjeta
«Oferta en curso» de V3-4.

**Diagnóstico: caché de Service Worker, no el código.** Antes de tocar nada se comprobó en GitHub
Actions que el `deploy` del último merge (`98e0cdc`, el de V3-4) había terminado en verde, y que el
`index.html` publicado apuntaba a `app.js?v=20260812v34a1` — la versión correcta, con
`deudaRutaOffer`, `cuadroMandosBand` y `cuadroMandosDebtFreeReadout` presentes en el bundle. El
patrón (V1-2, la ronda más antigua, sí se veía; las tres rondas siguientes no) encajaba con una
página que llevaba abierta desde antes de esos despliegues, sirviendo el bundle antiguo cacheado
por el Service Worker (`ignoreSearch: true` en el `fetch` handler hace que el `?v=` de la URL no
importe para la clave de caché — el que manda es que `install`/`activate` se hayan disparado de
verdad en esa pestaña). Se indicó al usuario cómo forzar la actualización: `Unregister` del Service
Worker + `Clear site data` en DevTools, o cerrar todas las pestañas del sitio y volver a abrirlo.

**Resultado tras limpiar la caché:** V1-2 (ya se veía desde el principio), V2-5, V2-7 y V3-4
confirmados correctos por el usuario. **V2-6 no se ha vuelto a comprobar** tras el arreglo —no se
marca como ✅ hasta esa reconfirmación explícita, aunque el código y las pruebas ya lo cubren.
V4-3/V4-5 tampoco se han probado todavía en el sitio.

**Qué cambió en el repositorio:** solo documentación, sin tocar `app.js`/`index.html`/CSS ni
versión del shell — no hacía falta, el código ya estaba desplegado correctamente. `BACKLOG.md`:
V1-2, V2-5, V2-7 y V3-4 pasan de 🟡 a ✅, con nota de confirmación en el sitio; sus vistas (1 · Hoy
y 3 · Deuda) quedan ✅ por completo; la vista 2 · Plan queda con siete de sus ocho tareas en ✅,
pendiente solo de V2-6. `npm test`: **616/616 pruebas**, sin cambios respecto a la entrega anterior
(cambio de solo documentación, no hacía falta `npm run verify` completo).

**Pendiente para la próxima confirmación:** V2-6 (cuarto indicador del pie de impacto de Plan) y
V4-3/V4-5 (aviso «¿es anual?» en Registrar el mes, que además solo se dispara con una partida que
cumpla el patrón exacto en los datos reales).

## Cierre de sesión — 12 de agosto de 2026: V3-4, oferta en curso en la vista de Deuda

Cuarta y última de las cuatro entregas del cierre de backlog pedido por el usuario. Con esta, las
siete tareas pedidas explícitamente (V1-2, V2-5, V2-6, V2-7, V3-4, V4-3, V4-5) quedan hechas.

**El hueco.** El mockup 4d incluye la «oferta en curso» dentro de la propia vista de Deuda, pero esa
pieza solo existía en `#asesor-decision` (V1-2, la entrega anterior, ya la asomaba también desde
Hoy). `#deuda-ruta` —la pantalla «Decidir» con la ruta propuesta, la cartera y el checklist antes de
aplicar— no decía nada de ella.

**La solución, sin recalcular nada.** Nueva `renderDeudaRutaOffer()`, llamada al principio de
`renderDeudaRuta()`, que reutiliza `asesorDecisionOpenOffers()[0]` y `asesorDecisionFundingHtml()`
tal cual —los mismos datos que ya calculaba `#asesor-decision`, sin una segunda fuente de verdad—.
Nueva tarjeta «Oferta en curso» al principio de la columna lateral de `#deuda-ruta` (antes de
«Cartera» y «Antes de aplicar»): contraparte, entidad y vencimiento; importe y ahorro; la misma
cobertura por cuenta con barra que ya usaba `#asesor-decision`; y un botón que replica exactamente
el gesto de `asesorDecisionApply` — marca `e14bWorkspace().selectedOfferId` y enruta a
`#debt-roadmap`, que sigue siendo el único sitio donde una oferta se aplica de verdad. Sin ofertas
abiertas, la tarjeta lo dice en vez de dejarse en blanco, igual que ya degradaba `#asesor-decision`.

**Qué cambió, exactamente:**
- `app.js`: `renderDeudaRutaOffer()`, llamada nueva en `renderDeudaRuta()`.
- `index.html`: nueva tarjeta `#deudaRutaOffer` en `.deuda-ruta-side` de `#deuda-ruta`, antes de
  `#deudaRutaPortfolio`; versión de `app.js` y `design-tokens.css` bumped a `20260812v34a1`.
- `design-tokens.css`: las reglas de `.asesor-decision-stats`/`.asesor-decision-stat`/
  `.asesor-decision-subtitle`/`.asesor-decision-funding*` (siete selectores) se amplían con
  `.e19-deuda-decidir` además de `.e19-asesor-decision` — mismo patrón que ya usaba
  `.e19-cuadro-mandos` para tres IDs. Cero declaraciones de color nuevas.
- `service-worker.js`: `CACHE_NAME` → `"finanzas-casa-shell-20260812-v34a1"`.
- 24 archivos de test actualizan el canario de versión del shell. Un fichero nuevo
  (`v3-4-oferta-en-curso.test.cjs`, 10 pruebas) cubre la tarjeta, la reutilización, el enrutado y el
  cableado.

**Validación** (`npm run verify`, exit 0): **616/616 pruebas** (606 antes + 10 nuevas), **600 IDs
únicos**, diff 10.000 filas en **46,5 ms**, forecast y escenarios en **257,2 ms**, recursos **1288
KB**. QA de navegador sobre `dist/`: la tarjeta aparece primero en la columna lateral de
`#deuda-ruta`, antes de «Cartera» y «Antes de aplicar»; con los datos de la demo pública (sin ofertas
abiertas) muestra «Sin ofertas de deuda abiertas ahora mismo» sin error de consola — el mismo
comportamiento degradado que ya tenía V1-2 sin ofertas.

**Cierra la vista 3 · Deuda por completo**: las cinco tareas de V3 quedan hechas. Queda 🟡 hasta la
confirmación en el sitio publicado.

**Con esto se cierran las cuatro entregas del cierre de backlog pedido por el usuario**: V1-2 (Hoy),
V2-5/V2-6/V2-7 (Plan), V4-3/V4-5 (Datos) y V3-4 (Deuda). Las siete tareas quedan 🟡, pendientes de la
confirmación del usuario en el sitio publicado — la misma puerta de aceptación de siempre (§7 de
`BACKLOG.md`).

## Cierre de sesión — 12 de agosto de 2026: V4-3 y V4-5, aviso «¿es anual?» en Registrar el mes

Tercera de las cuatro entregas del cierre de backlog pedido por el usuario. Las dos tareas
comparten el mismo hueco — Registrar el mes no distinguía una partida puntual de una que se repite
cada año — así que se hacen juntas: V4-5 es la detección, V4-3 es el aviso que la consume.

**V4-5 — detección de partida anual desde el extracto.** `docs/E19_SISTEMA_DISENO.md` documentaba
esta detección como pendiente. Nueva función pura `registrarMesAnnualMatch(entry, transactions,
monthKey)`: para una partida nueva de ese mes (`entry.row.custom`) con un real registrado, busca en
`baseData.transactions` de la misma partida (`mappingForMovement(t)?.row === entry.row`) un
movimiento con un importe parecido (±0,50 €) hace ~12 meses (±15 días) y **sin ningún movimiento
parecido entre medias** — si lo hubiera, sería mensual, no anual, y no se pregunta. Solo mira
partidas nuevas de este mes: una ya establecida no necesita que se le pregunte si es la de siempre.
No proyecta el previsto hacia años futuros — eso exigiría ampliar el motor de planificación, que
sigue siendo estrictamente mensual por diseño — solo detecta y avisa.

**V4-3 — el aviso.** Cuando `registrarMesAnnualMatch` encuentra coincidencia y la partida no está
reconocida aún (`state.registrarMesAnnualAck`), `registrarMesRowHtml` añade una fila
(`registrarMesAnnualBannerHtml`) bajo la de la partida: el importe, la fecha de hace un año, y dos
botones. «Sí, anual» y «Solo este mes» hacen lo mismo por dentro —marcan
`state.registrarMesAnnualAck[entry.key] = true` y dejan de preguntar por esa partida—, pero solo
«Sí, anual» sugiere anotarlo en Partidas para que aparezca también el año que viene, con la
salvedad honesta de que eso sigue siendo manual. Con el mes cerrado, no se pregunta.

**Qué cambió, exactamente:**
- `app.js`: `registrarMesAnnualMatch()`, `registrarMesAnnualBannerHtml()`,
  `handleRegistrarMesAnnualChoice()`; `registrarMesRowHtml()` gana un tercer parámetro (`monthKey`)
  y llama a las dos primeras; delegación de clic para
  `[data-registrar-mes-annual-key]` en el listener ya existente de `#registrarMesTables`;
  `saveScenarioSettings()` añade `registrarMesAnnualAck` a su lista blanca de campos persistidos —
  sin esto, la elección no sobreviviría a un recargado.
- `design-tokens.css`: `.registrar-mes-annual-row`/`.registrar-mes-annual-note`/
  `.registrar-mes-annual-actions`, con el mismo patrón que ya usaba `.cuadro-mandos-apply-row`.
- `index.html`: versión de `app.js` y `design-tokens.css` bumped a `20260812v43a1`.
- `service-worker.js`: `CACHE_NAME` → `"finanzas-casa-shell-20260812-v43a1"`.
- 23 archivos de test actualizan el canario de versión del shell. Un fichero nuevo
  (`v4-3-v4-5-partida-anual.test.cjs`, 20 pruebas) cubre la detección, el aviso, la respuesta y el
  cableado.

**Validación** (`npm run verify`, exit 0): **606/606 pruebas** (586 antes + 20 nuevas), **599 IDs
únicos**, diff 10.000 filas en **44,3 ms**, forecast y escenarios en **224,5 ms**, recursos **1286
KB**. QA de navegador servida desde `dist/`: la tabla de Registrar el mes carga sus 29 filas sin
error de consola; el aviso no aparece con los datos de la demo pública —vacía de movimientos por
privacidad—, que es el comportamiento correcto (sin transacciones no hay nada que comparar), igual
que ya degradaba V1-2 sin ofertas abiertas. La lógica de detección en sí queda cubierta por las
pruebas unitarias, con datos sintéticos que sí reproducen el patrón anual.

**Limitación documentada, a propósito**: tras editar el real por la vía rápida
(`registrarMesRefreshCells`, que solo actualiza la celda sin repintar la tabla completa), el aviso
aparece en el siguiente repintado completo, no al instante. Se aceptó ese retraso menor a cambio de
no tocar el camino rápido, que es el que se usa al escribir en la casilla.

**Cierra el aviso «¿es anual?» pedido en el bloque de Datos**: V4-3 y V4-5 quedan hechas. Quedan 🟡
hasta la confirmación en el sitio publicado.

**Pendiente**: queda la última de las cuatro entregas del cierre pedido — V3-4 en Deuda.

## Cierre de sesión — 12 de agosto de 2026: V2-5, V2-6 y V2-7, remates de Plan

Segunda de las cuatro entregas del cierre de backlog pedido por el usuario, siguiendo la
investigación previa. Las tres tareas comparten código (`renderCuadroMandos`, `renderMapaCalor`,
`renderCuadroMandosImpactBar`) y ninguna necesita cálculo nuevo, así que se hacen juntas en una
sola entrega.

**V2-5 — panel de recomendaciones calculadas.** El panel «Dónde seguir con ese mes» de
`#mapa-calor` tenía tres enlaces genéricos. El primero pasa a nombrar el bloque de gasto que de
verdad pesa más en el peor mes: `mapaCalorTopBlockLink(blocks, worstKey)` reutiliza el mismo
desglose (`blocks`) que ya calculaba el panel de al lado (`mapaCalorBreakdown`), ahora hoisted
para no duplicar el cálculo. Sin bloques (mes fuera de las partidas planificadas), cae al texto
genérico de siempre. **Lo que sigue sin construirse, a propósito**: no se generan propuestas de
movimiento («mover la matrícula a septiembre») porque seguiría sin existir un motor que las
calcule — inventarlas fabricaría un cálculo que nadie ha hecho, la misma razón que ya dejó
escrita el propio código antes de esta entrega.

**V2-6 — cuarto indicador del pie: fecha libre de deuda.** El pie de impacto (`cuadro-mandos`)
mostraba tres indicadores con antes/después. `docs/E19_SISTEMA_DISENO.md` §12 documentaba por qué
faltaba el cuarto: editar el previsto de una partida de Plan no toca ningún contrato de deuda, así
que un antes/después literal siempre diría «sin cambio». Esa razón sigue siendo cierta, así que
`cuadroMandosDebtFreeReadout()` — que reutiliza `homeDebtOutlook()` tal cual, la misma función que
ya usan Hoy y «No tocar nada» en Deuda — se muestra **sin pasar por `cuadroMandosBeforeAfter`**:
una lectura fija, con un `title` que explica que se mueve desde Simular o Deuda, no desde aquí.

**V2-7 — banda de doce meses integrada en Plan.** Nueva fila `#cuadroMandosBand` entre la tabla y
el pie de impacto, con `cuadroMandosMonthBandHtml(rowsAfter, touchedMonths)` reutilizando
`mapaCalorTone`/`mapaCalorFloor` — el mismo color que ya usa `#mapa-calor`, no una escala nueva.
No es la rejilla multi-año completa de Mapa de calor: es una sola fila con los próximos doce
meses, para no abrumar una tabla ya densa con una vista que, además, `#mapa-calor` ya cubre en
detalle.

**Qué cambió, exactamente:**
- `app.js`: `mapaCalorTopBlockLink`, `blocks` hoisted en `renderMapaCalor()`;
  `cuadroMandosDebtFreeReadout()`, cuarto `<dl>` en `renderCuadroMandosImpactBar()`;
  `cuadroMandosMonthBandHtml()`, llamada nueva en `renderCuadroMandos()`.
- `index.html`: nuevo `#cuadroMandosBand` entre la tabla y el pie de impacto; versión de `app.js`
  y `design-tokens.css` bumped a `20260812v25a1`.
- `design-tokens.css`: `.cuadro-mandos-band`/`.cuadro-mandos-band-item`, reutilizando
  `.mapa-calor-cell` para el color — cero reglas de color nuevas.
- `service-worker.js`: `CACHE_NAME` → `"finanzas-casa-shell-20260812-v25a1"`.
- 22 archivos de test actualizan el canario de versión del shell. Un fichero nuevo
  (`v2-plan-remates.test.cjs`, 12 pruebas) cubre las tres entregas.

**Validación** (`npm run verify`, exit 0): **586/586 pruebas** (574 antes + 12 nuevas), **599 IDs
únicos**, diff 10.000 filas en **45,1 ms**, forecast y escenarios en **228,0 ms**, recursos **1282
KB**. QA de navegador servida desde `dist/`, con capturas revisadas a mano: la banda de doce meses
aparece con sus etiquetas de mes y su color; al editar una celda, el pie de impacto muestra los
cuatro indicadores — los tres con antes/después de siempre y el nuevo, «Fecha libre de deuda
(fija)», sin tachado ni comparación, tal como se diseñó; en Mapa de calor, el primer enlace decía
literalmente «Revisar Gastos fijos, tu mayor gasto en ago 26 (2.500,00 €)» — el bloque real del
mes real, no un texto de relleno. La única comprobación que no pasa es el aviso de red ajeno de
siempre (CDN de Supabase bloqueado en este entorno), sin relación con este cambio.

**Cierra la vista 2 · Plan por completo**: las ocho tareas de V2 quedan hechas. Queda 🟡 hasta la
confirmación en el sitio publicado.

**Pendiente**: quedan dos de las cuatro entregas del cierre pedido — el bloque de Datos
(V4-3+V4-5) y V3-4 en Deuda.

## Cierre de sesión — 12 de agosto de 2026: V1-2, el asesor ejecutivo se asoma en Hoy

Pedido explícito del usuario tras cerrar T-2: «centrémonos en cerrar el backlog», con la lista
completa de lo que quedaba (V1-2, V2-5, V4-3, V2-6, V2-7, V3-4, V4-5). Antes de tocar código se
lanzaron tres investigaciones en paralelo para medir el hueco real de cada tarea — este cierre es
la primera de las cuatro entregas resultantes.

**El hallazgo.** `#asesor-decision` ya resolvía «una decisión abierta a la vez» al completo desde
E20-2: la oferta de deuda más urgente registrada en `#debt-roadmap`, con cifras reales
(`E14DebtOperations.simulateStrategy`), estado vacío explícito cuando no hay ninguna, y el resto
de ofertas en cola. El hueco no estaba en esa pantalla — estaba en que **Hoy nunca la
enlazaba**: ninguna función de `#home` mencionaba `asesor-decision` en ningún sitio.

**La solución, sin recalcular nada.** Nueva función pura `homeOpenOfferInsight(offer)` que
reutiliza `asesorDecisionOpenOffers()` tal cual y construye una lectura más para «Situación
actual» (`homeInsights`) cuando hay una oferta abierta: contraparte, importe, vencimiento y un
botón hacia `#asesor-decision`. Sin oferta abierta, no añade nada — no hay estado de relleno.

**Qué cambió, exactamente:**
- `app.js`: `homeOpenOfferInsight(offer)` (función pura, sin DOM); `renderHomeDashboard()` gana la
  llamada `homeOpenOfferInsight(asesorDecisionOpenOffers()[0])` y el push condicional a
  `mainInsights`.
- `index.html`: sin cambios de marcado — reutiliza `#homeInsights`, que ya existía; versión de
  `app.js` bumped a `20260812v12a1`.
- `service-worker.js`: `CACHE_NAME` → `"finanzas-casa-shell-20260812-v12a1"`.
- 20 archivos de test actualizan el canario de versión del shell. Un fallo de bulk-sed evitado a
  tiempo: el sufijo nuevo (`v12a1`) coincidía en parte con el de `design-tokens.css`
  (`t2a1`→sin cambiar), así que el sed se ancló al patrón con guion para el `worker` y a `v52a1`
  exacto para `app.js`, sin tocar las dos líneas que comprueban `design-tokens.css`. Un fichero
  nuevo (`v1-2-asesor-en-hoy.test.cjs`, 5 pruebas) cubre lo que añade esta entrega.

**Validación** (`npm run verify`, exit 0): **574/574 pruebas** (569 antes + 5 nuevas), **598 IDs
únicos**, diff 10.000 filas en **45,5 ms**, forecast y escenarios en **232,1 ms**, recursos **1278
KB**. QA de navegador servida desde `dist/`: los datos públicos de demostración no tienen ninguna
oferta de deuda abierta (por privacidad, igual que no tienen movimientos), así que la tarjeta
correctamente **no aparece** — comportamiento esperado, no un fallo, y confirma que la ausencia de
oferta no rompe nada. El caso con oferta abierta queda cubierto por las pruebas unitarias. La
única comprobación de consola que no pasa es el aviso de red ajeno de siempre (CDN de Supabase
bloqueado en este entorno), sin relación con este cambio.

**Cierra la vista 1 · Hoy por completo**: las cuatro tareas de V1 quedan hechas. Queda 🟡 hasta la
confirmación en el sitio publicado, igual que el resto de esta sesión.

**Pendiente**: siguen las tres entregas restantes del cierre pedido — el bloque de Plan (V2-5,
V2-6, V2-7), el de Datos (V4-3+V4-5, la misma pieza vista desde dos sitios) y V3-4 en Deuda.

## Cierre de sesión — 12 de agosto de 2026: confirmación en el sitio publicado de V6-4, V5-2 y T-2

El usuario confirmó las tres en el sitio publicado (`javierbarriusom-a11y.github.io/contabilidadcasa`):
los botones de exportar CSV y PDF del mes en Ajustes, la tarjeta «Confianza del dato» en Conciliar,
y el acento navy en toda la interfaz interactiva. Según la puerta de aceptación de `BACKLOG.md` §7
(punto 4), las tres pasan de 🟡 a ✅:

- **V6-4** — exportación única (CSV completo + PDF del mes) desde `#ajustes`.
- **V5-2** — confianza del dato por cuenta en `#conciliar`.
- **T-2** — acento interactivo navy (`#293E5E`).

Con esto, los bloques **V5 (Cierre)** y **V6 (Ajustes)** quedan completos al 100 %: no queda
ninguna tarea sin construir en ninguno de los dos, así que sus filas en la tabla de cobertura de
`BACKLOG.md` §2 pasan de «🟡 parcial» a «✅ alta».

**Qué cambió, exactamente:** solo texto en `BACKLOG.md` (estado de las tres filas, sus notas
explicativas, las dos filas de cobertura de vista, y el punto 9/10/11 del orden recomendado en la
sección 6). Ningún archivo de código ni de test se toca — no hay nada que validar con
`npm run verify` que no estuviera ya verificado en el cierre anterior (569/569 pruebas, 598 IDs,
QA con capturas revisadas a mano).

**Pendiente**: no queda ninguna tarea sin construir en todo el backlog vigente. Solo faltan T-3
(depende de aceptación externa real, no de trabajo local) y T-4 (⛔, espera datos de uso antes de
retirar de verdad una heredada).

## Cierre de sesión — 12 de agosto de 2026: T-2, el acento navy

Pedido explícito del usuario tras dejar V5-2 en 🟡 a la espera de su confirmación: «Hacemos igual,
las dejamos en amarillo y seguimos con el backlog» — la última pieza sin bloqueo que quedaba era
T-2.

**Lo pedido.** El acento interactivo pasa de azul (`#0072E3`) a navy (`#293E5E`), según la sección
de tokens del handoff de diseño. Ese mismo navy ya era `--e19-heading` (títulos) desde el principio
de E19 — el handoff lo nombra explícitamente como «primario, títulos, pie de impacto» a la vez, así
que consolidar el acento en el mismo tono no es una elección estética nueva, es aplicar lo que el
propio handoff ya especificaba y que E19-1 dejó pendiente.

**Qué cambia y qué no, con la razón de cada límite:**
- `--e19-accent`: `#0072E3` → `#293E5E`.
- `--e19-accent-hover`: `#005BB8` → `#1B2C48` — el propio handoff nombra este segundo hex como
  «Navy hover», así que no se inventa.
- `--e19-accent-soft`/`--e19-accent-soft-border`: recalculados a partir del navy nuevo (`#EEF0F2`/
  `#D8DCE2`, navy al ~8%/~18% sobre blanco) para no dejar un tinte azul huérfano detrás de un
  acento que ya no es azul — habría sido inconsistente, no solo cosmético.
- `--e19-accent-strong` (`#0B1A30`, fondo del pie de impacto y tarjetas fuertes) **no se toca**: ya
  era un navy oscuro propio, y T-2 nombra explícitamente el par `#0072E3`/`#293E5E`, no ese token.
- `--e19-eyebrow` (`#049FF9`, el cian de las etiquetas en mayúsculas) **no se toca**: es un color
  distinto, no nombrado por T-2.
- Las pantallas heredadas (`styles.css`/`p2.css`) **no se tocan**: nunca compartieron los tokens
  `--e19-*`, así que no hay nada que migrar ahí — siguen con su paleta de siempre.

**Qué cambió, exactamente:**
- `design-tokens.css`: los cinco valores de arriba, con un comentario explicando la fuente
  (handoff) y qué se dejó fuera a propósito.
- `design-system.html`: la muestra de color «Interactivo» de la guía de estilo ya leía el token
  (`var(--e19-accent)`), así que el color cambia solo; se actualiza la etiqueta de texto visible
  de `#0072E3` a `#293E5E` para que la guía siga diciendo la verdad.
- `index.html`: versión de `design-tokens.css` bumped a `20260812t2a1` (no se tocó `app.js`, que se
  queda en `20260812v52a1`).
- `service-worker.js`: `CACHE_NAME` → `"finanzas-casa-shell-20260812-t2a1"`.
- Un fallo de bulk-sed evitado a tiempo, aprendiendo de sesiones anteriores: el canario de versión
  de `service-worker.js` (`20260812-t2a1`, con guion) y el de `app.js` (`20260812v52a1`, sin
  guion, sin cambiar) comparten el sufijo `v52a1`/`t2a1` como subcadena. Un sed ciego sobre
  `v52a1` habría tocado también las líneas que comprobaban `app.js`, que no se movió esta ronda.
  Se aplicó el sed anclado al patrón con guion (`20260812-v52a1` → `20260812-t2a1`) para tocar solo
  lo que de verdad cambió.
- 20 archivos de test actualizan el canario de versión del shell (solo el de `service-worker.js`,
  no el de `app.js`). Un fichero nuevo (`t2-acento-navy.test.cjs`, 7 pruebas) cubre lo que añade
  esta entrega, incluida una prueba explícita de que los tokens fuera de alcance no cambian.

**Validación** (`npm run verify`, exit 0): **569/569 pruebas** (562 antes + 7 nuevas), **598 IDs
únicos**, diff 10.000 filas en **33,1 ms**, forecast y escenarios en **200,4 ms**, recursos **1278
KB**. QA de navegador servida desde `dist/`, con capturas de pantalla de Hoy, Cuadro de mandos y
Ajustes revisadas a mano: el token `--e19-accent` resuelve al navy nuevo, un botón primario pinta
con `rgb(41, 62, 94)`, el foco de teclado sigue siendo visible, y visualmente no queda ningún azul
huérfano ni problema de contraste — texto blanco sobre navy en botones y tarjetas fuertes, mismo
patrón que ya usaban los títulos. La única comprobación que no pasa es el aviso de red ajeno de
siempre (CDN de Supabase bloqueado en este entorno), confirmado aparte por URL y sin relación con
este cambio.

**Pendiente**: no queda ninguna tarea sin construir en el backlog vigente. Quedan tres
confirmaciones en el sitio publicado por hacer (V6-4, V5-2 y esta misma T-2) y dos piezas que no
dependen de trabajo local: T-3 (aceptación externa) y T-4 (⛔, espera datos de uso).

## Cierre de sesión — 12 de agosto de 2026: V5-2, confianza del dato por cuenta

Pedido explícito del usuario tras dejar V6-4 en 🟡 a la espera de su confirmación: «Si te parece
de momento lo dejas en amarillo en el backlog y sigues con la siguiente entrega» — la siguiente en
el orden recomendado del backlog era V5-2.

**Lo pedido.** El panel «Confianza del dato» por cuenta del mockup 4f: estado de cada cuenta
(Cuadra / Descuadra / Sin conciliar) en `#conciliar`, junto a «Pendiente de resolver». El mockup
mencionaba tres cuentas con una tarjeta de crédito; el modelo real del hogar solo tiene dos
(CaixaBank, Mediolanum), así que no se inventa una tercera.

**Lo que ya existía y se reutiliza tal cual, sin recalcular nada:** `renderConciliar()` ya
calculaba `entries` (con `accountId` por movimiento) y `checks` (`snapshot.balanceChecks`, con
continuidad de saldo por cuenta) para construir la lista de «Pendiente de resolver». El panel
nuevo lee exactamente esos dos valores, ya calculados, sin disparar una consulta ni un motor
nuevo.

**Cómo se decide el estado de cada cuenta**, sin inventar una cuarta categoría:
- **Cuadra**: sin saltos de continuidad de saldo y sin movimientos sin clasificar de esa cuenta.
- **Descuadra `<importe>`**: prioriza el error acumulado de continuidad de saldo
  (`check.totalError`) cuando existe, porque es literalmente un desajuste de saldo; si el saldo
  cuadra pero quedan movimientos sin clasificar, usa la suma de esos importes en su lugar, para no
  decir «Cuadra» mientras algo de la cuenta sigue sin decidir.
- **Sin conciliar**: no hay ningún `balanceChecks` para esa cuenta — no se ha importado ningún
  extracto suyo todavía.

**La omisión real, documentada y no escondida:** las diferencias banco-vs-real de `#conciliar`
(`snapshot.reconciliation.lines`) son mensuales y agregan las dos cuentas juntas — el modelo de
datos actual no permite atribuir esa cifra a una cuenta concreta, así que el panel no la usa. Una
cuenta puede decir «Cuadra» con una diferencia banco-vs-real del mes sin resolver todavía; esa
tarea sigue viendo su sitio en «Pendiente de resolver», justo al lado.

**Qué cambió, exactamente:**
- `app.js`: `CONCILIAR_ACCOUNT_LABELS` (las dos cuentas reales); `conciliarAccountConfidence(entries,
  checks)` (pura, sin DOM); `conciliarConfidenceStateLabel(row)`; `renderConciliarConfidence(entries,
  checks)`; `renderConciliar()` gana la llamada final a `renderConciliarConfidence(entries, checks)`
  con lo que ya tenía calculado.
- `index.html`: nueva tarjeta «Confianza del dato» en `.deuda-ruta-side`, antes de «Al cerrar el
  mes», como en el mockup; versión de `app.js` y `design-tokens.css` bumped a `20260812v52a1` (no
  se tocó `p2-export.js`, que se queda en `20260811v64a1`).
- `design-tokens.css`: `.conciliar-confidence-list`/`.conciliar-confidence-item`, mismo patrón de
  fila que `.conciliar-task-item`, con el color llevando el estado (verde/rojo/neutro) en vez de un
  índice numerado.
- `service-worker.js`: `CACHE_NAME` → `"finanzas-casa-shell-20260812-v52a1"`.
- Un fallo de bulk-sed corregido antes de llegar a `verify`: el sed de versión (`v64a1`→`v52a1`)
  cambió también la fecha implícita en algunas cadenas y tocó por error la línea que comprobaba la
  versión de `p2-export.js` (que no se movió esta ronda). Se corrigió a mano, con la misma lección
  de sesiones anteriores: revisar cada archivo que un sed masivo toca, no asumir que el patrón es
  uniforme.
- 20 archivos de test actualizan el canario de versión del shell. Un fichero nuevo
  (`v5-2-confianza-del-dato.test.cjs`, 12 pruebas) cubre lo que añade esta entrega.

**Validación** (`npm run verify`, exit 0): **562/562 pruebas** (550 antes + 12 nuevas), **598 IDs
únicos**, diff 10.000 filas en **38,6 ms**, forecast y escenarios en **222,1 ms**, recursos **1278
KB**. QA de navegador servida desde `dist/`: **7/8 comprobaciones** — Conciliar abre por hash
directo, el panel aparece con una fila por cada una de las dos cuentas (CaixaBank y Mediolanum),
cada fila lleva su estado con la clase que le corresponde, y Confianza del dato aparece antes que
Al cerrar el mes en el DOM, como en el mockup. Sobre datos públicos de demostración (sin
transacciones, por privacidad) las dos cuentas muestran «Sin conciliar», el estado esperado sin
extracto importado. La única comprobación que no pasa es la de «sin errores de consola propios», y
no es nueva: el CDN de Supabase sigue bloqueado en este entorno sin salida a internet (confirmado
aparte por URL, sin relación con este cambio).

**Pendiente**: T-2 (acento navy) es ahora la única pieza sin bloqueo que queda en el backlog
vigente, además de las confirmaciones en el sitio publicado todavía pendientes (V6-4 y esta misma
V5-2). T-3 depende de aceptación externa y T-4 sigue ⛔ esperando datos de uso.

## Cierre de sesión — 12 de agosto de 2026: V6-4, exportación única

Pedido explícito del usuario tras confirmar T-1/V6-3/V6-2/V1-4 en el sitio publicado: «Pasa a
Cerrar el bloque Ajustes: V6-4, exportación única».

**Lo pedido.** El CSV completo del flujo mensual y un PDF del mes, desde un único sitio — hoy
`downloadCsv` solo vivía en `#cashflow`. La tarjeta «Exportar» de `#ajustes`, que hasta ahora era
un enlace de ruta hacia `#cashflow` con la omisión escrita, pasa a descargar de verdad: dos
botones, «Descargar CSV completo» y «Descargar PDF del mes».

**Lo que ya existía y se reutiliza tal cual, sin reinventarlo:**
- El CSV completo es literalmente `downloadCsv()`, la misma función que ya usa `#cashflow` —
  un segundo `addEventListener` sobre el botón nuevo, nada más.
- El PDF no añade ninguna librería nueva. `p2-export.js` (E10, informe para el asesor) ya tenía un
  escritor de PDF sin dependencias (`pdfBlob`/`download`, bytes `%PDF-1.4` escritos a mano). Se le
  añade un método genérico, `P2Export.downloadPlainPdf(lines, fileName)`, que reutiliza esos
  mismos internos para líneas de texto sueltas en vez del modelo específico del informe del
  asesor — `downloadPdf` (el método existente) no se toca.
- El contenido del PDF reutiliza `registrarMesSelectedMonth()`/`registrarMesCollect()`/
  `registrarMesTotals()`, las mismas funciones que ya usa Registrar el mes y que V6-2 ya leía
  desde Ajustes para el aviso de desviación por partida.

**Qué cambió, exactamente:**
- `p2-export.js`: nuevo método `downloadPlainPdf(lines, fileName)` en `P2Export`, aditivo, sin
  tocar `downloadPdf` ni `downloadExcel`.
- `app.js`: `renderAjustesExportNote()` (qué mes se exportará, o que no hay ninguno abierto);
  `ajustesExportMonthLines(month, entries, totals)` (líneas de texto del PDF, función pura,
  separada del disparo para poder probarla sin depender de `P2Export` ni del navegador);
  `handleAjustesExportPdf()` (junta mes/entries/totals, llama a `P2Export.downloadPlainPdf` y
  anuncia el resultado); `renderAjustes()` gana la llamada a `renderAjustesExportNote()`; dos
  `addEventListener` nuevos (`ajustesExportCsv` → `downloadCsv`, `ajustesExportPdf` →
  `handleAjustesExportPdf`) y su `data-help`.
- `index.html`: la tarjeta «Exportar» deja de ser `<button data-home-nav="cashflow">` y pasa a un
  `<article class="e19-card">` con los dos botones y una nota; ya no queda ninguna tarjeta de
  Ajustes marcada «Pendiente»; versión de `app.js` y `p2-export.js` bumped a `20260811v64a1` (no se
  tocó `design-tokens.css` ni `ux-settings.js`, así que se quedan en `v62a1`).
- `service-worker.js`: `CACHE_NAME` → `"finanzas-casa-shell-20260811-v64a1"`.
- 20 archivos de test actualizan el canario de versión del shell (bulk sed `v62a1` → `v64a1`,
  mismo patrón que en cierres anteriores). `tests/v6-3-vista-ajustes.test.cjs` se ajusta en dos
  pruebas porque el comportamiento que comprobaban cambió a propósito: la tarjeta de Exportar ya
  no enruta a `#cashflow` (se quita de la lista de tarjetas-ruta) y ya no queda ninguna tarjeta
  «Pendiente» que documentar. Un fichero nuevo (`v6-4-exportacion-unica.test.cjs`, 9 pruebas) cubre
  lo que añade esta entrega: contenido del PDF con y sin partidas, aviso y no-descarga sin mes
  abierto, nombre de archivo con la clave del mes, la nota de Ajustes en los dos estados, el nuevo
  método de `P2Export` sin tocar el existente, cableado HTML/JS y el canario de versión.

**Validación** (`npm run verify`, exit 0): **550/550 pruebas** (541 antes + 9 nuevas), **597 IDs
únicos**, diff 10.000 filas en **37,4 ms**, forecast y escenarios en **189,0 ms**, recursos **1275
KB**. QA de navegador servida desde `dist/`: **10/11 comprobaciones** — Ajustes abre por hash
directo, los dos botones y la nota están presentes, ya no queda ninguna tarjeta de ruta hacia
`#cashflow`, el CSV se descarga con el nombre esperado, abrir un mes en Registrar el mes se refleja
en la nota de Ajustes, y el PDF se descarga con el nombre `resumen-mes-<clave>.pdf` y contenido no
vacío. La única comprobación que no pasa es la de «sin errores de consola propios», y no es nueva:
el CDN de Supabase sigue bloqueado en este entorno sin salida a internet (mismo aviso de siempre,
confirmado aparte con las URLs de red, sin relación con este cambio) más un 404 puntual no
capturable en la primera pasada, igual que en cierres anteriores.

**Pendiente**: llevar el umbral de partida (V6-2) al tinte y al filtro de Registrar el mes sigue
siendo la única omisión abierta del bloque de Ajustes. T-2 (acento navy) sigue independiente y sin
empezar. V5-2 (confianza del dato por cuenta) sigue como la pieza de prioridad Media que queda en
el resto del backlog.

## Cierre de sesión — 11 de agosto de 2026: confirmación en el sitio publicado de T-1, V6-3, V6-2 y V1-4

El usuario confirmó una por una, viendo el sitio publicado (`javierbarriusom-a11y.github.io/contabilidadcasa`)
tras el checklist entregado en la conversación: la navegación de seis vistas, la vista `#ajustes`
con la reserva operativa moviéndose de verdad, los dos umbrales propios y el colchón mínimo en
`#alerts-center`, y las cuatro heredadas de Hoy relegadas a «Versiones anteriores». Con esto, y
según la puerta de aceptación de `BACKLOG.md` §7 (punto 4: «fusionada a `main` y verificada en el
sitio publicado»), las cuatro pasan de 🟡 a ✅:

- **T-1** — navegación de seis vistas.
- **V6-3** — vista `#ajustes`.
- **V6-2** — umbrales de aviso (colchón mínimo, ventana de duplicados, desviación por partida).
- **V1-4** — relegación de las cuatro heredadas de Hoy.

Ninguna de las cuatro cambia de alcance: las omisiones ya documentadas siguen documentadas y no se
ocultan — V6-2 sigue sin teñir ni filtrar Registrar el mes por el umbral de partida (mejora futura
explícita), T-1 sigue sin fundir contenido entre pantallas de una misma vista («envolver, no
sustituir»), y V6-3 sigue esperando a V6-4 (exportación única) para el bloque de Ajustes completo.
Ninguna omisión de esas bloqueaba la ✅ según el propio punto 5 de la puerta de aceptación: quedan
escritas y localizables, no escondidas.

**Qué cambió, exactamente:** solo texto en `BACKLOG.md` (estado de las cuatro filas de la sección 4,
las notas explicativas de T-1, V6-2 y V6-3, y el punto 7/8 del orden recomendado en la sección 6).
Ningún archivo de código ni de test se toca — no hay nada que validar con `npm run verify` que no
estuviera ya verificado en el cierre anterior (541/541 pruebas, 594 IDs, QA 10/10 en `dist/`).

**Pendiente:** V6-4 (exportación única), V1-2 (asesor ejecutivo, una decisión abierta a la vez),
V2-5 (recomendaciones del mapa de calor) y V4-3 (aviso de partida anual en Registrar el mes) siguen
en 🟡. Del resto del backlog, ocho tareas de prioridad Baja o Media siguen ⏳ sin bloqueo, y T-4
sigue ⛔ esperando datos de uso.

## Cierre de sesión — 11 de agosto de 2026: V6-2, umbrales de aviso

Pedido explícito del usuario tras confirmar que T-1/V6-3 se habían publicado: «pasa a V6-2».

Las tres piezas que pedía V6-2 (colchón mínimo en meses, desviación por partida, ventana de
duplicados) encajan en tres sitios distintos, cada una en el mecanismo que ya sabía resolver ese
tipo de umbral — ninguna se construyó desde cero:

- **Colchón mínimo en meses** es una regla más del framework de alertas que ya existía
  (`UX_ALERT_METRICS`/`ALERT_METRICS`/`#alerts-center`): un metric+threshold+revisión es
  exactamente lo que ese framework ya modelaba. Nueva entrada `minimumCashMonths`, calculada en
  `alertMetricSnapshot()` reutilizando `safeCoverageMonths` sobre la liquidez mínima y la salida
  media de los próximos 12 meses abiertos — el mismo cálculo que ya usa el pie de impacto de Plan,
  no uno nuevo. Nueva regla por defecto `alert-cushion-months`, editable, pausable y con revisión
  como cualquier otra.
- **Ventana de duplicados** y **desviación por partida** no son alertas del hogar, son parámetros
  de comportamiento, así que viven como ajustes propios en `#ajustes`, con el mismo patrón «vacío
  es sin configurar, no cero» que ya usaba la reserva operativa (V6-1/V6-3). La ventana pasa de
  ser la constante fija `DATOS_IMPORTAR_DUPLICATE_WINDOW_DAYS = 7` a un valor configurable
  (`duplicateWindowDays()`) que los dos import de `datos-importar.js` piden explícitamente en vez
  de depender del valor por defecto implícito del parámetro.

**La omisión real, documentada y no escondida:** el umbral de desviación por partida es **un único
porcentaje global**, no una lista de partidas concretas que se vigilan una a una. Ajustes informa
—en una nota de solo lectura— cuántas partidas del mes abierto en Registrar el mes superan ese
porcentaje, pero **Registrar el mes no cambia su tinte ni su filtro «Con desviación»**, que siguen
contando cualquier diferencia como hacían antes de esta entrega. Tocar esa pantalla ya publicada
para aplicar el umbral se dejó fuera a propósito, para no arriesgar una regresión en un sitio que
nadie pidió tocar.

**Qué cambió, exactamente:**
- `ux-settings.js`: `minimumCashMonths` añadida a `ALERT_METRICS`.
- `app.js`: entrada en `UX_ALERT_METRICS`; regla por defecto `alert-cushion-months`; cálculo en
  `alertMetricSnapshot()`; `positiveIntegerFromField` (parseo compartido, entero positivo con
  máximo opcional); `duplicateWindowDays()`/`handleDuplicateWindowChange`/
  `syncDuplicateWindowControl`; `partidaDeviationThreshold()`/
  `handlePartidaDeviationThresholdChange`/`syncPartidaDeviationControl`;
  `registrarMesDeviationPercent` (desviación relativa, con un previsto de 0 € tratado como
  desviación total en vez de dividir por cero); `ajustesPartidasOverThreshold`/
  `renderAjustesPartidaNote`; los dos call-sites de `datosImportarDuplicateCandidates` y el
  mensaje de «sin candidatos» pasan a usar `duplicateWindowDays()`; `saveScenarioSettings()`
  persiste los dos ajustes nuevos como dato del hogar.
- `index.html`: tarjeta «Umbrales propios» nueva en `#ajustes` (ventana de duplicados + umbral de
  partida); la tarjeta de «Umbrales de aviso» deja de listar las tres piezas como pendientes;
  versión de `app.js`, `ux-settings.js` y `design-tokens.css` bumped a `20260811v62a1`.
- `design-tokens.css`: la fila flexible de controles (`.cuadro-mandos-controls`) se reutiliza
  también dentro de `.e19-ajustes`, sin regla nueva.
- Ocho archivos de test actualizan el canario de versión del shell; dos (`v4-4-importar-extracto`,
  `v6-3-vista-ajustes`) se ajustan porque el comportamiento que comprobaban cambió a propósito; un
  fichero nuevo (`v6-2-umbrales-aviso.test.cjs`, 11 pruebas) cubre lo que añade esta entrega.

**Validación** (`npm run verify`, exit 0): **541/541 pruebas** (530 antes + 11 nuevas), **594 IDs
únicos**, diff 10.000 filas en 49,9 ms, forecast/escenarios en 249,1 ms, recursos 1273 KB. QA de
navegador servida desde `dist/`: **10/10 comprobaciones** — Ajustes abre por hash directo, los dos
campos nuevos guardan y reflejan su valor, la nota de partida pasa de «sin umbral» a contar
partidas tras configurarlo, la tarjeta de Umbrales navega a `#alerts-center`, «Colchón mínimo
(meses)» aparece en el selector de indicador y la regla por defecto existe, e Importar extracto
sigue cargando sin errores tras el cambio. Mismos dos avisos de red ajenos de siempre (CDN de
Supabase bloqueado en este entorno; un 404 puntual no reproducido en una segunda pasada), ninguno
nuevo.

**Pendiente**: V6-4 (exportación única) sigue sin construir. Llevar el umbral de partida al tinte
y al filtro de Registrar el mes queda como una mejora futura explícita, no como parte de esta
entrega. T-2 (acento navy) sigue independiente y sin empezar.

## Cierre de sesión — 11 de agosto de 2026: T-1 completa, con la vista de Ajustes (V6-3)

Pedido explícito del usuario tras la sesión anterior: «T1 completa, con vista de ajustes». Las dos
tareas se hacen juntas porque una desbloqueaba a la otra — un menú principal con seis pestañas
reales no era construible sin que existiera antes la sexta vista.

**T-1 — navegación de seis vistas.** Los cuatro verbos de la navegación principal (Hoy,
Actualizar, Prever, Decidir) se sustituyen por las seis vistas del rediseño: Hoy (`#home`, sin
cambios), Plan (`#cuadro-mandos`), Deuda (`#deuda-ruta`), Datos (`#update-hub`, solo cambia la
etiqueta), Cierre (`#conciliar`, nueva como pestaña) y Ajustes (`#ajustes`, nueva pantalla). «Prever»
(`#forecast`) pierde la pestaña pero no se releva: sigue con piel nueva y alcanzable desde el menú
avanzado, como ya lo estaba. «Decidir» (`#new-life-definitive`) sí se releva a «Versiones
anteriores» — es la decimoctava y última heredada del inventario de `BACKLOG.md` §1; quedaba fuera
solo porque era pestaña principal, no porque su función siguiera sin cubrir por el motor de
escenarios nuevo y `#asesor-decision`. Ninguna heredada se retira ni se desconecta: el mecanismo de
T-0 (grupo `legacy`, preferencia por defecto en `true`) no cambia.

**V6-3 — vista `#ajustes`.** La reserva operativa (V6-1) se traslada de `#cuadro-mandos`, donde
vivía solo «hasta que existiera Ajustes» según su propio comentario en el código, a `#ajustes`
—ahora se guarda de verdad ahí—. `#cuadro-mandos` pasa a ser un consumidor más, con una nota de
solo lectura igual que ya tenía el comparador de deuda («Es tu reserva operativa, edítala en
Ajustes»). Las otras tres tarjetas de la vista —Cuentas, Partidas y Umbrales de aviso— **no
reimplementan sus editores**: cada una enlaza a donde ese dato ya se edita de verdad
(`#visual-detail`, `#registrar-mes`/`#visual-detail`, `#alerts-center`), porque construir un
formulario nuevo aquí habría duplicado lógica existente sin necesidad — la investigación previa a
esta entrega confirmó que no hay gestión de cuentas más allá de esos dos saldos, que las partidas
ya tienen alta/baja/renombrado en `#visual-detail`, y que los umbrales de `#alerts-center` no cubren
lo que pide V6-2 (colchón en meses, desviación por partida, ventana de duplicados — ese último es
hoy una constante fija en el código, sin UI). La tarjeta de Exportar enlaza al único CSV completo
de la app (`#cashflow`) y documenta que evidencia/inventario se descargan aparte, en Conciliar y
Auditoría.

**Por qué queda 🟡 y no ✅ en ninguna de las dos**: T-1 adopta la navegación sin fundir contenido
—cada pestaña aterriza en su pantalla más completa, con el resto alcanzable desde el menú
avanzado, seguridad de siempre («envolver, no sustituir»)— y V6-3 documenta en su propia tarjeta lo
que sigue pendiente (V6-2, V6-4) en vez de fingir que ya está hecho. Las dos esperan además a la
verificación en el sitio publicado, no solo en `dist/` local.

**Qué cambió, exactamente:**
- `index.html`: seis `nav-primary-link` en vez de cuatro; nueva sección `#ajustes` (piel `e19-*`)
  entre `#asesor-decision` y `#visual-detail`; `#new-life-definitive` añadida al final del grupo
  `legacy` en el menú avanzado; input de reserva movido de `#cuadro-mandos` a `#ajustes`
  (`id="cuadroMandosReserve"` → `id="ajustesReserve"`); versión de `app.js`, `e17-experience.js` y
  `design-tokens.css` bumped a `20260811t1a1`.
- `app.js`: `case "ajustes"` nuevo con `renderAjustes()`; entrada `ajustes` en `viewTitles`;
  `renderCuadroMandosReserveNote()` reescrita a nota de solo lectura; `renderAjustesReserveNote()`
  nueva con el texto detallado que antes tenía Cuadro de mandos; tres textos sueltos que decían
  «puedes fijarla en el Cuadro de mandos» pasan a decir «en Ajustes»; listener de clic delegado en
  `#ajustes` para las tarjetas de ruta, igual que en `#update-hub`.
- `e17-experience.js`: entrada `ajustes` nueva en el lanzador (grupo `main`, sin duplicar Plan,
  Deuda ni Cierre que ya tenían la suya); `new-life-definitive` cambia de grupo `main` a `legacy`.
- `design-tokens.css`: se retira la regla `.cuadro-mandos-reserve` (min-width del campo), que quedó
  huérfana al mover el campo; la nota de solo lectura conserva su clase.
- Cinco archivos de test se reescriben (`e17-interface`, `navigation-structure`, `v1-4-relegar-hoy`,
  `v2-8-relegar-plan`, `v6-reserva-operativa`) porque afirmaban una estructura que esta entrega
  cambia a propósito; catorce más solo actualizan el canario de versión del shell. Dos ficheros
  nuevos (`t1-seis-vistas.test.cjs`, `v6-3-vista-ajustes.test.cjs`) prueban lo que añade esta
  entrega.

**Validación** (`npm run verify`, exit 0): **530/530 pruebas** (518 antes + 12 nuevas), **591 IDs
únicos**, diff 10.000 filas en **49.9 ms**, forecast y escenarios en **272.1 ms**, recursos **1266
KB**. QA de navegador servida desde `dist/`: **14/14 comprobaciones** en verde — las seis pestañas
en orden correcto, Plan/Deuda/Datos/Cierre/Ajustes navegan a su destino, Cuadro de mandos ya sin el
input de reserva y con nota de solo lectura, guardar la reserva en Ajustes se refleja de vuelta en
Cuadro de mandos, la tarjeta de Umbrales navega a `#alerts-center`, apagar «Versiones anteriores»
oculta la Simulación nueva vida definitiva recién relegada, el lanzador encuentra «Ajustes», y la
vista sigue activa tras recargar en `#ajustes` (deep link). Dos avisos de red ajenos al cambio —el
CDN de Supabase bloqueado en este entorno sin salida a internet, ya visto en entregas anteriores, y
un 404 puntual sin URL capturable en la primera pasada, no reproducido en una segunda—, ninguno
nuevo ni causado por esta entrega.

**Pendiente**: V6-2 (umbrales propios de colchón en meses, desviación por partida y ventana de
duplicados) y V6-4 (exportación única) siguen sin construirse; `#ajustes` ya tiene el hueco y el
enlace de vuelta a donde viven hoy. T-2 (acento navy) sigue independiente y sin empezar.

## Cierre de sesión — 11 de agosto de 2026: V4-4 confirmada y V1-4, la quinta relegación

**V4-4 pasa de 🟡 a ✅**: el usuario confirmó en el sitio publicado la importación en cuatro
pasos entregada el 10 de agosto. Con esto no queda ninguna tarea de prioridad Alta pendiente en
el backlog.

**V1-4** releva las cuatro últimas heredadas de Hoy que quedaban en el menú «Decidir» —
`#executive-advisor`, `#virtual-advisor`, `#savings-agent` y `#alerts-center`— a «Versiones
anteriores», el mismo patrón usado por V2-8, V3-5, V4-6 y V5-3. Con esta, diecisiete de las
dieciocho heredadas del inventario están relegadas; la única que queda fuera es
`#new-life-definitive`, que es pestaña principal y nunca fue una heredada que mover.

**Qué cambió, exactamente:**
- `index.html`: los cuatro enlaces salen de la sección «Decidir» del menú avanzado y entran en
  «Versiones anteriores», en la posición que tenían en el menú original —justo después de las
  tres de Deuda (V3-5) y antes de `#simulator`, la primera de las de V2-8—, siguiendo la misma
  regla de posición que las trece relegaciones anteriores.
- `e17-experience.js`: `#savings-agent` y `#alerts-center` solo cambian de grupo, porque ya
  tenían entrada en el lanzador. `#executive-advisor` y `#virtual-advisor` no la tenían —su único
  acceso era el nombre de su reemplazo, «Asesor ejecutivo (nuevo)»—, así que se les añade una,
  como ya se hizo con las dos heredadas de Deuda que tampoco la tenían en V3-5.
- Relegar no es desconectar: `data-home-nav="alerts-center"` (la tarjeta de Hoy) y
  `data-home-nav="savings-agent"` (el enlace de `#virtual-advisor`) siguen igual, y las cuatro
  vistas siguen pintándose por su `case` de siempre en `renderActiveSection`.
- `tests/v3-5-relegar-deuda.test.cjs` tenía una prueba que fijaba el grupo relegado en «trece
  pantallas» y afirmaba que estas cuatro seguían fuera «porque es trabajo de V1-4, no de V3-5» —
  cierto en su momento, falso ahora que V1-4 existe. Se ajusta para verificar solo lo que sigue
  siendo cierto: las tres de V3-5 siguen dentro y sin duplicados.

**Validación** (`npm run verify`, exit 0): **518/518 pruebas** (511 antes + 7 nuevas en
`tests/v1-4-relegar-hoy.test.cjs`), **585 IDs únicos**, diff 10.000 filas en **51.1 ms**,
forecast y escenarios en **332.5 ms**, recursos **1263 KB**. QA de navegador servida desde
`dist/`: 8/8 comprobaciones funcionales en verde (grupo `legacy`, el interruptor oculta el
encabezado y el enlace, el lanzador encuentra «Asesor ejecutivo» con el grupo apagado, las
cuatro vistas siguen renderizando al navegar directo). La QA registró además dos avisos de red
ajenos al cambio —el CDN de Supabase bloqueado en este entorno sin salida a internet, ya visto
en entregas anteriores, y un 404 puntual sin URL capturable que se reprodujo igual con el menú
recién abierto y sin relación aparente con los cuatro enlaces movidos—, ninguno de los dos
nuevo ni causado por esta entrega.

**Pendiente de decidir con el usuario:** T-1 («adoptar la navegación de seis vistas») no se
empezó todavía. El propio `BACKLOG.md` documenta que reordenar el menú principal es su trabajo,
y la vista de Ajustes (V6-3) —una de las seis— todavía no existe, así que un menú principal con
seis pestañas reales no es construible hoy sin decidir antes cómo tratar esa vista que falta.
Se traslada la pregunta al usuario en vez de asumir un alcance.

## Cierre de sesión — 10 de agosto de 2026: V4-4, importación en cuatro pasos

La única tarea de prioridad Alta que quedaba en el backlog, y la más grande: `#datos-importar`,
nueva pantalla al frente del grupo «Datos», con Cargar → Clasificar → Duplicados → Incorporar y
nada tocando el plan hasta el último paso.

**Lo que ya existía y se reutiliza tal cual, sin reinventarlo:**
- La reversibilidad («una sola entrada revertible del historial») es
  `FinanceCanonicalE5.createImportBatch`/`undoImportBatch`, la misma que ya usan
  `processDataRecords` y el importador de extracto de `#data-entry`. «Deshacer último lote» ya
  funciona sobre esta importación sin tocar ese botón.
- Las reglas previas son el mismo diccionario `movementMappings` que ya usa `#data-entry`
  (`mappingForMovement`/`movementMappingKey`/`exactMovementPlanningMatch`): una regla aprendida
  aquí sirve también allí, y viceversa.
- El aviso de mes cerrado reutiliza `isClosedMonthKey`.

**Lo que no existía y se construyó de cero:**
- El detector de duplicados por importe en una ventana de 7 días (`datosImportarDuplicateCandidates`)
  — lo único que existía antes era una colisión de identidad exacta, que `mergeTransactions` ya
  resolvía por sí sola sin necesitar preguntar nada.
- El registro de «Ignorar», guardado aparte del diccionario de reglas para no confundir «ignorado
  a propósito» con «sin regla todavía».
- La huella de contenido del fichero (para detectar «esto ya se importó») y el borrador que guarda
  la bandeja a medias y la retoma en el paso donde se dejó.

**Un fallo real que encontró la propia QA de navegador, no una revisión de código.** El primer
intento de «Deshacer último lote» sobre una importación guiada no devolvía los movimientos:
`appStatePayload` solo mete `baseData.transactions` en el «antes» del lote cuando
`baseData.metadata.sourceWorkbookStatus === "Leído desde la app"`, y ese campo solo lo pone
`refreshMovementRollups`. En una sesión que arranca sin haber tocado movimientos todavía —el caso
exacto que probó la QA sobre el sitio recién cargado—, ese campo no estaba puesto al fotografiar
el «antes», así que el lote no llevaba los movimientos y deshacerlo no podía devolverlos. Corregido
forzando `refreshMovementRollups()` antes de fotografiar, con una prueba de regresión y una
comprobación de navegador dedicada (deshacer dos lotes encadenados, verificando cada uno).

**Validación** (`npm run verify`, exit 0): **511/511 pruebas** (487 antes + 24 en
`tests/v4-4-importar-extracto.test.cjs`), accesibilidad (585 IDs únicos), rendimiento (diff 10.000
filas en 48,0 ms; forecast y escenarios en 218,7 ms; recursos 1263 KB), build público, privacidad
y smoke.

**QA en navegador real**, servida desde `dist/`: **21/21**, incluyendo un recorrido completo con
dos ficheros encadenados en la misma sesión —el demo público sirve `transactions: []` a propósito
por privacidad, así que el candidato a duplicado se generó importando primero un movimiento y
comparando después un segundo fichero contra él, no contra datos de fábrica—: bloqueo de
«Continuar» en los pasos 2 y 3 mientras queda algo sin decidir, un «Es duplicado» real que no
duplica el movimiento en la cartera, y el deshacer de los dos lotes uno a uno devolviendo cada
estado correctamente. Cero errores de página.

**Shell offline** a `20260810-v44a1`.

## Cierre de sesión — 10 de agosto de 2026: V3-5, las tres heredadas de Deuda a «Versiones anteriores»

La cuarta relegación, y la que V3-3 desbloqueaba: hasta que «Consolidar» no fue una estrategia real,
`#debt-liquidation-plan` era el único sitio donde se veía un orden de ataque completo.

**Qué se mueve.** `#debt-roadmap` (Plan de deuda), `#debt-liquidation-plan` (Plan deuda óptimo) y
`#debt-control` (Control de deuda) salen de «Decidir» y entran en «Versiones anteriores», en la
posición que tenían en el menú original —la regla que ya seguían las diez anteriores—. El grupo
relegado pasa de diez a **trece de las dieciocho heredadas**; las cinco que quedan son las cuatro de
Hoy (V1-4) y `#new-life-definitive`, que es pestaña principal.

**Lo que no se toca, y es la mitad del trabajo.** Relegar no es desconectar: la tarjeta de Hoy
(`data-home-nav="debt-control"`), el enlace «Simular deuda» de `#debt-liquidation-plan`, y los dos
botones de `#asesor-decision` que mandan a `#debt-roadmap` a **registrar y aplicar una oferta**
siguen exactamente igual. Ese último importa: `#debt-roadmap` es hoy el único sitio donde una oferta
tiene destino, así que desconectarla habría dejado el asesor apuntando al vacío.

**El agujero de alcance, otra vez cerrado a mano.** `#debt-liquidation-plan` y `#debt-control` no
tenían entrada en el lanzador; con el grupo apagado se habrían quedado sin ninguna vía desde el
nombre de la pantalla. Se añaden, como se hizo en V2-8 con las cuatro de Plan.

**Validación** (`npm run verify`, exit 0): **487/487 pruebas** (481 antes + 6 en
`tests/v3-5-relegar-deuda.test.cjs`), accesibilidad (579 IDs únicos), rendimiento (diff 10.000 filas
en 32,5 ms; forecast y escenarios en 239,0 ms; recursos 1225 KB), build público, privacidad y smoke.

**QA en navegador real**, servida desde `dist/`: **17/17**, cero errores de página. Incluye la
comprobación que de verdad importa —apagar «Versiones anteriores» y verificar que el lanzador y la
tarjeta de Hoy siguen abriendo las tres— y que el comparador conserva sus cuatro estrategias.

El canario de composición del menú (`tests/navigation-structure.test.cjs`) se actualiza a propósito:
trece en `legacy`, once en `analysis`, treinta en total. Y su comprobación sobre `#debt-roadmap` se
aprieta: antes bastaba con que apareciera tras los escenarios nuevos, cosa que también cumpliría
quedándose en «Decidir»; ahora se exige que esté dentro de «Versiones anteriores».

**Shell offline** a `20260810-v35a1`.

## Cierre de sesión — 10 de agosto de 2026: V3-3, «Consolidar» como cuarta estrategia real

La pantalla de comparar estrategias llevaba desde E20-2 con una nota al pie que decía que
reunificar no se podía comparar «porque exigiría inventar unas condiciones de préstamo (TAE, plazo)
que no existen todavía como oferta real en los datos». El diagnóstico era correcto y la salida
—no fabricar la oferta— también. Lo que faltaba era **pedirla**.

**La oferta.** Tres casillas en `#deuda-comparar`: TIN anual (%), plazo (meses) y comisión de
apertura (€, opcional). Se guardan en el almacén local del navegador con su propia clave
(`deuda-oferta-reunificacion`), **no en `state`**: una oferta de un tercero puede caducar o
descartarse sin que la contabilidad del hogar se mueva. Sobrevive a la recarga y hay un botón para
borrarla.

**La estrategia.** Una única decisión `reunificacion` sobre todos los contratos vivos, resuelta por
el mismo motor y en modo «óptimo» que las otras tres. El principal es la suma de los saldos más la
comisión, **financiada dentro del préstamo**: el motor no modela `comisiones` como flujo de caja
—lo dice su propia cabecera—, así que pasarla por ese campo la habría hecho desaparecer del cálculo
sin avisar. La cuota sale de la fórmula francesa; con TIN 0 % es principal/plazo, sin dividir entre
cero. El TIN viaja al motor en fracción, como exige el esquema, y la decisión se valida contra
`canonical-scenario-schema.js` real en las pruebas.

**Tres cosas que había que hacer bien para no mentir:**

- **El coste.** Una reunificación no lleva `params.importe`: no desembolsa nada. Sumarlo habría dado
  `0,00 €` y la habría hecho parecer gratis, además de ganar cualquier empate por coste en la
  recomendación. Su coste real —los intereses del préstamo nuevo— sale exacto de la propia oferta,
  así que es esa cifra la que se compara, y la tarjeta cambia su etiqueta a «Intereses del nuevo
  préstamo». Las otras tres conservan «Coste total ejecutado».
- **La gráfica.** `buildDeudaVivaSeries` solo descontaba deudas cerradas, así que una reunificación
  habría dibujado la deuda cayendo a cero el mes de la firma — que es exactamente la mentira que
  hace atractiva a una reunificación. Ahora el préstamo nuevo entra en la serie con su principal y
  se queda hasta agotar el plazo.
- **Sin oferta no hay cifras.** La tarjeta escribe «—» en las tres, por la misma razón que el modo
  degradado de T-5, y la nota dice qué falta. La ruta y su lista de comprobación dicen lo mismo en
  vez de un genérico «sin decisiones».

**Un fallo que encontró una prueba.** `Number(null)` vale 0, así que leer la oferta con
`Number.isFinite(Number(value))` convertía un TIN vacío en un TIN del 0 %: una oferta sin intereses
que nadie había hecho. El hueco se distingue del cero antes de convertir nada, con dos casos de
regresión.

**Lo que sigue fuera de la cifra, y se dice en pantalla:** cancelación anticipada de las deudas
viejas, notaría y seguros vinculados no se piden, así que no están.

**Validación** (`npm run verify`, exit 0): **481/481 pruebas** (460 antes + 21 en
`tests/v3-3-estrategia-consolidar.test.cjs`), accesibilidad (579 IDs únicos), rendimiento (diff
10.000 filas en 55,0 ms; forecast y escenarios en 278,1 ms; recursos 1225 KB), build público,
privacidad y smoke test.

**QA en navegador real**, servida desde `dist/`: **21/22 comprobaciones**, y la única que no pasa es
el CDN de Supabase, que este entorno bloquea y no tiene que ver con la entrega. `npm run
audit:escenarios` pasa a **17/17 con el motor** y **7/17 sin él** (la comprobación nueva pasa en los
dos modos: no depende del motor sino de la oferta).

**Shell offline** a `20260810-v33a1`.

## Cierre de sesión — 10 de agosto de 2026: T-5, que una pieza que falta se note

La otra mitad del fallo de ayer. Los canarios de `build-public-site.mjs` y `smoke-public.mjs`
impiden que un archivo se quede fuera del sitio; **T-5 cubre lo que pasa si aun así falta**, por
caché vieja, despliegue a medias o bloqueo de red.

**El aviso.** `renderScenarioDependencyNotice(viewId)` comprueba `FinanceCanonicalScenarioEngine` y
`FinanceCanonicalScenarioSchema`, y si falta alguno antepone a la sección un `e19-insight is-danger`
con `role="status"` —así lo recoge también un lector de pantalla— que nombra el archivo concreto y
dice lo que importa: «las cifras que falten no son ceros ni resultados, son cálculos que no se han
hecho». Lo llaman las cinco pantallas del motor. Repintar no apila avisos, y cuando la dependencia
vuelve el aviso se retira solo.

**Dos cosas más que fingían haber calculado.** No bastaba con avisar:

- El comparador escribía `0,00 €` en coste y caja mínima porque no había calculado nada, y un cero
  se lee como una respuesta. Ahora escribe «—» cuando falta el motor. Junto al aviso rojo, además,
  un 0,00 € era directamente contradictorio.
- `escenarioMotorAddDecision` hacía `if (schema) schema.validateDecision(...)`: **sin esquema no
  validaba nada y la decisión entraba igual**, que es peor que no poder añadirla. Ahora lo dice por
  el mismo sitio donde ya salen los errores del formulario, y no la añade.

**Una cifra que baja a propósito.** `npm run audit:escenarios` en modo degradado pasa de **8/16 a
6/16**. No es una regresión: la herramienta mide «¿devuelve cifras?», y las dos mejoras de arriba
cuentan ahí como comprobaciones rotas. Queda escrito en la cabecera de la herramienta y en §8 del
backlog para que nadie lo lea al revés. Con el motor sigue en **16/16**.

**Validación** (`npm run verify`, exit 0): **460/460 pruebas** (451 antes + 9 en
`tests/t5-aviso-dependencia.test.cjs`), accesibilidad (574 IDs únicos), rendimiento (diff 10.000
filas en 36,0 ms; forecast y escenarios en 244,7 ms; recursos 1211 KB), build público, privacidad y
smoke test.

**QA en navegador real**, servida desde `dist/` como exige ya la puerta de aceptación, en los dos
modos y **21/21 comprobaciones**: con el motor ninguna pantalla enseña aviso y el comparador sigue
dando cifras; sin el motor las cinco avisan, el aviso es anunciable, repintar no lo apila y el
comparador escribe «—» en vez de 0,00 €. Cero errores de consola en los dos modos.

Detalle que conviene recordar: `#escenario-aplicar` rebota a simular si no hay decisiones en curso,
así que su sección queda oculta a propósito. Para ella se comprueba que el aviso esté puesto, no que
se vea.

**Shell offline** a `20260810-t5a1`.

## Cierre de sesión — 10 de agosto de 2026: auditoría de lo que el sitio publicado enseñaba de verdad

No cambia producto. Comprueba y corrige lo que el backlog afirmaba.

**Por qué.** Al arreglar el motor de escenarios que faltaba en `dist` quedaron cinco tareas marcadas
✅ sobre pantallas que no podían haber funcionado en el sitio. Y ✅ significa, por la propia leyenda
del backlog, «visible en el sitio publicado».

**Método.** Ejecutar el mismo `dist` dos veces con Chromium: una tal cual, y otra sin
`canonical-scenario-*.js`, que es exactamente lo que Pages sirvió desde E20. La diferencia entre las
dos columnas es lo que el usuario no vio.

| Pantalla | Con el motor | Sin el motor (lo publicado) |
|---|---|---|
| `#deuda-comparar` | Tres estrategias con fecha, coste y recomendada | Fecha «—», coste 0,00 €, ninguna recomendada |
| `#deuda-ruta` | Tres pasos fechados con importe y estado | Importe sí, **mes «—» y «Sin calcular»** |
| `#escenario-simular` | Once tipos, impacto, gráfica y «Aplicar» activo | Once tipos y la decisión entra, pero **sin impacto, sin gráfica y «Aplicar» nunca se habilita** |
| `#escenario-aplicar` | Se abre con impacto y diff | **Inalcanzable**: su única entrada es ese botón |
| `#escenario-guardados` | Estado vacío correcto | Estado vacío correcto, y era verdad |

**16/16 con el motor · 8/16 sin él · cero errores de consola en los dos casos.** Ahí está por qué
nadie lo vio: no fallaba, se quedaba en blanco.

**Correcciones de estado.** V2-2 aguanta su ✅ sin matices —el catálogo de once tipos y sus
formularios se pintan sin tocar el motor—. V2-1, V3-2 y los mockups 1b, 1e y 2d conservan el ✅ con
la fecha corregida: el código estaba desde E20, **la función llegó al usuario el 10 de agosto**. V3-1
y el mockup 1c siguen en 🟡 por su motivo de siempre, que es independiente. Todo queda escrito en la
nueva §8 del backlog.

**Lo que se arregla del proceso, que es lo que importa.** `npm run verify` estaba en verde todo el
tiempo, y sigue estándolo: no faltaban pruebas, faltaba que alguna mirara el artefacto que se
publica. La QA de navegador se hacía contra la raíz del repositorio, donde **todo** resuelve, así que
un archivo que no se copia a `dist` funcionaba igual. Añadido como **punto 6 de la puerta de
aceptación**: la QA se sirve desde `dist/`, nunca desde la raíz.

**Una herramienta nueva, fuera de `verify`.** `npm run audit:escenarios` (`tools/audit-escenarios.mjs`)
recorre las cinco pantallas contra `dist` y exige que devuelvan cifras. Necesita Chromium y un
servidor, así que no entra en `verify`; se ejecuta a mano y sale distinto de cero si algo se queda en
blanco. Los canarios de ayer impiden que falte un archivo; esto comprueba lo otro, que las pantallas
hagan su trabajo de punta a punta.

**Y una tarea nueva: T-5.** Avisar en pantalla cuando falte una dependencia crítica, en vez de
quedarse en blanco. Hoy `runEscenarioMotor` devuelve `null` en silencio. No se ha hecho aquí porque
esta sesión no tocaba producto.

**Validación** (`npm run verify`, exit 0): **451/451 pruebas**, accesibilidad (574 IDs únicos),
rendimiento (diff 10.000 filas en 30,3 ms; forecast y escenarios en 155,2 ms; recursos 1207 KB),
build público, privacidad y smoke test. Esta sesión no cambia código de aplicación: las mismas 451.
`npm run audit:escenarios`: **16/16** contra el `dist` que despliega Pages, y **8/16** contra una
copia sin los dos archivos, que es lo que estuvo publicado.

## Cierre de sesión — 10 de agosto de 2026: V1-3, y un fallo de producción que salió al hacerla

**Lo pedido.** «Hoy» suma los KPI **Deuda pendiente** y **Libre de deuda**, los dos que le faltaban
para tener los tres del rediseño. Quedan seis tarjetas en dos filas de tres: arriba *Liquidez hoy*,
*Deuda pendiente* y *Libre de deuda* —los tres del mockup 4b—, y debajo *Capacidad libre real*,
*Reserva protegida* y *Próximo riesgo*.

Las dos cifras no se recalculan: salen del mismo camino que las de `#deuda-comparar`
(`escenarioMotorDebtOptions` para el capital vivo, `debtStrategySummary` para la fecha), de modo que
Hoy y Deuda no puedan contar historias distintas sobre la misma deuda. Comprobado en el navegador:
las dos pantallas dicen `jul 29 · queda deuda sin cuota activa`, carácter por carácter.

**Dos decisiones que no eran obvias.** La fecha que enseña Hoy es la de **«No tocar nada»**, no la de
la estrategia recomendada: Hoy es de solo lectura y no debe insinuar una decisión que el usuario no ha
tomado. Y la reserva que se le pasa es la del hogar, no `debtStrategyReserveValue` —lo que el usuario
haya escrito en la casilla del comparador—, para que una pantalla no mueva el número de otra sin
querer. Como «No tocar nada» no lleva decisiones, el guardarraíl ni se evalúa, así que la
independencia es estructural y no un cuidado que haya que recordar.

**El resultado se cachea por firma del modelo**, junto a las otras dos cachés que ya se limpian en
`recomputeModelIfNeeded`: sin eso, cada repintado de Hoy relanzaría el motor de escenarios. Medido en
el navegador: repintar Hoy queda en 163-195 ms, y el segundo y el tercero salen de caché.

---

**El fallo que apareció al validar, y que no era de esta tarea.** El KPI nuevo salía «—» en el
navegador. La causa no estaba en V1-3: **el sitio publicado llevaba desde E20 sin el motor de
escenarios**.

`tools/build-public-site.mjs` copia a `dist` una lista escrita a mano, y Pages despliega esa carpeta
(`path: dist` en `.github/workflows/pages.yml`). `canonical-scenario-schema.js` y
`canonical-scenario-engine.js` se añadieron al `index.html` en E20 y nunca se añadieron a la lista.
En local no se nota —se sirve el repositorio entero—; en producción `window.FinanceCanonicalScenarioEngine`
no existía, y todo lo que depende de él se quedaba sin cifras **en silencio**: el comparador de
estrategias, la ruta de deuda, el simulador de escenarios y, ahora, «Libre de deuda».

Por qué no lo cazó nada: `tools/smoke-public.mjs` comprobaba cinco recursos elegidos a mano, y
ninguno de los dos estaba entre ellos.

Arreglado en tres capas, para que no pueda repetirse:

1. Los dos archivos entran en la lista.
2. `build-public-site.mjs` compara ahora la lista con lo que el `index.html` carga de verdad y
   **rompe la construcción** si falta algo. Añadir un script y olvidar la lista deja de ser silencioso.
3. `smoke-public.mjs` pide **todos** los recursos locales del `index.html` construido, con su `?v=`,
   y exige 200 con contenido.

Los tres canarios se comprobaron al revés, quitando el archivo a propósito: la construcción falla con
el mensaje esperado y el smoke test también.

**Validación** (`npm run verify`, exit 0): **451/451 pruebas** (437 antes + 10 en
`tests/v1-3-kpi-deuda-en-hoy.test.cjs` + 4 en `tests/public-site-assets.test.cjs`), accesibilidad
(574 IDs únicos), rendimiento (diff 10.000 filas en 29,6 ms; forecast y escenarios en 149,0 ms;
recursos 1207 KB), build público, privacidad y smoke test.

**QA en navegador real** a 1440×900 y 390×844, **24/24 comprobaciones**: seis KPI en el orden del
rediseño, las dos cifras con valor real, Hoy y el comparador diciendo lo mismo, los dos CTA abriendo
`#deuda-ruta` y `#deuda-comparar`, tres columnas en escritorio y una en móvil, sin desbordamiento
horizontal y sin errores de consola.

**Una nota de alcance que conviene no perder.** Otras tarjetas de Hoy —«Ver saldos» y «Ver flujo»—
siguen saliendo hacia `#visual-detail` y `#cashflow`, que V2-8 relegó. No se ha tocado a propósito:
hoy no existe pantalla nueva que enseñe lo que esas dos enseñan, y repuntarlas a `#cuadro-mandos`
mandaría al usuario a algo que no es lo que promete el botón. Relegar nunca fue desconectar. Lo
resuelve **T-1**, cuando la navegación de seis vistas decida qué enseña cada sitio.

**Shell offline** a `20260810-v13a1`.

**Confirmado por el usuario el 10 de agosto**: ve las diez pantallas bajo «Versiones anteriores» en
el sitio publicado, así que **T-0, V4-6, V5-3 y V2-8 pasan de 🟡 a ✅**. V1-3 queda en 🟡 hasta la
misma confirmación.

## Cierre de sesión — 10 de agosto de 2026: V2-8, la relegación más grande

`#new-life-simulation`, `#simulator`, `#visual-detail`, `#savings-plan` y `#cashflow` salen de
«Herramientas avanzadas › Decidir y Analizar» y pasan a «Versiones anteriores», que queda con **diez
pantallas** de las dieciocho heredadas. Decidir y Analizar bajan de dieciocho enlaces a catorce, y
los cuatro que se quedan de la vista Plan —«Cuadro de mandos (nuevo)», «Cambios pendientes (nuevo)»,
«Mapa de calor (nuevo)» y «Previsión mensual»— son los de la piel nueva.

**Un defecto en el enunciado de la tarea: `#forecast` no era una heredada.** El backlog pedía mover
seis pantallas, y la sexta era `#forecast`. Pero su propio inventario lo cuenta entre las dieciséis
con piel nueva —la sección lleva la clase `e19-forecast`— y el menú principal la usa como la pestaña
«Prever». Relegarla habría degradado una pantalla ya migrada y habría dejado una pestaña de primer
nivel apuntando a «Versiones anteriores». Se queda donde está, y el backlog queda corregido en las
dos tablas que se contradecían. Reordenar el menú principal es trabajo de T-1, no de una relegación.

**Un agujero de alcance que abría esta misma relegación.** `#simulator`, `#savings-plan`, `#cashflow`
y `#visual-detail` no tenían entrada en el lanzador, y las tres primeras solo se alcanzaban desde el
menú avanzado. Relegarlas sin más habría hecho que apagar «Versiones anteriores» las dejara sin
ninguna vía. Como relegar no es desconectar, la relegación les añade su entrada en el lanzador.
`#visual-detail` gana además su primer enlace de menú: nunca lo tuvo, solo se llegaba por tarjetas de
ruta, así que aquí queda **más** localizable que antes, no menos.

**El orden dentro del grupo.** Con diez enlaces, «Versiones anteriores» pasa a espejar el orden del
propio menú: primero lo que estaba en Decidir y Analizar (V2-8), luego Datos (V4-6) y por último
Cierre (V5-3). Quien las buscara donde solían estar las encuentra en la misma posición relativa.

**Lo que no se ha tocado.** Las tarjetas de ruta (`data-home-nav`) hacia `#visual-detail`,
`#cashflow` y `#new-life-simulation` siguen en pie, igual que el siguiente paso sugerido
(`target = "visual-detail"`) y los cinco `case` de render.

**Validación** (`npm run verify`, exit 0): **437/437 pruebas** (431 antes + 6 nuevas en
`tests/v2-8-relegar-plan.test.cjs`), accesibilidad (574 IDs únicos), rendimiento (diff 10.000 filas
en 31,1 ms; forecast y escenarios en 169,8 ms; recursos 1204 KB), build público, privacidad y smoke
test.

**QA en navegador real** a 1280×720 y 390×844, **30/30 comprobaciones**: diez enlaces en el grupo y
en el orden esperado; Decidir y Analizar en catorce; las nuevas de Plan y la pestaña «Prever» en su
sitio; las cinco relegadas abren desde el grupo; apagar el grupo esconde las diez y su encabezado sin
tocar Decidir ni Analizar; con el grupo apagado el lanzador sigue abriendo el Simulador; volver a
encenderlo restaura las diez y sobrevive a la recarga.

**Shell offline** a `20260810-v28a1`.

**Sigue en 🟡, no en ✅**, por la misma razón que las anteriores: el despliegue de Pages termina en
verde, pero desde este entorno no hay salida hacia `javierbarriusom-a11y.github.io`, así que no puedo
comprobar el sitio publicado. Pasa a ✅ cuando el usuario confirme que lo ve.

## Cierre de sesión — 10 de agosto de 2026: V5-3, la segunda relegación

`#reconciliation`, `#data-audit` y `#operations-manual` salen de «Herramientas avanzadas › Datos» y
pasan a «Versiones anteriores», que queda con **cinco pantallas**. Datos se queda con tres, y las
tres son de la piel nueva o siguen siendo la vía principal: «Registrar el mes (nuevo)», «Carga de
datos» y «Conciliación (nuevo)».

**Por qué esta era la siguiente y no V2-8 o V1-4.** Su pantalla nueva, `#conciliar`, está en ✅ desde
E20-2, así que la función de cierre ya vive completa en la versión nueva. Las otras tres vistas
tienen su pantalla nueva a medias, que es justo el caso donde el backlog aconseja esperar.

**Y por qué `#data-audit` se relega en vez de retirarse.** V5-2 —el panel «Confianza del dato» por
cuenta— sigue pendiente, y parte de esa información vive hoy en `#data-audit`. Relegar la deja
alcanzable exactamente para eso: es el caso de uso que justifica que «Versiones anteriores» exista.
Las alertas siguen abriéndola como destino por defecto (`button.dataset.alertTarget || "data-audit"`).

**Lo que no se ha tocado.** El hub de Actualizar conserva su tarjeta «Comprobar» hacia
`#reconciliation` y su siguiente paso sugerido. `#operations-manual` sigue en pie: la guía por flujo
de A13-6 vive en su propio diálogo (`#e17FlowGuideDialog`), así que relegar la pantalla no deja a
nadie sin guía.

**Un canario nuevo de estructura.** La composición completa del menú avanzado se comprueba ahora en
`tests/navigation-structure.test.cjs` (grupos exactos y número total de enlaces). Cada relegación lo
actualizará a propósito; una pantalla que desapareciera del menú sin querer romperá esa prueba en vez
de pasar inadvertida. Las pruebas por tarea afirman solo lo que movió cada una.

**Validación** (`npm run verify`, exit 0): **431/431 pruebas** (425 antes + 5 nuevas en
`tests/v5-3-relegar-cierre.test.cjs` + 1 canario), accesibilidad (574 IDs únicos), rendimiento (diff
10.000 filas en 33,4 ms; forecast y escenarios en 338,7 ms; recursos 1204 KB), build público,
privacidad y smoke test.

**QA en navegador real** a 1280×720 y 390×844: cinco enlaces en Versiones anteriores y tres en Datos;
las tres relegadas abren desde el grupo; el hub sigue llevando a la conciliación anterior y
`#conciliar` sigue en su sitio; apagar el grupo esconde las cinco sin tocar Datos; con el grupo
apagado el lanzador sigue abriendo Conciliar; «Ver navegación completa» devuelve las cinco. Sin
errores de consola propios ni desbordamiento.

**Shell offline** a `20260810-v53a1`.

## Cierre de sesión — 10 de agosto de 2026: V4-6, la primera relegación de verdad

La que estrena el grupo que T-0 dejó puesto. `#update-data` («Registrar reales del mes») y
`#movements` salen de «Herramientas avanzadas › Datos» y pasan a **«Versiones anteriores»**, que con
esto aparece por primera vez en el menú junto a su interruptor en «Personalizar».

**Por qué esta y no V1-4.** El backlog recomienda cerrar la 🟡 de una vista antes de relegar su
heredada, y Hoy tiene el asesor nuevo todavía a medias. Datos es el caso limpio: las dos pantallas
relegadas **siguen alcanzables desde el hub de Actualizar**, que continúa enrutando a ellas en los
pasos «Lo ocurrido» y «Extracto bancario». Relegar mueve el menú; no desconecta nada.

**Alcance, dicho sin ambigüedad.** Se movieron los dos enlaces del menú y se marcó `movements` como
`legacy` en el catálogo del lanzador (metadato descriptivo: `findTasks` no filtra por grupo). **No**
se repuntaron las tarjetas del hub a las pantallas nuevas: eso cambiaría el flujo de trabajo, y
`#registrar-mes` sigue en 🟡 y la importación por decisión (V4-4) no existe todavía. Cuando esas dos
cierren, repuntar el hub será su tarea, no la de una relegación.

**Un fallo de prueba que salió a la luz.** `tests/navigation-structure.test.cjs` localizaba el
encabezado con `html.indexOf('class="advanced-nav-label">Datos')`. Al añadirle `data-e17-nav-label`
en T-0, esa búsqueda pasó a devolver -1 y la comparación de orden **pasaba sola sin comprobar nada**.
Ahora se localiza por el atributo y la prueba vuelve a afirmar algo: Datos conserva sus pantallas y
Movimientos está detrás del encabezado de Versiones anteriores.

**Validación** (`npm run verify`, exit 0): **425/425 pruebas** (420 antes + 5 nuevas en
`tests/v4-6-relegar-datos.test.cjs`), accesibilidad (574 IDs únicos), rendimiento (diff 10.000 filas
en 34,4 ms; forecast y escenarios en 184,9 ms; recursos 1204 KB), build público, privacidad y smoke.

**QA en navegador real** a 1280×720 y 390×844: el grupo aparece con sus dos enlaces y Datos se queda
con seis; Movimientos abre desde el grupo relegado; el hub sigue llevando a Registrar reales; el
interruptor esconde grupo y encabezado; con el grupo apagado el lanzador sigue encontrando y abriendo
Movimientos; «Ver navegación completa» lo devuelve. Sin errores de consola propios ni desbordamiento.

**Shell offline** a `20260810-v46a1`.

## Cierre de sesión — 10 de agosto de 2026: T-0, el contenedor de «Versiones anteriores»

Segunda tarea del backlog nuevo. T-0 es el mecanismo que habilita las cinco relegaciones (V1-4, V2-8,
V3-5, V4-6 y V5-3); **no mueve todavía ninguna pantalla**, eso es de cada una de esas cinco.

**Qué se ha hecho.** La preferencia `legacy` en `e17Preferences()`, el encabezado «Versiones
anteriores» en el menú avanzado y su interruptor en «Personalizar». Nace **visible**, que era la
recomendación del backlog: relegar una pantalla no puede parecerse a perderla.

**La decisión de diseño que evita una UI colgando.** Un encabezado sin enlaces debajo no dice nada, y
un interruptor de un grupo vacío no tiene nada que encender: ambos se ocultan solos. Por eso, hoy,
T-0 **no se ve** — el encabezado y la casilla aparecerán en cuanto la primera relegación llene el
grupo. La regla es genérica, así que de paso arregla un detalle viejo: apagar «Análisis» dejaba su
etiqueta flotando sobre la nada.

**Lo que garantiza que relegar no sea perder.** «Buscar o abrir» busca sobre el catálogo entero de
`e17-experience.js` y no consulta estas preferencias: con el grupo apagado, la pantalla heredada
sigue encontrándose por su nombre. Queda cubierto por una prueba, para que nadie ate el lanzador a
las preferencias del menú sin darse cuenta.

**Validación** (`npm run verify`, exit 0): **420/420 pruebas** (412 antes + 8 nuevas en
`tests/t0-versiones-anteriores.test.cjs`), accesibilidad (574 IDs únicos), rendimiento (diff 10.000
filas en 31,6 ms; forecast y escenarios en 174,6 ms; recursos 1204 KB), build público, privacidad y
smoke test.

**QA en navegador real** a 1280×720 y 390×844, sobre el sitio construido: con el grupo vacío no
aparecen ni encabezado ni interruptor; inyectando un enlace `legacy` —lo que hará V1-4— aparecen los
dos; apagar el grupo esconde enlace y encabezado; «Ver navegación completa» devuelve `legacy: true`;
y con el grupo apagado el lanzador sigue devolviendo la pantalla. Sin errores de consola propios ni
desbordamiento horizontal.

**Shell offline** a `20260810-t0a1`, con las pruebas que fijan la versión actualizadas.

## Cierre de sesión — 10 de agosto de 2026: V6-1, la reserva operativa deja de ser un número inalcanzable

Primera tarea del backlog nuevo, y la que este señalaba como más desproporcionada: `state.operatingReserve`
lo leían tres pantallas publicadas y **no había forma de fijarlo**, así que valía siempre 0 y las tres caían
a su respaldo. Ahora hay un control real.

**Qué se ha hecho.** Una casilla «Reserva operativa» en la fila de controles de `#cuadro-mandos`, junto a
«Desde» y «Horizonte». Escribe `state.operatingReserve`, se guarda en `scenarioSettings` —o sea, se
sincroniza y se restaura como un dato más del hogar, no como una preferencia del navegador— y con eso las
tres pantallas dejan de fingir: el pie de impacto pasa a decir «meses bajo la reserva de X €» en vez de
«meses en negativo», el mapa de calor colorea contra la reserva real y el comparador de deuda hereda la
cifra como guardarraíl en lugar del suelo de 0 €.

**Tres decisiones que no eran obvias.**

- **Vacío significa «sin reserva configurada», no cero.** Vaciar la casilla devuelve a cada pantalla su
  respaldo declarado, que es exactamente el estado anterior a esta tarea; nada queda a medias.
- **Se declara siempre de dónde sale la cifra.** Una nota bajo la matriz dice qué suelo está en uso y a qué
  tres sitios afecta; la casilla del comparador de deuda dice si su número viene de la reserva del hogar o
  es un valor puesto solo para esa comparación. Antes se heredaba en silencio.
- **La reserva entra en la firma del modelo** (`modelComputationSignature`) aunque no mueva ni un euro de la
  proyección: es la política con la que se evalúa la corrida diaria, y sin eso el mínimo diario se habría
  seguido juzgando con la reserva anterior.

**No se ha hecho** la vista `#ajustes` completa (V6-3): el control vive en el Cuadro de mandos hasta que esa
vista exista, que es donde acabará mudándose.

**De paso, un arreglo real de caché.** El shell offline seguía en `finanzas-casa-shell-20260808-e19a4`
desde E19: el service worker sirve `cache-first` con `ignoreSearch`, así que **cambiar el `?v=` de un
recurso no sirve de nada** y los cambios de E20 no llegaban a quien ya tuviera el shell instalado. Se sube a
`20260810-v6a1` y se actualizan las siete pruebas que fijaban la versión anterior.

**Validación** (`npm run verify`, exit 0): **412/412 pruebas** (403 antes + 9 nuevas en
`tests/v6-reserva-operativa.test.cjs`), accesibilidad (574 IDs únicos), rendimiento (diff 10.000 filas en
51,3 ms; forecast y escenarios en 205,1 ms; recursos 1202 KB), build público, privacidad y smoke test.

**QA en navegador real** sobre el sitio construido, a 1280×720 y 390×844: fijar 2.000 € actualiza la nota,
el subtítulo del mapa de calor y la casilla del comparador; la cifra sobrevive a la recarga; vaciarla vuelve
al respaldo; sin errores de consola propios ni desbordamiento horizontal en ninguna de las dos medidas.

Las pruebas de V6-1 no son solo coincidencias de texto: extraen las funciones de `app.js` por nombre y las
ejecutan en un contexto `vm`, así que cubren de verdad el parseo, el vaciado, el importe negativo, la
no-escritura cuando el valor no cambia y las dos ramas de cada nota.

**Publicación y cierre.** PR #5 fusionada con CI en verde; el despliegue de Pages terminó con éxito para
`956e427`. La comprobación en el sitio publicado —el cuarto punto de la puerta de aceptación— la hizo el
usuario, porque el entorno de la sesión tiene bloqueada la salida hacia `github.io` y no se pudo abrir la
página desde aquí. Con esa confirmación, **V6-1 pasa a ✅**.

## Cierre de sesión — 10 de agosto de 2026: E20-5, cambio de sede y backlog rehecho

Sesión larga con tres tramos: se terminó el turno 3 de mockups, se movió el proyecto de
repositorio y se rehizo el backlog entero.

**1. E20-5 · Cuadro de mandos con impacto (3a/3b/3c).** Cierra el turno 3 y con él los quince
mockups de los turnos 1-3. Tres pantallas nuevas: `#cuadro-mandos` (matriz editable con pie de
impacto), `#cambios-pendientes` (efecto conjunto de la sesión, reversible línea a línea) y
`#mapa-calor` (salud mensual por color). Lo importante no se ve: las tres reutilizan el almacén de
borradores `visualDraftCells` de `#visual-detail` en vez de crear uno nuevo — dos almacenes
habrían dado dos verdades sobre qué está sin guardar. Tres omisiones documentadas a propósito: la
fecha libre de deuda no entra en el pie (editar un previsto no toca ningún contrato de deuda),
«todos los meses» es «todo el rango visible» (el horizonte real son 126 meses) y el panel de
recomendaciones de 3c no se migró porque exigiría inventar un motor que no existe. Fusionado como
PR #8 en el repositorio antiguo.

**2. Cambio de sede.** Decisión expresa del usuario: **`contabilidadcasa` es el proyecto vivo y
`finanzas-casa-def` queda congelado**. Es la inversión de la regla vigente hasta hoy. Antes de
ejecutarla se pidió confirmación, porque el mensaje del usuario contenía dos instrucciones
incompatibles y la operación es difícil de deshacer. Se volcó aquí todo lo que faltaba (E20-1 a
E20-5, `docs/` completo y la skill de flujo de trabajo, reapuntada), y se dejó anotado en el
repositorio congelado —arriba del todo en su `CLAUDE.md` y `PROJECT_STATE.md`— que la sede se
movió. Dos cosas no se copiaron tal cual, a propósito: se conservó el `pages.yml` de este
repositorio (trae el arreglo de habilitación automática de Pages que el otro no tiene) y volvió
`availability.yml` apuntando ya a esta URL.

**3. Backlog rehecho.** `BACKLOG.md` pasa a ser el vigente, organizado por las seis vistas del
rediseño más un bloque transversal, con el estado medido sobre el código publicado.
`BACKLOG_STATUS.md` queda como registro histórico de E1-E20 con un aviso que remite al nuevo. Tres
hallazgos que los documentos no recogían: la app tiene **34 pantallas, no 22** (16 con piel nueva,
18 heredadas), de las seis vistas **cinco tienen su función publicada y Ajustes no existe**, y
**`state.operatingReserve` no tiene ningún control en la interfaz** pese a que tres pantallas
publicadas lo necesitan — hoy degrada el pie de impacto, el mapa de calor y el comparador de deuda.

**4. «Versiones anteriores».** Decisión del usuario que desbloquea el rediseño: las pantallas
heredadas no se retiran, se mueven a una sección «Versiones anteriores». Cinco tareas pasan de
bloqueadas a pendientes (V1-4, V2-8, V3-5, V4-6, V5-3), T-1 deja de ser bloqueante, aparece T-0 —el
grupo en sí— y T-4 cambia de significado y sigue bloqueada a propósito, porque retirar de verdad
una heredada conviene decidirlo con datos de uso. Se verificó antes de escribirlo que el mecanismo
ya existe en E17 (`data-e17-group`, `e17Preferences()` en `app.js:371`, `applyE17Preferences()` en
`app.js:379`), así que la tarea es pequeña.

**Validación de cierre** (`npm run verify`, exit 0): **403/403 pruebas**, accesibilidad
(571 IDs únicos), rendimiento (diff 10.000 filas en 43,3 ms; forecast y escenarios en 347,3 ms;
recursos 1198 KB), build público, privacidad y smoke test.

**Publicado.** Nada queda pendiente de publicar: PR #1, #2 y #3 de este repositorio fusionados a
`main` (`808867e`), árbol limpio, y el despliegue de Pages verificado desde fuera del sandbox con
el chequeo de disponibilidad, que pasó en verde sobre el commit de `main`. El documento de
propuesta compartido con el usuario se actualizó a documento de estado en su misma URL.

**Siguiente**: V6-1, el control de reserva operativa. Es la tarea más barata del backlog y la que
más desbloquea: arregla tres pantallas ya publicadas sin tocarlas.

## «Versiones anteriores»: la decisión que desbloquea el rediseño

Decisión del usuario del 10 de agosto de 2026, por la tarde:

> «En vez de quitar las pantallas fusionadas, pasarlas a una sección tipo *Versiones
> anteriores*.»

Esta mañana el backlog decía que T-1 —adoptar o no la arquitectura de seis vistas— bloqueaba
catorce tareas, y proponía esperar. Ya no. El bloqueo era la pregunta «¿retiramos pantallas que
hoy funcionan?», y con esa pregunta cualquier respuesta tenía coste: retirar arriesga perder
función sin darse cuenta, y no retirar deja la app en 34 pantallas y creciendo. Relegar en vez de
retirar no es un punto intermedio, es una tercera opción sin ese coste: la navegación principal
queda en seis vistas —el beneficio entero del rediseño— y la función heredada sigue alcanzable
—el riesgo entero, eliminado—.

El mecanismo ya existe, así que la tarea es pequeña: cada enlace lleva `data-e17-group` en
`index.html`, `e17Preferences()` (`app.js:371`) guarda un booleano por grupo y
`applyE17Preferences()` (`app.js:379`) oculta los enlaces del grupo apagado. Añadir «Versiones
anteriores» es un grupo `legacy` más, reetiquetar los 18 enlaces heredados, un encabezado en el
menú y un interruptor en «Personalizar». Nada de eso toca cálculo, contrato de guardado ni
pantallas.

Cambios en el backlog: cinco tareas pasan de ⛔ a ⏳ (V1-4, V2-8, V3-5, V4-6, V5-3), T-1 deja de
ser bloqueante, T-2 (el acento navy) se separa como decisión estética independiente, aparece T-0
—el grupo en sí— y T-4 cambia de significado: ya no es «reducir el número de pantallas» sino
«retirar de verdad una heredada», que sigue en ⛔ a propósito porque conviene esperar datos de
uso en vez de decidirlo por intuición.

Queda una subdecisión menor y reversible: si el grupo nace visible o plegado. La recomendación
escrita es visible, porque el primer día no cambia nada para quien esté a mitad de una tarea y
plegarlo después es el mismo interruptor.

Sin cambios de código en esta entrada: documentación (`BACKLOG.md` §3 y §5,
`docs/E19_SISTEMA_DISENO.md` §10). 403/403 pruebas.

## Backlog rehecho — seis vistas × evolución funcional

A petición del usuario se rehace el backlog fusionando las fases del rediseño a seis vistas con
la evolución funcional, y midiendo el estado **sobre el código publicado**, no sobre el plan. El
resultado es `BACKLOG.md`, que pasa a ser el backlog vigente; `BACKLOG_STATUS.md` queda como
registro histórico de E1-E20 con un aviso arriba que remite al nuevo.

Lo que salió del recuento, que no coincidía con lo que decían los documentos:

- **La app tiene 34 pantallas, no 22.** El rediseño se dibujó con 22 y proponía reducirlas a 6;
  desde entonces cada mockup migrado se añadió junto a la heredada, así que el trabajo hecho ha
  mejorado la app y a la vez ha alejado el objetivo. 16 pantallas llevan la piel nueva, 18 siguen
  heredadas.
- **Los quince mockups de los turnos 1-3 están migrados**, cinco de ellos con omisiones
  documentadas (1c, 1d, 2a, 2e, 3c).
- **De las seis vistas del rediseño, cinco tienen su función construida y publicada, ninguna
  existe como vista única, y la sexta —Ajustes— no existe en absoluto.**

El hallazgo con más consecuencias: **`state.operatingReserve` no tiene ningún control en toda la
interfaz** (cero apariciones en `index.html`). El modelo la lee y tres pantallas ya publicadas la
necesitan, así que hoy el pie de impacto cae a «meses en negativo» en vez de «meses bajo
reserva», el mapa de calor colorea contra un mes de salidas en vez de contra la reserva real, y el
comparador de deuda usa un suelo de 0 €. Es la tarea más barata del backlog y la que más
desbloquea, así que queda como primera recomendada (V6-1).

También queda medido lo que bloquea la decisión aplazada: **T-1 —adoptar o no la arquitectura de
seis vistas— bloquea catorce tareas**, todas las fusiones de pares nueva/heredada. El documento
propone un camino intermedio que no la necesita: cerrar antes las cinco pantallas marcadas como
parciales, con lo que retirar la heredada correspondiente deja de ser una apuesta.

Sin cambios de código en esta entrada: solo documentación.

## Cambio de sede — este repositorio pasa a ser el vivo

Decisión expresa del usuario el 10 de agosto de 2026: **`contabilidadcasa` es el proyecto vivo y
`finanzas-casa-def` queda congelado a partir de ahora.** Es exactamente la inversión de lo que
regía hasta ese día, así que conviene dejarlo dicho sin ambigüedad:

- Todo el desarrollo, commits, push y despliegue van a **este** repositorio, publicado en
  `https://javierbarriusom-a11y.github.io/contabilidadcasa/`.
- `finanzas-casa-def` conserva su historial completo hasta E20-5 y su sitio sigue en pie tal y
  como quedó el 10 de agosto, pero no recibe más cambios.

Qué se ha volcado en este cambio de sede. Este repositorio nació el 9 de agosto como foto fija de
un momento dado (E19 completo + E20-0 días 1-4), así que le faltaba **todo E20-1 a E20-5**:

- **E20-1**: el motor de Escenario en la interfaz (`#escenario-simular`, `#escenario-aplicar`,
  `#escenario-guardados`).
- **E20-2**: comparador de estrategias de deuda, plan de deuda como ruta, conciliación por tareas
  y asesor ejecutivo.
- **E20-3**: los once tipos de decisión de `#escenario-simular`, validados contra el contrato.
- **E20-4**: «Registrar el mes» (`#registrar-mes`).
- **E20-5**: el cuadro de mandos con impacto (`#cuadro-mandos`, `#cambios-pendientes`,
  `#mapa-calor`).
- La carpeta `docs/` entera, incluido el sistema de diseño E19 y el material de mockups con el
  rediseño a seis vistas.
- La skill de flujo de trabajo en `.claude/`, reapuntada a este repositorio.

Dos cosas que **no** se copiaron tal cual, a propósito:

- **`pages.yml` se conserva el de aquí**, no el del repositorio congelado: el de aquí trae el
  arreglo de habilitación automática de Pages (`enablement: true` y el permiso `pages: write`) que
  el otro no tiene. Sobrescribirlo habría sido una regresión.
- **`availability.yml` vuelve**, apuntando ya a la URL de este sitio. Se había quitado
  deliberadamente cuando esto era una foto fija sin mantenimiento; ahora que es el sitio vivo, el
  chequeo de disponibilidad recurrente tiene sentido otra vez.

Validación tras el volcado (`npm run verify`, exit 0): 403/403 pruebas, accesibilidad
(571 IDs únicos), rendimiento, build público, privacidad y smoke test.

## Cierre de sesión — E20-5: el cuadro de mandos con impacto (3a/3b/3c)

Se cierran los tres mockups del turno 3 y con ellos **los quince de los turnos 1-3**. Tres
pantallas nuevas, ninguna sustituye a nada:

- **`#cuadro-mandos`** (3a): matriz partida × mes con el previsto editable, secciones plegables,
  barra «Aplicar a» bajo la celda tocada (solo ese mes / hasta diciembre / todo el rango visible) y
  un pie de impacto fijo con mínimo del horizonte, meses bajo reserva y liquidez final, cada cifra
  con su valor anterior tachado.
- **`#cambios-pendientes`** (3b): el efecto conjunto de la sesión, con cuatro KPI antes → después,
  la lista de cambios ordenada por impacto real y reversible línea a línea, y un gráfico
  guardado / con tus cambios mes a mes.
- **`#mapa-calor`** (3c): un color por mes según colchón, resultado o ahorro, con el desglose por
  bloques del peor mes.

Lo que no se ve y es lo importante: **no hay un almacén de borradores nuevo**. Las tres reutilizan
`visualDraftCells`, el mismo que `#visual-detail` usa desde E11, y «Guardar» es literalmente
`saveVisualChanges`. Comprobado en navegador: al editar una celda en el cuadro de mandos, la
pantalla heredada anuncia «1 cambio(s) pendiente(s)»; al guardar, `seriesOverrides` recibe
`expense|expense-home|2026-08 → {planned: 1500}`. Montar un segundo sistema habría dado dos
verdades distintas sobre qué está sin guardar, que es justo el fallo que estas pantallas evitan.

El impacto se calcula aplicando los borradores sobre `seriesOverrides` de forma temporal y
corriendo el motor canónico sin `engineContext`, para no persistir el escenario ni contaminar otras
pantallas; el estado se restaura en un `finally`. Si el motor rechaza la combinación, el pie dice
que no se ha podido calcular en vez de enseñar una cifra inventada.

Decisiones tomadas y dichas, no escondidas:

- **La fecha libre de deuda no está en el pie**, aunque el mockup la incluya: editar el previsto de
  una partida no toca ningún contrato de deuda, así que ese dato diría «sin cambio» siempre.
- **«Ordenado por impacto» se calcula de verdad** (*leave-one-out*): el número es lo que devolvería
  pulsar «Revertir». Por encima de ocho cambios se ordena por importe y el rótulo lo dice.
- **«Todos los meses» es «todo el rango visible»**: el horizonte real son 126 meses y sembrar 126
  borradores de un clic sería una trampa.
- **El mapa marca los meses tocados, no todos los que cambian de cifra**: la liquidez es acumulada
  y marcar el resto pintaría el mapa entero sin decir nada.
- **No se ha migrado el panel «Qué hacer con estos cuatro meses»** de 3c, que propone acciones
  calculadas («mover la matrícula a septiembre: agosto pasa de 1.430 € a 1.950 €»). Eso es un motor
  de recomendaciones que no existe. En su lugar, enlaces a las pantallas que sí pueden actuar sobre
  ese mes y el desglose real de qué bloques pesan. Por eso 3c queda como migrada **parcial**.

Validación de cierre (`npm run verify`, exit 0): **403/403 pruebas**, accesibilidad (571 IDs
únicos), rendimiento (diff 10.000 filas en 45,0 ms; forecast y escenarios en 268,0 ms; recursos
1198 KB), build público, privacidad y smoke test. QA en navegador a 1440 px y 390×844 sin
desbordamiento horizontal ni errores de consola propios.

`BACKLOG_STATUS.md` queda actualizado: E19 y E20 entran en la tabla maestra como verificadas y el
«próximo objetivo recomendado» deja de apuntar a E18. La cola de diseño queda vacía; lo abierto es
la decisión sobre el rediseño a seis vistas, las omisiones documentadas de E20 y E10.

## Publicación — PR #6 fusionado a `main`

E20-4 queda publicado: PR #6 fusionado por squash (`c646d7f`) con el CI del repositorio en
verde. Validación repetida sobre el `main` ya fusionado: 403/403 pruebas, accesibilidad
(545 IDs únicos), rendimiento, build público, privacidad y smoke test.

Con esto, el catálogo de mockups de los turnos 1-3 queda **cerrado salvo 3a/3b/3c**: los
quince de los tres primeros turnos están migrados menos el cuadro de mandos con impacto, que
es el siguiente objetivo y que ya cuenta con la tabla editable de `#registrar-mes` como base
y con la especificación escrita del turno 5. La decisión sobre el rediseño a seis vistas
(turnos 4-5) sigue deliberadamente aplazada.

Cambio de proceso registrado en `CLAUDE.md`: a petición del usuario, el ciclo validar →
actualizar estado → commit → push → PR → fusionar en verde se ejecuta de principio a fin sin
pedir permiso turno a turno. Esto **anula el paso 4 del Modo Cierre** de la skill
`finanzas-casa-workflow`. Siguen en pie los frenos: no se publica nada en rojo, nunca push
directo a `main`, nunca hacia `contabilidadcasa`, y cualquier cambio que vaya más allá de lo
pedido, borre datos o retire una pantalla en uso se sigue consultando.

## Cierre de sesión — E20-4: «Registrar el mes» (mockup 2a)

Se migra 2a, el único pendiente del turno 2, como pantalla nueva **`#registrar-mes`** junto a
`#update-data`, sin retirar la heredada. Las dos escriben en el mismo almacén
(`incomeActuals` / `expenseActuals`): un real anotado en una aparece en la otra sin migrar
ningún dato, comprobado en navegador en ambas direcciones.

La diferencia real con la heredada es que la lista es **plana**: una fila por partida, sin
acordeón. En `#update-data` un real vive detrás de un bloque cerrado; aquí las 29 partidas del
mes están a la vista, con el filtro «Sin real» activo de entrada porque esa es la tarea.

Lo que trae la pantalla:

- Titular calculado («Agosto va 2,40 € por encima de lo previsto»), cuatro KPI —ingresos
  usado, gastos usado, margen del mes con su previsto al lado, y «Completado» con barra y
  recuento— y dos tarjetas (Gastos e Ingresos) con segmentado `Sin real` · `Con desviación` ·
  `Todo` y contadores.
- Guardado automático al salir de la casilla, con la hora del último guardado en la insignia.
- Añadir partida al mes, quitar solo las añadidas aquí, y copiar los reales del mes anterior
  con confirmación previa que dice cuántos son y de qué mes.

Decisiones tomadas y por qué, sin esconderlas:

- **Guardar un real no reconstruye la tabla.** El `change` salta durante el blur, antes de que
  el foco llegue a la casilla siguiente; reescribir el HTML ahí rompía el tabulado. En ese
  camino solo se refrescan las celdas derivadas y los contadores. Verificado: tras escribir y
  tabular, el foco cae en la casilla siguiente.
- **Solo se tiñe la fila que va a peor.** El filtro cuenta cualquier desviación, pero un gasto
  que sale más barato no se pinta de aviso.
- **La insignia dice «Guardado a las 03:17», no «Guardado hace 4 s»** como el mockup: un texto
  relativo exige un temporizador o miente en cuanto pasan unos segundos sin repintar.
- **No se ha migrado el aviso «Detectado en el extracto · ¿Es anual?».** Supone inferir de un
  extracto que una partida es nueva y un modelo de recurrencia anual para las filas añadidas a
  mano, y hoy no existe ninguna de las dos cosas. No se ha inventado: queda pendiente explícito
  y por eso 2a figura como migrada **parcial**.

Validación de cierre (`npm run verify`, exit 0): **403/403 pruebas**, accesibilidad
(545 IDs únicos), rendimiento (diff 10.000 filas en 35,5 ms; forecast y escenarios en 170,1 ms;
recursos 1162 KB), build público, privacidad y smoke test en verde. QA en navegador real a
1440 px y a 390×844 sin desbordamiento horizontal ni errores de consola propios (solo el CDN de
Supabase, que este entorno no alcanza).

Documentado en `docs/E19_SISTEMA_DISENO.md`: 2a pasa a migrada en el catálogo del turno 2 y se
añade una §11 con el detalle. Pendiente en el backlog: **3a/3b/3c · cuadro de mandos con
impacto**, que ya tiene en esta tabla editable la base que necesitaba, y la decisión aplazada
sobre el rediseño a seis vistas.

## Publicación — PR #5 fusionado a `main`

A petición expresa del usuario ("empezamos por fusionar el PR #5"), el PR #5 se fusiona a
`main` mediante squash (`8821c62`). Queda publicado:

- **E20-3**: `#escenario-simular` deja de construir solo `amortizacion` y cubre los once
  tipos que el motor resuelve, validados contra el contrato antes de simular.
- **Material de diseño ampliado**: turnos 4 y 5 del canvas de mockups, prototipo navegable
  de las seis vistas, documento de entrega y 17 capturas nuevas.

Validación de cierre repetida sobre el `main` ya fusionado: 403/403 pruebas, accesibilidad
(537 IDs únicos), rendimiento, build público, privacidad y smoke test en verde.

Pendiente en el backlog, por orden acordado con el usuario: **2a · «Registrar el mes»**
(`#update-data`, la tabla editable que 3a necesita como base) y **3a/3b/3c · cuadro de mandos
con impacto**, esta última ya con especificación real gracias al turno 5. La decisión sobre
adoptar o no el rediseño a seis vistas queda deliberadamente aplazada a después de ver el pie
de impacto funcionando en la app real.

## Documentación — el rediseño a seis vistas entra en el repositorio

El usuario aportó una ampliación del documento de mockups y pidió incluir los visuales en la
documentación del proyecto. Lo añadido a `docs/mockups/`:

- **Dos turnos nuevos en el canvas** (el fichero pasa de tres turnos a cinco): turno 4, el
  rediseño completo de las 22 pantallas actuales a seis vistas; turno 5, especificaciones
  escritas de interacción más dos prototipos vivos (pie de impacto e importación de extracto).
- **`finanzas-casa-app.dc.html`**: prototipo navegable de las seis vistas con las
  interacciones reales. La entrega lo señala como la referencia principal.
- **`HANDOFF_REDISENO_6_VISTAS.md`**: documento de entrega con propósito de cada vista,
  comportamiento, gestión de estado, tokens y medidas exactas.
- **17 capturas nuevas** en `docs/mockups/screens/` (`4a`-`4f`, `5a`-`5d`, las seis vistas del
  prototipo y el estado con el pie de impacto desplegado tras editar una celda, que no se ve
  en una captura de la vista en reposo).

Las capturas hubo que generarlas aquí: el visor de canvas carga React desde `unpkg.com` y la
tipografía desde Google Fonts, y esta máquina no llega a ninguno de los dos. Se resolvió
sirviendo los bundles UMD de React desde el registro de npm (sí accesible) mediante
enrutado de peticiones en Playwright, sin modificar los ficheros del repositorio. Queda
anotado en la documentación que los `.dc.html` necesitan red y que las capturas son la copia
legible sin ella.

Documentado en `docs/E19_SISTEMA_DISENO.md`: §1 reescrita con el inventario del material,
§4 ampliada con los turnos 4 y 5, y una §10 nueva. Lo importante de §10, dicho sin adornos:
**el rediseño choca de frente con la arquitectura actual**. Cada mockup migrado hasta ahora
se añadió como pantalla nueva junto a la heredada, nunca sustituyéndola, y hoy conviven
`#conciliar` con `#reconciliation`, `#deuda-ruta` con `#debt-roadmap`, `#escenario-simular`
con `#new-life-simulation`. El rediseño es la operación inversa: fundir los pares y retirar
los heredados. Eso es una decisión de producto sobre retirar pantallas en uso, no algo que
se resuelva escribiendo código, así que queda documentado y sin migrar.

Sí es aprovechable ya, sin esa decisión: el turno 5 especifica de verdad el pendiente
3a/3b/3c del backlog (disparadores, debounce, contenido exacto del pie de impacto,
comportamiento con mes cerrado y al descartar), que hasta ahora eran tres capturas estáticas
sin especificación. Es la mejor entrada disponible para esa entrega.

403 pruebas (403 pass), `npm run verify` en verde.

## Cierre de sesión — E20-3: los once tipos de decisión en `#escenario-simular`

Segundo pendiente del bloque E20-2, a petición expresa del usuario ("confirmo orden"): el
formulario de «Qué cambias» tenía cuatro controles fijos y solo sabía construir decisiones
de tipo `amortizacion`, aunque el motor resolvía once tipos desde E20-0 día 4. Ahora es un
catálogo declarativo (`ESCENARIO_MOTOR_TYPES` en `app.js`): desplegable de tipo agrupado en
«Deuda» y «Vida», y una rejilla de campos que se reconstruye según el tipo. Detalle completo,
con la tabla de los once tipos y sus campos, en `docs/E19_SISTEMA_DISENO.md` §9.

Decisiones deliberadas, documentadas en vez de fabricadas:
- **`traspaso` y `cambio_presupuesto` no se ofrecen.** El motor los deja fuera a propósito y
  explica por qué; ofrecerlos daría controles que no cambian nada en la simulación.
- **`acuerdo_quita.modalidad` se fija a `pago_unico`** en vez de pedirla: el motor cierra la
  deuda con un pago único, así que un desplegable con «fraccionado» prometería un cálculo
  inexistente. `retomar_pagos` solo ofrece deudas realmente suspendidas, que son las únicas
  que el aplicador acepta.
- **El guardarraíl sale del `<form>`**: es del escenario entero, no de la decisión que se
  está componiendo, y mezclado con los campos de la decisión confundía ambas cosas.

Un defecto real corregido de paso: la interfaz generaba IDs de decisión (`escenario-motor-1`)
que el propio contrato habría rechazado, y no validaba nada — funcionaba porque
`resolveEscenario` no valida, no porque la decisión fuera correcta. Ahora cada decisión se
construye completa (ULID `dec_…`, `titulo`, `planificacion`, `params`) y pasa por
`Schema.validateDecision` antes de entrar en la simulación; si el contrato la rechaza no se
añade nada y se muestran sus propios mensajes, con el `path` traducido al rótulo del campo.

Verificado con Playwright contra la app real, con interacción real (no solo capturas): los
once tipos se añaden y el motor los resuelve como «aplicada»; el filtro de deudas suspendidas
devuelve 2 de 3; una decisión incompleta muestra los tres errores del contrato y no se añade;
el guardarraíl rechaza y «ajustar automáticamente» reintenta con mes óptimo también en tipos
que no son de deuda; la tabla de `#escenario-aplicar` y el escenario guardado muestran títulos
correctos con tipos mezclados; el flujo «aplicar ruta» del comparador de estrategias sigue
funcionando con los títulos reconstruidos. Sin errores de página, sin desbordamiento
horizontal a 1280×900 ni a 390×844.

Dos ajustes de presentación necesarios al crecer el formulario: el panel de controles pasa de
340 a 400 px (a 340 la rejilla nunca daba para dos columnas y los tipos de seis campos
obligaban a recorrer todo el formulario en vertical), y los títulos de decisión dejan de
recortarse con puntos suspensivos — con once tipos, «Refinanciar Entidad B Tarjeta» se
cortaba justo en la parte que identifica la decisión.

403 pruebas (403 pass), `npm run verify` en verde (accesibilidad 537 IDs únicos, rendimiento
diff 10.000 filas en 41,2 ms, build público, privacidad y smoke test correctos).

Pendiente en el backlog: cuadro de mandos con impacto (3a/3b/3c), la única entrada que queda
del catálogo de mockups y la que exige capacidad nueva, no un reskin.

## Publicación — PR #4 fusionado a `main`

A petición expresa del usuario ("haz commit y push para publicar si es posible"), el
PR #4 (E20-2: comparador de estrategias de deuda, plan de deuda · ruta, conciliación y
asesor ejecutivo — mockups 1b/1c/1g/1d) se fusiona a `main` mediante squash (`547117a`).
Las cuatro pantallas nuevas quedan publicadas en el sitio: `#deuda-comparar`,
`#deuda-ruta`, `#conciliar`, `#asesor-decision`.

Validación de cierre repetida sobre el `main` ya fusionado: 403/403 pruebas,
accesibilidad, rendimiento, build público, privacidad y smoke test en verde. Árbol de
trabajo limpio.

Pendiente en el backlog de este mismo bloque (E20-2): cuadro de mandos con impacto
(3a/3b/3c — capacidad nueva, no un reskin) y sumar más tipos de decisión a
`#escenario-simular`.

## Cierre de sesión — E20-2 (continuación): asesor ejecutivo (1d)

Cuarta pantalla del tramo actual: `#asesor-decision`. A diferencia de 1b/1c/1g, esta no
era un reskin sobre lógica ya existente — el mockup asume un motor de recomendación que
no existe. Se planteó explícitamente como decisión de producto al usuario (no una
elección técnica silenciosa): construir la pantalla sobre ofertas reales de E14b (la
oferta de deuda más urgente que el propio usuario registra en `#debt-roadmap`, con
vencimiento e importe reales), reutilizar el motor de recomendaciones genérico de E16
(siempre tiene contenido pero es más superficial, sin importe/vencimiento concretos), o
aplazar la pantalla. El usuario eligió la primera opción.

Sin ninguna oferta abierta registrada — el caso más común en un dataset nuevo — la
pantalla muestra un estado vacío explícito en vez de fabricar una decisión. Con una
oferta real: ahorras/cuota liberada/caja mínima salen de
`E14DebtOperations.simulateStrategy()` (la misma simulación que ya usa el panel E14b);
la cobertura "de dónde puede salir el dinero" son los saldos reales de cada cuenta,
etiquetados como estimación, no como reparto ya decidido (el mockup insinúa una
asignación fija que no tiene dato real detrás); los límites (reserva, colchón,
deuda/ingresos) reutilizan cálculos ya existentes en otras pantallas — verificado que
"colchón: 2.0" coincide exactamente con el mismo KPI del panel Hoy. "Revisar y aplicar"
preselecciona la oferta y navega al flujo real de aplicación en `#debt-roadmap` en vez
de reconstruirlo. Detalle completo en `docs/E19_SISTEMA_DISENO.md` §8.

Verificado con Playwright de extremo a extremo: estado vacío sin ofertas, registro de
una oferta real en `#debt-roadmap`, contenido completo y correcto en `#asesor-decision`,
navegación de vuelta con la oferta preseleccionada. Un bug pequeño encontrado y
corregido (falta de espacio en el título por un `.trim()` aplicado al segmento entero en
vez de solo a la parte opcional).

403 pruebas (403 pass), `npm run verify` en verde.

## Cierre de sesión — E20-2 (continuación): conciliación (1g)

Tercera pantalla del tramo actual: `#conciliar`, puro reskin sobre la conciliación real ya
verificada (E4/A1-1, E11b) — llama a las mismas funciones que la pantalla heredada
`#reconciliation` (`refreshCanonicalLedger`, `E11bInbox.reconciliationTasks`,
`FinanceCanonicalE5.latestMonthOperation`) sin reimplementar ningún cálculo; solo cambia
la presentación a "qué falta para cerrar el mes" en vez del panel operativo completo, que
sigue intacto en `#reconciliation`. Detalle en `docs/E19_SISTEMA_DISENO.md` §7.

Verificado con Playwright contra la app real: KPIs, lista de tareas, checklist de cierre e
histórico de meses anteriores renderizan correctamente; contrastado contra `#reconciliation`
en el mismo dataset para confirmar que la ausencia de datos (0 movimientos bancarios
importados en el dataset local de pruebas) es igual en ambas pantallas, no un fallo nuevo.

403 pruebas (403 pass), `npm run verify` en verde.

## Cierre de sesión — E20-2: comparador de estrategias de deuda + plan de deuda · ruta (1b/1c)

A petición expresa del usuario, arranca el resto del catálogo de mockups pendiente
(plan de deuda, asesor ejecutivo, conciliación, cuadro de mandos con impacto) más los
tipos de decisión que faltan en `#escenario-simular`. Primer tramo: `#deuda-comparar` y
`#deuda-ruta` (mockups 1b/1c), construidas sobre el mismo motor (`resolveEscenario`) que
Escenario, no sobre el pipeline heredado de `debt-liquidation-plan`. Detalle completo,
incluidas las simplificaciones deliberadas frente al mockup (tres estrategias reales, no
cuatro; ver por qué "reunificación" no se fabrica), en `docs/E19_SISTEMA_DISENO.md` §6.

Dos bugs reales encontrados y corregidos durante la verificación con Playwright (no solo
capturas — clics e interacción real):
- **Layout**: `.visual-controls` es un `display:grid` genérico de 4 columnas (pensado
  para paneles de filtros en otras pantallas) que, aplicado a un grupo de tabs + un
  enlace, forzaba los tabs a una columna de ~130px y los hacía desbordar tapando el
  enlace de al lado. Corregido con un `display:flex` propio, con ámbito a
  `.e19-deuda-decidir .section-title .visual-controls`, igual que el fix de `min-width`
  de E20-1 — sin tocar la regla global que sí es correcta donde ya se usa.
- **Cálculo**: sin una reserva mínima configurada, el motor no valida nada en modo
  óptimo — todas las decisiones caían en el primer mes del horizonte sin importar cuánto
  quedara la caja en negativo (primera prueba: caja mínima de -2.460 €, sin sentido
  como comparación de estrategias). Corregido con un suelo de 0 € por defecto cuando no
  hay reserva configurada (nunca "sin comprobar nada" en silencio), y con un ranking
  explícito para "recomendada" en vez de comparar como texto plano fechas reales junto a
  etiquetas como "sin fecha estimable" (que por alfabeto ordenaban antes que cualquier
  fecha real, aunque no signifique "antes" en absoluto).
- **Legibilidad del gráfico**: con el horizonte completo del motor (hasta 10 años) la
  liquidez proyectada crece muy por encima del principal de deuda y lo aplana en un hilo
  invisible en una escala compartida; se recorta la ventana a los ~6 meses tras saldarse
  la última deuda.

403 pruebas (403 pass), `npm run verify` en verde, flujo comparar → ver ruta → cambiar de
pestaña → aplicar ruta → confirmar con motivo → guardado verificado de extremo a extremo
con Playwright contra la app real.

La rama de trabajo `claude/repo-analysis-3dupjd` se reinició sobre el `main` ya fusionado
(PR #2 + esta nueva entrega), con el mismo nombre — la anterior PR quedó cerrada por
fusión, no se reutiliza. Trabajo pendiente de publicar mediante un PR nuevo.

## Publicación — PR #2 fusionado a `main`

A petición expresa del usuario ("confirmo fusión, publica todo lo que se pueda publicar"),
el PR #2 (E20-1 día 1 + rediseño 1e/2d/2e descrito más abajo) se fusiona a `main` mediante
squash (`191ba2f`). El motor de Escenario deja de ser código sin usar y pasa a estar
enlazado desde `index.html` en el sitio público: las tres pantallas nuevas
(`#escenario-simular`, `#escenario-aplicar`, `#escenario-guardados`) y la documentación de
mockups (`docs/E19_SISTEMA_DISENO.md`, `docs/mockups/`) quedan publicadas.

Validación de cierre repetida sobre el `main` ya fusionado: 403/403 pruebas, accesibilidad,
rendimiento, build público, privacidad y smoke test en verde. Árbol de trabajo limpio, sin
cambios pendientes de commitear más allá de esta propia entrada de estado.

## Cierre de sesión — E20-1: rediseño de Escenario según los mockups reales (1e/2d/2e)

A petición expresa del usuario, la pantalla única `#escenario-motor` del día 1 se
rediseñó como el flujo de **tres pantallas encadenadas** que definen los mockups
1e/2d/2e: `#escenario-simular` (panel de controles + gráfico plan-vs-simulación con línea
de reserva + KPIs de liquidez final/caja mínima/libre de deuda + aviso de límite roto con
"ajustar automáticamente"), `#escenario-aplicar` (diff línea a línea + motivo obligatorio)
y `#escenario-guardados` (lista con estado aplicado/guardado, KPIs recalculados al vuelo,
persistida en `localStorage`). Detalle completo, incluidas las simplificaciones
deliberadas frente al mockup (solo dos estados, "aplicar" no muta las deudas reales), en
`docs/E19_SISTEMA_DISENO.md` §5.

Añadido de verdad en este rediseño, no solo estético:
- KPI "Libre de deuda", calculado desde el estado real de los contratos (cuota × plazo
  restante), nunca inventado — con su propio caso límite gestionado explícitamente (una
  deuda sin cuota activa, p. ej. suspendida o el registro histórico de una reunificación,
  no tiene fecha proyectable y se dice así en vez de fabricar una).
- El contexto de deudas del motor pasó de `debtContractSourceRows()` a
  `canonicalDebtContractRows()`, que incluye el plan reunificado sintético — antes
  quedaba fuera del alcance de la pantalla sin que nada lo avisara.
- "Ajustar automáticamente" reutiliza de verdad la búsqueda de mes óptimo del motor
  (`planificacion.modo: "optimo"`, E20-0 día 3) — no es un botón decorativo.
- Persistencia real de escenarios guardados vía `localStorage` (antes: solo en memoria de
  sesión).

Bug de layout real encontrado y corregido durante la verificación visual con Playwright
(no solo capturas — clics reales de extremo a extremo): una tabla de 5 columnas dentro del
panel estrecho de 300px desbordaba fuera del viewport en vez de activar scroll horizontal,
por dos causas combinadas — un hijo de grid sin `min-width: 0` no se encoge por debajo del
ancho intrínseco de su contenido, y una regla genérica `table { min-width: 1120px }` ya
existente en `styles.css` (pensada para las tablas grandes de datos) se aplicaba también
aquí. Corregido con `min-width: 0` en los hijos del grid y `table-layout: fixed` con
anchos de columna explícitos en la tabla de diferencias.

403 pruebas (403 pass), `npm run verify` en verde, flujo simular → aplicar → guardados
verificado de extremo a extremo con Playwright contra la app real (incluida persistencia
tras recargar la página).

## Mockups originales documentados en el repositorio

El usuario aportó el documento de mockups completo ("Finanzas Casa · Mockups", 15
pantallas en 3 bloques) que hasta ahora solo existía como archivo aportado en
conversación — `design-tokens.css` ya citaba un `docs/E19_SISTEMA_DISENO.md` que nunca
se había escrito. Ahora existe: `docs/E19_SISTEMA_DISENO.md` documenta el origen, los
tokens (ya en `design-tokens.css`, ahora también en prosa), los componentes construidos y
el catálogo completo de las 15 pantallas con su estado de migración. El archivo original
se conserva en `docs/mockups/` (fuente + capturas por pantalla), como referencia interna
— no se sirve desde `index.html` ni se enlaza al sitio público, ni lo tocan
`build-public-site.mjs`/`check-public-privacy.mjs` (ambos trabajan con listas explícitas
de archivos, no escanean el repo entero).

Hallazgo importante al revisarlos: los mockups **1e/2d/2e** (simular → aplicar →
guardados) definen el diseño real de la pantalla de Escenario como un flujo de **tres
pantallas encadenadas**, bastante más rico que el formulario + tabla construido en
E20-1 día 1 (que se hizo sin haber visto todavía estos mockups, porque el adjunto no
llegó a esa sesión). Documentado en el propio `E19_SISTEMA_DISENO.md` §5. Pendiente de
decisión del usuario: rediseñar `#escenario-motor` hacia ese mockup ahora, o seguir
sumando tipos de decisión con el patrón actual del día 1 y reconciliar visualmente más
adelante.

## Cierre de sesión — E20-1, día 1: el motor de Escenario entra en la interfaz

- PR #1 (Bloque 1 E19 completo + E20-0 días 1-4) revisado y fusionado a `main`.
  Rama de trabajo reiniciada sobre el nuevo `main` (mismo nombre,
  `claude/repo-analysis-3dupjd`, historial limpio).
- Arranca el Bloque 2 de verdad: `canonical-scenario-engine.js` deja de vivir
  solo en tests y se enlaza por primera vez desde `index.html`. Antes de
  tocar nada se revisaron las tres pantallas legacy que ya rozan el concepto
  de "decisiones" (`#new-life-definitive`, `#new-life-simulation`,
  `#simulator`/`decision-studio`): ninguna usa el sistema E19, ninguna llama
  al motor nuevo, y las tres suman miles de líneas acopladas a un pipeline
  antiguo — retocar cualquiera de entrada habría sido arriesgado y no era lo
  pedido. Se optó, como en toda esta fase, por añadir sin tocar: pantalla
  nueva `#escenario-motor` ("Motor de Escenario"), enlazada desde "Decidir" y
  desde el buscador (`e17-experience.js`), con markup **100 % `.e19-*`** — la
  primera pantalla del proyecto construida enteramente en el sistema de
  diseño E19 desde cero, sin heredar ni una clase antigua.
- Alcance del día 1, deliberadamente mínimo: un único tipo de decisión
  (**amortizar deuda**) de punta a punta, para probar el circuito completo
  con datos reales antes de sumar el resto de tipos en próximos días — el
  mismo patrón día a día que se usó para construir el propio motor. El
  usuario elige una deuda viva real (`debtContractSourceRows()`), importe y
  mes real del horizonte (`canonicalEngineInput().months`); al añadirla, se
  llama de verdad a `FinanceCanonicalScenarioEngine.resolveEscenario()` — sin
  simular ni fingir un resultado — y se muestra si quedó **aplicada** o
  **rechazada con el motivo real** (guardarraíl incumplido, deuda ya cerrada,
  conflicto con otra decisión…), más el efecto en la liquidez mínima
  (antes/después, con la cifra exacta que devuelve el motor).
- Guardarraíl opcional en el propio formulario: si se indica un saldo mínimo,
  se pasa tal cual a `context.guardarrailes.saldoMinimoAbsoluto` y las
  decisiones que lo rompan se rechazan de verdad, visible en la tabla.
- Simplificación explícita de este día: la lista de decisiones vive solo en
  memoria de la pestaña del navegador — no persiste todavía entre sesiones.
  Se documenta aquí en vez de fingir que sí.
- Verificado con Playwright contra la app real servida localmente: opciones
  de deuda y mes cargadas con datos reales, alta de una decisión, resultado
  "Aplicada" devuelto por el motor real, KPI de liquidez mínima calculado, y
  retirada de la decisión limpia el estado. Sin peticiones de red fallidas
  para los dos scripts nuevos (`canonical-scenario-schema.js`,
  `canonical-scenario-engine.js`).
- 403 pruebas (403 pass, 0 `test.todo`), `npm run verify` en verde.
- Pendiente para próximos días: el resto de tipos de decisión soportados por
  el motor (refinanciar, comprar, imprevisto, proyecto…), y decidir si esta
  pantalla se queda como está o se fusiona más adelante con alguna de las
  tres legacy.

## Decisión de publicación: un único sitio en desarrollo

A petición del usuario se creó una copia fija del repositorio en
`javierbarriusom-a11y/contabilidadcasa`
(`https://javierbarriusom-a11y.github.io/contabilidadcasa/`), foto de este
mismo estado (E19 completo + E20-0 días 1-4). El usuario confirmó
explícitamente que esa copia **no se toca más**: todo el trabajo futuro sigue
exclusivamente en este repositorio y su sitio actual
(`https://javierbarriusom-a11y.github.io/finanzas-casa-def/`), que queda
"como está". Documentado también en `CLAUDE.md` para que esta regla se
respete automáticamente sin que el usuario tenga que repetirla en cada
sesión.

## Cierre de sesión — E20-0, día 4: tipos de decisión fuera del alcance original de F1

- A petición expresa del usuario, se implementan los tipos de decisión que no tocan deuda y
  quedaban fuera del alcance original de F1: `imprevisto`, `proyecto`, `cambio_ingreso` y
  `cambio_gasto`. Reutilizan `projectOutflow`/`income`/`coreSpend` como bucket genérico, igual que
  `compra`, y participan en la búsqueda de mes óptimo del día 3 sin cambios en su mecanismo.
  - `imprevisto`: gasto de golpe en `mes`, o repetido cada `recurrenciaMeses` durante el resto del
    horizonte si se declara.
  - `proyecto`: modalidad «hucha» reparte `importeObjetivo` en cuotas iguales desde el mes resuelto
    hasta `mesObjetivo`; «pago_unico» y «financiado» lo cargan de golpe en `mesObjetivo` (el
    esquema de `proyecto` no da plazo/cuota propios como sí hace `compra`, así que «financiado» no
    puede distinguirse numéricamente de «pago_unico» hoy — documentado explícitamente, no fingido).
  - `cambio_ingreso` / `cambio_gasto`: delta mensual (importe fijo, o para gasto también porcentaje
    fraccionario del gasto de ese mes) aplicado desde `mesInicio` hasta `mesFin`, o hasta el final
    del horizonte si no se declara `mesFin`.
- **Dos tipos siguen sin soportarse, no por omisión sino por un límite real del contrato de entrada
  de `canonical-engine`**, documentado explícitamente en el módulo en vez de forzar un número
  fabricado:
  - `traspaso`: mover saldo entre cuentas no cambia la liquidez total, pero
    `canonical-engine.buildRows` no acepta un ajuste puntual del reparto checking/savings por mes
    — solo calcula `saving` a partir de la política declarada. Modelarlo bien exige ampliar el
    motor canónico, no este envoltorio.
  - `cambio_presupuesto`: un techo presupuestario es un objetivo a vigilar, no un flujo de caja;
    aplicarlo como si moviera `coreSpend` fabricaría un gasto que nadie ha declarado todavía.
- Con esto, de los 13 tipos de decisión del esquema, 11 tienen efecto financiero real en
  `resolveEscenario` (los seis de deuda, compra, proyecto, imprevisto, cambio_ingreso y
  cambio_gasto) y los otros 2 (`traspaso`, `cambio_presupuesto`) quedan fuera de alcance
  documentado explícitamente, no como pendientes silenciosos.
- 403 pruebas (403 pass, 0 `test.todo`), `npm run verify` en verde.
- Trabajo pendiente de publicar en la rama `claude/repo-analysis-3dupjd` mediante el PR #1
  (borrador).

## Cierre de sesión — E20-0, día 3: amortización fraccionada y mes óptimo

- `E19_INFORME_FINAL.md` §4 recomendaba aplazar `amortizacion_fraccionada` (C004) y
  `planificacion.modo === "optimo"` (mes óptimo, C003) a F2/F3 porque no bloqueaban que F1 fuera
  útil con los otros cinco tipos de deuda. A petición expresa del usuario, se implementan ya en
  E20-0 en vez de esperar.
- **`amortizacion_fraccionada`** se incorpora a `DEBT_DECISION_TYPES`: pago mensual recurrente de
  `importeMensual` durante `meses`. Si `importeMensual × meses` alcanza el principal antes de
  agotar `meses` declarados, la deuda cierra en el **mes real** en que eso ocurre (no en el
  declarado, que puede ser mayor) — verificado con un caso donde 900 € de principal se agotan en 3
  meses de los 6 declarados. Si no lo alcanza, la deuda sigue activa con el principal reducido y su
  cuota original intacta, la misma simplificación que ya usaba la amortización parcial.
- **Mes óptimo** (`modo:"optimo"`) se resuelve en `resolveEscenario`: busca, en orden cronológico
  entre los meses del horizonte, el primero en el que la decisión no rompa
  `guardarrailes.saldoMinimoAbsoluto` — reutilizando exactamente el mismo mecanismo de comprobación
  y deshecho (`guardarril-incumplido`) del día 2. Es una interpretación deliberadamente limitada de
  «óptimo»: el primer mes viable, no el más barato ni el de mejor VAN. Sin guardarraíles declarados
  no hay nada que buscar y se usa directamente el primer mes del horizonte. Si ningún mes es
  viable, se rechaza explícitamente (`sin-mes-viable`) en vez de forzar uno — nunca deja rastro en
  la serie compuesta.
- Un caso combinado (amortizar una deuda en modo manual + comprar financiado en modo óptimo, con
  guardarraíl) demuestra el mecanismo completo: el buscador de mes óptimo se beneficia de la cuota
  liberada por la amortización resuelta antes y encuentra el primer mes viable dos meses después de
  que empiece a liberarse esa cuota, en vez de en el mes 1.
- 399 pruebas (399 pass, 0 `test.todo`), `npm run verify` en verde.
- Trabajo pendiente de publicar en la rama `claude/repo-analysis-3dupjd` mediante el PR #1
  (borrador).

## Cierre de sesión — E20-0, día 2: efecto cascada y cierre de I-09

- `canonical-scenario-engine.js` gana `resolveEscenario(decisiones, context)`: compone la serie
  mensual real delegando en `canonical-engine.buildRows` — no reimplementa la aritmética de
  liquidez, solo transforma `months[]` según las decisiones resueltas, igual que el resto de
  módulos E14 envuelven en vez de sustituir. Cada deuda tocada por una decisión reemplaza su
  aportación a `refi` desde el mes resuelto en adelante (los meses anteriores quedan intactos por
  construcción, delta cero); una `compra` aporta a `projectOutflow`, de golpe o financiada.
- **I-09 (escenario vacío ≡ Plan canónico) queda cerrada**: con 0 decisiones, `resolveEscenario`
  reproduce exactamente `Engine.buildRows(baseInput)`, verificado con una prueba directa además de
  la de `tests/canonical-scenario-invariants.test.cjs`. Ya no queda ningún `test.todo` pendiente:
  las 9 invariantes verificables sin guardarraíles/Monte Carlo/presupuesto (I-01 a I-09) están
  todas cubiertas hoy.
- **C040/C041 (efecto cascada, el criterio de aceptación real de E20-0 según** `E19_INFORME_FINAL.md` **§4) quedan resueltos**: cuando el escenario declara
  `guardarrailes.saldoMinimoAbsoluto`, cada decisión con efecto en la serie se comprueba contra la
  liquidez mínima resultante hasta ese punto de la resolución — y se rechaza explícitamente
  (`guardarril-incumplido`) si la rompe, en vez de aceptarla en silencio. Una prueba con las mismas
  dos decisiones (amortizar una deuda + comprar financiado) en los dos órdenes de resolución
  produce resultados distintos: la compra se aplica cuando se resuelve después de amortizar (la
  cuota liberada deja liquidez mínima suficiente) y se rechaza cuando se resuelve antes (sin la
  cuota liberada, la misma compra rompería el guardarraíl) — el resultado numérico final difiere
  según el orden, y ambos son correctos respecto al guardarraíl declarado.
- Simplificaciones documentadas del día 2 (no afectan a los cinco tipos de deuda ni a compra en sí,
  solo a su detalle financiero): solo se compone la serie de decisiones con
  `planificacion.modo === "manual"` (mes resuelto explícito) — `modo:"optimo"` sigue fuera de
  alcance (C003, aplazado a F2/F3); reunificación y refinanciación no modelan comisiones como flujo
  de caja aparte; `retomar_pagos` no recalcula duración tras la suspensión.
- 393 pruebas (393 pass, 0 `test.todo`), `npm run verify` en verde: tests, accesibilidad,
  rendimiento, construcción pública, privacidad y smoke test.
- Trabajo pendiente de publicar en la rama `claude/repo-analysis-3dupjd` mediante el PR #1
  (borrador).

## Cierre de sesión — E20-0, día 1: motor de resolución de decisiones sobre deuda

- Arranca el bloque 2 (E20, motor de Escenario unificado) siguiendo la recomendación de
  `E19_INFORME_FINAL.md` §4: `canonical-scenario-engine.js` es nuevo (no sustituye nada en
  producción todavía; no está enlazado desde `index.html` ni el service worker, igual que
  `canonical-scenario-schema.js` en E19-0), y envuelve los cinco tipos de decisión de deuda que ya
  estaban en paridad exacta (amortización total/parcial, refinanciación, retomar pagos, acuerdo de
  quita) más reunificación, construida de cero como anticipaba el informe (caso dorado C005).
- El motor resuelve únicamente el estado de las deudas por ahora: filtra las decisiones inactivas
  antes de ejecutar nada (I-05), usa `resolveExecutionOrder()` de E19-0 tal cual para el orden real
  de ejecución, y detecta conflictos bloqueantes explícitos en vez de calcular un número
  silenciosamente incorrecto — una decisión sobre una deuda ya cerrada por OTRA decisión de ese
  mismo escenario se rechaza con un código propio (`conflicto-bloqueante`), distinto del de una
  deuda que ya estaba cerrada al importar el escenario (`deuda-ya-cerrada`). Cubre los casos dorados
  C005, C042 y C043, documentados en el día 3/5 de E19-0 como huecos funcionales.
- Todavía no compone la serie mensual del forecast (`canonical-engine`): eso es lo que exige el
  efecto cascada de C040/C041 (amortizar libera cuota, la cuota liberada financia una compra
  posterior) y queda para el día 2. Los tipos de decisión que no tocan deuda (compra, proyecto,
  cambio de ingreso/gasto, traspaso, imprevisto) y `amortizacion_fraccionada` (aplazada a F2/F3 por
  el informe) se marcan explícitamente como `tipo-no-soportado-aun`, nunca se ignoran en silencio.
- I-05 (neutralidad de inactivas) e I-06 (conmutatividad de independientes) quedan verificadas hoy
  a nivel de estado de deudas, con 40 casos aleatorios cada una además de los casos fijos; sus
  `test.todo` en `tests/canonical-scenario-invariants.test.cjs` se sustituyen por pruebas reales y
  el catálogo de `canonical-scenario-invariants.js` se actualiza (`verificableHoy: true` para
  ambas). I-09 (escenario vacío ≡ Plan canónico) sigue como `test.todo` explícito citando el día 2,
  porque comparar contra el Plan canónico exige la serie mensual que todavía no existe — no se
  cierra por omisión.
- 390 pruebas (389 pass, 1 `test.todo` explícito citando E20-0 día 2), `npm run verify` en verde:
  tests, accesibilidad, rendimiento, construcción pública, privacidad y smoke test.
- Trabajo pendiente de publicar en la rama `claude/repo-analysis-3dupjd` mediante el PR #1
  (borrador), que también cierra el bloque 1 (piel visual E19).

## Cierre de sesión — E19-0, dataset dorado y esquemas validables

- E19-0 queda completo y verificado: es la fase de fundación de la nueva propuesta de rediseño
  visual y evolución funcional (piel visual E19, motor de Escenario unificado E20, presupuesto por
  bloque E21, deuda y cuadro de mandos con impacto E22), acordada con el usuario junto a un
  documento de diseño visual y tres documentos de diseño funcional (esquemas y dataset dorado,
  presupuestos, modelo de Escenario).
- Día 1: `canonical-scenario-schema.js` valida el objeto Escenario y sus 13 tipos de Decisión
  (`additionalProperties:false` en cada nivel, un bloque if/then por tipo, detección de ciclos en
  `dependeDe`). `migrations/scenario-schema-migrations.js` deja el registro de migraciones listo
  para cuando exista una v1.1.
- Día 2: tres datasets sintéticos y anonimizados a 120 meses (D1-hogar-base, D2-hogar-apalancado,
  D3-hogar-holgado; titulares T1/T2, entidades Banco Operativo/Banco Ahorro y Entidad A-D),
  ejecutables desde el primer día contra `canonical-engine.js` y `canonical-debt-contracts.js`.
- Día 3: los 10 casos dorados de deuda (C001-C010) ejecutados contra los tres motores reales que
  hoy calculan deuda de forma independiente. 7 de 10 coinciden exactamente; 3 quedan documentados
  como hueco funcional (C003 mes óptimo, C004 amortización fraccionada, C005 reunificación) en vez
  de forzar un resultado inventado. Detalle en `E19_INFORME_PARIDAD_DEUDA.md`.
- Día 4: invariantes I-01 a I-09 verificadas por generación aleatoria contra el código real
  (`canonical-scenario-invariants.js`), no solo casos escritos a mano. La primera tanda de 40
  casos aleatorios de I-07 encontró un error real en `legacy-debt-roadmap-engine.js`: podía
  reportar que una deuda tardaba más en pagarse al amortizar más, por leer el saldo mutable del
  último mes simulado en vez del histórico de cada fila. Corregido en un único punto, sin afectar
  a `totalPaid`/`totalLump`/`peak`; el caso dorado C007 del día 3 ya lo exhibía sin que el informe
  de ese día lo detectara. Detalle en `E19_INVARIANTES.md`.
- Día 5: casos combinados C040-C045. `resolveExecutionOrder()` (nuevo en
  `canonical-scenario-schema.js`) resuelve el orden real de las decisiones por teoría de grafos
  pura, sin esperar al motor de Escenario: verificado contra C044 (el orden topológico gana sobre
  el `orden` declarado cuando se contradicen) y C045 (ciclo detectado sin bucle infinito). C040 a
  C043 quedan como hueco funcional documentado: exigen que un motor comparta estado financiero
  entre decisiones resueltas en orden, que es exactamente lo que E20 debe construir.
- Informe final y recomendación de orden para E20 en `E19_INFORME_FINAL.md`: cinco de los seis
  tipos de decisión más usados ya están en paridad y pueden envolverse sin reescribir; reunificación
  y conflictos bloqueantes son el riesgo real de F1; el efecto cascada entre decisiones (C040/C041)
  debería ser el criterio de aceptación de F1, no un extra.
- La puerta local pasa con 378 pruebas (375 pass, 3 `test.todo` explícitos citando a E20-0),
  accesibilidad, rendimiento, construcción pública, privacidad, smoke test y `git diff --check`.
  Ningún dato real en ningún fixture, verificado por prueba automatizada.
- Se creó la rama `checkpoint-pre-e19-rediseno` en GitHub (apuntando a `aecc450`, el commit estable
  previo a este trabajo) como punto de restauración si hiciera falta partir de cero.
- Trabajo publicado en la rama `claude/repo-analysis-3dupjd` mediante el PR #1 (borrador), sin
  fusionar a `main` todavía.

## Cierre de sesión — A5-2 a A5-4

- A5-2 queda implementada localmente con un benchmark reproducible sobre casos anonimizados: calidad,
  coste medio, p95 de latencia y selección estable por valor.
- A5-1 queda implementada localmente con backend privado Node y Responses API: payload mínimo, autenticación
  delegada, `store: false`, salida JSON estructurada, trazabilidad y fallback local. El endpoint permanece
  desactivado hasta configurar un verificador de sesión y secretos fuera del repositorio.
- A5-3 queda implementada localmente con invitaciones de token opaco y hashado, permisos por áreas, control
  optimista de revisión y revocación.
- A5-4 queda implementada localmente con suscripciones push cifradas, consentimiento, silencios, deduplicación,
  revocación y mensajes genéricos sin datos financieros.
- La aplicación sigue siendo utilizable con red, backend y servicios externos apagados.
- Validaciones: 310/310 pruebas, `node --check backend/server.mjs`, privacidad, build público, smoke test y
  `git diff --check` pasan. La salud del backend se comprobó con `enabled: false`.

## Terminado

- E18 queda verificada: la experiencia y guía por flujo están aisladas en `e17-experience.js`; el presupuesto
  de 10.000 periodos mide 60,5 ms; la salud local agrega duración, fallos y pendientes sin datos financieros;
  cuatro fixtures anonimizados migran y restauran; y doce capturas sintéticas validan los seis flujos críticos.
- La puerta local E18 pasa con 302 pruebas, accesibilidad, rendimiento, construcción pública, privacidad,
  smoke test, QA visual en 1280×720 y 390×844, y `git diff --check`.

- E17 queda verificada de A12-1 a A12-5: la navegación prioriza «Hoy, Actualizar, Prever, Decidir»; cada vista declara finalidad, estado y siguiente paso; el lanzador encuentra tareas de deuda, objetivos, movimientos y conciliación; la ayuda contextual usa únicamente la copia local; y la personalización de módulos avanzados se conserva solo en el navegador y siempre se puede restablecer.
- La puerta local E17 pasa con 293/293 pruebas, accesibilidad estructural, rendimiento con 10.000 filas, construcción pública, privacidad, smoke test y `git diff --check`. El QA visual del artefacto `dist/` pasó a 1280×720 y 390×844, sin desbordamiento; el menú móvil mostró las cuatro tareas y el lanzador filtró «deuda» correctamente.
- E16 queda verificada de A11-1 a A11-5: `finance-e16-monitoring/v1` calcula alertas anticipadas de caja, variaciones y ratio de deuda con horizonte, confianza y evidencia; resume cambios desde la última revisión; mide error y sesgo solo con muestras completas; y entrega recomendaciones trazables de solo lectura. En la aceptación, el panel Hoy se mostró en escritorio y a 400 px; un presupuesto de riesgo generó alertas, persistió tras recargar y se restauró al valor inicial.
- La recuperación de nube no vuelve a crear un cambio pendiente cuando el iframe de deuda devuelve exactamente el estado que acaba de hidratar. El tratamiento del estado idéntico queda cubierto por una regresión automatizada.
- La documentación operativa queda reconciliada: `BACKLOG_STATUS.md` y `ROADMAP_EXECUTION.md` registran E16 como verificada y preservan el histórico de julio.
- La puerta local pasa con 290/290 pruebas, accesibilidad estructural, rendimiento con 10.000 filas, construcción pública, privacidad, smoke test y `git diff --check`. El empaquetado público incluye explícitamente los contratos E15 y E16 y el shell offline se versionó como `e16a2`.

- E15 queda verificada localmente: los objetivos conservan prioridad, titular, flexibilidad y fuente de financiación; el calendario reúne forecast, cuotas, vencimientos y revisiones; las aportaciones y conflictos respetan capacidad y reserva sin aplicar movimientos automáticamente; y la revisión mensual se registra con confirmación.
- La puerta local de E15 pasa con 283/283 pruebas, accesibilidad estructural, rendimiento con 10.000 filas, construcción pública, privacidad, smoke test y `git diff --check`. El QA local a 1280×720 y 390×844 mostró el panel E15, sin errores de consola ni desbordamiento horizontal. El shell offline se versionó como `e15a1`.
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
- E14b completa A9-4 a A9-7: las ofertas normalizadas conservan contraparte, vigencia, documentos y
  condiciones; el optimizador compara alternativas no dominadas contra la reserva, vencimiento, mora y
  proyectos del forecast; y cada estrategia se evalúa como un escenario E13 de solo lectura.
- Una estrategia solo se incorpora al plan tras comprobar oferta aceptada, documentación mínima, reserva,
  motivo y confirmación accesible. La decisión resultante conserva la oferta y la simulación para que sea
  recuperable mediante el flujo de revisiones existente.
- La puerta local de E14b pasa con 272/272 pruebas, accesibilidad estructural, rendimiento con 10.000
  filas, construcción pública, privacidad, smoke test y `git diff --check`. El shell offline incluye el
  nuevo contrato de operaciones.
- Se añadió un manual de usuario en Markdown y Word enlazado desde `README.md`.
- A9-8 completa la migración gradual: el motor A/B del `iframe` se extrae como función pura y se ejecuta
  en paralelo con el contrato canónico. La comparación bloquea una retirada ante cualquier diferencia
  superior a 0,01 € en pagos mensuales, coste total, pico o duración; el iframe sigue disponible como respaldo.
- La puerta local final de E14 pasa con 276/276 pruebas, accesibilidad estructural, rendimiento con
  10.000 filas, construcción pública, privacidad, smoke test y `git diff --check`.

## Pendiente

- E10 queda parcialmente implementada: A5-1 a A5-4 tienen base local y contratos de activación, pero no
  pasan a `Verificado` hasta completar pruebas externas autenticadas. A5-5 requiere contratar y validar
  un proveedor PSD2; A5-6 depende de A5-5 y conserva la bandeja previa como única entrada al libro.

## Próximo paso

Cerrar E10 por dependencias y con entregas reversibles: (1) ejecutar A5-2 con el conjunto anonimizado aprobado
y fijar el modelo; (2) desplegar A5-1 con verificador de sesión, límites y prueba real sin escrituras; (3)
aceptar A5-3 con dos cuentas, conflicto, restauración y revocación; (4) aceptar A5-4 con consentimiento,
silencios y baja; (5) contratar y verificar A5-5; (6) activar A5-6 con cursor/huella idempotente, bandeja
previa, confirmación y deshacer. Ningún paso puede retirar el modo local ni escribir automáticamente en el libro.

## Decisiones importantes

- E16 es una capa de lectura: alerta, explica y propone alternativas, pero no altera el forecast, las decisiones ni los datos financieros. El presupuesto de riesgo solo ordena la atención del usuario.

- E17 no cambia datos financieros: la navegación, el lanzador, la ayuda y las preferencias de módulos son capas locales de interfaz; las preferencias permanecen en este navegador y el restablecimiento muestra siempre la navegación completa.

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
- La paridad E14 compara solo Entidad A/B porque ese es el alcance financiero histórico del iframe;
  Entidad C permanece en el contrato canónico y se declara expresamente fuera de la comparación, nunca
  como una diferencia silenciosa.
- Las integraciones externas se activan en orden A5-2 → A5-1 → A5-3 → A5-4 → A5-5 → A5-6. El modelo
  elegido no será fuente de verdad; hogar, push y banca solo ampliarán capacidades opt-in.
- El backend rechaza peticiones si no existe un verificador de sesión configurado; no se acepta una
  identidad declarada por el navegador ni se guardan claves o conversaciones en el repositorio.

## Errores conocidos y riesgos

- No hay fallos conocidos en E16: la aceptación visual, la persistencia del presupuesto y la recarga han quedado comprobadas. La recuperación remota ignora ecos idénticos del iframe de deuda para que no reaparezca un conflicto ya resuelto.

- No hay fallos conocidos en E17. Durante la primera comprobación el navegador integrado retuvo un shell anterior; la aceptación se repitió contra el artefacto recién construido bajo `dist/`, fuera de esa caché, y confirmó la versión E17 en escritorio y móvil.

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
- No hay fallos automatizados conocidos en E14. El iframe histórico se conserva como respaldo; cualquier
  divergencia futura de A/B superior a 0,01 € bloqueará su retirada.
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
- La aceptación externa de A5-1 a A5-4 aún no está ejecutada: faltan verificador de sesión, secretos de
  despliegue, dos cuentas autenticadas y proveedor de push. No se presenta la base local como activación real.
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

- El commit técnico de este cierre es `f84b1b0` (`feat: add safe external activation foundation`) en `main`;
  incluye A5-1 a A5-4, sus pruebas y el plan de activación. `.agents/` permanece sin seguimiento y queda
  excluida.
- Cambios locales sin commit: únicamente `.agents/`, que pertenece a las instrucciones locales y no se publica.

- E18 queda consolidada y publicada mediante `eee8c2a` (`feat: close E18 platform safeguards`) y su cierre
  documental mediante `8ee5a54` en `main` y `origin/main`; `.agents/` permanece sin seguimiento y queda excluida.

- E17 quedó consolidada y publicada en `main` y `origin/main` mediante `4d3a845` (`feat: complete E17 task-focused experience`). El cierre incluye interfaz, caché offline, pruebas y documentación; `.agents/` permanece sin seguimiento y queda excluida.

- La base publicada de E16 está en `main` y `origin/main` mediante `379ccc2` (`feat: implement E16 predictive monitoring`) y su documentación mediante `4910b7d`. El cierre de aceptación, la corrección de recuperación, las pruebas y la documentación se publicaron en `065d85f` (`fix: prevent repeated cloud recovery conflict`); `.agents/` continúa sin seguimiento y queda excluida.

- E15 quedó consolidada y publicada mediante `5b1ef69` (`feat: implement E15 goals and monthly review`) en `main` y `origin/main`. No quedan cambios del producto sin commit; `.agents/` continúa sin seguimiento y queda excluida.
- E14 quedó consolidada en `6603e51` (`feat: verify E14 debt roadmap parity`) y publicada en `main` y
  `origin/main`. No quedan cambios locales del producto sin commit; `.agents/` continúa sin seguimiento
  y queda excluida.

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
