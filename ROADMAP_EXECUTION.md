# Hoja de ruta de ejecucion

Fecha base: 15 de julio de 2026. Última reconciliación operativa: 8 de agosto de 2026.

## Estado operativo vigente

Esta hoja conserva a continuación el plan y las evidencias históricas de julio. Para evitar que ese
histórico se interprete como estado actual, `BACKLOG_STATUS.md` es la fuente operativa de estados y
`PROJECT_STATE.md` registra el último cierre de sesión.

| Entregas | Estado vigente | Referencia |
| --- | --- | --- |
| E1-E9 | Verificado | Base canónica, recuperación y contratos externos seguros cerrados |
| E10 | Pendiente, al final | Activación real de servicios externos, sin bloquear el producto local |
| E11-E17 | Verificado | Entrada, forecast, escenarios, deuda, objetivos, seguimiento predictivo y experiencia por tareas completados |
| E16 | Verificado | Seguimiento predictivo A11-1 a A11-5 aceptado con persistencia y recarga |
| E17 | Verificado | Simplificación por tareas A12-1 a A12-5 aceptada en escritorio y móvil |
| E18 | Verificado | Migraciones, rendimiento, observabilidad, guía offline y QA visual comparativo aceptados |

## Plan de cierre vigente: E18 y E10

1. **E18 verificada:** fixtures de migración, capturas comparables, métricas locales, guía contextual y
   separación de experiencia pasan con modo offline, recuperación y artefacto público.
2. **Activar E10 por dependencias y con autorización específica:** A5-1 backend privado/Responses API;
   A5-2 selección reproducible de modelo; A5-3 hogar compartido; A5-4 web push; A5-5 proveedor PSD2;
   A5-6 importación programada idempotente. Cada servicio seguirá siendo opcional y no bloqueará el modo local.
3. **Cierre de proyecto:** aceptar cada servicio en una prueba real, con privacidad, recuperación y dos
   sesiones cuando haya estado compartido; alinear backlog, estado y roadmap, y publicar solo con autorización.

La sección «Resumen ejecutivo de estado» que sigue es una fotografía histórica del 18 de julio de
2026; no debe utilizarse para priorizar ni para reabrir entregas verificadas.

Esta hoja distingue entre codigo existente y funcionalidad realmente terminada. Una fase solo se
marca como completada cuando cumple sus criterios de aceptacion, tiene pruebas y no deja una ruta
legada capaz de producir un resultado distinto.

## Contrato de trabajo

- Se ejecuta una sola fase cada vez.
- Al cerrar una fase se actualiza este documento y se entrega la matriz completa en el chat.
- Cada cierre incluye: cambios, pruebas, evidencia visual, riesgos y trabajo pendiente.
- Estados permitidos: `Pendiente`, `Parcial`, `En curso`, `Implementado`, `Verificado`, `Bloqueado`.
- `Implementado` significa que el codigo existe; `Verificado` significa que el comportamiento ha
  sido probado de extremo a extremo.
- `Parcial` significa que existe una base funcional o tecnica, pero aun no cumple todo el criterio
  de aceptacion o conserva dependencias/rutas heredadas.

## Criterio global de terminado

Una fase se considera verificada cuando:

1. Existe una unica fuente de verdad para los datos que modifica.
2. Las pantallas afectadas muestran el mismo resultado.
3. Guardar, recargar, sincronizar y restaurar conservan el resultado.
4. Las operaciones destructivas tienen confirmacion, trazabilidad y posibilidad de recuperacion.
5. Las invariantes financieras y las pruebas funcionales pasan.
6. La experiencia se valida en escritorio y movil sin desbordamientos ni bloqueos.

## Resumen ejecutivo de estado

Fecha de inventario: 18 de julio de 2026. `Realizado` equivale a `Verificado`: no basta con que el
codigo exista, debe superar el criterio de aceptacion de extremo a extremo.

| Bloque | Fases | Realizados | Implementados | Parciales | Pendientes | Objetivo |
| --- | --- | --- | --- | --- | --- | --- |
| P0 | P0-1 a P0-6 | 6: P0-1 a P0-6 | 0 | 0 | 0 | Fuente unica, integridad, motor canonico, auditoria y restauracion |
| P1 | P1-1 a P1-8 | 8: P1-1 a P1-8 | 0 | 0 | 0 | Tesoreria diaria, deuda, optimizacion, escenarios, cierres e importacion |
| P2 | P2-1 a P2-6 | 6: P2-1 a P2-6 | 0 | 0 | 0 | Huchas, familia, alertas, comportamiento, documentos y exportacion |
| P3 | P3-1 a P3-3 | 0 | 0 | 0 | 3: P3-1 a P3-3 | Conexion bancaria y asistente financiero real |
| UX | UX-1 a UX-6 | 6: UX-1 a UX-6 | 0 | 0 | 0 | Nueva navegacion, Hoy, acciones, familia, alertas y validacion |
| **Total** | **29 fases** | **26** | **0** | **0** | **3** | **P0, P1, P2 y UX están verificados; E8 es el siguiente objetivo** |

