# Rediseño · estado, decisiones y siguiente paso (léelo antes de tocar cualquier pantalla)

> Actualizado el 19 de octubre de 2026 (tarde): el tema v2 pasa a ser el de por defecto y se recogen las respuestas del
> hogar al cuestionario (§3b). **Este documento manda sobre `HANDOFF.md` y
> `PROMPTS_CLAUDE_CODE.md` donde discrepen**: recoge lo que ya está hecho, las decisiones que se tomaron al hacerlo
> y lo que se aprendió con los datos reales del hogar. El diseño se decide en una conversación aparte con el hogar;
> el desarrollo se hace aquí, en Claude Code.

## 1. Fuentes, en orden de autoridad

| # | Fichero | Qué es |
|---|---|---|
| 1 | `docs/rediseno/ESTADO.md` (este) | Estado real, decisiones vigentes, desviaciones del handoff, siguiente paso |
| 2 | `docs/rediseno/HANDOFF.md` | Especificación de cada pantalla (§5), navegación (§4), orden (§6) |
| 3 | `docs/rediseno/referencias/png/*.png` y `html/*.html` | La verdad visual, **la base de toda pantalla que se modifique o se cree** (decisión del hogar del 19/10). Son las mismas pantallas que el PDF «Finanzas Casa · Rediseño» de Claude Design (29 páginas: sistema, navegación, las dos barras y las 25 pantallas): 27 pantallas, móvil (390 px) y escritorio (`*Desktop`, 1440 px). Copia el diseño, **nunca las cifras** (son de ejemplo) |
| 4 | `docs/PROPUESTA_SEPTIMA_AUDITORIA_2026-10-17.md` | El backlog del que sale el rediseño: 10 principios, 7 hallazgos, catálogo `X..-nn` (XDA, XGO, XDN…). **Sigue siendo propuesta**: el único backlog vivo es `BACKLOG_DEFINITIVO.md` |
| 5 | `PROJECT_STATE.md`, entradas 317 a 320 | Detalle de cada fase ya publicada, con cifras de validación |

Los artefactos de claude.ai (el lienzo de diseño y la versión web de la auditoría) **no son legibles desde aquí**: todo lo
que hace falta está en el repositorio.

## 2. Lo que ya está hecho (en `main` y publicado)

**Desde el 19/10 el tema v2 es el de por defecto** en `https://javierbarriusom-a11y.github.io/contabilidadcasa/`, que es
donde se trabaja y se revisa. El clásico sigue como salida con `?tema=clasico` (se recuerda en
`localStorage["tema-preferencia"] = "clasico"`; `?tema=v2` lo olvida). Las reglas de `tema-v2.css` siguen colgando de
`:root[data-tema="v2"]`, así que el clásico queda exactamente como estaba.

| Fase | PR | Qué hace | Ficheros | Prueba |
|---|---|---|---|---|
| A1 · tema visual | #514 | Redefine las **dos familias de tokens que ya existían** (`styles.css`: `--bg`, `--ink`, `--teal`…; `design-tokens.css`: `--e19-*`) con la paleta de `Sistema.png`, claro y oscuro. No crea una tercera familia | `tema-v2.css` (última hoja), script en línea de `<head>` que solo **lee** la bandera, `tema-v2.js` (defer) que la **escribe** | `tests/redis-a1-tema-v2.test.cjs` (contraste WCAG calculado) |
| A2 · formato de cifras | #515 | `money()` y `money(x, true)` agrupan siempre los miles (8.310 €, no 8310 €) y solo enseñan céntimos si los hay (1.218 € y 412,30 €). **Afecta también a la app clásica**: es una corrección, no un tema | `app.js` (formateadores `euro`/`euroPrecise`), `p2-ui.js` | `tests/redis-a2-cifras.test.cjs`; 52 expectativas de `qa1-flujos-completos.spec.cjs` actualizadas |
| A1b · acciones frente a conclusiones | #516 | Petición del hogar: **el verde sólido es solo para lo que se pulsa**. Las tarjetas de conclusión (`.e19-registrar-recalc`, `.e6-coverage-card`, `.e19-card-strong`, `.e19-impact-bar`, resumen de Partidas) pasan a tarjeta clara teñida (`--e19-accent-soft`) con la cifra en tinta | `tema-v2.css` | `tests/redis-a1b-conclusiones.test.cjs` |
| A3 · Hoy v2 | #517 | Hoy de `Hoy.png`/`HoyDesktop.png`: cabecera, cifra protagonista con gráfico y suelo, «Decidir esta semana» (máx. 3), el mes en una barra, deuda en una línea, una línea plegada con lo que espera datos. La Hoy de siempre sigue en el DOM y vuelve entera con «Ver todo el detalle» | `views/hoy-v2.js` (defer, antes de `app.js`), contenedor `#hoyV2` en `index.html`, 1 línea en `renderHomeDashboard()`, estilos en `tema-v2.css` | `tests/redis-a3-hoy-v2.test.cjs` |

