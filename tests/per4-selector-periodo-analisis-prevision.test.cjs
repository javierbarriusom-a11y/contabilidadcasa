const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const CanonicalPeriod = require("../canonical-period.js");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const appSrc = read("app.js");
const analisisSrc = read("views/analisis.js");

// PER-4 (BACKLOG_CONTABILIDADCASA_3_0.md §2.1): resto del alcance de PER-4 más allá de Presupuesto
// (cubierta en tests/bud3-presupuesto-anual-trimestral.test.cjs) — la preferencia compartida por
// pantalla (PERIOD_SELECTOR_PREFERENCE_KEY), su uso aditivo en Análisis (persistencia, sin tocar la
// semántica de ventana móvil de A-4) y el resumen por periodo natural de Previsión, construido desde
// cero (no existía ningún concepto de periodo calendario en esa pantalla). Salud financiera queda
// fuera a propósito (decisión del hogar, sesión 221).

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `No existe la función ${name}`);
  let parenDepth = 0;
  let bodyStart = -1;
  for (let index = source.indexOf("(", start); index < source.length; index += 1) {
    if (source[index] === "(") parenDepth += 1;
    else if (source[index] === ")") {
      parenDepth -= 1;
      if (parenDepth === 0) {
        bodyStart = source.indexOf("{", index);
        break;
      }
    }
  }
  assert.ok(bodyStart >= 0, `No se encontró el cuerpo de ${name}`);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    else if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`La función ${name} no cierra sus llaves`);
}

// =================================================================================================
// PERIOD_SELECTOR_PREFERENCE_KEY: la preferencia compartida (app.js)
// =================================================================================================

function preferenceSandbox(initial = {}) {
  const backing = { ...initial };
  const context = {
    PERIOD_SELECTOR_PREFERENCE_KEY: "period-selector-preference",
    storageKey: (name) => `${name}:finance`,
    storageGet: (key, fallback = "") => (Object.prototype.hasOwnProperty.call(backing, key) ? backing[key] : fallback),
    storageSet: (key, value) => { backing[key] = value; },
    backing,
  };
  vm.createContext(context);
  vm.runInContext(
    [
      extractFunction(appSrc, "loadPeriodSelectorPreferences"),
      extractFunction(appSrc, "periodSelectorPreferredUnit"),
      extractFunction(appSrc, "savePeriodSelectorPreference"),
    ].join("\n"),
    context,
  );
  return context;
}

test("PER-4 · periodSelectorPreferredUnit devuelve el fallback cuando nunca se guardó nada", () => {
  const context = preferenceSandbox();
  assert.equal(context.periodSelectorPreferredUnit("presupuesto-largo", "year"), "year");
});

test("PER-4 · savePeriodSelectorPreference guarda por pantalla, sin pisar las demás", () => {
  const context = preferenceSandbox();
  context.savePeriodSelectorPreference("presupuesto-largo", "semester");
  context.savePeriodSelectorPreference("prevision", "quarter");
  assert.equal(context.periodSelectorPreferredUnit("presupuesto-largo", "year"), "semester");
  assert.equal(context.periodSelectorPreferredUnit("prevision", "year"), "quarter");
  assert.equal(context.periodSelectorPreferredUnit("analisis", "mes-actual"), "mes-actual", "una pantalla sin preferencia guardada usa su propio fallback");
});

test("PER-4 · savePeriodSelectorPreference ignora un valor vacío o no-string, sin borrar lo ya guardado", () => {
  const context = preferenceSandbox();
  context.savePeriodSelectorPreference("prevision", "quarter");
  context.savePeriodSelectorPreference("prevision", "");
  context.savePeriodSelectorPreference("prevision", null);
  context.savePeriodSelectorPreference("prevision", 42);
  assert.equal(context.periodSelectorPreferredUnit("prevision", "year"), "quarter");
});

