"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { codigoApp } = require("./helpers/codigo-app.cjs");

const dedupe = require("../canonical-capture-dedupe.js");

// WP-53 (CAP-10, docs/WP53_DISENO.md): emparejar lo anotado a mano con el extracto. Importe exacto, ±2 días, comercio por similitud,
// una captura con una fila, y manda el extracto. Todo con datos inventados.

test("similarity: el ruido de banco no cuenta y un nombre dentro de otro sí", () => {
  assert.equal(dedupe.similarity("Mercadona", "COMPRA TARJ. 4412 MERCADONA SA"), 1); // el ruido (compra, tarjeta, cifras, SA) no cuenta
  assert.equal(dedupe.similarity("Súper Mercadona", "MERCADONA"), 0.9);
  assert.equal(dedupe.similarity("Carrefour", "CARREFOURExpress"), 1);
  assert.ok(dedupe.similarity("Gasolina Repsol", "REPSOL ESTACION 12") >= 0.5);
  assert.ok(dedupe.similarity("Mercadona", "Farmacia López") < 0.5);
});

test("similarity: sin nombre comparable es null, no 0 (dato ausente no es distinto)", () => {
  assert.equal(dedupe.similarity("", "Mercadona"), null);
  assert.equal(dedupe.similarity("Mercadona", "COMPRA TARJ 1234"), null); // solo ruido y cifras
  assert.equal(dedupe.similarity(undefined, null), null);
});

const cap = (id, date, amount, concept, extra = {}) => ({ id, date, amount, concept, ...extra });

test("pairCaptures: importe exacto, ±2 días y comercio parecido es «alta»", () => {
  const result = dedupe.pairCaptures([cap("c1", "2026-10-05", -23.4, "Mercadona")], [cap("r1", "2026-10-06", -23.4, "COMPRA MERCADONA SA")]);
  assert.equal(result.pairs.length, 1);
  assert.deepEqual({ ...result.pairs[0] }, { captureId: "c1", rowId: "r1", days: 1, similarity: 1, confidence: "alta" });
  assert.deepEqual(result.unpairedCaptures, []);
  assert.deepEqual(result.unpairedRows, []);
});

test("pairCaptures: un céntimo de diferencia no empareja, ni tres días, ni el signo contrario", () => {
  const base = [cap("c1", "2026-10-05", -23.4, "Mercadona")];
  assert.equal(dedupe.pairCaptures(base, [cap("r", "2026-10-05", -23.41, "Mercadona")]).pairs.length, 0);
  assert.equal(dedupe.pairCaptures(base, [cap("r", "2026-10-08", -23.4, "Mercadona")]).pairs.length, 0);
  assert.equal(dedupe.pairCaptures(base, [cap("r", "2026-10-05", 23.4, "Mercadona")]).pairs.length, 0);
  assert.equal(dedupe.pairCaptures(base, [cap("r", "2026-10-07", -23.4, "Mercadona")]).pairs.length, 1); // justo ±2
  assert.equal(dedupe.pairCaptures(base, [cap("r", "2026-10-03", -23.4, "Mercadona")]).pairs.length, 1);
});

test("pairCaptures: el flotante no engaña (0,1+0,2 frente a 0,3)", () => {
  assert.equal(dedupe.pairCaptures([cap("c", "2026-10-05", -(0.1 + 0.2), "Kiosco")], [cap("r", "2026-10-05", -0.3, "Kiosco")]).pairs.length, 1);
});

test("pairCaptures: comercio distinto o sin nombre es «media»: se propone, no se da por buena", () => {
  const distinto = dedupe.pairCaptures([cap("c", "2026-10-05", -12.5, "Mercadona")], [cap("r", "2026-10-05", -12.5, "Farmacia Lopez")]);
  assert.equal(distinto.pairs[0].confidence, "media");
  assert.ok(distinto.pairs[0].similarity < 0.5);
  const sinNombre = dedupe.pairCaptures([cap("c", "2026-10-05", -12.5, "")], [cap("r", "2026-10-05", -12.5, "Farmacia Lopez")]);
  assert.equal(sinNombre.pairs[0].confidence, "media");
  assert.equal(sinNombre.pairs[0].similarity, null);
});

