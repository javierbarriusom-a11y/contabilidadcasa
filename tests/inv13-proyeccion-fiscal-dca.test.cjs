const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const PortfolioEngine = require("../canonical-portfolio.js");
const IrpfEstimator = require("../canonical-irpf-estimator.js");

// INV13 (Oleada 4, Bloque 4): INV8 (Oleada 3) solo compara aportado vs. planificado del plan DCA,
// nunca dice qué pasaría fiscalmente si se vendiera lo acumulado. Reutiliza tal cual
// optimizePartialSale (FC5, mismo campo fc5AlreadyRealized que ya usa LEV15) sobre la plusvalía REAL
// ya calculada de cada posición (position.gainLoss, la misma que usa deleveragingPriority/LEV6) —
// nunca un % de ganancia declarado a mano.

const appSource = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");

function extractFunction(name) {
  const start = appSource.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `No existe la función ${name} en app.js`);
  const parenStart = appSource.indexOf("(", start);
  let parenDepth = 0;
  let bodyStart = -1;
  for (let index = parenStart; index < appSource.length; index += 1) {
    if (appSource[index] === "(") parenDepth += 1;
    else if (appSource[index] === ")") {
      parenDepth -= 1;
      if (parenDepth === 0) { bodyStart = appSource.indexOf("{", index); break; }
    }
  }
  assert.ok(bodyStart >= 0, `No se encontró el cuerpo de ${name}`);
  let depth = 0;
  for (let index = bodyStart; index < appSource.length; index += 1) {
    if (appSource[index] === "{") depth += 1;
    else if (appSource[index] === "}") {
      depth -= 1;
      if (depth === 0) return appSource.slice(start, index + 1);
    }
  }
  throw new Error(`La función ${name} no cierra sus llaves`);
}

const SAVINGS_SCALE = {
  brackets: [
    { limit: 6000, rate: 19 },
    { limit: null, rate: 21 },
  ],
  source: { title: "Escala del ahorro", authority: "AEAT", url: "https://example.org/irpf", checkedAt: "2026-01-01" },
};

function sandbox({ rawPositions = [], scale = null, alreadyRealized = "0" } = {}) {
  const container = { innerHTML: "" };
  const context = {
    window: { FinanceCanonicalPortfolio: PortfolioEngine, FinanceCanonicalIrpfEstimator: IrpfEstimator },
    qs: (id) => {
      if (id === "inv13DcaTaxProjection") return container;
      if (id === "fc5AlreadyRealized") return { value: alreadyRealized };
      return null;
    },
    iv1PositionsList: () => rawPositions,
    latestIrpfScale: () => scale,
    parseAmount: (value) => (value === "" || value === undefined ? NaN : Number(value)),
    money: (value) => `${Math.round(value)}€`,
    escapeHtml: (value) => String(value ?? ""),
    round2: (value) => Math.round(Number(value) * 100) / 100,
    container,
  };
  vm.createContext(context);
  vm.runInContext(extractFunction("renderInv13DcaTaxProjection"), context);
  return context;
}

const DCA_POSITION_WITH_GAIN = { id: "p1", label: "Fondo indexado", costBasis: 5000, currentValue: 8000, dcaMonthlyAmount: 100, dcaStartDate: "2024-01-01" };
const DCA_POSITION_WITHOUT_GAIN = { id: "p2", label: "Fondo en pérdidas", costBasis: 5000, currentValue: 4000, dcaMonthlyAmount: 100, dcaStartDate: "2024-01-01" };
const NON_DCA_POSITION = { id: "p3", label: "Sin plan", costBasis: 1000, currentValue: 1500 };

test("renderInv13DcaTaxProjection · sin posiciones registradas", () => {
  const ctx = sandbox({ rawPositions: [] });
  ctx.renderInv13DcaTaxProjection();
  assert.match(ctx.container.innerHTML, /Sin posiciones registradas todavía/);
});

test("renderInv13DcaTaxProjection · con posiciones pero ninguna con plan DCA declarado", () => {
  const ctx = sandbox({ rawPositions: [NON_DCA_POSITION] });
  ctx.renderInv13DcaTaxProjection();
  assert.match(ctx.container.innerHTML, /Declara una aportación periódica prevista/);
});

test("renderInv13DcaTaxProjection · posición DCA sin plusvalía acumulada todavía", () => {
  const ctx = sandbox({ rawPositions: [DCA_POSITION_WITHOUT_GAIN] });
  ctx.renderInv13DcaTaxProjection();
  assert.match(ctx.container.innerHTML, /sin plusvalía acumulada todavía/);
});

test("renderInv13DcaTaxProjection · con plusvalía pero sin escala del ahorro registrada, pide registrarla en vez de inventar un tipo", () => {
  const ctx = sandbox({ rawPositions: [DCA_POSITION_WITH_GAIN], scale: null });
  ctx.renderInv13DcaTaxProjection();
  assert.match(ctx.container.innerHTML, /plusvalía acumulada 3000€/);
  assert.match(ctx.container.innerHTML, /registra la escala del tramo del ahorro/);
});

test("renderInv13DcaTaxProjection · con plusvalía real y escala registrada, calcula el coste fiscal marginal con optimizePartialSale", () => {
  const ctx = sandbox({ rawPositions: [DCA_POSITION_WITH_GAIN], scale: SAVINGS_SCALE, alreadyRealized: "0" });
  ctx.renderInv13DcaTaxProjection();
  const expected = IrpfEstimator.optimizePartialSale({ scale: SAVINGS_SCALE, alreadyRealizedGain: 0, proposedGain: 3000 });
  assert.match(ctx.container.innerHTML, new RegExp(`plusvalía acumulada 3000€ → ${Math.round(expected.marginalTax)}€`));
  assert.match(ctx.container.innerHTML, /Nunca decide vender por ti/);
});

test("renderInv13DcaTaxProjection · la plusvalía ya realizada este año (fc5AlreadyRealized) desplaza el tramo, mismo campo que LEV15", () => {
  const ctxBase = sandbox({ rawPositions: [DCA_POSITION_WITH_GAIN], scale: SAVINGS_SCALE, alreadyRealized: "0" });
  ctxBase.renderInv13DcaTaxProjection();
  const ctxWithPriorGain = sandbox({ rawPositions: [DCA_POSITION_WITH_GAIN], scale: SAVINGS_SCALE, alreadyRealized: "6000" });
  ctxWithPriorGain.renderInv13DcaTaxProjection();
  const withoutPrior = IrpfEstimator.optimizePartialSale({ scale: SAVINGS_SCALE, alreadyRealizedGain: 0, proposedGain: 3000 });
  const withPrior = IrpfEstimator.optimizePartialSale({ scale: SAVINGS_SCALE, alreadyRealizedGain: 6000, proposedGain: 3000 });
  assert.notEqual(withoutPrior.marginalTax, withPrior.marginalTax);
  assert.match(ctxWithPriorGain.container.innerHTML, new RegExp(`${Math.round(withPrior.marginalTax)}€`));
});

test("wiring: renderInv13DcaTaxProjection se llama junto a renderInv8DcaTracking en ambos puntos de refresco", () => {
  const occurrences = appSource.split("renderInv8DcaTracking();").length - 1;
  const pairedOccurrences = appSource.split("renderInv8DcaTracking();\n  renderInv13DcaTaxProjection();").length - 1;
  assert.equal(occurrences, 2);
  assert.equal(pairedOccurrences, 2);
});
