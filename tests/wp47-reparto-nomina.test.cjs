const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const P = require("../canonical-payroll-split.js");
const Ladder = require("../canonical-next-euro.js");
const Band = require("../canonical-cash-band.js");

// WP-47 (NPV-05): reparto de la nómina en un paso. Lo que el hogar debe poder fiar: que nunca se reparta más que lo que cabe sobre el suelo, que los «steppers» no cambien el total ni
// dejen un importe negativo, que lo que la escalera no propone se marque como distinto, y que «Aplicar» solo apunte una lista (nada se ejecuta ni se anota).

const payroll = (id, amount, label = "Nómina") => ({ id, label, amount });
const money = (value) => Math.round(value * 100) / 100;
const total = (rows) => money(rows.reduce((sum, row) => sum + row.amount, 0));

const ladderFor = (amount, overrides = {}) => Ladder.buildLadder({
  amount, amountInAccounts: false, liquidity: 4000, floor: 3000,
  debts: [{ id: "d1", entity: "Tarjeta Ficticia", currentPrincipal: 400, effectiveAprPct: 21 }, { id: "d2", entity: "Préstamo coche", currentPrincipal: 5000, effectiveAprPct: 3 }],
  investment: { expectedReturnPct: 7, savingsTaxPct: 19 }, pension: { year: 2026, alreadyContributed: 0, marginalRatePct: 37 },
  portfolio: { totalsByType: { fondo: 8000, renta_fija: 2000 }, targets: { fondo: 60, renta_fija: 40 } }, ...overrides,
});
const debts = [{ id: "d1", entity: "Tarjeta Ficticia", currentPrincipal: 400 }, { id: "d2", entity: "Préstamo coche", currentPrincipal: 5000 }];
const rowsFor = (available, ladderOverrides = {}) => P.rowsFromLadder({ ladder: ladderFor(available, ladderOverrides), available, debts, caps: { pension: 1500 }, investTypes: ["fondo", "renta_fija"] });

test("WP-47 · el disponible es el MENOR entre la nómina y la holgura sobre el suelo", () => {
  const limited = P.availableToSplit({ payrolls: [payroll("a", 3000)], headroom: 1200 });
  assert.equal(limited.available, 1200);
  assert.equal(limited.limitedBy, "floor");
  assert.equal(limited.basis, "band");
  assert.match(limited.notes[0], /3000 €.*1200 €/);
  const free = P.availableToSplit({ payrolls: [payroll("a", 3000)], headroom: 8000 });
  assert.equal(free.available, 3000);
  assert.equal(free.limitedBy, "payroll");
  const two = P.availableToSplit({ payrolls: [payroll("a", 2000), payroll("b", 1500.5)], headroom: 9999 });
  assert.equal(two.available, 3500.5, "varias nóminas se suman");
});

test("WP-47 · sin holgura calculable no se inventa: nómina entera, marcada «sin comprobar»", () => {
  const r = P.availableToSplit({ payrolls: [payroll("a", 3000)], headroom: null });
  assert.equal(r.available, 3000);
  assert.equal(r.basis, "payroll-only");
  assert.match(r.notes[0], /SIN comprobar/);
  assert.equal(P.availableToSplit({ payrolls: [payroll("a", 3000)] }).basis, "payroll-only", "ausente no es cero ni holgura infinita");
});

test("WP-47 · con la liquidez ya en el suelo (holgura ≤ 0) no hay nada que repartir, y se dice", () => {
  const r = P.availableToSplit({ payrolls: [payroll("a", 3000)], headroom: -250 });
  assert.equal(r.available, 0);
  assert.equal(r.status, "none");
  assert.match(r.notes.join(" "), /ya está en el suelo/);
  assert.equal(P.availableToSplit({ payrolls: [payroll("a", 3000)], headroom: 0 }).status, "none");
});

test("WP-47 · sin nómina válida no hay reparto; lo mal formado se ignora", () => {
  assert.equal(P.availableToSplit({ payrolls: [] }).status, "no-payroll");
  assert.equal(P.availableToSplit({ payrolls: [{ id: "", amount: 100 }, { id: "x", amount: 0 }, { id: "y", amount: "abc" }, null] }).status, "no-payroll");
  assert.equal(P.availableToSplit().status, "no-payroll");
});

