const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const Portfolio = require(path.join(root, "canonical-portfolio.js"));

// IVX4 (Oleada 2 Bloque 3): coste compuesto de comisiones. Aísla el efecto puro de la comisión
// anual declarada (feePct) sobre el valor actual a lo largo de un horizonte, sin asumir ninguna
// rentabilidad de mercado — eso exigiría un supuesto de crecimiento que el hogar no ha declarado.

function extractFunction(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `No existe la función ${name} en app.js`);
  const parenStart = app.indexOf("(", start);
  let parenDepth = 0;
  let bodyStart = -1;
  for (let index = parenStart; index < app.length; index += 1) {
    if (app[index] === "(") parenDepth += 1;
    else if (app[index] === ")") {
      parenDepth -= 1;
      if (parenDepth === 0) { bodyStart = app.indexOf("{", index); break; }
    }
  }
  assert.ok(bodyStart >= 0, `No se encontró el cuerpo de ${name}`);
  let depth = 0;
  for (let index = bodyStart; index < app.length; index += 1) {
    if (app[index] === "{") depth += 1;
    else if (app[index] === "}") {
      depth -= 1;
      if (depth === 0) return app.slice(start, index + 1);
    }
  }
  throw new Error(`La función ${name} no cierra sus llaves`);
}

test("compoundedFeeCost · con comisión y horizonte, compone feePct% cada año sobre el valor actual", () => {
  const result = Portfolio.compoundedFeeCost({ currentValue: 10000, feePct: 1, years: 10 });
  assert.equal(result.calculable, true);
  assert.equal(result.grossValue, 10000);
  assert.equal(result.netValue, Math.round(10000 * Math.pow(0.99, 10) * 100) / 100);
  assert.ok(result.totalFeeCost > 0);
});

test("compoundedFeeCost · sin comisión, sin valor o sin horizonte, no calculable", () => {
  assert.equal(Portfolio.compoundedFeeCost({ currentValue: 10000, feePct: 0, years: 10 }).calculable, false);
  assert.equal(Portfolio.compoundedFeeCost({ currentValue: 0, feePct: 1, years: 10 }).calculable, false);
  assert.equal(Portfolio.compoundedFeeCost({ currentValue: 10000, feePct: 1, years: 0 }).calculable, false);
});

test("normalizePosition · feePct por defecto 0 (sin comisión declarada), nunca inventado", () => {
  const result = Portfolio.normalizePosition({ label: "Fondo", quantity: 10, costBasis: 1000, currentValue: 1200 });
  assert.equal(result.feePct, 0);
  const withFee = Portfolio.normalizePosition({ label: "Fondo", quantity: 10, costBasis: 1000, currentValue: 1200, feePct: 1.5 });
  assert.equal(withFee.feePct, 1.5);
});

test("ivx4FeeCostLabel · con comisión y horizonte declarados, muestra el coste compuesto", () => {
  const vm = require("node:vm");
  const context = {
    money: (value) => `${Math.round(value * 100) / 100} €`,
    parseAmount: (value) => { const n = Number(String(value ?? "").replace(",", ".")); return Number.isFinite(n) ? n : 0; },
    qs: (id) => (id === "ivx4FeeHorizonYears" ? { value: "10" } : null),
    window: { FinanceCanonicalPortfolio: Portfolio },
  };
  vm.createContext(context);
  vm.runInContext(extractFunction("ivx4FeeCostLabel"), context);
  const label = context.ivx4FeeCostLabel({ currentValue: 10000, feePct: 1 });
  assert.match(label, /comisión 1%\/año/);
  assert.match(label, /coste compuesto a 10 año\(s\)/);
});

test("ivx4FeeCostLabel · sin comisión declarada o sin horizonte, cadena vacía", () => {
  const vm = require("node:vm");
  const context = {
    money: (value) => `${value} €`,
    parseAmount: (value) => Number(value) || 0,
    qs: (id) => (id === "ivx4FeeHorizonYears" ? { value: "" } : null),
    window: { FinanceCanonicalPortfolio: Portfolio },
  };
  vm.createContext(context);
  vm.runInContext(extractFunction("ivx4FeeCostLabel"), context);
  assert.equal(context.ivx4FeeCostLabel({ currentValue: 10000, feePct: 1 }), "");
  assert.equal(context.ivx4FeeCostLabel({ currentValue: 10000, feePct: 0 }), "");
});

test("index.html: campo de comisión anual al registrar una posición y horizonte compartido", () => {
  assert.match(html, /id="iv1PositionFeePct"/);
  assert.match(html, /id="ivx4FeeHorizonYears"/);
});

test("app.js: saveIv1Position guarda feePct, clearIv1PositionForm lo limpia, y el listener del horizonte recalcula la lista", () => {
  const saveBlock = extractFunction("saveIv1Position");
  assert.match(saveBlock, /qs\("iv1PositionFeePct"\)\?\.value/);
  assert.match(saveBlock, /goalId, feePct, contributions: \[\]/);
  const clearBlock = extractFunction("clearIv1PositionForm");
  assert.match(clearBlock, /feePctInput\.value = ""/);
  assert.match(app, /qs\("ivx4FeeHorizonYears"\)\?\.addEventListener\("input", renderIv1PositionList\)/);
});

test("app.js: renderIv1PositionList añade la nota de coste de comisión a la línea de cada posición, sin sustituir el resto", () => {
  const block = app.slice(app.indexOf("function renderIv1PositionList("), app.indexOf("function renderIv1PositionList(") + 1700);
  assert.match(block, /ivx4FeeCostLabel\(position\)/);
  assert.match(block, /coste \$\{money\(position\.costBasis, true\)\}/, "no debe sustituir el coste total ya existente");
});
