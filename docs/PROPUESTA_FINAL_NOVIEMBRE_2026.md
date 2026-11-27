# Propuesta final de noviembre · Cerrar la versión 1.0 de Finanzas Casa

**Fecha:** 26 de noviembre de 2026. **Pedido por el hogar el mismo día:** «Genera un nuevo documento que sea Propuesta final noviembre
con todo lo que esté pendiente de hacer. Haz un roadmap de integración de todo lo que podamos hacer con todos los backlogs que hemos
hecho desde el principio. Este documento será el que tengamos de arranque para cerrar versión de la app».

**Qué es:** el documento de arranque para cerrar la versión. Recorre la cadena entera de backlogs y auditorías y da a cada cosa
pendiente un sitio: dentro de la 1.0 (con su fase), después de la 1.0 (con el disparador que la activa), bloqueada por un tercero o
descartada con su motivo.

**Fuentes recorridas:**
- **La cadena de backlogs:** `BACKLOG_STATUS` (E1-E20) → `BACKLOG.md` → `BACKLOG_ULTIMATE_SEPTIEMBRE` (oleadas 1-4) →
  `BACKLOG_CONTABILIDADCASA_2_0` y `3_0` → `BACKLOG_UX_OLAS` → `BACKLOG_INICIO_OLEADA_OCTUBRE` → `BACKLOG_DEFINITIVO` (53 paquetes
  WP) → `BACKLOG_NOVIEMBRE_OLEADA_1`. Cada uno absorbió al anterior, así que lo abierto de los primeros vive ya en los últimos; la
  prueba está en `BACKLOG_NOVIEMBRE_OLEADA_1.md` §6.
- **Las auditorías:** de la quinta a la decimocuarta (`docs/PROPUESTA_*`), la auditoría de diseño del 25/11
  (`docs/rediseno/AUDITORIA_DISENO_2026-11-25.md`) y `docs/rediseno/ESTADO.md`.
- **El estado real:** contrastado con `PROJECT_STATE.md` (hasta la 549) y con el código el 26/11.

**Reglas de lectura:**
- **Lo decidido por el hogar** se marca como «decidido»; **lo propuesto por Claude**, como «propuesta» o «recomendación».
- **Las decisiones nuevas** siguen la numeración D-N (siguiente libre tras la decimocuarta: **D-N54**; tras el §10 del 27/11, D-N56; tras D-N56 (CON-05 a CON-08 y DS), **D-N57**).
- **El repositorio es público:** ninguna cifra real del hogar aquí.

---

## 0. En una página

1. **La app está construida; lo que falta es cerrarla.** Desde agosto se han fusionado cerca de 690 PR. Solo en noviembre hubo 121
   novedades, y el núcleo de la oleada de noviembre (§5.1 de su backlog, 25 filas) está hecho entero.
2. **El trabajo restante tiene una forma clara:**
   - **una sola app:** terminar el rediseño (R1 parte 2, R2 y las 4 pantallas sin rediseñar) y retirar el tema clásico;
   - **menos superficie:** las pantallas gigantes y las «versiones anteriores» fuera del menú;
   - **que se encuentre lo que hay;**
   - **tres funciones con fecha:** Plan 2027, campaña fiscal y Renta;
   - **la prueba con datos reales:** tres cierres seguidos y cinco personas ajenas.
3. **Propuesta de versión 1.0:** congelar funciones el **14/1/2027** y publicar la 1.0 el **1/3/2027**, tras firmar enero y febrero
   con la app y con los diez criterios de salida de §2 en verde. A partir de ahí, solo correcciones y lo que active un disparador
   de §6.
4. **Lo que más riesgo tiene no es técnico:** son las decisiones del hogar sin contestar (13, en §5) y los datos que solo el hogar
   puede meter (§5.2). Con el ritmo de las últimas semanas, el cuello de botella son las respuestas, no la construcción.

---

## 1. Dónde estamos (26/11/2026)

**Publicado:**
- **El rediseño (tema v2), por defecto desde el 19/10.** Pantallas con el diseño nuevo:
  - Hoy, Movimientos, Importar, Clasificar, Repaso semanal;
  - Plan (Mes y Previsión) y Cierre;
  - Deuda completa (Plan, Ajustar, Comparar, Contratos y Ofertas; los cinco PR de la auditoría de diseño).
- **El motor:**
  - previsión diaria y mensual con una sola cifra (FX-01) y una sola fecha de «libre de deuda» (D-N40);
  - escenarios y pruebas de estrés sobre la previsión;
  - plan óptimo de deuda con seguimiento;
  - cierre de mes con firma (octubre firmado el 4/11);
  - Renta de inversión y local (WP-21) y campaña fiscal (WP-23);
  - privacidad (repositorio público sin cifras del hogar).
- **R1, primera parte:** en #691, a punto de publicarse.

**Medido el 26/11** (demo, 53 rutas del menú; detalle en `docs/PROPUESTA_DECIMOCUARTA_AUDITORIA_2026-11-26.md` §1):

| Indicador | Valor |
|---|---|
| Pantallas en el menú | 53 rutas, 268 enlaces |
| Con el diseño nuevo completo | 6 de 52 |
| Título a < 100 px del borde en el iPhone | 0 de 52 (mediana 358 px) |
| Pantallas de más de 2.000 px a 390 | 26 (13 de más de 5.000) |
| Carga | 252 scripts, 34 hojas de estilo, 8.579 nodos en Hoy |
| `app.js` | 32.092 líneas (techo 32.155) |
| Pruebas | 7.026 unitarias; ~595 e2e/a11y/perf; Safari bloqueante en el CI |

