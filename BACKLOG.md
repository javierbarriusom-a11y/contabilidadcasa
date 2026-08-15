# Backlog operativo — seis vistas × evolución funcional

Fecha: 10 de agosto de 2026. Repositorio vivo: `javierbarriusom-a11y/contabilidadcasa`.
Sitio: `https://javierbarriusom-a11y.github.io/contabilidadcasa/`.

Este documento **sustituye a `BACKLOG_STATUS.md` como backlog vigente**. Aquel queda como
registro histórico de las entregas E1-E20, que sigue siendo válido y no se toca.

Por qué se rehace: hasta ahora había dos backlogs que no se hablaban. Uno funcional
(E1-E20, «qué sabe hacer la app») y otro de diseño (el catálogo de mockups, «qué aspecto
tiene cada pantalla»). El rediseño a seis vistas obliga a fusionarlos, porque organiza el
trabajo por **vista de producto**, no por entrega técnica. Lo que sigue es esa fusión, con
el estado real medido sobre el código publicado, no sobre lo que decía el plan.

Leyenda de estado:

| | Significado |
|---|---|
| ✅ | Hecho, fusionado a `main` y **visible en el sitio publicado** |
| 🟡 | Publicado pero **parcial**, con la omisión documentada y localizable |
| ⏳ | Pendiente, sin bloqueo: se puede empezar cuando se quiera |
| ⛔ | Bloqueado por una decisión de producto que el usuario no ha tomado |

**Actualización del 10 de agosto de 2026 · «Versiones anteriores».** El usuario decide que
las pantallas heredadas **no se retiran: se mueven a una sección «Versiones anteriores»**.
Eso desbloquea las cinco fusiones que estaban en ⛔ y cambia la naturaleza del trabajo
pendiente. Ver la sección 3.

---

## 1. Inventario real: qué hay publicado hoy

Contado sobre el `index.html` publicado, no sobre el plan.

- **35 pantallas** (`view-section`) en la aplicación.
- **17 con la piel nueva** (clase de ámbito `e19-*`): las migradas en E19 y E20, más `#datos-importar`
  (V4-4, 10 de agosto).
- **18 heredadas**, sin migrar, que siguen en pie y en uso.

| Con piel nueva (17) | Heredadas todavía en pie (18) |
|---|---|
| `#home`, `#update-hub`, `#data-entry`, `#forecast`, `#prevision` | `#visual-detail`, `#update-data`, `#movements`, `#cashflow`, `#savings-plan` |
| `#escenario-simular`, `#escenario-aplicar`, `#escenario-guardados` | `#simulator`, `#new-life-simulation`, `#new-life-definitive` |
| `#deuda-comparar`, `#deuda-ruta`, `#asesor-decision` | `#debt-roadmap`, `#debt-liquidation-plan`, `#debt-control` |
| `#conciliar`, `#registrar-mes`, `#datos-importar` | `#reconciliation`, `#data-audit`, `#operations-manual` |
| `#cuadro-mandos`, `#cambios-pendientes`, `#mapa-calor` | `#executive-advisor`, `#virtual-advisor`, `#savings-agent`, `#alerts-center` |

**El número que importa: 35, no 22.** El rediseño se dibujó cuando había 22 pantallas y
proponía reducirlas a 6. Desde entonces la app ha crecido a 35, porque cada mockup migrado
se añadió **junto a** la heredada en vez de sustituirla. Es decir: el trabajo hecho ha
mejorado la app y a la vez ha alejado el objetivo de seis vistas. No es un error —era la
regla acordada, «envolver, no sustituir»— pero conviene verlo escrito.

### Los quince mockups de los turnos 1-3

**15 de 15 migrados y completos.** Dos con una nota permanente sobre datos que el proyecto decide
no fabricar (ver T-6 más abajo para la tarea real que las cerraría de verdad):

| Mockup | Pantalla | Estado | Qué falta |
|---|---|---|---|
| 1a Hoy | `#home` | ✅ | — |
| 1b Ruta de deuda | `#deuda-ruta` | ✅ | — · publicada de verdad el 10 de agosto, ver §8 |
| 1c Comparador de estrategias | `#deuda-comparar` | ✅ | — · las cuatro estrategias del rediseño desde V3-3, confirmadas en el sitio el 10 de agosto |
| 1d Asesor ejecutivo | `#asesor-decision` | ✅ | Construido al completo sobre ofertas reales de E14b; sin motor de recomendación genérico a propósito, ver nota en `docs/E19_SISTEMA_DISENO.md` §8 y T-6 |
| 1e Simular | `#escenario-simular` | ✅ | — · publicada de verdad el 10 de agosto, ver §8 |
| 1f Actualizar (hub) | `#update-hub` | ✅ | — |
| 1g Conciliación | `#conciliar` | ✅ | — |
| 2a Registrar el mes | `#registrar-mes` | ✅ | — · aviso «¿es anual?» hecho y confirmado en el sitio el 12 de agosto (V4-3/V4-5) |
| 2b Importar extracto | `#data-entry` | ✅ | — |
| 2c Previsión | `#prevision` | ✅ | — · pantalla real construida el 15 de agosto de 2026 (P-8); hasta entonces el ✅ era incorrecto, ver nota bajo esta tabla |
| 2d Aplicar escenario | `#escenario-aplicar` | ✅ | — · publicada de verdad el 10 de agosto, ver §8 |
| 2e Escenarios guardados | `#escenario-guardados` | ✅ | Solo `aplicado`/`guardado`, sin `recomendado`/`caducado` inventados a propósito, ver nota en §5 y T-6 |
| 3a Cuadro de mandos | `#cuadro-mandos` | ✅ | — |
| 3b Bandeja de cambios | `#cambios-pendientes` | ✅ | — |
| 3c Mapa de calor | `#mapa-calor` | ✅ | — · panel de recomendaciones calculadas, confirmado en el sitio el 12 de agosto (V2-5) |

**Corrección del 15 de agosto de 2026 sobre 2c Previsión.** El ✅ de la fila de arriba era
incorrecto desde que se escribió: `#prevision` seguía siendo la tabla resumen anual heredada con la
piel visual de E19-5 aplicada encima, no el mockup 2c (titular en prosa, selector de horizonte,
banda por mes, tabla mensual y panel día a día con sugerencia). El error se repetía en
`docs/E19_SISTEMA_DISENO.md`, que también daba el mockup por migrado — corregido ahí en §13 antes de
construir nada. La pantalla real se construyó esta sesión (P-8 de `docs/BACKLOG_NUEVE_PANTALLAS.md`,
ahora `Hecho`), reutilizando tal cual el motor ya existente (`previsionMetric`, `mapaCalorFloor`/
`mapaCalorTone`, `planningBreakdownForForecastMonth`) — ver la nota bajo la tabla de la pantalla 04
en `docs/BACKLOG_NUEVE_PANTALLAS.md` para el detalle de qué se reutilizó y qué es nuevo.

