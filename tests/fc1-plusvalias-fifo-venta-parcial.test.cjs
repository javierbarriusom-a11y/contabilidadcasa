const test = require("node:test");
const assert = require("node:assert/strict");

const Portfolio = require("../canonical-portfolio.js");

// FC1 (BACKLOG_ULTIMATE_SEPTIEMBRE.md bloque 8, ampliación "fiscalidad de cartera" — depende de
// IV1/IV2): "plusvalías por FIFO en cada venta parcial". Antes de esto, canonical-portfolio.js no
// tenía ningún concepto de "lote" (unidades compradas en una fecha concreta) ni de venta parcial —
// solo un coste y unas unidades agregados. FC1 añade unidades opcionales a cada aportación (IV2) y
// un nuevo evento "venta parcial" (disposal); fifoLedger() consume los lotes más antiguos primero,
// en orden cronológico estricto (una venta nunca consume un lote fechado después de ella), y deja
// `realizedGain: null` — nunca una cifra inventada — cuando las unidades disponibles a esa fecha no
// cubren la venta.

test("fifoLedger · una venta que cabe en el primer lote consume solo ese lote", () => {
  const ledger = Portfolio.fifoLedger({
    acquisitionDate: "2024-01-01", initialCost: 1000, initialQuantity: 10,
    contributions: [], disposals: [{ id: "d1", date: "2024-06-01", quantitySold: 4, saleProceeds: 500 }],
  });
  assert.equal(ledger.disposals[0].consumedCost, 400);
  assert.equal(ledger.disposals[0].realizedGain, 100);
  assert.equal(ledger.disposals[0].shortfall, 0);
  assert.equal(ledger.remainingQuantity, 6);
  assert.equal(ledger.remainingCost, 600);
});

test("fifoLedger · una venta que cruza dos lotes consume el más antiguo primero (FIFO real)", () => {
  const ledger = Portfolio.fifoLedger({
    acquisitionDate: "2024-01-01", initialCost: 1000, initialQuantity: 10, // 100€/unidad
    contributions: [{ id: "c1", date: "2024-06-01", amount: 1200, quantity: 10 }], // 120€/unidad
    disposals: [{ id: "d1", date: "2025-01-01", quantitySold: 15, saleProceeds: 1800 }],
  });
  assert.equal(ledger.disposals[0].consumedCost, 1600, "10×100 + 5×120 = 1600");
  assert.equal(ledger.disposals[0].realizedGain, 200);
  assert.equal(ledger.remainingQuantity, 5);
  assert.equal(ledger.remainingCost, 600, "quedan 5 unidades del segundo lote, a 120€/unidad");
});

test("fifoLedger · una venta fechada antes de un lote posterior no puede consumirlo", () => {
  const ledger = Portfolio.fifoLedger({
    acquisitionDate: "2024-01-01", initialCost: 1000, initialQuantity: 10,
    contributions: [{ id: "c1", date: "2024-12-01", amount: 1000, quantity: 10 }],
    disposals: [{ id: "d1", date: "2024-06-01", quantitySold: 5, saleProceeds: 600 }],
  });
  assert.equal(ledger.disposals[0].consumedCost, 500, "solo puede tocar el primer lote, el segundo es posterior a la venta");
  assert.equal(ledger.disposals[0].realizedGain, 100);
  assert.equal(ledger.remainingQuantity, 15, "5 del primer lote + 10 del segundo, intacto");
});

test("fifoLedger · vender más de lo disponible a esa fecha marca shortfall y no inventa una plusvalía", () => {
  const ledger = Portfolio.fifoLedger({
    acquisitionDate: "2024-01-01", initialCost: 1000, initialQuantity: 10,
    contributions: [], disposals: [{ id: "d1", date: "2025-01-01", quantitySold: 15, saleProceeds: 1800 }],
  });
  assert.equal(ledger.disposals[0].shortfall, 5);
  assert.equal(ledger.disposals[0].realizedGain, null);
});

test("fifoLedger · varias ventas consecutivas consumen lotes en orden acumulado", () => {
  const ledger = Portfolio.fifoLedger({
    acquisitionDate: "2024-01-01", initialCost: 1000, initialQuantity: 10,
    contributions: [{ id: "c1", date: "2024-06-01", amount: 1000, quantity: 10 }],
    disposals: [
      { id: "d1", date: "2024-09-01", quantitySold: 8, saleProceeds: 900 },
      { id: "d2", date: "2025-01-01", quantitySold: 8, saleProceeds: 1000 },
    ],
  });
  assert.equal(ledger.disposals[0].consumedCost, 800, "8×100 del primer lote");
  assert.equal(ledger.disposals[1].consumedCost, 800, "2 restantes del primer lote (200) + 6 del segundo (600)");
  assert.equal(ledger.remainingQuantity, 4);
});

test("fifoLedger · sin lotes con unidades declaradas, cualquier venta queda sin cubrir", () => {
  const ledger = Portfolio.fifoLedger({
    acquisitionDate: "", initialCost: 0, initialQuantity: 0,
    contributions: [{ id: "c1", date: "2024-06-01", amount: 500, quantity: 0 }], // sin unidades: no es un lote
    disposals: [{ id: "d1", date: "2025-01-01", quantitySold: 1, saleProceeds: 100 }],
  });
  assert.equal(ledger.lots.length, 0);
  assert.equal(ledger.disposals[0].shortfall, 1);
  assert.equal(ledger.disposals[0].realizedGain, null);
});

