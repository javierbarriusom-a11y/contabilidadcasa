const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

// M-8 (selección múltiple y acción en lote) y M-8b (consistencia con Registrar y el importador),
// las dos tareas de talla L/M de Movimientos que quedaron aparcadas para su propia sesión (ver la
// nota bajo la tabla de la pantalla 03 en docs/BACKLOG_NUEVE_PANTALLAS.md). No escriben una
// segunda forma de clasificar: reutilizan tal cual el mismo diccionario `movementMappings` y la
// misma secuencia de refresco que ya usaban M-7 (reclasificar una fila) y la revisión de
// importación (`applyPendingMovementMappings`) — solo cambia cómo se eligen los conceptos a tocar.

function extractFunction(name) {
  let start = app.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `No existe la función ${name} en app.js`);
  if (start >= 6 && app.slice(start - 6, start) === "async ") start -= 6;
  let parenDepth = 0;
  let bodyStart = -1;
  for (let index = app.indexOf("(", start); index < app.length; index += 1) {
    if (app[index] === "(") parenDepth += 1;
    else if (app[index] === ")") {
      parenDepth -= 1;
      if (parenDepth === 0) {
        bodyStart = app.indexOf("{", index);
        break;
      }
    }
  }
  assert.ok(bodyStart >= 0, `No se encontró el cuerpo de ${name}`);
  let depth = 0;
  for (let index = bodyStart; index < app.length; index += 1) {
    if (app[index] === "{") depth += 1;
    else if (app[index] === "}") {
      depth -= 1;
      if (depth === 0) return app.slice(start, index + 1);
    }
  }
  throw new Error(`La función ${name} no cierra sus llaves`);
}

function sandboxWith(names, extra = {}) {
  const context = { ...extra };
  vm.createContext(context);
  names.forEach((name) => vm.runInContext(extractFunction(name), context));
  return context;
}

// Fábrica de un `document` mínimo: querySelectorAll sobre una lista de checkboxes de prueba, para
// los manejadores que recorren `[data-movement-select-index]` (seleccionar todo, cancelar).
function fakeDocument(checkboxes) {
  return {
    querySelectorAll: (selector) => (selector === "[data-movement-select-index]" ? checkboxes : []),
  };
}

const ROWS = [
  { date: "2026-08-01", movement: "MERCADONA", details: "COMPRA", amount: -45.2 },
  { date: "2026-08-03", movement: "MERCADONA", details: "COMPRA", amount: -12.1 },
  { date: "2026-08-05", movement: "NETFLIX", details: "", amount: -13.99 },
  { date: "2026-08-05", movement: "NOMINA", details: "", amount: 1800 },
];

function keyFor(row) {
  return `${row.amount >= 0 ? "income" : "expense"}|${row.movement.toLowerCase()}|${row.details.toLowerCase()}`;
}

// --- movementsSelectedRows / movementsSelectedConceptKeys ----------------------------------------

test("M-8 · movementsSelectedRows lee las filas seleccionadas por índice sobre la lista filtrada actual", () => {
  const context = sandboxWith(["movementsSelectedRows"], {
    movementsFilteredList: () => ROWS,
    movementsSelectedIndexes: new Set([0, 2]),
  });
  // [...rows] se reconstruye en el realm del test: el array que devuelve movementsSelectedRows()
  // se creó dentro del vm y, aunque sus elementos son las mismas referencias a ROWS, comparar el
  // propio array cruzando realms hace que deepEqual falle por prototipos distintos, no por contenido.
  const rows = [...context.movementsSelectedRows()];
  assert.deepEqual(rows, [ROWS[0], ROWS[2]]);
});

test("M-8 · un índice fuera de rango (selección obsoleta) se descarta en vez de romper", () => {
  const context = sandboxWith(["movementsSelectedRows"], {
    movementsFilteredList: () => ROWS,
    movementsSelectedIndexes: new Set([0, 99]),
  });
  assert.deepEqual([...context.movementsSelectedRows()], [ROWS[0]]);
});

test("M-8 · movementsSelectedConceptKeys agrupa por concepto, no por movimiento: dos filas de Mercadona son un solo concepto", () => {
  const context = sandboxWith(["movementsSelectedConceptKeys"], {
    movementMappingKey: keyFor,
  });
  const concepts = context.movementsSelectedConceptKeys([ROWS[0], ROWS[1], ROWS[2]]);
  assert.equal(concepts.size, 2);
  assert.ok(concepts.has(keyFor(ROWS[0])));
  assert.ok(concepts.has(keyFor(ROWS[2])));
});

