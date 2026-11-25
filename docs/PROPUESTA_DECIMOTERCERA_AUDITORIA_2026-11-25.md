# Decimotercera auditoría · 25/11/2026 · Deuda: una sola verdad, una sola pantalla que se entiende, y lo que falta del plan de saldo

> **Es una propuesta, no backlog.** El único backlog vivo es `BACKLOG_DEFINITIVO.md`. Nada de lo que aquí se marca «se consulta» se
> hace sin el «sí» del hogar (CLAUDE.md: «un cambio que retire una pantalla en uso se consulta»). Las cifras de las capturas y de los
> ejemplos salen de los contratos **FICTICIOS** del arranque en caliente (`tests/helpers/arranque-en-caliente.cjs`: una tarjeta de
> 2.400 € al 21,9 % y un préstamo de 5.100 € al 9,5 %); ninguna es del hogar. Decisiones nuevas desde **D-N40**.

---

## 0. Resumen en nueve frases

1. **La pantalla Deuda › Plan se contradice a sí misma, y eso es más grave que su aspecto.** Con dos contratos ficticios enseña
   **cuatro fechas distintas de «libre de deuda»**: noviembre de 2026 en la tira superior, septiembre de 2027 en el plan óptimo,
   noviembre de 2029 en «Camino a deuda cero» y en el Simulador visual, y «Sin deuda pendiente» como titular. Con los datos del
   hogar (la captura del 25/11) pasa lo mismo: titular «Sin deuda pendiente» encima de una deuda viva y varios contratos.
2. **El titular sale de un tercer motor que nadie ve:** `deudaRutaTitulo` lee el estado final de `escenarioMotor` después de
   *ejecutar* la estrategia heredada («Avalancha: N decisiones, X € de coste total ejecutado»), es decir, después de suponer que se
   liquidan todas las deudas con caja. No es el plan que la pantalla propone justo debajo. Es un fallo de corrección (P0), no un
   matiz.
3. **Deuda › Plan mide 3.863 px en el escritorio y 6.304 px en el móvil (unas 7,5 pantallas de iPhone) con solo dos contratos.**
   Con todos los contratos del hogar es bastante más. Hay **dos controles de «cuánto más al mes»**, **dos selectores de orden** (el del plan
   óptimo y las pestañas «Avalancha · Bola de nieve · Consolidar · No tocar nada»), **tres gráficos del mismo hecho** (las barras
   del camino, «Cómo se apaga la deuda» y el «Calendario de amortización») y **dos tablas de sensibilidad** («cada 50 €» y «cada
   100 €»).
4. **Deuda › Contratos son 4.235 px y 70 campos visibles con dos contratos.** La tabla de edición se sale a la derecha
   (plazos y estado fuera de la vista), hay dos altas («varios a la vez» arriba, «un contrato nuevo» al final), dos listas de orden
   que repiten el plan («Prioridad ajustada por fiscalidad» y «Orden para amortizar varias deudas») y un simulador de consolidación
   que duplica Ofertas › Préstamo.
5. **Lo que propongo para Deuda no es maquillaje: es arquitectura de información.** Una sola fecha protagonista (la del plan que
   el hogar sigue), una pantalla de Plan que se lee en 10 segundos («cuándo acabáis, qué toca este mes, cómo vais»), los controles
   en un panel «Ajustar el plan» con vista previa, la explicación detrás de un «¿Por qué este orden?», y Contratos como lista de
   tarjetas con su ficha de edición. **No se pierde ninguna información**: el §2.6 asigna sitio nuevo a cada pieza actual.
6. **El plan de saldo tiene un hueco de criterio financiero:** en la captura real, la liquidez está **por debajo de la reserva
   protegida** (margen negativo) y el colchón más justo está «a vigilar», y aun así la pantalla parte de un importe fijo de cuatro
   cifras al mes. Un buen plan de deuda **reconstruye primero el colchón** cuando se está por debajo del suelo; hoy el plan solo
   evita bajar *más* (TRE-D3).
7. **Del backlog anterior quedan sin hacer once piezas** (DUO-02, 03 —la revisión—, 05, 06, 07, 08, 09 y UND-05, 09, 10, 18, 20,
   21, 25); las ordeno y descarto dos (§3).
8. **Funciones nuevas fuera de Deuda** con el mejor retorno por esfuerzo: un «Este mes, en una hoja» imprimible y compartible
   entre los dos miembros del hogar; deshacer universal; búsqueda que contesta preguntas («¿cuánto en súper este año?»); calendario
   de vencimientos; y un presupuesto de superficie que obligue a retirar algo por cada cosa que entra (§4).
9. **Operativo, al escribir esto:** el despliegue 1562 de main b7cba35d (solo PROJECT_STATE 540) salió **en rojo**; lo está
   arreglando otra conversación en #683 (Safari al abrir Registrar › Importar), que además ocupa la entrada 541 de PROJECT_STATE.
   El sitio sigue con el contenido del despliegue 1560 (verde); la availability programada 415 sobre b7cba35d, en verde. No se ha
   duplicado ese trabajo.

---

## 1. Diagnóstico crítico de Deuda (con evidencia)

Capturas a 1280 y 390 px con el arranque en caliente, el 25/11/2026 (Chromium del contenedor, `dist/` recién construido).

| Pantalla | Alto 1280 px | Alto 390 px | Botones visibles | Campos visibles |
|---|---|---|---|---|
| Deuda › Plan | 3.863 px | 6.304 px | 6 | 20 |
| Deuda › Contratos | 4.235 px | 5.900 px | 14 | **70** |
| Deuda › Ofertas › Simulador visual | 3.615 px | 1.884 px | 2 | 9 |

### 1.1 Cuatro fechas de «libre de deuda» en una pantalla (P0)

| Dónde | Qué dice (ficticio) | De qué motor sale | Qué supone |
|---|---|---|---|
| Titular de Deuda › Plan | «Sin deuda pendiente» | `escenarioMotorLibreDeDeuda` tras *ejecutar* la estrategia heredada (`views/deuda.js:830`, `escenarios-ui.js:315`) | Que se liquidan las deudas con caja según «Avalancha: 2 decisiones, 7.500 € de coste total ejecutado» |
| Tira superior «Libre de deuda» | nov 2026 | `homeDebtOutlook` (`app.js:4490`) | Plazos declarados |
| Plan óptimo de saldo | septiembre de 2027 | `canonical-debt-optimal-plan.js` | Cuotas + lo que permita la previsión |
| Camino a deuda cero y Simulador visual | noviembre de 2029 | `canonical-debt-payoff-path.js` con extra 0 | Solo cuotas, capital y TAE |

Ya existe una nota que lo reconoce («Dos fechas distintas: Hoy y el título de esta pantalla cuentan los plazos declarados…»).
**Explicar una contradicción no la resuelve.** Una persona que entra a ver «¿cuándo acabamos?» no debe tener que leer
metodología para saber cuál de cuatro fechas es la buena. La regla que propongo (D-N40): **una sola fecha protagonista en toda la
app —la del plan que el hogar ha guardado con «Este es nuestro plan» (DUO-D1) o, si no hay, la del plan óptimo con sus valores
por defecto—; las demás bajan a comparaciones con nombre** («si solo pagáis las cuotas: noviembre de 2029»; «según los plazos
firmados: noviembre de 2026»).

### 1.2 El titular dice «Sin deuda pendiente» con deuda viva (P0, corrección)

`deudaRutaTitulo` recibe `summary.libreDeDeuda` del resumen de la estrategia heredada ejecutada. Con «Avalancha» (cancelar con
caja), el estado final no tiene capital y el titular dice «Sin deuda pendiente». La subtítulo («Avalancha: N decisiones, X € de coste
total ejecutado», también en la captura del hogar) confirma que es el resultado *si se ejecutara* esa ruta, no el
estado. Es la misma familia de fallo que DEC-29 quiso cerrar («el titular nunca dice sin deuda…»), por otro camino.
**Arreglo mínimo, aunque no se haga nada más del §2:** el titular sale del plan óptimo (o del plan guardado), y la frase de la
estrategia heredada pasa a la tarjeta «Orden de ataque» con su verbo en condicional («Si aplicáis esta ruta…»). Prueba e2e: con
contratos vivos, el titular nunca contiene «Sin deuda».

### 1.3 Duplicados en Deuda › Plan

| Pregunta | Dónde se contesta hoy (de arriba abajo) | Veces |
|---|---|---|
| ¿Cuánto pongo de más al mes? | Plan óptimo («Importe fijo al mes» + modo previsión) · Camino («Extra al mes» + deslizador) | 2 controles, independientes entre sí |
| ¿En qué orden? | Plan óptimo (radios) · Orden de ataque (4 pestañas) · Contratos (2 listas más) | 4 |
| ¿Cuánto rinde poner más? | «Si ponéis más al mes» (+50…+200) · «Cada 100 € más al mes» | 2 |
| ¿Cómo baja la deuda en el tiempo? | Barras del camino · «Cómo se apaga la deuda» · «Calendario de amortización» | 3 gráficos |
| ¿Cuándo acabamos? | §1.1 | 4 fechas |