### Los turnos 4-5 (el rediseño a seis vistas)

**0 de 6 vistas adoptadas como arquitectura.** De las diez piezas del material:

- **5a · pie de impacto**: ✅ implementado en `#cuadro-mandos` (E20-5).
- **4a-4f · las seis vistas**: ⏳ sin adoptar. Ya no bloqueadas: ver la sección 3.
- **5c/5d · importación por decisión**: hecha el 10 de agosto y confirmada en el sitio el 11 (V4-4).

---

## 2. Las seis vistas: cuánto está cubierto

Esta es la respuesta directa a «cuántas de las seis están en el repositorio vivo». La
respuesta corta: **las seis existen como vista única en la navegación principal (T-1, 11 de
agosto) y las seis tienen su función construida, publicada y confirmada en el sitio.**

| Vista | Función cubierta | Pantallas nuevas que la cubren | Heredadas que pasan a «Versiones anteriores» |
|---|---|---|---|
| **1 · Hoy** | ✅ alta | `#home`, `#asesor-decision` | `#executive-advisor`, `#virtual-advisor`, `#savings-agent`, `#alerts-center` — **ya relegadas** (V1-4) |
| **2 · Plan** | ✅ alta | `#cuadro-mandos`, `#cambios-pendientes`, `#mapa-calor`, `#prevision`, `#escenario-*` (3) | `#visual-detail`, `#cashflow`, `#savings-plan`, `#simulator`, `#new-life-simulation` — **ya relegadas** (V2-8) |
| **3 · Deuda** | ✅ alta | `#deuda-comparar`, `#deuda-ruta` | `#debt-roadmap`, `#debt-liquidation-plan`, `#debt-control` — **ya relegadas** (V3-5) |
| **4 · Datos** | ✅ alta | `#update-hub`, `#data-entry`, `#registrar-mes`, `#datos-importar` | `#update-data`, `#movements` — **ya relegadas** (V4-6) |
| **5 · Cierre** | ✅ alta | `#conciliar`, con «Confianza del dato» por cuenta (V5-2, 12 de agosto) | `#reconciliation`, `#data-audit`, `#operations-manual` — **ya relegadas** (V5-3) |
| **6 · Ajustes** | ✅ alta | `#ajustes` (V6-3, 11 de agosto): reserva operativa, ventana de duplicados y umbral de partida editables (V6-2); colchón mínimo en meses en `#alerts-center` (V6-2); CSV completo y PDF del mes descargables desde aquí (V6-4, 12 de agosto); cuentas y partidas enlazadas a donde ya se editan | — |

### Lo que falta en cada una, medido

**1 · Hoy.** Los tres KPI del rediseño son *Colchón disponible*, *Deuda pendiente* y
*Libre de deuda*. **Los tres están desde el 10 de agosto, y confirmados en el sitio publicado**
(V1-3): a *Liquidez hoy* se le
suman *Deuda pendiente* y *Libre de deuda*, calculadas por el mismo camino que las de
`#deuda-comparar` para que las dos vistas no puedan contar historias distintas. Hoy enseña
seis KPI en dos filas: los tres del rediseño arriba y *Capacidad libre real*, *Reserva
protegida* y *Próximo riesgo* debajo. Sus cuatro heredadas quedaron relegadas el 11 de agosto
(V1-4), sin esperar a cerrar la 🟡 de V1-2 —dejó de ser un requisito con la decisión del 10 de
agosto, ver la sección 5—. El asesor ejecutivo (V1-2, 12 de agosto) ya se asoma desde «Situación
actual» cuando hay una oferta de deuda abierta, enlazando a `#asesor-decision`. Con esto, las
cuatro tareas de V1 están hechas y **confirmadas por el usuario en el sitio publicado el 12 de
agosto de 2026**: la vista 1 · Hoy queda ✅ por completo.

**2 · Plan.** Es la más completa: la tabla editable con pie de impacto está construida y
publicada, que era el corazón del rediseño. El primer enlace de «Dónde seguir con ese mes» ya
nombra el bloque real que más pesa (V2-5), y la banda de doce meses ya vive *dentro* de Plan
(V2-7). El pie gana también un cuarto indicador, la fecha libre de deuda (V2-6) — sin diferencia,
porque editar un previsto sigue sin tocar ningún contrato, así que se muestra fija en vez de
fingir un cambio. Las tres, **confirmadas por el usuario en el sitio publicado el 12 de agosto de
2026**. Sus cinco heredadas quedaron relegadas el 10 de agosto (V2-8). Con esto, las ocho tareas
de V2 quedan hechas y confirmadas: la vista 2 · Plan queda ✅ por completo.

> **Corrección del 10 de agosto: `#forecast` no era una heredada.** Esta tabla lo listaba
> entre las que Plan debía relegar, contradiciendo al inventario de la sección 1, que lo
> cuenta —bien— entre las dieciséis pantallas con piel nueva: la sección lleva la clase
> `e19-forecast` y el menú principal la usa como la pestaña «Prever». Relegarla habría
> degradado una pantalla migrada y dejado una pestaña de primer nivel apuntando a
> «Versiones anteriores». Se queda donde está; reordenar el menú principal es trabajo de
> T-1. Por eso V2-8 mueve cinco pantallas y no seis.

**3 · Deuda.** La vista más completa después de Plan: sus tres heredadas quedaron relegadas el 10 de
agosto (V3-5) y ninguna se desconectó — `#debt-roadmap` sigue siendo el único sitio donde se registra
y aplica una oferta. Estrategias y orden de ataque,
construidos, y desde el 10 de agosto las cuatro del
rediseño: V3-3 añadió *Consolidar* pidiendo la oferta —TIN, plazo y comisión— en vez de fabricarla,
y *No tocar nada* se queda como cuarta tarjeta, que es la referencia contra la que se comparan las
demás. La «oferta en curso» del mockup ya no vive solo en `#asesor-decision` (V3-4, 12 de agosto):
`#deuda-ruta` gana una tarjeta «Oferta en curso» que reutiliza `asesorDecisionOpenOffers()` y
`asesorDecisionFundingHtml()` tal cual, con un botón que replica el mismo gesto de
`asesorDecisionApply` — marca la oferta en el workspace de E14b y enruta a `#debt-roadmap`, que sigue
siendo el único sitio donde se aplica de verdad. Con esto, las cinco tareas de V3 quedan hechas y
**confirmadas por el usuario en el sitio publicado el 12 de agosto de 2026**: la vista 3 · Deuda
queda ✅ por completo.

