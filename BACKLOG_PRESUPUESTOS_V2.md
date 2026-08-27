# Backlog Integrado: Presupuestos + Forecasting (v2)

**Fecha**: 26 de agosto de 2026  
**Versión**: Integración de BACKLOG_PRESUPUESTOS.md + Plan Ambicioso  
**Estado**: Aprobado y en ejecución — FASE 0 a FASE 5 completadas. FASE 5 (Experiencia & Mobile):
U-2, U-3, U-4 y **PERF-1 cerrado dentro de lo seguro** — mecanismo de carga diferida construido y
escalado a 4 clústeres de pantallas (piloto/Presupuesto del mes, Deuda, Cierre/Conciliar, Análisis)
sin bundler; los 6 clústeres restantes quedan descartados por entrelazado con el motor compartido de
Escenario/Agente o con Cuadro de mandos/Planificación de partidas — ver hallazgos abajo. El objetivo
original de Lighthouse >85 no se alcanzó y requeriría una reestructuración mayor, fuera de alcance

---

## Resumen Ejecutivo

Transformación de contabilidadcasa de un dashboard de visualización a una **plataforma de decisión presupuestaria en tiempo real**. El usuario sabe qué debe hacer cada día, ve el impacto de sus decisiones a 12 meses vista, y recibe ayuda automática para ajustar presupuestos.

**Pilares**:
1. Presupuestos inteligentes (análisis histórico + sugerencias basadas en patrones)
2. Seguimiento operativo diario (ritmo esperado vs. real, alertas en contexto)
3. Forecasting granular (predicciones por categoría con confianza)
4. Simulaciones y "¿y si...?" (impacto en deuda, caja a 3/6/12 meses)
5. Experiencia fluida (móvil, notificaciones, sin fricción)

---

## 📅 6 Fases de Entrega (24 semanas)

### **FASE 0 (Fundación) — Semanas 1-2 | INICIADA**

Crear arquitectura canónica compartida y tests robustos.

| Tarea | Qué hace | Estado | Esfuerzo |
|-------|----------|--------|----------|
| **ARCH-0** | 4 módulos canónicos + esquema SQL | ✅ DONE | Medio |
| **P-1** | Análisis histórico + sugerencia presupuestos | ✅ DONE | Medio |
| **TEST-0** | Suite 150+ tests (1621/1621 en verde) | ✅ DONE | Bajo |

**Módulos Creados**:
- `canonical-budget-analyzer.js` (470 líneas): análisis de 6-12 meses, estadísticas, confianza
- `canonical-budget-alerts.js` (350 líneas): alertas de desviación, ritmo diario
- `canonical-budget-schema.js` (200 líneas): validación y persistencia
- `canonical-budget-forecast-category.js` (300 líneas): forecast con estacionalidad
- `tests/budget-core.test.cjs` (400 líneas): cobertura completa

**Hito Alcanzado**: Motor de análisis validado, presupuestos sugeridos funcionando, CI verde.

---

### **FASE 1 (Visibilidad) — Semanas 3-5 · COMPLETADA (26 de agosto)**

Usuario ve dónde está cada día, toma decisiones informadas.

| Tarea | Qué hace | Esfuerzo | Bloqueador | Estado |
|-------|----------|----------|-----------|--------|
| **S-1** | Alertas de desviación por categoría (ritmo vs. real) | Medio | ARCH-0 | ✅ |
| **P-2** | Dashboard `#presupuesto-mes`: tabla + barras de progreso | Medio | ARCH-0 | ✅ |
| **S-2** | Proyección fin de mes + recomendaciones | Medio | ARCH-0 | ✅ |
| **U-1** | Card en "Hoy" resumiendo presupuesto + insignia de ritmo | Bajo | P-2 | ✅ |

**Construido**:
- Nueva sección `#presupuesto-mes` (grupo "Analizar" del menú avanzado, y en el lanzador Cmd+K),
  reutilizando el componente visual de Plan · Presupuesto de mes (`.e19-plan-mes`, misma tabla,
  barras de progreso y tarjeta que ya usa `planMesBudgetTableHtml`) para no introducir un patrón
  visual nuevo.
- La "categoría" de presupuesto es la categoría bancaria de `classifyTransaction()`
  (`row.category`), no la partida del plan: es el agrupador que ya usa
  `buildRollupsFromTransactions()` para "gasto por categoría y mes".
- Botón "Sugerir presupuestos": ejecuta `CanonicalBudgetAnalyzer` sobre los últimos 6 meses de cada
  categoría con gasto y crea presupuestos con `source: "suggested"` (p75 histórico).
- Cada fila combina S-1 (alerta on-track/overspend/underspend vía `CanonicalBudgetAlerts`) y S-2
  (proyección lineal de fin de mes) en las columnas "Estado" y "Proyección fin de mes".
- Presupuesto editable inline (`<input type="number">`, mismo patrón que Plan · Presupuesto de
  mes) y botón "Quitar" por categoría.
- U-1: card `renderHomeKpi` en Hoy (mismo componente que caja/deuda/reserva) con el agregado del
  mes — solo aparece si existe al menos un presupuesto para el mes en curso — enlazando a
  `#presupuesto-mes`.
- Persistencia: `state.budgets[]` con los 5 puntos de enganche estándar del proyecto
  (`appStatePayload`, `applyPersistedPayload`, `loadLocalState` + fallback, `saveLocalSnapshot`,
  `saveBudgets()`), sin tocar `canonical-supabase-store.js` (viaja dentro del blob de snapshot).
- Los 4 módulos de FASE 0 se convirtieron de `export class` (ESM) al patrón IIFE +
  `window.FinanceCanonicalBudgetXxx` que usa el resto del proyecto (`canonical-e13-scenarios.js` et
  al.), manteniendo el `module.exports` para que los tests de Node seguido funcionando sin cambios.

