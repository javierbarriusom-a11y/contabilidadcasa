# Cuatro funciones más que juntan lo que ya existe (CON-05 a CON-08) y plan para aplicar el sistema de diseño (DS-0 a DS-5)

> **Propuesta, no backlog.** Petición del hogar del 27/11/2026, en una conversación nueva: «propón 4 grandes funciones nuevas (UX,
> optimizar lo existente), conservando CON-01 a CON-04 y las del backlog anterior sin implementar», y «revisa el sistema de diseño
> adjunto, aplícalo en todas las pantallas y hazme un plan específico».
>
> Manda `docs/PROPUESTA_FINAL_NOVIEMBRE_2026.md` (destino de todo lo pendiente, §3 y §6) y, para pantallas, `docs/rediseno/ESTADO.md`.
>
> **D-N56 decidida el 27/11: sí a todo, con la tipografía (b).** Las fases, en la Propuesta final §4; la regla de las cuatro propuestas, en su §7.

## 0. Lo que no quiero callar

1. **Esta es la decimoquinta tanda de propuestas en seis semanas.** La Propuesta final (§8) pone «seguir proponiendo funciones»
   como riesgo de probabilidad alta, y D-N53 (recomendada «sí», sin contestar) pide no abrir funciones hasta el 14/1.
   - Por eso las cuatro de aquí cumplen las mismas reglas que CON-01 a CON-04:
     - no añaden pantallas;
     - cada una dice qué retira;
     - se buscaron antes en el código (regla 4 de §7);
     - y solo una (CON-07) recomiendo meterla antes de la congelación.
   - Las otras tres son catálogo o se pliegan dentro de paquetes que ya tienen fase.
2. **Pedir 6-10 funciones grandes en cada conversación no casa con cerrar la 1.0.** El cuello de botella son las 13 decisiones
   abiertas y los meses sin firmar, no las ideas. Por eso propongo un cambio de formato a partir de ahora: en cada conversación,
   **4 como máximo**, y cada una debe sustituir algo o tener fecha. El resto de lo que pidáis va a «mejoras de diseño» (§3), que no
   añaden superficie.
3. **El sistema de diseño no se está aplicando de forma medible.** El color está bien tokenizado, pero la tipografía y el espaciado
   no (§2.1). Sin una guardia en el CI, cada pantalla rehecha añade su propia deriva. Es el hallazgo más útil de esta revisión.

## 1. Cuatro funciones (CON-05 a CON-08)

Ninguna repite CON-01 a CON-04 (Propuesta final §10) ni nada del catálogo (§3 y §6). Antes de escribirlas busqué en el código:
`ficha-movimiento-ui.js`, `kit-entidad-ui.js`, `canonical-expected-movements.js`, `canonical-ghost-expense-detector.js`,
`canonical-pattern-rules.js`, `lo-que-pide-ui.js`, `canonical-next-best-action.js`, `canonical-forecast-alerts.js`,
`canonical-budget-alerts.js`, `canonical-statement-anomalies.js`, `canonical-reminders.js`, `me-lo-puedo-permitir.js` y la guía
DEX5 de primeros pasos (`app.js`).

### CON-05 · La ficha de un comercio o recibo: «¿qué es esto y cuánto nos cuesta?» (P1 · M)

- **Problema.**
  - El hogar piensa en entidades («Mercadona», «Endesa», «el seguro del coche»), pero la app solo enseña pantallas.
  - Para saber cuánto se lleva Endesa al año, si ha subido, qué regla lo clasifica y cuándo es el próximo cargo hay que pasar por
    cuatro sitios:
    - Movimientos filtrado;
    - Clasificar o la ficha del movimiento (la regla);
    - «Lo que viene» (el próximo cargo);
    - y nada para la tendencia.
  - El detector de gastos fantasma y el comparador de tarifas existen, pero no se ven desde el comercio.
