// D-N38 · UND-24 (duodécima auditoría): la hoja de la revisión trimestral en Ajustes › Uso de la app, plegada y sin titular nuevo. Una fila
// por pantalla de «Versiones anteriores» y por función medida: lo medido (solo cuentas de este navegador, sin importes), la propuesta con su
// porqué y vuestra decisión («Se queda», «Se funde», «Se retira»). «Copiar el acta» da el texto para pasármelo: retirar se hace después,
// pantalla a pantalla, redirigiendo sin borrar código. Nada se retira desde aquí.
//
// Script de pantalla: comparte el ámbito global de app.js (qs, escapeHtml, storageGet/Set/Key, isoLocalDate, usoAppRows…).

const REVISION_TRIMESTRAL_KEY = "revision-trimestral";
let revisionEnganchada = false;

function revisionLeer() {
  try {
    const raw = storageGet(storageKey(REVISION_TRIMESTRAL_KEY), "");
    const v = raw ? JSON.parse(raw) : {};
    return v && typeof v === "object" && !Array.isArray(v) ? v : {};
  } catch {
    return {};
  }
}

function revisionMesAnterior(mes) {
  const [y, m] = mes.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// Lo medido de una función en el mes actual y el anterior (el medidor cuenta por mes): la ventana de «los últimos 30 días» redondeada.
function revisionResumen(M, store, id, hoy) {
  const mes = hoy.slice(0, 7);
  const a = M.resumen(store, id, mes);
  const b = M.resumen(store, id, revisionMesAnterior(mes));
  const vistas = a.vistas + b.vistas;
  const diasAccion = a.diasAccion + b.diasAccion;
  return { vistas, acciones: a.acciones + b.acciones, descartes: a.descartes + b.descartes, tasa: vistas ? Math.min(100, Math.round((diasAccion / vistas) * 100)) : null };
}

function revisionEntrada(hoy) {
  const M = globalThis.FinanceMedidor;
  const store = M?.leer ? M.leer() : {};
  const legacy = [...document.querySelectorAll('a[data-e17-group="legacy"][href^="#"]')].map((a) => a.getAttribute("href").slice(1));
  const filas = typeof usoAppRows === "function" ? usoAppRows() : [];
  const pantallas = legacy.map((id) => filas.find((f) => f.id === id) || { id, title: id, count: 0, last: null });
  const funciones = (M?.FUNCIONES || []).map((f) => ({
    id: f.id, nombre: f.nombre, conAccion: Boolean(f.accion), laboratorio: /apagad/.test(String(f.descarte?.[0] || "")), resumen: revisionResumen(M, store, f.id, hoy),
  }));
  return { pantallas, funciones, hoy, decisiones: revisionLeer() };
}

function revisionHtml(rev) {
  const R = globalThis.FinanceRevisionTrimestral;
  const filas = rev.filas.map((f) => {
    const clave = `${f.tipo}:${f.id}`;
    const opciones = ["", ...R.DECISIONES].map((d) => `<option value="${d}"${(f.decision || "") === d ? " selected" : ""}>${d ? R.DECISION_TEXTO[d] : "Sin decidir"}</option>`).join("");
    return `<li class="revision-fila${f.candidato ? " is-candidato" : ""}" data-revision-fila="${escapeHtml(clave)}">
      <p><strong>${escapeHtml(f.nombre)}</strong> <small>${f.tipo === "pantalla" ? "pantalla de «Versiones anteriores»" : "función"}${f.candidato ? " · candidata de la duodécima" : ""}</small></p>
      <p class="revision-medido">${escapeHtml(f.medido)}.</p>
      <p class="revision-propuesta">Propuesta: <strong>${escapeHtml(R.DECISION_TEXTO[f.propuesta])}</strong> (${escapeHtml(f.porque)}).</p>
      <label class="month-picker"><span>Vuestra decisión</span><select data-revision-decision="${escapeHtml(clave)}">${opciones}</select></label>
    </li>`;
  }).join("");
  return `<p class="e19-kpi-note">Lo medido son cuentas de este navegador en este mes y el anterior (sin importes). Decidís vosotros; nada se retira desde aquí: retirar es redirigir sin borrar código, y lo hago después, pantalla a pantalla, con vuestro «sí».</p>
    <p class="e19-kpi-note" data-revision-resumen role="status">${rev.decididas} de ${rev.filas.length} decididas.</p>
    <ul class="revision-lista">${filas}</ul>
    <p><button type="button" class="e19-btn e19-btn-secondary" data-revision-copiar>Copiar el acta</button> <span role="status" data-revision-copiado></span></p>
    <pre class="revision-acta" data-revision-acta>${escapeHtml(globalThis.FinanceRevisionTrimestral.acta(rev))}</pre>`;
}

function renderRevisionTrimestral() {
  const card = typeof qs === "function" ? qs("revisionTrimestralCard") : null;
  const R = globalThis.FinanceRevisionTrimestral;
  if (!card || !R) return;
  try {
    const rev = R.revisar(revisionEntrada(isoLocalDate(new Date())));
    const resumen = card.querySelector("[data-revision-resumen-plegado]");
    if (resumen) resumen.textContent = `Revisión trimestral (semana del 14/12) · ${rev.decididas} de ${rev.filas.length} decididas`;
    const cuerpo = card.querySelector("[data-revision-cuerpo]");
    const html = revisionHtml(rev);
    if (cuerpo && cuerpo.__html !== html) {
      cuerpo.innerHTML = html;
      cuerpo.__html = html;
    }
  } catch (error) {
    console.error(`renderRevisionTrimestral: ${error.message}`);
  }
  if (!revisionEnganchada) {
    revisionEnganchada = true;
    card.addEventListener("change", (event) => {
      const sel = event.target.closest("[data-revision-decision]");
      if (!sel) return;
      const todas = revisionLeer();
      if (sel.value) todas[sel.dataset.revisionDecision] = { d: sel.value, f: isoLocalDate(new Date()) };
      else delete todas[sel.dataset.revisionDecision];
      try { storageSet(storageKey(REVISION_TRIMESTRAL_KEY), JSON.stringify(todas)); } catch { /* sin almacenamiento */ }
      const clave = sel.dataset.revisionDecision;
      renderRevisionTrimestral();
      card.querySelector(`[data-revision-decision="${CSS.escape(clave)}"]`)?.focus();
    });
    card.addEventListener("click", async (event) => {
      if (!event.target.closest("[data-revision-copiar]")) return;
      const texto = card.querySelector("[data-revision-acta]")?.textContent || "";
      const aviso = card.querySelector("[data-revision-copiado]");
      try {
        await navigator.clipboard.writeText(texto);
        if (aviso) aviso.textContent = "Acta copiada.";
      } catch {
        if (aviso) aviso.textContent = "No se ha podido copiar: seleccionad el texto de abajo.";
      }
    });
  }
}

globalThis.renderRevisionTrimestral = renderRevisionTrimestral;
