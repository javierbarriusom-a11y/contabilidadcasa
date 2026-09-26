const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const RegistrarActualsConfirm = require(path.join(root, "canonical-registrar-actuals-confirm.js"));

// R-13: Registrar › Reales del mes pedía teclear cada partida una a una. Este motor (módulo UMD
// independiente, `require()` directo — sin vm/JSDOM) confirma el previsto como real sin escribir
// nada, de forma individual, por bloque o para todo el mes.

const escapeHtml = (v) => String(v ?? "");

function fakeTarget(matchingSelector, dataset = {}) {
  return { closest: (selector) => (selector === matchingSelector ? { dataset } : null) };
}

// ------------------------------------------------------------------------------------------------
// confirmPending
// ------------------------------------------------------------------------------------------------

test("confirmPending · escribe el previsto redondeado en el almacén correcto, solo para lo pendiente", () => {
  const income = {};
  const expense = { "b|2026-09": 10 };
  const actualsForKind = (kind) => (kind === "income" ? income : expense);
  const recorded = [];
  const result = RegistrarActualsConfirm.confirmPending(
    [
      { kind: "income", key: "a|2026-09", planned: 12.345, hasActual: false },
      { kind: "expense", key: "b|2026-09", planned: 99, hasActual: true }, // ya tiene real: se ignora
      { kind: "expense", key: "c|2026-09", planned: 0, hasActual: false }, // previsto 0: confirma un 0 explícito
    ],
    { actualsForKind, recordSessionChange: (entry) => recorded.push(entry) },
  );
  assert.equal(income["a|2026-09"], 12.35); // round2
  assert.equal(expense["b|2026-09"], 10); // sin tocar, ya tenía real
  assert.equal(expense["c|2026-09"], 0);
  assert.equal(result.count, 2);
  assert.deepEqual([...result.kinds].sort(), ["expense", "income"]);
});

test("confirmPending · registra cada cambio con su valor previo, para poder deshacerlo", () => {
  const actuals = { "a|2026-09": 5 };
  const recorded = [];
  RegistrarActualsConfirm.confirmPending(
    [{ kind: "expense", key: "z|2026-09", planned: 20, hasActual: false }],
    { actualsForKind: () => actuals, recordSessionChange: (entry) => recorded.push(entry) },
  );
  assert.deepEqual(recorded, [{ kind: "actual", actualsKind: "expense", key: "z|2026-09", previous: null }]);
});

test("confirmPending · sin nada pendiente, no escribe ni registra nada", () => {
  const recorded = [];
  const result = RegistrarActualsConfirm.confirmPending([], { actualsForKind: () => ({}), recordSessionChange: (e) => recorded.push(e) });
  assert.equal(result.count, 0);
  assert.equal(recorded.length, 0);
});

// ------------------------------------------------------------------------------------------------
// bulkButtonHtml
// ------------------------------------------------------------------------------------------------

test("bulkButtonHtml · sin pendientes, no pinta nada", () => {
  assert.equal(RegistrarActualsConfirm.bulkButtonHtml(0, "todos", { escapeHtml }), "");
});

test("bulkButtonHtml · con «todos», ofrece confirmar todos los pendientes", () => {
  const html = RegistrarActualsConfirm.bulkButtonHtml(46, "todos", { escapeHtml });
  assert.match(html, /Confirmar todos los pendientes con su previsto \(46 partidas\)/);
  assert.doesNotMatch(html, /disabled/);
});

test("bulkButtonHtml · con un bloque activo, acota el texto a ese bloque, y singular con 1", () => {
  const html = RegistrarActualsConfirm.bulkButtonHtml(1, "Financiaciones", { escapeHtml });
  assert.match(html, /Confirmar los pendientes de Financiaciones con su previsto \(1 partida\)/);
});

test("bulkButtonHtml · mes cerrado, se pinta pero deshabilitado", () => {
  const html = RegistrarActualsConfirm.bulkButtonHtml(3, "todos", { escapeHtml, disabled: true });
  assert.match(html, /disabled/);
});

