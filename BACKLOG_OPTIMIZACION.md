# Backlog de optimización — rendimiento, navegación y UX

> Mapa de todos los backlogs del repositorio: [`BACKLOG_INDICE.md`](BACKLOG_INDICE.md) (OPT-20).

> **El orden de ejecución de este documento quedó fusionado.** Desde el 29 de agosto de 2026, el
> orden de ejecución conjunto con `BACKLOG_PATRIMONIO_Y_FINANZAS.md` vive en `BACKLOG_UNIFICADO.md`.
> Este archivo conserva íntegro el detalle de cada tarea `OPT-*` (contexto, pasos, resultado
> esperado); para saber en qué orden se ejecuta junto al backlog de nuevas funcionalidades, ve a
> `BACKLOG_UNIFICADO.md`.

Fecha: 29 de agosto de 2026. Repositorio vivo: `javierbarriusom-a11y/contabilidadcasa`.

Este documento nace de una auditoría crítica pedida explícitamente por el usuario («analiza la app
de manera crítica... propuesta de mejoras y optimizaciones... con toda tu experiencia»), hecha sobre
el código real: estructura de `index.html`, tamaño y carga de `app.js`/`styles.css`/
`design-tokens.css`, navegación (`side-nav` y el desplegable «Herramientas avanzadas»),
`tools/check-performance.mjs`, `tools/check-accessibility.mjs` y `tools/build-public-site.mjs`. El
diagnóstico completo, con cifras y citas de archivo, quedó entregado en esa conversación; este
fichero recoge únicamente **las tareas que de ahí se derivan**.

**No es un sustituto de ningún backlog existente.** `BACKLOG.md` ordena la reconstrucción visual
pantalla por pantalla; `BACKLOG_OPERACION.md` ordena qué le falta al motor para resolver preguntas
de decisión concretas. Este ordena un eje distinto: **el coste de mantener y cargar la aplicación
tal como está hoy** — peso de carga, navegación duplicada, jerarquía visual de «Hoy», accesibilidad
verificada de verdad y disciplina de CSS. Usa el prefijo `OPT-`, sin solapar con ningún prefijo
existente (`O-`, `V-`, `T-`, `D-`, `P-`, `A-`, `C-`, `L-`).

El orden dentro de cada fase, y el orden entre fases, es **el que más devuelve por esfuerzo**, no un
orden técnico de dependencias — con una excepción explícita: ninguna tarea de la Fase 2 (fusión de
pantallas) debería empezar antes de tener los datos de uso real de OPT-2, para no repetir el patrón
de «se añade, nunca se quita» que causó el problema que esta fase corrige.

## Leyenda de estado

Misma leyenda que `BACKLOG.md` §0 y `BACKLOG_OPERACION.md`, para no introducir un cuarto vocabulario:

| | Significado |
|---|---|
| ✅ | Hecho, fusionado a `main` y verificado en el sitio publicado |
| 🟡 | Publicado pero parcial, con la omisión documentada y localizable |
| ⏳ | Pendiente, sin bloqueo: se puede empezar cuando se quiera |
| ⛔ | Bloqueado por algo externo al equipo o por otra tarea de este mismo backlog |

## 0. Tabla maestra

Orden de ejecución consolidado (todas las fases, un solo ranking) al final del documento, §6.

