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
| `cb_apr`, `bk_apr` | Supuesto | **Contratos** (la TAE es del contrato; SVD-2) |
| `cb_extra`, `cb_extra_month`, `bk_extra`, `bk_extra_month` (D1 fase 1) | **Sin clasificar** | Simulador (SVD-1 los clasifica) |
| `acct_<id>_*`, los nueve campos por cuenta adicional (D1 fase 2) | **Sin clasificar** | Simulador, salvo `apr` (Contratos) |
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