**4 · Datos.** Hub, importación y registro del mes, construidos, y desde el 10 de agosto también los
cuatro pasos que pedía el turno 5 (V4-4): `#datos-importar` los antepone a la bandeja previa de
`#data-entry`, sin sustituirla — Cargar → Clasificar → Duplicados → Incorporar, con una decisión
explícita por movimiento dudoso y por candidato a duplicado, y nada tocando el plan hasta el último
paso. Reutiliza el mismo diccionario de reglas y el mismo lote reversible que ya usaba
`#data-entry`, así que «Deshacer último lote» funciona igual sobre las dos vías. Registrar el mes
gana el aviso «¿es anual?» (V4-3/V4-5, 12 de agosto): cuando una partida nueva de ese mes
(`entry.row.custom`) tiene un real cuyo importe (±0,50 €) apareció en el extracto hace ~12 meses
(±15 días) y nada parecido entre medias, aparece una fila bajo esa partida preguntando si se repite
cada año; «Sí, anual» solo lo recuerda y apunta a Partidas para anotarlo —no proyecta el previsto
hacia años futuros, porque el motor de planificación sigue siendo estrictamente mensual—, y «Solo
este mes» calla el aviso igual. Es de solo lectura sobre `baseData.transactions` y no toca la
clasificación/incorporación de `#datos-importar`; con la fila cerrada, o si el mes está cerrado,
tampoco se pregunta. Limitación documentada: tras editar el real por la vía rápida
(`registrarMesRefreshCells`), el aviso aparece en el siguiente repintado completo de la tabla, no al
instante. **Confirmado por el usuario en el sitio publicado el 12 de agosto de 2026.** Con esto,
las seis tareas de V4 quedan hechas y confirmadas: la vista 4 · Datos queda ✅ por completo.

**5 · Cierre.** Las diferencias como tareas, construido, y sus tres heredadas ya relegadas
(V5-3). El panel «Confianza del dato» por cuenta (cuadra / descuadra / sin conciliar) vive ahora
en `#conciliar` (V5-2, 12 de agosto), junto a «Pendiente de resolver»; sigue siendo cierto que
`#data-audit` no se retira, porque el inventario completo por cuenta —no solo su estado— sigue
viviendo ahí.

**6 · Ajustes.** La vista existe desde el 11 de agosto (V6-3), con su pieza más urgente:
**la reserva operativa tiene control real** (V6-1, mudada aquí en V6-3). El diagnóstico que
justificaba V6-1 era que `state.operatingReserve` no aparecía ni una vez en `index.html` pese a
que el modelo la lee desde tres sitios, así que valía siempre 0 y las tres pantallas caían
a su respaldo:

- El pie de impacto de Plan (`#cuadro-mandos`) no podía decir «meses bajo reserva» y caía a
  «meses en negativo».
- El mapa de calor coloreaba contra «un mes de salidas» en vez de contra la reserva real.
- El comparador de deuda usaba un suelo de 0 € por defecto en vez de la reserva del hogar.

Con la casilla puesta, las tres hablan de la misma cifra y cada una declara cuál está
usando. `#ajustes` reúne cuentas, partidas, umbrales y exportación: la reserva operativa, la
ventana de duplicados y el umbral de desviación por partida se editan de verdad aquí (V6-2), el
colchón mínimo en meses es una regla más del framework de alertas ya existente en
`#alerts-center` (V6-2), el CSV completo y el PDF del mes se descargan aquí mismo (V6-4, 12 de
agosto), y cuentas y partidas siguen **enlazando a donde cada una ya se edita** en vez de
reimplementar esos formularios. Lo único que sigue faltando en el bloque es que el umbral de
partida llegue a cambiar el tinte de Registrar el mes, hoy solo informa en Ajustes. Sigue siendo
el bloque con mejor relación esfuerzo/valor de todo el backlog.

---

## 3. La decisión: no se retira nada, se relega

**Decisión del usuario del 10 de agosto de 2026:**

> «En vez de quitar las pantallas fusionadas, pasarlas a una sección tipo *Versiones
> anteriores*.»

Esto resuelve el bloqueo. La objeción a adoptar las seis vistas nunca fue el diseño: era
que **retirar una pantalla heredada que todavía hace algo que la nueva no hace es una
pérdida de función difícil de detectar hasta que se echa en falta**. Si no se retira sino
que se relega, esa pérdida no puede ocurrir: el camino de vuelta sigue existiendo.

### Qué significa exactamente

- Las 18 pantallas heredadas **siguen funcionando y siguen alcanzables**. No se borra
  código, no se borran rutas, no se rompe ningún enlace guardado.
- Salen de la navegación principal y pasan a un grupo propio, **«Versiones anteriores»**,
  al final del menú.
- La navegación principal queda con las seis vistas, que era el objetivo del rediseño.
- Quien eche en falta algo abre la versión anterior y sigue trabajando. Eso además
  **convierte cada visita a una pantalla heredada en una señal**: si nadie la abre en unos
  meses, retirarla deja de ser una apuesta y pasa a ser una limpieza.

### Por qué es barato: el mecanismo ya existe

No hay que reescribir la navegación. E17 ya la tiene construida así:

- Cada enlace lleva `data-e17-group="..."` en `index.html` — hoy hay cuatro grupos
  (`main`, `analysis`, `assistants`, `data`).
- `e17Preferences()` en `app.js:371` guarda un booleano por grupo en almacenamiento local.
- `applyE17Preferences()` en `app.js:379` oculta los enlaces del grupo apagado.
- El panel «Personalizar» ya expone un interruptor por grupo.

Añadir «Versiones anteriores» es, en lo esencial: **un grupo `legacy` más en las
preferencias, reetiquetar los 18 enlaces heredados, un encabezado en el menú y un
interruptor en el panel**. Ninguna de esas cuatro cosas toca cálculo, contrato de guardado
ni pantallas.

### La subdecisión que quedaba, resuelta

¿El grupo nace **visible** o **plegado**? **Nace visible**, que era la recomendación: el
primer día no cambia nada para quien esté a mitad de una tarea, y el interruptor para
plegarlo está a un clic. Plegarlo más adelante no exige tocar código, es el mismo
interruptor, así que la decisión no compromete nada.

### Lo que ya está construido (T-0, 10 de agosto de 2026)

El contenedor, no las mudanzas. En concreto:

- La preferencia `legacy` existe y **nace en `true`**, incluso para quien ya tuviera
  preferencias guardadas de antes.
- El encabezado «Versiones anteriores» está en el menú avanzado, y el interruptor en
  «Personalizar».
- **Un encabezado sin enlaces visibles debajo se oculta solo**, y un interruptor de un grupo
  vacío también, así que T-0 no se vio hasta que **V4-6** movió las dos primeras pantallas.
  De paso arregla un detalle viejo: apagar «Análisis» dejaba su etiqueta flotando sobre la nada.
- **Relegar no esconde una pantalla del lanzador.** «Buscar o abrir» busca sobre el catálogo
  entero y no mira estas preferencias, así que incluso con el grupo apagado la heredada
  sigue siendo alcanzable por su nombre. Es la garantía de que relegar no puede parecerse a
  perder.

---

## 4. El backlog fusionado

