const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// PRV-01 (novena auditoría, 14/11/2026), primera parte: medir el gasto variable de verdad y compararlo con lo previsto, sin cambiar
// la previsión. Movimientos INVENTADOS: 13 meses con súper, un fijo, una cuota, un traspaso entre cuentas propias, compras sueltas,
// un gimnasio que se repite sin partida, la liquidación de la tarjeta con 50 € de suscripciones y una avería de coche.

const root = path.resolve(__dirname, "..");
const R = require("../canonical-variable-recalibration.js");

const MESES = ["2025-10", "2025-11", "2025-12", "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"];

function hogar({ diciembre = 1.3 } = {}) {
  const mv = [];
  MESES.forEach((m, i) => {
    const factor = m.endsWith("-12") ? diciembre : 1;
    mv.push({ date: `${m}-03`, amount: -800 * factor, account: "caixa", conceptKey: "expense|mercadona|", label: "MERCADONA", block: null });
    mv.push({ date: `${m}-05`, amount: -450, account: "caixa", conceptKey: "expense|recibo luz|", block: "fijo" });
    mv.push({ date: `${m}-07`, amount: -300, account: "caixa", conceptKey: "expense|cuota|", block: "financiacion" });
    mv.push({ date: `${m}-10`, amount: -500, account: "caixa", conceptKey: "expense|traspaso|" });
    mv.push({ date: `${m}-11`, amount: 500, account: "ahorro", conceptKey: "income|traspaso|" });
    mv.push({ date: `${m}-12`, amount: -(400 + i * 5), account: "caixa", conceptKey: `expense|tienda ${i}|`, block: null });
    mv.push({ date: `${m}-15`, amount: -60, account: "caixa", conceptKey: "expense|gimnasio|", label: "GIMNASIO", block: null });
    mv.push({ date: `${m}-02`, amount: -350, account: "caixa", conceptKey: "expense|liquidacion tarjeta|", cardSettlement: true });
  });
  mv.push({ date: "2026-03-20", amount: -1800, account: "caixa", conceptKey: "expense|taller coche|", label: "TALLER" });
  return mv;
}

const SUSCRIPCIONES = Object.fromEntries(MESES.map((m) => [m, 50]));
const PREVISTO = Object.fromEntries(MESES.map((m) => [m, 1000]));

test("el variable de un mes quita fijos, cuotas, traspasos emparejados, la liquidación de tarjeta, lo repetido sin partida y lo extraordinario", () => {
  const r = R.recalibrate(hogar(), { completeMonths: MESES, subscriptionsByMonth: SUSCRIPCIONES, plannedByMonth: PREVISTO });
  const octubre = r.rows[0];
  assert.equal(octubre.outflows, 2860);
  assert.equal(octubre.transfers, 500, "la salida a la cuenta de ahorro se empareja con su entrada al día siguiente");
  assert.equal(octubre.fixed, 450);
  assert.equal(octubre.debt, 300);
  assert.equal(octubre.cardSettlement, 350);
  assert.equal(octubre.cardPurchases, 300, "de la tarjeta vuelve lo que no son suscripciones");
  assert.equal(octubre.recurringUnclassified, 60, "el gimnasio se repite 13 meses con el mismo importe y sin partida");
  assert.equal(octubre.variable, 800 + 400 + 300);
  assert.equal(r.pairedTransfers, 13);
  assert.deepEqual(r.recurring.map((row) => row.label), ["GIMNASIO"]);
  assert.deepEqual(r.extraordinary.map((row) => [row.month, row.label, row.amount]), [["2026-03", "TALLER", 1800]]);
  assert.equal(r.rows.find((row) => row.month === "2026-03").extraordinary, 1800);
});

test("tarjeta aplazada: la liquidación es una cuota y sus compras no cuentan (se dice)", () => {
  const r = R.recalibrate(hogar(), { completeMonths: MESES, subscriptionsByMonth: SUSCRIPCIONES, cardMode: "aplazado" });
  assert.equal(r.cardMode, "aplazado");
  assert.equal(r.rows[0].cardPurchases, 0);
  assert.equal(r.rows[0].variable, 1200);
  assert.match(r.cardNote, /extracto de la tarjeta/);
});

