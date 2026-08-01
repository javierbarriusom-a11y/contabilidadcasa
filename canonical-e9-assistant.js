(function (root, factory) {
  const foundation = typeof module === "object" && module.exports ? require("./canonical-e9-foundation.js") : root.FinanceCanonicalE9Foundation;
  const api = factory(foundation);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.FinanceCanonicalE9Assistant = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (foundation) {
  "use strict";
  const SCHEMA_ID = "finance-e9-assistant/v1";
  const READ_MODEL_SCHEMA = "finance-executive-read-model/v1";
  const WRITE_KEYS = /^(command|commands|mutation|mutations|write|writes|draft|drafts|patch|changes)$/i;
  const text = (value, fallback = "") => String(value ?? "").trim() || fallback;
  const list = (value) => (Array.isArray(value) ? value : []);
  const object = (value) => (value && typeof value === "object" && !Array.isArray(value) ? value : {});

  function sourceCatalog(readModel = {}) {
    const metrics = Object.values(object(readModel.metrics)).map((item) => ({
      id: `metric:${text(item.id)}`, kind: "metric", label: text(item.label), asOf: text(item.asOf || readModel.asOf),
      source: text(item.source), method: text(item.method), coverage: text(item.coverage), confidence: text(item.confidence, "low"),
      value: item.value ?? null, unit: text(item.unit),
    }));
    const decisions = list(readModel.decisions).map((item, index) => ({ id: `decision:${text(item.id || item.key || index)}`, kind: "decision", label: text(item.title || item.label), rank: Number(item.rank || index + 1) }));
    const alerts = list(readModel.alerts).map((item, index) => ({ id: `alert:${text(item.id || index)}`, kind: "alert", label: text(item.title || item.label), status: text(item.status) }));
    return [...metrics, ...decisions, ...alerts];
  }

  function prepareQuery(input = {}) {
    const question = text(input.question);
    if (!question) throw new Error("La consulta no puede estar vacía.");
    if (question.length > 600) throw new Error("La consulta supera el límite de 600 caracteres.");
    const readModel = object(input.readModel);
    if (readModel.schema !== READ_MODEL_SCHEMA) throw new Error("El asistente solo admite el modelo ejecutivo canónico.");
    const access = foundation.serviceAccess(input.foundation, "assistant", ["finance:read", "assistant:query"], { remoteAvailable: input.remoteAvailable, at: input.at });
    const payload = foundation.minimizePayload("assistant", {
      question,
      readModel: { schema: readModel.schema, asOf: readModel.asOf, generatedAt: readModel.generatedAt, capacity: object(readModel.capacity), context: object(readModel.context), quality: object(readModel.quality), sources: sourceCatalog(readModel) },
      provenance: { schema: READ_MODEL_SCHEMA, asOf: readModel.asOf, generatedAt: readModel.generatedAt },
    });
    return { schemaId: SCHEMA_ID, mode: access.allowed ? "remote-read-only" : "local", access, payload };
  }

  function findWritePath(value, path = "response") {
    if (Array.isArray(value)) {
      for (let index = 0; index < value.length; index += 1) { const found = findWritePath(value[index], `${path}[${index}]`); if (found) return found; }
      return "";
    }
    if (!value || typeof value !== "object") return "";
    for (const [key, child] of Object.entries(value)) {
      if (WRITE_KEYS.test(key)) return `${path}.${key}`;
      const found = findWritePath(child, `${path}.${key}`); if (found) return found;
    }
    return "";
  }

  function validateResponse(response = {}, query = {}) {
    const answer = text(response.answer);
    if (!answer) return { valid: false, reason: "answer-missing" };
    const writePath = findWritePath(response);
    if (writePath) return { valid: false, reason: "write-content-forbidden", path: writePath };
    const available = new Set(list(query.payload?.readModel?.sources).map((item) => item.id));
    const citations = list(response.citations).map(text).filter(Boolean);
    if (!citations.length) return { valid: false, reason: "citations-missing" };
    const unknownCitations = citations.filter((id) => !available.has(id));
    if (unknownCitations.length) return { valid: false, reason: "citation-unknown", unknownCitations };
    if (text(response.asOf) !== text(query.payload?.readModel?.asOf)) return { valid: false, reason: "date-mismatch" };
    return { valid: true, result: { schemaId: SCHEMA_ID, mode: "remote-read-only", answer, citations, asOf: text(response.asOf), confidence: ["high", "medium", "low"].includes(response.confidence) ? response.confidence : "low", warning: "Respuesta informativa; no modifica el plan ni sustituye una revisión profesional." } };
  }

  function localDisclosure(readModel = {}) {
    return { mode: "local", label: "Análisis local basado en reglas", detail: `Asistente externo desactivado · ${text(readModel.schema, "sin modelo")} · datos ${text(readModel.asOf, "sin fecha")}`, writes: false };
  }
  return { SCHEMA_ID, READ_MODEL_SCHEMA, findWritePath, localDisclosure, prepareQuery, sourceCatalog, validateResponse };
});
