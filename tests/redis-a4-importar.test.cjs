const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { codigoApp } = require("./helpers/codigo-app.cjs");

// Rediseño · fase A4, PR-2 (docs/rediseno/HANDOFF.md §5 «E1 · Importar»): Importar v2 detrás del tema v2, como otra cara
// del mismo asistente. Comprueba (1) que solo se pinta con la bandera y el asistente de siempre sigue entero detrás de
// «Ver el asistente de siempre», (2) las decisiones del hogar del 21/10 (P17: solo los duplicados seguros se descartan
// solos; P18: lo que no tiene partida se importa y va a la bandeja), (3) el cuadre de P11 (si trae saldos y no cuadran,
// no se importa; sin saldos, se importa con aviso) y (4) que importa y deshace con las piezas de siempre.

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const imp = read("views/importar-v2.js");
const css = read("tema-v2.css");

function sandbox({ session = null, lastResult = null, tema = "v2" } = {}) {
  const elements = {};
  const element = (id) => {
    if (!elements[id]) {
      const classes = new Set();
      const article = { classList: { add: (n) => classes.add(n), remove: (n) => classes.delete(n), contains: (n) => classes.has(n), toggle: (n) => (classes.has(n) ? classes.delete(n) : classes.add(n)) } };
      elements[id] = { id, hidden: true, innerHTML: "", dataset: {}, addEventListener() {}, closest: () => article, article };
    }
    return elements[id];
  };
  const persisted = [];
  const context = {
    escapeHtml: (value) => String(value ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]),
    money: (value) => `${String(value).replace(".", ",")} €`,
    round2: (value) => Math.round(Number(value) * 100) / 100,
    movementMappingKey: (row) => String(row.movement).toLowerCase(),
    movementDisplayName: (row) => row.movement,
    // Ensayo del cierre (29/10/2026): la revisión cuenta aparte lo que ya estaba guardado (filas idénticas).
    transactionIdentity: (row) => [row.date, row.movement, row.amount, row.balance].join("|"),
    baseData: { transactions: [] },
    displayLabelForRow: (row) => row.label,
    datosImportarIncludedTransactions: (rows) => rows.filter((row) => row.duplicateDecision !== "duplicado").map((row) => row.transaction),
    datosImportarFileSummary: (txs) => ({ from: txs.map((t) => t.date).sort()[0], to: txs.map((t) => t.date).sort().at(-1), closedMonths: [] }),
    datosImportarPersistDraft: () => persisted.push(true),
    datosImportarTarget: () => ({ fileInputId: "registrarImportFileInput" }),
    datosImportarBalanceOffer: () => null,
    DATOS_IMPORTAR_ACCOUNTS: ["CaixaBank", "Mediolanum", "Efectivo"],
    datosImportarSession: session,
    datosImportarLastResult: lastResult,
    document: { documentElement: { dataset: { tema } } },
    qs: (id) => element(id),
    globalThis: {},
  };
  context.globalThis.FinanceCanonicalBalancePulse = { statementContinuity: require("../canonical-balance-pulse.js").statementContinuity };
  vm.createContext(context);
  vm.runInContext(imp, context);
  return { context, element, persisted };
}

const tx = (date, movement, amount, balance = null) => ({ date, movement, details: "", amount, balance });
const fila = (id, transaction, extra = {}) => ({ rowId: id, transaction, prior: { status: "pendiente", mapping: null }, duplicates: [], decision: null, duplicateDecision: null, capturePair: null, ...extra });

