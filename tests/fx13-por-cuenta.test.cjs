// FX-13 (10/11/2026) · la previsión por cuenta y el traspaso sugerido: cuando la cuenta corriente baja de su mínimo con el total sano y el
// ahorro alcanza, la Previsión propone el traspaso (traspasar menos al ahorro, si basta, o pasar del ahorro antes del día), a 0 €, sin
// mover nada. Cifras INVENTADAS.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const Contract = require("../canonical-forecast-contract.js");
const Stress = require("../canonical-stress-scenarios.js");

function vista({ reserva = 0, guardado = null } = {}) {
  const almacen = new Map(guardado ? [["prevision-v2-vista", guardado]] : []);
  const sandbox = {
    console,
    document: { readyState: "loading", addEventListener() {}, documentElement: { dataset: {} } },
    localStorage: { getItem: (k) => (almacen.has(k) ? almacen.get(k) : null), setItem: (k, v) => almacen.set(k, String(v)) },
    money: (n) => `${String(Math.round(Number(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ".")} €`,
    escapeHtml: (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"),
    FinanceCanonicalForecastContract: Contract,
    FinanceCanonicalStressScenarios: Stress,
    state: { operatingReserve: reserva },
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(read("views/prevision-v2.js"), sandbox);
  return sandbox;
}

const hoy = "2026-11-10";
const fila = (date, checking, savings, events = []) => ({ date, total: checking + savings, checking, savings, events });

test("FX-13 · la cuenta corriente baja de su mínimo con el total sano: pasar del ahorro antes del día, a 0 €", () => {
  const v = vista();
  const tramo = [fila("2026-11-10", 1200, 6000), fila("2026-11-20", -800, 6000), fila("2026-11-30", 2500, 6000)];
  const html = v.previsionV2TraspasoHtml({ tramo, floor: 1500, today: hoy });
  assert.match(html, /Para que la cuenta corriente no se quede corta el 20 nov/);
  assert.match(html, /Pasar unos 800 € del ahorro a la cuenta corriente antes del 20 nov<\/span><strong>0 €<\/strong>/);
  assert.doesNotMatch(html, /menos al ahorro/, "sin traspaso al ahorro antes, no se propone");
  assert.match(html, /La app no mueve dinero: el traspaso lo hacéis en el banco\./);
  assert.match(html, /data-prevision-v2-vista="cuentas">Ver por cuenta</);
  assert.doesNotMatch(html, /<h[1-6]/, "sin titular nuevo (XGO-01)");
});

test("FX-13 · si basta con traspasar menos al ahorro el día de antes, va primero", () => {
  const v = vista();
  const traspaso = { kind: "transfer", label: "Traspaso INVENTADO", beforeChecking: 3000, checking: 1000 };
  const tramo = [fila("2026-11-10", 3000, 6000), fila("2026-11-15", 1000, 8000, [traspaso]), fila("2026-11-20", -500, 8000)];
  const html = v.previsionV2TraspasoHtml({ tramo, floor: 1500, today: hoy });
  const opciones = [...html.matchAll(/<li><span>([^<]+)<\/span>/g)].map((m) => m[1]);
  assert.equal(opciones.length, 2);
  assert.match(opciones[0], /^Traspasar unos 500 € menos al ahorro el 15 nov \(«Traspaso INVENTADO»\)$/);
  assert.match(opciones[1], /^Pasar unos 500 € del ahorro a la cuenta corriente antes del 20 nov$/);
});

test("FX-13 · no sale si la cuenta no baja, si el total baja del suelo (es otro problema: el arreglo más barato) o si el ahorro no alcanza", () => {
  const v = vista();
  assert.equal(v.previsionV2TraspasoHtml({ tramo: [fila("2026-11-10", 1000, 6000)], floor: 1500, today: hoy }), "");
  assert.equal(v.previsionV2TraspasoHtml({ tramo: [fila("2026-11-10", -800, 1000)], floor: 1500, today: hoy }), "", "total 200 € bajo el suelo");
  assert.equal(v.previsionV2TraspasoHtml({ tramo: [fila("2026-11-10", -800, 500)], floor: 0, today: hoy }), "", "el ahorro no alcanza");
  // Con reserva operativa, el mínimo es la reserva.
  const conReserva = vista({ reserva: 1000 });
  assert.match(conReserva.previsionV2TraspasoHtml({ tramo: [fila("2026-11-10", 1500, 6000), fila("2026-11-20", 400, 6000)], floor: 1500, today: hoy }), /Pasar unos 600 € del ahorro/);
});

test("FX-13 · el conmutador lee la vista de este dispositivo (Total por defecto) y no añade titulares", () => {
  assert.equal(vista().previsionV2Vista(), "total");
  assert.equal(vista({ guardado: "cuentas" }).previsionV2Vista(), "cuentas");
  assert.equal(vista({ guardado: "otra" }).previsionV2Vista(), "total");
  const html = vista({ guardado: "cuentas" }).previsionV2VistaHtml();
  assert.match(html, /data-prevision-v2-vista="cuentas" aria-pressed="true">Por cuenta</);
  assert.match(html, /data-prevision-v2-vista="total" aria-pressed="false">Total</);
});
