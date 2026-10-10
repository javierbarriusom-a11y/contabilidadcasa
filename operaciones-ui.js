// WP-48 (NIN-06, docs/WP48_DISENO.md): la tarjeta «Libro de operaciones» de Inversión › Cartera. El cálculo (operaciones, cambios, reparto FIFO y «antes / después») vive en
// canonical-portfolio-ledger.js, que a su vez pregunta el FIFO a canonical-portfolio.js; aquí solo se elige la posición, se pinta el libro, se recoge lo que el hogar edita y se enseña lo
// que cambiaría ANTES de guardar. Nada se guarda sin pulsar «Guardar», y todo se puede deshacer. Las posiciones se siguen guardando donde ya vivían (`scenarioSettings.portfolioPositions`);
// no hay almacén nuevo. Tampoco va a Hoy (congelado hasta H-02).
//
// Script de pantalla: se carga antes de app.js y comparte su ámbito global (qs, money, escapeHtml, announceStatus, showUndoToast, parseAmountField, iv1PositionsList, saveIv1PositionsList,
// fc3PriorLossesList, refreshAllSectionsAfterDataChange). Sin llamadas al DOM ni escuchas al cargarse: app.js llama a `renderLibroOperaciones`.

let opsSelectedId = "";
let opsMode = null; // {action: "edit" | "add" | "remove", operation, error}
let opsPreview = null; // {after, diff, action, operation}

function opsEngine() {
  return globalThis.FinanceCanonicalPortfolioLedger;
}

function opsDate(iso) {
  return String(iso || "").split("-").reverse().join("/");
}

function opsUnits(value) {
  return String(Math.round(Number(value) * 10000) / 10000).replace(".", ",");
}

function opsEuros(value) {
  return value === null || value === undefined ? "no calculable" : money(value, true);
}

function opsPosition() {
  const rows = iv1PositionsList();
  return rows.find((position) => position.id === opsSelectedId) || rows[0] || null;
}

function opsReset() {
  opsMode = null;
  opsPreview = null;
}

function opsSalesById(raw) {
  const engine = globalThis.FinanceCanonicalPortfolio;
  const map = new Map();
  if (!engine || !raw) return map;
  engine.normalizePositions([raw]).positions[0].disposals.forEach((sale) => map.set(sale.id, sale));
  return map;
}

const OPS_KIND_LABEL = { initial: "Compra inicial", contribution: "Aportación", disposal: "Venta" };

function opsRowHtml(operation, sales) {
  const sale = operation.source === "disposal" ? sales.get(operation.id) : null;
  const detail = sale
    ? (sale.shortfall > 0 ? `<span class="ops-aviso"><span aria-hidden="true">⚠</span> sin lotes suficientes (faltan ${opsUnits(sale.shortfall)} u): plusvalía no calculable</span>` : `plusvalía FIFO ${opsEuros(sale.realizedGain)}`)
    : (operation.quantity > 0 ? "" : `<span class="ops-aviso"><span aria-hidden="true">⚠</span> sin unidades: no entra en el FIFO</span>`);
  const undated = operation.date ? opsDate(operation.date) : "<em>sin fecha</em>";
  const label = escapeHtml(OPS_KIND_LABEL[operation.source] || "Operación");
  const amountLabel = operation.kind === "sell" ? "recibido" : "coste";
  return `<li class="ops-fila" data-ops-row="${escapeHtml(operation.id)}" data-ops-kind="${escapeHtml(operation.source)}">
      <p class="ops-resumen"><strong>${label}</strong> · ${undated} · ${operation.quantity > 0 ? `${opsUnits(operation.quantity)} u` : "sin unidades"} · ${amountLabel} ${money(operation.amount, true)}</p>
      ${detail ? `<p class="ops-detalle">${detail}</p>` : ""}
      <p class="ops-botones"><button type="button" class="e19-btn ops-boton" data-ops-action="edit" data-ops-id="${escapeHtml(operation.id)}" data-ops-focus="edit-${escapeHtml(operation.id)}" aria-label="Editar ${label.toLowerCase()} del ${undated.replace(/<[^>]*>/g, "")}">Editar</button>${operation.removable ? ` <button type="button" class="e19-btn ops-boton" data-ops-action="remove" data-ops-id="${escapeHtml(operation.id)}" data-ops-focus="remove-${escapeHtml(operation.id)}" aria-label="Quitar ${label.toLowerCase()} del ${undated.replace(/<[^>]*>/g, "")}">Quitar</button>` : ""}</p>
    </li>`;
}

