# Plan de desarrollo definitivo — Contabilidadcasa

Fecha: 3 de octubre de 2026 (sesiones 296-297; **reorganizado en 3 olas** tras la decisión del hogar de quitar el límite de entregas visibles). Estado: **desarrollo iniciado el 3/10/2026 (sesión 298); Ola 1 en curso.** Deriva de [`BACKLOG_DEFINITIVO.md`](../BACKLOG_DEFINITIVO.md), que es la única fuente viva (prioridades, niveles P0-P4, decisiones abiertas). Este documento dice **cómo** y **cuándo**; el backlog dice **qué** y **por qué en ese orden**.
**No contiene importes reales del hogar** (repositorio público).

> Las fechas son orientativas; **mandan las puertas**. Una ola no empieza hasta que la anterior cumple su salida, y nada empieza hasta que el hogar diga «empezamos».

---

## 1. Cómo se ejecuta cada paquete

1. **Un paquete (WP) = un PR**, con el ciclo de `CLAUDE.md`: `npm run verify` → `PROJECT_STATE.md` con cifras reales → commit y push a la rama de trabajo → PR en borrador → CI → fusión en verde. Nunca en rojo, nunca push directo a `main`, nunca a `finanzas-casa-def`.
2. **Antes de escribir código**, el paquete declara en su PR: la métrica que debe mover, su Δ de minutos por semana para el usuario (GOV-01) y si es visible o exento.
3. **Lógica pura en un módulo** (`canonical-*.js` o similar, probado en Node) y en `app.js` solo el enganche: `app.js` tiene 82 líneas de margen y un techo con trinquete.
4. **Pruebas:** cada paquete añade su `tests/<id>-*.test.cjs` con casos de oro, bordes y «dato ausente = no calculable» (criterio de toda la app: nunca un cero inventado).
5. **Ninguna conexión externa** sin la revisión de seguridad de WP-05 (NTC-06).
6. **Hecho** significa: CI verde, fusionado, desplegado, `BACKLOG_DEFINITIVO.md` actualizado (estado del ID), **el panel de seguimiento actualizado** (backlog §12) y, si es visible, una línea en el panel de uso que permita medirlo.

---

## 2. Mapa de olas

**Sin límite de entregas visibles** (decisión del hogar del 3/10/2026). El orden lo marcan las dependencias, las fechas y los datos. Dentro de cada ola, primero lo de mayor prioridad del backlog (P0 → P1 → P2). Esfuerzo en sesiones (S = 1, S-M = 1,5, M = 2,5, M-L = 3,5, L = 5).

| Ola | Fechas | Paquetes (en orden) | Sesiones | Salida (métrica) |
|---|---|---|---|---|
| **Ola 1 · Medir, dinero con fecha y verdad barata** | 5/10 - 23/10/2026 | WP-01 sello y novedades · WP-02 prueba cronometrada · WP-03 panel de uso · WP-04 viabilidad del día de cargo · WP-05 spike PSD2 + seguridad · WP-06 gobierno · WP-24 asignación personal · **WP-23 campaña fiscal** (se cierra antes del 15/11 con los datos que faltan) · WP-07 motor de fechas · WP-09 cierre con saldo · WP-10 medidor de calidad · WP-11 campo de importe · WP-25 enlaces prellenados | ≈ 21 | Línea base con saldos del día; panel de uso en marcha; cierre de octubre con saldo |
| **Ola 2 · Actualizar y capturar cuesta poco** | 26/10 - 20/11/2026 | WP-15 valoración de cartera · WP-26 saldos por excepción · WP-08 día de cargo · WP-27 cargos que no llegan · WP-14 cobros esperados · WP-13 índices oficiales · **WP-20 revisión del tipo variable** · WP-28 kit de gráficos · WP-30 hoja de captura · WP-31 nómina y retenciones · WP-32 recordatorios · WP-33 historiales sintéticos · WP-12 backtest | ≈ 32 | Actualizar saldos ≤ 20 s; un gasto ≤ 8 s; ≥ 70 % del gasto con fecha; próxima revisión de la hipoteca con cuota estimada |
| **Ola 3 · Previsión, inversión y deuda con guion** | 23/11/2026 - 22/1/2027 | *P1:* WP-29 carta del mes · WP-35 tres capas e ingresos inciertos · WP-36 anomalías · WP-37 estados completos · WP-52 WebKit · WP-38 plan B · WP-34 revisión base cero (se usa en enero). *P2:* WP-39 política de inversión · WP-40 CIRBE · WP-41 deuda en la sombra y TAE real · WP-53 sin duplicados · WP-21 paquete Renta · WP-17 cartera como tablero · WP-51 perfiles de extracto · WP-19 camino a deuda cero · WP-42 escalera del próximo euro · WP-16 banda de caja diaria · WP-43 puente de previsión · WP-18 aportado frente a valor · WP-44 calma, cobertura y exposición · WP-45 frescura y cola de tareas · WP-46 patrimonio neto · WP-47 reparto de nómina · WP-48 operaciones editables · WP-49 mapa anual de pagos · WP-50 vivienda y local por índice | ≈ 85 | Primera carta del mes; plan B y política firmados; «¿cuándo acabamos la deuda y qué cambia con más?» en < 30 s |
| **Maduración por datos** | febrero - mayo 2027 | Sin construcción: WP-12, WP-43 y WP-46 empiezan a dar resultado con 3 cierres (febrero); WP-21 con los datos de 2026 (marzo); `PRV-07` (P3) con 6 cierres (≈ mayo) | — | Primer backtest de caja con error medido |
| **Continuo** | trimestral desde diciembre | WP-54 prueba con 5 personas ajenas | 1/trim. | Hallazgos de usabilidad al backlog |

