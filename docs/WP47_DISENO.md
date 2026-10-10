# WP-47 · Reparto de la nómina en un paso — diseño

Paquete del plan definitivo (NPV-05, Ola 3, ≈ 2,5 sesiones). **Primera entrega el 10/10/2026.** Estado: **en curso**. Está la hoja de reparto con sus «steppers», el límite por el suelo de liquidez y el borrador con la lista de transferencias; **falta el aviso al confirmar la nómina** (Hoy está congelado), el destino de cada transferencia y que la hoja vea la política de inversión firmada (§3). Nada se ha probado con una nómina real del hogar: **la demo no tiene ninguna partida llamada «nómina»** y la tarjeta sale vacía.

## 1. Qué hace

La tarjeta **«Repartir la nómina»** en **Deuda › Comparar**, justo debajo de la escalera del próximo euro (`nomina-ui.js`, `nomina.css`; motor puro `canonical-payroll-split.js`; almacén `payroll-split-drafts`, en la copia). Tres partes:

1. **Qué nóminas ofrece.** Las partidas de ingreso cuyo nombre dice «nómina», «salario» o «sueldo» con el **real ya registrado** este mes (y, hasta el día 10, el mes anterior: una nómina del 30 se confirma ya en el siguiente). Cada una con una casilla, y «No repartir esta» (con deshacer). Una nómina con borrador abierto no se vuelve a ofrecer; al descartar el borrador, vuelve.
2. **Cuánto se puede repartir.** **El menor entre la nómina y la holgura sobre el suelo de liquidez** en el peor punto (P10) de la banda de caja de 30 días de WP-16: lo que se puede sacar hoy sin que, en 9 de cada 10 trayectorias, la liquidez baje del suelo antes del próximo cobro. Si la liquidez ya está en el suelo, «hoy no hay nada que repartir». Si la holgura no se puede calcular, se reparte la nómina entera **marcada «sin comprobar»**.
3. **El reparto.** Una fila por peldaño de la escalera de WP-42 con **lo que ella propone para esa cantidad**: colchón, **cada deuda con saldo** (también las que la escalera deja a 0), plan de pensiones (con su límite anual como tope) e **inversión por tipo de activo** (los que tienen objetivo, por aportación y sin vender). Más una fila **«Sin repartir (se queda en la cuenta)»**. Cada fila tiene **−50 / +50** y un importe editable. **Mover dinero es siempre entre la fila y «sin repartir»: el total repartible no cambia nunca ni queda un importe negativo.** Lo que difiere de la escalera se marca «distinto de lo sugerido (X €)». «Volver a lo que sugiere la escalera» lo restablece.
4. **«Aplicar».** Guarda un **borrador** con las nóminas, el reparto y una **lista de transferencias a hacer** (en el orden de la escalera, cada una con su nota: la comisión de amortización anticipada que la app no conoce, que la pensión inmoviliza, que invertir no está garantizado) con una casilla **«hecha»** que marca el hogar. **No mueve dinero, no anota ningún movimiento y no toca el real de la nómina** (A11-4; una prueba de navegador lo comprueba). Aplicar, descartar y apartar se pueden deshacer.

## 2. Reglas del motor, con prueba (`tests/wp47-reparto-nomina.test.cjs`, 21 pruebas)

- **Disponible = el menor entre nómina y holgura.** Sin holgura calculable no se inventa una infinita: nómina entera, «sin comprobar». Holgura ≤ 0 → nada que repartir.
- **Los «steppers» no cambian el total** (prueba de propiedad: 4 importes y 300 movimientos aleatorios cada uno, total al céntimo en cada paso), **nunca dejan un importe negativo ni pasan del tope de la fila** (la deuda no puede amortizarse por encima de su saldo; la pensión, por encima de su límite anual) **ni de lo que queda sin repartir**; «sin repartir» no se edita a mano; un valor no numérico no cambia nada.
- **La suma de las filas nunca supera el disponible**: si la escalera propusiera más, se recorta desde el final.
- **No se reparte dos veces el mismo dinero.** Lo apuntado en borradores abiertos y todavía no reflejado en los saldos declarados (las transferencias sin hacer y las hechas **después** de la fecha de los saldos) **se descuenta de la holgura**. Sin la fecha de los saldos, se cuenta todo (lo prudente). La prueba de navegador lo comprueba con una segunda nómina.
- **Sin rentabilidad esperada, lo que sobra queda «sin repartir»**, nunca un 50/50 (herencia de WP-42).
- **«Nómina» se reconoce por el nombre**, sin acentos ni mayúsculas y por palabra entera: «Nómina Javi», «salario Tere», «sueldo»; no «nominal» ni «Ingreso Persona A».
- Motor puro: sin DOM, red, almacenamiento ni reloj. La tarjeta no usa red, `confirm()` ni escribe movimientos (prueba estática).
- **Cambio en el motor de la banda (WP-16):** el resultado gana `minimum.valueP10` (el mínimo al que llega la trayectoria en 9 de cada 10 casos). Es aditivo: las 24 pruebas de WP-16 siguen igual.

