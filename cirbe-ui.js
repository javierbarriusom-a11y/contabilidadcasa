// WP-40 (DAC-01, docs/WP40_DISENO.md): la tarjeta «Conciliación con la CIRBE» de Deuda › Contratos. El cálculo vive en canonical-cirbe.js (puro); aquí se
// guarda lo que el hogar teclea del informe en el almacén `cirbe-report`, se leen los contratos que ya hay en la app, se pinta la conciliación fila a fila
// y se atiende el formulario de filas. NO se conecta a la CIRBE, NO escribe en los contratos (A11-4): «Añadir a Contratos» solo rellena el formulario de alta
// que ya existe, y quien lo envía decide. Tampoco va a Hoy (congelado hasta leer H-02).
//
// Script de pantalla: se carga antes de app.js y comparte su ámbito global (qs, money, escapeHtml, storageGet, isoLocalDate, announceStatus, estadoHtml,
// showUndoToast, canonicalDebtContractRows, loanGuaranteeMonthly…). Sin llamadas al DOM ni escuchas al cargarse: app.js llama a `renderCirbe` al pintar
// Deuda › Contratos, que engancha las escuchas la primera vez.

const CIRBE_STORE = "cirbe-report"; // en la copia (BACKUP_LOCAL_STORES)
const CIRBE_STATE_TEXT = { fits: "✓ Cuadra", differs: "◐ Difiere", "missing-in-app": "⚠ Falta en la app", "guarantee-manual": "◐ Aval: revisar a mano" };
let cirbeLastPersona = ""; // la misma persona suele teclear varias filas seguidas
const CIRBE_TYPE_FOR_FORM = { prestamo: "Préstamo", hipoteca: "Hipoteca", tarjeta: "Crédito", otro: "Otro" };

function cirbeEngine() {
  return globalThis.FinanceCanonicalCirbe;
}

function cirbeLoad() {
  let saved = null;
  try { saved = JSON.parse(storageGet(storageKey(CIRBE_STORE), "null")); } catch { saved = null; }
  return cirbeEngine().normalizeStore(saved);
}

function cirbeSave(store) {
  storageSet(storageKey(CIRBE_STORE), JSON.stringify({ ...store, updatedAt: isoLocalDate(new Date()) }));
  queueRemoteSave();
}

function cirbeDate(iso) {
  const [year, month, day] = String(iso).slice(0, 10).split("-").map(Number);
  return `${day}/${month}/${year}`;
}

function cirbeEuros(value) {
  return money(value, true);
}

function cirbeReportHtml(report, store) {
  if (report.state === "none") return "";
  const since = `Informe del ${cirbeDate(store.reportDate)}.`;
  if (report.state === "overdue") return `<p class="cir-aviso" role="status"><strong>El informe tiene más de un año.</strong> ${since} Los importes de la app han cambiado con las cuotas desde entonces: pide uno nuevo antes de fiarte de esta comparación.</p>`;
  if (report.state === "renew-soon") return `<p class="cir-aviso" role="status"><strong>Toca pedir el informe otra vez.</strong> ${since} Se cumple el año el ${cirbeDate(report.dueOn)}.</p>`;
  return `<p class="e19-kpi-note">${since} Tiene ${report.ageDays} ${report.ageDays === 1 ? "día" : "días"}; conviene pedirlo otra vez el ${cirbeDate(report.renewOn)}.</p>`;
}

function cirbeItemHtml(item) {
  const row = item.row;
  const who = `${cirbeEngine().TITULARIDADES[row.titularidad]}${row.reportOf ? ` · informe de ${row.reportOf}` : ""}${row.inBothReports ? " · sale en los dos informes (cuenta una vez)" : ""}`;
  const app = item.match
    ? `<p><strong>En la app:</strong> ${escapeHtml(item.match.entity)} · ${escapeHtml(item.match.type)} · ${cirbeEuros(item.match.principal)}${item.kindMismatch ? " <em>(el tipo no coincide con el del informe)</em>" : ""}</p>`
    : `<p><strong>En la app:</strong> nada que case con esta fila.</p>`;
  const diff = item.state === "differs" ? `<p>La app tiene ${cirbeEuros(Math.abs(item.diff))} ${item.diff > 0 ? "más" : "menos"} que el informe${item.diff < 0 ? " (normal si has pagado cuotas desde su fecha)" : ""}.</p>` : "";
  const overdue = row.overdue > 0 ? `<p class="cir-vencido"><strong>El informe dice vencido: ${cirbeEuros(row.overdue)}.</strong></p>` : "";
  const note = item.note ? `<p class="e19-kpi-note">${escapeHtml(item.note)}</p>` : "";
  const add = item.state === "missing-in-app" && row.kind !== "aval"
    ? `<button type="button" class="e19-btn e19-btn-secondary" data-cirbe-anadir="${escapeHtml(row.id)}">Añadir a Contratos</button>` : "";
  return `<li class="cir-fila" data-cirbe-estado="${escapeHtml(item.state)}">
      <p class="cir-cabecera"><span class="cir-estado">${escapeHtml(CIRBE_STATE_TEXT[item.state])}</span> <strong>${escapeHtml(row.entity)}</strong> <span>${escapeHtml(cirbeEngine().KINDS[row.kind])}</span> <span>${cirbeEuros(row.amount)}</span></p>
      <p class="e19-kpi-note">${escapeHtml(who)}</p>${app}${diff}${overdue}${note}${add}
    </li>`;
}