Consecuencia medible: la prueba de efecto (DUO-01) tiene que registrar excepciones del tipo «este control no mueve la cifra
protagonista porque es de otro motor». Eso es un síntoma de diseño, no de prueba.

### 1.4 Problemas de lectura (UX/UI) visibles en la captura del hogar

- **Jerarquía invertida.** Lo primero tras la cabecera son controles (radio, dos campos, dos plegados, otro radio) y la respuesta
  («libres en…», «ahorráis…») aparece a media pantalla. El patrón correcto en finanzas personales es *respuesta → acción → por
  qué → ajustes*.
- **El campo «Importe fijo al mes» está activo y lleno aunque el modo elegido es «Lo que permita la previsión».** Un campo
  que no cuenta no debe parecer editable: o se oculta, o se deshabilita con «solo con importe fijo».
- **«Pago inicial» ocupa el ancho entero** (un campo de 4 cifras en 1.500 px de caja). Los campos numéricos deben medir lo que su
  contenido (12-14 caracteres) y alinear el «€».
- **Los plegados no parecen plegados** («Ofertas de quita…», «Comisión por amortizar…», «Cuándo os pregunta…»): texto plano sin
  chevron ni contador. Nadie abre lo que no sabe que se abre; y son justo los datos que cambian el orden (DUO-D3).
- **Botones duplicados de navegación** («Contratos →» arriba a la derecha, además de las pestañas 1-2-3) y un «Comparar
  estrategias» que lleva a otra pestaña con el mismo nombre que la tarjeta «Orden de ataque».
- **Tablas truncadas** en «Orden de ataque» («21,…», «me…») a 1280 px: la columna «Peso y fin previsto» se come el ancho.
- **El gráfico «Cómo se apaga la deuda» sube** en la captura ficticia (la línea discontinua crece de nov 26 a oct 29): pinta la
  deuda *liquidada acumulada* o el coste, no la deuda viva; el título dice lo contrario de lo que se ve. A comprobar con datos
  reales antes de rehacerlo, pero el riesgo de leerlo al revés es alto.
- **«Calendario de amortización» dice «Intereses totales 0 €» y «Primer contrato liquidado nov 26»** porque hereda la ruta
  ejecutada (cancelar con caja): otra vez el tercer motor.
- **Vocabulario de ingeniero en pantalla de hogar:** «coste total ejecutado», «caja mínima», «Capacidad de endeudamiento 9,2 %
  de 32 %», «Antes de aplicar», «Aplicar ruta», «escenario aplicado». El hogar habla de «cuándo acabamos», «qué pagamos este mes»,
  «cuánto nos ahorramos».
- **Densidad:** párrafos de 3-5 líneas con negritas intercaladas. El plan óptimo tiene 9 bloques de texto antes de «Este es nuestro
  plan». La regla de la casa (una idea por frase, el número primero) no se cumple aquí.

### 1.5 Deuda › Contratos

- **Una tabla de 9 columnas editable a 1280 px** que se sale por la derecha (Deducción fiscal, Plazos, Estado fuera de vista). En
  el móvil, 70 campos en fila. La edición en tabla es buena para 2 filas y mala para las que tiene el hogar.
- **«Progreso: Sin capital inicial declarado»** en todas las filas: el dato que más motiva (cuánto llevamos pagado) es justo el
  que falta, y la pantalla no dice cómo completarlo de una vez.
- **Dos altas** y **dos listas de orden** (§0.4). El orden es del Plan; Contratos debería ser el inventario.
- **Bloques de herramientas avanzadas** mezclados con el inventario: CIRBE, deuda en la sombra, índices (Euribor/€STR/IPC con
  tres formularios iguales), revisión del tipo, deuda cara dormida, cruce deuda-activos, vigilancia de cláusulas, simulador de
  consolidación. Todo útil; nada es «mis contratos».

### 1.6 El criterio financiero que falta (no es UX, pero se ve en la UX)

En la captura del hogar: **liquidez por debajo de la reserva protegida** (margen negativo), colchón más justo
«a vigilar» en tres meses y medio, y aun así un plan que parte de un importe fijo alto. El plan óptimo ya no baja *del suelo* en
el modo previsión (UND-12), pero **no tiene la regla previa que usa cualquier asesor: con el colchón por debajo del mínimo, el
primer euro va al colchón, salvo a la deuda más cara si su TAE supera el umbral de urgencia** (revolving al 20 %+). Hoy esa
cascada existe en WP-42 (escalera del próximo euro), en otra pestaña, y el plan solo enlaza a ella. Ver TRE-D3.

---

## 2. Plan de rediseño de Deuda: más intuitiva y fácil de manejar, sin perder información

### 2.1 Principios (los que se aplican a cada decisión de abajo)

1. **Una verdad.** Una fecha, una cifra de ahorro, un orden. Lo demás son comparaciones con nombre.
2. **Respuesta, acción, porqué, ajustes** — en ese orden vertical. La pantalla se entiende sin desplazarse en el escritorio y con
   un desplazamiento en el móvil.
3. **Divulgación progresiva con señal.** Nada se borra; lo secundario va detrás de un control que *parece* abrible (chevron,
   contador «3 ajustes», resumen del valor actual: «Comisión: 1 contrato con comisión»).
4. **El control junto a su efecto.** Cambiar «al mes» mueve la fecha que está a 200 px, no una a 2.000 px. Vista previa en vivo
   con la diferencia marcada («↑ 2 meses antes»).
5. **Lenguaje del hogar**: «acabáis», «este mes», «os ahorráis», «la siguiente». Sin «ejecutado», «aplicar ruta», «caja mínima».
6. **Visual por defecto, tabla a demanda.** Cada gráfico lleva «Ver como tabla» (accesibilidad y precisión).
7. **Mismo comportamiento en v2 y `?tema=clasico`** (CLAUDE.md): el rediseño es de v2; clásico conserva funciones con su maqueta.

### 2.2 Deuda › Plan, nueva estructura (de arriba abajo)

> **Maqueta navegable:** [`docs/rediseno/referencias/html/DeudaTRE.html`](rediseno/referencias/html/DeudaTRE.html) (abrirla en el navegador;
> `#comparar`, `#contratos` y `#ajustes` abren cada vista) y sus capturas en `docs/rediseno/referencias/png/DeudaTRE*.png`. Medida con
> Playwright: Deuda › Plan pasa de **3.863 a 1.340 px** a 1440 y de **6.304 a 2.211 px** a 390, sin desbordamiento ni errores.
> Calcula en vivo (fecha, ahorro, «Este mes», el orden, la comparación) con los contratos FICTICIOS; no es el motor de la app.

```
┌────────────────────────────────────────────────────────────────────────────┐
│ DEUDA · PLAN                                   [Plan] [Contratos] [Ofertas] │
│                                                                            │
│  Libres de deuda en  SEPTIEMBRE 2027          Os ahorráis   1.398 €         │
│  26 meses antes que pagando solo las cuotas   en intereses                  │
│  ████████████████████░░░░░░░░  62 % pagado (ilustrativo) · quedan 7.500 €                 │
│                                                                            │
│  ┌ ESTE MES (diciembre) ──────────────────────────────────────────────────┐ │
│  │ Cuotas 250 €  +  de más 270 € → Tarjeta (21,9 %)                       │ │
│  │ [Ya lo he pagado]  [Este mes no puedo]  · Siguiente: Préstamo en ene 27│ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                            │
│  CÓMO VAIS  ● ● ◐ ○ ·   racha 2 meses · 540 € de más de 600 previstos      │
│                                                                            │
│  EL ORDEN   1 Tarjeta  ──────▶ dic 26     (la más cara · 21,9 %)           │
│             2 Préstamo ──────────────────▶ sep 27  (+250 € liberados)       │
│             [¿Por qué este orden?]                                         │
│                                                                            │
│  [Ajustar el plan ▸  Previsión · sin bajar del suelo · avalancha · 0 €]    │
│  [Comparar con otras formas ▸]   [Cerrar las deudas saldadas (1) ▸]        │
└────────────────────────────────────────────────────────────────────────────┘
```

**Bloque A · Respuesta (hero).** Fecha protagonista (la del plan guardado o el óptimo), ahorro en intereses, barra de progreso
de capital pagado (requiere el capital inicial: ver TRE-D6) y una línea comparativa nombrada. Si hay deuda en impago fuera del
cálculo (DUO-D9), lo dice en la misma línea. Si la reserva está por debajo del suelo, el hero lo antepone (TRE-D3).
**Bloque B · Este mes.** La tarjeta de acción: cuánto, a qué contrato, cuándo (día sugerido tras el cobro de la nómina, desde la
previsión diaria), con «Ya lo he pagado» (marca el mes del seguimiento DUO-D1 sin esperar al extracto) y «Este mes no puedo»
(registra la decisión y recalcula). Es lo único que pide acción y va lo segundo.
**Bloque C · Cómo vais.** La fila de meses del seguimiento (DUO-D1) en una línea, con racha. Solo si hay plan guardado; si no,
este hueco es el botón «Este es nuestro plan».
**Bloque D · El orden.** Una línea de tiempo tipo Gantt (una barra por contrato, con su fecha de fin y la cuota que libera
encadenada a la siguiente con una flecha «+250 €»). **Sustituye** a las tres representaciones de §1.3 en la vista por defecto;
las otras dos pasan a «Ver detalle» (no se borran).
**Bloque E · Accesos.** Tres botones de divulgación con resumen del estado: «Ajustar el plan», «Comparar con otras formas»,
«Cerrar las deudas saldadas (n)».

