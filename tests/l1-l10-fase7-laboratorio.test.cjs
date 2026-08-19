const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

// Fase 7 · Laboratorio (docs/BACKLOG_NUEVE_PANTALLAS.md §09): catálogo canónico de las dieciocho
// pantallas heredadas del rediseño a seis vistas, cada una con un veredicto cerrado — adoptada,
// sustituida o descartada, nunca «candidata» (L-1) — vista de lista con destino (L-6), regla de que
// «adoptada» exige tarea de backlog (L-2), panel de detalle (L-3), instantánea fechada del último
// cierre (L-4), evidencia real de bloqueo de escritura (L-5), acta exportable en CSV/PDF (L-7),
// todo dentro de Ajustes (L-8), con su propio mecanismo de retirada al cerrar la fase 7 (L-9) sin
// dejar rutas colgando (L-10).

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

// --- L-1 · tres veredictos cerrados, ninguno abierto ----------------------------------------------

test("L-1 · el catálogo tiene las dieciocho heredadas del rediseño (BACKLOG.md, 18 heredadas)", () => {
  assert.equal(realCatalog.length, 18);
});

test("L-1 · laboratorioOpenVerdicts no encuentra ningún veredicto abierto en el catálogo real", () => {
  const context = {};
  vm.createContext(context);
  vm.runInContext(`${extractConst("LABORATORIO_VEREDICTOS")}\n${extractFunction("laboratorioOpenVerdicts")}`, context);
  assert.equal(context.laboratorioOpenVerdicts(realCatalog).length, 0);
});

test("L-1 · laboratorioOpenVerdicts sí detecta una entrada sin veredicto válido (guardarraíl real, no de fe)", () => {
  const context = {};
  vm.createContext(context);
  vm.runInContext(`${extractConst("LABORATORIO_VEREDICTOS")}\n${extractFunction("laboratorioOpenVerdicts")}`, context);
  const fake = [{ hash: "x", veredicto: "candidata" }];
  assert.equal(context.laboratorioOpenVerdicts(fake).length, 1);
});

