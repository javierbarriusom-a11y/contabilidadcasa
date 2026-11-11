// FX-20 completa (10/11/2026) · la tabla de impacto de la Previsión añade la deuda y el patrimonio a 24 meses (views/prevision-v2.js
// previsionV2Patrimonio): el Euribor también hace deber más; amortizar baja la caja y la deuda lo mismo. Cifras INVENTADAS.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const Contract = require("../canonical-forecast-contract.js");
const Stress = require("../canonical-stress-scenarios.js");
const Horizon = require("../canonical-debt-horizon.js");
const scenarioEngine = require("../canonical-scenario-engine.js");

const hoy = "2026-11-10";
const meta = "2028-11-09"; // hoy + 730 días
const sinInteres = { id: "d-cero", entity: "Préstamo", type: "INVENTADO", currentPrincipal: 6000, currentPayment: 100, apr: 0, remainingInstallments: 60, paymentStatus: "active" };
const meses = Array.from({ length: 30 }, (_, i) => {
  const n = 2026 * 12 + 10 + i;
  return { key: `${Math.floor(n / 12)}-${String((n % 12) + 1).padStart(2, "0")}` };
});

function vista({ contratos = [sinInteres], placements = [] } = {}) {
  const sandbox = {
    console,
    document: { readyState: "loading", addEventListener() {}, documentElement: { dataset: {} } },
    localStorage: { getItem: () => null, setItem() {} },
    money: (n) => `${String(Math.round(Number(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ".")} €`,
    escapeHtml: (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"),
    FinanceCanonicalForecastContract: Contract,
    FinanceCanonicalStressScenarios: Stress,
    FinanceCanonicalDebtHorizon: Horizon,
    canonicalDebtContractRows: () => contratos,
    forecastMonths: () => meses,
    debtPortfolioTargetForDecision: (item) => contratos.find((row) => row.id === item.targetId) || null,
    debtDecisionCoveredPrincipal: (item) => Number(item.amount) || 0,
    projectPlan: { placements },
    isoLocalDate: (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
    state: {},
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(read("views/prevision-v2.js"), sandbox);
  return sandbox;
}

const filas = (planHoy, planMeta, pruebaMeta) => ({
  base: [{ date: hoy, total: planHoy }, { date: meta, total: planMeta }, { date: "2028-12-31", total: planMeta }],
  prueba: [{ date: hoy, total: planHoy }, { date: meta, total: pruebaMeta }, { date: "2028-12-31", total: pruebaMeta }],
});

function patrimonio(v, prueba, base, c = { end: { date: "2027-02-08" } }) {
  vm.runInContext(`previsionV2Ultimo = ${JSON.stringify({ rows: base })};`, v);
  return v.previsionV2Patrimonio(prueba, c, hoy);
}

test("FX-20 · amortizar en un escenario: la caja baja, la deuda baja lo mismo y el patrimonio queda igual", () => {
  const v = vista();
  const decision = { id: "dec_amortiza", tipo: "amortizacion", orden: 0, activa: true, planificacion: { modo: "manual", mesManual: "2027-01" }, params: { deudaId: "d-cero", importe: 2000, parcial: true } };
  const resolved = scenarioEngine.resolveEscenario([decision], { baseInput: { months: ["2026-11", "2026-12", "2027-01"].map((monthKey) => ({ monthKey, income: 0, coreSpend: 0 })) }, debtContracts: [sinInteres] });
  const { base, prueba } = filas(20000, 20000, 18000);
  const r = patrimonio(v, { preset: { id: "guardado" }, rows: prueba, deuda: { finalState: resolved.debtStateFinal, decisiones: [decision] } }, base);
  const tabla = JSON.parse(JSON.stringify(r.filas));
  // 6.000 − 24 × 100 = 3.600 de deuda en el plan; con 2.000 amortizados, 1.600. Estas filas van a la centena (11/11/2026), no al millar.
  assert.deepEqual(tabla, [
    ["Liquidez a 9 nov 2028", "20.000 €", "18.000 €", "−2.000 €"],
    ["Deuda viva a 9 nov 2028", "3.600 €", "1.600 €", "−2.000 €"],
    ["Patrimonio sin vivienda ni cartera a 9 nov 2028", "16.400 €", "16.400 €", "igual"],
  ]);
  assert.equal(r.frase, "A 9 nov 2028, 2.000 € menos de caja y 2.000 € menos de deuda; el patrimonio queda igual que en el plan: lo que sale de la caja va a deber menos, no se pierde.");
  assert.match(r.nota, /^Patrimonio a 9 nov 2028: liquidez menos deudas, más lo que os deban\. La vivienda y la cartera no cambian .* \(con hipoteca, incluso negativo\), pero la diferencia es la misma\./);
});

test("FX-20 · el Euribor: además de la caja, se debe más; la prueba cuesta más de lo que se ve en la caja", () => {
  const hipoteca = { id: "d-hipo", entity: "Hipoteca", type: "INVENTADA", currentPrincipal: 120000, currentPayment: 640, apr: 3.34, remainingInstallments: 266, paymentStatus: "active" };
  const v = vista({ contratos: [hipoteca] });
  const n = 262;
  const r2 = 5.34 / 100 / 12;
  const to = Math.round(((118000 * r2 * Math.pow(1 + r2, n)) / (Math.pow(1 + r2, n) - 1)) * 100) / 100;
  const shock = { date: "2027-03-01", from: 640, to, extra: to - 640, rate: 5.34, months: n, principal: 118000 };
  const { base, prueba } = filas(30000, 30000, 27400);
  const r = patrimonio(v, { preset: { id: "euribor" }, info: { shocks: [shock] }, rows: prueba }, base);
  const deuda = r.filas.find((fila) => fila[0].startsWith("Deuda viva"));
  assert.ok(deuda[3].startsWith("+"), `la deuda sube: ${deuda[3]}`);
  // A la centena (11/11/2026): los ~1.318 € de deuda de más se leen como 1.300 €, no como 1.000 o 2.000 según el redondeo al millar.
  assert.equal(deuda[3], "+1.300 €");
  const nw = r.filas.find((fila) => fila[0].startsWith("Patrimonio"));
  const liq = r.filas.find((fila) => fila[0].startsWith("Liquidez"));
  assert.ok(Number(nw[3].replace(/[^\d]/g, "")) > Number(liq[3].replace(/[^\d]/g, "")), "el patrimonio baja más que la caja");
  assert.match(r.frase, /más de deuda; el patrimonio queda .* por debajo del plan: la prueba cuesta más de lo que se ve en la caja\.$/);
});

test("FX-20 · lo que el plan ya amortiza baja la deuda del plan; la prueba que no toca deudas no lleva frase", () => {
  const v = vista({ placements: [{ targetId: "d-cero", startIndex: 2, amount: 2000 }] });
  const { base, prueba } = filas(20000, 20000, 19000);
  const r = patrimonio(v, { preset: { id: "imprevisto" }, info: { amount: 1000 }, rows: prueba }, base);
  const deuda = r.filas.find((fila) => fila[0].startsWith("Deuda viva"));
  assert.deepEqual(JSON.parse(JSON.stringify(deuda)), ["Deuda viva a 9 nov 2028", "1.600 €", "1.600 €", "igual"], "3.600 − 2.000 = 1.600");
  assert.equal(r.frase, "", "sin cambio de deuda, la diferencia de patrimonio es la de la caja: ya se ve");
  // Con el horizonte de 24 m la liquidez de esa fecha ya está en la tabla: no se repite.
  const r24 = patrimonio(v, { preset: { id: "imprevisto" }, info: { amount: 1000 }, rows: prueba }, base, { end: { date: meta } });
  assert.deepEqual(JSON.parse(JSON.stringify(r24.filas.map((fila) => fila[0]))), ["Deuda viva a 9 nov 2028", "Patrimonio sin vivienda ni cartera a 9 nov 2028"]);
});

test("FX-20 · amortizar que ahorra intereses: el patrimonio sube y la frase lo dice", () => {
  assert.equal(vista().previsionV2PatrimonioLectura(-2000, 100), ": lo que sale de la caja va a deber menos y además os ahorra intereses");
  assert.equal(vista().previsionV2PatrimonioLectura(-2000, -300), ": buena parte de lo que sale de la caja va a deber menos, no se pierde");
  assert.equal(vista().previsionV2PatrimonioLectura(-2600, -3900), ": la prueba cuesta más de lo que se ve en la caja");
});

test("FX-20 · sin deudas no hay filas; la que no tiene TAE ni plazo no se inventa y se dice; un préstamo a la familia suma", () => {
  const { base, prueba } = filas(20000, 20000, 19000);
  assert.deepEqual(JSON.parse(JSON.stringify(patrimonio(vista({ contratos: [] }), { preset: { id: "imprevisto" }, rows: prueba }, base))), { filas: [], frase: "", nota: "" });
  const tarjeta = { id: "d-x", entity: "Tarjeta", type: "INVENTADA", currentPrincipal: 900, currentPayment: 50, apr: null, remainingInstallments: 0, paymentStatus: "active" };
  const r = patrimonio(vista({ contratos: [sinInteres, tarjeta] }), { preset: { id: "imprevisto" }, rows: prueba }, base);
  assert.match(r.nota, /No entran «Tarjeta INVENTADA» \(900 €\): sin TAE ni plazo no se puede calcular cómo baja; complétalo en Deuda › Contratos\.$/);
  const prestamos = { id: "n3", tipo: "prestamo_familiar", activa: true, params: { direccion: "prestamos", importe: 1000, mes: "2027-01" } };
  const familia = patrimonio(vista(), { preset: { id: "guardado" }, rows: prueba, deuda: { finalState: [], decisiones: [prestamos] } }, base);
  assert.deepEqual(JSON.parse(JSON.stringify(familia.filas.find((fila) => fila[0].startsWith("Os deben")))), ["Os deben a 9 nov 2028", "0 €", "1.000 €", "+1.000 €"]);
  assert.match(familia.frase, /1\.000 € menos de caja y 1\.000 € más que os deben; el patrimonio queda igual que en el plan/);
  // Sin filas que lleguen a 24 meses, nada.
  assert.equal(patrimonio(vista(), { preset: { id: "imprevisto" }, rows: prueba }, base.slice(0, 1)).filas.length, 0);
});
