# Backlog Ultimate Septiembre — Oleada 2

> Mapa de todos los backlogs del repositorio: [`BACKLOG_INDICE.md`](BACKLOG_INDICE.md) (OPT-20).
> Continuación de [`BACKLOG_ULTIMATE_SEPTIEMBRE.md`](BACKLOG_ULTIMATE_SEPTIEMBRE.md) — no la sustituye ni reabre
> ninguna de sus 99 tareas.

Fecha de creación: 3 de septiembre de 2026. Repositorio vivo: `javierbarriusom-a11y/contabilidadcasa`.

## 0. Por qué existe este documento

`BACKLOG_ULTIMATE_SEPTIEMBRE.md` sigue marcando sus 99 tareas como pendientes en su propia tabla, pero
el registro real de sesiones (`PROJECT_STATE.md`, sesiones 47 y 115 a 134) y el historial de commits
muestran que **94 de esas 99 ya están construidas, con test y fusionadas a `main`**. Las 5 que faltan de
verdad —`OPT-10`, `OPT-11`, `OPT-12`, `OPT-13` y `OPT-15`— no están bloqueadas por esfuerzo sino por un
reloj de calendario: `OPT-2` (instrumentar uso real de pantallas heredadas) arrancó su contador de 30
días el 29 de agosto y no cumple hasta finales de septiembre. `OPT-14`, `OPT-16` y `OPT-17` no están
pendientes: quedaron cerradas como decisión explícita de no construirlas, con motivo técnico documentado.

Esta Oleada 2 nace de pedir explícitamente seguir profundizando en cuatro frentes ya abiertos por la
primera ampliación —previsión y escenarios, apalancamiento e inversión, y decidir si cancelar deuda
existente según el líquido real— y de una quinta petición nueva: que el **protocolo de entrada de datos y
el manejo general de la app** sea más intuitivo. Ninguna de las 51 tareas siguientes depende de las 5
tareas todavía bloqueadas de la cola anterior — todo lo que necesitan (`PV`, `IV`, `AP`, `CP`, `UX`, `FC`,
`TT`, `DI`, `SP`, `A14`-`A19`) ya está construido. Esta oleada puede empezar completa, sin esperar a nada.

Rige el mismo contrato de gobierno que el resto del backlog: ninguna entrega escribe sin confirmación,
toda cifra futura declara origen/fecha/confianza, y cada entrega publica dejando la app tan utilizable
como estaba antes de empezarla.

## 1. Cómo se ha calculado el orden — y por qué se aparta del puro esfuerzo/beneficio

El método por defecto de este backlog (igual que en `BACKLOG_ULTIMATE_SEPTIEMBRE.md`) sería: nivel de
dependencia primero, esfuerzo después, beneficio al final. Aplicado en frío, el **Bloque de entrada de
datos** (`DEX`, esfuerzo mayoritariamente M) quedaría detrás de varias tareas S/S-M de otros bloques.

**Se aparta deliberadamente de ese criterio por instrucción explícita**: el protocolo de entrada de datos
se prioriza primero, completo, como Bloque 1. La justificación no es solo seguir la instrucción a
ciegas — es que **ningún ítem de `DEX` depende de otro de esta oleada**: los once son nivel 0 de verdad,
así que adelantarlos por completo no obliga a saltarse ninguna dependencia real ni genera trabajo a medio
construir. Es la única desviación del método por defecto en este documento; el resto de bloques sigue el
mismo criterio de nivel de dependencia → esfuerzo → beneficio que el documento anterior.

## Leyenda

| Esfuerzo | Significado |
|---|---|
| S | Cambio acotado, sin dominio de datos nuevo ni migración |
| S-M | Entre acotado y contrato pequeño |
| M | Contrato o integración pequeña, o refactor de una pantalla |
| M-L | Entre integración y dominio nuevo |
| L | Dominio de datos nuevo, migración, o corrección de exactitud legal/crítica |

| Beneficio | Significado |
|---|---|
| Bajo | Mejora marginal o de nicho |
| Medio | Impacto claro pero no crítico en uso diario o mantenimiento |
| Alto | Impacto directo en decisiones de dinero, retención, o habilita trabajo posterior |
| Crítico | Guardarraíl de seguridad, o corrige algo que hoy es incorrecto o arriesgado |

