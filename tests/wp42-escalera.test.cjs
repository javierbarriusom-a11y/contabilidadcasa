const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const N = require("../canonical-next-euro.js");

// WP-42 (CAR-03 + NIN-05 + NIN-08): la escalera del próximo euro. Lo que el hogar debe poder fiar: que el colchón va primero, que sin dato no se inventa nada, que
// amortizar (cierto), invertir (esperado) y el ahorro fiscal de la pensión (de una vez) no se mezclan, y que aportar nunca obliga a vender.

const debts = [
  { id: "d1", entity: "Cetelem", currentPrincipal: 1000, effectiveAprPct: 8 },
  { id: "d2", entity: "Banco", currentPrincipal: 5000, effectiveAprPct: 4 },
  { id: "d3", entity: "Coche", currentPrincipal: 3000, effectiveAprPct: 2 },
];
const rung = (ladder, id) => ladder.rungs.find((r) => r.id === id);
const base = { liquidity: 10000, floor: 3000, investment: { expectedReturnPct: 7, savingsTaxPct: 19 }, pension: { year: 2026, marginalRatePct: 20 } };

test("WP-42 · sin importe no hay escalera", () => {
  assert.equal(N.buildLadder({ ...base, amount: 0 }).status, "invalid");
  assert.equal(N.buildLadder({ ...base, amount: "x" }).status, "invalid");
});

test("WP-42 · el colchón va primero y se queda con todo si no llega a su suelo", () => {
  const l = N.buildLadder({ ...base, liquidity: 1000, amount: 2000, debts });
  assert.equal(rung(l, "cushion").amount, 2000);
  assert.equal(rung(l, "debt").amount, 0);
  assert.equal(l.allocated, 2000);
  const parcial = N.buildLadder({ ...base, liquidity: 2500, amount: 2000, debts });
  assert.equal(rung(parcial, "cushion").amount, 500, "solo lo que falta");
  assert.equal(rung(parcial, "debt").lines[0].amount, 1000, "y luego la deuda más cara hasta liquidarla");
  assert.equal(rung(parcial, "debt").amount, 1500, "y lo que queda a la siguiente");
});

test("WP-42 · si el dinero ya está en las cuentas, solo es libre lo que supera el suelo", () => {
  const l = N.buildLadder({ ...base, liquidity: 5000, floor: 3000, amountInAccounts: true, amount: 4000, debts: [] });
  assert.equal(rung(l, "cushion").amount, 2000, "2.000 € se quedan para sostener el suelo");
  assert.equal(l.allocated, 4000);
  const libre = N.buildLadder({ ...base, liquidity: 9000, floor: 3000, amountInAccounts: true, amount: 4000, debts: [] });
  assert.equal(rung(libre, "cushion").amount, 0);
});

test("WP-42 · sin liquidez o sin suelo el colchón dice «no sé» y el resultado es parcial, no «completo»", () => {
  const l = N.buildLadder({ ...base, liquidity: null, amount: 1000, debts });
  assert.equal(rung(l, "cushion").status, "no-data");
  assert.equal(l.status, "partial");
  assert.match(l.missing.join(" "), /liquidez/);
  assert.equal(N.buildLadder({ ...base, floor: undefined, amount: 1000, debts }).status, "partial");
});

test("WP-42 · la deuda cara va antes que invertir, la más cara primero, y la barata espera a que invertir no la supere con margen", () => {
  const l = N.buildLadder({ ...base, amount: 3000, debts });
  // 7 % × (1 − 19 %) = 5,67 % neto; umbral = 5,67 − 2 puntos de prima por riesgo = 3,67 %.
  assert.equal(l.netInvestPct, 5.67);
  assert.equal(l.hurdlePct, 3.67);
  const lines = rung(l, "debt").lines;
  assert.deepEqual(lines.map((x) => x.id), ["d1", "d2"], "la del 2 % no pasa del umbral");
  assert.equal(lines[0].amount, 1000);
  assert.equal(lines[0].liquidatesIt, true);
  assert.equal(lines[1].amount, 2000);
  assert.equal(l.certainAnnualBenefit, 160, "1.000 × 8 % + 2.000 × 4 %");
});

test("WP-42 · el beneficio cierto, el esperado y el ahorro fiscal de una vez no se suman en una sola cifra", () => {
  const l = N.buildLadder({ ...base, amount: 10000, debts, pension: { year: 2026, marginalRatePct: 37 } });
  assert.equal(l.certainAnnualBenefit, rung(l, "debt").annualBenefit);
  assert.equal(l.oneOffTaxSaving, 555, "1.500 € × 37 %");
  assert.ok(l.expectedAnnualBenefit > 0);
  assert.equal(l.total, undefined, "no hay una cifra única mezclada");
  assert.equal(rung(l, "invest").certainty, "esperado");
  assert.equal(rung(l, "debt").certainty, "cierto");
});

