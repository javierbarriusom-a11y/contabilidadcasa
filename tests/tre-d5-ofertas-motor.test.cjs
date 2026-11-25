// TRE-D5a (decimotercera §2.5b; D-N44): el veredicto de una oferta frente al plan, con el motor del plan óptimo y la misma salida al mes.
// Contratos FICTICIOS (los del arranque en caliente).
const test = require("node:test");
const assert = require("node:assert/strict");
const O = require("../canonical-debt-offers.js");
const Plan = require("../canonical-debt-optimal-plan.js");
const Path = require("../canonical-debt-payoff-path.js");

const contratos = [
  { id: "t", entity: "Banco FICTICIO", label: "Banco FICTICIO Tarjeta", paymentStatus: "active", currentPrincipal: 2400, currentPayment: 90, apr: 21.9 },
  { id: "p", entity: "Caja FICTICIA", label: "Caja FICTICIA Préstamo", paymentStatus: "active", currentPrincipal: 5100, currentPayment: 160, apr: 9.5 },
];
const opciones = { startMonthKey: "2026-12", monthly: 200 };
const e = { Plan, Path, contratos, opciones };

test("TRE-D5a · cuota de un préstamo francés y meses", () => {
  assert.equal(O.cuotaPrestamo(1200, 0, 12), 100);
  assert.equal(O.cuotaPrestamo(7650, 7.9, 48), 186.4);
  assert.equal(O.sumarMeses("2026-12", 12), "2027-12");
});

test("TRE-D5a · traspaso al 0 %: la comisión se suma, la promoción y la TAE de después; compensa frente a la tarjeta al 21,9 %", () => {
  const a = O.aplicar({ tipo: "traspaso", contratoId: "t", meses: 12, taeDespues: 18, comisionPct: 3 }, contratos, "2026-12");
  assert.equal(a.comision, 72);
  assert.equal(a.contratos.find((c) => c.id === "t").currentPrincipal, 2472);
  assert.deepEqual(a.promotions, [{ id: "t", untilMonth: "2027-12", aprPct: 0 }]);
  const v = O.veredicto({ tipo: "traspaso", contratoId: "t", meses: 12, taeDespues: 18, comisionPct: 3 }, e);
  assert.equal(v.tono, "compensa");
  assert.ok(v.diferencia > 100);
  assert.match(O.titular(v), /^Os compensa: \d+ € menos$/);
  // Con 600 € al mes la tarjeta se salda dentro de los 12 meses al 0 %: la TAE de después no cuenta, y se dice.
  const rapido = O.veredicto({ tipo: "traspaso", contratoId: "t", meses: 12, taeDespues: 18, comisionPct: 3 }, { ...e, opciones: { ...opciones, monthly: 600 } });
  assert.equal(rapido.promoSaldada, true);
  assert.equal(O.veredicto({ tipo: "traspaso", contratoId: "t", meses: 3, taeDespues: 18, comisionPct: 3 }, e).promoSaldada, false, "con 3 meses al 0 % no da tiempo");
});

test("TRE-D5a · reunificación: la misma salida al mes (lo que baja la cuota se pone de más); a 7,9 % y 48 meses compensa, a 12 % y 96 no", () => {
  const buena = O.veredicto({ tipo: "reunificacion", tin: 7.9, plazo: 48, comision: 150 }, e);
  assert.equal(buena.cuota, 186.4);
  assert.equal(buena.cuotasHoy, 250);
  assert.equal(buena.extra, 63.6);
  assert.equal(buena.tono, "compensa");
  const mala = O.veredicto({ tipo: "reunificacion", tin: 12, plazo: 96, comision: 300 }, e);
  assert.equal(mala.tono, "no");
  assert.match(O.titular(mala), /^No os compensa: \d+ € más$/);
  assert.equal(O.veredicto({ tipo: "reunificacion", tin: 7, plazo: 48 }, { ...e, contratos: contratos.slice(0, 1) }).ok, false);
});

test("TRE-D5a · quita: juntándola no compensa (la deuda baja antes de llegar); de golpe, con la misma salida de caja, sí", () => {
  const v = O.veredicto({ tipo: "quita", contratoId: "t", importe: 1900 }, { ...e, disponible: 2850 });
  assert.equal(v.tono, "no");
  assert.equal(v.deGolpe.tono, "compensa");
  assert.ok(v.deGolpe.perdonado > 400);
  assert.equal(v.deGolpe.alcanza, true);
  assert.match(O.quitaFrase(v), /^Juntándola con lo de cada mes no compensa: la deuda baja antes de llegar al importe; pagándola de golpe con la caja, os compensa: \d+ € menos\. Os llega sin bajar del suelo\.$/);
  assert.match(O.quitaFrase(O.veredicto({ tipo: "quita", contratoId: "t", importe: 1900 }, { ...e, disponible: 500 })), /no llega\.$/);
});

test("TRE-D5a · lo guardado: tipos conocidos, estado por fecha; y lo que no se puede calcular se dice", () => {
  const l = O.normalizar([
    { id: "a", tipo: "traspaso", vence: "2026-12-15" },
    { id: "b", tipo: "reunificacion", vence: "2026-11-01" },
    { id: "c", tipo: "quita", estado: "rechazada" },
    { id: "d", tipo: "inventada" },
  ], "2026-11-25");
  assert.deepEqual(l.map((o) => `${o.id}:${o.estado}:${o.dias}`), ["a:abierta:20", "b:vencida:-24", "c:rechazada:null"]);
  assert.equal(O.veredicto({ tipo: "quita", contratoId: "no-existe", importe: 100 }, e).ok, false);
  assert.match(O.veredicto({ tipo: "traspaso", contratoId: "t" }, e).motivo, /Faltan los meses/);
  for (const t of Object.values(O.TIPOS)) assert.ok(t.trampa.length > 60, "cada tipo con su letra pequeña");
});
