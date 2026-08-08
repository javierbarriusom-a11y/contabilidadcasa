(function attachE18Health(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceE18Health = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function e18HealthFactory() {
  "use strict";
  const KEY = "finance-e18-local-health";
  function record(kind, storage = globalThis.localStorage) {
    const safeKind = String(kind || "unknown").replace(/[^a-z0-9:-]/gi, "").slice(0, 40);
    try {
      const entries = JSON.parse(storage.getItem(KEY) || "[]");
      const next = [...(Array.isArray(entries) ? entries : []), { kind: safeKind, at: new Date().toISOString() }].slice(-50);
      storage.setItem(KEY, JSON.stringify(next));
      return next;
    } catch { return []; }
  }
  return { KEY, record };
});
