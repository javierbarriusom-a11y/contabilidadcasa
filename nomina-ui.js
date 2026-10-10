// WP-47 (NPV-05, docs/WP47_DISENO.md): la tarjeta «Repartir la nómina» de Deuda › Comparar, bajo la escalera del próximo euro. El cálculo vive en canonical-payroll-split.js (puro);
// aquí se leen las nóminas confirmadas del mes, la holgura sobre el suelo en la banda de caja (WP-16) y la escalera (WP-42), se pintan las filas con sus «steppers» y se guarda
// el borrador con la lista de transferencias en `payroll-split-drafts`. NO mueve dinero ni anota ningún movimiento en las cuentas (A11-4): la lista la ejecuta el hogar, a mano.
// Tampoco va a Hoy (congelado hasta H-02): el aviso «reparte esta nómina» no sale de la pregunta «¿ha llegado…?».
//
// Script de pantalla: se carga después de escalera-ui.js y comparte su ámbito global (qs, money, escapeHtml, estadoHtml, announceStatus, showUndoToast, parseAmount, storageGet,
// storageSet, storageKey, queueRemoteSave, isoLocalDate, state, monthByKey, planningSectionsForMonth, actualAwareInfo, displayLabelForRow, seriesKeyForRow, timingEngine,
// expectedPreviousMonthKey, cashBandInput, proxEuroSources, proxEuroLoad, proxEuroDebts). Sin llamadas al DOM ni escuchas al cargarse: app.js llama a `renderNominaReparto`.

const NOMINA_STORE = "payroll-split-drafts"; // en la copia (BACKUP_LOCAL_STORES)
let nominaWorking = { key: "", rows: [] }; // las filas que se están editando; se rehacen cuando cambian las nóminas, el disponible o la escalera
let nominaSelection = {}; // id de nómina → incluida (por defecto, todas las confirmadas y sin repartir)
let nominaNote = ""; // último aviso de un stepper que no pudo moverse (se limpia con la siguiente acción)
let nominaBandCache = { key: "", value: null };

function nominaEngine() {
  return globalThis.FinanceCanonicalPayrollSplit;
}

function nominaStoreLoad() {
  let raw = {};
  try { raw = JSON.parse(storageGet(storageKey(NOMINA_STORE), "{}")) || {}; } catch { raw = {}; }
  return nominaEngine().normalizeStore(raw);
}

function nominaStoreSave(store) {
  storageSet(storageKey(NOMINA_STORE), JSON.stringify(store));
  queueRemoteSave();
}

function nominaEuros(value) {
  return money(value, true);
}

function nominaDate(iso) {
  return String(iso || "").slice(0, 10).split("-").reverse().join("/");
}

// Las nóminas con real registrado: las del mes en curso y, hasta el día 10, las del anterior (una nómina del 30 se confirma ya en el mes siguiente). Solo se reconoce como
// nómina una partida de ingreso cuyo nombre dice «nómina», «salario» o «sueldo»: el resto de ingresos (el alquiler del local…) no se reparte aquí.
function nominaConfirmed(today, isPayroll = nominaEngine().isPayrollLabel) {
  const currentKey = today.slice(0, 7);
  const keys = Number(today.slice(8, 10)) <= 10 ? [expectedPreviousMonthKey(currentKey, 1), currentKey] : [currentKey];
  const found = [];
  keys.forEach((key) => {
    const month = monthByKey(key);
    if (!month) return;
    planningSectionsForMonth("income", month).forEach((section) => {
      section.rows.forEach((row) => {
        const label = displayLabelForRow(row);
        if (!isPayroll(label)) return;
        const info = actualAwareInfo(row, month);
        if (!info.hasActual || info.status === "cancelled" || !(Number(info.actual) > 0)) return;
        let date = null;
        try { date = timingEngine().incomeTimingForRow(row, month, Number(info.planned) > 0 ? Number(info.planned) : Number(info.actual), { ignoreDeferral: true }).date; } catch { date = null; }
        found.push({ id: `${seriesKeyForRow(row)}|${key}`, label, month: key, amount: Number(info.actual), date });
      });
    });
  });
  return found;
}