// --- HTML: casilla de selección, seleccionar todo, barra de lote ---------------------------------

test("M-8 · index.html declara la casilla de «seleccionar todo» como primera columna de la tabla", () => {
  assert.match(html, /<th><input type="checkbox" id="movementsSelectAll"/);
});

test("M-8 · index.html declara la barra de acción en lote con sus campos", () => {
  ["movementsBulkBar", "movementsBulkCount", "movementsBulkPartida", "movementsBulkNote", "movementsBulkClear", "movementsBulkApply"].forEach((id) => {
    assert.match(html, new RegExp(`id="${id}"`), `Falta id="${id}" en index.html`);
  });
});

test("M-8 · la barra de lote empieza oculta", () => {
  assert.match(html, /<div class="movements-bulk-bar e19-impact-bar" id="movementsBulkBar" hidden>/);
});

// --- renderMovementsBulkBar ------------------------------------------------------------------------

function fakeEl() {
  return { hidden: false, disabled: false, textContent: "", innerHTML: "", value: "" };
}

test("M-8 · sin selección, la barra queda oculta", () => {
  const bar = fakeEl();
  const context = sandboxWith(["renderMovementsBulkBar", "movementsSelectedRows", "movementsSelectedConceptKeys"], {
    qs: (id) => (id === "movementsBulkBar" ? bar : fakeEl()),
    movementsFilteredList: () => [],
    movementsSelectedIndexes: new Set(),
    movementMappingKey: keyFor,
    movementKindFromAmount: (amount) => (amount >= 0 ? "income" : "expense"),
    mappingForMovement: () => null,
    movementMappingOptions: () => "",
  });
  context.renderMovementsBulkBar();
  assert.equal(bar.hidden, true);
});

function sandboxBulkBar({ selected = [0, 1], mapped = () => null } = {}) {
  const els = { movementsBulkBar: fakeEl(), movementsBulkCount: fakeEl(), movementsBulkPartida: fakeEl(), movementsBulkNote: fakeEl(), movementsBulkApply: fakeEl() };
  const context = sandboxWith(["renderMovementsBulkBar", "movementsSelectedRows", "movementsSelectedConceptKeys"], {
    qs: (id) => els[id] || null,
    movementsFilteredList: () => ROWS,
    movementsSelectedIndexes: new Set(selected),
    movementMappingKey: keyFor,
    movementKindFromAmount: (amount) => (amount >= 0 ? "income" : "expense"),
    mappingForMovement: mapped,
    movementMappingOptions: (kind, selectedValue) => `<option value="x-${kind}">x</option>`,
  });
  context.renderMovementsBulkBar();
  return { context, els };
}

test("M-8 · con selección homogénea (todo gasto), la barra se muestra con el recuento y habilita el selector de partida", () => {
  const { els } = sandboxBulkBar({ selected: [0, 1] });
  assert.equal(els.movementsBulkBar.hidden, false);
  assert.match(els.movementsBulkCount.textContent, /2 movimiento\(s\) seleccionados · 1 concepto\(s\) distinto\(s\)/);
  assert.equal(els.movementsBulkPartida.disabled, false);
  assert.match(els.movementsBulkPartida.innerHTML, /x-expense/);
});

test("M-8 · mezclar ingresos y gastos en la selección bloquea el selector con el motivo, no ofrece una lista a medias", () => {
  const { els } = sandboxBulkBar({ selected: [0, 3] }); // Mercadona (gasto) + Nómina (ingreso)
  assert.equal(els.movementsBulkPartida.disabled, true);
  assert.equal(els.movementsBulkPartida.innerHTML, "");
  assert.match(els.movementsBulkNote.textContent, /del mismo tipo/);
  assert.equal(els.movementsBulkApply.disabled, true);
});

test("M-8 · si algún concepto seleccionado ya tenía partida, la nota avisa de que se sobrescribirá", () => {
  const { els } = sandboxBulkBar({ selected: [0, 1], mapped: (row) => (row.movement === "MERCADONA" ? { row: {} } : null) });
  assert.match(els.movementsBulkNote.textContent, /ya tenían otra partida asignada: se sobrescribirá/);
});

