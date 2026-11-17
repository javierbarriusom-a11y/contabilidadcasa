# SVD · Simulador visual de deuda conectado — diseño y plan de implementación

> **Petición del hogar, 17/11/2026:** «Quiero que incluyas un nuevo bloque de trabajo: que el simulador visual de deuda se
> alimente de los datos del resto de secciones y que a la vez los datos actualicen el resto de secciones cuando
> corresponda. Inclúyelo en el backlog y haz un plan de implementación.»
>
> Bloque **SVD** del backlog vivo (`BACKLOG_NOVIEMBRE_OLEADA_1.md` §5.8). **Sin importes ni nombres del hogar.** Los
> ejemplos usan contratos inventados.

---

## 1. Qué es hoy el simulador (leído en el código el 17/11)

`#deuda-simulador` (Deuda › Simulador visual) es una página aparte, `debt-roadmap.html` (64 KB, CSS y JS propios), metida
en un `iframe` y con su motor, `legacy-debt-roadmap-engine.js`. Simula quitas, pagos únicos, refinanciaciones, suspensión y
calendario por cuenta, con perfiles A/B/C, «Tu configuración», tareas, notas y supuestos de negociación. **Según el
historial (sesiones 255-257, septiembre), el hogar confirmó que es la herramienta de una negociación real y activa con dos
acreedores** (cuentas `cb` y `bk`), con un tercero ya resuelto.

### 1.1 Lo que entra (app → simulador)

Mensaje `finance-debt-roadmap-hydrate`, al cargar el `iframe` y en cada recálculo de la app (`sendDebtRoadmapState`).
Contenido (`canonical-e14-debt-adapter.js`, `buildReadModel`):

| Dato | De dónde | Problema |
|---|---|---|
| `cb_amount`, `bk_amount` | Capital del contrato que se llame **literalmente** «Entidad A» / «Entidad B» | Son los nombres de los **contratos de ejemplo**: con los contratos reales del hogar, las dos cuentas principales se quedan sin enlace (`ambiguous`) |
| `extraDebts` | El resto de contratos vivos, **solo capital** y estado | Sin TAE, cuota, plazo ni atrasos: el simulador usa sus valores por defecto |
| `liquidity`, `monthly`, `baseMonth` | Previsión: liquidez inicial, **media** de capacidad libre, primer mes | Una media plana: no ve los meses justos ni el suelo |
| `roadmapState` | El estado que el propio simulador devolvió | — |

### 1.2 Lo que sale (simulador → app)

| Mensaje | Qué hace | Problema |
|---|---|---|
| `finance-debt-roadmap-state` | Guarda todo el estado del simulador en `debtRoadmapState` (copia y nube) | Además, el `iframe` guarda su propia copia en su `localStorage` (`planDeudaV5SinEntidad C`): dos copias |
| `finance-debt-roadmap-send-offer` | Crea o actualiza una **oferta borrador** (E14b) para la cuenta; al aplicarla desde Deuda › Ruta, con confirmación, se crea una decisión en el plan (`debtLiquidations`) | **No cambia el contrato.** Contratos, «Camino a deuda cero», Préstamo y el titular de deuda de Hoy siguen viendo la deuda como antes de pactar |
| `finance-debt-roadmap-height` | Ajusta la altura del `iframe` | — |

### 1.3 Diagnóstico

1. **Enlace por nombre a los ejemplos:** cuando el hogar quite los contratos de ejemplo, el simulador pierde sus dos cuentas
   principales.
2. **Lectura pobre:** el simulador no ve TAE, cuota, plazo, estado de impago, recibos pagados, suelo ni la capacidad mes a mes.
3. **Escritura a medias:** un acuerdo llega al plan como decisión, pero no al contrato. El resto de secciones queda incoherente.
4. **Dos motores:** el simulador proyecta con el motor heredado y Ruta/Préstamo con el canónico (NTC-05). Con los mismos datos
   pueden dar fechas distintas.
5. **Dos copias del estado:** la de la app y la del `iframe`.
6. **Fuera del sistema de diseño:** página aparte sin tema v2. Hay que comprobar que axe y la prueba de desbordes del móvil
   miren dentro del `iframe` (SVD-0).

---

## 2. Principios del bloque

1. **Una sola fuente por dato.**
   - Contratos es dueño de la deuda declarada: capital, TAE, cuota, plazo, estado y atrasos.
   - La Previsión es dueña de la liquidez, el suelo y la capacidad.
   - El simulador solo es dueño de **sus supuestos**: quita, mes, pago único, financiación, perfil, tareas y notas.
   - En el simulador, lo canónico se ve **de solo lectura**, con su origen («de Contratos · cambiar allí»).
2. **Leer siempre; escribir solo cuando corresponde.** La lectura es automática y viva. La escritura hacia el resto de
   secciones pasa siempre por una hoja «Qué ocurrirá» (decisión 6 del rediseño): dice qué cambia y en qué pantalla, y se
   puede deshacer. Nunca se escribe en silencio.
3. **Lo que se escribe depende del estado del acuerdo**:

   | Estado | Qué escribe fuera del simulador |
   |---|---|
   | Simulando | Nada |
   | Propuesto a la entidad | Una tarea con fecha (calendario y «Decidir esta semana»), opcional |
   | Aceptado por escrito | **Contrato** (estado, capital, cuota, plazo), **plan** (pago único y cuotas nuevas) y **acta** de la decisión; Hoy, Previsión, Ruta y Préstamo se recalculan con ello |
   | Cumplido | El contrato pasa a «liquidada» cuando el extracto trae el pago (recibos detectados); recordatorio para pedir el certificado |

