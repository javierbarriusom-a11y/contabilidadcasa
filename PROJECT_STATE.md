# Estado del proyecto

Fecha de revisión: 10 de agosto de 2026.

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
