const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app =
  fs.readFileSync(path.join(root, "app.js"), "utf8") +
  "\n" +
  fs.readFileSync(path.join(root, "views/analisis.js"), "utf8");

// P-1 del "plan de mejora corregido" (auditado el 28 de agosto de 2026): eje de tipo de acción
// (`actionType`) a nivel de movimiento, aditivo sobre `kind` (income/expense) y sobre la partida
// (bloque fijo/variable/financiación). No es el mismo "P-1" del backlog de Plan · Mes
// (tests/p1-p7-plan-mes.test.cjs) — coincide el identificador, no el alcance.
// Reutiliza `mappingForMovement`/`movementMappingKey`/`transactionIdentity` (M-4/M-7), no una
// segunda clasificación. Sin partida asignada no hay sugerencia (regla transversal 04: hueco, no
// invención). El "¿es recurrente?" viaja en el mismo diccionario, confirmable por el usuario en vez
// de la inferencia muda de A-9.

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

// Balanceada por corchetes (respetando cadenas) — igual que en tests/m1-m11-movimientos.test.cjs:
// ACTION_TYPES es un array literal, no una función.
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

function sandboxActionType(names, extra = {}) {
  const context = { ...extra };
  vm.createContext(context);
  vm.runInContext(extractConst("ACTION_TYPES"), context);
  vm.runInContext(extractConst("ACTION_TYPE_LABELS"), context);
  vm.runInContext(extractConst("ACTION_TYPE_SECTION_SUGGESTION"), context);
  names.forEach((name) => vm.runInContext(extractFunction(name), context));
  return context;
}

// --- catálogo ----------------------------------------------------------------------------------

test("P-1 · el catálogo trae los siete valores del plan corregido, ni uno más ni uno menos", () => {
  const source = extractConst("ACTION_TYPES");
  const ids = [...source.matchAll(/id: "([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(ids, [
    "gasto_fijo",
    "gasto_variable",
    "ingreso",
    "transferencia_interna",
    "pago_deuda",
    "aportacion_ahorro",
    "ajuste",
  ]);
});

// --- suggestedActionTypeForMovement / actionTypeForMovement ------------------------------------

test("P-1 · sin partida asignada, no hay sugerencia (hueco, no invención)", () => {
  const context = sandboxActionType(["suggestedActionTypeForMovement", "actionTypeEntryForMovement", "actionTypeForMovement"], {
    mappingForMovement: () => null,
    movementActionTypes: {},
    transactionIdentity: () => "single",
    movementMappingKey: () => "concept",
  });
  assert.equal(context.suggestedActionTypeForMovement({}), null);
  assert.equal(context.actionTypeForMovement({}), null);
});

test("P-1 · la sugerencia sale del mismo bloque de partida que usan Plan/Análisis (sectionName), no de una taxonomía aparte", () => {
  const context = sandboxActionType(["suggestedActionTypeForMovement", "actionTypeEntryForMovement", "actionTypeForMovement"], {
    mappingForMovement: () => ({ row: { sectionName: "Financiaciones" } }),
    movementActionTypes: {},
    transactionIdentity: () => "single",
    movementMappingKey: () => "concept",
  });
  assert.equal(context.suggestedActionTypeForMovement({}), "pago_deuda");
  const entry = context.actionTypeForMovement({});
  assert.deepEqual({ ...entry }, { actionType: "pago_deuda", recurring: null, confirmed: false, source: "suggested" });
});

test("P-1 · una entrada confirmada (guardada) gana siempre a la sugerencia derivada de la partida", () => {
  const context = sandboxActionType(["suggestedActionTypeForMovement", "actionTypeForMovement", "actionTypeEntryForMovement"], {
    mappingForMovement: () => ({ row: { sectionName: "Gastos variables" } }),
    movementActionTypes: { concept: { actionType: "gasto_fijo", recurring: true, updatedAt: "x" } },
    transactionIdentity: () => "single-sin-entrada",
    movementMappingKey: () => "concept",
  });
  const entry = context.actionTypeForMovement({});
  assert.equal(entry.actionType, "gasto_fijo");
  assert.equal(entry.recurring, true);
  assert.equal(entry.confirmed, true);
  assert.equal(entry.source, "dictionary");
});

