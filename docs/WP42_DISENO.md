# WP-42 · Escalera del próximo euro — diseño

Paquete del plan definitivo (CAR-03 + NIN-05 + NIN-08, Ola 3, ≈ 7 sesiones: el más grande). **Primera entrega el 10/10/2026**, sin esperar a WP-17 (cartera como tablero), que el plan marca como dependencia y sigue pendiente: lo que WP-42 necesita de ella (el reparto de la cartera y sus objetivos) ya existe en Inversión › Rebalanceo y se lee de ahí. Estado: **en curso**. Están cuatro de los cinco peldaños y el rebalanceo por aportaciones; **faltan los fondos traspasables y el comparador de la liquidez ociosa** (§3), y nada se ha probado con datos reales del hogar. Segunda entrega el 13/10/2026: el reparto se cruza con la política firmada y con el plan B (§6).

## 1. Qué hace

La tarjeta **«¿Dónde va el próximo euro?»** al principio de **Deuda › Comparar** (`escalera-ui.js`, `escalera.css`; motor puro `canonical-next-euro.js`; almacén `next-euro-inputs`, en la copia). Se escribe un importe (y, si se quiere, la rentabilidad que se espera de invertir y lo ya aportado este año a pensiones) y la app lo reparte en este orden, **diciendo en cada peldaño cuánto, por qué y qué liquidez se pierde**:

| Peldaño | Qué hace | Beneficio que declara |
|---|---|---|
| 1 · **Colchón** | Primero lo que falta para el suelo del colchón (`cushionFloor`). Si el dinero ya está en las cuentas, solo es libre lo que supera el suelo | — (protege) |
| 2 · **Deuda con coste alto** | Las deudas cuyo coste efectivo tras la deducción fiscal supera el umbral, la más cara primero, hasta liquidarlas | **Cierto**: intereses que dejas de pagar |
| 3 · **Plan de pensiones** | Hasta lo que cabe en el límite del año, **solo si el tipo marginal lo justifica** | **Fiscal, de una vez**: difiere el impuesto, no lo elimina |
| 4 · **Invertir lo que sobra** | Lo que queda, repartido **por aportaciones, sin vender**, hacia lo que está por debajo de su objetivo por tipo de activo (`contributionRebalance`) | **Esperado, no garantizado** |

Los **tres tipos de beneficio se enseñan por separado y no se suman**: son de naturaleza distinta (uno es seguro, otro es un ahorro de impuestos de una sola vez, otro es una esperanza). La tarjeta no mueve dinero ni crea transferencias (A11-4); la lista de transferencias es WP-47.

## 2. Reglas del motor, con prueba (`tests/wp42-escalera.test.cjs`, 18 pruebas)

- **Dato ausente no es cero.** Sin liquidez o sin suelo, el colchón dice «sin datos» y el reparto queda **parcial**. Una **deuda sin TAE declarada se aparta** (no se le asigna dinero, no se da por gratis), se nombra con su saldo y se pide declararla; un 0 % *declarado* sí es un coste conocido. Sin tipo marginal, la pensión dice «sin datos»; sin lo ya aportado en el año, se avisa de que el peldaño puede sobrar.
- **Sin rentabilidad esperada no hay veredicto** entre amortizar el resto e invertir: lo que sobra queda **«sin reparto»**, nunca un 50/50. La app **no usa la rentabilidad histórica de la cartera por su cuenta** (la enseña como pista, y solo se usa si la escribe el hogar).
- **Invertir solo gana a amortizar si rinde al menos 2 puntos más (neto de impuestos) que la deuda**, porque amortizar es cierto e invertir no. Sin el tipo del ahorro, compara antes de impuestos y lo dice.
- **El orden es el del plan y no se reordena en silencio.** Si la pensión ahorra más impuestos el primer año que lo que cuesta la deuda, se **avisa**.
- **El reparto suma el importe** (colchón + deuda + pensión + invertir + sin reparto) y el redondeo no pierde céntimos. `contributionRebalance` solo aporta (nunca una venta), reparte según lo que falta a cada tipo y, si ya está en objetivo, en proporción.
- Motor puro: sin DOM, red, almacenamiento ni reloj (el año fiscal lo pasa la tarjeta).

## 3. Dónde se aparta del plan, y por qué