| Fase | Tarea | Resuelve | Impacto | Esfuerzo | Estado |
| --- | --- | --- | --- | --- | --- |
| 0 | OPT-1 | `<script>` bloqueantes en `index.html` | Alto | S | ⏳ |
| 0 | OPT-2 | Sin datos de uso real de pantallas heredadas | Alto (habilitador de Fase 2) | S | ⏳ |
| 0 | OPT-3 | `dist/` publica código fuente sin minificar | Alto | S | ⏳ |
| 0 | OPT-4 | Accesibilidad solo verificada estructuralmente (4 patrones) | Alto | S | ⏳ |
| 0 | OPT-5 | Presupuesto de rendimiento mide peso de fichero, no experiencia real | Alto | M | ⏳ |
| 1 | OPT-6 | Bloque de configuración («cobertura aprendida») dentro de «Hoy» | Medio | S | ⏳ |
| 1 | OPT-7 | Paneles completos de «modo familiar» y «alertas» compitiendo en «Hoy» | Medio-Alto | S-M | ⏳ |
| 1 | OPT-8 | «Hoy» sin jerarquía visual (10 módulos con el mismo peso) | Alto | M | ⏳ |
| 1 | OPT-9 | 23 `!important` en `styles.css` (guerras de especificidad) | Medio | M | ⏳ |
| 2 | OPT-10 | Clasificar pantallas heredadas por uso real | Crítico | S | ⛔ · depende de OPT-2 |
| 2 | OPT-11 | Retirar pantallas heredadas sin uso | Alto | M | ⛔ · depende de OPT-10 |
| 2 | OPT-12 | Migrar la función real que falta antes de retirar cada heredada con uso | Alto | M-L | ⛔ · depende de OPT-10 |
| 2 | OPT-13 | Retirar cada heredada en cuanto su función está cubierta | Crítico | L | ⛔ · depende de OPT-12 |
| 2 | OPT-14 | Fusionar los seis pares de pantallas gemelas documentados | Crítico | L | 🟡 · relegación y paridad confirmadas, retirada de código ⛔ depende de OPT-2 |
| 2 | OPT-15 | Menú lateral a 6 rutas principales, sin «Herramientas avanzadas» | Alto | S | ⛔ · depende de OPT-11 a OPT-14 |
| 3 | OPT-16 | Migrar módulos a ES modules | Medio (habilitador) | M-L | 🟡 · evaluada el 3-sep, no se ejecuta — ver ficha |
| 3 | OPT-17 | Carga diferida (`import()`) por vista activa | Alto | L | 🟡 · evaluada el 3-sep, no se ejecuta — ver ficha |
| 3 | OPT-18 | Verificar/activar compresión Brotli-Gzip del artefacto publicado | Medio | S | ⏳ |
| 4 | OPT-19 | Checklist de PR: reutilizar catálogo `.e19-*` antes de crear clase nueva | Medio | S, continuo | ⏳ |
| 4 | OPT-20 | Consolidar los backlogs y fases sueltas en una única fuente viva | Medio | M | ⏳ |
| 4 | OPT-21 | Checklist mensual de heurísticos de Nielsen sobre Hoy/Registrar/Plan | Medio | S, mensual | ⏳ |
| 4 | OPT-22 | Decidir y documentar el modelo Hogar/Javi/Tere (¿multiusuario real?) | Medio | S | ⏳ |

---

## 1. Fase 0 — Quick wins (riesgo ≈ 0)

Ninguna toca lógica de negocio ni motor de cálculo. Se hacen sin arriesgar las pruebas existentes.

### OPT-1 · `defer` en los `<script>` de `index.html`

**Por qué.** `index.html` carga ~60 etiquetas `<script>` síncronas y en orden (líneas 4008-4135:
`supabase-js`, `vendor/xlsx.full.min.js`, `data.js`, los `canonical-*.js`, `app.js`, `p2-ui.js`…),
sin `defer` ni `async` ni módulos. El navegador bloquea el parseo del HTML y el primer pintado hasta
descargar y ejecutar los ~60 ficheros, uno detrás de otro.

**Tareas:**
1. Añadir `defer` a cada `<script src="...">` del bloque (líneas 4008-4135). `defer` conserva el
   orden de ejecución declarado, así que no cambia el comportamiento — solo deja de bloquear el
   parseo del documento.
2. El `<script>` inline final (registro del Service Worker) no necesita `defer`: ya se ejecuta al
   final del documento y no depende de orden con los anteriores.
3. Verificar en el navegador que la app arranca igual (todas las pantallas, `npm run test:visual`)
   antes de dar la tarea por cerrada.

