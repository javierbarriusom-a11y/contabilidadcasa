# Backlog Integrado: Presupuestos + Forecasting (v2)

**Fecha**: 26 de agosto de 2026  
**Versión**: Integración de BACKLOG_PRESUPUESTOS.md + Plan Ambicioso  
**Estado**: Aprobado y en ejecución (FASE 0 - Fundación)

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

### **FASE 1 (Visibilidad) — Semanas 3-5**

Usuario ve dónde está cada día, toma decisiones informadas.

| Tarea | Qué hace | Esfuerzo | Bloqueador | Estado |
|-------|----------|----------|-----------|--------|
| **S-1** | Alertas de desviación por categoría (ritmo vs. real) | Medio | ARCH-0 | ⏳ |
| **P-2** | Dashboard `#presupuesto-mes`: tabla + barras de progreso | Medio | ARCH-0 | ⏳ |
| **S-2** | Proyección fin de mes + recomendaciones | Medio | ARCH-0 | ⏳ |
| **U-1** | Card en "Hoy" resumiendo presupuesto + insignia de ritmo | Bajo | P-2 | ⏳ |

**Criterios de Éxito**:
- [ ] Usuario ve presupuesto diario con alertas en Hoy
- [ ] Proyección de fin de mes es auditable contra datos reales
- [ ] QA móvil: todo legible en 390px sin scroll horizontal
- [ ] Performance: Hoy carga <1s (1000 movimientos)
- [ ] Publicado en main

---

### **FASE 2 (Flexibilidad) — Semanas 6-8**

Presupuestos que aprenden, se adaptan, se mejoran solos.

| Tarea | Qué hace | Esfuerzo | Bloqueador | Estado |
|-------|----------|----------|-----------|--------|
| **P-3** | Gestión de hucha: no gastado → opciones de decisión | Bajo | P-2 | ⏳ |
| **F-1** | Forecast por categoría + detección estacionalidad | Medio | ARCH-0 | ⏳ |
| **S-3** | Histórico visual 12 meses: presupuesto vs. real | Bajo | ARCH-0 | ⏳ |
| **LINK-1** | Vincular presupuestos a metas de ahorro en deuda | Medio | F-1 | ⏳ |

---

### **FASE 3 (Simulaciones) — Semanas 9-11**

"¿Y si corto gasto en comida?" responde al instante.

| Tarea | Qué hace | Esfuerzo | Bloqueador | Estado |
|-------|----------|----------|-----------|--------|
| **SIM-1** | Motor "¿y si...?" para cambios rápidos de presupuesto | Medio | P-2, F-1 | ⏳ |
| **SIM-2** | Visualizar impacto en caja, cobertura, deuda a 3/6/12 meses | Medio | SIM-1 | ⏳ |
| **SIM-3** | Comparador: presupuesto actual vs. simulado en histórico | Bajo | SIM-2 | ⏳ |
| **LINK-2** | "Si ahorras 50€/mes en comida, deuda se paga 6 meses antes" | Bajo | SIM-2 | ⏳ |

---

### **FASE 4 (Experiencia & Mobile) — Semanas 12-15**

App usable y brilla en móvil.

| Tarea | Qué hace | Esfuerzo | Bloqueador | Estado |
|-------|----------|----------|-----------|--------|
| **U-2** | Rediseño de "Hoy": grid 2×2 (presupuesto + caja + objetivos + acciones) | Medio | P-2, S-2 | ⏳ |
| **U-3** | Mobile-first: todas las pantallas de presupuestos en 390px | Alto | P-2, P-3, SIM-1 | ⏳ |
| **U-4** | Lanzador mejorado: acciones de presupuesto | Bajo | S-1, U-2 | ⏳ |
| **PERF-1** | Optimización de rendimiento: Lighthouse >85 | Bajo | U-3 | ⏳ |

---

### **FASE 5 (Gamificación & Inteligencia) — Semanas 16-20**

Usuario vuelve cada día, entiende sus patrones.

| Tarea | Qué hace | Esfuerzo | Bloqueador | Estado |
|-------|----------|----------|-----------|--------|
| **GAME-1** | Sistema de objetivos presupuestarios: metas mensuales por categoría | Medio | P-2 | ⏳ |
| **GAME-2** | Badges/logros: "Ahorrista" (3 meses bajo presupuesto), "Equilibrador", etc. | Bajo | GAME-1 | ⏳ |
| **GAME-3** | Retos: "El mes que menos gastamos todos en comida" | Bajo | GAME-1 | ⏳ |
| **NOTIF-1** | Notificaciones inteligentes: deviación, hito, hucha disponible | Medio | S-1, P-3 | ⏳ |
| **ML-1** | Análisis de cohortes: "Tus meses de julio gastan 15% más" | Bajo | F-1 | ⏳ |
| **COMP-1** | Companion CLI/API: registrar gastos rápido desde terminal | Bajo | P-2 | ⏳ |

---

### **FASE 6 (Polish & Scale) — Semanas 21-24**

Estabilidad, documentación, performance en escala.

| Tarea | Qué hace | Esfuerzo | Bloqueador | Estado |
|-------|----------|----------|-----------|--------|
| **DOC-1** | Guía de presupuestos (FAQs, vídeos, casos de uso) | Bajo | Fases 1-5 | ⏳ |
| **QA-1** | Suite de aceptación: E2E tests de flujos completos | Medio | Fases 1-5 | ⏳ |
| **SCALE-1** | Audit de performance: 1000 categorías, 10 años histórico | Bajo | U-3 | ⏳ |
| **INTEG-1** | Exportar presupuestos a CSV/JSON para análisis externo | Bajo | P-2 | ⏳ |

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
| **1** | S-1, P-2, S-2, U-1 | 600 | 3 | ⏳ |
| **2** | P-3, F-1, S-3, LINK-1 | 500 | 3 | ⏳ |
| **3** | SIM-1, SIM-2, SIM-3, LINK-2 | 600 | 3 | ⏳ |
| **4** | U-2, U-3, U-4, PERF-1 | 800 | 4 | ⏳ |
| **5** | GAME-1-3, NOTIF-1, ML-1, COMP-1 | 700 | 5 | ⏳ |
| **6** | DOC-1, QA-1, SCALE-1, INTEG-1 | 300 | 4 | ⏳ |
| **TOTAL** | | **5220 líneas** | **24 semanas** | **En Curso** |

---

## 🚀 Próximos Pasos

1. ✅ **FASE 0 completada**: Módulos canónicos, tests (1621/1621 ✓)
2. **FASE 1 iniciarse**: Crear UI para alertas, dashboard, proyección
3. **PR a main** (CI verde, revisor aprueba)
4. **Weekly checkpoints**: Estado en PROJECT_STATE.md

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
