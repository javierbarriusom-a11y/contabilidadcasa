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

- **34 pantallas** (`view-section`) en la aplicación.
- **16 con la piel nueva** (clase de ámbito `e19-*`): las migradas en E19 y E20.
- **18 heredadas**, sin migrar, que siguen en pie y en uso.

| Con piel nueva (16) | Heredadas todavía en pie (18) |
|---|---|
| `#home`, `#update-hub`, `#data-entry`, `#forecast`, `#prevision` | `#visual-detail`, `#update-data`, `#movements`, `#cashflow`, `#savings-plan` |
| `#escenario-simular`, `#escenario-aplicar`, `#escenario-guardados` | `#simulator`, `#new-life-simulation`, `#new-life-definitive` |
| `#deuda-comparar`, `#deuda-ruta`, `#asesor-decision` | `#debt-roadmap`, `#debt-liquidation-plan`, `#debt-control` |
| `#conciliar`, `#registrar-mes` | `#reconciliation`, `#data-audit`, `#operations-manual` |
| `#cuadro-mandos`, `#cambios-pendientes`, `#mapa-calor` | `#executive-advisor`, `#virtual-advisor`, `#savings-agent`, `#alerts-center` |

**El número que importa: 34, no 22.** El rediseño se dibujó cuando había 22 pantallas y
proponía reducirlas a 6. Desde entonces la app ha crecido a 34, porque cada mockup migrado
se añadió **junto a** la heredada en vez de sustituirla. Es decir: el trabajo hecho ha
mejorado la app y a la vez ha alejado el objetivo de seis vistas. No es un error —era la
regla acordada, «envolver, no sustituir»— pero conviene verlo escrito.

### Los quince mockups de los turnos 1-3

**15 de 15 migrados.** Cinco de ellos con omisiones documentadas:

| Mockup | Pantalla | Estado | Qué falta |
|---|---|---|---|
| 1a Hoy | `#home` | ✅ | — |
| 1b Ruta de deuda | `#deuda-ruta` | ✅ | — |
| 1c Comparador de estrategias | `#deuda-comparar` | 🟡 | La tercera estrategia es «No tocar nada», no «Consolidar» |
| 1d Asesor ejecutivo | `#asesor-decision` | 🟡 | Ver nota en `docs/E19_SISTEMA_DISENO.md` §8 |
| 1e Simular | `#escenario-simular` | ✅ | — |
| 1f Actualizar (hub) | `#update-hub` | ✅ | — |
| 1g Conciliación | `#conciliar` | ✅ | — |
| 2a Registrar el mes | `#registrar-mes` | 🟡 | Aviso «detectado en el extracto · ¿es anual?» |
| 2b Importar extracto | `#data-entry` | ✅ | — |
| 2c Previsión | `#prevision` | ✅ | — |
| 2d Aplicar escenario | `#escenario-aplicar` | ✅ | — |
| 2e Escenarios guardados | `#escenario-guardados` | 🟡 | Ver nota en §5 |
| 3a Cuadro de mandos | `#cuadro-mandos` | ✅ | — |
| 3b Bandeja de cambios | `#cambios-pendientes` | ✅ | — |
| 3c Mapa de calor | `#mapa-calor` | 🟡 | Panel de recomendaciones calculadas |

### Los turnos 4-5 (el rediseño a seis vistas)

**0 de 6 vistas adoptadas como arquitectura.** De las diez piezas del material:

- **5a · pie de impacto**: ✅ implementado en `#cuadro-mandos` (E20-5).
- **4a-4f · las seis vistas**: ⏳ sin adoptar. Ya no bloqueadas: ver la sección 3.
- **5c/5d · importación por decisión**: ⏳ especificado y sin implementar.

---

## 2. Las seis vistas: cuánto está cubierto

Esta es la respuesta directa a «cuántas de las seis están en el repositorio vivo». La
respuesta corta: **cinco de las seis tienen su función construida y publicada; ninguna
existe como vista única, y la sexta no existe en absoluto.**

