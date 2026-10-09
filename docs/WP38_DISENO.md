# WP-38 · Plan B acordado en frío — diseño

Paquete del plan definitivo (PRV-05 + NPV-09, Ola 3, ≈ 4 sesiones). **Primera entrega el 9/10/2026**, sin dependencias del hogar. Estado: **en curso**. Lo que está hecho es el plan completo —disparador, acciones en orden, firma y palanca de recorte—; lo que **no** está hecho es lo que le da su valor de alarma: que **avise sin que nadie abra la pantalla** (§4). Por eso cuenta al 50 %, no como «hecho».

## 1. Qué hace

La tarjeta **«Plan B del hogar»**, en **Plan › Previsión**, bajo el desglose del peor mes (`contingencia-ui.js`, `contingencia.css`; motor puro `canonical-contingency-plan.js`; almacén `contingency-plan`, en la copia). Es un asistente de tres pasos:

1. **Disparador:** «si la liquidez de fin de mes queda por debajo de **[el colchón de la app | una cifra]** durante **N meses seguidos** (1-4), mirando los próximos **M meses** (3-12)». Mientras se elige dice **si con la previsión de hoy ya saltaría**.
2. **Acciones, en orden** (hasta 6, subir/bajar/quitar con «Deshacer»): **recortar el gasto variable un X % durante N meses**, **pausar el ahorro**, **usar la línea de crédito de emergencia** (importe) u **otra** (texto, sin efecto calculado).
3. **Fecha y firma:** resumen en una frase y dos nombres distintos; la fecha es la de hoy. «Guardar sin firmar» deja un borrador.

Una vez guardado, la tarjeta dice **en texto** (no solo en color) si el plan **salta**, está **en vigilancia** (hay meses por debajo pero no seguidos), **no salta** o está **incompleto**; y, si salta, enseña **lo acordado, en orden, con lo que aporta cada paso** y con cuál ya no salta. Debajo, **«¿Cuánto aguanta el colchón?»** (NPV-09): meses hasta agotar la liquidez y hasta tocar el colchón con un recorte del 0, 10, 20, 30 y 50 % del gasto variable.

**Nunca ejecuta** (A11-4): no mueve dinero, no pide el crédito, no recorta nada.

## 2. Reglas que el motor hace cumplir (con prueba)

- **Un mes suelto no dispara.** Hace falta la racha de N meses seguidos por debajo; exactamente en el umbral no es «por debajo»; dos meses salteados son «en vigilancia».
- **Un dato ausente no es un cero.** Sin colchón (con el disparador en «el colchón») o sin acciones, el plan es **incompleto**, no «va bien»; sin previsión es **«sin datos»** y dice que eso no significa que todo vaya bien; sin gasto variable en el plan, el recorte **no calcula efecto** (no pretende aportar 0 como si fuera exacto) y la palanca **no inventa porcentajes**.
- **Pausar el ahorro no sube la liquidez total.** Hallazgo de esta entrega, y cambió el diseño: el motor de previsión suma el ahorro **dentro** de la liquidez total (`totalLiquidity = cuenta corriente + ahorro`), que es la misma cifra que la fila «Colchón». Pausarlo mueve dinero de la cuenta de ahorro a la corriente, pero **el total no cambia**. Una primera versión lo contaba como dinero liberado y habría hecho creer que el plan resolvía algo que no resolvía. Ahora el paso dice «no cambia la liquidez total» y cuánto pasa a la corriente, y **solo suma** si el hogar marca que **ese ahorro sale de la liquidez** (va a un fondo o a una inversión).
- **El crédito no es dinero propio.** Suma a la liquidez, pero se marca «hay que devolverlo», con su coste estimado (interés simple, 3 meses), se acota a la línea declarada en Ajustes y, si no hay línea declarada, lo dice. Si el plan pide crédito **antes** de agotar lo propio, avisa.
- **Los pasos se acumulan** mes a mes desde el mes en que salta, y se dice con **cuál** ya no salta; si ni con todos llega, dice **cuánto falta** y que conviene revisar el plan «mejor ahora que en el mes malo».
- **La firma tiene huella.** Firman dos personas **distintas** (la misma persona dos veces no vale) y con fecha. Lo firmado es el disparador y las acciones **en su orden**; si cualquiera cambia, la firma deja de valer («Cambiado después de firmar»). Al guardar un cambio sin firmar, queda como borrador.

## 3. Dónde se aparta del plan, y por qué

