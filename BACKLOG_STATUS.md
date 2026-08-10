# Backlog maestro — registro histórico de las entregas E1-E20

> **Este documento ya no es el backlog vigente.** Desde el 10 de agosto de 2026 el backlog
> operativo es **`BACKLOG.md`**, que fusiona el rediseño a seis vistas con la evolución
> funcional y mide el estado sobre el código publicado.
>
> Lo que sigue se conserva porque el historial E1-E20 es correcto y es la única referencia
> de por qué cada entrega se hizo como se hizo. Para saber qué hacer a continuación, ve a
> `BACKLOG.md`.


Fecha de referencia: 8 de agosto de 2026.

Este documento sustituye al backlog anterior como referencia operativa. Parte del roadmap inicial,
del estado real documentado en `PROJECT_STATE.md`, del código y de las pruebas existentes. Su orden
prioriza que la aplicación siga siendo utilizable entre sesiones, incluso durante fallos de red,
conflictos remotos o un despliegue defectuoso.

## 0. Estado maestro de entregas

Esta tabla reconcilia el historial E1-E9 con las entregas E10-E18 del backlog de evolución. Para el detalle de
E10-E18, la referencia vigente es `BACKLOG_PRODUCT_EVOLUTION.md`. Una entrega dividida en tramos se
mantiene `Parcial` hasta verificar todos sus tramos.

| Entrega | Tareas asociadas | Descripción de las tareas | Estado | Evidencia o pendiente principal |
| --- | --- | --- | --- | --- |
| E1 | A0-1 a A0-3 | Arranque local, cola remota persistente e indicador de durabilidad | Verificado | Continuidad local, buzón remoto e indicador de durabilidad aceptados |
| E2 | A0-6 a A0-8 | Puerta de despliegue, monitor y privacidad del artefacto público | Verificado | Despliegue, monitor y privacidad del artefacto público aceptados |
| E3 | A0-4, A0-5 y A0-9 | Apertura offline, recuperación guiada y copia de emergencia | Verificado | Apertura offline, recuperación guiada y copia de emergencia aceptadas |
| E4 | A1-1 y A1-2 | Conciliación del libro remoto y cierre mensual transaccional | Verificado | Conciliación remota y cierre mensual aceptados en Supabase |
| E5 | A1-3 a A1-6 | Reapertura, deshacer importaciones, migración y copias | Verificado | Reapertura, deshacer, migración y copias aceptadas en Supabase |
| E6 | A2-1, A2-2, A2-6 y A2-8 | Cobertura, calidad de deuda, procedencia de KPI y lectura ejecutiva | Verificado | Lectura ejecutiva, calidad y trazabilidad verificadas |
| E7 | A2-3 a A2-5 y A2-7 | Comparación financiera, escenarios e importación segura | Verificado | Comparación financiera avanzada, importación y recuperación verificadas |
| E8 | A3-1 a A3-7 | Historial, calidad, acciones seguras, adjuntos, accesibilidad y rendimiento | Verificado | Mejoras operativas, adjuntos privados, accesibilidad y rendimiento verificados |
| E9 | A4-1 a A4-6 | Contratos seguros para los servicios externos opcionales | Verificado | Contratos externos publicados de forma segura y desactivados |
| E10 | A5-1 a A5-6 | Activación real de IA, hogar, push, PSD2 e importación programada | Parcial | A5-1 a A5-4 tienen base local verificada; falta aceptación externa real y A5-5/A5-6 |
| E11a | A6-1 a A6-3 | Centro guiado y vocabulario único de previsto, real y usado | Verificado | Centro guiado y semántica previsto/real/usado publicados |
| E11b | A6-4 a A6-8 | Importación, conciliación, recibos, frescura y compatibilidad | Verificado | Bandeja, importación, conciliación, recibos y compatibilidad publicados |
| E12a | A7-1 a A7-3 y A7-7 | Forecast canónico, supuestos, explicación y paridad | Verificado | Forecast canónico, supuestos, explicación y paridad publicados |
| E12b | A7-4 a A7-6 | Aprendizaje de desviaciones, estacionalidad y horizonte adaptativo | Verificado | Aprendizaje, estacionalidad y horizonte adaptativo aceptados en escritorio y móvil |
| E13a | A8-1, A8-2 y A8-5 | Escenarios base, favorables y de tensión con comparador | Verificado | Laboratorio efímero de escenarios publicado y sin escrituras |
| E13b | A8-3, A8-4, A8-6 y A8-7 | Simulación prudente, correlación, sensibilidad y escenarios guardados | Verificado | Simulación prudente, sensibilidad y escenarios recuperables aceptados en escritorio y móvil |
| E14a | A9-1 a A9-3 | Inventario, adaptador de solo lectura y estrategia de deuda | Verificado | Inventario, adaptador canónico de solo lectura y contrato de estrategia publicados |
| E14b | A9-4 a A9-8 | Ofertas, optimización, escenarios, aplicación y migración de deuda | Verificado | Ofertas, optimización, escenarios, aplicación confirmada y paridad del plan heredado verificadas |
| E15 | A10-1 a A10-5 | Objetivos, calendario, aportaciones, conflictos y revisión mensual | Verificado | Objetivos canónicos, calendario, aportaciones prudentes, conflictos y revisión mensual confirmable |
| E16 | A11-1 a A11-5 | Alertas, cambios, calidad predictiva, recomendaciones y presupuesto de riesgo | Verificado | Seguimiento predictivo aceptado: alertas y recomendaciones visibles, presupuesto persistente tras recarga y recuperación remota sin conflicto repetido |
| E17 | A12-1 a A12-5 | Navegación por tareas, estado, lanzador, ayuda y personalización | Verificado | Aceptación en escritorio a 1280×720 y móvil a 390×844, sin desbordamiento; lanzador y personalización comprobados |
| E18 | A13-1 a A13-6 | Arquitectura, rendimiento, telemetría, migraciones, pruebas y manual | Verificado | Fixtures históricos, métricas locales, guía contextual y doce capturas comparables aceptadas |
| E19 | Piel visual del rediseño | Sistema de diseño `design-tokens.css` y migración de Hoy, Actualizar, Importar y Previsión | Verificado | Tokens y cinco pantallas migradas sin tocar el aspecto de las heredadas |
| E20 | Mockups 1b-1g, 2a, 2d-2e, 3a-3c | Motor de escenario en la interfaz, deuda, conciliación, registro del mes y cuadro de mandos con impacto | Verificado | Los quince mockups de los turnos 1-3 migrados; cinco de ellos parciales con la omisión documentada |