| v2 por defecto | #519 | El tema v2 se aplica sin bandera; `?tema=clasico` es la salida y se recuerda. Mismas funciones en los dos: v2 solo cambia estilos y la Hoy, cuya versión completa sigue tras «Ver todo el detalle». Prueba de igualdad: e2e y a11y de Playwright recorridas con el v2 por defecto | `index.html` (script de `<head>`), `tema-v2.js` | `tests/redis-a1-tema-v2.test.cjs` (seis casos de la decisión) |
| CI con trazas | #520 | Si una prueba en navegador falla, el CI sube `test-results/` (trazas y capturas) 14 días (P5) | `.github/workflows/pages.yml` | `tests/ci-informe-playwright.test.cjs` |
| Cobro caducado | #521 | Fecha de cobro manual pasada y gasto diario de 0 € dejan de aplicarse con aviso; «Guardar ajuste» no congela lo aprendido (P3, P4). Sin tocar motores | `views/cobertura-ajuste.js` (nuevo), `app.js` (−7 líneas), `views/hoy-v2.js` | `tests/datos-cobro-caducado.test.cjs` y una e2e en `qa1` |
| Desalojo, PR-0 y PR-1 | #525 y #526 | Las pruebas leen el código de la app con un ayudante común; Registrar y Datos salen de `app.js` sin cambiar una coma (37.448 → 34.977 líneas, techo 35.107) | `tests/helpers/codigo-app.cjs`, `registrar-ui.js`, `datos-ui.js`, `app.js` | `tests/xgo01-codigo-app-pruebas.test.cjs`, `tests/xgo01-sin-funciones-duplicadas.test.cjs` |
| A4 · Movimientos (PR-1) | 21/10 | Movimientos de `Movimientos.png`/`MovimientosDesktop.png`: cabecera con buscar e Importar (y Cierre en escritorio), bandeja (conceptos sin partida + la tarjeta de anomalías WP-36, que no se oculta), filtros por cuenta y «Sin partida», lista por día con la partida o «¿partida?» (tabla en escritorio), 40 y «Ver más», acceso a Cierre. Con 0 movimientos, un solo bloque que lleva a Importar. Tocar un movimiento abre el panel de detalle de siempre. Lo de siempre sigue tras «Ver todo el detalle» | `views/movimientos-v2.js` (defer, antes de `app.js`), dos contenedores en `#movements`, `app.js` +5 (llamada y `openMovementDetailRow`), estilos en `tema-v2.css` | `tests/redis-a4-movimientos.test.cjs` y una e2e por ancho en `qa1` |
| A4 · Importar (PR-2) | 21/10 | Importar de `Importar.png`/`ImportarDesktop.png` en Registrar › Importar extracto: «‹ Movimientos», tarjeta CSV o Excel (abre el input de siempre), líneas reconocidas con su estado (partida, «a la bandeja», duplicado tachado, «¿duplicado?» con dos botones), cuenta, cuadre (saldo inicial + movimientos = final; si no cuadra, no se importa; sin saldos, aviso), saldo final como saldo de la cuenta, «Importar N movimientos» con la confirmación de siempre y éxito con «Deshacer» (el «Deshacer último lote» de siempre). P17 y P18 | `views/importar-v2.js` (defer, antes de `app.js`), contenedor en el asistente de Registrar, `app.js` +1 (llamada desde `renderDatosImportar`), estilos en `tema-v2.css` | `tests/redis-a4-importar.test.cjs` y una e2e por ancho en `qa1` |
| Desalojo, PR-2 | 21/10 | Plan › Partidas (72 funciones) a `partidas-ui.js` y el motor de escenarios (41) al nuevo `escenarios-ui.js`, sin cambiar una coma (34.977 → 33.129 líneas, techo 33.259). El motor no va a `views/escenarios.js` porque esa vista se descarga al visitarla y el motor lo usan otras pantallas | `partidas-ui.js`, `escenarios-ui.js`, `app.js` | `tests/xgo01-sin-funciones-duplicadas.test.cjs` |
| A5 · Clasificar por lotes | 21/10 | Clasificar de `Clasificar.png`: la tarjeta «N conceptos sin partida» de la bandeja abre una hoja inferior (móvil) o un panel derecho de 400 px (escritorio, sin salir de la lista). Grupos del mismo concepto (la clave de las reglas), del que más suma al que menos, **5 por tanda**: movimientos, lo del mes del último y el importe típico; propuesta de siempre (`datosImportarSuggestionFor`) **sin confianza inventada** (plegada en una línea, tarea aparte); hasta 3 alternativas (las partidas con más reglas del mismo tipo) y «Otra…» con todas. «Aceptar y siguiente» crea la regla en el diccionario de siempre con la secuencia de refresco del lote de Movimientos, con el aviso «Deshacer» de 10 s; al acabar, cada regla de la tanda con su «Deshacer» (devuelve la regla y los reales de antes). «Saltar» la deja en la bandeja. Atajos ↵, 1-3, S y ⌘Z en escritorio. El filtro «Sin partida» sigue en la lista | `views/clasificar-v2.js` (defer, antes de `app.js`), `<dialog id="clasificarV2">` en `index.html`, `views/movimientos-v2.js` (la tarjeta abre Clasificar), estilos en `tema-v2.css`; `app.js` sin cambios | `tests/redis-a5-clasificar.test.cjs` y una e2e por ancho en `qa1` |
| A5 · confianza de la propuesta | 21/10 | La propuesta de Clasificar dice su **confianza (alta, media o baja) y el porqué**, como la referencia, sin cifras inventadas. Dos señales que ya existían: las **reglas del hogar para el mismo comercio** (primera palabra significativa del concepto, sin «compra», «tarjeta», «recibo», «bizum»…: «MERCADONA 5678» aprovecha la regla de «MERCADONA 1234») y la **coincidencia de nombre** de siempre, contando cuántas partidas encajan. Alta: 2+ reglas del comercio a la misma partida, o una y el nombre de la partida en el concepto. Media: una regla, o una sola partida por nombre. Baja: el comercio tiene reglas a varias partidas, o encajan por nombre varias distintas. Lo elegido a mano no lleva confianza | `views/clasificar-v2.js` (`clasV2Proposal`), `tema-v2.css` | `tests/redis-a5-clasificar.test.cjs` (+5) y la e2e de A5 en `qa1` |
| Funciones en prueba (XGO-03) | 22/10 | Tarjeta «Funciones en prueba» (P8) en Ajustes › Simuladores y Laboratorio, **en los dos temas** (desde el clásico es la forma de volver). Primer interruptor: **Diseño nuevo** (`role="switch"`), encendido porque es el de por defecto; al moverlo recarga con `?tema=v2` o `?tema=clasico` y `tema-v2.js` sigue siendo el único que guarda la elección. Hoy, Movimientos, Importar y Clasificar, agrupadas bajo él, cada una con su fecha de entrada, su métrica y su revisión. **P9:** a los 14 días la fila pregunta «¿se queda?» («Graduar» o «Dos semanas más») y sale «N por revisar» en la entrada Ajustes del menú y en su ancla. Graduar solo anota la decisión: la versión de siempre no se borra sin el visto bueno del hogar | `funciones-en-prueba.js` (nuevo, UMD con lógica pura y pintado), tarjeta en `index.html`, estilos en `design-tokens.css` (los dos temas); `app.js` sin cambios | `tests/xgo03-funciones-en-prueba.test.cjs` y dos e2e en `qa1` |
| Medidor de utilidad (XGO-02) | 22/10 | Por función y mes, en este navegador y solo en agregado: **vista** (días distintos), **acción**, **descarte** (saltar, «Ver todo el detalle», volver al diseño de siempre) y **deshecho**, más los segundos hasta la primera acción en Hoy. La **tasa de acción** es la parte de los días vistos en que se actuó. Informe mensual en Ajustes › Uso de la app («Medidor de utilidad», con selector de mes) y, en «Funciones en prueba», una línea «Medido: …» junto a la métrica de cada función, para que la revisión del 2/11 y el 4/11 se conteste con datos. Instrumentados el diseño nuevo, Hoy, Movimientos, Importar y Clasificar; ningún importe ni concepto | `medidor-utilidad.js` (nuevo), una línea por evento en `views/*-v2.js` y `funciones-en-prueba.js`, tarjeta en `index.html`; `app.js` sin cambios | `tests/xgo02-medidor-utilidad.test.cjs` y una e2e en `qa1` |

