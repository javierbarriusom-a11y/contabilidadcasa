const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const E = require("../canonical-expected-movements.js");

// WP-14 (cobros esperados) + WP-27 (cargos que no llegaron), docs/WP14_WP27_DISENO.md. Motor puro: QUÉ se pregunta y QUÉ se hace con cada
// respuesta. Lo que más importa es lo que NO pregunta: fechas de relleno, gastos sin extracto al día, lo ya respondido.

const today = "2026-11-05";
const income = (over = {}) => ({ id: "income|nomina|2026-10", kind: "income", seriesKey: "income|nomina", label: "Nómina Javi", month: "2026-10", expectedDate: "2026-10-31", certain: true, plannedAmount: 3000, ...over });
const expense = (over = {}) => ({ id: "expense|seguro|2026-10", kind: "expense", seriesKey: "expense|seguro", label: "Seguro del coche", month: "2026-10", expectedDate: "2026-10-05", certain: true, plannedAmount: 80, ...over });
const detect = (expectations, extra = {}) => E.detect({ today, ledgerCoveredUntil: "2026-11-04", expectations, ...extra });

test("sin la fecha de hoy no hay preguntas: dice qué falta", () => {
  const r = E.detect({});
  assert.equal(r.status, "missing");
  assert.deepEqual(r.missing, ["la fecha de hoy"]);
});

// ---- cobros (WP-14) ----
test("cobro: pregunta pasados 2 días de la fecha esperada, con las tres respuestas", () => {
  const r = detect([income()]);
  assert.equal(r.items.length, 1);
  const item = r.items[0];
  assert.equal(item.daysLate, 5);
  assert.deepEqual(item.responses.map((response) => response.key), ["yes", "yesOther", "notYet"]);
  assert.equal(item.responses[1].needsAmount, true);
});

test("cobro: no pregunta antes de tiempo (día esperado, +1 y +2) y sí el tercer día", () => {
  const at = (date) => E.detect({ today: date, expectations: [income({ expectedDate: "2026-10-31" })] }).items.length;
  assert.deepEqual(["2026-10-31", "2026-11-01", "2026-11-02"].map(at), [0, 0, 0]);
  assert.equal(at("2026-11-03"), 1);
});

test("cobro: se pregunta aunque no haya extracto importado (la respuesta es la forma más barata de registrarlo)", () => {
  assert.equal(E.detect({ today, ledgerCoveredUntil: null, expectations: [income()] }).items.length, 1);
});

// ---- cargos (WP-27) ----
test("cargo: pregunta tras la ventana (1 día) + 3 días de margen, con las cuatro respuestas", () => {
  const at = (date) => E.detect({ today: date, ledgerCoveredUntil: date, expectations: [expense({ expectedDate: "2026-10-05" })] }).items.length;
  assert.deepEqual(["2026-10-06", "2026-10-07", "2026-10-09"].map(at), [0, 0, 0]);
  assert.equal(at("2026-10-10"), 1);
  assert.deepEqual(detect([expense()]).items[0].responses.map((response) => response.key), ["cancelled", "moved", "late", "paid"]);
});

test("cargo: SIN extracto al día no pregunta (no aparece ≠ no lo he importado) y lo cuenta como «no verificable»", () => {
  const stale = E.detect({ today, ledgerCoveredUntil: "2026-10-03", expectations: [expense()] });
  assert.deepEqual(stale.items, []);
  assert.equal(stale.silent.unverifiable, 1);
  assert.equal(E.detect({ today, ledgerCoveredUntil: null, expectations: [expense()] }).silent.unverifiable, 1);
  // El extracto llega justo hasta el día en que ya tocaba preguntar: sí se puede decir.
  assert.equal(E.detect({ today, ledgerCoveredUntil: "2026-10-09", expectations: [expense()] }).items.length, 0);
  assert.equal(E.detect({ today, ledgerCoveredUntil: "2026-10-10", expectations: [expense()] }).items.length, 1);
});

// ---- lo que no se pregunta ----
test("no pregunta por fechas de relleno, por lo ya llegado ni por lo ya anulado; lo cuenta aparte", () => {
  const r = detect([income({ id: "a", certain: false }), income({ id: "b", arrived: true }), expense({ id: "c", cancelled: true }), income({ id: "d", expectedDate: "2026-11-04" })]);
  assert.deepEqual(r.items, []);
  assert.deepEqual(r.silent, { uncertain: 1, arrived: 2, unverifiable: 0, notYetDue: 1, moved: 0 });
});

test("ignora lo mal formado sin romper", () => {
  const r = detect([null, {}, { id: "x", kind: "otra", expectedDate: "2026-10-01" }, income({ expectedDate: "ayer" }), income({ id: "" })]);
  assert.deepEqual(r.items, []);
});

