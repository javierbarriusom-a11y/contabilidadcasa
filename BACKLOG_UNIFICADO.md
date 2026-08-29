# Backlog unificado — patrimonio/finanzas + optimización

Fecha: 29 de agosto de 2026. Repositorio vivo: `javierbarriusom-a11y/contabilidadcasa`.

Este documento fusiona, por decisión explícita del usuario, dos backlogs nacidos de auditorías
críticas independientes en la misma fecha:

- **`BACKLOG_PATRIMONIO_Y_FINANZAS.md`** (E21-E26, prefijo `A14` a `A19`): nuevas funcionalidades —
  patrimonio neto, fiscalidad, salud financiera, captura sin fricción, economía del hogar
  compartido, confianza hacia terceros.
- **`BACKLOG_OPTIMIZACION.md`** (prefijo `OPT-1` a `OPT-22`): coste de mantener y cargar la
  aplicación tal como está hoy — rendimiento, navegación duplicada, jerarquía visual, accesibilidad
  y disciplina de CSS.

Los dos ejes son distintos a propósito (uno añade, el otro sanea), y ambos documentos originales
**se conservan íntegros** como referencia de detalle: contexto, pasos y resultado esperado completo
de cada tarea siguen viviendo allí. Lo que aporta este archivo es **un único orden de ejecución**
para las 49 tareas de ambos, por el mismo criterio de esfuerzo-beneficio que ya usaba cada uno por
separado — este documento manda en el orden; los originales mandan en el detalle.

**Una dependencia dura se conserva tal cual, porque no es negociable:** ninguna tarea de fusión de
pantallas (bloque 6) puede empezar antes de que `OPT-2` lleve un mínimo de 30 días midiendo uso
real. Por eso `OPT-2` se coloca en el bloque 1 (arranca el contador cuanto antes) y las tareas que
dependen de él quedan en bloques posteriores, no por orden de esfuerzo-beneficio puro sino por ese
plazo de calendario.

## Leyenda unificada

| Esfuerzo | Significado |
|---|---|
| S | Cambio acotado, sin dominio de datos nuevo ni migración |
| M | Contrato o integración pequeña, o refactor de una pantalla |
| L | Dominio de datos nuevo, migración, o corrección de exactitud legal/crítica |

| Beneficio | Significado |
|---|---|
| Bajo | Mejora marginal o de nicho |
| Medio | Impacto claro pero no crítico en uso diario o mantenimiento |
| Alto | Impacto directo en decisiones de dinero, retención, o habilita trabajo posterior |

Estado: mismos símbolos que `BACKLOG.md`/`BACKLOG_OPERACION.md` (✅ hecho · 🟡 parcial · ⏳ pendiente
sin bloqueo · ⛔ bloqueado). Todas las tareas de este documento están ⏳ salvo aviso contrario.

## Orden de ejecución unificado

### Bloque 1 — Arranca ya, riesgo ≈ 0 (S, beneficio alto o habilitador)

| Orden | ID | Tarea | Origen | Esfuerzo | Beneficio | Nota |
|---|---|---|---|---|---|---|
| 1 | OPT-1 | `defer` en los `<script>` de `index.html` | Optimización | S | Alto | Sin cambio de comportamiento |
| 2 | OPT-2 | Instrumentar uso real de pantallas heredadas | Optimización | S | Alto (habilitador) | Arranca el contador de 30 días que bloquea el bloque 6 |
| 3 | OPT-3 | Minificar el artefacto publicado | Optimización | S | Alto | No toca el código fuente |
| 4 | OPT-4 | Accesibilidad verificada de verdad (axe-core) | Optimización | S | Alto | |
| 5 | A16-2 | Tendencia histórica de la puntuación de salud financiera | Patrimonio | S | Medio-Alto | Depende de A16-1 (bloque 2) para tener la cifra base |
| 6 | A17-2 | Exportación/suscripción ICS del calendario financiero | Patrimonio | S | Medio | Solo lectura |
| 7 | OPT-18 | Verificar compresión Brotli/Gzip del artefacto | Optimización | S | Medio | Paralelizable en cualquier momento |
| 8 | OPT-19 | Checklist de reutilización de componentes `.e19-*` en PR | Optimización | S, continuo | Medio | Hábito, arranca ya |

