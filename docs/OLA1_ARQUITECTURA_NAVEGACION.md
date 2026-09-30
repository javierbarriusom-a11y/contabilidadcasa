# Ola 1 — Arquitectura de navegación: mapa, dependencias y recomendación

> Sesión 271 · 30 de septiembre de 2026 · **Propuesta para decidir; no contiene código.**
> Origen: `BACKLOG_CONTABILIDADCASA_3_0.md` §9 (plan de mejora de UX por olas). Datos medidos sobre el
> repositorio en `main` tras la Ola 0 (`c043870`): `index.html`, `app.js`, `views/*.js`, `tests/`.

## 1. Resumen para decidir

1. **Mi propuesta inicial (cinco «ritmos» con hubs: Hoy · Semana · Mes · Camino · Decidir) no es la que
   recomiendo ahora.** Sería la **tercera reescritura del menú en seis semanas** (seis vistas el 12/08, nueve
   pantallas el 14/08) y ya existe un diseño por objeto con veredicto para cada pantalla heredada. La deriva real
   del menú actual es pequeña y se corrige con cambios pequeños.
2. **Recomendación (camino B):** conservar la estructura de nueve pantallas, corregir su deriva y usar los ritmos
   como **rótulos de agrupación** del menú, no como pantallas nuevas. Pasa de **11 a 10 entradas principales**,
   sube a primer nivel lo que hoy está escondido (Escenarios, Presupuesto, Estado de la semana) y no crea ninguna
   pantalla.
3. **Tres correcciones a lo que te dije en el diagnóstico** (detalle en §3): las tres pantallas «asesor» **no son
   duplicadas**; de las 9 pantallas «sin enlace», **7 ya se retiraron el 20/08** (solo se abren desde el
   Laboratorio); y «Datos» ya es un alias de Registrar.
4. **Retirar pantallas, no ahora.** Hay 9 candidatas reales (§7) y ninguna se toca sin el informe «Uso de la
   app» (evidencia que exige PROC-1) ni sin tu visto bueno. Las tres de deuda (D-14) esperan datos de uso por
   decisión previa tuya.
5. **El coste real está en las pruebas, no en el código:** 16 archivos de prueba citan la estructura del menú, y
   `app.js` está en su techo (37.530 líneas): la lógica nueva de navegación no puede ir ahí.

## 2. Inventario medido

| Dato | Valor |
|---|---|
| Pantallas (`<section class="view-section">`) | **59** |
| Entradas del menú principal | **11** (Hoy, Planificación de partidas, Registrar, Movimientos, Plan, Deuda, Inversión, Datos, Cierre, Ajustes, FAQs) |
| Solo en «Herramientas avanzadas» | **29** (más 3 repetidas del principal: Deuda, Inversión, Ajustes) |
| En «Versiones anteriores» (heredadas visibles en el menú avanzado) | **10** |
| Retiradas del menú el 20/08 y solo abiertas desde el Laboratorio | **7** (E-14: 3, A-12: 2, C-14: 2) |
| Pasos de un flujo, sin entrada propia | **2** (`escenario-aplicar`, `escenario-comparar`) |
| Alias que ya redirigen a Registrar (R-10) | **4** (`update-hub`, `update-data`, `datos-importar`, `data-entry`) |
| Archivos de prueba acoplados a la estructura del menú | **16** |

Lo que esto significa en la práctica:

- **«Datos» y «Registrar» abren la misma pantalla.** `#update-hub` redirige a Registrar › Saldos. Son dos entradas
  principales para una.
- **Lo que más se usa por ritmo está enterrado.** «Presupuesto del mes» y «Estado de la semana» solo se alcanzan
  abriendo «Herramientas avanzadas» y bajando hasta el bloque «Analizar»; «Escenario · simular» ni siquiera
  tiene entrada principal. Hoy son **2 clics más un desplazamiento largo**.
- **«Planificación de partidas» ocupa una entrada principal** siendo una parte del plan del mes.

## 3. Correcciones a mi diagnóstico anterior

