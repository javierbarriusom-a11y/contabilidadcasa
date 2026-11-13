// XGO-01 · PR-4 (desalojo de app.js, 13/11/2026): Laboratorio («Funciones en prueba» de Ajustes, L-1…L-10, T-4, OPT-2) y el
// informe de uso de la app (ARQ-0), tal cual estaban en app.js, sin cambiar una coma. Se sacan para devolver a app.js el margen
// de ~130 líneas bajo su techo (ARQ-4, trinquete P7), que se había quedado en 25.
//
// Script de pantalla: se carga antes de app.js y comparte su ámbito global (qs, escapeHtml, storageGet/storageSet, monthClosures,
// announceStatus, LABORATORIO_CATALOG…). Solo declara funciones; las constantes (`LABORATORIO_VEREDICTOS`, las etiquetas y filtros,
// `LABORATORIO_PHASE_RETIRED`) y las variables (`laboratorioReadOnlySession`, `laboratorioSelectedHash`, `laboratorioFiltro`,
// `laboratorioViewMode`) siguen en app.js: alguna se inicializa con `LABORATORIO_CATALOG`, que se declara allí, y aquí aún no
// existiría al cargarse. Nada se ejecuta al cargarse: lo llama app.js al pintar Ajustes y al navegar.

function laboratorioCatalog() {
  return LABORATORIO_CATALOG;
}

function laboratorioOpenVerdicts(catalog = LABORATORIO_CATALOG) {
  return catalog.filter((entry) => !LABORATORIO_VEREDICTOS.includes(entry.veredicto));
}

function laboratorioVerdictSummary(catalog = LABORATORIO_CATALOG) {
  const summary = { total: catalog.length, adoptada: 0, sustituida: 0, descartada: 0, abiertos: laboratorioOpenVerdicts(catalog).length };
  catalog.forEach((entry) => { if (summary[entry.veredicto] !== undefined) summary[entry.veredicto] += 1; });
  return summary;
}

// L-2: "Adoptada exige tarea de backlog" — una heredada "adoptada" no es un "se queda, sin más": si
// alguien vuelve a preguntarse "¿y esto qué pasa con ello?", la respuesta tiene que ser una tarea
// real del backlog, no un encogimiento de hombros.
function laboratorioAdoptedWithoutTask(catalog = LABORATORIO_CATALOG) {
  return catalog.filter((entry) => entry.veredicto === "adoptada" && !entry.backlogTask);
}

// L-6: vista de lista con los destinos — una fila por heredada, con su veredicto y, si tiene, el
// destino real al que redirige. Es el toggle "Lista" del mockup, ordenable por veredicto.
function laboratorioListRows(catalog = LABORATORIO_CATALOG) {
  return catalog
    .slice()
    .sort((a, b) => a.veredicto.localeCompare(b.veredicto) || a.label.localeCompare(b.label, "es"))
    .map((entry) => ({
      hash: entry.hash,
      label: entry.label,
      veredicto: entry.veredicto,
      destino: entry.destino,
    }));
}

// L-3: panel de detalle por heredada — toda la ficha de una entrada del catálogo, para pintar tras
// seleccionarla en la tarjeta o en la lista.
function laboratorioDetailFor(hash, catalog = LABORATORIO_CATALOG) {
  return catalog.find((entry) => entry.hash === hash) || null;
}

function laboratorioFilterCounts(catalog = LABORATORIO_CATALOG) {
  const summary = laboratorioVerdictSummary(catalog);
  return { todas: summary.total, adoptada: summary.adoptada, sustituida: summary.sustituida, descartada: summary.descartada };
}

function laboratorioFilteredCatalog(catalog = LABORATORIO_CATALOG, filtro = "todas") {
  if (filtro === "todas") return catalog;
  return catalog.filter((entry) => entry.veredicto === filtro);
}

function laboratorioFilterChipsHtml(catalog, filtro) {
  const counts = laboratorioFilterCounts(catalog);
  return LABORATORIO_FILTROS.map(
    (key) =>
      `<button type="button" class="registrar-mes-filter${key === filtro ? " is-active" : ""}" data-laboratorio-filter="${key}" aria-pressed="${key === filtro ? "true" : "false"}">${LABORATORIO_FILTRO_LABEL[key]} · ${counts[key]}</button>`,
  ).join("");
}

