# Duodécima auditoría · 23/11/2026 · Que cada control haga algo, el plan de deuda que se sigue y menos superficie

> **Es una propuesta, no backlog**, salvo D-N34 a D-N38, que el hogar aceptó el 23/11/2026 (§6). El único backlog vivo es `BACKLOG_DEFINITIVO.md`. Lo que aquí se marca «se consulta» no se
> hace sin el «sí» del hogar (CLAUDE.md: «un cambio que retire una pantalla en uso se consulta»). Los ejemplos usan contratos
> inventados; ninguna cifra es del hogar.

## 0. Resumen en siete frases

1. **El hallazgo de D-N33 es más grave que el arreglo:** el escenario de supuestos estuvo publicado sin cambiar ninguna cifra y
   ninguna de las ~6.900 pruebas lo detectó, porque se prueba que los controles *se pintan*, no que *hacen algo*. Es la cuarta
   avería silenciosa en un mes (tras el gráfico de Hoy, los saldos con fecha pasada y el cobro caducado). Propongo una prueba
   automática de efecto para cada control (DUO-01, P0).
2. **La app ya tiene tres maneras de preguntar «¿y si…?»** que se solapan: el escenario de supuestos (Base · Prudente · Ahorro
   alto, D-N33), Escenarios (E13) y las pruebas de estrés (FX-21, «un sueldo menos», Euribor, imprevisto). Para un hogar con deuda,
   la pregunta útil es la de estrés, no la de los preajustes. Propongo medir y, en la revisión trimestral, fundirlas en un solo
   «¿Y si…?» (DUO-02, se consulta).
3. **Desde el 22/10 no se ha retirado nada por lo medido.** 238 scripts, unas 32.000 líneas en `app.js`, 50 anclas de
   navegación. La revisión trimestral (UND-24) necesita fecha y candidatos, no solo intención (DUO-03).
4. **El plan óptimo de deuda calcula bien pero aún no acompaña, y deja fuera lo impagado:** una deuda en impago sin oferta de quita
   no entra en la fecha de «libres de deuda»; se avisa en una nota, no en la fecha (comprobado en el código; DUO-D9). Además, no sabe si el hogar hizo lo que tocaba (UND-14 sin hacer),
   no celebra (UND-16 sin hacer) y no detecta solo las amortizaciones en los movimientos importados. Un plan sin seguimiento se
   abandona hacia el tercer mes; esa es la palanca de ahorro más grande que queda (§3, v3).
5. **El plan ignora tres costes reales que la app ya conoce:** la comisión de amortización anticipada (los escalones de DEB8
   están en los contratos y el plan no los lee), la elección «reducir cuota o reducir plazo» y el Euribor de las deudas variables.
   Sin ellos, el orden puede ser el equivocado en deudas baratas (§3, v3).
6. **Falta la pregunta que de verdad decide:** «¿dónde va el siguiente euro: colchón, deuda o inversión?». Hoy cada pantalla
   contesta su trozo. Propongo una cascada del euro con reglas explícitas y editables (DUO-D4).
7. **Dos funciones de alto valor y poco coste que no existen:** el indicio de usura en tarjetas revolving (DUO-D6, con criterio
   del Supremo y dicho como indicio, nunca como dictamen) y el valor marginal de cada 50 € más al mes (DUO-D5).

---

## 1. Diagnóstico crítico

### 1.1 Funciones que existen pero no hacen nada (lo más grave)

- D-N33 descubrió que `writeControls` pisaba los preajustes con lo guardado en el mismo paso: el escenario solo cambiaba el
  rótulo. **Estuvo publicado así sin que nadie lo notara**, porque el rótulo cambiaba y unas cifras que no se mueven no llaman la
  atención.
- Las pruebas e2e comprueban que el control existe, es accesible y no rompe la maqueta. **Ninguna comprueba que al cambiarlo
  cambie al menos una cifra.** UND-01 (arranque en caliente) atacó el estado; falta atacar el efecto.
- La regla que propongo: *todo control que el hogar puede tocar debe mover algo visible, o decir por qué no* («Con vuestros datos,
  este ajuste no cambia nada este mes»). Es la versión de UND-02 («avisar en vez de esconder») para los controles.