| El plan decía | Lo entregado | Por qué |
|---|---|---|
| «Tarjeta en la bandeja cuando se dispara» | **No está en la bandeja de Hoy** | Hoy está congelado hasta leer H-02. Llevarlo allí es un adaptador pequeño sobre `evaluate` cuando se levante la regla |
| «Efecto de las acciones con escenarios de E13» | **Suma lineal** de cada paso a la serie de liquidez de la previsión | Los eventos de E13 solo restan o suman importes enteros (`expense`, `income-loss`…); un recorte porcentual o una pausa del ahorro no se expresan sin motor nuevo. Es una **estimación** y la pantalla lo dice. No vuelve a correr la previsión entera, así que **no captura efectos de segundo orden** (p. ej. el tope automático del ahorro cuando falta caja) |
| «Evaluación del disparador con la previsión en cada recálculo» | Se evalúa **cada vez que se pinta Plan › Previsión** | No hay vigilancia en segundo plano ni aviso fuera de esa pantalla; ver §4 |
| «Palanca de recorte como una de las acciones» | Está como acción **y** como tabla independiente | La tabla responde a «¿cuánto aguanta?» sin tener que acordar un plan |

## 4. El agujero principal: no avisa solo

Un plan B vale por el **aviso a tiempo**, y hoy el aviso solo existe si alguien abre **Plan › Previsión**. Si el mes malo llega y el hogar no entra a esa pestaña, el plan firmado **no hace nada**. Es el motivo de que el paquete siga «en curso». Hay tres vías para cerrarlo, ninguna hecha:

1. **Bandeja de Hoy** (el adaptador) — bloqueada por H-02.
2. **Recordatorio en el calendario del móvil** (WP-32): un evento «Revisar el plan B» no sabe si el disparador salta, así que sería un recordatorio periódico, no un aviso condicional.
3. **Avisar en Cierre** al firmar el mes (ya se abre cada mes): factible sin tocar Hoy y la opción que yo haría primero.

## 5. Riesgos y decisiones a cuestionar

1. **La firma es una convención, no una prueba.** Son dos nombres tecleados en el mismo dispositivo: nadie verifica que sean esas personas. Sirve para dejar constancia de «lo acordamos tal día», no como compromiso exigible. Lo que impide el sesgo del mes malo es la costumbre de leerlo, no la firma.
2. **El criterio de éxito («si se dispara, se aplica en < 48 h») no se puede medir todavía:** requiere un plan firmado **y** un mes malo real, y la app no sabe si lo acordado se hizo.
3. **La palanca usa las salidas medias de los 12 meses del plan** (`lpAverageMonthlyOutflow`: gasto, coche y refinanciaciones) y el gasto variable medio de ese horizonte. Pone un suelo, no una previsión: supone **cero ingresos**. Si el hogar ya incluye las cuotas de deuda en esas salidas, la cifra es correcta; si no, es optimista.
4. **«El colchón de la app» puede ser un mes de gasto** (el respaldo cuando no hay reserva operativa en Ajustes). Un plan B cuyo umbral es «un mes de gasto» salta tarde. La tarjeta dice cuál es y cuánto vale.
5. **La horquilla temporal manda:** con 2 meses seguidos y 6 de horizonte, un bache de 3 meses que empieza dentro de 7 no se ve. Es la configuración por defecto; se cambia en el paso 1.
6. **Pausar el ahorro, en este modelo, casi nunca ayuda al disparador.** Es correcto, pero puede sorprender: lo que sí ayuda es recortar gasto variable o pedir crédito. Si el hogar de verdad envía el ahorro a un fondo, tiene que marcarlo; la previsión de la app, en cambio, sigue contándolo como liquidez (decisión previa, no de este paquete).

## 6. Hallazgo aparte: contraste del hover de los botones primarios en oscuro (corregido el 9/10)

Midiendo la accesibilidad de la tarjeta, axe marcó un **3,9 : 1** en un botón primario (`.e19-btn-primary`) **con el puntero encima en modo oscuro**: el fondo de hover era `--e19-accent-hover` (#748296), **más claro** que el de reposo, con texto blanco. Afectaba a todos los botones primarios de la app. **Corregido en un PR propio** con un token nuevo, `--e19-accent-hover-bg` (#54657e en oscuro, 5,93 : 1; en claro, el mismo navy de siempre): en oscuro el hover oscurece, como en claro. `--e19-accent-hover` se queda para texto. Había además una prueba en este paquete que esquivaba el problema moviendo el puntero fuera; ahora hay una que mide con el puntero encima, y se comprobó que **falla con la regla antigua (3,9) y pasa con la nueva**.

## 7. Pendiente

- Aviso proactivo (Cierre, y la bandeja de Hoy tras H-02).
- Que el hogar lo use: acordar el plan (H-12, 18/12 según el plan) y ver si el umbral por defecto salta cuando debe.
- Decidir si la firma debe ser algo más que dos nombres.
- Contraste del hover primario en oscuro (§6).
