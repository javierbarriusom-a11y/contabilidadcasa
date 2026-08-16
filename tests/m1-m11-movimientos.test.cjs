const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

// Movimientos (03 · backlog «Nueve pantallas»), M-1 a M-11 salvo M-8c (el cuadre contra Cierre —
// Cierre todavía no existe). M-8/M-8b (selección múltiple, acción en lote y su consistencia con
// Registrar y el importador) tienen su propia sesión y su propio archivo de pruebas
// (`tests/m8-m8b-movimientos-lote.test.cjs`), igual que R-8/R-9 la tuvieron en Registrar.
// `#movements` se evoluciona en el mismo sitio (no se construye una pantalla nueva al lado): el
// enlace de menú ya apuntaba aquí desde Fase 3, así que no hay una heredada que adoptar o
// sustituir, solo contenido que completar. La tarjeta de importación por Excel y la lista de
// comercios de arriba no se tocan.

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

// Balanceada por corchetes (respetando cadenas), igual que `extractConst` en
// tests/d4-d5-d6-deuda-calendario-modos.test.cjs — MOVEMENT_CHIPS es un array literal, no una
// función, así que no vale `extractFunction`.
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

// movementsFilteredList/movementsChipCounts/renderMovementChips dependen de MOVEMENT_CHIPS y
// movementsChipFilter (declaradas con const/let a nivel de módulo, no extraíbles como función) y
// de movementsRangeAndSearchList — se cargan siempre juntas para que el filtro real (no una copia
// de mano de los seis chips) sea el que se prueba.
function sandboxMovements(names, extra = {}) {
  const context = { movementsChipFilter: "todos", ...extra };
  vm.createContext(context);
  vm.runInContext(extractConst("MOVEMENT_CHIPS"), context);
  vm.runInContext(extractFunction("movementsRangeAndSearchList"), context);
  names.forEach((name) => vm.runInContext(extractFunction(name), context));
  return context;
}

function fakeQs(values) {
  return (id) => (Object.prototype.hasOwnProperty.call(values, id) ? { value: values[id] } : null);
}

const TXNS = [
  { date: "2026-08-01", valueDate: "2026-08-01", movement: "MERCADONA", details: "COMPRA", category: "Alimentación", amount: -45.2, balance: 1000, source: "extracto", month: "2026-08" },
  { date: "2026-08-05", valueDate: "2026-08-05", movement: "NOMINA", details: "", category: "Ingresos", amount: 1800, balance: 2800.8, source: "extracto", month: "2026-08" },
  { date: "2026-07-20", valueDate: "2026-07-20", movement: "AMAZON", details: "PEDIDO", category: "Compras", amount: -60, balance: 900, source: "extracto", month: "2026-07" },
];

// --- M-1 · migajas -------------------------------------------------------------------------------

test("M-1 · Movimientos tiene sus propias migajas en la sección, no solo el título global de la vista", () => {
  assert.match(html, /<p class="e19-registrar-crumb" id="movementsCrumb">Movimientos › Extracto real<\/p>/);
});

// --- M-2 / M-4 / M-11 · tabla, partida y no-edición -----------------------------------------------

test("M-2 · la tabla trae columna «Partida» además de las heredadas (Fecha…Origen)", () => {
  assert.match(html, /<th>Categoría<\/th>\s*<th>Partida<\/th>\s*<th>Importe<\/th>/);
});

// M-2/M-6 (auditoría del 15 de agosto, Prioridad 4): «concepto con cuenta» en la tabla y un campo
// «cuenta» en el detalle. No hay atributo de cuenta en el histórico ya cargado — se etiqueta solo
// hacia delante, al importar (ver tests/r8-registrar-importar-extracto.test.cjs); aquí solo se
// comprueba que la tabla y el detalle lo muestran cuando existe, y un hueco («—») cuando no.

test("M-2 · la tabla trae columna «Cuenta» después de «Origen»", () => {
  assert.match(html, /<th>Origen<\/th>\s*<th>Cuenta<\/th>\s*<th><\/th>/);
});

test("M-2 · renderDetailedMovements pinta la cuenta del movimiento, o un hueco si no la tiene", () => {
  const fn = extractFunction("renderDetailedMovements");
  assert.match(fn, /<td>\$\{escapeHtml\(row\.account \|\| "—"\)\}<\/td>/);
});