4. **Deriva visible:** si un dato canónico cambia después de montar una simulación («el capital pasó de A a B»), el simulador
   lo dice en la cuenta y no recalcula a escondidas.
5. **Un solo motor de proyección** al final del bloque: el simulador proyecta con `canonical-debt-payoff-path.js` o, mientras
   no, una prueba de paridad (`canonical-e14-parity.js`) lo vigila con los mismos datos.
6. **Reglas del repositorio:**
   - `app.js` sin líneas nuevas: el puente sale a `deuda-simulador-puente.js`, lo que de paso libera margen bajo el techo.
   - Toda clave nueva, en `BACKUP_LOCAL_STORES`.
   - ARQ-3: como mucho un motor nuevo (`canonical-debt-agreements.js`), o ninguno si cabe en `canonical-debt-contracts.js`.
   - XGO-01: nada visible por defecto sin retirar otra cosa.
   - Sin conexiones externas (NTC-06).

---

## 3. El mapa de datos objetivo

### 3.1 Lectura (modelo de lectura v2, `finance-e14-debt-roadmap-read-model/v2`)

| Dato | Origen | Para qué en el simulador |
|---|---|---|
| Por contrato: id, entidad, tipo, capital, TAE, cuota, plazo, estado | Deuda › Contratos (`canonical-debt-contracts.js`) | Cuentas enlazadas **por id**, sin nombres fijos |
| Por contrato: atraso (importe, desde, si está vencido entero, si figura en un fichero) | Contratos, con el estado «En impago» (DEC-24, que este bloque absorbe) | La quita y el pago único se calculan sobre lo exigible, no sobre la cuota |
| Por contrato: último recibo, cuota cobrada, si sigue viva | `canonical-debt-receipts.js` | Progreso real y detección de «ya pagado» |
| Liquidez inicial, suelo y reserva | Previsión y Ajustes | El guardarraíl de caja del simulador usa el suelo del hogar, no uno propio |
| Capacidad libre **mes a mes** (12 meses) | Motor mensual (la misma serie que Previsión) | Los pagos únicos caen en meses posibles, no en una media |
| Extra al mes para la deuda | Deuda › Ruta (control «Extra al mes») | Mismo punto de partida que Ruta |
| Condiciones del préstamo simulado | Deuda › Préstamo | Refinanciación prellenada como opción |
| Escenarios guardados (nombres) | Escenarios › Guardados | Saber si una estrategia ya está guardada |
| Huella y fecha de cada fuente | Todas | Detectar deriva (principio 4) |

### 3.2 Escritura (simulador → resto de secciones)

| Acción en el simulador | Mensaje | Qué cambia fuera | Dónde se ve |
|---|---|---|---|
| «Guardar como escenario» | `finance-debt-roadmap-save-scenario` | Un escenario de solo lectura en Escenarios › Guardados (lo mismo que FX-21) | Plan › Previsión «O un escenario guardado», Escenarios › Comparar |
| «Lo hemos propuesto a la entidad» con fecha de respuesta | `finance-debt-roadmap-task` | Una tarea con fecha | «Decidir esta semana» en Hoy y el `.ics` (sin importes) |
| «La entidad lo ha aceptado» → «Aplicar el acuerdo» | `finance-debt-roadmap-agreement` | **En una sola operación con un solo «Deshacer»:** contrato (estado, capital nuevo, cuota, plazo, quita anotada), decisión en el plan (pago único y cuotas) y entrada en el acta | Contratos, Ruta, Préstamo, Previsión, Hoy (deuda y disponible), Cierre del mes del pago |
| Enviar la estrategia como oferta (hoy) | `finance-debt-roadmap-send-offer` | Se mantiene mientras exista E14b; con SVD-3 se integra en «Aplicar el acuerdo» | — |

### 3.3 Vuelta (resto de secciones → simulador), sin intervención

- Se edita un contrato en Contratos: la cuenta se actualiza y, si había simulación, avisa de la deriva.
- El extracto trae el pago pactado (recibos detectados): la cuenta pasa a «cumplido» y propone marcar el contrato como
  liquidado (con confirmación).
- Se deshace la decisión en el plan: el acuerdo vuelve a «aceptado sin aplicar» y lo dice.
- Cambian las condiciones de Préstamo: la refinanciación prellenada se actualiza si no se había tocado a mano.
- Un contrato se liquida o se borra: su cuenta se retira y sus supuestos quedan archivados (no se pierden).

---

## 4. Riesgos que el diseño tiene que cerrar

| Riesgo | Cómo se cierra |
|---|---|
| **Contar dos veces** un acuerdo (bajar el capital en el contrato y además restar el pago en el plan) | Regla única: el contrato guarda la **deuda que queda**; el plan guarda el **dinero que sale**. Invariante en pruebas: tras aplicar, la deuda total de Hoy = suma de capitales de Contratos; la liquidez de Previsión baja exactamente el pago único y las cuotas nuevas |
| Escribir sobre un dato que el hogar cambió después | La hoja «Qué ocurrirá» compara con la huella de la lectura y se niega si hay deriva («el capital ha cambiado desde tu simulación: revísala») |
| Perder lo tecleado en el simulador al migrar `cb`/`bk` a cuentas por id | Migración idempotente con copia previa del estado (`debtRoadmapState` antes de migrar, en la copia de seguridad) y prueba de ida y vuelta |
| Romper la paridad histórica A9-8 (lee `cb_*`/`bk_*` por nombre) | Se mantiene mientras existan esas claves; retirarla se consulta (CLAUDE.md: no se retira nada en uso) |
| Dos motores con fechas distintas | Paridad vigilada en pruebas desde SVD-2; un solo motor en SVD-6 |
| Datos del hogar en el repositorio | Pruebas con contratos inventados («Banco FICTICIO»); `check-public-privacy` |
| Coherencia con decisiones vigentes | No toca la previsión salvo por decisiones confirmadas (como hoy). D-N11 no se levanta: el bloque arranca cuando el hogar lo diga (§6) |