**Total estimado:** ≈ 138 sesiones (137,5 en las tres olas más la prueba trimestral; la suma exacta por paquete está en `docs/plan/plan-definitivo.json`) en unas 16 semanas (≈ 1,3 sesiones por día laborable, por debajo del ritmo histórico). **El cuello de botella pasa a ser tu tiempo**: revisar lo que cambia y usarlo. Por eso cada cambio visible se anuncia en «Novedades» (WP-01) y la regla de parada sigue en pie: si una ola entera no mueve ninguna métrica, se para antes de la siguiente.

## 3. Dependencias

```
WP-04 (viabilidad) ─► WP-07 (motor de fechas) ─► WP-08 (día de cargo) ─► WP-10 (medidor) ─► WP-16 (banda diaria)
                                         └─► WP-32 (recordatorios: «antes de cobrar»)
WP-09 (cierre con saldo) ─► WP-12 (backtest) ─► PRV-07 (P3)
                      ├─► WP-29 (carta del mes)
                      ├─► WP-43 (puente de previsión)
                      └─► WP-46 (patrimonio neto)
WP-11 (campo de importe) ─► WP-25 (enlaces prellenados) ─► WP-30 (hoja de captura) ─► WP-53 (sin duplicados)
                                                    └─► CAP-01 nivel 2 (P3)
WP-26 (saldos por excepción) ─► CAP-04 (P3, solo si sigue costando)
WP-15 (valoración) ─► WP-18 (aportado/valor) · WP-44 (calma) · I3 (P3) · WP-46
WP-39 (política de inversión) ─► WP-17 (cartera tablero) ─► WP-42 (escalera) ─► WP-47 (reparto de nómina)
WP-13 (índices) ─► WP-20 (tipo variable, si H7) · WP-50 (vivienda por índice)
WP-28 (kit de gráficos) ─► WP-35, WP-16, WP-43, WP-46, WP-49
WP-31 (nómina PDF) ─► WP-23 del año siguiente · WP-21 (Renta)
WP-05 (seguridad) ─► cualquier conexión externa (CAP-01 n2, CAP-03, UXS-01, UXS-02, ND-12)
WP-03 (panel de uso) ─► todas las salidas de ola y la revisión de retiradas de enero
```

---

## 4. Paquetes

### 4.1 Paquetes heredados de la quinta auditoría (WP-01…WP-21)

El enfoque técnico de cada uno está en `docs/PLAN_IMPLEMENTACION_2026-10-03.md` §4-§8 y **sigue valiendo**, con estos ajustes:

| WP | Ajuste |
|---|---|
| **WP-01** (sello de versión) | Se amplía con **«Novedades»**: una línea por cada cambio visible desplegado, junto al sello, con enlace a la pantalla. Sin límite de entregas visibles, es la forma de que el único usuario sepa qué ha cambiado |
| **WP-02** (prueba cronometrada) | **Un solo usuario.** La prueba se descarta si el saldo tiene más de 1 día (GOV-05) y registra si la app se abrió desde el icono. Incluye un interruptor de **texto del titular** para alternar por semanas A «Disponible para gastar» y B «≈ X €/día hasta cobrar» (PRV-06 y UXS-05): es un instrumento de medida, no una entrega. Si B gana con claridad, pasa a ser el texto definitivo con el OK del hogar |
| **WP-03** (contador de uso) | Se convierte en **panel de uso** (UXS-04): días activos por semana, frescura media de saldos, % del gasto registrado en < 48 h, decisiones registradas, y una pregunta semanal de minutos dedicados (R3). ~~Multi-dispositivo del mismo usuario (NTC-03 reducido)~~ **Un solo móvil (3/10/2026): contador local, sin sincronización** — quita el riesgo de tocar la sincronización y la revisión de privacidad que exigía. Solo agregados, sin importes |
| **WP-05** (spike PSD2) | La matriz de decisión compara **PSD2, Apple Pay + Atajos (CAP-01) y avisos del banco (CAP-03)** por cobertura, coste, fricción y riesgo. Criterio de salida a los 14 días |
| **WP-08** (día de cargo) | Prerrellenado desde los recurrentes (`A16-3`) para que sea «confirmar» (~10 min) y no «declarar» (30 min) |
| **WP-15** (valoración) | Sin cambios; es el hueco funcional más grave de inversión |
| **WP-21** (informe fiscal) | Se amplía con **FIS-03** (local alquilado) y la salida de WP-31 (retenciones): es el **paquete Renta** |
| **WP-20** (revisión de tipo variable) | **Activo: la hipoteca es variable** (3/10/2026). Necesita de Deuda › Contratos: índice, diferencial, periodicidad, fecha de la próxima revisión, regla del índice (media mensual o valor de un día) y bonificaciones. Con WP-13 (Euribor oficial del BCE): «próxima revisión el dd/mm: cuota estimada de A a B (±1 pt)», avisos a 60 y 30 días y evento de calendario (WP-32). Ola 2 |
| **WP-22** (tramo E «hogar») | **Retirado.** Sus piezas se reparten: NHG-05 → WP-29; ND-01/ND-02 → WP-26; ND-14 → WP-30; NXP-03, NHG-01, NHG-04, NDB-03 → P3; NXP-07, NHG-02 → archivo |

### 4.2 Paquetes nuevos (WP-23…WP-54)

Formato: *Qué · Dónde (código existente que se reutiliza) · Enfoque · Pruebas · Hecho cuando · Riesgo.*

**WP-23 · Campaña fiscal de fin de año** (FIS-01 + DAC-02 + FIS-02) · Ola 1 · visible · M+S+S ≈ 4 sesiones
- *Datos del hogar ya conocidos (3/10/2026):* tributación **individual** (cada titular con derecho tiene su propio tope de vivienda sobre lo que paga) y **sin plan de pensiones de empresa** (límite de 1.500 € individuales). Faltan, en el chat: lo pagado por la vivienda en 2026 por titular, si deducían los dos, el tipo marginal y las plusvalías o minusvalías realizadas. **Hipoteca variable:** la comisión por amortizar anticipadamente suele ser baja en los préstamos variables (*verificar la escritura*; la app ya avisa cuando la comisión baja de tramo), lo que abarata la acción (3).
- *Qué:* entre el 1/11 y el 31/12, una lista de acciones con su **ahorro estimado en euros**, fecha límite y estado («hecho»): (1) aportación al plan de pensiones hasta el límite que convenga; (2) compensación de plusvalías con minusvalías latentes respetando la regla de recompra; (3) **amortización de la hipoteca hasta llenar el tope de la deducción por vivienda del régimen transitorio** (15 % sobre un máximo de 9.040 € por declarante y año; *verificar el reparto estatal/autonómico y vuestra comunidad*), y aviso de que por encima no deduce; (4) donativos (80 % de los primeros 250 €); (5) **retención voluntaria** para equilibrar la Renta de junio (modelo 145); (6) deducciones autonómicas declaradas, como lista sin inventar tramos.
- *Dónde:* `canonical-irpf-estimator.js` (`estimateIrpfResult`, `marginalTaxOnAdditionalIncome`), `canonical-pension-simulator.js` (`limitForYear`, `simulateContribution`), `canonical-portfolio.js` (`yearEndCompensation`, `fifoLedger`), registro de supuestos fiscales (A15-1), exportación `.ics` existente (A17-2), sección `#herramientas-fiscal`. **No en Hoy.**
- *Enfoque:* módulo nuevo `canonical-year-end-tax.js` (puro) con una función por acción y un agregador que ordena por euros; datos del hogar (titulares, tributación, pagado por vivienda, plan de empresa) como supuestos fiscales nuevos, con migración del contrato de estado. Eventos de calendario el 1/12 y el 20/12.
- *Pruebas:* `tests/fis1-campana-fiscal.test.cjs`: tope de vivienda (por debajo, justo, por encima, dos declarantes, uno solo con derecho), límite de pensiones por año, compensación con y sin minusvalías, donativos en los dos tramos, «sin dato = no calculable».
- *Hecho cuando:* lista visible antes del 15/11 con las acciones aplicables y su euro estimado. *Riesgo:* normativa → cada acción con su fuente y la etiqueta «estimación; confirmar con asesor».

