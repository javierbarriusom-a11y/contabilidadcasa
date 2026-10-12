# WP-29 · Carta del mes — diseño

**Estado:** entregado como «en curso» (50 %). **Fuente:** `NHG-05` (`docs/PROPUESTA_QUINTA_AUDITORIA_2026-10-02.md`), `docs/PLAN_DESARROLLO_DEFINITIVO.md` (WP-29), `docs/PROPUESTA_SEXTA_AUDITORIA_2026-10-03.md` (P11: «lo único que las dos personas piden activamente»).
**El repositorio es público: ningún dato real del hogar aquí.** Los ejemplos son inventados.

## 1. Qué pedía el plan

Un párrafo determinista de **≤ 120 palabras** en **Cierre de mes**, con cinco huecos: (1) resultado frente a previsión, (2) mayor desviación y su causa (`PVX5`), (3) un hito, (4) una acción sugerida y (5) la calidad del dato (WP-10). Sin IA generativa. Módulo `canonical-month-letter.js`. «Hecho cuando: primera carta con el cierre de diciembre (1-3/1/2027)».

## 2. Lo que encontré al leerlo (y lo que cambia el diseño)

1. **Nadie ha dicho qué quiere que diga la carta.** La decisión D3 («¿qué esperáis?») figura **sin contestar** en `BACKLOG_UX_OLAS.md`; lo único firme es que las dos personas la piden (P11). El contenido es **mi lectura del plan**, no un deseo expreso. Hay que enseñárselo y reescribirlo.
2. **«Causa de la desviación (PVX5)» no existe como dato.** PVX5 es el árbol causal *de la previsión* (de qué se compone el flujo neto de un mes), no una explicación de por qué se gastó más en una partida. La app **no sabe por qué**. La carta **atribuye** («está en Supermercado: gasto de 742 € frente a 600 € previstos, el 75 % de la diferencia») y no inventa un motivo.
3. **«Calidad del dato (WP-10)» no encaja tal cual.** El medidor de WP-10 mira el *horizonte de previsión* (fechas conocidas, reales del mes en curso). La carta habla de **un mes ya cerrado**: lo que importa es **cuánto del mes es real** y cuánto es «previsto que nadie confirmó». Uso eso (partidas con real y su peso en importe). El «% de fechas con día conocido» de WP-10 **no entra**.
4. **Sin ningún real, «resultado frente a previsión» es una tautología.** Lo vi en la demo: «Octubre cierra con 270 €, tal como se preveía» con **0 de 8** partidas con real. El real de una partida sin real *es* el previsto. La carta lo dice («no tiene ningún real anotado: el margen que sale, 270 €, es solo el previsto») en vez de presentarlo como un resultado.

## 3. Cómo se compone (`canonical-month-letter.js`, puro)

Entrada: las partidas del mes (`previsto`, `cuenta` = el real si lo hay, `resuelta` = ese número es real), el patrimonio de este cierre frente al anterior (WP-46), las cartas ya guardadas y las partidas que se desviaron en contra el mes anterior. **Misma entrada, mismo texto**; el motor no usa DOM, red, almacenamiento ni reloj. Todo importe se escribe en **euros enteros a la española** («1.250 €») y siempre en positivo: el signo se dice con palabras («de margen», «de déficit», «mejor», «peor»).

| Hueco | Qué dice | Selector (umbrales **míos**, sin validar con el hogar) |
|---|---|---|
| 1. Resultado | «Septiembre cierra con 1.358 € de margen, 142 € peor de lo previsto.» | Resultado = ingresos − gastos con lo que cuenta cada partida. Diferencia < 1 € → «tal como se preveía». Sin ningún real → no hay «resultado» (§2.4). |
| 2. Mayor desviación | La partida con más efecto en el resultado, con previsto y real, y qué parte de la diferencia explica | Solo si se aparta **≥ 25 €** y **≥ 5 %** de su previsto y tiene real. Empates por nombre (no por orden). El «% de la diferencia» solo si va en el mismo sentido y **no la supera** (si explica más, otra la compensa y un porcentaje engañaría); si explica toda, «toda la diferencia». Sin ninguna relevante: «Ninguna partida se aparta de lo previsto de forma relevante.» |
| 3. Hito | Uno, o ninguno | En este orden: **racha** (≥ 3 cierres seguidos, mes a mes y sin huecos, igual o mejor que lo previsto, hasta 1 € de tolerancia); **máximo del patrimonio** (≥ 3 fotos completas); **deuda que baja** (≥ 50 € desde el cierre anterior); **patrimonio que sube**. Que el patrimonio **baje no es un hito** y no sale aquí. |
| 4. Acción | Una, o ninguna | **La misma partida en contra dos cierres seguidos** → «Revisa el previsto de X»; si no, **partidas sin real** («anótalas o cancélalas»); si no, **déficit** («revisa en Plan qué partidas se pueden ajustar»). |
| 5. Calidad del dato | «Se basa en 3 de 4 partidas con real (el 96 % del importe); el resto cuenta como previsto.» | **Nunca se omite.** Con menos del 70 % del importe en real añade «Tómala con cautela.» |