### Bloque 2 — Sigue barato, ya con algo de estructura (S-M)

| Orden | ID | Tarea | Origen | Esfuerzo | Beneficio | Nota |
|---|---|---|---|---|---|---|
| 9 | A16-1 | Puntuación de salud financiera compuesta | Patrimonio | M | Alto | Reutiliza KPIs ya calculados (A2-6) |
| 10 | A16-3 | Detección de recurrentes/suscripciones | Patrimonio | M | Alto | Reutiliza aprendizaje de estacionalidad (E12b) |
| 11 | A16-4 | Avisos de renovación con acción sugerida | Patrimonio | S | Medio | Depende de A16-3 |
| 12 | OPT-5 | Presupuesto de rendimiento real (Lighthouse CI) | Optimización | M | Alto | Sustituye el umbral de peso de fichero de OPT-3 |
| 13 | OPT-6 | Sacar el bloque de configuración («cobertura aprendida») de «Hoy» | Optimización | S | Medio | |
| 14 | A17-1 | Widget de solo lectura (saldo, próximo evento, colchón) | Patrimonio | S-M | Medio-Alto | Sin capacidad de escritura |

### Bloque 3 — Jerarquía de «Hoy» + arranque de patrimonio

| Orden | ID | Tarea | Origen | Esfuerzo | Beneficio | Nota |
|---|---|---|---|---|---|---|
| 15 | OPT-7 | Resumir «modo familiar» y «alertas» en «Hoy» | Optimización | S-M | Medio-Alto | |
| 16 | OPT-9 | Auditar los `!important` de `styles.css` | Optimización | M | Medio | Sin prisa, pero cheap |
| 17 | OPT-8 | Jerarquía visual real en «Hoy» (máx. 4 bloques sin scroll) | Optimización | M | Alto | Depende de OPT-6 y OPT-7 |
| 18 | A14-1 | Contrato canónico `canonical-assets.js` | Patrimonio | L | Alto (estructural) | Dominio de datos nuevo; todo E21-E22 depende de esto |
| 19 | A14-6 | Compatibilidad y migración de patrimonio | Patrimonio | S | Alto (gate) | Ninguna vista existente cambia si no hay activos configurados |

### Bloque 4 — Vista de patrimonio + confianza externa

| Orden | ID | Tarea | Origen | Esfuerzo | Beneficio | Nota |
|---|---|---|---|---|---|---|
| 20 | A14-2 | Vista de nivel superior «Patrimonio» | Patrimonio | M | Alto | |
| 21 | A14-3 | Importación/actualización manual de valoraciones | Patrimonio | M | Alto | Bandeja previa, igual que cualquier otra entrada |
| 22 | A19-1 | Enlace de solo lectura, redactado y caducable | Patrimonio | M | Alto | Se apoya en permisos ya validados de A5-3 |
| 23 | A14-4 | Desglose por tipo y concentración de riesgo | Patrimonio | S | Medio | |
| 24 | A14-5 | Integración de patrimonio con el laboratorio de escenarios | Patrimonio | M | Medio | Reutiliza `canonical-e13-scenarios.js` |

### Bloque 5 — Cosecha de OPT-2 + remates de motivación

| Orden | ID | Tarea | Origen | Esfuerzo | Beneficio | Nota |
|---|---|---|---|---|---|---|
| 25 | OPT-10 | Clasificar pantallas heredadas por uso real | Optimización | S | Crítico | ⛔ depende de OPT-2 con ≥30 días — para este punto del calendario ya deberían estar cumplidos |
| 26 | OPT-11 | Retirar pantallas heredadas sin uso | Optimización | M | Alto | Depende de OPT-10 |
| 27 | A16-5 | Comparador bola de nieve / avalancha / óptimo | Patrimonio | S | Medio | |
| 28 | A16-6 | Hitos y rachas en el historial de auditoría | Patrimonio | S | Bajo-Medio | |
| 29 | A19-2 | Informe PDF certificado | Patrimonio | S-M | Medio | Más completo si A14 (patrimonio) ya existe |

### Bloque 6 — El grueso: fusión de pantallas + captura sin fricción

