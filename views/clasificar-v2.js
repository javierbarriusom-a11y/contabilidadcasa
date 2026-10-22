// Rediseño · fase A5 (docs/rediseno/HANDOFF.md §5 «B4 · Clasificar por lotes», referencias/png/Clasificar.png).
//
// Clasificar v2: los movimientos sin partida, por grupos del mismo concepto, de 5 en 5. Cada grupo enseña cuántos
// movimientos tiene, cuánto suma su último mes y su importe típico, una propuesta (si la hay), hasta 3 alternativas y
// «Otra…» con todas las partidas. «Aceptar y siguiente» crea la regla del concepto para siempre, con su «Deshacer»
// (el aviso de 10 s de siempre y, al acabar la tanda, uno por regla); «Saltar» lo deja en la bandeja. Hoja inferior
// en móvil, panel derecho de 400 px en escritorio. Solo se abre desde la bandeja de Movimientos v2.
//
// No es un motor nuevo: escribe en el mismo diccionario de reglas (movementMappings, clave movementMappingKey) y con
// la misma secuencia de refresco que el lote de Movimientos (handleMovementsBulkApply, datos-ui.js). La propuesta y su
// confianza (alta, media o baja, con el porqué) salen solo de lo que ya existe: las reglas del hogar para el mismo
// comercio y la coincidencia de nombre de siempre (clasV2Proposal). Las alternativas son las partidas que más reglas
// tienen ya del mismo tipo, sin inventar ninguna.
// Script clásico con defer, cargado antes de app.js (mismo scope global que el resto de views/*.js).

const CLAS_V2_MAX = 5;
const CLAS_V2_ALTS = 3;

let clasV2Groups = [];
let clasV2Index = 0;
let clasV2Choice = "";
let clasV2OtherOpen = false;
let clasV2Created = [];
let clasV2Skipped = new Set();
let clasV2Opener = null;

// Los grupos sin partida, del que más suma al que menos. Mismo criterio que la bandeja de Movimientos v2 (un
// movimiento con importe y sin partida) y que buildPendingMovementMappings, pero con todas las filas de cada grupo:
// hacen falta para el importe típico, el último mes y los reales que tocaría la regla (para poder deshacerla).
function clasV2PendingGroups() {
  const groups = new Map();
  (baseData?.transactions || []).forEach((row) => {
    if (!row || !Number(row.amount) || mappingForMovement(row)) return;
    const key = movementMappingKey(row);
    const group = groups.get(key) || { key, kind: movementKindFromAmount(row.amount), name: movementDisplayName(row), rows: [], total: 0 };
    group.rows.push(row);
    group.total = round2(group.total + Math.abs(Number(row.amount)));
    groups.set(key, group);
  });
  return [...groups.values()].sort((a, b) => b.total - a.total || b.rows.length - a.rows.length);
}

function clasV2MonthName(monthKey) {
  const date = new Date(`${monthKey}-15T12:00:00`);
  return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("es-ES", { month: "long" }).format(date);
}

// Las tres cifras del grupo, todas de sus movimientos: cuántos, cuánto en el mes del último y el rango de importes.
function clasV2Stats(group) {
  const amounts = group.rows.map((row) => Math.abs(Number(row.amount))).sort((a, b) => a - b);
  const lastMonth = group.rows.map((row) => String(row.date || "")).sort().at(-1).slice(0, 7);
  const inMonth = round2(group.rows.filter((row) => String(row.date || "").startsWith(lastMonth)).reduce((sum, row) => sum + Math.abs(Number(row.amount)), 0));
  const low = amounts[0];
  const high = amounts.at(-1);
  return {
    count: group.rows.length,
    monthLabel: lastMonth ? `En ${clasV2MonthName(lastMonth)}` : "Total",
    inMonth: lastMonth ? inMonth : group.total,
    typical: Math.round(low) === Math.round(high) ? money(low, true) : `${money(low)} – ${money(high)}`,
  };
}

// Palabras de un concepto bancario que dicen cómo se pagó, no a quién: no sirven para reconocer el comercio.
const CLAS_V2_GENERIC = new Set(
  "compra compras pago pagos tarj tarjeta credito debito visa mastercard recibo recibos domiciliacion transferencia transf trf bizum enviado enviada recibido recibida cargo adeudo abono tpv cuota comision operacion ref num con del las los por para www com".split(" "),
);

