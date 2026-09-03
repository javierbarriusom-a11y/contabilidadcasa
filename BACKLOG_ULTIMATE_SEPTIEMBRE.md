# Backlog Ultimate Septiembre — vigente + ampliación, en un único orden

> Mapa de todos los backlogs del repositorio: [`BACKLOG_INDICE.md`](BACKLOG_INDICE.md) (OPT-20).
> Este es el documento vigente — la única cola con trabajo pendiente de la ruta principal.

Fecha: 29 de agosto de 2026. Repositorio vivo: `javierbarriusom-a11y/contabilidadcasa`.

Este documento fusiona **dos generaciones de backlog** en un único orden de ejecución de 99 tareas:

- **El backlog vigente** (`BACKLOG_UNIFICADO.md`, 49 tareas): `BACKLOG_PATRIMONIO_Y_FINANZAS.md`
  (E21-E26, prefijo `A14` a `A19`) y `BACKLOG_OPTIMIZACION.md` (prefijo `OPT-1` a `OPT-22`).
- **La ampliación de septiembre** (50 ideas nuevas, sin documento de detalle propio todavía):
  previsión viva (`PV`), inversión (`IV`), apalancamiento y deuda estratégica (`AP`), copiloto
  proactivo (`CP`), experiencia y confianza (`UX`), fiscalidad de cartera (`FC`), tesorería táctica
  (`TT`), instrumentos de deuda (`DI`) y seguros y protección patrimonial (`SP`) — nacidas de pedir
  específicamente que las previsiones se autoajusten con datos reales, y de cubrir dos dominios que
  la app no tenía: inversión y apalancamiento (pedir deuda para invertir, y cuándo cancelar deuda
  existente según el líquido real).

Los documentos originales **se conservan íntegros** como referencia de detalle de las 49 tareas
vigentes; este archivo aporta el orden de ejecución conjunto. Las 50 tareas de la ampliación no
tienen todavía un documento de detalle propio — su descripción completa vive en la conversación que
las originó; aquí se resume en la columna Nota de cada una.

## Cómo se ha calculado el orden

La primera versión de esta fusión apilaba las 50 tareas nuevas detrás de las 49 vigentes, por
prudencia. Al cuestionar ese orden explícitamente, no se sostenía: **la mayoría de las 50 ideas no
dependen de ninguna tarea pendiente del backlog vigente** — se apoyan en motores que ya están en
producción (`canonical-forecast.js`, `canonical-debt-comparator.js`, `canonical-cushion.js`,
`canonical-e13-scenarios.js`, `canonical-decisions.js`). Aparcarlas hasta el final no tenía más
justificación que el orden en que se propusieron.

El orden real de este documento se calcula por **nivel de dependencia**: nivel 0 si una tarea no
necesita ninguna otra de este documento (aunque sí pueda apoyarse en un motor ya en producción);
nivel 1 si depende solo de tareas de nivel 0; nivel 2 si depende de al menos una de nivel 1; y así
sucesivamente. Dentro de cada nivel, se ordena primero por esfuerzo (S antes que L) y luego por
beneficio (crítico antes que bajo). Los bloques 1-6 son nivel 0; 7-9 son nivel 1; 10 es nivel 2; 11
es nivel 3-4. Cada tarea con dependencia real la cita explícitamente en su columna Nota.

Una dependencia dura se conserva tal cual, porque no es negociable: ninguna tarea de fusión de
pantallas puede empezar antes de que `OPT-2` lleve un mínimo de 30 días midiendo uso real (bloque 7,
`OPT-10`). Por eso `OPT-2` se coloca en el bloque 1 —arranca el contador cuanto antes— y las tareas
que dependen de él quedan en bloques posteriores por ese plazo de calendario, no por esfuerzo puro.

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
| Patrimonio | Backlog vigente — `BACKLOG_PATRIMONIO_Y_FINANZAS.md` (E21-E26) |
| Optimización | Backlog vigente — `BACKLOG_OPTIMIZACION.md` |
| Previsión viva | Ampliación — la previsión se reescribe sola con datos reales |
| Inversión | Ampliación — cartera, rentabilidad, riesgo |
| Apalancamiento | Ampliación — pedir deuda para invertir, y deuda estratégica |
| Copiloto | Ampliación — señales proactivas con evidencia, sin revivir el asistente retirado |
| Experiencia | Ampliación — UX/UI de confianza y control |
| Fiscalidad | Ampliación — fiscalidad de la cartera de inversión |
| Tesorería | Ampliación — dónde vive el colchón y cómo se reparte |
| Deuda: instrumentos | Ampliación — hipoteca, revolving, avales, líneas de crédito |
| Seguros | Ampliación — protección patrimonial |

