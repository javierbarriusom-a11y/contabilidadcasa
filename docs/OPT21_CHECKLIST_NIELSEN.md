# OPT-21 — Checklist mensual de heurísticos de Nielsen

Gobernanza continua (`BACKLOG_OPTIMIZACION.md`, Fase 4), sin fecha de cierre: una vez al mes,
revisar **Hoy**, **Registrar** y **Plan** —las tres pantallas de uso diario— contra los diez
heurísticos de usabilidad de Jakob Nielsen, y documentar los hallazgos como una entrada más del
backlog. Mismo hábito de documentación que ya se aplica al resto del proyecto (`PROJECT_STATE.md`,
un cierre por sesión).

**Por qué existe**: OPT-8 (alerta de gasto hormiga) y sesiones anteriores encontraron deriva de UX
acumulada sin que nadie la buscara a propósito — un hábito mensual la detecta antes de que se
acumule otra vez, en vez de esperar a que alguien tropiece con ella.

## Cómo se revisa

Para cada pantalla (Hoy, Registrar, Plan) y cada heurístico de la tabla siguiente: abrir la pantalla
con datos reales (o el dataset sintético de `npm run test:e2e`), comparar contra la pregunta guía, y
anotar solo lo que sea un hallazgo real y concreto —una captura, un elemento, una frase—, no una
impresión genérica. Sin hallazgo, la casilla queda en blanco; no hace falta rellenar "todo bien".

| # | Heurístico (Nielsen) | Pregunta guía |
|---|---|---|
| 1 | Visibilidad del estado del sistema | ¿Queda claro en todo momento qué está pasando (guardando, calculando, guardado)? |
| 2 | Correspondencia entre el sistema y el mundo real | ¿El lenguaje y el orden de la información son los que usaría la persona, no jerga interna? |
| 3 | Control y libertad del usuario | ¿Hay una salida clara de cada acción (deshacer, cancelar, volver) sin perder datos? |
| 4 | Consistencia y estándares | ¿El mismo concepto se llama y se ve igual en las tres pantallas? |
| 5 | Prevención de errores | ¿Se puede evitar un error obvio antes de cometerlo (validación, confirmación), no solo avisar después? |
| 6 | Reconocer antes que recordar | ¿La persona necesita memorizar algo de otra pantalla, o todo lo que necesita está a la vista aquí? |
| 7 | Flexibilidad y eficiencia de uso | ¿Hay un camino más rápido para quien ya sabe usar la pantalla, sin penalizar a quien no? |
| 8 | Diseño estético y minimalista | ¿Hay información que compite por atención sin aportar a la decisión de esta pantalla? |
| 9 | Ayudar a reconocer y recuperarse de errores | ¿Un mensaje de error dice qué pasó y qué hacer, en lenguaje llano? |
| 10 | Ayuda y documentación | ¿La ayuda contextual (A12-4) cubre lo que de verdad genera dudas, no solo lo obvio? |

## Registro de revisiones

Cada revisión se añade aquí, con fecha, y sus hallazgos reales se llevan como tareas nuevas al
backlog vigente (`BACKLOG_ULTIMATE_SEPTIEMBRE.md` u otro), citando esta tabla en su Nota.

### 4 de noviembre de 2026 — tercera revisión real (`T25`-`T30`, sesión 401)

Revisión de **Hoy**, **Registrar** y **Plan** (Plan › Mes, más Plan › Presupuesto) sobre el **sitio construido**, con el diseño nuevo por defecto. Instalación limpia con el conjunto de demostración anonimizado, a 1280 y 390 px, con capturas y un guion de solo lectura. Adelantada diez días: vencía el 14/11. Se hizo justo después del primer cierre real (octubre, firmado el 4/11), como pedía la revisión anterior. **Mismo límite que entonces:** son datos de demostración; lo que depende del estado del hogar se marca como no concluyente. Esta vez **sí se probaron entradas inválidas y el teclado** (heurísticos 5 y 9), y de ahí sale el hallazgo más grave.