### 2.3 «Ajustar el plan» (panel lateral en escritorio, hoja inferior en móvil)

Todos los controles del plan óptimo, agrupados y con su efecto en vivo sobre el hero (que sigue visible a la izquierda en
escritorio; en móvil, una mini-cabecera fija con «sep 2027 · 1.398 €» que cambia al tocar).

| Grupo | Controles (los que ya existen) | Mejora de UI |
|---|---|---|
| **Cuánto al mes** | Previsión / importe fijo; importe; pago inicial | Segmentado de 2 opciones; el importe solo aparece con «fijo»; deslizador + campo con pasos de 50 €, marcas en +50/+100/+150/+200 con su efecto (absorbe la tabla DUO-D5); pago inicial con tope de liquidez sobre el suelo |
| **Orden** | Avalancha / bola de nieve; cuándo preguntar | Dos tarjetas con su resultado al lado («sep 27 · 1.398 €» / «sep 27 · 1.398 €») y la frase «con vuestras deudas, coinciden» |
| **Lo que cambia el coste** | Quitas, comisiones y promociones (DUO-D3, DUO-D8), por contrato | Lista de contratos con insignias («comisión 3 %», «0 % hasta mar 27», «oferta de quita») y «Añadir» por fila; contador en el título del grupo |
| **Tipo variable** | Rango Euribor (DUO-D3) | Solo si hay contratos variables |

Pie del panel: «Restablecer lo recomendado» y, si hay plan guardado, «Guardar como nuestro plan» (sustituye con deshacer).

### 2.4 «Comparar con otras formas» (absorbe lo heredado sin perderlo)

Una tabla-resumen y una línea por alternativa, todas con el mismo formato (fecha · intereses · peor mes de caja):

- Solo las cuotas (hoy: «Camino a deuda cero» con extra 0).
- Según los plazos firmados (hoy: la tira superior).
- Bola de nieve / avalancha (si difieren).
- Consolidar en un préstamo (hoy: Ofertas › Préstamo y el simulador de Contratos).
- Liquidar con caja (hoy: la estrategia heredada «Orden de ataque» + «Antes de aplicar» + «Aplicar ruta»): **aquí** y en
  condicional, con su «Aplicar como escenario» intacto.
- «No tocar nada».

Cada fila: «Ver detalle» abre lo de siempre (el camino con su deslizador, la tabla del orden de ataque, el calendario de
amortización, «Cómo se apaga la deuda»), así que **nada se pierde**; solo deja de estar en la vista por defecto.

### 2.5 Deuda › Contratos, nueva estructura

```
Contratos · 2 vivos · 7.500 € · cuota 250 €/mes   (ficticio)            [+ Añadir] [Pegar varios]
┌ Datos que faltan: 4 contratos sin capital inicial · 1 sin TAE  [Completar ahora ▸] ┐
┌──────────────────────────┐ ┌──────────────────────────┐ ┌──────────────────────────┐
│ Tarjeta · Banco X   ⚠ TAE│ │ Préstamo · Caja Y        │ │ Hipoteca · Banco Z  var. │
│ 2.400 €   21,9 %   90 €/m│ │ 5.100 €   9,5 %   160 €/m│ │ …                        │
│ ▓▓▓▓░░░░ 38 % · fin dic 26│ │ ▓▓░░░░░░ … · fin sep 27  │ │                          │
│ [Editar] [Kit entidad] ⋯ │ │ [Editar] [Kit entidad] ⋯ │ │                          │
└──────────────────────────┘ └──────────────────────────┘ └──────────────────────────┘
Herramientas de contratos ▸  (CIRBE · deuda en la sombra · índices · revisión del tipo · cláusulas · cruce con activos · deuda dormida)
```

- **Tarjetas en vez de tabla editable** (lista de una columna en el móvil), ordenadas como el plan, con 4 datos (capital, TAE,
  cuota, fin) y la barra de progreso. Insignias: «sin TAE», «variable», «comisión», «0 % hasta», «en impago», «revolving: revisa
  la TAE» (DUO-D6).
- **Ficha de edición** (diálogo en escritorio, pantalla completa en móvil) con los campos agrupados: *Lo básico* (entidad, tipo,
  capital pendiente, TAE, cuota) · *Plazo y progreso* (capital inicial, plazos restantes, fecha de firma) · *Costes* (comisión,
  promoción, deducción fiscal) · *Estado* (activa, suspendida, en impago, acuerdo). Validación en línea y «Guardar» explícito;
  deshacer tras guardar (DUO-06).
- **«Datos que faltan»**: una banda única con contador y un recorrido «Completar ahora» que pregunta un dato cada vez (patrón de
  Clasificar: «1 de 5»). Sustituye a los «Sin capital inicial declarado» repetidos.
- **Una sola alta** con dos modos («Uno» / «Pegar varios»).
- **«Herramientas de contratos»**: las ocho herramientas avanzadas actuales en un índice plegado con una línea de qué hace cada
  una y su estado («CIRBE: sin informe»). Las dos listas de orden se retiran de aquí **redirigiendo** al Plan (regla de la casa:
  retirar = redirigir sin borrar código; se consulta, D-N41).

### 2.5b Deuda › Ofertas: que sean ofertas

**Hoy** (Ofertas › Comparar, 3.598 px a 1280 con dos contratos ficticios) mezcla siete cosas, y solo dos son ofertas: «¿Dónde
va el próximo euro?» (la escalera de WP-42), «Dinero parado», «Repartir la nómina», la capacidad de endeudamiento, la oferta de
reunificación, «Modo de liquidación por contrato» (con su tabla de ocho modos) y, en las otras dos subpestañas, la calculadora
de Préstamo y el Simulador visual. Quien entra a ver «¿nos compensa lo que nos ha ofrecido el banco?» no lo encuentra, y quien
busca «dónde va la nómina» no lo busca en Ofertas.

**Propuesta: Ofertas es la bandeja de lo que os ofrecen las entidades o podéis pedirles, cada cosa medida contra vuestro plan.**
De arriba abajo (maqueta: `DeudaTRE.html#ofertas`):

1. **Resumen en una línea:** cuántas ofertas abiertas, la que más ahorra frente al plan y cuándo vence la más próxima. Si no hay
   ninguna, el hueco enseña «Qué podéis pedir».
2. **Una tarjeta por oferta abierta** (quita, reunificación, refinanciación, traspaso al 0 %, aplazamiento): las condiciones en
   tres líneas, cuándo vence (en ámbar a menos de 30 días) y el **veredicto frente a vuestro plan**, con el mismo motor y la misma
   salida al mes (si la cuota baja, la diferencia se pone de más para comparar con justicia): «Os compensa: X € menos» /
   «No os compensa: X € más» / «Casi igual», con fecha, coste total (intereses y comisiones) y cuotas al mes. «La letra
   pequeña» se pliega con la trampa de cada tipo: cancelar la tarjeta al traspasar, el plazo que se alarga al reunificar, la
   huella en los ficheros de una quita. Acciones: «Meterla en el plan» (como propuesta, con deshacer: aceptarla con la entidad es
   cosa vuestra), «No nos interesa» (al historial) y «Avisadme 5 días antes» o «Contraoferta» (al kit de UND-13).
3. **«Añadir una oferta»:** un diálogo con el tipo en fichas y solo los campos de ese tipo. Sustituye a «Oferta de reunificación»
   y a las ofertas de quita de Ajustar el plan, que pasan a leerse de aquí (una sola fuente).
4. **«Qué podéis pedir»:** sale de los contratos, no de ofertas reales. Por ejemplo, la tarjeta revolving cara: pedir
   préstamo con plazo o traspaso, y revisar la TAE (DUO-D6); el préstamo con comisión: si baja con el tiempo; y antes de un
   impago, aplazamiento o carencia por escrito. Cada fila lleva a «Preparar la llamada» (kit).
5. **Tres accesos plegados:** «Probar a mano» (el Simulador visual y los ocho modos de liquidación, tal cual), «Juntarlas en un
   préstamo: la calculadora» (Ofertas › Préstamo, tal cual, para una oferta que aún no está por escrito) e «Historial» (ofertas
   rechazadas o vencidas, con fecha, útil para negociar).

**Salen de Ofertas, porque no son ofertas** (se consulta, D-N44): la escalera del próximo euro y «Dinero parado» → al Plan,
dentro de «¿Por qué este orden?» y de TRE-D3 (colchón primero), que es su pregunta; «Repartir la nómina» → Plan › Mes, donde se
confirma la nómina; la capacidad de endeudamiento → la cabecera de Contratos (y la línea del hero solo si pasa del umbral).
Medido en la maqueta: Ofertas, 1.343 px a 1440 y 2.708 a 390, con dos ofertas abiertas.

### 2.6 Inventario: dónde va cada pieza (garantía de «sin perder información»)

