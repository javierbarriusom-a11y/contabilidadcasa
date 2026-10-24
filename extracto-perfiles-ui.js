// WP-51 (ND-04, docs/WP51_DISENO.md): el panel «Cómo he leído este fichero» del paso 1 de Registrar › Importar extracto. La lectura vive en canonical-statement-profiles.js (puro); aquí se guarda el
// último fichero leído (solo en memoria: el contenido de un extracto no se guarda en ningún almacén), se enseña lo que se dedujo (separador, decimal, orden de fechas, papel de cada columna), las cinco
// primeras filas ya interpretadas y las filas que NO se pudieron leer con su número y su motivo; el hogar puede corregir cualquier deducción y guardar el resultado como perfil con nombre
// (almacén `statement-profiles-data`, en la copia). No escribe nada en el libro: solo cambia cómo se interpretan los movimientos que luego recorre el asistente de cuatro pasos de siempre.
//
// Script de pantalla: se carga antes de app.js y comparte su ámbito global (qs, escapeHtml, money, formatIsoDate, estadoHtml, storageGet, storageSet, storageKey, queueRemoteSave, announceStatus, showUndoToast…). Sin llamadas al DOM ni escuchas al cargarse.
// app.js llama a `extractoPerfilesLeer` al cargar un CSV y pinta `extractoPerfilesHtml` dentro de `#extractoPerfilesPanel`; las correcciones llaman de nuevo a `handleDatosImportarFile` con el mismo fichero.

const EXTRACTO_PERFILES_STORE = "statement-profiles-data"; // en la copia (BACKUP_LOCAL_STORES): { profiles: [...] }

let extractoPerfilesUltima = null; // { file, key, analysis, overrides, abierto } — solo en memoria
let extractoPerfilesMotor = null; // el motor puro, que app.js pasa al leer un fichero

function extractoPerfilesEngine() {
  return extractoPerfilesMotor || globalThis.FinanceCanonicalStatementProfiles;
}

function extractoPerfilesLoad() {
  let saved = {};
  try { saved = JSON.parse(storageGet(storageKey(EXTRACTO_PERFILES_STORE), "{}")) || {}; } catch { saved = {}; }
  return extractoPerfilesEngine().normalizeProfiles(saved.profiles);
}

function extractoPerfilesSave(profiles) {
  storageSet(storageKey(EXTRACTO_PERFILES_STORE), JSON.stringify({ profiles }));
  queueRemoteSave();
}

// Lee un CSV con los perfiles guardados y las correcciones que el hogar haya fijado para ESTE fichero (mismo nombre y tamaño); otro fichero empieza sin correcciones.
function extractoPerfilesLeer(file, bytes, motor) {
  extractoPerfilesMotor = motor || extractoPerfilesMotor;
  const engine = extractoPerfilesEngine();
  const key = `${file.name}|${bytes.length}`;
  const same = extractoPerfilesUltima && extractoPerfilesUltima.key === key ? extractoPerfilesUltima : null;
  const overrides = same ? same.overrides : {};
  const analysis = engine.analyze(bytes, { overrides, profiles: extractoPerfilesLoad() });
  extractoPerfilesUltima = { file, key, analysis, overrides, abierto: same ? same.abierto : false }; // abierto: tras corregir algo, el panel no se cierra solo
  return analysis;
}

function extractoPerfilesOlvidar() {
  extractoPerfilesUltima = null;
}

function extractoPerfilesSelect(name, current, options, label = "") {
  return `<select data-epf-ajuste="${name}"${label ? ` aria-label="${escapeHtml(label)}"` : ""}>${options.map(([value, label]) => `<option value="${escapeHtml(value)}"${String(current) === String(value) ? " selected" : ""}>${escapeHtml(label)}</option>`).join("")}</select>`;
}

function extractoPerfilesMotivo(error) {
  return `Fila ${error.line}: ${escapeHtml(error.reason)}${error.detail ? ` («${escapeHtml(String(error.detail).slice(0, 40))}»)` : ""}`;
}

function extractoPerfilesAjustesHtml(engine, analysis) {
  const roleOptions = [["", "Sin papel"], ...engine.ROLES.map((role) => [role, engine.ROLE_LABEL[role]])];
  const delimiters = engine.DELIMITERS.map((d) => [d, engine.DELIM_LABEL[d]]);
  const columns = (analysis.columns || []).map((column) => `<tr><th scope="row">${escapeHtml(column.header || `Columna ${column.index + 1}`)}</th><td>${extractoPerfilesSelect(`col-${column.index}`, column.role, roleOptions, `Papel de ${column.header ? `la columna «${column.header}»` : `la columna ${column.index + 1}`}`)}</td></tr>`).join("");
  return `<div class="epf-ajustes">
    <label>Separador ${extractoPerfilesSelect("delimiter", analysis.delimiter || "", delimiters)}</label>
    <label>Decimal ${extractoPerfilesSelect("decimal", analysis.decimal || "comma", [["comma", "Coma (1.234,56)"], ["dot", "Punto (1,234.56)"]])}</label>
    <label>Fechas ${extractoPerfilesSelect("dateOrder", analysis.dateOrder || "DMY", [["DMY", "Día/mes/año"], ["MDY", "Mes/día/año"]])}</label>
    <label>Fila de la cabecera <input type="number" min="0" max="999" inputmode="numeric" data-epf-ajuste="headerLine" value="${analysis.headerLine ?? 0}" /></label>
    <label class="epf-check"><input type="checkbox" data-epf-ajuste="invertSign"${analysis.invertSign ? " checked" : ""} /> Invertir el signo de los importes</label>
  </div>${columns ? `<table class="epf-columnas"><caption>Papel de cada columna</caption><tbody>${columns}</tbody></table>` : ""}`;
}

