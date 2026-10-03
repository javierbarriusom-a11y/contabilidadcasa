# Sexta auditoría crítica — revisión de la quinta, del artefacto de la Ola 2 y 45 propuestas nuevas

Fecha: 3 de octubre de 2026 (sesión 294). Estado: **triaje respondido el 3/10/2026**; respuestas, contradicciones y orden resultante en `BACKLOG_INICIO_OLEADA_OCTUBRE.md` §15.4-§15.5. Este documento queda como catálogo y razonamiento; lo que manda es el backlog.
**Este documento no contiene importes reales del hogar** (el repositorio es público): solo porcentajes, segundos medidos y hechos cualitativos.

Encargo: analizar críticamente el artefacto «Preguntas de la Ola 2» y el backlog que salió de la sesión anterior (quinta auditoría y su plan), mejorarlos, y proponer **más de 40 funcionalidades nuevas, adicionales a las existentes**, con profundidad en previsión y actualización de datos, inversión y deuda actual y nueva, con buenas prácticas de UX/UI.

**Cómo está hecho.** Leí las 20 respuestas guardadas en el almacén del artefacto, `docs/PROPUESTA_QUINTA_AUDITORIA_2026-10-02.md` (59 propuestas), `docs/PLAN_IMPLEMENTACION_2026-10-03.md` (22 paquetes), `BACKLOG_INICIO_OLEADA_OCTUBRE.md`, `docs/OLA2_RECALIBRACION.md` y `PROJECT_STATE.md` (sesiones 288-293). Extraje los **834 títulos de funcionalidad** de todos los `BACKLOG*.md` y crucé cada idea candidata contra ellos y contra el código (`app.js`, `canonical-*.js`, `views/*.js`). **Descarté 14 ideas que ya existían** (§9). **No he ejecutado la app** ni visto los contadores de uso (viven en cada móvil). Lo que depende de terceros o de normativa está marcado *verificar* (§11).

**Etiquetas** (mismas que la quinta, para que se puedan mezclar):
- Evidencia: **[M]** medido en el hogar · **[C]** verificado en código o documentación · **[H]** hipótesis o buena práctica sin evidencia propia.
- Puerta frente a la regla de parada v2: **E** exenta (datos, cálculo, habilitadora, CI, accesibilidad) · **V** visible (cuenta en el cupo de dos por ola) · **T** depende de un tercero · **H** toca Hoy (congelada) · **X** fuera de la app (Atajos de iOS, correo, calendario: no cambia ninguna pantalla).
- Esfuerzo: S ≤ 1 sesión · M 2-3 · L 4+. Valor: Crítico / Alto / Medio / Bajo.
- **Nuevo en esta auditoría — dos columnas que la quinta no tenía:**
  - **Δ min/sem del operador**: minutos por semana que la propuesta **añade (+) o quita (−)** a quien opera. Es la restricción que más pesa (§1).
  - **Palanca €**: de dónde sale el dinero que la propuesta puede ahorrar o proteger (intereses, impuestos, comisiones, errores). Sin importes: solo el mecanismo.

---

## 0. Veredicto en diez líneas

1. **El problema principal ya no es de diseño de Hoy: es de adopción.** Las dos personas contestaron «no hay uso intenso todavía» (P13). Con 59 pantallas, ~70 motores y 5.008 pruebas, una app que no se usa a diario es un coste, no un activo.
2. **Quien opera es el cuello de botella, y la quinta le añade trabajo.** Saldos sin actualizar del 27/9 al 2/10, «la nómina del 30/9: no lo sé», «intento llevarlo al día, pero no siempre puedo» (P3, P4). La cola aprobada suma tareas manuales (alta del día de cargo, hoja de valoración, cierre con saldo, cuadre) y ninguna quita trabajo de forma estructural.
3. **La medición de los 30/28/20 s se hizo con datos de hace 5 días.** Con saldos viejos, «no la encontró» puede ser «no me la creí». La línea base no es válida hasta repetirla con datos frescos (GOV-05).
4. **El móvil de quien consulta es un Plus/Pro Max (P2):** la ficha cabe sin scroll. La razón de `NXP-03` (recuperar 120 px) **no aplica a este hogar**; queda como estética, no como arreglo.
5. **Las decisiones se están delegando, no tomando.** En el artefacto, casi todas las respuestas coinciden con la opción marcada «Recomienda Claude», y la quinta se aprobó con un «ok a todo con tus sugerencias» (12 de 12). Es una señal de confianza, pero también de **anclaje**: el producto corre el riesgo de ser el de Claude, no el del hogar (GOV-04).
6. **La mayor palanca nueva es la captura pasiva**, que la quinta no contempla: iOS 17+ tiene una automatización «Transacción» que se dispara con cada pago con Apple Pay y entrega comercio e importe, **sin código nativo ni banco** (CAP-01). Es la única vía que baja los minutos del operador sin esperar a PSD2.
7. **Falta el criterio del dinero.** La quinta prioriza la verdad del dato (bien), pero ninguna propuesta se ordena por euros ahorrados. Hay palancas con fecha límite real: **31/12 para el plan de pensiones y la compensación de minusvalías** (FIS-01), y la comprobación de que el banco cobra la cuota pactada (DAC-05).
8. **Para quien consulta, la mejor pantalla puede ser ninguna:** un Atajo de Siri que diga la cifra y su edad sin abrir la app (UXS-01) ataca la métrica fallida sin tocar Hoy, que sigue congelado.
9. **Entrego 45 propuestas nuevas, pero recomiendo construir 8** en 90 días (§8) y convertir 3 en simples decisiones del hogar. El catálogo de seis auditorías ya supera las 300 ideas: el límite es la superficie, no la imaginación.
10. **Propongo seis reglas de gobierno** (§6), la más importante: **presupuesto de minutos del operador ≤ 10 min/semana**, con cada propuesta declarando su Δ. Si una entrega lo sube, tiene que traer otra que lo baje.

---

## 1. Lo que dicen de verdad las respuestas del artefacto

El artefacto guardó 20 respuestas (8 de quien opera, 9 de quien consulta, más las compartidas). Lectura crítica, pregunta a pregunta, de lo que **sí** aporta información:

| Pregunta | Respuesta | Lo que significa | Consecuencia para el plan |
|---|---|---|---|
| P1 medición | 30, 28, 20 s · «no la encontró» | La métrica falla… | …pero con saldos de 5 días (P3). **Línea base contaminada**: repetir tras H2 (GOV-05) |
| P2 móvil | iPhone Plus/Pro Max | La ficha cabe entera | `NXP-03`/P12 baja de «arreglo» a «estética». No es la causa |
| P3 saldos y nómina | «No desde el 27/9» · «No lo sé» | El dato envejece en días, no en semanas | Prioridad absoluta a **bajar el coste de actualizar** (bloque A) |
| P4 reales | «Casi siempre, en 1 o 2 días» + nota «no siempre puedo» | La captura manual ya está en su límite | Cualquier propuesta con Δ min/sem positivo es sospechosa |
| P5-P7, P9 | Todas = recomendación | Acuerdo, o delegación | No hay señal para distinguirlo: en adelante, respuesta **a ciegas** (GOV-04) |
| P11 | Las dos quieren la carta del mes · notas «El mejor alcance» / «El alcance que creas mejor» | Lo único que **ambas personas piden activamente** | La carta del mes (`NHG-05`) merece subir; depende de `NPV-03` (WP-09), ya en cola |
| P12 | Plegar solo el bloque de procedencia | Preferencia estética | Coherente con el punto P2 |
| P13 | Las dos: «no hay uso intenso todavía» | **El hallazgo más importante** | Falta una métrica de adopción (UXS-04). Retirar pantallas sin uso sigue siendo prematuro (Q10, correcto) |
| P14 | Script de día de cargo con ≥ 3 meses | Prudente | Sin cambios |

**Conclusión:** las respuestas apuntan a una app que **se mantiene con esfuerzo y se consulta poco**. Esa es la hipótesis de trabajo de esta auditoría. Cada propuesta se juzga por si (a) baja el esfuerzo de mantenerla, (b) da un motivo para abrirla, o (c) ahorra dinero con evidencia. Lo que no hace ninguna de las tres, no entra.

---

## 2. Crítica del artefacto «Preguntas de la Ola 2»

### 2.1 Lo que está muy bien (y conviene repetir)
- **Roles separados con almacén compartido**: cada persona responde por su cuenta y ve la respuesta de la otra. Es la mecánica correcta para un hogar con quien opera y quien consulta.
- **Funciona sin conexión** (resumen copiable) y dice el estado de guardado («Guardado para Claude»), con contraste y foco visibles, objetivos de 44 px y modo oscuro.
- **Cada pregunta trae el «por qué»**: el hogar decide sabiendo lo que se juega.
- **Privacidad explícita**: avisa de que las cifras no van al repositorio.