Validación de A3: `npm run verify` 6023/6023, e2e + a11y de Playwright 195/195, presupuesto de carga 4.091 ms de 5.000.

## 3. Decisiones vigentes (no las deshagas sin hablarlo con el hogar)

1. **Verde sólido = acción; tinte claro = conclusión.** Botón primario en `--e19-accent` sólido; cifras clave y lecturas en tarjeta `--e19-accent-soft` con la cifra en tinta. Cualquier pantalla nueva sigue esta regla.
2. **Azul = previsto, tinta = real, rojo = solo lo que rompe una regla del hogar** (suelo, reserva, gasto por encima de lo asignado).
3. **Una pregunta, una cifra, una acción** por pantalla (principio 1 de la auditoría). Máximo 3 decisiones visibles.
4. **Lo que no tiene datos no ocupa pantalla**: nunca una tarjeta con «Sin datos» como titular. Se pliega a una línea (`.hoy-v2-pending`, borde discontinuo) que dice qué falta y lleva al sitio.
5. **No se retira nada en uso**: la vista antigua sigue accesible («Ver todo el detalle») hasta que la nueva se gradúe. Retirarla de verdad se consulta (CLAUDE.md).
6. **Las acciones que modifican el plan conservan su paso de revisión** («Qué ocurrirá») antes de ejecutar, también en la v2.
7. **Formato de cifras único**: `money()` de `app.js`. Nada de `toFixed` para mostrar al usuario.
8. **Cada fase: un PR, con el diseño nuevo bajo `:root[data-tema="v2"]`, con su prueba `tests/redis-<fase>-*.test.cjs`, capturas 390×844 y 1440×900 en claro y oscuro, y su entrada en `PROJECT_STATE.md`.**
9. **v2 por defecto, clásico como salida.** Se trabaja y se revisa en la URL base. El clásico no se retira hasta que el hogar lo confirme (§3b, P9).
10. **Mismas funciones en los dos temas.** Una pantalla v2 nunca quita una función: lo que no cabe se pliega o queda tras «Ver todo el detalle». Lo comprueban las e2e y a11y, que ya recorren la app con el v2.

