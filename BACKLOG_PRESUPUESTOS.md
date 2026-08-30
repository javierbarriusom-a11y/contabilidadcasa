# Backlog de Presupuestos y Seguimiento — P-1 a U-3

> Mapa de todos los backlogs del repositorio: [`BACKLOG_INDICE.md`](BACKLOG_INDICE.md) (OPT-20).
> Histórico — continuado por [`BACKLOG_PRESUPUESTOS_V2.md`](BACKLOG_PRESUPUESTOS_V2.md).

Fecha: 22 de agosto de 2026. Repositorio vivo: `javierbarriusom-a11y/contabilidadcasa`.

## Contexto

Este backlog nace de una revisión de UX y una propuesta del usuario sobre cómo mejorar el seguimiento diario
de gastos. La app (E1-E20) tiene mucha funcionalidad de forecast, escenarios y alertas de caja, pero **no
tiene un sistema de presupuestos por categoría** con análisis histórico, ni un seguimiento operativo diario
que oriente decisiones de corto plazo ("¿puedo gastar más en comida este mes?").

La propuesta: **analizar los últimos 6 meses, sugerir presupuesto mensual, dividir por días del mes, y
lo no gastado pasa a una hucha flexible** (ahorro o gasto extra flexible).

Estructura: **4 ejes** (Presupuestos, Seguimiento, Forecasting, UX) × **3 fases** de entrega con ROI creciente.
Tareas: prefijo `P-` (Presupuestos), `S-` (Seguimiento), `F-` (Forecasting), `U-` (UX/Mobile).

---

## 0. Tabla maestra por fase

| Fase | Tarea | Resuelve | Impacto | Esfuerzo | Estado | Bloqueador |
|------|-------|----------|--------|----------|--------|-----------|
| **1** | P-1 | Análisis histórico + sugerencia de presupuestos | Alto | Medio | ⏳ | Ninguno |
| **1** | S-1 | Alertas de desviación por categoría | Alto | Medio | ⏳ | P-1 (datos de presupuesto) |
| **2** | P-2 | Dashboard y seguimiento diario de presupuesto | Alto | Medio | ⏳ | P-1 |
| **2** | S-2 | Proyección de fin de mes y recomendaciones | Medio | Medio | ⏳ | P-1 |
| **3** | P-3 | Gestión de hucha: lo no gastado | Medio | Bajo | ⏳ | P-2 |
| **3** | F-1 | Forecast por categoría (eje histórico + variabilidad) | Medio | Bajo | ⏳ | P-1 (datos históricos) |
| **4** | U-1 | Rediseño de "Hoy" con presupuesto + caja + objetivos | Medio | Medio | ⏳ | P-2, S-2 |
| **4** | S-3 | Histórico visual de 12 meses presupuesto vs. real | Medio | Bajo | ⏳ | P-1 |
| **5** | F-2 | Simulaciones rápidas de presupuesto ("¿y si...?") | Medio | Medio | ⏳ | P-2, F-1 |
| **5** | U-2 | Optimizar E19-E20 (17 pantallas) para móvil | Medio | Alto | ⏳ | Ninguno (paralelo) |
| **5** | U-3 | Lanzador de acciones mejorado (registro diario, presupuesto) | Bajo | Bajo | ⏳ | U-1 |

---

## FASE 1 — Fundación: análisis histórico y alertas

### P-1 · Análisis histórico y sugerencia automática de presupuestos

**Impacto**: Alto · Usuario puede autoconfigurar presupuestos en 2 minutos sin pensar  
**Esfuerzo**: Medio (320 líneas backend + 150 líneas UI)  
**Bloqueador**: Ninguno

#### Qué hace

1. **Motor de análisis** (`canonical-budget-analyzer.js`):
   - Agregar movimientos por categoría de gasto (últimos 6 meses)
   - Calcular: media, mediana, desviación estándar, p75 (percentil 75)
   - Retornar `{ categoryId, average, median, p75, stdDev, sampleCount }`
   - Excluir gastos anómalos: si un mes está >3σ, marcarlo como "mes atípico" pero no ignorarlo

