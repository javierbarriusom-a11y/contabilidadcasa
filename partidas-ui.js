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
