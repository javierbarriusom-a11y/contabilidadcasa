// DUO-D3 (duodécima auditoría, 24/11/2026): el coste real de amortizar en el plan óptimo. La comisión de cada contrato (la escribe el
// hogar; nunca se supone) ordena la avalancha por lo que rinde amortizar de verdad y resta del ahorro; si baja pronto, se avisa. Al
// amortizar, reducir plazo o cuota (APX6). Con tipo variable, un rango de fechas. Contratos inventados.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const Path = require("../canonical-debt-payoff-path.js");
const Plan = require("../canonical-debt-optimal-plan.js");
const Comparator = require("../canonical-debt-comparator.js");

const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
const contratos = [
  { id: "h", entity: "Banco FICTICIO", type: "Hipoteca", paymentStatus: "active", currentPrincipal: 60000, currentPayment: 500, apr: 4, remainingInstallments: 150 },
  { id: "p", entity: "Caja FICTICIA", type: "Préstamo", paymentStatus: "active", currentPrincipal: 5000, currentPayment: 160, apr: 4.5, remainingInstallments: 36 },
];
const base = { startMonthKey: "2026-12", monthly: 300 };

test("DUO-D3 · comisiones: solo las que escribe el hogar (0 a 10 %); la de ahora y, si baja, desde qué mes", () => {
  const c = Plan.comisiones([{ id: "p", pct: 3, untilMonth: "2027-06", nextPct: 1 }, { id: "h", pct: 0 }, { id: "x", pct: 40 }], "2026-12");
  assert.deepEqual([...c.keys()], ["p"]);
  assert.deepEqual(c.get("p"), { pct: 3, original: 3, baja: { untilMonth: "2027-06", nextPct: 1 } });
  assert.deepEqual(Plan.comisiones([{ id: "p", pct: 3, untilMonth: "2027-06", nextPct: 1 }], "2027-07").get("p"), { pct: 1, original: 3, baja: null }, "pasada la fecha, la de después");
});

test("DUO-D3 · con comisión, la avalancha va primero a lo que rinde de verdad, y sale más barato que el orden de siempre pagando la comisión", () => {
  const sin = Plan.plan(Path, contratos, base);
  assert.equal(sin.recommended.periods[0].targetId, "p", "sin comisión, primero la TAE más alta (4,5 %)");
  const con = Plan.plan(Path, contratos, { ...base, commissions: [{ id: "p", pct: 3 }] });
  assert.equal(con.recommended.periods[0].targetId, "h", "con un 3 % sobre una deuda que acaba en 3 años, rinde más la hipoteca al 4 %");
  // Comprobación con el mismo motor: los dos órdenes, pagando la comisión de lo que se amortiza de «p».
  const coste = (order) => {
    const r = Path.project(contratos, { startMonthKey: "2026-12", extraMonthly: 300, strategy: "avalancha", order, redirectFreed: true });
    return r.totalInterest + r.included.filter((x) => x.id === "p").reduce((s, x) => s + x.extraApplied * 0.03, 0);
  };
  assert.ok(coste(["h", "p"]) < coste(["p", "h"]), `${coste(["h", "p"])} < ${coste(["p", "h"])}`);
});

test("DUO-D3 · lo que se paga en comisiones resta de lo que os ahorráis (los intereses de menos no cambian)", () => {
  const caro = [
    { id: "t", entity: "Banco FICTICIO", type: "Tarjeta", paymentStatus: "active", currentPrincipal: 2400, currentPayment: 90, apr: 21.9 },
    { id: "q", entity: "Caja FICTICIA", type: "Préstamo", paymentStatus: "active", currentPrincipal: 5100, currentPayment: 160, apr: 9.5 },
  ];
  const sin = Plan.plan(Path, caro, base);
  const con = Plan.plan(Path, caro, { ...base, commissions: [{ id: "t", pct: 1 }] });
  const s = con.recommended.summary;
  assert.equal(s.interestSaved, sin.recommended.summary.interestSaved, "1 % no cambia el orden (la tarjeta sigue primero)");
  assert.ok(s.commissionCost > 0);
  const t = con.recommended.result.included.find((r) => r.id === "t");
  assert.equal(s.commissionCost, Math.round(t.extraApplied * 0.01 * 100) / 100);
  assert.equal(s.totalSaved, Math.round((s.interestSaved - s.commissionCost) * 100) / 100);
  assert.deepEqual(s.commissionByDebt.map((x) => [x.id, x.pct]), [["t", 1]]);
  const conPago = Plan.plan(Path, caro, { ...base, lump: 1000, commissions: [{ id: "t", pct: 1 }] });
  assert.ok(conPago.recommended.summary.commissionByDebt[0].amortizado >= 1000, "el pago inicial también es amortizar");
});

