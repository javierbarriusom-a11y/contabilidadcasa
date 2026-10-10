# WP-43 · Puente de previsión — diseño

Paquete del plan definitivo (PRV-01, Ola 3, ≈ 2,5 sesiones). **Primera entrega el 10/10/2026.** Estado: **en curso**. Está el congelado en cada cierre, la cascada entre dos cierres (que cuadra siempre), la frase y la tabla equivalente; **faltan la barra «mercado» y el toque en una barra para ver las partidas que la explican** (§3), y **no se ha visto con un cierre real**: el primer puente solo puede existir con el segundo cierre del año (diciembre; el de octubre es el primero).

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
6. **Las cifras de la cascada van en tinta** (no en verde/rojo): el verde de A-4 (`is-positivo`) da 3,49 : 1 en claro. **Eso es un fallo previo de contraste en Análisis**, que ninguna prueba axe recorre con valores positivos; no se ha tocado.

## 5. Pendiente

- Barra de **mercado** y foto de patrimonio, con la proyección de WP-46.
- **Toque en una barra → partidas** (foto con detalle por partida).
- **Aviso en Cierre** cuando el cambio es relevante; en Hoy, tras H-02.
- Arreglar el verde `is-positivo` de A-4 (Análisis) y medir el resto de colores de esa cascada.
- Del hogar: **cerrar octubre y noviembre desde la app** (1-3/11 y 1-3/12): con el segundo cierre del año aparece el primer puente.
