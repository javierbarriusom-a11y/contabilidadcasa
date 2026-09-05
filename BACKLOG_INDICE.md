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

**Actualizado el 5 de septiembre de 2026 (sesiones 137-149): los Bloques 1 a 4 de esa cola ya están
cerrados y el Bloque 5 ha empezado (46/51 tareas).** Bloque 1 (entrada de datos, 11 tareas) fue
primero por decisión explícita del usuario, no por esfuerzo/beneficio: 10 construidas, `DEX6` sigue
condicionada a que `A5-1` esté activo en producción (Bloque 6). Bloque 2 (11 tareas) y Bloque 3 (20
tareas) están 100% resueltos: 27 construidas de verdad (1 de ellas, `PVX3`, resultó ya cubierta por
arquitectura existente sin motor nuevo) y 3 reclasificadas con hueco de datos real documentado
(`APX4`, `IVX1`, `IVX5` — ninguna bloqueada sin motivo). Bloque 4 (3 tareas: `DLX2`/`DLX3` sesión
147, `APX3` sesión 148) también 100% resuelto. Del Bloque 5 (5 tareas, esfuerzo L/M-L) se ha
construido `PVX5` (sesión 149, la más pequeña del bloque); siguiente decidida por el usuario: `ESX3`
en la misma sesión si queda margen. **Quedan 5 tareas sin empezar: `ESX1`/`ESX3`/`IVX3`/`FCX2` del
Bloque 5, y `RGX3` en el Bloque 6 condicionada a que `A5-1` esté activo en producción.**
`PROJECT_STATE.md` lleva el registro de qué se cerró en cada sesión;
`BACKLOG_STATUS.md` §0 lleva la tabla maestra de entregas E1-E20 únicamente — no se extendió a E21
en adelante, cuyo estado se sigue en `BACKLOG_ULTIMATE_SEPTIEMBRE.md`, en
`BACKLOG_ULTIMATE_SEPTIEMBRE_OLEADA_2.md` y en `PROJECT_STATE.md`.

El único trabajo pendiente **fuera** de esa cola es `O-5` en `BACKLOG_OPERACION.md` (actualizar
`MANUAL_USUARIO.md` tras E17) — de baja prioridad, dejado deliberadamente para el final.

## Mapa completo

| Documento | Estado | Qué es | Sustituido/reconciliado por |
| --- | --- | --- | --- |
| **`BACKLOG_ULTIMATE_SEPTIEMBRE_OLEADA_2.md`** | 🟡 **Vigente — Bloques 1-4 cerrados, Bloque 5 empezado (46/51), quedan 5 tareas** | 51 tareas nuevas (previsión viva, escenarios, entrada de datos, inversión, apalancamiento, deuda según liquidez, copiloto, fiscalidad, patrimonio, continuidad e IA, multidispositivo) en 6 bloques; el Bloque 1 (entrada de datos) fue primero por decisión explícita | — |
| `BACKLOG_ULTIMATE_SEPTIEMBRE.md` | 🟡 Casi cerrado — 94/99 hechas, 5 en espera de calendario | Orden de ejecución de las 49 tareas del backlog vigente + 50 de la ampliación de septiembre (previsión viva, inversión, apalancamiento, copiloto, experiencia, fiscalidad, tesorería, deuda, seguros), en 11 bloques por nivel de dependencia. Su tabla de estado no refleja el cierre real — ver `PROJECT_STATE.md` | `BACKLOG_ULTIMATE_SEPTIEMBRE_OLEADA_2.md` para el trabajo nuevo; su propio remanente (`OPT-10/11/12/13/15`) sigue vigente aquí hasta que cumpla el plazo de `OPT-2` |
| `BACKLOG_OPERACION.md` | 🟡 Casi cerrado (O-1 a O-4 hechos, O-5 pendiente) | Eje paralelo de decisiones rápidas y uso diario, nacido de un diagnóstico de consultoría del 21/08 (`O-` prefijo) | No lo sustituye ningún otro — eje independiente, uso directo |
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
