# WP-44 · Calma, cobertura y exposición — diseño

Paquete del plan definitivo (CAR-02 + CAR-05 + CAR-06, Ola 3, ≈ 3,5 sesiones). **Primera entrega el 10/10/2026.** Estado: **en curso**. Están las tres lecturas con su motor y su tarjeta; **faltan partes que el plan pide y que hoy no se pueden hacer con honestidad** (§3) y **ninguna se ha visto con datos reales**: hoy hay 0 valoraciones de la cartera, y sin 3 no hay caída que medir.

## 1. Qué hace

La tarjeta **«Calma, cobertura y exposición»** en **Inversión › Cartera**, bajo la valoración (`calma-ui.js`, `calma.css`; motor puro `canonical-calm-coverage.js`; almacén `calm-coverage-inputs` con la tasa de retirada y los titulares de las cuentas, en la copia). Tres lecturas, **para mirar con calma y no para actuar** (no hay botones de vender ni comprar, y una prueba lo comprueba):

1. **Calma en caídas (CAR-02).** Con **≥ 3 valoraciones de toda la cartera**, dice cuánto ha **restado el mercado** desde su máximo, en € y en %, **sin contar lo que habéis aportado o vendido**; a cuántos **meses de aportación** equivale (la cantidad fija de la política **firmada**, o la media de lo aportado en los últimos 6 meses); lo que **acordasteis en la política** para ese nivel (20 % y 35 %) y **cuánto habéis aportado frente a cuánto vale**. Sin 3 valoraciones, lo dice y nombra las posiciones sin valorar. Avisa si la última valoración tiene más de 35 días.
2. **Cobertura del gasto (CAR-05).** «Vuestros activos pagan ya el X % de vuestros gastos»: **alquiler neto declarado de los activos + retirada sostenible** (la tasa que tecleáis × la cartera líquida: fondos, acciones y ETF), sobre el **gasto medio de los próximos 12 meses de la previsión**. Lo que no se declara **no suma y se nombra**; dice cuánto falta para el 25, 50 y 100 %.
3. **Depósitos por entidad (CAR-06).** Saldo de cada cuenta frente al límite de **100.000 € por titular y entidad**, con los titulares que tecleéis. Sin titulares, un saldo por encima del límite individual **no se declara «cubierto» ni «descubierto»**.

## 2. Reglas del motor, con prueba (`tests/wp44-calma-cobertura.test.cjs`, 12 pruebas)

- **La caída se mide en mercado.** Se acumula, entre valoraciones sucesivas, la variación de valor **menos las aportaciones netas fechadas**, y se mide desde el máximo de ese acumulado. Aportar 300 € que sube el valor 200 € es una caída de 100 €, no una subida; **sacar 400 € no es perder 400 €**.
- **Solo se usan fechas con la cartera completa:** una fecha en la que a alguna posición le falta valoración no se usa (el total saltaría solo por faltar una); lo anterior se arrastra.
- **Dato ausente no es cero ni se supone:** sin tasa de retirada, sin alquiler declarado, sin gasto de previsión o sin titulares, esa parte no suma o no se declara, y se dice.
- **Una tasa de retirada de más del 15 % no se suma** (no es sostenible).
- **Los dividendos no se suman aparte:** ya van dentro de una tasa de retirada sostenible; sumarlos los contaría dos veces (prueba incluida).
- Motor puro: sin DOM, red, almacenamiento ni reloj (el día lo pasa la tarjeta).

## 3. Dónde se aparta del plan, y por qué

| El plan decía | Lo entregado | Por qué |
|---|---|---|
| «Cuánto tardaron en recuperarse caídas similares (datos históricos estáticos con fuente)» | **No está** | No tengo una serie histórica verificada y citable; inventarla o recordarla de memoria sería falsear justo el dato que se usa para tranquilizar. Si el hogar quiere esa línea, hace falta elegir una fuente y teclearla con su cita |
| «La rentabilidad diaria se oculta por defecto» | No aplica | La app no muestra rentabilidad diaria: solo hay valoraciones puntuales |
| «La primera pantalla de Inversión cambia» cuando cae más de un umbral | **No cambia**: la tarjeta está en Inversión › Cartera, siempre visible | Cambiar qué enseña una pantalla por defecto no se hace sin decisión del hogar; el aviso proactivo queda para Cierre (y Hoy, tras H-02) |
| «Evolución mensual y fecha estimada del 25, 50 y 100 %» | **Solo la cifra de hoy y lo que falta para el siguiente hito** | Una evolución exige guardar la cifra en cada cierre y proyectar con una tasa de crecimiento que no tengo. Es el siguiente paso natural |
| «Aparece en la carta del mes» (CAR-05) | No: WP-29 (carta del mes) no está hecho | — |
| Exposición por entidad: depósitos, **fondos segregados, seguros de ahorro** | **Solo depósitos** (las cuentas) | Las posiciones de la cartera **no guardan en qué entidad están**; asignarlas pide un campo nuevo y su pantalla. Hoy se dice que fondos y seguros quedan fuera del cálculo |
| «Alquiler neto del local + **dividendos** + tasa de retirada» | Alquiler + retirada; **sin dividendos** | Evitar la doble cuenta (§2) |

## 4. Riesgos y decisiones a cuestionar

1. **Hoy no puede enseñar casi nada.** Con 0 valoraciones no hay caída; sin tasa de retirada ni alquiler declarado, la cobertura no se calcula; y con unos 10.000 € de liquidez, ninguna entidad se acerca a 100.000 €. **Es un paquete cuyo valor depende de que haya cartera valorada y patrimonio que proteger**, y para este hogar eso es futuro. Construirlo ahora es una apuesta, no una respuesta a un problema actual.
2. **La tasa de retirada la teclea el hogar y la cifra de cobertura depende de ella casi por completo.** Con un 4 % sobre una cartera pequeña, el 25 % «cubierto» puede salir de un único euro de alquiler. No es el «X %» motivador del plan sin más contexto: dice de dónde sale cada parte.
3. **El gasto medio sale de la previsión de los próximos 12 meses**, que incluye cuotas de deuda que terminarán: el denominador baja cuando acaban, y la cobertura sube sin que los activos hagan nada. Se dice en una línea, pero conviene saberlo.
4. **«Cartera líquida» excluye cripto y «otro»** por no saber si dan renta. Es una decisión mía.
5. **La aportación mensual de referencia** es la de la política firmada o la media de 6 meses; ninguna de las dos es «lo que aportaréis»: si se aporta a rachas, «meses de aportación» sale ruidoso.
6. **El nivel de caída usa 20 % y 35 %** (los de la política), no un umbral propio. Sin política firmada, el aviso dice «hablarlo las dos personas»: es la acción menos dañina, pero es mía, no una elección del hogar.
7. **Los titulares de una cuenta son datos que teclea el hogar** y que no se verifican; el límite de 100.000 € es el que recuerdo (**verifica el vigente**).

## 5. Pendiente

- **Fondos y seguros por entidad:** un campo «entidad» en las posiciones.
- **Evolución de la cobertura** (foto en cada cierre) y fecha estimada de los hitos.
- **Caídas históricas con fuente** (elegir y citar una).
- **Aviso en Cierre** si la caída pasa de un nivel; en Hoy, tras H-02. Enlazar con el plan B (WP-38) y con la política (WP-39: nota de motivo al vender en caída).
- Del hogar: **valorar la cartera** (Actualizar valoración, 1-3/11, y los meses siguientes) y **declarar la tasa de retirada** y los **titulares** de cada cuenta.
