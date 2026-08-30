const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const appSource = fs.readFileSync(require.resolve("../app.js"), "utf8");

test("A14-2 (núcleo): totalDebtOutstanding() reutiliza canonical-debt-contracts.js, sin motor propio", () => {
  assert.match(appSource, /function totalDebtOutstanding\(\)/);
  const block = appSource.slice(appSource.indexOf("function totalDebtOutstanding"), appSource.indexOf("function totalDebtOutstanding") + 300);
  assert.match(block, /DebtContracts\.summarizeContracts/);
  assert.match(block, /currentPrincipal/);
});

test("A14-2 (núcleo): el desglose de patrimonio resta la deuda pendiente del patrimonio de activos", () => {
  const block = appSource.slice(appSource.indexOf("function renderA14AssetBreakdown"), appSource.indexOf("function renderA14AssetBreakdown") + 1800);
  assert.match(block, /totalDebtOutstanding\(\)/);
  assert.match(block, /netWorthAfterDebt/);
  assert.match(block, /Patrimonio neto/);
});

test("A14-2 (núcleo): sin DebtContracts disponible, la deuda cuenta como 0 sin romper el cálculo", () => {
  const block = appSource.slice(appSource.indexOf("function totalDebtOutstanding"), appSource.indexOf("function totalDebtOutstanding") + 200);
  assert.match(block, /if \(!DebtContracts\) return 0;/);
});
