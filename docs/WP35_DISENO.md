# WP-35 · Previsión en tres capas e ingresos inciertos — diseño

**Estado:** entregado como «en curso» (50 %), **solo la parte de lectura**. **Fuente:** `PRV-02` y `PRV-04` (`docs/PROPUESTA_SEXTA_AUDITORIA_2026-10-03.md`), `docs/PLAN_DESARROLLO_DEFINITIVO.md` (WP-35).
**El repositorio es público: ningún dato real del hogar aquí.** Los ejemplos son inventados.

## 1. Qué pedía el plan

«Separar salidas en **comprometidas / probables / discrecionales** con el eje `movementActionTypes`; **certeza por ingreso** (confirmado · probable · incierto, con probabilidad y ventana; vacancia del local). **La cifra de Hoy solo cuenta los confirmados** (sin cambio visible en Hoy). Barras apiladas con patrón (kit de WP-28).» Es el paquete más grande de la Ola 3 (≈ 5 sesiones).

## 2. Qué se ha construido (y qué NO)

**Plan › Previsión, tarjeta plegable «Previsión en tres capas e ingresos con certeza»** (`capas-ui.js`, `capas.css`; motor puro `canonical-forecast-layers.js`; almacén `forecast-layers-data` **en la copia y la nube**):

- **Un mes a elegir** (por defecto el de hoy) leído en **tres capas de salidas** —comprometido, probable, discrecional— con una **frase** («En octubre: comprometido 2.980 €; probable 1.750 €; discrecional 0 €. Con los ingresos confirmados (5.000 €) queda un margen de 270 €.»), una **barra apilada con patrón** (liso, rayas, puntos; el estado va también en texto y en la leyenda) y la leyenda con importes y número de partidas.
- **Ingresos con certeza**: **Confirmado · Probable N % · Incierto N %**, con chip (borde discontinuo si no es seguro) y un selector por ingreso. Con alguno no seguro la tarjeta da **tres márgenes**: con lo confirmado, **contando su probabilidad** y si llegara todo.
- **Gastos: la capa de cada partida**, editable (la sugerida se puede recuperar).
- **Todo se guarda al momento**; todo es **lectura**: no cambia ninguna cifra de la previsión ni el titular de Previsión (un e2e lo comprueba) **ni Hoy**.

**NO se ha hecho (y es lo que le daba su valor a la propuesta):**
1. **«La cifra de Hoy y el reparto de nómina solo cuentan los confirmados» no está hecho.** Hoy sigue **congelado hasta H-02**, y cambiar qué ingresos entran en la previsión de caja es tocar el motor de la previsión, con riesgo propio. Queda como **PR-2**, después de leer H-02.
2. **No hay «ventana de fecha» por ingreso** ni **meses de vacío esperados** al cambiar de inquilino: solo nivel y probabilidad. La vacancia del local se declara a mano como probabilidad.
3. **No hay barra «hasta cobrar»**: la lectura es **por mes**, no por tramo hasta la próxima nómina (necesitaría fechas por partida, que el plan solo tiene a medias, WP-08).
4. **No usa el kit de gráficos de WP-28**: el kit no tiene barras apiladas y WP-28 sigue «en curso». La barra es CSS (con `role="img"` y la frase como etiqueta).
5. **No hay «una línea en Hoy»** (el plan la condicionaba a H1).

## 3. Decisiones y hallazgos (lo que hay que cuestionar)

1. **`movementActionTypes` NO clasifica partidas, clasifica movimientos del banco** (con una sugerencia que sale del bloque de la partida). Para las partidas del plan no había eje: la capa **se sugiere por el bloque** donde está la partida —**«Gastos fijos» y «Financiaciones» → comprometido**, **todo lo demás → probable**— hasta que el hogar la declara. La tarjeta dice cuántas partidas llevan capa **sugerida**. Es una heurística mía por nombre de bloque; un bloque que se llame distinto cae en «probable» (ni seguro ni decidible).
2. **«Discrecional» queda a 0 hasta que el hogar lo declare**: ninguna partida es discrecional por sí misma (el gasto variable de la demo es «probable»). La propuesta dice «lo que queda es vuestra decisión»; aquí eso es el **margen**, no una capa.
3. **La banda de «probable» solo existe con ≥ 3 meses cerrados con real** en esas partidas: ± la desviación absoluta media del total de partidas probables (real − previsto) en esos meses. Sin ellos, **no hay banda y se dice** («no invento una incertidumbre»). Con el hábito actual de anotar reales, será así durante meses.
4. **La probabilidad la teclea el hogar; el motor no la estima.** Sin declarar, un ingreso es «confirmado» (lo de siempre): **activar la tarjeta no cambia nada hasta que se declara.** La devolución de la Renta podría salir del estimador fiscal (WP-23), no se ha conectado.
5. **Una partida sin real en el mes cuenta su previsto**, y la tarjeta lo dice («Ninguna de las N partidas de este mes tiene real anotado: todo lo que ves es lo previsto» o «X de N tienen real»): el «margen» de un mes sin reales es el del plan, no un resultado.
6. **Defecto encontrado al probar (mío):** al cambiar un selector, el repintado **cerraba** las listas desplegadas (la de ingresos y la de gastos). Ahora se recuerda cuáles estaban abiertas. **El mismo defecto estaba en WP-34** («Ya revisadas» se cerraba al repintar): corregido aquí también.

## 4. El éxito del plan y lo que falta

- Éxito: **«ningún mes con margen negativo por un ingreso contado que no llegó»**. **No se puede medir todavía**: ningún ingreso está declarado como no seguro y la previsión sigue contando todos.
- Para subir del 50 %: el PR-2 (Hoy y el reparto de nómina solo con lo confirmado, tras H-02), la ventana de fecha y la vacancia del local, la barra «hasta cobrar» y el kit de WP-28 cuando tenga barras. **El 50 % sobrepuntúa mucho: lo hecho es ≈ 2 de las 5 sesiones del paquete.**
