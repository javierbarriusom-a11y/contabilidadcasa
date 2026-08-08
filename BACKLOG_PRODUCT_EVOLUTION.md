# Backlog de evolución del producto

Fecha de creación: 1 de agosto de 2026.

Este backlog comienza después del cierre de E9. Conserva la activación externa pendiente de E10 y
ordena una nueva etapa centrada en que la aplicación sea más fácil de alimentar, más fiable para
anticipar la caja y más útil para decidir sobre deuda, ahorro y proyectos.

No sustituye el historial de `BACKLOG_STATUS.md`. A partir de su aprobación debe convertirse en la
referencia para el trabajo nuevo; el backlog anterior queda como evidencia de las entregas E1 a E9.

## 1. Principios de ejecución

1. **La aplicación siempre debe seguir siendo utilizable.** Cada entrega debe poder publicarse por sí
   sola y conservar entrada manual, CSV/Excel, copia local y recuperación aunque fallen servicios nuevos.
2. **Evolución, no reescritura.** Los motores canónicos, el libro mayor y la persistencia existentes se
   amplían mediante contratos versionados y adaptadores; no se sustituyen de una vez.
3. **Simular nunca modifica el plan real.** Un escenario solo pasa al estado operativo tras mostrar
   diferencias, validar invariantes y recibir una confirmación explícita.
4. **Dato, supuesto y predicción no se mezclan.** Toda cifra futura debe identificar origen, fecha,
   método, horizonte, confianza y si procede de un dato real, una regla o una hipótesis del usuario.
5. **No inventar precisión.** Con poco histórico se mostrarán rangos prudentes y factores de riesgo, no
   probabilidades aparentemente exactas.
6. **Compatibilidad y recuperación obligatorias.** Los cambios de esquema necesitan migración probada,
   lectura de copias anteriores y una vía de vuelta mediante versiones.
7. **Las integraciones externas son opcionales.** E10 avanza en una línea independiente y no bloquea las
   mejoras locales de datos, previsión o deuda.

## 2. Diagnóstico de la aplicación actual

### Fortalezas que deben conservarse

- Libro mayor, cálculo mensual y diario, auditoría, revisiones y sincronización optimista ya son
  canónicos y están protegidos por pruebas.
- La aplicación ya distingue previsto, real y valor usado; permite importar movimientos, conciliar,
  cerrar meses, restaurar copias y trabajar sin conexión.
- Existen previsión, simulador, escenarios, comparación avanzada, plan de ahorro y varias lecturas de
  deuda que aportan una buena base funcional.
- La publicación pública usa datos sintéticos y las dependencias externas permanecen apagadas.

### Problemas y oportunidades observados

- **Entrada dispersa:** `Actualizar`, `Registrar reales del mes`, `Carga de datos`, `Movimientos` y
  `Conciliación` participan en un mismo proceso, pero cada pantalla usa lenguaje y reglas de guardado
  diferentes. Es fácil no saber dónde empezar, qué se guarda automáticamente o qué queda pendiente.
- **Previsión fragmentada:** `Previsión`, `Proyección`, `Simulador`, `Plan ahorro` y las pantallas de nueva
  vida muestran partes del futuro sin un espacio único para supuestos, versiones y comparación.
- **Predicción todavía limitada:** hay bandas calibradas con histórico conciliado, pero falta aprendizaje
  de estacionalidad, desviaciones previsto/real, ingresos irregulares y riesgos correlacionados.
- **Deuda duplicada y aislada:** el plan visual se ejecuta dentro de `debt-roadmap.html`, mantiene campos y
  cálculos propios y no consume directamente los contratos canónicos de deuda. Su estado se conserva,
  pero no existe una integración segura de ida y vuelta con el resto del plan financiero.
- **Demasiadas rutas para una misma decisión:** la navegación avanzada ofrece varias vistas potentes,
  aunque cuesta distinguir las pantallas de uso diario de las herramientas de análisis ocasional.
- **Falta un ciclo continuo:** la aplicación registra y proyecta, pero todavía puede explicar mejor qué
  cambió desde la última revisión, qué predicción falló y qué dato conviene corregir primero.

## 3. Líneas de trabajo y prioridades