**WP-24 · Asignación personal** (HOG-02) · Ola 1 · configuración · S
- *Qué:* una línea de plan por persona («Asignación personal») que se ejecuta como transferencia mensual y no se detalla. Los gastos de esa cuenta o tarjeta no se piden en la bandeja.
- *Enfoque:* sin módulo nuevo: partida del plan + regla de clasificación que agrupa los movimientos de esa cuenta en la partida. Si hace falta código, solo una marca «sin detalle» en la partida.
- *Hecho cuando:* activa el 1/11; revisión a finales de enero (¿bajaron los minutos? ¿se mantiene?).

**WP-25 · Enlaces de registro prellenado** (CAP-02 + plantilla de CAP-01) · Ola 1 · exento · S
- *Qué:* `…/#registrar?importe=&concepto=&fecha=&cuenta=&origen=` abre la **ventana de registro existente** con los campos rellenos. Nunca guarda solo. Más una guía paso a paso del Atajo «Transacción» de iOS que construye ese enlace con cada pago de Apple Pay.
- *Dónde:* el enrutado por `#` de `ux-shell.js`, `parseAmount` (ya acepta coma, punto y «€»), el modal de registro (`FLU-2`).
- *Enfoque:* módulo puro `canonical-capture-link.js` (parseo y validación, rechaza HTML y valores fuera de rango); enganche de una línea en el enrutado. **Verificar** que el enrutado acepta parámetros tras el `#` sin romper la navegación actual.
- *Pruebas:* 30 casos (válidos, malformados, inyección, fecha «hoy», importes con miles). *Riesgo:* bajo; el enlace no guarda nada.

**WP-26 · Saldos por excepción y extracto que actualiza saldo** (ND-01 + ND-02) · Ola 2 · visible · M+S-M ≈ 4
- *Qué:* «Actualizar saldos» muestra el **saldo esperado** por cuenta con «Coincide» / «Corregir»; al importar un extracto, propone usar su saldo final y comprueba la continuidad del saldo corrido.
- *Dónde:* `latestStatementBalance`, cuadre de Movimientos/Cierre (`M-8c`, `C-2`), importación E11b (`canonical-e11b-inbox.js`), WP-11 (campo de importe).
- *Hecho cuando:* actualizar las cuentas ≤ 20 s (panel de uso / WP-02). *Riesgo:* «Coincide» sin mirar → la diferencia se muestra siempre que supere una tolerancia.

**WP-27 · Cargos que no llegaron** (CAP-06) · Ola 2 · exento · S-M ≈ 2
- *Dónde:* recurrentes de `A16-3`, bandeja (`buildInboxItem`), fechas de WP-08. *Enfoque:* detector puro que, pasada la ventana + 3 días sin movimiento casado, crea una tarjeta con las cuatro respuestas (baja · cambio de cuenta · llegará tarde · pagado de otra forma) y ajusta la previsión según la respuesta.
- *Pruebas:* ventana, festivos, recibo bimestral, recibo dado de baja. *Hecho cuando:* ningún recibo esperado sin estado más de 3 días.

**WP-28 · Kit de gráficos** (NPV-07) · Ola 2 · exento (accesibilidad) · M-L ≈ 3,5
- Módulo `chart-kit` (SVG propio, sin librerías): recorrido táctil con lectura fija, teclado, frase automática, «ver como tabla», tokens de `design-tokens.css`, `prefers-reduced-motion`. Migrar primero el cono de previsión. Habilita WP-35, WP-16, WP-43, WP-46 y WP-49. Saca código de `app.js`.