test("M-8 · sin partida ya asignada, la nota explica que la regla también cubre movimientos futuros", () => {
  const { els } = sandboxBulkBar({ selected: [0, 1], mapped: () => null });
  assert.match(els.movementsBulkNote.textContent, /movimientos futuros con el mismo concepto/);
});

// --- Selección: alternar fila, seleccionar todo, cancelar -----------------------------------------

test("M-8 · handleMovementsSelectToggle añade o quita el índice marcado y repinta la barra", () => {
  const selected = new Set();
  let rendered = 0;
  const checkbox = { checked: true, dataset: { movementSelectIndex: "2" } };
  const context = sandboxWith(["handleMovementsSelectToggle"], {
    movementsSelectedIndexes: selected,
    movementsFilteredList: () => ROWS,
    qs: () => ({ checked: false }),
    renderMovementsBulkBar: () => { rendered += 1; },
  });
  context.handleMovementsSelectToggle({ target: { closest: () => checkbox } });
  assert.ok(selected.has(2));
  assert.equal(rendered, 1);
  checkbox.checked = false;
  context.handleMovementsSelectToggle({ target: { closest: () => checkbox } });
  assert.ok(!selected.has(2));
});

test("M-8 · handleMovementsSelectToggle marca «seleccionar todo» cuando la selección cubre toda la vista filtrada", () => {
  const selected = new Set([0, 1, 2]);
  const selectAll = { checked: false };
  const checkbox = { checked: true, dataset: { movementSelectIndex: "3" } };
  const context = sandboxWith(["handleMovementsSelectToggle"], {
    movementsSelectedIndexes: selected,
    movementsFilteredList: () => ROWS,
    qs: (id) => (id === "movementsSelectAll" ? selectAll : null),
    renderMovementsBulkBar: () => {},
  });
  context.handleMovementsSelectToggle({ target: { closest: () => checkbox } });
  assert.equal(selectAll.checked, true);
});

test("M-8 · handleMovementsSelectAll selecciona todas las filas visibles y marca cada casilla", () => {
  const checkboxes = ROWS.map((_, index) => ({ checked: false, dataset: { movementSelectIndex: String(index) } }));
  // Una reasignación completa de `movementsSelectedIndexes` (no un `.add`/`.clear` sobre el mismo
  // Set) hecha dentro del vm sí sincroniza de vuelta con la propiedad del objeto de contexto — no
  // hace falta un accessor get/set, que además no se comporta igual al recontextificarse.
  const context = sandboxWith(["handleMovementsSelectAll"], {
    movementsFilteredList: () => ROWS,
    movementsSelectedIndexes: new Set(),
    document: fakeDocument(checkboxes),
    renderMovementsBulkBar: () => {},
  });
  context.handleMovementsSelectAll({ target: { checked: true } });
  assert.equal(context.movementsSelectedIndexes.size, ROWS.length);
  assert.ok(checkboxes.every((checkbox) => checkbox.checked));
});

test("M-8 · handleMovementsSelectAll desmarcado vacía la selección y desmarca cada casilla", () => {
  const checkboxes = [{ checked: true, dataset: { movementSelectIndex: "0" } }];
  const context = sandboxWith(["handleMovementsSelectAll"], {
    movementsFilteredList: () => ROWS,
    movementsSelectedIndexes: new Set([0]),
    document: fakeDocument(checkboxes),
    renderMovementsBulkBar: () => {},
  });
  context.handleMovementsSelectAll({ target: { checked: false } });
  assert.equal(context.movementsSelectedIndexes.size, 0);
  assert.equal(checkboxes[0].checked, false);
});

test("M-8 · handleMovementsBulkClear vacía la selección, desmarca casillas y oculta «seleccionar todo»", () => {
  const checkboxes = [{ checked: true, dataset: { movementSelectIndex: "0" } }];
  const selectAll = { checked: true };
  const selected = new Set([0]);
  let rendered = 0;
  const context = sandboxWith(["handleMovementsBulkClear"], {
    movementsSelectedIndexes: selected,
    document: fakeDocument(checkboxes),
    qs: (id) => (id === "movementsSelectAll" ? selectAll : null),
    renderMovementsBulkBar: () => { rendered += 1; },
  });
  context.handleMovementsBulkClear();
  assert.equal(selected.size, 0);
  assert.equal(checkboxes[0].checked, false);
  assert.equal(selectAll.checked, false);
  assert.equal(rendered, 1);
});

// --- datosImportarRefreshRowsForMappings (M-8b) ---------------------------------------------------

