const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const appSource = fs.readFileSync(require.resolve("../app.js"), "utf8");
const indexSource = fs.readFileSync(require.resolve("../index.html"), "utf8");
const deudaSource = fs.readFileSync(require.resolve("../views/deuda.js"), "utf8");
const comparatorSource = fs.readFileSync(require.resolve("../canonical-debt-comparator.js"), "utf8");
const comparator = require("../canonical-debt-comparator.js");

test("DEB7: declaredPreferenceReading no aplica con la preferencia por defecto (coste mínimo)", () => {
  const reading = comparator.declaredPreferenceReading("invertir", comparator.DEBT_PREFERENCE.MIN_COST);
  assert.equal(reading.applies, false);
});

test("DEB7: declaredPreferenceReading no aplica sin un veredicto real de AP1", () => {
  const reading = comparator.declaredPreferenceReading(null, comparator.DEBT_PREFERENCE.DEBT_FREE);
  assert.equal(reading.applies, false);
  const reading2 = comparator.declaredPreferenceReading("invertir-no-calculable", comparator.DEBT_PREFERENCE.DEBT_FREE);
  assert.equal(reading2.applies, false);
});

test("DEB7: señala la tensión cuando la preferencia es libre-deudas pero AP1 dice invertir", () => {
  const reading = comparator.declaredPreferenceReading("invertir", comparator.DEBT_PREFERENCE.DEBT_FREE);
  assert.equal(reading.calculable, true);
  assert.equal(reading.applies, true);
  assert.equal(reading.conflicts, true);
});

test("DEB7: no hay tensión cuando la preferencia es libre-deudas y AP1 también dice amortizar o neutral", () => {
  const amortizar = comparator.declaredPreferenceReading("amortizar", comparator.DEBT_PREFERENCE.DEBT_FREE);
  assert.equal(amortizar.conflicts, false);
  const neutral = comparator.declaredPreferenceReading("neutral", comparator.DEBT_PREFERENCE.DEBT_FREE);
  assert.equal(neutral.conflicts, false);
});

test("DEB7: nunca sustituye el veredicto de AP1 — el resultado solo señala, no cambia 'assessment'", () => {
  const reading = comparator.declaredPreferenceReading("invertir", comparator.DEBT_PREFERENCE.DEBT_FREE);
  assert.equal(reading.assessment, "invertir");
});

test("DEB7: DEBT_PREFERENCE y declaredPreferenceReading están exportados desde FinanceDebtComparator", () => {
  assert.match(comparatorSource, /DEBT_PREFERENCE,\s*\n\s*declaredPreferenceReading,/);
});

test("DEB7: la tarjeta AP1 tiene el selector de preferencia con sus dos opciones y su nota", () => {
  assert.match(indexSource, /id="deb7PreferenceSelect"/);
  assert.match(indexSource, /<option value="coste-minimo">Coste financiero mínimo<\/option>/);
  assert.match(indexSource, /<option value="libre-deudas">Estar libre de deudas cuanto antes<\/option>/);
  assert.match(indexSource, /id="deb7PreferenceNote"/);
});

test("DEB7: deb7PreferenceHtml no renderiza nada cuando la lectura no aplica", () => {
  const block = appSource.slice(appSource.indexOf("function deb7PreferenceHtml("), appSource.indexOf("function deb7PreferenceHtml(") + 700);
  assert.match(block, /if \(!reading\.applies\) return "";/);
});

test("DEB7: renderDeb7PreferenceReading lee el último veredicto real de AP1 y la preferencia declarada", () => {
  const block = appSource.slice(appSource.indexOf("function renderDeb7PreferenceReading("), appSource.indexOf("function renderDeb7PreferenceReading(") + 500);
  assert.match(block, /declaredPreferenceReading\(deb7LastAp1Assessment, deb7Preference\(\)\)/);
});

test("DEB7: handleDeb7PreferenceChange persiste la preferencia y refresca su propia nota", () => {
  const block = appSource.slice(appSource.indexOf("function handleDeb7PreferenceChange("), appSource.indexOf("function handleDeb7PreferenceChange(") + 500);
  assert.match(block, /state\.deb7Preference = qs\("deb7PreferenceSelect"\)\?\.value === "libre-deudas" \? "libre-deudas" : "coste-minimo";/);
  assert.match(block, /saveScenarioSettings\(\);/);
  assert.match(block, /renderDeb7PreferenceReading\(\);/);
});

test("DEB7: el selector está cableado a handleDeb7PreferenceChange", () => {
  assert.match(appSource, /qs\("deb7PreferenceSelect"\)\?\.addEventListener\("change", handleDeb7PreferenceChange\);/);
});

test("DEB7: handleAp1Compare guarda el veredicto y refresca la lectura de preferencia tras comparar", () => {
  // DEB15 (Oleada 4, Bloque 6) añadió el guardarraíl a varios meses antes del pintado del
  // resultado — la ventana crece de 3000 a 3900.
  const block = appSource.slice(appSource.indexOf("function handleAp1Compare("), appSource.indexOf("function handleAp1Compare(") + 3900);
  assert.match(block, /deb7LastAp1Assessment = result\.calculable \? result\.assessment : null;/);
  assert.match(block, /renderDeb7PreferenceReading\(\);/);
});

test("DEB7: la preferencia declarada se sincroniza y se lee al abrir Deuda › Apalancamiento", () => {
  assert.match(deudaSource, /syncDeb7PreferenceControl\(\);\s*\n\s*renderDeb7PreferenceReading\(\);/);
});

test("DEB7: la preferencia se persiste como un dato más del hogar (mismo criterio que LEV1)", () => {
  const block = appSource.slice(appSource.indexOf('ap1TrackedComparison: scenarioSettings.ap1TrackedComparison || null,'), appSource.indexOf('ap1TrackedComparison: scenarioSettings.ap1TrackedComparison || null,') + 700);
  assert.match(block, /deb7Preference: state\.deb7Preference === "libre-deudas" \? "libre-deudas" : "coste-minimo",/);
});