2. **Persistencia** (`canonical-budget-schema.js`):
   - Nuevo esquema: `{ categoryId, monthYear, amountCap, currency, source, appliedAt }`
   - `source`: "suggested" | "manual" | "carryover"
   - Guardar en `state.budgets[]` (paralelo a `state.scenarios`)
   - Restauración remota igual que escenarios (Supabase, sin conflicto)

3. **UI** (`#presupuestos`, nueva sección):
   - Botón "Sugerir presupuestos" → ejecuta `canonical-budget-analyzer` sobre últimos 6 meses
   - Tabla: Categoría | Promedio | P75 (recomendación) | Tu presupuesto (editable)
   - Guardar: crea fila en `state.budgets[mes actual]`
   - "Usar promedio", "Usar p75", "Custom" (spinner)

#### Criterios de aceptación

- [ ] `canonical-budget-analyzer` retorna `{ categoryId, average, median, p75, stdDev }` para categorías con ≥3 meses de datos
- [ ] Excluye movimientos de tipo "transfer" (traspaso entre cuentas)
- [ ] P75 nunca es menor que promedio (lógica correcta de percentiles)
- [ ] UI permite guardar presupuesto mensual: fecha + cantidad por categoría
- [ ] Presupuesto guardado persiste tras recarga (`npm run test:smoke`)
- [ ] Recuperación remota sin conflicto (Supabase)
- [ ] QA: analizar datos de demostración (conocidos), verificar p75 coincide con cálculo manual

#### Pruebas

- `tests/p1-budget-analyzer.test.cjs`:
  - Análisis con 6 meses de datos: media, p75 correctos
  - Análisis con <3 meses: retorna `null` o `{ uncertain: true }`
  - Mes atípico (3σ): se marca pero no se ignora
  - Exclusión de transfers
- `tests/p1-budget-schema.test.cjs`:
  - Validación: `categoryId`, `amountCap` > 0, `monthYear` formato correcto
  - Persistencia local y remota

#### Dependencias

- Ningunas. Pero S-1 la usa como dato.

---

### S-1 · Alertas de desviación por categoría

**Impacto**: Alto · Usuario ve si un gasto es atípico antes de fin de mes  
**Esfuerzo**: Medio (250 líneas engine + 120 líneas UI)  
**Bloqueador**: P-1 (necesita presupuesto guardado)

#### Qué hace

1. **Motor de alertas** (`canonical-budget-alerts.js`):
   - Entrada: presupuesto mensual, movimientos hasta hoy, histórico de 6 meses (desv. estándar)
   - Cálculo: gasto actual vs. ritmo esperado (presupuesto / días del mes)
   - Alerta si: `|(gasto_actual - ritmo_esperado) / ritmo_esperado| > 10%`
   - Confianza: basada en desviación histórica. Si `stdDev` es alta (categoría variable), confianza baja
   - Retornar: `{ categoryId, status: "on-track" | "overspend" | "underspend", severity: 1-5, confidence: "high" | "medium" | "low", message }`

2. **Persistencia**: alertas no guardadas, calculadas al cargar Hoy

3. **UI** (sección "Alertas" en Hoy, similar a alertas de caja E16):
   - Tarjeta por categoría en alerta: icono de semáforo, % de desviación, confianza
   - Click → drill-down: últimos 30 días de gasto en esa categoría, comparado con promedio
   - Ejemplo: "🔴 Comida: 25% por encima del ritmo esperado (confianza media — marzo fue atípico)"

#### Criterios de aceptación

- [ ] Motor calcula ritmo esperado = presupuesto / días del mes (hoy es día X)
- [ ] Compara gasto acumulado actual con ritmo * días transcurridos
- [ ] Alerta si desviación >10% o <-10%
- [ ] Confianza inversamente proporcional a desviación histórica
- [ ] UI muestra alerta con tonos: rojo (>20%), amarillo (10-20%), verde (<10%)
- [ ] Drill-down disponible: gráfico ultimos 30 días vs. promedio
- [ ] QA móvil (390 px): alertas legibles sin scroll horizontal

#### Pruebas

- `tests/s1-budget-alerts.test.cjs`:
  - Ritmo esperado: día 15/31, presupuesto 300€ → ritmo diario ~9.7€, esperado acumulado ~145€
  - Overspend: gasto actual 180€ (24% arriba) → alerta roja
  - Underspend: gasto 100€ (31% abajo) → alerta amarilla (menos crítica)
  - Confianza baja si `stdDev > promedio * 0.3`