---

## 5. Plan de implementación (siete PR)

Esfuerzo: S ≤ 1 sesión, M 2-3, L 4+. Cada PR, con su prueba, su entrada en `PROJECT_STATE.md`, la batería completa de
navegador antes de subir, Safari en el CI y publicación según CLAUDE.md.

### SVD-0 · Inventario, contrato y pruebas de lo que hay (S, sin cambio visible)

- Prueba que **demuestra el fallo del enlace por nombre**: con contratos sin «Entidad A/B», hoy `cb_amount`/`bk_amount` salen
  ambiguos.
- Prueba dorada del mensaje de hidratación y del estado que devuelve el simulador (antes de cambiarlos).
- Inventario completo de los campos de `debtRoadmapState` con dueño (lo canónico, los supuestos, lo operativo y las notas;
  hoy `FIELD_INVENTORY`), incluidos los que añadieron D1 fases 1 y 2 (`cb_extra`, `acct_*`).
- Comprobar si axe y `check-mobile-overflow` miran dentro del `iframe`; si no, añadirlo a esas pruebas (sin arreglar aún).
- **Hecho cuando:** las pruebas pasan describiendo el comportamiento de hoy y el inventario está en este documento.

### SVD-1 · El puente sale de `app.js` y enlaza por contrato (M)

- `setupDebtRoadmapBridge`, `sendDebtRoadmapState`, `receiveDebtRoadmapOffer` y `debtRoadmapCanonicalReadModel` pasan a
  `deuda-simulador-puente.js` (desalojo sin cambiar una coma, como PR-1 a PR-4) y `app.js` baja de líneas.
- Enlace **por id de contrato**: cada cuenta del simulador es `acct_<id>`; las de ejemplo «Entidad A/B» siguen como `cb`/`bk`
  mientras existan (paridad A9-8 intacta).
- Si el estado guardado tiene supuestos en `cb_*`/`bk_*` y ya no hay contratos de ejemplo, el simulador pregunta una vez
  «¿A qué contrato corresponde lo que teníais en la cuenta A?», con la lista de contratos reales, y migra los supuestos.
- Una sola copia del estado: el `iframe` deja de escribir en su `localStorage` cuando está dentro de la app; solo lo hace
  abierto suelto.
- **Hecho cuando:** con contratos inventados sin nombres de ejemplo, cada contrato tiene su cuenta y sus supuestos sobreviven
  a recargar; la migración se prueba de ida y vuelta.

### SVD-2 · Lectura completa y deriva (M)

- Modelo de lectura v2 (§3.1): TAE, cuota, plazo, estado, atrasos (con el estado «En impago» de DEC-24, que se construye
  aquí), último recibo, capacidad mes a mes, suelo, extra de Ruta y condiciones de Préstamo.
- En el simulador, lo canónico de solo lectura con su origen y un enlace a cambiarlo; los supuestos, editables.
- Aviso de deriva por cuenta.
- Paridad: con las mismas entradas, la fecha de fin y los intereses del simulador frente a «Camino a deuda cero», en
  `canonical-e14-parity.js`.
- **Hecho cuando:** cambiar la TAE de un contrato en Contratos se ve en el simulador sin recargar, y una simulación montada
  antes avisa de la deriva.

### SVD-3 · Acuerdo aceptado → resto de secciones (L, el núcleo de la petición)

- Estados del acuerdo (§2.3) por cuenta, guardados en `debtRoadmapState`.
- «Aplicar el acuerdo» abre la hoja «Qué ocurrirá»:
  - el contrato antes y después;
  - el dinero que sale y cuándo;
  - el punto más bajo de la previsión antes y después, frente al suelo;
  - la fecha de deuda cero antes y después.
- Al confirmar, en una sola operación atómica:
  - el contrato se actualiza (`canonical-debt-contracts.js`, o un motor `canonical-debt-agreements.js` si no cabe);
  - se crea la decisión en el plan (el `applyDebtDecision` de siempre);
  - se anota la entrada en el acta.
- Un solo «Deshacer» devuelve las tres cosas.
- Invariante de no contar dos veces (§4) en pruebas unitarias y e2e.
- **Hecho cuando:** un acuerdo inventado aplicado cambia, con las mismas cifras, Contratos, Ruta, Préstamo, Previsión y la
  deuda de Hoy, y «Deshacer» lo devuelve todo.

### SVD-4 · Escenarios y tareas (S-M)

- «Guardar como escenario» desde el simulador hacia Escenarios › Guardados; se ve en Previsión «O un escenario guardado».
- «Lo hemos propuesto» con fecha de respuesta: una tarea en «Decidir esta semana» y en el `.ics`.
- **Hecho cuando:** la estrategia guardada sale en Previsión con la misma liquidez que en el simulador (paridad de cierre de
  mes, como FX-20).

### SVD-5 · La vuelta: lo que pasa fuera se ve dentro (S-M)

- Lo del §3.3:
  - pago detectado en el extracto → «cumplido» y propuesta de liquidar el contrato;
  - decisión deshecha → acuerdo sin aplicar;
  - contrato liquidado o borrado → supuestos archivados.
