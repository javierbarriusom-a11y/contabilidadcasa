# Plan de implementación — quinta auditoría (aprobada el 3/10/2026)

Estado: **plan de trabajo aprobado en lo esencial; no se ha construido nada.** Deriva de `docs/PROPUESTA_QUINTA_AUDITORIA_2026-10-02.md` (el porqué de cada propuesta) y se registra en `BACKLOG_INICIO_OLEADA_OCTUBRE.md` §14 (la única fuente viva).
**No contiene importes reales del hogar** (repositorio público).

> **Las fechas son orientativas; mandan las puertas.** El proyecto avanza por sesiones, no por calendario. Un tramo no empieza hasta que se cumple la salida del anterior.

---

## 1. Decisiones registradas (3/10/2026)

El hogar contestó «ok» a las 12 preguntas del §10 de la propuesta **con mis recomendaciones**. Dos de ellas no se pueden contestar con una recomendación (son hechos del hogar) y una exigió que yo fijara un plazo; queda anotado para que pueda vetarse.

| # | Decisión | Efecto |
|---|---|---|
| Q1 | Se abre **C2**: el cierre guarda saldo y puede cerrar el mes anterior, sin tocar el RPC | **NPV-03 activa** (exenta) |
| Q2 | Quien consulta hará la **prueba cronometrada** | **NXP-01 activa**; sustituye a las 4 preguntas de H1 en el chat. *Pendiente de hecho:* qué decía la tarjeta con sus palabras (solo se sabrá cuando exista la prueba) |
| Q3 | **Aviso de versión nueva**, empezando por el sello | **NXP-02 activa** |
| Q4 | **30 minutos, una vez**, de alta del día de cargo por partida | **ND-03 activa** (tras NTC-01 y la viabilidad) |
| Q5 | **PSD2:** prueba de 2 semanas con otro proveedor y criterio de salida | **ND-13** (documental). `O-6` queda reformulada: GoCardless ya no es el candidato (verificar) |
| Q6 | **Precios manuales primero** | **NIN-02** activa; ND-12 solo si el hogar lo pide |
| Q7 | ¿Hipoteca variable, mixta o fija? | **Sin respuesta (es un dato, no una preferencia).** NDB-02 queda en espera |
| Q8 | **Proporcional a ingresos como opción** y titular explícito | NHG-01 en cola (Ola 4) |
| Q9 | Activar `A5-1`/`A5-4` con fecha o archivar | **Plazo fijado por mí: 30/11/2026.** Si para esa fecha no están en producción real, se archivan `RGX3`, `DEX6`, `GOB5`, `P4`, `P10` y la UI del Copiloto. *Es el hogar quien puede activarlas (despliegue y clave); veto posible* |
| Q10 | **No retirar nada** el 23/10 | `OPT-10`–`OPT-13` siguen aplazadas; **NTC-03** mide |
| Q11 | **Modo discreto sí; passkey más tarde** | NXP-06 se parte: solo el modo discreto entra en cola |
| Q12 | **Validar la premisa** de «quien consulta usa Hoy como producto entero» antes de más Ola 2 | La prueba de NXP-01 la hace quien consulta |

---

## 2. Reglas de ejecución

1. **Cada paquete de trabajo (WP) es un PR** y sigue el ciclo de `CLAUDE.md`: `npm run verify` → `PROJECT_STATE.md` con cifras reales → commit y push a la rama de trabajo → PR en borrador → CI → fusión en verde. Nunca en rojo, nunca push directo a `main`, nunca a `finanzas-casa-def`.
2. **Nada sobre Hoy** hasta tener la prueba de NXP-01. La excepción (NXP-02, el sello) vive en el pie del menú, no en la pantalla de Hoy.
3. **Máximo dos entregas visibles por tramo** (regla v2). Las exentas (datos/cálculo, habilitadoras, CI/rendimiento, accesibilidad) no cuentan.
4. **Cada tramo declara su métrica antes de empezar** (§4) y se mide al terminar.
5. **Ola 3 (Registrar y captura) no se abre** hasta tener línea base con segundos (NXP-01 + H4). ND-01, ND-02 y ND-14 esperan esa puerta.
6. **Techo de `app.js`: 37.495 líneas, margen 82.** Toda entrega que necesite más lo hace en un módulo y deja en `app.js` solo el enganche. NTC-01 se hace **antes** de lo que toca fechas.
7. **Ninguna conexión externa** (ND-05, ND-12, ND-13) sin la revisión de seguridad NTC-06.
8. **Nunca cambiar umbrales de CI ni relajar una prueba para dar verde.**

