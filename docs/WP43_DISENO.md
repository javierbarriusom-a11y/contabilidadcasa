# WP-43 · Puente de previsión — diseño

Paquete del plan definitivo (PRV-01, Ola 3, ≈ 2,5 sesiones). **Primera entrega el 10/10/2026; segunda (aviso en Cierre) el 13/10/2026.** Estado: **en curso**. Está el congelado en cada cierre, la cascada entre dos cierres (que cuadra siempre), la frase, la tabla equivalente y el aviso en Cierre; **faltan la barra «mercado» y el toque en una barra para ver las partidas que la explican** (§3), y **no se ha visto con un cierre real**: el primer puente solo puede existir con el segundo cierre del año (diciembre; el de octubre es el primero).

## 1. Qué hace

La tarjeta **«Puente de previsión: por qué cambió el fin de año»** en **Plan › Previsión**, bajo el plan B (`puente-ui.js`, `puente.css`; motor puro `canonical-forecast-bridge.js`; almacén `forecast-bridge-snapshots`, en la copia):

- **En cada cierre firmado** la app **congela cuánto preveía para el 31/12**: por cada mes que queda hasta diciembre guarda ingresos, gasto recurrente, extraordinarios y deuda, y la liquidez de fin de año; más el **real del mes cerrado** (ingresos, gasto fijo y variable, financiaciones) cuando lo hay. Es una foto pequeña (hasta 36 cierres). Un cierre de diciembre apunta al diciembre siguiente.
- **Con dos cierres del mismo año** compara las dos previsiones y reparte la diferencia en cinco barras: **ingresos, gasto recurrente, extraordinarios, deuda y financiaciones, y «otros y supuestos»**. La frase es del estilo de la del plan: «Desde septiembre, el fin de 2026 empeora en 1.300 € (10 %): 77 % por extraordinarios, 23 % entre gasto recurrente, ingresos y otros y supuestos; compensado en parte por +200 € de ingresos». Marca como **relevante** un cambio de al menos el 5 % del fin de año anterior.
- Se puede **elegir con qué cierre anterior comparar**. Hay una **tabla equivalente** («Ver como tabla») y las barras reutilizan las de A-4 (`analisisCascadaHtml`), con el color según el **efecto** sobre el fin de año y el signo (+/−) en texto.

No modifica la previsión (A11-4): una prueba comprueba que su huella no cambia.

## 2. Reglas del motor, con prueba (`tests/wp43-puente-prevision.test.cjs`, 14 pruebas)

- **La cascada cuadra SIEMPRE con la diferencia total.** Lo que el modelo no sabe atribuir (y el redondeo) va a **«Otros y supuestos»**, a la vista, nunca repartido a ojo.
- **Lo ocurrido en el mes cerrado exige su real.** La liquidez real al cerrar frente a la que esperaba la previsión anterior se reparte entre ingresos, gasto y deuda con el real del mes; **lo que el real no explica queda en «Otros»**, y sin real, todo ese tramo va a «Otros» con un aviso.
- **Dos fines de año distintos no se comparan**, ni un cierre anterior contra uno posterior.
- **Entre dos cierres no consecutivos** avisa de que lo ocurrido en los meses intermedios va a «Otros».
- **La frase nombra las causas que pesan al menos el 15 %** de lo que mueve en esa dirección y agrupa el resto (los porcentajes llegan a 100), y dice lo que compensa en sentido contrario.
- **«Mercado» no aparece**: la previsión de liquidez no proyecta la cartera, y una barra a cero sería inventada. Se dice en una nota.
- Motor puro: sin DOM, red, almacenamiento ni reloj.

## 3. Dónde se aparta del plan, y por qué

| El plan decía | Lo entregado | Por qué |
|---|---|---|
| Cinco barras: ingresos, gasto recurrente, extraordinarios, **mercado (cartera)**, deuda/supuestos | Cinco barras con **«otros y supuestos» en lugar de mercado** | La previsión de liquidez no proyecta la cartera; el patrimonio proyectado es WP-46 (pendiente). Con WP-46 la barra de mercado tendrá sentido |
| «Toque en una barra → lista de partidas que la explican» | **No está**; sí la tabla alternativa | Pedir la partida exige guardar el detalle por partida en cada foto (hoy se guarda por componente). Es el siguiente paso natural |
| «Congelar la previsión de liquidez **y patrimonio**» | Solo **liquidez** | Lo mismo que arriba |
| Reutiliza `netWorthWaterfall` | **No** (sí `analisisCascadaHtml`) | `netWorthWaterfall` es una cascada de patrimonio mes a mes sobre flujos históricos, no una conciliación entre dos previsiones |
| Éxito: explicar cada cambio > 5 % del **ahorro anual previsto** | El umbral relevante es el 5 % del **fin de año anterior** | El ahorro anual previsto no existe como cifra única en la foto. Decisión mía |

## 4. Riesgos y decisiones a cuestionar