### 1.2 Tres «¿y si…?» que compiten

| Superficie | Pregunta | Para quién |
|---|---|---|
| Escenario de supuestos (Ajustes, D-N33) | «¿Y si gastamos un 12 % más e ingresamos un 5 % menos, en general?» | Planificación genérica |
| Escenarios (E13) | «¿Y si pasa este evento concreto (compra, cambio de trabajo)?» | Decisiones puntuales |
| Pruebas de estrés (FX-21) | «¿Aguantamos si perdemos un sueldo, sube el Euribor o hay un imprevisto?» | Riesgo |

El preajuste «Prudente» (ingresos ×0,95, gastos ×1,12) es una versión difusa de una prueba de estrés, con números que no salen de
ningún dato del hogar. **Mi recomendación honesta:** el hogar eligió en D-N33 que funcione sin tocar datos y así está; no lo
reabro. Pero en la primera revisión trimestral (DUO-03) propongo que el escenario de supuestos sea candidato a fundirse con
las pruebas de estrés si el medidor dice que se usa poco. Tres conceptos para una pregunta es exactamente lo que se corrigió en
Deuda con UND-15.

### 1.3 Superficie que solo crece

- Cada auditoría añade 20-26 funciones; ninguna retira. «Plegar no reduce la carga, la esconde» (décima) sigue vigente.
- 238 scripts con `defer`, unos 6 MB sin comprimir en el arranque en frío. El service worker y el presupuesto de carga
  (`test:load-budget`) lo contienen en visitas repetidas, pero **el coste de análisis de JavaScript en un móvil de gama media no lo
  quita la caché.** No propongo reescribir nada sin medir: propongo medir el arranque en frío en un perfil de móvil lento
  (DUO-09) y solo cargar por área si pasa de 3 s.

### 1.4 Deuda: el cálculo está, el acompañamiento no

El plan óptimo v2 (UND-11, UND-12) es sólido: quitas por rendimiento equivalente, liquidez mes a mes sin bajar del suelo, el orden
preguntado (D-N27). Pero:

- **No hay bucle de seguimiento.** El plan dice «este mes, 300 € de más al préstamo» y no vuelve a preguntar. Es lo que más
  determina si un plan de deuda termina.
- **Comisiones de amortización:** `canonical-debt-contracts.js` ya guarda los escalones (DEB8, `nextCheaperPrepaymentWindow`),
  pero `canonical-debt-optimal-plan.js` dice en su cabecera «sin comisiones de amortización anticipada». En una hipoteca a tipo
  fijo con un 2 % de comisión, amortizar 6.000 € cuesta 120 € el primer día; eso cambia el orden frente a una deuda al 4 %.
- **Reducir cuota o plazo:** el plan supone siempre que la cuota se mantiene y el plazo se acorta. Es lo que más intereses ahorra,
  pero **no libera liquidez**; cuando el suelo aprieta (UND-12 ya lo sabe), reducir cuota puede ser lo que sostiene el plan.
- **Tipo variable:** el plan proyecta con el tipo de hoy. `canonical-debt-horizon.js` y `canonical-mortgage-rate-scenarios.js` ya
  saben del Euribor; el plan no les pregunta.
- **Lo impagado queda fuera (comprobado en el código):** en `canonical-debt-payoff-path.js`, una deuda sin cuota activa y sin oferta
  de quita no entra en el cálculo. `camino-deuda-ui.js` lo dice en una nota de avisos («No entran en la cuenta… las fechas son
  las de las demás. Completadlas en Contratos»), pero **la fecha protagonista no lo lleva**, y el remedio no sirve: una deuda en
  impago no tiene cuota que completar. Justo la deuda más urgente (la que puede estar en un fichero de morosos) es la que el plan
  no ordena (§3, DUO-D9).

---

## 2. Lo que queda del backlog anterior (undécima, UND-nn)

Hechas: UND-01 (9 de 11 pantallas v2 en caliente), 02, 04, 06, 08, 11, 12, 13, 15, 17, 23, 26 y DEC-29.

