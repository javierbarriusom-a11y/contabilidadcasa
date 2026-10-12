# WP-54 · Prueba de usabilidad con 5 personas ajenas — protocolo, guion y hoja de hallazgos

**Estado:** kit preparado el 12/10/2026. **La prueba no se ha hecho ni una vez**: este documento no contiene ningún resultado de personas, solo cómo obtenerlos.
**Fuente:** `GOV-06` (`docs/PROPUESTA_SEXTA_AUDITORIA_2026-10-03.md` §6), ficha de WP-54 en `docs/PLAN_DESARROLLO_DEFINITIVO.md`.
**El repositorio es público: aquí no entra ningún dato de las personas que hagan la prueba (nombre, edad, empleo, citas que las identifiquen) ni ningún dato real del hogar.** Los hallazgos se guardan sin identificar a nadie (§8).

## 1. Para qué sirve, y para qué no

**Problema que resuelve.** Hasta hoy la app la han usado y juzgado dos personas: quien la diseña y quien la usa a diario. Con n = 2 no se distingue un fallo de diseño de un hábito personal («lo encuentro porque ya sé dónde está»). Cada paquete se ha medido con quien lo pidió. La prueba busca lo contrario: **personas que no saben dónde está nada**.

**Qué da.** Una lista de problemas con **evidencia observada** (qué hizo, qué dijo, cuánto tardó) y su gravedad. Con 5 personas se descubre la mayoría de los problemas de usabilidad de una pantalla (la regla de Nielsen que cita la auditoría); no se pide más.

**Qué NO da, y conviene no confundir:**
- **No es una medida de adopción.** Que 5 desconocidos entiendan «Capacidad libre real» no dice nada sobre si el hogar abrirá la app cada semana. Eso lo mide el panel de uso (WP-03).
- **No valida las cifras.** Se usa la **demostración sintética**: se mide si se entiende y se encuentra, no si el número es el correcto para ninguna familia.
- **No sustituye al cronómetro en el iPhone** de la hipótesis H1 (carga de «Hoy»), aunque se puede aprovechar la sesión (§6, paso 2).
- **Cinco personas no son una muestra.** Un problema visto por una sola persona es una **observación**, no un hallazgo.

## 2. Reglas de la prueba (no se negocian)

1. **Solo la demostración sintética pública** (`https://javierbarriusom-a11y.github.io/contabilidadcasa/`, que lleva únicamente datos inventados). **Nunca los datos reales del hogar**, ni en la pantalla ni en el teléfono de nadie.
2. **Ventana privada** del navegador en cada sesión (se parte de cero y no queda nada guardado). Al terminar se cierra.
3. **Consentimiento explícito y de viva voz** antes de empezar: se prueba la app, no a la persona; puede parar cuando quiera; no se graba audio ni vídeo ni pantalla **salvo que lo acepte expresamente**; se anotan hechos y frases, sin nombre.
4. **Quien dirige no ayuda ni defiende el diseño.** Si la persona se atasca: silencio, y a los 60 s una **pista de un nivel** (§5). Se apunta que hubo pista. Nunca se dice «es ahí».
5. **No se prueba a gente que haya visto la app** (ni familia directa ni quien haya participado en su diseño). Sí vale gente cercana que **no la haya usado**.
6. **Notas sin datos personales.** En la hoja solo «P1…P5», y un perfil genérico («lleva las cuentas con una hoja de cálculo», «no lleva cuentas»). Nada más.

## 3. Quién (5 personas) — decisión del hogar (H-13)

Es la única parte que no puede hacer Claude: **proponer 5 personas antes del 15/12/2026**. Perfiles recomendados (que se parezcan a quien *podría* usar la app, no a quien la diseña):

| Perfil | Cuántas | Por qué |
|---|---|---|
| Lleva las cuentas de su casa con una hoja de cálculo o un cuaderno | 2 | Es el usuario natural: sabe lo que busca y mide la app frente a lo que ya hace |
| Comparte cuentas con su pareja y reparte los gastos a ojo | 1 | La captura de gastos y el «cuánto nos queda» son lo suyo |
| No lleva cuentas, pero tiene una deuda (hipoteca, préstamo) | 1 | Prueba la deuda y los términos sin conocimiento previo |
| Con formación financiera o de gestión | 1 | Sin hábito de la app pero con lenguaje: detecta jerga mal usada y cifras ambiguas |

**Evitar:** gente que haya participado en el diseño o haya visto la app; quien vaya a decir «está genial» por cortesía (se pide explícitamente que sea crítica). Si solo hay 3 personas, se hace con 3 y se dice (§9): con menos de 5 se pierde cobertura, no validez.

