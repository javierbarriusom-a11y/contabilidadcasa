const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

// Fase 7 · Laboratorio, reconstruida el 20 de agosto de 2026 sobre el mockup real
// (`Laboratorio.pdf`, enviado 4 de agosto de 2026): catálogo canónico de las dieciocho pantallas
// heredadas, cada una con un veredicto cerrado — adoptada, sustituida o descartada, nunca
// «candidata» (L-1) — vista de tarjetas por defecto con toggle a lista (L-6), regla de que
// «adoptada» exige tarea de backlog (L-2), panel de detalle con "qué hacía/dónde vive
// ahora/recogida en" (L-3), instantánea fechada del último cierre (L-4), guardarraíl real de
// escritura en modo solo lectura (L-5), acta exportable en CSV/PDF (L-7), todo dentro de Ajustes
// (L-8), con su propio mecanismo de retirada al cerrar la fase 7 (L-9) sin dejar rutas colgando
// (L-10). Tres entradas se apartan del mockup con evidencia verificada contra el código real
// (#movements, #alerts-center, #operations-manual) — ver la cabecera de LABORATORIO_CATALOG.

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
  const marker = `const ${name} = `;
  const start = app.indexOf(marker);
  assert.ok(start >= 0, `No existe la constante ${name} en app.js`);
  const valueStart = start + marker.length;
  const openChar = app[valueStart];
  assert.ok(openChar === "[" || openChar === "{", `${name} no empieza con [ ni {`);
  const closeChar = openChar === "[" ? "]" : "}";
  let depth = 0;
  for (let index = valueStart; index < app.length; index += 1) {
    if (app[index] === openChar) depth += 1;
    else if (app[index] === closeChar) {
      depth -= 1;
      if (depth === 0) return app.slice(start, index + 1);
    }
  }
  throw new Error(`${name} no cierra`);
}

function loadCatalog() {
  const context = {};
  vm.createContext(context);
  vm.runInContext(`${extractConst("LABORATORIO_CATALOG")}\nthis.LABORATORIO_CATALOG = LABORATORIO_CATALOG;`, context);
  return context.LABORATORIO_CATALOG;
}

const realCatalog = loadCatalog();
const byHash = (hash) => realCatalog.find((entry) => entry.hash === hash);

// --- L-1 · tres veredictos cerrados, ninguno abierto ----------------------------------------------

test("L-1 · el catálogo tiene las dieciocho heredadas del rediseño", () => {
  assert.equal(realCatalog.length, 18);
});

test("L-1 · laboratorioOpenVerdicts no encuentra ningún veredicto abierto en el catálogo real", () => {
  const context = {};
  vm.createContext(context);
  vm.runInContext(`${extractConst("LABORATORIO_VEREDICTOS")}\n${extractFunction("laboratorioOpenVerdicts")}`, context);
  assert.equal(context.laboratorioOpenVerdicts(realCatalog).length, 0);
});

test("L-1 · laboratorioOpenVerdicts sí detecta una entrada sin veredicto válido", () => {
  const context = {};
  vm.createContext(context);
  vm.runInContext(`${extractConst("LABORATORIO_VEREDICTOS")}\n${extractFunction("laboratorioOpenVerdicts")}`, context);
  assert.equal(context.laboratorioOpenVerdicts([{ hash: "x", veredicto: "candidata" }]).length, 1);
});

test("L-1 · laboratorioVerdictSummary cuenta los tres veredictos sin dejar ninguno fuera", () => {
  const context = {};
  vm.createContext(context);
  vm.runInContext(`${extractConst("LABORATORIO_VEREDICTOS")}\n${extractFunction("laboratorioOpenVerdicts")}\n${extractFunction("laboratorioVerdictSummary")}`, context);
  const summary = context.laboratorioVerdictSummary(realCatalog);
  assert.equal(summary.total, 18);
  assert.equal(summary.abiertos, 0);
  assert.equal(summary.adoptada + summary.sustituida + summary.descartada, 18);
});

// --- L-2 · adoptada exige tarea de backlog ----------------------------------------------------------

