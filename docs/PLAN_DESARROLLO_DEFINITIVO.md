# Plan de desarrollo definitivo — Contabilidadcasa

Fecha: 3 de octubre de 2026 (sesión 296). Estado: **plan aprobado como documento; desarrollo no iniciado por decisión del hogar.** Deriva de [`BACKLOG_DEFINITIVO.md`](../BACKLOG_DEFINITIVO.md), que es la única fuente viva (prioridades, niveles P0-P4, decisiones abiertas). Este documento dice **cómo** y **cuándo**; el backlog dice **qué** y **por qué en ese orden**.
**No contiene importes reales del hogar** (repositorio público).

> Las fechas son orientativas; **mandan las puertas**. Un tramo no empieza hasta que el anterior cumple su salida, y nada empieza hasta que el hogar diga «empezamos».

---

## 1. Cómo se ejecuta cada paquete

1. **Un paquete (WP) = un PR**, con el ciclo de `CLAUDE.md`: `npm run verify` → `PROJECT_STATE.md` con cifras reales → commit y push a la rama de trabajo → PR en borrador → CI → fusión en verde. Nunca en rojo, nunca push directo a `main`, nunca a `finanzas-casa-def`.
2. **Antes de escribir código**, el paquete declara en su PR: la métrica que debe mover, su Δ de minutos por semana para el usuario (GOV-01) y si es visible o exento.
3. **Lógica pura en un módulo** (`canonical-*.js` o similar, probado en Node) y en `app.js` solo el enganche: `app.js` tiene 82 líneas de margen y un techo con trinquete.
4. **Pruebas:** cada paquete añade su `tests/<id>-*.test.cjs` con casos de oro, bordes y «dato ausente = no calculable» (criterio de toda la app: nunca un cero inventado).
5. **Ninguna conexión externa** sin la revisión de seguridad de WP-05 (NTC-06).
6. **Hecho** significa: CI verde, fusionado, desplegado, `BACKLOG_DEFINITIVO.md` actualizado (estado del ID) y, si es visible, una línea en el panel de uso que permita medirlo.

---

## 2. Mapa de tramos

Tramos de 4 semanas (lunes a viernes de la cuarta semana) con **máximo 2 entregas visibles**; lo exento va en paralelo. Esfuerzo en sesiones (S = 1, S-M = 1,5, M = 2,5, M-L = 3,5, L = 5).

