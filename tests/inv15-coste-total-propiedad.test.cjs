const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const Portfolio = require("../canonical-portfolio.js");

// INV15 (Oleada 4, Bloque 4): coste total de propiedad real por posición — IVX4 (compoundedFeeCost)
// solo aísla el TER/gestión declarado. Falta el otro coste habitual de mantener una posición:
// custodia/corretaje, casi siempre un importe FIJO anual (€/año), no un %. Se suma sin componer al
// coste compuesto de feePct que ya calcula compoundedFeeCost.

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

test("canonical-portfolio.js: normalizePosition declara custodyFeeAnnual, 0 si no se declara", () => {
  assert.equal(Portfolio.normalizePosition({ label: "Fondo", currentValue: 1000, custodyFeeAnnual: 30 }).custodyFeeAnnual, 30);
  assert.equal(Portfolio.normalizePosition({ label: "Fondo", currentValue: 1000 }).custodyFeeAnnual, 0);
});

test("totalCostOfOwnership · sin valor, sin feePct ni custodyFeeAnnual, u horizonte, no calculable", () => {
  assert.equal(Portfolio.totalCostOfOwnership({}).calculable, false);
  assert.equal(Portfolio.totalCostOfOwnership({ currentValue: 1000, years: 10 }).calculable, false);
  assert.equal(Portfolio.totalCostOfOwnership({ currentValue: 1000, feePct: 1, custodyFeeAnnual: 30 }).calculable, false);
});

test("totalCostOfOwnership · solo custodyFeeAnnual declarado (sin feePct): coste fijo sin componer", () => {
  const result = Portfolio.totalCostOfOwnership({ currentValue: 10000, custodyFeeAnnual: 30, years: 10 });
  assert.equal(result.calculable, true);
  assert.equal(result.managementFeeCost, 0);
  assert.equal(result.custodyFeeCost, 300);
  assert.equal(result.totalCost, 300);
});

test("totalCostOfOwnership · feePct y custodyFeeAnnual declarados, se suman sin mezclar sus cálculos", () => {
  const management = Portfolio.compoundedFeeCost({ currentValue: 10000, feePct: 1, years: 10 });
  const result = Portfolio.totalCostOfOwnership({ currentValue: 10000, feePct: 1, custodyFeeAnnual: 30, years: 10 });
  assert.equal(result.calculable, true);
  assert.equal(result.managementFeeCost, management.totalFeeCost);
  assert.equal(result.custodyFeeCost, 300);
  assert.equal(result.totalCost, Math.round((management.totalFeeCost + 300) * 100) / 100);
});

function sandbox({ years = "10" } = {}) {
  const container = { innerHTML: "" };
  const context = {
    window: { FinanceCanonicalPortfolio: Portfolio },
    qs: (id) => {
      if (id === "ivx4FeeHorizonYears") return { value: years };
      return null;
    },
    parseAmount: (value) => (value === "" || value === undefined ? NaN : Number(value)),
    money: (value) => `${Math.round(value)}€`,
    container,
  };
  vm.createContext(context);
  vm.runInContext(extractFunction("inv15TotalCostOfOwnershipLabel"), context);
  return context;
}

test("inv15TotalCostOfOwnershipLabel · sin feePct ni custodyFeeAnnual, etiqueta vacía", () => {
  const ctx = sandbox();
  assert.equal(ctx.inv15TotalCostOfOwnershipLabel({ currentValue: 1000, feePct: 0, custodyFeeAnnual: 0 }), "");
});

test("inv15TotalCostOfOwnershipLabel · sin horizonte introducido, etiqueta vacía", () => {
  const ctx = sandbox({ years: "" });
  assert.equal(ctx.inv15TotalCostOfOwnershipLabel({ currentValue: 1000, feePct: 1, custodyFeeAnnual: 30 }), "");
});

test("inv15TotalCostOfOwnershipLabel · con datos, combina gestión y custodia en una sola frase", () => {
  const ctx = sandbox({ years: "10" });
  const label = ctx.inv15TotalCostOfOwnershipLabel({ currentValue: 10000, feePct: 1, custodyFeeAnnual: 30 });
  assert.match(label, /coste total de propiedad a 10 año\(s\)/);
  assert.match(label, /gestión/);
  assert.match(label, /custodia\/corretaje/);
});

test("index.html: campo de custodia/corretaje anual al registrar una posición", () => {
  assert.match(indexSource, /id="iv1PositionCustodyFeeAnnual"/);
});

test("app.js: saveIv1Position lee custodyFeeAnnual y renderIv1PositionList incluye la nota de INV15", () => {
  const block = extractFunction("saveIv1Position");
  assert.match(block, /qs\("iv1PositionCustodyFeeAnnual"\)\?\.value/);
  const listBlock = extractFunction("renderIv1PositionList");
  assert.match(listBlock, /inv15TotalCostOfOwnershipLabel\(position\)/);
});
