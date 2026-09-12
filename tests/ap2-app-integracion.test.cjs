const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const appSource = fs.readFileSync(require.resolve("../app.js"), "utf8");

test("AP2: handleAp1Compare también calcula el punto de equilibrio con el mismo TIN/horizonte", () => {
  // DLX1 añadió el cálculo del guardarraíl de colchón y DLX2 el reparto del excedente, ambos entre
  // el punto de equilibrio y el pintado del resultado; DEB15 (Oleada 4, Bloque 6) añadió el
  // guardarraíl a varios meses justo antes del pintado, y DEB17 (Oleada 4, Bloque 6) el mismo
  // guardarraíl bajo tensión justo después — la ventana crece de 1800 a 2100 a 3000 a 3800.
  const block = appSource.slice(appSource.indexOf("function handleAp1Compare("), appSource.indexOf("function handleAp1Compare(") + 3800);
  assert.match(block, /debtComparator\.breakEvenInvestmentRatePct\(debtAnnualRatePct, months\)/);
  assert.match(block, /ap1ResultHtml\(result, investmentAnnualReturnPct, breakEven\)/);
});

test("AP2: sin punto de equilibrio calculable, no se dibuja ninguna línea (nunca un dato inventado)", () => {
  const block = appSource.slice(appSource.indexOf("function ap2BreakEvenLine("), appSource.indexOf("function ap2BreakEvenLine(") + 300);
  assert.match(block, /if \(!breakEven \|\| !breakEven\.calculable\) return "";/);
});

test("AP2: sin XIRR real de la cartera, dice explícitamente que falta el dato en vez de comparar contra nada", () => {
  const block = appSource.slice(appSource.indexOf("function ap2BreakEvenLine("), appSource.indexOf("function ap2BreakEvenLine(") + 900);
  assert.match(block, /investmentAnnualReturnPct === null/);
  assert.match(block, /Sin XIRR real de tu cartera/);
});

test("AP2: reutiliza el mismo TIN/horizonte que ya pide la tarjeta de AP1 — ningún campo nuevo", () => {
  assert.doesNotMatch(appSource, /ap2DebtRate|ap2Months/);
});
