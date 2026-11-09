// FX-51 PR-2 (9/11/2026) · «Con estos supuestos» en la Previsión nueva: los supuestos generales con su valor y lo que quitaría cada uno
// si sale peor, con el mismo cálculo que Ajustes (assumptionImpacts) y la entrada de la línea del plan. Cifras INVENTADAS.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const Contract = require("../canonical-forecast-contract.js");
const Engine = require("../canonical-engine.js");

function mes(monthKey) {
  return { month: monthKey, monthKey, income: 3000, coreSpend: 2000, variableOperationalSpend: 600, car: 0, refi: 0, projectOutflow: 0, endOfMonthOutflows: 0, incomeEvents: [], expenseEvents: [] };
}
const claves = [];
for (let y = 2026; y <= 2028; y += 1) for (let m = 1; m <= 12; m += 1) if (y > 2026 || m >= 11) claves.push(`${y}-${String(m).padStart(2, "0")}`);
const entrada = { openingBalances: { checking: 4000, savings: 6000 }, policy: { incomeFactor: 1, annualIncomeGrowth: 0, expenseFactor: 1, annualInflation: 2, plannedMonthlySaving: 300, autoCapSavings: true }, months: claves.map(mes) };

function vista() {
  let llamadas = 0;
  const sandbox = {
    console,
    document: { readyState: "loading", addEventListener() {}, documentElement: { dataset: {} } },
    localStorage: { getItem: () => null, setItem() {} },
    money: (n) => `${String(Math.round(Number(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ".")} €`,
    escapeHtml: (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"),
    FinanceCanonicalForecastContract: Contract,
    FinanceCanonicalEngine: { buildScenario: (...args) => { llamadas += 1; return Engine.buildScenario(...args); } },
    canonicalEngineInput: () => JSON.parse(JSON.stringify(entrada)),
    projectPlan: { outflows: [] },
    state: {},
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(read("views/prevision-v2.js"), sandbox);
  return { v: sandbox, llamadas: () => llamadas };
}

test("FX-51 · los mismos impactos que assumptionImpacts sobre la entrada del plan, del que más pesa al que menos, y una vez por trayectoria", () => {
  const { v, llamadas } = vista();
  const rows = [{ date: "2026-11-09", total: 10000 }];
  const html = v.previsionV2SupuestosHtml({ rows, today: "2026-11-09" });
  const esperado = Contract.assumptionImpacts((i) => Engine.buildScenario(i, null, {}), entrada, { targets: ["2027-12", "2028-12"] });
  const etiquetas = [...html.matchAll(/<li class="prev-v2-supuesto"><span>([^<]+)<\/span>/g)].map((m) => m[1]);
  assert.deepEqual(etiquetas, esperado.map((item) => item.label));
  const primero = esperado[0].effects.at(-1);
  assert.match(html, new RegExp(`<summary>Con estos supuestos · el que más pesa: ${esperado[0].label.toLowerCase()} \\(${v.money(Contract.roundDifference(Math.abs(primero.diff))).replace(".", "\\.")} a fin de 2028\\)</summary>`));
  assert.match(html, /<strong>2 % al año<\/strong>/, "la inflación con su valor");
  assert.match(html, /<strong>×1,00<\/strong>/, "los factores");
  assert.match(html, /data-prevision-v2-ir-prueba="euribor">Comparar con el Euribor</);
  assert.doesNotMatch(html, /data-prevision-v2-prueba=/, "no se cuenta entre los botones de «Comparar con»");
  assert.match(html, /data-prevision-v2-supuestos-ajustes>Cambiarlos en Ajustes</);
  const veces = llamadas();
  v.previsionV2SupuestosHtml({ rows, today: "2026-11-09" });
  assert.equal(llamadas(), veces, "con la misma trayectoria no se recalcula");
  v.previsionV2SupuestosHtml({ rows: [...rows], today: "2026-11-09" });
  assert.ok(llamadas() > veces, "con otra trayectoria, sí");
});

test("FX-51 · sin motor o con error, la sección no sale (la Previsión se enseña igual)", () => {
  const { v } = vista();
  v.FinanceCanonicalEngine = null;
  assert.equal(v.previsionV2SupuestosHtml({ rows: [], today: "2026-11-09" }), "");
  const otro = vista().v;
  otro.canonicalEngineInput = () => { throw new Error("sin plan"); };
  assert.equal(otro.previsionV2SupuestosHtml({ rows: [{}], today: "2026-11-09" }), "");
});
