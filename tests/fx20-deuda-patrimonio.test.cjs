// FX-20, versión completa (10/11/2026) · la deuda y el patrimonio a 24 meses en el plan y en la prueba (canonical-debt-horizon.js).
// Cifras INVENTADAS. Las cuentas se pueden rehacer a mano: un préstamo sin interés baja la cuota exacta cada mes.
const test = require("node:test");
const assert = require("node:assert/strict");

const H = require("../canonical-debt-horizon.js");
const scenarioEngine = require("../canonical-scenario-engine.js");

const inicio = "2026-11";
const meta = "2028-11"; // 24 meses
const sinInteres = { id: "d-cero", entity: "Préstamo", type: "INVENTADO", currentPrincipal: 6000, currentPayment: 100, apr: 0, remainingInstallments: 60, paymentStatus: "active" };
const hipoteca = { id: "d-hipo", entity: "Hipoteca", type: "INVENTADA", currentPrincipal: 120000, currentPayment: 640, apr: 3.34, remainingInstallments: 266, paymentStatus: "active" };

test("FX-20 · el plan: el calendario francés de cada deuda a 24 meses; sin TAE ni plazo no se inventa y se dice", () => {
  const plan = H.planDebt([sinInteres, hipoteca, { id: "d-x", entity: "Tarjeta", currentPrincipal: 900, currentPayment: 50, apr: null, remainingInstallments: 0, paymentStatus: "active" }, { id: "d-ok", currentPrincipal: 0, paymentStatus: "settled" }], { startMonthKey: inicio, targetMonthKey: meta });
  assert.equal(plan.items.find((item) => item.id === "d-cero").balance, 3600, "6.000 − 24 × 100");
  const h = plan.items.find((item) => item.id === "d-hipo").balance;
  // Fórmula cerrada del calendario francés: P·(1+r)^n − c·((1+r)^n − 1)/r, con r = 3,34 %/12 y n = 24.
  const r = 3.34 / 100 / 12;
  const cerrada = 120000 * Math.pow(1 + r, 24) - 640 * ((Math.pow(1 + r, 24) - 1) / r);
  assert.ok(Math.abs(h - cerrada) < 0.5, `hipoteca a 24 meses: ${h} frente a ${cerrada}`);
  assert.deepEqual(plan.excluded.map((item) => [item.id, item.reason]), [["d-x", "sin-tae-ni-plazo"]]);
  assert.equal(plan.total, Math.round((3600 + h) * 100) / 100);
  // Pagos suspendidos: la deuda no baja.
  assert.equal(H.planDebt([{ ...sinInteres, paymentStatus: "suspended" }], { startMonthKey: inicio, targetMonthKey: meta }).total, 6000);
});

test("FX-20 · un escenario: amortizar 2.000 € en ene 2027 baja la deuda 2.000 € (sin interés) y sin decisiones es el plan", () => {
  const decision = { id: "dec_amortiza", tipo: "amortizacion", orden: 0, activa: true, planificacion: { modo: "manual", mesManual: "2027-01" }, params: { deudaId: "d-cero", importe: 2000, parcial: true } };
  const resolved = scenarioEngine.resolveEscenario([decision], { baseInput: { months: ["2026-11", "2026-12", "2027-01"].map((monthKey) => ({ monthKey, income: 0, coreSpend: 0 })) }, debtContracts: [sinInteres] });
  const plan = H.planDebt([sinInteres], { startMonthKey: inicio, targetMonthKey: meta });
  const prueba = H.scenarioDebt([sinInteres], resolved.debtStateFinal, [decision], { startMonthKey: inicio, targetMonthKey: meta });
  assert.equal(prueba.total, plan.total - 2000);
  assert.equal(H.scenarioDebt([sinInteres], [], [], { startMonthKey: inicio, targetMonthKey: meta }).total, plan.total, "sin decisiones, el plan");
  // Amortizar todo cierra la deuda: a cero.
  const total = { ...decision, params: { deudaId: "d-cero", importe: 6000 } };
  const cerrada = scenarioEngine.resolveEscenario([total], { baseInput: { months: [{ monthKey: "2027-01", income: 0, coreSpend: 0 }] }, debtContracts: [sinInteres] });
  assert.equal(H.scenarioDebt([sinInteres], cerrada.debtStateFinal, [total], { startMonthKey: inicio, targetMonthKey: meta }).total, 0);
});

test("FX-20 · lo que crea un escenario: préstamo nuevo, compra financiada, préstamo de la familia y lo que os deben", () => {
  const decisiones = [
    { id: "n1", tipo: "deuda_nueva", activa: true, planificacion: { modo: "manual", mesManual: "2027-01" }, params: { principal: 1200, cuota: 100, plazo: 12, mes: "2027-01" } },
    { id: "n2", tipo: "prestamo_familiar", activa: true, params: { direccion: "nos_prestan", importe: 3000, mes: "2027-01", devolucionMensual: 100, meses: 30 } },
    { id: "n3", tipo: "prestamo_familiar", activa: true, params: { direccion: "prestamos", importe: 1000, mes: "2027-01" } },
  ];
  const prueba = H.scenarioDebt([], [], decisiones, { startMonthKey: inicio, targetMonthKey: meta });
  // El préstamo de 1.200 € en 12 cuotas de 100 €: a 22 meses de su mes ya está pagado. La familia: 3.000 − 21 × 100.
  assert.equal(prueba.items.find((item) => item.id === "n1").balance, 0);
  assert.equal(prueba.items.find((item) => item.id === "n2").balance, 900);
  assert.equal(prueba.total, 900);
  assert.equal(prueba.receivables, 1000, "lo que os deben suma al patrimonio");
});