test("PER-4 · se guarda en local (mismo storageGet/storageSet que el resto de preferencias), nunca sale del navegador", () => {
  const context = preferenceSandbox();
  context.savePeriodSelectorPreference("analisis", "trimestre");
  assert.ok(Object.prototype.hasOwnProperty.call(context.backing, "period-selector-preference:finance"));
  const stored = JSON.parse(context.backing["period-selector-preference:finance"]);
  assert.equal(stored.analisis, "trimestre");
});

test("PER-4 · si el almacén local viene corrupto, se cae a un objeto vacío en vez de romper la app", () => {
  const context = preferenceSandbox({ "period-selector-preference:finance": "{esto no es json" });
  assert.equal(context.periodSelectorPreferredUnit("prevision", "quarter"), "quarter");
});

// =================================================================================================
// Análisis: persistencia aditiva de A-4, sin tocar su ventana móvil
// =================================================================================================

test("PER-4 · Análisis ya tenía \"semestre\" como preset de ventana móvil antes de esta tarea (no se toca)", () => {
  assert.match(analisisSrc, /\{ id: "semestre", label: "Último semestre", months: 6 \}/);
});

test("PER-4 · currentAnalisisPeriodKey lee la preferencia persistida la primera vez, de forma perezosa", () => {
  assert.match(analisisSrc, /let analisisPeriodKey = null;/);
  const source = extractFunction(analisisSrc, "currentAnalisisPeriodKey");
  assert.match(source, /periodSelectorPreferredUnit\("analisis", "mes-actual"\)/);
});

test("PER-4 · handleAnalisisPeriod persiste la elección bajo el id de pantalla \"analisis\"", () => {
  const source = extractFunction(analisisSrc, "handleAnalisisPeriod");
  assert.match(source, /savePeriodSelectorPreference\("analisis", periodKey\)/);
});

// =================================================================================================
// Previsión: resumen por periodo natural, construido desde cero (no existía ningún selector de
// periodo calendario en esta pantalla)
// =================================================================================================

function previsionSandbox({ months = [], rows = [] } = {}) {
  const preferences = {};
  const context = {
    window: { FinanceCanonicalPeriod: CanonicalPeriod },
    openForecastMonths: () => months,
    previsionRowsForMonths: (selectedMonths) =>
      rows.filter((item) => selectedMonths.some((month) => month.key === item.row.detailMonthKey)),
    previsionMetricsFor: (items) => items.map((item) => ({ item, metric: { min: item.row.min } })),
    previsionWorstOf: (metrics) => metrics.reduce((worst, current) => (current.metric.min < worst.metric.min ? current : worst), metrics[0]),
    periodSelectorPreferredUnit: (screenId, fallback) => preferences[screenId] ?? fallback,
    savePeriodSelectorPreference: (screenId, unit) => { preferences[screenId] = unit; },
    qs: () => null,
    money: (v) => `€${v}`,
    escapeHtml: (v) => String(v ?? ""),
    document: { querySelectorAll: () => [] },
    renderPrevisionPeriodSummary: () => {},
  };
  vm.createContext(context);
  vm.runInContext(
    [
      extractFunction(appSrc, "monthKeysInRange"),
      "const PREVISION_PERIOD_UNITS = [\"quarter\", \"semester\", \"year\"];",
      "let previsionPeriodUnit = null;",
      "let previsionPeriodKey = null;",
      extractFunction(appSrc, "currentPrevisionPeriodUnit"),
      extractFunction(appSrc, "currentPrevisionPeriodKey"),
      extractFunction(appSrc, "handlePrevisionPeriodUnitChange"),
      extractFunction(appSrc, "shiftPrevisionPeriod"),
      extractFunction(appSrc, "previsionPeriodSummaryRows"),
      extractFunction(appSrc, "previsionPeriodSummary"),
      // Los `let` de nivel superior de un script de vm no son propiedades del objeto de contexto
      // (a diferencia de `var`): esta función-puente, compilada en el mismo contexto, es la única
      // forma de fijar un valor de partida para una prueba sin depender de la fecha real de hoy.
      "function __setPrevisionPeriodKey(key) { previsionPeriodKey = key; }",
    ].join("\n"),
    context,
    { filename: "app.js#per4-prevision" },
  );
  return context;
}