## 4. Antes de cada ronda (30 minutos de quien dirige)

1. **Ensayo.** Hacer las cinco tareas uno mismo en la demo y **reescribir la «respuesta esperada» de §5**: la demo es relativa a la fecha (el mes, los vencimientos y «hoy» cambian) y las cifras de este documento son las del 12/10/2026. Si una tarea ya no tiene respuesta clara, **se corrige antes de la sesión, no durante**.
2. **Generar el extracto ficticio de la tarea 3 con la fecha de ese día:** `node tools/build-usability-extract.mjs --out extracto-demo.csv` (12 movimientos, todos inventados). Pasarlo al teléfono o abrirlo desde el ordenador donde se haga la prueba.
3. **Ronda 0.** La primera vez, **una sesión de ensayo con una sola persona** que no cuente entre las 5: sirve para ajustar el guion (tiempos, enunciados que se malinterpretan). Si el enunciado de una tarea induce la respuesta, se reescribe.
4. Tener a mano la **hoja de observación** (§7) —impresa o en una nota— y un cronómetro.

## 5. Guion de 30 minutos

| Minutos | Qué |
|---|---|
| 0 – 4 | Bienvenida, consentimiento (§2.3), «piensa en voz alta» |
| 4 – 24 | Cinco tareas de unos 4 minutos |
| 24 – 30 | Preguntas de cierre (§7.3) |

**Cómo se dice.** Se lee el enunciado tal cual, **sin nombrar pantallas, botones ni palabras de la app**. Se pide: «Dime en voz alta lo que piensas y lo que esperas encontrar». Se detiene el cronómetro cuando la persona **dice la respuesta** (o abandona). Si pasan **5 minutos** sin respuesta, se anota «no lo consigue» y se sigue con la tarea siguiente.

**Pistas** (una por nivel, a partir de los 60 s de atasco, y se apunta cuál): *nivel 1* «¿qué esperarías encontrar en la pantalla de inicio?»; *nivel 2* «mira el menú»; *nivel 3* se le dice la sección. Con el nivel 3 la tarea cuenta como **con ayuda**.

Todas las tareas empiezan en la pantalla de inicio de la demo (`#home`), sin enseñar nada antes.

### T1 · Entender la pantalla de inicio — «Hoy»
- **Enunciado:** «Acabas de abrir la aplicación. Cuéntame, con tus palabras, cuánto dinero libre tenéis este mes y si hay algo que debería preocuparos.»
- **Empieza en:** `#home`.
- **Hecho cuando:** dice una cifra de la tarjeta de **capacidad libre real** (o de la reserva) y **explica con sus palabras** qué significa. Anotar si lo confunde con «saldo en la cuenta».
- **Respuesta esperada (12/10/2026, a revisar):** *Capacidad libre real* 447,50 € («cerca del umbral»); *Reserva protegida* 7.230,00 €; *Próximo riesgo*: sin déficit.
- **Qué se observa:** si lee la tarjeta o salta a otra cosa; si entiende «umbral» y «reserva protegida»; cuánto tarda en decir una cifra (objetivo del plan, **≤ 15 s**).

### T2 · Anotar un gasto — «+ Registrar gasto»
- **Enunciado:** «Acabas de pagar 23,40 € en el súper, en Mercadona. Anótalo en la aplicación.»
- **Empieza en:** `#home`.
- **Hecho cuando:** el gasto queda anotado (aparece como partida del mes) **y** la persona lo dice. **Anotar los segundos** hasta guardar.
- **Respuesta esperada (a revisar):** botón «+ Registrar gasto» → ventana con concepto, bloque e importe → «Registrar». **La demo no tiene tarjetas configuradas, así que se prueba la ventana de siempre, no la hoja de captura de WP-30** (objetivo del plan, **≤ 8 s**, solo mide la hoja). Es una limitación conocida de esta ronda (§9).
- **Qué se observa:** si encuentra el botón; si entiende «bloque»; si duda con el importe («23,40» o «23.40»); si cree que ya está guardado.