| Origen | Procedencia |
|---|---|
| Previsión viva 2 | Extiende `PV1`-`PV6` (autoajuste, bandas, estacionalidad, diario de cambios, sensibilidad) |
| Escenarios 2 | Extiende `A8-1`-`A8-8` (laboratorio de escenarios) |
| Entrada de datos | Extiende `A6-1`-`A6-8` y `UX1`-`UX6` — protocolo de captura y manejo de la app |
| Inversión 2 | Extiende `IV1`-`IV8` y `FC1`-`FC5` (cartera, rentabilidad, fiscalidad) |
| Apalancamiento 2 | Extiende `AP1`-`AP6` — pedir deuda para invertir |
| Deuda-liquidez | Extiende `AP1`/`AP6` — cancelar deuda o no según el líquido real |
| Copiloto 2 | Extiende `CP1`-`CP6` |
| Fiscalidad 2 | Extiende `A15-1`-`A15-5` y `FC1`-`FC5` |
| Patrimonio y vida | Extiende `A14-2` (patrimonio neto) y `A10-1` (objetivos) |
| Continuidad e IA | Extiende `A0-9`, `A5-1` y `A5-3` |
| Multidispositivo | Extiende `A5-3` y `A0-9` |

Estado: todas las tareas de este documento están ⏳ (ninguna tiene código todavía) salvo aviso contrario.
Primera oleada del Bloque 1 (DEX7, DEX9, DEX3, DEX8, DEX11 — las cinco de esfuerzo S/S-M) cerrada el
3 de septiembre de 2026 (sesión 136 de `PROJECT_STATE.md`, detalle completo ahí); marcadas ✅ en la
tabla de abajo. Segunda oleada (DEX1, DEX4, DEX5, DEX10 — las cuatro de esfuerzo M) cerrada el mismo
día (sesión 137). Tercera oleada (DEX2, la última que no dependía de infraestructura externa) cerrada
también el mismo día (sesión 138). Del Bloque 1 solo queda `DEX6`, condicionada a que `A5-1` esté
activo en producción — no se puede empezar todavía.

Primera oleada del Bloque 2 (DLX1, IVX8, CPX3 — tres de las cuatro tareas de esfuerzo S) cerrada el
4 de septiembre de 2026 (sesión 139 de `PROJECT_STATE.md`, detalle completo ahí); marcadas ✅ en la
tabla de abajo. `RGX2`, la cuarta, se investigó y quedó marcada ⚠️ por un desajuste de alcance
(`A5-3` sin UI). Consultado el usuario, decidió no reclasificarla: construir la pantalla mínima de
hogar compartido que le faltaba a `A5-3`, y con ella también `RGX1` (Bloque 2, fila 19, misma
dependencia). Ambas cerradas el mismo día (sesión 140), marcadas ✅. Las 6 tareas de esfuerzo S-M
restantes (APX5, APX6, LPX3, RGX4, IVX7, MDX2) cerradas también el 4 de septiembre de 2026 (sesión
141), sin ningún hallazgo de alcance — las 9 dependencias declaradas (`DI1`, `A9-3`, `A14-1`, `SP1`,
`A7-3`, `A11-4`, `CP1`, `IV3`, `A0-9`) se verificaron primero y todas tenían UI real. **Con esto el
Bloque 2 queda completo (11/11 tareas)**. Quedan los Bloques 3-6 sin empezar (36 tareas).

Primera oleada del Bloque 3 (APX1, IVX2, LPX1, LPX2, IVX6 — cinco de las veinte tareas) cerrada el 4
de septiembre de 2026 (sesión 142). Antes de construir se verificaron las dependencias declaradas
(mismo criterio que RGX1/RGX2): dos hallazgos reales. `IVX5` (drawdown) depende de una serie
temporal de valoraciones que la app no guarda — reclasificada ⚠️, sin construir nada sobre datos
inventados. `IVX6` (glide path) dependía de un vínculo posición↔objetivo que tampoco existía;
consultado el usuario, decidió construirlo primero (campo `goalId` opcional en `IV1`) en vez de
reclasificar. Las otras cuatro (`APX1`, `IVX2`, `LPX1`, `LPX2`) no tenían ningún hueco de alcance —
sus dependencias (`AP2`, `A15-1`, `FC1`, `IV2`, `A14-2`, `A7-1`, `A14-4`) ya eran reales y con UI.
Quedan 14 tareas del Bloque 3 y los Bloques 4-6 completos (17 tareas) sin empezar.

