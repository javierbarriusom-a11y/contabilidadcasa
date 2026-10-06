# Backlog definitivo — Contabilidadcasa

**Creado el 3 de octubre de 2026 (sesión 296), a petición del hogar:** «genérame el backlog definitivo y el plan de desarrollo resultante de tu análisis y las nuevas propuestas, incluyéndolas todas, pero priorizadas. No quiero empezar el desarrollo aún».
**Es la única fuente viva de lo que falta por hacer.** Sustituye como backlog vigente a `BACKLOG_INICIO_OLEADA_OCTUBRE.md`, que queda como detalle histórico (sus §0-§15 siguen siendo válidos como razonamiento). Mapa de todos los backlogs: [`BACKLOG_INDICE.md`](BACKLOG_INDICE.md). Estado maestro de las entregas E1-E26: `BACKLOG_STATUS.md` §0.
**Plan de desarrollo** (paquetes, enfoque técnico, pruebas, calendario y riesgos): [`docs/PLAN_DESARROLLO_DEFINITIVO.md`](docs/PLAN_DESARROLLO_DEFINITIVO.md). **Porqué de cada propuesta:** `docs/PROPUESTA_QUINTA_AUDITORIA_2026-10-02.md` (IDs `ND`, `NPV`, `NIN`, `NDB`, `NXP`, `NHG`, `NTC`) y `docs/PROPUESTA_SEXTA_AUDITORIA_2026-10-03.md` (IDs `CAP`, `PRV`, `CAR`, `DAC`, `DNU`, `FIS`, `UXS`, `HOG`, `GOV`).
**El repositorio es público: ninguna cifra real del hogar aquí.** Los importes van en el chat o en artefactos privados.

Autocontenido a propósito: quien lo abra sin haber visto la conversación debe poder decidir qué hacer primero en 10 minutos.

---

## 0. Estado en una línea

