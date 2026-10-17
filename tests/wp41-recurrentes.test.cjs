const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const S = require("../canonical-shadow-debt.js");

// WP-41 PR-4 (docs/WP41_DISENO.md §8): los cargos que se repiten cada mes y que el detector NO marca salen aparte, en una lista de solo lectura. Lo que el hogar debe
// poder fiar: que no se confundan con avisos (ni cuenten en totales ni en Cierre), que no salgan por un gasto cualquiera repetido, que lo ya dado de alta no se repita
// y que la lista no esconda lo que el detector sí marca.

const tx = (date, amount, movement, details = "") => ({ date, month: date.slice(0, 7), movement, details, amount });
const today = "2026-10-15";
const detect = (rows, extra = {}) => S.detectShadowDebt({ today, transactions: rows, ...extra });
const monthly = (name, amount, dates = ["2026-08-03", "2026-09-03", "2026-10-03"]) => dates.map((date) => tx(date, -amount, name));

test("WP-41 PR-4 · un cargo mensual sin pista sale en la lista aparte y NO es un aviso", () => {
  const r = detect(monthly("VIDEO STREAMING", 12.99));
  assert.equal(r.status, "ok");
  assert.equal(r.items.length, 0, "sin pista de financiación no es deuda");
  assert.equal(r.recurring.total, 1);
  assert.deepEqual(r.recurring.items, [{ label: "VIDEO STREAMING", monthlyAmount: 12.99, charges: 3, lastDate: "2026-10-03" }]);
  assert.equal(r.monthlyTotal, 0, "no suma en el total mensual de compromisos");
  assert.deepEqual(S.closeNotice(r, { fmt: String }), { show: false }, "y no genera el aviso de Cierre");
});

test("WP-41 PR-4 · con dos cargos no basta: cualquier gasto repetido entraría", () => {
  const r = detect(monthly("GIMNASIO", 30, ["2026-09-03", "2026-10-03"]));
  assert.equal(r.recurring.total, 0);
});

test("WP-41 PR-4 · lo que el detector SÍ marca no se duplica en la lista aparte", () => {
  const r = detect([...monthly("MOVISTAR CUOTA TERMINAL 1 DE 24", 30), ...monthly("VIDEO STREAMING", 12.99)]);
  assert.equal(r.items.length, 1);
  assert.match(r.items[0].label, /MOVISTAR/);
  assert.deepEqual(r.recurring.items.map((i) => i.label), ["VIDEO STREAMING"]);
  const kw = detect(monthly("COMPRA FINANCIADA TIENDA X", 25));
  assert.equal(kw.items.length, 1);
  assert.equal(kw.recurring.total, 0, "con palabra de financiación es un aviso, no un cargo sin marcar");
});

test("WP-41 PR-4 · importe que varía o cadencia que no es mensual: no sale", () => {
  const variable = detect([tx("2026-08-03", -40, "SUMINISTRO LUZ"), tx("2026-09-03", -55, "SUMINISTRO LUZ"), tx("2026-10-03", -48, "SUMINISTRO LUZ")]);
  assert.equal(variable.recurring.total, 0, "el importe cambia más del 2 %");
  const diario = detect(["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"].map((date) => tx(date, -2.5, "CAFETERIA ESQUINA")));
  assert.equal(diario.recurring.total, 0, "cada día no es mensual");
  const trimestral = detect(monthly("SEGURO COCHE", 90, ["2026-04-03", "2026-07-03", "2026-10-03"]));
  assert.equal(trimestral.recurring.total, 0, "cada tres meses tampoco");
});

test("WP-41 PR-4 · un cargo que ya no se cobra no sale", () => {
  const viejo = S.detectShadowDebt({ today: "2026-10-15", transactions: [...monthly("GIMNASIO", 30, ["2026-05-03", "2026-06-03", "2026-07-03"]), tx("2026-10-10", -1, "OTRO")] });
  assert.equal(viejo.recurring.total, 0, "el último es de hace más de 45 días");
});

test("WP-41 PR-4 · hipotecas y préstamos no se listan (ya son contratos y se concilian con la CIRBE)", () => {
  const r = detect([...monthly("RECIBO PRESTAMO PERSONAL", 200), ...monthly("CUOTA HIPOTECA", 700)]);
  assert.equal(r.recurring.total, 0);
});

test("WP-41 PR-4 · lo que ya está dado de alta en la app no se repite aquí", () => {
  const r = detect(monthly("CAIXA AUTO", 180), { contracts: [{ entity: "Caixa Auto", currentPayment: 180, paymentStatus: "active" }] });
  assert.equal(r.recurring.total, 0);
  const sin = detect(monthly("CAIXA AUTO", 180));
  assert.equal(sin.recurring.total, 1, "sin el contrato sí sale");
});

test("WP-41 PR-4 · ordenada por importe y con tope: se cuenta el total y lo que sobra", () => {
  const rows = [];
  for (let i = 1; i <= 12; i += 1) rows.push(...monthly(`SERVICIO${String.fromCharCode(96 + i)} PLAN`, 10 + i));
  const r = detect(rows);
  assert.equal(r.recurring.total, 12);
  assert.equal(r.recurring.items.length, 10);
  assert.equal(r.recurring.overflow, 2);
  const amounts = r.recurring.items.map((i) => i.monthlyAmount);
  assert.deepEqual(amounts, [...amounts].sort((a, b) => b - a), "de mayor a menor importe");
  assert.equal(amounts[0], 22);
});