function cirbeResultHtml(result, store) {
  const s = result.summary;
  const parts = [
    `${s.fits} ${s.fits === 1 ? "cuadra" : "cuadran"}`,
    `${s.differs} ${s.differs === 1 ? "difiere" : "difieren"}`,
    `${s.missingInApp} ${s.missingInApp === 1 ? "falta" : "faltan"} en la app`,
    ...(s.guaranteeManual ? [`${s.guaranteeManual} ${s.guaranteeManual === 1 ? "aval" : "avales"} a revisar a mano`] : []),
  ];
  const head = s.allClean
    ? `<p class="cir-resumen" data-cirbe-resumen="clean"><span aria-hidden="true">✓</span> <strong>Todo cuadra:</strong> ${s.operations} ${s.operations === 1 ? "operación" : "operaciones"} del informe y ningún contrato de la app sin aparecer.</p>`
    : `<p class="cir-resumen" data-cirbe-resumen="open"><strong>De ${s.operations} ${s.operations === 1 ? "operación" : "operaciones"} del informe: ${parts.join(", ")}.</strong></p>`;
  const totals = s.appTotal || s.cirbeTotal ? `<p class="e19-kpi-note">En lo que se ha podido casar: el informe suma ${cirbeEuros(s.cirbeTotal)} y la app ${cirbeEuros(s.appTotal)}.</p>` : "";
  // Primero lo que pide atención (falta, difiere, avales), y al final lo que cuadra.
  const order = { "missing-in-app": 0, differs: 1, "guarantee-manual": 2, fits: 3 };
  const sorted = result.items.slice().sort((a, b) => order[a.state] - order[b.state]);
  const items = `<ul class="cir-lista">${sorted.map(cirbeItemHtml).join("")}</ul>`;
  const missing = result.missingInReport.length
    ? `<h4 class="cir-sub">Contratos de la app que no salen en el informe</h4><ul class="cir-lista">${result.missingInReport.map((c) => `<li class="cir-fila" data-cirbe-estado="missing-in-report"><p class="cir-cabecera"><span class="cir-estado">◐ No sale en el informe</span> <strong>${escapeHtml(c.entity)}</strong> <span>${escapeHtml(c.type)}</span> <span>${cirbeEuros(c.principal)}</span></p></li>`).join("")}</ul>
      <p class="e19-kpi-note">No siempre es un error de la app: el informe no suele recoger préstamos entre particulares ni importes pequeños (el umbral habitual es de 1.000 €; compruébalo). Si es un préstamo de un banco, sí merece una pregunta.</p>` : "";
  return `${cirbeReportHtml(result.report, store)}${head}${totals}${items}${missing}`;
}

function cirbeRowsHtml(store) {
  if (!store.rows.length) return "";
  const rows = store.rows.map((row) => `<li>${escapeHtml(row.entity)} · ${escapeHtml(cirbeEngine().KINDS[row.kind])} · ${cirbeEuros(row.amount)}${row.overdue > 0 ? ` · vencido ${cirbeEuros(row.overdue)}` : ""} · ${escapeHtml(cirbeEngine().TITULARIDADES[row.titularidad])}${row.reportOf ? ` · ${escapeHtml(row.reportOf)}` : ""} <button type="button" class="link-button cir-quitar" data-cirbe-quitar="${escapeHtml(row.id)}" aria-label="Quitar la fila de ${escapeHtml(row.entity)}">Quitar</button></li>`).join("");
  return `<details class="cir-filas"><summary>Filas anotadas del informe (${store.rows.length})</summary><ul>${rows}</ul>
    <button type="button" class="e19-btn e19-btn-secondary" data-cirbe-borrar>Borrar el informe anotado</button></details>`;
}