test("P-1 · misma dualidad que M-7: la clave de un solo movimiento gana a la regla de concepto", () => {
  const context = sandboxActionType(["actionTypeEntryForMovement"], {
    movementActionTypes: {
      "single-key": { actionType: "ajuste", recurring: false },
      "concept-key": { actionType: "gasto_fijo", recurring: true },
    },
    transactionIdentity: () => "single-key",
    movementMappingKey: () => "concept-key",
  });
  const entry = context.actionTypeEntryForMovement({});
  assert.equal(entry.actionType, "ajuste");
  assert.equal(entry.source, "single");
});

// --- movementActionTypeBadge --------------------------------------------------------------------

const ACTION_TYPE_BADGE_DEPS = [
  "movementActionTypeBadge",
  "actionTypeForMovement",
  "actionTypeEntryForMovement",
  "suggestedActionTypeForMovement",
];

test("P-1 · sin sugerencia ni confirmación, el badge avisa del hueco en vez de fabricar un tipo", () => {
  const context = sandboxActionType(ACTION_TYPE_BADGE_DEPS, {
    mappingForMovement: () => null,
    movementActionTypes: {},
    transactionIdentity: () => "x",
    movementMappingKey: () => "y",
    escapeHtml: (v) => String(v),
  });
  assert.equal(context.movementActionTypeBadge({}), `<span class="e19-badge e19-badge-warning">Sin tipo</span>`);
});

test("P-1 · una sugerencia sin confirmar se pinta con tono distinto y la etiqueta «(sugerido)»", () => {
  const context = sandboxActionType(ACTION_TYPE_BADGE_DEPS, {
    mappingForMovement: () => ({ row: { sectionName: "Ingresos" } }),
    movementActionTypes: {},
    transactionIdentity: () => "x",
    movementMappingKey: () => "y",
    escapeHtml: (v) => String(v),
  });
  assert.equal(context.movementActionTypeBadge({}), `<span class="e19-badge e19-badge-accent">Ingreso (sugerido)</span>`);
});

test("P-1 · una entrada confirmada y recurrente se pinta en tono neutral con el sufijo «recurrente»", () => {
  const context = sandboxActionType(
    ["movementActionTypeBadge", "actionTypeForMovement", "actionTypeEntryForMovement", "suggestedActionTypeForMovement"],
    {
      mappingForMovement: () => null,
      movementActionTypes: { y: { actionType: "gasto_fijo", recurring: true } },
      transactionIdentity: () => "x",
      movementMappingKey: () => "y",
      escapeHtml: (v) => String(v),
    },
  );
  assert.equal(context.movementActionTypeBadge({}), `<span class="e19-badge e19-badge-neutral">Gasto fijo · recurrente</span>`);
});

// --- movementActionTypeOptions -------------------------------------------------------------------

test("P-1 · movementActionTypeOptions ofrece el hueco explícito y marca el seleccionado", () => {
  const context = sandboxActionType(["movementActionTypeOptions"], { escapeHtml: (v) => String(v) });
  const optionsHtml = context.movementActionTypeOptions("pago_deuda");
  assert.match(optionsHtml, /<option value="">Sin asignar todavía<\/option>/);
  assert.match(optionsHtml, /<option value="pago_deuda" selected>Pago de deuda<\/option>/);
  assert.match(optionsHtml, /<option value="ajuste" >Ajuste<\/option>/);
});

// --- handleMovementActionTypeSave ----------------------------------------------------------------

function sandboxSaveActionType(remember, extra = {}) {
  const calls = [];
  const movementActionTypes = {};
  const actionTypeSelect = { value: "pago_deuda" };
  const recurringSelect = { value: "true" };
  const remembered = { checked: remember };
  const context = sandboxWith(["handleMovementActionTypeSave"], {
    movementDetailTransaction: { date: "2026-08-01", movement: "BANKINTER", details: "CUOTA", amount: -300 },
    qs: (id) =>
      ({
        movementDetailActionType: actionTypeSelect,
        movementDetailRecurring: recurringSelect,
        movementDetailActionTypeRemember: remembered,
      }[id] || null),
    movementKindFromAmount: () => "expense",
    movementMappingKey: () => "expense|bankinter|cuota",
    transactionIdentity: () => "2026-08-01|||bankinter cuota|-300|",
    movementDisplayName: () => "BANKINTER · CUOTA",
    movementActionTypes,
    saveMovementActionTypes: () => calls.push("saveMovementActionTypes"),
    announceStatus: (message) => calls.push(["announceStatus", message]),
    renderMovementDetailDialog: () => calls.push("renderMovementDetailDialog"),
    renderDetailedMovements: () => calls.push("renderDetailedMovements"),
    ...extra,
  });
  context.handleMovementActionTypeSave();
  return { movementActionTypes, calls };
}