// ---- respuestas que callan ----
test("«aún no» calla N días y luego vuelve a preguntar, contando los aplazamientos", () => {
  const item = detect([income()]).items[0];
  const answered = E.resolve({ item, response: "notYet", today });
  assert.deepEqual(answered.patch, { type: "snooze", id: item.id, until: "2026-11-07", count: 1 });
  const answers = E.applyPatch(null, answered.patch);
  const during = E.detect({ today: "2026-11-06", expectations: [income()], answers });
  assert.deepEqual(during.items, []);
  assert.equal(during.waiting.length, 1);
  assert.equal(during.waiting[0].until, "2026-11-07");
  const after = E.detect({ today: "2026-11-07", expectations: [income()], answers });
  assert.equal(after.items.length, 1);
  assert.equal(after.items[0].snoozeCount, 1);
  const again = E.resolve({ item: after.items[0], response: "notYet", today: "2026-11-07" });
  assert.equal(again.patch.count, 2);
});

test("«llegará tarde» (cargo) calla 3 días", () => {
  const item = detect([expense()]).items[0];
  assert.equal(E.resolve({ item, response: "late", today }).patch.until, "2026-11-08");
});

test("«ha cambiado de cuenta» calla la serie entera desde ese mes, pero no las anteriores", () => {
  const item = detect([expense()]).items[0];
  const answered = E.resolve({ item, response: "moved", today });
  assert.deepEqual(answered.effect, { type: "none" }, "la previsión no cambia: la salida sigue existiendo, solo cambia de cuenta");
  const answers = E.applyPatch(null, answered.patch);
  const later = detect([expense({ id: "expense|seguro|2026-11", month: "2026-11", expectedDate: "2026-11-05" }), expense({ id: "expense|seguro|2026-09", month: "2026-09", expectedDate: "2026-09-05" })], { answers, today: "2026-11-30", ledgerCoveredUntil: "2026-11-30" });
  assert.deepEqual(later.items.map((entry) => entry.month), ["2026-09"], "septiembre es anterior a la respuesta: se sigue preguntando");
  assert.equal(later.silent.moved, 1);
});

// ---- efectos ----
test("«sí» y «ya está pagado de otra forma» registran el real por el importe previsto", () => {
  const paid = E.resolve({ item: detect([expense()]).items[0], response: "paid", today });
  assert.deepEqual(paid.effect, { type: "setActual", kind: "expense", seriesKey: "expense|seguro", month: "2026-10", amount: 80 });
  const yes = E.resolve({ item: detect([income()]).items[0], response: "yes", today });
  assert.deepEqual(yes.effect, { type: "setActual", kind: "income", seriesKey: "income|nomina", month: "2026-10", amount: 3000 });
  assert.equal(yes.patch, null);
});

test("«sí, otro importe» exige un importe válido y lo lee como se escribe en España", () => {
  const item = detect([income()]).items[0];
  assert.equal(E.resolve({ item, response: "yesOther", today }).ok, false);
  assert.equal(E.resolve({ item, response: "yesOther", today, amount: "" }).ok, false);
  assert.equal(E.resolve({ item, response: "yesOther", today, amount: "no" }).ok, false);
  assert.equal(E.resolve({ item, response: "yesOther", today, amount: -5 }).ok, false);
  assert.equal(E.resolve({ item, response: "yesOther", today, amount: "2.950,50" }).effect.amount, 2950.5);
  assert.equal(E.resolve({ item, response: "yesOther", today, amount: "0" }).effect.amount, 0, "cero es un importe (el cobro llegó a cero)");
  assert.equal(E.resolve({ item, response: "yesOther", today, amount: 3100 }).effect.amount, 3100);
});

test("«se ha dado de baja» anula la serie desde ese mes; una respuesta de otro tipo se rechaza", () => {
  const item = detect([expense()]).items[0];
  assert.deepEqual(E.resolve({ item, response: "cancelled", today }).effect, { type: "deleteFrom", kind: "expense", seriesKey: "expense|seguro", fromMonth: "2026-10" });
  assert.equal(E.resolve({ item, response: "yes", today }).ok, false, "«sí» es de cobros");
  assert.equal(E.resolve({ item: detect([income()]).items[0], response: "cancelled", today }).ok, false, "«baja» es de cargos");
  assert.equal(E.resolve({ item, response: "zzz", today }).ok, false);
});

