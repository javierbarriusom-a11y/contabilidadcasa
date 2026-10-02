# Ola 2 · Medición con datos reales y recalibración de S2/S3

Fecha: 2 de octubre de 2026 (sesión 287). Estado: **decisión y diseño; no hay código nuevo.** Sustituye parcialmente a `docs/OLA2_SUELO_Y_DISPONIBLE.md` (§5, §6 y las entregas S2 y S3 de su §8). El resto de ese documento (el suelo sobre el total, los dos parámetros, los valores iniciales) sigue vigente.

**Este documento no contiene importes reales del hogar** (el repositorio es público). Solo porcentajes y hechos cualitativos. Los importes se comentaron en la conversación de la sesión y no se guardan aquí.

## 1. Qué se midió

El 2 de octubre de 2026 el hogar ejecutó el script de `BACKLOG_UX_OLAS.md` §8.6 con sus datos reales y completó la hoja de la sesión de 20 minutos.

| Medida | Resultado |
|---|---|
| `porcentajeEstimado` (parte de las salidas de los próximos 30 días con fecha de relleno) | **100 %** |
| Importe de salidas con fecha observada | **0** |
| Importe de salidas con fecha por regla | **0** |
| `elSignoDependeDelOrden` | `false` (las dos lecturas, «salidas primero» e «ingresos primero», dieron la **misma** cifra) |
| Fecha de los saldos que usó el cálculo | **27/9/2026**, es decir, **5 días** antes de la medición |
| Regla acordada antes de medir | Sí. Consulta ≤ 15 s; `porcentajeEstimado` bajo ≤ 25 %, alto ≥ **70 %** (el hogar subió el alto de 60 a 70) |
| Línea base: ¿encontraron la cifra «¿cuánto podemos gastar hasta cobrar?» | **No.** Ninguna de las dos personas, **ni quien opera**, la encontró bien en Hoy; las dos hicieron scroll buscándola. Las cifras no coinciden |
| Línea base: tiempos | **No se registraron** (los cronómetros no se usaron). No hay segundos; hay un «no se encontró» |
| Registrar un gasto | Se hizo a mano; sin tiempo registrado |
| Informe «Uso de la app» | Solo `alerts-center` con 0 aperturas en los dos móviles. El resto tiene aperturas, **posiblemente infladas por la propia sesión** (navegaron buscando la cifra) |

**Lectura con la regla acordada:** `porcentajeEstimado` ≥ 70 % → no construir S3 tal como está diseñado. El resultado no depende de si el umbral alto era 60 o 70. Para la Ola 2, «las cifras no coinciden» basta según la regla: **está justificada**; el matiz es que falta línea base con tiempos.

## 2. Por qué el 100 % es estructural y no se arregla con más datos

En `app.js` la fecha de cada salida del plan sale de `expenseTimingForRow`, con solo tres posibilidades:

1. **Por regla** (`isEndOfMonthExpenseRow`): únicamente tres etiquetas fijas (trastero, parking, psicólogo) van a fin de mes; el resto no tiene regla. Las nóminas sí tienen la suya, pero son ingresos.
2. **Observada** (`expenseTimingFromMovements`): solo si existe **un movimiento real del mismo mes** que case por etiqueta e importe, es decir, algo que **ya ocurrió**.
3. **Estimada**: cualquier otra salida cae en el **día 8** («estimación alisada 1-15»).

Consecuencias:

- **Una salida futura no puede ser «observada»**, porque su movimiento real aún no existe. En una ventana de 30 días hacia delante, la parte observada tiende a cero **por construcción**. Esto **corrige** lo anotado en `BACKLOG_UX_OLAS.md` §8.5 (D1b): importar extractos tres veces por semana mejora las fechas de lo que ya pasó, **no** las de lo que viene. No he encontrado en el código un día de cargo propio por partida del plan.
- **El «mínimo proyectado a 30 días» se convierte en una resta de calendario.** Con todas las salidas del mes amontonadas en el día 8, el punto más bajo es «ingresos que entran antes del día 8 menos todas las salidas del mes». La ventana de 30 días además puede terminar antes de la nómina de fin de mes. Es el mismo defecto que `BACKLOG_UX_OLAS.md` §2.3-7 diagnosticó para «hasta cobrar» (la cifra sube y baja con el calendario, no con el dinero), con otra forma.
- **Las «dos lecturas» (S-5) no cubren este caso.** Solo distinguen el orden dentro de un mismo día. Aquí daban la misma cifra y, aun así, la cifra era casi enteramente un supuesto de fecha.
- **Los saldos tenían 5 días.** El número se calculaba sobre una fotografía vieja y la pantalla no lo decía. Eso es la entrega S4.

## 3. Recalibración (decidida por Claude por delegación del hogar, 2/10/2026)

El hogar pidió «recalibrar el alcance de S2 y S3 a lo que Claude crea mejor». Criterio: **no mostrar una cifra cuya fiabilidad depende de un dato que la app no tiene**, y reutilizar lo que el motor ya calcula sin depender de fechas.

**El motor mensual (`canonical-engine.js`) ya proyecta la liquidez total de cada mes (`totalLiquidity`)** y no usa las fechas de la auditoría diaria. Es una previsión del plan, estable a lo largo del mes, que cambia cuando cambia el plan o lo registrado y no por el día del calendario.

| Pieza | Antes | Ahora |
|---|---|---|
| **S4** · frescura del dato | Última entrega, tras S3 | **Primera y sola**: «saldos del 27/9 · hace 5 días» pegado a la cifra, y aviso visible si es antiguo. No depende de ningún número nuevo |
| **S2** · suelo de liquidez | Entrega propia | **Se funde con S3′**: su único consumidor es la pantalla nueva. Mismo parámetro (1.500 €, sobre el total, parametrizable) y mismo mínimo operativo de CaixaBank sin tocar |
| **S3** · «Disponible» a 30 días | Mínimo proyectado a 30 días, módulo `canonical-home-verdict.js` v2, dos lecturas | **Cancelada tal como estaba.** Sustituida por **S3′** |
| **S3′** · margen de Hoy | — | Dos cifras que **no dependen del día de cargo de cada recibo** (ver abajo) |
| Módulo `canonical-home-verdict.js` / PR #416 | Aparcado para S3 | **Descartado.** PR #416 cerrado sin fusionar el 2/10/2026; la rama `claude/o2-1-home-verdict` se conserva solo como referencia |
| S-3 (horizonte fijo de 30 días) | Aprobada | **Sustituida** por el **mes natural**, que además coincide con la decisión del hogar de trabajar por mes natural |
| S-5 (dos lecturas con el motivo) | Aprobada | **Ya no aplica** (no hay lectura que dependa del orden) |
| S-4 (se llama «Disponible» con el suelo al lado) | Aprobada | **Se mantiene** |

### S3′ — el margen de Hoy

- **«Disponible hoy»** = saldo total (CaixaBank + Mediolanum) − suelo de liquidez. Es un hecho, no una previsión.
- **«Disponible a fin de mes (previsión)»** = liquidez total prevista a fin de mes por el motor mensual − suelo de liquidez.
- Etiqueta honesta junto a la segunda: «previsión del plan; no depende de qué día se cargue cada recibo».
- Un margen negativo se dice con su signo; nunca se recorta a 0.
- Se quitan los duplicados de las ocho cifras actuales (Liquidez hoy = Caja disponible, etc.) y se conserva el aviso S-2 (CaixaBank por debajo de su mínimo operativo).
- ~~**No lleva módulo de cálculo nuevo.**~~ **Corregido al construir (sesión 288):** lleva un módulo pequeño y puro, `canonical-home-margin.js` (`FinanceCanonicalHomeMargin.build`), con su prueba; no calcula el motor, solo resta el suelo y elige la fila. Con consumidor real desde el primer día, el guardián ARQ-3 pasa de 69 a 70. Reutiliza las filas del motor mensual tal cual y **no usa el motor diario**.