**Validación** (`npm run verify`, exit 0): 1621/1621 tests en verde (incluye 2 tests de estructura
de navegación actualizados al contar el nuevo enlace), accesibilidad (829 IDs únicos), rendimiento,
build del sitio, privacidad y smoke test. QA visual con Playwright (datos sintéticos inyectados en
memoria, ya que el demo público no trae movimientos bancarios): tabla con presupuesto sugerido,
barra de ritmo al 85% en ámbar, alerta "En ritmo", proyección de fin de mes con exceso señalado, y
la card de Hoy mostrando "330,00 € / 388,38 €" con enlace a la pantalla completa.

**Corrección post-publicación (26 de agosto, mismo día)**: el usuario probó la pantalla en
producción y detectó que "Gastado" daba 0,00 € en todas las categorías pese a llevar gasto real
registrado en agosto. Causa: "Gastado" solo miraba movimientos bancarios clasificados
(`row.category`), pero el uso real del hogar mezcla extracto importado con partidas registradas a
mano en "Registrar el mes" — dos modelos de datos sin relación 1:1 (categoría bancaria vs. partida
del plan). Arreglo:

- `defaultCategoryForPartida()`: reutiliza `classifyTransaction()` sobre el texto de la partida
  (label + sección) como heurística por defecto, mismo vocabulario que ya usan los movimientos
  bancarios, sin duplicar reglas de clasificación.
- `budgetPartidaOverrides` (nuevo, persistido con los 5 puntos de enganche estándar): permite
  reasignar la categoría de una partida concreta cuando la heurística no acierta, desde una tabla
  nueva "Partidas registradas a mano este mes" bajo el presupuesto.
- Solo se suman partidas con real **puro a mano** (`planMesUsadoMovementCount(entry, monthKey) ===
  0`): si el real de una partida viene de movimientos bancarios ya mapeados, esos movimientos ya
  están contados en `baseData.transactions` y sumarlos otra vez duplicaría el gasto.
- El gasto manual se inyecta como "movimiento sintético" (`{date, amount}` por mes) en el mismo
  pipeline que ya usan `CanonicalBudgetAlerts`/`CanonicalBudgetAnalyzer`, sin tocar esos módulos —
  la fusión ocurre en la capa de ensamblado de datos de `app.js`, no en el motor canónico.
- Aplicado tanto al "Gastado" del mes en curso (alertas, ritmo, proyección) como al histórico de 6
  meses que alimenta "Sugerir presupuestos" (`recentBudgetMonthKeys`, acotado a 6 meses para no
  recorrer todo el horizonte de forecast).
- `budgetableCategories()` ahora también ofrece categorías que solo existen vía partida (antes solo
  las que tenían algún movimiento bancario histórico).

QA visual con Playwright: presupuesto de 90€ (histórico bancario) + partida manual de 120€
reasignada a la misma categoría → "Gastado" pasa de 0€ a 120€, ritmo al 100%, estado "Por encima
del ritmo", proyección 143,08€ con "+53,08€ sobre" — confirma la fusión sin duplicar cuando no hay
movimientos bancarios en el mes en curso.

**Validación tras el arreglo** (`npm run verify`, exit 0): 1621/1621 tests, accesibilidad (829 IDs
únicos), rendimiento (43,0 ms / 208,9 ms).

**Criterios de Éxito**:
- [x] Usuario ve presupuesto diario con alertas en Hoy
- [x] Proyección de fin de mes es auditable contra datos reales
- [ ] QA móvil: pendiente de verificar en 390px (no se descarta ajuste en FASE 4 — U-3)
- [x] Performance: Hoy carga <1s (rendimiento global sigue en 44,8 ms/221,9 ms tras el cambio)
- [ ] Publicado en main — PR pendiente de abrir tras este cierre

---

### **FASE 2 (Flexibilidad) — Semanas 6-8 · COMPLETADA (26 de agosto)**

Presupuestos que aprenden, se adaptan, se mejoran solos.

| Tarea | Qué hace | Esfuerzo | Bloqueador | Estado |
|-------|----------|----------|-----------|--------|
| **P-3** | Gestión de hucha: no gastado → opciones de decisión | Bajo | P-2 | ✅ |
| **F-1** | Forecast por categoría + detección estacionalidad | Medio | ARCH-0 | ✅ |
| **S-3** | Histórico visual 12 meses: presupuesto vs. real | Bajo | ARCH-0 | ✅ |
| **LINK-1** | Vincular presupuestos a metas de ahorro en deuda | Medio | F-1 | ✅ |

**Construido**:
- **F-1**: `canonical-budget-forecast-category.js` (creado en FASE 0, sin usar hasta ahora) entra en
  juego vía `suggestedAmountForCategory()`. Su propio `suggestedBudget(analysis, forecastData)` ya
  decide cuándo preferir el forecast con estacionalidad sobre el p75 histórico plano (confianza
  alta del forecast) — no se reimplementa ese criterio, solo se conecta.
- **P-3 (hucha)**: nueva tarjeta "Hucha: lo no gastado este mes" bajo el presupuesto, con 3 opciones
  por categoría con sobrante (guardar como ahorro, llevar al mes siguiente, gasto flexible), mismo
  patrón de "decisión transitoria con opciones" que ya usa Cierre · Sobres
  (`cierreSobresChoices`/`cierreSobresResolved`), replicado en vez de inventado. Solo "llevar al mes
  siguiente" tiene efecto automático real: `budgetCarryoverForCategory()` suma el sobrante al
  presupuesto sugerido del mes siguiente (`suggestedAmountForCategory`) — verificado: 300€ base +
  200€ de arrastre = 500€. "Guardar como ahorro" y "gasto flexible" quedan registrados para el
  histórico; mover saldos entre cuentas queda fuera de alcance de esta fase (requeriría enlazar con
  el plan de ahorro del hogar, no solo con presupuestos).