**Desarrollo iniciado el 3/10/2026 (sesión 299): el hogar dijo «empecemos». **Ola 1 construida el 4/10 salvo WP-23** (programado para la semana del 12/10); además, de la Ola 2, WP-08 y WP-26. Hecho: WP-01 (sello de versión y «Novedades») WP-02 (prueba cronometrada de Hoy; falta la línea base: 3 intentos del hogar con saldos del día) WP-03 (panel de uso, local; «% del gasto registrado en < 48 h» queda **sin medir** hasta que la captura guarde la fecha de registro, WP-25/WP-30) y WP-04 (lectura en Ajustes de si el día de cargo se puede aprender; WP-08 sugerirá solo en las partidas «fiables», `docs/ND03_VIABILIDAD.md`). **WP-05 entregado en documentos** (`docs/ND13_SPIKE_CONEXION.md` y `docs/NTC06_AMENAZAS.md`, con la prueba `ntc6-conexiones-externas`, que bloquea cualquier servidor nuevo sin revisar). GoCardless no admite altas desde julio de 2025. Enable Banking, en modo restringido gratuito, lista CaixaBank y Banco Mediolanum. **Decisión de `O-6` el 16/10**, con la verificación práctica del hogar (≈ 20 min) y la frescura del panel de uso. Si no hay verificación, `O-6` se cierra. Corregido de paso: el motor de tickets se cargaba sin huella SRI. **WP-07 hecho (4/10):** el motor de fechas vive en `canonical-timing.js`, sin cambio de comportamiento: 60.276 casos con 0 diferencias, oro de 493 casos en las pruebas y previsión idéntica en el navegador. `app.js` baja 100 líneas (37.340 de 37.495). Es la costura de WP-08. **WP-09 hecho (4/10):** el cierre guarda el saldo de cada cuenta con su fecha (almacén `month-close-balances`, que va en la copia y en la nube; el RPC firmado no se toca). Del 1 al 3 se cierra el mes que acaba, y ese mes **sigue abierto para anotar sus reales** hasta que se firma. El cuadre con el cierre anterior avisa, no bloquea. El primer cierre real será el de octubre, del 1 al 3 de noviembre. **WP-10 hecho (4/10):** medidor de calidad de la previsión en Plan › Previsión, plegado. Tiene tres barras ponderadas por importe: fechas del gasto con día conocido (objetivo ≥ 70 %), gasto del mes con real e ingresos del mes confirmados. Cada una dice cómo subirla. Con la demo marca un **0 % de días conocidos**: es el «100 % estimado» que verá bajar WP-08.** **WP-08 hecho (4/10, adelantado de la Ola 2):** día de cargo por partida en Plan › Partidas (día 1-31, fin de mes o automático), de mayor a menor gasto, con la propuesta que ya se ve en los extractos. Precedencia: movimiento real del mes > día indicado > regla > estimado (día 8). Sin días indicados, la previsión es idéntica a la anterior. Con la demo, indicar dos partidas sube el medidor de 0 % a 66 %. **Falta la sesión del hogar (≈ 10-30 min)** para llegar al objetivo ≥ 70 %. **WP-11 hecho (4/10):** los importes de Registrar (saldos, reales y dato manual) son texto con teclado decimal. Se escriben y pegan como en España («1.234,56 €»; «1.234» son mil doscientos treinta y cuatro, antes 1,23 €), llevan botón ± para el signo, y un texto que no es importe avisa y no se guarda. Vacío sigue siendo «sin real» y 0 sigue siendo cero. De paso, Registrar se puede usar en el móvil: saldos y reales apilados (antes el campo medía ~55 px y los reales pedían desplazarse en horizontal) y el pie de impacto pasa de 454 a 102 px. **WP-25 hecho (4/10):** `#registrar?importe=&concepto=&fecha=&cuenta=&origen=` (alias del Atajo: `comercio`, `tarjeta`) abre «Registrar gasto» relleno y **nunca guarda solo**. Rechaza HTML, cita lo que no entiende, elige el mes por la fecha si está abierto y borra el enlace de la barra de direcciones. Guía del Atajo de Apple Pay en el manual. **Hallazgo que condiciona CAP-01:** la ventana crea una partida nueva, así que un pago ya previsto (súper, gasolina) contaría dos veces. Anotar «a cuenta de una partida» no existe en el modelo y lo tiene que decidir **WP-30** antes de usar el Atajo a diario. El Atajo abre Safari, no la app de la pantalla de inicio (datos aparte: hay que iniciar sesión también allí). `app.js` queda en 37.494 de 37.495. **WP-24 hecho (4/10):** asignación personal en Plan › Partidas, una ficha por persona (importe, primer y último mes). Decisiones del hogar: transferencia a una cuenta propia que no se importa, **sale del gasto variable** (el total previsto no cambia) y para los dos. Una partida por persona con id estable en Gastos variables (vale para el día de cargo, la regla del extracto y los reales). El descuento va sobre el valor final del «Gasto variable estimado», porque la migración de junio lo fija a mano en toda la previsión. La tarjeta de WP-08 pasa con ella a `partidas-ui.js`: `app.js` baja a 37.466. **Falta el alta del hogar** antes del 1/11; revisión a finales de enero. **WP-26 · ND-01 hecho (4/10):** «Pulso de saldos» en Registrar: lo último que se sabe de cada cuenta (declarado o saldo final del extracto, el más reciente) con «Coincide» / «Corregir»; con las dos respondidas, fecha de hoy y deshacer 8 s; la previsión solo avisa si esperaba movimientos. El panel de uso mide los segundos (objetivo ≤ 20 s) y el % de «Coincide». **Falta la línea base del método anterior** (WP-02). **ND-02 hecho (4/10):** el paso 4 de la importación ofrece (marcado) usar el saldo final del extracto como saldo de su cuenta, comprueba la continuidad del fichero y lo aplica dentro del lote (deshacer lo devuelve); la cuenta elegida al importar llega por fin al libro (antes todo era CaixaBank en C-2, M-8c y la continuidad). **WP-26 hecho.** **WP-12 hecho (5/10, adelantado de la Ola 2 por el reloj de datos):** backtest de liquidez a fin de mes en Plan › Previsión (tarjeta plegada «Acierto de la caja a fin de mes»). Los días 1-3 y 15-17 congela la liquidez prevista (CaixaBank + Mediolanum) día a día hasta fin de mes y 10 días más; la foto es **de solo añadir** (la primera de cada ventana gana). Al firmar el cierre la compara con los saldos reales **en la fecha de esos saldos**. Error = previsto − real (positivo: optimista). **Con menos de 3 cierres comparables, «datos insuficientes»: ninguna cifra**; la tendencia, con 6. **Solo cuentan los saldos del banco:** con «Auto por fecha» la foto se guarda pero no cuenta (hay que declarar «Real manual»). Solo mide: la banda P10-P90 es de WP-16. **Falta del hogar:** saldos en «Real manual» y abrir la app del 15 al 17/10; con foto de octubre, el tercer cierre comparable llega en enero de 2027 (febrero si la primera foto es la del 1/11). **WP-23 (campaña fiscal) aparcado el 3/10 por decisión del hogar: no tiene los datos fiscales a mano.** Riesgo: para tener la lista antes del 15/11 hay que retomarlo como tarde el **1/11** (≈ 4 sesiones); el motor puede construirse sin datos, solo los euros los necesitan. Decisiones de esa sesión: (a) **un solo móvil** → `NTC-03` (contador multi-dispositivo) se reduce al contador local, sin sincronización; (b) **WP-23 (campaña fiscal) se adelanta** a la siguiente sesión y los datos fiscales se piden ya, sin esperar al 20/10; (c) en WP-02 el interruptor A/B del titular se construye pero **no alterna** hasta tener la línea base con el texto A (con n = 1 es preferencia, no resultado medido). Las 104 propuestas de la quinta y la sexta auditoría están todas aquí, priorizadas en cinco niveles (§5): **68 entran en el plan** (P0-P2, en **3 olas de octubre de 2026 a enero de 2027**, ≈ 138 sesiones), **27 quedan en catálogo con disparador** (P3), **5 bloqueadas** por un tercero o un evento (P4) y **4 se archivan**. **Respuestas del hogar del 3/10 (sesión 297):** tributación **individual**; **sin plan de pensiones de empresa**; **hipoteca variable** (entra la revisión de tipo, `NDB-02`); **nadie más usará la app** (lo que solo servía a una segunda persona se archiva); **sin límite de entregas visibles** (el plan se comprime de 13 tramos a 3 olas). El primer paquete con fecha es la **campaña fiscal de fin de año con el tope de la deducción por vivienda** (lista antes del 15/11/2026). Orden tras la sesión 299 (4/10): la Ola 1 queda construida salvo **WP-23, que el hogar programa para la semana del 12/10** (límite: 1/11) y WP-06, que son tareas con fecha (16/10 y 23/10). La Ola 2 empezó por **WP-26** (saldos por excepción, **hecho el 4/10**), adelantado a WP-15 por decisión del hogar del 4/10. **Orden del hogar del 5/10: WP-12 (hecho), WP-30 y WP-15**; después, por el orden de la Ola 2, WP-27, WP-14, WP-13, WP-20 y WP-28. **WP-30: decisión del hogar del 5/10 sobre el pago «a cuenta de una partida» (lo dejó al descubierto WP-25): se acumula dentro de la partida**, sin crear una partida por ticket (§4). **Diseño cerrado el 5/10 (`docs/WP30_DISENO.md`):** compras con tarjeta de crédito, cada una con su concepto, acumuladas en la fila de liquidación de la tarjeta del mes de cargo (cada tarjeta con su ciclo de corte y cargo, que el hogar introduce en la app); el cargo del extracto manda al llegar. **PR-0 hecho** (`app.js` en 37.396 de 37.495) y **PR-1 hecho** (Plan › Partidas › «Tarjetas de crédito»: ciclo de corte y cargo por tarjeta; compras acumuladas con `max(previsto, acumulado)` hasta que llega el cargo; sin compras, previsión idéntica; `app.js` 37.409); **PR-2 hecho (5/10): la hoja de captura** (importe primero, concepto con sugerencias, tarjeta, hoy/ayer/otra fecha, «Hecho» del teclado guarda, deshacer 8 s), la abre «+ Registrar gasto» y el enlace de WP-25 cuando hay tarjetas (sin ellas, la ventana de siempre). **Cambio respecto al diseño:** las compras viven en su **propio almacén** (`card-purchases`), no entre los movimientos del banco: un lote reversible guarda una foto entera del estado por cada captura y el libro contaría la compra y su liquidación a la vez. Mide los segundos hasta guardar (y los de la ventana anterior, para comparar) y el «% anotado el mismo día o el siguiente»; informe de compras por concepto y ciclo. `app.js` 37.418 de 37.495. **WP-30 hecho.** **Falta del hogar:** dar de alta sus tarjetas en esa ficha y usar la hoja unos días (la mediana de ≤ 8 s sale de su uso real). ≈ 4-5 sesiones. **WP-15 (siguiente): diseño cerrado el 6/10 (`docs/WP15_DISENO.md`).** Hoja manual de valoración de la cartera con almacén propio de valoraciones con fecha (las instantáneas de cierre actuales repiten el valor del alta: no son serie), «Sin cambios» por fila, variación de mercado que descuenta aportaciones y ventas, más antiguas primero, deshacer 8 s y aviso no bloqueante en el cierre. «Pegar desde el bróker» aparcado hasta tener una muestra del formato; `I3` no se acelera (6 puntos no son correlación). ≈ 2-3 sesiones.

## 1. Cómo empezar la próxima sesión (10 minutos)