test("L-2 · ninguna heredada «adoptada» del catálogo real se queda sin tarea de backlog", () => {
  const context = {};
  vm.createContext(context);
  vm.runInContext(extractFunction("laboratorioAdoptedWithoutTask"), context);
  assert.equal(context.laboratorioAdoptedWithoutTask(realCatalog).length, 0);
});

test("L-2 · el guardarraíl sí detecta una adoptada sin tarea", () => {
  const context = {};
  vm.createContext(context);
  vm.runInContext(extractFunction("laboratorioAdoptedWithoutTask"), context);
  assert.equal(context.laboratorioAdoptedWithoutTask([{ hash: "x", veredicto: "adoptada", backlogTask: null }]).length, 1);
});

test("L-2 · el catálogo real tiene nueve adoptadas, todas con tarea real", () => {
  const adoptadas = realCatalog.filter((entry) => entry.veredicto === "adoptada");
  assert.equal(adoptadas.length, 9);
  adoptadas.forEach((entry) => assert.ok(entry.backlogTask, `${entry.hash} adoptada sin tarea`));
});

// --- L-6 · vista de lista con los destinos, y la vista de tarjetas por defecto ------------------------

test("L-6 · laboratorioListRows devuelve una fila por heredada, ordenada por veredicto", () => {
  const context = {};
  vm.createContext(context);
  vm.runInContext(extractFunction("laboratorioListRows"), context);
  const rows = context.laboratorioListRows(realCatalog);
  assert.equal(rows.length, 18);
  for (let index = 1; index < rows.length; index += 1) {
    assert.ok(rows[index - 1].veredicto.localeCompare(rows[index].veredicto) <= 0, "debe venir ordenada por veredicto");
  }
});

test("L-6 · laboratorioListHtml pinta el veredicto y el destino de cada fila", () => {
  const context = { escapeHtml: (v) => String(v) };
  vm.createContext(context);
  vm.runInContext(`${extractConst("LABORATORIO_VEREDICTO_LABEL")}\n${extractConst("LABORATORIO_VEREDICTO_BADGE")}\n${extractFunction("laboratorioListHtml")}`, context);
  const rows = [
    { hash: "simulator", label: "Simulador", veredicto: "sustituida", destino: { hash: "escenario-simular", label: "Escenarios · Simular" } },
    { hash: "movements", label: "Movimientos", veredicto: "adoptada", destino: null },
  ];
  const out = context.laboratorioListHtml(rows, "simulator");
  assert.match(out, /Sustituida/);
  assert.match(out, /data-home-nav="escenario-simular"/);
  assert.match(out, /Adoptada/);
  assert.match(out, /class="[^"]*is-selected[^"]*"/);
});

test("L-6 · las tarjetas son la vista por defecto y la lista arranca oculta", () => {
  assert.match(html, /<div class="laboratorio-cards" id="laboratorioCards"><\/div>/);
  assert.match(html, /<div id="laboratorioList" hidden><\/div>/);
});

test("L-6 · laboratorioCardsHtml pinta cada tarjeta con su veredicto y su tarea", () => {
  const context = { escapeHtml: (v) => String(v) };
  vm.createContext(context);
  vm.runInContext(`${extractConst("LABORATORIO_VEREDICTO_LABEL")}\n${extractConst("LABORATORIO_VEREDICTO_BADGE")}\n${extractFunction("laboratorioCardsHtml")}`, context);
  const out = context.laboratorioCardsHtml(
    [{ hash: "data-audit", label: "Datos y auditoría", veredicto: "adoptada", dondeViveAhora: "Cierre · paso 4", backlogTask: "C-9, C-10, C-11" }],
    "data-audit",
  );
  assert.match(out, /Recogida en C-9, C-10, C-11/);
  assert.match(out, /is-selected/);
  assert.match(out, /Cierre · paso 4/);
});

test("L-6 · sin heredadas para el filtro activo, lo dice en vez de pintar una rejilla vacía", () => {
  const context = {};
  vm.createContext(context);
  vm.runInContext(extractFunction("laboratorioCardsHtml"), context);
  assert.match(context.laboratorioCardsHtml([], null), /Ninguna heredada con este veredicto/);
});