Resumen actual: E1-E9 y E11-E20 están verificadas. La paridad A/B del plan heredado se comprueba frente
al contrato canónico y el iframe permanece como respaldo. **E10 es la única entrega abierta** y se
mantiene al final: A5-1 a A5-4 tienen base local verificada, pero falta la aceptación externa real
(IA, hogar, push, PSD2) y las tareas A5-5/A5-6.

El seguimiento fino de E19/E20 —qué mockup corresponde a qué pantalla y qué quedó fuera de cada uno—
vive en `docs/E19_SISTEMA_DISENO.md` §4, que es la referencia operativa de esas dos entregas.

### Tareas verificadas de E15

| ID | Desarrollo | Estado | Prioridad | Criterio de aceptación |
| --- | --- | --- | --- | --- |
| A10-1 | Registro canónico de objetivos | Verificado | Media | Cada objetivo conserva importe, fecha, prioridad, titular, flexibilidad y fuente de financiación |
| A10-2 | Calendario financiero | Verificado | Alta | Reúne forecast, cuotas, vencimientos de objetivos y revisiones en una lectura temporal única |
| A10-3 | Plan de aportaciones | Verificado | Media | Propone aportaciones compatibles con capacidad, deuda y reserva; los retrasos permanecen explicados y sin aplicación automática |
| A10-4 | Conflictos entre objetivos | Verificado | Media | Detecta capacidad insuficiente y ofrece alternativas de fecha, importe o prioridad según la flexibilidad |
| A10-5 | Revisión mensual guiada | Verificado | Alta | Registra una revisión local confirmable y orienta conciliación, desviaciones, forecast y decisiones del mes siguiente |

### Tareas verificadas de E16

| ID | Desarrollo | Estado | Prioridad | Evidencia actual |
| --- | --- | --- | --- | --- |
| A11-1 | Alertas anticipadas de caja | Verificado | Alta | Las alertas de caja, variación y ratio muestran horizonte, confianza y evidencia en la vista Hoy, en escritorio y a 400 px |
| A11-2 | «Qué cambió» desde la última revisión | Verificado | Alta | El panel explica los cambios disponibles sin alterar datos y declara de forma explícita la ausencia de revisión comparable |
| A11-3 | Calidad de predicción | Verificado | Media | Calcula error absoluto y sesgo solo con periodos completos; en ausencia de muestras lo comunica sin inventar precisión |
| A11-4 | Recomendaciones trazables | Verificado | Media | Las recomendaciones presentan evidencia y alternativas en la interfaz, sin rutas de ejecución automática |
| A11-5 | Presupuesto de riesgo | Verificado | Media | Un umbral de caja genera alertas, se conserva tras recargar y se restaura sin modificar el plan; la recuperación remota no reabre el conflicto |

### Tareas verificadas de E17

