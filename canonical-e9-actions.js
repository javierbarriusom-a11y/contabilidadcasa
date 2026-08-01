(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.FinanceCanonicalE9Actions = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const SCHEMA_ID = "finance-e9-actions/v1";
  const ACTIONS = Object.freeze({
    "adjust-reserve": { target: "executive-advisor", fields: ["amount"], required: ["amount"] },
    "prepare-debt-payment": { target: "debt-control", fields: ["debtId", "amount", "monthKey"], required: ["debtId", "amount"] },
    "prepare-project": { target: "projects", fields: ["name", "amount", "monthKey", "mode"], required: ["name", "amount", "monthKey"] },
    "create-alert": { target: "alerts-center", fields: ["name", "metric", "operator", "threshold", "frequency"], required: ["name", "metric", "threshold"] },
  });
  const FORBIDDEN = /^(execute|executed|apply|applied|write|mutation|sql|rpc|token|secret|confirmed)$/i;
  const text = (value) => String(value ?? "").trim();
  const list = (value) => (Array.isArray(value) ? value : []);
  const object = (value) => (value && typeof value === "object" && !Array.isArray(value) ? value : {});
  function normalizeValue(key, value) {
    if (["amount", "threshold"].includes(key)) {
      const number = Number(value);
      if (!Number.isFinite(number) || number < 0) throw new Error(`${key} debe ser un importe no negativo.`);
      return Math.round(number * 100) / 100;
    }
    return text(value);
  }
  function prepareDraft(input = {}, context = {}) {
    const action = text(input.action);
    const definition = ACTIONS[action];
    if (!definition) throw new Error("Acción conversacional no permitida.");
    const rawParams = object(input.params);
    Object.keys(rawParams).forEach((key) => { if (FORBIDDEN.test(key)) throw new Error(`Campo prohibido en el borrador: ${key}`); });
    const params = Object.fromEntries(definition.fields.filter((key) => Object.hasOwn(rawParams, key)).map((key) => [key, normalizeValue(key, rawParams[key])]));
    const missing = definition.required.filter((key) => params[key] === undefined || params[key] === "");
    if (missing.length) throw new Error(`Faltan campos obligatorios: ${missing.join(", ")}.`);
    const availableSources = new Set(list(context.sources).map((item) => text(item.id)));
    const citations = [...new Set(list(input.citations).map(text).filter(Boolean))];
    if (!citations.length || citations.some((id) => !availableSources.has(id))) throw new Error("El borrador requiere fuentes internas válidas.");
    const at = text(input.at) || new Date().toISOString();
    return { schemaId: SCHEMA_ID, id: text(input.id) || `draft:${action}:${at}`, action, target: definition.target, params, citations, rationale: text(input.rationale), status: "prepared", createdAt: at, expiresAt: text(input.expiresAt), writesImmediately: false };
  }
  function buildPreview(draft, current = {}) {
    if (draft?.schemaId !== SCHEMA_ID || draft.status !== "prepared") throw new Error("Borrador no preparado.");
    const before = { "adjust-reserve": { amount: Number(current.reserve || 0) }, "prepare-debt-payment": object(current.debt), "prepare-project": null, "create-alert": null }[draft.action];
    const after = { ...(before || {}), ...draft.params };
    const warnings = [];
    if (draft.action === "prepare-debt-payment" && before?.currentPrincipal != null && draft.params.amount > Number(before.currentPrincipal)) warnings.push("El importe supera el capital registrado.");
    return { schemaId: SCHEMA_ID, draftId: draft.id, action: draft.action, target: draft.target, before, after, warnings, valid: warnings.length === 0, writesImmediately: false };
  }
  function confirmDraft(draft, preview, options = {}) {
    if (!options.userConfirmed) throw new Error("La confirmación debe realizarse fuera de la conversación.");
    const reason = text(options.reason);
    if (!reason) throw new Error("La confirmación requiere un motivo.");
    if (draft?.status !== "prepared" || preview?.draftId !== draft.id || !preview.valid) throw new Error("La vista previa no es válida.");
    const at = text(options.at) || new Date().toISOString();
    return { draft: { ...draft, status: "confirmed", confirmedAt: at, confirmationReason: reason }, handoff: { type: "confirmed-draft", draftId: draft.id, action: draft.action, target: draft.target, params: { ...draft.params }, requiresCanonicalHandler: true, executed: false }, event: { type: "conversational-draft-confirmed", draftId: draft.id, action: draft.action, at, reason } };
  }
  function cancelDraft(draft, options = {}) {
    if (draft?.status !== "prepared") throw new Error("Solo se puede cancelar un borrador preparado.");
    const at = text(options.at) || new Date().toISOString();
    return { ...draft, status: "cancelled", cancelledAt: at, cancellationReason: text(options.reason) };
  }
  return { SCHEMA_ID, ACTIONS, buildPreview, cancelDraft, confirmDraft, prepareDraft };
});
