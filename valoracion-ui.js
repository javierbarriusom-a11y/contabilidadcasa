// WP-15 (docs/WP15_DISENO.md): la hoja de valoración de la cartera. «Actualizar valoración» (Inversión › Cartera) abre un diálogo con una
// fila por posición, de la más antigua a la más reciente: valor anterior, valor nuevo (vacío = no cambia, 0 = vale cero), «Sin cambios»
// y la variación de MERCADO (descuenta aportaciones y ventas). Al guardar actualiza el valor y la fecha de cada posición, añade un punto
// a la serie de valoraciones con fecha y da 8 segundos para deshacer. La lógica está en canonical-portfolio-valuation.js.
//
// Script de pantalla, como partidas-ui.js: se carga antes de app.js y comparte su ámbito global (qs, money, storageSet…). Nada de lo
// que sigue se ejecuta hasta que el hogar toca un control.

let valuationSheet = null; // { openedAt, dateMode, modes: Map(id → "same") } mientras la hoja está abierta

const VALUATION_REFRESH_CHAIN = [
  "renderIv1PositionList", "renderIv1PositionChart", "renderIv1TransferOptions", "renderIv1ContributionOptions", "renderIv1DisposalOptions",
  "renderIv1ScheduledContributionOptions", "renderIv1PositionSummary", "renderIv1PositionConcentration", "renderInv16ConcentrationWarnings",
  "renderInv14CurrencyGeographyExposure", "renderInv19FeeCostTrajectory", "renderInv6LatentLossCandidates", "renderInv7LiquidityLadder",
  "renderInv8DcaTracking", "renderInv13DcaTaxProjection", "renderIv6Rebalance", "renderLev6DeleveragingPriority", "renderLev5DynamicStress",
  "renderLev12ProactiveMarginCallAlert", "renderLev11PreventiveDeleveragingAlert", "renderIvx6GlidePath",
];

function loadPortfolioValuations() {
  return cachedLocalStore("portfolio-valuations", (raw) => globalThis.FinanceCanonicalPortfolioValuation.normalizeStore(raw), { valuations: [], timings: [] });
}

function savePortfolioValuations(store) {
  storageSet(storageKey("portfolio-valuations"), JSON.stringify(store));
}

// Lo mismo que repintan, a mano, todos los manejadores de la cartera tras cambiar una posición.
function refreshInvestmentViews() {
  VALUATION_REFRESH_CHAIN.forEach((name) => {
    try { globalThis[name]?.(); } catch (error) { console.error(`${name}: ${error.message}`); }
  });
}

function valuationPositions() {
  const rows = iv1PositionsList();
  return rows.length && globalThis.FinanceCanonicalPortfolio ? globalThis.FinanceCanonicalPortfolio.normalizePositions(rows).positions : [];
}

function valuationRawPosition(id) {
  return iv1PositionsList().find((position) => position.id === id) || null;
}

function valuationSelectedDate(today) {
  if (valuationSheet.dateMode === "ayer") {
    const [year, month, day] = today.split("-").map(Number);
    return new Date(Date.UTC(year, month - 1, day - 1)).toISOString().slice(0, 10);
  }
  if (valuationSheet.dateMode === "otra") return qs("valoracionFecha").value || "";
  return today;
}

function valuationChip(label, attribute, value, pressed) {
  return `<button type="button" class="e19-btn ${pressed ? "e19-btn-primary" : "e19-btn-secondary"}" ${attribute}="${escapeHtml(value)}" aria-pressed="${pressed ? "true" : "false"}">${escapeHtml(label)}</button>`;
}

function valuationDateChips() {
  qs("valoracionFechas").innerHTML = [["hoy", "Hoy"], ["ayer", "Ayer"], ["otra", "Otra fecha"]].map(([value, label]) => valuationChip(label, "data-valoracion-fecha", value, value === valuationSheet.dateMode)).join("");
  const input = qs("valoracionFecha");
  input.hidden = valuationSheet.dateMode !== "otra";
  input.max = isoLocalDate(new Date());
}

const valuationNumber = (value) => (value === "" || value === null || value === undefined ? null : parseAmountField(value));

function valuationRowHtml(position, today) {
  const engine = globalThis.FinanceCanonicalPortfolioValuation;
  const age = engine.freshness(position, today);
  const typeLabel = typeof IV1_POSITION_TYPE_LABELS === "object" ? IV1_POSITION_TYPE_LABELS[position.type] || "Otro" : "";
  const id = escapeHtml(position.id);
  return `<fieldset class="valoracion-fila" data-valoracion-fila="${id}">`
    + `<legend>${escapeHtml(position.label)}${typeLabel ? ` · ${escapeHtml(typeLabel)}` : ""}</legend>`
    + `<p class="e19-kpi-note">Valor anterior ${money(position.currentValue, true)} · ${escapeHtml(age.label)}</p>`
    + `<label><span>Valor nuevo (€)</span><input type="text" inputmode="decimal" autocomplete="off" data-amount-input data-valoracion-valor="${id}" placeholder="sin cambio" aria-label="Valor nuevo de ${escapeHtml(position.label)}" /></label>`
    + `<div class="data-actions"><button type="button" class="e19-btn e19-btn-secondary" data-valoracion-igual="${id}" aria-pressed="false">Sin cambios</button></div>`
    + `<p class="e19-kpi-note" data-valoracion-chip="${id}"></p>`
    + `<label class="valoracion-confirmar" data-valoracion-confirmar="${id}" hidden><input type="checkbox" data-valoracion-confirmado="${id}" /> <span>Es correcto, guardar este valor</span></label>`
    + `</fieldset>`;
}

