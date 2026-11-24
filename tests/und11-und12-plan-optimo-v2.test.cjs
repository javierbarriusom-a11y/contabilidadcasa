// UND-11 y UND-12 (undécima auditoría, plan óptimo v2; 22/11/2026, desbloqueada por D-N23): las quitas dentro del cálculo, por su
// rendimiento equivalente, y el extra de cada mes sacado de la previsión sin bajar del suelo. Contratos y previsiones inventados.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Path = require("../canonical-debt-payoff-path.js");
const Plan = require("../canonical-debt-optimal-plan.js");

const contratos = [
  { id: "tarjeta", entity: "Banco FICTICIO", type: "tarjeta", paymentStatus: "active", currentPrincipal: 2400, currentPayment: 90, apr: 21.9 },
  { id: "prestamo", entity: "Caja FICTICIA", type: "préstamo", paymentStatus: "active", currentPrincipal: 5100, currentPayment: 160, apr: 9.5 },
  { id: "impago", entity: "Financiera FICTICIA", type: "préstamo", paymentStatus: "suspended", currentPrincipal: 3000, currentPayment: 0, apr: 12 },
];
const base = { startMonthKey: "2026-12" };
const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

// Previsión mensual inventada: cada 6 meses un mes de recibos fuertes (−400 €), cada año una paga extra (+1.500 €) y el resto +300 €.
function prevision(meses = 24, apertura = 5000) {
  const rows = [];
  let liquidez = apertura;
  for (let i = 0; i < meses; i += 1) {
    const neto = i % 6 === 0 ? -400 : i % 12 === 6 ? 1500 : 300;
    rows.push({ detailMonthKey: Path.addMonths("2026-12", i), startLiquidity: liquidez, totalLiquidity: liquidez + neto });
    liquidez += neto;
  }
  return rows;
}

test("UND-11 · rendimiento equivalente: exacto con cuotas (la TAE a la que la quita vale las cuotas que quedan) y, sin cuota, lo perdonado entre lo pagado", () => {
  const conCuota = { principal: 2400, payment: 90, monthlyRate: 0.219 / 12, rateSource: "declared" };
  const r = Path.settlementYield(conCuota, 2000);
  assert.equal(r.method, "cuotas");
  assert.ok(r.aprPct > 21.9, `una quita sobre una deuda al 21,9 % rinde más que su TAE: ${r.aprPct}`);
  // Comprobación al revés: al tipo equivalente, las cuotas que quedan valen hoy lo que la quita.
  const meses = (() => { let b = 2400; let n = 0; while (b > 0.005) { b = b * (1 + 0.219 / 12) - 90; n += 1; } return n; })();
  const tasa = r.aprPct / 1200;
  const valorHoy = (90 * (1 - Math.pow(1 + tasa, -meses))) / tasa;
  assert.ok(Math.abs(valorHoy - 2000) < 60, `valor de las cuotas al tipo equivalente ${valorHoy.toFixed(2)} ≈ 2.000 € (la última cuota es menor)`);
  const sinCuota = Path.settlementYield({ principal: 1000, payment: 0, monthlyRate: 0, rateSource: "quita" }, 600);
  assert.deepEqual([sinCuota.method, sinCuota.aprPct, sinCuota.forgiven], ["un-ano", 66.67, 400], "40 % de quita sobre 1.000 €: 400 € por 600 € puestos");
  assert.equal(Path.settlementYield(conCuota, 2400), null, "pagar lo que se debe no es una quita");
  assert.equal(Path.settlementYield(conCuota, 0), null);
});