Seis bloques que son las seis vistas, más uno transversal. Cada tarea lleva el origen
(mockup, entrega funcional o hallazgo) para que se pueda rastrear.

### V6 · Ajustes — *el bloque con mejor relación esfuerzo/valor*

| ID | Tarea | Estado | Prioridad | Origen |
|---|---|---|---|---|
| V6-1 | **Control de reserva operativa** en la interfaz, escribiendo `state.operatingReserve` | ✅ | **Alta** | Hallazgo: el modelo la usa y nadie puede fijarla |
| V6-2 | Umbrales de aviso: colchón mínimo en meses, desviación por partida, ventana de duplicados | ✅ | Media | Mockup 4f · Ajustes · hecha y confirmada en el sitio el 11 de agosto de 2026 |
| V6-3 | Vista `#ajustes` que reúna cuentas, umbrales, partidas y exportación | ✅ | Media | Mockup 4f · hecha y confirmada en el sitio el 11 de agosto de 2026 |
| V6-4 | Exportar CSV y PDF del mes desde un sitio único (hoy `downloadCsv` está disperso) | ✅ | Baja | Mockup 4f · hecha y confirmada en el sitio el 12 de agosto de 2026 |

**V6-1 es la primera tarea recomendada de todo el backlog.** Es pequeña, no rompe nada, y
mejora inmediatamente tres pantallas ya publicadas sin tocarlas.

> **V6-1, hecha el 10 de agosto de 2026.** La casilla «Reserva operativa» vivió en la fila de
> controles de `#cuadro-mandos`, junto a «Desde» y «Horizonte», hasta que existió la vista
> `#ajustes` (V6-3). Escribe `state.operatingReserve` y se guarda en `scenarioSettings`, así que
> se sincroniza y se restaura como un dato del hogar. Vaciarla significa «sin reserva
> configurada», no cero: cada pantalla vuelve a su respaldo declarado. Cerró en ✅: PR #5
> fusionada con CI en verde, Pages desplegado con éxito para `956e427` y el usuario confirmó la
> casilla en el sitio publicado el mismo 10 de agosto.

> **V6-3, hecha el 11 de agosto de 2026, junto con T-1.** La reserva operativa (V6-1) se traslada
> de `#cuadro-mandos` a `#ajustes`, que es donde declaraba desde el principio que iba a acabar;
> `#cuadro-mandos` pasa a ser un consumidor más, con una nota de solo lectura igual que ya tenía
> el comparador de deuda. Las otras tres tarjetas —cuentas, partidas y umbrales— **no
> reimplementan sus editores**: cada una enlaza a donde ese dato ya se edita de verdad
> (`#visual-detail`, `#registrar-mes`, `#alerts-center`), porque construir un formulario nuevo
> aquí duplicaría lógica sin necesidad, que es justo lo que el criterio del rediseño pide evitar.
> **Confirmada en el sitio publicado por el usuario el 11 de agosto de 2026, pasa a ✅.** V6-4
> (exportación única) sigue pendiente como tarea propia, sin bloquear esta.

> **V6-2, hecha el 11 de agosto de 2026, a continuación de V6-3.** Las tres piezas encajan en tres
> sitios distintos, cada una en el que ya sabía resolver ese tipo de umbral:
> - **Colchón mínimo en meses** es una regla más del framework de alertas que ya existía
>   (`UX_ALERT_METRICS`/`#alerts-center`): un metric+threshold+revisión es exactamente lo que ese
>   framework ya modelaba, así que no hacía falta un mecanismo nuevo. Reutiliza
>   `safeCoverageMonths`, el mismo cálculo que ya usa el pie de impacto.
> - **Ventana de duplicados** y **desviación por partida** no son alertas del hogar, son
>   parámetros de comportamiento, así que viven como ajustes propios en `#ajustes`, con el mismo
>   patrón «vacío es sin configurar, no cero» que ya usaba la reserva operativa. La ventana pasa de
>   ser una constante fija (`DATOS_IMPORTAR_DUPLICATE_WINDOW_DAYS = 7`) a un valor configurable que
>   los dos import de datos-importar piden explícitamente.
>
> **Confirmada en el sitio publicado por el usuario el 11 de agosto de 2026, pasa a ✅.** La
> omisión sigue siendo real y sigue documentada, no por prudencia genérica: **el umbral de
> desviación por partida es un único porcentaje global**, no una lista de partidas concretas que
> se vigilan una a una — se informa en una nota de Ajustes cuántas partidas del mes abierto lo
> superan, pero **Registrar el mes no cambia su tinte ni su filtro «Con desviación»**, que siguen
> contando cualquier diferencia como hacían antes. Cambiar esa pantalla, que ya está publicada y en
> uso, se dejó fuera a propósito para no arriesgar una regresión en un sitio que no pedía tocarse —
> queda como mejora futura explícita, no como parte pendiente de esta entrega.

> **V6-4, hecha el 12 de agosto de 2026.** El CSV completo (`downloadCsv`, sin tocar) y un PDF
> nuevo del mes abierto en Registrar el mes se piden ahora desde la tarjeta «Exportar» de
> `#ajustes`, que deja de ser un enlace de ruta a `#cashflow` y pasa a descargar de verdad — el
> mismo cambio de naturaleza que ya tuvo la reserva operativa al mudarse aquí en V6-3. El PDF no
> añade ninguna librería nueva: reutiliza `P2Export`, el escritor de PDF sin dependencias que ya
> usaba el informe para el asesor (E10), al que solo se le añade un método genérico
> (`downloadPlainPdf`) que recibe líneas de texto en vez del modelo específico de ese informe — el
> generador de bytes del PDF (`pdfBlob`) no se toca. El contenido del PDF reutiliza también lo que
> ya calculaba Registrar el mes (`registrarMesCollect`/`registrarMesTotals`): previsto, real y
> desviación de cada partida del mes abierto, con sus totales. **Confirmada en el sitio publicado
> por el usuario el 12 de agosto de 2026, pasa a ✅.**

### V1 · Hoy

| ID | Tarea | Estado | Prioridad | Origen |
|---|---|---|---|---|
| V1-1 | Hoy con la piel nueva y tres decisiones | ✅ | — | Mockup 1a · E19-2 |
| V1-2 | Asesor ejecutivo, una decisión abierta a la vez | ✅ | — | Mockup 1d · E20-2 · hecha y confirmada en el sitio el 12 de agosto de 2026 |
| V1-3 | Sumar los KPI *Deuda pendiente* y *Libre de deuda* a Hoy | ✅ | Media | Mockup 4b · hecha el 10 de agosto, reutilizando el cálculo de `#deuda-comparar` · **vista en el sitio** |
| V1-4 | Mover `#executive-advisor`, `#virtual-advisor`, `#savings-agent` y `#alerts-center` a Versiones anteriores | ✅ | Media | Mockup 4b · hecha y confirmada en el sitio el 11 de agosto, la quinta relegación |