| Línea | Entregas | Prioridad | Puede avanzar sin E10 |
| --- | --- | --- | --- |
| Activación externa segura | E10 | Media | No aplica |
| Entrada y calidad de datos | E11 | Crítica | Sí |
| Forecasting y escenarios | E12, E13 | Alta | Sí |
| Deuda integrada | E14 | Alta | Sí |
| Planificación y seguimiento | E15, E16 | Media | Sí |
| Simplificación y robustez | E17, E18 | Alta/continua | Sí |

El orden recomendado es E11 → E12 → E13 → E14. Por decisión de producto, E10 se ejecutará al final y
ninguna mejora esencial dependerá del backend de IA. E15 a E18 se incorporan después de que el ciclo básico
«introducir → comprobar → proyectar → decidir» sea inequívoco.

## 4. Entregas propuestas

### E10 — Activación externa independiente

E10 mantiene los contratos seguros publicados en E9 y activa cada servicio por separado. La aplicación
local debe abrir, calcular y guardar aunque todos los servicios estén apagados.

| ID | Desarrollo | Prioridad | Criterio de aceptación |
| --- | --- | --- | --- |
| A5-1 | Backend privado y OpenAI Responses API | Media | Autenticación, minimización, almacenamiento desactivado, fuentes, trazabilidad y prueba real sin escritura financiera |
| A5-2 | Selección del modelo de OpenAI | Media | Comparación reproducible de calidad, coste y latencia con un conjunto anonimizado antes de fijar modelo y límites |
| A5-3 | Hogar compartido | Baja | Invitación, permisos, conflicto y revocación verificados con dos cuentas sin romper el modo individual |
| A5-4 | Web push | Baja | Consentimiento, contenido genérico, silencios y revocación probados con backend seguro |
| A5-5 | Conexión bancaria PSD2 | Baja | Proveedor contratado, cobertura y precio aceptados; acceso revocable y solo lectura comprobado |
| A5-6 | Importación bancaria programada | Baja | Depende de A5-5; ejecución idempotente en bandeja previa, sin escribir automáticamente en el libro |

**Límite de alcance:** A5-1 y A5-2 pueden ayudar a explicar o explorar, pero no se convierten en fuente
de verdad ni en requisito para forecasting. A5-3 a A5-6 continúan aplazables sin bloquear E11-E18.

### E11 — Centro único de actualización de datos

Objetivo: que una persona sepa en menos de un minuto dónde introducir un dato, qué efecto tendrá y si
ha quedado guardado, conciliado o pendiente.

| ID | Desarrollo | Prioridad | Criterio de aceptación |
| --- | --- | --- | --- |
| A6-1 | Portada «Actualizar mis datos» guiada | Crítica | Ofrece rutas claras para saldo, movimiento, real mensual, previsión e importación, con última actualización y siguiente acción |
| A6-2 | Bandeja única de entradas | Crítica | Manual, CSV, Excel y futura PSD2 llegan a una bandeja previa común; nada entra al libro sin comparación y confirmación |
| A6-3 | Editor unificado previsto/real/usado | Crítica | Una misma regla y vocabulario en tabla mensual, registro rápido y detalle; vacío, cero y corrección quedan inequívocos |
| A6-4 | Asistente de importación por pasos | Alta | Detecta formato, muestra columnas, duplicados, bajas y efecto mensual antes de importar; permite volver atrás sin perder el archivo |
| A6-5 | Conciliación orientada a tareas | Alta | Agrupa diferencias por causa probable y propone la acción segura: clasificar, corregir real, ajustar saldo o ignorar con motivo |
| A6-6 | Recibo de cada actualización | Alta | Tras guardar muestra qué cambió, qué cálculos se actualizaron, revisión creada y cómo deshacerlo |
| A6-7 | Indicador de frescura y cobertura | Alta | Cada área muestra hasta qué fecha está actualizada y qué datos faltan para confiar en saldo, forecast y deuda |
| A6-8 | Compatibilidad y migración | Crítica | Las copias anteriores abren sin pérdida; la nueva bandeja se activa de forma gradual y puede deshabilitarse sin perder entradas |

**Entrega utilizable:** A6-1 a A6-3 forman E11a y se publican antes de rehacer importaciones. A6-4 a
A6-8 forman E11b. Así se mejora primero la orientación sin paralizar los flujos actuales.

### E12 — Forecast financiero canónico

Objetivo: reunir en un solo contrato la proyección de caja, ingresos, gastos, deuda, ahorro y proyectos,
manteniendo las vistas actuales como consumidores compatibles durante la transición.