| # Heurístico | Hallazgo | Estado |
|---|---|---|
| 3. Control y libertad / 5. Prevención de errores | **Intro cancelaba en los diálogos.** En `<form method="dialog">` el navegador usa el primer botón de enviar para Intro, y en `index.html` ese es «Cancelar». Afectaba a **«Cerrar mes»** (la confirmación de la firma, que sale con el motivo «Mes conciliado y revisado» escrito y seleccionado): Intro cancelaba el cierre en silencio. También a **«Registrar gasto»** (Hoy › «+ Apuntar gasto»), donde se perdía lo escrito, y a las demás operaciones protegidas (`requestOperationConfirmation`, siete llamadas). | ✅ Corregido en esta sesión. `ux-shell.js` (`mountDialogEnter`): Intro en un campo de texto de esos diálogos pulsa el botón que confirma, con sus validaciones; Esc y «Cancelar» siguen cancelando; en Safari, Esc conservaba además el «confirm» del cierre anterior y contaba como confirmar, también corregido. Pruebas: `tests/nielsen-2026-11.test.cjs` y la e2e «Intro en los diálogos confirma, nunca cancela» (390 `@safari` y 1280) |
| 1. Visibilidad del estado / 2. Mundo real | Registrar › «Frescura de tus datos» decía **«Todo al día. No hay ninguna tarea de datos con efecto estimable»** justo debajo de cuatro fichas «sin dato» y encima de tres tareas «Sin estimar» (`datos-ui.js`). | ✅ Corregido en esta sesión: si queda alguna tarea sin estimar, dice «Aún no se puede ordenar por euros. Faltan datos…» |
| 4. Consistencia | **«Reserva protegida» dice lo contrario en dos pantallas.** Hoy: «7.230 € · CaixaBank, 2.150 € por debajo», en rojo, que compara solo CaixaBank con la reserva (`views/hoy-v2.js:148`). La tira de cifras de Registrar y Plan › Presupuesto: «7.230 € · 2.850 € de margen», que compara toda la liquidez (`app.js:4531`). Mismo nombre, dos medidas y lecturas opuestas, en la cifra con la que se decide si se puede gastar. | ✅ `T25`, decidido por el hogar el 5/11: **toda la liquidez**. Hoy y la cabecera de siempre miden ya igual que la tira de cifras; el mínimo operativo de CaixaBank sigue con su aviso propio |
| 2. Mundo real / 4. Consistencia | **«Peor mes» con dos unidades.** En la tira, «nov 26 · 2,4m» (meses de colchón; la «m» no se explica, `app.js:4540`). En «Qué se recalcula al guardar», «Peor mes del horizonte · nov 26 · 10.350 €» (euros). | ✅ `T26`, hecho el 5/11: la tira dice «Colchón más justo · nov 26 · 2,4 meses» |
| 2. Mundo real / 4. Consistencia | **Plan › Mes: «Sin asignar 270 €» junto a «Irá a ahorro este mes 800 €».** Con 270 € sin destino no se entiende de dónde salen los 800 €. Es la meta del plan de ahorro (`savingsPlanCalculations`, `views/plan-v2.js:170`), no un reparto del mes, y la pantalla no lo dice. Hoy repite «800 € irán a ahorro». | ✅ `T27`, decidido por el hogar el 5/11: **el ahorro como partida**. Plan › Mes lo suma a lo asignado y lo descuenta de «Sin asignar», con una fila que lleva a Ahorro y objetivos; Hoy dice «de gasto» en vez de «asignado» |
| 2. Mundo real | Hoy, la tarjeta **«Patrimonio»** enseña como cifra principal **la deuda viva** («Deuda viva · libre oct 2029* · 12.000 €», `views/hoy-v2.js:262`). El patrimonio neto solo sale si hay activos declarados. | ✅ `T28`, hecho el 5/11: con activos, «Patrimonio» con el neto primero; sin ellos, «Deuda» |
| 6. Reconocer / 7. Eficiencia | Plan en el móvil (390 px): la barra de pestañas corta «Ahorro y objetivos» y **esconde Presupuesto, Esta semana y Partidas** sin señal de que haya más (se desplaza en horizontal, sin sombra ni flecha). | ✅ `T29`, hecho el 5/11: en el móvil las seis pestañas pasan a dos líneas |
| 4. Consistencia | **Nombres distintos para lo mismo:** «+ Apuntar gasto» (Hoy) abre «Registrar gasto nuevo»; «Ir a Conciliar y cerrar» (Registrar › Frescura) lleva a lo que el menú llama «Cierre». En Plan › Presupuesto (pantalla clásica) hay **un campo «0» sin etiqueta** entre «Sugerir presupuestos» y «Repetir mes anterior ± %». | ✅ `T30`, hecho el 5/11: «+ Registrar gasto» en Hoy, «Ir a Cierre» y «Ajuste ± %» con su etiqueta |

