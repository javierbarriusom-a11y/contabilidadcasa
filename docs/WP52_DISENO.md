# WP-52 · WebKit en la medición de carga — diseño

Paquete del plan definitivo (NTC-04, Ola 3, exento, ≈ 1,5 sesiones). **Entrega del 11/10/2026.** Estado: **en curso**: el código y su lógica pura están hechos y probados, pero **el camino de WebKit no se ha podido ejecutar en el entorno de desarrollo** (solo trae Chromium); su primera ejecución real es la del CI de este mismo PR, en un paso **informativo**.

## 1. Qué hace

- `tools/measure-load.mjs` acepta `--engine=chromium` (por defecto: la medición de siempre, con CPU 4× y 1,6 Mbps, y la **puerta de 5000 ms** del CI, **sin cambios**), `--engine=webkit` (informativo) y `--engine=compare` (Chromium y WebKit **sin estrangular**, tres visitas repetidas cada uno, y la **razón WebKit/Chromium** en la misma máquina). Atajo: `npm run measure:load-webkit` (= `compare`).
- La lógica pura (opciones y su validación, plan de estrangulamiento por motor, mediana, razón, veredicto) está en `tools/measure-load-core.mjs` y tiene 9 pruebas (`tests/wp52-medicion-webkit.test.cjs`): la puerta de Chromium conserva sus mensajes exactos.
- **Veredicto de WebKit:** falla si hay **excepciones de página sin capturar** durante la carga (lo que se rompería en Safari y Chromium no avisa) o si **«Hoy» no llega a pintar**. **Nunca falla por lentitud**: no hay presupuesto.
- Lo que WebKit no soporta (`layout-shift`, `longtask`) sale **`null`, no 0**: dato ausente no es cero.
- Cada fila incluye ahora `serviceWorker` (si la visita repetida la sirvió el service worker) y `erroresPagina`.
- **CI:** un paso nuevo en `pages.yml`, tras la puerta de carga y antes de preparar el despliegue: instala WebKit y ejecuta `measure:load-webkit` con **`continue-on-error: true`**. **No puede bloquear la publicación.**

## 2. Dónde se aparta del plan, y por qué

| El plan decía | Lo entregado | Por qué |
|---|---|---|
| «Los dos móviles son iPhone; Chromium emulado no es Safari. **Mucho más cercano**» | **WebKit de Playwright sin estrangular** | WebKit **no tiene CDP**: no se puede frenar la CPU ni la red. Sus tiempos son los de la máquina del CI, no los de un iPhone, y el WebKit de Playwright en Linux **no es el Safari de iOS**. «Mucho más cercano» **no es cierto en tiempo**; sí lo es en **compatibilidad** (¿arranca y pinta sin excepciones en un motor que no es Chromium?) |
| (implícito) una cifra de carga en WebKit comparable con los 4,5 s de la hipótesis H1 | **No hay** | Sin estrangular no se puede comparar con los 4 s de Chromium a CPU 4×. Lo que sale es la **razón** frente a Chromium sin estrangular en la misma máquina: dice si WebKit va peor, no cuánto tarda un iPhone |
| Medición con presupuesto | **Sin presupuesto en WebKit** | No hay ninguna cifra todavía y no he podido ejecutarlo: fijar un presupuesto sin datos sería inventarlo. Se decide tras unas semanas de CI |
| Paso del CI | **Informativo (`continue-on-error`)** | Un paso nuevo, con una instalación de WebKit y dependencias del sistema que no he podido probar aquí, **no debe poder impedir un despliegue**. Cuando haya varias ejecuciones estables, puede pasar a puerta (solo por excepciones de página, no por tiempo) |

## 3. Decisiones mías y riesgos a cuestionar

1. **Esto no responde a la pregunta de fondo** (¿cuánto tarda en un iPhone?). Para eso solo valen un cronómetro en el teléfono o una medida de uso real dentro de la app. Este paquete responde a otra: **¿se rompe algo en WebKit?**, y eso sí tiene valor.
2. **No he ejecutado WebKit ni una vez.** El único código de WebKit que no he podido probar es: el arranque con el perfil `iPhone 13` de Playwright, el comportamiento de `PerformanceObserver` (sin `layout-shift` ni `longtask`: se protege con `supportedEntryTypes`), y si el service worker funciona en ese WebKit (por eso la columna `serviceWorker`). **Puede fallar el paso del CI en su primera ejecución**; por eso es informativo y lo leeré en el registro del PR antes de dar el paquete por bueno.
3. **El perfil «iPhone 13» cambia el agente de usuario y la densidad de píxeles** respecto a la emulación de Chromium: las dos cifras no comparan solo el motor.
4. **La razón WebKit/Chromium depende de la máquina del CI** (CPU compartida): una sola ejecución es ruido; solo vale la tendencia de varias.
5. **Playwright en Linux usa un WebKit propio (no el de iOS):** el soporte de CSS/JS puede diferir en detalles (p. ej. dispositivos de entrada, `:has`, `dialog`). Un verde aquí **no garantiza** Safari.
6. El 50 % de «en curso» **sobrepuntúa** (≈ 0,75 de 1,5 sesiones) mientras no haya una ejecución real.

## 4. Pendiente

- Leer el primer registro real del paso de WebKit en el CI y, si falla por la herramienta, corregirla.
- Decidir con varias ejecuciones si el paso pasa a puerta (solo excepciones de página) y si se quiere un presupuesto relativo (razón máxima).
- **Del hogar:** una medida real en el iPhone (cronómetro desde tocar el icono hasta ver «Hoy» con la app ya instalada, 3 veces) sería la única respuesta a H1.
