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

// T5 extrajo el cálculo de "totalDebtOutstanding() / netWorthAfterDebt" a a14NetWorthToday()
// (para que la cascada mensual lo reutilice sin duplicarlo) — renderA14AssetBreakdown ahora lo
// consume desde ahí en vez de calcularlo en línea.
test("A14-2 (núcleo): el patrimonio neto resta la deuda pendiente, centralizado en a14NetWorthToday()", () => {
  const todayBlock = appSource.slice(appSource.indexOf("function a14NetWorthToday"), appSource.indexOf("function a14NetWorthToday") + 700);
  assert.match(todayBlock, /totalDebtOutstanding\(\)/);
  assert.match(todayBlock, /netWorthAfterDebt/);

  const renderBlock = appSource.slice(appSource.indexOf("function renderA14AssetBreakdown"), appSource.indexOf("function renderA14AssetBreakdown") + 1800);
  assert.match(renderBlock, /a14NetWorthToday\(\)/);
  assert.match(renderBlock, /netWorthAfterDebt/);
  assert.match(renderBlock, /Patrimonio neto/);
});

test("A14-2 (núcleo): sin DebtContracts disponible, la deuda cuenta como 0 sin romper el cálculo", () => {
  const block = appSource.slice(appSource.indexOf("function totalDebtOutstanding"), appSource.indexOf("function totalDebtOutstanding") + 200);
  assert.match(block, /if \(!DebtContracts\) return 0;/);
});
