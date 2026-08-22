const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

// Planificación de partidas (21 de agosto de 2026): aterrizaje generalizado del Motor de
// escenarios (compra/proyecto/imprevisto/propio/deuda_nueva/prestamo_familiar → `projects`;
// cambio_ingreso/cambio_gasto → `customPlanningRows`) y estado "pending" persistido en decisiones
// manuales de deuda/proyecto. Sigue el mismo patrón de extracción de funciones que
// laboratorio-debt-liquidations-escenarios.test.cjs para no depender de cargar app.js entero (usa
// `window`, DOM, Supabase...).

const round2 = (v) => Math.round((Number(v || 0) + Number.EPSILON) * 100) / 100;

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

function extractConst(name) {
  const marker = `const ${name} =`;
  const start = app.indexOf(marker);
  assert.ok(start >= 0, `No existe la constante ${name} en app.js`);
  const end = app.indexOf(";", start);
  assert.ok(end >= 0, `La constante ${name} no termina en ';'`);
  return app.slice(start, end + 1);
}

// Seis meses fijos (ago 26 - ene 27) para no depender de modelStartDate/modelMonthCount reales.
const MONTHS = ["2026-08", "2026-09", "2026-10", "2026-11", "2026-12", "2027-01"].map((key, index) => ({
  index,
  key,
  label: key,
}));

function landingContext(extra = {}) {
  const context = {
    round2,
    forecastMonths: () => MONTHS,
    lastSimulation: [],
    ...extra,
  };
  vm.createContext(context);
  [extractConst("ESCENARIO_PROJECT_LANDING_TYPES"), extractFunction("escenarioResolvedMonthKey"), extractFunction("escenarioMonthIndex"), extractFunction("landScenarioDecisionAsProjects")].forEach(
    (source) => vm.runInContext(source, context),
  );
  return context;
}

function planningRowsContext(extra = {}) {
  const context = { round2, forecastMonths: () => MONTHS, lastSimulation: [], ...extra };
  vm.createContext(context);
  [extractFunction("escenarioMonthIndex"), extractFunction("landScenarioDecisionAsPlanningRows")].forEach((source) => vm.runInContext(source, context));
  return context;
}

// --- escenarioResolvedMonthKey / escenarioMonthIndex --------------------------------------------

test("escenarioResolvedMonthKey prioriza mesResuelto sobre mesManual", () => {
  const context = landingContext();
  assert.equal(context.escenarioResolvedMonthKey({ planificacion: { mesResuelto: "2026-10", mesManual: "2026-09" } }), "2026-10");
  assert.equal(context.escenarioResolvedMonthKey({ planificacion: { mesManual: "2026-09" } }), "2026-09");
  assert.equal(context.escenarioResolvedMonthKey({}), "");
});

test("escenarioMonthIndex devuelve -1 para un mes fuera de horizonte o vacío", () => {
  const context = landingContext();
  assert.equal(context.escenarioMonthIndex("2026-10"), 2);
  assert.equal(context.escenarioMonthIndex("2028-01"), -1);
  assert.equal(context.escenarioMonthIndex(""), -1);
});

// --- landScenarioDecisionAsProjects: compra ------------------------------------------------------

test("compra sin financiación aterriza como golpe único en el mes resuelto", () => {
  const context = landingContext();
  const decision = { id: "d1", tipo: "compra", titulo: "Sofá nuevo", planificacion: { mesManual: "2026-09" }, params: { importe: 900 } };
  const entries = context.landScenarioDecisionAsProjects(decision, { id: "esc-1" });
  assert.equal(entries.length, 1);
  assert.equal(entries[0].amount, 900);
  assert.equal(entries[0].duration, 1);
  assert.equal(entries[0].monthKey, "2026-09");
  assert.equal(entries[0].recurringAmount, 0);
  assert.equal(entries[0].source, "escenario");
  assert.equal(entries[0].escenarioSavedId, "esc-1");
  assert.equal(entries[0].escenarioDecisionId, "d1");
  assert.equal(entries[0].lifecycleState, "approved");
});

test("compra financiada aterriza como cuota recurrente desde el mismo mes", () => {
  const context = landingContext();
  const decision = {
    id: "d2",
    tipo: "compra",
    planificacion: { mesResuelto: "2026-10" },
    params: { importe: 3000, financiacion: { cuota: 120, plazo: 24 } },
  };
  const entries = context.landScenarioDecisionAsProjects(decision, { id: "esc-1" });
  assert.equal(entries.length, 1);
  assert.equal(entries[0].amount, 0);
  assert.equal(entries[0].recurringAmount, 120);
  assert.equal(entries[0].recurringDuration, 24);
  assert.equal(entries[0].recurringStartOffset, 0);
  assert.equal(entries[0].monthKey, "2026-10");
});