| El plan decía | Lo entregado | Por qué |
|---|---|---|
| Tras WP-17 y WP-13 | Sin esperar a WP-17; los tipos de WP-13 no se usan todavía | El reparto de la cartera y los objetivos ya existen; los tipos oficiales solo hacen falta para la liquidez ociosa, que no está |
| «Fondos traspasables» como peldaño | **No está** | Es un cambio de producto entre fondos sin tributar; necesita las posiciones con su régimen de traspaso, que hoy no se registran. Inventarlo sería falsear el peldaño |
| «Destino de la liquidez ociosa (comparador neto de impuestos)» (NIN-08) | **No está** | Hace falta el comparador de depósitos/letras con los tipos de WP-13 y el tipo del ahorro; el peldaño de invertir hoy usa la rentabilidad que teclea el hogar |
| «Cada peldaño con su euro de beneficio esperado y su coste de liquidez» | El beneficio por naturaleza y la liquidez en texto, **no un euro comparable entre peldaños** | Comparar un interés cierto con un ahorro fiscal de una vez y una rentabilidad esperada exige un horizonte y una probabilidad que no tengo; mostrarlos juntos como una cifra sería engañar |
| Coste de la deuda | TAE declarada tras deducción fiscal; **si falta, el implícito en la cuota y los plazos** (marcado «estimación»); si falta todo, «sin interés declarado» | Los contratos del hogar (y los de la demo) **no traen TAE**: la primera versión decía «no hay deudas con interés» con 12.000 € de deuda en Contratos. Se encontró al probar con los datos reales de la app, no con los de la prueba |

## 4. Decisiones mías y riesgos a cuestionar

1. **Los tres umbrales son decisión mía, no del plan:** 2 puntos de prima por riesgo para preferir invertir; 6 % de coste efectivo como «alto» cuando no hay rentabilidad con la que comparar; 30 % de tipo marginal como mínimo para que la pensión compense. Están como constantes con nombre y se pueden pasar por parámetro; **ninguno está calibrado con vuestro caso**.
2. **El orden fijo del plan puede ser el equivocado.** Con un tipo marginal del 37 %, aportar a una pensión ahorra más el primer año que lo que cuesta casi cualquier deuda; el plan pone la deuda antes. Se respeta y se avisa, pero la pensión inmoviliza el dinero y **tributa al rescatarlo**: el «ahorro» es diferir, no ganar. Es una decisión del hogar, no un error de la app.
3. **El tipo marginal sale de la retención declarada en Ajustes › Fiscal**, que no es el tipo marginal (es la retención de la nómina). Es el dato que hay (A15-1); con él la tarjeta puede animar a aportar a una pensión por una razón fiscal falsa. La app no calcula tramos reales.
4. **El límite de aportación (1.500 €) sale de una tabla con una sola fila (año 2022)** y no incluye el margen de empresa. Verifícalo con la AEAT para el año en curso.
5. **La comisión de amortización anticipada no se descuenta** (no se guarda por contrato); se dice. El coste implícito de una deuda puede ser muy distinto de su TIN real si hay comisiones o seguros ligados.
6. **«Invertir lo que sobra» con una rentabilidad tecleada es tan fiable como esa rentabilidad.** Es la cifra más manipulable de toda la tarjeta: con un 12 % esperado casi cualquier deuda queda por debajo del umbral.
7. **No lee la política de inversión firmada (WP-39)**: no impide invertir en un tipo que la política excluye ni respeta su banda. Es el siguiente paso natural, y por eso WP-42 no puede contarse como hecho.

## 5. Pendiente

- Peldaño de **fondos traspasables** y comparador de **liquidez ociosa** (NIN-08) con los tipos de WP-13.
- ~~Cruzar con la política de inversión firmada (WP-39) y con el plan B (WP-38)~~ (hecho el 13/10/2026, §6, **solo como aviso**: el euro no se redirige solo al colchón).
- Aviso proactivo en Cierre; en Hoy, tras H-02.
- **WP-47** (reparto de la nómina en un paso) consume este motor.
- Del hogar: declarar la **TAE de cada contrato** (hoy ninguno la trae), anotar lo aportado a pensiones en el año, y decir con qué rentabilidad esperada quiere comparar.

## 6. Segunda entrega (PR-2, 13/10/2026): el reparto frente a la política firmada y el plan B

Los riesgos 4.7 y la fila «cruzar con WP-39 y WP-38» del §5 eran el siguiente paso natural. Se hace como **aviso**, no como regla:

- **Qué hace:** `crossChecks` (motor puro, `canonical-next-euro.js`) recibe ya calculado lo que dicen los otros motores y compone un bloque «Frente a vuestra política y vuestro plan B» bajo la escalera. **Política:** cada tipo de activo al que iría lo que se invierte se comprueba como una *compra* con `checkOperation` (el mismo motor que la consulta de WP-39 y que el registro de operaciones); dice cuáles contradicen (con la regla), cuáles piden cuidado y cuáles no se pueden comprobar. **Plan B:** si `evaluate` da «salta» o «en vigilancia» y el reparto manda dinero a pensión o inversión (lo que se inmoviliza o puede bajar), lo dice con el importe.
- **Lo que NO hace, a propósito:** **no reordena la escalera ni redirige el euro al colchón** (el diseño original lo sugería para el plan B). Reordenar en silencio contradice la regla del §2 («el orden es el del plan y no se reordena en silencio»), y la app no sabe si lo acordado en el plan B sigue siendo lo que queréis hoy. **No bloquea** nada y no pide motivo (eso es del registro de operaciones, WP-39).
- **Honestidad:** sin política ni plan B guardados, **no sale nada**; sin dinero a invertir, no se comprueba la política; una política o un plan **sin firmar o cambiado tras firmar** se marca como borrador; **«no se puede comprobar» no se presenta como «cumple»** (sin objetivos por tipo en Rebalanceo, la tarjeta dice que no sabe en qué tipos iría); un plan B incompleto o sin previsión se dice, no se presenta como «va bien». «No choca con ninguna regla que la app pueda comprobar» es todo lo que se afirma cuando todo cumple.
- **Lo que se comprobó:** pruebas unitarias del cruce (cinco casos y sus límites, y que la tarjeta solo pinta y no escribe) y una prueba de navegador con datos INVENTADOS (cartera 100 % fondos, objetivos 50/50 con cripto, política firmada que no compra cripto, plan B firmado con un umbral que salta): sin nada guardado no sale nada, con política avisa de la cripto, con plan B avisa del dinero que se inmoviliza, el reparto es el mismo con o sin el cruce. **Comprobado que la prueba de navegador detecta el fallo**: quitando el bloque de la tarjeta en el sitio construido, cae justo en él.
- **Lo que sigue sin cerrar el paquete:** los **tres umbrales de la escalera siguen siendo míos y sin calibrar** (2 puntos, 6 %, 30 %): cruzarla con la política no los mejora. **Fondos traspasables y liquidez ociosa siguen sin estar** (necesitan el régimen de traspaso de cada fondo y los tipos de WP-13). **Nada se ha visto con una política o un plan B reales**: nadie ha firmado ninguno (H-12, 18/12). Las alertas del cruce solo se ven al abrir Deuda › Comparar; no hay aviso en Cierre ni en Hoy.

## 7. NIN-08 · el dinero parado (30/10/2026; publicado el 31/10 con #571, encendido desde el 4/11)

El hogar pidió el 30/10 «el siguiente paquete del plan», con una condición propuesta por Claude y aceptada: se construye ya, pero **se fusiona el 4/11**, con octubre firmado. *(El 31/10 el hogar adelantó la publicación para importar Mediolanum en el cierre; la función sigue dormida hasta el 4/11 por su fecha.)* Lo que faltaba de NIN-08 era la mitad «dónde poner la liquidez ociosa». Se resuelve sin los tipos de WP-13: los tipos los escribe el hogar.

- **Qué es dinero parado.** El mínimo de liquidez que da la previsión mes a mes (motor diario, `canonicalDailyEngineRuns.active.monthly[].minTotal`, «según el plan»), desde el mes en curso, menos el suelo del colchón (el mismo que usa la escalera). Se calcula a 3, 6 y 12 meses.
  - Con menos meses de previsión que el plazo, ese plazo no se calcula.
  - Si la previsión baja del suelo, el resultado es cero, nunca negativo.
  - Sin suelo o sin previsión, no hay cifra.
- **«Repartir X € en la escalera»** lleva lo parado a 6 meses al importe de la escalera, como dinero que ya está en las cuentas, y la calcula.
- **El comparador.** Tres productos (cuenta remunerada, depósito y letras del Tesoro), con la TAE y el plazo que escribe el hogar.
  - Cada uno rinde sobre lo parado durante **su** plazo y da bruto, neto (con el tipo del ahorro de la app) y **neto al año**, que es lo comparable entre plazos distintos.
  - **No elige «el mejor»**: la liquidez de cada producto pesa distinto para cada hogar y la app no lo sabe.
  - Sin tipo del ahorro, solo el bruto, y se dice.
- **Motor:** `idleCash` en `canonical-next-euro.js`, puro. **Interfaz:** `escalera-ui.js` (`#proxEuroParado`, arriba del formulario de la escalera, sin titulares h2/h3).
- **Funciones en prueba:** «dinero-parado», interruptor propio, `encendidaDesde` el 4/11 (revisión a los 14 días). Medidor de uso: «llevado a la escalera o comparado».
- **Campos:** de texto con teclado decimal y coma española, como los importes de WP-11. La E2E lo detectó: en un campo numérico «2,5» no se puede escribir.
- **Riesgos a cuestionar:**
  - El mínimo es el de la previsión según el plan, no el peor caso. La banda P10 (WP-16) solo mira 30 días y la incertidumbre de las fechas.
  - El mes en curso cuenta entero, también los días ya pasados, lo que da una cifra prudente.
  - El impuesto aplica el tipo del ahorro de la app a todo el rendimiento, sin tramos.
- **Pruebas:** `tests/nin08-dinero-parado.test.cjs` (6) y la E2E «NIN-08 · dinero parado» a 1280 y 390 px.