| UND | Qué | Recomendación ahora | Por qué |
|---|---|---|---|
| 01 | Arranque en caliente (faltan 2 de 11) | **Ya**, con DUO-01 | Es la misma familia de fallo |
| 03 | Salud del motor | **Ya** (S) | Con DUO-01 da el «se calculó y movió algo» |
| 05 | Inversión y áreas de Hoy desde su referencia | Tras UND-23 (lo que se abre) | Medir antes de rehacer |
| 07 | Barra inferior en el móvil | **Ya**, la mayor mejora pendiente del móvil (DUO-05) | Ver §4 |
| 09 | «Qué ha cambiado» en una frase | P2 | Útil, no urgente |
| 10 | Calendario de lo que vence | **P1**, con DUO-D8 (promociones al 0 %) | Lo caro es lo que se renueva solo |
| 14 | Seguimiento del plan | **Ya, P0 de deuda** (DUO-D1) | §1.4 |
| 16 | Hitos con su momento | Con DUO-D1 | Barato y sostiene el plan |
| 18 | Reunión mensual | P2, tras DUO-D1 | El seguimiento del plan es su primer punto del día |
| 19 | Entrada por la pregunta | Descartar | La barra inferior y las áreas ya cubren el «¿dónde está?» |
| 20 | Texto grande | P2 | Accesibilidad real sin romper la maqueta |
| 21 | Importar desde Compartir | Tras D-N11 (4/12) | Depende de la decisión de entrada |
| 22 | Extracto atrasado por cuenta en Hoy | **Ya** (S) | Un dato viejo es la raíz de cifras falsas |
| 24 | Revisión trimestral con retirada | **Ya, con fecha** (DUO-03) | §1.3 |
| 25 | Tope de alto por pantalla en el CI | Con DUO-03 | Obliga de verdad |

---

## 3. El plan de saldo de deuda: v3 y v4

### 3.1 Principio rector

Un plan de deuda tiene tres trabajos: **calcular** (el orden y el importe), **sostener** (que se cumpla mes a mes) y **cerrar**
(saldar bien: certificado, baja de ficheros, cuota liberada redirigida). La v1 y la v2 resolvieron el primero. La v3 es el segundo;
la v4, el tercero y los candidatos que faltan.

### 3.2 v3 · Sostener (P0-P1)

**DUO-D1 · Seguimiento del plan con detección automática (absorbe UND-14).**
- *Qué:* al guardar el plan («Este es nuestro plan»), cada mes la app **busca sola** en los movimientos importados el pago extra
  previsto (mismo contrato, importe por encima de la cuota, ventana de ±5 días). Si lo encuentra, lo da por hecho y lo dice
  («Hecho: 300 € de más al préstamo el día 3»). Solo si no lo encuentra pregunta una vez en «Decidir esta semana»: «¿Hecho?» con
  «Sí», «Otra cantidad» y «Este mes no».
- *Por qué la detección:* cada pregunta es fricción; el mejor seguimiento es el que no pide nada cuando el dato ya está. Preguntar
  solo lo que la app no puede saber.
- *Después:* el plan se recalcula **desde lo hecho**, no desde lo previsto, y la fecha de libre de deuda se mueve con una frase
  («Este mes no: la fecha pasa de octubre a noviembre de 2027»). Nunca culpabiliza: un mes sin extra es una decisión, no un fallo.
- *Interfaz:* una fila en Deuda › Plan con los meses como puntos (hecho ● · parcial ◐ · no ○, forma además de color) y la racha.
- *Métrica:* meses seguidos cumpliendo; desviación acumulada en euros. M · **P0**.

**DUO-D2 · Hitos (UND-16) y cierre de cada deuda.** Al saldar: una tarjeta teñida un solo día en Hoy («Habéis saldado la tarjeta:
90 € al mes que pasan al préstamo»), y una lista de cierre de tres pasos que reutiliza el kit de UND-13: certificado de deuda cero,
baja en ficheros si la hubo, y comprobar en la siguiente CIRBE (WP-40) que aparece cancelada. Sin confeti. S · P1.

