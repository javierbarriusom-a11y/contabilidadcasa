const test = require("node:test");
const assert = require("node:assert/strict");

const Portfolio = require("../canonical-portfolio.js");

// IV2 (BACKLOG_ULTIMATE_SEPTIEMBRE.md bloque 8, ampliación "inversión" — depende de IV1):
// "rentabilidad real: TWR y XIRR". canonical-portfolio.js (IV1) solo guardaba una foto fija por
// posición (coste total, valor actual, fecha de valoración) — sin fecha de adquisición ni
// historial de aportaciones, ni XIRR ni TWR eran calculables de verdad. Esta tarea añade
// `acquisitionDate` + `contributions[]` (solo aportaciones, nunca retiradas — una retirada parcial
// cambia el coste según qué lote se vende, FIFO, tarea FC1 aparte) y una XIRR genérica
// (Newton-Raphson vía bisección) que funciona igual con 2 flujos que con 20. La TWR propiamente
// dicha exige valoraciones intermedias que esta app no registra (no hay cotización de mercado);
// con un único movimiento por posición coincide exactamente con la XIRR — no se inventa una
// segunda cifra distinta cuando no hay dato para sostenerla.

test("xirr · dos flujos (aportación + valor final) da la tasa anualizada real, no una aproximación inventada", () => {
  const result = Portfolio.xirr([
    { date: "2024-01-01", amount: -1000 },
    { date: "2025-01-01", amount: 1100 },
  ]);
  assert.equal(result.converged, true);
  // 2024 es bisiesto (366 días): la XIRR real difiere ligeramente del 10% simple, igual que Excel.
  assert.ok(Math.abs(result.ratePct - 9.97) < 0.05, `esperaba ~9.97%, dio ${result.ratePct}`);
});

test("xirr · con más de una aportación, diverge de la rentabilidad simple del periodo", () => {
  const result = Portfolio.xirr([
    { date: "2024-01-01", amount: -1000 },
    { date: "2024-07-01", amount: -1000 },
    { date: "2025-01-01", amount: 2200 },
  ]);
  assert.equal(result.converged, true);
  const simpleReturnPct = ((2200 - 2000) / 2000) * 100;
  assert.notEqual(result.ratePct, simpleReturnPct, "la XIRR con dos aportaciones en fechas distintas no debe coincidir con la rentabilidad simple");
});

test("xirr · con un solo flujo no es calculable — nunca inventa una tasa", () => {
  const result = Portfolio.xirr([{ date: "2024-01-01", amount: -1000 }]);
  assert.equal(result.rate, null);
  assert.equal(result.reason, "insufficient-flows");
});

test("xirr · todos los flujos con el mismo signo no es calculable", () => {
  const result = Portfolio.xirr([
    { date: "2024-01-01", amount: -1000 },
    { date: "2025-01-01", amount: -1100 },
  ]);
  assert.equal(result.rate, null);
  assert.equal(result.reason, "single-direction-flows");
});

test("xirr · aportación y valoración en la misma fecha no es calculable — no hay tiempo que ponderar", () => {
  const result = Portfolio.xirr([
    { date: "2024-01-01", amount: -1000 },
    { date: "2024-01-01", amount: 1000 },
  ]);
  assert.equal(result.rate, null);
  assert.equal(result.reason, "same-date-flows");
});

test("normalizePosition · sin acquisitionDate ni contributions, la XIRR no es calculable (mismo criterio que el resto del contrato)", () => {
  const position = Portfolio.normalizePosition({ label: "Fondo A", type: "fondo", costBasis: 1000, currentValue: 1200, asOf: "2025-01-01" }, 0);
  assert.equal(position.xirr.rate, null);
  assert.equal(position.xirr.reason, "insufficient-flows");
  assert.deepEqual(position.contributions, []);
});