test("M-6 · el panel de detalle trae el campo Cuenta, con el mismo hueco cuando no hay dato", () => {
  const content = { innerHTML: "" };
  const context = sandboxWith(["renderMovementDetailDialog"], {
    movementDetailTransaction: { date: "2026-08-01", movement: "MERCADONA", amount: -45.2, account: "CaixaBank" },
    qs: (id) => (id === "movementDetailContent" ? content : null),
    mappingForMovement: () => null,
    movementKindFromAmount: () => "expense",
    escapeHtml: (v) => String(v),
    formatIsoDate: (v) => v,
    money: (v) => String(v),
    movementDisplayName: (row) => row.movement,
    movementMappingOptions: () => "<option></option>",
  });
  context.renderMovementDetailDialog();
  assert.match(content.innerHTML, /<dt>Cuenta<\/dt><dd>CaixaBank<\/dd>/);
});

test("M-6 · el campo Cuenta muestra un hueco («—») en vez de fabricar un valor cuando el movimiento no la tiene", () => {
  const content = { innerHTML: "" };
  const context = sandboxWith(["renderMovementDetailDialog"], {
    movementDetailTransaction: { date: "2026-08-01", movement: "AMAZON", amount: -60 },
    qs: (id) => (id === "movementDetailContent" ? content : null),
    mappingForMovement: () => null,
    movementKindFromAmount: () => "expense",
    escapeHtml: (v) => String(v),
    formatIsoDate: (v) => v,
    money: (v) => String(v),
    movementDisplayName: (row) => row.movement,
    movementMappingOptions: () => "<option></option>",
  });
  context.renderMovementDetailDialog();
  assert.match(content.innerHTML, /<dt>Cuenta<\/dt><dd>—<\/dd>/);
});

test("M-11 · ninguna fila de la tabla trae un input editable de importe: los importes no se editan en Movimientos", () => {
  const fn = extractFunction("renderDetailedMovements");
  // M-8 añade una casilla de selección por fila (para la acción en lote) — no es un editor de
  // importe: es el único <input> que debe aparecer en la fila, y es de tipo checkbox.
  const inputs = fn.match(/<input[^>]*>/g) || [];
  assert.equal(inputs.length, 1, "solo debe haber un <input> por fila: la casilla de selección de M-8");
  assert.match(inputs[0], /type="checkbox"/);
  assert.match(inputs[0], /movements-row-select/);
  assert.ok(
    fn.includes('<td class="${row.amount < 0 ? "negative" : "positive"}">${money(row.amount, true)}</td>'),
    "el importe debe pintarse como texto formateado con money(), no como un campo editable",
  );
  assert.match(html, /Los importes no se editan aquí/);
});

test("M-4 · sin mapping, la partida se pinta como hueco (aviso), no como una partida inventada", () => {
  const { movementPartidaBadge } = sandboxWith(["movementPartidaBadge"], {
    mappingForMovement: () => null,
    escapeHtml: (v) => String(v),
  });
  const badge = movementPartidaBadge({});
  assert.match(badge, /Sin partida/);
  assert.match(badge, /e19-badge-warning/);
});

test("M-4 · con mapping, la partida muestra el bloque y la etiqueta reales, leídos de mappingForMovement", () => {
  const { movementPartidaBadge } = sandboxWith(["movementPartidaBadge"], {
    mappingForMovement: () => ({ row: { sectionName: "Gastos fijos" } }),
    escapeHtml: (v) => String(v),
    displayLabelForRow: () => "Seguro coche",
  });
  const badge = movementPartidaBadge({});
  assert.match(badge, /Gastos fijos/);
  assert.match(badge, /Seguro coche/);
  assert.match(badge, /e19-badge-neutral/);
});

// --- M-3 (auditoría 15 de agosto) · seis chips, rango libre con atajos, búsqueda por concepto o importe --

test("M-3 · el filtro trae rango de fechas (Desde/Hasta), los cuatro atajos y el contenedor de chips", () => {
  assert.match(html, /<input id="movementDateFrom" type="date" \/>/);
  assert.match(html, /<input id="movementDateTo" type="date" \/>/);
  assert.doesNotMatch(html, /id="movementMonthFilter"/, "el <select> de mes lo sustituyen el rango y los atajos");
  assert.match(html, /data-movement-range="mes">Este mes</);
  assert.match(html, /data-movement-range="trimestre">Últimos 3 meses</);
  assert.match(html, /data-movement-range="anio">Año en curso</);
  assert.match(html, /data-movement-range="todo">Todo</);
  assert.match(html, /<div class="movement-chips" id="movementChips"/);
  assert.match(html, /placeholder="Concepto o importe"/);
});