| Tramo | Fechas | Visibles (máx. 2) | Exentos y fuera de la app | Sesiones | Salida (métrica) |
|---|---|---|---|---|---|
| **T0 · Medir y desbloquear** | 5/10 - 16/10/2026 | — | WP-01 sello · WP-02 prueba cronometrada · WP-03 panel de uso · WP-04 viabilidad del día de cargo · WP-05 spike PSD2 + seguridad · WP-06 gobierno · WP-24 asignación personal · **inicio de WP-23** | ≈ 9 | Línea base con un usuario y saldos del día; panel de uso en marcha |
| **T1 · Dinero con fecha y verdad barata** | 19/10 - 13/11 | **WP-23 campaña fiscal** · WP-10 medidor de calidad | WP-07 motor de fechas · WP-09 cierre con saldo · WP-11 campo de importe · WP-25 enlaces prellenados | ≈ 13 | Campaña lista antes del 15/11; cierre de octubre con saldo |
| **T2 · Actualizar cuesta poco** | 16/11 - 11/12 | WP-15 valoración de cartera · WP-26 saldos por excepción | WP-08 día de cargo · WP-27 cargos que no llegan · WP-14 cobros esperados · WP-13 índices oficiales · WP-28 kit de gráficos | ≈ 17 | Actualizar saldos ≤ 20 s; ≥ 70 % del gasto con fecha |
| **T3 · Cierre y captura** | 14/12 - 8/1/2027 | WP-29 carta del mes · WP-30 hoja de captura | WP-12 backtest · WP-31 nómina y retenciones · WP-32 recordatorios · WP-33 historiales sintéticos | ≈ 15 | Primera carta (cierre de diciembre); un gasto ≤ 8 s |
| **T4 · Previsión que se entiende** | 11/1 - 5/2 | WP-34 revisión base cero · WP-35 tres capas e ingresos inciertos | WP-36 anomalías · WP-37 estados completos (continuo) · WP-52 WebKit | ≈ 13 | Plan revisado; previsión separada por certeza |
| **T5 · Plan B e inversión con reglas** | 8/2 - 5/3 | WP-38 plan B · WP-39 política de inversión | WP-40 CIRBE · WP-41 deuda en la sombra y TAE real · WP-53 sin duplicados | ≈ 14 | Plan B y política firmados |
| **T6 · Renta y cartera** | 8/3 - 2/4 | WP-21 paquete Renta (inversión y local) · WP-17 cartera como tablero | WP-51 perfiles de extracto | ≈ 11 | Informe fiscal antes del 31/3 |
| **T7 · Deuda y ahorro** | 5/4 - 30/4 | WP-19 camino a deuda cero · WP-42 escalera del próximo euro | — | ≈ 10 | «¿Cuándo acabamos y qué cambia con más?» en < 30 s |
| **T8 · Caja diaria** | 3/5 - 28/5 | WP-16 banda de caja diaria · WP-43 puente de previsión | — | ≈ 8 | Probabilidad de cruzar el suelo visible |
| **T9 · Cartera madura** | 31/5 - 25/6 | WP-18 aportado frente a valor · WP-44 calma, cobertura y exposición | — | ≈ 6 | Rentabilidad TWR y XIRR explicadas |
| **T10 · Datos y patrimonio** | 28/6 - 23/7 | WP-45 frescura y cola de tareas · WP-46 patrimonio neto | — | ≈ 8 | Serie de patrimonio con ≥ 6 cierres |
| **T11 · Reparto y operaciones** | 26/7 - 20/8 | WP-47 reparto de nómina · WP-48 operaciones editables | — | ≈ 8 | Asignación de la nómina < 60 s |
| **T12 · Calendario y vivienda** | 23/8 - 17/9 | WP-49 mapa anual de pagos · WP-50 vivienda y local por índice | — | ≈ 4 | — |
| **Continuo** | trimestral desde T3 | — | WP-54 prueba con 5 personas ajenas | 1/trim. | Hallazgos de usabilidad al backlog |

**Total estimado:** ≈ 140 sesiones de desarrollo en 12 meses. Con el ritmo histórico (unas cinco sesiones al día desde agosto) **el calendario lo marca la regla de entregas visibles, no la capacidad**. Si el hogar quiere ir más rápido, la palanca es pasar a **3 visibles por tramo** (el plan acabaría hacia mayo de 2027), a costa de más cambios por mes para un solo usuario.

**Si H7 = variable o mixta:** WP-20 (revisión de tipo) entra en T6 o T7 como visible y desplaza WP-17 o WP-42 un tramo.