test("WP-42 · una deuda sin interés declarado no es una deuda gratis: se aparta, se dice y el reparto queda parcial", () => {
  const sinTae = [{ id: "u", entity: "Entidad B", currentPrincipal: 3500, effectiveAprPct: null }, ...debts];
  const l = N.buildLadder({ ...base, amount: 3000, debts: sinTae });
  const debt = rung(l, "debt");
  assert.deepEqual(debt.unknownRate.map((x) => x.id), ["u"]);
  assert.equal(debt.lines.some((x) => x.id === "u"), false, "no se le asigna dinero sin saber lo que cuesta");
  assert.match(debt.reasons.join(" "), /sin interés declarado \(Entidad B: 3500 €\)/);
  assert.equal(l.status, "partial");
  assert.match(l.missing.join(" "), /interés de Entidad B/);
  assert.match(rung(l, "invest").reasons.join(" ") + debt.reasons.join(" "), /Declara su TAE/);
  const soloDesconocida = N.buildLadder({ ...base, amount: 3000, debts: [sinTae[0]] });
  assert.equal(rung(soloDesconocida, "debt").status, "no-data", "ni «no hay deudas» ni «no toca»");
  assert.match(rung(soloDesconocida, "invest").reasons.join(" "), /mira las deudas sin interés declarado/);
  const gratis = N.buildLadder({ ...base, amount: 3000, debts: [{ id: "g", entity: "Amigo", currentPrincipal: 800, effectiveAprPct: 0 }] });
  assert.equal(gratis.status, "ok", "un 0 % declarado sí es un coste conocido");
  assert.match(rung(gratis, "debt").reasons.join(" "), /no cobran interés/);
});

test("WP-42 · el coste implícito se marca como estimación", () => {
  const l = N.buildLadder({ ...base, amount: 2000, debts: [{ id: "r", entity: "Plan reunificado", currentPrincipal: 1000, effectiveAprPct: 12, rateSource: "implied" }] });
  assert.equal(rung(l, "debt").lines[0].rateImplied, true);
  assert.match(rung(l, "debt").reasons.join(" "), /IMPLÍCITO/);
});

test("WP-42 · sin rentabilidad esperada no hay veredicto: lo que sobra queda sin reparto, nunca un 50/50", () => {
  const l = N.buildLadder({ ...base, amount: 5000, debts: [], investment: {}, pension: {} });
  assert.equal(rung(l, "invest").amount, 0);
  assert.equal(l.unassigned, 5000);
  assert.equal(rung(l, "invest").status, "no-verdict");
  assert.equal(l.allocated + l.unassigned, 5000);
  const umbral = N.buildLadder({ ...base, amount: 500, debts: [{ id: "x", entity: "Tarjeta", currentPrincipal: 900, effectiveAprPct: 21 }], investment: {} });
  assert.equal(rung(umbral, "debt").amount, 500, "sin rentabilidad con la que comparar, el 21 % es caro de todos modos (umbral 6 %)");
});

test("WP-42 · sin el tipo del ahorro compara antes de impuestos y lo dice; si la rentabilidad es histórica, también", () => {
  const l = N.buildLadder({ ...base, amount: 1000, debts: [], investment: { expectedReturnPct: 7, source: "historical" } });
  assert.match(l.notes.join(" "), /ANTES de impuestos/);
  assert.match(l.notes.join(" "), /pasado, no una promesa/);
});

test("WP-42 · la pensión solo entra si el tipo marginal la justifica y hasta lo que cabe; sin el dato dice «no sé»", () => {
  const justificada = N.buildLadder({ ...base, amount: 5000, debts: [], pension: { year: 2026, marginalRatePct: 37 } });
  assert.equal(rung(justificada, "pension").amount, 1500);
  assert.equal(rung(justificada, "invest").amount, 3500);
  assert.match(justificada.notes.join(" "), /cuánto habéis aportado ya/);
  const yaAportado = N.buildLadder({ ...base, amount: 5000, debts: [], pension: { year: 2026, marginalRatePct: 37, alreadyContributed: 1200 } });
  assert.equal(rung(yaAportado, "pension").amount, 300);
  const tope = N.buildLadder({ ...base, amount: 5000, debts: [], pension: { year: 2026, marginalRatePct: 37, alreadyContributed: 1500 } });
  assert.equal(rung(tope, "pension").amount, 0);
  const barata = N.buildLadder({ ...base, amount: 5000, debts: [], pension: { year: 2026, marginalRatePct: 24 } });
  assert.equal(rung(barata, "pension").amount, 0);
  assert.match(rung(barata, "pension").reasons.join(" "), /no compensa/);
  const sinTipo = N.buildLadder({ ...base, amount: 5000, debts: [], pension: { year: 2026 } });
  assert.equal(rung(sinTipo, "pension").status, "no-data");
  assert.equal(sinTipo.status, "partial");
});