function updateValuationRow(id) {
  const engine = globalThis.FinanceCanonicalPortfolioValuation;
  const position = valuationRawPosition(id);
  const root = document.querySelector(`[data-valoracion-fila="${CSS.escape(id)}"]`);
  if (!position || !root) return;
  const today = isoLocalDate(new Date());
  const date = valuationSelectedDate(today);
  const input = root.querySelector("[data-valoracion-valor]");
  const same = valuationSheet.modes.get(id) === "same";
  const button = root.querySelector("[data-valoracion-igual]");
  const past = Boolean(position.asOf) && Boolean(date) && date < position.asOf;
  button.setAttribute("aria-pressed", same ? "true" : "false");
  button.className = `e19-btn ${same ? "e19-btn-primary" : "e19-btn-secondary"}`;
  button.disabled = past;
  button.title = past ? "«Sin cambios» no vale con una fecha anterior a la última valoración." : "";
  const chip = root.querySelector("[data-valoracion-chip]");
  const confirmBox = root.querySelector("[data-valoracion-confirmar]");
  const value = valuationNumber(input.value);
  let note = same ? `Se conserva el valor y se renueva la fecha (${engine.formatDate(date)}).` : "";
  let warnings = [];
  if (!same && input.value.trim() !== "") {
    if (value === null || value < 0) note = "Escribe un importe válido (por ejemplo, 1.234,56).";
    else {
      const variation = engine.marketVariation({ position, newValue: value, date });
      const limit = position.type === "cripto" ? engine.BIG_MOVE_PCT_CRYPTO : engine.BIG_MOVE_PCT;
      warnings = engine.checkRow({ position, newValue: value, date });
      if (past) note = "Fecha anterior a la última valoración: solo añade un punto histórico y no cambia el valor actual.";
      else if (variation.calculable) {
        const sign = variation.amount > 0 ? "+" : "";
        note = `Variación de mercado: ${sign}${money(variation.amount, true)} (${sign}${String(variation.pct).replace(".", ",")} %)${variation.flows ? `, descontadas aportaciones netas de ${money(variation.flows, true)}` : ""}.`;
      } else note = variation.reason === "primera-valoracion" ? "Primera valoración con fecha: no hay variación que calcular." : "Sin un valor anterior fiable: no hay variación que calcular.";
      if (warnings.length) note += ` ${warnings.map((code) => engine.warningText(code, { pct: variation.pct, limit })).join(" ")}`;
    }
  }
  chip.textContent = note;
  confirmBox.hidden = !warnings.length;
  if (!warnings.length) confirmBox.querySelector("input").checked = false;
}

function updateAllValuationRows() {
  valuationPositions().forEach((position) => updateValuationRow(position.id));
}

function openValoracionHoja() {
  const dialog = qs("valoracionDialog");
  const engine = globalThis.FinanceCanonicalPortfolioValuation;
  const positions = valuationPositions();
  if (!dialog || !engine || !positions.length || dialog.open) return false;
  const today = isoLocalDate(new Date());
  valuationSheet = { openedAt: Date.now(), dateMode: "hoy", modes: new Map() };
  qs("valoracionFecha").value = "";
  qs("valoracionError").textContent = "";
  valuationDateChips();
  qs("valoracionFilas").innerHTML = engine.orderRows(positions, today).map((position) => valuationRowHtml(position, today)).join("");
  dialog.showModal();
  qs("valoracionFilas").querySelector("[data-valoracion-valor]")?.focus();
  return true;
}

function readValuationRows() {
  return valuationPositions().map((position) => {
    const input = document.querySelector(`[data-valoracion-valor="${CSS.escape(position.id)}"]`);
    const same = valuationSheet.modes.get(position.id) === "same";
    const typed = input && input.value.trim() !== "";
    const confirmed = Boolean(document.querySelector(`[data-valoracion-confirmado="${CSS.escape(position.id)}"]`)?.checked);
    if (same) return { id: position.id, mode: "same" };
    if (typed) return { id: position.id, mode: "value", value: valuationNumber(input.value), confirmed };
    return { id: position.id, mode: "skip" };
  });
}

