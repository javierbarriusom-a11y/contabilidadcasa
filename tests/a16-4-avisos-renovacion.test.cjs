const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { renewalAdvisory, renewalAdvisories } = require("../canonical-renewal-advisor.js");

// A16-4 · avisos de renovación con acción sugerida, sobre lo que detecta A16-3
// (detectRecurringSubscriptions, que ahora expone monthsSeen). Motor puro, nunca inventa una
// cadencia: solo la infiere cuando el hueco entre TODAS las apariciones vistas es idéntico.

test("expone FinanceCanonicalRenewalAdvisor al cargarse directamente en navegador", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "canonical-renewal-advisor.js"), "utf8");
  const context = { globalThis: {} };
  vm.runInNewContext(source, context, { filename: "canonical-renewal-advisor.js" });
  assert.equal(typeof context.globalThis.FinanceCanonicalRenewalAdvisor?.renewalAdvisory, "function");
});

test("cadencia anual regular: estima la próxima renovación y sugiere decidir cuando está cerca", () => {
  const result = renewalAdvisory({ pattern: "seguro", label: "Seguro anual", monthsSeen: ["2024-12", "2025-12"] }, "2026-11");
  assert.equal(result.cadenceMonths, 12);
  assert.equal(result.nextRenewal, "2026-12");
  assert.equal(result.monthsUntilRenewal, 1);
  assert.equal(result.action, "decidir-antes-de-renovar");
});

test("cadencia anual regular pero lejana: no sugiere acción todavía", () => {
  const result = renewalAdvisory({ pattern: "seguro", label: "Seguro anual", monthsSeen: ["2024-12", "2025-12"] }, "2026-06");
  assert.equal(result.monthsUntilRenewal, 6);
  assert.equal(result.action, "sin-accion-todavia");
});

test("cadencia mensual: no hay fecha de renovación distinta que avisar", () => {
  const result = renewalAdvisory({ pattern: "spotify", label: "Spotify", monthsSeen: ["2026-06", "2026-07", "2026-08"] }, "2026-09");
  assert.equal(result.cadenceMonths, 1);
  assert.equal(result.nextRenewal, null);
  assert.equal(result.action, "sin-fecha-distinguible");
});

test("con menos de dos apariciones, no fabrica ninguna fecha", () => {
  const result = renewalAdvisory({ pattern: "x", label: "X", monthsSeen: ["2025-01"] }, "2026-01");
  assert.equal(result.cadenceMonths, null);
  assert.equal(result.action, "sin-fecha-estimable");
});

test("con huecos irregulares entre apariciones, no fabrica ninguna cadencia", () => {
  const result = renewalAdvisory({ pattern: "x", label: "X", monthsSeen: ["2025-01", "2025-04", "2025-10"] }, "2026-01");
  assert.equal(result.cadenceMonths, null);
  assert.equal(result.action, "sin-fecha-estimable");
});

test("sin monthsSeen declarado, no fabrica ninguna cadencia", () => {
  const result = renewalAdvisory({ pattern: "x", label: "X" }, "2026-01");
  assert.equal(result.action, "sin-fecha-estimable");
});

test("sin mes de referencia válido, no calcula nada", () => {
  assert.equal(renewalAdvisory({ pattern: "x", monthsSeen: ["2025-01", "2025-12"] }, ""), null);
  assert.equal(renewalAdvisory({ pattern: "x", monthsSeen: ["2025-01", "2025-12"] }), null);
});

test("renewalAdvisories procesa una lista completa, filtrando los sin mes de referencia", () => {
  const results = renewalAdvisories([
    { pattern: "a", monthsSeen: ["2024-12", "2025-12"] },
    { pattern: "b", monthsSeen: ["2026-06", "2026-07", "2026-08"] },
  ], "2026-11");
  assert.equal(results.length, 2);
  assert.equal(results[0].action, "decidir-antes-de-renovar");
  assert.equal(results[1].action, "sin-fecha-distinguible");
});

test("está cargado en index.html antes que app.js, disponible para su consumo desde Análisis", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const advisorScript = html.indexOf("canonical-renewal-advisor.js");
  const appScript = html.indexOf("app.js?v=");
  assert.ok(advisorScript >= 0, "El módulo de avisos de renovación debe cargarse en el HTML.");
  assert.ok(appScript >= 0);
  assert.ok(advisorScript < appScript, "El módulo debe estar disponible antes de app.js.");
});