**Decidido por el hogar y vigente** (resumen; detalle en `CLAUDE.md` y `ESTADO.md` §3):
- publicación autónoma con CI en verde;
- `contabilidadcasa` como único repositorio vivo;
- ninguna acción financiera real sin confirmación (A11-4);
- v2 por defecto con `?tema=clasico` hasta graduar;
- D-N40 (una sola fecha de deuda);
- D-N44 (Ofertas solo con ofertas);
- D-N49 (sin la tira en pantallas con cifra protagonista);
- D-N50 (5 destinos y barra inferior, después de Deuda);
- «no hay límites» de paquetes en curso (26/10).

---

## 2. Qué es «versión cerrada» (definición de la 1.0)

**Propuesta.** La 1.0 está cerrada cuando se cumplen los diez criterios a la vez. Cada uno se mide con algo que ya existe o que
esta propuesta añade (entre paréntesis).

| # | Criterio | Cómo se mide |
|---|---|---|
| C1 | **Una sola app:** todas las pantallas del menú con el diseño nuevo y el tema clásico retirado | Inventario de rutas; `?tema=clasico` redirige |
| C2 | **Cabecera única:** título a < 120 px a 390 y < 100 px a 1440 en todas | CAT-05/CAT-15 en el CI |
| C3 | **Nada gigante:** ninguna pantalla por defecto de más de 3.000 px a 390, salvo listas que crecen con los datos | CAT-09 en el CI |
| C4 | **Navegación de 5 destinos** y barra inferior en el móvil; menú cerrado de ≤ 900 px en el escritorio | R2 (CAT-06), e2e `@safari` |
| C5 | **Apuntar un gasto en ≤ 4 toques** desde Hoy | CAT-07, e2e |
| C6 | **Tres cierres seguidos firmados con la app** (diciembre, enero y febrero), con saldos del día | Cierre y medidor |
| C7 | **Coste del cierre por debajo de la línea base** de octubre (≈ 45 min) | Medidor (4/11) |
| C8 | **Clasificación ≥ 95 %** del gasto con partida al firmar | Cierre |
| C9 | **Prueba con 5 personas ajenas** (WP-54) hecha, y sus hallazgos P0 corregidos | Informe de WP-54 |
| C10 | **Calidad transversal en verde:** coherencia de cifras (FX-01), sin texto de ingeniero (TRE-10), XGO-01, desbordamiento, axe, Safari, presupuesto de carga, objetivos táctiles de 44 px (CAT-15) y oyentes al cargar (CAT-14) | CI |

**Fuera de la 1.0, a propósito:**
- todo lo que depende de un tercero (PSD2, buzón con servidor, IA en producción);
- lo que necesita más historia de la que hay (calibración con 3+ cierres, probabilidades);
- el catálogo P3.

Van a §6 con su disparador.

---

## 3. Todo lo pendiente, con su destino

Leyenda del destino: **F0-F4**, fases de §4 (dentro de la 1.0); **Post**, después de la 1.0 (§6); **Bloq**, bloqueado por un tercero;
**Desc**, descartado con motivo.

### 3.1 Del backlog vivo (`BACKLOG_NOVIEMBRE_OLEADA_1.md`)

| ID | Qué | Estado | Destino |
|---|---|---|---|
| §5.1 (25 filas, FX-01 a FX-43) | Núcleo de noviembre: previsión C2, escenarios, estrés, puente, carta | **Hecho** | — |
| FX-21 (resto) | Las otras 4 pruebas de estrés | Espera a que el hogar las elija | F2 si se eligen antes del 2/1; si no, Post |
| FX-60 / XUX-01 | Navegación por cinco preguntas | Sin hacer (es R2, D-N50 decidida) | **F2** (CAT-06) |
| RD-D1 / RD-D2 | Patrimonio e Inversión con el diseño nuevo | Sin hacer | **F2** (Inversión es TRE-22) |
| WP-34 / PRV-08 | Revisión base cero del plan | De enero | **F2**, junto con el Plan 2027 |
| WP-21 PR-3 (datos) | El local en la Renta con los datos del hogar | Código hecho; espera H-36 | **F3** (antes del 31/3) |
| WP-54 | Prueba con 5 personas ajenas | Sin hacer; H-13 propone las personas | **F3** |
| H8, H10 | A5-1/A5-4 activar o archivar; excepción XGO-01 de Cierre | 30/11 y 4/12 | **F0** |
| FX-25, FX-26, FX-32 a FX-35, FX-52, FX-53, FX-63 | P2 con disparador de datos (3-6 cierres) | Esperan historia | **Post** (§6) |
| WP-42 (resto), RD-D4 / RD-E2, XDA-03 n2, DAC-05 | P2 | Taller y Laboratorio, pdf.js, cuota cobrada | **Post**; DAC-05 a **F3** si hay extractos (ya los hay) |
| P3 (27 + FX-24, FX-64, XIN-07, XUX-02, XDA-01 PR-2) | Catálogo con disparador | Sin cambio | **Post** |
| P4 (ND-12, NDB-05, DNU-01, DNU-02, HOG-04) | Bloqueadas | HOG-04 hecho como UND-17 | **Bloq** (HOG-04 cerrado) |
| Archivo (NXP-07, NHG-02, CAP-08, NHG-03) | — | — | **Desc** |
| SVD (bloque del 17/11) | Simulador visual conectado | SVD-0 a SVD-4 publicados | Lo que quede, a **F3** con CAT-09.1 |

### 3.2 Del plan de 53 paquetes (`docs/PLAN_DESARROLLO_DEFINITIVO.md`)

La mayoría están hechos o esperan un dato del hogar (`BACKLOG_NOVIEMBRE_OLEADA_1.md` §6). Los que siguen abiertos y entran en la 1.0:
- **WP-05:** el spike de PSD2 y la revisión de seguridad. La revisión de seguridad va a **F3**; PSD2, **Bloq** por O-6.
- **WP-34:** base cero, **F2**.
- **WP-52:** WebKit en la medición de carga. Hecho en el CI; falta H-26, los tiempos en el iPhone, en **F1**.
- **WP-54:** **F3**.

