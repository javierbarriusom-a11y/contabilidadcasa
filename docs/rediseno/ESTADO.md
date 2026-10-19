# Rediseño · estado, decisiones y siguiente paso (léelo antes de tocar cualquier pantalla)

> Actualizado el 19 de octubre de 2026, tras fusionar el PR #517. **Este documento manda sobre `HANDOFF.md` y
> `PROMPTS_CLAUDE_CODE.md` donde discrepen**: recoge lo que ya está hecho, las decisiones que se tomaron al hacerlo
> y lo que se aprendió con los datos reales del hogar. El diseño se decide en una conversación aparte con el hogar;
> el desarrollo se hace aquí, en Claude Code.

## 1. Fuentes, en orden de autoridad

| # | Fichero | Qué es |
|---|---|---|
| 1 | `docs/rediseno/ESTADO.md` (este) | Estado real, decisiones vigentes, desviaciones del handoff, siguiente paso |
| 2 | `docs/rediseno/HANDOFF.md` | Especificación de cada pantalla (§5), navegación (§4), orden (§6) |
| 3 | `docs/rediseno/referencias/png/*.png` y `html/*.html` | La verdad visual: 27 pantallas, móvil (390 px) y escritorio (`*Desktop`, 1440 px). Copia el diseño, **nunca las cifras** (son de ejemplo) |
| 4 | `docs/PROPUESTA_SEPTIMA_AUDITORIA_2026-10-17.md` | El backlog del que sale el rediseño: 10 principios, 7 hallazgos, catálogo `X..-nn` (XDA, XGO, XDN…). **Sigue siendo propuesta**: el único backlog vivo es `BACKLOG_DEFINITIVO.md` |
| 5 | `PROJECT_STATE.md`, entradas 317 a 320 | Detalle de cada fase ya publicada, con cifras de validación |

Los artefactos de claude.ai (el lienzo de diseño y la versión web de la auditoría) **no son legibles desde aquí**: todo lo
que hace falta está en el repositorio.

## 2. Lo que ya está hecho (en `main` y publicado)

Todo cuelga de la bandera `?tema=v2`: activarla con `?tema=v2` (se recuerda en `localStorage["tema-preferencia"]`),
apagarla con `?tema=clasico`. Sin la bandera la app es idéntica a antes. Comprobar en
`https://javierbarriusom-a11y.github.io/contabilidadcasa/?tema=v2`.

| Fase | PR | Qué hace | Ficheros | Prueba |
|---|---|---|---|---|
| A1 · tema visual | #514 | Redefine las **dos familias de tokens que ya existían** (`styles.css`: `--bg`, `--ink`, `--teal`…; `design-tokens.css`: `--e19-*`) con la paleta de `Sistema.png`, claro y oscuro. No crea una tercera familia | `tema-v2.css` (última hoja), script en línea de `<head>` que solo **lee** la bandera, `tema-v2.js` (defer) que la **escribe** | `tests/redis-a1-tema-v2.test.cjs` (contraste WCAG calculado) |
| A2 · formato de cifras | #515 | `money()` y `money(x, true)` agrupan siempre los miles (8.310 €, no 8310 €) y solo enseñan céntimos si los hay (1.218 € y 412,30 €). **Afecta también a la app clásica**: es una corrección, no un tema | `app.js` (formateadores `euro`/`euroPrecise`), `p2-ui.js` | `tests/redis-a2-cifras.test.cjs`; 52 expectativas de `qa1-flujos-completos.spec.cjs` actualizadas |
| A1b · acciones frente a conclusiones | #516 | Petición del hogar: **el verde sólido es solo para lo que se pulsa**. Las tarjetas de conclusión (`.e19-registrar-recalc`, `.e6-coverage-card`, `.e19-card-strong`, `.e19-impact-bar`, resumen de Partidas) pasan a tarjeta clara teñida (`--e19-accent-soft`) con la cifra en tinta | `tema-v2.css` | `tests/redis-a1b-conclusiones.test.cjs` |
| A3 · Hoy v2 | #517 | Hoy de `Hoy.png`/`HoyDesktop.png`: cabecera, cifra protagonista con gráfico y suelo, «Decidir esta semana» (máx. 3), el mes en una barra, deuda en una línea, una línea plegada con lo que espera datos. La Hoy de siempre sigue en el DOM y vuelve entera con «Ver todo el detalle» | `views/hoy-v2.js` (defer, antes de `app.js`), contenedor `#hoyV2` en `index.html`, 1 línea en `renderHomeDashboard()`, estilos en `tema-v2.css` | `tests/redis-a3-hoy-v2.test.cjs` |

Validación de la última fase: `npm run verify` 6023/6023, e2e + a11y de Playwright 195/195, presupuesto de carga 4.091 ms de 5.000.

## 3. Decisiones vigentes (no las deshagas sin hablarlo con el hogar)

1. **Verde sólido = acción; tinte claro = conclusión.** Botón primario en `--e19-accent` sólido; cifras clave y lecturas en tarjeta `--e19-accent-soft` con la cifra en tinta. Cualquier pantalla nueva sigue esta regla.
2. **Azul = previsto, tinta = real, rojo = solo lo que rompe una regla del hogar** (suelo, reserva, gasto por encima de lo asignado).
3. **Una pregunta, una cifra, una acción** por pantalla (principio 1 de la auditoría). Máximo 3 decisiones visibles.
4. **Lo que no tiene datos no ocupa pantalla**: nunca una tarjeta con «Sin datos» como titular. Se pliega a una línea (`.hoy-v2-pending`, borde discontinuo) que dice qué falta y lleva al sitio.
5. **No se retira nada en uso**: la vista antigua sigue accesible («Ver todo el detalle») hasta que la nueva se gradúe. Retirarla de verdad se consulta (CLAUDE.md).
6. **Las acciones que modifican el plan conservan su paso de revisión** («Qué ocurrirá») antes de ejecutar, también en la v2.
7. **Formato de cifras único**: `money()` de `app.js`. Nada de `toFixed` para mostrar al usuario.
8. **Cada fase: un PR, detrás de la bandera, con su prueba `tests/redis-<fase>-*.test.cjs`, capturas 390×844 y 1440×900 en claro y oscuro, y su entrada en `PROJECT_STATE.md`.**

