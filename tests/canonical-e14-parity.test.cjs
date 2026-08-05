const test = require("node:test");
const assert = require("node:assert/strict");
const Parity = require("../canonical-e14-parity.js");
const Legacy = require("../legacy-debt-roadmap-engine.js");

const base = {
  months: 24,
  capacity: 900,
  liquidity: 8000,
  preserveCash: 2500,
  baseMonth: "2026-08",
  accounts: [
    { amount: 6000, strategy: "settlement", discount: 50, start: 1, lump: 3000, apr: 0, term: 1, financePct: 100 },
    { amount: 3500, strategy: "refi", discount: 0, start: 3, lump: 200, apr: 6, term: 12, financePct: 100 },
  ],
};

test("el adaptador reproduce pagos mensuales, coste, pico y duración del plan heredado", () => {
  const result = Parity.compare(base);
  assert.equal(result.valid, true, result.differences.join("\n"));
  assert.equal(result.legacy.totalPaid, result.canonical.totalCost);
  assert.equal(result.legacy.peak, result.canonical.peakPayment);
});

test("la refinanciación híbrida conserva el pago inicial y la cuota del plan heredado", () => {
  const result = Parity.compare({ ...base, accounts: [{ amount: 5000, strategy: "hybrid", discount: 20, start: 2, lump: 500, apr: 8, term: 10, financePct: 100 }] });
  assert.equal(result.valid, true, result.differences.join("\n"));
});

test("el motor heredado extraído sigue siendo puro y no modifica la entrada", () => {
  const input = JSON.parse(JSON.stringify(base));
  const before = JSON.stringify(input);
  Legacy.simulate(input);
  assert.equal(JSON.stringify(input), before);
});
