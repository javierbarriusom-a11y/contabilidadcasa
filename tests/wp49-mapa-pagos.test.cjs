const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { codigoApp } = require("./helpers/codigo-app.cjs");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const L = require("../canonical-large-payments.js");

// WP-49 (NPV-04): mapa anual de pagos grandes. Pruebas de oro con cifras calculadas a mano. Lo que importa: que un pago desconocido NO sea cero, que lo «financiado» salga solo de dinero
// reservado de verdad (los objetivos) y que un pago que está en el plan y en el inventario de seguros se cuente UNA vez.

const deepFreeze = (value) => { if (value && typeof value === "object" && !Object.isFrozen(value)) { Object.freeze(value); Object.values(value).forEach(deepFreeze); } return value; };
const series = (id, label, entries) => ({ id, label, values: entries });
const START = "2026-10";
const TODAY = "2026-10-11";

// Ventana oct-2026 … sep-2027. Cifras del caso de oro:
//   Colegio 1.200 € (oct, plan) · Reforma 2.000 € con 500 € ahorrados y fecha vencida (objetivo, cae en oct) · Seguro coche 620 € (nov, estimado; también está en el plan) ·
//   Coche 8.000 € con 8.000 € ahorrados (ene, objetivo) · Seguro hogar 410 € (feb, declarado) · IBI 900 € (mar, plan) · Renta (jun, sin importe) · Vacaciones 3.000 € con 1.200 € (jul).
const rows = () => [
  series("vivienda", "Vivienda", Object.fromEntries(L.monthsFrom(START, 12).map((key) => [key, 750]))),
  series("colegio", "Colegio", { "2026-10": 1200 }),
  series("ibi", "IBI", { "2027-03": 900 }),
  series("seg-coche-plan", "Seguro coche", { "2026-11": 620 }),
  series("dentista", "Dentista", { "2027-01": 150 }),
];
const policies = () => [
  { id: "p1", name: "Seguro coche", renewalDate: "2025-11-20", premium: 620 },
  { id: "p2", name: "Seguro hogar", renewalDate: "2027-02-05", premium: 410 },
  { id: "p3", name: "Seguro de vida", renewalDate: "2026-10-05", premium: 500 },
  { id: "p4", name: "Seguro móvil", renewalDate: "2026-04-10", premium: 90 },
  { id: "p5", name: "Póliza rota", renewalDate: "2026-02-30", premium: 300 },
  { id: "p6", name: "Seguro lejano", renewalDate: "2028-03-01", premium: 700 },
];
const goals = () => [
  { id: "g1", name: "Vacaciones", target: 3000, saved: 1200, targetDate: "2027-07-15", status: "active" },
  { id: "g2", name: "Coche", target: 8000, saved: 8000, targetDate: "2027-01-31", status: "active" },
  { id: "g3", name: "Reforma", target: 2000, saved: 500, targetDate: "2026-08-31", status: "active" },
  { id: "g4", name: "Sin fecha", target: 500, saved: 0, targetDate: "", status: "active" },
  { id: "g5", name: "En pausa", target: 900, saved: 0, targetDate: "2027-02-01", status: "paused" },
];
const calendar = () => ({ rows: [{ monthKey: "2027-05", events: [] }, { monthKey: "2027-06", events: [{ type: "renta", label: "Campaña de la Renta", amount: null }] }] });
const gold = () => L.assemble({ rows: rows(), policies: policies(), goals: goals(), calendar: calendar(), startMonth: START, months: 12, today: TODAY });
const find = (map, label) => map.months.flatMap((m) => m.items).find((item) => item.label === label);

test("WP-49 · las claves de mes: 12 desde octubre de 2026 cruzando el año, y la distancia entre meses", () => {
  assert.deepEqual(L.monthsFrom("2026-10", 12), ["2026-10", "2026-11", "2026-12", "2027-01", "2027-02", "2027-03", "2027-04", "2027-05", "2027-06", "2027-07", "2027-08", "2027-09"]);
  assert.deepEqual(L.monthsFrom("no", 12), []);
  assert.equal(L.monthsBetween("2026-10", "2027-07"), 9);
  assert.equal(L.monthsBetween("2027-07", "2026-10"), -9);
  assert.equal(L.validDate("2026-02-30"), false);
  assert.equal(L.validDate("2028-02-29"), true);
  assert.equal(L.validDate("2027-02-29"), false);
});