// Cuánto cabe sacar sin que la liquidez baje del suelo en el peor punto (P10) de la banda de caja de 30 días. null si no se puede calcular, con el motivo.
function nominaHeadroom(today) {
  const cash = globalThis.FinanceCanonicalCashBand;
  if (!cash || typeof cashBandInput !== "function") return { headroom: null, reason: "la banda de caja no está disponible" };
  let input = null;
  try { input = cashBandInput(today); } catch { input = null; }
  if (!input || !input.events.length) return { headroom: null, reason: "no hay movimientos fechados en el plan" };
  if (input.floor === null) return { headroom: null, reason: "no hay un suelo de liquidez declarado (Ajustes)" };
  const key = [input.asOf, input.today, input.openingTotal, input.floor, input.declared, input.events.map((event) => `${event.date}${event.kind}${event.amount}${event.confidence}${event.spread ? "s" : ""}`).join(",")].join("|");
  if (nominaBandCache.key === key && nominaBandCache.value) return nominaBandCache.value;
  const result = cash.simulate(input);
  const value = result.status === "ok"
    ? { headroom: Math.round((result.minimum.valueP10 - input.floor) * 100) / 100, floor: input.floor, lowest: result.minimum.valueP10, staleDays: input.staleDays, declared: input.declared, quality: result.quality }
    : { headroom: null, reason: `falta ${result.missing.join(" y ")}` };
  nominaBandCache = { key, value };
  return value;
}

// ¿Los saldos declarados ya incluyen la nómina? Solo si son declarados por el hogar y su fecha es la de la nómina o posterior. Se puede corregir con la casilla.
function nominaInAccountsGuess(payrolls) {
  const balanceDate = String(state?.balanceDate || "").slice(0, 10);
  if (state?.balanceMode !== "manual" || !/^\d{4}-\d{2}-\d{2}$/.test(balanceDate)) return false;
  return payrolls.length > 0 && payrolls.every((item) => item.date && String(item.date).slice(0, 10) <= balanceDate);
}

function nominaCandidates(today, store) {
  const applied = nominaEngine().appliedSourceIds(store);
  return nominaConfirmed(today).filter((item) => !applied.has(item.id) && !store.hidden[item.id]);
}

function nominaSelected(candidates) {
  const next = {};
  candidates.forEach((item) => { next[item.id] = nominaSelection[item.id] !== false; });
  nominaSelection = next;
  return candidates.filter((item) => next[item.id]);
}

// Todo lo que pinta la parte editable, calculado de una vez para poder aplicarlo y repintarlo con las mismas cifras.
function nominaModel(today, store) {
  const engine = nominaEngine();
  const candidates = nominaCandidates(today, store);
  const chosen = nominaSelected(candidates);
  if (!candidates.length) return { candidates, chosen, availability: engine.availableToSplit({ payrolls: [] }), rows: [], band: null };
  const band = nominaHeadroom(today);
  const availability = engine.availableToSplit({ payrolls: chosen.map((item) => ({ id: item.id, label: item.label, amount: item.amount })), headroom: band.headroom, earmarked: engine.earmarkedAmount(store, state?.balanceDate) });
  if (availability.status !== "ok") return { candidates, chosen, availability, rows: [], band };
  const inAccounts = store.prefs.inAccounts === null ? nominaInAccountsGuess(chosen) : store.prefs.inAccounts;
  const ladderEngine = globalThis.FinanceCanonicalNextEuro;
  const inputs = proxEuroLoad();
  const sources = proxEuroSources({ ...inputs, amount: availability.available, inAccounts });
  const ladder = ladderEngine.buildLadder(sources);
  const pensionRung = ladder.rungs.find((rung) => rung.id === "pension");
  const rows = engine.rowsFromLadder({ ladder, available: availability.available, debts: sources.debts, caps: { pension: pensionRung && Number.isFinite(pensionRung.room) ? pensionRung.room : null }, investTypes: Object.keys((sources.portfolio && sources.portfolio.targets) || {}) });
  const key = JSON.stringify([chosen.map((item) => [item.id, item.amount]), availability.available, inAccounts, rows.map((row) => [row.id, row.suggested])]);
  if (nominaWorking.key !== key) nominaWorking = { key, rows };
  return { candidates, chosen, availability, rows: nominaWorking.rows, band, ladder, inAccounts };
}