### 2.2 Lo que corregiría
| # | Problema | Por qué importa | Mejora |
|---|---|---|---|
| A1 | **La opción recomendada va marcada antes de responder** («Recomienda Claude») | Anclaje: casi todas las respuestas coinciden con la marca. No se distingue acuerdo de delegación | **Respuesta a ciegas**: se responde primero; la recomendación aparece después, con opción de cambiar. Así se mide cuántas veces cambia la respuesta |
| A2 | **La medición (P1) no registra el estado del dato** | Se midió con saldos de 5 días sin que el formulario lo supiera | Pedir, junto a los segundos, la **fecha del último saldo** y si la app se abrió desde el icono o desde Safari. Mejor aún: que la mida la app (`NXP-01`) |
| A3 | **Mezcla hechos y preferencias** con el mismo formato | Un hecho («¿qué móvil?») no admite recomendación; una preferencia sí | Dos tipos de tarjeta: **Hecho** (sin recomendación, con «No lo sé») y **Decisión** (con recomendación tras responder) |
| A4 | **La nota está plegada** | Solo hubo 3 notas en 20 respuestas, dos de ellas «el alcance que creas mejor» | Para las decisiones, una pregunta obligatoria de una línea: «¿Qué te haría cambiar de opinión?» |
| A5 | **No tiene estado de cierre** | El 3/10 sigue diciendo «Catorce preguntas abiertas» cuando están todas contestadas y P9 ya está construida | Estado por pregunta: abierta · contestada · **decidida** (con fecha y enlace al PR). Un artefacto de decisiones debe poder envejecer bien |
| A6 | **No pregunta por el uso real** salvo en P13, al final | Es la pregunta que más cambia el plan | Abrir con dos preguntas de uso: «¿Cuántos días de la última semana la abriste?» y «¿Para qué la abriste la última vez?» |
| A7 | **No pide el coste del operador** | Nadie sabe cuántos minutos por semana cuesta mantenerla | Pregunta de hecho: «¿Cuántos minutos dedicaste a la app la semana pasada?» (línea base de GOV-01) |

**Mejora entregada:** un artefacto nuevo de triaje de esta auditoría (**«Triaje sexta auditoría»**, privado, fuera del repositorio) que aplica A1, A3, A5 y A6: cada persona marca **Sí / Más tarde / No** a ciegas en cada propuesta; la recomendación se ve después, y queda registrado si la respuesta cambió.

---

## 3. Crítica de la quinta auditoría y de su plan

La quinta es un trabajo serio: diagnostica bien la **pobreza de la entrada** (D2, D3), detecta un hueco funcional real (no se puede actualizar el valor de una posición, `NIN-02`) y propone medir dentro de la app. **Mantengo el 80 % de su cola.** Lo que cambiaría:

| # | Crítica | Evidencia | Propuesta |
|---|---|---|---|
| Q-1 | **No mide la adopción.** Sus métricas (segundos hasta la cifra, % de fechas declaradas, cobertura P10-P90) son de calidad del dato; ninguna dice si el hogar usa la app | P13: «no hay uso intenso» en las dos personas | Añadir una métrica principal de adopción (UXS-04): días activos por semana por persona, y frescura media de los saldos |
| Q-2 | **Aumenta la carga del operador.** WP-08 (30 min de alta), WP-09 (saldo en el cierre), WP-15 (valoración manual), ND-01 (cuadre): todo es trabajo de quien ya no llega | P3, P4 | Presupuesto de minutos (GOV-01) y priorizar la captura pasiva (CAP-01, CAP-02, CAP-03) **antes** de pedir más datos |
| Q-3 | **PSD2 es la única vía de automatización que contempla**, y es la más cara (proveedor, consentimiento cada 180 días, superficie de ataque) | `ND-13` | Que el spike de WP-05 compare PSD2 con Apple Pay + Atajos (CAP-01) y con avisos del banco (CAP-03) en la misma matriz |
| Q-4 | **`NXP-03` se justifica con 120 px que en un Pro Max no faltan** | P2 y `docs/OLA2_RECALIBRACION.md` §8 | Bajar `NXP-03` a catálogo: no arregla la métrica de este hogar |
| Q-5 | **Ningún paquete tiene fecha límite externa**, y hay dinero con fecha: 31/12 (plan de pensiones, minusvalías, donativos) | Calendario fiscal | Insertar FIS-01 antes del 15/11 |
| Q-6 | **La línea base de WP-02 hereda el defecto de P1** (dato viejo) | P1 + P3 | WP-02 solo vale si el saldo tiene ≤ 1 día; la app debe registrarlo y descartar la medición si no (GOV-05) |
| Q-7 | **Diseña para quien consulta dentro de Hoy**, cuando quizá su mejor interfaz sea fuera de la app | P13 + métrica fallida | Probar UXS-01 (Siri) como experimento paralelo: no toca Hoy |
| Q-8 | **Inversión y deuda se miran como cálculo, no como conducta.** El riesgo real de un hogar inversor no es la fórmula, es vender en una caída o no cumplir el plan | Literatura de finanzas conductuales; `I12` (convicción) ya apunta ahí | CAR-01 (política de inversión firmada) y CAR-02 (panel de calma). La política debe ser la fuente de las reglas de `NIN-01` |
| Q-9 | **Dice «construir ≤ 10» pero deja 22 paquetes hasta abril** con su calendario | Plan §3 | Coherente si cada tramo se cierra por métrica; añado la regla «uno entra, uno sale» (GOV-02) para que el catálogo no siga creciendo |

---

## 4. Principios de diseño de esta auditoría (además de los 12 de la quinta, que mantengo)

1. **Cero teclado por defecto.** El dato debe llegar solo (pago, aviso, extracto, documento); el hogar **confirma**. Teclear es la excepción. Apple HIG: reducir la entrada de texto; Nielsen 6: reconocer antes que recordar.
2. **La app pregunta solo cuando la respuesta cambia una decisión.** Un recordatorio que no mueve ninguna cifra relevante es ruido (CAP-07, CAP-09).
3. **Cada cifra dice cuánto vale saberla.** El orden de las tareas de datos se decide por los euros de incertidumbre que eliminan por minuto de esfuerzo (CAP-07).
4. **Decidir en frío, actuar en caliente.** Las reglas se acuerdan en calma (política de inversión, planes de contingencia, acuerdos del hogar); en el momento difícil la app enseña lo acordado, no un número rojo (CAR-01, CAR-02, PRV-05, HOG-01).
5. **Fuera de la app también es producto.** Siri, Atajos, correo y calendario son superficies válidas y baratas: no consumen cupo de Hoy ni líneas de `app.js`.
6. **Nada se ejecuta solo** (`A11-4` sigue mandando): toda captura pasiva entra en la **bandeja como pendiente**, nunca en el libro.
7. **Una fecha límite real gana a una buena idea.** Lo que tiene plazo externo (fiscal, contractual) se ordena antes.

**Patrones de interfaz que propongo como estándar para todo lo nuevo:**
- **Tarjeta de bandeja** (un solo componente para todo lo que llega solo): título con el hecho («Pago en [comercio] · X €»), origen con icono y texto (Apple Pay / aviso del banco / extracto), propuesta de partida con su confianza, y tres acciones: **Confirmar** (primaria, zona del pulgar), **Cambiar**, **Descartar**. Deshacer durante 8 s. Nunca un modal.
- **Hoja inferior de confirmación** (`max-height: 85dvh`, `env(safe-area-inset-bottom)`), con el importe en `tabular-nums` y el teclado `inputmode="decimal"` solo si se pulsa «Cambiar».
- **Formato del efecto de una decisión**: siempre en dos cifras, «−X € de intereses · −N meses», con signo explícito y unidad; el estado nunca solo por color (WCAG 1.4.1).
- **Chip de procedencia** en cada dato que llega solo: «Apple Pay · hoy 13:02», «BCE · septiembre», «Nómina PDF · 30/9».

---

## 5. Catálogo: 45 propuestas nuevas

> Formato: **ID · título** [evidencia] · esfuerzo · valor · puerta · **Δ min/sem** · **palanca €**. *Qué · Por qué (y por qué no existe ya) · UX/UI · Dependencias y riesgos · Éxito.*

### Bloque A — Captura pasiva y actualización sin esfuerzo (`CAP`, 10)

**CAP-01 · Pagos con Apple Pay registrados solos (automatización «Transacción» de Atajos)** [M][C] · S (nivel 1) / M (nivel 2) · **Crítico** · X (nivel 1) / T (nivel 2) · **Δ −15 a −30** · palanca: datos frescos, menos dobles cuentas
- *Qué:* iOS 17+ permite una automatización personal que se dispara al pagar con una tarjeta de Wallet y recibe **comercio, importe y tarjeta**, y puede ejecutarse **sin confirmación**. Dos niveles:
  - **Nivel 1 (sin servidor):** el Atajo abre `…/#registrar?importe=…&comercio=…&tarjeta=…&origen=applepay` (contrato de CAP-02). La app muestra la hoja de confirmación prerrellenada con la partida sugerida por las reglas existentes (`mappingForMovement`); un toque y listo. Cero backend, cero secreto.
  - **Nivel 2 (silencioso):** el Atajo hace un `POST` a una Edge Function privada (ya existe `supabase/functions`) con un token personal; el pago queda en la bandeja E11b **pendiente de confirmar**, sin abrir nada. Se confirma en lote al abrir la app.
- *Por qué:* es la única vía de automatización **sin proveedor PSD2**, sin coste y disponible hoy en los dos iPhone. No existe nada parecido en el código (búsqueda de «Wallet», «Apple Pay»: sin resultados).
- *UX/UI:* plantilla del Atajo descargable desde Ajustes › Datos con un vídeo de 30 s; en la bandeja, chip «Apple Pay» y agrupación «4 pagos de hoy · Confirmar todos» (con revisión de cada uno a un toque).
- *Riesgos:* solo cubre pagos con el móvil o el reloj (no tarjeta física, no domiciliaciones, no transferencias); importes en divisa; el nivel 2 abre superficie de ataque → **`NTC-06` antes**. Doble captura con el extracto → CAP-10.
- *Éxito:* ≥ 60 % de los pagos con tarjeta capturados en < 1 h; Δ min/sem del operador medido con UXS-03.