| Vista | Función cubierta | Pantallas nuevas que la cubren | Heredadas que pasan a «Versiones anteriores» |
|---|---|---|---|
| **1 · Hoy** | 🟡 parcial | `#home`, `#asesor-decision` | `#executive-advisor`, `#virtual-advisor`, `#savings-agent`, `#alerts-center` |
| **2 · Plan** | ✅ alta | `#cuadro-mandos`, `#cambios-pendientes`, `#mapa-calor`, `#prevision`, `#escenario-*` (3) | `#visual-detail`, `#cashflow`, `#savings-plan`, `#simulator`, `#new-life-simulation` — **ya relegadas** (V2-8) |
| **3 · Deuda** | ✅ alta | `#deuda-comparar`, `#deuda-ruta` | `#debt-roadmap`, `#debt-liquidation-plan`, `#debt-control` |
| **4 · Datos** | 🟡 parcial | `#update-hub`, `#data-entry`, `#registrar-mes` | `#update-data`, `#movements` — **ya relegadas** (V4-6) |
| **5 · Cierre** | 🟡 parcial | `#conciliar` | `#reconciliation`, `#data-audit`, `#operations-manual` — **ya relegadas** (V5-3) |
| **6 · Ajustes** | 🟡 parcial | la reserva operativa, alojada en `#cuadro-mandos` (V6-1) | — |

### Lo que falta en cada una, medido

**1 · Hoy.** Los tres KPI del rediseño son *Colchón disponible*, *Deuda pendiente* y
*Libre de deuda*. **Los tres están desde el 10 de agosto** (V1-3): a *Liquidez hoy* se le
suman *Deuda pendiente* y *Libre de deuda*, calculadas por el mismo camino que las de
`#deuda-comparar` para que las dos vistas no puedan contar historias distintas. Hoy enseña
seis KPI en dos filas: los tres del rediseño arriba y *Capacidad libre real*, *Reserva
protegida* y *Próximo riesgo* debajo. Lo que sigue faltando en la vista es V1-4, relegar sus
cuatro heredadas, que conviene hacer después de cerrar la 🟡 de V1-2.

**2 · Plan.** Es la más completa: la tabla editable con pie de impacto está construida y
publicada, que era el corazón del rediseño. Falta la banda de doce meses *dentro* de Plan
(existe suelta en `#mapa-calor` y `#prevision`) y el cuarto indicador del pie, la fecha sin
deuda, que hoy se omite a propósito porque editar un previsto no toca ningún contrato. Sus
cinco heredadas quedaron relegadas el 10 de agosto (V2-8).

> **Corrección del 10 de agosto: `#forecast` no era una heredada.** Esta tabla lo listaba
> entre las que Plan debía relegar, contradiciendo al inventario de la sección 1, que lo
> cuenta —bien— entre las dieciséis pantallas con piel nueva: la sección lleva la clase
> `e19-forecast` y el menú principal la usa como la pestaña «Prever». Relegarla habría
> degradado una pantalla migrada y dejado una pestaña de primer nivel apuntando a
> «Versiones anteriores». Se queda donde está; reordenar el menú principal es trabajo de
> T-1. Por eso V2-8 mueve cinco pantallas y no seis.

**3 · Deuda.** Estrategias y orden de ataque, construidos. La tercera estrategia difiere:
el rediseño pide *Consolidar*, la app ofrece *No tocar nada*. La «oferta en curso» vive en
`#asesor-decision` en vez de en la propia vista.

**4 · Datos.** Hub, importación y registro del mes, construidos. **Lo que falta es lo que
el turno 5 especifica y nadie ha implementado**: la importación como cuatro pasos con una
decisión explícita por movimiento dudoso y por duplicado. Hoy `#data-entry` tiene la
bandeja previa, no ese flujo.

**5 · Cierre.** Las diferencias como tareas, construido, y sus tres heredadas ya relegadas
(V5-3). Falta el panel «Confianza del dato» por cuenta (cuadra / descuadra / sin conciliar),
que hoy sigue disperso entre `#conciliar` y `#data-audit` — que es exactamente por lo que
`#data-audit` se relega y no se retira.

**6 · Ajustes.** La vista sigue sin existir, pero su pieza más urgente ya está hecha: **la
reserva operativa tiene control desde el 10 de agosto** (V6-1). El diagnóstico que lo
justificaba era que `state.operatingReserve` no aparecía ni una vez en `index.html` pese a
que el modelo la lee desde tres sitios, así que valía siempre 0 y las tres pantallas caían
a su respaldo:

- El pie de impacto de `#cuadro-mandos` no podía decir «meses bajo reserva» y caía a «meses
  en negativo».