## 3b. Respuestas del hogar al cuestionario (19/10)

Recogidas en el artefacto de la séptima auditoría. Mandan sobre los prompts donde discrepen.

| # | Pregunta | Respuesta |
|---|---|---|
| P1 | Insignia del editor de cobertura | «Aprendido»: hoy no hay fecha manual guardada en ese navegador. Nota: estimar con el histórico del mismo mes del año anterior |
| P2 | Gasto diario en el editor | Sin respuesta («no lo veo») |
| P3 | Fecha de cobro manual caducada | Deja de aplicarse y avisa, con botón para ponerla al día |
| P4 | Gasto diario manual de 0 € | Se trata como dato sin rellenar y se avisa |
| P5 | CI que guarda el informe de Playwright al fallar | Antes del desalojo |
| P6 | Desalojo | En dos PR (Registrar + Datos; Partidas + Escenarios) |
| P7 | Techo de `app.js` tras el desalojo | Trinquete actual: lo que quede + ~130 |
| P8 | Nombre del sitio de interruptores | «Funciones en prueba», dentro de Ajustes › Simuladores y Laboratorio |
| P9 | Graduar una pantalla | Sin opción elegida. Nota: «alerta en la app cuando pasen dos semanas y confirmar manualmente» |
| P10 | Medidor de utilidad (XGO-02) | PR aparte, justo detrás del Laboratorio |
| P11 | Importar un extracto que no cuadra | Se bloquea solo si trae saldos y no cuadran; sin saldos, se importa con aviso |
| P12 | A4 | En dos PR: Movimientos, luego Importar |
| P13 | Backlog vivo | Sí: rediseño, desalojo, Laboratorio y límite de 3 en curso pasan a `BACKLOG_DEFINITIVO.md` |
| P14 | Pruebas en Safari | Sí: proyecto WebKit 390×844 para las pantallas v2 |
| P15 | Signo menos | Se queda «-8.310 €»; desviación anotada en §4 |
| P16 | Sección de `CLAUDE.md` | Vale como está |
| P17 | Duplicados al importar (21/10) | Solo los **seguros** (misma fecha, importe y concepto que algo ya registrado) se descartan solos, tachados y con «No es duplicado»; los parecidos y las capturas a mano siguen preguntando |
| P18 | Movimientos sin partida al importar (21/10) | Se importan y esperan en la bandeja de Movimientos («¿partida?»); no cuentan en los reales de ninguna partida hasta tenerla |

