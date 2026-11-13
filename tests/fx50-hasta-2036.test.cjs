// FX-50 · «Hasta 2036», legible (canonical-long-horizon.js). Cifras INVENTADAS.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const L = require("../canonical-long-horizon.js");

const filas = () => {
  const rows = [];
  for (let y = 2026; y <= 2029; y += 1) for (let m = 1; m <= 12; m += 1) for (const d of [1, 15, 28]) rows.push({ date: `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`, total: 10000 + (y - 2026) * 3000 + m * 100 + d });
  return rows;
};

test("FX-50 · un punto por año (el último día con datos de cada diciembre) y uno por mes, desde hoy", () => {
  const anos = L.yearEnds(filas(), "2026-11-12");
  assert.equal(JSON.stringify(anos.map((p) => p.date)), JSON.stringify(["2026-12-28", "2027-12-28", "2028-12-28", "2029-12-28"]));
  assert.equal(anos[1].total, 10000 + 3000 + 1200 + 28);
  const meses = L.monthEnds(filas(), "2026-11-12");
  assert.equal(meses[0].monthKey, "2026-11");
  assert.equal(meses.length, 2 + 36);
});

test("FX-50 · el abanico combina los supuestos como errores independientes y se abre con los años", () => {
  const puntos = [{ monthKey: "2027-12", total: 20000 }, { monthKey: "2030-12", total: 30000 }];
  const impactos = [
    { id: "annualInflation", effects: [{ monthKey: "2027-12", diff: -300 }, { monthKey: "2030-12", diff: -3000 }] },
    { id: "annualIncomeGrowth", effects: [{ monthKey: "2027-12", diff: -400 }, { monthKey: "2030-12", diff: -4000 }] },
    { id: "expenseFactor", effects: [{ monthKey: "2027-12", diff: null }] },
  ];
  const [a, b] = L.fan(puntos, impactos);
  assert.equal(a.spread, 500); // √(300² + 400²)
  assert.equal(a.low, 19500);
  assert.equal(a.high, 20500);
  assert.equal(b.spread, 5000);
  assert.ok(b.spread > a.spread, "más lejos, más abierto");
  assert.equal(a.shocks, 2, "un supuesto sin cifra no cuenta");
});

test("FX-50 · los hitos: deuda cero, fin de la hipoteca y colchón completo, en orden; lo que ya se cumple no es un hito y lo que no llega se dice", () => {
  const debt = [
    { monthKey: "2026-11", total: 50000, mortgage: 40000 },
    { monthKey: "2028-06", total: 40000, mortgage: 40000 },
    { monthKey: "2031-03", total: 0.2, mortgage: 0 },
  ];
  const liquidity = [{ monthKey: "2026-11", total: 8000 }, { monthKey: "2027-05", total: 15000 }];
  const r = L.milestones({ debt, liquidity, cushionTarget: 12000 });
  assert.equal(JSON.stringify(r.hitos.map((h) => [h.id, h.monthKey])), JSON.stringify([["colchon", "2027-05"], ["deuda-cero", "2031-03"], ["fin-hipoteca", "2031-03"]]));
  // El colchón ya cubierto hoy no es un hito; una hipoteca que no se acaba antes del final del plan, pendiente.
  const r2 = L.milestones({ debt: [{ monthKey: "2026-11", total: 9000, mortgage: 9000 }, { monthKey: "2036-12", total: 5000, mortgage: 5000 }], liquidity: [{ monthKey: "2026-11", total: 20000 }], cushionTarget: 12000 });
  assert.equal(r2.hitos.length, 0);
  assert.equal(JSON.stringify(r2.pendientes.map((p) => p.id)), JSON.stringify(["deuda-cero", "fin-hipoteca"]));
  // Sin hipoteca, no hay hito de hipoteca; sin objetivo de colchón, tampoco.
  const r3 = L.milestones({ debt: [{ monthKey: "2026-11", total: 3000, mortgage: null }, { monthKey: "2027-02", total: 0, mortgage: null }], liquidity, cushionTarget: 0 });
  assert.equal(JSON.stringify(r3.hitos.map((h) => h.id)), JSON.stringify(["deuda-cero"]));
});

test("FX-50 PR-2 · los objetivos de ahorro activos con fecha son hitos en su mes; los de fuera del horizonte, pendientes", () => {
  const liquidity = [{ monthKey: "2026-11", total: 8000 }, { monthKey: "2036-12", total: 9000 }];
  const goals = [
    { id: "coche", name: "Coche", target: 12000, targetDate: "2028-06-30", status: "active" },
    { id: "viaje", name: "Viaje", target: 3000, targetDate: "2027-03-01", status: "paused" },
    { id: "casa", name: "Entrada", target: 40000, targetDate: "2040-01-01" },
    { id: "sin", name: "Sin fecha", target: 500 },
  ];
  const r = L.milestones({ liquidity, goals });
  assert.equal(JSON.stringify(r.hitos.map((h) => [h.id, h.monthKey, h.amount])), JSON.stringify([["objetivo-coche", "2028-06", 12000]]));
  assert.equal(JSON.stringify(r.pendientes.map((h) => h.id)), JSON.stringify(["objetivo-casa"]));
});

test("FX-50 · motor puro", () => {
  const fuente = fs.readFileSync(path.resolve(__dirname, "../canonical-long-horizon.js"), "utf8");
  assert.doesNotMatch(fuente, /document\.|window\.|localStorage|fetch\(/);
});
