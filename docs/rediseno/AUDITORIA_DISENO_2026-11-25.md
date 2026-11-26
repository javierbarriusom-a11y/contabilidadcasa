# Auditoría de diseño · la app frente a «Finanzas Casa · Rediseño» (25/11/2026)

> **Propuesta, no backlog.** Petición del hogar (25/11): «te subo el pdf de diseño para que audites la app también a nivel de diseño y
> ajustes las pantallas al mismo en las que no esté. Hazme una propuesta. Luego prioriza la finalización del rediseño de la pantalla de
> deudas». Manda `ESTADO.md`. Cifras de las capturas: las del arranque en caliente (contratos y movimientos **FICTICIOS**) y las de
> ejemplo del diseño; ninguna es del hogar. Decisiones nuevas desde **D-N49**.

## 0. Resumen en siete frases

1. **El PDF que ha subido el hogar (32 páginas) es el mismo diseño que ya está en `docs/rediseno/referencias/`.** Es decir: Sistema,
   Navegación, las dos barras y las pantallas en móvil y escritorio. Tiene tres páginas más porque Hoy en el móvil ocupa tres. Lo
   comprobé por el texto de cada página y viendo las de navegación y Deuda. No hay pantallas nuevas que copiar.
2. **De las 16 pantallas del diseño, 9 están hechas** con el diseño nuevo: Hoy, Movimientos, Clasificar, Repaso, Importar, Plan ›
   Mes, Plan › Previsión, Cierre y el Simulador visual. **No están hechas 5**: Patrimonio › Resumen, Inversión, Deuda, Decidir
   (Taller) y Ajustes con «Lo que la app te pide». Además falta **la navegación de 5 destinos**, que es lo que más se nota.
3. **La diferencia más grande no está en ninguna pantalla, sino alrededor de todas.** El diseño tiene un menú de cinco preguntas, el
   buscador arriba y el título de la pantalla a 40 px del borde. La app tiene:
   - un menú de 381 controles;
   - una franja de estado técnico (más de 70 px) y la tira de cinco cifras (más de 60 px);
   - un recuadro «Estado · Guía de este flujo» (más de 60 px).

   En total, unos 250 px antes del título en cada pantalla que no es Hoy. Hasta las pantallas ya rediseñadas parecen «la app de
   antes» por ese marco.
4. **La cabecera de pantalla no sigue el patrón del diseño.** El diseño pone un H1 corto («Plan», «Patrimonio», «Decidir») y, a su
   lado, el control segmentado de las pestañas. La app pone un antetítulo, un H2 largo, un subtítulo de dos o tres líneas y las
   pestañas en otra fila, con números (1 Plan · 2 Contratos · 3 Ofertas).
5. **En el móvil falta la barra inferior** (página 3 del PDF). Se hizo como DUO-05 y se retiró porque tapaba controles. Rehacerla
   «que se esconde al bajar» sigue pendiente de decisión.
6. **Deuda es la pantalla más lejos del diseño y la que más importa al hogar.** La maqueta `DeudaTRE.html` ya traduce `DeudaDesktop`
   del PDF con las decisiones posteriores del hogar (D-N28 y D-N40 a D-N44). El §5 propone cómo terminarla en cinco PR.
7. **El orden que recomiendo:**
   1. Deuda (§5).
   2. El marco común (§4, R1): quitar el cromo superior en el diseño nuevo y una cabecera de pantalla única. Es pequeño, y el
      rediseño de Deuda lo necesita para parecerse al PDF.
   3. La navegación de 5 destinos con la barra inferior.
   4. Patrimonio e Inversión.
   5. Decidir.
   6. Ajustes.

## 1. Método

- El PDF, página a página por su texto (`pdftotext`) y, las de navegación y Deuda, como imagen. Las referencias del repositorio son
  las mismas páginas en PNG a 1440 y 390 px (`referencias/INDICE.md`).
- Hojas comparativas a 1440 × 1000 en `docs/rediseno/auditoria-2026-11-25/hoja1.jpg` a `hoja5.jpg`: el diseño a la izquierda y la app a
  la derecha (`dist/` de la rama del 25/11, arranque en caliente, primera pantalla). Son diez pares:
  - Hoy · Movimientos;
  - Plan › Mes · Previsión (en la app, la versión anterior «Previsión mensual»: la nueva vive en la pestaña de Plan);
  - Cierre · Patrimonio;
  - Inversión · Deuda;
  - Decidir (Taller) · Ajustes («Lo que la app te pide»).