| Lo que dije | Lo que dicen los datos |
|---|---|
| «3 pantallas de asesor + agente de ahorro, duplicadas» | **No son duplicados.** `asesor-decision` decide sobre **una oferta de deuda abierta** (alimenta Hoy y Deuda › Ruta). `executive-advisor` (Ejecutivo) es otra vista sobre el motor compartido (`unifiedActionCenterModel`), que también pinta Hoy. `virtual-advisor` y `savings-agent` cuelgan del motor del agente de ahorro. Coinciden en el subtítulo «Qué hacer ahora», no en el contenido. **Retirar la pantalla no retira el motor.** |
| «9 pantallas sin enlace en ningún menú» | **7 ya se retiraron a propósito el 20/08** (bloque 5: E-14, A-12, C-14) y se abren en solo lectura desde Ajustes › Laboratorio. Las otras 2 son pasos de un flujo. No son candidatas: ya están hechas. |
| «42 herramientas avanzadas» | Son 42 enlaces, pero 3 se repiten con el menú principal: **39 pantallas distintas**. |
| «6 formas de actualizar datos» | 4 ya son alias de Registrar desde R-10. Queda `registrar-mes`, que tiene una **promesa explícita de R-5** de no retirarse sin consultarte. |
| «8 pantallas de deuda» | 4 son el hub vigente (Comparar · Ruta · Contratos · Simulador). Las otras 3 (`debt-roadmap`, `debt-liquidation-plan`, `debt-control`) son D-14, **aplazadas a propósito hasta tener datos de uso** (T-4). |

Consecuencia: el «stock» de pantallas retirables es menor de lo que anuncié, y buena parte ya está gastado.

## 4. Lo que ya estaba decidido (no lo reabro sin tu orden)

- **12/08 · T-1:** navegación de seis vistas (Hoy, Plan, Deuda, Datos, Cierre, Ajustes), «heredadas relegadas y no
  retiradas».
- **14/08 · «Nueve pantallas»** (`docs/BACKLOG_NUEVE_PANTALLAS.md`): Hoy, Registrar, Movimientos, Plan, Deuda,
  Escenarios, Análisis, Cierre y Laboratorio; **una sola puerta de escritura por tipo de dato** y un veredicto
  (adoptar, sustituir o descartar) para cada heredada.
- **R-10:** los hash antiguos de Registrar redirigen, no se rompen. `registrar-mes` queda fuera por la promesa
  de R-5.
- **20/08 · E-14 / A-12 / C-14:** siete heredadas fuera del menú y del lanzador, con Laboratorio.
- **D-14 y T-4:** las heredadas de deuda no se tocan sin datos de uso reales.
- **OPT-10 a OPT-13:** aplazadas al 23/10/2026; una pantalla que se usa menos de una vez al mes no puede
  declararse «sin uso» con 30 días de ventana.
- **NAV-3 aparcada** (25/09, decisión del hogar) y **PROC-1:** toda propuesta cita evidencia de uso o petición
  explícita.

## 5. Dos caminos

| | **A · Cinco ritmos con hubs** (mi propuesta inicial) | **B · Nueve pantallas corregida** (recomendada) |
|---|---|---|
| Menú principal | Hoy · Semana · Mes · Camino · Decidir + Registrar/Movimientos + Ajustes/Ayuda ≈ 9 | Hoy · Registrar · Movimientos · Plan · Cierre · Deuda · Inversión · Escenarios · Ajustes · Ayuda = **10** |
| Pantallas nuevas | 4 hubs (Semana, Mes, Camino, Decidir) | **0** |
| Cambia el nombre de lo que el operador usa a diario | Sí: Plan, Deuda, Cierre pasan a vivir dentro de «Mes» y «Camino» | No |
| Pruebas de estructura de menú a reescribir | Las 16 y, además, las de cada hub nuevo | Las 16, con cambios acotados |
| Semana | Un hub de **una sola pantalla** hoy (la revisión semanal es de la Ola 3) | Pestaña de Plan hasta que la Ola 3 justifique algo mayor |
| Riesgo para el operador (uso intensivo) | Alto: reaprende el menú | Bajo: pierde «Datos» (alias) y gana atajos |
| Beneficio para la lectora | El mismo en ambos: lo decide la Ola 2 (modo consulta), no el menú | El mismo |
| Reversibilidad | Media | Alta (cada entrega se deshace en un commit) |
| Cuándo tendría sentido A | Si tras la Ola 2 el modo consulta necesita una navegación por ritmos distinta de la del operador | — |