**WP-29 · Carta del mes** (NHG-05) · Ola 3 · visible · M ≈ 2,5
- *Qué:* un párrafo determinista de ≤ 120 palabras en **Cierre de mes** con cinco huecos: resultado frente a previsión, mayor desviación y su causa (`PVX5`), un hito, una acción sugerida y la calidad del dato (WP-10).
- *Dónde:* registro del cierre de WP-09, `canonical-month-close.js`. Módulo `canonical-month-letter.js` (plantillas y selectores; sin IA generativa).
- *Hecho cuando:* primera carta con el cierre de diciembre (1-3/1/2027).

**WP-30 · Hoja de captura en ≤ 8 s** (ND-14) · Ola 2 · visible · M ≈ 2,5
- Hoja inferior con el importe primero (teclado abierto), los 5 conceptos más frecuentes a esa hora, «hoy/ayer», guardar con la tecla «hecho» y deshacer 8 s. Es la misma hoja que abre WP-25. Métrica: mediana ≤ 8 s (WP-02).

**WP-31 · Nómina en PDF y retenciones automáticas** (CAP-05 + NPV-11) · Ola 2 · exento · M+S-M ≈ 4
- *Enfoque:* lector de texto de PDF cargado bajo demanda (mismo patrón que el OCR de A17-3; *verificar* librería, tamaño y licencia) o captura + OCR; plantilla por pagador; extrae líquido, bruto, retención %, cotizaciones; crea el ingreso real, acumula `irpfWithholdingsPaid` y avisa si cambia el %. El PDF no se guarda.
- *Pruebas:* nóminas sintéticas por plantilla, paga extra, regularización a mitad de año.

**WP-32 · Recordatorios en el momento de máximo valor** (CAP-09, absorbe ND-10) · Ola 2 · fuera de la app · S
- Calendario suscribible regenerado con la previsión: 2 días antes de cobrar, el día siguiente a un cargo grande, el día 1 (cerrar el mes), el 1/12 (campaña fiscal). Reutiliza la exportación `.ics` de `app.js`.

**WP-33 · Historiales sintéticos** (NTC-02) · Ola 2 · exento · M ≈ 2,5
- `tools/build-synthetic-household.mjs` (patrón de `tools/build-golden-datasets.mjs`): un hogar ficticio con días de cargo, distribuciones y sobresaltos conocidos. Sirve para medir la sugerencia de WP-08, probar WP-51 y calibrar la banda de WP-16 (que P10-P90 contenga la realidad ≈ 80 % de las veces).

**WP-34 · Revisión base cero del plan** (PRV-08) · Ola 3 (se usa en enero) · visible · S-M ≈ 1,5
- Una partida por pantalla con sus 12 meses de real: mantener · ajustar a lo real · eliminar; progreso y guardado parcial. Marca «revisada (fecha)» por partida (campo nuevo en `customPlanningRows` → migración del contrato de estado).

**WP-35 · Previsión en tres capas e ingresos inciertos** (PRV-02 + PRV-04) · Ola 3 · visible · M+M ≈ 5
- Separar salidas en comprometidas / probables / discrecionales con el eje `movementActionTypes`; certeza por ingreso (confirmado · probable · incierto, con probabilidad y ventana; vacancia del local). La cifra de Hoy solo cuenta los confirmados (sin cambio visible en Hoy). Barras apiladas con patrón (kit de WP-28).

**WP-36 · Anomalías del extracto** (ND-07) · Ola 3 · exento · M ≈ 2,5
- Detector puro sobre movimientos importados: cargo duplicado, devolución de recibo, comisión nueva, recurrente fuera del plan, importe > P95 de su partida. A la bandeja con evidencia; nunca actúa. Objetivo: falsos positivos < 20 %.

**WP-37 · Estados completos y deshacer** (NXP-04) · Ola 3 → continuo · exento · M
- Catálogo en `design-system.html` (vacío accionable, carga con esqueleto, error con causa y salida, sin conexión, dato obsoleto, éxito con deshacer) y aplicación pantalla a pantalla cuando cada paquete la toque.

**WP-38 · Plan B acordado en frío** (PRV-05 + NPV-09) · Ola 3 · visible · M+M ≈ 4
- Asistente de 3 pasos (disparador · acciones ordenadas · fecha y firma). Almacén nuevo (clasificar en `BACKUP_LOCAL_STORES`). Evaluación del disparador con la previsión en cada recálculo; efecto de las acciones con escenarios de `E13`; palanca de recorte discrecional (NPV-09) como una de las acciones. Nunca ejecuta.