| ID | Desarrollo | Estado | Prioridad | Evidencia local |
| --- | --- | --- | --- | --- |
| A12-1 | Navegación «Hoy, Actualizar, Prever, Decidir» | Verificado | Alta | Las cuatro tareas pasan al primer nivel; análisis, asistentes y datos quedan en Herramientas avanzadas, comprobado en escritorio y móvil |
| A12-2 | Estado y acción siguiente por pantalla | Verificado | Alta | La guía superior explica finalidad, estado de edición, fecha de análisis y siguiente paso de cada vista |
| A12-3 | Búsqueda y lanzador de acciones | Verificado | Media | «Buscar o abrir» filtra tareas de caja, datos, deuda, objetivos, movimientos y conciliación sin cambiar datos |
| A12-4 | Ayuda contextual con ejemplos propios | Verificado | Media | La ayuda usa únicamente la copia cargada y anuncia un ejemplo basado en la liquidez prevista, sin enviar información fuera |
| A12-5 | Personalización progresiva | Verificado | Baja | El usuario puede ocultar grupos avanzados por navegador y recuperar siempre la navegación completa; no modifica datos financieros |

### Tareas verificadas de E18

E18 queda cerrada tras validar migraciones históricas, observabilidad local, guía offline y capturas sintéticas
comparables en escritorio y móvil.

| ID | Desarrollo | Estado | Prioridad | Pendiente principal |
| --- | --- | --- | --- | --- |
| A13-1 | Separación gradual del monolito de interfaz | Verificado | Alta | Navegación, lanzador y catálogo de guía por flujo permanecen aislados en `e17-experience.js` |
| A13-2 | Presupuestos de rendimiento ampliados | Verificado | Alta | Forecast y escenarios con 10.000 periodos se miden en 60,5 ms dentro del límite de 1 s; QA visual en escritorio y móvil |
| A13-3 | Telemetría local de salud | Verificado | Media | Registra localmente duración, fallos por tipo y operaciones pendientes, sin datos financieros ni envío |
| A13-4 | Pruebas de contratos y migraciones | Verificado | Crítica | Cuatro fixtures históricos anonimizados migran y restauran; cualquier alteración se rechaza por checksum |
| A13-5 | Pruebas visuales de flujos críticos | Verificado | Alta | Doce capturas comparables sintéticas cubren actualizar, importar, proyectar, simular, aplicar deuda y recuperar |
| A13-6 | Manual operativo dentro de la app | Verificado | Media | Cada flujo crítico abre su guía offline contextual |

### Revisión de cierre local A5 — 8 de agosto de 2026

- Estados contrastados con `PROJECT_STATE.md`, `ROADMAP_EXECUTION.md` y el historial reciente de Git:
  E1-E9 y E11-E18 continúan `Verificado`; E10 pasa a `Parcial` por la base local de A5-1 a A5-4.
- A5-1 a A5-4 están implementadas localmente y cubiertas por 310 pruebas, privacidad, build y smoke test,
  pero siguen sin aceptación externa real. A5-5 y A5-6 continúan pendientes.
- La secuencia optimizada queda: benchmark A5-2, backend A5-1, hogar A5-3, push A5-4, proveedor PSD2 A5-5
  e importación programada A5-6. Cada servicio conserva el modo local, las confirmaciones y la recuperación.
- La base de A13-4 migra copias íntegramente verificadas antes de restaurarlas y rechaza alteraciones; la de
  A13-5 cubre los seis flujos críticos por contrato y se comprobó localmente a 1280×720 y 390×844 sin errores de consola.

## 1. Reglas de gobierno

- `Verificado` significa probado de extremo a extremo, con persistencia, recarga y recuperación.
- `Implementado` significa que el código existe, pero todavía falta alguna prueba de aceptación.
- `Parcial` significa que solo se cumple una parte del criterio de aceptación.
- `Pendiente` significa que el desarrollo no está iniciado o no tiene evidencia suficiente.
- Una fase no se cierra únicamente porque pase la suite local.
- Cada cambio de datos debe guardarse primero de forma local y recuperable.
- Un fallo de red o de Supabase nunca debe impedir consultar o editar la copia local.
- No se desplegarán cambios si fallan las pruebas, la carga inicial o la restauración de una copia.
- Los despliegues deben ser pequeños, reversibles y conservar una última versión estable conocida.
- Las operaciones destructivas requieren vista previa, confirmación, auditoría y restauración.
- `PROJECT_STATE.md` se actualiza al cerrar cada sesión; este backlog se actualiza al cambiar el
  estado de una fase.

## 2. Situación consolidada

