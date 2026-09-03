const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const app = read("app.js") + "\n" + read("views/presupuesto-mes.js");
const html = read("index.html");

// INTEG-1 (FASE 6): exportar todos los presupuestos guardados (todas las categorías y meses) a CSV
// o JSON, con el gasto real y la desviación de cada uno vía budgetAlertForRow (ya probado en otros
// ficheros) — aquí se mockea para no reconstruir toda su cadena de dependencias.

function extractFunction(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `No existe la función ${name} en app.js/views/presupuesto-mes.js`);
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

function linkMock() {
  return { style: {}, click() {}, remove() {} };
}

function sandbox({ budgetsData = [], alerts = {} } = {}) {
  const announcements = [];
  const blobs = [];
  const links = [];
  const context = {
    budgets: budgetsData,
    csvValue: (value) => `"${String(value === null || value === undefined ? "" : value).replaceAll('"', '""')}"`,
    budgetAlertForRow: (budget) =>
      alerts[`${budget.categoryId}|${budget.monthYear}`] || { status: "on-track", metrics: { spent: 0, deviationPercent: 0 } },
    // BUD-2: budgetsExportRows ahora resuelve presupuestos semanales vía budgetWeekAlertForRow y
    // muestra el nombre del objetivo en vez del `categoryId` en bruto — ninguna fixture de INTEG-1
    // usa ninguna de las dos cosas, así que basta con mocks mínimos (identidad / no-llamado).
    budgetWeekAlertForRow: () => { throw new Error("no fixture de INTEG-1 es semanal"); },
    budgetRowDisplayLabel: (categoryId) => categoryId,
    announceStatus: (text) => announcements.push(text),
    Blob: class {
      constructor(parts, options) {
        this.parts = parts;
        this.options = options;
        blobs.push(this);
      }
    },
    URL: { createObjectURL: (blob) => { blob.objectUrl = "blob:mock"; return "blob:mock"; }, revokeObjectURL: () => {} },
    document: {
      createElement: () => {
        const link = linkMock();
        links.push(link);
        return link;
      },
      body: { appendChild: () => {} },
    },
    window: { setTimeout: (fn) => fn() },
  };
  vm.createContext(context);
  vm.runInContext(
    ["budgetExportPeriodKey", "budgetsExportRows", "downloadBudgetsCsv", "downloadBudgetsJson"].map(extractFunction).join("\n"),
    context,
    { filename: "app.js#integ1-exportar-presupuestos" },
  );
  return { context, announcements, blobs, links };
}

const SAMPLE_BUDGETS = [
  { categoryId: "ocio", monthYear: "2026-09", amountCap: 150, source: "manual", currency: "EUR" },
  { categoryId: "comida", monthYear: "2026-08", amountCap: 300, source: "suggested", currency: "EUR" },
  { categoryId: "agua", monthYear: "2026-08", amountCap: 40, source: "manual", currency: "EUR" },
];

const SAMPLE_ALERTS = {
  "ocio|2026-09": { status: "overspend", metrics: { spent: 180, deviationPercent: 20 } },
  "comida|2026-08": { status: "on-track", metrics: { spent: 290, deviationPercent: -3 } },
  "agua|2026-08": { status: "underspend", metrics: { spent: 20, deviationPercent: -50 } },
};

test("INTEG-1 · budgetsExportRows ordena por mes y luego por categoría, con gasto y desviación reales", () => {
  const { context } = sandbox({ budgetsData: SAMPLE_BUDGETS, alerts: SAMPLE_ALERTS });
  const rows = context.budgetsExportRows();
  // Array.from (realm de este test) evita comparar un array construido dentro del vm, con su propio
  // Array.prototype, que deepEqual rechaza por prototipo distinto aunque el contenido sea idéntico.
  assert.deepEqual(
    Array.from(rows, (r) => `${r.mes}|${r.categoria}`),
    ["2026-08|agua", "2026-08|comida", "2026-09|ocio"],
  );
  const ocio = rows.find((r) => r.categoria === "ocio");
  assert.equal(ocio.presupuesto, 150);
  assert.equal(ocio.gastado, 180);
  assert.equal(ocio.desviacion_pct, 20);
  assert.equal(ocio.estado, "overspend");
  assert.equal(ocio.origen, "manual");
  assert.equal(ocio.moneda, "EUR");
});

