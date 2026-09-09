const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const P = require("../canonical-portfolio.js");

// INV7 (Oleada 3, Bloque 5): escalera de liquidez de la cartera — a cuántos días puede convertirse
// cada posición en caja sin penalización severa, cruzado con el colchón. Distinto de LPX2 (runway
// de patrimonio neto total): aquí importa la velocidad de conversión, no el valor total. "Otro"
// nunca se clasifica con una velocidad inventada — queda fuera de la escalera como "sin clasificar".

function position(type, currentValue) {
  return { type, currentValue };
}

test("liquidityLadder · sin posiciones, todos los tramos en 0 y colchón no cubierto", () => {
  const result = P.liquidityLadder([], 1000);
  assert.ok(result.tiers.every((tier) => tier.value === 0));
  assert.equal(result.floorCovered, false);
  assert.equal(result.floorCoveredBy, null);
});

test("liquidityLadder · acción/ETF/cripto son inmediatas, fondo es corta, otro queda sin clasificar", () => {
  const result = P.liquidityLadder([position("accion", 100), position("etf", 200), position("cripto", 50), position("fondo", 300), position("otro", 400)], 0);
  const byTier = Object.fromEntries(result.tiers.map((tier) => [tier.tier, tier.value]));
  assert.equal(byTier.inmediata, 350);
  assert.equal(byTier.corta, 300);
  assert.equal(byTier["sin-clasificar"], 400);
});

test("liquidityLadder · el colchón se cubre con la liquidez inmediata cuando basta por sí sola", () => {
  const result = P.liquidityLadder([position("accion", 1000), position("fondo", 500)], 800);
  assert.equal(result.floorCoveredBy, "inmediata");
  assert.equal(result.floorCovered, true);
});

test("liquidityLadder · el colchón necesita sumar la liquidez corta si la inmediata no basta sola", () => {
  const result = P.liquidityLadder([position("accion", 500), position("fondo", 500)], 800);
  assert.equal(result.floorCoveredBy, "corta");
});

test("liquidityLadder · «sin clasificar» nunca cuenta para cubrir el colchón, aunque sea suficiente por sí sola", () => {
  const result = P.liquidityLadder([position("accion", 100), position("otro", 10000)], 800);
  assert.equal(result.floorCovered, false);
  assert.equal(result.floorCoveredBy, null);
});

test("liquidityLadder está exportada", () => {
  assert.equal(typeof P.liquidityLadder, "function");
});

// --- Wiring ---

const appSource = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const indexSource = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

test("wiring: la tarjeta de INV7 vive dentro de la tarjeta de análisis de cartera (Ajustes › Patrimonio e inversión)", () => {
  const cardStart = indexSource.indexOf("Cartera de inversión: análisis y comparativa");
  const ladderPos = indexSource.indexOf('id="inv7LiquidityLadder"');
  assert.ok(cardStart >= 0 && ladderPos > cardStart, "INV7 debe vivir dentro de la tarjeta de análisis de cartera");
});

test("wiring: renderInv7LiquidityLadder cruza normalizePositions/liquidityLadder con el mismo cushionFloor que DLX1/AP6", () => {
  const start = appSource.indexOf("function renderInv7LiquidityLadder(");
  assert.ok(start >= 0, "No existe renderInv7LiquidityLadder");
  const block = appSource.slice(start, start + 900);
  assert.match(block, /engine\.normalizePositions\(rows\)/);
  assert.match(block, /cushionEngine\.cushionFloor\(lastSimulation, cuadroMandosReserve\(\)\)\.value/);
  assert.match(block, /engine\.liquidityLadder\(result\.positions, floor\)/);
});

test("wiring: renderInv7LiquidityLadder se llama en renderAjustes junto a renderInv6LatentLossCandidates", () => {
  assert.match(appSource, /renderInv6LatentLossCandidates\(\);\s*\n\s*renderInv7LiquidityLadder\(\);/);
});
