const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const E7 = require("../canonical-e7-analysis.js");

test("expone el contrato E7 en navegador", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "canonical-e7-analysis.js"), "utf8");
  const context = { globalThis: {} };
  vm.runInNewContext(source, context);
  assert.equal(typeof context.globalThis.FinanceCanonicalE7.paretoFrontier, "function");
});

test("los efectos jurídicos y fiscales conservan fuente, fecha, jurisdicción y advertencia", () => {
  const effects = E7.buildAgreementEffects("single-payment", { debtReduction: 900, insolvency: true });
  assert.equal(effects.length, 3);
  effects.forEach((effect) => {
    assert.equal(effect.source.authority, "BOE");
    assert.equal(effect.source.jurisdiction, "ES");
    assert.match(effect.source.checkedAt, /^\d{4}-\d{2}-\d{2}$/);
    assert.match(effect.source.url, /^https:\/\/www\.boe\.es\//);
    assert.equal(effect.professionalReviewRequired, true);
  });
  assert.equal(effects.find((effect) => effect.kind === "tax").confidence, "low");
});

test("la frontera excluye alternativas dominadas y las que rompen reserva", () => {
  const result = E7.paretoFrontier([
    { id: "balanced", remainingDebt: 0, totalCost: 800, minChecking: 3500, reserveMargin: 500, carFund: 1000 },
    { id: "dominated", remainingDebt: 0, totalCost: 900, minChecking: 3300, reserveMargin: 300, carFund: 900 },
    { id: "cheap", remainingDebt: 100, totalCost: 600, minChecking: 3200, reserveMargin: 200, carFund: 1300 },
    { id: "unsafe", remainingDebt: 0, totalCost: 100, minChecking: 2500, reserveMargin: -500, carFund: 2000 },
  ], { reserve: 3000 });
  assert.deepEqual(result.frontierIds.sort(), ["balanced", "cheap"]);
  assert.equal(result.alternatives.find((item) => item.id === "dominated").dominatedBy.includes("balanced"), true);
  assert.equal(result.alternatives.some((item) => item.id === "unsafe"), false);
});

test("los escenarios usan solo movimientos conciliados y muestran bandas más allá de 24 meses", () => {
  const entries = Array.from({ length: 8 }, (_, index) => ({
    id: `ok-${index}`, date: `2026-${String(index + 1).padStart(2, "0")}-02`, amount: 100 + index * 10, reconciled: true,
  })).concat([{ id: "ignored", date: "2026-01-03", amount: 99999, reconciled: false }]);
  const result = E7.calibrateScenarios(entries, { horizonMonths: 36 });
  assert.equal(result.sampleMonths, 8);
  assert.equal(result.excludedEntries, 1);
  assert.equal(result.confidence, "medium");
  assert.equal(result.display, "range");
  assert.ok(result.scenarios[0].monthlyNet < result.scenarios[2].monthlyNet);
});

test("una muestra insuficiente no inventa precisión", () => {
  const result = E7.calibrateScenarios([{ date: "2026-01-01", amount: 20, reconciled: true }]);
  assert.equal(result.confidence, "low");
  assert.match(result.warning, /Muestra corta/);
  assert.equal(result.scenarios.every((item) => item.calibrated === false), true);
});

test("la comparación de importación detalla altas, cambios, duplicados, bajas e impacto", () => {
  const result = E7.compareImport(
    [{ id: "a", amount: 10 }, { id: "b", amount: 20 }],
    [{ id: "a", amount: 12 }, { id: "c", amount: 30 }, { id: "c", amount: 30 }],
    { invariants: { canonical: true } },
  );
  assert.equal(result.additions.length, 1);
  assert.equal(result.changes.length, 1);
  assert.equal(result.removals.length, 1);
  assert.deepEqual(result.duplicates, ["c"]);
  assert.equal(result.monthlyEffect, 42);
  assert.equal(result.valid, false);
});
