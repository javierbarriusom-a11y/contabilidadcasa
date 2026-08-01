const assert = require("node:assert/strict");
const test = require("node:test");
const foundation = require("../canonical-e9-foundation.js");
const assistant = require("../canonical-e9-assistant.js");
const readModel = {
  schema: "finance-executive-read-model/v1", generatedAt: "2026-08-01T12:00:00Z", asOf: "2026-08-01",
  capacity: { free: 300 }, context: { family: "household" }, quality: { complete: true },
  metrics: { cash: { id: "cash", label: "Caja", value: 1000, unit: "EUR", asOf: "2026-08-01", source: "ledger", method: "balance", coverage: "complete", confidence: "high" } },
  decisions: [{ id: "save", title: "Mantener reserva", rank: 1 }], alerts: [],
};
test("sin consentimiento prepara únicamente análisis local y un payload mínimo", () => {
  const query = assistant.prepareQuery({ question: "¿Cómo está la caja?", readModel, foundation: foundation.createFoundation() });
  assert.equal(query.mode, "local"); assert.equal(query.access.fallback, "local");
  assert.deepEqual(Object.keys(query.payload).sort(), ["provenance", "question", "readModel"]);
  assert.equal(query.payload.readModel.metrics, undefined); assert.equal(query.payload.readModel.sources[0].id, "metric:cash");
});
test("solo el consentimiento completo habilita una consulta remota de lectura", () => {
  const state = foundation.grantConsent(foundation.createFoundation(), { service: "assistant", purpose: "Responder consultas", scopes: ["finance:read", "assistant:query"] });
  assert.equal(assistant.prepareQuery({ question: "¿Cómo está la caja?", readModel, foundation: state }).mode, "remote-read-only");
});
test("rechaza modelos distintos, consultas vacías y consultas excesivas", () => {
  assert.throws(() => assistant.prepareQuery({ question: "", readModel, foundation: foundation.createFoundation() }), /vacía/);
  assert.throws(() => assistant.prepareQuery({ question: "x".repeat(601), readModel, foundation: foundation.createFoundation() }), /600/);
  assert.throws(() => assistant.prepareQuery({ question: "Hola", readModel: { schema: "otro" }, foundation: foundation.createFoundation() }), /modelo ejecutivo/);
});
test("una respuesta necesita fecha y fuentes existentes", () => {
  const query = assistant.prepareQuery({ question: "¿Cómo está la caja?", readModel, foundation: foundation.createFoundation() });
  assert.equal(assistant.validateResponse({ answer: "Correcta", citations: [], asOf: "2026-08-01" }, query).reason, "citations-missing");
  assert.equal(assistant.validateResponse({ answer: "Correcta", citations: ["metric:fake"], asOf: "2026-08-01" }, query).reason, "citation-unknown");
  assert.equal(assistant.validateResponse({ answer: "Correcta", citations: ["metric:cash"], asOf: "2026-07-31" }, query).reason, "date-mismatch");
});
test("rechaza cualquier intento de incluir escrituras o borradores", () => {
  const query = assistant.prepareQuery({ question: "¿Cómo está la caja?", readModel, foundation: foundation.createFoundation() });
  assert.equal(assistant.validateResponse({ answer: "Hazlo", citations: ["metric:cash"], asOf: "2026-08-01", nested: { command: { type: "save" } } }, query).reason, "write-content-forbidden");
});
test("acepta una respuesta trazable y la mantiene informativa", () => {
  const query = assistant.prepareQuery({ question: "¿Cómo está la caja?", readModel, foundation: foundation.createFoundation() });
  const result = assistant.validateResponse({ answer: "La caja registrada es suficiente.", citations: ["metric:cash"], asOf: "2026-08-01", confidence: "high" }, query);
  assert.equal(result.valid, true); assert.equal(result.result.mode, "remote-read-only"); assert.match(result.result.warning, /no modifica/);
});