**DUO-D3 · El coste real de amortizar.**
- *Comisión:* el rendimiento de amortizar una deuda pasa a ser el neto: TAE menos la comisión vigente repartida en el plazo que
  queda. El plan lee los escalones de DEB8 y, si una comisión baja en pocos meses, lo dice y **retrasa** ese tramo
  («Esperad a marzo: la comisión pasa del 2 % al 1 %; ahorráis 60 €»).
  *Referencia, para que el hogar la compruebe con su contrato:* en consumo, la Ley 16/2011 limita la compensación al 1 % del
  importe amortizado si queda más de un año y al 0,5 % si queda menos; en hipotecas, la Ley 5/2019 la limita según tipo y plazo.
  La app nunca supone la comisión: usa la que declare el hogar y, si no hay, lo dice.
- *Reducir cuota o plazo:* para cada amortización, las dos cifras lado a lado: «Reducir plazo: 1.240 € menos de intereses.
  Reducir cuota: 890 € menos y 45 € al mes de liquidez». Por defecto, plazo; si en los próximos 6 meses la previsión toca el suelo,
  el plan propone cuota y dice cuánto cuesta.
- *Tipo variable:* el plan con el Euribor de los escenarios de WP-20 (±1 punto) da un rango, no una fecha: «Libres entre septiembre
  y diciembre de 2027». Un rango honesto vale más que una fecha falsa.
- M · **P1**.

**DUO-D4 · La cascada del siguiente euro.** Una sola respuesta en Deuda › Plan y en «¿Me lo puedo permitir?»: «El siguiente euro
que os sobre va a…». Reglas por defecto, todas visibles y editables:
1. Colchón inicial (1 mes de gastos fijos) si no está.
2. Deudas por encima del 7 % de TAE neta (las caras), en el orden del plan.
3. Colchón completo (el objetivo de meses del hogar).
4. Deudas entre el 3 % y el 7 %: comparar con la rentabilidad neta esperada de la cartera (de Inversión), y decirlo en euros.
5. Lo demás: inversión o deuda barata, según el hogar.

*Por qué:* hoy Colchón, Deuda e Inversión contestan cada uno su parte y el hogar tiene que componerlas. Es el patrón de «orden
financiero» que usa cualquier asesor, y aquí la app tiene todos los datos. *Interfaz:* una escalera de cinco peldaños con el actual
marcado y lo que falta para pasar al siguiente. M · P1.

**DUO-D5 · El valor de cada 50 € más.** Bajo el importe del plan, una línea y un mini gráfico: «Con 50 € más al mes: 3 meses antes y
210 € menos de intereses. Con 100 €: 5 meses y 380 €». Se calcula con el mismo motor (5-6 proyecciones, coste despreciable) y
enseña dónde están los rendimientos decrecientes. *Por qué:* la decisión real del hogar es «¿cuánto ponemos?», y hoy se contesta
probando a mano. S · P1.

### 3.3 v4 · Candidatos que faltan y protección

**DUO-D6 · Indicio de usura en tarjetas revolving.**
- *Qué:* para los contratos de tipo revolving (ya los marca `isRevolvingType`, sin inferirlo de la TAE), comparar su TAE con el tipo
  medio de las tarjetas de crédito revolving que publica el Banco de España para el mes de la contratación. Si la supera en más de
  6 puntos, una línea: «Esta TAE podría considerarse usuraria según el criterio del Tribunal Supremo para revolving (2023). Merece
  una consulta con una asociación de consumidores o un abogado; si se declarase, se devuelve lo pagado por encima del capital».
- *Datos:* el tipo de referencia lo teclea el hogar (o se deja una tabla anual, revisable), nunca se descarga solo (sin red).
- *Por qué:* en revolving es frecuente y el efecto económico puede ser mayor que cualquier optimización del orden. El kit de UND-13
  ya tiene el guion; se le añade la carta de reclamación al servicio de atención al cliente.
- *Honestidad:* «indicio», nunca «es usura». Depende de la fecha y de cada caso. Consultado, **D-N36: sí**. S · P1.

**DUO-D7 · Préstamo de consolidación dentro del plan (v4 de la undécima).** El plan compara con y sin consolidar, con la TAE completa
(comisión de apertura incluida) y **avisa de la trampa**: un tipo menor a más plazo puede pagar más intereses en total, y
consolidar tarjetas sin cancelarlas suele acabar con las dos deudas. La consolidación solo se recomienda si gana en intereses
totales **y** el hogar marca que cancelará las tarjetas. M · P2.

