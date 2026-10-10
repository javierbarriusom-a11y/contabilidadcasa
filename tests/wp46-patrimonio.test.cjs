const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const N = require("../canonical-net-worth.js");

// WP-46 (NPV-10): patrimonio neto, serie y proyección con tres escenarios. Lo que el hogar debe poder fiar: que el neto no se calcule con un componente que falta, que una serie de
// menos de 3 fotos no se llame serie, que la proyección no invente un rendimiento y que sus cifras cuadren con la aritmética.

const snap = (monthKey, parts = {}) => {
  const r = N.buildSnapshot({ monthKey, closedAt: `${monthKey}-28T10:00:00Z`, cash: 10000, portfolio: 20000, assets: 150000, debt: 12000, ...parts });
  assert.equal(r.calculable, true);
  return r.snapshot;
};

test("WP-46 · la foto suma efectivo, cartera y activos y resta la deuda", () => {
  const s = snap("2026-10");
  assert.equal(s.net, 168000);
  assert.deepEqual(s.missing, []);
  assert.equal(snap("2026-10", { debt: 0 }).net, 180000, "sin deuda es una deuda conocida de 0");
});

test("WP-46 · si falta un componente, el neto no se calcula y se nombra lo que falta", () => {
  const s = snap("2026-10", { cash: null });
  assert.equal(s.net, null);
  assert.deepEqual(s.missing, ["efectivo en cuentas"]);
  const dos = snap("2026-10", { cash: null, assets: undefined });
  assert.deepEqual(dos.missing, ["efectivo en cuentas", "vivienda, local y otros activos"]);
  assert.equal(snap("2026-10", { debt: -5 }).debt, 0, "una deuda negativa no existe");
  assert.equal(N.buildSnapshot({ monthKey: "nope" }).calculable, false);
});

test("WP-46 · con menos de 3 fotos completas no hay serie; las incompletas no cuentan", () => {
  const a = snap("2026-10");
  const b = snap("2026-11");
  const c = snap("2026-12", { cash: null });
  let store = [];
  [a, b, c].forEach((s) => { store = N.upsert(store, s); });
  const r = N.series(store);
  assert.equal(r.enough, false);
  assert.equal(r.have, 2);
  assert.equal(r.incomplete, 1);
  assert.deepEqual(r.all.map((s) => s.monthKey), ["2026-10", "2026-11", "2026-12"], "de la más antigua a la más reciente");
  store = N.upsert(store, snap("2026-12"));
  assert.equal(N.series(store).enough, true, "regrabar un mes sustituye");
});

test("WP-46 · el almacén guarda una foto por mes y descarta lo mal formado", () => {
  assert.deepEqual(N.normalizeStore([null, { x: 1 }, "a"]), []);
  assert.deepEqual(N.normalizeStore("nada"), []);
  const store = N.upsert(N.upsert([], snap("2026-10")), snap("2026-09"));
  assert.deepEqual(store.map((s) => s.monthKey), ["2026-10", "2026-09"]);
});

test("WP-46 · el movimiento reparte el cambio por componente y la deuda que baja suma", () => {
  const a = snap("2026-10");
  const b = snap("2026-11", { cash: 10500, portfolio: 19000, assets: 150000, debt: 11500 });
  const m = N.movement(a, b);
  assert.equal(m.calculable, true);
  assert.equal(m.delta, 0, "+500 de efectivo, −1.000 de cartera, +500 de deuda que baja");
  assert.deepEqual(m.rows.map((r) => [r.id, r.value]), [["cash", 500], ["portfolio", -1000], ["assets", 0], ["debt", 500]]);
  assert.equal(m.drift, 0);
  assert.equal(m.rows.reduce((s, r) => s + r.value, 0), m.delta, "las barras suman el cambio");
  assert.equal(N.movement(a, snap("2026-11", { cash: null })).calculable, false);
  assert.equal(N.movement(a, null).calculable, false);
});

// ── Proyección ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const liquidity = (start, perMonth, months = 24) => Array.from({ length: months }, (_, i) => ({ monthKey: N.addMonths("2026-10", i + 1), value: start + perMonth * (i + 1) }));
const debtPath = (principal, perMonth, months = 24) => {
  const rows = [];
  for (let i = 0; i < months; i += 1) { const balance = Math.max(0, principal - perMonth * (i + 1)); rows.push({ monthKey: N.addMonths("2026-10", i + 1), balance }); if (balance === 0) break; }
  return rows;
};
const base = { startMonthKey: "2026-10", horizonMonths: 24, start: { portfolio: 10000, assets: 100000 }, liquidityPath: liquidity(5000, 200), debtPath: debtPath(1200, 100), excludedDebt: 0 };

