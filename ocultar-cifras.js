/**
 * ocultar-cifras.js
 *
 * UND-17 (undécima auditoría; DEC-36): ocultar las cifras con un toque. Un ojo en la cabecera cambia todos los importes de la app
 * por «•••» hasta volver a tocarlo, para mirar la app en el transporte o delante de otros. Se recuerda en este dispositivo.
 *
 * Cómo: no hay un único formateador de importes (money() de app.js y una treintena de formatos propios en vistas, motores y gráficos),
 * así que se enmascara el texto ya pintado. Mientras está activo, un MutationObserver cambia en cada nodo de texto nuevo o cambiado
 * (también en los SVG: los gráficos siguen viéndose, sin las cifras de su eje) y en `aria-label`, `title`, `aria-valuetext` y
 * `placeholder` lo que tenga forma de importe en euros («1.234 €», «-8.310 €», «412,30 €», «2,5 k€») por «••• €». Los campos donde
 * se escribe una cifra se ven borrosos con CSS mientras no se están usando (al tocarlos para escribir, se ven) y siguen funcionando. Al volver a tocar el ojo, se restaura cada
 * texto tapado y la app se repinta.
 *
 * Lo que no hace (y se dice): no es seguridad. Quien tenga el móvil puede tocar el ojo; los porcentajes, fechas y plazos siguen a la
 * vista; lo descargado (copias, hojas, .ics) sale con sus cifras.
 *
 * La parte pura (`enmascarar`) se prueba en Node; el resto solo corre en el navegador.
 */
