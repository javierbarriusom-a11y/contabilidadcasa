# Backlog — Contabilidadcasa 2.0

> Mapa de todos los backlogs del repositorio: [`BACKLOG_INDICE.md`](BACKLOG_INDICE.md).
> Códigos propios de este documento (`P-`/`I-`/`D-`/`T-`) — no continúan las familias `PVC`/`INV`/
> `LEV`/`DEB`/`GOB`/`A14` ya existentes. Varias tareas sí extienden un motor de esas familias; se cita
> el archivo o la tarea real en cada nota, igual que hizo `BACKLOG_SUCESION_Y_CONTINUIDAD.md` con `LPX`.

Fecha de creación: 16 de septiembre de 2026 (sesión posterior a la 195, con
`BACKLOG_SUCESION_Y_CONTINUIDAD.md` ya 100% cerrado y ningún backlog nuevo identificado todavía).

**Estado: 12/52 cerradas (sesión 199 — `D2`, `D3`, `D7`, `T1`, `T15`, `T17`, `T19`, `T2`, `D4`,
`I11`, `P1`, `P5`).** `T1` añadió 5 tareas nuevas (`T15`-`T19`, §4) desde sus propios hallazgos; las tres sin
decisión previa pendiente (`T15`, `T17`, `T19`) ya se cerraron. Solo `T16` y `T18` siguen esperando
que el hogar decida. El resto sigue pendiente — diagnóstico y planificación para lo que falta, con el hogar ya
decidido por dónde seguir (ver §6).

## 0. Origen y diagnóstico