- UI: captura móvil + escritorio de alerta en "Hoy"

#### Dependencias

- P-1: presupuesto guardado para el mes

---

## FASE 2 — Visibilidad operativa: dashboard y proyección

### P-2 · Dashboard y seguimiento diario de presupuesto

**Impacto**: Alto · Usuario ve estado del presupuesto a diario, decide gastar  
**Esfuerzo**: Medio (180 líneas UI + 80 líneas cálculo)  
**Bloqueador**: P-1

#### Qué hace

1. **Nueva sección** `#presupuesto-mes` (hermana de `#prevision`, `#deuda-ruta`, etc.):
   - Tabla: Categoría | Presupuesto | Gastado | % | Barra de progreso
   - Barra de progreso por categoría (visual: lleno/vacío, colores por severidad)
   - Fila "Total": suma de todos, mismo tratamiento
   - Ritmo visual: "Hoy es día 15/31 (48% del mes)", línea de ritmo esperado en la barra

2. **Card en Hoy** (como cobertura de caja E6):
   - Miniatura: presupuesto total, gastado, % en progreso
   - Insignia: "En ritmo" | "Adelantado" | "Atrasado"
   - Link a `#presupuesto-mes`

3. **Cálculo diario**:
   - `canonicalBudgetUsage(categoryId, monthYear)` retorna: `{ budgeted, spent, remaining, dailyRate, confidence }`
   - Recalcula cada vez que se carga la página (movimiento sincronizado desde Supabase)

#### Criterios de aceptación

- [ ] `#presupuesto-mes` muestra todas las categorías con presupuesto
- [ ] Barra de progreso refleja `spent / budgeted`
- [ ] Ritmo visual mostrado: línea en el 50% si estamos en día 15/31
- [ ] Card en Hoy: estado + link
- [ ] Colores: verde <80%, amarillo 80-100%, rojo >100%
- [ ] QA escritorio: tabla legible con 10+ categorías
- [ ] QA móvil: responsive, cards en lugar de tabla si ancho <500px

#### Pruebas

- `tests/p2-budget-usage.test.cjs`:
  - Cálculo de `spent` agregando movimientos del mes
  - Cálculo de ritmo = `budgeted / daysInMonth * daysElapsed`
  - Colores asignados correctamente (verde/amarillo/rojo)
- Captura: pantalla completa en escritorio y móvil

#### Dependencias

- P-1: presupuesto guardado

---

### S-2 · Proyección de fin de mes y recomendaciones

**Impacto**: Medio · Usuario sabe qué pasará si sigue así, recibe sugerencias  
**Esfuerzo**: Medio (200 líneas engine + 100 líneas UI)  
**Bloqueador**: P-1

#### Qué hace

1. **Motor de proyección** (`canonical-budget-forecast.js`):
   - Entrada: presupuesto, gasto hasta hoy, día actual, desviación histórica
   - Proyección lineal simple: si hoy (día 15) he gastado 150€ de 300€, proyectar fin de mes
   - Fórmula: `gasto_acumulado / días_transcurridos * días_totales`
   - Rango: proyección ± 1σ (basado en volatilidad histórica)
   - Retornar: `{ projected, budget, variance, recommendation }`

2. **Recomendaciones** (lógica simple):
   - Si proyectado < presupuesto - 50€: "Tienes 50€ extra, puedes gastar en entretenimiento"
   - Si proyectado > presupuesto + 50€: "Reduce comida en los últimos 10 días para no salirte del presupuesto"
   - Si dentro de ±50€: "En ritmo, sigue así"

3. **UI** (panel en `#presupuesto-mes` o card en Hoy):
   - Título: "Proyección de fin de mes"
   - Tabla: Categoría | Presupuesto | Proyectado | Diferencia | Recomendación
   - Colores: verde si diferencia < ±10%, amarillo si 10-30%, rojo si >30%

#### Criterios de aceptación

- [ ] Proyección lineal es correcta (auditable con datos conocidos)
- [ ] Rango de incertidumbre mostrado (±1σ)
- [ ] Recomendaciones generadas solo si `|variance| > 50€`
- [ ] UI renderiza sin errores con 10+ categorías
- [ ] QA: verificar contra datos demo (conocidos) que proyección es sensata