> **V1-2, hecha el 12 de agosto de 2026.** `#asesor-decision` ya resolvía «una decisión abierta a
> la vez» al completo desde E20-2 (§8 del sistema de diseño): la oferta de deuda más urgente
> registrada en `#debt-roadmap`, con cifras reales, estado vacío explícito y el resto de ofertas
> en cola. El hueco real no era esa pantalla, era que **Hoy nunca la enlazaba** — grep sobre
> `app.js` confirmó cero referencias a `asesor-decision` desde cualquier función de `#home`. Se
> asoma como una lectura más en «Situación actual» (`homeInsights`), reutilizando
> `asesorDecisionOpenOffers()` tal cual: sin oferta abierta no aparece nada, con oferta abierta
> muestra contraparte, importe y vencimiento y enlaza a `#asesor-decision`. Ningún cálculo nuevo.
> **Cierra la vista 1 · Hoy por completo**: con esta, las cuatro tareas de V1 quedan hechas.
> **Confirmada por el usuario en el sitio publicado el 12 de agosto de 2026, pasa a ✅.**

### V2 · Plan

| ID | Tarea | Estado | Prioridad | Origen |
|---|---|---|---|---|
| V2-1 | Simular → comparar → aplicar en una vista | ✅ | — | Mockups 1e/2d/2e · E20-1 · llegó al sitio el 10 de agosto, §8 |
| V2-2 | Los once tipos de decisión del motor | ✅ | — | E20-3 |
| V2-3 | Cuadro de mandos con pie de impacto | ✅ | — | Mockup 3a + spec 5a · E20-5 |
| V2-4 | Bandeja de cambios reversible | ✅ | — | Mockup 3b · E20-5 |
| V2-5 | Mapa de calor mensual | ✅ | — | Mockup 3c · E20-5 · hecha y confirmada en el sitio el 12 de agosto de 2026 |
| V2-6 | Cuarto indicador del pie: fecha sin deuda | ✅ | Baja | Mockup 4c; hoy se omite con motivo, ver §12 del diseño · hecha y confirmada en el sitio el 12 de agosto de 2026 |
| V2-7 | Banda de doce meses integrada en Plan | ✅ | Baja | Mockup 4c · hecha y confirmada en el sitio el 12 de agosto de 2026 |
| V2-8 | Mover `#visual-detail`, `#cashflow`, `#savings-plan`, `#simulator` y `#new-life-simulation` a Versiones anteriores | ✅ | — | Mockup 4c · hecha el 10 de agosto, ver la nota sobre `#forecast` |

> **V2-5, V2-6 y V2-7, hechas el 12 de agosto de 2026.** Los tres remates del bloque Plan, ninguno
> con cálculo nuevo:
> - **V2-5** — el panel «Dónde seguir con ese mes» de `#mapa-calor` nombra en su primer enlace el
>   bloque de gasto que de verdad pesa más en el peor mes (`mapaCalorTopBlockLink`), reutilizando
>   el mismo desglose que ya calculaba el panel de al lado. No se generan propuestas de movimiento
>   —«mover la matrícula a septiembre»— porque seguiría sin existir un motor que las calcule; eso
>   sigue fuera, documentado en el propio código.
> - **V2-6** — el pie de impacto gana un cuarto indicador, «Fecha libre de deuda (fija)»,
>   reutilizando `homeDebtOutlook()` tal cual. La razón de §12 sigue siendo cierta —editar Plan no
>   toca ningún contrato de deuda—, así que se muestra **sin diferencia** (no pasa por
>   `cuadroMandosBeforeAfter`) en vez de fingir un antes/después que siempre diría «sin cambio».
> - **V2-7** — una banda de doce meses (`cuadroMandosMonthBandHtml`) entre la tabla y el pie de
>   impacto, con el mismo color que ya usa `#mapa-calor` (`mapaCalorTone`/`mapaCalorFloor`). No es
>   la rejilla multi-año completa —no cabría sin abrumar una tabla ya densa—, es una fila con los
>   próximos doce meses.
>
> **Las tres, confirmadas por el usuario en el sitio publicado el 12 de agosto de 2026, pasan a
> ✅.** La primera comprobación las dio por no visibles, pero era una caché de Service Worker
> desactualizada en el navegador del usuario (el deploy en sí ya estaba en verde, verificado en
> GitHub Actions); tras limpiarla, las tres se vieron correctamente. **Cierra la vista 2 · Plan
> por completo**: las ocho tareas de V2 quedan hechas.

### V3 · Deuda

| ID | Tarea | Estado | Prioridad | Origen |
|---|---|---|---|---|
| V3-1 | Comparador de estrategias | ✅ | — | Mockup 1c · E20-2 · sin cifras en el sitio hasta el 10 de agosto, §8 · completado por V3-3 y confirmado en el sitio |
| V3-2 | Ruta de deuda como línea de tiempo | ✅ | — | Mockup 1b · E20-2 · llegó al sitio el 10 de agosto, §8 |
| V3-3 | Estrategia **Consolidar** como cuarta opción real | ✅ | Media | Mockup 4d · hecha el 10 de agosto: se pide la oferta (TIN, plazo, comisión) en vez de inventarla · **vista en el sitio** |
| V3-4 | Oferta en curso dentro de la vista de deuda | ✅ | Baja | Mockup 4d · hecha y confirmada en el sitio el 12 de agosto de 2026 |
| V3-5 | Mover `#debt-roadmap`, `#debt-liquidation-plan` y `#debt-control` a Versiones anteriores | ✅ | Media | Mockup 4d · hecha el 10 de agosto, tras V3-3 · **vista en el sitio** |

### V4 · Datos

| ID | Tarea | Estado | Prioridad | Origen |
|---|---|---|---|---|
| V4-1 | Hub ordenado por lo que tienes delante | ✅ | — | Mockup 1f · E19-3 |
| V4-2 | Importación con bandeja previa | ✅ | — | Mockup 2b · E19-4 |
| V4-3 | Registrar el mes, una fila por partida | ✅ | — | Mockup 2a · E20-4 · aviso «¿es anual?» hecho y confirmado en el sitio el 12 de agosto |
| V4-4 | **Importación en cuatro pasos con decisión por movimiento y por duplicado** | ✅ | **Alta** | Spec 5c + prototipo 5d · hecha el 10 de agosto de 2026, confirmada en el sitio publicado el 11 |
| V4-5 | Detección de partida anual desde el extracto | ✅ | Baja | Mockup 2a · hecha y confirmada en el sitio el 12 de agosto de 2026 |
| V4-6 | Mover `#update-data` y `#movements` a Versiones anteriores | ✅ | — | Mockup 4e · hecha el 10 de agosto, la primera relegación |

### V5 · Cierre

