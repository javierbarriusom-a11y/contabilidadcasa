const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { evaluateLeverageBarrier } = require("../canonical-leverage-barrier.js");

// ESTADO.md §3, decisión 7 (formato de cifras único) y §5 (los textos de los motores se arreglan en origen): los dos
// bloqueos con cifras del guardarraíl de apalancamiento (AP4), que se pintan tal cual en Inversión › Deuda y
// apalancamiento › «Simulador de apalancamiento» (#ap3BarrierStatus), salen con euros enteros, punto de miles y «€»,
// y el porcentaje con coma — nunca «12345.67» ni «35.2%».

function input(overrides = {}) {
  return { cushion: { value: 6000, floor: 4000 }, debtQualityIssues: [], monthlyIncome: 4000, monthlyDebtService: 800, ...overrides };
}

const detail = (result, id) => result.blockers.find((item) => item.id === id)?.detail;

test("colchón bajo el suelo: euros enteros con punto de miles y «€»", () => {
  const result = evaluateLeverageBarrier(input({ cushion: { value: 12345.67, floor: 15000 } }));
  assert.equal(
    detail(result, "cushion-below-floor"),
    "El colchón actual (12.346 €) no llega al suelo configurado (15.000 €). Sin ese margen, pedir deuda nueva para invertir no es prudente.",
  );
});

test("colchón: cifras de 4 y de 7 cifras agrupan igual, y uno negativo lleva «−»", () => {
  assert.match(detail(evaluateLeverageBarrier(input({ cushion: { value: 2000.4, floor: 4000 } })), "cushion-below-floor"), /\(2\.000 €\).*\(4\.000 €\)/);
  assert.match(detail(evaluateLeverageBarrier(input({ cushion: { value: 999999.5, floor: 1234567 } })), "cushion-below-floor"), /\(1\.000\.000 €\).*\(1\.234\.567 €\)/);
  assert.match(detail(evaluateLeverageBarrier(input({ cushion: { value: -1500, floor: 800 } })), "cushion-below-floor"), /\(−1\.500 €\).*\(800 €\)/);
});

test("cuota sobre el ingreso: porcentaje con coma decimal y espacio antes de «%»", () => {
  const result = evaluateLeverageBarrier(input({ monthlyIncome: 2000, monthlyDebtService: 704 }));
  assert.equal(
    detail(result, "debt-service-ratio-too-high"),
    "Las cuotas actuales representan el 35,2 % del ingreso mensual neto, por encima del 35 % que este guardarraíl considera prudente antes de sumar deuda nueva.",
  );
  // Justo en el umbral (bloquea) y por encima del 100 %: siempre un decimal, con coma.
  assert.match(detail(evaluateLeverageBarrier(input({ monthlyIncome: 1000, monthlyDebtService: 350 })), "debt-service-ratio-too-high"), /el 35,0 % del ingreso/);
  assert.match(detail(evaluateLeverageBarrier(input({ monthlyIncome: 1000, monthlyDebtService: 1234.5 })), "debt-service-ratio-too-high"), /el 123,5 % del ingreso/);
});

test("la etiqueta del check de la cuota lleva el mismo «35 %», con espacio", () => {
  const check = evaluateLeverageBarrier(input()).checks.find((item) => item.id === "debt-service-ratio");
  assert.equal(check.label, "Cuota de deuda actual por debajo del 35 % del ingreso");
});

test("el motor ya no formatea cifras para el usuario con toFixed", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "canonical-leverage-barrier.js"), "utf8");
  assert.doesNotMatch(source, /toFixed\(/);
});
