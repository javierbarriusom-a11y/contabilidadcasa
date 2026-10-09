// WP-13 · PR-1 (docs/WP13_DISENO.md): la tarjeta «Índices de referencia» de Deuda › Contratos. El cálculo vive en
// canonical-rate-indices.js (puro); aquí solo se lee y se guarda el almacén `rate-indices`, se pinta y se atienden los
// formularios. Nada de esto consulta una fuente externa: el hogar teclea el valor con la fecha del dato.
//
// Script de pantalla: se carga antes de app.js y comparte su ámbito global (qs, storageGet, escapeHtml…). Sin llamadas al
// DOM ni escuchas al cargarse: app.js llama a `renderIndicesReferencia` al pintar Deuda › Contratos y a `attachIndices`
// una vez en init.

const INDICES_STORE = "rate-indices";
const INDICES_TONE = { fresh: "positive", stale: "negative", missing: "" };
const INDICES_STATE_LABEL = { fresh: "Vigente", stale: "Caducado", missing: "Sin dato" };

function indicesLoad() {
  const engine = globalThis.FinanceCanonicalRateIndices;
  let saved = {};
  try { saved = JSON.parse(storageGet(storageKey(INDICES_STORE), "{}")) || {}; } catch { saved = {}; }
  return engine.normalizeStore(saved);
}

function indicesSave(store) {
  storageSet(storageKey(INDICES_STORE), JSON.stringify(store));
}

function indicesRowHtml(engine, store, indexId, today) {
  const index = engine.INDICES[indexId];
  const status = engine.status(store, indexId, today);
  const history = engine.seriesOf(store, indexId).slice().reverse().slice(0, 12);
  const list = history.map((point) => `<li>${escapeHtml(String(point.value).replace(".", ","))} % · ${escapeHtml(point.date)}
      <button type="button" class="link-button" data-indices-quitar="${escapeHtml(point.date)}" aria-label="Quitar el dato del ${escapeHtml(point.date)} de ${escapeHtml(index.short)}">Quitar</button></li>`).join("");
  return `<div class="idx-fila" data-indices-index="${indexId}">
      <h4 class="idx-titulo">${escapeHtml(index.label)} <small>· dato ${index.cadence}, caduca a los ${index.staleAfterDays} días</small></h4>
      <p class="e19-kpi-note ${INDICES_TONE[status.state]}" role="status"><strong>${INDICES_STATE_LABEL[status.state]}.</strong> ${escapeHtml(status.label)}</p>
      <div class="cuadro-mandos-controls">
        <label class="month-picker"><span>Valor (%)</span>
          <input type="text" inputmode="decimal" autocomplete="off" placeholder="Ej. 2,35" data-indices-valor aria-label="Valor de ${escapeHtml(index.short)} en %" /></label>
        <label class="month-picker"><span>Fecha del dato</span>
          <input type="date" value="${escapeHtml(today)}" max="${escapeHtml(today)}" data-indices-fecha aria-label="Fecha a la que se refiere el dato de ${escapeHtml(index.short)}" /></label>
        <button type="button" class="e19-btn e19-btn-secondary" data-indices-guardar>Guardar ${escapeHtml(index.short)}</button>
      </div>
      ${history.length ? `<details class="idx-historial"><summary>Historial tecleado (${engine.seriesOf(store, indexId).length})</summary><ul>${list}</ul></details>` : ""}
    </div>`;
}

