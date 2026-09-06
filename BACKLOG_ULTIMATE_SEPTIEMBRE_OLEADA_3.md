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

| ID | Verificación | Qué decide | Nota |
|---|---|---|---|
| `VER-1` | ¿El forecast recalculado por `recomputeModelIfNeeded()` (`PVX3`) se repropaga a metas (`E15`/`A10-4`), plan de deuda (`E14b`/`AP1`), sostenibilidad de apalancamiento (`APX3`) y presupuesto de riesgo (`A11-5`) sin abrir esas pantallas? | Alcance final de `PVC1` | Si ya se repropaga, `PVC1` se reduce a hacerlo *visible* (un indicador "recalculado hace X" por módulo). Si no se repropaga, `PVC1` construye el motor de cascada completo. |
| `VER-2` | ¿`AP1` (comparador amortizar-vs-invertir) ya se recalcula solo en cada cierre de mes, o solo cuando se abre su pantalla? | Alcance final de `DEB1` | Mismo patrón que `VER-1`, aplicado al comparador de deuda en vez de al forecast. |
| `VER-3` | ¿`FC3` (pérdidas pendientes de compensar, citado por `APX1`) ya identifica posiciones con pérdida **latente** (no vendida) candidatas a venta antes de cierre fiscal, o solo trackea pérdidas ya realizadas? | Alcance final de `INV6` | Si `FC3` ya cubre pérdidas latentes, `INV6` se retira igual que `INV3`/`INV5`. Si no, `INV6` construye solo esa pieza que falta. |

---

## 4. Bloque 2 — Cimiento (3 tareas, nivel 0-1, condicionadas a las verificaciones)

| Orden | ID | Tarea | Origen | Esfuerzo | Beneficio | Nota |
|---|---|---|---|---|---|---|
| 1 | ⏳ LEV1 | Política de apalancamiento del hogar | Apalancamiento | M | Alto | Un límite máximo de deuda-para-invertir sobre patrimonio neto o ingresos, declarado por el hogar de antemano, que ninguna otra tarea de este bloque deje superar sin confirmación explícita — mismo patrón que el guardarraíl de colchón (`DLX1`). No necesita verificación previa: `APX2`/`APX3` dejan constancia explícita de que el crédito Lombard queda **a propósito fuera** del guardarraíl general de deuda (`AP4`), por tener un perfil de riesgo distinto — confirma que el hueco es real, no una lectura errónea del código. |
| 2 | ⏳/🔍 PVC1 | Motor de recálculo en cascada (alcance según `VER-1`) | Previsión viva | M-L (si `VER-1` confirma que hace falta motor nuevo) / S (si solo falta visibilizarlo) | Alto | Al cerrar un mes o recalibrar el forecast, que metas, plan de deuda, apalancamiento y presupuesto de riesgo quedan al día sin que el hogar tenga que abrir cada pantalla — con un indicador "recalculado hace X" por módulo dependiente para que el hecho de que ocurrió sea visible, no solo cierto puertas adentro. |
| 3 | ⏳/🔍 DEB1 | Amortizar-vs-invertir recalculado cada cierre (alcance según `VER-2`) | Deuda-liquidez | M (si hace falta motor) / S (si solo falta el aviso) | Alto | Que `AP1` avise cuando su veredicto cambie de sentido entre un cierre y el siguiente, en vez de exigir que el hogar vuelva a abrir la pantalla para descubrirlo. |

---

## 5. Bloque 3 — Alto impacto, bajo riesgo (11 tareas, nivel 0-1, S/S-M/M, sin preguntas de alcance)