- El mapa de calor coloreaba contra «un mes de salidas» en vez de contra la reserva real.
- El comparador de deuda usaba un suelo de 0 € por defecto en vez de la reserva del hogar.

Con la casilla puesta, las tres hablan de la misma cifra y cada una declara cuál está
usando. Lo que falta de esta vista son los umbrales de aviso (V6-2), la vista propia que
reúna cuentas, umbrales y partidas (V6-3) y la exportación única (V6-4). Sigue siendo el
bloque con mejor relación esfuerzo/valor, ya sin la pieza que degradaba pantallas
publicadas.

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
| V6-2 | Umbrales de aviso: colchón mínimo en meses, desviación por partida, ventana de duplicados | ⏳ | Media | Mockup 4f · Ajustes |
| V6-3 | Vista `#ajustes` que reúna cuentas, umbrales, partidas y exportación | ⏳ | Media | Mockup 4f |
| V6-4 | Exportar CSV y PDF del mes desde un sitio único (hoy `downloadCsv` está disperso) | ⏳ | Baja | Mockup 4f |

**V6-1 es la primera tarea recomendada de todo el backlog.** Es pequeña, no rompe nada, y
mejora inmediatamente tres pantallas ya publicadas sin tocarlas.

> **V6-1, hecha el 10 de agosto de 2026.** La casilla «Reserva operativa» vive en la fila de
> controles de `#cuadro-mandos`, junto a «Desde» y «Horizonte», hasta que exista la vista
> `#ajustes` (V6-3), que es donde acabará mudándose. Escribe `state.operatingReserve` y se guarda
> en `scenarioSettings`, así que se sincroniza y se restaura como un dato del hogar. Vaciarla
> significa «sin reserva configurada», no cero: cada pantalla vuelve a su respaldo declarado.
> Cierra en ✅: PR #5 fusionada con CI en verde, Pages desplegado con éxito para `956e427` y el
> usuario confirmó la casilla en el sitio publicado el mismo 10 de agosto.

### V1 · Hoy

| ID | Tarea | Estado | Prioridad | Origen |
|---|---|---|---|---|
| V1-1 | Hoy con la piel nueva y tres decisiones | ✅ | — | Mockup 1a · E19-2 |
| V1-2 | Asesor ejecutivo, una decisión abierta a la vez | 🟡 | — | Mockup 1d · E20-2 |
| V1-3 | Sumar los KPI *Deuda pendiente* y *Libre de deuda* a Hoy | 🟡 | Media | Mockup 4b · hecha el 10 de agosto, reutilizando el cálculo de `#deuda-comparar` |
| V1-4 | Mover `#executive-advisor`, `#virtual-advisor`, `#savings-agent` y `#alerts-center` a Versiones anteriores | ⏳ | Media | Mockup 4b · habilitado por T-0 |

### V2 · Plan

| ID | Tarea | Estado | Prioridad | Origen |
|---|---|---|---|---|
| V2-1 | Simular → comparar → aplicar en una vista | ✅ | — | Mockups 1e/2d/2e · E20-1 |
| V2-2 | Los once tipos de decisión del motor | ✅ | — | E20-3 |
| V2-3 | Cuadro de mandos con pie de impacto | ✅ | — | Mockup 3a + spec 5a · E20-5 |
| V2-4 | Bandeja de cambios reversible | ✅ | — | Mockup 3b · E20-5 |
| V2-5 | Mapa de calor mensual | 🟡 | — | Mockup 3c · E20-5 |
| V2-6 | Cuarto indicador del pie: fecha sin deuda | ⏳ | Baja | Mockup 4c; hoy se omite con motivo, ver §12 del diseño |
| V2-7 | Banda de doce meses integrada en Plan | ⏳ | Baja | Mockup 4c |
| V2-8 | Mover `#visual-detail`, `#cashflow`, `#savings-plan`, `#simulator` y `#new-life-simulation` a Versiones anteriores | ✅ | — | Mockup 4c · hecha el 10 de agosto, ver la nota sobre `#forecast` |

### V3 · Deuda

