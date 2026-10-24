// Plan › Partidas: las dos tarjetas de configuración que guardan en un almacén local (copia y nube). Script clásico
// cargado antes de app.js (comparte su ámbito global: qs, storageSet, render, money…), fuera de app.js por su techo
// de líneas (ARQ-4). La lógica vive en los motores puros; aquí solo se pinta, se lee el formulario y se guarda.
//
// WP-08: «Días de cargo» (canonical-charge-days.js), movido sin cambios desde app.js al llegar WP-24.

// Lo que hay que decir y dónde dejar el foco tras guardar: render() vuelve a pintar la pantalla después.
let chargeDaysPending = { status: "", focusKey: "", html: "" };
function renderChargeDays() {
  const engine = window.FinanceCanonicalChargeDays;
  const target = qs("cargoDia");
  if (!engine || !target) return;
  const observations = chargeDayObservations();
  const viability = window.FinanceCanonicalChargeDayViability?.analyze(observations).partidas || [];
  const model = engine.buildModel({ rows: chargeDayRows(), store: loadChargeDays(), suggestions: engine.suggestions(observations, viability) });
  const html = engine.renderHtml(model);
  // Sin cambios, no se repinta: el render diferido de la pantalla no se lleva el foco ni el aviso.
  if (html !== chargeDaysPending.html) target.innerHTML = chargeDaysPending.html = html;
  qs("cargoDiaResumen").textContent = engine.summaryText(model);
  qs("cargoDiaEstado").textContent = chargeDaysPending.status;
  const focusKey = chargeDaysPending.focusKey;
  (focusKey === "*" ? qs("cargoDiaResumen") : [...target.querySelectorAll("[data-cargo-dia]")].find((select) => select.dataset.cargoDia === focusKey))?.focus();
  chargeDaysPending.focusKey = "";
}

// Guarda al momento (sin botón «Guardar») y recalcula la previsión; el foco vuelve al mismo selector.
function saveChargeDays(changes, status) {
  const engine = window.FinanceCanonicalChargeDays;
  const store = changes.reduce((current, [key, value, source]) => engine.setDay(current, key, value, { source, now: new Date().toISOString() }), loadChargeDays());
  storageSet(storageKey("charge-days"), JSON.stringify(store));
  Object.assign(chargeDaysPending, { status, focusKey: changes.length === 1 ? changes[0][0] : "*" });
  render();
  renderChargeDays();
}

function handleChargeDayEvent(event) {
  const engine = window.FinanceCanonicalChargeDays;
  const select = event.type === "change" ? event.target.closest("[data-cargo-dia]") : null;
  const use = event.type === "click" ? event.target.closest("[data-cargo-dia-usar]") : null;
  if (select) saveChargeDays([[select.dataset.cargoDia, select.value, "declarado"]], select.value ? `Guardado: ${engine.dayText(engine.normalizeDay(select.value))}. La previsión ya lo usa.` : "Sin día indicado: vuelve a la fecha automática.");
  else if (use) saveChargeDays([[use.dataset.cargoDiaUsar, use.dataset.cargoDiaValor, "sugerido"]], `Guardado: día ${use.dataset.cargoDiaValor}. La previsión ya lo usa.`);
  else if (event.type === "click" && event.target.closest("[data-cargo-dia-fiables]")) {
    const changes = [...document.querySelectorAll("#cargoDia [data-cargo-dia-fiable]")].map((button) => [button.dataset.cargoDiaUsar, button.dataset.cargoDiaValor, "sugerido"]);
    saveChargeDays(changes, `Aplicadas ${changes.length} propuestas fiables. La previsión ya las usa.`);
  }
}

// WP-24: «Asignación personal» (canonical-personal-allowance.js). Una ficha por persona; guardar recalcula la previsión.
let personalAllowancePending = { status: "", focusId: "", html: "" };

// Los 24 meses del horizonte, para elegir la primera y la última transferencia.
function personalAllowanceMonths() {
  return Array.from({ length: 24 }, (_, index) => planningMonthForDate(addMonths(modelStartDate(), index), index)).map((month) => ({ key: month.key, label: month.label }));
}

// Lo que conviene saber antes de fiarse de la cifra: meses en los que el gasto variable estimado no da para las
// asignaciones (se queda en 0 y lo que pase de ahí sube el gasto total previsto).
function personalAllowanceNotes(store) {
  const engine = window.FinanceCanonicalPersonalAllowance;
  if (!store.people.length) return [];
  const variableRow = { kind: "expense", id: VARIABLE_OPERATIONAL_ROW_ID };
  const exhausted = Array.from({ length: 12 }, (_, index) => planningMonthForDate(addMonths(modelStartDate(), index), index))
    .filter((month) => engine.totalForMonth(store, month.key) > 0 && plannedValueForRow(variableRow, month) === 0);
  return exhausted.length ? [`En ${exhausted.map((month) => month.label).join(", ")} las asignaciones agotan el gasto variable estimado: lo que pase de ahí sube el gasto total previsto.`] : [];
}

function renderPersonalAllowances() {
  const engine = window.FinanceCanonicalPersonalAllowance;
  const target = qs("asignacionPersonal");
  if (!engine || !target) return;
  const store = loadPersonalAllowances();
  const months = personalAllowanceMonths();
  const html = engine.renderHtml(store, { months, defaultFrom: months[1]?.key || months[0]?.key, formatAmount: formatAmountField, notes: personalAllowanceNotes(store) });
  // Sin cambios, no se repinta: el render diferido no se lleva lo que se está escribiendo, el foco ni el aviso.
  if (html !== personalAllowancePending.html) target.innerHTML = personalAllowancePending.html = html;
  qs("asignacionResumen").textContent = engine.summaryText(store);
  qs("asignacionEstado").textContent = personalAllowancePending.status;
  if (personalAllowancePending.focusId) qs(personalAllowancePending.focusId)?.focus();
  personalAllowancePending.focusId = "";
}

function savePersonalAllowances(store, status, focusId) {
  storageSet(storageKey("personal-allowances"), JSON.stringify(store));
  Object.assign(personalAllowancePending, { status, focusId });
  render();
  renderPersonalAllowances();
}

function handlePersonalAllowanceEvent(event) {
  const engine = window.FinanceCanonicalPersonalAllowance;
  const form = event.target.closest?.("form[data-asignacion]");
  const remove = event.type === "click" ? event.target.closest("[data-asignacion-quitar]") : null;
  if (remove) {
    const before = loadPersonalAllowances();
    const person = before.people.find((item) => item.id === remove.dataset.asignacionQuitar);
    savePersonalAllowances(engine.removePerson(before, remove.dataset.asignacionQuitar), `Quitada la asignación de ${person?.name || "esa persona"}. El gasto variable vuelve a su cifra.`, "asignacionResumen");
    showUndoToast(`Asignación de ${person?.name || "esa persona"} quitada.`, () => savePersonalAllowances(before, "Deshecho: la asignación vuelve a estar.", "asignacionResumen"));
    return;
  }
  if (event.type !== "submit" || !form) return;
  event.preventDefault();
  const field = (name) => form.elements.namedItem(name);
  const id = form.dataset.asignacion === "nueva" ? undefined : form.dataset.asignacion;
  const amountText = field("amount").value.trim();
  const result = engine.upsertPerson(loadPersonalAllowances(), { id, name: field("name").value, amount: amountText ? parseAmountField(amountText) : null, from: field("from").value, to: field("to").value });
  const errorBox = form.querySelector(".asignacion-error");
  ["name", "amount", "from", "to"].forEach((name) => {
    if (result.errors[name]) field(name).setAttribute("aria-invalid", "true");
    else field(name).removeAttribute("aria-invalid");
  });
  if (!result.person) {
    errorBox.textContent = Object.values(result.errors).join(" ");
    field(["name", "amount", "from", "to"].find((name) => result.errors[name]) || "name").focus();
    return;
  }
  errorBox.textContent = "";
  const { person } = result;
  const fromLabel = personalAllowanceMonths().find((month) => month.key === person.from)?.label || person.from;
  savePersonalAllowances(result.store, `Guardado: Asignación personal · ${person.name}, ${money(person.amount, true)} al mes desde ${fromLabel}. El gasto variable estimado baja lo mismo.`, "asignacionResumen");
}

// WP-30 · PR-1: «Tarjetas de crédito» (canonical-card-cycles.js). Una ficha por tarjeta con su ciclo de corte y cargo y la fila de
// Financiaciones donde se liquida; guardar recalcula la previsión. Los días los introduce el hogar: viven en un almacén privado.
let cardCyclesPending = { status: "", html: "" };

// Las filas de Financiaciones del plan, entre las que se elige dónde se liquida cada tarjeta.
function cardCycleRows() {
  return chargeDayRows().filter((item) => normalizedText(item.section).includes("financi")).map(({ key, label, section }) => ({ key, label, section }));
}

// El real de esa fila ese mes (lo que dejó el extracto o lo tecleado en Registrar), o null si aún no hay.
function cardCyclesReal(rowKey, monthKey) {
  const value = expenseActuals[`${rowKey.slice(rowKey.indexOf("|") + 1)}|${monthKey}`];
  return value === undefined || value === "" ? null : Number(value);
}

function renderCardCycles() {
  const engine = window.FinanceCanonicalCardCycles;
  const target = qs("tarjetasCiclo");
  if (!engine || !target) return;
  const store = loadCardCycles();
  const today = isoLocalDate(new Date());
  const views = engine.cyclesView({ store, transactions: globalThis.FinanceCanonicalCardPurchases?.toMovements(loadCardPurchases()) || [], realFor: cardCyclesReal, today }); // compras: captura-ui.js
  const html = engine.renderHtml({ store, views, rows: cardCycleRows(), today }, { money: (value) => money(value, true), status: cardCyclesPending.status });
  // Sin cambios, no se repinta: el render diferido de la pantalla no se lleva lo que se está escribiendo.
  if (html !== cardCyclesPending.html) target.innerHTML = cardCyclesPending.html = html;
  qs("tarjetasResumen").textContent = engine.summaryText(store);
  renderCardPurchases(); // compras anotadas, por concepto y ciclo (captura-ui.js)
}

function saveCardCycles(store, status) {
  storageSet(storageKey("card-cycles"), JSON.stringify(store));
  cardCyclesPending.status = status;
  render();
  renderCardCycles();
}

function handleCardCycleEvent(event) {
  const engine = window.FinanceCanonicalCardCycles;
  const form = event.target.closest?.("form[data-tarjeta]");
  const remove = event.type === "click" ? event.target.closest("[data-tarjeta-quitar]") : null;
  if (remove) {
    const before = loadCardCycles();
    const card = before.cards.find((item) => item.id === remove.dataset.tarjetaQuitar);
    saveCardCycles(engine.removeCard(before, remove.dataset.tarjetaQuitar), `Quitada la tarjeta ${card?.label || ""}. Sus compras dejan de contar en la previsión.`);
    showUndoToast(`Tarjeta ${card?.label || ""} quitada.`, () => saveCardCycles(before, "Deshecho: la tarjeta vuelve a estar."));
    return;
  }
  if (event.type !== "submit" || !form) return;
  event.preventDefault();
  const field = (name) => form.elements.namedItem(name);
  const fields = ["label", "rowKey", "cutDay", "chargeMonthOffset", "chargeDay", "trackedFrom"];
  const result = engine.upsertCard(loadCardCycles(), {
    id: form.dataset.tarjeta === "nueva" ? undefined : form.dataset.tarjeta,
    ...Object.fromEntries(fields.map((name) => [name, field(name).value])),
  }, { rowKeys: cardCycleRows().map((row) => row.key) });
  const errorBox = form.querySelector(".asignacion-error");
  fields.forEach((name) => {
    if (result.errors[name]) field(name).setAttribute("aria-invalid", "true");
    else field(name).removeAttribute("aria-invalid");
  });
  if (!result.card) {
    errorBox.textContent = Object.values(result.errors).join(" ");
    field(fields.find((name) => result.errors[name]) || "label").focus();
    return;
  }
  errorBox.textContent = "";
  saveCardCycles(result.store, `Guardada la tarjeta ${result.card.label}. Sus compras se cargan en su fila según este ciclo.`);
}

