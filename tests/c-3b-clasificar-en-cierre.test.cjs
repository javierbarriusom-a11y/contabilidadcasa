const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const app = read("app.js");
const html = read("index.html");

// C-3b (Cierre.pdf, mockup 4f-cierre-tareas): las tareas de causa "Clasificación" ganan las mismas
// dos salidas del mockup — Clasificar (partida existente) o Crear partida (una nueva) — sin salir
// de Cierre, en vez de solo navegar a Movimientos como seguían haciendo el resto de causas (C-4).
// El bloqueo que dejaba esto pendiente desde el 16 de agosto era que las entradas del ledger solo
// exponían `description` (movimiento y detalle ya concatenados) — canonical-ledger.js ahora
// conserva `movement`/`details` sueltos (ver tests/canonical-ledger.test.cjs), así que estas
// pruebas cubren solo el lado de app.js: la extracción del id de la entrada, el modal con sus dos
// modos, y las dos escrituras (clasificar / crear partida y clasificar).

function extractFunction(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `No existe la función ${name} en app.js`);
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

const baseHelpers = {
  escapeHtml: (v) => String(v ?? ""),
  money: (v) => `${v}€`,
  formatIsoDate: (v) => v,
};

// --- cierreTaskEntryId: recorta el prefijo "classify-" solo para la causa "unclassified" --------

test("C-3b · cierreTaskEntryId recupera el id de la entrada de una tarea de clasificación", () => {
  const context = sandboxWith(["cierreTaskEntryId"]);
  assert.equal(context.cierreTaskEntryId({ cause: "unclassified", id: "classify-tx-abc123-1" }), "tx-abc123-1");
});

test("C-3b · cierreTaskEntryId devuelve null para otras causas (siguen navegando, C-4 intacto)", () => {
  const context = sandboxWith(["cierreTaskEntryId"]);
  assert.equal(context.cierreTaskEntryId({ cause: "balance-gap", id: "balance-caixabank-0" }), null);
  assert.equal(context.cierreTaskEntryId({ cause: "bank-actual-difference", id: "actual-0" }), null);
});

// --- cierreTaskItemHtml: dos botones para clasificación, el botón de navegar para el resto ------

test("C-3b · una tarea de clasificación pinta Clasificar y Crear partida con el id de la entrada", () => {
  const context = sandboxWith(["cierreTaskItemHtml", "cierreTaskEntryId", "cierreTaskActionLabel"], baseHelpers);
  const out = context.cierreTaskItemHtml({ cause: "unclassified", id: "classify-tx-abc-1", action: "classify", label: "Clasificar Amazon", target: "movements" });
  assert.match(out, /data-cierre-task-classify="tx-abc-1">Clasificar</);
  assert.match(out, /data-cierre-task-create-partida="tx-abc-1">Crear partida</);
  assert.doesNotMatch(out, /data-cierre-task-target/);
});

test("C-3b · una tarea de otra causa conserva el único botón de navegar (C-4 intacto)", () => {
  const context = sandboxWith(["cierreTaskItemHtml", "cierreTaskEntryId", "cierreTaskActionLabel"], baseHelpers);
  const out = context.cierreTaskItemHtml({ cause: "balance-gap", id: "balance-caixabank-0", action: "adjust-balance", label: "Revisar saldo", target: "update-hub" });
  assert.match(out, /data-cierre-task-target="update-hub">Revisar saldo</);
  assert.doesNotMatch(out, /data-cierre-task-classify/);
  assert.doesNotMatch(out, /data-cierre-task-create-partida/);
});

// --- cierreEntryAsTransaction: forma mínima que necesitan movementMappingKey/mappingForMovement -

test("C-3b · cierreEntryAsTransaction usa signedAmount, no el importe sin signo", () => {
  // JSON.stringify en vez de deepEqual: el objeto lo crea código compilado dentro del sandbox vm,
  // en un realm distinto de este test — deepEqual falla comparando por referencia entre realms.
  const context = sandboxWith(["cierreEntryAsTransaction"]);
  const out = context.cierreEntryAsTransaction({ movement: "Amazon", details: "Cargo", amount: 62.3, signedAmount: -62.3 });
  assert.equal(JSON.stringify(out), JSON.stringify({ movement: "Amazon", details: "Cargo", amount: -62.3 }));
});

// --- cierreClassifyModalHtml: dos modos, cada uno con su salida hacia el otro -------------------

function sampleEntry(overrides = {}) {
  return {
    id: "tx-abc-1",
    description: "Amazon · Cargo tarjeta",
    movement: "Amazon",
    details: "Cargo tarjeta",
    date: "2026-08-14",
    monthKey: "2026-08",
    kind: "expense",
    amount: 62.3,
    signedAmount: -62.3,
    ...overrides,
  };
}

