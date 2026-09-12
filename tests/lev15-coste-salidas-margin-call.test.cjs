const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const IrpfEstimator = require("../canonical-irpf-estimator.js");
const LeverageSimulator = require("../canonical-leverage-simulator.js");

// LEV15 (Oleada 4, Bloque 5): coste comparado en euros y efecto fiscal de las dos salidas reales del
// margin call de APX3 (aportar garantía vs. liquidación forzosa) — lombardMarginCallSimulation ya
// calcula ambos importes, pero no dice cuál sale más barato ni el efecto fiscal de vender bajo
// llamada de garantía. Se apoya en optimizePartialSale (mismo motor de tramos del ahorro que FC5)
// para el efecto fiscal de la liquidación forzosa.

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
  brackets: [{ limit: 6000, rate: 19 }, { limit: 50000, rate: 21 }, { limit: null, rate: 23 }],
  source: { title: "Agencia Tributaria", authority: "Declarado por el hogar", url: "https://sede.agenciatributaria.gob.es/x", checkedAt: "2026-01-01" },
};

function sandbox({ scale = SAVINGS_SCALE, alreadyRealizedGain = "0", gainLossPct = "" } = {}) {
  const values = { fc5AlreadyRealized: alreadyRealizedGain, lev15GainLossPct: gainLossPct };
  const context = {
    window: { FinanceCanonicalIrpfEstimator: IrpfEstimator },
    qs: (id) => (id in values ? { value: values[id] } : null),
    parseAmount: (value) => {
      const raw = String(value ?? "").trim();
      if (!raw) return null;
      const parsed = Number(raw.replace(",", "."));
      return Number.isFinite(parsed) ? parsed : null;
    },
    round2: (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100,
    money: (value) => `${Math.round(value)}€`,
    latestIrpfScale: () => scale,
  };
  vm.createContext(context);
  vm.runInContext(extractFunction("lev15ForcedLiquidationGain"), context);
  vm.runInContext(extractFunction("lev15MarginCallExitCostHtml"), context);
  return context;
}

test("lev15ForcedLiquidationGain · sin plusvalía declarada, no hay plusvalía que fiscal (0)", () => {
  const ctx = sandbox();
  assert.equal(ctx.lev15ForcedLiquidationGain(10000, 0), 0);
  assert.equal(ctx.lev15ForcedLiquidationGain(10000, null), 0);
});

test("lev15ForcedLiquidationGain · plusvalía del 50% sobre 15000€ liquidados: 5000€ de plusvalía (fórmula pro-rata)", () => {
  const ctx = sandbox();
  assert.equal(ctx.lev15ForcedLiquidationGain(15000, 50), 5000);
});

test("lev15MarginCallExitCostHtml · sin llamada de garantía disparada, no hay nada que comparar", () => {
  const ctx = sandbox();
  const html = ctx.lev15MarginCallExitCostHtml({ calculable: true, marginCallTriggered: false });
  assert.equal(html, "");
});

test("lev15MarginCallExitCostHtml · sin plusvalía declarada, compara sin coste fiscal (aportar garantía sale más barato)", () => {
  const ctx = sandbox({ gainLossPct: "" });
  const html = ctx.lev15MarginCallExitCostHtml({
    calculable: true, marginCallTriggered: true, additionalCollateralNeeded: 2000, forcedLiquidationAmount: 8000,
  });
  assert.match(html, /LEV15/);
  assert.match(html, /2000€/);
  assert.match(html, /8000€/);
  assert.match(html, /Aportar garantía sale/);
  assert.doesNotMatch(html, /coste fiscal estimado/);
});

test("lev15MarginCallExitCostHtml · con plusvalía declarada, añade el coste fiscal de optimizePartialSale a la liquidación forzosa", () => {
  const ctx = sandbox({ gainLossPct: "50", alreadyRealizedGain: "0" });
  // forcedLiquidationAmount 15000€, 50% de plusvalía declarada -> 5000€ de plusvalía realizada,
  // que cae entera en el primer tramo (19%, hasta 6000€) -> 950€ de coste fiscal estimado.
  const html = ctx.lev15MarginCallExitCostHtml({
    calculable: true, marginCallTriggered: true, additionalCollateralNeeded: 20000, forcedLiquidationAmount: 15000,
  });
  assert.match(html, /coste fiscal estimado/);
  assert.match(html, /950€/);
  assert.match(html, /liquidación forzosa sale/i);
});

test("wiring: handleApx3MarginCallSimulate compone lev15MarginCallExitCostHtml junto al resultado del margin call", () => {
  const start = appSource.indexOf("function handleApx3MarginCallSimulate(");
  const block = appSource.slice(start, appSource.indexOf("\n}\n", start) + 3);
  assert.match(block, /lev15MarginCallExitCostHtml\(result\)/);
});

test("lombardMarginCallSimulation (APX3) sigue siendo el único motor de las dos salidas — LEV15 no reimplementa el cálculo de importes", () => {
  const result = LeverageSimulator.lombardMarginCallSimulation({ portfolioValue: 100000, loanAmount: 60000, maintenanceLtvPct: 70, stressDropPct: 20 });
  assert.equal(result.calculable, true);
  assert.equal(result.marginCallTriggered, true);
  assert.ok(result.additionalCollateralNeeded > 0);
  assert.ok(result.forcedLiquidationAmount > 0);
});