- Las medidas de alto y campos por pantalla son las de la decimotercera auditoría, §7.1.

## 2. Hallazgos transversales (afectan a todas las pantallas)

| # | Diseño (PDF) | App hoy | Efecto | Propuesta |
|---|---|---|---|---|
| G1 | Menú de **5 destinos con su pregunta** (Hoy «¿Vamos bien?», Movimientos «¿Qué ha pasado?», Plan «¿Qué viene?», Patrimonio «¿Cuánto tenemos y debemos?», Decidir «¿Qué hacemos con el dinero?») | 9 entradas en cinco grupos («Día a día», «Cada mes», «A largo plazo», «Para decidir», «Sistema») más FAQs y «Herramientas avanzadas» con unas 50 entradas | No hay sitio para Patrimonio ni para Decidir; Deuda e Inversión cuelgan de «A largo plazo» | R2 (navegación) |
| G2 | El título de la pantalla, arriba | La franja «DATO REAL · LOCAL · Cambios guardados… · Fuente: demo-publico-anonimizado», la tira de cinco cifras y el recuadro «ESTADO · Consulta o edición… · Guía de este flujo» | ~250 px de cromo; la tira repite cifras que la pantalla ya da (y fue la quinta fecha de deuda hasta TRE-D0) | R1 (marco común) |
| G3 | **H1 corto + control segmentado a su lado**; acciones a la derecha | Antetítulo + H2 largo + subtítulo + pestañas en otra fila (en Deuda, numeradas) | Cada pantalla se presenta distinto | R1 |
| G4 | **Barra inferior** en el móvil con los 5 destinos | No hay (DUO-05 retirada) | En el móvil, cambiar de sitio es «Menú» y una lista larga | R2 |
| G5 | **«Buscar o hacer… ⌘K»** arriba del menú | «Buscar o abrir», al final del menú | El atajo que sustituye a «Herramientas avanzadas» no se ve | R2 |
| G6 | Pie del menú: **Hogar · Persona 1 · Persona 2** y **Ajustes** con «Local · guardado 14:49» | La tarjeta «Vista familiar» (168 px), el panel de sincronización (150 px) y «18 por revisar» | El menú mide 1.663 px cerrado | R2 (y TRE-08) |
| G7 | Cifras con su estado (● ◐ ○) y «EJEMPLO» rayado cuando son de ejemplo | Hecho en las pantallas v2; en las de siempre, «DATO REAL» / «SIMULACIÓN» en la franja | Coherente donde hay v2 | Con cada pantalla |

## 3. Pantalla a pantalla

