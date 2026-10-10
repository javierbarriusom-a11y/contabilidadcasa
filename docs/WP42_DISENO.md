# WP-42 · Escalera del próximo euro — diseño

Paquete del plan definitivo (CAR-03 + NIN-05 + NIN-08, Ola 3, ≈ 7 sesiones: el más grande). **Primera entrega el 10/10/2026**, sin esperar a WP-17 (cartera como tablero), que el plan marca como dependencia y sigue pendiente: lo que WP-42 necesita de ella (el reparto de la cartera y sus objetivos) ya existe en Inversión › Rebalanceo y se lee de ahí. Estado: **en curso**. Están cuatro de los cinco peldaños y el rebalanceo por aportaciones; **faltan los fondos traspasables y el comparador de la liquidez ociosa** (§3), y nada se ha probado con datos reales del hogar.

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
- Cruzar con la **política de inversión firmada** (WP-39) y con el **plan B** (WP-38: si el disparador salta, el euro va al colchón).
- Aviso proactivo en Cierre; en Hoy, tras H-02.
- **WP-47** (reparto de la nómina en un paso) consume este motor.
- Del hogar: declarar la **TAE de cada contrato** (hoy ninguno la trae), anotar lo aportado a pensiones en el año, y decir con qué rentabilidad esperada quiere comparar.