(function exposeOcultarCifras(root, factory) {
  const api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceOcultarCifras = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createOcultarCifras(root) {
  "use strict";

  const OCULTAR_CIFRAS_KEY = "ocultar-cifras";
  const MASCARA = "•••";
  // Un importe en euros, como lo pinta la app: signo opcional, miles con punto, decimales con coma, «k» o «M» opcional y el «€»
  // detrás (con espacio normal, duro o fino, o pegado). También «€ 1.234» por si algún texto lo pone delante.
  const IMPORTE = /[-+−]?\d{1,3}(?:\.\d{3})*(?:,\d+)?(?:[\s  ]?[kKM])?[\s  ]?€|€[\s  ]?[-+−]?\d{1,3}(?:\.\d{3})*(?:,\d+)?/g;
  const ATRIBUTOS = ["aria-label", "title", "aria-valuetext", "placeholder", "data-tooltip"];

  function enmascarar(texto) {
    const valor = String(texto ?? "");
    if (!valor.includes("€")) return valor;
    return valor.replace(IMPORTE, (encontrado) => (encontrado.startsWith("€") ? `€ ${MASCARA}` : `${MASCARA} €`));
  }

  function tieneImporte(texto) {
    IMPORTE.lastIndex = 0;
    const hay = IMPORTE.test(String(texto ?? ""));
    IMPORTE.lastIndex = 0;
    return hay;
  }

  function leer() {
    try {
      return root?.localStorage?.getItem(OCULTAR_CIFRAS_KEY) === "1";
    } catch {
      return false;
    }
  }

  function guardar(activo) {
    try {
      if (activo) root.localStorage.setItem(OCULTAR_CIFRAS_KEY, "1");
      else root.localStorage.removeItem(OCULTAR_CIFRAS_KEY);
    } catch {
      /* sin almacenamiento: dura lo que la pestaña */
    }
  }

  // ---- Navegador ------------------------------------------------------------------------------------------------------------------
  const originales = new Map(); // nodo de texto → texto de verdad
  const atributosOriginales = new Map(); // elemento → { atributo: valor }
  let observador = null;
  let activo = false;

  function saltar(nodo) {
    const padre = nodo.nodeType === 3 ? nodo.parentNode : nodo;
    return Boolean(padre && padre.nodeType === 1 && (padre.closest?.("script, style, textarea, [data-sin-ocultar]")));
  }

  function taparTexto(nodo) {
    if (saltar(nodo)) return;
    const actual = nodo.nodeValue;
    if (!actual || !actual.includes("€")) return;
    const tapado = enmascarar(actual);
    if (tapado === actual) return;
    originales.set(nodo, actual);
    nodo.nodeValue = tapado;
  }

  function taparAtributos(elemento) {
    if (elemento.nodeType !== 1 || saltar(elemento)) return;
    ATRIBUTOS.forEach((nombre) => {
      const valor = elemento.getAttribute(nombre);
      if (!valor || !valor.includes("€")) return;
      const tapado = enmascarar(valor);
      if (tapado === valor) return;
      const guardados = atributosOriginales.get(elemento) || {};
      guardados[nombre] = valor;
      atributosOriginales.set(elemento, guardados);
      elemento.setAttribute(nombre, tapado);
    });
  }

  function taparArbol(raiz) {
    if (!raiz) return;
    if (raiz.nodeType === 3) {
      taparTexto(raiz);
      return;
    }
    if (raiz.nodeType !== 1 && raiz.nodeType !== 9 && raiz.nodeType !== 11) return;
    const doc = raiz.ownerDocument || raiz;
    const textos = doc.createTreeWalker(raiz, 4 /* NodeFilter.SHOW_TEXT */);
    for (let nodo = textos.nextNode(); nodo; nodo = textos.nextNode()) taparTexto(nodo);
    if (raiz.nodeType === 1) taparAtributos(raiz);
    raiz.querySelectorAll?.("[aria-label], [title], [aria-valuetext], [placeholder], [data-tooltip]").forEach(taparAtributos);
  }

  // Lo que la app pinta mientras está activo se tapa al momento (antes de que el navegador lo enseñe: los registros llegan en la misma
  // vuelta). Nuestros propios cambios también generan registros: se descartan con takeRecords().
  function alCambiar(registros) {
    for (const registro of registros) {
      if (registro.type === "characterData") {
        originales.delete(registro.target);
        taparTexto(registro.target);
      } else if (registro.type === "attributes") {
        const guardados = atributosOriginales.get(registro.target);
        if (guardados) delete guardados[registro.attributeName];
        taparAtributos(registro.target);
      } else {
        registro.addedNodes.forEach(taparArbol);
      }
    }
    observador?.takeRecords();
  }

  function aplicarClase(doc, valor) {
    doc.documentElement?.classList.toggle("cifras-ocultas", valor);
  }

  function pintarBoton(doc) {
    const boton = doc.getElementById("ocultarCifrasToggle");
    if (!boton) return;
    // Un interruptor: el nombre no cambia y `aria-pressed` dice si está puesto (cambiar los dos a la vez se lee al revés).
    boton.setAttribute("aria-pressed", activo ? "true" : "false");
  }

  function encender(doc) {
    activo = true;
    aplicarClase(doc, true);
    taparArbol(doc.body);
    if (!observador && typeof root.MutationObserver === "function") {
      observador = new root.MutationObserver(alCambiar);
      observador.observe(doc.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATRIBUTOS });
    }
    pintarBoton(doc);
  }

  function apagar(doc) {
    activo = false;
    observador?.disconnect();
    observador = null;
    originales.forEach((texto, nodo) => {
      if (nodo.isConnected) nodo.nodeValue = texto;
    });
    originales.clear();
    atributosOriginales.forEach((guardados, elemento) => {
      if (!elemento.isConnected) return;
      Object.entries(guardados).forEach(([nombre, valor]) => elemento.setAttribute(nombre, valor));
    });
    atributosOriginales.clear();
    aplicarClase(doc, false);
    pintarBoton(doc);
    // Lo que se pintó mientras estaba activo se rehace con sus cifras.
    try {
      if (typeof root.render === "function") root.render();
    } catch {
      /* si no se puede repintar, al cambiar de pantalla sale bien */
    }
  }

  function alternar(doc = root.document) {
    const siguiente = !activo;
    guardar(siguiente);
    if (siguiente) encender(doc);
    else apagar(doc);
    try {
      root.FinanceMedidor?.anotar?.("ocultar-cifras", siguiente ? "accion" : "descarte");
    } catch {
      /* el medidor es opcional */
    }
    return siguiente;
  }

  function iniciar(doc = root.document) {
    if (!doc || doc.__ocultarCifras) return;
    doc.__ocultarCifras = true;
    doc.addEventListener("click", (event) => {
      if (event.target?.closest?.("#ocultarCifrasToggle")) alternar(doc);
    });
    if (leer()) encender(doc);
    else pintarBoton(doc);
  }

  if (root && root.document && typeof module === "undefined") {
    if (root.document.body) iniciar(root.document);
    else root.document.addEventListener("DOMContentLoaded", () => iniciar(root.document), { once: true });
  }

  return { CLAVE: OCULTAR_CIFRAS_KEY, MASCARA, enmascarar, tieneImporte, iniciar, alternar, activo: () => activo };
});