Segunda oleada del Bloque 3 (PVX1, IVX4, FCX1, CPX2 — cuatro tareas más) cerrada el 4 de septiembre
de 2026 (sesión 143), sin ningún hallazgo de alcance: `A11-3`/`learnFromHistory` (PVX1), `IV1`
(IVX4), `A15-2`/`A15-4` (FCX1) y `A8-2`/`CP6` (CPX2) ya eran reales, con UI o con el motor de
tramos progresivos necesario. Quedan 10 tareas del Bloque 3 y los Bloques 4-6 completos (17 tareas)
sin empezar.

Tercera oleada del Bloque 3 (PVX4, ESX4, CPX1, MDX1 — cuatro tareas más) cerrada el 4 de septiembre
de 2026 (sesión 144). Antes de construir se verificaron las dependencias declaradas de las diez
tareas restantes: dos hallazgos reales, los dos puestos al usuario antes de tocar código. `IVX1`
(multidivisa) — ninguna posición ni activo guarda divisa hoy, y el tipo de cambio exigiría
mantenimiento manual permanente sin cotizaciones en vivo (la app funciona sin red por diseño) —
reclasificada ⚠️. `APX4` (correlación activo apalancado-ingresos) — ni serie histórica de
rendimientos ni metadato de sector/empleador del hogar sobre el que construir ninguna lectura,
estadística o cualitativa — reclasificada ⚠️. Las otras cuatro no tenían ningún hueco de alcance:
`PVX4` reutiliza el p25/p75 histórico que ya calculaba `budgetAnalysisForCategory()` (S-1, hasta
ahora solo usado para sugerir presupuesto, nunca mostrado); `ESX4` extiende `sensitivity()` (A8-6)
a una malla 2D reutilizando `simulate()` tal cual; `CPX1` añade la próxima mejor acción de `CP1`
como cabecera de «Estado de la semana» (TRACK-3), repitiendo su pequeña función de selección (no
accesible desde fuera del cierre de p2-ui.js) en vez de reimportar un motor nuevo; `MDX1` es un
tercer `viewType` del mecanismo de enlace de `A19-1`, sin motor de compartición nuevo. Quedan 4
tareas del Bloque 3 (`PVX3`, `PVX2`, `ESX2`, `APX2`) y los Bloques 4-6 completos (17 tareas) sin
empezar.

Cuarta y última oleada del Bloque 3 (PVX3, PVX2, ESX2, APX2) cerrada el 4 de septiembre de 2026
(sesión 145) — **con esto el Bloque 3 queda completo (20/20 tareas)**. `PVX3` resultó ya cubierta
por la arquitectura existente, sin motor nuevo: la previsión se recalcula sola en cada cambio
(`recomputeModelIfNeeded()`, caché con firma, sin botón "recalcular" en toda la app), y el
`reconciled` que alimenta la recalibración de `PV3` es un estado por mes completo, no por
movimiento importado — no hay un dato a medio mes sobre el que recalibrar antes de cerrarlo; la
granularidad mensual es del modelo de datos, no un hueco de construcción. El usuario confirmó
reclasificarla como hecha en vez de construir algo sobre una premisa que no encajaba. Las otras
tres no tuvieron ningún hallazgo: `PVX2` pinta de verdad los periodos que ya calculaba
`adaptiveHorizon()` (A7-1), antes solo resumidos en un recuento; `ESX2` son 9 plantillas con nombre
real que mapean a los 7 tipos ya existentes del constructor de eventos (A8-2), sin fijar nunca un
importe ni una duración; `APX2` es `lombardCreditCapacity()`, capacidad de crédito contra la
cartera real (IV1) a un LTV declarado por el hogar, primer paso de `APX3` (Bloque 4). Quedan los
Bloques 4-6 completos (17 tareas) sin empezar.

## 2. Orden de ejecución — 51 tareas en 6 bloques

### Bloque 1 — Entrada de datos, priorizado completo por decisión explícita (11 tareas, nivel 0)

