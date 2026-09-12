# Backlog Ultimate Septiembre — Oleada 4

> Mapa de todos los backlogs del repositorio: [`BACKLOG_INDICE.md`](BACKLOG_INDICE.md).
> Continuación de [`BACKLOG_ULTIMATE_SEPTIEMBRE_OLEADA_3.md`](BACKLOG_ULTIMATE_SEPTIEMBRE_OLEADA_3.md) —
> no la sustituye ni reabre ninguna de sus 44 tareas, y extiende sus mismos prefijos (`PVC`, `INV`,
> `LEV`, `DEB`, `GOB`) en vez de inventar unos nuevos.

Fecha de creación: 11 de septiembre de 2026. Repositorio vivo: `javierbarriusom-a11y/contabilidadcasa`.

**Estado (sesión 167, 12 de septiembre de 2026): segunda oleada construida.** Bloque 1 completo
(`VER-4`, `VER-5`, `VER-6`, sesión 166b) y Bloque 2 completo (`LEV9`, `DEB9`, sesión 166b). Además,
`DEB10` y `GOB17` construidas de punta a punta (sesión 167) — las dos tareas de tamaño moderado cuyo
alcance ya confirmaba el Bloque 1. Quedan 41 tareas accionables: `PVC12` (candidata a sesión propia,
consolidación de mayor calado) y los Bloques 3-7 completos.

## 0. Por qué existe este documento

Con la Oleada 3 cerrada (43/44), el hogar pidió una segunda auditoría crítica de producto sobre los
mismos cuatro frentes que motivaron aquella — previsión que se autoajuste con datos reales, inversión,
apalancamiento (pedir deuda para invertir) y decidir cancelar deuda existente o no según el líquido
real — pidiendo esta vez más de 40 propuestas nuevas y profundidad especial en previsión autoajustable
y en apalancamiento/deuda.