### T3 · Cargar el extracto del banco
- **Enunciado:** «Tu banco te ha dado este archivo con los últimos movimientos. Súbelo a la aplicación y dime cuántos movimientos ha leído y si hay alguno que ya tenías anotado.»
- **Empieza en:** `#home`; el archivo (`extracto-demo.csv`) está en el dispositivo.
- **Hecho cuando:** carga el fichero, **dice el número de movimientos** (12) y **señala el movimiento que coincide con el gasto de la tarea 2** (la compra de 23,40 € en Mercadona), o dice que no lo ve. **No hace falta que confirme la importación.**
- **Respuesta esperada (a revisar):** Registrar › Importar extracto → panel «Cómo he leído este fichero» (12 movimientos, sin avisos) → paso 3 «Duplicados»: la compra de 23,40 € se propone como **la misma que anotó**. **Trampa a propósito:** otra fila de 23,40 € de otro comercio (farmacia) **no** debe darse por la misma compra.
- **Qué se observa:** si encuentra «Importar extracto»; si entiende el panel de lectura; **qué propone el paso 3 cuando en la tarea 2 anotó otro concepto** («Súper», «compra»…: sin nombre comparable, la pareja sale como «comercio distinto» y es la persona quien decide); si entiende «Es la misma compra / Son distintas» y si **se fía de la propuesta sin leerla** (riesgo que ya se anotó en WP-53).

### T4 · Deuda — cuánto queda y qué cambia con más
- **Enunciado:** «Tenéis unas deudas. Dime cuánto debéis en total y cuándo las terminaríais de pagar. Si pusierais 200 € más al mes, ¿cambiaría algo?»
- **Empieza en:** `#home`.
- **Hecho cuando:** dice el total pendiente, una fecha de fin y **el efecto de 200 € más** (menos meses, menos intereses).
- **Respuesta esperada (12/10/2026, a revisar):** *Deuda pendiente* 12.000,00 € (3 contratos); en «Camino a deuda cero»: «septiembre de 2029» y «cada 100 € más al mes: 13 meses menos y 177,71 € menos de intereses».
- **Riesgo previsible a observar (R-1):** la demo da **dos mensajes de «libre de deuda» que no coinciden a primera vista**: «Libre de deuda sept 29» en Hoy y «Libre de deuda: sin fecha estimable · sin cuota activa» en la cabecera de la ruta, junto a «Libre de las deudas con cuota septiembre de 2029». Es coherente (una deuda no tiene cuota activa), pero **es fácil que una persona nueva vea una contradicción**: se anota si pregunta «¿en qué quedamos?».
- **Qué se observa:** qué camino toma (Hoy → «Ver la ruta», o el menú); si encuentra el control de «extra al mes»; si cree que la proyección «ejecuta» algo (la pantalla dice que no).

### T5 · Fin de mes — ¿llegamos?
- **Enunciado:** «Imagina que mañana hay que hacer un pago grande. ¿Creéis que llegáis a fin de mes con el dinero que hay? ¿Qué día lo pasaríais peor?»
- **Empieza en:** `#home`.
- **Hecho cuando:** dice **un día o un mes concreto** y lo apoya en una pantalla (Previsión, o el mapa de pagos grandes).
- **Respuesta esperada (12/10/2026, a revisar):** Plan › Previsión: «El punto delicado es oct 26: cae a 5.080,00 € el 01 oct 26, antes de los cobros del mes».
- **Qué se observa:** si encuentra Previsión; si entiende el gráfico; si distingue «previsto» de «real»; si usa la tarjeta del punto delicado o va al gráfico.

## 6. Durante la sesión

1. Pasar el teléfono (ideal: **un iPhone con Safari**, el dispositivo del hogar) en **ventana privada** y abrir la demo.
2. *Opcional, y solo si se hace con iPhone:* **cronometrar** desde pulsar el enlace hasta que «Hoy» muestra sus tarjetas. Es una medida de la hipótesis H1 (la única que responde a H1) y se anota **aparte** de la prueba, tres veces; no se pide nada a la persona.
3. Leer las tareas por orden. **No cambiar el orden**: T3 depende de que T2 se haya hecho (por eso T3 propone la pareja). Si T2 falla del todo, se hace la anotación por la persona (con ayuda) para poder seguir.
4. Tras cada tarea, **una pregunta (SEQ, escala 1-7):** «Del 1 (muy difícil) al 7 (muy fácil), ¿qué tal ha sido esta tarea?».

## 7. Hoja de observación

### 7.1 Por tarea (una por persona)

| Campo | Cómo se anota |
|---|---|
| **Resultado** | **A** sin ayuda · **B** con pista (nivel 1-3) · **C** no lo consigue o abandona |
| **Segundos** | desde el enunciado hasta la respuesta (o el abandono) |
| **Errores** | toques que no llevaban a la respuesta (cuántos) |
| **Camino** | pantallas por las que pasó, en orden |
| **Lo que esperaba** | «yo pensaba que aquí saldría…» (cita literal) |
| **Cita** | la frase que mejor resume lo que pensó |
| **SEQ (1-7)** | su respuesta |

