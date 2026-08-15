# Backlog "Nueve pantallas" — rediseño en curso

> Copia de trabajo del backlog generado el **14 de agosto de 2026** a partir de los nueve
> mockups del rediseño (Hoy, Registrar, Movimientos, Plan, Deuda, Escenarios, Análisis, Cierre,
> Laboratorio) y de `Backlog_Global.pdf` V4. Vivía solo como artifact de claude.ai; se guarda
> aquí para que el estado de las 124 tareas no dependa de un enlace externo entre sesiones.
>
> **Este documento sustituye operativamente a `BACKLOG.md`** para todo lo que se construya de
> aquí en adelante: `BACKLOG.md` sigue teniendo la numeración `V4-x` de la versión de seis
> vistas cerrada el 12 de agosto de 2026, pero el trabajo real desde el 14 de agosto (menú
> compartido, Hoy, Registrar) usa la numeración de este documento (`H-x`, `R-x`, `M-x`, `P-x`,
> `D-x`, `E-x`, `A-x`, `C-x`, `L-x`). Actualízalo al cerrar cada sesión igual que
> `BACKLOG_STATUS.md`: marca `Hecho` la fila de cada tarea cerrada, con la fecha.

Cifras de partida: 124 tareas repartidas en 9 pantallas, 27 de talla L, 7 fases de
construcción (cada una deja el producto usable), 18 pantallas heredadas (7 se adoptan, 10 se
sustituyen, 1 se descarta).

## 1. De dónde viene esto

La versión cerrada el 12 de agosto (6 vistas: Hoy, Plan, Deuda, Datos, Cierre y Ajustes,
616/616 pruebas) no se amplía: se reconstruye sobre reglas más estrictas. La versión anterior
envolvía cada pantalla heredada con una pantalla nueva al lado; esta especifica **una sola
puerta de escritura por tipo de dato**, identificadores estables, historial versionado y un
veredicto explícito para cada una de las dieciocho heredadas — **adoptada, sustituida o
descartada**, ninguna se queda en el limbo «candidata» indefinidamente.

## 2. Cuatro decisiones de arquitectura, resueltas el 14 de agosto

1. **Cuántos planes paralelos se conservan** (bloqueaba E-11b): **diez planes vivos como
   máximo**, sin cupos por familia. El usuario logado archiva versiones manualmente para
   liberar sitio (archivar no borra, regla 07). Al llegar a diez, un modal bloquea la creación
   de un undécimo y explica el motivo (regla 08).
2. **Origen de los extractos bancarios** (bloqueaba el modelo de procedencia): el importador de
   Registrar (R-8, R-9) cubre CSV y Excel por ahora. El modelo de datos deja hueco para un
   tercer origen (conexión bancaria automática, la E10 histórica) desde la Fase 1, pero el
   control que lo activaría queda **deshabilitado y en gris** hasta que se acometa A5-5/A5-6.
   Cero integración bancaria por ahora.
3. **Multiusuario y autoría** (bloqueaba C-10): **tres cuentas, mismos permisos de edición y
   acceso**, sin roles diferenciados. `A5-3 · Hogar compartido` ya implementó localmente
   invitaciones, permisos y revocación; falta activarla y probarla con las tres cuentas reales.
   El campo «autor» de C-10 se rellena con la identidad de sesión real. Entra en la Fase 1.
4. **Dónde se calcula lo caro** (bloqueaba A-4/A-5): **en cliente**. La app es una SPA
   estática sin backend propio para el libro; `A13-2` (verificado) ya midió forecast y
   escenarios con 10.000 periodos en 60,5 ms, muy por encima de los 12-24 meses que piden
   A-4/A-5. Se memoiza por mes + versión del plan, invalidando solo cuando cambien movimientos
   o plan de origen.

**Cómo se mantiene la app funcional durante el refactor**: se construye la pantalla nueva al
lado de la vieja y se corta solo cuando la nueva está probada — la misma disciplina de veinte
entregas anteriores. El matiz: la regla transversal 01 obliga a que, en el momento en que cada
fase centraliza escritura, la pantalla heredada que hoy hace ese trabajo **pierda su capacidad
de escribir** (pasa a solo lectura y redirige, no desaparece). Retirar una pantalla en uso se
consulta con el usuario aunque el CI esté en verde (`CLAUDE.md`) — el resto del flujo (validar,
commit, push, PR, fusionar) no pide permiso en cada turno.

## 3. Siete fases de construcción

