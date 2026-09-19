const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const indexHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");

// P12 (Horizonte 4 de BACKLOG_CONTABILIDADCASA_2_0.md): informe mensual en una página, «board
// pack» doméstico — extiende GOB14 (informe trimestral, c7583d3) a cadencia mensual sin tocarlo:
// mismo modelo ejecutivo con procedencia (A2-6, unifiedActionCenterModel) y el mismo cuerpo de
// informe (gob14ReportBodyHtml), solo cambia el periodo que lo etiqueta.

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

function baseHelpers(extra = {}) {
  return {
    money: (value, precise) => `${Number(value || 0).toFixed(precise ? 2 : 0)} €`,
    escapeHtml: (value) => String(value ?? ""),
    HOME_MISSING_VALUE: "—",
    formatIsoDate: (value) => value,
    defaultBalanceDate: () => "2026-09-13",
    currentBudgetMonthKey: () => "2026-09",
    GOB14_CONFIDENCE_LABEL: { high: "alta", medium: "media", low: "baja" },
    ...extra,
  };
}

// --- p12MonthLabel ---------------------------------------------------------------------------

test("p12MonthLabel · arma «<mes> <año>» a partir de la clave YYYY-MM", () => {
  const context = sandboxWith(["p12MonthLabel"], baseHelpers());
  assert.equal(context.p12MonthLabel("2026-09"), "septiembre de 2026");
});

test("p12MonthLabel · una clave sin formato válido devuelve la clave tal cual (o vacío sin clave)", () => {
  const context = sandboxWith(["p12MonthLabel"], baseHelpers());
  assert.equal(context.p12MonthLabel("no-valido"), "no-valido");
  assert.equal(context.p12MonthLabel(""), "");
});

// --- p12MonthlyReportContext ------------------------------------------------------------------

test("p12MonthlyReportContext · reutiliza tal cual unifiedActionCenterModel (A2-6), sin recalcular ningún KPI", () => {
  const metrics = { liquidity: { id: "liquidity", label: "Liquidez hoy", value: 1000, unit: "EUR", asOf: "2026-09-13", confidence: "high" } };
  const decisions = [{ title: "Revisar deuda", text: "detalle" }];
  const quality = { complete: true, missingMetadata: [], lowConfidence: [] };
  const context = sandboxWith(["p12MonthlyReportContext", "p12MonthLabel"], baseHelpers({
    unifiedActionCenterModel: () => ({ readModel: { metrics, decisions, quality } }),
  }));
  const result = context.p12MonthlyReportContext();
  assert.equal(result.monthLabel, "septiembre de 2026");
  assert.equal(result.generatedAt, "2026-09-13");
  assert.deepEqual(Array.from(result.metrics, (item) => ({ ...item })), Object.values(metrics));
  assert.deepEqual(Array.from(result.decisions, (item) => ({ ...item })), decisions);
  assert.deepEqual({ ...result.quality }, quality);
});

test("p12MonthlyReportContext · sin lectura ejecutiva calculable, cae a valores por defecto sin decisiones ni cifras", () => {
  const context = sandboxWith(["p12MonthlyReportContext", "p12MonthLabel"], baseHelpers({
    unifiedActionCenterModel: () => ({ readModel: null }),
  }));
  const result = context.p12MonthlyReportContext();
  assert.equal(result.metrics.length, 0);
  assert.equal(result.decisions.length, 0);
  assert.equal(result.quality.complete, true);
});

// --- p12MonthlyReportPrintHtml -----------------------------------------------------------------

test("p12MonthlyReportPrintHtml · pinta el mes, las cifras con su procedencia y las decisiones prioritarias", () => {
  const context = sandboxWith(["p12MonthlyReportPrintHtml", "gob14ReportBodyHtml", "gob14MetricValueText"], baseHelpers());
  const html = context.p12MonthlyReportPrintHtml({
    monthLabel: "septiembre de 2026",
    generatedAt: "2026-09-13",
    metrics: [{ label: "Liquidez hoy", value: 1000, unit: "EUR", asOf: "2026-09-13", confidence: "high" }],
    decisions: [{ title: "Revisar deuda", text: "priorizar la de mayor coste" }],
    quality: { complete: true, missingMetadata: [], lowConfidence: [] },
  });
  assert.match(html, /<h1>Informe mensual — septiembre de 2026<\/h1>/);
  assert.match(html, /Liquidez hoy/);
  assert.match(html, /1000\.00 €/);
  assert.match(html, /alta/);
  assert.match(html, /Revisar deuda/);
  assert.match(html, /priorizar la de mayor coste/);
  assert.match(html, /Todas las cifras de este informe tienen confianza media o alta\./);
});