| Pieza actual | Hoy en | Pasa a |
|---|---|---|
| Titular + subtítulo de la estrategia ejecutada | Plan, arriba | Hero con la fecha del plan; la frase heredada → «Comparar › Liquidar con caja» |
| Plan óptimo: 3 cifras | Plan, a media altura | Hero (bloque A) |
| Recomendación de orden y «coinciden» | Plan | «¿Por qué este orden?» + panel › Orden |
| Texto de la previsión y del importe fijo equivalente | Plan | Panel › Cuánto al mes (bajo el segmentado) |
| Tramos («Hasta dic 2026: …») | Plan | Bloque D (Gantt) + «Este mes» |
| Tabla «Si ponéis más al mes» (DUO-D5) | Plan | Marcas del deslizador + «Ver como tabla» |
| Escalera del próximo euro / Préstamo (enlaces) | Plan | «¿Por qué este orden?» y TRE-D3 |
| Nota metodológica (comisiones, quitas, Euribor) | Plan | «¿Cómo se calcula?» al pie del panel |
| «Este es nuestro plan» + seguimiento (DUO-D1) | Plan | Bloques B y C |
| Cerrar las deudas saldadas (DUO-D2) | Plan | Bloque E, con contador |
| Camino a deuda cero (deslizador, 3 cifras, barras, cada 100 €) | Plan | «Comparar › Solo las cuotas › Ver detalle» (el deslizador se funde con el del panel; cada 100 € con las marcas) |
| Orden de ataque (4 pestañas + tabla) | Plan | «Comparar» (una fila por estrategia) |
| Ofertas abiertas | Plan, lateral | Ofertas, y una insignia en el hero si hay alguna |
| Capacidad de endeudamiento | Plan, lateral | Línea bajo el hero solo si pasa del umbral (H-9/DUO-D10); detalle en Contratos |
| Cómo se apaga la deuda | Plan | «Ver detalle» del Gantt |
| Calendario de amortización | Plan | «Ver detalle» del Gantt (con el motor del plan, no el ejecutado) |
| Antes de aplicar + Aplicar ruta | Plan, pie | «Comparar › Liquidar con caja» |
| Tabla editable de contratos | Contratos | Tarjetas + ficha |
| ¿Están las cuotas en el plan? / cuota de la refinanciación | Contratos | Banda de avisos de Contratos |
| CIRBE, sombra, índices, revisión de tipo, cláusulas, cruce, dormida | Contratos | «Herramientas de contratos» |
| Prioridad fiscal y orden avalancha/bola (listas) | Contratos | Plan (se consulta: D-N41) |
| Simulador de consolidación | Contratos | Ofertas › Préstamo (se consulta: D-N41) |
| Dos altas | Contratos | Una alta con dos modos |
| ¿Dónde va el próximo euro? y Dinero parado | Ofertas › Comparar | Plan: «¿Por qué este orden?» y TRE-D3 (D-N44) |
| Repartir la nómina | Ofertas › Comparar | Plan › Mes, al confirmar la nómina (D-N44) |
| Capacidad de endeudamiento | Ofertas › Comparar y Plan | Cabecera de Contratos (D-N44) |
| Oferta de reunificación y ofertas de quita | Ofertas › Comparar y Ajustar el plan | «Añadir una oferta» y su tarjeta con veredicto |
| Modo de liquidación por contrato (8 modos) y Simulador visual | Ofertas | Ofertas › «Probar a mano» |
| Préstamo (calculadora de consolidación) | Ofertas › Préstamo | Ofertas › «Juntarlas en un préstamo» |

### 2.7 Detalle visual (sistema de diseño v2)

- **Tipografía:** la fecha del hero en el cuerpo de cifra grande del tema v2 (el de Hoy), mes en palabras; el ahorro al lado en
  el mismo tamaño menos un paso. Nunca dos cifras protagonistas del mismo tamaño compitiendo.
- **Color con significado y siempre con forma:** verde = pagado/hecho, ámbar = a vigilar, rojo solo para impago o bajo el suelo;
  cada estado también con icono o patrón (accesibilidad; ya es norma con ● ◐ ○).
- **Gantt:** barra por contrato en el color de su estado, marca del mes actual, flecha de cuota liberada con importe, etiquetas
  directas (sin leyenda). Con 10 contratos, 10 filas de 28 px: 280 px. En el móvil, el eje en vertical (meses hacia abajo) o barras
  apiladas por año.
- **Campos numéricos** a su ancho, «€» como sufijo, `inputmode="decimal"`, pasos de 50 €.
- **Plegados** siempre con chevron, contador y resumen («Comisiones · 1 contrato»).
- **Objetivos táctiles** de 44 px mínimo; la hoja inferior del móvil respeta la zona segura.
- **Estados vacíos** (DUO-07): sin contratos, el hero es «Añadid vuestras deudas en 2 minutos» con «Pegar varios».

### 2.8 Fases, criterios de aceptación y medida

| Fase | Qué | Tamaño | Criterio de hecho |
|---|---|---|---|
| **TRE-D0** (P0, ya) | Titular y calendario desde el plan, no desde la ruta ejecutada; la tira superior y Hoy con la misma fecha (D-N40) | S | e2e: con contratos vivos, ningún «Sin deuda»; las fechas de tira, Hoy y hero coinciden; prueba de efecto al día |
| **TRE-D1** | Hero + «Este mes» + «Cómo vais» + Gantt en Deuda › Plan; lo demás, plegado tal cual detrás de «Ver detalle» | M | Deuda › Plan ≤ 1.300 px a 1280 y ≤ 2.600 px a 390 en la vista por defecto; axe en claro y oscuro; Safari |
| **TRE-D2** | Panel «Ajustar el plan» con vista previa (los controles actuales, mismos ids de datos para no romper DUO-01) | M | DUO-01 sin excepciones nuevas; un solo control de «al mes» en la vista |
| **TRE-D3** | «Comparar con otras formas» (absorbe camino, orden de ataque, calendario, aplicar ruta) | M | Todas las piezas del §2.6 accesibles en ≤ 2 toques |
| **TRE-D4** | Contratos en tarjetas + ficha + «Datos que faltan» | L | 0 desbordamiento horizontal a 320 px; campos visibles en la vista ≤ 10 |
| **TRE-D5** | Retiradas/redirecciones de Contratos (las dos listas, el simulador) | S | Solo con D-N41 «sí» |

**Medida (el medidor ya existe):** tiempo hasta ver la fecha (objetivo < 2 s y sin desplazamiento), aperturas de «Ajustar el
plan», tasa de «Ya lo he pagado» sobre meses del plan, % de contratos con datos completos. Revisión a las dos semanas de TRE-D1,
como cualquier pantalla del rediseño.

**Orden de trabajo técnico:** nuevo `deuda-plan-v2.js` (vista) sobre los motores actuales, sin tocar el cálculo; la vista actual
sigue disponible en «Versiones anteriores» hasta la graduación (como el resto del rediseño); referencia visual: la maqueta
`docs/rediseno/referencias/html/DeudaTRE.html` (25/11/2026), salvo que el hogar pida otra a Claude Design (ESTADO.md §1: las pantallas se copian de referencia).

---

## 3. El plan de saldo de deuda: lo que falta (v5)

Hecho hasta hoy (no se repite): v1 (orden, fecha, ahorro), v2 (quitas, liquidez mes a mes sin bajar del suelo, UND-11/12),
v3 (seguimiento con detección, hitos y cierre, coste real de amortizar, cada 50 €, DUO-D1/D2/D3/D5), v4 (impago en la fecha,
usura revolving, promociones al 0 %, ratio; DUO-D6/D8/D9/D10; DUO-D4 y D7 enlazan a WP-42 y Préstamo).

**TRE-D3 · Colchón primero cuando se está por debajo del suelo (P0 de criterio).** Si la liquidez está por debajo de la reserva
protegida, el plan propone por defecto *reconstruir el colchón* hasta el suelo antes de poner extra a la deuda, **salvo** a las
deudas con TAE por encima de un umbral (por defecto 15 %, editable), donde reparte. El hero lo dice: «Primero, lo que falta
hasta el suelo, al colchón (hasta {mes}); después, la tarjeta». Integra la cascada de WP-42 dentro del plan en vez de enlazarla. Es lo que haría
cualquier asesor y lo que protege de volver a endeudarse con la tarjeta ante un imprevisto. M · se consulta (D-N42: cambia la
recomendación por defecto).

**TRE-D4 · El día del pago.** «Este mes» propone la fecha: el día después del cobro con más margen según la previsión diaria
(ya existe en Hoy), y recuerda ese día (recordatorios). Pagar de más el día 2 en vez del 28 suele ser la diferencia entre
cumplir y no. S.

**TRE-D5 · Lo inesperado tiene destino.** Cuando entra un ingreso extraordinario (paga extra, devolución de Hacienda: los
detecta ya el motor de nómina/anomalías), una tarjeta: «Han entrado 1.200 € extra: ¿a la tarjeta (acabáis en oct 27, −84 €),
al colchón o a vuestra cosa?» con el reparto de la cascada. Es el momento de más impacto y hoy pasa sin que la app diga nada. M.

