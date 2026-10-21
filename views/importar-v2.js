// Rediseño · fase A4, PR-2 (docs/rediseno/HANDOFF.md §5 «E1 · Importar», referencias/png/Importar.png e
// ImportarDesktop.png).
//
// Importar v2, en Registrar › Importar extracto: elegir el fichero, revisarlo con su cuadre y confirmar, con deshacer.
// Solo se ve con el tema v2 (<html data-tema="v2">); sin la bandera este fichero no pinta nada.
//
// No es un importador nuevo: es otra cara del mismo asistente (datosImportarSession, app.js). Lee el fichero con el
// mismo input y los mismos perfiles de extracto (WP-51), marca duplicados y capturas a mano con las mismas piezas
// (WP-53), importa con datosImportarApply dentro del mismo lote reversible y con la misma confirmación, y el cuadre
// sale del motor de saldos que ya existe (canonical-balance-pulse.js, statementContinuity). Lo que cambia, por decisión
// del hogar del 21/10/2026 (ESTADO.md §3b, P17 y P18):
//   · los duplicados SEGUROS (misma fecha, mismo importe y mismo concepto que algo ya registrado) se descartan solos,
//     tachados y con «No es duplicado»; los parecidos (otro día u otro texto) y las capturas a mano siguen preguntando;
//   · lo que no tiene partida se importa igual y espera en la bandeja de Movimientos («¿partida?»).
// El cuadre (P11): si el extracto trae saldos y no cuadran, no se importa; sin saldos, se importa con aviso.
// El asistente de siempre sigue entero tras «Ver el asistente de siempre».
// Lo que la referencia enseña y aún no existe (Compartir, XDA-02; pegar el texto del PDF, XDA-03; la cobertura tras
// importar, XDA-04) va plegado en una línea, sin construirlo aquí.
// Script clásico con defer, cargado antes de app.js (mismo scope global que el resto de views/*.js).

const IMP_V2_CLASSIC_CLASS = "imp-v2-clasico";
const IMP_V2_PREVIEW = 8;

let impV2ShowAll = false;

function impV2Active() {
  return document.documentElement.dataset.tema === "v2";
}

function impV2Icon(path) {
  return `<svg class="mov-v2-ico" viewBox="0 0 24 24" aria-hidden="true">${path}</svg>`;
}

function impV2ShortDate(iso) {
  const [, month, day] = String(iso || "").slice(0, 10).split("-");
  return day && month ? `${day}/${month}` : "—";
}

function impV2Amount(amount) {
  const value = Number(amount || 0);
  return `${value > 0 ? "+" : ""}${money(value, true)}`;
}

function impV2HasBalance(row) {
  return row && row.balance !== null && row.balance !== undefined && row.balance !== "" && Number.isFinite(Number(row.balance));
}

// Duplicado seguro: algo ya registrado con la misma fecha, el mismo importe y el mismo concepto. Otro día u otro texto
// puede ser un cargo legítimo repetido, así que esos siguen preguntando.
function impV2SafeDuplicate(row) {
  if (row.capturePair) return false;
  const tx = row.transaction;
  const key = movementMappingKey(tx);
  return (row.duplicates || []).some((existing) => existing.date === tx.date && round2(existing.amount) === round2(tx.amount) && movementMappingKey(existing) === key);
}

// Marca los duplicados seguros que aún no tienen decisión. Nunca pisa una decisión ya tomada: «No es duplicado» deja la
// fila en «distinto» y no se vuelve a marcar.
function impV2MarkSafeDuplicates(session) {
  let changed = false;
  session.rows.forEach((row) => {
    if (row.duplicateDecision || !impV2SafeDuplicate(row)) return;
    row.duplicateDecision = "duplicado";
    changed = true;
  });
  if (changed) datosImportarPersistDraft();
  return changed;
}

function impV2NeedsDecision(row) {
  return !row.duplicateDecision && (Boolean(row.capturePair) || (row.duplicates || []).length > 0);
}

function impV2Counts(session) {
  const rows = session.rows;
  const included = datosImportarIncludedTransactions(rows);
  const discarded = rows.filter((row) => row.duplicateDecision === "duplicado").length;
  const pending = rows.filter(impV2NeedsDecision).length;
  const withoutPartida = rows.filter((row) => row.duplicateDecision !== "duplicado" && row.duplicateDecision !== "misma" && row.prior?.status !== "regla-previa").length;
  return { included: included.length, discarded, pending, withoutPartida };
}

