# Backlog operativo — decisiones rápidas y uso diario

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
| O-1 | Titularidad en refinanciación/reunificación de deuda | Alto | Medio | ⏳ |
| O-2 | Recordatorio activo de reales pendientes | Medio | Bajo | ⏳ |
| O-3 | Aviso de completitud antes de cerrar el mes | Medio | Bajo | ⏳ |
| O-4 | Generalizar «¿cuánto puedo permitirme?» más allá del coche | Medio | Medio | ⏳ |
| O-5 | Actualizar `MANUAL_USUARIO.md` a partir de E17 | Medio | Bajo | ⏳ · deliberadamente al final |
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
ya usa cualquier otro escenario, sin atajos.

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

---

## O-5 · Actualizar `MANUAL_USUARIO.md` a partir de E17

**Por qué se deja para el final, a propósito.** El manual está fechado el 2 de agosto de 2026 y
declara explícitamente cubrir «hasta E14a» (`MANUAL_USUARIO.md:3-5`) — es anterior a E17, E18, E19 y
E20, que son justo las entregas que más pantallas añadieron, y no cubre más del 40% de las
secciones que existen hoy. Es la única guía en lenguaje no técnico y hoy describe una app que ya no
existe. Se deja en último lugar porque O-1 a O-4 van a cambiar comportamiento que el manual
tendría que documentar de todas formas — escribirlo antes significaría reescribirlo otra vez
después.

**Tareas, en orden:**

1. Auditar sección por sección contra la navegación actual (`#home`, «Herramientas avanzadas»,
   «Versiones anteriores») y marcar qué nombres de pantalla cambiaron (p. ej. «Actualizar» →
   `#update-hub`, «Previsión» → `#prevision` ya construida de verdad desde el 15 de agosto).
2. Reescribir el «Recorrido recomendado» (§3) y la «Rutina recomendada» (§12) con los nombres de
   pantalla y el flujo vigentes — incorporando el ritual propuesto en el diagnóstico original
   (abrir siempre por Hoy, un único hueco semanal para reales, Asesor ejecutivo para el coche,
   Laboratorio de escenarios para el resto).
3. Añadir las secciones nuevas de O-1 (titularidad en refinanciación) y O-4 (compra grande
   genérica) una vez publicadas.
4. Actualizar la fecha de revisión de cabecera y, si procede, regenerar
   `MANUAL_USUARIO_FINANZAS_CASA.docx` a partir del Markdown.
5. No requiere puerta de aceptación técnica (no toca código), pero sí revisión de que los nombres
   de pantalla citados existen realmente en `index.html` antes de darlo por cerrado.

---

## O-6 · Conexión bancaria PSD2 real

No es una tarea nueva: es **T-3** en `BACKLOG.md` §5 («E10: activación real de IA, hogar, push,
PSD2 e importación programada»), ya marcada `⏳ · Baja` como la única entrega funcional sin
verificar, bloqueada por la aceptación de un proveedor externo (candidato evaluado: GoCardless,
`E9_BANKING.md:5-7`), no por trabajo local pendiente. Se referencia aquí únicamente para que quede
constancia de que el diagnóstico la contempló y decidió no duplicarla como tarea propia.

---

## 1. Próximo paso

Empezar por **O-1**: es la que responde a la pregunta concreta que originó este backlog, y su
esfuerzo es medio porque reutiliza motores ya existentes (comparador de deuda, sustitución de
contratos) en vez de construir desde cero. O-2 y O-3 pueden hacerse en la misma sesión que O-1 o
justo después — comparten la misma fuente de datos (la lista de completitud de «Registrar el mes»)
y son de bajo esfuerzo. O-5 cierra el ciclo una vez el resto esté publicado.