| ID | Tarea | Estado | Prioridad | Origen |
|---|---|---|---|---|
| V5-1 | Las diferencias como tareas, no como tablas | ✅ | — | Mockup 1g · E20-2 |
| V5-2 | Panel «Confianza del dato» por cuenta | ✅ | Media | Mockup 4f · hecha y confirmada en el sitio el 12 de agosto de 2026 |
| V5-3 | Mover `#reconciliation`, `#data-audit` y `#operations-manual` a Versiones anteriores | ✅ | — | Mockup 4f · hecha el 10 de agosto |

> **V5-2, hecha el 12 de agosto de 2026.** Nueva tarjeta «Confianza del dato» en `#conciliar`, junto
> a «Pendiente de resolver», con el estado de las dos cuentas reales del hogar (CaixaBank,
> Mediolanum) — el mockup mencionaba una tercera, una tarjeta de crédito, que este modelo no tiene,
> así que no se inventa. Reutiliza lo que `renderConciliar()` ya calculaba para las tareas
> pendientes (`snapshot.balanceChecks`, las entradas sin clasificar): no dispara una consulta
> nueva.
>
> Tres estados, sin inventar una cuarta categoría que el mockup no pedía:
> - **Cuadra** — sin saltos de continuidad de saldo y sin movimientos sin clasificar de esa cuenta.
> - **Descuadra `<importe>`** — prioriza el error acumulado de continuidad de saldo cuando existe,
>   porque es literalmente un desajuste de saldo; si el saldo cuadra pero quedan movimientos sin
>   clasificar, usa la suma de esos importes en su lugar, para no decir «Cuadra» mientras algo de
>   la cuenta sigue sin decidir.
> - **Sin conciliar** — todavía no se ha importado ningún extracto de esa cuenta.
>
> **La omisión real, documentada y no escondida:** las diferencias banco-vs-real de `#conciliar`
> (`snapshot.reconciliation.lines`) son mensuales, agregadas de las dos cuentas juntas, no por
> cuenta — el modelo de datos actual no permite atribuir esa cifra a una cuenta concreta. Por eso
> el panel no las usa: solo entran la continuidad de saldo y la clasificación, que sí son datos por
> cuenta. Sigue siendo posible que una cuenta diga «Cuadra» con una diferencia banco-vs-real sin
> resolver en el mes — la tarjeta de «Pendiente de resolver», justo al lado, sigue mostrando esa
> tarea aparte.
>
> **Confirmada en el sitio publicado por el usuario el 12 de agosto de 2026, pasa a ✅.**

### T · Transversal

| ID | Tarea | Estado | Prioridad | Origen |
|---|---|---|---|---|
| T-0 | **Grupo «Versiones anteriores»**: preferencia `legacy`, encabezado en el menú e interruptor en «Personalizar» | ✅ | — | Decisión del 10 de agosto · habilita V1-4, V2-8, V3-5, V4-6 y V5-3 |
| T-1 | Adoptar la navegación de seis vistas, con las heredadas relegadas y no retiradas | ✅ | Media | Turnos 4-5 · hecha y confirmada en el sitio el 11 de agosto de 2026, junto con V6-3 |
| T-2 | Cambio de acento azul `#0072E3` → navy `#293E5E` | ✅ | Baja | Handoff, sección de tokens · independiente de T-1 · hecha y confirmada en el sitio el 12 de agosto de 2026 |
| T-3 | E10: activación real de IA, hogar, push, PSD2 e importación programada | ⏳ | Baja | Única entrega funcional sin verificar |
| T-4 | Retirar de verdad una heredada, cuando el uso demuestre que nadie la abre | ⛔ | — | Solo con datos de uso, no antes |
| T-5 | **Avisar en pantalla cuando falte una dependencia crítica**, en vez de quedarse en blanco | ✅ | Media | Auditoría §8 · hecha el 10 de agosto · **vista en el sitio** |
| T-6 | **Motor de recomendación real**: criterio genuino para «decisión recomendada» (1d) y «escenario caducado» (2e), en vez de la nota permanente actual | ⏳ | Media | Decisión del usuario el 12 de agosto de 2026: reclasificar 1d/2e a ✅ sin fabricar nada ahora, pero guardar esta tarea para la próxima versión |

> **T-1, hecha el 11 de agosto de 2026, junto con V6-3.** Las seis vistas del rediseño son ahora
> las seis pestañas de la navegación principal: Hoy, Plan (`#cuadro-mandos`), Deuda
> (`#deuda-ruta`), Datos (`#update-hub`), Cierre (`#conciliar`) y Ajustes (`#ajustes`, nueva). Los
> cuatro verbos anteriores (Hoy, Actualizar, Prever, Decidir) desaparecen de la navegación
> principal: «Prever» (`#forecast`) no se releva —sigue con piel nueva, alcanzable desde el menú
> avanzado— porque solo perdía la pestaña, no la vigencia; «Decidir» (`#new-life-definitive`) sí se
> releva, como la decimoctava y última heredada del inventario de la sección 1 — quedaba fuera de
> «Versiones anteriores» únicamente porque era pestaña principal, no porque su función siguiera sin
> cubrir: el motor de escenarios nuevo (`#escenario-simular`/`#escenario-aplicar`) y
> `#asesor-decision` ya la cubren. Ninguna heredada se retira; el mecanismo de T-0 no cambia. El
> propio criterio de las seis vistas pedía fundir varias pantallas en cada una (ver §10 del sistema
> de diseño) y esta entrega adopta la navegación sin fundir contenido: cada pestaña aterriza en su
> pantalla más completa, con las demás alcanzables desde el menú avanzado, igual que ha funcionado
> toda la app hasta ahora («envolver, no sustituir»). Esa omisión queda escrita y no bloquea la ✅
> según la puerta de aceptación (§7, punto 5). **Confirmada en el sitio publicado por el usuario el
> 11 de agosto de 2026, pasa a ✅.**

> **T-2, hecha el 12 de agosto de 2026.** El acento interactivo (`--e19-accent`) pasa de azul
> (`#0072E3`) a navy (`#293E5E`) — el mismo tono que ya usaba `--e19-heading`, porque el propio
> handoff nombra ese navy como «primario, títulos, pie de impacto» a la vez, no tres colores
> distintos. El hover (`#1B2C48`) es el que el handoff llama literalmente «Navy hover», así que no
> se inventa. Los dos tintes suaves (`--e19-accent-soft`/`--e19-accent-soft-border`) se recalculan
> a partir del navy nuevo, para no dejar un azul huérfano detrás de un acento que ya no es azul.
>
> **Alcance, dicho sin ambigüedad — dos tokens que no cambian y por qué:**
> - `--e19-accent-strong` (`#0B1A30`) no se toca: ya era un navy oscuro propio, no es el token que
>   nombra T-2, y sigue siendo el fondo del pie de impacto y las tarjetas fuertes tal como estaban.
> - `--e19-eyebrow` (`#049FF9`, el cian de las etiquetas en mayúsculas) tampoco se toca: es un color
>   distinto del que sale el acento, y T-2 no lo nombra.
>
> Solo tres archivos cambian: `design-tokens.css` (los dos tokens y sus derivados),
> `design-system.html` (la muestra de color de la guía de estilo, que ya leía el token en vez de un
> hex fijo — solo cambia la etiqueta de texto) y las pantallas heredadas de `styles.css`/`p2.css`
> no se tocan porque nunca compartieron este token: siguen con su paleta de siempre, como manda
> «envolver, no sustituir».
>
> **Confirmada en el sitio publicado por el usuario el 12 de agosto de 2026, pasa a ✅.**