test("pairCaptures: una captura, una fila — dos cafés iguales no se funden y gana el comercio más parecido", () => {
  const captures = [cap("c1", "2026-10-05", -2.5, "Café Central"), cap("c2", "2026-10-05", -2.5, "Panadería Sol")];
  const rows = [cap("r1", "2026-10-05", -2.5, "PANADERIA SOL"), cap("r2", "2026-10-05", -2.5, "CAFE CENTRAL")];
  const result = dedupe.pairCaptures(captures, rows);
  const byCapture = Object.fromEntries(result.pairs.map((pair) => [pair.captureId, pair.rowId]));
  assert.deepEqual(byCapture, { c1: "r2", c2: "r1" });
  // Y con una sola fila para dos capturas iguales, solo una se empareja y la otra queda visible.
  const one = dedupe.pairCaptures([cap("a", "2026-10-05", -2.5, "Café"), cap("b", "2026-10-05", -2.5, "Café")], [cap("r", "2026-10-05", -2.5, "CAFE")]);
  assert.equal(one.pairs.length, 1);
  assert.equal(one.unpairedCaptures.length, 1);
});

test("pairCaptures: es determinista, no depende del orden de entrada", () => {
  const captures = [cap("c1", "2026-10-05", -9, "Kiosco"), cap("c2", "2026-10-06", -9, "Kiosco")];
  const rows = [cap("r1", "2026-10-05", -9, "Kiosco"), cap("r2", "2026-10-06", -9, "Kiosco")];
  const forward = dedupe.pairCaptures(captures, rows);
  const backward = dedupe.pairCaptures([...captures].reverse(), [...rows].reverse());
  const key = (result) => result.pairs.map((pair) => `${pair.captureId}>${pair.rowId}`).sort().join();
  assert.equal(key(forward), "c1>r1,c2>r2");
  assert.equal(key(backward), key(forward));
});

test("pairCaptures: lo mal formado se ignora sin romper", () => {
  const result = dedupe.pairCaptures([null, cap("", "2026-10-05", -1, "x"), cap("c", "2026-02-31", -1, "x"), cap("d", "2026-10-05", 0, "x")], [cap("r", "2026-10-05", -1, "x")]);
  assert.equal(result.pairs.length, 0);
  assert.deepEqual(dedupe.pairCaptures(undefined, undefined), { pairs: [], unpairedCaptures: [], unpairedRows: [] });
});

test("resolvePair: manda el extracto en importe y fecha, y dice en qué se diferenciaban", () => {
  const resolved = dedupe.resolvePair(cap("c", "2026-10-05", -23.4, "Mercadona"), cap("r", "2026-10-07", -23.4, "COMPRA MERCADONA SA"));
  assert.equal(resolved.date, "2026-10-07");
  assert.equal(resolved.amount, -23.4);
  assert.equal(resolved.concept, "COMPRA MERCADONA SA");
  assert.deepEqual(resolved.captured, { amount: -23.4, date: "2026-10-05", concept: "Mercadona" });
  assert.deepEqual(resolved.changes, { days: 2, amount: false });
  assert.equal(dedupe.resolvePair(null, cap("r", "2026-10-07", -1, "x")), null);
});

test("describePair: dice por qué se propone y qué se conserva", () => {
  const alta = dedupe.describePair({ days: 1, similarity: 0.9, confidence: "alta" });
  assert.match(alta, /Misma compra probable/);
  assert.match(alta, /1 día después de anotarlo/);
  assert.match(alta, /90 %/);
  assert.doesNotMatch(alta, /Si es la misma/); // lo que se conserva lo dice la pantalla según el tipo de captura
  const media = dedupe.describePair({ days: 0, similarity: null, confidence: "media" });
  assert.match(media, /el mismo día/);
  assert.match(media, /sin nombre de comercio comparable/);
  assert.equal(dedupe.describePair(null), "");
});

test("registro de capturas: valida, no duplica, poda y limita", () => {
  const entry = (n, date = "2026-10-05") => ({ id: `cap-${n}`, rowId: `custom-expense-${n}`, monthKey: date.slice(0, 7), date, concept: ` Súper  ${n} `, amount: -10 - n, channel: "enlace", capturedAt: "2026-10-05T10:00:00Z" });
  let log = dedupe.appendLog({ entries: [] }, entry(1), "2026-10-06");
  log = dedupe.appendLog(log, entry(1), "2026-10-06");
  assert.equal(log.entries.length, 1);
  assert.equal(log.entries[0].concept, "Súper 1");
  assert.equal(log.entries[0].channel, "enlace");
  assert.equal(dedupe.appendLog(log, { id: "x", rowId: "y", monthKey: "2026-13", date: "2026-10-05", concept: "a", amount: -1 }, "2026-10-06").entries.length, 1);
  assert.equal(dedupe.appendLog(log, { ...entry(2), amount: 0 }, "2026-10-06").entries.length, 1);
  assert.equal(dedupe.appendLog(log, { ...entry(2), concept: "   " }, "2026-10-06").entries.length, 1);
  // Una entrada de hace más de 120 días se poda al añadir otra.
  const old = dedupe.appendLog(log, entry(3, "2026-01-01"), "2026-10-06");
  const pruned = dedupe.appendLog(old, entry(4), "2026-10-06");
  assert.deepEqual(pruned.entries.map((item) => item.id), ["cap-1", "cap-4"]);
  // Un canal desconocido cae a «ventana»; un almacén roto da vacío.
  assert.equal(dedupe.normalizeLogEntry({ ...entry(5), channel: "otro" }).channel, "ventana");
  assert.deepEqual(dedupe.normalizeLog("basura"), { entries: [] });
  assert.deepEqual(dedupe.normalizeLog(null), { entries: [] });
  const many = Array.from({ length: 260 }, (_, index) => entry(index + 10));
  assert.equal(dedupe.normalizeLog(many).entries.length, dedupe.MAX_LOG);
});

