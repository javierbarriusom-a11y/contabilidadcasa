const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8") + "\n" + fs.readFileSync(path.join(root, "views/analisis.js"), "utf8");

// A-13: "Actuar desde el aviso, sin duplicar el camino" — los avisos de Análisis (A-9 "qué se
// repite" y A-10 "confianza del dato") dejaban de tener acción real: enlazaban a Movimientos con un
// `<a href="#movements">` genérico que obligaba a repetir a mano la búsqueda y la selección de
// filas antes de poder usar la barra de acción en lote de M-8. `movementsActFromAlert` deja un
// criterio de una sola vez (`movementsPendingAutoSelect`) que `renderDetailedMovements` consume en
// su siguiente render para preseleccionar exactamente esas filas — el mismo camino de M-8, sin una
// segunda forma de seleccionar o clasificar.

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

function extractConst(name) {
  const start = app.indexOf(`const ${name} =`);
  assert.ok(start >= 0, `No existe la constante ${name} en app.js`);
  let index = app.indexOf("=", start) + 1;
  while (!"([{".includes(app[index])) index += 1;
  let depth = 0;
  let inString = null;
  for (; index < app.length; index += 1) {
    const ch = app[index];
    if (inString) {
      if (ch === "\\") { index += 1; continue; }
      if (ch === inString) inString = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") { inString = ch; continue; }
    if ("([{".includes(ch)) depth += 1;
    else if (")]}".includes(ch)) {
      depth -= 1;
      if (depth === 0) return app.slice(start, index + 1);
    }
  }
  throw new Error(`La constante ${name} no cierra`);
}

function sandboxWith(names, extra = {}) {
  const context = { ...extra };
  vm.createContext(context);
  names.forEach((name) => vm.runInContext(extractFunction(name), context));
  return context;
}

const ROWS = [
  { date: "2026-08-01", valueDate: "2026-08-01", movement: "MERCADONA", details: "COMPRA", category: "Alimentación", amount: -45.2, balance: 1000, source: "extracto" },
  { date: "2026-08-03", valueDate: "2026-08-03", movement: "MERCADONA", details: "COMPRA", category: "Alimentación", amount: -12.1, balance: 950, source: "extracto" },
  { date: "2026-08-05", valueDate: "2026-08-05", movement: "NETFLIX", details: "", category: "Ocio", amount: -13.99, balance: 900, source: "extracto" },
];

function keyFor(row) {
  return `${row.amount >= 0 ? "income" : "expense"}|${row.movement.toLowerCase()}|${(row.details || "").toLowerCase()}`;
}

function fakeQs(overrides = {}) {
  const elements = {
    movementRows: { innerHTML: "" },
    movementCount: { textContent: "" },
    movementsUnclassifiedBanner: { hidden: true, textContent: "" },
    movementsTotals: { textContent: "" },
    movementsSelectAll: { checked: false, disabled: false },
    movementSearch: { value: "" },
    movementDateFrom: { value: "" },
    movementDateTo: { value: "" },
    ...overrides,
  };
  return (id) => elements[id] || null;
}

function sandboxRenderDetailedMovements(extra = {}) {
  const qsMap = fakeQs(extra.qsOverrides);
  const context = {
    movementsChipFilter: "todos",
    movementsSelectedIndexes: new Set(),
    movementsPendingAutoSelect: null,
    baseData: { transactions: ROWS },
    qs: qsMap,
    renderMovementsReconciliation: () => {},
    renderMovementChips: () => {},
    movementsChipCounts: () => ({}),
    mappingForMovement: () => null,
    movementPartidaBadge: () => "",
    movementActionTypeBadge: () => "",
    movementsTotals: () => ({ income: 0, expense: 0 }),
    escapeHtml: (v) => String(v ?? ""),
    formatIsoDate: (v) => v,
    money: (v) => String(v),
    renderMovementsBulkBar: () => { context.bulkBarCalls = (context.bulkBarCalls || 0) + 1; },
    normalizedText: (v) => String(v || "").toLowerCase(),
    ...extra.context,
  };
  vm.createContext(context);
  vm.runInContext(extractConst("MOVEMENT_CHIPS"), context);
  vm.runInContext(extractFunction("movementsRangeAndSearchList"), context);
  vm.runInContext(extractFunction("renderDetailedMovements"), context);
  return context;
}

// --- movementsActFromAlert -------------------------------------------------------------------------

test("A-13 · movementsActFromAlert deja el criterio de búsqueda/chip/fechas y navega a Movimientos", () => {
  const fields = fakeQs();
  const calls = [];
  const context = sandboxWith(["movementsActFromAlert"], {
    qs: fields,
    history: { pushState: (...args) => calls.push(["pushState", ...args]) },
    setActiveView: (...args) => calls.push(["setActiveView", ...args]),
    MOVEMENT_CHIPS: [{ id: "todos" }, { id: "sin-clasificar" }],
  });
  const matcher = () => true;
  context.movementsActFromAlert({ search: "mercadona", chip: "sin-clasificar", dateFrom: "2026-08-01", dateTo: "2026-08-31", matcher });
  assert.equal(fields("movementSearch").value, "mercadona");
  assert.equal(fields("movementDateFrom").value, "2026-08-01");
  assert.equal(fields("movementDateTo").value, "2026-08-31");
  assert.equal(context.movementsChipFilter, "sin-clasificar");
  assert.equal(context.movementsPendingAutoSelect, matcher);
  assert.deepEqual(calls[0], ["pushState", null, "", "#movements"]);
  // El segundo argumento de setActiveView nace dentro del vm (otro realm): se compara campo a
  // campo, no por referencia de objeto (mismo motivo que ya documenta tests/m8-*.test.cjs).
  assert.equal(calls[1][0], "setActiveView");
  assert.equal(calls[1][1], "movements");
  assert.deepEqual({ ...calls[1][2] }, { focus: true });
});

test("A-13 · un chip desconocido no rompe: cae a «todos»", () => {
  const context = sandboxWith(["movementsActFromAlert"], {
    qs: fakeQs(),
    history: { pushState: () => {} },
    setActiveView: () => {},
    MOVEMENT_CHIPS: [{ id: "todos" }, { id: "sin-clasificar" }],
  });
  context.movementsActFromAlert({ chip: "no-existe" });
  assert.equal(context.movementsChipFilter, "todos");
});

// --- renderDetailedMovements + movementsPendingAutoSelect (M-8 real) -------------------------------

test("A-13 · un criterio pendiente preselecciona solo las filas que cumplen el matcher, y se consume", () => {
  const context = sandboxRenderDetailedMovements({
    context: { movementsPendingAutoSelect: (row) => keyFor(row) === keyFor(ROWS[0]) },
  });
  context.renderDetailedMovements();
  // movementsRangeAndSearchList ordena por fecha descendente: la fila más reciente (NETFLIX,
  // 08-05) queda en el índice 0 y las dos de Mercadona (concepto buscado) en el 1 y el 2.
  assert.deepEqual([...context.movementsSelectedIndexes].sort(), [1, 2], "las dos filas de Mercadona comparten concepto");
  assert.equal(context.movementsPendingAutoSelect, null, "el criterio de una sola vez se vacía tras usarse");
  assert.equal(context.bulkBarCalls, 1, "renderMovementsBulkBar se llama con la selección ya puesta");
  // Los checkboxes preseleccionados llevan `checked` en el HTML pintado.
  assert.doesNotMatch(context.qs("movementRows").innerHTML, /data-movement-select-index="0"\s+checked/);
  assert.match(context.qs("movementRows").innerHTML, /data-movement-select-index="1"\s+checked/);
  assert.match(context.qs("movementRows").innerHTML, /data-movement-select-index="2"\s+checked/);
});

test("A-13 · un matcher que selecciona todo (A-10) marca «seleccionar todo»", () => {
  const context = sandboxRenderDetailedMovements({
    context: { movementsPendingAutoSelect: () => true },
  });
  context.renderDetailedMovements();
  assert.equal(context.movementsSelectedIndexes.size, ROWS.length);
  assert.equal(context.qs("movementsSelectAll").checked, true);
});

test("A-13 · sin criterio pendiente, un render normal no preselecciona nada (comportamiento previo intacto)", () => {
  const context = sandboxRenderDetailedMovements();
  context.renderDetailedMovements();
  assert.equal(context.movementsSelectedIndexes.size, 0);
  assert.doesNotMatch(context.qs("movementRows").innerHTML, /checked/);
});

test("A-13 · un segundo render sin criterio nuevo no repite la preselección anterior (M-8: se vacía en cada filtro)", () => {
  const context = sandboxRenderDetailedMovements({
    context: { movementsPendingAutoSelect: () => true },
  });
  context.renderDetailedMovements();
  assert.equal(context.movementsSelectedIndexes.size, ROWS.length);
  context.renderDetailedMovements();
  assert.equal(context.movementsSelectedIndexes.size, 0, "el criterio ya se consumió en el primer render");
});

// --- Los dos avisos de Análisis (A-9/A-10) llaman al mismo puente, sin duplicar el camino ----------

test("A-13 · handleAnalisisActuarConfianza acota el chip «sin clasificar» al mes del aviso y selecciona todo", () => {
  const calls = [];
  const context = sandboxWith(["handleAnalisisActuarConfianza", "movementsActFromAlert", "dateFromMonthKey", "isoLocalDate", "localDateFromIso", "monthEndDate"], {
    qs: fakeQs(),
    history: { pushState: () => {} },
    setActiveView: (...args) => calls.push(args),
    MOVEMENT_CHIPS: [{ id: "todos" }, { id: "sin-clasificar" }],
  });
  context.handleAnalisisActuarConfianza("2026-08");
  assert.equal(context.movementsChipFilter, "sin-clasificar");
  assert.equal(context.qs("movementDateFrom").value, "2026-08-01");
  assert.equal(context.qs("movementDateTo").value, "2026-08-31");
  assert.equal(context.movementsPendingAutoSelect({}), true, "sin concepto único, selecciona todo lo filtrado");
  assert.equal(calls[0][0], "movements");
  assert.deepEqual({ ...calls[0][1] }, { focus: true });
});

test("A-13 · sin mes (aviso sin datos todavía), handleAnalisisActuarConfianza no navega a ciegas", () => {
  const calls = [];
  const context = sandboxWith(["handleAnalisisActuarConfianza", "movementsActFromAlert"], {
    qs: fakeQs(),
    history: { pushState: () => calls.push("push") },
    setActiveView: () => calls.push("nav"),
  });
  context.handleAnalisisActuarConfianza("");
  assert.deepEqual(calls, []);
});

test("A-13 · handleAnalisisActuarRepite preselecciona por movementMappingKey exacto, no por texto suelto", () => {
  const context = sandboxWith(["handleAnalisisActuarRepite", "movementsActFromAlert"], {
    qs: fakeQs(),
    history: { pushState: () => {} },
    setActiveView: () => {},
    MOVEMENT_CHIPS: [{ id: "todos" }],
    movementMappingKey: keyFor,
  });
  context.handleAnalisisActuarRepite(keyFor(ROWS[0]), "Mercadona");
  assert.equal(context.qs("movementSearch").value, "Mercadona", "un único concepto sí se deja escrito en el buscador");
  assert.equal(context.movementsChipFilter, "todos");
  assert.equal(context.movementsPendingAutoSelect(ROWS[0]), true);
  assert.equal(context.movementsPendingAutoSelect(ROWS[2]), false, "Netflix no comparte concepto con Mercadona");
});

test("A-13 · handleAnalisisActuarRepite con varios conceptos a la vez no rellena el buscador con un texto sin sentido", () => {
  const context = sandboxWith(["handleAnalisisActuarRepite", "movementsActFromAlert"], {
    qs: fakeQs(),
    history: { pushState: () => {} },
    setActiveView: () => {},
    MOVEMENT_CHIPS: [{ id: "todos" }],
    movementMappingKey: keyFor,
  });
  context.handleAnalisisActuarRepite(`${keyFor(ROWS[0])}||${keyFor(ROWS[2])}`, "");
  assert.equal(context.qs("movementSearch").value, "");
  assert.equal(context.movementsPendingAutoSelect(ROWS[0]), true);
  assert.equal(context.movementsPendingAutoSelect(ROWS[2]), true);
  assert.equal(context.movementsPendingAutoSelect(ROWS[1]), true, "la segunda fila de Mercadona comparte el primer concepto");
});

test("A-13 · handleAnalisisActuarRepite sin conceptos no navega a ciegas", () => {
  const calls = [];
  const context = sandboxWith(["handleAnalisisActuarRepite", "movementsActFromAlert"], {
    qs: fakeQs(),
    history: { pushState: () => calls.push("push") },
    setActiveView: () => calls.push("nav"),
  });
  context.handleAnalisisActuarRepite("", "");
  assert.deepEqual(calls, []);
});
