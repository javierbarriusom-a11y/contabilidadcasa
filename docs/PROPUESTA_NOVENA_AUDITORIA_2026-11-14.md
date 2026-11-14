# Novena auditoría · 14/11/2026 · Diagnóstico crítico, 53 funciones nuevas y plan para recalcular la previsión hasta 2036

> Pedida por el hogar el 14/11/2026: «analiza la app de manera crítica… más de 40 funciones nuevas… seguir profundizando en las
> previsiones y la actualización de datos… mejorar inversiones, optimizar la deuda actual y la nueva». Incluye las dos peticiones
> concretas del mismo día: **(1)** recalcular la previsión hasta 2036 con el gasto variable real (§3, **propuesta para aprobar,
> no ejecutada**) y **(2)** la sección del préstamo para saldar deuda (§2, **construida** en Deuda › Préstamo).
>
> **Sin importes del hogar** (el repositorio es público). Las cifras de ejemplo son inventadas o son las condiciones públicas del
> simulador del banco que enseñó el hogar. Es una propuesta: el único backlog vivo sigue siendo `BACKLOG_NOVIEMBRE_OLEADA_1.md`.

---

## 0. Resumen en cinco frases

1. **El problema más grave no es de funciones, es de cimientos:** el libro de origen no tenía gasto variable y la app lo tapó
   con una cifra fija (1.750 €/mes desde junio, por migración) que nadie ha contrastado con lo real, sin estacionalidad ni
   gastos irregulares. Todo lo que se apoya en la previsión —fecha de deuda cero, colchón, «Hasta 2036», escenarios,
   guardarraíles de amortizar o invertir— depende de que esa cifra sea buena. Antes de construir nada más sobre la previsión,
   hay que **medirla** (hecho el 14/11, §1.1) y recalcularla si no cuadra (§3). *Corregido el 14/11 por la tarde: la primera
   versión decía «sin gasto variable», y no es así en la app.*
2. **La app tiene más superficie de la que el hogar puede usar:** unas 60 entradas de menú (11 de ellas «versiones anteriores»),
   128 motores, `app.js` con 32.000 líneas. El cuello de botella real, medido, es meter y clasificar datos (71 % con partida;
   objetivo 95 %; 5 de 7 grupos de noviembre sin propuesta). Cada función nueva que no ataque eso compite por los mismos 10
   minutos a la semana.
3. **El préstamo que pediría tu mujer puede ser buena idea, pero no por lo que parece:** su valor está en cancelar lo que sea
   más caro que su TAE (8,84 %) y en mantener el esfuerzo de pago; a 72 meses incumple la regla de 5 años del Taller y, si el
   capital supera lo caro, pagaréis intereses por dinero parado. Y el pantallazo es de un préstamo **finalista** («Coche
   ecológico»): usarlo para cancelar deudas puede no estar permitido (§2.3).
4. **Inversión y Deuda tienen demasiadas pantallas para una sola pregunta.** Deuda tiene 5 pestañas y 4 pantallas heredadas
   con motores distintos (NTC-05 sigue abierto); Inversión, 5 pestañas sin una respuesta a «¿vamos a tiempo?».
5. **Propuesta de secuencia:** primero datos y previsión (DAT, CLA, PRV), luego deuda (DEU/DNV), luego inversión, y en
   paralelo **retirar** (§5). De las 53 funciones, recomiendo 12 para los próximos 90 días (§6).

---

## 1. Diagnóstico crítico

### 1.1 El gasto variable de la previsión es una cifra fija sin contrastar (hallazgo principal)

**Corrección del 14/11 por la tarde, al leer el código:** el libro de origen no traía gasto variable, pero la app sí lo mete.
Desde junio de 2026 el «Gasto variable estimado» vale **1.750 € al mes, fijos**, puestos por una migración
(`variable-operational-1750-from-2026-06-v2`), de los que salen las asignaciones personales. El modelo que lo calcularía solo
(`variableOperationalSpendModel`) queda tapado por esa cifra y, además, solo mira tres categorías (alimentación, efectivo y
otros gastos) y deja fuera la liquidación de la Mastercard. Así que el problema no es «sin gasto variable», es:

- **una cifra fija para diez años**, igual en diciembre que en febrero, sin gastos irregulares (seguros anuales, Navidad,
  ITV) y sin medirla nunca contra lo gastado de verdad;
- **nadie sabe si se queda corta o larga.** Desde el 14/11, la hoja «Por qué la confianza es…» de Plan › Previsión lo mide
  (§3, primera parte). Si se queda corta, todo lo de abajo sale optimista; si se queda larga, pesimista.

Si la cifra se quedara corta, las consecuencias, en orden de gravedad:

| Lo que dice la app | Por qué está mal | Efecto |
|---|---|---|
| Liquidez a fin de cada año hasta 2036 (FX-50) | Le falta, cada mes, todo el gasto variable | Sobrestima la liquidez, y el error **se acumula**: a 10 años es el gasto variable de 120 meses |
| Fecha de «colchón completo» | Se alcanza con un ahorro mensual que no existe | Fecha demasiado temprana |
| «Deuda cero» con extra / próximo euro | El extra sale de un excedente inflado | Propone amortizar con dinero que el mes necesita |
| Guardarraíles de colchón (DEB-15/17, XDA-10) | Miran la liquidez futura | Pueden dar «verde» a una amortización que deja la cuenta justa |
| Confianza de la previsión (FX-31) | Mide datos y supuestos, no si falta una partida entera | Ha podido decir «media» o «alta» con un agujero estructural |

