# Backlog del plan de mejora de UX por olas — para retomar en otra sesión

Creado el 30 de septiembre de 2026 (sesión 279), al cierre de una sesión larga. **Fuente viva del plan de UX** (olas 0 a 4) y de la
deuda de rendimiento y navegación que dejó. Autocontenido a propósito: quien lo abra sin haber visto la conversación debería poder
decidir qué hacer primero en 10 minutos. El detalle histórico de cada cosa vive en `PROJECT_STATE.md` (sesiones 268–278) y en los
documentos de diseño enlazados.

Su lugar en el mapa de backlogs: `BACKLOG_INDICE.md` (eje de UX del backlog vigente `BACKLOG_CONTABILIDADCASA_3_0.md`, no lo sustituye).

Origen del plan: análisis de producto pedido por el hogar (UX/UI, experiencia de uso y funcionalidades, **sin foco tecnológico**),
recogido en `BACKLOG_CONTABILIDADCASA_3_0.md` §9. **Dato del hogar que condiciona todo: dos personas; una registra y opera
(intensa) y la otra solo consulta; la que consulta usa Hoy como producto entero.** Móviles: **iPhone 17 e iPhone 15 Pro** (rápidos).

## 0. Cómo empezar la próxima sesión (10 minutos)

1. Leer este documento entero y, de `PROJECT_STATE.md`, solo las entradas **278, 277 y 276** (arriba del todo).
2. `git status` y `git log --oneline -5`; comprobar que la rama de trabajo parte de `origin/main` (§6, «reiniciar la rama»).
3. **No construir nada de la Ola 2 sin las cinco decisiones del hogar** (§2). Si el hogar ya contestó, pasar a §2.2.
4. Si el hogar aún no ha contestado, la única cosa útil sin bloqueo es **§4 (deuda técnica)** y, si el informe de uso existe, **§3**.
5. Antes de cerrar: validar, actualizar `PROJECT_STATE.md` con cifras reales, commit/push, PR en borrador, esperar CI, fusionar en verde (§6).

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

**Decisiones del hogar vigentes** (30/09/2026 salvo indicación): camino B; retirar pantallas = **«redirigir sin borrar código»**; «avanza sin el
informe, solo agrupando» (no retirar sin informe y OK); Escenarios con **cuatro** destinos; los pasos del flujo de Escenarios resaltan
«Escenarios» y dentro de Presupuesto/Esta semana/Partidas el menú marca «Plan»; rendimiento **opción 1**; Registrar se rediseña **después de la
Ola 1**. Ver también `docs/OPT22_MODELO_HOGAR.md` (29/08/2026): **no construir control de acceso por persona** sobre el modelo actual.

## 2. Ola 2 — Hoy con veredicto y modo consulta (BLOQUEADA por decisiones del hogar)

Diseño completo y datos en `docs/OLA2_HOY_Y_CONSULTA.md`. Resumen del diagnóstico (dataset demo, no datos reales): Hoy da **ocho cifras** de «cuánto me
sobra» con cuatro problemas verificados (duplicado «Liquidez hoy» = «Caja disponible»; negativo −1.090 € recortado a «0,00 € por encima»; «Reserva protegida:
fuera de umbral» frente a «Próximo riesgo: sin déficit»; el margen «hasta el siguiente ingreso» vacío). La respuesta empieza a ~1.246 px en móvil
(~987 px sin el aviso de primeros pasos).

### 2.1 Decisiones que faltan (cada una con mi recomendación)

| # | Pregunta al hogar | Recomendación |
|---|---|---|
| D1 | ¿Qué es «el número»? | Caja de CaixaBank − suelo de reserva − **salidas ya previstas hasta el próximo ingreso** (definición A del diseño) |
| D2 | ¿Mediolanum cuenta como gastable? | No: «ahorro aparte» en una línea |
| D3 | «Carta del mes»: ¿qué esperan? | Un párrafo llano con las cifras del mes, sin IA generativa; **solo si** se define, y después del veredicto |
| D4 | Modo consulta | **Solo nivel 1** (preferencia de este dispositivo; **no protege**). El nivel 2 (`viewer` real) contradice OPT-22 |
| D5 | ¿Se pliega el detalle de Hoy por defecto en modo consulta? | Sí (Hoy mide 11.400 px en móvil) |

### 2.2 Entregas (empezar por la 1 cuando D1 y D2 estén contestadas)

| Entrega | Contenido | Hecho cuando | Riesgo |
|---|---|---|---|
| **O2-1** | Módulo `canonical-home-verdict.js`: cálculo puro de la cascada y estados honestos (negativo dicho, dato que falta nombrado). **Sin cambiar la pantalla** | Pruebas contra los datasets dorados (`npm run golden:datasets`); `app.js` sin líneas nuevas; **medir cuántas líneas se pueden liberar** de la tarjeta de cobertura (~`app.js` 21.657–21.810; estimación 60–100, sin verificar) | Bajo |
| **O2-2** | La tarjeta oscura «Hasta el siguiente ingreso» pasa a ser el veredicto (misma posición); se quita el duplicado Liquidez/Caja; el margen sobre la reserva se muestra **con signo**; «Próximo riesgo» dice fecha y base | `verify` verde + e2e + axe + `mobile-overflow`; un test que fije que el duplicado no vuelve | Medio: es la pantalla más vista |
| **O2-3** | Frescura del dato pegada a la cifra («saldos a … · último movimiento hace N días · guardado hh:mm») | Prueba de navegador: **veredicto < 700 px en 390×844 sin desplazarse** (hoy ~1.246 px) | Bajo |
| **O2-4** | Modo consulta nivel 1 (interruptor por dispositivo en `localStorage`, oculta escrituras, simplifica menú, reutiliza «Modo reunión» y «Vista por titular») | Interruptor visible con la leyenda «comodidad, no protección»; guardián de que ninguna entrada principal desaparece | Medio |
| **O2-5** | «Carta del mes» | Solo si D3 la define | Bajo |

**Trampa conocida:** `requiredReserve` (`canonical-decisions.js`, `transferForMonth`) = suelo **+ las salidas de todo el mes siguiente**; sirve para decidir
traspasos a ahorro, **no** como base de «cuánto se puede gastar». No reutilizarla.

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
| **UX-P4** | **`app.js` sigue en su techo (37.530 líneas)**, sin margen (`tests/arq4-techo-app-js.test.cjs`) | Cualquier cambio en `app.js` debe ser neutro en líneas o extraer código | O2-1 mide cuánto se libera; si no basta, plan de extracción como en la entrega 4 de la Ola 1 |
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

1. **Si el hogar contesta D1–D5:** O2-1 → O2-2 → O2-3 (una entrega por PR; medir siempre `test:load-budget` antes y después) → O2-4.
2. **Si el hogar trae el informe de uso:** entrega 5 de la Ola 1, una pantalla cada vez, con su OK.
3. **Sin nada de los dos:** UX-N2 y UX-N3 (baratos), o UX-P2 si el hogar quiere que el CI sea más exigente. **No** empezar UX-P1/UX-P5: no compensan con los iPhone del hogar.
4. Cierre de sesión: actualizar `PROJECT_STATE.md` y **este documento** (tabla de §1 y las decisiones de §2.1).
