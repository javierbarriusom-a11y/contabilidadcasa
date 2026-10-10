# WP-48 · Operaciones de cartera editables e importador — diseño

Paquete del plan definitivo (NIN-06, Ola 3, ≈ 5 sesiones). **Primera entrega el 10/10/2026: solo la mitad del libro.** Estado: **en curso**. Está el **libro de operaciones editable con recálculo FIFO y «antes / después»**; **no está el importador del CSV del bróker** (§3) ni se han ampliado las pruebas de oro de FIN-2 con el libro (se añaden pruebas de oro propias).

## 1. Qué hace

La tarjeta **«Libro de operaciones»** en **Inversión › Cartera**, junto al formulario de ventas (`operaciones-ui.js`, `operaciones.css`; motor puro `canonical-portfolio-ledger.js`). **No tiene almacén propio**: las posiciones se siguen guardando donde ya vivían.

1. **El libro.** Se elige una posición y salen sus operaciones en orden cronológico: la **compra inicial**, las **aportaciones** y las **ventas**, cada una con su fecha, unidades e importe; en las ventas, la plusvalía FIFO o «sin lotes suficientes».
2. **Editar, añadir o quitar** (hasta ahora solo se podía añadir; corregir una venta mal escrita obligaba a borrar la posición). La compra inicial se edita pero no se quita (sus tres datos viven en la propia posición).
3. **«Antes / después» antes de guardar.** Antes de tocar nada se enseña, para ese cambio: unidades que quedan, coste de lo que queda, plusvalía realizada total, **plusvalía de cada venta afectada** (nueva, quitada o cambiada), y **la compensación de cada ejercicio fiscal tocado** (neto y base tras las pérdidas arrastradas, sumando las demás posiciones y las pérdidas declaradas: la misma `yearEndCompensation` de FC3). **No se guarda nada hasta pulsar «Guardar»**; cancelar no deja rastro; guardar se puede deshacer.
4. **Una venta que se queda sin lotes se marca, no se bloquea.** Puede ser un paso intermedio (se corrige la compra después). El botón pasa a «Guardar aunque deje ventas sin lotes» y el aviso dice que la compensación de ese ejercicio dejará de ser calculable.
5. **Avisos del libro:** compra inicial sin fecha (no entra en el FIFO y deja sin lotes a todas las ventas: el aviso sale con la forma de arreglarlo), aportación sin unidades (suma al coste pero no entra en el FIFO), venta sin importe (no hay rentabilidad) y **venta con pérdida y recompra en los dos meses siguientes** (norma de no recompra: **solo se avisa, no se aplica**).

## 2. Reglas del motor, con prueba (`tests/wp48-libro-operaciones.test.cjs`, 17 pruebas)

- **El FIFO NO se reimplementa**: se pregunta a `canonical-portfolio.js` (`normalizePositions` → `fifoLedger`), el mismo que usan Hoy, la compensación y la Renta. Una prueba comprueba que no hay un segundo `fifoLedger`.
- **Pruebas de oro con cifras calculadas a mano** (lote 1: 100 u a 10.000 €; lote 2: 50 u a 6.000 €; venta de 120 u por 15.000 € → coste 12.400 €, plusvalía 2.600 €, quedan 30 u a 3.600 €): cambiar el importe de la venta (1.600 €); mover la aportación a después de la venta (20 u sin lote, plusvalía «no calculable», ejercicio no calculable); quitarla; añadir una segunda venta (400 €, la posición queda a cero); **mover una venta de ejercicio cambia el orden FIFO y toca los dos ejercicios** (1.000 / −3.000 → 0 / −2.000, con el total realizado intacto); la compensación con otra posición y 500 € de pérdidas arrastradas (3.600 → base 3.100).
- **Propiedad** (150 posiciones al azar): se conserva el coste (Σ coste consumido + coste que queda = Σ coste de los lotes) y **editar y devolver el valor original deja la posición idéntica**; nada se modifica en la entrada (se prueba con objetos congelados).
- **Validación:** fecha que no existe (30 de febrero), importes o unidades negativos o no numéricos, venta sin unidades, aportación sin importe, id repetido u operación inexistente.
- Motor puro: sin DOM, red, almacenamiento ni reloj.

## 3. Dónde se aparta del plan, y por qué

| El plan decía | Lo entregado | Por qué |
|---|---|---|
| «Importación pegando el CSV del bróker con deduplicación» | **No está** | El formato sale de una muestra que el hogar aún no ha mandado (como el PR-2 de WP-15). Un importador que adivina columnas puede **corromper en silencio las cifras fiscales**; una versión genérica con asignación de columnas es posible, pero la dejo hasta tener una muestra real y poder probarla con ella |
| «Pruebas de oro fiscales con FIN-2» | Pruebas de oro **propias del libro** (cifras a mano) y la compensación del ejercicio de FC3; **FIN-2 no se ha tocado** | FIN-2 ya cubre el cruce de motores fiscales; lo nuevo (el efecto de una edición) tiene sus propios casos |
| Libro «por posición» | Lo es; **el FIFO es por posición, no por valor** | Si el mismo valor está repartido en dos posiciones (dos cuentas), el FIFO fiscal real los trata como un solo conjunto de valores homogéneos; aquí no. **A cuestionar** si hay valores repartidos |

## 4. Decisiones mías y riesgos a cuestionar

1. **Esto toca los números fiscales del hogar.** Una edición cambia las ventas, las plusvalías, la compensación del ejercicio y lo que lee la campaña de la Renta. Por eso **no hay guardado sin «antes / después»** y siempre se puede deshacer; aun así, **la primera vez que se use con datos reales conviene comparar con el informe fiscal del bróker**.
2. **No hay campo de comisiones.** La plusvalía fiscal resta los gastos de la venta y suma los de la compra; el libro lo resuelve pidiendo (y diciéndolo en el formulario) que el importe recibido sea neto y el de compra, bruto de comisiones. Un importe tecleado «tal cual» sobrestima la plusvalía.
3. **La norma de no recompra solo avisa, y solo de las compras posteriores** (≤ 2 meses). Las compras anteriores a la venta que siguen en cartera también cuentan para la norma y **no se evalúan** (el motor no expone qué lote queda). La minusvalía diferida **sí cuenta como pérdida en la compensación** de la app.
4. **No bloqueo una venta sin lotes.** Es la decisión que más cuestiono: facilita corregir en dos pasos, pero **se puede guardar un libro con una venta sin plusvalía calculable**, y entonces la compensación de ese ejercicio no se calcula (no sale una cifra a medias, sale «no calculable»).
5. **Las operaciones no tienen identificador del bróker**: dos ventas iguales el mismo día son dos filas. Es lo que hará falta resolver con la deduplicación del importador.
6. **El libro refresca la lista de posiciones y todo lo demás** con `refreshAllSectionsAfterDataChange` (una repintada completa); en una cartera grande puede notarse.
7. **A la compra inicial no se le puede añadir un segundo lote**: se añade como aportación con unidades.

## 5. Pendiente

- **El importador** (PR-2) cuando el hogar mande una muestra del CSV de su bróker: asignación de columnas, deduplicación y vista previa con el mismo «antes / después».
- FIFO por valor (ISIN) entre posiciones; norma de no recompra aplicada al cómputo, no solo avisada.
- Comisiones como campo aparte; identificador de operación del bróker.
- Del hogar: mandar una muestra del CSV (o el informe fiscal) de cada bróker y **contrastar** el libro de una posición real con él.
