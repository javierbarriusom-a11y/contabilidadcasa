// XDA-10 · PR-3 «Antes de decidir» en los simuladores de inversión que miran los saldos: la aportación a un plan de pensiones (la cuenta
// corriente frente a la reserva protegida, A15-4) y el guardarraíl del simulador de apalancamiento (el colchón frente a su suelo, AP3 y el
// escalonado LEV14, que usa el mismo). Cifras FICTICIAS (repositorio público).
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const F = require("../canonical-decision-freshness.js");
const Q = require("../canonical-data-queue.js");
const P = require("../canonical-pension-simulator.js");
const B = require("../canonical-leverage-barrier.js");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

/** antes-de-decidir-ui.js en un contexto con lo mínimo de app.js: hoy fijo, la función encendida y unos saldos de `edad` días. */
function pantalla({ edad = 12, gastoDiario = 80, encendida = true, auto = false } = {}) {
  const hoy = "2026-11-13";
  const vistas = [];
  const ctx = {
    console,
    Date: class extends Date { constructor(...args) { super(...(args.length ? args : ["2026-11-13T10:00:00"])); } },
    isoLocalDate: () => hoy,
    escapeHtml: (value) => String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;"),
    datosSources: () => ({ balanceMode: auto ? "auto" : "manual", balanceDate: new Date(Date.parse(`${hoy}T00:00:00Z`) - edad * 86400000).toISOString().slice(0, 10), dailyOutflow: gastoDiario }),
  };
  ctx.globalThis = ctx;
  ctx.FinanceCanonicalDecisionFreshness = F;
  ctx.FinanceCanonicalDataQueue = Q;
  ctx.FinanceCanonicalDataAge = { STALE_AFTER_DAYS: 4 };
  ctx.FinanceFuncionesEnPrueba = { encendida: (id) => encendida && id === "antes-de-decidir" };
  ctx.FinanceMedidor = { anotar: (id, que) => vistas.push(`${id}:${que}`) };
  vm.createContext(ctx);
  vm.runInContext(read("antes-de-decidir-ui.js"), ctx);
  return { ctx, vistas };
}

const aportar = (contribution, checkingBalance = 8000, protectedReserve = 5000) =>
  P.simulateContribution({ contribution, year: 2026, marginalRatePercent: 30, checkingBalance, protectedReserve });

test("XDA-10 PR-3 · pensiones: lo que queda sobre la reserva tras aportar, frente a lo que han podido moverse los saldos", () => {
  const { ctx, vistas } = pantalla({ edad: 12, gastoDiario: 80 }); // hasta 960 €
  // 8.000 − 5.000 − 2.500 = 500 € sobre la reserva: 960 € le dan la vuelta.
  const justo = ctx.antesDeDecidirPensionHtml(aportar(2500));
  assert.match(justo, /data-antes-decidir="yes"/);
  assert.match(justo, /Antes de decidir, actualiza los saldos \(de hace 12 días\): pueden haberse movido hasta 960 € y el resultado cambia con 500 €\./);
  assert.match(justo, /<a href="#visual-detail" data-antes-decidir-ir>Actualizar saldos<\/a>/);
  assert.deepEqual(vistas, ["antes-de-decidir:vista"]);
  // 2.000 € de margen: no cambia, y sin enlace.
  const holgado = ctx.antesDeDecidirPensionHtml(aportar(1000));
  assert.match(holgado, /data-antes-decidir="no"/);
  assert.match(holgado, /no cambia el resultado/);
  assert.doesNotMatch(holgado, /<a /);
  // Rompe la reserva: solo cambiaría si ha entrado dinero, y eso no se estima.
  const rota = ctx.antesDeDecidirPensionHtml(aportar(4000));
  assert.equal(aportar(4000).breaksReserve, true);
  assert.match(rota, /data-antes-decidir="unknown"/);
  assert.match(rota, /eso no lo estimo/);
});