function clasV2Words(text) {
  return normalizedText(text || "").replace(/[^a-z0-9]+/g, " ").trim().split(" ").filter(Boolean);
}

// El comercio de un movimiento: la primera palabra del concepto con 3 letras o más que no sea genérica ni un número
// («COMPRA TARJ. MERCADONA 1234» → «mercadona»).
function clasV2Merchant(row) {
  return clasV2Words(row?.movement).find((word) => word.length >= 3 && /[a-z]/.test(word) && !CLAS_V2_GENERIC.has(word)) || "";
}

// Reglas de concepto que el hogar ya tiene para el mismo comercio (otro concepto con esa palabra), contadas por
// partida. Las de «solo este movimiento» (clave transactionIdentity, que empieza por la fecha) no cuentan.
function clasV2SiblingRules(group, merchant) {
  const byRow = new Map();
  if (!merchant) return byRow;
  Object.entries(movementMappings || {}).forEach(([key, mapping]) => {
    const [kind, movement = ""] = key.split("|");
    if (kind !== group.kind || mapping?.kind !== group.kind || key === group.key || !movement.split(" ").includes(merchant)) return;
    if (planningRowBySeriesKey(group.kind, mapping.rowKey)) byRow.set(mapping.rowKey, (byRow.get(mapping.rowKey) || 0) + 1);
  });
  return [...byRow.entries()].sort((a, b) => b[1] - a[1]);
}

// Las partidas cuyo nombre aparece en el concepto (o al revés), con la misma regla que datosImportarSuggestionFor
// (al menos 4 caracteres), pero todas y de la más concreta (nombre más largo) a la menos.
function clasV2NameMatches(group) {
  const row = group.rows[0];
  const text = normalizedText(`${row.movement || ""} ${row.details || ""}`);
  if (text.length < 4) return [];
  return availableSeriesRows(group.kind)
    .filter((partida) => {
      const label = normalizedText(displayLabelForRow(partida));
      return label.length >= 4 && (text.includes(label) || label.includes(text));
    })
    .sort((a, b) => displayLabelForRow(b).length - displayLabelForRow(a).length);
}

// Propuesta con su confianza y el porqué, sin cifras inventadas:
// - alta: 2 o más reglas del mismo comercio a la misma partida (sin que el nombre apunte a otra), o una regla y además
//   el nombre de esa partida en el concepto;
// - media: una regla del mismo comercio, o una sola partida que encaja por nombre (o varias, si la más concreta
//   contiene a las demás: «Seguro coche» frente a «Seguro»);
// - baja: el comercio ya tiene reglas a varias partidas, o encajan por nombre varias partidas distintas.
function clasV2Proposal(group) {
  const merchant = clasV2Merchant(group.rows[0]);
  const siblings = clasV2SiblingRules(group, merchant);
  const byName = clasV2NameMatches(group);
  const shown = merchant.toUpperCase();
  if (siblings.length) {
    const [rowKey, count] = siblings[0];
    const row = planningRowBySeriesKey(group.kind, rowKey);
    if (siblings.length > 1) return { row, confidence: "baja", reason: `«${shown}» ya tiene reglas a ${siblings.length} partidas distintas; esta es la que más.` };
    const nameAgrees = byName.some((partida) => seriesKeyForRow(partida) === rowKey);
    const rules = count === 1 ? "una regla" : `${count} reglas`;
    if (nameAgrees) return { row, confidence: "alta", reason: `Ya tienes ${rules} de «${shown}» a esta partida y su nombre está en el concepto.` };
    if (count >= 2 && !byName.length) return { row, confidence: "alta", reason: `Ya tienes ${rules} de «${shown}» a esta partida.` };
    return { row, confidence: "media", reason: `Ya tienes ${rules} de «${shown}» a esta partida${byName.length ? `, aunque el concepto nombra «${displayLabelForRow(byName[0])}»` : ""}.` };
  }
  if (!byName.length) return null;
  const top = normalizedText(displayLabelForRow(byName[0]));
  if (byName.slice(1).every((partida) => top.includes(normalizedText(displayLabelForRow(partida))))) {
    return { row: byName[0], confidence: "media", reason: "El nombre de la partida está en el concepto." };
  }
  return { row: byName[0], confidence: "baja", reason: `${byName.length} partidas encajan por el nombre; esta es la más concreta.` };
}