**Qué había que comprobar antes de construir, y qué se encontró (sesión 288):**
1. **¿La fila del motor mensual corresponde al mes en curso?** No siempre, y de ahí sale la regla final. El motor toma como mes de partida **el mes de la fecha de los saldos** (`modelStartIndex`) y le aplica el mes completo sobre ese saldo: probado con el motor real, con los saldos fechados el día 1, el 15 y el 28 la primera fila suma exactamente el mismo mes. **Pero** `forwardPlanningInfo` hace que, en modo manual y en ese mes de partida, **toda partida con un real registrado cuente 0** («Realizado · incluido en saldo»): la fila solo suma lo **pendiente de registrar**, no cuenta dos veces lo ya registrado. Consecuencias: (a) la fila de «a fin de mes» es la del **mes de hoy** (con saldos del 27/9 y hoy 2/10, la primera fila es septiembre y la que vale es octubre, que encadena el cierre de septiembre); (b) la cifra **da por hechos los reales registrados**: una partida que ya pasó, está en el saldo y no se registró como real se cuenta dos veces; una registrada después de la fecha del saldo sin actualizarlo se pierde. Es el límite de la cifra y la razón de que S4 vaya primero.
2. **¿Pasa por el motor diario?** No; una prueba lo vigila.
3. **Techo de `app.js` (37.495):** 37.373 → **37.413 líneas (+40)**; margen **82**. `test:load-budget` lo valida el CI del PR.

**Construido (sesión 288), decisiones de diseño tomadas por Claude por delegación, todas reversibles:**
- La ficha de margen es la **primera** de la rejilla de arriba de Hoy y sustituye a «Caja disponible»; la ficha «Liquidez hoy» de la rejilla de abajo **se retira** (repetía el mismo total). Su contenido útil pasó a la ficha nueva: edad del saldo (S4), aviso S-2 y la acción «Actualizar saldos». Motivo de ir la primera: medido en un móvil de 844 px de alto, detrás de «Presupuesto del mes» la segunda cifra quedaba cortada en el borde de la pantalla; la primera de la rejilla cabe entera.
- Parámetro nuevo, **suelo de liquidez**, en Ajustes › Reserva y colchón, distinto de la reserva operativa (que sigue siendo el mínimo de la cuenta operativa y no se toca). Vacío = valor inicial (1.500 €); el 0 escrito vale. Se persiste con `scenarioSettings` y se sincroniza como la reserva.
- El nombre del mes sale de la clave («a fin de octubre»): la etiqueta del motor, «oct 26», se leía como «26 de octubre».
- Aviso honesto en la ficha: «No ve bajadas intermedias antes de cobrar». Es lo que se pierde al no usar fechas.
- Un margen negativo se dice con su signo; sin saldo no hay cifra y se nombra cuál falta; sin fila para el mes de hoy (mes cerrado) se dice «sin previsión» y se sigue mostrando «hoy».

**Hecho cuando:** quien consulta encuentra la cifra en ≤ 15 s y las dos personas dicen la misma, medido **con tiempos** antes y después.

**Lo que se pierde, dicho:** el aviso de «bajaréis del suelo antes de cobrar» (el punto más bajo dentro del mes), que es justo lo que depende de las fechas. Se **aparca**, no se descarta: solo tiene sentido si se consiguen fechas reales.

### Aparcado: fechas reales para el futuro

Hipótesis, sin construir: **inferir el día de cargo de cada recibo desde los meses anteriores del histórico** de movimientos, para dar una fecha «recurrente» a las salidas futuras sin pedirle nada al hogar. Antes habría que medir cuántas partidas tienen histórico suficiente (un script de solo lectura, que se escribiría y probaría antes de pedir nada). Hasta entonces no se pide trabajo al hogar.

