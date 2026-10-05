# WP-30 · Hoja de captura de compras con tarjeta — diseño

**Estado:** diseño cerrado el 5/10/2026 con las respuestas del hogar. Implementación en tres PR (§7); **PR-0, PR-1 y PR-2 hechos** (sitio en `app.js`, modelo de tarjetas y la hoja de captura). **El PR-2 cambia el §4.2 (las compras ya no son movimientos del banco): ver §11.**
**Fuente:** `ND-14` (`docs/PROPUESTA_QUINTA_AUDITORIA_2026-10-02.md`), ficha de WP-30 en `docs/PLAN_DESARROLLO_DEFINITIVO.md`, hallazgo de WP-25.
**El repositorio es público: ningún dato real del hogar aquí.** Los días de corte y de cargo de cada tarjeta se introducen en la app y viven en un almacén privado; los ejemplos de este documento son ficticios.

## 1. Qué se pide y cómo se mide

Anotar una compra con tarjeta en **≤ 8 s de mediana** (métrica `M-CAPT`), con importe, concepto, tarjeta y fecha, sin contar dos veces lo ya previsto. Hoy no hay línea base del camino actual (la ventana «Registrar gasto» de FLU-2): se mide primero, con el mismo mecanismo de tiempos del Pulso de saldos, para poder decir «de X a Y segundos».

## 2. Decisiones del hogar (5/10/2026)

1. **El pago «a cuenta de una partida» se acumula dentro de la partida**, sin crear una partida por ticket y sin rebajar la previsión del resto.
2. **Todas las compras se hacen con tarjeta de crédito** (dos tarjetas de comercio, una de ellas con titular distinto en el plan). La tarjeta liquida en un cargo único en la cuenta.
3. **Cada compra con su concepto** (no basta una lectura del «dispuesto»).
4. **El concepto es una etiqueta de la compra** (opción «a»): la previsión de caja se hace por tarjeta y fecha de cargo; un informe nuevo muestra las compras por concepto. La contabilidad por devengo completa (opción «b») queda para cuando se haga la previsión en tres capas (WP-35).
5. Cada tarjeta tiene su ciclo: **día de corte** y **regla de cargo** (día N de un mes posterior o fin de mes). Las filas del plan que reciben la liquidación son las que el hogar ya usa para esas tarjetas en Financiaciones.

## 3. Lo que dice el código (verificado leyendo `app.js` el 5/10/2026)

1. **Un real sustituye al previsto por completo.** `actualAwareInfo`: con real, `value = real`. Un real parcial deja el mes en lo gastado hasta ahora.
2. **En modo «Real manual», el mes de arranque con real vale 0** (`forwardPlanningInfo`: «incluido en saldo»). Vale para reales tecleados, que se asumen dentro del saldo; **no** vale para compras con tarjeta, que todavía no han salido de la cuenta.
3. **«Acumular» ya existe para movimientos.** `applyMovementMappingsToActuals` suma los movimientos asignados a una partida y escribe el total como real, por mes del movimiento (`transaction.month`). Sobrescribe lo que hubiera.
4. **La ventana de WP-25 crea una partida nueva por ticket** (`submitHomeQuickExpense`): no sirve para pagos que ya están en el plan.
5. **El motor diario no es un libro de eventos propio.** `canonical-daily-input.js` reparte los totales mensuales en eventos fechados, así que el arreglo va en el valor mensual de la partida.
6. **No existe el concepto de ciclo de tarjeta**, y el plan modela las tarjetas como **filas de Financiaciones** con su día de cargo (WP-08).
7. **Doble conteo latente hoy:** la captura rápida DEX1 crea un movimiento manual que no se empareja con el del extracto. Con captura diaria sería sistemático; este diseño lo evita por construcción (§4.4).

## 4. Modelo