El resto de paquetes «esperando al hogar» quedan con su tarea en §5.2.

### 3.3 De las auditorías de la novena a la decimotercera (abiertas)

Cruce de la decimotercera (§7.4), actualizado con la decimocuarta.

| Grupo | Ids | Destino |
|---|---|---|
| **Hechos con otro nombre** | TRE-15 → DAT-07; TRE-19 → WP-32; el motor de TRE-17 → A16-3 + P8; el punto de estado de TRE-09 → R1 parte 1; HOG-04 → UND-17; UND-14 → DUO-D1; UND-16 → DUO-D2; DEC-19 → TRE-09 | Cerrados |
| **Pantallas** | TRE-09 (resto) → CAT-08; TRE-21 (Ajustes con índice); TRE-22 (Inversión con una pregunta); UND-05 / INV-01 | **F1** (CAT-08) y **F2** (resto) |
| **Funciones con fecha** | TRE-12 (Plan 2027; D-N46); TRE-14 (reglas) | **F1** |
| **Funciones de uso** | TRE-18 (comercio limpio); TRE-20 (elegir varios); TRE-16 (etiquetas); TRE-02 (la búsqueda que contesta) | **F2** (18, 20, 02) y **F3** (16) |
| **Informes** | TRE-13 (vuestro 2026, tras firmar diciembre); TRE-01 | **F2** (enero) |
| **P1 abiertos** | INV-02, INV-06, PRV-03, PRV-06, DEC-25, DEC-42, DUO-06, DUO-07, UND-10, UND-25 | INV-06 y PRV-06 con su pantalla en **F2**; DEC-42 con CAT-16 en **F3**; el resto en **F3** |
| **P2 abiertos** | DAT-04, DAT-06 / DEC-02, INV-03, INV-04, PRV-07, PRV-08, DEC-04, DEC-32, DEC-43, UND-09, UND-18, DUO-08 | INV-03 con TRE-22 (**F2**); DEC-04 sobre WP-46 (**F3**); el resto **Post** |
| **Bloqueados** | DAT-01, DAT-02 (PSD2), DAT-03 (servidor), CLA-05 (A5-1), UND-21 (D-N11) | **Bloq** |
| **Descartados** | PRV-04, INV-05, INV-07, PRV-09 (precisión falsa con 13 meses o sin datos de clase de activo) | **Desc** |
| **Séptima auditoría sin adoptar** | XDA-06…09, XIN-01/03/05/06/08, XDO-01/03…06, XDN-*, XUX-04/06, XNF-01/02/04/05/06 | **Post** (catálogo) |

### 3.4 De la auditoría de diseño (25/11) y de la decimocuarta (26/11)

