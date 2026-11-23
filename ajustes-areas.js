/**
 * ajustes-areas.js
 *
 * UND-04 (undécima auditoría; D-N29, 22/11/2026, decisión del hogar: «Áreas solo en el móvil»). Ajustes medía unos 34.000 px en el
 * móvil: sus diez grupos seguidos. En el móvil (≤ 860 px) se entra por un área y las demás se eligen en las pestañas o con «Ver todo»;
 * en el escritorio todo sigue a la vista y la fila de pestañas no se enseña (el índice de siempre sigue siendo el de anclas). Las áreas
 * agrupan los grupos que ya existen, sin mover ninguna tarjeta (styles.css esconde por CSS los que no son del área).
 *
 * El área dura lo que la pestaña del navegador (sessionStorage), como las de Hoy. `mostrar(id)` cambia al área de un elemento: lo usa
 * quien lleva a una tarjeta concreta (la vuelta a «Funciones en prueba», el índice de anclas).
 */
(function exposeAjustesAreas(root, factory) {
  const api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceAjustesAreas = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createAjustesAreas(root) {
  "use strict";

  const AREAS = Object.freeze(["cuentas", "plan", "patrimonio", "datos", "laboratorio", "navegacion", "todo"]);
  const CLAVE = "ajustes-area";

  function valida(area) {
    return AREAS.includes(area) ? area : "cuentas";
  }

  function leer() {
    try {
      return valida(root.sessionStorage?.getItem(CLAVE) || "cuentas");
    } catch {
      return "cuentas";
    }
  }

  function guardar(area) {
    try {
      root.sessionStorage?.setItem(CLAVE, area);
    } catch {
      /* sin almacenamiento: dura hasta recargar */
    }
  }

  function aplicar(doc, area, { foco = false } = {}) {
    const seccion = doc.getElementById("ajustes");
    if (!seccion) return;
    const elegida = valida(area);
    seccion.setAttribute("data-ajustes-area", elegida);
    doc.querySelectorAll("[data-ajustes-area-tab]").forEach((tab) => {
      const sel = tab.dataset.ajustesAreaTab === elegida;
      tab.setAttribute("aria-selected", sel ? "true" : "false");
      tab.tabIndex = sel ? 0 : -1;
      if (sel && foco) tab.focus();
    });
  }

  function elegir(doc, area, opciones) {
    guardar(valida(area));
    aplicar(doc, area, opciones);
  }

  // El área del grupo que contiene un elemento (por id o el propio elemento).
  function areaDe(doc, objetivo) {
    const el = typeof objetivo === "string" ? doc.getElementById(objetivo) : objetivo;
    return el?.closest?.("[data-ajustes-area]:not(#ajustes)")?.getAttribute("data-ajustes-area") || null;
  }

  function mostrar(objetivo, doc = root.document) {
    const area = areaDe(doc, objetivo);
    const actual = doc.getElementById("ajustes")?.getAttribute("data-ajustes-area");
    if (area && actual !== "todo" && actual !== area) elegir(doc, area);
  }

  // Lo que la app lleva a la vista o enfoca dentro de Ajustes (el camino a un supuesto desde la Previsión, la línea de la copia de
  // seguridad, la vuelta a «Funciones en prueba»…) tiene que verse aunque sea de otra área: antes de desplazarse o enfocar, se cambia a
  // su área. Una envoltura de `scrollIntoView` y `focus` en vez de tocar cada sitio que lleva a Ajustes (son muchos y vendrán más).
  function envolver(proto, nombre) {
    const original = proto?.[nombre];
    if (typeof original !== "function" || original.__ajustesAreas) return;
    const envuelta = function envueltaAjustesAreas(...args) {
      try {
        if (this?.closest?.("#ajustes .e19-ajustes-group")) mostrar(this, this.ownerDocument);
      } catch {
        /* nunca impide desplazarse ni enfocar */
      }
      return original.apply(this, args);
    };
    envuelta.__ajustesAreas = true;
    proto[nombre] = envuelta;
  }

  function iniciar(doc = root.document) {
    if (!doc || doc.__ajustesAreas) return;
    doc.__ajustesAreas = true;
    envolver(root.Element?.prototype, "scrollIntoView");
    envolver(root.HTMLElement?.prototype, "focus");
    aplicar(doc, leer());
    doc.addEventListener("click", (event) => {
      const tab = event.target?.closest?.("[data-ajustes-area-tab]");
      if (tab) {
        elegir(doc, tab.dataset.ajustesAreaTab);
        return;
      }
      // El índice de anclas lleva a un grupo: si está en otra área, primero esa área (en la fase de captura, antes del desplazamiento).
      const ancla = event.target?.closest?.("[data-ajustes-anchor]");
      if (ancla) mostrar(ancla.dataset.ajustesAnchor, doc);
    }, true);
    doc.addEventListener("keydown", (event) => {
      const tab = event.target?.closest?.("[data-ajustes-area-tab]");
      if (!tab || !["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const i = AREAS.indexOf(tab.dataset.ajustesAreaTab);
      const j = event.key === "Home" ? 0 : event.key === "End" ? AREAS.length - 1 : (i + (event.key === "ArrowRight" ? 1 : -1) + AREAS.length) % AREAS.length;
      elegir(doc, AREAS[j], { foco: true });
    });
  }

  if (root && root.document && typeof module === "undefined") {
    if (root.document.readyState === "loading") root.document.addEventListener("DOMContentLoaded", () => iniciar(root.document), { once: true });
    else iniciar(root.document);
  }

  return { AREAS, CLAVE, valida, areaDe, mostrar, iniciar };
});