// --- Filtros y contador --------------------------------------------------------------------------

test("Filtros · laboratorioFilterCounts refleja los mismos números que laboratorioVerdictSummary", () => {
  const context = {};
  vm.createContext(context);
  vm.runInContext(
    `${extractConst("LABORATORIO_VEREDICTOS")}\n${extractFunction("laboratorioOpenVerdicts")}\n${extractFunction("laboratorioVerdictSummary")}\n${extractFunction("laboratorioFilterCounts")}`,
    context,
  );
  const counts = context.laboratorioFilterCounts(realCatalog);
  assert.equal(counts.todas, 18);
  assert.equal(counts.adoptada, 9);
  assert.equal(counts.sustituida, 7);
  assert.equal(counts.descartada, 2);
});

test("Filtros · laboratorioFilteredCatalog filtra por veredicto y «todas» no filtra nada", () => {
  const context = {};
  vm.createContext(context);
  vm.runInContext(extractFunction("laboratorioFilteredCatalog"), context);
  const fake = [{ veredicto: "adoptada" }, { veredicto: "sustituida" }];
  assert.equal(context.laboratorioFilteredCatalog(fake, "todas").length, 2);
  assert.equal(context.laboratorioFilteredCatalog(fake, "adoptada").length, 1);
});

test("Contador · laboratorioCounterText cuenta lo filtrado sobre el total, y los abiertos (siempre 0)", () => {
  const context = {};
  vm.createContext(context);
  vm.runInContext(
    `${extractConst("LABORATORIO_VEREDICTOS")}\n${extractFunction("laboratorioOpenVerdicts")}\n${extractFunction("laboratorioFilteredCatalog")}\n${extractFunction("laboratorioCounterText")}`,
    context,
  );
  assert.equal(context.laboratorioCounterText(realCatalog, "adoptada"), "9 de 18 · 0 sin decidir");
  assert.equal(context.laboratorioCounterText(realCatalog, "todas"), "18 de 18 · 0 sin decidir");
});

// --- L-3 · panel de detalle por heredada -------------------------------------------------------------

test("L-3 · laboratorioDetailFor localiza la ficha exacta por hash", () => {
  const context = {};
  vm.createContext(context);
  vm.runInContext(extractFunction("laboratorioDetailFor"), context);
  const entry = context.laboratorioDetailFor("simulator", realCatalog);
  assert.equal(entry.hash, "simulator");
  assert.equal(context.laboratorioDetailFor("no-existe", realCatalog), null);
});

test("L-3 · laboratorioDetailHtml muestra qué hacía, dónde vive ahora, tarea, instantánea y el botón de abrir en solo lectura", () => {
  const context = { escapeHtml: (v) => String(v ?? ""), formatIsoDate: (v) => v };
  vm.createContext(context);
  vm.runInContext(`${extractConst("LABORATORIO_VEREDICTO_LABEL")}\n${extractConst("LABORATORIO_VEREDICTO_BADGE")}\n${extractFunction("laboratorioDetailHtml")}`, context);
  const entry = {
    hash: "simulator",
    label: "Simulador",
    veredicto: "sustituida",
    queHacia: "Qué hacía de prueba",
    dondeViveAhora: "Escenarios",
    destino: { hash: "escenario-simular", label: "Escenarios · Simular" },
    backlogTask: null,
    nota: "",
    evidenciaEscritura: "Evidencia de prueba",
  };
  const out = context.laboratorioDetailHtml(entry, { fecha: "2026-08-15T10:00:00.000Z" });
  assert.match(out, /Qué hacía de prueba/);
  assert.match(out, /data-home-nav="escenario-simular"/);
  assert.match(out, /Sin tarea propia/);
  assert.match(out, /Evidencia de prueba/);
  assert.match(out, /Instantánea del 2026-08-15/);
  assert.match(out, /data-laboratorio-open-readonly="simulator"/);
  assert.match(out, /Abrir en solo lectura/);
  assert.doesNotMatch(out, /laboratorio-card-nota/, "sin nota, no debe pintar el bloque de nota");
  assert.match(context.laboratorioDetailHtml(null), /Elige una pantalla heredada/);
});