| Orden | ID | Tarea | Origen | Esfuerzo | Beneficio | Nota |
|---|---|---|---|---|---|---|
| 4 | ⏳ PVC3 | Detector de cambio estructural vs. ruido | Previsión viva | M | Alto | Antes de mover la previsión base por una desviación (`A7-4`), exigir persistencia de 2-3 meses consecutivos fuera de banda — distingue una subida de nómina real de un mes atípico. Sin esto, un imprevisto puntual puede contaminar diez años de forecast. |
| 5 | ⏳ PVC6 | Previsión con control de versiones | Previsión viva | M | Alto | Guardar un snapshot del forecast en cada cierre de mes (`A1-2`) y permitir comparar "qué preveíamos en marzo" contra "qué prevemos ahora", con un diff de qué supuesto concreto cambió — distinto de `PVX1` (backtesting de precisión) porque compara el **modelo**, no solo el acierto final. |
| 6 | ⏳ LEV3 | Estrés combinado: tipos al alza y mercado a la baja a la vez | Apalancamiento | M | Alto | `canonical-mortgage-rate-scenarios.js` y la sostenibilidad de apalancamiento (`APX3`) estresan tipos o mercado por separado; combinarlos en un único escenario declarado por el hogar, porque en una crisis real ambos suelen moverse juntos y el efecto compuesto no es la suma de los dos por separado. |
| 7 | ⏳ LEV4 | Comparador de líneas Lombard entre entidades | Apalancamiento | M | Medio | `APX2` calcula capacidad de crédito para un LTV declarado; registrar condiciones reales de varias ofertas (LTV máximo, tipo, comisión de apertura/cancelación, umbral de margin call) y compararlas lado a lado, igual que ya existe para hipotecas en `canonical-debt-comparator.js`. |
| 8 | ⏳ DEB2 | Dimensionador de amortización parcial óptima | Deuda-liquidez | M | Alto | Recibe como entrada el excedente que `DLX2` ya calcula (lo que sobra por encima del suelo del colchón) y decide cuánto de ese excedente destinar a amortizar esta deuda concreta, contando la comisión de amortización anticipada del contrato real (`canonical-debt-contracts.js`) si la tiene — nunca todo-o-nada. |
| 9 | ⏳ DEB4 | Radar de refinanciación activo | Deuda-liquidez | M | Alto | `APX5` (`refinancingBreakEvenMonths()`) ya calcula el punto de equilibrio de refinanciar bajo demanda; convertirlo en vigilancia continua que avise solo cuando las condiciones de mercado (`canonical-mortgage-rate-scenarios.js`) crucen ese umbral, sin que el hogar tenga que volver a abrir el simulador cada mes por si acaso. |
| 10 | ⏳ DEB8 | Alerta de ventana de comisión decreciente | Deuda-liquidez | S-M | Medio | Si el contrato (`canonical-debt-contracts.js`) tiene comisión de amortización anticipada decreciente en el tiempo, avisar de la fecha en la que amortizar pasa a ser más barato — para no ejecutar `DEB2` en el peor momento del contrato por pura impaciencia. |
| 11 | ⏳ GOB3 | Resumen ejecutivo trimestral de `PROJECT_STATE.md` | Gobierno | S | Bajo | Con más de 12.500 líneas, el propio historial de decisiones ya es difícil de navegar para retomar contexto entre sesiones. Un índice de "qué decisiones siguen vigentes", regenerado una vez por trimestre — puramente documental, sin código de producto. |
| 12 | ⏳ GOB4 | Vista por titular en hogar compartido | Gobierno | M | Medio | "Mis metas, mi deuda, mi aportación" separado de la vista agregada, sobre la base de hogar compartido que `RGX1` ya construyó (miembros, roles, invitar/retirar) — para que no haga falta entender los 10 dominios de Ajustes para ver solo lo propio. |
| 13 | ⏳ GOB6 | Checklist de cierre de mes con verificación cruzada | Gobierno | S-M | Alto | Antes de dar un cierre de mes (`A1-2`) por bueno, confirmar explícitamente que colchón, deuda, metas y apalancamiento se han recalculado con los datos de ese cierre — hace visible en el flujo donde más importa lo que `PVC1` resuelve por debajo. |
| 14 | ⏳ GOB9 | Panel único de resiliencia: "aguanto X meses" | Gobierno | M | Alto | Combina el colchón (`canonical-cushion.js`), la deuda y los escenarios de tensión (`A8`) en un único número — meses de aguante sin vender nada ni pedir prestado — distinto de `LPX2` (runway de patrimonio neto completo, incluye lo no líquido) porque este solo cuenta lo disponible de verdad en una emergencia. |

---

## 6. Bloque 4 — Apuestas grandes: requieren decisión de alcance previa (11 tareas, L)

Mismo criterio que el Bloque 5 de la Oleada 2 (`ESX1`, `IVX3`...): valen la pena, pero cada una necesita
que el hogar resuelva una pregunta concreta antes de estimarlas con precisión — la pregunta va en la
propia fila.

