const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const appSource = fs.readFileSync(require.resolve("../app.js"), "utf8");
const indexSource = fs.readFileSync(require.resolve("../index.html"), "utf8");

test("A18-2: la tarjeta de saldo continuo tiene el formulario de gasto compartido y el resumen", () => {
  ["a18EntryCategory", "a18EntryAmount", "a18EntryDate", "a18EntryPaidBy", "a18EntrySave", "a18BalanceCard", "a18EntryList"].forEach((id) => {
    assert.match(indexSource, new RegExp(`id="${id}"`), `Falta #${id} en la tarjeta de saldo continuo`);
  });
});

test("A18-2: saveA18Entry valida el importe antes de registrar el gasto compartido", () => {
  const block = appSource.slice(appSource.indexOf("function saveA18Entry("), appSource.indexOf("function saveA18Entry(") + 900);
  assert.match(block, /Indica un importe mayor que cero para el gasto compartido/);
  assert.match(block, /paidBy/);
});

test("A18-2: el botón de registrar gasto y la lista con el botón de quitar están cableados", () => {
  assert.match(appSource, /qs\("a18EntrySave"\)\?\.addEventListener\("click", saveA18Entry\);/);
  assert.match(appSource, /qs\("a18EntryList"\)\?\.addEventListener\("click"/);
  assert.match(appSource, /removeA18Entry\(removeButton\.dataset\.a18EntryRemove\)/);
});

test("A18-2: renderA18BalanceCard delega en FinanceCanonicalHouseholdSplit.runningBalance, sin motor propio", () => {
  const block = appSource.slice(appSource.indexOf("function renderA18BalanceCard("), appSource.indexOf("function renderA18BalanceCard(") + 700);
  assert.match(block, /window\.FinanceCanonicalHouseholdSplit/);
  assert.match(block, /engine\.runningBalance\(entries, householdSplitSettings\(\)\)/);
});

test("A18-2: sin gastos registrados, la tarjeta pide registrar al menos uno, nunca inventa un saldo", () => {
  const block = appSource.slice(appSource.indexOf("function renderA18BalanceCard("), appSource.indexOf("function renderA18BalanceCard(") + 700);
  assert.match(block, /Registra al menos un gasto compartido/);
});

test("A18-2: a18BalanceLabel nunca inventa una dirección de deuda cuando el saldo está en cero", () => {
  const block = appSource.slice(appSource.indexOf("function a18BalanceLabel("), appSource.indexOf("function a18BalanceLabel(") + 300);
  assert.match(block, /if \(!balance\.owes\)/);
  assert.match(block, /Sin saldo pendiente entre Javi y Tere/);
});

test("A18-2: cambiar una regla o los ingresos declarados refresca el saldo continuo", () => {
  const ruleBlock = appSource.slice(appSource.indexOf("function saveA18Rule("), appSource.indexOf("function saveA18Rule(") + 700);
  assert.match(ruleBlock, /renderA18BalanceCard\(\);/);
  const incomesBlock = appSource.slice(appSource.indexOf("function saveA18Incomes("), appSource.indexOf("function saveA18Incomes(") + 400);
  assert.match(incomesBlock, /renderA18BalanceCard\(\);/);
});

test("A18-2: la lista inicial de renders al cargar la app incluye la tarjeta de saldo continuo", () => {
  const index = appSource.indexOf('renderA18RuleCategoryOptions();\n  renderA18RuleList();\n  renderA18EntryCategoryOptions();\n  renderA18EntryList();\n  renderA18BalanceCard();');
  assert.ok(index >= 0, "no se encontró el bloque de renders iniciales de A18-2 en el arranque");
});

test("canonical-household-split.js está versionado en index.html", () => {
  assert.match(indexSource, /canonical-household-split\.js\?v=/);
});