function nominaAvailabilityHtml(model) {
  const { availability, band } = model;
  const notes = availability.notes.map((line) => `<p class="e19-kpi-note">${escapeHtml(line)}</p>`).join("");
  const basis = availability.basis === "band"
    ? `<p class="e19-kpi-note">Holgura sobre el suelo en el peor punto de los próximos 30 días: ${nominaEuros(band.headroom)} (la liquidez baja hasta ${nominaEuros(band.lowest)} en 9 de cada 10 casos; suelo ${nominaEuros(band.floor)}).${band.declared ? "" : " Los saldos son calculados, no declarados: declara los reales (Registrar) para fiarte de esta cifra."}${band.quality === "wide" ? " La banda sale muy ancha (casi todo lo que se mueve tiene fecha estimada): esta holgura es poco informativa." : ""}${band.staleDays > 0 ? ` Los saldos tienen ${band.staleDays} día${band.staleDays === 1 ? "" : "s"}.` : ""}</p>`
    : `<p class="e19-kpi-note"><strong>Sin comprobar:</strong> ${escapeHtml(band && band.reason ? `no puedo calcular la holgura (${band.reason})` : "no puedo calcular la holgura")}.</p>`;
  return `<p class="nom-disponible"><span aria-hidden="true">${availability.status === "ok" ? "✓" : "⚠"}</span> <strong>Disponible para repartir: ${nominaEuros(availability.available)}</strong> de ${nominaEuros(availability.gross)} de nómina${availability.limitedBy === "floor" ? " (limitado por el suelo)" : ""}</p>${basis}${notes}
    <p class="e19-kpi-note">La banda solo recoge la incertidumbre de las <strong>fechas</strong> y mira 30 días: no cubre un gasto más caro de lo previsto ni un pago grande más allá de ese plazo.</p>`;
}

function nominaRowHtml(row) {
  if (row.id === "free") return `<li class="nom-fila nom-libre" data-nom-row="free"><span class="nom-etiqueta">${escapeHtml(row.label)}</span><strong class="nom-importe-fijo">${nominaEuros(row.amount)}</strong></li>`;
  const label = escapeHtml(row.label);
  const differs = row.amount !== row.suggested;
  const tag = differs ? `<small class="nom-sugerido">distinto de lo sugerido (${nominaEuros(row.suggested)})</small>` : (row.suggested > 0 ? `<small class="nom-sugerido">lo que sugiere la escalera</small>` : `<small class="nom-sugerido">la escalera no propone nada aquí</small>`);
  const cap = Number.isFinite(row.max) ? `<small class="nom-sugerido">tope ${nominaEuros(row.max)}</small>` : "";
  const step = nominaEngine().DEFAULT_STEP;
  return `<li class="nom-fila" data-nom-row="${escapeHtml(row.id)}" data-nom-group="${escapeHtml(row.group)}">
      <span class="nom-etiqueta">${label}${tag}${cap}</span>
      <span class="nom-control">
        <button type="button" class="e19-btn nom-paso" data-nom-step="${-step}" data-nom-id="${escapeHtml(row.id)}" data-nom-focus="${escapeHtml(row.id)}-menos" aria-label="Quitar ${step} € de ${label}">−${step}</button>
        <input type="text" inputmode="decimal" class="nom-input" data-nom-amount="${escapeHtml(row.id)}" data-nom-focus="${escapeHtml(row.id)}-importe" value="${String(row.amount).replace(".", ",")}" aria-label="Importe de ${label} en euros" />
        <button type="button" class="e19-btn nom-paso" data-nom-step="${step}" data-nom-id="${escapeHtml(row.id)}" data-nom-focus="${escapeHtml(row.id)}-mas" aria-label="Añadir ${step} € a ${label}">+${step}</button>
      </span>
    </li>`;
}