// L-6, la vista de tarjetas del mockup (por defecto) — una tarjeta por heredada con su veredicto,
// dónde vive ahora y, si es adoptada, la tarea que la recoge.
function laboratorioCardsHtml(entries, selectedHash) {
  if (!entries.length) return `<p class="e19-kpi-note">Ninguna heredada con este veredicto.</p>`;
  return `<div class="laboratorio-cards">${entries
    .map(
      (entry) => `<button type="button" class="laboratorio-card${entry.hash === selectedHash ? " is-selected" : ""}" data-laboratorio-select="${escapeHtml(entry.hash)}">
        <div class="laboratorio-card-head">
          <div>
            <strong>${escapeHtml(entry.label)}</strong>
            <code>#${escapeHtml(entry.hash)}</code>
          </div>
          <span class="e19-badge ${LABORATORIO_VEREDICTO_BADGE[entry.veredicto] || "e19-badge-neutral"}">${LABORATORIO_VEREDICTO_LABEL[entry.veredicto] || entry.veredicto}</span>
        </div>
        <p>${escapeHtml(entry.dondeViveAhora || "—")}</p>
        <small>${entry.backlogTask ? `Recogida en ${escapeHtml(entry.backlogTask)}` : "Sin tarea propia"}</small>
      </button>`,
    )
    .join("")}</div>`;
}

function laboratorioListHtml(rows, selectedHash) {
  if (!rows.length) return `<p class="e19-kpi-note">Sin heredadas en el catálogo.</p>`;
  return `<div class="table-wrap"><table class="e19-table laboratorio-table">
    <thead><tr><th>Pantalla heredada</th><th>Veredicto</th><th>Destino</th></tr></thead>
    <tbody>${rows
      .map(
        (row) => `<tr class="${row.hash === selectedHash ? "is-selected" : ""}">
          <td><button type="button" class="laboratorio-row-select" data-laboratorio-select="${escapeHtml(row.hash)}">${escapeHtml(row.label)}</button></td>
          <td><span class="e19-badge ${LABORATORIO_VEREDICTO_BADGE[row.veredicto] || "e19-badge-neutral"}">${LABORATORIO_VEREDICTO_LABEL[row.veredicto] || row.veredicto}</span></td>
          <td>${row.destino ? `<button type="button" class="registrar-actuals-plan-link" data-home-nav="${escapeHtml(row.destino.hash)}">${escapeHtml(row.destino.label)}</button>` : "—"}</td>
        </tr>`
      )
      .join("")}</tbody>
  </table></div>`;
}

// L-4: "Instantánea fechada del último cierre" — el catálogo se lee siempre "a fecha de" el último
// cierre firmado y vigente (C-5/C-10), no "a fecha de hoy": un veredicto de gobernanza necesita un
// punto en el tiempo verificable y firmado, igual que la evidencia de C-12, no la hora del reloj del
// navegador de quien lo mira.
function laboratorioSnapshotContext(closures = monthClosures) {
  const rows = cierreVersionRows(closures).filter((row) => row.vigente && row.estado === "closed");
  const latest = rows.sort((a, b) => b.fecha.localeCompare(a.fecha))[0] || null;
  return latest
    ? { monthKey: latest.monthKey, monthLabel: ledgerMonthLabel(latest.monthKey), fecha: latest.fecha, autor: latest.autor }
    : null;
}

function laboratorioSnapshotNoteText(context) {
  return context
    ? `Instantánea del ${formatIsoDate(context.fecha.slice(0, 10))} (cierre de ${ledgerMonthLabel(context.monthKey)}, ${context.autor}).`
    : "Todavía no hay ningún mes cerrado y firmado: el catálogo se muestra sin instantánea fechada.";
}

// L-3, la ficha del mockup: Qué hacía / Dónde vive ahora / Recogida en / Instantánea del... / Abrir
// en solo lectura. La nota de desviación (las tres excepciones del bloque del catálogo) se muestra
// aparte, solo cuando existe, en vez de forzar el mismo texto en las quince que sí siguen el mockup.
// T-4: la ficha de cada heredada suma su contador de visitas — sin este dato, el veredicto de una
// "sustituida" es solo la impresión de quien la mira, no una cifra comprobable con el uso real.
function laboratorioVisitasText(entry) {
  const visitas = viewVisitSummary(entry.hash);
  if (!visitas.count) return "0 visitas registradas todavía.";
  const vecesText = visitas.count === 1 ? "1 vez" : `${visitas.count} veces`;
  return `Abierta ${vecesText} · última el ${escapeHtml(formatIsoDate(visitas.last))}.`;
}