**Resultado esperado:** el HTML pinta antes de que termine de descargarse y ejecutarse todo el JS;
cero cambio de comportamiento funcional.

---

### OPT-2 · Instrumentar uso real de pantallas heredadas

**Por qué.** El menú «Herramientas avanzadas» mantiene 10 pantallas marcadas «Versiones anteriores»
a propósito («envolver, no sustituir», `docs/E19_SISTEMA_DISENO.md` §10) sin fecha de caducidad ni
dato de si alguien las visita. Sin esa medición, cualquier decisión de retirarlas es una apuesta, no
una decisión informada — y es el habilitador de toda la Fase 2.

**Tareas:**
1. Añadir un contador ligero en `localStorage` (una clave por ruta, incrementada al entrar en la
   sección) para las 10 rutas de `data-e17-group="legacy"` de `index.html` y, ya puestos, para las
   de `data-e17-group="analysis"`/`"data"` marcadas «(nuevo)» — para comparar uso nueva vs. heredada
   del mismo par.
2. Un panel mínimo de solo lectura (puede vivir en Ajustes o en la consola, no hace falta pulirlo)
   que vuelque esos contadores: ruta, visitas, última visita.
3. Dejarlo corriendo un mínimo de 30 días de uso real antes de leer los datos en OPT-10.

**Resultado esperado:** al cabo de 30 días, una tabla objetiva de qué pantalla heredada se usa y
cuál no, en vez de una suposición.

---

### OPT-3 · Minificar el artefacto publicado

**Por qué.** `tools/build-public-site.mjs` copia los ficheros fuente (`index.html`, `app.js`,
`styles.css`, `design-tokens.css`, todos los `canonical-*.js`…) **tal cual** a `dist/`, sin
minificar, sin bundlear, sin tree-shaking. `app.js` solo pesa 1,54 MB sin comprimir en el propio
repositorio.

**Tareas:**
1. Añadir `esbuild` (o `terser` para JS + `cssnano`/cualquier minificador CSS ligero) como
   dependencia de desarrollo.
2. En `tools/build-public-site.mjs`, minificar cada fichero de la lista blanca **al copiarlo** a
   `dist/`, sin tocar el fuente en el repositorio — el artefacto publicado cambia, el código fuente
   que se edita y testea no.
3. Verificar `npm run test:privacy` y `npm run test:smoke` contra el `dist/` minificado: deben seguir
   en verde, porque no cambia ninguna lógica, solo la representación del texto.

**Resultado esperado:** peso descargado por el usuario baja de forma sustancial en cada visita, sin
tocar una línea de lógica fuente ni el flujo de `npm run verify`.

---

### OPT-4 · Accesibilidad verificada de verdad

**Por qué.** `tools/check-accessibility.mjs` comprueba exactamente cuatro cosas: IDs duplicados,
cuatro patrones concretos de marcado y botones vacíos sin `aria-label`. No mide contraste, orden de
foco real, asociación de `<label>` en los ~30 formularios de la app, ni comportamiento con lector de
pantalla. El check en verde da una falsa sensación de cobertura.

**Tareas:**
1. Añadir `@axe-core/playwright` como dependencia de test.
2. Ejecutar `axe` contra las pantallas ya visitadas por `tests/qa1-flujos-completos.spec.cjs`
   (reutiliza la navegación que ese spec ya hace, no hace falta escribir un recorrido nuevo).
3. Añadir el resultado a `npm run verify` (o a un script `test:a11y-axe` separado si se prefiere no
   bloquear la publicación mientras se sanean los primeros hallazgos).
4. Triage de lo que salga: corregir lo barato de inmediato (contraste, `label` sin asociar), abrir
   tarea aparte para lo que requiera rediseño.

**Resultado esperado:** el check de accesibilidad deja de ser una ilusión de cuatro patrones y
empieza a medir lo que WCAG realmente exige.

---

### OPT-5 · Presupuesto de rendimiento real (Lighthouse CI)

