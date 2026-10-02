# Quinta auditoría crítica — propuesta de mejoras y nuevas funcionalidades

Fecha: 2 de octubre de 2026. Estado: **propuesta para decidir; no es un backlog y no activa nada.**
Alcance pedido: más de 40 propuestas nuevas, con profundidad en previsión y actualización de datos, inversión y deuda (actual y nueva), cruzadas con `BACKLOG_INICIO_OLEADA_OCTUBRE.md` e incorporando lo pendiente.

**Este documento no contiene importes reales del hogar** (el repositorio es público). Solo porcentajes, tiempos medidos y hechos cualitativos.

**Cómo está hecho.** Leí el backlog vivo (`BACKLOG_INICIO_OLEADA_OCTUBRE.md`), `PROJECT_STATE.md` (sesiones 285-292), `docs/OLA2_RECALIBRACION.md`, los backlogs 2.0 y 3.0, el catálogo de tareas de las Oleadas 2-4 y el código relevante (importación, motores de fechas, cartera, deuda). Cada propuesta se cruzó contra el código con búsquedas; lo que ya existía se descartó (§8). **No he ejecutado la app ni visto los datos de uso** (viven en el navegador de cada móvil). Lo que depende de terceros o de hechos externos está marcado «verificar» (§11).

**Etiqueta de evidencia** (criterio `PROC-1`: toda propuesta debe citar uso real o petición explícita):
- **[M]** medido en el hogar (30/28/20 s sin encontrar la cifra; 100 % de fechas de salida estimadas; saldos con 5 días).
- **[C]** verificado en el código o la documentación del repositorio.
- **[H]** hipótesis o buena práctica sin evidencia de uso propia. Ojo con estas: son las que repiten el patrón que `3.0` §0 advierte.

**Puerta frente a la regla de parada v2:** **E** = exenta (arreglo de datos o cálculo, refactor habilitador, CI/rendimiento, accesibilidad); **V** = visible, necesita abrir ola (línea base y OK del hogar); **T** = depende de un tercero o de una decisión de contratación; **H** = toca Hoy → congelada.
**Esfuerzo:** S ≤ 1 sesión · M 2-3 · L 4+. **Valor:** Crítico / Alto / Medio / Bajo.

---

## 0. Veredicto en diez líneas

1. **No necesitáis más funcionalidades; necesitáis que la verdad entre más barata y que la previsión diga cuánto sabe.** Cuatro auditorías previas (más de 200 propuestas) están casi todas construidas y la única métrica de producto medida en Hoy falla: 30, 28 y 20 s y «no la encontró».
2. **Toda la entrada es manual y gruesa**: saldos tecleados, reales por partida y mes **sin fecha**, valoraciones de cartera tecleadas, Euribor tecleado, retenciones tecleadas. No encontré ninguna fuente externa de datos de mercado en el código.
3. **La matemática de previsión (Monte Carlo, conjuntos, P10-P90, árbol causal) es más fina que su entrada.** El 100 % de las fechas de salida futuras son estimadas (día 8 por defecto). Más sofisticación ahí es precisión falsa; hay que subir la resolución de la entrada y **contrastar contra la realidad**.
4. **No hay verdad de contraste de caja:** el cierre de mes no guarda saldo (hallazgo C2). Sin saldos de fin de mes no se puede medir si la previsión de caja acierta, ni construir la serie de patrimonio.
5. **Inversión es una calculadora excelente y un mal tablero:** sin precios, sin valoraciones periódicas propias, sin «¿cómo voy y qué hago?» en la primera pantalla.
6. **Deuda tiene el mejor análisis y el peor camino de usuario:** siete secciones con «deuda» en el nombre y dos motores en paridad.
7. **El plan de UX está bien frenado (regla v2) pero cuelga de dos personas que contesten en el chat.** Propongo instrumentar la medición dentro de la app (NXP-01, NTC-03) para que no dependa de sesiones.
8. **La regla v2 exime los arreglos de datos y cálculo**: casi todo lo de mayor valor de este documento (C2, día de cargo, medidor de calidad, backtest de caja) es exento. No hay que esperar a Hoy.
9. **El candidato de banca del backlog (`O-6`: GoCardless) probablemente ya no existe** para altas nuevas (§11). Hay que rehacer esa decisión antes de planificar nada alrededor de PSD2.
10. **Mi recomendación honesta: construir como máximo 10 de las 54 propuestas en los próximos 90 días** (§9). Las otras 44 son un catálogo para cuando haya evidencia de uso.

---

## 1. Diagnóstico crítico

### 1.1 Lo que está muy bien y no tocaría
Persistencia local primero, cola remota, copia completa verificada y restauración; guardianes de CI contra regresiones silenciosas (`ARQ-5`, `ARQ-6`); disciplina de declarar los límites de cada cifra; la decisión de medir con datos reales antes de construir S3 (evitó construir sobre un 100 % de fechas estimadas); «cero dependencias externas de UI»; invariante `A11-4` (nada financiero se ejecuta solo). Todo lo que sigue es crítica de lo que falta, no de lo que hay.

### 1.2 Hallazgos

| # | Gravedad | Hallazgo | Evidencia |
|---|---|---|---|
| D1 | Crítico | **Producto saturado de análisis, escaso de verdad de entrada.** 59 secciones de pantalla en `index.html`, ~70 motores `canonical-*`, 5.008 pruebas, y la métrica de Hoy sin cumplir. El cuello de botella no es el catálogo de funciones. | [M][C] |
| D2 | Crítico | **Toda entrada es manual, y la manual no lleva fecha.** `<input type="number">` para saldos; reales «un importe por partida y mes, sin fecha» (`handleRegistrarMesAddSubmit`); `currentValue` de cada posición tecleado; Euribor tecleado en `DEB4`/`D6`; `irpfWithholdingsPaid` tecleado. Único `fetch` de datos fuera de la capa de Supabase: `../data/finance_data.json`. | [C] |
| D3 | Crítico | **Previsión sofisticada sobre entrada gruesa.** En `expenseTimingForRow` solo hay fecha «por regla» para 3 etiquetas fijas; «observada» solo si el movimiento ya ocurrió; el resto cae en el día 8. Medido: 0 observadas, 0 por regla, 100 % estimadas. Una salida futura **no puede** ser observada, así que importar más extractos no lo arregla (corrige D1b de las decisiones del 1/10). Las bandas P10-P90 no incluyen la incertidumbre de fecha. | [M][C] |
| D4 | Alto | **Sin contraste de caja.** `closeMonth` guarda reales, motivo, autor y asientos de sobres; **ningún saldo bancario**; además cierra el mes en curso, no el que acaba (C2). `predictiveHealthIndex` mide error por categoría, no error de liquidez. El hallazgo 4 de `2.0` (patrimonio sin serie) sigue abierto porque `I2` solo guarda valoraciones por posición. | [C] |
| D5 | Alto | **La métrica falla donde importa y la causa puede ser de vocabulario.** El hogar dijo «hasta cobrar»; la app muestra «Disponible para gastar» = menor de dos márgenes: un constructo que la app inventó. Hipótesis 4 de `docs/OLA2_RECALIBRACION.md` §8.1. Además, 120 px de cabecera de procedencia en cada pantalla a 390 px (medido en S5). | [M][C] |
| D6 | Alto | **Inversión: calculadora, no tablero.** Cinco pestañas de análisis; la primera no responde a «¿cómo voy y qué hago?». Sin precios; el historial (`I2`) solo crece al cerrar mes, y el cierre es atípico (C2). La edición de posiciones permite tipo, etiqueta, ticker, cantidad y valor, pero **no coste, fecha ni cada aportación/venta** (`canonical-portfolio.js`: `costBasis: position.initialCost`). | [C] |
| D7 | Alto | **Deuda: siete secciones** (`deuda-comparar`, `deuda-ruta`, `deuda-contratos`, `deuda-simulador`, `debt-roadmap`, `debt-liquidation-plan`, `debt-control`), dos motores vigilados por `canonical-e14-parity.js` y un iframe heredado que `D1` amplió (decisión del hogar), es decir, vivo. El hogar necesita un guion por mes, no siete pantallas. | [C] |
| D8 | Alto | **Cuello de botella humano.** H1-H6 esperan respuestas en el chat; mientras tanto el backlog dice «no hay nada que construir». La regla exime datos/cálculo, pero la inercia lo ha leído como «parado». | [C] |
| D9 | Alto | **Dependencias de terceros caducadas o sin fecha:** `A5-1`, `A5-4` y PSD2 llevan semanas «sin producción real» y fingen ser trabajo futuro. El candidato de `O-6` parece cerrado a altas nuevas (verificar). | [C] + web |
| D10 | Medio | **Margen real de `app.js`: 82 líneas** sobre un techo con trinquete. Cualquier entrega que lo toque exige extraer antes. Es el verdadero límite de cadencia, no el calendario. | [C] |
| D11 | Medio | **Premisa sin contrastar:** «quien consulta usa Hoy como producto entero». Toda la Ola 2 descansa en una persona que respondió por la otra. | [C] |
| D12 | Medio | **Entrada numérica no pensada para móvil/es-ES:** `type="number"` sin separador de miles ni pegado de «1.234,56 €», con flechas en escritorio y comportamiento dependiente del idioma del teléfono. | [C] |