| Fase | Qué entra | Condición de salida |
| --- | --- | --- |
| 1 · Cimientos | Modelo de datos, contratos y las lecturas Hoy y Movimientos en solo lectura. | Los cálculos compartidos cuadran a mano contra una hoja de cálculo. |
| 2 · Escritura | Registrar con sus cuatro pestañas, clasificación de Movimientos y la pestaña Mes de Plan. | Un mes se puede registrar completo sin salir de la aplicación. |
| 3 · Deuda | Contratos, ruta, comparador y oferta en curso con caducidad. | Aplicar una estrategia deja motivo e historial, y comparar no escribe. |
| 4 · Previsión | Previsión y Escenarios, incluido el plan paralelo al aplicar. | Un escenario guardado se reproduce mes a mes desde sus parámetros. |
| 5 · Cierre | Cierre secuencial, conciliación, auditoría e historial de versiones. | Un mes se firma con las cuatro comprobaciones y se puede reabrir con motivo. |
| 6 · Análisis y sobres | Análisis completo y sobres, detrás de bandera, incluida su liquidación en Cierre. | Con la bandera apagada todo sigue funcionando y las pantallas lo dicen. |
| 7 · Gobernanza | Ajustes, retirada de las dieciocho heredadas y del Laboratorio. | El acta queda exportada y ningún enlace antiguo se rompe. |

**Estado de fases**: Fase 1 (Hoy) completa. Fase 2 (Escritura) completa salvo el lote de
Movimientos: Registrar R-1 a R-12 hechas (R-11 se consultó y se resolvió el 15 de agosto, ver la
nota bajo la tabla de la pantalla 02); Movimientos M-1 a M-7 y M-9 a M-11 hechas, quedan M-8/M-8b
(selección múltiple y lote, sesión propia) y M-8c (bloqueada por Cierre); Plan · Mes P-1 a P-7
hechas (15 de agosto). Fase 3 (Deuda) arrancada el 15 de agosto: D-1, D-2, D-3, D-4, D-5, D-6, D-7,
D-8 y D-9 hechas (D-3/D-7/D-8/D-9 ya existían de un epic anterior, reconciliadas con el backlog;
D-4/D-5/D-6 se construyeron el mismo 15 de agosto, en la sesión siguiente a D-1/D-2 — ver la nota
bajo la tabla de la pantalla 05); D-10/D-11/D-13 parciales, D-2b/D-12 pendientes, D-14 choca con la
decisión T-4 (bloqueada a propósito). Fases 4-7 sin empezar.

## 4. Nueve reglas transversales

Aplican a las 124 tareas, no se repiten fila a fila. Una tarea que las incumple no está
terminada aunque su propio criterio se cumpla.

1. **Una sola puerta de escritura por tipo de dato.** Reales y saldos desde Registrar;
   clasificación desde Movimientos; previsto desde Plan. Ninguna pantalla escribe por su cuenta.
2. **Simular nunca escribe.** Escenarios y el comparador de Deuda calculan sobre una copia.
   Aplicar es un acto explícito, con motivo obligatorio y entrada de historial.
3. **Todo cambio explica su impacto antes de guardarse.** El pie de impacto es el mismo
   componente en Registrar y en Plan, calculado antes de confirmar.
4. **Dato ausente no es cero.** El hueco se pinta como hueco en toda la aplicación; los
   cálculos que lo encuentran degradan su fiabilidad.
5. **Toda cifra derivada dice de dónde sale.** Procedencia visible: de qué movimientos, de qué
   mes, de qué versión del plan.
6. **Identificadores estables, nunca posiciones.** Ningún registro se referencia por su índice
   en una lista.
7. **Nada se sobrescribe: se versiona.** Cierre firma versiones; las reaperturas quedan
   registradas con motivo. El historial es la única fuente de verdad.
8. **Un bloqueo siempre dice por qué.** Botón deshabilitado, paso cerrado o acción rechazada:
   la interfaz nombra la condición que falta.
9. **Umbrales y reglas son configuración.** Los límites que pintan avisos, la reserva mínima y
   las reglas de sobres se editan en Ajustes, no viven repartidas por el código.

## 5. Seis piezas compartidas

Se construyen una vez, se reutilizan en varias pantallas. Duplicarlas es la vía más rápida a
que dos pantallas digan cifras distintas del mismo dato.

| Pieza | Uso | Tareas |
| --- | --- | --- |
| Componente de guardado | Validación, escritura y entrada de historial. Cuatro pestañas de Registrar, acción en lote de Movimientos, modal de resolución de Cierre. | R-6 · M-8b · C-3b |
| Pie de impacto | Qué indicadores se mueven al confirmar un cambio, antes y después. Idéntico en Registrar y en Plan. | R-7 · P-6 |
| Saldo calculado y su cuadre | Suma de movimientos por cuenta, comparada con el saldo declarado. | M-8c · C-2 |
| Historial de versiones | Importaciones, guardados, aplicaciones de escenario, reversiones y cierres, con IDs estables. | C-9 · C-10 · C-11 |
| Aplicar con motivo | Comprobaciones previas, motivo obligatorio, revisión opcional, versión nueva. Deuda y Escenarios. | D-8 · D-9 · E-11 |
| Confianza del dato | Estado de conciliación por cuenta y cobertura de clasificación del mes. Cierre y Análisis. | C-2 · A-10 |