test("WP-49 · una cuota fija cada mes no es un pago grande; un importe de un solo mes, tres plazos o un pico sí; la mediana manda", () => {
  const months = L.monthsFrom(START, 12);
  const flat = series("v", "Vivienda", Object.fromEntries(months.map((key) => [key, 750])));
  assert.equal(L.lumpyItems({ rows: [flat], months }).length, 0, "750 € todos los meses (mediana 750 → umbral 1.875 €)");
  const quarterly = series("t", "Trimestral", { "2026-12": 900, "2027-03": 900, "2027-06": 900 });
  assert.deepEqual(L.lumpyItems({ rows: [quarterly], months }).map((item) => item.monthKey), ["2026-12", "2027-03", "2027-06"], "tres plazos, mediana 0");
  const spike = series("g", "Gasolina", Object.fromEntries(months.map((key) => [key, key === "2027-02" ? 320 : 100])));
  assert.deepEqual(L.lumpyItems({ rows: [spike], months }).map((item) => [item.monthKey, item.amount]), [["2027-02", 320]], "320 llega al mínimo y es 3,2 veces la mediana (100)");
  const smallSpike = series("g2", "Gasolina 2", Object.fromEntries(months.map((key) => [key, key === "2027-02" ? 280 : 100])));
  assert.equal(L.lumpyItems({ rows: [smallSpike], months }).length, 0, "280 € no llega al mínimo de 300 €");
  const twoLevels = series("d", "Dos niveles", Object.fromEntries(months.map((key, i) => [key, i < 6 ? 200 : 600])));
  assert.equal(L.lumpyItems({ rows: [twoLevels], months }).length, 0, "mediana 400 → umbral 1.000 €: cambiar de nivel no es un pago grande");
  assert.equal(L.lumpyItems({ rows: [series("i", "IBI", { "2027-03": 900 })], months, minAmount: 1000 }).length, 0, "el mínimo es un parámetro");
  assert.equal(L.lumpyItems({ rows: [series("i", "IBI", { "2027-03": -900, "2027-04": 0 })], months }).length, 0, "ni negativos ni ceros");
});

test("WP-49 · seguros: aniversario dentro de la ventana, proyectado si ya pasó (estimado), declarado si es futuro, sin proyectar hacia atrás", () => {
  const { items, ignored } = L.policyItems({ policies: policies(), startMonth: START, months: 12, today: TODAY });
  const byName = Object.fromEntries(items.map((item) => [item.label, item]));
  assert.deepEqual(byName["Seguro coche"] && [byName["Seguro coche"].monthKey, byName["Seguro coche"].day, byName["Seguro coche"].amount, byName["Seguro coche"].estimated], ["2026-11", 20, 620, true], "renovó el 20/11/2025: se proyecta a 2026");
  assert.deepEqual([byName["Seguro hogar"].monthKey, byName["Seguro hogar"].estimated], ["2027-02", false], "renovación futura declarada: no es una estimación");
  assert.equal(byName["Seguro de vida"], undefined, "el 5/10 ya pasó (hoy es el 11/10) y el siguiente cae fuera de la ventana");
  assert.deepEqual([byName["Seguro móvil"].monthKey, byName["Seguro móvil"].estimated], ["2027-04", true]);
  assert.equal(byName["Seguro lejano"], undefined, "una renovación declarada para 2028 no se proyecta hacia atrás");
  assert.deepEqual(ignored.map((item) => [item.label, item.reason]), [["Póliza rota", "sin fecha de renovación válida"]]);
  const leap = L.policyItems({ policies: [{ id: "b", name: "Bisiesto", renewalDate: "2024-02-29", premium: 400 }], startMonth: START, months: 12, today: TODAY }).items[0];
  assert.deepEqual([leap.monthKey, leap.day], ["2027-02", 28], "el 29 de febrero cae el 28 en un año no bisiesto");
  const sameDay = L.policyItems({ policies: [{ id: "c", name: "Hoy", renewalDate: "2025-10-11", premium: 400 }], startMonth: START, months: 12, today: TODAY }).items;
  assert.equal(sameDay.length, 1, "el día de hoy todavía cuenta");
  const noPremium = L.policyItems({ policies: [{ id: "d", name: "Sin prima", renewalDate: "2027-01-10", premium: "" }], startMonth: START, months: 12, today: TODAY }).items[0];
  assert.equal(noPremium.amount, null, "sin prima declarada NO es cero");
});