| ID | Desarrollo | Prioridad | Criterio de aceptación |
| --- | --- | --- | --- |
| A7-1 | Contrato único de forecast versionado | Crítica | Todas las vistas futuras pueden leer la misma serie base con origen, fecha, método y huella de supuestos |
| A7-2 | Registro central de supuestos | Alta | Ingresos, inflación, gastos, deuda, rentabilidad y fechas se editan en un único lugar y quedan versionados |
| A7-3 | Línea base explicable | Alta | Cada valor mensual se descompone en real, recurrencia, evento, deuda, proyecto y ajuste manual |
| A7-4 | Aprendizaje de desviaciones | Alta | Compara previsto frente a real por concepto y propone correcciones futuras que nunca se aplican sin confirmar |
| A7-5 | Estacionalidad e ingresos irregulares | Alta | Detecta patrones solo con histórico conciliado suficiente y muestra cobertura de muestra y confianza |
| A7-6 | Horizonte adaptativo | Media | Detalle mensual a corto plazo y bandas trimestrales/anuales a largo plazo, sin falsa precisión más allá de la evidencia |
| A7-7 | Pruebas de paridad | Crítica | Durante la migración, el nuevo contrato reproduce los resultados canónicos actuales o explica toda diferencia aceptada |

### E13 — Laboratorio de escenarios y predicciones

Objetivo: responder «¿qué pasa si…?» y «¿qué puede salir mal?» sin alterar el plan vigente.

| ID | Desarrollo | Prioridad | Criterio de aceptación |
| --- | --- | --- | --- |
| A8-1 | Escenarios base, favorable y tensión | Alta | Se generan desde el forecast canónico con supuestos visibles y editables, no mediante cifras ocultas |
| A8-2 | Constructor de eventos | Alta | Permite simular pérdida de ingreso, subida de gasto, avería, mudanza, coche, deuda o ingreso extraordinario por fecha y duración |
| A8-3 | Simulación probabilística prudente | Alta | Usa distribuciones justificadas por histórico o rangos manuales; publica percentiles, muestra y advertencias, nunca una certeza falsa |
| A8-4 | Riesgos simultáneos y correlación | Media | Evita sumar riesgos incompatibles o tratarlos siempre como independientes; documenta las reglas empleadas |
| A8-5 | Comparador de escenarios | Alta | Compara caja mínima, meses en negativo, colchón, deuda, ahorro, objetivos y fecha de recuperación |
| A8-6 | Sensibilidad y factores dominantes | Alta | Identifica qué tres supuestos cambian más el resultado y cuánto tendría que variar cada uno para romper el plan |
| A8-7 | Escenarios guardados y reproducibles | Media | Cada escenario conserva versión de datos y supuestos; puede reabrirse y recalcularse contra datos nuevos sin sobrescribir el original |
| A8-8 | Promoción segura a plan | Crítica | Aplicar un escenario exige diferencias completas, invariantes, copia previa y confirmación; genera una revisión nueva recuperable |

### E14 — Plan de deuda integrado

Objetivo: convertir el plan visual aislado en una herramienta conectada con deuda, caja y forecast sin
perder sus notas, tareas, simulaciones ni capacidad de negociación.

| ID | Desarrollo | Prioridad | Criterio de aceptación |
| --- | --- | --- | --- |
| A9-1 | Inventario y mapeo de datos | Crítica | Cada campo del plan visual se clasifica como canónico, operativo, supuesto o nota; no se migra nada ambiguo automáticamente |
| A9-2 | Adaptador de solo lectura | Crítica | El plan visual recibe saldos, contratos, capacidad y forecast canónicos sin duplicarlos ni escribir todavía en el estado principal |
| A9-3 | Contrato de estrategia de deuda | Alta | Quita, pago único, refinanciación, suspensión, mora, TAE, cuotas y fechas usan una estructura común y validada |
| A9-4 | Ofertas y negociación | Alta | Registra oferta, contraparte, vigencia, documentación y condiciones; compara coste total, caja y riesgos frente al plan vigente |
| A9-5 | Optimizador con restricciones reales | Alta | Prioriza deuda respetando colchón, liquidez mínima, vencimientos, mora y proyectos; expone alternativas no dominadas y motivos |
| A9-6 | Integración con escenarios | Alta | Cualquier estrategia de deuda puede probarse en E13 y muestra impacto mensual, peor caja, duración y coste total |
| A9-7 | Aplicación confirmada al plan | Crítica | Solo una estrategia aceptada crea eventos futuros; exige vista previa, documentos mínimos, confirmación y revisión recuperable |
| A9-8 | Migración y retirada gradual del `iframe` | Media | Se preservan datos existentes, se compara resultado antiguo/nuevo y el plan aislado permanece accesible hasta verificar paridad |