test("M-8b · sin sesión de importación activa, no hace nada", () => {
  const context = sandboxWith(["datosImportarRefreshRowsForMappings"], {
    datosImportarSession: null,
  });
  assert.doesNotThrow(() => context.datosImportarRefreshRowsForMappings(new Set(["expense|mercadona|compra"])));
});

test("M-8b · refresca prior/suggestion solo en las filas del concepto recién clasificado y no decididas aún", () => {
  const session = {
    rows: [
      { decision: null, transaction: ROWS[0], prior: { status: "pendiente" }, suggestion: null },
      { decision: { tipo: "ignorar" }, transaction: ROWS[1], prior: { status: "pendiente" }, suggestion: null },
      { decision: null, transaction: ROWS[2], prior: { status: "pendiente" }, suggestion: null },
    ],
  };
  const context = sandboxWith(["datosImportarRefreshRowsForMappings"], {
    datosImportarSession: session,
    movementMappingKey: keyFor,
    datosImportarLoadIgnored: () => ({}),
    datosImportarPriorClassification: (transaction) => ({ status: "regla-previa", mapping: { row: { id: "x" } } }),
    datosImportarSuggestionFor: () => null,
  });
  context.datosImportarRefreshRowsForMappings(new Set([keyFor(ROWS[0])]));
  assert.equal(session.rows[0].prior.status, "regla-previa", "la fila sin decidir del concepto tocado se refresca");
  assert.equal(session.rows[1].prior.status, "pendiente", "una fila ya decidida por el usuario no se pisa, aunque coincida el concepto");
  assert.equal(session.rows[2].prior.status, "pendiente", "una fila de otro concepto no se toca");
});

test("M-8b · si el nuevo prior sigue pendiente, también se recalcula la sugerencia", () => {
  const session = { rows: [{ decision: null, transaction: ROWS[2], prior: { status: "pendiente" }, suggestion: null }] };
  let suggestionCalls = 0;
  const context = sandboxWith(["datosImportarRefreshRowsForMappings"], {
    datosImportarSession: session,
    movementMappingKey: keyFor,
    datosImportarLoadIgnored: () => ({}),
    datosImportarPriorClassification: () => ({ status: "pendiente", mapping: null }),
    datosImportarSuggestionFor: () => { suggestionCalls += 1; return { id: "sugerida" }; },
  });
  context.datosImportarRefreshRowsForMappings(new Set([keyFor(ROWS[2])]));
  assert.equal(suggestionCalls, 1);
  assert.deepEqual(session.rows[0].suggestion, { id: "sugerida" });
});

// --- handleMovementsBulkApply: la escritura real ---------------------------------------------------

function sandboxBulkApply({ selected = [0, 1], mapped = () => null } = {}) {
  const calls = [];
  const movementMappings = {};
  const partidaSelect = { value: "gastos-alimentacion", options: [{}, { textContent: "Gastos fijos · Alimentación" }], selectedIndex: 1 };
  const context = sandboxWith(["handleMovementsBulkApply", "movementsSelectedRows", "movementsSelectedConceptKeys"], {
    movementsFilteredList: () => ROWS,
    movementsSelectedIndexes: new Set(selected),
    qs: (id) => (id === "movementsBulkPartida" ? partidaSelect : null),
    movementMappingKey: keyFor,
    movementKindFromAmount: (amount) => (amount >= 0 ? "income" : "expense"),
    movementMappings,
    mappingForMovement: mapped,
    saveMovementMappings: () => calls.push("saveMovementMappings"),
    applyMovementMappingsToActuals: () => { calls.push("applyMovementMappingsToActuals"); return 4; },
    buildPendingMovementMappings: () => [],
    datosImportarRefreshRowsForMappings: (keys) => calls.push(["datosImportarRefreshRowsForMappings", [...keys].sort()]),
    saveIncomeActuals: () => calls.push("saveIncomeActuals"),
    saveExpenseActuals: () => calls.push("saveExpenseActuals"),
    refreshAllSectionsAfterDataChange: () => calls.push("refreshAllSectionsAfterDataChange"),
    announceStatus: (message) => calls.push(["announceStatus", message]),
    renderDetailedMovements: () => calls.push("renderDetailedMovements"),
    baseData: { transactions: [] },
    pendingMovementMappings: [],
  });
  context.handleMovementsBulkApply();
  return { context, calls, movementMappings, partidaSelect };
}