function extractoPerfilesPerfilesHtml(profiles, analysis) {
  const list = profiles.length
    ? `<ul class="epf-perfiles">${profiles.map((p) => `<li><span>${escapeHtml(p.name)}</span><button type="button" class="epf-boton" data-epf-borrar="${escapeHtml(p.name)}">Quitar</button></li>`).join("")}</ul>`
    : `<p class="epf-nota">Aún no hay perfiles guardados.</p>`;
  const nameDefault = escapeHtml(String(extractoPerfilesUltima?.file?.name || "Extracto").replace(/\.[^.]+$/, "").slice(0, 40));
  const save = analysis.ok && !String(analysis.signature || "").startsWith("sin-cabecera")
    ? `<form class="epf-guardar" data-epf-guardar novalidate><label>Nombre del perfil <input name="nombre" maxlength="60" value="${nameDefault}" /></label><button type="submit" class="epf-boton">Guardar como perfil</button><p class="epf-error" role="alert" data-epf-error></p></form>`
    : `<p class="epf-nota">El perfil se guarda cuando el fichero se lee y tiene fila de cabecera.</p>`;
  return `<h4 class="epf-subtitulo">Perfiles guardados</h4>${list}${save}`;
}

function extractoPerfilesHtml() {
  const engine = extractoPerfilesEngine();
  const state = extractoPerfilesUltima;
  if (!engine || !state) return "";
  attachExtractoPerfiles(document); // idempotente: un cambio temprano no puede perderse
  const session = typeof datosImportarSession !== "undefined" ? datosImportarSession : null;
  const analysis = state.analysis;
  // Con la sesión ya clasificando (paso ≥ 2) no se toca la lectura: cambiarla rehace las filas y perdería las decisiones.
  if (session ? (session.step || 1) > 1 || session.fileMeta?.fileName !== state.file.name : analysis.ok) return "";
  const errors = analysis.errors || [];
  const attention = !analysis.ok || errors.length > 0 || (analysis.warnings || []).some((w) => w.code !== "perfil" && w.code !== "codificacion") || (analysis.balanceCheck && analysis.balanceCheck.status !== "cuadra" && analysis.balanceCheck.status !== "sin-datos");
  const head = analysis.ok
    ? `<p class="epf-estado ${attention ? "is-aviso" : "is-ok"}"><span aria-hidden="true">${attention ? "⚠" : "✔"}</span> ${analysis.transactions.length} ${analysis.transactions.length === 1 ? "movimiento leído" : "movimientos leídos"}${errors.length ? ` · ${errors.length} ${errors.length === 1 ? "fila" : "filas"} sin leer` : ""}</p>`
    : estadoHtml({ kind: "error", titulo: "No he podido leer el fichero", texto: analysis.failure?.reason || "", detalle: "Corrige la lectura aquí debajo o copia el diagnóstico." });
  const warnings = (analysis.warnings || []).filter((w) => w.code !== "filas-con-error").map((w) => `<li>${escapeHtml(w.text)}</li>`).join("");
  const preview = (analysis.preview || []).length
    ? `<table class="epf-previa"><caption>Así he interpretado las primeras filas</caption><thead><tr><th scope="col">Fecha</th><th scope="col">Concepto</th><th scope="col">Importe</th><th scope="col">Saldo</th></tr></thead><tbody>${analysis.preview.map((t) => `<tr><td>${escapeHtml(formatIsoDate(t.date))}</td><td>${escapeHtml(t.movement)}</td><td>${escapeHtml(money(t.amount, true))}</td><td>${t.balance === null ? "—" : escapeHtml(money(t.balance, true))}</td></tr>`).join("")}</tbody></table>`
    : "";
  const sample = !analysis.ok && analysis.sample ? `<table class="epf-previa"><caption>Primeras filas del fichero</caption><tbody>${analysis.sample.map((cells) => `<tr>${cells.map((c) => `<td>${escapeHtml(String(c).slice(0, 30))}</td>`).join("")}</tr>`).join("")}</tbody></table>` : "";
  const errorList = errors.length
    ? `<h4 class="epf-subtitulo">Filas que no se importarán</h4><ul class="epf-errores">${errors.slice(0, 20).map((e) => `<li>${extractoPerfilesMotivo(e)}</li>`).join("")}</ul>${errors.length > 20 ? `<p class="epf-nota">Y ${errors.length - 20} más (se listan las 20 primeras).</p>` : ""}`
    : "";
  return `<details class="epf"${attention || state.abierto ? " open" : ""}>
    <summary>Cómo he leído «${escapeHtml(state.file.name)}»</summary>
    ${head}${analysis.profile ? `<p class="epf-nota">Perfil aplicado: <strong>${escapeHtml(analysis.profile)}</strong>.</p>` : ""}
    ${warnings ? `<ul class="epf-avisos">${warnings}</ul>` : ""}${preview}${sample}${errorList}
    <h4 class="epf-subtitulo">Corregir la lectura</h4>${extractoPerfilesAjustesHtml(engine, analysis)}
    <div class="epf-acciones"><button type="button" class="epf-boton" data-epf-copiar>Copiar diagnóstico</button></div>
    <textarea class="epf-diagnostico" readonly hidden aria-label="Diagnóstico para copiar" rows="8"></textarea>
    <p class="epf-nota">El diagnóstico lleva la estructura (formatos, columnas, números de fila y motivos), nunca los conceptos, importes ni fechas del fichero.</p>
    ${extractoPerfilesPerfilesHtml(extractoPerfilesLoad(), analysis)}
  </details>`;
}

