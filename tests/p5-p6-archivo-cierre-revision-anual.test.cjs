const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

// #5/#6 del "plan de mejora corregido" (28/08/2026, ver BACKLOG.md §9), ola 2 — encadenadas: #5
// ("Archivo automático del informe de cierre") archiva localmente el mismo informe que V6-4 ya
// generaba a mano desde Ajustes (`ajustesExportMonthLines`/`registrarMesCollect`/
// `registrarMesTotals`, reutilizados tal cual). #6 ("Ritual de revisión anual") agrega los doce
// informes que #5 archiva y sugiere el presupuesto por categoría del año siguiente reutilizando
// `CanonicalBudgetAnalyzer.analyzeCategory` (S-1), sin motor nuevo en ningún caso. Mismo patrón
// local que C-13 (`cierre-aprendizaje`) y D-2b: no toca el RPC transaccional de cierre ni el
// esquema remoto de Supabase.

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

function baseContext(extra = {}) {
  return {
    escapeHtml: (v) => String(v ?? ""),
    money: (v) => `€${v}`,
    round2: (v) => Math.round((Number(v || 0) + Number.EPSILON) * 100) / 100,
    formatIsoDate: (v) => v,
    ...extra,
  };
}

function storageStub() {
  const store = new Map();
  return {
    storageKey: (key) => key,
    storageGet: (key, fallback) => (store.has(key) ? store.get(key) : fallback),
    storageSet: (key, value) => store.set(key, value),
    _store: store,
  };
}

function sandboxWith(names, extra = {}) {
  const context = baseContext(extra);
  vm.createContext(context);
  vm.runInContext(names.map((name) => extractFunction(name)).join("\n"), context);
  return context;
}

// --- #5 · recordCierreReportArchive -----------------------------------------------------------

test("#5 · recordCierreReportArchive reutiliza registrarMesCollect/registrarMesTotals/ajustesExportMonthLines (V6-4), no un exportador nuevo", () => {
  const source = extractFunction("recordCierreReportArchive");
  assert.match(source, /registrarMesCollect\(monthObj\)/);
  assert.match(source, /registrarMesTotals\(entries\)/);
  assert.match(source, /ajustesExportMonthLines\(monthObj, entries, totals\)/);
});

test("#5 · guarda un informe por mes, sin duplicar si el mismo mes se cierra otra vez (reabierto y vuelto a firmar)", () => {
  const storage = storageStub();
  const context = sandboxWith(["loadCierreReportArchive", "saveCierreReportArchive", "recordCierreReportArchive"], {
    ...storage,
    cuadroMandosAllMonths: () => [{ key: "2026-07", label: "Julio" }],
    registrarMesCollect: () => ({ income: [{ label: "Nómina" }], expense: [] }),
    registrarMesTotals: () => ({ incomeUsed: 1800, incomePlanned: 1800, expenseUsed: 0, expensePlanned: 0, captured: 1, lines: 1 }),
    ajustesExportMonthLines: () => ["RESUMEN DEL MES - JULIO"],
  });
  context.recordCierreReportArchive("2026-07", "2026-08-19T10:00:00.000Z");
  context.recordCierreReportArchive("2026-07", "2026-08-19T12:00:00.000Z");
  const archive = context.loadCierreReportArchive();
  assert.equal(archive.length, 1);
  assert.equal(archive[0].closedAt, "2026-08-19T12:00:00.000Z");
  assert.deepEqual([...archive[0].pdfLines], ["RESUMEN DEL MES - JULIO"]);
});

test("#5 · un mes sin ninguna partida de ingreso o gasto no se archiva (nada que archivar todavía)", () => {
  const storage = storageStub();
  const context = sandboxWith(["loadCierreReportArchive", "saveCierreReportArchive", "recordCierreReportArchive"], {
    ...storage,
    cuadroMandosAllMonths: () => [{ key: "2026-07", label: "Julio" }],
    registrarMesCollect: () => ({ income: [], expense: [] }),
  });
  context.recordCierreReportArchive("2026-07", "2026-08-19T10:00:00.000Z");
  assert.equal(context.loadCierreReportArchive().length, 0);
});