test("FX-20 · Euribor: con la cuota más alta se amortiza menos y se debe más; con la cuota de siempre, nada", () => {
  // La cuota nueva es la anualidad de 118.000 € a 5,34 % en 262 plazos; la de siempre, 640 €.
  const n = 262;
  const r2 = 5.34 / 100 / 12;
  const to = Math.round(((118000 * r2 * Math.pow(1 + r2, n)) / (Math.pow(1 + r2, n) - 1)) * 100) / 100;
  const shock = { date: "2027-03-01", from: 640, to, extra: to - 640, rate: 5.34, months: n, principal: 118000 };
  const delta = H.euriborDelta([shock], { targetMonthKey: meta });
  // Con la fórmula cerrada: capital tras 21 cuotas con la nueva menos con la de siempre (al tipo que la explica).
  const r1 = H.impliedMonthlyRate(118000, 640, n);
  const saldo = (rate, cuota, k) => 118000 * Math.pow(1 + rate, k) - cuota * ((Math.pow(1 + rate, k) - 1) / rate);
  const esperado = saldo(r2, to, 21) - saldo(r1, 640, 21);
  assert.ok(Math.abs(delta - esperado) < 1, `se debe más a 24 meses: ${delta} frente a ${esperado}`);
  // Lo que la tabla de caja no veía: con la cuota recalculada al mismo plazo, más parte de cada cuota se va en intereses. Aquí la deuda
  // queda unos 1.300 € por encima del plan, la mitad de lo que baja la caja (≈ 2.600 €): el coste real es un 50 % mayor.
  assert.ok(delta > 1200 && delta < 1450, `deuda de más: ${delta}`);
  assert.ok(delta / (shock.extra * 21) > 0.4, "una parte grande del coste, no un redondeo");
  assert.equal(H.euriborDelta([{ ...shock, extra: 0 }], { targetMonthKey: meta }), 0);
  assert.equal(H.euriborDelta([shock], { targetMonthKey: "2027-01" }), 0, "la revisión cae después");
  assert.equal(H.euriborDelta([{ ...shock, principal: 0 }], { targetMonthKey: meta }), 0, "sin capital no se calcula");
});

test("FX-20 · patrimonio = liquidez − deuda + lo que os deben; la diferencia separa caja y deuda", () => {
  const nw = H.netWorth({ planLiquidity: 20000, testLiquidity: 10000, plan: { total: 50000 }, test: { total: 40000, receivables: 500 } });
  assert.deepEqual(nw, { plan: -30000, test: -29500, diff: 500, debtDiff: -10000, liquidityDiff: -10000 });
  assert.equal(H.netWorth({ planLiquidity: NaN, testLiquidity: 1, plan: { total: 0 }, test: { total: 0 } }), null);
  assert.equal(H.monthsBetween("2026-11", "2028-11"), 24);
});

test("FX-20 · lo que el plan ya amortiza cuenta en el plan y en la prueba: de golpe o repartido", () => {
  const golpe = [{ id: "d-cero", monthKey: "2027-01", amount: 1000 }];
  const plan = H.planDebt([sinInteres], { startMonthKey: inicio, targetMonthKey: meta, planned: golpe });
  assert.equal(plan.total, 3600 - 1000, "6.000 − 24 × 100 − 1.000");
  // Repartido en 4 meses (250 € cada uno), el mismo total a 24 meses.
  const repartido = H.planDebt([sinInteres], { startMonthKey: inicio, targetMonthKey: meta, planned: [{ ...golpe[0], months: 4 }] });
  assert.equal(repartido.total, 2600);
  // El escenario se superpone al plan: conserva lo planificado y suma lo suyo.
  const decision = { id: "dec_amortiza", tipo: "amortizacion", orden: 0, activa: true, planificacion: { modo: "manual", mesManual: "2027-03" }, params: { deudaId: "d-cero", importe: 500, parcial: true } };
  const resolved = scenarioEngine.resolveEscenario([decision], { baseInput: { months: ["2026-11", "2026-12", "2027-01", "2027-02", "2027-03"].map((monthKey) => ({ monthKey, income: 0, coreSpend: 0 })) }, debtContracts: [sinInteres] });
  const prueba = H.scenarioDebt([sinInteres], resolved.debtStateFinal, [decision], { startMonthKey: inicio, targetMonthKey: meta, planned: golpe });
  assert.equal(prueba.total, 2600 - 500);
  // Amortizar más de lo que queda deja la deuda a cero, nunca en negativo.
  assert.equal(H.planDebt([sinInteres], { startMonthKey: inicio, targetMonthKey: meta, planned: [{ id: "d-cero", monthKey: "2026-12", amount: 99999 }] }).total, 0);
});