Lo que me parece más importante de este hallazgo no es la cifra, es **el mecanismo**: la app tiene decenas de comprobaciones de
coherencia (FX-01…FX-04, paridades, invariantes) y ninguna compara el gasto variable real de los meses cerrados con lo previsto. Hace falta una comprobación que hoy no existe: **«real frente a previsto por bloque, en los
meses firmados»**, que salte si un bloque se desvía en el mismo sentido 3 meses seguidos (PRV-05 la propone).

### 1.2 Más superficie de la que se puede usar

- **Menú avanzado:** unas 60 entradas, con un bloque de 11 «versiones anteriores» (Plan de deuda, Plan deuda óptimo, Control de
  deuda, Asesor ejecutivo, Asesor virtual, Agente de ahorro, Centro de alertas, dos «Cuadro de mandos»…). Para una persona que
  entra 10 minutos a la semana, esto no es riqueza: es ruido y desconfianza («¿cuál es la buena?»).
- **Gobierno:** el inventario de titulares («uno entra, uno sale») funciona, pero el techo se ha ido subiendo con excepciones.
  La regla sirve si de vez en cuando **sale** algo.
- **Código:** `app.js` ronda las 32.000 líneas con un margen de ~130 bajo su techo. Cada pantalla nueva que necesite lógica en
  `app.js` obliga a desalojar antes. Es el freno técnico más claro de la velocidad futura.
- **Uso medido:** el medidor (XGO-02) ya enseña que lo que se usa es poco y concreto: importar, clasificar, cerrar, mirar Hoy.

### 1.3 El cuello de botella son los datos, no las pantallas

El 14/11 el extracto de CaixaBank confirmó que **los movimientos están al día**; lo que no está es la **partida**: 71 % con
partida, y en noviembre 5 de 7 grupos sin propuesta (Bizum, transferencias, recibos con referencia cambiante, comercios sin
regla). Mientras eso no suba, cualquier análisis por categoría (presupuesto, previsión por partida, base cero) trabaja sobre
el 71 % de la realidad. Por eso CLA-01…CLA-05 van por delante de casi todo.

Matiz importante para el recálculo: **el total de gasto variable no necesita clasificación**. Se puede reconstruir desde las
salidas de las cuentas, quitando lo que sí se sabe que no es variable (fijos, cuotas, traspasos). La clasificación solo hace
falta para repartirlo por categoría. El plan del §3 se apoya en esto para no esperar al 95 %.

### 1.4 Deuda: muchas pantallas, dos motores

Ruta, Comparar, Contratos, Simulador visual (un `iframe` heredado), y en «versiones anteriores» Plan de deuda, Plan deuda
óptimo, Control de deuda. Comparar, por sí sola, apila próximo euro, reparto de nómina, capacidad, oferta de reunificación,
ocho modos por contrato, tres estrategias y su ruta: **siete preguntas en una pantalla**, contra el principio 1 del rediseño
(«una pregunta, una cifra, una acción»). El rediseño de Deuda (D3) está bloqueado tras NTC-05 (un solo motor). La pestaña nueva
de Préstamo (§2) **usa el motor canónico de «Camino a deuda cero»**, no añade un tercer cálculo.

### 1.5 Inversión: cinco pestañas sin la respuesta que importa

Cartera, Rebalanceo, Fiscal, Apalancamiento y Jubilación responden cada una a lo suyo, pero ninguna responde **«¿vamos a tiempo
para nuestros objetivos y qué cambia si…?»**. Y falta la pregunta previa que un asesor haría primero: **¿tiene sentido invertir
mientras haya deuda por encima del 8-20 % TAE?** (INV-02). Con deuda revolving viva, cada euro invertido «rinde» menos que
cancelar.

---

## 2. Deuda › Préstamo para saldar (construido el 14/11)

### 2.1 Qué hace

Nueva quinta pestaña de Deuda, **Préstamo** (`#deuda-prestamo`), pensada para mirarla en pareja:

- **Condiciones editables:** quién lo pide, capital (deslizador 1.000–40.000 € y caja de 500 a 200.000 €), meses (12–120),
  TIN, comisión de apertura, comisión por amortizar antes, extra al mes, ingresos netos del hogar, «plan agresivo» y «contar la
  hipoteca». Parte de la oferta del pantallazo y se recuerda en el navegador; «Volver a la oferta de partida» la restaura.
- **La oferta como la da el banco:** cuota, TIN, TAE (con la comisión de apertura, como TIR), intereses, coste total e importe
  adeudado. Cuadra al céntimo con el simulador: 293,34 €, 4.620,48 €, 21.120,48 €, TAE 8,84 %.
