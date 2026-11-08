// FX-40 · «qué ha cambiado desde tu última visita» (canonical-forecast-changes.js) y su cableado en la Previsión nueva.
// Trayectorias INVENTADAS: ninguna cifra sale del hogar.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const C = require("../canonical-forecast-changes.js");
const leer = (fichero) => fs.readFileSync(path.join(__dirname, "..", fichero), "utf8");

/** Una trayectoria diaria desde `from` durante `n` días: `value(i)` el saldo del día i. */
function tray(from, n, value) {
  return Array.from({ length: n }, (_, i) => ({ date: C.addDays(from, i), total: value(i) }));
}
const policy = { incomeFactor: 1, annualIncomeGrowth: 0, expenseFactor: 1, annualInflation: 2, plannedMonthlySaving: 300, autoCapSavings: true, operatingReserve: 0 };
const plan = [{ monthKey: "2026-12", income: 3000, coreSpend: 2000 }, { monthKey: "2027-01", income: 3000, coreSpend: 2000 }];
// Un dientes de sierra: baja 100 € al día durante 30 días y se recupera con la nómina.
const sierra = (base) => (i) => base - (i % 30) * 100;

test("FX-40 · la foto: día a día hasta 800 días, después el mínimo y el cierre de cada mes; los supuestos y el plan", () => {
  const rows = tray("2026-11-02", 1200, sierra(10000));
  const snap = C.snapshot({ today: "2026-11-02", rows, policy, planMonths: [{ monthKey: "2026-11", income: 1 }, ...plan] });
  assert.equal(snap.days.length, C.DAILY_DAYS);
  assert.equal(snap.days[0], 10000);
  assert.equal(snap.end, rows.at(-1).date);
  assert.ok(snap.months.length >= 13 && snap.months.every(([key, min, date, end]) => /^\d{4}-\d{2}$/.test(key) && min <= end && date.startsWith(key)));
  assert.deepEqual(Object.keys(snap.plan), ["2026-12", "2027-01"], "el plan, desde el mes siguiente");
  assert.equal(snap.policy.annualInflation, 2);
  // Ligera: unos pocos KB, no la trayectoria entera con sus movimientos.
  assert.ok(JSON.stringify(snap).length < 12000, `${JSON.stringify(snap).length} bytes`);
  // Sin la fila de hoy no hay foto.
  assert.equal(C.snapshot({ today: "2026-11-01", rows }), null);
});

test("FX-40 · las fotos: una por día, de la más reciente a la más antigua, como mucho 8; se compara con la de un día anterior", () => {
  let store = [];
  for (let i = 0; i < 10; i += 1) store = C.upsert(store, C.snapshot({ today: C.addDays("2026-11-01", i), rows: tray(C.addDays("2026-11-01", i), 40, () => 5000 + i) }));
  assert.equal(store.length, C.MAX_SNAPSHOTS);
  assert.equal(store[0].date, "2026-11-10");
  store = C.upsert(store, C.snapshot({ today: "2026-11-10", rows: tray("2026-11-10", 40, () => 1) }));
  assert.equal(store.filter((snap) => snap.date === "2026-11-10").length, 1, "la del mismo día se sustituye");
  assert.equal(C.previousVisit(store, "2026-11-10").date, "2026-11-09", "hoy se compara con la visita de otro día");
  assert.equal(C.previousVisit([], "2026-11-10"), null);
});

test("FX-40 · si todo va según lo previsto, el punto más bajo de 3 meses no cambia y el puente es todo «paso del tiempo» (0)", () => {
  const rows = tray("2026-11-02", 900, sierra(10000));
  const previous = C.snapshot({ today: "2026-11-02", rows, policy, planMonths: plan });
  const today = "2026-11-09";
  const hoy = rows.filter((row) => row.date >= today);
  const low = C.lowIn(C.snapshot({ today, rows: hoy }), today, C.addDays(today, 91));
  const r = C.bridge({ previous, today, windowDays: 91, current: { low, start: hoy[0].total, end: hoy.at(-1).date, policy, plan: previous.plan } });
  assert.equal(r.calculable, true);
  assert.equal(r.total, 0);
  r.rows.forEach((row) => assert.equal(row.value, 0, row.id));
  assert.equal(r.rows.at(-1).id, "otros", "el plan no ha cambiado: lo que quede va a «Otros»");
  assert.equal(C.mainCause(r), null);
});

