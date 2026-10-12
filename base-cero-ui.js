// WP-34 (PRV-08, docs/WP34_DISENO.md): la revisión base cero en Plan › Partidas. El motor (canonical-zero-base.js, puro) ordena las partidas por lo que pesan y propone; aquí se leen las cifras que ya
// existen (partidas, previsto, reales por mes), se guarda la marca «revisada (fecha)» en un almacén propio (`zero-base-data`, en la copia) y se pinta UNA partida por pantalla.
//
// NO escribe en el plan por su cuenta: «Ajustar» y «Quitar» PREPARAN el cambio en el borrador que ya usa Plan › Partidas (visualDraftCells / visualDraftDeletes) y es el «Guardar» de siempre el que lo aplica
// (con su «Descartar»). «Mantener» solo anota la marca. Sin red.
//
// Script de pantalla: se carga antes de app.js y comparte su ámbito global (qs, escapeHtml, money, storageGet, storageSet, storageKey, queueRemoteSave, announceStatus, isoLocalDate, cuadroMandosAllMonths,
// planningSectionsForMonth, actualAwareInfo, plannedValueForRow, displayLabelForRow, seriesKeyForRow, isVariableOperationalRow, adjustedDebtPlannedValue, loadCardCycles, openMonthCutoffKey, isClosedMonthKey,
// cuadroMandosStageCell, visualDraftCells, visualDraftDeletes, visualPendingCounts, handlePartidasSave, handlePartidasDiscard, renderPartidasGestionBlocks, ledgerMonthLabel, formatIsoDate…).
// Sin llamadas al DOM ni escuchas al cargarse: app.js llama a `renderBaseCero` al pintar Plan › Partidas, y esa función engancha su escucha una sola vez.

const BASE_CERO_STORE = "zero-base-data"; // en la copia (BACKUP_LOCAL_STORES): { reviews: { [clave de partida]: { decision, reviewedAt, from, to } } }
const BASE_CERO_FUTURE_MONTHS = 36;
let baseCeroState = { key: "", skipped: new Set(), notice: "", attached: false, cache: { revision: -1, stamp: "", model: null } };

function baseCeroEngine() {
  return globalThis.FinanceCanonicalZeroBase;
}

function baseCeroLoad() {
  let raw = {};
  try { raw = JSON.parse(storageGet(storageKey(BASE_CERO_STORE), "{}")); } catch { raw = {}; }
  return baseCeroEngine().normalizeStore(raw);
}

function baseCeroSave(store) {
  storageSet(storageKey(BASE_CERO_STORE), JSON.stringify(store));
  baseCeroState.cache.revision = -1;
  queueRemoteSave();
}

// Quién manda el importe de una partida, si no es el hogar. Esas solo se pueden marcar como revisadas.
function baseCeroLockReason(row, month, cardRowKeys) {
  if (isVariableOperationalRow(row)) return "se calcula con la fórmula del gasto variable";
  if (row.personalAllowance) return "es la asignación personal (se gestiona en su tarjeta de Plan › Partidas)";
  if (row.source === "escenario") return "viene de un escenario guardado";
  if (cardRowKeys.has(seriesKeyForRow(row))) return "se liquida con una tarjeta: lo manda su cargo";
  if (typeof adjustedDebtPlannedValue === "function" && adjustedDebtPlannedValue(row, month) !== null) return "sigue el calendario de su contrato de deuda";
  return "";
}

// Todas las partidas del plan con lo previsto en los meses por venir y lo REAL de los últimos 12 meses ya pasados. Una partida que ya no existe en ningún mes por venir no entra.
function baseCeroCollect() {
  const open = openMonthCutoffKey();
  const months = cuadroMandosAllMonths();
  const windowMonths = months.filter((month) => month.key < open).slice(-baseCeroEngine().WINDOW_MONTHS);
  const futureMonths = months.filter((month) => month.key >= open && !isClosedMonthKey(month.key)).slice(0, BASE_CERO_FUTURE_MONTHS);
  const cardRowKeys = new Set(((typeof loadCardCycles === "function" && loadCardCycles().cards) || []).map((card) => card.rowKey));
  const byKey = new Map();
  const touch = (row, section, kind, month) => {
    const key = seriesKeyForRow(row);
    if (!byKey.has(key)) byKey.set(key, { key, kind, label: displayLabelForRow(row), section: section.name, locked: baseCeroLockReason(row, month, cardRowKeys), planned: {}, real: {}, futureMonths: [] });
    return byKey.get(key);
  };
  ["income", "expense"].forEach((kind) => {
    windowMonths.forEach((month) => {
      planningSectionsForMonth(kind, month).forEach((section) => section.rows.forEach((row) => {
        const info = actualAwareInfo(row, month);
        if (info.hasActual && info.status !== "cancelled") touch(row, section, kind, month).real[month.key] = Number(info.actual);
      }));
    });
    futureMonths.forEach((month) => {
      planningSectionsForMonth(kind, month).forEach((section) => section.rows.forEach((row) => {
        const partida = touch(row, section, kind, month);
        partida.planned[month.key] = Number(plannedValueForRow(row, month)) || 0;
        partida.futureMonths.push(month.key);
        if (!partida.locked) partida.locked = baseCeroLockReason(row, month, cardRowKeys);
      }));
    });
  });
  return { partidas: [...byKey.values()].filter((partida) => partida.futureMonths.length), windowMonths: windowMonths.map((month) => month.key), futureMonths: futureMonths.map((month) => month.key) };
}

