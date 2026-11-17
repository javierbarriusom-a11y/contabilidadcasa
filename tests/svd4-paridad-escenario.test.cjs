// SVD-4 (17/11/2026): paridad entre la estrategia del simulador visual de deuda y la misma estrategia guardada como escenario (lo que
// enseña Plan › Previsión al elegir «O un escenario guardado»). Medida, no supuesta:
//  - Escenarios (y las decisiones del plan, SVD-3) siguen el criterio prudente de la app: el mes del cambio todavía se paga la cuota
//    de hoy y lo nuevo empieza el mes siguiente;
//  - el simulador (y Ruta) dejan de pagar la cuota de hoy desde el mes de la estrategia.
// Así que el escenario paga exactamente UNA cuota de hoy más, y la liquidez de Previsión queda esa cuota por debajo desde ese mes. Si
// algún día alguno de los dos cambia de criterio, estas pruebas lo dicen. Contrato inventado.
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

const sum = (list) => round2(list.reduce((total, value) => total + value, 0));

test("SVD-4 · paridad · quita: el escenario paga la cuota de hoy también el mes del pago; ni un euro más", () => {
  const sim = simulatorSeries({ strategy: "settlement", lump: 2000, start: 3 }).series;
  const esc = scenarioSeries({ strategy: "settlement", lump: 2000, start: 3 });
  assert.deepEqual(sim.slice(0, 4), [150, 150, 2000, 0]);
  assert.deepEqual(esc.slice(0, 4), [150, 150, 2150, 0]);
  const diff = esc.map((value, index) => round2(value - sim[index]));
  assert.deepEqual(diff.filter((value) => value !== 0), [150]);
  assert.equal(round2(sum(esc) - sum(sim)), 150);
});

test("SVD-4 · paridad · refinanciación: mismas cuotas nuevas, un mes más tarde, y una cuota de hoy más", () => {
  const { series: sim, account } = simulatorSeries({ strategy: "refi", lump: 0, apr: 5, term: 18, financePct: 100, start: 3 });
  const esc = scenarioSeries({ strategy: "refi", lump: 0, financed: account.financed, monthly: account.monthly, apr: 5, term: 18, start: 3 });
  const cuota = round2(account.monthly);
  assert.deepEqual(sim.slice(0, 4), [150, 150, cuota, cuota]);
  assert.deepEqual(esc.slice(0, 4), [150, 150, 150, cuota]);
  // 18 cuotas nuevas en los dos; el escenario acaba un mes después.
  assert.equal(sim.filter((value) => value === cuota).length, 18);
  assert.equal(esc.filter((value) => value === cuota).length, 18);
  assert.equal(round2(sum(esc) - sum(sim)), 150);
  // Lo que paga de más el escenario, acumulado: el mes del cambio paga la cuota de hoy (150) en vez de la nueva, así que ese mes va
  // por DEBAJO (−9,40 con estas cifras); desde el siguiente, una cuota nueva por encima… y al acabar, exactamente la cuota de hoy.
  let acumulada = 0;
  const camino = esc.map((value, index) => (acumulada = round2(acumulada + value - sim[index])));
  assert.equal(camino[2], round2(150 - cuota));
  assert.ok(camino.every((value) => value >= round2(150 - cuota) && value <= 150), JSON.stringify(camino));
  assert.equal(camino[camino.length - 1], 150);
});

test("SVD-4 · paridad · el mensaje al guardar dice cuánto más baja sale Previsión, con el mismo criterio", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const puente = fs.readFileSync(path.join(__dirname, "..", "deuda-simulador-puente.js"), "utf8");
  assert.match(puente, /function svdDiferenciaEscenario\(/);
  assert.match(puente, /el mes del cambio todavía cuenta la cuota de hoy/);
});