["submit", "click"].forEach((type) => document.getElementById("tarjetasCiclo")?.addEventListener(type, handleCardCycleEvent));

// Movido sin cambios desde app.js (WP-30 · PR-0) para hacer sitio bajo el techo de líneas (ARQ-4): gráfico de liquidez de Plan ›
// Partidas y banda de colchón. Solo se pinta; sus entradas (lastSimulation, lastBaseSimulation, state…) son globales de app.js.
// --- Bloque analítico: banda de colchón + gráfico de 3-4 líneas --------------------------------
// La banda reutiliza analisisCushionBand/analisisCushionBandHtml/analisisCushionWorst (Análisis,
// A-2) tal cual — mismo cálculo y misma escala de tres niveles, sin duplicar lógica ni CSS (el
// wrapper de esta sección carga la clase `e19-analisis` para heredar sus estilos).
function partidasCushionBand(months) {
  const targetMonths = Number(state.emergencyBufferMonths || 0);
  const band = analisisCushionBand(months, lastSimulation, targetMonths);
  const worst = analisisCushionWorst(band);
  return { band, worst, html: analisisCushionBandHtml(band, worst?.key || "") };
}

// Gráfico con eje de meses, puntos finales etiquetados y un crosshair/tooltip al pasar el ratón
// (mismo patrón de trazos que `cambiosPendientesChartHtml`, ampliado con lectura por mes en vez
// de solo la leyenda final). El payload de datos va en `data-partidas-chart-points` para que
// `handlePartidasChartHover` no tenga que recalcular nada al mover el ratón.
function partidasImpactChartHtml(ghosts) {
  const baseRows = lastBaseSimulation.slice(0, 24);
  const confirmedRows = lastSimulation.slice(0, 24);
  if (baseRows.length < 2 || confirmedRows.length < 2) {
    return `<p class="e19-kpi-note">Hace falta más de un mes de horizonte para dibujar la comparación.</p>`;
  }
  const impact = cuadroMandosImpact();
  const draftRows = impact.drafts.length && impact.ok ? impact.rowsAfter.slice(0, 24) : null;
  const reserve = cuadroMandosReserve();
  const series = [
    { label: "Sin decisiones", cls: "cambios-chart-before", dotCls: "partidas-chart-dot-before", keyCls: "cambios-chart-key-before", rows: baseRows },
    { label: "Confirmado", cls: "cambios-chart-after", dotCls: "partidas-chart-dot-after", keyCls: "cambios-chart-key-after", rows: confirmedRows },
  ];
  if (draftRows) series.push({ label: "Con tus ediciones sin guardar", cls: "partidas-chart-draft", dotCls: "partidas-chart-dot-draft", keyCls: "partidas-chart-key-draft", rows: draftRows });
  ghosts.forEach((ghost) => {
    if (ghost.series) {
      series.push({
        label: ghost.entry.nombre || "Escenario propuesto",
        cls: "partidas-chart-ghost",
        dotCls: "partidas-chart-dot-ghost",
        keyCls: "partidas-chart-key-ghost",
        rows: ghost.series.slice(0, 24),
      });
    }
  });
  const monthCount = Math.max(...series.map((item) => item.rows.length));
  const values = series.flatMap((item) => item.rows.map((row) => Number(row.totalLiquidity || 0)));
  const max = Math.max(...values, reserve);
  const min = Math.min(...values, 0, reserve);
  const width = 640;
  const height = 220;
  const padTop = 14;
  const padBottom = 26;
  const plotHeight = height - padTop - padBottom;
  const span = max - min || 1;
  const xFor = (index) => (index / Math.max(1, monthCount - 1)) * width;
  const yFor = (value) => padTop + plotHeight - ((value - min) / span) * plotHeight;
  const path = (rows) => rows.map((row, index) => `${index ? "L" : "M"}${xFor(index).toFixed(1)} ${yFor(Number(row.totalLiquidity || 0)).toFixed(1)}`).join(" ");
  const reserveY = yFor(reserve);
  const monthLabels = baseRows.map((row) => row.month || row.detailMonthKey || "");
  const axisIndexes = [...new Set([0, Math.round((monthLabels.length - 1) / 2), monthLabels.length - 1])];
  const axisLabels = axisIndexes
    .map(
      (index) =>
        `<text x="${xFor(index).toFixed(1)}" y="${height - 8}" class="partidas-chart-axis-label" text-anchor="${index === 0 ? "start" : index === monthLabels.length - 1 ? "end" : "middle"}">${escapeHtml(monthLabels[index] || "")}</text>`,
    )
    .join("");
  const endpointDots = series
    .map((item) => {
      const lastRow = item.rows.at(-1);
      if (!lastRow) return "";
      const x = xFor(item.rows.length - 1);
      const y = yFor(Number(lastRow.totalLiquidity || 0));
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.5" class="${item.dotCls}" />`;
    })
    .join("");
  const legend = series
    .map((item) => `<span><i class="${item.keyCls}"></i>${escapeHtml(item.label)}</span>`)
    .concat(reserve > 0 ? [`<span><i class="cambios-chart-key-reserve"></i>Reserva ${money(reserve, true)}</span>`] : [])
    .join("");
  const payload = JSON.stringify({
    width,
    monthCount,
    months: monthLabels,
    series: series.map((item) => ({ label: item.label, values: item.rows.map((row) => round2(Number(row.totalLiquidity || 0))) })),
  });
  return `<div class="planificacion-partidas-chart-wrap" data-partidas-chart-points="${escapeHtml(payload)}">
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Liquidez mes a mes: sin decisiones, confirmado, ediciones sin guardar y escenarios propuestos" preserveAspectRatio="none" data-partidas-chart-svg>
      ${reserve > 0 ? `<line x1="0" y1="${reserveY.toFixed(1)}" x2="${width}" y2="${reserveY.toFixed(1)}" class="cambios-chart-reserve" />` : ""}
      ${series.map((item) => `<path d="${path(item.rows)}" class="${item.cls}" />`).join("")}
      ${endpointDots}
      ${axisLabels}
      <line x1="0" y1="${padTop}" x2="0" y2="${height - padBottom}" class="partidas-chart-crosshair" hidden data-partidas-chart-crosshair />
    </svg>
    <div class="partidas-chart-tooltip" hidden data-partidas-chart-tooltip></div>
    <div class="cambios-chart-legend">${legend}</div>
  </div>`;
}

// Desalojado de app.js (XGO-01 · PR-2, sesión 334, 21/10/2026), sin cambiar una coma: Plan › Partidas (tabla de gestión, alta y edición por lotes, editor de series, simulador «¿y si…?», hitos, escenarios fantasma y gráfico).
// Siguen siendo funciones globales del mismo ámbito que app.js; este fichero se carga antes que él, así que ya
// existen cuando app.js arranca. Solo declaraciones de función: nada se ejecuta al cargar.

// Planificación de partidas: el forecast central, con lo confirmado (customPlanningRows +
// decisiones approved/fixed, ya agregado en lastSimulation/projectPlan por recomputeModelIfNeeded)
// y lo provisional (decisiones pending guardadas desde Control de deuda/Simulador, más la ruta del
// Agente) en un único sitio. No recalcula nada por su cuenta: solo lee las mismas piezas globales
// que ya usan Cuadro de mandos y Hoy, para no divergir de lo que el usuario ve en su origen.
function planificacionPartidasProvisionalItems() {
  const pendingDebt = debtLiquidations
    .filter((item) => decisionLifecycleStatus(item) === "pending")
    .map((item) => ({ item, sourceLabel: "Deuda", origin: "debt-control", originLabel: "Control de deuda", tag: "Pendiente" }));
  const pendingProjects = projects
    .filter((item) => decisionLifecycleStatus(item) === "pending")
    .map((item) => ({ item, sourceLabel: "Proyecto", origin: "simulator", originLabel: "Simulador", tag: "Pendiente" }));
  const agentRoute = debtLiquidations
    .filter((item) => isAgentRouteSimulationDecision(item))
    .map((item) => ({ item, sourceLabel: "Deuda", origin: "savings-agent", originLabel: "Agente de ahorro", tag: "Ruta del Agente" }));
  return [...pendingDebt, ...pendingProjects, ...agentRoute];
}

function planificacionPartidasEscenariosPropuestos() {
  return loadEscenarioMotorSaved().filter((entry) => !entry.archived && entry.estado === "propuesto");
}

function partidasSectionKey(section) {
  return `${section.kind}:${section.name}`;
}

function togglePartidasSection(key) {
  if (partidasGestionExpanded.has(key)) partidasGestionExpanded.delete(key);
  else partidasGestionExpanded.add(key);
  renderPartidasGestionTable(visualMonths());
}

// Fila de previsualización del simulador ("¿Y si...?"): pura lectura de partidasSimPreview, sin
// tocar visualDraftCells ni ningún estado que otras pantallas compartan — desaparece sola en
// cuanto se limpia partidasSimPreview (Quitar, nueva simulación, o Guardar/Descartar de verdad).
function partidasSimPreviewRowHtml(months) {
  if (!partidasSimPreview) return "";
  const byMonth = new Map(partidasSimPreview.monthlyDeltas.map((item) => [item.key, item.value]));
  const cells = months
    .map((month) => {
      const value = byMonth.get(month.key) || 0;
      return `<td class="planificacion-partidas-sim-preview-cell">${value ? partidasSimuladorMoneyDelta(value) : "—"}</td>`;
    })
    .join("");
  return `<tr class="planificacion-partidas-sim-preview-row">
    <td>
      <div class="planificacion-partidas-sim-preview-heading">
        <span class="e19-badge e19-badge-accent">Simulación</span>
        <strong>${escapeHtml(partidasSimPreview.titulo)}</strong>
        <small>Previsualización, no guardada</small>
      </div>
    </td>
    ${cells}
    <td><button type="button" class="row-delete-button" data-partidas-sim-clear-preview>Quitar</button></td>
  </tr>`;
}

// Totales estilo "Cuadro de mandos (heredado)" (mismos rótulos, mismas clases `.visual-calculated-row`
// ya definidas en styles.css): Ingresos, Gastos y Resultado del rango visible, agregados con
// `visualSectionTotal` tal cual — nada nuevo, solo sumar lo que cada sección ya reporta.
// "Disponible para traspaso" (los cuatro heredados) se queda en la pantalla legacy a propósito: no
// mide el impacto de una decisión, depende de saldos reales de cuenta y de la fecha de nómina.
function partidasTotalsByKind(months, kind) {
  const sections = baseData.monthlyPlanning.sections.filter((section) => section.kind === kind).map((section) => ({ section, rows: visualRowsForSection(section, months) }));
  return months.map((month) =>
    round2(sections.reduce((sum, { section, rows }) => sum + visualSectionTotal(section, rows, months, "planned", month), 0)),
  );
}