test("base por media recortada de los últimos 12 meses; diciembre más caro, pero contraído hacia la media", () => {
  const r = R.recalibrate(hogar(), { completeMonths: MESES, subscriptionsByMonth: SUSCRIPCIONES, plannedByMonth: PREVISTO });
  assert.equal(r.gate.ok, true);
  assert.ok(r.base > 1500 && r.base < 1600, `base ${r.base}`);
  const diciembre = r.seasonal[11];
  assert.ok(diciembre > 1 && diciembre < 1.16, `diciembre ${diciembre}: con un solo año pesa un tercio`);
  assert.ok(Math.abs(r.seasonal.reduce((a, b) => a + b, 0) / 12 - 1) < 0.002, "los índices tienen media 1");
});

test("la prueba contra el pasado compara el método con lo previsto: aquí lo previsto se queda corto", () => {
  const r = R.recalibrate(hogar(), { completeMonths: MESES, subscriptionsByMonth: SUSCRIPCIONES, plannedByMonth: PREVISTO });
  assert.equal(r.plannedAverage, 1000);
  assert.ok(r.gap > 500, `lo real supera lo previsto en ${r.gap}`);
  assert.ok(r.backtest.planned.bias < -30, "lo previsto, siempre por debajo");
  assert.ok(r.backtest.method.mape < r.backtest.planned.mape, "el método se equivoca menos que lo previsto");
  assert.equal(r.backtest.method.n, MESES.length - R.DEFAULTS.minMonths);
});

test("con menos de 6 meses completos no se mide (y se dice cuántos hay)", () => {
  const r = R.recalibrate(hogar(), { completeMonths: MESES.slice(0, 4) });
  assert.equal(r.gate.ok, false);
  assert.equal(r.gate.months, 4);
  assert.equal(r.projection.length, 0);
});

test("la proyección llega a diciembre de 2036, en euros de hoy (la inflación la pone la previsión)", () => {
  const r = R.recalibrate(hogar(), { completeMonths: MESES, subscriptionsByMonth: SUSCRIPCIONES, startMonthKey: "2026-12" });
  assert.equal(r.projection[0].month, "2026-12");
  assert.equal(r.projection.at(-1).month, "2036-12");
  assert.equal(r.projection.length, 121);
  assert.equal(r.projection[0].variable, Math.round(r.base * r.seasonal[11] * 100) / 100);
  assert.equal(r.projection[12].variable, r.projection[0].variable, "mismo mes, misma cifra: sin inflación aquí");
});

test("meses completos: del segundo con movimientos al anterior al actual", () => {
  const mv = [{ date: "2026-05-20" }, { date: "2026-06-03" }, { date: "2026-07-03" }, { date: "2026-08-03" }, { date: "2026-11-02" }];
  assert.deepEqual(R.completeMonthsFrom(mv, "2026-11-14"), ["2026-06", "2026-07", "2026-08"]);
});

test("un traspaso solo se empareja con otra cuenta y en ±2 días", () => {
  const paired = R.pairTransfers([
    { date: "2026-10-01", amount: -200, account: "a" },
    { date: "2026-10-01", amount: 200, account: "a" },
    { date: "2026-10-10", amount: -300, account: "a" },
    { date: "2026-10-20", amount: 300, account: "b" },
    { date: "2026-10-21", amount: -90, account: "a" },
    { date: "2026-10-22", amount: 90, account: "b" },
  ]);
  assert.deepEqual([...paired].sort(), [4, 5]);
});

test("cableado: el motor carga, Previsión lo usa en la hoja del porqué y no escribe en el plan", () => {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const vista = fs.readFileSync(path.join(root, "views/prevision-v2.js"), "utf8");
  const build = fs.readFileSync(path.join(root, "tools/build-public-site.mjs"), "utf8");
  const sw = fs.readFileSync(path.join(root, "service-worker.js"), "utf8");
  assert.match(html, /<script defer src="canonical-variable-recalibration\.js\?v=\w+"><\/script>/);
  assert.match(build, /"canonical-variable-recalibration\.js",/);
  assert.match(sw, /"\.\/canonical-variable-recalibration\.js",/);
  assert.match(vista, /\$\{previsionV2GastoVariableHtml\(isoLocalDate\(new Date\(\)\)\)\}/);
  const bloque = vista.slice(vista.indexOf("function previsionV2GastoVariable("), vista.indexOf("function previsionV2ConfianzaHojaHtml("));
  assert.doesNotMatch(bloque, /seriesOverrides\s*\[|saveSeriesOverrides|saveScenarioSettings|storageSet/, "solo mide");
  assert.match(bloque, /plannedValueForRow\(variableRow, month\) \+ personalAllowanceTotal\(month\)/, "lo previsto incluye las asignaciones personales");
  assert.match(bloque, /pendiente de vuestra decisión/);
});
