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

test("avalancha por defecto; la bola de nieve no se elige sola: se pregunta si cuesta muy poco más y salda antes la primera (D-N27)", () => {
  const r = Plan.plan(Path, contratos, { ...base, monthly: 200 });
  assert.equal(r.recommended.strategy, "avalancha", "sin elegir, siempre la avalancha");
  assert.equal(r.chosen, null);
  const av = r.recommended;
  const bn = r.alternative;
  assert.ok(av.summary.totalInterest <= bn.summary.totalInterest, "la avalancha nunca paga más intereses");
  const tol = Math.max(Plan.SNOWBALL_TOLERANCE.abs, av.summary.totalInterest * Plan.SNOWBALL_TOLERANCE.pct);
  const sugiere = bn.summary.totalInterest - av.summary.totalInterest <= tol && bn.summary.firstPayoff.payoffIndex < av.summary.firstPayoff.payoffIndex;
  assert.equal(r.pregunta, sugiere);
  assert.equal(Boolean(r.sugerencia), sugiere);
  if (sugiere) assert.equal(r.sugerencia.monthsEarlier, av.summary.firstPayoff.payoffIndex - bn.summary.firstPayoff.payoffIndex);
  assert.equal(r.diferenciaAlternativa, Math.round((r.alternative.summary.totalInterest - r.recommended.summary.totalInterest) * 100) / 100, "intereses de la otra menos los de la enseñada");
});

test("D-N27 · el orden elegido manda y se puede cambiar; ya elegido, no se vuelve a preguntar", () => {
  const margenAncho = { pct: 0.5, abs: 100000 };
  const sinElegir = Plan.plan(Path, contratos, { ...base, monthly: 200, tolerance: margenAncho });
  assert.equal(sinElegir.pregunta, true, "con un margen muy ancho siempre se pregunta (la más pequeña acaba antes)");
  assert.equal(sinElegir.recommended.strategy, "avalancha");
  const bola = Plan.plan(Path, contratos, { ...base, monthly: 200, tolerance: margenAncho, strategy: "bola-nieve" });
  assert.equal(bola.recommended.strategy, "bola-nieve");
  assert.equal(bola.recommended.reason, "elegida-bola-nieve");
  assert.equal(bola.pregunta, false);
  assert.ok(bola.diferenciaAlternativa <= 0, "la avalancha (la otra) no paga más");
  const vuelta = Plan.plan(Path, contratos, { ...base, monthly: 200, tolerance: margenAncho, strategy: "avalancha" });
  assert.equal(vuelta.recommended.strategy, "avalancha");
  assert.equal(vuelta.pregunta, false);
  assert.equal(Plan.plan(Path, contratos, { ...base, monthly: 200, strategy: "otra" }).chosen, null, "lo que no es un orden no cuenta");
});

test("D-N27 · el margen lo pone el hogar: con 0 € y 0 % solo se pregunta si no cuesta nada más", () => {
  const cero = Plan.plan(Path, contratos, { ...base, monthly: 200, tolerance: { pct: 0, abs: 0 } });
  const coste = cero.alternative.summary.totalInterest - cero.recommended.summary.totalInterest;
  assert.equal(cero.pregunta, coste <= 0 && cero.alternative.summary.firstPayoff.payoffIndex < cero.recommended.summary.firstPayoff.payoffIndex);
  assert.deepEqual(cero.tolerance, { pct: 0, abs: 0 });
  assert.deepEqual(Plan.tolerance({ pct: 2, abs: -5 }), Plan.SNOWBALL_TOLERANCE, "fuera de rango, el de siempre");
  assert.deepEqual(Plan.tolerance(null), Plan.SNOWBALL_TOLERANCE);
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
