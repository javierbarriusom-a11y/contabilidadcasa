# Backlog operativo — decisiones rápidas y uso diario

> Mapa de todos los backlogs del repositorio: [`BACKLOG_INDICE.md`](BACKLOG_INDICE.md) (OPT-20).

Fecha: 21 de agosto de 2026. Repositorio vivo: `javierbarriusom-a11y/contabilidadcasa`.

Este documento nace de un diagnóstico de consultoría hecho el 21 de agosto de 2026 sobre cuatro
frentes — navegación diaria, simulación de escenarios, previsto frente a real e ingesta de datos —
a petición explícita del usuario, que sentía tener «muchísima información pero no tener claro el
flujo óptimo» para decisiones de corto plazo (refinanciar deuda a nombre de su mujer, cuándo
comprar un coche, cómo mantener al día previsto y real). El diagnóstico completo, con citas de
archivo y línea para cada afirmación, quedó entregado como artefacto visual y documento Word en esa
conversación; este fichero recoge únicamente **las tareas que de ahí se derivan**, para que
cualquier sesión o persona del equipo las siga sin tener que reconstruir el contexto.

**No es un sustituto de `BACKLOG.md`.** Aquel ordena el trabajo de reconstrucción visual pantalla
por pantalla (pixel-perfect contra los mockups, códigos `V-`/`T-`/`D-`/`P-`/`A-`/`C-`/`L-`). Este
ordena un eje distinto: **qué le falta al motor y a la interfaz para resolver preguntas de decisión
concretas y para que el uso diario no dependa de la memoria del usuario**. Usa el prefijo `O-`
(Operación), sin solapar con ningún prefijo existente.

Dos de las ocho mejoras que salieron del diagnóstico inicial **ya estaban hechas** cuando se revisó
el estado real del repositorio contra `BACKLOG.md` (que en el momento del diagnóstico no se había
consultado, solo su predecesor archivado `BACKLOG_STATUS.md`):

- La fusión a seis vistas — **T-1, hecha el 11 de agosto de 2026** (`BACKLOG.md` §5).
- El control de reserva operativa en la interfaz — **V6-1/V6-3, hechas el 11 de agosto de 2026**
  (`BACKLOG.md` §3).

Quedan seis tareas reales, verificadas contra el código el 21 de agosto de 2026. El orden es el que
más devuelve por esfuerzo, no un orden técnico de dependencias — con una excepción explícita en O-5.

## Leyenda de estado

Misma leyenda que `BACKLOG.md` §0, para no introducir un tercer vocabulario:

| | Significado |
|---|---|
| ✅ | Hecho, fusionado a `main` y verificado en el sitio publicado |
| 🟡 | Publicado pero parcial, con la omisión documentada y localizable |
| ⏳ | Pendiente, sin bloqueo: se puede empezar cuando se quiera |
| ⛔ | Bloqueado por algo externo al equipo (aceptación de proveedor, decisión de producto ajena) |

## 0. Tabla maestra

| Tarea | Resuelve | Impacto | Esfuerzo | Estado |
| --- | --- | --- | --- | --- |
| O-1 | Titularidad en refinanciación/reunificación de deuda | Alto | Medio | ✅ · 21 de agosto de 2026 |
| O-2 | Recordatorio activo de reales pendientes | Medio | Bajo | ✅ · 21 de agosto de 2026 |
| O-3 | Aviso de completitud antes de cerrar el mes | Medio | Bajo | ✅ · 21 de agosto de 2026 |
| O-4 | Generalizar «¿cuánto puedo permitirme?» más allá del coche | Medio | Medio | ✅ · 21 de agosto de 2026 |
| O-5 | Actualizar `MANUAL_USUARIO.md` a partir de E17 | Medio | Bajo | ✅ · 5 de septiembre de 2026 |
| O-6 | Conexión bancaria PSD2 real | Medio | Alto | ⛔ · ya rastreada como T-3 en `BACKLOG.md`, depende de contratar proveedor |

---

## O-1 · Titularidad en refinanciación/reunificación de deuda

