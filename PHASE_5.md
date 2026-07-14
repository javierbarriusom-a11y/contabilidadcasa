# Fase 5 - Ciclo canónico de decisiones

## Objetivo

Convertir una simulación en una decisión financiera trazable. Un proyecto o una operación de deuda ya no aparece o desaparece mediante borrados directos: recorre un ciclo explícito desde su análisis hasta su ejecución o cancelación.

La fase resuelve tres riesgos del dashboard histórico:

- una propuesta todavía no aprobada podía entrar en los cálculos;
- eliminar una tarjeta visual podía borrar también su contexto y dificultar recuperarla;
- distintas pantallas podían interpretar de forma diferente si una decisión estaba activa.

## Estados del ciclo

El servicio puro `canonical-workflow.js` reconoce seis estados:

| Estado | Significado | Afecta al plan |
| --- | --- | --- |
| `simulated` | Alternativa calculada, todavía sin decisión | No |
| `pending` | Propuesta preparada para revisar | No |
| `approved` | Decisión confirmada e incorporada al calendario | Sí |
| `fixed` | Decisión aprobada y protegida frente a edición accidental | Sí |
| `executed` | Operación ya realizada y cerrada | No genera movimientos futuros |
| `cancelled` | Decisión descartada o retirada | No |

Solo `approved` y `fixed` generan movimientos futuros. Esta regla es común para proyectos y deuda y evita que una simulación altere el flujo de caja antes de confirmarla.

## Transiciones permitidas

El contrato impide saltos arbitrarios:

- simulada → pendiente o cancelada;
- pendiente → simulada, aprobada o cancelada;
- aprobada → pendiente, fija o cancelada;
- fija → aprobada, ejecutada o cancelada;
- cancelada → simulada o pendiente;
- ejecutada → estado terminal.

Cada transición es idempotente: repetir la misma acción no duplica registros ni movimientos.

## Integración en la interfaz

Las listas del simulador y de control de deuda exponen acciones coherentes con el estado:

- **Fijar en plan** protege una decisión aprobada;
- **Desbloquear** devuelve una decisión fija a aprobada para modificarla;
- **Marcar ejecutada** cierra una decisión ya realizada;
- **Cancelar** la retira de todos los cálculos sin destruir su historial;
- **Restaurar** recupera una decisión cancelada como propuesta pendiente.

La edición se bloquea únicamente en decisiones fijas. Las aprobadas continúan siendo editables y, al cambiar, se actualiza la misma identidad estable.

## Historial y auditoría

El registro de decisiones se alimenta del contrato canónico, no de una vista temporal. Conserva:

- identidad y tipo de decisión;
- estado actual;
- fecha de creación y última actualización;
- secuencia de transiciones;
- contexto mínimo para restaurar la propuesta;
- decisiones activas y archivo de canceladas o ejecutadas.

La aprobación deja explícitamente la transición `pending → approved`. La restauración no crea una decisión nueva ni duplica el calendario.

## Persistencia y migración

El snapshot `decisionWorkflowV1` se guarda junto al resto del estado tanto en almacenamiento local como en la sincronización remota.

Al abrir datos antiguos:

1. se importan proyectos y decisiones de deuda existentes;
2. se conserva su identidad estable cuando está disponible;
3. se deriva el estado compatible con su situación anterior;
4. se evita importar dos veces la misma decisión.

El borrado masivo pasa también por el ciclo de cancelación. Ya no elimina silenciosamente registros persistidos.

## Relación con el motor financiero

`buildProjectSchedule()` filtra el calendario por estado antes de calcular:

- aprobada o fija: entra en el flujo;
- simulada o pendiente: se muestra, pero no altera saldos;
- cancelada o ejecutada: queda fuera del horizonte futuro.

El calendario canónico de la fase 4 conserva después sus reglas de deuda suspendida, vencimiento, contrapartidas y traspasos prudentes.

## Pruebas

La suite específica valida:

- grafo de transiciones;
- rechazo de transiciones inválidas;
- idempotencia;
- auditoría ordenada;
- estados que afectan al plan;
- cancelación y restauración sin duplicados;
- migración de decisiones heredadas.

La batería acumulada termina con 41 pruebas correctas. También se verificaron en navegador la carga inicial y la navegación entre Cuadro de mandos, Simulador, Control de deuda y Asesor virtual.

## Definición de terminado

- Toda decisión tiene una identidad y un estado canónicos.
- Solo las decisiones aprobadas o fijas afectan al flujo futuro.
- Aprobar, fijar, desbloquear, ejecutar, cancelar y restaurar usan el mismo contrato.
- Los borrados individuales y masivos conservan la auditoría.
- Una restauración no duplica decisiones ni deuda objetivo.
- El estado se conserva entre sesiones y sincronización remota.
- La suite completa, la sintaxis y la navegación terminan sin regresiones.

## Siguiente fase

La fase 6 podrá sustituir los adaptadores históricos restantes por lecturas directas del estado canónico y añadir pruebas de integración de interfaz sobre un dataset financiero anonimizado.
