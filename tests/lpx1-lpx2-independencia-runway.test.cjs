const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const Assets = require(path.join(root, "canonical-assets.js"));

// LPX1/LPX2 (Oleada 2 Bloque 3): capital objetivo de independencia financiera y runway del
// patrimonio neto completo. La tasa de retirada la declara el hogar (sin un 4% por defecto que
// nadie ha elegido) — mismo criterio que el resto de supuestos del hogar (A15-1, FC4).

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

test("financialIndependenceTarget · capital objetivo = gasto anual / tasa de retirada, con progreso y hueco", () => {
  const result = Assets.financialIndependenceTarget({ annualExpenses: 24000, withdrawalRatePct: 4, netWorth: 300000 });
  assert.equal(result.calculable, true);
  assert.equal(result.targetCorpus, 600000);
  assert.equal(result.gap, 300000);
  assert.equal(result.progressPct, 50);
  assert.equal(result.reached, false);
});

test("financialIndependenceTarget · patrimonio ya por encima del objetivo, reached=true y progreso 100", () => {
  const result = Assets.financialIndependenceTarget({ annualExpenses: 24000, withdrawalRatePct: 4, netWorth: 700000 });
  assert.equal(result.reached, true);
  assert.equal(result.progressPct, 100);
  assert.equal(result.gap, 0);
});

test("financialIndependenceTarget · sin tasa de retirada declarada, no calculable — no hay un 4% por defecto", () => {
  const result = Assets.financialIndependenceTarget({ annualExpenses: 24000, withdrawalRatePct: null, netWorth: 300000 });
  assert.equal(result.calculable, false);
});

test("netWorthRunway · meses = patrimonio neto / gasto mensual medio, con aviso de parte no líquida", () => {
  const result = Assets.netWorthRunway({
    netWorth: 100000,
    monthlyBurn: 2000,
    totalsByType: { cuenta: 20000, inversion: 20000, inmueble: 60000 },
  });
  assert.equal(result.calculable, true);
  assert.equal(result.months, 50);
  assert.equal(result.illiquidPct, 60);
});

test("netWorthRunway · patrimonio neto negativo, 0 meses (no un número negativo de meses)", () => {
  const result = Assets.netWorthRunway({ netWorth: -5000, monthlyBurn: 2000 });
  assert.equal(result.months, 0);
});

test("netWorthRunway · sin gasto mensual medio, no calculable", () => {
  const result = Assets.netWorthRunway({ netWorth: 100000, monthlyBurn: 0 });
  assert.equal(result.calculable, false);
});

test("index.html: los dos campos/tarjetas viven en Ajustes › Patrimonio", () => {
  assert.match(html, /id="lpx1WithdrawalRatePct"/);
  assert.match(html, /id="lpx1FinancialIndependence"/);
  assert.match(html, /id="lpx2NetWorthRunway"/);
});

test("app.js: renderLpx1FinancialIndependence y renderLpx2NetWorthRunway reutilizan lpNetWorthSnapshot (A14-2) y lpAverageMonthlyOutflow, y están en el render() central", () => {
  const lpx1 = extractFunction("renderLpx1FinancialIndependence");
  assert.match(lpx1, /lpNetWorthSnapshot\(\)/);
  assert.match(lpx1, /lpAverageMonthlyOutflow\(\)/);
  assert.match(lpx1, /financialIndependenceTarget/);
  const lpx2 = extractFunction("renderLpx2NetWorthRunway");
  assert.match(lpx2, /lpNetWorthSnapshot\(\)/);
  assert.match(lpx2, /netWorthRunway/);
  assert.match(app, /renderLpx1FinancialIndependence\(\);\s*\n\s*renderLpx2NetWorthRunway\(\);/);
});
