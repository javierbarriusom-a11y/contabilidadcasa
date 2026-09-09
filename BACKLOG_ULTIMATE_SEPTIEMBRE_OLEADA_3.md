# Backlog Ultimate Septiembre — Oleada 3

> Mapa de todos los backlogs del repositorio: [`BACKLOG_INDICE.md`](BACKLOG_INDICE.md).
> Continuación de [`BACKLOG_ULTIMATE_SEPTIEMBRE_OLEADA_2.md`](BACKLOG_ULTIMATE_SEPTIEMBRE_OLEADA_2.md) —
> no la sustituye ni reabre ninguna de sus 51 tareas.

Fecha de creación: 6 de septiembre de 2026. Repositorio vivo: `javierbarriusom-a11y/contabilidadcasa`.

## 0. Por qué existe este documento

Con la Oleada 2 en 50/51 y `BACKLOG_OPERACION.md` en 100% salvo `O-6`, el hogar pidió una auditoría
crítica de producto centrada en cuatro frentes: que las previsiones se autoajusten con datos reales,
inversión, pedir deuda para invertir (apalancamiento) y decidir cancelar deuda existente o no según el
líquido real. Esa auditoría se hizo primero como documento independiente ("Motor de Decisión
Financiera", sesión del 6 de septiembre de 2026) con dos partes: un diagnóstico de seis hallazgos sobre
el estado real del código, y 46 propuestas nuevas.

**Este documento traslada esas 46 propuestas a formato de backlog ejecutable**, cruzándolas primero
contra el código real de la Oleada 2 — el mismo paso que ese propio diagnóstico exigía antes de
construir nada. Ese cruce encontró que **5 de las 46 ya estaban construidas** (`INV3`≈`IVX2`,
`INV5`≈`IVX4`, `LEV2`≈`APX1`, `GOB1`≈`OPT-2`/`OPT-10`, `GOB2`≈`OPT-11`/`12`/`13`) y que **otras 9
necesitan reducir su alcance** por el mismo hueco de datos que ya bloqueó `APX4`/`IVX1`/`IVX5` en la
Oleada 2 (sin serie histórica de valoraciones por posición ni clasificación de sector/divisa/clase de
activo, no hay correlación ni volatilidad de cartera que calcular sin inventar precisión). Se documentan
igualmente todas — retiradas y reducidas incluidas — porque decir "esto ya existe" o "esto no es
calculable así" es tan útil como decir "esto hace falta construirlo".

**Quedan 44 tareas accionables** (41 nuevas + 3 verificaciones previas obligatorias) en cinco frentes:

| Prefijo | Frente | Extiende |
|---|---|---|
| `PVC` | Previsión viva y auto-ajuste continuo | `PV1`-`PV6`, `PVX1`-`PVX5` |
| `INV` | Inversión y patrimonio | `IV1`-`IV8`, `IVX1`-`IVX8`, `FC1`-`FC5` |
| `LEV` | Apalancamiento — pedir deuda para invertir | `AP1`-`AP6`, `APX1`-`APX6` |
| `DEB` | Optimizar deuda existente y nueva según liquidez | `AP1`/`AP6`, `DLX1`-`DLX3` |
| `GOB` | Gobierno de producto y transversal | `A12`-`A13`, `A5-3`, `A5-4`, `A15` |

Ninguna tarea de este documento ejecuta una acción financiera real (comprar, vender, amortizar,
transferir) sin confirmación explícita del hogar — mismo contrato que `A11-4` ya establece para todo
el resto de la aplicación, y que el propio diagnóstico señaló como el único hallazgo ya bien resuelto.

## 1. Cómo se ha calculado el orden

Mismo criterio por defecto que el resto del backlog: nivel de dependencia primero, esfuerzo después,
beneficio al final. Con una desviación deliberada, igual que el Bloque 1 de datos en la Oleada 2:
**tres verificaciones de código van antes que cualquier construcción** (Bloque 2). No es burocracia —
es que este mismo cruce ya evitó construir 5 tareas completas que no hacían falta; las tres
verificaciones que siguen podrían evitar construir motor nuevo donde el mecanismo ya existe, exactamente
lo que pasó con `PVX3` en la Oleada 2 (recálculo instantáneo del forecast ya cubierto sin motor nuevo).

## Leyenda

| Esfuerzo | Significado |
|---|---|
| S | Cambio acotado, sin dominio de datos nuevo ni migración (incluye tareas de sola lectura/verificación) |
| S-M | Entre acotado y contrato pequeño |
| M | Contrato o integración pequeña, o refactor de una pantalla |
| M-L | Entre integración y dominio nuevo |
| L | Dominio de datos nuevo, migración, o decisión de alcance previa obligatoria |

| Beneficio | Significado |
|---|---|
| Bajo | Mejora marginal o de nicho |
| Medio | Impacto claro pero no crítico en uso diario o mantenimiento |
| Alto | Impacto directo en decisiones de dinero, retención, o habilita trabajo posterior |
| Crítico | Guardarraíl de seguridad, o corrige algo que hoy falta de forma arriesgada |

| Estado | Significado |
|---|---|
| ⏳ | Pendiente, alcance confirmado, sin código todavía |
| 🔍 | Verificación de código previa, obligatoria antes de decidir si construir la tarea que depende de ella |
| ⚠️ | Alcance reducido respecto a la propuesta original, por un hueco de datos ya documentado en la Oleada 2 |
| ⚪ | Retirada — ya construida en otra tarea, o sin hipótesis real que la sostenga |
| ✅ | Hecho — código construido y validado, con el PR real de referencia |

---

## 2. Bloque 0 — Cola heredada (no forma parte de esta oleada, no se renumera)

Sigue exactamente igual que en `BACKLOG_INDICE.md` — se repite aquí solo porque dos de las 46
propuestas nuevas (`GOB1`, `GOB2`) resultaron ser, sin saberlo al escribir la auditoría, la misma
tarea que ya vive en esta cola.

| Cola | Qué queda | Condición de desbloqueo | Quién la controla |
|---|---|---|---|
| `BACKLOG_ULTIMATE_SEPTIEMBRE.md` | `OPT-10`, `OPT-11`, `OPT-12`, `OPT-13`, `OPT-15` | Reloj de 30 días de `OPT-2` (arrancó 29 de agosto) | Calendario — cumple a finales de septiembre de 2026 |
| `BACKLOG_ULTIMATE_SEPTIEMBRE_OLEADA_2.md` | `RGX3` (Bloque 6) y `DEX6` (Bloque 1) | `A5-1` (IA) activo en producción real | Externa — activación de infraestructura, sin fecha conocida |
| `BACKLOG_OPERACION.md` | `O-6` (= `T-3` en `BACKLOG.md`) | Contratación de un proveedor PSD2 | Decisión de producto fuera del equipo de desarrollo |

`OPT-10` ("clasificar pantallas heredadas por uso real") es literalmente lo que la propuesta `GOB1`
pedía construir de cero. `OPT-11`/`OPT-12`/`OPT-13` (retirar cada heredada sin uso, migrar la función
real que le falta, y retirarla cuando esa migración esté cubierta) son literalmente lo que `GOB2`
pedía. Ninguna de las dos se repite como tarea nueva más abajo — quedan marcadas ⚪ en su lugar, con
el enlace de vuelta a este bloque.

---

## 3. Bloque 1 — Verificación previa obligatoria (3 tareas, esfuerzo S, solo lectura de código)

Ninguna construye nada. Cada una decide si la tarea de cimiento que depende de ella (Bloque 2) hace
falta completa, hace falta reducida, o no hace falta en absoluto — el mismo desenlace que tuvo `PVX3`
en la Oleada 2 (motor que ya existía, solo faltaba activarlo).

**Resueltas el 7 de septiembre de 2026** (sesión 157), por lectura de código — sin ejecución en
caliente, mismo nivel de rigor que el resto de verificaciones de esta familia de backlogs:

| ID | Verificación | Qué decide | Resultado |
|---|---|---|---|
| ✅ `VER-1` | ¿El forecast recalculado por `recomputeModelIfNeeded()` (`PVX3`) se repropaga a metas (`E15`/`A10-4`), plan de deuda (`E14b`/`AP1`), sostenibilidad de apalancamiento (`APX3`) y presupuesto de riesgo (`A11-5`) sin abrir esas pantallas? | Alcance final de `PVC1` | **Sí, se repropaga.** `recomputeModelIfNeeded()` (`app.js:7392`) corre en cada `render()` global (`app.js:35559`) y, por firma (`modelComputationSignature()`), repuebla `canonicalScenarioResults` (`app.js:7340`). `goalPlanning()` y `e16Input()` leen ese mismo objeto en directo (`app.js:27857-27858`, `27893`), sin caché propia que pueda quedar obsoleta. Único matiz: `APX3` no es un dato ambiental — es un simulador manual (`handleApx3MarginCallSimulate()`, `app.js:15987`) que exige una caída hipotética declarada a mano en cada uso, así que el criterio de "cascada automática" no le aplica igual que a metas/riesgo. **`PVC1` queda reducida** a añadir el indicador visible ("recalculado hace X") que hoy falta — el motor de cascada ya existe. |
| ✅ `VER-2` | ¿`AP1` (comparador amortizar-vs-invertir) ya se recalcula solo en cada cierre de mes, o solo cuando se abre su pantalla? | Alcance final de `DEB1` | **Sí, se recalcula solo.** `agentOptimalDebtPayoffPlan()` (`app.js:14366`) usa una clave de caché que se autoinvalida por firma (`agentDebtOptimizationCacheKey()`), además de limpiarse explícitamente en `recomputeModelIfNeeded()` (`app.js:7400`). **`DEB1` queda reducida** al aviso visible de cambio de veredicto entre cierres — no hace falta motor nuevo. |
| ✅ `VER-3` | ¿`FC3` (pérdidas pendientes de compensar, citado por `APX1`) ya identifica posiciones con pérdida **latente** (no vendida) candidatas a venta antes de cierre fiscal, o solo trackea pérdidas ya realizadas? | Alcance final de `INV6` | **No, `FC3` solo cubre pérdidas ya realizadas** — trabaja exclusivamente sobre ventas vía FIFO (`app.js:17919` y ss., "Solo transmisiones contra transmisiones"). **`INV6` se confirma, no se retira.** Esfuerzo real menor al estimado: el dato base (`gainLoss` no realizado por posición) ya lo calcula `fifoLedger()` en `canonical-portfolio.js:175` — `INV6` es filtrar y rankear posiciones con `gainLoss` negativo respetando la norma de no recompra, no un motor nuevo. |

---

## 4. Bloque 2 — Cimiento (3 tareas, nivel 0-1, condicionadas a las verificaciones)

| Orden | ID | Tarea | Origen | Esfuerzo | Beneficio | Nota |
|---|---|---|---|---|---|---|
| 1 | ✅ LEV1 | Política de apalancamiento del hogar | Apalancamiento | M | Alto | Hecho (sesión 157). Un límite máximo de deuda-para-invertir sobre patrimonio neto o ingreso anual, declarado por el hogar de antemano, con guardarraíl puro `evaluateLeveragePolicy()` (`canonical-leverage-barrier.js`) que compara ese límite contra la deuda de apalancamiento ya tomada (reutiliza `FinanceCanonicalLeverageSustainability.takenScenariosOf`, la misma fuente que ya vigila `AP6`) y contra lo que `AP3` esté explorando ahora. Tarjeta nueva en Ajustes › Deuda y apalancamiento; el simulador de `AP3` muestra el impacto sobre el límite antes de marcar una exploración como tomada. Como el guardarraíl de colchón (`DLX1`), nunca bloquea — solo informa. A propósito no cubre el crédito Lombard de `APX2`/`APX3`: su nota ya dejaba constancia de que ese instrumento queda fuera del guardarraíl general de deuda (`AP4`) por tener un perfil de riesgo distinto. |
| 2 | ✅ PVC1 | Indicador de recálculo visible (alcance confirmado por `VER-1`) | Previsión viva | S | Alto | Hecho (sesión 157). `VER-1` confirmó que el motor de cascada ya existe (`recomputeModelIfNeeded()` repropaga por firma a metas/riesgo sin caché obsoleta); marca `lastModelRecomputeAt` cuando recalcula de verdad (nunca en cada llamada), expuesta vía `FinanceP2Bridge.lastModelRecomputeAt()` y mostrada como "datos recalculados hace X" en los paneles de metas (E15) y seguimiento predictivo (E16, `p2-ui.js`). No incluye `APX3` (simulador manual, fuera de este patrón — ver `VER-1`). |
| 3 | ✅ DEB1 | Aviso de cambio de veredicto (alcance confirmado por `VER-2`) | Deuda-liquidez | S | Alto | Hecho (sesión 157). `VER-2` confirmó que `AP1` ya se recalcula solo por firma; guarda la última comparación real que el hogar miró (`ap1TrackedComparison`) y, en cada render, la recalcula con datos vivos (principal actual de la deuda, XIRR real de la cartera) para avisar si el veredicto cambió de sentido — visible en la propia tarjeta de AP1 sin tener que rellenar el formulario y pulsar «Comparar» de nuevo. |

---

## 5. Bloque 3 — Alto impacto, bajo riesgo (11 tareas, nivel 0-1, S/S-M/M, sin preguntas de alcance)

| Orden | ID | Tarea | Origen | Esfuerzo | Beneficio | Nota |
|---|---|---|---|---|---|---|
| 4 | ✅ PVC3 | Detector de cambio estructural vs. ruido | Previsión viva | M | Alto | Hecho (sesión 158). `detectStructuralChange()` (`canonical-forecast.js`) exige 2-3 meses consecutivos fuera de banda y en el mismo sentido, ADEMÁS de la confianza de 12 meses que ya exigía `applyLearnedBias` — sin esto, un mes atípico dentro de esos 12 meses podía seguir moviendo la base. Gate opcional (`options.structural`), nunca rompe el contrato de quien no lo pasa. |
| 5 | ✅ PVC6 | Previsión con control de versiones | Previsión viva | M | Alto | Hecho (sesión 158). Cada cierre de mes firmado (`A1-2`) congela un snapshot del registro de supuestos ya versionado (A7-2/E12a) — tarjeta nueva en Ajustes compara "qué preveíamos entonces" contra ahora con `diffAssumptionSnapshots()`, qué supuesto concreto cambió. Distinto de `PVX1`: compara el modelo, no el acierto final. |
| 6 | ✅ LEV3 | Estrés combinado: tipos al alza y mercado a la baja a la vez | Apalancamiento | M | Alto | Hecho (sesión 158). `evaluateCombinedStress()` (`canonical-mortgage-rate-scenarios.js`) compone el estrés de tipos con el margin call ya calculado de APX3 (`lombardMarginCallSimulation`) en un único resultado — tarjeta nueva justo debajo del simulador de margin call. |
| 7 | ✅ LEV4 | Comparador de líneas Lombard entre entidades | Apalancamiento | M | Medio | Hecho (sesión 158). `compareLombardOffers()` (`canonical-leverage-simulator.js`) registra condiciones reales de varias ofertas (lista repetible, mismo patrón que la pérdida arrastrada de FC3) y las compara sobre la cartera real: coste del primer año y margen de seguridad frente a un margin call. |
| 8 | ✅ DEB2 | Dimensionador de amortización parcial óptima | Deuda-liquidez | M | Alto | Hecho (sesión 158). `dimensionOptimalPrepayment()` (`canonical-cushion.js`) recibe el `toDebt` que DLX2 ya destina a amortizar y ajusta el importe a la baja para que la comisión de amortización anticipada (declarada en la propia tarjeta de AP1) quepa en ese excedente — nunca todo-o-nada. |
| 9 | ✅ DEB4 | Radar de refinanciación activo | Deuda-liquidez | M | Alto | Hecho (sesión 158). Los campos de la hipoteca (antes calculadora puntual sin persistir) ahora se guardan junto a un umbral de meses declarado; en cada arranque `renderDeb4RefinancingRadar()` reutiliza `evaluateMortgageRateScenarios`/`refinancingBreakEvenMonths` (APX5) y avisa si el punto de equilibrio ya cruza el umbral, sin reabrir el simulador. |
| 10 | ✅ DEB8 | Alerta de ventana de comisión decreciente | Deuda-liquidez | S-M | Medio | Hecho (sesión 158). `nextCheaperPrepaymentWindow()` (`canonical-debt-contracts.js`) recibe un escalón de comisión declarado a mano (comisión actual, mes en que termina, comisión siguiente) y avisa de la fecha exacta en que amortizar sale más barato — tarjeta nueva justo debajo de AP1/DEB2. |
| 11 | ✅ GOB3 | Resumen ejecutivo trimestral de `PROJECT_STATE.md` | Gobierno | S | Bajo | Hecho (sesión 158). Índice de decisiones vigentes al principio de `PROJECT_STATE.md` (repositorio vivo, publicación sin pedir permiso, `A11-4`, reparto por titular, exclusión Lombard de AP4, hueco de datos de la Oleada 2, backlog vigente, tres condiciones externas) — puramente documental, próxima regeneración T4 2026. |
| 12 | ✅ GOB4 | Vista por titular en hogar compartido | Gobierno | M | Medio | Hecho (sesión 158). `renderGob4MemberView()` (`p2-ui.js`), montada en Inicio: filtra metas (`goal.owner`) y deuda (`bridge().debts()`, mismo `owner` que ya usa DEB1/AP5) por titular, con la aportación total a esas metas — nunca "hogar", es la vista de un titular en particular. |
| 13 | ✅ GOB6 | Checklist de cierre de mes con verificación cruzada | Gobierno | S-M | Alto | Hecho (sesión 158). `cierreRecalcCheck()` (`views/cierre.js`) añade una cuarta comprobación al checklist de «Antes de firmar» con la misma marca de PVC1 (`FinanceP2Bridge.lastModelRecomputeAt`) — visible en el momento de firmar, no solo en Ajustes/E15/E16. |
| 14 | ✅ GOB9 | Panel único de resiliencia: "aguanto X meses" | Gobierno | M | Alto | Hecho (sesión 158). `resilienceMonths()` (`canonical-cushion.js`) combina liquidez real (misma fuente que DLX1/AP1), cuota de deuda (`p2DebtRows`) y el escenario de tensión de E13 (`PROFILES`) en un único número de meses — tarjeta nueva justo debajo del runway patrimonial completo (LPX2). |

---

## 6. Bloque 4 — Apuestas grandes: requieren decisión de alcance previa (11 tareas, L)

Mismo criterio que el Bloque 5 de la Oleada 2 (`ESX1`, `IVX3`...): valen la pena, pero cada una necesita
que el hogar resuelva una pregunta concreta antes de estimarlas con precisión — la pregunta va en la
propia fila.

Las 11 preguntas de alcance se resolvieron con el hogar en una sola tanda el 7 de septiembre de 2026
(sesión 159). Detalle completo de cada decisión y su construcción en el cierre de sesión correspondiente
de `PROJECT_STATE.md`.

| Orden | ID | Tarea | Origen | Esfuerzo | Beneficio | Pregunta de alcance / decisión |
|---|---|---|---|---|---|---|
| 15 | ✅ INV1 | Clasificación de clase de activo por posición + lectura real vs. banda de `IVX6` | Inversión | L | Alto | **Decidido: sí, abrir la dimensión.** Hecho (sesión 159). `assetClassVsGlidePath()` (`canonical-portfolio.js`) compara la composición real por clase declarada (`position.assetClass`, campo raw como `goalId`) contra la banda de `IVX6`, con el mismo umbral del 50% que ya usa `IVX8` para "dominante" — nunca una regla de "vende X%". |
| 16 | ✅ INV9 | Inmueble en alquiler como activo con P&L propio | Inversión | L | Medio | **Decidido: sí, caso real** (el local, 800€/mes ya con línea propia, neto). Hecho (sesión 159). `rentalAssetPnL()` (`canonical-assets.js`) anualiza el ingreso neto declarado y calcula la rentabilidad bruta sobre el valor del inmueble — mismo patrón que `investedAmount`/`alternativeAssetReturn` de `IVX3`. |
| 17 | ✅ INV10 | Vender activo vs. pedir prestado contra él | Inversión / Apalancamiento | L | Alto | **Decidido: comparador genérico** para cualquier meta (no acotado a una sola). Hecho (sesión 159). `sellVsBorrowComparison()` (`canonical-leverage-simulator.js`) compone `opportunityCost` (IV5) + `lombardCreditCapacity` (APX2) + coste fiscal de liquidar (plusvalía proporcional al tipo del ahorro de FC4) — vender = coste fiscal + crecimiento perdido; pedir prestado = solo el interés, sin vender nada. |
| 18 | ✅ LEV5 | Colchón de garantía dinámico según volatilidad declarada | Apalancamiento | M-L | Medio | **Decidido: banda declarada a mano.** Hecho (sesión 159). `weightedPortfolioStressDropPct()` (`canonical-leverage-simulator.js`) pondera la caída máxima declarada por clase de activo (`assetClass`, mismo campo que `INV1`) por la composición real de la cartera pignorada, y alimenta el `stressDropPct` de APX3 en vez de escribirlo a mano cada vez. |
| 19 | ✅ LEV6 | Plan de desapalancamiento con prioridad | Apalancamiento | L | Medio | **Decidido: sí, sustituir el tercer criterio por "misma clase ya sobreexpuesta".** Hecho (sesión 159). `deleveragingPriority()` (`canonical-portfolio.js`) reutiliza `rebalanceSuggestions` (IV6) para ese criterio, más el coste fiscal ya derivado de `gainLoss` y la convicción declarada (`convictionScore`, campo nuevo en `normalizePosition`). |
| 20 | ✅ LEV7 | Seguro de cola frente a margin call | Apalancamiento | L | Medio | **Decidido: usar la banda P10 ya calibrada de `ESX1`**, sin calibración de cola aparte. Hecho (sesión 159). `tailRiskAgainstMarginCall()` (`canonical-leverage-simulator.js`) compone el margin call de APX3 con `minCheckingPercentiles.p10` del Monte Carlo de `ESX1`: si la caja del peor escenario de liquidez ya simulado cubriría la garantía adicional exigida. |
| 21 | ✅ DEB5 | Prioridad multideuda ajustada por fiscalidad | Deuda-liquidez | M-L | Alto | **Decidido: sí, caso real hoy.** Hecho (sesión 159). `fiscalAdjustedDebtPriority()` (`canonical-debt-contracts.js`) ordena TODAS las deudas activas por TAE efectivo tras `fiscalDeductionPct` (campo nuevo, declarado por contrato) — a propósito sin el filtro restringido de entidades que usa `AP1`/`DEB1`. |
| 22 | ✅ DEB6 | Simulador de consolidación de varias deudas | Deuda-liquidez | L | Bajo-Medio | **Decidido: sí, caso real hoy.** Hecho (sesión 159). `simulateDebtConsolidation()` (`canonical-debt-contracts.js`) compara coste total antes/después (amortización francesa estándar) de las deudas seleccionadas — simulación de lectura, no ejecuta nada. |
| 23 | ✅ PVC5 | Recalibración trimestral del triángulo Monte Carlo | Previsión viva | M-L | Medio | **Decidido: ventana de 8 trimestres, con confirmación del hogar antes de aplicar** (nunca automático). Hecho (sesión 159). `quarterlyRecalibrationProposal()` (`canonical-e13-scenarios.js`) compara el triángulo con todo el histórico contra la ventana de 24 meses; solo se aplica (`esx1HistoryForCalibration()`) tras confirmación explícita en la tarjeta — sin confirmar, sigue usando todo el histórico exactamente igual que antes. |
| 24 | ✅ PVC10 | Previsión ponderada por eventos inciertos | Previsión viva / Escenarios | M-L | Medio | **Decidido: las dos ubicaciones** — línea permanente en el forecast principal Y dentro del Laboratorio de escenarios. Hecho (sesión 159). `weightedForecastWithUncertainEvents()` (`canonical-e13-scenarios.js`) extiende el constructor de eventos A8-2 con `probabilityPct` (0-100, opcional, sin declarar = certero): cada evento pesa su propia probabilidad en vez de aplicarse a valor completo. Fila permanente en la comparación principal del Laboratorio (solo si hay algún evento con probabilidad declarada) + desglose por evento en `pvc10WeightedDetail`. |
| 25 | ⏳ GOB5 | Notificaciones reales fuera de la app | Gobierno | M | Medio | **Decidido: esperar a que `A5-4` cierre primero.** No se construye lógica ahora — se retoma cuando `A5-4` (backend push) esté listo en producción. |

**Bug encontrado y corregido de rebote (sesión 159), fuera de esta tabla:** `renderGob9ResiliencePanel()`
(Bloque 3, ya en `main`) leía `window.FinanceCanonicalE13Scenarios`, un global que nunca existió — el
motor real se registra como `window.FinanceCanonicalE13`. El escenario de tensión de `GOB9` nunca se
aplicaba de verdad en producción, sin que ningún test lo detectara (el test de wiring solo comprobaba el
texto, no el global real). Corregido y con test de regresión que ejecuta la función en sandbox real.

---

## 7. Bloque 5 — Resto: relleno de hueco entre apuestas grandes (16 tareas, S/S-M/M)

| Orden | ID | Tarea | Origen | Esfuerzo | Beneficio | Nota |
|---|---|---|---|---|---|---|
| 26 | ✅ PVC2 | Banda de confianza por categoría, aplicada al horizonte largo | Previsión viva | M | Medio | Hecho (sesión 163). `CanonicalBudgetAnalyzer.categoryConfidenceShare()` reparte la banda P10-P90 de `ESX1` entre categorías según su propia varianza histórica (`stdDev²` de `PVX4`/`analyzeCategory`), no por igual — bajo el supuesto de independencia entre categorías (sin datos de correlación real). Tarjeta nueva en el Laboratorio de escenarios, junto a la simulación prudente. |
| 27 | ✅ PVC4 | Marcador de deriva por partida | Previsión viva | M | Medio | Hecho (sesión 163). `categoryDriftWindows()` (`canonical-forecast.js`) reconstruye previsto/real por partida desde los meses ya cerrados y archivados (`registrarMesCollect()`, la única fuente real por partida) y compara tres ventanas (3/6/12 meses): "sistemático" si la desviación va siempre en la misma dirección, con tendencia empeorando/mejorando/estable. Tarjeta nueva en Ajustes › Presupuesto y operación. |
| 28 | ✅ PVC7 | Caducidad de escenarios guardados | Escenarios | S-M | Bajo | Hecho (sesión 163). `savedScenarioStaleness()` reutiliza `recalculateSavedScenario()` (mismo cálculo que ya usaba el botón «Recalcular copia») y marca "desactualizado" solo si la huella del forecast cambió Y la caja mínima del escenario base recalculado se movió ≥20% — una huella distinta sin cambio material no cuenta. Badge visible junto a cada escenario guardado. |
| 29 | ✅ PVC8 | Alerta de reforecast por materialidad | Previsión viva | S | Medio | Hecho (sesión 163). `reforecastMaterialityAlert()` compara la caja mínima antes/después de cada recálculo real (`recomputeModelIfNeeded()`) contra un umbral doble — absoluto (200€) Y relativo a la caja disponible ahora mismo (10%) — para no ser ni demasiado sensible con colchones grandes ni demasiado laxo con pequeños. Visible en los paneles de metas (E15) y riesgo (E16), junto al indicador de `PVC1`. |
| 30 | ✅ PVC9 | "Por qué cambió tu previsión", en una frase | Previsión viva | S-M | Bajo | Hecho (sesión 163). `previsionChangeOneLiner()` combina el árbol causal de `PVX5` con `detectStructuralChange()` (`PVC3`): si no hay cambio estructural sostenido lo dice tal cual (nunca inventa un "por qué" que `PVC3` ya descartó como ruido), y si lo hay, cita el componente del árbol causal del mes elegido que más pesa en euros. Frase visible en la propia tarjeta del árbol causal. |
| 31 | ✅ INV2 | Alerta de desviación de rebalanceo | Inversión | S-M | Alto | Hecho (sesión 163). `rebalanceSuggestions()` (IV6) ya calculaba la desviación por tipo de activo, pero solo era visible al abrir Ajustes; se conectó al framework de alertas ya existente (V6-2/`UxSettings`) como metric `rebalanceDeviationPct`, mismo umbral (10 puntos) que ya usaba IV6 internamente — sin objetivos declarados, la métrica es 0 y nunca dispara. |
| 32 | ✅ INV4 | Alerta de concentración en una sola posición | Inversión | S-M | Medio | Hecho (sesión 163). Alcance reducido, tal como se documentó: sin correlación estadística real, se usa el % de la mayor posición sobre el total (que `renderIv1PositionConcentration()` ya calculaba como nota pasiva) conectado al mismo framework de alertas, metric `topPositionConcentrationPct`, umbral 50%. |
| 33 | ✅ INV6 | Compensación de pérdidas latentes antes del cierre fiscal (confirmada por `VER-3`) | Inversión / Fiscalidad | S-M (reducido: `gainLoss` no realizado ya lo calcula `fifoLedger()`, solo falta filtrar/rankear candidatas) | Alto | Hecho (sesión 163). `latentLossHarvestingCandidates()` (`canonical-portfolio.js`) filtra y ordena posiciones con `gainLoss` negativo, con la norma española de no recompra (2 meses cotizados, 1 año no cotizados) como aviso explícito — nunca sugiere vender por sí sola. Tarjeta nueva en Ajustes › Fiscal, justo antes de FC3, que la complementa. |
| 34 | ✅ INV7 | Escalera de liquidez de la cartera | Inversión | M | Medio | Hecho (sesión 163). `liquidityLadder()` clasifica cada posición por tipo (acción/ETF/cripto = inmediata 0-2 días, fondo = corta 3-7 días, "otro" = sin clasificar, nunca con una velocidad inventada) y cruza el valor acumulado con el mismo `cushionFloor()` que ya usan DLX1/AP6, para saber si la liquidez rápida basta para cubrir el colchón mínimo. |
| 35 | ✅ INV8 | Seguimiento de plan de aportación periódica (DCA) | Inversión | S-M | Bajo | Hecho (sesión 163). Dos campos opcionales nuevos por posición (aportación mensual prevista + inicio del plan); `dcaPlanStatus()` compara lo aportado de verdad (coste inicial + `contributions` de IV2, ya registrados) contra lo que el plan esperaría a estas alturas, y avisa del retraso acumulado en euros y meses al ritmo previsto. |
| 36 | ⏳ LEV8 | Registro de la tesis de apalancamiento | Apalancamiento | S-M | Medio | Al activar apalancamiento, guardar qué se espera ganar, a qué horizonte y qué invalidaría la decisión — mismo patrón de diario que ya usa `PV5` para el forecast, aplicado aquí a una decisión de apalancamiento. |
| 37 | ⏳ DEB3 | Valor de la opcionalidad de esperar | Deuda-liquidez | M | Medio | Cuantifica qué se pierde y qué se gana por no amortizar ya y conservar liquidez disponible por si aparece mejor información — pensamiento de opciones reales aplicado a una decisión que `AP1`/`DEB1` tratan como binaria. |
| 38 | ⏳ DEB7 | Preferencia declarada: coste mínimo vs. libre de deudas | Deuda-liquidez | S-M | Medio | Expone que "amortizar antes" y "coste financiero mínimo" pueden no coincidir, y deja que el hogar declare cuál pesa más — el sistema recomienda en consecuencia vía `AP1`/`DEB1`, sin imponer una única "respuesta óptima" que ignore el valor psicológico de no deber nada. |
| 39 | ⏳ GOB7 | Modo "sesión con asesor o pareja" | Gobierno | S-M | Bajo | Vista de presentación simplificada, ocultando el detalle técnico de los 42+ módulos de Ajustes, apoyada en la navegación ya existente de `e17-experience.js`. |
| 40 | ⏳ GOB8 | Borrador de apoyo para la Renta | Gobierno / Fiscalidad | M | Medio | Con IRPF (`canonical-irpf-estimator.js`), dividendos (`canonical-dividend-tax.js`) y rescate de pensiones (`FCX1`) ya modelados por separado, genera un resumen exportable de apoyo — nunca sustituto de la gestoría. |
| 41 | ⏳ GOB10 | Registro de decisiones con revisión programada | Gobierno | S-M | Bajo | Generaliza `LEV8` y `DEB3` a cualquier decisión financiera del hogar (no solo deuda y apalancamiento): guarda la tesis y programa un recordatorio de revisión a 6/12 meses. |

---

## 8. Retiradas — ya construidas o sin hipótesis real (5 tareas, referencia)

Se documentan por el mismo motivo que `FCX2` en la Oleada 2: decir explícitamente por qué no se
construyen evita que alguien las retome más adelante sin saber que ya se investigaron.

| ID | Tarea propuesta | Motivo de retirada |
|---|---|---|
| ⚪ GOB1 | Auditoría de uso real de pantallas | Ya es `OPT-2`/`OPT-10` (Bloque 0, cola heredada) — no es trabajo nuevo, es el mismo trabajo con otro nombre. |
| ⚪ GOB2 | Cerrar la Fase 7 de Laboratorio | Ya es `OPT-11`/`OPT-12`/`OPT-13` (Bloque 0, cola heredada) — misma tarea, mismo bloqueo de calendario. |
| ⚪ INV3 | Comparador contra benchmark real | Ya construida: `IVX2` (`compareAgainstBenchmark()`, `canonical-portfolio.js`), Oleada 2, Bloque 3. |
| ⚪ INV5 | Coste real de la cartera (fees/TER) | Ya construida: `IVX4` (`compoundedFeeCost()`, `canonical-portfolio.js`), Oleada 2, Bloque 3. |
| ⚪ LEV2 | Punto de equilibrio del carry trade neto de impuestos | Ya construida: `APX1` (`netDebtCostAfterTax()`, `canonical-debt-comparator.js`), Oleada 2, Bloque 3. |

---

## 9. Plan de ejecución

**Paso 1 — Bloque 1 completo antes que nada (`VER-1`, `VER-2`, `VER-3`).** Son lectura de código, sin
escritura ni decisión de producto: se pueden resolver en una sola sesión. Su resultado decide el
esfuerzo real de `PVC1`, `DEB1` e `INV6` — construir esas tres sin esta verificación arriesga repetir
exactamente lo que ya pasó una vez con `PVX3` (motor nuevo sobre algo que ya funcionaba).

**Resuelto el 7 de septiembre de 2026 (sesión 157):** las tres confirmaron que el motor de cascada por
firma ya existe — `PVC1` y `DEB1` quedan reducidas a un indicador visible (esfuerzo `S` cada una,
detalle en el Bloque 2), e `INV6` se confirma con esfuerzo reducido (Bloque 5). Ninguna de las tres se
retiró. Detalle completo en la tabla de resultados del Bloque 1.

**Paso 2 — Bloque 2 (cimiento): `LEV1` primero, `PVC1`/`DEB1` con el alcance que el Paso 1 confirme.**
`LEV1` no depende de ninguna verificación y es la pieza que más gobierno añade con menos ambigüedad —
razón para construirla ya. `PVC1` y `DEB1` cierran el bloque con el esfuerzo real, no el estimado a
ciegas.

**Bloque 2 completo el 7 de septiembre de 2026 (sesión 157): `LEV1`, `PVC1` y `DEB1` hechas.** El
cimiento de la Oleada 3 queda cerrado — siguiente paso: Bloque 3 (11 tareas de alto impacto, sin
preguntas de alcance).

**Paso 3 — Bloque 3 completo (11 tareas S/S-M/M).** Ninguna depende de una decisión de alcance ni de
otra tarea de esta oleada fuera del propio bloque (`DEB2` depende de `DLX2`, ya construida en la
Oleada 2). Es el tramo de mayor velocidad esperada, comparable al Bloque 2/3 de la propia Oleada 2.

**Bloque 3 completo el 7 de septiembre de 2026 (sesión 158): las 11 tareas hechas** (`PVC3`, `PVC6`,
`LEV3`, `LEV4`, `DEB2`, `DEB4`, `DEB8`, `GOB3`, `GOB4`, `GOB6`, `GOB9`) — detalle con referencias de
código en la tabla del Bloque 3. Siguiente paso: Bloque 4 (11 apuestas grandes con pregunta de alcance
previa, a resolver con el hogar en una sola tanda).

**Paso 4 — Resolver las 11 preguntas de alcance del Bloque 4 en una sola tanda con el hogar**, igual
que se hizo con `ESX1`/`IVX3`/`FCX2` en la Oleada 2: consolidarlas y plantearlas juntas evita
interrumpir la sesión pregunta a pregunta. Construir solo las que reciban una respuesta que sostenga
esfuerzo `L`; las que no, se retiran documentadas con el mismo criterio que `FCX2`.

**Bloque 4 completo el 7 de septiembre de 2026 (sesión 159): las 11 preguntas de alcance resueltas en
una sola tanda, 10/11 construidas** (`INV1`, `INV9`, `INV10`, `LEV5`, `LEV6`, `LEV7`, `DEB5`, `DEB6`,
`PVC5`, `PVC10`) y 1 pospuesta con motivo (`GOB5`, bloqueada de facto por `A5-4`, sin backend push en
producción — se retoma cuando esa infraestructura esté lista). De rebote se corrigió un bug real ya en
`main` (Bloque 3): `renderGob9ResiliencePanel()` leía un global inexistente, así que el escenario de
tensión de `GOB9` nunca se aplicaba de verdad. Detalle completo, con referencias de código por tarea,
en la tabla del Bloque 4 y en los cierres de sesión de `PROJECT_STATE.md`. Siguiente paso: Bloque 5
(16 tareas S/S-M/M, relleno de hueco entre apuestas grandes, sin preguntas de alcance previas).

**Paso 5 — Bloque 5 como relleno de hueco entre apuestas grandes**, exactamente igual que el resto de
bloques S/M de la Oleada 2: sin bloquear nada más, material natural para sesiones cortas.

**Cierre de la oleada:** cuando los Bloques 1 a 5 estén resueltos (construidos, reducidos o retirados
con motivo), actualizar `BACKLOG_INDICE.md` con el resultado real — igual que se hizo para la Oleada 2
— y comprobar si el reloj de `OPT-2` (Bloque 0) ya cumplió: si es así, esa cola pasa a ser la siguiente
prioridad real, no una nota a pie de página.

## 10. Nota de alcance

Este documento cruzó las 46 propuestas originales contra el Bloque 3-5 de
`BACKLOG_ULTIMATE_SEPTIEMBRE_OLEADA_2.md`, que es donde más solapamiento real se encontró. No se hizo
el mismo cruce exhaustivo contra las ~150 tareas de `BACKLOG_ULTIMATE_SEPTIEMBRE.md` (E1-E20) ni contra
el detalle línea a línea de cada módulo `canonical-*.js` — verificar la nota de "se apoya en"/"extiende"
de cada fila contra el código vigente sigue siendo el primer paso antes de construir cualquiera de
ellas, exactamente igual que exige el resto de este backlog.