Esa auditoría se hizo primero como documento independiente — **["El Libro Vivo"](https://claude.ai/code/artifact/b30b9e52-c0fd-42d9-a993-2ef6625a40ad)**, sesión del 11 de
septiembre de 2026 — con diez hallazgos de diagnóstico y 49 propuestas nuevas, contrastadas contra el
código real (`app.js` y los 60 módulos `canonical-*.js`), no contra la documentación de backlog.

**Este documento traslada esas 49 propuestas a formato de backlog ejecutable**, cruzándolas primero
contra `BACKLOG_ULTIMATE_SEPTIEMBRE_OLEADA_3.md` — que se cerró dos días antes de esta auditoría y
cubría exactamente los mismos cuatro frentes, así que era el solapamiento más probable. Ese cruce
encontró que **4 de las 49 ya estaban construidas** (`PA-4`≈`PVC9`, `AP-8`≈`LEV8`, `O-3`≈`GOB9`,
`O-8`≈`LEV1`) y que **otras 7 necesitan reducir su alcance** porque una pieza de la que dependían ya
existe y solo falta la parte que de verdad falta. Se documentan igualmente todas — retiradas y
reducidas incluidas — por el mismo motivo que ya se dio en la Oleada 3: decir "esto ya existe" es tan
útil como decir "esto hace falta construirlo".

**Quedan 45 tareas accionables** (38 con el alcance íntegro de la propuesta original + 7 de alcance
reducido) más 3 verificaciones de código previas, en los mismos cinco frentes que ya usa la Oleada 3:

| Prefijo | Frente | Continúa desde |
|---|---|---|
| `PVC` | Previsión viva y auto-ajuste continuo | `PVC1`-`PVC10` |
| `INV` | Inversión y patrimonio | `INV1`-`INV10` |
| `LEV` | Apalancamiento — pedir deuda para invertir | `LEV1`-`LEV8` |
| `DEB` | Optimizar deuda existente y nueva según liquidez | `DEB1`-`DEB8` |
| `GOB` | Gobierno de producto y transversal | `GOB1`-`GOB10` |

El detalle de **qué problema resuelve cada tarea, por qué hace falta y su mecanismo propuesto** vive en
["El Libro Vivo"](https://claude.ai/code/artifact/b30b9e52-c0fd-42d9-a993-2ef6625a40ad) bajo su ID
original (columna "Origen" de cada tabla) — este documento no repite esa prosa, solo la convierte en
tareas accionables, ordenadas y con su relación exacta con el código de la Oleada 3 ya construido.

Ninguna tarea de este documento ejecuta una acción financiera real sin confirmación explícita del
hogar — mismo contrato que `A11-4` y que toda la Oleada 3 ya respetan.

## 1. Cómo se ha calculado el orden

Mismo criterio que las Oleadas 2 y 3: nivel de dependencia primero, esfuerzo después, beneficio al
final, con las verificaciones de código antes que cualquier construcción.

## Leyenda

Igual que `BACKLOG_ULTIMATE_SEPTIEMBRE_OLEADA_3.md` §1 (Esfuerzo S/S-M/M/M-L/L, Beneficio
Bajo/Medio/Alto/Crítico) más el mismo juego de estados: ⏳ pendiente · 🔍 verificación previa ·
⚠️ alcance reducido · ⚪ retirada · ✅ hecho.

---

## 2. Bloque 1 — Verificación previa obligatoria (3 tareas, esfuerzo S, solo lectura de código)

Igual que `VER-1` a `VER-3` en la Oleada 3: no construyen nada, deciden el alcance real de la tarea que
depende de cada una.

| ID | Verificación | Qué decide |
|---|---|---|
| ✅ `VER-4` | **Hecho (sesión 166b): NO está cableada.** `surplusAllocationRule()` (`canonical-cushion.js:195`) solo reparte el excedente en `toDebt`/`toInvestment`/`toCushion` según el veredicto de AP1 — nunca elige QUÉ deuda concreta amortizar. `dimensionOptimalPrepayment()` (DEB2, `app.js` función `deb2DimensionHtml`) dimensiona el importe sobre la deuda que el hogar **selecciona a mano** en `#ap1DebtSelect`, sin consultar `fiscalAdjustedDebtPriority()` en ningún punto. Esta última solo se muestra, aislada, en Deuda › Contratos (`renderDeb5FiscalPriority`). Alcance final de `DEB10` confirmado: **cableado completo**, no un simple aviso. | Alcance final de `DEB10` (antes `DE-2`): cableado completo (ver nota de `DEB10` abajo). |
| ✅ `VER-5` | **Hecho (sesión 166b): NO cita la función real.** `validateResponse()` (`canonical-e9-assistant.js:54`) exige un array `citations` y verifica que cada id exista en `sourceCatalog()`, pero esos ids son categorías genéricas del modelo de lectura (`metric:idle-cash`, `alert:cash`, `decision:X`) — nunca el nombre del archivo/función `canonical-*.js` que sustenta el dato. El propio `metric()` de `executive-read-model.js` sí tiene campos `source`/`method` pensados para eso, pero `ExecutiveReadModel.build()` no se invoca desde ningún sitio de `app.js`, y las dos superficies que sí usan este vocabulario hoy (CP1/CP2 en `p2-ui.js`) construyen sus fuentes sin rellenar `source`/`method`. Alcance final de `GOB17` confirmado: **se construye completa**, no se retira. | Alcance final de `GOB17` (antes `O-9`): se construye completa (ver nota de `GOB17` abajo). |
| ✅ `VER-6` | **Hecho (sesión 166b): son dos motores independientes, sobre fuentes de datos distintas.** `categoryDriftWindows()` (`canonical-forecast.js:260`) lee de `pvc4CategoryHistoryRecords()` → solo meses YA CERRADOS y archivados (`loadCierreReportArchive()` + `registrarMesCollect()`), reconciliados contra el banco. `_detectMonthlySeasonality()` (`canonical-budget-forecast-category.js:87`), en cambio, se alimenta de `budgetHistoricalExpenseTransactions()` — transacciones vivas del mes en curso, no reconciliadas ni archivadas. Consolidar exige reconciliar dos fuentes de datos y dos criterios de "mes válido" distintos, no solo recablear una llamada. Alcance final de `PVC12` confirmado: **auditoría/consolidación de alcance mayor** que un simple recableado — candidata a sesión propia, no a esta primera oleada. | Alcance final de `PVC12` (antes `PA-2`): consolidación de alcance mayor (ver nota de `PVC12` abajo). |

---

## 3. Retiradas — ya construidas en la Oleada 3 (4 tareas, referencia)

Se documentan por el mismo motivo que `FCX2` (Oleada 2) y las 5 retiradas de la Oleada 3: decir
explícitamente por qué no se construyen evita que alguien las retome sin saber que ya existen.

| ID | Tarea propuesta (Libro Vivo) | Motivo de retirada |
|---|---|---|
| ⚪ `PA-4` | Changelog legible de por qué cambió tu previsión | Ya construida: `previsionChangeOneLiner()` (`PVC9`, Oleada 3, Bloque 5) combina el árbol causal de `PVX5` con `detectStructuralChange()` en una frase visible junto a la tarjeta del árbol causal. |
| ⚪ `AP-8` | Bitácora de la tesis de inversión apalancada | Ya construida: `LEV8` (Oleada 3, Bloque 5) captura qué se espera ganar, a qué horizonte y qué invalidaría la decisión (`lev8ThesisHtml`) al marcar un escenario de `AP3` como tomado, y lo conserva como registro histórico. |
| ⚪ `O-3` | Meses de cobertura ante shock de empleo, como métrica única | Ya construida: `resilienceMonths()` (`GOB9`, Oleada 3, Bloque 3) combina liquidez real, cuota de deuda y el escenario de tensión de E13 en un único número de meses. |
| ⚪ `O-8` | Presupuesto de riesgo extendido a límite de apalancamiento total | Ya construida: `evaluateLeveragePolicy()` (`LEV1`, Oleada 3, Bloque 2) — límite declarado de deuda-para-invertir sobre patrimonio/ingreso, informativo, nunca bloquea. |

---

## 4. Bloque 2 — Cimiento: las dos banderas del diagnóstico (2 tareas, L)

Los dos hallazgos que "El Libro Vivo" marca como más caros (`F-07` y `F-10`) — ninguno tiene precedente
en la Oleada 3, ambos son integración pura de piezas ya construidas y probadas.

| Orden | ID | Tarea | Origen | Esfuerzo | Beneficio | Nota |
|---|---|---|---|---|---|---|
| 1 | ✅ `LEV9` | Comparador cruzado de instrumentos de apalancamiento (Lombard / hipoteca / línea de crédito) para una misma necesidad de capital | `AP-1` | L | Crítico | **Hecho (sesión 166b).** `crossInstrumentLeverageComparison()` (`canonical-leverage-cross-comparator.js`) cruza, sin reimplementar ninguna fórmula, `lombardCreditCapacity` (APX2), la misma cuota francesa que `canonical-mortgage-rate-scenarios.js` (hipoteca/ampliación) y `evaluateEmergencyCreditLine` (DI2, reutilizada con el importe necesitado como "suelo" a cubrir). Marca qué guardarraíl aplica a cada instrumento (`ap4Applies: false` en Lombard, `true` en hipoteca/línea de crédito; `LEV1` informativo en los tres) y señala el más barato de los disponibles, sin capacidad suficiente en ningún caso. Tarjeta nueva en Ajustes › Deuda y apalancamiento, entre APX3 y el comparador AP1. Tests: `tests/lev9-comparador-cruzado-apalancamiento.test.cjs`. |
| 2 | ✅ `DEB9` | Síntesis única "cancelar vs. mantener deuda", con las cuatro piezas visibles | `DE-1` | L | Alto | **Hecho (sesión 166b).** `cancelOrHoldDebtSynthesis()` (`canonical-debt-cancel-or-hold-synthesis.js`) cruza el veredicto de AP1 con `netDebtCostAfterTax` (APX1), `waitingOptionValue` (DEB3), `dimensionOptimalPrepayment` (DEB2) y `liquidityLadder` (INV7) en una sola lectura, con las cuatro piezas siempre citadas por separado — nunca combinadas en una única cifra "mejorada" (mismo criterio que la advertencia de `PVC14`, §11). El guardarraíl de colchón (DLX1) manda primero: en `insostenible`, ninguna otra pieza puede recomendar cancelar. Se recalcula con el mismo botón «Comparar» de AP1, sin pedir ningún campo nuevo. Tarjeta nueva justo debajo del comparador AP1. Tests: `tests/deb9-sintesis-cancelar-mantener-deuda.test.cjs`. |

---

## 5. Bloque 3 — Previsión viva (9 tareas, continúa `PVC`)

| Orden | ID | Tarea | Origen | Esfuerzo | Beneficio | Nota |
|---|---|---|---|---|---|---|
| 3 | ⏳ `PVC11` | Recalibración incremental por movimiento conciliado, no solo al cerrar el mes | `PA-1` | M | Alto | Hoy el único gatillo de `learnFromHistory()` es `recalibrateForecastLearning()` en el cierre mensual (`app.js:4980`). Contador visible de "desviación en construcción" desde el último aprendizaje, sin aplicar nada hasta confirmación — misma disciplina que `applyLearnedBias`. |
| 4 | ⚠️ `PVC12` | Consolidar los mecanismos de estacionalidad/deriva por categoría | `PA-2` | M-L | Alto | Alcance confirmado por `VER-6` (sesión 166b): `categoryDriftWindows()` (PVC4) y `_detectMonthlySeasonality()` leen de fuentes distintas — la primera solo meses cerrados y reconciliados (`registrarMesCollect`), la segunda transacciones vivas del mes en curso. Consolidar exige reconciliar dos fuentes de datos y dos criterios de "mes válido", no solo recablear una llamada — candidata a sesión propia dedicada, no a esta primera oleada. |
| 5 | ⏳ `PVC13` | Cerrar el bucle de `predictionQuality()`: que el error medido ensanche o estreche `confidenceBands()` | `PA-3` | M | Crítico | Ningún mecanismo de la Oleada 3 cierra este bucle: `PVC2` reparte la banda ya calculada entre categorías por varianza, pero no usa el MAE/sesgo medido por `predictionQuality()` para ajustar nada. Sigue siendo el hallazgo más caro de previsión (`F-02`). |
| 6 | ⏳ `PVC14` | Ensemble ponderado y visible entre histórico, manual y Monte Carlo | `PA-5` | L | Alto | Los tres métodos actúan aislados hoy; la ponderación debe mostrarse siempre ("60% histórico, 40% tu estimación manual"), nunca ocultarse tras una cifra "mejorada" — ver también la advertencia en el Bloque 6. |
| 7 | ⏳ `PVC15` | Alerta de "supuesto caducado" | `PA-6` | S | Medio | Umbral de antigüedad por tipo de supuesto sobre `buildAssumptionRegistry()`; distinto de `PVC7` (caducidad de un *escenario guardado* frente al forecast actual) — aquí es la antigüedad de un *supuesto individual* (tipo de interés, salario) frente a su propia fecha de confirmación. |
| 8 | ⏳ `PVC16` | Marcar eventos no recurrentes para que no contaminen el sesgo aprendido | `PA-7` | M | Medio | Complemento simétrico de `detectStructuralChange` (`PVC3`, busca persistencia): aquí se excluye explícitamente un mes marcado como excepcional del cómputo de `learnFromHistory()`. |
| 9 | ⏳ `PVC17` | Índice único de "salud predictiva", con tendencia | `PA-8` | S | Medio | Agrega el MAE ponderado de todas las categorías de `canonical-e16-monitoring.js` en una sola cifra con tendencia — hoy la info existe dispersa por categoría, nunca como número único. |
| 10 | ⚠️ `PVC18` | Etiquetar la causa de cada cambio de previsión: dato nuevo, supuesto editado o modelo recalibrado | `PA-9` | S-M | Medio | Alcance reducido: `PVC6` (Oleada 3) ya compara "qué preveíamos entonces vs. ahora" con `diffAssumptionSnapshots()`. Falta solo la etiqueta explícita de causa sobre esa comparación ya existente, no un motor de comparación nuevo. |
| 11 | ⏳ `PVC19` | El cono de incertidumbre debe verse como un cono, no como una banda de grosor fijo | `PA-10` | S | Medio | `confidenceBands()` ya calcula un margen creciente con `√(mes+1)`; es una corrección de renderizado del gráfico existente, no de cálculo. |

---

## 6. Bloque 4 — Inversión (10 tareas, continúa `INV`)

| Orden | ID | Tarea | Origen | Esfuerzo | Beneficio | Nota |
|---|---|---|---|---|---|---|
| 12 | ⏳ `INV11` | Tratar el plan de pensiones como una posición de cartera más | `IN-1` | L | Alto | `canonical-pension-simulator.js` sigue sin XIRR real, sin rebalanceo y sin glide path — ningún cambio de la Oleada 3 lo conectó. |
| 13 | ⏳ `INV12` | Formalizar `fundingPositions` en el schema del objetivo, no como campo de fortuna | `IN-2` | M | Medio | `goalId` sigue sin formar parte de `normalizePosition()` ni de `canonical-e15-goals.js`, pese a que `INV1` (Oleada 3) ya usa un campo raw equivalente (`position.assetClass`) con el mismo patrón de fortuna. |
| 14 | ⏳ `INV13` | Proyección fiscal de la aportación periódica (DCA) | `IN-3` | M | Alto | `INV8` (Oleada 3) solo compara aportado vs. planificado; no simula el impacto fiscal futuro de vender esas aportaciones — se apoya en `optimizePartialSale` y `yearEndCompensation`, ya existentes. |
| 15 | ⏳ `INV14` | Exposición declarada por divisa y geografía | `IN-4` | S | Medio | Cero campos de divisa/región en `POSITION_TYPES`; declarativo, no derivado de mercado, coherente con el resto del módulo. |
| 16 | ⏳ `INV15` | Coste total de propiedad real por posición (custodia + corretaje) | `IN-5` | S | Medio | `compoundedFeeCost` (`IVX4`) solo cubre TER/gestión declarado. |
| 17 | ⏳ `INV16` | Correlación declarada, cualitativa, entre clases de activo | `IN-6` | M | Medio | El código descarta correlación cuantitativa por falta de histórico real (decisión correcta, documentada) — esto es una alternativa declarativa para avisos de concentración, nunca un cálculo con apariencia de precisión falsa. |
| 18 | ⏳ `INV17` | Revisión de rebalanceo por calendario, no solo por umbral | `IN-7` | S | Medio | `INV2` (Oleada 3) solo dispara alerta al cruzar el 10% de desviación; una cartera que se desalinea despacio nunca lo cruza en un salto. |
| 19 | ⏳ `INV18` | Vista única "¿de qué posición y cuándo saco X€ más barato?" | `IN-8` | L | Alto | Cruza `optimizePartialSale`, `marginalTaxOnAdditionalIncome` y el calendario de objetivos — hoy sueltos. |
| 20 | ⏳ `INV19` | El coste de no tocar tu cartera nunca, a 10-20 años, en un gráfico | `IN-9` | S | Bajo-Medio | `compoundedFeeCost` da un número puntual; falta la trayectoria compuesta visual. |
| 21 | ⚠️ `INV20` | Permitir anular la liquidez inferida por tipo con un valor declarado por posición | `IN-10` | S | Medio | Alcance reducido: `INV7` (Oleada 3, `liquidityLadder`) ya clasifica cada posición por tipo en tres franjas (inmediata/corta/sin clasificar). Falta solo la anulación declarada cuando el tipo no refleja la liquidez real de una posición concreta (p. ej. un ETF de nicho menos líquido que uno indexado grande) — no un campo obligatorio nuevo. |

---

## 7. Bloque 5 — Apalancamiento (7 tareas, continúa `LEV`)

`LEV9` (comparador cruzado) ya está en el Bloque 2 como bandera; el resto sigue aquí.

| Orden | ID | Tarea | Origen | Esfuerzo | Beneficio | Nota |
|---|---|---|---|---|---|---|
| 22 | ⏳ `LEV10` | Curva de coste marginal de deuda por tramo | `AP-2` | M | Medio | Tramos declarados por el hogar según ofertas reales de su banco — no una curva de mercado inventada. |
| 23 | ⚠️ `LEV11` | Política de desapalancamiento preventivo por drawdown, antes del margin call | `AP-3` | M | Alto | Alcance reducido: `LEV6` (Oleada 3, `deleveragingPriority()`) ya resuelve *qué vender primero* al desapalancar. Falta solo la regla de *cuándo y cuánto* activar esa priorización de forma preventiva por umbral de caída de cartera — reutiliza `LEV6` para la ejecución, no la reconstruye. |
| 24 | ⏳ `LEV12` | Alertas proactivas de LTV, no solo simulación bajo demanda | `AP-4` | M | Alto | Toda la vigilancia de LTV sigue siendo bajo demanda (`lombardMarginCallSimulation`); ningún cambio de la Oleada 3 la hizo proactiva. Reutiliza el patrón de alertas de A11. |
| 25 | ⏳ `LEV13` | Sensibilidad del veredicto de apalancarse: punto de cruce exacto por bisección | `AP-5` | M | Alto | Aplica la misma bisección exacta de `inverseScenario` (forecast general) sobre `simulateLeverage`, en vez de un método nuevo. |
| 26 | ⏳ `LEV14` | Apalancamiento parcial escalonado (dollar-cost leverage) | `AP-6` | M | Medio | Simetría con `INV8`/DCA, aplicada ahora al lado de la deuda. |
| 27 | ⏳ `LEV15` | Coste comparado en euros y efecto fiscal de las dos salidas del margin call | `AP-7` | S | Alto | `lombardMarginCallSimulation` lista aportar garantía vs. liquidación forzosa sin comparar su coste; se apoya en `optimizePartialSale` para el efecto fiscal de una liquidación forzosa. |
| 28 | ⏳ `LEV16` | El coste de oportunidad de NO apalancarse, simétrico al riesgo de apalancarse | `AP-9` | S | Medio | Todo el módulo enmarca la pregunta solo desde el riesgo de apalancarse; falta el lado simétrico de mantener liquidez ociosa sin invertir ni apalancar. |

---

## 8. Bloque 6 — Deuda según liquidez (8 tareas, continúa `DEB`)

`DEB9` (síntesis cancelar/mantener) ya está en el Bloque 2 como bandera; el resto sigue aquí.

| Orden | ID | Tarea | Origen | Esfuerzo | Beneficio | Nota |
|---|---|---|---|---|---|---|
| 29 | ✅ `DEB10` | Al amortizar, priorizar automáticamente qué deuda concreta primero | `DE-2` | M | Alto | **Hecho (sesión 167).** `deb10PriorityHint()` (`app.js`) reutiliza `fiscalAdjustedDebtPriority()` (DEB5) sobre `debtContractSourceRows()`, sin motor propio. Compara la deuda #1 por TAE efectivo tras deducción fiscal contra la seleccionada en `#ap1DebtSelect`: si coincide, lo confirma; si no, avisa cuál sería la de mayor coste real — nunca la preselecciona en silencio, la elección final sigue siendo del hogar. Se muestra en cada «Comparar» de AP1. Tests: `tests/deb10-prioridad-fiscal-sugerida-ap1.test.cjs`. |
| 30 | ⏳ `DEB11` | Amortización parcial: reducir cuota vs. reducir plazo, como decisión explícita | `DE-3` | M | Alto | `dimensionOptimalPrepayment` (`DEB2`) dimensiona el importe, no desglosa esta segunda decisión, igual de real. |
| 31 | ⏳ `DEB12` | El precio de esperar (`waitingOptionValue`) como serie temporal, no cifra congelada | `DE-4` | M | Medio | Reutiliza el patrón de "comparación trackeada" que `DEB1` ya usa para el veredicto de `AP1`, aplicado ahora a `DEB3`. |
| 32 | ⏳ `DEB13` | Alerta de "deuda cara dormida" | `DE-5` | S | Alto | `DEB5` prioriza, pero no alerta cuando una TAE está muy por encima de cualquier rentabilidad esperada declarada en la cartera — cruce automático nuevo con `compareAmortizeVsInvest`. |
| 33 | ⚠️ `DEB14` | Alerta de "llevas N meses sin comparar tu hipoteca contra una oferta de mercado registrada" | `DE-6` | S | Medio | Alcance reducido: `DEB4` (Oleada 3) ya avisa proactivamente cuando el punto de equilibrio de los *propios* escenarios de tipos cruza un umbral — un ángulo distinto ("tu cálculo cambió") al de esta tarea ("no has mirado el mercado"), que usa el registro de ofertas externas (`normalizeOffer`) que `DEB4` no consulta. |
| 34 | ⏳ `DEB15` | Guardarraíl de liquidez a 3-6 meses tras una cancelación total, no solo en el instante | `DE-7` | M | Crítico | Antes de ejecutar, simula el colchón resultante los meses siguientes con el propio forecast — hoy solo se mira el saldo del día de la cancelación. |
| 35 | ⏳ `DEB16` | Avalancha vs. bola de nieve, como preferencia declarada para el orden entre varias deudas | `DE-8` | S | Medio | Distinto de `DEB7` (preferencia agregada costo-mínimo vs. libre-de-deudas sobre el veredicto de `AP1`): aquí la pregunta es el *orden* entre varias deudas simultáneas, no la preferencia general. `simulateDebtConsolidation` (`DEB6`) da el coste, no el orden. |
| 36 | ⏳ `DEB17` | Test de estrés de la cancelación (escenario de tensión inmediatamente después) | `DE-9` | M | Alto | Reutiliza el escenario de tensión ya calibrado en `canonical-e13-scenarios.js`; hoy cancelar solo se evalúa contra el escenario base. |

---

## 9. Bloque 7 — Catálogo adicional (9 tareas, continúa `GOB`)

| Orden | ID | Tarea | Origen | Esfuerzo | Beneficio | Nota |
|---|---|---|---|---|---|---|
| 37 | ⏳ `GOB11` | Proyección de jubilación unificada (pensión + cartera + forecast + objetivos) | `O-1` | L | Alto | Depende en la práctica de `INV11` (pensión conectada a cartera) para dar una trayectoria real, no solo patrimonio bruto. |
| 38 | ⏳ `GOB12` | Plantilla reutilizable de "evento de vida" (hijo, mudanza, cambio de trabajo) | `O-2` | M | Medio | Paquete de gasto recurrente + posible caída temporal de ingreso + objetivo nuevo, en vez de modelar cada evento a mano. |
| 39 | ⏳ `GOB13` | Ritual anual de revisión guiada | `O-4` | M | Medio | Complementa, no repite, `GOB6` (checklist *mensual* de cierre): fuerza revisar en un solo sitio, una vez al año, supuestos caducados (`PVC15`), ofertas de deuda sin comparar (`DEB14`) y desviación de cartera (`INV17`). |
| 40 | ⏳ `GOB14` | Informe trimestral exportable, maquetado para presentar a la familia | `O-5` | M | Bajo-Medio | Distinto de `GOB3` (resumen trimestral de `PROJECT_STATE.md`, uso interno de desarrollo): esta es una vista para enseñar, no para trabajar, con las cifras ejecutivas de procedencia (`A2-6`) ya existentes. |
| 41 | ⏳ `GOB15` | Simulador de vender la vivienda habitual y pasar a alquiler | `O-6` | L | Medio | Reutiliza `rentalAssetPnL()` (`INV9`, Oleada 3) para el lado del alquiler recibido/pagado. |
| 42 | ⏳ `GOB16` | Vigilancia de cláusulas de deuda más allá de TAE y capital | `O-7` | M | Medio | Acotado a lo que `DEB4`/`DEB8` (Oleada 3) no cubren: vinculación de productos, comisión de apertura de operación nueva, fecha de revisión de diferencial. |
| 43 | ✅ `GOB17` | El asistente cita siempre la función `canonical-*.js` real que sustenta su respuesta | `O-9` | M | Alto | **Hecho (sesión 167).** `sourceCatalog()` (`canonical-e9-assistant.js`) ahora propaga `source`/`method` también en alertas y decisiones, no solo en métricas (campos añadidos, ninguno retirado). CP1 declara `canonical-e16-monitoring.js` · `predictiveAlerts()`; CP2 declara `canonical-cushion.js` + `canonical-portfolio.js` · `cushionFloor()`/`opportunityCost()` vía `cp2IdleCashSummary` (`app.js`). Ambas citas reales se muestran al hogar junto al id interno, nunca en su lugar. Tests: `tests/gob17-cita-funcion-real.test.cjs`. |
| 44 | ⚠️ `GOB18` | Exportar un registro de `GOB10` como paquete de decisión (PDF) para un asesor externo | `O-10` | M | Bajo-Medio | Alcance reducido: `GOB10` (Oleada 3) ya generaliza el registro de tesis con revisión programada a cualquier decisión. Falta solo la capa de exportación/empaquetado, no un registro nuevo. |
| 45 | ⏳ `GOB19` | Plantilla de separación patrimonial combinando reparto y reestructuración | `O-12` | L | Medio | Combina `canonical-household-split.js` y `canonical-joint-restructuring.js`, hoy aislados, sin construir un tercer motor. |

---

## 10. Plan de ejecución sugerido

Mismo criterio de la propia auditoría original ("El Libro Vivo", sección de priorización), traducido a
los IDs de este backlog:

1. **Bloque 1 primero, sin excepción** (`VER-4`, `VER-5`, `VER-6`) — decide el esfuerzo real de tres
   tareas antes de estimarlas a ciegas, exactamente el motivo por el que la Oleada 3 puso sus propias
   verificaciones en primer lugar.
2. **Las dos banderas del Bloque 2** (`LEV9`, `DEB9`) son las de mayor impacto y ninguna depende de una
   decisión de alcance previa — candidatas naturales a ir justo después de las verificaciones.
3. **Bajo esfuerzo / alto impacto para hueco de sesión corta**: `PVC15`, `DEB13`, `LEV15` (`GOB17` ya
   construida en la sesión 167).
4. **Grandes apuestas (L), reservar sesión propia**: `INV11`, `INV18`, `PVC14`, `GOB11`, `GOB15`,
   `GOB19`.
5. **Cuestionar el alcance antes de construir, no descartar sin más** (mismo criterio que la propia
   auditoría aplicó a sí misma con `FCX2` en la Oleada 2): `PVC14` (el ensemble ponderado solo vale la
   pena si la ponderación queda siempre visible — ver advertencia), `INV16` (correlación declarada,
   nunca cuantitativa sin dato real), `LEV14` (dollar-cost leverage reparte el riesgo de *timing* pero
   también el de exposición — confirmar con el hogar antes del Bloque 5), `GOB15` (vender la vivienda
   habitual es una decisión de mucho mayor calado que el resto de esta lista).

## 11. Advertencia que se traslada íntegra desde "El Libro Vivo"

Ninguna tarea de este backlog debe automatizar la ejecución de una decisión de apalancamiento o
cancelación de deuda por alta que sea la confianza del modelo — `LEV9`, `DEB9` y `LEV11` en particular
están escritas para recomendar con evidencia, nunca para ejecutar solas, siguiendo el mismo contrato que
ya protege `A11-4` en el resto del proyecto. `PVC14` (ensemble ponderado) solo debe construirse si la
ponderación entre métodos queda siempre visible en la interfaz — combinar histórico, manual y Monte
Carlo en una única cifra "mejorada" sin mostrar de dónde sale cada parte genera falsa precisión, no
mejor previsión.