El hogar pidió una auditoría crítica de producto — "eres el mejor desarrollador de apps
financieras: analiza la app y propón mejoras" — con más de 40 features nuevas, profundizando
en previsión/actualización de datos, mejorando inversión y optimizando deuda. Se hizo con cuatro
revisiones de código en paralelo (previsión, inversión, deuda, sistema UX/estado del proyecto),
publicada primero como documento independiente
[«Contabilidadcasa 2.0»](https://claude.ai/artifact/S2aurmx6x3AWkd48D712WE) — 10 hallazgos + 48
propuestas — y después cruzada contra el código y `PROJECT_STATE.md` reales antes de convertirla
en tareas, misma disciplina que ya aplicaron las Oleadas 3 y 4 con «El Libro Vivo». Ese cruce
encontró **1 propuesta ya resuelta por una decisión de producto explícita (`I4`, descartada, §4) y
2 que necesitaban reducir su alcance tras verificar el código real (`D2`, `D3`, §5)** — detalle en
cada ficha.

### 0.1 Diez hallazgos del diagnóstico crítico

| # | Severidad | Hallazgo |
|---|---|---|
| 1 | Crítico | La navegación es más compleja que el problema que resuelve — 37+ enlaces activos por la filosofía «envolver, no sustituir» (`tests/navigation-structure.test.cjs`). |
| 2 | Crítico | La usabilidad de Hoy/Registrar/Plan nunca se auditó de verdad — `docs/OPT21_CHECKLIST_NIELSEN.md` tiene el marco desde el 29/08 y cero hallazgos reales. |
| 3 | Serio | La app decidió ser «directiva» el 12/09 (sesión 177) pero solo para tareas nuevas — ~15+ pantallas publicadas siguen con el disclaimer antiguo, sin retrofit decidido. |
| 4 | Serio | El patrimonio neto consolidado (`A14-2`) tiene la cifra puntual y el desglose por tipo construidos, pero **sin serie histórica ni banda de confianza** — diferido explícitamente a «sesión aparte» en el propio código (`app.js`, comentario de `A14-2`). |
| 5 | Aviso | Cero soporte de preferencias de sistema: 0 ocurrencias de `prefers-color-scheme` y de `prefers-reduced-motion` en todo el proyecto. |
| 6 | Aviso | Diseño desktop-first: 32 `@media (max-width...)` en cascada descendente en `styles.css`, no al revés. |
| 7 | Aviso | Todos los gráficos son SVG dibujado a mano (`app.js`, funciones `render*Chart`) — sin tooltip, zoom ni pan más allá de lo que cada función programa por su cuenta. |
| 8 | Aviso | Deuda vive duplicada en dos motores vigilados por `canonical-e14-parity.js` — coste de mantenimiento permanente sin fecha de retirada del iframe heredado. |
| 9 | Aviso | La correlación de cartera es declarada, no calculada — hueco de datos ya documentado desde la Oleada 2 (`APX4`/`IVX1`/`IVX5`, `PROJECT_STATE.md`), sin serie histórica de valoraciones por posición. |
| 10 | Aviso | Tres condiciones externas activas sin fecha (`OPT-2`, `A5-1`, `O-6`) — ninguna decisión interna las resuelve; hace falta decidir qué construir de interino mientras no llegan. |

### 0.2 Cómo leer las tablas

Esfuerzo: **S** (días), **M** (semana/pocas semanas), **L** (varias semanas o requiere una decisión
previa). Beneficio: **Alto**/**Medio**, juicio del propio diagnóstico, a revisar por el hogar.
`✅`/`⏳`/`🟡`/`❌` en la columna ID indica, respectivamente: construida, pendiente, alcance reducido
tras el cruce, o descartada.

## 1. Previsión y actualización de datos (`P1`-`P12`)

El motor de previsión es el más maduro de la app — recalibración, bandas de confianza,
estacionalidad, Monte Carlo, backtesting público y árbol causal ya están construidos y con
backlog cerrado (`PVC1`-`PVC19`, `PVX1`-`PVX5`, `PV1`-`PV6`, `FCST-1/2`, todos ✅ en las Oleadas 2-4).
Estas 12 tareas no añaden matemática nueva: hacen visible, accionable y constante lo que hoy hay
que ir a buscar a Ajustes o al Laboratorio de escenarios.

| ID | Tarea | Esfuerzo | Beneficio | Nota |
|---|---|---|---|---|
| ✅ `P1` | Panel «qué cambió desde la última vez» en Hoy | S | Alto | Cerrada sesión 199: nueva tarjeta `homeForecastChangeCard` en `.home-secondary-section` de Hoy. Combina la frase de `causalTreeForMonth`/`previsionChangeOneLiner` (`PVX5`, sobre el mes conciliado más reciente) con la comparación de supuestos de `diffAssumptionSnapshots`/`pvc18ChangeCauses` (`PVC6`/`PVC18`) contra el cierre firmado más reciente — sin selector manual, a diferencia de Ajustes: en Hoy solo hay lectura de un único punto de comparación, el último. Ningún motor nuevo. |
| ⏳ `P2` | Cono de incertidumbre con tooltip (P10/P50/P90 y categoría dominante) | M | Medio | Sobre el SVG ya existente de `PVC19`, sin librería nueva. |
| ⏳ `P3` | Badge de fiabilidad junto a cada cifra proyectada | S | Medio | Deriva de `predictiveHealthIndex` (`PVC17`, `canonical-e16-monitoring.js`). |
| ⏳ `P4` | Dígesto semanal de reforecast material (email/nota, interino de push) | M | Medio | Sobre `reforecastMaterialityAlert` (`PVC8`); a sustituir cuando `A5-4`/push exista. |
| ✅ `P5` | Radar único de supuestos caducados con «revisar ahora» | S | Medio | Cerrada sesión 199: nueva tarjeta `ajustesAssumptionExpiryRadar` en Ajustes, sobre el mismo `assumptionExpiryAlerts` (`PVC15`) que ya se marcaba uno a uno dentro de la lista completa (que sigue igual, sin quitarle su marca en línea). Cada entrada del radar lleva un botón «Revisar ahora»: los cinco supuestos fiscales enfocan su propio campo en la misma tarjeta (`data-scroll-focus`, OPT-7); los cinco generales del forecast navegan al Laboratorio de escenarios, donde sí se editan (`data-home-nav`). Ningún motor nuevo. |
| ⏳ `P6` | Puntuación de acierto histórico permanente en Hoy | S | Alto | Convierte el informe de `pvx1BacktestHtml` (`PVX1`) en KPI fijo. |
| ⏳ `P7` | Captura rápida de gasto por foto o voz, confirmación de un toque | M | Alto | Extiende `canonical-receipt-ocr.js`, pensado para el momento del gasto, no el cierre de mes. |
| ⏳ `P8` | Detector de «gasto fantasma» (subida de precio interanual + nudge) | M | Medio | Extiende la detección de suscripciones (`A16-3`). |
| ⏳ `P9` | Calendario financiero único (hipoteca, seguros, comisiones, fiscal, supuestos) | M | Alto | Une fuentes ya existentes en una sola vista; no es un motor nuevo. |
| ⏳ `P10` | «Ajusta este supuesto en una frase» — interino de reforecast por lenguaje natural | M | Medio | Formulario reducido sobre el motor ya existente; sustituible cuando `A5-1` esté en producción real. |
| ⏳ `P11` | Comparativa contra el mismo periodo del año anterior (no solo mes anterior) | M | Medio | Separa estacionalidad estructural (colegio, vacaciones) de desviación real. |
| ⏳ `P12` | Informe mensual en una página («board pack» doméstico) | M | Medio | Extiende el informe trimestral familiar (`GOB14`) a cadencia mensual. |

## 2. Inversiones (`I1`-`I12`, 11 accionables + 1 descartada)

La cartera está cubierta con rigor notable: XIRR, FIFO real, rebalanceo por umbral, DCA,
fiscalidad de dividendos/plusvalías, apalancamiento tipo Lombard con margin call — backlog cerrado.

| ID | Tarea | Esfuerzo | Beneficio | Nota |
|---|---|---|---|---|
| ⏳ `I1` | Hub único «Inversión» como pantalla principal (Cartera/Rebalanceo/Fiscal/Apalancamiento/Jubilación) | M | Alto | Hoy repartida entre Ajustes y Herramientas avanzadas; mismo movimiento que ya tuvo Deuda en `OPT-24`. Reorganiza, no crea lógica nueva. |
| ⏳ `I2` | Serie histórica real de valoraciones por posición | L | Alto | **No es un hallazgo nuevo** — es el hueco de datos ya documentado desde la Oleada 2 (`APX4`/`IVX1`/`IVX5`, `PROJECT_STATE.md`). Requisito de `I3`. |
| ⏳ `I3` | Mapa de calor de correlación calculada (sustituye la declarada de `INV16`) | M | Medio | Depende de `I2`. `INV16` se construyó deliberadamente declarada/editable por decisión del hogar (sesión 171) — este cambio de fondo necesita confirmación explícita, no solo capacidad técnica. |
| 🟡❌ `I4` | ~~Guardarraíl de crédito Lombard equivalente a `AP4`~~ | — | — | **Descartada tras el cruce.** No es un hueco: `PROJECT_STATE.md` documenta que el crédito Lombard (`APX2`/`APX3`) queda **fuera de `AP4` por decisión explícita del hogar** (garantía real, perfil de riesgo distinto) — «toda tarea nueva de apalancamiento respeta la misma exclusión salvo que se declare lo contrario». Se retira para que ninguna sesión futura reabra la pregunta sin releer esto. |
| ⏳ `I5` | Rescate de pensiones: reducción por antigüedad + modalidad renta | M | Medio | Hueco declarado explícitamente en `FCX1` (`canonical-pension-simulator.js`). |
| ⏳ `I6` | Fiscalidad de cripto, derivados e intradía | L | Bajo | Ningún motor la cubre hoy; priorizar solo si el hogar tiene o prevé tener posiciones de este tipo. |
| ⏳ `I7` | Comparador sociedad patrimonial vs. cartera personal | L | Alto | Relevante para un perfil con retribución variable o participación societaria — verificar primero con el hogar si aplica a su situación real (mismo criterio que descartó Patrimonio/Grandes Fortunas en `LPX`). |
| ⏳ `I8` | Simulador de evento de liquidez (venta de participaciones, ejercicio de opciones) | L | Medio | Integrado con cartera y colchón; verificar con el hogar si tiene un escenario real antes de construir (mismo criterio de `I7`). |
| ⏳ `I9` | Gráficos de cartera con zoom y tooltip | M | Medio | **Requiere decisión previa del hogar**: mantener «cero dependencias externas de UI» o adoptar una librería ligera solo aquí. No empezar sin esa decisión. |
| ⏳ `I10` | Umbral propio de alerta de sobreexposición divisa/geografía | S | Medio | Extiende `INV14` (hoy solo registra la exposición declarada). |
| ✅ `I11` | Coste de diferir la plusvalía, cuantificado en euros | S | Medio | **Cerrada (sesión 199).** Extiende «vender vs. pedir prestado» (`INV10`/`sellVsBorrowComparison`). El comparador ya calculaba `sellTaxCost` (impuesto que se evita al no vender) y `borrowTotalCost` (interés de pedir prestado en su lugar), pero solo dentro de un veredicto que también mezclaba `sellForegoneGrowth` (crecimiento perdido si se retira capital) — dos preguntas distintas sin separar. Nuevo campo `deferredGainCost = borrowTotalCost − sellTaxCost`, aislado del crecimiento perdido, con su propia línea en la tarjeta de INV10. |
| ⏳ `I12` | Campo de «convicción» y fecha de revisión por posición | S | Bajo | Aviso si no se ha revisado en más de 12 meses; evita que el rebalanceo por umbral sea puramente mecánico. |

## 3. Deuda (`D1`-`D10`, 8 accionables + 2 reducidas a verificación, 3 ya cerradas)

Deuda es el módulo con más backlog cerrado y, a la vez, el que arrastra la deuda técnica más
visible: dos motores en paralelo. Prioriza simplificar y ejecutar sobre añadir cálculo nuevo.

| ID | Tarea | Esfuerzo | Beneficio | Nota |
|---|---|---|---|---|
| ⏳ `D1` | Retirar el iframe heredado de deuda (`debt-roadmap.html`) | M | Medio | Decisión de producto, no solo código: confirmar con el hogar cuánto lleva `canonical-e14-parity.js` en verde antes de retirarlo. |
| ✅ `D2` | Reunificación N:1: confirmar si `reunified`/`unifiedPlan` de `normalizeContracts()` ya es la ejecución real | S (verificación) → L si hay brecha | Alto | **Cerrada (sesión 197).** Verificado: `reunified`/`unifiedPlan` ya es la ejecución real declarada por el hogar (Contratos › estado) — no hacía falta motor nuevo. El único hueco real era de enlace: el simulador `DEB6` no conectaba con nada, así que el hogar tenía que reteclear a mano el TIN/plazo ya simulados. Construido: botón «Usar esta oferta en Comparar estrategias» en el resultado de `DEB6` que precarga `deudaCompararOfferTin`/`Plazo` vía `saveDebtConsolidationOffer` — nunca toca `reunified` ni la cifra global ya declarada de la reunificación real (Cetelem), evitando mezclar dos reunificaciones distintas bajo una sola cifra. |
| ✅ `D3` | TIN desconocido: confirmar cobertura por contrato individual, no solo en el agregado | S (verificación) | Bajo | **Cerrada (sesión 197), sin construir nada.** Verificado: el TIN desconocido ya se distingue por contrato individual en dos sitios — el editor de Contratos (input vacío, `placeholder="sin dato"`) y la tabla «Orden de ataque» (`—` por fila, con test dedicado en `d13-deuda-pixel-perfect.test.cjs`). Cobertura completa ya existente, no solo en el agregado. |
| ✅ `D4` | Generador de guion de renegociación con el banco | S | Alto | **Cerrada (sesión 199).** Reutiliza el cálculo ya existente de `DEB4` (radar de refinanciación) y su comparador de escenarios (`evaluateMortgageRateScenarios`, «fixedRateOffer» frente al tipo variable — el «comparador de ofertas» de la nota original). Cuando el radar avisa de una ventana viable, `deb4RenegotiationScriptText()` convierte esos mismos números (sin recalcular nada) en un párrafo listo para leer o pegar en una llamada o email al banco, dentro de un `<details>` plegable junto al aviso. Sin nombre de entidad: `DEB4` no declara esa entidad hoy, y esta tarea no inventa un campo nuevo para conseguirlo. |
| ⏳ `D5` | Deuda neta cruzando activos e inversión (qué posición podría cancelar qué deuda) | M | Alto | Aplica `AP1` (amortizar vs. invertir) línea a línea sobre el inventario de deuda, en vez de solo como simulador aparte. |
| ⏳ `D6` | Benchmark de mercado real en el radar de refinanciación | M | Medio | Hoy compara contra un umbral declarado por el hogar; necesita una fuente de datos (aunque sea manual/trimestral) — sin ella, no construir un motor que finja precisión que no tiene. |
| ✅ `D7` | Coste anual en euros de cada cláusula vigilada | S | Medio | **Construida (sesión 197).** Verificado primero que `GOB16` no cubría nada de esto: declaraba vinculación/comisión/revisión pero sin ninguna cifra en euros. Añadido `bonusRatePenaltyPct` (puntos de TAE que penalizaría el banco si se incumple la vinculación, declarado por el hogar, nunca inferido) y el coste anual = `(bonusRatePenaltyPct/100) × currentPrincipal`, mostrado tanto si la vinculación está incumplida como si se quiere ver el riesgo por adelantado. Sin ese dato declarado, la nota se queda cualitativa igual que antes. |
| ⏳ `D8` | Reparto de carga por titular en la reestructuración conjunta | M | Medio | Extiende `DI5`/`canonical-joint-restructuring.js`, hoy solo con el total conjunto. |
| ⏳ `D9` | Barra de «pagado vs. pendiente» por contrato, con ahorro de intereses marcado sobre ella | S | Medio | Visual, sobre datos ya calculados en la ficha de cada contrato. |
| ⏳ `D10` | Las 5 pestañas de Deuda como un único flujo con navegación de progreso | M | Medio | Ruta/Comparar/Contratos/Simulador/Apalancamiento son hoy pestañas sueltas; reorganiza lo existente, no añade cálculo. |

## 4. Transversales y nuevas (`T1`-`T19`, `T15`-`T19` nacidas de la auditoría `T1`)

Lo que no cabe en un solo módulo: arreglos de arquitectura de información que benefician a las
tres áreas anteriores a la vez, y varias ideas nuevas pensadas para el perfil concreto del hogar.

| ID | Tarea | Esfuerzo | Beneficio | Nota |
|---|---|---|---|---|
| ✅ `T1` | Ejecutar por fin la auditoría Nielsen real sobre Hoy/Registrar/Plan | S | Alto | **Cerrada (sesión 197).** Primera revisión real, con evidencia `file:line`, registrada en `docs/OPT21_CHECKLIST_NIELSEN.md`. 7 hallazgos: 2 corregidos en la misma sesión (`Sobres · Fase 6` filtrado a la UI de Plan; mensaje de error sin instrucción al deshacer una importación), 5 convertidos en tareas nuevas (`T15`-`T19` abajo). |
| ✅ `T2` | Buscador universal (Cmd+K) sobre los 37+ enlaces de navegación | M | Alto | **Cerrada (sesión 199).** Ataca directamente el hallazgo #1 del diagnóstico. **Investigado antes de construir nada**: el buscador ya existía por completo (`e17-experience.js`, atajo Cmd/Ctrl+K, búsqueda difusa, diálogo `e17LauncherDialog`) — no era una tarea de cero. El hueco real: su catálogo `TASKS` tenía 37 entradas pero la navegación real (`index.html`) ya tenía 45 pantallas navegables; 8 no estaban — entre ellas `registrar` y `plan`, dos de las pantallas más usadas del proyecto. Añadidas las 8 (`planificacion-partidas`, `registrar`, `plan`, `cierre`, `analisis`, `prevision`, `update-data`, `operations-manual`) y un test que fija la invariante «todo enlace de navegación tiene entrada en el buscador» para que no vuelva a desincronizarse en silencio. |
| ⏳ `T3` | Bandeja única de decisiones (unifica alertas de presupuesto, refinanciación, LTV, supuestos, seguros, gasto fantasma) | M | Alto | Extiende `canonical-e11b-inbox.js` (E11B), hoy con alcance parcial. |
| ⏳ `T4` | Resolver «directiva vs. informativa» en las ~15+ pantallas antiguas | S (decisión) | Medio | Decisión de producto pendiente, ya reconocida en `PROJECT_STATE.md`: aplicar la política del 12/09 hacia atrás, o documentar por qué esas pantallas se quedan como están. El propio texto ya prevé que el hogar puede pedirlo expresamente. |
| 🟡 `T5` | Completar `A14-2` con serie histórica y banda de confianza de patrimonio neto | M | Alto | **Alcance reducido tras el cruce** (no es «crear un balance desde cero», como decía el diagnóstico original). La cifra puntual y el desglose por tipo (`A14-1`, `A14-2` núcleo, `A14-4`) ya están construidos; el propio código señala explícitamente «sin histórico ni banda de confianza todavía — sesión aparte» (`app.js`). Esta tarea es exactamente esa sesión aparte, con gráfico de cascada mensual. |
| ⏳ `T6` | Memo de decisión ejecutivo autogenerado (una página: recomendación, riesgos, sensibilidad, siguiente paso) | M | Alto | Para decisiones grandes (refinanciar, apalancarse, comprar/vender vivienda); la app ya tiene el cálculo, falta el formato de síntesis. |
| ⏳ `T7` | Modo oscuro real | M | Medio | Cero ocurrencias de `prefers-color-scheme` hoy en `design-tokens.css`/`styles.css`. |
| ⏳ `T8` | `prefers-reduced-motion` y modo de alto contraste | S | Bajo | Accesibilidad real más allá del buen trabajo ya hecho en aria/roles. |
| ⏳ `T9` | Migración progresiva a mobile-first en los componentes de mayor uso diario | L | Medio | No es un rediseño completo: invertir el orden de las reglas, no reescribirlas. |
| ⏳ `T10` | PWA instalable con vista «de un vistazo» (colchón, deuda cara, próximo vencimiento) | M | Medio | Sobre el `manifest.webmanifest` ya existente. |
| ⏳ `T11` | Ficha de gasto con foto y geolocalización opcional | S | Bajo | Para reconciliar más rápido sin depender de la descripción del banco. |
| ⏳ `T12` | Comparador «yo vs. mi propio histórico» (mejor mes / peor mes / media 12 meses) | S | Medio | Mismo lenguaje de bandas que ya usa la previsión. |
| ⏳ `T13` | Herencia financiera con aportación equivalente de los padres | M | Bajo | Extiende la vista educativa para hijos (`MDX1`). |
| ⏳ `T14` | Reducir el monolito técnico (`app.js` 2,1MB) | L | Alto | No es una feature visible: es la condición para construir el resto de este documento a buen ritmo sin encarecer cada entrega futura. |
| ✅ `T15` | Confirmación visible de «guardado» en Plan | S | Medio | **Cerrada (sesión 199).** Nace de `T1` (heurístico 1, `docs/OPT21_CHECKLIST_NIELSEN.md`, revisión del 16/09). El pie de impacto de Plan (`planMesImpactBar`) mostraba y ocultaba la barra solo en función de si quedaban cambios sin guardar; al guardar, la barra desaparecía sin decir nada. Añadida `planMesConsolidatedNote` (mismo patrón que `registrarSessionConsolidatedNote`, R-7): tras «Guardar cambios», la barra muestra «Cambios guardados.» durante 2 s antes de ocultarse. |
| ⏳ `T16` | Unificar el vocabulario «previsto vs. real» en Hoy/Registrar/Plan | M | Alto | Nace de `T1` (heurístico 4, mayor severidad de las cinco). Tres vocabularios distintos hoy para el mismo concepto: Registrar («Previsto/Real/Usado»), Plan («Ingreso previsto/Comprometido/Asignado/Sin asignar»), Home («Gasto previsto/Gasto real a hoy/Desviación»). Necesita que el hogar decida qué término adoptar como estándar antes de tocar las tres pantallas — no es un renombrado mecánico, cada pantalla podría tener un motivo real para su matiz. |
| ✅ `T17` | Repetir el colchón/reserva protegida en la pestaña Previsión de Plan | S | Medio | **Cerrada (sesión 199).** Nace de `T1` (heurístico 6). La fila «Colchón» de la tabla ya coloreaba cada mes contra el suelo (`mapaCalorFloor()`), pero la cifra solo aparecía enterrada al final de la frase de la leyenda. Ahora `planPrevisionLegend` abre con «Reserva protegida: €X.» antes del resto de la explicación — mismo dato que ya gobernaba el color de la fila, no una cifra nueva ni importada de Home/Registrar (esas usan `today.requiredReserve`, un número relacionado pero distinto — unificarlo es `T16`, no esta tarea). |
| ⏳ `T18` | Revisar la densidad de Hoy contra su propia regla de 4 bloques | M | Medio | Nace de `T1` (heurístico 8). El comentario de `index.html:307-311` declara «máximo 4 bloques en la zona principal, sin scroll en desktop»; la implementación real tiene 9 artículos estáticos más 2 rejillas dinámicas. Antes de tocar nada, confirmar con el hogar si la regla declarada sigue siendo el objetivo o si ya se aceptó conscientemente más densidad. |
| ✅ `T19` | Añadir «Guía de este flujo» a Plan | S | Medio | **Cerrada (sesión 199).** Nace de `T1` (heurístico 10). Home y Registrar ya tenían el botón de ayuda contextual (`data-e17-open="guide"` → `openE17Dialog("guide")`); ahora Plan también, cableado igual (delegación global ya existente, sin JS nuevo). El contenido sigue siendo el genérico de `GUIDE_TOPICS` — igual que Home y Registrar, que tampoco tienen entrada propia ahí; escribir guía específica por pantalla es un alcance mayor, fuera de esta tarea. |

## 5. Descartado tras el cruce

| ID | Motivo |
|---|---|
| `I4` | Guardarraíl Lombard equivalente a `AP4` — no es un hueco, es una exclusión decidida explícitamente por el hogar (ver §2). |

## 6. Priorización y orden de ejecución sugerido

No se recomienda abordar las 52 a la vez — sería repetir el mismo error de fondo que ya produjo
37 pantallas. Tres horizontes:

**Horizonte 1 — ya (bajo esfuerzo, alto impacto):** solo `P6` queda (`T2`, `D4`, `I11`, `P1`, `P5` y
las tres nacidas de `T1` sin decisión previa pendiente — `T15`/`T17`/`T19` — ya se cerraron en la sesión 199).
`T16` (unificar vocabulario, la de mayor severidad de las cinco) y `T18` (densidad de Hoy) necesitan
una decisión del hogar antes de construirse — ver su nota en §4.

**Horizonte 2 — próximo trimestre (apuestas estructurales):** `T5`, `I1`, `D10`, `T7`, `T8`, `T4`,
`P9`, `D5`.

**Horizonte 3 — condicionado (decisión previa o de terceros):** `I9` (decidir dependencias UI),
`I2`/`I3` (histórico de valoraciones), `T14` (reducir el monolito, prerrequisito de velocidad
futura), `P4`/`P10` (interinos de push e IA, a sustituir cuando lleguen `A5-1`/`A5-4`), `D6`
(necesita fuente de datos externa).

**Verificaciones de `D2`/`D3`/`D7` cerradas en la sesión 197**, antes del resto del Horizonte 1:
`D3` no dio trabajo real (cobertura ya completa); `D2` y `D7` sí dieron trabajo, pero acotado (un
enlace de UX y un campo declarado + cálculo en euros, respectivamente) — detalle en la fila de cada
una en §3. En su momento (sesión 197) el Horizonte 1 seguía con `T1`, `T2`, `D4`, `I11`, `P1`, `P5`,
`P6`; `T1` y `T2` ya se cerraron después (sesiones 198 y 199) — estado real siempre en §6, no aquí.

## 7. Pendiente del backlog anterior (heredado, no nace de esta auditoría)

Estas tareas no vienen del diagnóstico de arriba — son el remanente real del ciclo anterior
(`BACKLOG_SUCESION_Y_CONTINUIDAD.md`, cerrado 100 % el 16/09, y las colas que quedaron abiertas
antes de él), documentado en `BACKLOG_INDICE.md`. Se incorporan aquí para que quien retome tenga
**una sola lista** de todo lo pendiente del proyecto, viejo y nuevo, en vez de tener que cruzar
varios documentos.

| Tarea | Backlog de origen | Qué falta | Condición de desbloqueo | Quién la controla |
|---|---|---|---|---|
| `OPT-10`, `OPT-11`, `OPT-12`, `OPT-13` | `BACKLOG_ULTIMATE_SEPTIEMBRE.md` | Nada de esfuerzo propio — solo esperar | Reloj de 30 días de `OPT-2` (arrancó 29/08, cumple 28-29/09/2026) | Calendario |
| `RGX3` (Bloque 6) | `BACKLOG_ULTIMATE_SEPTIEMBRE_OLEADA_2.md` | Construir la tarea | `A5-1` (IA) activo en producción real, no solo en base local | Externa — infraestructura sin fecha |
| `DEX6` (Bloque 1) | `BACKLOG_ULTIMATE_SEPTIEMBRE_OLEADA_2.md` | Construir la tarea | `A5-1` en producción real | Externa — misma condición que `RGX3` |
| `GOB5` | `BACKLOG_ULTIMATE_SEPTIEMBRE_OLEADA_3.md` | Construir la tarea | `A5-4` — backend push en producción | Externa — infraestructura sin fecha |
| `O-6` (= `T-3` en `BACKLOG.md`) | `BACKLOG_OPERACION.md` | Contratar proveedor (candidato evaluado: GoCardless) | Decisión de contratación PSD2 | Decisión de producto, fuera del equipo de desarrollo |
| Copiloto/IA — superficie de UI (`E9-1`/`GOB17`) | `BACKLOG_SUCESION_Y_CONTINUIDAD.md` §2 (auditado sesión 195) | Construir una pantalla nueva desde cero — la sesión 42 retiró el único llamador real (widget «Asistente financiero») y no queda ninguna superficie de UI que active `prepareQuery`/`validateResponse` | `A5-1` en producción real; **implica además construir UI nueva, no solo activar un backend** | Externa (`A5-1`) + trabajo de UI pendiente de priorizar cuando se cumpla |

**Para quien retome:** el primer paso sigue siendo re-verificar si `OPT-2`, `A5-1` u `O-6` ya se
cumplieron (sesión 195) — es el único desbloqueo real de esta tabla. Ninguna de las tareas nuevas
de este documento (§1-§4) depende de estas tres condiciones, salvo `P4`/`P10`/`I9`, ya señaladas
como Horizonte 3 en §6.

## 8. Advertencia

Ninguna tarea de este documento cambia los invariantes ya vigentes del proyecto: `A11-4` (ninguna
acción financiera real — comprar, vender, amortizar, transferir, tomar deuda nueva — se ejecuta sin
confirmación explícita del hogar), la disciplina fiscal de nunca fabricar un tramo o bonificación
sin fuente completa y declarada, y el límite de que ningún motor decide ni sustituye asesoría
profesional real. `T6` (memo de decisión ejecutivo) sintetiza cálculos ya existentes — nunca decide
por su cuenta. `I7`/`I8` necesitan confirmación del hogar de que su situación real las justifica
antes de construirse, mismo criterio que ya descartó Patrimonio/Grandes Fortunas en `LPX`.