**TRE-D6 · Progreso de verdad.** La barra «62 % pagado» necesita el capital inicial; hoy casi nunca está. Propuesta: estimarlo
de cuota, TAE y plazo restante cuando falte (con «estimado» visible) y pedirlo en «Datos que faltan». Motiva, y es la cifra que
más se mira en apps de deuda (progreso > fecha). S.

**TRE-D7 · Desviaciones explicadas.** Cuando la fecha del plan se mueve de un mes a otro, una línea: «La fecha pasa de sep a oct
27: en noviembre no pusisteis de más (−270 €) y la previsión de enero baja». Combina el seguimiento DUO-D1 con UND-09. S.

**TRE-D8 · Plan a dos manos.** Si el hogar tiene dos miembros (household-members.js), «Este mes» dice quién paga qué si las
deudas son de titularidad distinta, y el reparto sigue `canonical-household-split.js`. M · solo si el hogar lo usa así (D-N43).

**TRE-D9 · Escenario de estrés sobre el plan.** «¿Y si un mes no entra una nómina?» directamente en el plan: qué mes se rompe,
y si conviene un colchón mayor antes de acelerar. Usa FX-21; no es una pantalla nueva. S.

**Descarto de nuevo:** reconexión bancaria automática para detectar pagos (D-N11 pendiente y fuera de alcance sin backend), y
gamificación con insignias (el tono de la casa es sobrio; el hito de DUO-D2 basta).

---

## 4. Otras funciones y mejoras de uso (fuera de Deuda)

### 4.1 Pendientes del backlog anterior, reordenadas

| Id | Qué | Recomendación | Por qué |
|---|---|---|---|
| DUO-05 | Barra inferior en el móvil | **Rehacer como barra que se esconde al bajar** (sí, recomendado) | Revierte el problema de tapar controles; con `position: sticky` al final del flujo o escondida con desplazamiento hacia abajo; Playwright desplaza hacia arriba para tocar y la barra vuelve, así que hay que medir con su propia batería antes de subir |
| DUO-06 | Deshacer en todo lo que borra o marca | **P1** | La ficha de contratos de TRE-D4 lo necesita |
| DUO-07 | Estados vacíos que enseñan el siguiente paso | P1, con TRE-D1 | El hero de Deuda vacío es el primero |
| DUO-08/UND-20 | Texto grande | P2 | Con la cabecera nueva, medir a escala 1,25 |
| DUO-09 | Arranque en frío medido en móvil lento | **P1** | 238 scripts; la vista nueva de Deuda no debe añadir carga |
| UND-25 | Tope de alto por pantalla en el CI | **P1**, con TRE-D1 | Los umbrales del §2.8 deben vigilarse solos |
| UND-10 | Calendario de lo que vence | P1 | Promociones al 0 %, revisiones de tipo y seguros: lo caro es lo que se renueva solo |
| UND-09 | «Qué ha cambiado» en una frase | P2, con TRE-D7 | Mismo mecanismo |
| UND-18 | Reunión mensual de 20 minutos | P2 | El bloque «Este mes» de Deuda es su punto 1 |
| DUO-02 | Un solo «¿Y si…?» | Se consulta (retira pantalla) | Tras la revisión trimestral, con datos |
| UND-05 | Inversión y áreas de Hoy desde su referencia | Tras la revisión | Medir antes de rehacer |
| UND-21 | Importar desde Compartir | Tras D-N11 | Depende |
| UND-19 | Entrada por la pregunta | **Descartada** (ya en la duodécima) | La barra y las áreas lo cubren |

### 4.2 Nuevas

**TRE-01 · «Este mes, en una hoja» (P1).** Una página imprimible/compartible (PDF del navegador o enlace de solo lectura,
`share.html` ya existe) con: cómo cerró el mes, lo que viene en 30 días, el paso de deuda de este mes y 3 decisiones abiertas.
Para la conversación de pareja/familia; hoy hay que enseñar la pantalla. S.

**TRE-02 · Búsqueda que contesta (P1).** «Buscar o abrir» ya existe y abre pantallas. Ampliarlo a respuestas sobre los datos sin
red ni IA: «súper 2026» → total, media mensual y enlace a los movimientos; «tarjeta» → su contrato y su línea del plan;
«noviembre» → el cierre. Reglas simples sobre categorías, contratos y meses. M.

**TRE-03 · Pegajosidad de los filtros y vuelta atrás fiable (P1).** Volver de un contrato o de un movimiento debe devolver al mismo
desplazamiento y filtros (hoy cada `render()` repinta). Es la queja silenciosa de cualquier app larga. S.

**TRE-04 · Presupuesto de superficie con «uno entra, uno sale» (P1, gobierno).** UND-25 pone el tope de alto; esta regla lo
completa: una función nueva en una pantalla que ya está en su tope obliga a proponer qué se pliega o retira en el mismo PR. Es
lo que evita que el rediseño de Deuda vuelva a 6.000 px en tres auditorías. S.

**TRE-05 · Hoy, con un límite de tarjetas (P1).** Con D-N39 entraron seis novedades a la vez. Propuesta: Hoy enseña como mucho 3
avisos/decisiones a la vez ordenados por urgencia × importe, y «Ver todo (n)». Ataca el riesgo anotado (Hoy saturado) sin
retirar nada, y el medidor podrá ver cuál se toca cuando compiten. S.

**TRE-06 · Modo «una mano» en el móvil (P2).** Acciones primarias de las hojas y diálogos abajo (zona del pulgar), y el «Guardar»
fijo al pie de las fichas. Encaja con la ficha de contratos. S.

**TRE-07 · Comprobación de coherencia de cifras protagonistas en el CI (P0, técnica).** Una prueba que, con el arranque en
caliente, lee todas las «fechas de libre de deuda», «deuda viva» y «liquidez hoy» visibles en todas las pantallas y exige que
coincidan (o que lleven nombre de comparación). Es la prueba que habría detectado el §1.1 y la que lo protegerá después. S.

---

## 5. Orden recomendado

1. **Ya (esta semana):** TRE-D0 (titular y fecha única) + TRE-07 (coherencia en el CI). Arreglo pequeño, protege todo lo demás.
2. **Semana del 30/11:** con la maqueta `DeudaTRE.html` como referencia, TRE-D1 (hero, este mes, cómo vais, Gantt) y TRE-05 (Hoy con límite).
3. **Semana del 7/12:** TRE-D2 (panel de ajustes) y TRE-D3 si D-N42 es «sí»; DUO-05 rehecha si el hogar dice sí.
4. **Semana del 14/12 (revisión trimestral):** TRE-D3 «Comparar», UND-25 + TRE-04, DUO-06.
5. **Tras el cierre de diciembre:** TRE-D4 (contratos en tarjetas), TRE-D5 a D9, TRE-01 a 03, UND-10.

## 6. Decisiones que pide

- **D-N40** · ¿Una sola fecha de «libre de deuda» en toda la app, la del plan guardado (o el óptimo si no hay), y las demás como
  comparaciones con nombre? Recomendación: **sí**. Sin esto, cualquier rediseño visual seguirá enseñando cuatro respuestas.
  **Decidida: «sí» del hogar (25/11/2026), con TRE-D0 y TRE-07 hechos el mismo día** (PROJECT_STATE 543, ESTADO §2). Al hacerlo
  salió un sexto origen de fechas: un contrato sin plazo declarado contaba como saldado este mes (la «nov 2026» de la tira y de
  Hoy con deuda viva), corregido en el mismo cambio.
- **D-N41** · Contratos: ¿retirar (redirigiendo) las dos listas de orden y el simulador de consolidación de esa pantalla, porque
  viven en Plan y en Ofertas › Préstamo? Recomendación: sí, tras dos semanas de TRE-D4 y con el medidor.
- **D-N42** · ¿El plan propone por defecto «colchón primero» cuando la liquidez está bajo la reserva, salvo deudas por encima de
  un 15 % de TAE? Recomendación: **sí**; el umbral, editable. **Decidida: «sí» del hogar (25/11/2026).** Se construye como TRE-D3
  (§3), detrás de TRE-08 y TRE-10.
- **D-N43** · ¿El plan reparte por titular (TRE-D8)? Solo si las deudas tienen titulares distintos y queréis verlo así.
- **D-N44** · Ofertas: ¿sacar de ella la escalera del próximo euro y «Dinero parado» (al Plan), «Repartir la nómina» (a Plan ›
  Mes) y la capacidad de endeudamiento (a Contratos), para que Ofertas sea solo ofertas con su veredicto? Recomendación: **sí**;
  son pantallas en uso, por eso se consulta. **Decidida: «sí» del hogar (25/11/2026).** Se traslada redirigiendo (los hashes de
  siempre siguen llevando a su sitio), junto con la bandeja de Ofertas del §2.5b.
- **Pendientes de antes:** DUO-05 rehecha como barra que se esconde al bajar (recomendación: sí); DUO-02 (un solo «¿Y si…?»,
  retira una pantalla: recomendación, decidir en la revisión del 14/12 con datos); UND-21 sigue a D-N11.

**Siguiente número de decisión libre: D-N45** (si se aceptan D-N40 a D-N44 con estos números).

---

## 7. Segunda pasada (25/11, tarde): lo medido fuera de Deuda, funciones nuevas y lo que queda del backlog