- **Qué es.** Tocar el nombre de un comercio en Movimientos, Clasificar, «Lo que viene» o la ficha del movimiento abre una **hoja
  inferior** (el panel derecho en el escritorio; tercer nivel de la regla de profundidad del PDF, p. 2). Lleva:
  1. **12 meses en barras**, con la media y la frase de tendencia («+14 % frente a hace un año»). Tinta para lo real y azul para el
     próximo cargo previsto (decisión 2 de `ESTADO.md` §3).
  2. **Qué es para la app:**
     - su partida;
     - la regla que lo clasifica (`canonical-pattern-rules.js`);
     - si es recurrente y el día probable del próximo cargo (`canonical-expected-movements.js`);
     - si el detector lo marca como posible suscripción olvidada.
  3. **Una sola acción primaria**, la que toca:
     - «Cambiar la partida de todos» (la lógica de «¿A cuáles?» de `ficha-movimiento-ui.js`, tal cual);
     - o, en luz, agua, gas, teléfono y seguros, «Comparar tarifa» (`canonical-tariff-comparator.js`).
  4. Las demás acciones, en texto: «Ver sus movimientos» (Movimientos ya filtrado) y «Marcar para revisar en el cierre».
- **Encaje.** Es el detalle que le falta a **CAT-03** («Recibos y suscripciones en Movimientos», F1): CAT-03 hace la lista y CON-05,
  lo que se abre al tocar una fila. Recomiendo **no abrir un paquete nuevo**: que CAT-03 lo incluya. Usa además el nombre limpio de
  TRE-18 / CAT-13 cuando exista; mientras tanto, el concepto del extracto.
- **Retira.** Nada visible. Ocupa el nivel de hoja.
- **Medida.** Fichas abiertas por semana (medidor XGO-02) y reglas cambiadas desde la ficha.
- **Pruebas.**
  - Unitaria del resumen por comercio: media, tendencia, recurrente o no, y menos de 3 meses de historia, que dice «Poca historia»
    en vez de dar una tendencia.
  - e2e a 1280 y 390 px `@safari`.
  - axe en claro y oscuro.

### CON-06 · Una sola cola de avisos, con «Posponer» y «No aplica» (P1 · M)

- **Problema.**
  - Al menos ocho motores generan avisos, cada uno con su forma y su sitio:
    - previsión (`canonical-forecast-alerts.js`);
    - presupuesto (`canonical-budget-alerts.js`);
    - extracto raro (`canonical-statement-anomalies.js`);
    - gasto fantasma;
    - dato viejo (`canonical-data-age.js`);
    - revisión de tipo y renovaciones;
    - recordatorios (`canonical-reminders.js`);
    - frescura de decisiones (`canonical-decision-freshness.js`).
  - «Decidir esta semana» (FX-41) recoge solo los de la previsión. «Lo que la app te pide» (XDA-01) recoge solo los datos que faltan,
    y nace apagado.
  - Ningún aviso se puede **posponer** ni marcar **«no aplica»**. Lo que no aplica se queda gritando, y el hogar aprende a no mirar.
    Solo los movimientos esperados tienen algo parecido.
- **Qué es.**
  - Un **motor puro de cola** (sin DOM, como `canonical-next-best-action.js`). Recibe los avisos de los ocho motores, quita los
    duplicados (el mismo cargo avisado por la previsión y por el presupuesto cuenta como uno) y los ordena por reglas fijas:
    1. rompe una regla del hogar (suelo, reserva);
    2. vence en 7 días o menos;
    3. falta un dato que tuerce una cifra;
    4. lo demás.
  - **Hoy** enseña los 3 primeros (decisión 3 de `ESTADO.md` §3) y «Ver los N avisos».
  - Cada aviso tiene tres salidas:
    - **Ir** (a la pantalla exacta);
    - **Posponer** (hasta mañana, hasta el próximo cierre o hasta una fecha);
    - **No aplica** (con el motivo en un toque: «ya pagado», «no es nuestro», «lo sabemos»).
- **Encaje con CON-04** (corregido el 27/11). CON-04 es pequeño y va solo en F1. Cuando llegue CON-06 en F2, las decisiones del
  hogar pasan a ser **una fuente más de la misma cola**, no otra lista. No hace falta que CON-06 vaya antes.
