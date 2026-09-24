const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const SavingsAgent = require("../canonical-savings-agent.js");

// ARQ-4 (sesión 237): núcleo puro del agente de ahorro — la regla mensual de traspaso y rescate entre
// CaixaBank y Mediolanum —, extraído de buildSavingsAgentPlan() (app.js). Dos tipos de prueba:
// casos a mano que documentan la regla, y una comparación contra la implementación anterior (copiada
// abajo tal cual estaba en app.js hasta la sesión 236) sobre cientos de simulaciones aleatorias, para
// demostrar que la extracción no cambia ni un céntimo.

const { sweepCashPlan, nextMonthReserve, round2 } = SavingsAgent;

function row(values) {
  return { income: 0, coreSpend: 0, car: 0, refi: 0, projectOutflow: 0, outflowsBeforeSaving: 0, ...values };
}

test("canonical-savings-agent · la reserva exigida es colchón + pagos del mes siguiente (solo colchón en el último)", () => {
  const rows = [row({ outflowsBeforeSaving: 900 }), row({ outflowsBeforeSaving: 1200.55 }), row({})];
  assert.equal(nextMonthReserve(rows, 0, 2500), 3700.55);
  assert.equal(nextMonthReserve(rows, 1, 2500), 2500);
  assert.equal(nextMonthReserve(rows, 2, 2500), 2500);
  // Pagos negativos del mes siguiente no rebajan la reserva por debajo del colchón.
  assert.equal(nextMonthReserve([row({}), row({ outflowsBeforeSaving: -400 })], 0, 2500), 2500);
});

test("canonical-savings-agent · el exceso sobre la reserva se traspasa a Mediolanum", () => {
  const plan = sweepCashPlan({
    sourceRows: [row({ income: 4000, coreSpend: 2500 }), row({ income: 4000, coreSpend: 2500, outflowsBeforeSaving: 2500 })],
    startBalances: { caixa: 3000, mediolanum: 10000, total: 13000 },
    caixaFloor: 2000,
  });
  // Mes 1: caja 3000 + 1500 = 4500; reserva 2000 + 2500 (pagos del mes 2) = 4500 → no traspasa.
  assert.equal(plan.rows[0].transferToSavings, 0);
  assert.equal(plan.rows[0].agentCaixa, 4500);
  // Mes 2 (último): caja 4500 + 1500 = 6000; reserva 2000 → traspasa 4000.
  assert.equal(plan.rows[1].transferToSavings, 4000);
  assert.equal(plan.rows[1].agentMediolanum, 14000);
  assert.equal(plan.totalTransferred, 4000);
  assert.equal(plan.finalTotal, 16000);
  assert.equal(plan.shortage, 0);
});

test("canonical-savings-agent · si falta caja se rescata de Mediolanum; lo que no alcanza queda como déficit", () => {
  const plan = sweepCashPlan({
    sourceRows: [row({ income: 1000, coreSpend: 3000 }), row({ income: 1000, coreSpend: 3000 })],
    startBalances: { caixa: 2500, mediolanum: 1500, total: 4000 },
    caixaFloor: 2500,
  });
  // Mes 1: 2500 - 2000 = 500; faltan 2000 → rescata 1500 (todo), déficit 500.
  assert.equal(plan.rows[0].rescueFromSavings, 1500);
  assert.equal(plan.rows[0].shortage, 500);
  assert.equal(plan.rows[0].agentMediolanum, 0);
  // Mes 2: caja 2000 - 2000 = 0 y ya no queda ahorro que rescatar → los 2500 de reserva son déficit.
  assert.equal(plan.rows[1].rescueFromSavings, 0);
  assert.equal(plan.rows[1].shortage, 2500);
  assert.equal(plan.rows[1].agentCaixa, 0);
  assert.equal(plan.totalRescued, 1500);
  assert.equal(plan.shortage, 3000);
  assert.ok(plan.minReserveCoverage < 0);
});

test("canonical-savings-agent · sin filas devuelve los saldos de partida y no inventa mínimos", () => {
  const plan = sweepCashPlan({ sourceRows: [], startBalances: { caixa: 1200, mediolanum: 800, total: 2000 }, caixaFloor: 2500 });
  assert.deepEqual(plan.rows, []);
  assert.equal(plan.finalCaixa, 1200);
  assert.equal(plan.finalMediolanum, 800);
  assert.equal(plan.finalTotal, 2000);
  assert.equal(plan.minCaixa, 1200);
  assert.equal(plan.minReserveCoverage, 0);
  assert.equal(plan.maxSavings, 800);
});

test("canonical-savings-agent · conserva los campos de la fila de origen y no la muta", () => {
  const source = [row({ income: 3000, coreSpend: 1000, detailMonthKey: "2026-10", month: "oct 2026" })];
  const frozen = JSON.stringify(source);
  const plan = sweepCashPlan({ sourceRows: source, startBalances: { caixa: 0, mediolanum: 0, total: 0 }, caixaFloor: 500 });
  assert.equal(JSON.stringify(source), frozen);
  assert.equal(plan.rows[0].detailMonthKey, "2026-10");
  assert.equal(plan.rows[0].agentIndex, 0);
  assert.equal(plan.rows[0].operatingResult, 2000);
});