// OPT-2: el contador de T-4 ya registra toda pantalla, heredada o nueva, pero su ficha solo
// enseñaba el lado heredado. Sin el lado nuevo al lado, "sustituida" seguía siendo la impresión de
// quien mira, no una comparación real de uso — este texto añade el segundo número que faltaba.
function laboratorioDestinoVisitasText(entry) {
  if (!entry.destino) return "";
  const visitas = viewVisitSummary(entry.destino.hash);
  if (!visitas.count) return `${entry.destino.label}: 0 visitas registradas todavía.`;
  const vecesText = visitas.count === 1 ? "1 vez" : `${visitas.count} veces`;
  return `${entry.destino.label}: abierta ${vecesText} · última el ${escapeHtml(formatIsoDate(visitas.last))}.`;
}

function laboratorioDetailHtml(entry, snapshotContext) {
  if (!entry) return `<p class="e19-kpi-note">Elige una pantalla heredada para ver su ficha.</p>`;
  const instantanea = snapshotContext ? formatIsoDate(snapshotContext.fecha.slice(0, 10)) : "sin cierre firmado";
  return `<h3 class="escenario-motor-panel-title">${escapeHtml(entry.label)} <code>#${escapeHtml(entry.hash)}</code></h3>
    <p><span class="e19-badge ${LABORATORIO_VEREDICTO_BADGE[entry.veredicto] || "e19-badge-neutral"}">${LABORATORIO_VEREDICTO_LABEL[entry.veredicto] || entry.veredicto}</span></p>
    <p class="e19-kpi-note"><strong>Qué hacía</strong><br>${escapeHtml(entry.queHacia)}</p>
    <p class="e19-kpi-note"><strong>Dónde vive ahora</strong><br>${entry.destino ? `<button type="button" class="registrar-actuals-plan-link" data-home-nav="${escapeHtml(entry.destino.hash)}">${escapeHtml(entry.dondeViveAhora)}</button>` : escapeHtml(entry.dondeViveAhora || "—")}</p>
    <p class="e19-kpi-note"><strong>Recogida en</strong><br>${entry.backlogTask ? escapeHtml(entry.backlogTask) : "Sin tarea propia"}</p>
    ${entry.nota ? `<p class="e19-kpi-note laboratorio-card-nota">${escapeHtml(entry.nota)}</p>` : ""}
    <p class="e19-kpi-note"><strong>Escritura</strong><br>${escapeHtml(entry.evidenciaEscritura || "")}</p>
    <p class="e19-kpi-note"><strong>Visitas</strong><br>${laboratorioVisitasText(entry)}${entry.destino ? `<br>${laboratorioDestinoVisitasText(entry)}` : ""}</p>
    <p class="e19-kpi-note">Instantánea del ${escapeHtml(instantanea)}</p>
    <button type="button" class="e19-btn e19-btn-secondary" data-laboratorio-open-readonly="${escapeHtml(entry.hash)}">Abrir en solo lectura</button>`;
}

function laboratorioCounterText(catalog, filtro) {
  const filtered = laboratorioFilteredCatalog(catalog, filtro);
  const abiertos = laboratorioOpenVerdicts(catalog).length;
  return `${filtered.length} de ${catalog.length} · ${abiertos} sin decidir`;
}

