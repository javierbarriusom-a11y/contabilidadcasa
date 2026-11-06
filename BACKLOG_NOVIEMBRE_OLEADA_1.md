# Backlog de noviembre · Oleada 1 — Contabilidadcasa

**Creado el 5 de noviembre de 2026, a petición del hogar:** «Hazme una propuesta de mejoras y nuevas features […] en el
sentido de usabilidad y mejora de la visibilidad de las previsiones, estado e impacto de forecasts financieros en
función de diferentes escenarios. El backlog que tenemos actualmente lo conservamos y lo incorporamos con la prioridad
adecuada dentro del nuevo plan. Será el backlog de noviembre oleada 1».

**Es la única fuente viva de lo que falta por hacer y en qué orden.** Sustituye como backlog vigente a
[`BACKLOG_DEFINITIVO.md`](BACKLOG_DEFINITIVO.md), que **no se borra ni se vacía**: sigue siendo la referencia de las
reglas de ritmo (su §4), las recetas y trampas del repositorio (su §10), el protocolo del panel de seguimiento (su §12),
el registro de decisiones de su §0 hasta el 5/11 y el detalle de sus 104 propuestas. Todo lo que tenía abierto está
aquí, con su prioridad nueva (§6). Mapa de todos los backlogs: [`BACKLOG_INDICE.md`](BACKLOG_INDICE.md).
**Porqué de cada propuesta nueva (`FX-nn`)**, con el análisis crítico y la especificación de UX/UI:
[`docs/PROPUESTA_OCTAVA_AUDITORIA_2026-11-05.md`](docs/PROPUESTA_OCTAVA_AUDITORIA_2026-11-05.md).
**El repositorio es público: ninguna cifra real del hogar aquí.**

Autocontenido a propósito: quien lo abra sin haber visto la conversación debe poder decidir qué hacer primero en 10
minutos.

---

## 0. Estado en una línea

**6/11/2026 · D-N4 decidida por el hogar («sí, saldo arriba y margen debajo») y FX-01 cerrada.** En Hoy, «Fin de noviembre» enseña ahora el saldo previsto (demo: 10.350 €), el mismo de la banda de caja «según el plan» y del motor diario, y debajo «8.850 € sobre el suelo». Antes enseñaba solo el margen, que se leía como saldo. Se trata como corrección, según la recomendación de D-N4, así que no gasta el cambio de Hoy de la semana. Una e2e nueva, «FX-01 · una sola cifra de previsión», lo comprueba a 390 px (también en Safari) y 1440 px: Hoy, la banda y el motor diario dan el mismo saldo a fin de mes, y el titular de Previsión y su resumen, el mismo punto más bajo. **Semana S0 completa:** solo falta H-35 (del hogar, antes del 11/11).

**6/11/2026 (tarde) · FX-51, primera entrega: lo que mueve cada supuesto, en Ajustes › Supuestos.** Para la inflación, la subida de los ingresos y los factores de gasto e ingreso, la app recalcula el plan con el mismo motor, moviendo cada supuesto en su sentido desfavorable, y dice cuánta liquidez quita a fin del año que viene y al final del plan. Con la demo: «Con un punto más de inflación: a fin de 2027, 320 € menos; a fin de 2036, 27.000 € menos». Cada recálculo tarda ~1 ms. Las diferencias se redondean a dos cifras significativas: la regla de los niveles borraba 320 €. **Error que ya existía, corregido:** el registro decía «Factor general de ingresos ×0» y «de gastos ×0» con los factores sin tocar, que el motor usa como ×1. Pantalla nueva, ninguna.

**6/11/2026 · D-N1 aprobada por el hogar («sí, empieza con la semana S0») y S0 construida en un PR.** Con la demo (reloj 5/11):
- **FX-02:** Previsión decía «El punto delicado es nov 26 · cae a 5.350 € el 01 nov», una fecha ya pasada. El motor mensual pone el mínimo siempre en el día 1. Ahora toma el punto más bajo del motor diario, el mismo de Hoy, solo desde hoy: «El punto delicado es dic 26 · Lo más bajo llega el 8 dic: unos 5.600 €». Hasta 90 días lleva el día; más allá, el mes. El «Mínimo del periodo» del resumen dice lo mismo, con el mismo redondeo. Las barras siguen siendo el mensual, rotulado como «el peor orden del mes».
- **FX-04:** sin céntimos en la banda de caja ni en la sensibilidad. El titular va a la decena hasta 30 días, a la centena hasta un año y al millar después.
- **FX-30:** «rango probable (8 de cada 10 casos)», «lo más probable» y «peor caso razonable» en vez de P10/P50/P90 y «trayectorias». La sensibilidad ya no dice «207 %» ni «−5.350 €», sino «aguanta aunque no llegue el ingreso previo a la nómina».
- **FX-16:** Previsión cabe a 390 px: cifras en dos columnas, la tabla mensual con todas sus columnas a la vista desplazando y las etiquetas del gráfico sin pisarse.
- **FX-62:** Previsión y Escenarios, en el medidor de utilidad.
- **FX-01, primera parte:** `canonical-forecast-contract.js`, el contrato de las cifras de previsión, con su prueba.
- **Pendiente:** la prueba de coherencia entre todas las pantallas y la etiqueta de Hoy «Fin de noviembre», que espera **D-N4**. **H-35** sigue siendo del hogar (antes del 11/11).
- **Panel de seguimiento al día (6/11):** pestaña «Noviembre · Oleada 1» con las 41 filas (§9). FX-02, FX-04, FX-16, FX-30 y FX-62 hechas, y FX-01 en curso.
- **Dos filas revisadas al mirar el código (6/11):**
  - **FX-03:** el cierre de cada mes ya cuadra entre el motor diario y el mensual; es una invariante que hace fallar la app si no se cumple. Lo que difiere es la forma dentro del mes: el motor diario carga el gasto variable estimado entero el día 8, y la banda lo reparte por días. Arreglarlo cambia la cifra de Hoy, así que va tras la revisión de Hoy del 16/11, como el cambio de Hoy de esa semana.
  - **FX-51:** el registro de supuestos ya existe en Ajustes, con su fecha y su caducidad. Falta el impacto de cada supuesto.