test("FX-40 · datos nuevos: el saldo de hoy 400 € por debajo de lo esperado baja el punto más bajo 400 €; el puente cuadra", () => {
  const rows = tray("2026-11-02", 900, sierra(10000));
  const previous = C.snapshot({ today: "2026-11-02", rows, policy, planMonths: plan });
  const today = "2026-11-09";
  const hoy = rows.filter((row) => row.date >= today).map((row) => ({ ...row, total: row.total - 400 }));
  const low = C.lowIn(C.snapshot({ today, rows: hoy }), today, C.addDays(today, 91));
  const r = C.bridge({ previous, today, windowDays: 91, current: { low, start: hoy[0].total, end: hoy.at(-1).date, policy, plan: previous.plan } });
  assert.equal(r.total, -400);
  assert.equal(r.rows.find((row) => row.id === "datos").value, -400);
  assert.equal(r.rows.reduce((sum, row) => sum + row.value, 0), r.total, "el puente cuadra siempre");
  assert.equal(C.mainCause(r).id, "datos");
  assert.equal(r.weak, false);
});

test("FX-40 · el paso del tiempo: un mínimo que ya pasó sale de la ventana y el punto más bajo sube sin que cambie nada", () => {
  // Un pago grande el día 3 (mínimo de 2.000 €) y después todo por encima de 6.000 €.
  const rows = tray("2026-11-02", 900, (i) => (i === 3 ? 2000 : 6000 + (i % 30) * 10));
  const previous = C.snapshot({ today: "2026-11-02", rows, policy, planMonths: plan });
  const today = "2026-11-09";
  const hoy = rows.filter((row) => row.date >= today);
  const low = C.lowIn(C.snapshot({ today, rows: hoy }), today, C.addDays(today, 91));
  const r = C.bridge({ previous, today, windowDays: 91, current: { low, start: hoy[0].total, end: hoy.at(-1).date, policy, plan: previous.plan } });
  assert.equal(r.before.value, 2000);
  assert.equal(r.total, 4000);
  assert.equal(r.rows.find((row) => row.id === "tiempo").value, 4000);
  assert.equal(C.mainCause(r).id, "tiempo");
});

test("FX-40 · supuestos con su recálculo; un plan cambiado se lleva el resto y lo dice; sin cambio de plan, «Otros» y aviso si pesa", () => {
  const rows = tray("2026-11-02", 900, sierra(10000));
  const previous = C.snapshot({ today: "2026-11-02", rows, policy, planMonths: plan });
  const today = "2026-11-09";
  const hoy = rows.filter((row) => row.date >= today).map((row) => ({ ...row, total: row.total - 900 }));
  const low = C.lowIn(C.snapshot({ today, rows: hoy }), today, C.addDays(today, 91));
  const nuevaPolicy = { ...policy, annualInflation: 4 };
  const nuevoPlan = { "2026-12": [3000, 2600, 0, 0, 0, 0, 0], "2027-01": [3000, 2000, 0, 0, 0, 0, 0] };
  // Con los supuestos de entonces el mínimo estaría 300 € más arriba; el saldo de hoy es el esperado.
  const r = C.bridge({
    previous, today, windowDays: 91,
    current: { low, start: rows.find((row) => row.date === today).total, end: hoy.at(-1).date, policy: nuevaPolicy, plan: nuevoPlan },
    oldPolicyLow: { value: low.value + 300, date: low.date },
  });
  assert.deepEqual(r.changedPolicy, ["annualInflation"]);
  assert.deepEqual(r.changedPlanMonths, ["2026-12"]);
  assert.equal(r.rows.find((row) => row.id === "supuestos").value, -300);
  assert.equal(r.rows.find((row) => row.id === "plan").value, -600);
  assert.equal(r.rows.reduce((sum, row) => sum + row.value, 0), r.total);
  assert.match(r.notes.join(" "), /han cambiado la inflación anual/);
  assert.match(r.notes.join(" "), /incluye también lo que la app no sabe separar/);
  // El mismo cambio sin plan cambiado ni recálculo: todo a «Otros», y se avisa de que la explicación es floja.
  const sinPlan = C.bridge({ previous, today, windowDays: 91, current: { low, start: rows.find((row) => row.date === today).total, end: hoy.at(-1).date, policy, plan: previous.plan } });
  assert.equal(sinPlan.rows.at(-1).id, "otros");
  assert.equal(sinPlan.rows.at(-1).value, -900);
  assert.equal(sinPlan.weak, true);
});