// Pinta las tres filas. La vista se repinta por muchos motivos ajenos a esta tarjeta (una sincronización, un cambio de mes…):
// si nada ha cambiado no se toca el DOM, y si ha cambiado se conserva lo que se estaba escribiendo y el foco. `resetIndex` vacía
// el valor tecleado de la fila que acaba de guardarse.
function renderIndicesReferencia(engine, resetIndex = "") {
  const box = qs("indicesLista");
  if (!box || !engine) return;
  attachIndices(document); // idempotente: el formulario se pinta antes de que init() termine y un clic temprano no puede perderse
  try {
    const store = indicesLoad();
    const today = isoLocalDate(new Date());
    const html = engine.INDEX_IDS.map((id) => indicesRowHtml(engine, store, id, today)).join("");
    if (box.__indicesHtml === html && box.children.length && !resetIndex) return;
    const typed = {};
    box.querySelectorAll("[data-indices-index]").forEach((row) => {
      typed[row.dataset.indicesIndex] = { valor: row.querySelector("[data-indices-valor]")?.value || "", fecha: row.querySelector("[data-indices-fecha]")?.value || "" };
    });
    const active = document.activeElement;
    const focus = active && box.contains(active) && active.closest("[data-indices-index]")
      ? { index: active.closest("[data-indices-index]").dataset.indicesIndex, field: active.hasAttribute("data-indices-valor") ? "valor" : active.hasAttribute("data-indices-fecha") ? "fecha" : "" }
      : null;
    box.innerHTML = html;
    box.__indicesHtml = html;
    box.querySelectorAll("[data-indices-index]").forEach((row) => {
      const id = row.dataset.indicesIndex;
      if (id === resetIndex || !typed[id]) return;
      const valor = row.querySelector("[data-indices-valor]");
      const fecha = row.querySelector("[data-indices-fecha]");
      if (valor && typed[id].valor) valor.value = typed[id].valor;
      if (fecha && typed[id].fecha) fecha.value = typed[id].fecha;
    });
    if (focus && focus.field && focus.index !== resetIndex) box.querySelector(`[data-indices-index="${focus.index}"] [data-indices-${focus.field}]`)?.focus?.();
  } catch (error) {
    console.error(`renderIndicesReferencia: ${error.message}`);
  }
}

function indicesNote(message) {
  const note = qs("indicesNota");
  if (note) note.textContent = message;
  announceStatus(message);
}

function indicesSaveFromRow(row) {
  const engine = globalThis.FinanceCanonicalRateIndices;
  const indexId = row.dataset.indicesIndex;
  const valueField = row.querySelector("[data-indices-valor]");
  const dateField = row.querySelector("[data-indices-fecha]");
  const today = isoLocalDate(new Date());
  const result = engine.addPoint(indicesLoad(), { indexId, value: valueField.value, date: dateField.value }, today);
  if (!result.ok) {
    valueField.setAttribute("aria-invalid", "true");
    indicesNote(result.error);
    valueField.focus();
    return;
  }
  indicesSave(result.store);
  const label = engine.INDICES[indexId].short;
  renderIndicesReferencia(engine, indexId);
  globalThis.renderRevisionTipo?.(globalThis.FinanceCanonicalRateReview); // WP-20: la revisión usa este Euribor
  indicesNote(`${label} guardado${result.replaced ? " (sustituye al de esa fecha)" : ""}.`);
}

function indicesRemoveFromRow(row, date) {
  const engine = globalThis.FinanceCanonicalRateIndices;
  const before = indicesLoad();
  indicesSave(engine.removePoint(before, row.dataset.indicesIndex, date));
  renderIndicesReferencia(engine);
  globalThis.renderRevisionTipo?.(globalThis.FinanceCanonicalRateReview); // WP-20: la revisión usa este Euribor
  indicesNote(`Quitado el dato del ${date}.`);
  // WP-37 (NXP-04): quitar un dato es reversible, así que avisa con «Deshacer».
  showUndoToast(`Dato del ${date} quitado.`, () => {
    indicesSave(before);
    renderIndicesReferencia(engine);
    globalThis.renderRevisionTipo?.(globalThis.FinanceCanonicalRateReview);
    indicesNote(`Recuperado el dato del ${date}.`);
  });
}

// Una sola vez, por delegación.
function attachIndices(doc) {
  if (!doc || doc.__indicesAttached) return false;
  doc.__indicesAttached = true;
  doc.addEventListener("click", (event) => {
    const save = event.target?.closest?.("[data-indices-guardar]");
    if (save) { indicesSaveFromRow(save.closest("[data-indices-index]")); return; }
    const remove = event.target?.closest?.("[data-indices-quitar]");
    if (remove) indicesRemoveFromRow(remove.closest("[data-indices-index]"), remove.dataset.indicesQuitar);
  });
  doc.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && event.target?.matches?.("[data-indices-valor], [data-indices-fecha]")) {
      event.preventDefault();
      indicesSaveFromRow(event.target.closest("[data-indices-index]"));
    }
  });
  return true;
}