**DUO-D8 · Promociones al 0 % y fines de carencia.** Una deuda con promoción (0 % hasta una fecha y después la TAE normal) se
modela como dos tramos; el plan la deja a cero antes de que acabe la promoción si es posible, y el calendario de UND-10 avisa a 60
días. S · P2.

**DUO-D9 · Lo impagado dentro del plan, y primero.** Hoy queda fuera y solo lo dice una nota (§1.4). Propuesta: una deuda en impago entra como destino del
extra con (a) su saldo exigible, sin cuota corriente; (b) el interés de demora que declare el hogar como rendimiento (si no hay,
el de la TAE del contrato, y se dice); (c) delante de todo salvo de una quita que rinda más; y (d) la fecha de «libres» la incluye o
lo dice en la misma línea («sin contar la deuda en impago»), y la nota deja de pedir «completadla en Contratos» cuando el motivo es
el impago. Y al saldarla, la lista de cierre de DUO-D2 (baja del fichero).
Lo mínimo, aunque no se haga lo demás: **que la fecha diga que no la cuenta**. S · **P1** (la cifra protagonista se lee sin la nota).

**DUO-D10 · Ratio de endeudamiento con umbrales.** Cuotas de deuda entre ingresos netos, con las referencias que usan los bancos
(por encima del 35 % se considera alto; del 40 %, muy alto). Si se supera de forma sostenida, una línea sin dramatismo que dice que
existe ayuda profesional y la Ley de Segunda Oportunidad, con enlace a información oficial. Consultado, **D-N36: sí**. S · P2.

### 3.4 Orden de la hoja de ruta de deuda

| Versión | Qué | Depende de |
|---|---|---|
| v3a | DUO-D1 (seguimiento con detección) y DUO-D2 (hitos y cierre) | Nada: plan guardado (SVD-4) ya existe |
| v3b | DUO-D3 (comisión, cuota o plazo, Euribor) y DUO-D5 (cada 50 € más) | DEB8 y WP-20 ya existen |
| v3a′ | DUO-D9 (lo impagado dentro, o al menos dicho en la fecha) | Nada |
| v3c | DUO-D4 (cascada del siguiente euro) | DUO-D3 (la TAE neta) |
| v4 | DUO-D6 (usura), DUO-D7 (consolidación), DUO-D8 (promociones), DUO-D10 (ratio) | D-N36 (decidida) |

---

## 4. Uso, experiencia y optimización de lo hecho

**DUO-01 · Prueba de efecto para cada control (P0).** Un recorrido automático por cada `input`, `select` y botón de estado de las
pantallas v2: cambiarlo y comprobar que **algún** texto con cifra de la pantalla cambia, o que aparece la frase de «no cambia nada
con vuestros datos». Con lista de excepciones explícita (controles de navegación, de vista). Habría detectado D-N33 el primer día.
M · **P0**.

**DUO-02 · Un solo «¿Y si…?»** (se consulta, tras medir). Una pantalla con tres entradas: «Una prueba de aguante» (las de FX-21),
«Un cambio de supuestos» (el escenario de D-N33, sin preajustes fijos sino con los cinco supuestos a la vista) y «Un evento»
(E13). El aviso de la cabecera de D-N33 se mantiene para cualquiera de las tres. L · P2.

**DUO-03 · Primera revisión trimestral con fecha: semana del 14/12** (UND-24 + UND-25). Con lo medido desde el 22/10, una hoja con
cada función y tres columnas (se queda, se funde, se retira). **Candidatos que propongo llevar** (no retirar sin el «sí»): el
escenario de supuestos (si no se usa), el plan heredado de «Versiones anteriores», la entrada por la pregunta (UND-19, nunca hecha)
y las tarjetas de Laboratorio sin uso en 30 días. Y un tope de alto en el móvil por pantalla en el CI (8 pantallas). S · **P1**.

**DUO-04 · Salud del motor y datos viejos en un solo sitio** (UND-03 + UND-22). En Ajustes › Uso de la app, cuatro filas (mensual,
diario, deuda, previsión) con última vez, filas e invariantes; y en Hoy, una línea por cuenta sin movimientos de más de 10 días.
S · P1.