function partidasCalculatedRowHtml(className, label, detail, values) {
  return `<tr class="visual-section-row visual-calculated-row ${className}">
    <td>
      <div class="visual-calculated-label">
        <strong>${escapeHtml(label)}</strong>
        <small>${escapeHtml(detail)}</small>
      </div>
    </td>
    ${values.map((value) => `<td>${money(value, true)}</td>`).join("")}
    <td></td>
  </tr>`;
}

// Resultado "con impacto": el mismo delta neto mes a mes que ya calcula partidasSimuladorMonthlyDeltas
// (diferencia de liquidez acumulada) es exactamente el cambio en Ingresos-Gastos de ese mes, toque la
// decisión ingreso, gasto o ambos a la vez — así que sumarlo directamente al Resultado base es
// correcto para cualquier tipo de decisión, no solo compra/deuda_nueva.
function partidasResultConSimulacionRowHtml(months, resultValues) {
  if (!partidasSimPreview) return "";
  const byMonth = new Map(partidasSimPreview.monthlyDeltas.map((item) => [item.key, item.value]));
  const values = months.map((month, index) => round2(resultValues[index] + (byMonth.get(month.key) || 0)));
  return `<tr class="visual-section-row visual-calculated-row result-section planificacion-partidas-sim-preview-row">
    <td>
      <div class="visual-calculated-label">
        <strong>Resultado con la simulación</strong>
        <small>Si aplicaras «${escapeHtml(partidasSimPreview.titulo)}» — solo previsualización.</small>
      </div>
    </td>
    ${values.map((value) => `<td>${money(value, true)}</td>`).join("")}
    <td></td>
  </tr>`;
}

// Saldo de CaixaBank al empezar cada mes, tal y como lo trae la simulación real (lastSimulation);
// si un mes no tiene fila propia en la simulación, se cae al saldo actual de la cuenta. Compartido
// entre "Cashflow previsto" y "Disponible para traspaso".
function partidasStartingCaixaByMonth(months) {
  const simulationByMonth = new Map(lastSimulation.map((row) => [row.detailMonthKey, row]));
  const startingCaixaFallback = Number(accountBalancesFromState().caixa || 0);
  return months.map((month) => {
    const row = simulationByMonth.get(month.key);
    return Number(row?.startChecking ?? startingCaixaFallback);
  });
}

// --- Cashflow previsto: saldo + resultado del mes, justo debajo del Resultado --------------------
function partidasCashflowByMonth(months, resultTotals) {
  const startingCaixa = partidasStartingCaixaByMonth(months);
  return months.map((month, index) => round2(startingCaixa[index] + resultTotals[index]));
}

// --- "Disponible para traspaso" heredado, en bloque aparte tras el Resultado --------------------
// Mismas cuatro fórmulas que renderVisualDetailTable en "Cuadro de mandos (heredado)", reescritas
// sobre datos ya disponibles aquí (lastSimulation, accountBalancesFromState/agentCaixaFloor
// globales, los propios Total ingresos/gastos de esta tabla) — sin tocar #visual-detail para nada.
function partidasAvailableForTransferByMonth(months, incomeTotals, expenseTotals) {
  const startingCaixa = partidasStartingCaixaByMonth(months);
  const floor = agentCaixaFloor();
  return months.map((month, index) => Math.max(0, round2(startingCaixa[index] + incomeTotals[index] - expenseTotals[index] - floor)));
}

// El mes siguiente puede caer fuera del rango visible de la tabla, así que se lee directamente de
// lastSimulation (todo el horizonte), igual que hace la pantalla heredada, no de expenseTotals.
function partidasNextMonthPlannedExpenses(months) {
  const simulationByMonth = new Map(lastSimulation.map((row) => [row.detailMonthKey, row]));
  return months.map((month) => {
    const nextKey = monthKey(addMonths(dateFromMonthKey(month.key), 1));
    return Math.max(0, round2(Number(simulationByMonth.get(nextKey)?.outflowsBeforeSaving || 0)));
  });
}

function partidasTereSalaryByMonth(months) {
  const rows = baseData.monthlyPlanning.sections
    .filter((section) => section.kind === "income")
    .flatMap((section) => visualRowsForSection(section, months))
    .filter((row) => {
      if (isVisualRowPendingDelete(seriesKeyForRow(row))) return false;
      const label = normalizedText(visualDisplayLabel(row));
      return label.includes("tere") && (label.includes("nomina") || label.includes("salario"));
    });
  return months.map((month) => round2(rows.reduce((sum, row) => sum + Number(visualCellValue(row, month, "planned") || 0), 0)));
}

function partidasTransferRowsHtml(months, incomeTotals, expenseTotals) {
  const available = partidasAvailableForTransferByMonth(months, incomeTotals, expenseTotals);
  const nextExpenses = partidasNextMonthPlannedExpenses(months);
  const tereSalary = partidasTereSalaryByMonth(months);
  const prudent = available.map((value, index) => Math.max(0, round2(value - nextExpenses[index])));
  const adjusted = available.map((value, index) => Math.max(0, round2(value + tereSalary[index])));
  const prudentAdjusted = available.map((value, index) => Math.max(0, round2(value + tereSalary[index] - nextExpenses[index])));
  const heading = `<tr class="visual-section-row visual-calculated-row planificacion-partidas-transfer-heading">
    <td colspan="${months.length + 2}">
      <div class="visual-calculated-label">
        <strong>Disponible para traspaso</strong>
        <small>Mismas cuatro cifras que "Cuadro de mandos (heredado)", en bloque aparte.</small>
      </div>
    </td>
  </tr>`;
  return [
    heading,
    partidasCalculatedRowHtml("transfer-section", "Disponible para traspaso", "Referencia: cierre estimado del mes. CaixaBank estimado + ingresos - gastos - reserva operativa común.", available),
    partidasCalculatedRowHtml("transfer-adjusted-section", "Disponible para traspaso ajustado", "Referencia: día 25 aprox. del mes, tras nómina Tere. Disponible + nómina Tere.", adjusted),
    partidasCalculatedRowHtml("transfer-prudent-section", "Disponible para traspaso prudente", "Referencia: cierre estimado del mes, cubriendo también los gastos previstos del mes siguiente.", prudent),
    partidasCalculatedRowHtml("transfer-prudent-adjusted-section", "Disponible para traspaso prudente ajustado", "Referencia: día 25 aprox. del mes, tras nómina Tere y cubriendo los gastos previstos del mes siguiente.", prudentAdjusted),
  ].join("");
}

function renderPartidasGestionTable(months) {
  const table = qs("partidasGestionTable");
  if (!table) return;
  const body = [partidasSimPreviewRowHtml(months)];
  baseData.monthlyPlanning.sections.forEach((section) => {
    const rows = visualRowsForSection(section, months);
    if (!rows.length) return;
    const key = partidasSectionKey(section);
    const expanded = partidasGestionExpanded.has(key);
    const totals = months.map((month) => visualSectionTotal(section, rows, months, "planned", month));
    body.push(`<tr class="visual-section-row">
      <td>
        <button type="button" class="visual-section-toggle" data-partidas-section-toggle="${escapeHtml(key)}">
          ${expanded ? "▾" : "▸"} ${escapeHtml(section.name)}
        </button>
      </td>
      ${totals.map((value) => `<td class="${visualCellClass(section)}">${money(value, true)}</td>`).join("")}
      <td></td>
    </tr>`);
    if (!expanded) return;
    rows.forEach((row) => {
      const label = visualDisplayLabel(row);
      const rowKey = seriesKeyForRow(row);
      const pendingDelete = isVisualRowPendingDelete(rowKey);
      const selected = visualSelectedRows.has(rowKey);
      body.push(`<tr class="visual-line-row ${pendingDelete ? "pending-delete" : ""} ${selected ? "selected" : ""}">
        <td>
          <div class="visual-row-heading">
            <input class="visual-select-row" data-partidas-select-row="${escapeHtml(rowKey)}" type="checkbox" ${selected ? "checked" : ""} ${pendingDelete ? "disabled" : ""} aria-label="Seleccionar ${escapeHtml(label)}" />
            <div>
              <input class="visual-label-input" data-partidas-label-key="${escapeHtml(rowKey)}" value="${escapeHtml(label)}" ${pendingDelete ? "disabled" : ""} />
              <small>${escapeHtml(section.name)}${row.custom ? " · nuevo" : ""}${pendingDelete ? " · se borrará al guardar" : ""}</small>
            </div>
          </div>
        </td>
        ${months
          .map((month) => {
            const info = actualAwareInfoForVisualRow(row, month);
            const value = visualCellValue(row, month, "planned");
            const historical = isClosedMonthKey(month.key);
            return `<td>
              <input class="visual-amount-input ${historical ? "historical-value" : ""}" data-partidas-cell="${escapeHtml(rowKey)}" data-partidas-month="${month.key}" type="number" step="0.01" value="${amountInputValue(value)}" ${pendingDelete || historical ? "disabled" : ""} />
              <small class="visual-value-context">Usado ${info.hasActual ? `<strong>${money(info.actual, true)}</strong> (real)` : `${money(info.planned, true)} (previsto)`}</small>
            </td>`;
          })
          .join("")}
        <td><button class="row-delete-button" type="button" data-partidas-delete="${escapeHtml(rowKey)}" ${pendingDelete ? "disabled" : ""}>${pendingDelete ? "Pendiente" : "Eliminar"}</button></td>
      </tr>`);
    });
  });
  const hasSectionRows = baseData.monthlyPlanning.sections.some((section) => visualRowsForSection(section, months).length);
  if (hasSectionRows) {
    const incomeTotals = partidasTotalsByKind(months, "income");
    const expenseTotals = partidasTotalsByKind(months, "expense");
    const resultTotals = incomeTotals.map((value, index) => round2(value - expenseTotals[index]));
    body.push(partidasCalculatedRowHtml("", "Total ingresos", "Suma de todas las secciones de ingresos.", incomeTotals));
    body.push(partidasCalculatedRowHtml("total-expense-section", "Total gastos", "Suma de fijos, variables, suscripciones, financiaciones y proyectos.", expenseTotals));
    body.push(partidasCalculatedRowHtml("result-section", "Resultado", "Ingresos totales menos total de gastos del mes.", resultTotals));
    body.push(partidasCalculatedRowHtml("", "Cashflow previsto", "Saldo + resultado del mes: saldo estimado tras cerrar ese mes.", partidasCashflowByMonth(months, resultTotals)));
    body.push(partidasResultConSimulacionRowHtml(months, resultTotals));
    body.push(partidasTransferRowsHtml(months, incomeTotals, expenseTotals));
  }
  table.innerHTML = `<thead><tr><th>Partida</th>${months.map((month) => `<th>${escapeHtml(month.label)}</th>`).join("")}<th></th></tr></thead><tbody>${body.join("") || `<tr><td colspan="${months.length + 2}">Sin partidas en los meses visibles.</td></tr>`}</tbody>`;
}