- **Retira.**
  - Los avisos sueltos dentro de cada pantalla pasan a ser una línea con su enlace a la cola.
  - «Lo que la app te pide» se convierte en un filtro de la cola («datos que faltan») en vez de una tarjeta aparte.
  - El saldo de XGO-01 baja.
- **Medida.**
  - % de avisos con salida (Ir, Posponer o No aplica) en 7 días.
  - Avisos «no aplica» por motor: un motor con más del 30 % de «no aplica» está mal calibrado. Ese dato no lo tenemos hoy y es el
    más valioso de esta función.
- **Riesgo.**
  - Los motores de aviso no comparten forma. Hace falta un adaptador por motor, con una prueba de ida y vuelta.
  - Lo pospuesto vive en el navegador (`storageSet`), igual que el kit de entidad. Se sincroniza cuando se sincronice el resto, sin
    servidor nuevo.

### CON-07 · Arranque con tres extractos: el primer plan en 20 minutos (P0 para WP-54 · M) — **recomendada antes del 14/1**

- **Problema.**
  - WP-54 (cinco personas ajenas, criterio de salida de la 1.0, F3) va a medir **la primera media hora de alguien que no es el
    hogar**.
  - Hoy esa media hora es la guía DEX5: un aviso que dice «Empieza por Registrar y repasa Hoy cada día». La app solo es útil después
    de semanas de configurar a mano partidas, reglas, nómina, suelo y reserva.
  - Los motores que lo harían solos ya existen:
    - perfiles de extracto e importación;
    - reglas por patrón y grupos de Clasificar;
    - detección de nómina (`canonical-payroll.js`);
    - movimientos esperados;
    - colchón (`canonical-cushion.js`);
    - base cero (`canonical-zero-base.js`).
  - Lo que falta es el recorrido que los encadena.
  - **Si WP-54 se hace sin esto, medirá la fricción de configurar, no el valor de la app.** Es lo que haría fracasar el criterio.
- **Qué es.** Cuatro pasos con progreso visible («2 de 4»), cada uno con su resultado antes de seguir:
  1. **Importar 3 meses** de una o dos cuentas (Importar v2, sin cambios).
  2. **Revisar lo que la app ha entendido:**
     - las partidas propuestas, en grupos de Clasificar (5 por tanda);
     - la nómina detectada («¿Es esta vuestra nómina? 2.140 € el día 28»);
     - los recibos fijos.
     - Cada propuesta, con su aro de «estimado» (cifra con estado, PDF p. 1).
  3. **El suelo y la reserva:** la propuesta del colchón con su porqué, editable.
  4. **Vuestro primer plan del mes:** el reparto de base cero con las cifras estimadas y el botón «Empezar con este plan».
     Lleva a Hoy.
  - Se puede salir en cualquier paso: lo hecho queda guardado y Hoy muestra una línea plegada («Arranque: paso 3 de 4»).
- **Privacidad.**
  - Los datos de las personas de WP-54 no se mezclan con los del hogar: el arranque escribe en un perfil nuevo del navegador, como
    hoy un hogar nuevo.
  - La banda «EJEMPLO» de XUX-02 sale solo con datos ficticios.
- **Encaje con D-N53.** La regla 2 de §7 deja, después del 14/1, «lo que pida WP-54». CON-07 es justo eso, pero conviene hacerlo
  **antes**, para que WP-54 lo pruebe y no lo descubra.
  - Fase propuesta: **F2**, detrás de R2. Usa los 5 destinos.
- **Retira.**
  - La guía DEX5 (`#dex5OnboardingBanner`).
  - El aviso de primeros pasos de TRE-09, en lo que no haga CAT-08.
- **Medida (es la de WP-54).**
  - Minutos hasta «Empezar con este plan» (objetivo: 20 o menos).
  - De las 5 personas, cuántas terminan.
  - % de propuestas aceptadas sin cambios en el paso 2: dice cuánto acierta la clasificación con datos de otros.
- **Pruebas.**
  - e2e del recorrido entero con extractos de ejemplo de dos bancos, a 390 px `@safari`.
  - Que salir y volver retoma el paso.
  - Que no toca un perfil con datos.