test("WP-47 · las filas parten de la escalera y suman EXACTAMENTE el disponible", () => {
  const rows = rowsFor(3000);
  assert.equal(total(rows), 3000);
  assert.deepEqual(rows.map((row) => row.id), ["cushion", "debt:d1", "debt:d2", "pension", "invest:fondo", "invest:renta_fija", "free"]);
  const byId = Object.fromEntries(rows.map((row) => [row.id, row]));
  assert.equal(byId.cushion.amount, 0, "con 4000 de liquidez y suelo 3000 el colchón ya está completo");
  assert.equal(byId["debt:d1"].amount, 400, "la tarjeta cara, entera");
  assert.equal(byId["debt:d2"].amount, 0, "el préstamo barato no se paga antes: queda a 0 pero editable");
  assert.equal(byId["debt:d2"].max, 5000);
  assert.equal(byId.pension.amount, 1500, "la pensión, hasta su límite anual (tipo marginal 37 %)");
  assert.equal(byId.pension.max, 1500);
  assert.equal(byId["invest:renta_fija"].amount, 1100, "la inversión va a lo que está por debajo de su objetivo, por aportación");
  assert.equal(byId["invest:fondo"].amount, 0, "el tipo que ya pasa de su objetivo queda a 0 pero editable");
  rows.forEach((row) => assert.equal(row.amount, row.suggested, "al empezar, nada difiere de lo sugerido"));
});

test("WP-47 · sin rentabilidad esperada lo que sobra queda en «sin repartir», nunca un 50/50", () => {
  const rows = rowsFor(3000, { investment: {} });
  const free = rows.find((row) => row.id === "free");
  assert.equal(free.amount, 1100, "3000 − 400 de la tarjeta − 1500 de pensión");
  assert.equal(rows.filter((row) => row.group === "invest").reduce((sum, row) => sum + row.amount, 0), 0);
  assert.equal(total(rows), 3000);
});

test("WP-47 · si la escalera propusiera más que el disponible, se recorta desde el final y la suma no se pasa", () => {
  const rows = P.rowsFromLadder({ ladder: { rungs: [{ id: "cushion", amount: 900 }, { id: "pension", amount: 900 }, { id: "invest", amount: 900 }] }, available: 1000 });
  assert.equal(total(rows), 1000);
  assert.equal(rows.find((row) => row.id === "free").amount, 0);
  assert.ok(rows.every((row) => row.amount >= 0));
});

test("WP-47 · un stepper mueve dinero con «sin repartir» y el total no cambia", () => {
  const rows = rowsFor(3000, { investment: {} });
  const free = rows.find((row) => row.id === "free").amount;
  const up = P.moveAmount(rows, "debt:d2", 50);
  assert.equal(up.changed, true);
  assert.equal(up.rows.find((row) => row.id === "debt:d2").amount, 50, "añadir a una fila que la escalera dejó a 0");
  assert.equal(up.rows.find((row) => row.id === "free").amount, money(free - 50));
  assert.equal(total(up.rows), 3000);
  assert.equal(rows.find((row) => row.id === "debt:d2").amount, 0, "no muta las filas de entrada");
});

test("WP-47 · los límites: ni negativo, ni más que el tope de la fila, ni más de lo que queda por repartir", () => {
  const rows = rowsFor(3000, { investment: {} });
  const negative = P.moveAmount(rows, "debt:d1", -9999);
  assert.equal(negative.clamped, "negative");
  assert.equal(negative.rows.find((row) => row.id === "debt:d1").amount, 0);
  assert.equal(total(negative.rows), 3000);
  const freeCap = P.setRowAmount(rows, "debt:d2", 4000);
  assert.equal(freeCap.clamped, "free");
  assert.equal(freeCap.rows.find((row) => row.id === "debt:d2").amount, rows.find((row) => row.id === "free").amount, "como mucho, todo lo que quedaba");
  assert.equal(freeCap.rows.find((row) => row.id === "free").amount, 0);
  const pensionRows = P.rowsFromLadder({ ladder: { rungs: [] }, available: 5000, caps: { pension: 1500 }, debts: [] });
  const maxCap = P.setRowAmount(pensionRows, "pension", 3000);
  assert.equal(maxCap.clamped, "max");
  assert.equal(maxCap.rows.find((row) => row.id === "pension").amount, 1500, "el plan de pensiones no pasa de su límite anual");
  assert.equal(total(maxCap.rows), 5000);
});

