# Estado del proyecto

Fecha de revisión: 19 de octubre de 2026 (sesión 320). **Único backlog vivo: `BACKLOG_DEFINITIVO.md` (§0 y §1); plan en `docs/PLAN_DESARROLLO_DEFINITIVO.md`. Desarrollo iniciado el 3/10/2026: Ola 1 en curso.**

## Índice de decisiones vigentes (GOB3 — trimestral, T3 2026: jul-sep)

Este documento se archiva por bloques desde el 28 de septiembre de 2026 (sesión 258): cuando
supera unas ~100 entradas de cierre de sesión recientes, las más antiguas se mueven tal cual (sin
resumir ni perder detalle) a `docs/historial/`, con un enlace aquí mismo. Este índice no repite el
detalle de cada cierre — vive en su propia entrada, en orden cronológico descendente más abajo —
solo señala qué decisiones de fondo siguen aplicando *hoy*, para no tener que releer el historial
completo. Se regenera una vez por trimestre (próxima revisión: T4 2026, oct-dic); una decisión que
quede invalidada por un cierre posterior se retira de aquí en la siguiente regeneración, no al
momento.

- **Plan de UX por olas (30 de septiembre de 2026, sesiones 268–279)**: decisiones del hogar que siguen aplicando — camino B de la Ola 1 (nueve pantallas, ritmos como
  rótulos, **cero pantallas nuevas**); retirar una pantalla = **redirigir sin borrar código** y solo con el informe «Uso de la app» y OK pantalla a pantalla (el contador vive
  en el navegador de cada dispositivo); rendimiento «carga honesta» (pantallas ocultas de partida, cabecera en su estado final, LCP de Lighthouse a aviso con el mismo umbral,
  puerta `test:load-budget` de contenido de Hoy en visita repetida); **nunca cambiar umbrales de CI ni relajar una prueba para dar verde**. Móviles del hogar: iPhone 17 e
  iPhone 15 Pro. La Ola 2 (Hoy con veredicto, modo consulta) **espera cinco decisiones del hogar**; el modo consulta recomendado es solo nivel 1 y **no protege** —el nivel 2
  contradice `docs/OPT22_MODELO_HOGAR.md`—. Estado completo, bloqueos y deuda técnica en `BACKLOG_UX_OLAS.md`.
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

Las sesiones del 11 de septiembre al 8 de octubre de 2026 (de la 166b a la 303) se movieron igual, sin
resumir, a [`docs/historial/PROJECT_STATE_2026-09-11_a_2026-10-08.md`](docs/historial/PROJECT_STATE_2026-09-11_a_2026-10-08.md)
el 30 de octubre de 2026 (sesión 379): el documento había llegado a 281 entradas y unas 9.300 líneas.

## Cierre de sesión — 30 de octubre de 2026 (379): ensayo final del cierre, y NIN-08 (dinero parado) listo para el 4/11

- **Ensayo final del cierre** (exploratorio, fuera del repositorio), con `main` tras #568, #569 y #570:
  - Reimportar el mes da «4 nuevos · 22 ya estaban».
  - 40 € de efectivo tecleados en Registrar se conservan al reimportar (real = banco 420,52 € + 40 €), y el real sin banco (50 €) también.
  - Octubre queda con 0 tareas, 0 descuadres y 0 huecos. «Firmar cierre» solo espera la sesión.
- **Panel de seguimiento** regenerado (versión 12) y registro con las entradas del 29 y el 30/10.
- **NIN-08 · dinero parado (WP-42)**, pedido por el hogar como «siguiente paquete del plan». **Construido y sin fusionar hasta el 4/11**, tras firmar octubre (condición aceptada por el hogar).
  - Motor `idleCash` en `canonical-next-euro.js`: el mínimo mensual de la previsión menos el suelo del colchón, a 3, 6 y 12 meses, y un comparador bruto, neto y neto al año sin elegir «el mejor».
  - Interfaz en `escalera-ui.js` (`#proxEuroParado`) con el botón «Repartir X € en la escalera».
  - En prueba, «dinero-parado», con interruptor propio y `encendidaDesde` el 4/11. WP-42 queda marcado `enPrueba: propio` en el plan.
  - Medidor de uso, Novedades (fechada el 4/11) y `docs/WP42_DISENO.md` §7.
  - Arreglado durante la revisión:
    - Los campos pasan a texto con coma, porque «2,5» no se podía escribir en un campo numérico.
    - La tabla pasa a lista: a 390 px solo enseñaba el producto, y en escritorio escondía el neto al año.
    - El foco vuelve a «Comparar» tras calcular.
    - Una variable llamada `window` hacía saltar la prueba de pureza del motor.
- **Hoja de la revisión posterior al cierre** (`docs/REVISION_POST_CIERRE_2026-11.md`): qué funciones en prueba se revisan el 2, 4, 7 y 12/11, su métrica y con qué criterio se decide, escrito antes de ver los datos. Con un hogar y un cierre, se apaga lo que molesta, se gradúa lo usado en el cierre y el resto se aplaza. Hoy nuevo no tiene línea base (WP-02), así que su cifra no se puede juzgar.
- **Validación:**
  - `npm test` 6267/6267 (+6), con `lint` y `typecheck` limpios.
  - En local, las E2E de NIN-08, WP-42, WP-47, XGO-01 y XGO-03: 8 de 8.
  - Accesibilidad (axe) de Deuda: 16 de 16.
  - Capturas a 1280 px (claro) y 390 px (oscuro).

## Cierre de sesión — 29 de octubre de 2026 (378): reales, banco + lo anotado aparte

- **Hallazgo (Claude, revisando el cierre):**
  - `applyMovementMappingsToActuals` (tras clasificar o importar) escribía el real de cada partida y mes abierto con la suma del banco, sin más.
  - Un real tecleado a mano que incluía algo fuera del banco (el súper: 80 € con tarjeta y 40 € en efectivo) quedaba en 80 €.
  - Y una partida que se quedaba sin movimientos al reclasificar conservaba el real viejo.
- **Decisión del hogar (29/10):** «Sumar banco + lo anotado aparte».
- **Cambio (`app.js`):**
  - `bankActualTotals` (la suma de siempre) y `mergeBankActuals` (pura).
  - Almacén `bank-actuals-applied` en `BACKUP_LOCAL_STORES` (copia y nube): la suma del banco aplicada por última vez a cada partida y mes.
  - Al aplicar el banco, lo anotado aparte = real actual − suma aplicada la última vez, y el real nuevo = banco nuevo + lo anotado aparte. Sea cual sea la pantalla en que el hogar cambió el real, se respeta.
  - La primera vez que el banco llega a un real tecleado antes, lo que pase de la suma del banco queda aparte (el tecleado era el total); si es menor, manda el banco.
  - Una partida que se queda sin movimientos conserva solo lo anotado aparte, o se queda sin real.
  - Los meses cerrados no se tocan.
  - Al abrir sin almacén, el punto de partida es el banco de hoy, en memoria: abrir o mirar la app no escribe nada (la E2E de WP-45 lo vigila y lo detectó en la primera versión).
  - `canonicalLedgerActuals` compara el extracto con la parte del banco del real.
- **A la vista:**
  - Registrar › Reales enseña «Banco X € + Y € anotado aparte» cuando hay algo aparte (`registrar-ui.js`, estilo en `calma.css`).
  - La guía del cierre (paso 5) lo explica.
  - Novedades y BACKLOG §0.
- **Pruebas:**
  - `tests/reales-banco-aparte.test.cjs`, 8 casos: real tecleado antes del banco, real menor que el banco, lo aparte se conserva al llegar más banco, reclasificar, partida sin movimientos, mes cerrado y real sin banco, punto de partida sin escribir, y el libro.
  - `tests/wp30-ciclos-tarjeta.test.cjs` corta el bloque nuevo.
  - E2E «Reales: banco + lo anotado aparte» (120 → 120; corregido a 95 y +30 de banco → 125; Registrar lo dice).
- **Validación:**
  - `npm test` 6261/6261, con `lint` y `typecheck` limpios.
  - En local, E2E de reales, clasificar, importar, cierre, movimientos, Registrar, duplicados, tarjetas y WP-45: 74 de 74, más la nueva.

## Cierre de sesión — 29 de octubre de 2026 (377): importar otra vez un extracto que se solapa cuenta solo lo nuevo

- **Hallazgo del ensayo (375):**
  - Al volver a importar el mes entero, la revisión decía «Importar 26 movimientos · 26 sin partida irán a la bandeja» cuando entraban 4.
  - `datosImportarDuplicateCandidates` excluye a propósito las filas idénticas a otras guardadas (misma identidad), y `mergeTransactions` las funde sin repetirlas. El resultado era correcto, pero los números no.
- **Cambio:**
  - `views/importar-v2.js` › `impV2Counts` cuenta `yaEstaban` (incluidas cuya `transactionIdentity` ya está guardada) y `nuevos`.
  - El botón dice «Importar N movimientos nuevos»; si no hay nuevos, «Importar (no hay movimientos nuevos)», que sigue sirviendo para tomar el saldo final.
  - La nota añade «N ya estaban en la app y no se repiten», y «sin partida irán a la bandeja» deja de contarlos.
  - `importar-extracto-ui.js` devuelve también `nuevos` y `yaEstaban`. El resultado dice «N movimientos nuevos importados · M ya estaban en la app y no se han repetido».
  - Sin filas repetidas, todo se lee como antes.
  - Versiones de los dos *scripts*. Novedades y BACKLOG §0.
- **Pruebas:**
  - E2E nueva «Importar otra vez un extracto que se solapa»: 3 movimientos y luego 5, con 2 nuevos, y la app queda con 5.
  - `tests/redis-a4-importar.test.cjs` gana los dos *stubs* que ahora usa la revisión.
- **Validación:**
  - `npm test` 6253/6253 y `lint` limpio.
  - En local, E2E de importar, extracto, A4, duplicados y captura: 34 de 34.

## Cierre de sesión — 29 de octubre de 2026 (376): el cierre solo de Chromium ya no tumba el CI

- **Problema:** Chromium se cae solo entre pruebas («SEGV_MAPERR 0x1b0» tras «InitializeSandbox() called with multiple threads in process gpu-process»), en el CI y en local; `--disable-gpu` no lo evita (entrada 373). La prueba siguiente fallaba al crear su contexto, antes de ejecutar nada. El 29/10 tumbó el primer intento de #567 y el de #568 (una prueba de Hoy, ajena al cambio).
- **Arreglo:**
  - Nuevo `tests/helpers/navegador-resiliente.cjs`, que cargan las cuatro *specs* de Playwright (`qa1`, `opt4`, `p4` y `e18`). Sobrescribe el `browser` del *worker* con un intermediario.
  - Al crear el contexto de una prueba, si el navegador ya está desconectado y el error es el de navegador cerrado, lo relanza **una vez** con las mismas opciones y deja un `::warning` con el título de la prueba.
  - **No reintenta pruebas:** un fallo dentro de una prueba sigue fallando, y un segundo fallo al relanzar sale tal cual.
  - Safari conserva su reintento (trampa 15). Los guiones que lanzan Chromium por su cuenta (`test:mobile-overflow`, Lighthouse) no cambian.
- **Prueba:**
  - E2E «Navegador que se cae entre pruebas», en serie: la primera cierra el navegador a propósito y la segunda abre la app.
  - Comprobado que sin el arreglo la segunda falla con el mismo error que en el CI («browser.newContext: Target page, context or browser has been closed»), y con él pasa.
- **Validación:**
  - `npm test`: 6253/6253, con `lint` y `typecheck` limpios.
  - En local: la E2E nueva y la de «solo bloquea el mes», 3 de 3.
  - El resto, en el CI.
- BACKLOG §0 y trampa 16 en §10.

## Cierre de sesión — 29 de octubre de 2026 (375): ensayo del cierre con historial, dos bloqueos más arreglados, y la guía se ve

- **Ensayo (pedido por el hogar):** recorrido exploratorio del 2/11 con Playwright y datos INVENTADOS como los reales. Está en el scratchpad de la sesión, no en el repositorio.
  - Historial de CaixaBank de marzo al 24/10 sin clasificar, y un real de octubre tecleado a mano en una partida sin banco.
  - El 2/11: importar el extracto de octubre entero (se solapa con lo ya importado), clasificar en la bandeja e ir a Cierre.
- **Lo que funcionó:**
  - Los duplicados se descartan: de 26 líneas entran 4.
  - El saldo final del extracto pasa a ser el declarado en «Real manual», y CaixaBank cuadra.
  - La bandeja clasifica por concepto todo el historial de una vez.
- **Bloqueo 1, huecos de saldo falsos (`canonical-ledger.js`):**
  - La continuidad ordenaba por `sourceRow`, que es la fila dentro de cada fichero. Con varios extractos de una cuenta (uno por mes, o el mes entero importado otra vez) mezclaba meses y se inventaba huecos. Dentro de un día, el CSV entra con la misma fila y en orden alfabético, y también los daba.
  - Ahora `chainByDate` ordena por fecha y, dentro de un día, por el orden que encadena los saldos; la orientación del fichero queda solo como desempate y como etiqueta en Conciliación.
  - En el ensayo pasó de 2 huecos (uno en octubre, que bloqueaba) a 0.
  - Tres unitarias nuevas en `tests/canonical-ledger.test.cjs`: varios ficheros, orden del día y un salto de verdad que se sigue viendo.
- **Bloqueo 2, un real a mano sin banco detrás (`views/cierre.js`):**
  - Daba «Diferencias banco/real» y bloqueaba la firma; solo se quitaba borrando el real, en contra de lo que dice la guía («avisa, no bloquea»).
  - Decisión del hogar: «Solo comparar si hay banco». `cierreBankActualDifferences` solo compara las partidas con movimientos clasificados del extracto ese mes.
  - `#conciliar` (el inventario) no cambia. Una unitaria nueva.
- **Pendiente visto en el ensayo (no bloquea, sin tocar):** «Importar 26 movimientos · 26 sin partida irán a la bandeja» cuando 22 ya estaban en la app. El resultado es correcto (entran 4), pero la revisión no dice cuántos son nuevos.
- **La guía se ve (pedido del hogar: «apenas se ve»):**
  - Plegada es una tarjeta con fondo y borde del color principal, icono, «Paso a paso», el título, una barra con lo marcado (`#cierreGuiaBarra`) y el botón «Abrir la guía» / «Plegar».
  - En el móvil, el botón ocupa todo el ancho. Revisada en capturas a 1440 px (claro y oscuro) y a 390 px.
  - Estilos en `calma.css`. La E2E de la guía comprueba que la barra avanza y el botón.
- **Validación:**
  - `npm test` en verde, 6253/6253 (+4), y `lint` limpio.
  - En local, las E2E de Cierre (guía, solo el mes, ensayo del 23/10, carta, sombra y plan B): 12 de 12, y la guía otra vez tras la prueba de la barra.
  - Accesibilidad (axe): 99 de 99.

## Cierre de sesión — 29 de octubre de 2026 (374): firmar un mes solo depende de ese mes

- **Hallazgo (Claude, en una captura del hogar):** con los datos reales, Cierre contaba como pendiente **todo el historial**. `renderCierre` pasaba a `reconciliationTasks` todos los movimientos sin clasificar, todas las diferencias entre banco y real, y todos los huecos de continuidad del libro. «Ninguna diferencia abierta» exige cero tareas, así que firmar octubre pedía clasificar antes cientos de movimientos de meses anteriores. Era inviable para el primer cierre real (1-3/11). El ensayo del 23/10 partía de cero movimientos y no lo podía ver.
- **Decisión del hogar (29/10):** «Solo el mes que cierras».
- **Cambio (`views/cierre.js`):**
  - `cierreTaskSourcesByMonth` reparte las fuentes entre el mes que se cierra y el resto: los movimientos por su mes, las diferencias por el de su línea y los huecos de saldo por el del movimiento donde aparecen.
  - Contadores, paso «Resolver diferencias», comprobaciones de la firma y evidencia (PDF/CSV) usan solo las del mes.
  - El descuadre del capital de deuda (D-2b) no tiene mes: va siempre con las del mes y sigue bloqueando.
  - `#cierreOtrosMeses`, bajo los contadores, dice cuántas tareas hay de otros meses y cuántos movimientos sin clasificar, que no impiden firmar, y enlaza a Movimientos.
  - Anteriores y posteriores cuentan igual: del 1 al 3 se cierra octubre y los movimientos de noviembre no bloquean.
  - El inventario completo de `#conciliar` no cambia.
- **Textos:** la guía del cierre (paso «Clasificad lo que falte») dice que solo bloquean los del mes. Novedades.
- **Pruebas:**
  - Dos unitarias en `tests/c1-c9-cierre-wizard.test.cjs`: el reparto por mes, con la deuda siempre en el mes, y el texto con miles agrupados.
  - La de forma de D-2b sigue el reparto nuevo.
  - E2E «Cierre · solo bloquea el mes que se cierra» con el reloj el 2/11: movimientos viejos sin partida no bloquean y se dicen aparte; uno de octubre sin partida sí bloquea.
- **Validación:**
  - `npm test` en verde, 6249/6249 (+2), con `lint` y `typecheck` limpios.
  - En local, Playwright de Cierre (la nueva E2E, el ensayo del cierre a 390 y 1440 px, la carta del mes y el aviso de deuda en la sombra): 9 de 9.
  - El resto, en el CI.

## Cierre de sesión — 29 de octubre de 2026 (373): lo nuevo nace encendido, y las siete funciones apagadas se encienden

- **Decisión del hogar (29/10):** «vamos a cambiar esta regla de "todo lo nuevo nace apagado", y reactiva lo que esté pendiente». Deja sin efecto el «nace apagada» de XGO-03 (`BACKLOG_DEFINITIVO.md` §4).
- **Cambio:**
  - `funciones-en-prueba.js`: cada función con interruptor propio lleva `encendidaDesde`. Sin elección guardada, está encendida, y su revisión cuenta desde ese día. Apagarla en Ajustes › Funciones en prueba queda guardado y manda.
  - Las siete que estaban apagadas (XPR-06, XDA-01, XUX-02, XPR-07, XDA-10, WP-18 y WP-17) llevan `encendidaDesde: "2026-10-29"`: **sus revisiones caen el 12/11**.
  - Panel de seguimiento: las de interruptor propio cuentan como encendidas salvo que su estado diga «apagada».
- **Superficie (GOV-02):** solo «Lo que la app te pide» añade un titular a lo que se ve sin datos (Ajustes, de 57 a 58). Entra con una excepción escrita en `docs/gobierno/superficie.json`, con fecha, qué y por qué; el techo base no se toca.
- **Pruebas:**
  - Las unitarias de las siete funciones dicen ahora «encendida de serie».
  - `tests/xgo03-funciones-en-prueba.test.cjs` gana una: toda función con interruptor propio tiene `encendidaDesde`, está encendida de serie y apagarla queda guardado.
  - `tests/xpr06-que-mueve-cada-dia.test.cjs` comprueba que la revisión cuenta desde `encendidaDesde`, que apagarla manda y que apagada no pide revisión.
  - Las siete E2E que recorren «apagada» y «encendida» empiezan con la función apagada (`empezarApagada`), como lo haría el hogar.
  - `tests/plan-seguimiento-sincronizado.test.cjs` cuenta los interruptores desde el catálogo.
- **Validación:** `npm test` en verde, 6247/6247 (+1). El Playwright completo en local (e2e y accesibilidad): 260 de 264; las 4 que fallan lo hacen al abrir el navegador («Target page, context or browser has been closed»), con el mismo cierre de Chromium que tumbó el primer intento del CI de #567 («SEGV_MAPERR 0x1b0» tras «InitializeSandbox() called with multiple threads in process gpu-process»), ajeno al cambio. El reintento del CI salió en verde. Con `--disable-gpu` el cierre se repite (probado en local el mismo día), así que no es esa la salida.

## Cierre de sesión — 29 de octubre de 2026 (372): la guía del cierre de mes, dentro de Cierre

- **Por qué:** el hogar eligió «preparar el cierre». Claude publicó una página con los pasos del cierre de octubre, y el hogar pidió tenerla en la app «como tutorial, para seguir así estos pasos en el cierre de cada mes».
- **Qué hace** (`cierre-guia-ui.js`; tarjeta plegable `#cierreGuia` arriba de Cierre):
  - «Guía del cierre de {mes}», con el mes que toca cerrar: del 1 al 3, el que acaba.
  - Nueve pasos, cada uno con su pantalla, un enlace y si bloquea la firma o solo avisa: sesión, extracto, clasificar, saldos en «Real manual», reales, valorar, conciliar, diferencias y firmar.
  - Plegado, «Si algo no cuadra»: seis atascos con lo que suele ser y qué hacer.
  - Las casillas se guardan por mes en ese dispositivo, así que cada mes empieza en blanco; se guardan seis meses como mucho.
  - **Del 1 al 3, con el mes sin firmar, sale abierta**; el resto del mes, plegada.
  - No comprueba nada por su cuenta: lo que bloquea ya lo comprueba «Antes de firmar», y la guía lo dice.
- **Gobierno:**
  - **No nace apagada.** La pidió el hogar para usarla, así que está en Funciones en prueba sin interruptor, con revisión a las dos semanas. Es una desviación consciente de la regla de XGO-03.
  - Medidor: abrirla cuenta como vista y marcar un paso, como acción.
  - **Superficie por defecto sin cambios:** plegada y sin h2/h3 dentro; la prueba XGO-01 sigue en verde.
  - Una línea en Novedades. Su almacén (`cierre-guia`) se excluye de la copia con motivo: es una ayuda de ese dispositivo.
- **Pruebas:**
  - `tests/cierre-guia.test.cjs` (4): los nueve pasos y cuáles bloquean, el mes por su nombre, las casillas por mes, el tope de seis meses, un almacén roto y que no tiene titulares.
  - E2E «Guía del cierre de mes» a 390 px (también en Safari) y 1280 px: plegada a mitad de mes; del 1 al 3, abierta con «octubre»; lo marcado sobrevive a recargar; el enlace lleva a Movimientos.
  - Accesibilidad de Cierre (axe), claro y oscuro: 7 de 7.
- **Validación:** `npm run verify` en verde, 6246/6246 (+4). E2E de Cierre, XGO-01 y el ensayo del cierre en Chromium: 20 de 20.
- La página suelta del cierre de octubre (artefacto privado) queda como copia; la guía de la app es la que vale cada mes.

## Cierre de sesión — 28 de octubre de 2026 (371): WP-17 · PR-1, siguiente paso de la cartera (en prueba, apagada)

- **Por qué:** el hogar eligió «siguiente paquete del plan» frente a la recomendación de Claude («preparar el cierre de octubre»). Solo quedaban dos paquetes del plan sin empezar, y los dos esperan algo del hogar: WP-21 (paquete Renta, que espera a WP-31) y WP-17 (que espera la política firmada). WP-17 es el más corto, y sus reglas se pueden construir sin datos del hogar.
- **Qué hace** (arriba de Inversión › Cartera, tarjeta «Siguiente paso de la cartera»): la cartera en una línea (valor, aportado, plusvalía y XIRR) y **una sola acción**, con su motivo y la regla que la origina; el resto, plegado. Orden fijo:
  1. valorar lo que lleva más de 35 días sin valor;
  2. lo que choca con la política firmada (cripto, apalancamiento);
  3. el reparto fuera de la banda: el de la política firmada o, sin ella, el de Rebalanceo con el umbral de 10;
  4. compensar plusvalías antes del 31/12, del 1/10 al 31/12, con plusvalías del año sin compensar y una posición en pérdidas;
  5. la política: sin firmar, cambiada o por revisar;
  6. la convicción sin confirmar en 12 meses.
- **Honestidad:**
  - **Nunca opera ni escribe** (una prueba lo comprueba).
  - Con «rebalancear primero con aportaciones», nunca propone vender. Una venta por reparto pide mirar antes el coste fiscal.
  - La acción fiscal cita la norma de recompra y dice que no es una recomendación de vender.
  - «Nada pendiente» dice qué ha mirado, no que la cartera esté bien.
- **Motor y pantalla:** `canonical-next-best-action.js` (puro) y `siguiente-paso-ui.js`. Reúne los hechos con los motores de siempre: frescura de WP-15, política de WP-39, reparto de IV6, compensación de FC3, candidatas de INV6 y convicción de I12.
- **Gobierno:**
  - Apagada en Funciones en prueba: la séptima. El plan la marca `"enPrueba": "propio"` y el panel la cuenta.
  - Medidor de vista y de acción seguida, y una línea en Novedades. Superficie por defecto sin cambios.
- **Fuera de este PR-1** (`docs/WP17_DISENO.md` §4):
  - «aportación pendiente», que necesita NIN-04;
  - la barra objetivo frente a actual y las tarjetas en el móvil;
  - que la banda de la política gobierne IV6.

  **Sin la política firmada (H-12), sus reglas no mandan.**
- **Pruebas:**
  - `tests/wp17-siguiente-paso.test.cjs` (8).
  - E2E «WP-17 · Siguiente paso de la cartera» a 390 px (también en Safari) y 1280 px: apagada no sale; encendida, «Vended unos 2.000 € de fondos» con su motivo; sin valorar, manda valorar y abre la hoja.
  - `tests/arq3-canonical-sin-consumidor-ui.test.cjs`: 115 → 116 motores, con su consumidor en `views/inversion.js`.
  - Captura a 390 px revisada.
- **Validación:** `npm run verify` en verde, 6242/6242 (+8). E2E de WP-17, WP-18, XGO-01 y XGO-03 en Chromium: 7 de 7.

## Cierre de sesión — 28 de octubre de 2026 (370): decisiones del hogar sobre sus tareas (sin cambios en la app)

- **H-03 no se hace** («dejamos los datos de ejemplo»): **WP-23 pasa a aparcado.**
  - Está todo construido y contrastado, pero sin datos reales no habrá lista con euros antes del 15/11, que era su «hecho cuando».
  - Se reactiva si el hogar teclea sus datos fiscales (unos 20 min); tiene sentido hasta mediados de diciembre.
- **H-22, hecha** por declaración del hogar. Su parte de anotar qué formatos da cada app del banco (paso 0 de XDA-02) no ha llegado por el chat.
- **H-05**, sigue para el 1/11.
- **WP-18 se enciende ya.** El interruptor está en Ajustes › Funciones en prueba del navegador del hogar; desde aquí no se puede. Su revisión de dos semanas cuenta desde ese día.
- **Simular el cierre de octubre con datos estimados y reabrirlo**:
  - **Es posible, pero solo desde la app y con la sesión del hogar.** Fuera de los días 1-3, «Cerrar mes» propone el mes en curso, y «Reabrir» existe. Las dos cosas exigen sesión iniciada y sincronizada, y quedan firmadas en el historial de la nube.
  - **No desbloquea métricas:** WP-09, WP-12, WP-46 y WP-18 esperan datos reales a propósito. Lo que sí da es un ensayo del recorrido con los datos del hogar antes del 1/11.
- Panel de seguimiento al día (H-03, H-22, WP-23 y el registro). `docs/ESTADO_TAREAS_Y_FASES.md` y `BACKLOG_DEFINITIVO.md` §0, al día.
- **Validación:** `npm run verify` en verde, 6234/6234 (solo cambia documentación).

## Cierre de sesión — 28 de octubre de 2026 (369): las rentabilidades de Cartera, con el formato de la app

- **Por qué:** con WP-18, Inversión › Cartera enseñaba dos formatos a la vez: la tarjeta nueva decía «+43,1 % al año» y la lista de al lado, «XIRR +43.13% anual». Es la deuda de `docs/rediseno/ESTADO.md` §5 («se arreglan en origen»), aquí solo para Cartera.
- **Cambio:**
  - `app.js`: `iv2Num` y `iv2Pct` (coma decimal, un decimal, espacio antes de «%», sin «-0»).
  - `iv2XirrLabel` dice «XIRR +43,1 % al año». La plusvalía de cada posición, la de la cartera y la de «Vende esta primero» pasan a «(13,8 %)».
  - El índice de referencia, a «(7 % al año)».
  - **De paso, una frase mal construida:** «queda por debajo del índice declarado por -2.3 puntos» pasa a «por 2,3 puntos».
  - `aportado-ui.js` usa el mismo `iv2Pct`.
  - Versiones de `app.js` y `aportado-ui.js` en `index.html`, y una línea en Novedades.
- **Siguen con el formato viejo, fuera de Cartera:** la XIRR citada en el simulador de liquidez ociosa (`app.js`) y en el coste de oportunidad de Partidas (`partidas-ui.js`). Anotado en `docs/WP18_DISENO.md` §5.
- **Pruebas:** `tests/iv2-app-integracion.test.cjs` gana una: el formato con cifras, el motivo cuando no es calculable, sin «-0», y que los patrones viejos de Cartera ya no están. Las E2E de Cartera (WP-15, WP-18, WP-46 y el kit de gráficos) salen en verde: 12 de 12.
- **Validación:** `npm run verify` en verde, 6234/6234 (+1). **Tropiezo, corregido antes del push:** la primera validación completa dio 34 fallos.
  - **Causa 1, la versión de `app.js`:** se fija literal en 27 ficheros de pruebas, que se actualizan juntos como en cada cambio de versión.
  - **Causa 2, el gráfico de Cartera:** `tests/i9-grafico-cartera.test.cjs` carga `iv1PositionChartRowsHtml` suelta y ahora también necesita `iv2Num`/`iv2Pct`.
  - **La lección:** antes de dar por bueno un cambio en `app.js` se pasa la batería entera, no solo las pruebas de la pantalla.

## Cierre de sesión — 28 de octubre de 2026 (368): Safari reintenta una vez en el CI, y lo que falló queda escrito

- **Por qué:** en un día fallaron de vez en cuando tres pruebas distintas que solo corren en WebKit, el motor del Safari del iPhone:
  - el ensayo del cierre de octubre, en #559;
  - el interruptor del diseño nuevo, en `main` tras #560 (run 1215);
  - el foco al terminar el Repaso semanal, en el primer relanzamiento de #562.

  Las tres pasaron en otras ejecuciones del mismo código. Aquí no se pueden reproducir, porque no se instala WebKit, y cada fallo costaba unos 45 min de CI. #562, que solo tocaba el panel, necesitó tres intentos; el segundo cayó además por un cierre de Chromium (SIGSEGV).
- **Decisión del hogar (28/10):** «1 reintento solo en Safari», sobre la opción recomendada. Deja sin efecto, solo en eso, el «bloquea a la primera» de P14 (19/10).
- **Cambio (sin cambios en la app):**
  - `playwright.config.cjs`: el proyecto `safari` lleva `retries: process.env.CI ? 1 : 0`. En local no reintenta, y el resto de proyectos tampoco.
  - `.github/workflows/pages.yml`: si Safari pasa tras reintentar, lo que vio Playwright en el intento fallido (`error-context.md`) se escribe en el registro, con un aviso «Safari intermitente» en el PR.
  - Dos fallos seguidos siguen bloqueando.
  - Trampa 15 en `BACKLOG_DEFINITIVO.md` §10 y nota en `docs/rediseno/ESTADO.md`. **Ese aviso es trabajo:** se busca su causa, no se ignora.
- **Prueba:** `tests/ci-informe-playwright.test.cjs` gana una. Exige que solo `safari` reintente y solo en el CI, y que el paso escriba el intento fallido.
- **Validación:** `npm run verify` en verde, 6233/6233 (+1).
- **Pista sin resolver:** el fallo del Repaso puede ser real en el iPhone. Al terminar el repaso desde Hoy, el foco del teclado debería volver al primer botón de Hoy, y en WebKit a veces se queda en ningún sitio. No afecta al uso con el dedo. Queda para cuando el registro del reintento diga más.

## Cierre de sesión — 28 de octubre de 2026 (367): el panel cuenta también las funciones en prueba de los paquetes

- **Por qué:** al anotar WP-18 en el panel de seguimiento salió un hueco. El indicador «Funciones en prueba apagadas» solo miraba las filas del §5.0, así que seguía diciendo 5 cuando, con «Aportado frente a valor», ya son 6.
- **Cambio (sin cambios en la app):**
  - `docs/plan/plan-definitivo.json`: WP-18 lleva `"enPrueba": "propio"`.
  - `docs/plan/panel-seguimiento.html`: suma los paquetes marcados así. Están apagados mientras su estado no diga `prueba: "encendida"`.
  - `BACKLOG_DEFINITIVO.md` §12 explica la regla.
- **Prueba:** `tests/plan-seguimiento-sincronizado.test.cjs` gana una. Cada interruptor propio del catálogo de `funciones-en-prueba.js` (hoy 6) tiene que estar marcado en una fila del §5.0 o en un paquete, o el panel diría de menos. Comprobado en el panel generado: «6 · XPR-06 · XDA-01 · XUX-02 · XPR-07 · XDA-10 · WP-18», sin errores.
- **Validación:** `npm run verify` en verde, 6232/6232 (+1).

## Cierre de sesión — 28 de octubre de 2026 (366): WP-18 · PR-1, aportado frente a valor y TWR (en prueba, apagada)

- **Por qué:** el hogar pidió seguir con todo lo que no dependa de él. WP-18 (NIN-03, Ola 3) tenía cumplida su dependencia (WP-15, la hoja de valoración) y se puede construir sin datos del hogar. Nace apagada, así que no carga la semana del cierre de octubre ni arranca ninguna revisión.
- **Qué responde** (Inversión › Cartera, tarjeta «Aportado frente a valor», debajo de «Valoración de la cartera»):
  - «De cada 100 € de vuestra cartera, X los pusisteis vosotros e Y los ganó el mercado». En pérdidas, cuánto se ha llevado el mercado y qué % de lo puesto.
  - **La rentabilidad ponderada por tiempo (TWR)**, lo que hizo el mercado, junto a la XIRR de siempre, lo que ganó vuestro dinero. Cada una con su explicación.
  - Plegado, el detalle por posición: lo que costó, el valor, la TWR y la XIRR.
- **El cálculo** (`canonical-portfolio-valuation.js`, puro; `docs/WP18_DISENO.md`):
  - Encadena los tramos entre dos fechas con valor: el alta de cada posición, su valor declarado y las valoraciones de la hoja (a igual fecha manda la hoja).
  - Dentro de un tramo, cada aportación o venta cuenta por los días que estuvo invertida (Modified Dietz), porque la app no tiene el valor el día de cada flujo. La pantalla lo dice.
  - **Con menos de dos fechas con valor, «datos insuficientes»:** ninguna cifra, y un botón a «Actualizar valoración».
  - **Solo se anualiza con un año o más.** Antes, la TWR es la del periodo, y la tarjeta avisa de que entonces no se compara directamente con la XIRR.
  - En la cartera, una posición no valorada un día cuenta con su último valor, y la tarjeta dice cuántas veces pasa.
- **De paso:** la nota de la XIRR de Cartera (`app.js`) decía que la TWR «exige valoraciones intermedias que esta app no registra». Desde WP-15 sí las registra; ahora dice dónde está la TWR.
- **Gobierno:** apagada en Funciones en prueba (XGO-03, «Aportado frente a valor»), con medidor (XGO-02: vista y la acción de ir a valorar) y una línea en Novedades. No cambia la superficie por defecto (GOV-02): la tarjeta está oculta mientras la función esté apagada.
- **Lo que no hace este PR-1:** el gráfico de aportaciones acumuladas frente al valor (PR-2, con el kit de gráficos, solo si la tarjeta se usa); una TWR exacta (pediría el valor de cada posición el día de cada aportación); cambiar el formato viejo de la XIRR («+43.13%») en el resto de Cartera, deuda conocida de `docs/rediseno/ESTADO.md` §5.
- **Pruebas:**
  - `tests/wp18-aportado-twr.test.cjs` (6, con cifras calculadas a mano): un flujo al final del tramo no cuenta como mercado; la TWR no depende de cuándo se aportó; no se anualiza antes de un año; sin dos puntos no hay cifra; la cartera arrastra y lo cuenta; el reparto en ganancias y en pérdidas.
  - `tests/iv2-app-integracion.test.cjs`: la frase antigua ya no está.
  - E2E «WP-18 · Aportado frente a valor» a 390 px (también en Safari) y 1280 px: apagada no sale; encendida, 82 y 18 de cada 100, «+29,6 % del 1 ene al 1 oct», la XIRR «al año», el aviso de que no se comparan directamente, el detalle por posición con su TWR y su XIRR, sin desbordar; sin dos fechas con valor lleva a la hoja de valoración.
- **Validación:** `npm run verify` en verde, 6231/6231 (+6), más lint, typecheck, accesibilidad, rendimiento, build, privacidad y smoke. Playwright completo en local (Chromium): 262 de 263; el que falló era el arranque del navegador en la prueba de contraste de WP-32 y pasa relanzado solo (2 de 2).
- **Falta del hogar:** encenderla en Funciones en prueba cuando quiera, y valorar la cartera en el cierre del 1-3/11. **Si la posición tiene fecha de alta, con esa valoración ya sale la primera TWR.** El «≥ 3 valoraciones» del plan era para que la cifra signifique algo, no para que exista.
- **Tensión con la recomendación del 27/10** («ninguna función nueva hasta el cierre de octubre»): esta nace apagada y no pide nada al hogar hasta que la encienda, así que no compite con el cierre. Encenderla puede esperar a después del 3/11.

## Cierre de sesión — 28 de octubre de 2026 (365): las dos pruebas intermitentes del CI dicen por qué fallan

- **Por qué:** el hogar pidió seguir con todo lo que no dependa de él. Lo primero era el CI: dos pruebas en navegador fallan de vez en cuando, cada vez cuestan un relanzamiento de casi una hora y, en `main`, bloquean el despliegue.
  - **WP-40 (la CIRBE), en Chromium:** «element is not stable» durante 120 s al pulsar «Añadir fila». Ha fallado en #511 el 16/10, en #553 el 27/10 y en `main` tras #558 (run 1211).
  - **El ensayo del cierre de octubre, en WebKit:** tras «Importar 5 movimientos», el diálogo de confirmar no se abre. Falló en #559 y pasó al relanzar.
- **Lo que se probó, sin reproducirlo:**
  - WP-40 en local, 16 de 16 en verde. Un primer «12 de 12 en rojo» era el navegador: el Playwright del proyecto esperaba otra versión de Chromium (trampa 14, §10 del backlog).
  - Con la CPU ×6, con y sin desplazamiento suave (`scroll-behavior: smooth` en `styles.css`): el clic llega en 1-2 s.
  - Midiendo durante 5 s tras rellenar el formulario: ninguna mutación del DOM y ningún movimiento del botón. Tampoco hay bucle de repintado con la tarjeta de revisión del tipo, que observa la tabla de contratos.
  - WebKit no se puede instalar aquí.
- **Decisión:** sin la causa, no se toca la app ni la configuración global (emular `reduced-motion` habría sido una conjetura). En su lugar, **diagnóstico**:
  - `tests/helpers/pulsar-o-explicar.cjs`: `pulsar(page, selector)` hace el mismo clic. Si no puede en 20 s, mide durante 1,5 s y escribe en el error si el botón se movía (cuántas cajas distintas), qué zonas de la página se repintaban, si la página se desplazaba, dónde estaba el foco, qué diálogos había abiertos y los últimos clics y cambios del documento (`registrarEventos`, en fase de captura).
  - No reintenta ni alarga ningún tiempo: un fallo de verdad sigue fallando.
  - Lo usan los tres clics de «Añadir fila» de WP-40 y la confirmación del ensayo, que registra los eventos antes de pulsar «Importar».
  - Comprobado forzando el fallo: con un botón que se mueve en cada fotograma, «cajasDistintas: 50» y la zona que se repinta; con uno que no existe, «no existe».
- **Pruebas:** `tests/ci-informe-playwright.test.cjs` gana una (los cuatro clics pasan por el ayudante y este no reintenta). WP-40 y el ensayo del cierre, a 1280 y 390 px en Chromium: 12 de 12.
- **Validación:** `npm run verify` en verde, 6225/6225.
- **Siguiente:** con el próximo fallo de cualquiera de las dos, el registro del CI dirá la causa y se arregla de verdad.

## Cierre de sesión — 27 de octubre de 2026 (364): WP-23, el tramo autonómico de vivienda contrastado

- **Por qué:** era el punto 2 del plan aprobado («ok al plan»). El parámetro de vivienda de la campaña fiscal era el único de los cinco sin contrastar: faltaba el tramo autonómico de la comunidad del hogar. El hogar la dio por el chat; como el 23/10, **no se escribe en el repositorio**, que es público.
- **Contraste (27/10/2026)**, con el mismo método y el mismo límite que el 23/10: a través del buscador, porque el entorno no abre la sede de la AEAT ni el BOE.
  - **La regla**, en el manual de ayuda de Renta 2025 (anexo de la deducción por inversión en vivienda habitual): tramo estatal del 7,5 % y, en el autonómico, el porcentaje aprobado por la comunidad (art. 46 de la Ley 22/2009) o, si no aprobó ninguno, el 7,5 % (art. 78 LIRPF en su redacción a 31/12/2012).
  - **La comunidad del hogar no tiene porcentaje propio** para el régimen transitorio entre sus deducciones autonómicas del Manual práctico de Renta 2025 (parte 2). Una guía secundaria da el mismo 7,5 % + 7,5 %.
  - **Resultado:** 15 %, el valor que ya usaba el motor. **Ninguna cifra cambia.**
  - **Lo que no se pudo hacer:** leer entero el texto refundido autonómico.
- **Cambio:**
  - `canonical-year-end-tax.js`: vivienda pasa a `verified: true`, contrastado el 27/10, con la regla como fuente y sin `pending`. Los cinco parámetros de la campaña quedan contrastados.
  - La pantalla deja de decir «Pendiente de contrastar» en vivienda.
  - `docs/WP23_DISENO.md` §10 al día.
  - Una línea en Novedades.
- **Pruebas:** `tests/fis1-campana-fiscal.test.cjs` ahora exige:
  - los cinco parámetros contrastados, con su fecha;
  - que la fuente de vivienda explique el 15 % (7,5 % + Ley 22/2009);
  - **que no nombre ninguna comunidad autónoma**;
  - que la tarjeta de ejemplo no diga «Pendiente de contrastar» y sí «Contrastado el 27 de octubre de 2026».
- **Validación:** `npm run verify` en verde, 6224/6224 (las pruebas fiscales cambian sus aserciones, no su número), más lint, typecheck, accesibilidad, rendimiento, build, privacidad y smoke.
- **WP-23 sigue en curso:** falta H-03, los datos fiscales del hogar en la app, vencida desde el 20/10. Sin ellos la campaña solo enseña el ejemplo. Lista con euros antes del 15/11 (fecha del hito, 14/11).
- **Hallazgo para la Renta, confirmado en la fuente:** la deducción autonómica del 25 % sobre el exceso de intereses de la hipoteca variable respecto al Euribor de diciembre de 2022 existe en la comunidad del hogar (ficha de la AEAT, manual 2025, parte 2). Sigue fuera de esta campaña porque se pide en la Renta. Es candidata a WP-21, a decidir por el hogar.

## Cierre de sesión — 27 de octubre de 2026 (363): el panel de seguimiento ve el §5.0 y lo que la curva no veía

- **Por qué:** en la revisión de estado de esta sesión (modo Inicio), el panel solo contaba los 53 paquetes WP de la línea base del 3/10. Las 24 filas del §5.0 (rediseño y séptima auditoría, 33 PR desde el 18/10) no aparecían en ninguna parte, y el avance construido llevaba quieto desde el 21/10. Para decidir con él, el panel se quedaba corto en lo construido y no decía nada de lo que frena: funciones apagadas y tareas del hogar vencidas. El hogar aprobó el plan («ok al plan, empieza por el punto 1»).
- **Cambio, sin tocar la app:**
  - `docs/plan/plan-definitivo.json` gana `plataforma`: las 24 filas del §5.0 con su número, qué, origen, decisión del hogar y, si están en Funciones en prueba, si son pantalla del diseño nuevo (con fecha de revisión) o interruptor propio.
  - El panel (`docs/plan/panel-seguimiento.html`) las enseña en una pestaña nueva, «Rediseño y plataforma», con estado, PR, fin, estado en prueba (apagada, encendida, graduada, retirada), nota e historial, editables como los paquetes. Su estado vive en la base del panel (colección `plataforma`).
  - **Fuera de la línea base:** no suman a la curva ni al avance construido. Meterlas movería la línea base, y eso lo decide el hogar.
  - **Segunda fila de indicadores:** entregas del §5.0 hechas y PR fusionados, funciones en prueba apagadas (su revisión no empieza hasta encenderlas) y tareas del hogar vencidas (también en la pestaña «Tareas del hogar»).
  - El bloque «En marcha» deja de contar contra el límite de 3, que el hogar levantó el 26/10.
- **Estado inicial del §5.0**, tomado del backlog y de `git log`: 15 de 24 hechas, 8 esperando al hogar (XDA-02, XDA-04, XDA-03 y XDA-05 por su segundo PR; XDA-01, XUX-02, XPR-07 y XDA-10 por encenderlas) y 1 propuesta (RD-COB2). 5 funciones apagadas: XPR-06, XDA-01, XUX-02, XPR-07 y XDA-10.
- **Revisión de estado, con números del panel:** construido 64 % (87 de 136,75 sesiones) frente al 17 % de la línea base a hoy; comprobado 0 %; ninguna lectura de métricas. H-04 (revisión de salida de la Ola 1) marcada como hecha el 23/10, con las decisiones de ese día como prueba. H-03 (datos fiscales) vencida desde el 20/10: es la que más euros mueve antes del 31/12 (WP-23, lista el 14/11).
- **Recomendación de Claude, anotada en el backlog §1:** ninguna función nueva hasta el cierre de octubre (H-22 el 31/10, H-06 del 1 al 3/11) y las revisiones de Funciones en prueba del 2/11, el 4/11 y el 7/11.
- **Backlog:** §0 con esta entrada; §1.3 ya no dice que siga la regla de parada ni el límite de 3; §12 explica la pista fuera de la línea base y el id de documento de las filas del §5.0 (`RD-A1…A3` → `RD-A1-A3`).
- **Pruebas:** `tests/plan-seguimiento-sincronizado.test.cjs` gana una: el §5.0 del backlog y `plataforma` tienen las mismas filas con el mismo número. El panel se comprobó en Chromium con una base simulada a partir del estado real: 1280 px en claro y 390 px en oscuro, sin errores y sin desplazamiento horizontal.
- **Validación:** `npm run verify` en verde, 6223/6223. La primera pasada falló en 8 pruebas de build y de Playwright porque el contenedor no tenía instaladas las dependencias (`esbuild`); tras `npm ci`, todo en verde. Tras integrar `main` (#557, XGO-01 · PR-3, de otra sesión, que también numeró su entrada como 362: esta pasa a 363), otra vez en verde: 6224/6224.
- La revisión mensual de Nielsen no vence hasta el 14/11.

## Cierre de sesión — 27 de octubre de 2026 (362): XGO-01 · PR-3, el asistente «Importar extracto» sale de `app.js`

- **Por qué ahora:** `app.js` estaba en 33.154 líneas con el techo en 33.259 (ARQ-4). Quedaban 105 líneas de margen, y cada entrega de hoy gastó una o dos. La siguiente función que necesitara tocar `app.js` habría chocado con el techo, como pasó antes del desalojo del 20/10. El hogar volvió a pedir lo siguiente que no dependa de él, y esto no depende de nadie ni cambia nada que se vea.
- **Qué se mueve, tal cual y sin cambiar una coma:** el asistente de importar extracto en cuatro pasos (V4-4, R-8), con 845 líneas contiguas: 46 funciones, sus 6 constantes y las dos variables de la sesión (`datosImportarSession`, `datosImportarLastResult`). Va al nuevo `importar-extracto-ui.js`, que se carga con `defer` antes que `app.js` y comparte su ámbito global, como `partidas-ui.js`. Solo declara cosas: nada se ejecuta al cargarse. Lo usan Registrar › Importar extracto, la vista v2, el buzón y el texto de un PDF, y ninguno cambia.
- **El riesgo propio de este PR, y su freno:** el bloque declara `let` y `const` de nivel superior. Un `app.js` viejo en la caché HTTP (10 minutos en GitHub Pages) junto al script nuevo declararía dos veces lo mismo, y el navegador rechazaría `app.js` entero: la app no arrancaría. El service worker no corre ese riesgo, porque precarga todo el shell junto y con `cache: "reload"`. Para el resto, `app.js` cambia de `?v=` (estaba fijo desde el 2/10): 26 pruebas anclaban la versión vieja y se actualizan a la nueva sin ningún otro cambio.
- **Techo:** `app.js` 33.154 → 32.296 líneas; el techo baja por el trinquete del hogar (P7: lo que quede + ~130), de 33.259 a **32.426**.
- **Pruebas:**
  - `tests/xgo01-sin-funciones-duplicadas.test.cjs` gana una: las funciones y variables están en el fichero nuevo y no en `app.js` (ni declaradas dos veces), el fichero solo declara, se carga antes que `app.js` y `app.js` lleva la versión nueva.
  - `tests/helpers/codigo-app.cjs` suma el fichero a `FICHEROS_APP`.
  - `tests/xda04-cobertura.test.cjs` leía `app.js` sin el ayudante y pasa a usarlo, sin cambiar ninguna comprobación.
- **Validación:** `npm run verify` en verde, 6223/6223 sobre `main` con #556 ya fusionado. Playwright (e2e + a11y + perf-screens): 261/261 en verde (17,6 min) antes de #556; tras juntarlo, las 15 e2e de importar (XDA-02, Importar v2, XDA-03, XDA-04, ensayo del cierre) en verde. Proyecto `safari` con Chromium emulando el iPhone: 20/20.

## Cierre de sesión — 27 de octubre de 2026 (361): lo que vio Playwright al fallar, en el registro del CI, y el primer fallo que deja ver

- **Por qué:** hoy han fallado en el CI dos pruebas ajenas al PR en curso: WP-40 (la CIRBE, «element is not stable» durante 120 s) en #553 y XDA-02 (Importar en un toque, en WebKit) en #555. Las dos pasaron al relanzar el job y en local no se reproducen (WP-40: 8 de 8 con 4 en paralelo). Sin ver qué había en pantalla, la causa no se puede saber. Y el artefacto con trazas y capturas (P5) no siempre se puede descargar: desde la sesión de desarrollo, el proxy bloquea el almacenamiento donde GitHub lo guarda.
- **Cambio:** un paso nuevo en `.github/workflows/pages.yml`. Solo corre si algo ha fallado y va después de subir el artefacto. Escribe en el registro del CI el `error-context.md` de cada prueba que falla: la página como árbol accesible, con los datos inventados de las pruebas. Va plegado por prueba (`::group::`), con un tope de 60.000 caracteres por fichero, y sin `test-results/` no hace nada.
- **Lo que no hace:** no reintenta pruebas, no cambia umbrales ni toca pruebas. La próxima vez que falle una de estas dos, la causa quedará en el registro y se podrá arreglar en lugar de relanzar.
- **Primer uso, en el propio CI de este cambio:** XDA-02 volvió a fallar en WebKit (segunda vez, ahora en #556), y esta vez el registro trajo la página. La prueba agotó sus 60 s sin error propio y con la página aún en Importar: se quedó parada en `page.goto("/index.html#movements")`, un cambio de solo ancla sobre una entrada de historial creada con `pushState`. El fallo de #555 (la revisión oculta tras volver a Movimientos) pasa por el mismo paso. Se probó la otra explicación, que la app atendiera tarde el cambio de ancla: retrasando el `hashchange` 400 ms en Chromium la prueba pasa igual, así que esa queda descartada. **Arreglo en la prueba, no en la app:** se vuelve a Movimientos cambiando el ancla desde la página (`location.hash`), como hace un enlace de la app, y se espera a que la vista esté activa (`activeViewId`) y visible antes de pulsar. El WebKit real solo lo confirmará este CI: en esta máquina no se puede descargar.
- **WP-40 (la CIRBE)** no se ha vuelto a ver. Si vuelve, el registro dirá qué se movía.
- **Pruebas:** `tests/ci-informe-playwright.test.cjs` gana una (el paso existe, solo en fallo, entre la subida y la medición informativa, con tope y plegado). El paso se probó en local con y sin resultados.
- **Validación:** `npm run verify` en verde, 6222/6222. XDA-02 en local: 6/6 en e2e, 10/10 repetida, y el proyecto `safari` con Chromium imitando el iPhone, 20/20.

## Cierre de sesión — 27 de octubre de 2026 (360): XDA-10 · PR-1, antes de decidir (en prueba, apagada)

- **Por qué esta:** el hogar volvió a pedir lo siguiente que no dependa de él. De las cinco propuestas sin puerta del grupo «Siguiente», XPR-07 ya estaba hecha y XDN-03 no vale nada hasta que el hogar rellene y firme su política. XDA-10 es de esfuerzo S, sin puerta, y se apoya en motores que ya existen (WP-45).
- **Motor** `canonical-decision-freshness.js` (puro): `check({margin, inputs})` mira la edad de cada dato que entra en un veredicto y, con lo que puede haberse movido, dice si le da la vuelta (`yes`), si no (`no`) o si no se sabe (`unknown`). Como mucho tres datos, primero los que le dan la vuelta.
- **Reglas de honestidad:**
  - Un dato sin fecha (saldos calculados por calendario) no se da por fresco: «no sé cuánto han podido moverse».
  - «Hasta» es la estimación de WP-45 (gasto diario × días, con tope), no un dato propio, y la línea lo dice.
  - Esa estimación mide lo que ha podido **salir**. Sirve para un veredicto a salvo, que se volvería alerta si sale dinero. Una **alerta** solo cambia si ha **entrado** dinero, y eso no se estima: su margen queda «sin saber» y la línea dice «conviene actualizar… y eso no lo estimo». La primera versión trataba la alerta igual que el veredicto a salvo; se vio al probarla en pantalla con un importe que dejaba el colchón por debajo del suelo y se corrigió.
  - El veredicto se enseña igual: la línea va debajo y no lo cambia.
- **En pantalla:** una línea «Antes de decidir…» bajo el veredicto del guardarraíl de colchón (DLX1), en los dos simuladores que lo usan: amortizar una deuda (AP1) y la llamada de garantía del Lombard (APX3). El guardarraíl de cancelar una deuda (DEB-15) es otro y queda para el PR-2. Con enlace «Actualizar saldos» cuando el dato puede darle la vuelta o no se sabe. Con los saldos al día (menos de 4 días, el umbral de WP-45) no sale nada. **Nace apagada** en Funciones en prueba («Antes de decidir»). Una línea en Novedades.
- **Lo que no hace este PR-1, frente a la ficha:**
  - **El Euribor** de los simuladores de deuda, el guardarraíl de cancelar una deuda (DEB-15) y los simuladores de inversión y escenarios: PR-2.
  - **Por cuenta** («el saldo de CaixaBank»): la app guarda una sola fecha para todos los saldos, así que dice «los saldos».
  - **La sensibilidad de PV6:** aquí no hace falta; el margen del guardarraíl (lo que queda por encima del suelo) ya es la sensibilidad exacta de ese veredicto a los saldos.
  - **Medir la métrica** (decisiones tomadas con datos frescos): el medidor solo cuenta las vistas.
- **Conexión:** `dlx1GuardrailHtml`, en `app.js`, pide la línea al pintar el veredicto (+1 línea: 33.154 de 33.259). El recuento de motores de `arq3` pasa de 114 a 115.
- **Pruebas:** `tests/xda10-antes-de-decidir.test.cjs` (5) y la e2e «XDA-10 · Antes de decidir» a 390 y 1280 px en el simulador de amortizar: le da la vuelta, alerta sin saber, no la cambia y saldos de ayer. La de 390 px también corre en Safari.
- **Validación:** `npm run verify` en verde, 6221/6221. Playwright (e2e + a11y + perf-screens): 261/261 en verde (17,2 min). Proyecto `safari` con Chromium emulando el iPhone: 20/20.

## Cierre de sesión — 27 de octubre de 2026 (359): XPR-07 · PR-1, el arreglo más barato para un descubierto (en prueba, apagada)

- **Por qué esta:** el hogar volvió a pedir lo siguiente que no dependa de él. En el grupo «Ahora» no queda nada sin puerta. En «Siguiente» (ene-mar 2027 en la auditoría) hay cinco propuestas sin puerta: XDN-03, XPR-07, XDA-10, XUX-04 y XUX-05. Las dos de valor alto son XDN-03 y XPR-07. XDN-03 (política de deuda) no vale nada hasta que el hogar la rellene y la firme; XPR-07 da valor sola con los datos que ya hay.
- **Motor** `canonical-overdraft-fix.js` (puro):
  - `findDeficit`: con la trayectoria «según el plan» de la banda de caja y el suelo, el primer día por debajo, el punto más bajo desde ahí y cuánto falta.
  - `levers`: solo las palancas con dato, y dice cuáles faltan.
  - `solve`: hasta tres arreglos, del más barato al más caro. A igual coste, el que menos colchón gasta.
- **Palancas de esta entrega:**
  - **Gasto que el hogar marcó como discrecional** en «Previsión en capas» (WP-35), con coste 0 €. Solo cuenta la parte que caería entre hoy y el punto más bajo, mes a mes y en proporción a los días.
    - La primera versión cogía todo el discrecional del mes del cruce. A 27 de octubre eso proponía aplazar un gasto de octubre que ya había pasado. Se vio al revisar la tarjeta en pantalla y se corrigió.
  - **Aceptar bajar del suelo:** 0 € de coste, pero dice en cuánto queda el colchón.
  - **Línea de crédito de emergencia (Ajustes):** con sus intereses a 3 meses, el mismo cálculo de siempre.
- **Lo que no hace, dicho en la tarjeta:**
  - **Mover dinero entre cuentas:** la previsión es de la liquidez total; hará falta la previsión por cuenta (XPR-05).
  - **Aplazar un cargo de tarjeta:** hará falta su TAE real (WP-41).
  - **Hacer nada:** solo enseña.
  - **Medir la métrica de la ficha** (descubiertos resueltos antes de su fecha): el medidor solo cuenta las vistas.
- **En pantalla:** tarjeta «Para no bajar del suelo el …» en Plan › Previsión, junto a la banda de caja. Lee la trayectoria y el suelo de la banda ya pintada, sin volver a simular. **Nace apagada** en Funciones en prueba («El arreglo más barato») y, encendida, solo se ve si hay descubierto en 30 días. Una línea en Novedades.
- **Conexión:** `app.js` llama a la tarjeta después de pintar la banda (+1 línea: 33.153 de 33.259). El recuento de motores de `arq3` pasa de 113 a 114.
- **Lectura con el hogar de demostración:** con el suelo de 1.500 € no hay descubierto (la tarjeta no sale). Subiendo el suelo a 10.500 €, faltan unos 830 € a primeros de noviembre.
- **Pruebas:** `tests/xpr07-arreglo-descubierto.test.cjs` (4) y la e2e «XPR-07 · El arreglo más barato» a 390 y 1280 px. La de 390 px también corre en Safari.
- **Validación:**
  - `npm run verify` en verde: 6216 de 6216 pruebas unitarias (+4), lint, typecheck, accesibilidad, rendimiento, build, privacidad y smoke. La primera pasada paró en typecheck por un tipo JSDoc de `solve` (campos con valor por defecto marcados como obligatorios); se corrigió y se repitió.
  - Playwright (e2e + a11y + perf-screens): 259 de 259 en verde (17,3 min; +2, la e2e de XPR-07).
  - Proyecto `safari` con Chromium emulando el iPhone: 19 de 19.

## Cierre de sesión — 27 de octubre de 2026 (358): XUX-02 · PR-1, ver cómo quedaría (en prueba, apagada)

- **Por qué esta:** el hogar pidió seguir con lo que no dependa de él, después de que yo propusiera parar hasta las revisiones del 2/11 y el 4/11. Era la última propuesta «Ahora» sin puerta y se apoya en el registro de XDA-01. Lo que queda del grupo «Ahora» tiene puerta del hogar: XDA-07, XDA-08, XDO-01, XDO-03 y XUX-06.
- **Qué hace:** una tarjeta vacía que pide un alta ofrece «Ver cómo quedaría», además de su acción de siempre. En esta entrega, el **plan B** (Plan › Previsión) y la **política de inversión** (Inversión › Rebalanceo).
  - La hoja pinta la tarjeta **con su propio código** y un hogar **inventado** de principio a fin. Lleva una banda «EJEMPLO» fija arriba y, al pie, qué hace falta para verlo con lo vuestro y cuánto se tarda.
  - «Empezar con lo vuestro» cierra el ejemplo y abre el alta de verdad.
- **Nunca se mezcla con cifras reales:**
  - Las dos vistas leían datos del hogar por dentro: liquidez y salidas medias en «¿Cuánto aguanta el colchón?» del plan B; cartera y operaciones registradas en la política.
  - Ahora aceptan esos datos desde fuera, con los del hogar por defecto: `planBLeverHtml(ctx)` y `politicaViewHtml(policy, { portfolio, today, reasonsHtml })`. El ejemplo los pasa todos.
  - La e2e lo comprueba buscando en la hoja la liquidez y las salidas del hogar de demostración.
- **Nada que pulsar dentro del ejemplo:** las escuchas de las tarjetas viven en el documento, y un botón del ejemplo editaría o borraría el plan de verdad. Por eso se quitan botones, enlaces y campos, y los clics no salen de la hoja.
- **Registro de altas:** `ALTAS` y `alta(id)` en `canonical-data-contracts.js` (XDA-01) dicen qué datos pide cada alta y cuántos minutos lleva, supuestos y dichos: plan B 10 min, política 15 min.
- **Enganche genérico:** `estadoHtml` (WP-37) acepta `ejemplo: "<id>"`. Una tarjeta nueva entra con su ejemplo en `ejemplos-ui.js` y su alta en el registro.
- **Nace apagada** en Funciones en prueba (interruptor propio «Ver con datos de ejemplo»). El medidor cuenta la vista y, como acción, «Empezar»: la métrica de la ficha son las altas empezadas tras ver el ejemplo. Se retira si no suben. Una línea en Novedades.
- **Lo que no hace:** ejemplos para el resto de tarjetas vacías. Las de la CIRBE, el patrimonio, el puente o las nóminas dependen de datos que llegan solos (cierres, nóminas importadas), no de un alta. Si el medidor dice que se usa, se añaden.
- **Pruebas:** `tests/xux02-ver-ejemplo.test.cjs` (5) y la e2e «XUX-02 · Ver cómo quedaría» a 390 y 1280 px. La de 390 px también corre en Safari.
- **Validación:** `npm run verify` en verde: 6212 de 6212 pruebas unitarias (+5), lint, typecheck, accesibilidad, rendimiento, build, privacidad y smoke. Playwright (e2e + a11y + perf-screens): 256 de 257 (17,1 min; +2, la e2e de XUX-02). El que falló es la prueba de contraste de «Tus datos fiscales» en oscuro: no vio el aviso de error tras «Guardar» en 5 s. XUX-02 no toca ese formulario, que no usa el estado vacío común, y la pasada coincidió con pruebas unitarias y lint en paralelo. Sola, 6 de 6. Proyecto `safari` con Chromium emulando el iPhone: 18 de 18.

## Cierre de sesión — 26 de octubre de 2026 (357): XDA-01 · PR-1, lo que la app te pide (en prueba, apagada)

- **Por qué esta:** después de XPR-06, era la otra propuesta «Ahora» sin puerta. Va al cuello de botella que señaló la revisión de la Ola 1: la app no recibe datos, y nadie sumaba lo que cuesta dárselos. XUX-02 (ver cada pantalla con datos de ejemplo) necesita este registro.
- **Qué hace** (diseño en `docs/XDA01_DISENO.md`):
  - **Motor** `canonical-data-contracts.js` (puro): cada función declara qué fuentes de WP-45 necesita y cada cuánto.
  - **Coste semanal:** por función, y en total. El total cuenta **cada fuente una vez**, con la cadencia más exigente, y se compara con los 10 min de GOV-01.
  - **Hambre:** una función tiene hambre si algún dato suyo está antiguo o no llegó nunca.
  - **Lo que no aplica no cuenta:** sin cartera, nada de valoración; sin índices, nada de revisión de la hipoteca.
  - **Tarjeta** en Ajustes › Uso de la app: frase, barra, minutos medidos por el Repaso semanal si hay alguno terminado, y cada función con su coste, su hambre y el enlace a dar el dato.
  - **Sin duplicar WP-45:** frescura y minutos (medidos o supuestos, y dichos) salen de `datos-ui.js` tal cual.
- **Nace apagada** en Funciones en prueba, con interruptor propio. Mover un interruptor propio ahora repinta la pantalla en curso, así que la tarjeta aparece al momento. Medidor: vista, y como acción ir a dar un dato desde la tarjeta. Una línea en Novedades.
- **Lo que no hace (PR-2, si se usa):**
  - **«Pausar»:** silenciar avisos toca muchas pantallas, y pausar sin silenciar engañaría.
  - **Plegar las funciones con hambre en su pantalla.**
  - **Ordenar por valor por minuto:** aún no hay medida de valor; el medidor de XGO-02 empieza a darla.
- **Lectura con el sitio público, sin datos:** unos 4 min a la semana, y 6 de 6 funciones con hambre. Es lo esperable sin extracto, sin saldos declarados y sin cierres. Con los datos del hogar, la tarjeta dirá cuáles sobran.
- **Pruebas:** `tests/xda01-lo-que-pide.test.cjs` (6), recuento de motores 112 → 113 (`arq3`), y la e2e «XDA-01 · Lo que la app te pide» a 390 y 1280 px. La de 390 px también corre en Safari.
- **Un fallo de la validación, corregido:** la comprobación de privacidad del sitio publicado paró `verify`: el minificador convierte los «20 / 60» minutos supuestos en `.3333333333333333`, que tiene forma de número de tarjeta. Los supuestos van ahora en segundos (20, 120, 30…), con el mismo valor.
- **Validación:** `npm run verify` en verde: 6207 de 6207 pruebas unitarias (+6), lint, typecheck, accesibilidad, rendimiento, build, privacidad y smoke. Playwright (e2e + a11y + perf-screens): 255 de 255 en verde (16,9 min; +2, la e2e de XDA-01), con la máquina sin nada más en marcha. Esa pasada fue antes del cambio a segundos; después, la e2e de XDA-01 otra vez: 2 de 2. Proyecto `safari` con Chromium emulando el iPhone: 17 de 17.

## Cierre de sesión — 26 de octubre de 2026 (356): XPR-06, qué mueve cada día de la banda de caja (en prueba, apagada)

- **Por qué esta:** el hogar pidió seguir con lo que no dependa de él. Del grupo «Ahora» de la séptima auditoría, tres propuestas no tienen puerta: XDA-01, XPR-06 y XUX-02.
  - XDA-01 añade una sección a Ajustes, que ya es la pantalla más cargada (57 titulares, XGO-01).
  - XUX-02 necesita el registro de XDA-01.
  - XPR-06 no añade pantalla: amplía la banda de caja de Plan › Previsión. WP-28 (el kit de gráficos) se aparcó el 21/10 solo por el límite de 3 paquetes, que el hogar levantó el 26/10.
- **Cómo entra:** por la regla de XGO-03, toda función nueva nace en Funciones en prueba y apagada.
  - Es la primera con **interruptor propio**. Sin encenderla, la banda se ve como siempre, y XGO-01 no cuenta nada nuevo.
  - Encenderla no recarga la página. La revisión de las dos semanas cuenta **desde el día en que se enciende**, no desde que se publicó.
  - Lo dice una línea de Novedades.
- **Motor** (`canonical-cash-band.js`, puro):
  - `dayBreakdown(entradas, día)` desglosa la columna «Según el plan» de un día: saldo al empezar, cada entrada y salida con su certeza, lo que toca ese día del gasto repartido por el mes y saldo al acabar.
  - En los de fecha estimada, también el tramo en que la banda los mueve y el día que suponía el plan.
  - La simulación y el desglose comparten la preparación (`prepare`), así que no pueden contar distinto. Una prueba lo comprueba día a día: cada desglose cuadra al céntimo con el «Según el plan» de la tabla.
- **En pantalla** (`cash-band-ui.js`, con el kit de WP-28):
  - Bajo el gráfico, «Qué mueve el …» sigue al día elegido en el recorrido (el kit avisa ahora del punto elegido con un evento `ck-select`).
  - Abre una hoja (el `<dialog>` de siempre). Cada cosa sale con su certeza: fecha cierta, por regla, día indicado por ti o estimada.
  - Las estimadas de cargo llevan «¿Sabes el día?», que lleva a Plan › Partidas › Días de cargo (WP-08), abierta y con el foco en el selector de esa partida.
- **Medidor (XGO-02):** vista al abrir la hoja; acción al usar «¿Sabes el día?», que es la métrica de la ficha (fechas corregidas desde aquí). Se retira si nadie lo usa en dos meses.
- **Lo que no hace:** corregir la fecha o el importe dentro de la propia hoja, como pedía la ficha. La fecha se corrige donde ya se corregía (Días de cargo) y el importe, en su partida. Si el medidor dice que se usa, eso va en otro PR.
- **Lo que destapó el CI en Safari (primer PR con WebKit de verdad):** la e2e a 390 px abrió la hoja de otro día. WebKit manda un movimiento de ratón «fantasma» al desplazarse la página, y el kit de gráficos lee con solo pasar el ratón (WP-28), así que un ratón quieto encima del dibujo cambia el día elegido con el teclado. La prueba aparca el ratón fuera y abre la hoja con el teclado. En el iPhone no hay ratón; en un Mac con Safari, pasar el ratón por el gráfico camino del botón puede cambiar el día, y el botón siempre dice qué día abre.
- **Segundo hallazgo del CI en Safari, este en la app:** tras «¿Sabes el día?» el foco no quedaba en el selector de Días de cargo. Al cambiar de pantalla, la app lleva el foco al título de la vista en el fotograma siguiente a pintarla; en WebKit eso llegaba después del foco de XPR-06 (puesto a los 150 ms) y se lo quitaba. Ahora espera a que la ruta termine (`pendingViewFocusId`) y da el foco por bueno cuando sigue en el selector dos comprobaciones seguidas. No se reprodujo en Chromium ni con la CPU frenada ×6: la lectura en WebKit es la del CI.
- **Lectura con el plan de ejemplo:** el día de hoy acumula todos los cargos de octubre con fecha estimada (el plan los suponía el día 8 y los sigue dando por pendientes). Es el comportamiento de la banda desde WP-16, no algo nuevo; la hoja ahora lo deja a la vista.
- **Pruebas:**
  - `tests/xpr06-que-mueve-cada-dia.test.cjs` (5).
  - E2E «XPR-06 · Qué mueve cada día» a 390 y 1280 px. La de 390 también en Safari (`@safari`, RD-WK).
- **Validación:** `npm run verify` en verde: 6201 de 6201 pruebas unitarias (+5), lint, typecheck, accesibilidad, rendimiento, build, privacidad y smoke. Playwright (e2e + a11y + perf-screens): 253 de 253 en verde (16,8 min; +2, la e2e de XPR-06 a 390 y 1280 px). **Antes de esa pasada hubo tres con un fallo cada una**, siempre en pruebas que XPR-06 no toca y nunca el mismo: dos veces el navegador se cerró entre pruebas y una vez la prueba de tiempos de WP-37 no vio el esqueleto de «cargando». Por separado pasan (WP-37, 12 de 12 repetida). La misma batería sobre `main` sin XPR-06 dio 251 de 251, y la cuarta con XPR-06, con la máquina sin nada más en marcha, 253 de 253. Las tres con fallo coincidieron con trabajo en paralelo en el contenedor (fusiones, descargas, capturas, registro de depuración del navegador): se atribuye a carga, no al cambio, pero queda anotado por si reaparece. Proyecto `safari` con Chromium emulando el iPhone: 16 de 16 (+1, la e2e de XPR-06 a 390 px).

## Cierre de sesión — 26 de octubre de 2026 (355): RD-WK, las pantallas v2 también en Safari

- **Por qué ahora:** el hogar pidió seguir con lo que no dependa de él. RD-WK (§5.0, fila 10) estaba decidido desde el 19/10 (P14: «Sí: proyecto WebKit 390×844 para las pantallas v2») y no pide pantalla nueva. El hogar usa la app en el iPhone, y hasta hoy ninguna prueba bloqueante corría en el motor de Safari: solo la medición informativa de carga de WP-52.
- **Qué hace:**
  - Proyecto `safari` en `playwright.config.cjs`: WebKit con el iPhone 13 (táctil, móvil) a 390×844, sobre las pruebas de `qa1` con la etiqueta `@safari`. Script `npm run test:safari`.
  - Las pruebas de las pantallas v2 a 390 px llevan la etiqueta, sin duplicar ninguna: Hoy (cambios 1 y 2), Movimientos, Importar, Importar en un toque, texto de un PDF, Clasificar (con su medición y su calibración), la tarjeta de la regla, Repaso semanal (sus dos pruebas), Funciones en prueba y el ensayo del cierre de octubre. Las que recorren dos anchos la llevan solo en el de 390.
  - Una prueba nueva, «RD-WK · el menú principal en el móvil»: cada destino del menú abre con su título, sin errores y sin que nada se salga por la derecha. Corre también en `e2e` (Chromium).
  - CI: paso bloqueante «Instalar WebKit y probar las pantallas v2 en Safari», antes de guardar las trazas para que un fallo en Safari también las deje. La medición informativa de WP-52 reutiliza ese WebKit.
- **Límite de la validación local:** este contenedor no puede descargar WebKit (el proxy bloquea el CDN de Playwright). Aquí se validó el proyecto con Chromium y la misma emulación de iPhone (configuración temporal fuera del repositorio): 15 de 15 en verde (1,1 min). En WebKit lo valida el CI del PR.
- **Validación:** `npm run verify` en verde: 6196 de 6196 pruebas unitarias (+3, `tests/rdwk-safari.test.cjs`), lint, typecheck, accesibilidad, rendimiento, build, privacidad y smoke. Playwright (e2e + a11y + perf-screens): 251 de 251 en verde (15,7 min; +1, el barrido del menú en `e2e`). Proyecto `safari` con Chromium emulando el iPhone: 15 de 15.

## Cierre de sesión — 26 de octubre de 2026 (354): XIN-02, vigía de la recompra

- **Por qué ahora:** función «Ahora» sin puerta, con euros en juego antes del 31/12 (campaña fiscal) y sin pantalla nueva: el inventario de XGO-01 no cambia.
- **Qué faltaba:**
  - El libro de operaciones (WP-48) solo miraba las compras de los dos meses **posteriores** a una venta con pérdida.
  - Aplicaba dos meses a todo y daba la pérdida entera por dudosa.
  - Ni las candidatas a aflorar pérdidas ni la campaña fiscal decían hasta cuándo no recomprar.
- **La norma, contrastada:**
  - **Fuentes:** art. 33.5 f y g de la Ley del IRPF y el Manual práctico de Renta 2025 de la AEAT, «Pérdidas patrimoniales que no se computan fiscalmente como tales». La sede de la AEAT y el BOE están bloqueados por el proxy de este entorno, así que se contrastó a través del buscador, que devuelve las páginas oficiales.
  - **Plazos:** dos meses antes o después en valores admitidos en mercados regulados de la UE; un año en los no admitidos (fondos que no cotizan) y en los de fuera de esos mercados.
  - **Homogéneos:** misma entidad y clase. Se aplica el FIFO (art. 37.2).
  - **Compras anteriores:** cuentan las que siguen en cartera. No hay limitación si en la ventana anterior hubo una sola compra y al empezarla no se tenía nada.
  - **Cuándo aflora:** la pérdida diferida se integra al transmitir lo recomprado.
  - **Sin confirmar en fuente oficial:** el reparto en proporción a las unidades recompradas. Lo aplican asesores y la app lo dice como estimación.
- **Motor** (`canonical-portfolio-ledger.js`, puro):
  - `repurchaseWindow(tipo)`: acciones y ETF, dos meses (con la salvedad de fuera de la UE); fondos, un año; cripto, planes y «otro» no se evalúan.
  - `repurchaseFreeFrom(tipo, fecha)`.
  - `repurchaseAnalysis`: compras anteriores que siguen y posteriores, unidades recompradas, parte diferida estimada, desde cuándo se podía recomprar y si ya no queda nada.
  - El FIFO no se reimplementa: lo que sigue en cartera sale de `fifoLedger` de `canonical-portfolio.js`, porque el FIFO siempre deja las unidades más recientes.
  - El aviso `repurchase-risk` pasa a decir todo eso. La compensación sigue sin descontarlo, y el aviso lo dice.
- **En pantalla:**
  - La fila de la venta en el libro de operaciones: «unos N € diferidos por recompra», con la explicación debajo. También sale en el «antes / después» al añadir o cambiar operaciones.
  - Las candidatas a aflorar pérdidas (Inversión › Fiscalidad): «si vendes hoy, no recompres antes del …», por tipo.
  - La acción «Compensar plusvalías con minusvalías» de la campaña fiscal: las dos fechas, contadas desde hoy.
  - Una línea en Novedades.
- **Pruebas:**
  - `tests/xin02-vigia-recompra.test.cjs` (7).
  - `tests/wp48-libro-operaciones.test.cjs`: la compra anterior que sigue en cartera ahora sí avisa, porque es lo que dice la norma (antes se excluía por diseño, y la prueba lo explica). El texto «La app no lo aplica» pasa a «La compensación de la app no lo descuenta».
  - E2E «XIN-02 · Vigía de la recompra» a 1280 y 390 px.
- **Validación:** `npm run verify` en verde: 6193 de 6193 pruebas unitarias (+7), lint, typecheck, accesibilidad, rendimiento, build, privacidad y smoke. Playwright (e2e + a11y + perf-screens): 250 de 250 en verde (16,6 min; +1, la e2e de XIN-02).

## Cierre de sesión — 26 de octubre de 2026 (353): XGO-01, «uno entra, uno sale» comprobado por el CI

- **Por qué ahora:** el hogar pidió seguir con lo que no dependa de él. De las funciones «Ahora» sin puerta, esta era la única sin pantalla nueva: las pantallas nuevas del rediseño esperan a las revisiones del 2/11 y el 4/11. Era además la mitad pendiente de XGO-01 (§5.0, fila 5). GOV-02 es una regla de trabajo de Claude, con veto posible del hogar.
- **Qué se cuenta:** los titulares (h2 y h3) que se ven por defecto en cada destino del menú principal y en sus pestañas.
  - Condiciones: tema v2, 1280 px, sin datos del hogar y el reloj fijo el 26/10/2026 a las 10:00.
  - No cuenta lo plegado, los diálogos, el menú «Más» ni lo que solo sale con datos.
  - Un titular es la medida más estable de «cosas que leer» en las dos generaciones de pantallas, que no comparten clases.
  - Hoy: **226 titulares en 31 rutas**. Dos pasadas seguidas dan el mismo inventario.
- **Cómo se hace cumplir:**
  - `docs/gobierno/superficie.json` guarda el inventario ruta a ruta, la `base` (226) y las `excepciones`.
  - La e2e «XGO-01 · Uno entra, uno sale» (`tests/qa1-flujos-completos.spec.cjs`, con `tests/helpers/superficie.cjs`) exige que el inventario real coincida con el manifiesto. Si no, dice qué rutas han cambiado y cuánto.
  - `tests/xgo01-uno-entra-uno-sale.test.cjs` exige que el total no pase de base + excepciones (cada excepción con fecha, cuánto, qué y por qué) y que la base baje cuando algo sale (trinquete).
  - El inventario se regenera con `ACTUALIZAR_SUPERFICIE=1` (BACKLOG §10, trampa 12).
- **Lectura para el hogar:** Ajustes enseña 57 titulares y Inversión › Apalancamiento 29, un tercio de todo lo visible. Son las primeras candidatas a plegar. No se toca nada sin su visto bueno: retirar o plegar pantallas en uso se consulta.
- **Pruebas:**
  - `tests/xgo01-uno-entra-uno-sale.test.cjs` (5).
  - La e2e nueva, comprobada en los dos sentidos: pasa con el manifiesto al día y falla con el diff exacto si no cuadra.
- **Validación:** `npm run verify` en verde: 6186 de 6186 pruebas unitarias (+5), lint, typecheck, accesibilidad, rendimiento, build, privacidad y smoke. Playwright (e2e + a11y + perf-screens): 249 de 249 en verde (15,6 min; +1, la e2e de XGO-01).

## Cierre de sesión — 26 de octubre de 2026 (352): XDA-05 · PR-1, medir la calibración de Clasificar

- **Qué decidió el hogar** («1. sí 2. sí 3. sí» a la propuesta de XDA-05):
  - **PR-1, medir, ahora.**
  - **PR-2, aceptar en bloque los grupos de confianza alta, solo con la puerta cumplida:** 20 grupos de alta o más, con el 95 % o más aceptados tal cual (y sin deshacer).
  - **Se descartan las tarjetas que se deslizan** de la ficha: la hoja inferior de A5 ya cumple.
- **Qué se mide** (en el medidor de XGO-02, `medidor-utilidad.js`, solo en este navegador):
  - por cada grupo aceptado en Clasificar: su confianza (alta, media, baja o sin propuesta), si se aceptó la propuesta **tal cual** o se eligió otra partida, y los segundos desde que se enseñó el grupo (tope de 10 min);
  - deshacer la regla marca ese registro como corregido;
  - sin conceptos, importes ni partidas; como mucho los 300 últimos.
- **Dónde se ve:**
  - **Ajustes › Uso de la app** y **«Funciones en prueba»**: % tal cual en total y por confianza (por lo bajo: un 94,6 % no se enseña como 95), segundos por grupo (objetivo 4 s), grupos sin propuesta y el estado de la puerta del PR-2 («faltan N grupos de alta para decidir», «aún no» o «se cumple»). La métrica de Clasificar en «Funciones en prueba» pasa a ser esta.
  - El **gasto importado con partida en los últimos 90 días** (objetivo 95 %; sin capturas a mano ni compras provisionales con tarjeta) lo calcula Clasificar con los movimientos y lo enseñan los dos sitios y el final de cada tanda.
  - La cabecera de Clasificar: «1 de 5 · faltan 12 grupos · unos 2 min», a la mediana medida con 3 grupos o más y, mientras no, a 10 s por grupo con «(aún sin medir)».
- **Arreglo de paso:** el commit de XDA-03 (#546) había versionado un enlace `node_modules` que apuntaba a una ruta de este contenedor (de la validación en un worktree): `.gitignore` decía `node_modules/`, que no ignora enlaces. Se quita del repositorio y `.gitignore` pasa a `node_modules`. Al clonar, ya no aparece un `node_modules` roto.
- **Pruebas:**
  - `tests/xda05-calibracion-clasificar.test.cjs` (7): registro, datos mal formados, tal cual por confianza, deshacer, redondeo por lo bajo, mediana, la puerta (19 de 20 sí, 18 de 20 no, siempre con todo lo guardado) y la frase.
  - `tests/redis-a5-clasificar.test.cjs` (+3): lo que anota Clasificar al aceptar y deshacer, el contador con y sin medida, y el gasto con partida en 90 días. La línea «3 más en otra tanda» pasa a «faltan 8 grupos · un minuto (aún sin medir)».
  - `tests/xgo02-medidor-utilidad.test.cjs`: la línea «Medido» de «Funciones en prueba» lleva el dato de Clasificar.
  - E2E «XDA-05 · Calibración de Clasificar» a 390 px: una tanda con propuesta tal cual, sin propuesta y saltada, deshacer, y lo que dicen el informe y «Funciones en prueba»; nada de conceptos ni importes guardado.
- **Validación:** `npm run verify` en verde: 6181 de 6181 pruebas unitarias (+10), lint, typecheck, accesibilidad, rendimiento, build, privacidad y smoke. Playwright (e2e + a11y + perf-screens): 248 de 248 en verde (15,1 min; +1, la e2e de XDA-05).

## Cierre de sesión — 26 de octubre de 2026 (351): XDA-03 · nivel 1, texto de un extracto en PDF

- **Qué decidió el hogar:**
  - Hace hoy el paso 0 adelantado: qué formatos da cada app del banco.
  - **Acepta pdf.js alojado en el propio sitio** (≈ 1,7 MB, con revisión de seguridad; es la decisión que quedó aplazada en WP-31) si alguna cuenta solo da PDF.
  - **No se descarta el nivel 1** (pegar el texto), aunque Claude proponía descartarlo porque en el iPhone copiar el texto de un PDF de varias páginas puede ser torpe.
- **Nivel 1:** «Texto de un PDF» en las fuentes de Importar v2. Diseño: `docs/XDA03_DISENO.md`.
  - **Motor genérico** `canonical-statement-lines.js`, sin formato por banco:
    - reconoce la fecha (y la fecha valor) al principio, los importes con formato español al final (el último, el saldo) y el concepto en medio;
    - también las columnas que llegan partidas al pegar y el concepto en dos líneas;
    - fija con el saldo el signo que el PDF no marca;
    - sin saldo con que comprobarlo, no adivina: esa línea no entra y se dice.
  - **Cuadre:** si no cuadra, se dice desde qué línea se rompe.
  - **Diagnóstico:** sin conceptos, importes ni fechas.
  - **Entrada:** lo leído entra como un CSV en memoria por el asistente de siempre (huella, bandeja, lote, «Deshacer» y el periodo de XDA-04). `app.js` no cambia.
  - **Privacidad:** el texto se borra del campo al leerlo y no se guarda.
  - El mismo motor servirá al nivel 2 (`linesFromItems` ya rehace filas a partir de las posiciones de pdf.js).
- **Nivel 2, pendiente del paso 0:** pdf.js fijado y corregido (CVE-2024-4367), sin eval y sin nada de fuera, cargado solo al elegir un PDF. Importar acepta `.pdf` y el buzón deja de decir «todavía no se puede leer».
- **Pruebas:**
  - `tests/xda03-lineas-extracto.test.cjs` (10).
  - E2E a 390 y 1440 px: signo por saldo, línea partida, cuadre, importación y nada guardado del texto.
  - E2E de «no se adivina», con un diagnóstico sin datos.
  - Axe en claro y en oscuro.
  - Dos pruebas que decían «Aún no: … pegar el texto del PDF» pasan a lo nuevo.
  - ARQ-3: recuento de motores de 111 a 112, con consumidor en `views/importar-v2.js`.
- **Validación:** `npm run verify` en verde: 6171 de 6171 pruebas unitarias, lint, comprobaciones y smoke. Playwright (e2e + a11y + perf-screens): 246 de 247 en verde (14,3 min); la otra no llegó a empezar (el navegador se cerró al crear su contexto) y pasa al repetirla (su grupo, 5 de 5).

## Cierre de sesión — 26 de octubre de 2026 (350): XDA-04 · PR-1, cobertura del libro

- **Qué decidió el hogar:**
  - Orden: PR-1 ahora (registro, motor, WP-27 y aviso en el cierre) y PR-2, la tira, cuando haya dos importaciones reales.
  - «Al importar, deduces y preguntas antes de confirmar».
  - **«Límite de paquetes: no hay límites»**: queda sin efecto el límite de 3 en curso del 19/10. Recogido en `BACKLOG_DEFINITIVO.md` §0 y §4, `ESTADO.md` y `CLAUDE.md`.
- **Qué fallaba antes:** la «cobertura» era una sola fecha global, la del último movimiento de cualquier cuenta.
  - Un hueco entre dos extractos contaba como visto, y Mediolanum parecía al día si CaixaBank lo estaba.
  - El cierre firmaba sin saber si el mes estaba entero.
  - Ningún extracto real había entrado aún, así que no había causado nada.
- **PR-1** (`docs/XDA04_DISENO.md`):
  - **Motor** `canonical-ledger-coverage.js` (puro): rangos por cuenta unidos, días cubiertos, huecos, el mes por cuenta, lo deducido y lo estimado.
  - **Importar v2:** pregunta «¿Qué periodo exportaste?» con las dos fechas deducidas de los movimientos, antes de confirmar.
    - No puede empezar después del primer movimiento, ni acabar antes del último, ni pasar de hoy; si lo intentas, avisa y deja la fecha anterior.
    - Se guarda por cuenta (almacén `ledger-coverage`, en la copia y la nube, sin importes) dentro del lote, así que «Deshacer» lo quita.
    - El almacén se crea vacío al cargar el fichero, antes del lote. Si no, «Deshacer» no lo borraría, porque la restauración nunca elimina un almacén que la foto no traía.
    - **Error encontrado en la validación y corregido:** la primera versión creaba ese almacén al leer la cobertura (al pintar Movimientos o Hoy). La prueba de WP-45, «sin hacer nada ni guardar», lo cazó: mirar una pantalla no puede escribir. Ahora solo se crea al cargar un fichero para importar.
  - **«¿Ha llegado…?» (WP-27):** un cargo solo se da por no llegado si se ha visto entero su periodo en la cuenta de los recibos (CaixaBank). Un hueco lo calla; sin rangos, funciona como antes.
  - **Cierre:** en el paso de firma, «Los extractos (no) cubren el mes entero» por cuenta. Avisa y no bloquea; se ve en los dos temas.
  - **Lo importado antes:** cuenta como «estimado» (por cuenta, del primer al último movimiento de extracto), calculado al leer y sin guardar. Las anotaciones a mano no cuentan.
  - `app.js` +2 líneas (33.150 de 33.259).
- **Pruebas:**
  - `tests/xda04-cobertura.test.cjs` (7).
  - E2E: el periodo (deducción, validación, guardado en el lote y Deshacer); un hueco que calla la pregunta de un cargo y otra cuenta al día que no cuenta; el ensayo del cierre de octubre, que ahora declara el mes entero y ve el aviso «Mediolanum: ningún extracto de este mes».
  - Axe del periodo en claro y en oscuro.
  - Las 5 pruebas que fijaban la cobertura con una fecha la fijan también como periodo (misma cobertura).
  - ARQ-3: recuento de motores de 110 a 111, con su consumidor en `views/cierre.js`.
- **Validación:** `npm run verify` en verde: 6161 de 6161 pruebas unitarias, lint, comprobaciones y smoke. Playwright (e2e + a11y + perf-screens) 242 de 242 en verde (14,2 min), tras el arreglo de arriba. En la primera pasada fallaron 2: la de WP-45 (por el error de arriba) y una de contraste de WP-23 en oscuro que no toca este PR y pasa al repetirla.

## Cierre de sesión — 25 de octubre de 2026 (349): XDA-02 · PR-2, buzón de extractos (construido, sin desplegar)

- **Qué es:** un Atajo de iOS en la hoja Compartir de la app del banco («Enviar a Finanzas Casa») manda el extracto a una Edge Function de Supabase con una clave personal. El fichero espera en un bucket privado hasta que la app lo importa o, como tarde, 7 días.
  - **Por qué hace falta Atajo y nube:** en el iPhone no se puede compartir un fichero a una web instalada, y un Atajo abre Safari, no la app.
  - Diseño, seguridad y despliegue: `docs/XDA02_DISENO.md`.
- **En la app** (tema v2, como el Repaso):
  - **Movimientos e Importar** enseñan arriba «En el buzón · N extractos».
  - **Importar** lo pasa al asistente de siempre (revisión, cuadre, duplicados, cuenta y confirmación). Una vez importado, sale del buzón.
  - **Borrar** lo descarta. Un PDF solo se puede borrar hasta XDA-03.
  - **Importación a medias:** no se pisa; avisa y el extracto sigue esperando.
  - **En Importar:** «Preparar el Atajo» enseña una vez la dirección, la clave y los pasos para crearlo; también hay «Desactivar» y «Nuevo».
  - **Sin sesión, o sin el esquema desplegado**, no se ve nada: la app lo detecta por el error de tabla inexistente y vuelve a mirar cada hora. Importar sigue con su «Aún no».
- **Servidor** (`statement-inbox.js`, lógica en CommonJS probada con `npm test`; `supabase/functions/statement-inbox/index.ts`, solo cableado):
  - **Clave:** solo como hash SHA-256; caduca a los 89 días como máximo. Un 401 igual para clave inexistente, revocada o caducada.
  - **Petición:** solo POST, como mucho 2 MB (también por `content-length`). El tipo se decide por los primeros bytes: CSV o texto, Excel o PDF.
  - **Límites:** 20 envíos al día por clave y 20 extractos esperando por usuario.
  - **Registro:** sin token, sin nombre de fichero y sin contenido.
  - **Interruptor:** `FINANCE_STATEMENT_INBOX_ENABLED`.
  - **Limpieza:** cada envío borra lo caducado de ese usuario.
- **Esquema** (final de `supabase_schema.sql`):
  - Tablas `finance_statement_inbox_tokens` y `finance_statement_inbox` con RLS.
  - El dueño no puede dar de alta en el buzón; solo marcar, borrar y revocar su clave (permisos por columna).
  - Bucket privado `finance-statement-inbox` de 2 MB; al bucket solo sube la función.
- **NTC-06:** RQ-01 a RQ-11 repasados uno a uno en `docs/XDA02_DISENO.md` §4. La fila del servidor de Supabase en §2 se amplía (no hay servidor nuevo) y el procedimiento de móvil perdido (§5) incluye desactivar el Atajo.
  - **Quedan del hogar:** RQ-03, la prueba con dos cuentas, y RQ-11, las altas cerradas.
- **Lo que falta, y es del hogar:** desplegar el esquema y la función y crear el Atajo (≈ 20 min). Es la nueva tarea H-34 del plan, del 8/11. Hasta entonces el buzón no se ve en la app.
- **Avisos honestos:**
  - La función no se ha podido ejecutar en un Deno real aquí, igual que `assistant-query`. Por eso el despliegue incluye pruebas con curl (201, 401, 413 y 415).
  - El fichero llega en claro a la nube del hogar, porque el Atajo no puede cifrar. Puede llevar IBAN y titular, y por eso se borra al importarlo.
  - Si se deshace el lote importado, el fichero ya no está en el buzón: hay que volver a compartirlo.
- **Pruebas:**
  - `tests/xda02-buzon-servidor.test.cjs` (8) y `tests/xda02-buzon-app.test.cjs` (8).
  - E2E con un Supabase falso en memoria: importar y salir del buzón a 390 y 1440 px, la importación a medias y preparar el Atajo (a la nube solo va el hash; la clave se ve una vez).
  - Axe del buzón y de la tarjeta del Atajo en claro y en oscuro.
- **Validación:** `npm run verify` en verde: 6154 de 6154 pruebas unitarias, lint, comprobaciones y smoke. Playwright (e2e + a11y + perf-screens) 238 de 238 en verde (14,1 min).

## Cierre de sesión — 25 de octubre de 2026 (348): XDA-02 · PR-1, importar en un toque

- **Qué decidió el hogar sobre XDA-02** (buzón de extractos desde la hoja Compartir): «adelante con el paso 0 y el PR-1, pero no aparcamos el buzón».
  - **Propuesta de Claude, en la que se basa:** la mitad cara de importar (≈ 6 toques en la app del banco) no la toca ninguna opción. El buzón ahorra ≈ 3 de ≈ 13 toques, depende de un servidor que tiene que desplegar el hogar y de que la app lea el formato real del banco, y la app aún no ha leído ningún extracto real por el camino nuevo. En el iPhone no se puede compartir un fichero a una web instalada sin un Atajo.
  - **Orden:** paso 0 (del hogar, dentro de H-22) → PR-1 (este) → PR-2, el buzón en Supabase.
  - **Límite de paquetes:** con XDA-02 hay 4 en curso sobre un límite de 3. Claude lo avisó y el hogar decide seguir (`BACKLOG_DEFINITIVO.md` §0).
- **Paso 0** (tarea H-22 ampliada en el plan): exportar octubre desde la app de cada banco en el iPhone, importarlo, anotar qué formatos ofrece cada app (Excel, CSV o PDF) y, si falla, copiar el diagnóstico. Decide si lo siguiente es adaptar el lector o XDA-03 (PDF).
- **PR-1 · Importar en un toque** (`importarV2Elegir` en `views/importar-v2.js`):
  - **Desde dónde:** «Importar» de Movimientos (cabecera y bloque sin movimientos) y el paso «Extracto» del repaso.
  - **Qué hace:** lleva a Registrar › Importar y **abre ya el selector de archivos**, donde en el iPhone lo recién descargado sale arriba. Al elegir el fichero se pasa a la revisión.
  - **Revisión a medias:** no se pisa; se enseña tal cual.
  - **Medición:** el medidor guarda los segundos del toque al extracto importado («N s del toque en «Importar» al extracto importado», en Ajustes › Uso de la app). Es la línea base contra la que se juzgará el buzón.
  - **Sin servidor y sin cambios en `app.js`.**
- **Pruebas:**
  - `tests/xda02-importar-un-toque.test.cjs` (3).
  - E2E a 390 y 1440 px: el selector se abre a la primera (evento `filechooser`), se importa y se mide; con una revisión a medias no se abre encima.
- **Validación:** `npm run verify` en verde: 6138 de 6138 pruebas unitarias, lint, comprobaciones y smoke. Playwright (e2e + a11y + perf-screens) 232 de 232 en verde (14,1 min), sobre el commit del PR en una copia aparte.

## Cierre de sesión — 24 de octubre de 2026 (347): Hoy, cambio 2 · la entrada al Repaso semanal (activo desde el 1/11)

- **Qué cambia:** con el tema v2, Hoy enseña una línea «Repaso de esta semana · unos 5 min» debajo de «Decidir esta semana».
  - Dice lo que costó el último repaso («El último, hace 7 días, en 5 min») o, si no hay ninguno, qué pasos tiene.
  - **Solo sale mientras el repaso de esa semana (lunes a domingo) está por hacer.** Hecho, desaparece; el repaso sigue a mano en Movimientos.
  - Se abre desde la propia línea. Al cerrar el repaso, Hoy se repinta y el foco vuelve a la línea o, si ya no está, al primer botón de Hoy.
- **Cuándo:** publicado el 24/10 con puerta de fecha (`HOY_V2_REPASO_DESDE = "2026-11-01"`), una semana después del cambio 1, para respetar «un cambio de Hoy por semana». El tema clásico no cambia.
- **Desviación de la referencia** (anotada en `docs/rediseno/ESTADO.md` §4): `HoyDesktop.png` pone un botón «Repaso semanal» fijo en la cabecera, y `Hoy.png` una franja ámbar «Saldos estimados» que lleva al repaso.
  - Un botón fijo no dice si toca; la línea sí, y cuando no toca no ocupa pantalla (decisión 4).
  - La píldora «Saldos estimados» sigue llevando al pulso de saldos de Registrar: si llevara al repaso, quien solo quiere confirmar saldos lo cerraría tras el paso 1, y cada cierre a medias cuenta como descarte en el criterio de retirada del repaso.
- **Ficheros:** `views/hoy-v2.js`, `views/repaso-v2.js` (`FinanceRepaso.mismaSemana` y el repintado de Hoy al cerrar), `tema-v2.css`, `novedades.js`; `app.js` sin cambios.
- **Error encontrado en la e2e y corregido antes de publicar:** al cerrar a medias, el foco iba al primer botón de Hoy y no a la línea, porque `querySelector` con una lista de selectores devuelve el primero en el orden del documento.
- **Pruebas:**
  - `tests/redis-hoy2-repaso.test.cjs` (7): puerta de fecha, semana ISO, textos, sin script no hay entrada, sitio en Hoy, estilos y Novedades.
  - E2E: la puerta (28/10) y el cambio (3/11) a 390 y 1440 px, con cierre a medias y repaso completo.
  - Axe de la línea en claro y en oscuro.
- **Validación:** `npm run verify` en verde: 6135 de 6135 pruebas unitarias, lint, comprobaciones y smoke. Playwright (e2e + a11y + perf-screens) 230 de 230 en verde (14,6 min).

## Cierre de sesión — 24 de octubre de 2026 (346): regla de parada levantada · Repaso semanal y primer cambio de Hoy

- **Qué decidió el hogar:** «levanto la regla de parada para funciones nuevas».
  - Recogido en `BACKLOG_DEFINITIVO.md` §0 y §4.
  - Sigue el límite de 3 en curso, un cambio de Hoy por semana y la revisión a los 14 días en «Funciones en prueba».
  - Recomendación de Claude: priorizar las funciones que reducen el trabajo de meter datos, porque el 0 % comprobado no viene de que falten funciones.
- **Repaso semanal** (B5 · XUX-03, `views/repaso-v2.js`, de `Ritual.png` y `RitualDesktop.png`).
  - **Formato:** pantalla completa en móvil; diálogo de 880 × 600 en escritorio, con los pasos a la izquierda y atajos C, E y ↵.
  - **Pasos:** cinco, en el orden del handoff, con cronómetro que se mide solo.
    - **Saldos.** «Coincide» o «Corregir» por cuenta, con el modelo y la escritura del pulso de WP-26 y su «Deshacer» de 8 s. El tiempo del paso también cuenta para WP-26.
    - **Extracto.** Qué cuenta tiene su último movimiento de hace más de 7 días. Lleva a Importar y una píldora devuelve al repaso.
    - **Lo que vino.** Las preguntas de WP-14/27, contestadas ahí mismo.
    - **Bandeja.** Clasificar se abre encima y se vuelve al repaso al cerrarlo.
    - **Listo.** Duración, lo que queda, racha de semanas y los minutos de la semana.
  - **Medición:** la duración alimenta M-COSTE, que deja de ser autodeclarado. En el medidor, terminar cuenta como acción y abandonar como descarte (criterio de retirada de XUX-03).
  - **Dónde está:** se abre desde Movimientos y entra en «Funciones en prueba» con revisión el 7/11.
  - **Copia de seguridad:** el registro (`repaso-semanal`: fecha, segundos y qué se hizo, sin importes) viaja en la copia y la sincronización. Así la racha y M-COSTE sobreviven a una restauración y suman los repasos hechos en cualquier móvil. Lo detectó `arq6-copia-completa` en la validación.
  - **Error encontrado en el ensayo y corregido antes de publicar:** guardar los saldos desde fuera de Registrar no los fijaba, porque `readStateFromControls` volvía a leer el selector de modo, aún en «auto». El repaso pasa los selectores a «manual» antes de guardar, y su «Deshacer» los devuelve.
- **Hoy, cambio 1** (acordado el 23/10), publicado con puerta de fecha y activo desde el 25/10.
  - **Qué cambia:** con el tema v2, las preguntas de cobros y cargos esperados salen de la bandeja de Hoy y se contestan en la bandeja de Movimientos, también con 0 movimientos. Hoy deja una línea que lleva a ellas.
  - **Qué no cambia:** los demás avisos siguen en Hoy, porque en la referencia la bandeja de Movimientos es solo para lo que tiene que ver con movimientos. El tema clásico no cambia.
  - **Arreglo de paso:** `esperados-ui.js` lee el campo «otro importe» del mismo bloque que el botón, porque la pregunta puede estar pintada en dos sitios.
- **Plan** (`docs/plan/plan-definitivo.json`): M-COSTE se mide con el repaso; nuevo hito el 7/11 (revisión del Repaso); 20 hitos.
- **Pruebas:**
  - `tests/redis-b5-repaso.test.cjs` (9).
  - E2E: el recorrido completo a 390 y 1440 px, la ida y vuelta a Importar con descarte al cerrar a medias, y la puerta del cambio de Hoy (24/10 frente a 26/10).
  - Axe del repaso en claro y en oscuro × 390 y 1440, y de la bandeja de Movimientos.
  - Las pruebas de WP-14/27 en Hoy pasan al tema clásico.
- **Validación:** `npm run verify` en verde: 6128 de 6128 pruebas unitarias, lint, comprobaciones y smoke. Playwright (e2e + a11y + perf-screens) 225 de 225 en verde (14,2 min).

## Cierre de sesión — 24 de octubre de 2026 (345): plurales y decimales unificados en toda la app

- **Qué pidió el hogar:** «Haz esta tarea aquí: Unificar decimales y plurales en el resto de pantallas», la tarea propuesta al cerrar la 344.
- **Plurales:** 264 textos con paréntesis («movimiento(s)», «mes(es)», «decisión(es)», «día(s)»…) en 24 ficheros pasan a la forma según el número: «1 movimiento», «3 movimientos».
  - **Cómo:** con un transformador que repite la misma expresión en un ternario. Pierde la tilde al pluralizar cuando toca («decisión» → «decisiones»).
  - **Concordancia, revisada aparte:** 45 adjetivos y verbos que siguen al número concuerdan («1 movimiento seleccionado», «1 mes ya cerrado»), y también los verbos antes y lejos del número: «Queda 1 partida», «Falta 1 dato», «1 cifra de este informe tiene confianza baja: revísala…», «1 captura anotada a mano se sustituye», «1 concepto (2 movimientos) reclasificado».
  - Con un solo concepto, la nota del lote dice «El concepto seleccionado ya tenía otra partida asignada» en vez de «1 de los 1 concepto».
- **Decimales:** 48 cifras visibles con punto inglés pasan a coma con `toLocaleString("es-ES")`, con los mismos decimales: ratios de deuda, TAE media, tasa de ahorro, meses de colchón, desviaciones, eficiencia, umbrales de alertas, tiempos del presupuesto de datos…
  - **No se tocan:** los valores de `<input>` (necesitan punto), las coordenadas SVG ni la exportación CSV (no se cambia el formato de un fichero que ya se usa fuera).
- **Pruebas:**
  - 37 ficheros actualizados al texto nuevo, sin relajar ninguna aserción.
  - Siete pruebas de cableado recortaban un trozo fijo de caracteres del código y se quedaron cortas al alargarse las líneas: se amplía la ventana (o se lee la función entera) sin cambiar lo que comprueban.
- **Validación:** `npm run verify` en verde, salida 0: `npm test` 6119/6119, lint, typecheck, accesibilidad, rendimiento, build, privacidad y smoke. Playwright completo: **214/214** en local (+2) y CI del PR en verde (#540, fusionado el 24/10).

## Cierre de sesión — 24 de octubre de 2026 (344): fechas y plurales que se leen a la primera

- **Mismo encargo que la 343** (experiencia de usuario sin abrir paquetes). Sale de las capturas del barrido a 390 px.
- **Fechas ambiguas.**
  - «Vence el 23 nov 26», «Se esperaba el 19 oct 26»: el año de dos cifras se leía como un día. Nace `displayShortDate`: «19 oct» si es de este año y «8 ene 2027» si no.
  - Se usa en lo que el usuario lee: cobertura de Hoy, vencimientos de las decisiones de Hoy y preguntas de cobros y cargos esperados.
  - `shortDate` no cambia, porque sus etiquetas están fijadas en el oro del motor de fechas (WP-07, 493 casos).
  - «Libre de deuda: sept 29» se leía como «29 de septiembre»: ahora «sept 2029». La etiqueta de mes «oct 26» se queda, porque es la convención de toda la app (156 líneas de pruebas).
- **Plurales con paréntesis en el recorrido del cierre** («movimiento(s)», «día(s)», «cuenta(s) descuadran», «cosa(s)», «salto(s)», «hace N minuto(s)»):
  - corregidos en Cierre, en la tarjeta de recálculo de Registrar y en la cobertura de Hoy;
  - «Cobertura actual 0.9 meses» pasa a «0,9 meses».
- **Queda para una tarea aparte:** ~60 decimales más con punto inglés y ~250 plurales con paréntesis en pantallas menos usadas.
- **Pruebas:**
  - Nueva: `tests/fechas-y-plurales-legibles.test.cjs` (4).
  - Dos pruebas adaptadas a los textos nuevos (`r1-r4-registrar` y la e2e del ensayo del cierre).
  - Cinco contextos de prueba reciben el doble de `displayShortDate` junto al de `shortDate`, sin tocar ninguna aserción.
- **Validación:** `npm run verify` en verde, salida 0: `npm test` 6119/6119 (+4), lint, typecheck, accesibilidad, rendimiento, build, privacidad y smoke. Playwright, en el CI del PR.

## Cierre de sesión — 24 de octubre de 2026 (343): barrido móvil de todas las pantallas; los gráficos ya no se cortan al ver su tabla

- **Qué pidió el hogar:** «adelanta con todo lo que puedas que no dependa de mí o del hogar, priorizando impacto en experiencia de usuario y funcionalidades». Las funcionalidades nuevas chocan con la regla de parada (confirmada el 23/10): esta sesión hace experiencia de usuario sin abrir paquetes nuevos (errores, pulido y el cambio de Hoy ya acordado) y propone al hogar qué abriría si levanta la regla.
- **Barrido a 390 px**, con el tema v2, en claro y en oscuro, de 41 pantallas: celdas cuyo contenido no cabe, elementos fuera de la pantalla y textos recortados, con los detalles plegables abiertos. Se repitió con 70 movimientos de conceptos largos en las 18 pantallas que los enseñan.
- **Error encontrado y corregido** en el kit de gráficos (WP-28), usado en Plan › Previsión (banda de caja) e Inversión › Cartera (proyección del patrimonio).
  - **Qué pasaba:** al abrir «Ver como tabla», la tabla ensanchaba la figura a ~1.120 px en un móvil de 390, por la regla genérica `table { min-width: 1120px }` de `styles.css`. El dibujo, su lectura y la tabla se cortaban por la derecha, y solo se veía la columna del día.
  - **Arreglo:** la rejilla de la figura es `minmax(0, 1fr)` y la tabla anula el mínimo, como las demás tablas e19. En el móvil, la tabla se desplaza dentro de su caja, con la columna del día fija (también la esquina, por encima de la cabecera fija) y menos relleno.
- **Sin cambios:** lo demás que marcó el barrido son cabeceras ocultas a propósito en tablas apiladas y textos solo para lectores de pantalla. El «Saltar al contenido» de las capturas largas no es un error: sin foco está fuera de la pantalla.
- **Pendiente:** queda anotado para una tarea aparte el plural antiguo «día(s)», «movimiento(s)»… (≈ 300 textos).
- **Pruebas:**
  - Dos e2e nuevas («Kit de gráficos · Ver como tabla en el móvil»), en Previsión y Patrimonio.
  - Mutación comprobada: con el CSS anterior, las dos fallan.
- **Validación:** `npm run verify` en verde, salida 0: `npm test` 6115/6115, lint, typecheck, accesibilidad, rendimiento, build, privacidad y smoke. Playwright completo, en el CI del PR.

## Cierre de sesión — 23 de octubre de 2026 (342): revisión de salida de la Ola 1, contraste fiscal de WP-23 y ensayo del cierre de octubre

- **Qué pidió el hogar:** arrancar la sesión analizando el backlog y el panel de seguimiento, y proponer un plan. Plan aprobado («adelante con mis respuestas»), con tres respuestas:
  1. acepta medir M-HOY de forma pasiva;
  2. comunidad autónoma dada por el chat;
  3. no se poda ningún paquete: el hogar alimentará WP-40, WP-48, WP-50 y WP-52.
- **Diagnóstico de partida:** construido 63,2 %, comprobado 0 %; 21 paquetes esperando al hogar; 1 de 21 tareas del hogar marcada (H-02 y H-03 vencidas); 0 movimientos en octubre. El cuello de botella ya no es construir, sino que la app reciba datos.
- **1 · Revisión de salida de la Ola 1 (H-04): parar y revisar.** Detalle en `docs/REVISION_SALIDA_OLA1_2026-10-23.md`.
  - **M-HOY:** la mide sola el medidor de utilidad (XGO-02); H-02 queda sustituida.
  - **Congelación de Hoy:** se levanta el 25/10 con **un cambio por semana**. El primero, mover la bandeja de decisiones a Movimientos. La línea base es la mediana anterior al primer cambio.
  - **Rediseño:** ninguna pantalla nueva hasta las revisiones del 2/11 y el 4/11.
  - **Paquetes con aportación periódica:** si su tarea pasa 30 días vencida, se proponen para archivo.
  - **Plan:** 12 tareas nuevas del hogar (H-22 a H-33), de modo que los 21 paquetes «esperando al hogar» tienen tarea con fecha (antes, 16 no la tenían). La de más palanca es H-22, importar el extracto de octubre antes del 31/10. También 3 hitos nuevos y M-HOY redefinida.
  - **Documentos:** `BACKLOG_DEFINITIVO.md` §0, §4, §6, §7, §9 y §12; `docs/plan/plan-definitivo.json` (33 tareas, 19 hitos); `docs/rediseno/ESTADO.md` §8.
- **2 · WP-23, contraste de los parámetros legales** (`docs/WP23_DISENO.md` §10).
  - **Contrastados con su fuente:** pensiones, donativos, compensación y retención voluntaria, con el Manual práctico de Renta 2025 de la AEAT, el RDL 6/2023 y el art. 88.5 del RIRPF.
  - **Vivienda sigue pendiente:** falta confirmar el tramo autonómico de la comunidad del hogar.
  - **Ninguna cifra cambia.** Los textos ganan matices: tope del 30 % en pensiones, límite del 10 % y regla de recurrencia en donativos, compensación del 25 % y vigencia de la retención voluntaria en los años siguientes, que confirma la desviación de FIS-02.
  - **En el código:** el motor lleva `source`, `checked` y `pending`, y la pantalla dice con qué fuente se contrastó cada parámetro o qué le falta. Una prueba impide «verificado» sin fuente ni fecha.
  - **La comunidad autónoma no se escribe en el repositorio.**
  - **Límite de método:** el contenedor no puede abrir `sede.agenciatributaria.gob.es`, `www.boe.es` ni la web de la comunidad (la red los deniega). El contraste usa el texto del manual tal como lo devuelve el buscador.
  - **Hallazgo fuera de alcance:** la deducción autonómica por el encarecimiento de la hipoteca variable (25 % del exceso de intereses sobre el Euribor de diciembre de 2022). Se pide en la Renta, no en diciembre. Candidata para WP-21 o A15-2, a decidir por el hogar.
- **3 · Ensayo del cierre de octubre**, con el reloj en el 2/11 y a 390 y 1440 px, partiendo de 0 movimientos: importar extracto → clasificar la bandeja → Cierre → paso de firma. **Funciona de principio a fin.**
  - **Para firmar hacen falta tres cosas:**
    - movimientos de octubre importados (si no, «Extracto incorporado» no se cumple);
    - ningún concepto sin partida;
    - **sesión iniciada y sincronizada** (el cierre es un RPC transaccional).
  - **Error corregido:** en el móvil, la tabla «Conciliar cuentas» montaba las cifras unas sobre otras y cortaba la insignia. Ahora cada cuenta es un bloque, con roles ARIA para que siga siendo tabla en lectores de pantalla.
  - **Prueba nueva:** una e2e permanente, «Ensayo del cierre de octubre». Su mutación está comprobada: sin el arreglo, falla a 390 px.
- **Novedades:** dos líneas (fuentes de la campaña fiscal y cierre en el móvil).
- **Validación:**
  - `npm run verify` en verde, salida 0: `npm test` 6115/6115, lint, typecheck, accesibilidad, rendimiento, build, privacidad y smoke.
  - Playwright (e2e, axe y rendimiento por pantalla): **212/212** (+2, las del ensayo del cierre a 390 y 1440 px).
- **Revisión mensual de Nielsen:** no vencida (última el 15/10; vence el 14/11).

## Cierre de sesión — 22 de octubre de 2026 (341): XGO-02 — Medidor de utilidad

- **Qué pidió el hogar:** «adelante con el medidor de utilidad» (P10: PR aparte, justo detrás de Funciones en prueba).
- **Qué mide:** por función y mes, en este navegador y solo en agregado (ningún importe ni concepto), cuatro cosas, más los segundos hasta la primera acción en Hoy (mediana):
  - **vista:** días distintos en que se vio; un repintado no cuenta;
  - **acción:** aceptar una regla, importar un extracto, abrir o filtrar un movimiento, pulsar en Hoy;
  - **descarte:** saltar un grupo, «Ver todo el detalle», ir al asistente de siempre o volver al diseño de siempre;
  - **deshecho:** deshacer una regla o un lote.
  - **Tasa de acción:** la parte de los días vistos en que además se actuó.
- **Qué funciones:** las cinco en prueba (diseño nuevo, Hoy, Movimientos, Importar y Clasificar), porque son las que tienen revisión el 2/11 y el 4/11. El resto de recomendaciones de la app se instrumenta con la misma pieza cuando toque revisarlas.
- **Dónde se ve:**
  - En **Ajustes › Uso de la app**, la tarjeta «Medidor de utilidad», junto al panel de uso de WP-03: informe mensual con selector de mes, una ficha por función con su tasa a la derecha.
  - En **Funciones en prueba**, una línea «Medido: …» junto a la métrica de cada función. Así la pregunta «¿se queda?» llega con datos.
- **Cómo:**
  - `medidor-utilidad.js` (nuevo, UMD): lógica pura probada aparte y el pintado del informe.
  - Las pantallas anotan con `globalThis.FinanceMedidor?.anotar(…)`, una línea por evento, y nada se rompe si el medidor no carga.
  - Se guardan 6 meses. Un lote importado cuenta una vez aunque se repinte.
  - `app.js` y `usage-panel.js` sin cambios. Hoy no cambia lo que enseña (sigue congelado hasta el 25/10): solo anota.
- **Desviaciones** (`ESTADO.md` §4):
  - Solo las cinco funciones en prueba, no «cada recomendación o aviso».
  - Módulo propio en vez de ampliar `usage-panel.js`, que mide días y saldos, no funciones.
  - Dos métricas del catálogo se leen por aproximación: «conceptos sin partida tras importar» (Clasificar) por reglas aceptadas, saltadas y deshechas; «extractos importados por semana» (Movimientos) por sus días de uso y acciones.
- **Pruebas:**
  - Nueva: `tests/xgo02-medidor-utilidad.test.cjs` (9).
  - Una e2e en `qa1`: una tanda de Clasificar (aceptar y saltar) queda medida en el informe y en «Funciones en prueba», y el almacén no guarda conceptos ni importes.
- **Validación:**
  - `npm run verify` en verde, salida 0: `npm test` 6115/6115 (+9), lint, typecheck, accesibilidad, rendimiento, build, privacidad y smoke.
  - Playwright (e2e, axe y rendimiento por pantalla): **210/210** (+1).
  - Capturas de las dos tarjetas a 390 y 1440 px, en claro y en oscuro, con datos, revisadas.
- **Lo que esto no arregla:** el medidor cuenta desde hoy y solo en este navegador. Si el 2/11 os encuentra con 0 movimientos importados, medirá que Movimientos, Importar y Clasificar no se han usado, que es la respuesta honesta.

## Cierre de sesión — 22 de octubre de 2026 (340): XGO-03 — Funciones en prueba

- **Qué pidió el hogar:** «adelante con Funciones en prueba» (paso 4 de `docs/rediseno/ESTADO.md` §8; P8 y P9).
- **Qué cambia, en los dos temas:**
  - **Dónde:** Ajustes › Simuladores y Laboratorio estrena la tarjeta **«Funciones en prueba»**, encima del Laboratorio de pantallas heredadas (que no cambia). Va en los dos temas porque, desde el clásico, es la forma de volver al diseño nuevo sin tocar la URL.
  - **Primer interruptor, «Diseño nuevo»** (`role="switch"`): encendido, porque es el de por defecto desde el 19/10. Al moverlo recarga con `?tema=clasico` o `?tema=v2` y vuelve a Ajustes, a la tarjeta. Los enlaces con `?tema=` siguen funcionando y mueven el interruptor.
  - **Pantallas del rediseño:** debajo, agrupadas («Pantallas que van con «Diseño nuevo»»), Hoy, Movimientos, Importar y Clasificar. Cada una con qué hace, desde cuándo está en prueba, su fecha de revisión y su métrica.
  - **Revisión (P9):** a los 14 días la fila pregunta «Dos semanas en prueba: ¿se queda?» con «Graduar» o «Dos semanas más». El aviso «N por revisar» sale en la entrada Ajustes del menú y en su ancla, visible desde cualquier pantalla. Hoy no se toca porque está congelado hasta el 25/10. Las primeras revisiones saltan el **2/11** (Diseño nuevo y Hoy) y el **4/11** (Movimientos, Importar y Clasificar).
  - **Graduar solo anota la decisión con su fecha.** La versión de siempre no se borra: retirarla se hace después y con vuestro visto bueno (CLAUDE.md).
- **Cómo:**
  - `funciones-en-prueba.js` (nuevo): módulo UMD como los demás, con la lógica pura (catálogo, estado, revisión, graduar, aplazar) probada aparte y el pintado.
  - Estilos en `design-tokens.css`, para los dos temas. El interruptor apagado lleva borde para el 3:1 de WCAG 1.4.11.
  - `app.js` sin cambios. `tema-v2.js` sigue siendo el único que guarda la elección de tema y el script de `<head>` el único que la lee.
- **Desviaciones de la ficha y del prompt 3** (`ESTADO.md` §4):
  - El diseño nuevo nace encendido, no apagado (decisión 9).
  - La ficha decía «banderas en `ux-settings.js`», pero ese fichero no tiene banderas: es el reparto por titular.
  - Las pantallas no tienen interruptor propio, porque van con el tema; si alguna hay que apagar sola, se le añade su bandera.
  - Solo «Graduar» o «Dos semanas más», sin «Retirar», porque retirar código se consulta.
  - Las decisiones se guardan en este navegador, como la elección de tema.
  - Las métricas están escritas pero no se miden: es el medidor XGO-02, el siguiente PR (P10).
- **Pruebas:**
  - Nueva: `tests/xgo03-funciones-en-prueba.test.cjs` (7).
  - Dos e2e en `qa1`:
    - el interruptor va al clásico y vuelve, con la preferencia guardada y borrada por `tema-v2.js`;
    - con el reloj del navegador en el 3/11, dos revisiones, el aviso «2 por revisar» en el menú, graduar Hoy, aplazar el diseño nuevo y que persista tras recargar.
- **Validación:**
  - `npm run verify` en verde, salida 0: `npm test` 6106/6106 (+7), lint, typecheck, accesibilidad, rendimiento, build, privacidad y smoke.
  - Playwright (e2e, axe y rendimiento por pantalla): **209/209** (+2).
  - Capturas a 390 y 1440 px en claro y en oscuro, con el diseño nuevo y con el clásico, y con revisiones pendientes, revisadas.
- **Siguiente:** el medidor de utilidad XGO-02 (P10), en PR aparte. Sin él, la pregunta del 2/11 se contestará por impresión, no por datos.

## Cierre de sesión — 21 de octubre de 2026 (339): confianza de la propuesta en Clasificar y tarjeta de Registrar en el móvil

- **Qué pidió el hogar:** hacer aquí las dos tareas aparte que dejó la sesión 338.

**1 · Confianza de la propuesta en Clasificar (rediseño A5, prompt 5).**
- **Qué cambia (solo con el tema v2):** la caja «Propuesta» dice «confianza alta», «media» o «baja», como la referencia, y debajo el porqué en una frase. Desaparece la línea plegada «Aún sin confianza…». Lo elegido a mano («Elegida») no lleva confianza.
- **Definición** (`clasV2Proposal`, función pura en `views/clasificar-v2.js`). Solo usa datos que ya existían; no hay ninguna cifra ni porcentaje inventado. Dos señales:
  - **Reglas del hogar para el mismo comercio.** El comercio es la primera palabra del concepto con 3 letras o más que no dice cómo se pagó (fuera «compra», «tarjeta», «recibo», «bizum», «tpv»…). Así, «MERCADONA 5678» aprovecha la regla de «MERCADONA 1234». Las reglas de «solo este movimiento» no cuentan.
  - **Coincidencia de nombre**, la de siempre (al menos 4 caracteres), pero contando cuántas partidas encajan y quedándose con la más concreta.
  - **Alta:** 2 o más reglas del comercio a la misma partida (sin que el nombre apunte a otra), o una regla y además el nombre de esa partida en el concepto.
  - **Media:** una regla del comercio, o una sola partida por nombre (o varias si la más concreta contiene a las demás, «Seguro coche» frente a «Seguro»). Una regla que contradice el nombre también baja a media y lo dice.
  - **Baja:** el comercio ya tiene reglas a varias partidas, o encajan por nombre partidas distintas.
- **Por qué importa:** mitiga el riesgo que dejó abierto la 338. Si el banco mete referencias en el concepto, el mismo comercio sale en varios grupos, pero en cuanto uno tiene regla, los demás la llevan propuesta.
- **Lo que no cambia:** el asistente de importación sigue con su sugerencia de siempre (`datosImportarSuggestionFor`). Tocarla se hablaría aparte.

**2 · Tarjeta «Previsto, real y usado» de Registrar en el móvil (los dos temas).**
- **Causa:** la tarjeta es una fila flexible con el título y una rejilla de tres columnas `minmax(0, 1fr)`. La rejilla podía encogerse casi a cero en vez de bajar bajo el título, y a 390 px quedaban tres columnas de ~100 px con una palabra por línea (en la e2e, 12 px).
- **Arreglo** (`design-tokens.css`): la rejilla tiene base propia de 420 px, así que baja cuando no cabe al lado, y por debajo de 640 px va en una columna. El escritorio no cambia (109 px de alto antes y después); comprobado también a 600, 700, 768, 900, 1024 y 1280 px.

- **Pruebas:**
  - `tests/redis-a5-clasificar.test.cjs`: 14 (+5), un caso por nivel de confianza y los bordes.
  - `tests/registrar-regla-movil.test.cjs`: 2, nueva.
  - E2E: la de A5 comprueba la confianza «media» con una regla previa del mismo comercio. Una nueva a 390 px en los dos temas mide el ancho real de cada concepto de la tarjeta; sin el arreglo falla (12 px).
- **Validación:**
  - `npm run verify` en verde, salida 0: `npm test` 6099/6099 (+7), lint, typecheck, accesibilidad, rendimiento, build, privacidad y smoke.
  - Playwright (e2e, axe y rendimiento por pantalla): **207/207** (+2).
  - Capturas de Clasificar a 390 y 1440 px en claro y en oscuro, y de la tarjeta de Registrar antes y después, revisadas.

## Cierre de sesión — 21 de octubre de 2026 (338): rediseño A5 — Clasificar por lotes

- **Qué pidió el hogar:** «adelante con Clasificar por lotes», por delante de «Funciones en prueba» (XGO-03). Es lo que hace útil la tarjeta «N conceptos sin partida» de la bandeja de Movimientos (A4).
- **Qué cambia (solo con el tema v2):**
  - La tarjeta «N conceptos sin partida» de la bandeja abre **Clasificar**: hoja inferior en el móvil y panel derecho de 400 px en escritorio, sin salir de la lista (`Clasificar.png`, HANDOFF §5b). El filtro «Sin partida» sigue en la lista.
  - **Grupos del mismo concepto** (la clave de las reglas, `movementMappingKey`), del que más suma al que menos, **5 por tanda** con su barra de progreso («1 de 5 · 3 más en otra tanda»).
  - Cada grupo: nº de movimientos, lo que suma en el mes del último y el importe típico (de menor a mayor).
  - **Propuesta:** la de siempre al importar (`datosImportarSuggestionFor`). **Sin confianza inventada**: el motor no la da, así que va plegada en una línea que dice de dónde sale la propuesta. Tarea aparte para calcularla (prompt 5).
  - **Alternativas:** hasta 3, las partidas con más reglas del mismo tipo que ya tiene el hogar; «Otra…» abre todas. Sin propuesta ni reglas, el selector sale directamente y «Aceptar» espera a que se elija.
  - **«Aceptar y siguiente»** crea la regla para siempre, con el aviso «Deshacer» de 10 s de siempre (`showUndoToast`). **«Saltar»** la deja en la bandeja.
  - **Al acabar la tanda:** las reglas creadas, cada una con su «Deshacer», los saltados y «Otros N» si quedan grupos.
  - **Escritorio:** atajos ↵ aceptar, 1-3 alternativas, S saltar, ⌘Z/Ctrl+Z deshacer.
- **Cómo:**
  - `views/clasificar-v2.js` (defer, antes de `app.js`) y un `<dialog id="clasificarV2">` en `index.html`: el fondo, el foco y Escape los pone el navegador.
  - Escribe en el mismo diccionario de reglas (`movementMappings`) y con la misma secuencia de refresco que el lote de Movimientos (`handleMovementsBulkApply`): guardar, recalcular reales, bandeja, filas del asistente de importación, guardar reales y repintar. No hay una cuarta forma de escribir una clasificación.
  - **Deshacer** devuelve la regla de antes y el valor de antes de cada real que la regla tocó (partida × mes, salvo meses cerrados y compras provisionales con tarjeta), y vuelve a recalcular. `applyMovementMappingsToActuals` solo escribe, nunca borra: sin guardar esos valores, deshacer dejaba el real inflado.
  - `app.js` **sin cambios**. Ningún motor se toca.
- **Desviaciones de la referencia** (`docs/rediseno/ESTADO.md` §4): confianza plegada; grupo por concepto y no por «comercio normalizado» (una regla solo se aplica a su clave; si el banco mete referencias en el detalle, el mismo comercio sale en varios grupos); «Ajustes › Reglas» no existe, así que el texto dice dónde se deshace de verdad.
- **Pruebas:**
  - Nueva: `tests/redis-a5-clasificar.test.cjs` (9).
  - Una e2e por ancho en `qa1` (390 y 1440 px): abrir desde la bandeja, hoja inferior o panel de 400 px, elegir con «Otra…», aceptar con su aviso, saltar con botón y con S, deshacer desde el resumen (el diccionario vuelve a ser idéntico) y cerrar.
  - **Ajustada:** la e2e de Movimientos v2 pulsa «Sin partida» en la lista en vez de en la bandeja, porque la tarjeta de la bandeja ahora abre Clasificar. Misma comprobación.
- **Validación:**
  - `npm run verify` en verde, salida 0: `npm test` 6092/6092 (+9), lint, typecheck, accesibilidad, rendimiento, build, privacidad y smoke.
  - Playwright (e2e, axe y rendimiento por pantalla): **205/205** (+2).
  - Capturas a 390 y 1440 px en claro y en oscuro, con y sin propuesta, revisadas. Encontrado y arreglado en ellas: con un concepto largo la hoja desbordaba y, al enfocar «Aceptar», tapaba la cabecera; ahora los botones van fijos abajo y el foco no desplaza la hoja.
- **Lo que no comprueba nada de esto:** que clasificar sea rápido con un extracto real. Octubre sigue con 0 movimientos importados; la primera tanda real es la prueba de verdad.
- **Siguiente del rediseño:** «Funciones en prueba» (XGO-03).

## Cierre de sesión — 21 de octubre de 2026 (337): rediseño A4, PR-2 — Importar v2

- **Qué pidió el hogar:** la segunda mitad de «Movimientos e Importar». Antes de construirla se le preguntaron dos cosas en las que el diseño choca con el asistente actual, y contestó con la recomendación en las dos (`docs/rediseno/ESTADO.md` §3b):
  - **P17, duplicados:** solo se descartan solos los **seguros**, los que coinciden en fecha, importe y concepto con algo ya registrado. Salen tachados y con «No es duplicado». Los parecidos (otro día u otro texto) y las capturas a mano siguen preguntando.
  - **P18, sin partida:** se importa igual y espera en la bandeja de Movimientos. Hasta tener partida no cuenta en los reales de ninguna.
- **Qué cambia (solo con el tema v2), en Registrar › Importar extracto:**
  - Arriba, «‹ Movimientos» e «Importar extracto».
  - **Sin fichero:** una tarjeta «CSV o Excel» que abre el input de siempre. Debajo, una línea plegada con lo que aún no existe: Compartir (XDA-02) y pegar el texto del PDF (XDA-03).
  - **Con fichero:**
    - Las líneas reconocidas, primero las que piden decisión, cada una con su estado: su partida, «sin partida: a la bandeja», duplicado tachado, o «¿Duplicado de …?» con dos botones. Se ven 8 y se puede pedir «Ver las N».
    - La cuenta del extracto.
    - El **cuadre**: saldo inicial + movimientos = saldo final, en cualquier orden del fichero. Si trae saldos y no cuadran, no se importa y dice entre qué fechas faltan movimientos (P11). Sin saldos, se importa con aviso.
    - El saldo final del extracto como saldo de la cuenta (WP-26).
    - «Importar N movimientos». Se desactiva y dice por qué mientras haya duplicados por decidir o el extracto no cuadre.
  - **Al importar:** la confirmación y el lote de siempre. Después, «N movimientos importados» con «Ver en Movimientos», «Deshacer» (el «Deshacer último lote» de siempre) e «Importar otro».
  - **Sigue a la vista:** la lectura del fichero (WP-51, «Cómo he leído…») y sus avisos.
  - **El asistente de cuatro pasos** sigue entero tras «Ver el asistente de siempre». Con él abierto, los duplicados se deciden allí uno a uno, como antes.
- **Cómo:**
  - `views/importar-v2.js` (defer, antes de `app.js`) es otra cara del mismo asistente: `datosImportarSession`, `datosImportarApply` y `handleDatosImportarConfirmar`.
  - El cuadre usa `statementContinuity` del motor de saldos (`canonical-balance-pulse.js`). Ningún motor se toca.
  - `app.js` +1 línea: `renderDatosImportar` avisa a la v2.
- **Desviaciones de la referencia:** en `docs/rediseno/ESTADO.md` §4.
  - Importar sigue en Registrar, no es una pantalla propia; moverlo es parte de la navegación de 5 destinos.
  - La «fecha dudosa» por línea la cubre la lectura del fichero (WP-51).
  - La cobertura tras importar es XDA-04.
- **Pruebas:**
  - Nueva: `tests/redis-a4-importar.test.cjs` (8).
  - Una e2e por ancho en `qa1` (390 y 1440 px). Recorre: duplicado seguro tachado, parecido que bloquea hasta decidir, cuadre, cuenta, importar con confirmación, deshacer y asistente de siempre.
  - **Ajustadas:** las 6 pruebas que recorren el asistente de cuatro pasos (WP-26, WP-51, WP-53, WP-54 y dos de axe) lo abren antes con «Ver el asistente de siempre». No se relaja ninguna comprobación.
- **Validación:**
  - `npm run verify` en verde, salida 0: `npm test` 6083/6083 (+8), lint, typecheck, accesibilidad, rendimiento, build, privacidad y smoke.
  - Playwright (e2e, axe y rendimiento por pantalla): **203/203**.
  - Capturas a 390 y 1440 px en claro y en oscuro, revisadas.
- **Encontrado de paso, sin tocar** (anterior a esta sesión): en el móvil, la tarjeta «Una regla en las cuatro pestañas» de Registrar pinta sus tres columnas (Previsto, Real, Usado) a 390 px y el texto queda roto en una palabra por línea. Pide una tarea aparte: plegarla o pasarla a una columna.
- **Siguiente del rediseño:** «Funciones en prueba» (XGO-03) y, después, Clasificar por lotes (A5), que es lo que hará útil la bandeja «N conceptos sin partida».

## Cierre de sesión — 21 de octubre de 2026 (336): rediseño A4, PR-1 — Movimientos v2

- **Qué pidió el hogar:** «adelante con Movimientos e Importar» (21/10). Pasa delante de «Funciones en prueba» (XGO-03) en el orden de `docs/rediseno/ESTADO.md` §8, porque sin movimientos las demás pantallas enseñan datos vacíos. Va en dos PR (P12): este es Movimientos; Importar es el siguiente.
- **Qué cambia (solo con el tema v2, que es el de por defecto):** Movimientos según `Movimientos.png` y `MovimientosDesktop.png`.
  - **Cabecera:** «Movimientos», buscar e Importar. En escritorio, también «Cierre de <mes>».
  - **Bandeja:**
    - «N conceptos sin partida»: filtra la lista. Dar partida a un movimiento se la da a los del mismo concepto.
    - La tarjeta de anomalías (WP-36) sigue a la vista, como parte de la bandeja.
  - **Una línea plegada** con lo que la referencia enseña y aún no existe: extracto por Compartir (XDA-02), cobros confirmados por el extracto (XDA-08) y cobertura de 90 días por cuenta (XDA-04).
  - **Filtros:** «Todas», uno por cuenta y «Sin partida». El buscador busca por concepto, importe o partida.
  - **Lista por día:**
    - Cada movimiento lleva su partida como etiqueta, o «¿partida?» con borde discontinuo si no tiene.
    - Los ingresos van en verde con «+».
    - Enseña 40 y se pide «Ver más».
    - En escritorio es una tabla con Fecha, Concepto, Cuenta, Partida e Importe.
  - **Al final**, el acceso a Cierre.
  - **Con 0 movimientos**, un solo bloque que lleva a Importar. La tarjeta de anomalías, que solo repetiría «importa el extracto», queda tras el detalle.
  - **Tocar un movimiento** abre el panel de detalle de siempre, donde se cambia su partida.
  - **«Ver todo el detalle»** devuelve la vista de siempre entera: rango, tipo de acción, selección en lote, comercios y totales.
- **Cómo:**
  - `views/movimientos-v2.js` (defer, antes de `app.js`), con el patrón de A3.
  - Dos contenedores en `#movements`: cabecera y bandeja arriba, lista debajo de la tarjeta de anomalías (orden con CSS).
  - `app.js` +5 líneas: la llamada al pintar Movimientos y `openMovementDetailRow`, que separa abrir el panel de buscar la fila por índice.
  - Estilos en `tema-v2.css`, bajo `:root[data-tema="v2"]`. Ningún motor tocado.
- **Desviaciones de la referencia:** recogidas en `docs/rediseno/ESTADO.md` §4.
  - Clasificar como panel derecho de 400 px es A5.
  - La bandeja de decisiones de Hoy no se mueve aquí mientras Hoy esté congelado (hasta el 25/10).
  - Cifras de la referencia como «cuota esperada ✓» o «+18 % vs. media» no se pintan: no hay motor que las dé por movimiento.
- **Pruebas:**
  - Nueva: `tests/redis-a4-movimientos.test.cjs` (9).
  - Una e2e por ancho en `qa1` (390 y 1440 px). Recorre vacío → Importar, lista por día, filtros, panel de detalle, vista de siempre y que no haya desborde.
  - **Ajustadas:**
    - Las dos de WP-36 abren el detalle cuando no hay movimientos, que es donde queda ahora la tarjeta. El helper que siembra anomalías repinta la vista, como haría una importación.
    - `m1-m11` extrae también `openMovementDetailRow`.
    - No se relaja ninguna comprobación.
- **Validación:**
  - `npm run verify` en verde, salida 0: `npm test` 6075/6075 (+9), lint, typecheck, accesibilidad, rendimiento, build, privacidad y smoke.
  - Playwright (e2e, axe y rendimiento por pantalla): 199/201 en la primera pasada. Las 2 que fallaron eran las nuevas de A4: esperaban «+3000» y la app pinta, bien, «+3.000 €». Corregida la expectativa, pasan 2/2.
  - Capturas a 390×844 y 1440×900, en claro y en oscuro, revisadas frente a la referencia.
- **Siguiente:** A4 PR-2, Importar. Antes de construirlo hacen falta dos decisiones del hogar. La referencia descarta los duplicados sola (con deshacer) y deja lo dudoso para la bandeja, y el asistente actual pide una decisión explícita en cada caso.

## Cierre de sesión — 21 de octubre de 2026 (335): desalojo de `app.js`, PR-2: Partidas y el motor de escenarios salen a sus scripts

- **Qué pidió el hogar:** el bloque C del plan de hoy, el PR-2 del desalojo (XGO-01, P6: Partidas + Escenarios). Lo pidió en esta misma sesión, sin esperar a confirmar en el móvil que el PR-1 va bien.
- **Qué cambia: nada visible.**
  - **113 funciones** pasan tal cual, sin cambiar una coma, a scripts clásicos que se cargan con `defer` antes de `app.js`:
    - **72 de Plan › Partidas a `partidas-ui.js`:** la tabla de gestión, el alta y la edición por lotes, el editor de series, el simulador «¿y si…?», los hitos, los escenarios fantasma y el gráfico.
    - **41 del motor de escenarios al nuevo `escenarios-ui.js`:** catálogo de tipos, también los propios del hogar, campos, cálculo, escenarios guardados y la retirada de lo aplicado.
  - El motor **no** va a `views/escenarios.js`. Esa vista se descarga al visitarla, y el motor lo usan Plan › Partidas, la segunda opinión y el comparador de estrategias de deuda, que no la cargan. Si estuviera ahí, esas pantallas tendrían que esperar a la red.
  - **`app.js` baja de 34.977 a 33.129 líneas (−1.848)** y el techo de ARQ-4, de 35.107 a **33.259**, por el mismo trinquete (P7). Con las cinco pruebas que lo repiten.
  - `escenarios-ui.js` se añade a `index.html`, a `tools/build-public-site.mjs`, a `service-worker.js` y a `FICHEROS_APP`. Sube la versión `?v=` de `partidas-ui.js`.
- **Cómo se eligió qué mover.**
  - En Partidas, las funciones de su pantalla por su nombre (`*Partidas*`, `partidas*`, más el editor de series). Se deja fuera `ajustesPartidasOverThreshold`, que es de Ajustes.
  - En Escenarios, las del motor (`*escenarioMotor*`, más las tres `retract*FromEscenario`).
  - Se dejan en `app.js` las del modelo de planificación que usa toda la app (`planningSectionsForMonth`, `planningBreakdownForForecastMonth`…), porque no son de la pantalla.
- **Cómo se comprobó que no cambia nada.**
  - **Equivalencia:** antes y después hay las mismas 1.811 funciones de primer nivel entre `app.js`, `partidas-ui.js` y `escenarios-ui.js`, idénticas byte a byte. Las 1.817 líneas que no son funciones (ni comentarios ni líneas en blanco) son idénticas y van en el mismo orden.
  - **Antes de mover:** ninguna de las 113 se declara en otro script ni se reasigna.
- **Pruebas.**
  - Solo cambió una por la mudanza: `ola2-p1-series-rows-memo` recortaba `availableSeriesRows` hasta la función que la seguía en `app.js` (`selectedSeriesRow`, que se ha ido). Ahora la recorta hasta su cierre. No se relaja nada.
  - Prueba nueva en `tests/xgo01-sin-funciones-duplicadas.test.cjs`: Partidas y el motor viven fuera de `app.js`, se cargan antes que él y el motor no está en la vista bajo demanda.
- **Validación (sobre `main` sin #531):**
  - `npm run verify` en verde, salida 0: `npm test` 6052/6052 (+1), lint, typecheck, accesibilidad, rendimiento, build, privacidad y smoke.
  - Playwright: e2e, axe y rendimiento por pantalla, 199/199.
  - Repetido sobre `main` con #531: `npm test` 6066/6066, lint y typecheck en verde.
- **Lo que queda de XGO-01:** el desalojo está hecho: entre los dos PR han salido 4.319 líneas. Falta la otra mitad de la propuesta, la prueba de CI de «uno entra, uno sale» (GOV-02). Siguiente en el orden del rediseño: «Funciones en prueba» (XGO-03), luego el medidor de utilidad (XGO-02), luego Movimientos e Importar (A4).

## Cierre de sesión — 21 de octubre de 2026 (334): WP-41 publicado, límite de 3 en curso aplicado y panel con «construido» y «comprobado»

- **Qué pidió el hogar:** arrancar sesión, analizar el backlog y el panel de seguimiento y proponer un plan. Aprobado tal cual: A (publicar lo hecho), B (que el panel diga la verdad) y C (PR-2 del desalojo), con las cuatro decisiones recomendadas.
- **Decisiones del hogar (21/10):**
  - «Esperando al hogar» cuenta como construido (50 %) y nunca como comprobado.
  - Hoy congelado hasta el 25/10: si para entonces no está H-02, la congelación se levanta (`BACKLOG_DEFINITIVO.md` §4).
  - La regla de parada de la Ola 1 se aplica: sin lecturas de M-HOY ni M-ADOP, no se abre ningún paquete nuevo.
  - PR-2 del desalojo en esta misma sesión.
- **A · WP-41, cuarta entrega publicada.** Llevaba desde el 16/10 en la rama `claude/gracious-brahmagupta-mjdhhj` (f8db014), 38 commits por detrás de `main`. Entró sin conflictos. Es la lista plegada y de solo lectura «N cargos que se repiten cada mes y que no he marcado» en Deuda › Contratos (detalle en `docs/WP41_DISENO.md` §8). La línea de «Novedades» lleva la fecha de hoy, que es cuando llega al hogar.
- **B · El panel y el backlog dicen lo mismo, y lo dicen bien.**
  - **Hallazgos al cruzar el panel con los documentos:**
    - 25 paquetes «en curso» con un límite de 3 aprobado el 19/10.
    - WP-23, WP-28 y WP-33 tenían el estado mal escrito («curso») y pesaban 0: el panel enseñaba 58,7 % y los documentos, 61,9 %.
    - La pestaña del hogar estaba vacía, ni siquiera H-01. Tampoco había ninguna lectura de métricas.
    - WP-06 no tenía registro.
  - **Plantilla del panel** (`docs/plan/panel-seguimiento.html`):
    - Dos estados nuevos, «esperando al hogar» y «aparcado», con su peso en `docs/plan/plan-definitivo.json`.
    - Un estado mal escrito se lee como el bueno.
    - Las cifras se reparten en cinco: avance construido, **avance comprobado** (solo métricas leídas con datos reales y en objetivo), previsto, desvío y paquetes hechos, con los esperando y los aparcados.
    - «En marcha · N de 3» cuenta el rediseño y avisa si se supera el límite.
    - Filtro nuevo «Esperando al hogar». El PR se muestra como número y no como enlace.
    - Comprobado con un navegador y una base simulada, a 1280 y a 390 px.
  - **Criba de los 25 paquetes:**
    - **En curso:** WP-23, por la fecha del 14/11 y porque contrastar los parámetros legales no depende del hogar. Con el rediseño, 2 de 3.
    - **Esperando al hogar (21),** cada uno con su tarea en la nota: WP-06, WP-29, WP-31, WP-34 a WP-36, WP-38 a WP-41 y WP-43 a WP-53.
    - **Aparcados:** WP-28, WP-37 y WP-42.
    - **Hecho:** WP-33, porque lo usan WP-08, WP-16 y WP-51.
  - **Resultado:**
    - **Construido: 63,2 %** (87 de 137,75 sesiones; el panel da 63,6 % porque no cuenta WP-54).
    - **Comprobado: 0 %.**
    - El índice plan/real de 4,8 que da el panel mide lo construido, no lo que sirve.
  - Documentos al día: `BACKLOG_DEFINITIVO.md` (§0, §1, §4 y §12) y `docs/ESTADO_TAREAS_Y_FASES.md` (§1 y la columna de estado de los 25).
- **Revisión mensual de Nielsen:** al día. La última fue el 15/10 y la siguiente vence el 14/11.
- **Validación (A y B, en la rama):**
  - `npm run verify` en verde, salida 0: `npm test` 6065/6065 (+14 de WP-41), lint, typecheck, accesibilidad, rendimiento, build, privacidad y smoke. Repetido `npm test` con los cambios de B: 6065/6065.
  - Playwright: e2e 111/111 y axe 85/85.
- **Pendiente de esta sesión:** C, el PR-2 del desalojo, en un PR aparte. Al fusionar este, se escribe la criba en la base del panel y se vuelve a publicar en la misma URL.
- **Hogar, esta semana:**
  - H-02, antes del 25/10: 5 min.
  - H-03, ya vencida: 20 min.
  - Importar el extracto de octubre de cada cuenta: 15 min.
  - Antes del 1/11: tarjetas, asignación personal y saldos en «Real manual».

## Cierre de sesión — 20 de octubre de 2026 (333): cierre del día y panel de seguimiento al día

- **Publicado hoy en `main`,** todo con el CI en verde y desplegado:
  - #522: «meses desde la última revisión» con el día local (325).
  - #524: el log del CI se lee entero cuando falla una prueba de navegador (327).
  - #525 y #526: desalojo de `app.js`, PR-0 y PR-1 (328 y 329). `app.js` pasa de 37.448 a 34.977 líneas y su techo, a 35.107.
  - #527: el fallo intermitente de la CIRBE (330).
  - #529: O-6 cerrado y marcado para recuperar (331).
  - De otra sesión, en paralelo: #523 (326) y #528, el silencio de las notificaciones de E9 con el día del hogar (332).
- **Panel de seguimiento** (`BACKLOG_DEFINITIVO.md` §12, protocolo):
  - WP-05 pasa a «hecho» y WP-13 a «hecho» con alcance reducido, con su historial.
  - Hay registro del día: `2026-10-20-cierre`.
  - La página se volvió a generar con `tools/build-plan-panel.mjs` y se publicó en la misma URL, porque cambió el plan (WP-13 a 0,75 sesiones). Antes se comprobó que la versión publicada era exactamente la plantilla del repositorio con el plan anterior, así que no se pisó nada.
- **Corregida una incoherencia** que el registro del panel señalaba desde el 17/10. La pestaña «Tareas del hogar» y la tarea H-03 decían que los datos fiscales van «por el chat»; la regla vigente desde el 16/10 (`docs/WP23_DISENO.md` §8) es teclearlos en la app, en Herramientas avanzadas › Fiscal › «Tus datos fiscales». Se corrigió en `docs/plan/panel-seguimiento.html`, en `docs/plan/plan-definitivo.json` (WP-23, H-03 y el hito del 20/10), en `docs/ESTADO_TAREAS_Y_FASES.md` y en `BACKLOG_DEFINITIVO.md` (§7, §8 y §12). Las cifras de la hipoteca van en Deuda › Contratos.
- **Revisión mensual de Nielsen:** al día. La última fue el 15/10 y la siguiente vence el 14/11.
- **Para la próxima sesión:**
  - **PR-2 del desalojo** (Partidas + Escenarios), después de un día del PR-1 en el móvil. El PR-0 ya deja preparada la herramienta (`tests/helpers/codigo-app.cjs`, `FICHEROS_APP`). El inventario y la prueba de equivalencia se rehacen con los scripts descritos en la entrada 329.
  - **WP-12:** su fallo intermitente sigue sin causa (70/70 en local con la CPU saturada). El próximo fallo se lee en el log, que ahora está entero.
  - **Hogar:**
    - usar Registrar y Movimientos en el móvil (prueba real del PR-1 en Safari de iOS);
    - teclear los datos fiscales en la app (H-03, vencía hoy; lista con euros antes del 15/11);
    - antes del 1/11: tarjetas, asignación personal y saldos en «Real manual».
- **Validación:** `npm run verify` en verde, salida 0: `npm test` 6049/6049 (incluida `plan-seguimiento-sincronizado`), lint, typecheck, accesibilidad, rendimiento, build, privacidad y smoke. Repetido tras traer `main` con #528: 6051/6051.

## Cierre de sesión — 20 de octubre de 2026 (332): el silencio de las notificaciones se mide con el día del hogar

- **Qué pidió el hogar:** arreglar también `mutedUntil` en `canonical-e9-notifications.js`, lo único que la 326 dejó pendiente de los «hoy» en UTC.
- **El fallo.** `deliveryDecision` comparaba `mutedUntil` con el día UTC de `now`. Entre las 0 h y la 1-2 h en Madrid, un silencio «hasta ayer» seguía callando las alertas de hoy.
- **Qué cambia (solo el motor):**
  - `deliveryDecision` acepta `localDate` (`AAAA-MM-DD`, el día del hogar). Es el mismo patrón que `localTime`, que ya recibía para las horas de silencio. Así un servidor en UTC puede decidir con el día del hogar.
  - Sin `localDate`, usa el día local del proceso que decide, no el de UTC. En el navegador es el día del hogar.
  - El último día del silencio sigue callado: la comparación sigue siendo `mutedUntil >= hoy`.
  - `a5-remote-services.js` ya reenvía todo el `input`, así que no cambia. La app sigue sin llamar a `deliveryDecision`: quien conecte el envío real deberá pasar `localDate` junto a `localTime`.
- **Pruebas nuevas (2), las dos fallan con el motor anterior:**
  - `tests/canonical-e9-notifications.test.cjs`: con `localDate` explícito, un silencio hasta el 31/10 ya no calla nada el 1/11, aunque `now` en UTC siga siendo el 31/10.
  - `tests/dia-local-hoy-hogar.test.cjs`: lo mismo sin `localDate`, en el proceso hijo con `TZ=Europe/Madrid` y el reloj a las 00:30 del 1/11.
- **Validación:**
  - `npm run verify` en verde, salida 0: `npm test` 6051/6051 (+2), lint, typecheck, accesibilidad (1623 IDs únicos), rendimiento, build, privacidad y smoke.
  - `npm test` con `TZ=Europe/Madrid`: 6051/6051.

## Cierre de sesión — 20 de octubre de 2026 (331): `O-6` cerrado y marcado para recuperar

- **Qué dijo el hogar (20/10/2026):** «No hice la verificación, cierra O-6» y, a continuación, «marca el backlog para recuperar O-6 en el futuro».
- **Qué se decide.** La conexión bancaria PSD2 (CaixaBank y Banco Mediolanum, vía Enable Banking) se cierra por falta de dato, como decía la regla de `docs/ND13_SPIKE_CONEXION.md`. No se conecta ningún banco; los saldos siguen con el «Pulso de saldos» (WP-26) y el saldo final del extracto (ND-02).
- **Marcado para recuperar** (`BACKLOG_DEFINITIVO.md` §6). O-6 no es una de las 104 propuestas, así que no va en §5, que cuenta la prueba de sincronización.
  - **Disparador:** que el hogar lo pida, o que la frescura de saldos del panel de uso (días con saldos de ≤ 3 días) baje del 90 % dos semanas seguidas con ≥ 7 días de uso. Ese umbral ya lo mide `usage-panel.js`.
  - **Cuándo se mira:** en la revisión de enero de 2027 (§7) y en cada revisión mensual.
  - **Primer paso al recuperarlo:** la verificación práctica de ≈ 20 min y su tabla de decisión. No se construye nada antes.
- **Consecuencias, ya escritas antes:**
  - **WP-05 hecho.**
  - **WP-13 cierra con alcance reducido:** el PR-1 (índices tecleados con fecha) está en uso y el **PR-2 (fuente oficial) se archiva** (`docs/WP13_DISENO.md`). No cumple su «hecho cuando», así que sus 0,75 sesiones **salen del plan en vez de contarse como hechas**: en `docs/plan/plan-definitivo.json`, WP-13 pasa a 0,75 sesiones y la Ola 2, a 30,75.
  - **WP-50:** la descarga del índice de vivienda sigue siendo tecleada.
- **Avance del plan:** **61,9 %** (85,25 de 137,75 sesiones; antes 61,4 %, 85,1 de 138,5). 23 paquetes hechos. Es un cambio de contabilidad por la decisión, no trabajo nuevo.
- **Matiz anotado para el hogar** (`docs/ND13_SPIKE_CONEXION.md`). Leer el Euribor del BCE o un índice del INE es leer un dato público, no dar acceso al banco: es otro riesgo, con su propia revisión NTC-06. Se ató a O-6 porque WP-05 frenaba cualquier conexión externa. Si se quiere el Euribor automático para la revisión de la hipoteca de marzo (WP-20, preaviso a primeros de enero), se propone aparte.
- **Ficheros:** `BACKLOG_DEFINITIVO.md` (§0, §6 y §7), `docs/ND13_SPIKE_CONEXION.md`, `docs/ESTADO_TAREAS_Y_FASES.md`, `docs/WP13_DISENO.md`, `docs/plan/plan-definitivo.json`, `MANUAL_USUARIO.md`, y los comentarios de `canonical-rate-indices.js` e `index.html`. Ningún cambio de comportamiento.
- **Validación:** `npm run verify` en verde, salida 0: `npm test` 6049/6049 (incluida la prueba que sincroniza el plan con el backlog), lint, typecheck, accesibilidad, rendimiento, build, privacidad y smoke.

## Cierre de sesión — 20 de octubre de 2026 (330): la prueba del aviso de la CIRBE tenía menos tiempo del que necesita

- **Qué pidió el hogar:** publicar el arreglo del fallo intermitente de WP-40 (20/10/2026), tras la investigación de los dos fallos que se repetían en el CI (WP-12 y WP-40).
- **Causa, reproducida.**
  - Con la CPU de la máquina saturada y 6 navegadores a la vez, la prueba e2e «el aviso de la CIRBE solo existe si hay un informe tecleado…» (`qa1-flujos-completos.spec.cjs`, WP-32/WP-40) falló **3 de 10** veces por «Test timeout of 30000ms exceeded».
  - Las trazas de las tres dicen lo mismo: **todas las comprobaciones pasan** y el tiempo se acaba en el último paso, entre los 30 y los 31 s.
  - La prueba carga la app entera cuatro veces (la del principio, dos para partir de cero y una con el informe) y descarga el `.ics`. En esas condiciones tarda una mediana de **29,3 s**, justo en el límite de 30 s que Playwright pone por defecto.
  - **No es un fallo de la app:** su tiempo de carga lo vigila su propia prueba de presupuesto (5.000 ms).
- **Arreglo:** `test.setTimeout(90000)` en esa prueba, con un comentario que lo explica. Es la convención que ya usan otras cinco pruebas del repositorio. No cambia nada de lo que se comprueba. Con él: **12/12** en las mismas condiciones (máximo 30,9 s).
- **WP-12, sin resolver.** Las cinco pruebas del backtest de liquidez pasaron **70 de 70** veces, también con la CPU saturada. Tardan como mucho 20,8 s, lejos del límite, así que su fallo en el CI (dos en tres días) no se explica por tiempo. No se toca nada sin causa. Desde el #524 el log del CI se lee entero: el próximo fallo dirá qué pasa, y el `afterEach` de esas pruebas vuelca el estado de la página.
- **Validación:** `npm test` 6049/6049 y lint en verde; la prueba de la CIRBE, 12/12 con la CPU saturada.

## Cierre de sesión — 20 de octubre de 2026 (329): desalojo de `app.js`, PR-1 — Registrar y Datos salen a sus scripts

- **Qué pidió el hogar:** el plan de hoy, aprobado: tras el PR-0 (#525), la primera mitad del desalojo (XGO-01, P6: Registrar + Datos). Partidas + Escenarios, mañana, tras un día de este PR en el móvil.
- **Qué cambia: nada visible.**
  - **112 funciones** pasan tal cual, sin cambiar una coma, a los scripts clásicos que ya se cargaban con `defer` antes de `app.js`:
    - **76 de Registrar a `registrar-ui.js`:** saldos, reales del mes, «Registrar mes», datos manuales, carga por lotes y por Excel, recibos.
    - **36 de Datos a `datos-ui.js`:** Movimientos, importación de extractos, auditoría de datos, enlaces y resúmenes de Herramientas › Datos.
  - Siguen siendo funciones globales del mismo ámbito y ya existen cuando `app.js` arranca. Solo se movieron declaraciones de función: nada se ejecuta al cargar.
  - **`app.js` baja de 37.448 a 34.977 líneas (−2.471)** y el techo de ARQ-4 baja de 37.495 a **35.107** por el trinquete que eligió el hogar (P7: lo que queda + ~130). Las cuatro pruebas que repiten el techo (FIS-1, WP-14/27, WP-15 y WP-30) se ajustan con él.
- **Cómo se eligió qué mover.** Un inventario por los identificadores del DOM: funciones que solo tocan elementos de las secciones de Registrar (`registrar`, `registrar-mes`, `data-entry`, `update-hub`, `update-data`) o de Datos (`datos-importar`, `herramientas-datos`, `data-audit`, `movements`), más los ayudantes a los que solo llaman ellas.
  - Se dejaron fuera 6 que tocan esos elementos pero son de Hoy o de Cierre (`homeMarginTile`, `homePendingActualsReminder`, `homeImportSessionCandidate`, `e17SearchUsageWeight`, `renderCierreReportArchive`, `handleAlertRuleAction`).
  - **El cargador del motor OCR de tickets (`loadReceiptOcrEngine`) se queda en `app.js`**, junto a su URL y su huella SRI. Moverlo obligaba a tocar la prueba de seguridad RQ-13 (`ntc6-conexiones-externas`), y `ESTADO.md` §4 dice que no se relaja.
- **Cómo se comprobó que no cambia nada.**
  - **Equivalencia:** antes y después hay las mismas 1.931 funciones de primer nivel entre `app.js`, `registrar-ui.js`, `datos-ui.js` y `partidas-ui.js`, idénticas byte a byte. El código que no es función (1.820 líneas) es idéntico y en el mismo orden.
  - **Antes de mover:** ninguna de las 112 se declara en otro script ni se reasigna en ninguno. Si lo estuviera, el orden de carga, que antes ponía siempre `app.js` al final, cambiaría cuál gana.
  - **Caché:** el service worker guarda en caché todos los ficheros de cada versión del sitio a la vez, así que no puede servir un `app.js` nuevo con un `registrar-ui.js` viejo. Sin service worker, se sube la versión (`?v=`) de los dos ficheros de destino. La de `app.js` no se toca: la fijan 26 pruebas, y un `app.js` viejo en caché aún lleva las funciones (duplicadas, sin efecto).
- **Pruebas.**
  - **Ninguna prueba se tocó por las funciones movidas:** el PR-0 ya leía el código de la app entero.
  - **Prueba nueva:** `tests/xgo01-sin-funciones-duplicadas.test.cjs` (2). Hace que cada función de primer nivel se declare en un solo script del sitio (170 de `index.html` más las vistas de `VIEW_CHUNKS`), porque partir `app.js` abre la puerta a que una anule a otra en silencio. También fija que Registrar y Datos viven fuera de `app.js` y que el cargador del OCR sigue en él.
- **Validación:**
  - `npm run verify` en verde, salida 0: `npm test` 6049/6049 (+2), lint, typecheck, accesibilidad, rendimiento, build, privacidad y smoke.
  - E2e, a11y y rendimiento por pantalla de Playwright: **199/199** (17,9 min, 0 líneas `[WebServer]`).
  - Presupuesto de carga (mediana de «Hoy con contenido» en visita repetida, misma máquina): PR-1 2.924, 2.849 y 2.777 ms frente a `main` 2.813 y 2.846 ms. Es la misma cifra dentro del ruido, porque se cargan los mismos bytes repartidos en los mismos ficheros. Presupuesto: 5.000 ms.
  - En la primera pasada local, una prueba de WP-30 falló al abrir el navegador («Target page, context or browser has been closed»), sin llegar a comprobar nada. Repetida sola, pasó 3/3. La pasada completa de arriba es la que cuenta.
- **Siguiente paso:** PR-2 (Partidas + Escenarios) mañana, después de un día de uso real de este PR en el móvil (Safari en iOS aún no tiene pruebas en el CI, P14).

## Cierre de sesión — 20 de octubre de 2026 (328): desalojo de `app.js`, PR-0 — las pruebas leen el código de la app, no solo `app.js`

- **Qué pidió el hogar:** el plan de la sesión de hoy y, aprobado, empezar por el PR-0 (20/10/2026). Es el paso previo al desalojo de `app.js` en dos PR (XGO-01, P6 del cuestionario): Registrar y Datos primero, Partidas y Escenarios después.
- **Por qué hacía falta.** 389 ficheros de prueba leían `app.js` a pelo y 220 de ellos sacan funciones por su nombre con su propio `extractFunction` (1.270 llamadas). Una función que se muda a un script clásico cargado antes que `app.js` sigue siendo la misma función global para la app, pero las pruebas dejaban de encontrarla. **Ensayo:** mover 8 funciones de Registrar (87 líneas) a `registrar-ui.js` rompía **22 pruebas sin tocar la app**. El desalojo mueve más de 100 funciones, así que la mayor parte del trabajo habría sido reparar pruebas a mano.
- **Qué cambia (solo pruebas; la app no cambia):**
  - **`tests/helpers/codigo-app.cjs`**, nuevo: `codigoApp(...extra)` devuelve `app.js` seguido de los ficheros que reciben lo desalojado (`registrar-ui.js`, `datos-ui.js` y `partidas-ui.js`; el PR que desaloje a otro fichero lo añade a `FICHEROS_APP`) y de los que pida cada prueba (p. ej. `views/escenarios.js`). `app.js` va primero, así que las pruebas que comparan posiciones dentro de él siguen igual.
  - **389 pruebas** pasan a `codigoApp()`, con un cambio automático. Las 43 que ya concatenaban vistas a mano quedan como `codigoApp("views/x.js")`, sin duplicar `partidas-ui.js`. Se quitan 157 declaraciones que quedaban sin uso (`fs`, `path`, `root`, `read`).
  - **Las que tratan `app.js` como fichero lo siguen leyendo directamente:** el techo de líneas (ARQ-4, y cuatro pruebas más que lo repiten: FIS-1, WP-14/27, WP-15 y WP-30), la versión minificada (OPT-3) y la que comprueba que el código de WP-24 vive en `partidas-ui.js` y no en `app.js`.
  - **Prueba nueva:** `tests/xgo01-codigo-app-pruebas.test.cjs` (3). Impide volver a leer `app.js` con `fs.readFileSync` fuera de esas excepciones, comprueba que los ficheros de `FICHEROS_APP` son scripts clásicos cargados con `defer` antes de `app.js` y fija qué devuelve `codigoApp()`.
- **Comprobado:** con el ayudante, el mismo ensayo de 8 funciones deja **6.044/6.044 en verde sin tocar ninguna prueba** (el ensayo se deshizo; `app.js` no cambia en este PR).
- **Siguiente paso:** PR-1 (Registrar y Datos a `registrar-ui.js` y `datos-ui.js`, solo declaraciones de función, con prueba de equivalencia y bajada del techo por trinquete, P7). Partidas y Escenarios al día siguiente, después de un día del PR-1 en el móvil.
- **Validación:** `npm run verify` en verde, salida 0: `npm test` 6047/6047 (+3), lint, typecheck, accesibilidad, rendimiento, build, privacidad y smoke. `app.js` sin cambios (37.448 de 37.495).

## Cierre de sesión — 20 de octubre de 2026 (327): el servidor de las pruebas en navegador solo registra lo que falla

- **Qué pidió el hogar:** silenciar el log del servidor web de Playwright (20/10/2026).
- **Por qué hacía falta.** La ejecución de `main` tras el PR 522 falló en dos e2e que no tocaba: el backtest de liquidez (WP-12 «con saldos manuales…», su segundo fallo en tres días) y la conciliación con la CIRBE (WP-40). En local pasan 8 de 8. No se pudo saber por qué fallaban en el CI:
  - `python3 -m http.server` dejaba una línea `[WebServer] GET … 200` por fichero servido, unas 120.000 por ejecución.
  - La herramienta que lee el log solo entrega el final, y el error y el volcado de estado del `afterEach` de WP-12 quedaban fuera.
  - Las trazas del #520 no se pueden descargar desde este entorno (el proxy lo bloquea).

  Se relanzó una vez el trabajo fallido de `main`.
- **Qué cambia.**
  - **`tools/serve-dist.py`** sirve `dist/` igual que antes. Solo registra las peticiones con respuesta 4xx/5xx y no anota las conexiones que el navegador corta al cambiar de página (`BrokenPipeError`/`ConnectionResetError`). Los errores de arranque y los demás errores del servidor se siguen viendo.
  - **`playwright.config.cjs`** lo arranca en lugar de `python3 -m http.server`.
  - **Prueba nueva:** `tests/ci-servidor-pruebas-silencioso.test.cjs` arranca el servidor y comprueba que una petición correcta no deja línea y una 404 sí.
- **Siguiente paso:** el próximo fallo de WP-12 o WP-40 se podrá leer entero en el log. Ahí se busca la causa, en lugar de relanzar.
- **Validación:**
  - `npm run verify` en verde, salida 0: `npm test` 6037/6037, lint, typecheck, accesibilidad, rendimiento, build, privacidad y smoke. Repetido tras traer `main` con la 326 (#523): 6044/6044.
  - E2e y a11y completas con el servidor nuevo: 196/196, con 0 líneas `[WebServer]` y 43 KB de log en total. Antes, solo esas líneas sumaban varios MB.

## Cierre de sesión — 20 de octubre de 2026 (326): el resto de «hoy» en UTC pasa al día local del hogar

- **Qué pidió el hogar:** revisar los ~20 usos de `new Date().toISOString().slice(0, 10)` (y variantes) que dejó anotados la 325, pasar al día local los que son «el día del hogar» y dejar en UTC solo lo técnico.
- **Pasan al día local (23 usos):**
  - **`app.js` (19, con `isoLocalDate`):** fecha por defecto de la captura rápida E17 (`e17ParseQuickCaptureQuery`, `e17QuickCaptureHtml`, `handleE17QuickCapture`); contador de visitas por pantalla (`recordViewVisit`); fecha de saldo por defecto (`defaultBalanceDate`); nombres de los ficheros exportados (copia, inventario, conciliación, borrador de la renta, paquete de decisión, informe certificado, CSV de movimientos); «Generado:» del resumen del mes; estado del plan DCA; frescura de la bandeja previa (`asOf`); fecha por defecto del ticket por OCR (dos usos); plazos de las alertas UX (`uxDateAfterDays`); foto diaria de la salud financiera.
  - **`views/analisis.js`:** «repetir suscripción» apunta el movimiento con el día local.
  - **`canonical-e11b-inbox.js`:** `freshness()` ya recibía `asOf` (la app lo pasa); sin él, ahora cae al día local en vez de al de UTC. El motor sigue sin depender de `app.js`.
  - **`p2-ui.js` (2, con un `localDay` propio del módulo):** la fecha por defecto del formulario y «recuperable hasta» de un documento borrado, que además se calcula con 30 días de calendario y no con 30 × 24 h (con el cambio de hora de octubre salía un día antes).
- **Se quedan como estaban, a propósito:**
  - `app.js` · `e17ExtractNaturalDate` (2): ya parte de los componentes locales y hace la aritmética en UTC, que es lo correcto.
  - `app.js` · `isoFromWorkbookValue` (2): leen valores de una hoja de cálculo, no «hoy». La rama `Date` no se usa porque `XLSX.read` va sin `cellDates`.
  - `p2-ui.js` · `deletedAt` y `canonical-e9-bank-import.js` · `idempotencyKey`: marcas de tiempo técnicas.
  - `canonical-card-purchases.js` · `conceptSuggestions`: compara horas UTC con horas UTC (`capturedAt`), es coherente. El margen de un día en una ventana de 120 no cambia nada.
  - **Pendiente, no corregido:** `canonical-e9-notifications.js` compara `mutedUntil` con el día UTC de `now`. Lo correcto es que reciba la fecha local como ya recibe la hora (`localTime`), pero hoy no tiene llamador en la app (solo `a5-remote-services.js`, que corre en servidor), así que no se añade un parámetro que nadie pasaría. → Corregido en la 332.
  - Los demás `toISOString().slice(0, 10)` de los motores convierten fechas creadas a mediodía UTC (`Date.UTC(...)`), no «hoy»: son correctos.
- **Pruebas.**
  - **Regresión nueva:** `tests/dia-local-hoy-hogar.test.cjs` (7). Corre en un proceso hijo con `TZ=Europe/Madrid` y el reloj parado a las 00:30 del 1/11/2026, que en UTC aún es el 31/10. Cubre la captura rápida, el contador de visitas, «repetir suscripción», la fecha de saldo, los plazos y la frescura de E11b, más una guarda que impide volver a escribir `new Date().toISOString().slice(0, 10)` en los ficheros de la app. Con el código anterior fallan 6 de 7. Ejemplo del fallo: a las 00:30, «gasto 20 mercadona» y «ayer gasto 20 mercadona» se apuntaban el mismo día.
  - **Pruebas ajustadas (8 ficheros):** dos regex que fijaban el texto UTC (A16-2 y GOB8). Seis sandboxes cargan ahora el `isoLocalDate` real de `app.js` (DEX3, GOB18, M-10, T-4, UX6/E17 y V6-4). T-4 y UX6 esperan el día local.
  - **`app.js`:** 37.448 líneas, sin cambio neto (techo 37.495).
- **Validación:**
  - `npm run verify` en verde, salida 0: `npm test` 6042/6042 (+7), lint, typecheck, accesibilidad (1623 IDs únicos), rendimiento, build, privacidad y smoke.
  - `npm test` con `TZ=Europe/Madrid`: 6042/6042.
  - E2e de captura rápida y WP-53: 8/8.

## Cierre de sesión — 20 de octubre de 2026 (325): «meses desde la última revisión» cuenta con el día local, no con el de UTC

- **Qué pidió el hogar:** arreglar el desfase en UTC de `monthsSinceDate`, el riesgo que anotó la entrada 316.
- **El fallo.** `monthsSinceDate` (`canonical-portfolio.js`) tomaba el «hoy» en UTC. Ese contador lo usan cuatro avisos:
  - la revisión de rebalanceo (INV-17);
  - la convicción por posición (I-12);
  - el ritual anual (GOB-13);
  - la revisión del tipo de la deuda (GOB-16).

  Entre las 0 h y la 1-2 h en Madrid, el contador iba un día por detrás. Además, las tres marcas «hecho hoy» guardaban también la fecha UTC, así que a esas horas se registraba la víspera.
- **Qué cambia.**
  - **El motor:** el «hoy» es el día del calendario local. Una referencia `AAAA-MM-DD` se toma tal cual, sin pasar por ninguna zona horaria.
  - **Las marcas:** `markIv1PositionConvictionReviewed`, `markInv17RebalanceReviewed` (en `app.js`) y `markGob13AnnualReviewDone` (en `views/cierre.js`) guardan `isoLocalDate(new Date())`.
  - **Formato:** sigue siendo `AAAA-MM-DD`, así que no hace falta migrar nada. Las fechas ya guardadas siguen valiendo; como mucho alguna tiene un día menos, si se marcó de madrugada.
  - **`app.js`:** sin cambio neto de líneas.
- **Pruebas.**
  - **Regresión:** se ejecuta en un proceso con `TZ=Europe/Madrid`, porque el CI corre en UTC y allí el fallo no se ve. A las 00:30 del 1/11 ya ha pasado un mes desde el 1/10. Falla con el motor anterior y pasa con el nuevo.
  - **Referencias `AAAA-MM-DD`:** se toman tal cual, y una referencia inválida devuelve `null`.
  - **Pruebas existentes:** las de INV-17 pasaban la referencia como medianoche UTC; ahora usan fechas sin zona. Las de guardado (INV-17, I-12, GOB-13) esperan el día local. La de GOB-13 «un año exacto» vuelve al día local.
- **Fuera de este cambio:** quedan 20 usos más de «hoy» en UTC (`new Date().toISOString().slice(0, 10)`) en `app.js`, `canonical-e11b-inbox.js`, `p2-ui.js` y `views/analisis.js`. Entre otros, la fecha por defecto de la captura rápida, el contador de visitas por pantalla y los nombres de los ficheros exportados. Quedan anotados como trabajo aparte.
- **Validación:**
  - `npm run verify` en verde, salida 0: `npm test` 6035/6035, lint, typecheck, accesibilidad, rendimiento, build, privacidad y smoke.
  - Suite unitaria con `TZ=Europe/Madrid`, en verde.
  - Suite unitaria en Madrid con el reloj simulado a las 00:30 del 1/11/2026, el 1/01/2027 y el 1/03/2027: 0 fallos.
  - Pruebas afectadas en UTC, Madrid, Nueva York y UTC+14: 62/62.
  - E2e y a11y de Cierre e Inversión: 42/42.

## Cierre de sesión — 19 de octubre de 2026 (324): cobro manual caducado y gasto diario de 0 €, sin silencio

- **Origen:** la captura de Hoy con datos reales decía «0 días hasta 31 ago · necesidad 0 € · Dato observado». En el motor (`coverageUntilNextIncome`) una fecha pasada solo puede salir de un ajuste manual guardado. Causa probable, en `app.js`: el editor de cobertura (Ajustes › Configuración) se abre con lo aprendido y dejaba «Guardar ajuste» activo, así que un toque congelaba la fecha aprendida como manual; y un gasto diario vacío se guardaba como `null`, que `e6CoverageSettings` convertía en `Number(null) = 0`.
- **Qué cambia (respuestas P3 y P4 del hogar), sin tocar ningún `canonical-*`:** `views/cobertura-ajuste.js` (nuevo) lee el ajuste manual con estas reglas. Una fecha de cobro manual anterior a la fecha de saldos deja de aplicarse y la tarjeta de Hoy (clásica y v2) avisa «Tu fecha de cobro manual caducó el dd/mm: ponla al día», con un botón al editor, que dice «Caducado». Un gasto diario manual de 0 € se trata como dato sin rellenar y se avisa; vacío ya no es 0 €. «Guardar ajuste» empieza apagado y solo guarda como manual lo que el hogar cambia o lo que ya era manual.
- **`app.js`:** 37.447 líneas (−7). Cableado en `index.html` (defer, antes de `views/hoy-v2.js`), `service-worker.js` y `tools/build-public-site.mjs`.
- **Pruebas nuevas:** `tests/datos-cobro-caducado.test.cjs` (5, con fechas inventadas) y una e2e en `qa1` («Cobro caducado · fecha manual pasada»), pasada a mano con el tema clásico y con el v2. `tests/f1-hoy-dato-ausente.test.cjs` gana los dos stubs que la tarjeta necesita ahora.
- **Validación:** `npm run verify` en verde, salida 0: `npm test` 6028/6028 (+5 sobre main). Lint y typecheck en verde. Tras unir main con #519 y #520 y añadir los documentos de cierre: `npm run verify` en verde, `npm test` 6033/6033; e2e de Hoy con el v2 por defecto (cobro caducado, apuntar gasto, bandeja, Registrar gasto) 21/21.
- **Pendiente (nota de P1):** estimar el siguiente cobro con el histórico del mismo mes del año anterior cambia el motor de cobertura; se propone aparte (RD-COB2).
- **Cierre de la sesión (mismo PR):** `BACKLOG_DEFINITIVO.md` gana el §5.0 «Rediseño y plataforma», la regla de 3 paquetes en curso y una nota sobre Hoy y la congelación (P13). `docs/rediseno/ESTADO.md` §2 y §8 marcan #519, #520 y #521. Revisión mensual de Nielsen al día (última, 15/10). El despliegue de `main` tras #519 falló por dos e2e intermitentes (WP-12 backtest y WP-40 CIRBE); en local pasan las 7 pruebas de esos bloques sobre el mismo commit y en el CI del PR también pasaron: se relanzó una vez.

## Cierre de sesión — 19 de octubre de 2026 (323): el CI guarda las trazas de Playwright cuando algo falla

- **Qué cambia:** `.github/workflows/pages.yml` gana un paso con `if: failure()` que sube `test-results/` (trazas y capturas que Playwright ya conserva con `retain-on-failure`) como artefacto durante 14 días. Va detrás de todas las pruebas en navegador y antes de la medición informativa de WebKit, que no bloquea. No cambia ningún umbral. Es la P5 del cuestionario del rediseño y el primer paso del §8 de `docs/rediseno/ESTADO.md`, antes del desalojo de `app.js`.
- **Prueba nueva:** `tests/ci-informe-playwright.test.cjs` (3): el paso existe, solo corre en fallo, sube `test-results/` y está en su sitio.
- **Validación:** `npm run verify` en verde, salida 0: `npm test` 6026/6026 (+3 sobre main). Tras unir main con el v2 por defecto (322): `npm test` 6028/6028.

## Cierre de sesión — 19 de octubre de 2026 (322): rediseño · el tema v2 pasa a ser el de por defecto

- **Decisión del hogar (19/10):** se trabaja en `https://javierbarriusom-a11y.github.io/contabilidadcasa/` con el diseño más actual y las mismas funciones en las dos versiones. El script de `<head>` aplica el v2 salvo con `?tema=clasico` o si ya se eligió el clásico (lo recuerda `tema-v2.js`; `?tema=v2` lo olvida). El clásico queda como salida hasta que se gradúe (P9: aviso a las dos semanas y confirmación manual).
- **Igualdad de funciones, comprobada recorriendo la app con el v2:** la primera pasada de e2e + a11y dio 182/195. Los 13 fallos eran funciones que la Hoy v2 dejaba tras «Ver todo el detalle»: «+ Registrar gasto» (hoja de compras con tarjeta, WP-30/WP-53) y la bandeja de decisiones (cobros esperados y cargos que no llegaron, WP-14/27). Arreglo: la bandeja sigue saliendo sola cuando hay preguntas (la regla `:has` ya no oculta `#homeDecisionInboxCard`), «+ Apuntar gasto» de la v2 hereda si se puede usar, y las e2e abren el gasto desde el botón visible de cada tema (`abrirApuntarGasto`). Tras el arreglo, esos 13 pasan.
- **Otros dos hallazgos de la pasada completa:** a 360 px el buscador de las FAQ se salía del borde con la tipografía v2 (`test:mobile-overflow`); arreglado en `tema-v2.css` solo para pantallas estrechas. Y una carrera previa en la e2e de la carta del mes (`renderCierre is not defined`, views/cierre.js aún sin cargar): el ayudante `openCierre` ahora la espera.
- **Cobro caducado (§6 de ESTADO.md):** la respuesta P1 («Aprendido») descarta que haya hoy una fecha manual guardada; la causa probable es que el editor de cobertura deja «Guardar ajuste» activo con los valores aprendidos y guarda el gasto diario vacío como 0 €. Se arregla en el siguiente paso, sin tocar motores.
- **Validación:** `npm run verify` en verde, salida 0: `npm test` 6025/6025 (+2). e2e + a11y con el v2 por defecto: segunda pasada completa 194/195 (el fallo, la carrera de la carta, se arregló y sus 5 pruebas pasan). `test:perf-screens` 3/3; `test:mobile-overflow` 201 visitas sin nada cortado tras el arreglo; `test:load-budget` mediana 2.840 ms de 5.000. No se repitió la pasada completa de e2e después de los dos últimos arreglos (CSS solo para móvil y una espera en una prueba): la hace el CI del PR.

## Cierre de sesión — 19 de octubre de 2026 (321): rediseño · estado y prompts v2 (solo documentación)

- **Qué cambia:** `docs/rediseno/ESTADO.md` (nuevo) pasa a ser el documento principal del rediseño y manda sobre `HANDOFF.md` y los prompts donde discrepen: fases publicadas (A1, A2, A1b, A3, PR #514 a #517), decisiones vigentes, desviaciones del handoff, trampas técnicas, lo aprendido con los datos reales del 19/10 (cobro caducado «0 días hasta 31 ago», 0 movimientos en octubre) y orden de los siguientes pasos. `docs/rediseno/PROMPTS_CLAUDE_CODE.md` pasa a la versión 2 (prompts 0 a 5, empezando donde se quedó A3). `CLAUDE.md` gana la sección «Rediseño en curso» para que toda sesión lea `ESTADO.md` antes de tocar pantallas.
- **Sin código:** ningún fichero de la app, prueba ni motor cambia.
- **Validación:** `npm run verify` en verde, salida 0: `npm test` 6023/6023 (sin cambios: no se añade ni toca ninguna prueba), lint, typecheck, accesibilidad estructural (1623 IDs únicos), rendimiento, build del sitio, privacidad y humo.

## Cierre de sesión — 19 de octubre de 2026 (320): rediseño · fase A3, Hoy v2 detrás del tema v2

- **Qué cambia (solo con `?tema=v2`):** Hoy pasa de ~20 bloques a cinco, según `docs/rediseno/referencias/png/Hoy.png` y `HoyDesktop.png`: cifra protagonista «Disponible hasta cobrar» con la frase del suelo y el día de cobro, gráfico del saldo previsto hasta pasado el cobro con la línea del suelo, «Fin de mes» y «Reserva protegida» (con cuánto está CaixaBank por encima o por debajo); «Decidir esta semana» con como mucho 3 decisiones (la lectura urgente primero, luego las abiertas, cada una con su nivel y su botón); el mes en una barra (asignado, día del mes, ahorro, o «Importa el extracto» si no hay gasto real); deuda viva en una línea; y una sola línea plegada con lo que espera datos en vez de tarjetas «Sin datos».
- **Qué desaparece de la vista (no del código):** puntuación de salud, selector de horizonte, Guía, Modo reunión, Acciones rápidas, tarjetas «Sin datos», tabla de meses y alertas. Siguen en el DOM: «Ver todo el detalle» enseña la Hoy de siempre entera, así que no se retira ninguna pantalla en uso. La Hoy de siempre solo se oculta cuando la v2 ya está pintada (`:has`), así que si `views/hoy-v2.js` fallara se seguiría viendo la de siempre.
- **Sin motor nuevo ni cambios en `canonical-*`:** `renderHomeDashboard()` le pasa a `hoyV2Render()` los valores que ya calcula (una línea en `app.js`, 37.454 de 37.495). El gráfico usa el calendario del motor diario anclado al saldo real de hoy, para empezar exactamente en la cifra de arriba.
- **Carga:** `views/hoy-v2.js` (18 KB) va con `defer` antes de `app.js`; sin la bandera solo define funciones. Se descartó inyectarlo solo en v2 porque añadía un cargador dinámico de scripts nuevo, que `ntc6-conexiones-externas` (RQ-13) no admite. Presupuesto de carga: mediana 4.091 ms de 5.000.
- **Prueba nueva:** `tests/redis-a3-hoy-v2.test.cjs` (8). Con datos reales el motor de cobertura puede devolver un cobro ya pasado («0 días hasta 31 ago»): la v2 solo dice «Cobráis en…» con un cobro futuro; si no, titula «Disponible para gastar».
- **Validación:** `npm run verify` en verde, salida 0: `npm test` 6023/6023 (+8). Capturas a 390×844 y 1440×900, claro y oscuro, revisadas a mano; clics comprobados («Apuntar gasto» abre el formulario rápido, cada decisión navega, «Ver todo el detalle» alterna) y con `?tema=clasico` todo sigue igual.
- **Pendiente visto:** el texto «Cobertura actual 0.9 meses» viene de `app.js` con punto decimal; se corregirá con la unificación de formatos por motor.

## Cierre de sesión — 18 de octubre de 2026 (319): rediseño · A1b, conclusiones frente a acciones

- **Qué pidió el hogar (18/10/2026, viendo el tema v2 publicado):** «cambiaría los colores de los CTA frente a los datos importantes / conclusiones». En v2 el botón primario y las tarjetas de datos clave («Qué se recalcula al guardar» en Registrar, «Hasta el siguiente ingreso» en Hoy) compartían el mismo verde oscuro.
- **Regla nueva del tema v2:** el verde sólido es solo para acciones. Las tarjetas de conclusión (`.e19-registrar-recalc`, `.e6-coverage-card`, `.e19-card-strong`, `.e19-impact-bar`, resumen de Planificación de partidas) pasan a una tarjeta clara teñida de marca (`--e19-accent-soft`) con la cifra en tinta y los rótulos en gris. Solo CSS en `tema-v2.css`, detrás de la bandera; sin la bandera no cambia nada.
- **También pidió:** terminar el plan (A3 y siguientes) y ajustar después. La impresión de «demasiado parecido al anterior» es esperable: A1 cambia color y tipografía, no la estructura; el cambio grande es A3 (Hoy).
- **Prueba nueva:** `tests/redis-a1b-conclusiones.test.cjs` (2): las conclusiones ya no usan el fondo de los botones; tinta y gris ≥ 4,5:1 sobre la tarjeta en claro y en oscuro.
- **Validación:** `npm run verify` en verde, salida 0: `npm test` 6015/6015 (+2). Capturas de Hoy y Registrar en v2 revisadas a mano. Va encima de la rama de A2 (PR #515) para no chocar en este fichero.

## Cierre de sesión — 18 de octubre de 2026 (318): rediseño · fase A2, un solo formato de cifras

- **Qué pidió el hogar:** seguir el rediseño por fases (A1 ya publicado, PR #514). A2: que una misma pantalla no enseñe a la vez «8310,00 €» y «12.000,00 €».
- **Causa:** `es-ES` no agrupa los miles con 4 cifras (CLDR, `minimumGroupingDigits: 2`) y `money(x, true)` pintaba siempre `,00`.
- **Cambio (2 líneas de `app.js`, sin crecer: 37.453; techo 37.495):** los dos formateadores de `money()` llevan `useGrouping: "always"` y el preciso, además, `trailingZeroDisplay: "stripIfInteger"`. Resultado: «8.310 €», «1.218 €», «3.617,16 €», «412,30 €». `p2-ui.js` usa el mismo formato. No se toca ningún motor `canonical-*`.
- **Fuera de A2, a propósito:** los motores que formatean por su cuenta (`canonical-balance-pulse` en la oferta del extracto, `canonical-statement-anomalies`, `canonical-card-*`, `canonical-payroll`…) siguen con su formato; en algún panel aún convive «970,00 €» con «970 €». Se unifican en una entrega aparte, motor a motor, con sus pruebas.
- **Pruebas:** nueva `tests/redis-a2-cifras.test.cjs` (3). En `qa1-flujos-completos.spec.cjs` se actualizan 52 expectativas al formato nuevo, una a una contra lo que pinta la app (sin relajar ninguna: donde «50,00» habría quedado en «50» se exige «50 €»); las que vienen de motores sin cambiar conservan su formato.
- **Validación:** `npm run verify` en verde, salida 0: `npm test` 6013/6013 (+3). e2e (`qa1`) 110/110 en local (dos pruebas, WP-37 y WP-54, fallaron una vez en la tanda completa y pasaron solas: intermitentes conocidas, no relacionadas). `test:mobile-overflow` falla igual con y sin el cambio en este entorno (buscador de FAQs a 360 px); en el CI pasa.

## Cierre de sesión — 18 de octubre de 2026 (317): rediseño · fase A1, tema visual v2 detrás de bandera

- **Qué pidió el hogar:** aplicar la propuesta de rediseño de `docs/rediseno/` por fases (A → B → C), empezando por lo de menos riesgo y sin tocar el menú. Decisión del 17-18/10/2026 en la conversación: **fases A→B→C**; la navegación de 5 destinos (fase C) queda pendiente y solo se abrirá si tras A y B sigue haciendo falta, porque contradice la recomendación de `docs/OLA1_ARQUITECTURA_NAVEGACION.md` (camino B, cero pantallas nuevas).
- **Qué entra (A1):** `tema-v2.css` redefine los valores de las dos familias de tokens que ya existen (`styles.css`: `--bg`, `--ink`, `--teal`…; `design-tokens.css`: `--e19-*`) en claro, oscuro del sistema y oscuro forzado. No crea un tercer sistema ni toca reglas de componente. Verde de marca `#0E3B32`, azul solo para lo previsto, tipografía del sistema (San Francisco en iPhone y Mac, sin peticiones a terceros) y cifras tabulares.
- **Detrás de bandera:** sin `<html data-tema="v2">` no cambia nada. `?tema=v2` lo activa y lo recuerda en ese navegador; `?tema=clasico` lo apaga. El script en línea de `<head>` solo lee (criterio de T7); quien guarda es `tema-v2.js`, con `defer` (OPT-1). `app.js` no cambia (37.453; techo 37.495).
- **Prueba nueva:** `tests/redis-a1-tema-v2.test.cjs` (8): todo cuelga de la bandera, cableado en `index.html`, service worker y sitio público, solo tokens existentes, y contraste WCAG calculado (claro: texto y los seis semánticos ≥ 4,5:1 en los dos sentidos; oscuro: texto y semánticos como texto ≥ 4,5:1, y el mismo compromiso de T7 con texto blanco).
- **Incidencia anotada:** el 17/10 la carpeta `docs/rediseno/` (solo documentos) entró en `main` con un push directo, contra la regla de `CLAUDE.md`. Sin efecto en la app; desde aquí, rama + PR.
- **Validación:** `npm run verify` en verde, salida 0: `npm test` 6010/6010 (+8), lint, typecheck, accesibilidad, rendimiento, build, privacidad y smoke. Capturas de Hoy, Deuda y Plan en clásico y v2 (escritorio y móvil) revisadas a mano.
- **Siguiente (A2):** unificar el formato de cifras en `money()` (hoy conviven «8310,00 €» y «12.000,00 €»: 32 `toFixed(2)` en `app.js`); después, A3: Hoy según `docs/rediseno/referencias/png/Hoy.png`.

## Cierre de sesión — 17 de octubre de 2026 (316): pruebas que dependían de la fecha y «Registrar gasto» del 1 al 3 al mes de su fecha

- **Qué pidió el hogar:** revisar las pruebas que dependen de la fecha, tras la bomba del e2e de WP-36 (entrada 314).
- **Método:** cada suite con el reloj desplazado, sin congelarlo, en Node, en las páginas de Playwright y en los contextos `vm` donde las pruebas cargan `app.js`. Los `Date` que una prueba ya simula se respetan. El arnés vive fuera del repositorio. Control con la fecha real: 0 fallos de 5999.
  - **Unitarias:** 20 combinaciones de fecha y zona: fin y principio de mes, 20-21/12, Nochevieja a las 23:30 y Año Nuevo a las 00:30, febrero, 29/02/2028, campaña de la Renta, +1 y +2 años, y medianoche y cambios de hora en Madrid.
  - **De navegador (e2e y a11y):** 25/10/2026, 1/01/2027 a las 00:30, 10/02/2027 y 31/03/2027.
- **Seis pruebas frágiles, arregladas solo en la prueba (los motores calculaban bien):**
  - **Accesibilidad de la tarjeta de anomalías (`opt4`, WP-36).** Gemela de la de `qa1`: suscripción el día 5 fijo; fallaría desde el ~21 de cada mes. El cobro cae ahora el mismo día del mes que hoy.
  - **Sincronización de almacenes (`qa1`, ARQ-6).** Fallo intermitente del CI de hoy, 2 envíos en vez de 1. La app escribe `liquidity-backtest` al arrancar y su envío sale 900 ms después. La prueba espera ahora a más de 1,2 s sin escrituras. Antes fallaban 2 de 8 repeticiones; con el cambio, 16 de 16 bajo carga.
  - **Semestre en curso (PER-4).** Esperaba «2026» fijo: fallaría siempre desde el 1/01/2027.
  - **Revisión del tipo de la hipoteca (GOB-16).** «2026-08» fijo con intervalo de 12 meses: vencida desde agosto de 2027.
  - **Ritual anual (GOB-13).** `setFullYear` desde el 29/02/2028 daba el 1/03/2027. Se recorta al último día del mes, en UTC como `monthsSinceDate`.
  - **Atajos de rango (M-3).** El stub de `isoLocalDate` usaba UTC: `npm test` fallaba en cualquier equipo con hora de Madrid. El CI corre en UTC y no lo veía.
- **Un fallo real de la app, con decisión del hogar (17/10/2026, en esta conversación).**
  - **El fallo.** Del 1 al 3, «Registrar gasto» imputaba el gasto al mes que se cierra, aún abierto por WP-09, y el emparejamiento de WP-53 solo une una partida con una fila de SU mes. Un gasto anotado el día 2 no se emparejaba con su fila del extracto, que cae en el mes en curso, y **contaba dos veces**. Lo destaparon WP-53 y WP-54 en la fecha simulada del 1/01/2027 y del 2/02/2027; el 5/02 pasaban.
  - **La regla decidida.** El gasto va al **mes de su fecha** si está abierto, y si no, al de siempre. Solo del 1 al 3, un enlace «¿Era de oct 26? Anotarlo en ese mes» lo lleva al mes que se cierra, y «Volver a…» lo devuelve. Desde un enlace de registro (WP-25) no cambia nada: ya mandaba su fecha. La hoja de tarjetas (WP-30) no imputa a meses del plan y no estaba afectada.
  - **El código.** `homeQuickExpenseTargetMonth()` y `openHomeQuickExpenseDialog()` en `app.js`, que sube 12 líneas (37.441 → 37.453; techo 37.495), y un botón `link-button` en el diálogo de `index.html`, sin clases nuevas.
- **Fallo intermitente sin arreglar:** el e2e del backtest de liquidez (WP-12, «con saldos manuales…») falló una vez en el CI del PR 513 y pasó al relanzarlo. En local pasó 10 de 10 bajo carga y en las cuatro fechas simuladas. No se pudo leer su error: el log que entrega la herramienta se corta antes. Si vuelve a salir, se trata como real.
- **Riesgo menor anotado, no corregido:** `monthsSinceDate` (`canonical-portfolio.js`) cuenta en UTC. Entre medianoche y la 1-2 h en Madrid, «meses desde la última revisión» va un día por detrás.
- **Validación:**
  - `npm run verify` en verde, salida 0: `npm test` 6002/6002 (+3), lint, typecheck, accesibilidad, rendimiento, build, privacidad y smoke.
  - Suite unitaria con `TZ=Europe/Madrid`, en verde.
  - Barrido e2e+a11y: 193/193 el 25/10/2026, el 10/02/2027 y el 31/03/2027; el 1/01/2027, 191/193 antes del cambio (WP-53 y WP-54).
  - Tras el cambio, 6/6 (los dos e2e nuevos, WP-53 y WP-54) con la fecha real, el 2/02/2027 y el 1/11/2026.

## Cierre de sesión — 17 de octubre de 2026 (314): séptima auditoría de producto (propuesta, sin código)

- **Qué se hizo:** a petición del hogar, lectura crítica del artefacto «Backlog cierre octubre» y de la sesión que lo generó, y propuesta de mejoras: `docs/PROPUESTA_SEPTIMA_AUDITORIA_2026-10-17.md` (también como artefacto privado «Séptima auditoría de producto»). Siete hallazgos, once cambios al backlog de octubre, diez principios de diseño, rediseño de Inversión, Deuda actual y Deuda nueva, **57 funciones nuevas** (16 «Ahora», 26 «Siguiente», 10 «Después», 5 condicionadas; ≈ 99 sesiones estimadas) y doce mejoras sobre propuestas ya catalogadas.
- **Cifras medidas para el diagnóstico (no del hogar):** 60 vistas en `index.html`, 110 motores `canonical-*.js`, 52 scripts de pantalla, 540 ficheros de prueba; 46 commits entre el 7 y el 17/10 con el avance ponderado sin moverse de 61,4 %; 26 paquetes «en curso» a la vez; 0 de 10 métricas leídas con datos reales; margen de `app.js`, 54 líneas.
- **Cruce con el código:** cada función nueva se comprobó contra los motores existentes antes de darla por nueva. Ejemplos: la banda de caja no modela importes (`amountSd`, XPR-01); el camino a deuda cero no incluye comisiones de amortización ni redirige cuotas liberadas (XDO-01, XDO-03); no hay lector de extractos en PDF (XDA-03), ni previsión por cuenta (XPR-05), ni regla de los dos meses (XIN-02), ni FEIN (XDN-01). Se descartaron como nuevas ideas que ya existían (recolección de pérdidas, coste total de fondos, comparación con índice, senda, Monte Carlo, pensión pública declarada).
- **Incoherencia nueva detectada:** además de la de los datos fiscales que ya recogía el artefacto, la fila de WP-40 en `docs/ESTADO_TAREAS_Y_FASES.md` dice que el informe de la CIRBE se teclea «por el chat». No se corrige en esta entrega (es parte de la decisión sobre el documento de estado); queda anotada en la propuesta.
- **Lo que NO hace:** no cambia el plan (`docs/plan/plan-definitivo.json`), ni `BACKLOG_DEFINITIVO.md`, ni código de la app (solo una prueba, ver abajo). **No toca la rama `claude/gracious-brahmagupta-mjdhhj` (WP-41 PR-4, sin publicar):** su entrada de estado pasa a ser la 315.
- **Validación:** `npm run verify` en verde, salida 0: `npm test` 5999/5999 (sin cambios), lint, typecheck, accesibilidad, rendimiento, build, privacidad y smoke. No se ejecutaron las pruebas de navegador (e2e, axe, rendimiento por pantalla) en local: el cambio es solo documentación y no toca ninguna pantalla; las repite el CI.
- **Bomba de fecha en el e2e de WP-36, corregida aquí:** el CI del PR falló en `WP-36 · anomalías del extracto` (4 avisos en vez de 5) sin relación con el diff. Causa: la siembra ponía el alquiler ficticio el día 1 de cada mes y el detector mira 45 días hacia atrás desde hoy; a partir del día ~16 el cobro del mes pasado se sale de la ventana y el aviso «Sin partida» del alquiler desaparece. Fallaba igual en `main` cualquier segunda quincena. Arreglo solo en la prueba (`tests/qa1-flujos-completos.spec.cjs`, `seedAnomalies`): los cobros mensuales caen el mismo día del mes que hoy (máximo el 28), siempre a 28-34 días. El motor no cambia: su comportamiento era el correcto. Reproducido en local antes (falla) y después (pasa), y `npm run verify` de nuevo en verde, salida 0.

## Cierre de sesión — 16 de octubre de 2026 (313): WP-23 · tercera entrega («Hecho» por tarea y aviso del 20/12 que sabe lo que falta)

- **Qué se hizo:** lo que quedaba de WP-23 salvo los datos del hogar. En la lista de la campaña fiscal, cada tarea (por declarante) tiene **«Marcar como hecho»** —guarda la fecha de hoy— y **«Quitar marca»** (con «Deshacer»); encima de la lista, un resumen: «Hecho: X de N tareas. Quedan M antes del 31 de diciembre, con <cifra> de ahorro estimado por hacer». Las marcas viven en un almacén nuevo, `fiscal-done` (en `BACKUP_LOCAL_STORES`: copia en fichero y nube). El recordatorio del calendario (WP-32) ya sabe lo que falta: el evento del 1/12 añade en la descripción cuántas tareas hay sin marcar, el del 20/12 dice cuántas quedaban y, **si no queda ninguna, ese evento no se genera** (la pantalla lo avisa). Los títulos no llevan cifras.
- **Reglas con prueba:** **«hecho» lo declara el hogar** (la app no ve el plan de pensiones ni los donativos, y lo dice); solo cuentan las filas **accionables** de acciones **con fecha límite** (lo «sin calcular» no se puede marcar y **ajustar la retención**, que es caja y no tiene fecha, no cuenta para el 31/12); **«sin tareas» no es «todo hecho»** (con 0 tareas no hay progreso); las marcas son **de un año** (otro año no se aplica; acciones desconocidas y fechas fuera del año se descartan al leer); **el ejemplo no se puede marcar**; un almacén dañado no rompe la pantalla.
- **Lo que NO hace:** no verifica nada con nadie; no deduce cuánto se «ahorró», solo cuánto queda por hacer; **si lo hecho cambia las cifras, hay que actualizar «Tus datos fiscales»** a mano (el resumen lo dice); **un `.ics` no puede borrar un evento del 20/12 ya importado**: la pantalla y el manual lo dicen. **Nadie ha tecleado todavía datos reales** (H-03, 20/10): todo lo medido es con cifras ficticias. Los parámetros legales siguen **sin verificar**. Hoy no se toca.
- **Hallazgo en el camino:** la prueba axe de PR-2 reutilizaba el estado entre los dos anchos y, con la marca ya guardada, el botón pasaba a ser «Quitar marca». Era un fallo de aislamiento de la prueba (ahora limpia también `fiscal-done`), no de la app. También se subieron los sellos de versión de los seis scripts/hojas tocados (`wp23c1`) para que el móvil no sirva JS viejo desde la caché.
- **Comprobado que las pruebas detectan el fallo:** siete mutaciones sobre las reglas de arriba (motor, calendario y pantalla), cada una hace caer al menos una prueba; restauradas desde copia antes de validar.
- **No cambia el estado del paquete (WP-23 sigue «en curso», 50 %) ni el avance del plan (61,4 %).** `canonical-*.js`: 110. `app.js`: +1 línea (37.441 de 37.495).
- **Validación:** `npm run verify` en verde, salida 0: `npm test` 5999/5999 (+23), lint, typecheck, accesibilidad, rendimiento, build, privacidad y smoke. E2E 108/108 (+2: marcar/recargar/quitar/deshacer y el `.ics`), accesibilidad (axe) 85/85 (la prueba del formulario de PR-2 ganó una cuarta etapa con una tarea marcada, en claro y oscuro × 1280/390) y rendimiento 3/3, por trozos y con el reloj real; tras editar PROJECT_STATE se repitió `node --test`.

## Cierre de sesión — 16 de octubre de 2026 (312): WP-23 · segunda entrega (el formulario «Tus datos fiscales»)

- **Qué se hizo:** lo que el ensayo del 15/10 dijo que faltaba: **dónde teclear los datos fiscales**. Debajo de la lista de la campaña fiscal (Herramientas avanzadas › Fiscal) hay un formulario por declarante (hasta dos) con los once datos que usa el motor —bruto, tipo marginal, resultado estimado de la Renta, retención actual, aportado a pensiones, plan de empresa, vivienda aplica/pagado, resultado de ventas, minusvalías latentes, tipo del ahorro y donativos— y cada campo dice **dónde se encuentra**. Al guardar, la lista se calcula con esas cifras y **desaparecen las cinco marcas del ejemplo**. Almacén nuevo `fiscal-data` en la copia y la nube; **nada en el repositorio ni por el chat** (es público). Piezas: motor puro (`holderFromInput`, `holderHasData`, `normalizeStore`, `resolveHousehold`), `fiscal-datos-ui.js`, enganche en `fiscal-campana-ui.js`, estilos en `fiscal-campana.css`. `app.js`: **+1 línea** (la clave del almacén; 37.440 de 37.495).
- **Reglas con prueba:** **vacío no es cero** (campo vacío = «sin calcular» y dice qué falta; un 0 escrito sí es un dato; «No lo sé» no es un «No»); **una cifra mala no se guarda ni se corrige en silencio** (no se guarda nada, se marcan los campos con texto y barra, no solo con color); al leer, un valor dañado vuelve a «sin dato»; **los datos son de un año** (los de otro año no se usan y la tarjeta lo dice); quitar los datos **se puede deshacer** (sin `confirm()`); pintar la pantalla **solo lee** y no hay red.
- **Lo que NO hace:** **no toma nada de las nóminas (WP-31) ni del estimador de Renta**: todo se teclea, aunque el bruto y la retención ya estén en las nóminas; unirlos es una decisión aparte. No contrasta las cifras con ninguna fuente y los parámetros legales siguen **sin verificar**. **Nadie ha tecleado todavía datos reales**: lo medido es con cifras ficticias. «Hecho» por acción y el calendario del 1/12 y el 20/12 (PR-3) siguen pendientes.
- **Hallazgos corregidos en el camino:** el aviso «No es un importe» de la app daba **3,89:1** en oscuro dentro de esta tarjeta (ahora, tinta y barra); mi mensaje de error repetía el `id` del lector de importes (ids duplicados); y al guardar el formulario se plegaba y escondía su propio «guardado». La revisión visual (capturas en claro, oscuro y móvil) también cambió la jerarquía: la etiqueta mandaba menos que la ayuda.
- **Comprobado que las pruebas detectan el fallo:** seis mutaciones (vacío→0, sin rango, año ajeno, «no lo sé»→«no», la lista sin los datos reales, formato de importe en un %), cada una hace caer al menos una prueba; restauradas.
- **No cambia el estado del paquete (WP-23 sigue «en curso», 50 %) ni el avance del plan (61,4 %).** `canonical-*.js`: 110.
- **Validación:** `npm run verify` en verde, salida 0: `npm test` 5976/5976 (+23), lint, typecheck, accesibilidad, rendimiento, build, privacidad y smoke. E2E 106/106 (+2: el formulario completo y «Rellenar mis datos»), accesibilidad (axe) 85/85 (+2: vacío, con errores y guardado, en claro y oscuro × 1280 y 390) y rendimiento 3/3, por trozos y con el reloj real; tras editar PROJECT_STATE se repitió `node --test`.

## Cierre de sesión — 16 de octubre de 2026 (311): WP-41 · tercera entrega (más vocabulario del detector, sin extracto real)

- **Qué se hizo:** lo único de WP-41 que se podía avanzar sin un extracto real del hogar: **medir qué se le escapa al detector**. Con un banco de **19 conceptos escritos por mí** (14 deudas inventadas y 5 no-deudas; no son del hogar), **7 de las 14 deudas no salían** y 0 de las 5 no-deudas se marcaban. Dos patrones nuevos en `canonical-shadow-debt.js`: **«en N plazos/cuotas/pagos/mensualidades»** (con cifra) y **Cofidis, Cetelem, Younited y Santander Consumer** (financieras de consumo). Sobre el mismo banco: **6 de 7 pasan a salir, 0 falsos positivos**; la calibración sintética de 40 hogares limpios sigue sin avisos.
- **Lo que NO se hizo, a propósito:** `TERM IPHONE` sigue sin detectarse (sigla demasiado ambigua para adivinarla) y **no se añaden bancos con tarjeta** (su cargo mensual puede ser un extracto, no una cuota).
- **Lo que no prueba:** el banco de conceptos lo escribí yo con lo que conozco; **no demuestra que el hogar vea esos textos** ni que el aviso mensual de Cierre no gane ruido. El detector **sigue sin haberse ejecutado sobre un extracto real** y nadie ha contestado ≥ 10 avisos: la métrica «avisos que sobran» no se puede leer. El manual (`MANUAL_USUARIO.md`) lo dice: lista corta y sin calibrar; que no salga nada no significa que no haya deuda.
- **Comprobado que las pruebas detectan el fallo:** quitando cada patrón nuevo del motor, la prueba nueva cae; restaurados.
- **No cambia el estado del paquete (sigue «en curso», 50 %) ni el avance del plan (61,4 %).** `canonical-*.js`: 110. Sin cambios en `app.js`.
- **Validación:** `npm run verify` en verde, salida 0: `npm test` 5953/5953 (+1), lint, typecheck, accesibilidad, rendimiento, build, privacidad y smoke. Navegador: **solo las 4 pruebas de WP-41** (e2e 2/2 y axe 2/2), porque el cambio es de vocabulario del motor y no toca ninguna pantalla; no se repitió la cadena completa de 104 + 83 + 3.

## Cierre de sesión — 15 de octubre de 2026 (310, segundo PR): revisión de Nielsen y ensayo de los momentos del hogar con la demo

- **Qué se hizo:** (1) **Revisión mensual de Nielsen** (`OPT-21`, tocaba el 16/10) sobre el sitio construido, con evidencia `file:line`, en `docs/OPT21_CHECKLIST_NIELSEN.md`: un hallazgo corregido (**un identificador interno «(H-07)» llegaba a la pantalla de Registrar**, `datos-ui.js`, `T21`) y cuatro anotados sin tocar porque dependen de Hoy (congelado hasta leer H-02) o de una decisión: la insignia «DATO REAL» depende solo de la pantalla y no del dato (`T22`), dos «salud financiera» distintas en Hoy con punto decimal (`T23`), controles y textos repetidos (`T24`). El hallazgo de densidad de Hoy queda **no concluyente** (medido en instalación limpia; hay que repetirlo con el estado real). (2) **Ensayo de los momentos del hogar** (`tools/ensayo-hogar.cjs`, a mano y fuera del CI; informe en `docs/ENSAYO_HOGAR_15OCT.md`): abrir la app el 15-17/10, dar los datos fiscales, cerrar octubre con saldo, valorar la cartera y el «ruido» de Cierre con sus cuatro avisos a la vez. (3) **Una corrección** que sale del ensayo: la comprobación «Las cuentas cuadran» de «Antes de firmar» **se daba por cumplida con cuentas «sin conciliar»**; ahora dice «Ninguna cuenta descuadra · N sin conciliar» (`views/cierre.js`, `tests/c1-c9-cierre-wizard.test.cjs`). **No cambia qué bloquea la firma.**
- **Lo que el ensayo encontró y NO se arregla hoy (se consulta):** **no hay dónde teclear los datos fiscales** (`WP-23 PR-2` sin construir; el repositorio es público, así que no pueden llegar por el chat; el formulario se puede construir ya porque no depende de los datos); **firmar octubre exige un movimiento del mes importado** además de los saldos y la sesión (decisión del 4/10), y el plan del hogar no lo dice; **los avisos de Cierre quedan debajo del asistente de firma** y se puede firmar sin verlos (`T26`); el paso 1 «✓ Conciliar» sale hecho con cuentas sin conciliar (`T25`).
- **Bloque D — contraste de Cierre con datos:** axe sobre Cierre con asistente, listas y los cuatro avisos (plan B, sombra, puente, calma), claro/oscuro × 1280/390. Los **avisos salen limpios**; lo que fallaba (defecto previo, invisible a la suite) eran los pasos bloqueados con `opacity` (2,49:1), las listas «cuadra/no cuadra» (3,02:1), la nota ámbar de la revisión anual (2,94:1) y la insignia de peligro en oscuro (4,1:1). Corregido en `cierre-a11y.css` nuevo (sin tocar `design-tokens.css` ni sus tokens): solo color de texto dentro de `.e19-cierre`. Prueba nueva en `opt4-axe-accessibility.spec.cjs` (2 casos); contra la compilación sin el arreglo falla con las nueve violaciones, con él pasa. **El defecto de fondo (tokens de éxito/peligro/aviso sobre fondo teñido) sigue en el resto de la app.**
- **Lo que sale bien:** abrir la app basta para la foto de liquidez, entrando por cualquier pantalla (el 18/10 ya no hay foto: la ventana es de tres días); declarar saldos son 3 clics; valorar tres posiciones, 2 clics y 3 campos.
- **Límites declarados:** el ensayo cuenta pasos, **no segundos humanos**; es instalación limpia con la demo; no se probaron mensajes de error con entradas inválidas en la revisión de Nielsen.
- **No cambia el estado de ningún paquete ni el avance del plan (61,4 %).** `canonical-*.js`: 110.
- **Validación:** `npm run verify` en verde, salida 0: `npm test` 5952/5952, lint, typecheck, accesibilidad, rendimiento, build, privacidad y smoke. E2E 104/104, accesibilidad (axe) 83/83 (81 + los 2 casos nuevos del bloque D) y rendimiento 3/3, por trozos y con el reloj real; tras editar PROJECT_STATE se repitió `node --test`.

## Cierre de sesión — 15 de octubre de 2026 (310, primer PR): una venta sin importe cobrado ya no inventa una pérdida (hallazgo vecino de WP-15)

- **Qué se hizo:** el fallo que `docs/ESTADO_TAREAS_Y_FASES.md` §6 dejaba anotado como «hallazgo vecino, sin tocar» (7/10), comprobado en el código y corregido. El formulario de venta de **Inversión › Cartera** guarda un importe cobrado vacío como 0, y `fifoLedger` calculaba `realizedGain = cobrado − coste consumido`: una venta sin importe salía con «menos el coste entero» (500 € de coste → −500 €), una minusvalía que no existe, que además entraba en `yearEndCompensation` y se netaba contra plusvalías reales del mismo año. Ahora esa venta tiene `realizedGain: null` («no calculable») y `proceedsMissing: true`; el total de la posición y de la cartera pasan a `null` (una cifra a medias no se enseña) y la compensación fiscal del año devuelve `incomplete-disposal`. Es el mismo criterio con el que la XIRR ya devolvía `disposal-proceeds-unknown`. Textos: «sin importe recibido: plusvalía no calculable» en el libro de operaciones (`operaciones-ui.js`, fila y «antes / después») y la frase de `app.js` (`fc1RealizedGainLabel` y la nota de la cartera) dice ahora «sin lotes suficientes **o sin importe cobrado**». Dos líneas de texto cambiadas en `app.js` **sin añadir ninguna** (37.439 líneas, techo 37.495).
- **Reglas con prueba (`tests/fc1-venta-sin-importe.test.cjs`, 8):** con importe sigue siendo cobrado − coste; importe ausente, vacío, 0 o no numérico → `null`; una venta con importe y otra sin → la primera se calcula y el total es `null`; la compensación del año no se calcula con una venta sin importe de ese año, y **no se contamina** con una de otro año. Comprobado que las pruebas caen con el motor antiguo (7 de 8).
- **Límite declarado:** el motor no distingue «vacío» de «0 escrito a propósito» (el formulario guarda ambos como 0), así que una venta realmente a 0 € (activo sin valor) también sale «no calculable»; el manual dice que se anote 0,01 €. Es el mismo criterio que ya tenía la XIRR. Distinguirlos pediría guardar «vacío» como dato aparte (cambia lo que se guarda): se consulta, no se hace.
- **Comprobado que las pruebas detectan el fallo:** en `dist/canonical-portfolio.js` (minificado) se cambió `realizedGain:g>0||!(d.saleProceeds>0)?null:` por `realizedGain:g>0?null:` y el test de navegador falló en `toContainText` («sin importe recibido»); restaurado después.
- **Hallazgo que bloqueaba publicar (y que habría puesto el CI en rojo seis días al mes):** la prueba de navegador de WP-45 («seis fichas con edad…») comprueba que la ficha **no guarda nada** comparando el almacenamiento antes y después, y **depende del día del mes**: los días **1-3 y 15-17** la foto de liquidez (WP-12) y los motores escriben solos al abrir la app, así que la prueba fallaba esos días (se vio el 15/10; pasaba el 14/10). Reproducido (falla sola con la fecha real, pasa con el reloj fijado el 12/10) y corregido **en la prueba**, fijando un día fuera de las ventanas, con su explicación en el código. No toca la aplicación. Primero lo tomé por un fallo de carga de la máquina; **no lo era**: se repitió en limpio.
- **Documentación de paso:** la nota de WP-18 «candidato a corregir antes el XIRR de las ventas parciales» estaba obsoleta (corregido el 7/10) y se cambia; `MANUAL_USUARIO.md` y una línea en Novedades.
- **No cambia el estado de ningún paquete ni el avance del plan (61,4 %).** `canonical-*.js`: 110.
- **Validación:** `npm run verify` en verde, salida 0: `npm test` 5951/5951, lint, typecheck, accesibilidad, rendimiento, build, privacidad y smoke. E2E 104/104, accesibilidad (axe) 81/81 y rendimiento 3/3, ejecutados por trozos con el reloj real; tras el último cambio de PROJECT_STATE se repitió `node --test` (5951/5951).

## Cierre de sesión — 14 de octubre de 2026 (309, tercer PR): WP-47 · segunda entrega (el reparto de la nómina frente a la política firmada y el plan B)

- **Qué se hizo:** lo que `docs/WP47_DISENO.md` §5 dejaba pendiente y no guarda datos nuevos. `crossLadder` en el motor puro (`canonical-payroll-split.js`: traduce las filas EDITADAS del reparto a lo que entiende `crossChecks`, de WP-42) y `nominaCrossHtml` en `nomina-ui.js`, que reutiliza los bloques de la escalera. Se cruza lo que se va dejando con los botones, no lo sugerido. `app.js` no se toca.
- **Reglas con prueba:** **solo avisa**: no cambia el reparto, no desactiva «Aplicar» y no pide motivo; sin política ni plan B guardados **no sale nada**; solo se cruzan inversión (por tipo) y pensión; si el reparto no distingue tipos, dice que no puede comprobarlo, **no que cumple**; sin firmar se marca como borrador; el aviso cambia al mover los importes; solo lee y no muta las filas.
- **Lo que NO cierra (y por qué sigue «en curso» al 50 %):** **nadie ha firmado una política ni un plan B** (H-12, 18/12), así que solo puede salir con borradores; **ninguna nómina real se ha repartido**; pedir motivo al aplicar un reparto que contradice la política guardaría datos nuevos (se consulta); siguen pendientes el aviso al confirmar la nómina (Hoy, congelado hasta H-02), el destino de cada transferencia, el reparto por titular y el aviso en el cierre de nóminas sin repartir; los umbrales de la escalera siguen sin calibrar.
- **Comprobado que las pruebas detectan el fallo:** en el sitio construido y minificado (`dist/nomina-ui.js`), quitar la llamada `${nominaCrossHtml(t)}` hace que la prueba de navegador del cruce falle en `toBeVisible`; restaurado después.
- **No cambia el estado del paquete (sigue «en curso», 50 %) ni el avance del plan (61,4 %).** `canonical-*.js`: 110.
- **Validación:** `npm run verify` en verde, salida 0: `npm test` 5943/5943 (+4 respecto a 5939), lint, typecheck, accesibilidad, rendimiento, build, privacidad y smoke. E2E 103/103 (+1), axe 81/81, rendimiento por pantallas 3/3 (ejecutados por bloques tras los reinicios de la máquina). La prueba de navegador de esta entrega no se había ejecutado nunca antes de hoy: al correrla se ajustaron dos supuestos suyos (la escalera ya manda parte a cripto con el objetivo 50/50, y los importes llevan espacio duro), no el aviso.

## Cierre de sesión — 14 de octubre de 2026 (309, segundo PR): WP-46 · segunda entrega (antigüedad por componente del patrimonio)

- **Qué se hizo:** el riesgo que `docs/WP46_DISENO.md` §4 dejaba apuntado: el patrimonio de un cierre **heredaba sin avisar** una valoración de cartera de hace más de 35 días. `componentAges` y `ageNotice` en el motor puro (`canonical-net-worth.js`); la foto de cada cierre guarda ahora la fecha de cada componente (`asOf`); `patrimonio-ui.js` (`patrimonioAgeHtml`) avisa en «hoy» y bajo la serie. `app.js` no se toca.
- **Reglas con prueba:** fecha ausente o futura no es reciente («sin fecha»); 35 días justos no es viejo, 36 sí; un componente sin importe no tiene nada que fechar; si todo está al día **no sale nada**; la deuda, que no guarda fecha, no dispara el aviso por sí sola y se dice; **no corrige la cifra**; solo lee; las fotos antiguas sin `asOf` no avisan (no se inventa la fecha).
- **Lo que NO cierra (y por qué sigue «en curso» al 50 %):** **no hay ningún cierre real** (el primero, 1-3/11); **los 35 días son un margen mío, sin calibrar** (un hogar que valore cada trimestre lo vería casi siempre en aviso); «el más antiguo» avisa de toda una cartera por una sola posición vieja; la antigüedad de la deuda y de cada inmueble con índice sigue sin estar; la barra de «mercado» del puente (cambia lo que se guarda; se consulta), los hitos de jubilación y de objetivos de ahorro, las aportaciones futuras de la política y los impuestos latentes siguen pendientes.
- **Comprobado que las pruebas detectan el fallo:** en el sitio construido y minificado (`dist/canonical-net-worth.js`), cambiar `show:u.length>0` por `show:false` hace que la prueba de navegador del aviso falle en `toBeVisible`; restaurado después.
- **No cambia el estado del paquete (sigue «en curso», 50 %) ni el avance del plan (61,4 %).** `canonical-*.js`: 110.
- **Validación:** `npm run verify` en verde, salida 0: `npm test` 5939/5939 (+4 respecto a 5935), lint, typecheck, accesibilidad, rendimiento, build, privacidad y smoke. E2E 102/102 (+1), axe 81/81, rendimiento por pantallas 3/3 (ejecutados por bloques tras los reinicios de la máquina).

## Cierre de sesión — 14 de octubre de 2026 (309, primer PR): WP-44 · segunda entrega (el aviso de calma en caídas en Cierre)

- **Qué se hizo:** lo que `docs/WP44_DISENO.md` §5 dejaba pendiente y no tocaba datos del hogar. `closeNotice` en el motor puro (`canonical-calm-coverage.js`), `renderCalmaAviso` en `calma-ui.js` (comparte con la tarjeta el cálculo `calmaDrawdownState`, para que no puedan discrepar), una línea en `views/cierre.js` y una tarjeta oculta `#calmaAviso` en `index.html`. El botón lleva a Inversión › Cartera. `app.js` no se toca.
- **Reglas con prueba:** solo sale con serie (≥ 3 valoraciones) y una caída que llegue al primer nivel (20 %); sin serie o con menos caída **no sale nada** (ni «todo bien» ni «faltan datos»); **nunca recomienda vender ni comprar**; con política firmada cita lo acordado para ese nivel y **sin firmar no se lo inventa** (una política sin firmar no cuenta); avisa si la última valoración tiene más de 35 días; solo lee.
- **Lo que NO cierra (y por qué sigue «en curso» al 50 %):** **hoy no puede salir**: hay 0 valoraciones y la primera es la del 1-3/11; el campo «entidad» en las posiciones (fondos y seguros por entidad) **cambia datos del hogar y se consulta antes**; la evolución de la cobertura guarda datos nuevos (se consulta); las caídas históricas con fuente no se inventan; **el 20 % como umbral de aviso es el de la política, sin calibrar con un caso real**; el aviso sale en cada apertura de Cierre mientras la caída siga ≥ 20 % (posible ruido).
- **Comprobado que las pruebas detectan el fallo:** en el sitio construido y minificado, quitando la llamada del aviso en `views/cierre.js`, la prueba de navegador cae justo en él («Expected: visible / Received: hidden»); restaurado el fichero después.
- **No cambia el estado del paquete (sigue «en curso», 50 %) ni el avance del plan (61,4 %).** `canonical-*.js`: 110.
- **Validación:** `npm run verify` en verde, salida 0: `npm test` 5935/5935 (+6), lint, typecheck, accesibilidad, rendimiento, build, privacidad y smoke. E2E 101/101 (+1: aviso de calma en Cierre), accesibilidad (axe) 81/81, rendimiento por pantallas 3/3.

## Cierre de sesión — 13 de octubre de 2026 (308, cuarto PR): WP-43 · segunda entrega (el aviso del puente de previsión en Cierre)

- **Qué se hizo:** lo que `docs/WP43_DISENO.md` §5 dejaba pendiente. `closeNotice` en el motor puro (`canonical-forecast-bridge.js`), `renderPuenteAviso` en `puente-ui.js`, una línea en `views/cierre.js` y una tarjeta oculta `#puenteAviso` en `index.html` junto a los avisos del plan B y de la sombra de deuda. El botón «Ver el puente» lleva a Plan › Previsión. `app.js` no se toca.
- **Reglas con prueba:** solo sale con puente calculable **y** cambio relevante (≥ 5 %); sin puente, no calculable o cambio pequeño **no sale nada** (nunca un «todo igual»); si «otros y supuestos» explica ≥ 40 % del cambio, lo dice; solo lee (una prueba comprueba que el almacén no cambia); la dirección no depende solo del color (icono, título y borde).
- **Cambio fuera de lo pedido, declarado:** el texto verde de `is-positivo` (A-4, Análisis) daba 3,49 : 1 en claro; ahora se mezcla con la tinta (5,7 : 1). Una prueba lo calcula con los tokens reales de claro y oscuro.
- **Lo que NO cierra (y por qué sigue «en curso» al 50 %):** **no existe ningún puente real**: hace falta el segundo cierre del año desde la app (noviembre/diciembre), así que este aviso no ha salido nunca con datos del hogar; la barra de **mercado** necesita WP-46; el **toque en una barra → partidas** cambiaría lo que se guarda en las fotos (se consulta antes); **el 5 % y el 40 % son míos y sin calibrar**; el aviso sale en cada apertura de Cierre mientras el último puente sea relevante (posible ruido).
- **Comprobado que las pruebas detectan el fallo:** en el sitio construido y minificado, quitando la llamada del aviso en `views/cierre.js` del sitio construido y minificado, la prueba de navegador cae justo en él («Expected: visible / Received: hidden»); restaurado el fichero después. (Un primer intento de validación falló por un error mío: había subido el sello de versión de `design-tokens.css` en `index.html` y 9 pruebas antiguas lo fijan; revertido, el cambio de color se mantiene y el build cambia el nombre de la caché del service worker en cada versión.)
- **No cambia el estado del paquete (sigue «en curso», 50 %) ni el avance del plan (61,4 %).** `canonical-*.js`: 110.
- **Validación:** `npm run verify` en verde, salida 0: `npm test` 5929/5929 (+4), lint, typecheck, accesibilidad, rendimiento, build, privacidad y smoke. E2E 100/100 (+1: aviso del puente en Cierre), accesibilidad (axe) 81/81, rendimiento por pantallas 3/3.

## Cierre de sesión — 13 de octubre de 2026 (308, tercer PR): WP-42 · segunda entrega (el reparto del próximo euro frente a la política firmada y el plan B)

- **Qué se hizo:** lo que `docs/WP42_DISENO.md` §5 dejaba como «siguiente paso natural». `crossChecks` en el motor puro (`canonical-next-euro.js`) y un bloque «Frente a vuestra política y vuestro plan B» bajo la escalera de **Deuda › Comparar** (`escalera-ui.js`, `escalera.css`). **Política:** cada tipo de activo al que iría lo que se invierte se comprueba como una compra con `checkOperation` (el motor de WP-39). **Plan B:** si salta o está en vigilancia y el reparto manda dinero a pensión o inversión, lo dice con el importe. `app.js` no se toca.
- **Reglas con prueba:** **solo avisa**: no reordena la escalera, no redirige el euro al colchón (el diseño original lo sugería; reordenar en silencio contradice la regla de la escalera y la app no sabe si lo acordado sigue valiendo), no bloquea nada y no pide motivo; sin política ni plan B guardados **no sale nada**; sin dinero a invertir no se comprueba la política; sin firmar o cambiado tras firmar se marca como borrador; **«no se puede comprobar» no se presenta como «cumple»** y un plan B incompleto o sin previsión no se presenta como «va bien»; el cruce **solo lee** (una prueba comprueba que no escribe).
- **Lo que NO cierra (y por qué sigue «en curso» al 50 %):** **los tres umbrales de la escalera (2 puntos, 6 %, 30 %) siguen siendo míos y sin calibrar**; **fondos traspasables y liquidez ociosa siguen sin estar**; **nada se ha visto con una política ni un plan B reales** (nadie ha firmado ninguno, H-12 18/12); sin aviso en Cierre ni en Hoy.
- **Comprobado que las pruebas detectan el fallo:** quitando el bloque de la tarjeta en el sitio construido, la prueba de navegador cae justo en él; quitando la guarda de «sin dinero a invertir» o cambiando el texto del plan B ilegible por «todo bien», caen las unitarias. (Mi primera comprobación en el sitio construido no valió: el sitio está minificado y el nombre de la variable cambia, así que mi sustitución no aplicó; repetida con el nombre minificado.)
- **No cambia el estado del paquete (sigue «en curso», 50 %) ni el avance del plan (61,4 %; Ola 3 al 49 %).** `canonical-*.js`: 110.
- **Validación:** `npm run verify` en verde, salida 0: `npm test` 5925/5925 (+6), lint, typecheck, accesibilidad, rendimiento, build, privacidad y smoke. E2E 99/99 (+1: cruce de la escalera con política y plan B), accesibilidad (axe) 81/81, rendimiento por pantallas 3/3.

## Cierre de sesión — 13 de octubre de 2026 (308, segundo PR): WP-41 · segunda entrega (el aviso de deuda en la sombra también en Cierre)

- **Qué se hizo:** el aviso que `docs/WP41_DISENO.md` dejaba para «Hoy/Cierre», limitado a Cierre (Hoy sigue congelado hasta H-02). `closeNotice` en el motor puro (`canonical-shadow-debt.js`) compone el texto desde el resultado del detector, **sin umbrales ni evaluación nuevos**; `sombra-ui.js › renderSombraAviso` lo pinta y **un solo enganche** en `views/cierre.js` lo llama; tarjeta oculta por defecto en `index.html`. Con compromisos: cuántos, cuota total, los tres mayores y que no cuentan hoy en la fecha libre de deuda ni en el ratio de esfuerzo, con botón a Deuda › Contratos (por la dirección, para que «atrás» cuadre). Con extracto viejo: «no puedo mirar». Además, «fracc.» se reconoce como fraccionado.
- **Reglas con prueba:** **sin ningún extracto importado, o sin hallazgos, no sale nada** (no se presenta «no hay deuda oculta»: el detector solo ve lo que el extracto delata); lo respondido «No es deuda» y lo ya dado de alta no vuelven a avisar; el aviso **solo lee** (una prueba comprueba que la función no escribe); la variante «fracc.» no abre la puerta a recurrentes normales («FRACCIONES SL» no cuenta). `app.js` no se toca.
- **Lo que NO cierra (y por qué sigue «en curso» al 50 %):** el detector **sigue sin haberse ejecutado sobre un extracto real** y nadie ha contestado ≥ 10 avisos, así que la métrica del plan (avisos que sobran) no se puede leer. **Un aviso mensual sobre un detector sin calibrar puede ser ruido mensual**, y lo multiplica. «Fracc.» es una suposición mía. Solo avisa al abrir Cierre. Hoy sigue sin aviso.
- **Comprobado que las pruebas detectan el fallo:** quitando el enganche de Cierre en el sitio construido, la prueba de navegador cae justo en el aviso; y quitando «fracc.» o la guarda de «sin hallazgos» del motor, caen las pruebas unitarias. (Mi primera versión de la prueba de navegador llamaba a la función del aviso directamente y **no habría detectado** el enganche roto; se rehízo para repintar Cierre de verdad. También cambié el botón de `setActiveView`, que dejaba la dirección en `#cierre`, a la navegación normal por dirección.)
- **No cambia el estado del paquete (sigue «en curso», 50 %) ni el avance del plan (61,4 %; Ola 3 al 49 %).** `canonical-*.js`: 110.
- **Validación:** `npm run verify` en verde, salida 0: `npm test` 5919/5919 (+6), lint, typecheck, accesibilidad, rendimiento, build, privacidad y smoke. Navegador sobre el sitio construido (en trozos por pruebas concretas, porque la máquina se reinicia cada pocos minutos): e2e 98/98 (+1: aviso de deuda en la sombra en Cierre), axe 81/81, perf-screens 3/3.

## Cierre de sesión — 13 de octubre de 2026 (308, primer PR): WP-40 · segunda entrega (el aviso anual de la CIRBE en el calendario del móvil)

- **Qué se hizo:** lo único que `docs/WP40_DISENO.md` §3 marcaba como «lo que impide contarlo como hecho»: el **recordatorio anual**. Tipo nuevo `cirbe` en el motor de recordatorios (WP-32, `canonical-reminders.js`): un evento «Toca pedir el informe de la CIRBE» **a los 335 días del informe tecleado** (un año menos 30 días), **la misma fecha** en que la tarjeta de Deuda › Contratos pasa a «toca pedirlo» (la calcula `reportStatus` del motor de la CIRBE, una sola fuente de verdad: `cirbeCalendarItems()` en `cirbe-ui.js`). Casilla propia en Ajustes › Recordatorios (marcada por defecto, 6 tipos ya). No se tocó `app.js`.
- **Reglas con prueba:** **sin informe tecleado no hay aviso** (no se inventa una fecha); si el día ya pasó (informe de hace más de 335 días), **uno para hoy**, no uno en el pasado; fuera del horizonte del fichero (6 meses) todavía no sale; identificador estable (`rec-cirbe-<fecha>`): reimportar el fichero actualiza, no duplica; **el título no lleva datos** (ni fecha del informe, ni importes, ni de quién es) y el detalle dice qué hacer y «verificad el procedimiento actual», sin prometer nada del trámite; apagable.
- **Lo que NO cierra (y por qué sigue «en curso» al 50 %):** el `.ics` **se genera a mano y solo cubre 6 meses**: el aviso llega al calendario si alguien regenera el fichero dentro de esa ventana (la tarjeta ya avisa de regenerar cada mes, pero no lo fuerza). **Un .ics no puede borrar**: si el informe se actualiza, el aviso viejo ya importado sigue en el calendario del móvil. **Sigue sin haber ningún informe real tecleado**, así que lo supuesto sobre el formato (importe total para cada cotitular, campo «dispuesto») sigue sin comprobar y la métrica («errores de registro encontrados») no se puede leer. «Leer el informe pegado» y el aviso en Hoy (tras H-02) siguen pendientes.
- **No cambia el estado del paquete (sigue «en curso», 50 %) ni el avance del plan (61,4 %; Ola 3 al 49 %).** `canonical-*.js`: 110.
- **Validación:** `npm run verify` en verde, salida 0: `npm test` 5913/5913 (+7), lint, typecheck, accesibilidad, rendimiento, build, privacidad y smoke. Navegador sobre el sitio construido: e2e 97/97 (+1: aviso de la CIRBE en el .ics), axe 81/81, perf-screens 3/3.

## Cierre de sesión — 13 de octubre de 2026 (307, tercer PR): WP-39 · segunda entrega (la política al registrar una compra o venta, con nota de motivo)

- **Qué se hizo:** lo que `docs/WP39_DISENO.md` §3 dejaba pendiente («cero operaciones contrarias sin nota de motivo»). **En el libro de operaciones (WP-48, Inversión › Cartera), al AÑADIR una aportación o una venta**, el paso «Qué cambia si guardas» enseña un bloque **«Frente a vuestra política de inversión»** que compara la operación con la política con el mismo motor de la consulta voluntaria (`checkOperation`). Motor puro nuevo: `registrationNotice`, `canRegister`, `normalizeReasons`, `addReason`, `reasonsSummary`; almacén nuevo `policy-reasons` (en la copia; tope 200, motivo ≤ 400 caracteres), **aparte del libro de operaciones** (no se toca el contrato de las posiciones). Tarjeta de la política: «Operaciones registradas con aviso» con **cuántas, cuántas contradecían y cuántas de ésas sin motivo** (la medida del criterio del plan). Campo opcional de **caída de la cartera** en las ventas (no se guarda en la operación).
- **Reglas con prueba:** **no bloquea nunca el registro**; lo único que **no se registra sin motivo** es una operación que **contradice una política FIRMADA** (sin él, se dice por qué y no se guarda esa operación); «ojo» pide motivo opcional; una política **sin firmar o cambiada tras firmar** avisa como borrador y **no** pide motivo; **«no se puede comprobar» no se presenta como «cumple»**; solo dejan constancia las que contradicen o piden cuidado; **deshacer la operación devuelve también el motivo a como estaba**. +1 línea en `app.js` (la copia: 37.439 de 37.495, margen 56).
- **Lo que NO cubre:** **solo al añadir**: editar o quitar una operación y las otras vías de alta (alta de posiciones, importador) **no** pasan por la política. **Un motivo deja constancia, no prueba nada**: la app no sabe si es cierto ni si lo acordaron las dos personas. **No se ha visto con una política real del hogar**: nadie ha firmado la suya (H-12, 18/12). La banda de la política sigue sin gobernar IV6 y «no vender por caídas» sigue pidiendo teclear la caída (WP-44).
- **Hallazgo al probarlo:** mi primera prueba de navegador esperaba que comprar fondo «no chocara», y el motor avisó con razón: con mis datos de siembra la cartera ya estaba fuera de banda (fondo 89 % frente a 80 %). Arreglé los datos de prueba, no el motor. **Comprobado que la prueba detecta el fallo**: con el control del motivo desactivado en el sitio construido, cae al intentar guardar sin motivo.
- **No cambia el estado del paquete (sigue «en curso», 50 %) ni el avance del plan (61,4 %; Ola 3 al 49 %).** `canonical-*.js`: 110.
- **Validación:** `npm run verify` en verde, salida 0: `npm test` 5906/5906, lint, typecheck, accesibilidad, rendimiento, build, privacidad y smoke. Navegador sobre el sitio construido: e2e 96/96 (+1: política al registrar), axe 81/81 (+2), perf-screens 3/3.

## Cierre de sesión — 13 de octubre de 2026 (307, segundo PR): WP-38 · segunda entrega (el aviso del plan B también en Cierre)

- **Qué se hizo:** la vía que el propio diseño marcaba como primera (`docs/WP38_DISENO.md` §4, vía 3): **el plan B se vigila también en Cierre**, que se abre cada mes, y no solo al abrir Plan › Previsión. Aviso arriba de Cierre (`planBAviso`, antes de la carta del mes), pintado por `contingencia-ui.js › renderPlanBAviso`, con el texto compuesto por el motor (`canonical-contingency-plan.js › closeNotice`, puro) y **un solo enganche** en `views/cierre.js`. Misma previsión viva y mismo motor: **ni umbrales ni evaluación nuevos**.
- **Reglas con prueba:** sin plan guardado **no sale nada** (ni se calcula la previsión); cinco casos —**salta** (cuándo, los tres primeros pasos, si bastan o cuánto falta), **en vigilancia**, **sin disparar** (con el mínimo previsto), y dos que **no pueden vigilar** (sin previsión; plan incompleto)—, cada uno con icono, título y borde propios; **lo que no se puede vigilar se dice, no se presenta como «todo va bien»**; un plan **sin firmar o cambiado tras firmar** se marca como borrador; el aviso **solo lee**. «Ver el plan completo» abre Plan › Previsión (un primer intento con un enlace `#prevision` llevaba a la otra pantalla «Previsión», no a la pestaña del Plan; lo detectó la prueba de navegador y lo cambié por un botón que usa `setActiveView` y `setPlanTab`). Novedad `2026-10-13-wp38b` y párrafo nuevo en el manual.
- **Lo que NO cierra (y por qué sigue «en curso» al 50 %):** el aviso **depende de que alguien abra Cierre**, una vez al mes (el 1-3). Un mes malo que se vea venir a mitad de mes **puede tardar semanas en avisar**. Estrecha el agujero, no lo cierra: la bandeja de Hoy (tras H-02) y el recordatorio en el calendario (WP-32) siguen sin hacerse. **Tampoco he visto el aviso con un plan real del hogar**: nadie ha firmado un plan B (H-12, 18/12).
- **Comprobado que las pruebas detectan el fallo:** quitando el enganche de Cierre en el sitio construido, la prueba de navegador cae justo en el aviso. (Un primer intento de esa comprobación no valió: Playwright arrancó su propio servidor y **reconstruyó `dist`**, borrando mi cambio; repetido con el servidor levantado antes.)
- **Estado del plan:** avance **61,4 %** (85,1 de 138,5; Ola 3 al 49 %), **sin cambio**. `canonical-*.js`: 110. `app.js` sin tocar (37.438). `views/cierre.js` +1 línea.
- **Validación:** `npm run verify` en verde, salida 0: `npm test` **5899/5899** (+5: texto del aviso en cada caso, sin plan, borrador, no se puede vigilar y cableado), lint, typecheck, accesibilidad, rendimiento, build, privacidad y smoke. e2e **95/95** (+1: los cuatro niveles del aviso en Cierre, a 390 y 1280 px, y el botón al plan), axe **79/79** (+2: el aviso en claro y oscuro en cada nivel), perf-screens **3/3**.

## Cierre de sesión — 13 de octubre de 2026 (307, primer PR): WP-37 · segunda entrega (seis registros de Ajustes que se quitaban sin aviso)

- **Qué se hizo:** una búsqueda de manejadores de borrado encontró **seis listas de Ajustes que se vaciaban al instante, sin confirmación ni vuelta atrás**: objetivos de compra grande, cuentas remuneradas, cuentas con comisión de mantenimiento, pólizas, tablas fiscales y escalas de IRPF (datos que el hogar teclea a mano). Ahora se quitan al momento y avisan con **«Deshacer» 10 s**; el registro vuelve **a su sitio** (no al final), **sin pisar** lo tocado mientras tanto y **sin duplicarse**. Ayudante común `quitarConDeshacer` en `estados-ui.js`; las funciones `removeX` de datos **no se tocan** (sus pruebas unitarias siguen igual). `app.js` **baja 11 líneas** (37.449 → 37.438). Novedad `2026-10-13-wp37b` y línea nueva en el manual.
- **Fuera, con motivo:** proyectos y decisiones de deuda (ya tienen vía de recuperación, `restoreWorkflowDecision`) y el último `confirm()` (consolidar con la reserva bajo el mínimo: UX1 lo mantuvo a propósito).
- **Lo que NO he visto funcionar:** en navegador solo se prueba con el botón real **cuentas remuneradas y pólizas**; tablas fiscales, escalas de IRPF, cuentas con comisión y objetivos de compra grande pasan por el mismo ayudante y están cubiertas por la prueba unitaria y por una que fija su cableado, **pero no las he clicado una a una**.
- **Defecto de la prueba que detecté al escribirla:** la prueba de navegador pasó a la primera, así que comprobé que de verdad detecta el fallo: estropeé a propósito el manejador en el sitio construido y cayó justo en el aviso. Cuatro pruebas existentes fijaban el texto exacto de los manejadores (A15-2, LPX3, LPX4, T13); las actualicé para comprobar lo mismo con la forma nueva, sin relajar lo que exigen.
- **No cambia el estado del paquete (sigue «en curso», 50 %) ni el avance del plan (61,4 %; Ola 3 al 49 %).** `canonical-*.js`: 110.
- **Validación:** `npm run verify` en verde, salida 0: `npm test` **5894/5894** (+3), lint, typecheck, accesibilidad, rendimiento, build, privacidad y smoke. e2e **94/94** (+1). axe **77/77**, perf-screens **3/3**.

## Cierre de sesión — 12 de octubre de 2026 (306, decimonoveno PR): prueba e2e de WP-12 endurecida (solo test; causa del fallo NO demostrada)

- **Qué pasó:** el CI de `main` tras fusionar WP-36 PR-2 falló una vez en `QA-1 · backtest de liquidez (WP-12) › con saldos manuales la foto sí cuenta…` (92/93) y pasó al repetir. Esa prueba pasó 10/10 en local y en el CI del PR con el mismo árbol.
- **Lo que NO sé:** **por qué falló.** El registro del CI solo trae el nombre de la prueba (el bloque de error no está en las últimas 5.000 líneas que devuelve la herramienta y el host del registro completo lo bloquea el proxy del entorno). Intenté reproducirlo con CPU limitada ×6 (12/12), ×10 (10/10) y, con ×20 y 4 trabajadores, todo agota el tiempo por pura lentitud sin señalar una carrera concreta. **El endurecimiento ataca las dos causas plausibles que vi en el código, no una confirmada.**
- **Qué cambia (solo `tests/qa1-flujos-completos.spec.cjs`, ningún código de la app):** (1) el paso a saldos manuales, el borrado de la foto y la foto nueva ocurren **en una sola tarea de la página**, y la foto se lee **del almacén**, no del valor que devolvía `freezeLiquidityForecast()`: si la app repite la foto al volver a ser visible (`visibilitychange`, `liquidity-backtest-ui.js`) entre medias, esa función devolvía `null` y la prueba caía con un `TypeError` poco claro. (2) las esperas por tiempo (foto inicial, texto del resumen) pasan de 5 a 20 y 15 s. (3) **si una prueba de WP-12 falla, el registro del CI ahora imprime el estado de la página** (foto, cierres, modo de saldos, visibilidad, hora) y lo adjunta; comprobado forzando un fallo en una copia.
- **Validación:** `npm run verify` en verde (5891/5891), e2e **93/93**, la prueba endurecida 20/20 en normal y 8/8 con CPU ×8. **No hay forma de demostrar que el fallo no vuelva**: si vuelve, el registro dirá ya por qué.
- **No cambia el avance del plan** (61,4 %).

## Cierre de sesión — 12 de octubre de 2026 (306, decimoctavo PR): WP-36 · segunda entrega (arrepentirse de un silencio y no confundir comercios)

- **Qué se hizo:** dos ajustes a las anomalías del extracto que no dependen del hogar ni tocan Hoy (`docs/WP36_DISENO.md` §5-§6). (1) **Lista «Patrones que has silenciado (N)»** bajo los avisos, con su nombre y fecha y **«Volver a vigilar»** (con Deshacer): hasta ahora un «Es normal siempre» solo se deshacía justo después de darlo. Reactivar deshace el «Es normal siempre» que lo puso (los avisos silenciados vuelven a verse y esa respuesta deja de contar en la tasa de falsos positivos); no toca las respuestas a otros avisos. El almacén gana `labels` (con tope de 200) y `silenceKey` en esa respuesta, retrocompatible. (2) **La forma de pago deja de gastar el concepto** (`compra`, `tarj`, `tarjeta`, `pago`, `con`, `comercio`, `adeudo`, `domiciliacion`, `movil`, `tpv`): «COMPRA CON TARJETA EN COMERCIO PANADERIA» y «…FERRETERIA» eran el mismo concepto de cuatro palabras y podían salir como duplicado. Ningún umbral ni aviso cambia salvo por qué se reconoce como «el mismo comercio».
- **Lo que hay que cuestionar:** (a) **la lista de palabras de forma de pago la escribí yo de memoria de cómo suelen escribir los bancos, no de un extracto real**; un banco con otros prefijos seguirá confundiendo comercios. (b) **Cambiar el concepto cambia los identificadores**: un aviso ya contestado puede volver a aparecer una vez (no consta ninguna respuesta del hogar). (c) Un «Es normal siempre» dado antes de esta entrega no guardaba su clave: al reactivar su patrón vuelve el patrón, no ese aviso concreto. (d) Sigue sin caducidad de los silencios.
- **Defecto propio corregido durante la prueba:** primero «Volver a vigilar» no devolvía el aviso que se había silenciado (su respuesta seguía guardada); lo detectó el e2e y se cambió el motor, no la prueba.
- **No cambia el estado de WP-36 ni el avance del plan:** sigue «en curso» (50 %); el avance se queda en **61,4 %** (85,1 de 138,5; Ola 3 al 49 %). Lo que falta es lo mismo: adaptador a la bandeja (tras H-02) y medir los falsos positivos con ≥ 10 respuestas del hogar. `canonical-*.js`: 110. `app.js` sin cambios (37.449).
- **Validación:** `npm run verify` en verde, salida 0: `npm test` **5891/5891** (+3 de WP-36: concepto sin forma de pago, silenciados y «volver a vigilar», etiquetas antiguas y tope), lint, typecheck, accesibilidad, rendimiento, build, privacidad y smoke. e2e **93/93** (la prueba de WP-36 ampliada: la lista, el nombre, «Volver a vigilar», Deshacer y que nada se sale de la tarjeta a 390 y 1280 px), axe **77/77** (la tarjeta con la lista abierta, claro y oscuro), perf-screens **3/3**.

## Cierre de sesión — 12 de octubre de 2026 (306, decimoséptimo PR): WP-35 · previsión en tres capas e ingresos con certeza (SOLO LA LECTURA; Hoy y la nómina no cuentan solo lo confirmado todavía)

- **Qué se hizo:** en **Plan › Previsión**, tarjeta plegable «Previsión en tres capas e ingresos con certeza» (`capas-ui.js`, `capas.css`; motor puro `canonical-forecast-layers.js`; almacén `forecast-layers-data` **en la copia y la nube**; diseño en `docs/WP35_DISENO.md`; sección nueva en el manual). Un **mes a elegir** (por defecto, el de hoy) leído en **comprometido · probable · discrecional** con su frase («En octubre: comprometido 2.980 €; probable 1.750 €; discrecional 0 €. Con los ingresos confirmados (5.000 €) queda un margen de 270 €.»), una **barra apilada con patrón** (liso, rayas, puntos, además de texto y leyenda) y los **ingresos con certeza** (Confirmado · Probable N % · Incierto N %, con chip y selector) con **tres márgenes**: con lo confirmado, contando su probabilidad y si llegara todo. La capa de cada partida es editable.
- **Es lectura, y eso es lo que hay que mirar primero:** **no cambia ninguna cifra de la previsión, ni el titular de Previsión, ni Hoy** (un e2e lo comprueba declarando un ingreso de 2.000 € como incierto). **NO está hecho lo que daba valor a la propuesta**: que **la cifra de Hoy y el reparto de nómina solo cuenten lo confirmado** (PR-2: toca el motor de la previsión de caja y Hoy sigue congelado hasta H-02). Tampoco hay «ventana de fecha» por ingreso, meses de vacío del local, barra «hasta cobrar» (por mes, no por tramo hasta cobrar), ni kit de WP-28 (no tiene barras apiladas y WP-28 sigue «en curso»).
- **Hallazgos al leerlo:** (1) **`movementActionTypes` clasifica movimientos del banco, no partidas**: para las partidas no había eje; la capa se **sugiere por el bloque** (fijos y financiaciones: comprometido; el resto: probable) y la tarjeta cuenta cuántas son solo sugeridas. (2) **«Discrecional» empieza a 0**: ninguna partida lo es por sí misma. (3) La **banda de «probable» solo existe con ≥ 3 meses cerrados con real** (± la desviación absoluta media); sin ellos se dice que no hay banda, no se inventa. (4) La **probabilidad la teclea el hogar**; sin declarar, un ingreso es «confirmado»: activarlo no cambia nada. (5) Sin reales en el mes, el margen es el del plan y la tarjeta lo dice.
- **Defecto propio encontrado al probar (corregido):** al cambiar un selector, el repintado **cerraba las listas desplegadas** (ingresos y gastos); ahora recuerda cuáles estaban abiertas. **El mismo defecto estaba en WP-34** («Ya revisadas» se cerraba al repintar): corregido en este PR.
- **Por qué «en curso» (50 %) y por qué sobrepuntúa mucho:** el éxito del plan («ningún mes con margen negativo por un ingreso contado que no llegó») no se puede medir, porque nada está declarado como no seguro y la previsión sigue contando todo. **Lo hecho son ≈ 2 de las 5 sesiones del paquete** y el 50 % le da 2,5. Paquete con novedad (`2026-10-12-wp35`).
- **Estado del plan:** avance ponderado **61,4 %** (85,1 de 138,5 sesiones; Ola 3 al **49 %**). 21 paquetes hechos. `canonical-*.js`: **110** (ARQ-3, con consumidor real: `renderPrevisionQuality` de `app.js` pasa el motor a `renderCapasPrevision`). `app.js` **37.449** de 37.495 (+2: la llamada al pintar Previsión y el almacén en la copia; margen 46).
- **Despliegue de WP-34:** run 38246050138 en verde (12:23 UTC); no comprobado en el sitio publicado (red bloqueada desde este entorno).
- **Validación:** `npm run verify` en verde, salida 0: `npm test` **5888/5888** (+17: 10 del motor —capa sugerida, lectura del mes en tres capas, ingresos con certeza y los tres márgenes, frases, banda de lo probable, normalización de lo declarado, chip, entradas vacías y orden, pureza—, 6 de la pantalla en aislado y 1 de cableado), lint, typecheck, accesibilidad, rendimiento, build, privacidad y smoke. e2e **93/93** (+6: la demo en octubre cuadra con el plan —comprometido 2.980 €, probable 1.750 €, margen 270 €—; un ingreso incierto cambia la lectura pero no la previsión y sobrevive a recargar; la capa de una partida mueve el tramo y conserva el foco; la banda sale de tres meses cerrados con real; 390 y 1280 px sin que nada se salga de la tarjeta). axe **77/77** (+2, claro y oscuro). perf-screens 3/3. Puerta de carga: mediana **3210 ms** (presupuesto 5000).
- **Pendiente del hogar:** **declarar la certeza de los ingresos que no son seguros** (paga extra, variable, devolución de la Renta, alquiler del local) y decir si el margen «esperado» sirve; anotar los reales de cada mes. Siguen: cerrar octubre y leer su carta (1-3/11), la revisión base cero en enero, subir un extracto real (WP-51), anotar unos días e importar su extracto (WP-53), valorar la cartera, declarar la TAE de cada contrato, la muestra del CSV del bróker, revisar el mapa de pagos, **proponer 5 personas antes del 15/12 para WP-54 (H-13)** y el cronómetro del iPhone (H1).

## Cierre de sesión — 12 de octubre de 2026 (306, decimosexto PR): WP-34 · revisión base cero del plan (motor, pantalla y pruebas; ninguna revisión hecha con datos reales)

- **Qué se hizo:** en **Plan › Partidas**, tarjeta plegable «Revisión base cero del plan: N de M partidas revisadas» (`base-cero-ui.js`, `base-cero.css`; motor puro `canonical-zero-base.js`; almacén `zero-base-data` **en la copia y la nube**; diseño en `docs/WP34_DISENO.md`; sección nueva en el manual). **Una partida por pantalla**, de la que más pesa (suma de lo previsto en 12 meses) a la que menos, con una frase de evidencia, la tabla de reales por mes y **Mantener · Ajustar a X € al mes · Quitar · Saltar**. Cada decisión se guarda al momento (guardado parcial), con su fecha, y **la marca vale un año**; «Ya revisadas» con «Revisar de nuevo».
- **Decisión que hay que mirar primero: esta pantalla NO escribe en el plan.** «Ajustar» y «Quitar» **preparan** el cambio en el borrador que ya usa Plan › Partidas (`cuadroMandosStageCell`, `handlePartidasDeleteRow`) y lo aplica el **«Guardar» de siempre** (con «Descartar»); la tarjeta enseña los cambios preparados con sus dos botones. Los meses pasados no se tocan. **Tras guardar un borrado no hay «deshacer»** (el flujo de Partidas no lo tiene).
- **Reglas del motor (con prueba):** «ajustar a lo real» solo con **≥ 3 meses con real**, cifra única = **mediana** (un mes raro de 2.500 € no manda; la media sí lo arrastraría), redondeada al euro, hueco **≥ 10 % y ≥ 10 €**, y solo si la partida vale **lo mismo todos los meses por venir** (un pago anual no se aplana); «¿sigue existiendo?» solo si no tiene ningún real en ≥ 3 meses en los que sí se anotaron otras partidas; las partidas que **manda otra cosa** (fórmula del gasto variable, asignación personal, escenario, fila de tarjeta, refinanciación con calendario) **solo se pueden mantener** y se dice quién las manda; sin importe previsto y sin ningún real no entra en la cola (en la demo, 21 de 29 son filas de financiación a 0). Un real de 0 cuenta como real. Empates por nombre, no por orden de entrada.
- **Desviaciones del plan:** (1) la marca va en un **almacén propio, no en `customPlanningRows`** ni en una migración del contrato de estado: casi ninguna partida es `customPlanningRows` (vienen de los datos base) y WP-08/09/24 ya eligieron almacenes aparte por riesgo; (2) **«12 meses de real» son los meses del plan ya pasados, hasta 12** (la demo, desde julio de 2026, tiene 6 en enero) **y solo hay real si se anotó: en enero habrá, como mucho, octubre-diciembre**, así que la revisión de enero saldrá sobre todo «mantener» salvo que se anoten los reales antes (la tarjeta lo dice); (3) umbrales míos; (4) el bloqueo por deuda usa `adjustedDebtPlannedValue`, que solo conoce una refinanciación: **otras filas de deuda no se bloquean**; (5) un **ingreso** que nadie anota también sale con «¿sigue existiendo?».
- **Defectos encontrados al probar (corregidos):** la tabla genérica pide 1.120 px de ancho mínimo y empujaba el contenido fuera de la pantalla del móvil (el mismo de WP-53; el e2e de desborde de página no lo veía porque el contenedor lo recortaba: **ahora el e2e mira que ningún elemento de dentro se salga de la tarjeta**); **axe** pilló un salto de encabezados (h4 tras h2): ahora h3; y mi prueba usaba un hueco del 7,7 % que, con razón, no proponía ajuste. `tsc` pilló un tipo de JSDoc (`today` obligatorio con valor por defecto `{}`).
- **Por qué «en curso» (50 %):** el criterio del plan es **cada partida revisada con fecha, y se usa en enero** (H-17, 29/1/2027, ≈ 15 min): nadie la ha hecho con datos reales. El 50 % sobrepuntúa: ≈ 0,75 de 1,5 sesiones. Paquete con novedad (`2026-10-12-wp34`).
- **Estado del plan:** avance ponderado **59,6 %** (82,6 de 138,5 sesiones; Ola 3 al **46 %**). 21 paquetes hechos. `canonical-*.js`: **109** (ARQ-3, con consumidor real: `renderActiveSection` de `app.js` pasa el motor a `renderBaseCero`). `app.js` **37.447** de 37.495 (+2: la llamada al pintar Partidas y el almacén en la copia; margen 48).
- **WP-29 (decimoquinto PR):** PR #492 fusionado (eff5a8c) con el CI en verde; despliegue de Pages en curso al escribir esto.
- **Validación:** `npm run verify` en verde, salida 0: `npm test` **5871/5871** (+19: 10 del motor —propuesta por mediana y umbrales, partida que cambia de mes, partidas bloqueadas, «¿sigue existiendo?», cola y orden, marca de un año, almacén, evidencia y resumen, determinismo y pureza—, 8 de la pantalla en aislado y 1 de cableado), lint, typecheck, accesibilidad, rendimiento, build, privacidad y smoke. e2e **87/87** (+6: sin reales y «Mantener» que sobrevive a recargar; «Ajustar» prepara y solo «Guardar» aplica —36 meses a 868 €, los pasados intactos—; «Quitar» prepara, «Descartar» deja la partida y «Guardar» la quita; partidas bloqueadas; 390 y 1280 px sin que nada se salga de la tarjeta). axe **75/75** (+2, claro y oscuro: con propuesta y con cambios preparados y revisadas desplegadas). perf-screens 3/3. Puerta de carga: mediana **3347 ms** (presupuesto 5000).
- **Pendiente del hogar:** **anotar los reales de cada mes** (Registrar › Reales del mes o importar el extracto) para que la revisión de enero pueda proponer algo; hacer la revisión en enero (≈ 15 min) y decir qué umbrales sobran o faltan. Siguen: cerrar octubre y leer su carta (1-3/11), subir un extracto real (WP-51), anotar unos días e importar su extracto (WP-53), valorar la cartera, declarar la TAE de cada contrato, la muestra del CSV del bróker, revisar el mapa de pagos, **proponer 5 personas antes del 15/12 para WP-54 (H-13)** y el cronómetro del iPhone (H1).

## Cierre de sesión — 12 de octubre de 2026 (306, decimoquinto PR): WP-29 · carta del mes (motor, pantalla y pruebas; ninguna carta leída con datos reales)

- **Qué se hizo:** la **carta del mes** del plan (NHG-05): un párrafo de **≤ 120 palabras** en **Cierre** con cinco huecos —resultado frente a lo previsto, mayor desviación, un hito, una acción y cuánto del mes es real—. Motor puro `canonical-month-letter.js` (plantillas y selectores, **sin IA**: la misma entrada da el mismo texto; sin DOM, red, almacenamiento ni reloj) y pantalla `carta-mes-ui.js` + `carta-mes.css` (tarjeta «Carta de <mes>» en Cierre). **Mes abierto: borrador** con los datos de hoy; **al firmar, la carta se guarda** con los datos de aquel momento (almacén `month-letters`, ≤ 36, **en la copia y la nube**) y **no se reescribe** si los datos cambian; un cierre firmado **antes** de la carta enseña una **reconstruida y lo dice** (pintar no escribe nada); «Cartas anteriores» y «Copiar la carta». Reabrir un mes invalida su carta vieja hasta volver a firmarlo. Diseño en `docs/WP29_DISENO.md`; sección nueva en el manual y paso nuevo en «Cierre mensual».
- **Reglas del motor (con prueba):** resultado = ingresos − gastos con lo que cuenta cada partida (el real si lo hay; una cancelada cuenta 0), dicho en euros enteros a la española y **con palabras, no con signos**; **mayor desviación** solo si se aparta **≥ 25 € y ≥ 5 %** de la partida y tiene real (empates por nombre, no por orden), con **«% de la diferencia» solo si va en el mismo sentido y no la supera**; **hito** en este orden: racha de ≥ 3 cierres seguidos igual o mejor que lo previsto (mes a mes, sin huecos), máximo del patrimonio (≥ 3 fotos), deuda que baja ≥ 50 €, patrimonio que sube (que baje **no** es un hito); **acción**: la misma partida en contra dos cierres seguidos, partidas sin real o déficit; **calidad del dato: nunca se omite** y con < 70 % del importe en real añade «Tómala con cautela». Si no cabe en 120 palabras se recorta primero el hito, luego la acción, luego el detalle: el resultado y la calidad se quedan (300 casos con semilla fija, ninguno pasa de 120).
- **Hallazgos al leerlo (lo que cambia el diseño del plan):** (1) **nadie ha dicho qué quiere que diga la carta**: la decisión D3 sigue sin contestar y lo único firme es que las dos personas la piden (P11); el contenido es **mi lectura**. (2) La **«causa» de PVX5 no existe como dato**: PVX5 explica la composición de la previsión, no por qué se gastó más; la carta **atribuye** (dónde y cuánto de la diferencia) y no inventa un motivo. (3) **El «calidad del dato (WP-10)» del plan no encaja**: WP-10 mide el horizonte de previsión; la carta habla de un mes cerrado y usa **cuánto del mes es real** (partidas con real y su peso en importe). (4) **Sin ningún real, «resultado frente a previsión» era una tautología**: lo vi en la demo («Octubre cierra con 270 €, tal como se preveía» con 0 de 8 partidas con real). Ahora dice «no tiene ningún real anotado: el margen que sale, 270 €, es solo el previsto».
- **Desviaciones (la que hay que mirar primero: ninguna carta leída con datos reales):** los umbrales (25 €, 5 %, 1 €, 3 cierres, 50 €, 70 %) son **míos**; **sin hitos de objetivos (E15) ni de «deuda a cero»** (no hay historia de la que sacarlos); **no va a Hoy** (congelado hasta H-02), **ni al PDF del cierre, ni a un enlace o correo** (solo se ve y se copia); el hogar con muy pocos reales anotados obtendrá cartas que dicen sobre todo «anota los reales».
- **Por qué «en curso» (50 %):** el criterio del plan es **la carta del cierre de diciembre** (3/1/2027) y nadie del hogar ha leído una. El 50 % sobrepuntúa: ≈ 1,25 de 2,5 sesiones. Paquete con novedad (`2026-10-12-wp29`).
- **Estado del plan:** avance ponderado **59,1 %** (81,85 de 138,5 sesiones; Ola 3 al **45 %**). 21 paquetes hechos. `canonical-*.js`: **108** (ARQ-3, con consumidor real: `renderCierre`, de `views/cierre.js`, pasa el motor a `renderCartaMes`). `app.js` **37.445** de 37.495 (+2: la llamada al firmar y el almacén en la copia; margen 50).
- **Validación:** `npm run verify` en verde, salida 0: `npm test` **5852/5852** (+26: 17 del motor —cinco huecos y su orden, determinismo y empates, sin ningún real, umbrales, hito y racha, acción, calidad, 120 palabras con 300 casos, **cada cifra del texto sale de la entrada**, euros a la española, cartas guardadas, motor puro—, 8 de la pantalla en aislado y 1 de cableado con `app.js`, `index.html`, el service worker, el build y las novedades), lint, typecheck, accesibilidad, rendimiento, build, privacidad y smoke. e2e **81/81** (+5: borrador honesto sin reales y con reales, firmar y que no se reescriba, reconstruida y copiar, 390 y 1280 px sin desborde). axe **73/73** (+2, claro y oscuro: borrador y firmada con «Cartas anteriores»; la primera pasada falló **por mi prueba**, que no firmaba septiembre y la carta de un mes no firmado ya no se lista: corregida). perf-screens 3/3. Puerta de carga: mediana **2627 ms** (presupuesto 5000).
- **Pendiente del hogar:** al **cerrar octubre (1-3/11)**, leer la carta (se guarda al firmar; saldrá con muchas partidas sin real si no se anotan antes) y decir **qué sobra, qué falta y si el tono sirve**; **anotar los reales del mes antes de firmar**. Siguen: subir un extracto real (WP-51), anotar unos días e importar su extracto (WP-53), valorar la cartera, declarar la TAE de cada contrato, la muestra del CSV del bróker, revisar el mapa de pagos, **proponer 5 personas antes del 15/12 para WP-54 (H-13)** y el cronómetro del iPhone (H1).

## Cierre de sesión — 12 de octubre de 2026 (306, decimocuarto PR): WP-54 · kit de la prueba con 5 personas ajenas (protocolo; ninguna ronda hecha)

- **Qué se hizo y qué no:** WP-54 es un **proceso** (una prueba por trimestre desde diciembre con 5 personas ajenas y la demo sintética). **No se ha hecho ninguna ronda y no puedo hacerla**: lo entregado es el kit. `docs/WP54_PRUEBA_USABILIDAD.md`: para qué sirve y para qué no, reglas no negociables (solo la demo sintética, ventana privada, consentimiento de viva voz, no se graba sin aceptación expresa, quien dirige no ayuda ni defiende el diseño, notas sin datos personales), perfiles de las 5 personas, preparación (ensayo, ronda 0), **guion de 30 minutos con 5 tareas** (Hoy; anotar un gasto; cargar el extracto; deuda; fin de mes) con enunciado literal sin nombrar pantallas, criterio de fin, respuesta esperada y qué se observa, pistas por niveles, hoja de observación (A/B/C, segundos, errores, camino, cita, SEQ 1-7), regla de ≥ 3 de 5, gravedad y paso al backlog con evidencia (§13 de `BACKLOG_DEFINITIVO.md`, vacía a propósito), limitaciones y calendario. `tools/build-usability-extract.mjs`: genera el **extracto ficticio** de la tarea 3 con fechas relativas a hoy (12 movimientos, todo «FICTICIO», sin IBAN), con **una fila que empareja con el gasto de la tarea 2** (Mercadona, 23,40) y **una trampa** (otra fila de 23,40 de una farmacia).
- **Lo que hice con la demo (ensayo de quien diseña, no es un resultado de usabilidad):** comprobé en el navegador que las cinco tareas **se pueden hacer** y qué responde la demo hoy (capacidad libre real 447,50 €, reserva 7.230,00 €; deuda pendiente 12.000,00 €, fin en septiembre de 2029 y «cada 100 € más: 13 meses menos y 177,71 € menos de intereses»; punto delicado el 1/10). Las respuestas esperadas **caducan** (la demo es relativa a la fecha): el protocolo manda reescribirlas en cada ensayo.
- **Hallazgos al ensayar (ninguno corregido; no es lo pedido):** (1) **la demo no tiene tarjetas**: la tarea 2 prueba la ventana de siempre, no la hoja de WP-30 (la que mide M-CAPT ≤ 8 s); (2) **riesgo previsible R-1:** la demo muestra «Libre de deuda sept 29» en Hoy y «Libre de deuda: sin fecha estimable · sin cuota activa» en la cabecera de la ruta junto a «Libre de las deudas con cuota septiembre de 2029»; es coherente (una deuda no tiene cuota activa) pero **una persona nueva puede leerlo como contradicción**; no lo toco (Hoy sigue congelado hasta H-02) y la prueba servirá para ver si importa.
- **Desviación del plan:** el plan decía «datos de demostración» sin más. Se ha concretado que **la demo pública tiene solo datos sintéticos** (ya lo dice el manual), así que la prueba no necesita nunca datos del hogar; y que **la persona que diseña no debería dirigir la sesión** (tiende a ayudar sin querer): se propone que dirija otra persona del hogar y quien diseña observe sin hablar.
- **Por qué NO se marca «en curso» al 50 %** (a diferencia de WP-36 a WP-53): un protocolo no es un resultado; el paquete es la ronda. Sigue como «Continuo» al **0 %**: **el avance del plan no cambia (58,2 %, 80,6/138,5)**. Marcarlo al 50 % habría subido el avance unas décimas sin haber visto a una sola persona.
- **Pruebas:** `tests/wp54-prueba-usuarios.test.cjs` (10): el extracto es determinista y relativo a hoy; se lee entero con el importador (12 movimientos, saldo que cuadra, miles con punto); la pareja de la tarea 3 sale como el guion promete (Mercadona «alta», la farmacia no; con otro concepto «media»; con un día de diferencia sigue); no lleva nada que parezca real; el guion tiene 5 tareas completas y **sus enunciados no nombran pantallas**; los 30 minutos suman; las reglas de privacidad y ayuda están; **el documento no inventa resultados**; las tareas apuntan a sitios que existen; ESTADO y backlog enlazan el kit. e2e (1): el guion se puede hacer en la demo a 390 px (T1 a T5; la tarea 3 propone solo la pareja de Mercadona).
- **Estado del plan:** avance ponderado **58,2 %** (sin cambios). `canonical-*.js`: 107 (sin cambios). `app.js` 37.443 (sin cambios). Paquete exento: sin pantalla ni novedad.
- **Validación:** `npm run verify` en verde, salida 0: `npm test` **5826/5826** (+10 de WP-54), lint, typecheck, accesibilidad, rendimiento, build, privacidad y smoke. e2e **76/76** (+1). **No se repitieron axe, perf-screens ni la puerta de carga: el paquete no toca ninguna pantalla ni código de la app** (solo `docs/`, `tools/`, `BACKLOG_DEFINITIVO.md` y pruebas); el CI los ejecuta igualmente.
- **Pendiente del hogar (H-13):** **proponer 5 personas antes del 15/12/2026** (y una más para la ronda 0), con los perfiles del §3 del protocolo; **decidir quién dirige la sesión**; opcional, **cronometrar la carga de «Hoy» en un iPhone (3 veces)** aprovechando la sesión (H1). Siguen: subir un extracto real, anotar unos días e importar su extracto (WP-53), cerrar octubre (1-3/11), valorar la cartera, declarar la TAE de cada contrato, la muestra del CSV del bróker y decidir si teclea el índice de la vivienda cada trimestre.

## Cierre de sesión — 11 de octubre de 2026 (305, decimotercer PR): WP-53 · sin duplicados entre lo anotado a mano y el extracto (datos inventados; ningún extracto real)

- **Qué se hizo:** motor puro `canonical-capture-dedupe.js` (importe **exacto al céntimo y con el mismo signo**, **±2 días**, comercio por similitud —sin acentos, sin el ruido de banco («compra», «tarj.», cifras, «SA»), con prefijos de 4+ letras y «un nombre dentro de otro»—, y **una captura con una fila**: asignación determinista, dos cafés iguales no se funden) y su pantalla `captura-duplicados-ui.js` + `captura-duplicados.css`. En el **paso 3 de Importar extracto**, la fila con pareja se enseña lado a lado con **por qué se propone** y **qué se conserva**, y se decide con «Es la misma compra» / «Son distintas». **Manda el extracto**: captura rápida o ticket → se quita lo anotado y se queda la fila del banco; partida de «Registrar gasto» → la fila del banco se asigna a esa partida (regla «solo este movimiento») y su real pasa a ser lo que dice el banco, sin sumarse aparte. Todo dentro del lote reversible. «Registrar gasto» y el enlace sin tarjetas dejan un registro nuevo (`capture-log`: fecha, importe, concepto, cuándo se anotó; va en la copia).
- **Hallazgos al leer el código (lo que cambia el diseño del plan):** (1) el paso 3 ya existía y **«Es duplicado» descartaba la fila del banco y conservaba la captura**: lo contrario de «el extracto manda»; (2) el doble conteo real era el de **«Registrar gasto»/enlace sin tarjetas**, que crea una partida **sin fecha** (el «riesgo de fondo» que dejó WP-25) y no podía emparejarse con nada; (3) **la hoja de WP-30 no deja movimientos**: la tarjeta liquida en un cargo único, así que **no se empareja fila a fila** (lo cubre la conciliación); (4) **defecto anterior a este paquete, corregido:** «Deshacer último lote» **no quitaba las reglas aprendidas en ese lote**, porque el «antes» guardaba la referencia de `movementMappings` y las reglas se añadían en el mismo objeto. Ahora se copia justo después de la foto (`datosImportarApply`); comprobado en el navegador (1 asignación tras deshacer antes, 0 después).
- **Defecto propio encontrado por el e2e a 390 px:** la tabla genérica pide 1.120 px y el botón «Es la misma compra» quedaba **fuera de la pantalla** del móvil. La fila de captura es ahora una tarjeta (`colspan`, rejilla con `min-width: 0`) y la tabla del paso 3 pierde el ancho mínimo solo cuando hay una pareja. Medido: tabla 358 px en un contenedor de 358 px.
- **Desviaciones (la que hay que mirar primero: ningún extracto real):** la similitud se calibró con nombres inventados y el umbral 0,5 es mío; **no se empareja por importe aproximado** (una propina o un redondeo dejan la captura sin pareja); **las capturas anteriores a este paquete no tienen registro** y no se emparejan; **una partida solo se empareja con una fila de su mes**; la **vista previa del paso 4 no refleja la asignación de la partida** (el resultado final sí); el **paso 2 pide clasificar antes** de que el 3 asigne; una fila sin pareja con una captura del mismo importe a 3-7 días sigue saliendo como el candidato de siempre (descarta la fila del banco: comportamiento anterior, no peor); **no avisa al capturar** («esto ya está en el extracto»); el «<48 h» del panel de uso **sigue sin medir** (los cargos de tarjeta llegan agregados y no invento un porcentaje).
- **Por qué «en curso» (50 %):** falta un extracto real con capturas reales; el éxito («cero duplicados que el hogar tenga que adivinar») no se puede afirmar. El 50 % sobrepuntúa: ≈ 1,25 de 2,5 sesiones. Paquete con novedad (`2026-10-11-wp53`) y sección nueva en el manual.
- **Estado del plan:** avance ponderado **58,2 %** (80,6 de 138,5 sesiones; Ola 3 al 43 %). 21 paquetes hechos. `canonical-*.js`: **107** (ARQ-3, con consumidor real: `datosImportarBuildRows` y la restauración del borrador, en `app.js`, pasan el motor a `capturaDuplicadosAnotar`). `app.js` **37.443** de 37.495 (margen 52).
- **Validación:** `npm run verify` en verde, salida 0: `npm test` **5816/5816** (+20: 13 del motor y 7 de la pantalla en aislado y del cableado con `app.js`, `index.html`, el service worker y el build; adaptadas `flu2-atajo-registrar-gasto` y `v4-4-importar-extracto`, que ahora ven el registro y el emparejamiento), lint, typecheck, accesibilidad, rendimiento, build, privacidad y smoke. e2e **75/75** (+3: captura rápida con «misma» y deshacer a 390 px sin desbordar; partida de «Registrar gasto» con «misma», real igual al extracto y deshacer quita la asignación a 1280 px; «Son distintas» conserva las dos), axe **71/71** (+2, claro y oscuro, con el candidato sin decidir), perf-screens **3/3**. Carga mediana **4294–4795 ms** con los cambios y **3992–5324 ms** sin ellos, en la misma máquina y en tandas seguidas: el ruido de la máquina es mayor que cualquier efecto de 2 scripts nuevos (presupuesto 5000; en esta máquina la puerta ronda el límite sin los cambios).
- **WP-52, resultado de su primera ejecución real (CI del PR #489):** el paso informativo corrió y **WebKit arrancó, registró el service worker y pintó «Hoy» en las 3 visitas con 0 errores de página**; «Hoy con contenido» en visita repetida, sin estrangular y en la misma máquina: **Chromium 608 ms, WebKit 958 ms (×1,58)**. Una sola ejecución en una máquina compartida: no es un iPhone. PR #489 fusionado (eac25af); despliegue de Pages en verde (run 38142498979, 13:41 UTC).
- **Pendiente del hogar:** además de lo de WP-51 (subir un extracto real), **anotar unos días con «Registrar gasto» o la captura rápida y luego importar el extracto de ese periodo**, y decir qué parejas propone el paso 3 y cuáles le parecen raras. Siguen: cerrar octubre desde la app (1-3/11), valorar la cartera, declarar la TAE de cada contrato, la muestra del CSV del bróker, revisar el mapa de pagos y decidir si teclea el índice de la vivienda cada trimestre.

## Cierre de sesión — 11 de octubre de 2026 (305, duodécimo PR): WP-52 · medición de carga también con WebKit (informativa; WebKit sin ejecutar en el entorno)

- **Qué se hizo:** `tools/measure-load.mjs` acepta `--engine=chromium` (por defecto: la medición y la **puerta de 5000 ms de siempre, sin cambios**), `--engine=webkit` y `--engine=compare` (Chromium y WebKit **sin estrangular**, tres visitas repetidas cada uno, y la **razón WebKit/Chromium** en la misma máquina; atajo `npm run measure:load-webkit`). La lógica pura (opciones y su validación, plan de estrangulamiento por motor, mediana, razón, veredicto) está en `tools/measure-load-core.mjs`, con 9 pruebas (`tests/wp52-medicion-webkit.test.cjs`). **WebKit falla solo por excepciones de página sin capturar o por «Hoy» sin pintar, nunca por lentitud**; lo que WebKit no mide (`layout-shift`, `longtask`) sale `null`, no 0. Cada fila lleva ahora `serviceWorker` y `erroresPagina`. Un paso nuevo de `pages.yml`, tras la puerta de carga y antes de preparar el despliegue, instala WebKit y ejecuta `measure:load-webkit` con **`continue-on-error: true`**: no puede bloquear la publicación. Diseño en `docs/WP52_DISENO.md`.
- **Desviación (la que hay que mirar primero):** el plan decía que WebKit es «mucho más cercano» a un iPhone. **No en tiempo**: el WebKit de Playwright **no tiene CDP**, no se puede frenar CPU ni red, así que sus tiempos son los de la máquina del CI y **no son los de un iPhone** (ni el WebKit de Playwright en Linux es el Safari de iOS). Da **compatibilidad** (¿arranca y pinta sin excepciones en un motor que no es Chromium?) y una razón frente a Chromium, **no la cifra de la hipótesis H1** (4,5 s repetida). Para H1 solo vale un cronómetro en el teléfono.
- **Lo que no he podido hacer:** **ejecutar WebKit ni una vez** (el contenedor solo trae Chromium y no se instalan navegadores). Lo no probado: el arranque con el perfil `iPhone 13`, el `PerformanceObserver` sin `layout-shift`/`longtask` (protegido con `supportedEntryTypes`) y si el service worker funciona en ese WebKit. Probado aquí: el camino de Chromium sin estrangular (`compare` corre y da ~1 s frente a ~4 s estrangulado), el mensaje de error cuando WebKit no está instalado y la puerta de siempre (mediana 4292 ms). **Su primera ejecución real es la del CI de este PR; leeré su registro antes de dar el paquete por bueno.**
- **Pruebas antiguas adaptadas:** `ola-rend-2-carga-honesta.test.cjs` miraba el texto fuente de `measure-load.mjs`; al mover la lógica al núcleo se apuntó al sitio nuevo (mismo contrato: CPU 4 por defecto, mediana, mensajes de la puerta, fallo sin medida válida). No se relajó ninguna aserción.
- **Por qué «en curso» (50 %):** falta una ejecución real de WebKit, decidir si el paso pasa a puerta (solo excepciones de página, no tiempo) y la medida real en el teléfono. El 50 % sobrepuntúa: ≈ 0,75 de 1,5 sesiones. Paquete exento: no hay pantalla ni novedad.
- **Estado del plan:** avance ponderado **57,3 %** (79,35 de 138,5 sesiones; Ola 3 al 42 %). 21 paquetes hechos. `canonical-*.js`: 106 (sin cambios). `app.js` 37.438 de 37.495 (sin cambios).
- **Validación:** `npm run verify` en verde, salida 0: `npm test` **5796/5796** (+9 de WP-52), lint, typecheck, accesibilidad, rendimiento, build, privacidad y smoke. Puerta de carga de Chromium: mediana **4542 ms** (presupuesto 5000; 4292 en la ejecución anterior, ruido de la máquina). **No se han repetido e2e ni axe: este paquete no toca código de la app, solo `tools/`, `package.json` y `pages.yml`** (el CI los ejecuta igualmente). WebKit: **sin ejecutar** (ver arriba).
- **Despliegue de WP-51:** PR #488 fusionado (ba28ef7) con el CI en verde; despliegue de Pages en curso al escribir esto.

## Cierre de sesión — 11 de octubre de 2026 (305, undécimo PR): WP-51 · perfiles de extracto con autodetección (CSV; ningún extracto real probado)

- **Qué se hizo:** el importador de **Registrar › Importar extracto** ya no exige cabeceras «Fecha / Movimiento / Importe / Saldo» en la primera fila para un CSV/TXT. Motor puro `canonical-statement-profiles.js` (codificación UTF-8/UTF-16/Windows-1252; separador **por consistencia entre filas**, con comillas; decimal coma/punto con miles; orden de fechas; **fila de cabecera** saltando títulos; **papel de cada columna**, incluidas debe/haber y columna D/H; filas con error con **número de línea y motivo**; **saldo como auditor del signo**; perfiles con nombre por firma de cabecera; diagnóstico sin datos) y panel «Cómo he leído este fichero» (`extracto-perfiles-ui.js`, `extracto-perfiles.css`; almacén `statement-profiles-data` **en la copia**; diseño en `docs/WP51_DISENO.md`). `parseMovementsFromCsvText` y `movementCsvHeaderKey` salen de `app.js` (−25 líneas netas); queda `movementsFromStatementRows`.
- **Defectos del parser anterior que se corrigen:** el separador se elegía **fila a fila** (un concepto con comas en un fichero de punto y coma partía la fila); una fila ilegible se **descartaba en silencio**; un importe como «abc12» se leía como 12 (quitaba las letras).
- **Desviación (la que hay que mirar primero):** **no hay ningún extracto real probado**. El corpus es el **hogar sintético de WP-33** escrito en seis formatos, y el criterio de éxito («cero extractos rechazados sin explicación») solo se mide con el fichero del banco del hogar. Además: **sin perfiles «de banco» preinstalados** (el plan los pedía por banco; no conozco el formato real de ninguno y no lo invento), **sin Cuaderno 43** y **el Excel no cambia**.
- **Decisiones mías, a cuestionar:** las filas ilegibles **no bloquean el paso 2** (se listan y se avisa; el hogar con prisa puede importar un extracto al que le faltan filas); orden día/mes por defecto cuando nada decide (con aviso); la lista de cabeceras reconocidas es mía y no está contrastada con ningún banco; una «C» suelta en la columna de signo es un error de fila (unos bancos la usan para cargo y otros para crédito); un perfil se reconoce por la firma **exacta** de la cabecera; el panel va cerrado cuando no hay nada que avisar y se queda abierto tras corregir algo; corregir la lectura rehace la sesión del paso 1 (descarta la entrada de la bandeja anterior y conserva la cuenta elegida).
- **Reglas del motor, con prueba (21):** formato de siempre intacto; título antes de la cabecera; separador por consistencia; formato inglés; fechas día/mes frente a mes/día (lo decide un valor imposible; si no, aviso); «1.234» ambiguo avisado y corregible; importes estrictos; debe/haber y D/H; codificaciones; comillas con saltos de línea y numeración de la línea física; saldo auditor del signo (ascendente, descendente, invertido sin corregir, no cuadra); sin cabecera falla con motivo y se rescata a mano; cabeceras de otros nombres; perfiles (firma, precedencia, límite 12); diagnóstico sin contenido; **seis formatos del hogar sintético de WP-33 idénticos al libro original**; pureza (sin DOM, red, almacenamiento, reloj ni azar; sin banco inventado); cableado.
- **Por qué «en curso» (50 %):** falta probarlo con un extracto real, Cuaderno 43 y, si se prefiere, bloquear el paso 2 con filas ilegibles. El 50 % infrapuntúa lo hecho en CSV pero sobrepuntúa lo comprobado: ≈ 1,25 de 2,5 sesiones. **WP-33 gana su segundo consumidor** (WP-08 y WP-51); le falta solo la banda de WP-16.
- **Estado del plan:** avance ponderado **56,8 %** (78,6 de 138,5 sesiones; Ola 3 al 41 %). 21 paquetes hechos. `canonical-*.js`: 106 (ARQ-3, con consumidor real en `handleDatosImportarFile`, que pasa el motor a `extractoPerfilesLeer`). `app.js` **37.438** de 37.495 (margen 57).
- **Validación:** `npm run verify` en verde, salida 0: `npm test` **5787/5787** (+21 de WP-51), lint, typecheck, accesibilidad, rendimiento, build, privacidad y smoke. Además: e2e **72/72** (+2: fichero con título y fechas ambiguas que se corrige, se guarda como perfil y se reconoce al volver, con diagnóstico sin contenido y deshacer; y sin cabecera que falla con motivo y se rescata indicando las columnas, con la fila rota listada, sin desbordar a 390 y 1280 px), axe + perf-screens **72/72** (+2, claro y oscuro; **axe encontró dos defectos propios que se corrigieron antes de publicar**: los selectores de papel de columna sin nombre accesible y un salto de h3 a h5), carga mediana **4013 ms** (presupuesto 5000), desbordamiento móvil: solo los 4 avisos de siempre de `label.faqs-search`. Revisado con capturas a 1280 y 390 px. Las pruebas antiguas de `v4-4` y `r8` se adaptaron al motor nuevo (no se relajó ninguna aserción de comportamiento).
- **Despliegue de WP-50:** run 38135470527 en verde (11:48 UTC); no comprobado en el sitio publicado (red bloqueada desde este entorno).
- **Pendiente del hogar:** **subir un extracto real** (su CSV) a Registrar › Importar extracto y decir qué dice el panel; si hay avisos o filas sin leer, **copiar el diagnóstico** (no lleva datos). Siguen: cerrar octubre desde la app (1-3/11), valorar la cartera, declarar la TAE de cada contrato, la muestra del CSV del bróker, revisar el mapa de pagos con su plan real y decidir si teclea el índice de la vivienda cada trimestre.

## Cierre de sesión — 11 de octubre de 2026 (305, décimo PR): WP-50 · vivienda y local por índice (con el índice tecleado por el hogar: sin descarga automática)

- **Qué se hizo:** tarjeta «Vivienda y local por índice» en **Inversión › Cartera**, sobre el patrimonio neto (`indice-vivienda-ui.js`, `indice-vivienda.css`; motor puro `canonical-index-valuation.js`; almacén `housing-index-data` **en la copia**; diseño en `docs/WP50_DISENO.md`). El hogar **teclea series de índice** (hasta 6, por trimestre); por cada activo «inmueble», **valor declarado × índice del último trimestre ÷ el del trimestre de la declaración**, con el chip «estimado por índice · T2 2026», la diferencia y una frase; **avisa de que envejece** a más de dos trimestres. **Interruptor por inmueble, apagado por defecto**: solo activado, la estimación sustituye al valor declarado **al leer** (`assetsEffectiveList`) en el patrimonio de A14 (`a14NetWorthToday`), en la tarjeta de patrimonio de WP-46 (que lo dice) y en la exposición a vivienda (IVX8). **El valor declarado no se modifica ni se guarda otro.** El **LTV** (contratos de Deuda con «hipoteca» ÷ suma de inmuebles) sale con el valor declarado y con el estimado. `app.js` gana una línea (+1: el almacén en `BACKUP_LOCAL_STORES`); el resto son dos sustituciones de `assetsList()` por `assetsEffectiveList()`.
- **Desviación grande (la que hay que mirar primero):** **no hay descarga automática del índice**, que era el sentido de la propuesta («nadie actualiza el valor a mano»). Desde el entorno **no hay salida hacia el INE**: **no he podido verificar la fuente ni el CORS** que el plan pedía verificar. Y el plan prohíbe cualquier conexión externa sin la revisión de WP-05 (`NTC06_AMENAZAS.md`), que se decide el 16/10. Meter datos del INE fijados en el código tampoco: no podría verificarlos y un índice inventado es peor que ninguno. **El resultado sigue siendo trabajo manual** (un número por serie y trimestre): si el hogar no va a teclearlo, el paquete no sirve y toca esperar a WP-05.
- **Otras decisiones mías, a cuestionar:** el interruptor apagado por defecto (la propuesta pedía que «alimente» el patrimonio sin más); **la foto de patrimonio que WP-46 congela al firmar un cierre guarda el valor activo y no marca si era estimado** (una serie con la estimación a veces activada tiene saltos que no son del mercado); la hipoteca se detecta por la palabra «hipoteca» y se compara con **todos** los inmuebles juntos (no se sabe qué hipoteca es de cuál); **el índice de vivienda no vale tal cual para un local**; el texto de la fuente («IPV del INE por comunidad autónoma») es de memoria y va marcado «a verificar».
- **Reglas del motor, con prueba (12):** oro con cifras a mano (300.000 € en T2 2025 con índice 165 → 327.272,73 € con 180; 200.000 € con 150 → 240.000 €; índice a la baja); **sin el índice del trimestre de la declaración no se inventa nada** (ni se interpola ni se usa el trimestre más cercano) y sin trimestre posterior se queda lo declarado; sin valor, sin fecha o sin serie, igual; **un valor ausente no es cero**; almacén normalizado sin romper, alta/edición/baja con validación (quitar una serie desvincula); `effectiveAssets` solo toca inmuebles con la estimación activada y calculable, sin modificar la entrada; LTV (una hipoteca pagada es 0 % real; deuda desconocida, no calculable); propiedad con 300 casos; motor puro.
- **Por qué «en curso» (50 %):** falta justo lo que daba valor (la descarga), y el resto de lo pendiente: marcar en la foto del patrimonio si lleva estimaciones, LTV por inmueble, índice propio para locales, recordatorio trimestral. El 50 % **sobrepuntúa**: ≈ 0,75 de 1,5 sesiones.
- **Estado del plan:** avance ponderado **55,8 %** (77,35 de 138,5 sesiones; Ola 3 al 39 %). 21 paquetes hechos. `canonical-*.js`: 105 (ARQ-3, con consumidor real en `renderInversionCartera`, vía `views/inversion.js`). `app.js` 37.463 de 37.495 (+1; margen 32).
- **Validación:** `npm run verify` en verde, salida 0: `npm test` **5766/5766** (+12 de WP-50), lint, typecheck, accesibilidad, rendimiento, build, privacidad y smoke. Además: e2e **70/70** (+1: vacío, validación de series y puntos, estimación con su chip y el LTV con los dos valores, sin índice del trimestre no se inventa nada, el interruptor mueve el patrimonio sin tocar lo declarado, deshacer, persistencia, sin confirm() ni desbordar a 1280 y 390 px), axe + perf-screens **70/70** (+2, claro y oscuro). **Un test antiguo (IVX8) ejecuta `ivx8HousingExposure` en un entorno simulado**: se le añadió `assetsEffectiveList` al simulacro (cambio de dependencia legítimo). Carga: mediana **3.851–4.531 ms** (tope 5.000), **más alta que en WP-49 (2.224 ms) pero igual sin mis cambios en la misma máquina (4.192 ms)**: ruido de la máquina, no regresión; queda más cerca del tope. `test:mobile-overflow` local: solo `label.faqs-search`, ya marcado en `main`. Revisada además con capturas a 1280 y 390 px. **Una primera pasada de axe falló 36 pruebas por ejecutarse a la vez que el e2e (mismo servidor y carpeta de resultados); en solitario, 70/70.**

## Cierre de sesión — 11 de octubre de 2026 (305, noveno PR): WP-49 · mapa anual de pagos grandes (sin financiación «por sobre»: los sobres no son fondos de pagos)

- **Qué se hizo:** tarjeta «Mapa anual de pagos grandes» en **Plan › Previsión**, bajo el puente de previsión (`mapa-pagos-ui.js`, `mapa-pagos.css`; motor puro `canonical-large-payments.js`; **sin almacén**: solo lee y pinta; diseño en `docs/WP49_DISENO.md`). **12 meses en rejilla de múltiplos pequeños** con los pagos que caen de golpe: **partidas del plan** (llegan al mínimo y pesan ≥ 2,5 × la mediana de su propia partida; se excluyen financiaciones y gasto variable), **seguros** en cada aniversario (proyectados al año siguiente y marcados «estimado» si la renovación declarada ya pasó), **objetivos con fecha** (el fondo de emergencia queda fuera) y la **Renta** (sin importe). Cada pago lleva una barra (ancho = coste frente al más caro; lleno = reservado) y su estado en **texto + icono + patrón**; tocar un pago abre el detalle. Resumen: suman, reservado, falta, **apartar al mes**, vence ya; frase y «Ver como tabla». El mínimo («300 / 500 / 1.000 / 2.000 €») vale solo en la sesión. `app.js` gana una línea (+1), en `renderPlanPrevision`.
- **Hallazgo que cambia el paquete:** el plan decía «financiación por **sobre**» y **los sobres de la app no son fondos de pagos grandes**: son el sobrante mensual de cada partida de gasto variable (Fase 6, P-14/P-15). No existe en ningún sitio «dinero guardado para el IBI». **Solo los objetivos tienen dinero reservado declarado**; el resto sale «sin reserva asignada», no «0 % financiado» (sería inventarlo). Financiar cada pago de verdad exige un concepto nuevo (fondo por pago) que es **decisión del hogar** y tocaría el cierre: no lo he construido.
- **Otra desviación:** `financialCalendar` se reutiliza **solo para la Renta**. Coloca un seguro únicamente si su renovación cae exactamente en ese mes (pasada la fecha, no vuelve a salir hasta editarla); un mapa a 12 meses necesita el aniversario, y los objetivos necesitan lo ahorrado, que el calendario no trae.
- **Reglas del motor, con prueba (11):** mediana (cuota fija ≠ pago grande; tres plazos, un pico de 320 € sobre 100 € y una partida de un solo mes, sí; cambiar de nivel, no); seguros (futuro declarado / proyectado estimado / sin proyectar hacia atrás / 29 de febrero / sin prima ≠ cero); objetivos (reservado ≤ coste, vencido se coloca en el primer mes, pausa y completo fuera); un pago en el plan y en un seguro se cuenta una vez; **caso de oro a mano** (8 pagos, 16.130 €, 9.700 € reservados = 60 %, los tres meses más cargados 88 %, 1.102,50 €/mes por apartar, 2.700 € que vencen ya); porcentaje hacia abajo; propiedad con 200 hogares al azar; entrada congelada; motor puro.
- **Por qué «en curso» (50 %) y lo que hay que cuestionar:** los umbrales (300 € y 2,5 × la mediana) **son míos y no están calibrados con datos reales**; **lo que no está en el plan, en un seguro o en un objetivo no existe en el mapa**; «apartar al mes» es lineal y no se compara con la capacidad de ahorro (con seis pagos próximos sale ≈ 1.875 €/mes); no cuenta lo ahorrado en posiciones de cartera vinculadas a un objetivo; no se puede ocultar un falso positivo (no hay almacén); la Renta sale siempre sin importe. El 50 % **sobrepuntúa**: ≈ 1,25 de 2,5 sesiones.
- **Estado del plan:** avance ponderado **55,3 %** (76,6 de 138,5 sesiones; Ola 3 al 38 %). 21 paquetes hechos. `canonical-*.js`: 104 (ARQ-3, con consumidor real en `renderPlanPrevision`). `app.js` 37.462 de 37.495 (+1; margen 33).
- **Validación:** `npm run verify` en verde, salida 0: `npm test` **5754/5754** (+11 de WP-49), lint, typecheck, accesibilidad, rendimiento, build, privacidad y smoke. Además: e2e **69/69** (+1: solo la Renta sin importe, datos sembrados relativos a hoy, seguro y plan contados una vez, objetivo «Reservado 40 %», fondo de emergencia fuera, seguro pequeño y seguro sin fecha, detalle con «apartar al mes», mínimo que filtra y conserva el detalle abierto y el foco, tabla, nada guardado, sin confirm() ni desbordar a 1280 y 390 px), axe + perf-screens **68/68** (+2: claro y oscuro con todos los estados). Carga: mediana 2.224 ms (tope 5.000). `test:mobile-overflow` local: solo `label.faqs-search`, ya marcado en `main`. Revisada además a ojo con capturas a 1280 y 390 px.

## Cierre de sesión — 10 de octubre de 2026 (305, octavo PR): WP-48 · libro de operaciones editable con «antes / después» (sin importador: falta la muestra del bróker)

- **Qué se hizo:** tarjeta «Libro de operaciones» en **Inversión › Cartera**, junto al formulario de ventas (`operaciones-ui.js`, `operaciones.css`; motor puro `canonical-portfolio-ledger.js`; **sin almacén nuevo**: las posiciones se guardan donde ya vivían; diseño en `docs/WP48_DISENO.md`). Antes solo se podía **añadir** una aportación o una venta; corregir una mal escrita obligaba a borrar la posición. Ahora se **edita, quita o añade** cada operación (la compra inicial se edita, no se quita) y, **antes de guardar, se enseña qué cambia**: unidades y coste que quedan, plusvalía de cada venta afectada y **la compensación de cada ejercicio tocado** (con las demás posiciones y las pérdidas arrastradas, la misma `yearEndCompensation` de FC3). Nada se guarda sin pulsar «Guardar»; se deshace. Una venta que se queda sin lotes **se marca y no se bloquea**. El FIFO **no se reimplementa**: lo calcula `canonical-portfolio.js`. `app.js` gana una línea (+1), en `renderIv1PositionList`.
- **Fallo hallado y corregido (también en WP-47, ya fusionado):** la prueba de navegador destapó que un importe escrito como «14.000» se leía como **14** (`parseAmount`). En el libro habría dado una plusvalía de −12.386 € en lugar de 1.600 €. Ahora los importes escritos usan el lector es-ES de la app (`parseAmountField`: «14.000» son catorce mil). **La hoja de reparto de la nómina (WP-47) tenía el mismo fallo** con importes sin decimales («2.000» → 2): corregido aquí, con una prueba de navegador de regresión.
- **Reglas del motor, con prueba (17):** oro con cifras a mano (lote 1: 100 u a 10.000 €; lote 2: 50 u a 6.000 €; venta de 120 u por 15.000 € → plusvalía 2.600 €, quedan 30 u a 3.600 €): cambiar el importe de la venta, mover una compra a después de la venta (20 u sin lote, plusvalía y ejercicio «no calculables»), quitarla, añadir otra venta, **mover una venta de ejercicio (cambia el orden FIFO y toca los dos ejercicios; el total realizado no cambia)**, compensación con otra posición y pérdidas arrastradas; propiedad con 150 posiciones al azar (el coste se conserva; **editar y devolver el valor deja la posición idéntica**); validación; avisos (compra inicial sin fecha, aportación sin unidades, venta sin importe, **recompra en los dos meses siguientes: solo avisa**); motor puro.
- **Dónde se aparta del plan (lo más importante):** **no hay importador del CSV del bróker** —es la mitad del paquete— porque el formato sale de una muestra que el hogar no ha mandado y un importador que adivina columnas puede corromper en silencio las cifras fiscales. Las «pruebas de oro con FIN-2» son pruebas propias del libro; FIN-2 no se ha tocado.
- **Por qué «en curso» (50 %) y lo que hay que cuestionar:** **toca las cifras fiscales del hogar** (ventas, plusvalías, compensación y Renta); **el FIFO es por posición, no por valor** (el mismo valor repartido en dos posiciones se trata por separado, a diferencia del FIFO fiscal real); **no hay campo de comisiones** (el formulario pide el importe recibido neto y el de compra con comisiones); **la norma de no recompra solo avisa y solo de compras posteriores**; no bloquear una venta sin lotes facilita corregir en dos pasos pero permite guardar una plusvalía no calculable. El 50 % **sobrepuntúa**: ≈ 1,5 de 5 sesiones.
- **Estado del plan:** avance ponderado **54,4 %** (75,35 de 138,5 sesiones; Ola 3 al 37 %). 21 paquetes hechos. `canonical-*.js`: 103 (ARQ-3, con consumidor real en `renderIv1PositionList`). `app.js` 37.461 de 37.495 (+1; margen 34).
- **Validación:** `npm run verify` en verde, salida 0: `npm test` **5743/5743** (+17 de WP-48 y la comprobación de lector en WP-47), lint, typecheck, accesibilidad, rendimiento, build, privacidad y smoke. Además: e2e **68/68** (+1: vacío, libro en orden, edición con antes/después sin guardar y con plusvalía en la lista de posiciones, venta sin lotes marcada y no bloqueada, validación, quitar, añadir, deshacer, persistencia, compra inicial sin fecha, otra posición en la compensación, sin confirm() ni desbordar), axe + perf-screens **66/66** (+2). Carga: mediana 2.484 ms (tope 5.000). `test:mobile-overflow` local: solo `label.faqs-search`, ya marcado en `main`; la tarjeta con contenido, medida aparte a 360 y 768 px sin desbordar. **Un test antiguo (i12) miraba una ventana fija de 2.200 caracteres de `renderIv1PositionList`**: se acortó la línea de enganche, no el test.

## Cierre de sesión — 10 de octubre de 2026 (305, séptimo PR): WP-47 · reparto de la nómina (la demo no tiene ninguna nómina: sale vacía; y no hay aviso al confirmar)

- **Qué se hizo:** tarjeta «Repartir la nómina» en **Deuda › Comparar**, bajo la escalera del próximo euro (`nomina-ui.js`, `nomina.css`; motor puro `canonical-payroll-split.js`; almacén `payroll-split-drafts` en la copia; diseño en `docs/WP47_DISENO.md`). Parte de las **nóminas con real registrado** (nombre con «nómina», «salario» o «sueldo»), calcula **lo que cabe sin que la liquidez baje del suelo** (el menor entre la nómina y la holgura en el P10 de la banda de caja de WP-16; «sin comprobar» si no se puede calcular) y reparte según la escalera de WP-42 con **steppers −50/+50 e importe editable** que mueven dinero entre una fila y «sin repartir»: el total no cambia, no hay negativos y cada fila respeta su tope (saldo de la deuda, límite de la pensión). **«Aplicar» guarda un borrador con la lista de transferencias** y una casilla «hecha»; **no mueve dinero, no anota movimientos ni toca el real de la nómina** (una prueba de navegador lo comprueba). Aplicar, descartar y apartar se deshacen. `app.js` gana la clave del almacén y una llamada (+2); `canonical-cash-band.js` gana `minimum.valueP10` (aditivo).
- **Fallo propio encontrado y corregido antes de publicar:** con dos nóminas (Javi y Tere) el segundo reparto habría ofrecido otra vez la misma holgura que el primero ya apuntó. **Lo apuntado en borradores abiertos y aún no reflejado en los saldos declarados se descuenta de la holgura** (prueba unitaria y de navegador).
- **Reglas del motor, con prueba (21):** disponible = menor entre nómina y holgura; sin holgura calculable, «sin comprobar»; propiedad (300 movimientos aleatorios × 4 importes: total al céntimo, sin negativos, sin pasar del tope); la suma de las filas no pasa del disponible; sin rentabilidad esperada, lo que sobra queda sin repartir; reconocimiento de la nómina por nombre; motor puro.
- **Dónde se aparta del plan (lo más importante):** **no hay aviso al confirmar la nómina** (la confirmación vive en Hoy, congelado hasta H-02, y no guarda cuándo se confirmó): hay que abrir la pantalla. «Borrador» lo he interpretado como el reparto guardado, sin movimientos contables; sin destino por transferencia ni reparto por titular; todas las nóminas del mes cuentan como un solo bote.
- **Por qué «en curso» (50 %) y lo que hay que cuestionar:** **una hoja prerrellenada convierte en acción lo que en WP-42 era una explicación**: con el tipo marginal sacado de la retención de la nómina, la escalera manda dinero a la pensión antes de invertir y la hoja lo deja a un toque; los umbrales de WP-42 siguen sin calibrar. La holgura vale lo que valga la banda (solo fechas, 30 días, saldos a menudo calculados). **La demo no tiene ninguna partida de nómina: nada se ha visto con datos reales.**
- **Estado del plan:** avance ponderado **52,6 %** (72,85 de 138,5 sesiones; Ola 3 al 34 %). 21 paquetes hechos. `canonical-*.js`: 102 (ARQ-3, con consumidor real en el case «deuda-comparar»). `app.js` 37.460 de 37.495 (+2; margen 35).
- **Validación:** `npm run verify` en verde, salida 0: `npm test` **5726/5726** (+21), lint, typecheck, accesibilidad, rendimiento, build, privacidad y smoke. Además: e2e **67/67** (+1: vacío, disponible limitado por el suelo, steppers, topes, restablecer, aplicar sin tocar cuentas, «hecha» tras recargar, descartar y apartar con deshacer, segunda nómina, sin comprobar, sin confirm() ni desbordar), axe + perf-screens **64/64** (+2). Carga: mediana 2.720 ms (tope 5.000). `test:mobile-overflow` local: solo `label.faqs-search`, ya marcado en `main`; la tarjeta, con contenido, medida aparte a 360 y 768 px sin desbordar.

## Cierre de sesión — 10 de octubre de 2026 (305, sexto PR): WP-46 · patrimonio neto, serie y proyección (la serie no existe todavía: nace en el cierre de octubre)

- **Qué se hizo:** tarjeta «Patrimonio neto: serie y proyección» en **Inversión › Cartera**, sobre la de calma y cobertura (`patrimonio-ui.js`, `patrimonio.css`; motor puro `canonical-net-worth.js`; almacén `net-worth-data` con las fotos y los supuestos, en la copia; diseño en `docs/WP46_DISENO.md`). **(1) Hoy:** efectivo en cuentas + cartera + vivienda, local y otros activos − deuda pendiente, con cada componente y, aparte, lo que **no** se suma (activos tipo cuenta, inversión o pensión: ya están en saldos y cartera, sumarlos sería contarlos dos veces). **(2) Serie:** en cada cierre firmado se guarda una foto con el efectivo real del cierre; con ≥ 3 fotos completas aparece el gráfico (kit de WP-28, tabla equivalente) y «de dónde viene el último cambio». **(3) Proyección a 10 años** en tres escenarios (prudente, central, optimista) con abanico y hitos (deuda cero, patrimonio no negativo, objetivo tecleado); los rendimientos y revalorizaciones **los teclea el hogar**. No cambia ningún dato (A11-4). `app.js` gana la clave del almacén y una llamada en el cierre (+2); el otro enganche va en `views/inversion.js`.
- **Reglas del motor, con prueba (12):** dato ausente no es cero (sin los cuatro componentes no hay neto y se nombra lo que falta); < 3 fotos completas no es serie; **sin rendimiento declarado no se inventa uno** (0 % y se dice); la proyección cuadra con la aritmética mes a mes; la deuda sin calendario no amortiza y por eso no se puede anunciar «deuda cero» mientras exista; el abanico se abre con el tiempo; el movimiento entre fotos suma exactamente el cambio.
- **Dónde se aparta del plan:** el plan pedía una serie mensual reconstruida; **no hay historia que reconstruir** (la deuda solo se guardaba en el último cierre, vivienda y local solo tienen valor actual), así que la serie **nace en el primer cierre firmado y tarda 3 cierres** (enero). Faltan además los hitos de GOB11 y ahorro, y la edad del dato de cada componente.
- **Por qué «en curso» (50 %) y la salvedad que importa:** hoy **no hay ninguna foto**; la proyección solo es tan buena como los tres rendimientos que teclee el hogar (sin ellos coinciden los tres escenarios). Con 5 sesiones estimadas, el 50 % **sobrepuntúa** el paquete (≈ 1/5 de verdad hecho): se declara.
- **Estado del plan:** avance ponderado **51,7 %** (71,6 de 138,5 sesiones; Ola 3 al 33 %). 21 paquetes hechos. `canonical-*.js`: 101 (ARQ-3, con consumidor real en `renderInversionCartera`). `app.js` 37.458 de 37.495 (+2; margen 37).
- **Validación:** `npm run verify` en verde, salida 0, sobre la rama ya rebasada en `main`: `npm test` **5705/5705** (+12), lint, typecheck, accesibilidad, rendimiento, build, privacidad y smoke. Además: e2e **66/66** (+1), axe + perf-screens **62/62** (+2). Carga: mediana 3.317 ms (tope 5.000). `test:mobile-overflow` local: solo `label.faqs-search`, ya marcado en `main` con el Chromium local.

## Cierre de sesión — 10 de octubre de 2026 (305, quinto PR): WP-45 · frescura por fuente y cola de tareas de datos (con un modelo mío y tiempos casi todos supuestos)

- **Qué se hizo:** tarjeta «Frescura de tus datos y qué hacer primero» al final de **Registrar › Saldos**, bajo el pulso (`datos-ui.js`, `datos.css`; motor puro `canonical-data-queue.js`; **no guarda nada**; diseño en `docs/WP45_DISENO.md`). **Seis fichas de frescura** con edad, icono y texto (saldos, último movimiento importado, valoración de la cartera, índices, último cierre, cobros y cargos esperados sin responder) y una **cola ordenada por incertidumbre que quita por minuto que cuesta**, con el plan «con 3 minutos hoy». Lo no estimable (cartera, índices) va aparte con su motivo; las tareas con plazo (cerrar el mes, días 1-3) no se ordenan por euros. Nunca hace una tarea (A11-4): son enlaces. `app.js` solo gana una llamada dentro de `renderRegistrar()` (+1).
- **Hallazgo de diseño: el plan daba por hecha una pieza que no existe.** Decía que la sensibilidad «ya se calcula» en `canonical-forecast-sensitivity.js`; ese motor dice qué caída de ingresos o subida de gasto rompería un veredicto de caja, **no cuánto se mueve una cifra por un dato viejo**. El modelo es **gasto diario medio de la previsión × días sin actualizar, con tope de 30**: mío, rotulado «puede moverse hasta».
- **Hallazgo de colocación:** `#update-hub` («Actualizar mis datos») **ya no es una pantalla**: su hash redirige a Registrar › Saldos. La primera versión dejó la tarjeta ahí y era **invisible**; lo detectó la prueba de navegador. Va en Registrar › Saldos, bajo el pulso.
- **Reglas del motor, con prueba (12):** lo no estimable nunca lleva un euro inventado; el tiempo es la mediana medida con ≥ 3 usos o un supuesto marcado «sin medir»; dos tareas que resuelven lo mismo no suman dos veces (por familia, la mayor; importar el extracto absorbe el pulso solo si quita más); «hoy mismo» es 0 € posibles, no un hueco.
- **Por qué «en curso» (50 %):** **el orden lo decide el tiempo supuesto** (solo el pulso de saldos y la hoja de valoración tienen tiempo medido; importar el extracto, 2 min, y responder cobros, 10 s, son supuestos míos); solo **tres tareas tienen euro estimable** (la «cola» es casi una lista); faltan el presupuesto semanal, los saldos por cuenta y estimar cartera e índices; el éxito del plan («80 % del error atribuible a datos viejos con ≤ 5 min/semana») **no se puede medir**.
- **Estado del plan:** avance ponderado **49,9 %** (69,1 de 138,5 sesiones; Ola 3 al 30 %). 21 paquetes hechos. `canonical-*.js`: 100 (ARQ-3, con consumidor real en `renderRegistrar`). `app.js` 37.456 de 37.495 (+1; margen 39).
- **Validación:** `npm run verify` en verde, salida 0: `npm test` **5693/5693** (+12), lint, typecheck, accesibilidad, rendimiento, build, privacidad y smoke. Además: e2e **65/65** (+1: seis fichas, cola por euros por minuto, tiempo medido o supuesto, lo no estimable aparte, plazo de cierre, sin guardar nada, sin confirm() ni desbordar), axe + perf-screens **60/60** (+2). Carga: mediana 3.775 ms (tope 5.000). `test:mobile-overflow` local: solo `label.faqs-search`, ya marcado en `main` con el Chromium local. Una prueba (R-2) fija la forma exacta de `case "registrar"` y obligó a mover la llamada dentro de `renderRegistrar()`.

## Cierre de sesión — 10 de octubre de 2026 (305, cuarto PR): WP-44 · calma, cobertura y exposición (tres lecturas; hoy casi no enseña nada)

- **Qué se hizo:** tarjeta «Calma, cobertura y exposición» en **Inversión › Cartera**, bajo la valoración (`calma-ui.js`, `calma.css`; motor puro `canonical-calm-coverage.js`; almacén `calm-coverage-inputs` con la tasa de retirada y los titulares, en la copia; diseño en `docs/WP44_DISENO.md`). **(1) Caída desde el máximo medida en mercado** (sin contar aportaciones ni ventas; ≥ 3 valoraciones de toda la cartera; en € y en meses de aportación; lo que dice la política firmada para el nivel 20 %/35 %; aportado frente a valor). **(2) Qué parte del gasto pagan los activos:** alquiler neto declarado + retirada sostenible de la cartera líquida (fondos, acciones, ETF), sobre el gasto medio de los próximos 12 meses; los dividendos **no** se suman aparte (doble cuenta). **(3) Depósitos por entidad** frente a 100.000 € por titular, con los titulares que teclea el hogar. No hay botones de vender ni comprar. `app.js` solo gana la clave del almacén (+1); el enganche va en `views/inversion.js`.
- **Reglas del motor, con prueba (12):** una aportación no es una subida y una venta no es una caída (se acumula la variación de valor menos las aportaciones netas fechadas); solo se usan fechas con la cartera completa; dato ausente no suma y se nombra (sin tasa, sin alquiler, sin titulares); una tasa > 15 % no se suma; motor puro.
- **Dónde se aparta del plan:** **no hay «cuánto tardaron en recuperarse caídas parecidas»** (no tengo una serie histórica verificada; inventarla sería falsear justo el dato que tranquiliza), ni fondos y seguros por entidad (las posiciones no guardan la entidad), ni evolución de la cobertura ni fecha de los hitos, ni cambio de la primera pantalla de Inversión.
- **Por qué «en curso» (50 %) y la salvedad que importa:** hoy hay **0 valoraciones** (sin 3 no hay caída), ninguna tasa de retirada declarada y unos 10.000 € de liquidez frente a un límite de 100.000 €: **casi no enseña nada**. Su valor depende de que haya cartera valorada y patrimonio que proteger; construirlo ahora es una apuesta sobre el futuro.
- **Estado del plan:** avance ponderado **48,6 %** (67,4 de 138,5 sesiones; Ola 3 al 28 %). 21 paquetes hechos. `canonical-*.js`: 99 (ARQ-3, con consumidor real en `renderInversionCartera`). `app.js` 37.455 de 37.495 (+1; margen 40).
- **Validación:** `npm run verify` en verde, salida 0: `npm test` **5681/5681** (+12), lint, typecheck, accesibilidad, rendimiento, build, privacidad y smoke. Además: e2e **64/64** (+1: sin serie, caída en mercado y no una aportación, cobertura con lo declarado, depósitos con titulares, validación, persistencia, sin tocar la cartera, sin confirm() ni desbordar), axe + perf-screens **58/58** (+2). Carga: mediana 3.539 ms (tope 5.000). `test:mobile-overflow` local: solo `label.faqs-search`, ya marcado en `main` con el Chromium local; la tarjeta nueva no aparece.

## Cierre de sesión — 10 de octubre de 2026 (305, tercer PR): WP-43 · puente de previsión (congelado y cascada hechos; sin mercado ni partidas por barra)

- **Qué se hizo:** tarjeta «Puente de previsión: por qué cambió el fin de año» en **Plan › Previsión**, bajo el plan B (`puente-ui.js`, `puente.css`; motor puro `canonical-forecast-bridge.js`; almacén `forecast-bridge-snapshots` en la copia; diseño en `docs/WP43_DISENO.md`). **En cada cierre firmado se congela la previsión de liquidez a 31/12** (por mes: ingresos, gasto recurrente, extraordinarios y deuda) junto con el **real del mes cerrado**. Con dos cierres del mismo año, una **cascada de cinco barras** (ingresos, gasto recurrente, extraordinarios, deuda y financiaciones, otros y supuestos), una frase («Desde septiembre, el fin de 2026 empeora en X €: 77 % por extraordinarios…»), tabla equivalente y «comparar con otro cierre». Reutiliza las barras de A-4 (`analisisCascadaHtml`). No modifica la previsión (una prueba comprueba su huella). `app.js` gana la clave del almacén y dos llamadas (+3).
- **Reglas del motor, con prueba (14):** la cascada **cuadra siempre** con la diferencia total y lo no atribuible va a «Otros y supuestos», visible; sin el real del mes cerrado esa parte entera va a «Otros» con aviso; dos fines de año distintos no se comparan; entre cierres no consecutivos se avisa; la frase nombra las causas ≥ 15 % y agrupa el resto; el color de la barra sigue su efecto, no el tipo de partida; **no hay barra de «mercado»** (la previsión de liquidez no proyecta la cartera).
- **Defectos hallados al verla en pantalla, corregidos:** «empeora en -1300 €» (doble negativo); barras en verde para un ingreso que baja; **el verde `is-positivo` de A-4 da 3,49 : 1 en claro** (axe): en esta tarjeta las cifras van en tinta. **Ese fallo previo de Análisis sigue ahí** (ninguna prueba axe recorre valores positivos de A-4).
- **Por qué «en curso» (50 %):** faltan la barra de mercado (WP-46), el toque en una barra → partidas y el aviso en Cierre/Hoy; y **no se ha visto con un cierre real**: el primer puente es el de diciembre (cierres de octubre y noviembre), y solo si se firman desde la app con sesión (sin cierre no hay foto y no avisa).
- **Estado del plan:** avance ponderado **47,4 %** (65,6 de 138,5 sesiones; Ola 3 al 26 %). 21 paquetes hechos. `canonical-*.js`: 98 (ARQ-3, con consumidor real en `renderPlanPrevision`). `app.js` 37.454 de 37.495 (+3; margen 41).
- **Validación:** `npm run verify` en verde, salida 0: `npm test` **5669/5669** (+14), lint, typecheck, accesibilidad, rendimiento, build, privacidad y smoke. Además: e2e **63/63** (+1: vacío, congela la previsión real y coincide con diciembre, falta un segundo cierre, cascada, comparar con otro cierre, tabla, huella de la previsión intacta, en escritorio y móvil sin `confirm()` ni desbordar), axe + perf-screens **56/56** (+2: la tarjeta en todos sus estados, claro y oscuro). Carga: mediana 3.245 ms (tope 5.000). `test:mobile-overflow` local: solo `label.faqs-search` de `#faqs-ayuda`, que ya marcaba en `main` con el Chromium local; la tarjeta nueva no aparece.

## Cierre de sesión — 10 de octubre de 2026 (305, segundo PR): WP-42 · escalera del próximo euro (cuatro peldaños, sin fondos traspasables ni liquidez ociosa)

- **Qué se hizo:** tarjeta «¿Dónde va el próximo euro?» al principio de **Deuda › Comparar** (`escalera-ui.js`, `escalera.css`; motor puro `canonical-next-euro.js`; almacén `next-euro-inputs` en la copia; diseño en `docs/WP42_DISENO.md`). Reparte un importe en el orden del plan: **colchón** hasta su suelo → **deuda con coste alto** (la más cara primero, tras la deducción fiscal) → **plan de pensiones** (solo si el tipo marginal lo justifica y hasta el límite) → **lo que sobra**, por **aportaciones sin vender** hacia lo que está por debajo del objetivo. Cada peldaño con su porqué y su liquidez; **tres beneficios por separado y sin sumar** (intereses que dejas de pagar, ahorro fiscal de una vez, rentabilidad esperada). Nunca mueve dinero (A11-4). `app.js` gana la clave del almacén y una llamada (+2).
- **Reglas del motor, con prueba (18):** dato ausente no es cero (sin liquidez o suelo, el colchón dice «sin datos» y el reparto es parcial; **una deuda sin TAE se aparta y se nombra, no se da por gratis**; un 0 % declarado sí es un coste conocido); sin rentabilidad esperada, lo que sobra queda «sin reparto», nunca un 50/50; invertir solo gana a amortizar con 2 puntos más netos; el orden del plan no se reordena en silencio (se avisa si la pensión ahorra más que lo que cuesta la deuda); el reparto suma el importe sin perder céntimos; motor puro, sin reloj.
- **Hallazgo al probar con los datos reales de la app (no con los de la prueba):** los contratos (también los de la demo) **no traen TAE** y la mayoría de la deuda está suspendida o reunificada. La primera versión decía «no hay deudas con interés» con unos 12.000 € de deuda en Contratos. Ahora se pasan todas las deudas con saldo: TAE declarada tras deducción, o la **implícita en la cuota y los plazos** (marcada como estimación) si el contrato está al corriente, o «sin interés declarado». También salió que `Number(null)` es 0: un saldo ausente se leía como saldo cero; corregido y cubierto por e2e.
- **Por qué «en curso» (50 %) y no «hecho», y la salvedad:** faltan los **fondos traspasables** y el comparador de **liquidez ociosa** (NIN-08), cruzar con la política firmada (WP-39) y el plan B (WP-38), y el aviso en Cierre/Hoy; nada se ha probado con datos reales del hogar. **El 50 % es la regla del plan, pero sobrevalora lo hecho:** para un paquete de 7 sesiones he invertido una; contado a prorrata el avance sería algo menor que el publicado.
- **Decisiones mías, sin calibrar con el hogar:** 2 puntos de prima por riesgo, 6 % como «coste alto» sin rentabilidad con la que comparar, 30 % de tipo marginal mínimo para la pensión. El tipo marginal sale de la **retención** declarada (no es el tipo marginal real); el límite de aportación (1.500 €) sale de una tabla de una sola fila (2022) y no cuenta el margen de empresa; no se descuenta la comisión de amortización anticipada.
- **Estado del plan:** avance ponderado **46,5 %** (64,4 de 138,5 sesiones; Ola 3 al 24 %). 21 paquetes hechos. `canonical-*.js`: 97 (ARQ-3, con consumidor real en el case «deuda-comparar»). `app.js` 37.451 de 37.495 (+2; margen 44).
- **Validación:** `npm run verify` en verde, salida 0: `npm test` **5655/5655** (+18), lint, typecheck, accesibilidad, rendimiento, build, privacidad y smoke. Además: e2e **62/62** (+1: vacío, validación, orden de peldaños con su porqué, los tres beneficios, persistencia, sin veredicto sin rentabilidad, reparto parcial sin datos, en escritorio y móvil sin `confirm()` ni desbordar), axe + perf-screens **54/54** (+2: la tarjeta en todos sus estados, claro y oscuro). Carga: mediana 3.369 ms (tope 5.000). `test:mobile-overflow` local: la tarjeta tenía una casilla que heredaba el ancho completo de los campos y se salía a 360 px (detectada y corregida con una prueba); lo único que marca ahora es `label.faqs-search` de `#faqs-ayuda`, que ya marcaba en `main` con el Chromium local y que el CI no marca. Chromium lanzado con `PLAYWRIGHT_CHROMIUM_PATH` por el cambio de versión del entorno.

## Cierre de sesión — 10 de octubre de 2026 (305): WP-41 · deuda en la sombra y TAE real (sin probar con un extracto real)

- **Qué se hizo:** tarjeta «Deuda en la sombra y TAE real» en **Deuda › Contratos**, bajo la conciliación con la CIRBE (`sombra-ui.js`, `sombra.css`; motor puro `canonical-shadow-debt.js`; almacén `shadow-debt-answers` en la copia; diseño en `docs/WP41_DISENO.md`). (1) **Detector** sobre los movimientos importados: cuotas que se comportan como deuda («cuota 3 de 24», «financiación», «a plazos», Klarna/Sequra…), con la evidencia literal, fin solo si el propio extracto lo dice, «Añadir a Contratos» (solo rellena el alta) y «No es deuda» con «Deshacer». (2) **Calculadora de TAE efectiva** (TIR mensual con comisión, seguro y pago final) y «¿contado o financiado?» con la liquidez y el suelo del colchón de la app. Nunca da de alta ni paga (A11-4). `app.js` gana la clave del almacén y una llamada (+2).
- **Reglas del motor, con prueba:** un recurrente sin contador ni palabra de financiación no se marca (sería una suscripción); «cuota» a secas no basta; plazo fijo, depósito, plan de pensiones, hipoteca y préstamo nunca se proponen; tiene que ser mensual (24-38 días); no se repite lo que ya está en Contratos; el capital propuesto es lo que queda por pagar **sin intereses**; extracto de más de 45 días → «no puedo mirar lo reciente», no «no hay nada»; sin precio al contado no hay TAE (dato ausente no es cero).
- **Por qué «en curso» (50 %) y no «hecho»:** el detector solo se ha probado con extractos sintéticos escritos por mí. Los conceptos reales de los bancos del hogar pueden no llevar ninguna de las palabras o contadores que busca (un «FRACC. 3/12» o un «TERM IPHONE» no salen). **No se ha ejecutado sobre un extracto real y la métrica («avisos que sobran») no se puede leer** hasta contestar ≥ 10 avisos. Aviso en Hoy/Cierre: tras H-02.
- **Hallazgo corregido en el camino:** el error de la calculadora usaba el rojo de `is-danger` y daba **3,88 : 1** en oscuro (axe). Ahora lleva tinta + barra lateral roja, como el resto de notas de la tarjeta.
- **Estado del plan:** avance ponderado **43,9 %** (60,9 de 138,5 sesiones; Ola 3 al 20 %). 21 paquetes hechos. `canonical-*.js`: 96 (ARQ-3, con consumidor real en el case «deuda-contratos»). `app.js` 37.449 de 37.495 (+2; margen 46).
- **Validación:** `npm run verify` en verde, salida 0: `npm test` **5637/5637** (+15), lint, typecheck, accesibilidad, rendimiento, build, privacidad y smoke. Además: e2e **61/61** (+1: propuesta con evidencia, añadir a Contratos sin crear nada, descartar y deshacer, calculadora con precio ausente y con oferta «0 %» con comisión, en escritorio y móvil sin `confirm()` ni desbordar), axe + perf-screens **52/52** (+2: la tarjeta en todos sus estados, claro y oscuro). Carga: 3.585, 3.351 y 2.919 ms (tope 5.000; mediana 3.351). El navegador de este entorno cambió de versión de Chromium: las pruebas se lanzaron con `PLAYWRIGHT_CHROMIUM_PATH` apuntando al instalado.
- **`test:mobile-overflow` en local:** sin cambios respecto a `main`: marca `label.faqs-search` de `#faqs-ayuda` a 360 px, con y sin este PR (con el Chromium local, que no es el del CI, que no lo marca); la tarjeta nueva no aparece en el informe. Si el CI lo marcara, es un fallo previo de esa pantalla, no de WP-41.

## Cierre de sesión — 9 de octubre de 2026 (304, sexto PR): WP-40 · conciliación con la CIRBE (sin recordatorio en el calendario)

- **Qué se hizo:** tarjeta «Conciliación con la CIRBE» en **Deuda › Contratos**, bajo la tabla de contratos (`cirbe-ui.js`, `cirbe.css`; motor puro `canonical-cirbe.js`; almacén `cirbe-report` en la copia; diseño en `docs/WP40_DISENO.md`). El hogar **teclea una fila por operación** del informe (fecha del informe, de quién es, entidad, tipo, titularidad, importe dispuesto y vencido) y la app dice, fila a fila, **cuadra / difiere (de cuánto y en qué sentido) / falta en la app**, qué contratos **no salen en el informe**, avales aparte, «vencido» destacado, la edad del informe (al día, «toca pedirlo» a 30 días del año, «más de un año») y «Añadir a Contratos», que **solo rellena el formulario de alta**. No se conecta a la CIRBE y **no escribe en los contratos** (una prueba lo impide). `app.js` gana la clave del almacén y una llamada (+2).
- **Reglas del motor, con prueba:** sin informe o sin fecha no hay conciliación (no dice «todo cuadra»); la misma operación en el informe de las dos personas (cotitulares) cuenta una vez, pero dos titulares individuales no se fusionan; nombres de entidad normalizados («Caixabank, S.A.» = «CaixaBank», «Santander» ⊂ «Santander Consumer Finance»); dos contratos de una entidad se reparten por cercanía de importe; el tipo igual manda y el distinto casa por entidad pero avisa; un contrato liquidado o **reunificado** no se espera en el informe; los avales no se casan con contratos (la app solo guarda una cuota mensual de avales). Se usa `canonicalDebtContractRows()` (incluye el plan reunificado).
- **Por qué «en curso» (50 %) y no «hecho»:** **falta el recordatorio anual en el calendario del móvil** que pide el plan; hoy es un aviso dentro de la tarjeta. Meter un tipo de evento nuevo toca `canonical-reminders.js` (lista de tipos, ajustes, pruebas que fijan las cuentas) y la pantalla de WP-32; es un paquete pequeño y separable, y no lo he mezclado con éste.
- **Supuestos sin verificar, a mirar con el primer informe real:** que cada cotitular ve el **importe total** de la operación (si ve su parte, las conjuntas saldrán «difiere» a la mitad) y que el campo comparable es el «dispuesto»; el umbral de 1.000 € por debajo del cual no se informa es lo que recuerdo; la tolerancia (el mayor de 50 € o el 3 %) es decisión mía; el casado por entidad es laxo a propósito (los dos nombres están en pantalla). No se lee el PDF ni texto pegado: sin muestra real sería inventar un lector. **Ningún informe real está cargado**: la métrica («errores de registro encontrados») no se puede leer.
- **Estado del plan:** avance ponderado **42,7 %** (59,1 de 138,5 sesiones; Ola 3 al 18 %). 21 paquetes hechos. `canonical-*.js`: 95 (ARQ-3, con consumidor real en el case «deuda-contratos» de `renderActiveSection`). `app.js` 37.447 de 37.495 (+2; margen 48).
- **Validación:** `npm run verify` en verde, salida 0: `npm test` **5622/5622**, lint, typecheck, accesibilidad, rendimiento, build, privacidad y smoke. Además: e2e **60/60** (+2: vacío, validación, cuadra/difiere/falta/aval/vencido, «Añadir a Contratos» sin crear nada, persistencia, quitar y borrar con deshacer en escritorio y móvil sin `confirm()` ni desbordar; y la edad del informe), axe + perf-screens **50/50** (+2: la tarjeta en todos sus estados, claro y oscuro). Carga: 2.495, 2.481 y 2.542 ms (tope 5.000). Un primer pase de e2e falló solo porque la lista de filas anotadas estaba dentro del formulario plegado; se sacó fuera.
- **El CI cazó un fallo que `npm run verify` no cubre:** el paso `test:mobile-overflow` (que corre en el CI y no en `verify`) marcó a 768 px un `<select>` de «Titularidad» que ensanchaba su columna de la rejilla del formulario hasta 771 px. Arreglado con `min-width: 0` en las etiquetas y selectores y `minmax(min(170px, 100%), 1fr)`, con una prueba que lo fija. **A partir de ahora, antes de subir una tarjeta nueva, se pasa también `npm run build:site && npm run test:mobile-overflow`.** (En local, ese paso también marca `label.faqs-search` de `#faqs-ayuda` a 360 px; no es de este PR, el CI no lo marca y no se ha tocado.)

## Cierre de sesión — 9 de octubre de 2026 (304, quinto PR): contraste del hover de los botones primarios en oscuro

- **Qué se hizo:** corrección del hallazgo anotado en WP-38. `.e19-btn-primary:hover` usaba `--e19-accent-hover` (#748296 en oscuro) como fondo, **más claro** que el de reposo (#65748b), y con texto blanco daba **3,91 : 1** (mínimo AA 4,5 : 1). Afectaba a **todos** los botones primarios de la app en modo oscuro con el puntero encima. Ahora hay un token propio, `--e19-accent-hover-bg` (claro: #1b2c48, el mismo de siempre; oscuro: #54657e, **5,93 : 1**), y en oscuro el hover **oscurece**, como en claro. `--e19-accent-hover` no se toca (lo fija `t2-acento-navy` en claro y lo usan dos reglas de texto).
- **Prueba, y que falla sin el arreglo:** `tests/a11y-hover-boton-primario.test.cjs` (contraste calculado de los tres bloques de tokens, que en oscuro el hover oscurece y se distingue del reposo, y que la regla usa el token) y una prueba axe con el puntero **encima**, en claro y oscuro (`opt4-axe-accessibility`). Reproducido primero: con la regla antigua axe da `color-contrast 3.9`; con la nueva, pasa.
- **Versión del CSS:** `design-tokens.css?v=20261009hover1` (antes `20261004wp11a1`); se actualizaron las nueve pruebas que fijaban la cadena de versión.
- **Pendiente que no se toca aquí:** `--e19-accent-hover` como color de **texto** en oscuro (#748296 sobre la superficie #1a2226) da 4,13 : 1 en `.e19-forecast .chart-chip` y en el enlace de hover de Registrar/Plan/Cuadro de mandos; ninguna prueba axe lo recorre hoy. Es del mismo origen y conviene medirlo con el puntero encima antes de cambiarlo.
- **Estado del plan:** sin cambios (42,1 %; no es un paquete del plan). `app.js` no se toca.
- **Validación:** `npm run verify` en verde, salida 0: `npm test` **5607/5607** (+6), lint, typecheck, accesibilidad, rendimiento, build, privacidad y smoke. axe + perf-screens **48/48** (+2: el hover del botón primario, en claro y oscuro). Carga: 2.350, 2.287 y 2.424 ms (tope 5.000).

## Cierre de sesión — 9 de octubre de 2026 (304, cuarto PR): WP-39 · política de inversión del hogar (documento, firma y comparación; sin aviso al operar)

- **Qué se hizo:** tarjeta «Política de inversión del hogar» al principio de **Inversión › Rebalanceo** (`politica-ui.js`, `politica.css`; motor puro `canonical-investment-policy.js`; almacén `investment-policy` en la copia; diseño en `docs/WP39_DISENO.md`). Seis preguntas en una pantalla (para qué y para cuándo · reparto y banda · aportación · qué no se compra · qué hacer si cae un 20 % y un 35 % · revisión y firma), con el reparto objetivo y el horizonte ya prerrellenados desde lo declarado; reglas numeradas; firma de dos personas distintas con huella; aviso de revisión a 30 días; **la cartera de hoy frente a la política** (tipos fuera de banda, cripto, préstamo declarado) y **«¿esta operación cumple la política?»**. Nunca opera ni escribe en la cartera o el reparto objetivo (una prueba lo impide). `views/inversion.js` solo gana la llamada; `app.js` solo la clave del almacén (+1).
- **Lo que no se cumple del plan, a la vista:** el plan pide que la app **avise al contradecirla una operación** y que haya **«cero operaciones contrarias sin nota de motivo»**. Hoy la comprobación es **voluntaria** (un botón): al registrar una compra o venta no sale ningún aviso ni se guarda un motivo. Engancharlo a los formularios cambia un flujo que funciona; es el segundo PR natural. **El criterio de éxito no se mide hoy.**
- **Por qué «en curso» (50 %) y no «hecho»:** falta justo lo que convierte el documento en regla vigilada: el aviso al operar y la nota de motivo; «no vender por caídas» pide teclear la caída (la calculará WP-44 con las valoraciones); no se prerrellenan convicción (I12) ni desapalancamiento (LEV11), solo el reparto, el horizonte y la banda.
- **Incoherencia declarada:** la banda de la política **no gobierna** el umbral de 10 puntos de la herramienta de rebalanceo (IV6). Si el hogar pone 5, la tarjeta de la política dirá «fuera de banda» y la de abajo no; la pantalla lo dice. Unificarlo cambia una herramienta existente y queda para un PR con decisión del hogar.
- **Riesgos declarados:** «sin apalancamiento» solo ve el préstamo con la cartera como garantía (una hipoteca o un préstamo personal usados para invertir son invisibles); el horizonte sale del objetivo declarado más lejano, que puede no ser de inversión; la firma son dos nombres tecleados; una política firmada no es una política seguida (no comprueba la aportación real ni avisa sola); el defecto «hablarlo antes de tocar nada» en las caídas es una opinión mía, la menos dañina si se salta la pregunta.
- **Estado del plan:** avance ponderado **42,1 %** (58,4 de 138,5 sesiones; Ola 3 al 17 %). 21 paquetes hechos. `canonical-*.js`: 94 (ARQ-3, con consumidor real en `renderInversionRebalanceo`). `app.js` 37.445 de 37.495 (+1; margen 50).
- **Validación:** `npm run verify` en verde, salida 0: `npm test` **5601/5601**, lint, typecheck, accesibilidad, rendimiento, build, privacidad y smoke. Además: e2e **58/58** (+2: seis preguntas prerrellenas, validaciones, firma, comprobación de operaciones, borrador, borrar y deshacer en escritorio y móvil sin `confirm()` ni desbordar; y cartera fuera de la política con revisión vencida sin tocar la cartera), axe + perf-screens **46/46** (+2: la tarjeta en todos sus estados, claro y oscuro). Carga: 2.670, 2.895 y 2.630 ms (tope 5.000). El hover de los botones primarios en oscuro (3,9:1, ya anotado en WP-38) se sigue midiendo sin el puntero encima.

## Cierre de sesión — 9 de octubre de 2026 (304, tercer PR): WP-38 · plan B acordado en frío (plan completo, sin aviso proactivo)

- **Qué se hizo:** tarjeta «Plan B del hogar» en **Plan › Previsión** (`contingencia-ui.js`, `contingencia.css`; motor puro `canonical-contingency-plan.js`; almacén `contingency-plan` en la copia; diseño en `docs/WP38_DISENO.md`). Asistente de tres pasos (disparador por colchón o cifra con N meses seguidos y horizonte · hasta seis acciones en orden con subir/bajar/quitar y «Deshacer» · firma de dos personas distintas con fecha y huella), vigilancia del disparador («salta», «en vigilancia», «no salta», «incompleto», «sin datos»), efecto de cada paso sumado mes a mes con el paso que ya lo resuelve, y la palanca NPV-09 «¿cuánto aguanta el colchón?» (0-50 % de recorte del gasto variable, sin ingresos). Nunca ejecuta (A11-4). `app.js` solo gana la clave del almacén y una llamada (+2).
- **Hallazgo que cambió el diseño: pausar el ahorro no sube la liquidez total.** El motor suma el ahorro dentro de `totalLiquidity` (la misma cifra que la fila «Colchón»), así que pausarlo solo pasa dinero de la cuenta de ahorro a la corriente. La primera versión lo contaba como dinero liberado y daba por resuelto un plan que no lo estaba; ahora aporta 0 salvo que el hogar marque que ese ahorro sale de la liquidez (fondo o inversión). Hay una prueba que lo fija.
- **Decisiones que se apartan del plan:** (1) **no está en la bandeja de Hoy** (congelado hasta leer H-02); (2) **efecto lineal, no con E13** (E13 solo resta o suma importes enteros; es una estimación y no capta efectos de segundo orden como el tope automático del ahorro); (3) **se evalúa al pintar Plan › Previsión**, no en cada recálculo ni en segundo plano.
- **Por qué «en curso» (50 %) y no «hecho»:** un plan B vale por el aviso a tiempo, y hoy el aviso solo existe si alguien abre esa pestaña. Las vías (aviso en Cierre, bandeja de Hoy tras H-02, recordatorio) están sin hacer. El criterio de éxito («si se dispara, se aplica en < 48 h») no se puede medir sin un plan firmado y un mes malo real.
- **Riesgos declarados:** la firma son dos nombres tecleados en un mismo dispositivo (constancia, no prueba); el umbral «colchón de la app» puede ser solo un mes de gasto si no hay reserva operativa; la palanca usa las salidas medias del plan y supone cero ingresos; con 2 meses seguidos y 6 de horizonte no se ve un bache que empiece dentro de 7.
- **Hallazgo aparte, sin tocar:** el hover de `.e19-btn-primary` en modo oscuro mide 3,9 : 1 (`--e19-accent-hover: #748296`); es del sistema de diseño y `design-tokens.css` lleva versiones fijadas por pruebas. La prueba de este paquete mide sin el puntero encima.
- **Estado del plan:** avance ponderado **41,2 %** (57,1 de 138,5 sesiones; Ola 3 al 15 %). 21 paquetes hechos. `canonical-*.js`: 93 (ARQ-3, con consumidor real en `renderPlanPrevision`). `app.js` 37.444 de 37.495 (+2; margen 51).
- **Validación:** `npm run verify` en verde, salida 0: `npm test` **5591/5591**, lint, typecheck, accesibilidad, rendimiento, build, privacidad y smoke. Además: e2e **56/56** (+2: asistente completo con firma, disparo, persistencia, borrar y deshacer en escritorio y móvil sin `confirm()` ni desbordar; y plan que no salta), axe + perf-screens **44/44** (+2: la tarjeta en todos sus estados, claro y oscuro). Carga: 3.441, 2.870 y 2.911 ms (tope 5.000). Un primer pase de e2e falló una vez por «elemento no estable» mientras se editaba; se corrigió que la pantalla no se repinte sola mientras se edita el asistente y no se ha repetido.

## Cierre de sesión — 9 de octubre de 2026 (304, segundo PR): WP-37 · estados completos y «deshacer» (catálogo y primeras aplicaciones)

- **Qué se hizo:** catálogo vivo en `design-system.html#estados` (seis estados —vacío accionable, cargando con esqueleto, error con causa y salida, sin conexión, dato obsoleto, éxito con «Deshacer»— y la regla «¿deshacer o confirmar?»), `estados.css` y `estados-ui.js` (`estadoHtml` y `renderEstadoVista`). Ningún estado se distingue solo por el color (título en texto, borde de estilo propio, `role` y `aria-busy` según el caso; sin animación con `prefers-reduced-motion`). `docs/WP37_DISENO.md`.
- **Aplicado donde se tocó (no «toda la app»):** (1) **vistas que se descargan bajo demanda** (`renderActiveSection`, +1 línea neta en `app.js`): esqueleto mientras bajan; si fallan, causa + «el resto de la app sigue funcionando» + «Reintentar»; «Sin conexión» aparte; el estado se antepone sin borrar el contenido (antes, una frase sin botón que lo sustituía). (2) **Quitar un contrato de deuda, una hucha o una aportación**: sin `confirm()`; al momento con «Deshacer» (devuelve la hucha en su sitio sin pisar lo tocado entre tanto). (3) **Quitar una nómina (WP-31) o un dato de índice (WP-13)**, que borraban sin aviso, ahora con «Deshacer». (4) Vacío accionable en nóminas («Apuntar la primera») y dato obsoleto en anomalías («Importar el extracto»).
- **Una prueba impide volver a colar un `confirm()` nativo**: solo queda el de consolidar con la reserva bajo el mínimo (decisión de UX1, que el catálogo marca como pendiente de pasar a diálogo propio con la consecuencia en el botón).
- **Riesgo declarado:** «Deshacer» a 10 s no es una confirmación; quien quita un contrato de deuda y no mira el aviso lo pierde a los 10 s. Si el hogar prefiere confirmar en contratos, es volver a un diálogo en ese caso.
- **Por qué «en curso» (50 %) y no «hecho»:** el plan lo define como catálogo + aplicación pantalla a pantalla cuando cada paquete la toque; lo segundo no termina de golpe. Contarlo al 50 % es generoso: hecho el catálogo y cinco aplicaciones, quedan las demás pantallas.
- **Estado del plan:** avance ponderado **39,8 %** (55,1 de 138,5 sesiones; Ola 3 al 13 %). 21 paquetes hechos. `canonical-*.js`: 92 (sin cambios; WP-37 no añade motor). `app.js` 37.442 de 37.495 (+1).
- **Validación:** `npm run verify` en verde, salida 0: `npm test` **5577/5577**, lint, typecheck, accesibilidad, rendimiento, build, privacidad y smoke. Además: e2e **54/54** (+4: vista que tarda/falla/sin conexión/reintento, contrato, hucha y aportación, vacío de nóminas), axe **39/39** (+2: el catálogo en claro y oscuro), perf-screens **3/3**. Carga: 2.829, 2.403 y 2.475 ms (tope 5.000).
- **Se actualizaron tres pruebas antiguas** (`d1-d2-deuda-tabs-contratos`): comprobaban el `confirm()` al quitar un contrato; ahora comprueban que no lo hay, que avisa con «Deshacer» y que deshacer devuelve las tres colecciones.

## Cierre de sesión — 9 de octubre de 2026 (304): WP-36 · anomalías del extracto (primera entrega, fuera de la bandeja de Hoy)

- **Qué se hizo:** detector puro `canonical-statement-anomalies.js` y tarjeta «Cosas raras en tus movimientos» al principio de **Movimientos** (`anomalias-ui.js`, `anomalias.css`; diseño en `docs/WP36_DISENO.md`). Cinco avisos con evidencia, de más a menos graves (máximo seis, y dice cuántos quedan): **recibo devuelto** (con el cargo que devuelve), **posible duplicado**, **comisión** nueva o que sube un 25 %, **cobro mensual sin partida en el plan** e **importe alto** (por encima del P95 de su partida con holgura). Tres respuestas por aviso («es algo real», «es normal», «es normal siempre») con **Deshacer**; de ellas sale la tasa de falsos positivos (con < 10 respuestas dice «todavía no se puede medir»). **Nunca actúa**: comprobado en navegador que el extracto queda igual. Sin extracto de los últimos 45 días dice «No puedo mirar lo reciente» en vez de callar. `app.js` +2 líneas (hook en `case "movements"` y el almacén `statement-anomaly-answers` en la copia).
- **Decisión que se aparta del plan:** el plan decía «a la bandeja»; **no se mete en la bandeja de Hoy** porque Hoy está congelado hasta leer H-02 (hoy, 9/10, el hogar mide la línea base) y avisos nuevos cambiarían lo que Hoy muestra. Llevarlo allí es un adaptador de ≈ 15 líneas cuando se levante la regla. Por eso WP-36 queda **«en curso» (50 %)**, no «hecho».
- **Falsos positivos < 20 %: sin medir, y la cifra sintética flatea.** Con el hogar ficticio de WP-33: se encuentra ≥ 90 % de las anomalías inyectadas y en un hogar limpio salen 4 avisos en 200 hogares (0,02 por hogar y ventana, todos «importe alto»; un primer umbral daba 9 y se apretó). Pero la proporción de falsos depende de cuántas anomalías reales haya: con una cada diez ventanas, esos 0,02 serían ≈ 17 %; con una cada veinte, ≈ 29 %. El número que cuenta sale de las respuestas del hogar.
- **Pendiente:** adaptador a la bandeja (tras H-02), medir con ≥ 10 respuestas, afinar con un extracto real editado. Solo vale si el hogar importa extractos con regularidad.
- **Estado del plan:** avance ponderado **38,9 %** (53,9 de 138,5 sesiones; Ola 3 al 12 %). 21 paquetes hechos. `canonical-*.js`: 92 (ARQ-3). `app.js` 37.441 de 37.495 (+2).
- **Validación:** `npm run verify` en verde, salida 0: `npm test` **5567/5567**, lint, typecheck, accesibilidad, rendimiento, build, privacidad y smoke (una primera pasada falló solo por un `addDays` sin usar en la prueba nueva, ya quitado). Además: e2e **50/50** (+1), axe **37/37** (+2), perf-screens **3/3**. **Carga:** tres medidas dieron 5.112, 4.664 y 4.388 ms (tope 5.000) frente a 2.204 y 2.714 de las dos entregas anteriores; comparadas en el mismo momento y alternando, la rama y `main` dieron **3.712-3.885 frente a 3.754-4.073 ms**: el contenedor es ruidoso (3,7-5,1 s), no hay regresión de WP-36, pero el margen del tope es estrecho y conviene vigilarlo.
