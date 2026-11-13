// FX-41 (el cambio de Hoy de la semana del 23/11/2026) · avisos de previsión con umbral (canonical-forecast-alerts.js): la previsión avisa
// cuando CRUZA un umbral en los próximos 90 días (hoy por encima, luego por debajo), no cuando cambia ni cuando ya se está por debajo.
// Cifras INVENTADAS.
const test = require("node:test");
const assert = require("node:assert/strict");

const A = require("../canonical-forecast-alerts.js");

const hoy = "2026-11-23";
function dias(n, f) {
  return Array.from({ length: n }, (_, i) => {
    const date = new Date(Date.UTC(2026, 10, 23 + i, 12)).toISOString().slice(0, 10);
    return { date, ...f(i, date) };
  });
}
// Una trayectoria que baja 100 € al día desde 6.000 € y sube con el cobro del día 40: el mínimo, 2.100 € el día 39.
const bajada = dias(95, (i) => {
  const total = i < 40 ? 6000 - 100 * i : 6000;
  return { total, checking: total - 2000, savings: 2000 };
});
const ids = (result) => result.alerts.map((alert) => alert.id);

test("FX-41 · el suelo: hoy por encima y la trayectoria baja de él; los euros, lo que falta en el punto más bajo", () => {
  const r = A.evaluate({ rows: bajada, today: hoy, floor: 3000 });
  assert.equal(r.status, "ok");
  const suelo = r.alerts.find((alert) => alert.id === "suelo");
  // 6.000 − 100 × 31 = 2.900 el día 31 (24 dic): primer día por debajo de 3.000; lo más bajo, 2.100 € el día 39 (1 ene).
  assert.deepEqual(JSON.parse(JSON.stringify(suelo)), { id: "suelo", date: "2026-12-24", euros: 900, data: { floor: 3000, crossDate: "2026-12-24", lowDate: "2027-01-01", lowValue: 2100 } });
  // Si hoy ya se está por debajo, no es un aviso de previsión: lo dice Hoy.
  assert.equal(ids(A.evaluate({ rows: bajada, today: hoy, floor: 7000 })).includes("suelo"), false);
  // Si nunca baja del suelo, nada.
  assert.equal(A.evaluate({ rows: bajada, today: hoy, floor: 1000 }).alerts.length, 0);
});

test("FX-41 · la cuenta corriente baja de su mínimo con el total sano; y el colchón, solo si no hay aviso de suelo", () => {
  const r = A.evaluate({ rows: bajada, today: hoy, floor: 1000, checkingFloor: 1500 });
  assert.deepEqual(ids(r), ["cuenta"]);
  const cuenta = r.alerts[0];
  // La cuenta: 4.000 − 100 × i; baja de 1.500 el día 26 (19 dic); lo más bajo, 100 € el día 39: faltan 1.400, y el ahorro (2.000) alcanza.
  assert.equal(cuenta.date, "2026-12-19");
  assert.equal(cuenta.euros, 1400);
  assert.equal(cuenta.data.coveredBySavings, true);
  // Colchón: objetivo de 1 mes de 4.000 € de gasto. Hoy 6.000 € (1,5 meses); baja de 4.000 el día 21 (14 dic). Faltan 4.000 − 2.100.
  const colchon = A.evaluate({ rows: bajada, today: hoy, floor: 1000, cushionTargetMonths: 1, monthlySpend: 4000 }).alerts.find((alert) => alert.id === "colchon");
  assert.equal(colchon.date, "2026-12-14");
  assert.equal(colchon.euros, 1900);
  assert.equal(colchon.data.lowMonths, 0.5);
  // Un objetivo que hoy ya no se cumple no avisa cada semana; y con aviso de suelo, el del colchón sobra.
  assert.equal(ids(A.evaluate({ rows: bajada, today: hoy, floor: 1000, cushionTargetMonths: 2, monthlySpend: 4000 })).includes("colchon"), false);
  assert.deepEqual(ids(A.evaluate({ rows: bajada, today: hoy, floor: 3000, cushionTargetMonths: 1, monthlySpend: 4000 })), ["suelo"]);
});

test("FX-41 · el fin de año cae más de un 10 % frente a la última visita; y salen de más a menos euros", () => {
  const conFin = bajada.map((row) => ({ ...row }));
  // El 31 dic es el día 38: 6.000 − 3.800 = 2.200 €. En la visita del 20/11 se preveían 3.000 €: cae 800 (27 %).
  const r = A.evaluate({ rows: conFin, today: hoy, floor: 3000, previousYearEnd: { value: 3000, visitDate: "2026-11-20" } });
  assert.deepEqual(ids(r), ["suelo", "fin-de-ano"], "900 € antes que 800 €");
  assert.deepEqual(JSON.parse(JSON.stringify(r.alerts[1])), { id: "fin-de-ano", date: "2026-12-31", euros: 800, data: { before: 3000, after: 2200, visitDate: "2026-11-20", share: 27 } });
  // Un 10 % o menos, o una visita de hoy mismo, no avisan.
  assert.equal(ids(A.evaluate({ rows: conFin, today: hoy, previousYearEnd: { value: 2400, visitDate: "2026-11-20" } })).includes("fin-de-ano"), false);
  assert.equal(ids(A.evaluate({ rows: conFin, today: hoy, previousYearEnd: { value: 3000, visitDate: hoy } })).includes("fin-de-ano"), false);
});

test("FX-41 · la cuenta que baja solo cuando baja el total no repite el aviso de suelo; sin trayectoria desde hoy, nada", () => {
  // Cuenta y total bajan juntos del umbral el mismo día: solo el suelo.
  const juntos = dias(60, (i) => ({ total: 5000 - 100 * i, checking: 5000 - 100 * i - 3000, savings: 3000 }));
  // Suelo 2.000: lo cruza el día 31; la cuenta (mínimo 0) también baja de 0 el día 21… antes: ese sí sale.
  assert.deepEqual(ids(A.evaluate({ rows: juntos, today: hoy, floor: 2000, checkingFloor: 0 })).sort(), ["cuenta", "suelo"]);
  const mismoDia = dias(60, (i) => ({ total: 5000 - 100 * i, checking: 5000 - 100 * i, savings: 0 }));
  assert.deepEqual(ids(A.evaluate({ rows: mismoDia, today: hoy, floor: 2000, checkingFloor: 2000 })), ["suelo"]);
  assert.equal(A.evaluate({ rows: bajada.slice(1), today: hoy }).status, "missing");
  assert.equal(A.evaluate({ rows: bajada, today: "ayer" }).status, "missing");
});

test("FX-41 · el 31 de diciembre de una foto de FX-40: el día exacto si lo cubre, si no el cierre de diciembre", () => {
  const foto = { date: "2026-11-20", days: Array.from({ length: 50 }, (_, i) => 5000 - i * 10), months: [["2027-12", 1000, "2027-12-08", 1800]] };
  // Del 20/11 al 31/12 hay 41 días: 5.000 − 410.
  assert.equal(A.yearEndFromSnapshot(foto, "2026"), 4590);
  assert.equal(A.yearEndFromSnapshot(foto, "2027"), 1800);
  assert.equal(A.yearEndFromSnapshot(foto, "2028"), null);
  assert.equal(A.yearEndFromSnapshot(null, "2026"), null);
});