test("WP-47 · «sin repartir» no se edita a mano y un valor no numérico no cambia nada", () => {
  const rows = rowsFor(3000);
  assert.equal(P.setRowAmount(rows, "free", 10).changed, false);
  assert.equal(P.setRowAmount(rows, "pension", "abc").changed, false);
  assert.equal(P.setRowAmount(rows, "no-existe", 10).changed, false);
});

test("WP-47 · propiedad: cualquier secuencia de movimientos conserva el total al céntimo y nunca deja un importe negativo", () => {
  let seed = 47;
  const random = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  for (const available of [1500, 1234.56, 99.99, 5000.01]) {
    let rows = rowsFor(available);
    for (let step = 0; step < 300; step += 1) {
      const editable = rows.filter((row) => row.id !== "free");
      const row = editable[Math.floor(random() * editable.length)];
      const action = random();
      const result = action < 0.5 ? P.moveAmount(rows, row.id, [-50, 50, -137.33, 421.07][Math.floor(random() * 4)]) : P.setRowAmount(rows, row.id, money(random() * available * 1.5 - available * 0.1));
      rows = result.rows;
      assert.equal(total(rows), money(available), `total tras ${step} pasos con ${available}`);
      rows.forEach((item) => assert.ok(item.amount >= 0, `${item.id} negativo`));
      rows.filter((item) => Number.isFinite(item.max)).forEach((item) => assert.ok(item.amount <= item.max + 1e-9, `${item.id} pasa de su tope`));
    }
  }
});

test("WP-47 · «volver a lo sugerido» restablece las filas y conserva el total", () => {
  const rows = rowsFor(3000);
  const edited = P.moveAmount(P.moveAmount(rows, "pension", -300).rows, "debt:d1", -100).rows;
  assert.equal(P.summarize(edited).differsFromSuggested, true);
  const back = P.resetRows(edited);
  assert.equal(P.summarize(back).differsFromSuggested, false);
  assert.deepEqual(back.map((row) => row.amount), rows.map((row) => row.amount));
  assert.equal(total(back), 3000);
});

test("WP-47 · la lista de transferencias sigue el orden de la escalera, sin «sin repartir» ni filas a cero", () => {
  const list = P.transferList(rowsFor(3000));
  assert.deepEqual(list.map((item) => item.group), ["debt", "pension", "invest"]);
  assert.ok(list.every((item) => item.amount > 0 && item.done === false));
  assert.ok(!list.some((item) => item.rowId === "free"));
  assert.match(list[0].note, /comisión por amortización anticipada/);
  assert.match(list[1].note, /inmovilizado/);
  const cushion = P.transferList(P.rowsFromLadder({ ladder: ladderFor(3000, { liquidity: 500 }), available: 3000, debts }));
  assert.equal(cushion[0].group, "cushion", "el colchón va primero cuando falta");
});

test("WP-47 · «Aplicar» crea un borrador con sus fuentes y su lista; las nóminas repartidas dejan de ofrecerse y al descartar vuelven", () => {
  const availability = P.availableToSplit({ payrolls: [payroll("a|2026-10", 3000, "Nómina Javi")], headroom: 5000 });
  const rows = rowsFor(availability.available);
  const draft = P.makeDraft({ id: "nom-1", createdAt: "2026-10-12T09:00:00.000Z", month: "2026-10", availability, rows });
  assert.equal(draft.available, 3000);
  assert.equal(draft.basis, "band");
  assert.deepEqual(draft.sources, [{ id: "a|2026-10", label: "Nómina Javi", amount: 3000 }]);
  assert.equal(draft.transfers.length, P.transferList(rows).length);
  let store = P.addDraft({}, draft);
  assert.deepEqual([...P.appliedSourceIds(store)], ["a|2026-10"]);
  assert.equal(P.draftProgress(store.drafts[0]).done, 0);
  store = P.setTransferDone(store, "nom-1", "t1", true);
  assert.equal(P.draftProgress(store.drafts[0]).done, 1);
  store.drafts[0].transfers.forEach((item) => { store = P.setTransferDone(store, "nom-1", item.id, true); });
  assert.equal(P.draftProgress(store.drafts[0]).finished, true);
  store = P.discardDraft(store, "nom-1");
  assert.equal(store.drafts.length, 0);
  assert.equal(P.appliedSourceIds(store).size, 0, "descartar libera la nómina");
});