test("compra sin mes resuelto no aterriza nada", () => {
  const context = landingContext();
  const decision = { id: "d3", tipo: "compra", planificacion: {}, params: { importe: 900 } };
  assert.equal(JSON.stringify(context.landScenarioDecisionAsProjects(decision, { id: "esc-1" })), "[]");
});

// --- landScenarioDecisionAsProjects: proyecto -----------------------------------------------------

test("proyecto modalidad hucha reparte el objetivo en cuotas iguales entre el mes resuelto y el objetivo", () => {
  const context = landingContext();
  const decision = {
    id: "d4",
    tipo: "proyecto",
    planificacion: { mesManual: "2026-08" },
    params: { importeObjetivo: 1200, modalidad: "hucha", mesObjetivo: "2026-11" },
  };
  const entries = context.landScenarioDecisionAsProjects(decision, { id: "esc-2" });
  assert.equal(entries.length, 1);
  // ago-nov = 4 meses -> 1200/4 = 300/mes
  assert.equal(entries[0].recurringAmount, 300);
  assert.equal(entries[0].recurringDuration, 4);
  assert.equal(entries[0].monthKey, "2026-08");
});

test("proyecto modalidad pago_unico carga de golpe en el mes objetivo", () => {
  const context = landingContext();
  const decision = { id: "d5", tipo: "proyecto", planificacion: {}, params: { importeObjetivo: 800, modalidad: "pago_unico", mesObjetivo: "2026-12" } };
  const entries = context.landScenarioDecisionAsProjects(decision, { id: "esc-2" });
  assert.equal(entries.length, 1);
  assert.equal(entries[0].amount, 800);
  assert.equal(entries[0].monthKey, "2026-12");
  assert.equal(entries[0].recurringAmount, 0);
});

// --- landScenarioDecisionAsProjects: imprevisto ---------------------------------------------------

test("imprevisto sin recurrenciaMeses es un golpe único", () => {
  const context = landingContext();
  const decision = { id: "d6", tipo: "imprevisto", params: { importe: 250, mes: "2026-09" } };
  const entries = context.landScenarioDecisionAsProjects(decision, { id: "esc-3" });
  assert.equal(entries.length, 1);
  assert.equal(entries[0].amount, 250);
  assert.equal(entries[0].monthKey, "2026-09");
});

test("imprevisto con recurrenciaMeses genera una entrada por cada ocurrencia en el horizonte", () => {
  const context = landingContext();
  const decision = { id: "d7", tipo: "imprevisto", params: { importe: 100, mes: "2026-08", recurrenciaMeses: 2 } };
  const entries = context.landScenarioDecisionAsProjects(decision, { id: "esc-3" });
  // ago, oct, dic dentro de un horizonte de 6 meses (ago..ene) con paso 2
  assert.equal(entries.length, 3);
  assert.equal(JSON.stringify(entries.map((e) => e.monthKey)), JSON.stringify(["2026-08", "2026-10", "2026-12"]));
  entries.forEach((e) => assert.equal(e.amount, 100));
});

// --- landScenarioDecisionAsProjects: propio -------------------------------------------------------

test("propio con importe y mensualidad+plazo combina golpe y recurrente", () => {
  const context = landingContext();
  const decision = { id: "d8", tipo: "propio", params: { definicionId: "x", nombre: "Custom", importe: 200, mensualidad: 50, plazo: 6, mes: "2026-09" } };
  const entries = context.landScenarioDecisionAsProjects(decision, { id: "esc-4" });
  assert.equal(entries.length, 1);
  assert.equal(entries[0].amount, 200);
  assert.equal(entries[0].recurringAmount, 50);
  assert.equal(entries[0].recurringDuration, 6);
});

// --- landScenarioDecisionAsProjects: deuda_nueva / prestamo_familiar ------------------------------

test("deuda_nueva entra como liquidez en el mes y sale como cuota fija desde el mes siguiente", () => {
  const context = landingContext();
  const decision = { id: "d9", tipo: "deuda_nueva", params: { principal: 5000, cuota: 200, plazo: 25, mes: "2026-08" } };
  const entries = context.landScenarioDecisionAsProjects(decision, { id: "esc-5" });
  assert.equal(entries.length, 1);
  assert.equal(entries[0].amount, -5000);
  assert.equal(entries[0].recurringAmount, 200);
  assert.equal(entries[0].recurringDuration, 25);
  assert.equal(entries[0].recurringStartOffset, 1);
});

