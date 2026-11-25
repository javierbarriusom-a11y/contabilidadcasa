// TRE-D3 · D-N42 (25/11/2026, «sí» del hogar): colchón primero. Bajo la reserva protegida, lo de más se queda en el colchón hasta llegar a
// ella; con alguna deuda por encima del umbral de TAE (15 % de entrada, editable), a medias con esa deuda; después, lo de siempre. Nunca
// pone más que el plan de partida (que ya respeta el suelo). Previsión y contratos FICTICIOS.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Plan = require("../canonical-debt-optimal-plan.js");
const V = require("../views/deuda-plan-v2.js");
const { codigoApp } = require("./helpers/codigo-app.cjs");

const raiz = path.join(__dirname, "..");
// Liquidez prevista de noviembre a marzo: empieza en 6.500 € (bajo una reserva de 7.230 €) y sube con el ahorro de cada mes.
const filas = [["2026-11", 6000, 6500], ["2026-12", 6500, 6000], ["2027-01", 7000, 6500], ["2027-02", 7600, 7000], ["2027-03", 8200, 7600]]
  .map(([monthKey, totalLiquidity, startLiquidity]) => ({ monthKey, totalLiquidity, startLiquidity }));
const tarjeta = { id: "t", currentPrincipal: 2400, apr: 21.9, label: "Banco FICTICIO Tarjeta" };
const prestamo = { id: "p", currentPrincipal: 5100, apr: 9.5, label: "Caja FICTICIA Préstamo" };
const base = { startMonthKey: "2026-11", reserve: 7230, byMonth: [300, 300, 300, 300, 300] };

test("D-N42 · sin deudas caras, todo lo de más al colchón hasta llegar a la reserva; después, lo de siempre", () => {
  const c = Plan.colchonPrimero(filas, { ...base, contracts: [prestamo] });
  assert.equal(c.activo, true);
  assert.equal(c.falta, 730);
  assert.deepEqual(c.byMonth, [0, 0, 0, 300, 300]);
  assert.deepEqual(c.alColchonPorMes, [300, 300, 300, 0, 0]);
  assert.equal(c.hastaMonthKey, "2027-02");
  assert.equal(c.reparte, false);
});

test("D-N42 · con una deuda por encima del umbral, a medias con ella; el umbral se puede cambiar", () => {
  const c = Plan.colchonPrimero(filas, { ...base, contracts: [tarjeta, prestamo] });
  assert.equal(c.reparte, true);
  assert.equal(c.caras[0].id, "t");
  assert.deepEqual(c.byMonth, [150, 150, 150, 150, 300]);
  assert.equal(c.hastaMonthKey, "2027-03", "pagando la mitad a la tarjeta, se tarda un mes más en llegar a la reserva");
  const alto = Plan.colchonPrimero(filas, { ...base, contracts: [tarjeta, prestamo], threshold: 25 });
  assert.equal(alto.reparte, false, "con el umbral al 25 %, la tarjeta al 21,9 % ya no es «cara»");
});

test("D-N42 · nunca pone más que el plan de partida, y sin reserva, sin previsión o por encima no cambia nada (y dice por qué)", () => {
  const c = Plan.colchonPrimero(filas, { ...base, contracts: [tarjeta] });
  c.byMonth.forEach((v, i) => assert.ok(v <= base.byMonth[i]));
  assert.equal(Plan.colchonPrimero(filas, { ...base, reserve: 0 }).razon, "sin-reserva");
  assert.equal(Plan.colchonPrimero([], base).razon, "sin-prevision");
  const encima = Plan.colchonPrimero(filas, { ...base, reserve: 5000 });
  assert.equal(encima.activo, false);
  assert.equal(encima.razon, "por-encima");
  // Con un importe fijo en vez de lo de cada mes.
  assert.deepEqual(Plan.colchonPrimero(filas, { startMonthKey: "2026-11", reserve: 7230, monthly: 200, contracts: [prestamo] }).byMonth, [0, 0, 0, 200, 200]);
});

test("D-N42 · el plan óptimo lo aplica por defecto, con su control y su nota, y la fecha única lo incluye", () => {
  const camino = fs.readFileSync(path.join(raiz, "camino-deuda-ui.js"), "utf8");
  assert.match(camino, /const colchon = ajusteColchon\.activo && typeof Plan\.colchonPrimero === "function"/);
  assert.match(camino, /const porMes = colchon\.activo \? \{ monthlyByMonth: colchon\.byMonth \}/);
  assert.match(camino, /return \{ activo: g\.activo !== false, umbral:/, "activo de entrada (D-N42)");
  assert.match(camino, /guardado\(PLAN_OPTIMO_COLCHON_KEY\)/, "la clave de la fecha única cambia con el ajuste");
  const html = fs.readFileSync(path.join(raiz, "index.html"), "utf8");
  assert.match(html, /<input type="checkbox" id="planOptimoColchon" checked \/>/);
  assert.match(html, /id="planOptimoColchonUmbral" value="15"/);
  assert.match(codigoApp(), /"plan-optimo-colchon", \/\/ TRE-D3/, "viaja en la copia");
});

test("D-N42 · la vista nueva lo dice en la respuesta y en «Este mes»", () => {
  const plan = {
    ok: true, startMonthKey: "2026-11", baseline: { debtFreeMonthKey: "2029-11" },
    recommended: { strategy: "avalancha", summary: { debtFreeMonthKey: "2028-01" }, periods: [{ fromIndex: 0, toIndex: 3, targetId: "t", targetLabel: "Banco FICTICIO Tarjeta", extra: 150 }], result: { ok: true, included: [] } },
  };
  const colchon = Plan.colchonPrimero(filas, { ...base, contracts: [tarjeta, prestamo] });
  const m = V.modelo({
    outlook: { libreDeDeuda: "2028-01", fuente: "plan-optimo" }, plan, hoy: "2026-11-25", colchon,
    contratos: [{ id: "t", currentPrincipal: 2400, currentPayment: 90, paymentStatus: "active" }],
  });
  assert.match(m.hero.colchon, /^Primero, el colchón: os faltan 730 € para la reserva protegida; hasta marzo de 2027, la mitad de lo de más va al colchón y la otra mitad a Banco FICTICIO Tarjeta\.$/);
  assert.equal(m.esteMes.alColchon, 150);
  const html = V.html(m);
  assert.match(html, /class="dpv2-colchon"/);
  assert.match(html, /se quedan en la cuenta, para el colchón/);
});
