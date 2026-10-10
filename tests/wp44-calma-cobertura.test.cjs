const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const C = require("../canonical-calm-coverage.js");

// WP-44 (CAR-02 + CAR-05 + CAR-06): calma en caídas, cobertura del gasto por los activos y exposición por entidad. Lo que el hogar debe poder fiar: que una aportación no se lea como
// subida ni una venta como caída, que dato ausente no sume ni dé por cubierto, y que nada recomiende vender ni comprar.

const pos = (id, label, extra = {}) => ({ id, label, type: "fondo", currentValue: 1000, contributions: [], disposals: [], ...extra });
const val = (date, ...pairs) => ({ date, points: pairs.map(([id, value]) => ({ id, value })) });
const seriesOf = (valuations, positions) => C.portfolioSeries({ valuations, positions });

test("WP-44 · la serie solo usa fechas en las que todas las posiciones tienen valoración, y arrastra la última conocida", () => {
  const positions = [pos("a", "Fondo A"), pos("b", "Fondo B")];
  const s = seriesOf([val("2026-09-01", ["a", 1000]), val("2026-10-01", ["a", 1100], ["b", 500]), val("2026-11-01", ["a", 1200])], positions);
  assert.deepEqual(s.points, [{ date: "2026-10-01", total: 1600 }, { date: "2026-11-01", total: 1700 }], "septiembre no cuenta (falta B) y noviembre arrastra el valor de B");
  assert.deepEqual(seriesOf([], positions).neverValued, ["Fondo A", "Fondo B"]);
  assert.deepEqual(seriesOf([val("2026-09-01", ["a", 1])], positions).points, [], "sin B nunca hay fecha completa");
});

test("WP-44 · con menos de 3 valoraciones completas no hay «caída» y se dice cuántas faltan", () => {
  const positions = [pos("a", "Fondo A")];
  const r = C.calmDrawdown({ series: seriesOf([val("2026-10-01", ["a", 1000]), val("2026-11-01", ["a", 900])], positions), positions });
  assert.equal(r.status, "not-enough");
  assert.equal(r.have, 2);
  assert.equal(r.need, 3);
  assert.equal(C.calmDrawdown({ series: { points: [], neverValued: ["Fondo A"] }, positions }).neverValued[0], "Fondo A");
});

test("WP-44 · la caída se mide en mercado: una aportación no es una subida", () => {
  // 1.000 → 1.200 tras aportar 300 (el mercado hizo −100) → 900 (−300 más): el mercado ha perdido 400 desde el principio (−40 %), no 300 (−25 %) desde 1.200.
  const positions = [pos("a", "Fondo A", { contributions: [{ date: "2026-11-15", amount: 300 }] })];
  const s = seriesOf([val("2026-10-01", ["a", 1000]), val("2026-12-01", ["a", 1200]), val("2027-01-01", ["a", 900])], positions);
  const r = C.calmDrawdown({ series: s, positions });
  assert.equal(r.status, "ok");
  assert.equal(r.drawdownAmount, -400);
  assert.equal(r.drawdownPct, -40);
  assert.equal(r.peakDate, "2026-10-01");
});

test("WP-44 · aportar sin que el mercado baje no es caída, y una venta no es una caída", () => {
  const aporta = [pos("a", "Fondo A", { contributions: [{ date: "2026-11-10", amount: 500 }] })];
  const r1 = C.calmDrawdown({ series: seriesOf([val("2026-10-01", ["a", 1000]), val("2026-12-01", ["a", 1500]), val("2027-01-01", ["a", 1500])], aporta), positions: aporta });
  assert.equal(r1.drawdownAmount, 0);
  assert.equal(r1.level, 0);
  const vende = [pos("a", "Fondo A", { disposals: [{ date: "2026-11-10", saleProceeds: 400 }] })];
  const r2 = C.calmDrawdown({ series: seriesOf([val("2026-10-01", ["a", 1000]), val("2026-12-01", ["a", 600]), val("2027-01-01", ["a", 600])], vende), positions: vende });
  assert.equal(r2.drawdownAmount, 0, "sacar 400 € no es perder 400 €");
});

test("WP-44 · el nivel sigue los umbrales de la política (20 y 35 por defecto) y la caída se cuenta en meses de aportación", () => {
  const positions = [pos("a", "Fondo A")];
  const mk = (last) => C.calmDrawdown({ series: seriesOf([val("2026-10-01", ["a", 1000]), val("2026-11-01", ["a", 1000]), val("2026-12-01", ["a", last])], positions), positions, monthlyContribution: 100 });
  assert.equal(mk(900).level, 0);
  assert.equal(mk(790).level, 1);
  assert.equal(mk(640).level, 2);
  assert.equal(mk(790).monthsOfContribution, 2.1, "210 € / 100 € al mes");
  assert.equal(C.calmDrawdown({ series: seriesOf([val("2026-10-01", ["a", 1000]), val("2026-11-01", ["a", 1000]), val("2026-12-01", ["a", 790])], positions), positions }).monthsOfContribution, null, "sin aportación declarada no hay meses");
  const custom = C.calmDrawdown({ series: seriesOf([val("2026-10-01", ["a", 1000]), val("2026-11-01", ["a", 1000]), val("2026-12-01", ["a", 900])], positions), positions, levels: [10, 30] });
  assert.equal(custom.level, 1);
});

