const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const Portfolio = require("../canonical-portfolio.js");

// INV11 (Oleada 4, Bloque 4): tratar el plan de pensiones como una posición de cartera más.
// canonical-pension-simulator.js (A15-4) ya simulaba el ahorro fiscal de UNA aportación, pero el
// plan en sí nunca era una posición de canonical-portfolio.js — así que ninguna función ya
// construida y probada para el resto de la cartera (XIRR real de IV2, rebalanceo por tipo de IV6,
// escalera de liquidez de INV7, glide path de IVX6) llegaba nunca a verlo, solo el saldo estático
// y aislado de A14. Todas esas funciones ya son genéricas sobre POSITION_TYPES/ASSET_CLASS_TYPES:
// el único cambio real es añadir "plan-pension" como tipo de instrumento propio (nunca "otro") y
// darle su propio tramo de liquidez, porque a diferencia de "sin clasificar" (velocidad
// desconocida) de un plan de pensiones SÍ se sabe la velocidad: cero, salvo jubilación o un
// supuesto tasado. No se toca A15-4 (sigue simulando la decisión de aportar, no un ledger) ni el
// saldo "Pensión" de A14 (sigue siendo una foto de patrimonio aparte, mismo criterio ya aceptado
// hoy para "Inversión").

const appSource = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const indexSource = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

test("POSITION_TYPES incluye plan-pension como tipo de instrumento propio", () => {
  assert.ok(Portfolio.POSITION_TYPES.includes("plan-pension"));
});

test("normalizePosition · un plan de pensiones conserva su tipo, nunca cae en «otro»", () => {
  const position = Portfolio.normalizePosition({ type: "plan-pension", label: "Plan Indexado Renta Variable", currentValue: 20000 });
  assert.equal(position.type, "plan-pension");
});

test("normalizePosition · un plan de pensiones con acquisitionDate/currentValue calcula XIRR real, igual que cualquier otra posición", () => {
  const position = Portfolio.normalizePosition({
    type: "plan-pension",
    label: "Plan Indexado",
    acquisitionDate: "2020-01-01",
    costBasis: 10000,
    currentValue: 14000,
    asOf: "2025-01-01",
  });
  assert.equal(position.xirr.converged, true);
  assert.ok(Number.isFinite(position.xirr.ratePct));
});

test("normalizePosition · con varias aportaciones periódicas, la XIRR del plan de pensiones sigue siendo calculable", () => {
  const position = Portfolio.normalizePosition({
    type: "plan-pension",
    label: "Plan Indexado",
    acquisitionDate: "2018-01-01",
    costBasis: 1500,
    currentValue: 12000,
    asOf: "2025-01-01",
    contributions: [
      { date: "2019-01-01", amount: 1500 },
      { date: "2020-01-01", amount: 1500 },
      { date: "2021-01-01", amount: 1500 },
      { date: "2022-01-01", amount: 1500 },
    ],
  });
  assert.equal(position.xirr.converged, true);
});

test("rebalanceSuggestions · plan-pension entra en el rebalanceo igual que cualquier otro tipo, con su propio objetivo declarado", () => {
  const suggestions = Portfolio.rebalanceSuggestions(
    { fondo: 7000, "plan-pension": 3000 },
    10000,
    { fondo: 50, "plan-pension": 50 },
  );
  const pension = suggestions.find((row) => row.type === "plan-pension");
  assert.ok(pension, "esperaba una fila de rebalanceo para plan-pension");
  assert.equal(pension.currentPct, 30);
  assert.equal(pension.action, "comprar");
  assert.equal(pension.amount, 2000);
});

test("liquidityLadder · un plan de pensiones se clasifica en el tramo «bloqueada», distinto de «sin-clasificar»", () => {
  const ladder = Portfolio.liquidityLadder([{ type: "plan-pension", currentValue: 15000 }], 0);
  const bloqueada = ladder.tiers.find((tier) => tier.tier === "bloqueada");
  const sinClasificar = ladder.tiers.find((tier) => tier.tier === "sin-clasificar");
  assert.equal(bloqueada.value, 15000);
  assert.equal(sinClasificar.value, 0);
});