function opsEditorHtml(mode) {
  const op = mode.operation;
  const isSale = op.kind === "sell";
  const title = mode.action === "add" ? (isSale ? "Añadir una venta" : "Añadir una aportación") : `Editar: ${OPS_KIND_LABEL[op.source] || "operación"}`;
  const amountLabel = isSale ? "Importe recibido (€)" : (op.source === "initial" ? "Coste (€)" : "Importe aportado (€)");
  const quantityLabel = isSale ? "Unidades vendidas" : "Unidades (opcional)";
  const err = mode.error ? `<p class="ops-error" id="opsError" role="alert"><span aria-hidden="true">⚠</span> ${escapeHtml(mode.error)}</p>` : `<p id="opsError" role="alert" hidden></p>`;
  return `<form class="ops-editor" id="opsForm" novalidate aria-labelledby="opsEditorTitulo">
      <h4 class="ops-subtitulo" id="opsEditorTitulo">${escapeHtml(title)}</h4>
      <div class="ops-campos">
        <label class="month-picker"><span>Fecha</span><input type="date" id="opsFecha" value="${escapeHtml(op.date || "")}" aria-describedby="opsError" /></label>
        <label class="month-picker"><span>${quantityLabel}</span><input type="text" inputmode="decimal" id="opsUnidades" value="${op.quantity > 0 ? escapeHtml(String(op.quantity).replace(".", ",")) : ""}" /></label>
        <label class="month-picker"><span>${amountLabel}</span><input type="text" inputmode="decimal" id="opsImporte" value="${op.amount > 0 ? escapeHtml(String(op.amount).replace(".", ",")) : ""}" /></label>
      </div>
      <p class="e19-kpi-note">${isSale ? "Importe recibido: neto de comisiones y gastos (lo que entró en la cuenta)." : "Importe: con las comisiones de la compra incluidas."} Así la plusvalía se parece a la fiscal; la app no tiene campo de comisiones aparte.</p>
      ${err}
      <p class="ops-botones"><button type="submit" class="e19-btn e19-btn-primary" data-ops-focus="ver">Ver qué cambia</button> <button type="button" class="e19-btn ops-boton" data-ops-action="cancel" data-ops-focus="cancel">Cancelar</button></p>
    </form>`;
}

function opsDiffHtml(preview) {
  const { diff } = preview;
  if (diff.identical) return `<p class="ops-resumen" role="status"><span aria-hidden="true">✓</span> No hay cambios respecto a lo guardado.</p><p class="ops-botones"><button type="button" class="e19-btn ops-boton" data-ops-action="cancel" data-ops-focus="cancel">Cerrar</button></p>`;
  const rows = [
    ["Unidades que quedan", opsUnits(diff.position.quantity.before), opsUnits(diff.position.quantity.after)],
    ["Coste de lo que queda", opsEuros(diff.position.costBasis.before), opsEuros(diff.position.costBasis.after)],
    ["Plusvalía realizada (FIFO)", opsEuros(diff.position.realizedGain.before), opsEuros(diff.position.realizedGain.after)],
  ];
  diff.sales.forEach((row) => {
    const sale = row.after || row.before;
    const render = (view) => (view ? (view.shortfall > 0 ? `sin lotes (faltan ${opsUnits(view.shortfall)} u)` : opsEuros(view.realizedGain)) : "—");
    rows.push([`Venta del ${opsDate(sale.date)} (${opsUnits(sale.quantitySold)} u)${row.change === "added" ? " · nueva" : row.change === "removed" ? " · quitada" : ""}`, render(row.before), render(row.after)]);
  });
  diff.years.forEach((year) => {
    const render = (side) => (side.calculable ? `neto ${opsEuros(side.netResult)}, base tras pérdidas arrastradas ${opsEuros(side.taxableNet)}` : "no calculable (hay ventas sin lotes)");
    rows.push([`Ejercicio ${year.year}: compensación`, render(year.before), render(year.after)]);
  });
  // Una lista (no una tabla): a 360 px tres columnas no caben y se cortaban; cada cambio es un bloque con su «antes» y su «después» en texto.
  const table = `<h4 class="ops-subtitulo">Qué cambia si guardas</h4><ul class="ops-cambios">${rows.map((row) => `<li class="ops-cambio"><strong class="ops-concepto">${escapeHtml(row[0])}</strong><span class="ops-antes"><span class="ops-etiqueta">Antes:</span> ${escapeHtml(row[1])}</span><span class="ops-despues"><span class="ops-etiqueta">Después:</span> ${escapeHtml(row[2])}</span></li>`).join("")}</ul>`;
  const warnings = diff.newWarnings.length ? `<ul class="ops-avisos">${diff.newWarnings.map((item) => `<li><span aria-hidden="true">⚠</span> ${escapeHtml(item.text)}</li>`).join("")}</ul>` : "";
  const resolved = diff.resolvedShortfalls.length ? `<p class="ops-resumen" role="status"><span aria-hidden="true">✓</span> Esto arregla ${diff.resolvedShortfalls.length} venta${diff.resolvedShortfalls.length === 1 ? "" : "s"} que no tenía${diff.resolvedShortfalls.length === 1 ? "" : "n"} lotes suficientes.</p>` : "";
  const risky = diff.newShortfalls.length > 0;
  const confirm = risky
    ? `<p class="ops-aviso-fuerte" role="note"><span aria-hidden="true">⚠</span> <strong>Si guardas así, ${diff.newShortfalls.length === 1 ? "una venta se queda" : `${diff.newShortfalls.length} ventas se quedan`} sin lotes</strong> y la compensación de su ejercicio dejará de ser calculable hasta que lo corrijas. Puede ser un paso intermedio (corriges la compra después); no se bloquea.</p>`
    : "";
  const actionVerb = preview.action === "remove" ? "Quitar y guardar" : "Guardar los cambios";
  return `${table}${warnings}${resolved}${confirm}
    <p class="ops-botones"><button type="button" class="e19-btn e19-btn-primary" data-ops-action="save" data-ops-focus="save">${risky ? "Guardar aunque deje ventas sin lotes" : actionVerb}</button> ${preview.action === "remove" ? "" : `<button type="button" class="e19-btn ops-boton" data-ops-action="back" data-ops-focus="back">Volver a editar</button> `}<button type="button" class="e19-btn ops-boton" data-ops-action="cancel" data-ops-focus="cancel">Cancelar</button></p>
    <p class="e19-kpi-note">No se ha guardado nada todavía. Al guardar se podrá deshacer.</p>`;
}