function cirbeFormHtml(store, open) {
  const engine = cirbeEngine();
  const options = (map) => Object.entries(map).map(([key, label]) => `<option value="${key}">${escapeHtml(label)}</option>`).join("");
  return `<details class="cir-form"${open ? " open" : ""}><summary>Anotar el informe</summary>
    <p class="e19-kpi-note">El informe de la CIRBE lo pide cada persona en el Banco de España (es gratuito, con certificado digital o Cl@ve; <strong>verifica el procedimiento actual</strong>). Teclea una fila por operación: <strong>la app no se conecta a nada</strong>.</p>
    <label class="month-picker"><span>Fecha del informe</span><input type="date" id="cirbeFecha" value="${escapeHtml(store.reportDate)}" /></label>
    <form id="cirbeForm" novalidate>
      <div class="cuadro-mandos-controls">
        <label class="month-picker"><span>De quién es el informe</span><input type="text" id="cirbePersona" maxlength="40" autocomplete="off" placeholder="Ej. Ana" value="${escapeHtml(cirbeLastPersona)}" /></label>
        <label class="month-picker"><span>Entidad</span><input type="text" id="cirbeEntidad" maxlength="80" autocomplete="off" required /></label>
        <label class="month-picker"><span>Tipo de operación</span><select id="cirbeTipo">${options(engine.KINDS)}</select></label>
        <label class="month-picker"><span>Titularidad</span><select id="cirbeTitularidad">${options(engine.TITULARIDADES)}</select></label>
        <label class="month-picker"><span>Importe dispuesto (€)</span><input type="number" id="cirbeImporte" min="0" step="0.01" inputmode="decimal" /></label>
        <label class="month-picker"><span>Vencido (€, si lo hay)</span><input type="number" id="cirbeVencido" min="0" step="0.01" inputmode="decimal" /></label>
      </div>
      <p class="e19-kpi-note is-danger" id="cirbeError" role="alert" hidden></p>
      <button type="submit" class="e19-btn e19-btn-primary">Añadir fila</button>
    </form>
  </details>`;
}

function cirbeBodyHtml() {
  const engine = cirbeEngine();
  const store = cirbeLoad();
  const today = isoLocalDate(new Date());
  if (!store.rows.length) {
    return `${estadoHtml({ kind: "vacio", titulo: "Todavía no habéis traído el informe de la CIRBE", texto: "Una vez al año, compara lo que ve el Banco de España con lo que tiene la app: deudas que faltan, avales olvidados e importes que no cuadran. Se teclea una fila por operación.", accion: { label: "Anotar el informe", id: "cirbe-empezar" } })}${cirbeFormHtml(store, false)}`;
  }
  const contracts = typeof canonicalDebtContractRows === "function" ? canonicalDebtContractRows() : typeof debtContractSourceRows === "function" ? debtContractSourceRows() : [];
  const guaranteeMonthly = typeof loanGuaranteeMonthly === "function" ? loanGuaranteeMonthly() : 0;
  const result = engine.reconcile({ store, contracts, guaranteeMonthly, today });
  const body = result.status === "no-report"
    ? `<p class="cir-aviso" role="status"><strong>Falta la fecha del informe.</strong> Sin ella no se sabe cuántos días tiene ni cuándo toca renovarlo: ponla abajo, en «Anotar el informe».</p>`
    : cirbeResultHtml(result, store);
  return `${body}${cirbeFormHtml(store, result.status === "no-report")}${cirbeRowsHtml(store)}`;
}

function renderCirbe(engine, force = false) {
  const box = qs("cirbeCuerpo");
  if (!box || !engine) return;
  attachCirbe(document); // idempotente: un clic temprano no puede perderse
  // Mientras se escribe una fila no se repinta la tarjeta: perdería lo tecleado.
  if (!force && box.contains(document.activeElement) && ["INPUT", "SELECT"].includes(document.activeElement.tagName) && document.activeElement.id?.startsWith("cirbe")) return;
  try {
    const html = cirbeBodyHtml();
    if (box.__cirbeHtml !== html) {
      const openForm = box.querySelector(".cir-form")?.open;
      box.innerHTML = html;
      box.__cirbeHtml = html;
      if (openForm) box.querySelector(".cir-form")?.setAttribute("open", "");
    }
  } catch (error) {
    console.error(`renderCirbe: ${error.message}`);
  }
}

function cirbeRerender() {
  const box = qs("cirbeCuerpo");
  if (box) box.__cirbeHtml = null;
  renderCirbe(cirbeEngine(), true);
}