// Cuadre: saldo inicial + movimientos = saldo final. Las rupturas las da el motor de saldos (statementContinuity, que
// prueba los dos órdenes); las cifras, el orden que encadena sin rupturas.
function impV2Cuadre(session) {
  const rows = session.rows.map((row) => row.transaction);
  const withBalance = rows.filter((row) => impV2HasBalance(row) && Number.isFinite(Number(row.amount)));
  if (withBalance.length < 2) return { status: "sin-saldos" };
  const engine = globalThis.FinanceCanonicalBalancePulse;
  const continuity = engine?.statementContinuity ? engine.statementContinuity(rows) : { checked: 0, gaps: [] };
  if (continuity.gaps.length) return { status: "no-cuadra", gaps: continuity.gaps };
  const ordered = new Set(withBalance.map((row) => Number(row.statementOrder || 0))).size > 1
    ? withBalance.slice().sort((a, b) => Number(a.statementOrder || 0) - Number(b.statementOrder || 0))
    : withBalance.slice();
  const chains = (list) => list.every((row, index) => !index || Math.abs(round2(Number(list[index - 1].balance) + Number(row.amount)) - Number(row.balance)) <= 0.02);
  const chrono = chains(ordered) ? ordered : ordered.slice().reverse();
  const first = chrono[0];
  const last = chrono.at(-1);
  const initial = round2(Number(first.balance) - Number(first.amount));
  const final = round2(Number(last.balance));
  return { status: "cuadra", initial, final, movements: round2(final - initial), from: first.date, to: last.date };
}

function impV2State(row) {
  const tx = row.transaction;
  if (row.capturePair) {
    if (row.duplicateDecision === "misma") return { kind: "dup", text: "la misma compra que anotaste: se queda la del banco" };
    if (!row.duplicateDecision) return { kind: "duda", text: "¿Es la misma compra que anotaste a mano?", options: [["misma", "Es la misma"], ["distinto", "Son distintas"]] };
  } else if ((row.duplicates || []).length) {
    if (row.duplicateDecision === "duplicado") return { kind: "dup", text: impV2SafeDuplicate(row) ? "duplicado" : "duplicado (lo decidiste)", undo: true };
    if (!row.duplicateDecision) {
      const other = row.duplicates[0];
      return { kind: "duda", text: `¿Duplicado de «${movementDisplayName(other)}» del ${impV2ShortDate(other.date)}?`, options: [["duplicado", "Es duplicado"], ["distinto", "Son distintos"]] };
    }
  }
  if (row.prior?.status === "regla-previa" && row.prior.mapping) return { kind: "ok", text: displayLabelForRow(row.prior.mapping.row) };
  return { kind: "bandeja", text: Number(tx.amount) ? "sin partida: a la bandeja" : "importe 0" };
}

function impV2Line(row) {
  const tx = row.transaction;
  const state = impV2State(row);
  const options = state.options
    ? `<span class="imp-v2-opciones">${state.options.map(([value, label]) => `<button type="button" class="e19-btn e19-btn-secondary" data-imp-v2-dup="${value}" data-imp-v2-row="${escapeHtml(row.rowId)}">${escapeHtml(label)}</button>`).join("")}</span>`
    : "";
  const undo = state.undo ? ` <button type="button" class="imp-v2-link" data-imp-v2-dup="distinto" data-imp-v2-row="${escapeHtml(row.rowId)}">No es duplicado</button>` : "";
  return `<li class="imp-v2-linea is-${state.kind}">
    <span class="imp-v2-fecha">${escapeHtml(impV2ShortDate(tx.date))}</span>
    <span class="imp-v2-concepto"><span class="imp-v2-texto">${escapeHtml(movementDisplayName(tx))}</span><span class="imp-v2-estado">${escapeHtml(state.text)}${undo}</span>${options}</span>
    <span class="imp-v2-importe">${escapeHtml(impV2Amount(tx.amount))}</span>
  </li>`;
}

function impV2Header() {
  return `<button type="button" class="imp-v2-volver" data-imp-v2-nav="movements">${impV2Icon('<path d="m15 6-6 6 6 6"></path>')}Movimientos</button>
    <h3 class="mov-v2-title">Importar extracto</h3>`;
}