| Bloque | Fases | Verificado | Implementado | Parcial | Pendiente | Lectura actual |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| P0 Integridad estructural | 6 | 6 | 0 | 0 | 0 | Base canónica, sincronización y restauración verificadas |
| P1 Decisión y tesorería | 8 | 8 | 0 | 0 | 0 | E6 y E7 están verificadas de extremo a extremo |
| P2 Planificación familiar | 6 | 6 | 0 | 0 | 0 | Funcionalidad verificada; quedan mejoras no bloqueantes |
| P3 Servicios externos | 3 | 3 | 0 | 0 | 0 | Contratos opcionales publicados y verificados con todos los servicios apagados |
| E10 Activación externa | 6 | 0 | 4 | 0 | 2 | A5-1 a A5-4 implementadas localmente; faltan activación y aceptación externa, A5-5 y A5-6 |
| UX Experiencia principal | 6 | 6 | 0 | 0 | 0 | Experiencia principal verificada en escritorio y móvil |
| **Total ampliado** | **35** | **29** | **4** | **0** | **2** | **E10 tiene base local para A5-1 a A5-4; la aceptación externa y banca siguen pendientes** |

### Situación del ciclo de evolución E11-E18

| Entrega | Estado | Lectura actual |
| --- | --- | --- |
| E11 | Verificado | Centro de actualización, bandeja de entradas, importación y conciliación completados |
| E12 | Verificado | Forecast canónico, aprendizaje, estacionalidad y horizonte adaptativo completados |
| E13 | Verificado | Laboratorio, simulación prudente, correlación, sensibilidad y escenarios reproducibles completados |
| E14 | Verificado | E14a y E14b están verificadas; la paridad A/B del plan heredado queda automatizada y el iframe se conserva como respaldo |
| E15 | Verificado | Objetivos, calendario, aportaciones prudentes, conflictos y revisión mensual confirmable completados |
| E16 | Verificado | Alertas, cambios, calidad de predicción, recomendaciones y presupuesto de riesgo aceptados con persistencia y recarga |
| E17 | Verificado | Navegación por tareas, guía, lanzador, ayuda local y personalización aceptados en escritorio y móvil |
| E18 | Parcial continuo | Migración verificable y puerta de flujos críticos iniciadas; faltan presupuestos ampliados, telemetría, capturas comparables, manual y separación gradual |

### Correcciones respecto al backlog anterior

- P0-1 a P0-6 están verificados. P0-6 incluye restauración autenticada y transaccional en Supabase.
- P2-1 a P2-6 están verificados; el backlog anterior todavía los describía como parciales o pendientes.
- UX-1 a UX-6 están verificados, aunque el backlog anterior no los mantenía como bloque propio.
- P1-1 a P1-8 están verificados tras el cierre de E6 y E7.
- P3-3 se mantiene separado de P3-2 porque preparar acciones seguras es distinto de responder consultas.

## 3. Riesgos actuales que condicionan el orden

| Riesgo | Evidencia actual | Impacto | Tratamiento propuesto |
| --- | --- | --- | --- |
| La caché offline requiere versionado disciplinado | Tras publicar E5 una pestaña mostró todavía el aviso de formato remoto antiguo; el shell abre sin servidor tras una primera visita | Una caché obsoleta puede retrasar recursos nuevos o mostrar una migración ya atendida | Mantener recursos versionados, recargar el shell antes de migrar y comprobar el arranque offline en cada cambio |
| Una reconciliación incorrecta ante conflicto puede descartar una revisión | A0-5 compara fechas y huellas y ofrece continuar localmente, descargar o elegir la nube | Una elección equivocada del usuario todavía puede requerir restauración | Conservar copia exportable, confirmación explícita e historial de versiones |
| Un despliegue defectuoso puede afectar al sitio público | Pages publica mediante Actions después de pruebas, privacidad y smoke test; el rollback fue ensayado | Una regresión no cubierta por las pruebas podría llegar a producción | Mantener la puerta CI, el monitor publicado y el procedimiento de reversión |
| La aplicación publicada trata información financiera sensible | El artefacto público contiene solo datos sintéticos y la revisión de privacidad bloquea patrones prohibidos | Una futura incorporación accidental de datos personales sería crítica | Mantener lista cerrada del artefacto y revisión de privacidad obligatoria |
| Las operaciones E5 afectan al estado compartido | A1-3 a A1-6 están desplegadas y verificadas con revisiones nuevas y control optimista | Una sesión obsoleta no puede publicar hasta recargar | Mantener vista previa, motivo, copia y prueba de dos sesiones en cambios futuros |
| La documentación de estado diverge | Roadmap, estado y backlog usan fechas y estados distintos | Puede priorizarse trabajo ya terminado o darse por cerrado trabajo parcial | Una matriz canónica y revisión en cada cierre |

## 4. Orden de ejecución propuesto

### A0 — Continuidad, privacidad y recuperación

Este bloque es anterior al resto de P1. Su objetivo es que cada sesión pueda empezar y terminar sin
perder trabajo y que un despliegue o servicio externo no deje inutilizable la aplicación.

