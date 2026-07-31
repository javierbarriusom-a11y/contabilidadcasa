# Backlog maestro de Finanzas Casa DEF

Fecha de referencia: 31 de julio de 2026.

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

| Bloque | Fases | Verificado | Parcial | Pendiente | Lectura actual |
| --- | ---: | ---: | ---: | ---: | --- |
| P0 Integridad estructural | 6 | 6 | 0 | 0 | Base canónica, sincronización y restauración verificadas |
| P1 Decisión y tesorería | 8 | 0 | 8 | 0 | Base funcional disponible; faltan cierres y calidad completa |
| P2 Planificación familiar | 6 | 6 | 0 | 0 | Funcionalidad verificada; quedan mejoras no bloqueantes |
| P3 Servicios externos | 3 | 0 | 0 | 3 | Requiere diseño privado y proveedores externos |
| UX Experiencia principal | 6 | 6 | 0 | 0 | Experiencia principal verificada en escritorio y móvil |
| **Total roadmap inicial** | **29** | **18** | **8** | **3** | **El siguiente trabajo no debe reabrir lo ya verificado** |

### Correcciones respecto al backlog anterior

- P0-1 a P0-6 están verificados. P0-6 incluye restauración autenticada y transaccional en Supabase.
- P2-1 a P2-6 están verificados; el backlog anterior todavía los describía como parciales o pendientes.
- UX-1 a UX-6 están verificados, aunque el backlog anterior no los mantenía como bloque propio.
- P1-1 a P1-8 siguen parciales: tener componentes implementados no completa sus criterios globales.
- P3-3 se mantiene separado de P3-2 porque preparar acciones seguras es distinto de responder consultas.

## 3. Riesgos actuales que condicionan el orden

| Riesgo | Evidencia actual | Impacto | Tratamiento propuesto |
| --- | --- | --- | --- |
| La aplicación depende de la red para descargar su interfaz | No existe `service worker` ni manifiesto PWA | Una caída de GitHub Pages o la falta de conexión impiden abrir una sesión nueva | Añadir caché segura del shell y arranque offline |
| Los reintentos remotos pendientes viven en memoria | `remote-save-queue.js` conserva la cola en variables JavaScript | Al cerrar la pestaña se pierde el reintento, aunque quede copia local | Buzón persistente en IndexedDB y reanudación automática |
| El usuario puede no distinguir copia local y remota | Hay estado de sincronización, pero falta un indicador global de durabilidad | Riesgo de cerrar creyendo que el cambio ya está remoto | Estado visible: local, pendiente, sincronizado o conflicto |
| El despliegue depende directamente de `main` | GitHub Pages sirve la raíz de `main` | Un cambio defectuoso puede afectar la aplicación disponible | Puerta CI, comprobación publicada y procedimiento de reversión |
| Hay datos financieros en una web publicada | `data.js` contiene datos personales y Pages puede ser público | Riesgo alto de exposición, independiente de la autenticación de Supabase | Retirar datos personales del artefacto público y revisar acceso |
| Falta conciliación exhaustiva del libro remoto | La copia completa está verificada, no el contraste de cada fila proyectada | No hay evidencia completa de igualdad entre libro local y tabla remota | Verificación por conteo, ID, importe y huella |
| El cierre mensual remoto no es transaccional | P1-6 continúa parcial | Un mes cerrado podría modificarse o arrastrarse de forma incoherente | Función transaccional, bloqueo y auditoría |
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
| A0-4 | Apertura offline del shell | Pendiente | Alta | Tras una primera visita, la app abre sin red con recursos versionados; no se almacenan credenciales ni respuestas privadas en caché compartida |
| A0-5 | Recuperación guiada al iniciar | Pendiente | Alta | Si hay cola pendiente, copia local más reciente o conflicto, la app compara fechas y huellas y permite continuar, recargar o restaurar sin sobrescritura silenciosa |
| A0-6 | Puerta de despliegue y rollback | Pendiente | Crítica | CI ejecuta pruebas y smoke test; el despliegue solo publica si pasan; existe un procedimiento probado para volver a la última versión estable |
| A0-7 | Comprobación de disponibilidad publicada | Pendiente | Alta | Se valida periódicamente HTTPS, carga de recursos, inicio de la app y versión servida; los fallos generan una alerta utilizable |
| A0-8 | Privacidad del artefacto web | Pendiente | Crítica | El sitio publicado no contiene datos financieros personales en sus archivos estáticos; se documentan visibilidad, autenticación y rotación de secretos |
| A0-9 | Exportación y copia de emergencia | Pendiente | Alta | El usuario puede descargar una copia completa verificada y reimportarla en un perfil limpio; la prueba demuestra igualdad de huella |

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
| A1-1 | P0 seguimiento | Conciliación remota exhaustiva del libro | Pendiente | Crítica | El libro local y `finance_ledger_entries` coinciden en activos, conteo, IDs, importes y huella; se conserva evidencia anonimizada |
| A1-2 | P1-6 | Cierre mensual transaccional | Parcial | Crítica | Cerrar un mes congela reales de forma atómica, registra auditoría y arrastra únicamente previsiones al mes siguiente |
| A1-3 | P1-6 | Reapertura controlada de mes | Pendiente | Alta | Solo una acción confirmada crea una nueva revisión; nunca modifica el cierre histórico y deja motivo y antes/después |
| A1-4 | P1-7 | Deshacer importación por lote | Parcial | Alta | Cada lote tiene identidad, vista previa y snapshot; deshacer local o remoto restaura una nueva versión sin borrar historial |
| A1-5 | P0/P1 | Eliminar fallback remoto silencioso | Parcial | Alta | Si falta el esquema normalizado se informa y se conserva localmente; el legado solo se usa mediante una migración explícita y comprobable |
| A1-6 | Operación | Retención y verificación de copias | Pendiente | Media | Existe política de retención, comprobación periódica de huellas y restauración de muestra sin pérdida |

