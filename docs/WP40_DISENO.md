# WP-40 · Conciliación con la CIRBE — diseño

Paquete del plan definitivo (DAC-01, Ola 3, ≈ 1,5 sesiones). **Primera entrega el 9/10/2026**, sin dependencias del hogar para construirla (lo que sí necesita del hogar es el informe, §5). Estado: **en curso**. Está hecha la conciliación operación a operación con los tres estados del plan; **segunda entrega el 13/10/2026: el recordatorio anual ya está en el calendario del móvil** (§3 y §6). Queda en curso porque ningún informe real está tecleado.

## 1. Qué hace

La tarjeta **«Conciliación con la CIRBE»** en **Deuda › Contratos**, bajo la tabla de contratos (`cirbe-ui.js`, `cirbe.css`; motor puro `canonical-cirbe.js`; almacén `cirbe-report`, en la copia). El hogar **teclea una fila por operación** del informe del Banco de España (fecha del informe, de quién es, entidad, tipo, titularidad, importe dispuesto y vencido si lo hay) y la app la casa con los contratos que ya hay:

| Estado | Qué significa |
|---|---|
| **✓ Cuadra** | Hay un contrato de la misma entidad y tipo, y el importe coincide con tolerancia (el mayor de 50 € o el 3 %) |
| **◐ Difiere** | Hay contrato, pero el importe no coincide: dice **cuánto y en qué sentido** («la app tiene 500 € más que el informe»), y si la app tiene menos, que puede ser normal por las cuotas pagadas desde la fecha del informe |
| **⚠ Falta en la app** | El informe enseña una operación sin contrato que case. Lleva el botón **«Añadir a Contratos»** |
| **◐ Aval: revisar a mano** / **⚠ Falta en la app** | Los avales no se casan con contratos (§2); sin aval declarado, falta; con cuota declarada, se revisa a mano |
| **◐ No sale en el informe** | Aparte y más suave: un contrato de la app que ninguna fila del informe casa |

Además: **«el informe dice vencido: X €»** destacado en la fila (es lo que más pesa en una negociación con un banco), un resumen («De 4 operaciones del informe: 1 cuadra, 1 difiere, 2 faltan en la app»), lo que falla **primero** y lo que cuadra al final, y la **edad del informe**: al día, «toca pedirlo otra vez» a 30 días del año y «más de un año». Quitar una fila o borrar el informe se puede **deshacer**.

**Nunca se conecta a la CIRBE ni escribe en los contratos** (A11-4): «Añadir a Contratos» solo rellena el formulario de alta que ya existe (entidad, tipo, capital) y lo enfoca; quien lo envía decide. Una prueba comprueba que la tarjeta no toca los contratos.

## 2. Reglas que el motor hace cumplir (con prueba)

- **Sin informe no hay conciliación, y no dice «todo cuadra».** Sin filas o sin la fecha del informe, la tarjeta lo dice y pide la fecha.
- **La misma operación en el informe de las dos personas cuenta una vez.** La CIRBE es individual: una hipoteca de los dos sale en los dos informes. Si dos filas **cotitulares**, de informes distintos, de la misma entidad y tipo, tienen importes parecidos, se fusionan («sale en los dos informes»). Dos **titulares** individuales de la misma entidad **no** se fusionan: son dos operaciones.
- **Los nombres de entidad se normalizan:** «CaixaBank, S.A.» y «CAIXABANK» son lo mismo; «Santander» casa con «Santander Consumer Finance» (los términos del nombre corto están todos en el largo). Es laxo a propósito: la tarjeta enseña los dos nombres, y el tipo y el importe lo afinan.
- **Dos contratos de una misma entidad** se reparten por cercanía de importe, no por orden de entrada.
- **El tipo igual manda; el tipo distinto casa por entidad pero avisa** («el tipo no coincide con el del informe»).
- **Un contrato liquidado o reunificado no se espera en el informe** (el reunificado ya no es una operación aparte: lo es el plan reunificado, que sí está en la lista).
- **Los avales no se casan con contratos.** La app guarda **una cuota mensual de avales**, no una lista: sin ella, el aval del informe «falta»; con ella, «revisar a mano».
- **Lo que falta en el INFORME no se presenta como un error:** hay préstamos entre particulares e importes pequeños que no salen.

## 3. Dónde se aparta del plan, y por qué

| El plan decía | Lo entregado | Por qué |
|---|---|---|
| «Recordatorio anual» | **En la primera entrega, solo dentro de la tarjeta** (superado por §6) («Toca pedir el informe otra vez»), no en el calendario del móvil | Meter un tipo nuevo de evento en `canonical-reminders.js` toca el motor de recordatorios (lista de tipos, ajustes, pruebas que fijan las cuentas) y la pantalla de Ajustes de WP-32. Es un paquete pequeño y separable, y no lo he mezclado con éste. **Es lo que impide contarlo como hecho** |
| «Introducir (o pegar) el informe» | Solo **introducir** | El informe oficial es un PDF y su formato no lo tengo verificado; pegar texto sin una muestra real sería inventar un lector. Con 1-2 informes reales editados se puede añadir, como se hizo con la nómina |
| «Conciliar con el inventario de `canonical-debt-contracts.js`» | Contra las filas que ya usa la pantalla de Contratos, **con el plan reunificado incluido** | Es lo que el hogar ve en esa pantalla |