function renderExtractoPerfiles() {
  const host = qs("extractoPerfilesPanel");
  if (host) host.innerHTML = extractoPerfilesHtml();
}

// Relee el mismo fichero con las correcciones vigentes: reutiliza el cargador del asistente (que vuelve a crear la sesión desde cero; solo se permite en el paso 1).
function extractoPerfilesRelee() {
  const state = extractoPerfilesUltima;
  if (!state || typeof handleDatosImportarFile !== "function") return;
  handleDatosImportarFile({ target: { files: [state.file], value: "" } }).then(renderExtractoPerfiles);
}

function extractoPerfilesAplicarAjuste(target) {
  const state = extractoPerfilesUltima;
  if (!state) return;
  const name = target.getAttribute("data-epf-ajuste");
  state.abierto = true;
  const next = { ...state.overrides };
  if (name.startsWith("col-")) {
    const roles = (state.analysis.columns || []).map((column) => column.role);
    roles[Number(name.slice(4))] = target.value;
    next.columns = roles;
  } else if (name === "invertSign") next.invertSign = target.checked;
  else if (name === "headerLine") { const n = Number(target.value); if (!Number.isInteger(n) || n < 0) return; next.headerLine = n; delete next.columns; } else {
    next[name] = target.value;
    if (name === "delimiter") delete next.columns;
  }
  state.overrides = next;
  extractoPerfilesRelee();
}

async function extractoPerfilesCopiar(box) {
  const engine = extractoPerfilesEngine();
  const text = engine.diagnosticText(extractoPerfilesUltima.analysis);
  try {
    await navigator.clipboard.writeText(text);
    announceStatus("Diagnóstico copiado.");
  } catch {
    const area = box.querySelector(".epf-diagnostico");
    if (area) { area.hidden = false; area.value = text; area.focus(); area.select(); }
    announceStatus("No se pudo copiar solo: el diagnóstico está en el cuadro, cópialo a mano.");
  }
}

// Una sola vez, por delegación.
function attachExtractoPerfiles(doc) {
  if (!doc || doc.__extractoPerfilesAttached) return false;
  doc.__extractoPerfilesAttached = true;
  doc.addEventListener("change", (event) => {
    const target = event.target;
    if (target?.matches?.("[data-epf-ajuste]")) extractoPerfilesAplicarAjuste(target);
  });
  doc.addEventListener("submit", (event) => {
    const form = event.target;
    if (!form?.matches?.("[data-epf-guardar]")) return;
    event.preventDefault();
    const engine = extractoPerfilesEngine();
    const profile = engine.profileFromAnalysis(form.elements.nombre.value, extractoPerfilesUltima?.analysis);
    if (!profile) {
      const el = form.querySelector("[data-epf-error]");
      if (el) el.textContent = "Escribe un nombre para el perfil.";
      return;
    }
    extractoPerfilesSave(engine.upsertProfile(extractoPerfilesLoad(), profile));
    announceStatus(`Perfil «${profile.name}» guardado.`);
    renderExtractoPerfiles();
  });
  doc.addEventListener("click", (event) => {
    const remove = event.target?.closest?.("[data-epf-borrar]");
    const copy = event.target?.closest?.("[data-epf-copiar]");
    if (copy) { extractoPerfilesCopiar(copy.closest(".epf")); return; }
    if (!remove) return;
    const engine = extractoPerfilesEngine();
    const before = extractoPerfilesLoad();
    const name = remove.getAttribute("data-epf-borrar");
    extractoPerfilesSave(engine.removeProfile(before, name));
    renderExtractoPerfiles();
    showUndoToast(`Perfil «${name}» quitado.`, () => { extractoPerfilesSave(before); renderExtractoPerfiles(); });
  });
  return true;
}