1. Leer este documento (§0, §2, §4 y §5) y la última entrada de `PROJECT_STATE.md`.
2. `git status`, `git log --oneline -5`; la rama de trabajo parte de `origin/main` (receta en §10).
3. **El desarrollo está en marcha desde el 3/10/2026** (el hogar dijo «empecemos»). Siguiente paquete: el primero de la Ola 1 sin hacer según §0, con el detalle de `docs/PLAN_DESARROLLO_DEFINITIVO.md`. Cada paquete visible añade su línea a `novedades.js`.
4. Antes de cerrar: validar, actualizar `PROJECT_STATE.md` con cifras reales, **este documento** y **el panel de seguimiento** (§12), commit/push, PR en borrador, esperar CI, fusionar en verde.

---

## 2. Cambio de premisa: la app tiene **un solo usuario**, y no habrá otro

Datos del hogar del 3/10/2026: «la persona que responde es la misma porque de momento es solo un usuario» y, después, «nadie más» se va a incorporar. La Ola 2 y la quinta auditoría estaban construidas sobre **dos personas** (quien opera y quien consulta). Consecuencias, ya aplicadas a la priorización:

| Lo que dependía de dos personas | Qué pasa ahora |
|---|---|
| **Métrica de la regla de parada v2** («mediana de **quien consulta** ≤ 15 s con la misma cifra») | Se redefine: **mediana del usuario ≤ 15 s, con la misma cifra que la app, con saldos actualizados ese día y abriendo desde el icono** (WP-02). Se añade una métrica de adopción: **≥ 4 días activos por semana** (WP-03) |
| La medición de 30/28/20 s «sin encontrar la cifra» | Si la hizo la misma persona que usa la app a diario, el resultado es **más grave**, no menos. Se repite con saldos del día (S8) antes de tocar Hoy |
| Modo consulta (`NXP-07`), D4/D5 (H3), captura desde el segundo móvil (`CAP-08`), reunión mensual (`NHG-02`), recorrido de bienvenida (`NAV-3`) | **Archivados** (§5.6): solo servían a una segunda persona usuaria. Se reactivan si eso cambia |
| Contador de uso de «los dos móviles» (`NTC-03`) | Se reduce a **multi-dispositivo** (móvil y ordenador del mismo usuario) dentro de WP-03 |
| Cuentas en pareja (`NHG-01`), acuerdos vigilados (`HOG-01`) | Siguen teniendo sentido para el dinero del hogar, pero sin segunda persona usuaria su valor baja: **P3** |
| Asignación personal (`HOG-02`) | **Sigue en P0**: es una regla del dinero del hogar, no de usuarios; además reduce la captura |
| Modo relevo (`HOG-03`) | Sin otra persona usuaria solo cubre una ausencia del propio usuario (la app queda en pausa y se pone al día al volver); lo grave (fallecimiento o incapacidad) ya lo cubre `LPX3`: **P3** |

**Si algún día se incorpora otra persona:** se reactivan los archivados de este grupo y `NAV-3`.

---

## 3. Cómo se ha priorizado

**Orden de criterios** (decidido en el triaje, R5): **1) fecha límite externa → 2) euros que ahorra o protege → 3) dependencias (lo que desbloquea otras) → 4) minutos por semana que quita al usuario → 5) evidencia** ([M] medido > [C] código > [H] hipótesis).

**Niveles:**
| Nivel | Significado | Cuántas |
|---|---|---|
| **P0** | Con fecha o habilitadora inmediata: **Ola 1** (5/10 - 23/10/2026) | 17 |
| **P1** | Siguiente: **Ola 2** (26/10 - 20/11/2026) y primeras de la Ola 3 | 25 |
| **P2** | Planificada: **Ola 3** (23/11/2026 - 22/1/2027); algunas solo dan resultado cuando hay datos (febrero-mayo 2027) | 26 |
| **P3** | Catálogo con disparador: se activa cuando se cumple su condición (uso real, petición, dato) | 27 |
| **P4** | Bloqueada por un tercero o un evento (préstamo, coche, viaje) | 5 |
| **Archivo** | Descartada (reactivable si cambia su condición) | 4 |
| | **Total** | **104** |

Las respuestas «Más tarde» del triaje (3/10/2026) van a P3 salvo que el plan necesite una parte mínima (se indica). Las respuestas «Sí» están en P0-P2 salvo las que dependen de un evento (P4) o solo servían a una segunda persona usuaria (archivo).

---

## 4. Reglas vigentes

**Ritmo de entregas (decisión del hogar del 3/10/2026: «quitar el límite»):** desaparece el máximo de entregas visibles por tramo. El plan se ordena en **3 olas** por dependencias y fechas, no por cupo: **Ola 1** (5/10 - 23/10/2026), **Ola 2** (26/10 - 20/11/2026) y **Ola 3** (23/11/2026 - 22/1/2027). Algunos paquetes se construyen en la Ola 3 pero solo dan resultado cuando hay datos (cierres de mes y valoraciones): de febrero a mayo de 2027.
**Lo que se mantiene, por recomendación de Claude:** (1) **la regla de parada** —al cerrar cada ola se mira el panel de uso (WP-03) y la métrica de Hoy; si una ola entera no mueve ninguna, se para y se revisa con el hogar antes de seguir—; (2) **«Novedades»**: cada cambio visible se anuncia en la app con una línea (dentro de WP-01), porque con cambios frecuentes un solo usuario necesita saber qué ha cambiado; (3) **uno entra, uno sale** (GOV-02) para que la app no siga creciendo en pantallas.
**Lo que se pierde:** la protección contra cambiar demasiadas cosas a la vez, que es lo que la regla v2 evitaba. Si el panel de uso muestra que el uso baja tras una ola cargada, Claude lo dirá y propondrá frenar.

**Reglas de gobierno adoptadas** (sexta auditoría, §6):
- **GOV-01 · Presupuesto de ≤ 10 min/semana** para mantener la app (S1, Sí). Cada paquete declara su Δ. Medición mínima: autodeclaración semanal dentro del panel de uso (R3 por defecto).
- **GOV-04 · Decisiones a ciegas** en los formularios de decisión (S7, Sí).
- **GOV-05 · Medir Hoy solo con saldos del día** (S8, Sí).
- **GOV-02 · Uno entra, uno sale** y **GOV-03 · puntuación por euros**: adoptadas por defecto como reglas de trabajo de Claude (no se votaron; veto posible).
- **GOV-06 · Prueba con 5 personas ajenas** con datos de demostración, trimestral: con un solo usuario, es la única forma de separar problemas de diseño de hábitos propios (WP-54).

**Frenos de `CLAUDE.md` (sin cambios):** nunca fusionar en rojo ni forzar; nunca push directo a `main`; nunca `finanzas-casa-def`; consultar antes de ir más allá de lo pedido, borrar datos del usuario o retirar una pantalla en uso; nunca cambiar umbrales de CI ni relajar una prueba para dar verde.

---

## 5. Backlog priorizado (las 104 propuestas)

Columnas: **#** orden dentro del nivel · **ID** · **Qué** · **Origen** (5ª/6ª auditoría) · **Valor** · **Esf.** (S ≤ 1 sesión, M 2-3, L 4+) · **Puerta** (E exenta, V visible, T tercero, X fuera de la app, H toca Hoy) · **Δ min/sem** del usuario · **WP** paquete del plan · **Tramo**.