- **Qué cancela:** por defecto, solo las deudas **más caras que el préstamo**, de la TAE más alta a la más baja, hasta agotar el
  dinero; la última puede quedar cancelada en parte. Se puede elegir a mano. Dice lo que se libera al mes y, si sobra dinero,
  cuánto bastaría pedir.
- **Vuestra política de deuda (de `Taller.png`):** préstamo más barato que lo cancelado · plazo ≤ 5 años («Probar a 60 meses»
  en un toque) · sin plan agresivo no se pagan más intereses que hoy · cuota total ≤ 35 % de los ingresos (solo si hay
  ingresos) · aporta frente a pagar lo mismo sin préstamo.
- **Cuatro caminos, con el mismo motor que «Camino a deuda cero»:** *Hoy* · *Con préstamo* (solo cuotas) · *Plan agresivo*
  (seguir pagando lo de hoy + extra, y cada cuota liberada a la siguiente deuda: bola de nieve) · *Mismo esfuerzo sin préstamo*.
  Gráfico de deuda viva, calendario de cada deuda y avisos.
- **La frase honesta:** el veredicto compara el plan agresivo con pagar **el mismo dinero al mes sin pedir nada**. Si el préstamo
  no adelanta ni ahorra, lo dice: «lo que aporta es una cuota más baja, no velocidad».

Motor: `canonical-loan-payoff-plan.js` (puro). Cambio en `canonical-debt-payoff-path.js`: opción `redirectFreed` (por defecto
apagada, el comportamiento de siempre no cambia). No escribe en el plan ni en los contratos (A11-4).

### 2.2 Lo que enseña con una cartera inventada (para entender el mecanismo, no vuestras cifras)

Con una tarjeta al 21,8 %, un préstamo de consumo al 12,5 % y un coche al 7,9 %, la oferta de 16.500 € a 72 meses:

- cancela la tarjeta y el consumo (13.200 €) y **deja 3.300 € sin destino**: el coche es más barato que el préstamo; pedir los
  16.500 € es pagar intereses al 8,84 % por dinero parado;
- **incumple el plazo** (6 años) y, pagando solo la cuota nueva, **cuesta más intereses que hoy** (alarga el plazo);
- con el plan agresivo (pagar lo mismo que hoy) acaba antes y más barato que hoy… pero **pagar lo mismo sin préstamo** llega
  casi igual de rápido.
- Con 13.200 € a 60 meses y 100 € de extra, en cambio, cumple las cinco reglas y adelanta y ahorra frente a no pedirlo.

**Conclusión de método:** el capital y el plazo no se eligen por lo que ofrece el banco, se eligen por **lo que hay que
cancelar** y por **la cuota que el hogar puede mantener**. La pestaña está hecha para encontrar ese punto.

### 2.3 Lo que debéis comprobar antes de pedirlo (crítico)

1. **¿Es un préstamo finalista?** El pantallazo dice «¿Para qué quieres el dinero? · Coche ecológico». Los préstamos de
   proyecto suelen tener mejor tipo porque se condicionan a justificar la compra (factura). Usarlo para cancelar deudas puede
   incumplir el contrato. Pedid un **préstamo personal libre o de reunificación** y meted **su** TIN en la pestaña: casi seguro
   será más alto, y eso cambia el resultado.
2. **Titularidad y CIRBE.** Lo firma una persona: la cuota computa en **su** capacidad de endeudamiento y en su CIRBE durante
   años (afecta a una futura hipoteca o coche). Si las deudas que se cancelan son de la otra persona, se traslada deuda de un
   titular a otro: dejadlo hablado y, si procede, por escrito (régimen económico, qué pasa en una separación o fallecimiento).
3. **Seguro asociado.** Muchos préstamos «sin comisiones» llevan seguro de protección de pagos o vinculación de nómina. No está
   en la TAE de la pestaña: si lo hay, sumadlo (o declaradlo como comisión de apertura equivalente).
4. **Comisión por amortizar antes.** El plan agresivo amortiza el préstamo antes de tiempo. Por ley de crédito al consumo, como
   mucho 1 % de lo amortizado (0,5 % si queda menos de un año). Preguntadla y metedla.
5. **La trampa de la reunificación.** El riesgo número uno no es financiero, es de conducta: cancelar la tarjeta y volver a
   llenarla. Si se cancela una tarjeta o línea, **bajad su límite o cerradla el mismo día** (DEU-05 lo vigilará).
6. **Revolving: posible usura.** Si alguna deuda es una tarjeta revolving con TAE muy alta, el Supremo (STS 258/2023) considera
   usurario superar en **más de 6 puntos** el tipo medio de las revolving que publica el Banco de España. Antes de pagarla con un
   préstamo, merece la pena comprobarlo (DEU-02): una reclamación puede reducir lo que se debe.

---

## 3. Plan para recalcular la previsión hasta 2036 (**propuesta: no ejecutado, espera vuestro «sí»**)

### 3.1 Objetivo y principio

**Primera parte, hecha el 14/11 por la tarde (sin cambiar la previsión):** `canonical-variable-recalibration.js` mide el gasto
variable de cada mes completo con el método del §3.3 (pasos 1, 2, 3 y 7) y lo compara con lo previsto; la hoja «Por qué la
confianza es…» de Plan › Previsión enseña la media real, lo previsto, la diferencia y cuánto se desvió cada uno contra el
pasado, con el detalle por mes. Supone tarjetas pagadas enteras hasta que contestéis la pregunta 1 del §3.6. La proyección
hasta 2036 ya la calcula el motor, pero no se aplica.

