// DUO-D9 (docs/PROPUESTA_DUODECIMA_AUDITORIA_2026-11-23.md): una deuda con los pagos suspendidos (lo que la app trata como impago) y sin
// oferta de quita no entra en el cálculo. La fecha de «libres» tiene que decirlo en la misma cifra, y la nota no puede mandar a «completarla
// en Contratos» (no hay cuota que completar): su salida es una oferta de quita y el kit para hablar con la entidad. Contratos inventados.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const Path = require("../canonical-debt-payoff-path.js");
const Plan = require("../canonical-debt-optimal-plan.js");

const activos = [
  { id: "tarjeta", entity: "Banco FICTICIO", type: "tarjeta", paymentStatus: "active", currentPrincipal: 2400, currentPayment: 90, apr: 21.9 },
  { id: "prestamo", entity: "Caja FICTICIA", type: "préstamo", paymentStatus: "active", currentPrincipal: 5100, currentPayment: 160, apr: 9.5 },
];
const impago = { id: "impago", entity: "Financiera FICTICIA", type: "préstamo", paymentStatus: "suspended", currentPrincipal: 1800, currentPayment: 0 };
const sinTae = { id: "sinTae", entity: "Otra FICTICIA", type: "préstamo", paymentStatus: "active", currentPrincipal: 700, currentPayment: 50, apr: null };
const base = { startMonthKey: "2026-12", monthly: 200 };

function cargarUi() {
  const context = {
    escapeHtml: (value) => String(value),
    money: (value) => `${Number(value).toFixed(2)} €`,
    globalThis: {},
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "camino-deuda-ui.js"), "utf8"), context);
  return context;
}

test("DUO-D9 · el motor marca lo que tiene los pagos suspendidos (sin cambiar el motivo de siempre)", () => {
  const r = Path.project([...activos, impago, sinTae], { startMonthKey: "2026-12" });
  const fuera = Object.fromEntries(r.excluded.map((row) => [row.id, row]));
  assert.equal(fuera.impago.reason, "sin-cuota-activa");
  assert.equal(fuera.impago.suspended, true);
  assert.equal(fuera.sinTae.suspended, undefined, "lo que no tiene datos no es un impago");
});

test("DUO-D9 · el plan dice si la fecha es la de todas las deudas y desglosa lo impagado en el aviso «fuera»", () => {
  const todo = Plan.plan(Path, activos, base);
  assert.equal(todo.completo, true);
  assert.equal(todo.fueraDeLaFecha.count, 0);

  const r = Plan.plan(Path, [...activos, impago, sinTae], base);
  assert.equal(r.completo, false);
  assert.deepEqual(r.fueraDeLaFecha, { count: 2, principal: 2500, enImpago: { count: 1, principal: 1800 } });
  const aviso = r.warnings.find((w) => w.id === "fuera");
  assert.equal(aviso.principal, 2500, "el total de siempre no cambia");
  assert.deepEqual(aviso.datos, { count: 1, principal: 700 });
  assert.equal(aviso.enImpago.count, 1);
  assert.equal(aviso.enImpago.principal, 1800);
  assert.equal(aviso.enImpago.labels.length, 1);
  assert.match(aviso.enImpago.labels[0], /Financiera FICTICIA/);
});

test("DUO-D9 · con su oferta de quita, la deuda en impago entra y la fecha vuelve a ser de todas", () => {
  const r = Plan.plan(Path, [...activos, impago], { ...base, settlements: [{ id: "impago", amount: 1000 }] });
  assert.equal(r.completo, true);
  assert.equal(r.warnings.some((w) => w.id === "fuera"), false);
});

test("DUO-D9 · la cifra protagonista lo dice y la nota da la salida que sirve (no «completadla en Contratos»)", () => {
  const ui = cargarUi();
  const soloImpago = Plan.plan(Path, [...activos, impago], base);
  assert.equal(ui.planOptimoHeroLabel(soloImpago), "Libre de las deudas que entran");
  assert.equal(ui.planOptimoHeroFuera(soloImpago), " · sin contar 1800.00 € con los pagos suspendidos");
  assert.equal(ui.planOptimoHeroLabel(Plan.plan(Path, activos, base)), "Libre de deuda");
  assert.equal(ui.planOptimoHeroFuera(Plan.plan(Path, activos, base)), "");

  const mixto = Plan.plan(Path, [...activos, impago, sinTae], base);
  assert.equal(ui.planOptimoHeroFuera(mixto), " · sin contar 2500.00 € que no entran (1800.00 € con los pagos suspendidos)");
  assert.equal(ui.planOptimoHeroFuera(Plan.plan(Path, [...activos, sinTae], base)), " · solo las deudas con datos");

  const avisos = ui.planOptimoAvisosHtml(mixto, { available: null });
  assert.match(avisos, /Con los pagos suspendidos, fuera de la fecha:/);
  assert.match(avisos, /No tiene cuota que completar en Contratos/);
  assert.match(avisos, /oferta de quita/);
  assert.match(avisos, /kit para hablar con la entidad/);
  assert.match(avisos, /No entran en la cuenta<\/strong> una deuda \(700\.00 €\) sin cuota activa o sin TAE ni plazo/, "lo que sí es falta de datos sigue mandando a Contratos");
  const soloImpagoAvisos = ui.planOptimoAvisosHtml(soloImpago, { available: null });
  assert.doesNotMatch(soloImpagoAvisos, /Completadlas en Contratos/, "a una deuda en impago no se la manda a completar datos");
});

test("DUO-D9 · «Camino a deuda cero» separa también lo impagado de lo que no tiene datos", () => {
  const ui = cargarUi();
  const r = Path.project([...activos, impago, sinTae], { startMonthKey: "2026-12" });
  const html = ui.caminoNotesHtml(r);
  assert.match(html, /No entran en la cuenta:<\/strong> Otra FICTICIA/);
  assert.doesNotMatch(html, /No entran en la cuenta:<\/strong>[^<]*Financiera FICTICIA/);
  assert.match(html, /Con los pagos suspendidos, fuera de la fecha:<\/strong> Financiera FICTICIA/);
  assert.equal(ui.caminoFueraNota(2, 2500, 1, 1800), " · sin contar 2500.00 € que no entran (1800.00 € con los pagos suspendidos)");
});
