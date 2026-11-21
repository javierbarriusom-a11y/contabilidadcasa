// SVD-4 (17/11/2026): paridad entre la estrategia del simulador visual de deuda y la misma estrategia guardada como escenario (lo que
// enseña Plan › Previsión al elegir «O un escenario guardado»). Medida, no supuesta.
// Hasta D-N23 el escenario pagaba exactamente UNA cuota de hoy más (el mes del cambio todavía se pagaba). Desde D-N23 (21/11/2026,
// decisión del hogar: el criterio realista para lo que sale de un acuerdo o del simulador) la estrategia guardada lleva
// `planificacion.cuotaMesCambio: "sustituye"` y la serie es la misma, euro a euro. Lo demás de Escenarios (sin esa marca) sigue con
// el criterio de siempre, y también se comprueba. Contrato inventado.
const test = require("node:test");
const assert = require("node:assert/strict");

const Adapter = require("../canonical-e14-debt-adapter.js");
const ScenarioEngine = require("../canonical-scenario-engine.js");
const Legacy = require("../legacy-debt-roadmap-engine.js");
const PayoffPath = require("../canonical-debt-payoff-path.js");

const contract = { id: "debt-custom-1", entity: "Banco FICTICIO", type: "Préstamo", paymentStatus: "active", currentPrincipal: 3000, currentPayment: 150, apr: 12, remainingInstallments: 24 };
const HORIZON = 30;
const months = Array.from({ length: HORIZON }, (_, index) => {
  const date = new Date(Date.UTC(2026, 10 + index, 1));
  // El plan paga la cuota de hoy mientras dura el contrato (es lo que Escenarios toma como punto de partida).
  return { monthKey: date.toISOString().slice(0, 7), refi: index < 24 ? 150 : 0, income: 3000, coreSpend: 2000, car: 0, projectOutflow: 0 };
});
const canonical = Adapter.buildReadModel({ contracts: [contract], payoffPath: PayoffPath, startMonthKey: "2026-11" });
const key = Adapter.dynamicAccountKey(contract.id);
const keep = { keepPayment: 150, keepRate: 0.01, keepTolerance: 0.005 };

const round2 = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

function simulatorSeries(raw) {
  const result = Legacy.simulate({ months: HORIZON, capacity: 1000, accounts: [{ amount: 3000, ...keep, ...raw }] });
  return { series: result.rows.map((row) => round2(row.total)), account: result.accounts[0] };
}

function scenarioSeries(account) {
  const { decisions } = Adapter.scenarioDecisionsFromRoadmap({ canonical, baseMonthKey: "2026-11", accounts: [{ accountKey: key, account }] });
  const decisiones = decisions.map((decision, orden) => ({ ...decision, id: `dec_01ARZ3NDEKTSV4RRFFQ69G5FA${orden}`, orden }));
  const resolved = ScenarioEngine.resolveEscenario(decisiones, { baseInput: { months }, debtContracts: [contract] });
  assert.equal(resolved.valid, true);
  return resolved.months.map((month) => round2(month.refi));
}


test("SVD-4 · paridad · quita: el escenario paga lo mismo que el simulador, mes a mes (D-N23)", () => {
  const sim = simulatorSeries({ strategy: "settlement", lump: 2000, start: 3 }).series;
  const esc = scenarioSeries({ strategy: "settlement", lump: 2000, start: 3 });
  assert.deepEqual(sim.slice(0, 4), [150, 150, 2000, 0]);
  assert.deepEqual(esc, sim);
});

test("SVD-4 · paridad · refinanciación: las mismas cuotas nuevas, desde el mismo mes (D-N23)", () => {
  const { series: sim, account } = simulatorSeries({ strategy: "refi", lump: 0, apr: 5, term: 18, financePct: 100, start: 3 });
  const esc = scenarioSeries({ strategy: "refi", lump: 0, financed: account.financed, monthly: account.monthly, apr: 5, term: 18, start: 3 });
  const cuota = round2(account.monthly);
  assert.deepEqual(sim.slice(0, 4), [150, 150, cuota, cuota]);
  assert.equal(esc.filter((value) => value === cuota).length, 18);
  assert.deepEqual(esc, sim);
});