## P0 - Integridad estructural

| Fase | Alcance | Situacion inicial | Criterio de aceptacion | Estado |
| --- | --- | --- | --- | --- |
| P0-1 | Libro mayor canonico e identificadores estables | Hay libro e IDs, pero parte del estado legado sigue generando entidades y reapariciones | Todo real nace en el libro mayor; deduplicacion y bajas usan IDs estables; una eliminacion no reaparece tras recargar o importar | Verificado |
| P0-2 | Supabase normalizado como fuente autoritativa | Esquema activo y 2338 entidades sincronizadas, pero existe lectura/escritura compatible con `finance_dashboard_states` | Lectura primaria desde tablas normalizadas; legado solo como migracion/fallback controlado; prueba de recarga en dos sesiones | Verificado |
| P0-3 | Maquina de estados y registro inmutable | Workflow canonico disponible | Deudas, proyectos, acuerdos e importaciones usan transiciones comunes; cada cambio real genera evento append-only con antes/despues y los reintentos son idempotentes | Verificado |
| P0-4 | Motor unico de calculo | Escenarios canonicos base, activo y planificado; las vistas mantienen aliases de compatibilidad | Todas las vistas consumen un unico resultado diario/mensual; el motor legado deja de decidir cifras | Verificado |
| P0-5 | Reconciliacion e invariantes como barrera | Hay vista e invariantes, pero no bloquean todos los guardados/publicaciones incoherentes | Diferencias banco-presupuesto-simulacion visibles; no se confirma ni publica un estado que rompa invariantes | Verificado |
| P0-6 | Copias, restauracion y seguridad de version | Selector, restauracion transaccional e historial inmutable desplegados | Selector de versiones, vista previa, restauracion transaccional y prueba de recuperacion sin perdida | Verificado |

## P1 - Decision y tesoreria

| Fase | Alcance | Situacion inicial | Criterio de aceptacion | Estado |
| --- | --- | --- | --- | --- |
| P1-1 | Motor diario de tesoreria y reserva unica | Calendario diario y reserva existen parcialmente | Cobros/pagos por fecha, cobertura hasta siguiente ingreso y una reserva global editable usada por toda la app | Verificado |
| P1-2 | Contratos de deuda completos | Hay capital, cuota y algunos estados; faltan campos y calidad uniforme | Capital, mora, TAE, suspension, vencimiento, titular, acuerdo y procedencia obligatorios o marcados como desconocidos | Verificado |
| P1-3 | Comparador de acuerdos | Existen modalidades en control de deuda | Pago unico, fraccionado, reunificacion, retomar y no actuar comparados con caja, patrimonio, registros y alternativa actuar/esperar/negociar | Parcial |
| P1-4 | Optimizacion multiobjetivo explicable | Hay rutas optimas heuristicas | Frontera deuda-caja-colchon-coche, restricciones duras y explicacion de por que una opcion domina a otra | Parcial |
| P1-5 | Escenarios probabilisticos | Hay escenarios deterministas y ajustes | Optimista, base y tension calibrados; horizontes superiores a 24 meses se muestran como bandas/rangos | Parcial |
| P1-6 | Calidad, procedencia y cierre mensual | Hay metadatos parciales y meses cerrados de forma incompleta | Cada KPI indica fuente, fecha, confianza y metodo; cierre remoto congela reales y arrastra solo previsiones | Verificado |
| P1-7 | Importacion segura con deshacer | Hay seleccion, vista previa y confirmaciones parciales | Comparar antes/despues, validar, confirmar, registrar lote y deshacer local/remoto por snapshot | Parcial |
| P1-8 | Modelo de lectura para Hoy y acciones | Hoy y el registro unificado de acciones ya consumen una lectura comun, pero su calidad depende de cerrar P0/P1 | API interna unica que devuelve tres decisiones, alertas, capacidad libre y contexto; la UI se completa en UX-2/UX-3 | Verificado |

## P2 - Planificacion familiar