#### Pruebas

- `tests/s2-budget-forecast.test.cjs`:
  - Proyección día 15: `100€ gastados / 15 días * 31 días = 206€`
  - Rango ±1σ si desv. histórica 20€ → [186, 226]
  - Recomendación "reduce" si proyectado 350€ con presupuesto 300€
- Captura: UI con recomendaciones visibles

#### Dependencias

- P-1: presupuesto y datos históricos

---

## FASE 3 — Flexibilidad: hucha y análisis mejorado

### P-3 · Gestión de hucha: lo no gastado

**Impacto**: Medio · Usuario decide qué hacer con dinero no gastado  
**Esfuerzo**: Bajo (100 líneas UI + 50 líneas lógica)  
**Bloqueador**: P-2 (datos de gasto del mes)

#### Qué hace

1. **Cálculo de hucha** (semanal + fin de mes):
   - Cada categoría: si `gasto < presupuesto`, resto va a hucha
   - Hucha acumulada: suma de no gastado de todas las categorías

2. **UI de decisión** (aparece los últimos 3 días del mes):
   - Panel: "No gastaste 150€ este mes. ¿Qué haces?"
   - Opciones (radio buttons):
     - "Guardar como ahorro fijo (saldo de cuenta de ahorros)"
     - "Llevar a siguiente mes (presupuesto más holgado)"
     - "Hacer disponible como gasto flexible esta semana"
   - Guardar decisión en `state.budgetCarryover[]`

3. **Histórico de hucha**:
   - Tabla: últimos 12 meses, no gastado por categoría, decisión tomada
   - Insight: "En comida, el 30% queda de hucha cada mes" (tendencia de presupuesto holgado)

#### Criterios de aceptación

- [ ] Cálculo de hucha correcto: `max(0, presupuesto - gastado)`
- [ ] Panel aparece días 28-31 si hay hucha >0
- [ ] Decisión guardada y recuperable
- [ ] Histórico muestra últimos 12 meses
- [ ] Insight de "hurto de presupuesto" identificable (ej: "comida siempre sobra")

#### Pruebas

- `tests/p3-budget-surplus.test.cjs`:
  - Cálculo: presupuesto 300€, gasto 250€ → hucha 50€
  - Decisión guardada y visible en histórico
- Captura: panel de decisión en fin de mes

#### Dependencias

- P-2: seguimiento diario completo

---

### F-1 · Forecast por categoría

**Impacto**: Medio · Usuario ve patrón esperado por categoría, presupuesto inteligente  
**Esfuerzo**: Bajo (120 líneas engine)  
**Bloqueador**: P-1 (datos históricos)

#### Qué hace

1. **Motor de forecast por categoría** (`canonical-budget-forecast-category.js`):
   - Similar a E12 (forecast de caja) pero granular
   - Entrada: movimientos de categoría últimos 12 meses
   - Detección de estacionalidad: enero vs. julio, qué meses gastan más
   - Retornar: `{ categoryId, forecast: { mes1: 250±30, mes2: 280±40, ... }, confidence }`
   - Usar en P-1: sugerencia = p75 del forecast, no solo promedio

2. **Integración**:
   - P-1 "Sugerir presupuestos" ahora muestra: "Promedio | P75 (histórico) | Forecast (inteligente)"
   - Usuario elige cuál usar

#### Criterios de aceptación

- [ ] Detecta estacionalidad (ej: navidad más gasto en regalos, verano menos comida en casa)
- [ ] Forecast ±1σ es razonable vs. datos reales
- [ ] UI muestra "Forecast inteligente: 280€ ± 40€" vs. "P75: 300€"
- [ ] QA: validar contra mes de Navidad conocido (picos de gasto real)

#### Pruebas

- `tests/f1-budget-forecast-category.test.cjs`:
  - Detección de diciembre como mes alto de gasto
  - Forecast julio como mes bajo (vacaciones)
  - ±1σ razonable

#### Dependencias

- P-1: datos históricos

---

## FASE 4 — Experiencia: Hoy rediseñado

### U-1 · Rediseño de "Hoy" con presupuesto + caja + objetivos