**WP-39 · Política de inversión** (CAR-01) · Ola 3 · visible · M ≈ 2,5
- Seis preguntas con valores prerrellenados desde lo ya declarado (objetivos E15, umbral de rebalanceo INV2, convicción I12, desapalancamiento LEV11); vista de una página; firma con fecha; revisión anual. **Es la fuente de reglas de WP-17** y de los avisos «esta operación contradice vuestra regla N».

**WP-40 · Conciliación con la CIRBE** (DAC-01) · Ola 3 · exento · S-M ≈ 1,5
- Tabla de introducción manual del informe (operación, entidad, tipo, importe, titularidad) y conciliación con el inventario de `canonical-debt-contracts.js`; estados «cuadra · falta en la app · diferencia». Recordatorio anual.

**WP-41 · Deuda en la sombra y TAE real** (DAC-04 + DNU-03) · Ola 3 · exento · M+S ≈ 3,5
- Detector sobre recurrentes con fecha de fin (financiación en factura, aplazamientos, permanencias) → propuesta de alta como deuda corta. Función pura de TAE efectiva (TIR con comisiones y seguros) para lo detectado y para ofertas «al 0 %».

**WP-42 · Escalera del próximo euro** (CAR-03 + NIN-05 + NIN-08) · Ola 3 · visible · M+M+M ≈ 7
- Orden integrado: colchón (`cushionFloor`) → deuda con coste neto alto (`netDebtCostAfterTax`, `DEB10`) → plan de pensiones hasta el límite si el tipo marginal lo justifica (`limitForYear`, `marginalTaxOnAdditionalIncome`) → fondos traspasables → amortizar o invertir (`AP1`). Dentro de la inversión, **rebalanceo por aportaciones** (sin vender) y destino de la liquidez ociosa (comparador neto de impuestos con tipos de WP-13 o tecleados con fecha). Cada peldaño con su euro de beneficio esperado y su coste de liquidez.

**WP-43 · Puente de previsión** (PRV-01) · Ola 3 · visible · M ≈ 2,5
- Congelar en cada cierre la previsión a 31/12 (almacén por mes); cascada entre dos previsiones sucesivas (ingresos, gasto recurrente, extraordinarios, mercado, deuda/supuestos). Reutiliza `analisisCascadaHtml` (A-4) y `netWorthWaterfall`.

**WP-44 · Calma, cobertura y exposición** (CAR-02 + CAR-05 + CAR-06) · Ola 3 · visible · S-M+S+S ≈ 3,5
- Caída desde máximos con los snapshots de WP-15, en € y en meses de aportación, con la política de WP-39; proporción del gasto cubierta por rentas (`rentalAssetPnL`, dividendos y retirada sostenible de `LPX1`); exposición por entidad (depósitos cubiertos por el fondo de garantía, fondos segregados, seguros de ahorro; *verificar límites*).

**WP-45 · Frescura y cola de tareas por valor** (ND-09 + CAP-07) · Ola 3 · visible · S+M ≈ 3,5
- Fichas de frescura por fuente (`canonical-data-age.js`) y una cola ordenada por «euros de incertidumbre por minuto» con la sensibilidad de `canonical-forecast-sensitivity.js` y los tiempos medidos en WP-03.

**WP-46 · Patrimonio neto: serie y proyección** (NPV-10) · Ola 3 · visible · L ≈ 5
- Serie mensual (efectivo de los cierres de WP-09, posiciones de WP-15, vivienda y local, deuda) y abanico de tres escenarios con hitos (deuda cero, objetivos, jubilación de `GOB11`). Estado vacío honesto con < 3 cierres.

**WP-47 · Reparto de la nómina en un paso** (NPV-05) · Ola 3 · visible · M ≈ 2,5
- Al confirmarse la nómina (WP-14), hoja con las filas de la escalera de WP-42 prerrellenadas; *steppers* que siempre suman el disponible tras el suelo; «Aplicar» crea un borrador y una lista de transferencias a hacer (nunca ejecuta).

**WP-48 · Operaciones de cartera editables e importador** (NIN-06) · Ola 3 · visible · L ≈ 5
- Libro de operaciones por posición editable con recálculo FIFO (`fifoLedger`) y diff antes/después; importación pegando el CSV del bróker con deduplicación. Pruebas de oro fiscales con `FIN-2`.

