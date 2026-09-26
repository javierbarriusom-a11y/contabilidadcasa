const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const app = read("app.js");

// NAV-5 (BACKLOG_CONTABILIDADCASA_3_0.md §2.3): cuarto tipo de resultado del lanzador (A12-3),
// junto a la navegación, la respuesta de importe (UX6) y la captura rápida (DEX1/DEX2) — una cifra
// ya calculada, con su procedencia (fuente/fecha/confianza), sin navegar. Reutiliza
// unifiedActionCenterModel().readModel.metrics (A2-6), el mismo contrato que ya usan Hoy y el
// informe ejecutivo — sin motor nuevo.

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
  const end = app.indexOf("];\n", start);
  return app.slice(start, end + 2);
}

function sandboxWith(names, extra = {}) {
  const context = {
    escapeHtml: (v) => String(v ?? ""),
    money: (v) => `${Number(v || 0).toFixed(2)} €`,
    PV4_CONFIDENCE_LABEL: { high: "alta", medium: "media", low: "baja" },
    escenarioMotorMonthLabel: (v) => `mes(${v})`,
    e17SearchUsageWeight: () => 0,
    ...extra,
  };
  vm.createContext(context);
  vm.runInContext(extractConst("NAV5_METRIC_QUERIES"), context);
  vm.runInContext(extractFunction("normalizedText"), context);
  names.forEach((name) => vm.runInContext(extractFunction(name), context));
  return context;
}

// ---------------------------------------------------------------------------------------------
// e17ParseMetricQuery
// ---------------------------------------------------------------------------------------------

test("e17ParseMetricQuery · reconoce una frase por cada una de las seis métricas", () => {
  const ctx = sandboxWith(["e17ParseMetricQuery"]);
  assert.equal(ctx.e17ParseMetricQuery("liquidez"), "liquidity");
  assert.equal(ctx.e17ParseMetricQuery("¿cuál es mi capacidad libre?"), "freeCapacity");
  assert.equal(ctx.e17ParseMetricQuery("reserva protegida"), "protectedReserve");
  assert.equal(ctx.e17ParseMetricQuery("cobertura"), "nextIncomeCoverage");
  assert.equal(ctx.e17ParseMetricQuery("deuda pendiente"), "debtPending");
  assert.equal(ctx.e17ParseMetricQuery("¿cuándo estoy libre de deuda?"), "debtFreeDate");
});

test("e17ParseMetricQuery · sin coincidencia, o consulta vacía, no dispara", () => {
  const ctx = sandboxWith(["e17ParseMetricQuery"]);
  assert.equal(ctx.e17ParseMetricQuery("movimientos de la cuenta"), null);
  assert.equal(ctx.e17ParseMetricQuery(""), null);
});

test("e17ParseMetricQuery · sus frases nunca llevan dígito, así que nunca competirían con una pregunta de importe (UX6)", () => {
  assert.doesNotMatch(app, /keywords: \[[^\]]*\d/);
});

// ---------------------------------------------------------------------------------------------
// e17MetricValueText
// ---------------------------------------------------------------------------------------------

test("e17MetricValueText · una métrica normal se formatea con money()", () => {
  const ctx = sandboxWith(["e17MetricValueText"]);
  assert.equal(ctx.e17MetricValueText({ id: "liquidity", value: 4200 }), "4200.00 €");
});

test("e17MetricValueText · debtFreeDate sin deuda pendiente dice «Sin deuda»", () => {
  const ctx = sandboxWith(["e17MetricValueText"]);
  assert.equal(ctx.e17MetricValueText({ id: "debtFreeDate", coverage: "sin deuda pendiente", value: "" }), "Sin deuda");
});

test("e17MetricValueText · debtFreeDate estimable usa escenarioMotorMonthLabel sobre el valor crudo", () => {
  const ctx = sandboxWith(["e17MetricValueText"]);
  assert.equal(ctx.e17MetricValueText({ id: "debtFreeDate", coverage: "estimable", value: "2031-04" }), "mes(2031-04)");
});

test("e17MetricValueText · debtFreeDate no estimable no inventa una fecha", () => {
  const ctx = sandboxWith(["e17MetricValueText"]);
  assert.equal(ctx.e17MetricValueText({ id: "debtFreeDate", coverage: "no estimable", value: "" }), "—");
});