| Orden | ID | Tarea | Origen | Esfuerzo | Beneficio | Nota |
|---|---|---|---|---|---|---|
| 1 | ✅ DEX7 | Valores por defecto que aprenden | Entrada de datos | S | Medio | Hecho — Registrar · Reales sugiere por `placeholder` el último real de la partida, nunca como `value` |
| 2 | ✅ DEX9 | Bandeja previa con progreso hasta cero | Entrada de datos | S | Medio | Hecho — contador de pendientes y orden por antigüedad en `renderE11bStatus()` |
| 3 | ✅ DEX3 | Plantillas de un toque para lo recurrente | Entrada de datos | S-M | Alto | Hecho — botón «Repetir hoy» en Análisis, vía bandeja previa/lote reversible |
| 4 | ✅ DEX8 | Errores explicados en lenguaje de persona | Entrada de datos | S-M | Medio | Hecho — mensaje específico por campo en captura de ticket + copy de Excel menos técnico |
| 5 | ✅ DEX11 | Confirmación por gesto en móvil | Entrada de datos | S-M | Medio | Hecho — mantener pulsado 600 ms en táctil sobre los botones de A6-5 ya existentes |
| 6 | ✅ DEX1 | Barra de captura rápida | Entrada de datos | M | Alto | Hecho — tercer resultado del lanzador (Cmd/Ctrl+K): «gasto 12,50 mercadona» crea el movimiento vía bandeja previa |
| 7 | ✅ DEX4 | Deshacer universal | Entrada de datos | M | Alto | Hecho — `undoStack` real, corrige un bug de pérdida silenciosa de deshacer; contador «+N más» visible |
| 8 | ✅ DEX5 | Onboarding progresivo por desbloqueo | Entrada de datos | M | Alto | Hecho — decisión del usuario: sin ocultar nada, solo guía de Hoy + Registrar la primera semana |
| 9 | ✅ DEX10 | Corrección en lote | Entrada de datos | M | Medio-Alto | Hecho — la selección múltiple ya existía (M-8); se añadió el lote de tipo de acción, que faltaba |
| 10 | ✅ DEX2 | Entrada en lenguaje natural, sin voz | Entrada de datos | M-L | Alto | Hecho — mismo campo del lanzador (DEX1), más vocabulario y fecha relativa/explícita, siempre a bandeja previa |
| 11 | DEX6 | Extracto completo por foto o PDF | Entrada de datos | L | Alto | Extiende `A17-3`; **condicionada a `A5-1` activo** (ver Bloque 6) — el resto del bloque no espera a esta |

### Bloque 2 — Cimientos y victorias rápidas del resto de la ola (11 tareas, nivel 0, S/S-M)

