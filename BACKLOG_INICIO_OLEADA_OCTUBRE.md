# Backlog `inicio_oleada_octubre` — todo lo pendiente, en un solo documento

Creado el **2 de octubre de 2026 (sesión 292)**, a petición del hogar: «cierra y fusiona todo lo pendiente de los backlogs que tenemos en uno único».
**Es la única fuente viva de lo que falta por hacer.** Los demás `BACKLOG*.md` no se han borrado ni reescrito: conservan el detalle de por qué se hizo cada cosa
y llevan un aviso en su cabecera que apunta aquí. Mapa de todos ellos: [`BACKLOG_INDICE.md`](BACKLOG_INDICE.md). Estado maestro de las entregas E1-E26:
`BACKLOG_STATUS.md` §0 (no cambia).

Autocontenido a propósito: quien lo abra sin haber visto la conversación debe poder decidir qué hacer primero en 10 minutos.
**Regla de lectura: lo que contradiga a un backlog antiguo, manda este documento** (§12 lista lo que quedó desfasado en los antiguos).

## 0. Estado en una línea

**No hay nada que construir hasta tener el diagnóstico de «no la encontró».** La Ola 2 entregó tres cambios visibles en Hoy (S4, S3′, S5; máximo permitido por la regla v2: dos),
y la métrica sigue sin cumplirse: quien consulta tardó **30, 28 y 20 s** y **no encontró la cifra** (objetivo: ≤ 15 s y la misma cifra). Lo que queda es esperar al hogar,
una comprobación mía sobre el cierre de mes (§3, C2) y vigilar las condiciones externas. Premisa de producto aún sin contrastar: «quien consulta usa Hoy como producto
entero» (todo lo contestó quien opera, salvo la medición de 30/28/20 s).

## 1. Cómo empezar la próxima sesión (10 minutos)

1. Leer este documento y, de `PROJECT_STATE.md`, las entradas **288 a 292**.
2. `git status`, `git log --oneline -5`; la rama de trabajo parte de `origin/main` (receta en §11).
3. Mirar §2: **¿ha contestado el hogar?** Si sí, aplicar el árbol de decisión de §4 y proponer solo el arreglo mínimo. Si no, no construir nada sobre Hoy.
4. Sin respuesta del hogar, lo único legítimo es lo exento por la regla v2 (§10) y los avisos de calendario (§9).
5. Antes de cerrar: validar, actualizar `PROJECT_STATE.md` con cifras reales y **este documento**, commit/push, PR en borrador, esperar CI, fusionar en verde.

## 2. Esperan al hogar (lo único que desbloquea algo)

| ID | Qué | Quién | Por qué importa |
|---|---|---|---|
| **H1** | **Diagnóstico de «no la encontró»**: cuatro respuestas cortas, **en el chat, no en el repositorio** (qué decía con sus palabras la primera tarjeta; qué cifra dijo cada persona; si abrió la app desde el icono de inicio o desde Safari; si el cronómetro incluía la carga) | Quien consulta y quien opera | Discrimina entre las cuatro hipótesis de `docs/OLA2_RECALIBRACION.md` §8.1 (versión vista por la caché, tiempo de carga, saldo antiguo, vocabulario). Decide si se construye algo o se detiene el plan de UX |
| **H2** | Actualizar saldos (último declarado: 27/9), comprobar si la nómina del 30/9 está registrada como real y **repetir la medición una vez** con la app recién recargada, anotando qué mira quien consulta | Quien opera, luego quien consulta | La cifra da por hechos los reales registrados: una partida pasada y no registrada se cuenta dos veces. Con 5 días de antigüedad el aviso de S4 puede estar dominando la lectura |
| **H3** | D4 (modo consulta nivel 1: «comodidad, no protección») y D5 (plegar el detalle de Hoy por defecto en modo consulta) | Quien consulta (el operador ya dijo Sí/Sí) | Sin su respuesta no se construye; además es la persona a la que van dirigidos |
| **H4** | Tiempo de **registrar un gasto** desde el móvil (3 intentos) | Quien opera | Es la métrica de la Ola 3 y no tiene línea base |
| **H5** | **Decidir qué hacer con el cierre de mes** (hallazgo C2 de §3): el cierre real no guarda saldo y cierra el mes en curso | El hogar | Lo acordado el 2/10 (mes natural, cierre entre el 1 y el 3, saldo del último día) **no es lo que hace hoy la app** |
| **H6** | Cola B (§7) y `OPT-10`–`OPT-13` (§6): contestar si el uso ha sido **intenso** (no basta el calendario) | El hogar | Antes del 23/10/2026. Sin esa respuesta no se activa ni se retira nada |