### A2 — Completar decisión y tesorería

| ID | Fase | Desarrollo pendiente | Estado | Prioridad | Criterio de aceptación resumido |
| --- | --- | --- | --- | --- | --- |
| A2-1 | P1-1 | Cobertura aprendida hasta el siguiente ingreso | Parcial | Alta | Fechas y patrones se derivan solo de movimientos conciliados, con confianza visible y edición manual |
| A2-2 | P1-2 | Calidad obligatoria de contratos de deuda | Parcial | Alta | Capital, mora, TAE, suspensión, vencimiento, titular, acuerdo y procedencia están informados o marcados como desconocidos |
| A2-3 | P1-3 | Efectos legales y fiscales del comparador | Parcial | Media | Cada efecto tiene fuente, fecha, jurisdicción y advertencia profesional; no se presenta como certeza sin respaldo |
| A2-4 | P1-4 | Frontera multiobjetivo explicable | Parcial | Media | Se muestran alternativas no dominadas entre deuda, caja, colchón y coche, con restricciones y razón de preferencia |
| A2-5 | P1-5 | Escenarios probabilísticos calibrados | Parcial | Media | Optimista, base y tensión se calibran con histórico conciliado; más de 24 meses se expresa como bandas |
| A2-6 | P1-6 | Procedencia y confianza de cada KPI | Parcial | Alta | Todo KPI ejecutivo muestra fuente, fecha, método, cobertura y nivel de confianza |
| A2-7 | P1-7 | Comparación integral antes/después | Parcial | Alta | Antes de importar se muestran altas, cambios, duplicados, bajas, efectos mensuales e invariantes |
| A2-8 | P1-8 | Contrato único para Hoy y acciones | Parcial | Alta | Una API interna versionada entrega decisiones, alertas, capacidad y contexto; todas las vistas consumen la misma lectura |

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
| E4 | A1-1 y A1-2 | Libro remoto conciliado y cierre mensual seguro |
| E5 | A1-3 a A1-6 | Reapertura, deshacer, migración y copias operativas |
| E6 | A2-1, A2-2, A2-6 y A2-8 | Datos ejecutivos completos, trazables y consistentes |
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

Comenzar por **E1: continuidad entre sesiones**. En concreto:

1. diseñar el contrato de una operación pendiente persistida;
2. mover la cola remota desde memoria a IndexedDB sin cambiar el guardado local existente;
3. cargar primero la copia local y reanudar la cola después de autenticar;
4. mostrar el estado global de durabilidad;
5. verificar cierre y reapertura con red disponible, sin red y con conflicto remoto.

Hasta completar E1, el cierre mensual y las nuevas integraciones deben mantenerse detrás de esta
prioridad para no aumentar la superficie de pérdida o indisponibilidad.