**Por qué.** Responde directamente a la pregunta que motivó el diagnóstico: «¿puedo simular pedir
un crédito a nombre de mi mujer para cancelar mis deudas?». Hoy no se puede. Existe una función muy
parecida pero cableada a un único caso — «Financiación de Tere» (`app.js:12476-12478,
13225-13230`) — que calcula el mes en que la caja alcanza el coste de **un coche** con o sin crédito
a nombre de la mujer, no una refinanciación de deuda existente. El campo `titular` del esquema de
escenarios (`TITULARES`, usado en `canonical-scenario-schema.js:401-404`) solo existe hoy para
`cambio_ingreso`; ninguna decisión de deuda lo admite (`canonical-scenario-schema.js:308-319` para
`refinanciacion`, `321-334` para `reunificacion`, sin campo de titular en ninguna de las dos). El
comparador de deuda (`canonical-debt-comparator.js:10-16, 77-86`) ya sabe puntuar coste total,
deuda restante y fecha de cierre entre estrategias — la puntuación no hay que inventarla, solo
alimentarla con dos titulares distintos.

**Tareas, en orden:**

1. Extender `canonical-scenario-schema.js`: añadir `titularOrigen`/`titularDestino` (reutilizando
   el enum `TITULARES` ya definido) como campos opcionales en los tipos `refinanciacion` y
   `reunificacion`, con la misma validación que ya usa `cambio_ingreso` (patrón
   `requireFields`/`invalid-enum`, líneas 401-404). Si no se informan, el comportamiento actual no
   cambia — es una extensión aditiva, no una migración.
2. Revisar `canonical-debt-contracts.js:140` (`owner`): decidir si `titularDestino` debe escribir
   ese campo al aplicar el escenario o si queda como metadato del propio escenario hasta que el
   usuario lo confirme explícitamente. Documentar la decisión en el propio código — es el tipo de
   regla no obvia que ya se anota en otros sitios del proyecto (ver `canonical-debt-contracts.js`
   sobre `owner` como metadato descriptivo).
3. Propagar `titularDestino` a través de la sustitución de principal/TIN/cuota/plazo en
   `canonical-scenario-engine.js:208-267`, de modo que el contrato resultante de la simulación lleve
   el titular nuevo sin perder ninguno de los campos que ya sustituye hoy.
4. Extender `canonical-debt-comparator.js` para que, cuando `titularOrigen !== titularDestino`, la
   comparación etiquete explícitamente cada lado («tu deuda actual» vs. «crédito nuevo a nombre de
   `titularDestino`, coste total incluido») reutilizando el mismo cálculo de coste total, deuda
   restante y fecha de cierre que ya usa para comparar estrategias entre sí.
5. UI: añadir el selector de titular al formulario de refinanciación/reunificación en
   `#escenario-simular`, reutilizando el mismo control que ya existe para `cambio_ingreso`. No se
   necesita ninguna pantalla nueva.
6. Pruebas nuevas (`tests/o1-titularidad-deuda.test.cjs` o similar): validación del esquema con y
   sin titular, propagación del titular a través del motor, y que el comparador distinga
   correctamente coste con titular actual vs. titular nuevo.
7. Cerrar con la puerta de aceptación estándar (`BACKLOG.md` §7): `npm run verify` en verde, QA en
   escritorio y móvil, `PROJECT_STATE.md` actualizado con cifras reales, fusionado a `main` y
   verificado en el sitio publicado antes de marcar ✅.

**Qué no incluye a propósito.** No cambia la titularidad real de ningún contrato fuera de una
simulación explícitamente aplicada por el usuario — sigue el mismo flujo de «Aplicar al plan» que
ya usa cualquier otro escenario, sin atajos. Tampoco toca `canonical-debt-comparator.js` (el
comparador de ofertas reales de `#deuda-comparar`/`#asesor-decision`, un subsistema distinto del
laboratorio de escenarios): etiquetar titulares ahí, sobre negociaciones reales con un acreedor, es
un paso natural posterior, no incluido en este primer corte.

**Hecho — 21 de agosto de 2026.** `canonical-scenario-schema.js` y `canonical-scenario-engine.js`
llevan `titularOrigen`/`titularDestino` opcionales en refinanciación y reunificación; el laboratorio
de escenarios (`#escenario-simular`) ofrece el selector y lo refleja en título/detalle cuando origen
y destino difieren. `npm run verify` completo en verde con 1474/1474 pruebas (15 nuevas en
`tests/o1-titularidad-deuda.test.cjs`). Detalle completo en la entrada de cierre correspondiente de
`PROJECT_STATE.md`.

---

## O-2 · Recordatorio activo de reales pendientes