test("prestamo_familiar 'prestamos' sin devolución es solo una salida en el mes", () => {
  const context = landingContext();
  const decision = { id: "d10", tipo: "prestamo_familiar", params: { direccion: "prestamos", importe: 1000, mes: "2026-09" } };
  const entries = context.landScenarioDecisionAsProjects(decision, { id: "esc-6" });
  assert.equal(entries.length, 1);
  assert.equal(entries[0].amount, 1000);
});

test("prestamo_familiar 'nos_prestan' con devolución genera entrada inicial negativa y devolución recurrente", () => {
  const context = landingContext();
  const decision = { id: "d11", tipo: "prestamo_familiar", params: { direccion: "nos_prestan", importe: 1000, mes: "2026-09", devolucionMensual: 100, meses: 10 } };
  const entries = context.landScenarioDecisionAsProjects(decision, { id: "esc-6" });
  assert.equal(entries.length, 2);
  assert.equal(entries[0].amount, -1000);
  assert.equal(entries[1].recurringAmount, 100);
  assert.equal(entries[1].recurringDuration, 10);
  assert.equal(entries[1].recurringStartOffset, 1);
});

// --- landScenarioDecisionAsProjects: tipos fuera de alcance ---------------------------------------

test("un tipo que no aterriza en projects (deuda real, traspaso, cambio_presupuesto) devuelve []", () => {
  const context = landingContext();
  ["amortizacion", "traspaso", "cambio_presupuesto", "cambio_ingreso"].forEach((tipo) => {
    assert.equal(JSON.stringify(context.landScenarioDecisionAsProjects({ id: "x", tipo, params: {} }, { id: "esc-7" })), "[]");
  });
});

// --- landScenarioDecisionAsPlanningRows: cambio_ingreso / cambio_gasto ---------------------------

test("cambio_ingreso genera una fila 'income' por mes con el delta constante", () => {
  const context = planningRowsContext();
  const decision = { id: "d12", tipo: "cambio_ingreso", titulo: "Sube el sueldo", params: { titular: "javi", deltaMensual: 150, mesInicio: "2026-09", mesFin: "2026-11" } };
  const rows = context.landScenarioDecisionAsPlanningRows(decision, { id: "esc-8" });
  assert.equal(rows.length, 3);
  assert.equal(JSON.stringify(rows.map((r) => r.monthKey)), JSON.stringify(["2026-09", "2026-10", "2026-11"]));
  rows.forEach((row) => {
    assert.equal(row.kind, "income");
    assert.equal(row.plannedValue, 150);
    assert.equal(row.custom, true);
    assert.equal(row.source, "escenario");
  });
});

test("cambio_gasto sin mesFin llega hasta el final del horizonte provisto", () => {
  const context = planningRowsContext();
  const decision = { id: "d13", tipo: "cambio_gasto", params: { bloque: "Ocio", deltaMensual: -40, mesInicio: "2026-11" } };
  const rows = context.landScenarioDecisionAsPlanningRows(decision, { id: "esc-9" });
  assert.equal(JSON.stringify(rows.map((r) => r.monthKey)), JSON.stringify(["2026-11", "2026-12", "2027-01"]));
  rows.forEach((row) => assert.equal(row.kind, "expense"));
});

test("cambio_gasto con deltaPct usa el coreSpend de lastSimulation en ese mes", () => {
  const context = planningRowsContext({ lastSimulation: [{}, { coreSpend: 1000 }, {}, {}, {}, {}] });
  const decision = { id: "d14", tipo: "cambio_gasto", params: { bloque: "Ocio", deltaPct: 0.1, mesInicio: "2026-09", mesFin: "2026-09" } };
  const rows = context.landScenarioDecisionAsPlanningRows(decision, { id: "esc-9" });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].plannedValue, 100);
});

test("un tipo que no es cambio_ingreso/cambio_gasto no genera filas", () => {
  const context = planningRowsContext();
  assert.equal(JSON.stringify(context.landScenarioDecisionAsPlanningRows({ id: "x", tipo: "compra", params: {} }, { id: "esc-9" })), "[]");
});

// --- escenarioDebtLiquidationName: cifra de contexto ----------------------------------------------