// L-7: acta exportable del Laboratorio — mismo patrón que C-12/A-11 (Blob/CSV + `window.print()`
// sobre `#cierrePrintEvidence`, un solo mecanismo de "PDF de una página" para toda la app).
function laboratorioActaCsvContent(catalog = LABORATORIO_CATALOG, snapshotContext = laboratorioSnapshotContext()) {
  const header = ["Pantalla heredada", "Veredicto", "Dónde vive ahora", "Recogida en", "Qué hacía", "Instantánea"];
  const snapshotCol = snapshotContext ? `${ledgerMonthLabel(snapshotContext.monthKey)} · ${snapshotContext.fecha.slice(0, 10)}` : "Sin cierre firmado todavía";
  const lines = laboratorioListRows(catalog).map((row) => {
    const entry = laboratorioDetailFor(row.hash, catalog);
    return [
      entry.label,
      LABORATORIO_VEREDICTO_LABEL[entry.veredicto] || entry.veredicto,
      entry.dondeViveAhora || "—",
      entry.backlogTask || "Sin tarea asociada",
      entry.queHacia,
      snapshotCol,
    ].map(csvValue).join(";");
  });
  return `﻿${[header.map(csvValue).join(";"), ...lines].join("\r\n")}`;
}

function laboratorioActaPrintHtml(catalog = LABORATORIO_CATALOG, snapshotContext = laboratorioSnapshotContext()) {
  const rows = laboratorioListRows(catalog);
  return `<h1>Acta del Laboratorio</h1>
    <p>${escapeHtml(laboratorioSnapshotNoteText(snapshotContext))}</p>
    <table>
      <thead><tr><th>Pantalla heredada</th><th>Veredicto</th><th>Dónde vive ahora</th><th>Recogida en</th></tr></thead>
      <tbody>${rows
        .map((row) => `<tr><td>${escapeHtml(row.label)}</td><td>${LABORATORIO_VEREDICTO_LABEL[row.veredicto] || row.veredicto}</td><td>${escapeHtml(laboratorioDetailFor(row.hash, catalog)?.dondeViveAhora || "—")}</td><td>${escapeHtml(laboratorioDetailFor(row.hash, catalog)?.backlogTask || "Sin tarea asociada")}</td></tr>`)
        .join("")}</tbody>
    </table>`;
}

function downloadLaboratorioActaCsv() {
  const content = laboratorioActaCsvContent();
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "laboratorio-acta.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function handleLaboratorioExportPdf() {
  // A-11/C-12 reutilizan el mismo contenedor de impresión («#cierrePrintEvidence», fuera de
  // `.app-shell`) y la misma clase de `<body>` — un solo mecanismo de "PDF de una página" para toda
  // la app, no uno por pantalla. Laboratorio hace lo mismo en vez de abrir uno propio.
  const container = qs("cierrePrintEvidence");
  if (!container) return;
  container.innerHTML = laboratorioActaPrintHtml();
  document.body.classList.add("is-printing-cierre-evidence");
  window.print();
  document.body.classList.remove("is-printing-cierre-evidence");
}

function laboratorioReadOnlyActive() {
  return Boolean(laboratorioReadOnlySession);
}

