# Backlog patrimonio y finanzas

Fecha de creación: 29 de agosto de 2026.

Propuesta de nuevas funcionalidades para `contabilidadcasa`, continuación de
`BACKLOG_PRODUCT_EVOLUTION.md` (última entrega cerrada: E20 — ver `BACKLOG_STATUS.md`).
No sustituye ningún backlog anterior: añade seis entregas nuevas (E21 a E26) centradas en
dos huecos estructurales — la app modela caja y deuda pero no patrimonio ni fiscalidad — y
en cerrar la brecha de fricción de entrada y motivación que queda tras E17/E23.

Este documento ordena las entregas **por el mismo criterio de esfuerzo-beneficio** que el
resto del producto usa para priorizar, no por el número de entrega. El número de entrega
(E21…E26) identifica el bloque temático; el orden de ejecución real es la tabla de la
sección 0.

Rige el mismo contrato de gobierno que el resto del backlog: ninguna entrega escribe sin
confirmación, toda cifra futura declara origen/fecha/confianza, y cada entrega debe
publicarse por sí sola dejando la app tan utilizable como estaba antes de empezarla.

## 0. Orden de ejecución recomendado (esfuerzo → beneficio)

| Orden | Entrega | Bloque | Esfuerzo | Beneficio | Por qué en esta posición |
| --- | --- | --- | --- | --- | --- |
| 1 | E23a | Salud financiera y suscripciones | Bajo-Medio | Alto | Reutiliza datos ya calculados (colchón, ratio de deuda, cumplimiento, estacionalidad); mayor impacto por menor coste de todo el backlog |
| 2 | E24a | Widget + calendario ICS | Bajo | Medio-Alto | Aprovecha la PWA ya existente; visibilidad diaria con coste mínimo, sin capacidad de escritura |
| 3 | E21 | Patrimonio neto | Alto | Alto estructural | Coste alto, pero todo lo posterior (escenarios, salud financiera, informes) mejora en cuanto existe; conviene absorber el coste pronto |
| 4 | E26a | Enlace de solo lectura + informe PDF | Medio-Bajo | Alto | Caso de uso real inmediato (hipoteca, gestor); se apoya en permisos ya validados del hogar compartido (A5-3) |
| 5 | E23b | Gamificación y rachas | Bajo | Medio | Remata el bloque de motivación sin bloquear nada |
| 6 | E24b | Captura por cámara y voz | Alto | Alto | Máxima palanca de retención, pero exige la infraestructura de IA/privacidad ya operativa (A5-1) y conviene lanzarla con E21/E23 asentados |
| 7 | E22 | Fiscalidad e IRPF | Alto | Alto estacional | Exactitud legal y mantenimiento anual de tablas; mejor con patrimonio (E21) construido, porque cruza aportaciones a pensiones con ambos dominios |
| 8 | E25 | Economía del hogar compartido | Medio | Medio, nicho | Solo relevante para hogares con cuentas parcialmente separadas; no bloquea nada del resto |
| 9 | E26b | Comparador de tarifas | Bajo | Bajo-Medio, incierto | Depende de una fuente externa fiable aún no decidida; se ejecuta de forma oportunista |

**Esfuerzo:** Bajo (reutiliza datos/motor existente, una vista nueva) · Medio (contrato
nuevo pequeño o integración acotada) · Alto (dominio de datos nuevo, migración, o
corrección legal/exactitud crítica).
**Beneficio:** medido en impacto sobre uso diario, retención o decisiones reales de
dinero, no en complejidad técnica.

## 1. E23a — Salud financiera y suscripciones (orden 1)

Objetivo: convertir datos que la app ya calcula en una sola cifra de confianza y detectar
la categoría de gasto donde más dinero se pierde por inercia.