- Línea en el simulador «Desde vuestra última visita: …» con lo que ha cambiado fuera.
- **Hecho cuando:** importar un extracto inventado con el pago pactado marca la cuenta como cumplida y propone liquidar.

### SVD-6 · Simulador nativo (L, P2, se consulta antes)

- Pasar el simulador del `iframe` a una vista (`views/deuda-simulador.js`) con el tema v2, 390 px, axe en claro y oscuro, y el
  motor canónico; retirar `debt-roadmap.html` y `legacy-debt-roadmap-engine.js` tras dos versiones con paridad en verde.
- Encaja con D3 (Deuda en una pantalla) y NTC-05. **Retirar el `iframe` se consulta al hogar.**

### Resumen

| PR | Esfuerzo | Depende de | Cambio visible |
|---|---|---|---|
| SVD-0 | S | — | No |
| SVD-1 | M | SVD-0 | Nombres reales en el simulador; migración de una vez |
| SVD-2 | M | SVD-1 | Datos de Contratos y Previsión dentro del simulador; deriva |
| SVD-3 | L | SVD-2 | «Aplicar el acuerdo» actualiza Contratos, plan, Ruta, Préstamo, Previsión y Hoy |
| SVD-4 | S-M | SVD-2 | Guardar como escenario; tareas con fecha |
| SVD-5 | S-M | SVD-3 | El simulador refleja pagos y cambios de fuera |
| SVD-6 | L | SVD-5, NTC-05 | Simulador nativo; retirada del `iframe` (se consulta) |

Total: entre 10 y 14 sesiones. El valor para el hogar llega con SVD-3; SVD-0 a SVD-2 son el camino seguro hasta ahí.

---

## 6. Cuándo empieza y qué se necesita del hogar

- **SVD-0 puede empezar ya:** solo pruebas e inventario, no cambia ninguna pantalla ni cifra.
- **SVD-1 en adelante tocan Deuda.** En este hilo quedó dicho que antes de tocar Deuda o Préstamo hay que saber cuál es la
  foto vigente de la deuda (D-N16, décima auditoría §7). La respuesta no cambia el plan, pero sí los datos con que se prueba
  y el orden de SVD-2 (si hay impagos, el estado «En impago» va primero).
- **D-N20 · Arranque de SVD:** ¿empieza SVD-1 ya, aunque D-N11 (prioridad a clasificar hasta el 4/12) siga vigente, o
  después del 4/12? Recomendación: SVD-0 ahora y SVD-1 a SVD-3 en cuanto llegue D-N16, porque la negociación con las
  entidades no espera al cierre de noviembre.
- **D-N21 · Qué cuenta como «aceptado»:** ¿basta con marcarlo el hogar, o se exige adjuntar el documento de la entidad (el
  adjunto de recibos que ya existe) antes de poder aplicar? Recomendación: exigir el documento para quitas y planes de pago.

---

## 7. SVD-0 · resultado (17/11/2026)

Pruebas: `tests/svd0-simulador-contrato.test.cjs` (6) y, en `tests/opt4-axe-accessibility.spec.cjs`, «SVD-0 · Simulador
visual de deuda (iframe)». Describen lo de hoy: cuando un PR del bloque las rompa, se actualizan a propósito.

### 7.1 Inventario de lo que guarda el simulador (`collect()` de `debt-roadmap.html`)

| Campo | Dueño hoy (`FIELD_INVENTORY`) | Dueño según SVD |
|---|---|---|
| `tasks`, `scenario`, `agreement` | Operativo | Simulador (el acuerdo gana estados en SVD-3) |
| `profile`, `buffer`, `preserveCash`, `fc_months`, `referenceAPR` | Supuesto | Simulador; `buffer` debería leerse del suelo del hogar (SVD-2) |
| `cb_*` / `bk_*`: `strategy`, `discount`, `start`, `lump`, `term`, `finance_pct` | Supuesto | Simulador |
| `cb_apr`, `bk_apr` | Supuesto | Simulador. **Corregido en SVD-2:** es la TAE de la *refinanciación* (el préstamo nuevo), no la del contrato; la del contrato llega aparte, de solo lectura |
| `cb_extra`, `cb_extra_month`, `bk_extra`, `bk_extra_month` (D1 fase 1) | **Sin clasificar** | Simulador (SVD-1 los clasifica) |
| `acct_<id>_*`, los nueve campos por cuenta adicional (D1 fase 2) | **Sin clasificar** | Simulador (`apr` también es la de la refinanciación) |
| `wizink_hito_mes` | Operativo | Simulador (un hito de una deuda ya resuelta) |
| `notes` | Nota | Simulador |
| `cb_amount`, `bk_amount`, `liquidity`, `monthly`, `baseMonth` | Canónico (no se guardan desde el simulador) | Contratos y Previsión |

### 7.2 Lo que no miraba ninguna prueba

Medido con el simulador abierto suelto (`/debt-roadmap.html`), Chromium:

| Ancho | Alto de la página | axe crítico | axe serio |
|---|---|---|---|
| 390 px | 17.833 px (unas 21 pantallas) | 25 campos sin etiqueta, 3 desplegables sin nombre | 16 de contraste, 1 zona con desplazamiento sin foco |
| 1.440 px | 8.988 px | los mismos 28 | 75 de contraste |

Nada se sale por la derecha. El tope de 28 críticos queda como trinquete en el CI; SVD-2 (o SVD-6, si se hace nativo
antes) tiene que bajarlo a 0.

---

## 8. SVD-1 · resultado (17/11/2026)

**Decisiones del hogar del 17/11:**