## 4. Riesgos y decisiones a cuestionar

1. **Depende de que el hogar teclee el informe.** Son pocas filas, pero es trabajo manual una vez al año, y **ningún dato real está cargado**. Como todo lo de esta racha, **la métrica («errores de registro encontrados») no se puede leer hasta que lo haga**.
2. **Cómo muestra el informe oficial cada operación lo he supuesto, no verificado.** Asumo que cada cotitular ve el **importe total** de la operación (no su parte) y que el campo comparable es el «riesgo dispuesto». Si el informe real enseña la parte de cada uno, las operaciones conjuntas saldrán «difiere» a la mitad. **Con el primer informe real hay que mirarlo**, y por eso las diferencias se explican en lugar de dar un veredicto.
3. **El umbral de 1.000 €** por debajo del cual el informe no recoge operaciones es lo que recuerdo, no lo he verificado; la tarjeta dice «compruébalo».
4. **El casado de entidades es laxo.** «Santander» y «Santander Consumer» son entidades distintas con una raíz común; el tipo y el importe lo corrigen casi siempre, pero un hogar con dos préstamos de entidades emparentadas puede ver un casado equivocado. Ambos nombres están en pantalla.
5. **La tolerancia (50 € o 3 %) es una decisión mía.** Con el informe a 10 meses vista, la app tendrá menos capital que el informe por las cuotas pagadas: saldrá «difiere» con un signo que se explica, no «cuadra». Es más honesto que ocultar la diferencia, pero puede resultar ruidoso.
6. **No casa operaciones por número de contrato:** el informe de la CIRBE no lo trae de forma comparable. Entidad, tipo e importe es lo que hay.
7. **El procedimiento para pedir el informe** (gratuito, con certificado o Cl@ve) es lo que sé a fecha de hoy: la tarjeta dice «verifica el procedimiento actual».

## 5. Pendiente

- ~~Recordatorio anual en el calendario~~ (hecho el 13/10/2026, §6).
- **Que el hogar pida y teclee el informe de cada persona** (por el chat, según el plan) y mirar si lo supuesto en el punto 2 de §4 se cumple.
- Leer del informe pegado como texto, solo con una muestra real.
- Llevar el aviso «informe vencido» a la bandeja de Hoy, **tras H-02**.

## 6. Segunda entrega (PR-2, 13/10/2026): el recordatorio anual en el calendario del móvil

La primera entrega dejó fuera el aviso en el calendario porque tocaba el motor de recordatorios de WP-32. WP-32 está hecho desde el 7/10 y el tipo `rateReview` (WP-20) ya había abierto el camino, así que ahora es un tipo más:

- **Qué hace:** un evento «Toca pedir el informe de la CIRBE» (`kind: "cirbe"`, `rec-cirbe-<fecha>`) a los **335 días** del informe tecleado, que es **exactamente** el día en que la tarjeta pasa a «toca pedirlo». La fecha no se recalcula en el motor de recordatorios: la da `reportStatus` del motor de la CIRBE a través de `cirbeCalendarItems()` (`cirbe-ui.js`), y el motor de recordatorios solo recibe fechas. Si ese día ya pasó, un aviso para hoy.
- **Qué no hace, a propósito:** **sin informe tecleado no genera nada**. Podría proponer «pedid el informe» a todo el mundo, pero sería un aviso sin base en un día inventado, que es el ruido que WP-32 quiere evitar. El coste: quien nunca teclea el primer informe nunca recibe el aviso. El primer informe sigue dependiendo del hogar (§5).
- **El título no lleva datos** (ni fecha ni importes ni nombres): sale en la pantalla de bloqueo. El detalle, que solo se ve al abrir el evento, lleva la fecha del último informe y dónde teclear el nuevo; **no afirma cómo se pide**, solo «verificad el procedimiento actual».
- **Límites que siguen:** el fichero cubre 6 meses y se descarga a mano, así que el aviso solo llega si se regenera dentro de esa ventana; un `.ics` no puede borrar, de modo que al actualizar el informe el aviso viejo ya importado se queda en el calendario hasta que se borre a mano. Se probó el cableado con el navegador real (sin informe no sale; con uno de hace 340 días sale en el `.ics` con el título sin datos; se apaga) y el motor con pruebas unitarias.
- **Decisión a cuestionar:** 335 días es el valor que ya usaba la tarjeta; no he comprobado que sea el margen adecuado para un trámite que depende de cita o certificado. Si resultara corto, es un solo número en `canonical-cirbe.js` y el aviso del calendario lo hereda.
