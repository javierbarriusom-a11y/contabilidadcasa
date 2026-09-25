const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const app = read("app.js");

// NAV-5 (BACKLOG_CONTABILIDADCASA_3_0.md §2.3): cuarto tipo de resultado del lanzador — pregunta
// rápida determinista (sin IA externa) sobre una cifra ya calculada por unifiedActionCenterModel,
// devuelta con su procedencia (fecha, fuente, confianza). Mismo patrón de prueba que UX6/DEX1/DEX2.

function extractFunction(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `No existe la función ${name} en app.js`);
  const parenStart = app.indexOf("(", start);
  let parenDepth = 0;
  let bodyStart = -1;
  for (let index = parenStart; index < app.length; index += 1) {
    if (app[index] === "(") parenDepth += 1;
    else if (app[index] === ")") {
      parenDepth -= 1;
      if (parenDepth === 0) { bodyStart = app.indexOf("{", index); break; }
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
  assert.ok(start >= 0, `No existe la constante ${name}`);
  const end = app.indexOf(";\n", start);
  return app.slice(start, end + 1);
}

function sandboxWith(names, extra = {}) {
  const context = {
    escapeHtml: (v) => String(v ?? ""),
    money: (v) => `${Number(v || 0).toFixed(2)} €`,
    round2: (v) => Math.round((Number(v || 0) + Number.EPSILON) * 100) / 100,
    ledgerMonthLabel: (v) => String(v),
    e17SearchUsageWeight: () => 0,
    formatIsoDate: (v) => String(v),
    ...extra,
  };
  vm.createContext(context);
  vm.runInContext(extractConst("NAV5_METRIC_QUESTIONS"), context);
  vm.runInContext(extractConst("GOB14_CONFIDENCE_LABEL"), context);
  vm.runInContext(extractConst("UX6_AMOUNT_QUESTION_KEYWORDS"), context);
  vm.runInContext(extractConst("E17_CAPTURE_EXPENSE_KEYWORDS"), context);
  vm.runInContext(extractConst("E17_CAPTURE_INCOME_KEYWORDS"), context);
  vm.runInContext(extractConst("E17_CAPTURE_MONTHS"), context);
  vm.runInContext(extractConst("E17_CAPTURE_RELATIVE_DAYS"), context);
  vm.runInContext(extractFunction("normalizedText"), context);
  vm.runInContext(extractFunction("e17ExtractNaturalDate"), context);
  vm.runInContext(extractFunction("gob14MetricValueText"), context);
  names.forEach((name) => vm.runInContext(extractFunction(name), context));
  return context;
}

const SAMPLE_METRICS = {
  protectedReserve: { label: "Reserva protegida", value: 4200, unit: "EUR", asOf: "2026-09-25", source: "canonical-daily-and-monthly-plan", method: "max-policy-and-next-outflows", coverage: "until-next-income", confidence: "high" },
  liquidity: { label: "Liquidez hoy", value: 9800, unit: "EUR", asOf: "2026-09-25", source: "canonical-balance-engine", method: "sum-active-accounts", coverage: "checking+savings", confidence: "medium" },
  debtFreeDate: { label: "Fecha libre de deuda", value: "2031-04", unit: "", asOf: "2026-09-25", source: "canonical-debt-comparator", method: "no-tocar-strategy-projection", coverage: "estimable", confidence: "low" },
};

test("e17ParseMetricQuery · reconoce cada pregunta de cifra ejecutiva sin necesitar un dígito", () => {
  const ctx = sandboxWith(["e17ParseMetricQuery"]);
  assert.equal(ctx.e17ParseMetricQuery("¿cuál es mi reserva protegida?"), "protectedReserve");
  assert.equal(ctx.e17ParseMetricQuery("liquidez"), "liquidity");
  assert.equal(ctx.e17ParseMetricQuery("¿cuándo acabo la deuda?"), "debtFreeDate");
  assert.equal(ctx.e17ParseMetricQuery("deuda pendiente"), "debtPending");
});

test("e17ParseMetricQuery · sin coincidencia, no dispara (deja paso a la búsqueda de tareas normal)", () => {
  const ctx = sandboxWith(["e17ParseMetricQuery"]);
  assert.equal(ctx.e17ParseMetricQuery("presupuesto"), null);
  assert.equal(ctx.e17ParseMetricQuery(""), null);
});

test("e17ParseMetricQuery · no compite con una pregunta de importe (UX6), que siempre trae un dígito", () => {
  const ctx = sandboxWith(["e17ParseMetricQuery"]);
  // Frase deliberadamente distinta de las palabras clave de UX6/NAV-5: solo comprueba que un
  // importe con dígito no coincide por accidente con ninguna pregunta de cifra ejecutiva.
  assert.equal(ctx.e17ParseMetricQuery("¿puedo gastar 300€?"), null);
});

test("e17MetricAnswerHtml · cita la cifra con fecha, fuente y confianza traducida", () => {
  const ctx = sandboxWith(["e17MetricAnswerHtml"], {
    unifiedActionCenterModel: () => ({ readModel: { metrics: SAMPLE_METRICS } }),
  });
  const html = ctx.e17MetricAnswerHtml("protectedReserve");
  assert.match(html, /Reserva protegida/);
  assert.match(html, /4200\.00/);
  assert.match(html, /Fecha: 2026-09-25/);
  assert.match(html, /Fuente: canonical-daily-and-monthly-plan/);
  assert.match(html, /Confianza: alta/);
});

test("e17MetricAnswerHtml · una cifra sin unidad EUR (fecha libre de deuda) se pinta legible, no como número", () => {
  const ctx = sandboxWith(["e17MetricAnswerHtml"], {
    unifiedActionCenterModel: () => ({ readModel: { metrics: SAMPLE_METRICS } }),
  });
  const html = ctx.e17MetricAnswerHtml("debtFreeDate");
  assert.match(html, /Fecha libre de deuda/);
  assert.match(html, /Confianza: baja/);
});

test("e17MetricAnswerHtml · sin modelo ejecutivo disponible, no pinta nada (nunca inventa una cifra)", () => {
  const ctx = sandboxWith(["e17MetricAnswerHtml"], {
    unifiedActionCenterModel: () => ({ readModel: { metrics: {} } }),
  });
  assert.equal(ctx.e17MetricAnswerHtml("liquidity"), "");
});

const RENDER_LAUNCHER_NAMES = ["renderE17Launcher", "e17ParseAmountQuery", "e17AmountAnswerHtml", "e17ParseMetricQuery", "e17MetricAnswerHtml", "e17ParseQuickCaptureQuery", "e17QuickCaptureHtml"];

test("renderE17Launcher · una pregunta de cifra ejecutiva antepone la respuesta citada a las tareas encontradas", () => {
  const results = { innerHTML: "" };
  const ctx = sandboxWith(RENDER_LAUNCHER_NAMES, {
    qs: (id) => (id === "e17LauncherResults" ? results : null),
    E17Experience: { findTasks: () => [] },
    unifiedActionCenterModel: () => ({ readModel: { metrics: SAMPLE_METRICS } }),
  });
  ctx.renderE17Launcher("liquidez");
  assert.match(results.innerHTML, /Liquidez hoy/);
  assert.match(results.innerHTML, /Fuente: canonical-balance-engine/);
  assert.doesNotMatch(results.innerHTML, /No encuentro esa tarea/);
});

test("renderE17Launcher · una pregunta de importe (UX6) sigue teniendo prioridad sobre NAV-5", () => {
  const results = { innerHTML: "" };
  const ctx = sandboxWith(RENDER_LAUNCHER_NAMES, {
    qs: (id) => (id === "e17LauncherResults" ? results : null),
    E17Experience: { findTasks: () => [] },
    accountBalancesFromState: () => ({ caixa: 5000 }),
    agentCaixaFloor: () => 1000,
    unifiedActionCenterModel: () => { throw new Error("no debería resolverse el modelo ejecutivo si UX6 ya respondió"); },
  });
  ctx.renderE17Launcher("¿puedo gastar 300€?");
  assert.match(results.innerHTML, /Sí te lo puedes permitir/);
});

test("el lanzador y NAV-5 viven juntos en app.js", () => {
  assert.match(app, /function e17ParseMetricQuery/);
  assert.match(app, /function e17MetricAnswerHtml/);
  assert.match(app, /const NAV5_METRIC_QUESTIONS/);
});
