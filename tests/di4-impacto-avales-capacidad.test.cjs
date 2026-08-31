const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { guaranteeCapacityImpact } = require("../canonical-loan-guarantees.js");

// DI4 · impacto de un aval dado en la capacidad de endeudamiento futura (D-12: margen antes de
// superar el umbral de deuda/ingresos). Un banco descuenta la cuota del aval como si fuera deuda
// propia, aunque hoy no se esté pagando. Motor puro, mismo patrón de campo único declarado que DI2.

test("expone FinanceCanonicalLoanGuarantees al cargarse directamente en navegador", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "canonical-loan-guarantees.js"), "utf8");
  const context = { globalThis: {} };
  vm.runInNewContext(source, context, { filename: "canonical-loan-guarantees.js" });
  assert.equal(typeof context.globalThis.FinanceCanonicalLoanGuarantees?.guaranteeCapacityImpact, "function");
});

test("el aval consume parte del margen, queda margen real menor", () => {
  const result = guaranteeCapacityImpact(500, 200);
  assert.equal(result.marginBeforeGuarantees, 500);
  assert.equal(result.remainingMargin, 300);
  assert.equal(result.exceedsCapacity, false);
});

test("el aval supera el margen disponible: no queda margen real, aunque el ratio de deuda no lo refleje", () => {
  const result = guaranteeCapacityImpact(500, 700);
  assert.equal(result.remainingMargin, 0);
  assert.equal(result.exceedsCapacity, true);
});

test("sin aval declarado, el margen no cambia", () => {
  const result = guaranteeCapacityImpact(500, 0);
  assert.equal(result.remainingMargin, 500);
  assert.equal(result.exceedsCapacity, false);
});

test("sin margen previo (ya sobre el umbral) y con aval, sigue sin margen, no se vuelve negativo", () => {
  const result = guaranteeCapacityImpact(0, 300);
  assert.equal(result.marginBeforeGuarantees, 0);
  assert.equal(result.remainingMargin, 0);
  assert.equal(result.exceedsCapacity, true);
});

test("valores negativos o inválidos se tratan como cero, sin inventar margen ni aval", () => {
  const result = guaranteeCapacityImpact(-100, -50);
  assert.equal(result.marginBeforeGuarantees, 0);
  assert.equal(result.guaranteedMonthlyTotal, 0);
  assert.equal(result.remainingMargin, 0);
  assert.equal(result.exceedsCapacity, false);
});

test("está cargado en index.html antes que app.js, disponible para su consumo desde Deuda", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const guaranteesScript = html.indexOf("canonical-loan-guarantees.js");
  const appScript = html.indexOf("app.js?v=");
  assert.ok(guaranteesScript >= 0, "El módulo de avales debe cargarse en el HTML.");
  assert.ok(appScript >= 0);
  assert.ok(guaranteesScript < appScript, "El módulo debe estar disponible antes de app.js.");
});