- **S-3**: tarjeta "Histórico de 12 meses" con una fila por categoría presupuestada y una columna
  por mes, coloreada con los badges ya existentes (`e19-badge-success/-warning/-danger`) según %
  gastado. Corrige un bug real encontrado en el propio desarrollo: los 12 meses se generaban con
  `selectableMonths()` (la ventana de forecast del plan, no el calendario), dejando fuera meses
  históricos anteriores al arranque del modelo — se sustituyó por aritmética de fechas pura
  (`recentBudgetMonthKeys`). También se corrigió `budgetAlertForRow()` para aceptar meses pasados:
  `CanonicalBudgetAlerts` filtra sus movimientos por el mes de "hoy", así que para un mes cerrado
  hay que fingir que "hoy" es su último día (`budgetDateContextFor()`), o "Gastado" volvía a dar 0
  en todo el histórico — el mismo síntoma que motivó la corrección de FASE 1.
- **LINK-1**: tarjeta "Impacto en tu deuda" que reutiliza `debtPriorityCandidates()` y
  `debtReliefMonthsForItem()` del motor de Escenarios (E13) tal cual — no se reimplementa el
  cálculo de alivio de deuda. Solo aparece si hay margen libre positivo y la deuda candidata tiene
  cuota activa (no suspendida); verificado con el motor real (2400€ principal + 200€/mes extra → 14
  meses de alivio, fórmula existente). En el demo público las 3 deudas están suspendidas (0€/mes de
  cuota activa), así que la tarjeta no aparece ahí — comportamiento correcto, no un fallo.

**Validación** (`npm run verify`, exit 0): 1621/1621 tests, accesibilidad (829 IDs únicos),
rendimiento (diff 10.000 filas en 39,6 ms; forecast y escenarios en 201,9 ms; recursos 1852 KB). QA
visual con Playwright: presupuesto sugerido con forecast, hucha con 3 opciones funcionando,
histórico de 12 meses completo tras el fix de `recentBudgetMonthKeys`, arrastre de hucha verificado
matemáticamente (200€ → +200€ en el mes siguiente).

---

### **FASE 3 (Simulaciones) — Semanas 9-11 · COMPLETADA (26 de agosto)**

"¿Y si corto gasto en comida?" responde al instante.

| Tarea | Qué hace | Esfuerzo | Bloqueador | Estado |
|-------|----------|----------|-----------|--------|
| **SIM-1** | Motor "¿y si...?" para cambios rápidos de presupuesto | Medio | P-2, F-1 | ✅ |
| **SIM-2** | Visualizar impacto en caja, cobertura, deuda a 3/6/12 meses | Medio | SIM-1 | ✅ |
| **SIM-3** | Comparador: presupuesto actual vs. simulado en histórico | Bajo | SIM-2 | ✅ |
| **LINK-2** | "Si ahorras 50€/mes en comida, deuda se paga 6 meses antes" | Bajo | SIM-2 | ✅ |

**Construido**:
- **SIM-1**: tarjeta "Simulador «¿y si...?»" con categoría + cambio mensual (€). Simulación
  efímera en memoria (`budgetSimulation`), sin persistir — mismo criterio que el laboratorio de
  escenarios de E13: no toca `budgets[]`, se pierde al recargar.
- **SIM-2**: tarjeta "Impacto de la simulación" (3/6/12 meses: ahorro acumulado, caja proyectada,
  cobertura), reutilizando `safeCoverageMonths()` y `accountBalancesFromState()`. Bug real
  corregido antes de publicar: un recorte de presupuesto (delta negativo) se traducía en "ahorro"
  negativo — corregido invirtiendo el signo (recortar libera caja, subir la consume). Verificado
  con Playwright y datos sintéticos.
- **SIM-3**: tarjeta "Comparador: actual vs. simulado" sobre el mismo histórico de 12 meses de S-3,
  reutilizando `budgetAlertForRow()` con un presupuesto sintético.
- **LINK-2**: tarjeta "Impacto simulado en tu deuda", misma mecánica que LINK-1
  (`debtPriorityCandidates()`/`debtReliefMonthsForItem()` de E13 tal cual), alimentada por el
  ahorro simulado en vez del margen libre real.

**Validación** (`npm run verify`, exit 0): 1621/1621 tests, accesibilidad (829 IDs únicos),
rendimiento (diff 10.000 filas en 31,0 ms; forecast y escenarios en 181,8 ms; recursos 1862 KB). QA
visual y funcional con Playwright y datos sintéticos inyectados en memoria (el demo público no trae
movimientos bancarios ni deudas con cuota activa).

---

### **FASE 4 (Gamificación & Inteligencia) — Semanas 12-16 · COMPLETADA (26 de agosto)**

Usuario vuelve cada día, entiende sus patrones. **Reordenada antes que la FASE de Experiencia &
Mobile** (petición del usuario, 26 de agosto): ninguna de sus tareas depende de U-2/U-3/U-4/PERF-1,
solo de P-2/S-1/P-3/F-1, ya completados en FASE 0-2.