**Límite de 120 palabras.** Si no cabe, se recorta por prioridad: primero el **hito**, luego la **acción**, luego el **detalle de la desviación** (versión corta) y por último la calidad (versión corta). **El resultado y la calidad nunca desaparecen.** 300 casos con semilla fija (nombres de partida de 60 caracteres, con y sin patrimonio) no pasan de 120.

**Honestidad por construcción:** una prueba comprueba que **cada cifra del texto sale de la entrada** (o se deriva de ella) y que el motor es puro. Los nombres de partida se recortan a 40 caracteres y la pantalla los **escapa** (HTML) antes de pintarlos.

## 4. Dónde vive y qué guarda (`carta-mes-ui.js`)

- **Cierre, tarjeta «Carta de <mes>»**, visible con el mes abierto y cerrado:
  - **Mes abierto: borrador** con los datos de hoy («se escribe y se guarda al firmar el cierre; hasta entonces puede cambiar»). Sirve para ver, antes de firmar, qué dirá y cuánto es real.
  - **Mes firmado:** la **carta guardada al firmar**, con los datos de aquel momento. **No se reescribe** si los datos cambian después (una prueba lo comprueba).
  - **Cierre firmado antes de que existiera la carta** (si el hogar firmó alguno antes de esta versión): se enseña una **reconstruida con los datos de hoy y se dice** que no es la de aquel momento. **Pintar no escribe nada.**
  - «Cartas anteriores (N)» desplegable y botón «Copiar la carta» (texto plano).
- **Almacén `month-letters`** (≤ 36 cartas, una por mes), **en la copia de seguridad y la nube** (`BACKUP_LOCAL_STORES`). Se escribe en `closeCurrentMonthTransaction`, **después** de la foto del patrimonio (que la carta lee) y antes de guardar el estado local; un fallo de la carta **no rompe el cierre** (`try/catch`, devuelve `false`).
- **Reabrir un mes** invalida su carta vieja: no cuenta para la racha ni se lista como anterior hasta volver a firmarse (la nueva la reescribe).
- `app.js` +2 líneas (la llamada al firmar y el almacén en la copia): 37.445 de 37.495 (margen 50). `canonical-*.js`: **108** (ARQ-3, con consumidor real: `renderCierre` de `views/cierre.js` se lo pasa a `renderCartaMes`).

## 5. Lo que NO se hace, y por qué

- **No va a «Hoy».** Hoy sigue congelado hasta leer la prueba cronometrada (H-02).
- **No va al PDF del informe archivado ni a un enlace/correo.** Solo se ve en Cierre y se copia. Pegarla en el chat del hogar es el camino de hoy.
- **No hay hitos de objetivos** (E15) **ni de «deuda a cero»**: no hay historia de la que sacarlos todavía. Solo los cuatro de la tabla.
- **No explica el porqué** de una desviación (§2.2). Si el hogar quiere «por qué», tendría que anotarlo al registrar el real; hoy no existe ese campo.
- **No compara con el año anterior ni con el mes anterior** salvo en la racha y en la partida que se repite.
- **Una partida cancelada cuenta 0 y se da por resuelta**; una sin real cuenta su previsto y se dice. Cualquier otra regla de «cuenta» (p. ej. real parcial del mes en curso) viene de `planMesCollect`, no se reinterpreta.

## 6. Qué falta para subir del 50 % (y para decir «hecho»)

1. **Que el hogar lea una carta de su propio cierre y diga qué sobra, qué falta y si el tono sirve** (la de octubre, firmada tras esta versión, se guardará de verdad; saldrá con muchas partidas sin real si no se anotan antes los reales del mes). El criterio del plan es **la carta del cierre de diciembre**.
2. **Calibrar los umbrales** (25 €, 5 %, 1 €, 3 cierres, 50 €, 70 %): son míos. Con una desviación típica de 8 € en una partida el hogar puede preferir otro mínimo.
3. Decidir si hace falta **el «porqué»** (campo al anotar el real) y si la carta debe ir a **Hoy** (tras H-02) o a un correo/enlace.
4. **El 50 % sobrepuntúa** (≈ 1,25 de 2,5 sesiones): hay motor, pantalla y pruebas, pero **ninguna carta se ha leído con datos reales**.