test("normalizePosition · sin ventas, se comporta exactamente como antes de FC1 (retrocompatible)", () => {
  const position = Portfolio.normalizePosition({ label: "Fondo A", type: "fondo", quantity: 10, costBasis: 1000, currentValue: 1200, provenance: "declared" }, 0);
  assert.equal(position.quantity, 10);
  assert.equal(position.costBasis, 1000);
  assert.equal(position.gainLoss, 200);
  assert.deepEqual(position.disposals, []);
  assert.equal(position.realizedGain, null, "sin ventas, no hay plusvalía realizada que sumar (no es cero, es inexistente)");
});

test("normalizePosition · con una venta parcial, quantity y costBasis reflejan solo lo que queda", () => {
  const position = Portfolio.normalizePosition({
    label: "Fondo A", type: "fondo", quantity: 10, costBasis: 1000, currentValue: 900,
    acquisitionDate: "2024-01-01", asOf: "2025-06-01",
    disposals: [{ date: "2025-01-01", quantitySold: 4, saleProceeds: 500 }],
  }, 0);
  assert.equal(position.quantity, 6);
  assert.equal(position.costBasis, 600);
  assert.equal(position.realizedGain, 100);
  assert.equal(position.gainLoss, 300, "900 (valor de lo que queda) - 600 (coste de lo que queda) = 300, no realizado");
});

test("normalizePosition · una aportación sin unidades sigue sumando al coste aunque no entre en el FIFO", () => {
  const position = Portfolio.normalizePosition({
    label: "Fondo A", type: "fondo", quantity: 10, costBasis: 1000, currentValue: 1600,
    acquisitionDate: "2024-01-01", asOf: "2025-06-01",
    contributions: [{ date: "2024-06-01", amount: 500 }], // sin quantity
    disposals: [{ date: "2025-01-01", quantitySold: 5, saleProceeds: 700 }],
  }, 0);
  assert.equal(position.disposals[0].consumedCost, 500, "5×100 del único lote con unidades (el inicial)");
  assert.equal(position.disposals[0].realizedGain, 200);
  assert.equal(position.costBasis, 1000, "500 del lote inicial restante + 500 de la aportación sin unidades, nunca tocada por el FIFO");
});

test("summarizePositions · totalRealizedGain agrega las ventas de todas las posiciones", () => {
  const result = Portfolio.normalizePositions([
    { label: "A", type: "fondo", quantity: 10, costBasis: 1000, currentValue: 900, acquisitionDate: "2024-01-01", asOf: "2025-06-01", disposals: [{ date: "2025-01-01", quantitySold: 4, saleProceeds: 500 }] },
    { label: "B", type: "fondo", quantity: 5, costBasis: 500, currentValue: 500, acquisitionDate: "2024-01-01", asOf: "2025-06-01", disposals: [{ date: "2025-01-01", quantitySold: 2, saleProceeds: 300 }] },
  ]);
  assert.equal(result.summary.totalRealizedGain, 200, "100 (A) + 100 (B, 300 - 2×100)");
});

test("summarizePositions · una sola posición con shortfall hace que el total sea no calculable, no una suma parcial", () => {
  const result = Portfolio.normalizePositions([
    { label: "A", type: "fondo", quantity: 10, costBasis: 1000, currentValue: 900, acquisitionDate: "2024-01-01", asOf: "2025-06-01", disposals: [{ date: "2025-01-01", quantitySold: 4, saleProceeds: 500 }] },
    { label: "B", type: "fondo", quantity: 5, costBasis: 500, currentValue: 500, acquisitionDate: "2024-01-01", asOf: "2025-06-01", disposals: [{ date: "2025-01-01", quantitySold: 20, saleProceeds: 300 }] },
  ]);
  assert.equal(result.summary.totalRealizedGain, null);
});

test("applyFundTransfer (FC2) conserva disposals e initialCost/initialQuantity — la venta no se reinicia con el traspaso", () => {
  const original = Portfolio.normalizePosition({
    id: "p1", label: "Fondo A", type: "fondo", quantity: 10, costBasis: 1000, currentValue: 900,
    acquisitionDate: "2024-01-01", asOf: "2025-06-01",
    disposals: [{ date: "2025-01-01", quantitySold: 4, saleProceeds: 500 }],
  }, 0);
  const transferred = Portfolio.applyFundTransfer(original, { label: "Fondo B", currentValue: 950 });
  assert.equal(transferred.disposals.length, 1);
  assert.equal(transferred.quantity, 6);
  assert.equal(transferred.costBasis, 600);
  assert.equal(transferred.realizedGain, 100);
});

test("applyFundTransfer (FC2) con una cantidad nueva declarada, limpia las unidades de las aportaciones (denominación distinta)", () => {
  const original = Portfolio.normalizePosition({
    id: "p1", label: "Fondo A", type: "fondo", quantity: 10, costBasis: 1000, currentValue: 1500,
    acquisitionDate: "2024-01-01", asOf: "2025-06-01",
    contributions: [{ date: "2024-06-01", amount: 500, quantity: 5 }],
  }, 0);
  const transferred = Portfolio.applyFundTransfer(original, { label: "Fondo B", currentValue: 1500, quantity: 99 });
  assert.equal(transferred.quantity, 99);
  assert.equal(transferred.contributions[0].quantity, 0, "las unidades del fondo de origen no valen en la nueva denominación");
  assert.equal(transferred.contributions[0].amount, 500, "el coste en euros sigue contando para la XIRR");
});