| Pantalla (PDF) | Estado en la app | Qué falta o se aparta | Hoja |
|---|---|---|---|
| Sistema (p. 1) | **Hecho** (A1, tokens en `tema-v2.css`) | Fuente del sistema en vez de Geist (decidido: sin terceros) | — |
| Navegación (p. 2-4, 8) | **No hecho** | G1, G4, G5, G6 | — |
| Hoy (p. 5-7, 9) | **Hecho**, con desviaciones decididas (áreas en pestañas, D-N29 y «Hoy por áreas») | Acciones de cabecera «Repaso semanal» y «Apuntar gasto» del diseño frente a «Ver todo el detalle» y «+ Registrar gasto»; «Decidir esta semana» cae fuera de la primera pantalla en el escritorio (en el diseño se ve entera); el cromo (G2) y, el estreno de cada dispositivo, «Primeros pasos» (TRE-09) | 1 |
| Movimientos (p. 10, 13) | **Hecho**, con otro orden | El diseño pone tres tarjetas de bandeja en fila (extracto nuevo · sin partida · hecho solo), la cobertura, los filtros y la tabla, todo en la primera pantalla; la app pone el repaso, la bandeja en lista y la tarjeta «Cosas raras» abierta, y la tabla queda a ~1.000 px | 1 |
| Clasificar (p. 11) | **Hecho** | — | — |
| Repaso semanal (p. 12, 14) | **Hecho** | — | — |
| Plan › Mes (p. 15, 18) | **Hecho** | Pestañas: el diseño tiene tres (Mes · Previsión · Objetivos) y la app seis (con Presupuesto, Esta semana y Partidas detrás de una raya); el diseño tiene «Copiar septiembre» y «+ Partida» al pie | 2 |
| Plan › Previsión (p. 16, 19) | **Hecho** (C2, en la pestaña de Plan) | La pantalla antigua «Previsión mensual» (`#prevision`) sigue en «Herramientas avanzadas» con su propio titular y otra lectura del mismo dato | 2 |
| Cierre (p. 17, 20) | **Hecho** (C3) | Solo el cromo (G2) y la guía del cierre en una línea encima (decidido) | 3 |
| Patrimonio › Resumen (p. 21, 25) | **No hecho** | No hay pantalla: el patrimonio neto vive repartido entre el área de Hoy, Ajustes › Patrimonio y «Comparadores de patrimonio» | 3 |
| Inversión (p. 22, 26) | **No hecho** | La app es la de siempre: 8.946 px y 51 campos en el móvil, con la tira de cinco cifras delante del título. El diseño tiene una cifra, «Este año» en cascada, el reparto frente a la política y tres tarjetas (impuestos, futuro, calma) | 4 |
| Deuda (p. 23, 27) | **No hecho** (en curso: TRE-D0 hecho, maqueta `DeudaTRE.html`) | Ver §5 | 4 |
| Decidir · Taller de deuda nueva (p. 24, 28) | **No hecho** (Deuda › Ofertas › Préstamo cubre una parte) | Falta el destino «Decidir» con Próximo euro · Deuda nueva · Escenarios y el taller en seis pasos con la política de deuda | 5 |
| Importar (p. 29, 31) | **Hecho** | — | — |
| Ajustes · Lo que la app te pide (p. 30, 32) | **No hecho** como pantalla (XDA-01 existe, plegado en Uso de la app) | El diseño tiene Ajustes con **submenú a la izquierda** (Hogar y cuentas, Reserva y colchón, Partidas y reglas, Políticas, Lo que la app te pide, Laboratorio, Uso de la app, Datos y exportación) y una página por apartado. Es lo que proponía TRE-21 para el escritorio (25.645 px y 145 campos), y le da la razón | 5 |

## 4. Propuesta: ajustar al diseño lo que falta

**R1 · El marco común del diseño nuevo (P1 · S-M).** En el tema v2, y en todas las pantallas:
- **Fuera la franja de estado.** Se queda un punto en la cabecera, como en TRE-09: verde, guardado y sincronizado; ámbar, solo en
  este equipo; rojo, error. Al tocarlo se abre lo de siempre.
- **La tira de cinco cifras, solo en las pantallas que aún no tienen su propia cifra protagonista**, y fuera en cuanto la tengan.
- **El recuadro «Estado · Guía de este flujo» pasa a un enlace «Guía» en la cabecera.**
- **Una sola cabecera de pantalla:** H1 corto, el control segmentado a su lado y las acciones a la derecha. En el móvil, el H1 y el
  control debajo, en una fila con desplazamiento.

En el clásico, todo como está. Criterio de hecho: el título a menos de 100 px del borde superior en todas las pantallas v2, a 1440 y a
390 px; el inventario XGO-01 al día.
**D-N49 (se consulta):** quitar la tira de cinco cifras de las pantallas que ya tienen cifra protagonista: Plan, Cierre, Deuda y,
cuando se rehagan, Inversión y Patrimonio. Recomendación: **sí**. No se pierde información: cada pantalla da esas cifras en su sitio,
y la tira fue la que tuvo la quinta fecha de deuda.

**R2 · La navegación de 5 destinos (P1 · L).** El mapa de la página 2 del PDF:
- **Menú del escritorio:** cinco entradas con su pregunta, el buscador ⌘K arriba y, al pie, la persona y Ajustes con el estado de
  guardado.
- **Barra inferior en el móvil:** DUO-05 rehecha como barra que se esconde al bajar.
- **Lo que hoy está en «Herramientas avanzadas»** pasa al buscador y a «Más» dentro de cada destino. **No se borra ninguna pantalla:**
  los hashes de siempre siguen llevando a su sitio.
