const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { calculateDividendTax } = require("../canonical-dividend-tax.js");

// FC4 · retención de dividendos extranjeros y deducción por doble imposición internacional. Motor
// puro, mismo patrón que canonical-home-insurance.js (SP3): sin conexión a un dividendo real de la
// cartera todavía, calculadora suelta con la regla del límite real de la deducción (art. 80 LIRPF).

test("expone FinanceCanonicalDividendTax al cargarse directamente en navegador", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "canonical-dividend-tax.js"), "utf8");
  const context = { globalThis: {} };
  vm.runInNewContext(source, context, { filename: "canonical-dividend-tax.js" });
  assert.equal(typeof context.globalThis.FinanceCanonicalDividendTax?.calculateDividendTax, "function");
});

test("retención de origen por debajo de la cuota española: se deduce entera, queda cuota adicional", () => {
  const result = calculateDividendTax({ grossAmount: 1000, foreignWithholdingPct: 15, spanishSavingsRatePct: 19 });
  assert.equal(result.foreignWithheld, 150);
  assert.equal(result.spanishTaxDue, 190);
  assert.equal(result.creditableForeignTax, 150);
  assert.equal(result.additionalSpanishTax, 40);
  assert.equal(result.excessForeignWithholding, 0);
  assert.equal(result.netAmount, 810);
});

test("retención de origen por encima de la cuota española: la deducción se capa, el resto no se recupera", () => {
  const result = calculateDividendTax({ grossAmount: 1000, foreignWithholdingPct: 30, spanishSavingsRatePct: 19 });
  assert.equal(result.foreignWithheld, 300);
  assert.equal(result.creditableForeignTax, 190); // capado a la cuota española, no a la retención completa
  assert.equal(result.additionalSpanishTax, 0);
  assert.equal(result.excessForeignWithholding, 110);
  assert.equal(result.netAmount, 700);
});

test("sin retención en origen declarada, se trata como cero, no como desconocida", () => {
  const result = calculateDividendTax({ grossAmount: 1000, spanishSavingsRatePct: 19 });
  assert.equal(result.foreignWithholdingPct, 0);
  assert.equal(result.foreignWithheld, 0);
  assert.equal(result.additionalSpanishTax, 190);
  assert.equal(result.netAmount, 810);
});

test("sin importe bruto declarado, no fabrica un cálculo", () => {
  assert.equal(calculateDividendTax({ foreignWithholdingPct: 15, spanishSavingsRatePct: 19 }), null);
  assert.equal(calculateDividendTax({ grossAmount: 0, spanishSavingsRatePct: 19 }), null);
});

test("sin tipo del ahorro español declarado, no fabrica un cálculo", () => {
  assert.equal(calculateDividendTax({ grossAmount: 1000, foreignWithholdingPct: 15 }), null);
});

test("entrada vacía no fabrica ningún cálculo", () => {
  assert.equal(calculateDividendTax({}), null);
  assert.equal(calculateDividendTax(), null);
});

test("está cargado en index.html antes que app.js, disponible para su consumo desde Ajustes", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const dividendScript = html.indexOf("canonical-dividend-tax.js");
  const appScript = html.indexOf("app.js?v=");
  assert.ok(dividendScript >= 0, "El módulo de retención de dividendos debe cargarse en el HTML.");
  assert.ok(appScript >= 0);
  assert.ok(dividendScript < appScript, "El módulo debe estar disponible antes de app.js.");
});