| ID | Desarrollo | Estado | Prioridad | Criterio de aceptación |
| --- | --- | --- | --- | --- |
| A0-1 | Arranque local primero y modo degradado | Verificado | Crítica | La interfaz carga el último estado local antes de esperar a Supabase; un error remoto no bloquea la app y queda explicado al usuario |
| A0-2 | Buzón remoto persistente | Verificado | Crítica | Las revisiones pendientes sobreviven a recarga, cierre y reinicio; al volver la red se reanudan en orden y sin duplicados |
| A0-3 | Indicador global de durabilidad | Verificado | Crítica | Toda pantalla muestra uno de cuatro estados inequívocos: guardado local, pendiente remoto, sincronizado o conflicto; incluye hora y acción recomendada |
| A0-4 | Apertura offline del shell | Verificado | Alta | Tras una primera visita, la app abre sin red con recursos versionados; no se almacenan credenciales ni respuestas privadas en caché compartida |
| A0-5 | Recuperación guiada al iniciar | Verificado | Alta | Si hay cola pendiente, copia local más reciente o conflicto, la app compara fechas y huellas y permite continuar, recargar o restaurar sin sobrescritura silenciosa |
| A0-6 | Puerta de despliegue y rollback | Verificado | Crítica | CI ejecuta pruebas y smoke test; el despliegue solo publica si pasan; existe un procedimiento probado para volver a la última versión estable |
| A0-7 | Comprobación de disponibilidad publicada | Verificado | Alta | Se valida periódicamente HTTPS, carga de recursos, inicio de la app y versión servida; los fallos generan una alerta utilizable |
| A0-8 | Privacidad del artefacto web | Verificado | Crítica | El sitio publicado no contiene datos financieros personales en sus archivos estáticos; se documentan visibilidad, autenticación y rotación de secretos |
| A0-9 | Exportación y copia de emergencia | Verificado | Alta | El usuario puede descargar una copia completa verificada y reimportarla en un perfil limpio; la prueba demuestra igualdad de huella |

#### Pruebas mínimas de A0

1. Editar sin red, cerrar el navegador, abrir de nuevo y recuperar el cambio.
2. Crear dos cambios durante una caída de red y sincronizarlos en orden al recuperar conexión.
3. Cerrar la pestaña con una escritura pendiente y comprobar su reanudación posterior.
4. Simular conflicto entre dos sesiones sin perder ninguna de las dos versiones.
5. Publicar una versión de prueba defectuosa y recuperar la última versión estable.
6. Inspeccionar el artefacto publicado y confirmar que no contiene datos personales ni credenciales.

#### Evidencia de E1

- 31/07/2026: prueba controlada en navegador real con servicio remoto local interrumpido.
- El cambio quedó en estado pendiente y el servidor remoto recibió cero escrituras durante la caída.
- Tras cerrar completamente la pestaña, recuperar la conexión y abrir una sesión nueva, IndexedDB
  restauró la operación y la sincronizó automáticamente.
- Una tercera apertura mostró la bandeja vacía y el servidor conservó una única escritura, sin duplicados.
- Suite local: 109 pruebas superadas, incluidas recuperación de revisiones y conflictos entre sesiones.

### A1 — Integridad remota y cierre mensual

| ID | Relación | Desarrollo | Estado | Prioridad | Criterio de aceptación |
| --- | --- | --- | --- | --- | --- |
| A1-1 | P0 seguimiento | Conciliación remota exhaustiva del libro | Verificado | Crítica | El libro local y `finance_ledger_entries` coinciden en activos, conteo, IDs, importes y huella; se conserva evidencia anonimizada |
| A1-2 | P1-6 | Cierre mensual transaccional | Verificado | Crítica | Cerrar un mes congela reales de forma atómica, registra auditoría y arrastra únicamente previsiones al mes siguiente |
| A1-3 | P1-6 | Reapertura controlada de mes | Verificado | Alta | Agosto se cerró, reabrió y volvió a cerrar con motivo, revisión nueva y cierre histórico conservado; una sesión obsoleta no pudo sustituir el puntero |
| A1-4 | P1-7 | Deshacer importación por lote | Verificado | Alta | Un lote temporal se sincronizó y se deshizo remotamente; el lote quedó auditado como `undone` y el estado anterior se recuperó |
| A1-5 | P0/P1 | Eliminar fallback remoto silencioso | Verificado | Alta | El legado quedó bloqueado hasta ejecutar la migración explícita; un conflicto posterior conservó la copia local y exigió elegir la nube |
| A1-6 | Operación | Retención y verificación de copias | Verificado | Media | 306/306 copias superaron huella y contenido; se registró una comprobación autenticada con muestra restaurable y sin borrado automático |

### A2 — Completar decisión y tesorería