function renderPartidasImpactBar() {
  const bar = qs("partidasImpactBar");
  if (!bar) return;
  const impact = cuadroMandosImpact();
  if (!impact.drafts.length) {
    bar.hidden = true;
    bar.innerHTML = "";
    return;
  }
  bar.hidden = false;
  if (!impact.ok) {
    bar.innerHTML = `<div class="cuadro-mandos-impact-head"><p class="e19-eyebrow">Impacto del cambio</p><strong>No se ha podido calcular</strong><small>El motor no acepta esta combinación; los cambios siguen sin guardar.</small></div>
      <div class="cuadro-mandos-impact-actions"><button type="button" class="e19-btn e19-btn-secondary" data-partidas-discard>Descartar</button></div>`;
    return;
  }
  const { before, after, drafts } = impact;
  const last = drafts.at(-1);
  bar.innerHTML = `
    <div class="cuadro-mandos-impact-head">
      <p class="e19-eyebrow">Impacto del cambio</p>
      <strong>${escapeHtml(last?.label || "Cambio")}${last?.monthLabel ? ` · ${escapeHtml(last.monthLabel)}` : ""}</strong>
      <small>${drafts.length} ${drafts.length === 1 ? "cambio" : "cambios"} sin guardar</small>
    </div>
    <dl><dt>Mínimo del horizonte</dt>${cuadroMandosBeforeAfter(before.minimo, after.minimo, (value) => money(value, true))}</dl>
    <dl><dt>Meses ${escapeHtml(cuadroMandosReserveLabel(after))}</dt>${cuadroMandosBeforeAfter(before.bajoReserva, after.bajoReserva, (value) => `${Math.round(Number(value || 0))}`, false)}</dl>
    <dl><dt>Liquidez al final</dt>${cuadroMandosBeforeAfter(before.final, after.final, (value) => money(value, true))}</dl>
    <dl title="No se mueve al editar previsto: se mueve desde Simular o Deuda."><dt>Fecha libre de deuda (fija)</dt><dd>${escapeHtml(cuadroMandosDebtFreeReadout())}</dd></dl>
    <div class="cuadro-mandos-impact-actions">
      <button type="button" class="e19-btn e19-btn-secondary" data-partidas-discard>Descartar</button>
      <button type="button" class="e19-btn e19-btn-primary" data-partidas-save>Guardar cambios</button>
    </div>`;
}

function renderPartidasSavePanel() {
  const panel = qs("partidasSavePanel");
  if (!panel) return;
  const counts = visualPendingCounts();
  const pending = counts.cells + counts.labels + counts.deletes;
  qs("partidasSaveTitle").textContent = pending ? `${pending} ${pending === 1 ? "cambio pendiente" : "cambios pendientes"}` : "Planificación guardada";
  const parts = [];
  if (counts.cells) parts.push(`${counts.cells} ${counts.cells === 1 ? "importe" : "importes"}`);
  if (counts.labels) parts.push(`${counts.labels} ${counts.labels === 1 ? "nombre" : "nombres"}`);
  if (counts.deletes) parts.push(`${counts.deletes} ${counts.deletes === 1 ? "partida" : "partidas"} para borrar`);
  if (counts.selected) parts.push(`${counts.selected} ${counts.selected === 1 ? "seleccionada" : "seleccionadas"}`);
  qs("partidasSaveSummary").textContent = parts.length
    ? `Se guardarán: ${parts.join(", ")}.`
    : "Añade, edita o borra partidas arriba. Los cambios se acumulan aquí hasta que los guardes.";
  panel.classList.toggle("has-pending", pending > 0 || counts.selected > 0);
  qs("partidasSaveChangesBtn").disabled = pending === 0;
  qs("partidasDiscardChangesBtn").disabled = pending === 0 && counts.selected === 0;
  qs("partidasBulkDeleteBtn").disabled = counts.selected === 0;
}

function renderPartidasGestionBlocks() {
  const months = visualMonths();
  renderPartidasGestionTable(months);
  renderPartidasImpactBar();
  renderPartidasSavePanel();
}

function handlePartidasCellChange(input) {
  const parsed = parseAmount(input.value);
  const staged = cuadroMandosStageCell(
    input.dataset.partidasCell,
    input.dataset.partidasMonth,
    input.value === "" || parsed === null ? 0 : parsed,
  );
  if (!staged) return;
  renderPartidasGestionBlocks();
}

function handlePartidasLabelChange(input) {
  const row = rowForSeriesKey(input.dataset.partidasLabelKey);
  if (!row) return;
  const label = input.value.trim();
  const key = seriesKeyForRow(row);
  if (!label || label === displayLabelForRow(row)) delete visualDraftLabels[key];
  else visualDraftLabels[key] = { rowKey: key, oldValue: displayLabelForRow(row), value: label };
  renderPartidasGestionBlocks();
}

function handlePartidasDeleteRow(rowKey) {
  const row = rowForSeriesKey(rowKey);
  if (!row) return;
  visualDraftDeletes[rowKey] = { rowKey, label: displayLabelForRow(row) };
  visualSelectedRows.delete(rowKey);
  renderPartidasGestionBlocks();
}

function handlePartidasRowSelect(rowKey, checked) {
  if (checked) visualSelectedRows.add(rowKey);
  else visualSelectedRows.delete(rowKey);
  renderPartidasGestionBlocks();
}

function handlePartidasBulkDelete() {
  stageSelectedVisualDeletes();
  renderPartidasGestionBlocks();
}

function handlePartidasSave() {
  saveVisualChanges();
  partidasSimPreview = null;
  announceStatus("Cambios de planificación guardados.");
}

function handlePartidasDiscard() {
  discardVisualChanges();
  partidasSimPreview = null;
  announceStatus("Cambios descartados. Los importes vuelven a los guardados.");
  render();
}

function partidasAddSingleMonthMode() {
  return (qs("partidasAddScope")?.value || "single") === "single";
}

function syncPartidasAddSectionOptions() {
  const kind = qs("partidasAddKind")?.value || "expense";
  const sectionSelect = qs("partidasAddSection");
  if (!sectionSelect) return;
  const previous = sectionSelect.value;
  const sections = baseData.monthlyPlanning.sections.filter((section) => section.kind === kind);
  sectionSelect.innerHTML = sections.map((section) => `<option value="${escapeHtml(section.name)}">${escapeHtml(section.name)}</option>`).join("");
  if ([...sectionSelect.options].some((option) => option.value === previous)) sectionSelect.value = previous;
}

function syncPartidasAddScopeUi() {
  const start = qs("partidasAddStartMonth");
  const end = qs("partidasAddEndMonth");
  if (!start || !end) return;
  if (partidasAddSingleMonthMode()) {
    end.value = start.value;
    end.disabled = true;
  } else {
    end.disabled = false;
  }
}

