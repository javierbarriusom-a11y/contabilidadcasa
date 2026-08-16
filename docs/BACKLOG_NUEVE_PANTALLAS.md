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

**Estado de fases**: Fase 1 (Hoy) completa. Fase 2 (Escritura) completa salvo M-8c: Registrar R-1 a
R-12 hechas (R-11 se consultó y se resolvió el 15 de agosto, ver la nota bajo la tabla de la
pantalla 02); Movimientos M-1 a M-11 hechas (M-8/M-8b se construyeron el 15 de agosto, en la sesión
siguiente a M-1…M-7/M-9…M-11 — ver la nota bajo la tabla de la pantalla 03), queda M-8c (bloqueada
por Cierre); Plan · Mes P-1 a P-7 hechas (15 de agosto). Fase 3 (Deuda) arrancada el 15 de agosto:
D-1, D-2, D-3, D-4, D-5, D-6, D-7, D-8 y D-9 hechas (D-3/D-7/D-8/D-9 ya existían de un epic
anterior, reconciliadas con el backlog; D-4/D-5/D-6 se construyeron el mismo 15 de agosto, en la
sesión siguiente a D-1/D-2 — ver la nota bajo la tabla de la pantalla 05); D-10/D-11/D-13
parciales, D-2b/D-12 pendientes, D-14 choca con la decisión T-4 (bloqueada a propósito). Fases 4-7
sin empezar.

**Auditoría del 15 de agosto contra los nueve PDF de mockups (sesión de contraste, ver la nota bajo
cada tabla de pantalla)**: ninguna tarea marcada «Hecho» resultó estar completamente sin construir
— pero 17 de ellas (H-5, H-6 · R-2, R-3, R-11 · M-2, M-3, M-6, M-7, M-8 · P-1, P-2, P-3, P-4 ·
D-4, D-6, D-8, D-9) cumplían solo una parte del criterio real del PDF fuente y se recalificaron a
«Hecho (parcial, ver nota)». P-8/P-9 (matriz de Plan › Previsión, reconstruida en la sesión
anterior) se confirmaron correctas sin matices. **Prioridad 1, cerrada el 15 de agosto en la sesión
siguiente**: los dos gaps que tocaban la regla transversal 01 (una sola puerta de escritura) —
R-11 (`#visual-detail` escribía saldos sin ninguna guarda) y P-3 (las cuotas de deuda eran
editables en Plan · Mes cuando D-2 ya es su puerta canónica) — están corregidos y vuelven a
«Hecho». **Prioridad 2, cerrada el mismo 15 de agosto, misma sesión**: M-7 (checkbox «recordar»
desmarcada por defecto), D-9/D-8 (la tarjeta «Oferta en curso» aplica in situ detrás de un
checklist de cuatro requisitos, con motivo y fecha de revisión opcional que genera un recordatorio
en Hoy) y H-6 (Ingresos/Gasto previsto/Gasto real a hoy/Desviación en vez de solo cifras reales) —
ver sus notas respectivas. **Prioridad 3, cerrada por completo el 16 de agosto**: M-3 (seis chips
con recuento vivo, cuatro atajos de rango y búsqueda que también cubre el importe), D-6 (cinco
indicadores coloreados frente al Plan más veredicto en prosa), D-4 (gráfico agregado de capital vivo
mes a mes con la estrategia activa, con hito de primer contrato liquidado e intereses totales frente
a solo mínimos), H-5 (candidata de movimientos por incorporar, navegación a vista y pestaña) y P-2
(tabla única «Presupuesto de [mes]» agrupada por bloque, con subtotal y plegado) — ver sus notas
respectivas. **De la Prioridad 4 (6 tareas), cinco se cerraron el 16 de agosto en la misma
sesión**: R-2 (recuento vivo en la insignia de Importar, en vez de un «ausente» permanente), P-4
(el hover de «Usado» dice de dónde sale y cuántos movimientos lo componen), P-1 (confirmado con
Playwright que el horizonte de Previsión ya sobrevive al cambio de pestaña por diseño — la mitad
«se comparte entre las tres pestañas» no aplica hoy: Mes usa un selector de mes por diseño distinto,
no un horizonte, y Ahorro sigue sin construir), R-3 (cuenta Efectivo editable, consultada con el
usuario y resuelta como cifra informativa fuera del total de liquidez proyectada, sin rehacer el
motor de dos cuentas) y M-2/M-6 (cuenta por movimiento, consultada con el usuario y resuelta
etiquetando solo hacia delante desde el importador, con «—» en el histórico sin ese dato) — ver sus
notas respectivas. Solo queda M-8, bloqueada por depender de la pieza compartida «Historial de
versiones», que tampoco tienen R-6/Cierre — Prioridad 4 cerrada en la práctica salvo esa pieza
compartida sin construir todavía.

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
| H-5 | Decisiones abiertas | H-4 | M | Hecho (16 de agosto, ver nota) |
| H-6 | «Agosto en una línea» con señales | — | M | Hecho (15 de agosto, ver nota) |
| H-7 | Cuatro tarjetas de contexto | H-4 | L | Hecho |
| H-8 | Tira de estado global | Fase 3 · menú | M | Hecho |
| H-9 | Umbrales que pintan el aviso | Ajustes › umbrales | S | Hecho |
| H-10 | Regla de dato ausente en toda la vista | H-3, H-4 | S | Hecho |

**Auditoría del 15 de agosto contra `Hoy.pdf` (sesión de contraste con los PDFs nuevos).** H-1, H-2,
H-3, H-3b, H-4, H-7, H-8, H-9 y H-10 coinciden con precisión con el criterio del PDF — el código
está sembrado de comentarios `// H-N: ...` que citan el criterio casi palabra por palabra. Dos
tareas no:

- **H-6 (cerrado el 15 de agosto, sesión de seguimiento de la Prioridad 2)**: el criterio pide un
  bloque «Ejecución del mes en curso» con *Ingresos, Gasto previsto, Gasto real a hoy, Desviación*
  — comparación previsto-vs-real. `homeMonthAtAGlance` pintaba en su lugar Ingresos reales / Gastos
  reales / Margen del mes / Movimientos registrados: un resumen solo-de-reales, sin ninguna cifra
  prevista ni desviación. Corregido: las cuatro filas pasan a Ingresos / Gasto previsto (lee
  `plannedValueForVisualRow` del mes actual, el mismo previsto guardado que ya usa Plan › Previsión)
  / Gasto real a hoy / Desviación (`registrarMesSignedMoney`, verde si se gasta menos de lo
  previsto). El subtítulo «Ejecución del mes en curso» se añadió junto al título en `index.html`.
  Sin mes encontrado en el plan, Gasto previsto y Desviación dicen «—», no fabrican un previsto de
  0€ (regla transversal 04). Verificado con Playwright contra los datos de demostración. Pruebas
  nuevas en `tests/f1-hoy-dato-ausente.test.cjs`.
- **H-5 (cerrado el 16 de agosto, sesión de Prioridad 3)**: el criterio exigía «el primer botón sea
  primario y navegue a vista y pestaña (01 abre Registrar › Importar extracto)». Dos gaps reales:
  `homeDecisionCandidates` no tenía ningún candidato sobre movimientos sin incorporar (el ejemplo
  «01» del propio criterio), y ningún `target` navegaba más allá de la vista. `homeImportSessionCandidate`
  añade la candidata que faltaba: cuando hay un extracto a medio importar (`datosImportarSession`,
  persistido entre sesiones), nombra el fichero y cuántos movimientos piden decisión, con destino
  `datos-importar` — una clave heredada de `REGISTRAR_LEGACY_HASH_TABS`, no un id de vista real.
  `setActiveView` ya sabía traducir esa clave a «registrar» + su pestaña «import» (el mismo mecanismo
  que usan los enlaces de las heredadas), pero el guardarraíl de cada manejador de `data-home-nav`
  (pensado para no pasarle basura a `setActiveView`) la bloqueaba igual que a un id inventado.
  `homeNavTargetIsValid` sustituye ese chequeo en el manejador de clics de `#home` para aceptar
  también las claves heredadas, sin abrir una segunda forma de navegar. Verificado con Playwright de
  punta a punta: subir un CSV real en Registrar › Importar, ir a Hoy, ver la tarjeta «Movimientos por
  incorporar» y comprobar que su botón navega de vuelta a la pestaña «Importar extracto» con la
  misma sesión en curso intacta. Pruebas nuevas en `tests/h5-hoy-decision-navegacion.test.cjs`.

### 02 · Registrar — única puerta de escritura de datos reales (13 tareas · 2 grandes)

| ID | Tarea | Depende de | T | Estado |
| --- | --- | --- | --- | --- |
| R-1 | Cabecera de Registrar | — | S | Hecho |
| R-2 | Armazón de cuatro pestañas | Fase 3 · menú | M | Hecho (16 de agosto, ver nota) |
| R-3 | Pestaña Saldo de cuentas | Fase 1 | M | Hecho (16 de agosto, ver nota) |
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

**Auditoría del 15 de agosto contra `Registrar.pdf` (sesión de contraste con los PDFs nuevos).**
R-1, R-4, R-5, R-6, R-7, R-8, R-9, R-10 y R-12 coinciden con el criterio. Tres gaps reales:

- **R-11 (el más grave, cerrado el 15 de agosto en la sesión siguiente)**: el criterio dice
  literalmente «ninguna pantalla heredada puede escribir saldos ni reales». La nota de arriba
  documentó el cierre de `#registrar-mes`, pero **`#visual-detail` (Cuadro de mandos) se había
  quedado fuera y seguía sin guarda**: sus campos `visualCaixaBalance`/`visualMediolanumBalance`/
  `visualBalanceDate`/`visualBalanceMode` estaban cableados sin condición a
  `handleVisualAccountBalanceInput`/`handleVisualBalanceControlChange` →
  `setStateAccountBalances`/`saveBalanceSettings` — escritura real y persistente de saldos,
  exactamente lo que R-11 debía cerrar. Corregido con el mismo patrón que `#registrar-mes`: la
  lógica real se extrajo a `applyVisualAccountBalanceInput`/`applyVisualBalanceControlChange` (sin
  guarda — es el motor legítimo, que Registrar sigue llamando directamente), mientras que
  `handleVisualAccountBalanceInput`/`handleVisualBalanceControlChange` —lo que escuchan los propios
  campos de `#visual-detail`— quedan inertes tras `VISUAL_DETAIL_BALANCE_LEGACY_READONLY`. Los
  cuatro campos se deshabilitan siempre en `updateBalanceModeUi()` (antes solo fuera de modo
  manual) y el aviso de la pantalla («Solo lectura (R-11)») enlaza a Registrar › Saldo de cuentas.
  Verificado con Playwright: los cuatro campos aparecen `disabled`, forzar el DOM y disparar
  `change` a mano no cambia el estado, y editar desde Registrar sigue propagando el valor con
  normalidad. Pruebas: nuevo test «R-11 · `#visual-detail` deja de ser una segunda puerta de
  escritura» en `tests/r1-r4-registrar.test.cjs`, y se ajustó el test de R-3 que verificaba las
  llamadas directas de Registrar (ahora llaman a `applyVisual*`, no a `handleVisual*`).
- **R-3**: falta la cuenta Efectivo. El PDF fija como decisión validada «Efectivo se mantiene como
  cuenta editable, con su aviso de que no tiene extracto que lo respalde», y el mockup muestra tres
  filas (CaixaBank, Mediolanum, Efectivo). El modelo de datos (`accountBalancesFromState`) solo
  contempla `caixa` y `mediolanum` — no existe el concepto en ningún punto de la app.