Estado: mismos símbolos que `BACKLOG.md`/`BACKLOG_OPERACION.md` (✅ hecho · 🟡 parcial · ⏳ pendiente
sin bloqueo · ⛔ bloqueado). Todas las tareas de este documento están ⏳ salvo aviso contrario.

## Orden de ejecución — 99 tareas en 11 bloques

### Bloque 1 — Nivel 0: lo mejor primero, sin ninguna dependencia (S, crítico o alto)

| Orden | ID | Tarea | Origen | Esfuerzo | Beneficio | Nota |
|---|---|---|---|---|---|---|
| 1 | AP4 | Barrera de seguridad antes de simular apalancamiento | Apalancamiento | S | Crítico | Guardarraíl; se construye antes que el propio simulador (AP3, bloque 9) |
| 2 | OPT-1 | `defer` en los `<script>` de `index.html` | Optimización | S | Alto | Sin cambio de comportamiento |
| 3 | OPT-2 | Instrumentar uso real de pantallas heredadas | Optimización | S | Alto (habilitador) | Arranca el contador de 30 días que bloquea el bloque 7 |
| 4 | OPT-3 | Minificar el artefacto publicado | Optimización | S | Alto | No toca el código fuente |
| 5 | OPT-4 | Accesibilidad verificada de verdad (axe-core) | Optimización | S | Alto | |
| 6 | CP3 | Ninguna recomendación sin su cita | Copiloto | S | Alto | Regla de diseño; precede a CP1 (bloque 8) |
| 7 | TT1 | Reparto del colchón entre corriente y remunerado | Tesorería | S | Alto | Extiende `canonical-cushion.js`, ya en producción |
| 8 | TT5 | El suelo del colchón como parámetro vivo | Tesorería | S | Alto | Extiende `canonical-cushion.js` |
| 9 | SP2 | Brecha de cobertura de vida frente a deuda pendiente | Seguros | S | Alto | Compara capital asegurado con deuda pendiente total |

### Bloque 2 — Nivel 0: el resto de lo barato, sin bloqueos (S, medio o bajo)

| Orden | ID | Tarea | Origen | Esfuerzo | Beneficio | Nota |
|---|---|---|---|---|---|---|
| 10 | OPT-6 | Sacar el bloque de configuración de «Hoy» | Optimización | S | Medio | |
| 11 | OPT-18 | Verificar compresión Brotli/Gzip del artefacto | Optimización | S | Medio | |
| 12 | OPT-19 | Checklist de reutilización de componentes `.e19-*` en PR | Optimización | S, continuo | Medio | |
| 13 | OPT-21 | Checklist mensual de heurísticos de Nielsen | Optimización | S, mensual | Medio | |
| 14 | OPT-22 | Decidir y documentar el modelo Hogar/Javi/Tere | Optimización | S | Medio | |
| 15 | A16-5 | Comparador bola de nieve / avalancha / óptimo | Patrimonio | S | Medio | |
| 16 | A17-2 | Exportación/suscripción ICS del calendario financiero | Patrimonio | S | Medio | Solo lectura |
| 17 | A15-3 | Evento de renta en el calendario financiero | Patrimonio | S | Medio | |
| 18 | CP5 | Presupuesto de riesgo con severidad graduada | Copiloto | S | Medio | Pasa el umbral binario de A11-5 a tres bandas |
| 19 | TT3 | Registro comparado de cuentas remuneradas activas | Tesorería | S | Medio | |
| 20 | TT4 | Alerta de comisiones de mantenimiento y vinculación | Tesorería | S | Medio | |
| 21 | DI2 | Línea de crédito de emergencia vs. colchón líquido | Deuda: instrumentos | S | Medio | |
| 22 | SP1 | Inventario de pólizas con vencimientos en el calendario | Seguros | S | Medio | |
| 23 | SP5 | Deducible óptimo según el colchón disponible | Seguros | S | Medio | Extiende `canonical-cushion.js` |
| 24 | PV2 | Termómetro de desviación por partida | Previsión viva | S | Medio | Visualiza lo que `learnFromHistory()` ya calcula |
| 25 | A16-6 | Hitos y rachas en el historial de auditoría | Patrimonio | S | Bajo-Medio | |
| 26 | A15-5 | Tablas fiscales versionadas y su actualización anual | Patrimonio | S | Bajo | |
| 27 | A19-3 | Comparador educativo de tarifas fijas | Patrimonio | S | Bajo-Medio, oportunista | |

