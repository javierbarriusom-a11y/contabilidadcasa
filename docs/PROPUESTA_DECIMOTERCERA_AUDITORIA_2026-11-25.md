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
- **D-N41** · Contratos: ¿retirar (redirigiendo) las dos listas de orden y el simulador de consolidación de esa pantalla, porque
  viven en Plan y en Ofertas › Préstamo? Recomendación: sí, tras dos semanas de TRE-D4 y con el medidor.
- **D-N42** · ¿El plan propone por defecto «colchón primero» cuando la liquidez está bajo la reserva, salvo deudas por encima de
  un 15 % de TAE? Recomendación: **sí**; el umbral, editable.
- **D-N43** · ¿El plan reparte por titular (TRE-D8)? Solo si las deudas tienen titulares distintos y queréis verlo así.
- **Pendientes de antes:** DUO-05 rehecha como barra que se esconde al bajar (recomendación: sí); DUO-02 (un solo «¿Y si…?»,
  retira una pantalla: recomendación, decidir en la revisión del 14/12 con datos); UND-21 sigue a D-N11.

**Siguiente número de decisión libre: D-N44** (si se aceptan D-N40 a D-N43 con estos números).