test("p12MonthlyReportPrintHtml · sin decisiones prioritarias lo dice, en vez de una lista vacía", () => {
  const context = sandboxWith(["p12MonthlyReportPrintHtml", "gob14ReportBodyHtml", "gob14MetricValueText"], baseHelpers());
  const html = context.p12MonthlyReportPrintHtml({
    monthLabel: "septiembre de 2026",
    generatedAt: "2026-09-13",
    metrics: [],
    decisions: [],
    quality: { complete: true, missingMetadata: [], lowConfidence: [] },
  });
  assert.match(html, /Sin decisiones prioritarias pendientes\./);
});

test("p12MonthlyReportPrintHtml · con cifras de confianza baja, avisa cuántas en vez de darlas por buenas", () => {
  const context = sandboxWith(["p12MonthlyReportPrintHtml", "gob14ReportBodyHtml", "gob14MetricValueText"], baseHelpers());
  const html = context.p12MonthlyReportPrintHtml({
    monthLabel: "septiembre de 2026",
    generatedAt: "2026-09-13",
    metrics: [],
    decisions: [],
    quality: { complete: false, missingMetadata: [], lowConfidence: ["nextIncomeCoverage", "debtFreeDate"] },
  });
  assert.match(html, /2 cifra\(s\) de este informe tienen confianza baja/);
});

// --- downloadP12MonthlyReport -------------------------------------------------------------------

test("downloadP12MonthlyReport · pinta el informe en el contenedor compartido de impresión y usa window.print()", () => {
  const printCalls = [];
  const bodyClasses = new Set();
  const container = { innerHTML: "" };
  const context = sandboxWith(["downloadP12MonthlyReport", "p12MonthlyReportContext", "p12MonthlyReportPrintHtml", "gob14ReportBodyHtml", "gob14MetricValueText", "p12MonthLabel"], baseHelpers({
    unifiedActionCenterModel: () => ({ readModel: { metrics: {}, decisions: [], quality: { complete: true, missingMetadata: [], lowConfidence: [] } } }),
    qs: (id) => (id === "cierrePrintEvidence" ? container : null),
    document: { body: { classList: { add: (cls) => bodyClasses.add(cls), remove: (cls) => bodyClasses.delete(cls) } } },
    window: { print: () => printCalls.push(true) },
  }));
  context.downloadP12MonthlyReport();
  assert.equal(printCalls.length, 1);
  assert.match(container.innerHTML, /Informe mensual/);
  assert.equal(bodyClasses.has("is-printing-cierre-evidence"), false);
});

test("downloadP12MonthlyReport · sin el contenedor de impresión disponible, no llama a print", () => {
  const printCalls = [];
  const context = sandboxWith(["downloadP12MonthlyReport", "p12MonthlyReportContext", "p12MonthlyReportPrintHtml", "gob14ReportBodyHtml", "gob14MetricValueText", "p12MonthLabel"], baseHelpers({
    unifiedActionCenterModel: () => ({ readModel: null }),
    qs: () => null,
    document: { body: { classList: { add: () => {}, remove: () => {} } } },
    window: { print: () => printCalls.push(true) },
  }));
  context.downloadP12MonthlyReport();
  assert.equal(printCalls.length, 0);
});

// --- wiring ----------------------------------------------------------------------------------

test("wiring: app.js conecta el botón de descarga del informe mensual con downloadP12MonthlyReport", () => {
  assert.match(app, /qs\("p12MonthlyReportDownload"\)\?\.addEventListener\("click", downloadP12MonthlyReport\);/);
});

test("wiring: index.html declara el botón dentro de la sección #herramientas-datos", () => {
  assert.match(indexHtml, /id="p12MonthlyReportDownload"/);
  const sectionStart = indexHtml.indexOf('id="herramientas-datos"');
  const sectionEnd = indexHtml.indexOf("</section>", sectionStart);
  const buttonIdx = indexHtml.indexOf('id="p12MonthlyReportDownload"');
  assert.ok(sectionStart > 0 && buttonIdx > sectionStart && buttonIdx < sectionEnd, "El botón debe vivir dentro de #herramientas-datos");
});