test("WP-42 · avisa, sin reordenar, cuando la pensión ahorra más impuestos el primer año que la deuda cuesta", () => {
  const l = N.buildLadder({ ...base, amount: 4000, debts: [{ id: "d", entity: "Banco", currentPrincipal: 1000, effectiveAprPct: 8 }], investment: { expectedReturnPct: 12, savingsTaxPct: 19 }, pension: { year: 2026, marginalRatePct: 37 } });
  assert.deepEqual(l.rungs.map((r) => r.id), ["cushion", "debt", "pension", "invest"], "el orden del plan no cambia");
  assert.match(l.notes.join(" "), /ahorra un 37 % de impuestos/);
});

test("WP-42 · todo lo que se reparte suma el importe, con o sin dinero sobrante", () => {
  [[300, 0], [2500, 1500], [20000, 8000], [20000, 0]].forEach(([amount, alreadyDebt]) => {
    const l = N.buildLadder({ ...base, amount, liquidity: 1000, debts: alreadyDebt ? debts : [], pension: { year: 2026, marginalRatePct: 37 } });
    assert.equal(Math.round((l.allocated + l.unassigned) * 100), Math.round(amount * 100), `importe ${amount}`);
  });
});

test("WP-42 · aportar reparte hacia lo que está por debajo del objetivo y nunca vende", () => {
  const r = N.contributionRebalance({ totalsByType: { fondo: 6000, renta_fija: 4000 }, targets: { fondo: 50, renta_fija: 50 }, amount: 2000 });
  assert.equal(r.calculable, true);
  assert.deepEqual(r.rows.map((x) => [x.type, x.amount]), [["renta_fija", 2000]], "todo a lo que falta");
  assert.ok(r.rows.every((x) => x.amount > 0), "ninguna venta");
  const grande = N.contributionRebalance({ totalsByType: { fondo: 6000, renta_fija: 4000 }, targets: { fondo: 50, renta_fija: 50 }, amount: 6000 });
  // Total tras aportar: 16.000 → 8.000 en cada tipo; faltan 2.000 en fondos y 4.000 en renta fija.
  assert.deepEqual(grande.rows.map((x) => [x.type, x.amount]).sort(), [["fondo", 2000], ["renta_fija", 4000]]);
  assert.equal(grande.rows.reduce((s, x) => s + x.amount, 0), 6000);
});

test("WP-42 · si la cartera ya está en su objetivo, se aporta en proporción; el redondeo no pierde céntimos", () => {
  const r = N.contributionRebalance({ totalsByType: { a: 500, b: 300, c: 200 }, targets: { a: 50, b: 30, c: 20 }, amount: 100.01 });
  assert.equal(Math.round(r.rows.reduce((s, x) => s + x.amount, 0) * 100), 10001);
  assert.equal(r.rows.length, 3);
});

test("WP-42 · sin objetivos o sin importe no hay reparto, y lo dice", () => {
  assert.equal(N.contributionRebalance({ totalsByType: { a: 1 }, targets: {}, amount: 100 }).reason, "missing-targets");
  assert.equal(N.contributionRebalance({ totalsByType: { a: 1 }, targets: { a: 100 }, amount: 0 }).reason, "missing-amount");
  const l = N.buildLadder({ ...base, amount: 1000, debts: [], pension: {}, portfolio: { totalsByType: { fondo: 100 }, targets: {} } });
  assert.match(rung(l, "invest").reasons.join(" "), /objetivos por tipo/);
});

test("WP-42 · el motor es puro: ni DOM, ni red, ni almacenamiento, ni fecha del reloj", () => {
  const source = read("canonical-next-euro.js");
  assert.doesNotMatch(source, /\b(document|window|localStorage|sessionStorage|fetch|XMLHttpRequest|indexedDB)\b/);
  assert.doesNotMatch(source, /new Date\(|Date\.now/);
});

test("WP-42 · la casilla de «ya está en mis cuentas» no hereda el ancho completo de los campos (el CI mira el desbordamiento a 360 px)", () => {
  const css = read("escalera.css");
  assert.match(css, /\.peu-check input\[type="checkbox"\]\s*\{[^}]*width:\s*22px/);
  assert.match(css, /\.peu-campos\s*\{[^}]*minmax\(min\(170px, 100%\), 1fr\)/);
});