test("C-3b · modo «existing» muestra el desplegable de partidas con la sugerencia preseleccionada", () => {
  const context = sandboxWith(["cierreClassifyModalHtml", "cierreEntryAsTransaction", "cierreClassifyNewSectionOptions"], {
    ...baseHelpers,
    mappingForMovement: () => ({ row: { kind: "expense", id: "light" } }),
    seriesKeyForRow: (row) => `${row.kind}|${row.id}`,
    movementMappingOptions: (kind, selected) => `<option value="${selected}" data-kind="${kind}">elegido</option>`,
    baseData: { monthlyPlanning: { sections: [] } },
  });
  const out = context.cierreClassifyModalHtml(sampleEntry(), "existing");
  assert.match(out, /id="cierreClassifyTitle">Amazon · Cargo tarjeta</);
  assert.match(out, /<select id="cierreClassifyPartida"><option value="expense\|light"/);
  assert.match(out, /id="cierreClassifySave">Clasificar</);
  assert.match(out, /id="cierreClassifySwitchToNew"/);
  // La sección "nueva partida" sigue en el DOM, oculta, para alternar sin volver a pedir el modal.
  assert.match(out, /class="cierre-classify-hidden" hidden/);
  assert.match(out, /id="cierreClassifyCreate"/);
});

test("C-3b · modo «new» muestra el formulario mínimo y la salida de vuelta a «existing»", () => {
  const context = sandboxWith(["cierreClassifyModalHtml", "cierreEntryAsTransaction", "cierreClassifyNewSectionOptions"], {
    ...baseHelpers,
    mappingForMovement: () => ({ row: null }),
    seriesKeyForRow: (row) => `${row.kind}|${row.id}`,
    movementMappingOptions: () => `<option value="">Sin asignar todavía</option>`,
    baseData: { monthlyPlanning: { sections: [{ kind: "expense", name: "Gastos variables" }, { kind: "income", name: "Ingresos" }] } },
  });
  const out = context.cierreClassifyModalHtml(sampleEntry(), "new");
  assert.match(out, /id="cierreClassifyNewLabel"/);
  assert.match(out, /<option value="Gastos variables">Gastos variables<\/option>/);
  assert.doesNotMatch(out, /<option value="Ingresos">/);
  assert.match(out, /id="cierreClassifyCreate">Crear partida y clasificar</);
  assert.match(out, /id="cierreClassifySwitchToExisting"/);
});

// --- handleCierreTaskClassifyConfirm: escribe en movementMappings igual que Movimientos ---------

function sandboxClassifyConfirm(entry, selectValue) {
  const saved = {};
  const calls = [];
  let dialogClosed = false;
  let announced = null;
  const context = sandboxWith(
    ["handleCierreTaskClassifyConfirm", "cierreLedgerEntryById", "cierreEntryAsTransaction", "cierreClassifyApply"],
    {
      cierreClassifyEntryId: entry ? entry.id : null,
      canonicalLedgerSnapshot: { entries: entry ? [entry] : [] },
      movementMappings: {},
      movementMappingKey: (t) => `${t.amount >= 0 ? "income" : "expense"}|${t.movement}|${t.details}`,
      saveMovementMappings: () => calls.push("saveMovementMappings"),
      applyMovementMappingsToActuals: () => calls.push("applyMovementMappingsToActuals"),
      pendingMovementMappings: [],
      buildPendingMovementMappings: () => [],
      baseData: { transactions: [] },
      datosImportarRefreshRowsForMappings: () => calls.push("datosImportarRefreshRowsForMappings"),
      saveIncomeActuals: () => calls.push("saveIncomeActuals"),
      saveExpenseActuals: () => calls.push("saveExpenseActuals"),
      refreshAllSectionsAfterDataChange: () => calls.push("refreshAllSectionsAfterDataChange"),
      announceStatus: (msg) => { announced = msg; },
      qs: (id) =>
        id === "cierreClassifyPartida"
          ? { value: selectValue, options: [{ textContent: "Gastos variables · Suscripción" }], selectedIndex: 0 }
          : id === "cierreClassifyDialog"
            ? { close: () => { dialogClosed = true; } }
            : null,
    },
  );
  context.movementMappingsWritten = () => context.movementMappings;
  return { context, calls, isClosed: () => dialogClosed, getAnnounced: () => announced };
}

test("C-3b · Clasificar escribe la partida elegida en movementMappings y refresca todo", () => {
  const entry = sampleEntry();
  const { context, calls, isClosed, getAnnounced } = sandboxClassifyConfirm(entry, "expense|light");
  context.handleCierreTaskClassifyConfirm();
  const key = "expense|Amazon|Cargo tarjeta";
  assert.equal(context.movementMappings[key].rowKey, "expense|light");
  assert.equal(context.movementMappings[key].kind, "expense");
  assert.equal(context.movementMappings[key].label, "Gastos variables · Suscripción");
  assert.deepEqual(calls, [
    "saveMovementMappings",
    "applyMovementMappingsToActuals",
    "datosImportarRefreshRowsForMappings",
    "saveIncomeActuals",
    "saveExpenseActuals",
    "refreshAllSectionsAfterDataChange",
  ]);
  assert.equal(isClosed(), true);
  assert.equal(context.cierreClassifyEntryId, null);
  assert.match(getAnnounced(), /Partida guardada/);
});