| Tarea | Qué hace | Esfuerzo | Bloqueador | Estado |
|-------|----------|----------|-----------|--------|
| **GAME-1** | Sistema de objetivos presupuestarios: metas mensuales por categoría | Medio | P-2 | ✅ |
| **GAME-2** | Badges/logros: "Ahorrista" (3 meses bajo presupuesto), "Equilibrador", etc. | Bajo | GAME-1 | ✅ |
| **GAME-3** | Retos: "El mes que menos gastamos todos en comida" | Bajo | GAME-1 | ✅ |
| **NOTIF-1** | Notificaciones inteligentes: deviación, hito, hucha disponible | Medio | S-1, P-3 | ✅ |
| **ML-1** | Análisis de cohortes: "Tus meses de julio gastan 15% más" | Bajo | F-1 | ✅ |
| **COMP-1** | Companion CLI: registrar gastos rápido desde terminal | Bajo | P-2 | ✅ (alcance reducido a solo lectura, ver más abajo) |

**Construido**:
- **GAME-1**: `budgetComplianceStreak()` cuenta meses consecutivos sin sobregasto, reutilizando
  `budgetAlertForRow()`. Tarjeta "Objetivos: meses seguidos dentro de presupuesto".
- **GAME-2**: badges "Ahorrista" (racha ≥3 dentro de presupuesto) y "Equilibrador" (racha ≥3 en la
  banda 80-100%, mismos umbrales que los badges de color de S-3). Tarjeta "Logros".
- **GAME-3**: "el mes que menos gastas" compara la proyección de fin de mes (S-2) con el mínimo
  histórico real de 12 meses, reutilizando `budgetProjection()`/`budgetAlertForRow()`.
- **NOTIF-1**: centro de avisos en pantalla (sin canal de push real todavía) que consolida
  desviación (S-1), hito (badges de GAME-2) y hucha sin decidir (P-3).
- **ML-1**: agrupa el gasto real histórico (24 meses) por mes de calendario y compara contra la
  media global de la categoría; solo informa con 2+ observaciones y desviación ≥10%.
- **COMP-1**: `tools/finanzas-cli.mjs` (`registra <importe> <categoria>`, `pendientes`). Investigar
  el guardado real antes de construir reveló un protocolo transaccional versionado
  (`finance_sync_runs`/`finance_state_snapshots`/`finance_source_heads` con concurrencia
  optimista) mucho más complejo que un simple upsert — reimplementarlo sin poder probarlo contra
  Supabase real se consideró demasiado arriesgado. Con el usuario, se redujo el alcance: el CLI es
  **solo lectura** contra Supabase (lee el último estado sincronizado para calcular el ritmo,
  mismas credenciales que la web) y guarda el gasto en un fichero local
  (`~/.finanzas-casa/pendientes.jsonl`); confirmarlo de verdad sigue siendo un paso manual en
  "Registrar el mes". Reutiliza tal cual `canonical-budget-schema.js`, `canonical-budget-alerts.js`
  y `canonical-supabase-store.js` (ya pensados para Node), sin dependencias nuevas.

**Validación** (`npm run verify`, exit 0): 1621/1621 tests, accesibilidad (829 IDs únicos),
rendimiento (diff 10.000 filas en 27,9 ms; forecast y escenarios en 150,1 ms; recursos 1874 KB). QA
visual con Playwright y datos sintéticos: racha de 3 meses gana ambos badges, reto marca
correctamente "por encima del récord", patrón estacional detecta julio a +58% sobre la media.

---

### **FASE 5 (Experiencia & Mobile) — Semanas 17-20 · 3/4 (26 de agosto)**

App usable y brilla en móvil. Pasa a ir después de Gamificación (petición del usuario, 26 de
agosto).

| Tarea | Qué hace | Esfuerzo | Bloqueador | Estado |
|-------|----------|----------|-----------|--------|
| **U-2** | Rediseño de "Hoy": grid 2×2 (presupuesto + caja + objetivos + acciones) | Medio | P-2, S-2 | ✅ |
| **U-3** | Mobile-first: todas las pantallas de presupuestos en 390px | Alto | P-2, P-3, SIM-1 | ✅ |
| **U-4** | Lanzador mejorado: acciones de presupuesto | Bajo | S-1, U-2 | ✅ |
| **PERF-1** | Optimización de rendimiento: Lighthouse >85 | Bajo | U-3 | ✅ Cerrado dentro de lo seguro: 4 clústeres escalados, sin regresión; Lighthouse >85 no alcanzado, ver hallazgos abajo |

**Construido**:
- **U-2**: rejilla "de un vistazo" 2×2 en Hoy (`#homeBudgetGlance`) — presupuesto (P-2/U-1), caja
  (mismo saldo que "Liquidez hoy"), objetivos (racha más larga y categorías activas, GAME-1) y
  accesos rápidos (presupuesto, registrar el mes, ruta de deuda). Reutiliza `renderHomeKpi()` tal
  cual, sin nuevo componente visual.
- **U-3**: auditoría real a 390px con Playwright (no solo revisión de CSS) en Hoy, Presupuesto del
  mes, Registrar el mes, Plan de mes y Ruta de deuda. Encontró y corrigió un bug real de
  "desbordamiento de grid": `.home-dashboard` era un `display:grid` sin `grid-template-columns`
  explícito, así que sus hijos (incluida la rejilla de seis KPI ya existente, y la nueva de U-2) se
  desbordaban a 550px en un viewport de 390px — invisible en escritorio, pero recortaba contenido
  en móvil sin que la página mostrara scroll horizontal (un `overflow-x: clip` en `.workspace` lo
  ocultaba). Corregido con `grid-template-columns: minmax(0, 1fr)`. Verificado que las 5 pantallas
  quedan sin desbordamiento tras el fix.
- **U-4**: ampliado el vocabulario de búsqueda del lanzador (`e17-experience.js`) para que
  "simulador", "racha", "hucha", "reto" o "estacional" encuentren "Presupuesto del mes" — antes
  solo se localizaba por "presupuesto". Añadida también su guía contextual ("¿Para qué sirve?"),
  que no existía.