test("reunificacion/retomar_pagos añaden una cifra de contexto sin tocar escenarioDecisionAmount", () => {
  const context = sandboxWith(["escenarioDebtLiquidationName"], { money: (v) => `${v} €` });
  assert.equal(
    context.escenarioDebtLiquidationName({ tipo: "reunificacion", titulo: "Reunificar deudas", params: { nuevoPrincipal: 15000 } }),
    "Reunificar deudas (nuevo principal 15000 €)",
  );
  assert.equal(
    context.escenarioDebtLiquidationName({ tipo: "retomar_pagos", titulo: "Retomar Cetelem", params: { cuota: 150 } }),
    "Retomar Cetelem (cuota retomada 150 €/mes)",
  );
  assert.equal(context.escenarioDebtLiquidationName({ tipo: "amortizacion", titulo: "Amortizar", params: {} }), "Amortizar");
});

function sandboxWith(names, extra = {}) {
  const context = { round2, ...extra };
  vm.createContext(context);
  names.forEach((name) => vm.runInContext(extractFunction(name), context));
  return context;
}

// --- syncProjectsFromEscenario / retractProjectsFromEscenario -------------------------------------

function projectsSyncContext(projects) {
  const context = landingContext({ projects });
  [extractFunction("syncProjectsFromEscenario"), extractFunction("retractProjectsFromEscenario")].forEach((source) => vm.runInContext(source, context));
  return context;
}

test("syncProjectsFromEscenario aterriza las decisiones y es idempotente (no duplica en una segunda llamada)", () => {
  const context = projectsSyncContext([]);
  const entry = { id: "esc-10", decisiones: [{ id: "d15", tipo: "compra", params: { importe: 500 }, planificacion: { mesManual: "2026-09" } }] };
  const first = context.syncProjectsFromEscenario(entry);
  assert.equal(first, true);
  assert.equal(context.projects.length, 1);
  const second = context.syncProjectsFromEscenario(entry);
  assert.equal(second, false);
  assert.equal(context.projects.length, 1);
});

test("retractProjectsFromEscenario retira solo los reflejos de ese plan", () => {
  const context = projectsSyncContext([
    { id: "escenario-project:esc-1:d1", source: "escenario", escenarioSavedId: "esc-1" },
    { id: "escenario-project:esc-2:d1", source: "escenario", escenarioSavedId: "esc-2" },
    { id: "project-manual-1", name: "Manual" },
  ]);
  const changed = context.retractProjectsFromEscenario("esc-1");
  assert.equal(changed, true);
  assert.deepEqual(context.projects.map((p) => p.id), ["escenario-project:esc-2:d1", "project-manual-1"]);
});

// --- syncPlanningRowsFromEscenario / retractPlanningRowsFromEscenario -----------------------------

function planningRowsSyncContext(customPlanningRows) {
  const context = planningRowsContext({ customPlanningRows });
  [extractFunction("syncPlanningRowsFromEscenario"), extractFunction("retractPlanningRowsFromEscenario")].forEach((source) => vm.runInContext(source, context));
  return context;
}

test("syncPlanningRowsFromEscenario aterriza y es idempotente por (escenario, decisión, mes)", () => {
  const context = planningRowsSyncContext([]);
  const entry = { id: "esc-11", decisiones: [{ id: "d16", tipo: "cambio_gasto", params: { bloque: "Ocio", deltaMensual: -20, mesInicio: "2026-09", mesFin: "2026-10" } }] };
  const first = context.syncPlanningRowsFromEscenario(entry);
  assert.equal(first, true);
  assert.equal(context.customPlanningRows.length, 2);
  const second = context.syncPlanningRowsFromEscenario(entry);
  assert.equal(second, false);
  assert.equal(context.customPlanningRows.length, 2);
});

test("retractPlanningRowsFromEscenario retira solo las filas de ese plan", () => {
  const context = planningRowsSyncContext([
    { source: "escenario", escenarioSavedId: "esc-1", monthKey: "2026-09" },
    { source: "escenario", escenarioSavedId: "esc-2", monthKey: "2026-09" },
    { custom: true, sectionName: "Manual" },
  ]);
  const changed = context.retractPlanningRowsFromEscenario("esc-1");
  assert.equal(changed, true);
  assert.equal(context.customPlanningRows.length, 2);
});

// --- Cableado: handleCierrePropuestoConfirm / handleEscenarioGuardadosDelete ----------------------

test("confirmar un propuesto también sincroniza projects y customPlanningRows, además de deuda", () => {
  const source = extractFunction("handleCierrePropuestoConfirm");
  assert.match(source, /syncDebtLiquidationsFromEscenario\(promoted\)/);
  assert.match(source, /syncProjectsFromEscenario\(promoted\)/);
  assert.match(source, /syncPlanningRowsFromEscenario\(promoted\)/);
  assert.match(source, /retractProjectsFromEscenario\(entry\.id\)/);
  assert.match(source, /retractPlanningRowsFromEscenario\(entry\.id\)/);
  assert.match(source, /if \(projectsChanged\) saveProjects\(\);/);
  assert.match(source, /if \(planningRowsChanged\) saveCustomPlanningRows\(\);/);
});