function nominaEditorHtml(model) {
  const engine = nominaEngine();
  const { candidates, chosen, availability, rows } = model;
  const sources = candidates.map((item) => `<li><label class="peu-check"><input type="checkbox" data-nom-source="${escapeHtml(item.id)}" data-nom-focus="src-${escapeHtml(item.id)}"${nominaSelection[item.id] ? " checked" : ""} /><span><strong>${escapeHtml(item.label)}</strong> · ${nominaEuros(item.amount)} confirmada${item.date ? ` (esperada el ${nominaDate(item.date)})` : ""}</span></label> <button type="button" class="e19-btn nom-secundario" data-nom-action="ocultar" data-nom-id="${escapeHtml(item.id)}" data-nom-focus="ocultar-${escapeHtml(item.id)}">No repartir esta</button></li>`).join("");
  const head = `<h4 class="nom-subtitulo">Nóminas confirmadas</h4><ul class="nom-fuentes">${sources}</ul>`;
  if (!chosen.length) return `${head}${estadoHtml({ kind: "vacio", titulo: "Marca al menos una nómina", texto: "Sin una nómina marcada no hay nada que repartir." })}`;
  if (availability.status !== "ok") return `${head}${nominaAvailabilityHtml(model)}${estadoHtml({ kind: "vacio", titulo: "Hoy no hay nada que repartir", texto: "Con el suelo de liquidez y los pagos de las próximas semanas, esta nómina se queda donde está." })}`;
  const summary = engine.summarize(rows);
  const status = summary.free > 0
    ? `<p class="nom-estado" role="status"><span aria-hidden="true">◐</span> Repartido ${nominaEuros(summary.assigned)} de ${nominaEuros(model.availability.available)}. Quedan ${nominaEuros(summary.free)} sin repartir: se quedan en la cuenta.</p>`
    : `<p class="nom-estado" role="status"><span aria-hidden="true">✓</span> Repartido todo: ${nominaEuros(summary.assigned)} de ${nominaEuros(model.availability.available)}.</p>`;
  const ladderNote = model.ladder && model.ladder.status === "partial"
    ? `<p class="peu-aviso" role="note"><strong>Escalera parcial:</strong> faltan datos (${escapeHtml(model.ladder.missing.join(", "))}). Lo que dependa de ellos no es fiable.</p>` : "";
  const investRung = model.ladder && model.ladder.rungs.find((rung) => rung.id === "invest");
  const investNote = investRung && investRung.status === "no-verdict"
    ? `<p class="e19-kpi-note"><strong>Por qué queda dinero sin repartir:</strong> sin una rentabilidad esperada de invertir la escalera no decide entre amortizar el resto e invertir. Escríbela en «¿Dónde va el próximo euro?», arriba.</p>` : "";
  const inAccounts = `<label class="peu-check"><input type="checkbox" data-nom-inaccounts data-nom-focus="inaccounts"${model.inAccounts ? " checked" : ""} /><span>Mis saldos declarados ya incluyen esta nómina. Sin marcar, es dinero que aún no está en la liquidez de la escalera.</span></label>`;
  return `${head}${inAccounts}${nominaAvailabilityHtml(model)}${ladderNote}${investNote}
    <h4 class="nom-subtitulo">Reparto</h4>
    <ul class="nom-filas">${rows.map(nominaRowHtml).join("")}</ul>
    ${status}${nominaNote ? `<p class="nom-nota" role="status"><span aria-hidden="true">⚠</span> ${escapeHtml(nominaNote)}</p>` : ""}
    <p class="e19-kpi-note">Los botones mueven dinero entre una fila y «sin repartir»: el total nunca cambia ni queda un importe negativo. Lo que la escalera no propone se puede añadir, pero queda marcado.</p>
    <div class="nom-acciones">
      <button type="button" class="e19-btn e19-btn-primary" data-nom-action="aplicar" data-nom-focus="aplicar"${summary.assigned > 0 ? "" : " disabled"}>Aplicar: guardar borrador y lista de transferencias</button>
      <button type="button" class="e19-btn nom-secundario" data-nom-action="restablecer" data-nom-focus="restablecer"${summary.differsFromSuggested ? "" : " disabled"}>Volver a lo que sugiere la escalera</button>
    </div>
    <p class="e19-kpi-note">«Aplicar» no mueve dinero ni anota nada en tus cuentas: guarda la lista para que hagas tú las transferencias en el banco.</p>`;
}

// El verbo de cada transferencia: el colchón y la pensión no llevan nombre propio; la deuda y la inversión, el de su fila.
function nominaTransferText(item) {
  if (item.group === "cushion") return "Pasar al colchón";
  if (item.group === "pension") return "Aportar al plan de pensiones";
  return item.label || "Transferir";
}