function opsBodyHtml() {
  const engine = opsEngine();
  const rows = iv1PositionsList();
  if (!rows.length) return estadoHtml({ kind: "vacio", titulo: "Aún no hay posiciones", texto: "Registra una posición en Cartera de inversión y aquí verás su libro de operaciones para corregirlo." });
  const position = opsPosition();
  opsSelectedId = position.id;
  const options = rows.map((row) => `<option value="${escapeHtml(row.id)}"${row.id === position.id ? " selected" : ""}>${escapeHtml(row.label || row.id)}</option>`).join("");
  const sales = opsSalesById(position);
  const operations = engine.operations(position);
  const warnings = engine.warnings(position, globalThis.FinanceCanonicalPortfolio.normalizePositions([position]).positions[0]);
  const list = operations.length ? `<ul class="ops-lista">${operations.map((operation) => opsRowHtml(operation, sales)).join("")}</ul>` : `<p class="e19-kpi-note">Esta posición no tiene operaciones registradas.</p>`;
  const initialNote = warnings.some((item) => item.code === "initial-without-date") ? `<p class="ops-aviso-fuerte" role="note"><span aria-hidden="true">⚠</span> ${escapeHtml(warnings.find((item) => item.code === "initial-without-date").text)} Edita la compra inicial y ponle su fecha.</p>` : "";
  let panel = "";
  if (opsPreview) panel = opsDiffHtml(opsPreview);
  else if (opsMode && opsMode.action !== "remove") panel = opsEditorHtml(opsMode);
  const adders = opsMode || opsPreview ? "" : `<p class="ops-botones"><button type="button" class="e19-btn ops-boton" data-ops-action="add-buy" data-ops-focus="add-buy">Añadir una aportación</button> <button type="button" class="e19-btn ops-boton" data-ops-action="add-sell" data-ops-focus="add-sell">Añadir una venta</button></p>`;
  return `<label class="month-picker"><span>Posición</span><select id="opsPosicion" data-ops-focus="posicion">${options}</select></label>
    ${initialNote}${list}${adders}${panel}
    <p class="e19-kpi-note">El reparto FIFO es el de siempre (el lote más antiguo se vende primero) y se recalcula con cada cambio. Las ventas, las pérdidas arrastradas y la compensación de Renta se leen de aquí: un cambio en el libro los mueve.</p>`;
}

function renderLibroOperaciones(engine) {
  const box = qs("opsCuerpo");
  if (!box || !engine || !globalThis.FinanceCanonicalPortfolio) return;
  attachLibroOperaciones(document); // idempotente
  try {
    const focusId = document.activeElement && box.contains(document.activeElement) ? document.activeElement.getAttribute("data-ops-focus") : null;
    const html = opsBodyHtml();
    if (box.__opsHtml !== html) {
      box.innerHTML = html;
      box.__opsHtml = html;
      if (focusId) [...box.querySelectorAll("[data-ops-focus]")].find((node) => node.getAttribute("data-ops-focus") === focusId)?.focus?.();
    }
  } catch {
    box.textContent = "No se pudo preparar el libro de operaciones con los datos actuales.";
  }
}

