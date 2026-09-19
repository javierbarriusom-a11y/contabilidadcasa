const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const indexHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");

// GOB14 (Oleada 4, Bloque 7): informe trimestral exportable, maquetado para presentar a la
// familia. Distinto de GOB3 (índice de PROJECT_STATE.md, uso interno de desarrollo) y de la
// exportación de Análisis (A-11, vista de trabajo con cifras técnicas): esta es una vista para
// enseñar, con las cifras ejecutivas ya citadas por procedencia (A2-6, unifiedActionCenterModel)
// reutilizadas tal cual, sin motor propio. Mismo mecanismo de "PDF de una página" que A-11/C-12.

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
    ledgerMonthLabel: (key) => `MES-${key}`,
    HOME_MISSING_VALUE: "—",
    formatIsoDate: (value) => value,
    defaultBalanceDate: () => "2026-09-13",
    currentBudgetQuarterKey: () => "2026-Q3",
    budgetLongPeriodRange: (periodType, quarterKey) =>
      quarterKey === "2026-Q3" ? { start: "2026-07-01", end: "2026-09-30" } : null,
    GOB14_CONFIDENCE_LABEL: { high: "alta", medium: "media", low: "baja" },
    ...extra,
  };
}

// --- gob14QuarterLabel ---------------------------------------------------------------------

test("gob14QuarterLabel · arma «T<n> <año> (<mes ini>-<mes fin>)» a partir del rango real del trimestre", () => {
  const context = sandboxWith(["gob14QuarterLabel"], baseHelpers());
  assert.equal(context.gob14QuarterLabel("2026-Q3"), "T3 2026 (jul-sept)");
});

test("gob14QuarterLabel · una clave sin formato válido o sin rango calculable devuelve la clave tal cual", () => {
  const context = sandboxWith(["gob14QuarterLabel"], baseHelpers());
  assert.equal(context.gob14QuarterLabel("no-valido"), "no-valido");
  assert.equal(context.gob14QuarterLabel("2020-Q1"), "2020-Q1");
});

// --- gob14MetricValueText -------------------------------------------------------------------

test("gob14MetricValueText · sin valor conocido, el hueco declarado H-10 (—), nunca 0 €", () => {
  const context = sandboxWith(["gob14MetricValueText"], baseHelpers());
  assert.equal(context.gob14MetricValueText({ value: null, unit: "EUR" }), "—");
  assert.equal(context.gob14MetricValueText({ value: undefined, unit: "EUR" }), "—");
  assert.equal(context.gob14MetricValueText({ value: "", unit: "" }), "—");
});

test("gob14MetricValueText · unidad EUR y EUR/month se formatean en euros", () => {
  const context = sandboxWith(["gob14MetricValueText"], baseHelpers());
  assert.equal(context.gob14MetricValueText({ value: 1234.5, unit: "EUR" }), "1234.50 €");
  assert.equal(context.gob14MetricValueText({ value: 500, unit: "EUR/month" }), "500.00 €/mes");
});

test("gob14MetricValueText · un valor «YYYY-MM» se traduce con ledgerMonthLabel (fecha libre de deuda real)", () => {
  const context = sandboxWith(["gob14MetricValueText"], baseHelpers());
  assert.equal(context.gob14MetricValueText({ value: "2027-03", unit: "" }), "MES-2027-03");
});

test("gob14MetricValueText · una frase ya legible del motor (sin deuda pendiente...) se muestra tal cual, sin recalcular", () => {
  const context = sandboxWith(["gob14MetricValueText"], baseHelpers());
  assert.equal(context.gob14MetricValueText({ value: "sin deuda pendiente", unit: "" }), "sin deuda pendiente");
});

// --- gob14QuarterlyReportContext -------------------------------------------------------------

test("gob14QuarterlyReportContext · reutiliza tal cual unifiedActionCenterModel (A2-6), sin recalcular ningún KPI", () => {
  const metrics = { liquidity: { id: "liquidity", label: "Liquidez hoy", value: 1000, unit: "EUR", asOf: "2026-09-13", confidence: "high" } };
  const decisions = [{ title: "Revisar deuda", text: "detalle" }];
  const quality = { complete: true, missingMetadata: [], lowConfidence: [] };
  const context = sandboxWith(["gob14QuarterlyReportContext", "gob14QuarterLabel"], baseHelpers({
    unifiedActionCenterModel: () => ({ readModel: { metrics, decisions, quality } }),
  }));
  const result = context.gob14QuarterlyReportContext();
  assert.equal(result.quarterLabel, "T3 2026 (jul-sept)");
  assert.equal(result.generatedAt, "2026-09-13");
  assert.deepEqual(Array.from(result.metrics, (item) => ({ ...item })), Object.values(metrics));
  assert.deepEqual(Array.from(result.decisions, (item) => ({ ...item })), decisions);
  assert.deepEqual({ ...result.quality }, quality);
});

test("gob14QuarterlyReportContext · sin lectura ejecutiva calculable, cae a valores por defecto sin decisiones ni cifras", () => {
  const context = sandboxWith(["gob14QuarterlyReportContext", "gob14QuarterLabel"], baseHelpers({
    unifiedActionCenterModel: () => ({ readModel: null }),
  }));
  const result = context.gob14QuarterlyReportContext();
  assert.equal(result.metrics.length, 0);
  assert.equal(result.decisions.length, 0);
  assert.equal(result.quality.complete, true);
});

// --- gob14QuarterlyReportPrintHtml -----------------------------------------------------------

