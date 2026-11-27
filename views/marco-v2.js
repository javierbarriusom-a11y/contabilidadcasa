/**
 * views/marco-v2.js · R1, primera parte (auditoría de diseño §4, D-N49; 26/11/2026): el marco común del tema v2, lo que no es de una
 * pantalla sino de la cabecera de todas. Los estilos, en `tema-v2.css` («R1 · El marco común»); en el clásico, los dos botones no se
 * ven y la hoja no pinta caja (`styles.css`), así que nada de esto cambia la cabecera de siempre.
 *
 *  - **El punto de estado** (TRE-09): las tres píldoras (el dato, el guardado con su hora y la fuente) pasan a `#estadoHoja`, que se abre
 *    con `#estadoPunto`. El punto lleva color y una palabra (el color solo no basta): verde «Sincronizado», ámbar «Solo en este equipo»,
 *    rojo «Revisar». El tono es el del chip de siempre: app.js (`updateSyncUi`) llama a `pintarEstadoPunto` con el suyo. La hoja se
 *    cierra con Escape (y el foco vuelve al punto), al tocar fuera o al cambiar de pantalla.
 *  - **«Guía» en la cabecera**: el recuadro «Estado · Guía de este flujo» ya no se pinta con el tema v2; lo que decía (para qué sirve,
 *    el estado con la fecha de análisis y el siguiente paso) se lee en la guía (`rellenarGuia`, desde `openE17Dialog`). En Hoy,
 *    Registrar y Movimientos no había recuadro (su cabecera ya lo dice) y la guía sale como siempre.
 *
 * Script de pantalla: comparte el ámbito global de app.js (escapeHtml, shortDate, activeViewTitle).
 */
(function attachMarcoV2(root) {
  "use strict";

  const TEXTOS = { cloud: "Sincronizado", local: "Solo en este equipo", warn: "Revisar" };
  const SIN_RECUADRO = new Set(["home", "registrar", "movements"]);
  const doc = () => (typeof document !== "undefined" ? document : null);
  const $ = (id) => doc()?.getElementById(id) || null;
  const esc = (v) => (typeof escapeHtml === "function" ? escapeHtml(v) : String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]));

  /** El tono del chip (`cloud`, `local` o `warn`) al punto: su color (data-tono) y su palabra. Un tono desconocido cuenta como local. */
  function tonoDelPunto(tone) {
    const tono = Object.prototype.hasOwnProperty.call(TEXTOS, tone) ? tone : "local";
    return { tono, texto: TEXTOS[tono] };
  }

  function pintarEstadoPunto(tone = "local") {
    const punto = $("estadoPunto");
    if (!punto) return;
    const { tono, texto } = tonoDelPunto(tone);
    punto.dataset.tono = tono;
    const palabra = $("estadoPuntoTexto");
    if (palabra) palabra.textContent = texto;
  }

  function abrirHoja(abierta, { devolverFoco = false } = {}) {
    const punto = $("estadoPunto");
    const contenedor = $("topbarStatus");
    if (!punto || !contenedor) return;
    punto.setAttribute("aria-expanded", abierta ? "true" : "false");
    contenedor.toggleAttribute("data-estado-abierto", abierta);
    if (!abierta && devolverFoco) punto.focus();
  }

  const abierta = () => $("estadoPunto")?.getAttribute("aria-expanded") === "true";

  function cablear() {
    const punto = $("estadoPunto");
    if (!punto || punto.dataset.cableado) return;
    punto.dataset.cableado = "1";
    punto.addEventListener("click", () => abrirHoja(!abierta()));
    doc().addEventListener("keydown", (event) => {
      if (event.key === "Escape" && abierta()) abrirHoja(false, { devolverFoco: true });
    });
    doc().addEventListener("click", (event) => {
      if (abierta() && !event.target.closest("#topbarStatus")) abrirHoja(false);
    });
    root.addEventListener?.("hashchange", () => abrirHoja(false));
  }

  /** Lo que decía el recuadro, en filas [título, texto]. `guia`: la de E17 para la pantalla (o null); `fecha`: la de análisis. */
  function filasDeGuia(viewId, guia, fecha, { titulo = viewId, fechaCorta = fecha } = {}) {
    const g = Array.isArray(guia) && guia.length >= 4 ? guia : ["Para qué sirve", titulo, "Consulta o edición", "Usa Buscar o abrir para ir directamente a la siguiente tarea."];
    return [
      [g[0], g[1]],
      ["Estado", `${g[2]} · datos con fecha de análisis ${fechaCorta || fecha || "la copia actual"}.`],
      ["Siguiente paso", g[3]],
    ];
  }

  function rellenarGuia(viewId, guia, fecha) {
    const destino = $("e17FlowGuideContexto");
    if (!destino) return;
    if (doc().documentElement.dataset.tema !== "v2" || SIN_RECUADRO.has(viewId)) {
      destino.hidden = true;
      destino.innerHTML = "";
      return;
    }
    const titulo = typeof activeViewTitle === "function" ? activeViewTitle(viewId) : viewId;
    const fechaCorta = fecha && typeof shortDate === "function" ? shortDate(fecha) : fecha;
    destino.innerHTML = filasDeGuia(viewId, guia, fecha, { titulo, fechaCorta }).map(([t, x]) => `<div><dt>${esc(t)}</dt><dd>${esc(x)}</dd></div>`).join("");
    destino.hidden = false;
  }

  if (doc()) {
    if (doc().readyState === "loading") doc().addEventListener("DOMContentLoaded", cablear);
    else cablear();
  }

  const api = { TEXTOS, tonoDelPunto, pintarEstadoPunto, abrirHoja, filasDeGuia, rellenarGuia };
  root.FinanceMarcoV2 = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