> Mismo criterio que el resto del documento: **propuesta, no backlog**; cifras de los contratos y movimientos **FICTICIOS** del
> arranque en caliente; decisiones nuevas desde **D-N45**. Medido con Playwright sobre `dist/` recién construido (Chromium del
> contenedor), a 390 × 844 y 1280 × 900, recorriendo 18 rutas.

### 7.0 Resumen en seis frases

1. **El escritorio arrastra unos 2.000 px de vacío en todas las pantallas.** El menú lateral mide 3.615 px con «Herramientas
   avanzadas» abierto (381 enlaces y botones visibles) y no se desplaza por su cuenta; Hoy mide 1.450 px. Al bajar, el área principal
   queda en blanco y solo sigue el menú. Es un defecto visible, no una opinión de diseño.
2. **En el iPhone, la cifra protagonista de Hoy no está en la primera pantalla cuando se estrena un dispositivo.** «Disponible hasta
   cobrar» empieza a 810 px de 844 durante la primera semana de uso en cada dispositivo, aunque los datos lleguen ya sincronizados.
   Pasada esa semana empieza a ~560 px, y el gráfico sigue fuera. Delante hay tres líneas de estado técnico («Dato real», la
   sincronización y «Fuente: …») y las cinco pestañas en dos filas.
3. **Hay una quinta fecha de «libre de deuda».** La tira heredada de cinco cifras, que sigue arriba en las pantallas sin rediseñar
   (Inversión, Patrimonio…), dice «Libre de deuda · nov 2026». D-N40 y TRE-07 tienen que cubrir toda la app, no solo Deuda.
4. **Se cuela texto de ingeniero:** ocho códigos internos en pantalla («(I1)», «(T6)», «(D6)», «(WP-25)», «(WP-45)», «(WP-53)»), un
   decimal con punto («1.8 meses») y una fecha ISO en el recuadro «Estado» («fecha de análisis 2026-11-25»).
5. **Deuda no es la pantalla más larga.** Ajustes en el escritorio mide 25.645 px, con 59 titulares y 145 campos (las áreas de
   UND-04 son solo del móvil). Inversión › Cartera mide 8.946 px y 51 campos en el móvil, y Fiscal 8.039 y 46. El Centro de alertas
   (versión anterior) mide 11.450 y 70.
6. **Lo que más rinde ahora no es otra función de deuda.** Es corregir lo que se ve mal en todas partes (TRE-08 a 11), el **Plan
   2027 desde lo real de 2026** (TRE-12, que vence el 31/12) y las tres piezas básicas de cualquier app de finanzas que aquí aún no
   existen: **una pantalla de reglas**, **dividir un movimiento** y **los recibos que suben** (TRE-14, 15 y 17).

### 7.1 Medidas por pantalla (vista por defecto, arranque en caliente)

| Pantalla | Alto 390 px | Campos 390 | Alto 1280 px | Campos 1280 | Comentario |
|---|---|---|---|---|---|
| Hoy | 2.816 | 0 | 1.450 (documento: 3.615) | 2 | El documento lo estira el menú (§7.0.1) |
| Movimientos | 3.951 | 0 | — | 3 | |
| Plan › Mes | 2.091 | 7 | — | 9 | |
| Plan › Previsión | 3.286 | 0 | — | 2 | |
| Cierre | 3.448 | 9 | — | 11 | |
| Deuda › Plan | 6.304 | 20 | 3.863 | 22 | §1 |
| Deuda › Contratos | 5.900 | 71 | 4.235 | 73 | §1.5 |
| Deuda › Ofertas › Comparar | 5.704 | 19 | — | 21 | §2.5b |
| Inversión › Cartera | **8.946** | **51** | 7.041 | 53 | Sin rediseñar (UND-05) |
| Herramientas › Fiscal | **8.039** | **46** | 4.968 | 48 | Campaña de fin de año y Renta |
| Ajustes | 5.047 (por áreas) | 29 | **25.645** | **145** | 59 titulares en el escritorio |
| Centro de alertas (versión anterior) | **11.450** | **70** | 4.727 | 72 | En el menú, en «Versiones anteriores» |

«—»: lo tapa el alto del menú (3.615 px), así que la cifra del documento no mide la pantalla. Los campos a 1280 incluyen los 2 del
menú lateral (el selector Hogar / Persona 1 / Persona 2). Ninguna ruta desborda en horizontal
ni dio errores de página. Fuera de las pantallas: **267 scripts** y `app.js` con **32.068 líneas**.

### 7.2 Correcciones (lo que se ve mal en todas partes)

**TRE-08 · El menú lateral con desplazamiento propio (P0 visual · S).** **Hecho en parte el 25/11 (ver al final de este punto).** Hoy, `.sidebar` es `position: sticky` con
`min-height: 100vh` y `overflow: visible`, en `styles.css:502`. Con su contenido más alto que la ventana, no se queda fijo y estira
el documento. Además, `advancedNav` se abre al visitar una pantalla suya y no se vuelve a cerrar (`app.js:4377`).
- En el escritorio (> 860 px): `height: 100dvh; overflow-y: auto; overscroll-behavior: contain`, con una sombra arriba y abajo que
  avisa de que hay más. El documento pasa a medir lo que la pantalla.
- «Herramientas avanzadas» se abre al entrar en una pantalla suya y **se cierra al volver a una principal**, salvo si el hogar la
  abrió a mano (se recuerda por sesión).
- ~~«Cuadro de mandos» sale dos veces en el menú~~ **Corrección (25/11, al construirlo):** no es un enlace repetido, son dos
  pantallas con el mismo nombre (`#cuadro-mandos` y la versión anterior `#visual-detail`). Renombrar la segunda toca la revisión
  trimestral (D-N38 usa el nombre del menú): se decide con D-N45.
- Criterio de hecho: a 1280 × 900, alto del documento de Hoy igual al de `#home` ± 40 px. Una e2e lo mide también en Movimientos y
  Plan, y el axe sigue en verde (el menú con desplazamiento propio necesita `tabindex` y nombre si es una región desplazable).
- **Lo hecho el 25/11 («sigue con TRE-08»):** «Herramientas avanzadas» se cierra al volver a una pantalla principal si se abrió
  sola, y Plan › Previsión declara su familia (resalta «Plan» y ya no abre el grupo). Medido a 1280 px con el arranque en caliente:
  el vacío bajo Hoy pasa de ~2.100 a ~150 px; bajo Deuda › Plan, Previsión y Ajustes desaparece. **Lo que no se ha hecho, y por qué:**
  el desplazamiento propio del menú. Contradice una regla escrita en una prueba del 1/8/2026 (E7, `tests/e7-interface.test.cjs`:
  «escritorio usa el scroll único de página»), sin motivo anotado. Sin él, una pantalla más baja que el menú cerrado (1.663 px)
  sigue dejando vacío debajo: ~150 px en Hoy y ~500 px en Plan › Mes. **D-N48 (se consulta):** ¿el menú del escritorio pasa a tener
  su propio desplazamiento (y se retira la regla del 1/8)? Recomendación: **sí**; es el patrón de cualquier aplicación de escritorio
  con menú largo, y la regla de agosto es anterior a que el menú tuviera 380 entradas.
- **D-N45 (se consulta):** sacar «Versiones anteriores» (10 entradas) del menú y dejarla como lista en Ajustes › Laboratorio, junto
  a la revisión trimestral (D-N38). Los enlaces y los hashes siguen funcionando: no se retira ninguna pantalla, solo su entrada en el
  menú. Recomendación: **sí**. Son pantallas que la revisión del 14/12 ya va a juzgar, y hoy ocupan ~360 px del menú.

**TRE-09 · La primera pantalla de Hoy en el iPhone (P0 de uso · S).** Objetivo: **la cifra y su gráfico en los primeros 844 px**,
siempre. Es la pantalla más vista y la única que se mira de pie.
- Las tres líneas de estado («Dato real», sincronización y «Fuente: …») pasan a **un punto de estado en la cabecera**, junto al ojo
  de UND-17: verde (guardado y sincronizado), ámbar (solo en este equipo) o rojo (error). Al tocarlo se abre la hoja con lo de
  siempre. «Fuente: demo-publico-anonimizado» no es información para el hogar: se queda en esa hoja. Es el patrón de cualquier app
  bancaria: el estado se ve con un vistazo y se lee al tocar.
- «Primeros pasos» se basa en la primera semana **de este navegador** (`dex5IsFirstWeek`, `app.js:810`), así que sale en cada
  dispositivo nuevo aunque haya meses de datos sincronizados. Pasa a depender **de los datos**: menos de 30 días de movimientos y
  ningún mes firmado.
- Las cinco pestañas de áreas, **en una sola fila con desplazamiento horizontal** y un degradado en el borde que dice que hay más,
  en vez de dos filas. Ahorra ~50 px y es el patrón que ya usan las pestañas de Deuda.
- «Ver todo el detalle» baja al final de la vista (es una salida, no una acción del día), y «+ Registrar gasto» se queda arriba.
- Criterio de hecho: e2e a 390 × 844 (`@safari`) con la cifra y el gráfico por encima de 844 px, con y sin «Primeros pasos».

