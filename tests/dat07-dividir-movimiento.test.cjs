// DAT-07 · Dividir un movimiento (novena auditoría §4.1; visto bueno del hogar del 19/11/2026, «Haz DAT-07 y DEC-12»). Un ticket o
// un Bizum que mezcla cosas se reparte entre varias partidas; cada una recibe su parte en los reales. La división se guarda en la
// regla «solo este movimiento» (movementMappings[identidad]) con la partida mayor como rowKey. Datos de prueba inventados.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { codigoApp } = require("./helpers/codigo-app.cjs");
const S = require("../canonical-movement-split.js");

const app = codigoApp();
const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

function extractFunction(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `no está ${name}`);
  const end = app.indexOf("\n}\n", start);
  return app.slice(start, end + 2);
}

test("DAT-07 · el motor: cuadra solo con dos partidas o más, distintas, mayores que cero y que sumen el movimiento", () => {
  const ok = S.evaluate([{ rowKey: "a", amount: "30,50" }, { rowKey: "b", amount: 69.5 }], -100);
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.parts, [{ rowKey: "a", amount: 30.5 }, { rowKey: "b", amount: 69.5 }]);
  assert.equal(S.mainRowKey(ok.parts), "b");
  const falta = S.evaluate([{ rowKey: "a", amount: "30" }, { rowKey: "b", amount: "60" }], 100);
  assert.equal(falta.ok, false);
  assert.equal(falta.remaining, 10);
  assert.match(falta.reason, /falta repartir/);
  assert.match(S.evaluate([{ rowKey: "a", amount: 70 }, { rowKey: "b", amount: 40 }], 100).reason, /más que el movimiento/);
  assert.match(S.evaluate([{ rowKey: "a", amount: 100 }], 100).reason, /2 partidas o más/);
  assert.match(S.evaluate([{ rowKey: "a", amount: 50 }, { rowKey: "a", amount: 50 }], 100).reason, /repetida/);
  assert.match(S.evaluate([{ rowKey: "a", amount: 100 }, { rowKey: "b", amount: "0" }], 100).reason, /mayor que cero/);
  assert.match(S.evaluate([{ rowKey: "a", amount: 100 }, { rowKey: "", amount: "" }], 100).reason, /falta elegir la partida/);
  assert.match(S.evaluate([{ rowKey: "a", amount: 100 }, { rowKey: "b", amount: "x" }], 100).reason, /falta el importe/);
  // Céntimos: 33,33 + 33,33 + 33,34 cuadra; la barra llega al 100 %.
  const tres = S.evaluate([{ rowKey: "a", amount: "33,33" }, { rowKey: "b", amount: "33,33" }, { rowKey: "c", amount: "33,34" }], 100);
  assert.equal(tres.ok, true);
  assert.deepEqual(S.progress(tres, 100), { pct: 100, over: false, done: true });
  assert.equal(S.progress(falta, 100).pct, 90);
});

test("DAT-07 · importes tecleados: coma o punto decimal, miles con punto, con o sin €", () => {
  assert.equal(S.parseAmount("12,50"), 12.5);
  assert.equal(S.parseAmount("1.234,5 €"), 1234.5);
  assert.equal(S.parseAmount("7.25"), 7.25);
  assert.equal(S.parseAmount(""), null);
  assert.equal(S.parseAmount("doce"), null);
});

test("DAT-07 · la división guardada solo cuenta si sigue cuadrando con el movimiento y con las partidas de hoy", () => {
  const entry = { rowKey: "b", split: [{ rowKey: "a", amount: 40 }, { rowKey: "b", amount: 60 }] };
  assert.deepEqual(S.storedParts(entry, -100), [{ rowKey: "a", amount: 40 }, { rowKey: "b", amount: 60 }]);
  assert.equal(S.storedParts(entry, -120), null, "el movimiento cambió de importe");
  assert.equal(S.storedParts(entry, -100, (key) => key !== "a"), null, "una partida ya no existe");
  assert.equal(S.storedParts({ rowKey: "b" }, -100), null);
});

