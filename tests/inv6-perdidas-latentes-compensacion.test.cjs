const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const P = require("../canonical-portfolio.js");

// INV6 (Oleada 3, Bloque 5): VER-3 confirmó que FC3 solo cubre pérdidas ya realizadas por venta
// (fifoLedger). INV6 identifica posiciones con minusvalía todavía no realizada (gainLoss < 0, ya
// calculado por normalizePositions) candidatas a venta antes de cierre fiscal — sin motor de
// cálculo nuevo, solo filtra y ordena, y nunca sugiere ejecutar nada.

function position(id, label, gainLoss, extra = {}) {
  return { id, label, type: "fondo", gainLoss, gainLossPct: 0, currentValue: 1000, costBasis: 1000 - gainLoss, ...extra };
}

test("latentLossHarvestingCandidates · sin posiciones, no hay candidatas", () => {
  const result = P.latentLossHarvestingCandidates([]);
  assert.deepEqual(result.candidates, []);
  assert.equal(result.totalLatentLoss, 0);
});

test("latentLossHarvestingCandidates · descarta posiciones con plusvalía o sin cambio", () => {
  const result = P.latentLossHarvestingCandidates([position("1", "Ganadora", 200), position("2", "Plana", 0)]);
  assert.deepEqual(result.candidates, []);
});

test("latentLossHarvestingCandidates · solo incluye posiciones con minusvalía, ordenadas de mayor a menor pérdida", () => {
  const result = P.latentLossHarvestingCandidates([
    position("1", "Ganadora", 200),
    position("2", "Perdedora leve", -100),
    position("3", "Perdedora fuerte", -500),
  ]);
  assert.deepEqual(result.candidates.map((item) => item.id), ["3", "2"]);
  assert.equal(result.totalLatentLoss, -600);
});

test("latentLossHarvestingCandidates conserva label/type/gainLossPct/currentValue/costBasis por candidata", () => {
  const result = P.latentLossHarvestingCandidates([position("1", "ETF Global", -300, { type: "etf", gainLossPct: -15, currentValue: 1700, costBasis: 2000 })]);
  assert.deepEqual(result.candidates[0], { id: "1", label: "ETF Global", type: "etf", gainLoss: -300, gainLossPct: -15, currentValue: 1700, costBasis: 2000 });
});

test("latentLossHarvestingCandidates está exportada", () => {
  assert.equal(typeof P.latentLossHarvestingCandidates, "function");
});

// --- Wiring ---

const appSource = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const indexSource = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

test("wiring: la tarjeta de INV6 vive en Ajustes › Fiscal, antes de FC3", () => {
  const cardPos = indexSource.indexOf('id="inv6LatentLossCandidates"');
  const fc3Pos = indexSource.indexOf("Compensación de pérdidas y ganancias a cierre de año");
  assert.ok(cardPos >= 0 && cardPos < fc3Pos, "INV6 debe declararse antes de FC3, que la complementa");
});

test("wiring: renderInv6LatentLossCandidates reutiliza normalizePositions y latentLossHarvestingCandidates, sin motor propio", () => {
  const start = appSource.indexOf("function renderInv6LatentLossCandidates(");
  assert.ok(start >= 0, "No existe renderInv6LatentLossCandidates");
  const block = appSource.slice(start, start + 900);
  assert.match(block, /iv1PositionsList\(\)/);
  assert.match(block, /engine\.normalizePositions\(rows\)/);
  assert.match(block, /engine\.latentLossHarvestingCandidates\(result\.positions\)/);
});

test("wiring: renderInv6LatentLossCandidates se llama en renderAjustes junto a renderIv1PositionConcentration", () => {
  assert.match(appSource, /renderIv1PositionConcentration\(\);\s*\n\s*renderInv6LatentLossCandidates\(\);/);
});