## 3. Del lado de Claude, sin bloqueo

| ID | Qué | Estado |
|---|---|---|
| C1 | Confirmar el despliegue de #429 (`c6f4a5e`) | Se confirma con el despliegue del PR que fusiona este documento (contiene #429) |
| **C2** | **Verificar que el cierre de mes usa el saldo del último día (pregunta 10 de la ola)** | **Verificado el 2/10/2026: NO lo hace.** `closeCurrentMonthTransaction` (`app.js`) cierra `openMonthCutoffKey()` = **el mes de hoy**, y `closeMonth` (`canonical-month-close.js`) guarda solo los reales del mes, motivo, autor y los asientos de sobres: **ningún saldo bancario**. Consecuencias: (a) cerrar «entre el día 1 y el 3» cerraría el mes que empieza, no el que acaba (los meses pasados se consideran cerrados implícitamente por `isClosedMonthKey`, pero sin firma); (b) el saldo de fin de mes no queda fijado, así que no hay con qué cuadrar el cierre ni comparar la previsión de S3′ con la realidad. **No se cambia sin decisión (H5): modifica una operación firmada y transaccional (`close_finance_month`).** Propuesta: guardar en el cierre el saldo declarado por cuenta y su fecha, y permitir cerrar el mes anterior; con prueba y sin tocar el RPC existente |
| C3 | Observación del backlog UX: la confianza de la liquidez alimentaba informes con «high» aunque el saldo fuera antiguo | ✅ Hecha (P9, #429): desde 4 días baja a «media» |

## 4. Congelado por la regla de parada v2 (aprobado, no se construye)

Regla v2 (aprobada por el hogar el 2/10/2026): la métrica se declara antes y se mide con las dos personas; **mover la métrica = bajar la mediana de quien consulta ≥ 30 % o dejarla en ≤ 15 s con la misma cifra**;
máximo **dos entregas visibles por ola**; si dos seguidas no la mueven, **se detiene el plan de UX**; exentos: arreglos de datos/cálculo, refactorizaciones habilitadoras, deuda de CI/rendimiento y accesibilidad;
se reabre solo por petición del hogar, hallazgo alto de Nielsen o regresión de la línea base.

| Qué | Estado | Se descongela cuando |
|---|---|---|
| **P12** — plegar a una línea el bloque «DATO REAL / LOCAL / Fuente» en móvil | Aprobado por quien consulta | Hay diagnóstico (H1) y se decide que sigue haciendo falta |
| **Carta del mes** | Aprobada; alcance delegado en Claude: **un párrafo determinista en Cierre de mes** (no en Hoy), sin IA generativa | Hay diagnóstico, informe de uso y **cierre de mes resuelto (H5)**, porque se apoyaría en él. Cuidado: `app.js` tiene **82 líneas de margen** — exigiría extraer código antes |
| **Modo consulta nivel 1** y **plegar el detalle** (D4/D5) | Esperan a H3 | H3 respondida y diagnóstico hecho |
| Cualquier otra entrega visible sobre Hoy | Cupo de la Ola 2 agotado (3 de 2) | Re-medición con las dos personas |

**Árbol de decisión cuando llegue H1** (mínimo cambio en cada caso):
1. *Veían una versión anterior* (la caché del service worker es «primero caché»; la primera apertura tras un despliegue muestra la versión previa): aviso opcional de «hay versión nueva». Es lo único que justificaría tocar el service worker.
2. *El cronómetro incluía la carga* (4,5 s repetida, 9,6 s primera visita con móvil lento emulado): no es de diseño; mirar `test:load-budget`, no la tarjeta.
3. *Saldo antiguo / negativo / aviso leído como error*: actualizar saldos (H2) y repetir antes de tocar nada.
4. *Vocabulario* («hasta cobrar» frente a «Disponible para gastar»): cambio de texto de una línea, el más barato de todos.
5. *Ninguna*: **detener el plan de UX** según la regla; es un resultado válido, no un fracaso.

## 5. Condicionado por terceros (sin trabajo propio hoy; vigilar)

| Tarea | Qué falta | Condición | Detalle |
|---|---|---|---|
| `RGX3`, `DEX6` | Construirlas | `A5-1` (IA) en producción real | `BACKLOG_ULTIMATE_SEPTIEMBRE_OLEADA_2.md`, 2.0 §7 |
| `GOB5` | Construirla | `A5-4` (push) en producción real | `BACKLOG_ULTIMATE_SEPTIEMBRE_OLEADA_3.md` |
| `P4` (dígesto semanal de reforecast), `P10` de la 2.0 (ajustar un supuesto en una frase) | Interinas | `A5-4` y `A5-1` | `BACKLOG_CONTABILIDADCASA_2_0.md` §1 (**ojo: no confundir con la pregunta 10 de la Ola 2**) |
| `O-6` | Contratar proveedor PSD2 (candidato: GoCardless) | Decisión de contratación | `BACKLOG_OPERACION.md` |
| Copiloto/IA — pantalla de UI | Construir UI nueva desde cero (la sesión 42 retiró el único llamador de `prepareQuery`/`validateResponse`) | `A5-1` en producción real | 2.0 §7 |

Las tres condiciones externas (`A5-1`, `A5-4`/push, PSD2) siguen sin cumplirse a 2/10/2026. Re-verificarlas antes de asumir que alguna sigue bloqueada.

## 6. Aplazado o aparcado por decisión del hogar

| Qué | Decisión | Se retoma si |
|---|---|---|
| `OPT-10`–`OPT-13` (retirar pantallas por falta de uso) | Aplazadas al **23/10/2026** y a uso intenso (sesión 240). Una pantalla de uso menos que mensual (fiscal, informes trimestrales, cierre anual) **no** se declara «sin uso» con 30 días | H6 contestada. `OPT-15` está anulada (la sustituyó `OPT-25`) |
| Entrega 5 de la Ola 1 (retiradas: `alerts-center`, `visual-detail`, `savings-agent`, `conciliar`, `executive-advisor`, `virtual-advisor`, `debt-roadmap`, `debt-liquidation-plan`, `debt-control`) | Mecanismo: **redirigir sin borrar código**. Solo con informe de uso y OK pantalla a pantalla. Informe del 2/10: únicamente `alerts-center` con 0 aperturas en los dos móviles; el hogar decidió **dejarla de momento** (si se retoma, verificar antes que Ajustes cubre todos los umbrales). `registrar-mes` no se toca | El hogar abre el informe en cada dispositivo y da su OK |
| `NAV-3` (recorrido de onboarding de Hoy/Registrar/Plan) | Aparcada el 25/9/2026 | Aparece alguien sin contexto que deba entrar |
| `ARQ-4` — Visual Detail (única pantalla sin extraer de `app.js`) | «Dejar donde está» (sesión 238): la de más riesgo (cambios en borrador) y sin efecto visible | El hogar lo pide o hay que tocarla por otro motivo |
| `I3` (mapa de calor de correlación) | Necesita historial real de valoraciones de `I2` | `I2` acumula historial |
| `I6` (fiscalidad de cripto/derivados/intradía) | Sin posiciones de ese tipo hoy | Cambia la cartera |

## 7. Cola B — en espera de señal de uso real

21 mejoras y 21 funcionalidades de la cuarta auditoría (artefacto «Contabilidadcasa — Auditoría crítica y propuesta de mejoras», Partes A y B) **no se numeran ni se activan**.
Condición: contador de uso corriendo (cumplida; informe «Uso de la app» en Ajustes) **y** conversación explícita del hogar sobre qué pantallas se abren de verdad (H6). Pospuesta el 23/9 por falta de uso intenso.
Si se activa, priorizar visualización y consistencia sobre lo especulativo (simulador de reubicación, widget nativo, modo demostración). Criterio de entrada (`PROC-1`): toda propuesta nueva cita **uso real o petición explícita del hogar**.

## 8. Deuda técnica y de rendimiento (ninguna es urgente con los iPhone del hogar)

| ID | Qué | Importa | Recomendación |
|---|---|---|---|
| **UX-P4** | `app.js` con **82 líneas de margen** (37.413 con techo 37.495; `tests/arq4-techo-app-js.test.cjs`, con trinquete) | **Es el límite real**: cualquier cambio en `app.js` debe ser neutro en líneas o extraer código | Antes de cualquier entrega que lo toque, extraer (patrón de `canonical-daily-input.js`) |
| UX-P1 | LCP real de primera visita en móvil lento ≈ 8 s | Solo primeras visitas y móviles lentos | Partir `app.js` (varias sesiones). **No** hacerlo |
| UX-P2 | Lighthouse agrega con `optimistic` (mejor valor de cada métrica por separado) | Un LCP/TBT malo podría taparse | Cambiar a mediana + revisar umbrales: **decisión del hogar, cambia lo que promete el CI** |
| UX-P3 | `test:load-budget` no mide WebKit ni un iPhone real | Protege de regresiones grandes, no mide vuestra experiencia | Medir con Safari en un iPhone solo si se nota lentitud |
| UX-P5 | Arranque ~480 ms sin frenar (modelo ~210 ms, pintar Hoy ~185 ms) | Solo móviles lentos | Aparcado: riesgo medio-alto (cifras erróneas si la memoria se invalida mal) |
| UX-P6 | `markScrollableTableWraps` (~56 ms) tras cada cambio del DOM | Marginal | No compensa |
| UX-P7 | Cada despliegue cambia `CACHE_NAME`: ~600 KB de descarga en segundo plano | Datos y batería | Bajo valor |
| UX-N1 | «Herramientas avanzadas» no se cierra solo al cambiar de pantalla | Estético | Toca `app.js` |
| UX-N2 | En Simular la insignia «Modo simulación · nada se guarda» se parte en 4 líneas | Estético | CSS. No es exenta de la regla v2: no hacerla sin motivo |
| UX-N3 | Enlace duplicado «Escenario · simular» en el menú avanzado | Redundante | Implica ajustar pruebas de la entrega 1. Ídem |
| UX-N4 | Menú declarado como datos (D9) aplazado | Solo si el modo consulta lo exige | Reconsiderar con H3 |

Ideas aparcadas sin ID: script que infiera el día de cargo de cada partida a partir del histórico (cuando haya ≥ 3 meses de movimientos importados; pregunta 14 de la ola, respondida «Sí»);
aviso opcional «hay versión nueva» para el service worker (solo si H1 confirma el caso 1 de §4); bajadas intermedias antes de cobrar (la cifra de Hoy no las ve; depende de fechas, que son 100 % estimadas).

## 9. Calendario

| Fecha | Qué |
|---|---|
| **16/10/2026** | Revisión mensual de Nielsen (`OPT-21`, `docs/OPT21_CHECKLIST_NIELSEN.md`). La última fue el 16/09/2026; la skill la marca como vencida a los 30 días. Sin informe de uso nuevo |
| **23/10/2026** | Re-evaluación de `OPT-10`–`OPT-13` y de la Cola B, condicionada a H6 |

## 10. Olas 3 y 4 y lo que sí se puede hacer sin permiso

- **Ola 3** (Registrar y captura: rediseño de Registrar, captura en móvil, importador de un gesto, revisión semanal guiada; métrica: tiempo por gasto desde el móvil) y **Ola 4** (¿me puedo permitir X?, objetivos visuales, acta de reunión, motivación de deuda, cuentas claras en pareja)
  **no se abren**: la regla exige línea base e informe de uso, y la Ola 2 aún no cumple su métrica. «Cuentas claras en pareja» necesita antes un campo explícito de titular (`inferOwner` es una etiqueta inferida por texto; `docs/OPT22_MODELO_HOGAR.md`: no construir control de acceso por persona).
- **Exento de la regla v2** (puede hacerse sin esperar): arreglos de datos o cálculo (p. ej. C2 una vez decidido H5), refactorizaciones habilitadoras (p. ej. liberar líneas de `app.js`), deuda de CI/rendimiento, accesibilidad.

## 11. Reglas vigentes y recetas verificadas

**Flujo (`CLAUDE.md`, autorización del 10/8/2026):** validar → actualizar `PROJECT_STATE.md` con cifras reales → commit/push a la rama de trabajo → PR **en borrador** → esperar CI → fusionar en verde (squash), sin preguntar.
**Frenos:** nunca fusionar en rojo ni forzar; nunca push directo a `main`; nunca `finanzas-casa-def`; consultar antes de ir más allá de lo pedido, borrar datos del usuario o retirar una pantalla en uso; **nunca cambiar umbrales de CI ni relajar una prueba para verde**.
**El repositorio es público: ninguna cifra real del hogar en el repositorio** (solo porcentajes o cualitativo; los importes, en el chat o en el artefacto privado).

**Reiniciar la rama tras una fusión por squash.** El `push --force-with-lease` lo deniega el entorno y no se esquiva. Patrón que funciona: commit local → `git checkout -B <rama> origin/<rama>` → `git merge --no-edit origin/main` → `git cherry-pick <commit>` → comprobar que `git diff --stat <commit> HEAD` está vacío → `git push -u origin <rama>` normal.

**Validación:** `npm run verify` (~4 min). Puertas de navegador del CI fuera de `verify`: `test:performance-lh`, `test:load-budget`, `test:mobile-overflow`, `test:e2e`, `test:a11y-axe`, `test:perf-screens`. En el contenedor: Chromium en `/opt/pw-browsers/chromium` (`PLAYWRIGHT_CHROMIUM_PATH` para `tools/measure-load.mjs`); los scripts que usan `@playwright/test` se ejecutan desde la raíz. `github.io` no es accesible desde el contenedor. `mcp__github__actions_list` ignora filtros y vuelca ~57 k caracteres a un fichero: extraer con Python.

**Trampas (cada una costó una vuelta):**
1. `index.html` no puede contener el literal `app.js` fuera del `<script src>`; el sello `app.js?v=` y `design-tokens.css?v=` están fijados en `index.html` y en ~27 pruebas (subir con una expresión regular sobre `tests/*.cjs`). Hoy: `20261002s5a1`.
2. Toda `view-section` nueva lleva `hidden` salvo `#home`; las hermanas de familia llevan `data-nav-family`. Ninguna entrada principal del menú lleva `data-e17-group`.
3. Muchas pruebas fijan la etiqueta `<section …>` exacta o leen **ventanas fijas de caracteres** de una función (p. ej. `saveScenarioSettings`: los campos nuevos van al final del objeto). Las pruebas extraen funciones de `app.js` por nombre a un `vm`: una dependencia nueva dentro de una función extraída exige añadir su stub en esos entornos (`homeMarginTile`, `homeDataAge`).
4. **Módulo `canonical-*.js` nuevo:** registrarlo en `index.html` (antes de `app.js`), `service-worker.js` (`SHELL_URLS`) y `tools/build-public-site.mjs`; subir el recuento de `arq3-canonical-sin-consumidor-ui` (hoy **70**) y darle un consumidor real en `app.js` (guardián ARQ-3, sin excepciones).
5. `app.js` no puede crecer (techo 37.495, con trinquete: si baja más de 300 líneas, el mismo PR baja el techo).
6. Plantilla de PR: marcar la casilla de clases de UI nuevas solo si es cierta. Los datos demo son anonimizados: **decir siempre si una cifra es de la demo o del hogar**.
7. **Un `BACKLOG*.md` nuevo** debe enlazar a `BACKLOG_INDICE.md`, el índice solo puede tener **una** fila «🟢 Vigente» y la skill `finanzas-casa-workflow` (Modo Inicio, paso 2) debe nombrarla (guardianes `opt20-indice-backlogs` y `proc-skill-alineada-con-claude-md`).
8. Service worker «primero caché» (`skipWaiting` + `clients.claim`): **la primera apertura tras un despliegue muestra la versión anterior**.
9. No usar `pkill -f "<patrón>"` con un patrón que aparezca en el propio comando; usar `fuser -k PUERTO/tcp`. Servir `dist/` dentro del propio script de Node.
10. Tras crear un PR: `subscribe_pr_activity` y, al fusionar, `unsubscribe_pr_activity`.

**Semántica de la cifra de Hoy (no rehacer):** «Disponible para gastar» = el menor de *Disponible hoy* (saldo total − suelo) y *A fin de mes* (liquidez prevista de la fila del mes de hoy − suelo). Suelo de liquidez por defecto 1.500 € (parámetro nuevo en Ajustes, sobre el **total**; el mínimo operativo de CaixaBank no cambia de significado). Aviso si CaixaBank baja de su mínimo aunque el total esté por encima del suelo.
Límites declarados: da por hechos los reales registrados y no ve bajadas intermedias antes de cobrar. El motor diario no se usa (sus fechas de salida son 100 % estimadas, estructural). Frescura: aviso desde 4 días (modo manual); modo automático nunca caduca.

## 12. Lo que quedó desfasado en los backlogs antiguos (no actuar sobre ello)

| Documento | Dice | Realidad a 2/10/2026 |
|---|---|---|
| `BACKLOG_UX_OLAS.md` §0 | Leer las entradas 285, 284 y 283 | Las vigentes son 288–292 |
| `BACKLOG_UX_OLAS.md` §2.1, §8.5 (última fila), §9 | D3, D4, D5 «sin contestar»; regla v2 «pendiente de OK»; cierre de mes «sin confirmar»; línea base «sin tiempos» | D3 contestada (la quieren; alcance delegado); D4/D5: Sí del operador, falta quien consulta (H3); regla v2 **aprobada**; cierre de mes confirmado como criterio pero **no implementado** (C2); hay tiempos (30/28/20 s) |
| `BACKLOG_UX_OLAS.md` §6 | Techo de `app.js` 37.530; receta con `--force-with-lease` | Techo 37.495; ese `push` está denegado (receta en §11) |
| `BACKLOG_UX_OLAS.md` §7 | «Que el hogar pruebe S4 y S3′ y medir» | Ya ocurrió: lo que toca es el diagnóstico (H1) |
| `BACKLOG_UX_OLAS.md` UX-P4 | ~130 líneas de margen | 82 |
| `BACKLOG_CONTABILIDADCASA_3_0.md` §5–§6 | Lista como pendientes `I5`, `T9`, `D1`, `D6`, `I13` | Cerradas (sesiones 223, 239, 255-257, 254, 248) |
| `BACKLOG_CONTABILIDADCASA_3_0.md` §8 | «No queda trabajo accionable sin condición» | Sigue siendo cierto para el producto; lo accionable ahora es de UX y está aquí |
| `BACKLOG_INDICE.md` | `BACKLOG_CONTABILIDADCASA_3_0.md` era la fila «🟢 Vigente» | Lo es este documento; el 3.0 queda como detalle (🟡 absorbido) |

## 13. Dónde está el detalle de cada cosa

| Tema | Documento |
|---|---|
| Ola 2: diagnóstico, medición real, recalibración, 14 preguntas y respuestas, hipótesis de «no la encontró» | `docs/OLA2_RECALIBRACION.md` (§7 preguntas, §8 respuestas y diagnóstico) |
| Diseño del suelo y del «disponible» | `docs/OLA2_SUELO_Y_DISPONIBLE.md` |
| Diagnóstico original de Hoy y modo consulta | `docs/OLA2_HOY_Y_CONSULTA.md` |
| Arquitectura de navegación (Ola 1, camino B, entrega 5) | `docs/OLA1_ARQUITECTURA_NAVEGACION.md` |
| Registro de decisiones del hogar del 1/10/2026 y script de medición con datos reales | `BACKLOG_UX_OLAS.md` §8.5 y §8.6 |
| Lo que enseñó construir `canonical-home-verdict.js` (módulo descartado, PR #416 cerrado) | `BACKLOG_UX_OLAS.md` §2.3 |
| Hecho de las olas 0 a 2 con sus PRs (#405–#429) | `BACKLOG_UX_OLAS.md` §1 |
| Tareas y cierres del producto (`ARQ`, `PER`, `NAV`, `FLU`, `FIN`, `PROC`, 2.0) | `BACKLOG_CONTABILIDADCASA_3_0.md`, `BACKLOG_CONTABILIDADCASA_2_0.md` |
| Oleadas de septiembre, Operación, Sucesión, Optimización | `BACKLOG_ULTIMATE_SEPTIEMBRE*.md`, `BACKLOG_OPERACION.md`, `BACKLOG_SUCESION_Y_CONTINUIDAD.md`, `BACKLOG_OPTIMIZACION.md` |
| Registro sesión a sesión | `PROJECT_STATE.md` |