test("#5 · el informe archivado guarda `totals` estructurados, no solo el texto ya formateado del PDF", () => {
  const storage = storageStub();
  const context = sandboxWith(["loadCierreReportArchive", "saveCierreReportArchive", "recordCierreReportArchive"], {
    ...storage,
    cuadroMandosAllMonths: () => [{ key: "2026-07", label: "Julio" }],
    registrarMesCollect: () => ({ income: [{ label: "Nómina" }], expense: [] }),
    registrarMesTotals: () => ({ incomeUsed: 1800, incomePlanned: 1750, expenseUsed: 900, expensePlanned: 1000, captured: 3, lines: 4 }),
    ajustesExportMonthLines: () => [],
  });
  context.recordCierreReportArchive("2026-07", "2026-08-19T10:00:00.000Z");
  const [entry] = context.loadCierreReportArchive();
  assert.deepEqual({ ...entry.totals }, { incomeUsed: 1800, incomePlanned: 1750, expenseUsed: 900, expensePlanned: 1000, captured: 3, lines: 4 });
});

test("#5 · closeCurrentMonthTransaction llama a recordCierreReportArchive tras cerrar, sin tocar el RPC transaccional", () => {
  const source = extractFunction("closeCurrentMonthTransaction");
  assert.match(source, /recordCierreReportArchive\(month, closedAt\);/);
});

// --- #5 · descarga y render del archivo -----------------------------------------------------

test("#5 · handleCierreReportArchiveDownload descarga exactamente las líneas archivadas, sin recalcular nada", () => {
  const calls = [];
  const context = sandboxWith(["handleCierreReportArchiveDownload"], {
    loadCierreReportArchive: () => [{ monthKey: "2026-07", pdfLines: ["línea archivada, no recalculada"] }],
    registrarMesLongMonth: () => "julio de 2026",
    announceStatus: (message) => calls.push(message),
    window: { P2Export: { downloadPlainPdf: (lines, name) => calls.push(["downloadPlainPdf", [...lines], name]) } },
  });
  context.handleCierreReportArchiveDownload("2026-07");
  assert.deepEqual(calls, [
    ["downloadPlainPdf", ["línea archivada, no recalculada"], "resumen-mes-2026-07.pdf"],
    "PDF archivado de julio de 2026 descargado.",
  ]);
});

test("#5 · descargar un mes que no está en el archivo no hace nada", () => {
  const calls = [];
  const context = sandboxWith(["handleCierreReportArchiveDownload"], {
    loadCierreReportArchive: () => [],
    window: { P2Export: { downloadPlainPdf: () => calls.push("downloadPlainPdf") } },
    announceStatus: () => calls.push("announceStatus"),
  });
  context.handleCierreReportArchiveDownload("2026-07");
  assert.deepEqual(calls, []);
});

test("#5 · renderCierreReportArchive pinta un botón de descarga por mes archivado, con su fecha de firma", () => {
  const list = { innerHTML: "" };
  const empty = { hidden: false };
  const context = sandboxWith(["renderCierreReportArchive"], {
    qs: (id) => ({ cierreReportArchiveList: list, cierreReportArchiveEmpty: empty }[id] || null),
    loadCierreReportArchive: () => [{ monthKey: "2026-07", closedAt: "2026-08-19T10:00:00.000Z" }],
    registrarMesLongMonth: () => "julio de 2026",
  });
  context.renderCierreReportArchive();
  assert.equal(empty.hidden, true);
  assert.match(list.innerHTML, /julio de 2026/);
  assert.match(list.innerHTML, /data-cierre-report-download="2026-07"/);
  assert.match(list.innerHTML, /Descargar PDF/);
});