test("L-1 · laboratorioVerdictSummary cuenta los tres veredictos y no deja ninguno fuera", () => {
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

test("L-2 · el guardarraíl sí detecta una adoptada sin tarea (no es un adorno)", () => {
  const context = {};
  vm.createContext(context);
  vm.runInContext(extractFunction("laboratorioAdoptedWithoutTask"), context);
  const fake = [{ hash: "x", veredicto: "adoptada", backlogTask: null }];
  assert.equal(context.laboratorioAdoptedWithoutTask(fake).length, 1);
});

test("L-2 · hay al menos una heredada adoptada en el catálogo real (el guardarraíl no está vacío por casualidad)", () => {
  assert.ok(realCatalog.some((entry) => entry.veredicto === "adoptada"));
});

// --- L-6 · vista de lista con los destinos ----------------------------------------------------------

test("L-6 · laboratorioListRows devuelve una fila por heredada, con destino solo si es sustituida", () => {
  const context = {};
  vm.createContext(context);
  vm.runInContext(extractFunction("laboratorioListRows"), context);
  const rows = context.laboratorioListRows(realCatalog);
  assert.equal(rows.length, 18);
  rows.forEach((row) => {
    if (row.veredicto === "sustituida") assert.ok(row.destino && row.destino.hash, `${row.hash} sustituida debería tener destino`);
  });
});

test("L-6 · laboratorioListHtml pinta el veredicto y el destino de cada fila, con enlace real", () => {
  const context = { escapeHtml: (v) => String(v) };
  vm.createContext(context);
  vm.runInContext(`${extractConst("LABORATORIO_VEREDICTO_LABEL")}\n${extractConst("LABORATORIO_VEREDICTO_BADGE")}\n${extractFunction("laboratorioListHtml")}`, context);
  const rows = [
    { hash: "simulator", label: "Simulador", veredicto: "sustituida", destino: { hash: "escenario-simular", label: "Escenarios · Simular" } },
    { hash: "movements", label: "Movimientos (heredada original)", veredicto: "adoptada", destino: null },
  ];
  const out = context.laboratorioListHtml(rows, "simulator");
  assert.match(out, /Sustituida/);
  assert.match(out, /data-home-nav="escenario-simular"/);
  assert.match(out, /Adoptada/);
  assert.match(out, /class="[^"]*is-selected[^"]*"/);
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

test("L-3 · laboratorioDetailHtml muestra motivo, destino, tarea de backlog y estado de escritura", () => {
  const context = { escapeHtml: (v) => String(v) };
  vm.createContext(context);
  vm.runInContext(`${extractConst("LABORATORIO_VEREDICTO_LABEL")}\n${extractConst("LABORATORIO_VEREDICTO_BADGE")}\n${extractFunction("laboratorioDetailHtml")}`, context);
  const entry = { hash: "simulator", label: "Simulador", veredicto: "sustituida", motivo: "Motivo de prueba", destino: { hash: "escenario-simular", label: "Escenarios · Simular" }, backlogTask: "E-14", writeBlocked: false, evidenciaBloqueo: "Pendiente de verdad" };
  const out = context.laboratorioDetailHtml(entry);
  assert.match(out, /Motivo de prueba/);
  assert.match(out, /E-14/);
  assert.match(out, /data-home-nav="escenario-simular"/);
  assert.match(out, /⚠ Sin confirmar/);
  assert.match(out, /Pendiente de verdad/);
  assert.match(context.laboratorioDetailHtml(null), /Elige una pantalla heredada/);
});

// --- L-4 · instantánea fechada del último cierre -----------------------------------------------------

test("L-4 · laboratorioSnapshotContext toma el último cierre vigente y firmado, no el reabierto ni el más reciente sin firmar", () => {
  const context = {
    ledgerMonthLabel: (key) => `Mes ${key}`,
    cierreVersionRows: (closures) =>
      closures.map((op) => ({
        monthKey: op.monthKey,
        fecha: op.occurredAt,
        autor: op.author,
        estado: op.status,
        vigente: op.vigente,
      })),
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

test("L-5 · toda entrada del catálogo real declara writeBlocked y su evidencia, ninguna se queda sin documentar", () => {
  realCatalog.forEach((entry) => {
    assert.equal(typeof entry.writeBlocked, "boolean", `${entry.hash} debe declarar writeBlocked`);
    assert.ok(entry.evidenciaBloqueo && entry.evidenciaBloqueo.length > 0, `${entry.hash} debe documentar su evidencia`);
  });
});

test("L-5 · visual-detail y update-data documentan su bloqueo real (R-11), no una suposición", () => {
  const visualDetail = realCatalog.find((entry) => entry.hash === "visual-detail");
  const updateData = realCatalog.find((entry) => entry.hash === "update-data");
  assert.equal(visualDetail.writeBlocked, true);
  assert.match(visualDetail.evidenciaBloqueo, /VISUAL_DETAIL_BALANCE_LEGACY_READONLY/);
  assert.equal(updateData.writeBlocked, true);
  assert.match(updateData.evidenciaBloqueo, /REGISTRAR_MES_LEGACY_READONLY/);
});

test("L-5 · executive-advisor/savings-agent/debt-control/simulator son adoptada, no sustituida: sus datos no tienen sustituto real, aunque pantallas nuevas ya los lean", () => {
  ["executive-advisor", "savings-agent", "debt-control", "simulator"].forEach((hash) => {
    const entry = realCatalog.find((item) => item.hash === hash);
    assert.equal(entry.veredicto, "adoptada", `${hash} debe ser adoptada: ninguna pantalla nueva escribe su dato, solo lo leen`);
    assert.equal(entry.destino, null, `${hash} adoptada no debe llevar destino inventado`);
    assert.equal(entry.writeBlocked, true, `${hash} sigue siendo la puerta legítima, no un hueco de R-11`);
    assert.ok(entry.backlogTask, `${hash} adoptada exige tarea de backlog (L-2)`);
  });
});

test("L-5 · el catálogo no vuelve a repetir el error de confundir agentCaixaFloor con la Reserva operativa de Ajustes", () => {
  ["executive-advisor", "savings-agent"].forEach((hash) => {
    const entry = realCatalog.find((item) => item.hash === hash);
    assert.doesNotMatch(entry.motivo, /Ajustes › Reserva operativa que ya es la puerta/);
  });
});

test("L-5 · alerts-center es adoptada (sigue siendo la puerta real de los umbrales de aviso), no una sustituida a medio bloquear", () => {
  const entry = realCatalog.find((item) => item.hash === "alerts-center");
  assert.equal(entry.veredicto, "adoptada");
  assert.equal(entry.writeBlocked, true);
  assert.ok(entry.backlogTask);
});

// --- L-7 · acta exportable del Laboratorio -------------------------------------------------------------

test("L-7 · laboratorioActaCsvContent lleva BOM, cabecera y una fila por heredada", () => {
  const context = {
    csvValue: (v) => `"${String(v ?? "").replaceAll('"', '""')}"`,
    ledgerMonthLabel: (key) => `Mes ${key}`,
  };
  vm.createContext(context);
  vm.runInContext(
    `${extractConst("LABORATORIO_VEREDICTO_LABEL")}\n${extractFunction("laboratorioListRows")}\n${extractFunction("laboratorioDetailFor")}\n${extractFunction("laboratorioActaCsvContent")}`,
    context,
  );
  const csv = context.laboratorioActaCsvContent(realCatalog, { monthKey: "2026-08", fecha: "2026-08-15" });
  assert.equal(csv[0], "﻿");
  const lines = csv.slice(1).split("\r\n");
  assert.equal(lines.length, 19); // cabecera + 18 heredadas
  assert.match(lines[0], /Pantalla heredada/);
});

test("L-7 · laboratorioActaPrintHtml incluye la instantánea y una fila por heredada", () => {
  const context = {
    escapeHtml: (v) => String(v),
    ledgerMonthLabel: (key) => `Mes ${key}`,
    formatIsoDate: (v) => v,
  };
  vm.createContext(context);
  vm.runInContext(
    `${extractConst("LABORATORIO_VEREDICTO_LABEL")}\n${extractFunction("laboratorioListRows")}\n${extractFunction("laboratorioDetailFor")}\n${extractFunction("laboratorioSnapshotNoteText")}\n${extractFunction("laboratorioActaPrintHtml")}`,
    context,
  );
  const printHtml = context.laboratorioActaPrintHtml(realCatalog, { monthKey: "2026-08", fecha: "2026-08-15", autor: "Javier" });
  assert.match(printHtml, /<h1>Acta del Laboratorio<\/h1>/);
  assert.equal((printHtml.match(/<tr>/g) || []).length, 19); // cabecera + 18 heredadas
});

test("L-7 · la descarga CSV y el PDF reutilizan el mismo mecanismo que C-12/A-11, no uno propio", () => {
  const csvSource = extractFunction("downloadLaboratorioActaCsv");
  assert.match(csvSource, /new Blob\(\[content\], \{ type: "text\/csv;charset=utf-8" \}\)/);
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
  const source = extractFunction("renderAjustes");
  assert.match(source, /renderAjustesLaboratorio\(\);/);
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

test("Laboratorio · el clic en la lista y en el detalle seleccionan la heredada o navegan al destino", () => {
  assert.match(app, /qs\("laboratorioList"\)\?\.addEventListener\("click", handleLaboratorioContainerClick\)/);
  assert.match(app, /qs\("laboratorioDetail"\)\?\.addEventListener\("click", handleLaboratorioContainerClick\)/);
});