test("P-1 · sin marcar «recordar», el tipo de acción se guarda solo para este movimiento", () => {
  const { movementActionTypes, calls } = sandboxSaveActionType(false);
  assert.equal(movementActionTypes["expense|bankinter|cuota"], undefined);
  const saved = movementActionTypes["2026-08-01|||bankinter cuota|-300|"];
  assert.equal(saved.actionType, "pago_deuda");
  assert.equal(saved.recurring, true);
  assert.deepEqual(calls, [
    "saveMovementActionTypes",
    ["announceStatus", "Tipo de acción guardado solo para este movimiento."],
    "renderMovementDetailDialog",
    "renderDetailedMovements",
  ]);
});

test("P-1 · marcando «recordar», el tipo de acción se guarda como regla de concepto", () => {
  const { movementActionTypes, calls } = sandboxSaveActionType(true);
  const saved = movementActionTypes["expense|bankinter|cuota"];
  assert.equal(saved.actionType, "pago_deuda");
  assert.equal(saved.recurring, true);
  assert.deepEqual(calls, [
    "saveMovementActionTypes",
    ["announceStatus", "Tipo de acción guardado como regla para «BANKINTER · CUOTA»: se aplicará también a movimientos futuros."],
    "renderMovementDetailDialog",
    "renderDetailedMovements",
  ]);
});

test("P-1 · sin elegir tipo de acción, avisa y no escribe nada en el diccionario", () => {
  const calls = [];
  const movementActionTypes = {};
  const context = sandboxWith(["handleMovementActionTypeSave"], {
    movementDetailTransaction: { amount: -10 },
    qs: (id) => (id === "movementDetailActionType" ? { value: "" } : null),
    movementActionTypes,
    saveMovementActionTypes: () => {
      throw new Error("no debería llamarse sin tipo de acción elegido");
    },
    announceStatus: (message) => calls.push(message),
  });
  context.handleMovementActionTypeSave();
  assert.deepEqual(movementActionTypes, {});
  assert.deepEqual(calls, ["Elige un tipo de acción antes de guardar."]);
});

test("P-1 · «¿es recurrente?» sin marcar se guarda como null, no como false fabricado", () => {
  const { movementActionTypes } = sandboxSaveActionType(false, {
    qs: (id) =>
      ({
        movementDetailActionType: { value: "ajuste" },
        movementDetailRecurring: { value: "" },
        movementDetailActionTypeRemember: { checked: false },
      }[id] || null),
  });
  const saved = movementActionTypes["2026-08-01|||bankinter cuota|-300|"];
  assert.equal(saved.actionType, "ajuste");
  assert.equal(saved.recurring, null);
});

// --- filtro en movementsRangeAndSearchList --------------------------------------------------------

function sandboxRangeAndSearch(extra = {}) {
  return sandboxWith(["movementsRangeAndSearchList"], {
    baseData: {
      transactions: [
        { date: "2026-08-01", movement: "BANKINTER", details: "CUOTA", amount: -300 },
        { date: "2026-08-05", movement: "MERCADONA", details: "COMPRA", amount: -45.2 },
        { date: "2026-08-06", movement: "NOMINA", details: "", amount: 1800 },
      ],
    },
    normalizedText: (v) => String(v || "").toLowerCase(),
    money: (v) => String(v),
    actionTypeForMovement: (row) => (row.movement === "BANKINTER" ? { actionType: "pago_deuda", confirmed: true } : null),
    qs: () => null,
    ...extra,
  });
}

test("P-1 · el filtro «Tipo de acción» de Movimientos deja pasar solo el tipo elegido", () => {
  const context = sandboxRangeAndSearch({
    qs: (id) => (id === "movementActionTypeFilter" ? { value: "pago_deuda" } : null),
  });
  const rows = context.movementsRangeAndSearchList();
  assert.deepEqual(rows.map((row) => row.movement), ["BANKINTER"]);
});

test("P-1 · el filtro «Sin tipo» deja pasar solo los movimientos sin actionTypeForMovement", () => {
  const context = sandboxRangeAndSearch({
    qs: (id) => (id === "movementActionTypeFilter" ? { value: "sin-tipo" } : null),
  });
  const rows = context.movementsRangeAndSearchList();
  assert.deepEqual(rows.map((row) => row.movement).sort(), ["MERCADONA", "NOMINA"]);
});

test("P-1 · sin filtro de tipo de acción elegido («Todos»), pasan todos los movimientos", () => {
  const context = sandboxRangeAndSearch();
  const rows = context.movementsRangeAndSearchList();
  assert.equal(rows.length, 3);
});