test("WP-47 · lo apuntado en borradores abiertos se descuenta de la holgura: no se reparte dos veces el mismo dinero", () => {
  const availability = P.availableToSplit({ payrolls: [payroll("a", 3000)], headroom: 1200 });
  const draft = P.makeDraft({ id: "nom-1", createdAt: "2026-10-12T09:00:00.000Z", month: "2026-10", availability, rows: rowsFor(availability.available) });
  let store = P.addDraft({}, draft);
  assert.equal(P.earmarkedAmount(store, "2026-10-10"), 1200, "sin hacer, todo sigue comprometido");
  assert.equal(P.earmarkedAmount(store), 1200, "sin fecha de los saldos se cuenta todo (lo prudente)");
  const second = P.availableToSplit({ payrolls: [payroll("b", 2000)], headroom: 1500, earmarked: P.earmarkedAmount(store, "2026-10-10") });
  assert.equal(second.available, 300, "de 1500 de holgura, 1200 ya están apuntados");
  assert.equal(second.earmarked, 1200);
  assert.match(second.notes.join(" "), /1200 € apuntados en borradores abiertos/);
  // Una transferencia hecha ANTES de la fecha de los saldos ya está en ellos; hecha después, no.
  store = P.setTransferDone(store, "nom-1", "t1", true, "2026-10-11");
  const t1 = store.drafts[0].transfers[0].amount;
  assert.equal(P.earmarkedAmount(store, "2026-10-12"), 1200 - t1, "hecha el 11 y saldos del 12: ya reflejada");
  assert.equal(P.earmarkedAmount(store, "2026-10-10"), 1200, "hecha el 11 y saldos del 10: aún no");
  store = P.setTransferDone(store, "nom-1", "t1", false);
  assert.equal(store.drafts[0].transfers[0].doneAt, "", "desmarcar borra la fecha");
  assert.equal(P.earmarkedAmount(P.discardDraft(store, "nom-1"), "2026-10-10"), 0, "descartar libera lo apuntado");
  // Si lo apuntado se lo come todo, no hay nada que repartir.
  assert.equal(P.availableToSplit({ payrolls: [payroll("b", 2000)], headroom: 1200, earmarked: 1200 }).status, "none");
});

test("WP-47 · el almacén descarta lo mal formado, limita los borradores y recuerda lo apartado y la casilla de saldos", () => {
  assert.deepEqual(P.normalizeStore("nada"), { drafts: [], hidden: {}, prefs: { inAccounts: null } });
  assert.deepEqual(P.normalizeStore({ drafts: [null, { x: 1 }, { id: "ok", transfers: [{ id: "t1", amount: 0 }, { id: "t2", amount: 5, done: "sí" }] }] }).drafts[0].transfers, [{ id: "t2", rowId: "", group: "", amount: 5, label: "", note: "", done: false, doneAt: "" }]);
  let store = {};
  for (let index = 0; index < 20; index += 1) store = P.addDraft(store, { id: `d${index}`, createdAt: "2026-10-12", month: "2026-10", available: 1, basis: "band", sources: [], transfers: [], free: 0 });
  assert.equal(store.drafts.length, P.MAX_DRAFTS);
  assert.equal(store.drafts[0].id, "d19", "el más reciente primero");
  store = P.hideSource(store, "a|2026-10", true);
  assert.equal(P.normalizeStore(store).hidden["a|2026-10"], true);
  assert.equal(P.normalizeStore(P.hideSource(store, "a|2026-10", false)).hidden["a|2026-10"], undefined);
  assert.equal(P.normalizeStore({ prefs: { inAccounts: true } }).prefs.inAccounts, true);
  assert.equal(P.normalizeStore({ prefs: { inAccounts: "x" } }).prefs.inAccounts, null);
});