- **R-2 (cerrado el 16 de agosto, sesión de Prioridad 4)**: el criterio pide insignia de pendientes
  en las cuatro pestañas. `registrarTabBadges()` devolvía el marcador de «ausente» de forma
  permanente para Importar y Lote, nunca un recuento. Corregido de forma distinta para cada una,
  porque su naturaleza real es distinta: **Importar** sí tiene un recuento vivo que ofrecer — los
  movimientos de la sesión de importación en curso (`datosImportarSession`) que piden decisión, el
  mismo `datosImportarCounters` que ya usaba `homeImportSessionCandidate` (H-5) — así que su insignia
  pasa a decir «N por decidir» o queda vacía sin sesión abierta. **Lote y Excel** es una acción de un
  solo paso (pegar tabla o subir Excel, importar) sin ninguna sesión que dejar a medias — no hay
  pendiente real que contar, así que se deja vacía en vez de fabricar un cero, el mismo trato que ya
  recibía «Saldo de cuentas» cuando no hay nada que avisar (regla transversal 04). Verificado con
  Playwright: sin sesión de importación abierta, ambas insignias están vacías; con una sesión con
  movimientos pendientes de decisión, Importar muestra el recuento real. Pruebas nuevas en
  `tests/r1-r4-registrar.test.cjs`; se ajustó `tests/r5-registrar-reales.test.cjs` (mismo stub nuevo).

- **R-3 (cerrado el 16 de agosto, sesión de Prioridad 4)**: faltaba la cuenta Efectivo — el mockup
  fija en su caja de decisiones validadas «Efectivo se mantiene como cuenta editable, con su aviso de
  que no tiene extracto que lo respalde», y muestra tres filas (CaixaBank, Mediolanum, Efectivo). El
  modelo de liquidez de la app solo conocía dos cuentas (`caixa`/`mediolanum`, sumadas en
  `accountBalancesFromState().total` y usadas en más de cuarenta puntos del motor de proyección) — el
  fork real era si Efectivo debía participar en ese total (rehacer el motor de proyección de dos
  cuentas) o quedar informativo. Consultado con el usuario, se eligió la lectura de menor riesgo:
  Efectivo se guarda en `balanceSettings.efectivoBalance` (mismo mecanismo persistido y sincronizado
  que ya usa `balanceSettings` para fecha/modo/saldos manuales, sin tocar el payload de sincronización
  ni el cargador de estado) como cifra puramente informativa — `accountBalancesFromState()` no la
  toca, así que el total de liquidez proyectada no cambia al editarla. Tercera fila en Registrar ›
  Saldo de cuentas, con el aviso «Efectivo no tiene extracto que lo respalde: se guarda como
  referencia y no se suma al total de liquidez proyectada». Verificado con Playwright: editar Efectivo
  no mueve el Total liquidez, el valor persiste tras recargar (localStorage), y el aviso aparece
  correctamente. Pruebas nuevas en `tests/r1-r4-registrar.test.cjs`, incluida una prueba de fuente que
  fija que `accountBalancesFromState` no referencia Efectivo (guarda de regresión del diseño
  informativo). Si más adelante se quiere que Efectivo compute en la liquidez proyectada, es una
  ampliación aparte, no esta tarea.

Pendiente, sin motivo de bloqueo: R-11 — la más urgente de las tareas restantes de Registrar por
tocar directamente la regla transversal 01 (una escritura real sigue abierta en una heredada).

### 03 · Movimientos — cola de trabajo, fuente del saldo calculado (13 tareas · 1 grande)

| ID | Tarea | Depende de | T | Estado |
| --- | --- | --- | --- | --- |
| M-1 | Vista propia en el menú | Fase 3 · menú | S | Hecho (15 de agosto) |
| M-2 | Tabla del extracto | M-1 | M | Hecho (16 de agosto, ver nota) |
| M-3 | Filtros, búsqueda y rango de fechas | M-2 | M | Hecho (16 de agosto, ver nota) |
| M-4 | Marca del movimiento sin partida | M-2 | S | Hecho |
| M-5 | Aviso de cola sin clasificar | M-3 | S | Hecho |
| M-6 | Panel de detalle | M-2 | M | Hecho (16 de agosto, ver nota) |
| M-7 | Cambio de partida con regla opcional | M-6 | M | Hecho (15 de agosto, ver nota) |
| M-8 | Selección múltiple y acción en lote | M-2, R-7 | L | Hecho (15 de agosto, ver nota) |
| M-8b | Consistencia con Registrar y el importador | M-8, R-8 | M | Hecho (15 de agosto, ver nota) |
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
de detalle es la misma regla, no una segunda forma de clasificar.

**Nota (15 de agosto, sesión siguiente): M-8 y M-8b.**

- **M-8**: casilla por fila (más «seleccionar todo» en la cabecera) y una barra de acción en lote
  (mismo componente visual `.e19-impact-bar` que ya usan Registrar/Plan/Cuadro de mandos, con su
  propio contenido). La escritura no abre una tercera puerta de clasificación: la selección solo
  decide QUÉ conceptos tocar — `movementsSelectedConceptKeys` agrupa las filas marcadas por el
  mismo `movementMappingKey` que ya usaba M-7 (una regla por concepto, no por movimiento; 40
  movimientos de 3 conceptos escriben 3 reglas), y `handleMovementsBulkApply` corre la misma
  secuencia exacta que `handleMovementReclassify` (M-7) y `applyPendingMovementMappings`
  (`movementMappings` → `applyMovementMappingsToActuals` → `buildPendingMovementMappings` →
  guardar actuals → `refreshAllSectionsAfterDataChange`). Una selección que mezcla ingresos y
  gastos no tiene una sola partida válida que ofrecer (una partida es de un tipo o del otro): se
  bloquea con el motivo explícito en vez de enseñar una lista a medias.
