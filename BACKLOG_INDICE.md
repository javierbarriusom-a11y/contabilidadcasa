# Índice de backlogs — mapa único y vivo

> OPT-20 · Bloque 5: este repositorio acumuló once documentos `BACKLOG*.md` en cuatro
> generaciones sucesivas de reordenación, cada una con su propia nota de "esto sustituye a
> aquello" apuntando solo al documento inmediatamente anterior — para saber cuál es la fuente
> viva de verdad había que leer varios documentos en cadena. Esta página es esa cadena ya
> recorrida una vez: dice, para cualquier pregunta, a qué documento ir primero. No sustituye el
> contenido de ningún backlog — cada uno conserva su detalle íntegro como referencia histórica de
> por qué se hizo cada cosa como se hizo.
>
> **Actualízala cuando nazca un backlog nuevo o cuando uno de estado "abierto" se cierre.**

## Para saber qué hacer a continuación

**Actualizado el 3 de septiembre de 2026: `BACKLOG_ULTIMATE_SEPTIEMBRE.md` ya no tiene 99 tareas
pendientes.** Su propia tabla sigue sin reflejarlo, pero `PROJECT_STATE.md` (sesiones 47 y 115 a 134)
confirma que 94 de esas 99 ya están construidas, con test y fusionadas a `main`. Solo quedan
`OPT-10`, `OPT-11`, `OPT-12`, `OPT-13` y `OPT-15`, bloqueadas por el reloj de 30 días de `OPT-2`
(arrancó el 29 de agosto, no cumple hasta finales de septiembre) — no por esfuerzo. `OPT-14`,
`OPT-16` y `OPT-17` quedaron cerradas como decisión de no construirlas.

**El siguiente trabajo real de producto vive en [`BACKLOG_ULTIMATE_SEPTIEMBRE_OLEADA_2.md`](BACKLOG_ULTIMATE_SEPTIEMBRE_OLEADA_2.md)**:
51 tareas nuevas (previsión viva, escenarios, entrada de datos, inversión, apalancamiento, deuda
según liquidez, copiloto, fiscalidad, patrimonio, continuidad e IA, multidispositivo), ninguna de
las cuales depende del remanente de `OPT-10` a `OPT-15` — ambas colas avanzan en paralelo.

**Actualizado el 5 de septiembre de 2026 (sesiones 137-152): los Bloques 1 a 5 de esa cola ya están
cerrados (49/51 construidas + 1 retirada de forma justificada = 50/51).** Bloque 1 (entrada de
datos, 11 tareas) fue primero por decisión explícita del usuario, no por esfuerzo/beneficio: 10
construidas, `DEX6` sigue condicionada a que `A5-1` esté activo en producción (Bloque 6). Bloque 2
(11 tareas) y Bloque 3 (20 tareas) están 100% resueltos: 27 construidas de verdad (1 de ellas,
`PVX3`, resultó ya cubierta por arquitectura existente sin motor nuevo) y 3 reclasificadas con hueco
de datos real documentado (`APX4`, `IVX1`, `IVX5` — ninguna bloqueada sin motivo). Bloque 4 (3
tareas: `DLX2`/`DLX3` sesión 147, `APX3` sesión 148) también 100% resuelto. Bloque 5 (5 tareas,
esfuerzo L/M-L) cerrado con `PVX5` (sesión 149), `ESX3` (sesión 150, que además corrigió un bug real
preexistente en `simulate()` de `canonical-e13-scenarios.js`), `IVX3` (sesión 151) y `ESX1` (sesión
152, Monte Carlo acotado por el usuario a cientos de trayectorias en el hilo principal); `FCX2`
quedó retirada del backlog activo (sesión 151: el hogar confirma que su residencia fiscal será
siempre España, sin hipótesis real que simular). **Solo queda `RGX3` del Bloque 6, condicionada a
que `A5-1` esté activo en producción — el resto de la Oleada 2 está cerrado.**
`PROJECT_STATE.md` lleva el registro de qué se cerró en cada sesión;
`BACKLOG_STATUS.md` §0 lleva la tabla maestra de entregas E1-E20 únicamente — no se extendió a E21
en adelante, cuyo estado se sigue en `BACKLOG_ULTIMATE_SEPTIEMBRE.md`, en
`BACKLOG_ULTIMATE_SEPTIEMBRE_OLEADA_2.md` y en `PROJECT_STATE.md`.