## 6. Backlog por pantalla

Convención de estado: `Hecho` (verificado y publicado) / `Pendiente`. `T` = talla (S/M/L).

### 01 · Hoy — la lectura del modelo, no escribe nada (11 tareas · 1 grande) — **completa**

| ID | Tarea | Depende de | T | Estado |
| --- | --- | --- | --- | --- |
| H-1 | Cabecera de Hoy | — | S | Hecho |
| H-2 | Chip de sincronización en la barra | Fase 3 · menú | S | Hecho |
| H-3 | Bloque «días hasta el siguiente ingreso» | H-1 | M | Hecho |
| H-3b | Editor de cobertura aprendida | H-3 | M | Hecho |
| H-4 | Rejilla de seis indicadores | H-1 | M | Hecho |
| H-5 | Decisiones abiertas | H-4 | M | Hecho |
| H-6 | «Agosto en una línea» con señales | — | M | Hecho |
| H-7 | Cuatro tarjetas de contexto | H-4 | L | Hecho |
| H-8 | Tira de estado global | Fase 3 · menú | M | Hecho |
| H-9 | Umbrales que pintan el aviso | Ajustes › umbrales | S | Hecho |
| H-10 | Regla de dato ausente en toda la vista | H-3, H-4 | S | Hecho |

### 02 · Registrar — única puerta de escritura de datos reales (13 tareas · 2 grandes)

| ID | Tarea | Depende de | T | Estado |
| --- | --- | --- | --- | --- |
| R-1 | Cabecera de Registrar | — | S | Hecho |
| R-2 | Armazón de cuatro pestañas | Fase 3 · menú | M | Hecho |
| R-3 | Pestaña Saldo de cuentas | Fase 1 | M | Hecho |
| R-4 | Tarjeta «qué se recalcula al guardar» | R-3 | S | Hecho |
| R-5 | Pestaña Reales del mes | R-2 | L | Hecho |
| R-6 | Una sola regla de guardado | R-3, R-5 | M | Hecho |
| R-6b | El previsto solo se edita en Plan | R-5, Plan | S | Hecho |
| R-7 | Pie de impacto | R-3, R-5 | M | Hecho |
| R-8 | Pestaña Importar extracto | R-2 | L | Hecho |
| R-9 | Pestaña Lote y Excel | R-2 | M | Hecho |
| R-10 | Redirección de los hashes antiguos | R-2 | S | Hecho (parcial, ver nota) |
| R-11 | Cierre de escritura de las heredadas | Fase 0 | M | Hecho (15 de agosto, ver nota) |
| R-12 | Distinción vacío / cero conservada | R-5 | S | Hecho |

**Nota sobre el alcance de R-10 y R-11 (resuelto el 15 de agosto)**: el criterio original de R-10
pedía redirigir los cinco hashes heredados. Se redirigieron cuatro (`#update-hub`, `#update-data`,
`#datos-importar`, `#data-entry`) — ninguno tenía una promesa de accesibilidad permanente, solo
eran el destino provisional «mientras tanto» de las pestañas de Registrar antes de que R-8/R-9 las
construyeran. `#registrar-mes` se dejó fuera a propósito: la sesión de R-5 prometió explícitamente
en `PROJECT_STATE.md` que seguiría intacta y accesible desde «Herramientas avanzadas».

Consultado con el usuario el 15 de agosto (respuesta: mantener `#registrar-mes` accesible pero de
solo lectura, cumpliendo exactamente el criterio de R-11 y la regla transversal 01 sin más). R-11
cerró dos cosas:

1. **El hueco real que R-10 dejaba en las cuatro ya redirigidas**: `setActiveView` solo aplicaba
   el mapa de redirección cuando se llegaba a través de `viewFromHash()`. Los clics del menú
   lateral y los botones `data-home-nav` llaman a `setActiveView` con el id heredado directamente
   (sin pasar por el hash primero), así que hasta ahora seguían abriendo la pantalla vieja,
   plenamente escribible. `setActiveView` normaliza ahora el id heredado explícito antes de
   decidir nada más — ninguna vía de navegación deja ya una heredada como destino final.
2. **`#registrar-mes` pasa a solo lectura**: sigue en el menú y renderiza igual, pero
   `REGISTRAR_MES_LEGACY_READONLY` deshabilita el real editable, oculta alta/baja de partidas
   personalizadas, la copia del mes anterior y el aviso «¿es anual?» (los tres escriben), y cada
   tarjeta remite a Registrar › Reales del mes con un enlace `data-home-nav`. Los siete manejadores
   de escritura llevan además su propia guarda — no solo la interfaz se esconde, la escritura es
   imposible incluso llamando a la función a mano, mismo patrón que ya usaban con el mes cerrado.