test("XDA-10 PR-3 · pensiones: sin saldo con que medir, con saldos al día, por calendario o apagada", () => {
  const sinSaldo = P.simulateContribution({ contribution: 1000, year: 2026, marginalRatePercent: 30 });
  assert.equal(sinSaldo.marginAfter, null);
  assert.equal(pantalla().ctx.antesDeDecidirPensionHtml(sinSaldo), "", "sin veredicto de saldos, nada");
  assert.equal(pantalla({ edad: 2 }).ctx.antesDeDecidirPensionHtml(aportar(2500)), "", "saldos de hace 2 días: al día");
  assert.equal(pantalla({ encendida: false }).ctx.antesDeDecidirPensionHtml(aportar(2500)), "");
  // Saldos por calendario: sin fecha, no se sabe cuánto se han movido.
  assert.match(pantalla({ auto: true }).ctx.antesDeDecidirPensionHtml(aportar(2500)), /data-antes-decidir="unknown"[^>]*>Antes de decidir, conviene actualizar los saldos \(sin fecha\): no sé cuánto han podido moverse\./);
});

test("XDA-10 PR-3 · apalancamiento: el colchón frente a su suelo, y nada si el guardarraíl lo para otra cosa", () => {
  const { ctx } = pantalla({ edad: 12, gastoDiario: 80 }); // hasta 960 €
  const barrera = (cushion, extra = {}) => B.evaluateLeverageBarrier({ cushion, debtQualityIssues: [], monthlyIncome: 4000, monthlyDebtService: 800, ...extra });
  const justo = { value: 9500, floor: 9000 }; // 500 € sobre el suelo
  const superado = barrera(justo);
  assert.equal(superado.valid, true);
  const linea = ctx.antesDeDecidirApalancamientoHtml(superado, justo);
  assert.match(linea, /data-antes-decidir="yes"/);
  assert.match(linea, /el resultado cambia con 500 €/);
  assert.match(linea, /El guardarraíl de arriba es con estos datos/);
  // Holgado: no cambia.
  const holgado = { value: 20000, floor: 9000 };
  assert.match(ctx.antesDeDecidirApalancamientoHtml(barrera(holgado), holgado), /data-antes-decidir="no"/);
  // Solo lo para el colchón: cambiaría si ha entrado dinero.
  const corto = { value: 8000, floor: 9000 };
  const parado = barrera(corto);
  assert.deepEqual(parado.blockers.map((item) => item.id), ["cushion-below-floor"]);
  assert.match(ctx.antesDeDecidirApalancamientoHtml(parado, corto), /data-antes-decidir="unknown"/);
  // Lo para la cuota de la deuda actual (con el colchón bien o mal): unos saldos frescos no lo cambian.
  assert.equal(ctx.antesDeDecidirApalancamientoHtml(barrera(justo, { monthlyDebtService: 2000 }), justo), "");
  assert.equal(ctx.antesDeDecidirApalancamientoHtml(barrera(corto, { monthlyDebtService: 2000 }), corto), "");
  // Sin colchón calculado, o con los saldos al día, nada.
  const sinColchon = { value: NaN, floor: 9000 };
  assert.equal(ctx.antesDeDecidirApalancamientoHtml(barrera(sinColchon), sinColchon), "");
  assert.equal(pantalla({ edad: 1 }).ctx.antesDeDecidirApalancamientoHtml(superado, justo), "");
});

test("XDA-10 PR-3 · app.js pide la línea al pintar los dos veredictos, sin líneas nuevas", () => {
  const app = read("app.js");
  const barrera = app.slice(app.indexOf("function renderAp3BarrierStatus()"), app.indexOf("let ap3LastResult"));
  assert.match(barrera, /const input = ap3LeverageBarrierInput\(\), result = engine\.evaluateLeverageBarrier\(input\);/);
  assert.match(barrera, /\+ \(globalThis\.antesDeDecidirApalancamientoHtml\?\.\(result, input\.cushion\) \|\| ""\);/);
  const pension = app.slice(app.indexOf("function handleA154SimulatePension()"), app.indexOf("function householdSplitSettings()"));
  assert.match(pension, /\$\{reserveLine\}\$\{globalThis\.antesDeDecidirPensionHtml\?\.\(result\) \|\| ""\}`;/);
  // El escalonado (LEV14) usa el mismo guardarraíl: la línea sale una vez, en su caja.
  assert.match(app.slice(app.indexOf("function handleLev14Simulate()")), /const barrierResult = renderAp3BarrierStatus\(\);/);
});