test("UND-11 · una quita de una deuda en impago entra en el plan, se junta con el extra y lo perdonado cuenta en el ahorro", () => {
  const sin = Plan.plan(Path, contratos, { ...base, monthly: 300 });
  assert.ok(sin.warnings.some((w) => w.id === "fuera"), "sin quita, la deuda sin cuota no entra en la cuenta");
  const r = Plan.plan(Path, contratos, { ...base, monthly: 300, settlements: [{ id: "impago", amount: 1500 }] });
  assert.equal(r.ok, true);
  assert.equal(r.warnings.some((w) => w.id === "fuera"), false, "con su quita sí entra");
  const quita = r.quitas.find((q) => q.id === "impago");
  assert.deepEqual([quita.settled, quita.forgiven, quita.amount, quita.method], [true, 1500, 1500, "un-ano"]);
  // Rinde un 100 %: más que la tarjeta al 21,9 %, así que va primero, y el primer tramo la paga en 5 meses de 300 €.
  assert.equal(r.recommended.periods[0].targetId, "impago");
  assert.equal(r.recommended.periods[0].extraTotal, 1500);
  assert.equal(r.recommended.periods[0].quita.forgiven, 1500);
  assert.equal(r.recommended.periods[0].quita.paid, 1500, "lo que se junta para la quita es lo que pide, no todo lo puesto en el tramo");
  const s = r.recommended.summary;
  assert.equal(s.forgiven, 1500);
  assert.equal(s.totalSaved, Math.round((s.interestSaved + 1500) * 100) / 100, "ahorro = intereses + lo perdonado");
  assert.equal(s.firstPayoff.quita, true);
});

test("UND-11 · el pago inicial va a la quita si es lo primero del orden; si llega, la deuda se cancela el primer mes", () => {
  const r = Plan.plan(Path, contratos, { ...base, monthly: 300, lump: 1500, settlements: [{ id: "impago", amount: 1500 }] });
  assert.deepEqual(r.recommended.lumpApplied, [{ id: "impago", label: "Financiera FICTICIA préstamo", amount: 1500, settles: true, quita: true }]);
  assert.equal(r.quitas[0].payoffMonthKey, "2026-12");
  assert.equal(r.recommended.periods[0].targetId, "tarjeta", "el extra empieza ya por la siguiente");
});

test("UND-11 · si con las cuotas se debe menos de lo ofrecido antes de juntarlo, la quita no perdona nada (y se dice)", () => {
  const r = Plan.plan(Path, contratos.slice(0, 2), { ...base, monthly: 50, settlements: [{ id: "tarjeta", amount: 2300 }] });
  const q = r.quitas.find((x) => x.id === "tarjeta");
  assert.equal(q.settled, true);
  assert.equal(q.forgiven, 0);
  assert.ok(read("camino-deuda-ui.js").includes("no os perdonaría nada"));
});

test("UND-11 · lo que no es quita no entra; una deuda con acuerdo aceptado tampoco; sin quitas, el plan es el de la v1", () => {
  const r = Plan.plan(Path, contratos, { ...base, monthly: 300, settlements: [{ id: "tarjeta", amount: 5000 }] });
  assert.deepEqual(r.quitasIgnoradas, ["tarjeta"]);
  const aceptado = [{ ...contratos[2], agreement: { status: "accepted", startMonth: "2027-01", settlementAmount: 1200 } }];
  assert.deepEqual(Plan.plan(Path, aceptado, { ...base, monthly: 300, settlements: [{ id: "impago", amount: 1000 }] }).quitasIgnoradas, ["impago"]);
  const v1 = Plan.plan(Path, contratos.slice(0, 2), { ...base, monthly: 300 });
  const v2 = Plan.plan(Path, contratos.slice(0, 2), { ...base, monthly: 300, settlements: [], monthlyByMonth: null });
  assert.deepEqual(v2.recommended.summary, v1.recommended.summary);
  assert.deepEqual(v2.recommended.periods, v1.recommended.periods);
});

