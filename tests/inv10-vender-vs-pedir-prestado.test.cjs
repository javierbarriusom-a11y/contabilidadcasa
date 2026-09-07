const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const Leverage = require(path.join(root, "canonical-leverage-simulator.js"));
const appSource = fs.readFileSync(path.join(root, "app.js"), "utf8");
const indexSource = fs.readFileSync(path.join(root, "index.html"), "utf8");

// INV10 (Oleada 3, Bloque 4): comparador genérico "vender activo vs. pedir prestado contra él".
// Decisión del hogar (sesión 159): genérico para cualquier meta, no acotado a una sola. Compone
// opportunityCost (IV5) + lombardCreditCapacity (APX2) + coste fiscal de liquidar (plusvalía
// proporcional al tipo del ahorro de FC4) — sin motor nuevo aparte del propio comparador.

test("sellVsBorrowComparison · sin importe, horizonte o rentabilidad de la cartera, no calculable", () => {
  assert.equal(Leverage.sellVsBorrowComparison({}).calculable, false);
  assert.equal(Leverage.sellVsBorrowComparison({ amount: 10000, months: 12 }).calculable, false);
  assert.equal(Leverage.sellVsBorrowComparison({ amount: 10000, months: 12, investmentResult: { calculable: false } }).calculable, false);
});

test("sellVsBorrowComparison · sin capacidad Lombard suficiente, solo calcula el coste de vender", () => {
  const result = Leverage.sellVsBorrowComparison({
    amount: 20000,
    months: 24,
    gainLossPct: 50,
    savingsTaxRatePct: 20,
    investmentResult: { calculable: true, gain: 1000 },
    lombardCapacity: { calculable: true, capacity: 10000, annualRatePct: 5 },
  });
  assert.equal(result.calculable, true);
  assert.equal(result.borrowFeasible, false);
  assert.ok(result.sellTotalCost > 0);
  assert.equal(result.borrowTotalCost, undefined);
});

test("sellVsBorrowComparison · sin capacidad Lombard calculable en absoluto, tampoco es factible pedir prestado", () => {
  const result = Leverage.sellVsBorrowComparison({
    amount: 5000,
    months: 12,
    investmentResult: { calculable: true, gain: 100 },
    lombardCapacity: { calculable: false },
  });
  assert.equal(result.borrowFeasible, false);
});

test("sellVsBorrowComparison · calcula la plusvalía proporcional al importe retirado, no toda la plusvalía de la posición", () => {
  // costBasis=100, value=150 → gainLossPct=50%. Retirar 15000€ de caja de una posición con esa
  // proporción realiza 15000*(50/150)=5000€ de plusvalía, no los 50 puntos completos como cifra.
  const result = Leverage.sellVsBorrowComparison({
    amount: 15000,
    months: 12,
    gainLossPct: 50,
    savingsTaxRatePct: 20,
    investmentResult: { calculable: true, gain: 500 },
    lombardCapacity: { calculable: true, capacity: 50000, annualRatePct: 4 },
  });
  assert.equal(result.sellTaxCost, 1000); // 5000 * 20%
});

test("sellVsBorrowComparison · sin plusvalía declarada (posición en pérdidas o sin dato), coste fiscal 0", () => {
  const result = Leverage.sellVsBorrowComparison({
    amount: 10000,
    months: 12,
    savingsTaxRatePct: 20,
    investmentResult: { calculable: true, gain: 300 },
    lombardCapacity: { calculable: true, capacity: 50000, annualRatePct: 4 },
  });
  assert.equal(result.sellTaxCost, 0);
});

test("sellVsBorrowComparison · el coste de vender es plusvalía + crecimiento perdido; el de pedir prestado es solo el interés", () => {
  const result = Leverage.sellVsBorrowComparison({
    amount: 10000,
    months: 24,
    gainLossPct: 0,
    savingsTaxRatePct: 20,
    investmentResult: { calculable: true, gain: 800 },
    lombardCapacity: { calculable: true, capacity: 50000, annualRatePct: 5 },
  });
  assert.equal(result.sellTaxCost, 0);
  assert.equal(result.sellForegoneGrowth, 800);
  assert.equal(result.sellTotalCost, 800);
  // interés: 10000 * 5% * 2 años = 1000
  assert.equal(result.borrowTotalCost, 1000);
  assert.equal(result.cheaper, "sell");
  assert.equal(result.difference, 200);
});

test("sellVsBorrowComparison · pedir prestado sale más barato cuando el interés es bajo frente al coste fiscal + crecimiento perdido", () => {
  const result = Leverage.sellVsBorrowComparison({
    amount: 10000,
    months: 12,
    gainLossPct: 100,
    savingsTaxRatePct: 25,
    investmentResult: { calculable: true, gain: 700 },
    lombardCapacity: { calculable: true, capacity: 50000, annualRatePct: 2 },
  });
  // plusvalía proporcional: 10000*(100/200)=5000; coste fiscal = 5000*25%=1250; +700 crecimiento = 1950
  assert.equal(result.sellTotalCost, 1950);
  // interés: 10000*2%*1 = 200
  assert.equal(result.borrowTotalCost, 200);
  assert.equal(result.cheaper, "borrow");
});

test("sellVsBorrowComparison está exportado", () => {
  assert.equal(typeof Leverage.sellVsBorrowComparison, "function");
});

// --- Wiring ---

test("wiring: la tarjeta de INV10 vive en index.html", () => {
  ["inv10Amount", "inv10Months", "inv10GainLossPct", "inv10Run", "inv10Note"].forEach((id) => {
    assert.match(indexSource, new RegExp(`id="${id}"`), `Falta #${id} en index.html`);
  });
});

test("wiring: handleInv10Compare compone opportunityCost (IV5), lombardCreditCapacity (APX2) y sellVsBorrowComparison", () => {
  const start = appSource.indexOf("function handleInv10Compare(");
  assert.ok(start >= 0, "No existe handleInv10Compare");
  const block = appSource.slice(start, start + 1600);
  assert.match(block, /portfolioEngine\.opportunityCost\(/);
  assert.match(block, /leverageEngine\.lombardCreditCapacity\(/);
  assert.match(block, /leverageEngine\.sellVsBorrowComparison\(/);
});

test("wiring: el botón de INV10 está cableado", () => {
  assert.match(appSource, /qs\("inv10Run"\)\?\.addEventListener\("click", handleInv10Compare\);/);
});
