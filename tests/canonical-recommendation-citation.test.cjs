const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { validateRecommendation, validateRecommendations } = require("../canonical-recommendation-citation.js");

// CP3 · Bloque 1: regla de diseño que se construye antes que el motor que la consumirá (CP1,
// "próxima mejor acción", bloque 8, todavía sin construir). Generaliza el control de citas que ya
// existía en canonical-e9-assistant.js (validateResponse), acoplado a la consulta de IA externa,
// para que cualquier recomendación de la app lo reutilice.

test("expone FinanceCanonicalRecommendationCitation al cargarse directamente en navegador", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "canonical-recommendation-citation.js"), "utf8");
  const context = { globalThis: {} };
  vm.runInNewContext(source, context, { filename: "canonical-recommendation-citation.js" });
  assert.equal(typeof context.globalThis.FinanceCanonicalRecommendationCitation?.validateRecommendation, "function");
});

test("una recomendación con texto y cita queda lista", () => {
  const result = validateRecommendation({ label: "Amortiza el préstamo del coche", citations: ["metric:cushion"] });
  assert.equal(result.valid, true);
  assert.equal(result.status, "ready");
  assert.equal(result.summary.blockerCount, 0);
});

test("bloquea una recomendación sin ninguna cita", () => {
  const result = validateRecommendation({ label: "Amortiza el préstamo del coche", citations: [] });
  assert.equal(result.valid, false);
  assert.match(result.blockers.map((item) => item.id).join("|"), /citations-missing/);
});

test("bloquea una recomendación sin el campo citations", () => {
  const result = validateRecommendation({ label: "Amortiza el préstamo del coche" });
  assert.equal(result.valid, false);
  assert.match(result.blockers.map((item) => item.id).join("|"), /citations-missing/);
});

test("bloquea citas que son solo cadenas vacías", () => {
  const result = validateRecommendation({ label: "Amortiza el préstamo del coche", citations: ["", "   "] });
  assert.equal(result.valid, false);
  assert.match(result.blockers.map((item) => item.id).join("|"), /citations-missing/);
});

test("bloquea una recomendación sin texto", () => {
  const result = validateRecommendation({ citations: ["metric:cushion"] });
  assert.equal(result.valid, false);
  assert.match(result.blockers.map((item) => item.id).join("|"), /label-missing/);
});

test("acepta label como alias de title", () => {
  const result = validateRecommendation({ title: "Amortiza el préstamo del coche", citations: ["metric:cushion"] });
  assert.equal(result.valid, true);
});

test("sin catálogo de evidencia disponible, no comprueba que la cita exista de verdad", () => {
  const result = validateRecommendation({ label: "x", citations: ["metric:inventada"] });
  assert.equal(result.valid, true);
  assert.ok(!result.checks.some((item) => item.id === "citations-known"));
});

test("con catálogo de evidencia (array de objetos con id), bloquea una cita que no existe", () => {
  const availableSources = [{ id: "metric:cushion" }, { id: "alert:overspend" }];
  const result = validateRecommendation(
    { label: "Amortiza el préstamo del coche", citations: ["metric:cushion", "metric:inventada"] },
    { availableSources },
  );
  assert.equal(result.valid, false);
  assert.match(result.blockers.map((item) => item.id).join("|"), /citation-unknown/);
  assert.match(result.blockers.find((item) => item.id === "citation-unknown").detail, /metric:inventada/);
});

test("con catálogo de evidencia como Set, acepta citas conocidas", () => {
  const availableSources = new Set(["metric:cushion"]);
  const result = validateRecommendation({ label: "x", citations: ["metric:cushion"] }, { availableSources });
  assert.equal(result.valid, true);
});

test("validateRecommendations agrega varias recomendaciones y cuenta las inválidas", () => {
  const result = validateRecommendations([
    { label: "A", citations: ["metric:cushion"] },
    { label: "B", citations: [] },
    { label: "C" },
  ]);
  assert.equal(result.valid, false);
  assert.equal(result.invalidCount, 2);
  assert.equal(result.results.length, 3);
});

test("validateRecommendations con lista vacía no bloquea nada porque no hay nada que citar", () => {
  const result = validateRecommendations([]);
  assert.equal(result.valid, true);
  assert.equal(result.invalidCount, 0);
});

test("está cargado en index.html antes que app.js, disponible para el futuro motor CP1", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const citationScript = html.indexOf("canonical-recommendation-citation.js");
  const appScript = html.indexOf("app.js?v=");
  assert.ok(citationScript >= 0, "El módulo de la regla de citas debe cargarse en el HTML.");
  assert.ok(appScript >= 0);
  assert.ok(citationScript < appScript, "La regla debe estar disponible antes de app.js.");
});
