// SVD-6 · fase 1 (18/11/2026, decisión del hogar: «haz la 3 y la 4»): el simulador visual de deuda como pantalla de la app
// (views/deuda-simulador-v2.js). Mismo motor y mismo estado que el simulador de siempre; solo con contratos reales y tema v2.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const V2 = require("../views/deuda-simulador-v2.js");
const Adapter = require("../canonical-e14-debt-adapter.js");
const Motor = require("../legacy-debt-roadmap-engine.js");
const PayoffPath = require("../canonical-debt-payoff-path.js");

const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
const contratos = [
  { id: "debt-custom-1", entity: "Banco FICTICIO", type: "Tarjeta", paymentStatus: "active", currentPrincipal: 2400, currentPayment: 90, apr: 21.9 },
  { id: "debt-custom-2", entity: "Caja FICTICIA", type: "Préstamo", paymentStatus: "active", currentPrincipal: 5100, currentPayment: 160, apr: 9.5 },
];
const forecast = { valid: true, series: [{ monthKey: "2026-11", totals: { closingLiquidity: 9000, income: 3000, outflowsBeforeSaving: 2500 } }] };
const modelo = Adapter.buildReadModel({ contracts: contratos, forecast, payoffPath: PayoffPath, startMonthKey: "2026-11" });

test("SVD-6 · solo con contratos reales: con los de ejemplo («Entidad A/B») sigue el simulador de siempre", () => {
  assert.equal(V2.aplica(modelo), true);
  const ejemplo = Adapter.buildReadModel({ contracts: [{ id: "debt-1", entity: "Entidad A", paymentStatus: "active", currentPrincipal: 4000 }, ...contratos] });
  assert.equal(V2.aplica(ejemplo), false);
  assert.equal(V2.aplica(Adapter.buildReadModel({ contracts: [] })), false);
  assert.equal(V2.aplica(null), false);
});

test("SVD-6 · la configuración es la del simulador de siempre: mismas claves de estado y mismos valores por defecto", () => {
  const vacio = V2.configuracion(modelo, {});
  assert.equal(vacio.months, 60);
  assert.equal(vacio.preserveCash, 1000);
  assert.equal(vacio.baseMonth, "2026-11");
  assert.deepEqual(vacio.cuentas.map((cuenta) => [cuenta.clave, cuenta.bruto.strategy, cuenta.bruto.term, cuenta.bruto.financePct]), [
    ["acct_debt-custom-1", "hold", 12, 100], ["acct_debt-custom-2", "hold", 12, 100],
  ]);
  // La cuota de hoy de cada contrato, como en «Esperar» del de siempre (SVD-2b).
  assert.equal(vacio.cuentas[0].bruto.keepPayment, 90);
  const elegido = V2.configuracion(modelo, { "acct_debt-custom-1_strategy": "settlement", "acct_debt-custom-1_lump": "1500", "acct_debt-custom-1_start": "3", cuotasEnPlan: "si", fc_months: "36" });
  assert.equal(elegido.cuentas[0].bruto.strategy, "settlement");
  assert.equal(elegido.cuentas[0].bruto.lump, 1500);
  assert.equal(elegido.cuotasEnPlan, true);
  assert.equal(elegido.months, 36);
});

test("SVD-6 · la simulación es la del motor: por contrato, cuándo acaba y cuánto paga; en total, lo mismo que el motor", () => {
  const config = V2.configuracion(modelo, { "acct_debt-custom-1_strategy": "settlement", "acct_debt-custom-1_lump": "1500", "acct_debt-custom-1_start": "3" });
  const sim = V2.simular(Motor, config);
  const directo = Motor.simulate({ months: config.months, capacity: config.capacity, baseMonth: config.baseMonth, cuotasEnPlan: false, accounts: config.cuentas.map((cuenta) => cuenta.bruto) });
  assert.equal(sim.totalPagado, directo.totalPaid);
  assert.equal(sim.duracion, directo.durationMonths);
  assert.equal(sim.pico, directo.peak);
  assert.equal(sim.cuentas[0].acaba, 3);
  assert.equal(sim.cuentas[0].pagado, 90 + 90 + 1500);
  assert.equal(sim.cuentas[1].estrategia, "hold");
  assert.equal(sim.cuentas[1].cuotaDeHoy, true);
  assert.equal(sim.deuda, 7500);
});

test("SVD-6 · una deuda sin cuota en «Esperar» no acaba y se dice", () => {
  const sinCuota = Adapter.buildReadModel({ contracts: [{ id: "debt-custom-9", entity: "Otra FICTICIA", paymentStatus: "suspended", currentPrincipal: 900 }], forecast, payoffPath: PayoffPath, startMonthKey: "2026-11" });
  const sim = V2.simular(Motor, V2.configuracion(sinCuota, {}));
  assert.equal(sim.cuentas[0].acaba, null);
  assert.equal(sim.sinFin, true);
});

test("SVD-6 · los meses se escriben en corto y en castellano", () => {
  assert.equal(V2.mesTexto("2026-11", 0), "nov 2026");
  assert.equal(V2.mesTexto("2026-11", 2), "ene 2027");
  assert.equal(V2.mesTexto("", 0), "");
});

test("SVD-6 · en la app: contenedor, script, sin titulares nuevos, el de siempre detrás de «Ver el simulador anterior»", () => {
  const html = read("index.html");
  const vista = read("views/deuda-simulador-v2.js");
  const css = read("tema-v2.css");
  assert.match(html, /<div class="sim-v2" id="deudaSimuladorV2" hidden><\/div>\s*<article class="e19-card" id="deudaSimuladorClasico">/);
  assert.match(html, /<script defer src="views\/deuda-simulador-v2\.js\?v=/);
  assert.doesNotMatch(vista, /<h[1-6]/, "XGO-01: cada contrato es una fila, no un titular");
  assert.match(vista, /data-sim-v2-modo="anterior">Ver el simulador anterior/);
  assert.match(css, /:root\[data-tema="v2"\] #deuda-simulador:has\(> #deudaSimuladorV2:not\(\[hidden\]\):not\(\[data-modo="anterior"\]\)\) > #deudaSimuladorClasico \{\n {2}display: none;/);
  assert.match(read("views/deuda.js"), /if \(typeof renderDeudaSimuladorV2 === "function"\) renderDeudaSimuladorV2\(\);/);
  assert.match(read("tools/build-public-site.mjs"), /\n {2}"views\/deuda-simulador-v2\.js",\n/);
  assert.match(read("service-worker.js"), /"\.\/views\/deuda-simulador-v2\.js",/);
});

test("SVD-6 · no reenvía el estado al de siempre en cada tecla (su eco podría pisar la siguiente)", () => {
  const vista = read("views/deuda-simulador-v2.js");
  const guardar = vista.slice(vista.indexOf("function simV2Guardar("), vista.indexOf("function simV2Fin("));
  assert.doesNotMatch(guardar, /sendDebtRoadmapState\(\)/);
});
