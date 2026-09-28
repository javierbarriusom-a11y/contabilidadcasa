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

// D1 (Fase 3): resolución de cuenta→contrato y construcción de la oferta borrador del puente
// sandbox → plan real. Lógica pura, movida aquí desde app.js para no tocar el techo de ARQ-4.

test("dynamicAccountKey sanea el id igual que accountKey() en debt-roadmap.html", () => {
  assert.equal(E14.dynamicAccountKey("debt-3"), "acct_debt-3");
  assert.equal(E14.dynamicAccountKey("Préstamo/coche"), "acct_Pr_stamo_coche");
});

test("resolveAccountContract · cb/bk resuelven a entityA/entityB, y una clave dinámica a su cuenta por id saneado", () => {
  const canonical = { contracts: { entityA: { id: "debt-1" }, entityB: null }, extraDebts: [{ id: "debt-3", entity: "Otra deuda" }] };
  assert.equal(E14.resolveAccountContract("cb", canonical).id, "debt-1");
  assert.equal(E14.resolveAccountContract("bk", canonical), null);
  assert.equal(E14.resolveAccountContract("acct_debt-3", canonical).entity, "Otra deuda");
  assert.equal(E14.resolveAccountContract("acct_debt-nope", canonical), null);
});

function normalizeOfferStub(raw) {
  return { ...raw, valid: true, discount: 0 };
}

test("buildDraftOffer · construye una oferta borrador con vigencia en blanco cuando la cuenta está vinculada y tiene desembolso", () => {
  const canonical = { contracts: { entityA: { id: "debt-1", entity: "Entidad A", currentPrincipal: 4000 } } };
  const result = E14.buildDraftOffer({
    accountKey: "cb", account: { strategy: "settlement", lump: 1800, financed: 0, monthly: 0, apr: 0, term: 1 },
    canonical, existingOffers: [], normalizeOffer: normalizeOfferStub,
  });
  assert.equal(result.ok, true);
  assert.equal(result.offer.contractId, "debt-1");
  assert.equal(result.offer.counterpart, "Entidad A");
  assert.equal(result.offer.amount, 1800);
  assert.equal(result.offer.status, "draft");
  assert.equal(result.offer.source, "sandbox");
  assert.equal(result.offer.expiresAt, "");
  assert.equal(result.replaceIndex, -1, "no hay ninguna oferta previa que sustituir");
});

test("buildDraftOffer · un segundo envío de la misma cuenta apunta a sustituir la oferta borrador existente, nunca a duplicarla", () => {
  const canonical = { contracts: { entityA: { id: "debt-1", entity: "Entidad A", currentPrincipal: 4000 } } };
  const existingOffers = [{ id: "offer-x", contractId: "debt-1", source: "sandbox", status: "draft", expiresAt: "2027-03", documents: ["offer"] }];
  const result = E14.buildDraftOffer({
    accountKey: "cb", account: { strategy: "settlement", lump: 2200, financed: 0, monthly: 0, apr: 0, term: 1 },
    canonical, existingOffers, normalizeOffer: normalizeOfferStub,
  });
  assert.equal(result.replaceIndex, 0);
  assert.equal(result.offer.id, "offer-x");
  assert.equal(result.offer.expiresAt, "2027-03", "no pisa una vigencia que el hogar ya había completado");
  assert.deepEqual(result.offer.documents, ["offer"]);
  assert.equal(result.offer.amount, 2200);
});

test("buildDraftOffer · sin contrato vinculado, no construye ninguna oferta", () => {
  const result = E14.buildDraftOffer({
    accountKey: "cb", account: { strategy: "settlement", lump: 1800, financed: 0 },
    canonical: { contracts: {} }, existingOffers: [], normalizeOffer: normalizeOfferStub,
  });
  assert.equal(result.ok, false);
  assert.match(result.message, /vinculada/);
});

test("buildDraftOffer · estrategia sin desembolso ('esperar'), no construye una oferta vacía", () => {
  const canonical = { contracts: { entityA: { id: "debt-1", entity: "Entidad A", currentPrincipal: 4000 } } };
  const result = E14.buildDraftOffer({
    accountKey: "cb", account: { strategy: "hold", lump: 0, financed: 0 },
    canonical, existingOffers: [], normalizeOffer: normalizeOfferStub,
  });
  assert.equal(result.ok, false);
  assert.match(result.message, /desembolso/);
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