**Lo que sigue de la revisión del 15/10:**
- **`T22` («Dato real»): sigue.** Ahora se nota más: en Hoy la insignia «Dato real» está a la vez que «Saldos estimados · confírmalos con tu banco». Sigue **consultada**.
- **`T23` (dos puntuaciones de salud en Hoy): resuelto por Hoy v2.** Ya no sale ninguna de las dos.
- **`T24`:** «día(s)» ya no aparece en Hoy, Registrar ni Plan. Siguen el título de Registrar («La única puerta de escritura de datos reales», con «Fuente del libro: libro canónico calculado» debajo) y las tres formas de la guía: botón «Guía de este flujo» en Plan › Presupuesto, enlace en Registrar, «Guía de Plan» en Plan › Mes. Se resuelven cuando Registrar pase al diseño nuevo.
- **Heurístico 8 (minimalista), antes no concluyente: mejora clara.** Hoy mide 1,7 pantallas a 1280 px y 3 a 390 (antes 7,4 y 13,2) y Plan › Mes, 1,5 y 2,5. **Registrar sigue en 2,8 y 4,8**: es la pantalla de uso diario que queda sin rediseñar, con la tira de cinco cifras, la regla «Previsto, real y usado» y la frescura de los datos en la misma página.

**Sin hallazgo en lo observado:**
- **9. Recuperarse de errores:** un importe inválido en Registrar › Reales («mil euros») dice «No es un importe: escríbelo como 1.234,56. No se ha guardado.», junto al campo.
- **1. Visibilidad del estado:** «Guardado a las…» en la cabecera, «5 por revisar» en Ajustes y «3 funciones esperan datos» en Hoy.
- **10. Ayuda:** sin hallazgo nuevo aparte de `T24`.

**No concluyente:**
- la tarjeta «Primeros pasos» y el enlace «Saltar al contenido» visible arriba (sale con el foco que deja el guion al cambiar de pantalla; habría que verlo abriendo la app de cero);
- el selector de fecha y «Choose File», que salen en inglés porque el navegador del guion está en inglés.

### 15 de octubre de 2026 — segunda revisión real (`T21`-`T24`, sesión 310)

Revisión de **Hoy**, **Registrar** y **Plan** sobre el **sitio construido** (instalación limpia con el conjunto de demostración anonimizado, a 1280 y 390 px; capturas y medidas con un guion de solo lectura), adelantada un día (tocaba el 16/10). **Límite que condiciona todo lo que sigue:** es una instalación limpia con datos de demostración, no el estado real del hogar; lo que depende del estado (la tarjeta de «primeros pasos», cuántas tarjetas salen) se anota como **no concluyente**. **Hoy sigue congelado hasta leer H-02:** los hallazgos de Hoy se registran, no se corrigen.