test("eliminar un plan vigente/aplicado retracta también sus reflejos en projects y customPlanningRows", () => {
  const source = extractFunction("handleEscenarioGuardadosDelete");
  assert.match(source, /retractProjectsFromEscenario\(id\)/);
  assert.match(source, /retractPlanningRowsFromEscenario\(id\)/);
});

// --- transitionDecisionLifecycle: "pending" ya no purga el item del array de origen ---------------

test("transitionDecisionLifecycle conserva el item cuando toStatus es 'pending' en vez de purgarlo", () => {
  const source = extractFunction("transitionDecisionLifecycle");
  assert.match(source, /api\.decisionAffectsPlan\(toStatus\) \|\| toStatus === "pending"/);
});

// =================================================================================================
// Gestión de partidas dentro de "Planificación de partidas" (22 de agosto de 2026): duplica, con
// nombres/IDs propios, la capacidad de añadir/renombrar/borrar/editar previsto que hoy solo tiene
// `#visual-detail` — sin tocar esa pantalla ni `#plan`/`#cuadro-mandos`. Escribe en los mismos
// diccionarios de borrador compartidos (`visualDraftLabels`, `visualDraftDeletes`,
// `visualSelectedRows`, `customPlanningRows`) y llama a las mismas funciones de persistencia
// (`saveVisualChanges`, `discardVisualChanges`, `stageSelectedVisualDeletes`, `cuadroMandosStageCell`,
// `cuadroMandosImpact`) sin modificarlas.
// =================================================================================================

function partidasHandlerContext(names, extra = {}) {
  const context = {
    round2,
    money: (v) => `${v} €`,
    escapeHtml: (v) => String(v ?? ""),
    seriesKeyForRow: (row) => `${row.kind}|${row.id}`,
    displayLabelForRow: (row) => row.label || "Concepto",
    visualDraftLabels: {},
    visualDraftDeletes: {},
    visualSelectedRows: new Set(),
    renderPartidasGestionBlocks: () => {},
    ...extra,
  };
  vm.createContext(context);
  names.forEach((name) => vm.runInContext(extractFunction(name), context));
  return context;
}

test("handlePartidasLabelChange crea un borrador de renombrado y lo borra si vuelve al original", () => {
  const row = { kind: "expense", id: "trastero", label: "Trastero" };
  const context = partidasHandlerContext(["handlePartidasLabelChange"], {
    rowForSeriesKey: () => row,
  });
  context.handlePartidasLabelChange({ dataset: { partidasLabelKey: "expense|trastero" }, value: "Trastero Barbera" });
  assert.equal(context.visualDraftLabels["expense|trastero"].value, "Trastero Barbera");
  context.handlePartidasLabelChange({ dataset: { partidasLabelKey: "expense|trastero" }, value: "Trastero" });
  assert.equal(context.visualDraftLabels["expense|trastero"], undefined);
});

test("handlePartidasLabelChange no hace nada si la fila no existe", () => {
  const context = partidasHandlerContext(["handlePartidasLabelChange"], { rowForSeriesKey: () => null });
  context.handlePartidasLabelChange({ dataset: { partidasLabelKey: "expense|no-existe" }, value: "X" });
  assert.equal(Object.keys(context.visualDraftLabels).length, 0);
});

test("handlePartidasDeleteRow marca la fila como borrado pendiente y la desmarca de seleccionadas", () => {
  const row = { kind: "expense", id: "coche", label: "Coche" };
  const context = partidasHandlerContext(["handlePartidasDeleteRow"], {
    rowForSeriesKey: () => row,
    visualSelectedRows: new Set(["expense|coche"]),
  });
  context.handlePartidasDeleteRow("expense|coche");
  assert.equal(context.visualDraftDeletes["expense|coche"].label, "Coche");
  assert.equal(context.visualSelectedRows.has("expense|coche"), false);
});

test("handlePartidasRowSelect añade y quita del Set compartido de seleccionadas", () => {
  const context = partidasHandlerContext(["handlePartidasRowSelect"]);
  context.handlePartidasRowSelect("expense|coche", true);
  assert.equal(context.visualSelectedRows.has("expense|coche"), true);
  context.handlePartidasRowSelect("expense|coche", false);
  assert.equal(context.visualSelectedRows.has("expense|coche"), false);
});