## 4. Desviaciones del handoff (y por qué)

| Handoff dice | Se hizo | Motivo |
|---|---|---|
| Flags del Laboratorio (`lab.hoy_v2`…) | Una sola bandera, el tema, que desde el 22/10 es el interruptor «Diseño nuevo» de Funciones en prueba (XGO-03); `?tema=v2` y `?tema=clasico` siguen funcionando y mueven el interruptor | Un solo sistema de banderas. Las pantallas del rediseño no tienen bandera propia: van con el tema y cada una lleva su revisión. Una bandera por pantalla se añadirá si alguna hay que apagar sola |
| Laboratorio: «todo nace apagado», «Se apoya en banderas en ux-settings.js», graduar o retirar | El diseño nuevo nace encendido; sin `ux-settings.js`; solo «Graduar» o «Dos semanas más»; decisiones en este navegador | El v2 es el de por defecto desde el 19/10 (decisión 9). `ux-settings.js` no tiene banderas (es el reparto por titular). Retirar una pantalla v2 sola exige su bandera propia y retirar código se consulta (CLAUDE.md). Las decisiones se guardan como la elección de tema, por navegador |
| Medidor: «cada recomendación o aviso» de la app, «se apoya en usage-panel.js» | Las cinco funciones en prueba; módulo propio junto al panel de uso; dos métricas por aproximación | Son las que tienen revisión el 2/11 y el 4/11; el resto de recomendaciones (escalera del próximo euro, avisos…) se instrumenta con la misma pieza cuando toque revisarlas. `usage-panel.js` mide días y saldos, no funciones: se deja tal cual y la tarjeta va a su lado. «Conceptos sin partida tras importar» (Clasificar) se lee por reglas aceptadas, saltadas y deshechas, y «extractos importados por semana» (Movimientos) por sus días de uso y acciones |
| `ui/tokens.css` nuevo con tokens propios | Redefinir las dos familias existentes en `tema-v2.css` | Así cambian todas las pantallas a la vez sin tocar reglas de componente; un tercer sistema de tokens duplicaría trabajo |
| Fuente Geist desde Google Fonts | Fuente del sistema (`-apple-system`, SF Pro) | El sitio no puede pedir nada a terceros (`test:privacy`, NTC-06); SF ya trae cifras tabulares |
| Código nuevo en `ui/components`, `ui/screens` | `views/*.js` (scripts clásicos, mismo scope que `app.js`) | Es el patrón que ya usa el repo para pantallas (PERF-1) |
| Cargar la pantalla v2 solo con la bandera | `views/hoy-v2.js` con `defer` para todos (18 KB) | Un cargador dinámico de scripts nuevo lo rechaza `tests/ntc6-conexiones-externas.test.cjs` (RQ-13). No relajar esa prueba |
| Signo menos tipográfico «−» | Guion normal «-8.310 €» | Decisión del hogar (P15): afecta a la app clásica y a decenas de pruebas, y el guion se pega mejor en una hoja de cálculo |
| Bandeja de Movimientos: extracto por Compartir, «cobros confirmados solos» y cobertura de 90 días por cuenta | Una línea plegada «Aún no llegan solos…» | Dependen de XDA-02, XDA-08 y XDA-04, que no existen; el prompt pide no construirlos en A4 |
| La bandeja de decisiones de Hoy (`#homeDecisionInboxCard`) «tiene su sitio final en Movimientos» | Sigue en Hoy | Hoy está congelado hasta el 25/10 (`BACKLOG_DEFINITIVO.md` §4): moverla cambia lo que Hoy enseña. Se mueve cuando se levante |
| Importar como pantalla propia, con tres fuentes (Compartir, PDF, CSV) | En Registrar › Importar extracto, donde vive el asistente; una tarjeta CSV o Excel y una línea plegada con Compartir y PDF | Compartir (XDA-02) y PDF (XDA-03) no existen; mover el asistente de sitio queda para la navegación de 5 destinos |
| «Fecha dudosa» por línea y «cobertura tras importar» | Las fechas ambiguas las avisa la lectura del fichero (WP-51, «Cómo he leído…»), que sigue a la vista; la cobertura no se pinta | La lectura ya decide el orden día/mes para todo el fichero; la cobertura es XDA-04 |
| Propuesta de Clasificar con la coincidencia de nombre del importador (`datosImportarSuggestionFor`) | Propuesta propia de Clasificar (`clasV2Proposal`): primero las reglas del mismo comercio; por nombre, la partida más concreta | Así hay confianza honesta (alta, media o baja con su porqué) y el mismo comercio con otra referencia en el concepto hereda la propuesta. El asistente de importación no cambia: tocar su sugerencia se hablaría aparte |
| Grupo «por comercio normalizado» | Grupo por concepto, la clave de las reglas (`movementMappingKey`: tipo, concepto y detalle normalizados) | Una regla solo se aplica a esa clave: agrupar por comercio daría grupos cuya regla no heredan todos sus movimientos. Si el banco mete referencias en el detalle, el mismo comercio sale en varios grupos; desde la confianza (21/10), en cuanto uno tiene regla, los demás la llevan propuesta |
| «Puedes deshacerla aquí o en Ajustes › Reglas» | Se deshace con el aviso de 10 s o en el resumen de la tanda; después, cambiando la partida en el detalle del movimiento | No existe una pantalla de reglas; crearla no es de esta fase |
| Fase 0 (desalojo de `app.js`) antes que nada | A1-A3 sin desalojo | Cada fase añadió como mucho 1 línea a `app.js` (37.454 de 37.495). **La siguiente pantalla que necesite lógica en `app.js` no cabía: el desalojo es requisito de lo que sigue** (PR-1 del 20/10: 34.977 de 35.107; PR-2 del 21/10: 33.129 de 33.259) |

