const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const Portfolio = require("../canonical-portfolio.js");

// INV19 (Oleada 4, Bloque 4): el coste de no tocar nunca tu cartera, a 10-20 años, en un gráfico —
// compoundedFeeCost (IVX4) da un número puntual al final de un horizonte; esto genera la
// trayectoria año a año, sumando cada posición con comisión declarada por separado (nunca un % medio
// inventado sobre el conjunto).

const appSource = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const indexSource = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

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

test("portfolioFeeCostTrajectory · sin posiciones con comisión declarada, no calculable", () => {
  assert.equal(Portfolio.portfolioFeeCostTrajectory([]).calculable, false);
  assert.equal(Portfolio.portfolioFeeCostTrajectory([{ currentValue: 1000, feePct: 0 }]).calculable, false);
});

test("portfolioFeeCostTrajectory · una posición, la trayectoria coincide año a año con compoundedFeeCost", () => {
  const trajectory = Portfolio.portfolioFeeCostTrajectory([{ currentValue: 10000, feePct: 1 }], 20);
  assert.equal(trajectory.calculable, true);
  assert.equal(trajectory.points.length, 21);
  assert.equal(trajectory.points[0].year, 0);
  assert.equal(trajectory.points[0].netValue, 10000);
  const at10 = Portfolio.compoundedFeeCost({ currentValue: 10000, feePct: 1, years: 10 });
  assert.equal(trajectory.points[10].netValue, at10.netValue);
  const at20 = Portfolio.compoundedFeeCost({ currentValue: 10000, feePct: 1, years: 20 });
  assert.equal(trajectory.points[20].netValue, at20.netValue);
  assert.equal(trajectory.totalFeeCost, at20.totalFeeCost);
});

test("portfolioFeeCostTrajectory · varias posiciones con comisiones distintas se suman por separado, nunca un % medio", () => {
  const trajectory = Portfolio.portfolioFeeCostTrajectory([
    { currentValue: 10000, feePct: 1 },
    { currentValue: 5000, feePct: 2 },
    { currentValue: 3000, feePct: 0 },
  ], 10);
  assert.equal(trajectory.calculable, true);
  assert.equal(trajectory.positionsCount, 2);
  assert.equal(trajectory.grossValue, 15000);
  const expectedNetAt10 = Portfolio.compoundedFeeCost({ currentValue: 10000, feePct: 1, years: 10 }).netValue
    + Portfolio.compoundedFeeCost({ currentValue: 5000, feePct: 2, years: 10 }).netValue;
  assert.equal(trajectory.points[10].netValue, Math.round(expectedNetAt10 * 100) / 100);
});

test("portfolioFeeCostTrajectory · por defecto usa 20 años", () => {
  const trajectory = Portfolio.portfolioFeeCostTrajectory([{ currentValue: 1000, feePct: 1 }]);
  assert.equal(trajectory.years, 20);
  assert.equal(trajectory.years, Portfolio.FEE_COST_TRAJECTORY_DEFAULT_YEARS);
});

function sandbox({ rawPositions = [] } = {}) {
  const container = { innerHTML: "" };
  const context = {
    window: { FinanceCanonicalPortfolio: Portfolio },
    qs: (id) => (id === "inv19FeeCostTrajectory" ? container : null),
    iv1PositionsList: () => rawPositions,
    money: (value) => `${Math.round(value)}€`,
    escapeHtml: (value) => String(value ?? ""),
    round2: (value) => Math.round(Number(value) * 100) / 100,
    container,
  };
  vm.createContext(context);
  vm.runInContext(extractFunction("inv19FeeCostTrajectoryHtml"), context);
  vm.runInContext(extractFunction("renderInv19FeeCostTrajectory"), context);
  return context;
}

test("renderInv19FeeCostTrajectory · sin posiciones, mensaje neutro", () => {
  const ctx = sandbox({ rawPositions: [] });
  ctx.renderInv19FeeCostTrajectory();
  assert.match(ctx.container.innerHTML, /Registra al menos una posición con comisión anual declarada/);
});

test("renderInv19FeeCostTrajectory · posiciones sin comisión declarada, pide declararla", () => {
  const ctx = sandbox({ rawPositions: [{ id: "p1", label: "Fondo", currentValue: 1000, feePct: 0 }] });
  ctx.renderInv19FeeCostTrajectory();
  assert.match(ctx.container.innerHTML, /Declara la comisión anual/);
});

test("renderInv19FeeCostTrajectory · con comisión declarada, dibuja el gráfico y resume el coste total a 20 años", () => {
  const ctx = sandbox({ rawPositions: [{ id: "p1", label: "Fondo", currentValue: 10000, feePct: 1 }] });
  ctx.renderInv19FeeCostTrajectory();
  assert.match(ctx.container.innerHTML, /<svg class="inv19-fee-chart"/);
  assert.match(ctx.container.innerHTML, /a 20 años/);
  assert.match(ctx.container.innerHTML, /sin ninguna aportación ni rentabilidad de mercado supuesta/);
});

test("index.html: tarjeta INV19 vive junto a la exposición por divisa y geografía", () => {
  assert.match(indexSource, /id="inv19FeeCostTrajectory"/);
});

test("wiring: renderInv19FeeCostTrajectory se llama junto a renderInv16ConcentrationWarnings en cada mutación relevante", () => {
  const occurrences = appSource.split("renderInv16ConcentrationWarnings();\n  renderInv14CurrencyGeographyExposure();\n  renderInv19FeeCostTrajectory();").length - 1;
  assert.ok(occurrences >= 7, `Se esperaban al menos 7 sitios, encontrados: ${occurrences}`);
});