// ------------------------------------------------------------------------------------------------
// entriesForClick
// ------------------------------------------------------------------------------------------------

const SAMPLE_ENTRIES = [
  { key: "a|2026-09", kind: "income", sectionName: "Ingresos", planned: 100, hasActual: false },
  { key: "b|2026-09", kind: "expense", sectionName: "Gastos fijos", planned: 50, hasActual: true },
  { key: "c|2026-09", kind: "expense", sectionName: "Gastos fijos", planned: 30, hasActual: false },
];

test("entriesForClick · botón individual reconstruye la única entrada desde su dataset", () => {
  const target = fakeTarget("[data-registrar-actuals-confirm]", { registrarActualsKind: "income", registrarActualsConfirm: "a|2026-09", registrarActualsPlanned: "100" });
  const entries = RegistrarActualsConfirm.entriesForClick(target, { allEntries: SAMPLE_ENTRIES, blockFilter: "todos" });
  assert.deepEqual(entries, [{ kind: "income", key: "a|2026-09", planned: 100, hasActual: false }]);
});

test("entriesForClick · botón masivo con «todos» devuelve solo lo pendiente de todo el mes", () => {
  const target = fakeTarget("[data-registrar-actuals-confirm-pending]");
  const entries = RegistrarActualsConfirm.entriesForClick(target, { allEntries: SAMPLE_ENTRIES, blockFilter: "todos" });
  assert.deepEqual(entries.map((e) => e.key), ["a|2026-09", "c|2026-09"]);
});

test("entriesForClick · botón masivo con un bloque activo lo acota a ese bloque", () => {
  const target = fakeTarget("[data-registrar-actuals-confirm-pending]");
  const entries = RegistrarActualsConfirm.entriesForClick(target, { allEntries: SAMPLE_ENTRIES, blockFilter: "Gastos fijos" });
  assert.deepEqual(entries.map((e) => e.key), ["c|2026-09"]);
});

test("entriesForClick · un clic que no es de ninguno de los dos botones no dispara nada", () => {
  const target = fakeTarget("[data-home-nav]");
  assert.equal(RegistrarActualsConfirm.entriesForClick(target, { allEntries: SAMPLE_ENTRIES, blockFilter: "todos" }), null);
});

// --- selección de partidas sueltas (pedido tras ver R-13 en producción) -----------------------

test("entriesForClick · con partidas seleccionadas, el botón masivo confirma solo esas, aunque haya más pendientes en el bloque", () => {
  const target = fakeTarget("[data-registrar-actuals-confirm-pending]");
  const selectedKeys = new Set(["c|2026-09"]);
  const entries = RegistrarActualsConfirm.entriesForClick(target, { allEntries: SAMPLE_ENTRIES, blockFilter: "todos", selectedKeys });
  assert.deepEqual(entries.map((e) => e.key), ["c|2026-09"]);
});

test("entriesForClick · una selección nunca incluye una partida ya con real, aunque estuviera marcada", () => {
  const target = fakeTarget("[data-registrar-actuals-confirm-pending]");
  const selectedKeys = new Set(["a|2026-09", "b|2026-09"]); // b ya tiene real
  const entries = RegistrarActualsConfirm.entriesForClick(target, { allEntries: SAMPLE_ENTRIES, blockFilter: "todos", selectedKeys });
  assert.deepEqual(entries.map((e) => e.key), ["a|2026-09"]);
});

test("entriesForClick · una selección vacía no manda: se comporta como sin selección (bloque/todos)", () => {
  const target = fakeTarget("[data-registrar-actuals-confirm-pending]");
  const entries = RegistrarActualsConfirm.entriesForClick(target, { allEntries: SAMPLE_ENTRIES, blockFilter: "todos", selectedKeys: new Set() });
  assert.deepEqual(entries.map((e) => e.key), ["a|2026-09", "c|2026-09"]);
});

