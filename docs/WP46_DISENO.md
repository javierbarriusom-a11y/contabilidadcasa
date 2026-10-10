# WP-46 · Patrimonio neto: serie y proyección — diseño

Paquete del plan definitivo (NPV-10, Ola 3, ≈ 5 sesiones: el mayor de la ola). **Primera entrega el 10/10/2026.** Estado: **en curso**. Están la definición del patrimonio, la foto en cada cierre, la serie con su «de dónde viene el cambio» y la proyección a 10 años en tres escenarios con hitos; **falta la mayor parte de lo que haría de esto una herramienta de decisión** (§3) y **no hay ninguna serie real todavía**: la primera foto es la del cierre de octubre (1-3/11) y con 3 cierres completos aparece la serie (enero).

## 1. Qué hace

La tarjeta **«Patrimonio neto: serie y proyección»** en **Inversión › Cartera**, sobre la de calma y cobertura (`patrimonio-ui.js`, `patrimonio.css`; motor puro `canonical-net-worth.js`; almacén `net-worth-data` con las fotos y los supuestos, en la copia). Tres partes:

1. **Hoy.** Patrimonio neto = **efectivo en cuentas + cartera de inversión + vivienda, local y otros activos − deuda pendiente**, con cada componente y, **aparte, lo que no se suma y por qué**: los activos registrados como «cuenta», «inversión» o «pensión» en Activos **no entran**, porque el dinero ya está en los saldos y en la cartera (sumarlos lo contaría dos veces); se enumeran por si falta algo.
2. **La serie.** En **cada cierre firmado** la app guarda una foto del patrimonio **con el efectivo real del cierre** (los saldos guardados) y los demás componentes tal como están. Con **menos de 3 fotos completas no hay serie**: se enseñan las que hay. Con 3 o más: gráfico con el kit de WP-28 (frase automática, recorrido táctil, «Ver como tabla») y **de dónde viene el último cambio**, por componente.
3. **La proyección a 10 años** en **tres escenarios** (prudente, central, optimista) y su abanico: liquidez de la previsión + cartera × (1 + rendimiento)^t + activos × (1 + revalorización)^t − deuda según su calendario. **Los rendimientos y las revalorizaciones los teclea el hogar**; con los hitos: **deuda cero**, cuándo el patrimonio **deja de ser negativo** y cuándo llega a un **objetivo** tecleado.

No cambia ningún dato (A11-4): una prueba comprueba que la cartera no se toca. Hoy no se toca.

## 2. Reglas del motor, con prueba (`tests/wp46-patrimonio.test.cjs`, 12 pruebas)

- **Dato ausente no es cero.** El neto solo existe con los cuatro componentes conocidos; si falta uno, no se calcula y se nombra lo que falta («no lo sé»). Una deuda conocida de 0 € sí es un dato.
- **Menos de 3 fotos completas no es una serie**, y una foto incompleta no cuenta.
- **No hay rendimiento por defecto.** Sin rendimiento de la cartera ni revalorización de los activos declarados, se mantienen en 0 % **y se dice** («Faltan supuestos»); los tres escenarios coinciden y la frase lo dice.
- **La proyección cuadra con la aritmética** (prueba mes a mes): 10.000 € al 5 % son 10.500 € a los 12 meses; 100.000 € al 2 %, 102.000 €.
- **La deuda sin calendario no amortiza** (la que no tiene TAE o plazo, que el motor de WP-19 deja fuera): se mantiene, y por eso **no se puede decir «deuda cero»** mientras exista.
- **El abanico se abre con el tiempo** y está ordenado (prudente ≤ central ≤ optimista).
- **El movimiento entre dos fotos suma exactamente el cambio**, con la deuda que baja contando a favor.
- Motor puro: sin DOM, red, almacenamiento ni reloj.

## 3. Dónde se aparta del plan, y por qué