- **M-8b**: la sesión de importación de 4 pasos (`datosImportarSession`, R-8/R-9) no se resetea al
  navegar a otra pantalla — un usuario a medio importar que fuera a Movimientos y reclasificara en
  lote un concepto que esa sesión todavía tenía pendiente de decidir se encontraría, al volver, con
  el paso 2 pidiéndole una decisión que el lote ya había tomado. `datosImportarRefreshRowsForMappings`
  cierra ese hueco: tras cualquier escritura en `movementMappings` (M-7 o M-8) recalcula
  `prior`/`suggestion` solo en las filas de la sesión abierta cuyo concepto coincide y que el
  usuario no había decidido ya a mano en el paso 2 (nunca pisa una decisión explícita). No añade un
  «historial» de acciones nuevo (la pieza «Componente de guardado» de la tabla de piezas
  compartidas lo menciona junto a R-6/C-3b): ese mecanismo depende de Cierre (Fase 5), que no existe
  todavía, y R-6 tampoco lo tiene hoy — construirlo aquí habría sido adelantarse a una dependencia
  que ninguna otra pieza de la tabla cumple aún.

**Verificación visual con Playwright**: con tres movimientos de prueba cargados, marcar dos filas
mostró la barra de lote con «2 movimiento(s) seleccionados · 2 concepto(s) distinto(s)» y el
selector de partida deshabilitado hasta elegir una; «Seleccionar todo» amplió la selección a los
tres (dos conceptos, mismo tipo); aplicar reclasificó los tres movimientos a la partida elegida, la
barra se ocultó y la selección se vació, y el panel de «Comportamiento conciliado» (aguas abajo)
pasó de 0/0 a 3/3 conciliados con el importe correcto — confirmando que Registrar/Análisis ven el
cambio sin ningún paso adicional.

**Pruebas nuevas**: `tests/m8-m8b-movimientos-lote.test.cjs` (28 pruebas) — selección por índice
sobre la lista filtrada, agrupación por concepto, la barra de lote (oculta sin selección, tipo
mixto bloqueado, aviso de sobrescritura), seleccionar todo/cancelar, el refresco de una sesión de
importación a medias (M-8b) y la escritura real de `handleMovementsBulkApply` con la misma
secuencia que M-7. Se ajustó `tests/m1-m11-movimientos.test.cjs` (M-11: la fila ahora sí lleva un
`<input>`, la casilla de selección — la prueba pasó a comprobar que es de tipo `checkbox` y que el
importe se sigue pintando como texto, no como campo editable) y se le añadió el stub de
`datosImportarRefreshRowsForMappings` que M-7 ya invoca.

Con esto, de las 13 tareas de Movimientos solo queda M-8c, bloqueada hasta que exista Cierre
(Fase 5).

**Auditoría del 15 de agosto contra `Movimientos.pdf` (sesión de contraste con los PDFs nuevos).**
M-1, M-4, M-5, M-9, M-10 y M-11 coinciden con precisión. Gaps reales encontrados:

- **M-3 (cerrado el 16 de agosto, sesión de Prioridad 3)**: el criterio pedía seis chips con
  recuento vivo (Todos/Sin clasificar/Gastos/Ingresos/Manual/Duplicado revisado) y atajos de rango
  (Este mes/Últimos 3/Año en curso/Todo), con la búsqueda cubriendo «concepto o importe». El
  `<select>` de mes se retiró; `MOVEMENT_CHIPS` declara los seis chips como `{id, label, test(row)}`
  sobre `movementsRangeAndSearchList()` (rango + búsqueda, sin chip), de la que
  `movementsChipCounts()` deriva el recuento vivo de cada chip y `movementsFilteredList()` aplica
  además el chip activo. Los cuatro atajos de rango (`movementsRangeShortcutBounds`) escriben
  Desde/Hasta con aritmética de mes natural. La búsqueda ahora compara también contra el importe en
  texto, no solo concepto/detalle/categoría. El chip «Duplicado revisado» necesitó un campo nuevo,
  legítimo y acotado: `datosImportarIncludedTransactions` descartaba la decisión «distinto» del
  asistente de duplicados al construir los movimientos finales; ahora estampa
  `duplicateReviewed: true` en esos movimientos, el único dato que el chip lee. «Manual» es un chip
  honesto que hoy siempre cuenta 0 — no existe todavía una vía de alta manual de movimientos, así
  que no había nada que fabricar. Bug real encontrado con Playwright antes de publicar: dar a los
  chips envueltos en varias filas la misma clase de píldora de una sola fila que ya usaban los
  atajos de rango producía una mancha redondeada rota al hacer wrap — corregido dándole a
  `#movementChips` su propio `display:flex; flex-wrap:wrap` sin fondo de píldora, y dejando la
  clase de píldora compartida solo en los atajos de rango (una fila) y en el botón por chip.
  Pruebas nuevas/reescritas en `tests/m1-m11-movimientos.test.cjs` (32 pruebas en el archivo tras el
  cambio, incluida búsqueda por importe y el estampado de `duplicateReviewed`).
- **M-7 (cerrado el 15 de agosto, sesión de seguimiento de la Prioridad 2)**: el criterio exige una
  casilla «recordar para los que empiecen igual», **desmarcada por defecto**, para que aprender una
  regla sea «siempre deliberado» — reafirmado como decisión de diseño en el propio PDF. No existía
  ningún checkbox: `handleMovementReclassify` escribía siempre en `movementMappings`, sin condición.
  Corregido: `mappingForMovement` mira primero una clave de un solo movimiento
  (`transactionIdentity`) antes que la clave de concepto (`movementMappingKey`); la casilla nueva,
  desmarcada por defecto, decide cuál de las dos escribe `handleMovementReclassify` — sin marcar,
  solo reclasifica este movimiento; marcada, aprende la regla de concepto (futuros movimientos
  incluidos), igual que antes. Pruebas nuevas en `tests/m1-m11-movimientos.test.cjs`; se ajustó
  `tests/m8-m8b-movimientos-lote.test.cjs` (la llamada a `datosImportarRefreshRowsForMappings` ahora
  es condicional a que se haya marcado «recordar»).
