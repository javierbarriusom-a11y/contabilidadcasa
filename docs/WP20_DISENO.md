# WP-20 · Revisión del tipo variable de la hipoteca — diseño

Paquete del plan definitivo (NDB-02, Ola 2, ≈ 1,5 sesiones). **Activo desde el 3/10/2026**: la hipoteca del hogar es variable. Construido el 7/10/2026 sobre WP-13 PR-1 (índices tecleados con fecha), **sin esperar a la decisión de `O-6`**.

## 1. El problema

La hipoteca se revisa en marzo y el preaviso útil cae a primeros de enero (≈ 60 días antes). Hoy la app sabe comparar variable frente a fija (DI1/DEB4) pero **no sabe cuándo se revisa, qué dato del Euribor se leerá ni cuánto subirá o bajará la cuota**. Se entera el hogar cuando llega la carta del banco, cuando ya no hay margen para mover nada.

## 2. Lo que se entrega

Una tarjeta en **Deuda › Contratos › «Revisión del tipo variable de la hipoteca»** (`revision-tipo-ui.js`; motor puro en `canonical-rate-review.js`):

| Qué | Cómo |
|---|---|
| **Datos del contrato** | Capital, cuota y plazos (o vencimiento) **se leen del contrato ya declarado** en la tabla de arriba (tipo «Hipoteca», activa). Solo se guardan los datos que ese contrato no tiene: diferencial, bonificación incluida, tipo aplicado, fecha de la próxima revisión, periodicidad (12 o 6 meses) y regla del Euribor. Almacén `rate-review`, por contrato, en la copia y la nube |
| **Regla del índice** | **Media mensual** del Euribor de N meses antes (1 a 3) o **valor de un día** a N días antes (0 a 60). La tarjeta dice qué dato se leerá: «la media mensual del Euribor de febrero de 2027» |
| **Cuota estimada «de A a B»** | Tipo central = último Euribor tecleado + diferencial; A y B = ese tipo ∓ 1 punto. Cuota francesa sobre el **capital y los plazos proyectados a la fecha de revisión** (con tipo aplicado y cuota; sin ellos, los de hoy, y se dice) |
| **Bonificación** | Si el diferencial incluye una bonificación por vinculaciones, la cuota central si se **pierde** (+N puntos) |
| **Avisos a 60 y 30 días** | En la tarjeta y, **solo dentro de esos plazos**, una pregunta en la bandeja de Hoy («Revisión del tipo en N días») |
| **Revisión ya pasada** | Se desplaza por periodos completos hasta la siguiente y lo dice |
| **Ejemplo** | `<details>` con cifras inventadas, marcado «EJEMPLO · cifras inventadas, no son las tuyas» (mismo criterio que WP-23) |

### Lo que NO es

- **No pronostica el Euribor.** Lo deja donde el hogar lo tecleó y lo mueve ± 1 punto **como rango de lectura**, no como probabilidad.
- **No cubre IRPH ni otros índices** (solo Euribor 12 meses). Una hipoteca a IRPH no sale en la tarjeta con sentido: se dice.
- **No ejecuta nada** (`A11-4`): no renegocia, no amortiza, no cambia el contrato. Dice dónde está el dinero antes de decidir.

## 3. Decisiones que conviene cuestionar

1. **±1 punto es una convención, no una distribución.** El Euribor puede moverse más de un punto en seis meses; la banda no es un intervalo de confianza. Se dice en la tarjeta. Una alternativa (escenarios del Laboratorio E13: −1 / +1,5) añadiría asimetría que nadie ha calibrado. Si el hogar prefiere ese marco, es un cambio de constante.
2. **El «tipo central» usa el último valor tecleado, aunque esté caducado.** Se avisa, pero se calcula igual; la alternativa (no calcular) esconde la cifra justo cuando el hogar más la necesita, y el aviso la acompaña. Si el Euribor no está, **no se calcula** y la tarjeta dice qué falta.
3. **La proyección del capital usa la cuota y el tipo declarados.** Si la cuota no cubre los intereses (dato mal tecleado), no se proyecta y se avisa. El número de cuotas hasta la revisión se redondea a meses (± 1 cuota): el error es del orden de décimas de euro en la cuota.
4. **«Hoy congelado» no se rompe.** El aviso en la bandeja solo existe dentro de los 60 días previos; con una revisión en marzo, no aparece hasta enero (regla `BACKLOG_DEFINITIVO.md` §4, excepción (b)). Antes de esa fecha, Hoy es idéntico.
5. **Una configuración por contrato**, no un modelo de «condiciones» dentro del contrato: el contrato (`canonical-debt-contracts.js`) no tiene estos campos y migrarlo exigiría tocar el contrato de estado y `app.js` (37.4xx de 37.495). Coste: los datos de la revisión no viajan con el contrato si se borra y se vuelve a dar de alta.
6. **Sin el tipo aplicado actualmente no se proyecta el capital**: la cuota estimada sale algo más alta de lo que será. Es un campo opcional a propósito (la carta del banco lo trae, pero no siempre a mano).

## 4. Pendiente

| Qué | Cuándo |
|---|---|
| **Evento de calendario** con los avisos de 60 y 30 días (WP-32 `.ics`) | PR-2 de WP-20: añade un tipo de aviso al motor de recordatorios. No se hace ahora para no ampliar el alcance de este PR |
| **Datos reales del contrato** (diferencial, fecha, regla, tipo aplicado) | Hogar, H-07 (13/11): en Deuda › Contratos. Hasta entonces la tarjeta enseña «Rellena los datos…» y el ejemplo |
| **Leer el Euribor oficial** | WP-13 PR-2, tras `O-6` (16/10) |
| **Unificar con el radar DEB4** (Ajustes) | PR-2 de WP-13: hoy hay dos sitios donde teclear el Euribor |
| Medir: «aviso a ≥ 60 días de la revisión con la cuota estimada» | Con uso real: sin datos del hogar hoy |

## 5. Cómo se prueba

- `tests/wp20-revision-tipo.test.cjs`: cuota francesa igual a la de DI1 y a un caso conocido (100.000 € al 3 % a 20 años = 554,60 €), capital proyectado, regla del contrato (media de N meses antes cruzando de año; valor de un día), cada dato que falta, banda ordenada, Euribor negativo, proyección con y sin tipo aplicado y con cuota que no cubre intereses, avisos en 61/60/31/30/0 días, desplazamiento de revisiones pasadas (12 y 6 meses, fin de mes, bisiesto, cinco años), Euribor caducado, bonificación, ausencia de red y de DOM, y cableado.
- `tests/qa1-flujos-completos.spec.cjs`: alta de una hipoteca, datos de la revisión, resultado en 1280 y 390 px, rechazo de datos mal tecleados, aviso en la bandeja de Hoy solo dentro de los 60 días.
- `tests/opt4-axe-accessibility.spec.cjs`: la tarjeta en claro y en oscuro, con resultado y ejemplo.