- **Patrimonio** agrupa Resumen, Inversión y Deuda; **Decidir**, Próximo euro, Deuda nueva y Escenarios.

Arregla de paso el vacío del escritorio (TRE-08): con cinco entradas, el menú cabe en la ventana.
**D-N50 (se consulta):** reorganizar el menú en 5 destinos y la barra inferior, sin retirar pantallas. Recomendación: **sí**, después
de Deuda. Si se acepta, **D-N48** (el menú con desplazamiento propio) deja de hacer falta.

**R3 · Patrimonio › Resumen e Inversión (P1 · L).** Desde `Patrimonio`/`PatrimonioDesktop` e `Inversion`/`InversionDesktop`.
Es TRE-22, con los componentes comunes de TRE-23.

**R4 · Decidir (P2 · L).** El destino con Próximo euro (la escalera de WP-42), Deuda nueva (el taller de `Taller.png`, que absorbe Deuda
› Ofertas › Préstamo) y Escenarios.
**Choque con D-N44 que conviene ver ya.** D-N44 lleva la escalera del próximo euro al Plan de Deuda; el PDF la pone en Decidir. No es
incompatible: hasta que exista Decidir, vive en Deuda › Plan («¿Por qué este orden?»); cuando exista, su casa es Decidir y Deuda
enlaza a ella.

**R5 · Ajustes con submenú (P2 · M).** Desde `LoQuePide`/`LoQuePideDesktop`. En el escritorio es TRE-21 con el aspecto del diseño;
en el móvil, las áreas de UND-04 (D-N29) ya son el equivalente.

**R6 · Retoques en pantallas hechas (P2 · S cada uno).**
- **Movimientos:** la bandeja en tres tarjetas en fila y «Cosas raras» plegada con su contador, para que la tabla vuelva a la primera
  pantalla.
- **Plan:** tres pestañas y «Más» con Presupuesto, Esta semana y Partidas.
- **Hoy:** «Decidir esta semana» en la primera pantalla del escritorio.

Cada retoque cambia una pantalla en uso: se hace uno por PR y con su medida.

## 5. Prioridad del hogar: terminar el rediseño de Deuda

### 5.1 Qué referencia manda

El PDF pone Deuda dentro de Patrimonio, con tres subpestañas: Calendario · Contratos · Mejorar (`DeudaDesktop`). El hogar decidió
después (D-N28) tres pestañas propias: **Plan · Contratos · Ofertas**. La maqueta `DeudaTRE.html` (25/11) une las dos cosas:

| Del diseño (`DeudaDesktop`) | En la maqueta y en lo que se construye |
|---|---|
| Cuatro cifras arriba (deuda viva, cuota sobre ingresos, libre de deuda, coste medio) | Arriba, una cifra protagonista: la fecha única (D-N40) con el ahorro; las otras tres, en una fila debajo |
| Banda «Entidad B y C no tienen cuota ni TIN… · Completar · 1 min» | «Datos que faltan» con su recorrido de uno en uno (TRE-D4) |
| Diagrama por contrato con lo adelantado rayado («lo que os ahorráis») | El orden como Gantt por contrato (TRE-D1, bloque D) |
| «¿Y si ponemos algo más cada mes?» con − 100 € + y «Libre en» / «Intereses» | El panel «Ajustar el plan» (TRE-D2) y su vista previa |
| Orden de ataque: más cara primero · más pequeña primero · sin extra | Dentro del panel (TRE-D2); la comparación entera, en «Comparar con otras formas» (TRE-D3c) |
| «Mejorar»: ¿amortizar o invertir?, preparar la negociación, ITV anual de la deuda | Ofertas como bandeja con veredicto (§2.5b, D-N44) y «Qué podéis pedir»; la ITV, en la revisión trimestral |

**Propuesta:** construir desde la maqueta, que ya es el PDF con las decisiones del hogar, y usar `DeudaDesktop` para los detalles
visuales: el rayado de lo ahorrado, el control − / + y los tonos de las tarjetas de resultado. El nombre de las pestañas sigue siendo el
de D-N28.

### 5.2 Orden de trabajo (cinco PR, cada uno con su batería, su CI y la vista de siempre detrás de «Ver todo el detalle»)