- **M-2 / M-6 (cerradas el 16 de agosto, sesión de Prioridad 4)**: el criterio pide «concepto con
  cuenta» en la tabla y un campo «cuenta» en el panel de detalle. No existía ningún atributo de
  cuenta por movimiento en el modelo de datos, y no había forma honesta de reconstruirlo para el
  extracto histórico ya cargado — el propio importador ya declaraba en un comentario que «cuenta»
  ahí es descriptiva del fichero, no una cuenta bancaria real. Consultado con el usuario, se eligió
  etiquetar solo hacia delante: el paso 1 del asistente de Importar extracto (R-8) gana un selector
  «¿De qué cuenta es este extracto?» (CaixaBank/Mediolanum/Efectivo/sin especificar,
  `DATOS_IMPORTAR_ACCOUNTS`), y `datosImportarIncludedTransactions` estampa esa cuenta en los
  movimientos de esa tanda al incorporarlos — nunca se inventa para el resto. La tabla de
  Movimientos (M-2) gana la columna «Cuenta» junto a «Origen», y el panel de detalle (M-6) su campo
  «Cuenta»; ambos muestran «—» cuando el movimiento no la tiene, en vez de fabricar un valor (regla
  transversal 04). El CSV exportado (M-10) también la incluye, para que no diverja de lo que se ve
  en pantalla. Verificado con Playwright de punta a punta: subir un extracto CSV real, elegir
  «Mediolanum» en el paso 1, clasificar y confirmar la importación, y comprobar que la fila nueva de
  Movimientos y su panel de detalle muestran «Mediolanum» — mientras que los movimientos del extracto
  de demostración (cargados antes de que existiera esta tarea) siguen mostrando «—», sin que se les
  fabricara una cuenta que nunca declararon. Pruebas nuevas en
  `tests/r8-registrar-importar-extracto.test.cjs` (selector de cuenta, su manejador de cambio, y el
  estampado condicional) y en `tests/m1-m11-movimientos.test.cjs` (columna de tabla, campo de
  detalle, columna del CSV).
- **M-8**: el criterio exige «una sola entrada revertible del historial». Ya reconocido en la nota
  de arriba como pendiente por depender de una pieza de historial que tampoco tienen R-6/Cierre —
  la auditoría confirma que es una brecha real frente al PDF, no solo frente al backlog. Pendiente,
  bloqueada por esa pieza compartida.

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
| P-1 | Pestañas Mes / Previsión / Ahorro | Fase 3 | M | Hecho (16 de agosto, ver nota) |
| P-2 | Tabla del mes agrupada por bloques | P-1 | M | Hecho (16 de agosto, ver nota) |
| P-3 | Presupuesto editable con guardado por sesión | P-2 | M | Hecho (15 de agosto, ver nota) |
| P-4 | Gastado de solo lectura con procedencia | P-2, R-3 | S | Hecho (16 de agosto, ver nota) |
| P-5 | Techo de asignación | P-3 | S | Hecho |
| P-6 | Pie de impacto compartido con Registrar | R-7 | M | Hecho |
| P-7 | Copiar de julio | P-3, P-6 | M | Hecho |
| P-8 | Previsión mes a mes por bloque | P-1 | L | Hecho (15 de agosto, ver nota) |
| P-8b | Editar un mes cerrado con aviso | P-8, Cierre | M | Pendiente |
| P-9 | Mapa de calor de colchón | P-8 | M | Hecho (15 de agosto, ver nota) |
| P-10 | Descomposición del peor mes | P-9 | M | Pendiente |
| P-11 | Proyección de horizonte | P-8 | M | Pendiente |
| P-12 | Semáforo de ahorro | P-1 | S | Pendiente |
| P-13 | Objetivos con destino y prioridad | P-12 | M | Pendiente |
| P-14 | Sobres · columnas de arrastre y regla | Fase 6, P-3 | L | Pendiente |
| P-15 | Sobres · liquidación al cerrar | P-14, Cierre | L | Pendiente |
| P-16 | Sobres · suma con los objetivos de ahorro | P-15, P-13 | M | Pendiente |

**Nota (15 de agosto) — el mockup 2c heredado, sin relación con P-8.** Antes de que existiera este
backlog "Nueve pantallas" se detectó que `docs/E19_SISTEMA_DISENO.md` daba el mockup 2c (Previsión,
del catálogo original de 15 mockups) por «✅ Migrada (E19-5)» y `BACKLOG.md` también lo marcaba «✅»
sin matices; los dos se referían en realidad a la piel visual aplicada sobre la tabla resumen anual
heredada, no al contenido del mockup. Corregidos los dos documentos y construido el mockup 2c de
verdad en `#prevision` (heredado, fuera de `#plan`): titular en prosa sobre el mes delicado,
selector de horizonte, banda por mes con la reserva marcada, tabla mensual Ingresos/Gastos/Deuda/
Ahorro/Mínimo y panel día a día con sugerencia — detalle completo en `docs/E19_SISTEMA_DISENO.md`
§13 y pruebas en `tests/p8-prevision.test.cjs` (19 pruebas). **Esto no es P-8**: es un mockup previo
que vive en su propia pantalla heredada y se queda tal cual.

**P-8/P-9 (15 de agosto) — la matriz real, en `#plan` › pestaña Previsión.** El criterio real de
P-8 (`Backlog_Global.pdf` V4, el backlog operativo vigente para esta numeración) es: *"Una fila por
bloque y una columna por mes del horizonte. Los meses cerrados se distinguen visualmente y llevan
candado."* — una matriz de solo lectura, nada que ver con el mockup 2c de arriba. Su destino real
es la pestaña «Previsión» de `#plan`, hasta entonces un enlace de vuelta a `#prevision` (el mismo
patrón de placeholder que R-2 ya usaba con Registrar). `renderPlanPrevision()` construye esa matriz:

- **Bloques** = los mismos que ya agrupa Cuadro de mandos (`cuadroMandosSections`: Ingresos,
  Gastos fijos, Gastos variables, Financiaciones), más una fila sintética de Ahorro (`row.saving`
  del motor — no hay partidas de "ahorro" en `monthlyPlanning`) y el Resultado del mes.
