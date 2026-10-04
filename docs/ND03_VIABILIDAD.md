# ND-03 paso 0 — ¿Se puede aprender el día de cargo? (WP-04)

Fecha: 3 de octubre de 2026 (sesión 299). Paquete WP-04 del plan definitivo (`docs/PLAN_DESARROLLO_DEFINITIVO.md`),
prerrequisito de WP-07 (motor de fechas) y WP-08 (día de cargo por partida). **Sin importes del hogar:**
el repositorio es público.

## Pregunta

La previsión pone la mayoría de los gastos el **día 8** («estimación alisada 1-15») porque no sabe cuándo
se cobra cada partida. WP-08 dará a cada partida su día de cargo. La duda del plan era si ese día se puede
**sugerir** a partir de los movimientos importados o si solo tiene sentido que el hogar lo **declare**.

## Cambio respecto al plan: lectura en la app, no script en la consola

El plan pedía un script de solo lectura que el hogar pegara en la consola del navegador. Se ha construido
como **tarjeta de solo lectura en Ajustes › Presupuesto y operación** («Día de cargo: ¿se puede aprender?»):
se calcula sola sobre los datos reales del navegador del hogar, sin que tenga que hacer nada, y se
actualiza a medida que se importan más extractos. Motor: `canonical-charge-day-viability.js` (puro).

## Método

- Para cada **partida de gasto** y cada **mes con movimientos importados** en el que la partida tenía
  importe planificado, se busca el movimiento que la casa con **el mismo emparejamiento que ya usa la
  previsión** (`expenseTimingFromMovements`: palabras de la etiqueta + importe parecido).
- **Con histórico:** 3 meses o más con movimientos importados.
- **Fiable:** el cargo cae en el mismo día **± 1** en el **80 %** o más de esos meses. Un mes sin cargo
  encontrado **cuenta como fallo** (si no se encuentra, no se puede aprender).
- Las partidas con **regla de fin de mes** (trastero, parking, psicólogo…) no se aprenden: ya tienen fecha.
- Salida: recuentos y **porcentajes del gasto**, nunca importes.

## Resultado

- **Con los datos de demostración** (los del repositorio y del sitio público): **insuficiente**. La
  demostración no trae movimientos importados, así que ninguna partida tiene histórico.
- **Con los datos del hogar:** se lee en la propia tarjeta. No se copia aquí (repositorio público).

## Decisión para WP-08 (propuesta de Claude, sustituye a «decidir después de WP-04»)

No hace falta elegir a ciegas entre «sugerir» o «solo declarar» para todas las partidas: **WP-08 usará
este mismo motor en tiempo de ejecución** y mostrará el chip de sugerencia **solo en las partidas que
salgan «fiables»** con los datos reales de ese momento; el resto se declara (prerrellenado desde los
recurrentes de `A16-3`, como ya decía el plan). Si ninguna sale fiable, WP-08 es solo declarado, sin
código muerto: el chip simplemente no aparece. Coste marginal: casi nulo, porque el motor ya existe.

**Hecho en WP-08 (4/10/2026, `canonical-charge-days.js`):** así se construyó. Además de la propuesta
«fiable», cada partida propone el **último día en que se vio** su cargo, como ayuda para confirmar y no
para declarar; nunca se aplica sola. Los gastos repartidos por el mes no reciben propuesta.

## Pruebas

`tests/nd3-viabilidad-dia-cargo.test.cjs`: día dominante a ± 1, clasificación (fiable, variable,
insuficiente, con regla), mes sin cargo = fallo, umbral exacto del 80 %, sin importes en el resultado ni
en la tarjeta, y la recogida de observaciones en `app.js` ejecutada en un `vm`.