| ID | Fase | Desarrollo pendiente | Estado | Prioridad | Criterio de aceptación resumido |
| --- | --- | --- | --- | --- | --- |
| A2-1 | P1-1 | Cobertura aprendida hasta el siguiente ingreso | Verificado | Alta | Fechas y patrones se derivan solo de movimientos conciliados, con confianza visible y edición manual |
| A2-2 | P1-2 | Calidad obligatoria de contratos de deuda | Verificado | Alta | Capital, mora, TAE, suspensión, vencimiento, titular, acuerdo y procedencia están informados o marcados como desconocidos |
| A2-3 | P1-3 | Efectos legales y fiscales del comparador | Verificado | Media | Cada efecto tiene fuente, fecha, jurisdicción y advertencia profesional; no se presenta como certeza sin respaldo |
| A2-4 | P1-4 | Frontera multiobjetivo explicable | Verificado | Media | Se muestran alternativas no dominadas entre deuda, caja, colchón y coche, con restricciones y razón de preferencia |
| A2-5 | P1-5 | Escenarios probabilísticos calibrados | Verificado | Media | Optimista, base y tensión se calibran con histórico conciliado; más de 24 meses se expresa como bandas |
| A2-6 | P1-6 | Procedencia y confianza de cada KPI | Verificado | Alta | Todo KPI ejecutivo muestra fuente, fecha, método, cobertura y nivel de confianza |
| A2-7 | P1-7 | Comparación integral antes/después | Verificado | Alta | Antes de importar se muestran altas, cambios, duplicados, bajas, efectos mensuales e invariantes |
| A2-8 | P1-8 | Contrato único para Hoy y acciones | Verificado | Alta | Una API interna versionada entrega decisiones, alertas, capacidad y contexto; todas las vistas consumen la misma lectura |

Aceptación del 01/08/2026: la interfaz expone edición de cobertura, desconocidos y calidad de deuda y
procedencia/confianza de KPI; Hoy y acciones consumen `finance-executive-read-model/v1`. Un ajuste manual
se guardó y sincronizó, reapareció tras recargar y el retorno al aprendizaje automático también se recuperó.
La restauración remota creó una revisión nueva, conservó el historial y aplicó la pérdida previamente autorizada.

### A3 — Mejoras sobre bloques ya verificados

Estas mejoras no reabren P2 ni UX. Deben tener identificador propio y no degradar sus criterios ya
verificados.

| ID | Mejora propuesta | Prioridad | Criterio de aceptación |
| --- | --- | --- | --- |
| A3-1 | Historial visual de sincronización y cierres | Media | Línea temporal legible con revisiones, cierres, restauraciones, conflictos y estado final |
| A3-2 | Comparador de versiones antes de restaurar | Media | Diferencias agrupadas por cuentas, movimientos, deuda, proyectos y ajustes, no solo totales |
| A3-3 | Centro de calidad de datos | Media | Lista única de datos desconocidos, movimientos sin clasificar, saldos discontinuos y KPI de baja confianza |
| A3-4 | Acciones rápidas desde alertas | Media | Cada alerta ofrece una acción segura que abre vista previa y nunca escribe antes de confirmar |
| A3-5 | Adjuntos privados multidispositivo | Baja | Binarios cifrados en almacenamiento privado, con permisos, límites y eliminación recuperable |
| A3-6 | Accesibilidad continua automatizada | Media | Pruebas básicas de teclado, foco, nombres accesibles, contraste y desbordamiento entran en CI |
| A3-7 | Rendimiento con datos crecientes | Media | Presupuesto medible de carga y render; pruebas con un volumen superior al actual sin bloqueo de la interfaz |
| A3-8 | Flujo inequívoco de previsto, real y valor usado | Alta | Verificada el 01/08/2026: el Cuadro de mandos separa planificación y registro, muestra el importe usado y distingue real vacío de real cero sin alterar el motor financiero |

### A4 — Contratos seguros para servicios opcionales (E9)

No se inicia este bloque hasta cerrar A0 y A1. Ningún servicio externo puede convertirse en requisito
para abrir la app o consultar la última copia local.

| ID | Fase | Desarrollo | Estado | Prioridad | Condición previa |
| --- | --- | --- | --- | --- | --- |
| A4-1 | P3-1 | Contrato bancario regulado, solo lectura y con fallback manual | Verificado | Baja | Publicado desactivado; no expone conexión ni bloquea CSV, Excel o entrada manual |
| A4-2 | Nuevo | Contrato de importación programada idempotente y previa al libro | Verificado | Baja | Publicado desactivado; nunca modifica el libro ni decisiones automáticamente |
| A4-3 | P3-2 | Contrato de asistente privado, mínimo y trazable | Verificado | Baja | OpenAI Responses API queda sin conectar; el asistente local continúa disponible |
| A4-4 | P3-3 | Catálogo cerrado de borradores con vista previa y confirmación | Verificado | Baja | Publicado sin ejecución remota ni escritura directa |
| A4-5 | Nuevo | Contrato de notificaciones remotas genéricas y opcionales | Verificado | Baja | Web push permanece apagado; solo funcionan pruebas locales del navegador |
| A4-6 | Nuevo | Modelo de permisos, invitaciones y revocación del hogar | Verificado | Baja | Publicado sin invitaciones, miembros remotos ni datos compartidos |