**Por qué.** `tools/check-performance.mjs` solo verifica que `app.js + styles.css + data.js` no
superen 5 MB combinados y que ciertos cálculos síntéticos no tarden más de un par de segundos. No
mide LCP, INP ni CLS, ni nada en un navegador real ni en condición de red móvil — el pipeline puede
dar verde con una experiencia de carga mala.

**Tareas:**
1. Añadir Lighthouse CI (`@lhci/cli`) apuntando a `dist/` ya construido por `build:site`.
2. Fijar presupuesto explícito de LCP/INP/CLS acorde a una SPA de contenido financiero en red móvil
   media (por ejemplo LCP < 2,5 s, INP < 200 ms — ajustar tras la primera medición real, que dará la
   línea base).
3. Añadir el paso a `pages.yml`, después de `npm run verify` y antes del despliegue — o como parte
   del propio `verify` si el tiempo de CI lo permite.

**Resultado esperado:** el pipeline detecta regresiones de carga real en cada PR, no solo de peso de
fichero; sustituye el umbral de OPT-3 y da una línea base para medir el efecto de la Fase 3.

---

## 2. Fase 1 — «Hoy» y jerarquía visual

Toca solo presentación de la pantalla más visitada de la app, con los tests visuales existentes
(`tests/e18-visual-regression.spec.cjs`) como red de seguridad.

### OPT-6 · Sacar la configuración de «Hoy»

**Por qué.** El editor de «cobertura aprendida» (bloque H-3b, formulario con fecha de próximo
ingreso y gasto diario) es configuración puntual, no lectura diaria — no encaja en una pantalla que
el mockup original definía como «una lectura y tres decisiones» (1a).

**Tareas:**
1. Mover el bloque `#e6CoverageEditor` (o su equivalente en el render actual) de `#home` a
   `#ajustes`, manteniendo la misma lógica de guardado/reset («Usar aprendizaje»).
2. Dejar en «Hoy» solo la lectura (`#e6CoveragePanel`), sin el formulario de corrección.
3. Verificar con `tests/v1-2-asesor-en-hoy.test.cjs` y cualquier test que cubra el flujo de
   cobertura que nada se rompe al reubicar el formulario.

**Resultado esperado:** «Hoy» pierde un bloque de configuración; la corrección sigue siendo posible
desde Ajustes.

---

### OPT-7 · Resumir «modo familiar» y «alertas» en «Hoy»

**Por qué.** Ambos son paneles completos duplicando contenido que ya vive en su propia pantalla
(«Vista familiar», Centro de alertas), compitiendo por atención con las decisiones abiertas.

**Tareas:**
1. Sustituir el panel completo de `homeFamilySummary` por una línea de estado + enlace a la vista
   familiar completa.
2. Sustituir `homeAlertSummary` por un recuento («N alertas activas») + el botón «Configurar» que ya
   existe, sin repetir el desglose completo.
3. Verificar que el enlace a `alerts-center` (`data-home-nav="alerts-center"`) sigue funcionando.

**Resultado esperado:** menos peso visual en «Hoy»; la información completa sigue a un clic.

---

### OPT-8 · Jerarquía visual real en «Hoy»

**Por qué.** Los ~10 módulos de `#home` (rejilla de un vistazo, cobertura, mes en una línea,
decisiones abiertas, próximos hitos, KPIs, banda de 12 meses, familia, alertas) usan la misma
tarjeta `.home-panel` con el mismo peso visual. Nada le dice al usuario por dónde empezar a mirar.

**Tareas:**
1. Tras aplicar OPT-6 y OPT-7, definir un máximo de 4 bloques visibles sin scroll en desktop:
   cobertura, «el mes en una línea», decisiones abiertas, KPIs principales.
2. Dar peso tipográfico/de color distinto entre bloque principal (la cifra que responde «¿voy bien
   este mes?») y bloques de apoyo — usando los tokens ya existentes (`--e19-heading` vs.
   `--e19-muted`, tamaños de la escala E19) en vez de inventar nuevos.
