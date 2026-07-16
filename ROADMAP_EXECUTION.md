# Hoja de ruta de ejecucion

Fecha base: 15 de julio de 2026.

Esta hoja distingue entre codigo existente y funcionalidad realmente terminada. Una fase solo se
marca como completada cuando cumple sus criterios de aceptacion, tiene pruebas y no deja una ruta
legada capaz de producir un resultado distinto.

## Contrato de trabajo

- Se ejecuta una sola fase cada vez.
- Al cerrar una fase se actualiza este documento y se entrega la matriz completa en el chat.
- Cada cierre incluye: cambios, pruebas, evidencia visual, riesgos y trabajo pendiente.
- Estados permitidos: `Pendiente`, `En curso`, `Implementado`, `Verificado`, `Bloqueado`.
- `Implementado` significa que el codigo existe; `Verificado` significa que el comportamiento ha
  sido probado de extremo a extremo.

## Criterio global de terminado

Una fase se considera verificada cuando:

1. Existe una unica fuente de verdad para los datos que modifica.
2. Las pantallas afectadas muestran el mismo resultado.
3. Guardar, recargar, sincronizar y restaurar conservan el resultado.
4. Las operaciones destructivas tienen confirmacion, trazabilidad y posibilidad de recuperacion.
5. Las invariantes financieras y las pruebas funcionales pasan.
6. La experiencia se valida en escritorio y movil sin desbordamientos ni bloqueos.

## P0 - Integridad estructural

| Fase | Alcance | Situacion inicial | Criterio de aceptacion | Estado |
| --- | --- | --- | --- | --- |
| P0-1 | Libro mayor canonico e identificadores estables | Hay libro e IDs, pero parte del estado legado sigue generando entidades y reapariciones | Todo real nace en el libro mayor; deduplicacion y bajas usan IDs estables; una eliminacion no reaparece tras recargar o importar | Pendiente |
| P0-2 | Supabase normalizado como fuente autoritativa | Esquema activo y 2338 entidades sincronizadas, pero existe lectura/escritura compatible con `finance_dashboard_states` | Lectura primaria desde tablas normalizadas; legado solo como migracion/fallback controlado; prueba de recarga en dos sesiones | Pendiente |
| P0-3 | Maquina de estados y registro inmutable | Existe workflow canonico, pero no todas las mutaciones pasan por comandos y eventos | Deudas, proyectos, acuerdos e importaciones usan transiciones comunes; cada cambio genera evento append-only antes/despues | Pendiente |
| P0-4 | Motor unico de calculo | Existe motor canonico y comparador con el historico, pero quedan calculos directos en vistas | Todas las vistas consumen un unico resultado diario/mensual; el motor legado deja de decidir cifras | Pendiente |
| P0-5 | Reconciliacion e invariantes como barrera | Hay vista e invariantes, pero no bloquean todos los guardados/publicaciones incoherentes | Diferencias banco-presupuesto-simulacion visibles; no se confirma ni publica un estado que rompa invariantes | Pendiente |
| P0-6 | Copias, restauracion y seguridad de version | Hay snapshots locales/remotos, pero falta restauracion guiada y validacion completa | Selector de versiones, vista previa, restauracion transaccional y prueba de recuperacion sin perdida | Pendiente |

## P1 - Decision y tesoreria

| Fase | Alcance | Situacion inicial | Criterio de aceptacion | Estado |
| --- | --- | --- | --- | --- |
| P1-1 | Motor diario de tesoreria y reserva unica | Calendario diario y reserva existen parcialmente | Cobros/pagos por fecha, cobertura hasta siguiente ingreso y una reserva global editable usada por toda la app | Pendiente |
| P1-2 | Contratos de deuda completos | Hay capital, cuota y algunos estados; faltan campos y calidad uniforme | Capital, mora, TAE, suspension, vencimiento, titular, acuerdo y procedencia obligatorios o marcados como desconocidos | Pendiente |
| P1-3 | Comparador de acuerdos | Existen modalidades en control de deuda | Pago unico, fraccionado, reunificacion, retomar y no actuar comparados con caja, patrimonio, registros y alternativa actuar/esperar/negociar | Pendiente |
| P1-4 | Optimizacion multiobjetivo explicable | Hay rutas optimas heuristicas | Frontera deuda-caja-colchon-coche, restricciones duras y explicacion de por que una opcion domina a otra | Pendiente |
| P1-5 | Escenarios probabilisticos | Hay escenarios deterministas y ajustes | Optimista, base y tension calibrados; horizontes superiores a 24 meses se muestran como bandas/rangos | Pendiente |
| P1-6 | Calidad, procedencia y cierre mensual | Hay metadatos parciales y meses cerrados de forma incompleta | Cada KPI indica fuente, fecha, confianza y metodo; cierre remoto congela reales y arrastra solo previsiones | Pendiente |
| P1-7 | Importacion segura con deshacer | Hay seleccion, vista previa y confirmaciones parciales | Comparar antes/despues, validar, confirmar, registrar lote y deshacer local/remoto por snapshot | Pendiente |
| P1-8 | Modelo de lectura para Hoy y acciones | Hay Control diario, asesores y colas redundantes | API interna unica que devuelve tres decisiones, alertas, capacidad libre y contexto; la UI se completa en UX-2/UX-3 | Pendiente |