function opsRepaint(force = false) {
  const box = qs("opsCuerpo");
  if (box && force) box.__opsHtml = null;
  renderLibroOperaciones(opsEngine());
}

function opsStartAdd(kind) {
  const stamp = Date.now();
  const isSale = kind === "sell";
  opsMode = { action: "add", error: "", operation: isSale ? { id: `disposal-${stamp}`, source: "disposal", kind: "sell", date: "", quantity: 0, amount: 0 } : { id: `contribution-${stamp}`, source: "contribution", kind: "buy", date: "", quantity: 0, amount: 0 } };
  opsPreview = null;
}

// Lo que hay en el formulario → la operación, sin validar (valida el motor).
function opsReadForm() {
  const base = opsMode.operation;
  // `parseAmountField` entiende el formato de aquí («14.000» son catorce mil; «1,5», uno y medio). Lo que no es un número se deja como NaN para que el motor lo diga: nunca se lee como vacío.
  const read = (id) => { const raw = String(qs(id)?.value ?? "").trim(); if (raw === "") return ""; const value = parseAmountField(raw); return value === null ? NaN : value; };
  return { ...base, date: String(qs("opsFecha")?.value || ""), quantity: read("opsUnidades"), amount: read("opsImporte") };
}

function opsComputePreview(action, operation) {
  const engine = opsEngine();
  const position = opsPosition();
  const applied = engine.applyChange(position, { action, operation });
  if (!applied.ok) return { ok: false, reason: applied.reason };
  const others = iv1PositionsList().filter((row) => row.id !== position.id);
  const diff = engine.diff(position, applied.position, { otherPositions: others, priorLosses: fc3PriorLossesList() });
  return { ok: true, preview: { after: applied.position, diff, action, operation } };
}

function opsSave() {
  if (!opsPreview) return;
  const position = opsPosition();
  const before = iv1PositionsList();
  const label = position.label || "la posición";
  saveIv1PositionsList(before.map((row) => (row.id === position.id ? opsPreview.after : row)));
  const verb = opsPreview.action === "remove" ? "quitada" : opsPreview.action === "add" ? "añadida" : "cambiada";
  opsReset();
  refreshAllSectionsAfterDataChange();
  opsRepaint(true);
  announceStatus(`Operación ${verb} en «${label}». Plusvalías recalculadas.`);
  showUndoToast(`Operación ${verb} en «${label}».`, () => {
    saveIv1PositionsList(before);
    opsReset();
    refreshAllSectionsAfterDataChange();
    opsRepaint(true);
    announceStatus("Cambio deshecho.");
  });
}

function opsClick(event) {
  const target = event.target instanceof Element ? event.target.closest("[data-ops-action]") : null;
  if (!target || !qs("opsCuerpo")?.contains(target)) return;
  const action = target.getAttribute("data-ops-action");
  const id = target.getAttribute("data-ops-id");
  if (action === "edit") {
    const operation = opsEngine().operations(opsPosition()).find((item) => item.id === id);
    if (!operation) return;
    opsMode = { action: "edit", operation, error: "" };
    opsPreview = null;
  } else if (action === "remove") {
    const operation = opsEngine().operations(opsPosition()).find((item) => item.id === id);
    if (!operation) return;
    const result = opsComputePreview("remove", operation);
    if (!result.ok) { announceStatus(result.reason); return; }
    opsMode = { action: "remove", operation, error: "" };
    opsPreview = result.preview;
  } else if (action === "add-buy") opsStartAdd("buy");
  else if (action === "add-sell") opsStartAdd("sell");
  else if (action === "back") opsPreview = null;
  else if (action === "cancel") opsReset();
  else if (action === "save") { opsSave(); return; }
  opsRepaint(true);
}

function opsSubmit(event) {
  if (event.target?.id !== "opsForm") return;
  event.preventDefault();
  if (!opsMode) return;
  const operation = opsReadForm();
  const result = opsComputePreview(opsMode.action, operation);
  if (!result.ok) {
    opsMode = { ...opsMode, operation, error: result.reason };
    opsRepaint(true);
    announceStatus(result.reason);
    return;
  }
  opsMode = { ...opsMode, operation, error: "" };
  opsPreview = result.preview;
  opsRepaint(true);
}

function opsChange(event) {
  const target = event.target instanceof Element ? event.target : null;
  if (!target || target.id !== "opsPosicion") return;
  opsSelectedId = target.value;
  opsReset();
  opsRepaint(true);
}

// Una sola vez, por delegación.
function attachLibroOperaciones(doc) {
  if (!doc || doc.__opsAttached) return false;
  doc.__opsAttached = true;
  doc.addEventListener("click", opsClick);
  doc.addEventListener("submit", opsSubmit);
  doc.addEventListener("change", opsChange);
  return true;
}