### CON-08 · «¿Y si…?» desde cualquier cifra del plan (P2 · M) — al catálogo, con FX-25

- **Problema.** Las preguntas «¿y si sube la luz un 20 %?», «¿y si este mes no cobro el variable?» o «¿me lo puedo permitir?»
  tienen hoy tres puertas distintas:
  - «Me lo puedo permitir» (`me-lo-puedo-permitir.js`);
  - la sensibilidad de la previsión (`canonical-forecast-sensitivity.js`);
  - Escenarios, en otra pantalla.
  - Cada una da la respuesta con otra forma.
- **Qué es.**
  - Mantener pulsada (o tocar «¿Y si…?» en el menú de) una partida, un recibo o un ingreso abre una hoja con un único control (el
    importe o el %).
  - Responde con **una frase contra el suelo**: «El punto más bajo de diciembre pasa de 1.240 € a 610 €: sigue por encima del suelo».
  - Lleva «Guardar como escenario», que lo manda a Decidir.
- **Por qué al catálogo.**
  - Toca el motor de escenarios, y FX-25 («un solo motor de escenarios», Post tras FX-20 y D-N6) es el sitio natural.
  - Hacerlo antes duplicaría el motor.
  - Propongo apuntarlo como **la cara visible de FX-25**, no como paquete propio.
- **Retira (cuando llegue).** La puerta suelta de «Me lo puedo permitir»: pasa a ser «¿Y si…?» sobre «Gasto puntual».

## 2. Plan para aplicar el sistema de diseño en todas las pantallas (DS-0 a DS-5)

**Base:** el PDF «Finanzas Casa · Rediseño», p. 1 («Sistema de diseño v2: sobrio, numérico, honesto con lo que no sabe»), el mismo de
`docs/rediseno/referencias/`.

**Qué hay ya:**
- La auditoría de diseño del 25/11 hizo el inventario pantalla a pantalla: 9 de 16 hechas, y R1 y R2 para el marco.
- **Este plan no repite ese orden:** añade lo que falta para que el sistema se cumpla **en todas** y no se vuelva a desviar.

### 2.1 Lo medido hoy en `tema-v2.css` (7.268 líneas, rama `main` bcdfc927)

| Regla del sistema (PDF p. 1) | Lo que hay | Diagnóstico |
|---|---|---|
| **Color:** 8 tokens (`--ground`, `--surface`, `--ink`, `--ink-2`, `--brand`, `--forecast`, `--warn`, `--neg`), con su modo oscuro | Tokens `--e19-*` con modo oscuro propio; solo unos 12 colores escritos a mano fuera de las definiciones, la mayoría falsos positivos en selectores | **Bien.** Se mantiene |
| **Tipografía:** 6 tamaños (48 héroe · 32 título · 19 sección · 15 cuerpo · 12,5 meta · 11 etiqueta) | **25 tamaños distintos.** Los más usados (14 px ×41, 13 px ×31) no están en el sistema. Además: 17, 16, 13,5, 22, 20, 18, 14,5, 34, 30, 28… | **Deriva alta.** La causa más probable de que las pantallas v2 «no se parezcan» entre sí |
| **Espaciado:** 4 · 8 · 12 · 16 · 20 · 24 · 32 | 243 declaraciones fuera de la rejilla: 10 px ×74, 6 px ×58, 14 px ×51, 2 px ×30, 18 px ×15, 22 px ×8, 3 px ×4, 28 px ×3 | **Deriva media** |
| **Radios:** 12 control · 16 tarjeta · 24 hoja | 999 (píldora) ×22 · 12 ×9 · **10 ×6** · **3 ×5** · **2 ×4** · 16 ×4 · 24 ×3 · **14 ×3** | **Deriva baja.** 18 fuera del sistema |
| **Cifras:** `tabular-nums` y un solo formateador | 23 reglas con `tabular-nums`; `money()` único (decisión 7) | **Bien** |
| **Un botón primario por pantalla; control segmentado de 4 opciones como máximo** | Sin comprobación. Plan tiene 6 pestañas (la auditoría de diseño, G3) | **Sin guardia** |
| **Toast de deshacer: 8 s** | Clasificar, 10 s; otros, cada uno el suyo (CON-03 cuenta ocho formas) | **Inconsistente** |
| **Lo que no tiene datos se pliega** | Decisión 4, en las pantallas v2. Las de siempre aún dicen «Sin datos» | Se resuelve con cada pantalla |

