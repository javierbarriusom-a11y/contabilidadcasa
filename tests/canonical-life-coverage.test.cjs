const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { evaluateLifeCoverageGap } = require("../canonical-life-coverage.js");

// SP2 · Bloque 1: compara el capital asegurado con la deuda pendiente total. Motor puro, sin
// inventario de pólizas todavía (SP1, más adelante) — un único capital agregado basta aquí.

test("expone FinanceCanonicalLifeCoverage al cargarse directamente en navegador", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "canonical-life-coverage.js"), "utf8");
  const context = { globalThis: {} };
  vm.runInNewContext(source, context, { filename: "canonical-life-coverage.js" });
  assert.equal(typeof context.globalThis.FinanceCanonicalLifeCoverage?.evaluateLifeCoverageGap, "function");
});

test("capital asegurado por encima de la deuda: cobertura suficiente, sin brecha", () => {
  const result = evaluateLifeCoverageGap(200000, 120000);
  assert.equal(result.covered, true);
  assert.equal(result.gap, 0);
  assert.equal(result.coverageRatio, 1.67);
});

test("capital asegurado por debajo de la deuda: brecha exacta sin cubrir", () => {
  const result = evaluateLifeCoverageGap(80000, 120000);
  assert.equal(result.covered, false);
  assert.equal(result.gap, 40000);
  assert.equal(result.coverageRatio, 0.67);
});

test("capital asegurado igual a la deuda: cubierto justo, sin brecha", () => {
  const result = evaluateLifeCoverageGap(120000, 120000);
  assert.equal(result.covered, true);
  assert.equal(result.gap, 0);
  assert.equal(result.coverageRatio, 1);
});

test("sin capital asegurado configurado, toda la deuda es la brecha", () => {
  const result = evaluateLifeCoverageGap(0, 120000);
  assert.equal(result.covered, false);
  assert.equal(result.gap, 120000);
  assert.equal(result.coverageRatio, 0);
});

test("sin deuda pendiente, cualquier capital cubre y el ratio no aplica", () => {
  const result = evaluateLifeCoverageGap(50000, 0);
  assert.equal(result.covered, true);
  assert.equal(result.gap, 0);
  assert.equal(result.coverageRatio, null);
});

test("valores negativos o inválidos se tratan como cero, sin inventar cobertura ni deuda", () => {
  const result = evaluateLifeCoverageGap(-500, -200);
  assert.equal(result.capital, 0);
  assert.equal(result.deuda, 0);
  assert.equal(result.gap, 0);
  assert.equal(result.covered, true);
  assert.equal(result.coverageRatio, null);
});

test("está cargado en index.html antes que app.js, disponible para su consumo desde Ajustes", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const coverageScript = html.indexOf("canonical-life-coverage.js");
  const appScript = html.indexOf("app.js?v=");
  assert.ok(coverageScript >= 0, "El módulo de cobertura de vida debe cargarse en el HTML.");
  assert.ok(appScript >= 0);
  assert.ok(coverageScript < appScript, "El módulo debe estar disponible antes de app.js.");
});