---

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
WP-03 (panel de uso) ─► todas las salidas de tramo y la revisión de retiradas de enero
```

---

## 4. Paquetes

### 4.1 Paquetes heredados de la quinta auditoría (WP-01…WP-21)

El enfoque técnico de cada uno está en `docs/PLAN_IMPLEMENTACION_2026-10-03.md` §4-§8 y **sigue valiendo**, con estos ajustes:

| WP | Ajuste |
|---|---|
| **WP-02** (prueba cronometrada) | **Un solo usuario.** La prueba se descarta si el saldo tiene más de 1 día (GOV-05) y registra si la app se abrió desde el icono. Incluye un interruptor de **texto del titular** para alternar por semanas A «Disponible para gastar» y B «≈ X €/día hasta cobrar» (PRV-06 y UXS-05): es un instrumento de medida, no una entrega. Si B gana con claridad, pasa a ser el texto definitivo con el OK del hogar |
| **WP-03** (contador de uso) | Se convierte en **panel de uso** (UXS-04): días activos por semana, frescura media de saldos, % del gasto registrado en < 48 h, decisiones registradas, y una pregunta semanal de minutos dedicados (R3). Multi-dispositivo del mismo usuario (NTC-03 reducido). Solo agregados, sin importes |
| **WP-05** (spike PSD2) | La matriz de decisión compara **PSD2, Apple Pay + Atajos (CAP-01) y avisos del banco (CAP-03)** por cobertura, coste, fricción y riesgo. Criterio de salida a los 14 días |
| **WP-08** (día de cargo) | Prerrellenado desde los recurrentes (`A16-3`) para que sea «confirmar» (~10 min) y no «declarar» (30 min) |
| **WP-15** (valoración) | Sin cambios; es el hueco funcional más grave de inversión |
| **WP-21** (informe fiscal) | Se amplía con **FIS-03** (local alquilado) y la salida de WP-31 (retenciones): es el **paquete Renta** |
| **WP-22** (tramo E «hogar») | **Retirado.** Sus piezas se reparten: NHG-05 → WP-29; ND-01/ND-02 → WP-26; ND-14 → WP-30; NXP-03, NHG-01, NHG-04, NDB-03 → P3; NXP-07, NHG-02 → P4 |

### 4.2 Paquetes nuevos (WP-23…WP-54)

Formato: *Qué · Dónde (código existente que se reutiliza) · Enfoque · Pruebas · Hecho cuando · Riesgo.*

**WP-23 · Campaña fiscal de fin de año** (FIS-01 + DAC-02 + FIS-02) · T0-T1 · visible · M+S+S ≈ 4 sesiones
- *Qué:* entre el 1/11 y el 31/12, una lista de acciones con su **ahorro estimado en euros**, fecha límite y estado («hecho»): (1) aportación al plan de pensiones hasta el límite que convenga; (2) compensación de plusvalías con minusvalías latentes respetando la regla de recompra; (3) **amortización de la hipoteca hasta llenar el tope de la deducción por vivienda del régimen transitorio** (15 % sobre un máximo de 9.040 € por declarante y año; *verificar el reparto estatal/autonómico y vuestra comunidad*), y aviso de que por encima no deduce; (4) donativos (80 % de los primeros 250 €); (5) **retención voluntaria** para equilibrar la Renta de junio (modelo 145); (6) deducciones autonómicas declaradas, como lista sin inventar tramos.
- *Dónde:* `canonical-irpf-estimator.js` (`estimateIrpfResult`, `marginalTaxOnAdditionalIncome`), `canonical-pension-simulator.js` (`limitForYear`, `simulateContribution`), `canonical-portfolio.js` (`yearEndCompensation`, `fifoLedger`), registro de supuestos fiscales (A15-1), exportación `.ics` existente (A17-2), sección `#herramientas-fiscal`. **No en Hoy.**
- *Enfoque:* módulo nuevo `canonical-year-end-tax.js` (puro) con una función por acción y un agregador que ordena por euros; datos del hogar (titulares, tributación, pagado por vivienda, plan de empresa) como supuestos fiscales nuevos, con migración del contrato de estado. Eventos de calendario el 1/12 y el 20/12.
- *Pruebas:* `tests/fis1-campana-fiscal.test.cjs`: tope de vivienda (por debajo, justo, por encima, dos declarantes, uno solo con derecho), límite de pensiones por año, compensación con y sin minusvalías, donativos en los dos tramos, «sin dato = no calculable».
- *Hecho cuando:* lista visible antes del 15/11 con las acciones aplicables y su euro estimado. *Riesgo:* normativa → cada acción con su fuente y la etiqueta «estimación; confirmar con asesor».