## 4. Riesgos de la recalibración

1. **La previsión a fin de mes depende de que el plan y lo registrado estén al día.** Si no, también falla; por eso S4 va primero y por eso se dice la edad del saldo.
2. **Premisa sin contrastar:** las decisiones las dio quien opera. Antes de fusionar S3′, que quien solo consulta lo pruebe dos minutos.
3. **Se cambia una decisión aprobada** (S-3, horizonte de 30 días) por delegación del hogar. Queda anotado para que pueda vetarse.

## 5. Regla de parada del plan de UX — versión 2 (propuesta de Claude; pendiente del OK del hogar)

El hogar aceptó «con ajustes» la regla de `BACKLOG_UX_OLAS.md` §8.4 y pidió que Claude propusiera los ajustes. Propuesta:

1. **Métrica y objetivo antes de construir** (se mantiene). Para Hoy: quien consulta dice la cifra en ≤ 15 s, las dos personas dicen la misma y nadie dice «no la encuentro».
2. **Línea base con tiempos obligatoria.** Sin segundos medidos no hay «antes». La del 2/10 no registró tiempos: se repite (2 minutos, 3 intentos de quien consulta) antes de la primera entrega visible.
3. **Qué cuenta como «mover la métrica»** (umbral numérico, ajustable por el hogar): bajar la mediana de quien consulta **al menos un 30 %**, o dejarla en ≤ 15 s.
4. **Parada:** dos entregas **visibles** seguidas sin mover la métrica detienen el plan de UX; el esfuerzo pasa a lo que pida el hogar.
5. **Tareas exentas** (no cuentan como entrega ni penalizan): corrección de errores de datos o de cálculo, refactorizaciones habilitantes (como S1), deuda de CI y rendimiento, accesibilidad.
6. **Evidencia antes de construir.** Toda entrega cuyo valor dependa de la calidad de los datos reales empieza con una medición con esos datos. Lección de esta sesión: la medición evitó construir dos entregas (S2 y S3) sobre un 100 % de fechas estimadas.
7. **Presupuesto:** como máximo dos entregas visibles de una ola antes de volver a medir con las dos personas.
8. **Reapertura tras una parada:** solo por petición del hogar, por un hallazgo de gravedad alta en la revisión mensual de Nielsen, o por una regresión de la línea base.
9. Sin informe de uso y sin línea base no se abre una ola nueva (se mantiene).

## 6. Pendientes

| Qué | Estado |
|---|---|
| Entrega **S4** (frescura del dato) | ✅ **Fusionada** el 2/10/2026 ([#425](https://github.com/javierbarriusom-a11y/contabilidadcasa/pull/425)) por orden del hogar |
| Entrega **S3′** (margen de Hoy) | ✅ **Fusionada** el 2/10/2026 ([#426](https://github.com/javierbarriusom-a11y/contabilidadcasa/pull/426)) por orden del hogar, sin prueba previa con sus datos |
| Línea base **con tiempos** de quien consulta | Sin hacer. S4 y S3′ se fusionaron por orden del hogar sin ella: el «antes» limpio ya no existe. **Se mide ahora el estado actual** (2 minutos, 3 intentos de quien consulta) y es lo que decide la re-medición con las dos personas |
| ¿Se actualizaron los saldos después del 27/9? ¿Está recogida la nómina del 30/9? | Sin respuesta |
| `alerts-center`: redirigir a Ajustes › Alertas | **Se deja de momento** (decisión del hogar, 2/10/2026) |
| OK del hogar a la regla de parada v2 (§5) | Pendiente |
| Veto o confirmación del cambio de horizonte (30 días → mes natural) | Pendiente |
| D3, D4, D5 (carta del mes, modo consulta, pliegue del detalle) | Sin contestar; no bloquean S4 |