**CAP-02 · Contrato de URL de captura prellenada** [C] · S · Alto · E (habilitadora) · **Δ 0 (habilita las demás)** · palanca: ninguna directa
- *Qué:* un contrato estable y probado de enlaces profundos (`#registrar?importe=&concepto=&fecha=&cuenta=&origen=`) con validación (importe con coma o punto vía `parseAmount`, fecha ISO o «hoy»), que **nunca guarda solo**: abre la hoja de confirmación. Lo usan CAP-01, CAP-03, CAP-08, UXS-01 y cualquier Atajo futuro.
- *Por qué:* hoy no hay forma de entrar a la app con datos ya rellenos; cada canal externo inventaría la suya.
- *UX/UI:* si un parámetro no es válido, la hoja lo dice en el campo («importe no reconocido: "12,3,4"»), nunca falla en silencio.
- *Riesgo:* un enlace manipulado podría proponer un gasto falso → por eso nunca guarda sin confirmación. *Éxito:* pruebas de contrato con 30 casos (válidos, malformados, inyección de HTML).

**CAP-03 · Avisos del banco (SMS o correo) convertidos en pendientes** [H] · M · Alto · T · **Δ −10 a −20** · palanca: cubre domiciliaciones y tarjeta física
- *Qué:* dos rutas, a elegir según lo que ofrezca cada banco (*verificar* qué avisos envían CaixaBank y Banca Mediolanum): (a) automatización de iOS «Mensaje recibido de [remitente del banco]» que pasa el texto a CAP-02/Edge Function; (b) un filtro del correo que reenvía los avisos a una dirección de entrada privada. Un analizador por banco (expresiones con pruebas de oro) extrae importe, comercio y fecha.
- *Por qué:* cubre lo que CAP-01 no ve (tarjeta física, recibos, transferencias recibidas, **la nómina**). Responde directamente al «la nómina del 30/9: no lo sé».
- *Riesgos:* formatos que cambian sin aviso (el analizador debe fallar a «pendiente sin clasificar», no a un importe erróneo); privacidad del texto (se descarta tras extraer, `rawStored: false` como en E9). `NTC-06` antes.
- *Éxito:* la nómina aparece como pendiente el mismo día en 3 meses seguidos.

**CAP-04 · Saldo desde una captura de pantalla del banco** [C][H] · M · Medio-Alto · V · **Δ −3 a −5** · palanca: frescura del saldo
- *Qué:* compartir o subir la captura de la pantalla de saldos de la app del banco; el OCR que ya existe (Tesseract.js bajo demanda, `canonical-receipt-ocr.js`, A17-3) se reutiliza con un extractor nuevo de «nombre de cuenta + saldo»; la app propone «CaixaBank → X · Mediolanum → Y» para confirmar.
- *Por qué:* la quinta (`ND-01`) propone confirmar un saldo **esperado**; esto da el saldo **real** sin teclear. Juntas, actualizar dos cuentas pasa a ser «captura → Coincide».
- *Riesgos:* el OCR confunde dígitos → mostrar siempre la imagen recortada junto a la cifra; si la confianza es baja, el campo queda vacío (mismo criterio `calculable: false` de A17-3). La imagen no se guarda.
- *Éxito:* actualizar saldos ≤ 15 s (métrica de la quinta: ≤ 20 s).

**CAP-05 · Lector de la nómina en PDF** [C] · M · Alto · E (alimenta datos existentes) · **Δ −5/mes** · palanca: Renta mejor estimada, retención vigilada
- *Qué:* subir el PDF de la nómina (o su captura, vía OCR) y extraer **líquido, bruto, retención de IRPF (%) y cotizaciones**; crea el real del ingreso, acumula retenciones para el estimador de Renta (`estimateIrpfResult`, hoy con `irpfWithholdingsPaid` tecleado) y **avisa si cambia el % de retención** («la retención bajó del A % al B % este mes»).
- *Por qué:* `NPV-11` de la quinta calcula retenciones desde nóminas registradas × retención declarada; este lector hace que la retención **no se declare**, se lea. No existe lector de nóminas (búsqueda de «payslip», «nómina PDF»: nada).
- *Riesgos:* cada empresa tiene su formato; se necesita una plantilla por pagador (son dos). Requiere una librería de PDF cargada bajo demanda (*verificar* tamaño y licencia; alternativa: solo captura + OCR). Ningún PDF se guarda.
- *Éxito:* retenciones acumuladas sin teclear; error de la estimación de Renta < 10 % (medible en junio).

**CAP-06 · Cargos esperados que no llegaron** [C] · S-M · Alto · E · **Δ 0** · palanca: protege pólizas y evita doble cuenta en la previsión
- *Qué:* simétrico de `ND-08` (ingresos), para **salidas**: si un recibo recurrente (detectado por A16-3 o declarado en el plan) no aparece dentro de su ventana + 3 días, la bandeja pregunta: «El seguro del coche suele cargarse el día 5 y no ha llegado. ¿Se ha dado de baja · ha cambiado de cuenta · llegará tarde · ya lo pagasteis de otra forma?».
- *Por qué:* un recibo que no llega es o un riesgo (póliza impagada que se anula, domiciliación rota) o un error de previsión (se sigue restando una salida que no ocurrirá). Nada lo vigila hoy (búsqueda de «cargo esperado»: nada).
- *UX/UI:* tarjeta de bandeja con el historial del recibo (6 últimos cargos con fecha) para que se vea el patrón.
- *Éxito:* cero pólizas impagadas sin aviso; la previsión deja de contar recibos dados de baja.

**CAP-07 · Cola de mantenimiento ordenada por «euros de incertidumbre por minuto»** [C][H] · M · Alto · V (fuera de Hoy) · **Δ −5 (por priorizar)** · palanca: el esfuerzo va donde más cambia la cifra
- *Qué:* una sola lista «Tareas de datos» donde cada tarea (actualizar un saldo, confirmar 6 pendientes, declarar un día de cargo, valorar la cartera) lleva **cuánto mueve la cifra que importa** y **cuánto cuesta**: «Actualizar CaixaBank · 20 s · la cifra de fin de mes puede moverse ±X €». Ordenada por valor/minuto; arriba, «Con 3 minutos hoy, la cifra pasa de confianza media a alta».
- *Por qué:* `ND-09` (frescura por fuente) dice **qué** está viejo, no **qué importa más**. Con un operador sin tiempo, el orden lo es todo. La sensibilidad ya se calcula (`canonical-forecast-sensitivity.js`); falta convertirla en cola.
- *UX/UI:* presupuesto visible arriba («Esta semana: 4 de 10 min»); cada tarea con su tiempo estimado medido (UXS-03), no inventado; estado vacío «Todo al día · próxima tarea útil el jueves».
- *Éxito:* el 80 % del error de previsión atribuible a datos viejos se elimina con ≤ 5 min/semana.

**CAP-08 · Captura desde el móvil de quien consulta, como propuesta** [M] · S · Medio-Alto · X · **Δ −5 a −10** · palanca: reparte la carga sin control de acceso
- *Qué:* el mismo Atajo de CAP-01 en el iPhone de quien consulta, con `origen=consulta`: sus pagos entran en la bandeja como **«propuesto por [persona]»** para que quien opera los confirme en lote. No hay permisos nuevos: es un canal, no un rol (respeta `OPT22`).
- *Por qué:* la mitad de los gastos del hogar los hace la persona que no registra nada; hoy quien opera tiene que reconstruirlos del extracto días después.
- *Riesgo:* duplicados con el extracto → CAP-10. *Éxito:* ≥ 50 % de los pagos de quien consulta llegan solos.

**CAP-09 · Recordatorio en el momento de máximo valor** [C][H] · S · Alto · X · **Δ −3** · palanca: frescura justo antes de decidir
- *Qué:* sustituir el recordatorio fijo de `ND-10` (lun/mié/vie) por eventos **calculados**: dos días antes de cobrar («actualizad saldos: decide cuánto se reparte»), el día siguiente a un cargo grande previsto, y el día 1 («cerrad el mes»). Se publica como calendario suscribible (la app ya exporta `.ics`, A17-2) que se regenera con la previsión.
- *Por qué:* pedir datos cuando no cambian nada enseña a ignorar los avisos. Mejora `ND-10` de la quinta; no lo duplica.
- *Éxito:* frescura ≤ 1 día en los momentos de decisión en ≥ 90 % de los meses.

**CAP-10 · Fusión de capturas duplicadas entre canales** [C] · M · **Crítico si se hace CAP-01/03/08** · E · **Δ −2** · palanca: evita contar dos veces un gasto
- *Qué:* con varios canales (manual, Apple Pay, aviso del banco, captura de quien consulta, extracto), el mismo pago puede entrar tres veces. Clave de emparejamiento: importe exacto, fecha ±2 días, comercio por similitud; al importar el extracto, las capturas casadas se **consolidan** (el extracto manda en importe y fecha; la captura aporta partida y nota).
- *Por qué:* la quinta ya avisa de que «una partida que ya pasó, está en el saldo y no se registró se cuenta dos veces»; con captura pasiva, el riesgo se invierte (se registra dos veces). La deduplicación actual es por identidad de importación bancaria; no cruza canales.
- *UX/UI:* «3 pagos casados con el extracto» en el resumen de importación, con «ver parejas» y deshacer.
- *Éxito:* cero duplicados en el cierre de mes durante 3 meses.