### 5.1 P0 — con fecha o habilitadora inmediata (Ola 1, 5/10 - 23/10/2026; la campaña fiscal se cierra antes del 15/11)

| # | ID | Qué | Origen | Valor | Esf. | Puerta | Δ | WP | Ola |
|---|---|---|---|---|---|---|---|---|---|
| 1 | **FIS-01** | Campaña fiscal de fin de año: acciones ordenadas por euros y fecha límite — **aparcado 3/10 (sin datos fiscales); retomar como tarde el 1/11** | 6ª | Alto · **31/12** | M | V | +10/año | WP-23 | Ola 1 |
| 2 | **DAC-02** | Tope de la deducción por vivienda (régimen transitorio, **confirmado que aplica**, S4) | 6ª | **Alto** · 31/12 | S | E | 0 | WP-23 | Ola 1 |
| 3 | FIS-02 | Ajustar la retención voluntaria para no pagar en junio | 6ª | Medio | S | V | 0 | WP-23 | Ola 1 |
| 4 | HOG-02 | Asignación personal sin detalle, prueba de 3 meses desde el 1/11 | 6ª | Medio-Alto | S | V (configuración) | −10 | WP-24 | **Hecho 4/10** (falta el alta del hogar; revisión a finales de enero) |
| 5 | NXP-02 | Sello de versión y aviso de «versión nueva» — **✅ hecho 3/10/2026 (WP-01, sesión 299)** | 5ª | Alto | S | E | 0 | WP-01 | Ola 1 |
| 6 | NXP-01 | Prueba cronometrada dentro de la app (un usuario, saldos del día) — **✅ construida 3/10/2026 (WP-02, sesión 299); línea base pendiente del hogar** | 5ª | Crítico | S-M | E | 0 | WP-02 | Ola 1 |
| 7 | PRV-06 | «X € al día hasta cobrar», **como variante B de la medición** (no como entrega; no alterna hasta tener la línea base con A, 3/10) — **construido en WP-02, elegible en Ajustes** | 6ª | Alto | S | H → medición | 0 | WP-02 | Ola 1 |
| 8 | UXS-05 | Dos textos para la cifra de Hoy, dentro de la medición — **construido en WP-02** | 6ª | Medio (n = 1) | S | H → medición | 0 | WP-02 | Ola 1 |
| 9 | UXS-04 | Panel de uso real (+ minutos autodeclarados, R3) — **✅ hecho 3/10/2026 (WP-03, sesión 299); «gasto en < 48 h» y «decisiones» sin medir aún** | 6ª | Alto | S | E | 0 | WP-03 | Ola 1 |
| 10 | NTC-03 | Contador de uso **multi-dispositivo** (reducido: un usuario; **y un solo móvil, 3/10: sin sincronización**) — **✅ hecho como contador local (WP-03)** | 5ª | Medio | S | E | 0 | WP-03 | Ola 1 |
| 11 | ND-13 | Spike PSD2 de 2 semanas, comparado con Apple Pay y avisos del banco | 5ª | Alto | S | T (documental) | — | WP-05 | Ola 1 |
| 12 | NTC-06 | Revisión de seguridad previa a cualquier conexión externa | 5ª | Alto | S | E | 0 | WP-05 | Ola 1 |
| 13 | NTC-01 | Extraer el motor de fechas a `canonical-timing.js` | 5ª | Alto (habilita) | M | E | 0 | WP-07 | Ola 1 |
| 14 | NPV-03 | Cierre de mes con saldo y firma; cerrar el mes anterior (C2) | 5ª | Crítico | M | E | +2/mes | WP-09 | Ola 1 |
| 15 | NPV-08 | Medidor de calidad de datos de la previsión | 5ª | Alto | S | V | 0 | WP-10 | Ola 1 |
| 16 | NXP-05 | Campo de importe unificado (es-ES) | 5ª | Alto | S-M | E | −1 | WP-11 | **Fase 1 (Registrar) hecha 4/10** |
| 17 | CAP-02 | Enlaces de registro prellenado (+ plantilla del Atajo de Apple Pay, R1) | 6ª | Alto | S | E | −5 | WP-25 | **Hecho 4/10** (el Atajo a diario espera a WP-30: cuenta doble) |

*ND-03 paso 0 (script de viabilidad del día de cargo, WP-04) y el gobierno de octubre (WP-06: Nielsen 16/10, 23/10 sin retirar nada, plazo 30/11 de `A5-1`/`A5-4`) también son de la Ola 1; no son propuestas, son tareas.*

### 5.2 P1 — siguiente (Ola 2, 26/10 - 20/11/2026, y primeras de la Ola 3)