test("M-8 · aplicar el lote escribe una regla por concepto distinto, no una por movimiento", () => {
  const { movementMappings } = sandboxBulkApply({ selected: [0, 1] }); // dos filas de Mercadona = 1 concepto
  assert.equal(Object.keys(movementMappings).length, 1);
  const saved = movementMappings[keyFor(ROWS[0])];
  assert.equal(saved.kind, "expense");
  assert.equal(saved.rowKey, "gastos-alimentacion");
  assert.equal(saved.label, "Gastos fijos · Alimentación");
});

test("M-8 · aplicar el lote sobre varios conceptos escribe una regla por cada uno", () => {
  const { movementMappings } = sandboxBulkApply({ selected: [0, 2] }); // Mercadona + Netflix
  assert.equal(Object.keys(movementMappings).length, 2);
  assert.ok(movementMappings[keyFor(ROWS[0])]);
  assert.ok(movementMappings[keyFor(ROWS[2])]);
});

test("M-8 · aplicar el lote sigue exactamente la misma secuencia de refresco que M-7 y la revisión de importación", () => {
  const { calls } = sandboxBulkApply({ selected: [0, 1] });
  assert.deepEqual(calls, [
    "saveMovementMappings",
    "applyMovementMappingsToActuals",
    ["datosImportarRefreshRowsForMappings", [keyFor(ROWS[0])]],
    "saveIncomeActuals",
    "saveExpenseActuals",
    "refreshAllSectionsAfterDataChange",
    ["announceStatus", "1 concepto(s) (2 movimiento(s)) reclasificados a «Gastos fijos · Alimentación». 4 importe(s) reales recalculados desde movimientos."],
    "renderDetailedMovements",
  ]);
});

test("M-8 · sin nada seleccionado, aplicar no hace nada", () => {
  const { calls } = sandboxBulkApply({ selected: [] });
  assert.deepEqual(calls, []);
});

test("M-8 · mezclar ingresos y gastos en la selección impide aplicar, aunque el selector tuviera un valor", () => {
  const { calls, movementMappings } = sandboxBulkApply({ selected: [0, 3] });
  assert.deepEqual(calls, []);
  assert.deepEqual(movementMappings, {});
});

test("M-8 · sin partida elegida en el selector, aplicar no hace nada", () => {
  const calls = [];
  const movementMappings = {};
  const partidaSelect = { value: "", options: [], selectedIndex: -1 };
  const context = sandboxWith(["handleMovementsBulkApply", "movementsSelectedRows", "movementsSelectedConceptKeys"], {
    movementsFilteredList: () => ROWS,
    movementsSelectedIndexes: new Set([0]),
    qs: (id) => (id === "movementsBulkPartida" ? partidaSelect : null),
    movementMappingKey: keyFor,
    movementKindFromAmount: (amount) => (amount >= 0 ? "income" : "expense"),
    movementMappings,
    mappingForMovement: () => null,
    saveMovementMappings: () => calls.push("saveMovementMappings"),
  });
  context.handleMovementsBulkApply();
  assert.deepEqual(calls, []);
});

// --- Cableado --------------------------------------------------------------------------------------

test("M-8 · renderDetailedMovements vacía la selección en cada render (cambiar de filtro invalida los índices)", () => {
  const fn = extractFunction("renderDetailedMovements");
  assert.match(fn, /movementsSelectedIndexes\.clear\(\)/);
  assert.match(fn, /renderMovementsBulkBar\(\)/);
});

test("M-8 · los manejadores del lote quedan enlazados en el arranque", () => {
  [
    'qs("movementRows")?.addEventListener("change", handleMovementsSelectToggle)',
    'qs("movementsSelectAll")?.addEventListener("change", handleMovementsSelectAll)',
    'qs("movementsBulkClear")?.addEventListener("click", handleMovementsBulkClear)',
    'qs("movementsBulkApply")?.addEventListener("click", handleMovementsBulkApply)',
  ].forEach((snippet) => {
    assert.ok(app.includes(snippet), `Falta el cableado: ${snippet}`);
  });
});

test("M-8b · handleMovementReclassify (M-7) también refresca una sesión de importación a medias, solo cuando se marcó «recordar»", () => {
  const fn = extractFunction("handleMovementReclassify");
  assert.match(fn, /const key = remember \? movementMappingKey\(row\) : transactionIdentity\(row\);/);
  assert.match(fn, /if \(remember\) datosImportarRefreshRowsForMappings\(new Set\(\[key\]\)\);/);
});
