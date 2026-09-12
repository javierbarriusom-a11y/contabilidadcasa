const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const DebtContracts = require("../canonical-debt-contracts.js");
const DebtComparator = require("../canonical-debt-comparator.js");
const PortfolioEngine = require("../canonical-portfolio.js");

// DEB13 (Oleada 4, Bloque 6): alerta de "deuda cara dormida" — cruce automático entre la prioridad
// fiscal de DEB5 (fiscalAdjustedDebtPriority) y compareAmortizeVsInvest (AP1) para CADA deuda activa,
// sin esperar a que el hogar la seleccione en el comparador. Solo avisa cuando amortizarla de verdad
// saldría más barato que mantenerla invertida a la rentabilidad real de la cartera (IV5).

const source = fs.readFileSync(path.join(__dirname, "..", "views", "deuda.js"), "utf8");

function extractFunction(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `No existe la función ${name} en views/deuda.js`);
  const parenStart = source.indexOf("(", start);
  let parenDepth = 0;
  let bodyStart = -1;
  for (let index = parenStart; index < source.length; index += 1) {
    if (source[index] === "(") parenDepth += 1;
    else if (source[index] === ")") {
      parenDepth -= 1;
      if (parenDepth === 0) { bodyStart = source.indexOf("{", index); break; }
    }
  }
  assert.ok(bodyStart >= 0, `No se encontró el cuerpo de ${name}`);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    else if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`La función ${name} no cierra sus llaves`);
}

function sandbox({ annualReturnPct = 5, noteEl = { innerHTML: "" } } = {}) {
  const context = {
    window: { FinanceDebtContracts: DebtContracts, FinanceDebtComparator: DebtComparator, FinanceCanonicalPortfolio: PortfolioEngine },
    iv5PortfolioAnnualReturnPct: () => annualReturnPct,
    qs: (id) => (id === "deb13DormantDebtAlert" ? noteEl : null),
    escapeHtml: (value) => String(value ?? ""),
    money: (value) => `${Math.round(value)}€`,
    noteEl,
  };
  vm.createContext(context);
  vm.runInContext(extractFunction("deb13DormantExpensiveDebtAlerts"), context);
  vm.runInContext(extractFunction("renderDeb13DormantExpensiveDebtAlert"), context);
  return context;
}

const CONTRACTS = DebtContracts.normalizeContracts([
  { id: "cara", entity: "Deuda cara", type: "Préstamo", currentPrincipal: 10000, apr: 10, currentPayment: 500, remainingInstallments: 24 },
  { id: "barata", entity: "Deuda barata", type: "Préstamo", currentPrincipal: 10000, apr: 1, currentPayment: 500, remainingInstallments: 24 },
]).contracts;

test("deb13DormantExpensiveDebtAlerts · una deuda cuyo TAE supera con claridad la rentabilidad de la cartera queda marcada", () => {
  const ctx = sandbox({ annualReturnPct: 5 });
  const alerts = ctx.deb13DormantExpensiveDebtAlerts(CONTRACTS);
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].entity, "Deuda cara");
  assert.equal(alerts[0].effectiveAprPct, 10);
});

test("deb13DormantExpensiveDebtAlerts · una deuda con TAE por debajo de la rentabilidad esperada no se marca", () => {
  const ctx = sandbox({ annualReturnPct: 5 });
  const alerts = ctx.deb13DormantExpensiveDebtAlerts(CONTRACTS);
  assert.ok(!alerts.some((alert) => alert.entity === "Deuda barata"));
});

test("deb13DormantExpensiveDebtAlerts · sin rentabilidad de cartera calculable (sin posiciones), no hay nada que cruzar", () => {
  const ctx = sandbox({ annualReturnPct: null });
  const alerts = ctx.deb13DormantExpensiveDebtAlerts(CONTRACTS);
  assert.equal(alerts.length, 0);
});

test("deb13DormantExpensiveDebtAlerts · sin deudas activas, sin nada que priorizar", () => {
  const ctx = sandbox({ annualReturnPct: 5 });
  assert.equal(ctx.deb13DormantExpensiveDebtAlerts([]).length, 0);
});

test("renderDeb13DormantExpensiveDebtAlert · con una deuda cara dormida, la nombra en el aviso", () => {
  const ctx = sandbox({ annualReturnPct: 5 });
  ctx.renderDeb13DormantExpensiveDebtAlert(CONTRACTS);
  assert.match(ctx.noteEl.innerHTML, /Deuda cara/);
  assert.doesNotMatch(ctx.noteEl.innerHTML, /Deuda barata/);
  assert.match(ctx.noteEl.innerHTML, /DEB13/);
});

test("renderDeb13DormantExpensiveDebtAlert · sin ninguna deuda cara dormida, se queda vacío", () => {
  const ctx = sandbox({ annualReturnPct: 50 });
  ctx.renderDeb13DormantExpensiveDebtAlert(CONTRACTS);
  assert.equal(ctx.noteEl.innerHTML, "");
});

test("wiring: renderDeudaContratos llama a renderDeb13DormantExpensiveDebtAlert junto a DEB5/DEB6", () => {
  const start = source.indexOf("function renderDeudaContratos(");
  const block = source.slice(start, source.indexOf("\n}\n", start) + 3);
  assert.match(block, /renderDeb5FiscalPriority\(contracts\)/);
  assert.match(block, /renderDeb13DormantExpensiveDebtAlert\(contracts\)/);
});