| Orden | ID | Tarea | Origen | Esfuerzo | Beneficio | Nota |
|---|---|---|---|---|---|---|
| 12 | ✅ DLX1 | Guardarraíl de colchón antes de amortizar | Deuda-liquidez | S | Crítico | Hecho — `amortizeCushionGuardrail()` en `canonical-cushion.js` (mismo patrón tri-estado que `AP6`), pintado antes del resultado de `AP1` |
| 13 | ✅ IVX8 | Sobreexposición cruzada vivienda-inversión | Inversión 2 | S | Medio | Hecho — `ivx8HousingExposure()`, aviso en Cartera (`A14-4`) y en Concentración (`IV1`) |
| 14 | ✅ RGX2 | Alerta de concentración de conocimiento | Continuidad e IA | ~~S~~ → M/L real | Medio | Hecho — decisión del usuario del 4 de septiembre de 2026: en vez de reclasificarla, se construyó la pantalla mínima de hogar compartido (`A5-3`) que le faltaba a `A5-3`, compartida con `RGX1` (fila 19). Ver detalle en la fila 19 y en la sesión 140 de `PROJECT_STATE.md`. |
| 15 | ✅ CPX3 | Transparencia de recomendaciones ignoradas | Copiloto 2 | S | Medio | Hecho — registro `cpx3RecommendationLog` (vía `window.FinanceP2Bridge`), aviso a partir de 3 días y botón de descartar en la tarjeta de `CP1` |
| 16 | ✅ APX5 | Coste total de refinanciar, no solo el tipo | Apalancamiento 2 | S-M | Alto | Hecho — `refinancingBreakEvenMonths()` extiende `canonical-mortgage-rate-scenarios.js` (DI1): meses de equilibrio entre el ahorro mensual (escenario base) y el coste de refinanciar declarado |
| 17 | ✅ APX6 | Amortizar: reducir cuota vs. reducir plazo | Apalancamiento 2 | S-M | Alto | Hecho — `amortizeReduceQuotaVsTerm()` en `canonical-debt-comparator.js`, cuota francesa real (no la estimación de interés simple de `compareAmortizeVsInvest`), en la misma tarjeta de `AP1` con el plazo real del contrato |
| 18 | ✅ LPX3 | Checklist de continuidad ante fallecimiento o incapacidad | Patrimonio y vida | S-M | Alto | Hecho — dos puntos automáticos (`A14-1`/`SP1`) y tres casillas que confirma el hogar (testamento, beneficiarios, a quién avisar), sin fuente de datos en la app para inventarlas |
| 19 | ✅ RGX1 | Simulacro guiado de pérdida de acceso | Continuidad e IA | S-M | Alto | Hecho — igual que `RGX2` (fila 14), dependía de `A5-3` sin UI. Se construyó la tarjeta «Hogar compartido» (miembros, roles, áreas, invitar/retirar) en Ajustes, con escritura real vía `migrations/20260904_e9_household_writes.sql` (funciones security definer, mismo patrón que `A19-1`) — y sobre ella, el simulacro de tres puntos (copia de emergencia, redundancia, cobertura por área). **Pendiente de acción manual del usuario**: aplicar la migración al proyecto Supabase real y verificar con dos cuentas, exactamente como pidió `E9_HOUSEHOLD.md` antes de desplegar el modelo compartido. |
| 20 | ✅ RGX4 | Explicación en dos niveles | Continuidad e IA | S-M | Medio | Hecho — capa sobre la tarjeta de `CP1`: nivel 1 (etiqueta+mensaje) siempre visible, nivel 2 (`<details>` nativo) con la evidencia real de `A11-4`/E16 y la cita de CP3 |
| 21 | ✅ IVX7 | Coste medio de adquisición (DCA) visible | Inversión 2 | S-M | Medio | Hecho — `ivx7AverageCostLabel()`: `costBasis`/`quantity` ya existían por posición (`IV1`/`FC1`), solo faltaba dividirlos y mostrarlos junto al precio actual por unidad |
| 22 | ✅ MDX2 | Exportación en formato abierto y documentado | Multidispositivo | S-M | Medio | Hecho — `MDX2_FORMATO_EXPORTACION.md` documenta el sobre JSON de `state-contract.js` (A0-9) y la decisión de gobierno de datos; un test compara el documento contra las constantes reales para que nunca se desincronicen |

### Bloque 3 — El cuerpo de la ola: previsión, escenarios, cartera y copiloto (20 tareas, nivel 0, M/M-L)

