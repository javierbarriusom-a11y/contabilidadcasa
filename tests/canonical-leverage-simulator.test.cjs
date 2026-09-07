const test = require("node:test");
const assert = require("node:assert/strict");
const LeverageSimulator = require("../canonical-leverage-simulator.js");

// LEV4 (Oleada 3, Bloque 3) · comparador de líneas Lombard entre entidades. APX2 calcula la
// capacidad de UNA oferta declarada; este motor compara varias sobre la misma cartera real, sin
// inventar ninguna condición "típica" — solo las que el hogar ha declarado de cada entidad.

test("compareLombardOffers · sin cartera o sin ofertas, no calculable", () => {
  assert.deepEqual(LeverageSimulator.compareLombardOffers({ offers: [], portfolioValue: 100000 }), {
    schemaId: LeverageSimulator.LOMBARD_COMPARISON_SCHEMA_ID, calculable: false, rows: [],
  });
  assert.deepEqual(LeverageSimulator.compareLombardOffers({ offers: [{ entity: "A" }], portfolioValue: 0 }), {
    schemaId: LeverageSimulator.LOMBARD_COMPARISON_SCHEMA_ID, calculable: false, rows: [],
  });
});

test("compareLombardOffers · ordena por coste del primer año, más barata primero", () => {
  const result = LeverageSimulator.compareLombardOffers({
    portfolioValue: 100000,
    offers: [
      { id: "a", entity: "Banco A", maxLtvPct: 50, annualRatePct: 4, openingFeePct: 1, maintenanceLtvPct: 70 },
      { id: "b", entity: "Banco B", maxLtvPct: 50, annualRatePct: 3, openingFeePct: 0.5, maintenanceLtvPct: 65 },
    ],
  });
  assert.equal(result.calculable, true);
  assert.equal(result.rows[0].id, "b");
  assert.equal(result.cheapestId, "b");
  // Banco B: capacidad 50000, coste anual 1500, apertura 250 -> 1750
  assert.equal(result.rows[0].capacity, 50000);
  assert.equal(result.rows[0].firstYearCost, 1750);
  assert.equal(result.rows[0].safetyMarginPts, 15);
  // Banco A: capacidad 50000, coste anual 2000, apertura 500 -> 2500
  assert.equal(result.rows[1].firstYearCost, 2500);
  assert.equal(result.rows[1].safetyMarginPts, 20);
});

test("compareLombardOffers · sin LTV de mantenimiento declarado, el margen de seguridad es null, no cero", () => {
  const result = LeverageSimulator.compareLombardOffers({
    portfolioValue: 100000,
    offers: [
      { id: "a", entity: "Banco A", maxLtvPct: 50, annualRatePct: 4 },
      { id: "b", entity: "Banco B", maxLtvPct: 50, annualRatePct: 3 },
    ],
  });
  assert.equal(result.rows.find((row) => row.id === "a").safetyMarginPts, null);
});