### Bloque 3 — Nivel 0: S-M, sin bloqueos

| Orden | ID | Tarea | Origen | Esfuerzo | Beneficio | Nota |
|---|---|---|---|---|---|---|
| 28 | OPT-7 | Resumir «modo familiar» y «alertas» en «Hoy» | Optimización | S-M | Medio-Alto | |
| 29 | A17-1 | Widget de solo lectura (saldo, próximo evento, colchón) | Patrimonio | S-M | Medio-Alto | Sin capacidad de escritura |
| 30 | PV3 | Recalibración en cascada al cerrar el mes | Previsión viva | S-M | Alto | Dispara `learnFromHistory()` al confirmar el cierre mensual (A1-2) |
| 31 | PV5 | Diario de por qué cambió cada cifra | Previsión viva | S-M | Alto | Prerrequisito de confianza para PV1 (bloque 8) |
| 32 | CP6 | «¿Y si...?» antes de comprometer dinero | Copiloto | S-M | Alto | Pasa cada decisión grande por el escenario de tensión una vez |
| 33 | UX2 | «Dato real / simulación / decisión aplicada», siempre visible | Experiencia | S-M | Alto | Lleva el rigor previsto/real/usado (A6) al cromado de cada pantalla |
| 34 | CP4 | Comparación automática de escenarios en la revisión mensual | Copiloto | S-M | Medio | Extiende A10-5 |

### Bloque 4 — Nivel 0: M, alto beneficio, sin bloqueos

| Orden | ID | Tarea | Origen | Esfuerzo | Beneficio | Nota |
|---|---|---|---|---|---|---|
| 35 | OPT-5 | Presupuesto de rendimiento real (Lighthouse CI) | Optimización | M | Alto | Sustituye el umbral de peso de fichero de OPT-3 |
| 36 | A16-1 | Puntuación de salud financiera compuesta | Patrimonio | M | Alto | Reutiliza KPIs ya calculados (A2-6) |
| 37 | A16-3 | Detección de recurrentes/suscripciones | Patrimonio | M | Alto | Reutiliza aprendizaje de estacionalidad (E12b) |
| 38 | A15-1 | Registro de supuestos fiscales | Patrimonio | M | Alto | |
| 39 | PV4 | Bandas de confianza, no una sola línea | Previsión viva | M | Alto | Sombrea el forecast con la estacionalidad/desviación ya calculadas |
| 40 | UX1 | Deshacer de 10 segundos en vez de confirmaciones modales | Experiencia | M | Alto | Auditar cada modal de confirmación reversible |
| 41 | DI1 | Hipoteca variable → fija bajo escenarios de tipos | Deuda: instrumentos | M | Alto | Usa el motor base/favorable/tensión ya existente |
| 42 | DI5 | Reestructuración conjunta ante una caída de ingresos | Deuda: instrumentos | M | Alto | |

### Bloque 5 — Nivel 0: M, beneficio medio, sin bloqueos

| Orden | ID | Tarea | Origen | Esfuerzo | Beneficio | Nota |
|---|---|---|---|---|---|---|
| 43 | OPT-9 | Auditar los `!important` de `styles.css` | Optimización | M | Medio | Sin prisa, pero barato |
| 44 | OPT-20 | Consolidar los backlogs sueltos en una única fuente viva | Optimización | M | Medio | |
| 45 | A15-4 | Simulador de aportación a plan de pensiones | Patrimonio | M | Medio | |
| 46 | A18-1 | Reglas de reparto configurables por categoría | Patrimonio | M | Medio | |
| 47 | PV6 | Sensibilidad: qué previsión cambiaría el veredicto | Previsión viva | M | Medio | |
| 48 | UX3 | Comparar dos momentos en el tiempo, no solo «ahora» | Experiencia | M | Medio | |
| 49 | UX5 | Modo reunión para decidir en pareja | Experiencia | M | Medio | |
| 50 | UX6 | Búsqueda que entiende preguntas de importe | Experiencia | M | Medio | Extiende el lanzador A12-3 |
| 51 | SP4 | Autoseguro vs. comprar seguro para riesgos pequeños | Seguros | M | Bajo-Medio | Usa `cushionFloor()` como referencia |

### Bloque 6 — Nivel 0: los grandes cimientos (M-L a L, sin dependencias)