Pruebas: `tests/r11-cierre-escritura-heredadas.test.cjs` (16 pruebas nuevas); se ajustaron
`tests/r10-redireccion-hashes.test.cjs` (fuente de `setActiveView`) y
`tests/v4-3-v4-5-partida-anual.test.cjs` (el manejador del aviso anual ahora se guarda).

### 03 · Movimientos — cola de trabajo, fuente del saldo calculado (13 tareas · 1 grande)

| ID | Tarea | Depende de | T | Estado |
| --- | --- | --- | --- | --- |
| M-1 | Vista propia en el menú | Fase 3 · menú | S | Hecho (15 de agosto) |
| M-2 | Tabla del extracto | M-1 | M | Hecho |
| M-3 | Filtros, búsqueda y rango de fechas | M-2 | M | Hecho |
| M-4 | Marca del movimiento sin partida | M-2 | S | Hecho |
| M-5 | Aviso de cola sin clasificar | M-3 | S | Hecho |
| M-6 | Panel de detalle | M-2 | M | Hecho |
| M-7 | Cambio de partida con regla opcional | M-6 | M | Hecho |
| M-8 | Selección múltiple y acción en lote | M-2, R-7 | L | Pendiente |
| M-8b | Consistencia con Registrar y el importador | M-8, R-8 | M | Pendiente |
| M-8c | Saldo recalculado validado contra el declarado | M-2, Cierre | M | Pendiente (bloqueada: depende de Cierre, Fase 5, sin empezar) |
| M-9 | Totales de la vista filtrada | M-3 | S | Hecho |
| M-10 | Exportar la vista | M-3 | S | Hecho |
| M-11 | Los importes no se editan | M-2 | S | Hecho |

**Nota (15 de agosto)**: `#movements` se evolucionó en el mismo sitio en vez de construir una
pantalla nueva al lado — el enlace de menú «Movimientos» ya apuntaba aquí desde Fase 3 (T-0/H-8),
así que no había una heredada que adoptar o sustituir, solo contenido pendiente. La tarjeta de
importación por Excel y la lista de comercios que ya vivían arriba de la tabla no se tocaron. M-7
reutiliza tal cual el diccionario `movementMappings` y el camino de escritura que ya usaba
`applyPendingMovementMappings` en `#data-entry` (regla transversal 01): reclasificar desde el panel
de detalle es la misma regla, no una segunda forma de clasificar. Quedan pendientes M-8/M-8b
(selección múltiple y acción en lote, talla L, con su propia sesión) y M-8c, bloqueada hasta que
exista Cierre (Fase 5).

### 04 · Plan — Mes, Previsión y Ahorro en tres pestañas (17 tareas · 3 grandes)

**Nota (15 de agosto)**: pantalla nueva `#plan`, junto a `#cuadro-mandos` (que sigue intacta y
accesible desde «Herramientas avanzadas»), no en su lugar — mismo patrón que R-2 con `#update-data`.
El enlace de menú «Plan» pasa a apuntar a `#plan`. Solo la pestaña «Mes» tiene contenido propio
(P-1 a P-7); «Previsión» y «Ahorro» enlazan de vuelta a `#prevision`/`#savings-plan` hasta que se
construyan (P-8 en adelante, Fase 4). El previsto editable de la pestaña Mes reutiliza tal cual
`visualDraftCells`/`cuadroMandosStageCell` — el mismo borrador de sesión que ya usaba Cuadro de
mandos desde E11 (regla transversal 01): un cambio en Plan aparece también en Cuadro de mandos y en
Cambios pendientes, y «Guardar cambios»/«Descartar todo» son literalmente
`saveVisualChanges`/`discardVisualChanges`. El pie de impacto (P-6) reutiliza el componente
`.e19-impact-bar` que ya usa Registrar (R-7) y el cálculo de antes/después que ya tenía Cuadro de
mandos (`cuadroMandosImpact`), con las cuatro cifras que de verdad se mueven al editar previsto
(mínimo de liquidez del horizonte, meses bajo la reserva, liquidez al final, peor mes) — no las
cuatro de Registrar, que dependen de saldo y deuda, ajenas a un cambio de previsto.