## 3. Dónde se aparta del plan, y por qué

| El plan decía | Lo entregado | Por qué |
|---|---|---|
| «Al confirmarse la nómina (WP-14)…» | **No hay disparador al confirmar**: la tarjeta detecta nóminas con el real registrado y hay que abrir Deuda › Comparar | La confirmación («¿ha llegado…?») vive en la bandeja de **Hoy, congelado hasta H-02**, y no guarda cuándo se confirmó. **Es la mayor debilidad del paquete**: sin un aviso, depende de que alguien se acuerde de abrir esta pantalla. Tras H-02, el toque «Sí» debería ofrecer «Repartir esta nómina» |
| «Steppers que siempre suman el disponible tras el suelo» | Cumplido, con «el suelo» = **el suelo de liquidez de Ajustes** medido sobre la banda de 30 días, **no** el suelo del colchón de la escalera | Son dos suelos distintos: el de liquidez es el mínimo operativo de las cuentas; el del colchón es la reserva de emergencia (la escalera lo rellena primero si falta) |
| «Crea un borrador y una lista de transferencias» | El **borrador es el reparto guardado** y la lista, un recordatorio con casillas | No sé qué se quería decir con «borrador» (¿movimientos sin confirmar?). Anotar movimientos contables a partir de una lista que la app no puede verificar habría roto «nada se ejecuta ni se anota». **A cuestionar** |
| Destino de cada transferencia | **Sin destino**: «pasar al colchón», «aportar al plan de pensiones»… | La app no guarda de qué cuenta a cuál se hace cada traspaso; inventarlo sería falsear |
| (no dice nada) | Todas las nóminas del mes se tratan como **un solo bote** | No sé si Javi y Tere reparten por separado; la hoja deja desmarcar una |
| Reutilizar WP-42 | Comparte con la escalera la rentabilidad esperada y lo aportado a pensiones | Un solo sitio donde teclearlos |

## 4. Decisiones mías y riesgos a cuestionar

1. **Una hoja «prerrellenada» convierte en acción lo que en WP-42 era una explicación.** Con el tipo marginal sacado de la **retención de la nómina** (que no es el marginal; WP-42 §4.3), la escalera manda dinero al plan de pensiones **antes de invertir**, y la hoja lo deja a un toque de «Aplicar». Los umbrales de WP-42 (2 puntos de prima, 6 %, 30 % de marginal) **siguen sin calibrar**. La hoja enseña «lo que sugiere la escalera» y avisa de que la pensión inmoviliza, pero **el riesgo de aceptar el valor por defecto es real**.
2. **La holgura es tan buena como la banda de caja**, y la banda solo recoge la incertidumbre de las **fechas** (no de los importes) y mira **30 días**: no cubre un gasto más caro de lo previsto ni un pago grande a 45 días (el IBI, el seguro anual). Con saldos **calculados** (no declarados) o con casi todas las fechas estimadas (banda «ancha») la tarjeta lo dice, pero **la cifra sigue saliendo**. En la demo la banda sale «ancha» y con saldos calculados.
3. **«Saldos ya incluyen esta nómina» es una suposición mía** (solo si son declarados y de la fecha de la nómina o posterior); se puede corregir con la casilla, pero afecta a si el colchón se rellena con dinero «nuevo» o «ya en cuentas».
4. **«Hecha» no se verifica.** La app no sabe si la transferencia se hizo; se descuenta de la holgura mientras los saldos no se redeclaren.
5. **Se reconoce la nómina por el nombre.** Si la partida se llama «Ingreso Javi» no sale; es un criterio frágil elegido porque la app no marca el tipo de ingreso (canonical-timing ya depende de «nómina»/«salario» + nombre).
6. **El paso de ±50 € es mío**, y los botones están en el idioma de «mover el dinero», no «calcular»: con importes grandes (3.000 €) son 60 toques; el importe editable cubre ese caso.
7. **Corregido después de publicar (en el PR de WP-48):** los importes escritos en la hoja se leían con `parseAmount`, que entiende «2.000» como **dos**; ahora usan el lector es-ES de la app (`parseAmountField`: «2.000» son dos mil). El campo se repintaba con el valor leído, así que el fallo era visible, pero **leía mal un importe escrito sin decimales**.
8. **Repintar sustituye el DOM**: si se escribe un importe y se pulsa un botón de otra fila sin salir antes del campo, el primer clic puede perderse (el cambio del campo repinta). Se repite el clic.

## 5. Pendiente

- **El aviso al confirmar la nómina** (tras H-02: el «Sí» de «¿Ha llegado «Nómina»?» en Hoy debería ofrecer «Repartir»).
- Destino de cada transferencia (cuenta de origen y de destino) y un resumen para copiar.
- Que la hoja vea la **política de inversión firmada** (WP-39) y el **plan B** (WP-38), como la escalera.
- Reparto por titular, y un aviso en el cierre mensual de las nóminas sin repartir.
- Del hogar: confirmar una nómina real desde la app, declarar los saldos tras ella, declarar el suelo de liquidez y teclear la rentabilidad esperada y lo aportado a pensiones.