3. El resto (banda de 12 meses, próximos hitos) pasa a una segunda sección con scroll, no eliminado.
4. Test manual de «regla de los 5 segundos»: un usuario nuevo debe poder decir si el mes va bien o
   mal mirando solo el primer scroll.

**Resultado esperado:** «Hoy» comunica una jerarquía clara en el primer vistazo, no diez tarjetas
del mismo peso.

---

### OPT-9 · Auditar los `!important` de `styles.css`

**Por qué.** 23 usos de `!important` en `styles.css` (más 2 en `design-tokens.css`) son casi siempre
síntoma de una regla más específica que debería reordenarse en la cascada, no de un caso legítimo —
el propio repo documenta al menos un caso real (`.e19-table tbody td` pisando `.positive`/
`.negative` de «Registrar el mes», resuelto con reglas de rescate).

**Tareas:**
1. Listar los 25 usos y, para cada uno, determinar si es necesario (interacción con estilos
   inyectados por JS, por ejemplo) o corregible reordenando/aumentando especificidad sin `!important`.
2. Corregir los corregibles, uno a uno, verificando visualmente cada pantalla afectada con
   `test:visual`.
3. Documentar los que se queden (si alguno) con un comentario que explique por qué es necesario.

**Resultado esperado:** menos guerras de especificidad futuras; el CSS deja de depender de parches
de rescate cuando se añade una pantalla nueva.

---

## 3. Fase 2 — Consolidación de navegación (ejecutar el rediseño a 6 vistas)

La fase de mayor impacto del backlog. El diseño **ya existe**
(`docs/mockups/HANDOFF_REDISENO_6_VISTAS.md`, decisión de producto tomada el 10 de agosto de 2026);
esto es ejecución, no diseño desde cero. **Ninguna tarea de esta fase empieza sin los datos de
OPT-2** — es la diferencia entre decidir con evidencia y repetir el patrón que causó el problema.

### OPT-10 · Clasificar pantallas heredadas por uso real

**Depende de:** OPT-2 con ≥30 días de datos.

**Tareas:**
1. Cruzar los contadores de OPT-2 con las 10 rutas `legacy` y sus pares «(nuevo)».
2. Clasificar cada una en dos grupos: «0 visitas → borrar sin más» vs. «se usa → qué función real
   tiene que no está en la nueva» (para cada una del segundo grupo, anotar la función concreta que
   falta, no «hay que revisarla»).

**Resultado esperado:** lista concreta y objetiva, no una suposición, de qué migrar de verdad y qué
eliminar.

---

### OPT-11 · Retirar pantallas heredadas sin uso

**Depende de:** OPT-10.

**Tareas por cada pantalla del grupo «0 visitas»:**
1. Borrar la sección de `index.html`, el enlace de menú (`data-e17-group="legacy"`), el CSS
   `.e19-<pantalla>` dedicado si existe, y los tests que solo prueban esa pantalla concreta (no los
   que prueban el motor subyacente, que sigue vivo).
2. Confirmar con `npm test` que nada más dependía de esa ruta.

**Resultado esperado:** el desplegable «Herramientas avanzadas» se reduce de inmediato, con esfuerzo
mínimo por pantalla.

---

### OPT-12 · Migrar la función real que falta

**Depende de:** OPT-10.

**Tareas por cada pantalla del grupo «se usa»:**
1. Migrar únicamente la función concreta anotada en OPT-10 a su pantalla nueva equivalente — no
   reconstruir la pantalla heredada entera.
2. Verificar en navegador que la pantalla nueva cubre ahora ese caso de uso.

**Resultado esperado:** se cierra la brecha funcional que hoy obliga a mantener cada duplicado vivo.

---

### OPT-13 · Retirar cada heredada en cuanto está cubierta

**Depende de:** OPT-12 (por cada pantalla, en cuanto su función esté migrada).

**Tareas:** igual que OPT-11, aplicado pantalla a pantalla según se completa OPT-12 — retirada real,
no mover a «Versiones anteriores» otra vez.

