"use strict";

const SCHEMA_ID = "finance-a5-model-evaluation/v1";

const text = (value) => String(value ?? "").trim();
const list = (value) => (Array.isArray(value) ? value : []);
const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

function normalizeCase(input = {}, index = 0) {
  const id = text(input.id) || `case-${index + 1}`;
  const question = text(input.question);
  if (!question) throw new Error(`El caso ${id} requiere una pregunta.`);
  const citations = [...new Set(list(input.expectedCitations).map(text).filter(Boolean))];
  if (!citations.length) throw new Error(`El caso ${id} requiere fuentes esperadas.`);
  return { id, question, expectedCitations: citations, forbidden: list(input.forbidden).map(text).filter(Boolean) };
}

function createBenchmark(input = {}) {
  const cases = list(input.cases).map(normalizeCase);
  if (!cases.length) throw new Error("La evaluación requiere al menos un caso.");
  return {
    schemaId: SCHEMA_ID,
    revision: text(input.revision) || "a5-2-1",
    dataset: text(input.dataset) || "anonymized-finance-read-model",
    cases,
  };
}

function scoreResponse(response = {}, testCase = {}) {
  const answer = text(response.answer);
  const citations = new Set(list(response.citations).map(text));
  const expected = list(testCase.expectedCitations);
  const citationCoverage = expected.length ? expected.filter((id) => citations.has(id)).length / expected.length : 0;
  const forbiddenText = `${answer} ${JSON.stringify(response)}`.toLowerCase();
  const forbiddenHits = list(testCase.forbidden).filter((term) => forbiddenText.includes(text(term).toLowerCase()));
  const validShape = Boolean(answer && citations.size && text(response.asOf));
  const score = Math.max(0, Math.min(1, (validShape ? 0.4 : 0) + citationCoverage * 0.6 - forbiddenHits.length * 0.4));
  return { score, validShape, citationCoverage, forbiddenHits };
}

function summarizeCandidate(candidate = {}, results = [], options = {}) {
  const rows = list(results);
  const scores = rows.map((row) => number(row.score));
  const latencies = rows.map((row) => number(row.latencyMs)).filter((value) => value >= 0);
  const costs = rows.map((row) => number(row.cost)).filter((value) => value >= 0);
  const mean = (values) => values.length ? values.reduce((total, value) => total + value, 0) / values.length : 0;
  const sortedLatency = [...latencies].sort((a, b) => a - b);
  const p95 = sortedLatency.length ? sortedLatency[Math.min(sortedLatency.length - 1, Math.ceil(sortedLatency.length * 0.95) - 1)] : 0;
  const quality = mean(scores);
  const cost = mean(costs);
  const latencyP95Ms = p95;
  const qualityWeight = number(options.qualityWeight, 0.6);
  const costWeight = number(options.costWeight, 0.2);
  const latencyWeight = number(options.latencyWeight, 0.2);
  const maxCost = Math.max(number(options.maxCost, 0.01), cost, 0.000001);
  const maxLatency = Math.max(number(options.maxLatencyMs, 5000), latencyP95Ms, 1);
  const valueScore = qualityWeight * quality + costWeight * (1 - Math.min(cost / maxCost, 1)) + latencyWeight * (1 - Math.min(latencyP95Ms / maxLatency, 1));
  return {
    id: text(candidate.id), model: text(candidate.model), samples: rows.length,
    quality: Number(quality.toFixed(6)), meanCost: Number(cost.toFixed(8)), latencyP95Ms,
    valueScore: Number(valueScore.toFixed(6)), accepted: quality >= number(options.minQuality, 0.8),
  };
}

function selectModel(summaries = [], options = {}) {
  const eligible = list(summaries).filter((row) => row.accepted !== false && number(row.quality) >= number(options.minQuality, 0.8));
  if (!eligible.length) throw new Error("Ningún modelo supera el umbral de calidad configurado.");
  return [...eligible].sort((a, b) => b.valueScore - a.valueScore || b.quality - a.quality || a.meanCost - b.meanCost || a.latencyP95Ms - b.latencyP95Ms)[0];
}

async function runBenchmark(benchmark, candidates, invoke, options = {}) {
  if (typeof invoke !== "function") throw new Error("La evaluación requiere una función de invocación inyectada.");
  const summaries = [];
  for (const candidate of list(candidates)) {
    const results = [];
    for (const testCase of benchmark.cases) {
      const started = Date.now();
      const response = await invoke({ candidate, testCase, benchmark });
      const latencyMs = Math.max(0, number(response.latencyMs, Date.now() - started));
      const score = scoreResponse(response, testCase);
      results.push({ ...score, latencyMs, cost: number(response.cost) });
    }
    summaries.push(summarizeCandidate(candidate, results, options));
  }
  return { schemaId: SCHEMA_ID, benchmark: benchmark.revision, summaries, selected: selectModel(summaries, options) };
}

module.exports = { SCHEMA_ID, createBenchmark, normalizeCase, runBenchmark, scoreResponse, selectModel, summarizeCandidate };
