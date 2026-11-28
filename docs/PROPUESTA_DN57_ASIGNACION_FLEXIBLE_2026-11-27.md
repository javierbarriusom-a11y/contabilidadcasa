# D-N57 · Asignación flexible, y cuatro propuestas (27/11/2026)

Sesión coordinadora del 27/11 (PROJECT_STATE 559). Parte de dos capturas del hogar: la ventana «Registrar gasto nuevo» y la
ficha de PELAYO MUTUA (recibo de previsión de 832,26 €, «Sin asignar todavía», sin forma de crear una partida desde ahí).

## 1. La decisión (D-N57, 27/11)

Pregunta: con varios meses elegidos, ¿qué pasa con el importe? **Respuesta del hogar: las dos cosas, eligiendo.**

- **Repetir** el importe en cada mes elegido (un previsto recurrente: 50 € en enero, abril, julio y octubre). **Hecho en este PR.**
- **Repartir** un pago entre los meses que cubre (832,26 € → 69,36 € al mes durante 12 meses), con una provisión aparte para que
  Cierre siga cuadrando. **Fase 2, PR propio** (§3): no se mete a medias.

## 2. Lo que sale en este PR

**«Registrar gasto» (Hoy › + Registrar gasto, en los dos temas):**
- **Partida:** «Partida nueva con este concepto» (lo de siempre; pide bloque) o cualquier partida de gasto que ya exista,
  agrupadas por bloque. Con una existente, el bloque se oculta.
- **¿Qué meses?** Solo este mes (por defecto: exactamente lo de antes) · Un periodo (desde-hasta) · Meses concretos (casillas).
  Solo meses abiertos.
- **Regla del importe:** hasta el mes de la ventana (y un mes anterior aún abierto), **real**; después, **previsto**. Un gasto
  que aún no ha pasado no puede ser real. En una partida que ya existe, el previsto de cada mes sube en el importe y se enseña
  «antes → después»; una partida de deuda no se toca (su previsto lo pone el plan de deuda) y se dice.
- **«Qué ocurrirá»** debajo, mes a mes, antes de pulsar; después, **«Deshacer»** de 10 s que lo devuelve todo.
- Con «Partida nueva» y «Solo este mes», el camino es el de siempre (`submitHomeQuickExpense`, mismas pruebas FLU-2).

**Ficha de un movimiento (los dos temas):** bajo el selector, «¿No está? + Nueva partida» (nombre y bloque del tipo del
movimiento, «Crear y elegir», ↵ crea, Esc vuelve). Es la de Clasificar (2/11): previsto 0 € en los meses del plan desde el del
movimiento, sin los firmados; un nombre que ya existe elige esa. Crear **no asigna**: queda elegida y «Guardar partida» hace lo
de siempre, con su «¿A cuáles?» y su «Deshacer».

**Dónde vive:** `gasto-flexible-ui.js` (nuevo; la parte pura `gastoFlexPlan` se prueba en Node) y `ficha-movimiento-ui.js`;
`app.js` cambia 2 líneas (techo ARQ-4: le quedan ~60).

## 3. Fase 2 · Repartir un pago entre meses, con provisión (propuesta, P0 · M, F1)

**Problema contable.** Cierre compara, mes a mes, el banco con los reales. Si el recibo de 832,26 € de noviembre se reparte
como 69,36 € de real en cada mes, noviembre tiene 762,90 € de banco sin real y los once meses siguientes, real sin banco: los
doce meses descuadran. Por eso no basta con «dividir el importe».

**Diseño (el de un fondo de amortización, no inventado):**
1. «Repartir» crea una **provisión** con nombre (la de «Seguro de previsión»), su importe total y sus meses.
2. **El mes del pago:** el real de la partida es solo su cuota (69,36 €) y el resto (762,90 €) va a la provisión como
   «pagado por adelantado». Cierre cuenta la provisión como un traspaso a una cuenta propia (la lógica de DAT-05), así que cuadra.
3. **Cada mes siguiente:** la provisión libera su cuota a la partida como real sin banco, marcado «de la provisión», y Cierre
   lo excluye del cuadre banco/real como ya hace con los traspasos.
4. **Al revés también (lo más útil):** para un pago que **viene** (el WP-49, «Mapa de pagos», ya los detecta: seguros, IBI),
   «Apartar cada mes» reparte el previsto hacia atrás: 69,36 € al mes hasta la fecha del recibo. El gráfico de la previsión
   deja de tener el pico.
5. Desde la ficha del movimiento: «Repartir este pago» junto a «Dividir en varias partidas».

**Riesgos y por qué va aparte:** toca Cierre (cuadre y firma), la previsión diaria y la copia de seguridad; necesita sus
pruebas de cuadre con meses firmados. **Antes de construirla, medir:** cuántos pagos no mensuales tiene el hogar en 12 meses
(WP-49 lo sabe). Si son menos de 4, la vía 4 sola basta.