test("normalizePosition · con acquisitionDate, calcula la XIRR de la única aportación", () => {
  const position = Portfolio.normalizePosition({
    label: "Fondo A", type: "fondo", costBasis: 1000, currentValue: 1100,
    asOf: "2025-01-01", acquisitionDate: "2024-01-01",
  }, 0);
  assert.equal(position.xirr.converged, true);
  assert.ok(position.xirr.ratePct > 0);
});

test("normalizePosition · una aportación adicional incrementa costBasis y hace divergir la XIRR de gainLossPct", () => {
  const position = Portfolio.normalizePosition({
    label: "Fondo A", type: "fondo", costBasis: 1000, currentValue: 2200,
    asOf: "2025-01-01", acquisitionDate: "2024-01-01",
    contributions: [{ date: "2024-07-01", amount: 1000 }],
  }, 0);
  assert.equal(position.costBasis, 2000);
  assert.equal(position.gainLossPct, 10);
  assert.equal(position.contributions.length, 1);
  assert.equal(position.xirr.converged, true);
  assert.notEqual(position.xirr.ratePct, position.gainLossPct, "con dos aportaciones en fechas distintas, XIRR y rentabilidad simple no deben coincidir");
});

test("normalizePosition · una retirada (importe negativo) en contributions se descarta, no se resta del coste", () => {
  const position = Portfolio.normalizePosition({
    label: "Fondo A", type: "fondo", costBasis: 1000, currentValue: 1100,
    asOf: "2025-01-01", acquisitionDate: "2024-01-01",
    contributions: [{ date: "2024-07-01", amount: -500 }],
  }, 0);
  assert.equal(position.costBasis, 1000, "una retirada no es una aportación negativa — se ignora, no se fabrica una regla FIFO aquí");
  assert.equal(position.contributions.length, 0);
});

test("summarizePositions · XIRR de toda la cartera agrega los flujos de todas las posiciones, no la media de sus XIRR", () => {
  const result = Portfolio.normalizePositions([
    { label: "Fondo A", type: "fondo", costBasis: 1000, currentValue: 1100, asOf: "2025-01-01", acquisitionDate: "2024-01-01" },
    { label: "Fondo B", type: "fondo", costBasis: 500, currentValue: 600, asOf: "2025-01-01", acquisitionDate: "2024-01-01" },
  ]);
  assert.equal(result.summary.xirr.converged, true);
  assert.notEqual(result.summary.xirr, null);
});

test("summarizePositions · sin ninguna posición con aportación datada, la XIRR de la cartera no es calculable", () => {
  const result = Portfolio.normalizePositions([
    { label: "Fondo A", type: "fondo", costBasis: 1000, currentValue: 1100, asOf: "2025-01-01" },
  ]);
  assert.equal(result.summary.xirr.rate, null);
});

test("applyFundTransfer (FC2) conserva acquisitionDate y contributions — la XIRR no se reinicia con el traspaso", () => {
  const original = Portfolio.normalizePosition({
    id: "p1", label: "Fondo A", type: "fondo", costBasis: 1000, currentValue: 2200,
    asOf: "2025-01-01", acquisitionDate: "2024-01-01",
    contributions: [{ date: "2024-07-01", amount: 1000 }],
  }, 0);
  const transferred = Portfolio.applyFundTransfer(original, { label: "Fondo B", currentValue: 2300 });
  assert.equal(transferred.acquisitionDate, "2024-01-01");
  assert.equal(transferred.contributions.length, 1);
  assert.equal(transferred.costBasis, 2000, "el coste total (inicial + aportación) no cambia por el solo hecho de traspasar");
  assert.equal(transferred.xirr.converged, true);
});

test("applyFundTransfer (FC2) sin contributions previas, sigue conservando costBasis exacto (regresión)", () => {
  const original = Portfolio.normalizePosition({ id: "p1", label: "Fondo A", type: "fondo", quantity: 10, costBasis: 1000, currentValue: 1200, asOf: "2025-01-15", provenance: "declared" }, 0);
  const transferred = Portfolio.applyFundTransfer(original, { label: "Fondo B", currentValue: 1250 });
  assert.equal(transferred.costBasis, 1000);
});