test("WP-49 · objetivos: reservado = lo ahorrado, la fecha vencida se coloca en el primer mes, y sin fecha o sin importe no se coloca", () => {
  const { items, ignored } = L.goalItems({ goals: goals(), startMonth: START, months: 12 });
  const byName = Object.fromEntries(items.map((item) => [item.label, item]));
  assert.deepEqual([byName.Vacaciones.monthKey, byName.Vacaciones.amount, byName.Vacaciones.reserved, byName.Vacaciones.day], ["2027-07", 3000, 1200, 15]);
  assert.deepEqual([byName.Reforma.monthKey, byName.Reforma.overdue, byName.Reforma.reserved], ["2026-10", true, 500], "vencido y sin completar: pesa ya");
  assert.equal(byName["En pausa"], undefined, "un objetivo en pausa no es un pago");
  assert.deepEqual(ignored.map((item) => [item.label, item.reason]), [["Sin fecha", "sin fecha"]]);
  const done = L.goalItems({ goals: [{ id: "x", name: "Viejo ya hecho", target: 500, saved: 500, targetDate: "2026-01-01", status: "active" }], startMonth: START, months: 12 });
  assert.equal(done.items.length, 0, "un objetivo vencido y completo no pesa");
  const over = L.goalItems({ goals: [{ id: "y", name: "Pasado de ahorro", target: 500, saved: 900, targetDate: "2027-01-10", status: "active" }], startMonth: START, months: 12 }).items[0];
  assert.equal(over.reserved, 500, "lo reservado no pasa de lo que cuesta");
  assert.deepEqual(L.goalItems({ goals: [{ id: "z", name: "Sin importe", target: 0, saved: 0, targetDate: "2027-01-10" }], startMonth: START, months: 12 }).ignored.map((i) => i.reason), ["sin importe objetivo"]);
});

test("WP-49 · financiación: sin importe, sin reserva (se reparte en los meses que quedan), parcial, financiado y vence ya", () => {
  assert.deepEqual(L.funding({ amount: null, monthKey: "2027-06" }, START), { status: "sin-importe", pct: null, missing: null, monthsLeft: 8, dueNow: false, monthlyNeeded: null });
  assert.deepEqual(L.funding({ amount: 600, reserved: null, monthKey: "2027-02" }, START), { status: "sin-reserva", pct: null, missing: 600, monthsLeft: 4, dueNow: false, monthlyNeeded: 150 });
  assert.deepEqual(L.funding({ amount: 3000, reserved: 1200, monthKey: "2027-07" }, START), { status: "parcial", pct: 40, missing: 1800, monthsLeft: 9, dueNow: false, monthlyNeeded: 200 });
  assert.deepEqual(L.funding({ amount: 8000, reserved: 8000, monthKey: "2027-01" }, START), { status: "financiado", pct: 100, missing: 0, monthsLeft: 3, dueNow: false, monthlyNeeded: 0 });
  assert.deepEqual(L.funding({ amount: 1200, reserved: null, monthKey: "2026-10" }, START), { status: "sin-reserva", pct: null, missing: 1200, monthsLeft: 0, dueNow: true, monthlyNeeded: null }, "vence este mes: no hay meses para repartir");
  assert.equal(L.funding({ amount: 1000, reserved: 999.99, monthKey: "2027-01" }, START).pct, 99, "el porcentaje se redondea hacia abajo: nunca enseña 100 % sin estar completo");
  assert.equal(L.funding({ amount: 1000, reserved: 5000, monthKey: "2027-01" }, START).status, "financiado");
  assert.equal(L.funding({ amount: 1000, reserved: 0, monthKey: "2027-01" }, START).status, "parcial", "un objetivo con 0 € ahorrados está declarado: 0 %, no «sin reserva»");
});

test("WP-49 · un pago que está en el plan y en el inventario de seguros se cuenta una vez (se queda el seguro, con la nota)", () => {
  const map = gold();
  const coche = map.months.flatMap((m) => m.items).filter((item) => item.label === "Seguro coche");
  assert.equal(coche.length, 1);
  assert.equal(coche[0].kind, "policy");
  assert.equal(coche[0].alsoInPlan, "Seguro coche");
  assert.deepEqual(map.merged, [{ plan: "Seguro coche", with: "Seguro coche", monthKey: "2026-11" }]);
  const sameAmount = L.dedupe([
    { id: "a", kind: "plan", label: "Partida X", monthKey: "2027-02", amount: 405, reserved: null },
    { id: "b", kind: "policy", label: "Seguro hogar", monthKey: "2027-02", amount: 410, reserved: null },
  ]);
  assert.equal(sameAmount.items.length, 1, "importe a menos de un 2 % en el mismo mes");
  const different = L.dedupe([
    { id: "a", kind: "plan", label: "Partida X", monthKey: "2027-02", amount: 600, reserved: null },
    { id: "b", kind: "policy", label: "Seguro hogar", monthKey: "2027-02", amount: 410, reserved: null },
  ]);
  assert.equal(different.items.length, 2, "otro nombre y otro importe: dos pagos");
  const otherMonth = L.dedupe([
    { id: "a", kind: "plan", label: "Seguro hogar", monthKey: "2027-03", amount: 410, reserved: null },
    { id: "b", kind: "policy", label: "Seguro hogar", monthKey: "2027-02", amount: 410, reserved: null },
  ]);
  assert.equal(otherMonth.items.length, 2, "otro mes: otro pago");
  const tax = L.dedupe([
    { id: "a", kind: "plan", label: "Renta", monthKey: "2027-06", amount: null, reserved: null },
    { id: "b", kind: "tax", label: "Campaña de la Renta (pago o devolución)", monthKey: "2027-06", amount: null, reserved: null },
  ]);
  assert.equal(tax.items.length, 2, "Hacienda no absorbe partidas del plan: no se sabe si es la misma");
});