| ID | Tarea | Depende de | T | Estado |
| --- | --- | --- | --- | --- |
| P-1 | Pestañas Mes / Previsión / Ahorro | Fase 3 | M | Hecho (solo Mes; Previsión/Ahorro enlazan a sus heredadas) |
| P-2 | Tabla del mes agrupada por bloques | P-1 | M | Hecho |
| P-3 | Presupuesto editable con guardado por sesión | P-2 | M | Hecho |
| P-4 | Gastado de solo lectura con procedencia | P-2, R-3 | S | Hecho |
| P-5 | Techo de asignación | P-3 | S | Hecho |
| P-6 | Pie de impacto compartido con Registrar | R-7 | M | Hecho |
| P-7 | Copiar de julio | P-3, P-6 | M | Hecho |
| P-8 | Previsión mes a mes por bloque | P-1 | L | Pendiente |
| P-8b | Editar un mes cerrado con aviso | P-8, Cierre | M | Pendiente |
| P-9 | Mapa de calor de colchón | P-8 | M | Pendiente |
| P-10 | Descomposición del peor mes | P-9 | M | Pendiente |
| P-11 | Proyección de horizonte | P-8 | M | Pendiente |
| P-12 | Semáforo de ahorro | P-1 | S | Pendiente |
| P-13 | Objetivos con destino y prioridad | P-12 | M | Pendiente |
| P-14 | Sobres · columnas de arrastre y regla | Fase 6, P-3 | L | Pendiente |
| P-15 | Sobres · liquidación al cerrar | P-14, Cierre | L | Pendiente |
| P-16 | Sobres · suma con los objetivos de ahorro | P-15, P-13 | M | Pendiente |

### 05 · Deuda — un dato canónico y dos vistas que lo leen (15 tareas · 3 grandes)

| ID | Tarea | Depende de | T | Estado |
| --- | --- | --- | --- | --- |
| D-1 | Pestañas Ruta / Comparar / Contratos | Fase 3 | M | Hecho (15 de agosto, ver nota) |
| D-2 | Contratos como dato canónico editable | D-1 | L | Hecho (15 de agosto) |
| D-2b | Cuadre del capital editado con la deuda viva global | D-2, Cierre | M | Pendiente (bloqueada: depende de Cierre, Fase 5, sin empezar) |
| D-3 | Orden de ataque por estrategia | D-2 | M | Hecho (ya existía, ver nota) |
| D-4 | Calendario de amortización | D-3 | L | Hecho (15 de agosto, ver nota) |
| D-5 | Ocho modos de liquidación | D-3 | L | Hecho (15 de agosto, ver nota) |
| D-6 | Comparativa plan frente a modo | D-5 | M | Hecho (15 de agosto, ver nota) |
| D-7 | Comparar no escribe nada | D-6 | S | Hecho (ya existía, ver nota) |
| D-8 | Aplicar con motivo obligatorio y revisión opcional | D-6 | M | Hecho (ya existía, ver nota) |
| D-9 | Comprobaciones antes de aplicar | D-8 | M | Hecho (ya existía, ver nota) |
| D-10 | Oferta en curso con caducidad | D-2 | M | Parcial (la tarjeta y la fecha existen; no hay aviso activo de caducidad) |
| D-11 | Coste de no decidir | D-2 | S | Parcial («no tocar» ya compara su coste; falta el coste marginal por mes de demora) |
| D-12 | Capacidad de endeudamiento | D-2 | M | Pendiente |
| D-13 | Guardar comparación como escenario | D-6, Escenarios | M | Parcial (solo existe la vía «aplicar»; falta guardar sin comprometerse) |
| D-14 | Retirar las tres heredadas de deuda | D-1, Fase 7 | S | Ver nota — contradice T-4, en principio no se completa tal cual está escrita |

**Nota (15 de agosto): D-3, D-7, D-8 y D-9 ya estaban hechas, y el backlog no lo sabía.**
`#deuda-ruta` y `#deuda-comparar` no partían de cero: llegaron ya construidas con el resto del
código el 10 de agosto (epic «V3», anterior a este backlog del 14 de agosto), y esta
reorganización las dio por "Pendiente" sin conocerlas. Antes de tocar nada se hizo una
reconciliación tarea por tarea contra el código real:

- **D-3** (`debtStrategyOrderedContracts`, `debtStrategyDecisions`, `debtStrategyResult`):
  ordena de verdad por avalancha (TAE) o bola de nieve (saldo) y construye decisiones reales
  sobre el motor de escenarios.
- **D-7**: `#deuda-comparar` lo declara en su propio subtítulo y es puramente de lectura —
  nada se escribe hasta que se pulsa aplicar.
- **D-8** (`handleEscenarioAplicarConfirm`): motivo obligatorio de verdad (sin motivo, no deja
  confirmar) y pantalla de revisión línea a línea antes de aplicar.
- **D-9** (`deudaRutaChecklist`): comprueba reserva mínima no vulnerada y que todas las
  decisiones tengan mes viable; el botón de aplicar se deshabilita si no.

