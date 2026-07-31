(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.FinanceCanonicalMonthClose = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const SCHEMA_ID = "finance-month-close-v1";

  function text(value) {
    return String(value ?? "").trim();
  }

  function validMonthKey(value) {
    return /^\d{4}-(0[1-9]|1[0-2])$/.test(text(value));
  }

  function actualMonthKey(key) {
    const match = text(key).match(/(?:^|[|:_-])(\d{4}-(?:0[1-9]|1[0-2]))(?:$|[|:_-])/);
    return match?.[1] || "";
  }

  function closeMonth(payload = {}, monthKey, metadata = {}) {
    if (!validMonthKey(monthKey)) throw new Error("El mes de cierre no es válido.");
    const closures = Array.isArray(payload.monthClosures) ? payload.monthClosures : [];
    if (closures.some((item) => item.monthKey === monthKey && item.status === "closed")) {
      throw new Error("El mes ya está cerrado.");
    }
    const closedAt = metadata.closedAt || new Date().toISOString();
    const incomeActuals = Object.fromEntries(Object.entries(payload.incomeActuals || {})
      .filter(([key]) => actualMonthKey(key) === monthKey));
    const expenseActuals = Object.fromEntries(Object.entries(payload.expenseActuals || {})
      .filter(([key]) => actualMonthKey(key) === monthKey));
    const closure = {
      schemaId: SCHEMA_ID,
      id: metadata.id || `close-${monthKey}-${closedAt}`,
      monthKey,
      status: "closed",
      closedAt,
      reason: text(metadata.reason || "Cierre mensual confirmado"),
      actuals: { income: incomeActuals, expense: expenseActuals },
    };
    return { ...payload, monthClosures: [...closures, closure] };
  }

  function isMonthClosed(payload = {}, monthKey) {
    return Array.isArray(payload.monthClosures)
      && payload.monthClosures.some((item) => item.monthKey === monthKey && item.status === "closed");
  }

  return { SCHEMA_ID, actualMonthKey, closeMonth, isMonthClosed, validMonthKey };
});