**WP-24 · Asignación personal** (HOG-02) · T0 · configuración · S
- *Qué:* una línea de plan por persona («Asignación personal») que se ejecuta como transferencia mensual y no se detalla. Los gastos de esa cuenta o tarjeta no se piden en la bandeja.
- *Enfoque:* sin módulo nuevo: partida del plan + regla de clasificación que agrupa los movimientos de esa cuenta en la partida. Si hace falta código, solo una marca «sin detalle» en la partida.
- *Hecho cuando:* activa el 1/11; revisión a finales de enero (¿bajaron los minutos? ¿se mantiene?).

**WP-25 · Enlaces de registro prellenado** (CAP-02 + plantilla de CAP-01) · T1 · exento · S
- *Qué:* `…/#registrar?importe=&concepto=&fecha=&cuenta=&origen=` abre la **ventana de registro existente** con los campos rellenos. Nunca guarda solo. Más una guía paso a paso del Atajo «Transacción» de iOS que construye ese enlace con cada pago de Apple Pay.
- *Dónde:* el enrutado por `#` de `ux-shell.js`, `parseAmount` (ya acepta coma, punto y «€»), el modal de registro (`FLU-2`).
- *Enfoque:* módulo puro `canonical-capture-link.js` (parseo y validación, rechaza HTML y valores fuera de rango); enganche de una línea en el enrutado. **Verificar** que el enrutado acepta parámetros tras el `#` sin romper la navegación actual.
- *Pruebas:* 30 casos (válidos, malformados, inyección, fecha «hoy», importes con miles). *Riesgo:* bajo; el enlace no guarda nada.

**WP-26 · Saldos por excepción y extracto que actualiza saldo** (ND-01 + ND-02) · T2 · visible · M+S-M ≈ 4
- *Qué:* «Actualizar saldos» muestra el **saldo esperado** por cuenta con «Coincide» / «Corregir»; al importar un extracto, propone usar su saldo final y comprueba la continuidad del saldo corrido.
- *Dónde:* `latestStatementBalance`, cuadre de Movimientos/Cierre (`M-8c`, `C-2`), importación E11b (`canonical-e11b-inbox.js`), WP-11 (campo de importe).
- *Hecho cuando:* actualizar las cuentas ≤ 20 s (panel de uso / WP-02). *Riesgo:* «Coincide» sin mirar → la diferencia se muestra siempre que supere una tolerancia.

**WP-27 · Cargos que no llegaron** (CAP-06) · T2 · exento · S-M ≈ 2
- *Dónde:* recurrentes de `A16-3`, bandeja (`buildInboxItem`), fechas de WP-08. *Enfoque:* detector puro que, pasada la ventana + 3 días sin movimiento casado, crea una tarjeta con las cuatro respuestas (baja · cambio de cuenta · llegará tarde · pagado de otra forma) y ajusta la previsión según la respuesta.
- *Pruebas:* ventana, festivos, recibo bimestral, recibo dado de baja. *Hecho cuando:* ningún recibo esperado sin estado más de 3 días.

**WP-28 · Kit de gráficos** (NPV-07) · T2 · exento (accesibilidad) · M-L ≈ 3,5
- Módulo `chart-kit` (SVG propio, sin librerías): recorrido táctil con lectura fija, teclado, frase automática, «ver como tabla», tokens de `design-tokens.css`, `prefers-reduced-motion`. Migrar primero el cono de previsión. Habilita WP-35, WP-16, WP-43, WP-46 y WP-49. Saca código de `app.js`.

**WP-29 · Carta del mes** (NHG-05) · T3 · visible · M ≈ 2,5
- *Qué:* un párrafo determinista de ≤ 120 palabras en **Cierre de mes** con cinco huecos: resultado frente a previsión, mayor desviación y su causa (`PVX5`), un hito, una acción sugerida y la calidad del dato (WP-10).
- *Dónde:* registro del cierre de WP-09, `canonical-month-close.js`. Módulo `canonical-month-letter.js` (plantillas y selectores; sin IA generativa).
- *Hecho cuando:* primera carta con el cierre de diciembre (1-3/1/2027).