**Por qué recomiendo B.** (1) El operador ya conoce Plan, Deuda y Cierre como sustantivos; ocultarlos bajo «Mes» y
«Camino» empeora su hallazgo diario para mejorar uno que solo importaría a alguien que hoy no usa el menú (la
lectora usa Hoy). (2) Un hub de ritmo con una sola pantalla dentro (Semana) es estructura sin contenido. (3) Dos
reescrituras en seis semanas ya son suficiente rotación: cada una dejó 16 pruebas acopladas. (4) B consigue lo que
A prometía —que lo semanal y lo mensual estén a un clic— sin pagar su precio. Lo que B **no** consigue es una
navegación distinta por persona; eso se resuelve en la Ola 2, donde tiene sentido.

**Lo que B pierde y debes saber:** no reduce el menú tanto como A (10 frente a ~9) y no da el vocabulario de
«ritmos» a la app; lo da solo como rótulos de sección.

## 6. Menú propuesto (camino B)

```
DÍA A DÍA        Hoy · Registrar · Movimientos
CADA MES         Plan   (Mes · Previsión · Presupuesto · Esta semana · Partidas · Ahorro y objetivos)
                 Cierre (Conciliar · Resolver · Firmar)
A LARGO PLAZO    Deuda (Comparar · Ruta · Contratos · Simulador) · Inversión (5 pestañas)
PARA DECIDIR     Escenarios (Simular · Guardados) · Asesor · Segunda opinión · Comparadores
SISTEMA          Ajustes · Ayuda
```

Cambios frente al menú de hoy: **sale «Datos»** (alias de Registrar), **sale «Planificación de partidas»** (pasa a
pestaña de Plan), **entra «Escenarios»** (hoy solo en avanzadas), y **Presupuesto y Esta semana** dejan de estar
enterradas. Los identificadores de las 59 pantallas **no cambian**: todos los enlaces, marcadores del navegador y
pruebas que citan un `#id` siguen valiendo. «Análisis» se queda donde está (menú avanzado, enlazada desde Cierre)
hasta que haya datos de uso.

Sobre `Plan`: hoy ya es un hub con tres pestañas internas (`PLAN_TABS`, paneles dentro de la misma pantalla).
`Presupuesto` y `Estado de la semana` son pantallas independientes con su propio fragmento de código. Hay dos
mecanismos posibles: **(i)** el de Deuda e Inversión (una franja de pestañas que enlaza a pantallas separadas, con
los `#id` intactos y la carga diferida conservada) y **(ii)** convertirlas en paneles de `PLAN_TABS`. Recomiendo
**(i)**: no mueve código entre ficheros y no toca el motor.

## 7. Candidatas a retirar (redirigir sin borrar código)

Regla acordada: **el enlace antiguo sigue funcionando y lleva a la pantalla que la sustituye; se retira del menú,
no del código; se deshace en un commit.** Nada de esto se ejecuta sin el informe de uso y sin tu visto bueno.

| Orden | Pantalla | Destino | Enlaces a reapuntar | Precondición |
|---|---|---|---|---|
| 1 | `alerts-center` | Ajustes › Alertas | 4 | Confirmar que Ajustes cubre todos los umbrales |
| 2 | `visual-detail` | Plan › Mes | 7 (6 en `index.html`) | Reapuntar los 6 primero |
| 3 | `savings-agent` | Plan › Ahorro y objetivos | 3 (incl. Estado de la semana) | Se retira la pantalla, **no el motor** (vive en `app.js`) |
| 4 | `conciliar` | Cierre (paso 1) | 1 | Comprobar que no aporta cálculo propio |
| 5 | `executive-advisor` | Hoy («qué necesita tu atención») | 2 | Comparte motor con Hoy; comprobar qué muestra que Hoy no |
| 6 | `virtual-advisor` | — | 1 | 610 líneas; verificar qué aporta antes de decidir destino |
| 7-9 | `debt-roadmap`, `debt-liquidation-plan`, `debt-control` | Deuda › Ruta / Comparar | 3 / 1 / 7 | **D-14: esperan datos de uso reales (T-4).** `debt-control` es la más enlazada de todas |

`registrar-mes` **no** figura: tiene la promesa de R-5 y solo se toca si tú lo pides expresamente.

## 8. Dependencias y riesgos