test("INTEG-1 · sin presupuestos guardados, exportar no falla y da 0 filas", () => {
  const { context } = sandbox({ budgetsData: [] });
  assert.equal(Array.from(context.budgetsExportRows()).length, 0);
});

test("INTEG-1 · exportar a CSV descarga un fichero con cabecera, BOM y una fila por presupuesto", () => {
  const { context, announcements, blobs, links } = sandbox({ budgetsData: SAMPLE_BUDGETS, alerts: SAMPLE_ALERTS });
  context.downloadBudgetsCsv();
  assert.equal(blobs.length, 1);
  assert.equal(blobs[0].options.type, "text/csv;charset=utf-8");
  const csvContent = blobs[0].parts[0];
  assert.ok(csvContent.startsWith("﻿"), "el CSV debe llevar BOM para abrirse bien en Excel");
  const lines = csvContent.replace("﻿", "").split("\r\n");
  assert.match(lines[0], /Mes.*Categoria.*Presupuesto.*Gastado/);
  assert.equal(lines.length, 1 + SAMPLE_BUDGETS.length);
  assert.ok(lines.some((line) => line.includes("ocio") && line.includes("180") && line.includes("overspend")));
  assert.equal(links.length, 1);
  assert.equal(links[0].download, "presupuestos.csv");
  assert.match(announcements[0], /Presupuestos exportados a CSV \(3 filas\)/);
});

test("INTEG-1 · exportar a JSON descarga un array válido con un objeto por presupuesto", () => {
  const { context, announcements, blobs, links } = sandbox({ budgetsData: SAMPLE_BUDGETS, alerts: SAMPLE_ALERTS });
  context.downloadBudgetsJson();
  assert.equal(blobs.length, 1);
  assert.equal(blobs[0].options.type, "application/json;charset=utf-8");
  const parsed = JSON.parse(blobs[0].parts[0]);
  assert.equal(parsed.length, SAMPLE_BUDGETS.length);
  assert.equal(parsed.find((r) => r.categoria === "comida").gastado, 290);
  assert.equal(links[0].download, "presupuestos.json");
  assert.match(announcements[0], /Presupuestos exportados a JSON \(3 filas\)/);
});

test("INTEG-1 · exportar con un único presupuesto anuncia en singular", () => {
  const { announcements: csvAnnouncements } = (() => {
    const s = sandbox({ budgetsData: [SAMPLE_BUDGETS[0]], alerts: SAMPLE_ALERTS });
    s.context.downloadBudgetsCsv();
    return s;
  })();
  assert.match(csvAnnouncements[0], /Presupuestos exportados a CSV \(1 fila\)\./);
});

test("INTEG-1 · los botones de exportar viven en Presupuesto del mes y se piden desde app.js", () => {
  assert.match(app, /data-presupuesto-mes-export-csv/);
  assert.match(app, /data-presupuesto-mes-export-json/);
  assert.match(app, /if \(event\.target\.closest\("\[data-presupuesto-mes-export-csv\]"\)\) \{ downloadBudgetsCsv\(\); return; \}/);
  assert.match(app, /if \(event\.target\.closest\("\[data-presupuesto-mes-export-json\]"\)\) \{ downloadBudgetsJson\(\); return; \}/);
});

test("INTEG-1 · el chunk de presupuesto-mes viaja versionado", () => {
  assert.match(app, /views\/presupuesto-mes\.js\?v=20260828d1/);
  assert.match(html, /app.js\?v=20260903ap2a1/);
});