### Bloque B — Previsión que se entiende y se gobierna (`PRV`, 8)

**PRV-01 · Puente de previsión: por qué cambió el fin de año** [C] · M · Alto · V · **Δ 0** · palanca: detectar a tiempo la deriva del ahorro anual
- *Qué:* en cada cierre se congela la previsión de liquidez y patrimonio a 31/12; el mes siguiente se muestra un **gráfico de cascada** desde la previsión anterior a la actual, con cinco barras: ingresos, gasto recurrente, extraordinarios, mercado (cartera) y deuda/supuestos. Frase: «Desde septiembre, el fin de año empeora en X €: 70 % por extraordinarios (coche), 30 % por mercado».
- *Por qué:* existe el diario de por qué cambia cada cifra (`PV5`, texto) y una cascada de resultado de mes (`analisisCascadaHtml`, A-4), pero **no** la reconciliación entre dos previsiones sucesivas, que es la herramienta estándar de control de gestión (*forecast bridge*). Reutiliza el marcado de A-4.
- *UX/UI:* barras horizontales etiquetadas directamente, color + signo (−/+), toque en una barra → lista de partidas que la explican; tabla alternativa.
- *Dependencias:* `NPV-03` (WP-09) para congelar en el cierre. *Éxito:* el hogar explica en una frase cada cambio > 5 % del ahorro anual previsto.

**PRV-02 · Previsión en tres capas: comprometido, probable y discrecional** [C] · M · Alto · V (fuera de Hoy; una línea en Hoy tras H1) · **Δ 0** · palanca: sabe cuánto es de verdad decidible
- *Qué:* separar las salidas futuras en **comprometidas** (cuotas, recibos contractuales, impuestos), **probables** (variables recurrentes con su banda) y **discrecionales**. La previsión se lee como «hasta cobrar ya están comprometidos X; lo probable suma Y ± Z; lo que queda es vuestra decisión».
- *Por qué:* el eje `movementActionTypes` ya clasifica las partidas (deuda/discrecional/recurrente), pero la previsión las suma en una sola línea. Separarlas es lo que hace creíble la cifra de Hoy: lo comprometido no tiene incertidumbre.
- *UX/UI:* barra apilada horizontal de tres tramos con patrón (no solo color) y una frase; nunca tarta.
- *Éxito:* quien consulta puede decir qué parte del mes ya está decidida (pregunta en la prueba de WP-02).

**PRV-03 · Inflación propia del hogar** [H] · M · Medio · E (cálculo) · **Δ 0** · palanca: previsión a largo plazo y jubilación menos sesgadas
- *Qué:* medir la variación interanual de las partidas comparables (suministros, seguros en su renovación, colegio, supermercado por cesta media) y construir un índice propio ponderado por peso en el gasto; mostrarlo junto al IPC oficial («vuestra inflación: X %, IPC: Y %») y ofrecer usarlo en `annualInflation` del forecast y en la proyección de jubilación (`GOB11`).
- *Por qué:* hoy la inflación es un supuesto tecleado único (A7-2). A 20 años, un punto de diferencia cambia el capital objetivo de independencia (`LPX1`) en decenas de puntos porcentuales.
- *Dependencias:* ≥ 13 meses de reales por partida; `ND-11` para el IPC oficial. *Riesgo:* ruido en partidas pequeñas → solo partidas con peso ≥ 2 % y 12 meses de datos.

**PRV-04 · Ingresos inciertos con probabilidad: paga extra, variable, devolución de la Renta y alquiler del local** [C] · M · Alto · V · **Δ 0** · palanca: no gastar un ingreso que puede no llegar
- *Qué:* cada ingreso no garantizado lleva **probabilidad, ventana de fecha e importe en banda**: paga extra (alta, fecha conocida), variable o bonus (media), devolución de la Renta (según el estimador), **alquiler del local con riesgo de vacancia o impago** (probabilidad declarada, meses de vacío esperados al cambiar de inquilino). La cifra de Hoy y el reparto de nómina solo cuentan los **confirmados**; la previsión muestra el valor esperado con su banda.
- *Por qué:* hoy un ingreso está o no está en el plan. El local en alquiler (`INV9`) es un ingreso real con riesgo propio que la previsión trata como seguro. La paga extra solo aparece en los datasets dorados.
- *UX/UI:* en la lista de ingresos, chip de certeza (Confirmado · Probable 80 % · Incierto) con icono + texto; en el gráfico, el ingreso incierto como barra discontinua.
- *Éxito:* ningún mes con margen negativo por un ingreso contado que no llegó.

**PRV-05 · Planes de contingencia acordados en frío, con disparador** [H] · M · Alto · V · **Δ 0** · palanca: decisiones rápidas y mejores en el mes malo
- *Qué:* el hogar acuerda, con calma, reglas del tipo **«si la previsión de fin de mes cae por debajo del suelo dos meses seguidos → 1) pausar la aportación a [fondo], 2) ocio −20 %, 3) usar la línea de crédito solo si…»**. La app vigila el disparador con la previsión existente y, cuando salta, presenta **el plan acordado** con su efecto calculado (escenario E13). Nunca ejecuta.
- *Por qué:* hay simuladores de escenarios y una línea de crédito de emergencia (`canonical-emergency-credit-line.js`), pero ningún **compromiso previo**. En finanzas personales, la decisión tomada bajo presión es la peor (sesgo de presente, aversión a la pérdida).
- *UX/UI:* asistente de 3 pasos (disparador · acciones en orden · firma de las dos personas con fecha); tarjeta en la bandeja cuando se dispara: «Se cumple vuestro plan B de marzo. Lo acordado: …».
- *Éxito:* plan firmado; si se dispara, se aplica en < 48 h.

**PRV-06 · «X € al día hasta cobrar»: la cifra traducida a ritmo** [M][H] · S · Alto · **H** · **Δ 0** · palanca: comprensión de quien consulta
- *Qué:* debajo (o en lugar) del titular, la misma cifra dividida por los días hasta el próximo cobro: «≈ X €/día durante N días». Ritmo de la semana en curso frente a ese ritmo.
- *Por qué:* hipótesis 4 de H1 (vocabulario): el hogar habla de «hasta cobrar», no de «disponible». El ritmo diario es la forma en que una persona sin rol financiero piensa el margen. `TRACK-1` ya calcula ritmo semanal de presupuesto; esto lo aplica a la cifra de Hoy.
- *Gate:* toca Hoy → **congelada hasta H1**. Candidata natural para el experimento UXS-05.

**PRV-07 · Horizonte de confianza: la previsión dice hasta dónde acierta** [C] · S-M · Medio-Alto · E (honestidad del cálculo) · **Δ 0** · palanca: evita decisiones largas sobre cifras sin base
- *Qué:* extender el backtest de `NPV-02` (caja a fin de mes) a **varios horizontes** (1, 3, 6, 12 meses) y pintar la previsión con opacidad decreciente donde el error histórico supera un umbral: «más allá de 7 meses, error medio ±X %: orientativo».
- *Por qué:* la previsión se dibuja con la misma nitidez a 1 mes que a 5 años. Mostrar dónde deja de ser fiable es la forma más barata de evitar falsa precisión (D3 de la quinta).
- *Dependencias:* `NPV-02` y ≥ 6 cierres con previsión congelada. *Éxito:* ninguna cifra mostrada sin su horizonte de confianza.

**PRV-08 · Revisión base cero del plan, una vez al año** [H] · S-M · Medio · V · **Δ +15 una vez al año** · palanca: partidas muertas o infladas en la previsión
- *Qué:* en enero, cada partida del plan se presenta con sus 12 meses de real y una pregunta: **mantener · ajustar a lo real · eliminar**. Las no revisadas quedan marcadas «sin justificar» en la previsión.
- *Por qué:* el plan acumula partidas heredadas que nadie revisa; la previsión es tan buena como su plan. Ninguna funcionalidad obliga a re-justificar partidas (`BUD4` repite presupuestos, no los cuestiona).
- *UX/UI:* una partida por pantalla, deslizar o tres botones, barra de progreso «14 de 52», guardado parcial. *Éxito:* error de previsión de enero-marzo menor que el del año anterior.

### Bloque C — Inversión: conducta, fiscalidad y patrimonio real (`CAR`, 6)

**CAR-01 · Política de inversión del hogar (una página, firmada)** [C][H] · M · Alto · V · **Δ 0** · palanca: evita vender en caídas y desviaciones caras
- *Qué:* un documento estructurado de una página: **objetivos y horizontes**, asignación objetivo con **bandas de rebalanceo**, regla de aportación, qué no se compra (productos, apalancamiento), **«qué haremos si la cartera cae un 20 % / 35 %»**, fecha de revisión. Firmado por las dos personas (fecha y nombre). La app la usa como fuente de reglas: avisa cuando una operación la contradice («esta venta incumple vuestra regla 4: no vender por caídas») y alimenta la «siguiente mejor acción» de `NIN-01`.
- *Por qué:* el gestor de inversiones profesional empieza por la *Investment Policy Statement*; el hogar tiene objetivos (`E15`), convicción por posición (`I12`), umbral de rebalanceo (`INV2`) y desapalancamiento (`LEV11`), pero **dispersos y sin compromiso**. No existe nada parecido (búsqueda «política de inversión»: nada).
- *UX/UI:* asistente de 6 preguntas en lenguaje llano con valores ya rellenos desde lo declarado; vista final imprimible; banda «Revisar la política: vence en 30 días».
- *Éxito:* política firmada; cero operaciones contrarias a ella sin una nota de motivo.