> **T-6, anotada el 12 de agosto de 2026.** 1d y 2e comparten la misma raíz: los dos dependen de
> un «motor de recomendación genérico» que el proyecto decidió explícitamente no fabricar —
> inventar «decisión recomendada» o «escenario caducado» con datos falsos habría sido peor que no
> tenerlos, la misma razón documentada en `docs/E19_SISTEMA_DISENO.md` §5 y §8 desde el principio.
> Las dos pantallas están construidas al completo sobre datos reales (`#asesor-decision` sobre las
> ofertas de E14b, `#escenario-guardados` sobre los escenarios guardados), así que pasan de 🟡 a
> ✅: la nota permanente no es un hueco de construcción, es una decisión de producto ya tomada. El
> usuario pidió, en la misma conversación, guardar el trabajo real —diseñar un criterio genuino
> para ambos estados— como tarea explícita para la próxima versión, no para esta. Sin criterio
> definido, arrancarla ahora habría significado exactamente lo que el proyecto lleva evitando toda
> la sesión: fabricar una cifra que nadie ha calculado.

---

## 5. Qué cambia respecto a la versión anterior de este backlog

La versión del 10 de agosto por la mañana decía que **T-1 bloqueaba catorce tareas** y
proponía esperar. La decisión de «Versiones anteriores» deja esa sección obsoleta, y merece
la pena dejar escrito por qué, porque es la clase de bloqueo que se disuelve replanteando la
pregunta en vez de respondiéndola.

El bloqueo era: *¿retiramos pantallas que hoy funcionan?* Con esa pregunta, cualquier
respuesta tenía coste. Retirar arriesga perder función sin darse cuenta; no retirar deja la
app en 34 pantallas y creciendo.

Relegar en vez de retirar **no es un punto intermedio, es una tercera opción que no tiene
ese coste**: la navegación principal queda en seis vistas —el beneficio entero del
rediseño— y la función heredada sigue ahí —el riesgo entero, eliminado—.

Consecuencias concretas sobre el backlog:

- **Cinco tareas pasan de ⛔ a ⏳**: V1-4, V2-8, V3-5, V4-6 y V5-3.
- **T-1 deja de ser bloqueante** y se convierte en trabajo normal.
- **T-2** (el acento navy) se separa: era una consecuencia de adoptar el rediseño, y ahora
  es una decisión estética independiente que se puede tomar cuando se quiera.
- **Aparece T-0**, el grupo «Versiones anteriores», del que dependen las cinco anteriores.
- **T-4 cambia de significado**: ya no es «reducir el número de pantallas» —eso lo resuelve
  T-0— sino «retirar de verdad una heredada», que ahora sí puede esperar a tener datos de
  uso. Sigue en ⛔ a propósito: es la única pieza que no conviene hacer por intuición.

Sigue en pie lo que ya era cierto: cerrar las cinco pantallas marcadas 🟡 antes de relegar
su heredada es más prudente, porque son justo los sitios donde la nueva todavía no cubre
todo. Pero ya no es un requisito, sino una preferencia de orden.

---

## 6. Orden recomendado

Ya no hay nada que esperar. Por valor entregado frente a esfuerzo y riesgo:

1. ~~**V6-1** · control de reserva operativa~~ — **hecha el 10 de agosto de 2026.**
2. ~~**T-0** · el grupo «Versiones anteriores»~~ — **hecho el 10 de agosto de 2026.** El contenedor
   está puesto; no se ve nada hasta que la primera relegación lo llene.
3. ~~**V1-4, V3-5, V2-8, V4-6, V5-3**~~ · relegar las heredadas, vista por vista — **completo el
   11 de agosto de 2026.** Diecisiete de las dieciocho heredadas relegadas; la única que queda
   fuera es `#new-life-definitive`, que es pestaña principal y no una heredada por mover.
4. ~~**V4-4** · importación en cuatro pasos~~ — **hecha el 10 de agosto de 2026 y confirmada en
   el sitio el 11.** Era la única pieza de prioridad Alta que quedaba.
5. ~~**V1-3** · deuda pendiente y fecha libre de deuda en Hoy~~ — **hecha y confirmada en el sitio
   el 10 de agosto de 2026.** El cálculo ya existía en `#deuda-comparar`; se reutiliza tal cual, no
   se duplica.
6. ~~**V3-3** · estrategia Consolidar~~ — **hecha y confirmada en el sitio el 10 de agosto de
   2026.** Cierra también la 🟡 de 1c y de V3-1.
7. ~~**T-1** · la navegación de seis vistas~~ y ~~**V6-3** · la vista `#ajustes`~~ — **hechas y
   confirmadas en el sitio el 11 de agosto de 2026**, hechas juntas: la vista de Ajustes era el
   hueco que faltaba para poder construir un menú principal con seis pestañas reales.
8. ~~**V6-2** · umbrales de aviso~~ — **hecha y confirmada en el sitio el 11 de agosto de 2026**,
   a continuación de V6-3. La omisión sigue escrita en su propia nota: el umbral de partida no
   cambia el tinte de Registrar el mes, solo informa en Ajustes.
9. ~~**V6-4** · exportación única~~ — **hecha y confirmada en el sitio el 12 de agosto de 2026.**
   Cierra el bloque de Ajustes salvo el tinte de Registrar el mes, la misma omisión de siempre.
10. ~~**V5-2** · confianza del dato por cuenta~~ — **hecha y confirmada en el sitio el 12 de agosto
    de 2026.** Cierra el bloque de Cierre entero: no queda ninguna tarea de V5 sin construir.
11. ~~**T-2** · el acento navy~~ — **hecha y confirmada en el sitio el 12 de agosto de 2026.**
    Cierra todo lo que estaba priorizado hasta ese momento; lo que quedaba eran remates de
    prioridad Baja o Media sin urgencia, no bloqueos.
12. ~~**V1-2** · asesor ejecutivo en Hoy~~ — **hecha y confirmada en el sitio el 12 de agosto de
    2026.** Cierra la vista 1 · Hoy por completo: las cuatro tareas de V1 quedan hechas y ✅.
