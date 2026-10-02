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

## 7. S5 — el titular, y las preguntas abiertas al hogar (2/10/2026, sesión 290)

**Supuesto de trabajo acordado con el hogar:** el tiempo de la línea base es **malo**. No hay segundos medidos; se parte de que el hogar no encontró la cifra (hecho registrado el 2/10) y de que el objetivo sigue siendo ≤ 15 s con las dos personas diciendo la misma cifra. Consecuencia: la mejora ya **no se puede cuantificar contra un «antes»**; solo cuenta la medición posterior a S5.

**Qué se hizo (S5), con lo medido y no con una corazonada.** A 390 px, con el aviso de primeros pasos descartado, antes de la ficha de margen hay **206 px** de cabecera común de la app (barra 70 + bloque «DATO REAL / LOCAL / Fuente» 120) y **319 px** de cabecera de Hoy (título 64, subtítulo 41, fila de avisos 88, controles 109): la ficha empezaba a 557 px y medía 250. Un iPhone con la barra de Safari ve unos 660 px útiles, así que solo asomaba el rótulo y la segunda cifra quedaba bajo el pliegue. Además había **dos cifras** compitiendo («hoy» y «a fin de mes»), y la causa más probable de «las cifras no coinciden» es que cada persona mire una distinta.
- **Un solo titular:** «Disponible para gastar» = el **menor** de los dos márgenes. Gastar X baja las dos cifras en X, así que el menor es lo que se puede gastar sin cruzar el suelo ni hoy ni a fin de mes (una prueba lo comprueba como propiedad). Las dos cifras pasan a una línea de apoyo. Se mantiene el nombre «Disponible» con el suelo al lado (S-4, aprobada).
- **Ficha más baja** (250 → 217 px) y **subtítulo de Hoy oculto en móvil** (41 px de texto que no dice nada que la pantalla no diga).
- **Resultado medido** (Chromium, datos de demostración): la ficha empieza a 517 px y la cifra termina en 576 px, dentro de los 664 px útiles de un iPhone con Safari y de los 844 de uno sin barras. **No basta** para un iPhone SE con Safari (553 px útiles: la cifra termina en 594). Lo que queda encima es cabecera común y controles, y decidirlo es del hogar (pregunta 12).
- **Lo que S5 no resuelve, dicho:** la cifra sigue dando por hechos los reales registrados y sigue sin ver bajadas intermedias antes de cobrar; el titular solo protege el fin de mes y hoy.

**Preguntas abiertas, consolidadas, con mi recomendación.** Las que condicionan lo demás van primero.

| # | Pregunta | Mi recomendación | Qué cambia según la respuesta |
|---|---|---|---|
| **Para medir** | | | |
| 1 | Con S4, S3′ y S5 ya en el sitio: ¿cuántos segundos tarda quien **solo consulta** en decir la cifra de «¿cuánto podemos gastar hasta cobrar?» (3 intentos, cronómetro) y la dicen igual las dos personas? | Medirlo una vez, **después** de S5 (el «antes» es el supuesto «malo») | Es lo único que dice si el plan de UX sigue o se detiene (regla de parada) |
| 2 | ¿Qué modelo de iPhone usa quien consulta? | — | Con un SE el titular no entra sin quitar cabecera; con un 13 o posterior sí |
| **Datos que condicionan la cifra** | | | |
| 3 | ¿Actualizasteis los saldos después del 27/9? ¿Está registrada la nómina del 30/9, y **como real**? | Actualizar saldos y registrar el real el mismo día | La cifra de fin de mes depende de ello |
| 4 | ¿Registráis cada gasto **como real el mismo día** que ocurre? | Sí; si no, el aviso de saldo antiguo es la única red | La cifra da por hechos los reales registrados: una partida pasada y no registrada se cuenta dos veces |
| **Decisiones de producto** | | | |
| 5 | ¿Queréis que el titular sea el **menor** de «hoy» y «a fin de mes»? | Sí (prudente; una sola cifra) | Alternativa: titular siempre «hoy» y fin de mes aparte (más alto, menos prudente) |
| 6 | **Regla de parada v2** (§5): ¿OK o ajustar umbrales (−30 % / ≤ 15 s / máx. 2 entregas visibles)? | OK. Nota: con S5 ya van **tres** entregas visibles sobre Hoy sin medir; propongo congelar Hoy hasta la medición | Sin su OK sigue siendo una propuesta mía |
| 7 | Mes natural como horizonte (sustituye a los 30 días): ¿confirmado? | Confirmado (ya construido en S3′) | Vetable; implicaría rehacer la fila elegida |
| 8 | Valores: suelo de liquidez **1.500 €** sobre el total y mínimo operativo de CaixaBank **1.500 €** | Mantener; revisar cuando haya un mes de uso | Parametrizables en Ajustes |
| 9 | Con un saldo de 4 o más días, ¿baja a «media» la **confianza** («high» hoy) que alimenta informes y asistente? | Sí | Hoy la ficha antigua ya no se ve, pero informes y asistente siguen diciendo «high» |
| 10 | Cierre de mes: mes natural, cierre entre el día 1 y el 3, con el saldo del último día (§8.5) | Confirmar; yo verifico en código que el cierre usa el saldo de fin de mes | Sin verificar |
| 11 | D3 «Carta del mes» (¿qué esperáis?), D4 modo consulta nivel 1, D5 pliegue del detalle en modo consulta | D3: **no construir** hasta que la definan; D4: sí (no protege); D5: sí (Hoy mide ~11.400 px en móvil) | No bloquean nada |
| 12 | El bloque «DATO REAL / LOCAL / Fuente» ocupa 120 px en **cada** pantalla del móvil, y los controles de Hoy 109 px: ¿se pueden compactar o plegar en móvil? | Plegar el bloque de sincronización a una línea; dejar «Registrar gasto» | Es lo que más pesa antes de la cifra |
| **Calendario y aparcados** | | | |
| 13 | Revisión mensual de Nielsen (**16/10**) y reevaluación de `OPT-10`–`OPT-13` (**23/10**): ¿hay uso intenso que contar? | Traer el informe de uso | Decide si se desaplazan |
| 14 | Idea aparcada: inferir el día de cargo de cada recibo desde el histórico. ¿Queréis el script de viabilidad (solo lectura)? | Sí, cuando haya ≥ 3 meses de movimientos importados; no antes | Es lo único que recuperaría el aviso «bajaréis del suelo antes de cobrar» |
| — | `alerts-center`: redirigir a Ajustes › Alertas | **Se deja** (decisión del hogar, 2/10) | Si se retoma, antes verificar que Ajustes › Alertas cubre todos los umbrales |