**Actualizado el 5 de septiembre de 2026 (sesión 153): `O-5` también cerrada** — `MANUAL_USUARIO.md`
reescrito como guía de orientación (mapa de navegación real + remisión al manual interactivo interno
`#faqs-ayuda` para el paso a paso), corrigiendo además tres afirmaciones obsoletas que seguían
marcando como «no disponibles» funciones ya construidas (E15, E16, aplicación de ofertas de deuda de
E14b). Con esto, `BACKLOG_OPERACION.md` queda **100% cerrado salvo `O-6`** (PSD2), bloqueada por
decisión de proveedor externo.

**Actualizado el 6 de septiembre de 2026: nace el siguiente backlog, con trabajo accionable ya
identificado.** El hogar pidió una auditoría crítica de producto sobre previsión autoajustable,
inversión, apalancamiento y deuda según liquidez. Esa auditoría cruzó sus 46 propuestas contra el
código real de la Oleada 2 antes de convertirlas en tareas: encontró que 5 ya estaban construidas
(retiradas con motivo documentado) y que 9 necesitaban reducir su alcance por el mismo hueco de datos
que ya bloqueó `APX4`/`IVX1`/`IVX5`. **El siguiente trabajo real de producto vive en
[`BACKLOG_ULTIMATE_SEPTIEMBRE_OLEADA_3.md`](BACKLOG_ULTIMATE_SEPTIEMBRE_OLEADA_3.md)**: 44 tareas
accionables (3 verificaciones de código + 41 tareas nuevas) en 5 bloques, ninguna bloqueada por las
tres condiciones externas de la tabla de abajo — resuelve el «cierre de ciclo» que sigue a
continuación, sin esperar a ninguna de ellas. **Cerrada el 9 de septiembre de 2026 (sesión 163) — ver
la actualización más reciente, justo abajo.**

**Actualizado el 9 de septiembre de 2026 (sesión 163c): `BACKLOG_ULTIMATE_SEPTIEMBRE_OLEADA_3.md`
cerrada.** Bloques 1 a 5 resueltos: 43/44 tareas accionables construidas o reducidas con motivo
documentado, y 1 postergada con motivo (`GOB5`, bloqueada por `A5-4` sin backend push en producción).
El Bloque 5 (16 tareas, relleno de hueco) se completó en tres sub-tandas de esta misma sesión —
previsión viva (`PVC2/4/7/8/9`), inversión (`INV2/4/6/7/8`) y deuda + gobierno
(`LEV8`/`DEB3`/`DEB7`/`GOB7`/`GOB8`/`GOB10`) — cada una validada y publicada por separado. Detalle
completo, con referencias de código por tarea, en la tabla del Bloque 5 de ese documento y en los
cierres de sesión de `PROJECT_STATE.md`. El reloj de `OPT-2` (tabla de condiciones externas, abajo)
todavía no ha cumplido sus 30 días a esta fecha — sigue como nota a pie de página, no como prioridad
siguiente.

**Actualizado el 9 de septiembre de 2026 (sesión 162): `OPT-24` cerrada.** Nacida en la sesión 160
tras una auditoría pedida por el hogar («Ajustes se está convirtiendo en un cajón de sastre»), que
confirmó con cifras 62 tarjetas de las que solo 16 (26%) eran configuración real. Las 4 tareas están
hechas (detalle completo en `BACKLOG_OPTIMIZACION.md` §3): la sub-pestaña más desproporcionada
(Deuda y apalancamiento, 18 tarjetas) se movió a la ruta «Deuda» ya existente (sesión 161); las 8
sub-pestañas restantes de Ajustes quedaron separadas en «Configuración»/«Herramientas» bajo la misma
barra de anclas; se resolvieron las 3 tarjetas mixtas que de verdad mezclaban registro y herramienta
con inputs propios (Cartera de inversión, Cartera: objetivo de reparto, Compensación de pérdidas); y
los tests de wiring afectados se actualizaron. Sin ruta nueva, sin revivir «Herramientas avanzadas»
y sin contradecir `OPT-15` (que ya fija Ajustes como una de las 6 rutas finales) — al contrario,
`OPT-15` encontrará la navegación final alrededor de una Ajustes ya limpia.