function clasV2Suggestion(group) {
  return clasV2Proposal(group)?.row || null;
}

// Las partidas con más reglas del mismo tipo (ingreso o gasto), sin la propuesta: lo que el hogar ya usa.
function clasV2Alternatives(group, suggestion) {
  const skip = suggestion ? seriesKeyForRow(suggestion) : "";
  const uses = new Map();
  Object.values(movementMappings || {}).forEach((mapping) => {
    if (mapping?.kind !== group.kind || !mapping.rowKey || mapping.rowKey === skip) return;
    uses.set(mapping.rowKey, (uses.get(mapping.rowKey) || 0) + 1);
  });
  return [...uses.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([rowKey]) => planningRowBySeriesKey(group.kind, rowKey))
    .filter(Boolean)
    .slice(0, CLAS_V2_ALTS);
}

function clasV2Target(group) {
  if (!group) return null;
  if (clasV2Choice) return planningRowBySeriesKey(group.kind, clasV2Choice);
  return clasV2Suggestion(group);
}

function clasV2Remaining() {
  const inBatch = new Set(clasV2Groups.map((group) => group.key));
  return clasV2PendingGroups().filter((group) => !inBatch.has(group.key) && !clasV2Skipped.has(group.key)).length;
}

function clasV2Head(meta) {
  return `<div class="clas-v2-asa" aria-hidden="true"></div>
    <div class="clas-v2-head">
      <div><h2 id="clasificarV2Titulo">Clasificar</h2><span class="clas-v2-meta">${meta}</span></div>
      <button type="button" class="e19-btn e19-btn-secondary clas-v2-cerrar" data-clas-v2-cerrar aria-label="Cerrar"><svg class="mov-v2-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
    </div>`;
}

function clasV2Progress() {
  return `<div class="clas-v2-progreso" role="progressbar" aria-label="Grupos de esta tanda" aria-valuemin="0" aria-valuemax="${clasV2Groups.length}" aria-valuenow="${clasV2Index + 1}">${clasV2Groups
    .map((_group, index) => `<span${index <= clasV2Index ? ' class="is-hecho"' : ""}></span>`)
    .join("")}</div>`;
}

function clasV2OtherSelect(group) {
  const options = availableSeriesRows(group.kind)
    .map((row) => {
      const key = seriesKeyForRow(row);
      return `<option value="${escapeHtml(key)}"${key === clasV2Choice ? " selected" : ""}>${escapeHtml(row.sectionName)} · ${escapeHtml(displayLabelForRow(row))}</option>`;
    })
    .join("");
  return `<label class="clas-v2-otra"><span class="clas-v2-meta">Elige la partida</span>
    <select id="clasificarV2Otra" data-clas-v2-otra-select><option value="">Elige una partida…</option>${options}</select></label>`;
}