| # Heurístico | Hallazgo | Estado |
|---|---|---|
| 2. Correspondencia con el mundo real | Un identificador interno de tarea llegaba a la pantalla: en **Registrar › Saldos**, la razón «No sé cuánto cambia una cifra: hace falta el contrato de la hipoteca con su índice para estimar la cuota **(H-07)**» (`datos-ui.js:126`). «H-07» es una tarea de este plan, no un concepto del hogar. | ✅ Corregido en esta sesión — `T21` (ahora dice «se teclea en Deuda › Contratos») |
| 1. Visibilidad del estado / 2. Mundo real | La insignia de cabecera **«DATO REAL»** depende **solo de la pantalla** (`UX2_VIEW_NATURE`, `app.js:4501-4532`, «por defecto real»), no del dato. En Registrar con «Auto por fecha» sale «DATO REAL» a la vez que la propia pantalla dice «los saldos son una estimación del plan y no hay nada que confirmar», y junto a «Fuente: demo-publico-anonimizado». En una app cuya regla central es no pasar una estimación por dato real, la insignia puede decir lo contrario de lo que hay. | ⏳ `T22` — **se consulta** (cambia el significado de una insignia compartida por unas 40 pantallas) |
| 4. Consistencia | **Dos puntuaciones de «salud financiera» distintas en Hoy a la vez**: la insignia de cabecera «Salud financiera: **58**/100» (`homeHealthScore()`, promedio de semáforos) y la tarjeta «Salud financiera compuesta **56.2**/100» (`renderHomeHealthScoreCard`, `app.js:30343`). El código lo declara a propósito («complementa, no sustituye»), pero **la pantalla no explica por qué difieren**. Además las puntuaciones usan **punto decimal** («56.2», «77.6») cuando el resto de las cifras de la app va con coma («8310,00 €»). | ⏳ `T23` — **se consulta** (Hoy congelado; qué puntuación manda es una decisión de producto) |
| 4. Consistencia / 10. Ayuda | El mismo control «Guía de este flujo» se ve distinto en cada pantalla: botón en Hoy, enlace subrayado en Registrar, y **botón + enlace a la vez** en Plan (el del pie de estado y el del título). | ⏳ `T24` — bajo (pulido; Hoy congelado) |
| 2. Mundo real | Texto de relleno en la pantalla: «**24 día(s)**» como título de la cobertura de Hoy (`index.html:440`) y «hace N día(s)» en `views/cierre.js:114` y `app.js:19180`. | ⏳ `T24` — bajo (pulido; Hoy congelado) |
| 2. Mundo real | El título de Registrar es «**La única puerta de escritura de datos reales**»: describe la arquitectura, no la tarea del hogar («Anota lo que ha pasado» diría lo mismo). | ⏳ `T24` — bajo (redacción; se consulta el texto) |
| 8. Minimalista | **No concluyente.** Medido en instalación limpia: Hoy mide 7,4 pantallas a 1280 px y 13,2 a 390 px, con la tarjeta de «primeros pasos» y 22 tarjetas visibles en total; la zona principal tiene los **4 bloques** que fija `OPT-8` (comprobado: `home-layout` con cobertura y «el mes en una línea», decisiones abiertas y `homeKpis`), pero esa zona sola ocupa 2.082 px (2,3 pantallas) y empieza a 1.158 px del borde superior, así que «sin scroll en desktop» no se cumple en este estado. `T18` (sesión 208) ya contó los bloques y los dio por buenos; **lo que no medía es el alto**. Hay que repetirlo con el estado real del hogar (sin la tarjeta de primeros pasos y con sus datos). | ⏳ Repetir tras el primer cierre real (1-3/11); no se abre tarea ahora |

Heurísticos 3 (control y libertad), 5 (prevención de errores), 7 (flexibilidad) y 9 (recuperación de errores): **sin hallazgo en lo observado** (hay «Guardado a las 10:45» y «Todo guardado» visibles, deshacer y cancelar en las pantallas revisadas); **no se probaron mensajes de error con entradas inválidas** en esta pasada. El heurístico 1 queda con el hallazgo de la insignia; el estado de guardado sí es visible en Registrar y en Plan.

**Bloque D (misma sesión, accesibilidad de Cierre con datos).** Axe sobre **Cierre con el asistente, las
listas de comprobación y los cuatro avisos a la vez** (plan B, deuda en la sombra, puente, calma), en claro y
oscuro × 1280 y 390 px:

- **Los cuatro avisos salen limpios**: cero violaciones en ellos, en los ocho cruces.
- **Lo que fallaba no eran los avisos, sino el asistente y sus listas** (defecto previo, invisible para la
  suite porque nunca pintaba ese estado): los pasos bloqueados se atenuaban con `opacity: 0.6` (**2,49:1**), las
  listas «cuadra / no cuadra» pintaban verde y rojo sobre fondo teñido (**3,02:1** y 4,46:1), la nota ámbar de la
  revisión anual daba **2,94:1**, el texto del objetivo 4,36:1 y la insignia de peligro en oscuro 4,1:1. Es justo
  la pantalla que el hogar usa del 1 al 3 de noviembre.
- **Corregido en un fichero nuevo, `cierre-a11y.css`**, sin tocar `design-tokens.css` (su sello está fijado por
  nueve pruebas) ni los tokens compartidos: solo el color del texto dentro de `.e19-cierre`, mezclado con la tinta
  del tema para que suba el contraste en claro y en oscuro. Prueba nueva en `opt4-axe-accessibility.spec.cjs`
  (2 casos, claro y oscuro, cada uno en 1280 y 390); contra la compilación sin el arreglo falla con las nueve
  violaciones de arriba, con él pasa.
- **No resuelto, y se dice**: el defecto de fondo (los tokens `--e19-success`, `--e19-danger` y `--e19-warning` no
  llegan a 4,5:1 sobre fondos teñidos) sigue en el resto de la app; este arreglo lo contiene solo en Cierre. La
  auditoría del sistema de diseño que pide el encabezado de `opt4-axe-accessibility.spec.cjs` sigue pendiente.

### 16 de septiembre de 2026 — primera revisión real (`T1`, sesión 197)

