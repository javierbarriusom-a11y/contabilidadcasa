# WP-30 · Hoja de captura de compras con tarjeta — diseño

**Estado:** diseño cerrado el 5/10/2026 con las respuestas del hogar. Implementación en tres PR (§7); el PR-0 (hacer sitio en `app.js`) ya está hecho.
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

### 4.1 Tarjeta (configuración)
Almacén local `card-cycles` (en la copia y la nube, como `charge-days`). Por tarjeta: nombre, fila del plan que recibe su liquidación, **día de corte** (día N o fin de mes) y **regla de cargo** (día N, número de meses de desfase respecto al corte). Se edita en Plan › Partidas, junto a «Días de cargo».

### 4.2 La compra es un movimiento
Movimiento con `source: "captura-hoja"`, importe negativo, `date` = fecha de la compra, `valueDate` = fecha de cargo, `month` = mes del cargo, el concepto en `movement`, la tarjeta, `capturedAt` (cuándo se anotó), y asignado a la fila de la tarjeta. Reutiliza el lote reversible («Deshacer»), la copia, la nube y la clasificación. Nunca una partida nueva por compra.

### 4.3 Fecha de cargo
Función pura `chargeDateFor(fechaCompra, tarjeta)`. Ejemplo ficticio: corte el día 10 y cargo el día 5 del mes siguiente al corte → una compra del 8/10 corta el 10/10 y se carga el 5/11; una del 12/10 corta el 10/11 y se carga el 5/12. Una compra va a la fila **del mes de cargo**, no a la del mes de compra.

### 4.4 Valor en la previsión y retirada por cargo
- **Antes del cargo:** una fila de tarjeta con compras vale `max(previsto, acumulado)`. La salida de caja cae en la fecha de cargo (ya soportado por WP-08). Sin compras, todo idéntico a hoy.
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
| **PR-1** | Almacén `card-cycles`, `chargeDateFor`, valor `max(previsto, acumulado)`, retirada por cargo, conciliación, configuración en Partidas | Solo filas de tarjeta con compras (hoy ninguna): paridad exacta de la previsión sin compras |
| **PR-2** | La hoja, camino de creación, tiempos, informe por concepto, enlace de WP-25 | Sí (pantalla nueva) |

Cada PR cierra con la prueba de paridad de la previsión frente a `main` (como WP-26: 192 eventos, con y sin movimientos, y Hoy igual). Estimación: ≈ 4-5 sesiones en total.

## 8. Riesgos y verificaciones pendientes

- Que un movimiento manual sin saldo no altere la continuidad del extracto ni los cuadres del libro (`NON_BANK_SOURCES` ya excluye `manual-quick-capture`; hay que añadir `captura-hoja`).
- Cómo se asigna `transaction.month` al importar (debe poder fijarse al mes de cargo).
- Que la retirada por cargo no deje sin contar una compra cuando el extracto aún no incluye el cargo (mientras no esté, las compras cuentan).
- Rendimiento: `actualAwareInfo` se llama decenas de miles de veces en Partidas; el valor nuevo no debe añadir trabajo por llamada (presupuesto de `p4-presupuesto-pantallas`).

## 9. Preguntas abiertas al hogar

- Confirmar en la pantalla de configuración la regla de cargo de cada tarjeta (la app admite «día N del mes M+k» y «fin de mes»).
- Si las dos tarjetas de comercio del mismo emisor se usan por igual o solo una de ellas.
