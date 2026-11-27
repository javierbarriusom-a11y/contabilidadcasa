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
      if (abierta() && !event.target.closest("#topbarStatus, #estadoPunto")) abrirHoja(false);
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

  // --- R1, segunda parte · el título arriba (auditoría de diseño §4: a menos de 100 px del borde) -------------------------------------
  // Lo que separaba el título de la pantalla del borde: la franja de la cabecera (57 px), la tira de cinco cifras (71 px en el escritorio,
  // 205 en el móvil) y, en Deuda e Inversión, sus pestañas encima del título. Con el tema v2:
  //  - En el móvil, el punto va como insignia en la esquina de la marca FC (`colocarPunto`) y la franja solo sale con algo que decir
  //    (tema-v2.css). En el escritorio, el punto se queda con su palabra en la franja.
  //  - La tira y las pestañas de la pantalla (con su «Anterior / Siguiente») se traen justo debajo de la cabecera que se ve
  //    (`colocarBajoCabecera`). Son los mismos nodos: sus ids, su pintado y sus manejadores no cambian; donde la pantalla no tiene
  //    cabecera a la vista (las vistas nuevas que la ocultan), vuelven a su sitio de siempre.
  const ESTRECHO = "(max-width: 860px)";
  const esV2 = () => doc()?.documentElement?.dataset?.tema === "v2";

  function hueco(nodo, texto) {
    if (!nodo.__hueco) {
      nodo.__hueco = doc().createComment(texto);
      nodo.before(nodo.__hueco);
    }
    return nodo.__hueco;
  }

  function devolver(nodo) {
    if (nodo?.__hueco && nodo.__hueco.nextSibling !== nodo) nodo.__hueco.after(nodo);
  }

  /** En el móvil, el punto a la esquina de la marca FC; en el escritorio, en su sitio de la franja. */
  function colocarPunto() {
    const punto = $("estadoPunto");
    const marca = doc()?.querySelector?.(".sidebar .brand-mark");
    if (!punto || !marca) return;
    const estrecho = esV2() && typeof root.matchMedia === "function" && root.matchMedia(ESTRECHO).matches;
    if (estrecho) {
      hueco(punto, "R1: el sitio del punto en la franja");
      if (punto.parentElement !== marca) marca.append(punto);
    } else devolver(punto);
  }

  /** La cabecera de la pantalla, si se ve. */
  function cabeceraDe(seccion) {
    const cabecera = seccion?.querySelector?.(":scope > .section-title") || null;
    return cabecera && cabecera.getClientRects().length ? cabecera : null;
  }

  /** Las navegaciones de una pantalla que van encima de su título: sus pestañas y su «Anterior / Siguiente», en su orden. */
  function pestanasDe(seccion) {
    if (!seccion?.querySelectorAll) return [];
    return [...seccion.querySelectorAll(':scope > nav[id$="ScreenTabs"], :scope > nav[id$="OfertasTabs"], :scope > nav[id$="FlowNav"], :scope > [data-r1-movida]')]
      .filter((nav, i, todas) => todas.indexOf(nav) === i);
  }

  function colocarBajoCabecera() {
    const main = $("mainContent");
    const tira = $("topbarStatusStrip");
    if (!main || !tira || !esV2()) return;
    hueco(tira, "R1: el sitio de siempre de la tira");
    // La que se ve: la primera sección sin `hidden` puede estar dentro de otra oculta (Movimientos).
    const seccion = [...main.querySelectorAll("section.view-section:not([hidden])")].find((s) => s.getClientRects().length) || null;
    main.querySelectorAll("[data-r1-movida]").forEach((nodo) => { if (!seccion || !seccion.contains(nodo)) devolver(nodo); });
    const cabecera = cabeceraDe(seccion);
    if (!cabecera) {
      seccion?.querySelectorAll?.(":scope > [data-r1-movida]").forEach(devolver);
      devolver(tira);
      return;
    }
    let ultimo = cabecera;
    pestanasDe(seccion).forEach((nav) => {
      hueco(nav, `R1: el sitio de siempre de #${nav.id}`);
      nav.setAttribute("data-r1-movida", "");
      if (ultimo.nextElementSibling !== nav) ultimo.after(nav);
      ultimo = nav;
    });
    if (ultimo.nextElementSibling !== tira) ultimo.after(tira);
  }

  function arrancarSegundaParte() {
    if (!esV2()) return;
    colocarPunto();
    root.matchMedia?.(ESTRECHO)?.addEventListener?.("change", colocarPunto);
    const main = $("mainContent");
    if (main && typeof root.MutationObserver === "function") {
      const vigia = new root.MutationObserver(colocarBajoCabecera);
      main.querySelectorAll("section.view-section").forEach((seccion) => vigia.observe(seccion, { attributes: true, attributeFilter: ["hidden"] }));
    }
    colocarBajoCabecera();
  }

  if (doc()) {
    const arrancar = () => {
      cablear();
      arrancarSegundaParte();
    };
    if (doc().readyState === "loading") doc().addEventListener("DOMContentLoaded", arrancar);
    else arrancar();
  }

  const api = { TEXTOS, tonoDelPunto, pintarEstadoPunto, abrirHoja, filasDeGuia, rellenarGuia, colocarPunto, cabeceraDe, pestanasDe, colocarBajoCabecera };
  root.FinanceMarcoV2 = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