- **Horizonte** 12/24/48 meses o completo, siempre desde el primer mes del plan (para que los
  meses ya cerrados entren en la ventana y se vea el candado, no solo los abiertos).
- **Previsto guardado, no borradores de sesión**: esta pestaña es de solo lectura — el previsto se
  edita en Mes (P-3) — así que lee `plannedValueForVisualRow` en vez de `cuadroMandosCellValue`
  (draft-aware), evitando además recalcular la simulación completa en cada tecla de otra pantalla.
- **P-9** añade la fila final de Colchón con `FinanceCanonicalCushion.cushionLevel` — una escala de
  **tres** niveles nueva (negativo/ajustado/holgado), más compacta que la de cuatro que ya usa el
  mapa de calor (`cushionTone`), pensada para compartirse tal cual con A-2 de Análisis cuando se
  construya (su criterio cita la misma escala). El peor mes del horizonte
  (`FinanceCanonicalCushion.worstMonthOf`) se marca tanto en Colchón como en Resultado del mes.

**Bug real atrapado en verificación visual, no en las pruebas**: `worstMonthOf` por defecto busca
el mes en el campo `detailMonthKey`, pero `renderPlanPrevision` le pasaba objetos con `key` — sin
`{ monthKeyField: "key" }` explícito, el peor mes salía vacío en silencio (0 celdas marcadas) sin
que ningún test lo notara, porque el test usaba un `worstMonthOf` de imitación en vez del módulo
real. Corregido en el código y en la prueba (que ahora importa `canonical-cushion.js` de verdad en
vez de imitarlo) — queda documentado porque es exactamente el tipo de fallo silencioso que las
pruebas debían atrapar y no atraparon a la primera.

**Pruebas nuevas**: `tests/p8-p9-plan-prevision.test.cjs` (13 pruebas) — recorte del horizonte
desde el primer mes, reparto de la simulación por mes, suma de bloques respetando filas que no
existen ese mes, Resultado (ingresos − gastos − ahorro), marcado de mes cerrado/negativo/peor mes
en una fila, candado en la cabecera, cambio de horizonte, y una prueba de integración de
`renderPlanPrevision` con el módulo real de `canonical-cushion.js`.

**Verificación visual con Playwright**: en `#plan` › Previsión con los datos de demostración, la
matriz mostró sus 7 filas (Ingresos, Gastos fijos, Gastos variables, Financiaciones, Ahorro,
Resultado del mes, Colchón), jul 26 con candado por estar cerrado, y jul 26 marcado como peor mes
en Resultado y Colchón tras el arreglo. 13/25 columnas al cambiar de 12 a 24 meses. Sin errores de
consola propios (el único aviso de red, `ERR_TUNNEL_CONNECTION_FAILED` hacia el CDN de Supabase, es
preexistente y aparece igual en `#home`).

**Auditoría del 15 de agosto contra `Plan.pdf` (sesión de contraste con los PDFs nuevos).**
Confirmado: **P-8/P-9 coinciden exactamente** con `Plan.pdf` — el criterio literal del PDF para
ambas tareas es idéntico al texto ya citado arriba, y no aparece ningún requisito visual o
estructural adicional para la matriz más allá de lo ya construido. La reconstrucción de la sesión
anterior era correcta. El resto de la pantalla sí tiene gaps reales:

- **P-2 (cerrado el 16 de agosto, sesión de Prioridad 3)**: el mockup mostraba **una sola tabla**
  «Presupuesto de [mes]» con cabeceras de sección (Gastos fijos, Variables, Deuda y ahorro) y
  **subtotal por bloque, plegable**; el código tenía dos tarjetas planas y separadas
  (Ingresos/Gastos), ambas itemizadas, sin subtotales ni plegado — «Bloque» era solo una columna de
  texto por fila. La tarjeta de Gastos se sustituye por una única tabla «Presupuesto de [mes]»,
  agrupada por los nombres de sección reales de `baseData.monthlyPlanning.sections` (Gastos fijos,
  Gastos variables, Financiaciones — no una taxonomía inventada como la del mockup, que no existe en
  el modelo de datos: no hay ninguna sección «Ahorro» separada). Cada bloque es una fila de cabecera
  propia (`planMesBlockRowHtml`) con el subtotal de previsto del bloque y un botón plegable con
  `aria-expanded`, que oculta/muestra sus filas (`handlePlanMesBlockToggle`). Ingresos se queda
  igual, sin agrupar: el mockup tampoco la itemiza dentro de la tabla de presupuesto — su previsto
  ya vive en los KPI de arriba. La columna «Bloque» por fila se retira (redundante una vez que la
  cabecera de bloque ya lo dice); la fila de solo lectura de Financiaciones (P-3) sigue intacta
  dentro del bloque «Financiaciones». Verificado con Playwright: tres bloques con sus subtotales
  reales, plegar/desplegar funcionando, cabecera de 4 columnas sin «Bloque». Pruebas nuevas en
  `tests/p1-p7-plan-mes.test.cjs`.
- **P-3 (cerrado el 15 de agosto en la sesión siguiente)**: la caja de decisiones validadas del PDF
  fija que «las cuotas de deuda se listan aquí como fila no editable, con enlace a Deuda para
  cambiarlas» (mockup: texto plano, sin input, con «3 contratos · se cambia en Deuda»).
  `planMesRowHtml` solo deshabilitaba el input si el mes estaba cerrado — no había ninguna
  excepción para las filas de Financiaciones, así que las cuotas de deuda eran editables en
  Plan · Mes, contradiciendo la puerta única de escritura (D-2 ya es esa puerta). Corregido:
  `planMesIsFinancingRowKey` identifica esas filas por su bloque («Financiaciones») y
  `planMesRowHtml` les pinta un texto de solo lectura con un enlace «Deuda» (a `#deuda-contratos`,
  cableado en `planMesTables` con el mismo patrón `data-home-nav` que ya usaba
  `registrarActualsBody`) en vez de un `<input>`; `handlePlanMesPlannedChange` lleva además su
  propia guarda, para que la escritura sea imposible incluso llamando a la función a mano. Sin
  contador de contratos en el enlace (el mockup dice «3 contratos») porque no aporta nada que el
  propio importe no diga ya — no se fabricó una cifra solo por igualar el mockup al pixel.
  Verificado con Playwright: la fila de Financiaciones no tiene `<input>`, y clicar «Deuda» navega
  de verdad a `#deuda-contratos`. Pruebas nuevas en `tests/p1-p7-plan-mes.test.cjs`: el
  reconocimiento de filas de Financiaciones, el bloqueo del manejador, el marcado de solo lectura,
  que el resto de filas sigue editable, y el cableado del enlace.
