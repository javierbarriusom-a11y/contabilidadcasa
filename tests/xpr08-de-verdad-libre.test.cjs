// XPR-08 con D-N9 (b) · «De verdad libre»: lo que el plan aún no descuenta de los pagos grandes (provisions de canonical-large-payments.js)
// y su cableado en la Previsión nueva. Pagos INVENTADOS: ninguna cifra sale del hogar.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const L = require("../canonical-large-payments.js");
const leer = (fichero) => fs.readFileSync(path.join(__dirname, "..", fichero), "utf8");

const hoy = "2026-11-06";
const fin3m = "2027-02-05";

test("XPR-08 · lo que el plan ya pone dentro del horizonte no se resta otra vez", () => {
  const r = L.provisions({ today: hoy, horizonEnd: fin3m, items: [{ id: "p", kind: "plan", label: "IBI INVENTADO", monthKey: "2026-12", day: null, amount: 900 }] });
  assert.equal(r.total, 0);
  assert.deepEqual(r.items, []);
});

test("XPR-08 · dentro del horizonte y fuera del plan cuenta entero (un seguro del inventario, lo que falta de un cargo periódico)", () => {
  const r = L.provisions({
    today: hoy, horizonEnd: fin3m, items: [
      { id: "s", kind: "policy", label: "Seguro INVENTADO", monthKey: "2026-12", day: 20, amount: 300 },
      { id: "s2", kind: "policy", label: "Seguro INVENTADO también en el plan", monthKey: "2026-12", day: 1, amount: 200, alsoInPlan: "Seguros" },
      { id: "c", kind: "periodic", label: "Cargo INVENTADO", monthKey: "2027-01", day: 10, amount: 120, planShort: 80, everyMonths: 3 },
    ],
  });
  assert.deepEqual(r.items.map((item) => [item.id, item.part, item.reason, item.date]), [["s", 300, "no-esta-en-el-plan", "2026-12-20"], ["c", 80, "no-esta-en-el-plan", "2027-01-10"]]);
  assert.equal(r.total, 380);
  assert.equal(r.monthly, 0, "lo que cae dentro del horizonte no se reparte en apartados mensuales");
});

test("XPR-08 · después del horizonte, solo la parte devengada: importe × meses transcurridos ÷ meses del ciclo", () => {
  const r = L.provisions({
    today: hoy, horizonEnd: fin3m, items: [
      { id: "anual", kind: "policy", label: "Seguro anual INVENTADO", monthKey: "2027-03", day: 15, amount: 600 }, // faltan 4 meses: van 8 de 12
      { id: "ibi", kind: "plan", label: "IBI INVENTADO", monthKey: "2027-09", day: null, amount: 1200 }, // faltan 10: van 2 de 12
      { id: "cada6", kind: "periodic", label: "Cargo INVENTADO cada 6 meses", monthKey: "2027-04", day: 2, amount: 300, everyMonths: 6, planShort: 300 }, // faltan 5: van 1 de 6
    ],
  });
  const porId = Object.fromEntries(r.items.map((item) => [item.id, item]));
  assert.equal(porId.anual.part, 400);
  assert.equal(porId.anual.elapsed, 8);
  assert.equal(porId.anual.cycle, 12);
  assert.equal(porId.ibi.part, 200);
  assert.equal(porId.cada6.part, 50);
  assert.equal(porId.cada6.cycle, 6);
  assert.equal(r.total, 650);
  assert.equal(r.monthly, 50 + 100 + 50, "el apartado de cada uno: importe ÷ meses del ciclo");
  assert.deepEqual(r.items.map((item) => item.id), ["anual", "ibi", "cada6"], "de más a menos");
});

test("XPR-08 · sin importe, objetivos, Hacienda y lo ya pasado no entran: no se inventa nada", () => {
  const r = L.provisions({
    today: hoy, horizonEnd: fin3m, items: [
      { id: "sin", kind: "policy", label: "Sin importe", monthKey: "2027-03", day: 1, amount: null },
      { id: "obj", kind: "goal", label: "Hucha INVENTADA", monthKey: "2027-06", day: 1, amount: 2000, reserved: 500 },
      { id: "renta", kind: "tax", label: "Renta", monthKey: "2027-06", day: 30, amount: 800 },
      { id: "pasado", kind: "policy", label: "Ya pasó", monthKey: "2026-11", day: 2, amount: 300 },
    ],
  });
  assert.equal(r.total, 0);
});

test("XPR-08 · cableado: la línea de la Previsión nueva aplica lo que no está en el plan a la trayectoria y suma lo devengado", () => {
  const vista = leer("views/prevision-v2.js");
  assert.match(vista, /function previsionV2LibreHtml\(/);
  assert.match(vista, /engine\.provisions\(\{ items: map\.months\.flatMap/);
  // Lo de fuera del plan resta desde su día: se vuelve a buscar el mínimo de la trayectoria.
  assert.match(vista, /fuera\.filter\(\(item\) => item\.date <= row\.date\)/);
  assert.match(vista, /data-prevision-v2-mapa/);
  // No aparta nada: no hay botón «Apartar» que prometa mover dinero.
  assert.doesNotMatch(vista, />Apartar /);
});