- **D-N16:** «La foto real de la deuda es los contratos que subí a la app el domingo».
- **D-N20:** «Empieza svd1 ya».
- **D-N21:** «Lo aceptado lo marco yo manualmente y subo un justificante». SVD-3 exigirá el justificante antes de dejar
  aplicar un acuerdo.

**Fallo que tenía el hogar desde que quitó los contratos de ejemplo**, medido con dos contratos inventados que suman
7.500 €:

- el simulador partía de **18.000 €**;
- las cuentas fijas «Entidad A / gestor» y «Entidad B» seguían en el cálculo con su saldo de ejemplo (4.000 y 6.500 €),
  porque el modelo canónico las dejaba «ambiguas» sin saldo y el simulador conservaba el que tenía;
- cualquier pago único, pico de caja o duración que diera llevaba esa deuda inexistente encima.

**Qué cambia:**

| Pieza | Cambio |
|---|---|
| `canonical-e14-debt-adapter.js` | `fixedAccountStatus`: una cuenta fija está «enlazada» (un contrato con su nombre), «sin-contrato» (ninguno: saldo 0) o «ambigua» (varios: sin saldo, como antes). `fixedAccounts` en el modelo de lectura. El inventario clasifica la aportación extra, `acct_<id>_<campo>` y `migracion` |
| `debt-roadmap.html` | Las cuentas fijas sin contrato salen del cálculo, de la tabla y del gráfico, y se ocultan. Si había algo simulado en ellas, pregunta una vez a qué contrato real pasarlo (copia estrategia, quita, mes, pago único, TAE, plazo, % financiado y aportación extra; nunca el saldo), con «Deshacer» y «No corresponde a ninguno». Dentro de la app ya no escribe su propia copia en `localStorage`; la que hubiera se rescata una vez si la app no tiene ninguna |
| `deuda-simulador-puente.js` | Las cinco funciones del puente, sacadas de `app.js` sin cambiar una coma (32.091 → 32.024 líneas; techo 32.203 → 32.155) |

**Pruebas:**

- `tests/svd1-simulador-enlace.test.cjs` (4);
- `tests/svd0-simulador-contrato.test.cjs`, con tres pruebas actualizadas a propósito para describir lo nuevo;
- `tests/d1-fase2-cuentas-canonicas.test.cjs` (2 actualizadas);
- la del desalojo en `tests/xgo01-sin-funciones-duplicadas.test.cjs`;
- e2e «SVD-1 · Simulador visual de deuda con los contratos reales» (2): cuentas fijas fuera, migración con deshacer y
  persistencia, sin copia en el `iframe`, y el rescate.

**Pendiente para SVD-2:**

- el texto de los avisos del simulador sigue hablando de «Entidad C» y de la negociación de septiembre;
- la TAE sigue siendo un supuesto del simulador;
- de los contratos reales llega solo el capital.

---

## 9. SVD-2 · resultado (17/11/2026) y lo que pasa a SVD-2b

**Petición del hogar:** «Sigue con SVD-2».

**Qué llega ahora al simulador** (modelo de lectura v2, `finance-e14-debt-roadmap-read-model/v2`, sin quitar nada de v1):

- **Por contrato:**
  - TAE, cuota, cuotas pendientes, estado, pagos suspendidos, atraso estimado y sus meses, y si es revolving;
  - lo que no se sabe llega en `null`, nunca 0: una TAE por confirmar no es un 0 %;
  - una huella (`contractFingerprint`) con capital, TAE, cuota, cuotas pendientes, estado y atraso.
- **De la previsión:** la capacidad de cada uno de los 12 primeros meses, además de la media de siempre.
- **El suelo del hogar:** la reserva operativa, enviada por `deuda-simulador-puente.js`.

**Qué se ve:**

- **En cada cuenta real**, bajo su título, «De Contratos, solo lectura: capital · TAE · cuota · cuotas pendientes · estado · atraso · revolving», con el enlace «Cambiarlo en Deuda › Contratos». Las cifras van como en la app (miles con punto).
- **Deriva:** si el contrato cambia después de haberlo visto en el simulador, la cuenta dice qué cambió («TAE: 21,9 → 19,5»), sin recalcular a escondidas, con «Entendido». Lo visto se guarda con el estado (`acct_<id>_base`).
- **Bajo la calculadora de capacidad:**
  - entre cuánto y cuánto deja la previsión al mes y cuál es el mes más justo;
  - si el mes más caro del escenario no cabe en ese mes;
  - el suelo del hogar, y un aviso si la reserva a preservar queda por debajo.
- **Sin contratos de ejemplo**, los textos de la negociación de septiembre («Entidad C…») ya no se dicen.
- **Accesibilidad:** cada etiqueta, unida a su campo. axe crítico a 390 px: **de 28 a 0**, y el trinquete del CI baja a 0. Queda el contraste (serio: 16 a 390 px y 75 a 1.440 px), que es del diseño propio del simulador, para SVD-6.

**Lo que NO hace, a propósito, y pasa a SVD-2b:**

1. **«Esperar» sigue sin pagar la cuota de ahora en el simulador.** Para que la pague hace falta decidir contra qué capacidad se compara. La parte de deuda de la previsión (`components.outflow.debt`) es **solo «coche + refinanciación», dos filas del plan**: no sale de los contratos de Deuda › Contratos. *(Corregido en §12: son todas las partidas de financiación del plan, no dos filas.)*
   - Si las cuotas de los contratos del hogar no están en el plan, la previsión es optimista y el simulador no puede restarlas «otra vez».
   - Si están como partidas, sí.
   - Hay que mirarlo con el plan del hogar antes de SVD-3: es el riesgo de contar dos veces de §4, y toca D-N12.