### E15 — Objetivos, calendario y capacidad futura

Objetivo: conectar las decisiones cotidianas con metas concretas sin competir con el colchón o la deuda.

| ID | Desarrollo | Prioridad | Criterio de aceptación |
| --- | --- | --- | --- |
| A10-1 | Registro canónico de objetivos | Media | Cada objetivo tiene importe, fecha, prioridad, titular, flexibilidad y fuente de financiación |
| A10-2 | Calendario financiero | Alta | Reúne cobros, pagos, cuotas, vencimientos, cierres, revisiones y eventos simulados en una vista temporal |
| A10-3 | Plan de aportaciones | Media | Calcula aportación compatible con caja, deuda y colchón; explica retrasos y reajustes |
| A10-4 | Conflictos entre objetivos | Media | Detecta competencia por la misma capacidad y ofrece alternativas de fecha, importe o prioridad |
| A10-5 | Revisión mensual guiada | Alta | En pocos pasos concilia, explica desviaciones, actualiza forecast y propone decisiones para el mes siguiente |

### E16 — Seguimiento predictivo y explicaciones

Objetivo: transformar el forecast en avisos tempranos y aprendizaje continuo, sin automatizar decisiones.

| ID | Desarrollo | Prioridad | Criterio de aceptación |
| --- | --- | --- | --- |
| A11-1 | Alertas anticipadas de caja | Alta | Avisan con horizonte y confianza antes de una ruptura probable, distinguiendo dato vencido de riesgo real |
| A11-2 | «Qué cambió» desde la última revisión | Alta | Resume nuevos movimientos, desviaciones, supuestos modificados y su efecto en caja, deuda y objetivos |
| A11-3 | Calidad de predicción | Media | Mide error por horizonte y categoría, identifica sesgos y evita evaluar meses todavía incompletos |
| A11-4 | Recomendaciones trazables | Media | Cada recomendación enlaza datos, reglas, escenario y alternativas; la IA opcional solo redacta, no decide |
| A11-5 | Presupuesto de riesgo | Media | Permite definir tolerancias de caja mínima, variabilidad y deuda para ordenar alertas y escenarios |

### E17 — Experiencia simplificada por tareas

Objetivo: reducir el coste de aprender la aplicación sin eliminar las herramientas avanzadas.

| ID | Desarrollo | Prioridad | Criterio de aceptación |
| --- | --- | --- | --- |
| A12-1 | Navegación «Hoy, Actualizar, Prever, Decidir» | Alta | Las cuatro tareas principales son visibles; análisis, auditoría y administración permanecen en un segundo nivel |
| A12-2 | Estado y acción siguiente por pantalla | Alta | Cada vista explica para qué sirve, frescura de datos, si modifica algo y la siguiente acción recomendada |
| A12-3 | Búsqueda y lanzador de acciones | Media | Permite encontrar conceptos, movimientos, deudas, objetivos y comandos sin conocer la navegación |
| A12-4 | Ayuda contextual con ejemplos propios | Media | Explica previsto/real/usado, conciliación, supuestos y confianza usando cifras actuales sin enviar datos fuera |
| A12-5 | Personalización progresiva | Baja | Oculta módulos no usados y permite recuperar siempre la navegación completa sin alterar los datos |

### E18 — Plataforma sostenible y observabilidad

Objetivo: que el crecimiento funcional no degrade rendimiento, mantenibilidad, privacidad ni recuperación.

| ID | Desarrollo | Prioridad | Criterio de aceptación |
| --- | --- | --- | --- |
| A13-1 | Separación gradual del monolito de interfaz | Alta | Cada extracción mantiene pruebas de paridad y no exige una reescritura total de `app.js` |
| A13-2 | Presupuestos de rendimiento ampliados | Alta | Forecast y escenarios responden con 10.000 movimientos dentro de límites medidos en escritorio y móvil |
| A13-3 | Telemetría local de salud | Media | Registra tiempos, fallos y operaciones pendientes sin datos personales ni envío externo por defecto |
| A13-4 | Pruebas de contratos y migraciones | Crítica | Toda versión de estado se abre, migra y restaura en fixtures representativos y anonimizados |
| A13-5 | Pruebas visuales de los flujos críticos | Alta | Actualizar, importar, proyectar, simular, aplicar deuda y recuperar se validan en escritorio y móvil |
| A13-6 | Manual operativo dentro de la app | Media | Exportación, recuperación, conflictos, cierres y servicios externos tienen instrucciones accesibles sin conexión |

