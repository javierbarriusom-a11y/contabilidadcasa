// DUO-D1 · D-N35 (duodécima auditoría, 24/11/2026): el seguimiento del plan de deuda. La app busca en los movimientos el pago de más de cada
// mes; si lo encuentra lo da por hecho y lo dice; si no, pregunta (de uno en uno). Contratos y movimientos inventados.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const Path = require("../canonical-debt-payoff-path.js");
const Plan = require("../canonical-debt-optimal-plan.js");
const Receipts = require("../canonical-debt-receipts.js");
const S = require("../seguimiento-plan-deuda.js");

const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
const contratos = [
  { id: "t", entity: "Banco FICTICIO", number: "12345678", paymentStatus: "active", currentPrincipal: 2400, currentPayment: 90, apr: 21.9 },
  { id: "p", entity: "Caja FICTICIA", paymentStatus: "active", currentPrincipal: 5100, currentPayment: 160, apr: 9.5 },
];
const plan = Plan.plan(Path, contratos, { startMonthKey: "2026-12", monthly: 300 });
const foto = S.compromiso(plan, contratos, "2026-12-01");
const seg = (movimientos, hoy, extra = {}) => S.seguimiento(foto, { movimientos, contratos, hoy, lenderOf: Receipts.lenderOf, ...extra });
const estados = (r, n = 4) => r.filas.slice(0, n).map((f) => [f.mes, f.estado, f.real]);

test("DUO-D1 · la foto del plan: cada mes, a qué deuda va lo de más, cuánto (extra y cuotas liberadas) y su cuota", () => {
  assert.equal(foto.schemaId, S.SCHEMA_ID);
  assert.equal(foto.guardadoEl, "2026-12-01");
  assert.equal(foto.desde, "2026-12");
  assert.equal(foto.fechaLibre, plan.recommended.summary.debtFreeMonthKey);
  assert.deepEqual(foto.meses[0], { mes: "2026-12", id: "t", label: "Banco FICTICIO", cuota: 90, extra: 300, ultimo: false, quita: false });
  // Saldada la tarjeta, su cuota de 90 € se suma a lo de más del préstamo.
  const prestamo = foto.meses.find((m) => m.id === "p");
  assert.equal(prestamo.extra, 390);
  assert.equal(prestamo.cuota, 160);
  assert.equal(foto.meses.filter((m) => m.ultimo).length, 2, "un último mes por tramo");
  assert.ok(plan.recommended.periods.every((p) => Array.isArray(p.pools) && p.pools.length === p.toIndex - p.fromIndex + 1), "el motor del plan da lo de cada mes");
  assert.equal(S.compromiso({ ok: false }, contratos, "2026-12-01"), null);
});

test("DUO-D1 · lo encontrado en el extracto se da por hecho (por referencia o por entidad); a medias, parcial; sin encontrar, se pregunta", () => {
  const movs = [
    { date: "2026-12-05", movement: "RECIBO PRESTAMO 12345678", amount: -390 }, // por la referencia del contrato: cuota + 300
    { date: "2027-01-05", movement: "RECIBO BANCO FICTICIO", amount: -90 },
    { date: "2027-01-20", movement: "TRANSFERENCIA BANCO FICTICIO AMORTIZACION", amount: -150 }, // por la entidad: 150 de más
    { date: "2027-02-05", movement: "RECIBO BANCO FICTICIO", amount: -90 }, // solo la cuota
    { date: "2026-12-10", movement: "SUPER FICTICIO", amount: -60 }, // no es del contrato
  ];
  const r = seg(movs, "2027-03-10");
  assert.deepEqual(estados(r), [["2026-12", "hecho", 300], ["2027-01", "parcial", 150], ["2027-02", "preguntar", null], ["2027-03", "en-curso", null]]);
  assert.equal(r.filas[0].fuente, "detectado");
  assert.deepEqual(r.filas[0].movimientos.map((m) => m.concepto), ["RECIBO PRESTAMO 12345678"]);
  assert.equal(r.pregunta.mes, "2027-02", "se pregunta el mes más antiguo sin encontrar");
  assert.equal(r.pendientes, 1);
  assert.equal(r.ultimoDetectado.mes, "2027-01");
  assert.equal(r.filas[4].estado, "futuro");
});

test("DUO-D1 · el margen: hasta un 10 % (o 10 €) por debajo cuenta como hecho", () => {
  assert.equal(seg([{ date: "2026-12-05", movement: "BANCO FICTICIO", amount: -365 }], "2027-01-20").filas[0].estado, "hecho", "275 de 300");
  assert.equal(seg([{ date: "2026-12-05", movement: "BANCO FICTICIO", amount: -350 }], "2027-01-20").filas[0].estado, "parcial", "260 de 300");
});