test("WP-49 · caso de oro: cifras a mano de la ventana oct-2026 … sep-2027", () => {
  const map = gold();
  const totals = Object.fromEntries(map.months.map((m) => [m.monthKey, m.total]));
  assert.deepEqual(totals, { "2026-10": 3200, "2026-11": 620, "2026-12": 0, "2027-01": 8000, "2027-02": 410, "2027-03": 900, "2027-04": 0, "2027-05": 0, "2027-06": 0, "2027-07": 3000, "2027-08": 0, "2027-09": 0 });
  const s = map.summary;
  assert.equal(s.count, 8, "colegio, reforma, seguro coche, coche, seguro hogar, IBI, renta y vacaciones");
  assert.equal(s.countWithAmount, 7);
  assert.equal(s.unknownCount, 1, "la Renta: sin importe, no suma");
  assert.equal(s.belowThreshold, 1, "el seguro del móvil (90 €) no es grande");
  assert.equal(s.total, 16130);
  assert.equal(s.fundedTotal, 9700, "500 de la reforma + 8.000 del coche + 1.200 de las vacaciones");
  assert.equal(s.missingTotal, 6430);
  assert.equal(s.fundedPct, 60);
  assert.deepEqual(s.peak, { monthKey: "2027-01", total: 8000 });
  assert.equal(s.top3Share, 88, "(8.000 + 3.200 + 3.000) / 16.130");
  assert.equal(s.reserveMonthly, 1102.5, "620 (seguro coche, 1 mes) + 102,50 (seguro hogar, 4) + 180 (IBI, 5) + 200 (vacaciones, 9)");
  assert.equal(s.reserveCount, 4);
  assert.equal(s.dueNowTotal, 2700, "colegio 1.200 + lo que falta de la reforma, 1.500");
  assert.equal(s.dueNowCount, 2);
  assert.deepEqual(map.ignored.map((item) => item.label).sort(), ["Póliza rota", "Sin fecha"]);
  assert.equal(find(map, "Colegio").funding.status, "sin-reserva", "el plan no reserva nada: no se inventa un «0 % financiado»");
  assert.equal(find(map, "Vacaciones").funding.pct, 40);
  assert.equal(find(map, "Coche").funding.status, "financiado");
  const renta = find(map, "Campaña de la Renta (pago o devolución)");
  assert.deepEqual([renta.amount, renta.estimated, renta.funding.status], [null, true, "sin-importe"]);
  assert.deepEqual(map.months[0].items.map((item) => item.label), ["Reforma", "Colegio"], "dentro del mes, primero lo más caro cuando no hay día");
});

test("WP-49 · la frase dice lo que se sabe y lo que no", () => {
  const sentence = L.describe(gold(), { labelOf: (key) => `«${key}»`, euros: (value) => `${value} €` });
  assert.match(sentence, /7 pagos grandes que suman 16130 €/);
  assert.match(sentence, /1 más sin importe, fuera de la suma/);
  assert.match(sentence, /«2027-01» \(8000 €\)/);
  assert.match(sentence, /88 %/);
  assert.match(sentence, /9700 € reservado \(60 %\)/);
  assert.match(L.describe(L.assemble({ startMonth: START }), {}), /No hay pagos grandes/);
  const one = L.assemble({ rows: [series("i", "IBI", { "2027-03": 900 })], startMonth: START, months: 12 });
  assert.match(L.describe(one, {}), /hay 1 pago grande que suma 900 €/, "singular");
  const none = L.assemble({ rows: [series("i", "IBI", { "2027-03": 900 })], startMonth: START, months: 12 });
  assert.match(L.describe(none, {}), /No hay nada reservado de forma declarada/);
  const onlyUnknown = L.assemble({ calendar: calendar(), startMonth: START, months: 12 });
  assert.match(L.describe(onlyUnknown, {}), /ninguno con importe conocido/);
});