test("WP-44 · avisa de una valoración antigua: la caída de hoy puede no ser la de hoy", () => {
  const positions = [pos("a", "Fondo A")];
  const s = seriesOf([val("2026-08-01", ["a", 1000]), val("2026-09-01", ["a", 1000]), val("2026-10-01", ["a", 800])], positions);
  assert.equal(C.calmDrawdown({ series: s, positions, today: "2026-10-20" }).stale, false);
  const viejo = C.calmDrawdown({ series: s, positions, today: "2026-12-20" });
  assert.equal(viejo.stale, true);
  assert.equal(viejo.ageDays, 80);
});

test("WP-44 · cobertura: suma alquiler y retirada sostenible, dice cuánto falta para el siguiente hito", () => {
  const r = C.coverage({ monthlyExpense: 2000, rentNetMonthly: 300, withdrawalRatePct: 4, liquidPortfolioValue: 100000 });
  assert.equal(r.status, "ok");
  assert.equal(r.annualExpense, 24000);
  assert.equal(r.annualIncome, 7600, "3.600 de alquiler + 4.000 de retirada");
  assert.equal(r.coveragePct, 31.7);
  assert.deepEqual(r.reached, [25]);
  assert.equal(r.nextMilestone, 50);
  assert.equal(r.neededForNext, 4400);
});

test("WP-44 · cobertura: lo que no se declara no suma y se nombra; una tasa insostenible tampoco", () => {
  const sinTasa = C.coverage({ monthlyExpense: 2000, rentNetMonthly: 300, liquidPortfolioValue: 100000 });
  assert.equal(sinTasa.annualIncome, 3600);
  assert.match(sinTasa.missing.join(" "), /tasa de retirada/);
  const absurda = C.coverage({ monthlyExpense: 2000, withdrawalRatePct: 20, liquidPortfolioValue: 100000 });
  assert.equal(absurda.status, "no-income");
  assert.match(absurda.missing.join(" "), /no es sostenible/);
  assert.equal(C.coverage({ monthlyExpense: 2000 }).status, "no-income");
  assert.equal(C.coverage({ monthlyExpense: null, rentNetMonthly: 300 }).status, "no-expense");
  assert.equal(C.coverage({ monthlyExpense: 0 }).status, "no-expense");
});

test("WP-44 · cobertura: los dividendos no se suman aparte (ya van dentro de una tasa de retirada sostenible)", () => {
  const base = C.coverage({ monthlyExpense: 2000, withdrawalRatePct: 4, liquidPortfolioValue: 100000 });
  const conDividendos = C.coverage({ monthlyExpense: 2000, withdrawalRatePct: 4, liquidPortfolioValue: 100000, dividendsAnnual: 5000 });
  assert.deepEqual(conDividendos, base);
});

test("WP-44 · cobertura al 100 %: no queda hito siguiente", () => {
  const r = C.coverage({ monthlyExpense: 1000, rentNetMonthly: 1500 });
  assert.deepEqual(r.reached, [25, 50, 100]);
  assert.equal(r.nextMilestone, null);
  assert.equal(r.neededForNext, 0);
});

test("WP-44 · depósitos: dentro del límite, sin titulares declarados por encima del límite individual no se dice «cubierto», y por encima del límite de todos los titulares se avisa", () => {
  const r = C.depositExposure({ accounts: [
    { id: "caixa", entity: "CaixaBank", balance: 90000 },
    { id: "med", entity: "Banca Mediolanum", balance: 150000 },
    { id: "tres", entity: "Otra", balance: 150000, holders: 2 },
    { id: "cuatro", entity: "Otra B", balance: 250000, holders: 2 },
    { id: "nada", entity: "Sin saldo", balance: null },
  ] });
  assert.deepEqual(r.rows.map((x) => [x.id, x.status]), [["caixa", "within"], ["med", "unknown-holders"], ["tres", "within"], ["cuatro", "over"]]);
  assert.equal(r.rows.find((x) => x.id === "cuatro").overBy, 50000);
  assert.equal(r.rows.find((x) => x.id === "med").covered, null);
  assert.equal(r.anyOver, true);
  assert.equal(r.anyUnknown, true);
  assert.equal(r.total, 640000);
});

test("WP-44 · el motor es puro y no recomienda: ni DOM, ni red, ni almacenamiento, ni reloj, ni «vende»/«compra»", () => {
  const source = read("canonical-calm-coverage.js");
  assert.doesNotMatch(source, /\b(document|window|localStorage|sessionStorage|fetch|XMLHttpRequest|indexedDB)\b/);
  assert.doesNotMatch(source, /new Date\(|Date\.now/);
});