function nominaDraftHtml(draft) {
  const progress = nominaEngine().draftProgress(draft);
  const items = draft.transfers.map((item) => `<li><label class="peu-check"><input type="checkbox" data-nom-done="${escapeHtml(draft.id)}|${escapeHtml(item.id)}" data-nom-focus="done-${escapeHtml(draft.id)}-${escapeHtml(item.id)}"${item.done ? " checked" : ""} /><span><strong>${escapeHtml(nominaTransferText(item))} · ${nominaEuros(item.amount)}</strong><br /><small>${escapeHtml(item.note)}</small></span></label></li>`).join("");
  return `<li class="nom-borrador" data-nom-draft="${escapeHtml(draft.id)}">
      <p class="nom-cabecera"><span aria-hidden="true">${progress.finished ? "✓" : "◐"}</span> <strong>Borrador del ${nominaDate(draft.createdAt)}: ${nominaEuros(draft.available)} de ${escapeHtml(draft.sources.map((item) => item.label).join(" + ") || "nómina")}</strong> <span class="peu-estado">${progress.finished ? "Todo hecho" : `${progress.done} de ${progress.total} hechas`}</span></p>
      <ul class="nom-transferencias">${items}</ul>
      ${draft.free > 0 ? `<p class="e19-kpi-note">${nominaEuros(draft.free)} se quedan en la cuenta, sin repartir.</p>` : ""}
      <p class="e19-kpi-note">«Hecha» es una casilla que marcas tú: la app no sabe si la transferencia se hizo.${draft.basis === "band" ? "" : " Este reparto se hizo sin comprobar la holgura sobre el suelo."}</p>
      <div class="nom-acciones"><button type="button" class="e19-btn nom-secundario" data-nom-action="descartar" data-nom-id="${escapeHtml(draft.id)}" data-nom-focus="descartar-${escapeHtml(draft.id)}">Descartar el borrador</button></div>
    </li>`;
}

function nominaBodyHtml(today) {
  const store = nominaStoreLoad();
  const model = nominaModel(today, store);
  const drafts = store.drafts.length ? `<h4 class="nom-subtitulo">Borradores guardados</h4><ul class="nom-borradores">${store.drafts.map(nominaDraftHtml).join("")}</ul>` : "";
  const editor = model.candidates.length
    ? nominaEditorHtml(model)
    : estadoHtml({ kind: "vacio", titulo: "Ninguna nómina por repartir", texto: "Cuando confirmes una nómina de este mes (la partida de ingreso con «nómina», «salario» o «sueldo» en el nombre y su importe real registrado), aparecerá aquí con el reparto de la escalera. Solo reconozco como nómina las partidas cuyo nombre lo dice." });
  return `${editor}${drafts}`;
}

function renderNominaReparto(engine) {
  const box = qs("nominaCuerpo");
  if (!box || !engine) return;
  attachNominaReparto(document); // idempotente
  try {
    const focusId = document.activeElement && box.contains(document.activeElement) ? document.activeElement.getAttribute("data-nom-focus") : null;
    const html = nominaBodyHtml(isoLocalDate(new Date()));
    if (box.__nominaHtml !== html) {
      box.innerHTML = html;
      box.__nominaHtml = html;
      if (focusId) { const again = [...box.querySelectorAll("[data-nom-focus]")].find((node) => node.getAttribute("data-nom-focus") === focusId); again?.focus?.(); }
    }
  } catch {
    box.textContent = "No se pudo preparar el reparto con los datos actuales.";
  }
}

function nominaRepaint() {
  renderNominaReparto(nominaEngine());
}

function nominaSetRows(result, label) {
  nominaWorking = { key: nominaWorking.key, rows: result.rows };
  nominaNote = result.clamped === "negative" ? "Un importe no puede ser negativo: lo dejé en 0."
    : result.clamped === "max" ? `${label}: no puede pasar de su tope.`
      : result.clamped === "free" ? `${label}: no queda más por repartir. Quita dinero de otra fila primero.` : "";
}

