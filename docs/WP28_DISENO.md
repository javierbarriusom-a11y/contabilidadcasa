# WP-28 · Kit de gráficos táctil y accesible — diseño

Paquete del plan definitivo (NPV-07, Ola 2, ≈ 3,5 sesiones). Habilita WP-35, WP-16, WP-43, WP-46 y WP-49. Construido el 6/10/2026 (el orden lo eligió el asistente tras WP-33: el kit no depende de nada y desbloquea cinco paquetes de la Ola 3).

## 1. El problema

Los gráficos de la app son SVG a mano con `title` nativo. Sin ratón no hay *hover*: en el móvil, el único aparato del hogar, el cono de previsión no se podía leer (el marcador por mes de P2 solo mostraba su rango al pasar el ratón o con el foco). Y cada gráfico resolvía la accesibilidad por su cuenta (`I9`, `P2`), a medias.

Hallazgo de paso, sin relación con el móvil: la hoja global `styles.css` fija `svg { min-height: 350px }` para **todos** los SVG. El cono vivía en un contenedor de 120 px, así que su dibujo se salía 230 px y tapaba la nota y lo que había debajo (y se llevaba los clics). El kit lo corrige en su propia hoja (`.ck-plot > svg { min-height: 0 }`); `styles.css` no se toca.

## 2. Qué es

Un módulo `chart-kit.js` (global `ChartKit`, sin dependencias, SVG propio) y una hoja `chart-kit.css`. **No es un motor `canonical-*`**: no calcula nada del hogar, solo dibuja y lee lo que le dan; por eso no entra en el recuento de ARQ-3.

| Pieza | Qué hace |
|---|---|
| `trendSentence` | **Frase automática** determinista: de dónde a dónde va la serie, mínimo y máximo si no son los extremos, y cuándo cruza un umbral (el suelo de la caja, el cero). Sin dato lo dice; con un punto, no inventa tendencia. Va en el `aria-label` del SVG. |
| `bandPlotHtml` | Dibujo de un cono o banda P10-P90: polígono continuo y línea central. Devuelve la posición horizontal de cada punto. Las clases se pueden sustituir (el cono conserva su aspecto de siempre). |
| `figureHtml` | El conjunto: dibujo, **capa de recorrido**, **lectura fija**, nota y tabla. |
| `tableHtml` | **«Ver como tabla»**: los mismos datos, con leyenda y cabeceras de fila y de columna, plegada. |
| `attach(document)` | Una sola vez (idempotente), por delegación de eventos. No hay estado en JS: vive en atributos del gráfico. La llama `init()` de `app.js`. |

## 3. Decisiones de interacción

1. **Lectura fija, no flotante.** El texto del punto leído aparece en un recuadro debajo del dibujo. Un dedo tapa un tooltip flotante, y un tooltip no existe sin ratón. El recuadro reserva dos líneas para que leer un punto no mueva la página.
2. **El dedo lee mientras está apoyado; el ratón, con solo pasar.** Con `touch-action: pan-y`: el gesto vertical sigue desplazando la página y solo el horizontal recorre el gráfico. Sin eso el gráfico atraparía el dedo en cada scroll.
3. **Es un deslizador (`role="slider"`).** `aria-valuenow` = índice, `aria-valuetext` = la lectura, así que el lector de pantalla dice «oct 26: P10 … · P50 … · P90 …» al mover con las flechas. Teclas: ← → ↑ ↓ (±1), Inicio/Fin, Re Pág/Av Pág (saltos de un cuarto). El tabulador no queda atrapado.
4. **El cursor no depende del color**: línea de 2 px (4 px con `prefers-contrast: more`; `Highlight` con colores forzados).
5. **`prefers-reduced-motion`**: el cursor solo se anima si el usuario no pidió reducir movimiento.
6. **Lo que no se hace aposta:** zoom por pellizco (ver `I9`: ensanchar columnas ayuda más que un gesto) ni *brushing*. Un gráfico por pantalla pequeña, un gesto.

## 4. Migración: el cono de previsión

`pv4ConfidenceBandHtml` (Plan › Escenarios › «Bandas de confianza») usa ahora el kit. Aspecto idéntico (mismas clases `pv4-cone-*`); cambian:

- los marcadores `<button>` con `title` desaparecen: los sustituye el recorrido;
- la **partida que más pesa en el margen** se dice **una vez** en la nota (es la misma en los doce meses; antes se repetía en cada marcador);
- aparece «Ver como tabla» (Mes, P10, P50, P90, Margen) y la frase automática en el `aria-label`.

`app.js` baja 4 líneas netas (37.418 de 37.495) y deja de llevar la geometría del cono. Las pruebas P2 (`p2-tooltip-cono-incertidumbre`) se reescriben: lo que garantizaban —leer P10/P50/P90 de cada mes sin ratón y decir la partida dominante— sigue garantizado y ahora con una prueba de extremo a extremo con teclado, ratón y dedo táctil.

**Efecto lateral corregido:** la vista repintaba el análisis avanzado a los ~600 ms de abrirse (el repintado pesado), borrando la lectura y el foco del gráfico que el hogar ya estaba recorriendo. `renderE13ScenarioLab` ya no repinta si el HTML no cambió. Se detectó con la prueba táctil.

## 5. Pendiente

| Qué | Cuándo |
|---|---|
| Migrar cartera (`I9`, barras con zoom) y ruta de deuda al kit; el kit hoy cubre bandas y líneas, no barras ni cascadas | Con cada paquete de Ola 3 que los toque (WP-46, WP-49) |
| Series con más de un trazo, ejes con valores y marca de umbral (el suelo de caja) | WP-16 (banda de caja diaria) lo pide primero |
| Retirar el CSS muerto de `.pv4-cone-marker` en `styles.css` | Cuando se vuelva a tocar esa hoja (su versión está fijada por decenas de pruebas) |
| Etiquetas del eje: en 390 px las 12 etiquetas del cono se parten en dos líneas | Mismo paquete que el eje |
| Medida de uso real: ¿se recorre el cono? (panel de uso, WP-03) | Si se quiere decidir sobre más gráficos interactivos |

## 6. Cómo se prueba

- `tests/wp28-kit-graficos.test.cjs` (21): frase (sube, baja, plana, bucle, sin datos, un punto, umbral), índice más cercano, teclas, geometría, tabla escapada, figura, `attach` con un documento falso (dedo, ratón, teclado, foco), cableado y diseño (solo tokens `--e19-*`, `pan-y`, movimiento reducido, contraste).
- `tests/qa1-flujos-completos.spec.cjs`: el cono en 1280 y 390 px con teclado y ratón (la lectura no mueve la página, la tabla tiene una fila por mes) y con un dedo táctil real (`pan-y` + toque).
- Pruebas del cono (`pv4`, `pvc19`, `p2`, `pvc13`) adaptadas: cargan el kit en su contexto.