function cirbeNote(message) {
  const note = qs("cirbeNota");
  if (note) note.textContent = message;
  announceStatus(message);
}

function cirbeSubmit(event) {
  event.preventDefault();
  const engine = cirbeEngine();
  const error = qs("cirbeError");
  const raw = {
    entity: qs("cirbeEntidad")?.value,
    kind: qs("cirbeTipo")?.value,
    titularidad: qs("cirbeTitularidad")?.value,
    amount: qs("cirbeImporte")?.value,
    overdue: qs("cirbeVencido")?.value,
    reportOf: qs("cirbePersona")?.value,
    id: `cirbe-${Date.now().toString(36)}`,
  };
  const check = engine.validateRow(raw);
  if (!check.ok) {
    if (error) { error.textContent = check.reason; error.hidden = false; }
    announceStatus(check.reason);
    return;
  }
  const store = cirbeLoad();
  if (store.rows.length >= engine.MAX_ROWS) {
    if (error) { error.textContent = `Hay ya ${engine.MAX_ROWS} filas: es el máximo.`; error.hidden = false; }
    return;
  }
  cirbeLastPersona = raw.reportOf ? String(raw.reportOf).slice(0, 40) : cirbeLastPersona;
  const before = store;
  cirbeSave({ ...store, rows: [...store.rows, check.row] });
  cirbeRerender();
  qs("cirbeCuerpo")?.querySelector(".cir-form")?.setAttribute("open", "");
  cirbeNote(`Fila de ${check.row.entity} anotada.`);
  showUndoToast("Fila anotada.", () => { cirbeSave(before); cirbeRerender(); cirbeNote("Fila quitada."); });
}

// Rellena el formulario de alta que ya existe en la pantalla: no crea nada, quien lo envía decide.
function cirbeAddToContracts(id) {
  const row = cirbeLoad().rows.find((candidate) => candidate.id === id);
  if (!row) return;
  const entity = qs("deudaContratosAddEntity");
  const type = qs("deudaContratosAddType");
  const principal = qs("deudaContratosAddPrincipal");
  if (!entity || !type || !principal) return;
  entity.value = row.entity;
  type.value = CIRBE_TYPE_FOR_FORM[row.kind] || "Otro";
  principal.value = String(row.amount);
  entity.scrollIntoView?.({ block: "center" });
  entity.focus();
  cirbeNote(`Formulario de alta rellenado con ${row.entity}. Revísalo y envíalo si es una deuda vuestra.`);
}

// Una sola vez, por delegación.
function attachCirbe(doc) {
  if (!doc || doc.__cirbeAttached) return false;
  doc.__cirbeAttached = true;
  const inCard = (target) => target?.closest?.("#cirbeCard");
  doc.addEventListener("submit", (event) => { if (event.target?.id === "cirbeForm") cirbeSubmit(event); });
  doc.addEventListener("click", (event) => {
    const target = event.target;
    if (!inCard(target)) return;
    if (target.closest('[data-estado-accion="cirbe-empezar"]')) {
      const form = qs("cirbeCuerpo")?.querySelector(".cir-form");
      form?.setAttribute("open", "");
      qs("cirbeFecha")?.focus();
      return;
    }
    const add = target.closest("[data-cirbe-anadir]");
    if (add) { cirbeAddToContracts(add.dataset.cirbeAnadir); return; }
    const remove = target.closest("[data-cirbe-quitar]");
    if (remove) {
      const before = cirbeLoad();
      cirbeSave({ ...before, rows: before.rows.filter((row) => row.id !== remove.dataset.cirbeQuitar) });
      cirbeRerender();
      cirbeNote("Fila quitada.");
      showUndoToast("Fila quitada.", () => { cirbeSave(before); cirbeRerender(); cirbeNote("Fila recuperada."); });
      return;
    }
    if (target.closest("[data-cirbe-borrar]")) {
      const before = cirbeLoad();
      cirbeSave(cirbeEngine().defaultStore());
      cirbeRerender();
      cirbeNote("Informe borrado.");
      showUndoToast("Informe borrado.", () => { cirbeSave(before); cirbeRerender(); cirbeNote("Informe recuperado."); });
    }
  });
  doc.addEventListener("change", (event) => {
    if (event.target?.id !== "cirbeFecha" || !inCard(event.target)) return;
    const value = event.target.value;
    const store = cirbeLoad();
    cirbeSave({ ...store, reportDate: /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "" });
    cirbeRerender();
    qs("cirbeCuerpo")?.querySelector(".cir-form")?.setAttribute("open", "");
  });
  return true;
}