function handlePartidasAddRow() {
  const kind = qs("partidasAddKind").value;
  const sectionName = qs("partidasAddSection").value;
  const label = qs("partidasAddLabel").value.trim();
  const amountInput = qs("partidasAddAmount").value;
  const parsedAmount = parseAmount(amountInput);
  const amount = amountInput === "" || parsedAmount === null ? 0 : round2(parsedAmount);
  const startKey = qs("partidasAddStartMonth").value;
  const endKey = partidasAddSingleMonthMode() ? startKey : qs("partidasAddEndMonth").value;
  const feedback = qs("partidasAddFeedback");
  if (!label) {
    if (feedback) {
      feedback.textContent = "Pon un nombre de concepto para crear la línea.";
      feedback.className = "inline-feedback warning";
    }
    qs("partidasAddLabel").focus();
    return;
  }
  const sharedId = `custom-${kind}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const targetMonths = monthsInRange(startKey, endKey);
  targetMonths.forEach((month) => {
    customPlanningRows.push({ id: sharedId, custom: true, kind, sectionName, label, monthKey: month.key, plannedValue: amount });
  });
  partidasGestionExpanded.add(`${kind}:${sectionName}`);
  if (expandedPlanningSections[kind]) expandedPlanningSections[kind].add(`${kind}:${sectionName}`);
  saveCustomPlanningRows();
  qs("partidasAddLabel").value = "";
  qs("partidasAddAmount").value = "";
  render();
  if (qs("partidasAddFeedback")) {
    const scopeText = targetMonths.length === 1 ? `solo en ${targetMonths[0].label}` : `de ${targetMonths[0]?.label} a ${targetMonths.at(-1)?.label}`;
    qs("partidasAddFeedback").textContent = `${label} añadida ${scopeText}. Ya recalcula todo el dashboard.`;
    qs("partidasAddFeedback").className = "inline-feedback success";
  }
}

// --- Bloque analítico: ranking de impacto por decisión (leave-one-out / add-one-in) ------------
// Mismo mecanismo "quitar/añadir y volver a calcular sin persistir" que ya usa `cuadroMandosRowsWith`
// (con `seriesOverrides`) y `cambiosPendientesRanked` (con `visualDraftCells`), aplicado aquí a
// decisiones reales de deuda/proyectos: restaura `debtLiquidations`/`projects` en el `finally`.
function planificacionPartidasRowsWithOverride(type, id, forceActive) {
  const backupDebt = debtLiquidations;
  const backupProjects = projects;
  try {
    if (type === "debt") {
      debtLiquidations = forceActive
        ? debtLiquidations.map((item) => (item.id === id ? { ...item, lifecycleState: "approved" } : item))
        : debtLiquidations.filter((item) => item.id !== id);
    } else if (type === "project") {
      projects = forceActive
        ? projects.map((item) => (item.id === id ? { ...item, lifecycleState: "approved" } : item))
        : projects.filter((item) => item.id !== id);
    }
    const schedule = buildProjectSchedule();
    return { rows: computeCanonicalScenario(schedule.outflows, { captureEngineRun: false }).rows, ok: true };
  } catch (error) {
    return { rows: lastSimulation, ok: false, error };
  } finally {
    debtLiquidations = backupDebt;
    projects = backupProjects;
  }
}

function planificacionPartidasRankedImpact() {
  const active = [
    ...debtLiquidations
      .filter((item) => ["approved", "fixed"].includes(decisionLifecycleStatus(item)) || isAgentRouteSimulationDecision(item))
      .map((item) => ({
        type: "debt",
        id: item.id,
        item,
        label: item.name || "Decisión de deuda",
        tag: isAgentRouteSimulationDecision(item) ? "Ruta del Agente" : "Confirmada",
        origin: "debt-control",
        originLabel: "Control de deuda",
        forceActive: false,
      })),
    ...projects
      .filter((item) => ["approved", "fixed"].includes(decisionLifecycleStatus(item)))
      .map((item) => ({
        type: "project",
        id: item.id,
        item,
        label: item.name || item.title || "Proyecto",
        tag: "Confirmada",
        origin: "simulator",
        originLabel: "Simulador",
        forceActive: false,
      })),
  ];
  const provisional = [
    ...debtLiquidations
      .filter((item) => decisionLifecycleStatus(item) === "pending")
      .map((item) => ({
        type: "debt",
        id: item.id,
        item,
        label: item.name || "Decisión de deuda",
        tag: "Pendiente",
        origin: "debt-control",
        originLabel: "Control de deuda",
        forceActive: true,
      })),
    ...projects
      .filter((item) => decisionLifecycleStatus(item) === "pending")
      .map((item) => ({
        type: "project",
        id: item.id,
        item,
        label: item.name || item.title || "Proyecto",
        tag: "Pendiente",
        origin: "simulator",
        originLabel: "Simulador",
        forceActive: true,
      })),
  ];
  const decisions = [...active, ...provisional];
  if (!decisions.length) return [];
  const currentMinimo = cuadroMandosSummary(lastSimulation).minimo;
  return decisions
    .map((decision) => {
      const alt = planificacionPartidasRowsWithOverride(decision.type, decision.id, decision.forceActive);
      const altMinimo = alt.ok ? cuadroMandosSummary(alt.rows).minimo : null;
      const efecto = alt.ok ? cuadroMandosDelta(currentMinimo, altMinimo) : null;
      return { ...decision, efecto };
    })
    .sort((left, right) => Math.abs(right.efecto || 0) - Math.abs(left.efecto || 0));
}

function planificacionPartidasRankedImpactHtml(ranked) {
  if (!ranked.length) return `<p class="empty-state compact">No hay decisiones confirmadas ni provisionales que comparar.</p>`;
  return `<ul class="planificacion-partidas-ranked-list">${ranked
    .map((decision) => {
      const efectoText = decision.efecto === null ? "Sin datos" : `${decision.efecto >= 0 ? "+" : ""}${money(decision.efecto, true)} en el mínimo`;
      const tone = decision.efecto === null ? "" : decision.efecto >= 0 ? "positive" : "negative";
      return `<li>
        <div>
          <strong>${escapeHtml(decision.label)}</strong>
          <span class="e19-badge">${escapeHtml(decision.tag)}</span>
          <small>${escapeHtml(decision.originLabel)}</small>
        </div>
        <div>
          <b class="${tone}">${escapeHtml(efectoText)}</b>
          <button type="button" data-home-nav="${escapeHtml(decision.origin)}">Ir a ${escapeHtml(decision.originLabel)}</button>
        </div>
      </li>`;
    })
    .join("")}</ul>`;
}

// --- Bloque analítico: hitos narrativos ---------------------------------------------------------
// Mismo patrón que analisisNetWorthMilestonesHtml (Análisis, A-5): frases con fecha en vez de
// cifras sueltas.
function planificacionPartidasCushionMilestone(floor) {
  let lastDipIndex = -1;
  lastSimulation.forEach((row, index) => {
    if (Number(row.totalLiquidity || 0) < floor.value) lastDipIndex = index;
  });
  if (lastDipIndex === -1) return { achieved: true, alreadyMet: true, month: lastSimulation[0] || null };
  if (lastDipIndex >= lastSimulation.length - 1) return { achieved: false, alreadyMet: false, month: null };
  return { achieved: true, alreadyMet: false, month: lastSimulation[lastDipIndex + 1] };
}

function planificacionPartidasNextBelowReserve(floor) {
  return lastSimulation.find((row) => Number(row.totalLiquidity || 0) < floor.value) || null;
}

function planificacionPartidasHitos() {
  const reserve = cuadroMandosReserve();
  const floor = FinanceCanonicalCushion.cushionFloor(lastSimulation, reserve);
  const cushionMilestone = planificacionPartidasCushionMilestone(floor);
  const nextBelow = planificacionPartidasNextBelowReserve(floor);
  const debtFree = cuadroMandosDebtFreeReadout();
  const items = [{ tone: "neutral", text: `Libre de deuda: ${debtFree}` }];
  if (cushionMilestone.achieved && cushionMilestone.alreadyMet) {
    items.push({ tone: "up", text: "El colchón objetivo se cumple en todo el horizonte visible" });
  } else if (cushionMilestone.achieved && cushionMilestone.month) {
    items.push({ tone: "up", text: `Colchón objetivo alcanzado a partir de ${cushionMilestone.month.month || cushionMilestone.month.detailMonthKey}` });
  } else {
    items.push({ tone: "down", text: "El colchón objetivo no llega a cumplirse en todo el horizonte visible" });
  }
  items.push(
    nextBelow
      ? { tone: "down", text: `Próximo mes bajo reserva: ${nextBelow.month || nextBelow.detailMonthKey}` }
      : { tone: "up", text: "Ningún mes visible cae bajo la reserva" },
  );
  return items;
}

// Mismo componente `.deuda-ruta-checklist`/`.deuda-ruta-check` (is-ok/is-danger/is-neutral) que ya
// usa la tarjeta "Oferta en curso" de Deuda · Ruta — para que los hitos lean como conclusiones de
// una tarjeta oscura, no como badges sueltos.
function planificacionPartidasHitosHtml() {
  const items = planificacionPartidasHitos();
  const toneClass = { up: "is-ok", down: "is-danger", neutral: "is-neutral" };
  return `<ul class="deuda-ruta-checklist">${items
    .map((item) => `<li class="deuda-ruta-check ${toneClass[item.tone] || "is-neutral"}">${escapeHtml(item.text)}</li>`)
    .join("")}</ul>`;
}

// --- Bloque analítico: comparador de escenarios propuestos ---------------------------------------
// Mismo trío que ya usa cada tarjeta de "Escenarios guardados" (escenarioMotorSavedCardHtml) y el
// comparador A/B de dos escenarios para sacar min/final/libre-de-deuda de un escenario sin
// aplicarlo: escenarioMotorBaseInput() + runEscenarioMotor() + escenarioMotorSummaryFor().
function planificacionPartidasEscenarioGhosts() {
  const propuestos = planificacionPartidasEscenariosPropuestos();
  if (!propuestos.length) return [];
  const baseInput = escenarioMotorBaseInput();
  return propuestos.map((entry) => {
    const result = runEscenarioMotor(baseInput, entry.decisiones || [], entry.guardrailValue ?? null);
    const summary = escenarioMotorSummaryFor(result, baseInput.months);
    return { entry, summary, series: result?.valid ? result.series : null };
  });
}

function planificacionPartidasEscenarioGhostsHtml(ghosts) {
  if (!ghosts.length) return "";
  return `<div class="planificacion-partidas-propuestos">
    <p>${ghosts.length} ${ghosts.length === 1 ? "escenario propuesto" : "escenarios propuestos"} esperando confirmación en Cierre — su trazo aparece punteado en el gráfico de arriba, sin contar todavía en el resto de la pantalla.
      <button type="button" data-home-nav="cierre">Ir a Cierre</button>
    </p>
    <ul class="planificacion-partidas-ghost-list">
      ${ghosts
        .map(
          (ghost) => `<li>
        <strong>${escapeHtml(ghost.entry.nombre || "Escenario")}</strong>
        <span>Mínimo ${ghost.summary.minimoLiquidez !== null ? money(ghost.summary.minimoLiquidez, true) : "—"}</span>
        <span>Final ${ghost.summary.liquidezFinal !== null ? money(ghost.summary.liquidezFinal, true) : "—"}</span>
        <span>Libre de deuda ${escapeHtml(escenarioMotorMonthLabel(ghost.summary.libreDeDeuda))}</span>
      </li>`,
        )
        .join("")}
    </ul>
  </div>`;
}

function partidasSimuladorType() {
  return ESCENARIO_MOTOR_TYPES.find((entry) => entry.id === partidasSimTipo) || ESCENARIO_MOTOR_TYPES.find((entry) => entry.id === "compra");
}

function partidasSimuladorFieldsHtml(months) {
  const type = partidasSimuladorType();
  return type.campos
    .filter((field) => field.key !== "mes")
    .map((field) =>
      escenarioMotorFieldHtml(field, months, partidasSimValues, {
        idPrefix: "partidasSimField",
        dataAttr: "data-partidas-sim-field",
        wrapAttr: "data-partidas-sim-field-wrap",
      }),
    )
    .join("");
}

function partidasSimuladorSyncValues() {
  const type = partidasSimuladorType();
  type.campos.forEach((field) => {
    if (field.key === "mes") return;
    const element = qs(escenarioMotorFieldElementId(field.key, "partidasSimField"));
    if (!element) return;
    partidasSimValues[field.key] = escenarioMotorReadFieldValue(field, element);
  });
}

function partidasSimuladorSyncFieldVisibility() {
  const type = partidasSimuladorType();
  const container = qs("partidasSimFields");
  if (!container) return;
  type.campos.forEach((field) => {
    if (typeof field.visibleSi !== "function") return;
    const wrap = container.querySelector(`[data-partidas-sim-field-wrap="${field.key}"]`);
    if (wrap) wrap.hidden = !field.visibleSi(partidasSimValues);
  });
}

function renderPartidasSimuladorFields() {
  const container = qs("partidasSimFields");
  if (!container) return;
  container.innerHTML = partidasSimuladorFieldsHtml(selectableMonths());
}

function handlePartidasSimTipoChange(event) {
  partidasSimuladorSyncValues();
  partidasSimTipo = event.target.value;
  renderPartidasSimuladorFields();
  const resultEl = qs("partidasSimResult");
  if (resultEl) resultEl.innerHTML = "";
}

function handlePartidasSimFieldChange(event) {
  const key = event.target?.dataset?.partidasSimField;
  if (!key) return;
  const type = partidasSimuladorType();
  const field = type.campos.find((item) => item.key === key);
  if (!field) return;
  partidasSimValues[key] = escenarioMotorReadFieldValue(field, event.target);
  if (field.controla) partidasSimuladorSyncFieldVisibility();
}

function syncPartidasSimModoUi() {
  const modo = qs("partidasSimModo")?.value || "manual";
  qs("partidasSimMonthField")?.classList.toggle("is-hidden", modo !== "manual");
  qs("partidasSimRangeStartField")?.classList.toggle("is-hidden", modo !== "best");
  qs("partidasSimRangeEndField")?.classList.toggle("is-hidden", modo !== "best");
}

// Construye y valida una decisión compra/deuda_nueva anclada a un mes concreto, reutilizando el
// mismo trío type.params()/type.titulo()/Schema.validateDecision que handleEscenarioMotorSubmit —
// los mismos mensajes de error que vería en "Escenario · simular", no una comprobación paralela.
function partidasSimuladorBuildDecisionForMonth(monthKey) {
  const type = partidasSimuladorType();
  const effective = escenarioMotorEffectiveValues(type, partidasSimValues);
  const values = { ...effective, mes: monthKey };
  if (!String(values.nombre || "").trim()) values.nombre = type.id === "compra" ? "Compra" : undefined;
  const decision = {
    id: escenarioMotorNewDecisionId(),
    tipo: type.id,
    titulo: escenarioMotorTrim(type.titulo(values) || type.label),
    activa: true,
    orden: 0,
    planificacion: { modo: "manual", mesManual: monthKey },
    params: type.params(values),
  };
  const schema = window.FinanceCanonicalScenarioSchema;
  if (!schema) return { decision: null, errors: ["No se puede comprobar esta decisión: no se ha cargado canonical-scenario-schema.js."] };
  const issues = [];
  schema.validateDecision(decision, "$", issues);
  const errors = issues.filter((issue) => issue.severity === "error").map((issue) => issue.message);
  return { decision: errors.length ? null : decision, errors };
}

function partidasSimuladorBaseline(baseInput) {
  const result = runEscenarioMotor(baseInput, [], null);
  return escenarioMotorSummaryFor(result, baseInput.months);
}

function partidasSimuladorRunDecision(decision, baseInput) {
  const result = runEscenarioMotor(baseInput, decision ? [decision] : [], null);
  return escenarioMotorSummaryFor(result, baseInput.months);
}

// Barrido de meses candidatos: corre el motor una vez por mes, mide cuánta liquidez mínima queda en
// el horizonte con la decisión anclada a ese mes, y se queda con el máximo — "mejor fecha" significa
// aquí "la que menos araña el colchón", no la más barata ni la de mejor VAN (mismo alcance limitado
// que el resto del motor declara para "óptimo").
function partidasSimuladorScanMonths(months, baseInput, baselineSummary) {
  const results = months.map((month) => {
    const built = partidasSimuladorBuildDecisionForMonth(month.key);
    if (!built.decision) return { month, errors: built.errors, summary: null, deltaMinimo: null };
    const summary = partidasSimuladorRunDecision(built.decision, baseInput);
    const deltaMinimo = summary.minimoLiquidez !== null && baselineSummary.minimoLiquidez !== null
      ? round2(summary.minimoLiquidez - baselineSummary.minimoLiquidez)
      : null;
    return { month, decision: built.decision, summary, deltaMinimo, errors: [] };
  });
  const viable = results.filter((item) => item.summary && item.summary.minimoLiquidez !== null);
  const best = viable.length ? viable.reduce((a, b) => (b.summary.minimoLiquidez > a.summary.minimoLiquidez ? b : a)) : null;
  return { results, best };
}

function partidasSimuladorEvaluate() {
  partidasSimuladorSyncValues();
  const baseInput = escenarioMotorBaseInput();
  const baseline = partidasSimuladorBaseline(baseInput);
  const modo = qs("partidasSimModo")?.value || "manual";
  if (modo === "manual") {
    const monthKey = qs("partidasSimMonth")?.value || "";
    const built = partidasSimuladorBuildDecisionForMonth(monthKey);
    if (!built.decision) return { modo, errors: built.errors };
    const summary = partidasSimuladorRunDecision(built.decision, baseInput);
    const month = monthByKey(monthKey, selectableMonths());
    const deltaMinimo = summary.minimoLiquidez !== null && baseline.minimoLiquidez !== null ? round2(summary.minimoLiquidez - baseline.minimoLiquidez) : null;
    const deltaFinal = summary.liquidezFinal !== null && baseline.liquidezFinal !== null ? round2(summary.liquidezFinal - baseline.liquidezFinal) : null;
    const opportunityCost = partidasSimuladorOpportunityCostFor(built.decision, month, baseInput);
    return { modo, month, summary, baseline, deltaMinimo, deltaFinal, opportunityCost, errors: [], decision: built.decision, baseInput };
  }
  const months = monthsInRange(qs("partidasSimRangeStart")?.value || "", qs("partidasSimRangeEnd")?.value || "", selectableMonths());
  if (!months.length) return { modo, errors: ["Selecciona un rango de meses válido."] };
  const scan = partidasSimuladorScanMonths(months, baseInput, baseline);
  if (scan.best) scan.best.opportunityCost = partidasSimuladorOpportunityCostFor(scan.best.decision, scan.best.month, baseInput);
  return { modo, scan, baseline, errors: [], baseInput };
}

function partidasSimuladorOpportunityCostFor(decision, month, baseInput) {
  const engine = window.FinanceCanonicalPortfolio;
  if (!engine || !decision || decision.tipo !== "compra" || decision.params?.financiacion) return null;
  const annualReturnPct = iv5PortfolioAnnualReturnPct();
  if (annualReturnPct === null) return null;
  const months = Array.isArray(baseInput?.months) ? baseInput.months : [];
  const monthIndex = months.findIndex((entry) => entry.monthKey === month?.key);
  const remainingMonths = monthIndex >= 0 ? months.length - monthIndex : months.length;
  return engine.opportunityCost({ amount: decision.params?.importe, months: remainingMonths, annualReturnPct });
}

function partidasSimuladorOpportunityCostHtml(opportunityCost) {
  if (!opportunityCost || !opportunityCost.calculable) return "";
  return `<div class="asesor-decision-stat">
      <span>Coste de oportunidad, si se hubiera invertido en tu cartera</span>
      <strong>${money(opportunityCost.gain, true)}</strong>
      <em>a la XIRR real de tu cartera (${opportunityCost.annualReturnPct >= 0 ? "+" : ""}${opportunityCost.annualReturnPct}% anual) durante los ${opportunityCost.months} ${opportunityCost.months === 1 ? "mes restante" : "meses restantes"} del horizonte</em>
    </div>`;
}

function partidasSimuladorMoneyDelta(value) {
  if (value === null || value === undefined) return "—";
  return `<span class="${value >= 0 ? "is-up" : "is-down"}">${value >= 0 ? "+" : ""}${money(value, true)}</span>`;
}

// Efecto de caja mes a mes de una decisión, aislado del resto del plan: la diferencia entre la
// serie con la decisión y la serie base, mes a mes (no acumulada) — runEscenarioMotor solo expone
// liquidez acumulada, así que el efecto de un mes concreto es su delta acumulado menos el del mes
// anterior. Alineado por clave de mes (no por índice de columna), así que funciona igual empiece la
// decisión en el mes que sea, no solo en el mes actual.
function partidasSimuladorMonthlyDeltas(decision, baseInput) {
  const baselineResult = runEscenarioMotor(baseInput, [], null);
  const decisionResult = runEscenarioMotor(baseInput, decision ? [decision] : [], null);
  if (!baselineResult?.valid || !decisionResult?.valid) return [];
  const baselineSeries = baselineResult.series || [];
  const decisionSeries = decisionResult.series || [];
  let previousCumulative = 0;
  return (baseInput.months || []).map((month, index) => {
    const cumulative = round2((decisionSeries[index]?.totalLiquidity ?? 0) - (baselineSeries[index]?.totalLiquidity ?? 0));
    const monthly = round2(cumulative - previousCumulative);
    previousCumulative = cumulative;
    return { key: month.monthKey, value: monthly };
  });
}

function partidasSimuladorResultHtml(evaluation) {
  if (!evaluation) return "";
  if (evaluation.errors.length) {
    return `<p class="inline-feedback warning">${evaluation.errors.map((message) => escapeHtml(message)).join(" ")}</p>`;
  }
  if (evaluation.modo === "manual") {
    const { summary, month, deltaMinimo, deltaFinal, opportunityCost } = evaluation;
    return `<div class="planificacion-partidas-simulador-result">
      <div class="asesor-decision-stats">
        <div class="asesor-decision-stat">
          <span>Mínimo del horizonte con esta decisión</span>
          <strong>${summary.minimoLiquidez !== null ? money(summary.minimoLiquidez, true) : "—"}</strong>
          <em>${partidasSimuladorMoneyDelta(deltaMinimo)} vs. sin esta decisión</em>
        </div>
        <div class="asesor-decision-stat">
          <span>Liquidez final</span>
          <strong>${summary.liquidezFinal !== null ? money(summary.liquidezFinal, true) : "—"}</strong>
          <em>${partidasSimuladorMoneyDelta(deltaFinal)}</em>
        </div>
        <div class="asesor-decision-stat">
          <span>Meses de colchón</span>
          <strong>${summary.mesesColchon !== null && summary.mesesColchon !== undefined ? summary.mesesColchon.toLocaleString("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : "—"}</strong>
        </div>
        ${partidasSimuladorOpportunityCostHtml(opportunityCost)}
      </div>
      <p class="e19-kpi-note">Simulado en ${escapeHtml(month?.label || "—")}, sin guardar nada — los importes ya se ven en la tabla de abajo, fila "Simulación". Para llevarlo al plan real, créalo en "Escenario · simular".</p>
      <button type="button" class="ghost-button" data-partidas-sim-clear-preview>Quitar de la tabla</button>
    </div>`;
  }
  const { scan, baseline } = evaluation;
  if (!scan.best) {
    return `<p class="inline-feedback warning">Ningún mes del rango elegido pudo simularse. Revisa importe, cuota y plazo.</p>`;
  }
  // Sin lista de candidatos: con un horizonte de años, listar cada mes probado sería un scroll
  // infinito. Solo el mejor, con las mismas tres cifras que el modo manual — el detalle mes a mes ya
  // se ve en la tabla de abajo (fila "Simulación" + "Resultado con la simulación").
  const { summary, month, deltaMinimo, opportunityCost } = scan.best;
  const deltaFinal = summary.liquidezFinal !== null && baseline.liquidezFinal !== null ? round2(summary.liquidezFinal - baseline.liquidezFinal) : null;
  const testedCount = scan.results.filter((item) => item.summary).length;
  return `<div class="planificacion-partidas-simulador-result">
    <p class="e19-kpi-note"><span class="e19-badge e19-badge-success">Mejor mes · ${escapeHtml(month.label)}</span> de entre ${testedCount} ${testedCount === 1 ? "mes probado" : "meses probados"} en el rango elegido.</p>
    <div class="asesor-decision-stats">
      <div class="asesor-decision-stat">
        <span>Mínimo del horizonte con esta decisión</span>
        <strong>${summary.minimoLiquidez !== null ? money(summary.minimoLiquidez, true) : "—"}</strong>
        <em>${partidasSimuladorMoneyDelta(deltaMinimo)} vs. sin esta decisión</em>
      </div>
      <div class="asesor-decision-stat">
        <span>Liquidez final</span>
        <strong>${summary.liquidezFinal !== null ? money(summary.liquidezFinal, true) : "—"}</strong>
        <em>${partidasSimuladorMoneyDelta(deltaFinal)}</em>
      </div>
      <div class="asesor-decision-stat">
        <span>Meses de colchón</span>
        <strong>${summary.mesesColchon !== null && summary.mesesColchon !== undefined ? summary.mesesColchon.toLocaleString("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : "—"}</strong>
      </div>
      ${partidasSimuladorOpportunityCostHtml(opportunityCost)}
    </div>
    <p class="e19-kpi-note">Simulado en ${escapeHtml(month.label)}, sin guardar nada — los importes ya se ven en la tabla de abajo, fila "Simulación" y fila "Resultado con la simulación". Para llevarlo al plan real, créalo en "Escenario · simular".</p>
    <button type="button" class="ghost-button" data-partidas-sim-clear-preview>Quitar de la tabla</button>
  </div>`;
}

function handlePartidasSimular() {
  const resultEl = qs("partidasSimResult");
  if (!resultEl) return;
  const evaluation = partidasSimuladorEvaluate();
  resultEl.innerHTML = partidasSimuladorResultHtml(evaluation);
  const decision = evaluation.modo === "manual" ? evaluation.decision : evaluation.scan?.best?.decision;
  partidasSimPreview = decision && evaluation.baseInput
    ? { titulo: decision.titulo, monthlyDeltas: partidasSimuladorMonthlyDeltas(decision, evaluation.baseInput) }
    : null;
  renderPartidasGestionTable(visualMonths());
}

function handlePartidasSimClearPreview() {
  partidasSimPreview = null;
  renderPartidasGestionTable(visualMonths());
}

function partidasSimuladorCardHtml() {
  const months = selectableMonths();
  const defaultStart = months.find((month) => !isClosedMonthKey(month.key))?.key || months[0]?.key || "";
  return `<article class="e19-card visual-add-card planificacion-partidas-simulador">
    <div class="module-heading">
      <div>
        <p class="panel-kicker">¿Y si...?</p>
        <h3>Simulador de una decisión</h3>
        <p>Prueba una compra o un crédito nuevo hipotéticos — quién, cuánto, con qué cuota — y mira el impacto en el forecast antes de decidir nada. No guarda nada.</p>
      </div>
    </div>
    <div class="visual-add-grid">
      <label>
        <span>Tipo</span>
        <select id="partidasSimTipoSelect" data-partidas-sim-tipo>
          <option value="compra"${partidasSimTipo === "compra" ? " selected" : ""}>Compra grande</option>
          <option value="deuda_nueva"${partidasSimTipo === "deuda_nueva" ? " selected" : ""}>Crédito nuevo</option>
        </select>
      </label>
      <label>
        <span>Fecha</span>
        <select id="partidasSimModo" data-partidas-sim-modo>
          <option value="manual">Un mes concreto</option>
          <option value="best">Buscar la mejor fecha en un rango</option>
        </select>
      </label>
      <label id="partidasSimMonthField">
        <span>Mes</span>
        <select id="partidasSimMonth">${monthOptionsHtml(defaultStart, months)}</select>
      </label>
      <label id="partidasSimRangeStartField" class="is-hidden">
        <span>Desde</span>
        <select id="partidasSimRangeStart">${monthOptionsHtml(defaultStart, months)}</select>
      </label>
      <label id="partidasSimRangeEndField" class="is-hidden">
        <span>Hasta</span>
        <select id="partidasSimRangeEnd">${monthOptionsHtml(months.at(-1)?.key || defaultStart, months)}</select>
      </label>
    </div>
    <div class="visual-add-grid" id="partidasSimFields">${partidasSimuladorFieldsHtml(months)}</div>
    <button type="button" data-partidas-sim-run>Simular impacto</button>
    <div id="partidasSimResult"></div>
  </article>`;
}

// --- Resumen del plan: conclusiones + KPIs, tarjeta oscura al inicio de la pantalla -------------
// Mismo componente visual que la tarjeta "Oferta en curso" de Deuda · Ruta
// (`.deuda-ruta-offer-card.is-active`/`.asesor-decision-stats`/`.deuda-ruta-checklist`): fondo
// navy, tres cifras grandes y una lista de hitos como píldoras de color. Aquí siempre está
// "activa" (no depende de haber una oferta), así que las reglas CSS nuevas viven en su propia
// clase (`planificacion-partidas-summary`) en vez de reutilizar `.e19-deuda-decidir`/
// `.e19-asesor-decision`, para no acoplar esta pantalla al resto de esas dos.
function partidasSummaryCardHtml() {
  const baseFinal = lastBaseSimulation.at(-1)?.totalLiquidity ?? 0;
  const activeFinal = lastSimulation.at(-1)?.totalLiquidity ?? 0;
  const impact = round2(activeFinal - baseFinal);
  const reserve = cuadroMandosReserve();
  const floor = FinanceCanonicalCushion.cushionFloor(lastSimulation, reserve);
  const worst = FinanceCanonicalCushion.worstMonthOf(openSimulationRows(lastSimulation));
  const worstMonth = worst ? forecastMonths().find((month) => month.key === worst.key) : null;
  return `<article class="e19-card planificacion-partidas-summary">
    <div class="deuda-ruta-offer-eyebrow">
      <span>Resumen del plan</span>
      <span>Antes de guardar</span>
    </div>
    <h3 class="escenario-motor-panel-title">Gestión y forecast con todas las decisiones recogidas</h3>
    <p class="asesor-decision-subtitle">Edita partidas más abajo y estas cifras se recalculan al momento, antes de guardar.</p>
    <div class="asesor-decision-stats">
      <div class="asesor-decision-stat">
        <span>Peor mes del horizonte</span>
        <strong>${worstMonth ? `${escapeHtml(worstMonth.label)} · ${money(worst.value, true)}` : "Sin datos"}</strong>
      </div>
      <div class="asesor-decision-stat">
        <span>Colchón (${floor.basis === "operating-reserve" ? "reserva operativa" : "1 mes de gasto"})</span>
        <strong>${money(floor.value, true)}</strong>
      </div>
      <div class="asesor-decision-stat">
        <span>Impacto de las decisiones confirmadas</span>
        <strong>${projectPlan.placements.length ? `${impact >= 0 ? "+" : ""}${money(impact, true)} vs. sin decisiones` : "Sin decisiones cargadas"}</strong>
      </div>
    </div>
    <p class="panel-kicker">Hitos</p>
    ${planificacionPartidasHitosHtml()}
  </article>`;
}

// --- Ajuste rápido: modificar el previsto de una partida en un mes, un rango o varios meses -----
// concretos, o borrarla entera — mismo alcance que `stageVisualBulkEdit` de `#visual-detail`, pero
// con IDs propios y reutilizando `cuadroMandosStageCell` en vez de escribir `visualDraftCells` a
// mano (esa pieza ya es genérica). Solo cubre "previsto": el modo "real" sigue siendo cosa de
// Registrar, igual que el resto de esta pantalla.
function partidasBulkEditTargetMonths() {
  const months = selectableMonths();
  const scope = qs("partidasEditScope")?.value || "single";
  if (scope === "visible") return visualMonths();
  if (scope === "multiple") {
    return [...(qs("partidasEditMonths")?.selectedOptions || [])].map((option) => monthByKey(option.value, months)).filter(Boolean);
  }
  const startKey = qs("partidasEditStartMonth")?.value || months[0]?.key;
  const endKey = scope === "range" ? qs("partidasEditEndMonth")?.value : startKey;
  return monthsInRange(startKey, endKey, months);
}

function selectedPartidasEditRow() {
  const kind = qs("partidasEditKind")?.value || "expense";
  const key = qs("partidasEditRow")?.value || "";
  return availableSeriesRows(kind).find((row) => seriesKeyForRow(row) === key) || null;
}

function syncPartidasEditRowOptions() {
  const kind = qs("partidasEditKind")?.value || "expense";
  const rowSelect = qs("partidasEditRow");
  if (!rowSelect) return;
  const previous = rowSelect.value;
  const rows = availableSeriesRows(kind);
  rowSelect.innerHTML = rows.map((row) => `<option value="${escapeHtml(seriesKeyForRow(row))}">${escapeHtml(row.sectionName)} · ${escapeHtml(displayLabelForRow(row))}</option>`).join("");
  if ([...rowSelect.options].some((option) => option.value === previous)) rowSelect.value = previous;
}

function syncPartidasEditScopeUi() {
  const scope = qs("partidasEditScope")?.value || "single";
  const action = qs("partidasEditAction")?.value || "amount";
  const start = qs("partidasEditStartMonth");
  const end = qs("partidasEditEndMonth");
  const endField = qs("partidasEditEndMonthField");
  const multiField = qs("partidasEditMultiMonthField");
  const amountField = qs("partidasEditAmountField");
  if (!start || !end || !endField || !multiField) return;
  const isRange = scope === "range";
  const isMultiple = scope === "multiple";
  const usesMonths = action === "amount";
  endField.classList.toggle("is-hidden", !isRange || !usesMonths);
  multiField.classList.toggle("is-hidden", !isMultiple || !usesMonths);
  start.closest("label")?.classList.toggle("is-hidden", isMultiple || scope === "visible" || !usesMonths);
  amountField?.classList.toggle("is-hidden", !usesMonths);
  qs("partidasEditScope")?.closest("label")?.classList.toggle("is-hidden", !usesMonths);
  if (scope === "single") end.value = start.value;
}

function handlePartidasBulkEdit() {
  const row = selectedPartidasEditRow();
  const action = qs("partidasEditAction")?.value || "amount";
  const parsed = parseAmount(qs("partidasEditAmount")?.value);
  const feedback = qs("partidasBulkEditFeedback");
  const rowKey = row ? seriesKeyForRow(row) : "";
  if (!row) {
    if (feedback) {
      feedback.textContent = "Selecciona una partida para modificar.";
      feedback.className = "inline-feedback warning";
    }
    return;
  }
  const needsAmount = action === "amount";
  if (needsAmount && parsed === null) {
    if (feedback) {
      feedback.textContent = "Introduce el importe que quieres aplicar.";
      feedback.className = "inline-feedback warning";
    }
    qs("partidasEditAmount")?.focus();
    return;
  }
  const months = needsAmount ? partidasBulkEditTargetMonths() : [];
  if (needsAmount && !months.length) {
    if (feedback) {
      feedback.textContent = "Selecciona al menos un mes.";
      feedback.className = "inline-feedback warning";
    }
    return;
  }
  if (action === "delete") {
    visualDraftDeletes[rowKey] = { rowKey, label: displayLabelForRow(row) };
    Object.keys(visualDraftCells).forEach((key) => {
      if (visualDraftCells[key].rowKey === rowKey) delete visualDraftCells[key];
    });
    visualSelectedRows.delete(rowKey);
  }
  if (needsAmount) {
    const value = round2(parsed);
    months.forEach((month) => cuadroMandosStageCell(rowKey, month.key, value));
  }
  if (feedback) {
    const scopeText = !needsAmount ? "toda la fila" : months.length === 1 ? months[0].label : `${months[0].label} - ${months.at(-1).label}`;
    feedback.textContent = `${displayLabelForRow(row)}: ${action === "delete" ? "borrado preparado" : "importes preparados"} en ${scopeText}. Pulsa Guardar cambios para recalcular toda la app.`;
    feedback.className = "inline-feedback success";
  }
  partidasGestionExpanded.add(`${row.kind}:${row.sectionName}`);
  renderPartidasGestionBlocks();
}

// --- Hover del gráfico: crosshair + tooltip con el valor de cada trazo en el mes señalado --------
function hidePartidasChartTooltip() {
  document.querySelectorAll(".planificacion-partidas-chart-wrap [data-partidas-chart-tooltip]").forEach((el) => {
    el.hidden = true;
  });
  document.querySelectorAll(".planificacion-partidas-chart-wrap [data-partidas-chart-crosshair]").forEach((el) => {
    el.hidden = true;
  });
}

function handlePartidasChartHover(event) {
  const wrap = event.target.closest(".planificacion-partidas-chart-wrap");
  if (!wrap) {
    hidePartidasChartTooltip();
    return;
  }
  const svg = wrap.querySelector("[data-partidas-chart-svg]");
  const tooltip = wrap.querySelector("[data-partidas-chart-tooltip]");
  const crosshair = wrap.querySelector("[data-partidas-chart-crosshair]");
  if (!svg || !tooltip) return;
  let payload;
  try {
    payload = JSON.parse(wrap.dataset.partidasChartPoints || "null");
  } catch {
    return;
  }
  if (!payload || payload.monthCount < 2) return;
  const rect = svg.getBoundingClientRect();
  if (!rect.width) return;
  const relX = event.clientX - rect.left;
  const ratio = Math.min(1, Math.max(0, relX / rect.width));
  const index = Math.round(ratio * (payload.monthCount - 1));
  const x = (index / Math.max(1, payload.monthCount - 1)) * payload.width;
  if (crosshair) {
    crosshair.setAttribute("x1", x.toFixed(1));
    crosshair.setAttribute("x2", x.toFixed(1));
    crosshair.hidden = false;
  }
  const monthLabel = payload.months[index] || "";
  const rows = payload.series
    .map((series) => (series.values[index] !== undefined ? `<div><span>${escapeHtml(series.label)}</span><strong>${money(series.values[index], true)}</strong></div>` : ""))
    .join("");
  tooltip.innerHTML = `<strong class="partidas-chart-tooltip-month">${escapeHtml(monthLabel)}</strong>${rows}`;
  tooltip.hidden = false;
  const pct = Math.min(96, Math.max(4, ratio * 100));
  tooltip.style.left = `${pct}%`;
}

function renderPlanificacionPartidas() {
  const root = qs("planificacionPartidasRoot");
  if (!root) return;
  const months = visualMonths();
  if (!months.length) {
    root.innerHTML = `<div class="empty-state compact">No hay meses visibles para construir el forecast.</div>`;
    return;
  }
  const cushion = partidasCushionBand(months);
  const ghosts = planificacionPartidasEscenarioGhosts();
  const ranked = planificacionPartidasRankedImpact();
  const addMonths = selectableMonths();
  const addDefaultStart = addMonths.find((month) => !isClosedMonthKey(month.key))?.key || addMonths[0]?.key || "";

  const editMonths = selectableMonths();
  const editDefaultStart = editMonths.find((month) => !isClosedMonthKey(month.key))?.key || editMonths[0]?.key || "";

  root.innerHTML = `
    ${partidasSummaryCardHtml()}

    <article class="e19-card visual-save-panel" id="partidasSavePanel">
      <div>
        <p class="panel-kicker">Cambios de planificación</p>
        <h3 id="partidasSaveTitle">Planificación guardada</h3>
        <p id="partidasSaveSummary"></p>
      </div>
      <div class="visual-save-actions">
        <button type="button" class="ghost-button" id="partidasBulkDeleteBtn" data-partidas-bulk-delete>Borrar seleccionadas</button>
        <button type="button" class="ghost-button" id="partidasDiscardChangesBtn" data-partidas-discard>Descartar</button>
        <button type="button" id="partidasSaveChangesBtn" data-partidas-save>Guardar cambios</button>
      </div>
    </article>

    <aside class="e19-impact-bar" id="partidasImpactBar" hidden aria-live="polite"></aside>

    ${partidasSimuladorCardHtml()}

    <article class="e19-card visual-bulk-edit-panel">
      <div class="module-heading">
        <div>
          <p class="panel-kicker">Ajuste rápido</p>
          <h3>Modificar importes o borrar una partida</h3>
          <p>Cambia una línea en un mes, en un rango o en varios meses concretos. También puedes borrarla entera. El cambio queda pendiente hasta guardar.</p>
        </div>
      </div>
      <div class="visual-bulk-edit-grid">
        <label>
          <span>Tipo</span>
          <select id="partidasEditKind" data-partidas-edit-kind>
            <option value="expense">Gasto</option>
            <option value="income">Ingreso</option>
          </select>
        </label>
        <label>
          <span>Partida</span>
          <select id="partidasEditRow">${availableSeriesRows("expense")
            .map((row) => `<option value="${escapeHtml(seriesKeyForRow(row))}">${escapeHtml(row.sectionName)} · ${escapeHtml(displayLabelForRow(row))}</option>`)
            .join("")}</select>
        </label>
        <label>
          <span>Acción</span>
          <select id="partidasEditAction" data-partidas-edit-action>
            <option value="amount">Modificar importe</option>
            <option value="delete">Borrar línea</option>
          </select>
        </label>
        <label id="partidasEditAmountField">
          <span>Importe</span>
          <input id="partidasEditAmount" type="number" step="0.01" placeholder="0,00" />
        </label>
        <label>
          <span>Aplicar en</span>
          <select id="partidasEditScope" data-partidas-edit-scope>
            <option value="visible">Rango visible</option>
            <option value="single">Un mes</option>
            <option value="range">Rango</option>
            <option value="multiple">Meses concretos</option>
          </select>
        </label>
        <label>
          <span>Desde / mes</span>
          <select id="partidasEditStartMonth">${monthOptionsHtml(editDefaultStart, editMonths)}</select>
        </label>
        <label id="partidasEditEndMonthField" class="is-hidden">
          <span>Hasta</span>
          <select id="partidasEditEndMonth">${monthOptionsHtml(editDefaultStart, editMonths)}</select>
        </label>
        <label id="partidasEditMultiMonthField" class="visual-wide-field is-hidden">
          <span>Meses concretos</span>
          <select id="partidasEditMonths" multiple size="4">${monthOptionsHtml("", editMonths)}</select>
        </label>
        <button type="button" data-partidas-edit-stage>Preparar cambio pendiente</button>
      </div>
      <p class="inline-feedback" id="partidasBulkEditFeedback"></p>
    </article>

    <article class="e19-card visual-add-card">
      <div class="module-heading">
        <div>
          <p class="panel-kicker">Añadir partida</p>
          <h3>Nueva línea de previsto</h3>
          <p>Un gasto o ingreso nuevo, recurrente o puntual — aparece de inmediato, sin pasar por "Guardar".</p>
        </div>
      </div>
      <div class="visual-add-grid">
        <label>
          <span>Tipo</span>
          <select id="partidasAddKind" data-partidas-add-kind>
            <option value="expense">Gasto</option>
            <option value="income">Ingreso</option>
          </select>
        </label>
        <label>
          <span>Bloque</span>
          <select id="partidasAddSection">${baseData.monthlyPlanning.sections
            .filter((section) => section.kind === "expense")
            .map((section) => `<option value="${escapeHtml(section.name)}">${escapeHtml(section.name)}</option>`)
            .join("")}</select>
        </label>
        <label>
          <span>Concepto</span>
          <input id="partidasAddLabel" type="text" placeholder="Ej. Trastero, coche, subida nómina" />
        </label>
        <label>
          <span>Importe previsto</span>
          <input id="partidasAddAmount" type="number" step="0.01" placeholder="0,00" />
        </label>
        <label>
          <span>Alcance</span>
          <select id="partidasAddScope" data-partidas-add-scope>
            <option value="single">Solo un mes</option>
            <option value="range">Rango de meses</option>
          </select>
        </label>
        <label>
          <span>Desde</span>
          <select id="partidasAddStartMonth">${monthOptionsHtml(addDefaultStart, addMonths)}</select>
        </label>
        <label>
          <span>Hasta</span>
          <select id="partidasAddEndMonth" disabled>${monthOptionsHtml(addDefaultStart, addMonths)}</select>
        </label>
        <button type="button" data-partidas-add-row>Añadir línea</button>
      </div>
      <p class="inline-feedback" id="partidasAddFeedback"></p>
    </article>

    <div class="table-wrap visual-table-wrap">
      <table class="visual-matrix" id="partidasGestionTable"></table>
    </div>

    <article class="e19-card analisis-cushion-card">
      <h3 class="escenario-motor-panel-title">Colchón del horizonte visible</h3>
      <p class="e19-kpi-note">Meses de gasto que cubre la liquidez, mes a mes.</p>
      <div class="analisis-cushion-band">${cushion.html}</div>
      <p class="e19-kpi-note">${cushion.worst ? `<span class="e19-badge e19-badge-danger">Peor mes · ${escapeHtml(cushion.worst.label)}</span> ${cushion.worst.monthsValue.toLocaleString("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} meses de colchón.` : "Sin datos suficientes para calcular el peor mes."}</p>
      <div class="planificacion-partidas-chart">${partidasImpactChartHtml(ghosts)}</div>
    </article>

    <article class="e19-card">
      <h3 class="escenario-motor-panel-title">Impacto por decisión</h3>
      <p class="e19-kpi-note">Cuánto mueve cada decisión el mínimo del horizonte si se quita (confirmadas) o si se aprobara (provisionales).</p>
      ${planificacionPartidasRankedImpactHtml(ranked)}
    </article>

    ${planificacionPartidasEscenarioGhostsHtml(ghosts)}
  `;
  renderPartidasGestionBlocks();
  syncPartidasEditScopeUi();
  syncPartidasSimModoUi();
  partidasSimuladorSyncFieldVisibility();
}

function selectedSeriesRow() {
  const kind = qs("seriesKind")?.value || "income";
  const key = qs("seriesRow")?.value || "";
  return availableSeriesRows(kind).find((row) => seriesKeyForRow(row) === key) || null;
}

function populateSeriesEditor() {
  const kindSelect = qs("seriesKind");
  const rowSelect = qs("seriesRow");
  const startSelect = qs("seriesStartMonth");
  const endSelect = qs("seriesEndMonth");
  if (!kindSelect || !rowSelect || !startSelect || !endSelect) return;

  const previousRow = rowSelect.value;
  const rows = availableSeriesRows(kindSelect.value);
  const months = selectableMonths();
  const signature = `${kindSelect.value}:${rows.map((row) => `${seriesKeyForRow(row)}:${displayLabelForRow(row)}:${row.sectionName}`).join("|")}::${months.map((month) => month.key).join("|")}`;
  if (seriesEditorSignature !== signature) {
    rowSelect.innerHTML = rows
      .map((row) => `<option value="${escapeHtml(seriesKeyForRow(row))}">${escapeHtml(row.sectionName)} · ${escapeHtml(displayLabelForRow(row))}</option>`)
      .join("");
    [startSelect, endSelect].forEach((select) => {
      const previous = select.value;
      select.innerHTML = months
        .map((month) => `<option value="${month.key}">${escapeHtml(month.label)}</option>`)
        .join("");
      if ([...select.options].some((option) => option.value === previous)) select.value = previous;
      // Un desplegable recién rellenado siempre tiene valor (la primera opción), así que la línea de
      // «hasta el último mes» de más abajo nunca actuaba y el rango por defecto era de un solo mes.
      else if (select === endSelect) select.value = months.at(-1)?.key || "";
    });
    seriesEditorSignature = signature;
  }
  if ([...rowSelect.options].some((option) => option.value === previousRow)) rowSelect.value = previousRow;
  if (!endSelect.value) endSelect.value = selectableMonths().at(-1)?.key || "";
  updateSeriesPreview();
}

function updateSeriesPreview() {
  const preview = qs("seriesPreview");
  if (!preview) return;
  const row = selectedSeriesRow();
  if (!row) {
    preview.textContent = "Selecciona una serie para ver el alcance del cambio.";
    return;
  }
  const months = monthsInRange(qs("seriesStartMonth").value, qs("seriesEndMonth").value);
  const first = months[0];
  const last = months.at(-1);
  const current = first ? actualAwareInfo(row, first) : null;
  preview.innerHTML = `<strong>${escapeHtml(displayLabelForRow(row))}</strong> en ${escapeHtml(row.sectionName)}. Rango: ${escapeHtml(first?.label || "")} - ${escapeHtml(last?.label || "")} (${months.length} meses). Importe actual de inicio: ${current ? money(current.value, true) : "sin dato"}.`;
}

function applySeriesChange() {
  const row = selectedSeriesRow();
  if (!row) {
    showImportLog("No hay serie seleccionada", "Elige un concepto antes de aplicar cambios.", "danger", "seriesEditorLog");
    return;
  }
  const action = qs("seriesAction").value;
  const planned = parseAmount(qs("seriesPlannedAmount").value);
  const actual = parseAmount(qs("seriesActualAmount").value);
  const months = monthsInRange(qs("seriesStartMonth").value, qs("seriesEndMonth").value);
  let changed = 0;

  months.forEach((month) => {
    const key = overrideKeyForRow(row, month);
    if (action === "clear") {
      if (seriesOverrides[key]) {
        delete seriesOverrides[key];
        changed += 1;
      }
      return;
    }
    if (action === "delete") {
      seriesOverrides[key] = { deleted: true };
      changed += 1;
      return;
    }
    const next = { ...(seriesOverrides[key] || {}) };
    delete next.deleted;
    if (planned !== null) next.planned = planned;
    if (actual !== null) next.actual = actual;
    if (planned !== null || actual !== null) {
      seriesOverrides[key] = next;
      changed += 1;
    }
  });

  if (!changed) {
    showImportLog("Sin cambios aplicados", "Introduce un nuevo importe o elige eliminar/quitar ajustes.", "warning", "seriesEditorLog");
    return;
  }
  saveSeriesOverrides();
  refreshAllSectionsAfterDataChange();
  showImportLog(
    `Serie actualizada: ${displayLabelForRow(row)}`,
    `${changed} ${changed === 1 ? "mes modificado" : "meses modificados"}. ${fullRefreshMessage()}`,
    "",
    "seriesEditorLog",
  );
}
