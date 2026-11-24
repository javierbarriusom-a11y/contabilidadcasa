/**
 * barra-inferior.js
 *
 * DUO-05 · D-N37 (duodécima auditoría; recoge UND-07 y DEC-05; decisión del hogar del 23/11/2026: «ok»; adelantada por D-N39): en el móvil,
 * una barra fija abajo con cuatro destinos y «Más»: Hoy, Movimientos, Plan, Deuda. «Más» abre el menú de siempre. A 390 px el menú lateral
 * es una lista que tapa la pantalla; la barra es el patrón que el hogar ya conoce de su banco.
 *
 *  - Solo entre 300 y 860 px de ancho (CSS): por debajo de 300 (zoom al 200 %, DEC-38) no se pone, para no quitar alto a la pantalla.
 *  - Texto siempre bajo el icono (no solo icono); el destino activo con `aria-current="page"` y una raya arriba (forma, no solo color).
 *  - Se oculta con el teclado abierto (un campo con el foco), para no tapar lo que se escribe.
 *  - El contenido reserva su hueco: `padding-bottom` en el cuerpo y `scroll-padding-bottom`, así lo que se lleva a la vista no queda debajo.
 *
 * Qué destino está activo sale de la vista (`viewFromHash`): las pestañas de Plan y de Deuda cuentan como su destino.
 */
(function attachBarraInferior(root, factory) {
  const api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceBarraInferior = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function barraInferiorFactory(root) {
  "use strict";

  const DESTINOS = Object.freeze([
    Object.freeze({ id: "hoy", href: "#home", texto: "Hoy", vistas: /^(home|overview)$/ }),
    Object.freeze({ id: "movimientos", href: "#movements", texto: "Movimientos", corto: "Movim.", vistas: /^movements$/ }),
    Object.freeze({ id: "plan", href: "#plan", texto: "Plan", vistas: /^(plan|cierre)$/ }),
    Object.freeze({ id: "deuda", href: "#deuda-ruta", texto: "Deuda", vistas: /^deuda-/ }),
  ]);

  /** El destino de la barra que corresponde a una vista (o null: «Más»). */
  function destinoDe(vista) {
    const v = String(vista || "");
    const d = DESTINOS.find((item) => item.vistas.test(v));
    return d ? d.id : null;
  }

  const ICONOS = {
    hoy: '<path d="M4 11.5 12 5l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5h-5v5H5a1 1 0 0 1-1-1z"/>',
    movimientos: '<path d="M5 7h14M5 12h14M5 17h9"/>',
    plan: '<rect x="4.5" y="5.5" width="15" height="14" rx="1.5"/><path d="M4.5 9.5h15M9 3.5v4M15 3.5v4"/>',
    deuda: '<path d="M4 17h16M6 17V9M10 17V6M14 17v-5M18 17v-8"/>',
    mas: '<circle cx="6" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="18" cy="12" r="1.4"/>',
  };

  function icono(id) {
    return `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONOS[id]}</svg>`;
  }

  function html() {
    const enlaces = DESTINOS.map((d) => `<a class="barra-inf-item" href="${d.href}" data-barra-destino="${d.id}">${icono(d.id)}<span class="barra-inf-texto"${d.corto ? ` data-corto="${d.corto}"` : ""}>${d.texto}</span></a>`).join("");
    return `${enlaces}<button type="button" class="barra-inf-item" data-barra-mas aria-controls="primarySidebar" aria-expanded="false">${icono("mas")}<span class="barra-inf-texto">Más</span></button>`;
  }

  function marcar(doc) {
    const barra = doc.getElementById("barraInferior");
    if (!barra) return;
    const vista = typeof root.viewFromHash === "function" ? root.viewFromHash() : String(root.location?.hash || "#home").slice(1);
    const activo = destinoDe(vista);
    barra.querySelectorAll("[data-barra-destino]").forEach((a) => {
      if (a.dataset.barraDestino === activo) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
    const mas = barra.querySelector("[data-barra-mas]");
    const abierto = doc.getElementById("primarySidebar")?.classList.contains("mobile-open");
    if (mas) mas.setAttribute("aria-expanded", abierto ? "true" : "false");
  }

  function esCampo(el) {
    return Boolean(el && el.matches?.("input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]), textarea, select, [contenteditable=true]"));
  }

  function iniciar(doc = root.document) {
    if (!doc || doc.__barraInferior) return;
    const barra = doc.getElementById("barraInferior");
    if (!barra) return;
    doc.__barraInferior = true;
    barra.innerHTML = html();
    barra.addEventListener("click", (event) => {
      const mas = event.target.closest("[data-barra-mas]");
      if (mas) {
        const abierto = mas.getAttribute("aria-expanded") === "true";
        if (typeof root.setMobileNavOpen === "function") root.setMobileNavOpen(!abierto);
        else doc.getElementById("mobileNavToggle")?.click();
        marcar(doc);
        if (!abierto) doc.querySelector("#primarySidebar .side-nav a")?.focus();
        root.FinanceMedidor?.anotar?.("barra-inferior", "accion");
        return;
      }
      if (event.target.closest("[data-barra-destino]")) {
        if (typeof root.setMobileNavOpen === "function") root.setMobileNavOpen(false);
        root.FinanceMedidor?.anotar?.("barra-inferior", "accion");
      }
    });
    // Con el teclado abierto, la barra no tapa lo que se escribe.
    doc.addEventListener("focusin", (event) => { if (esCampo(event.target)) doc.body.classList.add("barra-inf-teclado"); });
    doc.addEventListener("focusout", (event) => { if (esCampo(event.target)) doc.body.classList.remove("barra-inf-teclado"); });
    root.addEventListener?.("hashchange", () => marcar(doc));
    doc.getElementById("mobileNavToggle")?.addEventListener("click", () => root.setTimeout?.(() => marcar(doc), 0));
    doc.body.classList.add("con-barra-inferior");
    marcar(doc);
  }

  if (root && root.document && typeof module === "undefined") {
    if (root.document.readyState === "loading") root.document.addEventListener("DOMContentLoaded", () => iniciar(root.document), { once: true });
    else iniciar(root.document);
  }

  return { DESTINOS, destinoDe, html, iniciar, marcar };
});