**TRE-10 · Sin texto de ingeniero en pantalla, comprobado por el CI (P1 · S). Hecho el 25/11:** la prueba recorre las 53 rutas del
menú y encontró 13 fugas más que la primera pasada (que miraba 18): «(E15)», «(E16)», «(E12b)», «(R-11)» y fechas ISO en el Centro
de alertas, el Asesor ejecutivo, la simulación de vida nueva y el widget. Corregidas todas. Ya hubo una limpieza de códigos («(T11)», ESTADO
§2). Volvieron porque nada lo impide. Propuesta:
- Arreglar las nueve fugas de §7.0.4: los ocho códigos y «1.8 meses» en Herramientas › Patrimonio. La fecha ISO del recuadro
  «Estado» pasa a «25 nov».
- Una prueba que, con el arranque en caliente, recorra las rutas del menú y falle con códigos entre paréntesis
  (`\((?:[A-Z]{1,4}-?\d{1,3})\)`), fechas ISO, decimales con punto seguidos de «meses», «%» o «€», y «NaN», «undefined» o
  «Infinity». Es el mismo patrón que la prueba de privacidad, aplicado al lenguaje.

**TRE-11 · La tira heredada de cinco cifras, con la fecha única (P0, con D-N40 · S). Hecho con TRE-D0 el 25/11: la tira dice la fecha
del plan y «según…»; TRE-07 recorre las 53 rutas del menú.** La tira sigue arriba en las pantallas sin
rediseñar y lee `homeDebtOutlook`, que cuenta los plazos declarados. Con D-N40 «sí», enseña la fecha del plan o, si no hay plan,
nombra la que da: «según los plazos firmados». **TRE-07 debe recorrer todas las rutas**, no solo Deuda y Hoy: sin esto, el arreglo de
TRE-D0 deja una quinta fecha en Inversión y en Patrimonio.

### 7.3 Funciones nuevas

Elegidas con tres filtros: (a) resuelven una tarea que el hogar hace cada mes o cada año y hoy hace fuera de la app o a mano; (b) no
duplican nada de lo que ya hay ni de lo ya propuesto (lo comprobé en el código: `grep` de cada concepto); (c) caben en una pantalla
que ya existe, sin entrada nueva en el menú (TRE-04: uno entra, uno sale).

**TRE-12 · Plan 2027 desde lo real de 2026 (P1 · M · vence el 31/12).** El momento de más valor del año para una app de presupuesto
es diciembre, y hoy el plan del año siguiente se rehace a mano partida a partida. No hay nada en el código para el año siguiente.
- **Dónde:** Plan › Mes. En diciembre, una línea encima de las partidas: «Preparar el plan de 2027 con lo real de 2026 · unos 10 min».
  Es una hoja a pantalla completa en el móvil y un diálogo ancho en el escritorio, con el patrón del Repaso semanal (pasos a la
  izquierda).
- **Paso 1 · Lo que pasó.** Por partida, el real de los 12 meses: total, mediana mensual y los meses raros marcados (más del doble de
  la mediana; se pueden excluir con un toque, «fue la avería del coche»). Con menos de 12 meses, lo que haya, y lo dice.
- **Paso 2 · La propuesta.** La mediana × 12, más la inflación por categoría (energía, alimentación, seguros, colegio y vivienda,
  editable: es PRV-06 en pequeño), más **los cambios que la app ya conoce**: las cuotas que libera el plan de deuda en 2027 (el
  Gantt de TRE-D1, mes a mes), los recibos que suben (TRE-17), la revisión del tipo de la hipoteca (WP-20) y las promociones al 0 %
  que acaban (DUO-D8). Cada partida dice de dónde sale su cifra: «Mediana 312 € × 12 + 3 % de alimentación».
- **Paso 3 · Lado a lado.** 2026 previsto · 2026 real · 2027 propuesto, con la diferencia y «Aceptar todas» o partida a partida.
  Abajo, lo que hace a la previsión: ahorro del año, colchón en el punto más bajo y fecha de libre de deuda (la única, D-N40).
- **Escribe el plan** solo tras «Qué ocurrirá» (decisión 6 de ESTADO §3), y se deshace entero.
- Medida: minutos del recorrido (objetivo: 10) y % de partidas aceptadas tal cual.
- **D-N46 (se consulta):** la base, ¿la **mediana de 12 meses** (recomendada: aguanta los meses raros) o el último trimestre × 4
  (recoge cambios recientes, pero exagera la estacionalidad)? ¿Y se hace antes del 31/12?

**TRE-13 · Vuestro 2026 en una página (P2 · S-M · enero).** Tras firmar diciembre: ingresos, gasto, tasa de ahorro, **deuda pagada
(capital e intereses, por separado)**, patrimonio de enero a diciembre, las tres partidas que más crecieron frente al plan, el acierto
de la previsión y las decisiones grandes del año. Sobrio (sin confeti, por el tono de la casa), imprimible y con el mismo formato
que TRE-01. Es la conversación de pareja más valiosa del año y hoy no tiene soporte.

**TRE-14 · Las reglas de clasificación, en una hoja (P1 · M).** Clasificar es el cuello de botella medido (XDA-05: 5 de 7 grupos sin
propuesta en noviembre). ESTADO §4 reconoce que «no existe una pantalla de reglas»: una regla mal creada solo se arregla movimiento a
movimiento, desde la ficha.
- **Dónde:** Movimientos › «Reglas (N)», como hoja, sin entrada en el menú.
- **Qué enseña:** una fila por regla, con lo que reconoce (el concepto, o las palabras de CLA-01), su partida, cuántos movimientos
  ha cogido y el último. Se puede buscar.
- **Avisos arriba:** reglas que se contradicen (el mismo comercio a dos partidas), reglas que no han cogido nada en 90 días y
  reglas creadas por «Por clasificar».
- **Acciones:** editar la partida (con «¿a cuáles?» como en la ficha: solo los nuevos, o también los de meses sin firmar) y borrar
  con «Deshacer» (DUO-06). Lo firmado no cambia.
- Es lo que tienen Monarch, YNAB o Lunch Money, y lo que convierte Clasificar en algo que se mantiene en vez de algo que se repite.

**TRE-15 · Dividir un movimiento entre partidas (P1 · M · cambia el modelo).** El caso diario: el ticket del híper con súper y
farmacia, un pedido de Amazon de tres cosas o el recibo de la comunidad con derrama. Hoy un movimiento va a una sola partida (0
resultados para «dividir» en el código).
- En la ficha del movimiento: «Dividir», con dos o más líneas (partida e importe). El resto se calcula solo y no se guarda hasta que
  suma el total.
- En la lista, una etiqueta «2 partidas».
- Cierre y los reales leen el reparto. Las reglas no dividen (una regla no puede saber el reparto de un ticket).
- **D-N47 (se consulta):** toca el modelo de reales y el cierre (`bank-actuals-applied`), y una división en un mes firmado debe quedar
  prohibida o reabrir el mes. Recomendación: **sí, y solo en meses sin firmar**.

**TRE-16 · Etiquetas que cruzan partidas (P2 · M).** «Viaje a Roma» o «Reforma del baño»: movimientos de varias partidas con su total
y su fecha de inicio y fin. Hoy solo se puede ver por partida. La búsqueda que contesta (TRE-02) las usa («roma» da el total). Sin
etiquetas automáticas: se ponen en lote desde Movimientos (TRE-20).

**TRE-17 · Recibos que suben y cargos nuevos que se repiten (P1 · M).** El motor ya reconoce el recibo de cada mes por su importe y su
día (DEC-14, `canonical-pattern-rules.js`, `recurring`). Lo que falta es **vigilarlo**:
- Una lista de recibos y suscripciones: lo que cuestan al mes y al año, cómo han cambiado frente a hace 12 meses y su día de cargo.
- Un aviso en «Decidir esta semana» solo en dos casos:
  - un recibo sube más del 5 % («El seguro del coche pasa de 41 a 47 € al mes: +72 € al año»);
  - aparece un **cargo nuevo que se repite** («9,99 € al mes desde septiembre, ¿lo reconocéis?»).
- Acciones: «Es correcto», «No lo reconocemos» (el kit de UND-13 adaptado: cómo pedir la baja o reclamar) y «Recordádmelo antes de la
  renovación» (TRE-19).
- Es la función con el retorno más claro y más medible de todo el documento. Las suscripciones olvidadas y las subidas que se
  aceptan solas son el agujero típico de un hogar.

**TRE-18 · El nombre limpio del comercio en las listas (P2 · S-M).** «COMPRA TARJ. 5678 MERCADONA VALENCIA ES» → «Mercadona». Se hace
con la misma normalización que ya usa Clasificar para agrupar por comercio. El concepto original sigue en la ficha. Un alias
editable («Esto es: Colegio») vale también para las reglas. Movimientos se lee el doble de rápido; es lo primero que se nota en
Copilot o Monarch.