2. **Paridad de motores** (simulador frente a «Camino a deuda cero»): sin «Esperar» con cuota no hay un caso comparable.
3. **El margen mes a mes en el cálculo:** se enseña el mes más justo, pero el motor sigue usando la media, para no cambiar las cifras de antes sin decidirlo.

**Pruebas:**

- `tests/svd2-simulador-lectura.test.cjs` (5);
- actualizadas a propósito: `tests/canonical-e14-debt-adapter.test.cjs` (1) y `tests/svd0-simulador-contrato.test.cjs` (3, con la corrección de la TAE);
- e2e «SVD-2 · El simulador visual de deuda lee Contratos y avisa si cambian»: datos a la vista, sin «Entidad C», etiquetas, cambiar la TAE en Contratos, aviso, «Entendido» y que siga tras recargar;
- trinquete de axe a 0.

---

## 10. SVD-2b · resultado (17/11/2026)

**Decisión del hogar (D-N22):** «De momento, vamos con SVD-2b: que "Esperar" siga pagando la cuota de hoy y que el simulador
cuadre con Ruta. Después vendría SVD-3, aplicar un acuerdo aceptado con su justificante, y luego los ponemos realistas».

- Orden: SVD-2b → SVD-3 → poner los datos realistas.
- Se lee como meter las cuotas de los contratos en el plan y recalcular la previsión (D-N12).
- Mientras tanto, la casilla de abajo sirve para mirar el margen de las dos maneras.

**El motor del simulador** (`legacy-debt-roadmap-engine.js`) paga la **cuota de hoy** de cada contrato:

- con la misma cuenta que «Camino a deuda cero» (`canonical-debt-payoff-path.js`): interés sobre el saldo redondeado, la cuota o lo
  que quede, y saldado si lo que queda no pasa de la tolerancia (0,005 € con TAE declarada, 0,5 € con TAE deducida);
- en «Esperar», todos los meses; en las demás estrategias, hasta su mes de inicio;
- la quita, el pago único o la refinanciación se calculan **sobre lo que quede ese mes**, no sobre el saldo de hoy.

Sin cuota de hoy, el motor hace exactamente lo de antes; las pruebas antiguas no cambian.

**Qué contratos la pagan:** los que Ruta incluye, con sus mismas reglas.

- Han de estar activos y con cuota, y con TAE declarada o deducible de cuota y plazo. Para deducirla se usa la función de
  Ruta (`impliedMonthlyRate`), pasada al adaptador, no copiada.
- Los demás no pagan nada en «Esperar» y lo dicen: «No entra en Ruta (sin cuota activa / sin TAE ni plazo / la cuota y el
  plazo no cuadran con el capital)».

**Cuadre con Ruta:**

- el adaptador calcula «Camino a deuda cero» sin extra sobre **los mismos contratos** que simula el simulador y desde el mismo «hoy»
  que Deuda › Ruta;
- el simulador lo compara con su propio «todas en Esperar» y lo dice bajo la calculadora: «acaba en …, como Deuda › Ruta, y paga lo mismo»;
- si no coincide, avisa en negrita.

**Margen:** la casilla «Las cuotas de hoy de estos contratos ya están en el plan» va sin marcar de entrada.

- Sin marcar, el margen resta las cuotas que paga el simulador.
- Marcada, no las resta otra vez (`cuotasEnPlan` en el estado).
- Va sin marcar porque la deuda de la previsión es solo «coche + refinanciación» (§9). *(Corregido en §12: son todas las partidas de financiación del plan; desde SVD-R1 el simulador dice cuántas cuotas están.)*

**Dos fallos que ya existían, arreglados de paso:**

- **El mes base** del simulador era un desplegable con julio, agosto y septiembre de 2026. El mes de la previsión no estaba
  entre ellos y no se aplicaba, así que las etiquetas de los meses salían mal. Ahora el mes que llega se añade al desplegable.
- **Una cuenta real nueva entraba en «Quita y pago único»**, que con quita 0 % es pagarlo todo en el mes 1. Ahora entra en
  «Esperar». Lo ya guardado no cambia.

**Pruebas:**

- `tests/svd2b-esperar-cuota-ruta.test.cjs` (5):
  - reglas de Ruta;
  - mismo fin y mismo total pagado que Ruta, contrato a contrato, con TAE declarada y deducida;
  - suspendido sin pago;
  - margen con y sin la casilla;
  - quita sobre lo que queda el mes de inicio;
  - nada cambia sin cuota.
- `tests/canonical-e14-debt-adapter.test.cjs` (1 actualizada).
- e2e «SVD-2b · «Esperar» paga la cuota de hoy y el simulador cuadra con Ruta»: el mes coincide con el que enseña la pantalla
  de Ruta.

**Siguiente: SVD-3** (D-N21: el hogar marca el acuerdo como aceptado y sube un justificante).

---

## 11. SVD-3 · resultado (17/11/2026)

**Petición del hogar:** «Después vendría SVD-3, aplicar un acuerdo aceptado con su justificante» (D-N22), con D-N21: «Lo aceptado lo
marco yo manualmente y subo un justificante».

**Qué se ve:**

- **En el simulador, en cada cuenta con contrato real**, un botón «La entidad lo ha aceptado: aplicar el acuerdo». Toma lo que dice la
  cuenta: la estrategia, el pago único, la cuota, el plazo y el mes. Se niega, y dice por qué, en estos casos:
  - la cuenta está en «Esperar»;
  - no hay importe, o no hay cuota ni plazo;
  - el primer pago ya ha pasado o queda fuera de la previsión;
  - el contrato ya tiene un acuerdo aceptado;
  - la deuda ya tiene una decisión en el plan.