| Orden | ID | Tarea | Origen | Esfuerzo | Beneficio | Nota |
|---|---|---|---|---|---|---|
| 23 | ✅ PVX1 | Backtesting público del propio motor | Previsión viva 2 | M | Alto | Hecho — `renderPvx1Backtest()` en Ajustes (no escondido dentro del Laboratorio de escenarios E13): reutiliza `learnFromHistory()` sobre `reconciledMonthlyNetHistory()` (mismo aprendizaje de `A11-3`/`E12b` que ya alimenta PV1-PV4), mes a mes previsto vs. real conciliado más el resumen de desviación media |
| 24 | ✅ PVX3 | Recalculo instantáneo al introducir un dato | Previsión viva 2 | M | Alto | Hecho — ya cubierta por la arquitectura existente, sin motor nuevo: la previsión (`A7-1`) se recalcula sola en cada cambio vía `recomputeModelIfNeeded()` (caché con firma, sin botón "recalcular" en toda la app), y el `reconciled` que alimenta la recalibración de `PV3` es un estado por MES completo (matched, no por movimiento importado) — no existe un dato a medio mes sobre el que recalibrar antes de cerrarlo; la granularidad mensual es del modelo de datos, no un hueco de construcción |
| 25 | ✅ PVX4 | Banda de normalidad por categoría en vivo | Previsión viva 2 | M | Alto | Hecho — `pvx4NormalityBandLabel()` en `views/presupuesto-mes.js`: reutiliza `budgetAnalysisForCategory()` (p25/p75 históricos, S-1, ya usado para sugerir presupuesto), comparado contra la proyección de fin de mes (S-2) — nunca contra el gasto parcial a día de hoy, que sería una comparación falsa contra meses completos |
| 26 | ✅ PVX2 | Multihorizonte simultáneo | Previsión viva 2 | M | Medio | Hecho — `pvx2AdaptiveHorizonHtml()` pinta de verdad los periodos que ya calculaba `adaptiveHorizon()` (`A7-1`), hasta ahora solo resumidos en un recuento: corto (mensual), medio (trimestral) y largo plazo (anual) a la vez en una sola tabla |
| 27 | ✅ ESX2 | Plantillas de eventos de vida | Escenarios 2 | M | Alto | Hecho — 9 plantillas con nombre real (`ESX2_EVENT_TEMPLATES`) que mapean a los 7 tipos ya existentes del constructor de eventos (`A8-2`), solo fijan el tipo y limpian el importe genérico de partida — nunca inventan un importe ni una duración |
| 28 | ✅ ESX4 | Malla de dos supuestos cruzados | Escenarios 2 | M | Medio | Hecho — `sensitivityGrid()` (`canonical-e13-scenarios.js`): extiende `sensitivity()` (A8-6, un supuesto cada vez) a una cuadrícula 5×5 que varía ingresos y gastos a la vez alrededor del caso base (A8-1), reutilizando `simulate()` tal cual — sin motor nuevo |
| 29 | ✅ IVX2 | Comparación contra un índice de referencia | Inversión 2 | M | Alto | Hecho — `compareAgainstBenchmark()` (`canonical-portfolio.js`), índice anualizado declarado por el hogar (sin precio de mercado real) frente a la XIRR de la cartera; comparación explícitamente aproximada, no exacta (money-weighted vs. flujos que el índice no vive) |
| 30 | ✅ IVX4 | Coste compuesto de comisiones | Inversión 2 | M | Alto | Hecho — `compoundedFeeCost()` (`canonical-portfolio.js`): comisión anual declarada opcional por posición (`feePct`, nuevo campo de `IV1`), coste compuesto puro sobre un horizonte declarado por el hogar, sin asumir ninguna rentabilidad de mercado que no se ha declarado |
| 31 | ✅ APX1 | Coste de la deuda neto de fiscalidad real | Apalancamiento 2 | M | Alto | Hecho — `netDebtCostAfterTax()` (`canonical-debt-comparator.js`) eleva el punto de equilibrio de `AP2` con el tipo del ahorro ya declarado en FC4 (`dividendSpanishSavingsRatePct`, sin campo duplicado ni tramo de IRPF inventado); avisa aparte si hay pérdidas `FC3` pendientes de compensar |
| 32 | ⚠️ APX4 | Correlación entre activo apalancado e ingresos | Apalancamiento 2 | M | Alto | Reclasificada — ni `AP3` (simula deuda de forma abstracta, sin ligarla a un activo o sector) ni `IV4` (no clasifica sector/riesgo por posición) guardan lo necesario, y la app no registra en ningún sitio el sector o empleador del hogar. Sin serie histórica de rendimientos para una correlación estadística real ni metadato para una lectura cualitativa. El usuario confirmó reclasificar el 4 de septiembre de 2026 |
| 33 | ✅ CPX1 | Resumen semanal proactivo | Copiloto 2 | M | Alto | Hecho — `cpx1WeeklyPriorityAction()` añade la próxima mejor acción de `CP1` (mismo catálogo de fuentes E9 y validador de citas `CP3` que ya usa p2-ui.js) como cabecera de «Estado de la semana» (TRACK-3), antes de sus tres lecturas pasivas. `A5-4` (push) sigue sin backend real — se omite en vez de simular una integración que no existe |
| 34 | ✅ CPX2 | Modo segunda opinión para decisiones externas | Copiloto 2 | M | Alto | Hecho — `cpx2SecondOpinionResult()` en Ajustes: para una decisión externa (todavía no un objeto formal de `escenarioMotorDecisions`) el hogar declara solo su impacto mensual en caja, y se pasa por el plan base (`A8-2`) y por el mismo escenario de tensión de `CP6` (ingresos ×0,9, gastos ×1,1) — nunca bloquea, solo informa |
| 35 | ✅ FCX1 | Rescate de pensiones modelado | Fiscalidad 2 | M | Alto | Hecho — `marginalTaxOnAdditionalIncome()` (`canonical-irpf-estimator.js`): coste marginal de un rescate en forma de capital sumado a la renta general, por tramos reales si las dos escalas están registradas (`A15-2`), o con el tipo marginal declarado como respaldo (`A15-4`/`A15-1`). No modela reducciones por antigüedad de las aportaciones ni la modalidad en forma de renta — fuera de alcance sin inventar reglas de transitoriedad que la app no registra |
| 36 | ✅ LPX1 | Calculadora de independencia financiera | Patrimonio y vida | M | Alto | Hecho — `financialIndependenceTarget()` (`canonical-assets.js`): capital objetivo = gasto anual (previsión viva, `A7-1`) ÷ tasa de retirada que declara el hogar (sin un 4% por defecto), frente al patrimonio neto `A14-2` |
| 37 | ✅ LPX2 | Runway patrimonial completo | Patrimonio y vida | M | Alto | Hecho — `netWorthRunway()` (`canonical-assets.js`): meses de patrimonio neto completo (`A14-2`) frente al colchón líquido de `DLX1`, con aviso de qué % es inmueble/vehículo/pensión (`A14-4`) y por tanto no gastable sin vender |
| 38 | ⚠️ IVX1 | Multidivisa y exposición cambiaria | Inversión 2 | M | Medio | Reclasificada — ninguna posición de cartera (`IV1`) ni activo (`A14-1`) guarda una divisa hoy: todo se asume en euros. Construirla de verdad exige una dimensión nueva (divisa por posición) y un tipo de cambio que el hogar declararía a mano y tendría que mantener actualizado (la app funciona sin red, por diseño, sin cotizaciones en vivo). El usuario confirmó reclasificar el 4 de septiembre de 2026 |
| 39 | ⚠️ IVX5 | Máxima caída (drawdown) y tiempo de recuperación | Inversión 2 | M | Medio-Alto | Reclasificada — la app solo guarda el valor actual de cada posición, sin histórico de valoraciones intermedias (mismo hueco que ya reconoce IV2 para el TWR real). Sin esa serie temporal no hay drawdown que calcular sin inventarlo; usar las fechas de aportaciones/disposals como proxy daría una cifra con apariencia de precisión pero de fondo engañosa. Bloqueada hasta que se decida construir un registro de valoraciones periódicas por posición — decisión de producto aparte, no colada dentro de esta fila |
| 40 | ✅ IVX6 | Glide path de aportaciones por horizonte | Inversión 2 | M | Medio | Hecho — primero se construyó el vínculo posición↔objetivo que no existía (`goalId` opcional en `IV1`, decisión explícita del usuario), y sobre él `glidePathForGoal()` (`canonical-portfolio.js`) da la banda de horizonte (crecimiento/transición/conservador) por objetivo con fecha (`A10-1`). Nunca recomienda qué posición concreta ajustar: esta app no clasifica el riesgo/volatilidad por posición, así que no hay dato para respaldar esa precisión |
| 41 | ✅ MDX1 | Vista educativa para hijos | Multidispositivo | M | Medio | Hecho — tercer `viewType` («kids-summary») del mecanismo de enlace de `A19-1`, sin motor de compartición nuevo: `redactKidsSummaryView()` (`canonical-share-link.js`) solo expone colchón y patrimonio neto (`A14-2`, vía `lpNetWorthSnapshot`), redondeados, sin ninguna cuenta ni movimiento. La dependencia de `A5-3` ya no era un hueco (RGX1/RGX2, sesión 140) |
| 42 | ✅ APX2 | Crédito con garantía de cartera (Lombard) | Apalancamiento 2 | M-L | Medio | Hecho — `lombardCreditCapacity()` (`canonical-leverage-simulator.js`): capacidad de crédito contra la cartera real (`IV1`) a un LTV declarado por el hogar, nunca un LTV "típico" inventado. Fuera del guardarraíl `AP4` a propósito (perfil de riesgo distinto al de la deuda sin garantizar). Primer paso de `APX3` (Bloque 4), que todavía no modela el riesgo de ejecución de garantía |

