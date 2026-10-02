# Backlog del plan de mejora de UX por olas — para retomar en otra sesión

> **2/10/2026 (sesión 292): lo pendiente de este documento vive ahora en [`BACKLOG_INICIO_OLEADA_OCTUBRE.md`](BACKLOG_INICIO_OLEADA_OCTUBRE.md)**, el único backlog vivo. Este se conserva como detalle histórico de por qué se hizo cada cosa; no actuar sobre sus estados sin contrastarlos con aquel (su §12 lista lo desfasado).

Creado el 30 de septiembre de 2026 (sesión 279), al cierre de una sesión larga. **Fuente viva del plan de UX** (olas 0 a 4) y de la
deuda de rendimiento y navegación que dejó. Autocontenido a propósito: quien lo abra sin haber visto la conversación debería poder
decidir qué hacer primero en 10 minutos. El detalle histórico de cada cosa vive en `PROJECT_STATE.md` (sesiones 268–278) y en los
documentos de diseño enlazados.

**Actualizado el 2 de octubre de 2026 (sesión 291: el hogar contestó las 14 preguntas; resumen y consecuencias en `docs/OLA2_RECALIBRACION.md` §8; **regla de parada v2 aprobada y vigente; no se construye más sobre Hoy hasta diagnosticar «no la encontró»**; antes, sesión 290: S5 — titular único «Disponible para gastar» y ficha más baja; supuesto de trabajo «tiempo base malo»; las preguntas abiertas están consolidadas en `docs/OLA2_RECALIBRACION.md` §7; antes, sesión 288: S4 y S3′ fusionadas (#425 y #426), a la espera de que el hogar las pruebe y de re-medir; antes, sesión 287: medición con datos reales).** Estado en una línea: la medición dio **100 % de fechas de salida estimadas**, así que **S2 y S3 tal como estaban diseñadas se cancelan** y se recalibran en [`docs/OLA2_RECALIBRACION.md`](docs/OLA2_RECALIBRACION.md); **S4** (frescura del dato) **está fusionada** (#425) y **S3′** («margen de Hoy», sin depender de fechas) **está fusionada** (#426) por orden del hogar, sin haberla probado antes con sus datos. S1 está hecha (sesión 286); el PR #416 está cerrado. *(Sesiones 285–286: decisiones del hogar, diseño y S1.)*

Su lugar en el mapa de backlogs: `BACKLOG_INDICE.md` (eje de UX del backlog vigente `BACKLOG_CONTABILIDADCASA_3_0.md`, no lo sustituye).

Origen del plan: análisis de producto pedido por el hogar (UX/UI, experiencia de uso y funcionalidades, **sin foco tecnológico**),
recogido en `BACKLOG_CONTABILIDADCASA_3_0.md` §9. **Dato del hogar que condiciona todo: dos personas; una registra y opera
(intensa) y la otra solo consulta; la que consulta usa Hoy como producto entero.** Móviles: **iPhone 17 e iPhone 15 Pro** (rápidos).

## 0. Cómo empezar la próxima sesión (10 minutos)

1. Leer este documento entero y, de `PROJECT_STATE.md`, solo las entradas **285, 284 y 283** (arriba del todo) y, del diseño, `docs/OLA2_SUELO_Y_DISPONIBLE.md`.
2. `git status` y `git log --oneline -5`; comprobar que la rama de trabajo parte de `origin/main` (§6, «reiniciar la rama»).
3. **Las decisiones esenciales de la Ola 2 ya están tomadas** (§8.5) **y recalibradas el 2/10/2026** tras medir (`docs/OLA2_RECALIBRACION.md`). **S1 está hecha (sesión 286)**; **S4 (#425) y S3′ (#426) están fusionadas (sesión 288)**: son las dos entregas visibles de la Ola 2 que permite la regla de parada v2; lo siguiente es **re-medir con las dos personas** (§7), no construir más. Antes de tocar nada de Hoy, leer §2.3 (lo que enseñó construir O2-1) y §8.5: corrigen el diseño de la sesión 278 y el módulo de O2-1 está aparcado y desfasado.
4. Si el hogar aún no ha contestado, la única cosa útil sin bloqueo es **§4 (deuda técnica)** y, si el informe de uso existe, **§3**.
5. **La medición con datos reales ya se hizo (2/10/2026): `porcentajeEstimado` = 100 %.** El script del §8.6 queda como herramienta por si se quiere repetir. Antes de cerrar: validar, actualizar `PROJECT_STATE.md` con cifras reales, commit/push, PR en borrador, esperar CI, fusionar en verde (§6).

## 1. Qué está hecho (no rehacer)

| Ola | Qué | PR | Sesión |
|---|---|---|---|
| 0 · Higiene | Lenguaje visible sin jerga; marco de pantalla (un título, cabecera y tira compactas); estados vacíos neutrales; «Libre de deuda» con una sola lectura; Cierre recompuesto; acceso plegado | #405, #406, #407 | 268–270 |
| 1 · Diseño | Mapa de las 59 pantallas, dependencias, dos caminos. **Decisión del hogar: camino B** (nueve pantallas, ritmos como rótulos, cero pantallas nuevas) | #408 | 271 |
| 1 · Entrega 1 | Menú principal de 11 a 10 entradas agrupadas por ritmo; «Datos» sale; «Escenarios» sube | #409 | 272 |
| 1 · Entrega 2 | Presupuesto, Esta semana y Partidas como pestañas de Plan | #410 | 273 |
| 1 · Entrega 3 | Franja de Escenarios con cuatro destinos (Simular · Guardados · Asesor · Segunda opinión); los comparadores se quedan en el menú avanzado | #411 | 274 |
| 1 · Entrega 4 | Catálogo del buscador coherente con el menú + guardián; el menú resalta «Plan» y «Escenarios» en sus pantallas hermanas (`data-nav-family`) | #412, #413 | 275–276 |
| Rendimiento | «Carga honesta»: pantallas ocultas de partida, cabecera en su estado final (CLS 0,147 → ~0), LCP de Lighthouse a aviso, puerta nueva `test:load-budget` | #414 | 277 |
| 2 · Diseño | `docs/OLA2_HOY_Y_CONSULTA.md` (diagnóstico de Hoy, veredicto, modo consulta) | #415 | 278 |
| 2 · O2-1 (aparcado) | Módulo `canonical-home-verdict.js` con 24 pruebas, **sin fusionar** (guardián ARQ-3) y **desfasado** por las decisiones del 1/10 | [#416](https://github.com/javierbarriusom-a11y/contabilidadcasa/pull/416) (**cerrado sin fusionar el 2/10/2026**) | 280 |
| 2 · Hallazgos y decisiones | Hallazgos de construir y ejecutar O2-1 (§2.3) y hoja de sesión con el hogar (§8); registro de decisiones (§8.5) | #417, #418 | 280–281 |
| 2 · Fechas de ingresos | La nómina de Javi se fecha el **último día natural** (antes, el hábil); y la de diciembre el 31, no el 15 (la regla de diciembre la adelantaba por superar 2.500 €). Prueba `tests/nomina-javi-ultimo-dia-natural.test.cjs` | #419, #421 | 282, 284 |
| 2 · Diseño del número de Hoy | `docs/OLA2_SUELO_Y_DISPONIBLE.md`: suelo de liquidez (nuevo parámetro, sobre el total) y «disponible» = mínimo proyectado a 30 días; entregas S1–S4 | #420 | 283 |
| 2 · S1 | `canonicalDailyInput` y sus tres ayudantes (166 líneas) salen de `app.js` a `canonical-daily-input.js`, sin cambio de comportamiento (102 casos idénticos, datasets dorados sin diferencias); `app.js` 37.530 → 37.365 y techo 37.495 | [#423](https://github.com/javierbarriusom-a11y/contabilidadcasa/pull/423) | 286 |
| 2 · Medición y recalibración | Medición con datos reales y sesión del hogar: 100 % de salidas con fecha estimada (estructural, no arreglable con extractos). S2 y S3 canceladas tal como estaban; S4 primero; S3′ sin dependencia de fechas; regla de parada v2 propuesta. Solo documentación; `docs/OLA2_RECALIBRACION.md` | PR de la sesión 287 | 287 |
| 2 · S4 frescura del dato | `canonical-data-age.js` + tres puntos de uso (cabecera de Hoy con píldora de aviso, ficha de margen con «Actualizar saldos», tira superior). Umbral de aviso: 4 días. Fusionada por orden del hogar | [#425](https://github.com/javierbarriusom-a11y/contabilidadcasa/pull/425) | 288 |
| 2 · S5 titular de Hoy | Titular único «Disponible para gastar» = el menor de «hoy» y «a fin de mes»; ficha 33 px más baja; subtítulo de Hoy oculto en móvil. Medido: la cifra termina en 576 px (cabe en 664 de un iPhone con Safari; **no** en un SE de 553) | [#428](https://github.com/javierbarriusom-a11y/contabilidadcasa/pull/428) | 290 |
| 2 · S3′ margen de Hoy | `canonical-home-margin.js`; ficha «Disponible hoy» + «A fin de mes (previsión)» la primera de la rejilla; retira «Caja disponible» y «Liquidez hoy»; parámetro nuevo «suelo de liquidez» en Ajustes. Fusionada por orden del hogar | [#426](https://github.com/javierbarriusom-a11y/contabilidadcasa/pull/426) | 288 |

**Decisiones del hogar vigentes** (30/09/2026 salvo indicación): camino B; retirar pantallas = **«redirigir sin borrar código»**; «avanza sin el
informe, solo agrupando» (no retirar sin informe y OK); Escenarios con **cuatro** destinos; los pasos del flujo de Escenarios resaltan
«Escenarios» y dentro de Presupuesto/Esta semana/Partidas el menú marca «Plan»; rendimiento **opción 1**; Registrar se rediseña **después de la
Ola 1**. Ver también `docs/OPT22_MODELO_HOGAR.md` (29/08/2026): **no construir control de acceso por persona** sobre el modelo actual. **Decisiones del 1/10/2026 (número de Hoy, suelo, cobros, fechas de ingresos): §8.5.**

## 2. Ola 2 — Hoy con veredicto y modo consulta (diseño recalibrado el 2/10/2026; S1 hecha; siguiente: S4, luego S3′ — ver `docs/OLA2_RECALIBRACION.md`)

Diseño completo y datos en `docs/OLA2_HOY_Y_CONSULTA.md`. **El número de Hoy se rediseñó el 1/10/2026 tras las decisiones del hogar: vigente `docs/OLA2_SUELO_Y_DISPONIBLE.md` (sustituye la definición A del §3).** Resumen del diagnóstico (dataset demo, no datos reales): Hoy da **ocho cifras** de «cuánto me
sobra» con cuatro problemas verificados (duplicado «Liquidez hoy» = «Caja disponible»; negativo −1.090 € recortado a «0,00 € por encima»; «Reserva protegida:
fuera de umbral» frente a «Próximo riesgo: sin déficit»; el margen «hasta el siguiente ingreso» vacío). La respuesta empieza a ~1.246 px en móvil
(~987 px sin el aviso de primeros pasos).

### 2.1 Decisiones que faltan (cada una con mi recomendación)

| # | Pregunta al hogar | Recomendación |
|---|---|---|
| D1 | ¿Qué es «el número»? | Caja de CaixaBank − suelo de reserva − **salidas ya previstas hasta el próximo ingreso** (definición A del diseño). **Respondida el 1/10/2026 con otra definición: ver §8.5** |
| D2 | ¿Mediolanum cuenta como gastable? | No: «ahorro aparte» en una línea. **Respondida el 1/10/2026: sí cuenta (§8.5)** |
| D3 | «Carta del mes»: ¿qué esperan? | Un párrafo llano con las cifras del mes, sin IA generativa; **solo si** se define, y después del veredicto |
| D4 | Modo consulta | **Solo nivel 1** (preferencia de este dispositivo; **no protege**). El nivel 2 (`viewer` real) contradice OPT-22 |
| D5 | ¿Se pliega el detalle de Hoy por defecto en modo consulta? | Sí (Hoy mide 11.400 px en móvil) |

### 2.2 Entregas (histórico de la sesión 278; **las vigentes son S1–S4 de `docs/OLA2_SUELO_Y_DISPONIBLE.md` §8**: S3 = O2-1 rehecho + O2-2 en un solo PR, S4 = O2-3)

| Entrega | Contenido | Hecho cuando | Riesgo |
|---|---|---|---|
| **O2-1** | Módulo `canonical-home-verdict.js`: cálculo puro de la cascada y estados honestos (negativo dicho, dato que falta nombrado). **Sin cambiar la pantalla** | 🟡 **Construido y aparcado (1/10/2026)** en la rama `claude/o2-1-home-verdict` (PR [#416](https://github.com/javierbarriusom-a11y/contabilidadcasa/pull/416), no fusionar): 24 pruebas, `app.js` sin tocar. Los datasets dorados **no sirven** (§2.3-4); se probó con fixtures sintéticos y con la app real. Líneas medidas: **~20–25 puras, no 60–100** (§2.3-5). No entra en `main` hasta O2-2 por el guardián ARQ-3 (§2.3-6). **Desfasado por las decisiones del 1/10/2026 (§8.5): suma las dos cuentas y el suelo cambia de ámbito; hay que rehacerlo** | Bajo |
| **O2-2** | La tarjeta oscura «Hasta el siguiente ingreso» pasa a ser el veredicto (misma posición); se quita el duplicado Liquidez/Caja; el margen sobre la reserva se muestra **con signo**; «Próximo riesgo» dice fecha y base | `verify` verde + e2e + axe + `mobile-overflow`; un test que fije que el duplicado no vuelve | Medio: es la pantalla más vista |
| **O2-3** | Frescura del dato pegada a la cifra («saldos a … · último movimiento hace N días · guardado hh:mm») | Prueba de navegador: **veredicto < 700 px en 390×844 sin desplazarse** (hoy ~1.246 px) | Bajo |
| **O2-4** | Modo consulta nivel 1 (interruptor por dispositivo en `localStorage`, oculta escrituras, simplifica menú, reutiliza «Modo reunión» y «Vista por titular») | Interruptor visible con la leyenda «comodidad, no protección»; guardián de que ninguna entrada principal desaparece | Medio |
| **O2-5** | «Carta del mes» | Solo si D3 la define | Bajo |

**Trampa conocida:** `requiredReserve` (`canonical-decisions.js`, `transferForMonth`) = suelo **+ las salidas de todo el mes siguiente**; sirve para decidir
traspasos a ahorro, **no** como base de «cuánto se puede gastar». No reutilizarla.

### 2.3 Lo que enseñó construir O2-1 (1 de octubre de 2026) — corrige el diseño de la sesión 278

Se construyó `canonical-home-verdict.js` (módulo puro, 24 pruebas, sin cablear; **aparcado en la rama `claude/o2-1-home-verdict`, ver el punto 6**) y se **ejecutó contra la app real con el dataset demo público**. Cifras de la demo, **no del hogar**.

1. **El número depende de la calidad de las fechas del plan, y sin histórico esa calidad es de relleno.** Con el dataset demo (sin transacciones, por privacidad) las seis partidas
   de gasto de octubre (**4.730 €**) llevan la fecha de relleno «día 8» (`expenseTimingForRow`, `confidence: "estimated"`), **el mismo día que el ingreso** (3.000 + 2.000 €). Con
   CaixaBank 5.610 € y suelo 2.500 €, el margen hasta el 8 de octubre es **−1.620 €** si esas salidas caen antes del ingreso y **+3.110 €** si caen después: 4.730 € de
   diferencia por un supuesto de calendario. El módulo lo declara (`sameDayOutflows`, `marginIfSameDayAfterIncome`, `signDependsOnSameDay`, `breakdown.estimatedShare`).
   **Consecuencia para O2-2:** el veredicto solo es fiable cuando el plan tiene salidas con fecha observada (movimientos conciliados) o de regla (fin de mes). Con datos de relleno
   debe decir *de qué depende*, no dar la cifra como cierta.
2. **Con fechas de relleno, la definición A no aporta nada nuevo:** coincide con el margen sobre la «reserva protegida» (suelo 2.500 + 4.730 = 7.230 €), es decir, el −1.620 € que
   la tarjeta de Hoy recorta a «0,00 € por encima del mínimo». El valor de O2-2 aparece solo con calendario real.
3. **La comparación con el ritmo habitual de gasto (idea de la sesión del 1/10) no puede usar `typicalDailyOutflow` del motor diario:** es la media de **todas** las salidas
   conciliadas ÷ (meses × 30), incluidos alquiler y cuotas que ya están en «salidas previstas»: doble cuenta. Haría falta un gasto variable *no planificado* que hoy no existe.
   Descartada para O2-1; si el hogar la quiere, es una entrega propia con su definición.
4. **Los datasets dorados no sirven para O2-1 tal como están:** alimentan el motor mensual (`engineInput`); los eventos diarios los construye `canonicalDailyInput` en `app.js`
   (~7334–7444, ~110 líneas acopladas a `state` y a helpers de fecha), que no se puede importar desde Node. Las pruebas usan fixtures sintéticos más la medición contra la app
   real. Extraer `canonicalDailyInput` a un módulo es un trabajo con valor propio (libera ~110 líneas del techo de `app.js`), pero no es trivial.
5. **La estimación «60–100 líneas liberadas» era optimista.** La tarjeta de cobertura ocupa 157 líneas (`app.js` 21.657–21.813); lo **puro y extraíble** son ~20–25 (las dos
   insignias y la frase), el resto (~130) es DOM, estado y cableado. Liberar de verdad exige mover el **pintado y el editor** a un módulo de interfaz (patrón `views/*.js` o
   módulo diferido como `ux-shell.js`), ajustando sin relajar su intención `tests/opt6-mover-cobertura-a-ajustes.test.cjs` (fija nombres de función dentro de `app.js`) y
   `tests/f1-contrato-ejecutivo-deuda.test.cjs` (simula `executiveCoverageSnapshot`). Hoy sigue habiendo 8 usos de esas funciones fuera del bloque.
6. **Guardián ARQ-3** (`tests/arq3-canonical-sin-consumidor-ui.test.cjs`): todo `canonical-*.js` debe tener consumidor en `app.js` o `views/`, salvo excepciones documentadas.
   Un módulo que nace antes que su pantalla lo incumple por diseño: es exactamente el patrón que ese guardián se escribió para detectar (con el módulo, `npm test` da 4988/4990: los dos
   fallos son ese guardián y su recuento 67→68). **Decisión del hogar (1/10/2026): no tocar el guardián ni añadir excepción.** El módulo y sus 24 pruebas **no están en `main`**: viven en la
   rama **`claude/o2-1-home-verdict`** (PR en borrador [#416](https://github.com/javierbarriusom-a11y/contabilidadcasa/pull/416), aparcado, CI rojo a propósito) y se fusionan **junto con O2-2**,
   cuando haya pantalla que lo consuma y el hogar haya contestado D1/D1b/D6 (§8.3), porque esas respuestas pueden cambiar su API. Al retomar O2-2: partir de esa rama (o `git cherry-pick 1689bde`),
   cablear el consumidor y comprobar que el guardián pasa sin excepciones.
   > **2/10/2026:** el PR #416 se **cerró sin fusionar** y el módulo se **descarta**: tras medir con datos reales (100 % de fechas estimadas) ya no habrá un «módulo + consumidor» del mínimo proyectado a 30 días. La rama se conserva solo como referencia. Ver `docs/OLA2_RECALIBRACION.md`.
7. **Con tres ingresos de distinto tamaño, «hasta el próximo cobro» da una cifra que sube y baja con el calendario, no con el dinero.** Con las fechas del hogar (local el 1, Tere el 25 en la app,
   Javi el último día) la ventana mide ~1 día tras cobrar Javi, ~24 tras el local y ~6 tras Tere: justo al entrar el local (~800 €) la ventana salta de 1 a 24 días y «lo disponible» **baja el día que entra
   dinero**. Alternativa propuesta (sin construir ni decidir): **mínimo proyectado a 30 días**, es decir saldo total − suelo + el punto más bajo del acumulado de ingresos y salidas fechados en ese horizonte.
   Es lo que se puede gastar hoy sin que el total baje del suelo en ningún momento del mes; es continua, admite ingresos de cualquier tamaño y reutiliza los eventos del motor diario. Sigue dependiendo de la
   fecha de las salidas (§2.3-1), pero ya no de que una fecha caiga a un lado u otro de un ingreso.
8. **El suelo sobre el total cambia el papel de los traspasos.** Hoy el traspaso a Mediolanum existe para dejar CaixaBank en suelo + salidas del mes siguiente (`transferForMonth`). Con el suelo sobre el total,
   mover dinero entre cuentas no cambia el total: la decisión de «cuánto debe quedar en CaixaBank» pasa a ser otro parámetro (mínimo operativo de la cuenta) distinto del suelo. Diseñar **dos parámetros**
   (suelo total y mínimo operativo en CaixaBank) antes de tocar ninguna de las ~11 piezas que hoy leen el suelo.

## 3. Ola 1, entrega 5 — retiradas (BLOQUEADA por el informe de uso y el OK del hogar)

- **Condición:** el hogar abre Ajustes › «Uso de la app» **en el navegador de cada uno** (el contador vive en `localStorage` de cada dispositivo; un «cero
  visitas» en un navegador no prueba que nadie la use) y da su OK **pantalla a pantalla**.
- **Mecanismo decidido:** redirigir sin borrar código (las pantallas heredadas siguen existiendo; el enlace y el alias apuntan a la pantalla vigente).
- **Candidatas (9):** `alerts-center`, `visual-detail`, `savings-agent`, `conciliar`, `executive-advisor`, `virtual-advisor` y, del D-14, `debt-roadmap`,
  `debt-liquidation-plan`, `debt-control`. **`registrar-mes` no se toca** (promesa R-5). Detalle y dependencias en `docs/OLA1_ARQUITECTURA_NAVEGACION.md` §7–§8.
- **Regla:** ninguna retirada sin informe y OK explícito; consultar antes de retirar cualquier pantalla en uso, aunque el CI esté en verde.

## 4. Deuda técnica y de rendimiento que quedó anotada

Cada ítem: qué es → por qué importa (o no) → qué haría falta.

| ID | Qué | Importa | Qué haría falta |
|---|---|---|---|
| **UX-P1** | **LCP real de primera visita en móvil lento ≈ 8 s** (7,9–8,7 s en Lighthouse). La puerta de 4 s pasaba por un titular provisional | Solo afecta a primeras visitas y móviles lentos; **los iPhone del hogar no lo notan** | Partir `app.js` (324 KB comprimidos + tarea larga de ~3,8 s a CPU 4×): varias sesiones. **No urgente** |
| **UX-P2** | Lighthouse agrega con `optimistic` (mejor valor de **cada métrica por separado**, aunque salgan de ejecuciones distintas). Enmascaró el CLS durante meses | Un LCP o TBT malo aún podría taparse con otra ejecución | Cambiar a agregación por mediana + revisar umbrales (**decisión del hogar: cambia qué promete el CI**) |
| **UX-P3** | `test:load-budget` (mediana ≤ 5 s a CPU 4×; medido 3,2–3,8 s) **no mide WebKit ni un iPhone real** | Protege de regresiones grandes, no mide vuestra experiencia | Medir con Safari/Web Inspector en un iPhone si algún día se nota lentitud |
| **UX-P4** | **`app.js` tiene ~130 líneas de margen** (37.365 con techo 37.495 desde S1; antes estaba en su techo de 37.530) (`tests/arq4-techo-app-js.test.cjs`) | Cualquier cambio en `app.js` debe ser neutro en líneas o extraer código | O2-1 mide cuánto se libera; si no basta, plan de extracción como en la entrega 4 de la Ola 1 |
| **UX-P5** | El cálculo de arranque cuesta ~480 ms sin frenar (recalcular el modelo ~210 ms, pintar Hoy ~185 ms); las funciones calientes son las de filas de planificación | Solo relevante en móviles lentos | Memorizar por (fila, mes) en una revisión de render; riesgo medio-alto (cifras erróneas si la caché se invalida mal) → solo con datasets dorados. **Aparcado** |
| **UX-P6** | `markScrollableTableWraps` (~56 ms) barre el documento tras cada cambio del DOM | Marginal | Cambio del mismo tamaño en `app.js`; no compensa hoy |
| **UX-P7** | Cada despliegue cambia `CACHE_NAME` del service worker → cada dispositivo vuelve a descargar ~600 KB en segundo plano | Datos y batería en días con muchos despliegues | Precachear solo lo modificado; bajo valor |
| **UX-N1** | El desplegable «Herramientas avanzadas» se abre solo pero **nunca se cierra solo** al cambiar de pantalla | Estético | Cerrarlo si la pantalla activa no está dentro (toca `app.js`) |
| **UX-N2** | En Simular la insignia «Modo simulación · nada se guarda» se parte en 4 líneas junto al título | Estético, anterior a este plan | CSS |
| **UX-N3** | El menú avanzado conserva un enlace duplicado «Escenario · simular» (mismo destino que la entrada principal) | Redundante; Simular declara su propia familia para no marcarse dos veces | Retirarlo (implica ajustar pruebas de la entrega 1) |
| **UX-N4** | Menú declarado como datos (D9) **aplazado**: renderizarlo desde JS lo sacaría del HTML estático y arriesga el primer pintado | Solo si el modo consulta lo exige | Reconsiderar en O2-4 |

## 5. Ola 3 y Ola 4 (sin empezar)

- **Ola 3 · Registrar y captura** (decisión del hogar: **después de la Ola 1**; sigue pendiente de que se cierre la 2 o de que el hogar la adelante): rediseño de
  Registrar, captura en móvil, importador de un gesto, revisión semanal guiada. Métrica: tiempo por gasto desde el móvil.
- **Ola 4 · Funcionalidades:** «¿Me puedo permitir X?» (reutiliza el veredicto de O2-1), objetivos visuales, acta de reunión, motivación de deuda, cuentas
  claras en pareja. Hay una **decisión de modelo pendiente**: `inferOwner` es una etiqueta inferida por texto, no un campo estructurado (OPT-22); «cuentas
  claras en pareja» necesita antes un campo explícito de titular.
- **Métricas de éxito del plan** (`BACKLOG_CONTABILIDADCASA_3_0.md` §9): tiempo hasta responder «¿cuánto puedo gastar?», tiempo por gasto desde el móvil,
  duración del cierre mensual, sesiones que completan la revisión semanal. Instrumentación local sin datos financieros (`ARQ-0` ya cuenta aperturas por pantalla).

## 6. Recetas verificadas y trampas (leer antes de tocar código)

### Flujo de trabajo (`CLAUDE.md`, autorización del 10/08/2026)

Validar → actualizar `PROJECT_STATE.md` con cifras reales → commit y push a la rama de trabajo → **PR en borrador** → esperar CI → **fusionar en verde** (squash),
sin preguntar. **Frenos:** nunca fusionar en rojo ni forzar; nunca push directo a `main`; nunca tocar `finanzas-casa-def`; consultar antes de retirar una pantalla en uso
o borrar datos; **nunca cambiar umbrales de CI ni relajar una prueba para verde** (se arregla la causa, o se pregunta).

Tras cada fusión por squash: `git fetch origin main && git checkout -B <rama> origin/main && git push -u origin <rama> --force-with-lease` (la rama solo tenía historia ya
fusionada; sin esto el hook de parada protesta por commits sin subir). Un PR de la rama fusionado no se reutiliza: el siguiente cambio es un PR nuevo.

### Validación

- `npm run verify` (~4 min; incluye pruebas, lint, tipos, accesibilidad estructural, rendimiento, `build:site`, privacidad y humo).
- Puertas de navegador que ejecuta el CI (fuera de `verify`): `test:performance-lh`, `test:load-budget`, `test:mobile-overflow`, `test:e2e`, `test:a11y-axe`, `test:perf-screens`.
  En el contenedor de la nube hizo falta `PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome` y `CHROME_PATH` igual (comprobar con `ls /opt/pw-browsers`;
  si Playwright pide un directorio de navegador que no existe, enlazarlo simbólicamente al que hay).
- Medir rendimiento: `npm run build:site && npm run measure:load` (`MEASURE_CPU=2` para gama media). **Comparar solo entre ejecuciones en la misma máquina** (CPU compartida).
- Un PR de solo documentación tarda ~6 min en CI igualmente.

### Trampas del repositorio (cada una costó una vuelta)

1. **`index.html` no puede contener el literal `app.js` fuera del `<script src>`** (una prueba lo fija: rompería los tests de orden de carga que usan `indexOf`).
2. **Toda sección `view-section` nueva debe llevar `hidden`** salvo `#home` (guardián `ola-rend-1-secciones-ocultas`). Una pantalla hermana de una familia lleva además `data-nav-family`.
3. **Ninguna entrada principal del menú lleva `data-e17-group`** («Personalizar» oculta por ese atributo) y el `group` de cada entrada de `TASKS` (`e17-experience.js`) debe coincidir con su enlace real
   (guardianes `ola1-menu-por-ritmos` y `ola1-4-personalizar-buscador`).
4. **Muchas pruebas antiguas fijan la etiqueta `<section …>` exacta**: al tocar atributos de una sección, ejecutar `npm test` y ajustar con comentario, sin relajar la intención.
5. **`app.js` no puede crecer** (`arq4-techo-app-js`, 37.530). Si hay que tocarlo: cambio neutro en líneas, reflowar un comentario contiguo, o extraer a un módulo.
6. **Plantilla de PR:** casilla sobre clases de UI nuevas contrastadas con `docs/E19_SISTEMA_DISENO.md` §3. Marcarla solo si es cierta.
7. **Los datos demo** son anonimizados; las cifras de los diagnósticos salen del dataset demo, **no de los datos reales del hogar** — decirlo siempre.
8. **Un `BACKLOG*.md` nuevo debe enlazar a `BACKLOG_INDICE.md` y el índice solo puede tener una fila «🟢 Vigente»** (la que nombra la skill de inicio); un backlog nuevo
   que continúa a otro va como «🟡 Activo» (dos guardianes: `opt20-indice-backlogs` y `proc-skill-alineada-con-claude-md`).

### Herramientas y entorno

- El clasificador de permisos de Bash falló de forma intermitente al arrancar servidores en segundo plano: **servir `dist/` dentro del propio script de Node** (como hace `tools/measure-load.mjs`).
- **No usar `pkill -f "<patrón>"` con un patrón que aparezca en el propio comando** (mata la shell); usar `fuser -k PUERTO/tcp`.
- `cd` persiste entre llamadas: volver a la raíz del repositorio al terminar de trabajar en `dist/`.
- PRs: `subscribe_pr_activity` tras crearlo, una comprobación programada (`send_later`) ~10 min después, y al fusionar: `unsubscribe_pr_activity` y borrar el disparador.

## 7. Orden recomendado para las próximas sesiones

0. **S1 — ✅ hecha (sesión 286).** Extraídas a `canonical-daily-input.js` la función y sus tres ayudantes (166 líneas, no ~110); `app.js` 37.530 → 37.365, techo 37.495; `opt6-mover-cobertura-a-ajustes` y `f1-contrato-ejecutivo-deuda` no necesitaron ajuste. **Un módulo nuevo `canonical-*.js` obliga a: registrarlo en `index.html`, `service-worker.js` y `tools/build-public-site.mjs`, actualizar el recuento de `arq3-canonical-sin-consumidor-ui` (hoy 68) y subir la versión de `app.js` en `index.html` y en las 26 pruebas que la fijan.**
1. **S4 (#425) y S3′ (#426) fusionadas** (`docs/OLA2_RECALIBRACION.md` §3): la ficha «Disponible hoy» (saldo total − suelo) con «A fin de mes (previsión)» (liquidez prevista del motor mensual para el mes de hoy − suelo), la primera de la rejilla de Hoy, con la edad del saldo (S4) y el aviso S-2. **Ahora, con las dos en el sitio:** que el hogar las pruebe (quien solo consulta, dos minutos) y medir la línea base **con tiempos** (2 minutos, 3 intentos). Como S3′ se fusionó sin línea base previa, el «antes» limpio ya no existe: se mide el estado actual y se compara con lo que decida la re-medición. **Límite de la cifra, dicho en el diseño:** da por hechos los reales registrados (una partida pasada y no registrada se cuenta dos veces) y no ve bajadas intermedias antes de cobrar. **Observación abierta:** la línea «Fuente … confianza high» de `readModel.metrics.liquidity` ya no se muestra en Hoy (la ficha antigua se retiró), pero sigue alimentando informes y asistente con «high» aunque el saldo sea antiguo; decidir si el aviso de antigüedad debe rebajarla.
   Después de la prueba: **re-medir con las dos personas** (regla de parada v2: máximo dos entregas visibles de una ola antes de volver a medir; S4 y S3′ son esas dos).
   Regla de parada v2 propuesta: máximo dos entregas visibles antes de re-medir con las dos personas (§8.4).
2. **Si el hogar trae el informe de uso:** entrega 5 de la Ola 1, una pantalla cada vez, con su OK.
3. **Sin nada de los dos:** UX-N2 y UX-N3 (baratos), o UX-P2 si el hogar quiere que el CI sea más exigente. **No** empezar UX-P1/UX-P5: no compensan con los iPhone del hogar.
4. Cierre de sesión: actualizar `PROJECT_STATE.md` y **este documento** (tabla de §1 y las decisiones de §2.1).

## 8. Sesión con el hogar (20 minutos) — cómo salir de los rendimientos decrecientes

**Por qué:** quince sesiones de UX (268–279 y la de O2-1) y **ninguna medida previa en personas**. Todas las métricas de éxito del plan (§5) carecen de línea base, y los dos
desbloqueos que quedan (Ola 2, retiradas de la Ola 1) dependen del hogar, no de código. Construir más sin esto es el patrón que hay que cortar.

### 8.1 Línea base (10 min, con cronómetro)

Cada persona, **en su móvil**, tres intentos:
- **¿Cuánto podemos gastar hasta cobrar?** Cronometrar desde abrir la app hasta decir una cifra en voz alta. Anotar segundos, cifra dicha, si hizo scroll y si las dos personas dicen la
  misma cifra.
- **Registrar un gasto** (quien opera): segundos desde abrir la app hasta guardado.

| Persona | Pregunta | Intento 1 (s) | 2 (s) | 3 (s) | Cifra dicha | ¿Scroll? | ¿Coincide con la otra persona? |
|---|---|---|---|---|---|---|---|
| quien consulta | ¿cuánto hasta cobrar? | | | | | | |
| quien opera | ¿cuánto hasta cobrar? | | | | | | |
| quien opera | registrar un gasto | | | | | | — |

**Umbral propuesto (a fijar por el hogar, no inventado por la medición):** si quien consulta responde en ≲15 s y las dos cifras coinciden, la Ola 2 no tiene un problema que
resolver y se aparca. Si tarda más o las cifras no coinciden, la Ola 2 está justificada y esta tabla es su «antes».

### 8.2 Informe de uso (5 min)

Ajustes › «Uso de la app» **en cada dispositivo** (el contador vive en el navegador de cada uno). Anotar las pantallas con 0 aperturas en cada uno; un cero en un solo dispositivo no
prueba que nadie la use. Con eso se puede abrir la entrega 5 de la Ola 1, pantalla a pantalla.

### 8.3 Decisiones de la Ola 2, formuladas con la evidencia del §2.3 (5 min)

| # | Pregunta concreta | Recomendación | Por qué importa |
|---|---|---|---|
| D1 | Es día 22 y abrís Hoy: ¿qué número esperáis ver? ¿Caja de CaixaBank − suelo − salidas previstas hasta cobrar (definición A), lo que queda del presupuesto del mes, otra? **Que conteste quien consulta** | A | Define el módulo; si quien consulta espera otra cosa, se ajusta una sola función · ✅ **Contestada el 1/10/2026 (por quien opera): ver §8.5** |
| D1b | ¿Cada cuántos días se registran o importan movimientos? | — | Sin movimientos recientes y conciliados las fechas de las salidas son de relleno y la cifra cambia hasta 4.730 € en la demo (§2.3-1) · ✅ **Contestada: extractos 3 veces por semana y registro manual casi diario (§8.5)** |
| D2 | ¿Mediolanum cuenta como gastable? | No: «ahorro aparte» | Cambia el margen · ✅ **Contestada: sí cuenta (§8.5)** |
| D3 | «Carta del mes»: ¿qué esperáis? | Párrafo llano con cifras, **solo si** se define | Sin definir no se construye |
| D4 | Modo consulta: ¿solo nivel 1, sabiendo que no protege? | Sí | El nivel 2 contradice `docs/OPT22_MODELO_HOGAR.md` |
| D5 | En modo consulta, ¿se pliega el detalle de Hoy por defecto? | Sí | Hoy mide ~11.400 px en móvil |
| D6 | Si las fechas son de relleno, ¿el veredicto enseña las dos lecturas con el motivo en una línea, o esconde la cifra? | Enseñar las dos con el motivo | Esconderla repite el «—» sin explicación; darla como cierta engaña · ✅ **Contestada el 1/10/2026: dos lecturas con el motivo (S-5)** |

### 8.4 Regla de parada del plan de UX — **propuesta, no decisión**

No se aplica hasta que el hogar la acepte.
1. Cada entrega declara antes de construirse su métrica y su objetivo (hoy: veredicto a < 700 px y tiempo de respuesta de §8.1).
2. Se mide antes y después **con las dos personas**, no solo con pruebas automáticas.
3. Si la línea base ya cumple el objetivo, o dos entregas seguidas no mueven su métrica, **se detiene el plan de UX** y el esfuerzo pasa a lo que el hogar pida.
4. Sin informe de uso y sin línea base no se abre una ola nueva (Ola 3 y Ola 4 incluidas).

El hogar aceptó la regla «**con ajustes**» (2/10/2026) y pidió que Claude propusiera los ajustes. **Versión 2 propuesta, pendiente de OK:** `docs/OLA2_RECALIBRACION.md` §5 (línea base con tiempos obligatoria; «mover la métrica» = bajar la mediana de quien consulta ≥ 30 % o dejarla en ≤ 15 s; dos entregas visibles seguidas sin moverla detienen el plan; tareas exentas; evidencia con datos reales antes de construir; máximo dos entregas visibles antes de re-medir; reapertura solo por petición del hogar, hallazgo alto de Nielsen o regresión).

### 8.5 Registro de decisiones del hogar — 1 de octubre de 2026

Respuestas dadas **por quien opera la app**. **Decisión del hogar: el paso 1 se consulta con quien opera, no con otra persona.** La premisa de este plan («una persona opera y otra solo consulta, y la que
consulta usa Hoy como producto entero») queda por tanto **sin contrastar con quien solo consulta**: riesgo asumido. Mitigación barata: cuando exista O2-2, quien solo consulta lo prueba 2 minutos.

| Tema | Decisión | Efecto |
|---|---|---|
| **D1 · el número** | **(CaixaBank + Mediolanum) − suelo − compromisos conocidos hasta el próximo cobro** | Sustituye a la definición A del §2.1 (que usaba solo CaixaBank). El módulo `canonical-home-verdict.js` (rama `claude/o2-1-home-verdict`) está **desfasado** y hay que rehacerlo |
| **D2 · Mediolanum** | Sí cuenta: «se puede disponer» | Contradice mi recomendación (ahorro aparte); es la definición del hogar y coincide con «Liquidez hoy» |
| **D1b · frecuencia de datos** | Extractos importados **3 veces por semana** una vez la app esté «cerrada al 100 %»; el día a día se registrará **a mano, casi a diario** | Registrar a mano guarda un importe por partida y mes **sin fecha** (`handleRegistrarMesAddSubmit`): no mejora las fechas de las salidas. Solo los extractos las mejoran, y solo para partidas del mismo mes que casen por etiqueta e importe |
| **Qué es «cobrar»** | Las dos nóminas **y el ingreso del local** | Con el calendario del hogar (1 · 22/25 · último día) la ventana «hasta cobrar» mide ~1, ~24 y ~6 días según el momento del mes (ver §2.3-7) |
| **Tere cobra el 22; la app usa el 25** | **No cambiar, a propósito: es más prudente** | No «corregirlo»: `incomeTimingForRow` (`app.js`) fecha «Nómina/Salario Tere» el día 25 por prudencia |
| **Javi cobra el último día natural, nunca el día 1** | La app usa el último día **hábil** (`lastBusinessDayOfMonth`): fecha la nómina uno o dos días **antes** de lo real en 4 de 12 meses (oct 2026: sáb 31 → vie 30; ene, feb y jul 2027) | ✅ **Aprobado y hecho el 1/10/2026 (sesión 282)**: la regla de la nómina de Javi, el corte de ingresos previos a la nómina y `mainPayrollDate` usan el último día **natural** (`monthEndDate`); sin líneas nuevas en `app.js`; prueba `tests/nomina-javi-ultimo-dia-natural.test.cjs`. **Segundo arreglo, mismo día (sesión 284):** la regla de diciembre (día 15 para cualquier ingreso ≥ 2.500 €) se evaluaba **antes** que la de la nómina y fechaba la nómina de Javi (3.400 €/mes) el **15 de diciembre en vez del 31**, 16 días antes de lo real; ahora la nómina se evalúa primero. La regla del «bonus» del resto de meses no se usa en los datos del hogar y no se toca |
| **El suelo** | **Es sobre el total de las dos cuentas y debe poder parametrizarse** | **Corregido en el diseño (`docs/OLA2_SUELO_Y_DISPONIBLE.md`): no es un cambio transversal.** El parámetro actual ya es un **mínimo operativo de CaixaBank** (~63 líneas de `app.js` y 10 ficheros más lo leen con ese significado, y el barrido de traspasos rescata de Mediolanum si CaixaBank baja de él), y los datasets dorados lo definen sobre la cuenta operativa. Se **añade** un parámetro nuevo, el suelo de liquidez sobre el total, que solo lee el número «disponible»; el existente no cambia de significado ni de cifras |
| **Cierre de mes** | **Recomendación (no confirmada):** mes natural; cierre contable entre el día 1 y el 3 del mes siguiente, con el extracto que cubra el último día y el saldo **del último día del mes**, no el de hoy; la decisión de asignación (gastar/ahorrar/invertir) al cobrar Javi | La app ya trabaja por mes natural (`monthKey` AAAA-MM); un ciclo por nómina no cuadra con dos nóminas y un ingreso el día 1. Comprobar que el cierre usa el saldo de fin de mes (**sin verificar en el código**) |
| **Horizonte del número** | **Aprobado (1/10/2026): mínimo proyectado a 30 días** en lugar de «hasta el próximo cobro» | Sustituye el horizonte de la fila D1. Disponible = saldo total − suelo + el punto más bajo del acumulado de ingresos y salidas fechados en los próximos 30 días. Sin construir; se especifica en O2-1 rehecho y se construye junto con O2-2 (ARQ-3). Dentro del mismo día se aplican **antes las salidas que los ingresos** (criterio prudente) y se declara cuánto depende el signo de ese orden |
| **Suelo sobre el total, con dos parámetros** | **Aprobado abrir el diseño (1/10/2026)**: suelo de liquidez (total) y mínimo operativo en CaixaBank | **Diseño escrito: `docs/OLA2_SUELO_Y_DISPONIBLE.md`.** Pendientes del hogar las decisiones S-1 a S-6 (§9 de ese documento). Hasta contestarlas y hacer la entrega S1 (liberar líneas de `app.js`), el número nuevo de Hoy **no** se construye |
| **Valores iniciales** | **Suelo de liquidez 1.500 €; mínimo operativo en CaixaBank sin tocar (1.500 € en Ajustes); ambos parametrizables** | El 2.500 € que aparecía en mis ejemplos es el valor por defecto del código y de la demo, no el del hogar |
| **Aviso de CaixaBank** | Sí: Hoy avisa si CaixaBank baja de su mínimo operativo aunque el total esté por encima del suelo | Línea secundaria; no cambia el «disponible» |
| **«Bonus» y Hacienda** | No hay bonus mensual. «Hacienda-otros ingresos» (3.000 €) llega sobre el **10/12**; la app la fecha el **15 de diciembre**, y el hogar **lo mantiene** (más tarde es más prudente, como Tere) | Sin cambio de código para esta partida. Corrección de la nómina de Javi en diciembre: ver su fila |
| **Entrega S1** | **Aprobada (1/10/2026)** · ✅ **hecha el 1/10/2026 (sesión 286)** | Refactorización sin cambio de comportamiento; detalle en §7 y en `PROJECT_STATE.md` |
| **S-3 · horizonte** | **Fijo, 30 días, en la primera versión** | Recomendación aceptada |
| **S-4 · nombre** | **«Disponible»**, con el suelo visible al lado | Recomendación aceptada |
| **S-5 / D6 · fechas de relleno** | **Dos lecturas con el motivo** (prudente / si los ingresos van primero) | Recomendación aceptada |
| **Medición con datos reales (2/10/2026)** | `porcentajeEstimado` **100 %**; 0 observadas, 0 por regla; las dos lecturas daban la misma cifra; saldos con 5 días | Estructural: una salida futura no puede ser «observada» (§ `docs/OLA2_RECALIBRACION.md` 2). Corrige D1b: importar extractos no baja el porcentaje de la ventana futura |
| **Regla acordada antes de medir** | Consulta ≤ 15 s; estimado bajo ≤ 25 %, alto ≥ **70 %** (el hogar subió de 60 a 70) | Con 100 %, no construir S3 como estaba |
| **Línea base** | Ninguna de las dos personas encontró la cifra «hasta cobrar» en Hoy (ni quien opera); las cifras no coinciden; **sin tiempos registrados** | Ola 2 justificada por la regla; hay que repetir la línea base con segundos |
| **S2/S3: alcance** | **Delegado en Claude** («recalibrar a lo que creas mejor») | S2 y S3 canceladas tal como estaban; **S4 primero; S3′ después** (`docs/OLA2_RECALIBRACION.md` §3). Sustituye S-3 (horizonte) y S-5 (dos lecturas); mantiene S-4 y S-2 |
| **Regla de parada** | «Con ajustes»; los ajustes los propone Claude | Versión 2 en `docs/OLA2_RECALIBRACION.md` §5, pendiente de OK |
| **`alerts-center`** | **Se deja de momento** (único con 0 aperturas en los dos móviles) | Sin redirigir. Si se retoma, verificar antes que Ajustes cubre todos los umbrales |
| **Lectura «s1, s3, s5, s5»** | **Confirmada**: S1 + S-3 + S-4 + S-5 | Cierra el supuesto de la nota de lectura (S-3 y S-5 después sustituidas) |
| D3, D4, D5 | Sin contestar | — |

> **Nota de lectura:** el hogar escribió «s1, s3, s5, s5»; lo leí como la entrega S1 y las decisiones S-3, S-4 y S-5 con mis recomendaciones (el segundo «s5» sería S-4). Si no era eso, corregir esta fila.

### 8.6 Script de medición con los datos reales (para ejecutar antes de S3)

Abre la app **en el navegador donde el hogar la usa** (es donde viven sus datos), pulsa F12, ve a «Consola» y pega esto. **Es de solo lectura**: no guarda ni envía nada (se comprobó que el estado no cambia). Si Chrome no deja pegar, pide escribir `allow pasting`. No se puede ejecutar en el móvil. `SUELO` es el suelo de liquidez (1.500 € decididos); `DIAS` el horizonte (30 decididos).

```js
(() => {
  // Solo lectura: no guarda ni cambia nada y no envía nada a ningún sitio.
  const SUELO = 1500; // suelo de liquidez (total de las dos cuentas); cámbialo si usas otro
  const DIAS = 30;    // horizonte
  const r2 = (n) => Math.round(n * 100) / 100;
  const hoy = state?.balanceDate || defaultBalanceDate();
  const saldos = accountBalancesFromState(); // { caixa, mediolanum, total }
  const fin = new Date(new Date(`${hoy}T12:00:00Z`).getTime() + DIAS * 86400000).toISOString().slice(0, 10);
  const eventos = (canonicalDailyEngineRuns.active?.rows || []).flatMap((fila) => fila.events || [])
    .filter((e) => e.date > hoy && e.date <= fin && e.kind !== "transfer") // los traspasos entre cuentas no cambian el total
    .map((e) => ({ ...e, delta: e.kind === "income" ? Number(e.amount) : -Number(e.amount) }));
  const fechas = [...new Set(eventos.map((e) => e.date))].sort();
  const recorrer = (salidasPrimero) => {
    let acumulado = 0, minimo = 0, cuando = "—";
    for (const fecha of fechas) {
      const delDia = eventos.filter((e) => e.date === fecha);
      const orden = [...delDia.filter((e) => (e.delta < 0) === salidasPrimero), ...delDia.filter((e) => (e.delta < 0) !== salidasPrimero)];
      for (const e of orden) { acumulado += e.delta; if (acumulado < minimo) { minimo = acumulado; cuando = `${fecha} · ${e.label}`; } }
    }
    return { minimo: r2(minimo), cuando };
  };
  const prudente = recorrer(true);   // dentro de un día, primero las salidas
  const optimista = recorrer(false); // dentro de un día, primero los ingresos
  const salidas = eventos.filter((e) => e.kind === "outflow");
  const total = r2(salidas.reduce((t, e) => t + Number(e.amount), 0));
  const por = (nivel) => r2(salidas.filter((e) => e.confidence === nivel).reduce((t, e) => t + Number(e.amount), 0));
  console.table(eventos.slice(0, 40).map((e) => ({ fecha: e.date, concepto: e.label, tipo: e.kind, importe: e.amount, fiabilidad: e.confidence })));
  console.log(JSON.stringify({
    hoy, hasta: fin, saldoTotal: saldos.total, saldoCaixaBank: saldos.caixa, saldoMediolanum: saldos.mediolanum, sueloDeLiquidez: SUELO,
    disponible_prudente: r2(saldos.total - SUELO + prudente.minimo), puntoMasBajo_prudente: prudente.cuando,
    disponible_siIngresosPrimero: r2(saldos.total - SUELO + optimista.minimo),
    elSignoDependeDelOrden: (saldos.total - SUELO + prudente.minimo < 0) !== (saldos.total - SUELO + optimista.minimo < 0),
    salidasEnElHorizonte: total, importeObservado: por("observed"), importePorRegla: por("rule"), importeEstimado: por("estimated"),
    porcentajeEstimado: total ? Math.round((por("estimated") / total) * 100) + " %" : "sin salidas en el horizonte",
  }, null, 2));
})();
```

Cómo leerlo:
- **`porcentajeEstimado`** es lo que más importa: el porcentaje de las salidas del horizonte cuya fecha es de relleno (día 8). Alto = el «disponible» no es fiable (§2.3-1); bajo = lo es.
- **`disponible_prudente`** (dentro de un día, primero las salidas) frente a **`disponible_siIngresosPrimero`**: si el signo cambia (`elSignoDependeDelOrden`) o la diferencia es grande, la cifra depende de un supuesto de calendario y la pantalla debe mostrar las dos lecturas (S-5).
- En el dataset demo da 3.580 € frente a 8.310 € y `porcentajeEstimado` del 100 %: cifras de la demo, **no del hogar**.
- No pegar en el repositorio público los resultados con importes reales.

## 9. Pendiente al cierre de la sesión 287 (2 de octubre de 2026)

> **Actualización de la sesión 290:** las preguntas abiertas al hogar están **consolidadas, numeradas y con mi recomendación en `docs/OLA2_RECALIBRACION.md` §7**. Esta tabla queda como histórico de la sesión 287.

| Qué | Estado | Quién |
|---|---|---|
| **S1** liberar líneas de `app.js` | ✅ Hecha (sesión 286) | — |
| S2, S3, S4 | **Recalibradas el 2/10/2026** (`docs/OLA2_RECALIBRACION.md` §3): **S4 primero** (fusionada el 2/10, #425), después **S3′** (fusionada el 2/10, #426); S2 se funde con **S3′** (margen de Hoy sin dependencia de fechas); S3 original cancelada | Código |
| Medir `porcentajeEstimado` con datos reales (§8.6) | ✅ Hecho el 2/10/2026: **100 %** | — |
| **Regla de parada del plan de UX** (§8.4) | «Con ajustes»; **versión 2 propuesta** en `docs/OLA2_RECALIBRACION.md` §5 | El hogar (OK) |
| Línea base cronometrada (§8.1) e informe de uso por dispositivo (§8.2) | Hecho el 2/10/2026 **sin tiempos** (no encontraron la cifra): **repetir con segundos** antes de la primera entrega visible. Informe: solo `alerts-center` a 0 en los dos móviles; el resto, posiblemente inflado por la propia sesión | El hogar |
| D3 (carta del mes), D4 (modo consulta nivel 1), D5 (pliegue del detalle en modo consulta) | Sin contestar; no bloquean S1–S4 | El hogar |
| Cierre de mes: recomendación de mes natural, cierre entre el día 1 y el 3, saldo del último día (§8.5) | **Recomendación sin confirmar**; falta verificar en el código que el cierre use el saldo de fin de mes | El hogar / código |
| Suelo sobre el total: mínimo operativo en CaixaBank y suelo de liquidez | Valores decididos (1.500 € los dos); **la entrega S3′ crea el suelo** (absorbe S2) | Código (S3′) |
| PR #416 (módulo aparcado y desfasado) | ✅ **Cerrado sin fusionar el 2/10/2026**; la rama se conserva solo como referencia | — |
| ¿Saldos actualizados después del 27/9? ¿Nómina del 30/9 recogida? | Sin respuesta | El hogar |
| Revisión mensual de Nielsen (`OPT-21`) | La última fue el 16/09/2026: **vence el 16/10/2026** | Quien abra esa sesión |
| `OPT-10`–`OPT-13` | Aplazadas al 23/10/2026 y a la conversación de uso real del hogar | El hogar |
| Premisa «quien consulta usa Hoy como producto entero» | **Sin contrastar** (todo lo contestó quien opera); mitigación: que quien solo consulta pruebe S3 dos minutos | El hogar |