**Por qué.** El sistema de notificaciones ya distingue categorías `cash`, `planning`, `quality` y
`general` con frecuencias `daily/weekly/monthly` (`canonical-e9-notifications.js:9-15`), pero está
apagado por defecto (`enabled: input.enabled === true`, línea 24) y no existe ninguna categoría
dedicada a «te faltan reales por registrar». El resultado es que actualizar previsto/real depende
enteramente de que el usuario se acuerde — la «Rutina recomendada» del manual (§12) es un texto de
ayuda, no algo que la app recuerde por sí sola.

**Tareas, en orden:**

1. Añadir una categoría `reales-pendientes` (frecuencia `weekly`) al catálogo de
   `canonical-e9-notifications.js`, siguiendo el mismo patrón que las categorías existentes.
2. Calcular el cuerpo del aviso reutilizando la lista de completitud que ya construye «Registrar el
   mes» (`app.js:18859-19183`) — sin duplicar esa lógica, solo formatearla como texto de aviso («N
   partidas sin real esta semana»).
3. Activar `enabled: true` por defecto **solo para esta categoría nueva**, no para las demás — para
   no cambiar en silencio un comportamiento que el usuario no pidió revisar.
4. Añadir también un banner discreto en `#home` para quien no tenga permiso de notificaciones push
   concedido (la vía push por sí sola dejaría fuera a quien nunca activó las notificaciones del
   navegador).
5. Pruebas: categoría nueva presente en el catálogo, cálculo del recuento de pendientes, y que el
   banner en `#home` solo aparece cuando hay algo pendiente.
6. Puerta de aceptación estándar antes de marcar ✅.

**Hecho — 21 de agosto de 2026, con un ajuste sobre el plan.** El esquema de
`canonical-e9-notifications.js` no tiene `enabled` por categoría (es un único interruptor global del
canal push) — activarlo por defecto habría saltado el consentimiento explícito que E9 exige a
propósito. Se optó por el recordatorio local en Hoy (`homePendingActualsReminder`, candidata nueva de
`homeDecisionCandidates`), que no depende de push ni de ningún permiso y por eso llega a quien nunca
activó notificaciones — la mayoría, según el diagnóstico. La categoría `reales-pendientes` sí se
añadió al catálogo de push para quien lo tenga activado, reutilizando el target `update-data` ya
existente. Detalle completo en `PROJECT_STATE.md`.

---

## O-3 · Aviso de completitud antes de cerrar el mes

**Por qué.** `closeMonth()` (`canonical-month-close.js:23-53`) congela los reales del mes de forma
segura y auditable, pero solo comprueba que el mes no esté ya cerrado (líneas 28-30) — no que los
datos estén completos. La disciplina de «cierra solo cuando esté todo» depende hoy de que el
usuario la recuerde (así lo pide el propio manual, §12), sin ningún apoyo de la interfaz.

**Tareas, en orden:**

1. Antes de invocar el cierre desde `closeCurrentMonthTransaction` (`app.js:3690-3699`), calcular
   cuántas partidas siguen sin real para ese mes, reutilizando la misma lista de completitud que ya
   usa «Registrar el mes» — la misma fuente que consume O-2, para no mantener dos cálculos
   distintos de lo mismo.
2. Si el recuento es 0, cerrar sin fricción adicional, exactamente como hoy.
3. Si el recuento es mayor que 0, mostrar una confirmación explícita («Quedan N partidas sin real:
   [lista]. ¿Cerrar igualmente?») antes de proceder — **avisa, no bloquea**: hay casos legítimos de
   cerrar con huecos conocidos (una partida que no aplica ese mes, un dato que llegará tarde), y la
   política del proyecto ya es no bloquear duro sin necesidad (mismo criterio que
   `canonical-commit-barrier.js`, que avisa en vez de impedir).
4. Pruebas: cierre con cero pendientes (sin diálogo), cierre con N pendientes (diálogo, confirmar
   procede, cancelar aborta y no cierra el mes).
5. Puerta de aceptación estándar antes de marcar ✅.

**Hecho — 21 de agosto de 2026, con una precisión sobre el plan.** El diálogo de confirmación
(`requestOperationConfirmation`, motivo obligatorio) ya existía para cualquier cierre de mes — no se
añadió un diálogo nuevo; el que hay se enriquece con `monthCloseConfirmMessage(month,
pendingActualsForMonthKey(month))`, que menciona el recuento y las partidas concretas cuando hay
alguna sin real. Sigue sin bloquear: el cierre se puede confirmar igual con huecos conocidos, ahora
de forma informada. Detalle completo en `PROJECT_STATE.md`.