Sustituir, desde el primer mes sin firmar hasta diciembre de 2036, el gasto variable del plan (hoy, 1.750 € fijos) por uno **medido en vuestros
movimientos**, con estacionalidad, gastos irregulares y suscripciones bien colocadas (en la **tarjeta Mastercard Carrefour**),
y enseñar **qué cambia** antes de aplicarlo, con «Deshacer».

**Choque con una decisión vigente que hay que resolver:** D-N11 (13-14/11) dice «hasta el 4/12, la prioridad es que lo que entra
quede con partida; **sin previsión nueva**». Este plan es previsión nueva. Mi recomendación: **construir el motor y el backtest
ya, sin cambio visible** (no compite con clasificar) y **aplicar el resultado después del 4/12**, o antes solo si decís
expresamente que la previsión pasa por delante.

### 3.2 Los datos que hacen falta (y lo que ya tenéis)

| Dato | Estado | Para qué |
|---|---|---|
| Movimientos de CaixaBank de los últimos 12-13 meses | Importados (el Excel de 13 meses y el extracto del 7/8 al 12/11) | Salidas totales por mes |
| Movimientos de Mediolanum y otras cuentas | Por confirmar cobertura en la tira de 90 días y en «Mes a mes» | Que no falte un mes en ninguna cuenta |
| **Extracto de la Mastercard Carrefour** con el detalle de compras | Probablemente **no** importado: en la cuenta solo se ve la liquidación, una por tarjeta con el concepto «Financie-<mes>» (hogar, 14/11). Se paga entera cada mes, así que basta con restar las suscripciones del ciclo | Separar suscripciones de compras dentro de la liquidación (exacto con el extracto; estimado sin él) |
| Lista de suscripciones (Netflix, HBO Max, Spotify, Apple, …) con importe y día | Parcial en el plan | Colocarlas en la tarjeta y en su mes de cargo |
| Día de corte y de cargo de la tarjeta (WP-30) | Por confirmar en Ajustes › Tarjetas | Mes en que cada compra sale de la cuenta |
| Meses firmados | Octubre firmado | No se tocan: la historia firmada es intocable |

### 3.3 Método (lo que calcula el motor)

**Paso 1 · Gasto variable de cada mes cerrado, sin depender de la clasificación.** Para cada mes `m` con cobertura completa
(XDA-04):

```
V(m) = salidas de todas las cuentas operativas
     − fijos reconocidos (recibos conciliados con una partida fija del plan)
     − cuotas de deuda conciliadas (las de los contratos)
     − traspasos entre cuentas propias y aportaciones a ahorro o inversión (DAT-05)
     − extraordinarios marcados (> umbral y no recurrentes: avería, viaje, compra grande)
     − liquidación de la Mastercard Carrefour
     + compras de la tarjeta que no son suscripciones (= liquidación − suscripciones cargadas en ese ciclo)
```

La tarjeta se trata aparte a propósito: si la liquidación entera se contara como variable y además las suscripciones siguieran
como fila fija, **se contarían dos veces**. Con el extracto de la tarjeta, la separación es exacta; sin él, se resta la lista
de suscripciones del ciclo y se dice que es una estimación.

**Paso 2 · Base robusta.** Media recortada (sin el 10 % más alto y más bajo) de los últimos 12 meses completos; con menos de
6 meses completos, el motor no propone nada y dice qué falta.

**Paso 3 · Estacionalidad con prudencia.** Índice de cada mes del año `s(k) = V(mes k) / media`, contraído hacia 1 porque solo
hay un año de historia: `s'(k) = 1 + w·(s(k) − 1)`, con `w = n/(n+2)` y `n` = años observados (con 1 año, w = 0,33). Así un
diciembre caro se nota, pero no se copia entero como si fuera ley.

**Paso 4 · Irregulares anualizados (PRV-02).** Pagos que aparecen 1-2 veces al año (seguros anuales, IBI, ITV, matrícula,
Navidad): se detectan por concepto y periodicidad, se colocan en **su** mes y se ofrece la provisión mensual («hucha»).

**Paso 5 · Suscripciones en la tarjeta.** Cada suscripción, con su importe y día, va a la fila de la Mastercard Carrefour en el
**mes de cargo** según el ciclo de la tarjeta (el mecanismo de WP-30 que ya existe), y no como gasto de la cuenta el día de la
compra. Las anuales (p. ej. Amazon Prime), en su mes.

**Paso 6 · Hasta 2036.** `V(t) = base × s'(mes de t) × (1 + π)^(años desde hoy)`, con la inflación del registro de supuestos
(una por defecto; por categoría con PRV-06). Irregulares y suscripciones, con la misma inflación salvo que se diga otra.

**Paso 7 · Backtest antes de proponer.** Con origen móvil: estimar con los meses 1…k y predecir k+1…k+3, para cada k posible.
Se publica el error medio del gasto total mensual. **Criterio de aceptación: error medio ≤ 10 %** y sin sesgo (no siempre por
debajo). Si no se cumple, se dice y no se propone aplicar.