| Orden | ID | Tarea | Origen | Esfuerzo | Beneficio | Pregunta de alcance a resolver antes de construir |
|---|---|---|---|---|---|---|
| 15 | ⚠️ INV1 | Clasificación de clase de activo por posición + lectura real vs. banda de `IVX6` | Inversión | L | Alto | `IVX6` ya da la banda de horizonte (crecimiento/transición/conservador) por objetivo, pero su propia nota dice que la app no clasifica riesgo/clase por posición — sin ese campo nuevo en `IV1`, ni esta tarea ni `INV2` tienen con qué comparar la cartera real contra la banda. ¿Vale la pena abrir esa dimensión de datos nueva, sabiendo que exige mantenerla actualizada a mano? |
| 16 | ⏳ INV9 | Inmueble en alquiler como activo con P&L propio | Inversión | L | Medio | ¿El hogar tiene o prevé tener un inmueble en alquiler real, o es una hipótesis sin caso de uso — mismo criterio que hizo retirar `FCX2`? Solo construir si la respuesta es que sí existe. |
| 17 | ⏳ INV10 | Vender activo vs. pedir prestado contra él | Inversión / Apalancamiento | L | Alto | Compone `APX1` (coste de deuda neto de fiscalidad) + `APX2` (capacidad Lombard) + el coste fiscal de liquidar una posición: ¿construir un comparador genérico para cualquier meta, o acotarlo a la primera meta real que lo necesite? |
| 18 | ⚠️ LEV5 | Colchón de garantía dinámico según volatilidad declarada | Apalancamiento | M-L | Medio | `APX3` fija un margen de seguridad constante frente al LTV de mantenimiento; hacerlo variable según la volatilidad REAL reciente de la cartera pignorada exige el mismo histórico de valoraciones que ya bloqueó `IVX5` — alcance reducido a una banda de volatilidad que el hogar declara por clase de activo (igual que ya declara el triángulo de `ESX1`), no una calculada de series que la app no guarda. ¿Vale la pena mantener esa banda declarada a mano, o se espera a tener histórico real? |
| 19 | ⚠️ LEV6 | Plan de desapalancamiento con prioridad | Apalancamiento | L | Medio | El criterio de "menor coste fiscal" y "menor convicción" son calculables; "mayor correlación con el resto del patrimonio" no lo es sin el mismo histórico de rendimientos que ya bloqueó `APX4` — ¿se sustituye ese tercer criterio por "misma clase de activo ya sobreexpuesta" (`IVX8`), más simple y sí calculable? |
| 20 | ⏳ LEV7 | Seguro de cola frente a margin call | Apalancamiento | L | Medio | Compone `APX3` (margin call) con la banda P10/P50/P90 de `ESX1`: ¿el "peor 5%" se define sobre la banda ya calibrada del perfil, o exige una calibración de cola específica más cara de mantener? |
| 21 | ⏳ DEB5 | Prioridad multideuda ajustada por fiscalidad | Deuda-liquidez | M-L | Alto | Solo tiene sentido con más de una deuda simultánea con tratamiento fiscal distinto (p.ej. hipoteca con deducción autonómica vigente vs. préstamo personal) — ¿el hogar tiene ese caso real hoy, o se construye para un supuesto? |
| 22 | ⏳ DEB6 | Simulador de consolidación de varias deudas | Deuda-liquidez | L | Bajo-Medio | Mismo caso: ¿existe hoy más de una deuda que un hogar normal consideraría consolidar, o es una capacidad sin demanda real todavía? |
| 23 | ⏳ PVC5 | Recalibración trimestral del triángulo Monte Carlo | Previsión viva | M-L | Medio | `ESX1` usa un triángulo P10/P50/P90 fijo por perfil; recalibrarlo exige decidir la ventana de "reciente" (¿4 trimestres? ¿8?) y si el cambio se aplica solo, o el hogar lo confirma antes — mismo contrato de nunca escribir sin confirmación que rige el resto de la app. |
| 24 | ⏳ PVC10 | Previsión ponderada por eventos inciertos | Previsión viva / Escenarios | M-L | Medio | Extiende el constructor de eventos (`A8-2`) y las plantillas `ESX2` con una probabilidad declarada: ¿se muestra como una segunda línea permanente en el forecast principal, o solo dentro del Laboratorio de escenarios para no cargar la vista por defecto? |
| 25 | ⏳ GOB5 | Notificaciones reales fuera de la app | Gobierno | M | Medio | Bloqueada de facto por `A5-4` (push, sin backend activo en producción) — la pregunta no es de alcance sino de secuencia: ¿se construye ya la lógica de umbral/frecuencia esperando a que `A5-4` esté listo, o se espera a que `A5-4` cierre primero para no construir sobre infraestructura que todavía no existe? |

---

## 7. Bloque 5 — Resto: relleno de hueco entre apuestas grandes (16 tareas, S/S-M/M)