test("gob14QuarterlyReportPrintHtml · pinta el trimestre, las cifras con su procedencia y las decisiones prioritarias", () => {
  const context = sandboxWith(["gob14QuarterlyReportPrintHtml", "gob14ReportBodyHtml", "gob14MetricValueText"], baseHelpers());
  const html = context.gob14QuarterlyReportPrintHtml({
    quarterLabel: "T3 2026 (jul-sep)",
    generatedAt: "2026-09-13",
    metrics: [{ label: "Liquidez hoy", value: 1000, unit: "EUR", asOf: "2026-09-13", confidence: "high" }],
    decisions: [{ title: "Revisar deuda", text: "priorizar la de mayor coste" }],
    quality: { complete: true, missingMetadata: [], lowConfidence: [] },
  });
  assert.match(html, /<h1>Informe trimestral — T3 2026 \(jul-sep\)<\/h1>/);
  assert.match(html, /Liquidez hoy/);
  assert.match(html, /1000\.00 €/);
  assert.match(html, /alta/);
  assert.match(html, /Revisar deuda/);
  assert.match(html, /priorizar la de mayor coste/);
  assert.match(html, /Todas las cifras de este informe tienen confianza media o alta\./);
});

test("gob14QuarterlyReportPrintHtml · sin decisiones prioritarias lo dice, en vez de una lista vacía", () => {
  const context = sandboxWith(["gob14QuarterlyReportPrintHtml", "gob14ReportBodyHtml", "gob14MetricValueText"], baseHelpers());
  const html = context.gob14QuarterlyReportPrintHtml({
    quarterLabel: "T3 2026 (jul-sep)",
    generatedAt: "2026-09-13",
    metrics: [],
    decisions: [],
    quality: { complete: true, missingMetadata: [], lowConfidence: [] },
  });
  assert.match(html, /Sin decisiones prioritarias pendientes\./);
});

test("gob14QuarterlyReportPrintHtml · con cifras de confianza baja, avisa cuántas en vez de darlas por buenas", () => {
  const context = sandboxWith(["gob14QuarterlyReportPrintHtml", "gob14ReportBodyHtml", "gob14MetricValueText"], baseHelpers());
  const html = context.gob14QuarterlyReportPrintHtml({
    quarterLabel: "T3 2026 (jul-sep)",
    generatedAt: "2026-09-13",
    metrics: [],
    decisions: [],
    quality: { complete: false, missingMetadata: [], lowConfidence: ["nextIncomeCoverage", "debtFreeDate"] },
  });
  assert.match(html, /2 cifra\(s\) de este informe tienen confianza baja/);
});

// --- downloadGob14QuarterlyReport ------------------------------------------------------------

test("downloadGob14QuarterlyReport · pinta el informe en el contenedor compartido de impresión y usa window.print()", () => {
  const printCalls = [];
  const bodyClasses = new Set();
  const container = { innerHTML: "" };
  const context = sandboxWith(["downloadGob14QuarterlyReport", "gob14QuarterlyReportContext", "gob14QuarterlyReportPrintHtml", "gob14ReportBodyHtml", "gob14MetricValueText", "gob14QuarterLabel"], baseHelpers({
    unifiedActionCenterModel: () => ({ readModel: { metrics: {}, decisions: [], quality: { complete: true, missingMetadata: [], lowConfidence: [] } } }),
    qs: (id) => (id === "cierrePrintEvidence" ? container : null),
    document: { body: { classList: { add: (cls) => bodyClasses.add(cls), remove: (cls) => bodyClasses.delete(cls) } } },
    window: { print: () => printCalls.push(true) },
  }));
  context.downloadGob14QuarterlyReport();
  assert.equal(printCalls.length, 1);
  assert.match(container.innerHTML, /Informe trimestral/);
  assert.equal(bodyClasses.has("is-printing-cierre-evidence"), false);
});

test("downloadGob14QuarterlyReport · sin el contenedor de impresión disponible, no llama a print", () => {
  const printCalls = [];
  const context = sandboxWith(["downloadGob14QuarterlyReport", "gob14QuarterlyReportContext", "gob14QuarterlyReportPrintHtml", "gob14ReportBodyHtml", "gob14MetricValueText", "gob14QuarterLabel"], baseHelpers({
    unifiedActionCenterModel: () => ({ readModel: null }),
    qs: () => null,
    document: { body: { classList: { add: () => {}, remove: () => {} } } },
    window: { print: () => printCalls.push(true) },
  }));
  context.downloadGob14QuarterlyReport();
  assert.equal(printCalls.length, 0);
});

// --- wiring ----------------------------------------------------------------------------------

test("wiring: app.js conecta el botón de descarga del informe trimestral con downloadGob14QuarterlyReport", () => {
  assert.match(app, /qs\("gob14QuarterlyReportDownload"\)\?\.addEventListener\("click", downloadGob14QuarterlyReport\);/);
});

test("wiring: index.html declara el botón dentro de la sección #herramientas-datos", () => {
  assert.match(indexHtml, /id="gob14QuarterlyReportDownload"/);
  const sectionStart = indexHtml.indexOf('id="herramientas-datos"');
  const sectionEnd = indexHtml.indexOf("</section>", sectionStart);
  const buttonIdx = indexHtml.indexOf('id="gob14QuarterlyReportDownload"');
  assert.ok(sectionStart > 0 && buttonIdx > sectionStart && buttonIdx < sectionEnd, "El botón debe vivir dentro de #herramientas-datos");
});