| ID | Tarea | Prioridad | Resultado esperado |
| --- | --- | --- | --- |
| A16-1 | Puntuación de salud financiera compuesta | Alta | Cifra única (colchón, ratio deuda/ingresos, cumplimiento de presupuesto, progreso de objetivos, frescura de datos) visible en «Hoy», con cada componente explicado y su peso — mismo patrón que A2-6 |
| A16-2 | Tendencia histórica de la puntuación | Alta | Miniatura de evolución de 6-12 meses junto al número; nunca comparación con otros hogares |
| A16-3 | Detección de recurrentes/suscripciones | Alta | Agrupación por patrón e importe reutilizando el aprendizaje de estacionalidad de E12b; coste mensual y anualizado por suscripción, sin escribir nada sin confirmar |
| A16-4 | Avisos de renovación con acción sugerida | Media | Aviso configurable antes de cada renovación con acción segura (revisar/cancelar/mantener), mismo patrón que A3-4 |

## 2. E24a — Widget y calendario ICS (orden 2)

Objetivo: consulta de cero fricción para el dato más pedido («¿cuánto tengo hasta fin de
mes?») y sincronía con el calendario que la familia ya usa.

| ID | Tarea | Prioridad | Resultado esperado |
| --- | --- | --- | --- |
| A17-1 | Widget de solo lectura (saldo, próximo evento, colchón) | Media | Widget de pantalla de inicio y complicación de reloj, sin ninguna capacidad de escritura |
| A17-2 | Exportación/suscripción ICS del calendario financiero | Baja | Vencimientos y cierres visibles en Google/Apple Calendar, de solo lectura |

## 3. E21 — Patrimonio neto (orden 3)

Objetivo: que la app responda «¿estoy más rico que hace un año?», no solo «¿llego a fin
de mes?».

| ID | Tarea | Prioridad | Resultado esperado |
| --- | --- | --- | --- |
| A14-1 | Contrato canónico `canonical-assets.js` | Crítica | Activos tipados (cuenta, inversión, pensión, inmueble, vehículo, otro) con valor, fecha y procedencia obligatorias; sin procedencia, el dato se marca como desconocido, nunca se estima en silencio |
| A14-2 | Vista de nivel superior «Patrimonio» | Alta | Gráfico de patrimonio neto (activos − pasivos) mes a mes, con banda de confianza cuando hay estimación y línea sólida cuando hay dato real |
| A14-3 | Actualización manual e importación puntual de valoraciones | Alta | Formulario y CSV de bróker/fondo entran a bandeja previa igual que cualquier otra entrada; nunca se sobrescribe un valor sin comparación previa |
| A14-4 | Desglose por tipo y concentración de riesgo | Media | Vista de reparto líquido/inversión/inmobiliario/pensiones para detectar sobreexposición |
| A14-5 | Integración con el laboratorio de escenarios (E13) | Media | Un evento simulado puede afectar también a activos («caída de mercado del 20 %», «revalorización del inmueble»), reutilizando `canonical-e13-scenarios.js` sin motor nuevo |
| A14-6 | Compatibilidad y migración | Crítica | Un hogar que no configura ningún activo ve la app exactamente igual que hoy; ninguna vista existente cambia de comportamiento por la sola presencia del contrato |

## 4. E26a — Enlace de solo lectura e informe PDF (orden 4)

Objetivo: mostrar la disciplina interna de la app a terceros sin exponer todo el detalle.

| ID | Tarea | Prioridad | Resultado esperado |
| --- | --- | --- | --- |
| A19-1 | Enlace de solo lectura, redactado y caducable | Alta | Comparte una vista concreta (plan de deuda, forecast a 6 meses) con un asesor externo sin usuario propio ni acceso a movimientos individuales; caduca automáticamente |
| A19-2 | Informe PDF certificado | Media | Capacidad de pago, patrimonio neto (si existe E21), calendario de deuda y colchón, con fecha y advertencia de que es un resumen propio, no una certificación bancaria |

## 5. E23b — Gamificación y rachas (orden 5)

Objetivo: sostener la motivación durante los meses que dura pagar una deuda o ahorrar
para un objetivo, sin ocultar la opción matemáticamente óptima.

| ID | Tarea | Prioridad | Resultado esperado |
| --- | --- | --- | --- |
| A16-5 | Comparador bola de nieve / avalancha / óptimo | Media | Muestra explícitamente el coste extra en euros de elegir la opción motivadora frente a la matemáticamente óptima del comparador ya existente (A9-5) |
| A16-6 | Hitos y rachas en el historial de auditoría | Baja | «Primera deuda liquidada», «6 meses conciliados a tiempo» como anotaciones del historial ya existente, sin capa de insignias ajena al resto de la app |