test("WP-47 · la banda da el mínimo al que llega la trayectoria en 9 de cada 10 casos (valueP10), y es la holgura sobre el suelo", () => {
  // Saldo 2.000, un cargo CIERTO de 700 el día 5 y la nómina de 1.800 el día 10: el mínimo es 1.300 sin incertidumbre.
  const input = {
    asOf: "2026-10-01", today: "2026-10-01", openingTotal: 2000, floor: 1000, horizonDays: 30,
    events: [
      { id: "e1", label: "Alquiler", kind: "expense", amount: 700, date: "2026-10-06", confidence: "declared" },
      { id: "e2", label: "Nómina", kind: "income", amount: 1800, date: "2026-10-11", confidence: "declared" },
    ],
  };
  const certain = Band.simulate(input);
  assert.equal(certain.status, "ok");
  assert.equal(certain.minimum.valueP10, 1300);
  assert.equal(certain.minimum.valueP10, certain.minimum.valueP50, "sin incertidumbre coinciden");
  const headroom = certain.minimum.valueP10 - input.floor;
  assert.equal(headroom, 300, "solo caben 300 € de la nómina por encima del suelo");
  assert.equal(P.availableToSplit({ payrolls: [payroll("n", 1800)], headroom }).available, 300);
  // Con la fecha del cargo incierta, el P10 nunca es mayor que la mediana.
  const uncertain = Band.simulate({ ...input, events: input.events.map((event) => (event.kind === "expense" ? { ...event, confidence: "estimated", date: "2026-10-08" } : event)), seed: 3 });
  assert.ok(uncertain.minimum.valueP10 <= uncertain.minimum.valueP50);
});

test("WP-47 · una partida es nómina si su nombre lo dice (sin acentos ni mayúsculas, palabra entera)", () => {
  ["Nómina Javi", "NOMINA Tere", "salario tere", "Sueldo", "Nóminas", "Paga extra - nómina"].forEach((label) => assert.equal(P.isPayrollLabel(label), true, label));
  ["Ingreso Persona A", "Alquiler local", "Nominal", "Dividendos", "", null, undefined].forEach((label) => assert.equal(P.isPayrollLabel(label), false, String(label)));
});

test("WP-47 · el motor es puro: sin DOM, red, almacenamiento ni reloj", () => {
  const source = read("canonical-payroll-split.js");
  ["document", "window", "fetch(", "localStorage", "sessionStorage", "XMLHttpRequest", "Date.now", "new Date", "Math.random"].forEach((banned) => assert.ok(!source.includes(banned), `no debe usar ${banned}`));
});

test("WP-47 · la tarjeta no ejecuta ni anota nada: ni red, ni movimientos, ni confirm()", () => {
  const source = read("nomina-ui.js");
  ["fetch(", "confirm(", "XMLHttpRequest", "transactions.push", "setActualFor", "baseData.transactions"].forEach((banned) => assert.ok(!source.includes(banned), `no debe usar ${banned}`));
  assert.match(source, /No mueve dinero ni anota ningún movimiento|NO mueve dinero ni anota ningún movimiento/);
  assert.match(source, /showUndoToast\(/, "aplicar, descartar y apartar se pueden deshacer");
});

test("WP-47 · cableado: tarjeta en Deuda › Comparar bajo la escalera, scripts en orden, gancho en app.js, almacén en la copia y listas de ficheros", () => {
  const html = read("index.html");
  assert.ok(html.indexOf('id="proxEuroCard"') < html.indexOf('id="nominaCard"') && html.indexOf('id="nominaCard"') < html.indexOf('id="deudaCompararCapacity"'));
  assert.match(html, /id="nominaCuerpo" aria-live="polite"/);
  const at = (name) => html.indexOf(`<script defer src="${name}?v=`);
  assert.ok(at("escalera-ui.js") > 0 && at("escalera-ui.js") < at("canonical-payroll-split.js") && at("canonical-payroll-split.js") < at("nomina-ui.js"), "el motor y la pantalla van después de la escalera, de la que reutiliza funciones");
  assert.match(html, /href="nomina\.css\?v=/);
  const app = read("app.js");
  assert.match(app, /globalThis\.renderNominaReparto\?\.\(globalThis\.FinanceCanonicalPayrollSplit\); \/\/ WP-47/);
  assert.match(app, /"payroll-split-drafts", \/\/ WP-47/);
  ["service-worker.js", "tools/build-public-site.mjs"].forEach((file) => {
    const source = read(file);
    ["nomina.css", "canonical-payroll-split.js", "nomina-ui.js"].forEach((name) => assert.ok(source.includes(`"${file === "service-worker.js" ? "./" : ""}${name}"`), `${file} lista ${name}`));
  });
});