- **P-4 (cerrado el 16 de agosto, sesión de Prioridad 4)**: faltaba el hover de procedencia («al
  pasar por encima dice de dónde sale y cuántos movimientos lo componen») — la etiqueta real/previsto
  era estática, sin `title` ni recuento. `planMesUsadoMovementCount` cuenta, contra
  `baseData.transactions` del mes, los movimientos mapeados a esa fila con el mismo diccionario
  `mappingForMovement` que ya usa la detección de partida anual (`registrarMesAnnualMatch`) — no un
  segundo camino de correspondencia. `planMesUsadoTitle` construye el texto: con real y movimientos
  mapeados, «Real: N movimiento(s) de [mes]»; con real pero sin ningún movimiento mapeado (un ajuste
  a mano), lo dice explícitamente en vez de fingir un recuento; sin real, «Previsto: sin movimientos
  registrados en [mes] todavía». Verificado con Playwright contra los datos de demostración (que se
  publican sin movimientos, `transactions: []`, por privacidad): todas las filas muestran
  correctamente el aviso de previsto sin movimientos, sin errores de consola. Pruebas nuevas en
  `tests/p1-p7-plan-mes.test.cjs`.
- **P-1 (cerrado el 16 de agosto, sesión de Prioridad 4)**: el criterio dice que el horizonte «se
  comparte entre las tres pestañas y sobrevive al cambio de pestaña». Verificado con Playwright
  contra la app real (elegir 24 meses en Previsión, ir a Mes, volver a Previsión): el horizonte
  elegido y sus columnas se mantienen intactos — `planPrevisionHorizonKey` es una variable de módulo
  que solo cambia `handlePlanPrevisionHorizon`; `setPlanTab`/`renderPlanTabs` (el armazón de
  pestañas) nunca la tocan, así que sobrevive a cualquier cambio de pestaña o re-render por diseño,
  no por casualidad — fijado con una prueba nueva que comprueba justo eso. La mitad «se comparte
  entre las tres pestañas» no se extendió más allá de Previsión: Mes tiene su propio selector de un
  único mes (concepto distinto, para editar un presupuesto concreto, no para ver una ventana de
  varios meses) y Ahorro sigue siendo un enlace a su heredada sin contenido propio todavía — no había
  ningún otro consumidor real al que «compartir» el horizonte sin fabricar un control redundante.

Menor/cosmético: la pestaña se llama «Ahorro» en el código y «Ahorro y objetivos» en el PDF.
Con P-1, P-2, P-3 y P-4 cerradas, esta auditoría contra `Plan.pdf` no deja ninguna pendiente sin
motivo — lo que falta en la pantalla es lo ya descrito en las notas de fase (P-8b, P-10 a P-16,
Fase 4/6 sin empezar).

### 05 · Deuda — un dato canónico y dos vistas que lo leen (15 tareas · 3 grandes)

| ID | Tarea | Depende de | T | Estado |
| --- | --- | --- | --- | --- |
| D-1 | Pestañas Ruta / Comparar / Contratos | Fase 3 | M | Hecho (15 de agosto, ver nota) |
| D-2 | Contratos como dato canónico editable | D-1 | L | Hecho (15 de agosto) |
| D-2b | Cuadre del capital editado con la deuda viva global | D-2, Cierre | M | Pendiente (bloqueada: depende de Cierre, Fase 5, sin empezar) |
| D-3 | Orden de ataque por estrategia | D-2 | M | Hecho (ya existía, ver nota) |
| D-4 | Calendario de amortización | D-3 | L | Hecho (16 de agosto, ver nota) |
| D-5 | Ocho modos de liquidación | D-3 | L | Hecho (15 de agosto, ver nota) |
| D-6 | Comparativa plan frente a modo | D-5 | M | Hecho (16 de agosto, ver nota) |
| D-7 | Comparar no escribe nada | D-6 | S | Hecho (ya existía, ver nota) |
| D-8 | Aplicar con motivo obligatorio y revisión opcional | D-6 | M | Hecho (15 de agosto, ver nota) |
| D-9 | Comprobaciones antes de aplicar | D-8 | M | Hecho (15 de agosto, ver nota) |
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

**Auditoría del 15 de agosto contra `Deuda.pdf` (sesión de contraste con los PDFs nuevos).** D-1,
D-2, D-3, D-5 y D-7 coinciden con el criterio (incluidas las cuatro estrategias avalancha/bola de
nieve/consolidar/no-tocar, verificadas en `DEBT_STRATEGY_DEFINITIONS`, pese a que la nota de arriba
solo mencionaba dos). D-10/D-11/D-12/D-13, ya marcadas parciales/pendientes arriba, se confirman
correctas contra el PDF. Cuatro tareas marcadas «Hecho» no cumplen el criterio completo:

- **D-4 (cerrado el 16 de agosto, sesión de Prioridad 3)**: el criterio pedía «capital vivo mes a mes
  con la estrategia activa... e intereses totales frente a solo mínimos» (mockup: un gráfico
  agregado); lo construido proyectaba cada contrato solo, a propósito, sin aplicar nunca el reparto
  de la estrategia activa. `debtStrategyAggregateCalendar` añade el gráfico que faltaba encima del
  calendario por contrato ya existente: suma mes a mes el mismo calendario declarado de cada
  contrato (`debtAmortizationSchedule`, sin tocar), truncado en el mes en que la ruta activa lo
  liquida de golpe (`debtStrategyPayoffPlan` lee el `mesResuelto` real de cada decisión aplicada del
  motor de escenarios — el mismo dato que ya usaba el escalón de «Deuda viva»), más el préstamo
  nuevo de una reunificación desde el mes en que se firma. Las tres cifras que faltaban debajo del
  gráfico: primer contrato liquidado (mes + nombre), intereses totales del plan aplicado, y su
  diferencia frente a `debtAmortizationTotalInterest` (la misma suma «solo mínimos» que ya pintaba
  cada `<details>` por contrato, sin decisión alguna). Con 0 decisiones (Mín./no-tocar) el agregado
  coincide exactamente con solo mínimos por construcción, no por casualidad. Bug real encontrado con
  Playwright, no con las pruebas: una deuda sin cuota declarada solo genera una fila en
  `debtAmortizationSchedule` (por diseño, para no fingir una amortización que no ocurre) — sumarla
  tal cual la hacía desaparecer del agregado a partir del segundo mes, como si se hubiera pagado
  sola. Corregido manteniendo su saldo congelado en cada mes siguiente hasta que la ruta la liquide
  de golpe o se acabe el horizonte, con dos pruebas nuevas que fijan el caso.
- **D-6 (cerrado el 16 de agosto, sesión de Prioridad 3)**: el criterio pedía «cinco indicadores con
  diferencia coloreada... más un veredicto en prosa que nombra el supuesto principal» sobre la
  tabla de los ocho modos, que antes solo tenía 4 columnas planas sin color y reutilizaba el
  veredicto de la comparación de 4 *estrategias*, no el de los 8 *modos*. Sin mockup visual para
  fijar contra qué se colorea cada indicador, se propuso al usuario un diseño concreto antes de
  construir (`AskUserQuestion`) en vez de adivinarlo en silencio: comparar cada modo contra un
  escenario «Plan» — el motor de escenarios (`runEscenarioMotor`) corrido con cero decisiones de
  deuda, el mismo patrón que ya usaba el baseline «no-tocar» de la comparación de estrategias — y
  fue la opción elegida. La tabla ahora pinta cinco columnas por modo (mes, caja mínima coloreada
  frente al Plan, coste coloreado frente al capital vivo del contrato, cuota resultante coloreada
  frente a la cuota actual, resultado con insignia), reutilizando siempre
  `debtModeResultForContract` — el mismo cálculo que ya alimenta el panel del modo activo, nunca uno
  nuevo. `renderDeudaCompararModeInsight` añade el veredicto en prosa nombrando el modo viable con
  mejor caja mínima y el supuesto principal (Plan = cero decisiones de deuda), oculto cuando ningún
  modo es viable en vez de inventar un ganador. Pruebas nuevas en
  `tests/d4-d5-d6-deuda-calendario-modos.test.cjs` (49 pruebas en el archivo tras el cambio, con
  fixtures conocidas para las cinco columnas y el veredicto). Verificado visualmente con Playwright:
  la tabla de ocho modos pinta las cinco columnas con verde/rojo correctos y el veredicto en prosa
  aparece bajo la tabla.
- **D-8/D-9 (cerrados el 15 de agosto, sesión de seguimiento de la Prioridad 2)**: el criterio real
  no era sobre el checklist de la pestaña Ruta (comprobaba solo reserva y mes viable, dos cosas
  distintas a las cuatro del PDF) — es sobre la tarjeta «Oferta en curso», que hasta entonces solo
  enrutaba a la heredada `#debt-roadmap` para aplicar («Revisar y aplicar en Plan de deuda»), sin
  campo de fecha de revisión ni checklist propio. Reconstruida in situ:
  - **D-9**: `deudaRutaOfferChecklist` pinta los cuatro requisitos reales — oferta aceptada,
    documentos completos (`E14DebtOperations.REQUIRED_DOCUMENTS`, la misma lista que ya valida
    `prepareApplication`, no un criterio propio), reserva protegida (misma simulación que usa el
    motor de deuda) y una nota de que el motivo se pide al confirmar. El botón «Aplicar al plan»
    llama a `applyE14bOffer()` — el mismo motor que ya usaba `#debt-roadmap` (regla transversal 01),
    tras seleccionar la oferta en el workspace de E14b. Encontrado con Playwright: la deuda demo ya
    tenía una decisión aplicada previamente y el checklist salía en verde igual, con
    `applyE14bOffer()` bloqueando en silencio (su aviso vivía solo en `#e14bStatus`, dentro de
    `#debt-roadmap`, invisible desde Ruta) — corregido con un aviso explícito bajo el checklist y
    copiando el resultado de `#e14bStatus` a la propia tarjeta tras cada intento.
  - **D-8**: `requestOperationConfirmation` (el diálogo compartido de motivo, usado también por
    Escenarios y otras operaciones) gana un campo opcional de fecha de revisión, mostrado solo
    cuando el llamador pasa `allowReviewDate` — las otras cinco llamadas existentes no cambian de
    comportamiento. Si se rellena, `applyE14bOffer` la guarda en `decision.e14Application.reviewDate`
    y `homeDebtReviewReminders()` (H-5) la lee para asomar un recordatorio en Hoy («Revisar oferta
    de deuda aplicada»), en rojo si la fecha ya pasó.
  Verificado con Playwright de punta a punta: registrar una oferta en `#debt-roadmap`, ver el
  checklist en verde en `#deuda-ruta`, aplicar con motivo y fecha, y ver el recordatorio real en
  Hoy tras la confirmación. Pruebas nuevas en `tests/d8-d9-deuda-oferta-aplicar.test.cjs`; se
  reescribió `tests/v3-4-oferta-en-curso.test.cjs` (el botón ya no enruta, aplica en el sitio).

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