## 8. Respuestas del hogar a las 14 preguntas (2/10/2026, 15:21–15:27 UTC) y qué implican

Contestaron las dos personas a través de la hoja de preguntas (artefacto de Claude, almacén privado). Aquí solo constan hechos y decisiones; **ninguna cifra de dinero**.

| # | Respuesta | Consecuencia |
|---|---|---|
| 1 · medición (quien consulta) | **30, 28 y 20 s**; «no la encontró» | **No cumple el objetivo (≤ 15 s con la misma cifra)**. Ver §8.1 |
| 2 · móvil (quien consulta) | iPhone Plus o Pro Max | La ficha de margen **cabe entera sin scroll** (≈ 760 px útiles en Safari frente a 735 que ocupa): el scroll **no** explica «no la encontró» |
| 3 · saldos y nómina (quien opera) | Saldos **sin actualizar desde el 27/9**; nómina del 30/9: **«no lo sé»** | La cifra se calcula sobre una foto vieja y la ficha ya lo avisa («Actualizar saldos»). **Acción del hogar:** actualizar saldos y comprobar si la nómina del 30/9 está como real |
| 4 · reales (quien opera) | «Casi siempre, en 1 o 2 días»; «intento llevarlo al día, pero no siempre puedo» | La cifra de fin de mes puede estar desfasada por partidas sin registrar; el aviso de saldo antiguo es la única red |
| 5 · titular = el menor | **Sí** (las dos personas) | Sin cambios |
| 6 · regla de parada v2 | **OK tal cual** (las dos personas) | **Vigente**. Ver §8.2 |
| 7 · mes natural | **Confirmado** (las dos personas) | Sin cambios |
| 8 · suelo y mínimo | **Mantener los dos** (1.500 € cada uno) | Sin cambios |
| 9 · confianza con saldo antiguo | **Sí, a «media» desde los 4 días** (las dos personas) | **Hecho** en esta entrega: `confidence` de la liquidez pasa de «high» a «medium» con saldo declarado de ≥ 4 días (mismo umbral que el aviso de la ficha); lo verifica una prueba y el navegador real |
| 10 · cierre de mes | **Confirmado** (mes natural, cierre entre el día 1 y el 3, saldo del último día) | **Pendiente de Claude:** verificar en el código que el cierre usa el saldo de fin de mes |
| 11 · D3 carta del mes | **La quieren; alcance delegado en Claude** («el mejor alcance») | Ver §8.3 |
| 11 · D4 modo consulta / D5 plegar el detalle | **Sí / Sí** (quien opera); **quien consulta no contestó** | Falta la respuesta de quien consulta: es su modo |
| 12 · cabecera del móvil (quien consulta) | Plegar solo el bloque «DATO REAL / LOCAL / Fuente» a una línea | Aprobado, **no construido todavía** (ver §8.2) |
| 13 · Nielsen y `OPT-10`–`OPT-13` | **No hay uso intenso todavía** (las dos personas) | `OPT-10`–`OPT-13` siguen aplazadas; la revisión de Nielsen del 16/10 se hace sin informe de uso |
| 14 · script de viabilidad | **Sí, cuando haya al menos 3 meses de movimientos** | Aparcado hasta entonces |