**Impacto**: Medio · Usuario ve estado completo de un vistazo  
**Esfuerzo**: Medio (300 líneas CSS + reorganización HTML)  
**Bloqueador**: P-2, S-2

#### Qué hace

Rediseñar la sección `#home` (Hoy) para incluir cuatro zonas claras:

1. **Zona 1 — Presupuesto del mes** (top):
   - Card de presupuesto: % total, alerta si hay desviación
   - Presupuesto de riesgo (actual, E16)

2. **Zona 2 — Caja** (top-right):
   - Cobertura hasta siguiente ingreso (actual, E6)
   - Saldo actual

3. **Zona 3 — Objetivos** (abajo-left):
   - Qué vence este mes
   - Siguiente hito (E15)

4. **Zona 4 — Acciones** (abajo-right):
   - Decisiones abiertas (actual)
   - Sugerencias (actual mejorado)

Layout: grid 2×2 en escritorio, stacked en móvil

#### Criterios de aceptación

- [ ] Grid layout 2×2 en >900px, 1×4 stacked en <900px
- [ ] Cada card clickeable a su pantalla completa
- [ ] Actualización en tiempo real si llegan nuevos movimientos
- [ ] QA escritorio (1280×720) y móvil (390×844): sin reflow, sin overflow

#### Pruebas

- Captura: escritorio + móvil
- Responsive: verificar sin overflow en 390px y 1280px
- Performance: Hoy carga en <1s incluso con 1000 movimientos

#### Dependencias

- P-2: presupuesto completo
- S-2: proyección y recomendaciones

---

### S-3 · Histórico visual de 12 meses

**Impacto**: Medio · Usuario ve patrón anual, decide presupuesto informado  
**Esfuerzo**: Bajo (150 líneas gráfico + datos)  
**Bloqueador**: P-1

#### Qué hace

Nueva sección `#presupuesto-historico`:
- Gráfico: últimos 12 meses
- Eje Y: monto (€)
- Series por categoría: presupuesto (barra) vs. real (línea)
- Hover: mes actual, valores exactos
- Tabla debajo: resumen 12 meses, presupuesto vs. real, % de cumplimiento

#### Criterios de aceptación

- [ ] Gráfico renderiza sin errores con 10+ categorías
- [ ] Barras (presupuesto) vs. línea (real) visualmente claras
- [ ] Hover muestra valores exactos
- [ ] Tabla resumen: 12 meses × categorías, % cumplimiento
- [ ] Responsive: scroll horizontal si <500px

#### Pruebas

- Captura: gráfico con 6+ meses de datos
- QA móvil: scroll horizontal funcional

#### Dependencias

- P-1: datos históricos

---

## FASE 5 — Shortcuts y optimización

### F-2 · Simulaciones rápidas de presupuesto

**Impacto**: Medio · Usuario prueba decisiones de gasto sin crear escenario completo  
**Esfuerzo**: Medio (180 líneas UI + 80 motor)  
**Bloqueador**: P-2, F-1

#### Qué hace

Modo "¿y si...?" dentro de `#presupuesto-mes`:
- Slider: reducir/aumentar presupuesto de una categoría
- Proyección actualiza en tiempo real: "Si cortas 50€ en comida, ahorras 500€ en 12 meses"
- Comparador: caja a fin de mes con vs. sin cambio
- No guarda nada, solo visualiza

#### Criterios de aceptación

- [ ] Slider fluidez actualiza proyección al instante
- [ ] Cálculo de ahorro anual correcto
- [ ] Comparador caja es legible

#### Pruebas

- QA: mover slider, ver proyección cambiar en <100ms

#### Dependencias

- P-2: presupuesto completo
- F-1: forecast

---

### U-2 · Optimizar E19-E20 para móvil

**Impacto**: Medio · Usuario usa app en móvil sin frustración  
**Esfuerzo**: Alto (500+ líneas CSS reflow, media queries, toques)  
**Bloqueador**: Ninguno (paralelo)

#### Qué hace

Las 17 pantallas nuevas (E19-E20) son desktop-first. Hacerlas mobile-first:

1. **Tablas** → cards stacked (390px)
2. **Gráficos** → responsivos (d3/chart library con viewport detection)
3. **Formularios** → input full-width, labels sobre inputs en móvil
4. **Botones** → min-height 48px (accesibilidad táctil)
5. **Diálogos** → full-screen en móvil, modal en desktop

#### Criterios de aceptación

- [ ] 17 pantallas funcionales en 390px sin scroll horizontal
- [ ] QA: captura de cada pantalla en móvil (antes/después)
- [ ] Performance: láading <2s en 4G

#### Pruebas

- Playwright + emulación móvil: 17 pantallas
- Performance audit: Lighthouse >80

#### Dependencias

- Ninguno (paralelo)

---

### U-3 · Lanzador de acciones mejorado

**Impacto**: Bajo · Usuario accede a tareas diarias sin menus  
**Esfuerzo**: Bajo (120 líneas)  
**Bloqueador**: U-1

#### Qué hace

Extender el lanzador existente (E17, A12-3) para incluir:
- "Registrar comida hoy" → rápido a formulario de movimiento con categoría preseleccionada
- "Crear presupuesto" → modal rápido
- "Ver desviación" → link a S-1 alertas
- Búsqueda: filtra también por categoría

#### Criterios de aceptación

- [ ] Lanzador abierto con Cmd+K (actual), busca acciones nuevas
- [ ] Resultado clickeado abre vista correcta sin reloadPage

#### Pruebas

- Buscar "comida" → "Registrar comida hoy" en resultados

#### Dependencias

- U-1: acciones nuevas definidas

---

## Resumen de implementación

| Fase | Tarea | Líneas de código | Semanas estimadas |
|------|-------|-----------------|------------------|
| **1** | P-1 | 470 (backend + UI) | 2 |
| **1** | S-1 | 370 | 2 |
| **2** | P-2 | 260 | 1.5 |
| **2** | S-2 | 300 | 1.5 |
| **3** | P-3 | 150 | 0.5 |
| **3** | F-1 | 120 | 0.5 |
| **4** | U-1 | 300 | 1.5 |
| **4** | S-3 | 150 | 0.5 |
| **5** | F-2 | 260 | 1.5 |
| **5** | U-2 | 500+ | 3 |
| **5** | U-3 | 120 | 0.5 |
| **TOTAL** | | 3000+ | **15 semanas** |

**Recomendación**: Fase 1+2 (P-1, S-1, P-2, S-2) = **4 semanas**, da valor inmediato.
Luego Fase 3+4 (P-3, F-1, U-1, S-3) = **3.5 semanas**, solidifica experiencia.
Fase 5 (F-2, U-2, U-3) = **5 semanas**, pulido y optimización.

---

## Criterios de aceptación por fase

### Puerta de Fase 1 (Semana 2-3)
- [ ] `npm run verify` pasa (1601+ tests)
- [ ] P-1 presupuestos sugeridos persisten
- [ ] S-1 alertas visible en Hoy
- [ ] QA escritorio + móvil: ambas funcionan sin errores
- [ ] `PROJECT_STATE.md` actualizado

### Puerta de Fase 2 (Semana 4-5)
- [ ] Dashboard `#presupuesto-mes` muestra datos reales
- [ ] Proyección es sensata (auditable)
- [ ] QA: tabla grande (10+ categorías) sin scroll horizontal en 1280px
- [ ] Performance: Hoy carga <1s

### Puerta de Fase 3-4 (Semana 6-8)
- [ ] Hucha funcional + histórico visible
- [ ] U-1 rediseño Hoy en lugar (grid 2×2)
- [ ] Histórico 12 meses visible

### Puerta de Fase 5 (Semana 13-15)
- [ ] F-2 simulaciones rápidas
- [ ] U-2 todas las 17 pantallas mobile-first
- [ ] U-3 lanzador con acciones nuevas
- [ ] Performance global >80 Lighthouse

---

## Próximos pasos

1. ✅ **Ya está**: este documento en `BACKLOG_PRESUPUESTOS.md`
2. **Crear tickets en GitHub** (Issues) con etiquetas: `budget-p1`, `budget-s1`, etc.
3. **Ordenar en rama** `claude/budgets-phase-1` con commits por tarea
4. **Hito**: Fase 1 → PR a `main`, CI verde, publicado en sitio

¿Empezamos por P-1?