13. ~~**V2-5, V2-6, V2-7** · remates de Plan~~ — **hechas y confirmadas en el sitio el 12 de
    agosto de 2026.** La primera comprobación las dio por no visibles —era una caché de Service
    Worker desactualizada en el navegador, no el código—; tras limpiarla, las tres se confirmaron
    correctas. Cierra la vista 2 · Plan por completo: las ocho tareas de V2 quedan hechas.
14. ~~**V4-3, V4-5** · aviso «¿es anual?» en Registrar el mes~~ — **hechas y confirmadas en el
    sitio el 12 de agosto de 2026.** Detección de solo lectura, sin tocar la clasificación de
    `#datos-importar`; no proyecta el previsto hacia años futuros, solo pregunta y recuerda dónde
    anotarlo. Cierra la vista 4 · Datos por completo: las seis tareas de V4 quedan hechas.
15. ~~**V3-4** · oferta en curso en la vista de deuda~~ — **hecha y confirmada en el sitio el 12 de
    agosto de 2026.** Cierra la vista 3 · Deuda por completo. Cero cálculo nuevo: reutiliza
    `asesorDecisionOpenOffers()`/`asesorDecisionFundingHtml()` y el mismo gesto de
    `asesorDecisionApply`.

Dos matices de orden que no son caprichosos:

- **V6-1 fue antes que T-0**, aunque T-0 sea más vistoso: la reserva operativa estaba
  degradando tres pantallas que la gente ya usa, y eso pesaba más que ordenar el menú.
- **Cerrar cada 🟡 antes de relegar su heredada**, cuando se pueda. Relegar `#debt-roadmap`
  con 1c todavía a medias es precisamente el caso donde alguien echaría de menos algo.

T-3 (E10) permanece al final: depende de aceptación externa real, no de trabajo local.
T-4 (retirar de verdad) queda fuera del orden: espera datos de uso, no un hueco de agenda.

---

## 7. Puerta de aceptación

Sin cambios respecto a `BACKLOG_STATUS.md` §6. Una tarea no pasa a ✅ hasta que:

1. `npm run verify` en verde con cifras reales (pruebas, accesibilidad, rendimiento, build,
   privacidad, smoke).
2. QA en escritorio y móvil sin desbordamiento ni errores de consola propios.
3. `PROJECT_STATE.md` actualizado con esas cifras, nunca inventadas.
4. Fusionada a `main` y **verificada en el sitio publicado** — hasta entonces es 🟡, no ✅.
5. Cualquier omisión respecto al mockup, escrita y localizable en
   `docs/E19_SISTEMA_DISENO.md`.
6. **La QA de navegador se sirve desde `dist/`, nunca desde la raíz del repositorio.** Añadido el
   10 de agosto de 2026 y es el punto que faltaba: en la raíz se sirve todo, así que un recurso
   que no se copia al sitio publicado funciona igual y la comprobación pasa. La auditoría de §8
   existe porque este punto no estaba escrito.

---

## 8. Auditoría del 10 de agosto de 2026: qué enseñaba de verdad el sitio publicado

Al construir V1-3 apareció que el sitio publicado llevaba desde E20 **sin el motor de escenarios**:
`canonical-scenario-schema.js` y `canonical-scenario-engine.js` estaban en el `index.html` pero no en
la lista de `tools/build-public-site.mjs`, y Pages despliega `dist`. Arreglado ese día, junto con dos
canarios que impiden que se repita.

Como cinco tareas estaban marcadas ✅ —y ✅ significa «visible en el sitio publicado»— se auditó qué
enseñaban en realidad. Método: ejecutar el mismo `dist` dos veces, una tal cual y otra sin esos dos
archivos, que es exactamente lo que estuvo publicado.

| Pantalla | Con el motor (desde hoy) | Sin el motor (lo publicado hasta hoy) |
|---|---|---|
| `#deuda-comparar` | Tres estrategias con fecha, coste y recomendada | Tres tarjetas con **fecha «—», coste 0,00 € y ninguna recomendada** |
| `#deuda-ruta` | Tres pasos fechados, con importe y estado | Tres pasos con importe, pero **mes «—» y «Sin calcular»** |
| `#escenario-simular` | Once tipos, decisión añadida, impacto, gráfica y «Aplicar» activo | Once tipos y la decisión entra, pero **sin impacto, sin gráfica y «Aplicar al plan» nunca se habilita** |
| `#escenario-aplicar` | Se abre con impacto y diff del plan | **Inalcanzable**: su única entrada es ese botón deshabilitado |
| `#escenario-guardados` | Estado vacío correcto | Estado vacío correcto — y era verdad: nada podía aplicarse |

**16/16 comprobaciones con el motor, 8/16 sin él. Cero errores de consola en los dos casos**: ahí está
por qué nadie lo vio. No fallaba, se quedaba en blanco.

Qué se corrige de estados, y qué no:

- **V2-2 aguanta su ✅ sin matices.** El catálogo de once tipos de decisión y sus formularios se
  pintan sin tocar el motor, así que esa entrega sí estuvo publicada y funcionando.
- **V2-1, V3-2 y los mockups 1b, 1e y 2d conservan el ✅ pero con fecha corregida**: el código estaba
  desde E20, la función **solo llegó al usuario el 10 de agosto de 2026**. Verificado sobre el
  artefacto que despliega Pages (`dist`), no solo en local.
- **V3-1 y el mockup 1c pasan a ✅**: V3-3 (10 de agosto) añadió «Consolidar» como cuarta estrategia
  real, y el usuario confirmó verla en el sitio publicado el mismo día.
- **2e sigue en 🟡** por la nota de §5.

La lección no es que faltaran pruebas: `npm run verify` estaba en verde todo el tiempo, y sigue
estándolo. Es que ninguna comprobación miraba el artefacto que se publica. Por eso el punto 6 de la
puerta de aceptación.

### Lo que cambia en modo degradado desde T-5

T-5 (10 de agosto) cierra la otra mitad: si algún día vuelve a faltar una pieza —caché vieja,
despliegue a medias, bloqueo de red—, **las cinco pantallas lo dicen** con un aviso rojo anunciable
en vez de quedarse mudas. Además dejan de fingir resultados: el comparador escribe «—» en coste y
caja mínima en lugar de `0,00 €`, y simular **rechaza** la decisión si falta el esquema en vez de
aceptarla sin validar, que era lo que hacía (`if (schema) schema.validateDecision(...)` no validaba
nada cuando no había esquema).

Eso mueve la referencia de `npm run audit:escenarios` en modo degradado **de 8/16 a 6/16, a
propósito**: la herramienta mide «¿devuelve cifras?», así que las dos mejoras cuentan ahí como
comprobaciones rotas. Queda escrito en la cabecera de la propia herramienta para que nadie lo lea
como una regresión.

V3-3 (10 de agosto) añadió una comprobación decimoséptima —«Consolidar» sin oferta no inventa
cifras—, que pasa en los dos modos porque no depende del motor sino de la oferta. **Las referencias
vigentes son 17/17 con el motor y 7/17 sin él.**