| ID | Tarea | Estado | Prioridad | Origen |
|---|---|---|---|---|
| V3-1 | Comparador de estrategias | 🟡 | — | Mockup 1c · E20-2 |
| V3-2 | Ruta de deuda como línea de tiempo | ✅ | — | Mockup 1b · E20-2 |
| V3-3 | Estrategia **Consolidar** como tercera opción real | ⏳ | Media | Mockup 4d; hoy la tercera es «No tocar nada» |
| V3-4 | Oferta en curso dentro de la vista de deuda | ⏳ | Baja | Mockup 4d; hoy vive en `#asesor-decision` |
| V3-5 | Mover `#debt-roadmap`, `#debt-liquidation-plan` y `#debt-control` a Versiones anteriores | ⏳ | Media | Mockup 4d · habilitado por T-0 |

### V4 · Datos

| ID | Tarea | Estado | Prioridad | Origen |
|---|---|---|---|---|
| V4-1 | Hub ordenado por lo que tienes delante | ✅ | — | Mockup 1f · E19-3 |
| V4-2 | Importación con bandeja previa | ✅ | — | Mockup 2b · E19-4 |
| V4-3 | Registrar el mes, una fila por partida | 🟡 | — | Mockup 2a · E20-4 |
| V4-4 | **Importación en cuatro pasos con decisión por movimiento y por duplicado** | ⏳ | **Alta** | Spec 5c + prototipo 5d · especificado y sin implementar |
| V4-5 | Detección de partida anual desde el extracto | ⏳ | Baja | Mockup 2a, omisión documentada |
| V4-6 | Mover `#update-data` y `#movements` a Versiones anteriores | ✅ | — | Mockup 4e · hecha el 10 de agosto, la primera relegación |

### V5 · Cierre

| ID | Tarea | Estado | Prioridad | Origen |
|---|---|---|---|---|
| V5-1 | Las diferencias como tareas, no como tablas | ✅ | — | Mockup 1g · E20-2 |
| V5-2 | Panel «Confianza del dato» por cuenta | ⏳ | Media | Mockup 4f |
| V5-3 | Mover `#reconciliation`, `#data-audit` y `#operations-manual` a Versiones anteriores | ✅ | — | Mockup 4f · hecha el 10 de agosto |

### T · Transversal

| ID | Tarea | Estado | Prioridad | Origen |
|---|---|---|---|---|
| T-0 | **Grupo «Versiones anteriores»**: preferencia `legacy`, encabezado en el menú e interruptor en «Personalizar» | ✅ | — | Decisión del 10 de agosto · habilita V1-4, V2-8, V3-5, V4-6 y V5-3 |
| T-1 | Adoptar la navegación de seis vistas, con las heredadas relegadas y no retiradas | ⏳ | Media | Turnos 4-5 · desbloqueada por la decisión del 10 de agosto |
| T-2 | Cambio de acento azul `#0072E3` → navy `#293E5E` | ⏳ | Baja | Handoff, sección de tokens · independiente de T-1 |
| T-3 | E10: activación real de IA, hogar, push, PSD2 e importación programada | ⏳ | Baja | Única entrega funcional sin verificar |
| T-4 | Retirar de verdad una heredada, cuando el uso demuestre que nadie la abre | ⛔ | — | Solo con datos de uso, no antes |

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
3. **V1-4, V3-5, ~~V2-8~~, ~~V4-6~~, ~~V5-3~~** · relegar las heredadas, vista por vista. Se pueden
   hacer de una en una y cada una es reversible con un interruptor. **V4-6, V5-3 y V2-8 ya
   están, el 10 de agosto**: diez pantallas relegadas de las dieciocho heredadas. Quedan las
   dos que conviene hacer después de cerrar su 🟡 correspondiente: **V3-5** tras V3-3, y
   **V1-4** tras V1-2.
4. **V4-4** · importación en cuatro pasos. La única pieza del turno 5 con especificación
   escrita y prototipo que sigue sin construir.
5. ~~**V1-3** · deuda pendiente y fecha libre de deuda en Hoy~~ — **hecha el 10 de agosto de
   2026.** El cálculo ya existía en `#deuda-comparar`; se reutiliza tal cual, no se duplica.
6. **V3-3** · estrategia Consolidar, para cerrar la 🟡 de 1c.
7. **V5-2** · confianza del dato por cuenta. **V6-2/V6-3** · el resto de Ajustes.
8. **T-1** · la navegación de seis vistas, ya sin riesgo, y **T-2** si se quiere el navy.

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