test("WP-46 · la proyección cuadra con la aritmética: liquidez + cartera × (1+r)^t + activos × (1+g)^t − deuda", () => {
  const p = N.project({ ...base, scenarios: [{ id: "base", portfolioReturnPct: 5, assetGrowthPct: 2 }] });
  assert.equal(p.calculable, true);
  const row12 = p.scenarios[0].path[11];
  assert.equal(row12.monthKey, "2027-10");
  assert.equal(row12.portfolio, 10500);
  assert.equal(row12.assets, 102000);
  assert.equal(row12.liquidity, 7400);
  assert.equal(row12.debt, 0, "1.200 € a 100 € al mes: saldada a los 12 meses");
  assert.equal(row12.net, 7400 + 10500 + 102000);
  const row1 = p.scenarios[0].path[0];
  assert.equal(row1.debt, 1100);
  assert.ok(Math.abs(row1.portfolio - 10000 * 1.05 ** (1 / 12)) < 0.01);
});

test("WP-46 · sin rendimiento ni revalorización declarados, se mantienen en 0 % y se dice; los tres escenarios coinciden", () => {
  const p = N.project({ ...base, scenarios: [{ id: "low" }, { id: "base" }, { id: "high" }] });
  assert.equal(p.anyUndeclared, true);
  assert.equal(p.allSame, true);
  assert.deepEqual(p.scenarios[0].declared, { portfolio: false, assets: false });
  assert.equal(p.scenarios[1].path[23].portfolio, 10000);
  assert.equal(N.fan(p).every((point) => point.low === point.center && point.center === point.high), true);
});

test("WP-46 · tres escenarios declarados dan un abanico ordenado: el bajo por debajo del central y este del alto", () => {
  const p = N.project({ ...base, scenarios: [{ id: "low", portfolioReturnPct: 1, assetGrowthPct: 0 }, { id: "base", portfolioReturnPct: 4, assetGrowthPct: 2 }, { id: "high", portfolioReturnPct: 7, assetGrowthPct: 4 }] });
  assert.equal(p.anyUndeclared, false);
  assert.equal(p.allSame, false);
  const fan = N.fan(p);
  assert.equal(fan.length, 24);
  assert.ok(fan.every((point) => point.low <= point.center && point.center <= point.high));
  assert.ok(fan[23].high - fan[23].low > fan[0].high - fan[0].low, "el abanico se abre con el tiempo");
  assert.ok(p.scenarios[0].endNet < p.scenarios[1].endNet && p.scenarios[1].endNet < p.scenarios[2].endNet);
});

test("WP-46 · la deuda sin calendario no amortiza: se mantiene, y no hay «deuda cero»", () => {
  const conExcluida = N.project({ ...base, excludedDebt: 3000, scenarios: [{ id: "base" }] });
  assert.equal(conExcluida.scenarios[0].path[23].debt, 3000);
  assert.equal(conExcluida.debtFreeMonthKey, null, "queda deuda sin calendario: no se puede decir que sea cero");
  const limpia = N.project({ ...base, scenarios: [{ id: "base" }] });
  assert.equal(limpia.debtFreeMonthKey, "2027-10");
});

test("WP-46 · hitos: cuándo el patrimonio deja de ser negativo y cuándo alcanza un objetivo tecleado", () => {
  const negative = { ...base, start: { portfolio: 0, assets: 0 }, liquidityPath: liquidity(-6000, 1000), debtPath: [], scenarios: [{ id: "base" }] };
  const p = N.project(negative);
  assert.equal(p.scenarios[0].path[0].net, -5000);
  assert.equal(p.scenarios[0].milestones.netPositiveMonth, "2027-04", "−6.000 + 1.000 × 6 = 0");
  const meta = N.project({ ...base, targetNet: 120000, scenarios: [{ id: "base", portfolioReturnPct: 5, assetGrowthPct: 2 }] });
  assert.equal(meta.scenarios[0].milestones.targetMonth, "2027-11", "el primer mes con ≥ 120.000 €");
  const sinMeta = N.project({ ...base, scenarios: [{ id: "base" }] });
  assert.equal(sinMeta.scenarios[0].milestones.targetMonth, null);
  assert.equal(sinMeta.scenarios[0].milestones.netPositiveMonth, null, "ya es positivo: no hay hito que marcar");
});

test("WP-46 · pasada la previsión, la liquidez se mantiene en su último valor y el horizonte tiene tope", () => {
  const p = N.project({ ...base, horizonMonths: 36, scenarios: [{ id: "base" }] });
  assert.equal(p.scenarios[0].path[35].liquidity, p.scenarios[0].path[23].liquidity);
  assert.equal(N.project({ ...base, horizonMonths: 9999, scenarios: [{ id: "base" }] }).months.length, 240);
  assert.equal(N.project({ ...base, startMonthKey: "x", scenarios: [{ id: "base" }] }).calculable, false);
  assert.equal(N.project({ ...base, scenarios: [] }).calculable, false);
  assert.deepEqual(N.fan({ calculable: false }), []);
});

test("WP-46 · el motor es puro: ni DOM, ni red, ni almacenamiento, ni reloj", () => {
  const source = read("canonical-net-worth.js");
  assert.doesNotMatch(source, /\b(document|window|localStorage|sessionStorage|fetch|XMLHttpRequest|indexedDB)\b/);
  assert.doesNotMatch(source, /new Date\(\)|Date\.now/);
});
