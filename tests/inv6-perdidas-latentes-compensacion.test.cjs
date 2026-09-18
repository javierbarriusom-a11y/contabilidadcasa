const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const P = require("../canonical-portfolio.js");

// INV6 (Oleada 3, Bloque 5): VER-3 confirmó que FC3 solo cubre pérdidas ya realizadas por venta
// (fifoLedger). INV6 identifica posiciones con minusvalía todavía no realizada (gainLoss < 0, ya
// calculado por normalizePositions) candidatas a venta antes de cierre fiscal — sin motor de
// cálculo nuevo, solo filtra y ordena. T4 (retrofit directivo): la interfaz marca la primera
// candidata (mayor pérdida) como la que conviene vender primero.

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

// I1 (Contabilidadcasa 2.0): INV6 y la calculadora de compensación de FC3 se movieron juntas al
// hub Inversión → Fiscal (#inversion-fiscal, ambas son fiscalidad de inversión) — ya no hacen
// falta enlaces cruzados entre pantallas distintas: la tarjeta de INV6 remite a "la calculadora de
// arriba", en la misma pestaña.
test("wiring: la tarjeta de INV6 vive en Inversión › Fiscal, después de la calculadora de compensación de FC3", () => {
  const inversionFiscal = /<section class="e19-deuda-decidir view-section" id="inversion-fiscal">/.exec(indexSource);
  assert.ok(inversionFiscal, "No existe la sección inversion-fiscal");
  const start = inversionFiscal.index + inversionFiscal[0].length;
  const end = indexSource.indexOf("</section>", start);
  const section = indexSource.slice(start, end);
  assert.match(section, /id="inv6LatentLossCandidates"/, "INV6 debe vivir en Inversión › Fiscal");
  assert.match(section, /calculadora de arriba/, "debe remitir a la calculadora de compensación en la misma pestaña");
  const fc3Idx = section.indexOf("Compensación de pérdidas y ganancias a cierre de año");
  const inv6Idx = section.indexOf("Pérdidas latentes candidatas a compensación");
  assert.ok(fc3Idx >= 0 && inv6Idx > fc3Idx, "FC3 (compensación) debe ir antes de INV6 en la misma pestaña");
});

test("T4: renderInv6LatentLossCandidates marca la primera candidata como la que conviene vender primero", () => {
  const start = appSource.indexOf("function renderInv6LatentLossCandidates(");
  assert.ok(start >= 0, "No existe renderInv6LatentLossCandidates");
  const block = appSource.slice(start, appSource.indexOf("\n}", start));
  assert.match(block, /Vende esta primero/);
});

test("wiring: renderInv6LatentLossCandidates reutiliza normalizePositions y latentLossHarvestingCandidates, sin motor propio", () => {
  const start = appSource.indexOf("function renderInv6LatentLossCandidates(");
  assert.ok(start >= 0, "No existe renderInv6LatentLossCandidates");
  const block = appSource.slice(start, start + 900);
  assert.match(block, /iv1PositionsList\(\)/);
  assert.match(block, /engine\.normalizePositions\(rows\)/);
  assert.match(block, /engine\.latentLossHarvestingCandidates\(result\.positions\)/);
});

// I1 (Contabilidadcasa 2.0): renderInv6LatentLossCandidates() se movió de renderAjustes() a
// renderInversionFiscal() (views/inversion.js), junto a renderInv18GoalOptions (ambas de
// fiscalidad de inversión), no junto a renderIv1PositionConcentration (que ahora es de Cartera).
test("wiring: renderInv6LatentLossCandidates se llama en renderInversionFiscal junto a renderInv18GoalOptions", () => {
  const inversionSource = fs.readFileSync(path.join(__dirname, "..", "views", "inversion.js"), "utf8");
  assert.match(inversionSource, /renderInv18GoalOptions\(\);\s*\n\s*renderInv6LatentLossCandidates\(\);/);
});
