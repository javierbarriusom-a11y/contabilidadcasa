# Estado del proyecto

Fecha de revisión: 12 de septiembre de 2026.

## Índice de decisiones vigentes (GOB3 — trimestral, T3 2026: jul-sep)

Este documento se archiva por bloques desde el 28 de septiembre de 2026 (sesión 258): cuando
supera unas ~100 entradas de cierre de sesión recientes, las más antiguas se mueven tal cual (sin
resumir ni perder detalle) a `docs/historial/`, con un enlace aquí mismo. Este índice no repite el
detalle de cada cierre — vive en su propia entrada, en orden cronológico descendente más abajo —
solo señala qué decisiones de fondo siguen aplicando *hoy*, para no tener que releer el historial
completo. Se regenera una vez por trimestre (próxima revisión: T4 2026, oct-dic); una decisión que
quede invalidada por un cierre posterior se retira de aquí en la siguiente regeneración, no al
momento.

- **Repositorio vivo**: `contabilidadcasa` es el único repositorio en desarrollo; `finanzas-casa-def`
  queda congelado desde el 10 de agosto de 2026 y no recibe cambios. Detalle y motivo en `CLAUDE.md`.
- **Publicación sin pedir permiso cada vez**: validar → actualizar estado → commit/push → PR en
  borrador → fusionar a `main` en cuanto el CI esté en verde, todo en el mismo turno, sin
  confirmación explícita en cada paso (decisión del 10 de agosto de 2026, `CLAUDE.md`). Los frenos
  (no publicar en rojo, nunca push directo a `main`, nunca hacia `finanzas-casa-def`, consultar si
  el cambio va más allá de lo pedido o borra datos) siguen en pie.
- **Ninguna acción financiera real se ejecuta sola** (`A11-4`): comprar, vender, amortizar,
  transferir o tomar deuda nueva siempre exige confirmación explícita del hogar. Todo motor nuevo,
  incluida la Oleada 3 completa, respeta este contrato — nunca se ha revisado ni se espera revisar.
- **Reparto por titular (`javi`/`tere`/`household`)**: el modelo de propiedad de deuda (`E14`),
  gastos compartidos (`A18-1`/`A18-2`/`A18-3`, `canonical-household-split.js`) y hogar compartido
  remoto con roles y áreas (`E9-1`/`RGX1`/`RGX2`) coexisten como fuentes de "quién es quién" — no se
  ha unificado en un único modelo de identidad, y no hace falta mientras ninguna de las tres
  necesite leer a las otras dos.
- **El crédito Lombard (`APX2`/`APX3`) queda fuera del guardarraíl general de deuda (`AP4`)**: tiene
  garantía real y un perfil de riesgo distinto al resto de deuda para invertir; toda tarea nueva de
  apalancamiento (`LEV1`, `LEV3`...) respeta la misma exclusión salvo que se declare lo contrario.
  El techo de `LEV1` sí aplica a la deuda Lombard tomada, solo el guardarraíl de condiciones mínimas
  (`AP4`) no.
- **Sin serie histórica de valoraciones por posición ni clasificación de clase de activo/sector/
  divisa**: hueco de datos documentado desde la Oleada 2 (`APX4`/`IVX1`/`IVX5`) que sigue vigente y
  ya ha reducido el alcance de varias tareas de la Oleada 3 (`INV1`, `INV2`, `INV4`, `LEV5`, `LEV6`).
  Cualquier tarea nueva que necesite correlación o volatilidad de cartera real choca con el mismo
  hueco hasta que se decida abrir esa dimensión de datos.
- **La app puede ser directiva, no solo informativa, cuando ayude de verdad** (decisión del hogar,
  12 de septiembre de 2026, sesión 177): hasta ahora casi toda tarjeta fiscal/de cartera cerraba con
  "esto es información, nunca una recomendación". A partir de esta sesión, en tareas nuevas se puede
  saltar esa coletilla cuando de verdad aporte más ser directivo (p. ej. `INV18` dice en qué orden
  vender, no solo el coste de cada opción por separado) — a criterio de quien construye, sin pedir
  permiso cada vez. Alcance original: solo tareas nuevas a partir de esa fecha; las pantallas ya
  publicadas con ese disclaimer no se tocarían retroactivamente salvo petición expresa del hogar.
  **El hogar pidió esa retroactividad el 18 de septiembre de 2026 (`T4`, sesión 204)**: inventario
  completo de 19 pantallas + 1 caso límite, 9 pasaron a directivas (`FC5`, `INV6`, `AP3`, `LEV14`,
  `LEV9`, `LEV10`, `LEV11`, `DEB10`/`DEB5`; `APX2` ya lo era), 8 se quedaron informativas con el
  motivo documentado en el código (`FC3`, `A15-2`, `LPX4`, `LPX3`, `RGX1`, `LPX5`, `APX3`, reparto
  mensual estacional — no hay una respuesta directiva honesta que dar), y `FCX1` se quedó informativa
  al descubrirse que el retrofit exigiría fabricar el cálculo de la modalidad en renta (`I5`, hueco
  sin cerrar). `GOB15` quedó fuera a propósito, reservada a su propia sesión. Detalle completo en el
  cierre de sesión 204. Lo que no cambia: los límites reales del cálculo (heurísticas no exactas,
  reducciones fiscales no modeladas, etc.) se siguen declarando siempre — ser directivo no es dejar
  de ser honesto sobre lo que el motor no sabe.
- **`BACKLOG_ULTIMATE_SEPTIEMBRE_OLEADA_3.md` cerrada (9 de septiembre de 2026, sesión 163c)**:
  43/44 tareas accionables construidas o reducidas con motivo, 1 postergada (`GOB5`, condición
  externa). `BACKLOG_INDICE.md` sigue siendo el mapa de qué documento es la fuente viva de cada
  cola — consultarlo antes de retomar cualquier cola antigua, incluida esta ya cerrada.
- **Tres condiciones externas siguen sin resolverse**, sin fecha conocida ninguna de las tres
  (detalle en `BACKLOG_INDICE.md`, Bloque 0): el reloj de 30 días de `OPT-2` (arranca el 29 de
  agosto), activación de infraestructura de IA en producción (`A5-1`, desbloquea `RGX3`/`DEX6`), y
  contratación de un proveedor PSD2 (`O-6`). **10 de septiembre de 2026 (sesión 164): `A5-1` avanzó
  de código pero la condición sigue sin cumplirse** — ver el cierre de sesión inmediatamente abajo.
  **24 de septiembre de 2026 (sesión 240): `OPT-10`-`OPT-13` ya no dependen solo del reloj de
  `OPT-2`**: el hogar las aplazó al 23 de octubre con el mismo criterio que la Cola B (preguntar antes
  si el uso ha sido intenso), y una pantalla de uso menos que mensual no se declara «sin uso» con 30
  días de datos.
- **A5-1 usa Anthropic, no OpenAI (10 de septiembre de 2026, sesión 164)**: el backend privado del
  asistente llama a `https://api.anthropic.com/v1/messages` (`ANTHROPIC_API_KEY`/`ANTHROPIC_MODEL`),
  no a OpenAI — decisión explícita del hogar: ya tiene cuenta y facturación con Anthropic, evita
  abrir un proveedor nuevo solo para esto. Cualquier tarea futura que toque `private-backend.js` o
  `A5_ACTIVATION.md` debe asumir Anthropic como proveedor por defecto.
- **Las cuatro decisiones de alcance del §10.5 de `BACKLOG_ULTIMATE_SEPTIEMBRE_OLEADA_4.md` quedaron
  resueltas explícitamente por el hogar (12 de septiembre de 2026, sesión 171)**: `PVC14` (ensemble
  ponderado) se construirá con pesos ajustables por el hogar, no fijos; `INV16` (correlación
  cualitativa) se construirá declarada y editable por el hogar, no una tabla fija; `LEV14`
  (apalancamiento parcial escalonado) se construirá, pero solo como simulador informativo, nunca
  ejecuta nada; `GOB15` (simulador de vender la vivienda habitual) se confirma para una sesión futura
  dedicada. Detalle completo de cada decisión en la nota de la fila correspondiente de
  `BACKLOG_ULTIMATE_SEPTIEMBRE_OLEADA_4.md`. **`INV16` y `LEV14` ya están construidas (sesión 173)**;
  `PVC14` ya está construida (sesión 178); `GOB15` sigue siendo apuesta L, reservada a sesión propia.
  **`T4` (sesión 204) pasó `LEV14` a lenguaje directivo** (recomienda escalonar o no según el
  veredicto ya calculado) sin tocar el invariante de "nunca ejecuta nada" — ver el cierre de sesión
  204 para el detalle completo de qué más cambió.
- **Cero dependencias externas de UI, reafirmado explícitamente (20 de septiembre de 2026, sesión
  216)**: ya era la práctica real de toda la app (todos los gráficos son SVG a mano, sin librería),
  pero `I9` era la primera tarea que obligaba a decidirlo por escrito para una pantalla concreta. El
  hogar decidió mantenerlo — cualquier gráfico o componente interactivo nuevo se construye a mano,
  sin abrir una librería de UI "solo para esa pantalla". Detalle y razonamiento en el cierre de
  sesión 216.

## Historial archivado

Las sesiones anteriores a la 166 (hasta el 10 de septiembre de 2026 inclusive) se movieron sin
resumir ni recortar a
[`docs/historial/PROJECT_STATE_hasta-2026-09-10.md`](docs/historial/PROJECT_STATE_hasta-2026-09-10.md)
el 28 de septiembre de 2026 (sesión 258), para que abrir este documento al empezar una sesión
cueste menos: de 19.364 a unas 5.800 líneas. Es un archivo, no un resumen — el contenido es idéntico
al que había aquí antes de moverlo. Solo hace falta abrir el archivo cuando una tarea concreta pida
el detalle de una sesión anterior a la 166; el índice de decisiones vigentes de arriba sigue
cubriendo lo que aplica hoy sin necesidad de leerlo.

## Cierre de sesión — 30 de septiembre de 2026 (266): por qué la omisión de guardados idénticos no bastaba — causa raíz de las copias

- **Qué pasó**: la comprobación real de la sesión 265 (3 recargas sin editar nada) creó **6 copias**. Las
  consultas del hogar a Supabase lo explicaron con datos, no con hipótesis:
  1. **Huella distinta en cada copia.** Entre dos copias seguidas solo cambiaban, además de campos que la
     huella ya ignora (`updatedAt`, `generatedAt`, `auditTrail`), `scenarioSettings.cpx3RecommendationLog`.
     Causa: `cpx3TrackRecommendation` se llama en **cada render** de la tarjeta CP1 y escribía
     `lastShownAt = ahora` + `saveScenarioSettings()` → `queueRemoteSave()`. Cada visita cambiaba el estado
     sincronizado y creaba una copia completa (~0,4 MB) y ~3.700 filas. Es con toda probabilidad el origen
     de la mayor parte de las 878 copias de la sesión 265; la omisión de idénticos no podía actuar porque el
     estado nunca era idéntico. `lastShownAt` no lo lee ninguna pantalla (solo `firstShownAt`).
  2. **Copias huérfanas de guardados fallidos.** De las 10 últimas ejecuciones, solo 3 `complete`; 6 `failed`
     y 1 `running`. Motivo de los fallos: «No se conoce la revisión remota de partida» (guardado disparado
     antes de que termine la carga inicial, `remoteHeadKnown` aún falso) y `TypeError: Failed to fetch`.
     El guardado comprobaba la cabecera **después** de insertar la ejecución y la copia completa, así que
     cada intento fallido dejaba una copia huérfana.
- **Implementado** (`app.js`, saldo **−1 línea**: 37.529, por debajo del techo ARQ-4):
  - `cpx3TrackRecommendation` solo toca el registro (y por tanto guarda) si la recomendación es nueva, cambia
    de etiqueta/gravedad o `lastShownAt` es de otro día. `lastShownAt` pasa a tener precisión de día.
  - `saveNormalizedRemoteState` corta con el mismo error (`REMOTE_WRITE_CONFLICT`, no reintentable) **antes**
    de crear la ejecución y la copia cuando no hay cabecera conocida.
- **Guardas**: 3 pruebas nuevas en `tests/cpx3-transparencia-recomendaciones.test.cjs` (repetir el mismo día no
  cambia el estado ni guarda; cambio de gravedad sí guarda; `lastShownAt` de otro día se actualiza) y 1 en
  `tests/ola2-guardado-remoto-sin-cambios.test.cjs` (sin cabecera: cero peticiones, mismo error). Demostrado
  que muerden: con el `app.js` anterior fallan las dos pruebas de comportamiento.
- **Validación**: `npm run verify` completo en verde (`npm test` **4924/4924**, ESLint, `tsc`, a11y,
  performance, build, privacidad, smoke). **No comprobado contra el Supabase real** hasta que el hogar repita
  la prueba tras el despliegue (recargar 3 veces sin editar y contar copias).
- **Sigue sin resolver**: (a) las copias huérfanas `failed`/`running` ya existentes (limpieza manual con el
  mismo freno de seguridad; no la referencia ninguna otra tabla); (b) el guardado sigue pudiendo dispararse
  antes de terminar la carga inicial (ahora falla barato, pero no se reintenta solo tras la carga); (c) los
  `Failed to fetch` son de red y el guardado los deja a medias; (d) la causa de ~16 actualizaciones por fila
  en `finance_audit_log` está por confirmar (puede compartir origen con este); (e) la descarga del `state` de
  20 copias al arrancar.

## Cierre de sesión — 29 de septiembre de 2026 (265): base de Supabase por encima del límite gratuito — diagnóstico real y guardados idénticos omitidos

- **Qué pasó**: tras pedir al hogar tres comprobaciones (movimientos, tamaño remoto, despliegue), los datos
  reales cambiaron la prioridad: **1.831 movimientos**, `localStorage` 2,50 M de caracteres (48 % del techo;
  la versión previa a P6-lite), y en Supabase **0,521 de 0,5 GB (104 %) en plan gratuito**: 878 copias del
  estado con solo 548 huellas distintas (38 % duplicadas), ~381 kB cada una, tabla de copias 341 MB,
  `finance_audit_log` 97 MB; ~5 copias al día de media con un pico de 37 el 26-sep. Además un 500 en
  `finance_state_snapshots` en la consola: al cargar con sesión la app descarga el `state` completo de las
  últimas 20 copias (`loadRemoteState`) y de 30 en la auditoría, que con estas copias puede superar el tiempo
  límite de Supabase (causa probable, sin confirmar). No lo causan los cambios de rendimiento de la Ola 1-2
  (no tocaron código remoto). El 404 a `finance_households` es la tabla del hogar compartido sin instalar
  (ruido inofensivo); los errores de `background.js`/`serviceWorker.js` son de extensiones del navegador.
- **Limpieza (a mano, la ejecuta el hogar)**: la app no puede borrar copias (solo `select, insert`). Se
  diseñó con freno: regla de retención (referenciadas por cabecera/cierres/reaperturas/comprobaciones, las
  últimas 30 y una por día durante 60 días) — 85 copias conservadas y 794 a borrar (~291 MB) — con un bloque
  `do` que aborta si el número a borrar no es el esperado, y `vacuum full` después. Las claves foráneas
  rechazan borrar una copia referenciada; la tabla de copias no tiene disparador de auditoría (verificado en
  `supabase_schema.sql`). Procedimiento completo en `docs/SUPABASE_MANTENIMIENTO.md`.
- **Implementado — omitir guardados idénticos**: `canSkipUnchangedSave` y `loadSettledHead` en
  `canonical-supabase-store.js`. Un guardado remoto se omite (sin ejecución de sincronización, sin copia, sin
  filas, sin conciliación) solo si el estado tiene la misma huella que la cabecera que esta sesión dejó
  **completa tras un guardado normal** y la cabecera remota sigue siendo esa copia. La cabecera «asentada» se
  fija solo al completar la ejecución y, al cargar, únicamente si su ejecución quedó `complete` y no fue una
  operación de cierre/reapertura/deshacer (`metadata.operation`), que no actualizan las filas derivadas.
  Cualquier otro caso guarda como siempre; un guardado a medias no asienta nada. Cambios en `app.js`:
  +5 líneas de lógica (compensadas acortando un comentario; queda en 37.530, exactamente el techo de ARQ-4),
  `sync_id` añadido al `select` de la cabecera y `unchanged` en el resultado.
- **Guardas**: `tests/ola2-guardado-remoto-sin-cambios.test.cjs` (lógica pura, `loadSettledHead` en 12 casos
  y la función **real** `saveNormalizedRemoteState` extraída de `app.js` contra un cliente falso: primer
  guardado sube todo, el idéntico hace **cero** peticiones, un cambio real sí guarda, una cabecera que avanzó
  guarda igualmente, un fallo a medias no asienta y el reintento no se omite). Demostrado que muerde:
  desactivando la omisión falla el recorrido completo.
- **Validación**: `npm run verify` completo en verde (`npm test` **4920/4920**, ESLint, `tsc`, a11y,
  performance, build, privacidad, smoke); en navegador `test:e2e` 8/8, `test:a11y-axe` 6/6,
  `test:mobile-overflow` (201 visitas) y `test:perf-screens` (3 pruebas). **No comprobado contra un Supabase
  real** (sin backend en este entorno): la lógica se validó con un cliente simulado.
- **Pendiente**: (1) que el arranque no descargue el `state` de 20 copias (solo metadatos + la copia activa,
  el resto bajo demanda) — probable causa del 500; (2) origen del crecimiento de `finance_audit_log`
  (~16 actualizaciones reales por fila; hace falta ver qué campo cambia en cada guardado antes de tocar
  nada); (3) enviar solo las filas que cambian en vez de las ~3.700 de cada guardado; (4) confirmar con el
  hogar el resultado de la limpieza y el tamaño final de la base.

## Cierre de sesión — 29 de septiembre de 2026 (264): P6-lite — el libro canónico se persiste compacto en `localStorage`

- **Qué se pidió**: hacer la versión reducida de P6 tras medir su viabilidad (ver el cierre 263 para el
  diagnóstico de cuota).
- **Viabilidad medida antes de tocar código** (Chromium, datos sintéticos, techo de `localStorage` medido en
  ~5,2 M de caracteres en este Chromium; otros navegadores pueden tener otro):
  - El libro (`canonicalLedgerV1`) pesa 1,96 M con 3.000 movimientos y el 98 % es derivado (`entries` 1,44 M,
    `balanceChecks` 0,31 M, `actuals` 0,17 M). `refreshCanonicalLedger("startup-validation")` lo regenera
    entero en cada arranque, así que lo persistido solo aporta la huella y el `auditTrail`.
  - **Borrar la clave del todo no es viable**: pierde una entrada de historial (probado, 1 en vez de 2), que
    es lo único irrecuperable. **Quitar `entries` del payload remoto tampoco**: `canonical-supabase-store.js`
    construye una fila remota por movimiento a partir de ellas. Por eso se compacta solo la persistencia local.
  - La comparación de recuperación al arrancar usa el payload completo guardado en IndexedDB
    (`durable-outbox`), no el de `localStorage`; compactar lo local no puede provocar falsos conflictos.
- **Implementado**: `compactCanonicalLedgerForStorage(snapshot)` (mismo patrón que `compactCanonicalDailyRuns`)
  vacía `entries`/`actuals`/`balanceChecks` en las dos únicas escrituras del libro en `localStorage`
  (`saveLocalSnapshot` y `refreshCanonicalLedger`). Devuelve una copia: el snapshot en memoria y
  `appStatePayload()` (copia de seguridad y remoto) siguen completos. `app.js` queda en 37.528 líneas (techo
  de ARQ-4 intacto). Sin cambios en `loadLocalState`.
- **Medido con el cambio** (mismos datos sembrados, tras recargar): `localStorage` 3.000 mov. 2,81 M → 0,89 M;
  6.000 mov. 5,00 M (96 % del techo) → 1,32 M; 9.000 mov. desbordaba y el libro caía a `memoryStorage` →
  1,74 M sin fallos; 20.000 mov. → 3,31 M (64 %). El techo pasa de ~6.300 a ~33.000 movimientos (extrapolado
  desde 9.000 → 20.000); con ~250 movimientos al mes (supuesto), de ~2 años de historia a ~11. Arranque igual o
  algo mejor; el libro era ~18 de los 22 ms de cada guardado.
- **Fidelidad**: reconstruir desde lo compactado da la misma huella y el mismo historial (sin entrada espuria
  sin cambios de datos; con cambios, encadenada a la huella anterior); Cierre, Conciliar y Hoy renderizan sin
  errores. **Migración automática**: un usuario con el libro completo guardado por la versión anterior pasa de
  1.955.588 a 36.028 caracteres en la primera carga, con la misma huella y el historial intacto.
- **Guardas**: `tests/ola2-p6-ledger-compacto.test.cjs` (con el motor real `canonical-ledger.js`: compactación,
  no mutación del snapshot, huella e historial, dos escrituras y payload completo) y un test de navegador con
  9.000 movimientos en `tests/p4-presupuesto-pantallas.spec.cjs` (clave del libro ≤ 100.000 caracteres,
  `localStorage` ≤ 2,5 M, 0 claves en memoria, huella estable al recargar). Demostrado que muerde: contra el
  `app.js` anterior falla con `canonicalLedgerV1` cayendo a memoria.
- **Validación**: `npm run verify` completo en verde (`npm test` **4914/4914**, ESLint, `tsc`, a11y,
  performance, build, privacidad, smoke); en navegador `test:e2e` 8/8, `test:a11y-axe` 6/6,
  `test:mobile-overflow` (201 visitas) y `test:perf-screens` (3 pruebas).
- **Pendiente, sin tocar**: (1) el coste remoto por guardado —con sesión, cada guardado inserta una copia
  completa del estado en `finance_state_snapshots` (2,82 MB con 3.000 movimientos; «nunca se borran
  automáticamente») y hace upsert de una fila por movimiento (3.696 filas, 2,90 MB): ~5,7 MB por guardado con
  3.000 movimientos y ~10,3 MB con 6.000; no medible sin backend, a la espera de que el hogar compruebe el
  tamaño real de esa tabla; (2) el siguiente techo local pasa a ser `financeDashboard:workbookOverride:v1`
  (guarda las transacciones, ~0,15 M por cada 1.000); (3) la interfaz sigue diciendo «Cambios guardados en este
  equipo» aunque una clave caiga a memoria (aviso opcional, ~3 líneas); (4) `expenseTimingFromMovements`
  (~237 ms con 3.000 movimientos) es el siguiente candidato de coste por movimiento.

## Cierre de sesión — 29 de septiembre de 2026 (263): coste de arrancar y editar con muchos movimientos — medido y corregido (`availableSeriesRows`)

- **Qué se pidió**: medir el coste de arrancar y guardar (antes de decidir si merecían la pena el guardado
  incremental, no persistir lo derivado y el arranque en dos fases) y, con los datos, implementar la
  prioridad 1 que salió de esa medición.
- **Medición** (Chromium sobre `dist/`, contenedor con CPU compartida; el demo público no trae movimientos,
  así que se sembraron datos sintéticos: N movimientos en 36 meses, 8 categorías, reales de 24 meses —
  sirve para ver cómo escala el coste, no como cifra exacta del hogar):
  - **Arrancar y editar crecían con los movimientos**: ~0,45 s de arranque por cada 1.000 movimientos y el
    mismo orden de magnitud de bloqueo en cada edición (`render` repite casi todo el arranque). Con 3.000
    movimientos: arranque 2,24 s, edición 1,76 s. Causa única: `mappingForMovement` (21.000 llamadas en el
    arranque, 7 por movimiento, porque `p2MovementRows` corre 5 veces por `render`) reconstruía y reordenaba
    `availableSeriesRows(kind)` en CADA llamada (21.004 reconstrucciones): 1,97 de los 2,1 s de `init`.
  - **Guardar es barato**: `saveLocalSnapshot` completo ~20 ms con 3.000 movimientos (10 ms de
    `JSON.stringify`); una edición dispara 3 guardados (~70 ms). **El guardado incremental (P5) queda
    descartado**: ahorraría <20 ms por guardado a cambio de tocar el contrato de la copia y de la cola
    remota.
  - **Cuota de `localStorage` (P6, reformulada)**: el 98 % de lo que se escribe es derivado y recalculable
    (`canonicalLedgerV1` 1,95 M de caracteres con 3.000 movimientos, `canonicalStateV1` 0,24 M,
    `canonicalDailyEngineV1` 0,12 M). Techo medido ~5,2 M de caracteres: con 6.000 movimientos está al 96 %
    y con ~7.000 el libro derivado cae en silencio a `memoryStorage` (la interfaz sigue diciendo «Cambios
    guardados en este equipo»). En las pruebas siempre falla el derivado, nunca un dato del usuario (por el
    orden de escritura, no por diseño defensivo). Además el payload remoto (`appStatePayload`) pesa 2,75 MB
    con 3.000 movimientos, 71 % ese mismo libro, en cada guardado con sesión. Sin tocar todavía: primero
    hay que medir el coste de recalcular el libro al arrancar y qué depende de que esté persistido.
- **Implementado (prioridad 1)**: `availableSeriesRows` se memoiza dentro del alcance acotado de
  `withPlanningBreakdownMemo` (P1 de la Ola 1), que ahora también envuelve `p2MovementRows` y
  `canonicalLedgerTransactions` (bucles puros sobre los movimientos; nada escribe planificación dentro).
  Fuera del alcance nunca cachea. De paso se deduplicaron los dos bucles casi idénticos de
  `availableSeriesRows`, lo que deja `app.js` en 37.521 líneas (techo de ARQ-4 sin tocar, margen 9).
  Medido con los mismos 3.000 movimientos: `mappingForMovement` 1.973 → 254 ms, `p2MovementRows`
  1.488 → 187 ms, `init` 2.139 → 986 ms; arranque 2,24 → 1,40 s y edición 1,76 → 0,69 s. Con 6.000
  movimientos: arranque 3,42 → 2,12 s, edición 3,35 → 1,17 s. Resultado **idéntico byte a byte** (3.000
  movimientos, 80 clasificados con casación exacta, una partida renombrada y una borrada; ~1,76 MB de
  salida entre filas de movimientos, libro canónico y lista de series) y en test con la implementación
  original como referencia.
- **Guarda en el CI**: nuevo test en `tests/p4-presupuesto-pantallas.spec.cjs` que siembra 3.000
  movimientos y mide un `render`: tope determinista de llamadas a `isPlanningRowSeriesDeleted` (≤ 150.000;
  medido 89.745 con la memoria y 452.850 sin ella) y de tiempo (≤ 1.500 ms; ~340 ms con la memoria,
  ~1.150 sin ella). Demostrado que distingue los dos estados ejecutándolo contra el `app.js` original.
- **Validación**: `npm run verify` completo en verde (`npm test` **4911/4911**, ESLint, `tsc`, a11y,
  performance, build, privacidad, smoke); en navegador `test:e2e` 8/8, `test:a11y-axe` 6/6,
  `test:mobile-overflow` (201 visitas) y `test:perf-screens`.
- **Pendiente detectado, sin tocar**: sigue habiendo un coste que crece con los movimientos
  (~0,25 s por cada 1.000 en el arranque; antes ~0,45). Siguiente candidato en el perfil:
  `expenseTimingFromMovements` (~237 ms con 3.000 movimientos, llamada por partida y mes, recorre
  movimientos). Las pantallas que filtran movimientos llamando a `mappingForMovement` fuera de estos dos
  bucles (p. ej. el filtro «Sin clasificar») no están dentro del alcance acotado. P6 y P7 siguen sin
  empezar; P7 (arranque en dos fases) queda subsumida hasta volver a medir.

## Cierre de sesión — 29 de septiembre de 2026 (262): Ola 2 (parte 1) — Planificación de partidas ~1,05 s → ~0,2 s; P8 descartada con motivo

- **Qué se pidió**: continuar con la Ola 2 del plan de optimización; se acordó empezar por Planificación de
  partidas y las versiones `?v=` (el usuario respondió «ok» a esa propuesta concreta).
- **Planificación de partidas.** `partidasTotalsByKind` calculaba `visualRowsForSection(section, months)`
  **dentro** del bucle por mes, aunque no depende del mes: 504 de 510 llamadas al abrir la pantalla y
  337.063 llamadas a `actualAwareInfo` por debajo. Se iza fuera del bucle (una llamada por sección), sin
  líneas netas nuevas en `app.js` (sigue en su techo de ARQ-4). Medido en Chromium: `actualAwareInfo`
  337.063 → 5.313; apertura ~1,05 s → ~0,2 s. Resultado **idéntico** a la implementación original con los
  datos reales del demo (126 meses, ingresos y gastos) y en test con stubs. El presupuesto de P4 pasa a
  vigilar esta pantalla también de forma determinista (≤ 20.000 llamadas a `actualAwareInfo`, medido 5.313)
  y con tope de tiempo de 1.500 ms (antes 3.000).
- **P8 (versiones `?v=` generadas por el build) — descartada, no ejecutada.** El plan la daba por
  necesaria, pero al abrir `tools/build-public-site.mjs` el comentario sobre `cacheVersion` documenta que
  reescribir los `?v=` se descartó a propósito: con el Service Worker instalado los ignora (`ignoreSearch`)
  y el único interruptor real es `CACHE_NAME`, que ya se regenera en cada build; además
  `tests/opt3-minify-dist.test.cjs` fija que `index.html` se publica tal cual. El incidente que la
  motivaba (recursos fuera de la caché offline) lo cubre `tests/arq5-cache-offline-completa.test.cjs`.
  El único riesgo residual es una caché HTTP obsoleta (GitHub Pages, ~10 min) en visitas sin Service
  Worker: no justifica revertir una decisión razonada. Retirada del plan.
- **Validación**: `npm run verify` completo en verde (`npm test` **4907/4907**, ESLint, `tsc`, a11y,
  performance, build, privacidad, smoke); en navegador `test:e2e` 8/8, `test:a11y-axe` 6/6,
  `test:mobile-overflow` (201 visitas) y `test:perf-screens`.
- **Pendiente**: P5 (guardado incremental, toca el contrato del payload), P6 (no persistir lo derivado,
  hay que medir primero el coste de recalcular al arrancar) y P7 (arranque en dos fases) siguen sin
  empezar; `app.js` sin margen de líneas.

## Cierre de sesión — 29 de septiembre de 2026 (261): Ola 1 de optimización (P1-P4) — rendimiento medido en navegador, sin funcionalidad nueva

- **Qué se pidió**: análisis crítico de la app y plan de mejora «sin nuevas funcionalidades,
  optimizando»; el usuario aprobó ejecutar la Ola 1 (P1-P4). Diagnóstico medido en Chromium contra
  `dist/`, no solo lectura de código (cifras de tiempo en un contenedor con CPU compartida: sirven para
  comparar entre sí, no como valor absoluto).
- **P1 · memoización de la ruta caliente de planificación.** `normalizedText` (NFD + regex) se llamaba
  dentro de bucles fila×mes y `planningBreakdownForForecastMonth` se recalculaba **40.176 veces para
  248 combinaciones distintas** al abrir Asesor virtual (todas desde `simulate` ← `evaluateDebtCandidate`).
  Cambios: caché acotada (5.000 entradas) como propiedad de `normalizedText` (mismo idioma que
  `shortDate.cache`, para que los tests que extraen la función suelta sigan funcionando) y memoria con
  **alcance** (`withPlanningBreakdownMemo`) que solo existe mientras dura `evaluateDebtCandidate`
  (evaluación hipotética sin escrituras en planificación); fuera de ese alcance nunca cachea, así que no
  puede quedar obsoleta. Se descartó una caché global con invalidación por revisión: un fallo de
  invalidación daría cifras financieras erróneas. Resultado **idéntico byte a byte** (JSON de ~117 KB por
  caso) comparando con y sin memoria. Medido: Asesor virtual ~1,5 s → ~0,25 s; Control de deuda ~1,4 s →
  ~0,2 s; Comparar deuda ~0,4 s → ~0,3 s; llamadas al desglose 40.176 → 124 (Asesor virtual) y
  6.448 → 124 (Control de deuda). Un primer intento con `const` declarada junto a la función provocó un
  error de zona muerta temporal (la función se invoca durante la carga del script); lo detectó la
  medición en navegador, no los tests `vm`. `app.js` queda exactamente en su techo de ARQ-4 (37.530
  líneas): no se subió el techo.
- **P2 · SheetJS diferido.** `index.html` ya no carga `vendor/xlsx.full.min.js` (882 KB) al arrancar;
  `xlsx-loader.js` (nuevo, 780 B minificado) lo pide la primera vez que se importa un Excel (Registrar,
  Datos) o se exporta el informe. Sigue en la caché offline y en el build. Los avisos de fallo dicen ahora
  «No se pudo cargar la librería de Excel…» (antes «todavía está cargando», que ya no describe nada). Se
  retiró `dataset.xlsxReady` (nadie lo leía). Verificado en navegador: no se pide al arrancar, se carga al
  elegir un fichero. Matiz honesto: en la primera visita el Service Worker sigue precacheando el fichero
  en segundo plano; el ahorro es de ruta crítica y de parseo/ejecución en cada carga, no de bytes totales
  de la primera visita.
- **P3 · Supabase sin CDN.** `supabase-js@2` (jsDelivr, sin versión fija ni SRI, y un `<script defer>` lento
  retrasa `DOMContentLoaded`) pasa a `vendor/supabase-js-2.117.2.umd.js` (mismo UMD de npm, SHA-256
  vigilado en test), precacheado y copiado sin reminificar. La guarda de privacidad exime solo a
  `vendor/` (la librería contiene la ruta REST `/users/`, falso positivo del patrón `/Users/`, igual que
  xlsx). Comprobado sin red: sin sesión no hay peticiones a Supabase al arrancar; con sesión guardada y sin
  red la app queda en «Local», sin errores de página y con navegación intacta (la librería reintenta el
  refresco de token). **Cambio de comportamiento a tener presente**: antes, sin la CDN la app nunca
  intentaba el modo remoto; ahora, con sesión guardada, sí lo intenta y degrada como ante una caída de red
  a mitad de sesión.
- **P4 · presupuesto por pantalla.** `tests/p4-presupuesto-pantallas.spec.cjs` (proyecto `perf-screens`,
  `npm run test:perf-screens`, paso nuevo en `pages.yml` tras axe): mide Asesor virtual, Control de deuda,
  Comparar deuda y Planificación de partidas con dos tipos de tope — **determinista** (llamadas al desglose
  ≤ 1.000 / 500 / 3.000; medido 124 / 124 / 1.612) y **tiempo** holgado (mediana de 3 ≤ 1.200 ms, ≤ 3.000
  ms Planificación). Demostrado que muerde: desactivando la memoria de P1 el spec falla con 6.448 llamadas.
  `tests/ola1-p4-presupuesto-pantallas-wiring.test.cjs` vigila que siga cableado y sin relajar.
- **Validación**: `npm run verify` completo en verde — `npm test` **4905/4905**, ESLint, `tsc`, `test:a11y`,
  `test:performance`, `build:site`, `test:privacy`, `test:smoke`; además en navegador `test:e2e` 8/8,
  `test:a11y-axe` 6/6, `test:mobile-overflow` (201 visitas sin contenido cortado) y `test:perf-screens`.
  `test:performance-lh` (Lighthouse) solo corre en el CI: en este contenedor las medianas son ruido de CPU
  compartida (ver nota de `.lighthouserc.cjs`). `DOMContentLoaded` en local, mediana de 5: 1.189 ms → 971 ms.
- **Pendiente detectado, sin tocar**: Planificación de partidas sigue en ~1,0-1,4 s (337.063 llamadas a
  `actualAwareInfo` desde `visualRowsForSection`, render propio de la pantalla, fuera del alcance
  acotado de P1); `app.js` sin margen de líneas (ARQ-4) — cualquier optimización futura ahí debe restar
  líneas o extraer a un fichero. P5-P8 del plan (guardado incremental, no persistir lo derivado, arranque
  en dos fases, versiones `?v=` generadas por el build) siguen sin empezar.

## Cierre de sesión — 28 de septiembre de 2026 (260): `OPT-9` — auditados y corregidos los `!important` de `design-tokens.css`/`p2.css`, verificado con valor computado real

- **Qué se pidió**: segunda pasada de la auditoría de optimización de la sesión 259, pedida por el
  usuario («analicemos de nuevo»). Encontró dos hallazgos genuinamente nuevos (`OPT-9` sin cerrar
  pese a no tener nota de cierre en ningún backlog, y `npm audit` con 13 vulnerabilidades en
  dependencias de desarrollo de `@lhci/cli`, sin acción tomada — riesgo acotado a CI, no a
  producción, dejado para otra sesión) y confirmó que `OPT-18` (compresión del sitio publicado)
  sigue sin poder verificarse desde este entorno (la política de red del contenedor bloquea la
  petición a `github.io`). El usuario pidió aplicar `OPT-9` ahora.
- **Auditoría real, no solo recuento**: 19 usos reales en `styles.css` (no 23, cifra ya
  desactualizada) + 2 en `design-tokens.css` + 2 en `p2.css` = 23 en total. Los 19 de `styles.css`
  ya estaban documentados con comentarios `OPT-9:` explicando por qué son necesarios — trabajo hecho
  en una sesión anterior sin que la tabla maestra de `BACKLOG_OPTIMIZACION.md` lo reflejara, mismo
  patrón de tabla desincronizada que `OPT-1`/`OPT-3`/`OPT-5` en la sesión 259.
- **Verificación con valor computado real, no solo análisis estático**: para los 4 usos sin
  documentar, se montó una página de prueba que reutiliza las tres hojas de estilo reales sobre el
  marcado real de cada caso, y se midió `getComputedStyle` con Playwright (Chromium de
  `/opt/pw-browsers/`) antes y después de quitar `!important` — el `@media print` de
  `.cierre-print-evidence` se probó además contra `index.html` real con `page.emulateMedia({media:
  "print"})`.
  - `.cuadro-mandos-concept` (`design-tokens.css`) y el `display: none` de `@media print`: sin
    ningún conflicto real (el valor computado no cambiaba al quitar `!important`) — sobraba en los
    dos casos, eliminado sin más cambio.
  - `.p2-kicker`/`.p2-help` (`p2.css`): conflicto real confirmado — `.p2-panel p { margin: 0; }`
    (especificidad 0-1-1) ganaba a la clase sola (0-1-0) pese a declararse antes; quitar
    `!important` hacía que el margen se fuera a 0px de verdad. Corregido subiendo la especificidad
    de la propia clase (`.p2-kicker.p2-kicker`, `.p2-help.p2-help`, 0-2-0) en vez de `!important`;
    no se usó el tipo de etiqueta (`p.p2-kicker`) porque `.p2-help` a veces es un `<ul>` (el listado
    de evidencia de `p2-ui.js`), no siempre un `<p>`.
- **Resultado**: `design-tokens.css` y `p2.css` quedan a 0 usos reales de `!important` (las únicas
  coincidencias de grep que quedan son las explicaciones en comentario). `styles.css` conserva sus
  19 usos, todos ya justificados por escrito.
- **Validación**: `npm run verify` completo — 4887/4887 pruebas, lint limpio, typecheck limpio,
  accesibilidad, rendimiento, build, privacidad y smoke test en verde. `git diff --check` sin avisos.
  No pude ejecutar `test:visual` (Playwright) en este contenedor — su configuración pide el canal
  `chrome` real (`/opt/google/chrome/chrome`), no instalado aquí; los 6 fallos son ese mismo error de
  lanzamiento antes de cargar ninguna página, no relacionados con el cambio. La verificación por
  valor computado (arriba) es más directa que una captura de pantalla para este tipo de cambio —
  responde exactamente a la pregunta «¿cambió el resultado visual sin `!important`?» — pero no
  sustituye una revisión visual humana si el hogar quiere confirmarlo por su cuenta.
- **Publicado**: commit y push a `claude/festive-goldberg-8xtykb`, PR en borrador abierto y fusión a
  `main` en cuanto el CI esté en verde, por la autorización de publicación sin preguntar en cada tarea
  ya vigente (`CLAUDE.md`).

## Cierre de sesión — 28 de septiembre de 2026 (259): auditoría de optimización pedida por el usuario — tabla maestra de `BACKLOG_OPTIMIZACION.md` corregida, presupuesto de Lighthouse estrechado y `PROJECT_STATE.md` archivado por bloques

- **Qué se pidió**: el usuario pidió un plan de mejora centrado en optimización, sin funcionalidad
  nueva. La auditoría (verificada contra el código real, no solo contra los backlogs) encontró que
  casi todo lo que un audit de este tipo propondría ya estaba hecho, evaluado y descartado con
  motivo, o parado por decisión del hogar (`ARQ-4`, `ARQ-5`, `OPT-16`/`OPT-17`, checkpoint de sesión
  258) — detalle completo entregado al usuario en la conversación, no repetido aquí. De ahí salieron
  tres acciones concretas, pedidas explícitamente por el usuario («Aplica el punto 1 y 2, y tb el 3
  para que me cueste menos cada sesión»):
- **(1) Tabla maestra de `BACKLOG_OPTIMIZACION.md` (§0) corregida**: `OPT-1`, `OPT-3` y `OPT-5`
  seguían marcadas `⏳ Pendiente` pese a estar resueltas desde el 29 de agosto de 2026 (sesiones 46,
  48 y 71) — la tabla nunca se actualizó al cerrarlas. Pasadas a `✅` con referencia a la sesión;
  nota `**Resuelto (...)**` añadida a la ficha de cada tarea y aviso fechado en la cabecera del
  documento. Riesgo real que evita: que una sesión futura reabra trabajo ya hecho por confiar en esa
  tabla suelta sin llegar a `BACKLOG_INDICE.md`.
- **(2) Presupuesto de Lighthouse (`.lighthouserc.cjs`) estrechado**: los umbrales originales (LCP
  6000 ms / TBT 8000 ms) daban margen incluso sobre el peor caso en frío ya documentado en el propio
  fichero (~11 s / ~5,2 s) — un semáforo que solo se pondría en rojo ante una catástrofe, no ante una
  deriva progresiva. Nuevos umbrales: LCP 4000 ms / TBT 5000 ms (~2,5-3x sobre la mediana templada
  documentada, ~1,4 s / ~2,7-3,4 s). No se fijaron más ajustados: la comprobación en este contenedor
  de desarrollo (Chromium de Playwright vía `CHROME_PATH`, `npx lhci autorun`) dio medianas muy por
  encima incluso de ese peor caso en frío (LCP 2,2-11,2 s, mediana 9,6 s en 3 corridas) — coste de
  arrancar Chrome en una CPU compartida de contenedor, no una regresión real de la app, así que no
  sirve de referencia fiable para un umbral más ajustado. `npm run verify` no incluye este paso (ya
  vivía aparte, ver comentario de `tools/check-lighthouse-budget.mjs`); la validación real de estos
  nuevos umbrales ocurre en el CI de GitHub Actions al abrir el PR — si diera problemas de ruido ahí,
  esa es la señal real para relajarlos, no una suposición de partida.
- **(3) `PROJECT_STATE.md` archivado por bloques**: el propio documento se autodiagnosticaba
  «supera las 12.500 líneas y ya es difícil de navegar» desde el 12 de septiembre, y para esta sesión
  ya iba por 19.364 líneas / 1,56 MB — coste real de contexto en cada sesión que lo lee al empezar.
  Las sesiones 1-165 (hasta el 10 de septiembre de 2026 inclusive) se movieron **sin resumir ni
  recortar, byte a byte** — verificado por comparación exacta antes de sustituir el fichero — a
  [`docs/historial/PROJECT_STATE_hasta-2026-09-10.md`](docs/historial/PROJECT_STATE_hasta-2026-09-10.md).
  El documento activo queda en ~5.900 líneas / ~520 KB (–67%), con un puntero en la cabecera («##
  Historial archivado») explicando dónde está el resto. El índice de decisiones vigentes no se tocó
  en su contenido, solo se actualizó el párrafo que describía el tamaño del documento. Criterio de
  archivado para el futuro: cuando vuelva a acumular más de ~100 entradas de cierre recientes, mover
  el bloque más antiguo a un nuevo fichero fechado en `docs/historial/`, mismo patrón.
- **Validación**: `npm run verify` completo — 4887/4887 pruebas, lint limpio, typecheck limpio
  (0 errores), accesibilidad estructural (1403 IDs únicos), rendimiento (`check-performance.mjs`
  dentro de umbral), `build:site`, privacidad y smoke test, todos en verde. No se tocó ningún fichero
  de lógica de la app (`app.js`, `canonical-*.js`, `views/*.js`, `index.html`) — solo documentación de
  proceso (`BACKLOG_OPTIMIZACION.md`, `PROJECT_STATE.md`) y la configuración del presupuesto de
  rendimiento (`.lighthouserc.cjs`), así que no hacía falta más que eso para confirmar que nada se
  rompió.
- **Publicado**: commit y push a `claude/festive-goldberg-8xtykb`, PR en borrador abierto y fusión a
  `main` en cuanto el CI esté en verde, por la autorización de publicación sin preguntar en cada tarea
  ya vigente (`CLAUDE.md`). Vigilar especialmente el paso `test:performance-lh` del CI real: es la
  primera vez que corre con los umbrales nuevos de (2).

## Cierre de sesión — 28 de septiembre de 2026 (258): checkpoint de backlog — no queda trabajo accionable sin condición pendiente

- **Qué se pidió**: el usuario pidió revisar qué queda prioritario en el backlog, ya con `D1`
  (3 fases) y `D6` cerradas. Sin cambios de código esta sesión.
- **Qué se encontró**: horizontes 1 a 4 de `BACKLOG_CONTABILIDADCASA_3_0.md` §6 están completos,
  salvo dos elementos aparcados por decisión explícita del hogar (no bloqueados por esfuerzo):
  `NAV-3` (sesión 246) y el resto de `ARQ-4` (Visual Detail, sesión 238). El horizonte 5 sigue
  condicionado por terceros y el horizonte 6 (Cola B) sigue gated por una conversación del hogar
  que todavía no ha ocurrido.
- **Verificación repetida de las tres condiciones externas** (tabla de `BACKLOG_INDICE.md`),
  contrastada contra `PROJECT_STATE.md`: ninguna cambió desde la sesión 240. `A5-1` sigue sin
  producción real; `O-6`/PSD2 sin contratar; el reloj de `OPT-2` para `OPT-10`-`OPT-13` fue
  re-aplazado (sesión 240, 24/09) al 23 de octubre y a uso real intensivo, no solo al calendario
  — la coincidencia de que el plazo original cumpliera justo hoy (28/09) no lo desbloquea, porque
  esa condición ya quedó sustituida por una más estricta.
- **Decisión de esta sesión: no nace un backlog numerado nuevo (`4.0`)**. El usuario pidió "generar
  una versión nueva del backlog para retomar desde aquí"; se decidió no crear un documento nuevo
  porque la disciplina del propio proyecto (`BACKLOG_INDICE.md`) liga cada backlog numerado a una
  auditoría real cruzada contra código, no a un cierre de sesión sin hallazgos nuevos — crear un
  `4.0` vacío de contenido habría roto esa convención sin aportar nada. En su lugar, el checkpoint
  queda documentado en `BACKLOG_INDICE.md` (nueva entrada, encabezando "Para saber qué hacer a
  continuación") y en `BACKLOG_CONTABILIDADCASA_3_0.md` (nuevo §8), para que la siguiente sesión no
  repita esta misma investigación.
- **Único paso que depende del hogar, no de un tercero**: la Cola B (§4 de `3.0`). El informe «Uso
  de la app» (Ajustes) existe desde la sesión 220 — falta que el hogar lo mire y diga qué pantallas
  abre de verdad, para priorizar dentro de Cola B con datos reales en vez de seguir esperando.
- **Validación**: `npm test` → **4887/4887 pruebas en verde** (sin cambios de código, solo
  documentación — no hizo falta `npm run verify` completo).
- **Rama/PR**: `claude/zealous-euler-35iwgd`, PR de documentación contra `main`.

## Cierre de sesión — 28 de septiembre de 2026 (257): `D1` Fase 3 — puente sandbox → plan real (oferta borrador segura)

- **Qué se construyó**: la Fase 3 confirmada por el hogar ("Fase 3, ok: sandox a real, ok" — versión
  más segura, pero automatizada). Cada cuenta del sandbox (Entidad A, Entidad B y cualquier cuenta
  nueva de la Fase 2) tiene ahora un botón "Enviar esta estrategia al plan real". Al pulsarlo:
  - El sandbox **nunca escribe en los contratos reales**. Solo crea o actualiza una **oferta
    borrador** en el mismo cauce que el hogar ya usa a mano hoy (E14b, "Plan de deuda"/"Deuda ›
    Ruta"), reutilizando `E14DebtOperations.normalizeOffer`/`applyE14bOffer` sin tocarlos. Esa oferta
    sigue exigiendo completar la vigencia (dato real que solo el hogar conoce, nunca inventado aquí)
    y pasar por la confirmación obligatoria de `applyE14bOffer()` (`A11-4`) antes de que nada real
    cambie — la garantía original del sandbox ("aquí se prueban estrategias sin escribir en esos
    datos") queda intacta.
  - Un segundo envío de la misma cuenta **actualiza** la oferta borrador existente en vez de
    duplicarla, y nunca pisa una vigencia o unos documentos que el hogar ya hubiera completado a
    mano.
  - El botón se desactiva cuando la cuenta no tiene un contrato real vinculado de forma única
    (Entidad B hoy, mientras siga sin correspondencia única) o cuando la estrategia elegida es
    "esperar" (nada que proponer).
  - Las ofertas borrador pendientes de completar se asoman también en el buzón de decisiones de Hoy
    (`decisionInboxItems`), como pidió el hogar, además de en su propio panel de "Plan de deuda".
  - **Decisiones de diseño confirmadas explícitamente por el hogar antes de construir**: (1) la
    propuesta se guarda ya como oferta borrador, no solo precarga un formulario — la lectura más
    literal de "automatizada"; (2) el puente cubre también a Entidad A/B, la negociación real que
    sigue activa (no solo a las cuentas nuevas de la Fase 2), sin tocar `cb_amount`/`bk_amount` ni la
    paridad histórica ya verificada (`A9-8`).
  - **ARQ-4**: la resolución de cuenta→contrato y la construcción de la oferta (`dynamicAccountKey`,
    `resolveAccountContract`, `buildDraftOffer`) son lógica pura, movida a
    `canonical-e14-debt-adapter.js` — `app.js` solo aporta una fachada fina (`receiveDebtRoadmapOffer`)
    sobre el estado real (`e14bWorkspace`, `queueRemoteSave`, `renderE14bPanel`) y la nueva entrada de
    `decisionInboxItems`, que por arquitectura no se pueden extraer (mismo motivo que `D6`). Aun así,
    `app.js` superaba el techo en 27 líneas tras extraer todo lo extraíble; el hogar confirmó subir
    `CEILING_LINES` de 37.486 a 37.530 (mismo criterio que `D6`) en vez de invertir la sesión en
    buscar otro fragmento ajeno a `D1` que recortar. `app.js` quedó en 37.513 líneas.
- **Validación**: `npm run verify` completo en verde — **4.887/4.887 pruebas unitarias** (22 nuevas:
  9 en `tests/canonical-e14-debt-adapter.test.cjs` para `dynamicAccountKey`/`resolveAccountContract`/
  `buildDraftOffer`, 13 en `tests/d1-fase3-puente-oferta.test.cjs` para la fachada de `app.js` y la
  estructura del sandbox), lint, typecheck, accesibilidad, rendimiento, build del sitio, privacidad y
  smoke test. Ajustado un test existente (`tests/e14-interface.test.cjs`) al nuevo literal del
  mensaje `finance-debt-roadmap-hydrate` tras extraer `debtRoadmapCanonicalReadModel()`.
  - Verificado a mano en navegador (Playwright), montando un host con el protocolo real
    (`finance-debt-roadmap-send-offer`/`finance-debt-roadmap-offer-result`) y `canonical-e14-debt-
    adapter.js`/`canonical-e14-operations.js` reales (sin stubs): Entidad A (contrato vinculado)
    permite enviar y crea la oferta borrador con vigencia en blanco; Entidad B (sin correspondencia
    única en el escenario de prueba) mantiene el botón desactivado; una cuenta dinámica nueva
    (Fase 2) genera su propia oferta independiente y correcta (refinanciación, importe financiado);
    un segundo envío de Entidad A actualiza el importe de la misma oferta (mismo id) en vez de
    duplicarla.
- **Pendiente**: ninguno explícito — las tres fases de la ampliación de `D1` confirmada por el hogar
  el 28 de septiembre de 2026 quedan cerradas (Fase 1 sesión 255, Fase 2 sesión 256, Fase 3 esta
  sesión).

## Cierre de sesión — 28 de septiembre de 2026 (256): `D1` Fase 2 — el sandbox de deuda pasa de 2 cuentas fijas a N cuentas reales

- **Qué se construyó**: hasta ahora el sandbox visual de deuda solo podía simular exactamente dos
  cuentas, codificadas por nombre ("Entidad A"/`cb_*`, "Entidad B"/`bk_*"). Esta fase generaliza el
  modelo: cualquier otro contrato canónico real vivo (declarado en Contratos, ni Entidad A/B, ni
  liquidado, ni el plan reunificado sintético de Cetelem) aparece automáticamente como una cuenta
  simulable propia, con su propio bloque de supuestos (estrategia, quita, mes de inicio, pago único,
  TAE, plazo, % a financiar, aportación extra puntual de la Fase 1) y su propia columna en la tabla
  de forecast — sin tocar código cuando aparece una deuda nueva.
  - `canonical-e14-debt-adapter.js`: `buildReadModel()` gana un campo nuevo, `extraDebts` (aditivo,
    no toca `canonicalValues`/`contracts.entityA`/`entityB`, que siguen exactamente igual). Un
    contrato entra en `extraDebts` si no es Entidad A/B, su estado no es "settled" y su principal es
    positivo.
  - `debt-roadmap.html`: `renderDynamicAccountBlocks()` crea/retira bloques de forma idempotente por
    clave estable (`acct_<id-del-contrato>`) — si una cuenta ya existe solo se refresca su importe
    canónico, nunca se reconstruye el bloque (para no perder lo que el hogar ya haya tecleado); si un
    contrato desaparece (deuda liquidada), su bloque se retira sin afectar a las demás cuentas. El
    motor de cálculo (`legacy-debt-roadmap-engine.js`) no necesitó ningún cambio: ya aceptaba una
    lista `accounts` de longitud arbitraria desde antes de `D1`.
  - **Entidad A y Entidad B mantienen su comportamiento y sus ids exactos** (`cb_*`/`bk_*`, siempre
    los dos primeros índices de `accounts`): la paridad histórica ya verificada (`A9-8`,
    `e14bLegacyParityConfig`/`renderE14bParity` en `app.js`, que lee esos campos por nombre desde el
    estado guardado) sigue intacta y no se ha tocado. Esto fue una decisión deliberada de alcance:
    generalizar también esa paridad habría sido un cambio mucho mayor, sobre una comparación
    histórica ya cerrada, para un beneficio que esta fase no necesitaba.
  - **Límite de alcance documentado a propósito**: el gráfico de evolución de saldo sigue mostrando
    solo Total + Entidad A + Entidad B como líneas individuales; las cuentas adicionales contribuyen
    correctamente al total y a su propia columna de tabla, pero no reciben una línea propia en el
    gráfico en esta fase — una limitación real, no una limitación de cálculo.
- **Validación**: `npm run verify` completo en verde — **4.867/4.867 pruebas unitarias** (14 nuevas:
  3 en `tests/canonical-e14-debt-adapter.test.cjs`, 11 en `tests/d1-fase2-cuentas-canonicas.test.cjs`),
  lint, typecheck, accesibilidad, rendimiento, build del sitio, privacidad y smoke test. Los 10 casos
  dorados de deuda y las invariantes de motor siguen pasando sin ajustes.
  - Verificado a mano en navegador (Playwright), montando un iframe con el mismo protocolo de
    mensajes que usa `app.js` de verdad: una cuenta nueva simulada correctamente (importe canónico de
    solo lectura, estrategia de refinanciación calculada y sumada al total), sus supuestos
    persistiendo tras un ciclo completo de recarga de página (no solo `localStorage` del propio
    iframe — el camino real, vía el estado que replica el padre), y el bloque de una cuenta retirado
    limpiamente cuando su contrato deja de estar en la cartera, sin afectar a la otra cuenta ya
    configurada. También verificado que, sin ninguna deuda adicional real declarada (el caso de hoy,
    con toda probabilidad), el comportamiento es pixel a pixel idéntico al de antes de esta fase.
- **Pendiente explícito para la siguiente sesión**: la Fase 3, ya confirmada por el hogar — un puente
  desde el sandbox al buzón de decisiones (`decisionInboxItems`), en su versión más segura (nunca
  escribe directamente en los contratos reales, solo genera una propuesta estructurada que el hogar
  aplica desde el flujo "Revisar y aplicar en Plan de deuda" que ya existe hoy).

## Cierre de sesión — 28 de septiembre de 2026 (255): `D1` Fase 1 — aportación extra puntual y comparación de tu propia configuración en el sandbox visual de deuda

- **Qué pidió el hogar**: retomando el pendiente que quedó abierto al cerrar `D6` (sesión 254), el
  hogar confirmó que quiere **ampliar** `D1` (el sandbox visual de deuda, `debt-roadmap.html` en
  `#deuda-simulador`), no retirarlo. Al investigar el propio archivo se descubrió un dato relevante
  no documentado hasta ahora: no es un simulador genérico — es la herramienta de una negociación real
  con dos acreedores concretos ("Entidad A"/`cb_*`, "Entidad B"/`bk_*`), con un tercero ya resuelto y
  reducido a un hito administrativo de CIRBE. El hogar confirmó que esa negociación **sigue activa**
  y aceptó un plan en tres fases con una puerta de decisión explícita en cada una:
  - **Fase 1** (esta sesión): mejoras de visualización y de simulación, sin generalizar el modelo
    todavía. Confirmado.
  - **Fase 2** (pendiente, ya confirmada): generalizar el modelo fijo de 2 cuentas (`cb`/`bk`) a N
    cuentas alimentadas por los contratos canónicos reales, profundizando el puente de solo lectura
    que ya existe (`applyCanonicalReadModel`/`E14DebtAdapter`).
  - **Fase 3** (pendiente, ya confirmada, con salvaguarda explícita): un puente sandbox → plan real,
    en su versión más segura — el hogar pidió automatizar el envío pero **sin que el sandbox escriba
    nunca directamente en los contratos reales**: el escenario configurado se envía como propuesta
    estructurada al buzón de decisiones (`decisionInboxItems`), y el hogar la aplica desde el flujo
    de "Revisar y aplicar en Plan de deuda" que ya existe hoy. Esto preserva la garantía original del
    sandbox ("aquí se prueban estrategias sin escribir en esos datos").
- **Qué se construyó (Fase 1, completa)**: vive entera en `debt-roadmap.html` y
  `legacy-debt-roadmap-engine.js` — cero cambios en `app.js`, cero exposición a `ARQ-4`.
  - **Aportación extra puntual por cuenta**: dos campos nuevos por cuenta (`cb_extra`/`cb_extra_month`,
    `bk_extra`/`bk_extra_month`) que simulan un ingreso extraordinario reduciendo el saldo vivo en un
    mes concreto, independiente de la estrategia elegida (quita, refinanciación, híbrido o esperar).
    Por defecto es 0 y no cambia ningún resultado existente. Verificado que respeta las invariantes ya
    exigidas al motor (`canonical-scenario-invariants.js`): determinismo, capital nunca negativo y
    monotonía de amortización (aportar más extra nunca encarece el total ni retrasa el fin de la
    deuda).
  - **Comparación de tu propia configuración**: el comparador de escenarios (antes solo A/B/C, tres
    perfiles automáticos) añade una cuarta tarjeta, "Tu configuración actual", calculada en vivo desde
    los valores que el hogar ya ha tecleado — sin necesidad de ajustarlos a un perfil preestablecido
    para poder comparar.
  - Verificado a mano en navegador (Playwright), no solo con tests: la aportación extra desplaza el
    pago del mes exacto indicado (confirmado con una cifra real, 1.000€ en el mes 6 de Entidad B), la
    tarjeta "Tu configuración actual" calcula y compara correctamente, y los cuatro campos nuevos
    persisten tras recargar la página.
- **Validación**: `npm run verify` completo — **4.853/4.853 pruebas unitarias** (12 nuevas para esta
  Fase 1, en `tests/d1-fase1-extra-y-comparador.test.cjs`), lint, typecheck, accesibilidad,
  rendimiento, build del sitio, privacidad y smoke test, todo en verde. Los 10 casos dorados de deuda
  (`golden-debt-cases.test.cjs`) y las invariantes de motor (`canonical-scenario-invariants.test.cjs`)
  siguen pasando sin ajustes, como corresponde a un cambio puramente aditivo.
- **Pendiente explícito para la siguiente sesión**: arrancar la Fase 2 (generalización del modelo a N
  cuentas desde contratos canónicos reales) y, tras validarla, la Fase 3 (puente sandbox → buzón de
  decisiones). Ambas ya están confirmadas por el hogar — no hace falta volver a preguntar el qué,
  solo ejecutarlas con el mismo rigor que D6/esta Fase 1 antes de publicar cada una.

## Cierre de sesión — 27 de septiembre de 2026 (254): `D6` — benchmark de mercado real (Euribor+diferencial o manual) en el radar de refinanciación, con fecha y aviso de caducidad

- **Qué pidió el hogar**: al repasar el backlog heredado de `BACKLOG_CONTABILIDADCASA_2_0.md`, `D6`
  seguía aparcada porque el tipo fijo del radar de refinanciación (`DEB4`) era un número declarado
  una sola vez, sin fecha ni fuente — "una precisión que no tiene". Puesto a elegir entre anclarlo a
  un tipo de referencia público (Euribor + diferencial) o mantenerlo manual pero con fecha, el hogar
  pidió **poder elegir entre las dos**, no una sola.
- **Qué se construyó**: un selector "Fuente del tipo fijo de referencia (D6)" en la misma tarjeta de
  `DEB4`/`DI1` (Deuda › Apalancamiento). En modo "Euribor + diferencial habitual" el hogar declara el
  Euribor actual y su diferencial de banco; el tipo fijo se calcula solo (`deb4BenchmarkRate`,
  `round2(euribor + spread)`) y el campo manual pasa a solo lectura. En modo manual (el de siempre,
  por defecto) el hogar sigue tecleando el tipo él mismo. Cualquiera de los dos modos deja fecha
  (`benchmarkUpdatedAt`, mes en curso) **solo cuando el tipo resultante cambia de verdad** — no en
  cada guardado — y el radar muestra ahora "Tipo fijo de referencia (Euribor+diferencial/oferta
  manual): actualizado hace N mes(es)", con aviso si lleva 3 meses o más sin tocarse. Sin motor
  nuevo: reutiliza `round2`/`monthDistance`/`dateFromMonthKey`, ya existentes en `app.js`. Verificado
  a mano en navegador (Playwright): el cálculo Euribor+diferencial, el toggle de visibilidad de
  campos, el bloqueo a solo lectura del campo manual en modo Euribor, y la persistencia de los
  cuatro campos nuevos tras recargar la página.
- **Techo de líneas de `app.js` (`ARQ-4`) subido de 37.436 a 37.486, con motivo documentado**: las
  funciones de `DEB4` no se pudieron extraer de `app.js` a `views/inversion.js` como manda el
  remedio por defecto de `ARQ-4` porque `decisionInboxItems()` (bandeja de decisión de Hoy, `T3`) y
  `t6RefinanciarMemoContext()` (memo de decisión, `T6`) las llaman de forma eager, sin pasar por el
  fragmento lazy de Inversión — y el listener de arranque referencia `saveDeb4RadarSettings`
  directamente, sin `typeof`. Extraerlas de todos modos habría arriesgado el mismo tipo de fallo de
  arranque ya sufrido antes (sesión previa a `R-13`: "un arranque con una escritura remota en vuelo
  tumbaba la app entera"). Puesto el hogar a elegir entre subir el techo ~50 líneas o buscar una
  extracción equivalente en código ajeno a `D6` para hacer sitio, el hogar eligió subir el techo.
  `app.js` quedó en 37.479 líneas tras `D6` (detalle y motivo completo en el propio test,
  `tests/arq4-techo-app-js.test.cjs`).
- **Validación**: `npm run verify` completo — **4.841/4.841 pruebas unitarias** (6 nuevas para `D6`,
  más 2 ventanas de extracción de otros tests ajustadas a la nueva longitud de las funciones), lint,
  typecheck, accesibilidad, rendimiento, build del sitio, privacidad y smoke test, todo en verde.
  (El entorno de esta sesión no tenía `node_modules` instalado al empezar — `npm install` resolvió 7
  fallos iniciales de `esbuild` en los tests de `build:site`, sin relación con el código de `D6`.)
- **Pendiente explícito para la siguiente sesión**: el hogar pidió también reabrir `D1` (sandbox
  visual de deuda) para "ampliarlo o cambiarlo", sin llegar a concretar el qué antes de cerrar esta
  sesión — recoger el detalle concreto antes de tocar código, no asumirlo.

## Cierre de sesión — 26 de septiembre de 2026 (253): `R-13` — seleccionar partidas sueltas y confirmarlas juntas, además de por bloque o todas

- **Qué pidió el hogar**: al revisar `R-13` (individual/bloque/todas), faltaba poder marcar varias
  partidas sueltas (no todo un bloque) y confirmarlas de una vez — pedido explícito, ya comentado
  antes de construir la primera versión y repetido tras verla en producción.
- **Qué se construyó**: una casilla junto al bloque de cada fila todavía pendiente (sin real y con
  el mes abierto); al marcar una o más, la misma barra que ya decía «Confirmar todos los
  pendientes»/«Confirmar los pendientes de «Bloque»» pasa a decir «Confirmar N seleccionadas con su
  previsto» — la selección manda sobre el filtro de bloque activo, sin botón nuevo ni segunda
  barra. Sin selección, el comportamiento de antes (por bloque/todas) sigue intacto. Al confirmar,
  la selección se vacía sola (las filas confirmadas ya no son pendientes, dejan de tener casilla).
  Mismo camino de escritura y de deshacer que las dos formas anteriores — cada partida sigue
  quedando como su propio cambio reversible en el pie de impacto.
- **Techo de líneas de `app.js` (`ARQ-4`) otra vez sin margen** (37.436/37.436): casi toda la lógica
  nueva vive en `canonical-registrar-actuals-confirm.js` (`bulkButtonHtml` y `entriesForClick` ganan
  un parámetro `selectedKeys`/`selectedCount` opcional, con la selección con prioridad sobre el
  bloque); `app.js` solo añade el estado (`registrarActualsSelectedKeys`, un `Set`), la casilla en
  la fila y una rama en el listener de `change` ya existente — termina en las mismas 37.436 líneas.
- **Validación**: `npm run verify` completo — 4.835/4.835 pruebas unitarias (7 nuevas), lint,
  typecheck, accesibilidad, rendimiento, build del sitio, privacidad y smoke test, todo en verde.
  Comprobado a mano en navegador: seleccionar 2 de 29 pendientes sueltas, confirmar solo esas dos
  (la fila del medio, no marcada, sigue «Sin real»), y la barra vuelve a «Confirmar todos» tras
  vaciarse la selección.

## Cierre de sesión — 26 de septiembre de 2026 (252): `R-13` — el botón de confirmar previsto parecía un hipervínculo, corregido a botón real

- **Qué pidió el hogar**: tras verificar `R-13` ya en producción, el CTA «Confirmar previsto
  (importe)» de cada fila pendiente reutilizaba `.registrar-actuals-plan-link` (mismo estilo que
  «Ver en Plan» — texto subrayado, sin fondo ni borde) y parecía un hipervínculo, no una acción.
- **Qué se cambió**: el botón individual pasa a `.e19-btn.e19-btn-secondary` (la base real de
  botón que ya usa el resto de la app) con una variante compacta nueva
  (`.registrar-actuals-confirm-btn`, mismo patrón que `.savings-goal-btn` en Plan — solo
  padding/tamaño de fuente reducidos sobre la base, sin reescribirla). La barra de confirmación
  masiva no cambia: ya usaba esa misma base de botón desde el principio. Sin cambios de
  comportamiento ni de estructura HTML — solo la clase CSS del botón individual.
- **Validación**: `npm run verify` completo — 4.829/4.829 pruebas unitarias, lint, typecheck,
  accesibilidad, rendimiento, build del sitio, privacidad y smoke test, todo en verde.
  Comprobado a mano en navegador (captura antes/después).

## Cierre de sesión — 26 de septiembre de 2026 (251): `R-13` — confirmar el previsto como real sin teclear, en Registrar › Reales del mes (individual, por bloque o para todo el mes)

- **Qué pidió el hogar**: en la pestaña «Reales del mes» de Registrar, no obligar a teclear el
  importe real partida por partida cuando el previsto ya es lo ocurrido — una opción de «confirmar a
  real», de forma individual, por grupos (bloque) o para todas a la vez.
- **Qué se construyó**: un tercer camino de escritura del real, junto al tecleo manual y a la
  sugerencia de DEX7 — confirmar copia el previsto tal cual al real (`actuals[key] = previsto`), por
  el mismo camino de escritura y de deshacer que teclear a mano
  (`actualsForKind`/`saveActualsForKind`/`registrarRecordSessionChange`): cada confirmación queda
  como su propio cambio reversible en el pie de impacto de la sesión (verificado en navegador — 29
  confirmaciones aparecieron como «29 cambio(s) sin consolidar», con Descartar/Guardar independientes
  de cualquier otro cambio). Tres puntos de entrada: un enlace «Confirmar previsto (importe)» bajo
  cada fila todavía sin real; una barra bajo los filtros de bloque que dice «Confirmar
  todos/los pendientes de «Bloque» con su previsto (N partidas)» — reutiliza los mismos chips de
  bloque ya existentes como selector de grupo, sin añadir una segunda superficie de filtro; y, a
  igualdad de mecanismo, «todos» es solo «todos los bloques» sin filtro activo. Ninguna fila con real
  ya registrado se toca (evita pisar una desviación real ya anotada); el mes cerrado sigue de solo
  lectura, igual que el resto de la pestaña.
- **Techo de líneas de `app.js` (`ARQ-4`) sin ningún margen** (37.436/37.436 antes de tocar nada): el
  motor entero vive en `canonical-registrar-actuals-confirm.js` (nuevo, UMD, inyectando
  `actualsForKind`/`recordSessionChange`/`round2` igual que ya hace `p2-private-store.js` con el
  cifrado); `app.js` solo referencia el módulo y cablea un único listener delegado en el panel
  (`registrarActualsPanel`, sustituye al que solo escuchaba `registrarActualsBody`) — termina en las
  mismas 37.436 líneas, sin subir el techo.
- **Validación**: `npm run verify` completo — 4.829/4.829 pruebas unitarias (16 nuevas en
  `tests/r13-confirmar-previsto-como-real.test.cjs`, directas contra el módulo con `require()`, sin
  `vm`), lint, typecheck, accesibilidad, rendimiento, build del sitio, privacidad y smoke test, todo
  en verde. `tests/arq3-canonical-sin-consumidor-ui.test.cjs` (65→66→67 motores) y
  `service-worker.js` (`SHELL_URLS`, caché offline de `ARQ-5`) actualizados con el fichero nuevo;
  `tests/r6-r6b-r7-registrar.test.cjs` actualizado tras consolidar el listener de navegación en el
  panel. Comprobado también a mano en navegador (Playwright contra `dist/`): confirmación individual
  y masiva, badge de la pestaña pasando de «29 sin real» a «Al día», estado de cada fila a
  «Registrado».
- Tarea sin ID de backlog previo — petición directa del hogar sobre una pantalla ya construida, no
  del plan priorizado; se numera `R-13` (siguiente libre de la serie de Registrar, `R-1`…`R-12`) solo
  para trazabilidad futura.

## Cierre de sesión — 26 de septiembre de 2026 (250): trabajo duplicado detectado entre dos sesiones paralelas sobre `NAV-5`, y corrección de numeración de sesión en el backlog

- **Qué pasó**: esta sesión abrió Modo Inicio, leyó el backlog y construyó `NAV-5` de forma
  independiente (pregunta rápida determinista en el lanzador) sin saber que otra sesión
  (`session_019GozDchBYZuoekwyJ6ts8e`) había hecho exactamente lo mismo en paralelo y ya lo había
  fusionado a `main` como el PR #382, junto con `I13` (#383) y una corrección de arranque (#384) —
  ninguno de los tres visible en el `git log` local hasta volver a hacer `git fetch` al abrir el PR
  propio. El diseño de ambas implementaciones era funcionalmente equivalente (mismo cuarto tipo de
  resultado del lanzador, misma fuente `unifiedActionCenterModel`/`ExecutiveReadModel`, misma
  prioridad frente a UX6): no había nada que rescatar de la versión propia.
- **Qué se hizo al detectarlo**: se cerró el PR propio (#385) con un comentario explicando la
  duplicación y remitiendo al PR ya fusionado, sin intentar fusionar ni resolver el conflicto real
  que habría producido — habría sido trabajo repetido sin ningún valor neto. La rama de trabajo se
  reinició desde `origin/main` (ya con `NAV-5`/`I13`/el fix de arranque incluidos).
- **Corrección real que sí faltaba**: las filas de `NAV-3`, `FLU-3` y `PROC-1` en
  `BACKLOG_CONTABILIDADCASA_3_0.md` (§2.3, §2.4, §2.6 y el resumen de §6) seguían citando «sesión
  245» (la de los adjuntos de P2); esa decisión se tomó en realidad en la sesión 246, según
  `PROJECT_STATE.md`. La otra sesión paralela no la corrigió porque no la vio — corregidas aquí las
  cuatro referencias. Sin efecto funcional, solo trazabilidad hacia atrás.
- **Validación**: `npm test` — 4.813/4.813 pruebas unitarias en verde (cambio solo de
  documentación, sin tocar código).
- **Lección para el hogar**: si en algún momento se abren varias sesiones de Claude Code a la vez
  sobre este repositorio pidiendo «qué sigue en el backlog», hay riesgo real de que dos elijan la
  misma tarea siguiente y la construyan por duplicado — como ha pasado aquí. No hay coste
  irreversible (el trabajo duplicado se descarta sin fusionar), pero sí conviene saberlo si se va a
  repetir el patrón de varias sesiones concurrentes.

## Cierre de sesión — 25 de septiembre de 2026 (249): bug real — un arranque podía tumbar la app entera con «No se pudo cargar la app / No se puede recuperar la cola durante una escritura»

- **Qué pidió el hogar**: reportó un error intermitente que a veces veía al abrir la app —
  captura de pantalla con el título «No se pudo cargar la app» y el detalle «No se puede
  recuperar la cola durante una escritura.» — y preguntó si se podía solucionar.
- **Diagnóstico**: el mensaje viene literalmente de `remote-save-queue.js` (`hydrate()`), que
  lanza a propósito si se intenta reescribir la cola de guardado remoto mientras una escritura
  sigue en vuelo (invariante correcto: nunca pisar el estado a medias de un guardado). El fallo
  real estaba en quien lo llama: `resumeStartupRecoverySync()` y `loadRemoteStateOnce()`
  (`app.js`) llaman a `hydrate()` durante el arranque sin comprobar antes si hay una escritura en
  curso — y `init().catch()` trata esa excepción exactamente igual que un `ReferenceError` real,
  sustituyendo toda la página por «No se pudo cargar la app». Reproducible en el hogar (uso
  normal, varias pestañas o una recuperación de sesión anterior en curso), no en los 4810 tests
  (que no ejecutan `init()` de verdad — mismo patrón de hueco que ya documentó `PERF-1`, sesión
  11, para los `ReferenceError` de entonces).
- **Qué se construyó**: nueva `hydrateWhenIdle(state)` en `remote-save-queue.js` (no en `app.js`
  — es el sitio natural, junto al propio `hydrate()`, y no cuenta para el techo de `ARQ-4`, que
  tras `I13` quedó exactamente en su límite). Espera con `await drain()` a que cualquier
  escritura en curso termine — `drain()` dispara la ya en marcha o resuelve al momento si no hay
  ninguna, coste cero en el caso normal — y solo entonces llama a `hydrate()`, en la misma
  continuación síncrona, así que nada puede colarse en medio. `hydrate()` en sí no cambia: sigue
  lanzando si se le llama directamente con una escritura en curso, mismo contrato que ya prueban
  sus tests existentes. Los tres puntos de `app.js` que llamaban a `.hydrate()` pasan a
  `await ... .hydrateWhenIdle()`.
- **Validación**: `npm run verify` completo — **4813/4813 pruebas** (3 nuevas en
  `tests/remote-save-queue.test.cjs`: la carrera reproducida de verdad con una escritura que no
  se resuelve hasta que el test lo decide, el caso sin escritura en curso, y el cableado de los
  tres puntos de `app.js`), lint y typecheck limpios, accesibilidad (1398 IDs únicos, sin cambio),
  rendimiento, build del sitio, privacidad y smoke test en verde.
- **Publicado según el flujo ya autorizado en `CLAUDE.md`**: commit y push a la rama de trabajo en
  curso (reiniciada desde `origin/main` tras la fusión de `I13`, sesión 248), PR en borrador, fusión
  a `main` en cuanto el CI esté en verde.

## Cierre de sesión — 25 de septiembre de 2026 (248): `I13` construida — comparador de destino para un ingreso extraordinario ajeno a la cartera, extendiendo `AP1` en vez de una pantalla nueva

- **Qué pidió el hogar**: con el horizonte 4 de `BACKLOG_CONTABILIDADCASA_3_0.md` completo (sesión
  247), lo único que quedaba con alguna vía de avance hoy era resolver una de las tareas
  condicionadas a una decisión del hogar. Puesta la elección delante del hogar (`D1`, `D6`, `I3`,
  `I6`, `I13`), eligió `I13` y pidió una propuesta concreta de qué comparador construir antes de
  tocar código — mismo criterio que ya exigía su propia nota de origen (sesión 217).
- **Investigación previa, antes de proponer nada**: de las cuatro patas que pedía la nota original
  del hogar sobre `I13` ("¿a dónde va este dinero? deuda/inversión/colchón/objetivo"), tres ya
  existían: `AP1` (`compareAmortizeVsInvest`, `canonical-debt-comparator.js`) ya deja declarar
  cualquier importe y horizonte y compara amortizar vs. invertir, con el guardarraíl de colchón
  (`DLX1`/`amortizeCushionGuardrail`) pintado antes de la lectura; `DLX2`
  (`surplusAllocationRule`, `canonical-cushion.js`) ya reparte ese mismo importe entre
  colchón/deuda/inversión según el veredicto de `AP1`. Solo faltaba "objetivo de ahorro" —
  ninguna pieza calculaba el efecto de destinar el importe a un objetivo de Plan › Ahorro y
  objetivos (`P-13`/`P-16`).
- **Qué se construyó**: `i13SavingsGoalImpact()`/`i13SavingsGoalImpactHtml()` en
  `views/inversion.js` (no en `app.js` — `ARQ-4` tenía solo 1 línea de margen antes del techo, así
  que el código de esta pantalla se quedó donde pertenece, no en el motor compartido). Sin motor
  financiero nuevo ni supuesto de rentabilidad: resta el acumulado real del objetivo (`P-16`,
  nunca una previsión) del importe objetivo declarado (`P-13`) y dice cuánto queda antes y
  después de destinarle el importe — `P-13` no guarda ningún ritmo mensual de aportación, así que
  deliberadamente **no** promete "cuántos meses se adelanta" (esa cifra no existe hoy en la app).
  Nuevo selector opcional `ap1SavingsGoalSelect` en la propia tarjeta de `AP1` (Deuda ›
  Apalancamiento), junto al importe ya declarado — mismo criterio de filtrado que
  `sobresGoalDestinoOptions` (`P-16`): solo objetivos con importe declarado y sin completar. La
  lectura del objetivo es independiente del veredicto amortizar/invertir de `AP1` y del reparto
  automático de `DLX2` — una comparación aparte, no una cuarta rama de ese reparto automático.
  `handleAp1Compare` la llama sin guarda `typeof`: el botón que la dispara solo es alcanzable tras
  cargarse el fragmento lazy de esta pantalla (`VIEW_CHUNKS`), así que la comprobación habría sido
  defensa contra un caso que no puede darse.
- **Nada de fiscalidad ni ejercicio de opciones**: mismo alcance acordado para `I8` — este dinero
  no viene de vender cartera, así que no lleva su tratamiento fiscal (eso sigue siendo `I8`), y el
  ejercicio de opciones sigue fuera, sin confirmar con el hogar si aplica a su situación real.
- **Hallazgo de arquitectura durante la construcción**: `ARQ-4` (techo de líneas de `app.js`)
  estaba a solo 1 línea de su techo (37.435 de 37.436) antes de empezar. La primera versión, con
  las cuatro funciones nuevas en `app.js`, lo superó por 70 líneas. Solución real, no subir el
  techo: las cuatro funciones se movieron a `views/inversion.js` (código de una sola pantalla, tal
  como pide la cabecera del propio test de `ARQ-4`), y la porción que queda en `app.js`
  (`handleAp1Compare`) se compactó a una sola declaración — `app.js` termina exactamente en su
  techo (37.436), sin tocar `CEILING_LINES`.
- **Resultado de la validación**: `npm run verify` completo — **4810/4810 pruebas** (12 nuevas en
  `tests/i13-comparador-objetivo-ahorro.test.cjs`), lint y typecheck limpios, accesibilidad (1398
  IDs únicos), rendimiento, build del sitio, privacidad y smoke test en verde. Cinco archivos de
  test existentes (`ap1-app-integracion`, `ap2-app-integracion`, `deb3-opcionalidad-esperar`,
  `deb7-preferencia-declarada`, `deb9-sintesis-cancelar-mantener-deuda`) tenían aserciones con
  ventanas de texto de tamaño fijo ancladas al principio de `handleAp1Compare`; se ampliaron para
  seguir cubriendo el mismo contenido tras el cambio de tamaño de la función, sin tocar lo que
  verifican. Nota aparte: el contenedor de esta sesión arrancó sin el paquete `esbuild` instalado
  pese a estar en `package.json` (fallo de entorno, no de código — reproducido también en el HEAD
  limpio antes de tocar nada); `npm install esbuild@^0.28.2` lo resolvió y `build:site` pasó a
  verde.
- **Con esto, la única vía de avance sin depender de una condición externa o de otra decisión del
  hogar (`D1`, `D6`, `I3`, `I6`) queda agotada** — el resto de horizonte 4 y todo el horizonte 5
  siguen igual que al cierre de la sesión 247.
- **Publicado según el flujo ya autorizado en `CLAUDE.md`**: commit y push a la rama de trabajo en
  curso, PR en borrador, fusión a `main` en cuanto el CI esté en verde.

## Cierre de sesión — 25 de septiembre de 2026 (247): `NAV-5` construida — pregunta rápida determinista en el lanzador (Cmd/Ctrl+K), sin IA externa; horizonte 4 de `BACKLOG_CONTABILIDADCASA_3_0.md` queda completo

- **Qué pidió el hogar**: seguir con la siguiente oleada de desarrollos del backlog vigente. Tras
  revisar `BACKLOG_CONTABILIDADCASA_3_0.md` §6, `NAV-5` era la única tarea del horizonte 4 sin
  cerrar ni aparcar — el resto de ese horizonte ya estaba resuelto en sesiones anteriores.
- **Qué se construyó**: un cuarto tipo de resultado para el lanzador (Cmd/Ctrl+K), junto a la
  navegación (A12-3), la pregunta de importe (UX6) y la captura rápida de movimientos (DEX1/DEX2) —
  una pregunta rápida determinista, sin IA externa, que responde con una cifra ya calculada y su
  procedencia, sin navegar a ninguna pantalla. Sin motor nuevo: reutiliza tal cual
  `unifiedActionCenterModel`/`ExecutiveReadModel` (A2-6), el mismo modelo ejecutivo que ya cita
  fuente/método/confianza en Análisis (`renderE6KpiQuality`) y en los informes GOB14/P12.
  `e17ParseMetricQuery` reconoce seis preguntas por palabras clave (reserva protegida, liquidez,
  capacidad libre, cobertura hasta el próximo ingreso, deuda pendiente, fecha libre de deuda) y
  `e17MetricAnswerHtml` pinta la cifra con su fecha, fuente y confianza (traducida a alta/media/baja,
  mismo criterio que GOB14). Nunca compite con UX6 (que siempre exige un dígito) ni con DEX1/DEX2
  (verbos de captura distintos), y el modelo ejecutivo solo se resuelve cuando una frase ya coincide
  — nunca en cada tecla, para no repetir el patrón de recómputo caro que corrigió `ARQ-6`.
- **Puente barato mientras `A5-1` (Copiloto/IA) siga sin producción real** — ver §0.1 del backlog: no
  sustituye una IA real, evita depender de ella mientras tanto.
- **Resultado de la validación**: `npm run verify` completo tras `npm install` (el contenedor de esta
  sesión arrancó sin `node_modules`) — 4798/4798 pruebas, lint y typecheck limpios, accesibilidad
  (1397 IDs únicos), rendimiento, build del sitio, privacidad y smoke test en verde. 9 pruebas nuevas
  en `tests/nav5-pregunta-rapida-determinista.test.cjs`; `tests/ux6-busqueda-importes.test.cjs`
  actualizado para seguir cargando `renderE17Launcher` con la referencia nueva.
- **Con esto, el horizonte 4 de `BACKLOG_CONTABILIDADCASA_3_0.md` §6 queda completo**: todas sus
  tareas están cerradas salvo `NAV-3`, aparcada por decisión del hogar (sesión 245) — nada más
  accionable en ese horizonte hoy.
- **Publicado según el flujo ya autorizado en `CLAUDE.md`**: commit y push a la rama de trabajo en
  curso, PR en borrador, fusión a `main` en cuanto el CI esté en verde.

## Cierre de sesión — 25 de septiembre de 2026 (246): tercera decisión de la sesión 243 resuelta — `NAV-3` aparcada (no a la Cola B), `PROC-1` cerrada, y `FLU-3` construida con alcance acotado a Plan › Ahorro y objetivos

- **Qué pidió el hogar**: la tercera decisión abierta en la sesión 243 — si `NAV-3` (el recorrido de
  bienvenida) pasa a la Cola B, y seguir con `FLU-3` (Plan en móvil) como siguiente del horizonte 4.
- **`NAV-3` aparcada en el horizonte 4, no movida a la Cola B**: la Cola B (§4 del backlog) exige la
  condición de uso real medido (`ARQ-0` + conversación explícita del hogar) que `NAV-3` no necesita —
  su propio motivo («si alguien sin 200+ sesiones de contexto necesita entrar») no depende de ningún
  dato de uso. Moverla a la Cola B habría mezclado dos criterios de backlog distintos, justo lo que
  `PROC-1` existe para evitar. Se aparca en su lugar con el motivo anotado en su fila (§2.3): sin
  titular de caso de uso a la vista (el hogar lleva 245 sesiones de contexto acumulado), se retoma
  solo si el hogar lo pide o si aparece de verdad alguien sin contexto que necesite entrar.
- **`PROC-1` cerrada**: decisión de proceso sin código — se cierra formalizando el criterio, ya
  aplicado de hecho al decidir dónde aparcar `NAV-3`.
- **`FLU-3` construida, con alcance acotado tras investigar el código real**: de las tres pestañas de
  Plan, solo «Ahorro y objetivos» (`.plan-savings-goals-table`, una fila por objetivo) carecía del
  tratamiento móvil de `uxb1` (Presupuesto). «Mes» ya lo compartía (mismo código de fila que
  Presupuesto, misma regla CSS `.e19-plan-mes .presupuesto-mes-primary-table`); «Previsión» es una
  matriz ancha bloque × mes que no encaja en tarjetas — el desplazamiento horizontal que ya tiene es
  el patrón correcto para ese tipo de dato, igual que otras matrices de la app. Misma técnica que
  `uxb1`: `savingsGoalRowHtml` gana `data-label` en sus celdas de datos, y una regla CSS nueva
  convierte la fila en tarjeta por debajo de 640px.
- **Hallazgo al verificar en navegador antes de darlo por bueno**: la tabla salía a 1120px en móvil
  pese al `display:block; width:100%` — el `min-width: 0` que anula el `table { min-width: 1120px }`
  genérico de `styles.css` (E20-1) faltaba, mismo reset que ya usan otras cuatro pantallas de la app
  por el mismo motivo. Añadido y comprobado con Playwright antes de continuar.
- **Sin bump de `?v=` de `design-tokens.css`, a propósito**: el invalidador real de caché es
  `CACHE_NAME` en `service-worker.js`, reescrito en cada build con `ignoreSearch: true` en el propio
  Service Worker — el `?v=` por fichero es solo caché HTTP plana, compartida por una decena de tareas
  históricas (`T2`, `T8`, `V2`...) que la comprueban por su cuenta; bumpearla habría exigido tocar 10
  tests ajenos a este cambio sin ninguna necesidad funcional real.
- **Resultado de la validación**: `npm run verify` completo — 4789/4789 pruebas, lint y typecheck
  limpios, accesibilidad (1397 IDs únicos), rendimiento, build del sitio, privacidad y smoke test en
  verde. En navegador: `test:e2e` + `test:a11y-axe` 14/14 y `test:mobile-overflow` en verde (201
  visitas). 3 pruebas nuevas en `tests/flu3-vista-movil-plan-ahorro.test.cjs`.
- **Revisión mensual de Nielsen**: no vencida (última el 16 de septiembre, toca el 16 de octubre).
- **Las tres decisiones de la sesión 243 quedan resueltas** con esta entrada — ver también las
  sesiones 244 (cuatro pantallas) y 245 (adjuntos P2).
- **Publicado según el flujo ya autorizado en `CLAUDE.md`**: rama reiniciada desde `origin/main` tras
  fusionar la parte anterior (sesión 245, PR #380); commit y push a la rama de trabajo en curso, PR en
  borrador, fusión a `main` en cuanto el CI esté en verde.

## Cierre de sesión — 25 de septiembre de 2026 (245): documentos adjuntos (P2) — las fotos de ticket/factura ya pueden cifrarse y sincronizarse con la nube, con la clave privada pedida una sola vez por sesión

- **Qué pidió el hogar**: la segunda decisión abierta en la sesión 243. Antes de construir nada se
  investigó el código real, y el diagnóstico inicial («los adjuntos de P2 no tienen copia ni nube»)
  resultó ser solo parcialmente cierto — corregido delante del hogar antes de decidir: los documentos
  de acuerdos de deuda («Expediente privado» en Control de deuda) **ya tenían** nube cifrada desde
  antes; el hueco real y único eran las fotos de ticket/factura (`T11`/`A17-3`), que solo vivían en el
  dispositivo. El hogar confirmó, con esa corrección puesta delante: prácticamente ningún adjunto real
  todavía, y sincronizar el blob cifrado con la nube (mismo mecanismo que ya usa el expediente
  privado). Sobre la fricción de pedir la clave en cada foto, eligió pedirla **una sola vez por
  sesión** — nunca se persiste en ningún almacén — en vez de en cada captura.
- **Arreglo, en `p2-private-store.js`** (no en `app.js`, para no chocar con su techo de líneas de
  `ARQ-4`): `requestSessionKey()` (diálogo nativo `<dialog method="dialog">`, mismo patrón que
  `requestOperationConfirmation()` de `app.js` — promesa resuelta en el evento `close`),
  `saveAttachment(id, file)` (cifra y sube si hay clave de sesión; si la subida falla o no hay clave,
  cae a guardar solo en el dispositivo, nunca se pierde la foto) y `getOrDecrypt(link)` (dispositivo
  primero, nube y descifrado si hace falta). `app.js` pasa a llamar a estas tres funciones desde
  `handleMovementDetailAttachPhoto` (T11), `confirmReceiptCapture` (A17-3) y `viewReceiptAttachment`,
  sin motor propio duplicado.
- **Nuevo diálogo** `#p2SessionCloudKeyDialog` en `index.html`: pide la clave privada (12+
  caracteres) la primera vez que se adjunta o se ve una foto en la sesión, con opción explícita
  «Solo este dispositivo» que se recuerda el resto de la sesión sin volver a preguntar.
- **Techo de `app.js` (`ARQ-4`) respetado sin subirlo**: la primera versión de este cambio vivía
  entera en `app.js` y lo dejaba en 37.455 líneas, por encima del techo de 37.436 fijado en la sesión
  237. Antes de tocar el techo (que exige decisión explícita del hogar, no es la salida por defecto),
  se movió toda la lógica nueva a `p2-private-store.js` — mismo remedio por defecto que la propia
  cabecera del test de `ARQ-4` pide («extrae otra porción de `app.js`»). `app.js` termina en 37.399
  líneas, por debajo del techo.
- **Guardianes nuevos**: `tests/p2-private-store-session-key.test.cjs` (10 pruebas: activar con clave
  válida y recordarla, declinar y no repreguntar, clave corta cuenta como declinar, sin diálogo en la
  página, nube con éxito, caída a local si la subida falla, sin clave guarda local, y las tres
  combinaciones de `getOrDecrypt`). Los tests existentes de `T11`/`A17-3` actualizados para reflejar
  que el guardado vive ahora en `P2PrivateStore.saveAttachment()`, con un caso nuevo para el camino de
  nube.
- **Resultado de la validación**: `npm run verify` completo — 4786/4786 pruebas, lint y typecheck
  limpios, accesibilidad (1397 IDs únicos), rendimiento, build del sitio, privacidad y smoke test en
  verde. En navegador: `test:e2e` + `test:a11y-axe` 14/14 y `test:mobile-overflow` en verde (201
  visitas).
- **Revisión mensual de Nielsen**: no vencida (última el 16 de septiembre, toca el 16 de octubre).
- **Sigue pendiente del hogar**: la tercera decisión de la sesión 243 (`NAV-3` a la Cola B) se aborda a
  continuación en esta misma sesión.
- **Publicado según el flujo ya autorizado en `CLAUDE.md`**: rama reiniciada desde `origin/main` tras
  fusionar la parte anterior (sesión 244, PR #379); commit y push a la rama de trabajo en curso, PR en
  borrador, fusión a `main` en cuanto el CI esté en verde.

## Cierre de sesión — 25 de septiembre de 2026 (244): las dos decisiones de la sesión 243 sobre las cuatro pantallas resueltas — «Nuevo dato manual» a Registrar, y un quinto caso del mismo patrón descubierto y arreglado (Gobierno del dato y E9 eran invisibles desde el 15 de agosto, sin que el guardián de `ARQ-6` lo detectara)

- **Qué pidió el hogar**: seguir con el plan propuesto en Modo Inicio para las tres decisiones abiertas
  en la sesión 243. Sobre la primera («qué hacer con los restos de las cuatro pantallas»), el hogar
  confirmó la recomendación de la propia sesión: llevar «Nuevo dato manual» a Registrar antes de
  retirar nada, por ser la única alta suelta de un proyecto o de una liquidación de deuda uno a uno
  fuera de lote.
- **Verificación en navegador antes de tocar nada** (mismo criterio que toda la serie `ARQ-6`): antes
  de mover el formulario, se comprobó si dos paneles más de `#data-entry` — «Gobierno del dato:
  familia y paquete para asesor» (asignación de titular por serie + exportación PDF/Excel versionada
  con procedencia) y «E9 · Servicios opcionales pendientes de activación» — eran alcanzables. **No lo
  eran**: `p2-ui.js` los monta con `mount("data-entry", ...)`, gateado por `if (viewId === "data-entry")`,
  exactamente la misma redirección de R-10/R-11 (15 de agosto) que dejó ciegas a la copia de emergencia
  (241), el editor de series (242) y la bandeja/deshacer (243) — pero esta vez el guardián nuevo de
  `ARQ-6` (`arq6-controles-inalcanzables.test.cjs`) no lo detectó, porque analiza el HTML **estático**
  de `index.html` y estos dos paneles se insertan en tiempo de ejecución (`insertAdjacentHTML`). Un
  quinto caso del mismo patrón, con el añadido de un punto ciego real en el guardián que se creía
  exhaustivo.
- **Arreglo**: ambos paneles pasan a montarse en `#ajustes-datos` (Ajustes › Datos y exportación,
  donde ya vive la copia de emergencia desde la sesión 241), y el `render(viewId)` de `p2-ui.js` pasa a
  comprobar `viewId === "ajustes"`. De paso, «E9 · Servicios opcionales» decía «OpenAI API sin
  conectar» — contradecía la decisión de `A5-1` (sesión 164: el backend privado usa Anthropic, no
  OpenAI) desde que se escribió, invisible hasta ahora; corregido junto con la reparación.
- **«Nuevo dato manual»**: la tarjeta (con los mismos IDs — `manualDataKind`, `manualProjectMode`,
  `addManualData`...) pasa de `#data-entry` a la pestaña Lote y Excel de Registrar, junto a «Pegar
  tabla», «Importar fichero» y «Foto de ticket». Su única llamada a `populateDataEntryControls()`
  estaba gateada igual que el resto (`case "data-entry"` nunca llega): los selects de mes y bloque
  llevaban **vacíos desde el 15 de agosto**, doble fallo sobre el mismo formulario. Añadida a
  `renderRegistrar()`, que ya se ejecuta en cada render de Registrar.
- **Retirado, con decisión ya tomada** (no pendiente): «Añadir concepto» de `#update-data` (cubierto
  por «+ Registrar gasto», `FLU-2`, y Planificación de partidas) y los botones gemelos «Atrás»/
  «Continuar» de `#datos-importar` (el asistente real vive en Registrar › Importar extracto, R-8).
  `handleAddCustomConcept()` se elimina por quedar huérfana; `datosImportarUpdateBar()`/
  `renderDatosImportar()` ya se protegían con un `if (!nextButton || !backButton...) return`, así que
  no necesitaron cambios. Dos tests antiguos (`r8-registrar-importar-extracto`, `v4-4-importar-extracto`)
  afirmaban por escrito que esos botones «seguían intactos, nada retirado» — promesa que R-10/R-11 ya
  había roto en silencio en agosto; actualizados para reflejar la realidad actual.
- **Lo que queda tal cual, a propósito**: «Pegar tabla» e «Importar fichero» de `#data-entry` (ya
  duplicadas por el mismo motor en Registrar, R-9) — su retirada no estaba en el alcance decidido esta
  sesión, queda como decisión aparte del hogar.
- **Guardianes actualizados**: `KNOWN_UNREACHABLE_CONTROLS` de `arq6-controles-inalcanzables.test.cjs`
  refleja el nuevo reparto de IDs. Nuevo flujo en QA-1 (navegador) que confirma que los dos paneles de
  `p2-ui.js` son invisibles bajo `#data-entry` y visibles en Ajustes, y otro que confirma que «Nuevo
  dato manual» llega con los selects poblados y su alta queda en el justificante visible de Registrar.
- **Resultado de la validación**: `npm run verify` completo — 4775/4775 pruebas, lint y typecheck
  limpios, accesibilidad (1393 IDs únicos), rendimiento, build del sitio, privacidad y smoke test en
  verde. En navegador: `test:e2e` 8/8, `test:a11y-axe` 6/6 y `test:mobile-overflow` en verde (201
  visitas).
- **Revisión mensual de Nielsen**: no vencida (última el 16 de septiembre, toca el 16 de octubre).
- **Sigue pendiente del hogar**: la segunda y tercera decisión de la sesión 243 (documentos adjuntos de
  P2 sin copia ni nube; `NAV-3` a la Cola B) se abordan a continuación en esta misma sesión.
- **Publicado según el flujo ya autorizado en `CLAUDE.md`**: commit y push a la rama de trabajo en
  curso, PR en borrador, fusión a `main` en cuanto el CI esté en verde.

## Cierre de sesión — 25 de septiembre de 2026 (243): `ARQ-6` cerrada — «Deshacer último lote» y la bandeja vuelven a verse (en Registrar), cuatro fallos más destapados por el camino, y dos guardianes nuevos para que no se repita

- **Qué pidió el hogar**: seguir con el backlog vigente; aprobó el plan (resto del paso 3 de `ARQ-6`:
  `#data-entry` → comprobación automática de controles que nunca se ven → listas mantenidas a mano) y
  decidió **mover la bandeja y el deshacer a Registrar**. `NAV-3` (propuesta de pasarla a la Cola B)
  quedó sin respuesta: sigue donde estaba.
- **Promesa rota, reproducida en navegador antes de tocar nada**: Registrar › Lote y Excel dice «una
  sola entrada revertible por lote» y el asistente de extractos «se creará un lote que se puede
  deshacer después», pero el único botón `#undoLastImport` vivía en `#data-entry`, que desde el 15 de
  agosto redirige a Registrar y nunca se muestra. Tampoco se veía la bandeja «Revisar antes de
  incorporar», que reciben 7 orígenes (lote, CSV, Excel, extracto, ticket, captura rápida, plantilla).
  **Desde el 15 de agosto ninguna importación se podía deshacer.**
- **Arreglo**: bandeja (con su frescura de datos) y una tarjeta «Último lote incorporado» con
  `#dataImportLog` + «Deshacer último lote» pasan, con los mismos IDs, a un bloque de Registrar
  (`data-registrar-panels="import batch"`) que acompaña a las dos pestañas que crean lotes.
  `renderRegistrarTabs()` lo muestra solo en esas dos; `renderRegistrar()` pinta la bandeja (antes solo
  se pintaba en un `case "data-entry"` al que el enrutador nunca llega). Revisado en captura a 1280 y
  390px.
- **Cuatro fallos más, destapados al reproducir**:
  1. **El justificante de un lote confirmado desde Registrar se escribía en el registro oculto**: la
     vista previa se quedaba en pantalla con su botón «Confirmar e importar» como si nada hubiese
     pasado. `processDataRecords`/`applyImportedWorkbookData`/`applyE11bReceipt` aceptan ahora el
     registro de destino y `stageE7Import`/`stageE7Workbook` pasan el de Registrar.
  2. **Un lote del que no entraba ninguna línea decía «1 registro(s) incorporados»** (p. ej. un mes ya
     cerrado): `buildReceipt` (`canonical-e11b-inbox.js`) trataba el 0 como «sin dato» y contaba las
     filas de la vista previa. Ahora respeta el 0, y sin ninguna línea incorporada no hay justificante:
     queda el aviso con el motivo de cada línea y la entrada de la bandeja pasa a «Descartada».
  3. **«Reales» podía salir al día hasta el año 4175**: `dataFreshnessReport()` buscaba el primer
     «dddd-dd» de la clave del real, y el id de las partidas propias (`custom-<kind>-<Date.now()>-<hex>`)
     lo contiene ~4 de cada 10 veces. Afectaba a la frescura de la bandeja y al componente de frescura
     de la salud financiera (`A16-1`), que no veía reales caducados. Nuevo `actualKeyMonth()`: el mes es
     lo que va detrás del último «|».
  4. **Dos recortes que `T9` no veía** porque su comprobación solo visitaba la pestaña por defecto de
     cada pantalla: la tarjeta «Cámara» de Registrar › Lote y Excel acababa en x=1306 a 1280px
     (`.data-import-grid` con mínimos que sumaban ~1.050px; ahora `auto-fit`), y los pasos 3-4 de
     Registrar › Importar extracto a 360px (`.datos-importar-steps` sin salto de línea).
  Además, el botón «Deshacer» dentro de `.data-actions` salía con aspecto de desactivado (era a la vez
  `:first-child` y `:last-child`: fondo verde y texto gris); va en su propio contenedor.
- **Falsa alarma descartada**: el Service Worker sirve primero desde caché y `CACHE_NAME` no cambia en el
  fuente desde el 21 de agosto, pero `tools/build-public-site.mjs` lo reescribe en cada build, así que
  las versiones nuevas sí llegan a los dispositivos. Comprobado antes de decir nada.
- **Guardianes nuevos**:
  - `tests/arq6-controles-inalcanzables.test.cjs` (3 pruebas): ejecuta el enrutador real
    (`viewFromHash`) en un `vm` para saber qué pantallas no puede mostrar nunca (hoy `data-entry`,
    `update-data`, `datos-importar`, `update-hub`) y falla si en ellas aparece un control que el código
    usa. Los que quedan están listados con su motivo (trinquete en los dos sentidos). Es exactamente lo
    que habría avisado de la copia de emergencia (241), el editor de series (242) y el deshacer (243).
  - `tests/arq6-listas-de-navegacion.test.cjs` (4 pruebas): cada pantalla tiene título y cada título
    pantalla; cada pantalla visible tiene al menos una puerta (menú, tarjeta, navegación, Laboratorio o
    buscador); buscador, Laboratorio (entradas y destinos) y vistas diferidas apuntan a pantallas que se
    muestran; cada redirección aterriza en una pestaña real de Registrar. **Las listas cuadraban hoy** —
    las 4 pantallas sin enlace directo se abren desde Laboratorio o desde el flujo de Escenarios, y las 9
    que no están en el buscador fueron retiradas a propósito (Bloque 5).
  - `tests/arq6-bandeja-deshacer-en-registrar.test.cjs` (4 pruebas) y una prueba nueva en
    `canonical-e11b-inbox.test.cjs` (el 0 explícito).
  - Flujo nuevo en QA-1: entra por `#data-entry` (la tarjeta «Cargar CSV, Excel o un lote» de Hoy),
    exige bandeja y deshacer visibles, confirma un lote de un mes inexistente (0 importados, «Descartada»,
    ningún lote creado), confirma uno válido (justificante en Registrar, «Aplicada»), lo deshace desde la
    misma pantalla y exige las partidas de antes idénticas; comprueba que el bloque acompaña a Importar
    extracto y no a Saldos.
  - `tools/check-mobile-overflow.mjs` visita también cada pestaña interna (`button[aria-selected]`):
    177 → 201 visitas. Comprobado que detecta la tarjeta Cámara con la rejilla antigua.
  - Todas las pruebas nuevas comprobadas en rojo contra el código anterior (las 4 de la bandeja, 2 de 3
    del enrutador) o con una mutación (una pantalla fantasma sin título ni puerta).
- **`app.js`** 37.435 líneas, justo bajo el techo de `ARQ-4` (37.436): los comentarios nuevos se
  compactaron en vez de subir el techo.
- **Decisiones que quedan para el hogar**: retirar o no los restos de las cuatro pantallas redirigidas
  (el formulario «Nuevo dato manual» de `#data-entry` —único sitio para dar de alta un proyecto o
  liquidación de deuda uno a uno, fuera del lote—, «Añadir concepto» de `#update-data`, y los botones
  gemelos de `#datos-importar`); los documentos adjuntos de P2 (IndexedDB), que ni la copia ni la nube
  llevan; y `NAV-3` a la Cola B.
- **Resultado de la validación**: `npm run verify` completo — 4775/4775 pruebas, lint y typecheck
  limpios, accesibilidad (1408 IDs únicos), rendimiento, build del sitio, privacidad y smoke test en
  verde. En navegador: `test:e2e` + `test:a11y-axe` 12/12 en dos pasadas y `test:mobile-overflow` en
  verde (201 visitas, pestañas incluidas).
- **Revisión mensual de Nielsen**: no vencida (última el 16 de septiembre, toca el 16 de octubre).
- **Publicado según el flujo ya autorizado en `CLAUDE.md`**: commit y push a
  `claude/festive-maxwell-atgkup`, PR en borrador, fusión a `main` en cuanto el CI esté en verde.

## Cierre de sesión — 24 de septiembre de 2026 (242): los almacenes propios se sincronizan con la nube y el editor de series vuelve, en Planificación de partidas

- **Qué pidió el hogar**, respondiendo a dos de las tres decisiones abiertas en la sesión 241: «sí,
  sincronizad con la nube y recupera el editor de series». Antes de empezar se fusionó a `main` el
  PR #376 (sesión 241), con el CI en verde.
- **Sincronización con la nube de los 14 almacenes propios** (`app.js`):
  - `localStores` pasa de ir solo en el fichero de copia a formar parte de `appStatePayload()`, así que
    viaja en cada guardado en la nube y en la cola persistente de cambios pendientes, y se aplica al
    cargar desde la nube por el mismo `applyPersistedPayload()` que ya lo restauraba desde fichero. El
    servidor guarda el estado como `jsonb` libre: no hace falta migración.
  - Hueco que había que cerrar para que sirviera de algo: escribir uno de estos almacenes nunca pasaba
    por `queueRemoteSave()` (cada pantalla guarda el suyo por su cuenta al firmar un cierre, guardar un
    escenario, etc.). `storageSet()` avisa ahora cuando la clave es de la lista y agrupa la
    sincronización en ~1 s. Aplicar lo que llega de la nube o de una copia no la reenvía (sin eco).
  - Primera sincronización entre dos dispositivos: si el valor que llega es distinto del local, el local
    se conserva una sola vez con el sufijo `:antes-de-sincronizar`, para que lo que solo tenía uno de
    ellos no se pierda sin rastro. Un almacén que el estado entrante no trae nunca se borra.
  - La lista se declara ahora junto a `storageSet()`, que la consulta, para que ninguna escritura
    temprana la encuentre sin inicializar (lo fija una prueba).
  - `debt-capital-snapshot-at-close` sigue fuera, como decidía su propio comentario («no viaja a
    Supabase»). Documentado en `MDX2_FORMATO_EXPORTACION.md`.
- **Editor de series recuperado**: «Modificar una serie completa» pasa entero, con los mismos IDs, de
  `#data-entry` (oculta desde el 15 de agosto) a Planificación de partidas, junto a las partidas que
  modifica. Se rellena al abrir esa pantalla y escribe en su propio registro de mensajes
  (`#seriesEditorLog`, oculto mientras está vacío) en vez del de la sección huérfana. Su rejilla de 8
  columnas fijas (~1.100px) no cabía junto al menú lateral: pasa a columnas que se ajustan solas. De
  paso, un fallo antiguo a la vista en la captura: el rango por defecto era de un solo mes porque la
  línea de «hasta el último mes» nunca actuaba (un desplegable recién rellenado siempre tiene valor);
  ahora llega al último mes. Revisado en captura a 1280 y 390px.
- **Pruebas**:
  - `tests/arq6-copia-completa.test.cjs`: el estado que se envía lleva los almacenes, `storageSet()`
    avisa a la sincronización y la restauración no la reenvía; y una prueba nueva de
    `restoreBackupLocalStores` (no borra lo ausente, conserva una sola vez el valor local sustituido).
  - Dos flujos nuevos en QA-1 (navegador, CI): el editor de series desde Planificación (cambia el
    previsto de una serie en 3 meses y lo comprueba en `seriesOverrides`), y que escribir un almacén
    programa exactamente una sincronización, viaja en el estado y lo que llega de la nube se aplica
    sin reenviarse. Comprobado que fallan sin el aviso de `storageSet()` («Expected: 1, Received: 0»)
    y con el editor en su sitio antiguo («toBeVisible»).
- **Sigue abierto para el hogar**: la bandeja «Revisar antes de incorporar» y «Deshacer último lote»,
  que siguen en `#data-entry` sin otra puerta; los documentos adjuntos de P2 (ficheros en IndexedDB),
  que ni la copia ni la nube llevan; y el resto del paso 3 de `ARQ-6` (comprobación automática de
  secciones que nunca se muestran y listas mantenidas a mano).
- **Resultado de la validación**: `npm run verify` completo — 4763/4763 pruebas, lint y typecheck
  limpios, accesibilidad (1407 IDs únicos), rendimiento, build del sitio, privacidad y smoke test en
  verde. En navegador: `test:e2e` + `test:a11y-axe` 11/11 en dos pasadas y `test:mobile-overflow` en
  verde (177 visitas).
- **Revisión mensual de Nielsen**: no vencida (última el 16 de septiembre, toca el 16 de octubre).
- **Publicado según el flujo ya autorizado en `CLAUDE.md`**: commit y push a
  `claude/happy-archimedes-0nlcvh`, PR en borrador, fusión a `main` en cuanto el CI esté en verde.

## Cierre de sesión — 24 de septiembre de 2026 (241): `ARQ-6` paso 3 — la copia de emergencia estaba rota por partida doble: sin botón desde el 15 de agosto y perdiendo 14 almacenes; arreglada y vigilada

- **Qué pedía la sesión**: «sí, arranca con el paso 3», empezando por la copia de seguridad: que
  exportar e importar devuelva exactamente el mismo estado.
- **Inventario**: la copia (`downloadStateBackup` → `appStatePayload`) solo lleva el estado que guarda
  `saveLocalSnapshot`. La app escribe 58 claves distintas en el navegador; se clasificaron todas.
  Quince viven en su propia clave, fuera de ese estado, y ninguna entraba en la copia.
- **Reproducido en navegador antes de tocar nada**: rellenar cada almacén, descargar la copia con la
  función real, borrar el navegador, restaurar con el flujo real. Presupuestos (control) volvían; los
  15 almacenes, no. Entre ellos, historia que solo se acumula al firmar cada cierre y no se puede
  reconstruir: valoraciones por posición (`iv1-valuation-snapshots`, la que espera `I3`), previsiones
  congeladas (PVC6), aprendizaje previsto/real (C-13), diario de aprendizaje (PV5), archivo de
  informes de cierre, últimas mediciones de PV3/PVC17. Y lo que el hogar escribe a mano: escenarios
  guardados y tipos de decisión propios, oferta de reunificación, meses declarados no recurrentes
  (PVC16), nombres de plantilla de mes y movimientos ignorados al importar.
- **Arreglo, alcance mínimo**: campo nuevo `localStores` en el fichero de copia, con la lista
  `BACKUP_LOCAL_STORES` en `app.js` (14 almacenes; el 15.º, `debt-capital-snapshot-at-close`, queda
  fuera a propósito: su propio comentario lo define como aviso derivado que se regenera en el
  siguiente cierre). **Solo en el fichero, no en `appStatePayload()`**: la sincronización con la
  nube y sus huellas de conflicto no cambian. Restaurar reescribe los almacenes que trae la copia y
  nunca borra uno que no traiga, así que una copia anterior deja intactos los del navegador.
  `state-contract.js` lo trata como objeto opcional (una forma inválida se descarta) y lo cuenta en
  el resumen que ve el hogar al descargar y al restaurar; documentado en
  `MDX2_FORMATO_EXPORTACION.md` (su prueba obliga a hacerlo en el mismo commit).
- **Segundo fallo, más grave, destapado al escribir la prueba en navegador: no había ningún botón
  para hacer la copia.** La tarjeta «Copia y restauración verificable» vivía en `#data-entry`, que
  Registrar redirige desde R-10/R-11 (15 de agosto) y nunca se muestra. Ajustes › Exportar solo
  ofrecía CSV, PDF y calendario, aunque `MDX2_FORMATO_EXPORTACION.md` y el simulacro RGX1 decían que
  la copia estaba allí. Desde el 15 de agosto el hogar no podía descargar la copia de emergencia ni
  restaurar una, y tampoco usar la restauración ni la verificación de versiones en Supabase (misma
  tarjeta). La tarjeta pasa, entera y con los mismos IDs, a Ajustes › Datos y exportación, justo
  debajo de «Exportar». Revisada en captura a 1280 y 390px. El texto de RGX1 que mandaba a «Datos»
  apunta ahora a Ajustes.
- **Para que no vuelva a pasar**:
  - `tests/arq6-copia-completa.test.cjs` (4 pruebas, en `npm test`): toda clave que la app escribe en
    el navegador tiene que estar en el estado principal, en `BACKUP_LOCAL_STORES` o excluida con su
    motivo (15 exclusiones: derivados, preferencias y marcas del dispositivo, trabajo a medias). Falla
    ante una clave nueva sin clasificar y ante una exclusión que ya no existe; comprobado quitando
    `pv5-diary` de la lista y añadiendo un almacén ficticio. También fija que la copia lleva los
    almacenes, que la restauración los devuelve, que la nube no los recibe y el viaje por el contrato.
  - Flujo nuevo en QA-1 (navegador, en el CI): abre Ajustes, exige que «Descargar copia completa» se
    vea, la pulsa, borra el navegador, restaura desde el selector de fichero y exige el estado
    principal idéntico y los 14 almacenes de vuelta, sin errores de página. Comprobado que falla con
    la tarjeta en su sitio antiguo («toBeVisible») y sin la línea que mete los almacenes (lista los
    14 perdidos).
  - Lección de método: dos arranques de la prueba en navegador fallaron por artefactos míos (un
    servidor local viejo que Playwright reutilizaba sin reconstruir el sitio, y marcadores sin
    `monthKey`); se identificaron y descartaron antes de sacar conclusiones.
- **Pendiente del paso 3, con decisión del hogar**: `#data-entry` sigue huérfana con dos tarjetas que
  no tienen otra puerta en la app — el editor «Modificar una serie completa» y la bandeja «Revisar
  antes de incorporar». Sacarlas o retirarlas cambia pantallas, así que no se ha tocado. Además:
  una comprobación automática de secciones con controles que nunca se muestran, y las listas
  mantenidas a mano (buscador, menú, títulos, `VIEW_CHUNKS`, Laboratorio, guía contextual).
- **Decisiones que quedan abiertas para el hogar**: si estos 14 almacenes deben viajar también en la
  sincronización con la nube (hoy no pasan a otro dispositivo), y los documentos adjuntos de P2
  (ficheros en IndexedDB), que la copia en JSON no lleva.
- **Resultado de la validación**: `npm run verify` completo — 4762/4762 pruebas (4758 + 4 nuevas),
  lint y typecheck limpios, accesibilidad (1406 IDs únicos), rendimiento, build del sitio,
  privacidad y smoke test en verde. En navegador: `test:e2e` + `test:a11y-axe` 9/9 en dos pasadas y
  `test:mobile-overflow` en verde (177 visitas).
- **Revisión mensual de Nielsen**: no vencida (última el 16 de septiembre, toca el 16 de octubre).
- **Publicado según el flujo ya autorizado en `CLAUDE.md`**: commit y push a
  `claude/happy-archimedes-0nlcvh`, PR en borrador, fusión a `main` en cuanto el CI esté en verde.

## Cierre de sesión — 24 de septiembre de 2026 (240): `ARQ-6` paso 2 — las dos suites de navegador huérfanas estaban en rojo y escondían tres fallos reales (presupuesto congelado 14 s, Control de deuda 12 s, encabezados de Hoy); corregidos y en el CI. `OPT-10`-`OPT-13` aplazadas

- **Qué pedía la sesión**: arranque con el backlog vigente, con dos matices del hogar: (1) confirmar
  si `OPT-10`-`OPT-13` se habían aplazado un mes, y (2) antes del horizonte 4, buscar entregas marcadas
  «Verificado» que ninguna prueba mantiene, tras los dos casos de la sesión anterior (caché offline y
  recortes).
- **`OPT-10`-`OPT-13`, decisión del hogar**: lo que se aplazó el 23 de septiembre (sesión 225) fue la
  Cola B, no estas cuatro, que seguían venciendo el 28-29 de septiembre. Se alinean con ella: 23 de
  octubre y, antes de activarlas, preguntar si el uso ha sido intenso. Regla añadida porque retiran
  pantallas: una de uso menos que mensual (fiscal, informe trimestral/semestral, cierre anual) no se
  declara «sin uso» con una ventana de 30 días. Anotado en `BACKLOG_CONTABILIDADCASA_3_0.md` §5/§6 y en
  `BACKLOG_INDICE.md`.
- **Método de la búsqueda (`ARQ-6`, fila nueva)**: cruzar los identificadores de tarea con los nombres
  de las pruebas da una imagen falsa (60 de las 85 tareas A0-A13 no aparecen nombradas, pero las
  pruebas se organizan por módulo y los motores están bien cubiertos). Los dos fallos de la sesión 239
  no eran de cálculo sino de conexión entre piezas, así que se buscó esa clase. Primer caso concreto:
  `.github/workflows/pages.yml` no ejecutaba ninguna de las tres suites de Playwright del repositorio.
- **Las dos suites de comportamiento, ejecutadas tal cual: 2 de 8 en rojo.**
  - *QA-1, flujo de Presupuesto del mes*: agotaba su tiempo al editar un importe. Medido en el
    navegador: el manejador del cambio **bloqueaba la página 14.452 ms**. Perfilado: el 95 % en
    `monthObjectForBudgetKey` → `selectableMonths` → `forecastMonths`, que regenera los ~124 meses del
    modelo, cada uno con `toLocaleDateString` (~80 µs), para buscar uno solo, y eso por cada categoría
    y mes de cada tarjeta. Corrección mínima: `monthLabel()` memorizada por año-mes (`app.js`), con la
    caché dentro de la propia función para que siga funcionando cuando las pruebas la extraen suelta.
    HTML de la pantalla idéntico antes y después; **14.452 → 87 ms**.
  - *OPT-4, Hoy*: `heading-order` — el aviso de primeros pasos de DEX5 va delante del `h2` de la
    pantalla y usaba `h3`. Pasa a `h2` con el estilo exacto que tenía como `h3`; captura del aviso a
    1280 y 390px idéntica byte a byte.
- **Tercer fallo, al ampliar QA-1**: las 6 pantallas de las capturas de E18 se añadieron al recorrido
  de QA-1 (ver abajo) y el recorrido volvió a agotar su tiempo. Medido: **abrir Control de deuda
  bloqueaba la página ~11,7 s** y Deuda › Comparar ~2,8 s, de forma estable. Perfilado: `shortDate()`
  (misma familia: `toLocaleDateString` dentro de `canonicalEngineInput`, miles de veces por simulación,
  y Control de deuda simula una vez por candidato). Memorizada por día: **11,7 s → ~1,5 s** y 2,8 →
  0,13 s. El ~1,5 s restante es el coste repartido de simular cada candidato; bajarlo ya exigiría
  tocar el motor y no se hizo.
- **Para que no vuelva a pasar**:
  - `pages.yml` ejecuta `npm run test:e2e` y `npm run test:a11y-axe` detrás de la instalación de
    Chromium, igual que `test:mobile-overflow`.
  - QA-1 mide el tiempo: editar un presupuesto < 2 s, y ninguna tarea larga del hilo principal > 8 s
    en todo el recorrido (`PerformanceObserver` de `longtask`, que registra el bloqueo aunque la
    pantalla cargue su código en diferido; un primer intento con un cronómetro tras navegar **no**
    detectaba el fallo y se descartó). Comprobado a propósito: sin cada corrección, la prueba falla
    («#debt-control bloqueó la página 12032 ms»); con ellas pasa, 3 de 3 ejecuciones en paralelo.
  - `tests/qa1-opt4-navegador-en-ci.test.cjs` (6 pruebas, en `npm test`): las dos suites enganchadas
    al CI, los dos techos de tiempo presentes, el recorrido cubre las 6 pantallas de E18, y
    `monthLabel`/`shortDate` memorizadas sin cambiar su salida.
- **Capturas de E18, decisión**: no entran en el CI. Se hicieron en macOS con Chrome real
  (`*-darwin.png`); en Linux no hay referencia y el render de fuentes cambia entre máquinas, así que
  un píxel a píxel fallaría sin que nada esté roto. Su comportamiento lo cubre ahora QA-1 y su recorte
  `check-mobile-overflow`. Anotado en la cabecera de la suite y en la fila E18 de `BACKLOG_STATUS.md`.
- **Pendiente de `ARQ-6`, paso 3**: inventario promesa → guardián → ¿falla si se rompe?, empezando por
  la copia de seguridad (exportar e importar debe devolver el mismo estado, incluidos los almacenes
  añadidos después de definir el formato) y siguiendo por las listas mantenidas a mano. Va por delante
  del horizonte 4.
- **Resultado de la validación**: `npm run verify` completo — 4758/4758 pruebas (4752 + 6 nuevas), lint
  y typecheck limpios, accesibilidad (1406 IDs únicos), rendimiento, build del sitio, privacidad y
  smoke test en verde. En navegador: `test:e2e` + `test:a11y-axe` 8/8 en tres ejecuciones seguidas, y
  `test:mobile-overflow` en verde (177 visitas).
- **Revisión mensual de Nielsen**: no vencida (última el 16 de septiembre, toca el 16 de octubre).
- **Publicado según el flujo ya autorizado en `CLAUDE.md`**: commit y push a
  `claude/happy-archimedes-0nlcvh`, PR en borrador, fusión a `main` en cuanto el CI esté en verde.

## Cierre de sesión — 24 de septiembre de 2026 (239): `T9` redefinida y cerrada — 13 de 59 pantallas tenían contenido cortado en móvil (y 5-6 en escritorio); arreglado y vigilado en el CI

- **Qué pedía la sesión**: el hogar pidió «adelante con T9». Tal como estaba escrita, su siguiente
  incremento era invertir a mobile-first el bloque `@media (max-width: 860px)` compartido: 68
  selectores, 44 de ellos tocados también por otros `@media` de anchura, con un criterio de
  aceptación de «ningún cambio visible». Es decir, riesgo alto y beneficio cero para el hogar, el
  mismo perfil por el que `ARQ-4` quedó en pausa en la sesión 238.
- **Antes de invertir nada se midió qué falla de verdad en móvil**: se recorrieron las 59 pantallas en
  Playwright buscando elementos a la derecha del borde de la pantalla sin un contenedor desplazable
  que los recoja. `html`/`body` recortan el desbordamiento horizontal (sin barra), así que esos
  elementos ni se ven ni se pueden pulsar.
  - A 390px, **13 de 59 pantallas** tenían contenido cortado. Entre ellas, Hoy: «Guía de este flujo»
    y «Modo reunión» quedaban fuera de alcance.
  - No era solo móvil: a 1280px, un portátil normal, **5-6 pantallas** también. El botón «Añadir» de
    Planificación de partidas estaba entre los píxeles 1364 y 1451, fuera de la pantalla.
  - Aparte, a 375-414px las cuatro cifras de la cabecera del Plan de liquidación de deuda quedaban en
    una columna de 0-14px: sin recorte técnico, pero ilegibles.
- **Decisión del hogar**: redefinir `T9` como arreglar ese recorte (opción recomendada, frente a
  «solo Hoy» o «`T9` tal cual»). Lo que se tocara, en móvil primero.
- **Causas raíz y arreglos** (`styles.css`, `design-tokens.css`):
  - Columnas `1fr` que no bajan del ancho mínimo de su contenido: `minmax(0, 1fr)` en el bloque
    compartido de 860px, en el de 1280px, en Previsión (≤1080px) y en la lista de calidad de Nueva
    vida; `min-width: 0` en los hijos de `.debt-overview-grid`.
  - `fieldset` hereda del navegador un ancho mínimo igual al de su contenido: `min-width: 0` global.
    Es la causa de que Deuda › Comparar se cortase hasta en 1440px.
  - Rejillas de columnas fijas que no caben: `.visual-controls` (móvil primero: 2 columnas de base,
    las 4 de siempre desde 761px), `.advisor-layout` (1 columna de base, 2 desde 761px),
    `.debt-executive-hero` (1 de base, 2 desde 600px), `.debt-form` (`minmax(0, 1fr)`) y
    `.visual-add-grid`. Esta última sumaba ~1180px y no cabía en ninguna pantalla real con el menú
    lateral: pasa a `repeat(auto-fill, minmax(150px, 1fr))`, sin media query.
  - Filas flex sin salto: pestañas de Deuda y pasos de Cierre con `flex-wrap`; cabecera de
    Movimientos en fila solo desde 861px; bandas de colchón y patrimonio de Análisis con
    desplazamiento horizontal propio (una columna por mes no cabe en un móvil).
- **Verificación**:
  - Contenido cortado, antes → después: 13 → 0 pantallas a 390px, y 0 también a 360, 375 y 414px.
    A 768, 1024 y 1280px, 0 salvo un falso positivo (un radio invisible a propósito en Simulador).
  - Escritorio comparado **elemento a elemento** en 861/1024/1280/1440px contra `main` (captura de
    referencia determinista: dos capturas seguidas de `main` salen idénticas). Solo cambian las
    pantallas que tenían recorte, más Deuda › Ruta a 861-1024px, y ahí para bien: sus pestañas
    medían 360px dentro de una tarjeta de 217, invadían la columna de al lado y partían su propio
    texto en dos líneas; ahora pasan a otra línea.
  - Capturas revisadas: Hoy a 390px (controles en 2×2, todos alcanzables) y Planificación de partidas
    a 1280px («Añadir línea» visible).
- **Para que no vuelva a pasar**: `tools/check-mobile-overflow.mjs` (`npm run
  test:mobile-overflow`) recorre todas las pantallas del `dist/` a 360/768/1280px y falla si algo
  queda cortado. Va en `.github/workflows/pages.yml` detrás de la instalación de Chromium, igual que
  el presupuesto de Lighthouse: fuera de `npm run verify` porque necesita navegador, pero corre en cada
  PR (~3 minutos). Comprobado que falla contra el `dist/` de `main` (22 casos listados) y pasa con el
  arreglo (177 visitas). `tests/t9-recorte-pantalla.test.cjs` (4 pruebas, en `npm test`) impide
  desengancharla y fija las dos causas más graves (`fieldset`, `.visual-add-grid`).
- **`T9` queda cerrada**: lo que queda de la inversión pura a mobile-first no cambia nada visible, y
  el riesgo real que cubría (pantallas rotas en móvil) ya lo vigila una prueba. Se reabre solo si el
  hogar lo pide. Con esto el **horizonte 3 de `BACKLOG_CONTABILIDADCASA_3_0.md` queda completo**.
- **Resultado de la validación**: `npm run verify` completo — 4752/4752 pruebas (4748 + 4 nuevas),
  lint y typecheck limpios, accesibilidad (1406 IDs únicos), rendimiento, build del sitio,
  privacidad y smoke test en verde; `npm run test:mobile-overflow` en verde contra el `dist/` final
  (177 visitas: 59 pantallas a 360/768/1280px).
- **Revisión mensual de Nielsen**: no vencida (última el 16 de septiembre, toca el 16 de octubre).
- **Publicado según el flujo ya autorizado en `CLAUDE.md`**: commit y push a
  `claude/admiring-sagan-c5wwtl`, PR en borrador, fusión a `main` en cuanto el CI esté en verde.

## Cierre de sesión — 24 de septiembre de 2026 (238): `ARQ-5` — la caché offline llevaba semanas incompleta; restablecida y blindada con prueba. `ARQ-4` en pausa

- **Qué pedía la sesión**: el hogar propuso dejar Visual Detail donde está y «empezar por la caché
  offline». No había ninguna tarea con ese nombre en `BACKLOG_CONTABILIDADCASA_3_0.md`, así que antes
  de proponer plan se comparó `SHELL_URLS` (`service-worker.js`) con lo que `index.html` carga.
- **Hallazgo**: 30 de los 65 `canonical-*.js` que `index.html` carga al arrancar no estaban en la caché
  offline (entre otros `canonical-period.js`, `canonical-tax-tables.js`, `canonical-portfolio.js`,
  `canonical-irpf-estimator.js`, `canonical-health-score.js` y los cuatro de apalancamiento), y
  tampoco `views/estado-semana.js`, que sí está en `VIEW_CHUNKS`. El más antiguo lleva sello de
  versión del 9 de agosto. Causa: la lista se mantenía a mano y solo se tocaba al añadir una vista a
  `views/`; `tools/build-public-site.mjs` ya tenía una guarda equivalente para `dist`, pero nunca se
  extendió al Service Worker. A0-4 seguía marcada «Verificado» en `BACKLOG_STATUS.md`.
- **Reproducido en navegador antes de tocar nada** (Playwright, sitio construido desde `main`: primera
  visita con red, después recarga sin red): 32 peticiones fallidas (los 30 motores más Supabase por
  CDN y `supabase-config.js`) y **ningún error de JavaScript**: la app abría y parecía sana. Al
  recorrer las 59 pantallas con y sin red, 21 cambiaban; descontado el ruido del propio recorrido,
  la degradación real era Hoy sin «Salud financiera compuesta» ni fecha de libre de deuda, Estado de
  la semana casi vacía (1.136 → 427 caracteres), Previsión sin resumen por periodo, e Inversión,
  Seguros, Patrimonio, Deuda y Cierre sin parte de sus avisos. Un fallo silencioso: nadie lo habría
  notado salvo usando la app sin conexión y comparando.
- **Corregido**: los 30 motores y `views/estado-semana.js` entran en `SHELL_URLS` (74 → 105 recursos
  en caché medidos contra `main` antes de la fusión de la sesión 237; con su `canonical-savings-agent.js`
  y `views/savings-agent.js`, que esa sesión sí añadió, son 107). Única exclusión, deliberada: `supabase-config.js`, por el criterio de A0-4 («no se
  almacenan credenciales … en caché compartida»); sin red no hay sincronización remota posible y la
  app sigue en modo local. Supabase por CDN es de otro origen y el Service Worker no lo intercepta.
- **Verificado en navegador después del arreglo**: sin red solo fallan las dos peticiones de
  Supabase, y las 59 pantallas pintan lo mismo que con red. Las 3 diferencias restantes (contador de
  visitas de Ajustes, marcas de tiempo de Auditoría de datos, texto de paridad de Hoja de ruta) salen
  idénticas comparando dos pasadas con red, así que son ruido del recorrido, no de la caché.
- **Para que no vuelva a pasar**: `tests/arq5-cache-offline-completa.test.cjs` (4 pruebas). Todo
  recurso local de `index.html` (mismo criterio que la guarda de la build) y toda vista de
  `VIEW_CHUNKS` tienen que estar en la caché; toda entrada de la caché tiene que existir y
  publicarse, porque `precacheFreshShell()` usa `Promise.all` y un solo 404 tumbaría la instalación
  entera; las exclusiones llevan motivo y fallan si sobran. Comprobado que las dos primeras pruebas
  fallan con el `service-worker.js` de `main` y pasan con el arreglo.
- **Decisión del hogar: `ARQ-4` en pausa** («dejar Visual Detail donde está»). Esta sesión arrancó
  sobre un checkout anterior a la fusión de la sesión 237 (Agente de ahorro ya movido), y lo
  descubrió al ir a publicar; con esa fusión incorporada, solo queda Visual Detail, la de más riesgo
  (cambios en borrador del hogar) y sin efecto visible para él. El techo de `app.js` ya impide que
  el fichero vuelva a crecer. Se reanuda solo si el hogar lo pide o si hay que tocar Visual Detail
  por otro motivo. Coincide con la recomendación que ya dejó escrita la sesión 237.
- **Documentación**: fila `ARQ-5` nueva y `ARQ-4` en pausa en `BACKLOG_CONTABILIDADCASA_3_0.md`
  (§2.2 y §6); A0-4/E3 y el riesgo de caché offline anotados en `BACKLOG_STATUS.md`, sin cambiar su
  estado (vuelve a cumplirse, ahora con prueba).
- **De paso, una prueba intermitente arreglada de raíz** (fuera de lo pedido, pero salió al validar:
  falló 1 de 3 ejecuciones de `npm test`; la sesión 237 la vio también y la dejó como «ajena»). `tests/lev14-apalancamiento-escalonado.test.cjs`
  comparaba con `deepEqual` dos resultados de `simulateLeverage()` que llevan cada uno su
  `evaluatedAt: new Date()`; si las dos llamadas caían en milisegundos distintos, fallaba. La prueba
  compara ahora todo salvo esa marca de tiempo (y exige que ambas la tengan), sin tocar el motor.
- **Resultado de la validación**: `npm run verify` completo, tras incorporar `main` con la sesión 237 —
  4748/4748 pruebas (4744 + 4 nuevas; antes de la fusión, 4735/4735), lint y typecheck limpios, accesibilidad (1406 IDs únicos), rendimiento, build del sitio,
  privacidad y smoke test en verde.
- **Revisión mensual de Nielsen**: no vencida (última el 16 de septiembre, toca el 16 de octubre).
- **Publicado según el flujo ya autorizado en `CLAUDE.md`**: commit y push a
  `claude/admiring-sagan-c5wwtl`, PR en borrador, fusión a `main` en cuanto el CI esté en verde.
- **Nota para quien publique en producción**: la build reescribe `CACHE_NAME` en cada despliegue, así
  que los navegadores con el Service Worker viejo instalan la caché nueva completa en su próxima
  visita con red. No hace falta ninguna acción manual del hogar.
## Cierre de sesión — 24 de septiembre de 2026 (237): `ARQ-4`, tercer incremento — Agente de ahorro a `views/savings-agent.js` y núcleo de su motor a `canonical-savings-agent.js`

- **Qué pidió el hogar**: «adelante con la opción A y cerramos». La opción A, propuesta al cerrar la
  sesión 236, era mover el Agente de ahorro junto con su motor, no solo la pantalla, y dejar Visual
  Detail en pausa por riesgo.
- **El bloqueo era real, pero se resolvía cambiando el patrón de refresco** (igual que Conciliación,
  sesión 233). `applyAgentRouteSimulation()` se dispara desde Hoy (centro de acciones unificado,
  «simular ruta») y desde Ejecutivo, Nueva vida, Plan de deuda y Asesor virtual. En sus dos salidas
  «nada que aplicar» repintaba el Agente aunque no estuviera abierto.
  - Las cuatro llamadas de `app.js` llevan ahora la guarda `viewChunkLoaded("savings-agent")`.
  - `renderSavingsAgent()` no tiene efectos de estado que conservar: solo pinta su sección y calienta
    cachés que se recalculan por firma al entrar.
  - El `change` de `#agentYear` pasa a una función flecha, porque cablear `renderSavingsAgent` por
    referencia habría lanzado un `ReferenceError` en `init()`.
- **Reparto del motor, según sea puro o no** (matiz frente a lo que se propuso):
  - `canonical-savings-agent.js` (nuevo, UMD): la regla mensual de traspaso y rescate entre
    CaixaBank y Mediolanum. Es el único trozo puro del motor. `buildSavingsAgentPlan()` delega en
    él, y `agentNextMonthReserve` desaparece de `app.js`.
  - **Se queda en `app.js`** el optimizador de deuda (`agentOptimalDebtPayoffPlan` y su familia):
    vuelve a ejecutar la simulación completa del hogar (`simulate()`, `debtTargetOptions()`...)
    por cada candidato. Sacarlo a un `canonical-*.js` exigiría arrastrar el modelo entero; a un script
    ansioso que dependa de los globales de `app.js` sería un tercer patrón de módulos, justo lo que
    `T14` decidió no abrir.
  - También se quedan los ajustes (`agentCaixaFloor` & cía., que leen Hoy, Registrar y el
    Laboratorio) y `executiveToneForAmount`, que usa `views/virtual-advisor.js` (detectado al mover).
  - El ahorro en líneas es menor de lo que sugerí: el motor puro son ~50 líneas; casi todo el
    recorte viene de la pantalla.
- **Construido**:
  - `views/savings-agent.js`: 18 funciones, 749 líneas movidas.
  - `canonical-savings-agent.js`, cargado antes que `app.js` y añadido al build y a la caché offline.
  - `app.js`: 38.105 → **37.306 líneas** (-799). El techo baja por trinquete a **37.436**.
    Acumulado de `ARQ-4` en esta conversación: 38.692 → 37.306 (-1.386, -3,6 %).
  - Tests nuevos: `tests/canonical-savings-agent.test.cjs` (7 pruebas; una compara contra la
    implementación anterior, copiada literal, en 500 simulaciones aleatorias con semilla: idéntico
    al céntimo en todos los campos) y `tests/arq4-agente-ahorro-carga-diferida.test.cjs` (6).
  - Tests adaptados: el recuento de `canonical-*.js` de `ARQ-3` pasa de 65 a 66; `v2-8` y
    `e14-a12-c14-bloque5` leen también `views/savings-agent.js`, porque el enlace a `#cashflow` del
    resumen ejecutivo del Agente vive ahí.
- **Verificación en navegador real** (Playwright, `main` contra esta rama): texto idéntico en
  Agente de ahorro (también tras cambiar de año y de colchón), Hoy, Ejecutivo, Asesor virtual, Plan
  de deuda y Nueva vida. «Simular ruta» desde Hoy, sin el fichero del Agente cargado, no lanza y no
  lo descarga. Sin errores de consola nuevos.
- **Hallazgos fuera de alcance** (no tocados, dejados como tareas sugeridas):
  - **Caché offline incompleta**: 31 scripts que `index.html` carga al arrancar no están en
    `SHELL_URLS` de `service-worker.js` (entre ellos `canonical-irpf-estimator.js`,
    `canonical-portfolio.js`, `canonical-period.js`). Sin red, esos motores no cargan.
  - **Test intermitente**: `lev14` compara dos resultados que llevan cada uno su `evaluatedAt`;
    falló una vez en el `verify` local por 1 ms y pasó al repetir. No se desactivó.
  - **Código muerto**: `renderAgentPriorityQueue()` pinta en `#agentPriorityQueue`, que no existe
    en `index.html`. Nunca ha pintado nada; queda anotado como excepción explícita en el test, sin
    borrarlo sin decisión del hogar.
- **Resultado de la validación**: `npm run verify` completo — 4744/4744 pruebas (4731 + 13 nuevas),
  lint y typecheck limpios, accesibilidad (1406 IDs únicos), rendimiento, build del sitio,
  privacidad y smoke test en verde. La primera pasada dio 4743/4744 por el test intermitente de
  `lev14`, ajeno a este cambio; la segunda, completa en verde.
- **Revisión mensual de Nielsen**: no vencida (última el 16 de septiembre; próxima el 16 de octubre
  de 2026).
- **Estado de `ARQ-4`**: de las cuatro pantallas que `T14` dio por bloqueadas, tres ya viven en
  carga diferida; solo queda Visual Detail. Recomendación: no moverla mientras no haya un motivo más
  allá del recuento de líneas; el riesgo es perder cambios en borrador del hogar.
- **Publicado según el flujo ya autorizado en `CLAUDE.md`**: commit y push a la rama de trabajo, PR
  en borrador, fusión a `main` en cuanto el CI esté en verde.

## Cierre de sesión — 24 de septiembre de 2026 (236): `ARQ-4`, segundo incremento — «Nueva vida» (simulación) desbloqueada y extraída a `views/new-life-simulation.js`

- **Qué pedía la sesión**: el hogar pidió «continúa con ARQ-4» tras aprobar la corrección de la
  skill (sesión 235). Tocaba auditar las tres pantallas que `T14` dio por bloqueadas de forma
  permanente (Nueva vida simulación, Agente de ahorro y Visual Detail) y mover la más limpia.
- **Hallazgo: el bloqueo de «Nueva vida» (simulación) no se sostenía.** `T14` (sesión 207, cabecera
  de `views/executive-advisor.js`) decía que `renderNewLifeSimulation()` se llamaba sin guarda
  «desde varios manejadores de Plan/Ajustes»: GOB20 declarar/quitar y GOB12 aplicar a real.
  - Contra el código de hoy, los tres cuelgan de controles que viven **dentro** de
    `<section id="new-life-simulation">`: `#gob20AdjustmentAdd`, el delegado `[data-gob20-remove]`
    sobre la propia sección y `#gob12ApplyRealBtn`. Un test existente
    (`tests/gob20-ajuste-real-ingreso.test.cjs`) ya exigía que GOB20 viviera ahí.
  - Solo se pueden pulsar con la pantalla visible, y para entonces `renderActiveSection()` ya ha
    cargado el fichero. Es la cuarta vez en esta auditoría que un documento da por cierto algo que
    el código no confirma; ver sesiones 219, 220 y 234.
- **Construido**:
  - `views/new-life-simulation.js` (12 funciones): `renderNewLifeSimulation`, su contexto
    `newLifeContext`, dos auxiliares exclusivos y sus ocho renderizadores. Todos pintan nodos de su
    propia sección.
  - Las tres llamadas externas llevan la guarda `viewChunkLoaded("new-life-simulation")`, por si
    algún día se cablean desde otra pantalla. Sin el fichero cargado la pantalla no está a la vista
    y se pinta al entrar; `renderNewLifeSimulation()` no tiene efectos de estado que conservar.
  - **Se queda en `app.js`**, a propósito: el Laboratorio E13 y los paneles GOB20/GOB12. Pintan en
    esta sección, pero son un sistema propio: comparten estado con Presupuesto del mes (FCST-2),
    alimentan la calidad de predicción (PVC13/PVC17) y 21 ficheros de tests los extraen de `app.js`.
  - `app.js`: 38.467 → **38.105 líneas** (-362). El trinquete obligó a bajar el techo en el mismo
    PR: 38.600 → **38.235**.
  - Tests: nuevo `tests/arq4-nueva-vida-simulacion-carga-diferida.test.cjs` (7 pruebas: funciones
    movidas, sin usos externos, nodos dentro de la sección, registro diferido/build/caché offline,
    controles dentro de la sección, ninguna llamada sin guarda, declarar sin fichero cargado no
    lanza). Adaptados `gob12`/`gob20` (el sandbox da la pantalla por cargada; la aserción de
    cableado lee la vista).
- **Verificación en navegador real** (Playwright, `main` contra esta rama, con datos de
  demostración): texto de `#new-life-simulation` idéntico al entrar (12.106 caracteres), tras
  declarar una caída de ingreso y tras quitarla. El fichero solo se descarga al visitar la
  pantalla. Único error de consola: un recurso externo bloqueado por la red del entorno, idéntico en
  `main`.
- **Diagnóstico de las dos que quedan** (sin tocar código):
  - **Agente de ahorro**: bloqueo real pero resoluble con el mismo patrón.
    `applyAgentRouteSimulation()` se dispara desde Hoy (centro de acciones unificado) y desde cuatro
    pantallas más, y llama a `renderSavingsAgent()` en sus dos salidas «sin cambios». El coste está
    en separar sus renderizadores del motor del agente, que comparten media docena de pantallas.
  - **Visual Detail**: la más difícil. Tiene 11 llamadores, todos editores de su propia rejilla con
    cambios en borrador; `discardVisualChanges` se llama también desde la barra de impacto de Plan.
    Hay que auditar ese estado de borrador antes de moverla.
  - Orden recomendado: Agente de ahorro → Visual Detail.
- **Resultado de la validación**: `npm run verify` completo — 4731/4731 pruebas (4724 + 7 nuevas),
  lint y typecheck limpios, accesibilidad (1406 IDs únicos), rendimiento, build del sitio,
  privacidad y smoke test en verde.
- **Publicado según el flujo ya autorizado en `CLAUDE.md`**: commit y push a la rama de trabajo, PR
  en borrador, fusión a `main` en cuanto el CI esté en verde.

## Cierre de sesión — 24 de septiembre de 2026 (235): la skill de sesión deja de mandar al backlog de agosto y de pedir permiso para publicar

- **Qué pedía la sesión**: el hogar aprobó («sí corrige la skill») corregir dos instrucciones
  desfasadas de `.claude/skills/finanzas-casa-workflow/SKILL.md`, detectadas al cerrar `PROC-2`.
  - **Modo Inicio, paso 2**: mandaba a `BACKLOG_ULTIMATE_SEPTIEMBRE.md` como «la única cola con
    trabajo pendiente». Ese backlog está casi cerrado desde el 3 de septiembre; el vigente es
    `BACKLOG_CONTABILIDADCASA_3_0.md` desde la sesión 219. Una sesión nueva que leyera la skill antes
    que el índice habría arrancado con la cola equivocada.
  - **Modo Cierre, paso 4**: exigía un «sí» explícito en cada turno antes de `commit`/`push`,
    justo lo que `CLAUDE.md` anuló el 10 de agosto de 2026. Hasta hoy funcionaba solo porque
    `CLAUDE.md` tiene prioridad; la contradicción seguía escrita.
- **Corregido**:
  - El paso 2 apunta ahora al backlog que `BACKLOG_INDICE.md` marca como «🟢 Vigente» (hoy
    `3.0`, §6) y dice qué hacer si el índice cambia.
  - El Modo Cierre describe el ciclo real de `CLAUDE.md` (validar → estado → commit/push → PR en
    borrador → fusión con el CI en verde → reiniciar la rama) y repite sus frenos. La descripción de
    la cabecera de la skill, que es lo que ve el modelo al decidir si usarla, también se corrige.
  - De paso, una línea gemela en `BACKLOG_INDICE.md` (fila de `BACKLOG_STATUS.md`) que decía lo
    mismo sobre el orden de ejecución.
- **Para que no vuelva a pasar**: `tests/proc-skill-alineada-con-claude-md.test.cjs` (3 pruebas)
  ata la skill a sus dos fuentes de verdad. Si el índice marca otro backlog como vigente y la skill
  no lo nombra, el CI falla; también si el Modo Cierre vuelve a pedir un «sí» o pierde algún freno.
- **Resultado de la validación**: `npm run verify` completo — 4724/4724 pruebas (4721 + 3 nuevas),
  lint y typecheck limpios, accesibilidad (1406 IDs únicos), rendimiento, build del sitio,
  privacidad y smoke test en verde. Sin verificación de navegador: ningún archivo de la app cambia.
- **Publicado según el flujo ya autorizado en `CLAUDE.md`**: commit y push a la rama de trabajo, PR
  en borrador, fusión a `main` en cuanto el CI esté en verde.

## Cierre de sesión — 24 de septiembre de 2026 (234): `PROC-2` — la revisión mensual de Nielsen pasa a ser un paso del flujo de sesión

- **Qué pedía la sesión**: tercera y última tarea de la oleada aprobada por el hogar en esta
  conversación (tras `FIN-2` y `ARQ-4`). `PROC-2` pedía dos cosas: corregir
  `docs/OPT21_CHECKLIST_NIELSEN.md` para que reflejara `T15`-`T19` cerradas, y que la revisión
  mensual de Nielsen (`OPT-21`) deje de depender de que alguien se acuerde.
- **La primera mitad ya estaba hecha**: la checklist ya marca los cinco hallazgos como corregidos
  o verificados (sesiones 199 y 208). Es la tercera vez que `BACKLOG_CONTABILIDADCASA_3_0.md` pide
  algo ya resuelto (Mejora #9, `ARQ-0`, y ahora esta), porque la auditoría de origen leyó
  documentos sin cruzarlos con el historial. Nada que construir ahí.
- **Construido**: dos pasos nuevos en `.claude/skills/finanzas-casa-workflow/SKILL.md`.
  - **Modo Inicio, paso 4**: mirar la fecha de la última revisión registrada. Con 30 días o más,
    decirlo en el resumen e incluir la revisión en la propuesta de plan, para que el hogar decida si
    se hace esa sesión.
  - **Modo Cierre**: si sigue vencida y no se hizo, dejarlo anotado en la entrada de
    `PROJECT_STATE.md`, para que la siguiente sesión lo vea.
  - `tests/proc2-nielsen-en-flujo-de-sesion.test.cjs` protege ambos pasos y que el registro siga
    siendo legible por fecha y en orden. **No** comprueba si la revisión está vencida: eso
    dependería del calendario y pondría el CI en rojo solo por el paso del tiempo.
- **Estado hoy**: última revisión real el 16 de septiembre de 2026 (`T1`, sesión 197); la próxima
  vence el **16 de octubre de 2026**. No está vencida en esta sesión.
- **Resultado de la validación**: `npm run verify` completo — 4721/4721 pruebas (4719 + 2 nuevas),
  lint y typecheck limpios, accesibilidad (1406 IDs únicos), rendimiento, build del sitio,
  privacidad y smoke test en verde. Sin verificación de navegador: ningún archivo de la app cambia.
- **Publicado según el flujo ya autorizado en `CLAUDE.md`**: commit y push a la rama de trabajo, PR
  en borrador, fusión a `main` en cuanto el CI esté en verde.

## Cierre de sesión — 24 de septiembre de 2026 (233): `ARQ-4` — `#reconciliation` desbloqueada y extraída a `views/reconciliation.js`; techo de tamaño para `app.js`

- **Qué pedía la sesión**: segunda tarea de la oleada aprobada por el hogar en el Modo Inicio de
  esta conversación. Primero, revisar si alguna de las 4 pantallas que `T14` dio por bloqueadas de
  forma permanente (Nueva vida simulación, Agente de ahorro, Visual Detail, Reconciliation) podía
  desbloquearse cambiando el patrón de refresco en vez de darla por perdida (nota de `ARQ-4`); y
  después, a petición explícita del hogar, **un techo de tamaño para `app.js`**.
- **Por qué el techo, con cifras**: `T14` dejó `app.js` en 37.233 líneas (sesión 207). En la pausa
  volvió a 38.674 (sesión 231, +1.441, ~85 líneas/sesión): todo lo nuevo seguía cayendo en `app.js`
  por inercia. Extraer sin cerrar ese grifo era vaciar el agua con un cubo.
- **Reconciliation, la más acotada de las cuatro (6 llamadores)**. Diagnóstico: `renderReconciliation()`
  no solo pinta DOM — también recalcula y persiste el libro conciliado (`refreshCanonicalLedger`) y
  reevalúa la barrera de publicación (`evaluateCanonicalCommitBarrier`, que a su vez fuerza el
  snapshot canónico). Los llamadores externos (cerrar/reabrir mes, disparables desde `#conciliar`)
  dependían de esos efectos aunque nadie viera la pantalla. Todo su DOM vive dentro de
  `<section id="reconciliation">` (comprobado nodo a nodo). Solución:
  - `refreshReconciliationView()` (`app.js`): con la pantalla abierta y su fichero cargado pinta
    como antes; sin ella, ejecuta solo los dos efectos de estado, en el mismo orden y con los mismos
    retornos tempranos. El DOM oculto se pinta al entrar (`renderActiveSection`), como en el resto
    de vistas diferidas. Los 4 llamadores ciegos pasan por aquí; la guarda que ya existía en
    `scheduleCanonicalRefresh` suma la comprobación de fichero cargado (evita un `ReferenceError`
    si el temporizador salta mientras el fichero aún se descarga).
  - `views/reconciliation.js` (nuevo, 263 líneas): `renderReconciliation` y los cuatro
    renderizadores que solo ella usa, más `ledgerStatusLabels`. Se quedan en `app.js`
    `ledgerMonthLabel`/`ledgerDifferenceTotal` (las usan Hoy, Análisis, Cierre, Deuda y
    Presupuesto) y `downloadCanonicalLedger` (cableado eager en `init()`). Registrada en
    `VIEW_CHUNKS`, en `tools/build-public-site.mjs` y en la caché offline (`service-worker.js`).
  - `tests/visual-history.test.cjs`: dos aserciones estáticas sobre el botón «Cerrar mes» pasan a
    leer `views/reconciliation.js` (mismo contenido, nueva ubicación).
- **Verificación en navegador real (Chromium, Playwright)**, sitio construido desde `main` frente al
  de esta rama: texto de `#reconciliation` idéntico carácter a carácter (4.306 caracteres), también
  tras pulsar «Reconstruir libro» y «Comparar con histórico»; desde `#conciliar` sin haber visitado
  Conciliación, `refreshReconciliationView()` no lanza y no descarga el fichero; al navegar después
  a `#reconciliation`, el fichero se carga y pinta sus 4 KPIs. Único error de consola: un recurso
  externo que la red de este entorno bloquea, idéntico en `main`.
- **Las otras tres siguen bloqueadas, sin diagnóstico nuevo en esta sesión**: Nueva vida
  (simulación), Agente de ahorro (7 llamadores) y Visual Detail (15+ llamadores desde Plan). La
  lección de esta sesión aplica a las tres: lo que hay que auditar son los efectos de estado de cada
  render, no solo quién lo llama.
- **Techo de `app.js`** (`tests/arq4-techo-app-js.test.cjs`): 38.600 líneas (margen de ~130 sobre
  las 38.467 de hoy, algo más de una sesión de la deriva medida) y 2.000.000 bytes (para que el
  techo de líneas no se esquive con líneas kilométricas). **Trinquete**: si `app.js` baja más de 300
  líneas por debajo del techo, el test falla hasta que el mismo PR baje el techo, para que lo
  ganado no se vuelva a perder. Subir el techo no es la salida por defecto: solo con decisión
  explícita del hogar anotada aquí.
- **Cifras**: `app.js` 38.692 → 38.467 líneas (-225). Recursos de carga inicial 2.200 → 2.182 KB
  (`test:performance`).
- **Resultado de la validación**: `npm run verify` completo — 4719/4719 pruebas (4709 + 7 de
  `tests/arq4-conciliacion-carga-diferida.test.cjs` + 3 del techo), lint y typecheck limpios,
  accesibilidad (1406 IDs únicos), rendimiento, build del sitio, privacidad y smoke test en verde.
  Se comprobó además que la prueba de guarda falla si se reintroduce una llamada ciega.
- **Publicado según el flujo ya autorizado en `CLAUDE.md`**: rama rehecha desde `main` tras fusionar
  `FIN-2` (#367), commit y push, PR en borrador, fusión en cuanto el CI esté en verde.

## Cierre de sesión — 24 de septiembre de 2026 (232): `FIN-2` — test de integración fiscal cruzada; destapa y corrige que FC5 ignoraba las pérdidas todavía por compensar

- **Qué pedía la sesión**: el hogar aprobó reordenar la oleada (Modo Inicio de esta misma
  conversación): `FIN-2` primero, adelantada desde el horizonte 4, antes que `ARQ-4`; después
  `ARQ-4` con un techo de líneas para `app.js`, y `PROC-2`. Motivo del reorden: `ARQ-4`/`T9` no
  cambian nada visible para el hogar, mientras que `FIN-2` protege la parte donde un error cuesta
  dinero, sin riesgo de regresión (solo añade pruebas) — y `ARQ-1` ya había demostrado que un gate
  "de solo pruebas" puede destapar bugs reales en producción.
- **Construido**: `tests/fin2-integracion-fiscal-cruzada.test.cjs` (11 pruebas). Un único
  ejercicio 2026 con tres posiciones (una venta FIFO que consume un lote entero y parte del
  siguiente, una venta en pérdidas, y una venta de 2025 que no debe contaminar 2026), pérdidas
  arrastradas de 2021 (fuera de la ventana de 4 años), 2022 y 2025, un dividendo extranjero, una
  venta más que se está valorando y un rescate de pensión. Verifica los puntos de cruce:
  conservación de coste del FIFO (FC1) → neto del año de la compensación (FC3) → coste de la venta
  (FC5) → dividendo (FC4) contra la misma escala del ahorro → base general separada
  (FCX1/I5/A15-2 dan el mismo coste marginal entre sí, y un rescate nunca altera el coste de una
  plusvalía) → impuesto del ahorro por piezas = escala sobre la base conjunta.
- **Bug real destapado, ya en producción**: la tarjeta de FC5 dice literalmente que «la base ya
  generada este año puede venir del resultado de la compensación de pérdidas y ganancias», pero
  `optimizePartialSale` recortaba a 0 cualquier base negativa, y el campo tenía `min="0"`. Dos
  consecuencias: (1) en un año con pérdida neta, una plusvalía nueva se cobraba entera en vez de
  compensarse primero; (2) aunque el año fuera positivo, las pérdidas arrastradas que FC3 dejaba
  todavía disponibles (`remainingPriorLosses`) desaparecían — `taxableNet` se queda en 0 y no las
  refleja. En el caso de la prueba: 950 € de impuesto estimado frente a 779 € reales (+22%). Sesgo
  siempre al alza, nunca a la baja — hacía parecer más cara de lo que es una venta que en realidad
  conviene hacer este año precisamente para aprovechar pérdidas que caducan.
- **Corrección** (mínima, sin motor nuevo):
  - `canonical-irpf-estimator.js`: `optimizePartialSale` admite base negativa y devuelve
    `absorbedByLosses`. Con base ≥ 0 el comportamiento no cambia (probado).
  - `canonical-portfolio.js`: `yearEndCompensation` devuelve `marginalSaleBase` = neto del año −
    todas las pérdidas arrastradas aún aplicables (aplicadas o no). Es la cifra correcta para FC5.
  - `app.js`: FC3 dice explícitamente qué base llevar a FC5 (`fc3MarginalSaleBaseLine`, función
    aparte para no mover el aviso de `fc3ResultHtml` fuera de la ventana de 2000 caracteres que ya
    comprueba `tests/fc3-app-integracion.test.cjs`); FC5 dice cuánto de la plusvalía queda
    compensado; INV18 (`inv18WithdrawalPlan`) compartía el mismo recorte a 0 y también se corrige.
    Los otros tres consumidores del mismo campo (LEV15, INV13, IN-8) pasan el valor tal cual al
    motor, así que heredan la corrección sin tocarlos.
  - `index.html`: el campo de FC5 ya no lleva `min="0"`, y su texto avisa de que puede ser negativo.
- **Lo que sigue fuera, a propósito**: el cruce del 25% entre saldo de rendimientos del capital
  mobiliario (dividendos) y saldo de ganancias patrimoniales (art. 49.1 LIRPF) sigue sin modelarse
  — ya lo declaraba FC3; la prueba de ejercicio completo usa un caso con ambos saldos positivos,
  donde ese cruce no aplica, y lo dice. FC4 sigue usando un tipo del ahorro declarado (plano), no
  la escala — la prueba fija que ambos coinciden al céntimo cuando el dividendo cabe en un tramo.
- **Resultado de la validación**: `npm run verify` completo — 4709/4709 pruebas (4698 + 11 nuevas),
  lint y typecheck limpios, accesibilidad (1406 IDs únicos), rendimiento, build del sitio,
  privacidad y smoke test en verde. Sin verificación de navegador: el cambio de UI son dos textos y
  un atributo `min`, cubiertos por la prueba de cableado.
- **Publicado según el flujo ya autorizado en `CLAUDE.md`**: commit y push a la rama de trabajo, PR
  en borrador, fusión a `main` en cuanto el CI esté en verde.

## Cierre de sesión — 23 de septiembre de 2026 (231): `ARQ-3` — detección sistemática de motores `canonical-*.js` sin consumidor de UI

- **Qué pedía la sesión**: siguiente tarea del horizonte 3 tras cerrar `NAV-4` (sesión 230), último
  ítem del horizonte salvo `ARQ-4`/`T9`. El backlog pedía dos cosas: (a) detección sistemática de
  motores `canonical-*.js` sin consumidor real de UI — hasta ahora solo verificado caso a caso
  cuando surgía la pregunta, `BACKLOG_INDICE.md` documentaba un único hallazgo (Copiloto/IA, desde
  la sesión 42) — y (b) auditoría de las 10 pantallas del grupo «legacy» del menú avanzado con la
  misma vara que `OPT-24` aplicó a Ajustes.
- **Auditoría completa de los 65 `canonical-*.js`** (vía subagente, verificado a mano después: export
  global de cada fichero, recuento textual en `app.js` y en los 13 `views/*.js`, y si lleva
  `<script>` en `index.html`):
  - **59/65 consumidos de verdad.** Dos casos que un grep ingenuo habría marcado huérfanos por tener
    0 referencias en `app.js` (`canonical-recommendation-citation.js`,
    `canonical-renewal-advisor.js`) resultaron tener su único consumidor dentro de `views/*.js`
    (`estado-semana.js`, `analisis.js`) — de ahí que la detección compruebe siempre ambos ficheros,
    nunca solo `app.js`.
  - **6/65 huérfanos, ninguno nuevo como hallazgo de fondo**: el caso ya conocido
    (`canonical-e9-assistant.js`, Copiloto/IA) no era aislado — es la punta de un grupo coherente de
    la misma épica E9 (bancarización/IA), construida por adelantado para `A5-1` (IA en producción
    real) pero nunca conectada a UI. **5 ficheros más, nunca enumerados explícitamente hasta ahora**,
    están igual de huérfanos: `canonical-e9-actions.js`, `canonical-e9-bank-import.js`,
    `canonical-e9-banking.js`, `canonical-e9-foundation.js`, `canonical-e9-notifications.js` — los
    cinco cargados en `index.html`, cero invocaciones en `app.js`/`views/*.js`. Mismo motivo, misma
    condición externa `A5-1` ya documentada — construidos por adelantado, no abandonados por
    descuido.
  - **`canonical-scenario-invariants.js` es un caso distinto, no comparable**: no lleva `<script>` en
    `index.html` — es una herramienta de test (catálogo de las 15 invariantes de E19,
    `E19_INVARIANTES.md`), usada solo por su propio test vía `require()` para property-based
    testing. Nunca fue pensada para el navegador; no cuenta como "código muerto de UI" porque no es
    código de UI en absoluto.
- **Auditoría de las 10 pantallas «legacy»**: la app **ya tiene, construido y en producción, el
  mecanismo de auditoría con la misma vara que pedía `OPT-24`** — no hacía falta construirlo. Es el
  catálogo `LABORATORIO_CATALOG` (`app.js:36235-36364`, 18 entradas: las 10 del grupo legacy + 8 ya
  promovidas/retiradas en commits anteriores), con veredicto (adoptada/sustituida/descartada),
  destino y evidencia de escritura por pantalla (`laboratorioWriteGuard()`, regla `L-5`).
  - Matiz importante que corrige la premisa de "código muerto" para la mayoría de las 10:
    "legacy" en el menú es una etiqueta de *posición de navegación*, no de estado funcional — el
    guardarraíl de solo lectura solo se activa dentro de una sesión abierta desde Laboratorio, no al
    entrar por el enlace normal de "Versiones anteriores". **4 de las 10 siguen siendo la puerta de
    escritura real y activa fuera de Laboratorio** (`debt-control`, `savings-agent`,
    `alerts-center`, `operations-manual` por contenido único aunque estático); 2 son
    redundante-total con reemplazo ya documentado en el propio código (`executive-advisor`,
    `virtual-advisor`); 1 más lo es en la práctica (`debt-liquidation-plan`, solo lectura derivada);
    1 tiene su única vía de escritura ya bloqueada de forma permanente, no solo en Laboratorio
    (`update-data`, `REGISTRAR_MES_LEGACY_READONLY`); y 2 son redundante-parcial, con contenido o
    acción parcialmente exclusiva conviviendo con una pantalla nueva que no lo cubre todo
    (`debt-roadmap`, `visual-detail`). Ninguna de las 10 se toca en esta sesión.
- **Construido**: `tests/arq3-canonical-sin-consumidor-ui.test.cjs` (fichero nuevo, sin tocar código
  de producción) — extrae el export global de cada `canonical-*.js`, comprueba que aparece en
  `app.js` o en `views/*.js`, y falla en cualquiera de los dos sentidos: un motor nuevo sin
  consumidor y sin excepción documentada (el hallazgo que antes solo se veía "cuando surgía la
  pregunta"), o una excepción documentada que ya tiene consumidor real (la lista quedaría obsoleta).
  Las 5 excepciones de la épica E9 quedan documentadas con su motivo (`A5-1`) en el propio test.
- **Resultado de la validación**: `npm run verify` completo — 4698/4698 pruebas (4694 + 4 nuevas de
  `ARQ-3`), lint y typecheck limpios, accesibilidad (1406 IDs únicos), rendimiento, build del sitio,
  privacidad y smoke test en verde. Sin verificación de navegador: cambio de solo test, ningún
  archivo de producción tocado.
- **Publicado según el flujo ya autorizado en `CLAUDE.md`**: commit y push a la rama de trabajo, PR
  en borrador, fusión a `main` en cuanto el CI esté en verde, sin pedir confirmación en cada paso.

## Cierre de sesión — 23 de septiembre de 2026 (230): `NAV-4` — la cabecera de las pestañas de Deuda repite «Deuda · <pestaña>», igual que Inversión

- **Qué pedía la sesión**: siguiente tarea del horizonte 3 tras cerrar `FLU-1` (sesión 229), último
  de los tres ítems S confirmados (`NAV-1` → `FLU-1` → `NAV-4`). El backlog pedía un indicador de
  ubicación (breadcrumb) en las 9 pestañas de segundo nivel (5 de Inversión, 4 de Deuda), por
  heurístico 6 de Nielsen ("reconocer, no recordar"), citando el mismo criterio que ya aplicó `T17`.
- **Investigado antes de construir nada** (vía subagente de exploración): `T17` no creó ningún
  componente de breadcrumb — repitió, en texto plano y al principio de la frase, una cifra que ya
  gobernaba visualmente la pantalla pero que antes quedaba enterrada al final. El criterio real de
  `T17` es "repetir en el punto de uso un dato que el usuario tendría que ir a buscar a otra
  pantalla, sin construir UI nueva si ya existe una forma barata de decirlo con palabras".
  - Las 9 pestañas ya tenían dos capas: un nav de pestañas real (`is-active`/`aria-current="page"`,
    con numeración de paso e `is-done` en Deuda por ser un flujo secuencial) y un "eyebrow" textual
    (`<p class="panel-kicker e19-eyebrow">`) sobre el `<h2>` de cada pantalla — el mismo patrón
    genérico que usa toda la app, alimentado además por una entrada gemela en `viewTitles` (`app.js`)
    que rellena la cabecera compartida real (`#viewEyebrow`, vía `setActiveView`).
  - Inversión ya seguía el patrón `"Inversión · <Pestaña>"` en ambas capas — nada que arreglar ahí.
  - **Deuda decía `"Decidir · <descripción libre>"`** (p. ej. tab «Comparar» → eyebrow "comparar
    estrategias"; tab «Ruta» → eyebrow "plan de deuda") — vestigial desde que `NAV-1` (sesión 228)
    sacó Deuda del grupo «Decidir» del menú avanzado, y ni repetía la palabra "Deuda" ni la etiqueta
    exacta de la pestaña activa. Quien aterriza en `#deuda-contratos` por el buscador no veía
    "Deuda" en ningún sitio de la cabecera — el hueco real de heurístico 6.
- **Construido**: las 4 entradas de `viewTitles` de Deuda (`app.js`) y sus 4 párrafos `eyebrow`
  gemelos en `index.html` pasan de `"Decidir · ..."` a `"Deuda · <Pestaña>"` (Ruta/Comparar/
  Contratos/Simulador visual), con la etiqueta exacta que ya usa `DEUDA_SCREEN_TABS`
  (`views/deuda.js`) — mismo patrón que Inversión, sin componente nuevo, sin motor nuevo.
  - 4 pruebas nuevas en `tests/nav4-cabecera-consistente-deuda-inversion.test.cjs`: las 4 pestañas
    de Deuda repiten "Deuda · <Pestaña>" con la etiqueta exacta (comparado dinámicamente contra
    `DEUDA_SCREEN_TABS`, nunca hardcodeado dos veces), ninguna sigue diciendo "Decidir", las 5 de
    Inversión no se rompieron, y — la comprobación que el propio comentario de `viewTitles` ya
    prometía sin que nada la verificara — el eyebrow estático de cada una de las 9 pestañas coincide
    siempre, carácter a carácter, con su entrada gemela de `viewTitles`.
  - Verificado en navegador real (Chromium vía Playwright, sitio construido en `dist/`): al navegar
    por hash a las 4 pestañas de Deuda y 2 de Inversión, la cabecera compartida (`#viewEyebrow`)
    muestra el texto correcto en las 6. Sin errores de consola propios.
- **Resultado de la validación**: `npm run verify` completo — 4694/4694 pruebas (4690 + 4 nuevas de
  `NAV-4`), lint y typecheck limpios, accesibilidad (1406 IDs únicos), rendimiento, build del sitio,
  privacidad y smoke test en verde.
- **Publicado según el flujo ya autorizado en `CLAUDE.md`**: commit y push a la rama de trabajo, PR
  en borrador, fusión a `main` en cuanto el CI esté en verde, sin pedir confirmación en cada paso.
  Con esto se cierra el horizonte 3 completo salvo `ARQ-3` y `ARQ-4`/`T9` (los dos ítems de deuda
  técnica de mayor esfuerzo, siguiente orden confirmado con el hogar).

## Cierre de sesión — 23 de septiembre de 2026 (229): `FLU-1` — la regla de 4 bloques de Home pasa de disciplina a invariante

- **Qué pedía la sesión**: siguiente tarea del horizonte 3 tras cerrar `NAV-1` (sesión 228), segundo
  de los tres ítems S confirmados (`NAV-1` → `FLU-1` → `NAV-4`). El backlog pedía un test automático
  que fijara la regla de máximo 4 bloques en `.home-primary-section` (`OPT-8`) como invariante, no
  solo como disciplina — "nada la protege hacia adelante si una tarjeta nueva se añade sin cuidado".
- **Investigado antes de tocar nada**: ya existía `tests/opt8-jerarquia-visual-hoy.test.cjs`, pero
  solo comprueba QUÉ cuatro bloques hay (por `id`: cobertura, el mes en una línea, decisiones
  abiertas, KPIs) — no CUÁNTOS. Ese test seguiría en verde si alguien añadiera una quinta tarjeta
  nueva a `.home-primary-section` sin querer, mientras los cuatro `id` de siempre siguieran
  presentes. Es exactamente el hueco que `FLU-2` (sesión 225) tuvo que razonar a mano al decidir
  dónde vivía su botón nuevo (fuera de `.home-primary-section`, en la cabecera) — sin este test, esa
  misma decisión dependía de que cada sesión futura se acordara de mirarlo.
  - Recuento real de hoy dentro de `.home-primary-section`: 3 `.home-panel` (cobertura, el mes en
    una línea, decisiones abiertas) + 1 `.home-kpi-grid` (KPIs) = 4 bloques. `.home-layout` (el
    envoltorio de fila que pone cobertura y «el mes en una línea» lado a lado) no cuenta como un
    bloque aparte — mismo criterio que ya usa el propio comentario de `OPT-8` en `index.html`.
- **Construido**: `tests/flu1-invariante-4-bloques-home.test.cjs` (fichero nuevo, sin tocar código
  de producción) — cuenta `.home-panel` + `.home-kpi-grid` dentro de `.home-primary-section` y falla
  si supera 4 (el techo real que pide el backlog), más dos pruebas complementarias que fijan el
  recuento de hoy (3+1) y confirman que `.home-layout` no se cuela como quinto bloque.
- **Resultado de la validación**: `npm run verify` completo — 4690/4690 pruebas (4687 + 3 nuevas de
  `FLU-1`), lint y typecheck limpios, accesibilidad (1406 IDs únicos), rendimiento, build del sitio,
  privacidad y smoke test en verde. Sin verificación de navegador: cambio de solo test, ningún
  archivo de producción tocado.
- **Publicado según el flujo ya autorizado en `CLAUDE.md`**: commit y push a la rama de trabajo, PR
  en borrador, fusión a `main` en cuanto el CI esté en verde, sin pedir confirmación en cada paso.

## Cierre de sesión — 23 de septiembre de 2026 (228): `NAV-1` — subcabeceras visibles de «Deuda» e «Inversión» en el menú avanzado

- **Qué pedía la sesión**: siguiente tarea del horizonte 3 tras cerrar `FIN-1` (sesión 227), primero
  de los tres ítems S baratos confirmados con el hogar (`NAV-1` → `FLU-1` → `NAV-4`). El backlog
  pedía subcabeceras visibles para las cinco categorías del grupo «Analizar» del menú avanzado
  (Deuda/Inversión/Seguros/Fiscal/Patrimonio, 24 enlaces), señalando que la agrupación ya existía
  en el código — `navigation-structure.test.cjs` la nombraba por comentario — pero no en la UI.
- **Investigado antes de tocar nada**: de las cinco categorías nombradas por el backlog, tres
  (Seguros, Fiscal, Patrimonio) ya tenían su propia subcabecera visible (`<p class="advanced-nav-
  label" data-e17-nav-label="...">`, patrón que `OPT-25` ya usó tres veces en septiembre). Las dos
  que faltaban de verdad eran Deuda (4 enlaces) e Inversión (5 enlaces): vivían sin cabecera propia,
  agrupadas de facto bajo «Decidir» (que en realidad solo debería cubrir los dos enlaces de
  escenario). El mecanismo que muestra/oculta cada subcabecera según sus enlaces visibles
  (`e17LabelHasVisibleLinks`, `app.js:715-722`) es agnóstico al texto de la etiqueta — añadir dos
  más no toca ningún interruptor de preferencia nuevo, sigue siendo el mismo grupo `"analysis"` de
  siempre.
- **Construido**: dos líneas nuevas en `index.html` —
  `<p class="advanced-nav-label" data-e17-nav-label="deuda">Deuda</p>` antes de los cuatro enlaces
  de deuda, y la misma para `data-e17-nav-label="inversion">Inversión` antes de los cinco de
  inversión — exactamente el patrón ya existente, sin CSS nueva, sin JS nuevo, sin motor nuevo.
  - 5 pruebas nuevas en `tests/nav1-subcabeceras-deuda-inversion.test.cjs`: las dos subcabeceras
    existen con el patrón correcto, preceden a sus enlaces en el orden esperado, «Decidir» sigue
    existiendo y sigue precediendo a «Deuda», las cinco categorías del backlog tienen subcabecera, y
    el conteo de 24 enlaces del grupo `analysis` no cambia (NAV-1 no añade ni quita pantallas, solo
    cabeceras visuales).
  - Verificado en navegador real (Chromium vía Playwright, sitio construido en `dist/`): al abrir
    «Herramientas avanzadas», las nueve subcabeceras aparecen en el orden correcto (Decidir → Deuda
    → Inversión → Seguros → Fiscal → Patrimonio e inversión → Analizar → Datos → Versiones
    anteriores), y los cuatro enlaces bajo «Deuda» son exactamente los esperados. Sin errores de
    consola propios.
- **Resultado de la validación**: `npm run verify` completo — 4687/4687 pruebas (4682 + 5 nuevas de
  `NAV-1`), lint y typecheck limpios, accesibilidad (1406 IDs únicos), rendimiento, build del sitio,
  privacidad y smoke test en verde.
- **Publicado según el flujo ya autorizado en `CLAUDE.md`**: commit y push a la rama de trabajo, PR
  en borrador, fusión a `main` en cuanto el CI esté en verde, sin pedir confirmación en cada paso.

## Cierre de sesión — 23 de septiembre de 2026 (227): `FIN-1` — el rebalanceo de inversión avisa cuando rompería el colchón que ya garantizan deuda y apalancamiento

- **Qué pedía la sesión**: siguiente tarea del horizonte 3 tras cerrar `NAV-2` (sesión 226).
  `FIN-1` pedía "verificar" que cancelación de deuda (`DEB15`), apalancamiento y rebalanceo de
  inversión usan el mismo umbral de colchón — el backlog no daba por hecho que hubiera un bug, solo
  auditar antes de tocar nada.
- **Auditoría previa** (vía subagente de exploración, sin modificar nada): **el veredicto no fue
  "tres umbrales distintos", fue "dos ya comparten el mismo umbral, el tercero no consulta
  ninguno"**.
  - `DEB15` (`app.js:18024-18040`, `cancellationLiquidityGuardrail`), `AP3`/`AP4` (barrera antes de
    apalancar, `app.js:16352-16364`) y `AP6` (sostenibilidad de la deuda de apalancamiento ya
    tomada, `app.js:17397-17404`) llaman los tres, literalmente, a la misma expresión:
    `FinanceCanonicalCushion.cushionFloor(lastSimulation, cuadroMandosReserve()).value`. Los
    motores puros que reciben ese `floor` (`amortizeCushionGuardrail`, `cancellationLiquidityGuardrail`,
    `evaluateLeverageBarrier`, `evaluateLeverageSustainability`) nunca lo recalculan por su cuenta —
    sin divergencia real entre esos dos puntos.
  - `INV7` (escalera de liquidez, pestaña Inversión · Cartera) ya usa esa misma expresión y ya
    calcula si la cartera cubre el colchón con liquidez inmediata/corta.
  - **`IV6` (sugerencias de rebalanceo, pestaña Inversión · Rebalanceo) no consultaba ningún
    colchón**: `rebalanceSuggestions()` decide comprar/vender solo por desviación porcentual de
    reparto, sin recibir `floor` ni `liquidity`. Podía sugerir vender una posición líquida
    (acción/ETF/cripto) para comprar una bloqueada (plan de pensiones) sin avisar de que eso rompe
    la cobertura del colchón que `INV7`, en la pestaña de al lado, dice garantizada hoy mismo — el
    riesgo real de "recomendaciones contradictorias" que describe el backlog, no una diferencia de
    cifras entre dos fórmulas.
  - Divergencia menor, fuera de alcance: `agentCaixaFloor()` (Hoy/Registrar/Deuda·Ruta/Asesor) y
    `cuadroMandosReserve()` (DEB15/apalancamiento/INV7/ahora IV6) solo difieren cuando la reserva
    operativa NO está configurada — ya documentado y decidido conscientemente en agosto (`L-5`,
    `tests/l1-l10-fase7-laboratorio.test.cjs`). No se toca.
- **Construido**: `rebalanceLiquidityGuardrail(totalsByType, suggestions, floorValue)` en
  `canonical-portfolio.js`, justo después de `liquidityLadder()` (`INV7`) — proyecta cada sugerencia
  de `IV6` que no sea "ok" (comprar suma, vender resta: `amount` ya es `target - actual`) sobre
  `totalsByType`, recalcula `liquidityLadder()` sobre esa composición proyectada y devuelve
  `{ current, projected, worsens }`. `worsens` solo es `true` cuando el colchón pasa de cubierto a
  no cubierto — un colchón ya descubierto antes del rebalanceo no cuenta como algo que la sugerencia
  empeora. Las anulaciones de liquidez por posición (`INV20`) no se proyectan (no se sabe qué
  posición concreta se vendería o compraría) — el proyectado usa siempre el tramo por defecto del
  tipo. Motor puro, mismo criterio que el resto de guardarraíles: nunca bloquea, solo informa.
  - `renderIv6Rebalance()` (`app.js`) calcula el `floor` con la misma expresión compartida y llama
    al guardarraíl nuevo; cuando `worsens` es `true`, añade un aviso bajo la lista de sugerencias
    señalando el importe del colchón y remitiendo a la escalera de liquidez de Inversión · Cartera.
    Sin `FinanceCanonicalCushion` cargado, la tarjeta sigue funcionando igual que antes (guarda
    explícita, nunca asume que el motor está disponible).
  - 12 pruebas nuevas en `tests/fin1-guardarrail-liquidez-compartido.test.cjs`: el motor puro
    (sin sugerencias no cambia nada, las filas "ok" no mueven totales, vender inmediata para comprar
    bloqueada puede romper la cobertura, moverse entre dos tipos igual de líquidos no empeora nada,
    un colchón ya descubierto no cuenta como empeorado, entradas vacías/mal formadas no lanzan) y el
    cableado (misma expresión de colchón que el resto, aviso solo bajo `worsens`, guarda sin motor
    cargado, y un conteo mínimo de usos de la expresión compartida en todo `app.js` como regresión
    contra que alguna de las cinco llamadas se desincronice en el futuro).
  - Verificado en navegador real (Chromium vía Playwright, sitio construido en `dist/`, datos reales
    de la demo): con una posición de 20.000€ en acción (100% líquida, colchón de 4.730€ cubierto
    según `INV7`), al fijar un objetivo de 100% en plan de pensiones, `IV6` sugiere vender toda la
    acción y comprar plan de pensiones, y el aviso nuevo aparece tal cual se diseñó. Sin errores de
    consola propios.
- **Resultado de la validación**: `npm run verify` completo — 4682/4682 pruebas (4670 + 12 nuevas de
  `FIN-1`), lint y typecheck limpios, accesibilidad (1406 IDs únicos), rendimiento, build del sitio,
  privacidad y smoke test en verde.
- **Publicado según el flujo ya autorizado en `CLAUDE.md`**: commit y push a la rama de trabajo, PR
  en borrador, fusión a `main` en cuanto el CI esté en verde, sin pedir confirmación en cada paso.

## Cierre de sesión — 23 de septiembre de 2026 (226): `NAV-2` — el buscador Cmd/Ctrl+K pesa sus resultados por uso real

- **Qué pedía la sesión**: siguiente tarea del horizonte 3 tras cerrar `FLU-2` (sesión 225), en el
  orden confirmado con el hogar. `NAV-2` no tenía ninguna pregunta abierta que resolver con el
  hogar: el backlog ya decía que el buscador universal (`e17-experience.js`, `T2`) existía y que
  esto era solo ordenar sus resultados por frecuencia de uso real en vez de solo por coincidencia
  de texto — su único prerrequisito, `ARQ-0`, ya estaba cerrado desde la sesión 220.
- **Investigado antes de tocar código** (vía subagente de exploración, sin modificar nada):
  - El buscador (`findTasks(query, normalize)` en `e17-experience.js:130-133`) no tenía ningún
    orden real hasta ahora — un `Array.prototype.filter` puro sobre `TASKS`, así que el orden de
    salida era exactamente el de declaración del array, sin scoring ni alfabético.
  - El contador de uso real de `ARQ-0` (`recordViewVisit`/`loadVisitCounts`/`viewVisitSummary`,
    `app.js:4484-4550`) vive en `localStorage` como `{ [screenId]: { count, last } }`, sin datos
    personales, escrito solo desde el router central (`setActiveView`) en cada cambio real de
    vista. El informe «Uso de la app» de Ajustes (`usoAppRows`, `app.js:4556-4564`) ya consume ese
    mismo contador y ya ordena por `count` descendente — el patrón de orden a reutilizar.
  - Mismo espacio de IDs entre buscador y contador (`target` de `TASKS` == `viewId` de
    `setActiveView`/`recordViewVisit`) — no hace falta cruzar por nombre, con una única cautela:
    las cuatro claves heredadas de `REGISTRAR_LEGACY_HASH_TABS` (`update-hub`, `update-data`,
    `datos-importar`, `data-entry`) nunca acumulan su propio contador porque `setActiveView` las
    redirige a `"registrar"` antes de contar — su peso de búsqueda tiene que ser el de
    `"registrar"`, no siempre 0.
- **Construido**: `findTasks(query, normalize, getUsageWeight = () => 0)` gana un tercer parámetro
  opcional (mismo patrón de inyección de función que ya usaba `normalize`), sin acoplar
  `e17-experience.js` a `localStorage` — sigue siendo un módulo puro. Ordena los resultados
  filtrados por peso descendente, con el índice original de `TASKS` como desempate estable — así,
  sin peso (el valor por defecto), el orden de salida es exactamente el de antes, y los tests ya
  existentes de `T2`/`UX6` que comparan conjuntos de resultados, no orden, siguieron en verde sin
  tocarlos.
  - `app.js` alimenta ese tercer parámetro con la función nueva `e17SearchUsageWeight(target)`
    (junto a `viewVisitSummary`, `app.js:4548-4557`), que resuelve las cuatro claves heredadas de
    `REGISTRAR_LEGACY_HASH_TABS` al contador de `"registrar"` antes de leer el peso.
  - `renderE17Launcher` pasa `e17SearchUsageWeight` en vez de dejar el tercer argumento vacío
    (`app.js:986`) — único cambio de cableado, sin nueva UI ni motor nuevo.
  - 13 pruebas nuevas en `tests/nav2-buscador-ponderado.test.cjs` (orden por defecto sin cambios,
    una pantalla más usada sube aunque vaya después en `TASKS`, empate conserva el orden original,
    el peso nunca cambia qué entra por coincidencia de texto, query vacía también se ordena por
    peso, peso no numérico/negativo se trata como 0, cableado en `renderE17Launcher`, resolución de
    las cuatro claves heredadas a `"registrar"`).
  - `tests/ux6-busqueda-importes.test.cjs` sandboxeaba `renderE17Launcher` en aislamiento sin
    conocer el nombre nuevo `e17SearchUsageWeight` — se rompía con `ReferenceError` al extraer solo
    esa función; corregido añadiendo `e17SearchUsageWeight: () => 0` al contexto compartido de sus
    pruebas (no ejercitan la ponderación, solo necesitaban que la referencia existiera).
  - Verificado en navegador real (Chromium vía Playwright, script ad hoc, sitio construido en
    `dist/`): sembrando 77 visitas en `inversion-fiscal` vía `localStorage`, ese resultado sube al
    primer puesto al buscar «inversion» pese a estar declarado después de «Inversión · Cartera» en
    `TASKS` — la ponderación funciona de verdad, no solo en el sandbox de los tests. Sin peso
    sembrado, «deuda» mantiene el mismo primer resultado de siempre. Sin errores de consola propios.
- **Resultado de la validación**: `npm run verify` completo — 4670/4670 pruebas (4657 + 13 nuevas
  de `NAV-2`), lint y typecheck limpios, accesibilidad (1406 IDs únicos), rendimiento, build del
  sitio, privacidad y smoke test en verde.
- **Publicado según el flujo ya autorizado en `CLAUDE.md`**: commit y push a la rama de trabajo, PR
  en borrador, fusión a `main` en cuanto el CI esté en verde, sin pedir confirmación en cada paso.

## Cierre de sesión — 23 de septiembre de 2026 (225): pospuesta la Cola B 30 días más; `FLU-2` — atajo de un clic para registrar gasto desde Home

- **Qué pedía la sesión**: siguiente tarea del horizonte 3 de `BACKLOG_CONTABILIDADCASA_3_0.md` §6
  tras cerrar `ARQ-1` (sesión 224, horizonte 2 completo). Antes de empezar, el hogar decidió
  posponer 30 días más la activación de la Cola B (§4): la condición real no es solo tiempo de
  calendario (el contador de `ARQ-0` ya llevaba el mes exigido) sino uso intensivo genuino de la
  app, que aún no se ha dado. Anotado en el propio documento: cualquier sesión futura debe
  preguntar primero si el uso ha sido adecuado, no dar la condición por cumplida solo porque pase
  el plazo otra vez.
- **Orden propuesto para el horizonte 3 y confirmado con el hogar**: `FLU-2` → `NAV-2` → `FIN-1` →
  las S baratas (`NAV-1`, `FLU-1`, `NAV-4`) → `ARQ-3` → `ARQ-4`/`T9`, por relación coste/beneficio
  y porque `NAV-2` ya no depende de nada (su prerrequisito `ARQ-0` está cerrado).
- **`FLU-2` — atajo de un clic «registrar gasto nuevo» desde Home**: la investigación previa
  encontró que la app separaba en dos pantallas encadenadas crear una partida nueva
  (Planificación de partidas, solo captura el importe *previsto*) de marcarla como *real* ya
  ocurrida (Registrar › Reales del mes, solo edita partidas que ya existen — no permite añadir una
  nueva). Se planteó al hogar el trade-off explícitamente (esfuerzo S de una navegación directa
  vs. M/L de un modal de un solo paso) — **el hogar eligió el modal de un solo paso**, el único que
  cumple literalmente "un clic, gasto registrado" incluyendo el importe real.
  - Nuevo botón `+ Registrar gasto` en la cabecera de Home (`.section-title.with-action`,
    **fuera** de `.home-primary-section` — no cuenta para la regla de 4 bloques de `OPT-8`/`FLU-1`,
    verificado con test dedicado).
  - Nuevo `<dialog id="homeQuickExpenseDialog">` (mismo patrón `action-review-dialog` +
    `method="dialog"` que ya usan `operationConfirmDialog`/`startupRecoveryDialog` — ninguna clase
    de UI nueva): tres campos (concepto, bloque, importe), sin selector de mes — siempre el mismo
    mes que Registrar › Reales del mes resolvería por defecto (el primer mes abierto), para que el
    formulario quede en tres campos, no cuatro.
  - Al confirmar, escribe en los dos almacenes que ya existían por separado, sin motor nuevo:
    `customPlanningRows.push({...})` (mismo esquema que `handlePartidasAddRow`) y
    `expenseActuals[id|monthKey] = amount` (mismo esquema de clave que
    `handleRegistrarActualsChange`/`actualKeyForRow`) — un solo paso que antes exigía dos
    pantallas.
  - El botón se deshabilita solo (con `title` explicando por qué) si no hay ningún mes abierto o
    ningún bloque de gasto declarado — mismo criterio que ya aplica
    `handleRegistrarActualsChange` sobre meses cerrados, nunca un formulario que no podría
    guardar nada.
  - 11 pruebas nuevas en `tests/flu2-atajo-registrar-gasto.test.cjs` (markup, disponibilidad del
    botón, creación de la fila+real, guardas de datos incompletos).
  - Verificado en navegador real (Chromium vía Playwright, script ad hoc, sitio construido en
    `dist/`): botón habilitado con los datos de demo reales, diálogo se abre con el mes/bloques
    correctos, al confirmar crea la partida con su real ya puesto y la fila aparece de inmediato en
    Registrar › Reales del mes. Sin errores de consola propios (el único aviso de red es el CDN
    externo de Supabase, bloqueado por el proxy del entorno de verificación, no por este cambio).
- **Resultado de la validación**: `npm run verify` completo — 4660/4660 pruebas (4649 + 11 nuevas
  de `FLU-2`), lint y typecheck limpios, accesibilidad (1406 IDs únicos, sin colisión con los
  nuevos), rendimiento, build del sitio, privacidad y smoke test en verde.
- **Publicado según el flujo ya autorizado en `CLAUDE.md`**: commit y push a la rama de trabajo,
  PR en borrador, fusión a `main` en cuanto el CI esté en verde, sin pedir confirmación en cada
  paso.

## Cierre de sesión — 23 de septiembre de 2026 (224): `ARQ-1` — TypeScript incremental (`checkJs`+JSDoc) sobre los 65 `canonical-*.js`, ya como gate de CI

- **Qué pedía la sesión**: siguiente tarea del horizonte 2 de `BACKLOG_CONTABILIDADCASA_3_0.md` §6
  tras cerrar `I5`/`ARQ-2` en la sesión 223 — la propia sesión 223 ya la había dejado aparcada para
  hoy: "`ARQ-1` queda para una sesión futura". Confirmada con el hogar al arrancar la sesión.
- **Construido**: `tsconfig.json` en la raíz (`allowJs`, `checkJs: true`, `noEmit: true`, `module:
  "nodenext"`, `target: "es2022"`, `strict: false`, `include: ["canonical-*.js"]`), enganchado a
  `npm run verify` vía el nuevo script `npm run typecheck`, justo después de `npm run lint` (mismo
  patrón que `ARQ-2`: gate de escritura antes que el resto de la cadena). `typescript` (v7,
  compilador nativo) y `@types/node` como `devDependencies` nuevas. No cambia la sintaxis en tiempo
  de ejecución — compatible con `vm.Script`, igual criterio que `ARQ-4`/`T14`: nada de
  `import`/`export`.
- **Alcance**: los 65 `canonical-*.js` completos en esta misma sesión, no un subconjunto — el gate
  arrancó con 162 errores repartidos en 27 ficheros (todos el mismo patrón: un parámetro
  desestructurado con valor por defecto `= {}`, que TypeScript no puede tipar sin ayuda) y terminó
  en 0. Cada función se anotó con JSDoc `@param` describiendo la forma real de sus datos —
  leyendo el cuerpo de cada una para que el tipo describa el uso real, nunca una anotación
  genérica que hiciera desaparecer el error sin decir la verdad. `canonical-irpf-estimator.js` y
  `canonical-state.js` ganaron además un `@typedef` compartido (`BracketScale`, `StatePayload`)
  para las formas que se repiten entre varias funciones del mismo fichero.
- **Bugs reales encontrados por el propio gate, corregidos en esta sesión** (la razón de ser de
  `ARQ-1`: detectar en tiempo de escritura lo que antes solo atrapaban los tests, si es que lo
  hacían):
  - **`canonical-e13-scenarios.js`**: el `number(value, fallback)` local de este fichero
    ignoraba silenciosamente el `fallback` recibido y devolvía siempre `0` internamente (firma
    real: `(value) => ... : 0`, sin segundo parámetro) — distinto del `number()` que usan el
    resto de `canonical-*.js` (`(value, fallback = 0) => ...`). Afectaba a `windowedHistory` y
    `quarterlyRecalibrationProposal` (PVC5): la llamada `number(quarters, 8)` pretendía que, sin
    `quarters` declarado, el valor por defecto fuera 8 trimestres — pero de verdad caía a
    `Math.max(1, Math.floor(0))` = 1 trimestre. Los tests existentes de PVC5 siempre pasan
    `quarters: 8` explícito, así que el hueco no estaba cubierto — corregido para que `number()`
    use el `fallback` recibido, igual que el resto del proyecto. Verificado que los 4649 tests
    siguen en verde tras el cambio.
  - **`.map(text)` con `text(value, fallback = "")`**: patrón repetido en
    `canonical-e9-assistant.js`, `canonical-e9-foundation.js`, `canonical-e9-actions.js` y
    `canonical-e11b-inbox.js` (y, fuera del alcance de `canonical-*.js` pero el mismo bug real:
    `a5-model-evaluation.js` y `p2-domain.js`, corregidos también por consistencia). `Array.map`
    pasa `(elemento, índice, array)` al callback, así que `text` recibía el índice numérico como
    `fallback` — con un elemento vacío/falso, `text("", 2)` devolvía `2` (número), no `""`, y ese
    `2` pasaba `.filter(Boolean)` como si fuera una cita válida. Corregido a `.map((item) =>
    text(item))` en los 6 sitios.
  - **`canonical-state.js`**: `decisionEventEntities([row], index)` pasaba un segundo argumento
    que la función (`decisionEventEntities(values)`, un solo parámetro) nunca leía — parámetro
    muerto, sin efecto real porque el `id` que consume la llamada no depende de ese índice.
    Eliminado el argumento sobrante.
- **Otros ajustes de tipo, sin cambio de comportamiento**: dos restas de `Date - Date`
  (`canonical-budget-schema.js`, `canonical-daily-engine.js`) reescritas como
  `.getTime() - .getTime()` — TypeScript no permite aritmética directa entre `Date`, aunque
  JavaScript la acepta vía conversión implícita; mismo resultado, más explícito. Un JSDoc de
  `canonical-budget-analyzer.js` que documentaba `@param {number} months` para lo que en realidad
  es un objeto de opciones (`{months?: number}`) — desincronizado del código real, corregido.
- **Verificación**: `npm run verify` completo, no solo `npm test` — 4649/4649 pruebas, lint limpio,
  `npm run typecheck` limpio (0 errores en los 65 ficheros), accesibilidad y rendimiento
  verificados, build del sitio, privacidad y smoke test en verde.
- **Publicado según el flujo ya autorizado en `CLAUDE.md`**: commit y push a la rama de trabajo,
  PR en borrador, fusión a `main` en cuanto el CI esté en verde, sin pedir confirmación en cada
  paso.

## Cierre de sesión — 22 de septiembre de 2026 (223): `I5` — rescate de pensiones (reducción por antigüedad + modalidad renta) y `ARQ-2` — ESLint como gate de CI

- **Qué pedía la sesión**: siguiente oleada de `BACKLOG_CONTABILIDADCASA_3_0.md` tras cerrar el
  bloque de periodo (`PER-1`→`PER-4`, sesiones 221-222). Propuesto y confirmado con el hogar: `I5`
  (heredada de 2.0, sin bloqueo, ya acordada en sesión 218) primero, después `ARQ-2` antes que
  `ARQ-1` — invertido a propósito respecto al orden del documento: `ARQ-2` es S (barato) y `ARQ-1`
  M (caro), y un gate de lint activo antes de anotar los `canonical-*.js` con JSDoc para `ARQ-1`
  da una red de seguridad inmediata en vez de auditar a mano y luego instalarla. `ARQ-1` queda
  para una sesión futura.
- **`I5` — construido en `canonical-irpf-estimator.js`**: nueva función pura
  `pensionWithdrawalComparison`, reutilizando `progressiveTax`/`validateBracketScale` tal cual (no
  es un motor nuevo). Compara el rescate de pensiones como capital único frente a la modalidad en
  forma de renta:
  - **Reducción del 40%** (Ley 35/2006, disposición transitoria duodécima): solo sobre el importe
    que el hogar declare aportado antes de 2007 — la app no registra cuándo se hizo cada aportación,
    así que ese importe se declara directamente, nunca se deriva; tampoco se comprueba el plazo
    legal vigente para aplicarla (depende de cuándo ocurrió la contingencia). Solo aplica al
    capital, nunca a la renta.
  - **Modalidad en forma de renta**: reparte el importe completo (sin la reducción, que no le
    aplica) en los años que declare el hogar, sumando cada parte a la misma renta general base
    cada año — supuesto explícito de partida, no una previsión de ingresos futuros.
  - Ambos supuestos se declaran siempre en el resultado (`assumptions`), nunca en silencio. Con las
    dos escalas de tramos registradas usa el coste marginal real por tramos; sin ellas, cae al tipo
    marginal declarado (A15-1/A15-4).
  - **Tarjeta FCX1** (`index.html`/`app.js`): dos campos nuevos (`fcx1PreTwoThousandSevenAmount`,
    `fcx1AnnuityYears`), `handleFcx1SimulateWithdrawal`/`fcx1ResultHtml` reescritos para comparar
    capital único vs. renta con ambos importes netos, la diferencia y los supuestos. **Sigue
    informativa a propósito**: cerrar este hueco de cálculo desbloquea que pueda pasar a directiva
    (`T4`, sesión 204, ya lo señalaba), pero decidir si pasa es una decisión de producto aparte, no
    consecuencia automática de esta tarea — no se ha tocado. `gob8Fcx1Line` (borrador de la Renta,
    `GOB8`) no se tocó a propósito: sigue calculando solo el capital único sin reducción, que es lo
    que corresponde a un borrador de un único ejercicio fiscal.
  - 8 pruebas nuevas en `tests/fcx1-rescate-pensiones.test.cjs` (motor puro + wiring), más las ya
    existentes de `marginalTaxOnAdditionalIncome` actualizadas donde tocaba.
  - Verificado en navegador real (Chromium vía Playwright, script ad hoc): capital único, renta a 3
    años y reducción del 40% calculan correctamente y se muestran sin errores de consola. Al
    verificar se encontró y corrigió un bug propio de esta sesión antes de publicar: la línea de
    "tipo marginal declarado" del mensaje mostraba `undefined%` (leía `result.effectiveRatePct`, un
    campo que ya no existe en el resultado nuevo, que tiene un tipo efectivo distinto por
    modalidad) — corregido para no citar una cifra inexistente.
- **`ARQ-2` — construido**: `eslint.config.js` en la raíz, enganchado a `npm run verify` vía el
  nuevo script `npm run lint`. Solo tres reglas, ninguna de estilo:
  - `no-unused-vars` con `vars: "local"` — sin ESM ni bundler, cada función declarada arriba del
    todo en `app.js`/cada `views/*.js`/cada `canonical-*.js` es un global consumido desde OTRO
    fichero (el propio patrón del proyecto, `ARQ-4`) que ESLint no puede ver fichero a fichero;
    comprobar solo variables locales evita cientos de falsos positivos y sigue cazando lo que
    importa. `ignoreRestSiblings` para el patrón ya extendido en la app `const { preview, ...clean
    } = x` (descartar campos antes de guardar).
  - `eqeqeq` (`always`, `null: "ignore"`).
  - `complexity`: techo 90 para `app.js`/`views/*.js`/`canonical-*.js` (medido contra el máximo
    real del código, 82, no un ideal de diseño), 40 para `tools/`/`backend/`/`tests/`. Única
    excepción: `init()` en `app.js` (complejidad 313 — arranque completo de la app en una sola
    función, deuda ya documentada de `ARQ-4`/`T14`), con `eslint-disable-next-line` explícito.
  - Limpiadas ~30 variables/funciones locales genuinamente muertas que el propio linter encontró al
    construir el gate (tres `catch (error)` vacíos pasados a `catch {}`, variables de una sola
    asignación nunca leídas, un helper interno sin llamar). Ninguna función global se tocó — el
    ámbito local confirmó que no eran falsos positivos.
  - Una no era muerta de verdad: `cirbeReduction` en `views/debt-liquidation-plan.js` se calculaba
    pero nunca se mostraba, aunque el panel «Fuentes y presión» ya mostraba los dos totales CIRBE
    (dic 2025/mayo 2026) por separado sin su diferencia — un hueco real desde que se introdujo
    (Oleada 3 Bloque 4), confirmado con `git log`/`git blame`. Pedido explícitamente por el hogar en
    la propia sesión: se añadió la reducción junto a esos dos totales en ese mismo panel (sin
    tarjeta de KPI nueva — la cuadrícula de arriba está acotada a 4 tarjetas de decisión
    estratégica, no es un volcado de datos), con 2 pruebas nuevas en
    `tests/debt-liquidation-plan-cirbe-reduction.test.cjs` y verificación en navegador real.
- **Versiones bumpeadas**: `app.js?v=20260922i5a1` (26 ficheros de test con la versión de `app.js`
  pinneada literalmente en un regex tuvieron que actualizarse a la vez — un patrón frágil, ya
  presente antes de esta sesión, que convendría revisar en una sesión de arquitectura futura),
  `canonical-irpf-estimator.js?v=20260922i5a1`, `views/debt-liquidation-plan.js?v=20260922i5a1`.
- **Validación**: `npm run verify` completo, exit 0 — **4.649/4.649 pruebas** (4.635 + 8 de
  `pensionWithdrawalComparison`/wiring + 4 de `arq2-eslint-gate` + 2 de la reducción CIRBE),
  `npm run lint` en verde (0 errores), accesibilidad (1.397 IDs), rendimiento, build, privacidad y
  smoke test en verde. Además, `npm install` fue necesario al empezar la sesión — el contenedor no
  tenía `node_modules/` instalado, lo que hacía fallar 6 pruebas de `build:site` por falta de
  `esbuild`; no relacionado con el trabajo de esta sesión, resuelto antes de validar.
- **Publicado**: commit y push a `claude/sharp-gates-1nmx2c`, PR en borrador y fusión a `main` en
  cuanto el CI esté en verde, según la autorización permanente de `CLAUDE.md`.

## Cierre de sesión — 22 de septiembre de 2026 (222): `PER-4` — semestre en Presupuesto, resumen por periodo en Previsión, persistencia en Análisis, informe semestral; salud financiera queda fuera a propósito

- **Qué pedía la sesión**: cerrar el bloque de periodo del todo — "hacemos PER-1→PER-2→PER-3→PER-4 y
  cerramos". `PER-4` en el backlog decía "reutilizado en Presupuesto, Análisis, Previsión y salud
  financiera" — antes de tocar código se investigó qué tenía cada pantalla realmente (agente de
  exploración dedicado) y se encontró que el alcance real era mucho mayor y con más riesgo de
  producto del que "M" sugería: Análisis ya tenía su propio "semestre" (ventana móvil de 6 meses,
  no el semestre natural), Previsión no tenía ningún concepto de periodo calendario, y salud
  financiera tampoco. Presentado al hogar, que acotó el alcance: Presupuesto + Análisis + Previsión
  esta sesión, **salud financiera fuera** — no había nada que reutilizar ahí, solo una decisión de
  producto nueva sin pedir.
- **Presupuesto** (`views/presupuesto-mes.js`, `canonical-budget-schema.js`, `app.js`): "semester"
  añadido como tercera cadencia larga junto a "annual"/"quarterly" — nuevo campo `semesterKey` en el
  esquema (`validate`/`create`/`upsert`/`delete`/`findForSemester`/`findForCategorySemester`/
  `byCategorySemester`/`semesterRange`, delegando en `canonical-period.js`), las 7 funciones de la
  vista que ramificaban por `periodType` (rango, contexto de fechas, alertas, reparto mensual a 6,
  alta/edición/exportación CSV) extendidas con el tercer caso. `shiftPresupuestoMesLongPeriod`
  simplificado: antes calculaba a mano el año/trimestre siguiente con su propio rollover, ahora
  delega en `FinanceCanonicalPeriod.adjacentPeriod` (menos código, y ahora sirve para las tres
  cadencias sin más ramas). La preferencia de cadencia se persiste por primera vez (antes se perdía
  al recargar), bajo el id de pantalla `"presupuesto-largo"`.
- **Previsión** (`app.js`, concepto nuevo — no existía nada parecido): panel «Resumen por periodo»
  con selector trimestre/semestre/año y navegación anterior/siguiente, agregando la misma previsión
  mes a mes que ya usa la tabla (`previsionRowsForMonths`/`previsionMetricsFor`/`previsionWorstOf`,
  sin motor nuevo) sobre el rango del periodo elegido — independiente del horizonte 12/24/48 meses a
  propósito (un año completo debe verse agregado aunque el horizonte esté en 12m). Avisa
  explícitamente cuando el periodo cae solo parcialmente dentro de los meses abiertos ("solo 4 de 6
  meses tienen previsión abierta todavía"), nunca agrega en silencio un periodo incompleto como si
  fuera completo.
- **Análisis** (`views/analisis.js`): solo persistencia añadida (`currentAnalisisPeriodKey`/
  `handleAnalisisPeriod`, id de pantalla `"analisis"`) — su selector de A-4 (mes en curso / rango
  relativo — trimestre, semestre, año — / mes concreto) no se tocó. Decisión explícita: el
  "semestre" de A-4 es una ventana móvil de 6 meses hacia atrás desde hoy, no el semestre natural de
  `canonical-period.js`; sustituirlo habría cambiado el resultado de cascadas ya construidas (`P-1`)
  sin que el hogar lo hubiera pedido.
- **Informe semestral** (`app.js`, `index.html`): tercera familia paralela a GOB14 (trimestral)/P12
  (mensual) — `gob14SemesterLabel`/`gob14SemesterReportContext`/`gob14SemesterReportPrintHtml`/
  `downloadGob14SemesterReport`, reutilizando `gob14ReportBodyHtml` tal cual. A diferencia de
  `gob14QuarterLabel` (regex a mano sobre la clave), usa `canonical-period.js` directamente para la
  etiqueta y el rango — no había ningún cálculo de semestre previo con el que tuviera que ser
  coherente.
- **Preferencia compartida por pantalla** (`app.js`, `PERIOD_SELECTOR_PREFERENCE_KEY`): un único
  almacén, sin imponer un vocabulario común — cada pantalla guarda el valor tal cual lo usa (una
  unidad de `canonical-period.js` en Presupuesto/Previsión, el id de preset/mes de Análisis, que no
  son lo mismo). No hay un componente de UI compartido: cada pantalla sigue pintando su propio
  selector con su propio estilo, igual que ya hacían el horizonte de Previsión o la ventana de
  Análisis antes de esta tarea.
- **Publicación de canonical-period.js** ya estaba resuelta desde `PER-1` (script en `index.html` +
  lista de `tools/build-public-site.mjs`); esta sesión solo bumpea versiones: `app.js?v=
  20260922per4a1` (27 ficheros de test), `views/presupuesto-mes.js?v=20260922per4a1` y
  `views/analisis.js?v=20260922per4a1` (cada chunk de vista versiona por separado).
- **Validación**: `npm run verify` completo, exit 0 — **4.635/4.635 pruebas** (4.595 + 40 nuevas:
  19 en `tests/bud3-presupuesto-anual-trimestral.test.cjs`, 21 en
  `tests/per4-selector-periodo-analisis-prevision.test.cjs`), accesibilidad (1.395 IDs),
  rendimiento, build, privacidad y smoke test en verde. Además, comprobación manual en navegador
  real (Chromium vía Playwright, `npx playwright test --project=e2e` y un script ad hoc): semestre
  en Presupuesto, resumen agregado en Previsión y persistencia en Análisis funcionan de verdad, sin
  errores de consola atribuibles al cambio. Un fallo del proyecto `e2e` (`QA-1 · flujo completo de
  Presupuesto del mes`, editar el importe sugerido del presupuesto mensual) se investigó aparte —
  reproduce idéntico contra el HEAD limpio antes de este cambio (`git stash` + misma prueba): fallo
  preexistente de este contenedor, no causado por `PER-4`.
- **Publicado**: commit y push a `claude/nice-goodall-8konj5`, PR en borrador y fusión a `main` en
  cuanto el CI esté en verde, según la autorización permanente de `CLAUDE.md`.

## Cierre de sesión — 22 de septiembre de 2026 (221): `PER-1`/`PER-2`/`PER-3` — nace `canonical-period.js`, el modelo de periodo único (mes/trimestre/semestre/año)

- **Qué pedía la sesión**: continuar el horizonte 2 de `BACKLOG_CONTABILIDADCASA_3_0.md` tras cerrar
  `ARQ-0` (sesión 220). El hogar confirmó seguir con `PER-1`.
- **Construido — `PER-1`**: nuevo módulo `canonical-period.js` (`periodKey`/`periodUnit`/
  `periodRange`/`periodLabel`/`adjacentPeriod`), motor puro sin DOM ni red, determinista (sin
  `Intl`, tabla fija de meses en español, mismo criterio que el resto de `canonical-*.js`). Las
  cuatro cadencias (`month`/`quarter`/`semester`/`year`) se generalizaron a la vez desde el
  principio — construirlas todas costó lo mismo que tres, así que `PER-3` (añadir semestre) quedó
  cerrada de fábrica sin trabajo aparte. 24 pruebas propias en `tests/canonical-period.test.cjs`,
  incluida una cruzada contra `CanonicalBudgetSchema.quarterRange`/`annualRange` (`BUD-3`) que
  confirma que ambos coinciden exactamente antes de migrar nada.
- **Construido — `PER-2`**: `CanonicalBudgetSchema.currentQuarterKey`/`quarterRange`/
  `currentYearKey`/`annualRange` (`canonical-budget-schema.js`) delegan ahora en
  `canonical-period.js` en vez de mantener su propio cálculo de fechas — API pública intacta,
  mismo comportamiento de guardarraíl (una clave del formato equivocado sigue devolviendo `null`,
  nunca un rango de otra cadencia). Es la **primera dependencia entre dos `canonical-*.js`** del
  proyecto — hasta ahora cada uno era completamente autónomo, sin motor nuevo lo justificaba. Se
  resolvió con `require` relativo (se resuelve contra el propio fichero, no contra quien lo importa,
  así que funciona igual desde cualquier test) en Node y con el orden de los `<script>` de
  `index.html` en el navegador — sin introducir un tercer sistema de módulos (mismo criterio que
  `T14`/`ARQ-4`: nunca `import`/`export` mientras los tests carguen `app.js` con `vm.Script`).
- **Cableado de publicación**: `<script defer src="canonical-period.js?v=20260922per1a1">` añadido a
  `index.html` (antes de `canonical-budget-schema.js`) y a la lista de `tools/build-public-site.mjs`
  — sin esto último, `npm run build:site` falla con "index.html carga recursos que no se copian a
  dist" (comprobación automática existente, no nueva). `service-worker.js` (`SHELL_URLS`) no se
  toca: ese literal está congelado a mano desde el 19 de agosto de 2026 y ya lleva meses sin varios
  `canonical-*.js` posteriores sin incidencia documentada — no es objeto de esta sesión.
- **No construido todavía**: `PER-4` (selector de periodo único en la UI de Presupuesto/Análisis/
  Previsión/salud financiera, informe semestral de familia) sigue pendiente — es la pieza de UI, con
  más riesgo y alcance, y no dependía de terminarse en el mismo cierre.
- **Validación**: `npm run verify` completo, exit 0 — **4.595/4.595 pruebas** (4.571 + 24 nuevas de
  `tests/canonical-period.test.cjs`), accesibilidad (1.391 IDs), rendimiento, build del sitio (que
  ahora sí falla si `canonical-period.js` faltara de la lista de publicación), privacidad y smoke
  test, todos en verde.
- **Publicado**: commit y push a `claude/nice-goodall-8konj5`, PR en borrador y fusión a `main` en
  cuanto el CI esté en verde, según la autorización permanente de `CLAUDE.md`.

## Cierre de sesión — 22 de septiembre de 2026 (220): `ARQ-0` cerrada — el contador de visitas ya existía de fábrica (`T-4`/`OPT-2`); nuevo informe «Uso de la app» en Ajustes

- **Qué pedía la sesión**: seguir con la siguiente oleada de `BACKLOG_CONTABILIDADCASA_3_0.md` (nacido
  en la sesión 219) y proponer un plan para el resto del backlog. Preguntado el hogar por qué empezar,
  eligió `ARQ-0` (telemetría de uso), horizonte 1 del propio plan priorizado del documento.
- **Hallazgo antes de construir nada** — mismo patrón que la propia auditoría 3.0 ya se descubrió a sí
  misma en la Mejora #9 (cerrar `T15`-`T19`, §0.1): el contador de visitas por pantalla
  (`VISIT_COUNTS_KEY`/`recordViewVisit`/`viewVisitSummary`, `app.js`) **ya existía** desde `T-4` (22 de
  agosto de 2026) y ya se había redescubierto una vez en `OPT-2` (29 de agosto) — registra
  automáticamente las ~40 pantallas de la app, heredadas y nuevas, no solo las 17 del catálogo de
  Laboratorio donde se enseñaba hasta ahora. Con la fecha de hoy, el contador lleva corriendo
  exactamente un mes: el plazo que la propia fila de `ARQ-0` pedía como condición para decidir la Cola
  B ya se había cumplido cuando se escribió el documento, sin que nadie lo hubiera usado con ese fin.
- **Presentado al hogar** antes de tocar código, con la alternativa de saltar directamente a `PER-1`: el
  hogar decidió construir el informe que de verdad faltaba (ver más abajo) y dejar la corrección
  documental del backlog para este cierre.
- **Construido**: `usoAppRows()`/`usoAppSummaryText()`/`usoAppRowHtml()`/`usoAppTableHtml()` (`app.js`,
  junto a `viewVisitSummary`) — reutilizan el contador ya existente sobre `viewTitles` (el catálogo
  real de las ~40 pantallas) en vez de sobre las 17 heredadas de Laboratorio, sin motor nuevo.
  `renderAjustesUsoApp()` (mismo patrón que `renderAjustesLaboratorio`) y su llamada en
  `renderAjustes()`. Nuevo panel «Uso de la app» dentro de Ajustes (`index.html`), con su propio ancla
  en la barra de secciones junto a «Simuladores y Laboratorio»: tabla con pantalla, categoría, veces
  abierta y última apertura, ordenada de más a menos usada, con una nota explícita de que el dato
  nunca sale del navegador y no incluye nada personal ni de movimientos. CSS nuevo (`.uso-app-table`,
  `styles.css`) siguiendo el mismo patrón que `.account-balance-table`. `app.js?v=` bumpeado a
  `20260922arq0a1` (27 ficheros de test que lo pineaban, actualizados en bloque).
- **Corrección documental en `BACKLOG_CONTABILIDADCASA_3_0.md`**: `ARQ-0` (§1) marcada cerrada con el
  hallazgo completo; §4 (Cola B) separa la condición de datos (ya cumplida) de la conversación
  explícita del hogar sobre qué pantallas se abren de verdad (todavía pendiente — la Cola B **no** se
  activa con este cierre); §6 (plan priorizado) refleja el horizonte 1 cerrado. `BACKLOG_STATUS.md` no
  cambia: `ARQ-0` no es una entrega numerada `E1`-`E20`, vive solo dentro del backlog 3.0.
- **Hallazgo adicional sobre el propio entorno**: `node_modules` no estaba instalado en este contenedor
  al empezar la sesión. Los 6 fallos de `opt3-minify-dist.test.cjs` que el cierre de la sesión 219
  documentó como «preexistentes, entorno de este contenedor» desaparecen con un `npm install` limpio —
  `esbuild` sí está declarado en `package.json`, solo faltaba instalarlo. No era una limitación
  permanente del contenedor, como se había asumido entonces.
- **Validación**: `npm run verify` completo, exit 0 — **4.571/4.571 pruebas** (4.561 + 10 nuevas de
  `tests/arq0-uso-app-informe.test.cjs`), accesibilidad (1.391 IDs únicos), rendimiento, build del
  sitio, privacidad y smoke test, todos en verde. Sin ningún fallo, ni siquiera los preexistentes de
  entorno de la sesión anterior (ver hallazgo de arriba).
- **Publicado**: commit y push a `claude/nice-goodall-8konj5`, PR en borrador y fusión a `main` en
  cuanto el CI esté en verde, según la autorización permanente de `CLAUDE.md`.

## Cierre de sesión — 21 de septiembre de 2026 (219): nace `BACKLOG_CONTABILIDADCASA_3_0.md` — auditoría crítica de UX/UI y modelo de periodo, cruzada y unificada con el backlog vigente

- **Qué pedía la sesión**: análisis crítico de UX/UI de la app "con el máximo detalle", más de 40
  mejoras y 20 funcionalidades nuevas, y explorar cómo llevar los datos y magnitudes a nivel
  mensual, trimestral y semestral. Después, generar un backlog que uniera esto con lo pendiente del
  backlog anterior y un plan priorizado.
- **Investigación previa** (sin tocar código): inventario real del repositorio (64 módulos
  `canonical-*.js`, 419 ficheros de test, 42 enlaces en el menú avanzado, sin telemetría de uso en
  ningún sitio, sin ESLint/TypeScript/bundler de desarrollo), lectura de `OPT21_CHECKLIST_NIELSEN.md`
  y de `navigation-structure.test.cjs`, y verificación por grep de que "semestral" no existe en
  ningún fichero de código (solo en texto libre de este mismo documento) mientras trimestral existe
  en tres implementaciones independientes (`CanonicalBudgetSchema` de `BUD-3`, recalibración de
  `PVC5`, informe de `GOB14`).
- **Publicado primero como documento independiente** (mismo patrón que "El Libro Vivo" y
  "Contabilidadcasa 2.0"):
  [«Contabilidadcasa — Auditoría crítica y propuesta de mejoras»](https://claude.ai/artifact/LcC4gEUFDB4PAL3m9tfZK2)
  — 46 mejoras (arquitectura/deuda técnica, navegación, flujos diarios, visualización, rigor
  financiero, proceso) + 22 funcionalidades nuevas, con una advertencia explícita por delante: dado
  el volumen ya construido y el patrón de cuatro auditorías consecutivas cerrando >90% de sus
  propuestas sin ninguna medición de uso real, la recomendación es instrumentar telemetría antes de
  activar una quinta ronda completa. Propuesta técnica central: un módulo único
  `canonical-period.js` que generalice mes/trimestre/semestre/año en un solo lugar, en vez de que
  cada motor (presupuesto, previsión, informe familiar) siga construyendo su propia cadencia por
  separado.
- **Cruce contra el código real y contra `BACKLOG_CONTABILIDADCASA_2_0.md`**: a diferencia de
  cruces anteriores, ese backlog seguía vigente y sin cerrar (10 tareas activas en §1-§4 + 6
  heredadas en §7, no histórico). El cruce encontró 2 correcciones reales: el hallazgo Nielsen que
  la auditoría de origen daba por pendiente (cerrar `T15`-`T19`) ya estaba cerrado desde las
  sesiones 199/208 — `OPT21_CHECKLIST_NIELSEN.md` no se había actualizado tras esos cierres, corregido
  en esta misma sesión; y la propuesta de dividir `app.js` en módulos ES nativos chocaba
  directamente con la decisión ya tomada en `T14` (sesiones 206-207): los tests cargan `app.js` con
  `vm.Script`, incompatible con módulos ES, el hogar ya confirmó seguir con el patrón `views/*.js`
  existente — reformulada como continuación de `T14`, nunca como sustitución.
- **Decisión de disciplina, aplicada al propio documento nuevo**: en vez de convertir las 68
  propuestas en 68 tareas activas (el patrón que la propia auditoría señala como riesgo de las
  cuatro rondas anteriores), `BACKLOG_CONTABILIDADCASA_3_0.md` activa de inmediato solo lo que no
  depende de datos de uso (telemetría mínima como prerrequisito único de Bloque 0, el modelo de
  periodo, arquitectura/deuda técnica, y las correcciones de navegación/flujo con evidencia ya
  documentada) y dedica el resto — la mayoría de las 22 funcionalidades nuevas — a una "Cola B"
  explícitamente condicionada a que la telemetría corra un mes y el hogar decida activarla con
  datos delante.
- **`BACKLOG_INDICE.md` actualizado**: nueva entrada de estado, fila nueva en el mapa completo, y
  `BACKLOG_CONTABILIDADCASA_2_0.md` marcado como "casi cerrado, absorbido en la cola única de 3.0"
  en vez de sustituido — su detalle sigue siendo la referencia de las 16 tareas heredadas.
- **Validación**: `npm test` — 4.561 pruebas, 4.555 pass / 6 fail. Las 6 fallas son preexistentes en
  `main` (verificado contra el HEAD limpio antes de este cambio, con `git stash`): 5 son fallos de
  `opt3-minify-dist.test.cjs` (`build:site`/esbuild, entorno de este contenedor) y 1
  (`lev14-apalancamiento-escalonado`) pasa en aislamiento tanto antes como después del cambio —
  flake de orden de ejecución del conjunto completo, no causado por este cambio. Este cierre es
  puramente documental (tres ficheros `.md`, ningún fichero de código de la app) — no se ejecutó
  `npm run verify` completo por no tocar código ni el sitio publicado, solo `npm test`.
- **Pendiente de publicar**: commit y push a `claude/sharp-faraday-fdy3ea`, PR en borrador y fusión
  a `main` en cuanto el CI esté en verde, según la autorización permanente de `CLAUDE.md`.

## Cierre de sesión — 21 de septiembre de 2026 (217): `I2` — arranca la captura de la serie histórica de valoraciones; `I3` aparcada a propósito; `I8` — impacto en el colchón sobre `INV18`; `I13` nueva

- **Qué pedía la sesión**: retomar `I2`/`I3` (histórico de valoraciones + correlación real) e `I8`
  (simulador de evento de liquidez), los tres bajo "condicionadas" en §6. A diferencia de `I9`
  (sesión 216), aquí el hueco no era de arquitectura sino de datos: no existe ningún mecanismo en la
  app que guarde el valor de cada posición mes a mes, solo un valor puntual actual. Presentado al
  hogar antes de tocar código: fabricar una "correlación real" sin historial real sería una cifra
  falsa con apariencia de real, no una demo honesta como la de `I9` — y `I3` además revierte una
  decisión explícita del hogar (sesión 171: `INV16` declarada/editable a propósito). El hogar
  decidió: `I2` — empezar a capturar ya, aunque el historial útil tarde meses; `I3` — aparcada hasta
  tener ese historial, y entonces mantener `INV16` y la calculada **en paralelo**, nunca sustituir
  una por otra; `I8` — preguntado si aplicaba, el hogar respondió "más un dinero inesperado" y, al
  precisar, confirmó dos orígenes reales distintos: venta de activos e ingreso extraordinario ajeno a
  la cartera. Decidido separarlas: `I8` se construye ya con el alcance original (venta de activos),
  el ingreso extraordinario pasa a `I13`, nueva tarea sin construir. Sobre "ejercicio de opciones"
  (la otra mitad del alcance original de `I8`) no se confirmó si aplica — queda fuera sin construir,
  ver el detalle al cierre de esta entrada.
- **Qué se hizo (`I2`)**: nuevas `recordIv1ValuationSnapshot(monthKey, closedAt)` /
  `loadIv1ValuationHistory()` / `saveIv1ValuationHistory()` (`app.js`), mismo patrón local que ya
  usan `C-13` (`recordCierreAprendizaje`), `D-2b` (`saveDebtCapitalSnapshotAtClose`) y `PVC6`
  (`recordPvc6ForecastSnapshot`): un snapshot congelado — `{monthKey, closedAt, positions[]}`, con
  `currentValue`/`costBasis` reales de `iv1PositionsList()`, nada fabricado — en cada cierre de mes
  firmado (`closeCurrentMonthTransaction`), sin tocar el RPC transaccional ni el esquema remoto de
  Supabase. Idempotente: reabrir y volver a cerrar el mismo mes sustituye su entrada, no la duplica
  (mismo criterio de `filter`+`unshift` que `PVC6`). Tope de 60 snapshots (5 años), mismo criterio de
  `PVC6` (36). Única superficie visible, nunca en silencio: `renderIv1ValuationHistoryNote()` en
  Cartera, justo bajo el gráfico de `I9`, dice cuántos meses hay capturados y desde/hasta cuándo, sin
  prometer ninguna correlación que `I3` todavía no puede calcular.
- **Verificado**: `npm run verify` en verde — **4551/4551 pruebas** (11 nuevas en
  `tests/i2-serie-historica-valoraciones.test.cjs`; 26 canarios de versión de `app.js?v=`
  actualizados), `test:a11y` (1386 IDs únicos), `test:performance`, `build:site`, `test:privacy` y
  `test:smoke` sin errores. Verificación en navegador real (Playwright): nota vacía al arrancar sin
  historial; tras simular un cierre, "1 mes capturado" con el mes real; recerrar el mismo mes no
  duplica; un segundo mes distinto amplía el rango correctamente ("desde agosto de 2026 hasta
  septiembre de 2026"); los datos guardados en `localStorage` son los valores reales de la posición
  añadida, no una cifra de relleno.
- **Publicado (`I2`)**: commit, push a la rama de trabajo en curso, PR en borrador y fusión a `main`
  en cuanto el CI se puso en verde, misma autorización vigente (`CLAUDE.md`).
- **`I3` sigue sin construirse a propósito** (decisión ya tomada, ver arriba: en paralelo con
  `INV16` cuando `I2` acumule suficiente).
- **Qué se hizo (`I8`, continuación de la misma sesión)**: investigado antes de construir nada desde
  cero — `INV18` ("¿de qué posición y cuándo saco X€ más barato?", Oleada 4) ya resolvía la mitad de
  cartera de `I8`: qué vender y con qué coste fiscal (`inv18WithdrawalPlan`, tramos progresivos
  reales). Solo faltaba la mitad de colchón que pedía la nota de `I8` ("integrado con cartera y
  colchón"). Nueva `inv18CushionImpact(result)` (`app.js`): con el neto real del plan (`totalNet`,
  nunca el importe bruto pedido — el coste fiscal también sale de la liquidez futura) calcula el
  antes/después contra el mismo `cushionFloor` que ya usa Plan/Análisis/Hoy
  (`FinanceCanonicalCushion`), con su nivel (negativo/ajustado/holgado). `inv18PlanHtml()` gana un
  tercer parámetro opcional que añade el párrafo "Impacto en el colchón" cuando hay datos, sin
  cambiar nada si no los hay (llamadas existentes sin ese argumento siguen igual). Se reutilizó la
  misma tarjeta de `INV18` (Inversión → Fiscal) en vez de duplicar un simulador aparte — misma
  lección de `I9`: investigar antes de construir a ciegas. "Ejercicio de opciones" queda fuera:
  ningún tipo de posición ni modelo fiscal de stock options existe hoy en la app, y no se confirmó
  con el hogar si aplica — construirlo sin esa confirmación habría sido fabricar un cálculo (tributa
  distinto que una venta normal: rendimiento del trabajo al ejercer, ganancia patrimonial después).
- **`I13` — nueva, sin construir**: la otra mitad de lo que describió el hogar sobre `I8`, un ingreso
  extraordinario sin origen en cartera (herencia, bonus, venta de algo fuera de cartera...). No
  existe ningún comparador para esto: `imprevisto` (motor de Escenarios) modela un gasto de golpe,
  no un ingreso — forzar un importe negativo ahí sería una pieza pensada para lo contrario, no una
  reutilización honesta. La pregunta real es "¿a dónde va este dinero?" (deuda/inversión/colchón/
  objetivo, cada uno con su coste de oportunidad) — sin construir hasta confirmar con el hogar el
  comparador exacto que necesita, mismo criterio que `I7`.
- **Verificado (`I8`)**: `npm run verify` en verde — **4561/4561 pruebas** (10 nuevas en
  `tests/i8-evento-liquidez.test.cjs`, motor real de `canonical-cushion.js` vía `require`, mismo
  criterio que ya usa `tests/inv18-plan-retirada-mas-barato.test.cjs` con `canonical-irpf-estimator.js`;
  26 canarios de versión de `app.js?v=` actualizados), sin regresión en los 15 tests ya existentes de
  `INV18`. Verificación en navegador real (Playwright, Inversión → Fiscal): con una posición sin
  plusvalía (aísla el cálculo de colchón del requisito preexistente de escalas de IRPF), el plan
  calcula neto recibido y el párrafo de colchón aparece con las cifras y el nivel correctos en dos
  escenarios (por encima del mínimo → sigue por encima; por debajo del mínimo → sigue por debajo).
- **Publicado (`I8`)**: commit, push a la rama de trabajo en curso, PR en borrador y fusión a `main`
  en cuanto el CI se puso en verde, misma autorización vigente (`CLAUDE.md`).

## Cierre de sesión — 20 de septiembre de 2026 (216): `I9` — gráfico de cartera con zoom y tooltip

- **Qué pedía la sesión**: retomar `I9`, aplazada en la sesión 209 por exigir una decisión de
  arquitectura previa (mantener «cero dependencias externas de UI» o adoptar una librería ligera
  solo para inversión). Antes de tocar código se presentó al hogar el estado real de la base de
  código: Cartera (`renderIv1PositionList`) no tenía ningún gráfico, todos los gráficos existentes
  de la app (cono de incertidumbre, ruta de deuda, escenarios) son SVG a mano sin librería, y el
  "tooltip" de `P2` (sesión 210) es más sencillo de lo que sugiere el nombre — botones HTML con
  `title`/`aria-label` nativos, sin lógica de arrastre. El "zoom" que pide `I9` no tenía precedente
  en la app. **El hogar decidió**: cero dependencias (mantener el precedente arquitectónico) y
  construirla ya contra datos de prueba, indicándolo visiblemente en la app, en vez de esperar a
  tener cartera real.
- **Qué se hizo**: nueva tarjeta «Cartera de un vistazo» en Registrar → Cartera, antes de la lista
  de posiciones. Una fila horizontal por posición (`iv1PositionChartRowsHtml()`, parte pura,
  separada de `renderIv1PositionChart()` que solo decide datos reales vs. de ejemplo e inyecta en
  el DOM — mismo criterio de P2 con `pv4ConfidenceBandHtml`): ancho de barra ∝ valor actual sobre
  el máximo del conjunto (nunca fabricado), marca de coste (`--chart-muted-line`, el token de línea
  de referencia que ya introdujo `T7`) independiente del color, y color verde/rojo según
  plusvalía/minusvalía (reutiliza `.positive`/`.negative`). "Zoom" son tres anchos fijos de columna
  de barra controlados por botón (`--iv1-chart-track-width`, 120/220/360px) — decisión deliberada de
  alcance: con posiciones de valor parecido, ensanchar la barra es lo que de verdad ayuda a
  distinguirlas, y evita reimplementar arrastre/pellizco a mano (accesible por teclado y táctil sin
  gestos nuevos). El tooltip reutiliza el patrón de `P2`: `title` nativo por fila. Sin posiciones
  reales (`iv1PositionsList()` vacío), usa `IV1_CHART_SAMPLE_POSITIONS` (4 posiciones, cada una
  etiquetada «(ejemplo)» en su propio nombre) y muestra `#iv1ChartDemoNote`, visible y explícita —
  desaparece sola en cuanto se registra la primera posición real. El gráfico se mantiene
  sincronizado: `renderIv1PositionChart()` se llama junto a `renderIv1PositionList()` en los cinco
  puntos de mutación (alta, aportación, venta parcial, traspaso, borrado de posición) y al abrir la
  pantalla (`renderInversionCartera`, `views/inversion.js`). Reutiliza componentes ya catalogados en
  `docs/E19_SISTEMA_DISENO.md` (`.e19-card`, `.e19-kpi-note`, `.registrar-mes-filter`/`-filters`
  para los botones de zoom, mismo patrón que el selector de horizonte de Plan) en vez de crear
  clases nuevas — ninguna clase de UI nueva más allá del bloque `.iv1-chart-*` propio de esta
  pantalla.
- **Verificado**: `npm run verify` en verde — **4540/4540 pruebas** (16 nuevas en
  `tests/i9-grafico-cartera.test.cjs`: parte pura de `iv1PositionChartRowsHtml` con `vm` sandbox,
  igual que ya hace `p2-tooltip-cono-incertidumbre.test.cjs`, más wiring de zoom, dataset de
  ejemplo y sincronización en los cinco puntos de mutación; 26 canarios de versión de `app.js?v=`
  actualizados), `test:a11y` (1385 IDs únicos), `test:performance`, `build:site`, `test:privacy` y
  `test:smoke` sin errores. Verificación en navegador real (Playwright contra `index.html` servido
  localmente, navegando a `#inversion-cartera`): estado de ejemplo con nota visible y 4 filas;
  zoom a nivel 3 confirmado por `getComputedStyle` (`--iv1-chart-track-width: 360px`); al añadir una
  posición real, la nota desaparece y el gráfico pasa a mostrar solo la posición real — capturas de
  pantalla de los tres estados revisadas.
- **Publicado**: commit, push a la rama de trabajo en curso, PR en borrador y fusión a `main` en
  cuanto el CI se puso en verde, misma autorización vigente (`CLAUDE.md`).

## Cierre de sesión — 20 de septiembre de 2026 (215): `T9` fase 4 — mobile-first en Registrar (saldo de cuentas)

- **Qué pedía la sesión**: continuar `T9` con la siguiente pantalla tras completar Hoy (fases 1-3,
  sesiones 212-214), con el mismo criterio de mayor uso diario. Entre Registrar y Plan, el hogar
  confirmó **Registrar** (la única puerta de escritura de datos reales, de uso más frecuente que
  Plan, que es de cadencia mensual).
- **Investigación previa** (mismo método que las fases anteriores, antes de tocar CSS): de las 36
  apariciones de `@media` en `styles.css`, solo una regla en todo Registrar/Plan es 100% exclusiva
  de esas dos pantallas y no vive en un bloque compartido con otras: `.e19-registrar-balance-layout`
  (Registrar → «Saldo de cuentas», el panel de saldo por cuenta en paralelo con «qué se recalcula al
  guardar»). El resto de lo responsive de Registrar vive en el bloque gigante compartido de 20-30
  clases (`.data-import-grid`, junto a `.home-action-grid` y otras — mismo bloque que ya se dejó
  fuera en la fase 1) o no tiene `@media` que invertir (p. ej. `.e19-registrar-recalc-grid`). Plan no
  tiene ninguna regla exclusiva con `@media`. Candidato único, sin ambigüedad.
- **Qué se hizo**: invertida `.e19-registrar-balance-layout` a mobile-first (base = 1 columna,
  `@media (min-width: 1441px)` aporta las 2 columnas de escritorio), misma posición en el archivo
  que ocupaba el `@media (max-width: 1440px)` que sustituye. Regla independiente, sin otra clase con
  la que competir en cascada (a diferencia de `.home-layout-triple` en la fase 3).
- **Verificado**: `getComputedStyle().gridTemplateColumns` y el bounding box del elemento en 10
  anchos de viewport (360 a 1920px, incluida la frontera exacta 1440/1441px) con Playwright,
  comparando antes/después del cambio — resultado idéntico en los 10. `npm run verify` en verde:
  4524/4524 pruebas (sin pruebas nuevas), `test:a11y` (1380 IDs únicos), `test:performance`,
  `build:site`, `test:privacy` y `test:smoke` sin errores.
- **Publicado**: commit, push a la rama de trabajo en curso, PR en borrador y fusión a `main` en
  cuanto el CI se puso en verde, misma autorización vigente (`CLAUDE.md`).
- **`T9` sigue abierta**: con esto, la única regla exclusiva de Registrar/Plan queda invertida.
  Siguiente candidato natural: acometer el bloque `@media` compartido (`.data-import-grid` y las
  20-30 clases que lo acompañan) como su propio incremento auditado — mismo riesgo que se dejó fuera
  a propósito en la fase 1, no una regla aislada de una sola pantalla.

## Cierre de sesión — 19 de septiembre de 2026 (214): `T9` fase 3 — mobile-first en la fila triple de Hoy (Hoy queda completa)

- **Qué pedía la sesión**: cerrar `T9` para la pantalla Hoy con la última regla aislada pendiente,
  `.home-layout-triple` (Riesgo/Modo familiar/Alertas, breakpoint 1440px) — la que llevaba desde la
  fase 1 la dependencia de orden documentada frente a `.home-layout`.
  - Mismo recorte quirúrgico: base incondicional pasó de 3 columnas a 1 (valor móvil); el valor de
    escritorio (3 columnas) se movió a `@media (min-width: 1441px)`, **en la misma posición del
    archivo** que ocupaba el `@media (max-width: 1440px)` que sustituye — condición necesaria para
    que siga ganando sobre `.home-layout` (ya invertida en la fase 1) cuando ambas reglas aplican al
    mismo elemento, exactamente igual que antes de invertir nada.
- **Validación**: misma disciplina que las fases 1 y 2 — comparación píxel a píxel con
  `git stash`/Playwright en 8 anchos de viewport (375 a 1920px), incluida la interacción con
  `.home-layout` en la misma medición; coincide exactamente con el resultado previo al cambio.
  `npm run verify` en verde: 4524/4524 pruebas (sin pruebas nuevas), `test:a11y` (1380 IDs únicos),
  `test:performance`, `build:site`, `test:privacy` y `test:smoke` sin errores.
- **Publicado**: commit, push a la rama de trabajo en curso, PR en borrador y fusión a `main` en
  cuanto el CI se puso en verde, misma autorización vigente (`CLAUDE.md`). Ya en producción.
- **`T9` en Hoy queda completa (3/3 fases)**: `.home-layout`/`.home-action-grid` (fase 1, sesión 212),
  `.home-month-glance-rows` (fase 2, sesión 213) y `.home-layout-triple` (fase 3, esta sesión), las
  tres invertidas a mobile-first sin cambiar ni un píxel del resultado visual en ningún ancho
  probado. Queda fuera de esta tarea, documentado: `.home-kpi-grid` (compartida con
  Cierre/Conciliar/Registrar mes/Cambios pendientes) y todo lo que vive en los bloques `@media`
  compartidos con 20-30 clases de otras pantallas — `T9` sigue abierta como tarea de backlog para
  cuando se retome con otra pantalla (Registrar o Plan, siguiendo el mismo criterio de mayor uso
  diario), o para acometer esos bloques compartidos como su propio incremento auditado.

## Cierre de sesión — 19 de septiembre de 2026 (213): `T9` fase 2 — mobile-first en «el mes en una línea» de Hoy

- **Qué pedía la sesión**: continuar `T9` con la fase 2 acordada, `.home-month-glance-rows` («el mes en
  una línea», H-6), tras fusionarse la fase 1. Regla aislada (sin bloques compartidos con otras
  pantallas, confirmado antes de tocarla) — base incondicional pasó de 3 columnas a 2 (valor móvil);
  el valor de escritorio (3 columnas) se movió a `@media (min-width: 761px)`, en la misma posición del
  archivo que ocupaba el `@media (max-width: 760px)` que sustituye.
- **Validación**: misma disciplina que la fase 1 — comparación píxel a píxel con `git stash`/Playwright
  en 8 anchos de viewport (375 a 1920px), coincide exactamente con el resultado previo al cambio.
  `npm run verify` en verde: 4524/4524 pruebas (sin pruebas nuevas), `test:a11y` (1380 IDs únicos),
  `test:performance`, `build:site`, `test:privacy` y `test:smoke` sin errores.
- **Publicado**: commit, push a la rama de trabajo en curso, PR en borrador y fusión a `main` en cuanto
  el CI se puso en verde, misma autorización vigente (`CLAUDE.md`). Ya en producción.
- **Queda fase 3** (`.home-layout-triple`, breakpoint 1440px) de esta misma tarea para la siguiente
  sesión.

## Cierre de sesión — 19 de septiembre de 2026 (212): `T9` fase 1 — mobile-first en el layout principal de Hoy

- **Qué pedía la sesión**: seguir con `T9` (única tarea sin bloqueo real que quedaba en
  `BACKLOG_CONTABILIDADCASA_2_0.md`), empezando por Hoy. Antes de tocar CSS se investigó la
  estructura real de `styles.css` (32 `@media (max-width...)` en todo el archivo) y se encontraron
  dos riesgos reales que no estaban en el radar al aceptar la tarea: (1) la mayoría de esas reglas
  viven dentro de bloques `@media` **compartidos con 20-30 clases de otras pantallas** (deuda,
  agente...), agrupadas ahí solo para no repetir declaraciones — invertir esos bloques sin querer
  amplía el alcance a pantallas no auditadas en esta sesión; (2) una dependencia de cascada real y ya
  documentada en el propio código (`.home-layout-triple` depende del **orden de aparición en el
  archivo** frente a `.home-layout` para colapsar bien). Puesto esto delante del hogar antes de
  escribir una línea, **se decidió un enfoque quirúrgico por fases**: invertir solo las reglas
  100% exclusivas de Hoy, publicando cada fase por separado, dejando fuera de esta tarea (documentado)
  lo que vive en los bloques compartidos con otras pantallas (`.home-kpi-grid`, usado también en
  Cierre/Conciliar/Registrar mes/Cambios pendientes — confirmado con `grep` sobre `index.html`, no
  es exclusivo de Hoy como parecía a primera vista).
- **Fase 1 — `.home-layout` y `.home-action-grid` (breakpoint 1440px)**: invertidos a mobile-first.
  La base incondicional pasa a ser el valor móvil (1 columna, `width: 100%` en `.home-layout`); el
  layout de escritorio (2 columnas) se movió a `@media (min-width: 1441px)`, **en la misma posición
  del archivo que ocupaba el `@media (max-width: 1440px)` que sustituye** — condición necesaria para
  no alterar el orden de cascada frente a `.home-layout-triple` (que sigue sin invertir, en su
  posición original, más abajo en el archivo) y frente a la dependencia ya documentada. Hallazgo de
  paso: `.home-action-grid` en solitario ya era CSS inerte en producción — `#homeActions` recibe
  siempre la clase `unified-action-list` por JS (`app.js`, T3/UX-2), de mayor especificidad, que fija
  1 columna a cualquier ancho; el cambio no altera el resultado visual hoy, pero corrige la
  declaración para cuando esa clase deje de aplicarse.
- **Validación**: comparación exacta píxel a píxel — `git stash` del cambio, reconstruido `dist/` y
  medido `getComputedStyle(...).gridTemplateColumns` de `.home-layout`, `#homeActions` y
  `.home-layout-triple` en 8 anchos de viewport (375 a 1920px) con Playwright real; **coincide
  exactamente, carácter a carácter, con la misma medición tras aplicar el cambio** — cero diferencia
  visual en ningún ancho probado. `npm run verify` en verde: 4524/4524 pruebas (sin pruebas nuevas,
  cambio puramente CSS sin cobertura unitaria propia), `test:a11y` (1380 IDs únicos), `test:performance`,
  `build:site`, `test:privacy` y `test:smoke` sin errores.
- **Publicado**: commit, push a la rama de trabajo en curso, PR en borrador y fusión a `main` en
  cuanto el CI se puso en verde, misma autorización vigente (`CLAUDE.md`). Ya en producción.
- **Quedan fase 2** (`.home-month-glance-rows`, breakpoint 760px) **y fase 3** (`.home-layout-triple`,
  breakpoint 1440px, depende del orden ya verificado seguro con la fase 1) **de esta misma tarea para
  la siguiente sesión**, cada una con su propia verificación y publicación por separado.

## Cierre de sesión — 19 de septiembre de 2026 (211): `T13` — herencia financiera con aportación equivalente de los padres

- **Qué pedía la sesión**: retomar `BACKLOG_CONTABILIDADCASA_2_0.md` y seguir con la siguiente tarea
  sin bloqueo real. De las dos que quedaban (`T9`, `T9` aparte por su perfil de riesgo tipo `T14`, y
  `T13`), `T13` llevaba la nota "a la espera de confirmar con el hogar si el escenario sigue siendo
  real" — igual criterio que `I6`-`I8`. Puesta la pregunta delante del hogar antes de tocar código:
  **el hogar confirmó que el escenario es real (un hijo de 21 años)** y, preguntado qué significa
  concretamente "aportación equivalente", eligió las tres interpretaciones a la vez: donación en vida
  vs. herencia futura (con coste fiscal), una ayuda periódica declarada, y una simulación educativa
  "si tú ahorraras igual que nosotros". Esto amplía el alcance real frente al esfuerzo `M`/beneficio
  `Bajo` declarado en el backlog — documentado aquí para quien lo revise después.
- **Donación en vida vs. herencia futura**: nuevo comparador informativo en Herramientas avanzadas ›
  Patrimonio, junto al aviso fiscal de `LPX4` (`t13DonationVsInheritanceEstimate()`, `app.js`).
  Reutiliza tal cual el motor de `LPX4` — `lpNetWorthSnapshot()`, la escala "succession" de `A15-2`
  con fuente completa, `lpx4ExemptAmount()` — nunca un registro fiscal propio. "Donar ahora" aplica la
  escala sobre un importe hipotético declarado por el hogar (`t13DonationAmount`); "dejarlo en
  herencia" **no proyecta un patrimonio futuro inventado** — calcula el coste marginal de ese importe
  dentro del patrimonio de hoy (`quota(patrimonio) − quota(patrimonio − importe)`), con el aviso
  explícito de que es una fotografía de hoy, no una promesa. Sin patrimonio calculable, sin escala con
  fuente completa o sin importe declarado, no calcula ninguna cifra — mismo criterio de `LPX4`.
  Informativa a propósito (mismo motivo que `LPX4`: comunidad autónoma, grupo de parentesco y
  patrimonio preexistente del heredero, ninguno declarado en la app).
- **Ayuda periódica declarada + proyección educativa de ahorro**: ambas extienden la vista para hijos
  de `MDX1` (`redactKidsSummaryView()`, `canonical-share-link.js`) con dos campos opcionales más —
  `periodicHelp` (una cifra que el hogar declara y quiere que el hijo vea) y `projection` (una
  proyección de anualidad compuesta mensual, `t13ChildSavingsProjection()` en `app.js`, motor puro
  nuevo — ningún engine existente simula el ahorro de una persona hipotética sin cartera real). Ambos
  campos son `null` explícito sin declarar — el enlace generado para un hijo sin estos datos sale
  exactamente igual que antes (sin cambio de comportamiento para quien no toca los campos nuevos).
  Nuevos controles en Herramientas avanzadas › Datos, junto al generador de enlace de `A19-1`: ayuda
  periódica, aportación mensual a simular, rentabilidad anual esperada y años — los tres últimos
  **declarados por el hogar, nunca copiados de la cartera real ni del ahorro real del hogar** (lo que
  el hogar consigue no representa lo que el hijo conseguiría). `share.html` (`renderKidsSummary`)
  amplía sus dos líneas existentes con una tercera y cuarta condicionales, con el mismo aviso de "no
  es una promesa de rendimiento".
- **Validación**: `npm run verify` en verde: **4524/4524 pruebas** (65 nuevas: 19 de
  `tests/t13-donacion-vs-herencia.test.cjs`, el resto ampliando `tests/mdx1-vista-educativa-hijos.test.cjs`
  con las pruebas de `periodicHelp`/`projection`/`t13ChildSavingsProjection`/`t13KidsSummaryExtras`;
  `tests/gob9-panel-resiliencia.test.cjs` actualizado para reflejar los dos repintados nuevos en el
  lote de `renderAjustes`), `test:a11y` (1380 IDs únicos), `test:performance`, `build:site`,
  `test:privacy` y `test:smoke` sin errores. Verificación en navegador real (Playwright contra
  `dist/`): sin activos ni escala declarados, el comparador de donación/herencia muestra el aviso
  correcto sin calcular nada; con un activo de 500.000 € y la escala de sucesiones registrada, un
  importe hipotético de 150.000 € da 10.000 € (donar ahora) frente a 15.000 € (coste marginal en
  herencia, sobre un patrimonio neto de 488.000 € tras la deuda ya cargada en el demo) — cifras
  consistentes con el cálculo ya verificado de `LPX4` sobre el mismo patrimonio y escala. Los cuatro
  campos nuevos de la vista para hijos persisten correctamente (`mdx1KidsSummarySource()` devolvió
  `periodicHelp: 80` y una proyección de 100 €/mes al 5 % durante 10 años = 15.528,23 € con
  12.000 € de aportación propia). `renderKidsSummary()` de `share.html` verificado aparte con un
  sandbox Node (sin Supabase real disponible en este entorno): con los campos nuevos en `null`
  reproduce exactamente el HTML de antes de esta sesión; con ambos declarados añade las dos frases
  nuevas sin tocar las dos existentes. Cero errores de consola en ambas comprobaciones de navegador.
- **Publicado**: commit, push a la rama de trabajo en curso, PR en borrador y fusión a `main` en
  cuanto el CI se puso en verde, misma autorización vigente (`CLAUDE.md`). Ya en producción.

## Cierre de sesión — 19 de septiembre de 2026 (210): `P12` — informe mensual, `P11` — comparativa interanual por categoría, `P2` — tooltip por mes en el cono de incertidumbre, `T10` — PWA instalable con deuda cara, `T11` — foto y geolocalización en la ficha de gasto

- **Qué pedía la sesión**: retomar `BACKLOG_CONTABILIDADCASA_2_0.md` (Horizonte 4) y proponer al
  hogar un plan para el resto de la cola sin bloqueo real (`P2`, `P11`, `P12`, `T9`, `T10`, `T11`,
  `T13`). Antes de tocar código se presentó al hogar una prioridad razonada por riesgo de regresión y
  encaje con lo ya construido, no solo por la etiqueta de esfuerzo/beneficio del backlog: `P12`
  primero (apalanca `GOB14`, ya validado), `P11` segundo (complementa a `P12` y reutiliza
  infraestructura ya probada), `T10`/`P2` a continuación, `T11` como comodín barato, `T9`
  (mobile-first) aparte por ser la única tarea `L` de la cola con perfil de riesgo equivalente al que
  tuvo `T14` (el monolito, 8 incrementos), y `T13` al final a la espera de confirmar con el hogar si
  el escenario sigue siendo real. **El hogar confirmó empezar por `P12` y `P11`, con margen para las
  dos en la misma sesión.**
- **`P12` — informe mensual en una página («board pack» doméstico)**: investigado primero `GOB14`
  (`app.js`, informe trimestral exportable) — su contexto (`gob14QuarterlyReportContext()`) resultó
  no estar realmente acotado al trimestre: solo etiqueta con el trimestre en curso una lectura de
  `unifiedActionCenterModel()` (A2-6) que ya es "estado actual", sin ventana temporal propia. Extender
  a cadencia mensual no pedía ningún motor nuevo, solo otro periodo. Refactor mínimo sin cambiar el
  comportamiento existente: se extrajo `gob14ReportBodyHtml(context)` (tabla de cifras con
  procedencia, decisiones prioritarias y aviso de confianza) del cuerpo de
  `gob14QuarterlyReportPrintHtml()`, que ahora la reutiliza sin cambiar su salida. Nuevas
  `p12MonthLabel()`, `p12MonthlyReportContext()`, `p12MonthlyReportPrintHtml()` y
  `downloadP12MonthlyReport()` (`app.js`) siguen el mismo patrón que `GOB14`, mismo mecanismo de "PDF
  de una página" (`#cierrePrintEvidence` + `window.print()`). Botón nuevo «Descargar informe mensual»
  junto al trimestral existente en Herramientas › Datos (`#herramientas-datos`).
- **`P11` — comparativa contra el mismo periodo del año anterior, por categoría**: investigado primero
  si "Comparar dos momentos" (UX3, Análisis) ya cubría el hueco — no: UX3 compara dos meses
  cualesquiera elegidos a mano, en total, sin desglose por categoría, así que no separa estacionalidad
  estructural (colegio, vacaciones) de desviación real como pedía la nota. Tampoco lo cubre "Tú frente
  a tu propio histórico" (T12, sesión 208): compara el flujo neto total de los últimos 12 meses, no
  categoría a categoría ni contra el mismo mes del año pasado. Nuevas `p11PriorYearMonthKey()`,
  `p11CategoryExpenseTotal()`, `p11YearOverYearCategoryComparison()` y
  `renderP11YearOverYearComparison()` (`app.js`), llamada desde `renderAnalisis()`
  (`views/analisis.js`): por cada categoría con gasto en el mes en curso o en el mismo mes 12 meses
  antes, `budgetExpenseTransactions()` (ya usado por Presupuesto del mes/P8/revisión anual) da el
  gasto real de cada uno de los dos meses, sin agrupación propia. El umbral que decide "desviación
  real" frente a "estable/estacional" es el mismo ya declarado en Ajustes
  (`partidaDeviationThreshold`, V6-2) — regla transversal 09 (un umbral, no uno por pantalla), en vez
  de inventar un segundo umbral solo para esta tarjeta. Sin umbral configurado, o sin gasto el año
  pasado en esa categoría (categoría nueva), se muestran las cifras sin veredicto en vez de fabricar
  un "desviación real"/"estable" sin base (regla transversal 04). Nueva tarjeta «Mismo mes, año
  anterior» en Análisis, justo después de "Comparar dos momentos".
- **Validación**: `npm install` primero (mismo hueco de entorno ya documentado en sesiones 208/209:
  `esbuild` declarado en `package.json` pero ausente del `node_modules` de arranque del contenedor —
  sin relación con el código). Tras instalar, `npm run verify` en verde: **4459/4459 pruebas** (22
  nuevas: 11 de `tests/p12-informe-mensual-familia.test.cjs`, 11 de
  `tests/p11-comparativa-interanual.test.cjs`; `tests/gob14-informe-trimestral-familia.test.cjs`
  actualizado para sandboxar el nuevo `gob14ReportBodyHtml` compartido, sin cambiar sus expectativas;
  27 canarios de versión de `app.js?v=` actualizados — mismo patrón que sesiones anteriores),
  `test:a11y` (1372 IDs únicos), `test:performance`, `build:site`, `test:privacy` y `test:smoke` sin
  errores. Verificación en navegador real (Playwright contra `dist/`, con transacciones sintéticas
  inyectadas porque el demo público no trae transacciones reales por privacidad — mismo criterio que
  usaron `P8`/`D8`): botón «Descargar informe mensual» dispara `window.print()` una vez y rellena el
  contenedor con «Informe mensual — septiembre de 2026» y la tabla de cifras ejecutivas; la tarjeta de
  `P11` con dos categorías sintéticas (colegio +20 €, dentro del umbral del 10 %; ocio +200 €, por
  encima) muestra correctamente «Estable / estacional» y «Desviación real» en cada fila, con las
  cabeceras "sept 26"/"sept 25".
- **Publicado (`P12`/`P11`)**: commit, push a la rama de trabajo en curso, PR en borrador
  ([#342](https://github.com/javierbarriusom-a11y/contabilidadcasa/pull/342)) y fusión a `main` en
  cuanto el CI se puso en verde, misma autorización vigente (`CLAUDE.md`). Ya en producción.
- **`P2` — cono de incertidumbre con tooltip (P10/P50/P90 y categoría dominante), tercera tarea de la
  misma sesión**: investigado primero `pv4ConfidenceBandHtml()` (PVC19, `app.js`) y su fuente
  `confidenceBands()` (`canonical-forecast.js`) — el margen bajo/centro/alto por mes no es un
  Monte Carlo por mes, es una única cifra de sesgo agregada (`biasMargin`, media de
  `|averageDelta|` de `learning.deviations`) que se ensancha con √(mes+1): la nota pide "P10/P50/P90"
  con el mismo sentido que ya usa el resto de la app para low/center/high (mismo triángulo que
  `esx1MonteCarloHtml`), así que se etiquetan así en el tooltip sin fingir un cálculo por mes que el
  motor no hace. "Categoría dominante" tampoco existe por mes en el motor — se deriva una sola vez de
  `learning.deviations` (mismo array que ya usa el termómetro de desviación por partida, PV2): nueva
  `pv4DominantDeviationCategory()` (`app.js`) elige la partida con mayor `|averageDelta|` entre las
  que tienen muestra, y el tooltip la repite igual en los doce meses (nunca un desglose mes a mes que
  no se calcula). Interacción: `pv4ConfidenceBandHtml(bands, dominant)` gana un segundo parámetro
  opcional y pinta un `<button>` HTML marcador por mes (no un `<circle>` SVG — el viewBox 0-100 con
  `preserveAspectRatio="none"` del propio cono estira x e y en proporciones distintas, un radio fijo
  habría salido deformado en óvalo), posicionado con el mismo `xAt`/`yAt` que ya calcula el SVG, con
  `title`/`aria-label` nativos idénticos (accesible sin depender del ratón). Ajuste de CSS durante la
  verificación en navegador: la hoja global fija `button { min-height: 38px; padding: 8px 13px; }`
  para el tamaño mínimo de toque (correcto para botones de acción), que convertía el marcador de 10px
  en un óvalo de 38px de alto — corregido con un override puntual en `.pv4-cone-marker` (mismo
  criterio que ya usa `.e17-dialog-head > button` para otro botón pequeño), sin tocar la regla global.
- **Validación (`P2`)**: `npm run verify` en verde: **4469/4469 pruebas** (10 nuevas en
  `tests/p2-tooltip-cono-incertidumbre.test.cjs`; `tests/pv4-bandas-confianza.test.cjs` actualizado en
  una aserción de wiring para el nuevo segundo argumento de `pv4ConfidenceBandHtml`, sin cambiar su
  intención; 27 canarios de versión de `app.js?v=` actualizados), `test:a11y`, `test:performance`,
  `build:site`, `test:privacy` y `test:smoke` sin errores. Verificación en navegador real (Playwright
  contra `dist/`, navegando al Laboratorio de escenarios dentro de `#new-life-simulation`): 12
  marcadores (uno por mes) renderizados sobre el cono, cada uno enfocable por teclado
  (`document.activeElement` tras `.focus()`), con `title`/`aria-label` idénticos y el texto
  "P10/P50/P90" esperado; screenshot manual del cono confirmando doce puntos verdes de 16×16px bien
  alineados sobre la línea central, sin el óvalo del bug de CSS ya corregido.
- **Publicado (`P2`)**: commit, push a la rama de trabajo en curso (reiniciada desde `main` tras la
  fusión de `P12`/`P11`, con el trabajo de `P2` conservado en el árbol de trabajo — mismo criterio que
  documentan las instrucciones de la rama), PR en borrador ([#343](https://github.com/javierbarriusom-a11y/contabilidadcasa/pull/343))
  y fusión a `main` en cuanto el CI se puso en verde, misma autorización vigente (`CLAUDE.md`). Ya en
  producción.
- **`T10` — PWA instalable con vista «de un vistazo», cuarta tarea de la misma sesión**: investigado
  primero `manifest.webmanifest` y `#widget` (`A17-1`) — colchón y próximo evento ya estaban ahí desde
  esa tarea anterior; solo faltaba «deuda cara», la tercera pieza que pedía la nota de `T10`. Al
  investigar la parte «PWA instalable» apareció un hueco real, no solo de producto: `manifest.webmanifest`
  no declaraba ningún `icons`, e `index.html` no tenía ningún `<link rel="icon">` — sin icono, Chrome/
  Android no cumplen su propio criterio de instalabilidad y no ofrecen el instalador nativo de PWA, y la
  pestaña se quedaba con el icono en blanco por defecto. Nuevo `icon.svg` (círculo + «€» sobre fondo
  navy, mismos colores de marca que `theme_color`/`--green`, sin librería de imágenes: solo marcado SVG
  a mano) referenciado a la vez como favicon y como icono del manifest — un solo fichero para las dos
  cosas. Añadido también a `service-worker.js` (`SHELL_URLS`, junto con `manifest.webmanifest`, que
  tampoco viajaba en el shell offline hasta ahora) y a la lista de copia de `tools/build-public-site.mjs`.
  Nueva cuarta tarjeta «Deuda más cara» en `#widget`: `widgetPriciestDebt()` ordena
  `escenarioMotorDebtOptions()` (mismos contratos activos que ya usa `homeDebtOutlook`) por TAE
  descendente — mismo criterio de "tipo más caro primero" que `DI3`/`prioritizeRevolving` y
  `DI5`/`jointRestructuringPlan`, aquí sobre toda la cartera activa, no solo la revolving. Sin ningún
  contrato con TAE declarada, lo dice explícitamente («Sin deuda cara») en vez de mostrar un 0%
  engañoso.
- **Corrección durante la validación**: el primer intento bump-eó también `CACHE_NAME` de
  `service-worker.js` al añadir las dos entradas nuevas a `SHELL_URLS` — 25 pruebas lo rechazaron:
  ese literal es fijo a propósito desde el 19 de agosto (documentado en la cabecera del propio
  fichero), porque `tools/build-public-site.mjs` ya lo reescribe con una versión real en cada build
  (`GITHUB_SHA`), así que el literal del repositorio nunca necesita tocarse — es solo una marca que
  usan las pruebas para confirmar «esto forma parte del shell offline», no una versión real. Revertido
  a su valor original, dejando solo las dos entradas nuevas.
- **Validación (`T10`)**: `npm run verify` en verde: **4481/4481 pruebas** (12 nuevas en
  `tests/t10-pwa-instalable.test.cjs`; 27 canarios de versión de `app.js?v=` actualizados),
  `test:a11y` (1374 IDs únicos), `test:performance`, `build:site`, `test:privacy` y `test:smoke` sin
  errores. Verificación en navegador real (Playwright contra `dist/`): `icon.svg` responde 200 con
  `Content-Type: image/svg+xml`, `manifest.webmanifest` expone su `icons` correctamente, el favicon
  del documento apunta al mismo fichero, y las cuatro tarjetas del widget se pintan en el orden
  correcto — con datos sintéticos inyectados (Tarjeta Cara al 24,9% TAE frente a Banco Barato al 5%),
  la tarjeta de deuda cara elige y muestra correctamente la más cara de las dos, no la primera.
- **Publicado (`T10`)**: commit, push a la rama de trabajo en curso (reiniciada desde `main` tras la
  fusión de `P2`, mismo criterio que las veces anteriores de esta sesión), PR en borrador
  ([#344](https://github.com/javierbarriusom-a11y/contabilidadcasa/pull/344)) y fusión a `main` en
  cuanto el CI se puso en verde, misma autorización vigente (`CLAUDE.md`). Ya en producción.
- **`T11` — ficha de gasto con foto y geolocalización opcional, quinta y última tarea de la
  sesión**: investigado primero si la foto ya estaba cubierta — sí, pero solo a medias. `A17-3`
  (sesión previa, verificado de nuevo por `P7`) cubre la foto de un gasto **nuevo**: capturas un
  ticket, el OCR propone importe/fecha/comercio y se crea un movimiento. Lo que la nota de `T11`
  pedía de verdad — "para reconciliar más rápido sin depender de la descripción del banco" — es
  distinto: adjuntar una foto a un movimiento **ya existente**, típicamente uno importado del banco
  con una descripción ilegible ("PAGO EN COMERCIO 4521"). Ese caso no estaba cubierto: el diálogo de
  detalle de Movimientos (M-6) solo mostraba «Ver foto» cuando `receiptAttachments[transactionIdentity(row)]`
  ya existía — no había forma de crear esa entrada para un movimiento que no hubiera pasado por la
  captura de cámara. Nuevas `movementDetailAttachmentHtml()`, `handleMovementDetailAttachPhoto()`
  (`app.js`), extraídas de `renderMovementDetailDialog()`: mismo mecanismo de adjunto que `A17-3`
  (`P2PrivateStore`/A3-5), aquí con un id generado (`receipt-manual-<timestamp>`) en vez del
  `inboxItemId` de la bandeja E11b, porque el movimiento no pasa por ahí. Geolocalización es
  enteramente nueva: `handleMovementDetailSaveGeo()` usa `navigator.geolocation` (API del navegador,
  sin librería ni servicio externo), redondea a 4 decimales (~11 m, suficiente para "dónde estaba
  cuando compré esto") y guarda `{lat, lon, accuracy, capturedAt}` en la misma entrada de
  `receiptAttachments`, junto a la foto si la hay — son independientes, se puede tener una sin la
  otra. `t11GeoMapUrl()` arma un permalink de OpenStreetMap para verla, sin clave de API. Los
  botones de foto y de ubicación conviven en la misma fila del diálogo (`.movement-detail-attachment`,
  ahora con `flex-wrap` para hasta tres botones a la vez).
- **Validación (`T11`)**: `npm run verify` en verde: **4497/4497 pruebas** (16 nuevas en
  `tests/t11-foto-geolocalizacion-movimiento.test.cjs`; `tests/a17-3-captura-camara.test.cjs`
  actualizado para sandboxar el nuevo `movementDetailAttachmentHtml` en vez de
  `renderMovementDetailDialog` directamente, sin cambiar su intención; tres sandboxes de
  `tests/m1-m11-movimientos.test.cjs` actualizados para cargar la nueva función auxiliar; 27
  canarios de versión de `app.js?v=` actualizados), `test:a11y`, `test:performance`, `build:site`,
  `test:privacy` y `test:smoke` sin errores. Verificación en navegador real (Playwright contra
  `dist/`, con geolocalización de Playwright mockeada a un punto de Madrid y un movimiento bancario
  sintético con descripción vaga inyectado): el diálogo de detalle ofrece «Adjuntar foto» y «Guardar
  mi ubicación»; tras adjuntar una foto de prueba, el botón cambia a «Ver foto del ticket» y
  abrirlo lanza correctamente una URL `blob:` sin errores de consola; tras guardar la ubicación,
  aparece «Ver ubicación guardada» con el enlace de OpenStreetMap apuntando exactamente a las
  coordenadas mockeadas.
- **Publicado (`T11`)**: commit, push a la rama de trabajo en curso (reiniciada desde `main` tras la
  fusión de `T10`, mismo criterio que las veces anteriores de esta sesión), PR en borrador y fusión
  a `main` en cuanto el CI se puso en verde, misma autorización vigente (`CLAUDE.md`).

## Cierre de sesión — 19 de septiembre de 2026 (209): `T6` — memo de decisión ejecutivo, `P7` — cerrada sin construir nada, `P8` — detector de gasto fantasma, `D1` — aparcada, y `D8` — reparto por titular de la reestructuración conjunta

- **Qué pedía la sesión**: con el Horizonte 3 de `BACKLOG_CONTABILIDADCASA_2_0.md` agotado (cierre de
  la sesión 208), decidir por dónde seguir. Antes de tocar código se preguntó al hogar dos cosas: si
  `I9` (gráficos de cartera con zoom/tooltip) debía construirse ya, porque el propio backlog exige una
  decisión previa de arquitectura («mantener cero dependencias externas de UI o adoptar una librería
  ligera»); y con qué tarea abrir la siguiente oleada. El hogar decidió **aplazar `I9`** (esfuerzo M,
  beneficio solo Medio, y abrir una dependencia nueva no compensa frente a otras tareas sin bloqueo) y
  empezar por **`T6`** (memo de decisión ejecutivo, esfuerzo M, beneficio Alto, sin decisión previa
  pendiente).
- **`T6` — memo de decisión ejecutivo de una página**: investigado primero qué pantallas existentes ya
  sintetizaban una recomendación (`views/executive-advisor.js`, `views/virtual-advisor.js`,
  `views/asesor-decision.js`) — ninguna construye el artefacto que pedía la tarea (documento de una
  página con recomendación, riesgos, sensibilidad y siguiente paso, generado bajo demanda para una
  decisión grande): son paneles vivos que se recalculan solos, no informes. `GOB15` resultó estar **ya
  construido** (la nota del backlog decía "reservado", desactualizada) — las tres decisiones grandes de
  la nota original (refinanciar, apalancarse, vender vivienda) tenían comparador propio de verdad:
  `D4`/`evaluateMortgageRateScenarios` (refinanciar), `LEV9`/`crossInstrumentLeverageComparison`
  (apalancarse) y `GOB15`/`gob15SimulateSale` (vender vivienda). Construido siguiendo tal cual el
  precedente de `GOB14` (mismo mecanismo de "PDF de una página": `#cierrePrintEvidence` +
  `window.print()`): `t6RefinanciarMemoContext()`, `t6ApalancarMemoContext()` y
  `t6VenderViviendaMemoContext()` (`app.js`) releen los mismos campos que ya lee su comparador y
  reformatean el resultado que ya calcula — ningún motor nuevo, ninguna cifra que el comparador no
  tuviera ya. `t6DecisionMemoContext(kind)` despacha por tipo; `t6DecisionMemoPrintHtml()` maqueta
  recomendación/riesgos/sensibilidad/siguiente paso/límites; `downloadT6DecisionMemo(kind, noteId)`
  imprime o, sin datos suficientes declarados, avisa en una nota junto al botón en vez de fallar en
  silencio. Tres botones nuevos «Generar memo de decisión (T6)», cada uno junto a su comparador
  (Inversión › Apalancamiento para D4/LEV9, Herramientas › Patrimonio para GOB15) — sin pantalla propia
  nueva: no hacía falta navegación adicional para un documento que se genera desde donde ya se decide.
  La "sensibilidad" de cada memo reutiliza datos que el comparador ya tenía pero no mostraba juntos:
  para D4, los tres escenarios de tipos (base/favorable/tensión) que ya calcula
  `evaluateMortgageRateScenarios`; para LEV9, el coste de cada instrumento disponible; para GOB15, la
  ganancia bruta/exenta/que tributa.
- **Validación**: `npm install` primero (mismo hueco de entorno que documentó la sesión 208: `esbuild`
  declarado en `package.json` pero ausente del `node_modules` de arranque del contenedor — sin relación
  con el código). Tras instalar, `npm run verify` en verde: **4411/4411 pruebas** (32 nuevas: 17 de
  `tests/t6-memo-decision-ejecutivo.test.cjs` más 15 canarios de versión de `app.js` que hubo que
  actualizar en otros tests al bumpear `app.js?v=` — mismo patrón que otras sesiones), `test:a11y`,
  `test:performance`, `build:site`, `test:privacy` y `test:smoke` sin errores. Verificación en
  navegador real (Playwright contra `dist/`): las tres decisiones se probaron con datos reales
  (hipoteca a refinanciar, comparación de apalancamiento, venta de vivienda con destino alquiler) —
  cada botón dispara `window.print()` exactamente una vez y el memo generado contiene «Memo de
  decisión» y «Recomendación»; sin datos suficientes declarados, el botón no imprime y muestra el aviso
  en su nota en vez de fallar en silencio.
- **Publicado (`T6`)**: commit, push a la rama de trabajo en curso, PR en borrador
  ([#338](https://github.com/javierbarriusom-a11y/contabilidadcasa/pull/338)) y fusión a `main` en
  cuanto el CI se puso en verde, misma autorización vigente (`CLAUDE.md`). Ya en producción.
- **`P7` — segunda tarea de la misma sesión, cerrada sin construir nada**: la nota original pedía
  "captura rápida de gasto por foto o voz, confirmación de un toque". Investigado antes de construir:
  la foto de ticket ya está completa desde `A17-3` (`app.js:26505-26672`) — cámara
  (`<input capture="environment">`), OCR con Tesseract.js vía `canonical-receipt-ocr.js` (motor de
  texto puro, sin categoría a propósito, delegada en `mappingForMovement`), revisión de 3 campos
  editables y confirmación de un toque real (`wireGestureConfirm`, pulsación mantenida 600ms en
  táctil), entrando por la misma bandeja E11b que cualquier movimiento importado. Lo único que
  faltaba de la nota era la voz — y ahí hay una decisión de producto explícita y reciente que
  revertir: `DEX2` (`app.js:852-865`) dice literalmente que la barra de captura rápida es "sin voz...
  nunca un micrófono", descartada a propósito para evitar mezclar el parseo por palabras clave con la
  complejidad de un micrófono. Puesto el hallazgo delante del hogar —foto ya cubierta, voz con
  soporte real solo en Chrome/Edge vía `SpeechRecognition`, beneficio marginal menor que `P7`
  completa— **el hogar decidió no construir voz**: `P7` se cierra con el mismo criterio que `D3`/`T18`
  (alcance ya cubierto tras verificar el código real, nada que construir). Sin cambios de código, sin
  necesidad de nueva validación de `npm run verify` (ya en verde por `T6` en la misma sesión).
- **Publicado (`P7`)**: solo documentación (`PROJECT_STATE.md`, `BACKLOG_CONTABILIDADCASA_2_0.md`),
  mismo commit/push/PR/fusión que el resto de la sesión, misma autorización vigente.
- **`P8` — tercera tarea de la misma sesión: detector de «gasto fantasma»**: la nota pedía "subida de
  precio interanual + nudge", extendiendo `A16-3` (`detectRecurringSubscriptions`,
  `canonical-forecast.js`). Verificado primero cómo agrupa hoy ese motor: por concepto + importe
  EXACTO a propósito (una subida de tarifa real crea un grupo nuevo, nunca funde el histórico
  anterior con el precio nuevo) — pero sin vincular esos grupos entre sí, así que no hay forma de ver
  "esto subió" con lo que ya existía. Nuevo `canonical-ghost-expense-detector.js`
  (`FinanceCanonicalGhostExpenseDetector.ghostExpenseCandidates()`): agrupa los resultados que ya
  devuelve A16-3 por `pattern`, y cuando dos o más precios del mismo concepto tienen meses vistos sin
  solape entre sí (el solape descarta la comparación: podrían ser dos suscripciones distintas que
  comparten nombre de comercio), compara el más antiguo con el más reciente. Sin motor de agrupación
  propio — mismo patrón que `canonical-renewal-advisor.js` (A16-4), que también extiende A16-3 sin
  tocarlo. Nudge en dos sitios: sexta fuente de `decisionInboxItems()` (`app.js`) — el propio
  comentario de `T3` ya dejaba este hueco reservado explícitamente para cuando existiera el detector
  — y nota junto a "Recurrentes y suscripciones detectadas" en Análisis
  (`analisisGhostExpenseNote`/`analisisGhostExpenseCandidates`, sobre el mismo resultado que ya
  calculaba `analisisSubscriptionsResult`, sin recalcular). Como `decisionInboxItems()` se ejecuta en
  el render eager de Hoy y no puede depender del view chunk diferido de Análisis, se añadió
  `ghostExpenseCandidatesResult()` en `app.js` con su propio mapeo de movimientos (mismo
  `movementMappingKey`/`movementDisplayName` que ya usan A-9/A16-3/M-7/M-8, sin normalización
  paralela) — mismo patrón ya usado por el resto de fuentes de la bandeja.
- **Validación (`P8`)**: `npm run verify` en verde: **4427/4427 pruebas** (16 nuevas en
  `tests/p8-gasto-fantasma.test.cjs`, más 26 canarios de versión de `app.js` actualizados al
  bumpear `app.js?v=` — mismo patrón que `T6`), `test:a11y`, `test:performance`, `build:site`,
  `test:privacy` y `test:smoke` sin errores. Verificación en navegador real (Playwright contra
  `dist/`): inyectado un caso sintético (Netflix de 12,99 € a 15,99 €/mes, sin solape de meses) sobre
  los datos de demostración — `ghostExpenseCandidatesResult()` detecta el candidato con las cifras
  correctas, `decisionInboxItems()` lo incluye como sexta entrada con su texto y destino, y la nota de
  Análisis se renderiza visible con el mismo detalle al navegar a esa pantalla.
- **Publicado (`P8`)**: commit, push, PR en borrador
  ([#340](https://github.com/javierbarriusom-a11y/contabilidadcasa/pull/340)) y fusión a `main` en
  cuanto el CI se puso en verde, misma autorización vigente. Ya en producción.
- **`D1`/`D8` — cuarta tarea de la sesión: se planteó al hogar `D1` frente a `D8` (Deuda) antes de
  construir nada**. `D1` ("retirar el iframe heredado de deuda") investigada primero: la nota cita
  `canonical-e14-parity.js` en verde como condición para retirarlo, y en efecto lleva en verde desde
  el informe de paridad del 8 de agosto (`E19_INFORME_PARIDAD_DEUDA.md`, 7/7 casos computables en
  paridad exacta entre el motor heredado y el canónico E14). Pero el 21 de agosto (sesión D-15,
  **posterior** a ese informe) el propio hogar promovió ese mismo iframe de una sección legacy
  plegada a su propia pestaña de primer nivel en Deuda (`#deuda-simulador`), describiéndolo en la UI
  como sandbox de solo lectura para explorar quitas/pagos únicos/refinanciación "sin tocar el plan
  real" — ya no es el duplicado a la espera de paridad que describía la nota original, es una
  herramienta con propósito propio que el hogar pidió explícitamente hace un mes. Retirar ahora una
  pantalla en uso activo exige consulta pase lo que pase con el CI (`CLAUDE.md`), así que se presentó
  el hallazgo al hogar en vez de decidir. **El hogar decidió aparcar `D1`** (mismo criterio que `I9`:
  ni construir ni descartar, a la espera de que confirme si el sandbox visual sigue teniéndole valor)
  y construir **`D8`** ("reparto de carga por titular en la reestructuración conjunta") en su lugar.
- **`D8` — reparto por titular de la reestructuración conjunta**: investigado primero si `GOB19`
  (plantilla de separación patrimonial, Oleada 4) ya cubría este hueco, porque ya agrupa deuda por
  titular con el mismo mapa de titularidad (`p2State().ownership`, con `P2Domain.inferOwner` como
  respaldo). No lo cubre: `GOB19` calcula dos planes de reestructuración **independientes** por
  titular con su ingreso individual tras una separación patrimonial, mientras que `D8` pedía el
  reparto de **un único plan conjunto** (`handleDi5CompareJointRestructuring`, Inversión ›
  Apalancamiento) — una caída de ingresos del hogar completo, un solo ratio, una sola lista de
  contratos priorizados por tipo más caro primero. Reutiliza sin embargo el mismo mapa de titularidad
  que ya usa `GOB19`. Nuevas `di5ProposalsByOwner()`/`di5OwnerBreakdownHtml()` en `app.js`: atribuyen
  cada propuesta ya calculada por `jointRestructuringPlan()` (`canonical-joint-restructuring.js`,
  DI5) a su dueño y suman cuota actual/nueva/alivio por titular — ningún motor nuevo, ninguna cifra
  que el plan conjunto no tuviera ya. Sin ningún contrato asignado a Javi o Tere, la nota lo dice
  explícitamente en vez de fingir un reparto; cuando coexisten contratos asignados y sin asignar, los
  sin asignar se señalan aparte para que no desaparezcan del cálculo en silencio.
- **Validación (`D1`/`D8`)**: `npm run verify` en verde: **4437/4437 pruebas** (10 nuevas en
  `tests/d8-reparto-titular-reestructuracion.test.cjs`, más 26 canarios de versión de `app.js`
  actualizados al bumpear `app.js?v=` — mismo patrón que `T6`/`P8` — y `tests/di5-reestructuracion-
  conjunta.test.cjs` ampliado para que su sandbox siga proveyendo lo que ahora necesita
  `handleDi5CompareJointRestructuring`), `test:a11y`, `test:performance`, `build:site`, `test:privacy`
  y `test:smoke` sin errores. Verificación en navegador real (Playwright contra `dist/`, con dos
  contratos sintéticos inyectados porque la demo no trae ninguno activo con cuota): tres escenarios
  probados en secuencia sobre el mismo plan conjunto — sin titularidad declarada (avisa en vez de
  fingir un reparto), un contrato asignado a Javi con el otro sin asignar (reparto de Javi más el
  aviso de lo que queda fuera), y ambos contratos repartidos entre Javi y Tere (reparto completo, sin
  aviso de pendientes) — las tres cifras coinciden con el plan conjunto ya mostrado arriba en la
  misma nota, sin errores de consola propios.
- **Publicado (`D1`/`D8`)**: `D1` es solo documentación (`PROJECT_STATE.md`,
  `BACKLOG_CONTABILIDADCASA_2_0.md`); `D8` con commit, push, PR en borrador y fusión a `main` en
  cuanto el CI se puso en verde, misma autorización vigente — mismo turno que el resto de la sesión.

## Cierre de sesión — 19 de septiembre de 2026 (208): `T14` en pausa razonada, `T3`/`D9`/`P3`/`I10`/`I12`/`T12`/`T18`/`T16` — Horizonte 3 de `BACKLOG_CONTABILIDADCASA_2_0.md` agotado

- **Qué pedía la sesión**: retomar `BACKLOG_CONTABILIDADCASA_2_0.md` para la siguiente oleada de
  desarrollo. Antes de continuar `T14` por inercia (era la única tarea "en marcha" de Horizonte 3),
  se cuestionó si quedaba trabajo real: los ocho incrementos ya construidos (sesiones 206-207)
  fueron las pantallas self-contained; lo que queda del cluster grande estaba ya declarado
  permanentemente bloqueado en el cierre de la sesión 207.
- **Auditoría de cierre de `T14`**: de las 25 pantallas en `HEAVY_RENDER_VIEWS` (app.js:191-217),
  22 ya tienen entrada propia en `VIEW_CHUNKS` (app.js:227-252). Las 3 restantes —
  `visual-detail`, `new-life-simulation`, `savings-agent` — son exactamente las que la sesión 207 ya
  documentó como bloqueadas de forma permanente (se refrescan sin guarda de pantalla activa desde
  manejadores eager de Hoy/Plan; moverlas cambiaría comportamiento, no solo ubicación). Confirmado:
  no queda ningún candidato limpio. `T14` pasa a **pausa razonada, no cerrada** — se reabre solo si
  cambia el propio patrón de refresco eager, no por inercia de sesión. Documentado en
  `BACKLOG_CONTABILIDADCASA_2_0.md` (§4 y §6).
- **`T3` — bandeja única de decisiones en Hoy**: la nota original del backlog decía "extiende
  `canonical-e11b-inbox.js`" — verificado antes de construir nada que ese motor es la bandeja de
  **importación de datos** (E11b: `buildInboxItem`/`freshness`/`reconciliationTasks`), sin relación
  ninguna con alertas de decisión. Nota corregida en el backlog. En su lugar se localizaron las
  cinco fuentes de alerta reales, hoy silenciosas hasta entrar una a una a su propia pantalla:
  `homeBudgetSummary()` (presupuesto, ya agregaba el peor caso), `renderDeb4RefinancingRadar` (radar
  de refinanciación hipotecaria, `views` dentro de "Inversión › Apalancamiento" desde el reordenado
  de `I1`), `proactiveLtvAlert`/LEV12 (LTV de margin call, misma pantalla), `assumptionExpiryAlerts`
  (`PVC15`, supuestos caducados, ya con su propio radar en Ajustes desde `P5`) y
  `evaluateHomeInsuranceGap` (brecha del seguro de hogar, "Herramientas › Seguros"). Construido
  `decisionInboxItems()`/`renderDecisionInboxCard()` (`app.js`): normaliza las cinco condiciones de
  disparo ya existentes (ningún motor nuevo) en una lista única, ordenada por severidad, con un
  botón `data-home-nav` a la pantalla donde cada una se resuelve de verdad. Nueva tarjeta de Hoy,
  `homeDecisionInboxCard` (`index.html`, junto a `homeForecastChangeCard`/P1), oculta por completo
  sin ninguna decisión pendiente — mismo patrón que el resto de tarjetas condicionales de Hoy.
  «Gasto fantasma» se deja fuera a propósito: su detector (`P8`) todavía no existe, no hay nada real
  que unificar todavía para esa fuente.
- **Sin motor nuevo, sin cambio de comportamiento en las cinco pantallas de origen**: cada fuente se
  llama exactamente con los mismos parámetros que ya usaba su propio render — la tarjeta de Hoy es
  una segunda vista de lectura sobre los mismos resultados, igual que hizo `P5` con los supuestos
  caducados.
- **Validación**: `npm install` primero (el entorno de esta sesión no traía `esbuild` instalado pese
  a estar declarado en `package.json`, lo que hacía fallar `build:site`/`test:privacy`/`test:smoke`
  — sin relación con el código, solo con el `node_modules` de arranque del contenedor). Tras
  instalar, `npm run verify` en verde: **4379/4379 pruebas**, `test:a11y`, `test:performance`,
  `build:site`, `test:privacy` y `test:smoke` sin errores. Verificación en navegador real
  (Playwright contra `dist/`): Hoy carga sin errores de consola nuevos, `homeDecisionInboxCard`
  permanece oculta con los datos de demostración (ninguna de las cinco condiciones se dispara) y,
  forzando un elemento de prueba directamente sobre `decisionInboxItems()`/`renderDecisionInboxCard()`
  en la página ya cargada, la tarjeta se muestra con el marcado y el botón de navegación esperados.
- **Publicado**: commit y push a la rama de trabajo en curso, PR en borrador y fusión a `main` en
  cuanto el CI esté en verde, misma autorización vigente (`CLAUDE.md`).

- **`D9` — segundo incremento de la sesión, misma sesión 208: barra «pagado vs. pendiente» por
  contrato**: `initialPrincipal`/`currentPrincipal` ya existían por contrato desde
  `canonical-debt-contracts.js`, pero `initialPrincipal` solo se fijaba una vez al dar de alta el
  contrato (`deudaContratosAddFormParse`) y no era corregible después. Añadido a
  `DEBT_CONTRACT_EDITABLE_FIELDS` (`app.js`) con el mismo mecanismo de `debtContractOverrides` que ya
  usan capital/TAE/cuota. Nueva columna «Progreso» en Deuda › Contratos (`deudaContratosProgressHtml`,
  `views/deuda.js`): barra visual con lo pagado/pendiente y su porcentaje, o «Sin capital inicial
  declarado» cuando `initialPrincipal` no se ha corregido — nunca un 0% fingido. **Alcance reducido a
  propósito frente a la nota original del backlog**: el «ahorro de intereses marcado sobre la barra»
  no se construye — verificado que la única cifra de ese tipo que calcula la app (AP1/`compareAmortizeVsInvest`,
  APX6/`amortizeReduceQuotaVsTerm`) es el resultado de una simulación puntual con un importe de caja
  elegido a mano en el comparador, no un dato pasivo y siempre disponible de la ficha del contrato;
  pintarla aquí sin ese importe habría sido inventar una precisión que no existe.
- **Validación**: `npm run verify` en verde: **4379/4379 pruebas** (tres canarios de
  `tests/d1-d2-deuda-tabs-contratos.test.cjs` actualizados para incluir el nuevo campo/función —
  mismo patrón que otros canarios de esta suite), `test:a11y`, `test:performance`, `build:site`,
  `test:privacy`, `test:smoke` sin errores. Verificación en navegador real: Deuda › Contratos
  visitada en primer lugar en una pestaña nueva muestra la columna «Progreso» con «Sin capital
  inicial declarado» sobre los tres contratos de ejemplo (su `initialPrincipal` coincide con
  `currentPrincipal`, correcto: la demo no declara historial); editando a mano el capital inicial de
  un contrato por encima del pendiente, la barra recalcula al vuelo el importe y el % pagado
  correctamente. Sin errores de consola nuevos (los dos/tres que aparecen —
  `cdn.jsdelivr.net/npm/@supabase/supabase-js@2` bloqueado— son del sandbox de red de este entorno,
  no del cambio).
- **Publicado**: commit y push a la rama de trabajo en curso, PR en borrador y fusión a `main` en
  cuanto el CI esté en verde, misma autorización vigente (`CLAUDE.md`).

- **`P3` — tercer incremento de la sesión, misma sesión 208: badge de fiabilidad en Previsión**:
  nuevo `renderPrevisionReliabilityBadge()` (`app.js`), junto a la cabecera de Previsión
  (`previsionHeadline`/`previsionSubheadline`, `index.html`). Ningún motor nuevo — reutiliza tal
  cual `pvc17PredictiveHealthIndex()`/PVC17, ya usado por la tarjeta de Ajustes. Solo existen dos
  niveles reales de confianza («media» a partir de 6 muestras conciliadas con previsto y real,
  «baja» por debajo — `predictionQuality`, `canonical-e16-monitoring.js`); sin muestras todavía, el
  badge se queda vacío en vez de fingir una fiabilidad que no se puede medir con el histórico
  actual.
- **Validación**: `npm run verify` en verde: **4379/4379 pruebas**, `test:a11y`, `test:performance`,
  `build:site`, `test:privacy`, `test:smoke` sin errores. Verificación en navegador real: Previsión
  en pestaña nueva no muestra badge con los datos de demostración (0 muestras conciliadas — mismo
  estado vacío que ya mostraba la tarjeta equivalente de Ajustes, consistente, no es un fallo);
  forzando `pvc17PredictiveHealthIndex()` a devolver una muestra real y volviendo a llamar al
  render, el badge aparece con el texto y el tono esperados. Sin errores de consola nuevos.
- **Publicado**: commit y push a la rama de trabajo en curso, PR en borrador y fusión a `main` en
  cuanto el CI esté en verde, misma autorización vigente (`CLAUDE.md`).

- **`I10` — cuarto incremento de la sesión, misma sesión 208: umbral propio de concentración por
  divisa/geografía**: `INV14` avisaba de "concentración alta" con un umbral fijo del 50%, no
  corregible. Nuevo campo `inv14ConcentrationThresholdPct` (Inversión › Cartera), guardado en
  `scenarioSettings` con el mismo mecanismo que otros umbrales propios ya existentes (p. ej.
  `deb4Radar`). Sin declarar, el umbral sigue siendo 50% — cero cambio de comportamiento para quien
  no toca el campo nuevo. `renderInv14CurrencyGeographyExposure()` usa
  `inv14ConcentrationThresholdPct()` en vez del `>= 50` fijo, y la nota final del bloque cita el
  umbral activo.
- **Hallazgo de paso, sin acción — wiring de campos en pantallas de carga diferida**: antes de tocar
  código se verificó una duda real: los manejadores `change` de campos dentro de `views/inversion.js`
  (como `inv16CorrMonetarioAlternativo`) se registran una sola vez dentro de `init()`
  (`qs(id)?.addEventListener(...)`, en torno a `app.js:37094`), y ese fragmento no está en el DOM la
  primera vez que `init()` corre — parecía un candidato a bug real de wiring cruzado, la misma clase
  de fallo que `T14` ya encontró tres veces. **Verificado en navegador real que no lo es**: tanto
  cargando la app directamente con el hash de Inversión como navegando a Inversión después de
  arrancar en Hoy, el campo guarda correctamente. Se añadió el campo nuevo con el mismo patrón de
  wiring que ya usa `INV16`, confiando en el comportamiento verificado en vez de reabrir esa
  investigación — sin motivo real para tratarla distinta a sus vecinas ya construidas y en uso.
- **Validación**: `npm run verify` en verde: **4381/4381 pruebas** (2 nuevas, cubren "sin umbral
  declarado avisa al 50% de siempre" y "con umbral declarado más alto no avisa por debajo de él"),
  `test:a11y`, `test:performance`, `build:site`, `test:privacy`, `test:smoke` sin errores.
  Verificación en navegador real: Inversión › Cartera en pestaña nueva muestra el campo de umbral;
  declarando 80 se guarda en `scenarioSettings` y sobrevive a un redibujado. Sin errores de consola
  nuevos.
- **Publicado**: commit y push a la rama de trabajo en curso, PR en borrador y fusión a `main` en
  cuanto el CI esté en verde, misma autorización vigente (`CLAUDE.md`).

- **`I12` — quinto incremento de la sesión, misma sesión 208: fecha de revisión de convicción por
  posición**: la convicción por posición (1-5) ya existía desde `LEV6`; el hueco real era una fecha
  de revisión. Nuevo `convictionReviewedAt` en `canonical-portfolio.js` (`normalizePosition`), vacío
  sin declarar, nunca la fecha de hoy por defecto. `i12ConvictionReviewHtml()` (`app.js`) reutiliza
  tal cual `rebalanceCalendarReviewStatus()` (INV17, mismo motor, intervalo fijo de 12 meses en vez
  del propio de rebalanceo) para avisar cuándo toca revisar; nuevo botón «Marcar revisada hoy»
  (`markIv1PositionConvictionReviewed`) junto a cada posición con convicción declarada, cableado en
  la misma delegación de clics que ya usa «Quitar» (`iv1PositionList`).
- **Alcance reducido a propósito, mismo criterio que `D9`**: la cartera (IV1) solo permite dar de
  alta o quitar una posición — nunca editarla, en ningún sitio de la app. Una posición ya creada sin
  `convictionScore` no puede declararlo después sin borrarla y volver a crearla entera (perdiendo
  aportaciones y ventas ya registradas, FIFO incluido). Construir edición general de posiciones es
  un alcance mucho mayor que esta tarea — el aviso de revisión solo aparece cuando la convicción ya
  se declaró al dar de alta la posición.
- **Validación**: `npm run verify` en verde: **4388/4388 pruebas** (7 nuevas en
  `tests/i12-conviccion-fecha-revision.test.cjs`: campo declarado en el normalizador, sin aviso sin
  convicción declarada, aviso "nunca confirmada", aviso a los 13 meses, sin aviso al mes, el botón
  actualiza solo la posición indicada, wiring del render), `test:a11y`, `test:performance`,
  `build:site`, `test:privacy`, `test:smoke` sin errores. Verificación en navegador real: registrada
  una posición con convicción 4/5 desde el formulario real de Inversión › Cartera, aparece «Convicción
  4/5, nunca confirmada» con el botón; al pulsarlo pasa a «revisada hace 0 mes(es) (fecha de hoy)».
  Sin errores de consola.
- **Publicado**: commit y push a la rama de trabajo en curso, PR en borrador y fusión a `main` en
  cuanto el CI esté en verde, misma autorización vigente (`CLAUDE.md`).

- **`T12` — sexto y último incremento de la sesión: comparador «yo vs. mi propio histórico» en
  Análisis**: nueva tarjeta (`t12HistoricalComparisonCard`) con el mejor mes, el peor mes y la media
  de los últimos 12 meses conciliados. Ningún motor nuevo — `t12HistoricalComparisonMonths()`
  ordena y recorta a 12 lo que ya devuelve `reconciledMonthlyNetHistory()` (usado también por `P6` y
  `PVC17`). Mismo lenguaje visual que la banda de colchón de Análisis ya existente
  (`analisis-cushion-col`/`-bar`/`-value`, `A-2`): reutilizadas tal cual, sin CSS nuevo, con tono por
  signo del mes (nunca por umbral fijo — un mes negativo sigue siendo negativo aunque sea el mejor
  de los doce). Oculta con menos de dos meses conciliados. Wiring: llamada desde `renderAnalisis()`
  (`views/analisis.js`), independiente de la ventana de 12/24/todo el plan que ya elige el resto de
  la pantalla — siempre los últimos 12 meses reales.
- **Validación**: `npm run verify` en verde: **4393/4393 pruebas** (5 nuevas en
  `tests/t12-comparador-historico-propio.test.cjs`). Un fallo aislado y no reproducible en
  `tests/lev14-apalancamiento-escalonado.test.cjs` durante la corrida completa (dos timestamps
  `evaluatedAt` generados con 1 ms de diferencia entre sí — comparación de dos `new Date()`
  independientes, no relacionada con ningún cambio de esta sesión); confirmado como parpadeo de
  temporización re-ejecutando ese fichero solo (12/12 en verde) y la suite completa de nuevo
  (4393/4393 en verde). `test:a11y`, `test:performance`, `build:site`, `test:privacy`, `test:smoke`
  sin errores. Verificación en navegador real: Análisis en pestaña nueva mantiene la tarjeta oculta
  con los datos de demostración (sin meses conciliados suficientes); forzando un histórico real de
  3 meses y volviendo a llamar al render, la tarjeta se muestra con el mejor/peor mes, la media y la
  banda coloreada correctamente (verificado tanto el cálculo como la visibilidad mientras los datos
  forzados están activos). Sin errores de consola.
- **Publicado**: commit y push a la rama de trabajo en curso, PR en borrador y fusión a `main` en
  cuanto el CI esté en verde, misma autorización vigente (`CLAUDE.md`).
- **`T18` — séptimo incremento, tras pedir el hogar seguir con `T16`/`T18`**: antes de tocar nada se
  recontaron los bloques reales de la zona principal de Hoy (`.home-primary-section`, `index.html`)
  en vez de fiarse del hallazgo de `T1` (sesión 197, "9 artículos estáticos + 2 rejillas dinámicas").
  Recuento actual: 3 artículos fijos (cobertura, «el mes en una línea» — misma fila que cobertura,
  decisiones abiertas) + 2 rejillas dinámicas (`homeBudgetGlance`, `homeKpis`) — exactamente los 4
  bloques que ya describe el comentario de `OPT-8` (sesión 111). Todas las tarjetas nuevas de
  sesiones posteriores a la auditoría de `T1` (`P1`/`homeForecastChangeCard`, sesión 199;
  `A16-1`/`homeHealthScoreCard`; `T3`/`homeDecisionInboxCard`, esta misma sesión...) ya se dirigieron
  a propósito a `.home-secondary-section` — la disciplina de `OPT-8` se sostuvo sin que nadie la
  reforzara expresamente entre medias. Puesto el recuento real delante del hogar, confirmó que la
  regla de 4 bloques sigue siendo el objetivo y que, cumpliéndose ya, no hay nada que construir.
  `T18` se cierra documentando esto, sin tocar código.
- **`T16` — investigación pedida por el hogar antes de decidir**: se revisaron Análisis y Plan ›
  Previsión (las dos pantallas que la nota original no había mirado todavía) antes de proponer nada.
  Resultado: no son tres dialectos en pie de igualdad. Registrar, las tablas de ingresos/gastos de
  Plan, el desplegable `planned`/`actual`, Análisis › «¿Acierta el plan?» y el comparador de dos
  meses (UX3) ya usaban «Previsto»/«Real»/«Desviación» de forma consistente entre sí. «Ingreso
  previsto» de Plan (citado en la nota original como una 4ª variante) resultó ser un concepto
  distinto — estado de asignación de presupuesto (Comprometido/Asignado/Sin asignar), no el par
  previsto/real. Plan › Previsión (la tabla Resultado/Saldo máximo/Mínimo/Colchón) tampoco participa
  del vocabulario: es proyección de saldo futuro, sin par previsto/real por partida. La única pieza
  real distinta era la tarjeta «El mes en una línea» de Hoy (H-6): «Gasto previsto»/«Gasto real a
  hoy» en vez de «Previsto»/«Real» a secas. Puesta esta comparación ya acotada delante del hogar,
  decidió recortar la tarjeta de Hoy para que coincida exactamente con el resto de la app —
  asumiendo perder el matiz «a hoy» (el mes puede seguir abierto) a cambio de esa consistencia
  literal. Cambio de dos etiquetas en `homeMonthAtAGlance()` (`app.js`), sin tocar ningún cálculo.
- **Validación (`T16`)**: `npm run verify` en verde: **4393/4393 pruebas** (2 actualizadas en
  `tests/f1-hoy-dato-ausente.test.cjs` para las nuevas etiquetas), `test:a11y`, `test:performance`,
  `build:site`, `test:privacy`, `test:smoke` sin errores. Verificación en navegador real: la tarjeta
  «El mes en una línea» de Hoy muestra «Ingresos»/«Previsto»/«Real»/«Desviación»/«Sin clasificar» con
  los datos de demostración, sin errores de consola.
- **Publicado (`T16`)**: commit y push a la rama de trabajo en curso, PR en borrador y fusión a
  `main` en cuanto el CI esté en verde, misma autorización vigente (`CLAUDE.md`).
- **Fin de sesión 208**: ocho entregas cerradas (`T3`, `D9`, `P3`, `I10`, `I12`, `T12`, `T18`, `T16`)
  más la pausa razonada de `T14`, cada una validada y publicada por separado. Con esto queda agotada
  toda la cola de Horizonte 3 de `BACKLOG_CONTABILIDADCASA_2_0.md`, con o sin decisión del hogar
  pendiente: lo que resta (`I9`, `I2`/`I3`, `P4`/`P10`, `D6`, `I6`/`I7`/`I8`) necesita, en cada caso,
  una decisión del hogar (`I9`, `I6`/`I7`/`I8`) o una condición externa que hoy no se cumple
  (`I2`/`I3`, `P4`/`P10`, `D6`) — ver §6 del propio documento para el detalle de cada bloqueo.

## Cierre de sesión — 18 de septiembre de 2026 (207): `T14`, cinco incrementos del monolito (comparador de deuda, plan deuda óptimo heredado, asesor virtual, ejecutivo) — y corrección de dos `ReferenceError` ya publicados en el primer incremento

- **Qué pedía la sesión**: continuar `T14` con el siguiente candidato ya identificado al cerrar la
  sesión 206 — el comparador de las 8 estrategias de deuda (avalancha/bola de nieve/consolidar/no
  tocar, más los 8 "modos" de un solo contrato de D-5/D-6), consumidor pesado del motor de
  escenarios compartido.
- **Auditoría de dependencias, con la misma disciplina que `views/escenarios.js`**: de los 42
  identificadores de nivel superior del bloque candidato (`app.js`, en torno a la línea 34783 antes
  de tocar nada), 33 son exclusivos del comparador/ruta y se movieron a `views/deuda.js` (que ya
  existía y ya servía las 4 pantallas de Deuda — no hizo falta registrar un `VIEW_CHUNK` nuevo, solo
  subir su versión de caché). 9 se quedan en `app.js` porque `homeDebtOutlook` (Hoy/Registrar/Plan,
  eager, se ejecuta en el primer render, antes de que cualquier fragmento lazy cargue) las necesita
  en cadena: `debtStrategySummary`, `debtStrategyResult`, `debtStrategyDecisions`,
  `debtStrategyOrderedContracts`, `debtStrategyEffectiveReserve`, `debtStrategyReserveDefault`, más
  `debtStrategyLibreDeDeudaRank` (la llama `registrarRecalcFigures`, también eager) y
  `debtAmortizationSchedule` (ya documentado en `views/deuda.js` desde `PERF-1`: lo usa Análisis, un
  fragmento lazy distinto).
- **Un error real en la primera pasada de extracción, corregido antes de publicar**: al construir
  los rangos de línea para el script de extracción, tres de esas nueve funciones que debían quedarse
  (`debtStrategyDecisions`/`Result`/`Summary`) cayeron dentro de un rango marcado como "mover" por un
  fallo de aritmética manual al ensamblar los tramos — el análisis de dependencias las había
  identificado correctamente como "se quedan", pero el corte de líneas no las excluyó. Detectado por
  `npm run verify` en verde pero la verificación en navegador real fallando con `ReferenceError:
  debtStrategySummary is not defined` al cargar Hoy. Corregido devolviendo las tres a `app.js`, justo
  después de `debtStrategyOrderedContracts`.
- **Dos bugs reales ya publicados en `main` (PR #323, primer incremento), no introducidos por esta
  sesión sino solo descubiertos por ella**: `renderScenarioDependencyNotice`/
  `missingScenarioDependencies`/`scenarioDependencyMessage`/`ESCENARIO_MOTOR_DEPENDENCIES` (T-5) y
  cinco funciones más (`escenarioMotorResultInfo`, `escenarioMotorNavigate`,
  `escenarioMotorDecisionAmountText`, `escenarioMotorDebtLabelById`, `saveEscenarioMotorSavedList`)
  habían aterrizado en `views/escenarios.js` en el primer incremento de `T14` sin verificar que
  `views/deuda.js` (y, `saveEscenarioMotorSavedList` además, `views/cierre.js`) también las llama.
  Como son dos/tres fragmentos que se cargan bajo demanda de forma independiente, visitar Deuda o
  Cierre sin haber visitado antes una pantalla de Escenario ya rompía con `ReferenceError` en
  producción desde que se fusionó el PR #323 — ningún test unitario lo detectó porque esos tests
  sustituyen `debtStrategySummary`/el motor por dobles en vez de ejecutar el árbol de llamadas real.
  Encontrado por la verificación en navegador real de este segundo incremento (visitar Deuda ·
  Comparar/Ruta en una pestaña nueva, sin haber pasado antes por Escenario), no por `npm run verify`.
  Corregido devolviendo las nueve piezas a `app.js`, junto al resto del "motor" compartido. Tras el
  hallazgo se hizo una comprobación cruzada exhaustiva de los 6 ficheros `views/*.js` (qué
  identificador de cada uno usa algún otro) para descartar más casos iguales — no apareció ninguno
  más real, solo menciones en comentarios.
- **Wiring**: no hizo falta envolver ningún manejador en función anónima (a diferencia del primer
  incremento) — el comparador/ruta no registra sus propios `addEventListener` en el `init()` eager de
  `app.js`; ya delega en `views/deuda.js` desde antes de esta tarea.
- **`VIEW_CHUNKS`**: `views/deuda.js` ya estaba registrado para las 4 pantallas de Deuda desde
  `PERF-1`/`OPT-24` — solo se subió su cadena de versión (`?v=20260917d10a1` → `?v=20260918t14b1`)
  para que el navegador no sirva una copia en caché del fragmento antiguo.
- **14 ficheros de test** ya concatenaban `views/deuda.js` en su `app`/`appSource` de `vm.Script`
  (patrón de Deuda/PERF-1 ya extendido en sesiones anteriores) — no necesitaron tocarse. Se
  corrigieron 3: `tests/di3-app-integracion.test.cjs` (un `appSource.indexOf("function
  deudaRutaRevolvingText")` que ya no encontraba nada, cambiado a `deudaSource`),
  `tests/a16-5-brecha-motivadora-deuda.test.cjs` (declaraba `app`/`deuda` como variables separadas
  sin concatenar, con `extractFunction` buscando solo en `app` — concatenadas) y
  `tests/d1-d2-deuda-tabs-contratos.test.cjs` (canario de la versión exacta de `views/deuda.js`,
  ahora comprueba el formato en vez de un literal congelado, con el mismo criterio que el canario de
  `HEAVY_RENDER_VIEWS` corregido en la sesión 206).
- **Validación**: `npm run verify` en verde (**4379/4379**, `test:a11y`/`test:performance`/
  `build:site`/`test:privacy`/`test:smoke` sin errores) tanto tras la extracción inicial (con el bug
  de dependencias todavía presente, sin detectarlo) como tras cada corrección posterior — confirma
  que estos dos bugs de integración real son exactamente la clase de fallo que la suite unitaria no
  cubre y que la verificación en navegador real existe para atrapar. Verificación en navegador real
  (Playwright) de las 4 pantallas de Deuda y de Hoy, en una pestaña sin haber visitado antes ninguna
  pantalla de Escenario: sin errores de consola, con contenido real (KPIs, cambio de pestaña de
  estrategia en Ruta, capacidad de endeudamiento en Comparar, cifras de Hoy).
- **Resultado (segundo incremento)**: `app.js` pasa de 40.284 a 40.011 líneas (-273, incluye las
  piezas que volvieron desde `views/escenarios.js`). `views/deuda.js` gana 407 líneas netas;
  `views/escenarios.js` pierde 87 (las nueve piezas que resultaron ser compartidas). El comparador
  de estrategias de deuda queda fuera de `app.js`.
- **Publicado (segundo incremento)**: PR #324, commit y push a la rama de trabajo en curso, PR en
  borrador y fusión a `main` en cuanto el CI estuvo en verde, misma autorización vigente
  (`CLAUDE.md`).
- **`T14` — tercer incremento, misma sesión: "Plan deuda óptimo" (`#debt-liquidation-plan`)**:
  siguiente candidato elegido por ser una pantalla ya marcada `HEAVY_RENDER_VIEWS` pero todavía sin
  `VIEW_CHUNK` propio — a diferencia de los dos incrementos anteriores, aquí sí hizo falta crear el
  fragmento (`views/debt-liquidation-plan.js`) y registrar la entrada nueva en `VIEW_CHUNKS`, no solo
  subir una versión de caché. Es la pantalla heredada del "plan de deuda óptimo" (nav agrupada como
  `legacy`, ya marcada internamente como `veredicto: "sustituida"` por Deuda · Comparador desde antes
  de esta sesión) — construida sobre `DEBT_LIQUIDATION_ASSUMPTIONS` (entidades hardcodeadas), no
  sobre el motor de escenarios.
  - **Auditoría de dependencias, con la lección de los dos incrementos anteriores ya aplicada desde
    el principio**: el primer intento de acotar el bloque candidato por nombre de función
    (`buildLiquidationScenario` en adelante) dejó fuera 7 funciones hermanas
    (`liquidationSettlementCost`/`GroupCost`/`MonthDate`/`ShiftMonth`/`ComparableMonth`/
    `PlanRows`/`FreeCapacity`) que vivían justo antes, pegadas al final de `renderHomeDashboard` —
    detectado releyendo el rango completo en vez de fiarse del primer nombre encontrado, antes de
    escribir una sola línea del script de extracción. De los 23 identificadores finales del bloque
    completo, 20 son exclusivos de esta pantalla (movidos) y 3 se quedan en `app.js`
    (`carSavingsTargetAmount`, `acceleratedDebtTargets`, `buildAcceleratedDebtCarScenario`) porque
    Visual Detail (`#visual-detail`, otra pantalla `HEAVY_RENDER_VIEWS` todavía sin lazy) las llama
    en caliente a través de `rowsForVisualBudget`/`renderMonthlyBudgetPanel`. Comprobación cruzada
    exhaustiva contra los 7 `views/*.js` existentes (ninguna colisión, ninguna dependencia perdida en
    ningún sentido) antes de tocar nada.
  - **`scheduleHeavyAdvisorRefresh` (app.js) referencia `renderDebtLiquidationPlan` dentro de un
    `setTimeout`** sin envolverla en función anónima — a diferencia del wiring de `PERF-1`/T14, aquí
    es seguro sin ese envoltorio porque el `setTimeout` solo se dispara 650ms después de que la
    propia `renderDebtLiquidationPlan` ya se haya ejecutado una vez (es ella quien programa ese
    refresco), así que el fragmento ya está cargado cuando el timeout dispara.
  - **Sin tests afectados**: ningún fichero de test referenciaba ninguna de las 20 funciones movidas
    — pantalla legada, sin cobertura unitaria propia. Sí rompieron 3 tests de otras tareas
    (`e14-a12-c14-bloque5-retirar-heredadas`, `v2-8-relegar-plan`, `v3-5-relegar-deuda`) que
    comprobaban por texto literal enlaces `data-home-nav` generados por el código movido —
    corregidos concatenando `views/debt-liquidation-plan.js` a su `app` de `vm.Script`, mismo patrón
    ya usado en el resto de la suite.
  - **Validación**: `npm run verify` en verde (**4379/4379**, resto de checks sin errores).
    Verificación en navegador real: `#debt-liquidation-plan` visitado en primer lugar en una
    pestaña nueva (sin pasar por ninguna otra pantalla antes) carga con contenido real y sin errores
    de consola; `#visual-detail` (que depende de las tres piezas que se quedaron en `app.js`) sigue
    funcionando exactamente igual.
  - **Resultado**: `app.js` pasa de 40.011 a 39.394 líneas (-617). `views/debt-liquidation-plan.js`
    nuevo, 636 líneas.
- **Publicado (tercer incremento)**: commit y push a la rama de trabajo en curso, PR en borrador y
  fusión a `main` en cuanto el CI esté en verde, misma autorización vigente (`CLAUDE.md`).
- **`T14` — cuarto incremento, misma sesión: "Asesor virtual" (`#virtual-advisor`)**: al proponer
  seguir con el cluster grande ya identificado al cerrar el tercer incremento (Ejecutivo/Nueva
  vida/Nueva vida definitiva/Asesor virtual/Agente de ahorro, ~2.470 líneas entrelazadas, con el
  "agente de ahorro" compartido físicamente lejos de sus propios renders), se recomendó tratarlo
  como sesión propia por su tamaño y acoplamiento — el hogar pidió seguir con `T14` igualmente. En
  vez de intentar el cluster completo de una vez, se auditó primero si alguna de sus cinco pantallas
  era self-contained: Asesor virtual (`virtualAdvisorContext` y 22 funciones hermanas,
  24238-24832) resultó ser la única sin ninguna dependencia hacia Ejecutivo/Nueva vida/Nueva vida
  definitiva ni viceversa — solo llama al "motor" del agente de ahorro (`buildSavingsAgentPlan`,
  `agentDebtRecommendations`, `agentOptimalDebtPayoffPlan`...), que se queda en `app.js` porque
  Visual Detail (`#visual-detail`, todavía sin lazy) lo llama en caliente. Movida a un fragmento
  nuevo, `views/virtual-advisor.js`, con su propia entrada en `VIEW_CHUNKS` (como el incremento
  anterior). Las otras cuatro pantallas del cluster (Ejecutivo, Nueva vida, Nueva vida definitiva,
  el render de Agente de ahorro, más los widgets E13/PVC/ESX intercalados entre ellas) siguen
  entrelazadas entre sí y quedan pendientes — sí necesitarán la auditoría más cara ya anticipada.
  - **Wiring**: las pocas referencias externas a las funciones movidas
    (`renderAdvisorDebtSandbox`/`quickVirtualAdvisorContext`/`applyAdvisorDebtOption`) ya vivían
    dentro de cuerpos de función anónima (`addEventListener`/`setTimeout`) en vez de como
    identificador directo — a diferencia de los incrementos con `T14` anteriores, esta vez no hizo
    falta envolver nada nuevo.
  - **Sin tests afectados**: ningún fichero de test referenciaba ninguna de las 23 funciones
    movidas.
  - **Validación**: `npm run verify` en verde a la primera (**4379/4379**, resto de checks sin
    errores) — a diferencia de los dos incrementos anteriores, esta vez la auditoría previa no dejó
    ningún cabo suelto que solo el navegador real detectara. Verificación en navegador real
    igualmente: `#virtual-advisor` visitado en primer lugar en una pestaña nueva carga con contenido
    real y sin errores de consola; `#savings-agent` (que comparte el motor del agente) y Hoy siguen
    funcionando igual.
  - **Resultado**: `app.js` pasa de 39.394 a 38.800 líneas (-594). `views/virtual-advisor.js`
    nuevo, 610 líneas.
- **Publicado (tercer y cuarto incremento)**: commit y push a la rama de trabajo en curso, PR en
  borrador y fusión a `main` en cuanto el CI estuvo en verde, misma autorización vigente
  (`CLAUDE.md`).
- **`T14` — quinto incremento, misma sesión: "Ejecutivo" (`#executive-advisor`)**: el hogar pidió
  seguir con `T14` una vez más tras el cuarto incremento; en vez del cluster completo, se auditó si
  alguna otra pantalla del mismo grupo (Ejecutivo/Nueva vida/Nueva vida definitiva/Agente de ahorro)
  era también self-contained, con la misma disciplina que Asesor virtual. Resultado: **Ejecutivo sí
  lo es** (9 funciones: héroe, acciones, cuentas, ruta de deuda, plan de coche, metas de compra
  grande, agenda del mes, más el propio `renderExecutiveAdvisor`) — solo llama al "motor" de la
  Central de Acciones Unificada (`executiveAdvisorContext`, `executivePrimaryDecision`,
  `unifiedActionCenterModel`, `renderUnifiedAction`...), que se queda en `app.js` porque Hoy
  (`renderHomeDashboard`, eager) lo llama en caliente para sus propias tarjetas de decisión y
  `renderHomeDecision` reutiliza `renderUnifiedAction` para las marcadas `isUnifiedAction`. Un
  primer intento de acotar el bloque por nombre de función dejó fuera dos funciones hermanas
  (`renderBigPurchaseGoals`/`addBigPurchaseGoalFromControls`) intercaladas entre `renderExecutiveCarPlan`
  y `renderExecutiveMonthAgenda` — encontradas releyendo el cuerpo real de `renderExecutiveAdvisor`
  en vez de fiarse de una lista de nombres construida por inspección visual del rango.
  - **Hallazgo que cierra la puerta a mover "Nueva vida" (simulación)**: `renderNewLifeSimulation`
    se llama sin ninguna guarda de pantalla activa desde varios manejadores de Plan/Ajustes
    (`addGob20IncomeAdjustment`/`removeGob20IncomeAdjustment`, `gob12ApplyExpenseToReal` y
    hermanas) para refrescarla si el hogar la tiene abierta al cambiar un supuesto en otro sitio —
    si viviera en un fragmento lazy, cualquiera de esas acciones (en Plan, no en Nueva vida)
    rompería con `ReferenceError` la primera vez que se ejecutara sin haber visitado antes esa
    pantalla. Se queda entera en `app.js`, con sus widgets E13/PVC/ESX, hasta que ese acoplamiento
    se resuelva (añadir la guarda sería un cambio de comportamiento, no una reubicación pura — fuera
    de alcance de `T14`). "Nueva vida definitiva" sí se auditó como separable (32 funciones, mismo
    patrón que Ejecutivo/Asesor virtual, todo su wiring ya vive dentro de callbacks de función
    anónima) pero no se construyó en esta sesión por presupuesto de tiempo — candidato ya
    verificado para la siguiente.
  - **Sin sorpresas en `npm run verify`**: **4379/4379** en verde a la primera. Un test de otra
    tarea (`tests/o4-compra-grande-generica.test.cjs`) necesitó concatenar
    `views/executive-advisor.js` a su `app` de `vm.Script` (comprobaba por texto literal que
    `renderExecutiveAdvisor` llama a `renderBigPurchaseGoals`).
  - **Validación en navegador real**: `#executive-advisor` visitado en primer lugar en pestaña
    nueva carga con contenido real y sin errores de consola; Hoy, Nueva vida (simulación y
    definitiva), Agente de ahorro y Asesor virtual siguen funcionando igual.
  - **Resultado**: `app.js` pasa de 38.800 a 38.605 líneas (-195). `views/executive-advisor.js`
    nuevo, 218 líneas.
- **Publicado (quinto incremento)**: commit y push a la rama de trabajo en curso, PR en borrador y
  fusión a `main` en cuanto el CI esté en verde, misma autorización vigente (`CLAUDE.md`).
- **`T14` — sexto incremento, misma sesión: "Nueva vida definitiva" (`#new-life-definitive`)**: el
  hogar pidió seguir con `T14` de nuevo; candidato ya auditado al cerrar el quinto incremento, así
  que se re-verificó primero el rango exacto de líneas (se había desplazado 196 líneas hacia arriba
  tras quitar el bloque de Ejecutivo) en vez de asumir el cálculo previo, y se repitió la
  comprobación cruzada completa (llamadores fuera del rango en todo `app.js`, colisiones de nombre y
  dependencias cruzadas con los seis `views/*.js` ya existentes) antes de tocar nada. Confirmadas
  las 32 funciones (23281-24018): estado por defecto/carga/guardado, lectura y volcado de controles,
  resolución de proyecto/deuda origen, `buildNewLifeDefinitiveFlow` y sus resúmenes, los ocho
  `renderLifeDef*`, `renderNewLifeDefinitive` y sus manejadores de refrescar/resetear/confirmar/
  preparar — contiguas, sin ninguna función intercalada ajena al conjunto. Todas las referencias
  externas encontradas (el `case "new-life-definitive"` de `renderActiveSection`, los
  `addEventListener` sobre `qs("new-life-definitive")` en el cableado central, y las dos llamadas
  con guarda de hash desde `handleAgentCaixaFloorChange`/`scheduleHeavyAdvisorRefresh`) ya vivían
  dentro de cuerpos de función o callbacks anónimos — ninguna referencia eager suelta, ningún
  envoltorio nuevo necesario.
  - **Sin tests afectados**: ningún fichero de test referenciaba ninguna de las 32 funciones
    movidas (el único hit, `renderNewLifeDefinitive` en `tests/t1-seis-vistas.test.cjs`, comprueba
    el `case` de `renderActiveSection`, que se queda entero en `app.js`).
  - **Sin sorpresas en `npm run verify`**: **4379/4379** en verde a la primera.
  - **Validación en navegador real**: `#new-life-definitive` visitado en primer lugar en pestaña
    nueva carga con contenido real (7 hijos, ~7.700 caracteres de texto) y sin errores de consola ni
    404; Hoy, Ejecutivo, Asesor virtual, Agente de ahorro, Nueva vida (simulación) y Plan de
    liquidación de deuda siguen funcionando igual. Interacción real sobre la pantalla movida
    (`confirm-flow`/`reset`, que disparan `setNewLifeDefinitiveFlowConfirmed`/
    `resetNewLifeDefinitive`) sin errores.
  - **Resultado**: `app.js` pasa de 38.605 a 37.867 líneas (-738). `views/new-life-definitive.js`
    nuevo, 759 líneas (incluida la cabecera documental).
- **Publicado (sexto incremento)**: commit y push a la rama de trabajo en curso, PR en borrador y
  fusión a `main` en cuanto el CI esté en verde, misma autorización vigente (`CLAUDE.md`).
- **Auditoría del resto del cluster grande (Ejecutivo/Nueva vida/Nueva vida definitiva/Asesor
  virtual/Agente de ahorro/Control de deuda)**: antes del séptimo incremento se comprobó si
  `renderSavingsAgent` (Agente de ahorro) y `renderVisualDetail` (`#visual-detail`) tenían el mismo
  patrón que bloqueó "Nueva vida" (simulación) — **los dos lo tienen**. La Central de Acciones
  Unificada de Hoy puede disparar `applyAgentRouteSimulation()` → `renderSavingsAgent()` sin ninguna
  guarda de pantalla activa (`item.command === "simulate-route"` en `executeUnifiedAction`); y la
  barra de impacto de Plan (`planMesImpactBar`, cableado global) dispara `discardVisualChanges()` →
  `renderVisualDetail()` también sin guarda. Los dos quedan permanentemente en `app.js` por el mismo
  motivo que "Nueva vida" (simulación): moverlos sería un cambio de comportamiento (añadir una
  guarda de hash), no una reubicación pura — necesitaría confirmación explícita del hogar. Con esto,
  el cluster original de cinco pantallas queda del todo triado: tres movidas, dos bloqueadas.
- **`T14` — séptimo incremento, misma sesión: "Control de deuda" (`#debt-control`)**: candidato
  nuevo, distinto del cluster anterior — un área de deuda de ~900 líneas / 35 funciones
  (9105-10005) con una forma de acoplamiento distinta: no un bloque contiguo autocontenido, sino
  entrelazado función a función con el motor de deuda compartido. Se preguntó al hogar antes de
  construirlo por el tamaño y el riesgo (comparable al primer incremento, `views/deuda.js`, que dejó
  pasar dos `ReferenceError` reales pese a la auditoría completa) — el hogar confirmó seguir.
  - **Motor que se queda en `app.js`** (parecía exclusivo de la pantalla a primera vista, pero no lo
    es): `updateDebtModeUi` se llama sin guarda en el arranque de la app, antes de cualquier
    enrutado, y arrastra con ella a `renderDebtAgreementPreview`, `updateDebtConfirmState` y
    `defaultDebtTargetId`. `resetDebtDecisionForm` también se queda: la llama `applyDebtDecision` (el
    guardarraíl real de escritura, que además usa `views/virtual-advisor.js`) y moverla habría roto
    esa llamada la primera vez que se disparara sin haber visitado antes Control de deuda.
    `debtControlStats`, `debtPriorityCandidates`, `evaluateDebtCandidate`, `debtDecisionFromValues`,
    `evaluateDebtDecisionItem`, `debtCandidateMonths` y `debtTargetDisplayName` se quedan porque ya
    los usan directamente `views/presupuesto-mes.js`, `views/virtual-advisor.js`,
    `views/new-life-definitive.js`, `views/debt-liquidation-plan.js` y `views/executive-advisor.js`
    — motor compartido real, no exclusivo de esta pantalla.
  - **Movidas (16 funciones, recortadas una a una, no un rango contiguo)**: la pintura de la
    pantalla (`renderDebtControl`, `renderDebtPayoffChart`, `populateDebtTargetSelect`) y todo el
    flujo de "revisar antes de aplicar" (`buildDebtReviewComparison`, `debtReviewOptionCard`,
    `debtDecisionComparisonAlternative`, `debtDecisionCloseIndex`, `debtComparisonStrategy`,
    `renderDebtDecisionReview`, `stageDebtDecision`, `applyDebtReviewOption`, `debtDecisionFromForm`,
    `debtDecisionDurationFromMode`, `recommendedDebtDecision`, `handleAddDebtLiquidation`,
    `saveDebtDecisionAsPending`).
  - **Un `ReferenceError` real, capturado por la verificación en navegador real** (no por
    `npm run verify`, que no lo detecta porque no ejecuta la app en un DOM real): el cableado central
    tenía tres referencias sueltas sin envolver —
    `qs("addDebtPayoff").addEventListener("click", handleAddDebtLiquidation)`,
    `qs("reviewDebtPayoff")?.addEventListener("click", stageDebtDecision)` y
    `qs("saveDebtPayoffPending")?.addEventListener("click", saveDebtDecisionAsPending)` — que
    resuelven el identificador en el momento de registrar el listener, no al disparse el evento (a
    diferencia de una función anónima que lo envuelve). Al abrir `#debt-control` en una pestaña
    nueva, la app entera caía con «`handleAddDebtLiquidation is not defined`» (pantalla de error
    genérica, sin lanzar una excepción no capturada que un test pudiera ver). Corregido envolviendo
    las tres en funciones anónimas (`() => handleAddDebtLiquidation()`, etc.), el mismo patrón ya
    usado en el resto del cableado.
  - **Hallazgo aparte, no una regresión**: el botón «Comparar decisión» (`stageDebtDecision` →
    `buildDebtReviewComparison`, que evalúa 5-6 alternativas de liquidación sobre el horizonte
    completo de previsión) puede colgar o hacer crashear la pestaña bajo Chromium headless. Se
    verificó con `git stash` que el mismo cuelgue reproduce igual en el código previo a este
    incremento (commit `fd0bdb8`, sin nada movido todavía) — es un problema preexistente, no
    introducido aquí, y queda fuera de alcance de una reubicación pura (arreglarlo sería añadirle a
    esta pantalla el mismo tratamiento `HEAVY_RENDER_VIEWS`/`scheduleHeavyAdvisorRefresh` que ya
    tienen Asesor virtual/Ejecutivo/Agente de ahorro, un cambio de comportamiento real). Se ha
    dejado una tarea sugerida para investigarlo por separado.
  - **Sin sorpresas adicionales en `npm run verify`**: **4379/4379** en verde (tras corregir el
    `ReferenceError` de arriba). Un test de otra tarea (`tests/e7-interface.test.cjs`) necesitó
    concatenar `views/debt-control.js` a su variable `app` (comprobaba por texto literal contenido
    que ahora vive en el fragmento nuevo: `paretoFrontier`, «Efectos legales y fiscales»,
    `PROFESSIONAL_WARNING`) — a diferencia de incrementos anteriores, esta vez el test afectado no
    referenciaba ningún nombre de función movida, sino literales de texto dentro del cuerpo movido;
    conviene recordar para el futuro que la comprobación de tests no puede limitarse a nombres de
    función.
  - **Validación en navegador real**: tras la corrección, `#debt-control` visitado en primer lugar
    en pestaña nueva carga con contenido real (5 hijos, ~4.400 caracteres) y sin errores de consola
    ni 404; Hoy, Deuda · comparar, Plan de liquidación de deuda, Asesor virtual, Ejecutivo, Nueva
    vida (definitiva y simulación) y Agente de ahorro siguen funcionando igual.
  - **Resultado**: `app.js` pasa de 37.868 a 37.330 líneas (-538). `views/debt-control.js` nuevo,
    580 líneas.
- **Publicado (séptimo incremento)**: commit y push a la rama de trabajo en curso, PR en borrador y
  fusión a `main` en cuanto el CI esté en verde, misma autorización vigente (`CLAUDE.md`).
- **`T14` — octavo incremento, continuación de la misma sesión (retomada el 19 de septiembre de
  2026 tras un `/compact`)**: el hogar pidió seguir con `T14`. Se auditaron los cuatro candidatos
  dejados pendientes al cerrar el séptimo incremento — ninguno pertenece al cluster grande ya
  cerrado, así que se repitió la auditoría completa desde cero para cada uno:
  - **`renderReconciliation` (`#reconciliation`) queda bloqueada de forma permanente, mismo patrón
    que "Nueva vida" (simulación)/Agente de ahorro/Visual Detail**: `closeCurrentMonthTransaction`/
    `reopenLatestMonthTransaction` la llaman sin ninguna guarda de pantalla activa tras cerrar o
    reabrir un mes — y esas dos funciones están cableadas no solo desde el botón propio de
    `#reconciliation` (`closeCurrentMonth`), sino también desde `conciliarClose`, un botón dentro de
    `#conciliar` (`views/cierre.js`, ya fragmento lazy independiente). Cerrar el mes desde Conciliar
    sin haber visitado antes Reconciliación rompería con `ReferenceError` si `renderReconciliation`
    viviera en un fragmento propio. Se queda entera en `app.js` — cuarto caso confirmado de este
    anti-patrón, no una reubicación pura sin añadir una guarda de hash (cambio de comportamiento
    fuera de alcance).
  - **`renderE14bPanel` (`#debt-roadmap`) y el cluster `renderCuadroMandos`/
    `renderCambiosPendientes`/`renderMapaCalor` no se auditaron a fondo esta vez** porque
    `renderAsesorDecision` resultó ser el candidato más pequeño y limpio de los cuatro — quedan
    para el siguiente incremento, sin descartar ni confirmar todavía si tienen el mismo problema.
  - **Construido: "Asesor · decisión abierta" (`#asesor-decision`)**, una sola función
    (`renderAsesorDecision`, 100 líneas, bloque contiguo). Las otras dos funciones del mismo bloque
    de comentarios (`asesorDecisionOpenOffers`, `asesorDecisionFundingHtml`) parecían parte del
    mismo conjunto pero se quedan en `app.js`: `asesorDecisionOpenOffers` la llama
    `renderHomeDashboard` sin guarda (construye la lista de decisiones de Hoy, V1-2) y ambas las
    reutiliza `renderDeudaRuta`, que ya vive en `views/deuda.js` desde el primer incremento (tarjeta
    «oferta en curso» de Deuda · Ruta, V3-4) — motor compartido real, detectado antes de escribir el
    script de extracción gracias al grep de identificadores contra los tests (`tests/v3-4-oferta-en-
    curso.test.cjs` documenta literalmente esa reutilización).
  - **Sin tests afectados**: ningún fichero de test referenciaba `renderAsesorDecision` en sí (solo
    a `asesorDecisionOpenOffers`/`asesorDecisionFundingHtml`, ambas sin moverse).
  - **Sin sorpresas en `npm run verify`**: **4379/4379** en verde a la primera.
  - **Validación en navegador real**: `#asesor-decision` visitado en primer lugar en pestaña nueva
    (sin pasar antes por `#debt-roadmap` ni por Deuda) carga el fragmento (`200`,
    `views/asesor-decision.js?v=20260919t14h1`), `renderAsesorDecision` queda definida en el ámbito
    global tras la navegación, sin pantalla de error genérica ni errores de consola nuevos frente a
    la carga base (los únicos avisos de consola son de red externa — proxy/CDN — idénticos con y sin
    esta navegación).
  - **Resultado**: `app.js` pasa de 37.332 a 37.233 líneas (-99). `views/asesor-decision.js` nuevo,
    120 líneas (incluida la cabecera documental).
- **Publicado (octavo incremento)**: commit y push a la rama de trabajo en curso, PR en borrador y
  fusión a `main` en cuanto el CI esté en verde, misma autorización vigente (`CLAUDE.md`).
- **Resultado acumulado de la sesión (ocho incrementos de `T14`)**: `app.js` pasa de 41.596 (cierre
  de la sesión 205) a 37.233 líneas (-10,5%). Ocho fragmentos nuevos/ampliados:
  `views/escenarios.js`, `views/deuda.js`, `views/debt-liquidation-plan.js`,
  `views/virtual-advisor.js`, `views/executive-advisor.js`, `views/new-life-definitive.js`,
  `views/debt-control.js`, `views/asesor-decision.js`.
- **Pendiente para la siguiente sesión**: el cluster grande original queda del todo cerrado — tres
  pantallas movidas (Asesor virtual, Ejecutivo, Nueva vida definitiva), dos bloqueadas de forma
  permanente (Nueva vida simulación, Agente de ahorro) salvo decisión explícita del hogar de cambiar
  su comportamiento de refresco cruzado. `visual-detail` y, desde este incremento,
  `reconciliation` (cuarto caso) siguen igual de bloqueados por el mismo patrón de refresco eager
  cruzado sin guarda de hash. "Control de deuda" y "Asesor · decisión abierta" quedan movidos con la
  misma auditoría de motor-se-queda/UI-se-mueve. Queda pendiente la investigación por separado del
  cuelgue de «Comparar decisión» (tarea sugerida ya creada, sesión 207). Para el siguiente
  incremento de `T14`, quedan sin auditar todavía `renderE14bPanel` (`#debt-roadmap`, ~38 líneas) y
  el cluster `renderCuadroMandos`/`renderCambiosPendientes`/`renderMapaCalor` (~85-110 líneas cada
  una, comparten `cuadroMandosApply`/`visualDraftCells` entre sí y con el motor de Plan/Visual
  Detail) — ninguno de los dos comprobado aún para el mismo patrón de refresco eager cruzado que ya
  bloqueó cuatro pantallas. Repetir siempre la comprobación cruzada entre todos los `views/*.js`
  existentes (ya son ocho) antes de dar por cerrado cualquier incremento futuro, y re-verificar los
  números de línea exactos con `grep -n` en cada nuevo incremento en vez de asumir cálculos previos.
  Después, el resto del Horizonte 3 (`I2`/`I3`, `D6`, `I9`, `P4`/`P10`) según el plan ya compartido
  con el hogar.

## Cierre de sesión — 18 de septiembre de 2026 (206): `T20`, badges/pills en modo oscuro — `T14`, primer incremento del monolito (`views/escenarios.js`)

- **Qué pedía la sesión**: con el Horizonte 2 completo (sesión 205), el hogar pidió plan para el
  resto del backlog — Horizonte 3 (`I9`, `I2`/`I3`, `T14`, `P4`/`P10`, `D6`) o el remanente sin
  horizonte — y arreglar el aviso, no bloqueo, dejado en la sesión 205: los ~40 pares badge/pill de
  `styles.css` con fondo pastel y texto oscuro fijos en hexadecimal que no se adaptaban al tema
  oscuro. El hogar confirmó el orden: primero el arreglo de badges/pills, después `T14`.
- **`T20` (nueva, sin ID previo en el backlog) — badges/pills en modo oscuro**: auditoría completa
  de `styles.css` encontró 36 reglas afectadas (más cerca de las ~40 estimadas que del recuento
  inicial de 46 candidatos brutos — la diferencia son botones/avisos sobre chrome deliberadamente
  oscuro en cualquier tema, como `.meeting-mode-bar button`/`.family-context-switch button.active`,
  ya excluidos a propósito en `T7`, y encabezados de tabla sticky con el mismo defecto pero fuera
  del patrón «badge/pill», dejados fuera de esta tarea). Agrupadas en 6 familias semánticas (verde,
  teal, ámbar, rojo, azul, violeta): `.audit-badge.*`, `.ledger-status`/`.ledger-invariant`,
  `.durability-status.*`, `.data-nature-badge.*`, `.status-pill.*`, `.cashflow-conclusion.*`,
  `.decision-lock-badge`, `.debt-plan-strategy-badge`, `.life-def-status.*`,
  `.state-backup-status.*`, `.visual-return-button`, `.project-item .lock-action`,
  `.debt-roadmap-view .sync-badge`, `.visual-actual-status.historical`.
  - **Mismo criterio de mínimo cambio que `T7`**: no se toca ningún valor en claro (ya verificado,
    redefinirlo sería otro rediseño). Solo se añade el equivalente en oscuro, calculado con
    `color-mix()` sobre los seis tokens semánticos `--green`/`--teal`/`--amber`/`--red`/`--blue`/
    `--violet` ya verificados por `T7`, en vez de ~40 hexadecimales nuevos elegidos a ojo: fondo al
    12% del tono sobre `--surface`, borde al 40% (donde el componente ya tenía borde propio en
    claro) y texto aclarado un 20% hacia blanco sobre el tono base — el tono base solo no llega a
    4,5:1 contra un fondo del mismo matiz, verificado con la fórmula de contraste real antes de
    escribir el CSS.
  - **Contraste verificado dos veces**: primero por cálculo (fórmula WCAG real, no a ojo) — 4,6 a
    5,5:1 en las seis familias sobre su propio fondo mezclado, 6,0-7,4:1 sobre `--bg`. Después contra
    la app renderizada de verdad: axe-core con `colorScheme: "dark"` forzado sobre 4 pantallas
    (`#home`, `#conciliar`, `#analisis`, `#deuda-comparar`) antes y después del cambio — 130
    violaciones de `color-contrast` antes, 123 después (7 menos, ninguna nueva), y ninguna de las
    36 reglas tocadas aparece en la lista de violaciones restantes. Las 123 que quedan son de
    componentes que esta tarea no tocó (`.e19-badge-*`, `.positive`/`.negative`, tablas con fondo
    `#fafbfc` fijo sin migrar a variable) — mismo hueco que `T7`/OPT-4 ya documentaron como
    pendiente de una auditoría de color propia, no de esta tarea.
  - **Validación**: `npm run verify` completo en verde (código de salida 0) tras `npm install`
    (el entorno de la sesión arrancó sin `node_modules`). `npm test` **4379/4379** pruebas (sin
    cambio — es un fix de CSS puro, ningún test nuevo). `test:a11y` **1355 IDs únicos**,
    `test:performance`, `build:site`, `test:privacy` y `test:smoke` sin errores.
  - **Backlog**: se añade `T20` a `BACKLOG_CONTABILIDADCASA_2_0.md` §4 (transversal, nacida de esta
    sesión, no del diagnóstico original) y se cierra en el mismo movimiento — 21/52 tareas cerradas
    de la cola original, más `T20`.
- **`T14` — reducir el monolito `app.js` (2,1MB, 41.596 líneas) — investigada y primer incremento
  construido en la misma sesión**: antes de tocar nada se auditó la estructura real del archivo y
  su acoplamiento con el resto del repositorio. Hallazgo que cambia el alcance de la tarea frente a
  como estaba descrita en el backlog: **no es solo un archivo grande — es la unidad de carga que
  usan literalmente cientos de tests**. `app.js` se carga como script clásico (`defer`, sin
  `type="module"`), con ~50 variables compartidas en el ámbito global (`state`, `baseData`,
  `lastSimulation`...) leídas y escritas directamente por ~1.965 funciones de nivel superior sin
  ningún namespace ni IIFE — y decenas de ficheros de test lo cargan entero con
  `vm.Script`/`vm.createContext` como un único texto para poder invocar sus funciones internas.
  - **El hogar eligió "módulos ES"** entre las dos rutas planteadas (import/export explícito vs.
    `app.js` como artefacto generado con esbuild). Antes de construir nada con esa sintaxis se
    verificó qué patrón usa YA el repositorio para modularizar `app.js`: **63 ficheros
    `canonical-*.js` existentes (~13.844 líneas)** ya sacan lógica de negocio del monolito con un
    factory UMD (IIFE que expone `globalThis.FinanceCanonicalXxx` y, por separado, `module.exports`
    para los tests) — ninguno usa `import`/`export`. Además existe un SEGUNDO patrón hermano, ya
    usado por Deuda (`OPT-24`/`PERF-1`) e Inversión (`I1`): `views/*.js`, script clásico cargado
    bajo demanda (`VIEW_CHUNKS`/`loadViewChunk`) para el código de VISTA que sí necesita el ámbito
    global compartido (`state`/`baseData`/DOM), a diferencia de los `canonical-*.js` (siempre
    puros/sin estado). Introducir `import`/`export` de verdad habría sido un TERCER sistema de
    módulos incompatible con los otros dos, sin resolver el problema real de los tests (`vm.Script`
    no soporta módulos ES sin reescribir cientos de ficheros). **El hogar confirmó seguir con el
    patrón UMD/`views/*.js` ya existente** en vez de introducir sintaxis de módulos ES nueva —
    mismo resultado funcional (código modular y encapsulado, sin seguir engordando `app.js`), cero
    deuda técnica de dos sistemas de módulos convivendo.
  - **Primer incremento construido: `views/escenarios.js`**, las 4 pantallas del hub "Escenario ·
    simular/aplicar/guardados/comparar". Antes de mover una sola línea se auditaron los 110
    identificadores de nivel superior del bloque candidato **contra el archivo completo, uno a
    uno** (no solo por patrón de nombre — un `grep` por prefijo ya había hecho pasar por alto dos
    sub-bloques enteros en un primer intento): el "motor" de escenarios
    (`escenarioMotorBaseInput`, el catálogo `ESCENARIO_MOTOR_TYPES` y sus helpers de campo,
    `runEscenarioMotor`, `escenarioMotorSummaryFor`, `escenarioMotorMonthLabel`,
    `loadEscenarioMotorSaved`...) se queda en `app.js` porque lo reutilizan tres pantallas ajenas a
    este hub (el simulador "¿y si...?" de Planificación de partidas, la segunda opinión CPX2, y el
    comparador de las 8 estrategias de deuda) — moverlo también les habría impuesto una espera de
    red que hoy no tienen, fuera del alcance de esta tarea. Las 65 funciones exclusivas del hub
    (render/formulario/manejadores de los 4 tabs) sí se movieron. Extracción hecha con un script
    Python por rangos de línea exactos (no a mano, para no arriesgar una transcripción parcial),
    verificada con `node --check` en ambos ficheros resultantes y balance de llaves en cero antes
    de tocar nada más.
  - **Wiring corregido**: la delegación de eventos de `init()` referenciaba varios manejadores
    movidos de forma directa (`addEventListener("x", handlerName)`), que rompería con
    `ReferenceError` en el arranque porque el nombre se resolvía antes de que `views/escenarios.js`
    se descargara — mismo defecto ya documentado y corregido para `views/deuda.js` (`PERF-1`).
    Envueltos en función anónima, igual que ese precedente, para que el nombre solo se resuelva
    cuando el evento dispara de verdad.
  - **14 ficheros de test** cargaban alguna de las 65 funciones movidas vía `vm.Script` sobre el
    texto de `app.js` solo — actualizados para concatenar también `views/escenarios.js` (mismo
    patrón `read("app.js") + read("views/deuda.js")` que ya usan los tests de Deuda/Inversión). Un
    canario de otra pantalla (`track3-estado-semana.test.cjs`) asumía que `"estado-semana"` era la
    última entrada de `HEAVY_RENDER_VIEWS` antes de `]);` — roto por las 4 entradas añadidas después
    de la suya; corregido para comprobar membresía, no posición, sin tocar la pantalla en sí.
  - **Validación**: `npm run verify` completo en verde (**4379/4379** pruebas, sin test nuevo — es
    una reubicación de código, no una feature). Verificación adicional en un navegador real
    (Playwright, fuera de `npm run verify`, mismo criterio que el resto de la suite): las 4
    pantallas cargan su fragmento bajo demanda sin error de consola, y un flujo completo (añadir una
    decisión "Amortizar 500€" en Simular → comparar KPIs correctos frente al plan → "Ir a aplicar"
    → ver el diff correcto) funciona de punta a punta.
  - **Resultado**: `app.js` pasa de 41.596 a 40.284 líneas (-1.312, -3,2%) — primer incremento real,
    no el objetivo completo. `views/escenarios.js` nuevo, 1.350 líneas. El resto del monolito
    (~40.000 líneas) queda para sesiones futuras dedicadas, con el mismo patrón ya validado aquí.
- **Publicado (`T20` y el primer incremento de `T14`)**: commit y push a la rama de trabajo en
  curso, PR en borrador y fusión a `main` en cuanto el CI esté en verde, misma autorización vigente
  (`CLAUDE.md`).
- **Pendiente para la siguiente sesión**: seguir extrayendo hubs de `app.js` a `views/*.js` con el
  mismo patrón y la misma disciplina de auditoría exhaustiva (candidatos obvios: el comparador de
  las 8 estrategias de deuda, ya identificado como consumidor pesado del motor de escenarios; luego
  el resto del Horizonte 3 — `I2`/`I3`, `D6`, `I9`, `P4`/`P10` — según el plan ya compartido con el
  hogar).

## Cierre de sesión — 18 de septiembre de 2026 (205): `T7` y `T8`, modo oscuro y alto contraste real — Horizonte 2 completo

- **Qué pedía la tarea**: `T7` — modo oscuro real. El hogar pidió seguir con `T7` justo después de
  `T4` en la misma sesión de trabajo. La nota original del backlog decía "cero ocurrencias de
  `prefers-color-scheme`", dando a entender que bastaría con añadir la media query sobre el sistema
  de variables ya existente.
- **Por qué acabó siendo más que añadir una media query**: el sistema de variables (`--bg`/
  `--surface`/`--ink`... en `styles.css`, `--e19-*` en `design-tokens.css`) sí cubre la mayoría de
  colores, pero verificar con axe-core contra la app real (no solo la teoría del token) destapó
  bugs reales que un cambio de variables por sí solo no arregla:
  - **~75 fondos `#fff`/`#ffffff` fijos** en componentes que ya usaban `border: 1px solid var(--line)`
    o texto vía `var(--ink)`/`var(--muted)` — en modo oscuro quedaban con texto claro sobre fondo
    blanco fijo, prácticamente invisible (`1,16:1` medido en `.unified-action`, el peor caso).
    Corregidos en bloque a `var(--surface)`, dejando aparte 3 casos genuinamente intencionados
    (una pastilla activa sobre chrome oscuro, un bloque de impresión que debe ser blanco/negro
    siempre) tras revisar cada uno.
  - **Sin `color-scheme` declarado**, los controles nativos (checkbox, radio, `<select>`) seguían
    con el estilo claro del sistema operativo aunque el resto de la página pasara a oscuro —
    verificado visualmente con la casilla "Modo sesión con asesor o pareja" de Ajustes.
  - **Los tres `<dialog>` de la app** (`.e17-dialog`, `.action-review-dialog`,
    `.startup-recovery-dialog`) no fijaban su propio fondo, dependiendo del valor por defecto del
    navegador.
  - **`.e6-coverage-card`/`.e19-registrar-recalc`** (tarjetas "héroe" deliberadamente oscuras en
    cualquier tema) tomaban prestada `--e19-accent-strong` con un fallback que en realidad era el
    valor real — al aclarar esa variable para que el texto blanco de botones pequeños pasara
    4,5:1, la tarjeta héroe casi se fundía con el fondo de la página (`1,05:1`). Separada en su
    propia variable (`--hero-strong`, sin cambiar en modo oscuro salvo un tono ligeramente más
    distinguible del canvas).
  - Un badge (`.e19-badge-warning`) y un botón (`.e19-btn-secondary`) tenían overrides de color de
    OPT-4 (sesión anterior) pensados solo para el tema claro, con hex fijo en vez de variable.
- **Paleta oscura**: calculada con fórmula de contraste WCAG real (no a ojo) para los ~30 tokens de
  color, verificada después con axe-core contra la app renderizada (no solo la fórmula aislada).
  La mayoría de texto queda ≥4,7:1 sobre su fondo; `accent`/`danger` (usados a la vez como texto y
  como fondo con texto blanco encima, ~60 y ~20 usos respectivamente) quedan en 3,4-4,4:1 como
  compromiso — mismo orden que los huecos ya aceptados en el tema claro por `OPT-4`
  (`--teal` 3,94:1, `--e19-warning` 2,77:1 en un fondo concreto), documentado en el propio CSS, no
  una auditoría completa del sistema de color (esa sigue pendiente, `OPT-4` en
  `BACKLOG_OPTIMIZACION.md`).
- **Gráficos SVG a mano** (`app.js`, ~15 ocurrencias): pasan de colores hexadecimales embebidos a
  `chartColor()`, que lee la variable CSS ya resuelta — siguen el tema automáticamente en vez de
  quedar fijos en los colores del tema claro.
- **Control de tema**: nuevo fieldset "Tema" (Automático/Claro/Oscuro) en el diálogo
  "Personalización progresiva" (`#e17PreferencesDialog`, ya existente de `E17`), aplicado al
  momento sin esperar a "Guardar preferencias". Preferencia de navegador (`localStorage
  "theme-preference"`), deliberadamente sin sufijo de hogar de datos — cambiar de fuente de datos
  no debería resetear el tema. Script inline en `<head>` (antes de las hojas de estilo) que fija
  `data-theme` en `<html>` para evitar parpadeo al forzar un tema.
- **Validación de `T7`**: `npm run verify` completo en verde (código de salida 0). `npm test`
  **4369/4369** pruebas (+21 sobre las 4348 previas a esta sesión: nuevo archivo
  `tests/t7-modo-oscuro.test.cjs`). `test:a11y` **1355 IDs únicos** (+1, por el fieldset de tema
  nuevo). `test:performance`, `build:site`, `test:privacy` y `test:smoke` sin errores. Verificación
  adicional (fuera de `npm run verify`, igual que el resto de la suite Playwright de este repo):
  `npm run test:a11y-axe` con `colorScheme: "dark"` forzado, iterando hasta que axe-core dejó de
  encontrar violaciones nuevas de `color-contrast` — el único fallo restante en esa suite
  (`heading-order` en `#home`) es preexistente en `main`, confirmado corriendo el mismo test sin
  los cambios de esta sesión.
- **`T7` publicado**: commit y push a la rama de trabajo en curso, PR
  [#321](https://github.com/javierbarriusom-a11y/contabilidadcasa/pull/321) en borrador y fusión a
  `main` en cuanto el CI esté en verde, por la autorización de publicación sin preguntar en cada
  tarea ya vigente (`CLAUDE.md`).

- **`T8` — qué pedía la tarea**: `prefers-reduced-motion` y modo de alto contraste. El hogar pidió
  seguir con `T8` justo después de `T7`, en la misma sesión.
- **Hallazgo antes de construir nada**: investigar reveló que `prefers-reduced-motion` **ya
  existía** — un override universal (`OPT-9`, `styles.css`, `@media (prefers-reduced-motion:
  reduce)` sobre `animation-duration`/`animation-iteration-count`/`scroll-behavior`/
  `transition-duration` con `!important`) construido en una sesión anterior a la del diagnóstico
  "Contabilidadcasa 2.0". El hallazgo #5 de ese diagnóstico ("0 ocurrencias") estaba desactualizado
  cuando se escribió — no era un hueco real. Corregido en `BACKLOG_CONTABILIDADCASA_2_0.md` para
  que nadie lo reabra pensando que falta construir.
- **Lo que sí faltaba de verdad**: `prefers-contrast: more`. Construido en `styles.css` y
  `design-tokens.css` reforzando `--muted`/`--line`/`--e19-muted`/`--e19-faint`/
  `--e19-border`/`--e19-border-strong` con `color-mix()` sobre `--ink`/`--e19-ink` ya resuelto (un
  único bloque cubre las cuatro combinaciones tema×preferencia — claro, oscuro, automático o
  forzado desde Personalizar — sin duplicar paleta), más un anillo de foco de teclado más grueso
  (4px en vez de 3px).
- **Hallazgo de paso, no pedido pero corregido**: el anillo de foco de teclado (`:focus-visible`
  universal) tenía un único color fijo (`#f2bf4f`) con 9,5:1 de contraste en modo oscuro pero solo
  1,5-1,7:1 en el tema claro — muy por debajo del 3:1 que exige WCAG 1.4.11 para indicadores de
  foco no textuales, prácticamente invisible navegando con teclado en el tema por defecto. Separado
  en `--focus-ring` por tema: en claro reutiliza el navy ya usado como acento (9,5:1), en oscuro
  mantiene el amarillo que ya funcionaba.
- **Validación de `T8`**: `npm run verify` completo en verde. `npm test` **4379/4379** pruebas
  (+10 sobre las 4369 tras `T7`: nuevo archivo `tests/t8-alto-contraste-y-reduced-motion.test.cjs`).
  `test:a11y` **1355 IDs únicos** (sin cambio — ningún elemento nuevo). `test:performance`,
  `build:site`, `test:privacy` y `test:smoke` sin errores. Verificado con Playwright forzando
  `prefers-contrast: more` + `prefers-reduced-motion: reduce` en ambos temas: las duraciones de
  animación/transición computadas caen a `0.01ms` como se espera, y las violaciones de
  `color-contrast` restantes son las mismas ya documentadas en `T7` (más un par de casos
  equivalentes de la misma familia, sin categoría nueva) — ninguna regresión.
- **Backlog actualizado**: `BACKLOG_CONTABILIDADCASA_2_0.md` marca `T7` y `T8` como cerradas;
  **21/52 tareas cerradas en total — Horizonte 2 completo** (las ocho apuestas estructurales:
  `T5`, `P9`, `D5`, `I1`, `D10`, `T4`, `T7`, `T8`).
- **Publicado**: commit y push a la rama de trabajo en curso, PR en borrador y fusión a `main` en
  cuanto el CI esté en verde, misma autorización vigente (`CLAUDE.md`).
- **Pendiente para la siguiente sesión**: el Horizonte 2 queda cerrado. Toca decidir con el hogar
  qué abordar del resto del backlog (Horizonte 3, o revisar el remanente de tareas sin horizonte
  asignado en `BACKLOG_CONTABILIDADCASA_2_0.md`). Aviso, no bloqueo: los ~40 pares badge/pill de
  `styles.css` con fondo pastel y texto oscuro ambos fijos (p. ej. `.audit-badge.status-pending`)
  siguen sin adaptarse al tema oscuro — se ven correctamente (ambos colores son fijos y
  consistentes entre sí, sin problema de contraste) pero como una pastilla de estilo claro flotando
  sobre una pantalla oscura; inconsistencia visual menor, fuera del alcance de esta sesión.
  Queda como aviso, no como bloqueo: los ~40 pares badge/pill de `styles.css` con fondo pastel y
  texto oscuro ambos fijos (p. ej. `.audit-badge.status-pending`) siguen sin adaptarse al tema
  oscuro — se ven correctamente (no hay problema de contraste, ambos colores son fijos y
  consistentes entre sí) pero como una pastilla de estilo claro flotando sobre una pantalla
  oscura; no es un bug de accesibilidad, es una inconsistencia visual menor fuera del alcance de
  esta sesión.

## Cierre de sesión — 18 de septiembre de 2026 (204): `T4`, directiva vs. informativa en las pantallas antiguas — sexto ciclo del Horizonte 2

- **Qué pedía la tarea**: `T4` — resolver, pantalla por pantalla, si las ~15+ superficies antiguas
  con el disclaimer "esto es información, nunca una recomendación" se quedan así o pasan a lenguaje
  directivo (política del 12/09, sesión 177, hasta ahora solo aplicada a tareas nuevas). El hogar
  eligió `T4` sobre `T7`/`T8` como siguiente tarea del Horizonte 2, y confirmó abordarla completa en
  una sola sesión tras ver la clasificación propuesta.
- **Investigación previa**: inventario exhaustivo por agente de exploración sobre código real (no
  documentación de sesiones pasadas) — **19 pantallas + 1 caso límite** (`A2-3`, que ya mezclaba
  lenguaje directivo con un disclaimer parcial legítimo en su bloque de efectos legales/fiscales, sin
  cambio necesario), más del doble de las "~15+" que estimaba la nota original del backlog.
  **`GOB15` apareció en el inventario pero se excluyó a propósito**: el hogar ya la había reservado
  para una sesión propia dedicada (sesión 171/178) — tocarla aquí habría deshecho esa decisión sin
  que nadie lo pidiera.
- **Criterio aplicado** (clasificación propuesta y confirmada antes de tocar código): una pantalla se
  queda informativa solo cuando no hay una respuesta directiva honesta que dar — verificación fiscal
  real caso a caso, estimación orientativa por diseño (rango, no cifra única), checklist sin
  alternativas que ordenar, declaración libre del usuario, o un trade-off de riesgo real sin mejor
  opción objetiva. Todo lo demás, si ya calcula y ordena datos reales, pasa a decir qué hacer con
  ellos — mismo patrón que `INV18` (sesión previa a esta serie).
- **Grupo A — informativas por motivo real, documentado en el propio código (8)**: `FC3`
  (compensación pérdidas/ganancias — depende de cruce con rendimientos del capital mobiliario que
  este motor no cubre), `A15-2` (estimador IRPF — el rango ya refleja la incertidumbre real de
  entrada), `LPX4` (coste fiscal sucesión/donación — depende de grupo de parentesco/patrimonio
  preexistente/bonificación autonómica, ninguno declarado en la app), `LPX3` y `RGX1` (checklists de
  continuidad y simulacro de pérdida de acceso — sin alternativas que ordenar), `LPX5` (campo "a
  quién se destina" — declaración libre, no una recomendación de la app), `APX3` (margin call —
  aportar garantía vs. liquidación forzosa es un trade-off de riesgo real sin mejor opción objetiva),
  y el reparto mensual estacional de `presupuesto-mes.js` (cifra de referencia, no una decisión).
- **Grupo B — retrofit directivo real (9, más `APX2` que ya lo era)**: `FC5` (dice cuánto vender
  ahora y si difiere el resto), `INV6` (marca la primera candidata como la que conviene vender
  primero), `AP3`/`LEV14` (el escenario base decide si compensa pedir la deuda, y si compensa
  escalonarla), `LEV9` (abre con el instrumento más barato ya calculado), `LEV10` (compara el tipo
  marginal con la rentabilidad base declarada en AP3 y dice si el siguiente euro sigue compensando),
  `LEV11` (ya decía qué vender y cuánto; se recortó el cierre "la decisión final sigue siendo tuya"),
  `DEB10`/`DEB5` (dice explícitamente a qué deuda cambiar la selección de AP1). `APX2` (capacidad
  Lombard) resultó ya directiva al revisarla — no necesitaba cambio. Ningún motor de cálculo nuevo:
  todas reutilizan datos ya calculados, solo cambia el texto y, en LEV9/LEV10, qué combinación de
  campos ya declarados se compara.
- **Reclasificación durante la implementación**: `FCX1` (rescate de pensiones) se propuso inicialmente
  para el Grupo B, pero al revisar el motor (`marginalTaxOnAdditionalIncome`) quedó claro que
  recomendar "capital único vs. renta" exigiría modelar la modalidad en forma de renta — un hueco
  declarado explícitamente y nunca cerrado (`I5`, sin construir). Ser directivo ahí habría fabricado
  un cálculo que no existe, así que se quedó en el Grupo A con el motivo documentado. Se avisó de
  este cambio de plan al hogar en vez de forzar un retrofit artificial.
- **Validación**: `npm run verify` completo en verde (código de salida 0) tras `npm install` (el
  entorno no tenía `node_modules`). `npm test` **4348/4348** pruebas (+4 sobre las 4344 previas:
  nuevos tests para el veredicto de `AP3`/`LEV14`/`LEV9`/`LEV10`, `INV6` y `DEB10`, más los tests
  existentes de `AP3`/`LEV1`/`AP3` actualizados para el nuevo texto directivo, sin debilitar ninguna
  aserción). `test:a11y` **1354 IDs únicos** (sin cambio — ningún elemento nuevo, solo texto).
  `test:performance`, `build:site`, `test:privacy` y `test:smoke` sin errores.
- **Backlog actualizado**: `BACKLOG_CONTABILIDADCASA_2_0.md` marca `T4` como cerrada; 19/52 tareas
  cerradas en total. `I5` (rescate de pensiones, modalidad renta) queda con una nota cruzada
  explicando por qué sigue bloqueando el retrofit directivo de `FCX1`. Del Horizonte 2 quedan `T7`
  y `T8`, sin orden confirmado todavía.
- **Publicado**: commit y push a la rama de trabajo en curso, PR en borrador y fusión a `main` en
  cuanto el CI esté en verde, por la autorización de publicación sin preguntar en cada tarea ya
  vigente (`CLAUDE.md`).
- **Pendiente para la siguiente sesión**: decidir con el hogar el orden entre `T7` (modo oscuro,
  pregunta abierta sobre si sigue siendo prioridad real dado su ratio esfuerzo/beneficio) y `T8`
  (`prefers-reduced-motion` y alto contraste, menor esfuerzo).

## Cierre de sesión — 17 de septiembre de 2026 (203): `D10`, flujo con navegación de progreso en Deuda — quinto ciclo del Horizonte 2

- **Qué pedía la tarea**: `D10` — convertir las 5 pestañas sueltas de Deuda en un único flujo con
  navegación de progreso. La nota también estaba desactualizada (como `I1` antes): tras sacar
  Apalancamiento a Inversión (sesión 202), Deuda tiene 4 pestañas, no 5 — Ruta/Comparar/Contratos/
  Simulador visual.
- **Qué había que investigar primero**: la barra de pestañas actual (`deudaScreenTabsHtml()`,
  `views/deuda.js`) era una fila de píldoras planas sin ningún indicador de progreso. La app ya
  tenía un patrón real de "flujo con pasos" — el asistente de importación de extracto en 4 pasos
  (`.datos-importar-steps`, `design-tokens.css`), con círculos numerados y estados `is-active`/
  `is-done` — así que `D10` reutiliza ese lenguaje visual en vez de inventar uno nuevo. También se
  confirmó que no hay dependencia real de orden entre pestañas: `debtContractBundle()` alimenta a
  las cuatro por igual, con o sin datos reales declarados en Contratos — "progreso" es solo la
  posición en la secuencia fija, nunca una validación de que el paso anterior tenga datos reales.
- **Solución**: `deudaScreenTabsHtml()` ahora numera cada pestaña (`<span class="e19-registrar-tab-
  step">`) y marca `is-done` las anteriores a la activa (verde, mismo tono que `.datos-importar-
  steps li.is-done`). Nueva `deudaFlowNavHtml()`/`renderDeudaFlowNav()`: enlaces reales "← Anterior"/
  "Siguiente →" al pie de la barra de pestañas de cada una de las 4 pantallas, apuntando al hash de
  la pestaña vecina en la secuencia (sin "Anterior" en Ruta, sin "Siguiente" en Simulador visual) —
  son 4 páginas reales con su propio hash, no un asistente con estado JS propio, así que la
  navegación sigue siendo por `<a href>`, no un manejador de clic exclusivo. Ningún cálculo nuevo,
  ninguna dependencia de datos inventada.
- **Validación**: `npm run verify` completo en verde (código de salida 0). `npm test` **4344/4344**
  pruebas (+6 sobre las 4338 previas: 2 pruebas nuevas del indicador de progreso, 2 de la
  navegación Anterior/Siguiente, 1 de wiring, 1 del CSS — más las 6 pruebas existentes actualizadas
  para reflejar el nuevo estado `is-done`, sin debilitar ninguna aserción). `test:a11y` **1354 IDs
  únicos** (+4, por los 4 `<nav>` nuevos de navegación de flujo). `test:performance`, `build:site`,
  `test:privacy` y `test:smoke` sin errores. Verificación visual con Playwright: en la pestaña
  intermedia (Comparar), Ruta aparece en verde con ambos botones de flujo visibles; en la última
  (Simulador visual), las tres anteriores aparecen en verde y solo hay botón "Anterior" — sin
  peticiones fallidas. `design-tokens.css` y `views/deuda.js` llevan bump de versión de caché
  (`?v=20260917d10a1`) por el CSS/JS nuevo; actualizadas las 7 pruebas existentes que fijaban la
  cadena de versión anterior, sin relajar ninguna.
- **Backlog actualizado**: `BACKLOG_CONTABILIDADCASA_2_0.md` marca `D10` como cerrada; 18/52 tareas
  cerradas en total. Del Horizonte 2 quedan `T7`, `T8`, `T4`, sin orden confirmado todavía.
- **Publicado**: commit y push a la rama de trabajo en curso, PR en borrador y fusión a `main` en
  cuanto el CI esté en verde, por la autorización de publicación sin preguntar en cada tarea ya
  vigente (`CLAUDE.md`).
- **Pendiente para la siguiente sesión**: decidir con el hogar el orden de lo que queda del
  Horizonte 2 (`T7`, `T8`, `T4`) — recordar la pregunta abierta sobre `T7` (¿sigue siendo
  prioridad real el modo oscuro, dado su ratio esfuerzo/beneficio?).

## Cierre de sesión — 17 de septiembre de 2026 (202): `I1`, hub único de Inversión — cuarto ciclo del Horizonte 2

- **Qué pedía la tarea**: `I1` — un hub único "Inversión" con sub-pestañas Cartera/Rebalanceo/
  Fiscal/Apalancamiento/Jubilación, hoy repartidas entre Ajustes y Herramientas avanzadas. Mismo
  movimiento que ya tuvo Deuda en `OPT-24`: reorganiza pantallas ya existentes, sin motor nuevo.
- **Qué había que investigar primero**: la nota de `I1` decía "repartida entre Ajustes y
  Herramientas avanzadas", pero el reparto real era distinto — `OPT-24` (sesión 161-162) ya había
  sacado **Apalancamiento** de Ajustes y lo había convertido en la 5ª pestaña del propio hub de
  **Deuda** (`#deuda-apalancamiento`). Construir `I1` tal como pedía la nota implicaba deshacer
  parte de `OPT-24`: sacar Apalancamiento de Deuda para meterlo en Inversión. Confirmado
  explícitamente con el hogar antes de tocar nada (recomendado: sí, sacarla). Un segundo hallazgo:
  la fiscalidad de `#ajustes-fiscal`/`#herramientas-fiscal` mezclaba piezas de inversión (FC3/FC4/
  FC5/INV18/pensiones) con fiscalidad general del hogar (escalas IRPF/sucesiones, borrador de la
  Renta) — solo la primera se movió, con alcance propuesto y confirmado antes de construir.
- **Solución**: nuevo `views/inversion.js` (mismo patrón `DEUDA_SCREEN_TABS`/PERF-1 que Deuda) con
  `INVERSION_SCREEN_TABS` y 5 funciones `renderInversionCartera/Rebalanceo/Fiscal/Jubilacion/
  Apalancamiento()`. Ningún motor de cálculo se movió — cada una es una capa de orquestación fina
  que llama a las mismas funciones que ya existían (IV1/IV6/INV*/FC3/FC4/GOB11/LEV*/AP*...), solo
  cambia quién las llama y dónde vive el HTML que rellenan. `renderAjustes()` se recortó (ya no
  repinta lo que se movió); `renderDeudaApalancamiento()` se retiró de `views/deuda.js`
  (`DEUDA_SCREEN_TABS` vuelve a sus 4 pestañas originales) y su cuerpo pasó, renombrado, a
  `views/inversion.js`. **Jubilación es la única pestaña nueva de verdad, no una relocación**:
  GOB11 (Herramientas → Patrimonio), A15-4 y FCX1 (Herramientas → Fiscal) no tenían ninguna
  pantalla que las juntara — ahora sí. Registrado en `VIEW_CHUNKS`/`HEAVY_RENDER_VIEWS`/dispatcher/
  `viewTitles` (app.js), en `service-worker.js` y `tools/build-public-site.mjs` (la lista a mano de
  fragmentos con carga diferida — sin esta entrada, el sitio publicado habría dado 404 la primera
  vez que alguien visitara Inversión). Nuevo enlace principal "Inversión" en el menú lateral
  (apunta a `#inversion-cartera`, igual que "Deuda" apunta a `#deuda-ruta`) más 5 entradas en
  Herramientas avanzadas y en el buscador universal (`e17-experience.js`, T2). Textos de las
  tarjetas movidas actualizados donde quedaban referencias cruzadas ya rotas o redundantes (p. ej.
  INV6/FC3-compensación ahora en la misma pestaña, ya no hace falta enlazarlas entre pantallas).
- **Validación**: `npm run verify` completo en verde (código de salida 0). `npm test` **4338/4338**
  pruebas (mismo número que antes de `I1` — es una reorganización de HTML/orquestación, no añade
  motores ni tests nuevos; sí se actualizaron ~39 tests existentes que fijaban la ubicación antigua
  de las tarjetas movidas, sin debilitar ninguna aserción — misma disciplina que el resto de la
  sesión). Un fallo intermitente y no relacionado (`tests/lev14-apalancamiento-escalonado.test.cjs`,
  comparación de timestamp con 1ms de diferencia) se confirmó como flake preexistente al re-ejecutar
  en verde de forma aislada. `test:a11y` **1350 IDs únicos** (+8 sobre los 1342 previos, por los 5
  contenedores de pestañas nuevos y sus enlaces). `test:performance`, `build:site`, `test:privacy` y
  `test:smoke` sin errores. Verificación visual adicional con Playwright (navegador real, sin
  confirmación de la skill `run` porque no hay servidor de desarrollo propio en este proyecto):
  las 5 pestañas de Inversión y las 4 de Deuda renderizan correctamente, sin peticiones fallidas
  distintas del bloqueo de red esperado hacia el CDN de Supabase en este entorno. Ese repaso visual
  encontró y corrigió un bloque de título duplicado en la pestaña Apalancamiento (arrastrado sin
  querer al copiar el cuerpo completo de la antigua `#deuda-apalancamiento`), antes de dar la tarea
  por cerrada.
- **Backlog actualizado**: `BACKLOG_CONTABILIDADCASA_2_0.md` marca `I1` como cerrada; 17/52 tareas
  cerradas en total. Del Horizonte 2 quedan `D10`, `T7`, `T8`, `T4`, sin orden confirmado todavía.
- **Publicado**: commit y push a la rama de trabajo en curso, PR en borrador y fusión a `main` en
  cuanto el CI esté en verde, por la autorización de publicación sin preguntar en cada tarea ya
  vigente (`CLAUDE.md`).
- **Pendiente para la siguiente sesión**: decidir con el hogar el orden de lo que queda del
  Horizonte 2 (`D10`, `T7`, `T8`, `T4`).

## Cierre de sesión — 17 de septiembre de 2026 (201): `D5`, cruce real de deuda y activos de cartera — tercer ciclo del Horizonte 2

- **Qué había que investigar primero**: la nota de `D5` pedía "aplicar AP1 línea a línea sobre el
  inventario de deuda, en vez de solo como simulador aparte". Antes de construir nada apareció que
  `DEB13` ("deuda cara dormida", `views/deuda.js`) **ya hacía justo eso**: cruza automáticamente
  todas las deudas activas con TAE declarado contra `compareAmortizeVsInvest` (AP1), usando el
  capital y plazo real de cada contrato frente al XIRR agregado de la cartera (`IV5`), sin esperar
  a que el hogar seleccione la deuda a mano. Lo que `DEB13` no hacía, y es lo que de verdad pide la
  nota entre paréntesis de `D5` ("qué posición podría cancelar qué deuda"): decir con qué posición
  concreta de la cartera real se pagaría cada deuda, ni contar el coste fiscal real de vender esa
  posición (la plusvalía latente tributa al liquidarla) — un coste que ni AP1 ni DEB13 restaban.
- **Solución**: nuevo `debtCancellationCandidates()` en `canonical-debt-comparator.js` — motor puro
  que, dadas las deudas activas y las posiciones reales de cartera (`normalizePositions`, IV1/IV2),
  calcula el valor neto de impuesto de cada posición (plusvalía × tipo del ahorro ya declarado,
  `dividendSpanishSavingsRatePct`) y propone, para cada deuda, la posición más barata de liquidar
  cuyo valor neto cubra el principal pendiente. Nueva capa de composición en `views/deuda.js`
  (`d5DebtAssetCrossingRows`/`Html`, `renderD5DebtAssetCrossing`): reutiliza tal cual
  `fiscalAdjustedDebtPriority` (DEB5) y `compareAmortizeVsInvest` (AP1) — el ahorro de intereses de
  amortizar se neta contra el coste fiscal de la posición elegida antes de comparar con la
  alternativa de invertir. Nueva tarjeta de solo lectura «Cruce deuda-activos: qué posición
  cancelaría qué deuda» en Deuda › Contratos, justo debajo de «Deuda cara dormida» (DEB13). Ningún
  motor de mercado ni cifra inventada: sin cartera con una posición suficiente, la deuda queda
  marcada como no financiable con una sola posición, nunca oculta ni forzada. Nunca vende ni
  amortiza nada por su cuenta (`A11-4`).
- **Validación**: `npm run verify` completo en verde (código de salida 0). `npm test` **4338/4338**
  pruebas (+10 sobre las 4328 previas, todas del nuevo `tests/d5-cruce-deuda-activos.test.cjs`). Un
  test preexistente (`tests/d1-d2-deuda-tabs-contratos.test.cjs`) rompió porque su sandbox no
  conocía la nueva llamada `renderD5DebtAssetCrossing(contracts)` dentro de `renderDeudaContratos()`
  — corregido con el mismo patrón de stub que ya usa para DEB13/GOB16, sin debilitar ninguna
  aserción de ese test. `test:a11y` **1342 IDs únicos** (+1, por el contenedor de la tarjeta nueva).
  `test:performance`, `build:site`, `test:privacy` y `test:smoke` sin errores. Nota de entorno: esta
  sesión también encontró `node_modules/` ausente — instalado (`npm install`) antes de validar,
  igual que en la sesión 200.
- **Backlog actualizado**: `BACKLOG_CONTABILIDADCASA_2_0.md` marca `D5` como cerrada, con nota del
  cierre; 16/52 tareas cerradas en total. Con `D5` cerrada, quedan del Horizonte 2: `I1`, `D10`,
  `T7`, `T8`, `T4` — sin orden confirmado todavía por el hogar.
- **Publicado**: commit y push a la rama de trabajo en curso, PR en borrador y fusión a `main` en
  cuanto el CI esté en verde, por la autorización de publicación sin preguntar en cada tarea ya
  vigente (`CLAUDE.md`).
- **Pendiente para la siguiente sesión**: decidir con el hogar el orden de lo que queda del
  Horizonte 2 (`I1`, `D10`, `T7`, `T8`, `T4`) antes de arrancar el siguiente ciclo.

## Cierre de sesión — 17 de septiembre de 2026 (200, segundo ciclo): `P9`, calendario financiero único dentro de la app

Segundo ciclo del Horizonte 2, tras fusionar `T5` (mismo día, PR #315).

- **Qué había que investigar primero**: la nota de `P9` pedía un calendario financiero uniendo
  «hipoteca, seguros, comisiones, fiscal, supuestos». Antes de construir nada apareció que
  `FinanceCanonicalE15.financialCalendar()` **ya era exactamente ese calendario unificado** — ya
  combinaba deuda/hipoteca, vencimientos de pólizas (`SP1`), fechas de objetivos, revisiones
  mensuales, la Campaña de la Renta (fiscal) y aportaciones de cartera programadas (`IV3`). Su única
  salida era un fichero `.ics` descargable (`A17-2`) más un teaser de «próximo evento» en `#widget`
  (`A17-1`) — ninguna vista para hojearlo dentro de la app. De las cinco fuentes de la nota original,
  solo dos faltaban de verdad: comisiones de mantenimiento en riesgo (`maintenanceFeeAlerts`, `TT4`)
  y supuestos caducados (`assumptionExpiryAlerts`, `PVC15`, el mismo motor del radar de `P5`).
- **Solución**: `financialCalendar()` extendido con esas dos fuentes, atadas solo al mes en curso —
  ninguna tiene una fecha futura real (son estado "ahora mismo": si la vinculación de este mes se
  cumplió, si un supuesto lleva más tiempo del umbral sin confirmar), así que proyectarlas a meses
  futuros habría fingido una certeza que la app no tiene. Construcción del input centralizada en
  `ajustesFinancialCalendarInput()` — antes el `.ics` y el widget armaban el objeto cada uno por su
  cuenta (con el riesgo real de desincronizarse; de hecho ninguno de los dos incluía las dos fuentes
  nuevas hasta ahora). Nueva tarjeta de solo lectura «Calendario financiero» en Ajustes, junto a
  «Exportar» (mismo grupo, ya es donde vive conceptualmente): próximos 12 meses con al menos un
  evento real, mismo patrón de lista que el resto de la app. El `.ics` sigue exportando el horizonte
  completo, sin cambios de comportamiento ahí. Ningún motor nuevo.
- **Validación**: `npm run verify` completo en verde (código de salida 0). `npm test` **4328/4328**
  pruebas (+10 sobre las 4318 previas). Tres tests preexistentes rompieron al centralizar la
  construcción del input en `ajustesFinancialCalendarInput()` — comprobaban directamente dentro de
  `handleAjustesExportIcs()`/`widgetSnapshot()` que se llamaba a `financialCalendar()`/
  `insurancePolicies()`; actualizados para seguir verificando lo mismo (el próximo evento sale del
  calendario financiero, el `.ics` sigue pasando el inventario de pólizas) en su nueva ubicación
  compartida, sin debilitar ninguna aserción (`tests/a17-1-widget-solo-lectura.test.cjs`,
  `tests/a17-2-calendario-ics.test.cjs`, `tests/sp1-inventario-polizas.test.cjs`). `test:a11y`
  **1341 IDs únicos** (+1, por el contenedor de la tarjeta nueva). `test:performance`, `build:site`,
  `test:privacy` y `test:smoke` sin errores.
- **Backlog actualizado**: `BACKLOG_CONTABILIDADCASA_2_0.md` marca `P9` como cerrada, con nota del
  cierre; 15/52 tareas cerradas en total. Confirmado con el hogar seguir con `D5` a continuación.
- **Publicado**: commit y push a la rama de trabajo en curso, PR en borrador y fusión a `main` en
  cuanto el CI esté en verde, por la autorización de publicación sin preguntar en cada tarea ya
  vigente (`CLAUDE.md`).
- **Pendiente para la siguiente sesión**: siguiente ciclo del Horizonte 2 es `D5` (deuda neta
  cruzando activos e inversión) — orden ya confirmado por el hogar, sin decisión pendiente.

## Cierre de sesión — 17 de septiembre de 2026 (200, primer ciclo): `T5`, cascada mensual de patrimonio neto — primera tarea del Horizonte 2

Primer ciclo del Horizonte 2 de `BACKLOG_CONTABILIDADCASA_2_0.md`, arrancado tras confirmar con el
hogar el orden `T5` → `P9` → `D5`.

- **Qué había que investigar primero**: `A14-2` (patrimonio neto de hoy, activos menos deuda) ya
  estaba construido, con un comentario explícito en `app.js` diciendo «sin histórico ni banda de
  confianza todavía — sesión aparte». Antes de construir nada había que confirmar qué datos
  históricos reales existen: ni los activos declarados (`A14-1`) ni la deuda (`canonical-debt-
  contracts.js`) guardan una serie de valoraciones o de saldo mes a mes — solo el valor/saldo
  *actual*. Ese hueco de datos real es exactamente `I2` (serie histórica de valoraciones por
  posición), deliberadamente fuera de esta tarea. Lo único con dato mensual real es el flujo de
  caja conciliado con el banco (`reconciledMonthlyNetHistory`, ya usado por `A11-3`/`PVX1`/`P6`).
- **Decisión de fondo, confirmada con el hogar antes de construir**: reconstruir el patrimonio neto
  hacia atrás restando ese flujo de caja real mes a mes desde el único punto exacto (hoy), y
  declarar como «no explicado por caja» la parte que ese flujo no captura (revalorización de
  mercado/vivienda, reparto capital/interés de cada cuota de deuda) en vez de simular una
  precisión que la app no mide.
- **Solución**: nuevo `netWorthWaterfall()` en `canonical-assets.js` — motor puro que, dado el
  patrimonio de hoy y el histórico de flujo neto conciliado, reconstruye cada mes anterior
  (`endNetWorth − flujo = startNetWorth`, encadenado) con una banda de incertidumbre que crece con
  la distancia (2%/mes, tope 25% del valor reconstruido) y es cero en el punto de hoy. Nuevo
  gráfico de cascada mensual (SVG hecho a mano, mismo patrón que el resto de gráficos de la app) en
  la tarjeta de Ajustes de `A14-2`, oculto sin meses conciliados — nunca deja el gráfico vacío ni
  inventa historial. `renderA14AssetBreakdown()` refactorizado: el cálculo de patrimonio neto
  (antes en línea) se extrajo a `a14NetWorthToday()` para que la cascada lo reutilice sin
  duplicarlo — refactor verificado sin cambiar ningún resultado existente.
- **Validación**: `npm run verify` completo en verde (código de salida 0). `npm test` **4318/4318**
  pruebas (+13 sobre las 4305 previas). Dos tests preexistentes de `A14-2`/`A14-4`
  (`tests/a14-2-patrimonio-neto.test.cjs`, `tests/a14-4-desglose-tipo-riesgo.test.cjs`) rompieron al
  extraer `a14NetWorthToday()` — comprobaban el cálculo directamente dentro de
  `renderA14AssetBreakdown()`; actualizados para seguir verificando lo mismo (delegación en
  `FinanceCanonicalAssets`, resta de deuda, estado sin activos) en su nueva ubicación, sin debilitar
  ninguna aserción. `test:a11y` **1340 IDs únicos** (+2: el `svg` de la cascada y su leyenda).
  `test:performance`, `build:site`, `test:privacy` y `test:smoke` sin errores. Nota de entorno: esta
  sesión encontró `node_modules/` ausente (contenedor sin `npm install` previo) — instalado antes de
  validar; los 6 fallos de `build:site` que aparecían sin él (`Cannot find package 'esbuild'`) eran
  un problema de entorno, no del código — confirmado reproduciendo el mismo fallo con los cambios de
  esta sesión revertidos (`git stash`).
- **Backlog actualizado**: `BACKLOG_CONTABILIDADCASA_2_0.md` marca `T5` como cerrada, con nota del
  cierre; 14/52 tareas cerradas en total. Confirmado con el hogar el orden del resto del Horizonte 2:
  `T5` → `P9` → `D5`.
- **Publicado**: commit y push a la rama de trabajo en curso, PR en borrador y fusión a `main` en
  cuanto el CI esté en verde, por la autorización de publicación sin preguntar en cada tarea ya
  vigente (`CLAUDE.md`).
- **Pendiente para la siguiente sesión**: siguiente ciclo del Horizonte 2 es `P9` (calendario
  financiero único), después `D5` (deuda neta cruzando activos e inversión) — orden ya confirmado
  por el hogar, sin decisión pendiente.

## Cierre de sesión — 17 de septiembre de 2026 (199, noveno ciclo): `P6`, puntuación de acierto histórico permanente en Hoy — Horizonte 1 completo salvo `T16`/`T18`

Noveno ciclo sobre `BACKLOG_CONTABILIDADCASA_2_0.md`, tras fusionar `P5` (mismo día, PR #313). Con
`P6` se agota el Horizonte 1 original: de las 9 tareas que lo componían (`T2`, `D4`, `I11`, `P1`,
`P5`, `P6` y las tres nacidas de `T1` — `T15`/`T17`/`T19`), las 9 están cerradas. Solo quedan `T16`
y `T18`, bloqueadas por una decisión del hogar que no depende de código.

- **Qué había que investigar primero**: la nota citaba `pvx1BacktestHtml` (`PVX1`) — el informe de
  backtesting mes a mes que ya vive en Análisis, comparando lo previsto contra lo real conciliado —
  y pedía "convertirlo en KPI fijo" en Hoy. El informe completo (una fila por mes, más una línea de
  "desviación media histórica" en euros) no cabe como KPI de una tarjeta ni tiene sentido duplicarlo
  ahí: la tarea real era destilar una única cifra permanente, no repetir la tabla. La app ya tenía el
  ingrediente para esa cifra: `deviationSeverity()` (`PV2`) clasifica la desviación media como
  ratio sobre lo previsto medio (bajo/medio/alto, con los mismos umbrales que ya usa el resto de la
  app), pero solo como etiqueta cualitativa, nunca como número.
- **Solución**: nuevo `historicalAccuracyScore(deviation)` en `canonical-forecast.js`, justo al lado
  de `deviationSeverity()` — invierte el mismo ratio a un porcentaje de acierto (100% sin desviación,
  0% cuando la desviación iguala o supera lo previsto, recortado para no bajar de 0%). Para no
  duplicar la fórmula del ratio en dos sitios, se extrajo un `deviationRatio()` privado del que ahora
  beben tanto `deviationSeverity()` como la función nueva — refactor verificado sin cambiar ningún
  resultado existente (misma cobertura de tests de `PV2` en verde, caso por caso, antes y después).
  En Hoy, `renderHomeDashboard()` calcula `learnFromHistory(reconciledMonthlyNetHistory())` (el mismo
  aprendizaje que ya alimenta `renderPvx1Backtest()`) y añade un KPI más a la rejilla `homeKpis` ya
  existente — sin bloque nuevo en la zona principal, dentro del límite de `OPT-8` — con enlace
  «Ver backtesting» a Análisis, donde vive el informe completo intacto.
- **Validación**: `npm run verify` completo en verde (código de salida 0). `npm test` **4305/4305**
  pruebas (+8 sobre las 4297 previas de esta sesión). `test:a11y` **1338 IDs únicos** (sin cambio —
  el KPI nuevo vive dentro de una rejilla ya existente, sin `id` propio). `test:performance`,
  `build:site`, `test:privacy` y `test:smoke` sin errores.
- **Backlog actualizado**: `BACKLOG_CONTABILIDADCASA_2_0.md` marca `P6` como cerrada, con nota del
  cierre; §6 (Horizonte 1) queda completo salvo `T16`/`T18`. 13/52 tareas cerradas en total.
  `BACKLOG_INDICE.md` refleja el mismo recuento.
- **Publicado**: commit y push a la rama de trabajo en curso, PR en borrador y fusión a `main` en
  cuanto el CI esté en verde, por la autorización de publicación sin preguntar en cada tarea ya
  vigente (`CLAUDE.md`).
- **Pendiente para la siguiente sesión**: `T16` y `T18` siguen esperando que el hogar decida — son
  lo único que queda del Horizonte 1 original. Sin esa decisión, la siguiente tarea disponible está
  en el Horizonte 2 (`T5`, `I1`, `D10`, `T7`, `T8`, `T4`, `P9`, `D5`).

## Cierre de sesión — 17 de septiembre de 2026 (199, octavo ciclo): `P5`, radar único de supuestos caducados con «revisar ahora»

Octavo ciclo sobre `BACKLOG_CONTABILIDADCASA_2_0.md`, tras fusionar `P1` (mismo día, PR #312).
Última tarea del Horizonte 1 original sin bloqueo de decisión del hogar; con esta, solo queda `P6`.

- **Qué había que investigar primero**: `assumptionExpiryAlerts()` (`PVC15`, `canonical-forecast.js`)
  ya calculaba qué supuestos llevan más tiempo sin confirmar del esperado para su tipo. Lo único que
  la app hacía con ese resultado era marcar en línea, dentro de la lista completa de los 13 supuestos
  de Ajustes (`renderAjustesAssumptionRegistry`), los que estaban caducados — había que leer la lista
  entera para encontrarlos, exactamente el problema que describe la nota de `P5`. También había que
  averiguar dónde se edita cada uno de los 10 supuestos con umbral de caducidad para que «revisar
  ahora» llevara a un sitio real: los cinco fiscales (`fiscalJointTaxation`, `fiscalWithholdingRate`,
  `fiscalDeductibleContributions`, `fiscalDeductibleRent`, `fiscalLargeFamily`) se editan en la misma
  tarjeta de Ajustes; los cinco generales del forecast (`incomeFactor`, `annualIncomeGrowth`,
  `expenseFactor`, `annualInflation`, `plannedMonthlySaving`) se editan en el Laboratorio de
  escenarios (`#simulator`) — dos de ellos (`incomeFactor`/`expenseFactor`) sin ningún campo propio
  hoy, solo multiplicadores internos, así que su «revisar ahora» lleva a la pantalla donde viven los
  otros tres, no a un campo que no existe.
- **Solución**: nueva tarjeta `ajustesAssumptionExpiryRadar` en Ajustes, justo antes de la lista
  completa (que sigue igual, con su marca en línea intacta — no se retira nada en uso). Oculta sin
  ningún supuesto caducado. Cada entrada lleva un botón «Revisar ahora»: los cinco fiscales usan
  `data-scroll-focus` (mecanismo genérico ya existente de OPT-7 — foco directo sin navegar, en la
  misma pantalla); los cinco generales usan `data-home-nav="simulator"` (mismo patrón que el resto de
  la app para "la pantalla donde sí se actúa" en vez de un deep-link a un campo en una pantalla que
  no está visible). Ningún motor nuevo — 0 líneas en `canonical-*.js`.
- **Guardarraíl añadido**: test que compara `Object.keys()` del nuevo mapa `app.js` con
  `Object.keys(Forecast.ASSUMPTION_EXPIRY_MONTHS_DEFAULT)` — falla si algún supuesto con umbral de
  caducidad se queda sin destino de revisión, o si se añade un destino para un supuesto sin umbral.
- **Validación**: `npm run verify` completo en verde (código de salida 0). `npm test` **4297/4297**
  pruebas (+9 sobre las 4288 previas de esta sesión). Dos tests preexistentes
  (`tests/a15-1-registro-supuestos-fiscales.test.cjs`) rompieron al añadir la llamada nueva dentro de
  `renderAjustesAssumptionRegistry()` — sandboxaban esa función sin la nueva `renderAjustesAssumptionExpiryRadar()`
  de la que ahora depende; arreglado añadiéndola a los tres sandboxes afectados, sin tocar ninguna
  aserción existente. `test:a11y` **1338 IDs únicos** (+7 por los `id` nuevos: la tarjeta, la lista y
  los cinco contenedores de campo fiscal). `test:performance`, `build:site`, `test:privacy` y
  `test:smoke` sin errores.
- **Backlog actualizado**: `BACKLOG_CONTABILIDADCASA_2_0.md` marca `P5` como cerrada, con nota del
  cierre; §6 (Horizonte 1) ya solo lista `P6` entre las pendientes. 12/52 tareas cerradas en total.
  `BACKLOG_INDICE.md` refleja el mismo recuento.
- **Publicado**: commit y push a la rama de trabajo en curso, PR en borrador y fusión a `main` en
  cuanto el CI esté en verde, por la autorización de publicación sin preguntar en cada tarea ya
  vigente (`CLAUDE.md`).
- **Pendiente para la siguiente sesión**: `T16` y `T18` siguen esperando que el hogar decida. Del
  Horizonte 1 original solo queda `P6`.

## Cierre de sesión — 17 de septiembre de 2026 (199, séptimo ciclo): `P1`, «qué cambió desde la última vez» llega a Hoy

Séptimo ciclo sobre `BACKLOG_CONTABILIDADCASA_2_0.md`, tras fusionar `D4`/`I11` (mismo día, PR #311).
Última tarea del Horizonte 1 original de esfuerzo bajo/beneficio alto que quedaba sin el bloqueo de
decisión del hogar (`T16`/`T18`).

- **Qué había que investigar primero**: la nota citaba dos motores concretos —
  `causalTreeForMonth`/`previsionChangeOneLiner` (`PVX5`) y `diffAssumptionSnapshots` (`PVC6`) — como
  «hoy solo visibles en Ajustes». Se confirmó: ambos viven cableados en la pantalla de Ajustes
  (`renderPvx5CausalTree()`, con su selector manual de mes, y `handlePvc6SnapshotCompare()`, con su
  selector manual de snapshot de cierre firmado) y en ningún otro sitio. Nada de matemática que
  construir — la tarea real era traer esa lectura a Hoy sin el selector manual, con un único punto de
  comparación automático: el mes conciliado más reciente para el árbol causal, el cierre firmado más
  reciente con snapshot guardado para el diff de supuestos.
- **Dónde encaja en Hoy**: `OPT-8` (ya cerrada) fijó un máximo de 4 bloques en la zona principal de
  Hoy — no se ha tocado esa zona. La tarjeta nueva (`homeForecastChangeCard`) se añade a
  `.home-secondary-section`, junto a `homeHealthScoreCard` (mismo patrón: oculta con `hidden` hasta
  tener datos calculables, sin selector de usuario, solo lectura).
- **Solución**: nueva función `renderHomeForecastChangePanel()` en `app.js`, llamada desde
  `renderHomeDashboard()` junto al resto de tarjetas de detalle. Calcula el mes conciliado más
  reciente de `reconciledMonthlyNetHistory()` (ordenado por `monthKey` descendente, no el primero del
  array) para `causalTreeForMonth()`/`previsionChangeOneLiner()`; toma `loadPvc6ForecastSnapshots()[0]`
  (ya devuelto con el más nuevo primero) como snapshot único para `diffAssumptionSnapshots()`, y
  reutiliza `pvc18ChangeCauses()`/`pvc6DiffResultHtml()` tal cual para el HTML del diff — las mismas
  funciones que ya pintaban esto en Ajustes, sin duplicar su lógica de formato. Ningún motor nuevo:
  0 líneas en los archivos `canonical-*.js`.
- **Validación**: `npm run verify` completo en verde (código de salida 0). `npm test` **4288/4288**
  pruebas (+7 sobre las 4281 previas de esta sesión: ocultar sin previsión/sin motor, frase de aviso
  sin meses conciliados, elegir el mes más reciente del historial en vez del primero, aviso sin
  cierre firmado con snapshot, comparación reutilizando `pvc18ChangeCauses`/`pvc6DiffResultHtml` con
  un snapshot real, cableado en `renderHomeDashboard`, y la tarjeta presente en `#home` oculta por
  defecto). `test:a11y` **1331 IDs únicos** (+3 por los tres `id` nuevos). `test:performance`,
  `build:site`, `test:privacy` y `test:smoke` sin errores.
- **Backlog actualizado**: `BACKLOG_CONTABILIDADCASA_2_0.md` marca `P1` como cerrada, con nota del
  cierre; §6 (Horizonte 1) ya solo lista `P5`/`P6` entre las pendientes. 11/52 tareas cerradas en
  total. `BACKLOG_INDICE.md` refleja el mismo recuento.
- **Publicado**: commit y push a la rama de trabajo en curso, PR en borrador y fusión a `main` en
  cuanto el CI esté en verde, por la autorización de publicación sin preguntar en cada tarea ya
  vigente (`CLAUDE.md`).
- **Pendiente para la siguiente sesión**: `T16` y `T18` siguen esperando que el hogar decida. Del
  resto del Horizonte 1 original quedan `P5`, `P6`.

## Cierre de sesión — 17 de septiembre de 2026 (199, sexto ciclo): `I11`, el coste de diferir la plusvalía aislado del crecimiento perdido

Sexto ciclo sobre `BACKLOG_CONTABILIDADCASA_2_0.md`, sobre la misma rama de `D4` (PR #311, todavía
sin fusionar en el momento de este ciclo — mismo patrón que `T15`/`T17`/`T19` en el PR #309: varias
tareas pequeñas del mismo Horizonte 1 encadenadas en un solo PR antes de fusionar).

- **Qué hacía falta**: `sellVsBorrowComparison()` (`INV10`, `canonical-leverage-simulator.js`) ya
  calculaba `sellTaxCost` (el impuesto que se evita al no vender) y `borrowTotalCost` (el interés de
  pedir prestado en su lugar), pero solo los exponía dentro de un veredicto único (`cheaper`/
  `difference`) que además mezclaba `sellForegoneGrowth` — el crecimiento que se pierde si de verdad
  se retira el capital de la cartera. Son dos preguntas distintas: cuándo pagar el impuesto (diferirlo
  pidiendo prestado, o pagarlo ya vendiendo) y si conviene retirar capital de la cartera en absoluto.
  El backlog las tenía fundidas en una sola cifra.
- **Solución**: nuevo campo `deferredGainCost = borrowTotalCost − sellTaxCost` en el propio motor
  canónico (no en `app.js` — mismo criterio de mantener el cálculo en el motor, no en la vista), solo
  cuando pedir prestado es factible. Positivo: diferir el impuesto cuesta más en intereses de lo que
  ahorra hoy. Negativo: diferir sale a cuenta. `handleInv10Compare()` añade una línea propia en la
  tarjeta de INV10 («Coste de diferir la plusvalía: ...»), separada del veredicto general que sigue
  intacto.
- **Validación**: `npm run verify` completo en verde (código de salida 0). `npm test` **4281/4281**
  pruebas (+4 sobre las 4277 anteriores de esta sesión: `deferredGainCost` con diferir a cuenta,
  diferir costoso, sin capacidad Lombard suficiente no se calcula, y la línea nueva cableada en la
  tarjeta sin tocar el veredicto general).  `test:a11y` **1328 IDs únicos** (sin cambio).
  `test:performance`, `build:site`, `test:privacy` y `test:smoke` sin errores.
- **Backlog actualizado**: `BACKLOG_CONTABILIDADCASA_2_0.md` marca `I11` como cerrada, con nota del
  cierre; §6 (Horizonte 1) ya no la lista entre las pendientes. 10/52 tareas cerradas en total.
  `BACKLOG_INDICE.md` refleja el mismo recuento.
- **Publicado**: commit y push a la rama de trabajo en curso (mismo PR #311 de `D4`, todavía en
  borrador); se fusionará junto con `D4` en cuanto el CI esté en verde, por la autorización de
  publicación sin preguntar en cada tarea ya vigente (`CLAUDE.md`).
- **Pendiente para la siguiente sesión**: `T16` y `T18` siguen esperando que el hogar decida. Del
  resto del Horizonte 1 original quedan `P1`, `P5`, `P6`.

## Cierre de sesión — 17 de septiembre de 2026 (199, quinto ciclo): `D4`, el radar de refinanciación gana un guion de renegociación

Quinto ciclo sobre `BACKLOG_CONTABILIDADCASA_2_0.md`, tras fusionar `T2` (mismo día, PR #310).
Siguiente tarea del Horizonte 1 original, de esfuerzo bajo y beneficio alto: convertir en texto
accionable un cálculo que hoy solo se ve como un número.

- **Qué había que investigar primero**: la nota original hablaba de reutilizar «`DEB4` (radar de
  refinanciación) y el comparador de ofertas», sin decir qué pantalla es ese segundo comparador. Se
  investigaron dos candidatas: la tarjeta «Oferta en curso» de Deuda › Ruta (modelo `E14`, con
  contraparte/importe/cuota reales de una negociación concreta) y el propio motor de `DEB4`
  (`canonical-mortgage-rate-scenarios.js`, `evaluateMortgageRateScenarios`, cuyo parámetro se llama
  literalmente `fixedRateOffer` frente al tipo variable). La segunda es la lectura correcta: `DEB4`
  ya compara «una oferta» de tipo fijo contra el variable actual en tres escenarios — es su propio
  comparador, no una pantalla distinta. Acoplar el guion a la tarjeta de Deuda › Ruta habría exigido
  cruzar dos subsistemas independientes por una tarea de esfuerzo declarado «S», y esa tarjeta ya
  tiene su propio flujo de aplicar/editar sin necesidad de un guion de llamada.
- **Solución**: nueva función `deb4RenegotiationScriptText(saved, scenarios, breakEven)` en
  `app.js` — sin cálculo nuevo, solo redacta en prosa los mismos números que ya calculaban
  `evaluateMortgageRateScenarios`/`refinancingBreakEvenMonths` (capital, tipo variable actual, oferta
  fija, cuotas antes/después, coste de cambiar, meses para recuperar la diferencia). Cuando el radar
  ya avisa de una ventana viable, `renderDeb4RefinancingRadar()` añade un `<details>` plegable
  («Guion para llamar al banco») con ese texto, listo para leer o pegar en una llamada o email — sin
  nombre de entidad, porque `DEB4` no declara esa entidad hoy y no era esta tarea la que debía
  inventar un campo nuevo solo para conseguirlo.
- **Validación**: `npm run verify` completo en verde (código de salida 0). `npm test` **4277/4277**
  pruebas (+3 sobre las 4274 previas de esta sesión: el texto del guion con números reales
  verificados uno a uno, que no rompe sin escenario base calculable, y que el radar lo muestra
  junto al aviso). `test:a11y` **1328 IDs únicos** (sin cambio). `test:performance`, `build:site`,
  `test:privacy` y `test:smoke` sin errores.
- **Backlog actualizado**: `BACKLOG_CONTABILIDADCASA_2_0.md` marca `D4` como cerrada, con nota del
  cierre; §6 (Horizonte 1) ya no la lista entre las pendientes. 9/52 tareas cerradas en total.
  `BACKLOG_INDICE.md` refleja el mismo recuento.
- **Publicado**: commit y push a la rama de trabajo en curso, PR en borrador y fusión a `main` en
  cuanto el CI esté en verde, por la autorización de publicación sin preguntar en cada tarea ya
  vigente (`CLAUDE.md`).
- **Pendiente para la siguiente sesión**: `T16` y `T18` siguen esperando que el hogar decida. Del
  resto del Horizonte 1 original quedan `I11`, `P1`, `P5`, `P6`.

## Cierre de sesión — 17 de septiembre de 2026 (199, cuarto ciclo): `T2`, el buscador universal ya cubre las 45 pantallas navegables

Cuarto ciclo sobre `BACKLOG_CONTABILIDADCASA_2_0.md`, tras fusionar `T15`/`T17`/`T19` (mismo día,
PR #309). Siguiente tarea del Horizonte 1 original, la de mayor impacto declarado («ataca
directamente el hallazgo #1 del diagnóstico»: la navegación es más compleja que el problema que
resuelve, 37+ enlaces activos).

- **Investigado antes de escribir nada**: el enunciado de `T2` («Buscador universal Cmd+K») sonaba
  a construir algo desde cero. No lo era — `e17-experience.js` ya tenía un buscador difuso completo
  (`findTasks`, diálogo `e17LauncherDialog`, atajo Cmd/Ctrl+K ya cableado en `setupE17Experience()`)
  desde una oleada anterior. Antes de tocar código, se contó cuántas pantallas navegables tiene hoy
  `index.html` (45: nav principal + «Herramientas avanzadas») contra cuántas tiene el catálogo
  `TASKS` del buscador (37) — la misma cifra «37+» que cita el propio hallazgo #1, señal de que el
  catálogo no se había actualizado desde que se escribió el diagnóstico.
- **El hueco real**: 8 pantallas reales, con su propio `id="…"` de tipo `view-section` y su propio
  enlace en el menú, sin ninguna entrada en `TASKS` — entre ellas `registrar` y `plan`, dos de las
  pantallas de uso diario en las que se ha trabajado toda esta sesión (`T15`/`T17`/`T19`). Un
  comentario que vivía junto a la declaración de `TASKS` afirmaba que Plan y Cierre no necesitaban
  entrada propia porque ya los cubrían `cuadro-mandos`/`conciliar` — cierto por palabras clave
  parciales, falso para quien escribe «plan» o «cierre» tal cual esperando encontrar la pantalla con
  ese nombre. Ese comentario quedaba desmentido por el propio hueco que describía, así que se
  corrigió en vez de dejarlo.
- **Solución**: añadidas las 8 entradas que faltaban (`planificacion-partidas`, `registrar`, `plan`,
  `cierre`, `analisis`, `prevision`, `update-data`, `operations-manual`) a `TASKS`, con etiquetas
  copiadas literalmente del texto visible de cada enlace de navegación (mismo criterio que ya seguía
  el resto del catálogo) y palabras clave basadas en el subtítulo/descripción real de cada pantalla.
  Ninguna lógica nueva: el atajo, el diálogo y la búsqueda difusa ya funcionaban, solo faltaban datos
  en su catálogo.
- **Guardarraíl añadido**: nuevo test (`tests/e17-interface.test.cjs`) que extrae todos los
  `href="#…"` de la navegación real (principal + avanzada) y falla si alguno no tiene entrada en
  `E17Experience.TASKS` — para que este catálogo no vuelva a desincronizarse en silencio la próxima
  vez que se añada una pantalla nueva a la navegación sin acordarse del buscador.
- **Validación**: `npm run verify` completo en verde (código de salida 0). `npm test` **4274/4274**
  pruebas (+2 sobre las 4272 previas de esta sesión: la cobertura completa de navegación en el
  buscador y la ausencia de targets duplicados en `TASKS`). `test:a11y` **1328 IDs únicos** (sin
  cambio). `test:performance`, `build:site`, `test:privacy` y `test:smoke` sin errores.
- **Backlog actualizado**: `BACKLOG_CONTABILIDADCASA_2_0.md` marca `T2` como cerrada, con nota del
  cierre; §6 (Horizonte 1) ya no la lista entre las pendientes. 8/52 tareas cerradas en total.
  `BACKLOG_INDICE.md` refleja el mismo recuento.
- **Publicado**: commit y push a la rama de trabajo en curso, PR en borrador y fusión a `main` en
  cuanto el CI esté en verde, por la autorización de publicación sin preguntar en cada tarea ya
  vigente (`CLAUDE.md`).
- **Pendiente para la siguiente sesión**: `T16` y `T18` siguen esperando que el hogar decida. Del
  resto del Horizonte 1 original quedan `D4`, `I11`, `P1`, `P5`, `P6`.

## Cierre de sesión — 17 de septiembre de 2026 (199): `T15`, `T17` y `T19`, tres correcciones de Nielsen sobre Plan

Tercer ciclo sobre `BACKLOG_CONTABILIDADCASA_2_0.md`, tras fusionar `T1` (sesión 198, PR #308). De
los cinco hallazgos de `T1` que quedaron pendientes, `T16` y `T18` siguen bloqueados por una
decisión del hogar (vocabulario estándar previsto/real; si la regla de 4 bloques de Home sigue
vigente); se construyeron las tres que no dependían de esa decisión (`T15`, `T17` y `T19`), dejando
el backlog sin nada más pendiente de Horizonte 1 salvo las dos bloqueadas y el resto original
(`T2`/`D4`/`I11`/`P1`/`P5`/`P6`).

- **Qué hacía falta**: la barra de impacto de Plan (`planMesImpactBar`, `renderPlanMesImpactBar()`
  en `app.js`) solo se ocultaba cuando no quedaban cambios de previsto sin guardar — al pulsar
  «Guardar cambios» la barra desaparecía sin decir nada, a diferencia de Registrar, que sí muestra
  «guardado hace poco, a las HH:MM» (`registrarSessionConsolidatedNote`, R-7).
- **Solución**: mismo patrón que ya usa Registrar, no un mecanismo nuevo. Se añadió el estado
  `planMesConsolidatedNote` y una función `handlePlanMesImpactSave()` que llama a
  `saveVisualChanges()` (la misma que ya usaba el botón, compartida con `#visual-detail`/Cuadro de
  mandos — sin segundo camino de guardado) y, tras guardar, muestra «Cambios guardados.» en la barra
  durante 2 segundos antes de que vuelva a ocultarse. `renderPlanMesImpactBar()` distingue ahora tres
  estados: cambios pendientes (como antes), nada pendiente y sin guardado reciente (oculta, como
  antes) y nada pendiente con guardado reciente (nuevo: muestra la confirmación).
- **`T17` — repetir el colchón/reserva protegida en Previsión de Plan**: la fila «Colchón» de la
  tabla (`renderPlanPrevision()`) ya coloreaba cada mes contra el suelo calculado por
  `mapaCalorFloor()`, pero la cifra solo aparecía enterrada al final de la frase de
  `planPrevisionLegend` («Colchón: liquidez al cierre de cada mes frente a la reserva operativa de
  X €»). Ahora la leyenda abre con «Reserva protegida: X €.» antes del resto de la explicación —
  mismo dato que ya gobernaba el color, sin cálculo nuevo. **Investigado y descartado a propósito**:
  no se importó la cifra `today.requiredReserve` que muestran Home/Registrar/la tira de cabecera,
  porque es un número relacionado pero distinto (incluye salidas inmediatas del mes en curso; el
  suelo de Previsión es la reserva operativa configurada o el respaldo de un mes de salidas) —
  mostrar dos "reservas protegidas" con nombres iguales y valores distintos habría sido peor que el
  hallazgo original y habría invadido el terreno de `T16` (unificar vocabulario), que sigue
  pendiente de decisión del hogar.
- **`T19` — «Guía de este flujo» en Plan**: Home y Registrar ya tenían el botón contextual
  (`data-e17-open="guide"`, delegación global ya existente en `setupE17Experience()` →
  `openE17Dialog("guide")`); Plan no. Se añadió el mismo botón al encabezado de `#plan`
  (`index.html`), sin JS nuevo — la delegación ya cubre cualquier botón con ese atributo en
  cualquier pantalla. **Investigado antes de escribir nada nuevo**: el contenido del diálogo sale de
  `E17Experience.GUIDE_TOPICS`, que no tiene entradas propias ni para `home` ni para `registrar` —
  las dos pantallas que ya tenían el botón muestran el texto genérico de respaldo. Añadir el botón a
  Plan con ese mismo respaldo genérico iguala el comportamiento a como ya funcionaban las otras dos,
  que es exactamente lo que pide `T19`; escribir contenido de ayuda específico por pantalla sería un
  alcance mucho mayor (tres pantallas, no solo Plan) y no es lo que describe esta tarea.
- **Validación**: `npm run verify` completo en verde (código de salida 0). `npm test` **4272/4272**
  pruebas (+5 sobre las 4267 previas a esta sesión: 3 de `T15`, 1 de `T17`, 1 de `T19` — el botón
  aparece dentro de `#plan` con el mismo `data-e17-open="guide"` que Home y Registrar). `test:a11y`
  **1328 IDs únicos** (sin cambio). `test:performance`, `build:site`, `test:privacy` y `test:smoke`
  sin errores.
- **Backlog actualizado**: `BACKLOG_CONTABILIDADCASA_2_0.md` marca `T15`, `T17` y `T19` como
  cerradas, con nota de cada cierre; §6 (Horizonte 1) ya no las lista entre las pendientes sin
  decisión. 7/52 tareas cerradas en total. `BACKLOG_INDICE.md` refleja el mismo recuento.
- **Publicado**: commit y push a la rama de trabajo en curso, PR en borrador y fusión a `main` en
  cuanto el CI esté en verde, por la autorización de publicación sin preguntar en cada tarea ya
  vigente (`CLAUDE.md`).
- **Pendiente para la siguiente sesión**: de los cinco hallazgos de `T1`, solo `T16` y `T18` siguen
  esperando que el hogar decida (vocabulario estándar previsto/real; si la regla de 4 bloques de Home
  sigue vigente). Del resto del Horizonte 1 original quedan `T2`, `D4`, `I11`, `P1`, `P5`, `P6`.

## Cierre de sesión — 16 de septiembre de 2026 (198): `T1`, primera auditoría Nielsen real

Segundo ciclo de la sesión sobre `BACKLOG_CONTABILIDADCASA_2_0.md`, tras fusionar `D2`/`D3`/`D7`
(sesión 197, PR #307). Se ejecutó `T1` — la tarea marcada como «máxima prioridad de todo el
documento»: la primera revisión real contra los diez heurísticos de Nielsen de
`docs/OPT21_CHECKLIST_NIELSEN.md`, que llevaba desde el 29 de agosto sin ningún hallazgo real.

- **Método**: revisión de las tres pantallas de uso diario (`renderHomeDashboard()`/`#home`,
  `renderRegistrar()`/`#registrar`, `renderPlan()`/`#plan`) con evidencia `file:line` concreta antes
  de anotar cualquier hallazgo — mismo criterio que exige la propia checklist («solo lo que sea un
  hallazgo real y concreto, no una impresión genérica»). Detalle completo, con las diez preguntas
  guía, en `docs/OPT21_CHECKLIST_NIELSEN.md` (entrada del 16/09).
- **7 hallazgos reales** (de los 10 heurísticos; 3 sin hallazgo — control/libertad, prevención de
  errores y flexibilidad ya cubiertos con criterio):
  1. Plan nunca confirma «guardado» visualmente, a diferencia de Registrar.
  2. `index.html:709` mostraba literalmente «Sobres · Fase 6» al hogar — un identificador de fase de
     backlog interno filtrado a la UI.
  4. Tres vocabularios distintos para «previsto vs. real» en las tres pantallas de uso diario
     (Registrar: «Previsto/Real/Usado»; Plan: «Ingreso previsto/Comprometido/Asignado/Sin asignar»;
     Home: «Gasto previsto/Gasto real a hoy/Desviación») — el de mayor severidad de los siete.
  6. La pestaña Previsión de Plan no repite el colchón/reserva protegida, solo enlaza fuera.
  8. Home declara en su propio comentario «máximo 4 bloques en la zona principal, sin scroll»
     (`index.html:307-311`) pero implementa 9 artículos estáticos más 2 rejillas dinámicas — no
     cumple su propia regla.
  9. `app.js:28244` (`undoLastImportBatch()`): «No se pudo deshacer» mostraba el error crudo sin
     ninguna instrucción de qué hacer, rompiendo el patrón «qué pasó + qué hacer» del resto de
     Registrar.
  10. «Guía de este flujo» existe en Home y Registrar pero no en Plan.
- **Corregidos en la misma sesión, por ser triviales y sin decisión de producto de por medio**: los
  hallazgos 2 y 9. El resto (1, 4, 6, 8, 10) exige rediseño acotado o una decisión previa del hogar
  (qué vocabulario adoptar en el caso de 4, si la regla de 4 bloques de Home sigue vigente en el caso
  de 8) — se convirtieron en tareas nuevas `T15`-`T19` en `BACKLOG_CONTABILIDADCASA_2_0.md` §4, en
  vez de decidirlas por mi cuenta.
- **Validación**: `npm run verify` completo en verde (código de salida 0). `npm test` **4267/4267**
  pruebas (sin cambio de cifra — los dos arreglos no añaden pruebas nuevas propias, cambian solo
  texto visible sin comportamiento nuevo que testear; se comprobó que ningún test dependía del texto
  anterior antes de cambiarlo). `test:a11y` **1328 IDs únicos** (sin cambio). `test:performance`,
  `build:site`, `test:privacy` y `test:smoke` sin errores.
- **Backlog actualizado**: `BACKLOG_CONTABILIDADCASA_2_0.md` marca `T1` como cerrada y añade `T15`
  (confirmación de guardado en Plan), `T16` (unificar vocabulario, necesita decisión del hogar),
  `T17` (repetir el colchón en Previsión), `T18` (revisar densidad de Hoy, necesita decisión del
  hogar) y `T19` (guía de ayuda en Plan) — de 47 a 52 tareas totales, 4/52 cerradas. `BACKLOG_INDICE.md`
  refleja el mismo recuento.
- **Publicado**: commit y push a la rama de trabajo en curso, PR en borrador y fusión a `main` en
  cuanto el CI esté en verde, por la autorización de publicación sin preguntar en cada tarea ya
  vigente (`CLAUDE.md`).
- **Pendiente para la siguiente sesión**: el hogar tiene que decidir el vocabulario estándar de
  `T16` y si la regla de 4 bloques de `T18` sigue vigente, antes de construir esas dos. `T15`, `T17`
  y `T19` están listas para construirse sin más decisión previa. Del resto del Horizonte 1 original
  quedan `T2`, `D4`, `I11`, `P1`, `P5`, `P6`.

## Cierre de sesión — 16 de septiembre de 2026 (197): `D2`/`D3`/`D7` de `BACKLOG_CONTABILIDADCASA_2_0.md`

Primera sesión de trabajo real sobre `BACKLOG_CONTABILIDADCASA_2_0.md` (nacido en la sesión 196).
Siguiendo su propia recomendación de §6, se resolvieron primero las tres verificaciones de esfuerzo
mínimo (`D2`, `D3`, `D7`) antes de entrar en el resto del Horizonte 1.

- **`D3` (TIN desconocido por contrato) — cerrada sin construir nada.** Verificado que el TIN
  desconocido ya se distingue por contrato individual, no solo en el agregado: el editor de
  Contratos (input vacío, `placeholder="sin dato"`) y la tabla «Orden de ataque» (`—` por fila, con
  test dedicado ya existente en `d13-deuda-pixel-perfect.test.cjs`). Cobertura completa confirmada.
- **`D2` (reunificación N:1) — cerrada, con un enlace pequeño construido.** Verificado que
  `reunified`/`unifiedPlan` de `normalizeContracts()` ya es la ejecución real declarada por el
  hogar (Contratos › estado de cada contrato) — no hacía falta ningún motor nuevo, y `DEB6`
  (`simulateDebtConsolidation`) sigue siendo, correctamente, un simulador de solo lectura aparte.
  El hueco real era de enlace: sin él, el hogar tenía que reteclear a mano en «Comparar
  estrategias» el TIN y el plazo que ya había simulado en `DEB6`. Se investigó primero si convenía
  que el simulador marcase contratos como reunificados directamente y se descartó por riesgo real:
  el modelo solo soporta un `unifiedPlan` global (hoy con la cifra hardcodeada de la reunificación
  real ya existente, Cetelem, 180€/36 cuotas) — marcar contratos nuevos como reunificados desde ahí
  mezclaría dos consolidaciones distintas bajo una sola cifra, dando una figura financiera
  incorrecta. En su lugar: un botón «Usar esta oferta en Comparar estrategias» en el resultado de
  `DEB6` que precarga TIN/plazo en la oferta declarada que ya usa esa pantalla
  (`saveDebtConsolidationOffer`) — puramente declarativo, nunca toca `reunified` ni ejecuta nada
  (`A11-4`).
- **`D7` (coste anual de cláusulas vigiladas) — construida.** Verificado primero que `GOB16`
  (`scenarioSettings.gob16DebtClauses`) no cubría nada de esto: declaraba vinculación de productos,
  comisión de apertura y revisión del diferencial, pero sin convertir nada a euros ni anualizarlo.
  Añadido `bonusRatePenaltyPct` (puntos de TAE que penalizaría el banco si se incumple la
  vinculación, declarado por el hogar, nunca inferido) y su coste anual en euros
  (`(bonusRatePenaltyPct/100) × currentPrincipal`), mostrado tanto si la vinculación está
  incumplida hoy como, a modo de aviso, si se cumple pero el hogar quiere ver el riesgo. Sin el
  dato declarado, la nota se queda cualitativa igual que antes de esta tarea — nunca se inventa una
  cifra.
- **Validación**: `npm run verify` completo en verde (código de salida 0) tras `npm install` (sin
  `node_modules` al empezar la sesión, igual que en sesiones anteriores — 6 fallos exactamente por
  falta de `esbuild`/`build:site` antes de instalar, 0 después). `npm test` **4267/4267** pruebas
  (4259 de la sesión 196 + 8 nuevas: 4 en `tests/gob16-vigilancia-clausulas-deuda.test.cjs` para
  `bonusRatePenaltyPct` y el cálculo en euros, 3 de wiring del enlace `DEB6`→oferta en
  `tests/deb5-deb6-prioridad-fiscal-y-consolidacion.test.cjs`, 1 ajuste al valor por defecto de
  `gob16ContractClause`). `test:a11y` **1328 IDs únicos** (sin cambio — no se tocó ningún id nuevo
  de pantalla). `test:performance`, `build:site`, `test:privacy` y `test:smoke` sin errores.
- **Backlog actualizado**: `BACKLOG_CONTABILIDADCASA_2_0.md` (§3, §0, §6) marca `D2`/`D3`/`D7` como
  cerradas, 3/47. `BACKLOG_INDICE.md` refleja el mismo recuento en su tabla.
- **Publicado**: commit y push a la rama de trabajo en curso, PR en borrador y fusión a `main` en
  cuanto el CI esté en verde, por la autorización de publicación sin preguntar en cada tarea ya
  vigente (`CLAUDE.md`).
- **Pendiente para la siguiente sesión**: continuar el Horizonte 1 de `BACKLOG_CONTABILIDADCASA_2_0.md`
  — `T1` (auditoría Nielsen real de Hoy/Registrar/Plan, máxima prioridad del documento) primero, y
  `P1`/`P5`/`P6` a la espera de su resultado por si reorganiza la pantalla «Hoy»; en paralelo o
  después, `T2` y `D4`/`I11`, ya acotados y sin esa dependencia.

## Cierre de sesión — 16 de septiembre de 2026 (196): nace `BACKLOG_CONTABILIDADCASA_2_0.md`

El hogar pidió una tercera auditoría crítica de producto — "eres el mejor desarrollador de apps
financieras: analiza la app y propón mejoras", con más de 40 features nuevas, profundizando en
previsión/actualización de datos, mejorando inversión y optimizando deuda. Se hizo con cuatro
revisiones de código en paralelo (previsión, inversión, deuda, sistema UX/estado del proyecto),
publicada primero como documento independiente
[«Contabilidadcasa 2.0»](https://claude.ai/artifact/S2aurmx6x3AWkd48D712WE) (10 hallazgos + 48
propuestas) — misma disciplina que ya usó «El Libro Vivo» con la Oleada 4.

**Cruce contra el código y este mismo documento antes de convertirla en tareas** — encontró 3
correcciones reales:
- `I4` (guardarraíl de crédito Lombard equivalente a `AP4`) se **descarta**: no es un hueco, es una
  exclusión decidida explícitamente por el hogar y ya documentada arriba en el índice de decisiones
  vigentes («el crédito Lombard queda fuera del guardarraíl general de deuda»).
- `D2` (reunificación N:1 ejecutable) se **reduce a verificación**: `simulateDebtConsolidation`
  (`DEB6`) está comentado en su propio código como «simulación hipotética, distinta del plan ya
  reunificado (`reunified`/`unifiedPlan` de `normalizeContracts`)» — puede que la ejecución real ya
  exista por otra vía y solo falte enlazarla, en vez de construir un motor nuevo.
- `T5` (patrimonio neto consolidado) se **reduce de alcance**: el hallazgo original decía que no
  existía ningún balance; en realidad `A14-1`/`A14-2`/`A14-4` ya calculan la cifra puntual y el
  desglose por tipo — lo que falta, señalado explícitamente en el propio `app.js` («A14-2 núcleo, sin
  histórico ni banda de confianza todavía — sesión aparte»), es justo esa serie histórica y esa
  banda, ya previstas como pendientes desde antes de esta auditoría.
- `D3` (aviso de TIN desconocido) también se reduce a verificación puntual: `views/deuda.js` ya
  muestra «sin TIN declarado» en el agregado — falta confirmar si llega a cada contrato individual.

**Publicado**: `BACKLOG_CONTABILIDADCASA_2_0.md` (documento nuevo, 47 tareas accionables en 4
bloques `P-`/`I-`/`D-`/`T-`, con la sección §7 incorporando al final todo lo pendiente heredado de
`BACKLOG_SUCESION_Y_CONTINUIDAD.md` y de las colas anteriores: `OPT-10/11/12/13`, `RGX3`, `DEX6`,
`GOB5`, `O-6` y la superficie de UI de Copiloto/IA — una sola lista, sin cruzar varios documentos).
`BACKLOG_INDICE.md` actualizado con la entrada del nuevo backlog y su fila en el mapa completo. Sin
cambios de código — solo documentación; ninguna tarea del backlog nuevo se ha implementado todavía.

- **Validación**: `npm run verify` completo en verde (código de salida 0) tras `npm install` (el
  entorno de esta sesión tampoco tenía `node_modules`, mismo caso que la sesión 195: sin él,
  `test:performance`/`build:site` fallaban por falta de `esbuild`, no por ninguna regresión — 6
  fallos exactamente en esas pruebas antes de instalar, 0 después). `npm test` **4259/4259** pruebas
  — misma cifra que dejó la sesión 195, consistente con que esta sesión no cambió ningún fichero de
  código. `test:a11y` **1328 IDs únicos** (sin cambio). `test:performance`, `build:site`,
  `test:privacy` y `test:smoke` sin errores.
- **Publicado**: commit y push a la rama de trabajo en curso, PR en borrador y fusión a `main` en
  cuanto el CI esté en verde, por la autorización de publicación sin preguntar en cada tarea ya
  vigente (`CLAUDE.md`).
- **Pendiente para la siguiente sesión**: decidir con el hogar por dónde empezar de
  `BACKLOG_CONTABILIDADCASA_2_0.md` (Horizonte 1 sugerido: `T1`, `T2`, `D4`, `I11`, `P1`, `P5`, `P6`)
  y resolver primero las tres verificaciones de esfuerzo mínimo (`D2`, `D3`, `D7`) que pueden cerrar
  sin construir nada. Las tres condiciones externas de `BACKLOG_INDICE.md` (`OPT-2`, `A5-1`, `O-6`)
  siguen sin cumplirse.

## Cierre de sesión — 16 de septiembre de 2026 (195): auditoría de código de Copiloto/IA y Multidispositivo

Con `BACKLOG_ULTIMATE_SEPTIEMBRE_OLEADA_4.md` y `BACKLOG_SUCESION_Y_CONTINUIDAD.md` ya 100% cerrados
(sesiones 191 y 194) y ningún backlog nuevo identificado, esta sesión no construyó nada: hizo la
re-auditoría de código que `BACKLOG_SUCESION_Y_CONTINUIDAD.md` §2 dejó pendiente para Copiloto/IA y
Multidispositivo (declarados "postpuestos, sin auditar" en la sesión 192) — condición previa antes de
asumir que cualquiera de los dos sigue "resuelto sin tarea nueva".

**Copiloto/IA (`canonical-e9-assistant.js`) — infraestructura huérfana, confirmado con más alcance del
asumido.** De sus 6 funciones exportadas, solo `sourceCatalog()` tiene llamador real en el navegador
(`cp1NextBestAction`/`cp2IdleCashSignal` en `p2-ui.js`, `cpx1WeeklyPriorityAction` en
`views/estado-semana.js` — formas `alerts`/`metrics` únicamente). `prepareQuery`/`validateResponse`/
`localDisclosure` — el flujo real de "hacer una pregunta a una IA externa y validar su respuesta" —
solo aparecen en `private-backend.js`, que depende de que `A5-1` esté desplegado en producción real, y
`A5_ACTIVATION.md` confirma que sigue sin estarlo (sesión 192). Ninguna pantalla del sitio publicado
llama a ese backend hoy: grep sobre `app.js`/`index.html`/`p2-ui.js` no encuentra ningún endpoint
`assistant-query` ni equivalente. Raíz confirmada: la sesión 42 (28 de agosto de 2026) retiró el único
llamador real, el widget «Asistente financiero» (confirmado explícitamente por el hogar antes de
tocarlo), conservando el motor como infraestructura para un futuro "motor de recomendación real" (`T-6`,
`BACKLOG.md`). No es un bug ni un hueco nuevo — es la misma decisión de producto de hace tres semanas,
pero con una implicación que no estaba escrita en ningún sitio: **no queda ninguna superficie de UI que
active ese flujo**, ni siquiera tras un flag apagado, así que activar `A5-1` exigirá construir una
pantalla nueva desde cero, no solo encender un interruptor. Hallazgo secundario, menor: la forma
`decisions` de `sourceCatalog()` (añadida por `GOB17` explícitamente para un "consumidor futuro") sigue
sin ningún llamador real hoy — solo `alerts`/`metrics` se usan.

**Multidispositivo (`RGX1`, `RGX2`, `MDX1`, `MDX2`) — sin hallazgos, verificado sólido.** Los cuatro
están cableados de punta a punta, no solo documentados: `RGX1`/`RGX2` con lógica real en `app.js`
(antigüedad de copia, cobertura por área, concentración de conocimiento); `MDX1` con el recorrido
completo selector (`index.html`) → `mdx1KidsSummarySource()` (`app.js`) → `renderKidsSummary()`
(`share.html`), verificado que no expone deuda ni movimientos; `MDX2` con un test que hace fallar el
documento automáticamente si diverge de `state-contract.js`.

**Decisión tomada**: no se crea tarea de backlog nueva. El freno real de Copiloto/IA es la condición
externa `A5-1` (ya rastreada en `A5_ACTIVATION.md` y en la tabla de `BACKLOG_INDICE.md`), no código por
escribir — construir una UI ahora sería construir una pantalla para un backend que no responde.
`BACKLOG_SUCESION_Y_CONTINUIDAD.md` §2 se actualiza de "postpuesto, sin auditar" a "auditado, sin hueco
accionable, bloqueado por `A5-1`" para que ninguna sesión futura tenga que rehacer esta misma
investigación.

- **Validación**: `npm run verify` completo en verde tras `npm install` (el entorno de esta sesión no
  tenía `node_modules`; sin él, `test:performance`/`build:site` fallaban por falta de `esbuild`, no por
  ninguna regresión de código — resuelto instalando las dependencias ya declaradas en
  `package.json`/`package-lock.json`, sin tocar ninguna). `npm test` **4259/4259** pruebas — misma cifra
  exacta que dejó la sesión 194, consistente con que esta sesión no cambió ningún fichero de código.
  `test:a11y` **1328 IDs únicos** (sin cambio). `test:performance`, `build:site`, `test:privacy` y
  `test:smoke` sin errores.
- **Publicado**: solo cambios de documentación (este cierre, `BACKLOG_SUCESION_Y_CONTINUIDAD.md`,
  `BACKLOG_INDICE.md`) — commit y push a la rama de trabajo en curso, PR en borrador y fusión a `main`
  en cuanto el CI esté en verde, por la autorización de publicación sin preguntar en cada tarea ya
  vigente (`CLAUDE.md`).
- **Pendiente para la siguiente sesión**: sigue sin haber ningún backlog nuevo identificado. Las tres
  condiciones externas de la tabla de `BACKLOG_INDICE.md` siguen sin cumplirse (`OPT-2` cumple el 28 de
  septiembre, `A5-1` sigue sin producción real, `O-6`/PSD2 sin contratar). Quien retome debería empezar
  verificando si alguna de las tres cambió antes de buscar trabajo nuevo por otra vía.

## Cierre de sesión — 16 de septiembre de 2026 (194): `LPX4`

Última tarea de `BACKLOG_SUCESION_Y_CONTINUIDAD.md` — con esto el backlog queda 100% cerrado (3/3:
`LPX4`, `LPX5`, `LPX6`). Antes de construir se propuso el diseño al usuario (misma disciplina que
`GOB15`), que lo confirmó sin cambios.

**`LPX4` — Aviso temprano de coste fiscal por sucesión/donación.** Reutiliza `lpNetWorthSnapshot()`
(`LPX1`/`LPX2`) para la masa hereditaria — sin motor de patrimonio nuevo. Decisión de implementación
clave: en vez de un registro de escalas propio, se añadió un `kind` nuevo ("succession") al mismo
registro de escalas de `A15-2` (`irpfBracketScales`/`saveIrpfBracketScale`/`latestIrpfScale`,
`canonical-irpf-estimator.js`) — el hogar declara ahí la escala **ya aplicable a su caso concreto**
(con la bonificación de su grupo de parentesco y su comunidad autónoma ya incorporada), con la misma
exigencia de fuente completa (`hasCompleteSource`/`validateBracketScale`) que el resto del motor
fiscal. Sin esa escala registrada, `lpx4SuccessionTaxEstimate()` nunca calcula ninguna cifra: solo
muestra el patrimonio neto y explica por qué el coste real depende de tres datos que la app no infiere
(comunidad autónoma, grupo de parentesco I-IV, patrimonio preexistente del heredero). Con la escala
registrada, reutiliza `progressiveTax()` (mismo primitivo que `A15-2`/`LEV10`) sobre el patrimonio neto
menos un mínimo exento opcional (`lpx4ExemptAmount`, nuevo campo en Ajustes → Fiscal, 0 si no se
declara — nunca un mínimo inventado). Persistido en `scenarioSettings` explícitamente (mismo bug de
`SP3`/`FC4` evitado a propósito: `state.lpx4ExemptAmount` solo sobrevive a un recargar la página si se
añade a la lista blanca de `saveScenarioSettings()`, y se añadió). Nueva tarjeta en Herramientas
avanzadas → Patrimonio e inversión, justo después de `LPX3` (continuidad). Informativo: nunca decide
ni sustituye asesoría fiscal real. Tests: `tests/lpx4-aviso-fiscal-sucesion.test.cjs` (17 tests); dos
tests preexistentes con coincidencia exacta de texto se ajustaron sin tocar su cobertura real
(`tests/fc5-app-integracion.test.cjs` por el nuevo tramo del ternario `kind`, `tests/gob9-panel-
resiliencia.test.cjs` por la nueva adyacencia de renders en el lote de `renderAjustes()`).

- **Validación**: `npm run verify` completo en verde. `npm test` **4259/4259** pruebas (17 nuevas de
  `LPX4`). `test:a11y` **1328 IDs únicos** (antes 1326, sesión 193; +2 por el campo de mínimo exento y
  la opción nueva del selector de tipo de escala). `test:performance`: diff 10.000 filas 48,3 ms,
  forecast y escenarios 269,7 ms, recursos 2288 KB, presupuestos a escala (1000 categorías × 10 años)
  — análisis 202,5 ms, alertas 131,1 ms, forecast 228,1 ms, histórico de presupuestos 66,7 ms, índice
  de transacciones por categoría 192,2 ms. `build:site`, `test:privacy` y `test:smoke` sin errores.
  Validación manual adicional en navegador real con Playwright: con un activo registrado y sin escala
  de sucesiones declarada, el aviso pide registrarla y explica por qué; al registrar la escala
  ("100000:5, :10" con fuente completa) calcula correctamente el coste fiscal sobre el patrimonio neto
  completo; al declarar un mínimo exento de 200.000 €, recalcula la base y la cuota correctamente; y
  tras recargar la página, tanto el mínimo exento declarado como la estimación persisten — sin errores
  de consola propios de la app (los únicos observados fueron el bloqueo de red del proxy del entorno de
  pruebas al script externo de Supabase, ajeno a este cambio).
- **Publicado**: commit y push a la rama de trabajo en curso, PR en borrador abierto y fusión a `main`
  en cuanto el CI esté en verde, por la autorización de publicación sin preguntar en cada tarea ya
  vigente (`CLAUDE.md`).
- **Pendiente para la siguiente sesión**: `BACKLOG_SUCESION_Y_CONTINUIDAD.md` queda 100% cerrado
  (3/3). `BACKLOG_INDICE.md` debería consultarse antes de arrancar cualquier cola nueva.

## Cierre de sesión — 14 de septiembre de 2026 (193): `LPX5`

Segunda tarea de `BACKLOG_SUCESION_Y_CONTINUIDAD.md`. `LPX6` ya se había construido y publicado en la
sesión 192 (ver el cierre inmediatamente debajo) en otra sesión en paralelo — esta sesión partió del
mismo backlog, sin verlo todavía fusionado, así que empezó por `LPX6` de forma independiente; al abrir
el PR se detectó que ya estaba en `main` (PR #302) y esta entrada se reescribió para cubrir solo el
trabajo que seguía pendiente de verdad: `LPX5`. El diagnóstico y la implementación de `LPX6` de esta
sesión coincidieron en lo esencial con los de la sesión 192 (mismos campos `isLife`/`beneficiary`,
mismo criterio de sustituir la casilla manual) — se descartó el duplicado sin perder nada, tomando la
versión ya fusionada como base.

**`LPX5` — Destino declarado por activo.** Extiende `canonical-assets.js` (`A14-1`) con un campo
`destination` opcional por activo (texto libre, mismo patrón que `notes`/`category`), declarable desde
el propio formulario de Ajustes › Patrimonio (`a14AssetDestination`, leído por `saveA14Asset`). Nunca
vinculante: no decide legítima ni sustituye testamento, tal y como exige el backlog. Decisión de
alcance tomada en esta sesión: el backlog hablaba de "convertir la casilla global «a quién avisar» en
algo trazable activo por activo", pero de las tres casillas manuales originales de `LPX3` solo
`documentsKnown` ("Alguien de confianza sabe dónde están los documentos clave") seguía sin construir
tras `LPX6` — y esa pregunta (¿alguien sabe dónde están los documentos?) es genuinamente distinta de
"¿a quién se destina cada activo?", sin dato real que la sustituya. Se optó por **no** reutilizar ese
id para un check que no le corresponde: `documentsKnown` sigue como casilla manual legítima, y se
añadió un check automático nuevo (`assetDestination`) junto a los demás. El checklist de `LPX3` pasa
así de cinco a seis puntos (cuatro automáticos: activos, pólizas, beneficiario de vida, destino por
activo; dos manuales: testamento y documentos clave).

- **Validación**: `npm run verify` completo en verde tras rebasar sobre `main` (con `LPX6`, PR #302,
  ya fusionado) y resolver el conflicto de fusión quedándose con la implementación de `LPX6` ya
  publicada. `npm test` **4242/4242** pruebas (6 nuevas de `LPX5` sobre las 4236/4236 que ya dejó
  `LPX6` en `main`). `test:a11y` **1326 IDs únicos** (antes 1325, sesión 192; +1 por el campo de
  destino). `test:performance`: diff 10.000 filas 31,8 ms, forecast y escenarios 170,3 ms, recursos
  2283 KB, presupuestos a escala (1000 categorías × 10 años) — análisis 113,0 ms, alertas 85,4 ms,
  forecast 131,4 ms, histórico de presupuestos 28,4 ms, índice de transacciones por categoría
  102,4 ms. `build:site`, `test:privacy` y `test:smoke` sin errores. Validación manual adicional en
  navegador real con Playwright: se dio de alta un activo con destino declarado (aparece en el
  listado de activos) y el checklist de continuidad reflejó al instante el punto de destino en verde
  — sin errores de consola propios de la app.
- **Publicado**: commit y push a la rama de trabajo en curso, PR en borrador abierto y fusión a `main`
  en cuanto el CI esté en verde, por la autorización de publicación sin preguntar en cada tarea ya
  vigente (`CLAUDE.md`).
- **Pendiente para la siguiente sesión**: `BACKLOG_SUCESION_Y_CONTINUIDAD.md` queda con `LPX4` como
  única tarea abierta (aviso temprano de coste fiscal por sucesión/donación) — la más delicada de las
  tres por su restricción explícita de no inventar bonificación ni tramo fiscal sin fuente completa
  declarada por el hogar.

## Cierre de sesión — 14 de septiembre de 2026 (192): `LPX6`

Primera tarea construida de `BACKLOG_SUCESION_Y_CONTINUIDAD.md`, nacido esta misma sesión a partir de
un hallazgo abandonado de la sesión 164 (ver más abajo el resto del cierre de esta sesión, con la
creación del documento y la publicación del `BACKLOG_INDICE.md` actualizado). El hogar decidió
empezar por `LPX6` — la más pequeña y autocontenida de las tres, sin tocar fiscalidad ni el registro
de activos — para validar el patrón antes de `LPX4` (el aviso fiscal) y `LPX5`.

**`LPX6` — Beneficiario declarado por póliza de vida.** Diagnóstico previo corrigió el planteamiento
del propio backlog: `canonical-life-coverage.js` (SP2) no es un registro de pólizas, es un motor de
comparación puro sin estado; el inventario real (SP1, `insurancePolicies()`/`addInsurancePolicy()` en
`app.js`) tampoco distinguía qué póliza es de vida — un campo `type` no existía en absoluto. En vez de
inferir "vida" del nombre de la póliza (contrario a la disciplina del resto del proyecto: nunca se
infiere lo que el hogar puede declarar), se añaden dos campos nuevos y opcionales al registro
existente: `isLife` (booleano, checkbox "Es un seguro de vida") y `beneficiary` (texto libre). `LPX3`
(`lpx3ContinuityChecklist()`) sustituye su casilla manual global "Beneficiarios de las pólizas
revisados y al día" por una comprobación real: al menos una póliza con `isLife === true` y
`beneficiary` no vacío — mismo criterio de "cerrar el bucle" que `PVC13` aplicó a `confidenceBands()`.
Sin pólizas de vida declaradas, el punto falla con un mensaje distinto ("sin pólizas de vida
registradas") del de "con pólizas de vida pero sin beneficiario" — nunca el mismo aviso genérico para
dos situaciones distintas. `LPX3_MANUAL_ITEMS` queda en dos puntos (testamento, a quién avisar); el
tercero (beneficiarios) pasa a automático.

- **Validación**: `npm run verify` completo en verde. `npm test` **4236/4236** pruebas (12 nuevas:
  8 en `tests/lpx6-beneficiario-poliza-vida.test.cjs` y 4 más en `tests/lpx3-continuidad-checklist.test.cjs`
  reescrito para el nuevo comportamiento). `test:a11y` **1325 IDs únicos** (antes 1323, sesión 192
  anterior; +2 por el checkbox y el campo de texto nuevos). `test:performance`, `build:site`,
  `test:privacy` y `test:smoke` sin errores. Validación manual adicional en navegador real con
  Playwright: se declara una póliza de vida sin beneficiario (el punto de continuidad falla con el
  mensaje correcto), se añade una segunda póliza de vida con beneficiario "Cónyuge" (el punto pasa a
  ok con el recuento "1 de 2"), la lista de pólizas muestra la etiqueta "Vida" y el beneficiario o
  "Sin beneficiario declarado" según corresponda, y el formulario limpia el checkbox y el campo de
  beneficiario tras cada alta — sin errores de consola propios de la app.
- **Publicado**: commit y push a la rama de trabajo en curso, PR en borrador y fusión a `main` en
  cuanto el CI esté en verde, por la autorización de publicación sin preguntar en cada tarea ya
  vigente (`CLAUDE.md`).
- **Pendiente**: quedan `LPX4` (aviso temprano de coste fiscal por sucesión/donación) y `LPX5`
  (destino declarado por activo) en `BACKLOG_SUCESION_Y_CONTINUIDAD.md`. `LPX5` se construyó y
  publicó en la sesión 193 (ver el cierre inmediatamente arriba).

## Cierre de sesión — 14 de septiembre de 2026 (191): `GOB15`

Última tarea accionable de `BACKLOG_ULTIMATE_SEPTIEMBRE_OLEADA_4.md`. El hogar pidió ampliar el
alcance confirmado en la propuesta de diseño (sesión 171: apuesta L, sesión propia dedicada) para
incluir un segundo destino del neto de la venta — comprar una vivienda nueva, además de pasar a
alquiler.

**`GOB15` — Simulador de vender la vivienda habitual: alquiler o compra.** Diagnóstico previo: el
backlog solo pedía "reutiliza `rentalAssetPnL()` (INV9) para el lado del alquiler recibido/pagado" —
insuficiente por sí solo para una decisión de este calado, así que se propuso el diseño completo antes
de construir (mensaje de esta misma sesión) y se amplió a petición del hogar. Sin motor propio salvo
la exención por reinversión (única pieza de cálculo nueva, ver abajo): reutiliza tal cual la hipoteca
activa ya declarada en Deuda › Contratos (mismo filtro que `DEB14`, `deb14MortgageContracts`,
`gob15OldMortgage`) para la deuda que se cancela al vender; `optimizePartialSale` (FC5) +
`latestIrpfScale("savings")` + `fc5AlreadyRealized` (sin duplicarlos) para el coste fiscal de la
plusvalía; `monthlyPayment` (DI1, `canonical-mortgage-rate-scenarios.js`) para la cuota de una
hipoteca nueva si compra financiada; y `rentalAssetPnL` (INV9, `canonical-assets.js`) para anualizar
el alquiler nuevo si pasa a alquiler.

La única pieza de cálculo nueva es la exención proporcional por reinversión en vivienda habitual
(art. 38 LIRPF / art. 41 RIRPF): cuando el importe reinvertido en la vivienda nueva es menor que el
precio de venta, solo la parte de la ganancia proporcional a esa fracción queda exenta. A diferencia
de un tramo o tipo numérico (que caduca cada año y este proyecto nunca fabrica sin fuente registrada,
`validateBracketScale`), esta es la fórmula legal estable del mecanismo de reinversión — se aplicó
como estimación orientativa, con el mismo aviso profesional que ya lleva `optimizePartialSale` en el
resto de la app. Para cualquier otra exención que el hogar ya conozca (mayor de 65 años, u otra ya
confirmada con su asesor) hay una casilla declarada aparte — nunca se decide la elegibilidad desde el
código, mismo criterio que el resto del motor fiscal de la casa.

Nueva tarjeta en Herramientas avanzadas → Patrimonio e inversión, justo después de `GOB11`
(Proyección de jubilación), con un selector de destino (alquiler/compra) que muestra u oculta los
campos correspondientes. Comparación puntual con los datos de hoy, igual que el resto de simuladores L
de esta familia (DI1, AP3, LEV9...): no proyecta revalorización de la vivienda ni inflación del
alquiler a varios años, ni asume que el hogar compra en otro sitio si el modo es alquiler. Informativo:
no ejecuta ni decide nada. Tests: `tests/gob15-vender-vivienda-alquiler-o-compra.test.cjs` (22 tests).

- **Validación**: `npm run verify` completo en verde. `npm test` **4224/4224** pruebas (22 nuevas de
  `GOB15`). `test:a11y` **1323 IDs únicos** (antes 1309, sesión 190; +14 por los campos de la nueva
  tarjeta). `test:performance`: diff 10.000 filas 36,2 ms, forecast y escenarios 144,4 ms, recursos
  2280 KB, presupuestos a escala (1000 categorías × 10 años) — análisis 102,7 ms, alertas 76,6 ms,
  forecast 132,9 ms, histórico de presupuestos 31,7 ms, índice de transacciones por categoría 94,8 ms.
  `build:site`, `test:privacy` y `test:smoke` sin errores. Validación manual adicional en navegador
  real con Playwright: la tarjeta se renderiza en Herramientas avanzadas → Patrimonio e inversión, el
  selector de destino muestra/oculta los campos correctos en ambos sentidos, el modo alquiler calcula
  bien el neto y el alquiler anualizado, y el modo compra calcula bien la exención proporcional, la
  cuota de la hipoteca nueva (474,21 €/mes sobre 100.000 € al 3% a 300 meses, coincide con el test
  unitario) y la liquidez sobrante — sin errores de consola propios de la app en ningún caso, sin
  hipoteca activa declarada en este entorno de pruebas (se avisó correctamente en vez de inventar un
  importe).
- **Publicado**: commit y push a la rama de trabajo en curso, PR en borrador abierto y fusión a `main`
  en cuanto el CI esté en verde, por la autorización de publicación sin preguntar en cada tarea ya
  vigente (`CLAUDE.md`).
- **Pendiente para la siguiente oleada**: con esto `BACKLOG_ULTIMATE_SEPTIEMBRE_OLEADA_4.md` queda
  100% cerrado (46/46 tareas accionables construidas o reducidas/retiradas con motivo). No hay
  siguiente backlog abierto: `BACKLOG_INDICE.md` debería consultarse antes de arrancar cualquier cola
  nueva o retomar una antigua.

## Cierre de sesión — 14 de septiembre de 2026 (190): `GOB19`

De las dos apuestas grandes que quedaban en `BACKLOG_ULTIMATE_SEPTIEMBRE_OLEADA_4.md` (`GOB15`,
`GOB19`), el usuario eligió empezar por `GOB19` — alcance más contenido y previsible (integración de
dos motores ya probados, sin mecánica nueva) frente a `GOB15` (simulador de vender la vivienda
habitual, que sí exige diseñar mecánica financiera nueva) — dejando `GOB15` para una sesión dedicada
aparte.

**`GOB19` — Plantilla de separación patrimonial.** Diagnóstico previo: el backlog pedía combinar
`canonical-household-split.js` (A18, saldo de gastos compartidos + liquidación con doble confirmación)
y `canonical-joint-restructuring.js` (DI5, reestructuración conjunta ante una caída de ingresos) *sin
construir un tercer motor*. Se encontró que ya existe un modelo real de titularidad por contrato de
deuda (E14, `p2State().ownership['debt|<id>']`, editable en Herramientas avanzadas → Datos → «Familia y
paquete para asesor») — se reutilizó tal cual en vez de inventar un campo de asignación nuevo. Nueva
tarjeta en Ajustes › Hogar y cuentas, justo debajo de `GOB10`: agrupa la deuda activa por el titular ya
declarado (`gob19DebtsByOwner`, mismo filtro que `di5RestructuringContracts`) y llama a
`jointRestructuringPlan()` (DI5, sin tocarlo) una vez por titular con su ingreso individual declarado
tras la separación, en vez de una sola vez con el ingreso conjunto — así cada uno ve si su reparto de
deuda es sostenible solo con su propio ingreso. Se completa con el saldo pendiente de gastos
compartidos que ya calcula A18 (`a18CurrentProposal`, reutilizado sin cambios) como aviso de qué
liquidar antes de separar cuentas, y con un aviso explícito de cuánta deuda sigue a nombre de «Hogar»
(sin asignar a Javi o Tere) — esa queda fuera del reparto hasta que el hogar la asigne, nunca se le
asigna por defecto. Decisión de alcance explícita: no reparte activos (vivienda, cartera, cuentas) —
A14 no declara titular por posición (siempre «household», sin edición), así que abrir eso habría sido
inventar un modelo de titularidad de activos que el hogar no ha pedido; ese hueco queda documentado,
no resuelto. Informativo, no ejecuta ni decide nada. Tests:
`tests/gob19-plantilla-separacion-patrimonial.test.cjs` (15 tests).

- **Validación**: `npm run verify` completo en verde. `npm test` **4202/4202** pruebas (15 nuevas de
  `GOB19`; antes de correrlas hubo que ejecutar `npm install` porque `node_modules` no existía en el
  contenedor de esta sesión — sin relación con el código de la tarea). `test:a11y` **1309 IDs únicos**
  (antes 1305, sesión 189; +4 por los dos campos de ingreso, el botón y la nota nuevos). `test:performance`:
  diff 10.000 filas 37,0 ms, forecast y escenarios 211,8 ms, recursos 2269 KB, presupuestos a escala
  (1000 categorías × 10 años) — análisis 140,6 ms, alertas 92,3 ms, forecast 165,9 ms, histórico de
  presupuestos 42,6 ms, índice de transacciones por categoría 122,6 ms. `build:site`, `test:privacy` y
  `test:smoke` sin errores. Validación manual adicional en navegador real con Playwright: la tarjeta se
  renderiza en Ajustes › Hogar y cuentas con su ayuda contextual, y sin ninguna deuda asignada a Javi o
  Tere el «Comparar» muestra correctamente «sin saldo pendiente de gastos compartidos» y «sin deuda
  propia asignada» para ambos titulares, sin errores de consola propios de la app (solo ruido de red
  ajeno, de dominios externos bloqueados por el proxy del entorno). No se pudo completar en el mismo
  pase la validación manual del camino "con deuda asignada" — el `<select>` de titularidad de Herramientas
  avanzadas → Datos quedó inaccesible al automatismo de Playwright tras expandir el desplegable de
  navegación avanzada, por una razón de UI no diagnosticada y ajena a esta tarea; ese camino sí está
  cubierto por la suite automática, que ejecuta la función real (`gob19DebtsByOwner`,
  `handleGob19SeparationTemplate`) con datos de titularidad realistas.
- **Publicado**: commit y push a la rama de trabajo en curso, PR en borrador abierto y fusión a `main`
  en cuanto el CI esté en verde, por la autorización de publicación sin preguntar en cada tarea ya
  vigente (`CLAUDE.md`).
- **Pendiente para la siguiente oleada**: con esto `BACKLOG_ULTIMATE_SEPTIEMBRE_OLEADA_4.md` deja una
  sola tarea accionable: `GOB15` (simulador de vender la vivienda habitual y pasar a alquiler),
  confirmada por el hogar para una sesión futura dedicada aparte (sesión 171). Sigue pendiente también
  validar en navegador el camino "con deuda asignada" de `GOB19` cuando se retome esa pantalla.

## Cierre de sesión — 13 de septiembre de 2026 (189): `GOB16` y `GOB18`

El usuario pidió seguir con las dos tareas restantes del Bloque 7 en la misma sesión: `GOB16` y
`GOB18`.

**`GOB16` — Vigilancia de cláusulas de deuda más allá de TAE y capital.** Diagnóstico previo: acotado
a lo que `DEB4` (radar de refinanciación) y `DEB8` (ventana de comisión decreciente, ambas Oleada 3)
no cubren — vinculación de productos exigida por el contrato, comisión de apertura ya declarada
(dato de referencia) y fecha de revisión del diferencial pactado. Construido en Deuda › Contratos,
justo después de la tarjeta de `DEB13`: un `<details>` por deuda activa (mismo patrón que el
calendario de amortización de Deuda › Ruta), con tres campos declarables por contrato
(`scenarioSettings.gob16DebtClauses`, mismo criterio de persistencia que `savingsPlan`/
`assumptionRegistry`) — vinculación de productos + su cumplimiento, comisión de apertura declarada, e
intervalo/fecha de revisión del diferencial. La revisión del diferencial reutiliza tal cual
`rebalanceCalendarReviewStatus()` (`INV17`/`GOB13`, `canonical-portfolio.js`) para "cuántos meses hace
que se revisó", sin escribir un cuarto ayudante de meses. Un fallo real encontrado y corregido solo
por validación manual en navegador (ni la lectura del código ni el test unitario original lo
detectaron): al editar cualquier campo, `renderGob16ClauseWatch()` repintaba todos los `<details>`
desde cero y perdía cuál estaba abierto, cerrándose solo justo después de cada cambio — se corrigió
preservando los ids abiertos antes de repintar (`box.querySelectorAll("details[open]")`), con test
nuevo que lo cubre. Tests: `tests/gob16-vigilancia-clausulas-deuda.test.cjs` (21 tests).

**`GOB18` — Exportar un registro de `GOB10` como paquete de decisión (PDF) para un asesor externo,
alcance reducido.** Diagnóstico previo confirmado: `GOB10` (Oleada 3) ya generaliza el registro de
tesis con revisión programada a cualquier decisión — solo faltaba la capa de exportación, no un
registro nuevo. Nuevo botón "Exportar paquete (PDF)" en cada decisión de Ajustes › Hogar (junto a
"Marcar revisada"/"Quitar"), que reutiliza tal cual el escritor de PDF sin librería externa ya
construido (`P2Export.downloadPlainPdf`, mismo mecanismo que `A19-2`/`V6-4`) y la misma etiqueta de
estado que ya calcula `gob10ReviewStatusLabel` — ningún motor ni dato nuevo, solo reformatea una
decisión ya registrada (descripción, tesis, revisión programada) en un documento de una página, con
el mismo aviso de "no es un documento oficial" que ya llevan el resto de exportaciones para asesor
externo. Tests: `tests/gob18-exportar-paquete-decision.test.cjs` (10 tests).

Cuatro tests preexistentes necesitaron ajuste tras estos dos cambios, sin tocar su cobertura real:
tres usaban una ventana de caracteres fija (`slice(start, start + N)`) para capturar el cuerpo de una
función y dejaron de alcanzar hasta el final tras crecer el código (`tests/d1-d2-deuda-tabs-
contratos.test.cjs`, `tests/deb5-deb6-prioridad-fiscal-y-consolidacion.test.cjs`,
`tests/gob10-registro-decisiones.test.cjs` ×2 asserts) — se ampliaron las ventanas y, en el caso de
`d1-d2`, se añadió el stub que faltaba de `renderGob16ClauseWatch` (mismo patrón que ya usaban los
stubs de `DEB13`/`DEB16` en ese test).

- **Validación**: `npm run verify` completo en verde. `npm test` **4187/4187** pruebas (31 nuevas: 21
  de `GOB16` + 10 de `GOB18`). `test:a11y` **1305 IDs únicos** (antes 1304, sesión 188; +1 por el
  botón nuevo de exportar paquete). `test:performance`: diff 10.000 filas 41,0 ms, forecast y
  escenarios 189,4 ms, recursos 2263 KB, presupuestos a escala (1000 categorías × 10 años) — análisis
  147,5 ms, alertas 97,3 ms, forecast 176,6 ms, histórico de presupuestos 39,7 ms, índice de
  transacciones por categoría 129,2 ms. `build:site`, `test:privacy` y `test:smoke` sin errores.
  Validación manual adicional en navegador real con Playwright: (1) `GOB16` — se dio de alta un
  contrato activo real desde el propio formulario de Contratos, se abrió su `<details>`, se marcó la
  vinculación como no cumplida (el resumen y la nota pasan a avisar), se declaró un intervalo de
  revisión sin fecha previa ("toca revisarlo"), y el estado persistió tras recargar la página; (2)
  `GOB18` — se registró una decisión nueva en Ajustes › Hogar y el botón "Exportar paquete (PDF)"
  disparó la descarga real (`paquete-decision-<fecha>.pdf`); (3) sin errores de consola nuevos en
  ningún caso, tras descartar como artefacto del propio guion de prueba (disparar `change` dos veces
  seguidas sobre el mismo campo) un error que había aparecido en la primera pasada.
- **Publicado**: commit y push a la rama de trabajo en curso, PR en borrador abierto y fusión a
  `main` en cuanto el CI esté en verde, por la autorización de publicación sin preguntar en cada
  tarea ya vigente (`CLAUDE.md`).
- **Pendiente para la siguiente oleada**: con esto el Bloque 7 queda completo salvo las dos apuestas
  grandes ya reservadas a sesión propia (`GOB15`, `GOB19`). Con `GOB14`, `GOB16` y `GOB18` ya
  construidas, `BACKLOG_ULTIMATE_SEPTIEMBRE_OLEADA_4.md` solo deja esas dos tareas accionables.

## Cierre de sesión — 13 de septiembre de 2026 (188): `GOB14`

El usuario pidió seguir con el Bloque 7. Con `GOB13` cerrada, siguiente en la tabla: `GOB14`.

**Diagnóstico previo**: el backlog describía `GOB14` como "informe trimestral exportable,
maquetado para presentar a la familia", distinto de `GOB3` (índice de decisiones de
`PROJECT_STATE.md`, uso interno de desarrollo) y de la exportación de Análisis (`A-11`, vista de
trabajo con cifras técnicas de colchón/desviación/cascada): esta es una vista para enseñar, no para
trabajar, reutilizando "las cifras ejecutivas de procedencia (`A2-6`) ya existentes" — el mismo
contrato `ExecutiveReadModel`/`unifiedActionCenterModel()` que hoy audita `renderE6KpiQuality()` en
Análisis (label/valor/fecha/fuente/método/cobertura/confianza de cada KPI), sin recalcular ningún
dato. El mecanismo de exportación "PDF de una página" ya existe y se reutiliza por tercera vez
(`A-11`/`C-12`/`L-7`): `#cierrePrintEvidence` + `window.print()`.

**Construido**:
- `GOB14` — nueva tarjeta "Informe trimestral para la familia" en Herramientas avanzadas → Datos
  (`#herramientas-datos`), junto al informe PDF certificado (`A19-2`) y los informes de cierre
  archivados. `gob14QuarterlyReportContext()` (`app.js`) reutiliza tal cual
  `unifiedActionCenterModel().readModel` (las seis cifras ejecutivas con procedencia: liquidez,
  capacidad libre, reserva protegida, cobertura hasta el siguiente ingreso, deuda pendiente y fecha
  libre de deuda) y sus hasta tres decisiones prioritarias, sin motor propio. El trimestre en curso
  se calcula con `currentBudgetQuarterKey()`/`budgetLongPeriodRange()` (ya construidos para
  presupuesto anual/trimestral, `BUD-1`). `gob14QuarterlyReportPrintHtml()` maqueta el informe en
  lenguaje llano — valor + fecha + confianza por KPI, la lista de decisiones o "sin decisiones
  prioritarias pendientes", y un aviso agregado si hay cifras de confianza baja (nunca las da por
  buenas en silencio). Botón "Descargar informe trimestral" (`downloadGob14QuarterlyReport`),
  conectado en el mismo bloque de wiring de `#ajustes`/`#herramientas-datos` que ya usa
  `a19CertifiedReportDownload`. Tests: `tests/gob14-informe-trimestral-familia.test.cjs` (15 tests,
  los 15 en verde tras corregir la abreviatura real de "septiembre" que da el `Intl` de este entorno
  — "sept", no "sep" — tomada de la salida real, no supuesta).
- **Validación**: `npm run verify` completo en verde. `npm test` **4156/4156** pruebas (15 nuevas).
  `test:a11y` **1304 IDs únicos** (antes 1303, sesión 187; +1 por el botón nuevo). `test:performance`:
  diff 10.000 filas 30,8 ms, forecast y escenarios 165,5 ms, recursos 2261 KB, presupuestos a escala
  (1000 categorías × 10 años) — análisis 104,9 ms, alertas 69,1 ms, forecast 116,3 ms, histórico de
  presupuestos 27,4 ms, índice de transacciones por categoría 125,0 ms. `build:site`, `test:privacy`
  y `test:smoke` sin errores. Validación manual adicional en navegador real con Playwright: (1) el
  botón aparece en Herramientas avanzadas → Datos; (2) al pulsarlo se genera el informe con los datos
  de ejemplo reales (KPI, fecha, confianza) y se llama a `window.print()`; (3) la clase de impresión
  del `<body>` se añade y se retira correctamente; (4) sin errores de consola nuevos — los tres
  avisos de red observados (CDN de Supabase bloqueado por la sandbox y dos 404) ya existían al cargar
  la página antes de tocar nada, verificado aparte sirviendo la página sola.
  - Nota de entorno: esta sesión partió sin `node_modules/` instalado (contenedor recién
    aprovisionado); se ejecutó `npm install` antes de validar. No es un cambio de dependencias del
    repositorio — `package.json`/`package-lock.json` no se han tocado.
- **Publicado**: commit y push a la rama de trabajo en curso, PR en borrador abierto y fusión a
  `main` en cuanto el CI esté en verde, por la autorización de publicación sin preguntar en cada
  tarea ya vigente (`CLAUDE.md`).
- **Pendiente para la siguiente oleada**: quedan 2 tareas del Bloque 7 (`GOB16`, `GOB18`) y las dos
  apuestas grandes (`GOB15`, `GOB19`, cada una reservada a su propia sesión).

## Cierre de sesión — 13 de septiembre de 2026 (187): `GOB13`

El usuario pidió seguir con el Bloque 7. Con `GOB12` cerrada, siguiente en la tabla: `GOB13`.

**Diagnóstico previo**: el backlog describía `GOB13` como "ritual anual de revisión guiada", que
complementa (no repite) `GOB6` — el checklist MENSUAL de cierre — forzando revisar en un solo sitio,
una vez al año, tres cosas ya construidas y dispersas cada una en su propia pantalla: supuestos
caducados (`PVC15`, `assumptionExpiryAlerts`), ofertas de deuda sin comparar (`DEB14`,
`deb14MarketCheckFreshness`, sesión 184) y desviación de cartera (`INV17`,
`rebalanceCalendarReviewStatus`). Revisando `INV17`: su función de estado ya es completamente
GENÉRICA (fecha de última revisión + intervalo declarado en meses → revisada/pendiente/nunca), sin
nada específico de cartera dentro — perfecta para reutilizar tal cual también para el propio "cuánto
hace que se hizo el ritual anual", en vez de escribir un cuarto ayudante de diferencia de meses en la
misma sesión (ya van tres: `deb12MonthsElapsedSince`, `monthDistance`, y este).

**Construido**:
- `GOB13` — nueva tarjeta "Ritual anual de revisión guiada" en Cierre (`views/cierre.js`, visible
  tanto con el mes abierto como cerrado — es un ritual anual, no del mes en curso), con tres
  funciones de comprobación (`gob13AssumptionExpiryCheck`, `gob13DebtOfferCheck`,
  `gob13PortfolioDeviationCheck`) que reutilizan tal cual los tres motores existentes, sin motor
  propio, y una cuarta (`gob13AnnualReviewStatus`) que reutiliza `rebalanceCalendarReviewStatus`
  (`INV17`, `canonical-portfolio.js`) con un intervalo de 12 meses para trackear el propio ritual —
  mismo patrón visual que el checklist de `GOB6` (clases `deuda-ruta-checklist`/`deuda-ruta-check`).
  Botón "Marcar ritual anual como hecho hoy" (`markGob13AnnualReviewDone`), conectado dentro del
  delegado de clics ya existente de `#cierre` en `app.js` (nunca por referencia directa, misma
  lección de `DEB16` sobre vistas de carga perezosa). Tests:
  `tests/gob13-ritual-anual-revision.test.cjs` (16 tests, los 16 en verde a la primera).
- **Validación**: `npm run verify` completo en verde. `npm test` **4141/4141** pruebas (16 nuevas).
  `test:a11y` **1303 IDs únicos** (antes 1302, sesión 186; +1 por la nota nueva). `test:performance`:
  diff 10.000 filas 47,8 ms, forecast y escenarios 251,8 ms, recursos 2257 KB, presupuestos a escala
  (1000 categorías × 10 años) — análisis 192,7 ms, alertas 131,5 ms, forecast 234,1 ms, histórico de
  presupuestos 48,4 ms, índice de transacciones por categoría 170,1 ms. `build:site`, `test:privacy`
  y `test:smoke` sin errores. Validación manual adicional en navegador real con Playwright: (1) la
  tarjeta pinta los tres chequeos con el estado real de los datos de ejemplo; (2) al pulsar "Marcar
  ritual anual como hecho hoy", el estado cambia a "hace 0 mes(es) (hoy)"; (3) persiste tras
  recargar la página sin volver a marcar; (4) sin errores de consola de la app en ningún caso —
  cuarta tarea seguida sin ningún fallo nuevo, tras aplicar ya de memoria las lecciones de `LEV10`/
  `DEB16`/`GOB12`.
- **Publicado**: commit y push a la rama de trabajo en curso, PR en borrador abierto y fusión a
  `main` en cuanto el CI esté en verde, por la autorización de publicación sin preguntar en cada
  tarea ya vigente (`CLAUDE.md`).
- **Pendiente para la siguiente oleada**: quedan 3 tareas del Bloque 7 (`GOB14`, `GOB16`, `GOB18`) y
  las dos apuestas grandes (`GOB15`, `GOB19`, cada una reservada a su propia sesión).

## Cierre de sesión — 13 de septiembre de 2026 (186): `GOB12`

Con `GOB20` fusionada, `GOB12` ("plantilla reutilizable de evento de vida") quedaba desbloqueada: el
botón de "aplicar a real" de la caída de ingreso ya tenía un motor real donde aterrizar.

**Diagnóstico previo (resumen, ya detallado en la entrada de `GOB20`)**: `ESX2` (Oleada 3) ya
construyó plantillas de eventos de vida con nombre real (Nace un hijo, Mudanza...), pero solo crean
UN evento hipotético a la vez en el Laboratorio de escenarios (E13, de solo lectura). `GOB12` pedía
agrupar en una sola acción tres piezas que hoy exigían tres pasos sueltos: gasto recurrente, posible
caída de ingreso y objetivo de ahorro nuevo. Tres decisiones de alcance se llevaron a la conversación
antes de construir: (1) el objetivo nuevo se crea en `p2State().goals` (E15, con fecha objetivo y
plan de aportación), no en el sistema más simple de sobres; (2) el gasto recurrente y la caída de
ingreso viven primero como simulación en el Laboratorio E13, con un botón explícito para aplicarlos
a real; (3) ese botón de aplicar a real debía cubrir TANTO el gasto como la caída de ingreso, lo que
llevó a construir `GOB20` primero (sesión 185) porque no existía ningún mecanismo real para la
segunda pieza.

**Construido**:
- `GOB12` — nueva tarjeta "Paquete de evento de vida" en Simulación de nueva vida, justo debajo de la
  de `GOB20`. Un desplegable de evento (Nace un hijo / Mudanza / Cambio de trabajo / Otro, mismas
  etiquetas que `ESX2`), campos para el gasto recurrente (siempre) y, opcionales mediante checkbox,
  la caída de ingreso y el objetivo nuevo. Botón "Simular en el Laboratorio" (`gob12SimulatePackage`)
  solo añade eventos a `e13ScenarioEvents` (E13, de solo lectura) — reutiliza tal cual
  `e13EventLabel()`, sin motor propio. Botón "Aplicar a real" (`gob12ApplyPackageToReal`) hace las
  tres cosas de verdad: sube el tope de una categoría de presupuesto EXISTENTE
  (`CanonicalBudgetSchema.upsert`, SUMANDO sobre lo ya declarado, nunca pisándolo) para cada mes del
  rango declarado; declara la caída de ingreso real vía `GOB20`
  (`scenarioSettings.incomeAdjustments`); y crea el objetivo nuevo real e inmediato en
  `p2State().goals` (`window.P2Domain.normalizeGoal`, `saveP2State`) — un objetivo nunca es
  "simulado", a diferencia de las otras dos piezas. Nunca inventa una categoría de presupuesto nueva.
  - **Un fallo real encontrado y corregido, solo por validación manual en navegador (ni la lectura
    del código fuente ni el test unitario lo detectaron, porque el mock del test replicaba
    exactamente el mismo error)**: `window.FinanceCanonicalBudgetSchema` no expone `upsert`/
    `findForCategoryMonth` directamente — expone `{ CanonicalBudgetSchema: { upsert, ... } }`, un
    nivel de anidación más (confirmado por el resto del código, `views/presupuesto-mes.js` y
    `app.js` ya acceden siempre como `window.FinanceCanonicalBudgetSchema?.CanonicalBudgetSchema`).
    El primer intento llamaba directamente sobre `window.FinanceCanonicalBudgetSchema`, y el test
    unitario mockeaba `window.FinanceCanonicalBudgetSchema` con la clase ya desenvuelta —
    reproduciendo el mismo error en el mock y en el código, así que pasaba en verde sin detectar
    nada. Solo Playwright en un navegador real, contra el módulo `canonical-budget-schema.js`
    verdadero, lo hizo saltar (`TypeError: engine.findForCategoryMonth is not a function`).
    Corregido en ambos sitios.
  - Tests: `tests/gob12-paquete-evento-de-vida.test.cjs` (16 tests, usando los módulos canónicos
    reales `canonical-budget-schema.js` y `p2-domain.js`, no dobles).
- **Validación**: `npm run verify` completo en verde. `npm test` **4125/4125** pruebas (16 nuevas).
  `test:a11y` **1302 IDs únicos** (antes 1286, sesión 185; +16, exactamente los 16 campos/botones
  nuevos). `test:performance`: diff 10.000 filas 62,9 ms, forecast y escenarios 252,0 ms, recursos
  2256 KB, presupuestos a escala (1000 categorías × 10 años) — análisis 183,2 ms, alertas 125,0 ms,
  forecast 219,4 ms, histórico de presupuestos 48,3 ms, índice de transacciones por categoría
  171,1 ms. `build:site`, `test:privacy` y `test:smoke` sin errores. Validación manual adicional en
  navegador real con Playwright, sobre el estado REAL de la app (no una simulación): (1) "Simular"
  añade 2 eventos al Laboratorio sin tocar ingreso real ni objetivos; (2) "Aplicar a real" reduce el
  ingreso real exactamente en el importe declarado (5.000 € → 4.600 €), sube el tope de presupuesto
  de la categoría elegida exactamente al importe declarado (250 €), y crea el objetivo real con
  nombre, importe y fecha correctos; (3) las tres piezas persisten tras recargar la página; (4) sin
  errores de consola de la app en ningún caso, tras corregir el fallo descrito arriba.
- **Publicado**: commit y push a la rama de trabajo en curso, PR en borrador abierto y fusión a
  `main` en cuanto el CI esté en verde, por la autorización de publicación sin preguntar en cada
  tarea ya vigente (`CLAUDE.md`).
- **Pendiente para la siguiente oleada**: quedan 4 tareas del Bloque 7 (`GOB13`, `GOB14`, `GOB16`,
  `GOB18`) y las dos apuestas grandes (`GOB15`, `GOB19`, cada una reservada a su propia sesión).

## Cierre de sesión — 13 de septiembre de 2026 (185): `GOB20`

El hogar pidió seguir con el Bloque 7. Al diagnosticar `GOB12` ("plantilla de evento de vida": gasto
recurrente + posible caída temporal de ingreso + objetivo nuevo) apareció una decisión de alcance
real que se llevó a la conversación antes de construir: `GOB12` necesita un botón "aplicar a real"
para la caída de ingreso, pero **no existía ningún mecanismo real** para ello — solo el Laboratorio
de escenarios (E13), explícitamente de solo lectura, y `canonicalEngineInput()` (la única puerta de
entrada del ingreso planificado al motor real) solo leía ingresos históricos/planificados reales,
sin ninguna capa de "ajustes declarados". El hogar confirmó explícitamente construir ese motor ahora,
en vez de aplazarlo — de ahí nace `GOB20`, documentado en el backlog como spin-off directo de
`GOB12` en el momento de tomar la decisión.

**Diagnóstico previo**: `canonical-engine.js` lee `month.income` como `baseIncome` — un único punto
de entrada. Cualquier ajuste declarado que se aplique justo ahí, en `canonicalEngineInput()` (`app.js`),
se propaga solo a todo lo que ya depende del forecast base (PV1-PV5, GOB9, GOB11, Presupuesto...) sin
tocar ningún otro motor. La memoización de `recomputeModelIfNeeded()` (`modelComputationSignature()`)
debía incluir el nuevo campo declarado, o un ajuste recién declarado se quedaría sin efecto hasta el
siguiente recálculo por otro motivo — mismo riesgo que ya avisaban `operatingReserve`/
`autoAdjustForecastBias` en ese mismo objeto.

**Construido**:
- `GOB20` — `scenarioSettings.incomeAdjustments` (array declarado, mismo patrón de persistencia que
  `ap1TrackedComparison`/`e14Debt.offers`: se muta directamente y se propaga solo por el spread de
  `saveScenarioSettings()`). Nueva `gob20IncomeAdjustmentForMonth(adjustments, monthKey)` (`app.js`)
  sub-total de todas las caídas activas ese mes (varias se suman si solapan). `canonicalEngineInput()`
  resta ese total del ingreso de cada mes antes de construirlo — con el array vacío (comportamiento
  por defecto) el resultado es idéntico byte a byte al de antes de esta tarea, verificado por toda la
  suite existente (miles de tests que ya ejercitan `computeCanonicalScenario`/`canonicalEngineInput`
  sin declarar ningún ajuste, todos siguen en verde). Nueva tarjeta "Caída de ingreso declarada — se
  aplica a la previsión real" en Simulación de nueva vida, justo debajo (y explícitamente contrastada
  con) el constructor de eventos del Laboratorio de escenarios (E13) de solo lectura. Tests:
  `tests/gob20-ajuste-real-ingreso.test.cjs` (17 tests).
- **Validación**: `npm run verify` completo en verde. `npm test` **4109/4109** pruebas (17 nuevas).
  `test:a11y` **1286 IDs únicos** (antes 1279, sesión 184; +7 por los cuatro campos, el botón, el
  estado y la lista nuevos). `test:performance`: diff 10.000 filas 44,0 ms, forecast y escenarios
  252,4 ms, recursos 2250 KB, presupuestos a escala (1000 categorías × 10 años) — análisis 192,7 ms,
  alertas 124,2 ms, forecast 220,5 ms, histórico de presupuestos 47,7 ms, índice de transacciones por
  categoría 167,4 ms. `build:site`, `test:privacy` y `test:smoke` sin errores. Validación manual
  adicional en navegador real con Playwright, sobre el forecast REAL (`lastBaseSimulation`, no una
  simulación): (1) ingreso del primer mes antes de declarar nada, 5.000 €; (2) tras declarar una
  caída de 600 €/mes durante 3 meses desde ese mismo mes, el ingreso real baja a 4.400 € — exactos;
  (3) al quitar el ajuste, vuelve a 5.000 €; (4) declarando un segundo ajuste (300 €/2 meses) y
  recargando la página SIN quitarlo, la reducción de 300 € sigue aplicada tras recargar; (5) sin
  errores de consola de la app en ningún caso.
- **Publicado**: commit y push a la rama de trabajo en curso, PR en borrador abierto y fusión a
  `main` en cuanto el CI esté en verde, por la autorización de publicación sin preguntar en cada
  tarea ya vigente (`CLAUDE.md`).
- **Pendiente para la siguiente oleada**: `GOB12` (ahora desbloqueada: el botón de aplicar a real
  para la caída de ingreso ya tiene motor real donde aterrizar), `GOB13`, `GOB14`, `GOB16`, `GOB18`
  del Bloque 7, y las dos apuestas grandes (`GOB15`, `GOB19`, cada una reservada a su propia sesión).

## Cierre de sesión — 13 de septiembre de 2026 (184): `DEB14`

El usuario pidió seguir con `DEB14` para cerrar del todo el Bloque 6 (deuda según liquidez) tras
`DEB16`.

**Diagnóstico previo**: el backlog ya marcaba `DEB14` con alcance reducido desde antes de esta oleada
de sesiones: "llevas N meses sin comparar tu hipoteca contra una oferta de mercado registrada",
distinta de `DEB4` (Oleada 3) porque esa avisa cuando el punto de equilibrio de los PROPIOS escenarios
de tipos declarados por el hogar cruza un umbral ("tu cálculo cambió") — nunca consulta si de verdad
se ha mirado el mercado. `DEB14` usa en su lugar el registro de ofertas externas de Deuda › Ruta
(`normalizeOffer`, `canonical-e14-operations.js`, `E14`), que `DEB4` no consulta. Revisando el modelo
de `DEB4`: sus campos de hipoteca (`principal`, `variableRate`, `fixedRate`...) son un dato
completamente independiente, sin vínculo con ningún contrato real de Deuda › Contratos — así que
`DEB14` no podía apoyarse en ese modelo. En su lugar, se apoya en un campo que SÍ es declarado por el
hogar en cada contrato personalizado: `type` (texto libre, igual que `entity`/`number`) — un contrato
cuyo `type` contenga "hipoteca" es la hipoteca del hogar a efectos de esta alerta, sin inventar
ninguna heurística de detección automática.

**Construido**:
- `DEB14` — nueva tarjeta en Deuda y apalancamiento, justo debajo del radar de `DEB4`: un campo de
  umbral declarado (`#deb14MaxMonthsWithoutOffer`, meses) y `deb14MarketCheckAlertHtml()` (`app.js`),
  que cruza `debtContractSourceRows()` (filtrado por `type` conteniendo "hipoteca", activo) con
  `e14bWorkspace().offers` (filtrado por `contractId`) para calcular los meses reales transcurridos
  desde la oferta MÁS RECIENTE registrada para esa deuda (`monthDistance`/`dateFromMonthKey`, ya
  existentes) — sin motor nuevo. Si nunca se ha registrado ninguna oferta para esa hipoteca, lo dice
  explícitamente en vez de inventar un número de meses. Sin umbral declarado, no se calcula nada
  (mismo criterio "declarado, nunca inventado" que `DEB4` con `maxBreakEvenMonths`).
  - **Lecciones de `DEB16` aplicadas desde el principio esta vez, sin repetir ninguno de sus dos
    fallos**: (1) `handleDeb14MaxMonthsChange` vive en `app.js` (no en `views/deuda.js`), así que su
    listener se registra por referencia directa sin riesgo de `ReferenceError` por carga perezosa;
    (2) `deb14MaxMonthsWithoutOffer` se añadió a la lista explícita y cerrada de campos de
    `saveScenarioSettings()` desde el primer commit, verificado con Playwright que sobrevive a
    recargar la página.
  - Tests: `tests/deb14-cuanto-hace-que-miraste-mercado.test.cjs` (18 tests, los 18 en verde a la
    primera) — no repite la cobertura de `normalizeOffer`, ya cubierta en
    `tests/canonical-e14-operations.test.cjs`.
- **Con esto el Bloque 6 (deuda según liquidez) queda completo.**
- **Validación**: `npm run verify` completo en verde. `npm test` **4092/4092** pruebas (18 nuevas de
  `DEB14`, más un ajuste en `tests/gob7-modo-sesion-asesor.test.cjs`: la ventana de adyacencia sobre
  `saveScenarioSettings()` creció de 1200 a 1600 caracteres, mismo patrón de crecimiento que ya
  documentaba desde `DEB11`/`DEB16`). `test:a11y` **1279 IDs únicos** (antes 1277, sesión 183; +2 por
  el campo y su nota nuevos). `test:performance`: diff 10.000 filas 39,6 ms, forecast y escenarios
  204,0 ms, recursos 2245 KB, presupuestos a escala (1000 categorías × 10 años) — análisis 147,8 ms,
  alertas 96,8 ms, forecast 176,1 ms, histórico de presupuestos 38,1 ms, índice de transacciones por
  categoría 140,3 ms. `build:site`, `test:privacy` y `test:smoke` sin errores. Validación manual
  adicional en navegador real con Playwright: (1) confirmó que el arranque no se rompe; (2) sin
  umbral declarado, la tarjeta no muestra nada; (3) con una hipoteca personalizada declarada y una
  oferta antigua registrada, avisa correctamente con los meses reales y la fecha de la última oferta;
  (4) con una oferta reciente, muestra el mensaje positivo de estar dentro del umbral; (5) el umbral
  declarado persiste tras recargar; (6) sin errores de consola de la app en ningún caso.
- **Publicado**: commit y push a la rama de trabajo en curso, PR en borrador abierto y fusión a
  `main` en cuanto el CI esté en verde, por la autorización de publicación sin preguntar en cada
  tarea ya vigente (`CLAUDE.md`).
- **Pendiente para la siguiente oleada**: quedan 7 tareas accionables — las dos apuestas grandes
  (`GOB15`, `GOB19`, cada una reservada a su propia sesión) y el Bloque 7 completo (`GOB12`-`14`/
  `16`/`18`).

## Cierre de sesión — 13 de septiembre de 2026 (183): `DEB16`

El usuario pidió seguir con `DEB16` para cerrar el Bloque 6 (deuda según liquidez) tras `DEB12`.

**Diagnóstico previo**: el backlog describía `DEB16` como "avalancha vs. bola de nieve, como
preferencia declarada para el orden entre varias deudas", distinguiéndola explícitamente de `DEB7`
(preferencia agregada coste-mínimo vs. libre-de-deudas sobre el veredicto de UNA deuda en `AP1`): aquí
la pregunta es el ORDEN entre VARIAS deudas simultáneas. Revisando `DEB5`
(`fiscalAdjustedDebtPriority()`, `canonical-debt-contracts.js`): ya ordena TODAS las deudas activas
por TAE efectivo tras deducción fiscal — exactamente la lógica de "avalancha" (mayor coste real
primero) de los métodos clásicos de repago — pero nunca pregunta si el hogar prefiere en su lugar
"bola de nieve" (empezar por la de menor capital pendiente, para ir cerrando deudas antes y ganar
impulso psicológico). `simulateDebtConsolidation` (`DEB6`) da el coste de consolidar, nunca este
orden. El hueco era una reordenación declarable de un dato ya calculado, no un motor nuevo.

**Construido**:
- `DEB16` — nueva tarjeta en Deuda › Contratos, justo debajo de la de `DEB5`: un desplegable
  (`#deb16PayoffStrategySelect`, "avalancha" por defecto — mismo criterio de valor por defecto que
  `DEB7` con "coste-mínimo", porque es el que la app ya mostraba antes de esta tarea) y una lista
  ordenada (`deb16PayoffOrderHtml()`, `views/deuda.js`) que reutiliza tal cual las mismas filas ya
  calculadas por `fiscalAdjustedDebtPriority()` — sin filtro ni motor propio — y solo las reordena:
  por TAE efectivo descendente para avalancha, por capital pendiente ascendente para bola de nieve.
  Nunca decide cuál de las dos "es mejor": ambas son igual de válidas.
  - **Dos fallos reales encontrados y corregidos durante la construcción, ninguno detectado por
    `npm test` hasta escribir los tests que los cubren, y el segundo solo por validación manual en
    navegador**:
    1. El listener del nuevo desplegable se registró inicialmente como referencia directa
       (`addEventListener("change", handleDeb16PayoffStrategyChange)`) en el bloque de arranque de
       `app.js` — pero `handleDeb16PayoffStrategyChange` vive en `views/deuda.js`, cargado de forma
       perezosa DESPUÉS de que ese bloque se ejecute. Resultado: `ReferenceError` inmediato que
       reventaba el arranque completo de la app ("No se pudo cargar la app"), detectado solo al
       abrir la app en un navegador real, no por la suite de tests. Corregido envolviendo la llamada
       en una función anónima (`() => handleDeb16PayoffStrategyChange()`), mismo patrón que ya usa
       `handleDeudaCompararReserveInput` para el mismo problema.
    2. La preferencia declarada (`state.deb16PayoffStrategy`) se guardaba en memoria pero no
       sobrevivía a recargar la página: `saveScenarioSettings()` no serializa `state` genéricamente,
       sino una lista explícita y cerrada de campos (el propio código ya documenta el mismo fallo
       histórico para `SP3`/`FC4`) — faltaba añadir `deb16PayoffStrategy` a esa lista. Corregido y
       cubierto con un test de wiring dedicado para que no vuelva a pasar desapercibido.
  - Tests: `tests/deb16-avalancha-vs-bola-de-nieve.test.cjs` (14 tests, incluido un caso que
    demuestra que avalancha y bola de nieve divergen de verdad cuando la deuda más cara no es la más
    pequeña) — no repite la cobertura de `fiscalAdjustedDebtPriority()`, ya cubierta en
    `tests/deb5-deb6-prioridad-fiscal-y-consolidacion.test.cjs`.
- **Con esto el Bloque 6 (deuda según liquidez) queda completo** salvo `DEB14` (alcance ya reducido,
  marcado como tal desde antes de esta oleada de sesiones).
- **Validación**: `npm run verify` completo en verde. `npm test` **4074/4074** pruebas (14 nuevas de
  `DEB16`, más 2 tests preexistentes ajustados: la ventana de `tests/gob7-modo-sesion-asesor.test.cjs`
  que verifica la adyacencia en `saveScenarioSettings()` creció de 900 a 1200 caracteres, mismo
  patrón de crecimiento que ya documentaba desde `DEB11`; y un stub nuevo para
  `renderDeb16PayoffOrder` en `tests/d1-d2-deuda-tabs-contratos.test.cjs`, mismo patrón que los stubs
  ya existentes de DEB5/DEB13). `test:a11y` **1277 IDs únicos** (antes 1275, sesión 182; +2 por el
  desplegable y su nota de resultado nuevos). `test:performance`: diff 10.000 filas 38,0 ms, forecast
  y escenarios 191,8 ms, recursos 2241 KB, presupuestos a escala (1000 categorías × 10 años) —
  análisis 149,4 ms, alertas 96,3 ms, forecast 180,1 ms, histórico de presupuestos 33,1 ms, índice de
  transacciones por categoría 129,1 ms. `build:site`, `test:privacy` y `test:smoke` sin errores.
  Validación manual adicional en navegador real con Playwright: (1) confirmó el fallo de arranque
  del punto 1 y su corrección; (2) confirmó el fallo de persistencia del punto 2 y su corrección,
  incluida la persistencia tras recargar; (3) sin errores de consola de la app en ningún caso.
- **Publicado**: commit y push a la rama de trabajo en curso, PR en borrador abierto y fusión a
  `main` en cuanto el CI esté en verde, por la autorización de publicación sin preguntar en cada
  tarea ya vigente (`CLAUDE.md`).
- **Pendiente para la siguiente oleada**: quedan 8 tareas accionables — las dos apuestas grandes
  (`GOB15`, `GOB19`, cada una reservada a su propia sesión), `DEB14` (alcance ya reducido, Bloque 6)
  y el Bloque 7 completo (`GOB12`-`14`/`16`/`18`).

## Cierre de sesión — 13 de septiembre de 2026 (182): `DEB12`

El usuario pidió seguir con `DEB12` para arrancar el Bloque 6 (deuda según liquidez) tras cerrar el
Bloque 5 con `LEV16`.

**Diagnóstico previo**: el backlog describía `DEB12` como "el precio de esperar (`waitingOptionValue`)
como serie temporal, no cifra congelada", indicando reutilizar el patrón de "comparación trackeada"
que `DEB1` ya usa para el veredicto de `AP1`, aplicado ahora a `DEB3`. Revisando `DEB3`
(`waitingOptionValue()`, `canonical-debt-comparator.js`): calcula el interés no evitado por esperar
`N` meses declarados, pero esa cifra se computa una única vez, al pulsar «Comparar», y la nota se
queda fija con ese resultado para siempre — si el hogar no vuelve a rellenar el formulario, no hay
forma de saber cuánto de esa espera ya se ha "pagado" de verdad a medida que pasa el tiempo real.
Revisando `DEB1` (`ap1TrackedComparison`/`deb1RecomputeTrackedAssessment`/`deb1VerdictChangeHtml`):
el patrón exacto es guardar la comparación tal y como se miró (con su fecha, `evaluatedAt`) y, en
cada render, recalcularla contra la realidad viva — en `DEB1` esa realidad es el principal real de
la deuda y la XIRR real de la cartera; en `DEB3` la realidad viva equivalente es el propio
calendario: los meses que de verdad han pasado desde que se declaró la espera.

**Construido**:
- `DEB12` — `scenarioSettings.deb3TrackedWait` guarda `{amount, debtAnnualRatePct, waitMonths,
  monthlyOutflow, evaluatedAt}` cada vez que `renderDeb3OptionValue()` produce un resultado
  calculable (mismo momento en que `DEB1` guarda su propio snapshot, dentro del mismo flujo de
  «Comparar»). Nueva `deb12MonthsElapsedSince(isoDate, nowDate)` (`app.js`) — mismo criterio
  año/mes sin días que ya usa `gob11MonthsToRetirement`, aquí hacia atrás — y nueva
  `deb12WaitingCostSoFarHtml(tracked, nowDate)`, función pura que recalcula `waitingOptionValue()`
  (sin motor nuevo) con los meses REALES transcurridos desde `evaluatedAt` (nunca más que los
  declarados) para mostrar cuánto ha costado la espera hasta hoy, no solo el total previsto para el
  final del plazo. Si ya se cumplió el plazo declarado, lo dice explícitamente e invita a volver a
  comparar para trackear un nuevo periodo, en vez de seguir acumulando en silencio más allá de lo
  declarado. Se muestra en Deuda → Apalancamiento, justo debajo de la nota de `DEB3`
  (`#deb12WaitingCostSoFarNote`). Misma lección de `LEV10` aplicada desde el principio: el
  repintado de vista-completa va en `renderDeudaApalancamiento()` (`views/deuda.js`), no en
  `renderAjustes()` (`app.js`) — verificado con Playwright que, tras recargar la página con el reloj
  de `evaluatedAt` adelantado 2 meses (sin volver a pulsar «Comparar»), la nota nueva aparece sola
  con el coste acumulado correcto (100 € de los 300 € totales para un ejemplo de 10.000 € al 6% TIN
  a 6 meses declarados). Tests: `tests/deb12-precio-esperar-serie-temporal.test.cjs` (11 tests) — no
  repite la cobertura de `waitingOptionValue()` en sí, ya cubierta en
  `tests/deb3-opcionalidad-esperar.test.cjs`.
- **Validación**: `npm run verify` completo en verde. `npm test` **4061/4061** pruebas (11 nuevas de
  `DEB12`). `test:a11y` **1275 IDs únicos** (antes 1274, sesión 181; +1 por la nota de resultado
  nueva). `test:performance`: diff 10.000 filas 30,2 ms, forecast y escenarios 154,4 ms, recursos
  2240 KB, presupuestos a escala (1000 categorías × 10 años) — análisis 108,4 ms, alertas 69,6 ms,
  forecast 131,1 ms, histórico de presupuestos 27,9 ms, índice de transacciones por categoría
  86,7 ms. `build:site`, `test:privacy` y `test:smoke` sin errores. Validación manual adicional en
  navegador real con Playwright confirmó las cuatro fases: (1) sin comparación trackeada, la nota
  nueva está vacía; (2) tras pulsar «Comparar», `DEB3` muestra su nota habitual y el snapshot queda
  guardado con su fecha; (3) adelantando el reloj de `evaluatedAt` 2 meses y recargando sin tocar el
  formulario, la nota de `DEB12` aparece sola con el coste acumulado real; sin errores de consola de
  la app en ningún caso (el único fallo de red observado fue una CDN externa, `supabase-js`, bloqueada
  por el entorno de sandbox — ajeno a este cambio).
- **Publicado**: commit y push a la rama de trabajo en curso, PR en borrador abierto y fusión a
  `main` en cuanto el CI esté en verde, por la autorización de publicación sin preguntar en cada
  tarea ya vigente (`CLAUDE.md`).
- **Pendiente para la siguiente oleada**: quedan 9 tareas accionables — las dos apuestas grandes
  (`GOB15`, `GOB19`, cada una reservada a su propia sesión), el resto del Bloque 6 (`DEB14`/`16`) y
  el Bloque 7 completo (`GOB12`-`14`/`16`/`18`).

## Cierre de sesión — 13 de septiembre de 2026 (181): `LEV16`

El usuario pidió seguir con `LEV16` para cerrar el Bloque 5 (apalancamiento) tras `LEV10`.

**Diagnóstico previo**: el backlog describía `LEV16` como "el coste de oportunidad de NO
apalancarse, simétrico al riesgo de apalancarse", señalando que "todo el módulo enmarca la pregunta
solo desde el riesgo de apalancarse; falta el lado simétrico de mantener liquidez ociosa sin invertir
ni apalancar". Revisando el módulo completo (AP4 guardarraíl, LEV1 política, AP3 con sus tres
escenarios de rentabilidad, LEV5/LEV11/LEV12/LEV13 de riesgo), en efecto todo habla del riesgo de
tomar deuda para invertir, nunca del coste de la alternativa prudente. Buscando si ya existía el dato
antes de construir nada nuevo, apareció `cp2IdleCashSummary()` (`app.js`, sesión de la tarea `CP2`,
"dinero parado"): liquidez por encima del colchón que ni protege nada ni está invertida, con su coste
de oportunidad ya calculado a la XIRR real de la cartera (`opportunityCost`, IV5) — pero sin ninguna
tarjeta visible en ningún sitio (solo alimentaba `TT2`, la escalera de vencimientos, y el catálogo de
métricas del asistente ejecutivo). El hueco no era de cálculo, era de visibilidad en el contexto
correcto: nadie había puesto ese dato ya calculado junto a las herramientas de riesgo de apalancarse,
que es justo donde importa para leer la decisión con las dos caras.

**Construido**:
- `LEV16` — nueva `lev16IdleLiquidityCostHtml(idleSummary)` (`app.js`), función pura que recibe el
  resultado ya calculado de `cp2IdleCashSummary()` (mismo patrón que `ap3ResultHtml(result)`) y lo
  muestra en Deuda → Apalancamiento, justo debajo de la curva de coste marginal (`LEV10`): cuánto
  cuesta mantener la liquidez sobrante parada 12 meses más, a la rentabilidad real de la cartera.
  Sin motor nuevo, sin campos que declarar — se deriva de datos ya existentes (colchón, cuentas, XIRR
  real). Misma lección de `LEV10` aplicada desde el principio esta vez: la llamada de repintado va en
  `renderDeudaApalancamiento()` (`views/deuda.js`), no en `renderAjustes()` (`app.js`) — "Deuda y
  apalancamiento" es una vista cargada de forma perezosa con su propio punto de entrada. Verificado
  con Playwright que el repintado ocurre correctamente al entrar en la vista, sin ese bug. Tests:
  `tests/lev16-coste-no-apalancarse.test.cjs` (8 tests) — no repite la cobertura de
  `cp2IdleCashSummary()` (ya cubierta en `tests/cp2-dinero-parado.test.cjs`), solo prueba la función
  de presentación nueva con resultados simulados.
- **Con esto el Bloque 5 (apalancamiento) queda completo**: `LEV9` (Bloque 2, bandera),
  `LEV10`-`LEV16` construidas todas.
- **Validación**: `npm run verify` completo en verde. `npm test` **4050/4050** pruebas (8 nuevas de
  `LEV16`). `test:a11y` **1274 IDs únicos** (antes 1273, sesión 180; +1 por la nota de resultado
  nueva). `test:performance`: diff 10.000 filas 30,2 ms, forecast y escenarios 157,1 ms, recursos
  2237 KB, presupuestos a escala (1000 categorías × 10 años) — análisis 126,9 ms, alertas 63,9 ms,
  forecast 123,5 ms, histórico de presupuestos 33,8 ms, índice de transacciones por categoría
  89,6 ms. `build:site`, `test:privacy` y `test:smoke` sin errores. Validación manual adicional en
  navegador real con Playwright: (1) sin posiciones de cartera declaradas, la nota dice
  explícitamente que falta el XIRR real, nunca inventa una rentabilidad; (2) con una posición de
  cartera declarada, la nota muestra el importe de liquidez ociosa, la rentabilidad real y el coste
  de oportunidad correctos; sin errores de consola en ningún caso.
- **Publicado**: commit y push a la rama de trabajo en curso, PR en borrador abierto y fusión a
  `main` en cuanto el CI esté en verde, por la autorización de publicación sin preguntar en cada
  tarea ya vigente (`CLAUDE.md`).
- **Pendiente para la siguiente oleada**: quedan 10 tareas accionables — las dos apuestas grandes
  restantes (`GOB15`, `GOB19`, cada una reservada a su propia sesión) y el resto de los Bloques 6-7:
  `DEB12`/`14`/`16` (Bloque 6), `GOB12`-`14`/`16`/`18` (Bloque 7).

## Cierre de sesión — 12 de septiembre de 2026 (180): `LEV10`

El usuario pidió seguir con `LEV10` (Bloque 5, apalancamiento), la primera tarea del resto de los
Bloques 5-7 tras cerrar `GOB11`.

**Diagnóstico previo**: el backlog describía `LEV10` como una curva de coste marginal de deuda por
tramo, con la nota "tramos declarados por el hogar según ofertas reales de su banco, no una curva de
mercado inventada". Revisando el código, `simulateLeverage()` (AP3, `canonical-leverage-simulator.js`)
solo admite un tipo único (`ap3DebtRate`/`newDebtAnnualRatePercent`) aplicado a todo el importe, como
si el banco cobrara siempre el mismo tipo diera igual cuánto se pida — hueco real, muchas ofertas de
banco son progresivas por tramo (p. ej. hasta 20.000€ al 3%, el resto al 4,5%). Buscando un primitivo
genérico ya construido para "aplicar un tipo distinto a cada porción de un importe" (para no inventar
una escala nueva), apareció `progressiveTax(taxableBase, brackets)` en `canonical-irpf-estimator.js`
(A15-2) — el mismo motor de tramos progresivos que ya usan `optimizePartialSale` (FC5/INV18) y
`marginalTaxOnAdditionalIncome` (FCX1/INV18), con `brackets` como `{limit, rate}` — exactamente la
forma que necesita una curva de coste de deuda por tramo. Decisión de diseño explícita: no se
reutiliza `validateBracketScale()` del mismo motor, porque exige una fuente pública citable
(autoridad, URL, fecha de comprobación) pensada para tablas fiscales oficiales — una oferta de banco
es un dato declarado por el hogar, no una fuente pública, así que `LEV10` valida solo que los tramos
sean coherentes (límites crecientes, el último abierto, tipos entre 0-100%) sin exigir esa cita.

**Construido**:
- `LEV10` — nueva `lev10DebtMarginalCostCurve()` (`app.js`) reutiliza `progressiveTax()` (A15-2) para
  sumar el coste anual por tramo dado un importe, y calcula además el tipo medio (blended) y el tipo
  marginal (el tipo del tramo en el que cae el último euro pedido). Reutiliza el importe ya declarado
  arriba en el simulador de apalancamiento (`ap3DebtAmount`, AP3), sin duplicarlo — mismo criterio que
  ya aplicó `LEV14`. Tres campos nuevos declarables (tramo 1: hasta €/tipo; tramo 2 opcional: hasta
  €/tipo; tramo 3, resto sin límite: tipo), persistidos cada uno por separado (mismo criterio que
  `PVC14`/`GOB11`). Se muestra justo debajo del apalancamiento escalonado (`LEV14`) en Deuda →
  Apalancamiento, y se actualiza solo (sin botón) en cuanto cambia un tramo o el importe de AP3 —
  nunca rellena el tipo de AP3 por su cuenta, solo informa. Solo calculable con al menos dos tramos
  declarados (con uno solo sería el mismo simulador de tipo único de arriba).
  **Bug real detectado y corregido antes de publicar**: la primera versión repintaba los campos desde
  `renderAjustes()` (`app.js`), asumiendo que esa función es el lote de renderizado universal de la
  app — igual que `GOB11`/`LPX1`, que sí viven ahí. Pero "Deuda y apalancamiento" es una vista cargada
  de forma perezosa (`views/deuda.js`, `OPT-24`) con su propio punto de entrada,
  `renderDeudaApalancamiento()`, que NO pasa por `renderAjustes()`: los tramos se guardaban
  correctamente (confirmado leyendo `localStorage` con Playwright) pero no se repintaban en los
  campos al recargar la página o al volver a la vista — se detectó en la validación manual de esta
  misma tarea, nunca habría aparecido en `npm test` (que no ejecuta un navegador real). Corregido
  moviendo la llamada a `renderLev10DebtCostCurve()` a `renderDeudaApalancamiento()`. Tests:
  `tests/lev10-curva-coste-marginal-deuda.test.cjs` (19 tests, incluida la prueba de regresión de
  esta llamada de repintado en la vista correcta).
- **Validación**: `npm run verify` completo en verde. `npm test` **4042/4042** pruebas (19 nuevas de
  `LEV10`). `test:a11y` **1273 IDs únicos** (antes 1267, sesión 179; +6 por los cinco campos
  declarables más la nota de resultado). `test:performance`: diff 10.000 filas 40,9 ms, forecast y
  escenarios 194,1 ms, recursos 2235 KB, presupuestos a escala (1000 categorías × 10 años) — análisis
  148,5 ms, alertas 95,2 ms, forecast 173,7 ms, histórico de presupuestos 32,1 ms, índice de
  transacciones por categoría 126,1 ms. `build:site`, `test:privacy` y `test:smoke` sin errores.
  Validación manual adicional en navegador real con Playwright: (1) con dos tramos declarados
  (hasta 20.000€ al 3%, resto al 4,5%) y 30.000€ en «Deuda nueva a simular» (AP3), la nota muestra
  coste anual combinado 1.050€, tipo medio 3,5% y tipo marginal 4,5%, con el desglose por tramo
  correcto; (2) declarar los tramos uno a uno, tabulando entre ellos, y recargar la página — aquí es
  donde se detectó el bug de repintado descrito arriba, antes de corregirlo los campos se vaciaban en
  el DOM aunque `localStorage` sí conservaba el dato; después de corregirlo, sobreviven correctamente;
  sin errores de consola relacionados con el código nuevo en ningún caso.
- **Publicado**: commit y push a la rama de trabajo en curso, PR en borrador abierto y fusión a
  `main` en cuanto el CI esté en verde, por la autorización de publicación sin preguntar en cada
  tarea ya vigente (`CLAUDE.md`).
- **Pendiente para la siguiente oleada**: quedan 11 tareas accionables — las dos apuestas grandes
  restantes (`GOB15`, `GOB19`, cada una reservada a su propia sesión) y el resto de los Bloques 5-7:
  `LEV16` (Bloque 5), `DEB12`/`14`/`16` (Bloque 6), `GOB12`-`14`/`16`/`18` (Bloque 7).

## Cierre de sesión — 12 de septiembre de 2026 (179): `GOB11`

El usuario pidió seguir con la segunda de las tres apuestas grandes restantes de la oleada, `GOB11`
(tras `INV11`, `INV18` y `PVC14` en las tres sesiones anteriores). Plan presentado y confirmado por
el usuario antes de tocar código.

**Diagnóstico previo**: el backlog describía `GOB11` como una proyección de jubilación que cruza
pensión + cartera + previsión + objetivos, y decía explícitamente que dependía en la práctica de
`INV11` para dar una trayectoria real. Revisando el código, ninguna pieza existente proyecta
patrimonio a años vista: `canonical-e13-scenarios.js`/`canonical-forecast.js` (E13) trabajan mes a
mes sobre la caja corriente, `canonical-e15-goals.js` (E15) calcula aportación mensual requerida a
horizonte de meses (pensado para metas cercanas, no para décadas de crecimiento compuesto), y
`financialIndependenceTarget()` (`LPX1`, `canonical-assets.js`) da un capital objetivo sin fecha ni
proyección de crecimiento. El hueco era real, no un simple recableado — hacía falta una pieza nueva
que compusiera capital actual × tasa de crecimiento anual × años hasta la jubilación × aportación
futura, y la comparara contra un objetivo con fecha.

Antes de construir, se plantearon al usuario cuatro decisiones de alcance, todas confirmadas: (1) las
tasas de crecimiento (cartera y plan de pensiones, pueden ser distintas) las declara el hogar, nunca
un valor de mercado asumido; (2) la pensión pública (Seguridad Social) entra como dato manual
declarado, ya que la app no tiene ningún estimador propio; (3) la fecha de jubilación es un campo
declarado propio, no un objetivo de `E15` (mezclarlo habría arrastrado `contributionPlan()`, pensado
para metas de meses, a un horizonte de décadas para el que no está pensado); (4) la tarjeta puede ser
directiva (decisión de sesión 177: "a este ritmo llegas con un déficit/superávit de X€"), declarando
siempre los supuestos usados.

**Construido**:
- `GOB11` — proyección de jubilación unificada. Nueva `gob11RetirementProjection()` (`app.js`, cruza
  varios motores sin que ninguno dependa de otro, mismo patrón que `INV18`/`GOB8`) compone el valor
  actual de cartera y plan de pensiones (`canonical-portfolio.js`, vía `normalizePositions().summary.
  totalsByType["plan-pension"]`), una tasa de crecimiento anual declarada para cada una (fórmula de
  anualidad estándar, conversión a tasa mensual compuesta — nunca una simulación de mercado), la
  aportación mensual futura declarada a cada una, y los compara a la fecha de jubilación declarada
  contra un objetivo de independencia financiera (gasto medio de la previsión viva × inflación
  declarada hasta esa fecha, menos la pensión pública declarada si la hay, entre la tasa de retirada
  declarada). Sin alguno de los datos necesarios para el cálculo, `calculable: false` y `missing`
  dice exactamente qué falta — nunca una cifra de mercado inventada en su lugar. Devuelve además una
  trayectoria año a año (cartera, pensión, total) hasta la jubilación, mostrada en tabla.
  Decisión de alcance explícita, mismo criterio que `INV11` ya fijó: la pensión que cuenta aquí es la
  declarada como posición de cartera (`plan-pension`), nunca el saldo estático "Pensión" de `A14` —
  no se unifican ambas fuentes; sin ninguna posición `plan-pension` registrada, la pensión privada
  proyectada es 0€, con aviso explícito en la tarjeta. Siete campos nuevos declarables en
  Patrimonio e inversión (`gob11RetirementMonth`, `gob11PortfolioGrowthPct`, `gob11PensionGrowthPct`,
  `gob11MonthlyContributionPortfolio`, `gob11MonthlyContributionPension`, `gob11StatePensionMonthly`,
  `gob11WithdrawalRatePct`), cada uno persistido por separado (nunca agrupado — mismo criterio que
  `PVC14` ya fijó tras su propio bug de guardado agrupado; verificado en esta tarea con Playwright que
  declarar dos de los siete campos, uno a uno, sobrevive a recargar la página sin borrar ninguno).
  Tarjeta nueva justo después del panel de resiliencia (`GOB9`) en Patrimonio e inversión. Tests:
  `tests/gob11-proyeccion-jubilacion-unificada.test.cjs` (23 tests).
- **Validación**: `npm install` de nuevo necesario al empezar la sesión (`node_modules` no existía).
  `npm run verify` completo en verde. `npm test` **4023/4023** pruebas (23 nuevas de `GOB11`).
  `test:a11y` **1267 IDs únicos** (antes 1258, sesión 178; +9 por los siete campos declarables más
  las dos notas de resultado). `test:performance`: diff 10.000 filas 32,5 ms, forecast y escenarios
  168,6 ms, recursos 2228 KB, presupuestos a escala (1000 categorías × 10 años) — análisis 104,6 ms,
  alertas 65,3 ms, forecast 131,6 ms, histórico de presupuestos 41,0 ms, índice de transacciones por
  categoría 84,0 ms. `build:site`, `test:privacy` y `test:smoke` sin errores. Validación manual
  adicional en navegador real con Playwright: (1) con una posición `fondo` y otra `plan-pension`
  declaradas y los siete campos rellenados, la tarjeta muestra la proyección, el objetivo, el
  veredicto directivo (déficit/superávit) y una tabla de 20 filas (una por año) coherente con la
  fecha declarada; (2) declarar solo dos de los siete campos, uno a uno con tabulación entre ellos,
  sobrevive a recargar la página sin que ninguno se borre; sin errores de consola relacionados con el
  código nuevo en ningún caso.
- **Publicado**: commit y push a la rama de trabajo en curso, PR en borrador abierto y fusión a
  `main` en cuanto el CI esté en verde, por la autorización de publicación sin preguntar en cada
  tarea ya vigente (`CLAUDE.md`).
- **Pendiente para la siguiente oleada**: quedan 12 tareas accionables — las dos apuestas grandes
  restantes (`GOB15`, `GOB19`, cada una reservada a su propia sesión) y el resto de los Bloques 5-7:
  `LEV10`/`16` (Bloque 5), `DEB12`/`14`/`16` (Bloque 6), `GOB12`-`14`/`16`/`18` (Bloque 7).

## Cierre de sesión — 12 de septiembre de 2026 (178): `PVC14`

El usuario pidió seguir con la tercera de las seis apuestas grandes de la oleada, `PVC14`. El
diagnóstico previo cambió el planteamiento real de forma importante respecto al enunciado del
backlog ("ensemble ponderado y visible entre histórico, manual y Monte Carlo"): revisando el código,
(1) el "manual" no existía como dato declarado — las tres llamadas a `prudentSimulation()`/
`monteCarloSimulation()` en `app.js` pasaban literalmente `manualRange: { min: -500, base: 0, max:
500 }` hardcodeado, un número inventado que nadie del hogar había escrito nunca; (2) Monte Carlo no
es un tercer método independiente que se pueda pesar junto a los otros dos: ya se construye ENCIMA
del triángulo que decide `prudentSimulation()` (histórico o manual), así que pedirle un peso propio
mezclaría una entrada con su propia salida. Plan (manual real declarado + `ensembleForecastRange()`
mezclando histórico y manual con peso ajustable, sin tocar Monte Carlo ni `confidenceBands()`/PV4)
presentado y confirmado por el usuario antes de tocar código.

**Construido**:
- `PVC14` — nueva `ensembleForecastRange()` (`canonical-e13-scenarios.js`) mezcla el triángulo
  histórico (P10/P50/P90 que ya calculaba `prudentSimulation()` sobre el histórico conciliado) y un
  triángulo manual DECLARADO por el hogar, con un peso ajustable (0-100%, decisión ya confirmada en
  sesión 171: "pesos ajustables, no fijos"). Sin uno de los dos triángulos, se usa el otro al 100%
  (mismo comportamiento de fallback de siempre); sin ninguno, `calculable: false` — nunca un
  triángulo inventado (antes de esta tarea, sin manual declarado y sin histórico, el resultado era
  en silencio un triángulo de ceros, indistinguible de "sin desviación real"; ahora se declara
  explícitamente que no hay datos). `prudentSimulation()` pasa a construirse sobre este ensemble;
  `monteCarloSimulation()` no se toca — hereda el triángulo ya mezclado sin cambio de código.
  Nuevos campos declarables en el Laboratorio de escenarios (`pvc14ManualP10`/`Base`/`P90`,
  `pvc14HistoricalWeightPct`), persistidos cada uno por separado (nunca agrupados: agruparlos
  produjo un bug real detectado en la validación manual — rellenar un campo y tabular al siguiente
  borraba el primero porque los otros dos seguían vacíos en ese instante; corregido antes de
  publicar). La tarjeta "Simulación prudente" muestra siempre los dos triángulos de origen por
  separado además del resultado mezclado, nunca solo la cifra "mejorada" — exigencia explícita del
  propio backlog (§11). Se sustituyeron las 4 llamadas hardcodeadas (`LEV7`, `PVC5`, y las dos de
  Simulación prudente/Monte Carlo) por el manual real. Alcance confirmado con el usuario: no se toca
  `confidenceBands()`/PV4 (banda mes a mes del gráfico de previsión) — mide otra cosa sobre otro
  dato, mismo criterio que `PVC12` aplicó a estacionalidad vs. deriva. Tests:
  `tests/pvc14-ensemble-historico-manual.test.cjs` (21 tests, incluida la prueba de regresión del
  bug de guardado por campo).
- **Validación**: `npm run verify` completo en verde. `npm test` **4000/4000** pruebas (21 nuevas de
  `PVC14`). `test:a11y` **1258 IDs únicos** (antes 1253, sesión 177; +5 por los campos nuevos).
  `test:performance`: diff 10.000 filas 38,9 ms, forecast y escenarios 184,3 ms, recursos 2216 KB,
  presupuestos a escala (1000 categorías × 10 años) — análisis 147,0 ms, alertas 94,3 ms, forecast
  173,4 ms, histórico de presupuestos 35,2 ms, índice de transacciones por categoría 120,1 ms.
  `build:site`, `test:privacy` y `test:smoke` sin errores. Validación manual adicional en navegador
  real con Playwright: (1) declarar los tres campos manuales tabulando uno a uno persiste
  correctamente los tres tras recargar la página (el bug de guardado agrupado se detectó y corrigió
  aquí, antes de esta comprobación); (2) con histórico conciliado inyectado y manual declarado, la
  tarjeta muestra los dos triángulos por separado y la mezcla ponderada correcta; sin errores de
  consola en ningún caso. También se detectó y corrigió en esta validación un `TypeError` real en un
  consumidor ya existente (`pvc2CategoryConfidenceShare`, PVC2) que asumía que
  `prudent.percentiles` nunca era `null` — ahora sí puede serlo cuando no hay histórico ni manual
  declarado, y se guardó con el guardarraíl correspondiente.
- **Publicado**: commit y push a la rama de trabajo en curso, PR en borrador abierto y fusión a
  `main` en cuanto el CI esté en verde, por la autorización de publicación sin preguntar en cada
  tarea ya vigente (`CLAUDE.md`).
- **Pendiente para la siguiente oleada**: quedan 13 tareas accionables — las tres apuestas grandes
  restantes (`GOB11`, `GOB15`, `GOB19`, cada una reservada a su propia sesión) y el resto de los
  Bloques 5-7: `LEV10`/`16` (Bloque 5), `DEB12`/`14`/`16` (Bloque 6), `GOB12`-`14`/`16`/`18`
  (Bloque 7).

## Cierre de sesión — 12 de septiembre de 2026 (177): `INV18`

El usuario pidió seguir con la segunda de las seis apuestas grandes de la oleada, `INV18`. A
diferencia de `INV11` (donde el hueco real era mucho más pequeño de lo que sugería el backlog),
aquí el diagnóstico confirmó que el hueco es real: `optimizePartialSale` (FC5),
`marginalTaxOnAdditionalIncome` (FCX1) y la fecha de un objetivo (`financialCalendar`, E15) existen,
están probados, pero de verdad viven sueltos — ninguno mira las posiciones reales de la cartera ni
habla con los otros dos. Plan (heurística greedy con reevaluación, sin optimizador combinatorio
exacto; sin reducciones fiscales de pensión) presentado y confirmado por el usuario antes de tocar
código. En el mismo turno, el usuario autorizó además que la app pueda ser directiva cuando ayude de
verdad, en vez de limitarse siempre a "esto es información, nunca una recomendación" — alcance
acotado a tareas nuevas a partir de aquí, ver el índice de decisiones vigentes arriba.

**Construido**:
- `INV18` (`IN-8`) — vista única "¿de qué posición y cuándo saco X€ más barato?". Nueva función
  `inv18WithdrawalPlan()` en `app.js` (orquestación entre motores, mismo patrón que `GOB8`: ningún
  `canonical-*.js` depende de otro, así que quien cruza varios vive en `app.js`). Reparte el importe
  pedido con un relleno voraz que **reevalúa el coste marginal en cada paso**, no un orden fijo por
  tipo: en cada iteración calcula cuánto costaría ahora mismo cada posición todavía disponible —
  `optimizePartialSale` sobre la plusvalía proporcional para fondo/acción/ETF/cripto (base del
  ahorro), `marginalTaxOnAdditionalIncome` sobre el importe completo para plan-pensión (base
  general, tributa el 100%, no solo la plusvalía) — y elige la más barata en ese momento, actualizando
  los dos acumulados fiscales (base del ahorro ya "gastada", renta general ya sumada) para la
  siguiente iteración. Una posición en pérdidas sale gratis y se prioriza siempre. El "cuándo": si
  hay plusvalía ya realizada este año (`fc5AlreadyRealized`, reutilizado sin duplicar), compara con
  esperar al 1 de enero (esa base resetea por definición legal) — solo del lado del ahorro, nunca del
  lado de la pensión (exigiría inventar la renta general futura del hogar). Nota de fecha si se
  vincula un objetivo (selector nuevo, solo para eso, no para financiar). Nueva tarjeta en
  Herramientas avanzadas → Fiscal, después de "Compensación de pérdidas y ganancias". El texto de
  salida ya no lleva el disclaimer "nunca una recomendación": dice el orden a seguir directamente,
  conservando honestos los límites reales (heurística, no óptimo exacto; sin reducciones de pensión).
  Tests: `tests/inv18-plan-retirada-mas-barato.test.cjs` (15 tests, incluida una prueba explícita de
  que el algoritmo puede elegir una pensión antes que un fondo cuando de verdad sale más barato, no
  por una regla fija de "primero lo líquido").
- **Validación**: `npm run verify` completo en verde. `npm test` **3979/3979** pruebas (15 nuevas de
  `INV18`). `test:a11y` **1253 IDs únicos** (antes 1249, sesión 176; +4 por los campos nuevos
  `inv18AmountNeeded`, `inv18GoalSelect`, `inv18CalculateRun`, `inv18PlanNote`).
  `test:performance`: diff 10.000 filas 39,8 ms, forecast y escenarios 185,3 ms, recursos 2210 KB,
  presupuestos a escala (1000 categorías × 10 años) — análisis 161,6 ms, alertas 96,4 ms, forecast
  181,2 ms, histórico de presupuestos 31,0 ms, índice de transacciones por categoría 120,9 ms.
  `build:site`, `test:privacy` y `test:smoke` sin errores. Además, prueba manual en navegador real
  (servidor estático local + Playwright): registrada una escala del ahorro real (6.000:19%, :21%) y
  una posición de fondo real (coste 4.000 €, valor 10.000 €), el cálculo de INV18 para 3.000 €
  devolvió el coste marginal correcto (342 €, sobre 1.800 € de plusvalía proporcional al 19%), sin
  errores de consola.
- **Publicado**: commit y push a la rama de trabajo en curso, PR en borrador abierto y fusión a
  `main` en cuanto el CI esté en verde, por la autorización de publicación sin preguntar en cada
  tarea ya vigente (`CLAUDE.md`).
- **Pendiente para la siguiente oleada**: quedan 14 tareas accionables — las cuatro apuestas grandes
  restantes (`PVC14`, `GOB11`, `GOB15`, `GOB19`, cada una reservada a su propia sesión) y el resto de
  los Bloques 5-7: `LEV10`/`16` (Bloque 5), `DEB12`/`14`/`16` (Bloque 6), `GOB12`-`14`/`16`/`18`
  (Bloque 7).

## Cierre de sesión — 12 de septiembre de 2026 (176): `INV11`

El usuario pidió seguir con la siguiente oleada tras la sesión 175, empezando por la primera de las
seis apuestas grandes (`INV11`, `INV18`, `PVC14`, `GOB11`, `GOB15`, `GOB19`), cada una reservada a su
propia sesión según el orden ya establecido. Plan confirmado por el usuario antes de tocar código.

**Diagnóstico previo (antes de construir nada)**: el backlog describía `INV11` como "el plan de
pensiones sigue sin XIRR real, sin rebalanceo y sin glide path", lo que sugería tres motores nuevos.
Revisando el código real, la causa es una sola: `canonical-pension-simulator.js` (A15-4) simula el
ahorro fiscal de una aportación puntual, pero el plan de pensiones nunca ha sido una posición de
`canonical-portfolio.js` (IV1) — solo existe como saldo estático y aislado en el patrimonio de A14
(`A14_ASSET_TYPE_LABELS.pension`), sin relación con la cartera. `normalizePosition()` ya calcula XIRR
real de forma genérica sobre cualquier lista de flujos con fecha (IV2), `rebalanceSuggestions()` ya
itera de forma genérica sobre `POSITION_TYPES` (IV6), y `glidePathForGoal()`/`assetClassVsGlidePath()`
ya son genéricos sobre cualquier posición ligada a un objetivo (IVX6/INV1) — las tres funciones ya
existían y estaban probadas, pero el plan de pensiones nunca llegaba a pasar por ellas porque
`POSITION_TYPES` no incluía un tipo para él (caía en "otro" o, más probablemente, ni se intentaba
registrar).

**Construido**:
- `INV11` — plan de pensiones como posición de cartera más. Nuevo tipo de instrumento `"plan-pension"`
  en `POSITION_TYPES` (`canonical-portfolio.js`) — con esto, sin motor nuevo, el plan de pensiones
  entra automáticamente en la XIRR real (IV2), el rebalanceo por tipo (IV6, con su propio % objetivo
  declarable en Ajustes → Cartera) y el glide path por objetivo (IVX6/INV1, vía `fundingPositions` o
  `assetClass` declarados igual que cualquier otra posición). Único mecanismo nuevo de verdad: un
  tramo de liquidez propio, `"bloqueada"`, distinto de `"sin-clasificar"` — de un plan de pensiones SÍ
  se conoce la velocidad de conversión a caja (cero, salvo jubilación o un supuesto tasado), así que
  tratarlo como "no sabemos" habría sido incorrecto; el override declarado de `INV20` sigue disponible
  para un plan ya en fase de rescate. Decisiones de alcance explícitas, para que quien retome esto no
  las reconstruya al revés: no se toca `canonical-pension-simulator.js` (A15-4, sigue simulando la
  decisión de aportar, no un ledger), no se extiende el traspaso sin peaje fiscal de FC2 a pensiones
  (acotado a fondo→fondo, régimen fiscal de movilización de planes no verificado) y no se unifica con
  el saldo "Pensión" de A14 (sigue siendo una foto de patrimonio aparte, mismo criterio ya aceptado
  hoy para "Inversión" — declarar el mismo plan en ambos sitios sería duplicar, responsabilidad del
  hogar evitarlo, igual que ya pasa con el resto de la cartera). Tests:
  `tests/inv11-plan-pension-posicion-cartera.test.cjs` (14 tests).
- **Validación**: `npm install` de nuevo necesario al empezar la sesión (`node_modules` no existía).
  `npm run verify` completo en verde. `npm test` **3964/3964** pruebas (14 nuevas de `INV11`).
  `test:a11y` **1249 IDs únicos** (antes 1248, sesión 175; +1 por el campo nuevo
  `iv6TargetPlanPension` en Ajustes → Cartera).
  `test:performance`: diff 10.000 filas 39,5 ms, forecast y escenarios 197,7 ms, recursos 2197 KB,
  presupuestos a escala (1000 categorías × 10 años) — análisis 150,6 ms, alertas 98,6 ms, forecast
  181,0 ms, histórico de presupuestos 40,8 ms, índice de transacciones por categoría 139,2 ms.
  `build:site`, `test:privacy` y `test:smoke` sin errores.
- **Publicado**: commit y push a la rama de trabajo en curso, PR en borrador abierto y fusión a
  `main` en cuanto el CI esté en verde, por la autorización de publicación sin preguntar en cada
  tarea ya vigente (`CLAUDE.md`).
- **Pendiente para la siguiente oleada**: quedan 15 tareas accionables — las cinco apuestas grandes
  restantes (`INV18`, `PVC14`, `GOB11`, `GOB15`, `GOB19`, cada una reservada a su propia sesión) y el
  resto de los Bloques 5-7: `LEV10`/`16` (Bloque 5), `DEB12`/`14`/`16` (Bloque 6), `GOB12`-`14`/`16`/`18`
  (Bloque 7).

## Cierre de sesión — 12 de septiembre de 2026 (175): `INV12`, `INV14`, `INV15`, `INV17`, `INV19` e `INV20`

El usuario pidió seguir con la siguiente oleada tras la sesión 174, esta vez con el resto de tareas
normales del Bloque 4 (Inversión) de `BACKLOG_ULTIMATE_SEPTIEMBRE_OLEADA_4.md` que no son apuesta
grande: `INV12`, `INV14`, `INV15`, `INV17`, `INV19` e `INV20`, dejando `INV11` e `INV18` (las dos
apuestas L de este bloque) para sus sesiones propias posteriores, en el orden ya establecido. Plan
confirmado por el usuario antes de tocar código.

**Construido**:
- `INV12` — formaliza `fundingPositions` en el schema del objetivo, en vez de depender solo del
  campo de fortuna `position.goalId` (nunca validado por `normalizePosition()` ni por
  `canonical-e15-goals.js`, igual que ya pasaba con `assetClass`/INV1). Nuevo campo `fundingPositions`
  (array de ids de posición, deduplicado) añadido a `normalizeGoal()` tanto en `p2-domain.js` (la
  fuente real que persiste `p2.goals`) como en `canonical-e15-goals.js` (la que consumen
  `contributionPlan()`/`financialCalendar()`), y una nueva `linkedPositionsForGoal()`
  (`canonical-portfolio.js`) que `glidePathForGoal()`/`assetClassVsGlidePath()` usan como fuente
  preferente, cayendo al escaneo histórico por `goalId` solo si no hay nada declarado en el
  objetivo. `saveIv1Position()`/`removeIv1Position()` mantienen ambos campos sincronizados
  automáticamente al guardar/quitar una posición — la UX de registro no cambia, pero el objetivo ya
  no depende de que alguien escanee todas las posiciones para saber qué lo financia. Tests:
  `tests/inv12-fundingpositions-objetivo.test.cjs` (12 tests).
- `INV14` — exposición por divisa y geografía, declarada por posición (nunca derivada de la
  composición real de un fondo/ETF, que esta app no conoce). Nuevos campos crudos `currency`
  (texto libre, se guarda en mayúsculas) y `region` (lista cerrada de 7 geografías) en el registro
  de cartera, más `currencyGeographyExposure()` (`canonical-portfolio.js`) que agrupa el valor real
  de la cartera por cada dimensión — "sin-declarar" es una categoría más, nunca EUR/España
  asumidos por defecto. Avisa de concentración con el mismo umbral del 50% que el resto del módulo
  (INV16/IVX8), nunca decide ni bloquea nada. Se muestra en Herramientas avanzadas → Patrimonio e
  inversión, junto a la correlación declarada de INV16. Tests:
  `tests/inv14-exposicion-divisa-geografia.test.cjs` (9 tests).
- `INV15` — coste total de propiedad real por posición. IVX4 (`compoundedFeeCost`) solo aislaba el
  TER/gestión declarado; nuevo campo `custodyFeeAnnual` (€/año, importe fijo declarado — no un %,
  porque la mayoría de brokers cobran lo mismo tenga la posición 1.000€ o 100.000€) y nueva
  `totalCostOfOwnership()` (`canonical-portfolio.js`) que suma, sin componer, ese coste fijo al
  coste compuesto de comisión de gestión que ya calculaba IVX4. Se muestra junto al resto de notas
  de cada posición en el registro de cartera. Tests: `tests/inv15-coste-total-propiedad.test.cjs`
  (9 tests).
- `INV17` — revisión de rebalanceo por calendario, complementando el aviso por umbral de IV6 (que
  solo salta si la desviación cruza el 10% de golpe; una cartera que se desalinea despacio puede
  tardar años). Nueva `rebalanceCalendarReviewStatus()` (`canonical-portfolio.js`) compara los
  meses transcurridos desde la última revisión CONFIRMADA por el hogar (nunca inferida de otra
  acción, mismo criterio que la caducidad de supuestos de PVC15) contra un intervalo declarado
  (6 meses por defecto); sin ninguna revisión registrada, se considera vencida desde el principio.
  Tarjeta nueva en Ajustes → Cartera: objetivo de reparto y rebalanceo, con botón «Marcar revisado
  hoy». Tests: `tests/inv17-revision-rebalanceo-calendario.test.cjs` (11 tests).
- `INV19` — el coste de no tocar nunca tu cartera, a 10-20 años, en un gráfico. IVX4 daba un número
  puntual a un horizonte; nueva `portfolioFeeCostTrajectory()` (`canonical-portfolio.js`) genera la
  trayectoria año a año sumando cada posición con comisión declarada por separado (nunca un % medio
  inventado sobre el conjunto, que distorsionaría el resultado si las comisiones declaradas son
  distintas entre posiciones). Se dibuja como un polígono SVG continuo, mismo criterio de
  construcción que el cono de incertidumbre de PVC19. Tests:
  `tests/inv19-coste-no-tocar-cartera.test.cjs` (9 tests).
- `INV20` — anulación declarada de la liquidez que INV7 (`liquidityLadder`) infiere por tipo de
  instrumento, para cuando el tipo no refleja la liquidez real de una posición concreta (p. ej. un
  ETF de nicho menos líquido que uno indexado grande). Nuevo campo `liquidityTierOverride`
  (uno de los tres tramos ya existentes, opcional) que `liquidityLadder()` prioriza sobre el
  tramo inferido por tipo cuando se declara; la escalera de liquidez de INV7 anota cuánto de cada
  tramo viene de una anulación declarada, sin sustituir el total. Tests:
  `tests/inv20-anular-liquidez-declarada.test.cjs` (8 tests).
- **Validación**: `npm run verify` completo en verde (`npm install` de nuevo necesario al empezar
  la sesión, como en sesiones anteriores). `npm test` **3950/3950** pruebas (58 nuevas: 12 de INV12,
  9 de INV14, 9 de INV15, 11 de INV17, 9 de INV19 y 8 de INV20). `test:a11y` **1248 IDs únicos**
  (antes 1239; +9 por los campos y contenedores nuevos de INV14/INV15/INV17/INV19/INV20).
  `test:performance`: diff 10.000 filas 37,5 ms, forecast y escenarios 202,9 ms, recursos 2197 KB,
  presupuestos a escala (1000 categorías × 10 años) — análisis 144,9 ms, alertas 92,2 ms, forecast
  170,6 ms, histórico de presupuestos 41,5 ms, índice de transacciones por categoría 120,7 ms.
  `build:site`, `test:privacy` y `test:smoke` sin errores.
- **Publicado**: commit y push a la rama de trabajo en curso, PR en borrador abierto y fusión a
  `main` en cuanto el CI esté en verde, por la autorización de publicación sin preguntar en cada
  tarea ya vigente (`CLAUDE.md`).
- **Pendiente para la siguiente oleada**: quedan 16 tareas accionables — las seis apuestas grandes
  (`INV11`, `INV18`, `PVC14`, `GOB11`, `GOB15`, `GOB19`, cada una reservada a su propia sesión, en
  ese orden) y el resto de los Bloques 5-7: `LEV10`/`16` (Bloque 5), `DEB12`/`14`/`16` (Bloque 6),
  `GOB12`-`14`/`16`/`18` (Bloque 7). Con esta sesión el Bloque 4 (inversión) queda completo salvo
  `INV11`/`INV18`.

## Cierre de sesión — 12 de septiembre de 2026 (174): `PVC16`, `PVC17`, `PVC18` y `PVC19`

El usuario pidió seguir con la siguiente oleada tras la sesión 173, esta vez cerrando el resto del
Bloque 3 (previsión viva) de `BACKLOG_ULTIMATE_SEPTIEMBRE_OLEADA_4.md`: las cuatro tareas normales que
quedaban de ese bloque (`PVC16`, `PVC17`, `PVC18`, `PVC19`), dejando `PVC14` (la única apuesta L del
bloque) para su sesión propia dedicada, igual que ya pasó con los Bloques 1 y 2. Plan confirmado por el
usuario antes de tocar código.

**Construido**:
- `PVC16` — marcar eventos no recurrentes para que no contaminen el sesgo aprendido. `record.nonRecurring
  === true` (declarado por el hogar con motivo obligatorio, nunca inferido) se excluye de `usable` tanto
  en `learnFromHistory()` como en `detectStructuralChange()` (`canonical-forecast.js`) — complemento
  simétrico de `PVC3` (que busca persistencia real): un mes marcado como excepcional no contamina ni el
  sesgo aprendido ni la detección de cambio estructural. La marca se persiste en `pvc16-non-recurring-
  months` (motivo + fecha) y `reconciledMonthlyNetHistory()` la propaga. Se muestra en Análisis de
  previsión, debajo del backtesting de PVX1 (que ahora anota inline qué meses quedan excluidos y por
  qué), con un selector de mes conciliado + motivo y una lista de meses marcados con botón para
  desmarcar. Tests: `tests/pvc16-eventos-no-recurrentes.test.cjs` (11 tests).
- `PVC17` — índice único de "salud predictiva", con tendencia. Nueva `predictiveHealthIndex()`
  (`canonical-e16-monitoring.js`) agrega el `meanAbsoluteError` global que `predictionQuality()` (E16) ya
  calculaba —ponderado por muestra, no por categoría a partes iguales— en una única cifra, hasta ahora
  solo interna a `PVC13` y sin ningún sitio que la mostrara al hogar. No inventa una escala 0-100 (exigiría
  un umbral de "error aceptable" que el hogar no ha declarado): el índice ES el error medio en euros. La
  tendencia compara contra la última medición guardada en el mismo cierre de mes que ya recalibra PV3
  (`pvc17-health-snapshot`); sin medición previa, "sin-historial" explícito, nunca "estable" por defecto
  (bug real detectado y corregido en el propio desarrollo: `Number(null)` es `0`, finito, así que la
  comprobación necesitaba excluir `null`/`undefined` antes de coaccionar a número). Se muestra en Análisis
  de previsión con el desglose por categoría que antes solo existía disperso. Tests:
  `tests/pvc17-salud-predictiva.test.cjs` (15 tests).
- `PVC18` — etiquetar la causa de cada cambio de previsión (alcance reducido, confirmado en el propio
  backlog): sobre la comparación que `PVC6` (Oleada 3) ya hace con `diffAssumptionSnapshots()`, nueva
  `pvc18ChangeCauses()` (`app.js`) etiqueta hasta tres causas no excluyentes entre sí, leyendo piezas que
  ya existían — "supuesto editado" es lo que el propio diff ya detecta; "dato nuevo" y "modelo recalibrado"
  se leen del diario de PV5 (ya con marca de tiempo por entrada) filtrado a lo ocurrido después del cierre
  que se está comparando, siendo "modelo recalibrado" el subconjunto de esos cambios que además cruzó el
  umbral de confianza alta de PV1 (`pv1AutoAdjustTransitionNote`, reutilizada tal cual). Ningún motor de
  comparación nuevo. Tests: `tests/pvc18-causa-cambio-prevision.test.cjs` (13 tests).
- `PVC19` — el cono de incertidumbre debe verse como un cono. Corrección de renderizado únicamente
  (`pv4ConfidenceBandHtml()`, `app.js`): las columnas de barras sueltas por mes —sin conexión visual entre
  ellas, por lo que el ensanche de `confidenceBands()` (ya calculado con `√(mes+1)`) quedaba invisible— se
  sustituyen por un polígono SVG continuo entre el límite bajo y alto de cada mes (la forma de cono en sí)
  más una línea central, con los mismos `low`/`high`/`center` de siempre, sin tocar ningún cálculo. Tests:
  `tests/pvc19-cono-incertidumbre.test.cjs` (7 tests) más la actualización del test existente de PV4 al
  nuevo marcado (columnas → polígono).
- **Validación**: `npm run verify` completo en verde (tras `npm install`, que de nuevo faltaba por
  completo en el contenedor de esta sesión). `npm test` **3892/3892** pruebas (46 nuevas entre las cuatro
  tareas; el resto sin cambios de fixture necesarios salvo la actualización deliberada de dos tests
  existentes cuyo detalle de implementación cambió a propósito: el mapeo histórico→muestras de
  `predictionQuality` se factorizó en `pvc17QualitySamplesFromHistory()`, y el marcado de columnas de PV4
  pasó a un polígono SVG). `test:a11y` **1239 IDs únicos** (antes 1233; +6 por los campos nuevos de PVC16/
  PVC17). `test:performance`: diff 10.000 filas 32,2 ms, forecast y escenarios 164,2 ms, recursos 2182 KB,
  presupuestos a escala (1000 categorías × 10 años) — análisis 115,0 ms, alertas 73,2 ms, forecast 137,4 ms,
  histórico de presupuestos 34,7 ms, índice de transacciones por categoría 82,1 ms. `build:site`,
  `test:privacy` y `test:smoke` sin errores.
- **Publicado**: commit y push a la rama de trabajo en curso, PR en borrador abierto y fusión a `main` en
  cuanto el CI esté en verde, por la autorización de publicación sin preguntar en cada tarea ya vigente
  (`CLAUDE.md`).
- **Pendiente para la siguiente oleada**: quedan 22 tareas accionables — las seis apuestas grandes
  (`INV11`, `INV18`, `PVC14`, `GOB11`, `GOB15`, `GOB19`, cada una reservada a su propia sesión, en ese
  orden por la dependencia real de `GOB11` sobre `INV11` y por dejar `GOB15` para el final) y el resto de
  los Bloques 4-7: `INV12`/`14`/`15`/`17`/`19`/`20` (Bloque 4), `LEV10`/`16` (Bloque 5), `DEB12`/`14`/`16`
  (Bloque 6), `GOB12`-`14`/`16`/`18` (Bloque 7). Con esta sesión el Bloque 3 (previsión viva) queda
  completo salvo `PVC14`.

## Cierre de sesión — 12 de septiembre de 2026 (173): `INV16` y `LEV14`

El usuario pidió seguir con la siguiente oleada tras la sesión 172, priorizando `INV16` y `LEV14` —
las dos únicas tareas del resto del backlog que ya venían con el alcance resuelto explícitamente por
el hogar (§10.5, sesión 171), dejando las seis apuestas grandes (`INV11`, `INV18`, `PVC14`, `GOB11`,
`GOB15`, `GOB19`) para sesiones propias dedicadas y el resto de los Bloques 3-7 para sesiones
normales posteriores. Plan propuesto (13 sesiones más para agotar el backlog) confirmado por el
usuario antes de tocar código.

**Construido**:
- `INV16` — correlación cualitativa declarada entre clases de activo. Nueva `assetClassCorrelationPairs()`/
  `qualitativeConcentrationWarnings()` (`canonical-portfolio.js`): 6 pares posibles entre las 4 clases
  de activo ya declarables (INV1), cada uno con un nivel cualitativo declarado por el hogar
  (`alta`/`media`/`baja`/`negativa`) — sin ningún valor por defecto, un par sin declarar queda fuera
  del todo, nunca se le asume "media" ni ninguna otra cifra (mismo criterio de no fabricar precisión
  que ya aplica `assetClassVsGlidePath` con las posiciones sin clasificar). Solo avisa de
  concentración cuando dos clases con correlación "alta" declarada pesan de verdad en la cartera real
  (ambas > 0), con el % combinado y si supera el mismo umbral del 50% ("dominante") que ya usa
  `assetClassVsGlidePath` — nunca decide ni bloquea nada. Se muestra en Inversión, justo debajo de la
  lectura por clase de activo de INV1, con 6 selectores (uno por par) que se guardan solos al cambiar.
  Tests: `tests/inv16-correlacion-clases-activo.test.cjs` (16 tests: generación de pares, motor puro,
  wiring de los 6 selects y del guardado).
- `LEV14` — apalancamiento parcial escalonado (dollar-cost leverage). Nueva
  `staggeredLeverageDeployment()` (`canonical-leverage-simulator.js`) reutiliza tal cual
  `simulateLeverage()` (AP3) para la comparación de referencia (`lumpSum`), sin reimplementar su
  aritmética, y añade solo dos campos nuevos (número de tramos, intervalo en meses) sobre el importe/
  tipo/escenarios ya declarados en AP3. Mismo guardarraíl AP4. Bajo los mismos supuestos declarados
  para cada tramo, el resultado anual esperado una vez desplegado el importe entero es, por
  aritmética, idéntico al de tomarlo de una sola vez — la tarjeta lo dice explícitamente: escalonar no
  mejora ni empeora esa cifra esperada, solo reparte en el tiempo cuándo se toma cada tramo, reduciendo
  el riesgo de comprometer todo el importe en un único mal momento (riesgo de timing que este
  simulador no cuantifica, mismo criterio de no fabricar precisión que `INV16`). Solo informativo:
  nunca programa ni ejecuta ninguna toma de deuda real. Se muestra en Ajustes › Deuda y apalancamiento,
  justo debajo del simulador AP3. Tests: `tests/lev14-apalancamiento-escalonado.test.cjs` (11 tests:
  motor puro, reutilización exacta de `simulateLeverage`, wiring del botón y de los campos).
- **Validación**: `npm run verify` completo en verde (tras `npm install`, que de nuevo faltaba por
  completo en el contenedor de esta sesión). `npm test` **3846/3846** pruebas (27 nuevas entre `INV16`
  y `LEV14`; las 3819 existentes sin cambios de fixture necesarios — una única corrección de orden de
  llamadas en `renderAjustes()` para no romper el wiring ya probado de `renderInv6LatentLossCandidates`).
  `test:a11y` **1233 IDs únicos** (antes 1222; +11 por los nuevos campos de ambas tarjetas — 6 selects
  y una nota de INV16, 2 campos, un botón y una nota de LEV14). `test:performance`: diff 10.000 filas
  40,2 ms, forecast y escenarios 204,1 ms, recursos 2169 KB, presupuestos a escala (1000 categorías ×
  10 años) — análisis 157,7 ms, alertas 99,1 ms, forecast 188,2 ms, histórico de presupuestos 41,1 ms,
  índice de transacciones por categoría 132,2 ms. `build:site`, `test:privacy` y `test:smoke` sin
  errores.
- **Publicado**: commit y push a la rama de trabajo en curso, PR en borrador abierto y fusión a `main`
  en cuanto el CI esté en verde, por la autorización de publicación sin preguntar en cada tarea ya
  vigente (`CLAUDE.md`).
- **Pendiente para la siguiente oleada**: quedan 26 tareas accionables — las seis apuestas grandes
  (`INV11`, `INV18`, `PVC14`, `GOB11`, `GOB15`, `GOB19`, cada una reservada a su propia sesión, en ese
  orden por la dependencia real de `GOB11` sobre `INV11` y por dejar `GOB15` — vender la vivienda
  habitual — para el final, con una reconfirmación del hogar antes de construirla dado su calado) y el
  resto de los Bloques 3-7: `PVC16`-`19` (Bloque 3), `INV12`/`14`/`15`/`17`/`19`/`20` (Bloque 4),
  `LEV10`/`16` (Bloque 5), `DEB12`/`14`/`16` (Bloque 6), `GOB12`-`14`/`16`/`18` (Bloque 7).

## Cierre de sesión — 12 de septiembre de 2026 (172): `PVC12` — consolidación de estacionalidad/deriva por categoría

El usuario pidió dedicar esta sesión entera solo a `PVC12` (candidata a sesión propia según `VER-6`,
sesión 166b), sin tocar el resto de las 29 tareas accionables pendientes.

**Análisis previo, más matizado que "fusionar las dos fuentes de datos" (leído del código real, no
solo de la nota del backlog)**: había **tres** motores implicados, no dos — `categoryDriftWindows()`
(PVC4) mide **sesgo** (previsto vs. real) por partida del plan, solo sobre meses **cerrados y
conciliados con banco**; `_detectMonthlySeasonality()` (interno de
`canonical-budget-forecast-category.js`, invisible, solo alimentaba `suggestedAmountForCategory`/
`budgetForecastHorizons`) y `budgetSeasonalPatterns()` (ML-1, ya visible como tarjeta "Patrones
estacionales" en Presupuesto del mes, elegida como motor oficial en la sesión de `P-3`) calculan
ambos un índice de **estacionalidad** por categoría bancaria, sobre transacciones vivas, con
criterios de materialidad distintos y sin que el hogar pueda comprobar si coinciden. Fusionar el
sesgo (PVC4) con la estacionalidad habría degradado una de las dos garantías reales (verdad
conciliada vs. actualización en vivo) — se mantiene la separación que `VER-6` ya señaló. La
duplicación evitable de verdad estaba entre las otras dos. Alcance confirmado explícitamente por el
usuario antes de tocar código (opción recomendada de tres presentadas).

**Construido**:
- `seasonalPatternsFromCalendarSpend()`, nueva función pura en `canonical-budget-forecast-category.js`
  — extrae tal cual la aritmética que ya usaba `budgetSeasonalPatterns` (ML-1): índice de desviación
  por mes de calendario, con el mismo umbral de materialidad (≥10% desviación, ≥2 muestras/mes, ≥6
  muestras totales). `budgetSeasonalPatterns()` (`views/presupuesto-mes.js`) pasa a delegar en ella
  en vez de mantener su propia copia del cálculo — un único algoritmo, dos usos.
- `_detectMonthlySeasonality()` (mismo archivo) ahora llama a `seasonalPatternsFromCalendarSpend()`
  sobre su propio histórico mensual y, cuando encuentra un patrón validado para un mes de calendario,
  ese factor sustituye al índice interno más débil (sin mínimo de muestras por mes) que se usaba
  hasta ahora — nunca al revés. Sin patrón validado para un mes, se conserva el cálculo interno de
  siempre: mismo criterio de "nunca estrecha, solo mejora cuando hay señal real" que ya usó `PVC13`.
  Mejora automáticamente `suggestedAmountForCategory()` y `budgetForecastHorizons()` (Presupuesto del
  mes) sin tocar ninguno de sus dos puntos de llamada.
- `categoryDriftWindows()` (`canonical-forecast.js`, PVC4) gana un campo `categoryId` (la categoría
  bancaria equivalente a la partida, vía `categoryForPartidaEntry()` — solo para gastos, un ingreso
  "clasificado como gasto" no tendría sentido) que viaja sin alterar el cálculo de sesgo existente.
  `pvc4CategoryHistoryRecords()` (`app.js`) lo rellena al construir cada registro.
- Nueva `pvc12SeasonalCrossReferenceNote()` (`app.js`): puente de solo lectura — cuando una partida
  con sesgo sistemático tiene una categoría bancaria equivalente con un patrón estacional real
  detectado (mismo umbral que ML-1), `pvc4CategoryDriftHtml()` añade una nota nombrando el mes
  ("También muestra patrón estacional real en diciembre — puede explicar parte del sesgo"). Nunca
  recalcula ni sustituye el sesgo — solo añade contexto cuando existe.
- Tests: `tests/pvc12-consolidacion-estacionalidad-deriva.test.cjs` (16 tests: función pura,
  compatibilidad de `_detectMonthlySeasonality`/`forecast()`, paso de `categoryId` en
  `categoryDriftWindows()`, delegación de `budgetSeasonalPatterns()`, `pvc12SeasonalCrossReferenceNote`
  y wiring estático).
- **Validación**: `npm run verify` completo en verde (tras `npm install`, que de nuevo faltaba por
  completo en el contenedor de esta sesión — mismo síntoma ya documentado en sesiones anteriores).
  `npm test` **3820/3820** pruebas (16 nuevas de PVC12; las 3804 existentes, incluidas
  `tests/budget-core.test.cjs` y `tests/fcst1-forecast-horizontes.test.cjs`, sin cambios de fixture
  necesarios). `test:a11y` **1222 IDs únicos** (sin cambio — PVC12 no añade ningún elemento nuevo al
  DOM, solo texto dentro de tarjetas existentes). `test:performance`: diff 10.000 filas 51,4 ms,
  forecast y escenarios 251,3 ms, recursos 2163 KB, presupuestos a escala (1000 categorías × 10 años)
  — análisis 190,0 ms, alertas 133,8 ms, forecast 231,5 ms, histórico de presupuestos 53,5 ms, índice
  de transacciones por categoría 170,8 ms. `build:site`, `test:privacy` y `test:smoke` sin errores.
  Verificación manual adicional con Playwright headless (Chromium) contra un servidor estático local
  sirviendo `dist/`: `seasonalPatternsFromCalendarSpend` responde correctamente desde el runtime real
  del navegador con datos sintéticos; tras navegar a Presupuesto del mes (carga del chunk diferido de
  `views/presupuesto-mes.js`), `budgetSeasonalPatterns` se ejecuta sin excepción; la tarjeta de PVC4 en
  Ajustes renderiza sin excepción. Mismo único ruido de consola ya documentado en sesiones anteriores
  (bloqueo de red del sandbox a un recurso externo y un 404 preexistentes en `dist/` sin cambios de
  esta sesión), ninguna excepción nueva.
- **Publicado**: commit y push a la rama de trabajo en curso, PR en borrador abierto y fusión a `main`
  en cuanto el CI esté en verde, por la autorización de publicación sin preguntar en cada tarea ya
  vigente (`CLAUDE.md`).
- **Pendiente para la siguiente oleada**: sin cambios respecto al cierre de la sesión 171 salvo por
  `PVC12` — quedan 28 tareas accionables: `PVC16`-`19`, `INV12`, `INV14`, `INV15`, `INV17`, `INV19`,
  `INV20`, `LEV10`, `LEV16`, `DEB12`, `DEB14`, `DEB16`, `GOB12`-`14`/`16`/`18`, las cuatro ya resueltas
  de alcance pero no construidas (`INV16`, `LEV14`, esfuerzo M; `PVC14`, `GOB15`, apuesta L) y las
  apuestas grandes restantes (`INV11`, `INV18`, `GOB11`, `GOB19`).

## Cierre de sesión — 12 de septiembre de 2026 (171): sexta oleada de `BACKLOG_ULTIMATE_SEPTIEMBRE_OLEADA_4.md`

El usuario pidió seguir con la siguiente oleada tras la sesión 170 y resolver además las cuatro
decisiones de alcance pendientes del backlog para desbloquearlas de cara al futuro. Alcance elegido
para construir: `INV13`, `LEV12`, `DEB11` y `LEV11` — las cuatro tareas de esfuerzo M / beneficio Alto
que no exigían decisión de alcance previa, dejando las apuestas grandes (L: `INV11`, `INV18`, `PVC14`,
`GOB11`, `GOB15`, `GOB19`) y `PVC12` para sesiones propias dedicadas.

- **`INV13` — proyección fiscal del plan de aportación periódica (DCA)**: `INV8` (Oleada 3) solo
  compara aportado vs. planificado del plan DCA, sin decir qué pasaría fiscalmente si se vendiera lo
  acumulado. Nueva función `renderInv13DcaTaxProjection()` (`app.js`) reutiliza tal cual
  `optimizePartialSale()` (FC5, `canonical-irpf-estimator.js`, mismo campo `fc5AlreadyRealized` que ya
  usa LEV15, sin duplicarlo) sobre la plusvalía REAL ya calculada de cada posición
  (`position.gainLoss`, la misma que usa `deleveragingPriority`/LEV6) — nunca un % de ganancia
  declarado a mano, porque el dato real ya existe en la app. Se muestra en Inversión, justo debajo del
  seguimiento DCA de INV8 (`#inv13DcaTaxProjection`). Tests:
  `tests/inv13-proyeccion-fiscal-dca.test.cjs`.
- **`LEV12` — alerta proactiva de LTV, no solo simulación bajo demanda**: hasta ahora
  `lombardMarginCallSimulation()` (APX3) solo se calculaba al pulsar «Simular caída», con
  `apx3LoanAmount`/`apx3MaintenanceLtvPct` como campos puramente efímeros que no sobrevivían a
  recargar la página. Se persisten ahora en `scenarioSettings.apx3LombardDeclaration` (mismo criterio
  que las bandas de volatilidad de LEV5) y nueva función `proactiveLtvAlert()`
  (`canonical-leverage-simulator.js`) reutiliza tal cual el mismo motor de margin call, con
  `stressDropPct: 0` (el LTV de HOY), añadiendo una banda de severidad de 3 niveles (mismo criterio
  que `cashSeverityBand`, E16: medio ≥70% del camino hacia el LTV de mantenimiento, alto ≥85%, crítico
  ≥100%) sobre cuánto camino queda hasta el margin call real. Se muestra en Ajustes › Deuda y
  apalancamiento, justo debajo del simulador APX3 (`#lev12ProactiveAlertNote`), sin botón propio —se
  recalcula cada vez que se abre esa pantalla o cambia la cartera. Tests:
  `tests/lev12-alerta-proactiva-ltv.test.cjs`.
- **`DEB11` — amortización parcial: reducir cuota vs. reducir plazo, como decisión explícita**: DEB2
  (`dimensionOptimalPrepayment`) ya dice CUÁNTO amortizar de verdad (neto de comisión) del excedente
  que DLX2 destina a una deuda, pero no si ese importe debería reducir cuota o plazo — y APX6
  (`amortizeReduceQuotaVsTerm`, sesión 141) solo respondía esa pregunta para el importe BRUTO tecleado
  en AP1, no para el ya dimensionado por DEB2. Nueva función `deb11ReduceQuotaVsTermHtml()` (`app.js`)
  reutiliza tal cual `amortizeReduceQuotaVsTerm()` sobre el importe neto de DEB2, y añade una
  preferencia declarada persistida (`state.deb11Preference`, mismo patrón que DEB7) para que la
  elección quede explícita en vez de implícita — nunca decide por el hogar cuál de las dos tomar, solo
  refleja la que ya declaró (selector `#deb11PreferenceSelect`, junto al resto de campos de AP1). Se
  muestra en cada «Comparar» de AP1, justo debajo de la tarjeta de DEB2. Tests:
  `tests/deb11-cuota-vs-plazo-decision.test.cjs`.
- **`LEV11` — desapalancamiento preventivo por drawdown, antes del margin call (alcance reducido)**:
  `deleveragingPriority()` (LEV6, Oleada 3) ya resuelve QUÉ vender primero al desapalancar; faltaba la
  regla de CUÁNDO y CUÁNTO activar esa priorización de forma preventiva. Nueva función
  `preventiveDeleveragingAllocation()` (`canonical-leverage-simulator.js`) reutiliza tal cual la caída
  ponderada ya estimada por LEV5 (`weightedPortfolioStressDropPct`, sobre las bandas de volatilidad
  declaradas) para decidir el CUÁNDO (si esa caída realista ya dispararía un margin call vía
  `lombardMarginCallSimulation`) y `deleveragingPriority()` (LEV6) para decidir el QUÉ — esta función
  solo reparte el importe a cubrir (`forcedLiquidationAmount`) entre las filas ya priorizadas, de la #1
  en adelante, hasta cubrirlo. Nunca vende nada por su cuenta. Se muestra en Ajustes › Deuda y
  apalancamiento, justo debajo del colchón de garantía dinámico de LEV5
  (`#lev11PreventiveDeleveragingNote`). Tests: `tests/lev11-desapalancamiento-preventivo.test.cjs`.
- **Validación**: `npm run verify` completo en verde (tras `npm install`, que faltaba de nuevo por
  completo en el contenedor de esta sesión — `node_modules` no existía; una vez instalado, las 6
  pruebas de `build:site` que habían fallado por la misma causa pasaron sin más cambios). `npm test`
  **3804/3804** pruebas (32 nuevas repartidas en los 4 archivos de test de arriba, más 5 archivos de
  test ya existentes con su ventana de extracción de código o su regex literal ajustados porque las
  cuatro tareas añadieron texto dentro de `handleAp1Compare()`, `saveScenarioSettings()` y el render
  central de la pantalla Deuda › Apalancamiento que esos tests ya recortaban o casaban de forma exacta
  — `tests/ap1-app-integracion.test.cjs`, `tests/ap2-app-integracion.test.cjs`,
  `tests/deb7-preferencia-declarada.test.cjs`, `tests/gob7-modo-sesion-asesor.test.cjs` (mismo patrón
  de "la ventana crece" ya documentado en sesiones anteriores) y
  `tests/dlx3-retrospectiva-colchon.test.cjs` (el regex de dos llamadas adyacentes tuvo que incluir las
  tres llamadas nuevas intercaladas entre medias). `test:a11y` **1222 IDs únicos** (+4 sobre los 1218
  de la sesión 170: el selector `deb11PreferenceSelect` y los tres contenedores nuevos de INV13/LEV12/
  LEV11). `test:performance`, `build:site`, `test:privacy` y `test:smoke`, todos sin errores.
  Verificación manual adicional con Playwright headless (Chromium) contra un servidor estático local:
  las cuatro funciones nuevas y los cuatro elementos de DOM nuevos (`inv13DcaTaxProjection`,
  `deb11PreferenceSelect`, `lev12ProactiveAlertNote`, `lev11PreventiveDeleveragingNote`) existen y
  cargan sin ninguna excepción de página — mismo único ruido de consola ya documentado en sesiones
  anteriores (bloqueo de red del sandbox al script externo de Supabase, ajeno a los cambios).
- **Pendiente para la siguiente oleada**: 29 tareas accionables siguen intactas —
  `PVC12` (consolidación de estacionalidad/deriva, candidata a sesión propia), `PVC16`-`19`, `INV12`,
  `INV14`, `INV15`, `INV17`, `INV19`, `INV20`, `LEV10`, `LEV16`, `DEB12`, `DEB14`, `DEB16`, `GOB12`-
  `14`/`16`/`18`, más las cuatro ya resueltas de alcance pero no construidas (`INV16`, `LEV14`, esfuerzo
  M; `PVC14`, `GOB15`, apuesta L) y las apuestas grandes restantes (`INV11`, `INV18`, `GOB11`, `GOB19`).
- **Publicado**: commit y push a la rama de trabajo en curso, PR en borrador abierto y fusión a `main`
  en cuanto el CI esté en verde, por la autorización de publicación sin preguntar en cada tarea ya
  vigente (`CLAUDE.md`).

## Cierre de sesión — 12 de septiembre de 2026 (170): quinta oleada de `BACKLOG_ULTIMATE_SEPTIEMBRE_OLEADA_4.md`

El usuario pidió seguir con la siguiente oleada tras la sesión 169 (modo Inicio del flujo de
trabajo, con plan propuesto y confirmado explícitamente antes de tocar código). Alcance elegido:
`PVC11`, `LEV13` y `DEB17` — las tres tareas de esfuerzo M / beneficio Alto que no exigían
consultar alcance con el hogar de antemano y reutilizan motores ya existentes según la propia nota
del backlog, dejando las apuestas grandes (L), las de alcance por confirmar y `PVC12` para
sesiones dedicadas, tal y como recomienda el propio backlog.

- **`PVC11` — recalibración incremental por movimiento conciliado, no solo al cerrar el mes**:
  hasta ahora el único disparador de `learnFromHistory()` era `recalibrateForecastLearning()`, que
  solo corre en el cierre de mes firmado (PV3/E12b) — un mes ya conciliado en
  `canonicalLedgerSnapshot.reconciliation.months` podía llevar semanas esperando ese cierre sin que
  se notara. Nueva función de solo lectura `pvc11PendingLearningPreview()` (`app.js`): recalcula
  `learnFromHistory()` con el histórico conciliado disponible ahora y lo compara contra la última
  foto ya guardada (`loadPv3LearningSnapshot`) para contar cuántos meses nuevos están conciliados
  pero sin aprender todavía — nunca guarda nada ni aplica ningún ajuste, la única disciplina que
  recalibra sigue siendo el cierre de mes firmado (misma exigencia de confirmación explícita que ya
  protege a `applyLearnedBias`). Se muestra en una tarjeta nueva en Análisis de previsión, junto al
  diario de recalibración de PV5. Tests: `tests/pvc11-desviacion-en-construccion.test.cjs`.
- **`LEV13` — sensibilidad del veredicto de apalancarse, punto de cruce exacto por bisección**:
  `simulateLeverage()` (AP3) solo decía si cada escenario declarado (pesimista/base/optimista) era
  favorable o desfavorable HOY, sin decir cuánto margen real tenía ese veredicto. Nueva función
  `leverageVerdictCrossing()` (`canonical-leverage-simulator.js`) aplica la misma bisección exacta
  que ya usa `inverseScenario()` (laboratorio de previsión, E13) — reimplementada localmente porque
  `findFactorCrossing` no estaba exportada del otro módulo — para calcular cuánto tendría que caer
  la rentabilidad esperada, o cuánto tendría que subir el tipo de la deuda nueva, antes de que cada
  escenario cambie de signo. Un escenario ya desfavorable hoy no tiene punto de cruce hacia delante
  que buscar (mismo criterio que `alreadyBroken` en `inverseScenario`). Se muestra en el simulador
  AP3 (`lev13VerdictCrossingHtml`), justo debajo del resultado ya calculado. Tests:
  `tests/lev13-sensibilidad-cruce-apalancamiento.test.cjs`.
- **`DEB17` — test de estrés de la cancelación contra el escenario de tensión, no solo el base**:
  el guardarraíl a varios meses de `DEB15` (`cancellationLiquidityGuardrail`) solo proyectaba la
  liquidez futura contra el escenario BASE del forecast. `handleAp1Compare` ahora calcula además el
  mismo guardarraíl contra el perfil de tensión ya calibrado en el laboratorio de escenarios (E13,
  `PROFILES` id `"stress"`: -10% ingresos, +10% gastos), pasando las filas de `simulate()` como
  `forecastSeries` — `cancellationLiquidityGuardrail` ya aceptaba filas planas
  (`row.closingLiquidity`) además de la serie anidada del forecast, así que no hizo falta ningún
  adaptador. Misma condición de activación que `DEB15` (solo cancelación TOTAL). Nueva función de
  render `deb17CancellationStressHtml`. Tests: `tests/deb17-test-estres-cancelacion.test.cjs`.
- **Validación**: `npm run verify` completo en verde (tras `npm install`, que faltaba por completo
  en el contenedor de esta sesión — `node_modules` no existía). `npm test` **3772/3772** pruebas (28
  nuevas: 11 en `pvc11-desviacion-en-construccion.test.cjs`, 9 en
  `lev13-sensibilidad-cruce-apalancamiento.test.cjs`, 8 en `deb17-test-estres-cancelacion.test.cjs`,
  más 6 archivos de test ya existentes con su ventana de extracción de código ajustada porque DEB17
  añadió líneas dentro de `handleAp1Compare()` que esos tests ya recortaban por longitud fija —
  `tests/ap1-app-integracion.test.cjs`, `tests/ap2-app-integracion.test.cjs`,
  `tests/deb3-opcionalidad-esperar.test.cjs`, `tests/deb7-preferencia-declarada.test.cjs`,
  `tests/deb9-sintesis-cancelar-mantener-deuda.test.cjs` (mismo patrón de "la ventana crece" ya
  documentado en sesiones anteriores) y `tests/pvx5-causal-tree.test.cjs` (una llamada nueva
  intercalada en el ciclo de render, `renderPvc11PendingLearning()`, sin cambiar ningún criterio de
  prueba, solo el texto exacto esperado). `test:a11y` **1218 IDs únicos** (+1: la tarjeta nueva de
  PVC11, `pvc11PendingLearningNote` — LEV13 y DEB17 no añaden ningún elemento nuevo al DOM, ambas
  reutilizan tarjetas existentes de AP3/AP1). `test:performance`, `build:site`, `test:privacy` y
  `test:smoke`, todos sin errores. Verificación manual adicional en navegador (Playwright headless,
  Chromium): las tres funciones nuevas (`pvc11PendingLearningPreview`/render, `leverageVerdictCrossing`
  + `lev13VerdictCrossingHtml`, `deb17CancellationStressHtml`) se ejecutaron con datos sintéticos
  cargados en la propia app publicada, sin ninguna excepción de página — el único ruido de consola
  fue el bloqueo de red del propio sandbox al script externo de Supabase (`cdn.jsdelivr.net`), ya
  presente antes de esta sesión y ajeno a los cambios.
- **Pendiente para la siguiente oleada**: 33 tareas accionables de `BACKLOG_ULTIMATE_SEPTIEMBRE_OLEADA_4.md`
  siguen intactas — `PVC12` (consolidación de estacionalidad/deriva, candidata a sesión propia),
  `PVC16`-`19`, `INV11`-`20`, `LEV10`-`12`/`14`/`16`, `DEB11`/`12`/`14`/`16`, `GOB11`-`16`/`18`/`19`.
  Los cinco frentes marcados por el propio §10 para "cuestionar el alcance antes de construir"
  (`PVC14`, `INV16`, `LEV14`, `GOB15`) y las apuestas grandes (L: `INV11`, `INV18`, `PVC14`, `GOB11`,
  `GOB15`, `GOB19`) siguen sin tocar, a la espera de una sesión dedicada o de confirmación explícita
  del hogar.
- **Publicado**: commit y push a la rama de trabajo en curso, PR en borrador abierto y fusión a
  `main` en cuanto el CI esté en verde, por la autorización de publicación sin preguntar en cada
  tarea ya vigente (`CLAUDE.md`). La rama de trabajo (`claude/youthful-babbage-fywsp9`) partía ya
  fusionada del cierre de la sesión 169 (GitHub la había borrado en remoto tras el PR #277); se
  retomó desde el mismo commit que `main`, sin ningún trabajo suelto que recuperar.

## Cierre de sesión — 12 de septiembre de 2026 (169): cuarta oleada de `BACKLOG_ULTIMATE_SEPTIEMBRE_OLEADA_4.md`

El usuario pidió seguir con la siguiente oleada tras la sesión 168. Alcance elegido: `PVC13` y
`DEB15` — las dos tareas de beneficio Crítico restantes que no exigían confirmar alcance con el hogar
de antemano (a diferencia de `PVC14`, `INV16`, `LEV14` o `GOB15`, marcadas en el propio §10 del
backlog para consultar antes de construir), dejando las apuestas grandes (L) y `PVC12` para sesiones
propias dedicadas.

- **`PVC13` — cerrar el bucle de `predictionQuality()` con `confidenceBands()`**: hasta ahora
  `confidenceBands()` (PV4, `canonical-forecast.js`) solo ensanchaba la banda de confianza con el
  sesgo medio (`|averageDelta|` promedio de `learnFromHistory()`), que se puede cancelar cuando los
  errores de un mes a otro cambian de signo aunque su dispersión real sea alta. `predictionQuality()`
  (E16) existía en el código desde antes pero ningún sitio real de la app la llamaba.
  `confidenceBands()` acepta ahora `options.quality` (un `predictionQuality()` ya calculado): por
  desigualdad triangular, el error medio absoluto medido
  sobre cada muestra nunca es menor que el sesgo medio ya usado, así que el margen se ensancha hasta
  ese error medido cuando lo hay — nunca se estrecha. `renderE13ScenarioLab` construye las muestras
  desde el mismo histórico conciliado que ya usa PVX1/`learnFromHistory`, sin pipeline nuevo, y
  `pv4ConfidenceBandHtml` dice explícitamente cuándo el ensanche viene del error medido. Backward
  compatible: sin `options.quality`, el comportamiento es idéntico al de antes (todos los tests
  previos de `confidenceBands` siguieron pasando sin cambios). Tests:
  `tests/pvc13-cierre-bucle-confidence-bands.test.cjs`.
- **`DEB15` — guardarraíl de liquidez a varios meses tras una cancelación total**:
  `cancellationLiquidityGuardrail()` (`canonical-cushion.js`) extiende `amortizeCushionGuardrail`
  (DLX1, que solo mira el saldo del día de la operación) proyectando la liquidez que el propio
  forecast ya prevé para los próximos 6 meses (configurable), reducida por el importe pagado hoy —
  hipótesis deliberadamente conservadora: no asume que la cuota de la deuda cancelada desaparece del
  forecast, así que si acaso subestima la liquidez futura real, nunca la sobreestima. Solo se activa
  en `handleAp1Compare` (AP1) cuando el importe cancela el principal entero de la deuda
  seleccionada — una amortización parcial ya queda cubierta por el guardarraíl instantáneo de
  siempre. Si el forecast disponible no llega al horizonte pedido, lo dice tal cual en vez de
  inventar meses. Tests: `tests/deb15-guardarrail-liquidez-cancelacion.test.cjs`.
- **Validación**: `npm run verify` completo en verde. `npm test` **3744/3744** pruebas (18 nuevas: 7
  en `tests/pvc13-cierre-bucle-confidence-bands.test.cjs`, 9 en
  `tests/deb15-guardarrail-liquidez-cancelacion.test.cjs`, 1 en `tests/pv4-bandas-confianza.test.cjs`
  y 1 en `tests/ap1-app-integracion.test.cjs`, más 9 archivos de test ya existentes con su ventana de
  extracción de código ajustada porque las dos tareas añadieron líneas dentro de funciones que esos
  tests ya recortaban por longitud fija —`tests/pv4-bandas-confianza.test.cjs`,
  `tests/pvc2-banda-confianza-categoria.test.cjs`, `tests/pvc5-recalibracion-trimestral.test.cjs`,
  `tests/a14-5-app-integracion.test.cjs`, `tests/ap1-app-integracion.test.cjs` (con una nueva sección
  DEB15), `tests/ap2-app-integracion.test.cjs`, `tests/deb3-opcionalidad-esperar.test.cjs`,
  `tests/deb7-preferencia-declarada.test.cjs`, `tests/deb9-sintesis-cancelar-mantener-deuda.test.cjs`
  — mismo patrón de "la ventana crece" ya documentado en `tests/a14-5-app-integracion.test.cjs` desde
  sesiones anteriores, sin cambiar el criterio de ninguna prueba, solo su desplazamiento de texto.
  `test:a11y` **1217 IDs únicos** (sin cambio: ninguna de las dos tareas añade elementos nuevos al
  DOM, ambas reutilizan tarjetas existentes de AP1/E13). `test:performance`, `build:site`,
  `test:privacy` y `test:smoke`, todos sin errores. Verificación manual adicional en navegador
  (Playwright headless): DEB15 comprobado de punta a punta con datos de ejemplo (cancelación total de
  una deuda con un mes futuro por debajo del suelo según el forecast, el aviso aparece correctamente);
  PVC13 comprobado sin errores de consola (sin histórico conciliado en los datos de ejemplo, no hay
  caso real de ensanche por error medido que enseñar en este entorno, pero la ruta no lanza ninguna
  excepción).
- **Pendiente para la siguiente oleada**: `PVC12` (consolidación de estacionalidad/deriva, candidata
  a sesión propia) y el resto de los Bloques 3-7 de `BACKLOG_ULTIMATE_SEPTIEMBRE_OLEADA_4.md`
  (`PVC11`/`16`-`19`, `INV11`-`20`, `LEV10`-`14`/`16`, `DEB11`/`12`/`14`/`16`/`17`, `GOB11`-`19`), 36
  tareas accionables intactas. Los cinco frentes marcados por el propio §10 para "cuestionar el
  alcance antes de construir" (`PVC14`, `INV16`, `LEV14`, `GOB15`) y las apuestas grandes (L: `INV11`,
  `INV18`, `PVC14`, `GOB11`, `GOB15`, `GOB19`) siguen sin tocar, a la espera de una sesión dedicada o
  de confirmación explícita del hogar.
- **Publicado**: commit y push a la rama de trabajo en curso, PR en borrador abierto y fusión a
  `main` en cuanto el CI esté en verde, por la autorización de publicación sin preguntar en cada
  tarea ya vigente (`CLAUDE.md`).

## Cierre de sesión — 12 de septiembre de 2026 (168): tercera oleada de `BACKLOG_ULTIMATE_SEPTIEMBRE_OLEADA_4.md`

El usuario pidió seguir con la siguiente oleada tras la sesión 167. Alcance elegido: `PVC15`, `DEB13`
y `LEV15` — las tres tareas de esfuerzo S / impacto medio-alto que el propio §10 del backlog señalaba
para un hueco de sesión corta, dejando `PVC12` (consolidación de mayor calado) para una sesión propia
dedicada, tal y como recomienda el backlog.

- **`PVC15` — alerta de "supuesto caducado"**: nueva función `assumptionExpiryAlerts()` en
  `canonical-forecast.js`, que compara la antigüedad (`updatedAt`) de cada supuesto INDIVIDUAL del
  registro ya versionado (`buildAssumptionRegistry()`, A7-2/A15-1) contra un umbral en meses por tipo
  de supuesto: 6 meses para los factores de ingreso/gasto e inflación (los que más cambian en la
  práctica), 12 para el ahorro objetivo y los tres campos fiscales numéricos, 24 para tributación
  conjunta y familia numerosa (los que rara vez cambian). Los saldos iniciales
  (`openingChecking`/`openingSavings`) y el interruptor de ahorro automático quedan excluidos a
  propósito: se recalculan solos, no son una estimación que pueda quedar desfasada. Distinta de
  `PVC7` (Oleada 3), que vigila la caducidad de un *escenario guardado* frente al forecast actual, no
  la de un supuesto suelto. Se muestra junto a cada supuesto en Ajustes › Registro de supuestos
  (`renderAjustesAssumptionRegistry`), sin formulario ni umbral editable todavía. Tests:
  `tests/pvc15-alerta-supuesto-caducado.test.cjs`.
- **`DEB13` — alerta de "deuda cara dormida"**: nueva función `deb13DormantExpensiveDebtAlerts()` en
  `views/deuda.js`, que cruza `fiscalAdjustedDebtPriority()` (DEB5) con `compareAmortizeVsInvest`
  (AP1) para TODA deuda activa —no solo la que el hogar tenga seleccionada en el comparador—, usando
  el capital pendiente y el plazo real de cada contrato en vez de un importe/horizonte escrito a
  mano. Solo avisa cuando amortizar de verdad saldría más barato que mantener esa deuda mientras se
  invierte a la rentabilidad real de la cartera (IV5). Se muestra en Deuda › Contratos, junto a la
  propia prioridad fiscal de DEB5, y se queda vacía cuando ninguna deuda cumple la condición. Tests:
  `tests/deb13-deuda-cara-dormida.test.cjs`.
- **`LEV15` — coste comparado en euros y efecto fiscal de las dos salidas del margin call**: nuevas
  funciones `lev15ForcedLiquidationGain()`/`lev15MarginCallExitCostHtml()` en `app.js`, que comparan
  el coste total de las dos salidas que ya calcula `lombardMarginCallSimulation` (APX3): aportar
  garantía (sin efecto fiscal, no es una venta) frente a liquidación forzosa, cuyo efecto fiscal se
  estima con `optimizePartialSale` (mismo motor de tramos del ahorro que FC5) sobre la plusvalía ya
  realizada este año (reutiliza `fc5AlreadyRealized`, sin duplicar el campo) y la que llevaría
  implícita el importe liquidado, según un nuevo campo declarado (`lev15GainLossPct`, misma fórmula
  pro-rata importe→plusvalía que ya usa `sellVsBorrowComparison`/INV10). Nunca decide cuál salida
  tomar, solo compara su coste total. Verificado también a mano en navegador (Playwright headless):
  con una posición de cartera y una escala de tramos del ahorro registradas, la simulación de una
  caída que dispara la llamada de garantía muestra correctamente ambos costes y el efecto fiscal real
  de la liquidación forzosa. Tests: `tests/lev15-coste-salidas-margin-call.test.cjs`.
- **Validación**: `npm run verify` completo en verde (tras `npm install`, el contenedor no traía
  `node_modules` — mismo problema ya documentado en sesiones 165-167, no relacionado con este
  cambio). `npm test` **3726/3726** pruebas (21 nuevas: 7 en `tests/pvc15-alerta-supuesto-caducado.test.cjs`,
  7 en `tests/deb13-deuda-cara-dormida.test.cjs`, 7 en `tests/lev15-coste-salidas-margin-call.test.cjs`;
  más 1 wiring existente actualizado en `tests/d1-d2-deuda-tabs-contratos.test.cjs` por la nueva
  llamada a `renderDeb13DormantExpensiveDebtAlert` dentro de `renderDeudaContratos`). `test:a11y`
  **1217 IDs únicos** (+2 sobre los 1215 de la sesión 167, por los dos campos/elementos nuevos —
  `deb13DormantDebtAlert` y `lev15GainLossPct` — ninguno duplicado). `test:performance`, `build:site`,
  `test:privacy` y `test:smoke`, todos sin errores.
- **Pendiente para la siguiente oleada**: `PVC12` (consolidación de estacionalidad/deriva, candidata a
  sesión propia) y el resto de los Bloques 3-7 de `BACKLOG_ULTIMATE_SEPTIEMBRE_OLEADA_4.md`
  (`PVC11`/`PVC13`-`19` salvo `PVC15`, `INV11`-`20`, `LEV10`-`16` salvo `LEV15`, `DEB11`-`17` salvo
  `DEB13`, `GOB11`-`19`), 38 tareas accionables intactas.
- **Publicado**: commit y push a la rama de trabajo en curso, PR en borrador abierto y fusión a
  `main` en cuanto el CI esté en verde, por la autorización de publicación sin preguntar en cada
  tarea ya vigente (`CLAUDE.md`).

## Cierre de sesión — 12 de septiembre de 2026 (167): segunda oleada de `BACKLOG_ULTIMATE_SEPTIEMBRE_OLEADA_4.md`

El usuario pidió seguir con la siguiente fase tras la primera oleada (sesión 166b). Alcance elegido:
`DEB10` y `GOB17` — las dos tareas de tamaño moderado cuyo alcance ya había confirmado el Bloque 1 de
verificaciones — dejando `PVC12` (consolidación de mayor calado, dos fuentes de datos distintas) para
una sesión propia dedicada, tal y como recomendaba el propio backlog en su §10.

- **`DEB10` — sugerir en el propio comparador AP1 qué deuda amortizar primero**: nueva función
  `deb10PriorityHint()` en `app.js`, que reutiliza tal cual `fiscalAdjustedDebtPriority()` (DEB5,
  `canonical-debt-contracts.js`) sobre `debtContractSourceRows()` — sin motor propio. Compara la
  deuda #1 por TAE efectivo tras deducción fiscal contra la que el hogar ya tiene seleccionada en
  `#ap1DebtSelect`: si coincide, lo confirma; si no, avisa de cuál sería la de mayor coste real sin
  preseleccionar nada — la elección final sigue siendo del hogar, mismo criterio que el propio aviso
  de reordenación de DEB5. Se muestra en cada «Comparar» de AP1, junto al resto de piezas de DLX1/
  DLX2/DEB2. Tests: `tests/deb10-prioridad-fiscal-sugerida-ap1.test.cjs`.
- **`GOB17` — el asistente cita la función `canonical-*.js` real, no solo un id de categoría**:
  `sourceCatalog()` (`canonical-e9-assistant.js`) antes solo propagaba `source`/`method` en métricas;
  ahora también en alertas y decisiones, sin tocar su contrato de validación (campos añadidos,
  ninguno retirado). CP1 (`cp1NextBestAction`, `p2-ui.js`) declara su fuente real una sola vez
  (`canonical-e16-monitoring.js` · `predictiveAlerts()`, la única función que genera sus tres tipos de
  alerta) y CP2 (`cp2IdleCashSignal`) declara la suya (`canonical-cushion.js` + `canonical-portfolio.js`
  · `cushionFloor()`/`opportunityCost()` vía `cp2IdleCashSummary` en `app.js`). Ambas citas reales se
  muestran al hogar junto al id interno (`rgx4TwoLevelExplanationHtml` y `cp2IdleCashHtml`), nunca en
  su lugar — compatibilidad hacia atrás intacta cuando no hay `citedSource` declarado. Tests:
  `tests/gob17-cita-funcion-real.test.cjs`, más ajustes de compatibilidad en los sandboxes ya
  existentes de `tests/cp1-proxima-mejor-accion.test.cjs` y `tests/cp2-dinero-parado.test.cjs`.
- **Validación**: `npm run verify` completo en verde. `npm test` **3705/3705** pruebas (16 nuevas:
  7 en `tests/deb10-prioridad-fiscal-sugerida-ap1.test.cjs`, 9 en
  `tests/gob17-cita-funcion-real.test.cjs`; más 1 wiring existente actualizado en
  `tests/ap1-app-integracion.test.cjs` por la nueva llamada a `deb10PriorityHint` dentro de
  `handleAp1Compare`). `test:a11y`, `test:performance`, `build:site`, `test:privacy` y `test:smoke`,
  todos sin errores.
- **Pendiente para la siguiente oleada**: `PVC12` (consolidación de estacionalidad/deriva, candidata a
  sesión propia) y el resto de los Bloques 3-7 de `BACKLOG_ULTIMATE_SEPTIEMBRE_OLEADA_4.md`
  (`PVC11`/`PVC13`-`19`, `INV11`-`20`, `LEV10`-`16`, `DEB11`-`17`, `GOB11`-`19`), 41 tareas accionables
  intactas.
- **Publicado**: la rama de trabajo (`claude/vibrant-meitner-qc99i8`) se reinició desde `main` porque
  el PR de la sesión anterior (#274) ya estaba fusionado; commit y push del trabajo de esta sesión, PR
  en borrador abierto y fusión a `main` en cuanto el CI esté en verde, por la autorización de
  publicación sin preguntar en cada tarea ya vigente (`CLAUDE.md`).

## Cierre de sesión — 11 de septiembre de 2026 (166b): primera oleada de `BACKLOG_ULTIMATE_SEPTIEMBRE_OLEADA_4.md`

El usuario pidió abordar la primera oleada de desarrollos del backlog recién nacido en la sesión 166,
siguiendo su propio "Plan de ejecución sugerido" (§10): Bloque 1 (verificaciones) antes que cualquier
construcción, y las dos banderas del Bloque 2 justo después por ser el mayor impacto sin depender de
ninguna decisión de alcance previa.

- **Bloque 1 — las tres verificaciones, hechas por lectura directa del código real** (nunca de la
  documentación de backlog):
  - `VER-4`: `fiscalAdjustedDebtPriority()` (DEB5) **no** está cableada a `surplusAllocationRule()`/
    `dimensionOptimalPrepayment()` — el hogar elige a mano qué deuda amortizar en `#ap1DebtSelect`,
    sin ver la prioridad fiscal ya calculada en Contratos. Alcance de `DEB10` confirmado: cableado
    completo, no un aviso.
  - `VER-5`: el asistente (`canonical-e9-assistant.js`) **no** cita la función `canonical-*.js` real
    que sustenta cada dato — `validateResponse()` solo exige que la cita exista como id de categoría
    genérica (`metric:idle-cash`), nunca el archivo/función de origen; los campos `source`/`method`
    que sí lo permitirían (`executive-read-model.js`) no se rellenan en ningún punto real (CP1/CP2).
    Alcance de `GOB17` confirmado: se construye completa.
  - `VER-6`: `categoryDriftWindows()` (PVC4) y `_detectMonthlySeasonality()` leen de fuentes de datos
    distintas — la primera solo meses cerrados y reconciliados, la segunda transacciones vivas del
    mes en curso. Alcance de `PVC12` confirmado: consolidación de alcance mayor (candidata a sesión
    propia), no un simple recableado.
  - Las tres, junto con el alcance ya confirmado de `DEB10`/`GOB17`/`PVC12`, quedan documentadas en
    `BACKLOG_ULTIMATE_SEPTIEMBRE_OLEADA_4.md` y en `BACKLOG_INDICE.md`.
- **Bloque 2 — las dos banderas del diagnóstico, construidas de punta a punta**:
  - `LEV9` — comparador cruzado de instrumentos de apalancamiento (Lombard / hipoteca / línea de
    crédito) para una misma necesidad de capital. Motor nuevo `canonical-leverage-cross-comparator.js`
    (`crossInstrumentLeverageComparison()`), que reutiliza sin reimplementar `lombardCreditCapacity`
    (APX2), la misma cuota francesa que `canonical-mortgage-rate-scenarios.js` y
    `evaluateEmergencyCreditLine` (DI2), señalando además qué guardarraíl aplica a cada instrumento
    (`AP4` no cubre Lombard; `LEV1` informativo en los tres) y cuál sale más barato. Tarjeta nueva en
    Ajustes › Deuda y apalancamiento, entre APX3 y el comparador AP1.
  - `DEB9` — síntesis única "cancelar vs. mantener deuda", con las cuatro piezas que la sustentan
    siempre visibles (nunca combinadas en una única cifra "mejorada", mismo criterio que la
    advertencia de `PVC14`). Motor nuevo `canonical-debt-cancel-or-hold-synthesis.js`
    (`cancelOrHoldDebtSynthesis()`), que cruza el veredicto de AP1 con `netDebtCostAfterTax` (APX1),
    `waitingOptionValue` (DEB3), `dimensionOptimalPrepayment` (DEB2) y `liquidityLadder` (INV7); el
    guardarraíl de colchón (DLX1) manda primero — en `insostenible`, ninguna otra pieza puede
    recomendar cancelar. Tarjeta nueva justo debajo del comparador AP1, recalculada con su mismo
    botón «Comparar», sin pedir ningún campo nuevo.
  - Ambos motores son puros (sin DOM ni estado global), nunca ejecutan ni deciden nada por el hogar —
    mismo contrato que `A11-4` y el resto del bloque de apalancamiento/deuda.
- **Validación**: `npm run verify` completo en verde. `npm test` **3689/3689** pruebas (24 nuevas en
  `tests/lev9-comparador-cruzado-apalancamiento.test.cjs` y
  `tests/deb9-sintesis-cancelar-mantener-deuda.test.cjs`, motor + wiring de ambas tarjetas).
  `test:a11y` **1215 IDs únicos** (+12 sobre los 1203 de la sesión 165, por las dos tarjetas nuevas,
  ninguno duplicado). `test:performance`, `build:site`, `test:privacy` y `test:smoke`, todos sin
  errores (el contenedor no traía `node_modules`; tras `npm install`, las 7 fallas iniciales de
  `build:site`/`esbuild` desaparecieron — mismo problema ya documentado en sesiones 165-166, no
  relacionado con este cambio).
- **Pendiente para la siguiente oleada**: `DEB10`, `GOB17` y `PVC12` con su alcance ya confirmado
  (ver arriba) pero sin construir todavía; el resto del Bloque 3 en adelante (`PVC11` y siguientes)
  sigue intacto en `BACKLOG_ULTIMATE_SEPTIEMBRE_OLEADA_4.md`.
- **Publicado**: commit y push a `claude/vibrant-meitner-qc99i8`, PR en borrador abierto y fusión a
  `main` en cuanto el CI esté en verde, por la autorización de publicación sin preguntar en cada tarea
  ya vigente (`CLAUDE.md`).
