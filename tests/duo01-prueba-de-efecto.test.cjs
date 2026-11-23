// DUO-01 · D-N34 (duodécima auditoría, 23/11/2026; decisión del hogar: «ok»): todo control de una pantalla v2 mueve alguna cifra o dice por
// qué no. La prueba en navegador está en qa1 («DUO-01 · Prueba de efecto de los controles»); aquí, el registro y los dos arreglos que salieron
// al montarla. Contratos inventados.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const Efecto = require("./helpers/efecto-controles.cjs");
const Path = require("../canonical-debt-payoff-path.js");
const Plan = require("../canonical-debt-optimal-plan.js");
const V2 = require("../views/deuda-simulador-v2.js");
const Adapter = require("../canonical-e14-debt-adapter.js");
const Motor = require("../legacy-debt-roadmap-engine.js");

const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

test("DUO-01 · el registro: cada efecto y cada excepción son de una pantalla del censo, y cada excepción dice por qué", () => {
  const pantallas = new Set(Efecto.PANTALLAS.map((p) => p.nombre));
  for (const item of [...Efecto.EFECTOS, ...Efecto.EXCEPCIONES]) assert.ok(pantallas.has(item.pantalla), `${item.pantalla} no está en el censo`);
  for (const item of Efecto.EFECTOS) {
    assert.ok(item.nombre && item.control && item.observa && item.accion?.tipo, `efecto incompleto: ${JSON.stringify(item.nombre)}`);
  }
  for (const item of Efecto.EXCEPCIONES) assert.ok(String(item.motivo || "").length >= 20, `excepción sin motivo razonado: ${item.clave}`);
  // Las ocho pantallas v2 de UND-01 más la tarjeta del escenario, donde nació D-N33.
  assert.ok(pantallas.has("Ajustes › Escenario de supuestos"));
  assert.ok(Efecto.EFECTOS.some((item) => item.pantalla === "Ajustes › Escenario de supuestos" && /prudente/.test(item.control)));
});

test("DUO-01 · el censo: lo que no está registrado sale; una familia (expresión regular) cubre a todos sus controles", () => {
  assert.deepEqual(Efecto.sinCubrir("Deuda › Plan", ["#planOptimoPago", "#controlNuevo"]), ["#controlNuevo"]);
  assert.deepEqual(Efecto.sinCubrir("Hoy", ["#hoyV2Tab-mes", "#hoyV2Tab-caja"]), []);
  assert.deepEqual(Efecto.sinCubrir("Deuda › Ofertas › Simulador visual", ["radio:[data-sim-v2-campo]=hold", "radio:[data-sim-v2-campo]=refi"]), []);
  assert.equal(Efecto.coincide("#a", "#a"), true);
  assert.equal(Efecto.coincide("#ab", /^#a$/), false);
});

function cargarCaminoUi() {
  const context = { escapeHtml: (v) => String(v), money: (v) => `${Number(v).toFixed(2)} €`, globalThis: {} };
  vm.createContext(context);
  vm.runInContext(read("camino-deuda-ui.js"), context);
  return context;
}

test("DUO-01 · cuando los dos órdenes dan lo mismo, el plan lo dice (cambiar orden o margen no mueve ninguna cifra)", () => {
  const ui = cargarCaminoUi();
  // La tarjeta es la más cara y la más pequeña: avalancha y bola de nieve coinciden.
  const coinciden = [
    { id: "tarjeta", entity: "Banco FICTICIO", paymentStatus: "active", currentPrincipal: 2400, currentPayment: 90, apr: 21.9 },
    { id: "prestamo", entity: "Caja FICTICIA", paymentStatus: "active", currentPrincipal: 5100, currentPayment: 160, apr: 9.5 },
  ];
  const r = Plan.plan(Path, coinciden, { startMonthKey: "2026-12", monthly: 200 });
  assert.equal(ui.planOptimoOrdenesCoinciden(r), true);
  assert.match(ui.planOptimoRazonHtml(r), /<strong>Orden recomendado: avalancha\.<\/strong> Con vuestras deudas, los dos órdenes coinciden: la más cara es también la más pequeña/);
  const una = Plan.plan(Path, coinciden.slice(0, 1), { startMonthKey: "2026-12", monthly: 200 });
  assert.match(ui.planOptimoRazonHtml(una), /solo hay una deuda en la cuenta/);
  // La más cara es la grande: los órdenes difieren y se explica la avalancha como siempre.
  const difieren = [
    { id: "grande", entity: "Banco FICTICIO", paymentStatus: "active", currentPrincipal: 6000, currentPayment: 150, apr: 24 },
    { id: "pequena", entity: "Caja FICTICIA", paymentStatus: "active", currentPrincipal: 900, currentPayment: 60, apr: 6 },
  ];
  const d = Plan.plan(Path, difieren, { startMonthKey: "2026-12", monthly: 200 });
  assert.equal(ui.planOptimoOrdenesCoinciden(d), false);
  assert.match(ui.planOptimoRazonHtml(d), /avalancha<\/strong>, primero la deuda más cara/);
});

test("DUO-01 · simulador: «las cuotas de hoy ya están en el plan» cambia lo que se ve (el margen más justo y el aviso de capacidad)", () => {
  const contratos = [
    { id: "debt-custom-1", entity: "Banco FICTICIO", type: "Tarjeta", paymentStatus: "active", currentPrincipal: 2400, currentPayment: 90, apr: 21.9 },
    { id: "debt-custom-2", entity: "Caja FICTICIA", type: "Préstamo", paymentStatus: "active", currentPrincipal: 5100, currentPayment: 160, apr: 9.5 },
  ];
  const forecast = { valid: true, series: [{ monthKey: "2026-11", totals: { closingLiquidity: 9000, income: 3000, outflowsBeforeSaving: 2500 } }] };
  const modelo = Adapter.buildReadModel({ contracts: contratos, forecast, payoffPath: Path, startMonthKey: "2026-11" });
  const sin = V2.simular(Motor, V2.configuracion(modelo, {}));
  const con = V2.simular(Motor, V2.configuracion(modelo, { cuotasEnPlan: "si" }));
  assert.equal(sin.cuotasEnPlan, false);
  assert.equal(con.cuotasEnPlan, true);
  assert.equal(con.margenMinimo - sin.margenMinimo, 250, "en «Esperar», el margen deja de restar las dos cuotas de hoy (90 + 160)");
  assert.equal(sin.margenMinimo, Math.round((sin.capacidad - sin.pico) * 100) / 100, "sin la casilla, el margen es la capacidad menos el pago total, como antes");
  const src = read("views/deuda-simulador-v2.js");
  assert.match(src, /const caro = sim\.margenMinimo === null \|\| sim\.margenMinimo === undefined \? sim\.pico > sim\.capacidad : sim\.margenMinimo < 0;/);
  assert.match(src, /margen más justo \$\{simV2Euro\(sim\.margenMinimo\)\}\$\{sim\.cuotasEnPlan \? ", sin restar las cuotas de hoy" : ""\}/);
});