function sandbox(mappings) {
  const rows = {
    expense: [
      { id: "super", label: "Supermercado ficticio", sectionName: "Gastos variables" },
      { id: "farmacia", label: "Farmacia ficticia", sectionName: "Gastos variables" },
      { id: "regalos", label: "Regalos ficticios", sectionName: "Gastos variables" },
    ],
  };
  const context = {
    globalThis: null,
    FinanceCanonicalMovementSplit: S,
    movementMappings: mappings,
    baseData: { transactions: [], monthlyPlanning: { months: [{ key: "2026-10", label: "oct 26" }] } },
    seriesKeyForRow: (row) => `expense|${row.id}`,
    planningRowBySeriesKey: (kind, key) => (rows[kind] || []).find((row) => `expense|${row.id}` === key) || null,
    movementKindFromAmount: (amount) => (Number(amount) >= 0 ? "income" : "expense"),
    movementMappingForAnyMonth: () => null,
    movementMappingByPattern: () => null,
    exactMovementPlanningMatch: () => null,
    monthByKey: (key, months) => (months || []).find((month) => month.key === key) || null,
    isSignedClosedMonthKey: () => false,
    actualKeyForRow: (row, month) => `${row.id}|${month.key}`,
    round2: (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100,
    normalizedText: (value) => String(value || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(),
  };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext([extractFunction("transactionIdentity"), extractFunction("movementMappingKey"), extractFunction("mappingForMovement"), extractFunction("bankActualTotals")].join("\n"), context);
  return context;
}

test("DAT-07 · app.js: el movimiento dividido cuenta como clasificado (partida mayor) y cada partida recibe su parte del real", () => {
  const ticket = { date: "2026-10-05", month: "2026-10", movement: "COMPRA TARJ FICTICIA", details: "SUPER FICTICIO", amount: -100 };
  const otro = { date: "2026-10-06", month: "2026-10", movement: "COMPRA TARJ FICTICIA", details: "SUPER FICTICIO", amount: -50 };
  const context = sandbox({});
  const id = context.transactionIdentity(ticket);
  context.movementMappings[context.movementMappingKey(ticket)] = { kind: "expense", rowKey: "expense|super", label: "Supermercado" };
  context.movementMappings[id] = { kind: "expense", rowKey: "expense|super", label: "Supermercado", split: [{ rowKey: "expense|super", amount: 70 }, { rowKey: "expense|farmacia", amount: 30 }] };
  context.baseData.transactions = [ticket, otro];
  const mapping = context.mappingForMovement(ticket);
  assert.equal(mapping.source, "split");
  assert.equal(mapping.row.id, "super");
  assert.deepEqual(mapping.split.map((part) => [part.row.id, part.amount]), [["super", 70], ["farmacia", 30]]);
  assert.equal(context.mappingForMovement(otro).source, "dictionary", "los demás del concepto siguen su regla");
  const totals = context.bankActualTotals();
  assert.deepEqual(Object.fromEntries(totals.expense), { "super|2026-10": 120, "farmacia|2026-10": 30 });
});

test("DAT-07 · app.js: una división que ya no cuadra (una partida borrada) manda el movimiento entero a su partida mayor", () => {
  const ticket = { date: "2026-10-05", month: "2026-10", movement: "BIZUM ENVIADO", details: "CENA FICTICIA", amount: -80 };
  const context = sandbox({});
  context.movementMappings[context.transactionIdentity(ticket)] = { kind: "expense", rowKey: "expense|regalos", split: [{ rowKey: "expense|regalos", amount: 50 }, { rowKey: "expense|borrada", amount: 30 }] };
  context.baseData.transactions = [ticket];
  assert.equal(context.mappingForMovement(ticket).source, "single");
  assert.deepEqual(Object.fromEntries(context.bankActualTotals().expense), { "regalos|2026-10": 80 });
});

test("DAT-07 · la ficha: plegado dentro de «Partida», sin titular, con barra nativa y «Quitar la división» que devuelve lo de antes", () => {
  const ficha = read("ficha-movimiento-ui.js");
  assert.match(ficha, /\$\{fichaMovDivisionHtml\(row, kind, mapping\)\}\n {4}<\/section>/);
  const bloque = ficha.slice(ficha.indexOf("function fichaMovDivisionHtml("), ficha.indexOf("function fichaMovDivisionEscuchas("));
  assert.doesNotMatch(bloque, /<h[1-6]/);
  assert.match(bloque, /<details class="ficha-mov-dividir" id="fichaMovDividir"/);
  assert.match(bloque, /<progress id="fichaMovDividirBarra" max="100"/);
  assert.match(bloque, /id="fichaMovDividirGuardar"\$\{result\.ok \? "" : " disabled"\}/);
  assert.match(ficha, /const previo = antes && !antes\.split \? \{ rowKey: antes\.rowKey, label: antes\.label \|\| "" \} : antes\?\.previo \|\| null;/);
  assert.match(ficha, /if \(actual\.previo\?\.rowKey\) movementMappings\[single\] = /);
  // La lista de Movimientos lo dice en los dos temas.
  assert.match(app, /if \(mapping\.split\) return `<span class="e19-badge e19-badge-neutral">Dividido en \$\{mapping\.split\.length\} partidas<\/span>`;/);
  assert.match(read("views/movimientos-v2.js"), /if \(mapping\?\.split\) return `Dividido en \$\{mapping\.split\.length\} partidas`;/);
  // Registro: antes de app.js, en la caché offline y en el sitio publicado.
  const html = read("index.html");
  assert.ok(html.indexOf('src="canonical-movement-split.js?v=') > 0 && html.indexOf('src="canonical-movement-split.js?v=') < html.indexOf('src="app.js?v='));
  assert.match(read("service-worker.js"), /"\.\/canonical-movement-split\.js",/);
  assert.match(read("tools/build-public-site.mjs"), /"canonical-movement-split\.js",/);
});