test("FX-40 · si los supuestos también mueven el saldo de hoy, eso es de los supuestos, no de los datos nuevos", () => {
  const rows = tray("2026-11-02", 900, sierra(10000));
  const previous = C.snapshot({ today: "2026-11-02", rows, policy, planMonths: plan });
  const today = "2026-11-09";
  // Con la inflación nueva todo baja 80 € desde hoy (también el saldo de hoy); con la de entonces, nada cambia.
  const hoy = rows.filter((row) => row.date >= today).map((row) => ({ ...row, total: row.total - 80 }));
  const low = C.lowIn(C.snapshot({ today, rows: hoy }), today, C.addDays(today, 91));
  const conEntonces = rows.filter((row) => row.date >= today);
  const r = C.bridge({
    previous, today, windowDays: 91,
    current: { low, start: hoy[0].total, end: hoy.at(-1).date, policy: { ...policy, annualInflation: 3.5 }, plan: previous.plan },
    oldPolicyLow: C.lowIn(C.snapshot({ today, rows: conEntonces }), today, C.addDays(today, 91)),
    oldPolicyStart: conEntonces[0].total,
  });
  assert.equal(r.total, -80);
  assert.equal(r.rows.find((row) => row.id === "supuestos").value, -80);
  assert.equal(r.rows.find((row) => row.id === "datos").value, 0, "el saldo de hoy con los supuestos de entonces es el esperado");
  assert.equal(C.mainCause(r).id, "supuestos");
  // Con saldos calculados por calendario, la barra del saldo de hoy no se presenta como «datos nuevos».
  const calculado = C.bridge({ previous, today, windowDays: 91, current: { low, start: hoy[0].total, end: hoy.at(-1).date, policy, plan: previous.plan }, startEstimated: true });
  assert.equal(calculado.rows.find((row) => row.id === "datos").label, "Saldo de hoy (calculado)");
  assert.match(calculado.notes.join(" "), /cambian con el plan y los supuestos, no solo con datos nuevos/);
});

test("FX-40 · lo que no se puede comparar se dice: sin visita anterior, la del mismo día o una previsión que no llega a hoy", () => {
  const rows = tray("2026-11-02", 40, () => 5000);
  const previous = C.snapshot({ today: "2026-11-02", rows });
  const current = { low: { value: 5000, date: "2026-11-02" }, start: 5000, end: "2027-01-01" };
  assert.equal(C.bridge({ previous: null, today: "2026-11-09", windowDays: 91, current }).calculable, false);
  assert.equal(C.bridge({ previous, today: "2026-11-02", windowDays: 91, current }).calculable, false);
  assert.match(C.bridge({ previous, today: "2027-02-01", windowDays: 91, current }).reason, /no llega hasta hoy/);
});

test("FX-40 · motor puro y cableado: se carga antes de la vista, va en la caché y el sitio, y las fotos son de este dispositivo", () => {
  const motor = leer("canonical-forecast-changes.js");
  assert.doesNotMatch(motor, /document\.|localStorage|window\.|Date\.now|new Date\(\)/);
  const html = leer("index.html");
  const at = html.indexOf('src="canonical-forecast-changes.js?v=');
  assert.ok(at > 0 && at < html.indexOf('src="views/prevision-v2.js?v='));
  assert.match(leer("service-worker.js"), /"\.\/canonical-forecast-changes\.js"/);
  assert.match(leer("tools/build-public-site.mjs"), /"canonical-forecast-changes\.js"/);
  const vista = leer("views/prevision-v2.js");
  assert.match(vista, /FinanceCanonicalForecastChanges/);
  assert.match(vista, /storageKey\(PREVISION_V2_FOTOS\)/);
  assert.match(vista, /data-prevision-v2-cambios/);
  // Supuestos: se recalcula con los de entonces con los motores de siempre (el mismo `run` de las pruebas de estrés).
  assert.match(vista, /S\.run\(\{ \.\.\.input, policy: \{ \.\.\.input\.policy, \.\.\.anterior\.policy \} \}/);
  // Fuera de la copia, con su motivo: es de este dispositivo.
  assert.match(leer("tests/arq6-copia-completa.test.cjs"), /"prevision-v2-fotos":/);
});
