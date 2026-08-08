(function attachE18Health(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceE18Health = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function e18HealthFactory() {
  "use strict";
  const KEY = "finance-e18-local-health";
  const MAX_ENTRIES = 50;
  function append(entry, storage = globalThis.localStorage) {
    try {
      const entries = JSON.parse(storage.getItem(KEY) || "[]");
      const next = [...(Array.isArray(entries) ? entries : []), entry].slice(-MAX_ENTRIES);
      storage.setItem(KEY, JSON.stringify(next));
      return next;
    } catch { return []; }
  }
  function record(kind, storage = globalThis.localStorage) {
    const safeKind = String(kind || "unknown").replace(/[^a-z0-9:-]/gi, "").slice(0, 40);
    return append({ kind: safeKind, at: new Date().toISOString() }, storage);
  }
  function recordDuration(kind, durationMs, storage = globalThis.localStorage) {
    const safeKind = String(kind || "unknown").replace(/[^a-z0-9:-]/gi, "").slice(0, 40);
    return append({ kind: `duration:${safeKind}`, at: new Date().toISOString(), durationMs: Math.max(0, Math.round(Number(durationMs) || 0)) }, storage);
  }
  function recordFailure(kind, storage = globalThis.localStorage) { return record(`failure:${kind}`, storage); }
  function recordPending(count, storage = globalThis.localStorage) {
    return append({ kind: "pending-operations", at: new Date().toISOString(), pending: Math.max(0, Math.floor(Number(count) || 0)) }, storage);
  }
  function summary(storage = globalThis.localStorage) {
    try {
      const entries = JSON.parse(storage.getItem(KEY) || "[]");
      const safeEntries = Array.isArray(entries) ? entries : [];
      const durations = safeEntries.filter((entry) => Number.isFinite(entry.durationMs)).map((entry) => entry.durationMs);
      return { entries: safeEntries.length, failures: safeEntries.filter((entry) => String(entry.kind).startsWith("failure:")).length, pending: safeEntries.filter((entry) => entry.kind === "pending-operations").at(-1)?.pending || 0, averageDurationMs: durations.length ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length) : 0 };
    } catch { return { entries: 0, failures: 0, pending: 0, averageDurationMs: 0 }; }
  }
  return { KEY, record, recordDuration, recordFailure, recordPending, summary };
});
