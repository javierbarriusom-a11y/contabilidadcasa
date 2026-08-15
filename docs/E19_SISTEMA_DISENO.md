# Sistema de diseño E19 — origen y catálogo de pantallas

Este documento es el que `design-tokens.css` cita desde su cabecera ("extraídos a un
lenguaje de tokens reutilizable en docs/E19_SISTEMA_DISENO.md") y que hasta ahora no
existía en el repositorio. Recoge de dónde sale el sistema de diseño E19, qué tokens y
componentes ya están construidos, y el catálogo completo de las pantallas mockup que
lo originaron — migradas o pendientes.

## 1. Origen

El sistema E19 nace de un documento de mockups aportado por el usuario ("Finanzas Casa ·
Mockups"), un canvas de diseño con bloques de exploración ("turns"). El usuario amplió el
material el 9 de agosto de 2026 con dos turnos nuevos, un prototipo navegable aparte y un
documento de entrega; todo ello está incorporado a este repositorio:

| Archivo | Qué es |
|---|---|
| `docs/mockups/finanzas-casa-mockups.dc.html` | Canvas de exploración: **cinco turnos, 25 variantes de pantalla**. Turnos 1-3 = el catálogo original de 15 pantallas; turno 4 = el rediseño completo a seis vistas; turno 5 = especificaciones de interacción y dos prototipos vivos |
| `docs/mockups/finanzas-casa-app.dc.html` | **Prototipo navegable** de las seis vistas del rediseño, con las interacciones reales (pie de impacto, importación en cuatro pasos, estrategias de deuda, cierre por tareas). La entrega lo señala como la referencia principal |
| `docs/mockups/HANDOFF_REDISENO_6_VISTAS.md` | Documento de entrega del rediseño: propósito de cada vista, comportamiento, estado, tokens y medidas exactas |
| `docs/mockups/screens/` | Capturas estáticas por pantalla (`1a`…`5d`, más `app-1`…`app-6`) |
| `docs/mockups/support.js` | Runtime del visor de canvas. No es diseño |

Es material de referencia interno del repositorio: no se sirve desde `index.html` ni se
enlaza al sitio público.

**Los dos `.dc.html` necesitan conexión a internet** para renderizar — el visor carga React
desde `unpkg.com` y la tipografía desde Google Fonts. Las capturas de `screens/` son la
copia legible sin red, y por eso se mantienen actualizadas junto a los canvas.

El propio mockup usa Inter como tipografía, fondo `#F0EEE9`, azul de acento `#0072E3` y
la paleta semántica (verde éxito, ámbar aviso, terracota deuda, rojo peligro) que
`design-tokens.css` reproduce exactamente — confirmando que los tokens ya en el repo
vienen literalmente de este documento, no de una interpretación libre.

## 2. Tokens (ya implementados en `design-tokens.css`)

### Superficies y bordes
| Token | Valor | Uso |
|---|---|---|
| `--e19-canvas` | `#f0eee9` | Fondo de página |
| `--e19-surface` | `#ffffff` | Tarjetas, tablas |
| `--e19-surface-soft` | `#fbfcf7` | Superficies secundarias (mockup: fondo de `.dv-card`) |
| `--e19-surface-sunken` | `#f6f4ee` | Cabeceras de tabla, fondos hundidos |
| `--e19-border` / `--e19-border-strong` | `#e8ecf1` / `#d8dde5` | Bordes suaves / marcados |

### Texto
| Token | Valor | Uso |
|---|---|---|
| `--e19-ink` | `#0b1220` | Texto principal |
| `--e19-heading` | `#293e5e` | Títulos |
| `--e19-muted` | `#5b6578` | Texto secundario |
| `--e19-faint` | `#a9b1bf` | Texto terciario / metadatos |
| `--e19-eyebrow` | `#049ff9` | Etiquetas "eyebrow" en mayúsculas (p. ej. "DECIDIR · ESCENARIOS DE VIDA") |

### Acento y semántica
| Token | Valor | Significado, siempre el mismo en toda la app |
|---|---|---|
| `--e19-accent` / `--e19-accent-hover` | `#0072e3` / `#005bb8` | Acción primaria |
| `--e19-accent-strong` | `#0b1a30` | Fondo oscuro (barra de impacto, tarjetas "recomendada") |
| `--e19-success` | `#1f9d55` | Positivo (aplicada, holgado, sube) |
| `--e19-warning` | `#c78b12` | Alerta suave (justo, roza el límite) |
| `--e19-debt` | `#ad725b` | Deuda (terracota, distinto de `danger`) |
| `--e19-danger` | `#c13b3b` | Rechazado, bajo reserva, rompe un límite |

### Tipografía y forma
Escala: `--e19-text-eyebrow` (11px) → `--e19-text-display` (28px), familia Inter con
fallback de sistema. Radios: `--e19-radius-sm` (8px, botones/inputs) → `--e19-radius-lg`
(14px, tarjetas) → `--e19-radius-pill` (badges/pills). Sombras: `--e19-shadow-card` sutil,
`--e19-shadow-pop` para estados hover/foco.

## 3. Componentes ya construidos

`.e19-card`, `.e19-card-strong`, `.e19-card-accent-soft` (superficies) · `.e19-btn-primary
/-secondary/-dark` (botones) · `.e19-kpi` con modificadores `.is-warn`/`.is-danger` y
`.e19-kpi-delta.is-up/-down/-warn` (métricas con highlight de estado) · `.e19-insight`
(lectura destacada con borde de color) · `.e19-badge-*` y `.e19-pill-*` (estado puntual vs.
histórico) · `.e19-table` (jerarquía por fila, alineación numérica) · `.e19-impact-bar`
(barra fija oscura para el resumen de impacto, ver mockup 3a) · `.e19-stepper`,
`.e19-route-card`, `.e19-explainer`, `.e19-next-step` (patrones de flujo guiado, de
`update-hub`/`data-entry`).

Patrón de aplicación: cada pantalla migrada añade una clase de ámbito propia
(`.e19-home`, `.e19-update-hub`, `.e19-data-entry`, `.e19-forecast`, `.e19-prevision`,
`.e19-escenario-motor`) y dentro de ella redefine solo lo que necesita — nunca toca una
clase o variable ya usada por otra pantalla. Es el mismo principio de "envolver, no
sustituir" que rige el resto del código (E14, E20): la piel visual se añade capa a capa,
nunca se reescribe.

## 4. Catálogo de las pantallas del mockup

Los cinco bloques ("turns") del documento y sus variantes, con la pantalla real de la app
a la que corresponden y su estado de migración a día de hoy. Los turnos 1-3 son el catálogo
original de 15 pantallas — el que ha guiado todo lo construido hasta E20-3. Los turnos 4 y 5
llegaron después (ver §10) y **proponen una arquitectura distinta**, no una continuación:
no tienen "estado de migración" porque no se ha decidido todavía si se adoptan.

### Turno 1 — Finanzas Casa · rediseño de escritorio (1280px)

| # | Título del mockup | Pantalla real | Estado |
|---|---|---|---|
| 1a | Hoy · navegación reducida a cuatro verbos, una lectura y tres decisiones | `#home` | ✅ Migrada (E19-2) |
| 1b | Plan de deuda · ruta como línea de tiempo (dataviz A) | `#deuda-ruta` | ✅ Migrada (E20-2) |
| 1c | Plan de deuda · comparador de estrategias (dataviz B) | `#deuda-comparar` | ✅ Migrada (E20-2, parcial — ver nota) |
| 1d | Asesor ejecutivo · una decisión abierta a la vez | `#asesor-decision` | ✅ Migrada (E20-2, parcial — ver nota) |
| 1e | Simulación nueva vida · simular → comparar → aplicar en una sola vista | `#escenario-simular` | ✅ Migrada (E20-1) |
| 1f | Actualizar mis datos · hub ordenado por lo que tienes delante | `#update-hub` | ✅ Migrada (E19-3) |
| 1g | Conciliación · las diferencias como tareas, no como tablas | `#conciliar` | ✅ Migrada (E20-2) |

### Turno 2 — Entrada y actualización de datos · previsión · aplicación de escenarios

| # | Título del mockup | Pantalla real | Estado |
|---|---|---|---|
| 2a | Registrar el mes · una fila por partida, guardado automático | `#registrar-mes` | ✅ Migrada (E20-4, completa desde el 12 de agosto de 2026 — ver §11) |
| 2b | Importar extracto · bandeja previa con cuatro pasos | `#data-entry` | ✅ Migrada (E19-4) |
| 2c | Previsión · el año como una banda, desglose del mes al clic | `#prevision` | ✅ Migrada (P-8, 15 de agosto de 2026 — ver §13) |
| 2d | Aplicar escenario · diferencia línea a línea antes de tocar el plan | `#escenario-aplicar` | ✅ Migrada (E20-1) |
| 2e | Escenarios guardados · cuál está aplicado, cuál caduca | `#escenario-guardados` | ✅ Migrada (E20-1, parcial — ver nota) |

### Turno 3 — Cuadro de mandos con impacto

| # | Título del mockup | Pantalla real | Estado |
|---|---|---|---|
| 3a | Editas una celda y el impacto aparece abajo, antes de guardar | `#cuadro-mandos` | ✅ Migrada (E20-5) |
| 3b | Bandeja de cambios · efecto conjunto de todo lo tocado en la sesión | `#cambios-pendientes` | ✅ Migrada (E20-5) |
| 3c | Mapa de calor · dónde duele cada cambio, sin leer una cifra | `#mapa-calor` | ✅ Migrada (E20-5, completa desde el 12 de agosto de 2026 — ver §12) |

### Turno 4 — Rediseño completo · las 22 pantallas actuales reducidas a 5 + ajustes

Propuesta de arquitectura, no de pantalla suelta. Ver §10.

| # | Título del mockup | Captura |
|---|---|---|
| 4a | Mapa del rediseño · qué se funde con qué y por qué | `screens/4a-mapa-redisenio.png` |
| 4b | Hoy · lectura de caja y tres decisiones, con los asesores fundidos | `screens/4b-hoy-fundido.png` |
| 4c | Plan · la tabla, la curva y los escenarios en una sola pantalla | `screens/4c-plan-unificado.png` |
| 4d | Deuda · ruta, comparador de estrategias y ofertas en curso | `screens/4d-deuda-unificada.png` |
| 4e | Datos · cuatro pestañas y una sola bandeja previa | `screens/4e-datos-bandeja.png` |
| 4f | Cierre · conciliación por tareas y confianza del dato, juntas | `screens/4f-cierre-tareas.png` |

### Turno 5 — Especificación de interacción + prototipos vivos

| # | Título del mockup | Captura |
|---|---|---|
| 5a | Spec · «Actualizar presupuesto» y el pie de impacto | `screens/5a-spec-pie-impacto.png` |
| 5b | Prototipo vivo · edita las cifras y mira el pie | `screens/5b-prototipo-pie-impacto.png` |
| 5c | Spec · importación de extracto, decisión a decisión | `screens/5c-spec-importacion.png` |
| 5d | Prototipo vivo · recorre la importación paso a paso | `screens/5d-prototipo-importacion.png` |

### Prototipo navegable de las seis vistas

`docs/mockups/finanzas-casa-app.dc.html`, capturado vista a vista:
`app-1-hoy`, `app-2-plan`, `app-3-deuda`, `app-4-datos`, `app-5-cierre`, `app-6-ajustes`,
más `app-2-plan-pie-impacto` con el pie de impacto desplegado tras editar una celda — el
estado que no se ve en una captura estática de la vista en reposo.

## 5. Escenario: simular → aplicar → guardados (1e/2d/2e)

Los mockups 1e, 2d y 2e definen el flujo de decisión como **tres pantallas encadenadas**,
implementadas así desde E20-1: `#escenario-simular` (panel de controles a la izquierda,
gráfico plan-actual-vs-simulación con línea de reserva, KPIs de liquidez final / caja
mínima / libre de deuda, aviso si la simulación rompe un límite con botón "ajustar
automáticamente" que reintenta con `planificacion.modo: "optimo"` del motor real),
`#escenario-aplicar` (diff línea a línea, motivo obligatorio antes de confirmar) y
`#escenario-guardados` (lista de escenarios con estado y KPIs recalculados al vuelo sobre
el estado actual, nunca cifras congeladas).

Dos simplificaciones deliberadas frente al mockup, documentadas en vez de fabricadas:

- **Solo dos estados, no cuatro.** El mockup 2e muestra `aplicado / recomendado / guardado
  / caducado`. Aquí solo existen `aplicado`/`guardado`: "recomendado" necesitaría un motor
  de recomendación que no existe, y "caducado" un concepto de oferta con vencimiento que
  tampoco. Añadir esos dos con datos falsos habría sido peor que no tenerlos.
- **"Aplicar" no muta las deudas reales.** `DEBT_PORTFOLIO` es una constante del código
  fuente; no hay ni ha habido nunca, en ninguna pantalla de la app, un mecanismo para
  reescribirla desde la interfaz. "Confirmar y aplicar" registra el escenario como el
  aplicado en `#escenario-guardados` (con motivo y fecha, en `localStorage`) — no escribe
  en ningún dato real. Es honesto y reversible por construcción, pero no es literalmente
  el "commit al plan" que el mockup insinúa.

Alcance de tipos de decisión: ver §9 — desde E20-3 el formulario cubre los once tipos que
el motor resuelve, sin cambiar el flujo de tres pantallas.

## 6. Deuda: comparar estrategias → ruta (1b/1c)

Los mockups 1b y 1c definen dos vistas del mismo plan de deuda: una comparación de
estrategias con nombre (1c) y el detalle cronológico de la elegida (1b). Implementadas en
E20-2 como `#deuda-comparar` y `#deuda-ruta`, construidas sobre el mismo motor que
Escenario (`resolveEscenario`) en vez de sobre el pipeline heredado de
`debt-liquidation-plan` (`DEBT_LIQUIDATION_ASSUMPTIONS`, entidades hardcodeadas): cada
estrategia es una lista de decisiones `amortizacion` (pago total, `planificacion.modo:
"optimo"`) sobre la cartera real (`canonicalDebtContractRows`), ordenada según el
criterio de la estrategia, y resuelta de verdad por el motor — nunca un número inventado.

**Cuatro estrategias reales (V3-3, 10 de agosto de 2026).** El mockup 1c muestra "Quita +
avalancha", "Bola de nieve", "Reunificación" y "No tocar nada". Aquí hay **avalancha**
(ordena por TAE descendente), **bola de nieve** (ordena por saldo ascendente),
**consolidar** (cierra todas las deudas con un préstamo único) y **no tocar nada** (sin
decisiones, referencia). "Consolidar" no se fabrica: pide la oferta real al usuario —TIN,
plazo y comisión opcional (`debtConsolidationOffer`)— en vez de inventar unas condiciones
de préstamo; sin esa oferta, la tarjeta muestra sus KPI como «—» en lugar de una cifra sin
calcular. Su coste no es «capital desembolsado» como las otras tres, sino los intereses
del préstamo nuevo (`costeLabel` propio), porque consolidar no desembolsa nada.

**Recomendada** = la estrategia viable (todas sus decisiones resueltas como "aplicada")
con la fecha de libre de deuda más temprana; en empate, la de menor coste total
ejecutado. `escenarioMotorLibreDeDeuda` no siempre devuelve una fecha real — puede
devolver "sin deuda pendiente", "sin fecha estimable" (queda un registro sin cuota activa,
p. ej. una reunificación histórica) o "fuera de horizonte"; comparar esos textos como
cadenas ordenaría mal, así que se traduce cada caso a un rango explícito antes de
comparar en vez de fiarse de una coincidencia alfabética.

**"Deuda a cero" ambas pantallas la reutilizan.** "Ver ruta"/"Aplicar la recomendada"
cargan las decisiones de la estrategia elegida directamente en
`escenarioMotorDecisions` y navegan a `#escenario-aplicar` — el mismo diff línea a línea
con motivo obligatorio de E20-1, sin reconstruir esa lógica. El gráfico de `#deuda-ruta`
("deuda viva vs. liquidez") recorta la ventana temporal a los ~6 meses tras saldarse la
última deuda (o 36 meses si no llega a saldarse en este horizonte): con el horizonte
completo del motor (hasta 10 años) la liquidez crece muy por encima del principal de
deuda y la aplana en un hilo invisible en una escala compartida.

**Reserva mínima con suelo por defecto.** El motor solo busca mes viable si se declara un
guardarraíl positivo; sin ninguno, "modo óptimo" no comprueba nada y todo cae en el
primer mes del horizonte sin importar cuánto quede la caja en negativo. Si el usuario no
ha configurado una reserva (aquí, o como reserva operativa del hogar en el Cuadro de
mandos, `state.operatingReserve`), se usa un suelo de 0 € por defecto — nunca "sin
comprobar nada" en silencio — y el checklist "antes de aplicar" deja explícito si la cifra
es una reserva real configurada o el suelo por defecto.

Desde V6-1 la casilla se rellena sola con la reserva operativa cuando existe, y una nota
bajo ella dice de cuál de los tres casos se trata: que la cifra viene de la reserva del
hogar, que es un valor puesto solo para esta comparación, o que no hay reserva y por eso
se secuencia con el suelo de 0 €. Antes se heredaba en silencio, que era peor que no
heredar.

## 7. Conciliación (1g)

El mockup 1g reduce la conciliación a "qué falta para cerrar el mes": un título con el
número de tareas, KPIs de cobertura, una lista de tareas por causa ordenadas por impacto,
un checklist de qué implica cerrar y el histórico de meses anteriores. Implementado como
`#conciliar` (E20-2), es **puro reskin**: no reimplementa ni un cálculo — llama
literalmente a las mismas funciones que ya usaba la pantalla heredada `#reconciliation`
(`refreshCanonicalLedger`, `E11bInbox.reconciliationTasks`,
`FinanceCanonicalE5.latestMonthOperation`, `closeCurrentMonthTransaction`,
`downloadCanonicalLedger`) y solo cambia qué se muestra y cómo. `#reconciliation` sigue
intacta, sin tocar, para quien necesite el panel operativo completo (paridad histórica,
auditoría diaria, barrera de publicación) que el mockup no pide y `#conciliar`
deliberadamente no reproduce.

"Meses anteriores" deriva su estado (cerrado / reabierto N veces) de `monthClosures`, el
registro real de operaciones de cierre — no hay estados fabricados como "revisar" o
similar que no tengan un operación real detrás.

## 8. Asesor ejecutivo (1d)

El mockup 1d asume que siempre hay "una decisión abierta" con importe y vencimiento
reales esperando confirmación. Ese concepto no existe hoy como motor de recomendación
genérico — nada en la app calcula "la decisión más urgente" de la nada. A petición
expresa del usuario (tras planteárselo como decisión de producto explícita, no
técnica), `#asesor-decision` (E20-2) se construye sobre **ofertas reales de E14b**: la
oferta de deuda que el propio usuario registra en `#debt-roadmap` (con contraparte,
importe, vencimiento y modalidad reales), filtrando las que ya tienen una decisión
aplicada (`debtLiquidations`) y ordenando por vencimiento más próximo.

**Sin ofertas abiertas, la pantalla lo dice.** No hay estado "de relleno": si
`e14bWorkspace().offers` no tiene ninguna oferta pendiente, se muestra un estado vacío
explícito con enlace a "Registrar oferta" en vez de simular una decisión inexistente.
Es el comportamiento esperado la mayor parte del tiempo con datos nuevos, documentado
así en vez de disimulado.

Cifras reales, no fabricadas:
- **Ahorras / cuota liberada / caja mínima tras pagar**: `offer.discount` (principal −
  importe de la oferta) y `E14DebtOperations.simulateStrategy()` sobre el forecast
  real — la misma simulación que ya usa el panel E14b para comparar.
- **De dónde puede salir el dinero**: cobertura estimada con los saldos reales de cada
  cuenta (`accountBalancesFromState`), explícitamente etiquetada como "cobertura
  estimada", no como un reparto ya decidido — el mockup insinúa una asignación fija que
  no existe como dato real en ningún sitio.
- **Límites que no se rompen**: reserva (`agentCaixaFloor`), colchón en meses
  (mismo cálculo que el KPI "Meses colchón" de Hoy — contrastado en verificación:
  coinciden exactamente) y deuda/ingresos (`FinanceP2Bridge.e16Input().riskBudget`).
- **Otras ofertas en espera**: el resto de ofertas abiertas de E14b, si existen —
  ningún estado "Preparar/En espera" por tipo de acción, que no tiene datos reales
  detrás en este flujo.

"Revisar y aplicar en Plan de deuda" preselecciona la oferta y navega a `#debt-roadmap`
— reutiliza el flujo real de aplicación (motivo, documentos mínimos, reserva protegida)
en vez de reconstruirlo aquí.

## 9. Los once tipos de decisión de `#escenario-simular` (E20-3)

Hasta E20-2 el formulario de «Qué cambias» tenía cuatro controles fijos (deuda, importe,
mes, guardarraíl) y solo sabía construir decisiones de tipo `amortizacion`, aunque el motor
(`canonical-scenario-engine.js`) ya resolvía once tipos desde E20-0 día 4. Desde E20-3 el
formulario es un **catálogo declarativo** (`ESCENARIO_MOTOR_TYPES` en `app.js`): un
desplegable de tipo, agrupado en «Deuda» y «Vida», y una rejilla de campos que se
reconstruye según el tipo elegido.

Los once tipos ofrecidos:

| Grupo | Tipo | Qué pide |
| --- | --- | --- |
| Deuda | `amortizacion` | Deuda, importe, mes, y una casilla para forzar que sea parcial |
| Deuda | `amortizacion_fraccionada` | Deuda, importe mensual, número de meses, mes de inicio |
| Deuda | `refinanciacion` | Deuda, nuevo principal/cuota/TIN/plazo, mes de entrada en vigor |
| Deuda | `reunificacion` | Dos o más deudas, principal/cuota/TIN/plazo del nuevo préstamo, mes |
| Deuda | `retomar_pagos` | Deuda **suspendida**, cuota al retomar, mes |
| Deuda | `acuerdo_quita` | Deuda, importe pactado, mes del pago, fecha de caducidad de la oferta |
| Vida | `compra` | Nombre, importe, mes y, si se marca «la financio», principal/cuota/TIN/plazo |
| Vida | `proyecto` | Nombre, importe objetivo, modalidad, mes objetivo (y mes de inicio si es hucha) |
| Vida | `imprevisto` | Importe, mes y, opcionalmente, cada cuántos meses se repite |
| Vida | `cambio_ingreso` | Titular, delta mensual (negativo si baja), desde/hasta |
| Vida | `cambio_gasto` | Bloque, importe fijo **o** porcentaje, desde/hasta |

### Decisiones deliberadas

- **`traspaso` y `cambio_presupuesto` no se ofrecen.** El motor los deja fuera a propósito y
  lo documenta: uno exigiría ampliar `canonical-engine` para admitir un ajuste puntual del
  reparto checking/savings por mes, el otro fabricaría un gasto que nadie ha declarado.
  Ofrecerlos daría un control que no cambia nada en la simulación, sin decirlo.
- **`acuerdo_quita.modalidad` se fija a `pago_unico`** en vez de pedirla. El motor cierra la
  deuda con un pago único en el mes resuelto; un desplegable con «fraccionado» prometería
  un cálculo que hoy no existe. `vigenciaHasta` sí se pide: el contrato la exige y es un
  dato real de la oferta, aunque el motor todavía no la use para nada.
- **`proyecto` financiado ≡ pago único.** El esquema de `proyecto` no da plazo ni cuota
  propios (a diferencia de `compra`), así que las dos modalidades cargan el importe de golpe
  en el mes objetivo. Se dice en el texto de ayuda del tipo, no se esconde.
- **El TIN se pide en % y se guarda en fracción.** El contrato quiere 0-0,60; pedir «0,065»
  al usuario sería una trampa. La conversión vive en un único sitio (`escenarioMotorPct`).
- **El guardarraíl sale del `<form>`.** Es del escenario entero, no de la decisión que se
  está componiendo; estaba mezclado con los campos de la decisión y confundía ambas cosas.

### Validación: la del contrato, no una paralela

Cada decisión se construye completa (`id` ULID `dec_…`, `titulo`, `activa`, `orden`,
`planificacion`, `params`) y pasa por `Schema.validateDecision` **antes** de entrar en la
simulación. Si el contrato la rechaza no se añade nada y se muestran sus propios mensajes,
con el `path` traducido al rótulo del campo («Nuevo TIN (%): Falta el campo obligatorio
«nuevoTIN».»). Antes de E20-3 la interfaz generaba IDs con un formato que el propio contrato
habría rechazado (`escenario-motor-1`) y no validaba nada: funcionaba porque
`resolveEscenario` no valida, no porque la decisión fuera correcta.

### Detalles de interfaz

- **Deudas filtradas por tipo.** `retomar_pagos` solo ofrece deudas con `paymentStatus
  === "suspended"`, porque el aplicador rechaza cualquier otra. Si no hay ninguna, el
  desplegable lo dice en vez de ofrecer una deuda que el motor va a rechazar.
- **Campos condicionales sin perder el foco.** «La financio» y el selector importe/porcentaje
  muestran y ocultan campos alternando `hidden`, sin reconstruir la rejilla; el formulario
  solo se reconstruye entero al cambiar de tipo, y nunca mientras el foco está dentro.
  Los campos ocultos no entran en los `params` aunque conserven un valor escrito antes.
- **Tras añadir una decisión** se vacían importes y textos pero se conservan los desplegables
  (deuda, mes, titular): encadenar dos decisiones sobre el mismo mes es el caso normal.
- **Los títulos ya no se recortan.** Con un solo tipo cabían en una línea; con once,
  «Refinanciar Entidad B Tarjeta» se recortaba justo en la parte que identifica la decisión.
  Ahora envuelven, y el título está limitado a 60 caracteres por el propio contrato.
- **Escenarios guardados antes de E20-3** no llevan `titulo` (ni las rutas que llegan desde
  el comparador de estrategias): se reconstruye con el mismo generador del catálogo, que solo
  lee claves presentes también en `params`.

## 10. El rediseño a seis vistas (turnos 4-5 y prototipo de app)

Material añadido por el usuario el 9 de agosto de 2026. **No continúa el catálogo de 15
pantallas: propone sustituir su arquitectura.**

**Actualizado el 10 de agosto de 2026.** La decisión que faltaba ya está tomada, y no fue
adoptar ni descartar: **las pantallas heredadas no se retiran, se mueven a una sección
«Versiones anteriores»**. Con eso el rediseño se puede adoptar sin su único riesgo real
—perder función que solo vive en una pantalla heredada—, porque el camino de vuelta sigue
existiendo. El detalle, el mecanismo y las tareas están en `BACKLOG.md` §3.

### Qué propone

Las 22 pantallas actuales se reducen a **seis vistas** con navegación lateral fija: Hoy,
Plan, Deuda, Datos, Cierre y Ajustes. El criterio es que cada vista responda a una sola
pregunta y que ningún dato entre en el plan sin una decisión explícita. Las fusiones, según
el mapa 4a:

| Vista | Absorbe |
|---|---|
| **Hoy** | Hoy · home, Asesor ejecutivo, Asesor virtual, Agente ahorro y objetivos, resumen del Centro de alertas |
| **Plan** | Actualizar previsiones, Previsión mensual, Proyección, Flujo mensual, Plan de ahorro, Simulador, Escenarios de vida |
| **Deuda** | Plan de deuda, Plan deuda óptimo, Control de deuda, ruta de deuda de la simulación |
| **Datos** | Actualizar mis datos, Registrar reales del mes, Carga de datos, Movimientos, Series recurrentes |
| **Cierre** | Conciliación bancaria, Datos y auditoría, Guía operativa, Copias y restauración |

Desaparecen **como pantalla** (no como cálculo): Simulación nueva vida, Simulación nueva
vida definitiva, Asesor virtual, Agente de ahorro, Gastos recurrentes y Guía operativa.

La regla transversal del rediseño es la del turno 3, generalizada: toda pantalla que cambia
un número enseña, antes de guardar, el efecto sobre los mismos cuatro indicadores (mínimo
del año, meses bajo reserva, liquidez a cierre y fecha sin deuda).

### Qué relación tiene con lo ya construido

Choca de frente con la arquitectura actual, que ha ido en la dirección contraria: cada
mockup migrado (1b, 1c, 1d, 1e, 1g, 2b, 2c, 2d, 2e) se ha añadido como **pantalla nueva
junto a la heredada**, nunca sustituyéndola — es el principio de "envolver, no sustituir"
que rige todo el código. El resultado es que hoy conviven `#conciliar` y `#reconciliation`,
`#deuda-ruta` y `#debt-roadmap`, `#escenario-simular` y `#new-life-simulation`. El rediseño
a seis vistas es exactamente la operación inversa: fundir los pares y retirar los heredados.

No era un conflicto que se resolviera escribiendo código: era una decisión de producto sobre
si se retiran pantallas en uso. **Resuelta el 10 de agosto**: no se retiran. Cada par
nueva/heredada se mantiene, y la heredada pasa al grupo «Versiones anteriores» del menú.

El mecanismo ya existe y no hay que construirlo: cada enlace lleva `data-e17-group` en
`index.html`, `e17Preferences()` (`app.js:371`) guarda un booleano por grupo y
`applyE17Preferences()` (`app.js:379`) oculta los de un grupo apagado. Añadir «Versiones
anteriores» es un grupo `legacy` más, reetiquetar los enlaces heredados, un encabezado y un
interruptor en «Personalizar».

Lo que sí es directamente aprovechable sin esa decisión:

- **El turno 5 especifica de verdad el pendiente 3a/3b/3c.** Hasta ahora el «cuadro de mandos
  con impacto» era una idea con tres capturas estáticas; 5a y 5c son especificaciones
  escritas (disparadores, debounce de 120 ms sobre el cálculo y no sobre la aparición,
  contenido exacto del pie, comportamiento al descartar, mes cerrado, salida con cambios
  abiertos) y 5b/5d son prototipos que se pueden recorrer. Es la mejor entrada disponible
  para esa entrega del backlog.
- **`HANDOFF_REDISENO_6_VISTAS.md` trae medidas y tokens exactos** (paleta completa con
  hex, escala tipográfica, espaciado, radios y sombras) que coinciden en su mayoría con
  `design-tokens.css`, con una diferencia notable: el rediseño usa navy `#293E5E` como color
  primario donde el sistema E19 usa azul `#0072E3`. Adoptar el rediseño implicaría también
  ese cambio de acento, no solo de arquitectura.

## 11. «Registrar el mes» (2a, E20-4)

Pantalla nueva `#registrar-mes`, **junto a `#update-data`**, no en su lugar: la heredada
conserva el acordeón por bloques, el editor de conceptos y el borrado de cualquier línea.
Las dos escriben en el mismo almacén (`incomeActuals` / `expenseActuals`), así que un real
anotado en una aparece en la otra sin migrar ningún dato — comprobado en navegador en las
dos direcciones.

El punto del mockup, y la diferencia real con la heredada, es que **la lista es plana**: una
fila por partida, sin desplegar nada. En `#update-data` un real vive detrás de un acordeón
cerrado; aquí las 29 partidas del mes están a la vista, con el filtro «Sin real» activo de
entrada porque esa es la tarea.

### Qué muestra

- **Titular calculado**: «Agosto va 2,40 € por encima de lo previsto», donde la cifra es
  `desviación de gastos − desviación de ingresos` sobre las partidas que ya tienen real.
  Sin ningún real, dice exactamente eso en vez de fingir que el mes va clavado.
- **Cuatro KPI**: ingresos usado, gastos usado, margen del mes (con el previsto al lado) y
  «Completado» con barra de progreso y el recuento `2/29`.
- **Dos tarjetas** (Gastos e Ingresos), cada una con su segmentado `Sin real (n)` ·
  `Con desviación (n)` · `Todo (n)` y su tabla de seis columnas: bloque, concepto, previsto,
  real (casilla editable), usado y desviación.

### Decisiones deliberadas

- **El tinte de fila se reserva a lo que va a peor.** El filtro «Con desviación» cuenta
  cualquier diferencia, pero solo se tiñe la fila cuando la desviación es desfavorable
  (más gasto o menos ingreso). Pintar de aviso un gasto que ha salido más barato sería
  ruido, no información.
- **Guardar un real no reconstruye la tabla.** El evento `change` salta durante el blur,
  antes de que el foco aterrice en la casilla siguiente; reescribir el HTML ahí deja el foco
  en el aire y rompe el tabulado. En ese camino solo se refrescan las celdas derivadas
  (previsto, usado, desviación) y los contadores de los filtros. Verificado: tras escribir
  y tabular, el foco cae en la casilla siguiente.
- **La fila recién rellenada no desaparece.** Con el filtro «Sin real» activo, anotar un
  real deja la fila donde está hasta la siguiente reconstrucción; el contador del filtro sí
  baja. Que una fila se esfume bajo el cursor mientras se escribe es peor que verla de más.
- **Copiar reales del mes anterior pide confirmación.** El enlace no copia: cuenta los
  candidatos, dice cuántos son y de qué mes, y espera un «Confirmar copia». Si no hay
  ninguno, lo anuncia y no abre nada. Copiado el lote, el aviso recuerda revisarlos.
- **Solo se pueden quitar las partidas añadidas aquí.** La `×` aparece únicamente en las
  filas propias (`custom`), para deshacer el propio error. Borrar una línea del catálogo
  sigue siendo cosa de `#update-data`, que es donde estaba y donde tiene su contexto.
- **Mes cerrado**: las casillas quedan deshabilitadas y el pie de cada tarjeta lo explica en
  vez de ofrecer acciones que el guardado rechazaría. En la práctica es defensivo: el
  selector solo lista meses abiertos.

### Qué se migró después (12 de agosto de 2026, V4-3/V4-5)

El mockup incluye, bajo la fila recién detectada, un aviso —«Detectado en el extracto del 14
de julio · ¿Es anual? Se repetirá cada julio en el previsto»— con dos botones. La primera mitad
—inferir del extracto importado que una partida se repite cada año— ya está construida:
`registrarMesAnnualMatch(entry, transactions, monthKey)` busca, para una partida nueva de ese mes
(`entry.row.custom`), un movimiento de importe parecido (±0,50 €) hace ~12 meses (±15 días) y sin
nada parecido entre medias — si lo hubiera, sería mensual, no anual. `registrarMesAnnualBannerHtml`
pinta el aviso con «Sí, anual»/«Solo este mes», y ambos marcan `state.registrarMesAnnualAck` para no
volver a preguntar por esa partida.

Lo que sigue sin existir es la segunda mitad: un modelo de recurrencia anual para las filas
añadidas a mano (`customPlanningRows` sigue siendo estrictamente de un mes). «Sí, anual» no
proyecta el previsto hacia años futuros — eso exigiría ampliar el motor de planificación — solo
recuerda la elección y sugiere anotarlo a mano en Partidas. Con eso, 2a pasa de migrada **parcial**
a **completa** en el catálogo del turno 2, con esta única salvedad honesta.

También cambia una cosa respecto al mockup: la insignia dice **«Guardado a las 03:17»** y no
«Guardado hace 4 s». Un texto relativo obliga a un temporizador o miente en cuanto pasan unos
segundos sin repintar; la hora exacta no se estropea sola.

### Dónde vive el código

- `index.html`: la sección `#registrar-mes` (cabecera, rejilla de KPI y contenedor de tablas);
  todo lo demás lo genera el render.
- `app.js`: bloque «Registrar el mes», con `renderRegistrarMes` y sus ayudantes
  (`registrarMesCollect`, `registrarMesTotals`, `registrarMesRefreshCells`) y los manejadores
  `handleRegistrarMes*`. Reutiliza sin tocarlas `planningSectionsForMonth`, `actualAwareInfo`,
  `actualKeyForRow`, `deletePlanningRow` y `varianceClassForKind`.
- `design-tokens.css`: todo bajo `.e19-registrar-mes`, incluido un par de reglas que
  recuperan la alineación a la izquierda de bloque y concepto y el color de `.positive` /
  `.negative`, que `.e19-table tbody td` pisaba por especificidad.

## 12. Cuadro de mandos con impacto (3a/3b/3c, E20-5)

Tres pantallas nuevas que cierran el turno 3, y con él los quince mockups de los turnos 1-3:

| Mockup | Pantalla | Qué hace |
|---|---|---|
| 3a | `#cuadro-mandos` | Matriz partida × mes con el previsto editable y un pie de impacto que dice qué le pasa al plan antes de guardar |
| 3b | `#cambios-pendientes` | El efecto conjunto de la sesión, con cada cambio ordenado por impacto y reversible por separado |
| 3c | `#mapa-calor` | Un color por mes según el colchón que queda, con el desglose del peor mes |

### No hay un almacén de borradores nuevo

Lo importante de esta entrega no se ve: las tres pantallas **reutilizan `visualDraftCells`**, el
mismo almacén de cambios sin confirmar que `#visual-detail` usa desde E11. Un importe tocado en
`#cuadro-mandos` aparece en el panel «Cambios pendientes» de la pantalla heredada y viceversa, y
«Guardar cambios» es literalmente `saveVisualChanges`. Comprobado en navegador: tras editar una
celda en el cuadro de mandos, `#visual-detail` anuncia «1 cambio(s) pendiente(s)»; tras guardar,
`seriesOverrides` contiene `expense|expense-home|2026-08 → {planned: 1500}`.

Montar un segundo sistema de borradores habría dado dos verdades sobre «qué está sin guardar»,
que es exactamente el fallo que estas pantallas existen para evitar.

### Cómo se calcula el impacto

`cuadroMandosRowsWith(drafts)` aplica los borradores sobre `seriesOverrides` de forma temporal,
corre el motor canónico **sin `engineContext`** —así no persiste el escenario ni lo ve ninguna
otra pantalla— y restaura el estado en un `finally`. De ahí salen las tres cifras del pie:
mínimo del horizonte, meses bajo reserva y liquidez final, cada una con su valor anterior tachado.

Si el motor rechaza la combinación, no se enseña un número inventado: el pie dice que no se ha
podido calcular y los cambios siguen sin guardarse.

### Decisiones deliberadas

- **La fecha libre de deuda está en el pie, pero sin diferencia (V2-6, 12 de agosto de 2026).**
  El mockup 3a la incluye como un cuarto indicador; `cuadroMandosDebtFreeReadout()` la asoma
  reutilizando `homeDebtOutlook()` tal cual. Editar el previsto de una partida de planificación no
  toca ningún contrato de deuda, así que ese dato diría «sin cambio» siempre — por eso no pasa por
  `cuadroMandosBeforeAfter` como los otros tres, se muestra fija con un `title` que explica por
  qué. La fecha libre de deuda sí se mueve de verdad en `#escenario-simular` y `#deuda-comparar`,
  que es donde viven las decisiones que la mueven.
- **«Ordenado por impacto» se calcula de verdad.** Cada cambio se valora quitándolo de la
  simulación (*leave-one-out*): el número que se ve es lo que devolvería pulsar «Revertir». Cuesta
  una simulación por cambio, así que por encima de ocho se ordena por importe y el rótulo lo dice
  en lugar de fingir el mismo criterio.
- **«Todos los meses» es «todo el rango visible».** El mockup ofrece aplicar un importe a todos
  los meses; el horizonte real son 126, y sembrar 126 borradores desde un clic es una trampa.
  El botón dice exactamente hasta dónde llega.
- **El mapa marca los meses que has tocado, no los que cambian de cifra.** La liquidez es
  acumulada: un cambio en agosto mueve los cien meses siguientes, y marcarlos todos pintaría el
  mapa entero sin decir nada. Se marca la causa y el subtítulo explica que el resto también se
  mueve.
- **El suelo del color se declara.** Si hay reserva operativa configurada se usa esa; si no, un
  mes de salidas, y el subtítulo dice cuál de las dos está en uso y por qué. Desde V6-1 la reserva
  se fija en la fila de controles del Cuadro de mandos, y el subtítulo de respaldo dice dónde.
- **Los meses cerrados se ven pero no se editan**, según la especificación 5a.

### Qué se migró después (12 de agosto de 2026, V2-5)

El panel «Qué hacer con estos cuatro meses» del mockup 3c propone acciones concretas y calculadas
—«mover la matrícula a septiembre: agosto pasa de 1.430 € a 1.950 €», «bajar el traspaso a
Mediolanum en ago-oct»— con botones de «Simular». Eso sigue sin existir: sería un motor de
recomendaciones que generaría propuestas y cifras que nadie ha calculado, y no se ha fabricado.
Lo que sí se migró es la parte con datos reales: el primer enlace del panel de al lado
(`mapaCalorTopBlockLink`) nombra el bloque de gasto que de verdad pesa más en el peor mes, con su
importe, en vez de un texto genérico — reutiliza el mismo desglose que ya calculaba el panel,
ahora hoisted para no duplicar el cálculo. El panel sigue sin botones de «Simular»: enlaza a las
pantallas que sí pueden actuar sobre ese mes (el propio cuadro de mandos, `#escenario-simular` y
`#deuda-comparar`). Con eso, 3c pasa de migrada **parcial** a **completa** en el catálogo del
turno 3, con esta única salvedad honesta —no hay propuestas de movimiento fabricadas, solo el
dato real de dónde mirar.

También queda fuera el modo «Previsto ▾» de 3a como desplegable de métrica: la matriz edita
previsto, que es lo único que tiene sentido editar hacia el futuro. Los reales se registran en
`#registrar-mes`.

## 13. Previsión (2c) — corrección de estado y construcción real (15 de agosto de 2026)

Este catálogo daba el mockup 2c por «✅ Migrada (E19-5)». Era incorrecto: E19-5 migró la **piel
visual** de las pantallas heredadas `#prevision`/`#forecast` (tokens, tipografía, tarjetas) sin
tocar su contenido, que seguía siendo el de antes del rediseño — una tabla resumen anual y dos
gráficos de proyección/categorías. El mismo error estaba también en `BACKLOG.md` (el backlog
operativo vigente), que marcaba la fila de 2c «✅» sin matices. La confusión entre «se migró el
aspecto» y «se migró la pantalla» es justo lo que este documento existe para evitar, así que se
corrigieron los dos documentos antes de construir nada — no después.

El mockup describe una pantalla con: titular en prosa sobre el mes delicado, su cifra y fecha
exactas, y la garantía de que el resto del horizonte aguanta; selector de horizonte 12m / 24m /
48m / hasta 2036; un gráfico de barras por mes (banda máximo-tras-ingresos → mínimo-antes-de-
nómina) con la reserva marcada y los meses problemáticos resaltados; tabla mensual de Ingresos,
Gastos, Deuda, Ahorro y Mínimo; y un panel lateral día a día del mes seleccionado, con una
sugerencia accionable.

**Construida esta misma sesión.** `renderPrevision()` reemplaza por completo la tabla anual
heredada de `#prevision` por esto: titular, selector de horizonte, banda, tabla mensual y panel
día a día con sugerencia, tal como pide el mockup. Reutiliza `previsionMetric`, `mapaCalorFloor`/
`mapaCalorTone` y `planningBreakdownForForecastMonth`, ya existentes. `#forecast` (proyección de
liquidez a 10 años y gastos por categoría) sigue aparte, sin tocar — nunca fue parte de este
mockup, solo compartía piel visual.

**Aviso para no repetir la confusión con P-8.** `docs/BACKLOG_NUEVE_PANTALLAS.md` tiene una tarea
que también se llama «Previsión mes a mes por bloque» (P-8) y **no es esto**: su criterio real
(`Backlog_Global.pdf` V4, el backlog operativo vigente) pide "una fila por bloque y una columna
por mes del horizonte, con candado en los meses cerrados" — una matriz de solo lectura, distinta
del mockup 2c de arriba. P-8 vive en la pestaña «Previsión» de `#plan` (`renderPlanPrevision()`),
no en este `#prevision` heredado; los dos son pantallas separadas y legítimas, cada una fiel a su
propia fuente, no dos intentos del mismo diseño. Ver la nota de P-8/P-9 bajo la tabla de la
pantalla 04 en `docs/BACKLOG_NUEVE_PANTALLAS.md` para el detalle de esa matriz.