test("#5 · sin ningún mes archivado, el aviso de vacío se muestra y la lista queda vacía", () => {
  const list = { innerHTML: "algo de antes" };
  const empty = { hidden: true };
  const context = sandboxWith(["renderCierreReportArchive"], {
    qs: (id) => ({ cierreReportArchiveList: list, cierreReportArchiveEmpty: empty }[id] || null),
    loadCierreReportArchive: () => [],
  });
  context.renderCierreReportArchive();
  assert.equal(empty.hidden, false);
  assert.equal(list.innerHTML, "");
});

// --- #5 · HTML y cableado ------------------------------------------------------------------------

test("#5 · Ajustes trae la lista de informes archivados con su aviso de vacío", () => {
  assert.match(html, /<ul class="cierre-report-archive-list" id="cierreReportArchiveList"><\/ul>/);
  assert.match(html, /<p class="e19-kpi-note" id="cierreReportArchiveEmpty" hidden>Todavía no hay ningún mes firmado\.<\/p>/);
});

test("Cableado · el clic en «Descargar PDF» de un informe archivado llama a handleCierreReportArchiveDownload", () => {
  assert.match(
    app,
    /const downloadButton = event\.target\.closest\("\[data-cierre-report-download\]"\);\s*\n\s*if \(downloadButton\) \{\s*\n\s*handleCierreReportArchiveDownload\(downloadButton\.dataset\.cierreReportDownload\);/,
  );
});

test("Cableado · renderAjustes pinta el archivo de informes", () => {
  const source = extractFunction("renderAjustes");
  assert.match(source, /renderCierreReportArchive\(\);/);
});

// --- #6 · cierreReportArchiveYearProgress / annualReviewReadyYear --------------------------------

test("#6 · cierreReportArchiveYearProgress agrupa los meses archivados por año", () => {
  const context = sandboxWith(["cierreReportArchiveYearProgress"], {
    loadCierreReportArchive: () => [
      { monthKey: "2026-01" }, { monthKey: "2026-02" }, { monthKey: "2025-12" },
    ],
  });
  const byYear = context.cierreReportArchiveYearProgress();
  assert.deepEqual([...byYear.get("2026")].sort(), ["2026-01", "2026-02"]);
  assert.deepEqual([...byYear.get("2025")], ["2025-12"]);
});

function twelveMonthsOf(year) {
  return Array.from({ length: 12 }, (_, index) => ({ monthKey: `${year}-${String(index + 1).padStart(2, "0")}` }));
}

test("#6 · annualReviewReadyYear devuelve null si ningún año tiene los doce meses archivados", () => {
  const context = sandboxWith(["cierreReportArchiveYearProgress", "annualReviewReadyYear"], {
    loadCierreReportArchive: () => twelveMonthsOf("2026").slice(0, 11),
  });
  assert.equal(context.annualReviewReadyYear(), null);
});

test("#6 · annualReviewReadyYear devuelve el año en cuanto sus doce meses están archivados", () => {
  const context = sandboxWith(["cierreReportArchiveYearProgress", "annualReviewReadyYear"], {
    loadCierreReportArchive: () => twelveMonthsOf("2026"),
  });
  assert.equal(context.annualReviewReadyYear(), "2026");
});

test("#6 · con dos años completos, se queda con el más reciente", () => {
  const context = sandboxWith(["cierreReportArchiveYearProgress", "annualReviewReadyYear"], {
    loadCierreReportArchive: () => [...twelveMonthsOf("2025"), ...twelveMonthsOf("2026")],
  });
  assert.equal(context.annualReviewReadyYear(), "2026");
});

// --- #6 · annualReviewSummary ----------------------------------------------------------------------

test("#6 · annualReviewSummary devuelve null si no hay exactamente doce meses archivados de ese año", () => {
  const context = sandboxWith(["annualReviewSummary"], { loadCierreReportArchive: () => twelveMonthsOf("2026").slice(0, 5) });
  assert.equal(context.annualReviewSummary("2026"), null);
});

test("#6 · annualReviewSummary suma los totales de los doce informes archivados", () => {
  const months = twelveMonthsOf("2026").map((entry, index) => ({
    ...entry,
    totals: { incomeUsed: 1000 + index, incomePlanned: 1000, expenseUsed: 800, expensePlanned: 800 },
  }));
  const context = sandboxWith(["annualReviewSummary"], { loadCierreReportArchive: () => months });
  const summary = context.annualReviewSummary("2026");
  assert.equal(summary.year, "2026");
  assert.equal(summary.months.length, 12);
  assert.equal(summary.totals.incomeUsed, 12066); // 12*1000 + (0+1+...+11)
  assert.equal(summary.totals.incomePlanned, 12000);
  assert.equal(summary.totals.expenseUsed, 9600);
  assert.equal(summary.totals.expensePlanned, 9600);
});

// --- #6 · annualReviewCategorySuggestions -----------------------------------------------------

test("#6 · annualReviewCategorySuggestions reutiliza CanonicalBudgetAnalyzer.analyzeCategory (S-1), no un motor nuevo", () => {
  const source = extractFunction("annualReviewCategorySuggestions");
  assert.match(source, /analyzer\.analyzeCategory\(yearRows, \{ months: 12 \}\)/);
});

test("#6 · sin FinanceCanonicalBudgetAnalyzer cargado, no hay sugerencias que fabricar", () => {
  const context = sandboxWith(["annualReviewCategorySuggestions"], {
    budgetNegativeTransactionsByCategory: () => new Map([["Alimentación", []]]),
    window: {},
  });
  assert.deepEqual([...context.annualReviewCategorySuggestions("2026")], []);
});

test("#6 · filtra las transacciones de la categoría al año pedido antes de analizarlas", () => {
  const seen = [];
  const context = sandboxWith(["annualReviewCategorySuggestions"], {
    budgetNegativeTransactionsByCategory: () =>
      new Map([["Alimentación", [{ month: "2025-12", amount: -50 }, { month: "2026-01", amount: -60 }, { month: "2026-02", amount: -70 }]]]),
    window: {
      FinanceCanonicalBudgetAnalyzer: {
        CanonicalBudgetAnalyzer: {
          analyzeCategory: (rows) => {
            seen.push(rows.map((row) => row.month));
            return { average: 65, recommendation: 70, confidence: "high" };
          },
        },
      },
    },
  });
  const suggestions = context.annualReviewCategorySuggestions("2026");
  assert.deepEqual(seen, [["2026-01", "2026-02"]]);
  assert.deepEqual(
    Array.from(suggestions, (item) => ({ ...item })),
    [{ category: "Alimentación", average: 65, recommendation: 70, confidence: "high" }],
  );
});

test("#6 · ordena las sugerencias por importe recomendado descendente y respeta el límite", () => {
  const context = sandboxWith(["annualReviewCategorySuggestions"], {
    budgetNegativeTransactionsByCategory: () =>
      new Map([
        ["Alimentación", [{ month: "2026-01", amount: -1 }]],
        ["Ocio", [{ month: "2026-01", amount: -1 }]],
        ["Transporte", [{ month: "2026-01", amount: -1 }]],
      ]),
    window: {
      FinanceCanonicalBudgetAnalyzer: {
        CanonicalBudgetAnalyzer: {
          analyzeCategory: (rows, options) => ({
            recommendation: rows[0]?.amount === -1 ? 100 : 0,
            average: 90,
            confidence: "medium",
            _months: options.months,
          }),
        },
      },
    },
  });
  const suggestions = context.annualReviewCategorySuggestions("2026", 2);
  assert.equal(suggestions.length, 2);
  assert.equal(suggestions[0]._months, 12);
});

// --- #6 · renderAnnualReview -------------------------------------------------------------------

test("#6 · sin ningún año completo, muestra el progreso del año con más meses archivados", () => {
  const container = { hidden: false, innerHTML: "algo" };
  const note = { hidden: true, textContent: "" };
  const context = sandboxWith(["renderAnnualReview"], {
    qs: (id) => ({ annualReviewContent: container, annualReviewProgressNote: note }[id] || null),
    annualReviewReadyYear: () => null,
    cierreReportArchiveYearProgress: () => new Map([["2026", new Set(["2026-01", "2026-02", "2026-03"])]]),
  });
  context.renderAnnualReview();
  assert.equal(container.hidden, true);
  assert.equal(container.innerHTML, "");
  assert.equal(note.hidden, false);
  assert.equal(note.textContent, "Revisión anual de 2026: 3/12 meses archivados todavía.");
});

test("#6 · sin ningún mes archivado en absoluto, el aviso lo dice explícitamente en vez de un progreso 0/12", () => {
  const container = { hidden: false, innerHTML: "" };
  const note = { hidden: true, textContent: "" };
  const context = sandboxWith(["renderAnnualReview"], {
    qs: (id) => ({ annualReviewContent: container, annualReviewProgressNote: note }[id] || null),
    annualReviewReadyYear: () => null,
    cierreReportArchiveYearProgress: () => new Map(),
  });
  context.renderAnnualReview();
  assert.match(note.textContent, /Todavía no hay ningún mes archivado/);
});

test("#6 · con un año completo, muestra el resumen y la tabla de sugerencias", () => {
  const container = { hidden: true, innerHTML: "" };
  const note = { hidden: false };
  const context = sandboxWith(["renderAnnualReview"], {
    qs: (id) => ({ annualReviewContent: container, annualReviewProgressNote: note }[id] || null),
    annualReviewReadyYear: () => "2026",
    annualReviewSummary: () => ({ totals: { incomeUsed: 60000, incomePlanned: 58000, expenseUsed: 45000, expensePlanned: 46000 } }),
    annualReviewCategorySuggestions: () => [{ category: "Alimentación", average: 350, recommendation: 400, confidence: "high" }],
  });
  vm.runInContext(extractConst("ANNUAL_REVIEW_CONFIDENCE_LABELS"), context);
  context.renderAnnualReview();
  assert.equal(container.hidden, false);
  assert.equal(note.hidden, true);
  assert.match(container.innerHTML, /2026/);
  assert.match(container.innerHTML, /Alimentación/);
  assert.match(container.innerHTML, /2027/); // sugerido para el año siguiente
});

test("#6 · con un año completo pero ninguna categoría con datos suficientes, lo dice en vez de una tabla vacía", () => {
  const container = { hidden: true, innerHTML: "" };
  const note = { hidden: false };
  const context = sandboxWith(["renderAnnualReview"], {
    qs: (id) => ({ annualReviewContent: container, annualReviewProgressNote: note }[id] || null),
    annualReviewReadyYear: () => "2026",
    annualReviewSummary: () => ({ totals: { incomeUsed: 0, incomePlanned: 0, expenseUsed: 0, expensePlanned: 0 } }),
    annualReviewCategorySuggestions: () => [],
  });
  context.renderAnnualReview();
  assert.match(container.innerHTML, /Ninguna categoría tiene datos suficientes/);
});

// --- #6 · HTML y cableado --------------------------------------------------------------------------

test("#6 · Ajustes trae la tarjeta de revisión anual, con su nota de progreso y su contenido ocultos por defecto", () => {
  assert.match(html, /<p class="e19-kpi-note" id="annualReviewProgressNote" hidden><\/p>/);
  assert.match(html, /<div id="annualReviewContent" hidden><\/div>/);
});

test("Cableado · renderAjustes pinta la revisión anual", () => {
  const source = extractFunction("renderAjustes");
  assert.match(source, /renderAnnualReview\(\);/);
});