test("WP-41 PR-4 · un cargo respondido «no es deuda» sigue sin molestar y no cambia la lista", () => {
  const base = detect(monthly("COMPRA FINANCIADA TIENDA X", 25));
  const answers = S.applyAnswer(null, base.items[0], "not-debt", "2026-10-15");
  const r = detect(monthly("COMPRA FINANCIADA TIENDA X", 25), { answers });
  assert.equal(r.items.length, 0);
  assert.equal(r.suppressed, 1);
  assert.equal(r.recurring.total, 0, "lo respondido no pasa a la lista de no marcados");
});

test("WP-41 PR-4 · sin extracto al día no hay lista: se dice que no se puede mirar", () => {
  const viejo = S.detectShadowDebt({ today: "2027-03-01", transactions: monthly("VIDEO STREAMING", 12.99) });
  assert.equal(viejo.status, "stale");
  assert.equal(viejo.recurring, undefined);
});

// --- Pantalla: se carga sombra-ui.js en un ámbito con lo mínimo que comparte con app.js.
function loadUi() {
  const sandbox = {
    escapeHtml: (value) => String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]),
    money: (value) => `${Number(value).toFixed(2).replace(".", ",")} €`,
    escenarioMotorMonthLabel: (key) => key,
    estadoHtml: ({ titulo }) => `<p>${titulo}</p>`,
    qs: () => null,
    storageGet: (key, fallback) => fallback,
    storageKey: (name) => name,
  };
  vm.createContext(sandbox);
  vm.runInContext(`${read("sombra-ui.js")}\nthis.sombraBodyHtml = sombraBodyHtml; this.sombraRecurringHtml = sombraRecurringHtml;`, sandbox);
  return sandbox;
}
const plain = (value) => JSON.parse(JSON.stringify(value));

test("WP-41 PR-4 · la pantalla enseña la lista plegada, sin botones, en las dos situaciones", () => {
  const ui = loadUi();
  const nada = plain(detect(monthly("VIDEO STREAMING", 12.99)));
  const vacio = ui.sombraBodyHtml(nada);
  assert.match(vacio, /No he encontrado compromisos/, "sigue diciendo que no ha encontrado deuda");
  assert.match(vacio, /<details class="som-recurrentes"[^>]*>/);
  assert.match(vacio, /1 cargo que se repite cada mes y que no he marcado/);
  assert.match(vacio, /VIDEO STREAMING/);
  assert.match(vacio, /12,99 € al mes · 3 cargos · el último, el 3\/10\/2026/);
  assert.doesNotMatch(vacio.slice(vacio.indexOf("som-recurrentes")), /<button/, "es de solo lectura");
  assert.doesNotMatch(vacio, /<details class="som-recurrentes"[^>]*\bopen\b/, "llega plegada");
  const con = ui.sombraBodyHtml(plain(detect([...monthly("MOVISTAR CUOTA TERMINAL 1 DE 24", 30), ...monthly("VIDEO STREAMING", 12.99)])));
  assert.match(con, /data-sombra-anadir/, "los avisos siguen con sus botones");
  assert.match(con, /som-recurrentes/, "y la lista aparte también sale");
});

test("WP-41 PR-4 · si estaba abierta al repintar (p. ej. tras responder un aviso), sigue abierta", () => {
  const ui = loadUi();
  const result = plain(detect(monthly("VIDEO STREAMING", 12.99)));
  assert.doesNotMatch(ui.sombraBodyHtml(result), /id="sombraRecurrentes" open/);
  assert.match(ui.sombraBodyHtml(result, { recurringOpen: true }), /id="sombraRecurrentes" open/);
  assert.match(read("sombra-ui.js"), /recurringOpen: Boolean\(qs\("sombraRecurrentes"\)\?\.open\)/, "renderDeudaSombra pasa el estado actual");
});

test("WP-41 PR-4 · sin cargos sin marcar no sale nada (ni un «0 cargos») y el concepto se escapa", () => {
  const ui = loadUi();
  assert.equal(ui.sombraRecurringHtml(plain(detect([]))), "");
  assert.equal(ui.sombraRecurringHtml(plain(detect(monthly("GIMNASIO", 30, ["2026-09-03", "2026-10-03"])))), "");
  const malo = ui.sombraRecurringHtml(plain(detect(monthly("<img src=x onerror=alert(1)> CLUB", 20))));
  assert.doesNotMatch(malo, /<img/);
  assert.match(malo, /&lt;img/);
  const mucho = [];
  for (let i = 1; i <= 12; i += 1) mucho.push(...monthly(`SERVICIO${String.fromCharCode(96 + i)} PLAN`, 10 + i));
  assert.match(ui.sombraRecurringHtml(plain(detect(mucho))), /12 cargos que se repiten.*Hay 2 más, de menor importe/s);
});

test("WP-41 PR-4 · cableado: sellos de versión nuevos y estilos propios en la hoja de la tarjeta", () => {
  const index = read("index.html");
  assert.match(index, /sombra\.css\?v=\d+wp41d1/);
  assert.match(index, /canonical-shadow-debt\.js\?v=\d+wp41d1/);
  assert.match(index, /sombra-ui\.js\?v=\d+wp41d1/);
  const css = read("sombra.css");
  assert.match(css, /\.som-recurrentes-lista li/);
  assert.doesNotMatch(css.slice(css.indexOf("PR-4")), /#[0-9a-f]{3,6}\b/i, "solo tokens, ningún color suelto");
});