function forecastRow(monthKey, month, { income = 0, coreSpend = 0, car = 0, projectOutflow = 0, refi = 0, saving = 0, min = 0 } = {}) {
  return { row: { detailMonthKey: monthKey, month, income, coreSpend, car, projectOutflow, refi, saving, min } };
}

test("PER-4 · currentPrevisionPeriodUnit usa \"quarter\" como valor por defecto, nunca guardado antes", () => {
  const context = previsionSandbox();
  assert.equal(context.currentPrevisionPeriodUnit(), "quarter");
});

test("PER-4 · currentPrevisionPeriodUnit ignora una preferencia guardada que no sea una de las tres cadencias válidas", () => {
  const context = previsionSandbox();
  context.periodSelectorPreferredUnit = () => "mes-actual"; // valor de otra pantalla (Análisis), no válido aquí
  assert.equal(context.currentPrevisionPeriodUnit(), "quarter");
});

test("PER-4 · handlePrevisionPeriodUnitChange ignora una unidad desconocida", () => {
  const context = previsionSandbox();
  context.handlePrevisionPeriodUnitChange("month");
  assert.equal(context.currentPrevisionPeriodUnit(), "quarter");
});

test("PER-4 · shiftPrevisionPeriod avanza y retrocede con adjacentPeriod, cruzando de año en Q4→Q1", () => {
  const context = previsionSandbox();
  context.__setPrevisionPeriodKey("2026-Q4");
  context.shiftPrevisionPeriod(1);
  assert.equal(context.currentPrevisionPeriodKey(), "2027-Q1");
  context.shiftPrevisionPeriod(-1);
  assert.equal(context.currentPrevisionPeriodKey(), "2026-Q4");
});

test("PER-4 · previsionPeriodSummaryRows filtra los meses abiertos por el rango del periodo, sin depender del horizonte", () => {
  const context = previsionSandbox({
    months: [{ key: "2026-01" }, { key: "2026-02" }, { key: "2026-03" }, { key: "2026-04" }],
    rows: [forecastRow("2026-01", "ene 26"), forecastRow("2026-02", "feb 26"), forecastRow("2026-03", "mar 26"), forecastRow("2026-04", "abr 26")],
  });
  const rows = context.previsionPeriodSummaryRows("2026-Q1");
  assert.deepEqual(rows.map((item) => item.row.detailMonthKey), ["2026-01", "2026-02", "2026-03"]);
});

test("PER-4 · previsionPeriodSummary suma ingresos/gastos/deuda/ahorro y se queda con el mínimo del peor mes", () => {
  const context = previsionSandbox({
    months: [{ key: "2026-01" }, { key: "2026-02" }, { key: "2026-03" }],
    rows: [
      forecastRow("2026-01", "ene 26", { income: 2000, coreSpend: 900, car: 100, refi: 300, saving: 200, min: 500 }),
      forecastRow("2026-02", "feb 26", { income: 2000, coreSpend: 950, refi: 300, saving: 200, min: -150 }),
      forecastRow("2026-03", "mar 26", { income: 2200, coreSpend: 900, refi: 300, saving: 300, min: 800 }),
    ],
  });
  const summary = context.previsionPeriodSummary("2026-Q1");
  assert.equal(summary.income, 6200);
  assert.equal(summary.gastos, 2850);
  assert.equal(summary.deuda, 900);
  assert.equal(summary.ahorro, 700);
  assert.equal(summary.min, -150);
  assert.equal(summary.minMonthLabel, "feb 26");
  assert.equal(summary.monthsAvailable, 3);
  assert.equal(summary.monthsInPeriod, 3);
});

test("PER-4 · previsionPeriodSummary devuelve null sin meses abiertos en ese periodo (nunca inventa cifras)", () => {
  const context = previsionSandbox({ months: [], rows: [] });
  assert.equal(context.previsionPeriodSummary("2026-Q1"), null);
});