### 7.2 Resumen de una ronda (5 personas)

Una tabla tarea × persona con A/B/C, la mediana de segundos y la mediana de SEQ. **Regla:** una tarea con **≥ 3 personas en B o C** es un problema de esa pantalla, no de las personas.

### 7.3 Preguntas de cierre (6 minutos)

1. «¿Qué ha sido lo más confuso?» (sin pistas).
2. «¿Qué cambiarías primero?».
3. «¿Para qué usarías esta aplicación, si es que la usarías? ¿Cada cuánto?». *(Se anota tal cual: es la señal de si alguien más que el hogar la querría; no se discute.)*
4. «¿Qué esperabas ver que no ha salido?».

## 8. De la observación al backlog

**Qué es un hallazgo.** Un problema **visto en ≥ 2 personas** (con **evidencia** de cada una). Visto en 1 → **observación**, se guarda pero no se corrige hasta que se repita en otra ronda.

**Gravedad:**
| Nivel | Criterio |
|---|---|
| **Alta** | impide terminar la tarea (C) o la hace terminar **mal sin que la persona lo note** (respuesta equivocada con seguridad) |
| **Media** | se termina, pero con pista o con ≥ 3 errores |
| **Baja** | se termina; molesta, duda o lo dice («esto no lo entiendo»), sin coste real |

Un problema que lleva a **una respuesta equivocada con seguridad** es siempre **alta**, aunque sea una sola persona.

**Formato de cada hallazgo** (una tarjeta en `BACKLOG_DEFINITIVO.md` §13, sin nombres):

```
H-U-<año><trimestre>-<n> · <tarea> · <gravedad> · <pantalla>
Visto en: P1, P3, P4 (3 de 5)
Evidencia: A/B/C de cada una · segundos · cita literal sin identificar a nadie
Qué esperaba la persona: ...
Hipótesis del problema (la de quien dirige; la causa no se afirma): ...
Propuesta mínima: ...
Estado: abierto
```

**Reglas:** (1) **la evidencia va siempre**; sin evidencia no hay hallazgo. (2) **No se corrige durante la ronda** (cambiar la app entre sesiones rompe la comparación). (3) **La propuesta es de quien dirige, no de las personas**: las personas dicen qué fue difícil, no cómo arreglarlo. (4) Los hallazgos **no se puntúan como paquetes del plan**: son entradas del backlog con su gravedad.

## 9. Limitaciones que hay que conocer (no se esconden)

1. **La demo no tiene tarjetas**: T2 prueba la ventana anterior, no la hoja de WP-30. Para probar la hoja habría que dar de alta una tarjeta en la demo antes de cada sesión; no se hace en la primera ronda para no sesgar la comparación entre sesiones.
2. **«Hoy» sigue congelado hasta leer H-02** (decisión anterior): lo que se prueba en T1 es lo publicado hoy, y un hallazgo sobre «Hoy» **no se corrige** sin esa decisión.
3. **La respuesta esperada caduca**: está escrita a 12/10/2026. Hay que reescribirla en cada ensayo (§4.1).
4. **La persona que dirige es quien diseñó la app**: tiende a ayudar sin querer y a interpretar con indulgencia. Por eso las pistas son de nivel fijo, la evidencia es literal y los resultados A/B/C salen de reglas, no de impresión. Si es posible, **dirige la sesión otra persona del hogar** y quien diseña **observa sin hablar**.
5. **Con menos de 5 personas se pierde cobertura**, no validez: se hace igual y se dice.
6. **Nada de esto mide si el hogar usará la app.** Eso es el panel de uso.

## 10. Calendario y criterio de éxito

| Cuándo | Qué | Quién |
|---|---|---|
| Antes del 15/12/2026 | Proponer 5 personas (H-13) y una más para la ronda 0 | hogar |
| Primera quincena de diciembre | Ronda 0 (1 persona) y ajustes del guion | quien dirige |
| Segunda quincena de diciembre | **Primera ronda** (5 personas, 30 min cada una) | quien dirige |
| Cada trimestre desde entonces | Una ronda, con los hallazgos anteriores como lista de comprobación | quien dirige |

**El paquete se da por hecho cuando** hay una ronda completa con su resumen (§7.2) y sus hallazgos en el backlog (§8). **Hasta entonces WP-54 no cuenta en el avance del plan**: lo que existe es un protocolo, no un resultado.