---

## 2. Lo que cuestiono de este encargo (y de lo ya decidido)

1. **«Más de 40 funcionalidades nuevas».** Entrego 54, pero **la restricción no es el tamaño del catálogo**: 211 propuestas de cuatro auditorías y la métrica sigue sin moverse. Cada propuesta adicional cuesta lectura, pruebas y superficie. Aconsejo ejecutar ≤ 10 (§9).
2. **«Profundizar en previsiones».** Profundizar en el *modelo* es el camino equivocado. Se profundiza en **resolución de la entrada** (fechas, saldos) y en **calibración contra la realidad** (backtest de caja). Ahí está el 80 % del valor restante.
3. **«Mejorar la experiencia de inversión».** El problema de experiencia de inversión es de *datos vivos*, no de más calculadoras: valoración periódica, operaciones editables y un primer pantallazo que diga cómo vais.
4. **Regla v2 y la Ola 2.** Es correcta, pero se aplicó a Hoy con tres entregas visibles en un día (S4, S3′, S5; máximo dos). No vuelvo a proponer nada sobre Hoy hasta H1. Lo digo porque varias propuestas de otros auditores acabarían ahí por inercia.
5. **«No hay nada que construir» (§0 del backlog) es una lectura demasiado conservadora.** La regla exime exactamente el trabajo de datos y cálculo que más desbloquea.
6. **`O-6` con GoCardless:** replantear antes de seguir esperando.
7. **Premisa del consultor/operador único** (D11): hasta que quien consulta pruebe la app 2 minutos, todas las decisiones de Hoy son de la persona equivocada para esa métrica.
8. **Lo que más me preocupa es la dependencia de una sola persona que opera**: si deja de actualizar saldos 5 días, todo el edificio muestra cifras viejas con gran aplomo. La frescura (S4) mitiga; la actualización barata (bloque A) cura.

---

## 3. Principios de UX/UI aplicados

1. **Una pantalla, una pregunta.** Hoy: «¿cuánto puedo gastar?». Inversión: «¿cómo voy y qué hago?». Deuda: «¿cuándo acabo y qué cambia si pongo más?».
2. **Confirmar por defecto, teclear por excepción** (reconocer antes que recordar, Nielsen 6): la app propone el valor esperado; el usuario toca «Coincide».
3. **Revelación progresiva:** frase → explicación → detalle. La procedencia pasa de bloque fijo a hoja bajo demanda (NXP-03).
4. **Honestidad de la incertidumbre:** banda + frase + calidad del dato. Nunca un número limpio con un supuesto escondido.
5. **Deshacer mejor que confirmar** para lo reversible (Nielsen 3 y 5); diálogo de confirmación solo para lo irreversible (cerrar mes, restaurar).
6. **Zona del pulgar y objetivos táctiles:** ≥ 44 pt (Apple HIG), nunca por debajo de 24 px CSS (WCAG 2.2, 2.5.8); acción primaria en la mitad inferior; `env(safe-area-inset-bottom)`; `100dvh`.
7. **Cifras:** `font-variant-numeric: tabular-nums`, formato es-ES, signo explícito («−»), unidad siempre, y el estado nunca solo por color (WCAG 1.4.1).
8. **Gráficos:** etiquetado directo, sin tarta, bandas con frase, scrub táctil con lectura fija (no bajo el dedo), teclado (←/→/Inicio/Fin), tabla alternativa (WCAG 1.1.1, 1.3.1).
9. **Estados completos** (Nielsen 1 y 9): vacío accionable, carga con esqueleto, error con causa y salida, sin conexión, dato obsoleto, éxito.
10. **Lenguaje del hogar** (Nielsen 2): si dicen «hasta cobrar», la pantalla dice «hasta cobrar» salvo que se mida lo contrario.
11. **Rendimiento percibido:** respuesta < 100 ms a un toque, esqueletos, interfaz optimista con cola visible.
12. **Privacidad visible:** modo discreto y bloqueo por inactividad; en una app de dinero, enseñarla en el metro no debe ser un riesgo.

---

## 4. Lo pendiente de `BACKLOG_INICIO_OLEADA_OCTUBRE.md`: disposición recomendada

| ID del backlog | Lo que dice | Mi recomendación |
|---|---|---|
| **H1** diagnóstico «no la encontró» | Cuatro respuestas del hogar en el chat | **Sustituir por medición dentro de la app (NXP-01)** y añadir el sello de versión (NXP-02), que resuelve la hipótesis 1 sin esperar |
| **H2** saldos, nómina del 30/9, remedir | Actualizar y repetir la medición | Hacerlo con NXP-01. Registrar cómo se actualizó y cuánto tardó: es la línea base de ND-01 |
| **H3** D4/D5 (modo consulta, plegar detalle) | Esperan a quien consulta | **NXP-07**: diseño listo; se construye solo con su respuesta |
| **H4** tiempo de registrar un gasto | Sin línea base | NXP-01 también lo mide; ND-14 se construye después |
| **H5** cierre de mes (C2) | Decidir qué hacer | **NPV-03**: recomiendo sí (es exento y desbloquea NPV-02, NPV-10 y la carta del mes) |
| **H6** Cola B y `OPT-10`–`OPT-13` | ¿Uso intenso? | **NTC-03** (contador combinado de los dos móviles) responde con datos. **No retirar nada** mientras tanto |
| **C1, C3** | Confirmar #429; P9 | Cerradas |
| **P12** plegar el bloque de procedencia | Aprobado, congelado | Rediseñado y mejorado en **NXP-03** (chip de una línea + hoja «Cómo se calcula») |
| **Carta del mes** | Aprobada, delegada | **NHG-05**, con especificación determinista. Depende de NPV-03 |
| **Modo consulta nivel 1** | Espera a H3 | **NXP-07**, como preferencia, no como permiso (respeta `OPT22`) |
| **Entrega 5 de la Ola 1** (retirar pantallas) | Solo con informe de uso y OK | Sin cambios. Con NTC-03 se podrá decidir pantalla a pantalla |
| **`OPT-10`–`OPT-13`** (23/10) | Aplazadas | Sin cambios; ver H6 |
| **`NAV-3`** onboarding | Aparcada | Sigue aparcada |
| **`ARQ-4` Visual Detail** | «Dejar donde está» | Sin cambios |
| **`I3`** mapa de correlación | Necesita historial | **NIN-02** acelera el historial (valoraciones fuera del cierre): descongela `I3` antes |
| **`I6`** fiscalidad cripto | Sin posiciones | Sin cambios |
| **`RGX3`, `DEX6`, `GOB5`, `P4`, `P10`, Copiloto UI** | `A5-1`/`A5-4` | **Decidir o cortar:** activar `A5-1`/`A5-4` con fecha, o dejar de arrastrarlas. ND-09/ND-10 dan un sustituto de `P4` sin push |
| **`O-6`** PSD2 | Candidato GoCardless | **ND-13**: spike de 2 semanas con otro proveedor y criterio de salida |
| **Ola 3** (Registrar y captura) | No se abre | Piezas como ND-01, ND-02, ND-05, ND-14 **son** la Ola 3; se abre con la línea base de NXP-01 |
| **Ola 4** (¿Me puedo permitir X?, objetivos, acta, motivación de deuda, cuentas en pareja) | No se abre | **NDB-03, NHG-04, NHG-02, NDB-01, NHG-01**: diseñadas aquí, sin construir |
| **UX-P4** margen de `app.js` | 82 líneas | **NTC-01** (habilitadora, exenta) |
| **UX-P3** WebKit | Solo si se nota lentitud | **NTC-04**; barata y la hipótesis de H1 (carga) la justifica |
| **UX-N1…N3**, UX-P1/P2/P5/P6/P7 | Estética/rendimiento | Sin cambios |