**CAR-02 · Panel de calma en caídas** [H] · S-M · Medio-Alto · V · **Δ 0** · palanca: no cristalizar pérdidas
- *Qué:* cuando la valoración de la cartera (snapshots de `NIN-02`) cae más de un umbral desde su máximo, la primera pantalla de Inversión cambia: caída en € **y en meses de aportaciones** («equivale a 7 meses de aportación»), cuánto tardaron en recuperarse caídas similares de vuestro tipo de cartera (datos históricos estáticos con fuente), qué dice vuestra política (CAR-01) y **cuánto habéis aportado frente a cuánto vale** (`NIN-03`). La rentabilidad diaria se oculta por defecto.
- *Por qué:* el mayor destructor de rentabilidad de un particular es vender en la caída. `LEV11` cubre el apalancamiento, no la conducta.
- *Dependencias:* `NIN-02` (WP-15) con ≥ 3 valoraciones. *Riesgo:* paternalismo → se puede desactivar.

**CAR-03 · Escalera del próximo euro: dónde va cada euro ahorrado** [C] · M · **Alto** · V · **Δ 0** · palanca: impuestos (plan de pensiones), intereses (deuda cara), rentabilidad
- *Qué:* una sola respuesta ordenada a «tenemos X € de excedente este mes, ¿dónde van?», combinando motores que hoy existen por separado: (1) completar el colchón (`canonical-cushion.js`); (2) deuda con coste neto superior a la rentabilidad esperada (`netDebtCostAfterTax`, `DEB10`); (3) **plan de pensiones hasta el límite deducible** (1.500 € individuales + hasta 8.500 € si hay plan de empresa en 2026, con tope del 30 % de rendimientos; *verificar* vuestra situación) cuando el tipo marginal (estimador de IRPF) lo justifica frente a su iliquidez; (4) fondos traspasables (diferimiento fiscal); (5) amortizar o invertir según `AP1`. Cada peldaño con su **euro de beneficio esperado** y su coste de liquidez.
- *Por qué:* `DLX2` reparte el excedente con reglas fijas; `AP1` compara solo dos opciones; `A15-4` simula el plan de pensiones aislado. Falta el **orden integrado**, que es exactamente la pregunta que se hace un hogar cada mes.
- *UX/UI:* escalera vertical de 5 peldaños, el actual resaltado, «llenado» con barra y texto; «¿Por qué este orden?» abre la explicación con las cifras. Encaja con `NPV-05` (reparto de nómina).
- *Éxito:* el reparto mensual sigue la escalera o deja nota de por qué no.

**CAR-04 · Valor de la vivienda y del local actualizado por índice oficial** [C][H] · S-M · Medio · T · **Δ −2/trimestre** · palanca: patrimonio y LTV reales (refinanciar)
- *Qué:* revalorizar trimestralmente la vivienda y el local con un índice público (*verificar*: índice de precios de vivienda del INE por comunidad, estadística del Notariado o valor de tasación del Ministerio por municipio), partiendo del último valor declarado y con chip «estimado por índice · T2 2026». Si el índice no está disponible, se queda el valor declarado.
- *Por qué:* `A14-3` actualiza la valoración a mano con comparación; nadie la actualiza. El valor de la vivienda mueve el patrimonio neto, la sobreexposición (`IVX8`) y el **LTV**, que decide si un banco ofrece mejores condiciones para subrogar (`NDB-04`).
- *Riesgo:* un índice agregado no es una tasación: rotular siempre como estimación.

**CAR-05 · «Vuestros activos ya pagan el X % de vuestros gastos»** [C] · S · Medio · V · **Δ 0** · palanca: motivación medible del ahorro
- *Qué:* renta sostenible de los activos (alquiler neto del local + dividendos + tasa de retirada declarada sobre la cartera líquida) dividida por el gasto medio de la previsión. Evolución mensual y fecha estimada del 25 %, 50 % y 100 %.
- *Por qué:* `LPX1` calcula el capital objetivo de independencia; esta cifra traduce el progreso a una proporción del gasto, que se entiende sin saber de finanzas y que **sube cada mes** (motivación sin gamificar).
- *Éxito:* aparece en la carta del mes (`NHG-05`).

**CAR-06 · Mapa de exposición por entidad y garantía** [C][H] · S · Medio · V · **Δ 0** · palanca: riesgo de contraparte
- *Qué:* por entidad (CaixaBank, Banca Mediolanum, otras), qué hay en depósitos cubiertos por el Fondo de Garantía de Depósitos (hasta 100.000 € por titular y entidad; *verificar*), qué en fondos (patrimonio separado de la gestora, no cubierto por el fondo pero no afectado por la quiebra de la entidad) y qué en seguros de vida-ahorro (otro régimen). Aviso si los depósitos de una entidad superan el límite por titular.
- *Por qué:* `NIN-08` lo menciona de pasada; nadie lo calcula. Con la cartera concentrada en una o dos entidades, es una pregunta legítima que el hogar no sabe contestar.

### Bloque D — Deuda actual (`DAC`, 5)

**DAC-01 · Conciliación por operación con la CIRBE** [C] · S-M · Medio-Alto · E · **Δ +10 una vez al año** · palanca: errores de registro, negociación
- *Qué:* introducir (o pegar) una vez al año el informe de la Central de Información de Riesgos del Banco de España (gratuito, con certificado o Cl@ve; *verificar* el procedimiento actual) y **conciliarlo operación a operación** con el inventario de deuda de la app: deudas que faltan, avales (`DI4`), importes que no cuadran, titularidades.
- *Por qué:* hoy la app muestra **dos totales** CIRBE en «Fuentes y presión» (`views/debt-liquidation-plan.js`) y hay una negociación activa que tiene un hito de CIRBE; no hay conciliación por operación. Un aval olvidado o un riesgo indirecto cambia la capacidad de endeudamiento que ve cualquier banco.
- *UX/UI:* tabla de dos columnas (CIRBE · app) con estado por fila (cuadra · falta en la app · diferencia de X), y acción «añadir a Deuda › Contratos».

**DAC-02 · Deducción por vivienda habitual del régimen transitorio: amortizar hasta el tope, no más** [C] · S · **Alto si aplica** · E · **Δ 0** · palanca: impuestos
- *Qué:* si la vivienda habitual se adquirió **antes del 1/1/2013** y se aplicaba la deducción, el hogar mantiene el régimen transitorio: 15 % sobre un máximo de 9.040 € anuales de cantidades pagadas (cuotas + amortizaciones) por declarante (*verificar* con asesor y con la comunidad autónoma). La app calcula cuánto «tope» queda este año y **recomienda que las amortizaciones anticipadas llenen el tope antes del 31/12** (rendimiento inmediato del 15 % de lo aportado dentro del tope) y avisa de que amortizar por encima no deduce.
- *Por qué:* no existe nada en el código (búsqueda «9.040», «régimen transitorio»: nada), y los motores de amortización (`DEB2`, `APX6`, `DEB11`) optimizan intereses, no esta deducción. Es dinero directo con fecha límite.
- *Gate:* **una pregunta al hogar** (¿fecha de compra y si se aplicaba la deducción?). Si no aplica, se archiva sin construir.

**DAC-03 · ¿Compensan las vinculaciones del préstamo vivo?** [C] · S-M · Medio-Alto · V · **Δ 0** · palanca: primas de seguros y comisiones
- *Qué:* para cada producto vinculado (seguro de vida y de hogar del banco, nómina, tarjeta, plan), su **coste anual frente a la alternativa de mercado** y la bonificación de tipo que aporta. Resultado por producto: «el seguro de vida del banco cuesta X más que uno equivalente y bonifica Y: **compensa / no compensa por Z €/año**». Incluye la posibilidad legal de cambiar de aseguradora conservando el préstamo (*verificar* la cláusula y la normativa vigente).
- *Por qué:* hoy la app calcula la **penalización** si se incumple una vinculación (`D7`, `views/deuda.js`), pero no el **otro lado**: lo que cuesta cumplirla. Sin ese lado no se puede decidir. `SP2` y `canonical-life-coverage.js` miran la cobertura, no el precio.
- *UX/UI:* una fila por vinculación con veredicto en texto + icono; «comparar con una oferta» abre un campo de prima.

**DAC-04 · Deuda en la sombra: permanencias, aplazamientos y financiación en factura** [C][H] · M · Medio · E (alimenta el inventario) · **Δ 0** · palanca: ratio de endeudamiento real y su coste
- *Qué:* detectar en los recurrentes (A16-3) compromisos que **se comportan como deuda** aunque no sean préstamos: móvil financiado en la factura, compras aplazadas con la tarjeta, «paga en 3 plazos», permanencias con penalización. Proponer darlos de alta como deuda corta con fecha de fin y coste implícito.
- *Por qué:* la fecha libre de deuda y el ratio de esfuerzo ignoran estos compromisos. `DI3` detecta revolving; esto es más amplio y más frecuente.