### Bloque 4 — Segunda capa: depende de una tarea de esta misma oleada (3 tareas, nivel 1)

| Orden | ID | Tarea | Origen | Esfuerzo | Beneficio | Nota |
|---|---|---|---|---|---|---|
| 43 | APX3 | Simulador de ejecución de garantía (margin call) | Apalancamiento 2 | L | Crítico | Depende de `APX2` (Bloque 3) y `A8-1`; extiende el guardarraíl `AP4` al nuevo instrumento — pendiente, dejada para una sesión con más margen (decisión explícita del usuario el 5-sep) |
| 44 | ✅ DLX2 | Regla de reparto automático del excedente | Deuda-liquidez | M | Alto | Hecho — `surplusAllocationRule()` (`canonical-cushion.js`): reserva primero del excedente lo que hace falta para no perforar el suelo (`DLX1`) y reparte el resto según el veredicto ya calculado por `AP1`; sin veredicto claro, la parte libre queda sin repartir en vez de un 50/50 inventado |
| 45 | ✅ DLX3 | Retrospectiva de «¿me habría quedado sin colchón?» | Deuda-liquidez | M | Medio | Hecho — `cushionRetrospective()` (`canonical-cushion.js`): reconstruye la liquidez de cada mes conciliado hacia atrás desde la liquidez de hoy, con el mismo historial real de `PVX1` y el suelo VIGENTE (nunca uno histórico, que la app no guarda versionado); aproximación declarada, no reconstruye traspasos puntuales entre cuentas |