test("DUO-D1 · un pago de más hecho a primeros del mes siguiente cuenta para el mes al que le faltaba, sin contarlo dos veces", () => {
  const movs = [
    { date: "2026-12-05", movement: "BANCO FICTICIO", amount: -90 },
    { date: "2027-01-03", movement: "BANCO FICTICIO AMORTIZACION", amount: -300 }, // de diciembre
    { date: "2027-01-05", movement: "BANCO FICTICIO", amount: -390 }, // enero completo
  ];
  const r = seg(movs, "2027-02-10");
  assert.deepEqual(estados(r, 2), [["2026-12", "hecho", 300], ["2027-01", "hecho", 300]]);
  // La cuota normal de primeros de mes no cuenta como «de más» del anterior.
  const soloCuota = seg([{ date: "2026-12-05", movement: "BANCO FICTICIO", amount: -90 }, { date: "2027-01-02", movement: "BANCO FICTICIO", amount: -90 }], "2027-02-10");
  assert.equal(soloCuota.filas[0].estado, "preguntar");
});

test("DUO-D1 · el mes que acaba de cerrar espera los días de gracia antes de preguntar; el mes en curso nunca pregunta", () => {
  assert.equal(seg([], "2027-01-04").filas[0].estado, "en-curso", "el 4 de enero, diciembre aún puede tener su pago de más");
  assert.equal(seg([], "2027-01-06").filas[0].estado, "preguntar");
  assert.equal(seg([{ date: "2026-12-05", movement: "BANCO FICTICIO", amount: -200 }], "2026-12-20").filas[0].estado, "en-curso", "a medias, pero el mes no ha acabado");
});

test("DUO-D1 · las respuestas mandan: sí, otra cantidad, este mes no; «no era esto» quita lo encontrado y vuelve a preguntar", () => {
  const movs = [{ date: "2026-12-05", movement: "BANCO FICTICIO", amount: -390 }];
  const respuestas = { "2027-01": { tipo: "si" }, "2027-02": { tipo: "otra", importe: 120 }, "2027-03": { tipo: "no" } };
  const r = seg(movs, "2027-04-10", { respuestas });
  assert.deepEqual(estados(r), [["2026-12", "hecho", 300], ["2027-01", "hecho", 300], ["2027-02", "parcial", 120], ["2027-03", "no", 0]]);
  assert.equal(r.filas[1].fuente, "respuesta");
  assert.equal(r.racha, 0, "el último mes cerrado fue «no»: la racha se corta (sin culpas en el texto)");
  assert.equal(r.pregunta, null);
  const noEra = seg(movs, "2027-01-10", { respuestas: { "2026-12": { tipo: "no-era" } } });
  assert.equal(noEra.filas[0].estado, "preguntar");
  assert.equal(noEra.ultimoDetectado, null);
});

test("DUO-D1 · racha y desviación salen de los meses cerrados", () => {
  const movs = ["2026-12", "2027-01", "2027-02"].map((mes) => ({ date: `${mes}-05`, movement: "BANCO FICTICIO", amount: -390 }));
  const r = seg(movs, "2027-03-10");
  assert.equal(r.racha, 3);
  assert.equal(r.previsto, 900);
  assert.equal(r.hecho, 900);
  assert.equal(r.desviacion, 0);
});

test("DUO-D1 · la entidad que reconoce el motor de recibos también vale (abreviaturas del banco)", () => {
  const conAbrev = [{ id: "c", entity: "Cetelem", paymentStatus: "active", currentPrincipal: 1000, currentPayment: 50, apr: 18 }];
  const fotoC = S.compromiso(Plan.plan(Path, conAbrev, { startMonthKey: "2026-12", monthly: 100 }), conAbrev, "2026-12-01");
  const r = S.seguimiento(fotoC, { movimientos: [{ date: "2026-12-04", movement: "REC. CETELEM SA", amount: -150 }], contratos: conAbrev, hoy: "2027-01-10", lenderOf: Receipts.lenderOf });
  assert.equal(r.filas[0].estado, "hecho");
});