## 5. Trampas técnicas ya encontradas

- `styles.css` pone `min-height: 350px` a **todo** `svg`: cualquier gráfico nuevo necesita `min-height: 0`.
- Etiquetas dentro de un SVG con `preserveAspectRatio="none"` se deforman: van en HTML superpuesto (ver `.hoy-v2-chart-*`).
- Las reglas de `tema-v2.css` deben colgar **todas** de `:root[data-tema="v2"]` (lo comprueba la prueba de A1).
- Ocultar la vista antigua con `#home:has(> #hoyV2:not([hidden]))`: si el script v2 falla, se sigue viendo la antigua.
- `tools/build-public-site.mjs`: cada fichero nuevo va en la lista, **una entrada por línea terminada en `",`** sin comentario detrás (la prueba `public-site-assets` lee con esa forma). También en `service-worker.js`.
- Los textos que vienen de motores o de `app.js` pueden traer formatos viejos («Cobertura actual 0.9 meses», «,00»): se arreglan en origen, motor a motor, en una tarea aparte (no en una fase de pantalla).
- Sin el canal de Chrome instalado, Playwright local necesita `PLAYWRIGHT_CHROMIUM_PATH` apuntando a un Chromium existente.

## 6. Lo que han enseñado los datos reales del hogar (19/10)

