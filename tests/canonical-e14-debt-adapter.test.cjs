const test = require("node:test");
const assert = require("node:assert/strict");
const E14 = require("../canonical-e14-debt-adapter.js");

function validForecast() {
  return {
    schemaId: "finance-canonical-forecast/v1",
    fingerprint: "forecast-1",
    valid: true,
    series: [
      { monthKey: "2026-08", totals: { income: 3000, outflowsBeforeSaving: 2200, closingLiquidity: 9800 } },
      { monthKey: "2026-09", totals: { income: 3100, outflowsBeforeSaving: 2300, closingLiquidity: 10200 } },
    ],
  };
}

test("clasifica todos los campos persistidos conocidos y deja lo desconocido como ambiguo", () => {
  assert.equal(E14.classifyField("cb_amount"), "canonical");
  assert.equal(E14.classifyField("tasks"), "operational");
  assert.equal(E14.classifyField("cb_discount"), "assumption");
  assert.equal(E14.classifyField("notes"), "note");
  assert.equal(E14.classifyField("legacyMystery"), "ambiguous");
});

test("el adaptador enlaza solo contratos únicos y toma liquidez y capacidad del forecast canónico", () => {
  const input = {
    roadmapState: { cb_amount: "4000", notes: "Conservar" },
    contracts: [
      { id: "a", entity: "Entidad A", currentPrincipal: 6000, paymentStatus: "active" },
      { id: "b", entity: "Entidad B", currentPrincipal: 3500, paymentStatus: "suspended" },
    ],
    forecast: validForecast(),
    generatedAt: "2026-08-02T10:00:00.000Z",
  };
  const before = structuredClone(input);
  const result = E14.buildReadModel(input);
  assert.deepEqual(input, before, "el adaptador no debe mutar contratos, forecast ni estado heredado");
  assert.deepEqual(result.canonicalValues, { cb_amount: 6000, bk_amount: 3500, liquidity: 9000, monthly: 800, baseMonth: "2026-08" });
  assert.deepEqual(result.ambiguous, []);
  assert.equal(result.mode, "read-only");
});

test("una correspondencia duplicada o un forecast inválido conserva los campos como ambiguos", () => {
  const result = E14.buildReadModel({
    roadmapState: { cb_amount: "4100", liquidity: "7000" },
    contracts: [
      { id: "a1", entity: "Entidad A", currentPrincipal: 6000 },
      { id: "a2", entity: "Entidad A", currentPrincipal: 1000 },
      { id: "b", entity: "Entidad B", currentPrincipal: 3500 },
    ],
    forecast: { valid: false, series: [] },
  });
  assert.equal(result.canonicalValues.cb_amount, undefined);
  assert.equal(result.canonicalValues.bk_amount, 3500);
  assert.ok(result.ambiguous.includes("cb_amount"));
  assert.ok(result.ambiguous.includes("liquidity"));
  assert.equal(result.roadmapState.cb_amount, "4100");
});

// D1 (Fase 2): cualquier contrato real que no sea Entidad A/B, no esté liquidado y no sea el plan
// reunificado sintético se expone como cuenta adicional simulable en el sandbox (extraDebts).
test("extraDebts expone las deudas reales adicionales a Entidad A/B, excluyendo liquidadas y el plan reunificado sintético", () => {
  const result = E14.buildReadModel({
    roadmapState: {},
    contracts: [
      { id: "a", entity: "Entidad A", currentPrincipal: 6000, paymentStatus: "active" },
      { id: "b", entity: "Entidad B", currentPrincipal: 3500, paymentStatus: "active" },
      { id: "debt-3", entity: "Nueva tarjeta", type: "Tarjeta", currentPrincipal: 1200, paymentStatus: "active" },
      { id: "debt-4", entity: "Préstamo ya saldado", currentPrincipal: 0, paymentStatus: "settled" },
      { id: "debt-reunified-cetelem", entity: "Cetelem", currentPrincipal: 9500, paymentStatus: "active" },
    ],
    forecast: validForecast(),
  });
  assert.deepEqual(result.extraDebts, [{ id: "debt-3", entity: "Nueva tarjeta", type: "Tarjeta", currentPrincipal: 1200, paymentStatus: "active" }]);
});

test("extraDebts está vacío cuando el hogar solo tiene declaradas Entidad A y Entidad B", () => {
  const result = E14.buildReadModel({
    roadmapState: {},
    contracts: [
      { id: "a", entity: "Entidad A", currentPrincipal: 6000, paymentStatus: "active" },
      { id: "b", entity: "Entidad B", currentPrincipal: 3500, paymentStatus: "active" },
    ],
    forecast: validForecast(),
  });
  assert.deepEqual(result.extraDebts, []);
});

test("extraDebts nunca muta los contratos de entrada ni depende de encontrar Entidad A/B de forma única", () => {
  const contracts = [
    { id: "a1", entity: "Entidad A", currentPrincipal: 6000, paymentStatus: "active" },
    { id: "a2", entity: "Entidad A", currentPrincipal: 1000, paymentStatus: "active" },
    { id: "c", entity: "Otra deuda", currentPrincipal: 800, paymentStatus: "active" },
  ];
  const before = structuredClone(contracts);
  const result = E14.buildReadModel({ roadmapState: {}, contracts, forecast: { valid: false, series: [] } });
  assert.deepEqual(contracts, before);
  // Entidad A es ambigua (dos contratos): ninguno de los dos puede excluirse como "el" cb, así que
  // ambos, más la deuda no relacionada, quedan disponibles como cuentas propias del sandbox.
  assert.deepEqual(result.extraDebts.map((account) => account.id).sort(), ["a1", "a2", "c"]);
});

test("el contrato común normaliza quita, refinanciación, suspensión, mora y reanudación", () => {
  const contract = { id: "debt-a", currentPrincipal: 6000, paymentStatus: "suspended", arrearsEstimated: 360 };
  const settlement = E14.normalizeStrategy({ strategy: "quita", discount: 55, amount: 2700, monthKey: "2026-09" }, contract);
  const refinancing = E14.normalizeStrategy({ strategy: "refi", apr: 7, duration: 36, monthKey: "2026-10" }, contract);
  const suspension = E14.normalizeStrategy({ strategy: "suspension" }, contract);
  const arrears = E14.normalizeStrategy({ strategy: "arrears", arrears: 400 }, contract);
  const resume = E14.normalizeStrategy({ strategy: "resume", duration: 24, monthKey: "2026-11" }, contract);
  assert.equal(settlement.type, "settlement");
  assert.equal(refinancing.type, "refinancing");
  assert.equal(suspension.type, "suspension");
  assert.equal(arrears.type, "arrears");
  assert.equal(resume.type, "resume-payments");
  assert.ok([settlement, refinancing, suspension, arrears, resume].every((item) => item.valid));
});