### 3.4 Lo que veréis (asistente en Plan › Previsión, cuatro pasos)

1. **Datos:** meses que entran, por cuenta, y los que no (con «importar este extracto» en un toque).
2. **Gasto variable detectado:** la base, los índices por mes, los extraordinarios que se quitaron (con «no, este cuenta») y el
   error del backtest.
3. **Irregulares y suscripciones:** lista editable; las suscripciones agrupadas bajo la Mastercard Carrefour.
4. **Qué cambia hasta 2036:** antes y después de la liquidez a 31/12 de cada año, el mes más bajo, la fecha de colchón completo y
   la de deuda cero. Botón «Aplicar al plan» con su «Qué ocurrirá» (decisión 6 del rediseño) y «Deshacer».

Escribe en el plan solo las filas de **gasto variable, irregulares y suscripciones**, desde el primer mes sin firmar hasta
diciembre de 2036. Ingresos, fijos y deuda no se tocan.

### 3.5 Cómo se ejecuta (dos opciones)

- **A (recomendada):** construyo el motor y el asistente; lo ejecutáis en la app. **Vuestras cifras no salen del dispositivo**
  ni las veo yo. 2 sesiones: S1 motor + backtest + pruebas (sin cambio visible), S2 asistente + aplicar con deshacer.
- **B (más rápida para ver números):** exportáis la copia (Ajustes › Datos y exportación) y la adjuntáis aquí; calculo el
  recálculo fuera del repositorio, os doy el informe y, si os convence, se aplica con A. Implica que los datos entran en esta
  conversación: decisión vuestra.

### 3.6 Lo que necesito que decidáis

1. ~~La Mastercard Carrefour, ¿se paga entera cada mes o aplazado (revolving, cuota fija)?~~ **Contestada por el hogar el
   14/11: «la pagamos entera, NO revolving».** Es el supuesto con el que ya mide la app (las suscripciones salen de la cuenta en
   la liquidación del mes siguiente y lo demás de la liquidación es gasto variable). El modo «aplazado» del motor queda sin uso.
2. Ventana: últimos **12 meses** (recomendado) o 6.
3. Detalle: **una fila de variable** hasta llegar al 95 % clasificado (recomendado), o por categoría ya.
4. Inflación: la del registro de supuestos, o una propia.
5. Umbral de «extraordinario»: el que mide desde el 14/11 es «un movimiento suelto de más de 500 € que pesa más del 40 % de un
   mes típico y no se repite»; se puede cambiar.
6. Cuándo aplicar: tras el 4/12 (respeta D-N11) o ya.
7. Opción A o B del §3.5.

---

## 4. Catálogo: 53 funciones nuevas

Formato de cada una: **qué** · **por qué** · **UX/UI** · esfuerzo (S ≤ 1 sesión, M 2-3, L 4+) · prioridad (P0 ya, P1 trimestre,
P2 después). Todas siguen las decisiones del rediseño: verde sólido solo para lo que se pulsa, una cifra por pregunta, lo que no
tiene datos se pliega a una línea, nada se retira sin consultar, y toda acción que cambia el plan pasa por «Qué ocurrirá».

### 4.1 Datos y actualización (DAT) — que los datos lleguen solos y completos

**DAT-01 · Extracto de la Mastercard Carrefour con su detalle.** Importar el PDF/CSV de la tarjeta: cada compra va al almacén de
compras de tarjeta (WP-30) y se concilia con la liquidación del extracto de CaixaBank. *Por qué:* hoy la tarjeta es una caja
negra de un solo cargo; dentro van las suscripciones y parte del gasto variable, y es requisito del §3. *UX:* en Importar,
«Extracto de tarjeta» como fuente; tras importar, una línea «Ciclo de octubre: 38 compras = liquidación del 2/11 ✓». M · **P0**.

**DAT-02 · Conexión PSD2 de solo lectura (reabrir O-6).** ND-13 comprobó que Enable Banking cubre CaixaBank y Mediolanum en modo
gratuito restringido, con reautorización cada 180 días. Prototipo aislado, una cuenta, sin tocar el libro, y medir si de verdad
ahorra tiempo frente al Atajo. *Riesgo:* modo de evaluación sin permanencia garantizada (R2 de ND-13). *UX:* una tarjeta en
Ajustes con «Conectar» y la fecha de caducidad del permiso. L · P2.

**DAT-03 · Buzón por correo.** Reenviar a una dirección propia el correo del banco con el extracto adjunto y que llegue al buzón
(XDA-02), igual que el Atajo. *Por qué:* el Atajo exige el iPhone; el correo funciona desde cualquier sitio. *UX:* «En el buzón ·
N extractos» como hoy. M · P2.

**DAT-04 · Confirmar saldos con una captura.** Captura de la app del banco → OCR del saldo (el motor de tickets ya existe) →
«Coincide / Corregir». *Por qué:* el paso de saldos del repaso semanal es el más repetitivo. *UX:* botón cámara junto a cada
cuenta en el paso 1 del Repaso. S · P1.