## 6. E24b — Captura por cámara y voz (orden 6)

Objetivo: que registrar un gasto cueste segundos, no una sesión completa de app.

| ID | Tarea | Prioridad | Resultado esperado |
| --- | --- | --- | --- |
| A17-3 | Captura por cámara (OCR de tickets/facturas) | Alta | Extracción de importe/fecha/comercio/categoría que entra siempre a la bandeja previa (A6-2), nunca directa al libro; adjunto cifrado enlazado al movimiento (A3-5) |
| A17-4 | Captura por voz | Media | Transcripción local a borrador de movimiento con categoría sugerida, confirmado antes de guardar; la IA solo redacta, igual que en A5-1 |

## 7. E22 — Fiscalidad e IRPF (orden 7)

Objetivo: que el calendario fiscal deje de ser una sorpresa de junio y se integre como
una previsión más.

| ID | Tarea | Prioridad | Resultado esperado |
| --- | --- | --- | --- |
| A15-1 | Registro de supuestos fiscales en el registro central (A7-2) | Alta | Tributación conjunta/individual, retenciones, aportaciones deducibles, alquiler y familia numerosa como supuestos versionados, editables en un único lugar |
| A15-2 | Estimador de resultado de IRPF | Alta | Resultado a devolver/pagar mostrado siempre como rango, con fecha de referencia y advertencia de que no sustituye asesoría fiscal — mismo estándar que el comparador legal de deuda (A2-3) |
| A15-3 | Evento de renta en el calendario financiero | Media | El pago o devolución aparece en `canonical-e15-goals.js`/calendario como evento previsto con su incertidumbre |
| A15-4 | Simulador de aportación a plan de pensiones | Media | Compara ahorro fiscal estimado frente a liquidez inmovilizada antes de aportar, usando el límite deducible vigente |
| A15-5 | Tablas fiscales versionadas y su actualización anual | Baja | Tramos y límites como datos versionados con fecha de vigencia, para no mezclar años fiscales distintos |

## 8. E25 — Economía del hogar compartido (orden 8)

Objetivo: resolver el reparto justo de gastos comunes en hogares con ingresos o cuentas
no simétricas.

| ID | Tarea | Prioridad | Resultado esperado |
| --- | --- | --- | --- |
| A18-1 | Reglas de reparto configurables por categoría | Media | Reparto a partes iguales, proporcional a ingresos o importe fijo, por categoría o gasto |
| A18-2 | Saldo continuo «quién debe a quién» | Media | Cálculo permanente visible para ambas partes, sin afectar al libro principal |
| A18-3 | Liquidación con doble confirmación | Alta | Cada liquidación periódica sugerida requiere confirmación de ambas partes antes de registrarse como transferencia interna, mismo patrón que el ciclo de aprobación de E5 |

## 9. E26b — Comparador de tarifas (orden 9)

Objetivo: ayudar a preguntarse si un gasto fijo recurrente sigue siendo competitivo.

| ID | Tarea | Prioridad | Resultado esperado |
| --- | --- | --- | --- |
| A19-3 | Comparador educativo de tarifas fijas | Baja | Aviso periódico y no intrusivo sobre gastos fijos (energía, seguro, telecomunicaciones) con fuente citada; ninguna integración comparte datos con terceros sin consentimiento revocable |

## 10. Puerta de aceptación de cada entrega

Igual que en `BACKLOG_PRODUCT_EVOLUTION.md` §6: pruebas en verde, apertura de una copia
de la versión anterior, funcionamiento sin red ni servicios externos, ausencia de
escrituras durante simulaciones y vistas previas, comparación antes/después con
confirmación explícita, explicación de origen/fecha/método/confianza en toda cifra nueva,
validación visual en escritorio y móvil, y documentación de estado alineada al cierre.

## 11. Nota de alcance

Este backlog es una propuesta de producto, no una entrega verificada. Ninguna de las
tareas anteriores tiene código asociado todavía; se incorpora al ciclo de trabajo
habitual (`BACKLOG.md` / `PROJECT_STATE.md`) en el momento en que se decida empezar a
ejecutarla.