test("se carga con defer antes de app.js, está en el sitio público y el service worker, y no cambia ningún motor", () => {
  const html = read("index.html");
  const at = html.indexOf('<script defer src="views/importar-v2.js');
  assert.ok(at > 0 && at < html.indexOf('<script defer src="app.js'));
  assert.ok(read("service-worker.js").includes('"./views/importar-v2.js"'));
  assert.ok(read("tools/build-public-site.mjs").includes('"views/importar-v2.js"'));
  assert.ok(html.indexOf('<div class="imp-v2" id="importarV2" hidden></div>') < html.indexOf('id="registrarImportSteps"'), "el contenedor va al principio del asistente de Registrar");
  assert.match(codigoApp(), /function renderDatosImportar\(\) \{\s*queueMicrotask\(\(\) => globalThis\.importarV2Render\?\.\(\)\);/);
});

test("el asistente de siempre solo se oculta cuando la v2 está pintada; la lectura del fichero (WP-51) sigue a la vista", () => {
  assert.match(css, /article\.imp-v2-pintado:not\(\.imp-v2-clasico\) #registrarImportPanel > :not\(#extractoPerfilesPanel\):not\(\.datos-importar-upload\),/);
  assert.match(css, /\.datos-importar-upload:has\(> p:empty\) \{/);
  assert.match(imp, /IMP_V2_CLASSIC_CLASS = "imp-v2-clasico"/);
  const { context, element } = sandbox({ tema: "" });
  context.importarV2Render();
  assert.equal(element("importarV2").hidden, true);
});

test("sin fichero: la tarjeta CSV abre el input de siempre y lo que no existe va plegado en una línea", () => {
  const { context, element } = sandbox();
  context.importarV2Render();
  const html = element("importarV2").innerHTML;
  assert.match(html, /<label class="[^"]*imp-v2-fuente" for="registrarImportFileInput">/);
  assert.match(html, /Aún no: desde la app del banco con Compartir\./); // el texto del PDF ya existe (XDA-03, extracto-pdf-ui.js)
  assert.match(html, /data-imp-v2-clasico/);
  assert.ok(element("importarV2").article.classList.contains("imp-v2-pintado"));
});

test("P17: solo el duplicado seguro (misma fecha, importe y concepto) se descarta solo; el parecido pregunta y bloquea", () => {
  const safe = fila("a", tx("2026-10-02", "MERCADONA", -86.4), { duplicates: [tx("2026-10-02", "Mercadona", -86.4)] });
  const similar = fila("b", tx("2026-10-03", "NETFLIX.COM", -13.99), { duplicates: [tx("2026-09-30", "NETFLIX COM", -13.99)] });
  const decided = fila("c", tx("2026-10-04", "SUPER", -10), { duplicates: [tx("2026-10-04", "SUPER", -10)], duplicateDecision: "distinto" });
  const session = { fileMeta: { fileName: "e.csv", sourceLabel: "e.csv", bankAccount: "" }, rows: [safe, similar, decided] };
  const { context, element, persisted } = sandbox({ session });
  context.importarV2Render();
  assert.equal(safe.duplicateDecision, "duplicado");
  assert.equal(similar.duplicateDecision, null, "el parecido no se decide solo");
  assert.equal(decided.duplicateDecision, "distinto", "una decisión tomada no se pisa");
  assert.ok(persisted.length > 0);
  const html = element("importarV2").innerHTML;
  assert.match(html, /is-dup[\s\S]*No es duplicado/);
  assert.match(html, /¿Duplicado de «NETFLIX COM» del 30\/09\?/);
  assert.match(html, /data-imp-v2-importar disabled/);
  assert.match(html, /1 posible duplicado por decidir/);
});

test("P18: lo que no tiene partida se importa y se dice que va a la bandeja; con regla, enseña la partida", () => {
  const conRegla = fila("a", tx("2026-10-02", "IBERDROLA", -94.12), { prior: { status: "regla-previa", mapping: { row: { label: "Luz" } } } });
  const sin = fila("b", tx("2026-10-03", "BIZUM", -25));
  const session = { fileMeta: { fileName: "e.csv", sourceLabel: "e.csv", bankAccount: "" }, rows: [conRegla, sin] };
  const { context, element } = sandbox({ session });
  context.importarV2Render();
  const html = element("importarV2").innerHTML;
  assert.match(html, /<span class="imp-v2-estado">Luz<\/span>/);
  assert.match(html, /sin partida: a la bandeja/);
  assert.match(html, /Importar 2 movimientos/);
  assert.ok(!/data-imp-v2-importar disabled/.test(html), "sin partida no bloquea");
  assert.match(html, /1 sin partida irá a la bandeja · se puede deshacer/);
});

test("P11: con saldos que encadenan, cuadra al céntimo con saldo inicial, movimientos y final (también si el fichero va al revés)", () => {
  const rows = [tx("2026-10-01", "NOMINA", 3000, 4000), tx("2026-10-02", "SUPER", -86.4, 3913.6), tx("2026-10-03", "LUZ", -13.6, 3900)].map((t, i) => fila(`f${i}`, t));
  for (const ordered of [rows, rows.slice().reverse()]) {
    const { context } = sandbox();
    const cuadre = context.impV2Cuadre({ rows: ordered });
    assert.equal(cuadre.status, "cuadra");
    assert.equal(cuadre.initial, 1000);
    assert.equal(cuadre.final, 3900);
    assert.equal(cuadre.movements, 2900);
    assert.equal(cuadre.from, "2026-10-01");
  }
});

test("P11: si trae saldos y falta un movimiento, no cuadra y no se importa; sin saldos, se importa con aviso", () => {
  const roto = [tx("2026-10-01", "A", -10, 990), tx("2026-10-05", "B", -10, 950)].map((t, i) => fila(`r${i}`, t));
  const session = { fileMeta: { fileName: "e.csv", sourceLabel: "e.csv", bankAccount: "" }, rows: roto };
  const { context, element } = sandbox({ session });
  assert.equal(context.impV2Cuadre(session).status, "no-cuadra");
  context.importarV2Render();
  const html = element("importarV2").innerHTML;
  assert.match(html, /No se importa:<\/strong> faltan movimientos entre el 01\/10 y el 05\/10/);
  assert.match(html, /data-imp-v2-importar disabled/);
  const sinSaldos = { fileMeta: { fileName: "e.csv", sourceLabel: "e.csv", bankAccount: "" }, rows: [fila("s", tx("2026-10-01", "A", -10))] };
  const second = sandbox({ session: sinSaldos });
  second.context.importarV2Render();
  const html2 = second.element("importarV2").innerHTML;
  assert.match(html2, /no trae saldos/);
  assert.ok(!/data-imp-v2-importar disabled/.test(html2));
});

test("importa y deshace con las piezas de siempre: la misma confirmación, el mismo lote y su «Deshacer»", () => {
  assert.match(imp, /\[data-imp-v2-importar\]"\)\) return handleDatosImportarConfirmar\(\)/);
  assert.match(imp, /await undoLastImportBatch\(\);/);
  const { context, element } = sandbox({ lastResult: { imported: 46, fileName: "e.csv", duplicadosDescartados: 2, batchId: "b1" } });
  context.importarV2Render();
  const html = element("importarV2").innerHTML;
  assert.match(html, /46 movimientos importados/);
  assert.match(html, /data-imp-v2-deshacer/);
  assert.match(html, /data-imp-v2-nav="movements"/);
});