**Resultado esperado:** la navegación principal baja de forma sostenida hacia las 6 vistas objetivo
(Hoy, Plan, Deuda, Datos, Cierre, Ajustes).

---

### OPT-14 · Fusionar los seis pares de pantallas gemelas documentados

**Corrección del 3 de septiembre de 2026, sin cambio de código.** Esta tarea se redactó el 29 de
agosto como si los seis pares siguieran conviviendo por decidir; no era así. `BACKLOG.md` §3 registra
una decisión directa del usuario, tomada el **10 de agosto**: *«En vez de quitar las pantallas
fusionadas, pasarlas a una sección tipo Versiones anteriores»* — precisamente para no perder una
función que solo viviera en la heredada. Comprobado contra el sitio real: los seis pares de abajo
llevan relegados desde el 10-12 de agosto (V1-4, V2-8, V3-5, V4-6, V5-3), y `BACKLOG.md` §2 documenta,
vista por vista, que el propio usuario confirmó en el sitio publicado que cada pantalla nueva cubre lo
que se usaba de la heredada. Es decir: el trabajo de riesgo real de esta tarea —confirmar paridad de
función antes de tocar nada— **ya está hecho**, casi tres semanas antes de que este documento la
diera por pendiente.

Lo que **no** está hecho es la mitad literal de "fusionar... y retirar la heredada como en OPT-13":
el código de las seis heredadas sigue existiendo (relegar no es retirar). Retirarlo ahora, solo para
estos seis pares, crearía una excepción injustificada frente al resto de heredadas (OPT-10 a OPT-13),
que esperan a los datos reales de uso de OPT-2 precisamente para no repetir el patrón de decidir a
ciegas. Por eso el estado pasa a 🟡 (parcial, con la omisión documentada) en vez de ✅: la retirada de
código de estos seis pares se hace **junto con** OPT-11/OPT-12/OPT-13, bajo el mismo criterio de
evidencia, cuando el gate de 30 días de OPT-2 libere a finales de septiembre — no antes, y no como
tarea suelta.

**Tareas**, uno por par, siguiendo el mapa 4a de `docs/E19_SISTEMA_DISENO.md` §10:

| Nueva | Heredada a fundir | Relegada a «Versiones anteriores» / Laboratorio | Paridad confirmada por el usuario |
|---|---|---|---|
| `#conciliar` | `#reconciliation` | ✅ V5-3 (10 ago) | ✅ 12 ago |
| `#deuda-ruta` | `#debt-roadmap` | ✅ V3-5 (10 ago) | ✅ 12 ago |
| `#cuadro-mandos` | `#visual-detail` | ✅ V2-8 (10 ago) | ✅ 12 ago |
| `#registrar-mes` | `#update-data` | ✅ V4-6 (10 ago) | ✅ 12 ago |
| `#escenario-simular` | `#new-life-simulation` | ✅ V2-8 (10 ago) | ✅ 12 ago |
| `#asesor-decision` | `#executive-advisor` | ✅ V1-4 (11 ago) | ✅ 12 ago |

Para cada par: confirmar (con OPT-10/OPT-12 si aplica) que la nueva cubre todo lo que se usa de la
heredada —**hecho, las seis, ver tabla**—, y retirar la heredada **junto con** OPT-11/OPT-12/OPT-13,
no antes.

**Resultado esperado:** los 6 pares de pantallas gemelas dejan de existir como decisión pendiente de
producto —**hecho**—; su código deja de existir cuando se retire el resto de heredadas bajo datos
reales de uso.

---

### OPT-15 · Menú lateral a 6 rutas

**Depende de:** OPT-11 a OPT-14 completadas (o al menos las suficientes para que el desplegable
«Herramientas avanzadas» quede vacío o casi).

**Tareas:**
1. Reescribir `<nav class="side-nav">` de `index.html` a las 6 rutas principales (Hoy, Plan, Deuda,
   Datos, Cierre, Ajustes), retirando el `<details id="advancedNav">` si ya no le queda contenido.