**Nota (15 de agosto): D-1 y D-2.** Ruta y Comparar son dos `view-section` completas y
existentes, no una heredada que absorber — se enlazan como pestañas (`e19-registrar-tab`,
reutilizada tal cual de Registrar/Plan) sin fusionar su DOM ni tocar una sola línea de lo que
ya funcionaba (los tests V3-3/V3-4/V3-5/V1-3/V6 siguen intactos y en verde). Contratos
(`#deuda-contratos`) es la única de las tres construida desde cero: la primera puerta de
escritura real de `DEBT_PORTFOLIO`, que hasta ahora era una constante del código sin ningún
mecanismo para corregirla. `debtContractOverrides` guarda solo capital pendiente, TAE y cuota
por contrato (persistido como `movementMappings`/`rowLabelOverrides`, incluido en el payload de
sincronización remota) y se combina con `DEBT_PORTFOLIO` en `debtContractBundle()` — el único
punto por el que ya pasaban Ruta, Comparar, Hoy y el motor de escenarios, así que todos ven el
valor corregido sin que nadie tenga que avisarlos. Vaciar una celda no escribe un cero: borra
el ajuste y vuelve al valor declarado (regla transversal 04).

**Nota (15 de agosto, sesión siguiente): D-4, D-5 y D-6.** Las tres tareas de talla L/M que la
sesión anterior había dejado aparcadas a propósito («para su propia sesión»).

- **D-5** (`DEBT_MODE_DEFINITIONS`, `debtModeDecisionForContract`) no reimplementa un motor de
  liquidación nuevo: los ocho modos heredados de `#debt-control` (`debtModeLabel`) resultan ser
  exactamente los cuatro tipos de decisión de deuda de un solo contrato que
  `canonical-scenario-engine.js` ya resolvía (`amortizacion`, `amortizacion_fraccionada`,
  `refinanciacion`, `retomar_pagos` — ya usados por `ESCENARIO_MOTOR_TYPES`, el catálogo de la
  Escenarios heredada) cruzados con las dos planificaciones que el motor ya sabía resolver
  (`planificacion.modo`: óptimo busca el primer mes viable, manual usa el mes elegido). Migrar
  fue exponer ese cruce en Deuda › Comparar, no construir cálculo nuevo — mismos `params()`/
  `mes()`/`titulo()` del catálogo real, con el interruptor óptimo/manual que ese catálogo no
  ofrecía. La única cifra que se sugiere sola es la cuota de refinanciación (con TIN y plazo ya
  escritos), por la misma fórmula francesa que ya usaba «Consolidar»
  (`debtConsolidationMonthlyPayment`); el resto de campos parte del contrato y nunca de un cero
  inventado — sin TIN ni plazo, «Refinanciación» se queda sin cifras a propósito, igual que
  «Consolidar» sin oferta.
- **D-6** (`renderDeudaCompararModes`) compara los ocho modos a la vez sobre el contrato elegido
  en una tabla, reutilizando el mismo `debtModeResultForContract` que alimenta el panel del modo
  activo — nunca un cálculo distinto según desde dónde se mire. «Retomar pagos» sobre un contrato
  que no está suspendido no se oculta ni se envía en silencio al motor: se dice explícitamente
  «solo aplica a una deuda con los pagos suspendidos», la misma regla que ya usaba `#debt-control`
  (retomar exige `paymentStatus === "suspended"`).
- **D-4** (`debtAmortizationSchedule`, `renderDeudaRutaCalendar`) es de solo lectura y deliberadamente
  independiente de las decisiones de una ruta: proyecta el calendario declarado de cada contrato
  (TAE + cuota, amortización francesa mes a mes), en el mismo orden de ataque que la pestaña activa
  de Ruta. Responde a la limitación que la propia pantalla ya declaraba en su gráfico de «Deuda
  viva» («no es un calendario de amortización mes a mes»). Nunca aproxima en silencio: si la cuota
  no cubre ni el interés lo dice, si el horizonte se acaba antes de saldo cero lo dice, y una deuda
  sin cuota declarada (dos de los tres contratos de la cartera demo tienen `currentPayment: 0`) lo
  distingue de una cuota simplemente insuficiente.

**Verificación visual con Playwright**: en `#deuda-comparar`, cambiar el modo a «Refinanciación
con inicio óptimo» mostró los cuatro campos nuevos (principal, cuota, TIN, plazo) y la nota «Faltan
datos para simular este modo»; la comparativa de los ocho modos pintó sus ocho filas, con las dos
de refinanciación sin cifras hasta rellenar TIN y plazo. En `#deuda-ruta`, el nuevo «Calendario de
amortización» mostró un `<details>` por contrato en el orden de la pestaña Avalancha activa,
correctamente distinguiendo la reunificación sintética (saldada en un mes concreto, con su interés
total) de las dos deudas demo sin cuota declarada («sin cuota declarada: no hay calendario que
proyectar»).