---

## 5. Catálogo de propuestas

> Formato: **ID · título** [evidencia] · esfuerzo · valor · puerta. *Qué · Por qué · Diseño UX/UI · Dependencias y riesgos · Éxito.*

### Bloque A — Verdad de entrada y actualización de datos (`ND`)

**ND-01 · Cuadre de saldos por excepción («Pulso de saldos»)** [C][M] · M · Crítico · V (Ola 3)
- *Qué:* al abrir «Actualizar saldos», cada cuenta aparece con el **saldo esperado** (último saldo de extracto + reales manuales posteriores) y dos botones: **«Coincide»** (primario) o **«Corregir»** (abre el teclado). Si no coincide, muestra la diferencia y pregunta «¿qué es?» con tres chips (movimiento sin registrar · comisión · otro), que crean un pendiente de clasificar.
- *Por qué:* hoy se teclea el saldo desde cero; los saldos llevaban 5 días sin actualizar. La app ya calcula el saldo del extracto (`latestStatementBalance`) y un cuadre en Movimientos/Cierre (`M-8c`, `C-2`): falta usarlo para *pedir menos*.
- *UX/UI:* reconocer antes que recordar; botones en la zona del pulgar; `inputmode="decimal"`; resultado «Saldos al día · hoy 21:04» con **Deshacer** 8 s; contador visible de «último pulso».
- *Dependencias:* NXP-05 (entrada numérica). *Riesgo:* confirmar sin mirar. Mitigación: la diferencia aparece siempre que supere una tolerancia, y «Coincide» queda registrado como declaración.
- *Éxito:* actualizar las dos cuentas ≤ 20 s (medido con NXP-01).

**ND-02 · Un extracto actualiza saldo y movimientos a la vez** [C] · S-M · Alto · V (Ola 3)
- *Qué:* al confirmar una importación, ofrecer (premarcado) «Usar el saldo final del extracto, fecha dd/mm, como saldo declarado de [cuenta]». Además, **continuidad del saldo corrido**: cada fila debe cumplir `saldo = saldo anterior + importe`; una ruptura señala el tramo «faltan movimientos entre el 12 y el 14».
- *Por qué:* el parser ya lee la columna `Saldo` y la importación ya sabe la cuenta (`session.fileMeta.bankAccount`); hoy son dos entradas separadas.
- *UX/UI:* resumen en el paso 4 con «Saldo → X · fecha» y «Sin huecos en el extracto» (icono + texto). Si hay hueco, aviso y botón «Descargar el tramo que falta».
- *Dependencias:* ninguna. *Éxito:* una sola operación por visita al banco.

**ND-03 · Día de cargo por partida (declarado, con sugerencia aprendida)** [M][C] · M · Crítico · E
- *Qué:* campo opcional «Día de cargo» por partida (1-31, «último día», «sin fecha») que sustituye al día 8 por defecto: orden de precedencia **declarado > observado > regla > estimado**. Sugerencia con confianza desde el histórico («suele cargarse el 5 · 6 de 6 meses») y botón «Aplicar las N sugerencias fiables».
- *Por qué:* es la pieza que falta (D3). Verificado: no existe un día de cargo propio por partida en el código. Convierte el 100 % estimado en una cifra gestionable.
- *UX/UI:* columna en Plan › Partidas con *stepper* y chip de sugerencia; resumen «quedan 9 partidas con fecha estimada (22 % del gasto)». Una sola sesión de ~30 minutos de alta, no un trabajo continuo.
- *Dependencias:* **paso 0**: script de viabilidad de solo lectura (decisión P14, ≥ 3 meses de movimientos). NTC-01 antes (seam limpio). *Riesgo:* fechas declaradas que caducan: se revisan con el medidor NPV-08.
- *Éxito:* ≥ 70 % del gasto mensual con fecha declarada u observada.

**ND-04 · Perfiles de extracto con autodetección** [C] · M · Alto · E
- *Qué:* el parser exige cabeceras `Fecha/Movimiento/Importe/Saldo`. Añadir autodetección de delimitador, decimal con coma, formato de fecha, convención de signo (columnas debe/haber), filas de título antes de la cabecera, codificación Windows-1252 y separador de miles; perfiles con nombre por banco y un corpus de pruebas anonimizado.
- *UX/UI:* errores que dicen fila y motivo («fila 7: fecha no reconocida»), botón «Copiar diagnóstico» para pedir ayuda, previsualización de las 5 primeras filas ya interpretadas.
- *Dependencias:* averiguar qué formatos exporta cada banco (Cuaderno 43 solo si lo ofrecen; verificar). *Éxito:* cero extractos rechazados sin explicación.

**ND-05 · Bandeja por gesto desde el móvil** [H] · L · Alto · T (Ola 3)
- *Qué:* un endpoint privado (Edge Function, ya existe `supabase/functions`) con token personal, y un **Atajo de iOS** «Compartir → Enviar a Finanzas Casa» que deja el fichero del banco en la bandeja E11b **pendiente de revisar** (nunca escribe en el libro).
- *Por qué:* es el «importador de un gesto» de la Ola 3. Web Share Target no está disponible en iOS Safari (verificar), así que el Atajo es la vía.
- *UX/UI:* insignia «1 extracto esperando» en Registrar; la revisión sigue siendo el asistente de 4 pasos.
- *Riesgos:* token en el móvil (rotación, revocación) y superficie de ataque nueva → NTC-06 antes. *Éxito:* ≤ 2 minutos del banco al plan.

**ND-06 · Gestor de reglas de clasificación** [C] · M · Medio · V
- *Qué:* las reglas se aprenden en silencio (`movementMappings`) y un error se repite para siempre sin verse. Lista en Ajustes › Datos con patrón, partida, veces aplicada, última vez, conflictos (dos reglas que casan); editar, borrar y **«probar regla»**: qué movimientos pasados cambiarían.
- *UX/UI:* tabla ordenable, filtro «conflictos», vista previa con diff antes de aplicar a histórico. *Éxito:* cero partidas mal clasificadas persistentes.

**ND-07 · Detector de anomalías en el extracto** [C] · M · Alto · E (si solo alimenta la bandeja existente)
- *Qué:* cargo duplicado (mismo día, importe y concepto), **devolución de recibo**, comisión nueva, concepto recurrente que no está en el plan, importe fuera de la distribución de su propia partida (> P95). Las alertas entran en la **bandeja única de decisiones** (`T3`); nunca actúa.
- *Por qué:* `P8` (gasto fantasma) cubre subidas de precio, no estos casos; proteger dinero es lo que más valor percibido da a una app de finanzas.
- *UX/UI:* cada tarjeta con evidencia (las dos filas), acción segura («ignorar», «era correcto», «reclamar»). *Éxito:* falsos positivos < 20 %.

**ND-08 · Cobros esperados: confirmar o reportar retraso** [M][C] · S-M · Alto · E
- *Qué:* si pasan 2 días de la fecha esperada de un ingreso y no hay movimiento que case, la bandeja pregunta «¿Ha llegado la nómina?»: **Sí, por el importe previsto · Sí, otro importe · Aún no (recordar en 2 días)**. «Aún no» mueve la fecha esperada y marca la cifra de margen.
- *Por qué:* «nómina del 30/9: no lo sé» (H2). Los ingresos dominan la caja y hoy dependen de que alguien recuerde registrarlos como reales.
- *UX/UI:* 1 toque, texto de la pregunta con el nombre del ingreso. *Éxito:* ningún ingreso esperado sin estado más de 3 días.

