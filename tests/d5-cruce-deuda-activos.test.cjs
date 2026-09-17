const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const DebtContracts = require("../canonical-debt-contracts.js");
const DebtComparator = require("../canonical-debt-comparator.js");
const PortfolioEngine = require("../canonical-portfolio.js");

// D5 (Contabilidadcasa 2.0): aplica AP1 línea a línea sobre TODO el inventario de deuda, cruzado
// contra las posiciones REALES de cartera — no solo contra el XIRR agregado que ya usa DEB13. Para
// cada deuda activa, qué posición concreta cubriría su principal pendiente neto del impuesto real
// de venderla, y si el ahorro de intereses de amortizar sigue ganando una vez restado ese coste.

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

function sandbox({ annualReturnPct = 5, savingsTaxRatePct = 20, positions = [], noteEl = { innerHTML: "" } } = {}) {
  const context = {
    window: { FinanceDebtContracts: DebtContracts, FinanceDebtComparator: DebtComparator, FinanceCanonicalPortfolio: PortfolioEngine },
    iv5PortfolioAnnualReturnPct: () => annualReturnPct,
    iv1PositionsList: () => positions,
    dividendSpanishSavingsRatePct: () => savingsTaxRatePct,
    round2: (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100,
    AP1_ASSESSMENT_LABEL: { amortizar: "amortizar", invertir: "invertir", neutral: "cualquiera de las dos — el resultado es prácticamente el mismo" },
    qs: (id) => (id === "d5DebtAssetCrossingNote" ? noteEl : null),
    escapeHtml: (value) => String(value ?? ""),
    money: (value) => `${Math.round(value)}€`,
    noteEl,
  };
  vm.createContext(context);
  vm.runInContext(extractFunction("d5DebtAssetCrossingRows"), context);
  vm.runInContext(extractFunction("d5DebtAssetCrossingHtml"), context);
  vm.runInContext(extractFunction("renderD5DebtAssetCrossing"), context);
  return context;
}

const CONTRACTS = DebtContracts.normalizeContracts([
  { id: "cara", entity: "Deuda cara", type: "Préstamo", currentPrincipal: 10000, apr: 10, currentPayment: 500, remainingInstallments: 24 },
  { id: "sin-posicion", entity: "Deuda sin cobertura", type: "Préstamo", currentPrincipal: 50000, apr: 10, currentPayment: 1000, remainingInstallments: 24 },
]).contracts;

const POSITION_SUFICIENTE_SIN_PLUSVALIA = { id: "p1", label: "Fondo A", type: "fondo", currentValue: 12000, costBasis: 12000, gainLoss: 0 };
const POSITION_SUFICIENTE_CON_PLUSVALIA = { id: "p2", label: "Fondo B (con plusvalía)", type: "fondo", currentValue: 20000, costBasis: 5000, gainLoss: 15000 };
const POSITION_INSUFICIENTE = { id: "p3", label: "Fondo pequeño", type: "fondo", currentValue: 500, costBasis: 500, gainLoss: 0 };

test("d5DebtAssetCrossingRows · una deuda con una posición suficiente sin plusvalía sale como cancelable sin coste fiscal", () => {
  const ctx = sandbox({ annualReturnPct: 5, positions: [POSITION_SUFICIENTE_SIN_PLUSVALIA] });
  const rows = ctx.d5DebtAssetCrossingRows(CONTRACTS);
  const row = rows.find((item) => item.entity === "Deuda cara");
  assert.ok(row);
  assert.equal(row.fundable, true);
  assert.equal(row.bestMatch.id, "p1");
  assert.equal(row.bestMatch.taxCost, 0);
  assert.equal(row.calculable, true);
  assert.equal(row.netAmortizeBenefit, row.amortizeSavings);
});

test("d5DebtAssetCrossingRows · con dos posiciones suficientes, prioriza la de menor coste fiscal", () => {
  const ctx = sandbox({ annualReturnPct: 5, positions: [POSITION_SUFICIENTE_CON_PLUSVALIA, POSITION_SUFICIENTE_SIN_PLUSVALIA] });
  const rows = ctx.d5DebtAssetCrossingRows(CONTRACTS);
  const row = rows.find((item) => item.entity === "Deuda cara");
  assert.equal(row.bestMatch.id, "p1");
  assert.equal(row.alternativeCount, 1);
});

test("d5DebtAssetCrossingRows · el coste fiscal de la posición elegida se resta del ahorro de amortizar", () => {
  const ctx = sandbox({ annualReturnPct: 5, positions: [POSITION_SUFICIENTE_CON_PLUSVALIA] });
  const rows = ctx.d5DebtAssetCrossingRows(CONTRACTS);
  const row = rows.find((item) => item.entity === "Deuda cara");
  assert.equal(row.bestMatch.taxCost, 3000); // 15000 de plusvalía al 20% declarado
  assert.equal(row.netAmortizeBenefit, ctx.round2(row.amortizeSavings - 3000));
});

test("d5DebtAssetCrossingRows · ninguna posición individual cubre el pendiente, la deuda queda como no financiable", () => {
  const ctx = sandbox({ annualReturnPct: 5, positions: [POSITION_INSUFICIENTE] });
  const rows = ctx.d5DebtAssetCrossingRows(CONTRACTS);
  const row = rows.find((item) => item.entity === "Deuda cara");
  assert.equal(row.fundable, false);
  assert.equal(row.bestMatch, null);
});

test("d5DebtAssetCrossingRows · sin rentabilidad de cartera calculable, no hay nada que cruzar", () => {
  const ctx = sandbox({ annualReturnPct: null, positions: [POSITION_SUFICIENTE_SIN_PLUSVALIA] });
  assert.equal(ctx.d5DebtAssetCrossingRows(CONTRACTS).length, 0);
});

test("d5DebtAssetCrossingRows · sin deudas activas, sin nada que cruzar", () => {
  const ctx = sandbox({ annualReturnPct: 5, positions: [POSITION_SUFICIENTE_SIN_PLUSVALIA] });
  assert.equal(ctx.d5DebtAssetCrossingRows([]).length, 0);
});

test("renderD5DebtAssetCrossing · nombra la posición candidata y el veredicto neto de la deuda cancelable", () => {
  const ctx = sandbox({ annualReturnPct: 5, positions: [POSITION_SUFICIENTE_SIN_PLUSVALIA] });
  ctx.renderD5DebtAssetCrossing(CONTRACTS);
  assert.match(ctx.noteEl.innerHTML, /Deuda cara/);
  assert.match(ctx.noteEl.innerHTML, /Fondo A/);
  assert.match(ctx.noteEl.innerHTML, /Deuda sin cobertura/);
  assert.match(ctx.noteEl.innerHTML, /ninguna posición individual/);
});

test("renderD5DebtAssetCrossing · sin cartera ni deudas cruzables, muestra el aviso de nada que cruzar", () => {
  const ctx = sandbox({ annualReturnPct: null, positions: [] });
  ctx.renderD5DebtAssetCrossing(CONTRACTS);
  assert.match(ctx.noteEl.innerHTML, /nada que cruzar/);
});

test("wiring: renderDeudaContratos llama a renderD5DebtAssetCrossing junto a DEB13", () => {
  const start = source.indexOf("function renderDeudaContratos(");
  const block = source.slice(start, source.indexOf("\n}\n", start) + 3);
  assert.match(block, /renderDeb13DormantExpensiveDebtAlert\(contracts\)/);
  assert.match(block, /renderD5DebtAssetCrossing\(contracts\)/);
});

test("debtCancellationCandidates (canonical-debt-comparator.js) · motor puro: ordena candidatas por menor coste fiscal", () => {
  const result = DebtComparator.debtCancellationCandidates({
    debts: [{ id: "d1", entity: "Deuda", currentPrincipal: 10000 }],
    positions: [POSITION_SUFICIENTE_CON_PLUSVALIA, POSITION_SUFICIENTE_SIN_PLUSVALIA, POSITION_INSUFICIENTE],
    savingsTaxRatePct: 20,
  });
  assert.equal(result.calculable, true);
  const row = result.rows[0];
  assert.equal(row.fundable, true);
  assert.equal(row.bestMatch.id, "p1");
  assert.equal(row.alternativeCount, 1);
});