function clasV2GroupHtml() {
  const group = clasV2Groups[clasV2Index];
  const stats = clasV2Stats(group);
  const proposalInfo = clasV2Proposal(group);
  const suggestion = proposalInfo?.row || null;
  const target = clasV2Target(group);
  const info = clasV2Choice ? null : proposalInfo;
  const alternatives = clasV2Alternatives(group, suggestion);
  const rest = clasV2Remaining();
  const meta = `${clasV2Index + 1} de ${clasV2Groups.length}${rest ? ` · ${rest} más en otra tanda` : ""}`;
  const proposal = target
    ? `<div class="clas-v2-propuesta"${info ? ` data-confianza="${info.confidence}"` : ""}>
        <span><span class="clas-v2-meta">${clasV2Choice ? "Elegida" : "Propuesta"}${target.sectionName ? ` · ${escapeHtml(target.sectionName)}` : ""}</span><b>${escapeHtml(displayLabelForRow(target))}</b></span>
        ${info ? `<span class="clas-v2-lab">confianza ${info.confidence}</span><span class="clas-v2-meta clas-v2-porque">${escapeHtml(info.reason)}</span>` : ""}
      </div>`
    : `<div class="clas-v2-propuesta is-vacia"><span class="clas-v2-meta">Sin propuesta para este concepto: elige su partida.</span></div>`;
  const chips = alternatives.map((row, index) => {
    const key = seriesKeyForRow(row);
    return `<button type="button" class="clas-v2-opt${key === clasV2Choice ? " is-activa" : ""}" data-clas-v2-alt="${escapeHtml(key)}" aria-pressed="${key === clasV2Choice}" aria-keyshortcuts="${index + 1}">${escapeHtml(displayLabelForRow(row))}</button>`;
  });
  const showSelect = clasV2OtherOpen || (!suggestion && !alternatives.length);
  if (!showSelect) chips.push(`<button type="button" class="clas-v2-opt" data-clas-v2-otra>Otra…</button>`);
  const rule = target ? `Al aceptar creo la regla «${escapeHtml(group.name)} → ${escapeHtml(displayLabelForRow(target))}» para siempre (${stats.count === 1 ? "este movimiento" : `estos ${stats.count} movimientos`} y los futuros). Se deshace con el aviso o al acabar la tanda.` : "";
  return `${clasV2Head(escapeHtml(meta))}
    ${clasV2Progress()}
    <div class="clas-v2-card">
      <span class="clas-v2-lab">Grupo · mismo concepto · ${group.kind === "income" ? "ingreso" : "gasto"}</span>
      <b class="clas-v2-nombre${group.name.length > 24 ? " is-largo" : ""}">${escapeHtml(group.name)}</b>
      <div class="clas-v2-cifras">
        <div><span class="clas-v2-meta">Movimientos</span><span class="clas-v2-num">${stats.count}</span></div>
        <div><span class="clas-v2-meta">${escapeHtml(stats.monthLabel)}</span><span class="clas-v2-num">${money(stats.inMonth, true)}</span></div>
        <div><span class="clas-v2-meta">Importe típico</span><span class="clas-v2-num">${stats.typical}</span></div>
      </div>
      ${proposal}
      ${chips.length ? `<div class="clas-v2-opts" role="group" aria-label="Otras partidas">${chips.join("")}</div>` : ""}
      ${showSelect ? clasV2OtherSelect(group) : ""}
    </div>
    ${rule ? `<p class="clas-v2-meta clas-v2-regla">${rule}</p>` : ""}
    <p class="clas-v2-meta clas-v2-atajos">↵ aceptar · 1-${CLAS_V2_ALTS} alternativas · S saltar · ⌘Z deshacer</p>
    <div class="clas-v2-botones">
      <button type="button" class="e19-btn e19-btn-secondary" data-clas-v2-saltar aria-keyshortcuts="S">Saltar</button>
      <button type="button" class="e19-btn e19-btn-primary" data-clas-v2-aceptar${target ? "" : " disabled"} aria-keyshortcuts="Enter">Aceptar y siguiente</button>
    </div>`;
}

// Fin de la tanda: las reglas creadas, cada una con su «Deshacer», y lo que queda para otra vez.
function clasV2SummaryHtml() {
  const skipped = clasV2Groups.filter((group) => clasV2Skipped.has(group.key)).length;
  const rest = clasV2Remaining();
  const created = clasV2Created.length
    ? `<ul class="clas-v2-reglas">${clasV2Created
        .map((rule, index) => `<li><span><b>${escapeHtml(rule.name)}</b> → ${escapeHtml(rule.partida)}<span class="clas-v2-meta">${rule.count} ${rule.count === 1 ? "movimiento" : "movimientos"}</span></span>
          <button type="button" class="e19-btn e19-btn-secondary" data-clas-v2-deshacer="${index}">Deshacer</button></li>`)
        .join("")}</ul>`
    : `<p class="clas-v2-meta">No se ha creado ninguna regla en esta tanda.</p>`;
  const lines = [
    skipped ? `${skipped === 1 ? "Un grupo saltado sigue" : `${skipped} grupos saltados siguen`} en la bandeja.` : "",
    rest ? `${rest === 1 ? "Queda un grupo" : `Quedan ${rest} grupos`} para otra tanda.` : "",
  ].filter(Boolean);
  const title = clasV2Groups.length ? `Tanda terminada · ${clasV2Created.length} ${clasV2Created.length === 1 ? "regla nueva" : "reglas nuevas"}` : "Todo tiene partida";
  return `${clasV2Head(title)}
    <div class="clas-v2-card">${created}</div>
    ${lines.length ? `<p class="clas-v2-meta">${lines.join(" ")}</p>` : ""}
    <div class="clas-v2-botones">
      ${rest ? `<button type="button" class="e19-btn e19-btn-secondary" data-clas-v2-otra-tanda>Otros ${Math.min(rest, CLAS_V2_MAX)}</button>` : ""}
      <button type="button" class="e19-btn e19-btn-primary" data-clas-v2-cerrar>Listo</button>
    </div>`;
}