**DUO-05 · Barra inferior en el móvil** (UND-07). Cuatro destinos con texto siempre (Hoy, Movimientos, Plan, Deuda) y «Más»;
48 px de objetivo táctil mínimo más la zona segura del iPhone; el destino activo con forma (barra superior de 3 px) además de color;
se oculta con el teclado abierto; la cabecera se recoge al desplazar hacia abajo. *Por qué ahora:* es la mejora pendiente que más
toques ahorra en el móvil, y Ajustes por áreas (UND-04) ya quitó la otra gran carga. *Métrica:* toques hasta los cuatro destinos
(objetivo 1). M · **P1**. Cambia la navegación en uso: consultado, **D-N37: sí**.

**DUO-06 · Deshacer en todo lo que borra o marca** (DEC-17 ampliado). Un aviso de 8 s con «Deshacer» tras borrar una regla, un
movimiento o marcar un plan como hecho, en lugar de diálogos de confirmación. Los diálogos interrumpen siempre; deshacer solo
cuando hace falta. S · P1.

**DUO-07 · Estados vacíos que enseñan el siguiente paso.** Revisar las pantallas v2 con datos parciales (sin contratos, sin
cartera, sin cierre firmado): cada hueco dice qué falta y lleva al sitio donde se añade, con una sola acción. Complementa UND-02
(fallo) con el caso «aún no hay datos». S · P2.

**DUO-08 · Texto grande** (UND-20) con prueba de que nada se corta a escala 1,25 (como DEC-38 a 195 px). S · P2.

**DUO-09 · Arranque en frío medido en un móvil lento.** `measure:load` con CPU ×4 y red 4G lenta; si la primera pintura de Hoy pasa
de 3 s, cargar por área los módulos de Inversión, Escenarios y Laboratorio (que Hoy no necesita). Sin medida, no se toca. S · P2.

---

## 5. Orden recomendado

1. **Semana del 30/11 — que funcione lo que hay:** DUO-01 (prueba de efecto), DUO-D9 (la fecha de «libres» que no cuenta lo
   impagado), UND-01 (las dos pantallas que faltan), DUO-04 (salud y datos viejos).
2. **Semana del 7/12 — el plan que se sigue:** DUO-D1 (seguimiento con detección), DUO-D2 (hitos y cierre), DUO-D5 (cada 50 € más).
   No toca Hoy salvo la fila de «Decidir esta semana», así que respeta D-N30 (UND-06 entra el 7/12).
3. **Semana del 14/12 — costes reales y revisión:** DUO-D3 (comisión, cuota o plazo, Euribor) y la primera
   revisión trimestral (DUO-03). UND-08 entra en Hoy el 14/12 (D-N30); DUO-D1 no se cruza.
4. **Después del cierre de diciembre:** DUO-D4 (cascada), DUO-05 (barra inferior, D-N37), DUO-D6 y DUO-D10 (D-N36),
   DUO-D7, DUO-D8, DUO-02.

## 6. Decisiones que pide (contestadas el 23/11/2026: «ok a las cinco, D-N34 a D-N38»)

- **D-N34** · ¿Prueba de efecto obligatoria (DUO-01) antes de publicar cualquier control nuevo? Recomendación: sí. **Decidida: «ok».**
- **D-N35** · Seguimiento del plan: ¿la app puede dar por hecho un pago extra cuando lo encuentra en los movimientos, o queréis
  confirmarlo siempre? Recomendación: darlo por hecho y decirlo, con «No era esto» para corregir. **Decidida: «ok».**
- **D-N36** · ¿Indicio de usura en revolving (DUO-D6) y ratio de endeudamiento con aviso de ayuda (DUO-D10)? Son delicados; la
  recomendación es sí a los dos, como indicio y con lenguaje neutro. **Decidida: «ok».**
- **D-N37** · Barra inferior en el móvil (DUO-05): ¿Hoy, Movimientos, Plan, Deuda y «Más»? Recomendación: sí. **Decidida: «ok».**
- **D-N38** · Primera revisión trimestral la semana del 14/12, con los cuatro candidatos de DUO-03. Recomendación: sí. **Decidida: «ok».**

**Siguiente número de decisión libre: D-N39.**
