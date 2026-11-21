// Plan óptimo de saldo de deuda (21/11/2026): sobre «Camino a deuda cero» (mismo motor), con las cuotas liberadas redirigidas, un pago
// inicial opcional y la elección entre avalancha y bola de nieve. Contratos inventados.
const test = require("node:test");
const assert = require("node:assert/strict");
const Path = require("../canonical-debt-payoff-path.js");
const Plan = require("../canonical-debt-optimal-plan.js");

const contratos = [
  { id: "tarjeta", entity: "Banco FICTICIO", type: "tarjeta", paymentStatus: "active", currentPrincipal: 2400, currentPayment: 90, apr: 21.9 },
  { id: "prestamo", entity: "Caja FICTICIA", type: "préstamo", paymentStatus: "active", currentPrincipal: 5100, currentPayment: 160, apr: 9.5 },
  { id: "coche", entity: "Financiera FICTICIA", type: "coche", paymentStatus: "active", currentPrincipal: 900, currentPayment: 75, apr: 7 },
];
const base = { startMonthKey: "2026-12" };

test("con extra y cuotas liberadas acaba antes y paga menos intereses que el calendario actual (y que el extra sin redirigir)", () => {
  const r = Plan.plan(Path, contratos, { ...base, monthly: 200 });
  assert.equal(r.ok, true);
  const s = r.recommended.summary;
  assert.ok(s.monthsSaved > 0 && s.interestSaved > 0, JSON.stringify(s));
  const sinRedirigir = Path.project(contratos, { ...base, extraMonthly: 200, strategy: r.recommended.strategy });
  assert.ok(s.totalInterest < sinRedirigir.totalInterest, "redirigir las cuotas liberadas ahorra más");
  // El primer tramo lleva los 200 € a la primera del orden; los siguientes, más (las cuotas liberadas).
  assert.equal(r.recommended.periods[0].extra, 200);
  for (let i = 1; i < r.recommended.periods.length; i += 1) assert.ok(r.recommended.periods[i].extra >= r.recommended.periods[i - 1].extra);
});

test("avalancha por defecto; la bola de nieve solo si cuesta muy poco más y salda antes la primera deuda", () => {
  const r = Plan.plan(Path, contratos, { ...base, monthly: 200 });
  const av = r.recommended.strategy === "avalancha" ? r.recommended : r.alternative;
  const bn = r.recommended.strategy === "bola-nieve" ? r.recommended : r.alternative;
  assert.ok(av.summary.totalInterest <= bn.summary.totalInterest, "la avalancha nunca paga más intereses");
  const tol = Math.max(Plan.SNOWBALL_TOLERANCE.abs, av.summary.totalInterest * Plan.SNOWBALL_TOLERANCE.pct);
  const eligeBola = bn.summary.totalInterest - av.summary.totalInterest <= tol && bn.summary.firstPayoff.payoffIndex < av.summary.firstPayoff.payoffIndex;
  assert.equal(r.recommended.strategy, eligeBola ? "bola-nieve" : "avalancha");
  assert.equal(r.diferenciaAlternativa, Math.round((r.alternative.summary.totalInterest - r.recommended.summary.totalInterest) * 100) / 100, "intereses de la otra menos los de la recomendada");
});

test("el pago inicial rebaja el capital en el orden de ataque y avisa si pasa de lo disponible o de la capacidad", () => {
  const r = Plan.plan(Path, contratos, { ...base, monthly: 600, lump: 3000, capacity: 450, available: 2000, order: ["tarjeta", "prestamo", "coche"] });
  const av = r.recommended.strategy === "avalancha" ? r.recommended : r.alternative;
  assert.deepEqual(av.lumpApplied.map((x) => [x.id, x.amount, x.settles]), [["tarjeta", 2400, true], ["prestamo", 600, false]]);
  assert.deepEqual(r.warnings.map((w) => w.id).sort(), ["por-encima-capacidad", "por-encima-disponible"]);
  const sinPago = Plan.plan(Path, contratos, { ...base, monthly: 600, order: ["tarjeta", "prestamo", "coche"] });
  assert.ok(r.recommended.summary.totalInterest < sinPago.recommended.summary.totalInterest);
});

test("lo que no tiene cuota o TAE no entra (se avisa); sin deudas, nada que planear; los acuerdos aceptados no se adelantan", () => {
  const conFuera = [...contratos, { id: "sin", entity: "X", paymentStatus: "suspended", currentPrincipal: 1000, currentPayment: 0 }];
  assert.ok(Plan.plan(Path, conFuera, { ...base, monthly: 100 }).warnings.some((w) => w.id === "fuera" && w.principal === 1000));
  assert.equal(Plan.plan(Path, [], { ...base, monthly: 100 }).nothing, true);
  const pactado = contratos.map((c) => (c.id === "tarjeta" ? { ...c, agreement: { status: "accepted", startMonth: "2026-12", settlementAmount: 1200 } } : c));
  const r = Plan.plan(Path, pactado, { ...base, monthly: 200, lump: 500 });
  assert.ok(!r.recommended.lumpApplied.some((x) => x.id === "tarjeta"), "a lo pactado no se le adelanta nada");
  assert.ok(!r.recommended.periods.some((p) => p.targetId === "tarjeta"));
});

test("sin extra ni pago inicial, pero con las cuotas liberadas, ya mejora el calendario actual; y no toca los contratos", () => {
  const copia = JSON.parse(JSON.stringify(contratos));
  const r = Plan.plan(Path, contratos, { ...base, monthly: 0, lump: 1000 });
  assert.ok(r.recommended.summary.interestSaved > 0);
  assert.deepEqual(contratos, copia, "puro: no cambia lo que recibe");
  assert.equal(Plan.plan(null, contratos, base).ok, false);
});