// --- Implementación anterior, copiada literalmente de app.js (sesión 236) como referencia ------------
function legacyPlan(sourceRows, start, caixaFloor) {
  const r2 = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
  function agentNextMonthReserve(rows, index, floor) {
    const next = rows[index + 1];
    if (!next) return floor;
    return r2(floor + Math.max(0, Number(next.outflowsBeforeSaving || 0)));
  }
  let caixa = Number(start.caixa || 0);
  let mediolanum = Number(start.mediolanum || 0);
  let totalTransferred = 0;
  let totalRescued = 0;
  let shortage = 0;
  let projectSpend = 0;
  const rows = sourceRows.map((row, index) => {
    const result = r2(row.income - row.coreSpend - row.car - row.refi - row.projectOutflow);
    const beforeTransfer = r2(caixa + result);
    const requiredReserve = agentNextMonthReserve(sourceRows, index, caixaFloor);
    const rescue = beforeTransfer < requiredReserve ? r2(Math.min(mediolanum, requiredReserve - beforeTransfer)) : 0;
    const protectedCaixa = r2(beforeTransfer + rescue);
    const monthShortage = Math.max(0, r2(requiredReserve - protectedCaixa));
    const transfer = Math.max(0, r2(protectedCaixa - requiredReserve));
    caixa = r2(protectedCaixa - transfer);
    mediolanum = r2(mediolanum + transfer - rescue);
    totalTransferred = r2(totalTransferred + transfer);
    totalRescued = r2(totalRescued + rescue);
    shortage = r2(shortage + monthShortage);
    projectSpend = r2(projectSpend + Math.max(0, Number(row.projectOutflow || 0)));
    return { ...row, agentIndex: index, operatingResult: result, requiredReserve, transferToSavings: transfer, rescueFromSavings: rescue, shortage: monthShortage, agentCaixa: caixa, agentMediolanum: mediolanum, agentTotal: r2(caixa + mediolanum) };
  });
  const remainingDebt = 12345.67;
  const final = rows.at(-1) || {};
  return {
    rows,
    caixaFloor,
    totalTransferred,
    totalRescued,
    shortage,
    projectSpend,
    finalCaixa: r2(final.agentCaixa || start.caixa || 0),
    finalMediolanum: r2(final.agentMediolanum || start.mediolanum || 0),
    finalTotal: r2(final.agentTotal || start.total || 0),
    netWorth: r2((final.agentTotal || start.total || 0) - remainingDebt),
    minCaixa: rows.length ? Math.min(...rows.map((row) => row.agentCaixa)) : start.caixa,
    minReserveCoverage: rows.length ? Math.min(...rows.map((row) => row.agentCaixa - row.requiredReserve)) : 0,
    maxSavings: rows.length ? Math.max(...rows.map((row) => row.agentMediolanum)) : start.mediolanum,
  };
}

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

test("canonical-savings-agent · idéntico céntimo a céntimo a la implementación anterior en 500 simulaciones aleatorias", () => {
  const random = seededRandom(20260924);
  const cents = (max) => Math.round(random() * max * 100) / 100;
  for (let run = 0; run < 500; run += 1) {
    const months = Math.floor(random() * 30);
    const sourceRows = Array.from({ length: months }, () => row({
      income: cents(6000),
      coreSpend: cents(4500),
      car: random() < 0.3 ? cents(600) : 0,
      refi: random() < 0.3 ? cents(900) : 0,
      projectOutflow: random() < 0.2 ? cents(8000) - 1000 : 0,
      outflowsBeforeSaving: cents(5000) - 200,
    }));
    const caixa = cents(9000) - 1000;
    const mediolanum = cents(40000);
    const start = { caixa: round2(caixa), mediolanum: round2(mediolanum), total: round2(caixa + mediolanum) };
    const caixaFloor = [0, 1500, 2200, 2500, 4000][Math.floor(random() * 5)];
    const expected = legacyPlan(sourceRows, start, caixaFloor);
    const sweep = sweepCashPlan({ sourceRows, startBalances: start, caixaFloor });
    // Misma composición que buildSavingsAgentPlan() en app.js tras la extracción.
    const actual = { ...sweep, netWorth: round2(sweep.finalTotal - 12345.67) };
    Object.keys(expected).forEach((key) => {
      assert.deepEqual(actual[key], expected[key], `run ${run}, campo ${key}`);
    });
  }
});

test("canonical-savings-agent · app.js delega en el módulo y ya no conserva su propia copia de la regla", () => {
  const app = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
  const start = app.indexOf("function buildSavingsAgentPlan(");
  const body = app.slice(start, app.indexOf("\n}\n", start));
  assert.match(body, /window\.FinanceCanonicalSavingsAgent\.sweepCashPlan\(\{ sourceRows, startBalances: start, caixaFloor \}\)/);
  assert.doesNotMatch(body, /rescueFromSavings|transferToSavings/, "la regla de traspaso no debe duplicarse en app.js");
  assert.ok(!app.includes("function agentNextMonthReserve("), "agentNextMonthReserve vive ahora en el módulo (nextMonthReserve)");
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const moduleAt = html.indexOf('<script defer src="canonical-savings-agent.js?v=');
  assert.ok(moduleAt > 0 && moduleAt < html.indexOf('<script defer src="app.js?v='), "el módulo debe cargarse antes que app.js (init() lo usa al arrancar)");
  assert.match(fs.readFileSync(path.join(__dirname, "..", "service-worker.js"), "utf8"), /"\.\/canonical-savings-agent\.js"/);
  assert.match(fs.readFileSync(path.join(__dirname, "..", "tools", "build-public-site.mjs"), "utf8"), /"canonical-savings-agent\.js"/);
});