**DAC-05 · Comprobar que el banco cobra la cuota pactada** [C] · S-M · **Alto** · E (cálculo; alimenta la bandeja) · **Δ 0** · palanca: errores del banco, bonificaciones retiradas sin aviso
- *Qué:* cada cuota cargada en el extracto se compara con la cuota que corresponde según el contrato (capital, tipo vigente con bonificaciones, cuadro de amortización, `D-4`). Una diferencia por encima de una tolerancia crea una tarjeta en la bandeja: «La cuota de octubre fue X; según vuestro contrato debía ser Y. Posibles causas: bonificación retirada, revisión de tipo aplicada antes, comisión añadida».
- *Por qué:* un banco que deja de aplicar una bonificación no avisa; la app solo sabe si se cumple la vinculación si el hogar lo declara. Verificar el cargo real es **la forma más barata de proteger dinero** de toda la deuda. No existe (los motores calculan la cuota teórica, no la comparan con la cobrada).
- *Dependencias:* movimientos importados con la cuota identificada (las reglas ya la clasifican). *Éxito:* cualquier desviación > 1 % detectada en el mes en que ocurre.

### Bloque E — Deuda nueva (`DNU`, 3)

**DNU-01 · «¿Cuánto nos prestaría un banco?»: precalificación como la haría el banco** [C][H] · S-M · Medio (uso raro, alto cuando toca) · V (bajo demanda) · **Δ 0** · palanca: negociar con datos
- *Qué:* el cálculo que hace un banco antes de una hipoteca o préstamo: **ratio de esfuerzo** (cuotas totales / ingresos netos, umbral habitual 30-35 %), **LTV** (≤ 80 % en vivienda habitual), ahorro aportado (precio + gastos ≈ 10-12 %), prueba de estrés a tipo más alto, avales y deudas de la CIRBE (DAC-01). Resultado: «importe máximo aproximado a 25 años: X; lo que os limita es el ratio de esfuerzo».
- *Por qué:* `O-4` responde «¿podemos permitírnoslo?» desde el punto de vista del hogar; `DI4` mide el impacto de los avales; nadie da la **vista del banco**, que es la que decide.
- *Riesgo:* criterios de cada banco distintos → rotular como orientativo y *verificar* los umbrales.

**DNU-02 · Coche: contado, préstamo, financiación con cuota final o renting** [H] · M · Medio-Alto (cuando toca) · V (bajo demanda) · **Δ 0** · palanca: coste total de propiedad
- *Qué:* coste total a N años de cuatro vías: contado (con coste de oportunidad de la liquidez, `LEV16`), préstamo personal, **financiación con cuota final garantizada** (multiopción) y **renting** (cuota con seguro y mantenimiento incluidos), con depreciación, seguro, mantenimiento, valor residual y fiscalidad. Veredicto en una frase y efecto en el margen mensual, el colchón y la fecha libre de deuda.
- *Por qué:* las plantillas de eventos de vida (`ESX2`) incluyen el coche como gasto, pero no comparan vías de financiación; renting y leasing no aparecen en el código. Es la decisión de deuda nueva más frecuente de un hogar.
- *Honestidad:* construir **cuando haya un coche que cambiar**, como `NDB-05`.

**DNU-03 · Financiación «al 0 %» y aplazamientos de tarjeta: la TAE real** [C][H] · S · Medio · E (detección) / V (calculadora) · **Δ 0** · palanca: comisiones escondidas
- *Qué:* cuando el extracto muestra un aplazamiento o una compra financiada (DAC-04), o cuando el hogar introduce una oferta «sin intereses», calcular la **TAE efectiva** con comisión de apertura, seguro asociado y coste de oportunidad de pagar al contado, y compararla con usar el colchón.
- *Por qué:* `NDB-05` evalúa ofertas de préstamos grandes; esta es la versión rápida para lo pequeño, que es donde más se esconde el coste.

### Bloque F — Fiscalidad con fecha límite (`FIS`, 3)

**FIS-01 · Campaña fiscal de fin de año** [C] · M · **Alto (y con fecha: antes del 31/12)** · V (estacional) · **Δ +10 una vez al año** · palanca: impuestos
- *Qué:* del 1/11 al 31/12, una lista de acciones con **su ahorro estimado en euros** y su fecha límite, calculada con los motores existentes:
  1. **Aportación al plan de pensiones** hasta el límite deducible que convenga (1.500 € individuales; hasta 8.500 € adicionales vía plan de empresa en 2026; *verificar* vuestra situación): ahorro = aportación × tipo marginal (estimador de IRPF), frente a su iliquidez.
  2. **Compensación de plusvalías con minusvalías** latentes (`FC5`), respetando la regla de recompra de 2 meses (`FC2`, ya implementada).
  3. **Donativos**: 80 % de deducción en los primeros 250 € por declarante (40 % o 45 % el resto, según recurrencia; *verificar*).
  4. **Tope de la deducción por vivienda** si aplica (DAC-02).
  5. Deducciones autonómicas declaradas (lista de comprobación, sin inventar tramos).
  Resultado: «4 acciones suman ≈ X € menos en la Renta de 2027».
- *Por qué:* el estimador (`A15-2`), el borrador (`GOB8`) y los motores fiscales de cartera existen, pero **ninguna pantalla junta las decisiones de diciembre**. Es el mayor ahorro con fecha cierta del año.
- *UX/UI:* lista ordenada por euros, cada acción con «Hecho» y fecha; cuenta atrás discreta; aviso en el calendario (A17-2) el 1/12 y el 20/12.
- *Calendario:* **construir antes del 15/11/2026.**

**FIS-02 · Ajustar la retención para no pagar en junio** [C] · S · Medio · V · **Δ 0** · palanca: caja (y evitar el mes malo de junio)
- *Qué:* si el estimador de Renta prevé un resultado a pagar alto (o una devolución grande, que es un préstamo gratis a Hacienda), calcular el **tipo de retención voluntario** que lo equilibra y explicar cómo pedirlo a la empresa (el trabajador puede solicitar un tipo superior con el modelo 145; *verificar* procedimiento). Con CAP-05, detectar si la empresa lo aplicó.
- *Por qué:* el estimador existe; nadie convierte su resultado en una acción sobre la nómina. Suaviza la caja de junio, que es un mes de tensión.

**FIS-03 · El local alquilado: rendimiento neto de impuestos y actualización de la renta** [C] · M · Medio-Alto · V · **Δ +5 una vez al año** · palanca: impuestos e ingresos
- *Qué:* sobre `INV9` (P&L del inmueble), añadir la **fiscalidad del rendimiento del capital inmobiliario**: gastos deducibles (IBI, comunidad, seguro, reparaciones, intereses si hay financiación, **amortización del 3 % sobre el valor de construcción**), la **retención del 19 %** que practica el inquilino si es empresa o profesional (que el arrendador recupera en su Renta; *verificar* el caso) y el rendimiento neto después de impuestos. Además, **recordatorio de actualización anual de la renta** según la cláusula pactada (en locales rige lo pactado; *verificar* el contrato) con el índice que corresponda.
- *Por qué:* hoy el local tiene ingreso y rentabilidad, pero no su fiscalidad, y la actualización de la renta depende de que alguien se acuerde. Ambas son dinero recurrente.

### Bloque G — Adopción, hogar y experiencia (`UXS`, `HOG`, 10)

**UXS-01 · «Oye Siri, ¿cuánto podemos gastar?» (sin abrir la app)** [M] · S-M · **Alto** · X (no toca Hoy) · **Δ 0** · palanca: que quien consulta tenga la cifra
- *Qué:* un Atajo de iOS que lee un JSON de solo lectura con **una cifra, su edad y el próximo pago grande** desde el enlace redactado y caducable que ya existe (`canonical-share-link.js`, A19-1) y lo dice en voz o lo muestra en una notificación o en un widget de Atajos de la pantalla de inicio. «Podéis gastar X € hasta el día 30. Saldos de hoy.» (ejemplo sin cifras reales)
- *Por qué:* la métrica que falla es «tiempo hasta la cifra»; esta vía lo lleva a ~3 s sin rediseñar Hoy, que está congelado. El widget nativo se descartó por coste; esto no es nativo. La captura por voz se descartó (`DEX2`); esto es **consulta**, no captura.
- *Riesgos:* el enlace expone una cifra a quien tenga la URL → token caducable, solo esa cifra, revocable desde Ajustes; *verificar* que el Atajo puede leer el enlace desde GitHub Pages/Supabase sin sesión. **Revisión de privacidad antes.**
- *Éxito:* quien consulta obtiene la cifra en ≤ 5 s, ≥ 1 vez por semana (UXS-04).

**UXS-02 · Resumen semanal por correo (sustituto del push bloqueado)** [C] · M · Alto · T · **Δ 0** · palanca: adopción de quien consulta
- *Qué:* cada domingo, un correo a las dos personas con **tres cifras** (disponible hasta cobrar, cambio del patrimonio en el mes, próximo pago grande), **una tarea** (la primera de CAP-07) y un enlace. Enviado por una Edge Function con un proveedor de correo; sin datos en el asunto.
- *Por qué:* el resumen semanal (`P4`) y los avisos (`GOB5`) llevan semanas bloqueados por `A5-4` (push). El correo es el canal que ya funciona en cualquier iPhone, y el plazo del 30/11 (H8) es una buena ocasión para cambiar de canal en vez de archivar.
- *Riesgos:* importes en el buzón → opción de enviar solo «hay novedades» + enlace; `NTC-06` antes. *Éxito:* tasa de apertura ≥ 50 % en 8 semanas.