---

## O-4 · Generalizar «¿cuánto puedo permitirme?» más allá del coche

**Por qué.** El Asesor ejecutivo ya resuelve bien «¿cuándo puedo comprar el coche?» — calcula el mes
en que la caja alcanza el coste objetivo con y sin financiación de la mujer
(`app.js:12476-13260`, en particular `carWithCreditCashNeed` en la línea 12559 y el bloque de
proyección en 13750-13753). Pero toda la lógica está cableada a nombres fijos (`carCost`,
`tereCreditCapital`, `tereCreditPayment`): no existe una versión genérica para cualquier compra
grande (reforma, entrada de vivienda, etc.).

**Tareas, en orden:**

1. Investigar primero si `canonical-e15-goals.js` (objetivos y calendario financiero) ya cubre
   parte de esto antes de construir nada nuevo — el proyecto tiene precedente de reutilizar motores
   existentes en vez de duplicar (ver cómo D-15 reutilizó `E14DebtAdapter.buildReadModel` en lugar
   de reconstruir un cálculo). Si `canonical-e15-goals.js` ya modela «objetivo con fecha e importe»,
   extenderlo es preferible a crear un motor paralelo.
2. Extraer la lógica de cálculo de fecha-de-caja-suficiente del Asesor ejecutivo a una función
   parametrizada por `{ costeObjetivo, capitalFinanciacion, cuotaFinanciacion, etiqueta }`, sin
   cambiar su resultado para el caso coche (regresión cero).
3. Añadir un formulario mínimo para crear/nombrar objetivos de compra grande adicionales,
   reutilizando esa función genérica.
4. Mantener «Coche» como el primer preset sobre la función genérica, para no perder la pantalla que
   hoy funciona bien.
5. Pruebas: la función genérica reproduce exactamente los resultados actuales del caso coche, más
   un caso nuevo (p. ej. una reforma) con fecha e importe distintos.
6. Puerta de aceptación estándar antes de marcar ✅.

**Hecho — 21 de agosto de 2026.** `canonical-e15-goals.js` (paso 1) resultó ser un motor distinto:
reparte una capacidad de ahorro mensual entre objetivos con fecha y prioridad (`contributionPlan`),
no calcula «en qué mes la caja llega a cubrir un coste con o sin financiación». No se tocó — se
mantiene para lo suyo.

Se extrajo `bigPurchaseAffordability(plan, { costeObjetivo, colchonObjetivo, capitalFinanciacion,
cuotaFinanciacion, avgIncome, avgDebt })` (`app.js`, junto a `firstMonthReachingMediolanum`), que
reutiliza esa misma función de fecha-de-caja y el mismo criterio de ratio de deuda prudente (≤32%)
que ya usaba el coche. `executiveAdvisorContext` ahora calcula el caso coche llamando a esta función
en vez de repetir la fórmula — regresión cero, verificado con los mismos números que antes.

Encima de ese motor se añadió un formulario mínimo en el Asesor ejecutivo («Otras compras grandes»):
nombre, coste, colchón, capital financiado y cuota. Cada objetivo guardado
(`scenarioSettings.bigPurchaseGoals`) se muestra como una tarjeta con su propia fecha al contado y,
si hay financiación, su propia fecha con crédito y ratio de deuda — mismo cálculo, sin tocar los
datos del coche. «Coche» sigue siendo el primer preset, ahora construido sobre la función genérica
en vez de ser un caso especial cableado.

13 pruebas nuevas (`tests/o4-compra-grande-generica.test.cjs`): fórmulas del motor genérico, caso
coche reproducido exactamente número a número, un caso nuevo (reforma) con fecha e importe propios,
alta/baja de objetivos, y el cableado de `executiveAdvisorContext`/`renderExecutiveAdvisor`.
`npm run verify`: 1505/1505 pruebas, accesibilidad, rendimiento, build, privacidad y humo en verde.

---

## O-5 · Actualizar `MANUAL_USUARIO.md` a partir de E17 — ✅ Hecho el 5 de septiembre de 2026