**TRE-19 · Las fechas, al calendario del móvil (P2 · S).** La app solo habla cuando se abre, y una notificación web sin servidor no
llega con la app cerrada (y en el iPhone exige instalarla como app). La alternativa fiable, sin servidor ni permisos, es **«Añadir al
calendario» (.ics)**, que crea un evento con recordatorio en el calendario del teléfono. Fechas:
- el día del pago de la deuda (TRE-D4);
- el fin de cada promoción al 0 % (DUO-D8);
- la revisión del tipo (WP-20);
- las renovaciones de UND-10 (seguros, ITV, suscripciones anuales);
- el repaso semanal.

El fichero solo lleva el título y la fecha, **sin importes** (un calendario se comparte y se sincroniza fuera).

**TRE-20 · Elegir varios movimientos a la vez (P2 · S-M).** Pulsación larga en el móvil y Mayús + clic en el escritorio. Con varios
elegidos: poner partida, marcar como traspaso, poner etiqueta (TRE-16) o «Por clasificar». Hoy la edición múltiple solo existe en
Partidas.

**TRE-21 · Ajustes en el escritorio con índice fijo (P1 · M).** 25.645 px y 145 campos. Lo menos invasivo, que **no** reabre D-N29
(«áreas solo en el móvil»): a la izquierda, un índice fijo con los diez grupos de siempre, «Buscar un ajuste» y la marca del grupo en
el que estáis (scroll-spy); a la derecha, el contenido de siempre, sin mover ninguna tarjeta. Si en la revisión del 14/12 no basta,
se consulta pasar las áreas también al escritorio.

**TRE-22 · Inversión con una pregunta (P1 · L).** Es UND-05/INV-01 con prioridad subida por la medida: 8.946 px y 51 campos en el
móvil, con la tira heredada (y su quinta fecha) delante del título.
- **Respuesta:** «¿Llegáis a vuestros objetivos?» con una fila por objetivo (cuánto falta, a qué ritmo vais y la fecha probable).
- **Acción:** la aportación del mes que la previsión garantiza (INV-06, el mismo motor que el plan de deuda de UND-12, sin bajar del
  suelo).
- **Por qué:** el reparto frente al objetivo y el coste total de la cartera en euros al año (INV-03).
- **Ajustes:** cada posición como tarjeta con su ficha, **el mismo componente que Contratos en TRE-D4**.

Referencia visual: `Inversion.png`.

**TRE-23 · Tres componentes comunes antes de rehacer más pantallas (P1 técnica · M).** TRE-D4 (Contratos), TRE-22 (Inversión),
TRE-21 (Ajustes) y la ficha de cuentas piden lo mismo. Construirlo cuatro veces es la forma de que cada pantalla quede distinta:
- la **ficha de edición** (diálogo en el escritorio, hoja a pantalla completa en el móvil, campos en grupos, validación en línea,
  «Guardar» fijo al pie al alcance del pulgar —TRE-06— y deshacer tras guardar);
- la **lista de tarjetas** con insignias de estado (con forma, no solo color);
- el **plegado con señal** (chevron, contador y resumen del valor: «Comisiones · 1 contrato»), que §1.4 echa en falta.

Un fichero cada uno, con prueba propia y página en `design-system.html`. Abarata TRE-D4 y TRE-22 en torno a un tercio, y es lo que
hace que la app parezca una y no doce auditorías.

### 7.4 El backlog anterior: lo que no se ha hecho y qué hacer con ello

Método: cruce automático de los identificadores de las auditorías novena a duodécima con `PROJECT_STATE.md` y `ESTADO.md`, y
revisión a mano del título de cada uno de los que no aparecen. Puede haber alguno hecho con otro nombre; lo marco donde lo sé.

| Estado | Ids | Qué hacer |
|---|---|---|
| **Hechos con otro nombre** (no repetir) | HOG-04 → UND-17 (ocultar cifras); UND-14 → DUO-D1; UND-16 → DUO-D2; DEC-05 → DUO-05 (rehecha, pendiente); DEC-19 → TRE-09 | Nada |
| **Absorbidos por algo ya propuesto** | DEC-08 → TRE-D4; DEC-07 → TRE-D1 y TRE-22; DEC-09 → TRE-02; DEC-33 → UND-10 (+ TRE-19); DEC-34, DEC-35, DEC-37, HOG-01 y HOG-02 → UND-18 y TRE-01; DEC-06 → UND-04 (móvil) y TRE-21 (escritorio); DUO-03 → la revisión del 14/12 (D-N38, ya hecha la hoja) | Se hacen con su sucesor |
| **Abiertos y que siguen valiendo, P1** | **INV-02** (¿invertir o amortizar?, neto de impuestos frente a la TAE más cara: va dentro de «¿Por qué este orden?» de TRE-D1); **INV-06** (aportar lo que la previsión garantiza, en TRE-22); **PRV-03** (estacionalidad) y **PRV-06** (inflación por categoría), que necesita TRE-12; **DEC-25** (la previsión con lo exigible: con DUO-D9 ya se sabe qué está en impago); **DEC-42** (Hoy primero, carga partida) con DUO-09; DUO-06, DUO-07, UND-10 y UND-25 | Al orden de §7.5 |
| **Abiertos, P2** | DAT-04 (confirmar saldos con una captura: el OCR de tickets ya existe); DAT-06 y DEC-02 (calidad del dato por mes y sello en cada cifra, que conviene juntar); INV-03 (coste total de la cartera); INV-04 (importar posiciones por CSV); PRV-07 (línea de vida con hitos); PRV-08 (exportar la previsión a Excel con fórmulas); DEC-04 (las causas del cambio de cifra al firmar); DEC-32 (sensibilidad de una línea por escenario); DEC-28 («Salir del fichero», solo si aplica); DEC-43 (graduar por defecto a los 28 días); UND-09 (con TRE-D7); UND-18; DUO-08 (con UND-20) | Tras el cierre de diciembre |
| **Bloqueados por algo externo** | DAT-02 (PSD2, O-6); DAT-03 (buzón por correo: necesita servidor); CLA-05 (propuesta por modelo: A5-1); DAT-01 (la tarjeta de crédito con su detalle: falta un extracto real); UND-21 (D-N11) | Siguen esperando |
| **Descarto (con motivo)** | **PRV-04** (1.000 trayectorias remuestreando meses reales) e **INV-05** (probabilidad de éxito por Monte Carlo): con 13 meses de historia, la muestra no da para una probabilidad; sería precisión falsa con aspecto de ciencia. **INV-07** (concentración por región, sector o divisa): choca con el hueco de datos de clase de activo (índice de decisiones). **PRV-09** (previsión en sombra): solo tiene sentido cuando haya un método nuevo que comparar | No se hacen mientras no cambie el motivo |

### 7.5 Orden recomendado (integra §5)

1. **Ya, sin decisión pendiente:** TRE-08 (menú) y TRE-10 (texto de ingeniero y su prueba). Son correcciones pequeñas y visibles en
   todas las pantallas.
2. **Con D-N40 «sí»:** TRE-D0 + TRE-07 (sobre todas las rutas) + TRE-11 (**hechos el 25/11**). Después, TRE-09 (la primera pantalla de
   Hoy).
3. **Antes del 31/12:** TRE-12 (Plan 2027), si D-N46 es «sí», y TRE-17 (recibos que suben), que alimenta TRE-12. **TRE-23 antes de
   TRE-D4.**
4. **Semana del 14/12 (revisión trimestral):** D-N45 (Versiones anteriores fuera del menú) con los datos de la revisión; TRE-21.
5. **Enero:** TRE-13 (vuestro 2026), TRE-14 (reglas), TRE-15 (dividir, si D-N47 es «sí»), TRE-D4 y TRE-22 sobre TRE-23.
6. Después: TRE-16, 18, 19 y 20 y los P2 de §7.4.

### 7.6 Lo que no quiero callar

- **El ritmo de propuestas supera con mucho al de comprobación.** Van trece auditorías en cinco semanas y 156 funciones con ficha
  propia solo desde la novena (14/11), contadas en los documentos. El panel del 4/11 decía «construido 65 %, comprobado 0 %», y
  Deuda › Plan llegó a 6.300 px a base de funciones bien hechas una a una. Mi recomendación como quien la construye: **no añadir ni una función más a
  Deuda hasta que TRE-D1 esté publicada y medida dos semanas**, y que TRE-04 (uno entra, uno sale) sea regla, no propuesta.
- **Los defectos de §7.2 los habría visto un humano en diez segundos**, y ninguna prueba los vio porque las pruebas comprueban que
  cada función hace lo suyo, no cómo se ve la app entera. Por eso TRE-07, TRE-10 y UND-25 (comprobaciones transversales) valen más
  que cualquier función nueva de esta lista.
- **El dato real sigue siendo la restricción.** TRE-12, 13 y 17 dependen de que los extractos lleguen cada mes. Si diciembre no se
  importa entero, el Plan 2027 se hará con 11 meses y lo dirá; pero el mejor uso de 10 minutos del hogar esta semana sigue siendo
  importar y clasificar noviembre.

**Decisiones nuevas:**
- **D-N45:** «Versiones anteriores», del menú a Ajustes › Laboratorio.
- **D-N46:** la base del Plan 2027 y si se hace antes del 31/12.
- **D-N47:** dividir movimientos, solo en meses sin firmar.

- **D-N48:** el menú del escritorio con desplazamiento propio (§7.2, TRE-08).

**Siguiente número libre: D-N49.**