### Bloque 5 — Grandes apuestas: coste alto, mejor con lo anterior ya asentado (5 tareas, nivel 0-1, L)

| Orden | ID | Tarea | Origen | Esfuerzo | Beneficio | Nota |
|---|---|---|---|---|---|---|
| 46 | ESX1 | Monte Carlo de miles de trayectorias | Escenarios 2 | L | Alto | Amplía `prudentSimulation()` (`canonical-e13-scenarios.js`, `A8-3`); validar coste contra `OPT-5` |
| 47 | PVX5 | Árbol causal navegable de una cifra | Previsión viva 2 | M-L | Medio | Depende de `PV5` y `A7-3` |
| 48 | ESX3 | Escenario inverso: «¿qué tendría que cambiar?» | Escenarios 2 | L | Alto | Depende de `A8-6` y `PV6` |
| 49 | IVX3 | Activos alternativos | Inversión 2 | L | Medio | Depende de `A14-1` |
| 50 | FCX2 | Simulador de cambio de residencia fiscal | Fiscalidad 2 | L | Bajo-Medio, oportunista | Depende de `A15-1` y `A15-5`; solo si el hogar se lo plantea de verdad |

### Bloque 6 — Condicionadas a que `E10` cierre `A5-1` en producción (2 tareas)

No se descartan ni se aplazan a una fecha: se ejecutan en cuanto `A5-1` pase de «implementado
localmente» a activo de verdad. `DEX6` ya cuenta en el Bloque 1 por pertenecer temáticamente a la
entrada de datos priorizada; se repite aquí solo como referencia de su condición real.

| ID | Tarea | Origen | Esfuerzo | Beneficio | Nota |
|---|---|---|---|---|---|
| DEX6 | Extracto completo por foto o PDF | Entrada de datos | L | Alto | Ver Bloque 1, fila 11 |
| RGX3 | Panel de auditoría de la IA opcional | Continuidad e IA | M | Crítico | Depende de `A5-1`; condición de confianza para activarlo, no una mejora posterior |

## 3. Nota de alcance

Este backlog es una propuesta de producto, no una entrega verificada. Ninguna de las 51 tareas anteriores
tiene código asociado todavía; se incorpora al ciclo de trabajo habitual (`PROJECT_STATE.md`) en el
momento en que se decida empezar a ejecutarla. Ninguna depende de `OPT-10`, `OPT-11`, `OPT-12`, `OPT-13`
ni `OPT-15` (el remanente real de `BACKLOG_ULTIMATE_SEPTIEMBRE.md`, ver §0) — ambas colas pueden avanzar
en paralelo sin bloquearse entre sí.

## 4. Puerta de aceptación de cada entrega

Igual que en `BACKLOG_ULTIMATE_SEPTIEMBRE.md` y `BACKLOG_PATRIMONIO_Y_FINANZAS.md` §10: pruebas en
verde, apertura de una copia de la versión anterior, funcionamiento sin red ni servicios externos,
ausencia de escrituras durante simulaciones y vistas previas, comparación antes/después con confirmación
explícita, explicación de origen/fecha/método/confianza en toda cifra nueva, validación visual en
escritorio y móvil, y documentación de estado alineada al cierre.