| Fase | Alcance | Situacion inicial | Criterio de aceptacion | Estado |
| --- | --- | --- | --- | --- |
| P2-1 | Huchas vinculadas a objetivos | Huchas con aportaciones manuales o conciliadas, progreso, fecha objetivo, pausa, ejecucion y cancelacion | Aportaciones reales conciliadas, progreso, fecha objetivo, ejecucion y cancelacion sin duplicar flujo | Verificado |
| P2-2 | Modelo familiar Javi/Tere/Hogar | Titularidad Javi/Tere/Hogar asignable a ingresos, gastos y deudas, con inferencia inicial y persistencia | Titular obligatorio, filtros y capacidad individual/familiar; presentacion global en UX-4 | Verificado |
| P2-3 | Alertas configurables | Canal app, notificacion de navegador y preparacion de email; umbral, frecuencia, activacion y silenciamiento persistidos | Umbral, canal, frecuencia, activacion y silenciamiento persistidos; interfaz en UX-5 | Verificado |
| P2-4 | Indicadores de comportamiento | Tendencias, recurrencia y anomalias calculadas exclusivamente sobre movimientos conciliados | Tendencias, recurrencia, anomalias y explicacion basada solo en movimientos conciliados | Verificado |
| P2-5 | Documentos de acuerdos | Adjuntos privados en IndexedDB, ficha sincronizable, fecha limite, verificacion, notas y enlace con deuda | Adjuntos privados, fecha limite, estado de verificacion, notas y enlace con deuda/acuerdo | Verificado |
| P2-6 | Exportacion para asesor | Paquete PDF y Excel versionado con caja, cuentas, deuda, huchas, movimientos, alertas, documentos y procedencia | Paquete PDF/Excel versionado con deuda, caja, escenarios, procedencia y advertencias | Verificado |

## P3 - Servicios externos

| Fase | Alcance | Situacion inicial | Criterio de aceptacion | Estado |
| --- | --- | --- | --- | --- |
| P3-1 | Preparacion de conexion bancaria regulada | Importacion manual; no hay proveedor PSD2 | Capa de proveedor, consentimiento, solo lectura, revocacion, seguridad y fallback a importacion; activacion depende de proveedor externo | Pendiente |
| P3-2 | Asistente conversacional trazable | El asistente actual no usa un backend privado de IA | Consultas sobre libro mayor y motor canonico, respuesta con fuentes, fecha y calculo reproducible | Pendiente |
| P3-3 | Acciones conversacionales seguras | No implementado | El asistente solo prepara borradores; toda escritura exige vista previa, confirmacion y evento de auditoria | Pendiente |

## UX - Experiencia principal en seis fases

| Fase | Alcance | Criterio de aceptacion | Estado |
| --- | --- | --- | --- |
| UX-1 | Navegacion con cinco areas principales | Menu: Hoy, Plan familiar, Deuda y proyectos, Movimientos, Herramientas avanzadas; las vistas actuales quedan dentro de la ultima | Verificado |
| UX-2 | Landing Hoy | Saldo y fecha, tres decisiones accionables, proximo riesgo y capacidad libre entendibles en menos de 30 segundos | Verificado |
| UX-3 | Centro unico de acciones | Fusiona agente ejecutivo, cola y asesor; prioriza, explica y ejecuta con un solo patron de confirmacion | Verificado |
| UX-4 | Modo familiar | Selector Javi/Tere/Hogar persistente que cambia cifras, titularidad y capacidad sin duplicar datos | Verificado |
| UX-5 | Centro de alertas | Crear, editar, pausar y revisar alertas con estado, umbral, fecha y accion recomendada | Verificado |
| UX-6 | Validacion y simplificacion | Pruebas con tareas clave, accesibilidad, responsive, rendimiento y retirada de duplicidades validadas | Verificado |

### Incidencia de persistencia (31 de julio de 2026)

- Implementada una cola remota de escritor unico: los cambios guardan primero la copia local, reciben una revision y no se descartan si otra sincronizacion esta en curso.
- La cola vuelve a capturar el estado mas reciente, reintenta los fallos de red y muestra revision pendiente, activa o persistida en el panel.
- El puntero remoto usa control optimista: una sesion solo publica si `finance_source_heads` conserva la revision que cargo; los conflictos quedan pendientes sin reintento destructivo.
- 100 pruebas pasan, incluidas concurrencia durante una escritura, reintento tras fallo, conflicto remoto no reintentable y carga remota deduplicada.
- Estado: `Verificado`. En Supabase de prueba, `4182` persistio dos cambios solapados hasta la revision 4, `4183` intento publicar desde una revision obsoleta y quedo bloqueada, y la recarga recupero el valor restaurado en la revision 5.