**ND-09 · Frescura por fuente en el centro de Datos** [C] · S · Alto · V (fuera de Hoy)
- *Qué:* seis fichas: saldo de cada cuenta, último movimiento importado, última valoración de cartera, índices oficiales, último cierre. Color + icono + texto («hace 3 d») y un toque lleva a la acción exacta.
- *Por qué:* S4 solo dice la edad de los saldos; el resto envejece sin aviso. Reutiliza `canonical-data-age.js`. *Éxito:* ninguna fuente > 7 días sin que se haya visto.

**ND-10 · Recordatorios de rutina sin push (calendario suscribible)** [H] · S · Alto · E
- *Qué:* «Suscribirse a la rutina»: un `.ics` con eventos recurrentes (lun/mié/vie 21:00 «Actualizar saldos (1 min)»; días 1-3 «Cerrar el mes»; trimestral «Revisar supuestos») con enlace a `#registrar`.
- *Por qué:* `A5-4` (push) lleva semanas bloqueada; el calendario del móvil ya sabe avisar. La app ya exporta `.ics`.
- *Riesgo:* el enlace del evento abre Safari, no la app instalada (verificar). *Éxito:* actualización en el ≥ 90 % de las semanas.

**ND-11 · Indicadores oficiales automáticos (Euribor, €STR, IPC) con caducidad** [C] · S-M · Alto · E
- *Qué:* leer 3 series públicas (BCE para tipos; INE para IPC; verificar CORS, si no, vía función privada), mostrarlas con «Fuente: BCE · dato de septiembre · actualizado hoy» y sustituir los campos tecleados de `DEB4`/`D6` y la inflación del forecast (`annualInflation`). Si falla, vuelve al valor tecleado.
- *Nuance:* una hipoteca referenciada al Euribor usa media mensual o valor de un día según contrato; añadir ese dato al contrato (NDB-02).
- *UX/UI:* chip de procedencia + aviso de caducidad con la regla `PVC15`. *Éxito:* cero supuestos de mercado tecleados.

**ND-12 · Precios de mercado opcionales por ISIN** [H] · L · Medio · T
- *Qué:* campo ISIN y botón «Actualizar valores»: una función privada trae el valor liquidativo/cotización; vista previa «3 posiciones cambian: +1,2 %…» y confirmación; nunca sobrescribe en silencio.
- *Por qué:* hoy no hay precios. *Mi consejo:* **empezar por NIN-02** (hoja manual), que da el 80 % del valor con el 10 % del coste y sin cuestiones de licencia de datos. Esta solo si el hogar lo pide.
- *Riesgos:* términos de uso del proveedor, retraso de 1-2 días en fondos, nueva superficie de ataque.

**ND-13 · PSD2 de solo lectura: spike de dos semanas** [C] · S (decisión) · Alto · T
- *Qué:* (1) comprobar que un proveedor accesible a particulares cubre CaixaBank y Banca Mediolanum (verificar Enable Banking en modo restringido, open-banking.io, Tink); (2) diseñar el ciclo de **consentimiento caducable** (hasta 180 días, volver a autorizar) como ficha «Conexión: caduca en 12 días» que nunca bloquea lo manual; (3) revisión de seguridad (NTC-06); (4) **criterio de salida:** si no hay cobertura o la fricción es alta, **cerrar `O-6` definitivamente**.
- *Por qué:* el contrato E9 y la bandeja ya existen (`canonical-e9-bank-import.js`, `rawStored: false`). *Éxito:* decisión tomada en 14 días, no otra espera.

**ND-14 · Captura de un gasto en ≤ 8 segundos** [H] · M · Alto · V (Ola 3)
- *Qué:* sustituir el modal de 3 campos (`FLU-2`) por una hoja inferior con **importe primero** (teclado ya abierto), chips con los 5 conceptos más frecuentes a esa hora, fecha «hoy» con chip «ayer», guardado con la tecla *hecho* y **Deshacer** 8 s; sin conexión, cola visible.
- *Por qué:* métrica de la Ola 3 sin línea base (H4). *UX/UI:* botón flotante en la zona del pulgar, `enterkeyhint="done"`, tabular-nums. *Éxito:* mediana ≤ 8 s en 3 intentos.

### Bloque B — Previsión honesta y contrastada (`NPV`)

**NPV-01 · Banda de caja diaria con ventanas de fecha** [M] · L · Alto · V
- *Qué:* con las fechas de ND-03 donde existan y una **ventana** (p. ej. 1-28 o la aprendida) donde no, simular cientos de trayectorias (patrón de `ESX1`) y mostrar la liquidez de los próximos 30 días como **banda P10-P90**, la **probabilidad de cruzar el suelo** y el día más probable del mínimo.
- *Por qué:* recupera el aviso «bajaréis del suelo antes de cobrar» que S3′ perdió, **sin fingir exactitud**: probabilidad, no calendario.
- *UX/UI:* gráfico del kit NPV-07 + una frase («3 de cada 10 trayectorias bajan del suelo entre el 8 y el 12») + tabla alternativa. Solo en Plan › Previsión; en Hoy, como mucho una línea y solo tras H1.
- *Dependencias:* NTC-01, ND-03. *Riesgo:* si las fechas siguen siendo mayoritariamente estimadas, la banda será tan ancha que no informará: eso también se dice (NPV-08).

**NPV-02 · Backtest de liquidez a fin de mes** [C] · M · Alto · E
- *Qué:* el día 1 y el 15 se congela la liquidez prevista a fin de mes; al cerrar, se compara con el saldo declarado (NPV-03). Muestra sesgo y error medio en euros y %, y estrecha o ensancha la banda como ya hace `PVC13` con las categorías.
- *Por qué:* hoy hay error por categoría, ninguno de **caja**. Con < 3 meses dice «datos insuficientes» (nunca precisión inventada).
- *Éxito:* error medio de caja decreciente en 6 meses.

**NPV-03 · Cierre de mes con saldo y firma (resuelve C2)** [C] · M · Crítico · E (tras la decisión H5)
- *Qué:* guardar en el cierre `{saldo por cuenta, fecha, fuente}` (almacén local con el patrón de `I2`, **sin tocar el RPC `close_finance_month`**); permitir cerrar **el mes anterior** (por defecto entre el día 1 y el 3); cuadre `saldo inicial + movimientos = saldo de cierre` con tolerancia: avisa, no bloquea.
- *Por qué:* lo acordado el 2/10 no es lo que hace la app (C2). Es la **piedra angular** de NPV-02, NPV-10 y NHG-05.
- *Nota técnica:* el almacén nuevo debe clasificarse en `BACKUP_LOCAL_STORES` (guardián `arq6-copia-completa`). *Riesgo:* operación firmada: pruebas de dos sesiones y de reapertura.

**NPV-04 · Mapa anual de pagos grandes con su sobre** [H] · M · Medio-Alto · V
- *Qué:* franja de 12 meses con barras por pago grande (seguros, impuestos locales, colegio, vacaciones, Hacienda) y su **nivel de financiación** (sobre acumulado frente a coste), en color + patrón.
- *Por qué:* los pagos desiguales son lo que más rompe el suelo. Reutiliza `financialCalendar` y los sobres. *UX/UI:* múltiples pequeños, etiquetado directo, toque → detalle.

**NPV-05 · Reparto de la nómina en un paso** [H] · M · Alto · V (Ola 4)
- *Qué:* al confirmarse la nómina (ND-08), hoja con cinco filas prerrellenas por las reglas existentes: obligaciones del mes, sobres, deuda extra (`DLX2`), inversión (plan), libre. *Steppers* que siempre suman el disponible tras el suelo; «Aplicar» crea **borrador** y una lista «Haz esta transferencia: X» (nunca ejecuta, `A11-4`).
- *Por qué:* el hogar ya decidió que la asignación se hace al cobrar. *Éxito:* decisión de asignación en < 60 s.