**WP-49 · Mapa anual de pagos grandes** (NPV-04) · Ola 3 · visible · M ≈ 2,5
- Franja de 12 meses con los pagos grandes y su nivel de financiación por sobre (`financialCalendar` y sobres), múltiplos pequeños con etiquetado directo.

**WP-50 · Vivienda y local por índice** (CAR-04) · Ola 3 · visible / tercero · S-M ≈ 1,5
- Revalorización trimestral desde el último valor declarado con un índice público (*verificar* fuente accesible y CORS; si no, vía función privada tras WP-05). Chip «estimado por índice». Alimenta LTV y patrimonio.

**WP-51 · Perfiles de extracto** (ND-04) · Ola 3 · exento · M ≈ 2,5 — autodetección de delimitador, decimales, fechas, signo, filas de título y codificación; errores por fila; corpus anonimizado (WP-33).

**WP-52 · WebKit en la medición de carga** (NTC-04) · Ola 3 · exento · S-M ≈ 1,5 — proyecto WebKit de Playwright en `tools/measure-load.mjs`.

**WP-53 · Sin duplicados entre canales** (CAP-10) · Ola 3 · exento · M ≈ 2,5 — emparejamiento por importe exacto, fecha ±2 días y comercio por similitud entre captura manual, enlaces de WP-25 y extracto; el extracto manda en importe y fecha.

**WP-54 · Prueba con 5 personas ajenas** (GOV-06) · trimestral desde diciembre · proceso · 1 sesión por trimestre — guion de 5 tareas con datos de demostración, 30 min por persona, hallazgos al backlog con su evidencia.

---

## 5. Lo que necesita el hogar y cuándo

| Cuándo | Qué | Para |
|---|---|---|
| Antes de la Ola 1 | Decir «empezamos» | Todo |
| Ola 1, semana 1 | Actualizar saldos y hacer la prueba cronometrada 3 veces (≈ 5 min) | WP-02 |
| **≈ 20/10** | **Datos fiscales que faltan, en el chat** (backlog §8) | WP-23 |
| Ola 2 | Datos del contrato de la hipoteca (índice, diferencial, revisión, bonificaciones) en Deuda › Contratos | WP-20 |
| 1/11 | Hacer la primera transferencia de asignación personal | WP-24 |
| Ola 2 | ≈ 10 min de confirmar días de cargo prerrellenados | WP-08 |
| Cada 1-3 del mes | Cerrar el mes anterior con saldo | WP-09 y siguientes |
| 30/11 | Activar o archivar `A5-1`/`A5-4` | H8 |
| Ola 3 (diciembre) | Contestar las preguntas de la política de inversión y del plan B | WP-38, WP-39 |
| Enero | Revisión base cero (≈ 15 min) y revisión de la asignación personal | WP-34, WP-24 |
| Al cerrar cada ola | Mirar «Novedades» y el panel de uso (≈ 5 min) | Regla de parada |
| Cada trimestre | Proponer 5 personas para la prueba de usabilidad (opcional) | WP-54 |

---

## 6. Riesgos

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| **La app sigue sin usarse a diario** y se construye para nadie | Alta | Panel de uso desde la Ola 1; regla de parada por olas; la captura y la actualización (Olas 1-2) van antes que el análisis |
| Normativa fiscal mal aplicada en WP-23 | Media | Cada acción con fuente y etiqueta «estimación»; pruebas de oro; confirmar con asesor antes de actuar |
| Techo de `app.js` | Alta | Módulo por paquete; WP-07 libera líneas; el guardián lo vigila |
| Contrato de estado: migraciones en WP-23, WP-34, WP-35, WP-38 | Media | Migración con la herramienta y *fixtures* regenerados; nunca a mano |
| Dependencias de terceros (índices, PDF, Atajos de iOS) | Media | Todo con camino manual de respaldo; verificar en los iPhone antes de dar por bueno |
| Un solo usuario: la persona que mide es la que diseña | Alta | WP-54 (personas ajenas) y medición con datos frescos |
| **Demasiados cambios visibles para una persona** (sin límite, la Ola 3 trae ≈ 20 cambios visibles en 8 semanas) | **Alta** | «Novedades» en cada despliegue; regla de parada por olas; si el panel de uso muestra que el uso baja, Claude lo dice y propone frenar |