**Pruebas nuevas**: `tests/d4-d5-d6-deuda-calendario-modos.test.cjs` (42 pruebas) — catálogo de los
ocho modos, construcción de la decisión por modo (con validación real contra
`canonical-scenario-schema.js` y resolución real contra `canonical-scenario-engine.js`), la
sugerencia de cuota de refinanciación, la comparativa de los ocho, la amortización francesa
(incluida cuota insuficiente, sin TAE, horizonte agotado, tope de 600 filas) y el pintado del
calendario.

**Quedan pendientes, con motivo explícito:**
- **D-2b** — bloqueada hasta que exista Cierre (Fase 5), igual que M-8c.
- **D-10** (aviso activo de caducidad de una oferta), **D-11** (coste marginal por mes de
  demora) y **D-13** (guardar la comparación sin comprometerse a aplicar) — ampliaciones
  concretas sobre lo que ya existe, no bloqueadas por nada, solo fuera del alcance pedido esta
  sesión.
- **D-12** (capacidad de endeudamiento) — no hay todavía una cifra de ingreso mensual del hogar
  reutilizable para un ratio de endeudamiento defendible; se deja para no inventar una fórmula
  sin una fuente canónica detrás.
- **D-14**, tal como está escrita («retirar»), choca con una decisión de producto ya tomada: T-4
  (retirar de verdad una heredada, no solo relegarla) sigue bloqueada a propósito en
  `PROJECT_STATE.md` — "conviene esperar datos de uso... en vez de decidirlo por intuición". Las
  tres heredadas de Deuda ya están relegadas a «Versiones anteriores» desde el 10 de agosto
  (V3-5), que es el mismo trato que ha recibido cada heredada migrada del inventario hasta
  ahora (V1-4, V2-8, V4-6, V5-3, R-11). Mientras T-4 siga bloqueada, D-14 no se completa en su
  sentido literal — habría que reabrir esa decisión con el usuario explícitamente, no darla por
  hecha aquí.

Pruebas: `tests/d1-d2-deuda-tabs-contratos.test.cjs` (31 pruebas nuevas); se ajustó
`tests/navigation-structure.test.cjs` (el menú avanzado gana un enlace).

### 06 · Escenarios — simulación pura, no toca el plan (17 tareas · 4 grandes)

| ID | Tarea | Depende de | T | Estado |
| --- | --- | --- | --- | --- |
| E-1 | Once tipos de decisión en dos familias | Fase 3 | L | Pendiente |
| E-1b | Tipos propios definidos por el usuario | E-1, E-5 | L | Pendiente |
| E-2 | Formulario de parámetros por tipo | E-1 | L | Pendiente |
| E-3 | Comparativa de seis indicadores | E-2 | M | Pendiente |
| E-4 | El plan no se mueve al simular | E-3, D-7 | S | Pendiente |
| E-5 | Validación contra contrato con estado visible | E-3 | M | Pendiente |
| E-6 | Rechazo con motivo | E-5 | M | Pendiente |
| E-6b | Guardar un rechazado como aviso | E-6, E-10 | M | Pendiente |
| E-7 | Veredicto en prosa con la palanca | E-3 | M | Pendiente |
| E-8 | Banda de doce meses por cuenta | E-3 | M | Pendiente |
| E-9 | Vista familiar como pantalla aparte | E-3 | M | Pendiente |
| E-10 | Guardar escenario reproducible | E-2 | M | Pendiente |
| E-11 | Aplicar con motivo y revisión opcional | D-8 | M | Pendiente |
| E-11b | Aplicar crea un plan paralelo, no sobrescribe | E-11, Cierre | L | Pendiente |
| E-12 | Comparar dos escenarios guardados | E-10 | M | Pendiente |
| E-13 | Caducidad de escenarios con oferta | E-10, D-10 | S | Pendiente |
| E-14 | Retirar las tres heredadas de simulación | E-1, Fase 7 | S | Pendiente |

### 07 · Análisis — sección ejecutiva, solo lectura con procedencia (13 tareas · 4 grandes)

| ID | Tarea | Depende de | T | Estado |
| --- | --- | --- | --- | --- |
| A-1 | Pantalla de solo lectura con procedencia | Fase 5 | M | Pendiente |
| A-2 | Banda de doce meses de colchón | A-1, P-9 | M | Pendiente |
| A-3 | Peor mes explicado | A-2, E-2 | M | Pendiente |
| A-4 | Cascada del resultado por periodo | A-1, Cierre | L | Pendiente |
| A-5 | Patrimonio neto proyectado | A-1, D-2 | L | Pendiente |
| A-6 | Selector de ventana | A-2, A-5 | S | Pendiente |
| A-7 | ¿Acierta el plan? | A-1, Cierre | L | Pendiente |
| A-8 | En qué se va · reparto completo del ingreso | A-1 | M | Pendiente |
| A-9 | Qué se repite | A-1, M-3 | M | Pendiente |
| A-10 | Confianza del dato | A-1, Cierre | M | Pendiente |
| A-11 | Exportar en CSV y en PDF | A-1 | M | Pendiente |
| A-12 | Retirar las heredadas visuales | A-1, Fase 7 | S | Pendiente |
| A-13 | Actuar desde el aviso, sin duplicar el camino | A-9, A-10, M-8 | L | Pendiente |