**NPV-06 · «¿Y si…?» desde Previsión** [H] · M · Medio-Alto · V
- *Qué:* cinco chips (gasto ±10 %, un ingreso se retrasa un mes, imprevisto, tipo +1 pt, pausa de aportaciones) que dibujan una **línea fantasma** sobre la previsión y un diff (mínimo y fin de mes). «Guardar como escenario» lo manda al Laboratorio; si no, no se guarda nada.
- *Por qué:* el Laboratorio está enterrado en Ajustes (Nielsen 7: flexibilidad). Reutiliza `E13`.

**NPV-07 · Kit de gráficos táctil y accesible** [C] · M-L · Alto · E (a11y + habilitadora)
- *Qué:* un módulo `chart-kit` (SVG a mano, sin librerías) con *scrub* por Pointer Events, lectura fija, teclado, `role="img"` + frase automática («la liquidez baja de X a Y en marzo»), «Ver como tabla», paleta de `design-tokens.css`, `prefers-reduced-motion` y `prefers-contrast`. Migrar primero tres gráficos (cono de previsión, cartera, deuda).
- *Por qué:* los gráficos son SVG a mano con `title` nativo (sin hover en táctil); `I9`/`P2` resolvieron a medias cada uno por separado. Saca código de `app.js` (D10).

**NPV-08 · Medidor de calidad de datos de la previsión** [M] · S · Alto · V (fuera de Hoy)
- *Qué:* tres barras en la cabecera de Plan › Previsión: **Fechas** (declaradas/observadas/estimadas), **Importes** (reales/previstos), **Ingresos** (confirmados/esperados), cada una con «qué hacer para subirla».
- *Por qué:* convierte el hallazgo del 100 % en un indicador gestionable y contrarresta la precisión falsa (D3). Es lo primero que consume NPV-01.

**NPV-09 · Palanca de recorte («¿cuánto aguanta el colchón?»)** [C] · M · Medio · V
- *Qué:* sobre la clasificación ya existente de partidas (eje `movementActionTypes`: deuda/discrecional/recurrente), elegir un % de recorte discrecional y N meses; muestra autonomía del colchón y liquidez resultante.
- *Por qué:* `GOB9` mide la resiliencia pero no ofrece la palanca. Se apoya en `E13`, sin motor nuevo.

**NPV-10 · Patrimonio neto: serie histórica y proyección con hitos** [C] · L · Alto · V
- *Qué:* línea + áreas apiladas mensuales (efectivo, posiciones, vivienda, deuda) con hitos (fecha libre de deuda, objetivos, jubilación) y abanico de tres escenarios.
- *Por qué:* hallazgo 4 de `2.0`, aún abierto. *Dependencias:* NPV-03 (saldos de cierre) y ≥ 3 meses de datos; mientras tanto, estado vacío honesto.

**NPV-11 · Retenciones acumuladas automáticas para el estimador de Renta** [C] · S-M · Medio-Alto · E
- *Qué:* hoy `irpfWithholdingsPaid` se teclea; calcularlo desde las nóminas registradas × retención declarada y mostrar «Renta estimada: a devolver/pagar entre X y Y, con datos hasta septiembre», con una **provisión mensual sugerida** a un sobre.
- *Por qué:* el estimador existe (`estimateIrpfResult`); la entrada es manual. *Riesgo:* declarado como estimación; no sustituye al asesor.

**NPV-12 · Control de prudencia de la previsión** [H] · M · Medio · V
- *Qué:* un deslizador «Realista (P50) ←→ Prudente (P75)» que desplaza las partidas variables a lo largo de su propia distribución histórica, con el impacto sobre el margen en vivo; el valor elegido se rotula en todas las cifras.
- *Por qué:* el hogar ya prefiere lo prudente («más tarde es más prudente») pero hoy se hace partida a partida, sin control global. *Riesgo:* complejidad: dejar en la cola si ND-03 funciona.

### Bloque C — Inversión como tablero vivo (`NIN`)

**NIN-01 · Cartera como tablero con «siguiente mejor acción»** [C][H] · M-L · Alto · V
- *Qué:* arriba, un resumen de una línea (valor, aportado, ganancia en € y %, rentabilidad) y **una acción** elegida por reglas deterministas con su motivo (aportación pendiente · deriva sobre el umbral · revisión de convicción vencida · venta fiscalmente óptima). Debajo, barra «objetivo vs. actual» (nada de tarta) y posiciones como tarjetas en móvil, con *sparkline* cuando haya historial.
- *Por qué:* hoy la primera pestaña es un conjunto de calculadoras. *UX/UI:* jerarquía visual, revelación progresiva, una acción primaria. *Dependencias:* NIN-02/03 para el *sparkline*.

**NIN-02 · Hoja de valoración rápida con snapshots propios** [C] · S-M · Alto · V
- *Qué:* tabla ordenada por tamaño con el valor anterior, un campo para el nuevo (o «% de variación») y chip de variación; «Pegar desde el bróker» que casa por nombre/ISIN/ticker; fecha de valoración; al guardar, **un snapshot fuera del cierre de mes**.
- *Por qué:* hoy el historial solo crece al cerrar mes (`I2`) y el cierre es atípico (C2). Esto acelera `I3` y es el 80 % del valor de ND-12 con el 10 % del riesgo.

**NIN-03 · «Aportado vs. valor» y rentabilidad ponderada por tiempo** [H] · M · Alto · V
- *Qué:* gráfico de aportaciones acumuladas (escalón) frente al valor de mercado; la distancia es el efecto mercado. Dos rentabilidades con explicación: XIRR (ya existe) y TWR.
- *UX/UI:* una frase: «De cada 100 € de vuestra cartera, 78 los pusisteis vosotros y 22 los ganó el mercado». *Dependencias:* NIN-02.

**NIN-04 · Cumplimiento del plan de aportación** [H] · M · Medio-Alto · V
- *Qué:* tabla mensual previsto vs. ejecutado (emparejado con movimientos marcados como aportación), % de cumplimiento, atraso con opciones («repartir», «saltar») y proyección anual si se mantiene el ritmo. Sin gamificar: sin rachas ni insignias.
- *Por qué:* la intención de ahorro se pierde en la ejecución; `IV3`/`INV13` cubren el plan, no su cumplimiento.

**NIN-05 · Rebalanceo por aportaciones (sin vender)** [C] · M · Alto · V
- *Qué:* dado el desvío frente al objetivo y las próximas N aportaciones, repartirlas hacia lo infraponderado y decir «con vuestras aportaciones actuales volvéis al objetivo en 7 meses sin vender», frente al coste fiscal de vender (`FC5`).
- *Por qué:* verificado: no existe rebalanceo por flujos. Es la vía de menor coste fiscal en renta variable cotizada.

**NIN-06 · Operaciones editables e importador del bróker** [C] · L · Alto · V
- *Qué:* libro de operaciones por posición (fecha, unidades, precio, comisiones) editable, con recálculo FIFO y diff antes/después; importación pegando el CSV del bróker con la misma identidad y deduplicación que la bancaria.
- *Por qué:* hoy no se pueden corregir coste, fecha ni aportaciones individuales (D6); un error de alta obliga a borrar la posición.
- *Riesgo:* cálculo fiscal: pruebas de oro con `FIN-2`.

**NIN-07 · Patrimonio neto de impuestos latentes** [C] · S-M · Medio · V
- *Qué:* una línea «Si liquidarais hoy: X neto de impuestos» sobre el patrimonio, con el valor neto por posición (`FC1`/`FC5`) y el rescate de pensión (`I5`), rotulada como estimación.

**NIN-08 · Dónde poner la liquidez ociosa** [C] · M · Medio-Alto · V
- *Qué:* para el exceso sobre el suelo, comparador neto de impuestos (base del ahorro) entre cuenta remunerada, letras del Tesoro, fondo monetario y depósito: rendimiento neto, días hasta disponer, límite de garantía de depósitos por entidad (verificar), mínimo exigido.
- *Por qué:* `LEV16` mide el coste de la liquidez ociosa; no dice a dónde llevarla. Tipos tecleados con fecha o proxy de ND-11.