| # | Dependencia | Qué implica |
|---|---|---|
| D1 | **Los `#id` no cambian** | Las 4.935 pruebas que citan una pantalla siguen valiendo. Se reescriben solo las **16** que citan el menú (`navigation-structure`, `nav1`, `t1-seis-vistas`, `t0-versiones-anteriores`, `e14-a12-c14`, `e17-interface`, `r1-r4-registrar`, `p1-p7-plan-mes`, `d1-d2-deuda-tabs-contratos`, `track3-estado-semana`, `v4-4` y las `v*-relegar-*`). |
| D2 | **Preferencias «Personalizar»** | El menú avanzado se filtra por grupo (`analysis`, `data`, `assistants`, `legacy`) guardado en el navegador. Si Presupuesto o Escenarios pasan al menú principal, **no pueden seguir dependiendo de esos grupos**: quien tenga «analysis» apagado los perdería. Hay que sacarlas del filtro. **Verificado en la entrega 1:** `applyE17Preferences` solo oculta elementos con `data-e17-group` (los enlaces del menú avanzado); el campo `group` de las entradas del lanzador es metadato y `findTasks` no filtra por él. Las entradas principales no llevan `data-e17-group` y `tests/ola1-menu-por-ritmos.test.cjs` lo guarda. |
| D3 | **Techo de `app.js`** (ARQ-4: 37.530, sin margen) | La lógica nueva de menú va a `e17-experience.js` o a un fichero nuevo, **nunca a `app.js`**. `PLAN_TABS` vive en `app.js`: por eso recomiendo el mecanismo (i). |
| D4 | **Fichero nuevo** | Si se crea, debe versionarse en `index.html` y entrar en la caché del service worker (hay pruebas que lo exigen). |
| D5 | **Motor compartido** | Retirar una pantalla no retira su motor: `unifiedActionCenterModel` y el agente de ahorro pintan también Hoy. |
| D6 | **Enlaces cruzados** | Cada retirada exige reapuntar los `data-home-nav`/`href` entrantes (columna «Enlaces» del anexo). Hay 30 `data-home-nav` en `index.html`. |
| D7 | **Contador de uso ARQ-0** | Registra por `#id`: al no cambiar los ids, la serie histórica no se corta. |
| D8 | **Móvil** | El menú y cualquier franja de pestañas deben caber en 360 px sin recorte (`test:mobile-overflow` lo vigila en el CI). |
| D9 | **Modo consulta (Ola 2)** | Conviene declarar el menú como **datos** (una lista con grupo, destino y rol) para que el modo consulta derive de la misma fuente. Es el único cambio «de arquitectura» que sí recomiendo hacer ahora. |

## 9. Secuencia de entregas (camino B)

Cada entrega es un PR, con `npm run verify` y las pruebas de navegador del CI, y se deshace en un commit.

| Entrega | Contenido | Se mide con |
|---|---|---|
| **1** ✅ *(30/09/2026, sesión 272)* | ~~Menú declarado como datos (D9)~~ **aplazado**: renderizar el menú desde JavaScript lo sacaría del HTML estático y pondría en riesgo el primer pintado (hallazgo de rendimiento de la sesión 269); se hará en la Ola 2 si el modo consulta lo exige, y mientras tanto la fuente única es `index.html`, fijada por un test. Hecho: sale «Datos»; «Planificación de partidas» a pestaña de Plan (con enlace propio en el menú avanzado); entra «Escenarios»; rótulos por ritmo; corregido el grupo de «Movimientos» y «Escenario · simular» en el lanzador | Entradas principales 11 → 10; clics a Escenarios: 2 + desplazamiento → 1 |
| **2** ✅ *(30/09/2026, sesión 273)* | Franja de pestañas de Plan con Presupuesto, Esta semana y Partidas (mecanismo i), y franja gemela «Pantallas de Plan» en las tres pantallas destino | Clics a Presupuesto y Semana: 2 + desplazamiento → 2 |
| **3** ✅ *(30/09/2026, sesión 274)* | Franja de pestañas de Escenarios con **cuatro** destinos: Simular · Guardados · Asesor · Segunda opinión. **Los comparadores (Seguros, Fiscal, Patrimonio) se quedan en el menú avanzado** por decisión del hogar: agruparlos exigiría una pantalla de índice, que el camino B no crea | Las 4 pantallas alcanzables desde una sola entrada |
| **4** | Coherencia de Personalizar y buscador (D2); guardián que impida que una pantalla del menú principal dependa de un grupo filtrable | Prueba nueva en el CI |
| **5** | Redirecciones de §7, **solo con informe de uso y tu OK, una a una** | Pantallas en el menú avanzado |