**5/11/2026 · WP-21, la parte de inversión hecha antes de su turno** (#588, en otra sesión en paralelo con la que creó este backlog): «Datos para la Renta» en Inversión › Cartera (titular, depositario, dividendos e intereses, pérdidas por bloque) y el «Informe de inversión para la Renta» en Herramientas avanzadas › Fiscal, con CSV, impresión y su línea en el borrador GOB8. Sin cambios en la previsión ni en Hoy. Queda en la Oleada 2 solo el local alquilado (PR-3); lo que falta para que dé cuota son los datos del hogar.

**5/11/2026 · nace este backlog.** Tesis de la oleada: **la previsión no necesita más motores, necesita una sola
verdad, una sola pantalla y los escenarios encima.** Con la demo, la misma pregunta («¿cuánto tendremos?») recibe
cuatro respuestas de tres motores (8.850 € de margen en Hoy, 5.350 € «el 01 nov» en Previsión, 10.350 € en la banda,
2,4 meses en la cabecera), lo mejor de la previsión está plegado y ningún escenario se puede ver sobre ella. Por eso la
oleada va en este orden: **coherencia (semana del 6/11) → cimientos sin cambios visibles (12-18/11, semana de
revisiones) → Previsión nueva C2 (19-25/11) → escenarios superpuestos y pruebas de estrés (26/11-2/12) → cierre de
noviembre como prueba de fuego (1-4/12).** Pendiente: que el hogar conteste las decisiones D-N1 a D-N7 (§7).

## 1. Cómo empezar la próxima sesión (10 minutos)

1. Leer §0, §2, §4 y §5.1 de este documento y la última entrada de `PROJECT_STATE.md`.
2. Antes de tocar una pantalla, `docs/rediseno/ESTADO.md` entero (CLAUDE.md). Antes de tocar la previsión, §4-§6 de la
   propuesta octava.
3. `git status`, `git log --oneline -5`; la rama parte de `origin/main` (receta en `BACKLOG_DEFINITIVO.md` §10).
4. Lo siguiente es la primera fila de §5.1 sin hacer **de la semana en curso** (§4). Si una fila espera una decisión del
   hogar (§7), se salta a la siguiente y se dice.
5. Al cerrar: validar, `PROJECT_STATE.md` con cifras reales, **este documento** (§0 y la columna «Estado» de §5),
   `docs/rediseno/ESTADO.md` si es una pantalla, commit, push, PR en borrador, CI y fusión en verde (CLAUDE.md).

---

## 2. Qué cambia frente a `BACKLOG_DEFINITIVO.md`

| Antes (hasta el 5/11) | Desde esta oleada |
|---|---|
| El siguiente paso lo marcaban WP-23, el rediseño (§8 de `ESTADO.md`) y lo que pidiera el uso real | Un eje explícito para noviembre: **previsión y escenarios visibles**, con fechas por semana (§4) |
| Previsión C2 era «la siguiente pantalla, tras las revisiones» sin más alcance que la referencia | C2 se amplía con escenarios superpuestos, insignia de confianza, qué ha cambiado y lo que viene (FX-10…FX-40) |
| XPR-01…05 y 08…11 de la séptima auditoría seguían como propuesta | Adoptadas con prioridad (§5); XPR-06 y XPR-07 se gradúan dentro de C2 |
| NPV-06 («¿Y si…?» desde Previsión), NIN-09 (estrés en una pulsación) y NDB-03 (¿me lo puedo permitir?) en P3 | NIN-09 sube a P0 dentro de FX-21; NPV-06 y NDB-03, a P1 dentro de FX-22 |
| WP-28 (kit de gráficos) aparcado | Desaparcado como FX-61: C2 es su primera pantalla |
| Siete motores o pantallas de escenarios | Uno visible (Previsión + Decidir › Escenarios) y unificación de motores en P2 (FX-25) |

Lo que **no** cambia: el resto de prioridades y estados de `BACKLOG_DEFINITIVO.md` (se reproducen en §6), sus reglas
(§3 aquí) y el calendario con fecha fija (fiscal, revisiones, cierres).

---

## 3. Reglas vigentes

**Heredadas sin cambio** (detalle en `BACKLOG_DEFINITIVO.md` §4 y CLAUDE.md):
- Lo nuevo nace encendido, con revisión a los 14 días en Ajustes › Funciones en prueba (29/10).
- **Un cambio de Hoy por semana**, cada uno con su línea en Novedades. Las correcciones de errores no cuentan.
- **Uno entra, uno sale** (GOV-02), comprobado por el CI (XGO-01). Una excepción se escribe en
  `docs/gobierno/superficie.json`.
- GOV-01: ≤ 10 min/semana para mantener la app. GOV-04, GOV-05 y GOV-06 igual.
- Nada se ejecuta solo (A11-4). Las acciones que cambian el plan conservan su paso de revisión.
- No se retira una pantalla en uso sin consultar; retirar es redirigir sin borrar código.
- Sin límite de paquetes en curso (26/10).
- Frenos de publicación de CLAUDE.md.

**Nuevas de esta oleada** (propuestas por Claude; el hogar puede vetarlas con D-N1):
- **R-N1 · Contrato de cifras.** Desde FX-01, toda cifra de previsión que se pinte pasa por el contrato
  (`canonical-forecast-contract.js`). Una cifra nueva fuera de él no pasa el CI.
- **R-N2 · Nunca céntimos en una previsión** (FX-04).
- **R-N3 · Los escenarios sobre la previsión son de solo lectura.** Aplicar sigue en Decidir › Escenarios con su
  revisión.
- **R-N4 · Tope blando de 3 funciones nuevas en prueba a la vez durante la oleada** (D-N7). No limita construir: limita
  lo que se enciende a la vez para que cada revisión de 14 días mida una sola cosa.
- **R-N5 · La recomendación del 4/11 se respeta:** ninguna pantalla nueva antes de las revisiones del 12 al 18/11. Esa
  semana solo se construyen motores y piezas sin cambio visible (S1).

---

## 4. Calendario de la oleada (6/11 - 4/12/2026)

| Semana | Tema | Desarrollo | Hitos y tareas del hogar |
|---|---|---|---|
| **S0 · 6-11/11** | Una sola verdad (correcciones) | FX-02, FX-04, FX-30, FX-16, FX-62 y FX-01 | **H-35** días de cargo de las 10 partidas más grandes (≈ 15 min) · **H-03** datos fiscales en la app (antes del 12/11) · 7/11 revisión del Repaso semanal |
| **S1 · 12-18/11** | Revisiones y cimientos sin cambio visible | FX-61/FX-11 (kit de gráficos), FX-03 (trayectoria cosida), FX-51 (motor de supuestos) · WP-23 con los datos del hogar | 12/11 revisión de las 8 funciones encendidas el 29/10 · **14/11 campaña fiscal lista (WP-23)** · 14/11 revisión de «Plan nuevo» · 15/11 posible cambio de Hoy (avisos de WP-36) · 16/11 revisión de Hoy · 18/11 revisión de Cierre y Clasificar, **H10** y **H12** · respuestas D-N1…D-N7 |
| **S2 · 19-25/11** | Previsión nueva (C2) | FX-10 con FX-11, FX-31, FX-12 (plegado) y XPR-06/07/08 integradas | 20/11 fin de la Ola 2 del plan anterior |
| **S3 · 26/11-2/12** | Escenarios sobre la previsión | FX-20, FX-21 (3 primeras pruebas de estrés), FX-23, FX-40, FX-42 | **30/11 H8** (A5-1/A5-4, activar o archivar) |
| **S4 · 1-4/12** | Prueba de fuego: cierre de noviembre | FX-43 (la carta cuenta la previsión) y arreglos de lo que salga | **1-3/12 cierre de noviembre** (primer coste del cierre medido; primera carta del mes) · **4/12 revisión de salida de la oleada** (§8) |

**Capacidad:** el núcleo (§5.1) suma ≈ 31,5 sesiones (33 antes de revisar FX-03 y FX-51 el 6/11). Al ritmo de octubre no es el cuello de botella; lo son las
revisiones y los datos del hogar. Si algo se retrasa, se cae primero lo marcado «si da tiempo» y nunca S0.

---

## 5. Backlog priorizado

Columnas: **ID** · **Qué** · **Origen** (8ª = propuesta octava; 7ª = séptima auditoría; Def = `BACKLOG_DEFINITIVO.md`)
· **Esf.** (S ≤ 1 sesión, M 2-3, L 4+) y sesiones · **Depende** · **Semana** · **Hecho cuando** · **Estado**.

### 5.1 P0 — Oleada 1, núcleo (6/11 - 4/12/2026)

| # | ID | Qué | Origen | Esf. | Depende | Sem. | Hecho cuando | Estado |
|---|---|---|---|---|---|---|---|---|
| 1 | **FX-02** | El «punto delicado» nunca en una fecha pasada ni en el día 1 inventado; sensibilidad sin «207 %» ni importes negativos | 8ª | S · 0,5 | — | S0 | Reloj 5/11: ningún titular con fecha < hoy; pruebas de mínimo al principio, al final y en el mes siguiente | **Hecho 6/11** |
| 2 | **FX-04** | Precisión según el horizonte; nunca céntimos en una previsión | 8ª | S · 0,5 | — | S0 | Barrido de vistas con la demo sin céntimos en previsiones | **Hecho 6/11** (banda de caja, titular y sensibilidad; el resto de pantallas, con FX-01) |
| 3 | **FX-30** | Lenguaje de incertidumbre para personas (rango probable, peor caso razonable) | 8ª | S · 1 | — | S0 | Las 6 frases de la tabla de la propuesta §8 cambiadas; «¿cómo se calcula?» plegado | **Hecho 6/11** (banda de caja y sensibilidad de Previsión) |
| 4 | **FX-16** | Remates del móvil en Previsión (cifras cortadas, columnas ocultas, eje que se pisa) | 8ª | S · 0,5 | — | S0 | `check-mobile-overflow` vigila Previsión; nada cortado a 320 y 390 px | **Hecho 6/11** |
| 5 | **FX-62** | Medir Previsión y Escenarios en el medidor de utilidad | 8ª | S · 0,5 | — | S0 | Eventos de vista, horizonte, día fijado, escenario y preset en Uso de la app | **Hecho 6/11** |
| 6 | **FX-01** | Contrato de cifras de previsión + glosario con vuestras cifras (absorbe XUX-05); Hoy «Fin de noviembre» con su unidad | 8ª, 7ª | M · 2 | FX-04 | S0 | Prueba de coherencia: cada etiqueta, mismo valor en todas las pantallas (demo + 5 hogares sintéticos × 5 fechas) | **Hecho 6/11**: contrato (#590), Hoy con el saldo arriba y el margen debajo (D-N4) y la e2e de coherencia (Hoy, banda, motor diario, titular y resumen) |
| 7 | **H-35** | (Hogar) Día de cargo de las 10 partidas más grandes | 8ª | ≈ 15 min | — | S0 | Calidad de la previsión ≥ 40 % del gasto con día conocido | Tarea del hogar |
| 8 | **WP-23** | Campaña fiscal de fin de año con los datos del hogar (FIS-01, DAC-02, FIS-02) | Def P0 | — | H-03 | S1 | Lista con euros reales el 14/11; acciones antes del 31/12 | Esperando H-03 (12/11) |
| 9 | **FX-61** | WP-28 desaparcado: kit de gráficos táctil y accesible | Def P1 (WP-28) | M · 3,5 | — | S1 | Recorrido táctil y teclado, frase automática y «ver como tabla» en el componente | Aparcado → P0 |
| 10 | **FX-11** | Gráfico de previsión único (real, plan, rango, suelo, hitos, escenarios, costura) | 8ª | M · incl. en FX-61 | FX-61 | S1 | Lo usan Previsión y Escenarios; axe; frase automática correcta con la demo | Propuesta |
| 11 | **FX-03** | Una sola forma de la trayectoria en los primeros 90 días: el motor diario reparte el gasto variable por los días del mes, como la banda, en vez de cargarlo entero el día estimado. **El cierre de cada mes ya cuadra** entre motores (invariante `monthly-parity` de `canonical-daily-engine.js`). Absorbe la parte de previsión de RD-COB2 | 8ª, Def §5.0 | M · 2 | FX-01 | S2 (tras la revisión de Hoy del 16/11) | La banda «según el plan» y el motor diario dan el mismo saldo cada día (demo + sintéticos); el titular y la banda, la misma fecha de mínimo | **Revisado 6/11:** cambia la cifra de Hoy, así que entra como el cambio de Hoy de una semana |
| 12 | **FX-51** | Supuestos del plan: **el registro ya existe** (Ajustes, con fecha y caducidad, A7-2/PVC15). Falta el impacto de cada supuesto (±1 punto) en el fin de año y a 24 meses, verlo desde Previsión y sumar Euribor, rentabilidad de la cartera y renta del local | 8ª | M · 1,5 | — | S1-S2 | Cada supuesto con su impacto ±1 en el fin de año; editar enseña antes/después | **PR-1 hecho 6/11**: el impacto de los cuatro supuestos generales, en Ajustes; el «×0» de los factores, corregido. Falta verlo desde Previsión (con C2) y sumar Euribor, rentabilidad y renta del local |
| 13 | **FX-10** | **Plan › Previsión con el diseño nuevo (C2), ampliada** | 8ª, Def §5.0 (C2) | L · 4 | FX-01, FX-11 | S2 | Cifra + gráfico + panel del día sin desplazar a 1440 × 900; cifra + gráfico a 390 × 844; menos titulares que hoy (XGO-01); e2e 390 `@safari` y 1440; axe claro/oscuro | Propuesta |
| 14 | **XPR-06** | Qué mueve cada día, dentro de C2 (sale de su interruptor) | Def §5.0 | — | FX-10 | S2 | Panel/hoja del día de C2 | Hecho, en prueba (revisión 12/11) |
| 15 | **XPR-07** | El arreglo más barato, dentro de C2 | Def §5.0 | — | FX-10 | S2 | Tarjeta de remedio de C2 | Hecho PR-1, en prueba (revisión 12/11) |
| 16 | **XPR-08** | «De verdad libre»: disponible tras apartar lo que viene | 7ª | S-M · 1,5 | FX-10 | S2 | Tarjeta de C2 con «Apartar» que lleva al sobre | Propuesta 7ª → adoptada |
| 17 | **FX-31** | Una insignia de confianza de la previsión, con la tarea que más la sube (XPR-03 en parte; WP-10, WP-12, WP-45) | 8ª, 7ª | S-M · 1,5 | FX-10 | S2 | Insignia en Previsión y punto en Hoy; hoja con por qué y tarea por € de incertidumbre/minuto | Propuesta |
| 18 | **FX-12** | Lo que viene en 90 días: hitos del horizonte (absorbe la franja de WP-49) | 8ª, Def P2 | M · 2 | FX-10 | S2 (plegado) / S3 | Lista por semana con certeza y «¿sabes el día?»; mismos hitos en el gráfico | Propuesta |
| 19 | **WP-37** | Estados completos y «deshacer», aplicados a C2 | Def P1 | — | FX-10 | S2 | Vacío, sin saldos, sin suelo y error en C2 | Aparcado → se aplica en C2 |
| 20 | **FX-20** | **Escenarios superpuestos en la previsión** (solo lectura) y tabla de impacto plan frente a escenario | 8ª | L · 3,5 | FX-10, FX-03 | S3 | Línea discontinua con su nombre; tabla de 6 indicadores; frase determinista; e2e y axe | Propuesta |
| 21 | **FX-21** | Pruebas de estrés del hogar, **3 primeras**: Euribor +1/+2, un sueldo menos 3-6 meses, imprevisto de 3.000 € (absorbe NIN-09 y XNF-03) | 8ª, Def P3, 7ª | M · 2 | FX-20 | S3 | Cada una dice: ¿bajamos del suelo?, ¿cuándo?, ¿cuánto falta?, qué palanca lo arregla | Propuesta · **D-N3** |
| 22 | **FX-23** | Comparar el plan con un solo escenario o un preset; texto de Escenarios en lenguaje de hogar | 8ª | S-M · 1,5 | FX-20 | S3 | Comparar con 1 escenario sin el aviso de «hacen falta dos» | Propuesta |
| 23 | **FX-40** | Qué ha cambiado desde tu última visita: puente con 4 causas (absorbe XUX-07; WP-43 se mueve a Previsión) | 8ª, 7ª, Def P2 | M · 2,5 | FX-01 | S3 | «−300 € frente al lunes [por qué]» con datos nuevos / plan / supuestos / tiempo; WP-43 sale de `#plan` | Propuesta |
| 24 | **FX-42** | La previsión en el «Listo» del Repaso semanal (no es un paso nuevo) | 8ª | S · 0,5 | FX-40 | S3 | Tarjeta de 3 líneas en «Listo» | Propuesta · solo si el Repaso sigue tras su revisión del 7/11 |
| 25 | **FX-43** | La carta del mes cuenta la previsión (WP-29) | 8ª, Def P1 | S · 0,5 | WP-12 | S4 | Primera carta con el cierre de noviembre | Propuesta (WP-29 esperando al hogar) |

**Si da tiempo dentro de la oleada** (si no, abren la Oleada 2): FX-21 resto de presets (gasto +10 %, la paga variable
no llega, el inquilino no paga, caída de mercado −20 %), FX-41 (avisos de previsión con umbral, como cambio de Hoy de
una semana) y FX-14 (el mes en curso al ritmo real).

### 5.2 P1 — Oleada 2 (7/12/2026 - 22/1/2027, el tramo que era la Ola 3)

| # | ID | Qué | Origen | Esf. | Depende | Nota |
|---|---|---|---|---|---|---|
| 1 | FX-21 (resto) | Las otras 4 pruebas de estrés | 8ª | M · 1 | FX-20 | Las que tengan sus datos (local, cartera, ingresos inciertos) |
| 2 | FX-14 / XPR-04 | El mes en curso al ritmo real | 7ª | M · 2 | FX-03 | Previsión y Plan › Mes |
| 3 | FX-13 / XPR-05 | Previsión por cuenta y traspasos sugeridos; desbloquea XPR-07 PR-2 (traspasos) | 7ª, Def §5.0 | M · 2,5 | FX-10 | Nunca ejecuta el traspaso |
| 4 | FX-22 | «¿Y si…?» rápido desde la previsión (NPV-06 y NDB-03 promovidas) | 8ª, Def P3 | M · 2 | FX-20 | Responde «¿me lo puedo permitir?» |
| 5 | FX-41 | Avisos de previsión con umbral en Hoy y en el calendario (WP-32) | 8ª | S-M · 1,5 | FX-40 | Entra como el cambio de Hoy de una semana |
| 6 | FX-60 / XUX-01 | Navegación por cinco preguntas; Plan › Previsión, único sitio de la previsión; Escenarios en Decidir | 7ª, Def §5.0 | L · 4 | FX-10 | Redirige `#forecast`, Previsión mensual, Análisis, Mapa de calor |
| 7 | RD-D1/D2 | Patrimonio e Inversión con el diseño nuevo | Def §5.0 | L | FX-11 | Usan el gráfico único |
| 8 | FX-50 | Hasta 2036 legible: vista anual con hitos y supuestos (absorbe `#forecast`; sobre WP-46) | 8ª | M-L · 3 | FX-51, FX-03 | — |
| 9 | FX-15 | Resumen por periodo en cascada; tabla que cabe en el móvil | 8ª | S · 1 | FX-10 | Tras «Ver todo el detalle» |
| 10 | FX-27 / XDO-02 | La revisión de la hipoteca como escenario con fecha | 8ª, 7ª | M · 2 | FX-21, WP-20 | Sube a primera fila a ≤ 120 días de la revisión |
| 11 | XDA-10 PR-2 | Antes de decidir: Euribor, cancelar deuda (DEB-15), simuladores e **escenarios** | Def §5.0 | S-M | FX-20 | Encaja con los presets |
| 12 | WP-34 / PRV-08 | Revisión base cero del plan (enero) | Def P1 | — | — | Enero 2027, con FX-51 a la vista |
| 13 | WP-21 | Paquete Renta: ~~inversión~~ (hecha el 5/11, #588) y local alquilado (PR-3) | Def P2 | M · 2 | WP-31 | Antes del 31/3/2027 |
| 14 | XPR-11 | Mover los días de cargo a donde menos duelen (palanca del remedio) | 7ª | S · 1 | FX-12 | — |
| 15 | XDA-04 PR-2 | Tira de cobertura de 90 días por cuenta | Def §5.0 | S | dos importaciones reales | La condición ya puede cumplirse |
| 16 | WP-54 | Primera ronda de la prueba con 5 personas ajenas, **con C2 y los presets como tareas** | Def (continuo) | — | FX-10, FX-21 | Desde diciembre |

### 5.3 P2 — planificada, con disparador de datos (febrero - mayo 2027)

| ID | Qué | Origen | Disparador |
|---|---|---|---|
| FX-32 / XPR-01 | El rango cubre también los importes | 8ª, 7ª | 3 cierres con reales por partida |
| FX-33 / XPR-02 / XPR-03 | La previsión corrige su sesgo y su rango se calibra | 8ª, 7ª | 3 cierres comparables (≈ febrero 2027, WP-12) |
| FX-34 / XPR-10 | Probabilidad sugerida para los ingresos inciertos | 8ª, 7ª | 6 meses de ingresos |
| FX-35 / XPR-09 | Detector de cambios de nivel del gasto | 8ª, 7ª | 4 meses de reales por partida |
| FX-26 | Diario de decisiones con lo que se esperaba | 8ª | El primer escenario aplicado |
| FX-25 | Un solo motor de escenarios (E13 y simulador → E20, con paridad) | 8ª | Tras FX-20; retirar pantallas se consulta (D-N6) |
| FX-52 | Qué supuesto pesa más (tornado) | 8ª | Tras FX-51 |
| FX-53 / XIN-04 | Objetivos con probabilidad y aportación necesaria | 8ª, 7ª | Tras FX-50 |
| FX-63 | Rendimiento de escenarios superpuestos (≤ 100 ms percibidos) | 8ª | Si `perf-screens` lo pide con FX-20 |
| WP-42 (resto) | Escalera del próximo euro (NIN-05, CAR-03); NIN-08 ya hecho | Def P2 | Aparcado; se retoma tras FX-60 |
| RD-D3 | Deuda con el diseño nuevo | Def §5.0 | Tras NTC-05 (un solo motor de deuda) |
| RD-D4 / RD-E2 | Taller de deuda nueva; Lo que la app te pide + Laboratorio | Def §5.0 | Tras D3 |
| XDA-03 nivel 2 | pdf.js en el propio sitio | Def §5.0 | Solo si una cuenta da únicamente PDF |
| DAC-05 | ¿Cobra el banco la cuota pactada? | Def P3 → P2 | Ya hay extractos mensuales (la condición que recomendó Claude) |

### 5.4 P3 — catálogo con disparador (sin cambio salvo las promovidas)

Las 27 de `BACKLOG_DEFINITIVO.md` §5.4 **siguen igual, con el mismo disparador**, salvo tres que suben: **NPV-06** y
**NDB-03** (a FX-22, P1) y **NIN-09** (a FX-21, P0). Quedan: CAP-01 (nivel 2), CAP-03, CAP-04, PRV-03, PRV-07, DAC-03,
UXS-01, UXS-02, UXS-03, UXS-06, HOG-01, HOG-03, ND-05, ND-06, NPV-12, NIN-04, NIN-07, NDB-04, NXP-03, NXP-06, NHG-01,
NHG-04 y NTC-05 (DAC-05 pasa a P2, §5.3). Nuevas en P3: **FX-24** (escenarios con probabilidad; disparador: el hogar
pide ponderarlos), **FX-64** (una lectura de la previsión para compartir; disparador: el hogar la pide) y **XIN-07**
(fecha de independencia financiera; disparador: el hogar la pide). Del §5.0: **XUX-02** (más tarjetas «Ver cómo
quedaría») y **XDA-01 PR-2** (pausar, valor por minuto), si el medidor dice que se usan.

### 5.5 P4 — bloqueadas por un tercero o un evento (sin cambio)

ND-12, NDB-05, DNU-01, DNU-02 y HOG-04, con los mismos desbloqueos de `BACKLOG_DEFINITIVO.md` §5.5.

### 5.6 Archivo (sin cambio)

NXP-07, NHG-02, CAP-08 y NHG-03 (`BACKLOG_DEFINITIVO.md` §5.6).

### 5.7 Tareas del hogar de la oleada

| ID | Qué | Para | Fecha |
|---|---|---|---|
| **H-35** | Día de cargo de las 10 partidas más grandes (Plan › Partidas o «¿sabes el día?») | La calidad de la previsión, que hoy es la palanca de visibilidad más barata | **Antes del 11/11** |
| H-03 | Datos fiscales en la app | WP-23 | 12/11 |
| D-N1…D-N7 | Contestar las decisiones de §7 | Arrancar S2 y S3 | 18/11 |
| H10, H12 | Excepción XGO-01 de Cierre; puerta de «aceptar en bloque» | Revisiones | 18/11 |
| H8 | A5-1/A5-4: activar o archivar | Gobierno | 30/11 |
| H-06 (nov.) | Cierre de noviembre con saldos del día | Coste del cierre, carta, backtest | 1-3/12 |
| H-34, H-26 | Desplegar el buzón; tres tiempos de carga en el iPhone | XDA-02 PR-2, WP-52 | Sin fecha |

Las demás tareas del hogar del plan (H-22 a H-33 y las de cada paquete «esperando al hogar») siguen como estaban en el
panel de seguimiento.

---

## 6. Dónde queda cada cosa abierta de `BACKLOG_DEFINITIVO.md`

**Nada se pierde.** Esta tabla es la prueba: cada fila abierta del backlog anterior, con su sitio nuevo.

| Del backlog anterior | Estado al 5/11 | Sitio en esta oleada |
|---|---|---|
| §5.0 RD-COB2 (cobro con el mismo mes del año anterior) | Propuesta | Dentro de **FX-03** (P0, S1) |
| §5.0 XPR-06 | Hecho, en prueba | Se gradúa dentro de **C2** (P0, S2) |
| §5.0 XPR-07 PR-1 / PR-2 | PR-1 hecho, en prueba | PR-1 dentro de C2 (P0); PR-2 con **FX-13** (P1) y WP-41 |
| §5.0 XDA-10 PR-2 | Pendiente | P1 Oleada 2 (#11) |
| §5.0 XUX-02 (más tarjetas), XDA-01 PR-2 | Si se usan | P3 (sin cambio de criterio) |
| §5.0 XDA-05 PR-2 | Puerta del medidor | **H12, 18/11** (sin cambio) |
| §5.0 XDA-02 PR-2 | Construido sin desplegar | H-34 (hogar) |
| §5.0 XDA-04 PR-2 | Con dos importaciones reales | P1 Oleada 2 (#15) |
| §5.0 XDA-03 nivel 2 | Solo si una cuenta da solo PDF | P2 con su condición |
| §5.0 Rediseño: C2 | Siguiente pantalla | **FX-10** (P0, S2) |
| §5.0 Rediseño: D1-D2, navegación | Tras revisiones | P1 Oleada 2 (#6, #7) |
| §5.0 Rediseño: D3, Taller, E2 | Tras NTC-05 | P2 (sin cambio de condición) |
| §5.0 revisiones RD-B5 (7/11), Plan nuevo (14/11), Hoy (16/11), Cierre y Clasificar (18/11) | Con fecha | Calendario §4, sin cambio |
| P0 WP-23 (FIS-01, DAC-02, FIS-02) | En curso, espera H-03 | **P0, S1** (sin cambio) |
| P1 WP-28 (NPV-07) | Aparcado | **FX-61, P0, S1** |
| P1 WP-37 (NXP-04) | Aparcado | Se aplica a C2 (P0, S2) y a cada pantalla nueva |
| P1 WP-29 (NHG-05) | Esperando al hogar | **FX-43**, primera carta 1-3/12 |
| P1 WP-35 (PRV-02, PRV-04) | Esperando al hogar | Fila plegada de C2; base de la prueba «la paga no llega» |
| P1 WP-36 (ND-07) | Esperando al hogar | Cambio de Hoy candidato del 15/11 (sin cambio) |
| P1 WP-38 (PRV-05, NPV-09) | Esperando al hogar | Palanca que nombran las pruebas de estrés (FX-21) |
| P1 WP-34 (PRV-08) | Esperando al hogar | Enero, P1 Oleada 2 (#12) |
| P1 WP-31, WP-52 y demás P1 hechos o esperando | Como estaban | Sin cambio (panel) |
| P2 WP-43 (PRV-01) | Esperando al hogar | **FX-40** (lo mueve a Previsión) |
| P2 WP-45 (ND-09, CAP-07) | Esperando al hogar | Base de **FX-31** |
| P2 WP-46 (NPV-10) | Esperando al hogar | Base de **FX-50** |
| P2 WP-49 (NPV-04) | Esperando al hogar | Dentro de **FX-12** |
| P2 WP-16 (NPV-01) | Hecho | Base de FX-11 y FX-20 |
| P2 WP-42 (CAR-03, NIN-05) | Aparcado | P2 (tras FX-60) |
| P2 WP-21 (NIN-10, FIS-03) | Inversión hecha (PR-0 a PR-2, 5/11); falta el local (PR-3) y los datos del hogar | P1 Oleada 2 (#13), antes del 31/3 |
| P2 WP-17, WP-18, WP-19, WP-39, WP-40, WP-41, WP-44, WP-47, WP-48, WP-50, WP-51, WP-53 | Hechos o esperando al hogar | **Sin cambio**: siguen con su tarea del hogar; no son de esta oleada |
| P3 (27) | Catálogo | §5.4: tres promovidas, DAC-05 a P2, el resto igual |
| P4 (5), Archivo (4) | — | Sin cambio |
| §6 pendientes: H8, H10, H12, `O-6`, OPT-10–13, ARQ-4, I3, I6, Cola B, UX-P1…P7 | — | Sin cambio (H8 30/11; H10 y H12 18/11; `O-6` se mira en enero; OPT-10–13 en enero) |
| Séptima auditoría: XPR-01…05, 08…11, XUX-01, XUX-05, XUX-07, XNF-03, XIN-04, XIN-07, XDO-02 | Propuestas | **Adoptadas** aquí con la prioridad de §5 |
| Séptima auditoría: el resto (XDA-06…09, XIN-01/03/05/06/08, XDO-01/03…06, XDN-*, XUX-04/06, XNF-01/02/04/05/06) | Propuestas | **Sin cambio**: siguen como propuesta, fuera de esta oleada |

---

## 7. Decisiones que pide esta oleada al hogar

| # | Pregunta | Recomendación de Claude | Para cuándo |
|---|---|---|---|
| **D-N1** | ¿Se adopta este backlog como vigente, con el orden por semanas y las reglas R-N1 a R-N5? | Sí | Para empezar S0 (las correcciones de S0 no esperan: son errores) |
| **D-N2** | Horizontes de Previsión: los de la referencia (3 m · 12 m · 24 m · Hasta 2036) en lugar de los de hoy (12 · 24 · 48 · 2036) | Los de la referencia: el riesgo de caja está en los 3 primeros meses | 18/11 |
| **D-N3** | Las 3 primeras pruebas de estrés | Euribor +1/+2 (hipoteca variable), un sueldo menos 3-6 meses, imprevisto de 3.000 € | 18/11 |
| **D-N4** | Hoy «Fin de noviembre 8.850 €» es margen sobre el suelo. ¿Se rotula «Margen a fin de noviembre» o se enseña el saldo con el margen debajo? ¿Cuenta como corrección (fuera de «un cambio de Hoy por semana»)? | Saldo arriba y margen debajo; sí, es corrección | **Decidida el 6/11: saldo arriba y margen debajo** (hecha el mismo día; tratada como corrección) |
| **D-N5** | Los escenarios sobre la previsión, solo de lectura; aplicar, en Decidir › Escenarios | Sí (R-N3) | 18/11 |
| **D-N6** | Tras la paridad (FX-25), ¿redirigir el laboratorio E13 y el simulador de decisiones a Escenarios? | Sí, con dos meses de redirección; se pregunta de nuevo antes de hacerlo | Febrero 2027 |
| **D-N7** | Tope blando de 3 funciones nuevas en prueba a la vez durante la oleada | Sí (R-N4) | 18/11 |

---

## 8. Métricas y revisión de salida (4/12/2026)

| Métrica | Objetivo | Se mide con |
|---|---|---|
| M-COHERENCIA | 100 % de las cifras del contrato iguales en todas las pantallas | Prueba de FX-01 en el CI |
| M-PREV-USO | ≥ 2 días por semana con Previsión vista, 4 semanas desde C2 | Medidor (FX-62) |
| M-PREV-T | Mediana ≤ 10 s hasta la primera interacción en Previsión | Medidor |
| M-ESC | ≥ 1 escenario o prueba de estrés superpuesta por semana, 3 de 4 semanas | Medidor |
| M-CONF | Gasto con día conocido ≥ 40 % al cierre de noviembre (≥ 70 % en enero) | WP-10 |
| M-SUPERFICIE | −15 % de titulares visibles por defecto en Plan y Escenarios | XGO-01 |
| GOV-01 | ≤ 10 min/semana (sin cambio) | Repaso (B5) |
| Coste del cierre | Por debajo de la línea base de octubre (≈ 45 min) | Medidor, cierre de noviembre |

**Revisión de salida el 4/12:** seguir, ajustar o parar. **Regla de parada:** si en 4 semanas desde C2 no se mueve
ninguna de M-PREV-USO, M-ESC o M-CONF, no se abre la Oleada 2 sin revisarla con el hogar.

---

## 9. Seguimiento

- **El panel de seguimiento** (artefacto privado, `BACKLOG_DEFINITIVO.md` §12) mide el plan de la línea base del 3/10 y, **desde el 6/11, tiene la pestaña «Noviembre · Oleada 1»** con las 41 filas de §5.1 y §5.2: pista `noviembre` de `docs/plan/plan-definitivo.json`, fuera de la línea base como el §5.0. Su estado vive en la colección `noviembre` de la base del panel, y `tests/plan-seguimiento-sincronizado.test.cjs` exige que coincida con este backlog.
- Cada fila cerrada actualiza la columna «Estado» de §5 y una línea en §0.
- Cada pantalla cerrada actualiza `docs/rediseno/ESTADO.md` §2 (y §8 si cambia el orden).

## 10. Dónde está el detalle

| Tema | Documento |
|---|---|
| Porqué, análisis crítico y especificación de UX/UI de cada `FX` | `docs/PROPUESTA_OCTAVA_AUDITORIA_2026-11-05.md` |
| Reglas de ritmo, recetas y trampas, protocolo del panel | `BACKLOG_DEFINITIVO.md` §4, §10 y §12 |
| Paquetes WP-01…WP-54 (enfoque técnico, pruebas) | `docs/PLAN_DESARROLLO_DEFINITIVO.md` |
| Rediseño: estado, decisiones y referencias | `docs/rediseno/ESTADO.md`, `docs/rediseno/referencias/` |
| Catálogo `X..-nn` | `docs/PROPUESTA_SEPTIMA_AUDITORIA_2026-10-17.md` |
| Registro sesión a sesión | `PROJECT_STATE.md` |