test("bulkButtonHtml · con partidas seleccionadas, el texto habla de «seleccionadas», no del bloque activo", () => {
  const html = RegistrarActualsConfirm.bulkButtonHtml(5, "Financiaciones", { escapeHtml, selectedCount: 2 });
  assert.match(html, /Confirmar 2 seleccionadas con su previsto</);
  assert.doesNotMatch(html, /Financiaciones|partida/);
});

test("bulkButtonHtml · una sola seleccionada usa singular", () => {
  const html = RegistrarActualsConfirm.bulkButtonHtml(5, "todos", { escapeHtml, selectedCount: 1 });
  assert.match(html, /Confirmar 1 seleccionada con su previsto</);
});

// ------------------------------------------------------------------------------------------------
// handleConfirmClick (extremo a extremo)
// ------------------------------------------------------------------------------------------------

test("handleConfirmClick · un clic de confirmación masiva escribe todo lo pendiente visible y lo cuenta", () => {
  const income = {};
  const expense = {};
  const target = fakeTarget("[data-registrar-actuals-confirm-pending]");
  const result = RegistrarActualsConfirm.handleConfirmClick(target, {
    allEntries: SAMPLE_ENTRIES,
    blockFilter: "todos",
    actualsForKind: (kind) => (kind === "income" ? income : expense),
    recordSessionChange: () => {},
  });
  assert.equal(result.count, 2);
  assert.equal(income["a|2026-09"], 100);
  assert.equal(expense["c|2026-09"], 30);
  assert.equal(expense["b|2026-09"], undefined); // ya tenía real: no se toca
});

test("handleConfirmClick · un clic que no es de este botón devuelve null, sin tocar nada", () => {
  const target = fakeTarget("[data-home-nav]");
  const result = RegistrarActualsConfirm.handleConfirmClick(target, { allEntries: SAMPLE_ENTRIES, blockFilter: "todos", actualsForKind: () => ({}), recordSessionChange: () => {} });
  assert.equal(result, null);
});

// ------------------------------------------------------------------------------------------------
// Integración mínima con app.js — el motor pesado vive en el módulo de arriba (techo ARQ-4 sin
// margen); aquí solo se comprueba que app.js lo referencia y lo cablea de verdad.
// ------------------------------------------------------------------------------------------------

test("app.js referencia el módulo y cablea fila, barra y panel", () => {
  const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
  assert.match(app, /const .*RegistrarActualsConfirm = globalThis\.FinanceCanonicalRegistrarActualsConfirm \|\| null/);
  assert.match(app, /data-registrar-actuals-confirm="/);
  assert.match(app, /qs\("registrarActualsBulk"\)/);
  assert.match(app, /qs\("registrarActualsPanel"\)\?\.addEventListener\("click"/);
  assert.match(app, /RegistrarActualsConfirm\?\.handleConfirmClick/);
});

test("app.js cablea el checkbox de selección de fila y lo pasa como selectedKeys al clic de confirmar", () => {
  const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
  assert.match(app, /registrarActualsSelectedKeys = new Set\(\)/);
  assert.match(app, /data-registrar-actuals-select="/);
  assert.match(app, /registrarActualsSelectedKeys\[checkbox\.checked \? "add" : "delete"\]/);
  assert.match(app, /selectedKeys: registrarActualsSelectedKeys/);
  assert.match(app, /registrarActualsSelectedKeys\.clear\(\)/);
});

test("index.html carga el script del módulo y reserva el contenedor de la barra masiva", () => {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  assert.match(html, /canonical-registrar-actuals-confirm\.js/);
  assert.match(html, /id="registrarActualsBulk"/);
});

test("tools/build-public-site.mjs copia el nuevo módulo al sitio publicado", () => {
  const build = fs.readFileSync(path.join(root, "tools", "build-public-site.mjs"), "utf8");
  assert.match(build, /"canonical-registrar-actuals-confirm\.js"/);
});
