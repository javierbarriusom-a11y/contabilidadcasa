(function exposeXlsxLoader(root, factory) {
  const api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) {
    root.ensureXlsx = api.ensureXlsx;
    root.xlsxReady = api.xlsxReady;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createXlsxLoader(root) {
  "use strict";

  // Ola 1 · P2: SheetJS pesa 882 KB (200 KB en brotli) y solo se usa al importar un Excel o al
  // exportar el informe. index.html ya no lo carga al arrancar; se pide la primera vez que hace
  // falta. Sigue en la caché offline del Service Worker (SHELL_URLS), así que sin red también abre.
  const XLSX_SRC = "vendor/xlsx.full.min.js?v=20260602a";
  let pending = null;

  function available() {
    return Boolean(root.XLSX && typeof root.XLSX.read === "function");
  }

  function ensureXlsx() {
    if (available()) return Promise.resolve(root.XLSX);
    if (pending) return pending;
    pending = new Promise((resolve, reject) => {
      const script = root.document.createElement("script");
      script.src = XLSX_SRC;
      script.onload = () => {
        if (available()) resolve(root.XLSX);
        else { pending = null; reject(new Error("La librería Excel se descargó pero no se pudo inicializar.")); }
      };
      script.onerror = () => {
        script.remove();
        pending = null; // permite reintentar (p. ej. sin red la primera vez)
        reject(new Error("No se pudo descargar la librería Excel."));
      };
      root.document.head.appendChild(script);
    });
    return pending;
  }

  // Versión que nunca rechaza: true si la librería está lista (o se acaba de cargar), false si no.
  function xlsxReady() {
    return ensureXlsx().then(() => true, () => false);
  }

  return { ensureXlsx, xlsxReady };
});