**UXS-03 · Medición pasiva de cuánto cuesta cada tarea** [C] · S · Alto · E (herramienta de medida) · **Δ 0** · palanca: priorizar con datos
- *Qué:* cronometrar en local, sin pedir nada, la duración de los flujos clave: abrir → guardar en «Actualizar saldos», registrar un gasto, confirmar la bandeja, cerrar el mes. Solo agregados (mediana, n), sin importes; se suman al contador combinado de `NTC-03`.
- *Por qué:* `NXP-01` mide el hallazgo con una prueba activa; el coste del operador (H4) sigue sin línea base y nadie se cronometra a sí mismo. Con esto, el Δ min/sem de cada propuesta deja de ser una estimación.
- *Dependencias:* ampliar el alcance de WP-02/WP-03 (barato si se hace a la vez).

**UXS-04 · Panel de adopción: la métrica principal que falta** [M][C] · S · **Alto** · E · **Δ 0** · palanca: decidir qué construir y qué retirar
- *Qué:* en Ajustes › Uso, cuatro indicadores por persona y semana: **días activos**, **frescura media de los saldos**, **% del gasto capturado en < 48 h**, **decisiones registradas** (`GOB10`). Línea de tendencia de 12 semanas. Es el panel que responde H6 y la Cola B con datos.
- *Por qué:* P13. Sin esto, la regla de parada mide una prueba de laboratorio y no el uso real. Se apoya en `NTC-03` y UXS-03.
- *Éxito:* el plan se gobierna con este panel en la revisión mensual (GOV-03).

**UXS-05 · Experimento cruzado del vocabulario del titular** [M][H] · S · Alto · **H** · **Δ 0** · palanca: comprensión
- *Qué:* alternar por semanas dos textos del titular (A: «Disponible para gastar»; B: «Podéis gastar hasta cobrar» o PRV-06) y medir con `NXP-01` el tiempo y si se dice la misma cifra. Diseño cruzado (cada persona ve las dos versiones en orden distinto) porque con n = 2 es la única forma honesta de comparar.
- *Por qué:* la hipótesis de vocabulario es la más barata de comprobar y la quinta la deja para «después de H1». Es una sola línea de texto con un interruptor.
- *Gate:* toca Hoy; propongo que el hogar la autorice como **parte de la medición de H1**, no como entrega visible.

**UXS-06 · Respuestas instantáneas sin IA: biblioteca de preguntas del hogar** [C][H] · M · Medio · V · **Δ 0** · palanca: consulta sin navegar
- *Qué:* en el buscador del menú (Ola 1.4), además de pantallas, **preguntas con respuesta**: «¿Cuánto gastamos en luz este año?», «¿Cuándo acaba el préstamo del coche?», «¿Cuánto vale la cartera?». Un analizador determinista de plantillas (partida + periodo + métrica) responde con la cifra, su fuente y un enlace a la pantalla.
- *Por qué:* el Copiloto está bloqueado por `A5-1`; la mayoría de las preguntas de un hogar caben en 20 plantillas deterministas. Respeta `CP3` (ninguna respuesta sin cita).
- *Éxito:* ≥ 70 % de las búsquedas de quien consulta resueltas sin cambiar de pantalla.

**HOG-01 · Acuerdos del hogar que la app vigila** [H] · S-M · Medio · V · **Δ 0** · palanca: evita discusiones y desvíos
- *Qué:* reglas sencillas acordadas por las dos personas: «gastos de más de X se hablan antes», «el colchón no se toca sin hablarlo», «el ocio no pasa de Y al mes». La app las comprueba con los datos que ya tiene y, cuando se incumplen, las lleva a la bandeja y a la reunión mensual (`NHG-02`) — nunca bloquea ni avisa a la otra persona en el momento.
- *Por qué:* `NHG-02` guarda acuerdos en el acta; nadie los vigila después. Es la versión del hogar de los «controles» de una empresa.

**HOG-02 · Asignación personal sin detalle** [H] · S · Medio-Alto · V (sobre todo una decisión) · **Δ −10** · palanca: menos captura, menos fricción
- *Qué:* cada persona recibe una cantidad mensual **propia** que no se detalla ni se clasifica: una transferencia al mes, una línea en el plan. Lo que se gasta de ahí no se registra partida a partida.
- *Por qué:* es una práctica clásica de finanzas en pareja y **la medida que más reduce la captura** de todo este documento: los gastos personales pequeños son los más numerosos y los que menos informan. Encaja con el reparto proporcional aprobado (Q8) y con `A18`.
- *Gate:* es primero una **decisión del hogar**; construirla es casi solo configuración.

**HOG-03 · Modo relevo: cuando quien opera no puede** [C][H] · S · Medio · V · **Δ 0** · palanca: continuidad del dato
- *Qué:* una guía de una pantalla para quien consulta, para mantener la app viva hasta 4 semanas: las **3 tareas mínimas** (con su tiempo medido, UXS-03), cómo confirmar la bandeja y qué no tocar. Se activa desde Ajustes o la propone la app tras 7 días sin actividad de quien opera.
- *Por qué:* la quinta identifica la dependencia de una sola persona como su mayor preocupación (§2.8). `LPX3` cubre fallecimiento o incapacidad (largo plazo); esto cubre lo cotidiano (viaje, enfermedad, una mala semana).

**HOG-04 · Modo viaje** [H] · S-M · Bajo-Medio · V · **Δ −3 durante el viaje** · palanca: control del gasto en vacaciones
- *Qué:* un sobre temporal con presupuesto, captura en divisa con conversión a euros, avisos de frescura en pausa y, a la vuelta, un barrido «12 pagos del viaje: confirmar todos en la partida Vacaciones».
- *Por qué:* las vacaciones son el periodo de más gasto y menos registro; con CAP-01 la captura en el viaje es automática y solo falta agruparla. Valor bajo-medio: candidata a catálogo.

---

## 6. Gobierno de producto (no son funcionalidades; no cuentan en las 45)

| ID | Regla | Por qué |
|---|---|---|
| **GOV-01** | **Presupuesto de minutos del operador: ≤ 10 min/semana.** Toda propuesta declara su Δ; si una entrega lo sube, en la misma ola entra otra que lo baje. Se mide con UXS-03 | P3, P4: el recurso escaso no es el código, es el tiempo de quien opera |
| **GOV-02** | **Uno entra, uno sale.** Cada pantalla o sección nueva visible exige proponer una a redirigir o plegar (con el mecanismo de `OPT-10`: redirigir sin borrar código) | 59 pantallas; 6 auditorías y más de 300 propuestas; margen de 82 líneas en `app.js` |
| **GOV-03** | **Puntuación por euros**: valor anual esperado (€) × probabilidad de que aplique ÷ esfuerzo, junto a la evidencia [M]/[C]/[H]. Se usa para ordenar la cola, no para decidir sola | Ninguna propuesta de la quinta lleva su palanca económica |
| **GOV-04** | **Decisiones a ciegas**: en los artefactos de decisión, el hogar responde antes de ver la recomendación; se registra si cambia | Anclaje observado (casi todo = recomendación) |
| **GOV-05** | **Medir solo con datos frescos**: cualquier medición de Hoy (P1, WP-02) se invalida si el saldo tiene > 1 día | P1 se midió con 5 días |
| **GOV-06** | **Prueba con 5 personas ajenas** con los datos de demostración, una vez por trimestre (30 min cada una) | Con n = 2 no se distinguen problemas de diseño de hábitos personales; 5 usuarios encuentran la mayoría de los problemas de usabilidad (Nielsen) |

---

## 7. Resumen por bloque

| Bloque | Propuestas | Exentas (E) | Fuera de la app (X) | Tocan Hoy (H) | Con fecha externa |
|---|---|---|---|---|---|
| A · Captura y actualización (`CAP`) | 10 | 4 (CAP-02, 05, 06, 10) | 3 (CAP-01 n1, 08, 09) | 0 | — |
| B · Previsión (`PRV`) | 8 | 2 (PRV-03, 07) | 0 | 1 (PRV-06) | — |
| C · Inversión (`CAR`) | 6 | 0 | 0 | 0 | — |
| D · Deuda actual (`DAC`) | 5 | 4 (DAC-01, 02, 04, 05) | 0 | 0 | DAC-02: 31/12 |
| E · Deuda nueva (`DNU`) | 3 | 1 (DNU-03, detección) | 0 | 0 | — |
| F · Fiscalidad (`FIS`) | 3 | 0 | 0 | 0 | FIS-01: 31/12 |
| G · Adopción y hogar (`UXS`, `HOG`) | 10 | 2 (UXS-03, 04) | 1 (UXS-01) | 1 (UXS-05) | — |
| **Total** | **45** | **13** | **4** | **2** | **2** |

Efecto conjunto sobre quien opera: la suma de los Δ negativos estimados (50-90 min/semana, con CAP-01, CAP-03, CAP-08 y HOG-02 como grueso) **supera probablemente lo que hoy se dedica de verdad** —por eso los saldos envejecen—, así que la lectura correcta es otra: con ellas, el mantenimiento cabe en el presupuesto de ≤ 10 min/semana (GOV-01) y deja de depender de tener tiempo. Es una estimación [H] hasta tener UXS-03.