### 8.1 «No la encontró» tras 20–30 s: lo que se sabe y lo que no

La medición tiene un solo dato por intento (segundos) y una etiqueta («no la encontró»): no dice **qué** miró ni **qué versión** vio. Hipótesis, de más a menos probable con lo medido:
1. **Versión vista.** El service worker sirve **primero la copia en caché** y baja la nueva en segundo plano: tras cada despliegue, la primera apertura en el móvil muestra la versión anterior y la nueva aparece en la siguiente carga (S5 estaba desplegada desde las 13:45 UTC y se contestó hacia las 15:25). La etiqueta de la primera ficha lo distingue: «Disponible para gastar» = S5; «Disponible hoy» = S3′; «Caja disponible» = anterior.
2. **Carga.** El cronómetro empieza al abrir la app. Medido en móvil emulado lento (CPU 4×, 1,6 Mbps): la cifra de Hoy tarda **4,5 s en una visita repetida y 9,6 s en la primera tras un despliegue**. Un iPhone Pro Max va mucho más rápido, pero parte de los 20–30 s no es «encontrar».
3. **Saldo de hace días.** Con el saldo del 27/9 la ficha lleva el aviso de antigüedad, y el margen puede salir en negativo o llamativo; puede leerse como «no es la cifra».
4. **Vocabulario.** La pregunta es «¿cuánto podemos gastar **hasta cobrar**?» y la ficha dice «Disponible para gastar … a fin de octubre».
5. **Descartada: el scroll.** Con un Plus/Pro Max la ficha entera cabe sin hacerlo.

**Preguntas para discriminar** (una por hipótesis; no son un cuestionario nuevo): ¿qué decía la primera ficha, con sus palabras? ¿qué cifra dijo cada persona (en el chat, no en el repositorio)? ¿abrís la app desde el icono de la pantalla de inicio o desde Safari? ¿el cronómetro contó la carga?

### 8.2 La regla de parada v2, aprobada, aplicada

- **Se cumple lo que prohibía:** van **tres** entregas visibles sobre Hoy (S4, S3′, S5) cuando el máximo es dos, y la medición posterior **no alcanza el objetivo** (mediana 28 s, «no la encontró»). Como el «antes» fue el supuesto «malo», no se puede comprobar el −30 %; sí el objetivo absoluto, y no se cumple.
- **Lo que dice la regla para seguir:** solo por petición del hogar, gravedad alta en Nielsen o regresión de la línea base. **El hogar ha pedido** la carta del mes (P11) y plegar el bloque de sincronización (P12), así que se pueden construir; pero **no se construye nada más sobre Hoy** hasta contestar §8.1: sin saber qué falla, otra entrega visible es ajustar a ciegas. Una excepción razonable: P12 es barato y lo pidió quien consulta; con un Plus/Pro Max **no** arregla «no la encontró» y se hará, si se hace, como mejora general de móvil y no como arreglo de esta métrica.
- **Exentas por la propia regla** (no cuentan): errores de datos o de cálculo, refactorizaciones habilitantes, deuda de CI y rendimiento, accesibilidad. P9 está en ese grupo.

### 8.3 Carta del mes: alcance (decidido por Claude por delegación, vetable)

Un **párrafo en lenguaje llano, determinista (sin IA generativa)**, generado con cifras que la app ya calcula, y **en Cierre de mes, no en Hoy**: Hoy ya mide unos 11.400 px en móvil y un párrafo más contradice el objetivo de encontrar una cifra rápido. Contenido: cómo cierra el mes (margen), cuánto se desvió el gasto del previsto (en %), qué queda de deuda, y lo próximo que viene. Sin importes que no estén ya en pantalla. **No se construye hasta** contestar §8.1 y tener un informe de uso (el hogar dice que aún no hay uso intenso: sin uso, es una pieza más que nadie abrirá).

### 8.4 Qué falta del hogar

1. Las cuatro respuestas de §8.1.
2. Que **quien consulta** conteste D4 y D5 (modo consulta; plegar el detalle).
3. **Actualizar los saldos** y comprobar la nómina del 30/9 antes de la siguiente medición: sin eso se mide la cifra sobre una foto de hace días.
4. Repetir la medición **una vez** con la app recargada y los saldos al día, apuntando también qué miró.

