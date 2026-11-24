// DUO-D8 (duodécima auditoría; adelantada por D-N39): una deuda con promoción al 0 % hasta un mes. El motor no cobra intereses hasta
// entonces (en el plan y en el calendario de hoy) y el plan dice si se salda antes o cuánto quedará cuando empiece a cobrar su TAE.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const Path = require("../canonical-debt-payoff-path.js");
const Plan = require("../canonical-debt-optimal-plan.js");

const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
const c = [
  { id: "t", entity: "Banco FICTICIO", type: "Tarjeta", paymentStatus: "active", currentPrincipal: 2400, currentPayment: 90, apr: 21.9 },
  { id: "q", entity: "Caja FICTICIA", type: "Préstamo", paymentStatus: "active", currentPrincipal: 5100, currentPayment: 160, apr: 9.5 },
];
const base = { startMonthKey: "2026-12", monthly: 200 };

test("DUO-D8 · el motor no cobra intereses durante la promoción y anota lo que queda el último mes", () => {
  const sin = Path.project(c, { startMonthKey: "2026-12", extraMonthly: 0 });
  const con = Path.project(c, { startMonthKey: "2026-12", extraMonthly: 0, promotions: [{ id: "t", untilMonth: "2027-06", aprPct: 0 }] });
  const ts = sin.included.find((r) => r.id === "t");
  const tc = con.included.find((r) => r.id === "t");
  assert.ok(tc.interest < ts.interest);
  assert.equal(tc.promoSaldo, 2400 - 6 * 90, "seis cuotas sin intereses (diciembre a mayo)");
  assert.equal(sin.included.find((r) => r.id === "t").promoSaldo, undefined);
});

test("DUO-D8 · el ahorro del plan se mide contra un calendario de hoy que también tiene la promoción", () => {
  const r = Plan.plan(Path, c, { ...base, promotions: [{ id: "t", untilMonth: "2027-06", aprPct: 0 }] });
  const hoy = Path.project(c, { startMonthKey: "2026-12", extraMonthly: 0, promotions: [{ id: "t", untilMonth: "2027-06", aprPct: 0 }] });
  assert.equal(r.baseline.totalInterest, hoy.totalInterest);
  assert.equal(r.recommended.summary.interestSaved, Math.round((hoy.totalInterest - r.recommended.summary.totalInterest) * 100) / 100);
});

test("DUO-D8 · el aviso: cuánto quedará al acabar la promoción (y cuánto más al mes la saldaría), o que se salda antes", () => {
  const r = Plan.plan(Path, c, { ...base, promotions: [{ id: "t", untilMonth: "2027-06", aprPct: 0 }] });
  const w = r.warnings.find((x) => x.id === "promocion");
  assert.deepEqual([w.deuda, w.hasta, w.meses, w.saldada, w.saldoAlAcabar], ["t", "2027-06", 6, false, 660]);
  const holgado = Plan.plan(Path, c, { ...base, monthly: 600, promotions: [{ id: "t", untilMonth: "2027-06", aprPct: 0 }] });
  assert.equal(holgado.warnings.find((x) => x.id === "promocion").saldada, true);
  assert.equal(Plan.plan(Path, c, { ...base, promotions: [{ id: "t", untilMonth: "2026-11", aprPct: 0 }] }).warnings.some((x) => x.id === "promocion"), false, "una promoción ya acabada no cuenta");
  const ctx = { escapeHtml: (v) => String(v), money: (v) => `${Number(v).toFixed(2)} €`, globalThis: {} };
  vm.createContext(ctx);
  vm.runInContext(read("camino-deuda-ui.js"), ctx);
  assert.match(ctx.planOptimoAvisosHtml(r, { available: null }), /Al acabar la promoción de Banco FICTICIO Tarjeta \(junio de 2027\) quedarán 660\.00 €<\/strong> al 21,9 %\. Con unos 110\.00 € más al mes hasta entonces, la dejaríais a cero antes\./);
  assert.match(ctx.planOptimoAvisosHtml(holgado, { available: null }), /se salda antes de que acabe su promoción al 0 %/);
});

test("DUO-D8 · cableado: el mes de la promoción, en el grupo de cada contrato, y al plan", () => {
  const ui = read("camino-deuda-ui.js");
  assert.match(ui, /<span>Al 0 % hasta \(mes, si tiene promoción\)<\/span><input type="month" \$\{campo\("promoHasta", ""\)\}/);
  assert.match(ui, /promotions: planOptimoPromociones\(contracts\),/);
  assert.match(read("index.html"), /<summary>Comisión por amortizar antes y promociones \(si las hay\)<\/summary>/);
});
