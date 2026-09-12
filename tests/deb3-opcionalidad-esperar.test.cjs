const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const appSource = fs.readFileSync(require.resolve("../app.js"), "utf8");
const indexSource = fs.readFileSync(require.resolve("../index.html"), "utf8");
const comparatorSource = fs.readFileSync(require.resolve("../canonical-debt-comparator.js"), "utf8");
const comparator = require("../canonical-debt-comparator.js");

test("DEB3: waitingOptionValue exige importe, meses de espera y TIN válidos", () => {
  assert.equal(comparator.waitingOptionValue({ amount: 0, debtAnnualRatePct: 5, waitMonths: 6 }).calculable, false);
  assert.equal(comparator.waitingOptionValue({ amount: 1000, debtAnnualRatePct: 5, waitMonths: 0 }).calculable, false);
  assert.equal(comparator.waitingOptionValue({ amount: 1000, debtAnnualRatePct: null, waitMonths: 6 }).calculable, false);
});

test("DEB3: el coste de esperar es interés simple, misma fórmula que compareAmortizeVsInvest (AP1)", () => {
  const result = comparator.waitingOptionValue({ amount: 10000, debtAnnualRatePct: 6, waitMonths: 6 });
  assert.equal(result.calculable, true);
  // 10000 * 0.06 * (6/12) = 300
  assert.equal(result.waitingCost, 300);
  assert.equal(result.waitMonths, 6);
  assert.equal(result.debtAnnualRatePct, 6);
});

test("DEB3: sin gasto mensual declarado no inventa meses de aguante (liquidityRunwayMonths null)", () => {
  const result = comparator.waitingOptionValue({ amount: 10000, debtAnnualRatePct: 6, waitMonths: 6, monthlyOutflow: null });
  assert.equal(result.calculable, true);
  assert.equal(result.liquidityRunwayMonths, null);
  assert.equal(result.monthlyOutflow, null);
});

test("DEB3: con gasto mensual declarado calcula cuántos meses de gasto cubriría ese importe por sí solo (nunca una probabilidad inventada)", () => {
  const result = comparator.waitingOptionValue({ amount: 6000, debtAnnualRatePct: 6, waitMonths: 6, monthlyOutflow: 2000 });
  assert.equal(result.calculable, true);
  assert.equal(result.liquidityRunwayMonths, 3);
});

test("DEB3: nunca calcula un 'valor de la opción' en euros — el motor no devuelve ningún campo con ese nombre", () => {
  const result = comparator.waitingOptionValue({ amount: 6000, debtAnnualRatePct: 6, waitMonths: 6, monthlyOutflow: 2000 });
  const keys = Object.keys(result).map((key) => key.toLowerCase());
  assert.ok(!keys.some((key) => key.includes("optionvalue") || key.includes("valoropcion")));
});

test("DEB3: waitingOptionValue está exportado desde FinanceDebtComparator", () => {
  assert.match(comparatorSource, /WAITING_OPTION_VALUE_SCHEMA_ID,\s*\n\s*waitingOptionValue,/);
});

test("DEB3: la tarjeta AP1 tiene el campo de meses de espera y su nota de resultado", () => {
  assert.match(indexSource, /id="deb3WaitMonths"/);
  assert.match(indexSource, /id="deb3OptionValueNote"/);
  const fieldIdx = indexSource.indexOf('id="deb3WaitMonths"');
  const noteIdx = indexSource.indexOf('id="deb3OptionValueNote"');
  const runIdx = indexSource.indexOf('id="ap1CompareRun"');
  assert.ok(fieldIdx > 0 && runIdx > fieldIdx, "el campo de espera debe estar antes del botón Comparar");
  assert.ok(noteIdx > runIdx, "la nota de resultado debe estar después del botón Comparar");
});

test("DEB3: deb3OptionValueHtml no renderiza nada cuando el resultado no es calculable", () => {
  const block = appSource.slice(appSource.indexOf("function deb3OptionValueHtml("), appSource.indexOf("function deb3OptionValueHtml(") + 500);
  assert.match(block, /if \(!result\.calculable\) return "";/);
});

test("DEB3: renderDeb3OptionValue lee el campo propio de meses de espera y compone el gasto mensual con la cuota de deuda de GOB9", () => {
  const block = appSource.slice(appSource.indexOf("function renderDeb3OptionValue("), appSource.indexOf("function renderDeb3OptionValue(") + 900);
  assert.match(block, /qs\("deb3WaitMonths"\)\?\.value/);
  assert.match(block, /lpAverageMonthlyOutflow\(\)/);
  assert.match(block, /gob9MonthlyDebtService\(\)/);
  assert.match(block, /waitingOptionValue\(/);
});

test("DEB3: handleAp1Compare llama a renderDeb3OptionValue tras comparar, reutilizando el importe y el TIN ya leídos", () => {
  // DEB15 (Oleada 4, Bloque 6) añadió el guardarraíl a varios meses antes del pintado del
  // resultado — la ventana crece de 3000 a 3900.
  const block = appSource.slice(appSource.indexOf("function handleAp1Compare("), appSource.indexOf("function handleAp1Compare(") + 3900);
  assert.match(block, /renderDeb3OptionValue\(amount, debtAnnualRatePct\);/);
});