## 10. Decisiones que necesito de ti

1. **Camino B (recomendado) o A.** Si eliges A, la entrega 1 pasa a ser la definición del modelo de hubs y crece a
   unas 6 entregas.
2. **Confirmar que «Datos» sale del menú principal.** Abre lo mismo que Registrar; se conserva el `#update-hub`.
3. **El informe «Uso de la app»** (Ajustes) cuando puedas: desbloquea la entrega 5.

## Anexo · Las 59 pantallas

Columnas: `Enlaces` = referencias entrantes desde el código (menú incluido); `Pruebas` = archivos de prueba que
citan el identificador. Ambas miden **el coste de moverla o retirarla**, no su uso.

| Pantalla | Título | Hoy en el menú | Enlaces | Pruebas | Destino | Acción | Nota |
|---|---|---|---|---|---|---|---|
| `home` | Hoy | Menú principal | 6 | 27 | HOY | Mantener | Base del modo consulta (Ola 2). |
| `widget` | Widget de solo lectura | Menú avanzado | 1 | 7 | HOY | Mantener | Solo lectura por diseño: base natural del modo consulta. Hoy escondido en el menú avanzado (Datos). |
| `planificacion-partidas` | Planificación de partidas | Menú principal | 9 | 4 | PLAN (mes) | Agrupar como pestaña | Ocupa una entrada principal de menú por sí sola. |
| `registrar` | Registrar | Menú principal | 7 | 33 | REGISTRAR | Mantener | Se rediseña en la Ola 3; no tocar antes. |
| `plan` | Plan | Menú principal | 5 | 66 | PLAN (mes) | Mantener | Centro del mes. Ya es hub (Mes · Previsión · Ahorro y objetivos). No tocar su interior. |
| `update-hub` | Actualizar mis datos | Menú principal | 1 | 18 | REGISTRAR | Alias ya activo | Redirige a Registrar desde R-10. La entrada «Datos» del menú abre lo mismo que «Registrar». |
| `alerts-center` | Centro de alertas | Avanzadas · Versiones anteriores | 4 | 6 | AJUSTES | Candidata a redirigir a Ajustes › Alertas | Los umbrales ya se editan en Ajustes. |
| `executive-advisor` | Asesor ejecutivo | Avanzadas · Versiones anteriores | 2 | 4 | HOY | Candidata a fusionar en Hoy | Comparte motor con Hoy (unifiedActionCenterModel). No es duplicado de asesor-decision: candidata a fusionar en Hoy, no a redirigir a otro asesor. |
| `new-life-simulation` | Simulación nueva vida | Solo Laboratorio (retirada 20/08) | 2 | 10 | Laboratorio | Ya retirada del menú | E-14 (20/08). Solo se abre en solo lectura desde Ajustes › Laboratorio. |
| `debt-roadmap` | Negociación y aplicación segura | Avanzadas · Versiones anteriores | 3 | 17 | DEUDA | Candidata (D-14, espera datos de uso) | Decisión previa T-4/D-14: no tocar sin datos reales de uso. |
| `new-life-definitive` | Simulación nueva vida definitiva | Solo Laboratorio (retirada 20/08) | 0 | 5 | Laboratorio | Ya retirada del menú | E-14. Sin ningún enlace entrante. |
| `escenario-simular` | Decidir · escenario | Menú avanzado | 7 | 5 | ESCENARIOS | Subir a menú principal | Hoy solo en avanzadas. Es la pregunta «¿y si…?». |
| `escenario-aplicar` | Decidir · aplicar escenario | Sin enlace (paso de un flujo) | 4 | 3 | ESCENARIOS | Mantener (paso de flujo) | Lo enlaza Deuda 3 veces; no es pestaña. |
| `escenario-guardados` | Decidir · escenarios guardados | Menú avanzado | 6 | 4 | ESCENARIOS | Agrupar como pestaña | Pestaña de Escenarios. |
| `escenario-comparar` | Decidir · comparar escenarios | Sin enlace (paso de un flujo) | 1 | 1 | ESCENARIOS | Mantener (paso de flujo) | 1 enlace entrante; se alcanza desde Escenarios. |
| `deuda-comparar` | Deuda · Comparar | Menú avanzado | 4 | 10 | DEUDA | Mantener | Ya es hub (DEUDA_SCREEN_TABS). |
| `deuda-ruta` | Deuda · Ruta | Menú principal | 6 | 12 | DEUDA | Mantener | Entrada principal del hub. |
| `deuda-contratos` | Deuda · Contratos | Menú avanzado | 3 | 7 | DEUDA | Mantener | Pestaña del hub. |
| `deuda-simulador` | Deuda · Simulador visual | Menú avanzado | 2 | 4 | DEUDA | Mantener | Pestaña del hub. |
| `inversion-cartera` | Inversión · Cartera | Menú principal | 5 | 1 | INVERSIÓN | Mantener | Ya es hub (INVERSION_SCREEN_TABS). |
| `inversion-rebalanceo` | Inversión · Rebalanceo | Menú avanzado | 1 | 1 | INVERSIÓN | Mantener | Pestaña del hub. |
| `inversion-fiscal` | Inversión · Fiscal | Menú avanzado | 3 | 1 | INVERSIÓN | Mantener | Pestaña del hub. |
| `inversion-jubilacion` | Inversión · Jubilación | Menú avanzado | 2 | 3 | INVERSIÓN | Mantener | Pestaña del hub. |
| `inversion-apalancamiento` | Inversión · Apalancamiento | Menú avanzado | 1 | 5 | INVERSIÓN | Mantener | Pestaña del hub. |
| `analisis` | Analizar · Análisis | Menú avanzado | 9 | 20 | CIERRE › Análisis | Agrupar / mantener | Retrospectiva («¿Acierta el plan?»); Cierre la enlaza. |
| `cierre` | Fin de mes · Cierre | Menú principal | 7 | 60 | CIERRE | Mantener | Recibe enlaces de app, Análisis y Deuda. Ya tiene el paso «Conciliar cuentas». |
| `conciliar` | Control · conciliación | Menú avanzado | 1 | 7 | CIERRE | Candidata a fusionar | Solapa con el paso 1 de Cierre. Verificar que no aporta cálculo propio. |
| `datos-importar` | Datos · importar en 4 pasos | Menú avanzado | 2 | 12 | REGISTRAR | Alias ya activo | Redirige a Registrar › Importar (R-10). |
| `registrar-mes` | Actualizar | Menú avanzado | 3 | 9 | REGISTRAR | Mantener | Promesa explícita de R-5: no retirar sin consultar al hogar. |
| `cuadro-mandos` | Cuadro de mandos | Menú avanzado | 3 | 5 | PLAN (mes) | Mantener en avanzadas | Detalle por partida; herramienta de experto. |
| `cambios-pendientes` | Cambios pendientes | Menú avanzado | 2 | 1 | Utilidad | Mantener | Bandeja de cambios sin guardar; enlazar desde el indicador de guardado. |
| `mapa-calor` | Cuadro de mandos · salud mensual | Menú avanzado | 3 | 2 | CIERRE › Análisis | Mantener en avanzadas | Vista de salud mensual. |
| `asesor-decision` | Decidir · asesor ejecutivo | Menú avanzado | 1 | 5 | ESCENARIOS | Mantener | Decisión sobre una oferta de deuda abierta. Alimenta Hoy y Deuda › Ruta. NO es duplicado de Ejecutivo. |
| `segunda-opinion` | Herramientas avanzadas · Decidir | Menú avanzado | 2 | 0 | ESCENARIOS | Agrupar | Pregunta de tesorería sobre un compromiso externo. |
| `herramientas-seguros` | Herramientas avanzadas · Seguros | Menú avanzado | 2 | 2 | ESCENARIOS › Comparadores | Agrupar | Comparadores «¿me conviene…?». |
| `herramientas-fiscal` | Herramientas avanzadas · Fiscal | Menú avanzado | 3 | 0 | ESCENARIOS › Comparadores | Agrupar | Comparadores «¿me conviene…?». |
| `herramientas-patrimonio` | Herramientas avanzadas · Patrimonio e invers | Menú avanzado | 4 | 2 | ESCENARIOS › Comparadores | Agrupar | Comparadores «¿me conviene…?». |
| `herramientas-analizar` | Herramientas avanzadas · Analizar | Menú avanzado | 3 | 2 | CIERRE › Análisis | Agrupar | Backtesting y deriva: es análisis de lo ya ocurrido. |
| `herramientas-datos` | Herramientas avanzadas · Datos | Menú avanzado | 2 | 3 | AJUSTES | Agrupar | Continuidad, compartir y archivo. |
| `ajustes` | Ajustes | Menú principal | 17 | 28 | AJUSTES | Mantener | 15.500 px de alto. Partirlo es una tarea aparte. |
| `faqs-ayuda` | Ayuda | Menú principal | 1 | 0 | AYUDA | Mantener | — |
| `presupuesto-mes` | Presupuesto | Menú avanzado | 5 | 19 | PLAN (mes) | Agrupar como pestaña | Hoy solo en el menú avanzado. Es el ritmo mensual. |
| `estado-semana` | Estado | Menú avanzado | 1 | 3 | PLAN (mes) | Agrupar como pestaña | Su único enlace de entrada es el menú avanzado. Es el ritmo semanal. |
| `visual-detail` | Actualizar previsiones | Avanzadas · Versiones anteriores | 7 | 12 | PLAN (mes) | Candidata a redirigir a Plan › Mes | 6 enlaces desde index.html: reapuntarlos primero. |
| `debt-liquidation-plan` | Plan deuda óptimo | Avanzadas · Versiones anteriores | 1 | 6 | DEUDA | Candidata (D-14, espera datos de uso) | Igual que la anterior. |
| `savings-agent` | Agente automático | Avanzadas · Versiones anteriores | 3 | 7 | PLAN (mes) | Candidata a fusionar en Plan › Ahorro | Lo enlaza Estado de la semana. Su motor se queda en app.js: se retira la pantalla, no el motor. |
| `virtual-advisor` | Asesor virtual | Avanzadas · Versiones anteriores | 1 | 5 | — | Candidata a retirar | 610 líneas sobre el motor del agente de ahorro. Verificar qué aporta que Hoy o Plan no. |
| `debt-control` | Refinanciación | Avanzadas · Versiones anteriores | 7 | 14 | DEUDA | Candidata (D-14, espera datos de uso) | La más enlazada de las heredadas (7). Verificar que «Radar de refinanciación» está cubierto. |
| `prevision` | Previsión | Menú avanzado | 2 | 7 | PLAN (mes) | Solapa con Plan › Previsión | Comprobar si aporta algo que la pestaña no tenga. |
| `update-data` | Actualización individual | Avanzadas · Versiones anteriores | 2 | 12 | REGISTRAR | Alias ya activo | Redirige a Registrar (R-10). |
| `simulator` | Escenarios y proyectos | Solo Laboratorio (retirada 20/08) | 5 | 6 | Laboratorio | Ya retirada del menú | E-14. Análisis aún la enlaza 2 veces. |
| `forecast` | Hasta 2036 | Menú avanzado | 1 | 58 | CAMINO | Mantener | La más protegida: 58 pruebas la citan. No mover su contenido. |
| `savings-plan` | Plan ahorro 821 | Solo Laboratorio (retirada 20/08) | 1 | 5 | Laboratorio | Ya retirada del menú | A-12. Lo cubre Plan › Ahorro y objetivos. |
| `data-entry` | Entrada operativa | Menú avanzado | 2 | 15 | REGISTRAR | Alias ya activo | Redirige a Registrar › Lote (R-10). |
| `data-audit` | Confianza del modelo | Solo Laboratorio (retirada 20/08) | 0 | 4 | Laboratorio | Ya retirada del menú | C-14. Sin ningún enlace entrante. |
| `reconciliation` | Cierre y confianza | Solo Laboratorio (retirada 20/08) | 1 | 14 | Laboratorio | Ya retirada del menú | C-14. app.js la pinta en caliente (14 pruebas). |
| `cashflow` | Detalle operativo | Solo Laboratorio (retirada 20/08) | 1 | 5 | Laboratorio | Ya retirada del menú | A-12. Solo la enlaza el Agente de ahorro. |
| `operations-manual` | Guía operativa offline | Avanzadas · Versiones anteriores | 1 | 4 | AYUDA | Agrupar | Guía operativa offline. |
| `movements` | Movimientos | Menú principal | 6 | 25 | REGISTRAR | Mantener | Uso diario del operador. El lanzador lo clasifica como «heredada» (incoherente, corregir). |