// ---------------------------------------------------------------------------------------------
// e17MetricAnswerHtml
// ---------------------------------------------------------------------------------------------

test("e17MetricAnswerHtml · cita fuente, fecha y confianza junto a la cifra", () => {
  const ctx = sandboxWith(["e17MetricAnswerHtml", "e17MetricValueText"], {
    unifiedActionCenterModel: () => ({
      readModel: {
        metrics: {
          debtPending: { id: "debtPending", label: "Deuda pendiente", value: 18500, source: "canonical-debt-contracts", asOf: "2026-09-26", confidence: "high", coverage: "3 contratos" },
        },
      },
    }),
  });
  const html = ctx.e17MetricAnswerHtml("debtPending");
  assert.match(html, /Deuda pendiente: 18500\.00 €/);
  assert.match(html, /Fuente: canonical-debt-contracts/);
  assert.match(html, /2026-09-26/);
  assert.match(html, /confianza alta/);
  assert.match(html, /3 contratos/);
});

test("e17MetricAnswerHtml · una métrica inexistente no pinta nada", () => {
  const ctx = sandboxWith(["e17MetricAnswerHtml", "e17MetricValueText"], {
    unifiedActionCenterModel: () => ({ readModel: { metrics: {} } }),
  });
  assert.equal(ctx.e17MetricAnswerHtml("liquidity"), "");
});

// ---------------------------------------------------------------------------------------------
// renderE17Launcher · integración
// ---------------------------------------------------------------------------------------------

// Stubs, no las funciones reales de UX6/DEX1-2 (ya cubiertas por tests/ux6-busqueda-importes.test.cjs):
// estas pruebas de integración solo fijan el orden de prioridad de renderE17Launcher, no el
// comportamiento interno de las otras tres.
const RENDER_LAUNCHER_NAMES = ["renderE17Launcher", "e17ParseMetricQuery", "e17MetricAnswerHtml", "e17MetricValueText"];

function renderCtx(extra) {
  const results = { innerHTML: "" };
  const amountCalls = [];
  const ctx = sandboxWith(RENDER_LAUNCHER_NAMES, {
    qs: (id) => (id === "e17LauncherResults" ? results : null),
    E17Experience: { findTasks: () => [] },
    e17ParseAmountQuery: (query) => { amountCalls.push(query); return /\d/.test(query) ? 300 : null; },
    e17AmountAnswerHtml: () => "<div>Sí te lo puedes permitir</div>",
    e17ParseQuickCaptureQuery: () => null,
    e17QuickCaptureHtml: () => "",
    unifiedActionCenterModel: () => ({
      readModel: {
        metrics: {
          liquidity: { id: "liquidity", label: "Liquidez hoy", value: 4200, source: "canonical-balance-engine", asOf: "2026-09-26", confidence: "medium", coverage: "checking+savings" },
        },
      },
    }),
    ...extra,
  });
  return { ctx, results, amountCalls };
}

test("renderE17Launcher · una pregunta de métrica antepone la respuesta con procedencia a las tareas encontradas", () => {
  const { ctx, results } = renderCtx();
  ctx.renderE17Launcher("liquidez");
  assert.match(results.innerHTML, /Liquidez hoy: 4200\.00 €/);
  assert.match(results.innerHTML, /Fuente: canonical-balance-engine/);
  assert.doesNotMatch(results.innerHTML, /No encuentro esa tarea/);
});

test("renderE17Launcher · una pregunta de métrica gana sobre la de importe y ni siquiera llega a parsearla", () => {
  const { ctx, results, amountCalls } = renderCtx();
  ctx.renderE17Launcher("liquidez");
  assert.doesNotMatch(results.innerHTML, /Sí te lo puedes permitir/);
  assert.deepEqual(amountCalls, []);
});

test("renderE17Launcher · sin pregunta de métrica, mantiene el comportamiento de siempre", () => {
  const { ctx, results } = renderCtx();
  ctx.renderE17Launcher("algo que no existe");
  assert.match(results.innerHTML, /No encuentro esa tarea/);
});

test("el motor de NAV-5 vive junto al resto del lanzador", () => {
  assert.match(app, /function renderE17Launcher/);
  assert.match(app, /function e17ParseMetricQuery/);
  assert.match(app, /function e17MetricAnswerHtml/);
  assert.match(app, /const NAV5_METRIC_QUERIES/);
});