**NIN-09 · Prueba de estrés en una pulsación** [C] · S-M · Medio · V
- *Qué:* cuatro eventos precargados (caída de renta variable, tipos +2 pt, pérdida de ingreso 6 meses, combinada) con efecto en patrimonio, liquidez, margen y distancia al margin call. Reutiliza `LEV5`, `LEV7`, `ESX`.

**NIN-10 · Informe fiscal anual de inversión para la Renta** [C] · M · Alto en temporada · V
- *Qué:* exportación PDF/CSV con ganancias y pérdidas realizadas (FIFO), dividendos con retenciones, compensaciones y pérdidas pendientes, traspasos entre fondos (no tributan) y un aviso de **bienes en el extranjero** si procede (verificar umbrales con asesor).
- *Por qué:* `FC1`-`FC5` calculan; falta el entregable que se lleva al asesor o a la declaración.

### Bloque D — Deuda con guion (`NDB`)

**NDB-01 · Camino a deuda cero: una narrativa, un control** [C] · M-L · Alto · V (Ola 4)
- *Qué:* en «Ruta»: tres cifras héroe (fecha libre de deuda · cuota total · intereses pendientes), **un deslizador «extra al mes»** con recálculo en vivo (con estado «recalculando»), línea de hitos (cuándo acaba cada contrato) con marca de «hoy», y «por cada 100 € extra: X € de intereses y Y meses menos», con a qué contrato iría (`DEB5`/`DEB10`). Las otras seis secciones quedan como «detalle» enlazado; **no se borra código** (regla de `OPT-10`).
- *Por qué:* D7. Sin matemática nueva: reutiliza los motores actuales, a través del contrato canónico (no del iframe).
- *Éxito:* contestar «¿cuándo acabamos y qué cambia con 200 € más?» en < 30 s.

**NDB-02 · Revisión de tipo variable con el índice oficial** [C] · S-M · Alto (si es variable/mixta) · V
- *Qué:* campos de contrato: índice, diferencial, periodicidad, próxima revisión, regla del índice (media mensual o valor de un día). Con ND-11: «Próxima revisión el dd/mm: cuota estimada de A a B (±1 pt)», aviso a 60 y 30 días y evento de calendario.
- *Dependencia:* ND-11. *Pregunta al hogar:* ¿hipoteca variable, mixta o fija?

**NDB-03 · «¿Me puedo permitir X?» con tres vías de pago** [H] · M-L · Alto · V (Ola 4)
- *Qué:* importe y fecha → contado / a plazos / préstamo, cada vía con efecto en el margen de Hoy, el suelo, la ratio de deuda y la fecha libre de deuda, y un veredicto en una frase.
- *Por qué:* es la pieza «¿me puedo permitir X?» de la Ola 4. *Dependencia:* **no construir antes de que el hogar lea con soltura la cifra de Hoy** (H1).

**NDB-04 · Cambiar de banco o subrogar: coste y punto de equilibrio** [H] · M · Medio-Alto · V
- *Qué:* costes de salir (comisión de cancelación, tasación, seguros y bonificaciones perdidas; qué asume cada parte según la normativa de crédito inmobiliario, verificar) frente al ahorro mensual: **meses para recuperar**, con sensibilidad a «si vendemos en N años» y la comparación con simplemente negociar (`D4`).
- *Por qué:* `DEB4` avisa de la ventana, no si compensa el trámite.

**NDB-05 · Evaluador de oferta de deuda nueva (letra pequeña)** [H] · M · Alto en el momento, uso raro · V (bajo demanda)
- *Qué:* TIN, comisiones, seguros vinculados (coste y obligatoriedad), bonificaciones condicionadas con su coste; calcula la **TAE efectiva con y sin vinculaciones**, el coste total, y «si dejáis de cumplir X, el tipo sube a Y»; lista de comprobación de la ficha informativa precontractual. El resultado se guarda en el registro de decisiones (`GOB10`).
- *Honestidad:* se usa una o dos veces al año. **Construirla cuando llegue una oferta real**, no antes (mismo criterio que la Cola B).

### Bloque E — Experiencia y hogar (`NXP`, `NHG`)

**NXP-01 · Prueba de hallazgo cronometrada, dentro de la app** [M] · S-M · Crítico · E (herramienta de medida)
- *Qué:* en Ajustes › Uso: «Prueba de 30 segundos». Pregunta «¿Cuánto podéis gastar hasta cobrar? Dilo y pulsa Listo»; cronometra desde entrar en Hoy, pide teclear la cifra y la **compara con la de la app** (misma cifra: sí/no); guarda tiempo, versión de la app y edad del saldo. Tres intentos; resumen con mediana y diferencia entre personas.
- *Por qué:* H1, H2 y H4 piden segundos y cifras que nadie midió. Con esto la regla v2 se evalúa con datos y no con una conversación. *Privacidad:* solo local; la cifra tecleada nunca se exporta.

**NXP-02 · Sello de versión y aviso de «versión nueva»** [C] · S · Alto · E
- *Qué:* chip discreto «v20261002s5a1 · cargada hace 3 h» y, cuando el *service worker* detecta una versión en espera, un aviso «Hay una versión nueva · Actualizar» que **solo recarga al tocar** (tras guardar borradores).
- *Por qué:* la caché es «primero caché»: la primera apertura tras un despliegue muestra la versión anterior (hipótesis 1 de H1). El sello lo diagnostica sin esperar; el aviso lo cura.

**NXP-03 · Procedencia bajo demanda (P12 mejorado)** [M][C] · M · Alto · H
- *Qué:* sustituir el bloque fijo «DATO REAL / LOCAL / Fuente» (120 px a 390 px) por un chip de una línea y, en cada cifra, un **ⓘ** que abre una hoja «Cómo se calcula»: fuente, fecha, método, confianza, qué la alimenta (enlaces a las entradas) y qué la haría cambiar. Reutiliza `A2-6`.
- *Por qué:* recupera ~120 px por encima del pliegue y sirve a la vez a la explicabilidad. *Gate:* toca la cabecera común, es decir, Hoy: espera H1.

**NXP-04 · Estados completos y *deshacer* en lugar de confirmar** [C] · M · Alto · E (accesibilidad/usabilidad)
- *Qué:* catálogo en `design-system.html` y aplicación: esqueletos para vistas pesadas (Control de deuda llegó a bloquear 12 s), estados vacíos con una acción primaria («Aún no hay posiciones · Añadir la primera · Pegar desde el bróker»), errores con causa y salida, avisos con **Deshacer** para lo reversible y confirmación solo para lo irreversible.
- *Por qué:* Nielsen 1, 5 y 9; `T16`/`T18` los trataron pantalla a pantalla.

**NXP-05 · Campo de importe unificado (es-ES)** [C] · S-M · Alto · E
- *Qué:* un componente `AmountInput`: `inputmode="decimal"`, acepta coma y punto, separador de miles al salir, pegado de «1.234,56 €», sin flechas, 44 px, signo explícito, `autocomplete="off"`, y ajuste al teclado con `visualViewport`.
- *Por qué:* hoy `type="number"` (verificado en `index.html`). Es la mejora de entrada más barata y se usa cada día.

**NXP-06 · Modo discreto y bloqueo por inactividad** [H] · S-M / M · Medio · V
- *Qué:* interruptor «ocultar cifras» (••••, toque para ver); ocultado automático al pasar a segundo plano (la captura del selector de apps de iOS); bloqueo opcional tras N minutos con **passkey** (WebAuthn).
- *Por qué:* una app con el patrimonio completo se abre en lugares públicos. *Esfuerzo:* el modo discreto es S-M; el bloqueo es M.

**NXP-07 · Modo consulta nivel 1 («una cifra»)** [M] · M · Medio · H
- *Qué:* **preferencia**, no permiso (`OPT22`: no se construye control de acceso por persona): Hoy se reduce a la cifra, su edad y dos líneas (próximo pago grande, próximo ingreso); el resto detrás de «Ver detalle», plegado por defecto. Son las decisiones D4/D5.
- *Gate:* H3 y H1.