**PERF-1 — hallazgos, sin construir todavía**: medido con Lighthouse real (`npx lighthouse`) contra
el sitio construido. Con el perfil por defecto (simula CPU/red de gama baja), la puntuación de
rendimiento es **55**; sin ese estrangulamiento adicional (perfil `provided`, más parecido a un
ordenador real), **75-76** en mediciones repetidas — por debajo del objetivo de 85 en ambos casos
(una primera medición aislada dio 88, pero no se reprodujo; hay ruido real de entorno en este
sandbox). La causa raíz: ~3,6 MB de JS repartidos en 56 archivos `<script>`, cargados enteros para
cualquiera de las ~30 pantallas de la app, con "JavaScript sin usar" estimado en 1,7 MB por
Lighthouse — el motor de arranque (`init()`) ya solo renderiza la pantalla activa
(`scheduleActiveSectionRender()`), así que no hay ahí trabajo redundante que recortar; el coste es
descargar/parsear/ejecutar código de pantallas que no se están viendo.

Se probó añadir `defer` a los 56 `<script>` (hipótesis: paralelizar la descarga). Verificado con
Playwright en varias pantallas sin errores de consola nuevos, pero **la puntuación de Lighthouse
empeoró (75→72)**: adelanta el primer pintado pero concentra la ejecución de los 56 scripts en un
solo bloque justo antes de `DOMContentLoaded`, empeorando el "Total Blocking Time" (470ms→2.380ms)
más de lo que mejora el resto. **Revertido** tras medir — no se publica un cambio que empeora el
propio objetivo que perseguía.

El arreglo real (dividir `app.js` y cargar cada pantalla bajo demanda) es una reestructuración de
arquitectura mucho mayor que el esfuerzo "Bajo" que tenía asignado esta tarea, con riesgo de
regresión en las ~30 pantallas existentes — pendiente de decidir alcance con el usuario antes de
construir, mismo criterio que se aplicó a COMP-1 en FASE 4.

**Validación** (`npm run verify`, exit 0): 1621/1621 tests, accesibilidad (830 IDs únicos),
rendimiento (diff 10.000 filas en 38,4 ms; forecast y escenarios en 196,1 ms; recursos 1879 KB).

**PERF-1 — mecanismo construido y validado con un piloto (sesión siguiente)**: `app.js` es un
`<script>` clásico, no un módulo ES — todas sus funciones viven en un único scope global. Eso
permite partir el bundle sin bundler: un fichero movido a `views/` y cargado como `<script>` clásico
inyectado por JS (no puesto en `index.html`) aterriza en ese mismo scope, así que sus funciones
siguen disponibles igual que antes. Construido: `VIEW_CHUNKS`/`loadViewChunk()` en `app.js` (carga
bajo demanda, cachea, no repite descarga) y `renderActiveSection()` ahora espera el fragmento antes
de renderizar, reutilizando el camino ya existente de `HEAVY_RENDER_VIEWS` (muestra "calculando"
mientras tanto). Piloto: "Presupuesto del mes" extraído a `views/presupuesto-mes.js` (~760 líneas),
dejando en `app.js` solo lo que Hoy también usa (`homeBudgetSummary`, `budgetAlertForRow`,
`budgetComplianceStreak`...). Verificado en navegador real (Playwright): el fragmento se descarga
una sola vez, sin `ReferenceError` en ninguna de sus 19 funciones movidas. Lighthouse tras el piloto:
73-76 (tres ejecuciones), igual que la baseline pre-piloto — sin regresión, pero sin ganancia
medible todavía: mover una sola pantalla (~40 KB de ~3,6 MB) no puede notarse; hace falta escalar la
misma extracción a más pantallas para que el ahorro deje de ser ruido.

**PERF-1 — escala #2: Deuda, y dos hallazgos que corrigen el propio mecanismo (sesión siguiente)**:
se descartó el clúster de Cuadro de mandos/Planificación de partidas (~3.000 líneas) como siguiente
paso: mapeando sus dependencias resultó ser infraestructura de edición (estado de borrador, guardar/
descartar) compartida por Cuadro de mandos, Cambios pendientes y Plan además de sus dos vistas
"propietarias" — demasiado entrelazado para mover con seguridad todavía. Se eligió en su lugar el
clúster de Deuda (`deuda-comparar/ruta/contratos/simulador`, comparten helpers entre sí → un solo
fragmento para las cuatro), extraído a `views/deuda.js` (~1.350 líneas).

El mapeo encontró dos problemas que el piloto no había mostrado:
1. Al menos 10 ficheros de test extraen funciones del texto de `app.js` por nombre (balanceando
   llaves) porque `app.js` es un script de navegador, no un módulo `require`-able — moverlas a
   `views/` las hace invisibles para ese mecanismo. Arreglado haciendo que esos 10 ficheros lean
   `app.js` + `views/deuda.js` concatenados, igual que hace el navegador en tiempo de ejecución.
2. Una referencia **directa** (sin envolver) a una función movida dentro de un
   `addEventListener(evento, nombreFuncion)` resuelve el nombre al registrar el listener, en el
   arranque — mucho antes de que el fragmento se descargue. Esto rompía `init()` entero para
   cualquier pantalla (no solo Deuda): `lastSimulation` nunca se calculaba y toda la app quedaba
   sustituida por "No se pudo cargar la app". Los 1621 tests no lo detectaron (no ejecutan `init()`
   de verdad); lo encontró una verificación real en navegador contra `dist/` servido. Arreglado
   envolviendo las 11 referencias directas encontradas en `(event) => nombreFuncion(event)`.

Validado con `npm run verify` completo y en navegador real: arranque sin `ReferenceError`, las 4
pantallas renderizan contenido real, el fragmento se descarga una sola vez para las cuatro,
Análisis/Cierre/Hoy (que dependen de `debtAmortizationSchedule`/`debtCapitalCuadre`, que se
quedaron en `app.js`) siguen funcionando sin cambios.