test("L-3 · laboratorioDetailHtml pinta la nota de desviación solo cuando existe", () => {
  const context = { escapeHtml: (v) => String(v ?? ""), formatIsoDate: (v) => v };
  vm.createContext(context);
  vm.runInContext(`${extractConst("LABORATORIO_VEREDICTO_LABEL")}\n${extractConst("LABORATORIO_VEREDICTO_BADGE")}\n${extractFunction("laboratorioDetailHtml")}`, context);
  const out = context.laboratorioDetailHtml({ hash: "movements", label: "Movimientos", veredicto: "adoptada", queHacia: "x", dondeViveAhora: "Movimientos", destino: null, backlogTask: "M-1", nota: "Nota de prueba", evidenciaEscritura: "y" }, null);
  assert.match(out, /laboratorio-card-nota">Nota de prueba/);
  assert.match(out, /sin cierre firmado/);
});

// --- L-4 · instantánea fechada del último cierre -----------------------------------------------------

test("L-4 · laboratorioSnapshotContext toma el último cierre vigente y firmado, no el reabierto ni el más reciente sin firmar", () => {
  const context = {
    ledgerMonthLabel: (key) => `Mes ${key}`,
    cierreVersionRows: (closures) =>
      closures.map((op) => ({ monthKey: op.monthKey, fecha: op.occurredAt, autor: op.author, estado: op.status, vigente: op.vigente })),
  };
  vm.createContext(context);
  vm.runInContext(extractFunction("laboratorioSnapshotContext"), context);
  const closures = [
    { monthKey: "2026-07", occurredAt: "2026-08-01T10:00:00.000Z", author: "Javier", status: "closed", vigente: true },
    { monthKey: "2026-08", occurredAt: "2026-08-15T10:00:00.000Z", author: "Javier", status: "reopened", vigente: true },
  ];
  const result = context.laboratorioSnapshotContext(closures);
  assert.equal(result.monthKey, "2026-07");
});

test("L-4 · sin ningún cierre firmado, laboratorioSnapshotContext devuelve null en vez de fabricar una fecha", () => {
  const context = { ledgerMonthLabel: () => "", cierreVersionRows: () => [] };
  vm.createContext(context);
  vm.runInContext(extractFunction("laboratorioSnapshotContext"), context);
  assert.equal(context.laboratorioSnapshotContext([]), null);
});

test("L-4 · laboratorioSnapshotNoteText dice explícitamente cuándo no hay instantánea, sin fingir una", () => {
  const context = { formatIsoDate: (v) => v, ledgerMonthLabel: (key) => key };
  vm.createContext(context);
  vm.runInContext(extractFunction("laboratorioSnapshotNoteText"), context);
  assert.match(context.laboratorioSnapshotNoteText(null), /Todavía no hay ningún mes cerrado/);
  assert.match(context.laboratorioSnapshotNoteText({ monthKey: "2026-07", fecha: "2026-08-01T10:00:00.000Z", autor: "Javier" }), /Javier/);
});

// --- L-5 · escritura imposible, no solo escondida -----------------------------------------------------

test("L-5 · toda entrada del catálogo real declara guardKey (o null) y su evidencia de escritura", () => {
  realCatalog.forEach((entry) => {
    assert.ok("guardKey" in entry, `${entry.hash} debe declarar guardKey`);
    assert.ok(entry.evidenciaEscritura && entry.evidenciaEscritura.length > 0, `${entry.hash} debe documentar su evidencia de escritura`);
  });
});

test("L-5 · visual-detail y update-data documentan su bloqueo permanente real (R-11)", () => {
  assert.match(byHash("visual-detail").evidenciaEscritura, /VISUAL_DETAIL_BALANCE_LEGACY_READONLY/);
  assert.match(byHash("update-data").evidenciaEscritura, /REGISTRAR_MES_LEGACY_READONLY/);
});

test("L-5 · laboratorioWriteGuard no bloquea nada fuera de una sesión de solo lectura, y bloquea y registra dentro de ella", () => {
  const store = new Map();
  const context = {
    storageKey: (key) => key,
    storageGet: (key, fallback) => (store.has(key) ? store.get(key) : fallback),
    storageSet: (key, value) => store.set(key, value),
    announceStatus: () => {},
    laboratorioReadOnlySession: null,
  };
  vm.createContext(context);
  vm.runInContext(
    `${extractFunction("laboratorioReadOnlyActive")}\n${extractFunction("loadLaboratorioRejectedWrites")}\n${extractFunction("recordLaboratorioRejectedWrite")}\n${extractFunction("laboratorioWriteGuard")}`,
    context,
  );
  assert.equal(context.laboratorioWriteGuard("Acción de prueba"), false, "sin sesión de solo lectura, no bloquea");
  context.laboratorioReadOnlySession = "simulator";
  assert.equal(context.laboratorioWriteGuard("Aplicar proyecto"), true, "con sesión activa, bloquea");
  const history = context.loadLaboratorioRejectedWrites();
  assert.equal(history.length, 1);
  assert.equal(history[0].hash, "simulator");
  assert.equal(history[0].actionLabel, "Aplicar proyecto");
});

test("L-5 · las cinco puertas de escritura reales llaman a laboratorioWriteGuard antes de escribir nada", () => {
  assert.match(extractFunction("setAgentCaixaFloor"), /laboratorioWriteGuard\(/);
  assert.match(extractFunction("applyDebtDecision"), /laboratorioWriteGuard\(/);
  assert.match(extractFunction("applyProjectDecision"), /laboratorioWriteGuard\(/);
  assert.match(extractFunction("addUxAlert"), /laboratorioWriteGuard\(/);
  assert.match(extractFunction("handleSavingsPlanInput"), /laboratorioWriteGuard\(/);
});

test("L-5 · setActiveView limpia la sesión de solo lectura al navegar a otra pantalla", () => {
  assert.match(extractFunction("setActiveView"), /laboratorioReadOnlySession && laboratorioReadOnlySession !== viewId/);
});

test("L-5 · handleLaboratorioOpenReadOnly activa la sesión y navega a la heredada", () => {
  const source = extractFunction("handleLaboratorioOpenReadOnly");
  assert.match(source, /laboratorioReadOnlySession = hash/);
  assert.match(source, /setActiveView\(hash, \{ announce: false \}\)/);
  assert.match(source, /announceStatus\(`Abriendo \$\{hash\} en solo lectura/);
});

test("L-5 · el aviso de solo lectura se anuncia último, no lo tapa el «X abierta.» genérico de setActiveView", () => {
  const source = extractFunction("handleLaboratorioOpenReadOnly");
  const setActiveViewCallIndex = source.indexOf("setActiveView(hash");
  const readOnlyAnnounceIndex = source.indexOf("Abriendo ${hash} en solo lectura");
  assert.ok(setActiveViewCallIndex >= 0 && readOnlyAnnounceIndex >= 0);
  assert.ok(
    readOnlyAnnounceIndex > setActiveViewCallIndex,
    "el announceStatus de solo lectura debe llamarse después de setActiveView para no ser sobrescrito por su propio announceStatus (mismo setTimeout de 10ms)",
  );
});

test("L-5 · las nueve heredadas con guardKey real corresponden a una de las cinco puertas guardadas", () => {
  const valid = new Set(["agentCaixaFloor", "debtDecision", "project", "savingsPlan", "alerts"]);
  realCatalog.filter((entry) => entry.guardKey).forEach((entry) => assert.ok(valid.has(entry.guardKey), `${entry.hash} tiene un guardKey desconocido: ${entry.guardKey}`));
});

// Los valores en sí se unificaron el 20 de agosto (decisión Laboratorio: ver `agentCaixaFloor()` en
// app.js) — `state.operatingReserve` manda cuando está configurado, sin cambiarle la cifra a quien
// solo use las heredadas. Este test sigue vigente porque describe la ficha del catálogo, no la
// unificación en sí: la ficha de estas dos heredadas sigue sin necesitar mencionar Ajustes, ya que
// su guardarraíl de solo lectura (L-5) sigue bloqueando exactamente lo mismo que antes.
test("L-5 · el catálogo no repite el error de confundir agentCaixaFloor con la Reserva operativa de Ajustes", () => {
  ["executive-advisor", "savings-agent"].forEach((hash) => {
    assert.doesNotMatch(byHash(hash).queHacia + byHash(hash).evidenciaEscritura, /Reserva operativa/);
  });
});

test("L-5 · las tres desviaciones del mockup quedan documentadas con su nota (movements, alerts-center, operations-manual)", () => {
  ["movements", "alerts-center", "operations-manual"].forEach((hash) => {
    assert.ok(byHash(hash).nota && byHash(hash).nota.length > 0, `${hash} debe documentar por qué se aparta del mockup`);
  });
});

test("L-5 · movements y alerts-center son adoptada pese a que el mockup las marca de otro modo", () => {
  assert.equal(byHash("movements").veredicto, "adoptada");
  assert.equal(byHash("alerts-center").veredicto, "adoptada");
  assert.ok(byHash("alerts-center").backlogTask, "alerts-center debe llevar una tarea real, no la AJ-3 inexistente del mockup");
  assert.doesNotMatch(byHash("alerts-center").backlogTask, /AJ-3/);
});

test("L-5 · operations-manual es descartada, no sustituida como dice el mockup (AJ-4 no existe)", () => {
  assert.equal(byHash("operations-manual").veredicto, "descartada");
});

// --- L-7 · acta exportable del Laboratorio -------------------------------------------------------------

test("L-7 · laboratorioActaCsvContent lleva BOM, cabecera y una fila por heredada", () => {
  const context = { csvValue: (v) => `"${String(v ?? "").replaceAll('"', '""')}"`, ledgerMonthLabel: (key) => `Mes ${key}` };
  vm.createContext(context);
  vm.runInContext(
    `${extractConst("LABORATORIO_VEREDICTO_LABEL")}\n${extractFunction("laboratorioListRows")}\n${extractFunction("laboratorioDetailFor")}\n${extractFunction("laboratorioActaCsvContent")}`,
    context,
  );
  const csv = context.laboratorioActaCsvContent(realCatalog, { monthKey: "2026-08", fecha: "2026-08-15" });
  assert.equal(csv[0], "﻿");
  const lines = csv.slice(1).split("\r\n");
  assert.equal(lines.length, 19);
  assert.match(lines[0], /Pantalla heredada/);
  assert.match(lines[0], /Qué hacía/);
});

test("L-7 · laboratorioActaPrintHtml incluye la instantánea y una fila por heredada", () => {
  const context = { escapeHtml: (v) => String(v ?? ""), ledgerMonthLabel: (key) => `Mes ${key}`, formatIsoDate: (v) => v };
  vm.createContext(context);
  vm.runInContext(
    `${extractConst("LABORATORIO_VEREDICTO_LABEL")}\n${extractFunction("laboratorioListRows")}\n${extractFunction("laboratorioDetailFor")}\n${extractFunction("laboratorioSnapshotNoteText")}\n${extractFunction("laboratorioActaPrintHtml")}`,
    context,
  );
  const printHtml = context.laboratorioActaPrintHtml(realCatalog, { monthKey: "2026-08", fecha: "2026-08-15", autor: "Javier" });
  assert.match(printHtml, /<h1>Acta del Laboratorio<\/h1>/);
  assert.equal((printHtml.match(/<tr>/g) || []).length, 19);
});

test("L-7 · la descarga CSV y el PDF reutilizan el mismo mecanismo que C-12/A-11, no uno propio", () => {
  assert.match(extractFunction("downloadLaboratorioActaCsv"), /new Blob\(\[content\], \{ type: "text\/csv;charset=utf-8" \}\)/);
  const pdfSource = extractFunction("handleLaboratorioExportPdf");
  assert.match(pdfSource, /qs\("cierrePrintEvidence"\)/);
  assert.match(pdfSource, /is-printing-cierre-evidence/);
});

test("L-7 · los botones de exportar del Laboratorio están cableados", () => {
  assert.match(app, /qs\("laboratorioExportCsv"\)\?\.addEventListener\("click", downloadLaboratorioActaCsv\)/);
  assert.match(app, /qs\("laboratorioExportPdf"\)\?\.addEventListener\("click", handleLaboratorioExportPdf\)/);
});

// --- L-8 · Laboratorio vive dentro de Ajustes -----------------------------------------------------------

test("L-8 · #laboratorioCard existe dentro de #ajustes en index.html", () => {
  const ajustesStart = html.indexOf('id="ajustes"');
  const ajustesEnd = html.indexOf("</section>", ajustesStart);
  const cardIndex = html.indexOf('id="laboratorioCard"');
  assert.ok(ajustesStart >= 0 && cardIndex > ajustesStart && cardIndex < ajustesEnd, "laboratorioCard debe vivir dentro de la sección ajustes");
});

test("L-8 · renderAjustes() orquesta renderAjustesLaboratorio(), igual que hace con Sobres", () => {
  assert.match(extractFunction("renderAjustes"), /renderAjustesLaboratorio\(\);/);
});

test("L-8 · index.html incluye las dos notas fijas del mockup (solo lectura y retirada)", () => {
  assert.match(html, /Solo lectura, sin excepciones/);
  assert.match(html, /Retirada · Fase 7/);
  assert.match(html, /El código de las heredadas se borra del proyecto/);
});

// --- L-9 · retirada al cerrar la fase 7 -------------------------------------------------------------------

test("L-9 · LABORATORIO_PHASE_RETIRED empieza en false: la fase 7 no está cerrada todavía", () => {
  assert.match(app, /const LABORATORIO_PHASE_RETIRED = false;/);
});

test("L-9 · renderAjustesLaboratorio esconde la tarjeta y no pinta nada más si laboratorioRetired() es true", () => {
  const source = extractFunction("renderAjustesLaboratorio");
  assert.match(source, /if \(card\) card\.hidden = laboratorioRetired\(\);/);
  assert.match(source, /if \(laboratorioRetired\(\)\) return;/);
});

// --- L-10 · sin rutas colgando tras la retirada -----------------------------------------------------------

test("L-10 · Laboratorio no tiene hash/ruta propia: ni data-home-nav=\"laboratorio\" ni una sección #laboratorio", () => {
  assert.doesNotMatch(html, /data-home-nav="laboratorio"/);
  assert.doesNotMatch(html, /id="laboratorio"/);
});

test("L-10 · laboratorioHasNoOwnRoute confirma la garantía en tiempo de ejecución", () => {
  const context = {
    REGISTRAR_LEGACY_HASH_TABS: { "update-hub": "balances", "update-data": "actuals", "datos-importar": "import" },
    document: { getElementById: () => null },
  };
  vm.createContext(context);
  vm.runInContext(extractFunction("laboratorioHasNoOwnRoute"), context);
  assert.equal(context.laboratorioHasNoOwnRoute(), true);
});

// --- Cableado general -------------------------------------------------------------------------------------

test("Laboratorio · tarjetas, lista, filtros y detalle seleccionan/navegan/filtran correctamente", () => {
  assert.match(app, /qs\("laboratorioCards"\)\?\.addEventListener\("click", handleLaboratorioContainerClick\)/);
  assert.match(app, /qs\("laboratorioList"\)\?\.addEventListener\("click", handleLaboratorioContainerClick\)/);
  assert.match(app, /qs\("laboratorioDetail"\)\?\.addEventListener\("click", handleLaboratorioContainerClick\)/);
  assert.match(app, /qs\("laboratorioFilters"\)\?\.addEventListener\("click"/);
});

test("Laboratorio · handleLaboratorioFilter y handleLaboratorioViewMode validan su entrada antes de cambiar estado", () => {
  const filterSource = extractFunction("handleLaboratorioFilter");
  assert.match(filterSource, /LABORATORIO_FILTROS\.includes\(filtro\)/);
  const viewSource = extractFunction("handleLaboratorioViewMode");
  assert.match(viewSource, /mode !== "tarjetas" && mode !== "lista"/);
});