---

## 8. Cómo encaja con la cola aprobada y qué haría en 90 días

### 8.1 Los 8 que construiría (y dónde entran)

| # | Propuesta | Dónde entra | Por qué ahora |
|---|---|---|---|
| 1 | **UXS-03 + UXS-04** (medición pasiva y panel de adopción) | Ampliar **WP-02/WP-03** (tramo 0) | Coste marginal casi nulo si se hace a la vez; da la métrica principal que falta |
| 2 | **CAP-02 + CAP-01 nivel 1** (URL de captura y Atajo de Apple Pay sin servidor) | Tramo A, **como excepción pedida al hogar** (es una pieza de la Ola 3, que sigue cerrada) | La mayor bajada de minutos del operador sin terceros ni secretos |
| 3 | **FIS-01** (campaña fiscal de fin de año) | **Antes del 15/11**, en paralelo al tramo A | Fecha límite del 31/12; dinero directo |
| 4 | **DAC-05** (cuota cobrada frente a la pactada) | Tramo A (exenta: cálculo + bandeja) | Protege dinero cada mes; usa datos que ya entran |
| 5 | **CAP-06** (cargos que no llegaron) | Tramo A (exenta) | Mejora la previsión y protege pólizas; base de WP-08 (día de cargo) |
| 6 | **UXS-01** (Siri: la cifra sin abrir la app) | Tramo 0-A, como **experimento** junto a WP-02 | Ataca la métrica fallida sin tocar Hoy |
| 7 | **PRV-05** (planes de contingencia) | Tramo B | Convierte la previsión en decisión acordada |
| 8 | **CAR-01** (política de inversión) | Tramo C, **antes de WP-17 (`NIN-01`)** | Da a la «siguiente mejor acción» unas reglas que no sean de Claude |

**Solo decisión del hogar, sin construir todavía:** HOG-02 (asignación personal), DAC-02 (¿compra antes de 2013 con deducción?), FIS-03 (datos del contrato del local).

### 8.2 Cambios que propongo a la cola de la quinta
1. **WP-05 (spike PSD2):** añadir CAP-01 y CAP-03 a la matriz de decisión. Si Apple Pay + avisos cubren ≥ 70 % de los movimientos, PSD2 puede cerrarse sin pena.
2. **WP-08 (día de cargo, 30 min de alta):** prerrellenar desde A16-3 y CAP-06 para que sean ~10 min de «confirmar», no 30 de declarar.
3. **WP-02 (prueba cronometrada):** solo válida con saldos ≤ 1 día (GOV-05); registrar desde dónde se abrió la app.
4. **`NXP-03`:** de la cola E al catálogo (no arregla la métrica en un Pro Max).
5. **`NHG-05` (carta del mes):** subirla a la primera posición del tramo E: es lo único que las **dos** personas piden activamente (P11).
6. **H8 (30/11, `A5-4`):** antes de archivar `P4`/`GOB5`, valorar UXS-02 (correo) como canal alternativo.

### 8.3 Lo que no haría
- **No abriría más de dos entregas visibles por tramo**: la regla v2 sigue siendo buena.
- **No construiría DNU-01, DNU-02 ni HOG-04** hasta que haya una decisión real (préstamo, coche, viaje).
- **No construiría PRV-03 ni PRV-07** antes de tener 12 cierres con previsión congelada: serían precisión falsa.

### 8.4 Métricas del conjunto (se suman a las de la quinta, §14.5 del backlog)
- **Adopción:** quien consulta obtiene la cifra (en la app o por Siri) ≥ 3 días/semana; quien opera abre la app ≥ 4 días/semana.
- **Coste del operador:** ≤ 10 min/semana (UXS-03).
- **Captura:** ≥ 70 % del gasto con tarjeta capturado en < 48 h sin teclear.
- **Dinero:** campaña fiscal hecha antes del 31/12 con su ahorro estimado registrado; cero desviaciones de cuota sin detectar.

---

## 9. Descartadas tras el cruce con el código (ya existen)

| Idea | Por qué no |
|---|---|
| Momento óptimo para amortizar según la comisión de amortización anticipada | Ya existe: aviso «la comisión baja de X % a Y % dentro de N meses» (`app.js`, junto a `DEB2`) |
| Coste compuesto de las comisiones de fondos | `IVX4` (`compoundedFeeCost`) |
| Calculadora de independencia financiera | `LPX1`; CAR-05 solo añade la proporción del gasto cubierta |
| Cubos de inversión por horizonte | `IVX6` (glide path) e `INV12` (posición ↔ objetivo) |
| Diario de por qué cambia la previsión | `PV5`; PRV-01 lo cuantifica en cascada, no lo repite |
| Traspasos sugeridos entre cuentas | «Disponible para traspaso» (ajustado y prudente) en `app.js` |
| Penalización por vinculación incumplida | `D7` en `views/deuda.js`; DAC-03 añade el lado del coste |
| Guion para llamar al banco | Existe (sesión registrada en `PROJECT_STATE.md`) |
| Detección de revolving | `DI3` |
| Vista para hijos | `MDX1` |
| Modo reunión | `UX5` y la reunión de `NHG-02` |
| Simulador de vender la vivienda y alquilar | `GOB15` |
| Alerta de drawdown con apalancamiento | `LEV11`; CAR-02 es conductual y sin apalancamiento |
| Comparador de tarifas de suministros | `A19-3` |

---

## 10. Decisiones que necesito del hogar (con mi recomendación)

| # | Pregunta | Recomendación |
|---|---|---|
| S1 | ¿Aceptáis un **presupuesto de ≤ 10 min/semana** para quien opera como restricción de todo el plan (GOV-01)? | **Sí** |
| S2 | ¿Abrimos **CAP-02 + CAP-01 (nivel 1)** como excepción de la Ola 3, sin servidor? | **Sí**: no toca Hoy y es la mayor bajada de esfuerzo posible |
| S3 | ¿Construimos la **campaña fiscal (FIS-01)** antes del 15/11? | **Sí** |
| S4 | ¿Se compró la vivienda habitual **antes de 2013** y se aplicaba la deducción? (dato) | — Decide si DAC-02 existe |
| S5 | ¿**Asignación personal** sin detalle para cada persona (HOG-02)? | Probadla 3 meses |
| S6 | ¿Probamos el **Atajo de Siri** (UXS-01) con un enlace caducable que expone una sola cifra? | Sí, tras la revisión de privacidad |
| S7 | ¿Respuesta **a ciegas** en los próximos artefactos de decisión (GOV-04)? | Sí |
| S8 | ¿Repetimos la medición de Hoy **solo con saldos del día** (GOV-05)? | Sí |

**El triaje de las 45 propuestas** se puede hacer en el artefacto privado «Triaje sexta auditoría» (cada persona, a ciegas: Sí / Más tarde / No).

---

## 11. Lo que no he podido verificar

- **iOS:** que la automatización «Transacción» se dispare con todas vuestras tarjetas de Wallet y se ejecute sin confirmación en vuestras versiones de iOS (documentado desde iOS 17; probar en los dos iPhone); que la automatización «Mensaje» pueda leer el texto del aviso del banco sin confirmación; que un Atajo pueda leer el enlace de solo lectura sin sesión.
- **Bancos:** qué avisos (SMS, correo, notificación) envían CaixaBank y Banca Mediolanum y en qué formato.
- **Fiscalidad y normativa** (verificar con asesor antes de rotular nada como definitivo): límites de aportación a planes de pensiones en vuestra situación (2026: 1.500 € individual + 8.500 € plan de empresa); deducción por donativos (80 % de los primeros 250 €); régimen transitorio de vivienda habitual (15 % sobre 9.040 €); retención del 19 % en arrendamiento de locales; actualización de la renta del local según contrato; cambio de seguro vinculado; criterios bancarios de ratio de esfuerzo y LTV; cobertura del Fondo de Garantía de Depósitos.
- **Índices de vivienda** accesibles por API sin clave y con CORS.
- **No he ejecutado la app** ni visto los contadores de uso.

---

## 12. Fuentes

- [Automatizaciones nuevas de Atajos en iOS 17: Transaction (Matthew Cassinelli)](https://matthewcassinelli.com/shortcuts-automations-ios-ipados-transaction-display-stage-manager/)
- [Seguimiento de gastos con Wallet y Atajos (iDrop News)](https://www.idropnews.com/ios-17/this-new-ios-17-shortcut-will-help-you-keep-track-of-your-spending/197589/)
- [Límites de aportación a planes de pensiones (VidaCaixa)](https://www.vidacaixa.es/es/articulos/jubilacion-y-pensiones/desgravar-plan-pensiones)
- [Aportación máxima a planes de pensiones de empresa (Coverflex)](https://www.coverflex.com/es/blog/aportacion-maxima-plan-pensiones-empresa)
- [Deducción por donativos (TaxDown)](https://taxdown.es/deducciones/donaciones)
- Repositorio: `docs/PROPUESTA_QUINTA_AUDITORIA_2026-10-02.md`, `docs/PLAN_IMPLEMENTACION_2026-10-03.md`, `BACKLOG_INICIO_OLEADA_OCTUBRE.md`, `docs/OLA2_RECALIBRACION.md`, `PROJECT_STATE.md`, y el almacén del artefacto «Preguntas de la Ola 2» (respuestas del 2/10/2026).