2. Verificar `tests/navigation-structure.test.cjs` y ajustarlo al nuevo inventario de rutas.

**Resultado esperado:** navegación que cumple la Ley de Hick — decisión de a dónde ir en segundos,
no en un escaneo de ~29 enlaces.

---

## 4. Fase 3 — Rendimiento estructural

Paralelizable con la Fase 2; se beneficia de ella (menos pantallas → menos módulos que cargar).

### OPT-16 · Migrar a ES modules

**Evaluada el 3 de septiembre de 2026, sin cambio de código — no se ejecuta.** Antes de escribir
nada se investigó el alcance real, y la premisa clave de la tarea 3 ("`npm test` debe seguir en
verde sin cambios — es un cambio de mecanismo de carga, no de lógica") es falsa contra el estado
actual del repositorio:

- Los 61 `canonical-*.js` siguen el mismo patrón UMD (`module.exports` + global de respaldo) y los
  cargan **103 archivos de test** con `require(...)` directo. Un fichero con `export` nativo no se
  puede cargar con `require()` en Node sin marcarlo como módulo ES — como mínimo, esos 103 tests
  tendrían que reescribirse a `import()` asíncrono. Eso ya contradice "sin cambios".
- `app.js` y `p2-ui.js` (las dos piezas más grandes, y las que de verdad pesan) **nunca se cargan
  con `require()`**: **113 archivos de test** leen su código fuente como texto y extraen una
  función suelta para ejecutarla en un `vm.createContext` aislado con dependencias simuladas a
  mano. Convertirlos a ES modules de verdad arriesga romper esa técnica de forma sutil y difícil de
  verificar entera — el grueso de la cobertura de pruebas del proyecto (2935 pruebas) depende de
  ella.

Consultado con el usuario: se descarta la conversión a ES modules. Ver OPT-17 para la alternativa
evaluada y también descartada.

**Resultado esperado:** ninguno — tarea evaluada y no ejecutada. Si en el futuro cambia la técnica
de pruebas de `app.js`/`p2-ui.js` (por ejemplo, si se dividen en piezas más pequeñas por otro
motivo), esta evaluación debería repetirse desde cero, no darse por buena sin más.

---

### OPT-17 · Carga diferida por vista activa

**Evaluada el 3 de septiembre de 2026, sin cambio de código — no se ejecuta.** Descartada la
conversión a ES modules (OPT-16), se evaluó una alternativa que consigue el mismo objetivo sin
tocar el sistema de módulos: inyectar un `<script>` bajo demanda al navegar a cada vista, con la
misma técnica de carga perezosa ya usada en A17-3 para Tesseract.js (sin arriesgar los 216 archivos
de test que dependen de `require()`/`vm.createContext` sobre los ficheros actuales).

Se midió el techo real de esa alternativa contra `dist/` construido: `app.js` pesa **1,13 MB
minificado, el 77% de todo el JavaScript publicado** (1,40 MB en total). Los cinco `canonical-*.js`
más grandes —los candidatos naturales para diferir— suman entre todos **~65 KB, un 4,4% del
total**. `app.js` es exactamente el fichero descartado en OPT-16 por el riesgo sobre los 113 tests
de `vm.createContext`, así que queda fuera de cualquier estrategia de carga diferida sin ES
modules. El presupuesto de rendimiento real (OPT-5, Lighthouse) ya se cumple con margen amplio (LCP
medido ~1,4 s contra un límite de 6 s). Con eso, el ahorro máximo alcanzable —un solo dígito
porcentual sobre un presupuesto que ya pasa con holgura— no justifica el esfuerzo ni el riesgo de
tocar la carga de `app.js`.

**Resultado esperado:** ninguno — tarea evaluada y no ejecutada. Revisar si el presupuesto de
Lighthouse empieza a incumplirse de verdad, o si algún día se divide `app.js` en piezas más
pequeñas por otro motivo (lo que también reabriría OPT-16).

---

### OPT-18 · Verificar compresión del artefacto publicado

**Tareas:**
1. Comprobar si GitHub Pages ya sirve `dist/` con Brotli o Gzip por defecto (verificar cabeceras
   `content-encoding` en una petición real al sitio publicado).
2. Si no lo hace, evaluar alternativas (pre-comprimir en `build:site` y servir `.br`/`.gz` si el
   hosting lo permite, o documentar la limitación si no).

**Resultado esperado:** confirmación o corrección del tiempo de transferencia en red móvil, con dato
real en vez de suposición.

---

## 5. Fase 4 — Gobernanza continua

Sin fecha de cierre: disciplina que se mantiene indefinidamente desde que se empieza.

### OPT-19 · Checklist de reutilización de componentes en PR

**Tareas:** antes de crear una clase `.e19-<pantalla>` nueva, comprobar contra el catálogo de
`docs/E19_SISTEMA_DISENO.md` §3 (`.e19-card`, `.e19-btn-*`, `.e19-kpi`, `.e19-table`, `.e19-badge-*`,
`.e19-stepper`…) si ya existe algo reutilizable. Añadir la pregunta al hábito de revisión de cada
cambio de UI.

**Resultado esperado:** frena el crecimiento de las 82 clases `.e19-*` dispersas por pantalla.

---

### OPT-20 · Consolidar backlogs sueltos

**Tareas:**
1. Decidir una única fuente viva de «qué está pendiente» (candidato natural: `BACKLOG.md`).
2. Mover lo ya cerrado de `BACKLOG_STATUS.md` y los `PHASE_N.md` sueltos de la raíz a
   `docs/historial/` o a un `CHANGELOG.md`.
3. Dejar `BACKLOG_OPERACION.md` y este `BACKLOG_OPTIMIZACION.md` como los dos ejes activos
   restantes, cada uno con su prefijo, tal como ya conviven hoy.

**Resultado esperado:** menos ambigüedad sobre cuál de los backlogs manda en cada pregunta.

---

### OPT-21 · Checklist mensual de heurísticos de Nielsen

**Tareas:** una vez al mes, revisar Hoy/Registrar/Plan contra los 10 heurísticos de Nielsen y
documentar los hallazgos como una entrada más del backlog — mismo hábito de documentación que ya se
aplica al resto del proyecto.

**Resultado esperado:** detecta deriva de UX (como la de OPT-8) antes de que se acumule otra vez.

---

### OPT-22 · Decidir el modelo Hogar/Javi/Tere

**Tareas:** revisar si «Vista familiar» es hoy un filtro de lectura sobre un único dueño de datos o
si en algún momento se espera que sea multiusuario real con credenciales separadas, y documentar la
decisión explícitamente (aunque sea «sigue siendo un filtro de lectura, a propósito»).

**Resultado esperado:** evita que una mejora futura asuma multiusuario real sobre un modelo que no lo
es.

---

## 6. Orden de ejecución consolidado

1. OPT-1 → OPT-2 → OPT-3 → OPT-4 → OPT-5 *(Fase 0 completa primero; sin riesgo y sienta la base de
   datos y de medición que necesita todo lo demás)*
2. OPT-6 → OPT-7 → OPT-8 *(«Hoy» se arregla rápido y es lo que más se ve cada día)*
3. OPT-10 *(cuando OPT-2 lleve ~30 días corriendo)*
4. OPT-11 *(la parte «barata» de la Fase 2: borrar lo que tiene 0 uso)*
5. OPT-19 *(se activa en paralelo desde ya, coste continuo bajo)*
6. OPT-18 *(verificación rápida, en paralelo)*
7. OPT-9 *(limpieza de `!important`, sin prisa)*
8. OPT-12 → OPT-13 → OPT-14 → OPT-15 *(el grueso: fusión real de pantallas a 6 vistas)*
9. OPT-16 → OPT-17 *(ES modules + carga diferida, más natural una vez reducidas las pantallas)*
10. OPT-20 → OPT-21 → OPT-22 *(gobernanza, continua desde el principio pero sin fecha de cierre)*