**NHG-01 · Cuentas claras en pareja: titular explícito y liquidación mensual** [C] · M-L · Medio-Alto · V (Ola 4)
- *Qué:* campo `titular` (Javi/Tere/Común) por partida y movimiento, con `inferOwner` solo de respaldo; «quién pagó» en lo común; tarjeta mensual «Este mes X ha adelantado Y de gastos comunes: transferir Z para igualar», con regla elegible (50/50 · proporcional a ingresos · personalizada).
- *Por qué:* es el requisito previo que `OPT22` ya identificó; el reparto por titular existe (`A18`), el dato explícito no.

**NHG-02 · Reunión mensual del hogar (20 minutos)** [H] · M-L · Medio-Alto · V (Ola 4)
- *Qué:* una **pre-lectura** de un minuto para quien consulta (enlace de solo lectura, `canonical-share-link.js`) y una agenda generada: (1) resultado del mes (carta, NHG-05); (2) tres desviaciones mayores; (3) decisiones pendientes; (4) próximos 60 días; (5) acuerdos que se guardan en el registro de decisiones. Acta exportable.
- *Por qué:* con una persona que opera y otra que consulta, la reunión es el punto de sincronía. *Riesgo:* sobrecarga ritual: opcional.

**NHG-03 · Lista de deseos con enfriamiento** [H] · M · Medio-Bajo · V
- *Qué:* compras deseadas con precio y espera (7/30 días); muestra el veredicto del margen y el efecto en un objetivo («retrasa la vacación 11 días») y vuelve a preguntar al terminar la espera. Sin gamificación.
- *Mi nota:* es la propuesta con menos evidencia del documento; candidata a descartar.

**NHG-04 · Objetivos visuales** [C] · M · Medio-Alto · V (Ola 4)
- *Qué:* tarjetas con barra accesible (texto + %), **fecha estimada al ritmo actual vs. deseada**, y «+50 €/mes lo adelanta 4 meses», para objetivos compartidos o individuales. Sobre `E15`.

**NHG-05 · Carta del mes determinista** [C] · M · Medio-Alto · V (Ola 4)
- *Qué:* un párrafo de ≤ 120 palabras en **Cierre de mes**, sin IA generativa, de cinco huecos con plantillas y selectores: (1) resultado vs. previsión; (2) mayor desviación y su causa (`PVX5`); (3) un hito alcanzado; (4) una acción sugerida; (5) calidad del dato (NPV-08) («basado en un 78 % de datos reales»).
- *Dependencias:* NPV-03 y NPV-08. *Nota:* `app.js` tiene 82 líneas de margen; extraer antes (NTC-01).

### Bloque F — Técnica y gobierno (`NTC`), todas habilitadoras (E)

**NTC-01 · Extraer el motor de fechas a `canonical-timing.js`** [C] · M · Alto
- *Qué:* mover `expenseTimingForRow`, `incomeTimingForRow`, `expenseTimingFromMovements` y sus ayudantes a un módulo propio, con el patrón de S1 (equivalencia en casos aleatorios + datasets dorados sin diferencia). Recupera líneas de `app.js` y deja el *seam* limpio para ND-03 y NPV-01.
- *Riesgo:* bajo con la receta de S1; registrar en `index.html`, `service-worker.js`, `tools/build-public-site.mjs` y subir el recuento de `arq3`.

**NTC-02 · Generador de historiales sintéticos con verdad conocida** [H] · M · Alto
- *Qué:* un hogar ficticio con días de cargo, distribuciones de importe y choques conocidos, para (a) medir la **exactitud de la inferencia** de ND-03, (b) probar importadores y perfiles (ND-04), (c) **comprobar que P10-P90 contiene la realidad el ~80 % de las veces**: una calibración que los datos reales no darán en dos años.
- *Por qué:* hoy la calidad de las bandas no se puede verificar. Sin datos reales en el repositorio (público).

**NTC-03 · Contador de uso combinado de los dos móviles** [C] · S-M · Alto
- *Qué:* hoy el contador vive en cada navegador (por eso H6 exige abrir el informe en cada dispositivo). Sincronizar **solo agregados** `{pantalla: aperturas, última}` por dispositivo, con opción de apagarlo, y un informe único.
- *Por qué:* responde a H6, `OPT-10`–`OPT-13` y la Cola B con datos y sin chat. *Privacidad:* ningún dato financiero; revisión explícita.

**NTC-04 · Proyecto WebKit en la medición de carga** [C] · S-M · Medio
- *Qué:* añadir WebKit de Playwright a `measure-load`. Los dos móviles son iPhone; Chromium emulado no es Safari. No sustituye una medición real, pero es mucho más cercano. *Por qué ahora:* la hipótesis de carga de H1 (4,5 s repetida, 9,6 s primera) lo justifica.

**NTC-05 · Fecha de retirada del doble motor de deuda** [C] · L · Medio
- *Qué:* decidir con el hogar un horizonte: `debt-roadmap.html` ampliado en `D1` se alimenta del contrato canónico y el iframe queda como respaldo hasta N versiones con paridad en verde; después, se retira el motor heredado.
- *Aviso:* contradice parcialmente la decisión del hogar (ampliar el sandbox). Solo como pregunta.

**NTC-06 · Revisión de seguridad previa a cualquier conexión externa** [C] · S · Alto
- *Qué:* modelo de amenazas antes de ND-05, ND-12 o ND-13: secretos solo en funciones privadas, RLS, CORS y límites de tasa, registros sin datos personales, rotación y revocación de tokens, caducidad de consentimientos. Ninguna conexión nueva sin esto.

---

## 6. Resumen por bloque

| Bloque | Propuestas | Exentas (E) | De las pendientes incorporadas |
|---|---|---|---|
| A · Datos (`ND`) | 14 | 6 (ND-03, 04, 07, 08, 10, 11) | Ola 3 (ND-01, 02, 05, 14), `O-6` (ND-13) |
| B · Previsión (`NPV`) | 12 | 4 (NPV-02, 03, 07, 11) | C2 (NPV-03) |
| C · Inversión (`NIN`) | 10 | 0 | `I3` acelerada (NIN-02) |
| D · Deuda (`NDB`) | 5 | 0 | Ola 4 (NDB-01, 03) |
| E · Experiencia y hogar | 12 | 4 (NXP-01, 02, 04, 05) | P12 (NXP-03), D4/D5 (NXP-07), carta, objetivos, acta, pareja (NHG-01, 02, 04, 05) |
| F · Técnica (`NTC`) | 6 | 6 | UX-P3, UX-P4 |
| **Total** | **59** | **20** | **5 reformulaciones de pendientes**; **54 nuevas** |

---

## 7. Dependencias (qué desbloquea qué)

```
NTC-01 ─► ND-03 ─► NPV-08 ─► NPV-01 ─► (frase en Hoy, solo tras H1)
NPV-03 (C2) ─► NPV-02 ─► ajuste de bandas
          └──► NPV-10 ─► NHG-05
NXP-05 ─► ND-01 ─► ND-14
ND-11 ─► NDB-02          NIN-02 ─► NIN-03, NIN-01, I3
NTC-06 ─► ND-05, ND-12, ND-13      NXP-01 ─► abrir Ola 3
```

---

## 8. Descartadas tras el cruce con el código (no son huecos)