1. **Solo congela si el cierre se firma desde la app con sesión iniciada** (el cierre exige nube); si el hogar cierra de otro modo, no hay foto y no hay puente. Es la misma ruta que ya sigue WP-09, pero un cierre sin foto es un puente que no sale **sin avisar**.
2. **«Otros y supuestos» puede ser grande.** Cualquier diferencia entre el real tecleado y la previsión que no sea ingresos, gasto o deuda (un traspaso, un saldo mal tecleado, intereses, ahorro con objetivo) acaba ahí. Una barra «otros» grande no es un fallo del puente: es la medida de cuánto de la previsión no se sabe explicar. Pero si siempre domina, el puente no cumple su función.
3. **Los bloques del plan no coinciden exactamente con los componentes de la previsión.** El real de «Gastos fijos + variables» se compara con el recurrente **más** extraordinarios previstos del mes cerrado, y «Financiaciones» con coche + refinanciación. Si un hogar clasifica distinto, la diferencia se va a «otros».
4. **El real del mes cerrado mezcla real y previsto** («Usado» = real si existe, previsto si no): con partidas sin real, el real parece más cerca de lo previsto de lo que está. Se avisa cuando es parcial.
5. **El 5 % de relevancia es mío.** Con liquidez alta, un cambio de miles de euros puede ser «pequeño» según este criterio.
6. **Las cifras de la cascada van en tinta** (no en verde/rojo): el verde de A-4 (`is-positivo`) daba 3,49 : 1 en claro. **Eso era un fallo previo de contraste en Análisis**, que ninguna prueba axe recorría con valores positivos. **Corregido el 13/10** (ver §6).

## 5. Pendiente

- Barra de **mercado** y foto de patrimonio, con la proyección de WP-46.
- **Toque en una barra → partidas** (foto con detalle por partida).
- **Aviso en Hoy**, tras H-02 (en Cierre ya está, §6).
- Medir el resto de colores de la cascada de A-4 (solo se ha corregido el verde positivo).
- Del hogar: **cerrar octubre y noviembre desde la app** (1-3/11 y 1-3/12): con el segundo cierre del año aparece el primer puente.

## 6. Segunda entrega (13/10/2026): el aviso en Cierre

**Qué hace.** Al abrir **Cierre**, si la app tiene un puente calculable (dos cierres del mismo año) **y el cambio es relevante** (≥ 5 % del fin de año anterior), aparece una tarjeta con la dirección (▼ «El fin de 20XX empeora desde el cierre anterior» / ▲ «mejora…»), la **frase del puente** (la misma que en Plan › Previsión) y un botón **«Ver el puente»** que lleva a **Plan › Previsión**. Motor puro: `closeNotice` en `canonical-forecast-bridge.js`; pintado en `puente-ui.js › renderPuenteAviso`; una sola línea en `views/cierre.js`, junto a los avisos del plan B (WP-38) y de la sombra de deuda (WP-41). `app.js` no se toca.

**Reglas con prueba** (`tests/wp43-puente-prevision.test.cjs`, 18 pruebas; e2e «WP-43 · aviso del puente en Cierre»):

- **Sin puente, con un puente no calculable o con un cambio pequeño no sale nada.** Nunca un «todo igual» presentado como buena noticia: lo pequeño sigue estando en la tarjeta de Plan › Previsión.
- **Si «Otros y supuestos» explica el 40 % o más del cambio, lo dice** («la app no sabe explicarlo del todo; mirad la tabla antes de fiaros de las causas»). Y si no hay real del mes cerrado, repite la nota que ya lleva el puente.
- **Solo lee**: una prueba comprueba que el almacén queda con las mismas fotos. No cambia la previsión ni los cierres.
- **Contraste**: la prueba calcula las ratios con los tokens reales del tema (claro y oscuro), no con valores copiados.

**Decisiones mías, a cuestionar.**

1. **El 40 % de «otros» es mío**, como el 5 % de relevancia: no hay un cierre real con el que calibrarlos.
2. **El aviso sale en cada apertura de Cierre mientras el último puente sea relevante**, aunque ya lo hayáis visto. Con un puente por mes puede acabar siendo ruido; si molesta, el siguiente paso es recordar cuál se ha visto (guarda estado: lo consultaría).
3. **Corregido de paso el verde de A-4** (`is-positivo` en `design-tokens.css`: el texto verde pasa a mezclarse al 70 % con la tinta; 3,49 : 1 → 5,7 : 1 en claro, y se mantiene en oscuro): es un cambio de color en Análisis fuera de lo pedido, pero era un fallo de accesibilidad comprobado con las ratios reales de los tokens. Se consulta si no os gusta el tono.

**Lo que sigue sin estar** (por eso el paquete sigue «en curso»): barra de **mercado** (necesita WP-46), **toque en una barra → partidas** (obliga a guardar el detalle por partida en cada foto: **cambia lo que se guarda en las fotos; lo consultaría antes**), aviso en Hoy, y sobre todo **ningún puente real**: hasta el segundo cierre del año (noviembre/diciembre) este aviso no puede salir con datos del hogar.
