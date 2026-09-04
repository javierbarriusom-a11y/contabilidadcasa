const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const DebtComparator = require(path.join(root, "canonical-debt-comparator.js"));

// APX1 (Oleada 2 Bloque 3): el punto de equilibrio de AP2 (breakEvenInvestmentRatePct) da por hecha
// una rentabilidad de inversión libre de impuestos. netDebtCostAfterTax() la "eleva" con el mismo
// tipo del ahorro que ya declara el hogar en FC4 (dividendSpanishSavingsRatePct) — sin inventar un
// tramo de IRPF ni duplicar el campo.

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

test("netDebtCostAfterTax · con tipo del ahorro declarado, eleva el punto de equilibrio por encima del nominal", () => {
  const breakEven = DebtComparator.breakEvenInvestmentRatePct(4, 240);
  const result = DebtComparator.netDebtCostAfterTax(breakEven, 19);
  assert.equal(result.calculable, true);
  assert.ok(result.requiredPretaxReturnPct > result.breakEvenAnnualReturnPct);
  // 19% de tipo: dividir entre (1 - 0.19) = /0.81, un factor de aprox. 1.2346.
  assert.equal(result.requiredPretaxReturnPct, Math.round((result.breakEvenAnnualReturnPct / 0.81) * 100) / 100);
});

test("netDebtCostAfterTax · sin tipo del ahorro declarado (0), no calculable — no se inventa un 0% de fiscalidad", () => {
  const breakEven = DebtComparator.breakEvenInvestmentRatePct(4, 240);
  const result = DebtComparator.netDebtCostAfterTax(breakEven, 0);
  assert.equal(result.calculable, false);
});

test("netDebtCostAfterTax · sin breakEven calculable, no calculable", () => {
  const result = DebtComparator.netDebtCostAfterTax({ calculable: false }, 19);
  assert.equal(result.calculable, false);
});

test("netDebtCostAfterTax · tipo del ahorro igual o mayor que 100%, no calculable", () => {
  const breakEven = DebtComparator.breakEvenInvestmentRatePct(4, 240);
  assert.equal(DebtComparator.netDebtCostAfterTax(breakEven, 100).calculable, false);
});

test("app.js: apx1NetDebtCostHtml reutiliza dividendSpanishSavingsRatePct (FC4) y fc3PriorLossesList (FC3), sin campo nuevo duplicado", () => {
  const block = extractFunction("apx1NetDebtCostHtml");
  assert.match(block, /dividendSpanishSavingsRatePct\(\)/);
  assert.match(block, /netDebtCostAfterTax/);
  assert.match(block, /fc3PriorLossesList\(\)/);
  assert.match(block, /Coste neto de fiscalidad real/);
});

test("app.js: ap1ResultHtml añade apx1NetDebtCostHtml a la nota de AP1", () => {
  const block = extractFunction("ap1ResultHtml");
  assert.match(block, /apx1NetDebtCostHtml\(breakEven\)/);
});