| Orden | ID | Tarea | Origen | Esfuerzo | Beneficio | Nota |
|---|---|---|---|---|---|---|
| 26 | ⏳ PVC2 | Banda de confianza por categoría, aplicada al horizonte largo | Previsión viva | M | Medio | `PVX4` ya calcula percentiles p25/p75 por categoría para el mes en curso (`views/presupuesto-mes.js`); esta tarea reutiliza ese mismo cálculo pero lo aplica a la banda de `ESX1` en el horizonte de varios años, en vez de dejar toda la incertidumbre del Monte Carlo repartida por igual entre categorías con volatilidad muy distinta. |
| 27 | ⏳ PVC4 | Marcador de deriva por partida | Previsión viva | M | Medio | Extiende `A11-3` (error y sesgo global) y `PVX1` (backtesting del modelo completo) a nivel de categoría: qué se previó hace 3/6/12 meses frente a lo real, con semáforo de sesgo sistemático por partida — por ejemplo, si el ocio de verano siempre sale más caro de lo previsto. |
| 28 | ⏳ PVC7 | Caducidad de escenarios guardados | Escenarios | S-M | Bajo | Los escenarios guardados (`A8-7`) no caducan; marcar como "desactualizado" cualquiera cuyo forecast base se haya recalibrado más de un umbral desde que se guardó. |
| 29 | ⏳ PVC8 | Alerta de reforecast por materialidad | Previsión viva | S | Medio | `PVX3` ya recalcula el forecast al instante en cada cambio — lo que falta no es el cálculo, es el aviso: un umbral, absoluto y relativo a la caja disponible, que decida cuándo esa recalibración es lo bastante grande para generar una alerta visible en vez de quedar en silencio dentro del número actualizado. |
| 30 | ⏳ PVC9 | "Por qué cambió tu previsión", en una frase | Previsión viva | S-M | Bajo | Combina el árbol causal `PVX5` con el detector de cambio estructural `PVC3` en un resumen de lenguaje natural de una línea, para quien no quiere navegar el árbol completo. |
| 31 | ⚠️ INV2 | Alerta de desviación de rebalanceo | Inversión | S-M | Alto | Depende directamente de que `INV1` exista — sin clasificación de clase de activo por posición no hay "objetivo" con el que comparar la cartera real. Si el hogar decide no abrir esa dimensión de datos (pregunta de `INV1`), esta tarea queda igualmente en espera. |
| 32 | ⚠️ INV4 | Alerta de concentración en una sola posición | Inversión | S-M | Medio | Alcance reducido a propósito: sin serie histórica de rendimientos ni clasificación de sector/divisa por posición (mismo hueco que ya bloqueó `APX4`/`IVX1`/`IVX5`), no hay correlación estadística real que calcular. Lo que sí es calculable hoy es un umbral simple de "% del total en una única posición", sobre los datos que `IV1` ya guarda. |
| 33 | 🔍→⏳/⚪ INV6 | Compensación de pérdidas latentes antes del cierre fiscal | Inversión / Fiscalidad | M (si `VER-3` confirma que hace falta) | Alto | Ver `VER-3`: solo se construye si `FC3` no cubre ya la identificación de pérdidas latentes (no realizadas) candidatas a venta antes de cierre fiscal, respetando la norma de no recompra. |
| 34 | ⏳ INV7 | Escalera de liquidez de la cartera | Inversión | M | Medio | Clasifica cada activo por días hasta convertirlo en caja sin penalización severa, y lo cruza con el colchón (`canonical-cushion.js`) — distinto de `LPX2` (runway de patrimonio neto total) porque aquí importa la velocidad de conversión, no el valor total. |
| 35 | ⏳ INV8 | Seguimiento de plan de aportación periódica (DCA) | Inversión | S-M | Bajo | `IVX7` ya muestra el coste medio de adquisición hacia atrás; esta tarea mira hacia delante — registra el calendario de aportaciones previsto y avisa de retraso acumulado, con el efecto estimado sobre la meta ligada (`goalId`, `IVX6`) si no se recupera. |
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

**Paso 2 — Bloque 2 (cimiento): `LEV1` primero, `PVC1`/`DEB1` con el alcance que el Paso 1 confirme.**
`LEV1` no depende de ninguna verificación y es la pieza que más gobierno añade con menos ambigüedad —
razón para construirla ya. `PVC1` y `DEB1` cierran el bloque con el esfuerzo real, no el estimado a
ciegas.

**Paso 3 — Bloque 3 completo (11 tareas S/S-M/M).** Ninguna depende de una decisión de alcance ni de
otra tarea de esta oleada fuera del propio bloque (`DEB2` depende de `DLX2`, ya construida en la
Oleada 2). Es el tramo de mayor velocidad esperada, comparable al Bloque 2/3 de la propia Oleada 2.

**Paso 4 — Resolver las 11 preguntas de alcance del Bloque 4 en una sola tanda con el hogar**, igual
que se hizo con `ESX1`/`IVX3`/`FCX2` en la Oleada 2: consolidarlas y plantearlas juntas evita
interrumpir la sesión pregunta a pregunta. Construir solo las que reciban una respuesta que sostenga
esfuerzo `L`; las que no, se retiran documentadas con el mismo criterio que `FCX2`.

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