**Por qué se dejó para el final, a propósito.** El manual estaba fechado el 2 de agosto de 2026 y
declaraba explícitamente cubrir «hasta E14a» — anterior a E17, E18, E19, E20 y a los 51 tareas de
la Oleada 2, que son justo las entregas que más pantallas añadieron. Se dejó en último lugar porque
O-1 a O-4 iban a cambiar comportamiento que el manual tendría que documentar de todas formas — y,
en efecto, para cuando se abordó, ya no quedaba ningún otro trabajo de producto construible en la
sesión (Oleada 2 en 50/51, remanente bloqueado por condiciones externas).

**Hallazgo real al auditarlo, que cambió el alcance previsto:** el manual anterior no solo tenía
huecos, **desinformaba activamente** — su sección «Funciones todavía no disponibles» seguía
marcando como pendientes tres entregas ya construidas y verificadas (E15 objetivos/calendario, E16
alertas predictivas, y la aplicación de ofertas de deuda al plan real de E14b vía
`applyE14bOffer()`). Y la propia aplicación ya tenía, desde E17-E19, un manual interactivo en vivo
(`#faqs-ayuda`, cuatro casos de uso enlazados a las pantallas reales) que cubre el paso a paso mejor
de lo que un documento externo puede mantener actualizado.

**Decisión de alcance, no en el plan original de 5 pasos:** en vez de narrar cada pantalla paso a
paso por fuera de la aplicación (lo que habría vuelto a quedar obsoleto en el próximo cambio de
navegación, el mismo problema que hizo falta este O-5), el manual se reescribió como guía de
orientación — conceptos, mapa de navegación real con sus 10 pantallas primarias y los cuatro grupos
de «Herramientas avanzadas», el índice de los 10 dominios de Ajustes — que remite explícitamente a
`#faqs-ayuda` para el «cómo hago X», y conserva solo lo que un documento externo aporta de verdad:
copias/recuperación, trabajo sin conexión, rutinas, problemas frecuentes y, sobre todo, una lista de
«funciones todavía no disponibles» auditada contra el código real en vez de heredada.

**Verificado uno por uno contra el código antes de cerrar** (paso 5 del plan original): las 10
anclas de pantalla citadas existen en `index.html` (`#home`, `#planificacion-partidas`, `#registrar`,
`#movements`, `#plan`, `#deuda-ruta`, `#update-hub`, `#cierre`, `#ajustes`, `#faqs-ayuda`, más
`#conciliar` y `#cambios-pendientes` citadas en el cuerpo). La lista final de «no disponible» se
contrastó contra `BACKLOG_STATUS.md` (E15/E16 «Verificado») y `PROJECT_STATE.md` (A5-1 en base local
sin activar en producción, hogar compartido con pantalla mínima RGX1/RGX2, PSD2 bloqueada como O-6).

**No incluido, deliberadamente:** regenerar `MANUAL_USUARIO_FINANZAS_CASA.docx` — no existe en el
repositorio ningún script de conversión Markdown→docx (se generó una vez de forma externa) ni
`pandoc` disponible en este entorno para producirlo de forma fiable. Queda como acción manual futura
si se necesita una copia `.docx` actualizada, en vez de fabricar una conversión improvisada.

---

## O-6 · Conexión bancaria PSD2 real

No es una tarea nueva: es **T-3** en `BACKLOG.md` §5 («E10: activación real de IA, hogar, push,
PSD2 e importación programada»), ya marcada `⏳ · Baja` como la única entrega funcional sin
verificar, bloqueada por la aceptación de un proveedor externo (candidato evaluado: GoCardless,
`E9_BANKING.md:5-7`), no por trabajo local pendiente. Se referencia aquí únicamente para que quede
constancia de que el diagnóstico la contempló y decidió no duplicarla como tarea propia.

---

## 1. Próximo paso

**O-1 a O-5 hechas.** `O-5` cerró el 5 de septiembre de 2026 — detalle completo arriba, en su propia
sección. Queda una única tarea, no bloqueada por trabajo local de este equipo:

- **O-6 · Conexión bancaria PSD2 real** (Impacto medio, esfuerzo alto, `⛔`). No es tarea nueva de
  este backlog: es **T-3** en `BACKLOG.md` §5, bloqueada por la aceptación de un proveedor externo
  (GoCardless evaluado, `E9_BANKING.md:5-7`). No se puede avanzar en este documento hasta que esa
  decisión de producto se tome fuera del equipo de desarrollo.

Con esto, `BACKLOG_OPERACION.md` queda en el mismo estado que la Oleada 2: todo lo construible está
construido, y lo único pendiente depende de una decisión o condición externa.