| # | PR | Qué | Criterio de hecho | Tamaño |
|---|---|---|---|---|
| 1 | **TRE-D1 · Plan nuevo** (hecho el 25/11, con TRE-D3; ESTADO §2) | Vista nueva de Deuda › Plan (`deuda-plan-v2.js`, tema v2) sobre los motores de siempre. **Héroe:** fecha única, ahorro y barra de capital (estimado si falta el capital inicial, TRE-D6). **«Este mes»:** cuánto y a qué contrato, con «Ya lo he pagado» y «Este mes no puedo». **«Cómo vais»:** la fila del seguimiento de DUO-D1. **Gantt** por contrato con el rayado del diseño. **Accesos:** Ajustar, Comparar y Cerrar las saldadas. **Colchón primero (D-N42)** en el héroe y en «Este mes» cuando la liquidez está bajo la reserva. Todo lo de hoy, detrás de «Ver todo el detalle» | Deuda › Plan ≤ 1.300 px a 1280 y ≤ 2.600 a 390; TRE-07 y DUO-01 en verde; axe en claro y oscuro; Safari | M-L |
| 2 | **TRE-D2 · Ajustar el plan** (hecho el 25/11, ESTADO §2) | Panel lateral en el escritorio y hoja en el móvil con los controles del plan óptimo agrupados (cuánto al mes con − / +, orden, lo que cambia el coste, tipo variable) y su vista previa en el héroe | Un solo control de «al mes» en la vista; DUO-01 sin excepciones nuevas | M |
| 3 | **TRE-D3c · Comparar con otras formas** (hecho el 25/11, ESTADO §2) | Una tabla: solo cuotas · plazos firmados · bola de nieve o avalancha · consolidar · liquidar con caja (con «Aplicar como escenario») · no tocar nada. Cada fila con su «Ver detalle» de siempre | Todas las piezas del inventario (§2.6) a dos toques como mucho | M |
| 4 | **TRE-23 + TRE-D4 · Contratos** (hecho el 25/11, ESTADO §2) | Componentes comunes (ficha, lista de tarjetas, plegado con señal) y Contratos en tarjetas con su ficha y «Datos que faltan» | 0 desbordamiento a 320 px; ≤ 10 campos visibles | L |
| 5 | **Ofertas (D-N44)** (la bandeja, TRE-D5a, hecha el 25/11; sacar lo que no son ofertas, TRE-D5b, pendiente) | Bandeja de ofertas con veredicto, «Añadir una oferta», «Qué podéis pedir»; salen a su sitio, redirigiendo, la escalera y «Dinero parado», «Repartir la nómina» y la capacidad | Los hashes de siempre llevan a su sitio; Ofertas ≤ 1.400 px a 1440 | M |

**Antes del PR 1, R1 en pequeño:** la cabecera común (H1 y control segmentado) se estrena en Deuda; el resto de pantallas la toman
en R1.

**Calendario realista:** cada PR lleva un día de trabajo y una hora de CI.
- PR 1 y 2: esta semana.
- PR 3 y 4: la semana del 30/11.
- PR 5: la del 7/12.
- Revisión de Deuda (graduar la vista nueva o dos semanas más): la del 14/12, con la revisión trimestral.

### 5.3 Lo que se consulta para Deuda

- **D-N41** (retirar de Contratos las dos listas de orden y el simulador de consolidación): sigue pendiente; afecta al PR 4.
- **D-N43** (el plan por titular): sigue pendiente; no bloquea nada.

## 6. Decisiones nuevas

- **D-N49:** quitar la tira de cinco cifras de las pantallas con cifra protagonista (R1). Recomendación: **sí**. **Decidida: «sí» del
  hogar (25/11/2026).** Se aplica con cada pantalla que estrena cifra protagonista; la primera, Deuda › Plan (TRE-D1).
- **D-N50:** navegación de 5 destinos y barra inferior, sin retirar pantallas (R2). Recomendación: **sí**, después de Deuda.
  **Decidida: «sí» del hogar (25/11/2026)**, en ese orden. Con ella, **D-N48** (el menú con desplazamiento propio) deja de hacer falta:
  con cinco entradas el menú cabe en la ventana.

**Siguiente número libre: D-N51.**