**DAT-05 · Traspasos internos emparejados.** Detectar la salida de una cuenta y la entrada en otra propia (mismo importe, ±2
días) y marcarlas como traspaso: no son gasto ni ingreso. *Por qué:* sin esto, el gasto variable del §3 se infla con los
traspasos a Mediolanum o al ahorro. *UX:* en la bandeja, «3 parejas de traspaso propuestas» con aceptar en bloque. M · **P0**.

**DAT-06 · Índice de calidad del dato por mes.** Cobertura × % clasificado × saldo cuadrado, en una cifra por mes y cuenta, que
**habilita o no** cada cálculo («esta previsión usa 11 meses con calidad ≥ 90 %»). *Por qué:* hoy la confianza mide supuestos,
no agujeros. *UX:* una tira de 12 casillas en Cierre y en el asistente del §3. S · P1.

**DAT-07 · Dividir un movimiento.** Un ticket del súper con farmacia y droguería, o un Bizum que mezcla cena y regalo, se parte
en varias partidas. *UX:* en la ficha del movimiento, «Dividir» con importes que deben sumar el total (barra de lo que falta).
M · P1.

### 4.2 Clasificación (CLA) — del 71 % al 95 %

**CLA-01 · Reglas por patrón, no solo por concepto.** Importe ± tolerancia + periodicidad + cuenta + día del mes. *Por qué:*
recibos cuyo concepto cambia cada mes (referencia, mes en el texto) se quedan sin propuesta (5 de 7 en noviembre). *UX:* al
aceptar un grupo, «¿Recordar también por importe y fecha?». M · **P0**.

**CLA-02 · Agenda de Bizum.** Cada contraparte con su partida por defecto (cena con amigos, regalo, gasto compartido) y, si es
compartido, quién debe a quién. *Por qué:* los Bizum son el tipo que más grupos sin propuesta deja. *UX:* al aceptar un Bizum,
«Recordar a esta persona como…». S · **P0**.

**CLA-03 · «Lo que hicisteis el mes pasado».** Proponer la partida del movimiento más parecido del mes anterior (comercio,
importe, día). *Por qué:* es la señal más barata y suele acertar en lo cotidiano. *UX:* confianza «media · como el mes pasado».
S · P1.

**CLA-04 · Clasificar a gestos.** En el móvil, deslizar a la derecha acepta la propuesta y a la izquierda la salta; en escritorio,
teclas 1-3 para las alternativas. *Por qué:* el objetivo de 4 s por grupo se gana con ergonomía. *UX:* tutorial de una línea la
primera vez. S · P1.

**CLA-05 · Propuesta asistida por modelo, opt-in y medida.** Solo el concepto normalizado (sin importes, fechas ni cuentas) a un
modelo de lenguaje; propone, nunca aplica; se mide con la calibración de XDA-05 y **se apaga sola** si no mejora el % aceptado
tal cual. *UX:* interruptor propio en Funciones en prueba con lo que se envía, a la vista. M · P2.

### 4.3 Previsión (PRV) — que diga la verdad hasta 2036

**PRV-01 · Recalibrador del gasto variable** (el plan del §3). L · **P0** (tras vuestro «sí»).

**PRV-02 · Gastos irregulares anualizados («huchas»).** Detectar pagos anuales o semestrales, colocarlos en su mes y proponer la
provisión mensual. *Por qué:* son los que rompen el suelo «sin avisar». *UX:* calendario de 12 meses con los irregulares como
hitos y la hucha acumulada en cada uno. M · **P0**.

**PRV-03 · Estacionalidad mensual.** El índice contraído del §3, visible y editable («diciembre: +18 %»). S · P1.

**PRV-04 · Previsión por remuestreo de meses reales.** Simular 1.000 trayectorias combinando meses reales (no supuestos ± 1
punto) para dar P10/P50/P90 de liquidez hasta 2036. *Por qué:* el abanico actual (FX-50) mide sensibilidad a supuestos, no la
volatilidad real del hogar. *UX:* la misma gráfica de «Hasta 2036», con la banda nueva y una frase («8 de cada 10 años acabáis
entre X e Y»). M · P1.

**PRV-05 · Deriva por partida con ajuste en un toque.** Si una partida se desvía en el mismo sentido 3 meses firmados seguidos,
proponer su nuevo previsto. *Por qué:* es la comprobación que habría detectado el agujero del §1.1. *UX:* en Cierre, «Súper: 3
meses por encima (+14 %) · Ajustar el plan». S · **P0**.

**PRV-06 · Inflación por categoría.** Energía, alimentación, seguros, colegio y vivienda con su propia tasa y su fuente/fecha en
el registro de supuestos. M · P2.

**PRV-07 · Línea de vida 2026-2036.** Hitos editables sobre la gráfica (coche nuevo, reforma, colegio/universidad, cambio de
trabajo, jubilación) con plantillas de coste; arrastrar un hito recalcula. *Por qué:* a 10 años, lo que mueve la liquidez son
las decisiones grandes, no el súper. *UX:* hitos como chinchetas sobre «Hasta 2036». L · P1.