Método: `grep` de `font-size`, `border-radius` y `padding|gap|margin` en `px` sobre `tema-v2.css`. Es reproducible y no incluye
`styles.css` (el tema clásico, que se retira en F3).

### 2.2 Las seis piezas, en orden

| Id | Qué | Cambio visible | Fase propuesta | Tamaño |
|---|---|---|---|---|
| **DS-0** | **Tokens de escala.** `--fs-heroe`, `--fs-titulo`, `--fs-seccion`, `--fs-cuerpo`, `--fs-meta` y `--fs-etiqueta`; `--sp-1`… `--sp-8` (4 a 32); `--r-control`, `--r-tarjeta`, `--r-hoja` y `--r-pildora`, en `tema-v2.css`. Sin tocar ninguna regla todavía | Ninguno | F1, con R1 parte 2 | S |
| **DS-1** | **Guardia de diseño en el CI** (`tests/redis-ds-guardia.test.cjs`), como trinquete, igual que el techo de `app.js` (ARQ-4) y el saldo de XGO-01. Ver abajo | Ninguno | F1 | S |
| **DS-2** | **Migrar la tipografía** a los 6 tokens, pantalla a pantalla, con capturas antes y después (390 y 1440, claro y oscuro). Ver la desviación que pide | Sí, leve | F1-F2, con cada pantalla que toque R1, R2 o F2 | M |
| **DS-3** | **Migrar espaciado y radios** a la rejilla. Mecánico: 10 → 8 o 12 y 14 → 12 o 16 según el contexto. 6 → 4 u 8; 2 y 3 → 4 (o 999 si es una píldora) | Sí, mínimo | F2 | M |
| **DS-4** | **Componentes únicos:** un `deshacer()` con toast de 8 s (lo que CON-03 haría escribir en el diario), un control segmentado que se niega a pintar más de 4 opciones y la «cifra con estado» (NXP-03) en las pantallas que entren en F2 (Patrimonio, Inversión, Decidir y Ajustes) | Sí | F2 | M |
| **DS-5** | **Graduar con el sistema.** La revisión de graduación de cada pantalla (P9) añade «cumple DS-1 sin excepciones» como condición | Ninguno | F3 | S |

**DS-1, lo que comprueba (cada regla con su trinquete: el número de hoy no puede crecer, y baja a medida que DS-2 y DS-3 avanzan):**
1. `font-size` en px o rem fuera de `var(--fs-*)`: hoy 185 declaraciones. Las reglas nuevas, solo con token.
2. `border-radius` fuera de {12, 16, 24, 999} o de su token.
3. `padding`, `gap` y `margin` en px fuera de {4, 8, 12, 16, 20, 24, 32}.
4. **e2e:** como máximo un botón primario visible por vista v2 en la primera pantalla, a 390 y 1440. Se mide sobre las vistas que ya
   recorre la batería e2e.
5. **e2e:** ningún control segmentado (`role="tablist"` del tema v2) con más de 4 pestañas visibles. **Plan (6) incumple hoy.** O se
   acepta como excepción con fecha (R2 lo deja en 3, como el PDF) o R2 lo resuelve antes de encender la regla.
6. Ninguna tarjeta v2 con «Sin datos» como titular (decisión 4).
7. Ningún `toFixed` en el código de pintado (decisión 7). Ya lo comprueba alguna prueba suelta; aquí pasa a ser la guardia de
   todas.

**Desviación que pide DS-2 (hay que decidirla, va en D-N56):** el sistema no tiene tamaño entre 12,5 (meta) y 15 (cuerpo), y la
app usa 13-14 px en 80 sitios, sobre todo tablas densas (Movimientos, Partidas, Contratos).
- **(a)** Subir todo a 15: más alto y fiel al PDF, pero las tablas crecen un 10 % y en el móvil se pierde una fila por pantalla.
- **(b)** Añadir **un séptimo tamaño, «cuerpo compacto» 13,5, solo para tablas y listas**, y anotarlo en `ESTADO.md` §4 como
  desviación.