**PERF-1 — escala #3: Cierre/Conciliar (sesión siguiente)**: se evaluó Escenario primero y se
descartó — `homeDebtOutlook`/`loadEscenarioMotorSaved`/`saveEscenarioMotorSavedList` son utilidades
muy compartidas (Hoy, Cierre, Mapa de calor) que solo viven ahí por historia de construcción, no
porque sean exclusivas de Escenario. Se eligió Cierre/Conciliar (comparten helpers de sobres/
cuadre/versiones, un solo fragmento para las dos), extraído a `views/cierre.js` (~1.270 líneas). 8
funciones se quedaron en `app.js` por dependencias cruzadas (Análisis, el propio flujo de guardado
de cierre de mes, Escenarios al borrar un guardado aplicado).

Dos problemas más, encontrados antes de publicar:
1. Cuatro variables de estado y una constante estaban dentro del rango movido; dos de las
   variables y la constante se usan desde `app.js` — se quedaron ahí tras comprobar cada una.
2. El propio script que busca referencias "peladas" en `addEventListener` (construido en la escala
   #2) tenía un fallo: su regex no reconocía `async function`, así que se le escapó
   `handleCierreReopen` — misma rotura de arranque completo que la escala #2. Lo encontró la
   verificación en navegador de esta sesión (no `npm run verify`), confirmando que ese paso es
   obligatorio en cada escala, no solo la primera vez. Corregido el sitio y el propio script de
   detección.

Validado igual que la escala #2: `npm run verify` completo (11 ficheros de test más corregidos) y
navegador real — arranque sin `ReferenceError`, 10 pantallas comprobadas, 3 fragmentos descargados
una sola vez cada uno pese a servir 7 vistas entre los tres.

**PERF-1 — medición acumulada (sesión siguiente)**: Lighthouse tras las tres escalas fusionadas —
73/72/75 (perfil `provided`) y 45/55/55 (perfil por defecto), ambos dentro del mismo margen de
ruido que la baseline pre-PERF-1. El "JavaScript sin usar" estimado sí bajó (~1,7 MB → 1,54 MB,
coincide con los ~184 KB movidos), pero es solo ~5% de los ~3,6 MB totales — insuficiente para
mover la puntuación compuesta. Sin regresión, sin ganancia medible todavía.

**PERF-1 — escala #4: Análisis**. Se evaluó Registrar y se descartó por el mismo motivo que
Escenario: varias de sus funciones alimentan el recordatorio de Hoy y el propio flujo de edición de
saldos, no solo su propia pantalla. Análisis (`analisis*`/`handleAnalisis*`, ~740 líneas, nombre de
clúster limpio) sí se pudo extraer a `views/analisis.js`. El mapeo de dependencias se automatizó
por fin: un script calcula el cierre transitivo de "qué se queda en `app.js`" partiendo de las
funciones con uso externo conocido y seguido sus llamadas internas hasta el punto fijo — encontró
10 definiciones a mantener en `app.js` (colchón de Hoy/Plan · Previsión, cascada del resultado de
Plan · Previsión, precisión del plan del propio flujo de cierre de mes).

Un hallazgo de tipo distinto a los de las escalas #2/#3: un test comprobaba un fragmento de HTML
generado por código movido, buscándolo como texto literal en `app.js` — la búsqueda automática de
dependencias (por identificador) no lo detecta. Lo encontró la propia suite de tests al fallar (1
de 1621), recordando que ese paso sigue siendo necesario pese a la automatización.

Validado igual que las escalas anteriores: `npm run verify` completo (1621/1621, 6 ficheros de test
corregidos) y navegador real — arranque sin `ReferenceError`, 9 pantallas comprobadas, 4 fragmentos
descargados exactamente una vez cada uno.

**PERF-1 — cierre de fase: los 6 clústeres restantes, descartados**. Se evaluó Asesor ejecutivo
(el candidato pendiente) y se descartó: `executiveAdvisorContext()` es la base de
`unifiedActionCenterModel()` (usada directamente desde Hoy y otras rutas núcleo, al menos 7 puntos
de llamada fuera de Asesor ejecutivo) y también de `newLifeContext()`/`newLifeDefinitiveContext()`
— mismo entrelazado que ya descartó Escenario. Revisados con ese mismo criterio los cinco
`HEAVY_RENDER_VIEWS` que quedaban: Agente de ahorro (`buildSavingsAgentPlan()` alcanzable desde Hoy
y Deuda), Asesor virtual (construido sobre `buildSavingsAgentPlan()`/`agentOptimalDebtPayoffPlan()`),
Simulación nueva vida y Nueva vida definitiva (ambas sobre `executiveAdvisorContext()`), Plan de
deuda óptimo (mismo motor de optimización compartido) y Cuadro de mandos (`visual-detail`, que
resultó ser el mismo clúster de Cuadro de mandos/Planificación de partidas ya descartado en la
escala #2). Los seis son pantallas heredadas marcadas "sustituida" en `LABORATORIO_CATALOG`: su
código propio es una capa fina de render sobre un motor de cálculo compartido con Hoy/Deuda/Plan —
extraerlas movería poco peso de fichero dejando el cálculo real en `app.js`, sin el beneficio que sí
tuvieron Deuda/Cierre/Análisis.

**Las cuatro escalas fusionadas son el techo seguro de este mecanismo.** Lighthouse no muestra
ganancia de puntuación medible (igual que la medición acumulada: 73/72/75 perfil `provided`,
45/55/55 por defecto) pese a una reducción real y verificable de "JavaScript sin usar" (~184 KB de
~3,6 MB, ~5%) — insuficiente para mover la puntuación compuesta, tal y como se anticipó desde el
inicio de PERF-1. Ir más allá del objetivo de Lighthouse >85 exigiría tocar el propio motor
compartido (diferir o memorizar su cálculo, no solo mover ficheros a `views/`) — una
reestructuración distinta y bastante mayor que el esfuerzo "Bajo" con el que se estimó
originalmente esta tarea; queda como candidato nuevo a valorar aparte, no como continuación de
PERF-1. Sin cambios de código en esta sesión de cierre, solo análisis y documentación.

---

### **FASE 6 (Polish & Scale) — Semanas 21-24**

Estabilidad, documentación, performance en escala.

| Tarea | Qué hace | Esfuerzo | Bloqueador | Estado |
|-------|----------|----------|-----------|--------|
| **DOC-1** | Guía de presupuestos (FAQs, vídeos, casos de uso) | Bajo | Fases 1-5 | ⏳ |
| **QA-1** | Suite de aceptación: E2E tests de flujos completos | Medio | Fases 1-5 | ✅ |
| **SCALE-1** | Audit de performance: 1000 categorías, 10 años histórico | Bajo | U-3 | ✅ |
| **INTEG-1** | Exportar presupuestos a CSV/JSON para análisis externo | Bajo | P-2 | ✅ |

**SCALE-1 — auditoría y hallazgo real**: medido con datos sintéticos a la escala pedida (1000
categorías, 10 años, 360.000 transacciones). `budgetHistoricalExpenseTransactions`/
`budgetExpenseTransactions` (`app.js`) filtraban `baseData.transactions` completo por categoría —
O(categorías × transacciones), ~3,9 s a esa escala. Corregido con un índice por categoría cacheado
por identidad del array (se invalida solo si `baseData.transactions` cambia de referencia, que es
como se sustituye siempre: confirmado que ninguna reasignación existente muta el array in situ) —
~120 ms, ~30× más rápido, mismo comportamiento observable. Los motores canónicos de presupuestos
(`analyzeBatch`, alertas, forecast por categoría, histórico de `CanonicalBudgetSchema`) ya eran
lineales a esta escala (95-163 ms cada uno), sin hallazgos adicionales.

Verificación añadida a `tools/check-performance.mjs` (parte de `npm run verify`): reproduce la
escala de 1000 categorías/10 años contra el propio `app.js` y falla si una regresión futura vuelve
a filtrar el array completo por categoría. `npm run verify` completo: 1621/1621 tests, accesibilidad,
build, privacidad y smoke en verde.

**INTEG-1 — exportar presupuestos**: dos botones «Exportar CSV»/«Exportar JSON» en Presupuesto del
mes, junto a «Sugerir presupuestos». Exportan todos los presupuestos guardados (todas las categorías
y meses, no solo el mes abierto) con gasto real y desviación por fila (reutilizando
`budgetAlertForRow`), para análisis externo. Mismo patrón de descarga que `downloadCsv` (Blob + `<a
download>`), sin abstracción nueva. 7 tests nuevos con `budgetAlertForRow` mockeado (orden, campos,
CSV con BOM, JSON válido, singular/plural, wiring). Verificado en navegador real: ambos botones
descargan el fichero correcto, sin regresión de arranque. `npm run verify` completo: 1628/1628
tests, accesibilidad, build, privacidad y smoke en verde.

**QA-1 — suite de aceptación E2E**: la infraestructura de screenshot-diff de E18
(`e18-visual-regression.spec.cjs`) ya existía pero solo compara píxeles, no comportamiento, y nunca
ha corrido en CI (no forma parte de `npm run verify`). Nueva `tests/qa1-flujos-completos.spec.cjs`
con dos flujos reales en navegador: (1) Presupuesto del mes de punta a punta — sembrar histórico
(con las mismas funciones que usa la importación real), sugerir, editar el importe, exportar CSV/JSON
y comprobar el contenido descargado; (2) recorrido por las seis pantallas principales con datos
sembrados, comprobando que ninguna queda en blanco ni dispara errores — el tipo de regresión que las
4 escalas de carga diferida de PERF-1 podrían introducir. Verificado que detecta regresiones de
verdad (se rompió a propósito un selector y el test falló donde debía). Ajuste mínimo a
`playwright.config.cjs`: el `channel: "chrome"` que necesita E18 para píxeles reproducibles se movió
a sus dos proyectos; QA-1 corre en un tercer proyecto sin canal fijado (Chromium por defecto). Ni
`test:visual` ni el nuevo `test:e2e` forman parte de `npm run verify` ni de CI — misma decisión que
ya regía para E18, un navegador headless en el pipeline de despliegue es una decisión de
infraestructura aparte.

---

## 🎯 8 Features Diferenciadoras

1. **Presupuestos Inteligentes que Aprenden**
   - No pides presupuesto, el sistema lo sugiere automáticamente
   - Análisis de últimos 12 meses, detecta "navidad" automáticamente
   - Propone 3 opciones: conservador | medio | agresivo
   - Confianza: "Alta confianza (últimos 24 meses estables)" vs. "Baja (junio impredecible)"

2. **Ritmo Diario Visible**
   - "Hoy es día 15/31. Presupuesto: 300€. Ritmo: ~9,7€/día."
   - Esperado hoy: 145€. Gastado: 160€ (10% arriba, alerta amarilla).
   - Proyección: si sigues así, gastarás 330€ (5% arriba).
   - Sugerencia: reduce 20€ en los próximos 15 días.

3. **Hucha Flexible & Decidida**
   - 28 de agosto: "Sobran 150€ este mes"
   - Opciones: guardar | llevar al mes siguiente | gastar flexible
   - Histórico de decisiones: "En comida, siempre ~25% de hucha"

4. **Simulaciones Instantáneas con Impacto**
   ```
   [Slider: Comida 300 → 250]
   ↓
   "Si cortastes 50€/mes en comida:
    • Ahorros en 12 meses: 600€
    • Deuda pagada: 3 meses antes (julio vs. octubre)
    • Cobertura en marzo: 2,5 meses (vs. 2,2 hoy)"
   ```

5. **Integración con Deuda (Game Changer)**
   - Presupuestos no flotan solos; cada corte de gasto retrasa/acelera ruta de deuda
   - E14 muestra: "Si ahorras 100€/mes, este acuerdo se termina X vez de Y"
   - Gamificación: "Cumpliste presupuesto 3 meses seguidos → adelanta 1 mes la deuda"

6. **Notificaciones Contextuales**
   - Lunes 8:00: "Presupuesto comida: día 8/31 (26%). Gastado: 35% (alerta media)."
   - Miércoles: "Hucha disponible: 50€. ¿Gastar o guardar?"
   - Viernes: "Logro: Bajo presupuesto 3 meses. Deuda se paga 8 semanas antes."

7. **Análisis de Cohortes y Patrones**
   - "Julio siempre gasta 20% más (vacaciones). Presupuesto: 360€."
   - "Diciembre: gastos de regalos +300€. Enero: devoluciones -50€."
   - "Enero-marzo: comida baja (menos salidas). Presupuesto: 250€."

8. **Companion Rápido** (CLI/Slack/Chat)
   ```bash
   $ finanzas registra 25 comida
   Comida hoy: 25€ (gastado 80€/300€, en ritmo ✓)
   ```

---

## 📊 Resumen de Implementación

| Fase | Tarea | Líneas de código | Semanas | Estado |
|------|-------|-----------------|---------|--------|
| **0** | ARCH-0, P-1, TEST-0 | 1320 | 2 | ✅ |
| **1** | S-1, P-2, S-2, U-1 | ~450 | 3 | ✅ |
| **2** | P-3, F-1, S-3, LINK-1 | ~330 | 3 | ✅ |
| **3** | SIM-1, SIM-2, SIM-3, LINK-2 | ~330 | 3 | ✅ |
| **4** | GAME-1-3, NOTIF-1, ML-1, COMP-1 | ~450 | 5 | ✅ |
| **5** | U-2, U-3, U-4, PERF-1 | 800 | 4 | ✅ |
| **6** | DOC-1, QA-1, SCALE-1, INTEG-1 | 300 | 4 | ⏳ |
| **TOTAL** | | **5070 líneas** | **24 semanas** | **En Curso** |

---

## 🚀 Próximos Pasos

1. ✅ **FASE 0 completada**: Módulos canónicos, tests (1621/1621 ✓)
2. ✅ **FASE 1 completada**: Sección `#presupuesto-mes`, alertas, proyección, card en Hoy (1621/1621 ✓)
3. ✅ **FASE 2 completada**: hucha con arrastre real (P-3), forecast con estacionalidad conectado
   (F-1), histórico visual de 12 meses (S-3), enlace con impacto en deuda (LINK-1) (1621/1621 ✓)
4. ✅ **FASE 3 completada**: simulador "¿y si...?" (SIM-1), impacto en caja/cobertura/deuda a
   3/6/12 meses (SIM-2), comparador actual vs. simulado (SIM-3), enlace ampliado con deuda
   (LINK-2) (1621/1621 ✓)
5. ✅ **FASE 4 completada** (reordenada antes que Experiencia & Mobile, a petición del usuario):
   objetivos y rachas (GAME-1), badges (GAME-2), retos (GAME-3), notificaciones inteligentes
   (NOTIF-1), cohortes estacionales (ML-1) y companion CLI de solo lectura (COMP-1) (1621/1621 ✓)
6. ✅ **FASE 5 completada**: experiencia y mobile (U-2, U-3, U-4) y PERF-1 cerrado dentro de lo
   seguro (4 clústeres escalados a carga diferida; Lighthouse >85 no alcanzado, reestructuración
   mayor del motor compartido queda como candidato nuevo a valorar aparte)
7. 🔶 **FASE 6 en curso**: SCALE-1 (auditoría de presupuestos a escala, con hallazgo real corregido),
   INTEG-1 (exportar presupuestos a CSV/JSON) y QA-1 (suite E2E de flujos completos) completados;
   queda solo DOC-1 (guía de presupuestos)
8. **Weekly checkpoints**: Estado en PROJECT_STATE.md

---

## 📝 Notas Técnicas

- **Persistencia**: Supabase, tablas `finance_budgets`, `finance_budget_surpluses`, `finance_budget_simulations`
- **Integración E12**: Forecast de caja + forecast por categoría validados mutuamente
- **Integración E14**: Simulaciones de presupuesto impactan E14 (deuda adapter read-only)
- **Performance**: Índices en Supabase, caché por mes, worker threads para cálculos pesados
- **Mobile-first**: Breakpoint 390px, cards en lugar de tablas, full-screen en móvil

---

## 🔄 Deuda Técnica & Riesgos

| Riesgo | Mitigación |
|--------|-----------|
| Presupuestos desincronizados E12 | Validación cruzada en `canonical-engine.js` |
| Performance 1000+ movimientos | Caching por mes, índices Supabase |
| Mobile lag en simulaciones | Debounce sliders, Web Worker |
| UI abrumadora en "Hoy" | Accordion/collapse móvil, scroll desktop |
| Gamificación "gimmicky" | Badges solo si 3+ meses cumplimiento |

---

Archivo generado el 26/08/2026. Rama: `claude/budget-forecasting-improvements-4k54ti`