test("handlePartidasBulkDelete reutiliza stageSelectedVisualDeletes tal cual, sin reimplementarla", () => {
  const source = extractFunction("handlePartidasBulkDelete");
  assert.match(source, /stageSelectedVisualDeletes\(\)/);
});

test("handlePartidasCellChange reutiliza cuadroMandosStageCell tal cual, sin reimplementar el staging", () => {
  const source = extractFunction("handlePartidasCellChange");
  assert.match(source, /cuadroMandosStageCell\(/);
  assert.doesNotMatch(source, /visualDraftCells\[/);
});

test("handlePartidasSave reutiliza saveVisualChanges tal cual", () => {
  assert.match(extractFunction("handlePartidasSave"), /saveVisualChanges\(\);/);
});

test("handlePartidasDiscard reutiliza discardVisualChanges tal cual y repinta con render()", () => {
  const source = extractFunction("handlePartidasDiscard");
  assert.match(source, /discardVisualChanges\(\);/);
  assert.match(source, /render\(\);/);
});

test("renderPartidasImpactBar reutiliza cuadroMandosImpact tal cual, sin recalcular el impacto por su cuenta", () => {
  const source = extractFunction("renderPartidasImpactBar");
  assert.match(source, /cuadroMandosImpact\(\)/);
  assert.doesNotMatch(source, /computeCanonicalScenario/);
});

test("renderPartidasSavePanel reutiliza visualPendingCounts tal cual", () => {
  assert.match(extractFunction("renderPartidasSavePanel"), /visualPendingCounts\(\)/);
});

// --- handlePartidasAddRow (alta inmediata en customPlanningRows, mirror de handleVisualAddRow) ---

function partidasAddRowContext(extra = {}) {
  const fields = {
    partidasAddKind: { value: "expense" },
    partidasAddSection: { value: "Gastos fijos" },
    partidasAddLabel: { value: "Trastero" },
    partidasAddAmount: { value: "75" },
    partidasAddStartMonth: { value: "2026-09" },
    partidasAddEndMonth: { value: "2026-09" },
    partidasAddFeedback: { textContent: "", className: "" },
  };
  const context = {
    round2,
    parseAmount: (v) => (v === "" ? null : Number(v)),
    qs: (id) => fields[id],
    partidasAddSingleMonthMode: () => true,
    monthsInRange: () => [{ key: "2026-09", label: "sept 26" }],
    customPlanningRows: [],
    partidasGestionExpanded: new Set(),
    expandedPlanningSections: { expense: new Set(), income: new Set() },
    saveCustomPlanningRows: () => {},
    render: () => {},
    ...extra,
  };
  vm.createContext(context);
  vm.runInContext(extractFunction("handlePartidasAddRow"), context);
  return context;
}

test("handlePartidasAddRow añade una entrada custom por cada mes del rango, sin pasar por borradores", () => {
  const context = partidasAddRowContext();
  context.handlePartidasAddRow();
  assert.equal(context.customPlanningRows.length, 1);
  assert.equal(context.customPlanningRows[0].custom, true);
  assert.equal(context.customPlanningRows[0].label, "Trastero");
  assert.equal(context.customPlanningRows[0].plannedValue, 75);
  assert.equal(context.customPlanningRows[0].monthKey, "2026-09");
});

test("handlePartidasAddRow no añade nada si falta el concepto", () => {
  const fields = {
    partidasAddKind: { value: "expense" },
    partidasAddSection: { value: "Gastos fijos" },
    partidasAddLabel: { value: "   ", focus: () => {} },
    partidasAddAmount: { value: "75" },
    partidasAddStartMonth: { value: "2026-09" },
    partidasAddEndMonth: { value: "2026-09" },
    partidasAddFeedback: { textContent: "", className: "" },
  };
  const context = partidasAddRowContext({ qs: (id) => fields[id] });
  context.handlePartidasAddRow();
  assert.equal(context.customPlanningRows.length, 0);
});

// --- Hitos narrativos: cushion milestone / próximo mes bajo reserva ------------------------------

function hitosContext(lastSimulation) {
  const context = { round2, lastSimulation };
  vm.createContext(context);
  [extractFunction("planificacionPartidasCushionMilestone"), extractFunction("planificacionPartidasNextBelowReserve")].forEach((source) =>
    vm.runInContext(source, context),
  );
  return context;
}

test("planificacionPartidasCushionMilestone dice que ya se cumple si nunca cae bajo el suelo", () => {
  const context = hitosContext([{ totalLiquidity: 5000 }, { totalLiquidity: 6000 }]);
  const result = context.planificacionPartidasCushionMilestone({ value: 2000 });
  assert.equal(result.achieved, true);
  assert.equal(result.alreadyMet, true);
});

test("planificacionPartidasCushionMilestone marca el primer mes tras la última caída bajo el suelo", () => {
  const context = hitosContext([
    { totalLiquidity: 500, month: "ago 26" },
    { totalLiquidity: 1500, month: "sept 26" },
    { totalLiquidity: 3000, month: "oct 26" },
  ]);
  const result = context.planificacionPartidasCushionMilestone({ value: 2000 });
  assert.equal(result.achieved, true);
  assert.equal(result.alreadyMet, false);
  assert.equal(result.month.month, "oct 26");
});

test("planificacionPartidasCushionMilestone dice que no se cumple si el horizonte acaba por debajo", () => {
  const context = hitosContext([{ totalLiquidity: 3000 }, { totalLiquidity: 500 }]);
  const result = context.planificacionPartidasCushionMilestone({ value: 2000 });
  assert.equal(result.achieved, false);
  assert.equal(result.month, null);
});

test("planificacionPartidasNextBelowReserve devuelve el primer mes que cae bajo el suelo", () => {
  const context = hitosContext([
    { totalLiquidity: 3000, month: "ago 26" },
    { totalLiquidity: 500, month: "sept 26" },
    { totalLiquidity: 100, month: "oct 26" },
  ]);
  const result = context.planificacionPartidasNextBelowReserve({ value: 2000 });
  assert.equal(result.month, "sept 26");
});

test("planificacionPartidasNextBelowReserve devuelve null si ningún mes cae bajo el suelo", () => {
  const context = hitosContext([{ totalLiquidity: 3000 }, { totalLiquidity: 4000 }]);
  assert.equal(context.planificacionPartidasNextBelowReserve({ value: 2000 }), null);
});

// --- Reutilización del motor existente en los bloques analíticos (sin reimplementar) -------------

test("partidasCushionBand reutiliza analisisCushionBand/analisisCushionBandHtml/analisisCushionWorst de Análisis tal cual", () => {
  const source = extractFunction("partidasCushionBand");
  assert.match(source, /analisisCushionBand\(/);
  assert.match(source, /analisisCushionWorst\(/);
  assert.match(source, /analisisCushionBandHtml\(/);
});

test("planificacionPartidasRowsWithOverride restaura debtLiquidations/projects en el finally, como cuadroMandosRowsWith con seriesOverrides", () => {
  const source = extractFunction("planificacionPartidasRowsWithOverride");
  assert.match(source, /finally\s*\{[\s\S]*debtLiquidations = backupDebt;[\s\S]*projects = backupProjects;[\s\S]*\}/);
  assert.match(source, /buildProjectSchedule\(\)/);
  assert.match(source, /computeCanonicalScenario\(/);
});

test("planificacionPartidasEscenarioGhosts reutiliza el mismo trío que las tarjetas de Escenarios guardados", () => {
  const source = extractFunction("planificacionPartidasEscenarioGhosts");
  assert.match(source, /escenarioMotorBaseInput\(\)/);
  assert.match(source, /runEscenarioMotor\(/);
  assert.match(source, /escenarioMotorSummaryFor\(/);
});

test("renderPlanificacionPartidas cablea el resumen, el ajuste rápido y los cuatro bloques analíticos elegidos", () => {
  const source = extractFunction("renderPlanificacionPartidas");
  assert.match(source, /partidasSummaryCardHtml\(\)/);
  assert.match(source, /partidasCushionBand\(/);
  assert.match(source, /partidasImpactChartHtml\(/);
  assert.match(source, /planificacionPartidasRankedImpact\(\)/);
  assert.match(source, /planificacionPartidasEscenarioGhosts\(\)/);
  assert.match(source, /renderPartidasGestionBlocks\(\);/);
  assert.match(source, /syncPartidasEditScopeUi\(\);/);
});

test("partidasSummaryCardHtml (resumen del plan, al inicio) incluye las tres cifras y los hitos", () => {
  const source = extractFunction("partidasSummaryCardHtml");
  assert.match(source, /asesor-decision-stats/);
  assert.match(source, /planificacionPartidasHitosHtml\(\)/);
});

// --- Ajuste rápido: modificar importe en un mes/rango/varios meses concretos, o borrar la fila ---

test("handlePartidasBulkEdit reutiliza cuadroMandosStageCell para cada mes del alcance, sin reimplementar el staging", () => {
  const source = extractFunction("handlePartidasBulkEdit");
  assert.match(source, /cuadroMandosStageCell\(rowKey, month\.key, value\)/);
  assert.doesNotMatch(source, /visualDraftCells\[key\] = \{/);
});

// `handlePartidasBulkEdit` es la única función bajo prueba aquí: `selectedPartidasEditRow` y
// `partidasBulkEditTargetMonths` se mockean directamente (igual que ya hace `partidasHandlerContext`
// con otros handlers de esta pantalla) en vez de extraerlas también, para no depender de selects
// reales de mes.
function partidasBulkEditContext(extra = {}) {
  const context = {
    round2,
    parseAmount: (v) => (v === "" ? null : Number(v)),
    displayLabelForRow: (row) => row.label || "Concepto",
    visualDraftCells: {},
    visualDraftDeletes: {},
    visualSelectedRows: new Set(),
    partidasGestionExpanded: new Set(),
    renderPartidasGestionBlocks: () => {},
    selectedPartidasEditRow: () => null,
    partidasBulkEditTargetMonths: () => [],
    ...extra,
  };
  vm.createContext(context);
  vm.runInContext(extractFunction("handlePartidasBulkEdit"), context);
  return context;
}

test("handlePartidasBulkEdit (acción: modificar importe) marca un borrador por cada mes del rango elegido", () => {
  const row = { kind: "expense", id: "trastero" };
  const staged = [];
  const fields = { partidasEditAction: { value: "amount" }, partidasEditAmount: { value: "80" }, partidasBulkEditFeedback: { textContent: "", className: "" } };
  const context = partidasBulkEditContext({
    qs: (id) => fields[id],
    seriesKeyForRow: () => "expense|trastero",
    selectedPartidasEditRow: () => row,
    partidasBulkEditTargetMonths: () => [{ key: "2026-09", label: "sept 26" }, { key: "2026-10", label: "oct 26" }],
    cuadroMandosStageCell: (rowKey, monthKey, value) => staged.push({ rowKey, monthKey, value }),
  });
  context.handlePartidasBulkEdit();
  assert.equal(staged.length, 2);
  assert.deepEqual(staged.map((item) => item.monthKey), ["2026-09", "2026-10"]);
  assert.equal(staged[0].value, 80);
});

test("handlePartidasBulkEdit (acción: borrar línea) marca el borrado y limpia los borradores de importe de esa fila", () => {
  const row = { kind: "expense", id: "trastero" };
  const fields = { partidasEditAction: { value: "delete" }, partidasEditAmount: { value: "" }, partidasBulkEditFeedback: { textContent: "", className: "" } };
  const context = partidasBulkEditContext({
    qs: (id) => fields[id],
    seriesKeyForRow: () => "expense|trastero",
    selectedPartidasEditRow: () => row,
    displayLabelForRow: () => "Trastero",
    visualDraftCells: { "expense|trastero|2026-09|planned": { rowKey: "expense|trastero" }, "expense|coche|2026-09|planned": { rowKey: "expense|coche" } },
    visualSelectedRows: new Set(["expense|trastero"]),
  });
  context.handlePartidasBulkEdit();
  assert.equal(context.visualDraftDeletes["expense|trastero"].label, "Trastero");
  assert.equal(context.visualSelectedRows.has("expense|trastero"), false);
  assert.equal(Object.keys(context.visualDraftCells).length, 1);
  assert.ok(context.visualDraftCells["expense|coche|2026-09|planned"]);
});

test("handlePartidasBulkEdit no hace nada si no hay partida seleccionada", () => {
  const fields = { partidasEditAction: { value: "amount" }, partidasEditAmount: { value: "80" }, partidasBulkEditFeedback: { textContent: "", className: "" } };
  const context = partidasBulkEditContext({ qs: (id) => fields[id] });
  context.handlePartidasBulkEdit();
  assert.equal(fields.partidasBulkEditFeedback.textContent, "Selecciona una partida para modificar.");
});

// --- Gráfico: crosshair + tooltip por mes, sin reimplementar el motor de impacto -----------------

test("partidasImpactChartHtml reutiliza cuadroMandosImpact para el trazo de ediciones sin guardar", () => {
  const source = extractFunction("partidasImpactChartHtml");
  assert.match(source, /cuadroMandosImpact\(\)/);
  assert.match(source, /data-partidas-chart-points/);
});

test("handlePartidasChartHover no revienta si el punto no está dentro de la envolvente del gráfico", () => {
  const source = extractFunction("handlePartidasChartHover");
  assert.match(source, /closest\(".planificacion-partidas-chart-wrap"\)/);
  assert.match(source, /hidePartidasChartTooltip\(\);/);
});