Primera revisión real contra las tres pantallas (`renderHomeDashboard()`/`#home`,
`renderRegistrar()`/`#registrar`, `renderPlan()`/`#plan`), con evidencia `file:line` concreta antes
de anotar nada — mismo criterio que exige esta checklist. Siete hallazgos reales; dos se corrigieron
en la misma sesión por ser triviales y sin decisión de producto de por medio, cinco quedan como
tareas nuevas en `BACKLOG_CONTABILIDADCASA_2_0.md` §4 (`T15`-`T19`).

| # Heurístico | Hallazgo | Estado |
|---|---|---|
| 1. Visibilidad del estado | Plan nunca confirma «guardado»: a diferencia de Registrar («guardado hace poco, a las HH:MM»), la barra de impacto de Plan solo desaparece (`hidden`) al no haber cambios pendientes, sin distinguir «nada que guardar» de «ya guardado». | ✅ Corregido — `T15` (sesión 199, `BACKLOG_CONTABILIDADCASA_2_0.md` §4) |
| 2. Correspondencia con el mundo real | `index.html:709`: el control de Plan mostraba literalmente «Sobres · Fase 6» — un identificador de fase de backlog interno filtrado a la UI. | ✅ Corregido en esta sesión (ahora dice solo «Sobres») |
| 4. Consistencia | Tres vocabularios distintos para «previsto vs. real» en las tres pantallas de uso diario: Registrar define «Previsto/Real/Usado»; Plan usa «Ingreso previsto/Comprometido/Asignado/Sin asignar» sin conectarlo; Home usa «Gasto previsto/Gasto real a hoy/Desviación». | ✅ Corregido — `T16` (sesión 208, alcance acotado tras investigar: solo la tarjeta «El mes en una línea» de Hoy necesitaba el cambio; detalle en `BACKLOG_CONTABILIDADCASA_2_0.md` §4) |
| 6. Reconocer, no recordar | La pestaña Previsión de Plan no repite la cifra de reserva protegida que sí aparece en Home y Registrar — solo enlaza fuera (`index.html:747`). | ✅ Corregido — `T17` (sesión 199, `BACKLOG_CONTABILIDADCASA_2_0.md` §4) |
| 8. Diseño minimalista | El propio comentario de `index.html:307-311` declara «máximo 4 bloques en la zona principal, sin scroll en desktop» para Home; la implementación real tiene 9 artículos estáticos más 2 rejillas dinámicas (`homeBudgetGlance`, `homeKpis`) — no cumple su propia regla. | ✅ Verificado sin construir nada — `T18` (sesión 208): recuento real dio 3 artículos + 2 rejillas, exactamente los 4 bloques de la regla; detalle en `BACKLOG_CONTABILIDADCASA_2_0.md` §4. `BACKLOG_CONTABILIDADCASA_3_0.md` añade `FLU-1`: un test automático que fije esto como invariante hacia adelante |
| 9. Recuperación de errores | `app.js:28244`, dentro de `undoLastImportBatch()`: «No se pudo deshacer» mostraba el error crudo sin ninguna instrucción de qué hacer, rompiendo el patrón «qué pasó + qué hacer» que sigue el resto de Registrar. | ✅ Corregido en esta sesión (añade «Vuelve a intentarlo; si persiste, comprueba tu conexión y recarga la página.») |
| 10. Ayuda y documentación | «Guía de este flujo» existe en Home y Registrar (`index.html:288`, `476`) pero no en Plan — justo la pantalla con el vocabulario más distinto (hallazgo 4) y que no repite las cifras clave (hallazgo 6). | ✅ Corregido — `T19` (sesión 199, `BACKLOG_CONTABILIDADCASA_2_0.md` §4) |

Heurísticos 3 (control y libertad), 5 (prevención de errores) y 7 (flexibilidad) se revisaron sin
hallazgo real que anotar — deshacer/cancelar/descartar cubiertos con criterio, validación bloqueante
real antes de importar, y atajo global (Cmd/Ctrl+K) más importación en lote ya cubren lo esencial.

### 29 de agosto de 2026 — arranque del hábito (OPT-21)

Sesión de construcción de la checklist, no de revisión: esta tabla y el proceso quedan listos hoy.
La primera revisión real de Hoy/Registrar/Plan queda pendiente para la próxima vez que se abra esta
sesión con cadencia mensual — no se ha fabricado ningún hallazgo para no inventar deriva de UX que
no se ha comprobado de verdad contra la pantalla real.
