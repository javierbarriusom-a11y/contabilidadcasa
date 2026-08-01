(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.FinanceCanonicalE11b = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const SCHEMA_ID = "finance-e11b-update-inbox/v1";
  const STATUSES = new Set(["draft", "ready", "blocked", "applied", "undone", "discarded"]);
  const SOURCES = new Set(["manual", "pasted-table", "csv", "excel-workbook", "bank-statement", "psd2"]);
  const clone = (value) => JSON.parse(JSON.stringify(value ?? null));
  const text = (value) => String(value ?? "").trim();
  const finite = (value) => Number.isFinite(Number(value));
  const now = (options) => text(options?.at) || new Date().toISOString();
  const makeId = (prefix, options = {}) => text(options.id) || `${prefix}-${now(options)}-${Math.random().toString(16).slice(2)}`;

  function normalizeSource(value) {
    const source = text(value);
    return SOURCES.has(source) ? source : "manual";
  }

  function normalizeRows(rows = []) {
    return (Array.isArray(rows) ? rows : []).map((row, index) => ({
      ...clone(row),
      inboxRowId: text(row?.inboxRowId || row?.id) || `row-${index + 1}`,
    }));
  }

  function detectFormat(input = {}) {
    const name = text(input.fileName).toLowerCase();
    const mime = text(input.mimeType).toLowerCase();
    if (name.endsWith(".csv") || mime.includes("csv")) return "csv";
    if (name.endsWith(".txt") || mime.includes("text/plain")) return "pasted-table";
    if (name.endsWith(".xls") || name.endsWith(".xlsx") || mime.includes("spreadsheet") || mime.includes("excel")) return input.bankStatement ? "bank-statement" : "excel-workbook";
    return normalizeSource(input.source);
  }

  function buildInboxItem(input = {}, options = {}) {
    const rows = normalizeRows(input.rows);
    const source = detectFormat(input);
    const comparison = clone(input.comparison || {});
    const blockers = [];
    if (!rows.length && source !== "excel-workbook") blockers.push("No se detectaron filas importables.");
    if (comparison.valid === false) blockers.push("La comparación previa no supera las invariantes.");
    const createdAt = now(options);
    return {
      schemaId: SCHEMA_ID,
      id: makeId("inbox", { ...options, at: createdAt }),
      status: blockers.length ? "blocked" : "ready",
      source,
      sourceLabel: text(input.sourceLabel || input.fileName) || "Actualización manual",
      createdAt,
      updatedAt: createdAt,
      step: blockers.length ? "review" : "confirm",
      rows,
      comparison,
      blockers,
      rawStored: false,
      compatibility: { legacyAdapter: text(input.legacyAdapter), canDisableInbox: true },
    };
  }

  function transition(item, status, metadata = {}) {
    if (!item || item.schemaId !== SCHEMA_ID) throw new Error("La entrada no pertenece a la bandeja E11b.");
    if (!STATUSES.has(status)) throw new Error("El estado solicitado no es válido.");
    const allowed = {
      draft: ["ready", "blocked", "discarded"], ready: ["applied", "discarded", "blocked"],
      blocked: ["ready", "discarded"], applied: ["undone"], undone: [], discarded: [],
    };
    if (!allowed[item.status]?.includes(status)) throw new Error(`No se puede pasar de ${item.status} a ${status}.`);
    const at = now(metadata);
    return { ...clone(item), status, step: status === "ready" ? "confirm" : status, updatedAt: at,
      ...(status === "applied" ? { appliedAt: at, batchId: text(metadata.batchId), receiptId: text(metadata.receiptId) } : {}),
      ...(status === "undone" ? { undoneAt: at, undoReason: text(metadata.reason) } : {}),
    };
  }

  function buildReceipt(item, result = {}, options = {}) {
    if (!item || item.status !== "applied") throw new Error("Solo una entrada aplicada puede generar recibo.");
    const changed = result.changed || {};
    return {
      schemaId: `${SCHEMA_ID}/receipt`, id: makeId("receipt", options), inboxId: item.id,
      batchId: text(result.batchId || item.batchId), createdAt: now(options), sourceLabel: item.sourceLabel,
      changed: {
        records: Math.max(0, Number(changed.records || item.rows.length || 0)),
        movements: Math.max(0, Number(changed.movements || 0)),
        actuals: Math.max(0, Number(changed.actuals || 0)),
        balances: Math.max(0, Number(changed.balances || 0)),
      },
      recalculated: Array.isArray(result.recalculated) ? result.recalculated.map(text).filter(Boolean) : [],
      revisionId: text(result.revisionId), undoAvailable: Boolean(result.batchId || item.batchId),
    };
  }

  function freshness(input = {}, options = {}) {
    const asOf = text(options.asOf) || new Date().toISOString().slice(0, 10);
    const dates = (values) => (Array.isArray(values) ? values : []).map((row) => text(row?.date || row?.updatedAt || row)).filter(Boolean).sort();
    const latest = (values) => dates(values).at(-1) || "";
    const areas = {
      balances: { through: text(input.balanceDate), missing: input.balanceDate ? [] : ["saldo con fecha"] },
      movements: { through: latest(input.movements), missing: input.movements?.length ? [] : ["movimientos"] },
      actuals: { through: latest(input.actuals), missing: input.actuals?.length ? [] : ["importes reales"] },
      forecast: { through: text(input.forecastDate), missing: input.forecastDate ? [] : ["previsión revisada"] },
      debt: { through: text(input.debtDate), missing: input.debtDate ? [] : ["contratos de deuda revisados"] },
    };
    Object.values(areas).forEach((area) => { area.status = area.missing.length ? "incomplete" : area.through < asOf ? "stale" : "current"; });
    const complete = Object.values(areas).filter((area) => area.status === "current").length;
    return { schemaId: `${SCHEMA_ID}/freshness`, asOf, areas, coveragePercent: Math.round(complete / Object.keys(areas).length * 100) };
  }

  function reconciliationTasks(input = {}) {
    const tasks = [];
    (input.unclassified || []).forEach((row) => tasks.push({ id: `classify-${text(row.id)}`, cause: "unclassified", action: "classify", label: text(row.description || row.label) || "Clasificar movimiento", target: "movements", safe: true }));
    (input.differences || []).forEach((row, index) => tasks.push({ id: `actual-${text(row.id || index)}`, cause: "bank-actual-difference", action: "correct-actual", label: text(row.label) || "Corregir importe real", target: "update-data", safe: true }));
    (input.balanceGaps || []).forEach((row, index) => tasks.push({ id: `balance-${text(row.id || index)}`, cause: "balance-gap", action: "adjust-balance", label: text(row.accountId) || "Revisar saldo", target: "update-hub", safe: true }));
    return tasks;
  }

  function migratePayload(payload = {}) {
    const next = clone(payload) || {};
    if (!Array.isArray(next.dataInbox)) next.dataInbox = [];
    if (!Array.isArray(next.updateReceipts)) next.updateReceipts = [];
    next.e11b = { ...(next.e11b || {}), schemaId: SCHEMA_ID, enabled: next.e11b?.enabled !== false };
    return next;
  }

  return { SCHEMA_ID, STATUSES, SOURCES, buildInboxItem, buildReceipt, detectFormat, freshness, migratePayload, reconciliationTasks, transition };
});
