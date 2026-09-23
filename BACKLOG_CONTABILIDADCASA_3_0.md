# Backlog — Contabilidadcasa 3.0 (cuarta auditoría crítica, cruzada y unificada)

## 0. Origen y cruce contra el código real

Nace de la auditoría crítica pedida por el usuario el 21 de septiembre de 2026, publicada primero
como documento independiente
[«Contabilidadcasa — Auditoría crítica y propuesta de mejoras»](https://claude.ai/artifact/LcC4gEUFDB4PAL3m9tfZK2)
(46 mejoras + 22 funcionalidades nuevas + propuesta técnica de un modelo de periodo único
mensual/trimestral/semestral/anual), cruzada después contra el código real y contra
`BACKLOG_CONTABILIDADCASA_2_0.md` — que seguía **vigente y sin cerrar** (10 tareas activas en
§1-§4 más 6 heredadas en §7), no histórico como en cruces anteriores. Misma disciplina que las
cuatro auditorías previas de este proyecto.

**Diferencia deliberada con esas cuatro auditorías anteriores:** la propia auditoría de origen
advierte, con evidencia del repositorio (64 motores de dominio, 419 tests, 42 enlaces en el menú
avanzado, cuatro rondas de 40-50 propuestas cerradas sin telemetría de uso que las respalde), de
que convertir mecánicamente sus 68 propuestas en 68 tareas nuevas repetiría el mismo patrón que
ella misma señala como riesgo. Este documento no lo hace: activa de inmediato solo lo que no
depende de saber qué se usa de verdad (arquitectura, el modelo de periodo, correcciones de
navegación/flujo ya evidenciadas), dice explícitamente qué correcciones exigió el cruce contra el
código real, y deja el resto — la mayoría de las 22 funcionalidades nuevas — en una cola separada
que no se activa sin datos de uso reales. Ver §5 para el razonamiento completo.

### 0.1 Correcciones que exigió el cruce contra el código real

| Propuesta de origen | Lo que decía la auditoría | Lo que dice el código real | Resolución |
|---|---|---|---|
| Mejora #9 («cerrar T15-T19») | Cinco hallazgos Nielsen pendientes | Las cinco (`T15`-`T19`) están **✅ cerradas** en `BACKLOG_CONTABILIDADCASA_2_0.md` §4, sesiones 199 y 208 — la auditoría de origen se basó en `OPT21_CHECKLIST_NIELSEN.md`, que no se había actualizado tras esos cierres | Retirada. No entra en este backlog. Corregir la checklist en `docs/OPT21_CHECKLIST_NIELSEN.md` queda como nota aparte, no tarea de producto |
| Mejoras #2 y #4 (módulos ES nativos, code splitting con `import()` dinámico) | Dividir `app.js` en módulos ES para reducir el blast radius | `T14` (2.0 §4) ya investigó exactamente esto en las sesiones 206-207: los tests cargan `app.js` con `vm.Script`, que **no soporta módulos ES** — introducir `import`/`export` sería un tercer sistema de modularización incompatible con el segundo (`views/*.js` con carga diferida, patrón ya probado en Deuda/Inversión/Escenarios). El hogar ya confirmó seguir con el patrón existente | Reformuladas como `ARQ-4`: continuar `T14` con el patrón ya decidido, nunca introducir `import`/`export` ni `import()` dinámico sin resolver antes el conflicto con `vm.Script` |
| Mejora #30 (comparador de periodos reutilizable) | Consolidar en un solo componente | `P11` (2.0 §1, cerrada sesión 210) ya construyó «mismo mes, año anterior» por categoría en Análisis | Alcance reducido: ya no hace falta el motor de comparación, solo homogeneizar el componente de UI cuando exista el selector de periodo único (`PER-4`) |
| Funcionalidad nueva #3 (informe semestral) | Nueva capacidad | `P12` (2.0 §1, cerrada sesión 210) ya extendió el informe trimestral (`GOB14`) a cadencia mensual reutilizando `gob14ReportBodyHtml()` sin motor nuevo | Confirmada y reforzada: añadir semestre es el mismo patrón una tercera vez, no una construcción distinta — entra en `PER-4` |
| Funcionalidad nueva #21 («pregunta rápida sin IA») | Alternativa determinista al Copiloto/IA | `BACKLOG_CONTABILIDADCASA_2_0.md` §7 ya documenta que la superficie de Copiloto/IA no tiene consumidor de UI desde la sesión 42 y sigue bloqueada por `A5-1` | Mantenida como `NAV-5`, explícitamente como puente barato mientras `A5-1` no esté en producción — no la sustituye, la evita mientras tanto |

Ninguna otra propuesta de la auditoría de origen encontró conflicto con código real o con una
decisión de producto ya tomada.

## 1. Bloque 0 — antes que cualquier otra cosa

| ID | Tarea | Esfuerzo | Beneficio | Nota |
|---|---|---|---|---|
| `ARQ-0` | ~~Telemetría de uso mínima y privada~~ — **ya existía de fábrica, cerrada el 22 de septiembre de 2026 (sesión 220)** | S | Muy alto | Error de la propia auditoría de origen, mismo patrón que la Mejora #9 (§0.1): el contador de visitas por pantalla (`VISIT_COUNTS_KEY`/`recordViewVisit`/`viewVisitSummary`, `app.js`) ya existía desde `T-4` (22 de agosto de 2026) y ya se había redescubierto una vez, en `OPT-2` (29 de agosto). Registra automáticamente las ~40 pantallas de la app desde esa fecha — el «un mes antes de decidir la Cola B» que pedía esta fila ya se había cumplido cuando se escribió este documento. Lo único que faltaba de verdad, y es lo que construyó la sesión 220: un informe (`usoAppRows`/`renderAjustesUsoApp`, panel «Uso de la app» en Ajustes) que muestra el contador de las ~40 pantallas, no solo de las 17 heredadas de Laboratorio. Detalle completo en el cierre de sesión 220 de `PROJECT_STATE.md`. |

## 2. Cola A — activa ya (no depende de datos de uso)

Arquitectura, el modelo de periodo pedido explícitamente por el usuario, y las correcciones de
navegación/flujo con evidencia ya documentada (Nielsen, densidad de Ajustes/menú). Esfuerzo y
beneficio como en el resto del proyecto: S/M/L y Bajo/Medio/Alto/Muy alto.

### 2.1 Modelo de periodo único (`PER`) — el foco pedido explícitamente

| ID | Tarea | Esfuerzo | Beneficio | Nota |
|---|---|---|---|---|
| `PER-1` | ~~Nuevo módulo `canonical-period.js`~~ — **cerrada el 22 de septiembre de 2026 (sesión 221)** | M | Alto | `periodKey`/`periodUnit`/`periodRange`/`periodLabel`/`adjacentPeriod` para `month`\|`quarter`\|`semester`\|`year`, con 24 pruebas propias (`tests/canonical-period.test.cjs`). Generaliza lo que `CanonicalBudgetSchema` resolvía por separado para trimestre/año (`BUD-3`). Sin motor de negocio propio, solo cálculo de rangos de fecha y claves — `periodRange` coincide exactamente con `quarterRange`/`annualRange` (verificado con una prueba cruzada, antes y después de `PER-2`). |
| `PER-2` | ~~Migrar `CanonicalBudgetSchema`...~~ — **cerrada el 22 de septiembre de 2026 (sesión 221)** | S | Medio | `currentQuarterKey`/`quarterRange`/`currentYearKey`/`annualRange` delegan en `canonical-period.js`, API pública intacta, los 69 tests de `BUD-3`/`canonical-period` en verde. Primera dependencia entre dos `canonical-*.js` del proyecto (hasta ahora cada uno era autónomo) — resuelta con `require` relativo en Node y con el orden de `<script>` de `index.html` en el navegador, sin un tercer mecanismo de módulos (mismo criterio que `ARQ-4`/`T14`: nada de `import`/`export`). |
| `PER-3` | ~~Añadir `semester`...~~ — **cerrada el 22 de septiembre de 2026 (sesión 221), sin coste aparte** | S | Alto | Generalizar `canonical-period.js` para las cuatro cadencias a la vez costó lo mismo que hacerlo para tres y añadir la cuarta después — `PER-1` ya la incluyó de fábrica. «Semestral» deja de ser una cadencia ausente del código. |
| `PER-4` | ~~Selector de periodo único de UI...~~ — **cerrada el 22 de septiembre de 2026 (sesión 221), con alcance recortado a propósito** | M | Alto | Construida en Presupuesto (semestre añadido al toggle existente, con las 7 funciones que ramificaban por `periodType`) y Previsión (resumen agregado por periodo, concepto nuevo — no existía ninguno antes); en Análisis solo se añadió persistencia por pantalla (A-4 ya tenía "semestre" como preset de ventana móvil, un concepto distinto y deliberado — sustituirlo por el semestre natural de `canonical-period.js` habría cambiado el resultado de cascadas ya construidas sin que el hogar lo pidiera, así que no se tocó). **Salud financiera queda fuera, decisión explícita del hogar** en esta misma sesión: no tenía ningún concepto de periodo previo, y qué significaría uno ahí es una decisión de producto, no una reutilización. El informe semestral (paralelo a GOB14/P12) sí se construyó completo. No hay "componente de UI único": cada pantalla sigue pintando su propio selector con su propio estilo (igual que el horizonte de Previsión o la ventana de Análisis ya hacían) — lo único compartido es dónde vive la preferencia (`PERIOD_SELECTOR_PREFERENCE_KEY`, primera vez que se persiste en Análisis/Presupuesto) y el cálculo de rangos/etiquetas (`canonical-period.js`). Detalle completo en el cierre de sesión 221 de `PROJECT_STATE.md`. |

### 2.2 Arquitectura y deuda técnica (`ARQ`)

| ID | Tarea | Esfuerzo | Beneficio | Nota |
|---|---|---|---|---|
| `ARQ-1` | ~~TypeScript incremental...~~ — **cerrada el 23 de septiembre de 2026 (sesión 224)** | M | Alto | `tsconfig.json` (`checkJs`+JSDoc, sin migrar sintaxis, compatible con `vm.Script`) enganchado a `npm run verify` vía `npm run typecheck`. Alcance completo: los 65 `canonical-*.js`, no un subconjunto — arrancó con 162 errores en 27 ficheros, terminó en 0, cada uno anotado con JSDoc describiendo la forma real de los datos. El gate encontró y corrigió 3 bugs reales en producción (no solo huecos de tipo): `number(value, fallback)` de `canonical-e13-scenarios.js` ignoraba su propio `fallback` (afectaba al valor por defecto de `quarters` en PVC5, sin cobertura de test); `.map(text)` en 4 ficheros pasaba el índice del array como `fallback` a `text()`, colándose como cita válida un valor vacío; un argumento muerto en una llamada a `decisionEventEntities`. Detalle completo en el cierre de sesión 224 de `PROJECT_STATE.md`. |
| `ARQ-2` | ~~ESLint con reglas mínimas...~~ — **cerrada el 22 de septiembre de 2026 (sesión 223)** | S | Medio | `eslint.config.js` en la raíz, enganchado a `npm run verify` (`npm run lint`). Solo tres reglas: `no-unused-vars` (con `vars: "local"` — sin ESM/bundler, cada función declarada arriba del todo en `app.js`/`views/*.js`/`canonical-*.js` es un global consumido desde otro fichero que ESLint no ve fichero a fichero, así que solo se comprueban variables locales; `ignoreRestSiblings` para el patrón `const { preview, ...clean } = x` ya extendido por la app), `eqeqeq` y `complexity` (techo 90 para app.js/views/canonical-*, 40 para tools/backend/tests — medido contra el código real, no un ideal de diseño). Única excepción: `init()` en `app.js` (complejidad 313, deuda ya documentada de `ARQ-4`/`T14`), con `eslint-disable-next-line` explícito. Limpiadas ~30 variables locales muertas reales que el propio linter encontró al construir el gate (ninguna función global se tocó). Una de ellas no era realmente muerta: `cirbeReduction` en `views/debt-liquidation-plan.js` se calculaba pero nunca se mostraba junto a los dos totales CIRBE (dic 2025/mayo 2026) que sí se mostraban por separado en el panel «Fuentes y presión» — pedido de vuelta el mismo hogar en esta sesión, se añadió como la reducción entre ambos en ese mismo panel, sin motor nuevo. |
| `ARQ-3` | Detección sistemática de código muerto/huérfano: motores `canonical-*.js` sin consumidor real de UI, y auditoría de las 10 pantallas del grupo «legacy» del menú avanzado con la misma vara que `OPT-24` aplicó a Ajustes (16/62 tarjetas eran configuración real) | M | Medio | `BACKLOG_INDICE.md` ya documenta un caso (Copiloto/IA, sin consumidor desde la sesión 42); aplicar la misma verificación a los otros 63 módulos de forma sistemática, no solo cuando surge la pregunta. |
| `ARQ-4` | Continuación de `T14` (2.0 §4) con el patrón ya decidido — más incrementos de `views/*.js` con carga diferida sobre el resto de `app.js` | L | Alto | **No** introduce `import`/`export` ni `import()` dinámico (conflicto confirmado con `vm.Script`, ver §0.1). `T14` documenta que quedan bloqueadas permanentemente 4 pantallas por refresco eager sin guarda (Nueva vida/Agente de ahorro/Visual Detail/Reconciliation) — revisar si alguna puede desbloquearse cambiando el propio patrón de refresco antes de darlas por perdidas. |

### 2.3 Navegación y arquitectura de información (`NAV`)

| ID | Tarea | Esfuerzo | Beneficio | Nota |
|---|---|---|---|---|
| `NAV-1` | Subcabeceras visibles para el grupo «Analizar» del menú avanzado (24 enlaces: Deuda/Inversión/Seguros/Fiscal/Patrimonio) | S | Medio | Las agrupaciones ya existen en el código (`navigation-structure.test.cjs` las nombra); hacerlas visibles en la UI, no solo en el test. |
| `NAV-2` | Buscador Cmd/Ctrl+K con resultados ponderados por frecuencia de uso real | M | Alto | Depende de `ARQ-0`. El buscador ya existe (`e17-experience.js`, `T2` cerrada) — esto es ordenar sus resultados por uso real en vez de solo por coincidencia de texto. |
| `NAV-3` | Recorrido de onboarding de las 3 pantallas diarias (Hoy/Registrar/Plan) antes de exponer el menú avanzado completo | M | Medio | Reduce la carga cognitiva inicial si alguien sin 200+ sesiones de contexto acumulado necesita entrar. |
| `NAV-4` | Breadcrumbs o indicador de ubicación en las pestañas de segundo nivel (5 de Inversión, 4 de Deuda) | S | Bajo | Heurístico 6 de Nielsen (reconocer, no recordar), mismo criterio que ya aplicó `T17`. |
| `NAV-5` | Atajo de «pregunta rápida» determinista (sin IA externa): búsqueda estructurada sobre datos ya calculados que devuelve una cifra con procedencia, sin navegar | M | Medio | Puente barato mientras `A5-1` (Copiloto/IA) siga bloqueado en producción — ver §0.1. No requiere backend nuevo: reutiliza `unifiedActionCenterModel`/citación de procedencia ya existente. |

### 2.4 Flujos diarios (`FLU`) — subconjunto con evidencia ya documentada

| ID | Tarea | Esfuerzo | Beneficio | Nota |
|---|---|---|---|---|
| `FLU-1` | Test automático que fije la regla de 4 bloques de Home (`OPT-8`) como invariante, no solo como disciplina | S | Medio | `T18` (2.0 §4) verificó que Home cumple hoy la regla (3 artículos + 2 rejillas) — nada que arreglar, pero nada la protege hacia adelante si una tarjeta nueva se añade sin cuidado. Un test que cuente elementos de `.home-primary-section` y falle por encima del umbral. |
| `FLU-2` | Atajo de un clic «registrar gasto nuevo» visible desde Home | S | Alto | La acción más frecuente de la app debe ser la más barata de ejecutar desde cualquier pantalla, no solo desde Registrar. |
| `FLU-3` | Modo móvil específico para Plan, mismo criterio que `uxb1` (Presupuesto) | M | Medio | Plan es una de las tres pantallas de uso diario; hoy no tiene el mismo tratamiento móvil dedicado que Presupuesto y Registrar. |

### 2.5 Rigor financiero (`FIN`)

| ID | Tarea | Esfuerzo | Beneficio | Nota |
|---|---|---|---|---|
| `FIN-1` | Guardarraíl único de liquidez mínima compartido entre cancelación de deuda (`DEB15`), apalancamiento y rebalanceo de inversión | M | Alto | Verificar que las tres decisiones usan el mismo umbral de colchón — evita que el sistema dé dos recomendaciones contradictorias sobre cuánta liquidez es segura tocar. |
| `FIN-2` | Test de integración fiscal cruzada: IRPF + dividendos + plusvalías + compensación de pérdidas en el mismo ejercicio | M | Medio | Los cuatro motores (`canonical-irpf-estimator.js`, `canonical-dividend-tax.js`, `fc1`-`fc5`) están separados; el riesgo real es un evento que toca varios a la vez sin un test que verifique la suma conjunta. |

### 2.6 Proceso y gobernanza del propio proyecto (`PROC`)

| ID | Tarea | Esfuerzo | Beneficio | Nota |
|---|---|---|---|---|
| `PROC-1` | Criterio de entrada al backlog basado en fricción medida, no en «buena idea» | — | Alto | Decisión de proceso, no de código: cualquier propuesta nueva a partir de ahora cita evidencia (uso real vía `ARQ-0`, o petición explícita del hogar) antes de entrar en una cola activa. Es la aplicación directa de la advertencia de §0. |
| `PROC-2` | Memorizar la checklist mensual de Nielsen (`OPT-21`) como paso explícito del flujo de cierre de sesión cuando corresponda el mes | S | Medio | Ya existe el proceso; falta que no dependa de que alguien se acuerde. De paso, corrige `docs/OPT21_CHECKLIST_NIELSEN.md` para reflejar que `T15`-`T19` ya están cerradas (ver §0.1). |

## 3. Descartado tras el cruce

| Propuesta de origen | Motivo |
|---|---|
| Mejora #9 («cerrar T15-T19») | Ya resuelto — ver §0.1 |
| Mejoras #2/#4 originales (módulos ES / `import()` dinámico) | Reemplazadas por `ARQ-4`, que respeta la decisión ya tomada en `T14` — ver §0.1 |

## 4. Cola B — en espera de señal de uso real

El resto de las propuestas de la auditoría de origen (21 mejoras adicionales de las 46, y 21 de
las 22 funcionalidades nuevas tras extraer `PER-4`/`NAV-5`) **no se numeran ni se activan aquí**.
Están completas, con su razonamiento, en el documento de origen
([artifact](https://claude.ai/artifact/LcC4gEUFDB4PAL3m9tfZK2), Partes A y B). La condición de
activación son dos: **el contador corriendo al menos un mes** (cumplida desde antes de escribir
este documento — ver `ARQ-0` en §1 — y ahora también visible en el informe «Uso de la app» de
Ajustes) y una conversación explícita del hogar sobre qué pantallas se abren de verdad, todavía
pendiente. Activarlas sin esa conversación repetiría exactamente el patrón que la auditoría de
origen señala como riesgo (§0). Cuando llegue ese momento, la priorización
dentro de la Cola B debería favorecer visualización/consistencia (menor riesgo, mayor alcance)
sobre las funcionalidades nuevas más especulativas (simulador de reubicación, widget nativo, modo
demostración), que la propia auditoría de origen ya marca como las primeras candidatas a recortar.

## 5. Heredado de `BACKLOG_CONTABILIDADCASA_2_0.md` (sigue vigente, no se duplica aquí)

`BACKLOG_CONTABILIDADCASA_2_0.md` **no se cierra ni se sustituye** — sigue siendo la fuente de
detalle de estas 16 tareas, todavía activas en sus §1-§4 y §7. Se listan aquí solo para que la
priorización de §6 sea una sola secuencia, sin tener que cruzar dos documentos:

| Tarea | Qué falta | Condición | Fuente de detalle |
|---|---|---|---|
| ~~`I5`~~ | ~~Rescate de pensiones (reducción por antigüedad + modalidad renta)~~ — **cerrada el 22 de septiembre de 2026 (sesión 223)** | — | 2.0 §2 |
| `T9` | Migración mobile-first, siguiente incremento auditado | Ninguna — mismo perfil de riesgo que las 4 fases ya publicadas | 2.0 §4 |
| `D1` | Retirar o mantener el sandbox visual de deuda | Aparcada — revisión futura sin fecha, el hogar confirmó que aporta valor real | 2.0 §3 |
| `D6` | Benchmark de mercado real en el radar de refinanciación | Necesita fuente de datos externa (manual o trimestral) | 2.0 §3 |
| `I3` | Mapa de calor de correlación calculada | Condicionada a que `I2` acumule historial real de valoraciones | 2.0 §2 |
| `I6` | Fiscalidad de cripto/derivados/intradía | Aparcada — sin posiciones de este tipo hoy, se revisa si cambia | 2.0 §2 |
| `I13` | Reparto de un ingreso extraordinario | Pendiente confirmar con el hogar el comparador exacto | 2.0 §2 |
| `P4` | Dígesto semanal de reforecast (interino) | Bloqueada por `A5-4` (push en producción) | 2.0 §1 |
| `P10` | «Ajusta este supuesto en una frase» (interino) | Bloqueada por `A5-1` (IA en producción) | 2.0 §1 |
| `OPT-10`-`OPT-13` | Sin esfuerzo propio, solo esperar | Reloj de 30 días de `OPT-2`, cumple hacia el 28-29/09/2026 | `BACKLOG_INDICE.md` |
| `RGX3` | Construir la tarea | `A5-1` en producción real | 2.0 §7 |
| `DEX6` | Construir la tarea | `A5-1` en producción real | 2.0 §7 |
| `GOB5` | Construir la tarea | `A5-4` en producción real | 2.0 §7 |
| `O-6` | Contratar proveedor PSD2 | Decisión de contratación, fuera del equipo de desarrollo | 2.0 §7 |
| Copiloto/IA — UI | Construir pantalla nueva desde cero | `A5-1` en producción real, más trabajo de UI sin priorizar | 2.0 §7 |

## 6. Plan priorizado único

| Horizonte | Qué | Por qué en este orden |
|---|---|---|
| 1 — ya, solo | ~~`ARQ-0`~~ — cerrada el 22/09/2026 (sesión 220), el contador ya existía de fábrica | Prerrequisito de toda decisión posterior, incluida la del propio horizonte 5. Cerrada sin construir telemetría nueva — ver §1 |
| 2 — este trimestre | ~~`PER-1`→`PER-2`→`PER-3`→`PER-4`~~ cerradas (22/09/2026, sesión 221; `PER-4` con alcance recortado, ver su fila en §2.1); ~~`I5`~~ cerrada (22/09/2026, sesión 223); ~~`ARQ-2`~~ cerrada (22/09/2026, sesión 223); ~~`ARQ-1`~~ cerrada (23/09/2026, sesión 224) — **horizonte 2 completo** | El bloque completo del modelo de periodo queda cerrado esta sesión, con una excepción deliberada: la salud financiera se queda sin selector de periodo, decisión explícita del hogar (no tenía ningún concepto de periodo previo del que partir). Con `ARQ-1` cerrada, no queda ninguna tarea pendiente en este horizonte — lo siguiente es el horizonte 3 |
| 3 — este semestre | `ARQ-3`, `ARQ-4` (continúa `T14`), `T9` (heredada), `NAV-1`, `NAV-2`, `NAV-4`, `FLU-1`, `FLU-2`, `FIN-1` | Impacto directo en uso diario y deuda técnica, sin requerir motores nuevos ni depender de telemetría |
| 4 — coste medio, sin urgencia | `NAV-3`, `NAV-5`, `FLU-3`, `FIN-2`, `PROC-1`, `PROC-2`; revisar `D1`/`D6`/`I3`/`I6`/`I13` (heredadas) según sus propias condiciones | Sin bloqueo externo, pero de menor urgencia que el horizonte 3 |
| 5 — condicionado por terceros, sin trabajo propio hoy | `OPT-10`-`OPT-13` (calendario), `RGX3`/`DEX6`/`GOB5` (`A5-1`/`A5-4`), `O-6` (PSD2), Copiloto/IA-UI, `P4`/`P10` | Vigilar las condiciones, no construir mientras no se cumplan — mismo criterio que ya aplica `BACKLOG_CONTABILIDADCASA_2_0.md` |
| 6 — gated por la conversación del hogar | Cola B completa (§4) | El dato de uso ya existe (informe «Uso de la app», §1); falta la conversación explícita del hogar mirándolo antes de activar nada |

## 7. Advertencia

Igual que en `BACKLOG_CONTABILIDADCASA_2_0.md` §8: ninguna tarea de este documento cambia los
invariantes ya vigentes del proyecto (`A11-4`, disciplina fiscal de nunca fabricar un tramo sin
fuente completa, ningún motor decide ni sustituye asesoría profesional real). `ARQ-0` no recoge
ni transmite datos personales — solo qué pantalla se abrió y cuándo. `PER-3`/`PER-4` no cambian
ningún cálculo financiero existente, solo la cadencia en la que se presenta.