function impV2Pending(text) {
  return `<p class="mov-v2-pending"><span class="mov-v2-dot" aria-hidden="true"></span>${escapeHtml(text)}</p>`;
}

function impV2ClassicButton() {
  const open = qs("importarV2")?.closest("article")?.classList.contains(IMP_V2_CLASSIC_CLASS);
  return `<button type="button" class="e19-btn e19-btn-secondary mov-v2-detalle-btn" data-imp-v2-clasico aria-expanded="${Boolean(open)}">${open ? "Ocultar el asistente de siempre" : "Ver el asistente de siempre"}</button>`;
}

function impV2Sources() {
  const input = datosImportarTarget().fileInputId;
  return `<label class="mov-v2-card mov-v2-fila-bandeja imp-v2-fuente" for="${input}">
      <span class="mov-v2-av" aria-hidden="true">${impV2Icon('<path d="M4 5h16v14H4zM4 10h16M10 5v14"></path>')}</span>
      <span class="mov-v2-main"><strong>CSV o Excel</strong><span class="mov-v2-meta">El extracto que descargas del banco. El formato se detecta solo.</span></span>
      <span aria-hidden="true">›</span>
    </label>
    ${impV2Pending("Aún no: desde la app del banco con Compartir y pegar el texto del PDF.")}`;
}

function impV2CuadreHtml(cuadre) {
  if (cuadre.status === "sin-saldos") {
    return `<div class="mov-v2-card imp-v2-cuadre is-aviso"><div class="mov-v2-section-head"><h3>Cuadre</h3><span>sin saldos</span></div>
      <p class="mov-v2-meta">El extracto no trae saldos, así que no puedo comprobar que estén todos los movimientos. Se importa igual: si falta alguno, el cierre del mes lo verá.</p></div>`;
  }
  if (cuadre.status === "no-cuadra") {
    const where = cuadre.gaps.slice(0, 3).map((gap) => (gap.from === gap.to ? `el ${impV2ShortDate(gap.from)}` : `entre el ${impV2ShortDate(gap.from)} y el ${impV2ShortDate(gap.to)}`)).join("; ");
    return `<div class="mov-v2-card imp-v2-cuadre is-error" role="alert"><div class="mov-v2-section-head"><h3>Cuadre</h3><span>no cuadra</span></div>
      <p class="mov-v2-meta"><strong>No se importa:</strong> faltan movimientos ${escapeHtml(where)}${cuadre.gaps.length > 3 ? ` y en ${cuadre.gaps.length - 3} tramo(s) más` : ""} (el saldo no es el anterior más el movimiento). Descarga de nuevo ese tramo del banco.</p></div>`;
  }
  return `<div class="mov-v2-card imp-v2-cuadre"><div class="mov-v2-section-head"><h3>Cuadre</h3><span class="imp-v2-ok">cuadra al céntimo</span></div>
    <dl class="imp-v2-cuentas">
      <dt>Saldo inicial · ${escapeHtml(impV2ShortDate(cuadre.from))}</dt><dd>${escapeHtml(money(cuadre.initial, true))}</dd>
      <dt>Movimientos</dt><dd>${escapeHtml(impV2Amount(cuadre.movements))}</dd>
      <dt class="is-total">Saldo final · ${escapeHtml(impV2ShortDate(cuadre.to))}</dt><dd class="is-total">${escapeHtml(money(cuadre.final, true))}</dd>
    </dl>
    <p class="mov-v2-meta">Cada saldo del extracto es el anterior más su movimiento. Si no cuadrara, no se importaría.</p></div>`;
}

function impV2AccountSelect(session) {
  const options = ['<option value="">¿De qué cuenta es?</option>']
    .concat(DATOS_IMPORTAR_ACCOUNTS.map((account) => `<option value="${escapeHtml(account)}"${session.fileMeta.bankAccount === account ? " selected" : ""}>${escapeHtml(account)}</option>`))
    .join("");
  return `<label class="imp-v2-cuenta"><span class="mov-v2-meta">Cuenta</span><select id="importarV2Cuenta">${options}</select></label>`;
}