| Orden | ID | Tarea | Origen | Esfuerzo | Beneficio | Nota |
|---|---|---|---|---|---|---|
| 30 | OPT-12 | Migrar la función real que falta antes de retirar cada heredada | Optimización | M-L | Alto | Depende de OPT-10 |
| 31 | OPT-13 | Retirar cada heredada en cuanto su función está cubierta | Optimización | L | Crítico | Depende de OPT-12 |
| 32 | OPT-14 | Fusionar los seis pares de pantallas gemelas documentados | Optimización | L | Crítico | Mapa 4a de `docs/E19_SISTEMA_DISENO.md` §10 |
| 33 | A17-3 | Captura por cámara (OCR de tickets/facturas) | Patrimonio | L | Alto | Máxima palanca de retención del backlog completo |
| 34 | A17-4 | Captura por voz | Patrimonio | M-L | Alto | Requiere A5-1 (backend de IA) ya operativo |

### Bloque 7 — Navegación a 6 rutas + fiscalidad

| Orden | ID | Tarea | Origen | Esfuerzo | Beneficio | Nota |
|---|---|---|---|---|---|---|
| 35 | OPT-15 | Menú lateral a 6 rutas principales | Optimización | S | Alto | Depende de OPT-11 a OPT-14 |
| 36 | A15-1 | Registro de supuestos fiscales | Patrimonio | M | Alto | |
| 37 | A15-3 | Evento de renta en el calendario financiero | Patrimonio | S | Medio | |
| 38 | A15-4 | Simulador de aportación a plan de pensiones | Patrimonio | M | Medio | Más preciso si A14 (patrimonio) ya existe |
| 39 | A15-2 | Estimador de resultado de IRPF | Patrimonio | L | Alto (estacional) | Exactitud legal; conviene con A15-1/A15-4 ya asentados |

### Bloque 8 — Rendimiento estructural + hogar compartido

| Orden | ID | Tarea | Origen | Esfuerzo | Beneficio | Nota |
|---|---|---|---|---|---|---|
| 40 | OPT-16 | Migrar módulos a ES modules | Optimización | M-L | Medio (habilitador) | |
| 41 | OPT-17 | Carga diferida (`import()`) por vista activa | Optimización | L | Alto | Depende de OPT-16; más simple tras el bloque 6 |
| 42 | A18-1 | Reglas de reparto configurables por categoría | Patrimonio | M | Medio | |
| 43 | A18-2 | Saldo continuo «quién debe a quién» | Patrimonio | M | Medio | |
| 44 | A18-3 | Liquidación con doble confirmación | Patrimonio | M | Medio-Alto | Crítico en confianza aunque el alcance sea nicho |
| 45 | A15-5 | Tablas fiscales versionadas y su actualización anual | Patrimonio | S | Bajo | Mantenimiento recurrente |

### Bloque 9 — Gobernanza continua + oportunista

| Orden | ID | Tarea | Origen | Esfuerzo | Beneficio | Nota |
|---|---|---|---|---|---|---|
| 46 | OPT-20 | Consolidar los backlogs sueltos en una única fuente viva | Optimización | M | Medio | Alcance propio, no incluye a este documento ni a los dos que fusiona |
| 47 | OPT-21 | Checklist mensual de heurísticos de Nielsen | Optimización | S, mensual | Medio | |
| 48 | OPT-22 | Decidir y documentar el modelo Hogar/Javi/Tere | Optimización | S | Medio | |
| 49 | A19-3 | Comparador educativo de tarifas fijas | Patrimonio | S | Bajo-Medio | Depende de encontrar una fuente externa fiable; oportunista |

## Puerta de aceptación

La misma que ya rige cada backlog de origen: pruebas en verde, funcionamiento sin red ni servicios
externos, ausencia de escrituras durante simulaciones y vistas previas, comparación antes/después
con confirmación explícita, validación visual en escritorio y móvil, y documentación de estado
alineada al cierre de cada tarea — ver `BACKLOG_PATRIMONIO_Y_FINANZAS.md` §10 y
`BACKLOG_OPTIMIZACION.md` (leyenda de estado) para el detalle propio de cada eje.

## Nota de alcance

Este documento fija **solo el orden de ejecución conjunto**. Ninguna tarea tiene código asociado
todavía. El contexto, los pasos y el resultado esperado completo de cada tarea siguen viviendo en
su backlog de origen; ambos permanecen conservados y no se eliminan con esta fusión.
