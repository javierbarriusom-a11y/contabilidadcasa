// SVD-2b (17/11/2026, docs/SVD_DISENO.md): «Esperar» sigue pagando la cuota de hoy y el simulador visual de deuda cuadra con
// «Camino a deuda cero» (Deuda › Ruta). Contratos INVENTADOS.
const test = require("node:test");
const assert = require("node:assert/strict");
const E14 = require("../canonical-e14-debt-adapter.js");
const Ruta = require("../canonical-debt-payoff-path.js");
const Motor = require("../legacy-debt-roadmap-engine.js");

const CARTERA = [
  { id: "t", entity: "Banco FICTICIO", type: "Tarjeta", currentPrincipal: 2400, apr: 21.9, currentPayment: 90, remainingInstallments: 40, paymentStatus: "active" },
  { id: "p", entity: "Caja FICTICIA", type: "Préstamo", currentPrincipal: 5100, apr: null, currentPayment: 160, remainingInstallments: 36, paymentStatus: "active" },
  { id: "s", entity: "Financiera FICTICIA", type: "Préstamo", currentPrincipal: 3000, apr: 9, currentPayment: 0, paymentStatus: "suspended", paymentsSuspended: true, arrearsEstimated: 600 },
];
const forecast = { schemaId: "f", fingerprint: "f", valid: true, series: [{ monthKey: "2026-12", totals: { income: 3000, outflowsBeforeSaving: 2400, closingLiquidity: 8000 } }] };

function modelo(cartera = CARTERA) {
  return E14.buildReadModel({ contracts: cartera, forecast, payoffPath: Ruta, generatedAt: "2026-11-17T00:00:00.000Z" });
}

// Lo que el simulador manda al motor por cada cuenta real (debt-roadmap.html, currentConfig).
function cuenta(deuda, estrategia = { strategy: "hold" }) {
  const hoy = deuda.cuotaDeHoy;
  return { amount: deuda.currentPrincipal, strategy: "hold", start: 1, ...estrategia, keepPayment: hoy?.payment ?? 0, keepRate: hoy ? hoy.monthlyRate : null, keepTolerance: hoy?.tolerance ?? 0 };
}

test("la cuota de hoy sale con las reglas de Ruta: declarada, deducida del plazo, o fuera (y por qué)", () => {
  const [tarjeta, prestamo, suspendido] = modelo().extraDebts;
  assert.deepEqual(tarjeta.cuotaDeHoy, { payment: 90, monthlyRate: 21.9 / 100 / 12, tolerance: 0.005, source: "declared" });
  assert.equal(prestamo.cuotaDeHoy.source, "implied");
  assert.equal(prestamo.cuotaDeHoy.monthlyRate, Ruta.impliedMonthlyRate(5100, 160, 36));
  assert.equal(suspendido.cuotaDeHoy, null);
  assert.equal(suspendido.fueraDeRuta, "sin-cuota-activa");
  // Sin el motor de Ruta no se inventa un tipo: el préstamo sin TAE queda fuera.
  const sinRuta = E14.buildReadModel({ contracts: CARTERA, forecast });
  assert.equal(sinRuta.extraDebts[1].cuotaDeHoy, null);
  assert.equal(sinRuta.ruta, null);
});

test("con todas en «Esperar», el simulador acaba el mismo mes y paga lo mismo que Ruta", () => {
  const m = modelo();
  assert.equal(m.ruta.startMonthKey, "2026-12");
  assert.deepEqual(m.ruta.included.sort(), ["p", "t"]);
  assert.deepEqual(m.ruta.excluded, [{ id: "s", reason: "sin-cuota-activa" }]);
  const r = Motor.simulate({ months: 120, capacity: 600, baseMonth: "2026-12", accounts: m.extraDebts.map((d) => cuenta(d)) });
  assert.equal(r.durationMonths, m.ruta.monthsToDebtFree, "mismo número de meses hasta deuda cero");
  assert.equal(r.totalPaid, m.ruta.totalPaid, "mismo total pagado (capital + intereses)");
  // Cada contrato, el mismo mes que en Ruta.
  const rutaCompleta = Ruta.project(CARTERA, { startMonthKey: "2026-12", extraMonthly: 0 });
  m.extraDebts.forEach((deuda, i) => {
    const fila = rutaCompleta.included.find((row) => row.id === deuda.id);
    const ultimo = r.rows.findIndex((row) => row.balances[i] === 0 && row.payments[i] > 0);
    assert.equal(fila ? fila.payoffIndex : null, ultimo === -1 ? null : ultimo, deuda.entity);
  });
});

test("el suspendido no paga en «Esperar» (como en Ruta) y el margen resta las cuotas salvo que ya estén en el plan", () => {
  const m = modelo();
  const accounts = m.extraDebts.map((d) => cuenta(d));
  const fuera = Motor.simulate({ months: 12, capacity: 600, accounts });
  assert.equal(fuera.rows[0].payments[2], 0);
  assert.equal(fuera.rows[0].cuotas, 250);
  assert.equal(fuera.rows[0].margin, 350);
  const dentro = Motor.simulate({ months: 12, capacity: 600, accounts, cuotasEnPlan: true });
  assert.equal(dentro.rows[0].margin, 600, "si el plan ya las paga, el margen no las vuelve a restar");
});

test("una quita en el mes 4 paga la cuota hasta entonces y se calcula sobre lo que queda ese mes", () => {
  const [tarjeta] = modelo().extraDebts;
  const r = Motor.simulate({ months: 12, capacity: 600, accounts: [cuenta(tarjeta, { strategy: "settlement", start: 4, discount: 40 })] });
  assert.deepEqual(r.rows.slice(0, 3).map((row) => row.payments[0]), [90, 90, 90]);
  let saldo = 2400;
  for (let mes = 1; mes < 4; mes += 1) saldo = Motor.keepMonth(saldo, r.accounts[0]).balance;
  assert.equal(r.rows[3].payments[0], Math.round(saldo * 0.6 * 100) / 100, "el 60 % de lo que queda, no de 2.400 €");
  assert.equal(r.rows[3].balances[0], 0);
  assert.deepEqual(r.rows.slice(4).map((row) => row.payments[0]), Array(8).fill(0));
});

test("sin cuota de hoy (la cuenta de antes), el motor hace exactamente lo de siempre", () => {
  const antes = Motor.simulate({ months: 24, capacity: 900, accounts: [{ amount: 4000, strategy: "refi", discount: 10, start: 2, lump: 300, apr: 8, term: 18, financePct: 100 }] });
  assert.equal(antes.accounts[0].keep, false);
  assert.ok(antes.rows.every((row) => row.cuotas === 0));
  assert.equal(antes.rows[0].payments[0], 0);
  assert.equal(antes.rows[1].payments[0] > 300, true);
});