| Orden | ID | Tarea | Origen | Esfuerzo | Beneficio | Nota |
|---|---|---|---|---|---|---|
| 52 | IV1 | Registro de cartera por posición | Inversión | L | Crítico (estructural) | La más grande de toda la ampliación; todo el bloque de inversión y fiscalidad de cartera depende de esta |
| 53 | OPT-14 | Fusionar los seis pares de pantallas gemelas documentados | Optimización | L | Crítico | Corrección 3-sep: relegación y paridad de los 6 pares ya confirmadas por el usuario el 10-12 de agosto (`BACKLOG.md` §2-3); solo queda retirar código, y eso depende de OPT-2 igual que OPT-11/12/13 — no es nivel 0 de verdad, ver `BACKLOG_OPTIMIZACION.md` |
| 54 | A17-4 | Captura por voz | Patrimonio | M-L | Alto | Requiere A5-1 operativo (fuera de este documento) |
| 55 | A14-1 | Contrato canónico `canonical-assets.js` | Patrimonio | L | Alto (estructural) | Todo E21-E22 depende de esto |
| 56 | A17-3 | Captura por cámara (OCR de tickets/facturas) | Patrimonio | L | Alto (máxima retención) | |
| 57 | OPT-16 | Migrar módulos a ES modules | Optimización | M-L | Medio (habilitador) | |

### Bloque 7 — Nivel 1: S, con OPT-2/4, A14-1, A16-1/3/5 e IV1 ya construidos

| Orden | ID | Tarea | Origen | Esfuerzo | Beneficio | Nota |
|---|---|---|---|---|---|---|
| 58 | OPT-10 | Clasificar pantallas heredadas por uso real | Optimización | S | Crítico | ⛔ Depende de OPT-2 con ≥30 días |
| 59 | A16-2 | Tendencia histórica de la puntuación de salud financiera | Patrimonio | S | Medio-Alto | Depende de A16-1 |
| 60 | A14-6 | Compatibilidad y migración de patrimonio | Patrimonio | S | Alto (gate) | Depende de A14-1 |
| 61 | UX4 | Ninguna cifra financiera solo por color | Experiencia | S | Alto | Depende de OPT-4 |
| 62 | DI3 | Detector y priorizador automático de revolving | Deuda: instrumentos | S | Alto | Depende de A16-5 |
| 63 | A16-4 | Avisos de renovación con acción sugerida | Patrimonio | S | Medio | Depende de A16-3 |
| 64 | A14-4 | Desglose por tipo y concentración de riesgo | Patrimonio | S | Medio | Depende de A14-1 |
| 65 | IV4 | Concentración y correlación de riesgo real | Inversión | S | Medio | Depende de IV1 |
| 66 | DI4 | Impacto de avales en la capacidad de endeudamiento futura | Deuda: instrumentos | S | Medio | Depende de A14-1 |
| 67 | SP3 | Seguro de hogar vs. valor de reposición de bienes | Seguros | S | Medio | Depende de A14-1 |
| 68 | FC2 | Traspasos entre fondos sin peaje fiscal | Fiscalidad | S | Medio | Depende de IV1 |
| 69 | IV6 | Rebalanceo guiado por umbral | Inversión | S | Bajo-Medio | Depende de IV1 |
| 70 | FC4 | Retención de dividendos y doble imposición | Fiscalidad | S | Bajo-Medio | Depende de IV1 |

### Bloque 8 — Nivel 1: S-M/M, un paso más sobre patrimonio, previsión e inversión

| Orden | ID | Tarea | Origen | Esfuerzo | Beneficio | Nota |
|---|---|---|---|---|---|---|
| 71 | PV1 | Autoajuste de la previsión por niveles de confianza | Previsión viva | M | Crítico | Depende de PV5; el ajuste que hoy nunca se aplica solo |
| 72 | A14-2 | Vista de nivel superior «Patrimonio» | Patrimonio | M | Alto | Depende de A14-1 |
| 73 | A14-3 | Importación/actualización manual de valoraciones | Patrimonio | M | Alto | Depende de A14-1 |
| 74 | A19-1 | Enlace de solo lectura, redactado y caducable | Patrimonio | M | Alto | Depende de A14-1 |
| 75 | OPT-8 | Jerarquía visual real en «Hoy» (máx. 4 bloques sin scroll) | Optimización | M | Alto | Depende de OPT-6 y OPT-7 |
| 76 | IV2 | Rentabilidad real: TWR y XIRR | Inversión | M | Alto | Depende de IV1 |
| 77 | CP1 | Motor de próxima mejor acción | Copiloto | M | Alto | Depende de CP3; usa `canonical-e9-assistant.js` sin revivir el widget retirado |
| 78 | FC1 | Plusvalías por FIFO en cada venta parcial | Fiscalidad | M | Alto | Depende de IV1 |
| 79 | IV3 | Aportaciones programadas en el calendario financiero | Inversión | S-M | Medio | Depende de IV1 |
| 80 | A14-5 | Integración de patrimonio con el laboratorio de escenarios | Patrimonio | M | Medio | Depende de A14-1 |
| 81 | A18-2 | Saldo continuo «quién debe a quién» | Patrimonio | M | Medio | Depende de A18-1 |