function nominaApply() {
  const engine = nominaEngine();
  const today = isoLocalDate(new Date());
  const before = nominaStoreLoad();
  const model = nominaModel(today, before);
  if (model.availability.status !== "ok" || !model.rows.length) return;
  const stamp = new Date();
  const draft = engine.makeDraft({ id: `nom-${stamp.getTime().toString(36)}`, createdAt: stamp.toISOString(), month: today.slice(0, 7), availability: model.availability, rows: model.rows });
  if (!draft.transfers.length) { nominaNote = "Reparte algo antes de aplicar."; nominaRepaint(); return; }
  nominaStoreSave(engine.addDraft(before, draft));
  nominaNote = "";
  nominaRepaint();
  announceStatus(`Borrador guardado: ${draft.transfers.length} transferencias por hacer. No se ha movido dinero.`);
  showUndoToast(`Borrador guardado: ${draft.transfers.length} transferencia${draft.transfers.length === 1 ? "" : "s"} por hacer. No se ha movido dinero.`, () => { nominaStoreSave(before); nominaRepaint(); announceStatus("Borrador deshecho."); });
}

function nominaClick(event) {
  const target = event.target instanceof Element ? event.target.closest("[data-nom-step], [data-nom-action]") : null;
  if (!target || !qs("nominaCuerpo")?.contains(target)) return;
  const engine = nominaEngine();
  if (target.hasAttribute("data-nom-step")) {
    const id = target.getAttribute("data-nom-id");
    const row = nominaWorking.rows.find((item) => item.id === id);
    nominaSetRows(engine.moveAmount(nominaWorking.rows, id, Number(target.getAttribute("data-nom-step"))), row ? row.label : "Esta fila");
    nominaRepaint();
    return;
  }
  const action = target.getAttribute("data-nom-action");
  if (action === "aplicar") { nominaApply(); return; }
  if (action === "restablecer") { nominaWorking = { key: nominaWorking.key, rows: engine.resetRows(nominaWorking.rows) }; nominaNote = ""; nominaRepaint(); announceStatus("Reparto restablecido."); return; }
  const before = nominaStoreLoad();
  const id = target.getAttribute("data-nom-id");
  if (action === "descartar") {
    nominaStoreSave(engine.discardDraft(before, id));
    nominaRepaint();
    announceStatus("Borrador descartado.");
    showUndoToast("Borrador descartado: su nómina vuelve a ofrecerse.", () => { nominaStoreSave(before); nominaRepaint(); announceStatus("Borrador recuperado."); });
  } else if (action === "ocultar") {
    nominaStoreSave(engine.hideSource(before, id, true));
    nominaRepaint();
    announceStatus("Nómina apartada del reparto.");
    showUndoToast("Nómina apartada del reparto.", () => { nominaStoreSave(before); nominaRepaint(); announceStatus("Nómina recuperada."); });
  }
}

function nominaChange(event) {
  const target = event.target instanceof Element ? event.target : null;
  if (!target || !qs("nominaCuerpo")?.contains(target)) return;
  const engine = nominaEngine();
  if (target.hasAttribute("data-nom-amount")) {
    const id = target.getAttribute("data-nom-amount");
    const row = nominaWorking.rows.find((item) => item.id === id);
    const raw = String(target.value || "").trim();
    nominaSetRows(engine.setRowAmount(nominaWorking.rows, id, raw === "" ? 0 : parseAmount(raw)), row ? row.label : "Esta fila");
    nominaBodyReset();
    nominaRepaint();
  } else if (target.hasAttribute("data-nom-source")) {
    nominaSelection[target.getAttribute("data-nom-source")] = target.checked;
    nominaNote = "";
    nominaRepaint();
  } else if (target.hasAttribute("data-nom-inaccounts")) {
    const store = nominaStoreLoad();
    nominaStoreSave({ ...store, prefs: { ...store.prefs, inAccounts: target.checked } });
    nominaNote = "";
    nominaRepaint();
  } else if (target.hasAttribute("data-nom-done")) {
    const [draftId, transferId] = String(target.getAttribute("data-nom-done")).split("|");
    nominaStoreSave(engine.setTransferDone(nominaStoreLoad(), draftId, transferId, target.checked, isoLocalDate(new Date())));
    nominaRepaint();
  }
}

// Tras escribir un importe, el campo ya muestra lo que el usuario tecleó: se fuerza el repintado aunque el HTML coincida con el anterior.
function nominaBodyReset() {
  const box = qs("nominaCuerpo");
  if (box) box.__nominaHtml = null;
}

// Una sola vez, por delegación.
function attachNominaReparto(doc) {
  if (!doc || doc.__nominaAttached) return false;
  doc.__nominaAttached = true;
  doc.addEventListener("click", nominaClick);
  doc.addEventListener("change", nominaChange);
  return true;
}