| # | ID | Qué | Origen | Valor | Esf. | Puerta | Δ | WP | Ola |
|---|---|---|---|---|---|---|---|---|---|
| 1 | NIN-02 | Hoja de valoración rápida con snapshots (hoy no se puede actualizar el valor de una posición) | 5ª | **Crítico** | M | V | +3/mes | WP-15 | Ola 2 |
| 2 | ND-01 | Actualizar saldos por excepción («Coincide» / «Corregir») | 5ª | Crítico | M | V | −10 | WP-26 | **Hecho 4/10** («Pulso de saldos»; el esperado es el último dato real, la previsión solo avisa) |
| 3 | ND-02 | Un extracto actualiza saldo y movimientos a la vez | 5ª | Alto | S-M | V | −3 | WP-26 | **Hecho 4/10** (oferta marcada en el paso 4, continuidad por fichero, dentro del lote; la cuenta del extracto llega al libro) |
| 4 | ND-03 | Día de cargo por partida (declarado; sugerido si WP-04 lo justifica) | 5ª | Crítico | M | E | +30 una vez | WP-08 | **Hecho 4/10** |
| 5 | CAP-06 | Cargos esperados que no llegaron | 6ª | Alto | S-M | E | 0 | WP-27 | Ola 2 |
| 6 | ND-08 | Cobros esperados: confirmar o informar de un retraso | 5ª | Alto | S-M | E | 0 | WP-14 | Ola 2 |
| 7 | ND-11 | Euribor, €STR e IPC oficiales con caducidad | 5ª | Alto | S-M | E | −2 | WP-13 | Ola 2 |
| 7b | **NDB-02** | Revisión del tipo variable con el Euribor oficial: cuota estimada en la próxima revisión, avisos a 60 y 30 días (**hipoteca variable, confirmado**) | 5ª | Alto | S-M | V | 0 | WP-20 | Ola 2 |
| 8 | NPV-07 | Kit de gráficos táctil y accesible | 5ª | Alto (habilita) | M-L | E | 0 | WP-28 | Ola 2 |
| 9 | NHG-05 | Carta del mes determinista (lo único que se pidió explícitamente en la Ola 2) | 5ª | Medio-Alto | M | V | 0 | WP-29 | Ola 3 |
| 10 | ND-14 | Hoja de captura de un gasto en ≤ 8 s | 5ª | Alto | M | V | −10 | WP-30 | Ola 2 |
| 11 | NPV-02 | Backtest de liquidez a fin de mes (dice «datos insuficientes» hasta 3 cierres) | 5ª | Alto | M | E | 0 | WP-12 | Ola 2 |
| 12 | CAP-05 | Lector de la nómina en PDF | 6ª | Alto | M | E | −5/mes | WP-31 | Ola 2 |
| 13 | NPV-11 | Retenciones acumuladas automáticas para el estimador de Renta | 5ª | Medio-Alto | S-M | E | −1 | WP-31 | Ola 2 |
| 14 | CAP-09 | Recordatorios en el momento de máximo valor (absorbe ND-10) | 6ª | Alto | S | X | −3 | WP-32 | Ola 2 |
| 15 | ND-10 | Recordatorios suscribibles (absorbido por CAP-09) | 5ª | — | — | X | — | WP-32 | Ola 2 |
| 16 | NTC-02 | Historiales sintéticos con verdad conocida (calibrar ND-03 y NPV-01) | 5ª | Alto (habilita) | M | E | 0 | WP-33 | Ola 2 |
| 17 | PRV-08 | Revisión base cero del plan (enero) | 6ª | Medio | S-M | V | +15/año | WP-34 | Ola 3 (enero) |
| 18 | PRV-02 | Previsión en tres capas: comprometido, probable y discrecional | 6ª | Alto | M | V | 0 | WP-35 | Ola 3 |
| 19 | PRV-04 | Ingresos inciertos con probabilidad (paga extra, variable, Renta, local) | 6ª | Alto | M | V | 0 | WP-35 | Ola 3 |
| 20 | ND-07 | Detector de anomalías en el extracto (a la bandeja) | 5ª | Alto | M | E | 0 | WP-36 | Ola 3 |
| 21 | NXP-04 | Estados completos y «deshacer» en lugar de confirmar | 5ª | Alto | M | E | 0 | WP-37 | Ola 3 |
| 22 | NTC-04 | WebKit en la medición de carga | 5ª | Medio | S-M | E | 0 | WP-52 | Ola 3 |
| 23 | PRV-05 | Plan B acordado en frío, con disparador | 6ª | Alto | M | V | 0 | WP-38 | Ola 3 |
| 24 | NPV-09 | Palanca de recorte («¿cuánto aguanta el colchón?»), dentro del plan B | 5ª | Medio | M | V | 0 | WP-38 | Ola 3 |

*Dentro de la Ola 3, primero lo de P1 y después lo de P2, en el orden de las tablas.*

### 5.3 P2 — planificada (Ola 3, 23/11/2026 - 22/1/2027)

| # | ID | Qué | Origen | Valor | Esf. | Puerta | Δ | WP | Ola |
|---|---|---|---|---|---|---|---|---|---|
| 1 | CAR-01 | Política de inversión del hogar (una página, firmada) | 6ª | Alto | M | V | 0 | WP-39 | Ola 3 |
| 2 | DAC-01 | Conciliar la deuda con la CIRBE, operación a operación | 6ª | Medio-Alto | S-M | E | +10/año | WP-40 | Ola 3 |
| 3 | DAC-04 | Deuda en la sombra (permanencias, aplazamientos, financiación en factura) | 6ª | Medio | M | E | 0 | WP-41 | Ola 3 |
| 4 | DNU-03 | TAE real del «0 %» y de los aplazamientos de tarjeta | 6ª | Medio | S | E | 0 | WP-41 | Ola 3 |
| 5 | CAP-10 | Sin duplicados entre canales de captura | 6ª | Crítico con ≥ 2 canales | M | E | −2 | WP-53 | Ola 3 |
| 6 | NIN-10 | Informe fiscal anual de inversión para la Renta (antes del 31/3) | 5ª | Alto en temporada | M | V | 0 | WP-21 | Ola 3 |
| 7 | FIS-03 | Impuestos del local alquilado y actualización de la renta | 6ª | Medio-Alto | M | V | +5/año | WP-21 | Ola 3 |
| 8 | NIN-01 | Cartera como tablero con «siguiente mejor acción» (reglas de CAR-01) | 5ª | Alto | M-L | V | 0 | WP-17 | Ola 3 |
| 9 | ND-04 | Perfiles de extracto con autodetección | 5ª | Alto | M | E | −2 | WP-51 | Ola 3 |
| 10 | NDB-01 | Camino a deuda cero: una narrativa, un control | 5ª | Alto | M-L | V | 0 | WP-19 | Ola 3 |
| 11 | CAR-03 | Dónde va el próximo euro (escalera) | 6ª | Alto | M | V | 0 | WP-42 | Ola 3 |
| 12 | NIN-05 | Rebalanceo por aportaciones (sin vender), dentro de la escalera | 5ª | Alto | M | V | 0 | WP-42 | Ola 3 |
| 13 | NIN-08 | Dónde poner la liquidez ociosa, peldaño de la escalera | 5ª | Medio-Alto | M | V | 0 | WP-42 | Ola 3 |
| 14 | NPV-01 | Banda de caja diaria con ventanas de fecha | 5ª | Alto | L | V | 0 | WP-16 | Ola 3 |
| 15 | PRV-01 | Puente de previsión: por qué cambió el fin de año | 6ª | Alto | M | V | 0 | WP-43 | Ola 3 |
| 16 | NIN-03 | Aportado frente a valor y rentabilidad ponderada por tiempo | 5ª | Alto | M | V | 0 | WP-18 | Ola 3 |
| 17 | CAR-02 | Panel de calma en caídas | 6ª | Medio-Alto | S-M | V | 0 | WP-44 | Ola 3 |
| 18 | CAR-05 | Qué parte de los gastos pagan ya los activos | 6ª | Medio | S | V | 0 | WP-44 | Ola 3 |
| 19 | CAR-06 | Exposición por entidad y garantía | 6ª | Medio | S | V | 0 | WP-44 | Ola 3 |
| 20 | ND-09 | Frescura por fuente en el centro de datos | 5ª | Alto | S | V | 0 | WP-45 | Ola 3 |
| 21 | CAP-07 | Tareas de datos ordenadas por lo que mueven la cifra | 6ª | Alto | M | V | −5 | WP-45 | Ola 3 |
| 22 | NPV-10 | Patrimonio neto: serie histórica y proyección con hitos | 5ª | Alto | L | V | 0 | WP-46 | Ola 3 |
| 23 | NPV-05 | Reparto de la nómina en un paso (sobre la escalera) | 5ª | Alto | M | V | −5 | WP-47 | Ola 3 |
| 24 | NIN-06 | Operaciones de cartera editables e importador del bróker | 5ª | Alto | L | V | −3 | WP-48 | Ola 3 |
| 25 | NPV-04 | Mapa anual de pagos grandes con su sobre | 5ª | Medio-Alto | M | V | 0 | WP-49 | Ola 3 |
| 26 | CAR-04 | Vivienda y local revalorizados por índice oficial | 6ª | Medio | S-M | V/T | −2/trim. | WP-50 | Ola 3 |