function impV2BalanceOffer(session) {
  const offer = typeof datosImportarBalanceOffer === "function" ? datosImportarBalanceOffer(session) : null;
  if (offer?.status !== "ofrecer") return "";
  return `<label class="imp-v2-saldo"><input type="checkbox" id="importarV2Saldo"${session.balanceOffer === false ? "" : " checked"} />
    <span>Usar ${escapeHtml(money(offer.value, true))} (${escapeHtml(impV2ShortDate(offer.date))}) como saldo de ${escapeHtml(offer.accountLabel)}.${offer.same ? " Es el que ya tenías: solo cambia la fecha." : ""}</span></label>`;
}

function impV2Review(session) {
  const counts = impV2Counts(session);
  const cuadre = impV2Cuadre(session);
  const summary = datosImportarFileSummary(session.rows.map((row) => row.transaction), session.fileMeta.sourceLabel);
  const ordered = session.rows.slice().sort((a, b) => Number(impV2NeedsDecision(b)) - Number(impV2NeedsDecision(a)) || String(b.transaction.date).localeCompare(String(a.transaction.date)));
  const shown = impV2ShowAll ? ordered : ordered.slice(0, IMP_V2_PREVIEW);
  const more = !impV2ShowAll && ordered.length > IMP_V2_PREVIEW ? `<button type="button" class="imp-v2-link imp-v2-todas" data-imp-v2-todas>Ver las ${ordered.length}</button>` : "";
  const blocked = cuadre.status === "no-cuadra" ? "el extracto no cuadra" : counts.pending ? `${counts.pending} ${counts.pending === 1 ? "posible duplicado" : "posibles duplicados"} por decidir` : !counts.included ? "no queda nada que importar" : "";
  const notes = [
    counts.discarded ? `${counts.discarded} ${counts.discarded === 1 ? "duplicado descartado" : "duplicados descartados"}` : "",
    counts.withoutPartida ? `${counts.withoutPartida} sin partida ${counts.withoutPartida === 1 ? "irá" : "irán"} a la bandeja` : "",
    "se puede deshacer",
  ].filter(Boolean).join(" · ");
  const warnings = [
    session.fileMeta.repeated ? `Ya importaste un fichero con el mismo contenido (${session.fileMeta.repeated.fileName}).` : "",
    summary.closedMonths.length ? `Toca ${summary.closedMonths.length} mes(es) ya cerrado(s): sus reales no cambian.` : "",
  ].filter(Boolean).map((text) => `<p class="mov-v2-meta is-warn">${escapeHtml(text)}</p>`).join("");
  return `<div class="imp-v2-grid">
      <section class="mov-v2-card imp-v2-lineas" aria-label="Líneas del extracto">
        <div class="imp-v2-lineas-head">
          <strong>${session.rows.length} ${session.rows.length === 1 ? "línea reconocida" : "líneas reconocidas"}</strong>
          <span class="mov-v2-meta">${escapeHtml(session.fileMeta.fileName)} · ${escapeHtml(impV2ShortDate(summary.from))}–${escapeHtml(impV2ShortDate(summary.to))}</span>
        </div>
        ${warnings}
        <ul class="imp-v2-lista">${shown.map(impV2Line).join("")}</ul>
        ${more}
      </section>
      <div class="imp-v2-lado">
        ${impV2AccountSelect(session)}
        ${impV2CuadreHtml(cuadre)}
        ${impV2BalanceOffer(session)}
        <button type="button" class="e19-btn e19-btn-primary imp-v2-importar" data-imp-v2-importar${blocked ? ` disabled aria-describedby="importarV2Bloqueo"` : ""}>Importar ${counts.included} ${counts.included === 1 ? "movimiento" : "movimientos"}</button>
        <p class="mov-v2-meta imp-v2-nota" id="importarV2Bloqueo">${escapeHtml(blocked ? `No se puede importar todavía: ${blocked}.` : notes)}</p>
        <button type="button" class="imp-v2-link" data-imp-v2-otro>Elegir otro fichero</button>
      </div>
    </div>`;
}

