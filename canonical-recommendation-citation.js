(function attachCanonicalRecommendationCitation(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FinanceCanonicalRecommendationCitation = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createCanonicalRecommendationCitation() {
  "use strict";

  // CP3 — regla de diseño: ninguna recomendación puede presentarse sin al menos una cita a la
  // evidencia de la que sale. Se construye antes que el motor que la consumirá (CP1, "próxima mejor
  // acción", bloque 8, todavía sin construir), mismo patrón que AP4 con AP3: sin la regla verificada,
  // no hay recomendación proactiva que mostrar. Generaliza el control de citas que ya existía, acoplado
  // a la consulta de IA externa, en `canonical-e9-assistant.js` (`validateResponse` → "citations-missing"
  // / "citation-unknown") para que cualquier superficie de recomendación lo reutilice, no solo esa.

  const SCHEMA_ID = "finance-canonical-recommendation-citation/v1";

  function text(value, fallback = "") {
    const trimmed = String(value ?? "").trim();
    return trimmed || fallback;
  }

  function issue(id, level, title, detail) {
    return { id, level, title, detail };
  }

  function validateRecommendation(recommendation = {}, { availableSources } = {}) {
    const blockers = [];
    const warnings = [];
    const checks = [];

    const label = text(recommendation.label || recommendation.title);
    if (!label) {
      blockers.push(issue("label-missing", "blocker", "Recomendación sin texto", "Toda recomendación necesita un texto que explique qué propone."));
    }

    const citations = Array.isArray(recommendation.citations)
      ? recommendation.citations.map((item) => text(item)).filter(Boolean)
      : [];
    checks.push({ id: "citations-present", label: "Trae al menos una cita", passed: citations.length > 0 });
    if (!citations.length) {
      blockers.push(issue(
        "citations-missing",
        "blocker",
        "Recomendación sin ninguna cita",
        "Ninguna recomendación puede mostrarse sin al menos una cita a la evidencia de la que sale (un dato, una alerta, una decisión).",
      ));
    }

    if (citations.length && availableSources) {
      const available = availableSources instanceof Set
        ? availableSources
        : new Set(Array.from(availableSources, (item) => text(item?.id ?? item)));
      const unknown = citations.filter((id) => !available.has(id));
      checks.push({ id: "citations-known", label: "Todas las citas existen en la evidencia disponible", passed: unknown.length === 0 });
      if (unknown.length) {
        blockers.push(issue(
          "citation-unknown",
          "blocker",
          "Cita a evidencia que no existe",
          `La recomendación cita ${unknown.join(", ")}, que no está en la evidencia disponible para esta lectura.`,
        ));
      }
    }

    const status = blockers.length ? "blocked" : warnings.length ? "warning" : "ready";
    return {
      schemaId: SCHEMA_ID,
      valid: blockers.length === 0,
      status,
      blockers,
      warnings,
      checks,
      summary: { blockerCount: blockers.length, warningCount: warnings.length, checkCount: checks.length },
    };
  }

  function validateRecommendations(recommendations = [], options = {}) {
    const list = Array.isArray(recommendations) ? recommendations : [];
    const results = list.map((recommendation) => validateRecommendation(recommendation, options));
    return {
      schemaId: SCHEMA_ID,
      valid: results.every((result) => result.valid),
      results,
      invalidCount: results.filter((result) => !result.valid).length,
    };
  }

  return { SCHEMA_ID, validateRecommendation, validateRecommendations };
});