## 4. Desviaciones del handoff (y por qué)

| Handoff dice | Se hizo | Motivo |
|---|---|---|
| Flags del Laboratorio (`lab.hoy_v2`…) | Una sola bandera `?tema=v2` | El Laboratorio (XGO-03) no existe todavía. **Cuando exista, `tema=v2` debe pasar a ser un interruptor del Laboratorio**, para no tener dos sistemas de banderas |
| `ui/tokens.css` nuevo con tokens propios | Redefinir las dos familias existentes en `tema-v2.css` | Así cambian todas las pantallas a la vez sin tocar reglas de componente; un tercer sistema de tokens duplicaría trabajo |
| Fuente Geist desde Google Fonts | Fuente del sistema (`-apple-system`, SF Pro) | El sitio no puede pedir nada a terceros (`test:privacy`, NTC-06); SF ya trae cifras tabulares |
| Código nuevo en `ui/components`, `ui/screens` | `views/*.js` (scripts clásicos, mismo scope que `app.js`) | Es el patrón que ya usa el repo para pantallas (PERF-1) |
| Cargar la pantalla v2 solo con la bandera | `views/hoy-v2.js` con `defer` para todos (18 KB) | Un cargador dinámico de scripts nuevo lo rechaza `tests/ntc6-conexiones-externas.test.cjs` (RQ-13). No relajar esa prueba |
| Fase 0 (desalojo de `app.js`) antes que nada | A1-A3 sin desalojo | Cada fase añadió como mucho 1 línea a `app.js` (37.454 de 37.495). **La siguiente pantalla que necesite lógica en `app.js` no cabe: el desalojo es requisito de lo que sigue** |

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

- **Hipótesis principal del cobro caducado:** la insignia «Dato observado» solo sale cuando hay un ajuste manual (`canonical-daily-engine.js`, `coverageUntilNextIncome`: `confidence = "observed"` si `override.nextIncomeDate` o `override.dailyOutflow`). Es decir, `scenarioSettings.e6Coverage.nextIncomeDate` quedó guardado a mano como `2026-08-31` y nadie lo ha vuelto a tocar; el `dailyOutflow` manual probablemente vale 0 («necesidad 0 €»). **Verificarlo antes de cambiar nada.** Si se confirma: un ajuste manual de fecha **ya pasada** debe dejar de aplicarse (o avisar «tu fecha de cobro caducó el 31/08: ponla al día») en vez de dar 0 días. Es un cambio en `app.js`/ajustes, no en el motor.
- La v2 ya se protege: solo dice «Cobráis en…» con una fecha futura; si no, titula «Disponible para gastar».
- **0 movimientos en octubre** confirma el hallazgo 3 de la auditoría («construido no es comprobado»): rediseñar pantallas que dependen de movimientos sin que lleguen los movimientos es decorar. Por eso la siguiente pantalla es Movimientos + Importar.

## 7. Encaje con el backlog (séptima auditoría)

- **A favor:** principios 1 (una pregunta, una cifra), 4 (lo que no tiene datos no ocupa pantalla), 8 (barra inferior de 5 destinos, hojas inferiores) y el rediseño de Inversión, Deuda actual y Taller de deuda nueva salen de ahí. Movimientos/Importar/Clasificar son la cara de XDA-02 (buzón Compartir), XDA-03 (PDF), XDA-04 (cobertura), XDA-05 (clasificar por lotes), XDA-08 (confirmación automática).
- **Choque a gestionar:** la auditoría pide límite de **3 paquetes en curso** y pone primero el camino crítico (CI que explica sus fallos, desalojo de `app.js`, Laboratorio XGO-03 + medidor XGO-02). **El rediseño cuenta como 1 de esos 3**, no como un frente paralelo.
- **No empezar Deuda (D3)** hasta que haya un solo motor de deuda (NTC-05).

## 8. Orden propuesto desde aquí

1. **Tarea de datos (no es rediseño):** confirmar la hipótesis del §6 y, si procede, que un cobro manual caducado deje de aplicarse con aviso. PR pequeño.
2. **Desalojo de `app.js`** (XGO-01, fase 0 del handoff): ~3.000 líneas a módulos, sin cambios visibles. Requisito de todo lo que sigue.
3. **Laboratorio (XGO-03)** con el tema v2 como primer interruptor (sustituye a `?tema=` sin romper los enlaces que ya lo usan).
4. **A4 · Movimientos + Importar** (B3 + E1 del handoff, `Movimientos*.png`, `Importar*.png`): bandeja, cobertura de 90 días, lista por día, Importar en 3 pasos con cuadre obligatorio. Lo que dependa de funciones aún no construidas (buzón, PDF) se pinta plegado.
5. **A5 · Clasificar** (B4, `Clasificar.png`): hoja inferior en móvil, panel lateral en escritorio.
6. Después, por este orden y si las anteriores se usan: Plan (C1-C2), Cierre (C3), Patrimonio e Inversión (D1-D2), navegación de 5 destinos, Deuda (tras NTC-05), Taller y E2.

**Criterio para graduar una pantalla** (quitar la bandera y la vista antigua): dos semanas en uso sin problemas y su métrica mejor (Hoy: tiempo hasta la primera acción; Movimientos: extractos importados por semana).