// --- desglose en Análisis (views/analisis.js) -----------------------------------------------------

test("P-1 · analisisActionTypeRows solo cuenta gastos del periodo, agrupados por tipo de acción confirmado o sugerido", () => {
  const context = sandboxActionType(["analisisActionTypeRows"], {
    round2: (v) => Math.round((Number(v || 0) + Number.EPSILON) * 100) / 100,
    actionTypeForMovement: (row) => {
      if (row.movement === "BANKINTER") return { actionType: "pago_deuda", confirmed: true };
      if (row.movement === "MERCADONA") return { actionType: "gasto_variable", confirmed: false };
      return null;
    },
  });
  const transactions = [
    { date: "2026-08-01", movement: "BANKINTER", amount: -300 },
    { date: "2026-08-05", movement: "MERCADONA", amount: -45.2 },
    { date: "2026-08-06", movement: "NOMINA", amount: 1800 }, // ingreso: no cuenta
    { date: "2026-07-20", movement: "AMAZON", amount: -60 }, // fuera del periodo: no cuenta
    { date: "2026-08-10", movement: "SIN-TIPO", amount: -20 },
  ];
  const breakdown = context.analisisActionTypeRows(transactions, [{ key: "2026-08" }]);
  assert.deepEqual(
    Array.from(breakdown.rows, (row) => [row.id, row.value]),
    [
      ["pago_deuda", 300],
      ["gasto_variable", 45.2],
    ],
  );
  assert.equal(breakdown.unclassified, 20);
});

test("P-1 · analisisActionTypeHtml declara el hueco cuando no hay ningún gasto en el periodo", () => {
  const context = sandboxActionType(["analisisActionTypeHtml"], { escapeHtml: (v) => String(v), money: (v) => String(v) });
  const htmlOut = context.analisisActionTypeHtml({ rows: [], unclassified: 0 });
  assert.match(htmlOut, /Sin gastos con tipo de acción en este periodo\./);
});

// --- cableado en index.html y app.js ---------------------------------------------------------------

test("P-1 · Movimientos trae el filtro «Tipo de acción» con los siete valores más «Sin tipo»", () => {
  assert.match(html, /<select id="movementActionTypeFilter">/);
  assert.match(html, /<option value="pago_deuda">Pago de deuda<\/option>/);
  assert.match(html, /<option value="sin-tipo">Sin tipo<\/option>/);
});

test("P-1 · la tabla de Movimientos trae la columna «Tipo de acción», sin romper la adyacencia Categoría→Partida→Importe ni Origen→Cuenta", () => {
  assert.match(html, /<th>Saldo<\/th>\s*<th>Tipo de acción<\/th>\s*<th>Origen<\/th>/);
  assert.match(html, /<th>Categoría<\/th>\s*<th>Partida<\/th>\s*<th>Importe<\/th>/);
  assert.match(html, /<th>Origen<\/th>\s*<th>Cuenta<\/th>\s*<th><\/th>/);
});

test("P-1 · Análisis trae la tarjeta «Por tipo de acción»", () => {
  assert.match(html, /<div class="analisis-recurring-list" id="analisisActionTypeBreakdown"><\/div>/);
});

test("Cableado · el filtro «Tipo de acción» vuelve a pintar la tabla al cambiar", () => {
  assert.match(app, /qs\("movementActionTypeFilter"\)\?\.addEventListener\("change", renderDetailedMovements\);/);
});

test("Cableado · el botón «Guardar tipo de acción» del diálogo de detalle llama a handleMovementActionTypeSave", () => {
  assert.match(
    app,
    /else if \(event\.target\.id === "movementDetailActionTypeSave"\) handleMovementActionTypeSave\(\);/,
  );
});

test("Cableado · appStatePayload y applyPersistedPayload incluyen movementActionTypes, con su función propia de guardado", () => {
  assert.match(app, /movementMappings,\s*\n\s*movementActionTypes,\s*\n\s*debtContractOverrides,/);
  assert.match(
    app,
    /movementActionTypes =\s*\n?\s*payload\.movementActionTypes && typeof payload\.movementActionTypes === "object" \? payload\.movementActionTypes : \{\};/,
  );
  assert.match(
    app,
    /function saveMovementActionTypes\(\) \{\s*\n\s*storageSet\(storageKey\("movementActionTypes"\), JSON\.stringify\(movementActionTypes\)\);\s*\n\s*queueRemoteSave\(\);\s*\n\}/,
  );
});