### A5 — Activación y aceptación de servicios externos (E10)

E10 no reabre E9: activa cada dependencia externa de forma independiente y conserva siempre el modo
local. Ningún servicio pasa a `Verificado` por disponer únicamente de contrato o pruebas simuladas.

| ID | Servicio | Estado | Prioridad | Criterio de aceptación |
| --- | --- | --- | --- | --- |
| A5-1 | Backend privado y OpenAI Responses API | Implementado | Media | Base local con backend Node, autenticación delegada, `store:false`, salida estructurada y fallback; falta despliegue y prueba real |
| A5-2 | Selección del modelo OpenAI | Implementado | Media | Benchmark reproducible local; falta ejecutar con conjunto aprobado y fijar modelo |
| A5-3 | Hogar compartido | Implementado | Baja | Invitaciones hashadas, permisos, conflictos y revocación locales; falta prueba real con dos cuentas |
| A5-4 | Web push | Implementado | Baja | Cifrado, consentimiento, silencios, baja y deduplicación locales; falta backend/proveedor y prueba real |
| A5-5 | Conexión bancaria PSD2 | Pendiente | Baja | Proveedor contratado, cobertura y precio aceptados, consentimiento revocable y solo lectura verificados |
| A5-6 | Importación bancaria programada | Pendiente | Baja | A5-5 verificada; ejecución idempotente real, bandeja previa y ausencia de escrituras automáticas en el libro |

## 5. Secuencia recomendada de entregas

| Entrega | Contenido | Resultado utilizable |
| --- | --- | --- |
| E1 | A0-1, A0-2 y A0-3 | El trabajo local sobrevive entre sesiones y el usuario sabe si está sincronizado |
| E2 | A0-6, A0-7 y A0-8 | Publicación controlada, observable y sin datos personales estáticos |
| E3 | A0-4, A0-5 y A0-9 | Apertura offline y recuperación guiada verificadas |
| E4 | A1-1 y A1-2 | Verificada: libro remoto conciliado y cierre mensual seguro |
| E5 | A1-3 a A1-6 | Verificada: reapertura, deshacer, migración y copias aceptadas en Supabase |
| E6 | A2-1, A2-2, A2-6 y A2-8 | Verificada: datos ejecutivos completos, trazables y consistentes |
| E7 | A2-3, A2-4, A2-5 y A2-7 | Comparación financiera avanzada y segura |
| E8 | A3-1 a A3-7 | Verificada: mejoras operativas, privadas, accesibles y medibles sin reabrir bloques cerrados |
| E9 | A4-1 a A4-6 | Verificada y publicada con todas las integraciones externas desactivadas |
| E10 | A5-1 a A5-6 | Activación y aceptación independiente de proveedores y servicios externos |

## 6. Puerta de aceptación para cada entrega

Una entrega solo pasa a `Verificado` cuando cumple todo lo siguiente:

1. Pruebas unitarias y de integración en verde.
2. Prueba real de guardar, cerrar, abrir y recuperar.
3. Prueba con red ausente y red recuperada cuando afecte a persistencia.
4. Prueba de dos sesiones cuando modifique datos compartidos.
5. Restauración comprobada desde una versión anterior.
6. Validación visual en escritorio y móvil sin errores de consola.
7. Revisión de privacidad: sin credenciales, datos personales nuevos ni logs sensibles.
8. Documentación alineada en este backlog y `PROJECT_STATE.md` al cierre.
9. Commit pequeño y reversible; push únicamente con autorización expresa.

## 7. Próximo objetivo recomendado

Actualizado el 10/08/2026, al cerrar E20.

**El catálogo de mockups de los turnos 1-3 está terminado**: los quince están migrados. No queda
ningún pendiente de diseño en la cola. Lo que sigue abierto, por orden de lo que aporta:

1. **Decidir qué se hace con el rediseño a seis vistas** (turnos 4-5 del canvas, ver
   `docs/E19_SISTEMA_DISENO.md` §10). Es una decisión de producto, no de código: propone fundir los
   pares de pantalla nueva/heredada y retirar las heredadas, justo lo contrario del principio de
   «envolver, no sustituir» que ha regido hasta ahora, y además cambia el acento de azul a navy.
   Hasta que se decida, la app acumula pares conviviendo.
2. **Cerrar las omisiones documentadas de E20**, si el uso real las echa en falta: el aviso de
   partida anual detectada en un extracto (2a), el motor de recomendaciones del mapa de calor (3c) y
   los tramos parciales de 1c, 1d y 2e.