**Inicio de E18 el 8 de agosto de 2026:** A13-4 y A13-5 quedan parcialmente implantadas. Las copias
históricas íntegras se migran antes de restaurarse y las alteradas se rechazan por checksum; una puerta de
contrato cubre actualizar, importar, proyectar, simular, aplicar deuda y recuperar. El QA local pasó en
1280×720 y 390×844 sin errores de consola. Aún faltan fixtures históricos completos y capturas comparables
automatizadas para cerrar ambas tareas.

**Segundo avance de E18 el 8 de agosto de 2026:** A13-1 y A13-2 quedan parcialmente implantadas. La
experiencia E17 se separa en `e17-experience.js`, preservando la paridad del lanzador y la guía. El
presupuesto local mide forecast y escenarios con 10.000 periodos en 58,1 ms, por debajo del límite de 1 s.

**Tercer avance de E18 el 8 de agosto de 2026:** A13-3 y A13-6 quedan parcialmente implantadas con
telemetría local mínima (tipo y fecha, sin contenido financiero ni red) y una guía operativa disponible sin
conexión para importación, recuperación, conflictos, cierres y servicios externos.

## 5. Secuencia de entregas recomendada

| Orden | Entrega publicable | Alcance | Resultado útil inmediato |
| --- | --- | --- | --- |
| 1 | E11a | A6-1 a A6-3 | Introducir y actualizar datos deja de ser ambiguo sin retirar ninguna vía actual |
| 2 | E12a | A7-1 a A7-3 y A7-7 | Una única línea base futura alimenta las vistas existentes |
| 3 | E11b | A6-4 a A6-8 | Importaciones, conciliación, frescura y deshacer forman un flujo continuo |
| 4 | E13a | A8-1, A8-2 y A8-5 | Comparación útil de eventos y escenarios sin modificar el plan |
| 5 | E14a | A9-1 a A9-3 | El plan de deuda lee datos canónicos y elimina duplicación sin escribir todavía |
| 6 | E12b/E13b | A7-4 a A7-6 y A8-3, A8-4, A8-6, A8-7 | Predicción prudente, sensibilidad y aprendizaje de desviaciones |
| 7 | E14b | A9-4 a A9-8 | Ofertas y estrategias de deuda se simulan y aplican con seguridad |
| 8 | E15 | A10-1 a A10-5 | Objetivos y revisión mensual quedan conectados con forecast y deuda |
| 9 | E16/E17 | A11 y A12 | Alertas tempranas, explicaciones y navegación simplificada |
| Continua | E18 | A13-1 a A13-6 | Rendimiento, migraciones y mantenibilidad acompañan cada entrega |
| Final | E10 | A5-1 a A5-6 | Servicios externos activados uno a uno después de consolidar el producto local |

## 6. Puerta de aceptación de cada entrega

Una entrega solo puede marcarse como verificada cuando cumple, según su alcance:

1. Pruebas unitarias, integración, accesibilidad, privacidad y smoke test en verde.
2. Apertura de una copia creada por la versión anterior y restauración de una revisión previa.
3. Aplicación plenamente operativa con red ausente y servicios externos desactivados.
4. Ausencia de escrituras durante simulaciones, vistas previas y recomendaciones.
5. Comparación antes/después y confirmación para cualquier cambio del estado financiero.
6. Prueba de dos sesiones cuando cambie estado compartido o sincronización.
7. Explicación de origen, fecha, método y confianza en toda predicción o recomendación nueva.
8. Validación visual a 1280 px y 390×844, teclado y lector de nombres accesibles.
9. Rendimiento medido con el volumen objetivo y sin bloquear la interfaz.
10. Documentación de estado alineada al cierre; commit y push solo con autorización expresa.

## 7. Indicadores de éxito del nuevo ciclo

- Un usuario nuevo completa una actualización mensual sin ayuda y distingue guardado, pendiente y
  conciliado.