**PRV-08 · Exportar la previsión a Excel con fórmulas vivas.** Hoja mensual hasta 2036 con fórmulas (no valores) para auditarla
en el mismo formato que el libro de origen. *Por qué:* el hogar viene de Excel y es la forma más rápida de que un tercero (o
vosotros) revise el modelo. S · P1.

**PRV-09 · Previsión en sombra.** Correr el método nuevo en paralelo 1-2 meses y comparar cuál acierta antes de adoptarlo.
*Por qué:* cambia la cifra más mirada de la app; mejor con evidencia. *UX:* una línea en Previsión «En prueba: el método nuevo
acertó octubre con un 4 % de error, el actual con un 31 %». S · P1.

### 4.4 Suscripciones y recurrentes (SUS) — todas en la Mastercard Carrefour

**SUS-01 · Centro de suscripciones.** Inventario (plataforma, importe, periodicidad, día, tarjeta), coste anual total, próximas
renovaciones anuales y **subidas de precio** detectadas en el extracto de la tarjeta. *UX:* una lista con el total anual arriba
y «¿La usáis?» (sí / poco / no) para decidir. S · **P0**.

**SUS-02 · Rotación de plataformas.** Calendario para tener 1-2 plataformas de vídeo a la vez y rotar cada 1-2 meses, con el
ahorro anual. *UX:* tira de 12 meses con la plataforma de cada mes; recordatorio de baja en el calendario del móvil (como el
repaso semanal). S · P1.

**SUS-03 · Pruebas gratuitas que pasan a pago.** Anotar una prueba con su fecha de fin y avisar 2 días antes. S · P2.

### 4.5 Deuda actual (DEU) — pagar menos y acabar antes

**DEU-01 · Préstamo, fase 2.** Varias ofertas lado a lado (tres bancos), «Guardar como escenario» para verlo en Previsión,
y una hoja imprimible para llevar al banco. M · P1.

**DEU-02 · Chequeo de revolving.** Para tarjetas revolving: TAE frente al tipo medio de revolving del Banco de España + 6
puntos (criterio STS 258/2023), introducido a mano con su fecha. Si lo supera: «posible usura; consultad antes de pagarla».
*UX:* insignia en Contratos y una línea en Préstamo. S · **P0** (antes de firmar el préstamo).

**DEU-03 · Pago mínimo frente a plan.** Cuánto se tarda y cuánto cuesta pagando solo la cuota mínima de la tarjeta, frente al
plan. *Por qué:* la cifra que más mueve la conducta. S · P1.

**DEU-04 · Pagas extra y devoluciones a deuda.** En junio, diciembre y con la devolución del IRPF, propuesta de reparto
(colchón primero, luego la deuda más cara, con su comisión de amortización). *UX:* aviso el mes de la paga con «Ver reparto».
S · P1.

**DEU-05 · Anti-recaída.** Si una tarjeta cancelada vuelve a tener cargos, aviso en la bandeja; límite recomendado. S · P1.

**DEU-06 · Kit de negociación.** Para cada deuda: guion y carta para pedir rebaja de TAE, quita (deudas suspendidas) o cambio de
plazo, con las cifras que el banco entenderá (lo que pagaríais con otra oferta). M · P2.

**DEU-07 · Termómetro de deuda cero.** Progreso visible en Hoy («llevamos el 38 % pagado») y celebración de cada deuda
cancelada. *Por qué:* un plan agresivo de 3-5 años se sostiene con motivación compartida. S · P1.

**DEU-08 · Deuda en una pantalla (D3 tras NTC-05).** Un solo motor y la pantalla de `Deuda.png`: cuánto debemos, cuándo acabamos,
cuál atacamos primero. Retirar Plan de deuda, Plan deuda óptimo y Control de deuda heredados (con vuestro visto bueno). L · P1.

### 4.6 Deuda nueva (DNV) — decidir antes de firmar

**DNV-01 · Taller de deuda nueva en 6 pasos** (`Taller.png`): para qué · ¿hace falta? · cuánto podéis · ofertas (la pestaña
Préstamo) · prueba (política y estrés) · decisión (guardada con su motivo y revisión a 12 meses). L · P1.

**DNV-02 · Capacidad por titular.** Lo que verá el banco del titular: sus ingresos, sus cuotas, su CIRBE y su ratio. *Por qué:*
el préstamo lo pediría una sola persona. S · **P0**.

**DNV-03 · Finalista o libre.** Checklist de lo que pedirá el banco (nóminas, renta, factura si es finalista) y qué pasa si el
destino no coincide. S · P1.

**DNV-04 · Alternativa sin deuda.** Cuántos meses ahorrando para pagarlo al contado y qué cuesta esperar. S · P2.

**DNV-05 · Protección de pagos.** Qué pasa si el titular no puede pagar 6 meses (paro, baja): coste de un seguro frente a
autoasegurarse con el colchón (el motor de autoseguro ya existe). S · P2.

### 4.7 Inversión (INV) — una respuesta: ¿vamos a tiempo?

**INV-01 · Inversión con una pregunta** (`Inversion.png`): por objetivo, cuánto falta, a qué ritmo vais y si llegáis. Las cinco
pestañas quedan debajo. L · P1.