## 4. Cuatro propuestas (regla 8 de §7: cuatro como máximo, cada una sustituye algo o tiene fecha)

El prompt pedía 6-10; manda la regla 8 (D-N56 g, decisión del propio hogar). Buscadas antes en `capacidades.json` (regla 4).

**D-N58 (27/11, decisión del hogar): «Sí a las 4 propuestas».** P1 a P4 adoptadas, en F1 (antes de la congelación del 14/1). Orden recomendado: P3 (pequeña, quita un error real) → P4 (a) → P2 (con DS-1) → P1 (la más delicada: toca Cierre), cada una en su PR y midiendo antes lo que se dice en cada una (P1: pagos no mensuales en 12 meses; P4: partidas de un solo gasto).

### P1 · La fase 2 de arriba: repartir y apartar (F1, sustituye los picos de la previsión)
Ver §3. Se apoya en WP-49 (mapa de pagos) y DAT-05 (traspasos); no añade pantalla, añade una opción a dos que ya existen.

### P2 · Un solo «Elegir partida» en toda la app (F1, con DS-1; sustituye cinco selectores nativos)
Hoy elegir partida es un `<select>` nativo con todas las partidas «Bloque · Partida» (cien y pico opciones) en **cinco** sitios:
Clasificar («Otra…»), la ficha, Dividir, Registrar gasto y Cierre. En el iPhone es una rueda imposible de recorrer.
**Propuesta:** un componente único: buscador con teclado (escribir «pel» encuentra «Seguro de previsión»), arriba la
**propuesta** con su confianza (la de Clasificar) y las **3 recientes**, luego por bloque, y al final «+ Nueva partida» (la de
hoy, una sola implementación en vez de dos). Accesible como `combobox` (ARIA 1.2), 44 px de toque. **Sustituye** los cinco
selectores y las dos copias de «Nueva partida» (Clasificar y ficha): menos código, no más.

### P3 · Errores en su campo en todos los formularios (F1, mejora de diseño sin superficie)
**Hecho el 28/11** (PROJECT_STATE 559, adenda): un oyente común (`errores-campo.js`) para todos los formularios con `required`, no solo los tres primeros.
La captura lo enseña: el globo nativo «Completa este campo» de Safari salía sobre «Bloque», que estaba bien; lo que faltaba era
el concepto. La ficha y Clasificar ya dicen el error junto al campo (3/11); las ventanas de diálogo, no.
**Propuesta:** `novalidate` en los diálogos y el patrón de la ficha (texto bajo el campo, `aria-invalid`, foco al primero que
falta). Primero «Registrar gasto», la hoja de captura y Contratos. **Sustituye** la validación nativa, que no se puede ni
traducir ni colocar.

### P4 · Que «Registrar gasto» deje de crear una partida por gasto (F1, sustituye partidas sueltas)
**(a) hecho el 28/11** (PROJECT_STATE 559, adenda). **(b) pendiente:** hay que medir en el navegador del hogar cuántas partidas de un solo gasto hay, y juntarlas quita partidas, así que necesita su visto bueno (CLAUDE.md).
Hasta hoy cada gasto apuntado a mano creaba **una partida nueva con su concepto** («Farmacia», «Gasolina 12/11»…): el plan se
llena de partidas de un solo mes que nadie revisa. Con D-N57 ya se puede elegir una existente, pero el defecto sigue siendo
«nueva». **Propuesta:** (a) el defecto pasa a ser **la partida que propone la regla del concepto** (la misma de Movimientos,
`mappingForMovement`), y «nueva» solo si no hay; (b) en Plan › Partidas, «Partidas de un solo gasto» lista las creadas así y
las **junta** en la que elijáis, con «Qué ocurrirá» y «Deshacer» (los reales se suman, nada se borra). **Antes, medir** cuántas
hay en los datos del hogar: si son menos de 5, solo (a).

## 5. Lo que he visto y no he cambiado (para decidir)

- **«¿Era de ago 26? Anotarlo en ese mes»** sale el 27 de noviembre. El enlace se pensó para los días 1-3 (WP-09), pero con
  agosto aún sin firmar (CIE-01) agosto sigue abierto y se ofrece tres meses después. Con «Meses concretos» ya se puede elegir
  agosto si de verdad era de agosto; recomiendo que el enlace salga solo para el mes **inmediatamente anterior**. No lo he
  tocado: cambia un comportamiento probado (FLU-2) y es del hogar decidirlo.
- **Crear una partida en la ficha y no guardar** deja la partida (con previsto 0 €, sin efecto en el plan), igual que en
  Clasificar. Si molesta, P2 lo resuelve creando la partida al guardar y no al elegir.