function baseCeroModel() {
  const engine = baseCeroEngine();
  const today = isoLocalDate(new Date());
  const store = baseCeroLoad();
  const stamp = `${today}|${JSON.stringify(store.reviews)}`;
  if (baseCeroState.cache.revision === applicationRenderRevision && baseCeroState.cache.stamp === stamp) return baseCeroState.cache.model;
  const model = engine.buildModel({ ...baseCeroCollect(), store, today });
  baseCeroState.cache = { revision: applicationRenderRevision, stamp, model };
  return model;
}

function baseCeroDraftOf(key) {
  return { adjust: Object.values(visualDraftCells || {}).filter((draft) => draft.rowKey === key).length, remove: Boolean((visualDraftDeletes || {})[key]) };
}

function baseCeroMonthTable(item, windowMonths) {
  const rows = windowMonths.map((monthKey) => {
    const entry = item.evidence.months.find((month) => month.monthKey === monthKey);
    return `<tr><th scope="row">${escapeHtml(ledgerMonthLabel(monthKey))}</th><td>${entry ? money(entry.value, true) : "—"}</td></tr>`;
  }).join("");
  return `<table class="bc-tabla"><caption>Reales de los últimos ${windowMonths.length} meses</caption><thead><tr><th scope="col">Mes</th><th scope="col">Real</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function baseCeroCurrent(model) {
  const open = model.items.filter((item) => item.state !== "revisada");
  const wanted = open.find((item) => item.key === baseCeroState.key && !baseCeroState.skipped.has(item.key));
  return wanted || open.find((item) => !baseCeroState.skipped.has(item.key)) || null;
}

function baseCeroCurrentHtml(model, item) {
  const engine = baseCeroEngine();
  const kind = item.kind === "income" ? "Ingreso" : "Gasto";
  const notes = [];
  if (item.state === "toca") notes.push(`<p class="bc-nota">Se revisó el ${escapeHtml(formatIsoDate(item.review.reviewedAt))}: ya pasó un año.</p>`);
  if (item.flag) notes.push(`<p class="bc-nota bc-aviso"><strong>¿Sigue existiendo?</strong> ${escapeHtml(item.flag.text)}</p>`);
  notes.push(`<p class="bc-nota">${escapeHtml(item.suggestion.type ? `Propuesta: ${money(item.suggestion.amount, true)} al mes (la mediana de lo real, redondeada al euro), ${item.suggestion.gap > 0 ? "más" : "menos"} que lo previsto hoy${item.suggestion.gapPct !== null ? ` (${item.suggestion.gapPct} %)` : ""}.` : item.suggestion.why)}</p>`);
  const adjust = item.suggestion.type ? `<button type="button" class="e19-btn e19-btn-primary" data-bc="ajustar" data-bc-key="${escapeHtml(item.key)}">Ajustar a ${escapeHtml(money(item.suggestion.amount, true))} al mes</button>` : "";
  const remove = item.locked ? "" : `<button type="button" class="e19-btn e19-btn-secondary" data-bc="quitar" data-bc-key="${escapeHtml(item.key)}">Quitar la partida</button>`;
  return `<article class="bc-card" aria-labelledby="bcTitulo">
    <h3 id="bcTitulo" tabindex="-1">${escapeHtml(item.label)}</h3>
    <p class="e19-kpi-note">${escapeHtml(kind)} · ${escapeHtml(item.section)} · previsto hoy ${escapeHtml(money(item.plannedNow, true))} al mes${item.plannedFlat ? "" : " (cambia de un mes a otro)"}</p>
    <p class="bc-evidencia">${escapeHtml(engine.evidenceText(item))}</p>
    ${notes.join("")}
    ${baseCeroMonthTable(item, model.windowMonths)}
    <div class="bc-acciones">
      <button type="button" class="e19-btn ${item.suggestion.type ? "e19-btn-secondary" : "e19-btn-primary"}" data-bc="mantener" data-bc-key="${escapeHtml(item.key)}">Mantener como está</button>
      ${adjust}${remove}
      <button type="button" class="e19-btn e19-btn-secondary" data-bc="saltar" data-bc-key="${escapeHtml(item.key)}">Saltar por ahora</button>
    </div>
  </article>`;
}

function baseCeroDoneLabel(item) {
  const draft = baseCeroDraftOf(item.key);
  const review = item.review;
  if (review.decision === "mantener") return "mantenida";
  if (review.decision === "ajustar") {
    if (review.to !== null && Math.round(item.plannedNow) === Math.round(review.to)) return `ajustada a ${money(review.to, true)} al mes`;
    return draft.adjust ? "ajuste preparado, sin guardar" : "ajuste decidido, sin aplicar";
  }
  return draft.remove ? "borrado preparado, sin guardar" : "decidida quitar, sigue en el plan";
}

function baseCeroDoneHtml(model) {
  const done = model.items.filter((item) => item.state === "revisada");
  if (!done.length) return "";
  const rows = done.map((item) => `<li><span><strong>${escapeHtml(item.label)}</strong> · ${escapeHtml(baseCeroDoneLabel(item))} · ${escapeHtml(formatIsoDate(item.review.reviewedAt))}</span> <button type="button" class="e19-btn e19-btn-secondary" data-bc="reabrir" data-bc-key="${escapeHtml(item.key)}" aria-label="Revisar de nuevo ${escapeHtml(item.label)}">Revisar de nuevo</button></li>`).join("");
  return `<details class="bc-hechas"><summary>Ya revisadas (${done.length})</summary><ul>${rows}</ul></details>`;
}

function baseCeroPendingBanner() {
  const counts = typeof visualPendingCounts === "function" ? visualPendingCounts() : { cells: 0, deletes: 0, labels: 0 };
  const total = counts.cells + counts.deletes + counts.labels;
  if (!total) return "";
  return `<div class="bc-pendiente" role="group" aria-label="Cambios preparados"><p><strong>${total} cambio(s) preparado(s) en el plan</strong> (importes: ${counts.cells}, borrados: ${counts.deletes}). No cuentan hasta que se guardan; los ves en la tabla de más abajo.</p><div class="bc-acciones"><button type="button" class="e19-btn e19-btn-primary" data-bc="guardar">Guardar los cambios</button><button type="button" class="e19-btn e19-btn-secondary" data-bc="descartar">Descartar</button></div></div>`;
}

function baseCeroBodyHtml(model) {
  if (!model.calculable) return `<p class="e19-kpi-note">No se pudo preparar la revisión: ${escapeHtml(model.reason)}</p>`;
  const { total, reviewed, pending } = model.progress;
  const intro = `<p class="e19-kpi-note">Una vez al año, mirad <strong>cada partida con lo que de verdad pasó</strong> y decidid: <strong>mantener</strong>, <strong>ajustar a lo real</strong> o <strong>quitar</strong>. Se empieza por las que más pesan y lo hecho se guarda al momento: podéis dejarlo y seguir otro día. <strong>Ajustar</strong> y <strong>quitar</strong> solo <strong>preparan</strong> el cambio: no cuenta hasta que lo guardáis.</p>`;
  const coverage = model.coveredMonths < 3 ? `<p class="bc-nota bc-aviso">Solo hay reales anotados en <strong>${model.coveredMonths}</strong> de los últimos ${model.windowMonths.length} meses: casi ninguna partida tendrá una propuesta de ajuste. Anotar los reales de cada mes (Registrar › Reales del mes) es lo que hace útil esta revisión.</p>` : "";
  const dormant = model.dormant ? `<p class="bc-nota">${model.dormant} partida(s) sin importe previsto y sin ningún real no entran en la revisión: no hay nada que decidir sobre ellas.</p>` : "";
  const progress = `<p class="bc-progreso"><progress max="${total}" value="${reviewed}" aria-label="Partidas revisadas">${reviewed} de ${total}</progress> <span>${reviewed} de ${total} revisadas${pending ? `, ${pending} por revisar` : ""}</span></p>`;
  const current = baseCeroCurrent(model);
  let main;
  if (!total) main = '<p class="e19-kpi-note">No hay partidas en el plan.</p>';
  else if (current) main = baseCeroCurrentHtml(model, current);
  else if (pending) main = `<p class="e19-kpi-note">Has saltado las ${pending} que quedan. <button type="button" class="e19-btn e19-btn-secondary" data-bc="volver">Volver a empezar por ellas</button></p>`;
  else main = `<p class="e19-kpi-note"><strong>Revisión completa.</strong> Las ${total} partidas tienen su marca de este año; toca otra vez dentro de un año.</p>`;
  return `${intro}${coverage}${dormant}${progress}${baseCeroPendingBanner()}${baseCeroState.notice ? `<p class="bc-aviso-estado" role="status">${escapeHtml(baseCeroState.notice)}</p>` : ""}${main}${baseCeroDoneHtml(model)}`;
}

// Pinta la tarjeta. Barata cuando está cerrada: el resumen sale del mismo modelo, que se guarda por revisión de render.
function renderBaseCero(engine) {
  const card = qs("baseCeroCard");
  const body = qs("baseCero");
  if (!card || !body || !engine) return;
  attachBaseCero(card, body);
  try {
    const model = baseCeroModel();
    qs("baseCeroResumen").textContent = engine.summaryText(model);
    const html = card.open ? baseCeroBodyHtml(model) : "";
    if (body.__bcHtml !== html) { body.innerHTML = html; body.__bcHtml = html; }
  } catch (error) {
    console.error(`renderBaseCero: ${error.message}`);
    body.innerHTML = '<p class="e19-kpi-note">No se pudo preparar la revisión con los datos actuales.</p>';
    body.__bcHtml = null;
  }
}

function baseCeroStageAdjust(item) {
  const months = cuadroMandosAllMonths().filter((month) => month.key >= openMonthCutoffKey() && !isClosedMonthKey(month.key) && item.futureMonths.includes(month.key));
  months.forEach((month) => cuadroMandosStageCell(item.key, month.key, item.suggestion.amount));
  return months.length;
}

function baseCeroDecide(item, decision, extra = {}) {
  baseCeroSave(baseCeroEngine().decide(baseCeroLoad(), item.key, decision, { today: isoLocalDate(new Date()), ...extra }));
}

function baseCeroNext(key) {
  baseCeroState.skipped.add(key);
  baseCeroState.key = "";
}

// Los clics de la tarjeta, por delegación. Cada decisión se guarda al momento (guardado parcial).
function handleBaseCeroClick(event) {
  const button = event.target.closest("[data-bc]");
  if (!button) return;
  const action = button.dataset.bc;
  const model = baseCeroModel();
  const key = button.dataset.bcKey || "";
  const item = model.calculable ? model.items.find((entry) => entry.key === key) : null;
  baseCeroState.notice = "";
  if (action === "guardar") { handlePartidasSave(); baseCeroState.notice = "Cambios guardados en el plan."; }
  else if (action === "descartar") { handlePartidasDiscard(); baseCeroState.notice = "Cambios descartados: el plan sigue como estaba."; }
  else if (action === "volver") baseCeroState.skipped.clear();
  else if (action === "saltar" && item) baseCeroNext(item.key);
  else if (action === "mantener" && item) { baseCeroDecide(item, "mantener"); baseCeroState.key = ""; baseCeroState.notice = `«${item.label}» queda como está y se anota como revisada.`; }
  else if (action === "ajustar" && item && item.suggestion.type) {
    const staged = baseCeroStageAdjust({ ...item, futureMonths: baseCeroCollect().partidas.find((partida) => partida.key === item.key)?.futureMonths || [] });
    baseCeroDecide(item, "ajustar", { from: item.plannedNow, to: item.suggestion.amount });
    baseCeroState.notice = `«${item.label}»: preparado ${money(item.suggestion.amount, true)} al mes en ${staged} mes(es). Guárdalo para que cuente.`;
    if (typeof renderPartidasGestionBlocks === "function") renderPartidasGestionBlocks();
  } else if (action === "quitar" && item && !item.locked) {
    handlePartidasDeleteRow(item.key);
    baseCeroDecide(item, "quitar");
    baseCeroState.notice = `«${item.label}»: borrado preparado. Guárdalo para que cuente.`;
  } else if (action === "reabrir" && item) { baseCeroSave(baseCeroEngine().clear(baseCeroLoad(), item.key)); baseCeroState.key = item.key; baseCeroState.skipped.delete(item.key); }
  if (baseCeroState.notice) announceStatus(baseCeroState.notice);
  baseCeroState.cache.revision = -1;
  const card = qs("baseCeroCard");
  renderBaseCero(baseCeroEngine());
  if (card && action !== "guardar" && action !== "descartar") qs("baseCero")?.querySelector("#bcTitulo")?.focus?.();
}

function attachBaseCero(card, body) {
  if (baseCeroState.attached) return;
  baseCeroState.attached = true;
  body.addEventListener("click", handleBaseCeroClick);
  card.addEventListener("toggle", () => renderBaseCero(baseCeroEngine()));
}