// El foco va a lo que se hará con ↵: aceptar si se puede; si no, elegir partida; si no, saltar. Sin desplazar la hoja:
// los botones van fijos abajo (tema-v2.css) y la cabecera tiene que seguir a la vista.
function clasV2Focus(dialog) {
  if (!dialog.open) return;
  const order = clasV2Index >= clasV2Groups.length ? ["[data-clas-v2-cerrar].e19-btn-primary"] : ["[data-clas-v2-aceptar]:not([disabled])", "#clasificarV2Otra", "[data-clas-v2-saltar]"];
  order.map((selector) => dialog.querySelector(selector)).find(Boolean)?.focus({ preventScroll: true });
}

// Todo va dentro de .clas-v2-in: un clic con destino el propio <dialog> es siempre el fondo, y cierra.
function clasV2Render() {
  const dialog = qs("clasificarV2");
  if (!dialog) return;
  dialog.innerHTML = `<div class="clas-v2-in">${clasV2Index >= clasV2Groups.length ? clasV2SummaryHtml() : clasV2GroupHtml()}</div>`;
  clasV2Focus(dialog);
}

function clasV2StartBatch() {
  clasV2Groups = clasV2PendingGroups().filter((group) => !clasV2Skipped.has(group.key)).slice(0, CLAS_V2_MAX);
  clasV2Index = 0;
  clasV2Choice = "";
  clasV2OtherOpen = false;
}

function clasificarV2Open(opener = null) {
  const dialog = qs("clasificarV2");
  if (!dialog) return;
  clasV2Opener = opener;
  clasV2Skipped = new Set();
  clasV2Created = [];
  clasV2StartBatch();
  clasV2BindOnce(dialog);
  clasV2Render();
  globalThis.FinanceMedidor?.anotar("clasificar-v2", "vista"); // XGO-02
  if (typeof dialog.showModal === "function" && !dialog.open) dialog.showModal();
  clasV2Focus(dialog);
}

// Los reales que la regla va a recalcular (partida × mes de cada movimiento, salvo meses cerrados y compras
// provisionales con tarjeta, igual que applyMovementMappingsToActuals), con su valor de antes: deshacer los devuelve.
function clasV2TouchedActuals(group, target) {
  const store = group.kind === "income" ? incomeActuals : expenseActuals;
  const touched = new Map();
  group.rows.forEach((row) => {
    if (row.source === "captura-hoja") return;
    const month = monthByKey(row.month, baseData.monthlyPlanning?.months || []);
    if (!month || isClosedMonthKey(month.key)) return;
    const key = actualKeyForRow(target, month);
    if (!touched.has(key)) touched.set(key, { key, had: Object.prototype.hasOwnProperty.call(store, key), value: store[key] });
  });
  return [...touched.values()];
}

// Misma secuencia que handleMovementsBulkApply tras escribir en el diccionario.
function clasV2Persist(keys) {
  saveMovementMappings();
  const applied = applyMovementMappingsToActuals();
  pendingMovementMappings = buildPendingMovementMappings(baseData.transactions || []);
  datosImportarRefreshRowsForMappings(keys);
  saveIncomeActuals();
  saveExpenseActuals();
  refreshAllSectionsAfterDataChange();
  return applied;
}

function clasV2Accept() {
  const group = clasV2Groups[clasV2Index];
  const target = clasV2Target(group);
  if (!group || !target) return;
  const partida = displayLabelForRow(target);
  const rule = { key: group.key, kind: group.kind, name: group.name, partida, count: group.rows.length, prev: movementMappings[group.key], touched: clasV2TouchedActuals(group, target) };
  movementMappings[group.key] = { kind: group.kind, rowKey: seriesKeyForRow(target), label: `${target.sectionName} · ${partida}`, updatedAt: new Date().toISOString() };
  const applied = clasV2Persist(new Set([group.key]));
  clasV2Created.push(rule);
  globalThis.FinanceMedidor?.anotar("clasificar-v2", "accion"); // XGO-02
  showUndoToast(`Regla «${group.name} → ${partida}» creada.`, () => clasV2Undo(rule));
  announceStatus(`Regla «${group.name} → ${partida}» creada: ${rule.count} movimiento(s). ${applied} importe(s) reales recalculados desde movimientos.`);
  clasV2Next();
}