function impV2Success(result) {
  return `<div class="mov-v2-card mov-v2-vacio" role="status">
    <span class="mov-v2-av is-pos" aria-hidden="true">${impV2Icon('<path d="m5 12.5 4.5 4.5L19 7.5"></path>')}</span>
    <h3>${result.imported} ${result.imported === 1 ? "movimiento importado" : "movimientos importados"}</h3>
    <p class="mov-v2-meta">De «${escapeHtml(result.fileName || "")}».${result.duplicadosDescartados ? ` ${result.duplicadosDescartados} duplicado(s) descartado(s).` : ""}${result.capturasSustituidas ? ` ${result.capturasSustituidas} anotado(s) a mano sustituido(s) por su fila del banco.` : ""}${result.balance ? ` Saldo de ${escapeHtml(result.balance.account)}: ${escapeHtml(money(result.balance.value, true))}.` : ""} Lo que no tiene partida te espera en la bandeja de Movimientos.</p>
    <div class="imp-v2-acciones">
      <button type="button" class="e19-btn e19-btn-primary" data-imp-v2-nav="movements">Ver en Movimientos</button>
      <button type="button" class="e19-btn e19-btn-secondary" data-imp-v2-deshacer>Deshacer</button>
      <button type="button" class="imp-v2-link" data-imp-v2-otro>Importar otro</button>
    </div>
  </div>`;
}

// «Deshacer» es el «Deshacer último lote» de siempre (con su confirmación). Si el lote se deshizo, se vuelve a empezar.
async function impV2Undo() {
  const batchId = datosImportarLastResult?.batchId;
  await undoLastImportBatch();
  if (batchId && !importBatches.some((batch) => batch.id === batchId && batch.status === "applied")) {
    datosImportarLastResult = null;
    renderDatosImportar();
  }
}

function impV2Navigate(target) {
  if (!document.getElementById(target)?.classList.contains("view-section")) return;
  history.pushState(null, "", `#${target}`);
  setActiveView(target);
}

function impV2BindOnce(root) {
  if (root.dataset.bound) return;
  root.dataset.bound = "1";
  root.addEventListener("click", (event) => {
    const nav = event.target.closest("[data-imp-v2-nav]");
    if (nav) return impV2Navigate(nav.dataset.impV2Nav);
    const dup = event.target.closest("[data-imp-v2-dup]");
    if (dup) {
      const row = datosImportarSession?.rows.find((item) => item.rowId === dup.dataset.impV2Row);
      if (!row) return;
      row.duplicateDecision = dup.dataset.impV2Dup;
      datosImportarPersistDraft();
      return importarV2Render();
    }
    if (event.target.closest("[data-imp-v2-todas]")) {
      impV2ShowAll = true;
      return importarV2Render();
    }
    if (event.target.closest("[data-imp-v2-importar]")) return handleDatosImportarConfirmar();
    if (event.target.closest("[data-imp-v2-deshacer]")) return impV2Undo();
    if (event.target.closest("[data-imp-v2-otro]")) {
      extractoPerfilesOlvidar();
      datosImportarSession = null;
      datosImportarLastResult = null;
      datosImportarClearDraft();
      impV2ShowAll = false;
      return renderDatosImportar();
    }
    if (event.target.closest("[data-imp-v2-clasico]")) {
      root.closest("article")?.classList.toggle(IMP_V2_CLASSIC_CLASS);
      renderDatosImportar(); // el asistente de siempre se repinta con las decisiones tomadas aquí
    }
  });
  root.addEventListener("change", (event) => {
    if (!datosImportarSession) return;
    if (event.target.id === "importarV2Cuenta") {
      datosImportarSession.fileMeta.bankAccount = event.target.value || "";
      datosImportarPersistDraft();
      importarV2Render();
    } else if (event.target.id === "importarV2Saldo") {
      datosImportarSession.balanceOffer = event.target.checked;
      datosImportarPersistDraft();
    }
  });
}

function importarV2Render() {
  const root = qs("importarV2");
  if (!root) return;
  const article = root.closest("article");
  if (!impV2Active()) {
    root.hidden = true;
    root.innerHTML = "";
    article?.classList.remove("imp-v2-pintado");
    return;
  }
  impV2BindOnce(root);
  let body;
  if (datosImportarLastResult) {
    body = impV2Success(datosImportarLastResult);
  } else if (datosImportarSession) {
    // Con el asistente de siempre abierto, se decide allí como siempre (uno a uno); los seguros solo se marcan aquí.
    if (!article?.classList.contains(IMP_V2_CLASSIC_CLASS)) impV2MarkSafeDuplicates(datosImportarSession);
    body = impV2Review(datosImportarSession);
  } else {
    impV2ShowAll = false;
    body = impV2Sources();
  }
  root.innerHTML = `${impV2Header()}${body}${impV2ClassicButton()}`;
  root.hidden = false;
  article?.classList.add("imp-v2-pintado");
}

globalThis.importarV2Render = importarV2Render;