test("el motor es puro: sin DOM, red, almacenamiento ni reloj", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "canonical-capture-dedupe.js"), "utf8").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(source, /\b(document|window|localStorage|sessionStorage|fetch|XMLHttpRequest|indexedDB)\b/);
  assert.doesNotMatch(source, /Date\.now\(|new Date\(\)|Math\.random\(/);
});

// ---- La parte de pantalla (captura-duplicados-ui.js), en un entorno aislado --------------------------------------------------------------

const vm = require("node:vm");
const uiSource = fs.readFileSync(path.join(__dirname, "..", "captura-duplicados-ui.js"), "utf8");
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));

function uiSandbox({ transactions = [], log = [], rows = [], mappings = {}, closed = [] } = {}) {
  const storage = {};
  const context = {
    Date, Math, JSON, Object, Array, String, Number, Set, Map, Promise,
    globalThis: null,
    FinanceCanonicalCaptureDedupe: dedupe,
    baseData: { transactions },
    customPlanningRows: rows,
    movementMappings: mappings,
    storageKey: (name) => `${name}:demo`,
    storageSet: (key, value) => { storage[key] = value; },
    cachedLocalStore: (name, normalize) => normalize(JSON.parse(storage[`${name}:demo`] ?? JSON.stringify({ entries: log }))),
    isClosedMonthKey: (key) => closed.includes(key),
    isoLocalDate: () => "2026-10-10",
    transactionIdentity: (row) => [row.date, row.movement, row.details || "", row.amount, row.balance ?? ""].join("|"),
    movementDisplayName: (row) => (row.details ? `${row.movement} · ${row.details}` : row.movement),
    formatIsoDate: (iso) => iso.split("-").reverse().join("/"),
    money: (value) => `${value} €`,
    escapeHtml,
  };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(uiSource, context);
  return { context, storage };
}

const bankRow = (rowId, date, amount, movement, extra = {}) => ({ rowId, transaction: { date, month: date.slice(0, 7), movement, details: "", amount, balance: 100, ...extra }, duplicates: [], duplicateDecision: null });
const quick = (date, amount, movement) => ({ date, valueDate: date, movement, details: "Creado desde la barra de captura rápida (DEX1/DEX2)", amount, balance: null, source: "manual-quick-capture", month: date.slice(0, 7) });

test("pantalla: una captura rápida se empareja con su fila del banco y pasa a ser el candidato del paso 3", () => {
  const capture = quick("2026-10-05", -23.4, "Mercadona");
  const { context } = uiSandbox({ transactions: [capture] });
  const rows = context.capturaDuplicadosAnotar([bankRow("fila-0", "2026-10-06", -23.4, "COMPRA MERCADONA SA")], dedupe);
  const pair = rows[0].capturePair;
  assert.equal(pair.kind, "movimiento");
  assert.equal(pair.confidence, "alta");
  assert.equal(rows[0].duplicates[0], capture);
  assert.match(pair.summary, /Misma compra probable: mismo importe, 1 día después de anotarlo/);
  // Sin captura que cuadre, no hay par ni se toca nada.
  const none = context.capturaDuplicadosAnotar([bankRow("fila-0", "2026-10-06", -99, "Otro")], dedupe);
  assert.equal(none[0].capturePair, null);
  assert.deepEqual(none[0].duplicates, []);
});