test("WP-49 · propiedad (200 hogares al azar): los meses suman el total, lo reservado no pasa del coste y nada sale de la ventana", () => {
  let seed = 49;
  const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  for (let run = 0; run < 200; run += 1) {
    const months = L.monthsFrom(START, 12);
    const planRows = Array.from({ length: Math.floor(rand() * 5) }, (_, i) => series(`r${i}`, `Partida ${i}`, Object.fromEntries(months.filter(() => rand() < 0.4).map((key) => [key, Math.round(rand() * 2000)]))));
    const pol = Array.from({ length: Math.floor(rand() * 4) }, (_, i) => ({ id: `p${i}`, name: `Póliza ${i}`, renewalDate: `20${24 + Math.floor(rand() * 4)}-${String(1 + Math.floor(rand() * 12)).padStart(2, "0")}-${String(1 + Math.floor(rand() * 28)).padStart(2, "0")}`, premium: rand() < 0.2 ? null : Math.round(rand() * 900) }));
    const gl = Array.from({ length: Math.floor(rand() * 4) }, (_, i) => ({ id: `g${i}`, name: `Objetivo ${i}`, target: Math.round(rand() * 6000), saved: Math.round(rand() * 6000), targetDate: `20${26 + Math.floor(rand() * 2)}-${String(1 + Math.floor(rand() * 12)).padStart(2, "0")}-15`, status: "active" }));
    const input = deepFreeze({ rows: planRows, policies: pol, goals: gl, calendar: calendar(), startMonth: START, months: 12, today: TODAY, minAmount: [300, 500, 1000][run % 3] });
    const map = L.assemble(input);
    const placed = map.months.flatMap((m) => m.items);
    assert.equal(map.months.length, 12);
    assert.equal(L.assemble(input).summary.total, map.summary.total, "mismo resultado con la misma entrada");
    assert.equal(Math.round(map.months.reduce((sum, m) => sum + m.total, 0) * 100) / 100, map.summary.total);
    assert.equal(map.summary.count, placed.length);
    assert.ok(map.summary.fundedTotal <= map.summary.total + 0.005);
    assert.ok(placed.every((item) => map.months.some((m) => m.monthKey === item.monthKey && m.items.includes(item))));
    placed.forEach((item) => {
      assert.ok(item.amount === null || item.amount >= input.minAmount, "nada por debajo del mínimo (salvo lo desconocido)");
      assert.ok(item.funding.missing === null || item.funding.missing >= 0);
      if (item.funding.status === "financiado") assert.equal(item.funding.missing, 0);
    });
    const ids = placed.map((item) => item.id);
    assert.equal(new Set(ids).size, ids.length, "ningún pago repetido");
  }
});

test("WP-49 · la entrada no se modifica y el motor es puro (sin DOM, red, almacenamiento ni reloj)", () => {
  assert.doesNotThrow(() => L.assemble(deepFreeze({ rows: rows(), policies: policies(), goals: goals(), calendar: calendar(), startMonth: START, months: 12, today: TODAY })));
  const source = read("canonical-large-payments.js");
  ["document", "window", "fetch(", "localStorage", "sessionStorage", "XMLHttpRequest", "Date.now", "new Date()", "Math.random"].forEach((banned) => {
    assert.equal(source.includes(banned), false, `el motor no debe usar ${banned}`);
  });
});

test("WP-49 · lo cableado: tarjeta en Plan › Previsión, hoja y script en las listas, y el motor tiene consumidor real", () => {
  const html = read("index.html");
  assert.match(html, /id="mapaPagosCard"/);
  assert.match(html, /id="mapaPagosCuerpo"/);
  assert.match(html, /canonical-large-payments\.js\?v=/);
  assert.match(html, /mapa-pagos-ui\.js\?v=/);
  assert.match(html, /mapa-pagos\.css\?v=/);
  ["canonical-large-payments.js", "mapa-pagos-ui.js", "mapa-pagos.css"].forEach((file) => {
    assert.match(read("service-worker.js"), new RegExp(`"\\./${file.replace(".", "\\.")}"`));
    assert.match(read("tools/build-public-site.mjs"), new RegExp(`"${file.replace(".", "\\.")}"`));
  });
  assert.match(codigoApp(), /renderMapaPagos\?\.\(globalThis\.FinanceCanonicalLargePayments\)/);
  const ui = read("mapa-pagos-ui.js");
  assert.match(ui, /FinanceCanonicalLargePayments/);
  assert.equal(/storageSet|localStorage/.test(ui), false, "no tiene almacén propio: solo lee");
});