function cargarUi(extra = {}) {
  const almacen = new Map();
  const context = {
    escapeHtml: (v) => String(v), money: (v) => `${Number(v).toFixed(2)} €`, isoLocalDate: () => extra.hoy || "2026-12-29",
    storageKey: (k) => `fc:${k}`, storageGet: (k, f) => (almacen.has(k) ? almacen.get(k) : f), storageSet: (k, v) => almacen.set(k, v),
    baseData: { transactions: extra.movs || [] }, escenarioMotorDebtOptions: () => contratos,
    globalThis: { FinanceSeguimientoPlanDeuda: S, FinanceCanonicalDebtReceipts: Receipts },
  };
  vm.createContext(context);
  vm.runInContext(read("seguimiento-plan-ui.js"), context);
  return { ui: context, almacen };
}

test("DUO-D1 · la pantalla: sin plan, «Este es nuestro plan»; con plan, la pregunta del mes sin encontrar y lo encontrado con «No era esto»", () => {
  const { ui, almacen } = cargarUi({ movs: [{ date: "2026-12-05", movement: "BANCO FICTICIO", amount: -390 }], hoy: "2027-02-10" });
  assert.match(vm.runInContext("segSinPlanHtml", ui)(plan), /data-seg-guardar>Este es nuestro plan</);
  almacen.set("fc:plan-deuda-compromiso", JSON.stringify(foto));
  const r = vm.runInContext("segSeguimiento", ui)(foto, contratos);
  const html = vm.runInContext("segConPlanHtml", ui)(foto, r, plan);
  assert.match(html, /<strong>Vuestro plan<\/strong>, guardado el 1 de dic: libres en/);
  assert.match(html, /<strong>En ene 27 tocaba poner 300\.00 € de más en Banco FICTICIO\.<\/strong> No lo he encontrado en los extractos/);
  assert.match(html, /data-seg-responder="si" data-seg-mes="2027-01">Sí</);
  assert.match(html, /data-seg-otra data-seg-mes="2027-01"/);
  assert.match(html, /data-seg-responder="no" data-seg-mes="2027-01">Este mes no</);
  assert.match(html, /He encontrado 300\.00 € de más a Banco FICTICIO .*No era esto/);
  assert.match(html, /Un mes sin poner de más es una decisión, no un fallo/);
  assert.doesNotMatch(html, /<h[1-6]/, "sin titular nuevo (XGO-01)");
});

test("DUO-D1 · Hoy: la pregunta en «Decidir esta semana» solo desde el 28/12 (D-N30) y solo con un mes sin encontrar", () => {
  const { ui, almacen } = cargarUi({ hoy: "2027-01-10" });
  almacen.set("fc:plan-deuda-compromiso", JSON.stringify(foto));
  assert.equal(vm.runInContext('seguimientoPlanHoy("2026-12-27")', ui).length, 0, "antes del 28/12, nada (el 21/12 entran los extractos atrasados)");
  const items = vm.runInContext('seguimientoPlanHoy("2027-01-10")', ui);
  assert.equal(items.length, 1);
  assert.equal(items[0].target, "deuda-ruta");
  assert.match(items[0].title, /¿Pusisteis de más en Banco FICTICIO en dic 26\?/);
  const sinPlan = cargarUi({ hoy: "2027-01-10" });
  assert.equal(vm.runInContext('seguimientoPlanHoy("2027-01-10")', sinPlan.ui).length, 0);
});

test("DUO-D1 · cableado: contenedor bajo el plan, scripts, hoja, service worker, build, copia y Hoy", () => {
  const html = read("index.html");
  assert.ok(html.indexOf('id="planSeguimiento"') > html.indexOf('id="planOptimoResultado"'));
  assert.match(html, /<script defer src="seguimiento-plan-deuda\.js\?v=20261124duod1"><\/script>\s*<script defer src="seguimiento-plan-ui\.js\?v=20261124duod1"><\/script>/);
  assert.match(html, /seguimiento-plan\.css\?v=20261124duod1/);
  const sw = read("service-worker.js");
  ["./seguimiento-plan-deuda.js", "./seguimiento-plan-ui.js", "./seguimiento-plan.css"].forEach((f) => assert.ok(sw.includes(`"${f}"`), f));
  const build = read("tools/build-public-site.mjs");
  ["seguimiento-plan-deuda.js", "seguimiento-plan-ui.js", "seguimiento-plan.css"].forEach((f) => assert.ok(build.includes(`"${f}"`), f));
  const app = read("app.js");
  assert.match(app, /"plan-deuda-compromiso", \/\/ DUO-D1/);
  assert.match(app, /"plan-deuda-respuestas", \/\/ DUO-D1/);
  assert.match(read("camino-deuda-ui.js"), /globalThis\.renderSeguimientoPlan\?\.\(planOptimoResultadoUltimo, contracts \|\| \[\]\);/);
});
