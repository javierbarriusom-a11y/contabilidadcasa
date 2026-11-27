# Decimocuarta auditoría — 26 de noviembre de 2026

> **Propuesta, no backlog.** Siglas nuevas **CAT-xx**; decisiones nuevas desde **D-N51**. Medido con Playwright (Chromium del
> contenedor) sobre `dist/` recién construido con R1, primera parte (#691), con los datos de demostración, a 390 × 844 y
> 1440 × 900, recorriendo las **53 rutas del menú**. Todas las cifras son de la demo; ninguna es del hogar.
> Pedido por el hogar el 26/11: «análisis crítico y propuestas de mejora, con las mejores prácticas de UX y UI, nuevas funciones
> donde tengan sentido, optimizar lo ya desarrollado y revisar lo que no se ha hecho del backlog anterior».

---

## 0. Resumen en ocho frases

1. **La app no tiene un problema de funciones: tiene uno de encontrarlas.** Tres de las «funciones nuevas» de la decimotercera
   auditoría ya existían: dividir un movimiento (DAT-07, publicado el 19/11), las fechas al calendario del móvil (`.ics`,
   `canonical-reminders.js`) y los recibos que suben (P8, `canonical-ghost-expense-detector.js`, de septiembre). Si quien las
   construyó no las encontró, el hogar tampoco.
2. **Conviven dos apps.** De las 52 pantallas del menú, **6** tienen el diseño nuevo completo (sin la tira de cifras). En las otras
   46 el título está a **358 px** del borde superior en el iPhone (mediana); en ninguna de las 52 está por debajo de 100 px.
3. **La mitad de las pantallas no caben en cuatro pantallazos del iPhone:** **26 de 52** miden más de 2.000 px a 390 y **13** más de
   5.000 px. Las cinco más largas son simuladores y versiones antiguas: el simulador visual de deuda (12.347 px), la simulación de
   vida nueva (11.334), el Centro de alertas (10.841, 70 campos), Apalancamiento (10.196, 71 campos) y el agente de ahorro (10.098).
4. **El ritmo de construcción supera al de uso.** **121 novedades en noviembre** (cuatro al día) y 222 desde octubre; 14 auditorías
   en seis semanas. El panel del 4/11 decía «construido 65 %, comprobado 0 %». Cada función bien hecha añade una línea a una pantalla
   que ya no se lee entera.
5. **Para meter datos hay seis puertas:** Registrar, Registrar el mes, Importar, Datos (herramientas), Actualizar datos y la mesa de
   datos (`data-entry`). La cabecera de Registrar se presenta como «La única puerta de escritura de datos reales».
6. **Hoy sigue sin enseñar su cifra y su gráfico en la primera pantalla del iPhone** si el dispositivo es nuevo: con «Primeros
   pasos» (177 px, aunque haya datos), «Disponible hasta cobrar» empieza a 740 px de 844 y el gráfico a 1.005 (TRE-09, sin hacer).
7. **El fallo de Safari de hoy (DUO-D3) es un patrón, no un caso:** los oyentes que se enganchan al pintar la pantalla y no al
   cargar. Hay que buscar los demás antes de que los encuentre el hogar.
8. **Recomendación:** seis semanas de «menos y mejor». Terminar el marco común (R1 parte 2 y R2), adelgazar las cinco pantallas
   gigantes, hacer que se encuentre lo que existe y unificar la entrada de datos. Solo tres funciones nuevas antes de enero, las que
   tienen fecha: Plan 2027, reglas y recibos.

---

## 1. Medidas (53 rutas del menú, demo, vista por defecto)

**Estructura:** 268 enlaces en el menú del móvil (53 rutas distintas); **252 scripts** y **34 hojas de estilo** en la carga;
**8.579 nodos** en el DOM de Hoy, porque todas las pantallas viven en `index.html` (8.634 líneas); `app.js` con **32.092 líneas**
(techo de ARQ-4: 32.155). 712 ficheros de prueba.

**Las pantallas rediseñadas** (sin tira; título medido a 390 y a 1440 px):

| Pantalla | Alto 390 | Título 390 | Título 1440 |
|---|---|---|---|
| Hoy | 2.475 | 188 | 130 |
| Plan | 2.272 | 139 | 84 |
| Cierre | 2.611 | 152 | 94 |
| Deuda › Plan | 1.313 | 202 | 144 |
| Deuda › Contratos | 1.259 | 201 | 143 |
| Deuda › Ofertas | 1.048 | 253 | 194 |

**Las más largas** (todas con tira y cabecera antigua):

| Pantalla | Alto 390 | Campos | Alto 1440 | Qué es |
|---|---|---|---|---|
| Deuda › Simulador visual | 12.347 | 0 | 10.090 | Un iframe con la hoja antigua |
| Simulación de vida nueva | 11.334 | 28 | 7.532 | Versión anterior |
| Centro de alertas | 10.841 | **70** | 4.382 | Versión anterior |
| Inversión › Apalancamiento | 10.196 | **71** | 8.159 | 29 titulares |
| Agente de ahorro | 10.098 | 10 | 4.730 | Versión anterior |
| Inversión › Cartera | 8.465 | 51 | 6.747 | Sin rediseñar (UND-05) |
| Plan de liquidación de deuda | 7.574 | 0 | 4.031 | Versión anterior |
| Herramientas › Fiscal | 7.454 | 46 | 4.537 | Campaña y Renta |
| Ajustes | 4.462 (áreas) | 29 | **26.029** | 16 titulares a 390 |
| Partidas | 5.020 | 42 | 3.474 | 5.536 palabras |

**Mediana de alto a 390: 2.013 px. Mediana del título: 358 px a 390 y 165 px a 1440. Ninguna pantalla con el título a < 100 px
en el iPhone** (criterio de R1). En total, 562 campos y unas 34.500 palabras visibles por defecto entre las 52 pantallas.

---

## 2. Diagnóstico crítico

### 2.1 Lo que existe y no se encuentra (P0 de producto)

| Función | Existe desde | Dónde vive hoy | Quién la echó en falta |
|---|---|---|---|
| Dividir un movimiento entre partidas | DAT-07, 19/11 | Ficha del movimiento | TRE-15 (25/11) la propuso como nueva |
| Fechas al calendario del móvil (`.ics`) | WP-32 | Recordatorios | TRE-19 la propuso como nueva |
| Recibos que suben y suscripciones | A16-3 + P8, septiembre | Análisis (pantalla antigua) | TRE-17 la propuso como nueva |
| Apuntar un gasto desde un enlace (`#registrar?importe=`) | WP-25 | Solo por URL | Nadie: no hay forma de descubrirla |
| Serie del patrimonio por cierres | WP-46 | Herramientas › Patrimonio | DEC-04 pedía «por qué cambió la cifra» |

**Por qué pasa:** el único índice de lo que hace la app son los nombres del menú (53 rutas, 268 enlaces) y Novedades (222 líneas).
No hay un inventario de **capacidades** (lo que se puede hacer), solo de **pantallas** (dónde está). El buscador «Buscar o abrir»
busca pantallas.

**Coste:** cada duplicado propuesto gasta una sesión de diseño. Una función que el hogar no encuentra vale cero y además ocupa
sitio en una pantalla.

### 2.2 Dos apps en una (P0 de UI)

- **6 pantallas con el diseño nuevo y 46 con el antiguo.** El hogar pasa de una cabecera de 50 px a una de 350 al cambiar de
  pantalla. La coherencia es lo que hace que una app parezca un producto y no una colección de funciones.
- **Las cabeceras antiguas explican en vez de responder.** Registrar abre con «La única puerta de escritura de datos reales»,
  tres líneas de subtítulo, «Fuente del libro: libro canónico calculado», el flujo en una línea y un recuadro «Previsto, real y
  usado» con tres definiciones. Es documentación de arquitectura en la pantalla que más se usa para meter datos.
- **Inversión › Cartera** abre con «Datos para la Renta» (un plegado fiscal) antes que el valor de la cartera, y con el botón
  «Actualizar valoración» deshabilitado en verde apagado: parece roto, no vacío.
- **La tira de cinco cifras** sigue en 46 pantallas. En Ajustes dice «Libre de deuda · Sin fecha» y Hoy dice «libre jul 2027\*»
  con el mismo dato: dos formas de decir lo mismo. D-N40 se cumple (una sola fecha), pero no una sola frase.

### 2.3 Hoy en el iPhone (P0 de uso; TRE-09 sin hacer)

- **«Primeros pasos» con datos:** una tarjeta de 177 px arriba («Empieza por Registrar y repasa Hoy cada día») aunque haya meses de
  movimientos.
  Depende de la primera semana **de este navegador** (`dex5IsFirstWeek`), no de los datos.
- **Las cinco pestañas en dos filas** (a 609 y 657 px): casi 100 px para la navegación secundaria antes de la cifra.
- **Resultado (medido):** «Disponible hasta cobrar» empieza a **740 px** de 844 y el gráfico a **1.005 px**: fuera de la primera
  pantalla.
- **Lo bueno, que hay que conservar:** la cifra protagonista con su frase («Sin bajar del suelo de 1.500 €. Cobráis en 19 días»),
  el gráfico con el suelo y el cobro marcados, «Decidir esta semana» con prioridad y una acción por tarjeta, y el aviso de saldos
  estimados. Es el mejor patrón de la app: **respuesta, evidencia y acción**.

### 2.4 Pantallas gigantes (P1)

Los cinco peores casos no son de las pantallas del día a día, pero están en el menú, y el menú es el mapa de la app:
- **Simulador visual de deuda (12.347 px, 0 campos):** un iframe con la hoja antigua, que mide lo que mide su contenido.
- **Apalancamiento (71 campos, 29 titulares):** tres simuladores y un registro en una sola página.
- **Centro de alertas (70 campos), agente de ahorro, simulación de vida nueva y plan de liquidación:** versiones anteriores, que la
  revisión del 14/12 (D-N38) va a juzgar.
- **Ajustes a 1440 px: 26.029 px.** Las áreas de UND-04 son solo del móvil (D-N29).

### 2.5 Seis puertas para meter datos (P1)

`#registrar`, `#registrar-mes`, `#datos-importar`, `#herramientas-datos`, `#update-data` y `#data-entry`. Cada una nació bien
justificada (E3, A3-8, WP-25, RD-A4…), pero juntas fuerzan al hogar a saber **qué tipo de dato** tiene antes de saber **dónde
escribirlo**. Las apps de referencia (Monarch, Copilot, YNAB, Revolut) tienen **un botón «+»** que pregunta qué queréis añadir.

### 2.6 Microcopy y señales (P2, pero en todas partes)

- **«18 por revisar»** en el menú, junto a Ajustes, sin decir qué se revisa. Es la revisión trimestral de funciones (D-N38): para el
  hogar parece un aviso de datos pendientes.
- **«Plan 2026-2036»** como nombre de la app en la cabecera: es el nombre de un fichero, no de un producto.
- **«Modo sesión con asesor o pareja»**, una casilla en lo alto de Ajustes. La referencia (`Sistema.html`) lo pone en el menú de la
  persona, con «Guía», no en una pantalla de configuración.
- **Controles por debajo de 44 px de alto** en el móvil: **18 en Hoy** (las pestañas de áreas miden 40), 16 en Inversión › Cartera y
  8 en Escenarios. El objetivo táctil del sistema de diseño es 44 px.

### 2.7 Riesgos técnicos que ya se han visto (P1)

- **Oyentes enganchados al pintar (DUO-D3, hoy).** `attachPlanOptimo` solo se llamaba en `renderPlanOptimo`; lo escrito antes del
  primer pintado se perdía. Es un patrón copiable: cualquier `attach*` que solo se llame desde un `render*` tiene el mismo fallo en un
  teléfono lento. Solo lo ve Safari en el CI.
- **Todo el DOM cargado siempre:** 8.579 nodos y 252 scripts para enseñar Hoy. El presupuesto de carga (5 s) se cumple en el CI, pero
  el iPhone del hogar no es el runner. H-26 (medir en el iPhone) sigue pendiente.
- **La versión de `app.js` congelada** porque la fijan unas veinte pruebas. Cada PR que cambia `app.js` sin cambiar su versión deja
  ~10 minutos de caché HTTP con el HTML nuevo y el JS viejo.

### 2.8 El proceso (lo que no quiero callar)

- **Catorce auditorías en seis semanas son demasiadas.** Esta incluida. El hogar decide más despacio de lo que se le propone: siguen
  abiertas D-N41, D-N43 y D-N45 a D-N47, y DUO-05, DUO-02 y UND-21. Mi propuesta es que la siguiente auditoría no llegue antes del
  14/12, y que sea la revisión trimestral con datos de uso.
- **Las pruebas comprueban funciones, no la experiencia.** 712 ficheros de prueba, y ninguno mide «cuántos toques se tarda en
  apuntar un gasto» o «a qué altura está la cifra de Hoy». Los que más han rendido (TRE-07, TRE-10, XGO-01, el desbordamiento) son
  transversales. Hay que hacer más de esos.

---

## 3. Propuestas

Cada una con el problema, la propuesta, dónde va, el criterio de hecho y el tamaño (S ≤ 1 sesión, M 2-3, L > 3).

### Bloque A · Encontrar lo que ya existe (lo que más rinde)

**CAT-01 · Inventario de capacidades y guardia contra duplicados (P0 de proceso · S).**
- `docs/gobierno/capacidades.json`: una entrada por cosa que el hogar puede **hacer** (no por pantalla). Cada entrada lleva:
  - el verbo («Dividir un movimiento entre partidas»);
  - sinónimos («repartir», «separar un ticket»);
  - la pantalla y el control donde se hace;
  - la sigla de origen (DAT-07…).
- Se genera una vez a mano desde Novedades (222 líneas) y desde ahí lo mantiene cada PR que añade una capacidad, igual que
  `superficie.json`.
- **Una prueba** comprueba que cada línea nueva de Novedades tiene su capacidad.
- **Regla para las auditorías:** antes de proponer una función, buscarla en el inventario y en el código. Esta auditoría lo hace
  (§2.1).
- Hecho cuando: cada línea de Novedades que sigue viva tiene su capacidad y la prueba está en el CI.

**CAT-02 · «Buscar o hacer» que encuentra acciones (P1 · M; es G5 de R2).**
- El lanzador (⌘K / «Buscar o abrir») busca también en el inventario de CAT-01. Escribir «dividir» lleva a la ficha del movimiento
  con la explicación de cómo hacerlo; «recibos» lleva a la lista de CAT-03; «calendario» lleva a «Añadir al calendario».
- **Arriba del menú**, como en la referencia (G5), con su atajo visible. En el móvil, el primer elemento del menú.
- Tolerante a tildes y erratas (ya lo es la búsqueda difusa de #10/P-6).
- Hecho cuando: las 5 funciones de §2.1 se encuentran en dos toques desde Hoy, con una e2e que lo comprueba.

**CAT-03 · Los recibos y suscripciones, en Movimientos (P1 · S-M; sustituye a TRE-17).**
- **No es una función nueva:** es sacar A16-3 + P8 de Análisis (pantalla antigua) a una pestaña de Movimientos, «Recibos».
- **La lista:** una fila por recibo con lo que cuesta al mes y al año, su día de cargo y cómo ha cambiado frente a hace 12 meses
  (la subida en € al año, que es lo que se entiende).
- **Los avisos**, en «Decidir esta semana» y solo en dos casos:
  - una subida de más del 5 %;
  - un cargo nuevo que se repite tres meses.
- **Las acciones:** «Es correcto», «No lo reconocemos» (con el kit de UND-13 para reclamar) y «Recordádmelo antes de renovar» (el
  `.ics` de WP-32, que ya existe).
- Hecho cuando: Análisis enlaza aquí en vez de pintarlo, y hay una e2e con un recibo FICTICIO que sube.

**CAT-04 · «Apuntar gasto» desde la pantalla de inicio del teléfono (P2 · S).**
- WP-25 ya abre Registrar relleno con `#registrar?importe=…`. Falta que se pueda llegar a ello.
- **Android y escritorio:** un segundo atajo en el manifiesto («Apuntar gasto» → `./#registrar?nuevo=1`).
- **iPhone, que no lee `shortcuts`:** en Ajustes › Hogar y cuentas, «Añadir a Atajos de iOS», con la receta en tres pasos y el
  enlace listo para copiar. Funciona con Siri («Oye Siri, apuntar gasto»), sin servidor.
- Hecho cuando: el atajo está en el manifiesto y la receta en la app, comprobada a mano por el hogar en su iPhone.

### Bloque B · Terminar el marco común (una sola app)

**CAT-05 · R1, segunda parte, con un criterio medido (P0 · M).**
- **La cabecera de pantalla única:** H1 corto, control segmentado al lado y acciones a la derecha; en el móvil, H1 y debajo el
  control en una fila con desplazamiento. Un componente en `views/componentes-v2.js`, como el resto de TRE-23.
- **La franja superior pierde el antetítulo duplicado** («FIN DE MES» arriba y «FIN DE MES · CIERRE» en la pantalla).
- **Las intros, en una línea.** Lo que explica la pantalla (Registrar, Ajustes, Escenarios…) pasa a la guía (R1, parte 1), que ya
  tiene su sitio.
- **La tira de cinco cifras fuera** de las pantallas que no la necesitan, siguiendo D-N49. Propongo ampliarla (D-N51) a todas: en
  las pantallas sin cifra protagonista, la tira no responde a su pregunta (Partidas no necesita la deuda viva).
- **Criterio de hecho**, ampliando `test:mobile-overflow` con una medida nueva: el título de cada una de las 52 pantallas a menos de
  **120 px** a 390 y a menos de **100 px** a 1440. Hoy: 0 de 52 y 2 de 52.
- **D-N51 (se consulta):** quitar la tira de cinco cifras de todas las pantallas del tema v2, no solo de las que tienen cifra
  protagonista. Recomendación: **sí**. Hoy ya da las cinco cifras, a un toque desde cualquier sitio.

**CAT-06 · R2, la navegación de cinco destinos (P0 · L; D-N50 ya decidida).**
- Sin cambios sobre la auditoría de diseño (§4, R2), con dos precisiones:
  - **la barra inferior lleva un «+» central** (CAT-07), que es la acción más frecuente;
  - **«18 por revisar» sale del menú** y pasa a una línea en Ajustes › Laboratorio con su nombre: «18 funciones por revisar el
    14/12».
- Hecho cuando: el menú cerrado cabe en 900 px de alto en el escritorio y la barra inferior está en el móvil, con e2e `@safari`.

**CAT-07 · Un solo «+» para meter datos (P1 · M).**
- **Una hoja «Añadir»** (inferior en el móvil, panel en el escritorio) con cuatro opciones grandes:
  1. **Un gasto o ingreso** (Registrar, con la ficha de WP-25);
  2. **Un extracto** (Importar, con sus tres fuentes);
  3. **El saldo de una cuenta** (la reconciliación de Registrar);
  4. **Los reales del mes** (Registrar el mes).
- Cada opción abre **lo que ya existe**: no se reescribe nada, se cambia la puerta.
- `#data-entry`, `#update-data` y `#herramientas-datos` siguen funcionando por su enlace, pero salen del menú (es lo que D-N45
  hace con «Versiones anteriores»).
- **Medida:** toques desde Hoy hasta guardar un gasto de 12,50 € en «Supermercado». Objetivo: **≤ 4**. Una e2e lo cuenta.
- **D-N52 (se consulta):** sacar del menú `#data-entry`, `#update-data` y `#herramientas-datos` cuando el «+» esté publicado.
  Recomendación: **sí**, con la revisión del 14/12 como red: si alguna se echa en falta, vuelve.

**CAT-08 · Hoy, la primera pantalla (P0 · S; es lo que queda de TRE-09).**
- «Primeros pasos» depende de los datos: menos de 30 días de movimientos y ningún mes firmado.
- Las cinco pestañas en una fila con desplazamiento y un degradado en el borde.
- «Ver todo el detalle» baja al final; «+ Registrar gasto» se queda arriba (y con R2 pasa al «+» de la barra).
- Hecho cuando: hay una e2e `@safari` a 390 × 844 con la cifra **y** el gráfico por encima de 844 px, con y sin datos.

### Bloque C · Adelgazar lo que pesa

**CAT-09 · Las cinco pantallas gigantes (P1 · M cada una, en este orden).**
1. **Deuda › Simulador visual (12.347 px).** El iframe se queda, pero con alto fijo (100 dvh menos la cabecera), su propio
   desplazamiento y «Abrir a pantalla completa». No cambia nada de dentro.
2. **Apalancamiento (71 campos).** Se parte en tres accesos con la pregunta de cada uno («¿Me compensa pedir prestado para
   invertir?», «¿Cuánto puedo pedir?», «¿Y si cae el mercado?»). Cada uno abre su simulador en panel, con el patrón de «Ajustar el
   plan» (TRE-D2). Por defecto, la respuesta del último cálculo guardado.
3. **Inversión › Cartera** (TRE-22 / UND-05, sin cambios de fondo): «¿Llegáis a vuestros objetivos?» arriba, las posiciones como
   tarjetas con la ficha de TRE-D4 y «Datos para la Renta» abajo, plegado. **Un estado vacío de verdad:** sin posiciones, una
   tarjeta «Añadid vuestra primera posición» con el botón, no un botón verde deshabilitado.
4. **Ajustes en el escritorio:** el índice fijo de TRE-21 (sin cambios).
5. **Las versiones anteriores** (Centro de alertas, agente de ahorro, vida nueva, plan de liquidación): no se adelgazan, se juzgan el
   14/12 (D-N38) y salen del menú (D-N45).
- **Criterio común:** ninguna pantalla por defecto de más de **3.000 px a 390**, salvo listas que crecen con los datos
  (Movimientos, Partidas). Hoy hay **16** por encima.

**CAT-10 · Partidas, la pantalla más leída (P1 · M).**
- 5.536 palabras y 42 campos por defecto: es el texto de toda la app en una pantalla.
- **Por defecto:** una lista de partidas con su previsto del mes y su real, agrupadas (Fijos, Variables, Financiaciones, Ahorro),
  como el reparto de Plan › Mes.
- **Cada partida abre su ficha** (el componente de TRE-D4), con lo que hoy son columnas: el histórico, la capa, el día de cargo y la
  regla.
- **La edición múltiple** de hoy se queda, tras «Editar varias».

### Bloque D · Funciones nuevas con fecha (solo tres antes de enero)

Comprobadas contra el código y el inventario de §2.1: ninguna existe.

**CAT-11 · Plan 2027 desde lo real de 2026 (P1 · M · vence el 31/12; es TRE-12).**
- Sin cambios de diseño sobre TRE-12: lo que pasó, la propuesta y la comparación lado a lado.
- **Ahora puede usar lo que ya existe:**
  - los recibos de CAT-03 (con sus subidas);
  - la fecha única de deuda (D-N40) y las cuotas que libera el plan mes a mes (TRE-D1);
  - la revisión del tipo (WP-20) y las promociones al 0 % (DUO-D8).
- **Pide D-N46** (la base: mediana de 12 meses o el último trimestre × 4), pendiente desde el 25/11. Sin respuesta antes del 10/12
  no llega a tiempo.

**CAT-12 · Las reglas de clasificación, en una hoja (P1 · M; es TRE-14).**
- Sin cambios sobre TRE-14.
- **Una precisión:** la hoja vive en Movimientos y CAT-02 la encuentra («reglas», «clasificar automáticamente»).
- **Por qué ahora:** es lo que hace que el cierre de diciembre tarde menos que el de noviembre. La línea base del cierre es de unos
  45 minutos (octubre).

**CAT-13 · El nombre limpio del comercio (P2 · S-M; es TRE-18).**
- La normalización ya existe en Clasificar; solo se usa para agrupar. Pasa a ser lo que se ve en la lista, con el concepto original
  en la ficha.
- Es el cambio que más acelera leer Movimientos.

### Bloque E · Calidad que no se ve (y evita sustos)

**CAT-14 · Auditoría del patrón «enganchar al pintar» (P1 · S).**
- **Buscar:** cada `attach*` o `addEventListener` dentro de una función `render*` sin otra llamada al cargar.
- **Arreglar** como en DUO-D3: enganchar al cargar el script, una sola vez.
- **Una prueba estática** lista las funciones `attach*` de los ficheros de pantalla y comprueba que cada una se llama al cargar
  (o tiene una excepción escrita con su porqué).
- Hecho cuando: la lista está vacía o justificada.

**CAT-15 · Medir la experiencia, no solo la función (P1 · S-M).** Tres pruebas transversales nuevas, del tipo de TRE-07 y TRE-10:
- **Altura del título** en las 52 pantallas (criterio de CAT-05).
- **Toques hasta apuntar un gasto** desde Hoy (CAT-07).
- **Objetivos táctiles:** ningún botón, enlace o pestaña visible por debajo de 44 px de alto a 390, salvo los enlaces dentro de un
  párrafo (WCAG 2.5.8 los exime). Hoy: 18 en Hoy, 16 en Inversión › Cartera.

**CAT-16 · Carga diferida de lo antiguo (P2 · M).**
- Las 46 pantallas sin rediseñar viven en el HTML desde el arranque. Las 10 de «Versiones anteriores» pasan a cargarse al abrirlas,
  como ya hacen los fragmentos de `VIEW_CHUNKS`.
- **Objetivo:** bajar de 8.579 a menos de 5.000 nodos en Hoy, y medir el arranque en el iPhone del hogar (H-26) antes y después.
- **Riesgo:** pruebas que buscan elementos de esas pantallas sin abrirlas. Se ven en el CI.

**CAT-17 · La versión de `app.js` (P2 · S).**
- Las ~20 pruebas que fijan `20261125dn40` pasan a comprobar el formato (`\d{8}[a-z0-9]+`) y que la versión cambia cuando cambia
  el fichero (con su huella en `tools/build-public-site.mjs`).
- **Así deja de haber PR que cambian `app.js` sin cambiar su versión.** No relaja nada: hoy la prueba exige una versión concreta,
  que es justo lo que impide actualizarla.

---

## 4. El backlog anterior: qué hacer con cada cosa

Cruce con `PROJECT_STATE.md`, `docs/historial/` y el código, el 26/11.

| Estado | Ids | Qué hacer |
|---|---|---|
| **Hecho con otro nombre** (no repetir) | TRE-15 → DAT-07; TRE-19 → WP-32 (`.ics`); TRE-17 (el motor) → A16-3 + P8; TRE-09 (el punto de estado) → R1 parte 1 (#691) | Retirar de la lista; CAT-03 hace la parte de TRE-17 que falta |
| **Absorbido aquí** | TRE-09 (lo que queda) → CAT-08; TRE-12 → CAT-11; TRE-14 → CAT-12; TRE-18 → CAT-13; TRE-21 y TRE-22 → CAT-09; R1 parte 2 → CAT-05; R2 → CAT-06 | Con su CAT |
| **Abiertos, siguen valiendo (P1)** | INV-02 (¿invertir o amortizar? Ya lo contesta en parte la escalera del próximo euro, ahora en Deuda › Plan; falta el neto de impuestos frente a la TAE); INV-06 (en CAT-09.3); PRV-03 y PRV-06 (con CAT-11); DEC-25; DEC-42 (con CAT-16); DUO-06, DUO-07, UND-10, UND-25 | Tras el bloque B |
| **Abiertos (P2)** | TRE-13 (vuestro 2026, enero); TRE-16 (etiquetas); TRE-20 (elegir varios); DAT-04, DAT-06/DEC-02, INV-03, INV-04, PRV-07, PRV-08, DEC-04 (con la serie de WP-46, que ya existe), DEC-32, DEC-43, UND-09, UND-18, DUO-08 | Enero en adelante |
| **Bloqueados** | DAT-01, DAT-02, DAT-03, CLA-05, UND-21 | Siguen esperando lo suyo |
| **Descartados** (sin cambios) | PRV-04, INV-05, INV-07, PRV-09 | No se hacen mientras no cambie el motivo |

---

## 5. Orden recomendado (seis semanas)

| Semana | Qué | Por qué en ese orden |
|---|---|---|
| 26/11 – 2/12 | #691 (R1 parte 1); **CAT-14**; **CAT-08**; **CAT-01** | Lo pequeño que evita sustos y lo que más se ve |
| 3/12 – 9/12 | **CAT-05** (R1 parte 2) y **CAT-15** (sus medidas) | Una sola cabecera antes de rehacer más pantallas |
| 10/12 – 16/12 | **CAT-11** (Plan 2027, si D-N46 está decidida) y la revisión del 14/12 (D-N38, D-N45, D-N52) | Fecha fija |
| 17/12 – 23/12 | **CAT-03** y **CAT-12** | Lo que acorta el cierre de diciembre |
| 2/1 – 13/1 | **CAT-06** (R2) con **CAT-07** (el «+») y **CAT-02** | La navegación nueva, de una vez |
| 14/1 en adelante | CAT-09 (pantallas gigantes), CAT-10, CAT-13, CAT-16, CAT-17; TRE-13 | Lo demás, ya con la casa en orden |

**Lo que no haría:** ninguna función nueva fuera de CAT-11, CAT-12 y CAT-13 hasta el 14/1. Ninguna auditoría nueva antes de la
revisión del 14/12, y esa con datos de uso del medidor, no con hipótesis.

---

## 6. Decisiones que pide

- **D-N51:** la tira de cinco cifras fuera de todas las pantallas del tema v2 (CAT-05). Recomendación: **sí**.
- **D-N52:** sacar del menú `#data-entry`, `#update-data` y `#herramientas-datos` cuando el «+» esté publicado (CAT-07).
  Recomendación: **sí**, con la revisión del 14/12 como red.
- **D-N53:** ninguna función nueva, salvo Plan 2027, reglas y nombre limpio, hasta el 14/1, ni ninguna auditoría nueva antes de la
  revisión del 14/12 (§5). Recomendación: **sí**.
- **Siguen pendientes:** D-N41, D-N43, D-N45, **D-N46 (urgente por el 31/12)**, D-N47, DUO-05 rehecha, DUO-02 y UND-21.

**Siguiente número libre: D-N54.**