test("M-3 · MOVEMENT_CHIPS trae los seis chips del criterio, en el mismo orden que el mockup", () => {
  const chips = extractConst("MOVEMENT_CHIPS");
  const ids = [...chips.matchAll(/id: "([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(ids, ["todos", "sin-clasificar", "gastos", "ingresos", "manual", "duplicado-revisado"]);
});

test("M-3 · movementsFilteredList filtra por chip (gastos/ingresos), ya no por un <select> de mes", () => {
  const gastos = sandboxMovements(["movementsFilteredList"], {
    baseData: { transactions: TXNS },
    qs: fakeQs({}),
    normalizedText: (v) => String(v).toLowerCase(),
    money: (v) => String(v),
    mappingForMovement: () => ({ row: {} }),
    movementsChipFilter: "gastos",
  }).movementsFilteredList();
  assert.equal(gastos.length, 2);
  assert.ok(gastos.every((row) => row.amount < 0));

  const ingresos = sandboxMovements(["movementsFilteredList"], {
    baseData: { transactions: TXNS },
    qs: fakeQs({}),
    normalizedText: (v) => String(v).toLowerCase(),
    money: (v) => String(v),
    mappingForMovement: () => ({ row: {} }),
    movementsChipFilter: "ingresos",
  }).movementsFilteredList();
  assert.equal(ingresos.length, 1);
  assert.equal(ingresos[0].movement, "NOMINA");
});

test("M-3 · movementsFilteredList filtra por rango de fechas, con cualquier chip", () => {
  const { movementsFilteredList } = sandboxMovements(["movementsFilteredList"], {
    baseData: { transactions: TXNS },
    qs: fakeQs({ movementDateFrom: "2026-08-01", movementDateTo: "2026-08-01" }),
    normalizedText: (v) => String(v).toLowerCase(),
    money: (v) => String(v),
    mappingForMovement: () => null,
  });
  const list = movementsFilteredList();
  assert.equal(list.length, 1);
  assert.equal(list[0].movement, "MERCADONA");
});

test("M-3 · movementsFilteredList sigue filtrando por búsqueda de texto (concepto)", () => {
  const { movementsFilteredList } = sandboxMovements(["movementsFilteredList"], {
    baseData: { transactions: TXNS },
    qs: fakeQs({ movementSearch: "amazon" }),
    normalizedText: (v) => String(v).toLowerCase(),
    money: (v) => String(v),
    mappingForMovement: () => null,
  });
  const list = movementsFilteredList();
  assert.equal(list.length, 1);
  assert.equal(list[0].movement, "AMAZON");
});

test("M-3 · la búsqueda también compara contra el importe, no solo contra el concepto (gap real de la auditoría)", () => {
  const { movementsFilteredList } = sandboxMovements(["movementsFilteredList"], {
    baseData: { transactions: TXNS },
    qs: fakeQs({ movementSearch: "45.2" }),
    normalizedText: (v) => String(v).toLowerCase(),
    money: (v) => String(v),
    mappingForMovement: () => null,
  });
  const list = movementsFilteredList();
  assert.equal(list.length, 1);
  assert.equal(list[0].movement, "MERCADONA");
});

test("M-3 · movementsChipCounts cuenta cada chip sobre el mismo rango+búsqueda, sin aplicar todavía el chip activo", () => {
  const { movementsChipCounts } = sandboxMovements(["movementsChipCounts"], {
    mappingForMovement: (row) => (row.movement === "MERCADONA" ? null : { row: {} }),
  });
  const counts = movementsChipCounts(TXNS);
  assert.equal(counts.todos, 3);
  assert.equal(counts.gastos, 2);
  assert.equal(counts.ingresos, 1);
  assert.equal(counts["sin-clasificar"], 1, "MERCADONA es el único gasto sin mapping en este fixture");
  assert.equal(counts.manual, 0, "ningún movimiento de origen Manual existe todavía en los datos");
  assert.equal(counts["duplicado-revisado"], 0);
});

test("M-3 · renderMovementChips pinta los seis botones con su recuento y marca el chip activo", () => {
  const container = { innerHTML: "" };
  const context = sandboxMovements(["renderMovementChips"], {
    qs: (id) => (id === "movementChips" ? container : null),
    escapeHtml: (v) => String(v),
    movementsChipFilter: "gastos",
  });
  context.renderMovementChips({ todos: 9, "sin-clasificar": 2, gastos: 6, ingresos: 1, manual: 1, "duplicado-revisado": 2 });
  assert.match(container.innerHTML, /Todos · 9/);
  assert.match(container.innerHTML, /Sin clasificar · 2/);
  assert.match(container.innerHTML, /Gastos · 6/);
  assert.match(container.innerHTML, /Ingresos · 1/);
  assert.match(container.innerHTML, /Manual · 1/);
  assert.match(container.innerHTML, /Duplicado revisado · 2/);
  assert.match(container.innerHTML, /data-movement-chip="gastos"[^>]*class="registrar-mes-filter is-active"|class="registrar-mes-filter is-active" data-movement-chip="gastos"/);
});

test("M-3 · los cuatro atajos de rango calculan meses de calendario completos hasta hoy, y «todo» vacía el rango", () => {
  const { movementsRangeShortcutBounds } = sandboxWith(["movementsRangeShortcutBounds"], {
    isoLocalDate: (d) => d.toISOString().slice(0, 10),
  });
  const today = new Date(2026, 7, 15); // 15 de agosto de 2026 (mes 7 = agosto, 0-indexado)
  const check = (kind, from, to) => {
    const bounds = movementsRangeShortcutBounds(kind, today);
    assert.equal(bounds.from, from, kind);
    assert.equal(bounds.to, to, kind);
  };
  check("mes", "2026-08-01", "2026-08-15");
  check("trimestre", "2026-06-01", "2026-08-15");
  check("anio", "2026-01-01", "2026-08-15");
  check("todo", "", "");
});

test("M-3 · handleMovementsRangeShortcut escribe el rango calculado en los campos Desde/Hasta y vuelve a pintar", () => {
  const fromInput = { value: "" };
  const toInput = { value: "" };
  const calls = [];
  const context = sandboxWith(["handleMovementsRangeShortcut"], {
    movementsRangeShortcutBounds: () => ({ from: "2026-08-01", to: "2026-08-15" }),
    qs: (id) => ({ movementDateFrom: fromInput, movementDateTo: toInput }[id] || null),
    renderDetailedMovements: () => calls.push("renderDetailedMovements"),
  });
  context.handleMovementsRangeShortcut("mes");
  assert.equal(fromInput.value, "2026-08-01");
  assert.equal(toInput.value, "2026-08-15");
  assert.deepEqual(calls, ["renderDetailedMovements"]);
});

test("M-3 · handleMovementsChipFilter solo acepta un chip real y vuelve a pintar", () => {
  const context = sandboxMovements(["handleMovementsChipFilter"], {
    renderDetailedMovements: () => { context.calls.push("renderDetailedMovements"); },
    calls: [],
  });
  context.handleMovementsChipFilter("no-existe");
  assert.equal(context.movementsChipFilter, "todos", "un id que no es un chip real no cambia el filtro activo");
  assert.deepEqual(context.calls, []);
  context.handleMovementsChipFilter("ingresos");
  assert.equal(context.movementsChipFilter, "ingresos");
  assert.deepEqual(context.calls, ["renderDetailedMovements"]);
});

test("M-3 · el enlace «Duplicado revisado» tiene dato real: datosImportarIncludedTransactions estampa duplicateReviewed cuando el paso 3 decide «distinto»", () => {
  const { datosImportarIncludedTransactions } = sandboxWith(["datosImportarIncludedTransactions"]);
  const rows = [
    { duplicateDecision: "duplicado", transaction: { movement: "A" } },
    { duplicateDecision: "distinto", transaction: { movement: "B" } },
    { duplicateDecision: null, transaction: { movement: "C" } },
  ];
  const included = datosImportarIncludedTransactions(rows);
  assert.deepEqual(included.map((t) => t.movement), ["B", "C"]);
  assert.equal(included[0].duplicateReviewed, true);
  assert.equal(included[1].duplicateReviewed, undefined, "un movimiento que nunca fue candidato a duplicado no lleva el campo");
});

// --- M-5 · aviso de cola sin clasificar ----------------------------------------------------------

test("M-5 · el aviso de cola sin clasificar cuenta sobre la vista filtrada, no sobre el extracto completo", () => {
  const fn = extractFunction("renderDetailedMovements");
  assert.match(fn, /const unclassified = filtered\.filter\(\(row\) => Number\(row\.amount\) && !mappingForMovement\(row\)\);/);
  assert.match(fn, /banner\.hidden = false;/);
  assert.match(fn, /banner\.hidden = true;/);
});

// --- M-6 · panel de detalle ------------------------------------------------------------------------

test("M-6 · abrir el detalle identifica la fila por su posición en la lista filtrada y abre el diálogo", () => {
  const dialog = { open: false, showModal() { this.open = true; } };
  const content = { innerHTML: "" };
  const context = sandboxWith(["handleMovementDetailOpen", "renderMovementDetailDialog"], {
    movementsFilteredList: () => [{ date: "2026-08-01", movement: "MERCADONA" }],
    qs: (id) => (id === "movementDetailDialog" ? dialog : id === "movementDetailContent" ? content : null),
    mappingForMovement: () => null,
    movementKindFromAmount: () => "expense",
    escapeHtml: (v) => String(v),
    formatIsoDate: (v) => v,
    money: (v) => String(v),
    movementDisplayName: (row) => row.movement,
    movementMappingOptions: () => "<option></option>",
  });
  context.handleMovementDetailOpen(0);
  assert.equal(context.movementDetailTransaction.movement, "MERCADONA");
  assert.equal(dialog.open, true);
  assert.match(content.innerHTML, /MERCADONA/);
});

test("M-6 · un índice fuera de rango no abre nada ni toca el estado", () => {
  const dialog = { open: false, showModal() { this.open = true; } };
  const context = sandboxWith(["handleMovementDetailOpen"], {
    movementsFilteredList: () => [],
    qs: () => dialog,
  });
  context.handleMovementDetailOpen(0);
  assert.equal(dialog.open, false);
  assert.equal(context.movementDetailTransaction, undefined);
});

test("M-6 · cerrar el detalle limpia el estado y cierra el diálogo", () => {
  const dialog = { open: true, close() { this.open = false; } };
  const context = sandboxWith(["closeMovementDetailDialog"], {
    qs: (id) => (id === "movementDetailDialog" ? dialog : null),
  });
  context.movementDetailTransaction = { movement: "X" };
  context.closeMovementDetailDialog();
  assert.equal(dialog.open, false);
  assert.equal(context.movementDetailTransaction, null);
});

// --- M-7 · cambio de partida con regla -------------------------------------------------------------

function sandboxReclassify(remember, extra = {}) {
  const calls = [];
  const movementMappings = {};
  const select = { value: "gasto-seguro-coche", options: [{}, { textContent: "Gastos fijos · Seguro coche" }], selectedIndex: 1 };
  const remembered = { checked: remember };
  const context = sandboxWith(["handleMovementReclassify"], {
    movementDetailTransaction: { date: "2026-08-01", movement: "MERCADONA", details: "COMPRA", amount: -45.2 },
    qs: (id) => (id === "movementDetailPartida" ? select : id === "movementDetailRemember" ? remembered : null),
    movementKindFromAmount: () => "expense",
    movementMappingKey: () => "expense|mercadona|compra",
    transactionIdentity: () => "2026-08-01|||mercadona compra|-45.2|",
    movementDisplayName: () => "MERCADONA · COMPRA",
    movementMappings,
    saveMovementMappings: () => calls.push("saveMovementMappings"),
    applyMovementMappingsToActuals: () => {
      calls.push("applyMovementMappingsToActuals");
      return 3;
    },
    buildPendingMovementMappings: () => [],
    datosImportarRefreshRowsForMappings: (keys) => calls.push(["datosImportarRefreshRowsForMappings", [...keys]]),
    saveIncomeActuals: () => calls.push("saveIncomeActuals"),
    saveExpenseActuals: () => calls.push("saveExpenseActuals"),
    refreshAllSectionsAfterDataChange: () => calls.push("refreshAllSectionsAfterDataChange"),
    announceStatus: (message) => calls.push(["announceStatus", message]),
    renderMovementDetailDialog: () => calls.push("renderMovementDetailDialog"),
    renderDetailedMovements: () => calls.push("renderDetailedMovements"),
    baseData: { transactions: [] },
    pendingMovementMappings: [],
    ...extra,
  });
  context.handleMovementReclassify();
  return { movementMappings, calls };
}

test("M-7 · sin marcar «recordar» (por defecto), la reclasificación se guarda solo para este movimiento, no como regla de concepto", () => {
  const { movementMappings, calls } = sandboxReclassify(false);
  assert.equal(movementMappings["expense|mercadona|compra"], undefined);
  const saved = movementMappings["2026-08-01|||mercadona compra|-45.2|"];
  assert.equal(saved.kind, "expense");
  assert.equal(saved.rowKey, "gasto-seguro-coche");
  assert.deepEqual(calls, [
    "saveMovementMappings",
    "applyMovementMappingsToActuals",
    "saveIncomeActuals",
    "saveExpenseActuals",
    "refreshAllSectionsAfterDataChange",
    ["announceStatus", "Partida guardada solo para este movimiento. 3 importe(s) reales recalculados desde movimientos."],
    "renderMovementDetailDialog",
    "renderDetailedMovements",
  ]);
});

test("M-7 · marcando «recordar», la reclasificación escribe en el diccionario de concepto y recalcula por el mismo camino que el importador", () => {
  const { movementMappings, calls } = sandboxReclassify(true);
  const saved = movementMappings["expense|mercadona|compra"];
  assert.equal(saved.kind, "expense");
  assert.equal(saved.rowKey, "gasto-seguro-coche");
  assert.equal(saved.label, "Gastos fijos · Seguro coche");
  assert.deepEqual(calls, [
    "saveMovementMappings",
    "applyMovementMappingsToActuals",
    ["datosImportarRefreshRowsForMappings", ["expense|mercadona|compra"]],
    "saveIncomeActuals",
    "saveExpenseActuals",
    "refreshAllSectionsAfterDataChange",
    ["announceStatus", "Regla guardada para «MERCADONA · COMPRA»: se aplicará también a movimientos futuros. 3 importe(s) reales recalculados desde movimientos."],
    "renderMovementDetailDialog",
    "renderDetailedMovements",
  ]);
});

test("M-7 · sin elegir partida, avisa y no escribe nada en el diccionario", () => {
  const calls = [];
  const movementMappings = {};
  const select = { value: "", options: [], selectedIndex: -1 };
  const context = sandboxWith(["handleMovementReclassify"], {
    movementDetailTransaction: { amount: -10 },
    qs: (id) => (id === "movementDetailPartida" ? select : null),
    movementMappings,
    saveMovementMappings: () => {
      throw new Error("no debería llamarse sin partida elegida");
    },
    announceStatus: (message) => calls.push(message),
  });
  context.handleMovementReclassify();
  assert.deepEqual(movementMappings, {});
  assert.deepEqual(calls, ["Elige una partida antes de guardar."]);
});

test("M-7 · la casilla «recordar» existe, desmarcada por defecto, y el aviso explica ambos casos", () => {
  assert.match(app, /<input type="checkbox" id="movementDetailRemember" \/>/);
  assert.match(app, /<span>Recordar para los que empiecen igual<\/span>/);
  assert.match(app, /Sin marcar, solo reclasifica este movimiento\. Marcada, se aplicará a todos los movimientos con el mismo concepto/);
});

test("M-7 · mappingForMovement mira primero la clave de un solo movimiento, y solo si no hay usa la regla de concepto", () => {
  const context = sandboxWith(["mappingForMovement"], {
    movementKindFromAmount: () => "expense",
    transactionIdentity: () => "single-key",
    movementMappingKey: () => "concept-key",
    planningRowBySeriesKey: (kind, rowKey) => ({ id: rowKey }),
    movementMappings: {
      "single-key": { kind: "expense", rowKey: "solo-este" },
      "concept-key": { kind: "expense", rowKey: "regla-concepto" },
    },
    exactMovementPlanningMatch: () => null,
  });
  const mapping = context.mappingForMovement({ amount: -10 });
  assert.equal(mapping.source, "single");
  assert.equal(mapping.row.id, "solo-este");
});

// --- M-9 · totales de la vista filtrada -----------------------------------------------------------

test("M-9 · movementsTotals separa ingresos y gastos de la lista recibida", () => {
  const { movementsTotals } = sandboxWith(["movementsTotals"]);
  const totals = movementsTotals([{ amount: 100 }, { amount: -40 }, { amount: -10 }]);
  assert.equal(totals.income, 100);
  assert.equal(totals.expense, -50);
});

// --- M-10 · exportar la vista ------------------------------------------------------------------

test("M-10 · el botón de exportar está cableado a handleMovementsExport", () => {
  assert.match(html, /<button type="button" class="e19-btn e19-btn-secondary" id="movementsExportButton">Exportar CSV de esta vista<\/button>/);
  assert.match(app, /qs\("movementsExportButton"\)\?\.addEventListener\("click", handleMovementsExport\);/);
});

test("M-10 · exporta exactamente movementsFilteredList (la vista filtrada), no el extracto completo", () => {
  let capturedParts = [];
  const linkEl = { style: {}, click() {}, remove() {} };
  const context = sandboxWith(["handleMovementsExport"], {
    movementsFilteredList: () => [
      { date: "2026-08-01", valueDate: "2026-08-01", movement: "MERCADONA", details: "COMPRA", category: "Alimentación", amount: -45.2, balance: 1000, source: "extracto" },
    ],
    mappingForMovement: () => ({ row: { sectionName: "Gastos fijos" } }),
    displayLabelForRow: () => "Seguro coche",
    csvValue: (v) => `"${v}"`,
    Blob: function Blob(parts) {
      capturedParts = parts;
    },
    URL: { createObjectURL: () => "blob:x", revokeObjectURL: () => {} },
    document: { createElement: () => linkEl, body: { appendChild: () => {} } },
  });
  context.handleMovementsExport();
  const content = capturedParts.join("");
  assert.match(content, /"MERCADONA"/);
  assert.match(content, /"Gastos fijos · Seguro coche"/);
  assert.match(content, /"Partida"/);
});

test("M-10 · el CSV exportado incluye la columna Cuenta, vacía cuando el movimiento no la tiene", () => {
  let capturedParts = [];
  const linkEl = { style: {}, click() {}, remove() {} };
  const context = sandboxWith(["handleMovementsExport"], {
    movementsFilteredList: () => [
      { date: "2026-08-01", valueDate: "2026-08-01", movement: "MERCADONA", details: "COMPRA", category: "Alimentación", amount: -45.2, balance: 1000, source: "extracto", account: "CaixaBank" },
      { date: "2026-07-20", valueDate: "2026-07-20", movement: "AMAZON", details: "PEDIDO", category: "Compras", amount: -60, balance: 900, source: "extracto" },
    ],
    mappingForMovement: () => null,
    displayLabelForRow: () => "",
    csvValue: (v) => `"${v}"`,
    Blob: function Blob(parts) {
      capturedParts = parts;
    },
    URL: { createObjectURL: () => "blob:x", revokeObjectURL: () => {} },
    document: { createElement: () => linkEl, body: { appendChild: () => {} } },
  });
  context.handleMovementsExport();
  const content = capturedParts.join("");
  assert.match(content, /"Cuenta"/);
  assert.match(content, /"CaixaBank"/);
});

// --- Cableado --------------------------------------------------------------------------------------

test("Cableado · el clic en «Ver» de una fila abre el detalle, delegado sobre movementRows", () => {
  assert.match(
    app,
    /qs\("movementRows"\)\?\.addEventListener\("click", \(event\) => \{[\s\S]{0,200}handleMovementDetailOpen\(button\.dataset\.movementDetailIndex\);/,
  );
});

test("Cableado · el diálogo de detalle cierra al clicar fuera y guarda al clicar «Guardar partida»", () => {
  assert.match(app, /qs\("movementDetailDialog"\)\?\.addEventListener\("click", \(event\) => \{[\s\S]{0,200}handleMovementReclassify\(\);/);
});

test("Cableado · Desde/Hasta vuelven a pintar la tabla al cambiar, igual que Buscar", () => {
  assert.match(app, /qs\("movementDateFrom"\)\?\.addEventListener\("change", renderDetailedMovements\);/);
  assert.match(app, /qs\("movementDateTo"\)\?\.addEventListener\("change", renderDetailedMovements\);/);
});