**WP-30 · Hoja de captura en ≤ 8 s** (ND-14) · T3 · visible · M ≈ 2,5
- Hoja inferior con el importe primero (teclado abierto), los 5 conceptos más frecuentes a esa hora, «hoy/ayer», guardar con la tecla «hecho» y deshacer 8 s. Es la misma hoja que abre WP-25. Métrica: mediana ≤ 8 s (WP-02).

**WP-31 · Nómina en PDF y retenciones automáticas** (CAP-05 + NPV-11) · T3 · exento · M+S-M ≈ 4
- *Enfoque:* lector de texto de PDF cargado bajo demanda (mismo patrón que el OCR de A17-3; *verificar* librería, tamaño y licencia) o captura + OCR; plantilla por pagador; extrae líquido, bruto, retención %, cotizaciones; crea el ingreso real, acumula `irpfWithholdingsPaid` y avisa si cambia el %. El PDF no se guarda.
- *Pruebas:* nóminas sintéticas por plantilla, paga extra, regularización a mitad de año.

**WP-32 · Recordatorios en el momento de máximo valor** (CAP-09, absorbe ND-10) · T3 · fuera de la app · S
- Calendario suscribible regenerado con la previsión: 2 días antes de cobrar, el día siguiente a un cargo grande, el día 1 (cerrar el mes), el 1/12 (campaña fiscal). Reutiliza la exportación `.ics` de `app.js`.

**WP-33 · Historiales sintéticos** (NTC-02) · T3 · exento · M ≈ 2,5
- `tools/build-synthetic-household.mjs` (patrón de `tools/build-golden-datasets.mjs`): un hogar ficticio con días de cargo, distribuciones y sobresaltos conocidos. Sirve para medir la sugerencia de WP-08, probar WP-51 y calibrar la banda de WP-16 (que P10-P90 contenga la realidad ≈ 80 % de las veces).

**WP-34 · Revisión base cero del plan** (PRV-08) · T4 (enero) · visible · S-M ≈ 1,5
- Una partida por pantalla con sus 12 meses de real: mantener · ajustar a lo real · eliminar; progreso y guardado parcial. Marca «revisada (fecha)» por partida (campo nuevo en `customPlanningRows` → migración del contrato de estado).

**WP-35 · Previsión en tres capas e ingresos inciertos** (PRV-02 + PRV-04) · T4 · visible · M+M ≈ 5
- Separar salidas en comprometidas / probables / discrecionales con el eje `movementActionTypes`; certeza por ingreso (confirmado · probable · incierto, con probabilidad y ventana; vacancia del local). La cifra de Hoy solo cuenta los confirmados (sin cambio visible en Hoy). Barras apiladas con patrón (kit de WP-28).

**WP-36 · Anomalías del extracto** (ND-07) · T4 · exento · M ≈ 2,5
- Detector puro sobre movimientos importados: cargo duplicado, devolución de recibo, comisión nueva, recurrente fuera del plan, importe > P95 de su partida. A la bandeja con evidencia; nunca actúa. Objetivo: falsos positivos < 20 %.

**WP-37 · Estados completos y deshacer** (NXP-04) · T4 → continuo · exento · M
- Catálogo en `design-system.html` (vacío accionable, carga con esqueleto, error con causa y salida, sin conexión, dato obsoleto, éxito con deshacer) y aplicación pantalla a pantalla cuando cada paquete la toque.

**WP-38 · Plan B acordado en frío** (PRV-05 + NPV-09) · T5 · visible · M+M ≈ 4
- Asistente de 3 pasos (disparador · acciones ordenadas · fecha y firma). Almacén nuevo (clasificar en `BACKUP_LOCAL_STORES`). Evaluación del disparador con la previsión en cada recálculo; efecto de las acciones con escenarios de `E13`; palanca de recorte discrecional (NPV-09) como una de las acciones. Nunca ejecuta.