Recomiendo la **(b)**: la densidad de las tablas es una función, no un descuido.

### 2.3 Mejoras de diseño que no están en el PDF (las aporto yo; cada una, pequeña)

1. **Cifra héroe fluida.** 48 px con `clamp(32px, 9vw, 48px)`, para que «−12.345 €» no corte a 390 px. Hoy lo evita
   `test:mobile-overflow` caso a caso; con esto deja de depender de la cifra.
2. **Previsto por forma, no solo por color**, también en los gráficos: la línea prevista discontinua y la real continua, en el kit
   de gráficos (`chart-kit.js`). El PDF lo pide para la cifra con estado (punto, aro, aro discontinuo); en los gráficos solo se
   distingue por el azul. Ayuda con daltonismo y en la impresión de la carta del mes (WCAG 1.4.1).
3. **Una sola animación de entrada para las hojas** (subir 16 px y aparecer, 200 ms), con su versión sin movimiento. Ya hay prueba de
   `reduced-motion` (`t8-alto-contraste-y-reduced-motion.test.cjs`); con DS-4, todas las hojas usan el mismo componente.
4. **Estados de carga con esqueleto** solo donde el cálculo pase de 300 ms (Previsión a 12 meses, Inversión). Por debajo, nada. Se
   mide antes con CAT-15, sin adivinar.

## 3. Lo del backlog anterior, sin perder nada

- **CON-01 a CON-04** siguen como están en la Propuesta final §10, pendientes de **D-N55**.
- **Todo lo demás pendiente** sigue en la Propuesta final §3 (con su fase F0-F4) y §6 (con su disparador después de la 1.0). Esta
  propuesta no mueve nada de sitio.
- Dónde encajan las ocho piezas nuevas:

| Pieza | Encaja en | No duplica |
|---|---|---|
| CON-05 | Dentro de CAT-03 (F1) | La ficha del movimiento (es de un movimiento, no de un comercio), el kit de entidad (es de deuda) |
| CON-06 | Motor en F2; CON-04 (F1) pasa a ser una de sus fuentes | FX-41 y XDA-01: los absorbe como productores |
| CON-07 | F2, detrás de R2; antes de WP-54 | TRE-09 / CAT-08 (Hoy en el iPhone), DEX5 (lo retira) |
| CON-08 | Catálogo, con FX-25 | «Me lo puedo permitir», los escenarios |
| DS-0, DS-1 | F1, con R1 parte 2 | La auditoría de diseño (pone el orden de las pantallas, no la guardia) |
| DS-2 a DS-4 | F1-F2, con cada pantalla | — |
| DS-5 | F3, graduación | P9 |

## 4. Decisión que pide: D-N56

| Parte | Recomendación |
|---|---|
| **a.** CON-05 dentro de CAT-03 (sin paquete propio) | **Sí** |
| **b.** CON-06, el motor de la cola de avisos, en F2 (antes de CON-04 si D-N55 dice sí) | **Sí**, si se adopta CON-04. Si no, al catálogo |
| **c.** CON-07, el arranque con tres extractos, en F2 y antes de WP-54 | **Sí**: sin él, WP-54 mide la configuración, no la app |
| **d.** CON-08 al catálogo, como la cara visible de FX-25 | **Sí** |
| **e.** DS-0 y DS-1 (tokens de escala y guardia en el CI) en F1 | **Sí**: es lo que hace que «aplicar el sistema en todas las pantallas» sea comprobable |
| **f.** La desviación tipográfica de DS-2: (a) todo a 15 o (b) un «cuerpo compacto» de 13,5 para tablas | **(b)** |
| **g.** El formato de las propuestas: 4 como máximo por conversación, y cada una sustituye algo o tiene fecha | **Sí** |

Para: **4/12**, con D-N54 y D-N55. Siguiente decisión libre después de esta: **D-N57**.