### 5.4 P3 — catálogo con disparador (27)

| ID | Qué | Origen | Triaje | Se activa cuando |
|---|---|---|---|---|
| CAP-01 (nivel 2) | Pagos de Apple Pay a la bandeja sin abrir la app (servidor) | 6ª | Más tarde | La plantilla de WP-25 se usa ≥ 3 semanas seguidas y pasa NTC-06 |
| CAP-03 | Avisos del banco por SMS o correo | 6ª | Más tarde | El spike WP-05 lo recomienda frente a PSD2 |
| CAP-04 | Saldo desde una captura de pantalla | 6ª | Más tarde | Tras WP-26, actualizar saldos sigue costando > 20 s |
| PRV-03 | Inflación propia del hogar | 6ª | Más tarde | ≥ 13 meses de reales por partida |
| PRV-07 | Hasta dónde acierta la previsión | 6ª | Sí | ≥ 6 cierres con previsión congelada (WP-12) |
| DAC-03 | ¿Compensan las vinculaciones? | 6ª | Más tarde | Renovación de un seguro vinculado o revisión del préstamo |
| DAC-05 | ¿Cobra el banco la cuota pactada? | 6ª | Más tarde | Una cuota distinta de la esperada (recomendación de Claude: **subirla en cuanto haya extractos mensuales regulares**; protege dinero cada mes) |
| UXS-01 | Siri dice la cifra sin abrir la app | 6ª | Más tarde (S6 Sí en principio) | Revisión de privacidad del enlace hecha |
| UXS-02 | Resumen semanal por correo | 6ª | Más tarde | Decisión del 30/11 sobre `A5-4` (push): si se archiva, esta es la alternativa |
| UXS-03 | Medición automática de cuánto tarda cada tarea | 6ª | Más tarde | La autodeclaración de WP-03 no basta para controlar GOV-01 |
| UXS-06 | Respuestas sin IA en el buscador | 6ª | Sí | El panel de uso muestra búsquedas frecuentes sin resultado |
| HOG-01 | Acuerdos del hogar vigilados | 6ª | Sí | El hogar escribe acuerdos de gasto que quiere vigilar |
| HOG-03 | Modo relevo (pausa y puesta al día tras una ausencia) | 6ª | Sí | El usuario lo pide antes de una ausencia larga |
| ND-05 | Bandeja por gesto desde el móvil (Atajo + función privada) | 5ª | — | Igual que CAP-01 nivel 2 (se fusionan) |
| ND-06 | Gestor de reglas de clasificación | 5ª | — | Una partida mal clasificada se repite ≥ 2 meses |
| NPV-06 | «¿Y si…?» desde Previsión | 5ª | — | El panel de uso muestra visitas al Laboratorio desde Previsión |
| NPV-12 | Control global de prudencia de la previsión | 5ª | — | Si ND-03 no reduce el error de caja en 3 meses |
| NIN-04 | Cumplimiento del plan de aportación | 5ª | — | Tras NIN-02, aportaciones registradas ≥ 3 meses |
| NIN-07 | Patrimonio neto de impuestos latentes | 5ª | — | Tras NPV-10 |
| NIN-09 | Prueba de estrés en una pulsación | 5ª | — | Tras CAR-01 (la política define los escenarios) |
| NDB-03 | «¿Me puedo permitir X?» con tres vías de pago | 5ª | — | Tras NDB-01 y con la métrica de Hoy cumplida |
| NDB-04 | Cambiar de banco o subrogar: coste y punto de equilibrio | 5ª | — | Oferta de otro banco o LTV favorable (CAR-04) |
| NXP-03 | Procedencia bajo demanda (P12) | 5ª | — | Medición de WP-02: si la cabecera molesta (en un Pro Max no es la causa) |
| NXP-06 | Modo discreto (y passkey, más tarde) | 5ª | — | Petición del usuario |
| NHG-01 | Cuentas claras en pareja (titular explícito, liquidación mensual) | 5ª | — | La asignación personal (HOG-02) se mantiene tras la prueba de 3 meses |
| NHG-04 | Objetivos visuales | 5ª | — | Tras la carta del mes (WP-29): si se piden objetivos en ella |
| NTC-05 | Fecha de retirada del doble motor de deuda | 5ª | — | Tras NDB-01 con paridad en verde 3 versiones |

### 5.5 P4 — bloqueadas por un tercero o un evento (5)

| ID | Qué | Bloqueo | Se desbloquea |
|---|---|---|---|
| ND-12 | Precios de mercado por ISIN | Decisión del hogar (Q6: manual primero) | Petición explícita |
| NDB-05 | Evaluador de una oferta de deuda nueva | Evento | Llega una oferta real |
| DNU-01 | Cuánto os prestaría un banco | Evento | Se plantea un préstamo o hipoteca |
| DNU-02 | Coche: contado, préstamo, cuota final o renting | Evento | Se plantea cambiar de coche |
| HOG-04 | Modo viaje | Evento | Un viaje largo previsto |

### 5.6 Archivo (4)

| ID | Qué | Por qué | Se reactiva si |
|---|---|---|---|
| NXP-07 | Modo consulta nivel 1 (D4/D5) | Solo servía a una segunda persona usuaria; «nadie más» (3/10/2026) | Se incorpora otra persona |
| NHG-02 | Reunión mensual del hogar | Ídem | Ídem |
| CAP-08 | Captura desde el móvil de quien consulta | Ídem | Ídem |
| NHG-03 | Lista de deseos con enfriamiento | La de menos evidencia de la quinta auditoría; sin petición | Petición explícita |

---

## 6. Pendientes que no son propuestas