### 4.1 Tarjeta (configuración) — hecho en el PR-1
Almacén local `card-cycles` (en la copia y la nube, como `charge-days`; `canonical-card-cycles.js`). Por tarjeta: nombre, fila de Financiaciones que recibe su liquidación, **día de corte** (1-28 o fin de mes), **meses hasta el cargo** (0-3, contados desde el mes en que cierra el ciclo), **día de cargo** (1-28 o fin de mes) y «anoto desde» (opcional). Máximo 8 tarjetas. Se edita en Plan › Partidas › «Tarjetas de crédito», junto a «Días de cargo», y la ficha enseña un ejemplo («una compra del 15/10 se carga el …») para comprobar el ciclo de un vistazo.

### 4.2 La compra es un movimiento *(sustituido en el PR-2: ver §11)*
Movimiento con `source: "captura-hoja"`, importe negativo, `date` = fecha de la compra, el concepto en `movement`, `card` = id de la tarjeta y `capturedAt` (cuándo se anotó; PR-2). Reutiliza el lote reversible («Deshacer»), la copia, la nube y la clasificación. Nunca una partida nueva por compra.
**El mes de cargo y la fila se calculan, no se guardan en el movimiento:** salen de la configuración de la tarjeta (`cycleFor`), de modo que si el hogar cambia el ciclo las compras se reasignan solas. `month` sigue siendo el mes de la compra (`date.slice(0, 7)`, como en cualquier movimiento). Esto sustituye lo previsto al principio (`valueDate` y `month` del cargo).

### 4.3 Fecha de cargo
Función pura `chargeDateFor(fechaCompra, tarjeta)`. Ejemplo ficticio: corte el día 10 y cargo el día 5 del mes siguiente al corte → una compra del 8/10 corta el 10/10 y se carga el 5/11; una del 12/10 corta el 10/11 y se carga el 5/12. Una compra va a la fila **del mes de cargo**, no a la del mes de compra.

### 4.4 Valor en la previsión y retirada por cargo
- **Antes del cargo:** una fila de tarjeta con compras vale `max(previsto, acumulado)` (`actualAwareInfo`; sin acumulado se devuelve el previsto tal cual, también si es negativo o cero). La salida de caja cae en la fecha de cargo (ya soportado por WP-08). Sin compras, todo idéntico a hoy: la prueba e2e lo comprueba día a día sobre la previsión diaria.
- **Las compras provisionales no se escriben como real:** se acumulan por «fila|mes de cargo» una vez por render (se invalida con `applicationRenderRevision`) y `applyMovementMappingsToActuals` ignora los movimientos de la hoja. Así el real sigue significando «lo que ocurrió de verdad» y no hace falta distinguir una compra provisional de un cargo.
- **Cuando llega el cargo en el extracto** (asignado a la misma fila por regla, `source` distinto de `captura-hoja`), **el cargo manda**: las compras provisionales de ese mes dejan de sumar y quedan visibles como «cubiertas por el cargo». Regla determinista, sin pareo difuso (el pareo fino es de WP-53).
- **Conciliación:** «tus compras sumaban X, el cargo fue Y, diferencia Z» (compras sin anotar, intereses o comisiones).
- **Ciclos incompletos:** un ciclo que empezó antes de la primera captura de esa tarjeta se marca «incompleto» y no se concilia; solo se ve lo acumulado como mínimo.

### 4.5 Concepto y tipo de acción
El concepto es texto libre con sugerencias (los 5 más frecuentes). Informe de compras por concepto y ciclo. Se reutiliza el eje aditivo de «tipo de acción»: la compra es gasto y la liquidación del extracto es pago de tarjeta, no gasto. **Por verificar al implementar:** que Análisis respete ese eje.

## 5. La hoja

Importe primero (teclado decimal es-ES, WP-11), concepto con sugerencias, tarjeta (recuerda la última), fecha (hoy / ayer / otra), «Guardar» y **deshacer 8 s**. La abre el botón de Registrar y el enlace de WP-25 (el Atajo de Apple Pay rellena el comercio y la tarjeta). Mide los segundos hasta guardar y guarda `capturedAt`, que hace medible «% del gasto registrado en < 48 h» del panel de uso.