test("PER-4 · previsionPeriodSummary marca el periodo como incompleto cuando faltan meses abiertos todavía", () => {
  const context = previsionSandbox({
    months: [{ key: "2026-01" }],
    rows: [forecastRow("2026-01", "ene 26", { income: 1000, min: 100 })],
  });
  const summary = context.previsionPeriodSummary("2026-Q1");
  assert.equal(summary.monthsAvailable, 1);
  assert.equal(summary.monthsInPeriod, 3);
});

test("PER-4 · el resumen por periodo de Previsión vive fuera del horizonte 12m/24m/48m (independiente de previsionHorizonKey)", () => {
  const source = extractFunction(appSrc, "previsionPeriodSummaryRows");
  assert.doesNotMatch(source, /previsionHorizonKey/);
  assert.match(source, /openForecastMonths\(\)/);
});

// =================================================================================================
// Informe semestral (GOB14/P12, tercera cadencia) — lógica pura
// =================================================================================================

function gob14SemesterSandbox({ metrics = [], decisions = [], quality } = {}) {
  const context = {
    window: { FinanceCanonicalPeriod: CanonicalPeriod },
    escapeHtml: (v) => String(v ?? ""),
    formatIsoDate: (v) => v,
    defaultBalanceDate: () => "2026-09-22",
    unifiedActionCenterModel: () => ({
      readModel: {
        metrics: Object.fromEntries(metrics.map((item, index) => [`m${index}`, item])),
        decisions,
        quality: quality || { complete: true, missingMetadata: [], lowConfidence: [] },
      },
    }),
    GOB14_CONFIDENCE_LABEL: { high: "alta", medium: "media", low: "baja" },
    gob14MetricValueText: (item) => String(item.value),
  };
  vm.createContext(context);
  vm.runInContext(
    [
      extractFunction(appSrc, "gob14SemesterLabel"),
      extractFunction(appSrc, "gob14SemesterReportContext"),
      extractFunction(appSrc, "gob14ReportBodyHtml"),
      extractFunction(appSrc, "gob14SemesterReportPrintHtml"),
    ].join("\n"),
    context,
    { filename: "app.js#per4-gob14-semester" },
  );
  return context;
}

test("PER-4 · gob14SemesterLabel etiqueta el semestre con su rango de meses", () => {
  const context = gob14SemesterSandbox();
  const label = context.gob14SemesterLabel("2026-S1");
  assert.match(label, /S1 2026/);
  assert.match(label, /ene-jun/);
});

test("PER-4 · gob14SemesterLabel devuelve la clave tal cual si no es un semestre válido", () => {
  const context = gob14SemesterSandbox();
  assert.equal(context.gob14SemesterLabel("2026-Q1"), "2026-Q1");
});

test("PER-4 · gob14SemesterReportContext usa el semestre en curso y las mismas cifras ejecutivas que GOB14/P12", () => {
  const context = gob14SemesterSandbox({ metrics: [{ label: "Colchón", value: 1000 }], decisions: [{ title: "Revisar seguro" }] });
  const reportContext = context.gob14SemesterReportContext();
  assert.match(reportContext.semesterLabel, /S\d 2026/);
  assert.equal(reportContext.generatedAt, "2026-09-22");
  assert.equal(reportContext.metrics.length, 1);
  assert.equal(reportContext.decisions.length, 1);
});

test("PER-4 · gob14SemesterReportPrintHtml titula \"Informe semestral\" y reutiliza gob14ReportBodyHtml tal cual", () => {
  const context = gob14SemesterSandbox({ metrics: [{ label: "Colchón", value: 1000, asOf: "2026-09-01", confidence: "high" }] });
  const html = context.gob14SemesterReportPrintHtml(context.gob14SemesterReportContext());
  assert.match(html, /<h1>Informe semestral/);
  assert.match(html, /Cifras clave, con su procedencia/, "mismo cuerpo compartido que GOB14/P12");
});