### 08 · Cierre — ritual secuencial de cuatro pasos (15 tareas · 7 grandes)

| ID | Tarea | Depende de | T | Estado |
| --- | --- | --- | --- | --- |
| C-1 | Cierre como secuencia SECUENCIAL de cuatro pasos | Fase 5 | L | Pendiente |
| C-2 | Conciliación cuenta por cuenta | C-1, M-8c | L | Pendiente |
| C-3 | Tareas agrupadas por causa | C-1 | M | Pendiente |
| C-3b | Modal de resolución con dos salidas | C-3, M-8b | L | Pendiente |
| C-4 | Resolver no corrige por sí solo | C-3 | M | Pendiente |
| C-5 | Requisitos de firma visibles | C-2, C-3 | M | Pendiente |
| C-6 | Liquidación de sobres como asientos | P-15 | L | Pendiente |
| C-7 | Ningún sobre se cubre en silencio | C-6 | M | Pendiente |
| C-8 | Efectos de firmar escritos antes | C-1 | S | Pendiente |
| C-9 | Inventario canónico con IDs estables | C-1 | L | Pendiente |
| C-10 | Historial de versiones | C-9 | L | Pendiente |
| C-11 | Reapertura registrada y notificada | C-10, A-7, A-10 | L | Pendiente |
| C-12 | Descargar evidencia en PDF y CSV | C-5 | M | Pendiente |
| C-13 | El cierre alimenta el aprendizaje | C-5, A-7 | M | Pendiente |
| C-14 | Retirar las dos heredadas de conciliación | C-9, Fase 7 | S | Pendiente |

### 09 · Laboratorio — deuda de transición con fecha de caducidad, vive en Ajustes (10 tareas · 2 grandes)

| ID | Tarea | Depende de | T | Estado |
| --- | --- | --- | --- | --- |
| L-1 | Tres veredictos cerrados, ninguno abierto | Fase 7 | S | Pendiente |
| L-2 | Adoptada exige tarea de backlog | L-1 | M | Pendiente |
| L-3 | Panel de detalle por heredada | L-1 | M | Pendiente |
| L-4 | Instantánea fechada del último cierre | C-5 | L | Pendiente |
| L-5 | Escritura imposible, no solo escondida | L-4, C-10 | L | Pendiente |
| L-6 | Vista de lista con los destinos | L-1 | S | Pendiente |
| L-7 | Acta exportable del Laboratorio | L-2 | S | Pendiente |
| L-8 | Laboratorio vive dentro de Ajustes | AJ-1 | S | Pendiente |
| L-9 | Retirada al cerrar la fase 7 | L-7, Fase 7 | M | Pendiente |
| L-10 | Sin rutas colgando tras la retirada | L-9 | M | Pendiente |

## 7. Seis ideas adicionales (no bloquean ninguna fase)

Costuras entre pantallas que los mockups no cubren porque cada uno se diseñó por separado.
Ninguna fabrica un cálculo nuevo ni contradice una decisión de producto ya tomada.

1. **Aviso de versión nueva del Service Worker** — un mensaje discreto («Hay una versión
   nueva. Recargar para verla») cuando el Service Worker detecte un `CACHE_NAME` más reciente
   esperando activarse. Evita repetir la falsa alarma de caché de la sesión del 12 de agosto.
2. **Una sola redacción para «reserva bajo mínimo»** — D-9, E-5 y P-5 comprueban la misma
   condición por separado; un microcopy único evita que cada pantalla la nombre distinto.
3. **Estado vacío compartido para «sin nada que mostrar»** — mismo componente de estado vacío
   (qué falta, por qué, único paso siguiente) para Deuda, Escenarios, Análisis y Laboratorio.
4. **Guardar con Cmd/Ctrl+S en Registrar y Plan** — casi gratis una vez existe el componente de
   guardado único de R-6/P-6.
5. **Misma plantilla de exportación en los tres PDF** (A-11, C-12, L-7) — cabecera y pie
   comunes: logo textual, fecha, versión del plan, numeración de página.
6. **Foco visible al entrar en modo edición de celda** — anillo de foco explícito en M-8 y P-3,
   las dos tablas más densas del rediseño.

## 8. Fuentes

9 mockups del rediseño (Hoy, Registrar, Movimientos, Plan, Deuda, Escenarios, Análisis, Cierre,
Laboratorio) · `Backlog_Global.pdf` V4, 14 de agosto de 2026 · `CIERREBACKLOG20260812.md`.