test("SVD-4 · paridad · híbrido (pago único y refinanciación): la misma serie (D-N23)", () => {
  const { series: sim, account } = simulatorSeries({ strategy: "hybrid", lump: 500, apr: 5, term: 12, financePct: 100, start: 2 });
  const esc = scenarioSeries({ strategy: "hybrid", lump: 500, financed: account.financed, monthly: account.monthly, apr: 5, term: 12, start: 2 });
  assert.deepEqual(esc, sim);
});

test("D-N23 · las decisiones de Escenarios sin la marca siguen con el criterio de siempre: el mes del cambio se paga la cuota de hoy", () => {
  const { decisions } = Adapter.scenarioDecisionsFromRoadmap({ canonical, baseMonthKey: "2026-11", accounts: [{ accountKey: key, account: { strategy: "settlement", lump: 2000, start: 3 } }] });
  assert.equal(decisions[0].planificacion.cuotaMesCambio, "sustituye");
  const prudente = decisions.map((decision, orden) => {
    const { cuotaMesCambio, ...planificacion } = decision.planificacion;
    return { ...decision, planificacion, id: `dec_01ARZ3NDEKTSV4RRFFQ69G5FB${orden}`, orden };
  });
  const resolved = ScenarioEngine.resolveEscenario(prudente, { baseInput: { months }, debtContracts: [contract] });
  assert.deepEqual(resolved.months.slice(0, 4).map((month) => round2(month.refi)), [150, 150, 2150, 0]);
  const marcada = prudente.map((decision) => ({ ...decision, planificacion: { ...decision.planificacion, cuotaMesCambio: "se-paga" } }));
  const resolvedMarcada = ScenarioEngine.resolveEscenario(marcada, { baseInput: { months }, debtContracts: [contract] });
  assert.deepEqual(resolvedMarcada.months.map((month) => round2(month.refi)), resolved.months.map((month) => round2(month.refi)));
});

test("D-N23 · el esquema admite cuotaMesCambio «se-paga» o «sustituye», y nada más", () => {
  const Schema = require("../canonical-scenario-schema.js");
  const base = { id: "dec_01ARZ3NDEKTSV4RRFFQ69G5FC0", orden: 0, tipo: "acuerdo_quita", titulo: "Quita", activa: true, params: { deudaId: contract.id, importePactado: 2000, modalidad: "pago-unico", vigenciaHasta: "2027-01-31" } };
  const errores = (planificacion) => { const issues = []; Schema.validateDecision({ ...base, planificacion }, "$", issues); return issues.filter((issue) => issue.severity === "error").map((issue) => issue.code); };
  assert.deepEqual(errores({ modo: "manual", mesManual: "2027-01", cuotaMesCambio: "sustituye" }), []);
  assert.deepEqual(errores({ modo: "manual", mesManual: "2027-01", cuotaMesCambio: "se-paga" }), []);
  assert.deepEqual(errores({ modo: "manual", mesManual: "2027-01" }), []);
  assert.ok(errores({ modo: "manual", mesManual: "2027-01", cuotaMesCambio: "a-veces" }).includes("invalid-enum"));
});

test("SVD-4 · al guardar, el mensaje ya no avisa de una diferencia que no hay; las guardadas antes se leen con el criterio nuevo", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const puente = fs.readFileSync(path.join(__dirname, "..", "deuda-simulador-puente.js"), "utf8");
  assert.doesNotMatch(puente, /el mes del cambio todavía cuenta la cuota de hoy/);
  assert.match(puente, /En Previsión sale la misma liquidez que aquí/);
  const ui = fs.readFileSync(path.join(__dirname, "..", "escenarios-ui.js"), "utf8");
  assert.match(ui, /function escenarioMotorSavedCriterio\(/);
  assert.match(ui, /parsed\.map\(escenarioMotorSavedCriterio\)/);
});