3. **E10**, que sigue siendo la única entrega sin verificar y depende de aceptación externa real.

E10 permanece al final mientras no haya servicios externos que aceptar.

E9 quedó publicada y verificada el 01/08/2026 mediante `ef57e9b`. El workflow `30712474715` completó
la puerta y el despliegue; Pages sirvió `version.json` con el SHA exacto, los contratos E9 y el shell
e9c. El panel gris pasó QA a 1280 px y 390×844 sin errores ni desbordamiento. Una sesión con caché E8
necesitó recargar una vez para activar el nuevo service worker; la segunda carga sirvió correctamente E9.

E7 quedó verificada el 01/08/2026: dos sesiones protegieron el puntero remoto; un lote sintético se
previsualizó, importó, recuperó tras recarga y deshizo; una restauración creó una revisión nueva y
conservó 19 copias recuperables. La regresión final pasó con 161 pruebas y sin datos sintéticos activos.

El commit funcional `ba56333` quedó publicado en GitHub Pages el 01/08/2026. El workflow de despliegue,
la revisión pública de `version.json`, el contrato E7, el shell e7b y el monitor manual de disponibilidad
pasaron correctamente. E7 queda cerrada; el siguiente bloque es E8 según uso real.

E2 quedó verificada el 31/07/2026 mediante despliegue por Actions, comprobación pública, monitor manual
y prueba de rollback no destructiva entre revisiones seguras.
E3 quedó verificada el 31/07/2026 mediante reapertura real sin servidor, validación responsive, pruebas
de recuperación y copia con huella, y comprobación del service worker y el manifiesto publicados.
La suite de cierre de E3 pasa con 113/113 pruebas; `version.json` identifica la revisión pública
`e149c9c` y no queda desarrollo local pendiente antes de iniciar E4.

E4 quedó verificada el 31/07/2026. La conciliación autenticada contrastó el libro remoto completo por
conteo, ID, importe y huella. El cierre transaccional de julio creó una copia recuperable y un registro
append-only en Supabase; tras recargar, la aplicación recuperó el cierre desde el registro inmutable,
bloqueó una repetición y mantuvo visibles los datos históricos. La suite de cierre pasa con 125/125
pruebas, además de construcción, privacidad y smoke test.

A3-8 quedó verificada el 01/08/2026 sin reabrir las fases UX ya cerradas. La matriz distingue
«Planificar futuro» de «Registrar lo ocurrido», expone previsto, real y valor usado, guarda los reales
individuales automáticamente y conserva los cambios de planificación como borrador confirmable. La
regla vacío = usar previsto y cero = real cero está cubierta por pruebas. La puerta completa pasa con
127/127 pruebas, construcción pública, privacidad y smoke test. E5 quedó verificada después de este cierre.

E5 quedó verificada el 01/08/2026. El esquema se desplegó en Supabase y la aceptación autenticada
cerró, reabrió y volvió a cerrar agosto; importó y deshizo un lote temporal; confirmó la migración
explícita y el conflicto seguro entre sesiones; y registró 306/306 copias válidas con muestra restaurable.
La puerta local pasa con 136/136 pruebas, construcción pública, privacidad y smoke test.

El cierre completo de E5 quedó publicado en `origin/main` mediante `4431939`. La validación de cierre
del 01/08/2026 repitió con éxito 136/136 pruebas, construcción, privacidad, smoke test y `git diff --check`.

E6 quedó cerrada y publicada en `origin/main` mediante `e51fe07` el 01/08/2026. La validación final repitió
148/148 pruebas, construcción pública, privacidad, smoke test y `git diff --check`; Actions completó el
despliegue y Pages sirve `version.json` con la revisión `e51fe07`. El siguiente objetivo es E7.

E8 quedó verificada de extremo a extremo el 01/08/2026 con A3-1 a A3-7. La entrega reúne historial operativo,
comparación detallada de versiones, centro de calidad, acciones seguras desde alertas, adjuntos privados
cifrados, accesibilidad automatizada y un presupuesto probado con 10.000 filas. La puerta local pasa con
172/172 pruebas, construcción, privacidad, smoke test, accesibilidad, rendimiento y `git diff --check`;
el QA pasó en escritorio y móvil. El bucket privado y sus políticas RLS se desplegaron en Supabase; una
cuenta sintética confirmó subida cifrada, descarga y descifrado desde otra sesión, recuperación,
restauración y borrado definitivo. El objeto, la cuenta y sus revisiones temporales quedaron eliminados.
La implementación `939acc6` y el cierre remoto `dfe3bb2` están publicados en `origin/main`; el workflow
`30698057298` completó correctamente la verificación y el despliegue de GitHub Pages.