| Idea | Por qué no |
|---|---|
| Regla de recompra (2 meses/1 año) y traspaso entre fondos | Ya en `canonical-portfolio.js` (`FC2`, comentario de la regla legal) |
| Marcar gasto esencial/prescindible | Existe el eje `movementActionTypes` (deuda/discrecional/recurrente) y el colchón se basa en gasto esencial medio; solo falta la **palanca** (NPV-09) |
| Cuadre saldo declarado vs. extracto | Ya en Movimientos y Cierre (`M-8c`, `C-2`); lo que falta es usarlo para pedir menos (ND-01/ND-02) |
| Edición de posiciones | Existe parcial (tipo, etiqueta, ticker, cantidad, valor); falta coste, fecha y operaciones (NIN-06) |
| Comparador contra benchmark, coste de comisiones, DCA | `IVX2`, `IVX4`, `INV15`, `INV19`, `IVX7` |
| Amortizar o invertir, cancelar o mantener deuda, prioridad por fiscalidad | `AP1`, `DEB9`, `DEB5`, `DEB10` |
| Captura por voz | Decisión explícita del hogar (`DEX2`, `P7`): descartada |
| Widget nativo, simulador de reubicación, modo demostración | Marcados como las primeras candidatas a recortar en la auditoría de origen (`3.0` §4) |
| Interfaz del Copiloto/IA | Bloqueada por `A5-1`; construirla antes sería construirla para un backend que no responde |
| Más variantes de Monte Carlo o conjuntos | Precisión sin entrada que la respalde (D3) |
| Control de acceso por persona | `OPT22`: fuera de alcance |

*Aviso de alcance:* la **Cola B** (21 mejoras + 21 funcionalidades de la cuarta auditoría) vive en un artefacto externo que no he podido leer. Puede haber solapes que no he detectado: crucé solo contra el código y los backlogs del repositorio.

---

## 9. Cómo lo secuenciaría (recomendación, sujeta a las decisiones del §10)

Principios: la métrica se declara antes; como máximo **dos entregas visibles por ola**; lo exento puede avanzar en paralelo; nada sobre Hoy.

| Tramo | Contenido | Puerta | Métrica de salida |
|---|---|---|---|
| **0 · Semanas 1-2 («medir y desbloquear»)** | NXP-02 (sello de versión), NXP-01 (prueba cronometrada), NTC-03 (contador combinado), script de viabilidad de ND-03, decisión de C2 (H5), ND-13 (decidir spike), NTC-06 | E | Línea base con segundos; 2 personas; versión visible |
| **A · «La verdad entra barata»** (sem. 3-8) | NTC-01 → ND-03 · NPV-03 (C2) · NXP-05 · NPV-08 | E (4 entregas exentas) | % del gasto con fecha declarada/observada ≥ 70 %; actualizar saldos ≤ 20 s |
| **B · «Previsión que se contrasta»** (sem. 9-14) | NPV-02 (backtest) · ND-11 · ND-08 · luego NPV-01 | E + 1 visible | Primer backtest con datos; Euribor/IPC sin teclear |
| **C · «Inversión viva»** (sem. 12-18) | NIN-02 → NIN-01 · NIN-03 | 2 visibles | Valoraciones actualizadas ≥ mensualmente; «cómo voy» en 1 pantalla |
| **D · «Deuda con guion»** (sem. 16-22) | NDB-01 · NDB-02 | 2 visibles | «¿cuándo acabamos y qué cambia con más?» en < 30 s |
| **E · «Hogar»** (cuando haya H1/H3/H5) | NHG-05 · NHG-02 · NXP-03 · NXP-07 | H, tras re-medición | Reunión mensual celebrada ≥ 10 de 12 |

**Mi lista de los 10 que haría en 90 días:** NXP-02 · NXP-01 · NTC-03 · NPV-03 · NTC-01 · ND-03 · NPV-08 · NXP-05 · ND-01 · NIN-02.
**Siguientes (si los datos lo piden):** NPV-02 · ND-11 · NPV-01 · NIN-01 · NDB-01.
**Bajo demanda:** NDB-05 · NDB-04 · NIN-10 (antes de la Renta) · NDB-03.

### Métricas de éxito del conjunto
- **Tiempo hasta la verdad:** mediana ≤ 15 s para quien consulta y la misma cifra (NXP-01).
- **Coste de actualizar:** saldos ≤ 20 s; un gasto ≤ 8 s; un extracto completo ≤ 2 min.
- **Frescura:** saldos de ≤ 3 días en ≥ 90 % de los días (NTC-03/ND-09).
- **Resolución de la previsión:** ≥ 70 % del gasto con fecha declarada u observada.
- **Calibración:** cobertura de P10-P90 de caja ≈ 80 % tras ≥ 6 meses; error medio de caja decreciente.
- **Inversión:** valoraciones al día cada mes; ninguna posición con valor de hace más de 35 días.

---

## 10. Decisiones que necesito del hogar (con mi recomendación)

| # | Pregunta | Recomendación |
|---|---|---|
| 1 | ¿Se abre **C2** (cierre con saldo y mes anterior), sin tocar el RPC? | **Sí.** Exento, y es la piedra angular de la caja contrastada |
| 2 | ¿Quién consulta: puede hacer la **prueba de 30 s** (NXP-01) cuando exista y contestar qué decía la tarjeta con sus palabras? | Sí; sustituye a las cuatro preguntas del chat |
| 3 | ¿Aprobáis el **aviso de versión nueva** (toca el service worker)? | Sí, empezando por el sello (sin riesgo) |
| 4 | ¿Aceptáis **30 minutos** de alta del día de cargo de las partidas (una vez)? | Sí; sin eso la previsión diaria sigue en el día 8 |
| 5 | **PSD2:** ¿spike de 2 semanas con otro proveedor, o cerrar `O-6`? | Spike con criterio de salida |
| 6 | **Precios:** ¿manual rápido (NIN-02) o automático por ISIN (ND-12)? | Manual primero |
| 7 | ¿La hipoteca es **variable, mixta o fija**? | Decide la prioridad de NDB-02 |
| 8 | **Reparto en pareja:** ¿50/50, proporcional a ingresos u otro? ¿Campo de titular explícito? | Proporcional como opción, titular explícito |
| 9 | ¿Se activan `A5-1` / `A5-4` con fecha, o se dejan de arrastrar? | Activar con fecha o archivar |
| 10 | **H6:** ¿se retira algo el 23/10? | **No retirar nada**; esperar el contador combinado |
| 11 | ¿Modo discreto y bloqueo con passkey? | Modo discreto sí; passkey más tarde |
| 12 | ¿Validamos la premisa de que quien consulta usa Hoy como producto entero? | Sí, antes de más Ola 2 |

---

## 11. Lo que no he podido verificar

- **No he ejecutado la app ni visto los datos de uso** (los contadores viven en el navegador de cada móvil). Las cifras de recuento (59 pantallas, 7 secciones de deuda, `type="number"`, un único `fetch` de datos) salen de búsquedas en el repositorio.
- **GoCardless Bank Account Data:** una búsqueda indica que ha desactivado nuevas altas; hay que confirmarlo en su sitio. **Enable Banking** y otros ofrecen modo restringido para uso personal; **comprobar cobertura de CaixaBank y Banca Mediolanum**.
- **BCE:** la API de datos (`data-api.ecb.europa.eu`) es pública y sin clave y publica los Euribor mensuales; **CORS desde el navegador sin comprobar**.
- **iOS:** que Web Share Target no exista en Safari, que el enlace de un evento de calendario abra Safari y no la app instalada y el comportamiento exacto del bloqueo por passkey en PWA **deben probarse en vuestros iPhone**.
- **Cuestiones legales y fiscales** (garantía de depósitos, reparto de gastos en hipotecas, avisos de bienes en el extranjero, tributación de letras del Tesoro): **verificar con asesor** antes de rotular nada como definitivo.
- La **Cola B** vive en un artefacto externo que no he leído.

---

## 12. Fuentes
- [GoCardless Bank Account Data — alternativas con altas desactivadas](https://dev.to/johnfrandsen/gocardless-bank-account-data-alternatives-what-to-use-when-signups-are-disabled-326d)
- [Bank Account Data — visión general (GoCardless)](https://developer.gocardless.com/bank-account-data/overview)
- [Agregadores de API en España — Open Banking Tracker](https://openbankingtracker.com/api-aggregators?country=ES)
- [Datos del BCE por API sin clave (paquete readecb)](https://cran.nics.utk.edu/cran/web/packages/readecb/readme/README.html)
- Repositorio: `BACKLOG_INICIO_OLEADA_OCTUBRE.md`, `docs/OLA2_RECALIBRACION.md`, `BACKLOG_CONTABILIDADCASA_2_0.md`, `BACKLOG_CONTABILIDADCASA_3_0.md`, `PROJECT_STATE.md`.