- El tiempo para importar y resolver un extracto disminuye y toda corrección puede deshacerse.
- El forecast explica cada cifra y mejora su error medido sin ocultar falta de histórico.
- Un escenario reproduce exactamente sus datos y supuestos y nunca altera el plan por accidente.
- El plan de deuda utiliza los mismos saldos, contratos y restricciones que el resto de la aplicación.
- La aplicación sigue abriendo y siendo útil con backend de IA, push, hogar compartido y PSD2 apagados.

## 8. Próximo paso concreto

**E11a verificada y publicada en `origin/main` mediante `992a678` el 1 de agosto de 2026:** el centro
«Actualizar mis datos» guía los cinco flujos actuales, expone previsto/real/usado, diferencia las reglas
de guardado y recomienda el siguiente paso según frescura, movimientos, conciliación y cambios pendientes.

**E11b verificada y publicada mediante `989f20d`, con cierre en `1cb3a5a`, el 1 de agosto de 2026:**
tablas pegadas, CSV, libros Excel y extractos comparten bandeja previa, comparación y confirmación; el
flujo conserva recibo, deshacer, conciliación por tareas, frescura y compatibilidad con copias
anteriores y vías clásicas.

**E12a verificada y publicada mediante `6269093`:** el contrato único de forecast, el registro central
de supuestos, la línea base explicable y la paridad alimentan las vistas actuales sin un segundo motor.

**E13a verificada y publicada mediante `e5ad5ef`, con corrección de caché `26b26fb`:** el laboratorio
compara base, favorable y tensión, admite eventos temporales y no escribe en el plan. Pages,
`version.json`, el monitor y el QA responsive pasan. La actualización desde una sesión con e12a1 quedó
aceptada después de que e13a2 forzara la revalidación de cada recurso.

**E14a implementada, validada y publicada mediante `a0a65c7`:** el inventario clasifica los campos del
plan visual, el adaptador enlaza únicamente contratos inequívocos y un forecast con paridad válida, y
los datos canónicos quedan bloqueados y excluidos de las escrituras del `iframe`. El contrato común de
estrategia cubre quita, pago único, refinanciación, suspensión, mora, reanudación y espera. La puerta
completa pasa con 260/260 pruebas y QA responsive sin desbordamiento.

**E12b/E13b verificadas y publicadas en `origin/main` mediante `bdf6367` el 2 de agosto de 2026:** el forecast aprende desviaciones y
estacionalidad solo desde meses conciliados, adapta el horizonte sin falsa precisión y el laboratorio
expone simulación prudente, reglas de correlación, sensibilidad y escenarios guardados reproducibles.
La puerta completa pasa con 266/266 pruebas, accesibilidad, rendimiento con 10.000 filas, construcción,
privacidad y smoke test. El QA a 1280 px y 390×844 no mostró errores ni desbordamiento; guardar, recargar
y recalcular una copia conservó el original y no modificó el plan vigente. La publicación de GitHub
Pages todavía no se ha comprobado y no se presenta como validada.

**E14b verificada y cerrada mediante `6603e51`, con cierre documental `31238f1`:** ofertas,
optimización con restricciones reales, integración con escenarios, aplicación confirmada y paridad A/B
del plan heredado están comprobadas. El `iframe` se conserva como respaldo.

**E15 verificada localmente el 5 de agosto de 2026:** objetivos con prioridad, titular, flexibilidad y
fuente de financiación; calendario unido al forecast y la deuda; aportaciones prudentes, conflictos
explicados y revisión mensual confirmable. La puerta completa pasa con 283 pruebas, accesibilidad,
rendimiento, construcción pública, privacidad y smoke test.

**E16 verificada el 8 de agosto de 2026:** alertas tempranas, cambios desde la última revisión, calidad
predictiva, recomendaciones trazables y presupuesto de riesgo quedan aceptados con persistencia, recarga
y recuperación remota sin conflicto repetido.

**E17 verificada y publicada mediante `4d3a845` el 8 de agosto de 2026:** «Hoy, Actualizar, Prever, Decidir» forman la
navegación principal; las herramientas avanzadas quedan en segundo nivel; una guía de pantalla, lanzador,
ayuda local y preferencias recuperables reducen la complejidad sin alterar datos. La puerta completa pasa
con 293 pruebas y el QA del artefacto público a 1280×720 y 390×844 no mostró desbordamiento.

El siguiente paso es **E18** de forma incremental. E10 y **A5-1/A5-2** quedan al final.