## P2 - Planificacion familiar

| Fase | Alcance | Situacion inicial | Criterio de aceptacion | Estado |
| --- | --- | --- | --- | --- |
| P2-1 | Huchas vinculadas a objetivos | Existen huchas simuladas y progreso parcial | Aportaciones reales conciliadas, progreso, fecha objetivo, ejecucion y cancelacion sin duplicar flujo | Pendiente |
| P2-2 | Modelo familiar Javi/Tere/Hogar | Hay campos de titularidad dispersos | Titular obligatorio, filtros y capacidad individual/familiar; presentacion global en UX-4 | Pendiente |
| P2-3 | Alertas configurables | Hay avisos calculados y reglas fijas | Umbral, canal, frecuencia, activacion y silenciamiento persistidos; interfaz en UX-5 | Pendiente |
| P2-4 | Indicadores de comportamiento | Hay medias y desviaciones aisladas | Tendencias, recurrencia, anomalias y explicacion basada solo en movimientos conciliados | Pendiente |
| P2-5 | Documentos de acuerdos | No implementado | Adjuntos privados, fecha limite, estado de verificacion, notas y enlace con deuda/acuerdo | Pendiente |
| P2-6 | Exportacion para asesor | Exportaciones parciales | Paquete PDF/Excel versionado con deuda, caja, escenarios, procedencia y advertencias | Pendiente |

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
| UX-4 | Modo familiar | Selector Javi/Tere/Hogar persistente que cambia cifras, titularidad y capacidad sin duplicar datos | Pendiente |
| UX-5 | Centro de alertas | Crear, editar, pausar y revisar alertas con estado, umbral, fecha y accion recomendada | Pendiente |
| UX-6 | Validacion y simplificacion | Pruebas con tareas clave, accesibilidad, responsive, rendimiento y retirada de duplicidades validadas | Pendiente |

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
| P0-1 | Pendiente | - | - | Estado legado aun puede recrear datos | P0-1 |
| P0-2 | Pendiente | Esquema Supabase activo y sincronizacion normalizada confirmada como punto de partida | Mensaje de 2338 entidades normalizadas | Dualidad normalizado/legado | - |
| P0-3 | Pendiente | - | - | Mutaciones fuera del workflow | - |
| P0-4 | Pendiente | - | - | Calculos directos y motor legado | - |
| P0-5 | Pendiente | - | - | Invariantes no bloqueantes en todos los flujos | - |
| P0-6 | Pendiente | - | - | Restauracion no guiada | - |
| P1 | Pendiente | - | - | Depende de P0 | - |
| P2 | Pendiente | - | - | Depende de P0/P1 | - |
| P3 | Pendiente | - | - | Dependencias externas | - |
| UX-1 | Verificado | Cinco areas principales, apertura en Hoy y herramientas avanzadas agrupadas por decidir, analizar y datos | Navegacion por hash compatible; validacion desktop y movil | Validar el modelo mental con uso real | UX-2 |
| UX-2 | Verificado | Landing Hoy con liquidez fechada, capacidad libre, reserva, proximo riesgo, tres decisiones y meses sensibles | Navegacion real por hash; lectura y CTA comprobados en navegador; 3 decisiones visibles | El contenido depende de la calidad del modelo de lectura P1-8 | UX-3 |
| UX-3 | Verificado | Registro unificado de acciones reutilizado por Hoy y asesores; revision previa con impacto y confirmacion comun | Revision abierta en navegador, confirmacion y destino Agente ahorro verificados; sin mutacion antes de confirmar | Retirar paneles redundantes queda para UX-6 tras uso real | UX-4 |
| UX-4 | Pendiente | - | - | Requiere contexto familiar persistente sin duplicar datos | UX-4 |
| UX-5 | Pendiente | - | - | Requiere reglas configurables y persistencia | UX-5 |
| UX-6 | Pendiente | - | - | Validacion final tras UX-4/UX-5 | UX-6 |
