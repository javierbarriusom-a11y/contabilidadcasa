# Backlog maestro de Finanzas Casa DEF

Fecha de referencia: 1 de agosto de 2026.

Este documento sustituye al backlog anterior como referencia operativa. Parte del roadmap inicial,
del estado real documentado en `PROJECT_STATE.md`, del código y de las pruebas existentes. Su orden
prioriza que la aplicación siga siendo utilizable entre sesiones, incluso durante fallos de red,
conflictos remotos o un despliegue defectuoso.

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
| P3 Servicios externos | 3 | 0 | 0 | 0 | 3 | Requiere diseño privado y proveedores externos |
| UX Experiencia principal | 6 | 6 | 0 | 0 | 0 | Experiencia principal verificada en escritorio y móvil |
| **Total roadmap inicial** | **29** | **26** | **0** | **0** | **3** | **El siguiente trabajo no debe reabrir lo ya verificado** |

### Correcciones respecto al backlog anterior

- P0-1 a P0-6 están verificados. P0-6 incluye restauración autenticada y transaccional en Supabase.
- P2-1 a P2-6 están verificados; el backlog anterior todavía los describía como parciales o pendientes.
- UX-1 a UX-6 están verificados, aunque el backlog anterior no los mantenía como bloque propio.
- P1-1, P1-2, P1-6 y P1-8 están verificados; P1-3, P1-4, P1-5 y P1-7 continúan parciales para E7.
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

### A4 — Servicios externos y nuevos desarrollos

No se inicia este bloque hasta cerrar A0 y A1. Ningún servicio externo puede convertirse en requisito
para abrir la app o consultar la última copia local.

| ID | Fase | Desarrollo | Estado | Prioridad | Condición previa |
| --- | --- | --- | --- | --- | --- |
| A4-1 | P3-1 | Capa de conexión bancaria regulada y solo lectura | Pendiente externo | Baja | Proveedor PSD2, consentimiento revocable, evaluación de seguridad y fallback manual probado |
| A4-2 | Nuevo | Importación bancaria programada | Pendiente | Baja | A4-1 y deduplicación idempotente; nunca modifica decisiones automáticamente |
| A4-3 | P3-2 | Asistente privado y trazable | Pendiente externo | Baja | Backend privado, minimización de datos, autenticación y respuestas reproducibles con fuentes |
| A4-4 | P3-3 | Borradores conversacionales confirmables | Pendiente | Baja | A4-3; toda escritura muestra antes/después, exige confirmación y genera auditoría |
| A4-5 | Nuevo | Notificaciones remotas opcionales | Pendiente | Baja | Backend seguro, consentimiento por canal y ausencia de importes sensibles en notificaciones bloqueadas |
| A4-6 | Nuevo | Presupuestos y escenarios compartidos del hogar | Pendiente | Baja | Modelo de permisos, titularidad, conflictos y revocación; sin compartir credenciales |

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
| E8 | A3 según uso real | Mejoras incrementales sin reabrir bloques cerrados |
| E9 | A4 con decisiones independientes | Integraciones externas opcionales y desacopladas |

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

Iniciar **E8** con mejoras A3 priorizadas por uso real, sin reabrir E6 ni E7.

E7 quedó verificada el 01/08/2026: dos sesiones protegieron el puntero remoto; un lote sintético se
previsualizó, importó, recuperó tras recarga y deshizo; una restauración creó una revisión nueva y
conservó 19 copias recuperables. La regresión final pasó con 161 pruebas y sin datos sintéticos activos.

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