| El plan decía | Lo entregado | Por qué |
|---|---|---|
| «Serie mensual con el efectivo de los cierres de WP-09, posiciones de WP-15, vivienda y local, **deuda**» | **La serie nace desde el primer cierre firmado, con una foto propia**, no reconstruida | La deuda **solo se guardaba en el último cierre** (un único registro que se sobrescribe), la vivienda y el local **solo tienen su valor actual**, y la serie de valoraciones de la cartera arranca con WP-15. **No hay historia que reconstruir**, y fabricarla sería inventar. Con 0 fotos hoy, la serie tarda 3 cierres |
| «Abanico de tres escenarios» | Tres escenarios de **supuestos tecleados** (rendimiento y revalorización) | No hay un modelo de mercado verificable, y la app no inventa uno. **No es un intervalo de probabilidad** y la tarjeta lo dice |
| Hitos: deuda cero, **objetivos**, **jubilación de `GOB11`** | **Deuda cero, patrimonio no negativo y un objetivo de patrimonio**; no objetivos de ahorro ni jubilación | Los objetivos de ahorro y GOB11 exigen datos propios (aportaciones, pensión pública, tasa de retirada) que esta proyección no maneja; cruzarlos duplicaría lo que ya hace GOB11 |
| «Estado vacío honesto con < 3 cierres» | Hecho | — |
| Cartera, vivienda y local «por cierre» | La cartera usa su **valor actual** en el cierre | Las posiciones guardan su último valor y fecha; si la valoración tiene más de 35 días, el patrimonio del cierre lo hereda sin avisar (es un riesgo, §4) |

## 4. Riesgos y decisiones a cuestionar

1. **La definición decide el número, y la he elegido yo para evitar duplicados.** Efectivo (saldos) + cartera (posiciones) + activos no financieros (inmuebles, vehículos, alternativos, otros) − deuda. **Excluir las filas «cuenta», «inversión» y «pensión» de Activos es una decisión mía**: si el hogar solo registró un fondo en Activos y no en la cartera, falta en el total. La tarjeta enumera lo excluido, pero no sabe cuál de los dos casos es el suyo.
2. **El patrimonio es tan fresco como su componente más viejo.** La vivienda y el local son valores declarados a mano (WP-50 los actualizaría por índice); la cartera, la última valoración. Una foto «de octubre» puede contener una vivienda valorada hace un año. **No hay aviso de antigüedad por componente en esta entrega.**
3. **La proyección es una extensión de la previsión de liquidez**, que ya es dudosa a 10 años: ingresos y gastos se extrapolan como están, y **no hay aportaciones nuevas a la cartera** (están dentro de la liquidez). Con un rendimiento declarado del 5 %, la cartera crece sola, y la proyección es optimista en lo que el ahorro no vaya a la cartera y pesimista en lo contrario. Se dice, pero la cifra a 10 años no es una predicción.
4. **Sin supuestos, la proyección «sin rendimiento» parece una proyección.** Se marca en un aviso, pero un gráfico plano de tres escenarios idénticos es fácil de leer como «no pasa nada».
5. **Las fotos solo existen si el cierre se firma desde la app con sesión iniciada** (la misma ruta que WP-09 y WP-43). Un cierre sin foto es un hueco silencioso en la serie.
6. **El objetivo y los rendimientos los teclea el hogar**, sin comparación con nada. Con un 7 % optimista, cualquier objetivo parece alcanzable.

## 5. Pendiente

- **Barra de «mercado»** del puente de previsión (WP-43) con la serie de la cartera, y **toque en un punto para ver qué lo explica**.
- **Aviso de antigüedad por componente** (WP-50 para vivienda y local; WP-45 ya tiene la frescura de la cartera).
- **Hitos de objetivos de ahorro y de jubilación (GOB11)**; **impuestos latentes (NIN-07, tras esta serie)**.
- **Aportaciones futuras a la cartera** (política de WP-39) en la proyección.
- Del hogar: **cerrar octubre, noviembre y diciembre desde la app** (la serie aparece con el tercero), **declarar la TAE de cada contrato** (para que haya «deuda cero») y **teclear los tres escenarios**.