function saveValoracionHoja() {
  const engine = globalThis.FinanceCanonicalPortfolioValuation;
  const today = isoLocalDate(new Date());
  const date = valuationSelectedDate(today);
  const result = engine.buildSave({ positions: iv1PositionsList(), rows: readValuationRows(), date, today, now: new Date().toISOString(), portfolio: globalThis.FinanceCanonicalPortfolio });
  if (!result.ok) {
    qs("valoracionError").textContent = result.errors.map((error) => error.message).join(" ");
    const first = result.errors.find((error) => error.ids)?.ids?.[0] || result.errors.find((error) => error.id)?.id;
    if (first) document.querySelector(`[data-valoracion-valor="${CSS.escape(first)}"]`)?.focus();
    return false;
  }
  const plan = result.plan;
  const beforeStore = loadPortfolioValuations();
  const seconds = Math.round(((Date.now() - valuationSheet.openedAt) / 1000) * 10) / 10;
  saveIv1PositionsList(plan.nextPositions);
  savePortfolioValuations(engine.recordTiming(engine.addValuation(beforeStore, { date, points: plan.points, savedAt: plan.savedAt, today }), seconds, plan.savedAt));
  refreshInvestmentViews();
  render();
  const { updated, same, historic } = plan.counts;
  const parts = [updated ? `${updated} valorada${updated === 1 ? "" : "s"}` : "", same ? `${same} sin cambios` : "", historic ? `${historic} solo como punto histórico` : ""].filter(Boolean);
  announceStatus(`Valoración guardada: ${parts.join(", ")}.`);
  showUndoToast(`Valoración del ${engine.formatDate(date)} guardada: ${parts.join(", ")}.`, () => {
    saveIv1PositionsList(engine.undoPositions(iv1PositionsList(), plan.undo));
    savePortfolioValuations(beforeStore);
    refreshInvestmentViews();
    render();
    announceStatus("Valoración deshecha.");
  }, 8000);
  return true;
}

function handleValoracionClick(event) {
  if (!valuationSheet) return;
  const button = event.target.closest("button");
  if (!button) return;
  if (button.dataset.valoracionFecha !== undefined) {
    valuationSheet.dateMode = button.dataset.valoracionFecha;
    valuationDateChips();
    updateAllValuationRows();
  } else if (button.dataset.valoracionIgual !== undefined) {
    const id = button.dataset.valoracionIgual;
    const input = document.querySelector(`[data-valoracion-valor="${CSS.escape(id)}"]`);
    if (valuationSheet.modes.get(id) === "same") valuationSheet.modes.delete(id);
    else { valuationSheet.modes.set(id, "same"); if (input) input.value = ""; }
    updateValuationRow(id);
  } else if (button.id === "valoracionCancelar") {
    qs("valoracionDialog").close("cancel");
    return;
  } else return;
  event.preventDefault();
  qs("valoracionError").textContent = "";
}

function handleValoracionInput(event) {
  if (valuationSheet && event.target?.id === "valoracionFecha") return updateAllValuationRows();
  const id = event.target?.dataset?.valoracionValor;
  if (id === undefined || !valuationSheet) return;
  if (event.target.value.trim() !== "") valuationSheet.modes.delete(id);
  updateValuationRow(id);
}

// «Hecho» del teclado envía el formulario: Guardar es su único botón de envío (Cancelar no lo es).
function handleValoracionSubmit(event) {
  event.preventDefault();
  if (valuationSheet && saveValoracionHoja()) qs("valoracionDialog").close("confirm");
}

// Resumen de frescura de la tarjeta «Valoración de la cartera»: M-VAL1 (≤ 35 días) y los tiempos de la hoja (M-VAL2).
function renderValuationSummary() {
  const engine = globalThis.FinanceCanonicalPortfolioValuation;
  const target = qs("valoracionResumen");
  const open = qs("valoracionAbrir");
  if (!engine || !target) return;
  const positions = valuationPositions();
  const summary = engine.freshnessSummary(positions, isoLocalDate(new Date()));
  if (open) open.disabled = !summary;
  if (!summary) {
    target.textContent = "Todavía no hay posiciones: añade la primera más abajo y podrás valorarla aquí.";
    return;
  }
  const timing = engine.timingSummary(loadPortfolioValuations());
  const stale = positions.filter((position) => engine.freshness(position, isoLocalDate(new Date())).stale).slice(0, 3).map((position) => position.label).join(", ");
  const lines = [`Valoradas hace ${engine.STALE_DAYS} días o menos: ${summary.fresh} de ${summary.total} (${summary.percentFresh} %).${summary.stale ? ` Pendientes: ${stale}${summary.stale > 3 ? ` y ${summary.stale - 3} más` : ""}.` : ""}`];
  if (timing.count) lines.push(`Tiempo de la hoja: mediana ${String(timing.median).replace(".", ",")} s en ${timing.count} ${timing.count === 1 ? "valoración" : "valoraciones"}.`);
  target.textContent = lines.join(" ");
}

// Este script se ejecuta antes que app.js: `qs` todavía no existe, de ahí `document.getElementById`.
const valuationListen = (id, type, handler) => document.getElementById(id)?.addEventListener(type, handler);
valuationListen("valoracionAbrir", "click", () => openValoracionHoja());
valuationListen("valoracionDialog", "click", handleValoracionClick);
valuationListen("valoracionDialog", "input", handleValoracionInput);
valuationListen("valoracionForm", "submit", handleValoracionSubmit);
valuationListen("valoracionDialog", "close", () => { valuationSheet = null; });