Captura de Hoy con datos reales: «Hasta el siguiente ingreso: **0 días** · hasta **31 ago 26** · necesidad 0 € · *Dato observado*»; octubre con **0 movimientos**, 0 € de ingresos y 0 € de gasto real; «Cobertura actual 0.0 meses».

- **Hipótesis del cobro caducado, revisada con la respuesta P1 («Aprendido»).** En el motor
  (`coverageUntilNextIncome`), «0 días» con una fecha pasada solo puede salir de un ajuste manual guardado: los eventos
  futuros y el día aprendido nunca devuelven una fecha anterior a la de saldos. Que hoy el editor diga «Aprendido» indica
  que ese ajuste ya no está en el navegador donde se miró (se borró, o la captura y la comprobación se hicieron en
  dispositivos distintos). **Causa probable de que se guardara sin querer**, en `app.js` y no en el motor:
  1. El editor rellena sus campos con lo aprendido (`renderHomeCoverageEditor`), y `syncE6SaveButtonState` compara esos
     valores con lo guardado (vacío), así que «Guardar ajuste» está activo nada más abrirlo. Un toque congela la fecha
     aprendida de ese momento (p. ej. el 31/08) como si fuera manual.
  2. Si el gasto diario estaba vacío se guarda `null`, y `e6CoverageSettings` lo convierte en `Number(null) = 0`: un
     gasto diario manual de 0 €, que da «necesidad 0 €» y mantiene «Dato observado».
  El arreglo (paso 1 del §8) cubre las tres cosas: fecha manual caducada → deja de aplicarse con aviso (P3); 0 € o vacío
  → dato sin rellenar con aviso (P4); y el botón solo se activa cuando el hogar cambia algo de verdad.
- La v2 ya se protege: solo dice «Cobráis en…» con una fecha futura; si no, titula «Disponible para gastar».
- **0 movimientos en octubre** confirma el hallazgo 3 de la auditoría («construido no es comprobado»): rediseñar pantallas que dependen de movimientos sin que lleguen los movimientos es decorar. Por eso la siguiente pantalla es Movimientos + Importar.

## 7. Encaje con el backlog (séptima auditoría)

- **A favor:** principios 1 (una pregunta, una cifra), 4 (lo que no tiene datos no ocupa pantalla), 8 (barra inferior de 5 destinos, hojas inferiores) y el rediseño de Inversión, Deuda actual y Taller de deuda nueva salen de ahí. Movimientos/Importar/Clasificar son la cara de XDA-02 (buzón Compartir), XDA-03 (PDF), XDA-04 (cobertura), XDA-05 (clasificar por lotes), XDA-08 (confirmación automática).
- **Choque a gestionar:** la auditoría pide límite de **3 paquetes en curso** y pone primero el camino crítico (CI que explica sus fallos, desalojo de `app.js`, Laboratorio XGO-03 + medidor XGO-02). **El rediseño cuenta como 1 de esos 3**, no como un frente paralelo.
- **No empezar Deuda (D3)** hasta que haya un solo motor de deuda (NTC-05).

## 8. Orden propuesto desde aquí