## Orden de ejecucion recomendado

1. P0-1 a P0-6: cerrar la integridad y la fuente de verdad.
2. UX-1: simplificar navegacion sin alterar calculos.
3. P1-1 a P1-4 y P1-8: preparar la inteligencia ejecutiva.
4. UX-2 y UX-3: construir Hoy y el centro de acciones sobre datos estables.
5. P1-5 a P1-7: escenarios, calidad, cierre e importacion segura.
6. P2-1 a P2-3 y UX-4/UX-5: objetivos, familia y alertas.
7. P2-4 a P2-6 y UX-6: analitica, documentos, exportacion y validacion final.
8. P3-1 a P3-3: integraciones externas y asistente real.

## Matriz de seguimiento

Esta es la tabla que se devolvera actualizada al cerrar cada fase.

| Fase | Estado | Entregables completados | Pruebas/evidencia | Pendiente o riesgo | Siguiente fase |
| --- | --- | --- | --- | --- | --- |
| P0-1 | Verificado | IDs semanticos para partidas, deudas, proyectos y decisiones; deduplicacion y bajas canonicas | 31/07/2026: alta y baja de una partida temporal sincronizadas; la baja no reaparecio tras recarga ni en una segunda sesion autenticada | Ninguno | P0-2 |
| P0-2 | Verificado | Puntero `finance_source_heads`; la copia normalizada activa manda, el legado solo migra y una sesion obsoleta no puede mover el puntero | Prueba autenticada en dos sesiones: cambios solapados, bloqueo de revision obsoleta y recarga de la revision vigente | Ninguno | P0-3 |
| P0-3 | Verificado | Eventos inmutables de importacion, sincronizacion, enmienda y transicion con instantanea antes/despues; comandos deterministas sin duplicados | Pruebas de transiciones, importacion, enmienda, idempotencia y sintaxis; publicacion posterior | Quedan mutaciones de datos base para P0-4/P0-5, fuera del ciclo de vida de decisiones | P0-4 |
| P0-4 | Verificado | Escenarios base, activo y planificado emitidos por el motor canonico; el calendario diario activo parte del mismo resultado mensual | 87 pruebas: contrato de escenario, corte que impide invocar `buildRows` desde la app, invariantes, paridad y calendario diario/mensual | `lastSimulation` y equivalentes permanecen como aliases de lectura para vistas existentes; no ejecutan calculos | P0-5 |
| P0-5 | Verificado | Vista de conciliacion y barrera canonica antes de publicar en Supabase | Pruebas de escenarios ausentes, paridad diaria/mensual, deuda duplicada y errores criticos | Ninguno | P0-6 |
| P0-6 | Verificado | Selector remoto, comparacion antes/despues y restauracion transaccional como version nueva | Restauracion autenticada completa en Supabase, puntero actualizado e historial preservado | Ninguno | P1-1 |
| P1-1 | Verificado | Cobertura aprendida y editable hasta el siguiente ingreso, derivada solo de movimientos conciliados | Pruebas de contratos y aceptación remota guardar-recargar-restablecer | Ninguno | P1-2 |
| P1-2 | Verificado | Ocho campos contractuales de deuda y desconocidos visibles | Pruebas de calidad y validación de interfaz | Ninguno | P1-3 |
| P1-3 | Verificado | Comparador con efectos legales/fiscales, fuente BOE, fecha, jurisdicción y advertencia profesional | Contrato E7, pruebas y aceptación autenticada | Ninguno | P1-4 |
| P1-4 | Verificado | Frontera no dominada entre deuda, caja, colchón y coche con restricciones explícitas | Contrato E7, pruebas de dominancia/reserva y navegador | Ninguno | P1-5 |
| P1-5 | Verificado | Escenarios calibrados solo con histórico conciliado, confianza y bandas para más de 24 meses | Contrato E7, pruebas de muestra/confianza y navegador | Ninguno | P1-6 |
| P1-6 | Verificado | Fuente, fecha, metodo, cobertura y confianza visibles por KPI; cierre mensual remoto ya verificado | Pruebas de lectura y aceptación de interfaz/persistencia | Ninguno | P1-7 |
| P1-7 | Verificado | Vista previa integral antes/después para lotes, CSV y libros completos; confirmación separada y deshacer existente | Importar, recargar, conflicto, deshacer y restaurar comprobados en Supabase | Ninguno | P1-8 |
| P1-8 | Verificado | `finance-executive-read-model/v1` común para Hoy y acciones | Tres decisiones y metadatos uniformes comprobados en navegador | Ninguno | P2-1 |
| P2-1 | Verificado | Huchas con aportaciones manuales/conciliadas, progreso, pausa, ejecucion y cancelacion | Pruebas de deduplicacion global por movimiento y panel validado en navegador | Ninguno; automatizar aportaciones bancarias depende de P3-1 | P2-2 |
| P2-2 | Verificado | Titular obligatorio y editable para series y deudas; selector Hogar/Javi/Tere persistente | Inferencia, reasignacion y agregacion familiar cubiertas por pruebas y navegador | Ninguno | P2-3 |
| P2-3 | Verificado | Canales app, navegador y preparacion de email; frecuencia y silenciamiento persistidos | Panel de canales validado sin errores de consola; reglas UX-5 ya verificadas | El envio autonomo servidor queda fuera de P2 y depende de P3 | P2-4 |
| P2-4 | Verificado | Tendencias, recurrencia y anomalias sobre movimientos conciliados | Prueba que excluye movimientos no conciliados y panel validado en navegador | Ninguno | P2-5 |
| P2-5 | Verificado | Adjuntos privados locales, metadatos sincronizables, fecha limite, notas, verificacion y deuda vinculada | IndexedDB para archivo; modelo documental normalizado y panel validado en navegador | Sincronizar binarios entre dispositivos requeriria almacenamiento privado remoto opcional | P2-6 |
| P2-6 | Verificado | Exportacion PDF y libro Excel versionados con caja, deuda, huchas, movimientos, alertas, documentos y procedencia | Generadores incluidos, modelo de exportacion trazable y botones disponibles en navegador | Ninguno | P3-1 |
| P3-1 | Pendiente | Importacion bancaria manual como fallback | - | Requiere proveedor PSD2, consentimiento y seguridad | P3-1 |
| P3-2 | Pendiente | Asistentes locales basados en reglas | - | Falta backend privado de IA con respuestas trazables | P3-2 |
| P3-3 | Pendiente | Patron de revision/confirmacion disponible en acciones de UI | - | Falta conectarlo a un asistente real y auditar sus borradores | P3-3 |
| UX-1 | Verificado | Cinco areas principales, apertura en Hoy y herramientas avanzadas agrupadas por decidir, analizar y datos | Navegacion por hash compatible; validacion desktop y movil | Validar el modelo mental con uso real | UX-2 |
| UX-2 | Verificado | Landing Hoy con liquidez fechada, capacidad libre, reserva, proximo riesgo, tres decisiones y meses sensibles | Navegacion real por hash; lectura y CTA comprobados en navegador; 3 decisiones visibles | El contenido depende de la calidad del modelo de lectura P1-8 | UX-3 |
| UX-3 | Verificado | Registro unificado de acciones reutilizado por Hoy y asesores; revision previa con impacto y confirmacion comun | Revision abierta en navegador, confirmacion y destino Agente ahorro verificados; sin mutacion antes de confirmar | Retirar paneles redundantes queda para UX-6 tras uso real | UX-4 |
| UX-4 | Verificado | Selector Hogar/Javi/Tere persistente, agregacion por titular y resumen de ingresos, gastos y margen en Hoy | Cambio Hogar/Tere comprobado en navegador; persistencia tras recarga; 66 pruebas de dominio y UX en verde | La obligatoriedad de titular en el modelo normalizado sigue en P2-2 | UX-5 |
| UX-5 | Verificado | Centro de alertas con alta, edicion, pausa/reactivacion, eliminacion, umbral, revision, frecuencia y accion recomendada | Ciclo crear-pausar-recargar-eliminar comprobado en navegador; estado limpio de 3 reglas; responsive 390x844 sin desbordamiento | Los canales externos de aviso siguen en P2-3 | UX-6 |
| UX-6 | Verificado | Navegacion movil compacta, enlace para saltar al contenido, foco visible y gestionado tras cada cambio de vista, estado accesible de calculo, titulos de documento por seccion, movimiento reducido y deduplicacion del render pesado | QA real en 1280x720 y 390x844: menu abre/cierra, foco llega al H1 incluso tras calculo diferido, sin desbordamiento horizontal ni errores de consola; 73 pruebas en verde | La retirada definitiva de herramientas avanzadas redundantes requiere validar uso real; no bloquea la experiencia principal | P0-1 |