| ID | Qué | Destino |
|---|---|---|
| R1 parte 1 | Punto de estado, «Guía», tira fuera de Cierre, Contratos y Ofertas | **F0** (#691) |
| CAT-05 (R1 parte 2) | Cabecera única con su criterio medido | **F1** |
| CAT-06 (R2) | 5 destinos, barra inferior con «+» | **F2** |
| CAT-07 | Un solo «+» para meter datos | **F2** |
| CAT-08 | Hoy, primera pantalla del iPhone | **F0** |
| CAT-01 / CAT-02 | Inventario de capacidades y «Buscar o hacer» | **CAT-01 hecho** (27/11: `docs/gobierno/capacidades.json`, 97 capacidades, y su guardia en el CI); **F2** (02) |
| CAT-03 | Recibos y suscripciones en Movimientos | **F1** |
| CAT-04 | «Apuntar gasto» desde el inicio del teléfono | **F2** |
| CAT-09 / CAT-10 | Pantallas gigantes y Partidas | **F2** (Inversión, Ajustes, Partidas) y **F3** (Apalancamiento, simulador) |
| CAT-11 / 12 / 13 | Plan 2027, reglas, comercio limpio | **F1** (11, 12) y **F2** (13) |
| CAT-14 / CAT-15 | Oyentes al cargar; medir la experiencia | **F0** (14) y **F1** (15) |
| CAT-16 / CAT-17 | Carga diferida de lo antiguo; versión de `app.js` | **F3** (16); **CAT-17 hecho** (27/11: huella de `app.js` en `docs/gobierno/huella-app.json` y su guardia) |
| Pantallas sin rediseñar | Patrimonio, Inversión, Decidir (Escenarios), Ajustes | **F2** |
| Graduar y retirar el tema clásico | Pantalla a pantalla, con confirmación del hogar (P9) | **F3** |
| Versiones anteriores (10 rutas) | Fuera del menú (D-N45) tras la revisión del 14/12 | **F1** |

### 3.5 Lo que venía de antes y sigue «sin cambio» (de `BACKLOG_UX_OLAS` y `3_0`)

| Qué | Destino |
|---|---|
| O-6 (PSD2), OPT-10 a OPT-13 (reloj de uso real), A5-1/A5-4 (IA, H8) | **Bloq** o decisión H8 en **F0** |
| ARQ-4 (techo de `app.js`) | Se mantiene; CAT-16 lo alivia en **F3** |
| I3, I6, Cola B, UX-P1…P7 | Absorbidas por el rediseño (F1-F2) o sin uso medido: **Post**, con el medidor como disparador |

---

## 4. Hoja de ruta de integración (cinco fases)

Cada fase tiene un objetivo, sus paquetes en orden, lo que necesita del hogar y su criterio de salida. **No se abre una fase con la
anterior en rojo**, salvo lo que espere un dato del hogar.

### F0 · Estabilizar y cerrar noviembre (26/11 – 6/12)

**Objetivo:** que el cierre de noviembre salga con la app tal como está, sin sustos.

| Orden | Paquete | Por qué ahora |
|---|---|---|
| 1 | Publicar #691 (R1 parte 1) | Hecho y validado; su CI está en marcha |
| 2 | **CAT-14:** oyentes enganchados al pintar (patrón DUO-D3) | El mismo fallo puede estar en otras pantallas y aparecer en el cierre |
| 3 | **CAT-08:** Hoy en la primera pantalla del iPhone | La pantalla más vista; es pequeño |
| 4 | **CAT-01:** inventario de capacidades | Evita volver a proponer lo que ya existe. **Hecho el 27/11** (PROJECT_STATE 556) |
| 5 | Arreglos de lo que salga del cierre de noviembre | Lo que mande el uso real |
| 6 | **CIE-01 · Cerrar agosto y septiembre** (petición del hogar, 26/11: «cerrar el mes de agosto, que sigue abierto») | Ver abajo |

**Hecho fuera de plan el 26/11, por urgencia (el hogar decide al día siguiente):** «Comparar con otra oferta» en Deuda › Préstamo para
saldar (#692): dos ofertas sobre las mismas deudas, con seguros o vinculaciones, el impacto de cada una frente a no pedir nada y quién
gana cada criterio.

**CIE-01 · Cerrar agosto y septiembre (P0 · M).** Hoy no se puede hacer bien. Cierre solo deja elegir el mes en curso o el anterior
(`closeTarget`, `canonical-month-close-balances.js`), y al firmar guarda **los saldos de hoy** como saldos de cierre. Lo que hace falta:
- **Elegir mes:** Cierre deja elegir cualquier mes pasado sin firmar («Meses sin firmar: agosto, septiembre»), el más antiguo primero.
- **Saldos del mes:** el saldo de cierre de un mes pasado es el último saldo del extracto de ese mes por cuenta (el de su último
  movimiento con saldo), no el de hoy. Sin extracto que llegue a fin de mes, se dice y se pide el saldo a mano.
- **Orden:** agosto antes que septiembre. Firmar un mes anterior a otro ya firmado (octubre) no lo reabre; el cuadre «saldo anterior +
  movimientos = saldo de cierre» se comprueba con el siguiente.
- **Carta y backtest** de ese mes, como cualquier cierre.
- **Pruebas:** e2e de un mes atrasado con saldos del extracto, y que octubre siga firmado.
- **Del hogar después:** firmar agosto y septiembre (H11 decía «sin firmar»; el 26/11 el hogar pide cerrarlos).

- **Del hogar:**
  - **H-06 / H-11**, cierre de noviembre con saldos del día (1-3/12);
  - **H8** (30/11);
  - **H10** (4/12);
  - **H-37**, clasificar lo pendiente;
  - **D-N46**, la base del Plan 2027.
- **Salida:** noviembre firmado y medido (coste del cierre y % clasificado); revisión de salida de la oleada de noviembre el 4/12
  (`BACKLOG_NOVIEMBRE_OLEADA_1.md` §8).

### F1 · Una cabecera, menos menú y lo que vence en diciembre (7/12 – 23/12)

**Objetivo:** que la app parezca una sola en la parte de arriba y que lo que tiene fecha del 31/12 llegue.

| Orden | Paquete | Nota |
|---|---|---|
| 1 | **CAT-05:** R1 parte 2 (cabecera única) + **CAT-15** (sus medidas en el CI) | Criterio C2 |
| 2 | **CAT-11 / TRE-12:** Plan 2027 desde lo real de 2026 | D-N46 decidida el 27/11 (C); se adelanta, en cuanto #694 despliegue |
| 3 | **WP-23:** acciones de la campaña fiscal antes del 31/12 (H-14) | Dinero en juego con fecha fija |
| 4 | **Revisión trimestral del 14/12** (D-N38): graduar o retirar; **D-N45** (Versiones anteriores fuera del menú), **D-N52** y **D-N53** | Con datos del medidor, no con hipótesis |
| 5 | **CAT-03:** recibos y suscripciones (reaprovecha A16-3 + P8), **con CON-05**, la ficha del comercio o recibo (D-N56) | Alimenta el Plan 2027 |
| 6 | **CAT-12 / TRE-14:** reglas de clasificación | Acorta el cierre de diciembre |
| 7 | **CAT-17:** la versión de `app.js` | Pequeño; quita un riesgo de caché. **Hecho el 27/11** (PROJECT_STATE 556) |
| 8 | **CON-04:** decisiones y tareas del hogar en «Decidir esta semana» (D-N55) | Pequeño; acorta lo que tardan las decisiones |
| 9 | **CON-01:** mapa de meses y extractos en Cierre (D-N55) | Para el cierre de diciembre |
| 10 | **DS-0 y DS-1:** tokens de escala y guardia de diseño en el CI (D-N56) | Con CAT-05; pequeño |

- **Del hogar:** H-26 (tres tiempos de carga en el iPhone), H-12 (política de inversión y plan B, 18/12) y H-13 (5 personas para
  WP-54, antes del 15/12).
- **Salida:**
  - C2 en verde en las pantallas rediseñadas;
  - Plan 2027 aceptado o descartado;
  - campaña fiscal ejecutada;
  - menú sin «Versiones anteriores».

### F2 · La navegación nueva y las cuatro pantallas que faltan (2/1 – 14/1, congelación de funciones)

**Objetivo:** que toda la app sea la nueva. Es la fase más grande; se puede alargar una semana sin tocar la fecha de la 1.0.

| Orden | Paquete | Nota |
|---|---|---|
| 1 | **CAT-06 / R2 / FX-60:** 5 destinos y barra inferior con «+» | D-N50 decidida; criterio C4 |
| 2 | **CAT-07:** el «+» para meter datos | Criterio C5; D-N52 |
| 3 | **CAT-02 / TRE-02:** «Buscar o hacer» que encuentra acciones | Sobre CAT-01 |
| 3b | **CON-06:** una sola cola de avisos (D-N56); CON-04 pasa a ser una fuente más | Motor primero, en un PR sin pantalla |
| 3c | **CON-07:** el primer plan con tres extractos (D-N56) | Antes de WP-54 |
| 3d | **DS-2 a DS-4:** tipografía, espaciado, radios y componentes únicos, con cada pantalla (D-N56) | — |
| 4 | **Inversión (TRE-22 / RD-D2 / UND-05)** con INV-03 e INV-06 | Con el componente de fichas de TRE-23 |
| 5 | **Patrimonio (RD-D1)** con la serie de WP-46 | `Patrimonio.png` |
| 6 | **Decidir (Escenarios)** con el diseño nuevo | Escenarios, Asesor y Segunda opinión en una pantalla con su pregunta |
| 7 | **Ajustes (TRE-21)** con índice fijo en el escritorio; CAT-09 en lo que quede | Criterio C3 |
| 8 | **CAT-10:** Partidas | La pantalla con más texto |
| 9 | **CAT-13 / TRE-18:** comercio limpio; **TRE-20:** elegir varios | Uso diario de Movimientos |
| 10 | **TRE-13:** vuestro 2026 en una página (tras firmar diciembre) | El informe del año |
| 11 | **WP-34:** base cero con el Plan 2027 | Enero |

- **Del hogar:** **H-15**, cierre de diciembre (1-3/1), y la revisión base cero (H-17).
- **Salida:**
  - C1 sin el tema clásico todavía (todas las pantallas con el diseño nuevo);
  - C2, C3, C4 y C5 en verde;
  - **congelación de funciones el 14/1:** desde aquí solo correcciones, pruebas y retirar.

### F3 · Probar con gente y con datos, y retirar lo viejo (15/1 – 21/2)

**Objetivo:** que lo que hay funcione con datos reales y con gente que no la ha construido, y quitar lo que sobra.

| Orden | Paquete | Nota |
|---|---|---|
| 1 | **WP-54:** prueba con 5 personas ajenas, con las tareas de la 1.0 (apuntar, importar, cerrar, decidir) | Criterio C9; sus P0 se corrigen en esta fase |
| 2 | **Graduar y retirar el tema clásico**, pantalla a pantalla (P9) | Criterio C1; retirar es un PR aparte y se consulta |
| 3 | **CAT-16:** carga diferida de lo antiguo; **DEC-42:** Hoy primero | Medir en el iPhone antes y después (H-26) |
| 4 | **CAT-09** (Apalancamiento y simulador visual, el resto de SVD) | Criterio C3 en todas |
| 5 | **Revisión de seguridad** (WP-05, la parte sin PSD2) y de privacidad | Antes de publicar una versión |
| 6 | **WP-21 PR-3** con los datos del local (H-36) y la Renta | Antes del 31/3 |
| 7 | P1 pendientes de auditorías: DUO-06, DUO-07, UND-10, UND-25, DEC-25, INV-02, DEC-04, TRE-16, DAC-05 | Solo los que no amplíen superficie (XGO-01) |

- **Del hogar:**
  - **H-18**, cierre de enero;
  - las 5 personas de WP-54;
  - H-36 (datos del local, antes del 31/1);
  - confirmar cada graduación.
- **Salida:** C1 completo (sin tema clásico), C9 y C10 en verde.

### F4 · Cierre de versión (22/2 – 1/3/2027)

- **H-19:** cierre de febrero, el tercer cierre seguido (C6).
- **Comprobar los diez criterios** de §2 y escribir `docs/VERSION_1_0.md`:
  - qué hace la app;
  - los criterios y su medida;
  - lo que queda fuera y su disparador;
  - el manual (`MANUAL_USUARIO.md` puesto al día).
- **Etiqueta `v1.0`** en el repositorio y **Novedades** con una sola línea de versión.
- **Desde aquí:**
  - correcciones;
  - lo que active un disparador de §6;
  - una revisión trimestral con datos (la siguiente en mayo).

---

## 5. Lo que depende del hogar

### 5.1 Decisiones pendientes (13), por fecha

| Decisión | Qué | Recomendación | Para |
|---|---|---|---|
| **D-N46** | Base del Plan 2027 | **Decidida el 27/11: C** (abajo) y aplicarlo ya a la previsión | Hecho (decisión) |
| H8 | A5-1/A5-4: activar o archivar | Archivar hasta tener servidor | 30/11 |
| H10 | Excepción XGO-01 de Cierre | — | 4/12 |
| **D-N54** (nueva) | Adoptar este documento: la 1.0 el 1/3/2027, los criterios de §2 y la congelación del 14/1 | **Sí** | 4/12 |
| **D-N55** (27/11) | CON-01 a CON-04 | **Decidida el 27/11:** CON-01 en **F1** (no en F0: agosto y septiembre se firman con CIE-01), CON-04 en **F1**; CON-02 y CON-03 al catálogo (§6) | Hecho (decisión) |
| **D-N56** (27/11) | CON-05 a CON-08 y el plan de diseño (`docs/PROPUESTA_CON05_CON08_Y_PLAN_DISENO_2026-11-27.md` §4) | **Decidida el 27/11, sí a todo:** CON-05 dentro de CAT-03; CON-06 y CON-07 en F2 (CON-07 antes de WP-54); CON-08 al catálogo con FX-25; DS-0 y DS-1 en F1; tipografía (b), «cuerpo compacto» 13,5 solo en tablas; regla 8 de §7 | Hecho (decisión) |
| D-N45 | Versiones anteriores fuera del menú | Sí | 14/12 |
| D-N51 | La tira de cinco cifras fuera de todo el tema v2 | Sí | 14/12 |
| D-N52 | Tres puertas de datos fuera del menú con el «+» | Sí | 14/12 |
| D-N53 | Sin funciones nuevas ni auditorías hasta las fechas de §4 | Sí. **Sigue abierta;** lo adoptado el 27/11 en D-N55 y D-N56 entra como excepción explícita del hogar (CON-01, CON-04, CON-05 dentro de CAT-03, CON-06, CON-07, DS-0/DS-1) | 14/12 |
| D-N48 | Menú del escritorio con desplazamiento propio | Lo resuelve R2 (cinco entradas); se retira | 14/12 |
| D-N41 | Las tres herramientas heredadas de Contratos (dos listas de orden y simulador de consolidación) | Retirar tras la revisión | 14/12 |
| D-N47 | Dividir solo en meses sin firmar | Sí (DAT-07 ya existe: confirmar la regla) | 14/12 |
| D-N43 | El plan por titular | No bloquea; Post | Sin fecha |
| DUO-05, DUO-02, UND-21 | Barra inferior (la absorbe R2), DUO-02 y UND-21 (D-N11) | DUO-05 se cierra con R2 | 14/12 |
| FX-21 resto | Qué otras pruebas de estrés | Elegir dos | 2/1 |

**D-N46, opción C (decidida el 27/11): cómo se calcula el Plan 2027.**
- **La base es la mediana de los últimos 12 meses** con real, por partida (el cálculo de base cero, WP-34, reutilizado).
- **Solo se aplana lo que es mensual.** Una partida cuyo importe cambia de un mes a otro (un seguro anual, las pagas extra) conserva su forma mes a mes. Una partida con real solo en pocos de los meses cubiertos no se multiplica por 12. Las que manda otra cosa (fórmula, contrato de deuda, tarjeta, asignación personal) no se tocan: sus cambios de 2027 ya vienen de su contrato.
- **Aviso por partida:** si el último trimestre se aparta de la mediana más de un **20 %** y más de **10 €** al mes, se enseñan las dos cifras y el hogar elige. Nunca se elige sola la del trimestre. **El 20 % es un parámetro, no una medida.**
- **Con poca historia no se compara:** hacen falta al menos 6 meses con real para que el trimestre sea distinto del resto. Con menos, la partida dice «poca historia» y se queda con la mediana. Hoy, con agosto-noviembre aún por clasificar (H-37), muchas partidas estarán así.
- **Inflación:** las partidas de 2027 se escriben **a precios de hoy** (la mediana). La previsión ya sube los gastos con la inflación de Ajustes › Supuestos mes a mes (`app.js`, `expenseMultiplier`); sumarla también en el plan la contaría dos veces. La pantalla enseña aparte cuánto añade esa inflación en 2027.
- **«Aplicar ya como previsión»:** lo aceptado se escribe en las partidas de 2027 del plan, que es lo que lee Previsión, tras «Qué ocurrirá» y con deshacer entero (decisión 6 de `ESTADO.md` §3). No espera a diciembre. La app no lo aplica sola: lo hace el hogar.
- **Queda fuera** lo que depende de piezas sin hacer: «los recibos que suben» (CAT-03).
- **La ventana real es corta (medido el 27/11):** la app solo tiene reales en los meses del plan, que empieza en julio de 2026. En diciembre, la «mediana de 12 meses» sale de julio a noviembre (5 meses), sin invierno, y el aviso del trimestre no puede saltar (hacen falta 6). **El hogar eligió el 27/11 la opción 3:** el Plan 2027 se hace ahora con esa mediana, con el aviso de «poca historia» en cada partida, y **se repite en marzo de 2027** con 8 meses (H-38, abajo). La opción 2, ampliar la ventana con los extractos anteriores a julio, quedó descartada.

### 5.2 Tareas del hogar con fecha (las que mueven la 1.0)

| Tarea | Qué | Fecha |
|---|---|---|
| H-37 | Clasificar lo pendiente de agosto a noviembre | Antes del 1/12 |
| CIE-01 (hogar) | Firmar agosto y septiembre cuando Cierre lo permita | F0 |
| H-06 / H-11 | Cerrar noviembre con saldos del día | 1-3/12 |
| H-13 | Proponer 5 personas para WP-54 | 15/12 |
| H-12 | Política de inversión y plan B | 18/12 |
| H-14 | Ejecutar las acciones de la campaña fiscal | Antes del 31/12 |
| H-15, H-18, H-19 | Cerrar diciembre, enero y febrero | 1-3 de cada mes |
| H-36 | Datos del local en la app | 31/1 |
| H-26 | Tres tiempos de carga en el iPhone | Antes de F3 |
| H-34 | Desplegar el buzón de extractos (opcional) | Sin fecha |
| **H-38** (27/11) | Repetir el Plan 2027 con 8 meses de historia (D-N46, opción 3): Plan › Mes, «Preparar el plan de 2027», con el aviso del trimestre ya activo | Marzo de 2027, tras firmar febrero |

---

## 6. Después de la 1.0 (catálogo con disparador)

Nada se pierde: cada cosa espera a su disparador, no a una fecha.

| Disparador | Qué se activa |
|---|---|
| **3 cierres comparables** (≈ marzo) | FX-32, FX-33 / XPR-01…03 (rango y sesgo calibrados), FX-35 (cambios de nivel con 4 meses), WP-12 en serie |
| **6 meses de ingresos** | FX-34 / XPR-10 (probabilidad de los ingresos inciertos) |
| **El primer escenario aplicado** | FX-26 (diario de decisiones) |
| **Tras FX-20 y D-N6 (febrero)** | FX-25 (un solo motor de escenarios), redirigir el laboratorio E13 |
| **El hogar lo pide** | CON-02, CON-03 (D-N55); CON-08 con FX-25 (D-N56); FX-24, FX-64, XIN-07, TRE-16 (etiquetas), PRV-07, PRV-08, DEC-32, UND-18, DUO-08; el catálogo P3 (27) |
| **El medidor dice que se usa** | XUX-02, XDA-01 PR-2, Cola B, UX-P1…P7 |
| **Una cuenta que solo da PDF** | XDA-03 nivel 2 (pdf.js) |
| **Contratar PSD2 (O-6)** | DAT-02, WP-05 (PSD2), ND-12 |
| **Un servidor** | DAT-03 (buzón por correo), A5-1/A5-4, CLA-05 |
| **Un extracto real de la tarjeta** | DAT-01 |

**Descartados (con motivo, se reabren solo si cambia):**
- **PRV-04 e INV-05:** Monte Carlo con 13 meses de historia sería precisión falsa;
- **INV-07:** no hay datos de clase de activo;
- **PRV-09:** no hay un método nuevo que comparar;
- **el archivo P4/Archivo.**

---

## 7. Reglas para cerrar la versión

Propuesta; vigentes si el hogar adopta D-N54.

1. **Uno entra, uno sale** (XGO-01), sin excepciones nuevas. Toda pantalla rehecha enseña menos titulares por defecto que la de
   siempre.
2. **Congelación de funciones el 14/1/2027.** Desde ahí, solo correcciones, pruebas, retirar y lo que pida WP-54.
3. **Ninguna auditoría nueva** hasta la revisión del 14/12; la siguiente, la trimestral de mayo, con datos del medidor.
4. **Antes de proponer una función, buscarla** en el inventario de capacidades (CAT-01) y en el código.
5. **Retirar se consulta siempre** (graduar no retira; retirar es un PR aparte), y nunca se borra un dato del hogar.
6. **Publicación como hasta ahora:**
   - validar;
   - PROJECT_STATE;
   - PR en borrador;
   - CI en verde (Safari incluido);
   - squash;
   - despliegue;
   - disponibilidad.

   Nunca en rojo ni relajando pruebas.
7. **Cada fase cerrada** actualiza este documento (§3 y §4), `ESTADO.md` §2 y `PROJECT_STATE.md`.
8. **Cuatro propuestas como máximo por conversación** (D-N56 g, 27/11): cada una sustituye algo o tiene fecha. Lo que se pida de más va a «mejoras de diseño», que no añaden superficie. Aunque un prompt de arranque pida 6-10 funciones, manda esta regla.

---

## 8. Riesgos

| Riesgo | Probabilidad | Efecto | Mitigación |
|---|---|---|---|
| Decisiones sin contestar (13 abiertas) | Alta | Fases que esperan; D-N46 deja el Plan 2027 fuera del 31/12 | Hoja de decisiones con fecha en cada fase; recomendación por defecto si no hay respuesta en 7 días (a decidir en D-N54) |
| Datos que no llegan (cierres sin extractos) | Media | C6, C7 y C8 no se pueden medir; la 1.0 se retrasa un mes | El cierre de cada mes es la prioridad del hogar en su semana |
| R2 más grande de lo previsto | Media | F2 se alarga | F2 tiene una semana de holgura; si no basta, Patrimonio o Decidir pasan a F3 |
| Fallos que solo ve Safari | Media | CI en rojo de 1-2 h por PR (DUO-D3, el 26/11) | CAT-14 y la prueba estática de oyentes; WebKit no se puede instalar en el contenedor |
| Seguir proponiendo funciones | Alta (14 auditorías en 6 semanas) | La 1.0 no se cierra nunca | D-N53 y la regla 2 de §7 |
| Retirar el tema clásico rompe un uso que no se medía | Baja | Pérdida de una función | Graduación pantalla a pantalla con dos semanas de aviso (P9) |

---

## 9. Seguimiento

- **Este documento es el arranque** de cada sesión hasta la 1.0, junto con `PROJECT_STATE.md` y `docs/rediseno/ESTADO.md`.
- **Fases en el panel:** el panel de seguimiento (`docs/plan/panel-seguimiento.html`, privado) gana las fases F0-F4 como pista.
- **El detalle de cada ID** sigue en su documento de origen:
  - **FX y XPR:** octava y séptima auditorías;
  - **WP:** plan definitivo;
  - **NIN, DEC, UND, DUO y TRE:** de la novena a la decimotercera;
  - **CAT:** la decimocuarta;
  - **R1 y R2:** la auditoría de diseño.

  Aquí solo vive el destino.

---

## 10. Propuestas del 27/11: cuatro funciones que juntan lo que ya existe (CON-01 a CON-04, sin adoptar)

Pedido por el hogar el 27/11 («propón 4 grandes nuevas funcionalidades […] enfocadas en uso y experiencia de usuario y
optimizando lo ya desarrollado»). **Choca con la decimocuarta auditoría y con D-N53** (ninguna función nueva hasta el 14/1 salvo
Plan 2027, reglas y nombre limpio; riesgo «seguir proponiendo funciones», §8). Por eso ninguna de las cuatro añade superficie: cada
una **junta piezas que ya existen** en un solo sitio y dice qué retira (regla 1 de §7, «uno entra, uno sale»). Buscadas antes en el
código (regla 4). Son propuesta: no entran en ninguna fase hasta que el hogar las adopte (**D-N55**).

### CON-01 · Mapa de meses y extractos, en Cierre (P0 · M) — recomendada para F0, detrás de CIE-01

- **Problema.** CIE-01 deja cerrar agosto y septiembre, pero el hogar no ve, antes de intentarlo, **qué extracto falta en qué
  cuenta y en qué mes**: lo descubre al elegir el mes («sin saldo en el extracto»). La información existe repartida: la cobertura de
  90 días de Importar (XDA-04 PR-2), los meses sin firmar de CIE-01 (`closeTarget().pending`), el cuadre de saldos de Cierre y los
  meses firmados.
- **Qué es.** Una tabla **cuentas × meses** (los 6 últimos en el móvil, 12 en el escritorio) en la cabecera de Cierre. Cada casilla,
  un estado con palabra y color (WCAG 1.4.1): *Sin extracto* · *Parcial (hasta el 14)* · *Cuadra* · *Firmado*. Una sola acción por
  casilla, la siguiente que toca: «Importar el extracto de ago 26» (abre Importar con la cuenta y el mes elegidos), «Revisar
  descuadre», «Firmar ago 26» (abre Cierre con ese mes, la ruta de CIE-01).
- **UX.** Patrón *calendar heatmap* de los gestores de conciliación (el «mes por cuenta» de los programas contables). En el móvil,
  la tabla se desplaza solo en horizontal dentro de su caja (cumple `test:mobile-overflow`), con la columna de la cuenta fija. Sin
  datos, una línea plegada (decisión 4 de `ESTADO.md` §3), nunca una tabla vacía.
- **Retira.** La línea «Sin firmar de antes: Cerrar ago 26 · Cerrar sept 26…» de CIE-01 y la línea de cobertura bajo el cuadre de
  Importar: el saldo de XGO-01 queda en cero o negativo.
- **Medida.** Meses atrasados firmados y extractos importados en la semana siguiente a publicarlo; tiempo desde abrir Cierre hasta
  la primera acción.
- **Pruebas.** Unitaria del estado por casilla (los cuatro estados y el mes sin movimientos); e2e a 1280 y 390 px `@safari`;
  axe en claro y oscuro.

### CON-02 · «¿De dónde sale?» igual en toda la app (P1 · M) — F2, con la navegación nueva

- **Problema.** Hay al menos diez explicaciones de cifras hechas a mano y cada una distinta: «De dónde sale el resultado» de
  escenarios, «de dónde sale cada parte» de Plan, «Por qué la confianza es…» de Previsión, el «de dónde sale la cifra que hay en la
  casilla» de Partidas… Los fallos de coherencia de cifras de noviembre (FX-01 a FX-04) se encontraron comparando pantallas a mano.
- **Qué es.** Un componente único: tocar una cifra destacada abre una hoja inferior (panel derecho en el escritorio) con **qué es**,
  **con qué se calcula** (las entradas con su valor), **de qué movimientos sale** (enlace a Movimientos ya filtrado) y **de cuándo es el
  dato** (fecha del último extracto que la alimenta). Mismo aspecto en todas las pantallas.
- **Guardia.** Una prueba que exija que cada cifra destacada del inventario de XGO-01 (`docs/gobierno/superficie.json`) tenga su
  explicación: una cifra sin explicación pone el CI en rojo.
- **Retira.** Las explicaciones hechas a mano, que pasan al componente.
- **Medida.** Veces que se abre por pantalla (el medidor de XGO-02) y cifras que no cuadran encontradas por el hogar.

### CON-03 · Diario de cambios con deshacer, en Datos (P1 · M) — F3, antes de la prueba con 5 personas (WP-54)

- **Problema.** Deshacer existe en ocho módulos con criterios distintos: 10 s en Clasificar, el aviso de WP-37 en Ajustes, pólizas,
  contratos de deuda, nóminas, índices, valoración, seguimiento del plan. Después del aviso, lo hecho no se puede revisar ni deshacer.
  Con dos titulares, nadie sabe quién cambió una regla o un reparto.
- **Qué es.** Un registro único de lo que modifica datos (reglas, partidas, importaciones, repartos, cierres, ajustes): qué, quién
  (titular), cuándo y desde qué pantalla. Botón «Deshacer» durante 30 días donde se pueda; donde no (una firma de cierre), dice por
  qué y lleva al sitio. Filtros: por titular, por tipo y por mes.
- **Retira.** Las ocho formas de deshacer pasan a escribir en el diario. El aviso de 10 s se queda como atajo y lleva al diario.
- **Riesgo.** Toca la capa de guardado (`canonical-supabase-store.js`): primero el esquema y una prueba de ida y vuelta, en un PR
  sin pantalla.

### CON-04 · Decisiones y tareas del hogar dentro de la app, en «Decidir esta semana» (P0 · S) — F1

- **Problema.** El cuello de botella de la 1.0 no es el código: es **«construido 65 %, comprobado 0 %»** (panel del 4/11). Las 13
  decisiones abiertas (§5.1) y las tareas H-xx con fecha (§5.2) solo viven en documentos `.md` que el hogar no abre en el móvil. Se
  deciden por conversación, con días de retraso, y las fases esperan (riesgo 1 de §8).
- **Qué es.** En «Decidir esta semana» (FX-41), las decisiones y tareas que vencen en 14 días o menos: título, fecha límite, las
  opciones con **lo que cambia con cada una** y la recomendación. Cada tarea lleva a la pantalla exacta: «Firmar agosto» abre Cierre
  con agosto elegido; «H-26, tiempos en el iPhone» abre el medidor. Al decidir, la app genera una **nota fechada** («D-N46: base del
  Plan 2027 = real de 2026, decidido el …») para pegar en la conversación con Claude Code o compartir con la hoja nativa del teléfono.
  No hay servidor nuevo (NTC-06): la lista viaja como un JSON estático dentro del sitio, que se actualiza en cada PR.
- **Retira.** Nada visible: ocupa el hueco de «Decidir esta semana», que pasa de avisos de la previsión a decisiones del hogar. Los
  avisos de la previsión se quedan si hay sitio (máximo 3 decisiones visibles, decisión 3 de `ESTADO.md` §3).
- **Medida.** Días entre que se abre una decisión y la respuesta del hogar (hoy, de 1 a 14 días).

**Decisión que piden:** **D-N55**: adoptar CON-01 en F0 (detrás de CIE-01) y CON-04 en F1; CON-02 y CON-03 al catálogo, con su
fase propuesta. Recomendación: **sí a CON-01 y CON-04**. Son las dos que mueven la 1.0: firmar los meses que faltan y decidir antes.

**Seguimiento (27/11, otra conversación):** CON-05 a CON-08 y el plan para aplicar el sistema de diseño (DS-0 a DS-5), con lo medido en
`tema-v2.css` (25 tamaños de letra frente a 6 del sistema), en `docs/PROPUESTA_CON05_CON08_Y_PLAN_DISENO_2026-11-27.md`. Piden **D-N56**.