// Vale desde el aviso aunque el panel ya se haya cerrado o vaya por otra tanda: cada regla se deshace una sola vez.
function clasV2Undo(rule) {
  if (!rule || rule.undone) return;
  rule.undone = true;
  if (rule.prev) movementMappings[rule.key] = rule.prev;
  else delete movementMappings[rule.key];
  const store = rule.kind === "income" ? incomeActuals : expenseActuals;
  rule.touched.forEach(({ key, had, value }) => {
    if (had) store[key] = value;
    else delete store[key];
  });
  clasV2Created = clasV2Created.filter((item) => item !== rule);
  clasV2Persist(new Set([rule.key]));
  globalThis.FinanceMedidor?.anotar("clasificar-v2", "deshecho"); // XGO-02
  announceStatus(`Regla «${rule.name} → ${rule.partida}» deshecha: sus movimientos vuelven a la bandeja.`);
  if (qs("clasificarV2")?.open) clasV2Render();
}

function clasV2Skip() {
  const group = clasV2Groups[clasV2Index];
  if (!group) return;
  clasV2Skipped.add(group.key);
  globalThis.FinanceMedidor?.anotar("clasificar-v2", "descarte"); // XGO-02
  clasV2Next();
}

function clasV2Next() {
  clasV2Index += 1;
  clasV2Choice = "";
  clasV2OtherOpen = false;
  clasV2Render();
}

function clasV2Close() {
  qs("clasificarV2")?.close?.();
}

function clasV2BindOnce(dialog) {
  if (dialog.dataset.bound) return;
  dialog.dataset.bound = "1";
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog || event.target.closest("[data-clas-v2-cerrar]")) return clasV2Close();
    if (event.target.closest("[data-clas-v2-aceptar]")) return clasV2Accept();
    if (event.target.closest("[data-clas-v2-saltar]")) return clasV2Skip();
    const alt = event.target.closest("[data-clas-v2-alt]");
    if (alt) {
      clasV2Choice = clasV2Choice === alt.dataset.clasV2Alt ? "" : alt.dataset.clasV2Alt;
      return clasV2Render();
    }
    if (event.target.closest("[data-clas-v2-otra]")) {
      clasV2OtherOpen = true;
      clasV2Render();
      return qs("clasificarV2Otra")?.focus();
    }
    const undo = event.target.closest("[data-clas-v2-deshacer]");
    if (undo) return clasV2Undo(clasV2Created[Number(undo.dataset.clasV2Deshacer)]);
    if (event.target.closest("[data-clas-v2-otra-tanda]")) {
      clasV2Created = [];
      clasV2StartBatch();
      return clasV2Render();
    }
  });
  dialog.addEventListener("change", (event) => {
    if (!event.target.matches("[data-clas-v2-otra-select]")) return;
    clasV2Choice = event.target.value;
    clasV2Render();
  });
  // Atajos del handoff (§5b): ↵ acepta (es el botón con el foco), 1-3 eligen alternativa, S salta, ⌘Z/Ctrl+Z deshace.
  dialog.addEventListener("keydown", (event) => {
    if (event.target.matches("select, input")) return;
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
      event.preventDefault();
      return clasV2Undo(clasV2Created.at(-1));
    }
    if (event.metaKey || event.ctrlKey || event.altKey || clasV2Index >= clasV2Groups.length) return;
    if (event.key.toLowerCase() === "s") return clasV2Skip();
    const alt = dialog.querySelectorAll("[data-clas-v2-alt]")[Number(event.key) - 1];
    if (alt) alt.click();
  });
  dialog.addEventListener("close", () => {
    dialog.innerHTML = "";
    clasV2Groups = [];
    const opener = clasV2Opener;
    clasV2Opener = null;
    globalThis.movimientosV2Render?.();
    (opener?.isConnected ? opener : qs("movimientosV2")?.querySelector("[data-mov-v2-clasificar], h1, h2"))?.focus?.();
  });
}

globalThis.clasificarV2Open = clasificarV2Open;
