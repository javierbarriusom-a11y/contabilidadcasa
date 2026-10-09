// WP-37 · NXP-04 (docs/WP37_DISENO.md): piezas comunes de los estados completos. El catálogo vivo está en design-system.html y la hoja en
// estados.css; aquí solo hay marcado y dos funciones para las vistas que se descargan bajo demanda.
//
// Script de pantalla: se carga antes de app.js y comparte su ámbito global (escapeHtml…). Sin llamadas al DOM ni escuchas al cargarse.
//
// Reglas del catálogo (resumen; el detalle, en design-system.html):
//   · vacío     → dice qué falta y ofrece LA acción que lo llena (un botón principal), no solo «no hay nada».
//   · cargando  → esqueleto en el sitio de lo que llega; role="status" y aria-busy; nunca una pantalla en blanco.
//   · error     → qué pasó (causa en una frase), qué sigue funcionando y UNA salida (Reintentar); role="alert".
//   · sin conexión → distinto del error: no es un fallo de la app, y dice qué hacer (conectarse una vez).
//   · obsoleto  → el dato está ahí pero es viejo: cuánto, y qué lo renueva. No se esconde ni se presenta como actual.
//   · éxito     → lo reversible se hace al momento y avisa con «Deshacer» (showUndoToast); la confirmación se reserva para lo irreversible.

const ESTADO_KINDS = Object.freeze({
  vacio: { clase: "est-vacio", role: "status", titulo: "Todavía no hay nada" },
  cargando: { clase: "est-cargando", role: "status", titulo: "Cargando…" },
  error: { clase: "est-error", role: "alert", titulo: "No se ha podido" },
  "sin-conexion": { clase: "est-sin-conexion", role: "alert", titulo: "Sin conexión" },
  obsoleto: { clase: "est-obsoleto", role: "status", titulo: "Dato antiguo" },
  exito: { clase: "est-exito", role: "status", titulo: "Hecho" },
});

function estadoAccionHtml(accion, principal) {
  if (!accion || !accion.label) return "";
  const clase = principal ? "e19-btn e19-btn-primary" : "e19-btn e19-btn-secondary";
  if (accion.href) return `<a class="${clase}" href="${escapeHtml(accion.href)}">${escapeHtml(accion.label)}</a>`;
  return `<button type="button" class="${clase}" data-estado-accion="${escapeHtml(accion.id || "")}">${escapeHtml(accion.label)}</button>`;
}

/**
 * Marcado de un estado. `accion` y `secundaria`: { label, id } (botón) o { label, href } (enlace). `detalle`: la causa técnica, en pequeño.
 * Todo lo que llega como texto se escapa aquí.
 * @param {{kind: string, titulo?: string, texto?: string, detalle?: string, accion?: {label: string, id?: string, href?: string}|null, secundaria?: {label: string, id?: string, href?: string}|null}} options
 */
function estadoHtml({ kind, titulo = "", texto = "", detalle = "", accion = null, secundaria = null } = { kind: "vacio" }) {
  const def = ESTADO_KINDS[kind] || ESTADO_KINDS.vacio;
  const esqueleto = kind === "cargando" ? '<div class="est-esqueleto" aria-hidden="true"><span></span><span></span><span></span></div>' : "";
  const acciones = estadoAccionHtml(accion, true) + estadoAccionHtml(secundaria, false);
  return `<div class="est ${def.clase}" role="${def.role}"${kind === "cargando" ? ' aria-busy="true"' : ""} data-estado="${escapeHtml(kind)}">
      <p class="est-titulo">${escapeHtml(titulo || def.titulo)}</p>
      ${texto ? `<p class="est-texto">${escapeHtml(texto)}</p>` : ""}
      ${esqueleto}
      ${detalle ? `<p class="est-detalle">${escapeHtml(detalle)}</p>` : ""}
      ${acciones ? `<div class="est-acciones">${acciones}</div>` : ""}
    </div>`;
}

// Estado de una vista que se descarga bajo demanda (VIEW_CHUNKS en app.js): se antepone al contenido SIN borrarlo y se quita al llegar.
// `kind` null lo retira. En error, `retry` es la salida: vuelve a pedir la pantalla.
function renderEstadoVista(root, kind, { error = null, retry = null } = {}) {
  if (!root) return;
  const previous = root.querySelector(":scope > [data-estado-vista]");
  if (!kind) { previous?.remove(); return; }
  const holder = previous || document.createElement("div");
  holder.setAttribute("data-estado-vista", "1");
  if (kind === "cargando") {
    holder.innerHTML = estadoHtml({ kind: "cargando", titulo: "Cargando esta pantalla…", texto: "Se descarga la primera vez que se abre." });
  } else if (typeof navigator !== "undefined" && navigator.onLine === false) {
    holder.innerHTML = estadoHtml({
      kind: "sin-conexion", titulo: "Sin conexión", texto: "Esta pantalla se descarga la primera vez que se abre y aún no está guardada en el móvil. Conéctate un momento y pulsa «Reintentar»: después funcionará sin conexión. El resto de la app sigue disponible.",
      accion: { label: "Reintentar", id: "reintentar" },
    });
  } else {
    holder.innerHTML = estadoHtml({
      kind: "error", titulo: "No se ha podido descargar esta pantalla", texto: "El resto de la app sigue funcionando. Pulsa «Reintentar»; si sigue fallando, recarga la página (puede haber una versión nueva).",
      detalle: error?.message ? `Causa: ${error.message}.` : "", accion: { label: "Reintentar", id: "reintentar" },
    });
  }
  if (kind !== "cargando" && typeof retry === "function") {
    holder.querySelector('[data-estado-accion="reintentar"]')?.addEventListener("click", () => { renderEstadoVista(root, "cargando"); retry(); }, { once: true });
  }
  if (!previous) root.insertBefore(holder, root.firstChild);
}