**WP-39 · Política de inversión** (CAR-01) · T5 · visible · M ≈ 2,5
- Seis preguntas con valores prerrellenados desde lo ya declarado (objetivos E15, umbral de rebalanceo INV2, convicción I12, desapalancamiento LEV11); vista de una página; firma con fecha; revisión anual. **Es la fuente de reglas de WP-17** y de los avisos «esta operación contradice vuestra regla N».

**WP-40 · Conciliación con la CIRBE** (DAC-01) · T5 · exento · S-M ≈ 1,5
- Tabla de introducción manual del informe (operación, entidad, tipo, importe, titularidad) y conciliación con el inventario de `canonical-debt-contracts.js`; estados «cuadra · falta en la app · diferencia». Recordatorio anual.

**WP-41 · Deuda en la sombra y TAE real** (DAC-04 + DNU-03) · T5 · exento · M+S ≈ 3,5
- Detector sobre recurrentes con fecha de fin (financiación en factura, aplazamientos, permanencias) → propuesta de alta como deuda corta. Función pura de TAE efectiva (TIR con comisiones y seguros) para lo detectado y para ofertas «al 0 %».

**WP-42 · Escalera del próximo euro** (CAR-03 + NIN-05 + NIN-08) · T7 · visible · M+M+M ≈ 7
- Orden integrado: colchón (`cushionFloor`) → deuda con coste neto alto (`netDebtCostAfterTax`, `DEB10`) → plan de pensiones hasta el límite si el tipo marginal lo justifica (`limitForYear`, `marginalTaxOnAdditionalIncome`) → fondos traspasables → amortizar o invertir (`AP1`). Dentro de la inversión, **rebalanceo por aportaciones** (sin vender) y destino de la liquidez ociosa (comparador neto de impuestos con tipos de WP-13 o tecleados con fecha). Cada peldaño con su euro de beneficio esperado y su coste de liquidez.

**WP-43 · Puente de previsión** (PRV-01) · T8 · visible · M ≈ 2,5
- Congelar en cada cierre la previsión a 31/12 (almacén por mes); cascada entre dos previsiones sucesivas (ingresos, gasto recurrente, extraordinarios, mercado, deuda/supuestos). Reutiliza `analisisCascadaHtml` (A-4) y `netWorthWaterfall`.

**WP-44 · Calma, cobertura y exposición** (CAR-02 + CAR-05 + CAR-06) · T9 · visible · S-M+S+S ≈ 3,5
- Caída desde máximos con los snapshots de WP-15, en € y en meses de aportación, con la política de WP-39; proporción del gasto cubierta por rentas (`rentalAssetPnL`, dividendos y retirada sostenible de `LPX1`); exposición por entidad (depósitos cubiertos por el fondo de garantía, fondos segregados, seguros de ahorro; *verificar límites*).

**WP-45 · Frescura y cola de tareas por valor** (ND-09 + CAP-07) · T10 · visible · S+M ≈ 3,5
- Fichas de frescura por fuente (`canonical-data-age.js`) y una cola ordenada por «euros de incertidumbre por minuto» con la sensibilidad de `canonical-forecast-sensitivity.js` y los tiempos medidos en WP-03.

**WP-46 · Patrimonio neto: serie y proyección** (NPV-10) · T10 · visible · L ≈ 5
- Serie mensual (efectivo de los cierres de WP-09, posiciones de WP-15, vivienda y local, deuda) y abanico de tres escenarios con hitos (deuda cero, objetivos, jubilación de `GOB11`). Estado vacío honesto con < 3 cierres.

**WP-47 · Reparto de la nómina en un paso** (NPV-05) · T11 · visible · M ≈ 2,5
- Al confirmarse la nómina (WP-14), hoja con las filas de la escalera de WP-42 prerrellenadas; *steppers* que siempre suman el disponible tras el suelo; «Aplicar» crea un borrador y una lista de transferencias a hacer (nunca ejecuta).

**WP-48 · Operaciones de cartera editables e importador** (NIN-06) · T11 · visible · L ≈ 5
- Libro de operaciones por posición editable con recálculo FIFO (`fifoLedger`) y diff antes/después; importación pegando el CSV del bróker con deduplicación. Pruebas de oro fiscales con `FIN-2`.

