# WP-41 · Deuda en la sombra y TAE real — diseño

Paquete del plan definitivo (DAC-04 + DNU-03, Ola 3, ≈ 3,5 sesiones). **Primera entrega el 10/10/2026**, sin dependencias del hogar para construirla (lo que sí necesita del hogar es contestar los avisos, §5). Estado: **en curso**. Están el detector sobre los movimientos importados y la función pura de TAE efectiva con su calculadora; **falta la prueba con datos reales** (nunca se ha ejecutado el detector sobre un extracto del hogar) y el aviso fuera de la pestaña.

## 1. Qué hace

La tarjeta **«Deuda en la sombra y TAE real»** en **Deuda › Contratos** (`sombra-ui.js`, `sombra.css`; motor puro `canonical-shadow-debt.js`; almacén `shadow-debt-answers`, en la copia), debajo de la conciliación con la CIRBE. Tiene dos partes:

1. **Lo que se comporta como deuda sin figurar como tal.** El detector recorre los movimientos importados y propone compromisos que son financiación aunque no sean un préstamo: el móvil financiado en la factura, una compra «a plazos», un pago fraccionado, Klarna/Sequra/Aplazame y similares. Cada propuesta enseña la **cuota mensual**, cuántos cargos se han visto, **la evidencia literal** (el concepto del extracto y por qué se ha marcado), las cuotas que quedan y el mes de fin **solo si el propio extracto lo dice** («cuota 3 de 12»). Botón **«Añadir a Contratos»**, que **solo rellena el formulario de alta** (entidad, tipo, capital pendiente, cuota, plazos); lo envía quien lo decide. Y **«No es deuda»** para descartarla.
2. **TAE real de una oferta.** Calculadora plegada: precio al contado, nº de cuotas, importe de la cuota, comisión de apertura, seguro mensual, pago final, y si la primera cuota es al contratar. Devuelve la **TAE efectiva** (TIR mensual por bisección, anualizada), el coste total pagado y el sobrecoste sobre el contado. Además, **«¿contado o financiado?»**: con la liquidez de las cuentas y el suelo del colchón que ya calcula la app (`cushionFloor`), dice si pagar al contado deja el colchón por debajo del suelo y compara la TAE con lo que rinde el dinero parado (un porcentaje opcional que teclea el hogar). Una propuesta detectada puede **precargar** la calculadora.

Nada da de alta, borra ni paga (A11-4). Descartar una propuesta se puede **deshacer** («Deshacer» en la nota, sin `confirm()`).

## 2. Reglas del motor, con prueba (`tests/wp41-deuda-sombra.test.cjs`, 14 pruebas)

- **Un recurrente sin pista de plazos o de financiación no se marca**: sería una suscripción. Hace falta o bien un contador «cuota 3 de 12» / «plazo 4/10» / «3 de 12 cuotas», o bien una palabra que delate financiación **y** al menos dos cargos en meses distintos.
- **Cuota a secas no basta** (comunidad, colegio, gimnasio). Los contadores con palabras de relleno («CUOTA TERMINAL 3 DE 24», «FINANCIACION TERMINAL MOVIL 2 DE 18») se aceptan **solo si hay una palabra de financiación**.
- **Lo que ya es otra cosa se excluye**: plazo fijo, depósito, fondo de pensiones, hipoteca y préstamo (formal) no se proponen nunca como deuda en la sombra.
- **Tiene que ser mensual**: si los cargos del mismo importe no están separados por 24-38 días, no se propone.
- **Lo que ya está en Contratos no se propone otra vez** (por entidad e importe parecido, y no liquidado).
- **La fecha de fin sale solo del contador del extracto.** Sin él: «no se sabe cuándo acaba». El capital propuesto es **lo que queda por pagar** (cuotas × importe) y **no incluye intereses desconocidos**; se dice.
- **Estados**: `missing` (sin movimientos), `stale` (el último movimiento tiene más de 45 días: no puede mirar lo reciente, y no dice «no hay nada»), `ok`. Máximo 8 propuestas; el resto se cuenta aparte.
- **Falsos positivos medibles**: de las respuestas «No es deuda» sale la tasa de avisos que sobran; hasta 10 respuestas dice «todavía no se puede medir».
- **TAE**: dato ausente no es cero. Sin precio al contado no se calcula («dato ausente no es cero»); un campo en blanco no se presume «sin comisión». Se cuida el caso de la oferta «0 %» con comisión de apertura (que no es 0 % real) y la cuota inicial adelantada.

## 3. Dónde se aparta del plan, y por qué

| El plan decía | Lo entregado | Por qué |
|---|---|---|
| «Detector sobre recurrentes con fecha de fin» | Sobre los **movimientos importados**, con el contador del concepto como fecha de fin | `canonical-recurring` agrupa por importe y concepto pero no conserva el texto literal que delata el plazo; reconstruirlo desde los movimientos es más simple y verificable |
| «Propuesta de alta como deuda corta» | Precarga del formulario de Contratos | Mismo patrón que WP-40: nada se da de alta solo |
| «Para lo detectado y para ofertas al 0 %» | Las dos cosas, en una calculadora que se precarga desde lo detectado | — |
| No pide aviso en Hoy | No lo hay (Hoy congelado hasta H-02) | — |

**Por qué «en curso» (50 %) y no «hecho»:** el detector solo se ha probado con extractos sintéticos que yo mismo escribí; los conceptos reales de los bancos del hogar pueden no llevar ninguna de las palabras o contadores que busco. Hasta que se ejecute sobre un extracto real y el hogar conteste ≥ 10 avisos, **la métrica del plan (avisos que sobran) no se puede leer**.

## 4. Riesgos y decisiones a cuestionar

1. **Cobertura de conceptos.** Las expresiones son las que conozco; un banco que escribe «FRACC. 3/12» o solo «TERM IPHONE» no se detecta. Un falso negativo aquí es peor que uno positivo, porque da sensación de «no hay deuda oculta». Cuando no sale nada, la tarjeta lo advierte («solo veo lo que el extracto delata… una permanencia con penalización no sale en un extracto»).
2. **El capital propuesto subestima la deuda real**: no incluye intereses. Para una financiación al 0 % es correcto; para una con intereses, es un mínimo.
3. **Un cargo recurrente de importe variable** (con intereses decrecientes) no cuadra con la tolerancia del 2 %; no se detectaría.
4. **La TAE depende de que el hogar teclee bien las comisiones**; una comisión olvidada baja la TAE y favorece la financiación. Por eso el campo vacío no se interpreta como cero en la comparación contado/financiado.
5. **«Contado o financiado» compara contra un rendimiento tecleado** (opcional), no contra una cartera real; la liquidez y el suelo sí vienen de la app, y valen lo que valgan los saldos cargados. Es una referencia, no una recomendación.
6. **Lo descartado con «No es deuda» se recuerda por concepto e importe**: si la cuota cambia de importe, vuelve a avisar; si una suscripción se convierte en financiación con el mismo importe, no.

## 5. Pendiente

- Ejecutar el detector sobre un extracto real (del hogar) y ajustar palabras y contadores con lo que salga.
- Contestar ≥ 10 avisos para leer la tasa de avisos que sobran.
- Llevar el aviso a la bandeja de Hoy y/o al Cierre, **tras H-02**.
- Enlazar la propuesta con el plan de amortización (WP-19) cuando el contrato exista.