### Bloque 9 — Nivel 1: L, lo más caro que solo necesitaba un cimiento del nivel 0

| Orden | ID | Tarea | Origen | Esfuerzo | Beneficio | Nota |
|---|---|---|---|---|---|---|
| 82 | A15-2 | Estimador de resultado de IRPF | Patrimonio | L | Alto (estacional) | Depende de A15-1 |
| 83 | OPT-17 | Carga diferida (`import()`) por vista activa | Optimización | L | Alto | Depende de OPT-16 |
| 84 | AP3 | Simulador de apalancamiento (pedir deuda para invertir) | Apalancamiento | L | Medio (exploratorio) | Depende de AP4; explorar, no ejecutar |

### Bloque 10 — Nivel 2: retirada de heredadas, patrimonio compartido y el primer apalancamiento comparado

| Orden | ID | Tarea | Origen | Esfuerzo | Beneficio | Nota |
|---|---|---|---|---|---|---|
| 85 | AP6 | Alerta cuando el líquido ya no sostiene la deuda tomada | Apalancamiento | S-M | Alto | Depende de AP3 |
| 86 | OPT-11 | Retirar pantallas heredadas sin uso | Optimización | M | Alto | Depende de OPT-10 |
| 87 | A18-3 | Liquidación con doble confirmación | Patrimonio | M | Medio-Alto | Depende de A18-2 |
| 88 | IV5 | Coste de oportunidad junto a cada decisión de caja | Inversión | M | Alto (habilita AP1) | Depende de IV1 e IV2 |
| 89 | AP1 | Comparador amortizar vs. invertir | Apalancamiento | M | Alto | Depende de IV1 e IV2; extiende `canonical-debt-comparator.js` |
| 90 | OPT-12 | Migrar la función real que falta antes de retirar cada heredada | Optimización | M-L | Alto | Depende de OPT-10 |
| 91 | AP2 | Punto de equilibrio tipo deuda vs. tipo esperado de inversión | Apalancamiento | S | Medio | Depende de IV2 |
| 92 | A19-2 | Informe PDF certificado | Patrimonio | S-M | Medio | Depende de A14-2 y A14-3 |
| 93 | FC3 | Compensación de pérdidas y ganancias a cierre de año | Fiscalidad | M | Medio | Depende de IV1 e IV2 |
| 94 | FC5 | Venta parcial optimizando el tramo del ahorro | Fiscalidad | M | Medio | Depende de IV2 |
| 95 | AP5 | Deuda nueva y existente en una sola cola de prioridad | Apalancamiento | M | Medio | Depende de AP3 y A16-5 |

### Bloque 11 — Nivel 3-4: el cierre, dependencias encadenadas

| Orden | ID | Tarea | Origen | Esfuerzo | Beneficio | Nota |
|---|---|---|---|---|---|---|
| 96 | OPT-13 | Retirar cada heredada en cuanto su función está cubierta | Optimización | L | Crítico | Depende de OPT-12 |
| 97 | CP2 | Detección de «dinero parado» | Copiloto | S | Alto | Depende de AP1 |
| 98 | OPT-15 | Menú lateral a 6 rutas principales | Optimización | S | Alto | Depende de OPT-11, OPT-12, OPT-13 y OPT-14 |
| 99 | TT2 | Escalera de vencimientos para el exceso sobre el colchón | Tesorería | S-M | Medio | Depende de CP2 y TT1 |

## Notas finales

- El bloque de apalancamiento (`AP1`-`AP6`) es, con diferencia, el de mayor riesgo de todo el
  documento: es el único punto donde la app pasaría de comparar decisiones a sugerir tomar deuda
  nueva. Su guardarraíl (`AP4`) se construye antes que el propio simulador (`AP3`) a propósito.
- Este documento sustituye el orden de ejecución de `BACKLOG_UNIFICADO.md` para las 49 tareas
  vigentes — su contenido no ha cambiado, solo su posición relativa al fusionarse con la ampliación.
- Existe una versión visual interactiva de este mismo backlog (con checklist marcable por navegador,
  filtros por origen/estado y progreso), publicada como artefacto en esta sesión de Claude.