**WP-49 · Mapa anual de pagos grandes** (NPV-04) · T12 · visible · M ≈ 2,5
- Franja de 12 meses con los pagos grandes y su nivel de financiación por sobre (`financialCalendar` y sobres), múltiplos pequeños con etiquetado directo.

**WP-50 · Vivienda y local por índice** (CAR-04) · T12 · visible / tercero · S-M ≈ 1,5
- Revalorización trimestral desde el último valor declarado con un índice público (*verificar* fuente accesible y CORS; si no, vía función privada tras WP-05). Chip «estimado por índice». Alimenta LTV y patrimonio.

**WP-51 · Perfiles de extracto** (ND-04) · T6 · exento · M ≈ 2,5 — autodetección de delimitador, decimales, fechas, signo, filas de título y codificación; errores por fila; corpus anonimizado (WP-33).

**WP-52 · WebKit en la medición de carga** (NTC-04) · T4 · exento · S-M ≈ 1,5 — proyecto WebKit de Playwright en `tools/measure-load.mjs`.

**WP-53 · Sin duplicados entre canales** (CAP-10) · T5 · exento · M ≈ 2,5 — emparejamiento por importe exacto, fecha ±2 días y comercio por similitud entre captura manual, enlaces de WP-25 y extracto; el extracto manda en importe y fecha.

**WP-54 · Prueba con 5 personas ajenas** (GOV-06) · trimestral desde T3 · proceso · 1 sesión por trimestre — guion de 5 tareas con datos de demostración, 30 min por persona, hallazgos al backlog con su evidencia.

---

## 5. Lo que necesita el hogar y cuándo

| Cuándo | Qué | Para |
|---|---|---|
| Antes de T0 | Decir «empezamos» | Todo |
| T0 (semana 1) | Actualizar saldos y hacer la prueba cronometrada 3 veces (≈ 5 min) | WP-02 |
| **≈ 20/10** | **Datos fiscales en el chat** (D2 del backlog) | WP-23 |
| T0 | Dato H7: tipo de hipoteca | WP-20 |
| 1/11 | Hacer la primera transferencia de asignación personal | WP-24 |
| T1-T2 | 30 min (≈ 10 con el prerrellenado) de confirmar días de cargo | WP-08 |
| Cada 1-3 del mes | Cerrar el mes anterior con saldo | WP-09 y siguientes |
| 30/11 | Activar o archivar `A5-1`/`A5-4` | H8 |
| Enero | Revisión base cero (≈ 15 min) y revisión de la asignación personal | WP-34, WP-24 |
| T5 | Contestar las 6 preguntas de la política de inversión y del plan B | WP-38, WP-39 |
| Cada trimestre | Proponer 5 personas para la prueba de usabilidad (opcional) | WP-54 |

---

## 6. Riesgos

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| **La app sigue sin usarse a diario** y se construye para nadie | Alta | Panel de uso desde T0; regla de parada por tramos; la captura y la actualización (T1-T3) van antes que el análisis |
| Normativa fiscal mal aplicada en WP-23 | Media | Cada acción con fuente y etiqueta «estimación»; pruebas de oro; confirmar con asesor antes de actuar |
| Techo de `app.js` | Alta | Módulo por paquete; WP-07 libera líneas; el guardián lo vigila |
| Contrato de estado: migraciones en WP-23, WP-34, WP-35, WP-38 | Media | Migración con la herramienta y *fixtures* regenerados; nunca a mano |
| Dependencias de terceros (índices, PDF, Atajos de iOS) | Media | Todo con camino manual de respaldo; verificar en los iPhone antes de dar por bueno |
| Un solo usuario: la persona que mide es la que diseña | Alta | WP-54 (personas ajenas) y medición con datos frescos |
| Demasiados cambios visibles para una persona | Media | 2 visibles por tramo; revisar a 3 solo si el panel de uso muestra uso intenso |