test("DUO-D3 · si la comisión baja pronto, se avisa de cuánto se pagaría de más por no esperar (el plan no lo retrasa solo)", () => {
  const caro = [{ id: "t", entity: "Banco FICTICIO", type: "Tarjeta", paymentStatus: "active", currentPrincipal: 2400, currentPayment: 90, apr: 21.9 }];
  const r = Plan.plan(Path, caro, { ...base, commissions: [{ id: "t", pct: 2, untilMonth: "2027-03", nextPct: 1 }] });
  const w = r.warnings.find((x) => x.id === "comision-baja");
  assert.ok(w);
  assert.equal(w.desde, "2027-03");
  assert.equal(w.antes, 900, "diciembre, enero y febrero: 3 × 300 €");
  assert.equal(w.ahorro, 9, "1 punto de 900 €");
  assert.equal(Plan.plan(Path, caro, { ...base, commissions: [{ id: "t", pct: 2, untilMonth: "2029-03", nextPct: 1 }] }).warnings.some((x) => x.id === "comision-baja"), false, "a más de dos años, no");
});

function cargarCamino(extra = {}) {
  const almacen = new Map(Object.entries(extra.guardado || {}));
  const context = {
    escapeHtml: (v) => String(v), money: (v) => `${Number(v).toFixed(2)} €`,
    storageKey: (k) => `fc:${k}`, storageGet: (k, f) => (almacen.has(k) ? almacen.get(k) : f), storageSet: (k, v) => almacen.set(k, v),
    globalThis: { FinanceDebtComparator: Comparator },
  };
  vm.createContext(context);
  vm.runInContext(read("camino-deuda-ui.js"), context);
  return context;
}

test("DUO-D3 · al amortizar con el pago inicial: reducir plazo o cuota (APX6), y el consejo según la previsión", () => {
  const ui = cargarCamino();
  const r = Plan.plan(Path, contratos, { ...base, lump: 3000 });
  const x = r.recommended.lumpApplied[0];
  assert.equal(x.settles, false);
  const k = Comparator.amortizeReduceQuotaVsTerm({ principal: 5000, annualRatePct: 4.5, months: 36, lumpSum: 3000 });
  const holgada = ui.planOptimoCuotaPlazoHtml(r, contratos, { byMonth: new Array(12).fill(300) }, "prevision");
  assert.match(holgada, /reducir plazo o cuota/);
  assert.ok(holgada.includes(`reducir plazo, ${k.reduceTerm.interestSaved.toFixed(2)} € menos de intereses`));
  assert.ok(holgada.includes(`reducir cuota, ${k.reduceQuota.interestSaved.toFixed(2)} € menos y ${k.reduceQuota.paymentReduction.toFixed(2)} € al mes de liquidez`));
  assert.match(holgada, /Por defecto, <strong>reducir plazo<\/strong>/);
  const justa = ui.planOptimoCuotaPlazoHtml(r, contratos, { byMonth: [300, 0, 300, 300, 300, 300] }, "prevision");
  assert.match(justa, /Con la previsión justa los próximos meses, <strong>reducir cuota<\/strong> da aire/);
  assert.equal(ui.planOptimoCuotaPlazoHtml(Plan.plan(Path, contratos, base), contratos, null, "fijo"), "", "sin pago inicial, nada");
});