test("pantalla: «Registrar gasto» deja su entrada y se empareja solo con una fila de SU mes y si la partida sigue ahí", () => {
  const { context, storage } = uiSandbox({ rows: [{ id: "custom-expense-1", monthKey: "2026-10" }] });
  context.recordCaptureLog({ rowId: "custom-expense-1", monthKey: "2026-10", date: "2026-10-05", concept: "Súper", amount: -40, channel: "ventana" });
  const saved = JSON.parse(storage["capture-log:demo"]);
  assert.equal(saved.entries.length, 1);
  assert.match(saved.entries[0].id, /^cap-/);
  assert.ok(Number.isFinite(Date.parse(saved.entries[0].capturedAt)));

  const ok = uiSandbox({ rows: [{ id: "custom-expense-1", monthKey: "2026-10" }], log: saved.entries });
  const rows = ok.context.capturaDuplicadosAnotar([bankRow("fila-0", "2026-10-06", -40, "SUPERMERCADO DIA")], dedupe);
  assert.equal(rows[0].capturePair.kind, "partida");
  assert.equal(rows[0].capturePair.rowKey, "expense|custom-expense-1");
  assert.equal(rows[0].duplicates[0].source, "captura-partida");
  assert.equal(rows[0].duplicates[0].amount, -40);

  // Otro mes: el real se escribe por partida y mes, así que no sustituiría a la partida → sin par.
  const sameButNextMonth = uiSandbox({ rows: [{ id: "custom-expense-1", monthKey: "2026-10" }], log: [{ ...saved.entries[0], date: "2026-10-31" }] });
  const crossing = sameButNextMonth.context.capturaDuplicadosAnotar([bankRow("fila-0", "2026-11-01", -40, "SUPERMERCADO DIA")], dedupe);
  assert.equal(crossing[0].capturePair, null);
  // La partida ya no existe, ya recibió un movimiento, o el mes está firmado: no se ofrece.
  assert.equal(uiSandbox({ rows: [], log: saved.entries }).context.capturaDuplicadosAnotar([bankRow("f", "2026-10-06", -40, "DIA")], dedupe)[0].capturePair, null);
  assert.equal(uiSandbox({ rows: [{ id: "custom-expense-1", monthKey: "2026-10" }], log: saved.entries, mappings: { x: { rowKey: "expense|custom-expense-1" } } }).context.capturaDuplicadosAnotar([bankRow("f", "2026-10-06", -40, "DIA")], dedupe)[0].capturePair, null);
  assert.equal(uiSandbox({ rows: [{ id: "custom-expense-1", monthKey: "2026-10" }], log: saved.entries, closed: ["2026-10"] }).context.capturaDuplicadosAnotar([bankRow("f", "2026-10-06", -40, "DIA")], dedupe)[0].capturePair, null);
});

