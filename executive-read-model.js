(function attachExecutiveReadModel(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceExecutiveReadModel = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function executiveReadModelFactory() {
  "use strict";

  const SCHEMA_ID = "finance-executive-read-model/v1";
  const CONFIDENCE = new Set(["high", "medium", "low"]);

  function text(value, fallback = "") {
    const normalized = String(value ?? "").trim();
    return normalized || fallback;
  }

  function metric(id, input = {}, generatedAt) {
    const confidence = text(input.confidence, "low").toLowerCase();
    return {
      id,
      label: text(input.label, id),
      value: input.value ?? null,
      unit: text(input.unit),
      asOf: text(input.asOf, generatedAt.slice(0, 10)),
      source: text(input.source, "unknown"),
      method: text(input.method, "unknown"),
      coverage: text(input.coverage, "unknown"),
      confidence: CONFIDENCE.has(confidence) ? confidence : "low",
    };
  }

  function build(input = {}) {
    const generatedAt = text(input.generatedAt, new Date().toISOString());
    const metrics = Object.fromEntries(Object.entries(input.metrics || {}).map(([id, value]) => [id, metric(id, value, generatedAt)]));
    const actions = (input.actions || []).slice(0, 3).map((item, index) => ({ ...item, rank: index + 1 }));
    const alerts = Array.isArray(input.alerts) ? input.alerts : [];
    const missingMetadata = Object.values(metrics)
      .filter((item) => [item.source, item.method, item.coverage].includes("unknown"))
      .map((item) => item.id);
    return {
      schema: SCHEMA_ID,
      generatedAt,
      asOf: text(input.asOf, generatedAt.slice(0, 10)),
      decisions: actions,
      alerts,
      capacity: input.capacity || {},
      context: input.context || {},
      metrics,
      quality: {
        complete: missingMetadata.length === 0,
        missingMetadata,
        lowConfidence: Object.values(metrics).filter((item) => item.confidence === "low").map((item) => item.id),
      },
    };
  }

  return { SCHEMA_ID, build, metric };
});
