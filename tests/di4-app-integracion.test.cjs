const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const appSource = fs.readFileSync(require.resolve("../app.js"), "utf8");
const indexSource = fs.readFileSync(require.resolve("../index.html"), "utf8");

test("DI4: la tarjeta de Ajustes tiene el campo de la cuota mensual del aval", () => {
  assert.match(indexSource, /id="ajustesLoanGuaranteeMonthly"/);
  assert.match(indexSource, /id="ajustesLoanGuaranteeNote"/);
});

test("DI4: debtCapacityStatus calcula el impacto del aval sobre el margen de D-12", () => {
  const start = appSource.indexOf("function debtCapacityStatus");
  const block = appSource.slice(start, start + 900);
  assert.match(block, /FinanceCanonicalLoanGuarantees\?\.guaranteeCapacityImpact\(marginEuros, loanGuaranteeMonthly\(\)\)/);
});

test("DI4: debtCapacityHtml pinta el aviso del aval solo cuando hay algo declarado", () => {
  const start = appSource.indexOf("function debtCapacityHtml");
  const block = appSource.slice(start, start + 1600);
  assert.match(block, /guarantee && guarantee\.guaranteedMonthlyTotal > 0/);
  assert.match(block, /guarantee\.exceedsCapacity/);
});

test("DI4: el campo guarda en scenarioSettings al cambiar", () => {
  assert.match(appSource, /qs\("ajustesLoanGuaranteeMonthly"\)\?\.addEventListener\("change", handleLoanGuaranteeMonthlyChange\);/);
  const start = appSource.indexOf("function saveScenarioSettings(");
  const end = appSource.indexOf("\n}", start);
  const body = appSource.slice(start, end);
  assert.match(body, /loanGuaranteeMonthly: round2\(Math\.max\(0, Number\(state\.loanGuaranteeMonthly \|\| 0\)\)\)/);
});

test("DI4: renderAjustes sincroniza y rellena la nota del aval", () => {
  const start = appSource.indexOf("function renderAjustes(");
  const end = appSource.indexOf("\n}", start);
  const body = appSource.slice(start, end);
  assert.match(body, /syncLoanGuaranteeControl\(\);/);
  assert.match(body, /renderAjustesLoanGuaranteeNote\(\);/);
});

test("DI4: el módulo canónico está registrado en index.html y en la whitelist del sitio público", () => {
  assert.match(indexSource, /canonical-loan-guarantees\.js\?v=/);
  const buildScript = fs.readFileSync(require.resolve("../tools/build-public-site.mjs"), "utf8");
  assert.match(buildScript, /"canonical-loan-guarantees\.js"/);
});
