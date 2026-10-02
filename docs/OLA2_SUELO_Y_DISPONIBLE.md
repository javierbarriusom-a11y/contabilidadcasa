# Ola 2 · El número de Hoy: suelo de liquidez y «disponible» (mínimo proyectado a 30 días) — diseño

Fecha: 1 de octubre de 2026 (sesión 283). Estado: **diseño; no hay código.** Recoge las decisiones del hogar del 1/10/2026 (`BACKLOG_UX_OLAS.md` §8.5) y **sustituye la definición A de
`docs/OLA2_HOY_Y_CONSULTA.md` §3** (caja de CaixaBank − suelo − salidas hasta el próximo ingreso), que ya no responde a lo que el hogar necesita.

> **2/10/2026 — parcialmente sustituido por [`docs/OLA2_RECALIBRACION.md`](OLA2_RECALIBRACION.md).** La medición con datos reales dio un 100 % de salidas con fecha estimada: el «disponible» a 30 días (§5, §6), la entrega S3 y las «dos lecturas» (S-5) **se cancelan**; el horizonte pasa a ser el mes natural (S-3 sustituida) y S2 se funde con la nueva S3′. **Siguen vigentes:** el suelo sobre el total, los dos parámetros, los valores iniciales (§2–§4) y S1.

Todas las cifras de ejemplo de este documento son **ilustrativas o del dataset demo público, no del hogar**.

## 1. Resumen

- **Qué quiere el hogar:** un número que sea *(CaixaBank + Mediolanum) − suelo − compromisos conocidos*, para decidir si **gasta, ahorra para el mes siguiente o invierte**. Mediolanum «se puede disponer». El suelo es **sobre el total**
  y debe poder parametrizarse.
- **Hallazgo que simplifica el diseño:** el parámetro que hoy se llama «suelo» (`state.operatingReserve`, `agentCaixaFloor()`) **ya es un mínimo operativo de CaixaBank**, y todo el modelo de traspasos lo trata así (§3). Reinterpretarlo como suelo
  total tocaría ~63 líneas de `app.js`, 10 ficheros más y un guardarraíl dorado. **No hace falta: se añade un parámetro nuevo** (el suelo de liquidez, sobre el total) y el existente conserva su significado (§4).
- **Horizonte aprobado:** *mínimo proyectado a 30 días*, no «hasta el próximo cobro». Con tres ingresos de distinto tamaño, «hasta cobrar» **sobrestima lo disponible justo al cobrar la nómina y baja el día que entra el local** (§6, con un ejemplo que
  sirve de caso de prueba).
- **Lo que no se arregla con diseño:** la fiabilidad depende de que las salidas tengan fecha real (§7). Sin histórico, la app fecha las salidas el «día 8».
- **Orden:** liberar líneas de `app.js` → parámetro nuevo → módulo y pantalla en un solo PR (§8). Nada se construye hasta que el hogar conteste §9.

## 2. Decisiones del hogar que fijan este diseño