test("DUO-D3 · tipo variable (con diferencial en la revisión del tipo): un rango si el Euribor sube o baja un punto", () => {
  const ui = cargarCamino({ guardado: { "fc:rate-review": JSON.stringify({ byContract: { h: { spread: 0.99 } } }) } });
  const r = Plan.plan(Path, contratos, base);
  const html = ui.planOptimoEuriborHtml(Plan, Path, contratos, { ...base, strategy: r.recommended.strategy }, r);
  const sube = Plan.plan(Path, contratos.map((c) => (c.id === "h" ? { ...c, apr: 5 } : c)), { ...base, strategy: r.recommended.strategy }).recommended.summary.debtFreeMonthKey;
  assert.match(html, /Con tipo variable en Banco FICTICIO Hipoteca: si el Euribor sube un punto, libres en/);
  assert.ok(sube > r.recommended.summary.debtFreeMonthKey, "con un punto más, acaba más tarde");
  const sinVariable = cargarCamino();
  assert.equal(sinVariable.planOptimoEuriborHtml(Plan, Path, contratos, base, r), "", "sin tipo variable declarado, nada");
});

test("DUO-D3 · cableado: la lista de comisiones en Deuda › Plan, en la copia, y el plan ya no dice «sin comisiones»", () => {
  const html = read("index.html");
  assert.ok(html.indexOf('id="planOptimoComisiones"') > html.indexOf('id="planOptimoQuitas"'));
  assert.match(html, /<div id="planOptimoComisionesLista"><\/div>/);
  assert.match(read("app.js"), /"plan-optimo-comisiones", \/\/ DUO-D3/);
  const ui = read("camino-deuda-ui.js");
  assert.doesNotMatch(ui, /Sin comisiones por amortizar antes ni cambios de tipo/);
  assert.match(ui, /commissions: planOptimoComisiones\(contracts\)/);
});

test("DUO-D3 · la comisión de una deuda que se cancela con una quita no cuenta, y se dice; sin plazo declarado, se deduce de la cuota", () => {
  const caro = [
    { id: "t", entity: "Banco FICTICIO", type: "Tarjeta", paymentStatus: "active", currentPrincipal: 2400, currentPayment: 90, apr: 21.9 },
    { id: "q", entity: "Caja FICTICIA", type: "Préstamo", paymentStatus: "active", currentPrincipal: 5100, currentPayment: 160, apr: 9.5 },
  ];
  const r = Plan.plan(Path, caro, { ...base, settlements: [{ id: "t", amount: 1500 }], commissions: [{ id: "t", pct: 2 }] });
  assert.ok(r.warnings.some((w) => w.id === "comision-quita" && w.deuda === "t"));
  assert.equal((r.recommended.summary.commissionByDebt || []).some((x) => x.id === "t"), false);
  const ui = cargarCamino();
  assert.match(ui.planOptimoAvisosHtml(r, { available: null }), /La comisión de Banco FICTICIO Tarjeta no cuenta:<\/strong> el plan la cancela con la quita/);
  const conPago = Plan.plan(Path, caro, { ...base, lump: 500 });
  assert.match(ui.planOptimoCuotaPlazoHtml(conPago, caro, null, "fijo"), /<strong>Banco FICTICIO Tarjeta<\/strong> \(500\.00 €\): reducir plazo/, "la tarjeta sin plazo declarado también");
});

test("DUO-D3 · si el Euribor ±1 punto no mueve el mes de fin, también se dice", () => {
  const corta = [{ id: "c", entity: "Caja FICTICIA", type: "Préstamo", paymentStatus: "active", currentPrincipal: 1000, currentPayment: 200, apr: 5 }];
  const ui = cargarCamino({ guardado: { "fc:rate-review": JSON.stringify({ byContract: { c: { spread: 1 } } }) } });
  const r = Plan.plan(Path, corta, base);
  assert.match(ui.planOptimoEuriborHtml(Plan, Path, corta, { ...base, strategy: r.recommended.strategy }, r), /aunque el Euribor suba o baje un punto, acabáis el mismo mes/);
});