**INV-02 · Semáforo invertir o amortizar.** Rentabilidad esperada neta de impuestos frente a la TAE de la deuda más cara; con
deuda por encima del umbral, la aportación nueva pide confirmación («cancelar la tarjeta rinde un 21,8 % seguro»). S · **P0**.

**INV-03 · Coste total de la cartera.** Gastos corrientes de cada fondo + gestión + custodia + comercialización, en euros al año
y su efecto a 10 años frente a una alternativa indexada. *Por qué:* en carteras de banca/gestoras tradicionales, la diferencia
de comisiones suele ser la decisión de inversión más rentable y menos arriesgada. S · P1.

**INV-04 · Importar posiciones por CSV.** Del bróker o la gestora, con ISIN, participaciones y fecha; valoración en lote (sin
conexiones externas, NTC-06). M · P1.

**INV-05 · Objetivos con probabilidad de éxito.** Por objetivo (colegio, coche, jubilación), remuestreo de rentabilidades
históricas por clase de activo → «72 % de probabilidad de llegar». M · P2.

**INV-06 · Aportar lo que la previsión garantiza.** La aportación mensual se propone con lo que sobra en la **previsión** (tras el
§3), no con lo que sobra este mes. S · P1.

**INV-07 · Concentración real.** Exposición por región, sector, divisa y **entidad** (cuánto depende de un solo proveedor). M · P2.

### 4.8 Hogar y pareja (HOG)

**HOG-01 · Acta de decisiones de los dos.** Cada decisión (como el préstamo) con su motivo, quién la propuso, el visto bueno de
cada uno y la fecha de revisión. S · P1.

**HOG-02 · El móvil del otro.** Vista para el otro miembro (solo lectura o con permisos) y aviso de lo que necesita su visto
bueno. M · P2.

**HOG-03 · Lo mío, lo tuyo, lo nuestro.** Quién paga qué y las compensaciones entre titulares (p. ej., cuando el préstamo de uno
cancela deudas del otro). M · P2.

**HOG-04 · Modo enseñar.** Ocultar todas las cifras con un toque (para mirar la app en público o enseñar una pantalla). S · P1.

### 4.9 Experiencia transversal (UX)

**UX-01 · Navegación de 5 destinos** (Hoy · Movimientos · Plan · Patrimonio · Decidir, de `Navegacion.png`) y retirar
«Versiones anteriores». L · P1.

**UX-02 · Cada cifra se puede tocar.** «¿De dónde sale?» en cualquier número: movimientos, supuestos y fórmula. M · P1.

**UX-03 · Atajo «Cuánto podemos gastar».** Un Atajo de iOS que lee la cifra de Hoy de un enlace de solo lectura y la enseña en el
widget de Atajos. S · P2.

**UX-04 · Modo reunión a pantalla completa.** Una cifra por pantalla para la conversación mensual (liquidez, deuda, objetivo,
decisión). S · P2.

**UX-05 · Arranque en menos de 2 s en el iPhone.** Seguir partiendo `app.js` y cargar bajo demanda lo que no es Hoy. L · P1.

---

## 5. Lo que propongo **no** hacer o retirar (con vuestro visto bueno)

1. **Retirar «Versiones anteriores»** (11 pantallas heredadas). Si en 30 días nadie las abre (el medidor lo dice), fuera.
2. **Sacar de Comparar** el próximo euro y el reparto de nómina (van a Decidir), dejando en Comparar solo comparar estrategias.
3. **No construir más previsión por partida** hasta pasar del 90 % clasificado: sería precisión falsa.
4. **No conectar más fuentes** (PSD2) mientras el Atajo y el buzón funcionen y el atasco sea clasificar.
5. **Parar excepciones al techo de superficie** salvo petición expresa como la de hoy; a cambio, cada retirada baja la base.

## 6. Prioridad y secuencia (90 días)

| Orden | Qué | Por qué primero |
|---|---|---|
| 1 | DAT-05, CLA-01, CLA-02 | Desatascan clasificar (D-N11) y son requisito del recálculo |
| 2 | PRV-01 motor y backtest (sin cambio visible), DAT-01 | La previsión es el cimiento; la tarjeta Carrefour es su pieza que falta |
| 3 | DEU-02, DNV-02 | Antes de firmar el préstamo |
| 4 | PRV-01 asistente y aplicar (tras el 4/12), PRV-02, PRV-05, SUS-01 | Previsión verdadera y vigilada |
| 5 | INV-02, DEU-07, DEU-04 | Ordenar el dinero que sobra: deuda antes que inversión |
| 6 | UX-01 + retiradas del §5, DEU-08 (tras NTC-05) | Menos superficie, una sola deuda |

## 7. Decisiones que necesito del hogar

- **D-N12 · Recálculo de la previsión (§3.6):** las siete respuestas, en especial la modalidad de pago de la Mastercard Carrefour.
- **D-N13 · Préstamo:** ¿es un préstamo libre o el de «coche ecológico»? ¿Qué TIN real os dan para reunificar? ¿Hay seguro?
- **D-N14 · Las 12 funciones del §6:** ¿de acuerdo con el orden o cambiáis algo?
- **D-N15 · Retiradas del §5:** ¿se pueden empezar a medir para retirar?
