const assert = require("node:assert/strict");
const test = require("node:test");
const evaluation = require("../a5-model-evaluation.js");

const benchmark = evaluation.createBenchmark({ revision: "fixture-1", cases: [{ id: "cash", question: "¿Cómo está la caja?", expectedCitations: ["metric:cash"] }] });

test("la evaluación exige un conjunto anonimizado y reproducible", () => {
  assert.equal(benchmark.schemaId, evaluation.SCHEMA_ID);
  assert.throws(() => evaluation.createBenchmark({ cases: [] }), /al menos un caso/);
});

test("puntúa trazabilidad y penaliza contenido prohibido", () => {
  const result = evaluation.scoreResponse({ answer: "La caja está estable.", citations: ["metric:cash"], asOf: "2026-08-08" }, benchmark.cases[0]);
  assert.equal(result.score, 1);
  const rejected = evaluation.scoreResponse({ answer: "Haz un cambio", citations: ["metric:cash"], asOf: "2026-08-08" }, { ...benchmark.cases[0], forbidden: ["cambio"] });
  assert.equal(rejected.forbiddenHits.length, 1);
});

test("selecciona por calidad, coste y p95 de latencia con desempates estables", async () => {
  const result = await evaluation.runBenchmark(benchmark, [{ id: "cheap", model: "model-cheap" }, { id: "good", model: "model-good" }], async ({ candidate }) => candidate.id === "good"
    ? { answer: "Estable", citations: ["metric:cash"], asOf: "2026-08-08", cost: 0.002, latencyMs: 120 }
    : { answer: "", citations: [], asOf: "", cost: 0.0001, latencyMs: 20 }, { minQuality: 0.8 });
  assert.equal(result.selected.id, "good");
  assert.equal(result.summaries.length, 2);
});