| ID | Qué | Disposición |
|---|---|---|
| H1 | Diagnóstico de «no la encontró» | WP-02, con un usuario y saldos del día |
| H2 | Actualizar saldos y repetir la medición | WP-02 (S8) |
| H3 | D4/D5 (modo consulta) | Archivado (nadie más usará la app) |
| H4 | Tiempo de registrar un gasto | WP-02 + autodeclaración de WP-03; mejora con WP-30 |
| H5 / C2 | Cierre con saldo y mes anterior | WP-09 |
| H6 | Retiradas y Cola B | 23/10: no se retira nada; se decide con el panel de uso (WP-03) en la revisión de enero |
| H7 | ¿Hipoteca variable, mixta o fija? | **Resuelta el 3/10: variable** → `NDB-02` en P1 (WP-20, Ola 2) |
| H8 | `A5-1`/`A5-4`: activar o archivar antes del 30/11/2026 | Abierta; si se archivan, `UXS-02` es la alternativa a `P4`/`GOB5` |
| `RGX3`, `DEX6`, `GOB5`, `P4`, `P10`, UI del Copiloto | Condicionadas a `A5-1`/`A5-4` | Se archivan el 30/11 si no se activan (H8) |
| `O-6` | PSD2 | WP-05 (spike con criterio de salida) |
| `OPT-10`–`OPT-13`, entrega 5 de la Ola 1 | Retirar pantallas sin uso | Revisión en enero con 3 meses de panel de uso; mecanismo: redirigir sin borrar código (GOV-02) |
| `NAV-3` | Recorrido de bienvenida | Archivado (nadie más usará la app) |
| `ARQ-4` | Visual Detail sin extraer de `app.js` | Aparcado (sin cambios) |
| `I3` | Mapa de correlación | P3: se activa con ≥ 6 valoraciones de NIN-02 |
| `I6` | Fiscalidad de cripto/derivados | P4: sin posiciones de ese tipo |
| Cola B | 42 mejoras de la cuarta auditoría (artefacto externo) | P3: criterio `PROC-1`, se activa con uso real |
| UX-P4 | Margen de 82 líneas en `app.js` | Se resuelve extrayendo (WP-07 y cada paquete nuevo en su módulo) |
| UX-P2 | Lighthouse con `optimistic` | Decisión del hogar (cambia lo que promete el CI); sin fecha |
| UX-P1, P3, P5, P6, P7, UX-N1…N4 | Rendimiento y estética menores | Sin cambios (P3 de hecho); UX-P3 lo cubre WP-52 |

---

## 7. Calendario con fecha (hitos)

| Fecha | Qué |
|---|---|
| 3/10/2026 | **Arranca la Ola 1** (el hogar dijo «empecemos»); el 4/10 queda construida salvo WP-23 |
| Antes del 16/10 | El hogar: cronometrar una vez cómo actualiza hoy los saldos (línea base de WP-26) y los 3 intentos de la prueba de Hoy (WP-02) |
| Semana del 12/10/2026 | **Campaña fiscal (WP-23)**, con los datos fiscales en el chat (decisión del hogar del 4/10) |
| 16/10/2026 | Revisión mensual de Nielsen (`OPT-21`) · **decisión de `O-6`** (conexión bancaria) |
| 23/10/2026 | Fin de la Ola 1 · `OPT-10`–`OPT-13`: no se retira nada |
| Antes del 1/11 | El hogar: dar de alta las dos fichas de la asignación personal y programar las transferencias con concepto fijo |
| 1/11/2026 | Arranque de la asignación personal (WP-24) |
| 1-3/11/2026 | **Primer cierre de mes con saldo** (octubre, WP-09): saldos del día y firma |
| **14/11/2026** | **Campaña fiscal lista** (WP-23) |
| 20/11/2026 | Fin de la Ola 2 |
| 30/11/2026 | Plazo de `A5-1`/`A5-4` (H8) |
| 1-3/12/2026 | Segundo cierre con saldo (noviembre) → **primera carta del mes** (WP-29, si ya está construida) |
| 31/12/2026 | Fecha límite de las acciones fiscales (plan de pensiones, amortización dentro del tope, minusvalías, donativos) |
| Enero 2027 | Revisión base cero del plan (WP-34) · revisión de la asignación personal · revisión de retiradas con el panel de uso |
| 22/1/2027 | Fin de la Ola 3: todo P0-P2 construido |
| Febrero 2027 | Con 3 cierres con saldo: primer backtest de caja (WP-12) y serie de patrimonio (WP-46) con contenido |
| 31/3/2027 | Informe fiscal de inversión y del local con los datos de 2026 (WP-21) |
| Abril-junio 2027 | Campaña de la Renta (*verificar fechas oficiales*) |
| ≈ Mayo 2027 | Con 6 cierres: se puede activar `PRV-07` (P3) |

---

## 8. Decisiones y datos

**Contestado el 3/10/2026:** D1 hipoteca **variable** · D2 tributación **individual** y **sin plan de pensiones de empresa** · D3 **quitar el límite** de entregas visibles · D4 **nadie más** usará la app · D5 y D6 por defecto (minutos autodeclarados; archivar `NHG-03`).

**Falta, en el chat (nunca en el repositorio):**
| Dato | Para | Si no llega |
|---|---|---|
| Lo pagado por la vivienda en 2026 (cuotas y amortizaciones) y lo previsto hasta diciembre, **por titular** | WP-23 (tope de 9.040 € por declarante: con tributación individual, cada titular que deducía tiene su propio tope sobre lo que paga) | La campaña sale con la acción pero sin euros |
| Titulares de la vivienda y si deducían los dos | WP-23 | Se calcula para un solo declarante |
| Tipo marginal aproximado | WP-23 (valor de la aportación al plan de pensiones: hasta 1.500 € individuales sin plan de empresa) | Se usa la retención declarada como aproximación, rotulado |
| Plusvalías y minusvalías realizadas en 2026 | WP-23 (compensación) | Solo se usan las ventas registradas en la app |
| Hipoteca: índice (¿Euribor a 12 meses?), diferencial, periodicidad de revisión, fecha de la próxima revisión y bonificaciones | WP-20 | Sin próxima revisión no hay aviso; el resto se puede rellenar en Deuda › Contratos |

---

## 9. Métricas

| Métrica | Objetivo | Se mide con |
|---|---|---|
| Tiempo hasta la cifra de Hoy | Mediana ≤ 15 s, misma cifra, saldos del día | WP-02 |
| Adopción | ≥ 4 días activos por semana | WP-03 |
| Coste de mantener la app | ≤ 10 min/semana | WP-03 (autodeclarado) |
| Frescura | Saldos de ≤ 3 días en ≥ 90 % de los días | WP-03 |
| Resolución de la previsión | ≥ 70 % del gasto con fecha declarada u observada | WP-10 |
| Calibración | Error de caja a fin de mes decreciente; cobertura P10-P90 ≈ 80 % tras 6 meses | WP-12 |
| Captura | Un gasto en ≤ 8 s | WP-30 |
| Dinero | Campaña fiscal ejecutada antes del 31/12, con su ahorro estimado anotado | WP-23 |
| Inversión | Valoraciones de la cartera al día cada mes | WP-15 |

**Regla de parada:** si una ola entera no mueve ninguna métrica de sus paquetes, no se empieza la siguiente y se revisa el plan con el hogar.

---

## 10. Recetas y trampas del repositorio (verificadas)

**Flujo (`CLAUDE.md`):** validar (`npm run verify`, ~4-6 min) → `PROJECT_STATE.md` con cifras reales → commit/push a la rama de trabajo → PR **en borrador** → esperar CI → fusionar en verde (squash), sin preguntar.

**Reiniciar la rama tras una fusión por squash:** el `push --force-with-lease` está denegado. Patrón: `git fetch origin main <rama>` → `git checkout -B <rama> origin/<rama>` → `git merge --no-edit origin/main` → (cherry-pick si hay commits locales) → comprobar `git diff --stat origin/main HEAD` → `git push -u origin <rama>`.