0. **v2 por defecto** (hecho el 19/10, #519).
1. **CI que guarda el informe y las trazas de Playwright cuando una prueba falla** (hecho el 19/10, #520).
2. **Cobro manual caducado** (hecho el 19/10, #521) (P3, P4 y la causa del §6). Sin tocar ningún `canonical-*`. La estimación con el histórico
   del mismo mes del año anterior (nota de P1) cambia el motor de cobertura: se propone aparte.
3. **Desalojo de `app.js`** en dos PR (P6), bajando el techo según el trinquete (P7). **PR-0 hecho el 20/10:** las pruebas leen
   el código de la app con `tests/helpers/codigo-app.cjs` (`app.js` + los ficheros que reciben lo desalojado), así que mover
   una función no rompe pruebas. **PR-1 hecho el 20/10:** 112 funciones de Registrar y Datos a `registrar-ui.js` y
   `datos-ui.js`, idénticas byte a byte; `app.js` 37.448 → 34.977 y techo 35.107. **PR-2 hecho el 21/10:** 72 funciones de Plan › Partidas a
   `partidas-ui.js` y las 41 del motor de escenarios al nuevo `escenarios-ui.js` (añadido a `FICHEROS_APP`); `app.js` 34.977 → 33.129 y
   techo 33.259. Entre los dos PR salen 4.319 líneas, más que las ~3.000 que proponía la auditoría; el margen bajo el techo sigue
   siendo de ~130 por el trinquete que eligió el hogar (P7). En los dos PR, solo declaraciones de función, a scripts clásicos con `defer`
   antes de `app.js`; el cargador del OCR de tickets se queda en `app.js` junto a su huella SRI (RQ-13).
4. **Funciones en prueba** (Laboratorio, XGO-03; nombre según P8) con el tema como primer interruptor, y el aviso de
   graduación a las dos semanas con confirmación manual (P9). **Hecho el 22/10.** Las primeras revisiones saltan el 2/11
   (Diseño nuevo y Hoy) y el 4/11 (Movimientos, Importar y Clasificar). **El medidor XGO-02 (P10), en PR aparte, también
   el 22/10**: la revisión llega con lo medido junto a cada métrica.
5. **A4 · Movimientos e Importar** en dos PR (P12), con el cuadre según P11. Lo que dependa del buzón o del PDF, plegado. **Adelantado por el hogar el 21/10** delante de XGO-03 (sin movimientos, el resto de pantallas enseña datos vacíos). **PR-1 (Movimientos) y PR-2 (Importar) hechos el 21/10**, con P17 y P18 (§3b). Clasificar (paso 6) también, el mismo día; sigue «Funciones en prueba» (paso 4).
6. **A5 · Clasificar**. **Hecho el 21/10** (adelantado por el hogar delante de «Funciones en prueba»): hoja inferior / panel derecho desde la bandeja, 5 grupos por tanda, regla con deshacer. La confianza por grupo, en tarea aparte.
7. **Antes, el 25/10 (decisión del hogar del 23/10):** cuando se levante la congelación de Hoy, el primer cambio es mover la bandeja de decisiones (`#homeDecisionInboxCard`) a Movimientos (desviación del §4). Después, un cambio de Hoy por semana, para que el medidor compare el antes y el después. **No se abre ninguna pantalla nueva hasta las revisiones del 2/11 y el 4/11** (`docs/REVISION_SALIDA_OLA1_2026-10-23.md`).
8. Después, si las anteriores se usan: Plan (C1-C2), Cierre (C3), Patrimonio e Inversión (D1-D2), navegación de 5
   destinos, Deuda (tras NTC-05), Taller y E2. Cada una desde su referencia de `docs/rediseno/referencias/`.

Registrado en `BACKLOG_DEFINITIVO.md` §5.0 (P13, 19/10). Pendiente: añadir el proyecto WebKit a Playwright (P14).

**Criterio para graduar una pantalla** (retirar la vista antigua y su código): a las dos semanas de uso la app avisa y el hogar lo confirma a mano (P9); la métrica de referencia sigue siendo la del handoff (Hoy: tiempo hasta la primera acción; Movimientos: extractos importados por semana).