### Trampas del repositorio que afectan a este plan (verificadas)
- **Módulo `canonical-*.js` nuevo:** registrarlo en `index.html` (antes de `app.js`), `service-worker.js` (`SHELL_URLS`) y `tools/build-public-site.mjs`; subir el recuento de `arq3-canonical-sin-consumidor-ui` (hoy 70) y darle un consumidor real (guardián ARQ-3, sin excepciones).
- **Almacén nuevo en el navegador:** clasificarlo en `BACKUP_LOCAL_STORES` (`app.js:1342`) o excluirlo con motivo en `tests/arq6-copia-completa.test.cjs` (ahí ya está `visit-counts` como «dato de este dispositivo»).
- **Estado de la app (`payload`):** un campo nuevo en `appStatePayload` (como `customPlanningRows`, `app.js:1581`/`2023`/`2101`) toca el contrato de estado y sus *fixtures* históricos (`state-contract.js`, A13-4): hay que migrar y regenerar con la herramienta, no a mano.
- **Versión de `app.js?v=`** en `index.html` y en ~27 pruebas: subir con expresión regular sobre `tests/*.cjs`. Hoy `20261002s5a1`.
- **Pruebas que extraen funciones de `app.js` a un `vm`:** una dependencia nueva dentro de una función extraída exige su *stub* en esos entornos.
- **Reiniciar la rama tras una fusión por squash:** `git checkout -B <rama> origin/<rama>` → `git merge --no-edit origin/main` → `git cherry-pick` → comprobar `git diff --stat` vacío → push normal (el `--force-with-lease` está denegado).
- **Este PR de documentación (#431)** se queda en la misma rama: no se reinicia, porque aún no se ha fusionado.

---

## 3. Calendario orientativo

| Tramo | Fechas orientativas | Contenido | Puerta de entrada | Salida (métrica) |
|---|---|---|---|---|
| **0 · Medir y desbloquear** | 5–16 oct | WP-01…WP-06 | Ninguna | Línea base con segundos y versión visible |
| *Hito* | **16 oct** | Revisión mensual de Nielsen (`OPT-21`) | — | Informe |
| *Hito* | **23 oct** | `OPT-10`–`OPT-13`: **no se retira nada** (Q10) | — | Contador combinado en marcha |
| **A · La verdad entra barata** | 19 oct – 27 nov | WP-07…WP-11 | Tramo 0 hecho | ≥ 70 % del gasto con fecha declarada u observada; cierre con saldo guardado |
| *Hito* | **30 nov** | Plazo de `A5-1`/`A5-4` (Q9) | — | Activadas o archivadas |
| **B · Previsión que se contrasta** | 30 nov – 22 ene | WP-12…WP-16 | Tramo A con su métrica | Primer backtest de caja; índices sin teclear; valores de cartera actualizables |
| **C · Inversión viva** | 25 ene – 5 mar | WP-17, WP-18 | Tramo B | Valoración mensual; «cómo voy» en una pantalla |
| **D · Deuda con guion** | 8 mar – 16 abr | WP-19, WP-20, WP-21 | Tramo C; Q7 contestada para NDB-02 | «¿Cuándo acabamos y qué cambia con más?» en < 30 s |
| *Hito* | **31 mar** | NIN-10 listo (campaña de la Renta; verificar fechas oficiales) | — | Informe exportable |
| **E · Hogar** | cuando haya H1/H3/H5 | WP-22… | Re-medición con las dos personas | Reunión mensual ≥ 10 de 12 |

---

## 4. Tramo 0 — medir y desbloquear (5–16 oct)

Todo exento o documental. Objetivo: que el próximo tramo se decida con segundos, no con conversación.

### WP-01 · NXP-02 Sello de versión y aviso de «versión nueva» · S · exenta
- **Hallazgo técnico que cambia el diseño:** `service-worker.js` hace `skipWaiting()` + `clients.claim()` (líneas 145-154), así que **nunca hay un worker «en espera»**: el nuevo toma el control de inmediato y sirve ficheros nuevos a una página que sigue ejecutando el JS viejo. El «waiting» clásico no sirve.
- **Enfoque:** (1) el sello sale de `app.js?v=` (ya fijado en `index.html`); (2) la comparación con lo publicado se hace con `version.json` (`{version: GITHUB_SHA, builtAt}`, que ya escribe `tools/build-public-site.mjs`), que **no está en `SHELL_URLS`** y por tanto el worker no lo intercepta: se pide con `fetch(..., {cache: "no-store"})`; (3) se guarda en memoria el `version` visto al cargar y se vuelve a pedir en `visibilitychange` (volver a la app); si cambia, o si se dispara `controllerchange` con un controlador previo, se avisa; (4) el aviso **solo recarga al tocar**, tras guardar borradores.
- **Dónde:** lógica pura en `ux-shell.js` (ya expone `FinanceUxShell`, sin tocar el techo de `app.js`) y un chip en el pie del menú. **No en Hoy.**
- **Sin red o en local:** si `version.json` no existe, el chip dice solo el sello y no avisa.
- **Pruebas:** nueva `tests/nxp2-sello-version.test.cjs` (lógica de comparación, sin red, `controllerchange` con y sin controlador previo, `version.json` ausente); `tests/arq5-cache-offline-completa` debe seguir verde.
- **Riesgo:** bajo. **Reversión:** quitar el chip y el listener.
- **Hecho cuando:** el sello se ve en los dos móviles y, tras un despliegue, aparece el aviso sin recargar solo.

### WP-02 · NXP-01 Prueba de hallazgo cronometrada · S-M · exenta (herramienta de medida)
- **Qué:** en Ajustes › Uso de la app (`renderAjustesUsoApp`, `app.js:35444`), una tarjeta «Prueba de 30 segundos». Al pulsarla navega a Hoy y muestra una **barra flotante solo durante la prueba** (no cambia Hoy fuera de ella) con «Ya la tengo» y un campo para teclear la cifra.
- **Módulo:** `canonical-finding-test.js` (puro: cronometrar, comparar la cifra tecleada con la de la app, resumir mediana y dispersión entre personas) con consumidor en Ajustes. La cifra de la app llega por parámetro desde `canonical-home-margin.js` (`spendable`).
- **Almacén:** clave nueva `finding-test` **local del dispositivo y excluida de la copia y la nube con motivo** (contiene una cifra real tecleada): clasificarla en `tests/arq6-copia-completa.test.cjs`, igual que `visit-counts`. **Nunca se exporta.**
- **Registro:** `index.html`, `service-worker.js`, `tools/build-public-site.mjs`; recuento de `arq3` 70 → 71.
- **Guarda:** sello de versión y edad del saldo en cada intento (cruza con H1 casos 1 y 3).
- **Pruebas:** nueva `tests/nxp1-prueba-hallazgo.test.cjs` (cronómetro con reloj inyectado, misma cifra sí/no, tres intentos, mediana, almacén no exportable).
- **Riesgo:** bajo; **la prueba mide, no cambia cifras.** **Hecho cuando:** tres intentos de quien consulta dan una mediana y un «misma cifra: sí/no», y la app los conserva solo en su móvil.

### WP-03 · NTC-03 Contador de uso combinado · S-M · exenta
- **Hoy:** el contador (`VISIT_COUNTS_KEY`, `app.js:4440`) es por navegador y está excluido de la copia a propósito.
- **Enfoque:** un almacén nuevo `visit-counts-by-device` con `{etiquetaDispositivo: {pantalla: {count, last}}}` donde **cada dispositivo escribe solo su entrada y lee las demás**; se sincroniza con el mecanismo ya usado por `localStores`. El informe de Ajustes suma y muestra por dispositivo.
- **Privacidad (revisión explícita antes de fusionar):** solo agregados (pantalla, recuento, última fecha); ningún dato financiero; opción de apagarlo; la etiqueta del dispositivo la elige el hogar.
- **Pruebas:** nueva `tests/ntc3-contador-combinado.test.cjs` (fusión sin pisarse, un dispositivo no borra a otro, apagado, sin datos financieros) + clasificación en `arq6`.
- **Riesgo:** medio-bajo (toca sincronización). **Reversión:** apagar y volver al contador local.
- **Hecho cuando:** el informe de un solo móvil muestra los dos.

### WP-04 · Viabilidad del día de cargo (ND-03, paso 0) · S · documental
- **Qué:** un script de **solo lectura**, en el mismo formato que `BACKLOG_UX_OLAS.md` §8.6 y que el hogar ejecuta en su navegador, que para cada partida recurrente cuenta en cuántos meses con movimientos importados el cargo cae en el mismo día (± 1) y devuelve **solo porcentajes y recuentos**: cuántas partidas tienen ≥ 3 meses de histórico, cuántas son «fiables» (≥ 80 % en el mismo día) y qué fracción del gasto mensual representan.
- **Entrega:** el script en `docs/ND03_VIABILIDAD.md` (sin importes), y la decisión posterior de si la sugerencia aprendida entra en WP-08 o se deja solo el campo declarado.
- **Hecho cuando:** hay un porcentaje de partidas con sugerencia fiable. (Sin ≥ 3 meses de movimientos, el resultado es «insuficiente»: se hace solo lo declarado.)

### WP-05 · Spike PSD2 (ND-13) y modelo de amenazas (NTC-06) · S · documental
- **Spike (14 días):** comprobar en fuentes oficiales de cada proveedor (Enable Banking en modo restringido, open-banking.io, Tink; **confirmar el cierre de altas de GoCardless**) si hay acceso para particulares y cobertura de **CaixaBank y Banca Mediolanum**; coste; ciclo de consentimiento (reautorización cada hasta 180 días); qué pide cada uno (certificados, dominio, regulado o no).
- **Criterio de salida a 16/10:** si no hay cobertura de **las dos** entidades o la fricción de consentimiento supera «un toque cada 6 meses», **se cierra `O-6`** y el esfuerzo pasa al bloque A. Si hay cobertura, se pasa a un prototipo de lectura con una cuenta, aislado, **sin tocar el libro**.
- **Amenazas (NTC-06), `docs/NTC06_AMENAZAS.md`:** secretos solo en funciones privadas; RLS; CORS y límites de tasa; registros sin datos personales; rotación y revocación de tokens; caducidad del consentimiento; qué ocurre si se roba un móvil.
- **Hecho cuando:** hay una decisión escrita (seguir/cerrar) y una lista de requisitos de seguridad.

### WP-06 · Gobierno · S
- **16/10:** revisión mensual de Nielsen (`docs/OPT21_CHECKLIST_NIELSEN.md`).
- **23/10:** confirmar que **no se retira nada** (Q10) y dejar el contador combinado como fuente de la decisión.
- **Plazo de `A5-1`/`A5-4`: 30/11** (Q9): recordatorio al hogar el 16/11.
- **Pregunta pendiente (Q7):** pedir el dato de la hipoteca (variable/mixta/fija) para decidir NDB-02.

---

## 5. Tramo A — la verdad entra barata (19 oct – 27 nov)

Orden obligatorio: **WP-07 → WP-08**; WP-09, WP-10 y WP-11 pueden ir en paralelo con WP-08.

### WP-07 · NTC-01 Extraer el motor de fechas a `canonical-timing.js` · M · exenta (habilitadora)
- **Qué se mueve** (`app.js`): `incomeTimingForRow` (6395), `isEndOfMonthExpenseRow` (6421), `expenseTimingFromMovements` (6432) y `expenseTimingForRow` (6455). `monthEndDate` (1213) y `lastBusinessDayOfMonth` (1217) **se quedan** (los usan muchos sitios) y entran por inyección.
- **Receta de S1, sin cambio de comportamiento, comprobada en dos niveles:** (1) antes de borrar nada, ejecutar el original (extraído a un `vm`) y el módulo sobre las mismas entradas —cientos de casos: meses, importes, etiquetas de fin de mes, nóminas, diciembre, con y sin movimientos casables— y exigir **resultado idéntico campo a campo**, incluidos `day`, `date`, `source`, `label` y `confidence`; (2) `golden:datasets`, `golden:debt-cases` y `golden:combined-cases` regenerados y **sin diferencias en Git**.
- **Cuidado:** las reglas de la nómina de Javi (último día natural, `nomina-javi-ultimo-dia-natural`) y de diciembre (día 15; orden de los bloques, sesión 284) **no pueden cambiar**: `tests/nomina-javi-ultimo-dia-natural.test.cjs` es el guardián.
- **Registro del módulo:** las tres piezas de la trampa de módulos nuevos; `arq3` 71 → 72.
- **Líneas:** libera del orden de 80-120 líneas de `app.js`; si baja más de 300, el mismo PR baja el techo (trinquete). No se espera.
- **Hecho cuando:** `npm run verify` verde, equivalencia de N casos documentada y ninguna cifra cambia.

### WP-08 · ND-03 Día de cargo por partida · M · exenta
- **Modelo:** `{ [seriesKey]: { day: 1..31 | "eom", source: "declarado" | "sugerido", updatedAt } }`, con la clave de `seriesKeyForRow` (`app.js:5351`). Se guarda **en el estado de la app** (mismo patrón que `customPlanningRows`) para que viaje con la nube: exige migración del contrato de estado (ver trampas).
- **Motor:** una rama nueva **al principio** de `expenseTimingForRow` (ya en `canonical-timing.js`): orden **declarado > por regla > observado > estimado**; devuelve `source: "día de cargo declarado"` y `confidence` alta. Nada cambia para quien no declare nada.
- **UI (Plan › Partidas):** columna «Día de cargo» con *stepper* (1-31, «fin de mes», «sin fecha»), chip de sugerencia si WP-04 lo justifica y botón «Aplicar las N sugerencias fiables». Resumen «quedan N partidas con fecha estimada (X % del gasto)». Entrada en `AmountInput` cuando exista (WP-11).
- **Alta:** una sola sesión de ~30 min del hogar (Q4); la lista se ordena de mayor a menor gasto para empezar por lo que más pesa.
- **Pruebas:** nueva `tests/nd3-dia-de-cargo.test.cjs` (precedencia, «fin de mes», día 31 en meses cortos, sin declaración = comportamiento anterior byte a byte, persistencia, migración del contrato).
- **Riesgo:** medio (contrato de estado). **Reversión:** el campo es opcional; sin él, todo vuelve al día 8.
- **Hecho cuando:** ≥ 70 % del gasto mensual con fecha declarada u observada (medido con WP-10).

### WP-09 · NPV-03 Cierre con saldo y firma (C2) · M · exenta
- **Hoy:** `closeCurrentMonthTransaction` (`app.js:5082`) cierra `openMonthCutoffKey()` (`:8016`) = el mes de hoy; `closeMonth` (`canonical-month-close.js:23`) guarda reales, motivo, autor y asientos de sobres, **ningún saldo**.
- **Enfoque (sin tocar el RPC `close_finance_month`):** un almacén local `month-close-balances` con `{ [monthKey]: { caixa, mediolanum, date, source, closedAt } }`, con el patrón de `recordIv1ValuationSnapshot` (`app.js:32637`): idempotente si el mes se reabre y se vuelve a cerrar. Módulo puro `canonical-month-close-balances.js` (cuadre `saldo inicial + movimientos = saldo de cierre`, con tolerancia: avisa, no bloquea).
- **Cerrar el mes anterior:** por defecto entre el día 1 y el 3 se propone el mes que acaba, no el que empieza; el mes de hoy sigue siendo posible. Esto cambia `openMonthCutoffKey`/su llamador: **mínimo en `app.js` (≤ 20 líneas)**, resto en el módulo.
- **Copia y nube:** el almacén entra en `BACKUP_LOCAL_STORES` (guardián `arq6-copia-completa`) y viaja con la copia y la nube.
- **Pruebas:** nueva `tests/npv3-cierre-con-saldo.test.cjs` + las de cierre/reapertura existentes **sin tocar** + una de **dos sesiones** (una sesión obsoleta no sustituye el puntero) y una de reapertura (idempotencia).
- **Riesgo:** **medio-alto: operación firmada y transaccional.** Mitigación: no se toca el RPC; se revisa con `/code-review` antes de fusionar; flujo probado en navegador (cerrar, reabrir, cerrar). **Reversión:** el almacén es aditivo; sin él, el cierre se comporta como hoy.
- **Hecho cuando:** un cierre guarda el saldo de cada cuenta y fecha, y se puede cerrar el mes anterior sin perder nada de lo ya cerrado.

### WP-10 · NPV-08 Medidor de calidad de datos de la previsión · S · visible (1.ª de 2)
- **Enfoque:** módulo puro que cuenta, sobre las filas de salida y entrada del motor mensual/diario, cuántas tienen `source` «declarado», «observado», «regla» o «estimación alisada 1-15» (los `source` que ya devuelve `expenseTimingForRow`); además importes (reales frente a previstos) e ingresos (confirmados frente a esperados). Tres barras en la cabecera de Plan › Previsión, cada una con la acción que la sube.
- **Dónde:** Plan › Previsión (**no Hoy**). Reutiliza `tokens` de diseño; texto + icono, no solo color.
- **Pruebas:** nueva `tests/npv8-calidad-prevision.test.cjs` (porcentajes con casos conocidos, 0 filas, redondeo, sin datos = «sin datos», no 0 %).
- **Hecho cuando:** el 100 % estimado de hoy se ve como una barra y baja al declarar días de cargo.

### WP-11 · NXP-05 Campo de importe unificado (fase 1: Registrar) · S-M · exenta (accesibilidad/usabilidad)
- **Hoy:** 238 `<input type="number">` en `index.html`. **No se cambian todos.** `parseAmount` (`app.js:5485`) ya acepta coma, punto, `€` y espacios: **el problema es el campo, no el análisis.**
- **Fase 1 (≈ 12 campos de Registrar: saldos, reales, captura rápida):** `type="text"` con `inputmode="decimal"`, `autocomplete="off"`, separador de miles al salir del campo, aceptar «1.234,56 €», sin flechas, 44 px de alto, signo «−» explícito; ayudante en `ux-shell.js`, sin líneas nuevas en `app.js`.
- **Trampa:** muchas pruebas fijan el HTML de esos inputs o leen `.value` como número; se ajustan **sin relajar la intención** y se listan en el PR.
- **Pruebas:** nueva `tests/nxp5-campo-importe.test.cjs` (pegado «1.234,56 €», coma/punto, negativos, vacío ≠ 0 —la regla «vacío usa el previsto, 0 es real 0» **no puede romperse**).
- **Hecho cuando:** teclear o pegar un importe en Registrar funciona igual en iPhone y escritorio y la regla vacío/cero sigue intacta.

### Puerta de salida del tramo A
Medir con NXP-01 (segundos), WP-10 (% de fechas), WP-09 (¿hay saldos de cierre?). **Si el % de gasto con fecha no sube de forma material, se detiene la línea de «previsión diaria» (NPV-01) y se vuelve a preguntar al hogar.**

---

## 6. Tramo B — previsión que se contrasta (30 nov – 22 ene)

| WP | Qué | Puerta | Notas técnicas |
|---|---|---|---|
| WP-12 | **NPV-02 Backtest de liquidez** (cálculo y almacén; se muestra como 4.ª barra de WP-10, sin entrega visible nueva) | WP-09 con ≥ 1 cierre | Congelar el día 1 y el 15 la liquidez prevista a fin de mes; comparar con el saldo de cierre. Con < 3 meses: «datos insuficientes» |
| WP-13 | **ND-11 Indicadores oficiales** (Euribor, €STR, IPC) | NTC-06 | Probar **CORS** desde el navegador; si falla, función privada de solo lectura. Con caducidad (`PVC15`) y vuelta al valor tecleado. Añadir la regla del índice por contrato (media mensual o día fijo) |
| WP-14 | **ND-08 Cobros esperados** | WP-08 | Fuente nueva de la bandeja única (`decisionInboxItems`), no tarjeta nueva |
| WP-15 | **NIN-02 Hoja de valoración rápida** (visible 1.ª de 2) | — | **Hueco funcional:** hoy no hay forma de actualizar el valor de una posición sin borrarla y recrearla (`saveIv1Position`/`removeIv1Position`, `app.js:19842`/`20130`). Hoja: valor anterior, valor nuevo (o % de variación), «pegar desde el bróker», fecha; **snapshot propio fuera del cierre de mes** (alimenta `I2`/`I3`) |
| WP-16 | **NPV-01 Banda de caja diaria** (visible 2.ª de 2) | **Puerta del tramo A** + NPV-08 | Monte Carlo de cientos de trayectorias (patrón de `ESX1`) sobre ventanas de fecha; salida: banda P10-P90, probabilidad de cruzar el suelo, día más probable del mínimo. **Solo en Plan › Previsión.** Si las fechas siguen estimadas, la banda lo dice |

**Salida del tramo B:** primer backtest con ≥ 1 mes, Euribor/IPC sin teclear, y una valoración de cartera actualizada sin borrar posiciones.

---

## 7. Tramo C — inversión viva (25 ene – 5 mar)

| WP | Qué | Puerta | Notas técnicas |
|---|---|---|---|
| WP-17 | **NIN-01 Cartera como tablero** («siguiente mejor acción») | WP-15 | Reglas deterministas con prioridad y motivo: aportación pendiente · deriva sobre umbral · convicción vencida (`I12`) · venta fiscalmente óptima (`FC5`). *Sparkline* si hay ≥ 3 puntos |
| WP-18 | **NIN-03 Aportado frente a valor y TWR** | WP-15 con ≥ 3 puntos | XIRR ya existe; TWR nuevo, con explicación |

Se decide aquí, con datos de uso (NTC-03), si NIN-04, NIN-05, NIN-06 (operaciones editables) y NIN-07…NIN-09 entran o se quedan en catálogo.

---

## 8. Tramo D — deuda con guion (8 mar – 16 abr)

| WP | Qué | Puerta | Notas |
|---|---|---|---|
| WP-19 | **NDB-01 Camino a deuda cero** | Tramo C | Un solo control («extra al mes») y tres cifras; reutiliza motores por el contrato canónico; **no borra** las otras seis secciones |
| WP-20 | **NDB-02 Revisión de tipo variable** | **Q7 contestada (variable o mixta)** y WP-13 | Si es fija, se archiva |
| WP-21 | **NIN-10 Informe fiscal anual de inversión** | — | Listo antes del **31/3** (campaña de la Renta; verificar fechas oficiales); contrastar con asesor |

---

## 9. Tramo E — hogar (cuando haya H1, H3, H5 y re-medición)

NXP-03 (procedencia bajo demanda), NXP-07 (modo consulta), NHG-05 (carta del mes), NHG-02 (reunión mensual), NHG-01 (cuentas en pareja, con el campo de titular), NHG-04 (objetivos visuales), NDB-03 («¿me puedo permitir X?»). **Ninguna se empieza antes de que quien consulta haga la prueba de NXP-01 y de que el hogar apruebe la re-medición.** Todas sobre Hoy o la cabecera común quedan bajo la regla v2.

**ND-01, ND-02 y ND-14 (Ola 3):** se abren **solo** con la línea base de NXP-01 y H4. ND-01 necesita antes WP-11 (campo de importe).

---

## 10. Lo que debe hacer el hogar (no Claude)

| Cuándo | Qué | Para qué |
|---|---|---|
| **Ya** | Decir si la hipoteca es variable, mixta o fija (Q7) | Decide NDB-02 |
| **Tras WP-02 (≈ 9-16 oct)** | Quien consulta hace la prueba de 30 s (3 intentos); quien opera la hace también | Línea base; valida la premisa (Q12) |
| **Tras WP-02** | Actualizar saldos y registrar la nómina del 30/9 como real, y repetir la prueba una vez | H2 |
| **Tras WP-04** | Ejecutar el script de viabilidad en el navegador de quien opera y pegar el porcentaje en el chat | Decide el alcance de WP-08 |
| **Tras WP-08 (≈ 9-13 nov)** | 30 minutos, una vez, para declarar el día de cargo | Q4 |
| **Antes del 30/11** | Activar `A5-1`/`A5-4` (despliegue y clave) o aceptar el archivo | Q9 |
| **Cada vez que haya un cierre** | Cerrar el mes entre el día 1 y el 3 con el extracto del último día | Alimenta NPV-02 |

---

## 11. Riesgos del plan

| Riesgo | Probabilidad | Impacto | Respuesta |
|---|---|---|---|
| El hogar no hace la prueba o no declara el día de cargo | Media | Alto: las dos palancas de valor dependen de ello | Pedir lo mínimo (un gesto cada vez); si no hay datos, el plan se detiene en el tramo A y no se construye nada visible |
| NPV-03 rompe una operación firmada | Baja | Alto | No se toca el RPC; `/code-review`; pruebas de dos sesiones y reapertura |
| Una migración de estado rompe un *fixture* | Media | Medio | Regenerar con la herramienta; revisar el diff |
| `app.js` sin margen | Alta | Medio | Módulos y `ux-shell.js`; NTC-01 antes; ningún cambio que no sea neutro |
| Un tramo no mueve su métrica | Media | Medio | Regla de parada: no se abre el siguiente; se revisa |
| PSD2 inviable | Alta | Bajo | Criterio de salida a 14 días; no condiciona el resto |
| Dependencia de una sola persona que opera | Alta | Alto | NXP-01 con las dos personas; ND-09/ND-10 (frescura, recordatorios) en el catálogo |

---

## 12. Cadencia de seguimiento
- **Cada sesión:** abrir con `BACKLOG_INICIO_OLEADA_OCTUBRE.md` §1 y §14; cerrar con `PROJECT_STATE.md` y cifras reales.
- **Fin de cada tramo:** medir su métrica, **registrar el resultado aunque sea malo**, y decidir con la regla de parada si se abre el siguiente.
- **Mensual (16 de cada mes):** revisión de Nielsen; recordar al hogar lo pendiente de §10.

## 13. Qué queda en catálogo (no activado)
ND-04, ND-05, ND-06, ND-07, ND-09, ND-10, ND-12, ND-14; NPV-04, NPV-05, NPV-06, NPV-07, NPV-09, NPV-10, NPV-11, NPV-12; NIN-04…NIN-09; NDB-03…NDB-05; NXP-04, NXP-06 (parte del modo discreto), NHG-03; NTC-02, NTC-04, NTC-05. Se activan cuando el contador (NTC-03) o la medición (NXP-01) muestren que hacen falta, **citando el uso real** (criterio `PROC-1`). NHG-03 es candidata a descartar.