**Trampas:**
1. `index.html` no puede contener el literal `app.js` fuera del `<script src>`; el sello `app.js?v=` y `design-tokens.css?v=` está fijado en `index.html` y en ~27 pruebas (subir con una expresión regular sobre `tests/*.cjs`).
2. Toda `view-section` nueva lleva `hidden` salvo `#home`; las hermanas de familia llevan `data-nav-family`.
3. Muchas pruebas leen ventanas fijas de caracteres de funciones de `app.js` o fijan la etiqueta `<section …>` exacta; una dependencia nueva dentro de una función extraída a un `vm` exige su stub.
4. **Módulo `canonical-*.js` nuevo:** registrarlo en `index.html` (antes de `app.js`), `service-worker.js` (`SHELL_URLS`) y `tools/build-public-site.mjs`; subir el recuento de `arq3-canonical-sin-consumidor-ui` (hoy 70) y darle un consumidor real en `app.js`.
5. **`app.js` no puede crecer** (techo 37.495 con trinquete; margen 82): cada paquete nuevo vive en su módulo y deja en `app.js` solo el enganche.
6. **Almacén nuevo en el navegador:** clasificarlo en `BACKUP_LOCAL_STORES` o excluirlo con motivo en `tests/arq6-copia-completa.test.cjs`.
7. **Campo nuevo en el estado (`appStatePayload`):** migración y *fixtures* con la herramienta (`state-contract.js`, A13-4), nunca a mano.
8. **Un `BACKLOG*.md` nuevo** debe enlazar a `BACKLOG_INDICE.md`; el índice solo puede tener **una** fila «🟢 Vigente» y la skill `finanzas-casa-workflow` (Modo Inicio, paso 2) debe nombrarla.
9. Service worker «primero caché»: la primera apertura tras un despliegue muestra la versión anterior (lo resuelve WP-01).
10. Tras crear un PR: `subscribe_pr_activity`; al fusionar, `unsubscribe_pr_activity`.
11. Los datos de demostración son anonimizados: decir siempre si una cifra es de la demo o del hogar.

---

## 11. Dónde está el detalle

| Tema | Documento |
|---|---|
| Plan de desarrollo: 3 olas, paquetes WP-01…WP-54, enfoque técnico, pruebas, calendario, riesgos | `docs/PLAN_DESARROLLO_DEFINITIVO.md` |
| Porqué de las propuestas `ND`/`NPV`/`NIN`/`NDB`/`NXP`/`NHG`/`NTC` | `docs/PROPUESTA_QUINTA_AUDITORIA_2026-10-02.md` |
| Porqué de las propuestas `CAP`/`PRV`/`CAR`/`DAC`/`DNU`/`FIS`/`UXS`/`HOG`/`GOV` | `docs/PROPUESTA_SEXTA_AUDITORIA_2026-10-03.md` |
| Enfoque técnico de WP-01…WP-21 | `docs/PLAN_IMPLEMENTACION_2026-10-03.md` (sigue valiendo; WP-22 queda retirado y repartido) |
| Respuestas del triaje y contradicciones R1-R5 | `BACKLOG_INICIO_OLEADA_OCTUBRE.md` §15.4 |
| Historia de la Ola 2 y sus mediciones | `docs/OLA2_RECALIBRACION.md` |
| Registro sesión a sesión | `PROJECT_STATE.md` |
| Plan en datos (paquetes, propuestas, hitos, tareas del hogar, métricas) | `docs/plan/plan-definitivo.json` |
| Avance real (estado de cada paquete, lecturas de métricas, tareas del hogar hechas) | Panel de seguimiento (artefacto privado, §12) |

---

## 12. Seguimiento del avance

**Petición del hogar (3/10/2026, sesión 298):** «genera un backlog y artefacto para poder ver el plan y controlar el grado de avance».

**Tres piezas, cada una con un solo trabajo:**
| Pieza | Qué guarda | Quién la cambia |
|---|---|---|
| Este documento | Qué se hace y por qué en ese orden (prioridades, niveles, decisiones) | Claude, cuando cambia el plan |
| `docs/plan/plan-definitivo.json` | El mismo plan en datos: 3 olas, 53 paquetes con sesiones estimadas, dependencias y «hecho cuando», las 104 propuestas, 16 hitos, 21 tareas del hogar y 10 métricas | Se regenera cuando cambia este documento; `tests/plan-seguimiento-sincronizado.test.cjs` falla si los dos se separan |
| **Panel de seguimiento** (https://claude.ai/artifact/7k86qmrcqn8hdhAzx9xcrg, privado) | El **estado**: paquete a paquete (estado, PR, fechas, sesiones reales, resultado de su métrica), tareas del hogar hechas, lecturas de métricas, revisión de salida de cada ola y registro de cambios | Claude al cerrar cada sesión; el hogar marca sus tareas y añade lecturas |

**Cómo mide el avance** (para que «vamos bien» signifique algo):
- **Avance ponderado por esfuerzo**, no por número de paquetes: hecho 100 %, en revisión 90 %, en curso 50 %, el resto 0 %. Un paquete de 7 sesiones (WP-42) pesa siete veces uno de 1 sesión.
- **Línea base fija** (fijada el 3/10/2026): lo previsto a una fecha reparte las sesiones de cada ola de forma lineal entre su inicio y su fin. El desvío se da en sesiones, como índice real/previsto y en **días de retraso** (la fecha en la que la línea base esperaba el avance que hay hoy). Si el arranque se retrasa, el panel lo muestra como retraso; no se mueve la línea base sin decisión del hogar.
- **Construido no es lo mismo que comprobado:** cada paquete con métrica lleva su resultado («sin medir», «cumple», «no cumple»). El panel cuenta aparte los paquetes con valor comprobado. Es la defensa contra el riesgo alto del plan (§6 del plan: construir para nadie).
- **Regla de parada visible:** cada ola tiene su «revisión de salida» (pendiente · seguir · parar y revisar) junto a las métricas que hay que mirar.

**Protocolo de Claude al cerrar cada sesión de desarrollo** (después de fusionar):
1. `ArtifactData` → `get` de `wp/<WP-ID>` y `set` con su `version` como `if_version`: `estado`, `pr`, `inicio`, `fin`, `sesionesReales`, `resultado` (si se midió), `nota`, y una línea más en `historial` (`{fecha, texto, por: "Claude"}`, se guardan las 20 últimas).
2. Una entrada en `registro` (`{fecha, ts, texto, por: "Claude"}`).
3. Al pasar el primer paquete a «en curso», `meta/plan.arranque` con la fecha.
4. Si cambia el plan (no el estado): regenerar el JSON, `node tools/build-plan-panel.mjs <scratchpad>/plan-contabilidadcasa.html` y volver a publicar el panel **en la misma URL** (`Artifact` con `url`). El estado no se pierde: vive en la base del panel, no en la página.

**Privacidad:** el panel no guarda importes. Las cifras fiscales y de la hipoteca siguen yendo solo por el chat.