## 6. Fuera de alcance

- Contabilidad por devengo / tarjeta como cuenta con saldo (opción «b»): WP-35 y WP-41.
- Pareo difuso de compras con movimientos y detección de faltas: WP-53.
- Banda de caja por días con incertidumbre: WP-16.
- Convergencia de datos cuando el Atajo abre Safari y no la app de la pantalla de inicio (hallazgo de WP-25): se prueba antes de depender del Atajo a diario.

## 7. Plan de PR

| PR | Contenido | Cambia comportamiento |
|---|---|---|
| **PR-0** (hecho) | Mover el gráfico de liquidez de Plan › Partidas de `app.js` a `partidas-ui.js`. `app.js` pasa de 37.490 a 37.396 líneas (99 de margen bajo el techo de 37.495) | No |
| **PR-1** (hecho) | Almacén `card-cycles`, `cycleFor`, valor `max(previsto, acumulado)`, el cargo manda, conciliación, ficha en Partidas. `app.js` 37.396 → 37.409 | Solo filas de tarjeta con compras (hoy ninguna): paridad exacta de la previsión sin compras |
| **PR-2** (hecho) | La hoja, almacén propio de compras, tiempos, informe por concepto, enlace de WP-25 (§11) | Sí (pantalla nueva) |

Cada PR cierra con la prueba de paridad de la previsión frente a `main` (como WP-26: 192 eventos, con y sin movimientos, y Hoy igual). Estimación: ≈ 4-5 sesiones en total.

## 8. Riesgos y verificaciones pendientes

- ~~Que un movimiento manual no altere los cuadres del libro~~ (PR-1): `captura-hoja` entra en `NON_BANK_SOURCES` del cierre; falta comprobar la continuidad del saldo del extracto (`statementFinalBalance`) con una compra sin saldo (PR-2).
- ~~Cómo se asigna `transaction.month`~~ (PR-1): es el mes de la compra; el mes de cargo se calcula, no hace falta tocarlo.
- ~~Que la retirada por cargo no deje sin contar una compra~~ (PR-1): mientras no hay real, las compras cuentan; en cuanto hay real (extracto o tecleado), manda el real.
- **PR-2:** una compra de la hoja no debe aparecer en Movimientos como «sin clasificar»; hay que asignarla a la fila de su tarjeta al crearla (sin que `applyMovementMappingsToActuals` la sume, porque la ignora por su origen).
- Con un cargo cuya fecha ya pasó y sin extracto importado, la fila sigue valiendo `max(previsto, acumulado)` hasta que llegue el real: es el mismo criterio que cualquier partida pendiente.
- Rendimiento: `actualAwareInfo` se llama decenas de miles de veces en Partidas; el valor nuevo no debe añadir trabajo por llamada (presupuesto de `p4-presupuesto-pantallas`).

## 9. Preguntas abiertas al hogar

- Confirmar en la pantalla de configuración la regla de cargo de cada tarjeta (la app admite «día N del mes M+k» y «fin de mes»).
- Si las dos tarjetas de comercio del mismo emisor se usan por igual o solo una de ellas.

## 10. Hallazgo fuera de alcance (mismo defecto, otra fila) — corregido el 5/10/2026

`applyMovementMappingsToActuals` escribe la **suma parcial** de los movimientos asignados a una partida como su real, y `actualAwareInfo` hacía que un real sustituyera al previsto. Una importación de extracto a mitad de mes dejaba «Gasto variable estimado» valiendo solo lo gastado hasta entonces, y en «Real manual» el mes de arranque con real valía 0 (`forwardPlanningInfo`). **Reproducido el 5/10/2026** en el navegador (previsto del mes 4.730 €, con un real de 200 € en la partida el mes bajaba a 3.180 € en automático y a 2.980 € en «Real manual»).

