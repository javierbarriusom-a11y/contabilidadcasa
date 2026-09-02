const test = require("node:test");
const assert = require("node:assert/strict");

const IRPF = require("../canonical-irpf-estimator.js");

// A15-2 (BACKLOG_ULTIMATE_SEPTIEMBRE.md bloque 9, depende de A15-1): "estimador de resultado de
// IRPF". Reutiliza el estándar de A2-3 (canonical-e7-analysis.js): resultado como rango, fecha de
// referencia, aviso de que no sustituye asesoría fiscal, fuente citada. Este motor NUNCA trae
// tramos de fábrica — ni la escala general estatal ni ninguna autonómica; el hogar debe
// registrarlas con su fuente antes de poder calcular nada (mismo criterio de A15-5: "ninguna
// cifra fiscal se fabrica aquí").

const VALID_SOURCE = { title: "Escala general estatal", authority: "AEAT", url: "https://sede.agenciatributaria.gob.es/x", checkedAt: "2026-09-02" };

function scaleWith(overrides = {}) {
  return {
    id: "test-scale",
    year: 2025,
    source: VALID_SOURCE,
    brackets: IRPF.parseBracketScaleInput("12450:9.5, 20200:12, :22.5"),
    ...overrides,
  };
}

test("parseBracketScaleInput interpreta \"límite:tipo, ...\" con el último tramo sin límite", () => {
  const brackets = IRPF.parseBracketScaleInput("12450:9.5, 20200:12, :22.5");
  assert.deepEqual(brackets, [
    { limit: 12450, rate: 9.5 },
    { limit: 20200, rate: 12 },
    { limit: null, rate: 22.5 },
  ]);
});

test("validateBracketScale exige que el último tramo quede abierto (sin límite)", () => {
  const scale = scaleWith({ brackets: IRPF.parseBracketScaleInput("12450:9.5, 20200:12") });
  const validation = IRPF.validateBracketScale(scale);
  assert.equal(validation.valid, false);
  assert.ok(validation.issues.includes("ultimo-tramo-debe-quedar-abierto"));
});

test("validateBracketScale exige límites estrictamente crecientes", () => {
  const scale = scaleWith({ brackets: IRPF.parseBracketScaleInput("20200:12, 12450:9.5, :22.5") });
  const validation = IRPF.validateBracketScale(scale);
  assert.equal(validation.valid, false);
  assert.ok(validation.issues.some((issue) => issue.includes("limites-no-crecientes")));
});

test("validateBracketScale exige tipos entre 0 y 100", () => {
  const scale = scaleWith({ brackets: IRPF.parseBracketScaleInput("12450:150, :22.5") });
  assert.equal(IRPF.validateBracketScale(scale).valid, false);
});

test("validateBracketScale rechaza una fuente incompleta (sin URL https o sin fecha AAAA-MM-DD)", () => {
  assert.equal(IRPF.validateBracketScale(scaleWith({ source: { ...VALID_SOURCE, url: "" } })).valid, false);
  assert.equal(IRPF.validateBracketScale(scaleWith({ source: { ...VALID_SOURCE, checkedAt: "02/09/2026" } })).valid, false);
  assert.equal(IRPF.validateBracketScale(scaleWith({ source: { ...VALID_SOURCE, authority: "" } })).valid, false);
});

test("validateBracketScale acepta una escala bien formada con fuente completa", () => {
  assert.equal(IRPF.validateBracketScale(scaleWith()).valid, true);
});

test("progressiveTax aplica cada tramo solo a la porción de base que cae dentro de él", () => {
  const brackets = IRPF.parseBracketScaleInput("10000:10, 20000:20, :30");
  // 10.000 al 10% = 1.000; siguientes 10.000 (hasta 20.000) al 20% = 2.000; resto (5.000) al 30% = 1.500
  assert.equal(IRPF.progressiveTax(25000, brackets), 4500);
});

test("progressiveTax con base cero o negativa no genera cuota", () => {
  const brackets = IRPF.parseBracketScaleInput("10000:10, :20");
  assert.equal(IRPF.progressiveTax(0, brackets), 0);
  assert.equal(IRPF.progressiveTax(-500, brackets), 0);
});

test("estimateIrpfResult: sin las dos escalas válidas, no es calculable — nunca un resultado inventado", () => {
  const result = IRPF.estimateIrpfResult({ taxableBaseRange: { low: 1000, high: 1000 }, withholdingsPaid: 100, stateScale: {}, regionalScale: {} });
  assert.equal(result.calculable, false);
  assert.equal(result.reason, "missing-brackets");
});

test("estimateIrpfResult: con las dos escalas registradas, calcula un rango de resultado según el rango de base declarado", () => {
  const stateScale = scaleWith({ id: "state" });
  const regionalScale = scaleWith({ id: "madrid", region: "Madrid", brackets: IRPF.parseBracketScaleInput("12450:8.5, 20200:10.7, :20.5") });
  const result = IRPF.estimateIrpfResult({
    taxableBaseRange: { low: 20000, high: 30000 },
    withholdingsPaid: 5000,
    stateScale, regionalScale,
  });
  assert.equal(result.calculable, true);
  assert.ok(result.resultRange.low <= result.resultRange.high, "el extremo bajo del rango nunca supera al alto");
  assert.equal(result.sources.length, 2);
});

test("estimateIrpfResult: a más base imponible, menos a devolver (o más a pagar) — la dirección es coherente", () => {
  const stateScale = scaleWith();
  const regionalScale = scaleWith({ region: "Madrid" });
  const lowBase = IRPF.estimateIrpfResult({ taxableBaseRange: { low: 10000, high: 10000 }, withholdingsPaid: 3000, stateScale, regionalScale });
  const highBase = IRPF.estimateIrpfResult({ taxableBaseRange: { low: 80000, high: 80000 }, withholdingsPaid: 3000, stateScale, regionalScale });
  assert.ok(lowBase.resultRange.low > highBase.resultRange.low, "una base mayor debe dejar un resultado menor (más cuota, menos a devolver)");
});

test("estimateIrpfResult: una base única (mínimo == máximo) da un rango colapsado, no dos cifras distintas", () => {
  const stateScale = scaleWith();
  const regionalScale = scaleWith({ region: "Madrid" });
  const result = IRPF.estimateIrpfResult({ taxableBaseRange: { low: 25000, high: 25000 }, withholdingsPaid: 4000, stateScale, regionalScale });
  assert.equal(result.resultRange.low, result.resultRange.high);
});

test("estimateIrpfResult siempre incluye el aviso de que no sustituye asesoría fiscal", () => {
  const result = IRPF.estimateIrpfResult({ taxableBaseRange: { low: 1, high: 1 }, withholdingsPaid: 0, stateScale: {}, regionalScale: {} });
  assert.match(result.warning, /no sustituye|profesional/i);
});