| Decisión (1/10/2026) | Efecto aquí |
|---|---|
| El número es saldo total − suelo − compromisos | Suma las dos cuentas (§5) |
| Mediolanum «se puede disponer» | Entra en el saldo total |
| El suelo es sobre el total y parametrizable | Parámetro nuevo (§4) |
| «Cobrar» incluye las dos nóminas y el local | Por eso «hasta cobrar» da una ventana de ~1, ~24 y ~6 días (§6) y se sustituye por un horizonte fijo |
| Aprobado el mínimo proyectado a 30 días | Especificación del §5 |
| Tere se fecha el 25 aunque cobra el 22; Javi, el último día natural | Calendario de ingresos del modelo (hecho para Javi en el PR #419) |
| Todo lo contestó quien opera; no se consulta a otra persona | Premisa sin contrastar (riesgo, §10) |

## 3. Inventario: dónde se lee hoy el «suelo» y qué significa en cada sitio

Ocurrencias de `agentCaixaFloor` (33), `operatingReserve` (18) y `requiredReserve` (12) en `app.js`, más:

| Fichero | Qué hace con el suelo | Significado |
|---|---|---|
| `canonical-decisions.js` · `transferForMonth` | `reserva exigida = suelo + salidas del mes siguiente`; `traspaso = saldo CaixaBank − reserva exigida` | Mínimo operativo de CaixaBank |
| `canonical-savings-agent.js` · `sweepCashPlan` | Misma regla mes a mes, y **rescata de Mediolanum** si CaixaBank baja de la reserva exigida | Mínimo operativo de CaixaBank, con flujo en los dos sentidos |
| `canonical-daily-engine.js` | `policy.operatingReserve` solo se normaliza en `normalizeInput`; no he encontrado otro uso | — |
| `views/debt-liquidation-plan.js` | «CaixaBank no debe bajar de X ni dejar sin cubrir pagos del mes siguiente» | Mínimo operativo de CaixaBank |
| `views/executive-advisor.js`, `views/new-life-simulation.js`, `views/new-life-definitive.js`, `views/virtual-advisor.js`, `views/savings-agent.js` | «Reserva CaixaBank», «Saldo operativo + pagos previstos del próximo mes», «la cuenta operativa debe conservar…» | Mínimo operativo de CaixaBank |
| `views/reconciliation.js` | Solo muestra el «mínimo diario» del total | — |
| `tests/golden/datasets/D1-D3` · `reservaOperativaCuentaOperativa: 3000` | Guardarraíl dorado | Mínimo operativo **de la cuenta operativa** |

**Lectura:** el modelo actual es «CaixaBank es la cuenta operativa, Mediolanum es el ahorro, y un barrido mensual mueve dinero entre ambas para que CaixaBank tenga *suelo + el mes siguiente*». Eso encaja con un **mínimo operativo en la cuenta**, no con
un suelo sobre el total. Persistencia actual: `state.operatingReserve` viaja en el bloque de ajustes de `saveScenarioSettings` y se sincroniza con `queueRemoteSave` (`tests/v6-reserva-operativa.test.cjs`, «V6-1»).

## 4. Diseño: dos parámetros, sin reinterpretar el existente

| Parámetro | Qué es | Dónde vive | Quién lo lee |
|---|---|---|---|
| **Mínimo operativo en CaixaBank** (existente) | Lo que debe quedar en la cuenta operativa antes de traspasar a Mediolanum | `state.operatingReserve` / `agentCaixaFloor()` | Todo lo del §3. **Sin cambios de significado ni de cifras** |
| **Suelo de liquidez** (nuevo) | Lo que el hogar no quiere que baje la liquidez **total** (CaixaBank + Mediolanum) | Dato nuevo del hogar, por el mismo camino de persistencia y sincronización que `operatingReserve` | Solo el número «disponible» de Hoy |

Reglas:
- El «disponible» **solo** usa el suelo de liquidez. El mínimo operativo no entra en su fórmula.
- **Valores iniciales decididos (1/10/2026):** suelo de liquidez **1.500 €**; mínimo operativo en CaixaBank **sin tocar**, es decir, el que el hogar tiene en Ajustes (**1.500 €**). Los dos son **parametrizables**. El valor por defecto del código (`DEFAULT_AGENT_CAIXA_FLOOR`, 2.500 €) y las cifras de la demo y de los ejemplos de este documento no son los del hogar. No cambia ninguna cifra existente; si el hogar quiere otro valor del mínimo operativo, se cambia después y se ve en las pantallas de deuda y traspasos.
  cambia después y se ve en las pantallas de deuda y traspasos.
- Si CaixaBank queda por debajo de su mínimo operativo aunque el total esté por encima del suelo, Hoy lo dice en una línea secundaria («mueve X a CaixaBank»); no cambia el «disponible».
- **No se renombra todavía** el control visible «Reserva operativa»: muchas pruebas fijan ese texto. Se añade una nota que aclara que es el mínimo de la cuenta operativa.
- **Techo de `app.js` (37.530):** añadir un parámetro persistido y su control exige liberar líneas antes (§8, S1).

## 5. Especificación del «disponible»

**Fórmula:** `disponible = liquidez total − suelo de liquidez + punto más bajo del acumulado de movimientos fechados en los próximos 30 días` (el acumulado incluye el 0 de partida, así que el término nunca es positivo).

Entradas: fecha de los saldos (`AAAA-MM-DD`, la misma que ya usa el modelo), saldo de CaixaBank, saldo de Mediolanum, suelo de liquidez, los eventos del motor diario, horizonte (30 días naturales).

Reglas, cada una con su prueba:
1. **Qué movimientos cuentan:** ingresos suman; salidas restan (de cualquier cuenta); **los traspasos entre las dos cuentas valen 0** (no cambian el total). Ventana: `fecha de los saldos < fecha <= +30 días` (lo fechado hoy ya está en el saldo, igual que
   `date > asOf` del motor diario).
2. **Orden dentro de un mismo día:** primero las **salidas**, luego los ingresos. Es el criterio prudente, coherente con la preferencia del hogar (Tere el 25, Javi el último día natural). Se devuelve también el valor «si los ingresos van primero» y un
   indicador de si **el signo** depende de ese orden, porque con fechas de relleno (todo el mes el «día 8») depende por completo.
3. **Un negativo se dice, con su importe, su fecha y su causa:** «faltan X € para no bajar del suelo el día D por E». Nunca se recorta a 0.
4. **Si falta un dato no hay cifra:** saldo, suelo, fecha de los saldos o calendario ausente → `status: "missing"` y se nombra cuál. `null`, `""` y `NaN` no valen 0.
5. **Fiabilidad visible:** importe de los movimientos hasta el punto más bajo por confianza (`observed` / `rule` / `estimated`) y porcentaje estimado. Si el calendario no cubre los 30 días, se marca como parcial.
6. **Céntimos exactos** (aritmética en enteros) y **sin mutar las entradas**.
7. **Salida estable** con los mismos campos aunque falte algo, para que la pantalla no ramifique por forma.

## 6. Por qué mínimo proyectado y no «hasta cobrar»: ejemplo y caso de prueba

Calendario **ilustrativo e inventado** con el patrón de ingresos del hogar: local el día 1 (+800 €), Tere el 25 (+2.200 €), Javi el último día (+3.300 €); salidas el 3 (900), 8 (350), 12 (200), 15 (500), 20 (300) y 28 (400);
suelo 2.500 € (ilustrativo: el del hogar es 1.500 €); saldo total 7.200 € al empezar el día 1. Consulta al **final** del día (el saldo ya incluye lo de ese día).

| Consulta | Saldo total | Ventana «hasta cobrar» | **Hasta cobrar** | **Mínimo proyectado a 30 días** | Punto más bajo |
|---|---|---|---|---|---|
| mes 1 · día 24 | 5.750 | 1 día | 3.250 | 3.250 | — |
| mes 1 · día 25 | 7.950 | 6 días | 5.050 | 5.050 | día 28 |
| mes 1 · día 30 | 7.550 | 1 día | 5.050 | 5.050 | — |
| **mes 1 · día 31** (cobra Javi) | 10.850 | 1 día | **8.350** | **6.900** | mes 2 · día 20 |
| **mes 2 · día 1** (entra el local, +800) | 11.650 | 24 días | **6.900** | **6.900** | mes 2 · día 20 |
| mes 2 · día 2 | 11.650 | 23 días | 6.900 | 6.900 | mes 2 · día 20 |
| mes 2 · día 24 | 9.400 | 1 día | 6.900 | 6.900 | — |
| mes 2 · día 25 (cobra Tere) | 11.600 | 6 días | 8.700 | 8.700 | mes 2 · día 28 |

Lo que enseña:
- **El día 31, «hasta cobrar» dice 8.350 € y es optimista en 1.450 €:** con una ventana de 1 día no ve las salidas del mes siguiente que llegarán antes de que cobre Tere. Es justo el momento en que el hogar decide gastar, ahorrar o invertir.
- **El día 1, entran 800 € y «hasta cobrar» *baja* 1.450 €** (de 8.350 a 6.900) porque la ventana salta de 1 a 24 días.
- **El mínimo proyectado da 6.900 € los dos días** y solo se mueve cuando el dinero se mueve.

Estos números son el **caso de prueba de aceptación** del módulo (§8, S3), junto con los de §5.

## 7. Lo que este diseño no resuelve

- **La fecha de las salidas.** Sin histórico conciliado, la app fecha las partidas de gasto el «día 8» (`confidence: "estimated"`); en la demo, las seis partidas de octubre (4.730 €) caen el mismo día que el ingreso y el signo del margen
  cambia según el orden. El mínimo proyectado lo atenúa (no hay un corte en un ingreso), pero no lo elimina. Por eso §5.2 y §5.5 devuelven la dependencia en lugar de ocultarla.
- **Registrar a mano no da fechas** (guarda un importe por partida y mes). Solo los extractos importados mejoran las fechas, y solo para partidas del mismo mes que casen por etiqueta e importe. Con extractos 3 veces por semana la mejora es parcial.
- **Quién consulta.** Todas las decisiones las dio quien opera.

## 8. Entregas

| Entrega | Contenido | Hecho cuando | Riesgo |
|---|---|---|---|
| **S0** | Este documento | Fusionado | — |
| **S1** (✅ aprobada el 1/10/2026; ✅ **hecha el 1/10/2026, sesión 286**) | Liberar líneas de `app.js`: extraer `canonicalDailyInput` (~110 líneas, acopladas a `state` y a helpers de fecha) a un módulo | Techo de `app.js` reducido; `npm run verify` y los datasets dorados idénticos; `opt6-…` y `f1-…` ajustados sin relajar su intención · **Resultado:** extraídas 166 líneas (la función y sus tres ayudantes) a `canonical-daily-input.js`; `app.js` 37.530 → 37.365 y techo a 37.495; datasets dorados sin diferencias; `opt6-…` y `f1-…` no necesitaron ajuste | Medio |
| **S2** (2/10/2026: **se funde con S3′**, ver `OLA2_RECALIBRACION.md`) | Parámetro «suelo de liquidez»: dato del hogar persistido y sincronizado como `operatingReserve`, control en Ajustes con ayuda, nota sobre el mínimo operativo | Prueba equivalente a «V6-1»; **ninguna cifra existente cambia**; techo de `app.js` respetado | Bajo |
| **S3** (2/10/2026: **cancelada**, sustituida por S3′) | `canonical-home-verdict.js` v2 (esta especificación) **y** su consumidor en Hoy, **en un solo PR** (guardián ARQ-3). Medición previa con datos reales del hogar (`estimatedShare`) y `test:load-budget` antes y después | Casos del §5 y §6 como pruebas; veredicto visible sin desplazarse en 390×844 (< 700 px); axe y `mobile-overflow` en verde | Medio (pantalla más vista) |
| **S4** (2/10/2026: **primera entrega**, independiente de las demás) | Frescura del dato pegada a la cifra (saldos a…, último movimiento hace N días) | Prueba de navegador | Bajo |

Cada entrega pasa por la **regla de parada** (`BACKLOG_UX_OLAS.md` §8.4, versión 2 aún sin contestar): métrica y objetivo antes de construir, medida con las dos personas, y se detiene si no mueve la métrica.

## 9. Decisiones que faltan del hogar

| # | Pregunta | Recomendación |
|---|---|---|
| S-1 | Valor inicial del suelo de liquidez y del mínimo operativo en CaixaBank | ✅ **Decidido 1/10/2026:** suelo de liquidez 1.500 €; mínimo operativo sin tocar (1.500 € en Ajustes); ambos parametrizables |
| S-2 | Si CaixaBank baja de su mínimo operativo pero el total está por encima del suelo, ¿Hoy lo avisa? | ✅ **Decidido 1/10/2026: sí**, en una línea secundaria |
| S-3 | ¿Horizonte fijo de 30 días o configurable? | ✅ **Decidido 1/10/2026: fijo en la primera versión** (recomendación aceptada) |
| S-4 | ¿Cómo se llama en pantalla? («Disponible», «Podéis gastar», otro) | ✅ **Decidido 1/10/2026: «Disponible»**, con el suelo visible al lado (recomendación aceptada) |
| S-5 | Con fechas de relleno (D6): ¿dos lecturas con el motivo, o esconder la cifra? | ✅ **Decidido 1/10/2026: dos lecturas con el motivo** (recomendación aceptada). Es la respuesta a D6 de `BACKLOG_UX_OLAS.md` |
| S-6 | ¿El bonus de Javi llega con la nómina? (hoy conserva «último día hábil») | ✅ **Resuelto 1/10/2026: no hay bonus mensual.** La partida que cae en la regla de diciembre es «Hacienda-otros ingresos» (3.000 €, llega sobre el 10/12); la app la fecha el **15 a propósito** (más tarde es más prudente) y el hogar lo mantiene. La regla del «bonus» del resto de meses no se usa en sus datos y no se toca |

## 10. Riesgos

1. **Dos «suelos» en pantalla confunden.** Mitigación: nombres distintos, la nota de §4 y la línea secundaria de S-2.
2. **El número se ve fiable y no lo es** si las salidas tienen fechas de relleno. Mitigación: §5.2 y §5.5, y medir `estimatedShare` con datos reales antes de S3.
3. **Techo de `app.js` y guardián ARQ-3:** S1 antes de S2/S3; módulo y consumidor en un solo PR.
4. **Premisa sin contrastar:** quien solo consulta no ha dado su visión. Mitigación: que lo pruebe dos minutos cuando exista S3.
5. **Aprendizaje del 1/10:** una hipótesis de diseño que parecía clara («hasta cobrar») resultó engañosa al calcularla con el calendario real del hogar; los números de §6 existen para que el siguiente cambio se discuta con cifras y no con intuiciones.
