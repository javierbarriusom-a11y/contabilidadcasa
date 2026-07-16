(function exposeFinanceUxShell(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceUxShell = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function buildFinanceUxShell() {
  "use strict";

  function shouldRenderView({ viewId = "", lastView = "", revision = 0, lastRevision = -1, force = false } = {}) {
    if (force) return true;
    return String(viewId) !== String(lastView) || Number(revision) !== Number(lastRevision);
  }

  function makeDocumentTitle(title, brand = "Finanzas Casa") {
    const cleanTitle = String(title || "Dashboard").trim();
    const cleanBrand = String(brand || "Finanzas Casa").trim();
    return cleanTitle === cleanBrand ? cleanBrand : `${cleanTitle} | ${cleanBrand}`;
  }

  function statusMessage(title, { busy = false } = {}) {
    const cleanTitle = String(title || "Esta sección").trim();
    return busy ? `Calculando ${cleanTitle}.` : `${cleanTitle} lista.`;
  }

  return {
    shouldRenderView,
    makeDocumentTitle,
    statusMessage,
  };
});