- **La hoja «Qué ocurrirá»** (en la app, fuera del `iframe`), antes de tocar nada:
  - el contrato hoy y con el acuerdo (total pactado, y la quita o lo que cuesta financiarla);
  - el dinero que sale;
  - el punto más bajo de la cuenta y la liquidez al final de la previsión, antes y después, con el suelo del hogar y un aviso si se baja de él;
  - la fecha de deuda cero de Ruta, antes y después;
  - **el justificante, obligatorio**: «Aplicar el acuerdo» no se activa sin él.
- **Al confirmar, en una sola operación:**
  - **el contrato** guarda el acuerdo, con su tipo, mes, importes, fecha, justificante y la decisión que lleva su dinero;
  - **el plan** recibe una decisión aprobada con el pago único y las cuotas pactadas (`applyDebtDecision` de siempre);
  - **el acta** anota esa decisión;
  - **el justificante** queda en el dispositivo, o cifrado en la nube con la clave de sesión (`P2PrivateStore`, el mismo de las fotos de recibos).
- **Un solo «Deshacer»** (30 s) devuelve el contrato, el plan, el acta y el flujo de decisiones a como estaban, y borra el justificante del dispositivo.
- **En Deuda › Contratos**, la fila dice «Acuerdo aceptado» con sus términos, y tiene dos botones:
  - «Ver justificante»;
  - «Quitar el acuerdo»: retira el acuerdo del contrato y cancela su decisión en el plan, con su entrada en el acta y su propio «Deshacer».
  Un acuerdo no cuenta como «Editado».
- **Ruta, Préstamo y Patrimonio** (`canonical-debt-payoff-path.js`) respetan el acuerdo desde su mes:
  - hasta ese mes, el contrato sigue con su cuota de hoy; si está suspendido, su saldo se queda quieto;
  - ese mes se paga el pago único y empiezan las cuotas pactadas;
  - con la última, la deuda queda saldada;
  - el extra de Ruta no va a una deuda con acuerdo, sino a la siguiente;
  - un contrato suspendido con acuerdo entra en Ruta (antes quedaba fuera por no tener cuota).
  Sin acuerdo aceptado, las cifras son exactamente las de antes: hay una prueba que lo comprueba.

**En qué se aparta del diseño del §5, y por qué:**

1. **El capital del contrato no se cambia.** El §5 decía «capital nuevo» en el contrato. Pero Hoy ya descuenta la deuda que cubre una
   decisión del plan (`plannedDebtPrincipalByTarget`). Bajar también el capital la habría descontado dos veces. La regla del §4 se cumple
   así: el contrato guarda la deuda y cómo se paga (el acuerdo), y el plan guarda el dinero que sale. Ruta, que no leía las decisiones del
   plan, ahora lee el acuerdo.
2. **El acuerdo se guarda junto a las correcciones del contrato** (`debtContractOverrides`), no en una clave nueva. Así viaja con la copia
   de seguridad y la sincronización de siempre, sin tocar `app.js`.
3. **La cuota de hoy solo deja de restarse en el plan si la casilla del simulador dice que está en el plan** (SVD-2b). Si no, sumar esa
   cuota «liberada» inventaría liquidez. Cuando se resta, empieza el mes siguiente al del acuerdo, porque es la regla de siempre de las
   decisiones de deuda: la previsión paga una cuota de más, lo que la deja del lado prudente.
4. **«Lo hemos propuesto» con fecha queda para SVD-4**, junto con las tareas, que es donde escribe fuera.
5. **Las cuentas de ejemplo (`cb`/`bk`) no tienen el botón:** solo las cuentas enlazadas a un contrato real.

**Límites que quedan a la vista:**

- **Una refinanciación aceptada** hace que Hoy dé la deuda por cubierta por el plan, como cualquier decisión de deuda de antes, aunque
  siga existiendo como préstamo nuevo. Ruta y Préstamo sí la ven hasta su última cuota.
- **«Deshacer» borra el justificante del dispositivo, pero no la copia cifrada de la nube**, si se subió. Queda huérfana, cifrada, y
  sin nada que apunte a ella.
- **El diálogo de la clave de sesión dice «esta foto»** aunque el justificante sea un PDF. Es el texto común del almacén privado.

**Pruebas:**

- `tests/svd3-acuerdo-aceptado.test.cjs` (12) comprueba:
  - el rastro del acuerdo en el contrato;
  - que sin acuerdo aceptado Ruta no cambia;
  - que Ruta respeta cada tipo de acuerdo: quita, refinanciación de un contrato suspendido, híbrido y acuerdo empezado antes del mes de partida;
  - que el extra no va a una deuda con acuerdo;
  - qué acuerdo sale de cada cuenta y por qué se niega;
  - la decisión del plan, con y sin la cuota en el plan;
  - que nada se cuenta dos veces: lo que sale del plan es lo pactado, el capital del contrato no cambia y Ruta paga lo mismo;
  - que el modelo de lectura marca el acuerdo y que la comparación con «todas en Esperar» lo deja fuera.
- Pruebas actualizadas a propósito: `canonical-e14-debt-adapter.test.cjs` (el campo `acuerdo`), `d1-d2-deuda-tabs-contratos.test.cjs`
  (las funciones nuevas de la fila) y `deuda-alta-varios-contratos.test.cjs` (versiones).