// ---- orden y límites ----
test("orden: cobros antes que cargos, lo más atrasado primero; tope de 5 con el resto contado", () => {
  const many = [
    expense({ id: "e1", expectedDate: "2026-10-01" }), income({ id: "i1", expectedDate: "2026-10-30" }), income({ id: "i2", expectedDate: "2026-10-25" }),
    expense({ id: "e2", expectedDate: "2026-10-02" }), expense({ id: "e3", expectedDate: "2026-10-03" }), expense({ id: "e4", expectedDate: "2026-10-04" }),
  ];
  const r = detect(many);
  assert.deepEqual(r.items.map((item) => item.id), ["i2", "i1", "e1", "e2", "e3"]);
  assert.equal(r.overflow, 1);
});

test("el historial del recibo (los últimos 6 cargos) viaja con la pregunta", () => {
  const history = Array.from({ length: 9 }, (_, index) => ({ date: `2026-0${index + 1}-05`, amount: 80 }));
  assert.equal(detect([expense({ history })]).items[0].history.length, 6);
  assert.deepEqual(detect([expense({ history: [{ date: "mal", amount: 1 }] })]).items[0].history, []);
});

// ---- almacén de respuestas ----
test("el almacén se normaliza (lo dañado no rompe) y se poda a dos meses", () => {
  assert.deepEqual(E.normalizeAnswers("basura"), { snoozes: {}, moved: {} });
  assert.deepEqual(E.normalizeAnswers({ snoozes: { a: { until: "no" }, b: { until: "2026-11-07", count: 0 } }, moved: { s: { since: "2026-10-05" }, t: {} } }), { snoozes: { b: { until: "2026-11-07", count: 1 } }, moved: { s: { since: "2026-10" } } });
  const pruned = E.prune({ snoozes: { viejo: { until: "2026-08-01", count: 1 }, nuevo: { until: "2026-11-07", count: 1 } }, moved: { s: { since: "2026-01" } } }, today);
  assert.deepEqual(Object.keys(pruned.snoozes), ["nuevo"]);
  assert.ok(pruned.moved.s, "«ha cambiado de cuenta» no caduca");
});

test("«ningún recibo esperado sin estado más de 3 días»: cuenta las preguntas atrasadas de verdad", () => {
  const fresh = detect([income({ expectedDate: "2026-11-02" })]);
  assert.equal(E.staleCount(fresh), 0);
  assert.equal(E.staleCount(detect([income({ expectedDate: "2026-10-20" })])), 1);
});

// ---- cableado ----
const read = (name) => fs.readFileSync(path.join(__dirname, "..", name), "utf8");
test("no hay azar, red ni DOM en el motor", () => {
  assert.doesNotMatch(read("canonical-expected-movements.js"), /Math\.random|fetch\(|document\.|window\.|localStorage/);
});

test("cableado: motor y pantalla antes que app.js, service worker, build público, bandeja de Hoy, almacén en la copia y enganche en init", () => {
  const html = read("index.html");
  ["canonical-expected-movements.js", "esperados-ui.js"].forEach((file) => {
    assert.match(html, new RegExp(`<script defer src="${file.replace(".", "\\.")}\\?v=[^"]+"></script>`));
    assert.ok(html.indexOf(`src="${file}`) < html.indexOf('src="app.js'), `${file} debe cargarse antes que app.js`);
  });
  assert.match(read("service-worker.js"), /"\.\/canonical-expected-movements\.js"[\s\S]*"\.\/esperados-ui\.js"/);
  assert.match(read("tools/build-public-site.mjs"), /"canonical-expected-movements\.js"[\s\S]*"esperados-ui\.js"/);
  const app = read("app.js");
  assert.equal((app.match(/expectedMovementInboxItems\?\.\(globalThis\.FinanceCanonicalExpectedMovements\)/g) || []).length, 1);
  assert.equal((app.match(/attachEsperados\?\.\(document\)/g) || []).length, 1);
  assert.match(app, /"expected-answers", \/\/ WP-14 \+ WP-27/, "las respuestas viajan en la copia: callan preguntas y un recibo que cambió de cuenta no debe volver a preguntarse en otro dispositivo");
  assert.match(app, /\$\{item\.html \|\| `<button type="button" class="link-button" data-home-nav=/, "la bandeja admite acciones propias y conserva «Revisar ahora» para el resto");
});

test("la pantalla no toca el DOM al cargarse, y excluye el gasto variable (no hay recibo que esperar)", () => {
  const source = read("esperados-ui.js");
  assert.doesNotMatch(source.split("function loadExpectedAnswers")[0], /document\.|addEventListener|qs\(/);
  assert.match(source, /section\.name === VARIABLE_OPERATIONAL_SECTION \|\| isVariableOperationalRow\(row\)/);
  assert.match(source, /typeof baseData === "undefined"/, "baseData es un let de app.js: no cuelga de globalThis");
  assert.match(source, /catch \(error\) \{\s*console\.error\(`expectedMovementInboxItems/);
});