**Criterio aprobado por el hogar (5/10/2026):** solo en «Gasto variable estimado» y solo mientras el mes no ha pasado (`month.key >= openMonthCutoffKey()`): valor `max(previsto, real)`; en «Real manual», mes de arranque, `max(previsto − real, 0)`; Registrar marca «en curso»; los meses pasados sin firmar y las demás partidas, como antes. Con las mismas cifras: 4.730 € en automático y 4.530 € en «Real manual». Prueba: `tests/real-parcial-en-curso.test.cjs` y el e2e «real parcial del mes en curso».

## 11. PR-2 (5/10/2026): cambios respecto al diseño y qué se construyó

**Cambio: la compra NO es un movimiento del banco.** Al implementar la hoja se comprobó en el código que el §4.2 no se sostiene:
1. **El lote reversible no sirve para una captura diaria.** `createImportBatch` (`canonical-e5-operations.js`) guarda `beforeState`: **una foto entera del estado de la app por cada lote**. Con una compra al día, el almacén de lotes crecería sin control. Un deshacer de 8 s no necesita esa foto.
2. **El libro contaría la compra y su liquidación.** `buildReconciliation` (`canonical-ledger.js`) suma todos los movimientos de cada mes como «banco» y los compara con los reales: compras provisionales más el cargo del extracto darían una diferencia falsa. Además, los movimientos alimentan el análisis por categorías, la detección del día de cargo (WP-04/WP-08) y la continuidad del saldo; ninguna de esas cosas debe ver compras que aún no han salido de la cuenta.
3. **Dos movimientos idénticos el mismo día se fundirían en uno** (`transactionIdentity` no distingue dos cafés de 2,50 €).

**Qué se hizo:** almacén propio `card-purchases` (va en la copia y la nube) con cada compra (`id`, fecha, importe, concepto, tarjeta, `capturedAt`, segundos hasta guardar) y los tiempos de captura; `canonical-card-purchases.js` (puro) las presenta con forma de movimiento (`toMovements`) a `accruedByRowMonth` y `cyclesView`, que no cambian. Por construcción desaparecen los riesgos de §8 sobre «sin clasificar» y la continuidad del extracto: las compras no están entre los movimientos. El concepto sigue siendo una etiqueta (opción «a»); el eje de «tipo de acción» (§4.5) ya no hace falta para esto. Deshacer = quitar la compra; «Quitar» en el informe permite corregir después.

**La hoja (`captura-ui.js`, `#capturaHojaDialog`):** importe primero (teclado decimal, WP-11), concepto con los 5 habituales (los más repetidos en 120 días, con empujón a la misma franja horaria), tarjeta (la única, la última usada o la que nombra el enlace; con dos y ninguna usada, hay que elegir), fecha hoy / ayer / otra (nunca futura ni de hace más de un año) y «Guardar» como único botón de envío, así que «Hecho» del teclado guarda. Muestra cuándo se carga antes de guardar. La abre «+ Registrar gasto» (Hoy) y el enlace de WP-25, **solo si hay tarjetas**; sin ellas, la ventana de FLU-2 de siempre, y desde la hoja un enlace «Gasto sin tarjeta» lleva a ella. La ventana anterior **no se retira**.

**Medida M-CAPT:** cada captura guarda los segundos desde que se abre la hoja hasta guardar; la ventana anterior guarda los suyos (`dialogo`) para poder decir «de X a Y segundos». En Plan › Partidas › Tarjetas se ve la mediana de cada una y el «% de compras anotadas el mismo día o el siguiente» (≈ «registrado en < 48 h»). **No hay línea base hasta que el hogar use la ventana anterior y la hoja:** no se afirma ninguna cifra sin tiempos.

**Informe por concepto:** por tarjeta y ciclo (mes de cargo), compras y total por concepto, de lo más caro a lo más barato; las últimas compras con «Quitar».

**Fuera de este PR:** el `app.js` no admite más lógica (37.418 de 37.495); el Atajo de Apple Pay a diario sigue pendiente de probar la convergencia de datos entre Safari y la app de la pantalla de inicio (§6); «tipo de acción» y devengo, en WP-35.