test("pantalla: la tabla del paso 3 enseña por qué, qué se conserva y escapa el texto", () => {
  const capture = quick("2026-10-05", -23.4, "<b>Mercadona</b>");
  const { context } = uiSandbox({ transactions: [capture] });
  const [row] = context.capturaDuplicadosAnotar([bankRow("fila-0", "2026-10-07", -23.4, "MERCADONA")], dedupe);
  const html = context.capturaDuplicadosRowMarkup(row);
  assert.match(html, /data-datos-importar-duplicate="misma"/);
  assert.match(html, /data-datos-importar-duplicate="distinto"/);
  assert.match(html, /Es la misma compra/);
  assert.match(html, /Son distintas/);
  assert.match(html, /Anotado a mano/);
  assert.match(html, /el banco lo fecha el 07\/10\/2026/);
  assert.match(html, /se quita lo que anotaste y se queda la fila del banco/);
  assert.doesNotMatch(html, /<b>Mercadona/);
  assert.match(html, /&lt;b&gt;/);
  row.duplicateDecision = "misma";
  assert.match(context.capturaDuplicadosRowMarkup(row), /is-active" data-datos-importar-duplicate="misma"[^>]*aria-pressed="true"/);
  assert.match(context.capturaDuplicadosResumen([row]), /1 captura\(s\) anotada\(s\) a mano se sustituyen/);
  assert.equal(context.capturaDuplicadosResumen([{ ...row, duplicateDecision: "distinto" }]), "");
});

test("pantalla: al confirmar, «misma» quita la captura o asigna la partida; «distinto» no toca nada", () => {
  const capture = quick("2026-10-05", -23.4, "Mercadona");
  const other = quick("2026-10-05", -9, "Kiosco");
  const { context } = uiSandbox({ transactions: [capture, other], rows: [{ id: "custom-expense-1", monthKey: "2026-10" }], log: [{ id: "cap-1", rowId: "custom-expense-1", monthKey: "2026-10", date: "2026-10-05", concept: "Súper", amount: -40, channel: "ventana", capturedAt: "2026-10-05T10:00:00Z" }] });
  const rows = context.capturaDuplicadosAnotar([bankRow("fila-0", "2026-10-06", -23.4, "MERCADONA"), bankRow("fila-1", "2026-10-06", -40, "SUPER DIA")], dedupe);
  rows[0].duplicateDecision = "misma";
  rows[1].duplicateDecision = "misma";
  assert.equal(context.capturaDuplicadosAplicar(rows), 2);
  assert.deepEqual(context.baseData.transactions.map((item) => item.movement), ["Kiosco"]); // la captura emparejada se fue; la otra se queda
  const key = context.transactionIdentity(rows[1].transaction);
  assert.equal(context.movementMappings[key].rowKey, "expense|custom-expense-1");
  assert.equal(context.movementMappings[key].kind, "expense");
  // «Son distintas»: nada cambia.
  const again = uiSandbox({ transactions: [quick("2026-10-05", -23.4, "Mercadona")] });
  const kept = again.context.capturaDuplicadosAnotar([bankRow("fila-0", "2026-10-06", -23.4, "MERCADONA")], dedupe);
  kept[0].duplicateDecision = "distinto";
  assert.equal(again.context.capturaDuplicadosAplicar(kept), 0);
  assert.equal(again.context.baseData.transactions.length, 1);
});

test("pantalla: anotar es idempotente y una decisión ya tomada sobrevive a recalcular el par", () => {
  const { context } = uiSandbox({ transactions: [quick("2026-10-05", -23.4, "Mercadona")] });
  const rows = [bankRow("fila-0", "2026-10-06", -23.4, "MERCADONA")];
  context.capturaDuplicadosAnotar(rows, dedupe);
  rows[0].duplicateDecision = "misma";
  context.capturaDuplicadosAnotar(rows, dedupe);
  assert.equal(rows[0].duplicateDecision, "misma");
  assert.equal(rows[0].duplicates.length, 1);
});

test("cableado: app.js usa el motor en la sesión y en el borrador, sustituye dentro del lote y guarda el registro en la copia", () => {
  const app = codigoApp();
  assert.match(app, /capturaDuplicadosAnotar\(transactions\.map\(/);
  assert.match(app, /capturaDuplicadosAnotar\(draft\.rows\.map\(/);
  assert.equal((app.match(/globalThis\.FinanceCanonicalCaptureDedupe/g) || []).length, 2);
  assert.match(app, /if \(row\.capturePair\) return capturaDuplicadosRowMarkup\(row\)/);
  const apply = app.slice(app.indexOf("function datosImportarApply("));
  assert.ok(apply.indexOf("const beforeState") < apply.indexOf("capturaDuplicadosAplicar(rows)"), "la sustitución va después de la foto «antes»");
  assert.ok(apply.indexOf("capturaDuplicadosAplicar(rows)") < apply.indexOf("saveMovementMappings()"), "y antes de guardar las reglas");
  assert.ok(apply.indexOf("capturaDuplicadosAplicar(rows)") < apply.indexOf("const afterState"), "y dentro del lote reversible");
  // El «antes» del lote guarda la REFERENCIA de movementMappings: hay que copiarla antes de añadir reglas, o deshacer no las quita.
  assert.ok(apply.indexOf("movementMappings = { ...movementMappings }") > apply.indexOf("const beforeState"));
  assert.ok(apply.indexOf("movementMappings = { ...movementMappings }") < apply.indexOf("movementMappings[key] = {"));
  assert.match(app, /recordCaptureLog\(\{ rowId: id, monthKey: month\.key,/);
  assert.match(app, /"capture-log", \/\/ WP-53/);
  assert.match(app, /submitHomeQuickExpense\(month, sectionSelect\.value, labelInput\.value\.trim\(\), amountInput\.value, prefill\?\.date \|\| ""\)/);
});

test("cableado: los dos ficheros nuevos están en index.html, el service worker y el build, y el motor va antes de la pantalla", () => {
  const root = path.join(__dirname, "..");
  const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
  assert.ok(index.indexOf("canonical-capture-dedupe.js") > 0 && index.indexOf("canonical-capture-dedupe.js") < index.indexOf("captura-duplicados-ui.js"));
  ["service-worker.js", "tools/build-public-site.mjs"].forEach((file) => {
    const text = fs.readFileSync(path.join(root, file), "utf8");
    assert.match(text, /canonical-capture-dedupe\.js/);
    assert.match(text, /captura-duplicados-ui\.js/);
  });
});