function loadLaboratorioRejectedWrites() {
  try {
    const parsed = JSON.parse(storageGet(storageKey("laboratorio-rejected-writes"), "[]"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function recordLaboratorioRejectedWrite(hash, actionLabel) {
  const history = loadLaboratorioRejectedWrites();
  history.unshift({ hash, actionLabel, at: new Date().toISOString() });
  storageSet(storageKey("laboratorio-rejected-writes"), JSON.stringify(history.slice(0, 200)));
}

function laboratorioWriteGuard(actionLabel) {
  if (!laboratorioReadOnlyActive()) return false;
  recordLaboratorioRejectedWrite(laboratorioReadOnlySession, actionLabel);
  announceStatus(`Solo lectura desde Laboratorio: «${actionLabel}» no se ha guardado.`);
  return true;
}

function handleLaboratorioOpenReadOnly(hash) {
  if (!document.getElementById(hash)?.classList.contains("view-section")) return;
  laboratorioReadOnlySession = hash;
  history.pushState(null, "", `#${hash}`);
  // `announce: false` porque el aviso de solo lectura es el que de verdad importa aquí: si dejamos que
  // setActiveView lance también su "X abierta." genérico, el segundo announceStatus (mismo setTimeout de
  // 10ms) sobrescribe el texto del primero en la región viva y el aviso de seguridad nunca llega a
  // anunciarse a lectores de pantalla.
  setActiveView(hash, { announce: false });
  announceStatus(`Abriendo ${hash} en solo lectura desde Laboratorio: nada de lo que se toque aquí se guarda.`);
}

function laboratorioRetired() {
  return LABORATORIO_PHASE_RETIRED;
}

// L-10: "Sin rutas colgando tras la retirada" — Laboratorio vive DENTRO de Ajustes (L-8), no en su
// propio hash/vista: no hay ningún `data-home-nav="laboratorio"` ni entrada de navegación externa
// que pudiera quedar apuntando a un sitio vacío si `laboratorioRetired()` pasa a `true`. Retirarlo
// solo vacía su propio panel dentro de `#ajustes`, que sigue existiendo; los destinos que enlaza
// (`#cuadro-mandos`, `#home`, etc.) son las pantallas nuevas, no Laboratorio, así que tampoco se ven
// afectados. Esta función documenta esa garantía para que un test la pueda verificar sin repetir el
// razonamiento cada vez.
function laboratorioHasNoOwnRoute() {
  return !Object.prototype.hasOwnProperty.call(REGISTRAR_LEGACY_HASH_TABS, "laboratorio") && !document.getElementById("laboratorio");
}

function renderAjustesLaboratorio() {
  const summaryEl = qs("laboratorioSummary");
  const snapshotEl = qs("laboratorioSnapshot");
  const listEl = qs("laboratorioList");
  const detailEl = qs("laboratorioDetail");
  const card = qs("laboratorioCard");
  const filterEl = qs("laboratorioFilters");
  const counterEl = qs("laboratorioCounter");
  if (card) card.hidden = laboratorioRetired();
  if (laboratorioRetired()) return;

  const catalog = laboratorioCatalog();
  if (summaryEl) {
    const summary = laboratorioVerdictSummary(catalog);
    summaryEl.textContent = `${summary.total} heredadas · Adoptada · ${summary.adoptada} · Sustituida · ${summary.sustituida} · Descartada · ${summary.descartada}${summary.abiertos ? ` · ${summary.abiertos} sin veredicto (revisar)` : ""}`;
  }
  const snapshotContext = laboratorioSnapshotContext();
  if (snapshotEl) snapshotEl.textContent = laboratorioSnapshotNoteText(snapshotContext);
  if (filterEl) filterEl.innerHTML = laboratorioFilterChipsHtml(catalog, laboratorioFiltro);
  if (counterEl) counterEl.textContent = laboratorioCounterText(catalog, laboratorioFiltro);

  const filtered = laboratorioFilteredCatalog(catalog, laboratorioFiltro);
  if (laboratorioViewMode === "lista") {
    if (listEl) { listEl.hidden = false; listEl.innerHTML = laboratorioListHtml(laboratorioListRows(filtered), laboratorioSelectedHash); }
    if (qs("laboratorioCards")) qs("laboratorioCards").hidden = true;
  } else {
    if (qs("laboratorioCards")) { qs("laboratorioCards").hidden = false; qs("laboratorioCards").innerHTML = laboratorioCardsHtml(filtered, laboratorioSelectedHash); }
    if (listEl) listEl.hidden = true;
  }
  if (detailEl) detailEl.innerHTML = laboratorioDetailHtml(laboratorioDetailFor(laboratorioSelectedHash, catalog), snapshotContext);
}

// ARQ-0: mismo patrón que renderAjustesLaboratorio, pero sobre las ~40 pantallas de viewTitles en
// vez de las 17 heredadas del catálogo — el informe de uso real que pedía el backlog 3.0, sin
// motor nuevo: solo lee el contador ya construido por T-4/OPT-2.
function renderAjustesUsoApp() {
  const summaryEl = qs("usoAppSummary");
  const bodyEl = qs("usoAppTableBody");
  const rows = usoAppRows();
  if (summaryEl) summaryEl.textContent = usoAppSummaryText(rows);
  if (bodyEl) bodyEl.innerHTML = usoAppTableHtml(rows);
}

function handleLaboratorioSelect(hash) {
  laboratorioSelectedHash = hash;
  renderAjustesLaboratorio();
}

function handleLaboratorioFilter(filtro) {
  if (!LABORATORIO_FILTROS.includes(filtro)) return;
  laboratorioFiltro = filtro;
  renderAjustesLaboratorio();
}

function handleLaboratorioViewMode(mode) {
  if (mode !== "tarjetas" && mode !== "lista") return;
  laboratorioViewMode = mode;
  renderAjustesLaboratorio();
}