**Actualizado el 11 de septiembre de 2026 (sesión 166): nace el siguiente backlog de producto.** El
hogar pidió una segunda auditoría crítica sobre los mismos cuatro frentes de la Oleada 3 —previsión
autoajustable, inversión, apalancamiento y deuda según liquidez—, esta vez con más de 40 propuestas y
profundidad especial en previsión viva y en apalancamiento/deuda. Esa auditoría se hizo primero como
documento independiente (["El Libro Vivo"](https://claude.ai/code/artifact/b30b9e52-c0fd-42d9-a993-2ef6625a40ad),
10 hallazgos + 49 propuestas) y se cruzó contra `BACKLOG_ULTIMATE_SEPTIEMBRE_OLEADA_3.md` antes de
convertirla en tareas — igual disciplina que la propia Oleada 3 aplicó a la Oleada 2. Ese cruce encontró
que 4 de las 49 ya estaban construidas y que 7 necesitaban reducir su alcance. **El siguiente trabajo
real de producto vive en
[`BACKLOG_ULTIMATE_SEPTIEMBRE_OLEADA_4.md`](BACKLOG_ULTIMATE_SEPTIEMBRE_OLEADA_4.md)**: 45 tareas
accionables + 3 verificaciones de código previas, en los mismos cinco frentes que la Oleada 3
(`PVC`/`INV`/`LEV`/`DEB`/`GOB`, continuando su numeración), sin bloqueo de ninguna de las tres
condiciones externas de la tabla de abajo.

**Actualizado el 11 de septiembre de 2026 (sesión 165): nace `OPT-25` y anula `OPT-15` para
«Herramientas avanzadas».** Un mockup externo ("Claude Design", opción B) propuso lo contrario de lo
que asumía `OPT-24`: sacar las tarjetas de «Herramientas» de Ajustes y darles categorías propias
dentro de «Herramientas avanzadas», en vez de mantenerlas en dos sub-grupos de la misma pantalla. Esa
dirección contradecía por escrito la restricción de `OPT-24` (no revivir ese desplegable) y la razón
de ser de `OPT-15` (retirarlo). Puesto el conflicto delante del hogar tras publicar la primera fase
(Seguros), la respuesta fue confirmar la reversión: «Herramientas avanzadas» se queda de forma
permanente como destino de estos comparadores. `OPT-15` queda anulada para ese propósito — ver su
propia ficha en `BACKLOG_OPTIMIZACION.md` §3. `OPT-25` continúa en 7 fases; detalle y progreso en
`BACKLOG_OPTIMIZACION.md` y en `PROJECT_STATE.md` (cierre de sesión 165).

## Cierre de ciclo anterior — 5 de septiembre de 2026 (histórico)

Con `O-5` cerrada, las tres colas activas del proyecto habían llegado al mismo punto a la vez: todo lo
que dependía de esfuerzo propio estaba construido, y todo lo que quedaba dependía de una condición
externa. Esa situación ya no describe el estado actual — `BACKLOG_ULTIMATE_SEPTIEMBRE_OLEADA_3.md` es
el backlog que faltaba — pero la tabla de las tres condiciones externas sigue vigente sin cambios,
porque ninguna de esas tres colas se resolvió con la Oleada 3:

| Cola | Qué queda | Condición de desbloqueo | Quién la controla |
| --- | --- | --- | --- |
| `BACKLOG_ULTIMATE_SEPTIEMBRE.md` | `OPT-10`, `OPT-11`, `OPT-12`, `OPT-13` (`OPT-15` anulada por `OPT-25`, 11-sep) | Reloj de 30 días de `OPT-2` (arrancó 29 de agosto) | Calendario — cumple a finales de septiembre de 2026 |
| `BACKLOG_ULTIMATE_SEPTIEMBRE_OLEADA_2.md` | `RGX3` (Bloque 6) y `DEX6` (Bloque 1) | `A5-1` (IA) activo en producción real, no solo en base local | Externa — activación de infraestructura, sin fecha conocida |
| `BACKLOG_OPERACION.md` | `O-6` (= `T-3` en `BACKLOG.md`) | Contratación de un proveedor PSD2 (candidato evaluado: GoCardless) | Decisión de producto fuera del equipo de desarrollo |

**Para quien retome la sesión:** las tres condiciones externas de arriba siguen sin cambiar — no dejan
de vigilarse solo porque exista un backlog nuevo. Verificarlas contra el calendario y contra el estado
real de `A5-1`/PSD2 sigue siendo el primer paso antes de asumir que alguna sigue bloqueada. El detalle
sesión a sesión de todo lo cerrado hasta aquí (49/51 de la Oleada 2 + `O-1` a `O-5`) vive en
`PROJECT_STATE.md`, sesiones 137 a 153; el de la Oleada 3, desde la sesión 155.

## Mapa completo

| Documento | Estado | Qué es | Sustituido/reconciliado por |
| --- | --- | --- | --- |
| **`BACKLOG_ULTIMATE_SEPTIEMBRE_OLEADA_4.md`** | 🟢 Vigente — primera oleada hecha (sesión 166b): 3 verificaciones + `LEV9`/`DEB9`; quedan 43 tareas accionables | Segunda auditoría crítica de producto sobre los mismos cuatro frentes de la Oleada 3, nacida de ["El Libro Vivo"](https://claude.ai/code/artifact/b30b9e52-c0fd-42d9-a993-2ef6625a40ad) (10 hallazgos + 49 propuestas), tras retirar 4 propuestas ya construidas en la Oleada 3 y reducir el alcance de otras 7 | — |
| `BACKLOG_ULTIMATE_SEPTIEMBRE_OLEADA_3.md` | ✅ Cerrada — 43/44 hechas (construidas o reducidas con motivo), 1 postergada (`GOB5`, condición externa) | Auditoría crítica de producto (previsión autoajustable, inversión, apalancamiento, deuda según liquidez) convertida en 44 tareas en 5 bloques (3 verificaciones de código + cimiento + alto impacto + apuestas grandes + relleno), tras retirar 5 propuestas ya construidas en la Oleada 2 | `BACKLOG_ULTIMATE_SEPTIEMBRE_OLEADA_4.md` para el trabajo nuevo de estos cuatro frentes; contenido histórico intacto |
| `BACKLOG_ULTIMATE_SEPTIEMBRE_OLEADA_2.md` | 🟡 Casi cerrado — Bloques 1-5 cerrados (50/51), solo queda `RGX3` (Bloque 6, condicionada) | 51 tareas nuevas (previsión viva, escenarios, entrada de datos, inversión, apalancamiento, deuda según liquidez, copiloto, fiscalidad, patrimonio, continuidad e IA, multidispositivo) en 6 bloques; el Bloque 1 (entrada de datos) fue primero por decisión explícita | `BACKLOG_ULTIMATE_SEPTIEMBRE_OLEADA_3.md` para el trabajo nuevo de estos cuatro frentes; su propio remanente (`RGX3`) sigue vigente aquí hasta que `A5-1` esté en producción |
| `BACKLOG_ULTIMATE_SEPTIEMBRE.md` | 🟡 Casi cerrado — 94/99 hechas, 5 en espera de calendario | Orden de ejecución de las 49 tareas del backlog vigente + 50 de la ampliación de septiembre (previsión viva, inversión, apalancamiento, copiloto, experiencia, fiscalidad, tesorería, deuda, seguros), en 11 bloques por nivel de dependencia. Su tabla de estado no refleja el cierre real — ver `PROJECT_STATE.md` | `BACKLOG_ULTIMATE_SEPTIEMBRE_OLEADA_2.md` para el trabajo nuevo; su propio remanente (`OPT-10/11/12/13/15`) sigue vigente aquí hasta que cumpla el plazo de `OPT-2` |
| `BACKLOG_OPERACION.md` | 🟡 Casi cerrado — O-1 a O-5 hechos, solo `O-6` (PSD2, bloqueada por proveedor externo) | Eje paralelo de decisiones rápidas y uso diario, nacido de un diagnóstico de consultoría del 21/08 (`O-` prefijo) | No lo sustituye ningún otro — eje independiente, uso directo |
| `BACKLOG_UNIFICADO.md` | ⚪ Histórico | Fusionó el orden de ejecución de `BACKLOG_PATRIMONIO_Y_FINANZAS.md` + `BACKLOG_OPTIMIZACION.md` (49 tareas) | `BACKLOG_ULTIMATE_SEPTIEMBRE.md` (29/08) |
| `BACKLOG_PATRIMONIO_Y_FINANZAS.md` | 📚 Detalle de referencia | Contexto, prioridad y resultado esperado de cada tarea `A14`-`A19` (E21-E26) — el orden de ejecución vive en otro sitio | Orden fusionado en `BACKLOG_UNIFICADO.md` → `BACKLOG_ULTIMATE_SEPTIEMBRE.md`; contenido intacto |
| `BACKLOG_OPTIMIZACION.md` | 📚 Detalle de referencia | Contexto, pasos y resultado esperado de cada tarea `OPT-1` a `OPT-22` | Orden fusionado en `BACKLOG_UNIFICADO.md` → `BACKLOG_ULTIMATE_SEPTIEMBRE.md`; contenido intacto |
| `BACKLOG_PRESUPUESTOS_V2.md` | ⚪ Histórico (completo) | Sistema de presupuestos + forecasting: FASE 0 a FASE 7 completadas, PERF-2 evaluado y cerrado sin construir nada (no compensaba el riesgo) | Ninguno — eje cerrado, sin sucesor |
| `BACKLOG_PRESUPUESTOS.md` | ⚪ Histórico | Versión 1 del backlog de presupuestos (`P-`/`S-`/`F-`/`U-`), previa a la integración con forecasting | `BACKLOG_PRESUPUESTOS_V2.md` (26/08) |
| `docs/BACKLOG_NUEVE_PANTALLAS.md` | ⚪ Histórico (completo) | 124 tareas del rediseño a nueve pantallas (`H-`/`R-`/`M-`/`P-`/`D-`/`E-`/`A-`/`C-`/`L-`) — E19/E20, verificadas en `BACKLOG_STATUS.md` §0 | Ninguno — redesign cerrado, sin sucesor |
| `BACKLOG.md` | ⚪ Histórico | Backlog operativo del rediseño a seis vistas (`V-`/`T-`/`D-`/`P-`/`A-`/`C-`/`L-`), cerrado el 12/08; conserva además el "Plan de mejora post-E20" (P-1 a P-6, todo construido) | `docs/BACKLOG_NUEVE_PANTALLAS.md` (14/08) para el trabajo operativo; contenido histórico intacto |
| `BACKLOG_PRODUCT_EVOLUTION.md` | ⚪ Histórico | Backlog de evolución E10-E18 (forecast, escenarios, deuda, objetivos, alertas, navegación) | `BACKLOG_STATUS.md` §0 lleva ahora la tabla maestra de esas entregas; `BACKLOG_PATRIMONIO_Y_FINANZAS.md` continúa la numeración tras E20 |
| `BACKLOG_STATUS.md` | 📚 Registro maestro (vivo en su §0) | §0 es la tabla maestra de estado de **todas** las entregas E1-E26, actualizada al cambiar el estado de una fase; el resto del documento (§1 en adelante) es el histórico E1-E20 | El orden de ejecución vigente vive en `BACKLOG_ULTIMATE_SEPTIEMBRE.md`; la tabla maestra de §0 sigue siendo la referencia de estado |

**Leyenda**: 🟢 vigente con trabajo abierto · 🟡 casi cerrado, una tarea pendiente · 📚 detalle de
referencia todavía citado por el documento vigente · ⚪ histórico, sin trabajo pendiente.