test("UND-12 · el extra de cada mes sale de la previsión y nunca hace bajar del suelo, ni ese mes ni los siguientes", () => {
  const rows = prevision();
  const lp = Plan.liquidityPlan(rows, { startMonthKey: "2026-12", floor: 4000 });
  assert.equal(lp.ok, true);
  assert.equal(lp.byMonth.length, 24);
  let puesto = 0;
  rows.forEach((row, i) => {
    puesto += lp.byMonth[i];
    assert.ok(row.totalLiquidity - puesto >= 4000, `mes ${i}: ${row.totalLiquidity - puesto} ≥ suelo`);
  });
  // Los meses de recibos fuertes no ponen nada; la paga extra no se pone entera si un mes de recibos posterior la necesita.
  [0, 6, 12, 18].forEach((i) => assert.equal(lp.byMonth[i], 0, `mes ${i} con recibos fuertes`));
  assert.ok(lp.byMonth.some((v) => v > 0) && new Set(lp.byMonth).size > 1, "lo de cada mes cambia");
  // El fijo de comparación tampoco baja del suelo ningún mes.
  rows.forEach((row, i) => assert.ok(row.totalLiquidity - lp.fixedSafe * (i + 1) >= 4000, `fijo ${lp.fixedSafe}, mes ${i}`));
  assert.equal(lp.belowFloor, null);
  // Con el pago inicial, hay menos sitio; con un suelo por encima de la previsión, se avisa y no se pone nada hasta ese mes.
  const conPago = Plan.liquidityPlan(rows, { startMonthKey: "2026-12", floor: 4000, lump: 500 });
  assert.ok(conPago.total12 <= lp.total12);
  const alto = Plan.liquidityPlan(rows, { startMonthKey: "2026-12", floor: 5300 });
  assert.equal(alto.belowFloor.monthKey, "2026-12");
  assert.equal(Plan.liquidityPlan(rows, { startMonthKey: "2027-03-01", floor: 0 }).ok, false);
  assert.equal(Plan.liquidityPlan([], { startMonthKey: "2026-12" }).ok, false, "sin previsión, no hay plan mes a mes");
});

test("UND-12 · el plan con lo de cada mes: tramos con mínimo, máximo y total; con lo mismo cada mes, igual que la v1", () => {
  const lp = Plan.liquidityPlan(prevision(), { startMonthKey: "2026-12", floor: 4000 });
  const r = Plan.plan(Path, contratos.slice(0, 2), { ...base, monthly: lp.after, monthlyByMonth: lp.byMonth });
  assert.equal(r.ok, true);
  const p = r.recommended.periods[0];
  assert.ok(p.extraMin <= p.extra && p.extra <= p.extraMax);
  assert.ok(p.extraMin < p.extraMax, "en el primer tramo hay meses que ponen distinto");
  const constante = Plan.plan(Path, contratos.slice(0, 2), { ...base, monthly: 200, monthlyByMonth: Array(30).fill(200) });
  const v1 = Plan.plan(Path, contratos.slice(0, 2), { ...base, monthly: 200 });
  assert.deepEqual(constante.recommended.summary, v1.recommended.summary);
  assert.equal(r.monthlyByMonth.length, lp.byMonth.length);
});

test("UND-11 y UND-12 · la tarjeta: «lo que permita la previsión» por defecto, importe fijo al escribirlo, y las ofertas de quita", () => {
  const html = read("index.html");
  assert.match(html, /<input type="radio" name="planOptimoModo" value="prevision" checked \/> Lo que permita la previsión \(sin bajar del suelo\)/);
  assert.match(html, /<input type="radio" name="planOptimoModo" value="fijo" \/> Un importe fijo/);
  assert.match(html, /<details class="plan-optimo-margen plan-optimo-quitas" id="planOptimoQuitas">/);
  assert.match(html, /canonical-debt-optimal-plan\.js\?v=20261124duod1/);
  assert.match(html, /canonical-debt-payoff-path\.js\?v=20261123duod9/);
  assert.match(html, /camino-deuda-ui\.js\?v=20261124duod1/);
  const ui = read("camino-deuda-ui.js");
  assert.match(ui, /planOptimoModo = "fijo"; \/\/ UND-12: escribir un importe es elegir el importe fijo/);
  assert.match(ui, /Plan\.liquidityPlan\(refs\.rows/);
  assert.match(ui, /settlements: ofertas/);
  assert.match(ui, /href="#deuda-simulador">Ofertas › Simulador visual<\/a>, que antes os enseña «Qué ocurrirá»/, "no propone desde aquí (decisión 6)");
  assert.match(ui, /PLAN_OPTIMO_QUITAS_KEY = "plan-optimo-quitas"/);
});