test("C-3b · Clasificar sin elegir partida no escribe nada y avisa", () => {
  const entry = sampleEntry();
  const { context, calls, isClosed } = sandboxClassifyConfirm(entry, "");
  context.handleCierreTaskClassifyConfirm();
  assert.deepEqual(context.movementMappings, {});
  assert.deepEqual(calls, []);
  assert.equal(isClosed(), false);
});

// --- handleCierreTaskCreatePartidaConfirm: crea la partida y clasifica con su rowKey nuevo ------

function sandboxCreatePartida(entry, labelValue, sectionValue) {
  const calls = [];
  let dialogClosed = false;
  let announced = null;
  const pushed = [];
  const context = sandboxWith(
    ["handleCierreTaskCreatePartidaConfirm", "cierreLedgerEntryById", "cierreEntryAsTransaction", "cierreClassifyApply"],
    {
      cierreClassifyEntryId: entry ? entry.id : null,
      canonicalLedgerSnapshot: { entries: entry ? [entry] : [] },
      customPlanningRows: pushed,
      saveCustomPlanningRows: () => calls.push("saveCustomPlanningRows"),
      movementMappings: {},
      movementMappingKey: (t) => `${t.amount >= 0 ? "income" : "expense"}|${t.movement}|${t.details}`,
      saveMovementMappings: () => calls.push("saveMovementMappings"),
      applyMovementMappingsToActuals: () => calls.push("applyMovementMappingsToActuals"),
      pendingMovementMappings: [],
      buildPendingMovementMappings: () => [],
      baseData: { transactions: [] },
      datosImportarRefreshRowsForMappings: () => calls.push("datosImportarRefreshRowsForMappings"),
      saveIncomeActuals: () => calls.push("saveIncomeActuals"),
      saveExpenseActuals: () => calls.push("saveExpenseActuals"),
      refreshAllSectionsAfterDataChange: () => calls.push("refreshAllSectionsAfterDataChange"),
      announceStatus: (msg) => { announced = msg; },
      qs: (id) =>
        id === "cierreClassifyNewLabel"
          ? { value: labelValue, focus: () => {} }
          : id === "cierreClassifyNewSection"
            ? { value: sectionValue }
            : id === "cierreClassifyDialog"
              ? { close: () => { dialogClosed = true; } }
              : null,
    },
  );
  return { context, calls, pushed, isClosed: () => dialogClosed, getAnnounced: () => announced };
}

test("C-3b · Crear partida añade la fila y clasifica el movimiento con su propio rowKey", () => {
  const entry = sampleEntry();
  const { context, pushed, isClosed, getAnnounced } = sandboxCreatePartida(entry, "Suscripción streaming", "Gastos variables");
  context.handleCierreTaskCreatePartidaConfirm();
  assert.equal(pushed.length, 1);
  const row = pushed[0];
  assert.equal(row.custom, true);
  assert.equal(row.kind, "expense");
  assert.equal(row.sectionName, "Gastos variables");
  assert.equal(row.label, "Suscripción streaming");
  assert.equal(row.monthKey, "2026-08");
  assert.equal(row.plannedValue, 62.3, "el importe planificado arranca en lo que ya costó, no en 0");
  const key = "expense|Amazon|Cargo tarjeta";
  assert.equal(context.movementMappings[key].rowKey, `expense|${row.id}`);
  assert.equal(context.movementMappings[key].label, "Suscripción streaming");
  assert.equal(isClosed(), true);
  assert.match(getAnnounced(), /creada y el movimiento clasificado/);
});

test("C-3b · Crear partida sin nombre no crea nada y avisa", () => {
  const entry = sampleEntry();
  const { context, pushed, isClosed } = sandboxCreatePartida(entry, "   ", "Gastos variables");
  context.handleCierreTaskCreatePartidaConfirm();
  assert.equal(pushed.length, 0);
  assert.deepEqual(context.movementMappings, {});
  assert.equal(isClosed(), false);
});

// --- Cableado: index.html y los listeners de app.js -----------------------------------------------

test("C-3b · index.html declara el diálogo de clasificación", () => {
  assert.match(html, /<dialog[^>]*id="cierreClassifyDialog"/);
  assert.match(html, /id="cierreClassifyContent"/);
  assert.match(html, /id="cierreClassifyClose"/);
});

test("C-3b · el listener de #cierre abre el modal en el modo correcto para cada botón", () => {
  assert.match(app, /handleCierreTaskClassifyOpen\(classifyOpen\.dataset\.cierreTaskClassify, "existing"\)/);
  assert.match(app, /handleCierreTaskClassifyOpen\(createPartidaOpen\.dataset\.cierreTaskCreatePartida, "new"\)/);
});

test("C-3b · el diálogo de clasificación conecta Guardar, Crear y los dos enlaces de cambio de modo", () => {
  assert.match(app, /id === "cierreClassifySave"\) \{ handleCierreTaskClassifyConfirm\(\); return; \}/);
  assert.match(app, /id === "cierreClassifyCreate"\) \{ handleCierreTaskCreatePartidaConfirm\(\); return; \}/);
  assert.match(app, /id === "cierreClassifySwitchToNew"/);
  assert.match(app, /id === "cierreClassifySwitchToExisting"/);
});
