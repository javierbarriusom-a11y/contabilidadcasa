const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

// Movimientos (03 · backlog «Nueve pantallas»), M-1 a M-11 salvo M-8/M-8b/M-8c (selección
// múltiple y acción en lote, y el cuadre contra Cierre — Cierre todavía no existe, y el lote
// merece su propia sesión igual que R-8/R-9 la tuvieron en Registrar). `#movements` se evoluciona
// en el mismo sitio (no se construye una pantalla nueva al lado): el enlace de menú ya apuntaba
// aquí desde Fase 3, así que no hay una heredada que adoptar o sustituir, solo contenido que
// completar. La tarjeta de importación por Excel y la lista de comercios de arriba no se tocan.

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

test("M-11 · ninguna fila de la tabla trae un input editable: los importes no se editan en Movimientos", () => {
  const fn = extractFunction("renderDetailedMovements");
  assert.doesNotMatch(fn, /<input/);
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

// --- M-3 · filtros, búsqueda y rango de fechas -------------------------------------------------

test("M-3 · el filtro trae rango de fechas (Desde/Hasta) además del mes y la búsqueda ya existentes", () => {
  assert.match(html, /<input id="movementDateFrom" type="date" \/>/);
  assert.match(html, /<input id="movementDateTo" type="date" \/>/);
});

test("M-3 · movementsFilteredList filtra por mes", () => {
  const { movementsFilteredList } = sandboxWith(["movementsFilteredList"], {
    baseData: { transactions: TXNS },
    qs: fakeQs({ movementMonthFilter: "2026-08" }),
    normalizedText: (v) => String(v).toLowerCase(),
  });
  const list = movementsFilteredList();
  assert.equal(list.length, 2);
  assert.ok(list.every((row) => row.month === "2026-08"));
});

test("M-3 · movementsFilteredList filtra por rango de fechas, con o sin filtro de mes", () => {
  const { movementsFilteredList } = sandboxWith(["movementsFilteredList"], {
    baseData: { transactions: TXNS },
    qs: fakeQs({ movementDateFrom: "2026-08-01", movementDateTo: "2026-08-01" }),
    normalizedText: (v) => String(v).toLowerCase(),
  });
  const list = movementsFilteredList();
  assert.equal(list.length, 1);
  assert.equal(list[0].movement, "MERCADONA");
});

test("M-3 · movementsFilteredList sigue filtrando por búsqueda de texto", () => {
  const { movementsFilteredList } = sandboxWith(["movementsFilteredList"], {
    baseData: { transactions: TXNS },
    qs: fakeQs({ movementSearch: "amazon" }),
    normalizedText: (v) => String(v).toLowerCase(),
  });
  const list = movementsFilteredList();
  assert.equal(list.length, 1);
  assert.equal(list[0].movement, "AMAZON");
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

test("M-7 · reclasificar escribe en el mismo diccionario movementMappings y recalcula por el mismo camino que el importador", () => {
  const calls = [];
  const movementMappings = {};
  const select = { value: "gasto-seguro-coche", options: [{}, { textContent: "Gastos fijos · Seguro coche" }], selectedIndex: 1 };
  const context = sandboxWith(["handleMovementReclassify"], {
    movementDetailTransaction: { date: "2026-08-01", movement: "MERCADONA", details: "COMPRA", amount: -45.2 },
    qs: (id) => (id === "movementDetailPartida" ? select : null),
    movementKindFromAmount: () => "expense",
    movementMappingKey: () => "expense|mercadona|compra",
    movementMappings,
    saveMovementMappings: () => calls.push("saveMovementMappings"),
    applyMovementMappingsToActuals: () => {
      calls.push("applyMovementMappingsToActuals");
      return 3;
    },
    buildPendingMovementMappings: () => [],
    saveIncomeActuals: () => calls.push("saveIncomeActuals"),
    saveExpenseActuals: () => calls.push("saveExpenseActuals"),
    refreshAllSectionsAfterDataChange: () => calls.push("refreshAllSectionsAfterDataChange"),
    announceStatus: (message) => calls.push(["announceStatus", message]),
    renderMovementDetailDialog: () => calls.push("renderMovementDetailDialog"),
    renderDetailedMovements: () => calls.push("renderDetailedMovements"),
    baseData: { transactions: [] },
    pendingMovementMappings: [],
  });
  context.handleMovementReclassify();
  const saved = movementMappings["expense|mercadona|compra"];
  assert.equal(saved.kind, "expense");
  assert.equal(saved.rowKey, "gasto-seguro-coche");
  assert.equal(saved.label, "Gastos fijos · Seguro coche");
  assert.deepEqual(calls, [
    "saveMovementMappings",
    "applyMovementMappingsToActuals",
    "saveIncomeActuals",
    "saveExpenseActuals",
    "refreshAllSectionsAfterDataChange",
    ["announceStatus", "Partida guardada. 3 importe(s) reales recalculados desde movimientos."],
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

test("M-7 · la nota del panel deja explícito que la regla vale para todos los movimientos iguales, no solo este", () => {
  const fn = extractFunction("renderMovementDetailDialog");
  assert.match(fn, /Se aplicará a todos los movimientos con el mismo concepto/);
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

test("Cableado · Desde/Hasta vuelven a pintar la tabla al cambiar, igual que Mes y Buscar", () => {
  assert.match(app, /qs\("movementDateFrom"\)\?\.addEventListener\("change", renderDetailedMovements\);/);
  assert.match(app, /qs\("movementDateTo"\)\?\.addEventListener\("change", renderDetailedMovements\);/);
});
