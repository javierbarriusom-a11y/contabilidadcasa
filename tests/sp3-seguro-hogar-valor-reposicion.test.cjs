const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { evaluateHomeInsuranceGap } = require("../canonical-home-insurance.js");

// SP3 · seguro de hogar vs. valor de reposición de bienes. Motor puro, mismo patrón que
// canonical-life-coverage.js (SP2): un gap simple entre cobertura declarada y valor de reposición.

test("expone FinanceCanonicalHomeInsurance al cargarse directamente en navegador", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "canonical-home-insurance.js"), "utf8");
  const context = { globalThis: {} };
  vm.runInNewContext(source, context, { filename: "canonical-home-insurance.js" });
  assert.equal(typeof context.globalThis.FinanceCanonicalHomeInsurance?.evaluateHomeInsuranceGap, "function");
});

test("cobertura por encima del valor de reposición: suficiente, sin brecha", () => {
  const result = evaluateHomeInsuranceGap(30000, 20000);
  assert.equal(result.covered, true);
  assert.equal(result.gap, 0);
  assert.equal(result.coverageRatio, 1.5);
});

test("cobertura por debajo del valor de reposición: brecha exacta sin cubrir", () => {
  const result = evaluateHomeInsuranceGap(12000, 20000);
  assert.equal(result.covered, false);
  assert.equal(result.gap, 8000);
  assert.equal(result.coverageRatio, 0.6);
});

test("cobertura igual al valor de reposición: cubierto justo, sin brecha", () => {
  const result = evaluateHomeInsuranceGap(20000, 20000);
  assert.equal(result.covered, true);
  assert.equal(result.gap, 0);
  assert.equal(result.coverageRatio, 1);
});

test("sin cobertura configurada, todo el valor de reposición es la brecha", () => {
  const result = evaluateHomeInsuranceGap(0, 20000);
  assert.equal(result.covered, false);
  assert.equal(result.gap, 20000);
  assert.equal(result.coverageRatio, 0);
});

test("sin valor de reposición declarado, cualquier cobertura cubre y el ratio no aplica", () => {
  const result = evaluateHomeInsuranceGap(5000, 0);
  assert.equal(result.covered, true);
  assert.equal(result.gap, 0);
  assert.equal(result.coverageRatio, null);
});

test("valores negativos o inválidos se tratan como cero, sin inventar cobertura ni valor", () => {
  const result = evaluateHomeInsuranceGap(-500, -200);
  assert.equal(result.coverage, 0);
  assert.equal(result.replacementValue, 0);
  assert.equal(result.gap, 0);
  assert.equal(result.covered, true);
  assert.equal(result.coverageRatio, null);
});

test("está cargado en index.html antes que app.js, disponible para su consumo desde Ajustes", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const insuranceScript = html.indexOf("canonical-home-insurance.js");
  const appScript = html.indexOf("app.js?v=");
  assert.ok(insuranceScript >= 0, "El módulo de seguro de hogar debe cargarse en el HTML.");
  assert.ok(appScript >= 0);
  assert.ok(insuranceScript < appScript, "El módulo debe estar disponible antes de app.js.");
});