test("liquidityLadder · el tramo «bloqueada» nunca cuenta para cubrir el colchón, aunque por sí solo baste en importe", () => {
  const ladder = Portfolio.liquidityLadder([{ type: "plan-pension", currentValue: 50000 }], 5000);
  assert.equal(ladder.floorCovered, false);
  assert.equal(ladder.floorCoveredBy, null);
});

test("liquidityLadder · con liquidez inmediata suficiente además del plan de pensiones, el colchón se cubre por la parte líquida, no por la pensión", () => {
  const ladder = Portfolio.liquidityLadder(
    [
      { type: "plan-pension", currentValue: 50000 },
      { type: "accion", currentValue: 6000 },
    ],
    5000,
  );
  assert.equal(ladder.floorCovered, true);
  assert.equal(ladder.floorCoveredBy, "inmediata");
});

test("normalizePosition · liquidityTierOverride declarado sigue disponible para un plan de pensiones ya en fase de rescate", () => {
  const position = Portfolio.normalizePosition({ type: "plan-pension", label: "Plan en rescate", currentValue: 8000, liquidityTierOverride: "inmediata" });
  const ladder = Portfolio.liquidityLadder([position], 0);
  const inmediata = ladder.tiers.find((tier) => tier.tier === "inmediata");
  const bloqueada = ladder.tiers.find((tier) => tier.tier === "bloqueada");
  assert.equal(inmediata.value, 8000);
  assert.equal(inmediata.overriddenValue, 8000);
  assert.equal(bloqueada.value, 0);
});

test("glidePathForGoal · un plan de pensiones ligado a un objetivo (p. ej. Jubilación) entra en el glide path igual que cualquier posición", () => {
  const positions = [
    Portfolio.normalizePosition({ id: "pension-1", type: "plan-pension", label: "Plan Indexado", currentValue: 30000 }),
    Portfolio.normalizePosition({ id: "fondo-1", type: "fondo", label: "Fondo Global", currentValue: 10000 }),
  ];
  const result = Portfolio.glidePathForGoal({
    goalId: "jubilacion",
    goalName: "Jubilación",
    targetDate: "2045-01-01",
    positions,
    fundingPositionIds: ["pension-1", "fondo-1"],
  });
  assert.equal(result.calculable, true);
  assert.equal(result.totalValue, 40000);
  const pensionRow = result.positions.find((row) => row.id === "pension-1");
  assert.ok(pensionRow, "esperaba que el plan de pensiones apareciera en el glide path del objetivo");
  assert.equal(pensionRow.pct, 75);
});

test("assetClassVsGlidePath · la clase de activo declarada del plan de pensiones cuenta en la lectura creciente/defensivo del objetivo", () => {
  // assetClass y goalId viven en el registro RAW de la posición (mismo patrón que el resto de la
  // cartera, ver comentario de INV1 en canonical-portfolio.js) — assetClassVsGlidePath/
  // glidePathForGoal se llaman con la lista cruda (iv1PositionsList()), nunca con el resultado de
  // normalizePosition(), que no expone esos campos en su contrato fijo.
  const positions = [
    { id: "pension-1", type: "plan-pension", assetClass: "renta-variable", currentValue: 30000, goalId: "jubilacion" },
  ];
  const result = Portfolio.assetClassVsGlidePath({ goalId: "jubilacion", positions, fundingPositionIds: ["pension-1"] }, "growth");
  assert.equal(result.calculable, true);
  assert.equal(result.growthPct, 100);
});

test("index.html: el selector de tipo de posición de cartera incluye «Plan de pensiones»", () => {
  assert.match(indexSource, /<option value="plan-pension">Plan de pensiones<\/option>/);
});

test("index.html: el objetivo de reparto de IV6 tiene un campo propio para plan de pensiones", () => {
  assert.match(indexSource, /id="iv6TargetPlanPension"/);
});

test("app.js: IV1_POSITION_TYPE_LABELS y IV6_TARGET_FIELDS declaran plan-pension", () => {
  assert.match(appSource, /IV1_POSITION_TYPE_LABELS = \{[^}]*"plan-pension": "Plan de pensiones"/);
  assert.match(appSource, /IV6_TARGET_FIELDS = \{[^}]*"plan-pension": "iv6TargetPlanPension"/);
});