- e2e «SVD-3 · Aplicar un acuerdo aceptado con su justificante» (2):
  - el flujo entero desde el simulador: el contrato, el plan, el acta, Hoy (2.400 € menos), la previsión (1.500 € menos), Ruta
    (saldada el mes del acuerdo), el justificante en el dispositivo y «Deshacer» de todo;
  - Contratos: «Acuerdo aceptado», sin «Editado», y «Quitar el acuerdo».
- La hoja, a 390 px: axe sin fallos.

**Siguiente:** «ponerlos realistas» (D-N22). Se lee como meter las cuotas de los contratos en el plan y recalcular la previsión (D-N12).
Antes hay que confirmar con el hogar qué quiere decir.

---

## 12. SVD-R1 · ¿Están las cuotas en el plan? (17/11/2026, primer paso de «ponerlos realistas»)

**Por qué este paso y no otro:** «ponerlos realistas» (D-N22) se leía como «meter las cuotas de los contratos en el plan y recalcular
la previsión». Hacerlo a ciegas era arriesgado:

- si las cuotas ya están como partidas, meterlas otra vez haría que la previsión las pagase dos veces;
- si no están, la previsión es optimista.

Se pidió al hogar el dato. Mirando el código, se puede contestar sin preguntar.

**Corrección de un hallazgo anterior (§9 y §10):** escribí que la deuda de la previsión era «solo coche + refinanciación, dos filas del
plan». **No es así.**

- `refi` suma **todas** las partidas de gasto que `isFinancingPlanningRow` clasifica como financiación: las de una sección cuyo nombre
  contiene «financi», o cuyo concepto dice refinanciación, préstamo, tarjeta, crédito, Visa, Mastercard y similares.
- `car` suma las del coche.

Así que las cuotas de los contratos pueden estar ya en la previsión, como partidas de financiación de Plan › Mes. Lo que hacía falta
era cruzarlas.

**Qué hace:**

- **`matchPlanInstallments`** (`canonical-debt-contracts.js`, puro) cruza cada contrato con las partidas de financiación de un mes.
  Para enlazar usa el nombre de la entidad, sin palabras genéricas como «banco», «caja», «préstamo» o «tarjeta», y sin acentos. También
  sirven los 4 últimos dígitos del número de contrato. Cada partida se asigna a un solo contrato. El resultado de cada contrato es uno de estos:

  | Resultado | Cuándo |
  |---|---|
  | **en el plan** | una partida lleva su nombre y su importe (±2 % o ±1 €) |
  | **en el plan, otro importe** | una partida lleva su nombre, pero el importe es otro; se dice la diferencia |
  | **¿es esta?** | ninguna lleva su nombre, pero hay una única partida libre con el mismo importe; no se da por buena |
  | **no está en el plan** | ninguna de las anteriores: la previsión no paga esa cuota y es optimista en esa cifra |
  | **suspendido, pero en el plan** | el contrato no paga cuota, pero una partida con su nombre sí: la previsión es pesimista en esa cifra |

  Además, lista las partidas de financiación que no corresponden a ningún contrato: o son deudas que faltan en Contratos, o su nombre no
  dice la entidad.
- **El puente** (`svdCuotasPlanModelo`) lee las partidas del mes que viene con la misma función que la previsión
  (`planningBreakdownMemoized`), es decir, los gastos de tipo `refi`.
- **Deuda › Contratos** tiene un bloque plegado, «¿Están las cuotas en el plan? (mes)». Muestra cada contrato con su estado y su partida,
  la cifra que la previsión no paga o paga de más, y las partidas sin contrato. Es una lista, no una tabla, para que se lea a 390 px. **No cambia nada.**
- **En el simulador**, junto a la casilla «las cuotas ya están en el plan», una línea dice cuántas lo están según Plan › Mes y cuánto falta.
  **No marca la casilla**, porque nada se cambia en silencio.
- **Al aplicar un acuerdo (SVD-3), la cuota que deja de restarse es la de la partida del plan que lleva el nombre de la entidad**, con el
  importe de esa partida, que es el que resta la previsión. Antes se usaba la casilla, que vale para todas las cuentas a la vez. En los
  demás casos no se resta nada:
  - si no hay partida con su nombre;
  - si la partida es solo del mismo importe: la hoja lo dice («ponle el nombre en Plan › Mes»);
  - si el contrato está suspendido.

  La casilla solo se usa si el plan no se puede leer.

**Arreglado de paso:** el simulador escribía «1.500 € €» en el texto del acuerdo aceptado (SVD-3), porque `svdEuro` ya pone el símbolo.

**Lo que falta para «realistas»** es meter en el plan las cuotas que no están, o corregir las que tienen otro importe. Eso es escribir
en Plan › Mes, y se hará cuando el hogar vea el cuadre y diga cuáles. Las partidas «¿es esta?» y las que no tienen contrato las tiene
que mirar el hogar: la app no puede saber de quién son.

**Pruebas:**

- `tests/svdr1-cuotas-en-plan.test.cjs` (10):
  - los cinco estados;
  - que las palabras genéricas no enlazan y los acentos no estorban;
  - el número de contrato;
  - que una partida no se asigna dos veces;
  - la cobertura;
  - la cuota que deja de restarse;
  - el resumen del modelo de lectura;
  - que el puente lee los gastos `refi`.
- e2e «SVD-R1»: contrato con partida y sin ella; el bloque plegado de Contratos; la línea del simulador; el acuerdo, que resta la partida
  del plan aunque la casilla esté sin marcar; y sin «€ €».
- A 390 px, el bloque abierto no desborda y axe no da fallos.
