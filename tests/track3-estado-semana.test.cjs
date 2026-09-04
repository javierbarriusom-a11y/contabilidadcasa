/**
 * tests/track3-estado-semana.test.cjs
 *
 * TRACK-3 (FASE 7): pantalla "Estado de la semana" — funde alertas de caja anticipadas (E16),
 * ritmo de presupuesto (semana y mes) y próximos vencimientos de objetivos (E15), hoy dispersos en
 * Hoy/Presupuesto del mes/Huchas, en una única lectura de solo lectura. Sin motor nuevo: cada
 * tarjeta reutiliza tal cual la función que ya construye esa misma lectura en su pantalla de
 * origen.
 *
 * - Parte A: homeBudgetWeekSummary/categoryBudgetsForWeek (app.js) — mismo patrón que
 *   homeBudgetSummary, para la semana ISO en curso.
 * - Parte B: las tres tarjetas de views/estado-semana.js, con los tres motores mockeados en el
 *   límite (E16/E15/homeBudgetSummary), mismo patrón que INTEG-1/BUD-1/BUD-2.
 * - Parte C: wiring — nav, chunk, HEAVY_RENDER_VIEWS, switch de renderActiveSection, listener de
 *   navegación, catálogo del lanzador (e17-experience.js) y el canario de publicación (todo
 *   VIEW_CHUNKS debe estar en la lista de tools/build-public-site.mjs).
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const appSrc = read("app.js");
const viewSrc = read("views/estado-semana.js");
const app = appSrc + "\n" + viewSrc;

function extractFunction(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `No existe la función ${name} en app.js/views/estado-semana.js`);
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

// ============================================================================
// Parte A: homeBudgetWeekSummary/categoryBudgetsForWeek — real, sobre presupuestos sintéticos
// ============================================================================

function weekSummarySandbox({ budgetsData = [], weekKey = "2026-W35", alerts = {} } = {}) {
  const context = {
    budgets: budgetsData,
    window: {
      FinanceCanonicalBudgetSchema: { CanonicalBudgetSchema: { findForWeek: (list, key) => list.filter((b) => b.weekKey === key) } },
      FinanceCanonicalBudgetAlerts: { CanonicalBudgetAlerts: {} },
    },
    currentBudgetWeekKey: () => weekKey,
    isGoalBudgetCategoryId: (categoryId) => typeof categoryId === "string" && categoryId.startsWith("goal:"),
    budgetWeekAlertForRow: (budget) => alerts[budget.categoryId] || { status: "on-track", severity: 0, metrics: { spent: 0 } },
  };
  vm.createContext(context);
  vm.runInContext([extractFunction("categoryBudgetsForWeek"), extractFunction("homeBudgetWeekSummary")].join("\n"), context, {
    filename: "app.js#track3-week-summary",
  });
  return context;
}

test("TRACK-3 · homeBudgetWeekSummary sin presupuestos esa semana da null", () => {
  const context = weekSummarySandbox({ budgetsData: [] });
  assert.equal(context.homeBudgetWeekSummary(), null);
});

test("TRACK-3 · homeBudgetWeekSummary agrega presupuesto/gastado y excluye objetivos", () => {
  const context = weekSummarySandbox({
    budgetsData: [
      { categoryId: "comida", weekKey: "2026-W35", amountCap: 70 },
      { categoryId: "ocio", weekKey: "2026-W35", amountCap: 30 },
      { categoryId: "goal:g1", weekKey: "2026-W35", amountCap: 20 }, // excluido: presupuesto de objetivo
      { categoryId: "transporte", weekKey: "2026-W36", amountCap: 50 }, // otra semana: excluido
    ],
    alerts: {
      comida: { status: "on-track", severity: 0, metrics: { spent: 40 } },
      ocio: { status: "overspend", severity: 2, metrics: { spent: 45 } },
    },
  });
  const summary = context.homeBudgetWeekSummary();
  assert.equal(summary.count, 2);
  assert.equal(summary.totalBudgeted, 100);
  assert.equal(summary.totalSpent, 85);
  assert.equal(summary.status, "warn");
  assert.match(summary.worstMessage, /^ocio:/);
});

test("TRACK-3 · homeBudgetWeekSummary sin semana en curso (motor no disponible) da null", () => {
  const context = weekSummarySandbox({ budgetsData: [{ categoryId: "comida", weekKey: "2026-W35", amountCap: 70 }], weekKey: null });
  assert.equal(context.homeBudgetWeekSummary(), null);
});

// ============================================================================
// Parte B: las tres tarjetas — motores mockeados en el límite
// ============================================================================

function cardSandbox({ e16 = null, e15 = null, p2Bridge = null, monthlySummary = null, weeklySummary = null, p2Goals = [], assistantApi = null, citationApi = null } = {}) {
  const context = {
    window: { FinanceCanonicalE16: e16, FinanceCanonicalE15: e15, FinanceP2Bridge: p2Bridge, FinanceCanonicalE9Assistant: assistantApi, FinanceCanonicalRecommendationCitation: citationApi },
    homeBudgetSummary: () => monthlySummary,
    homeBudgetWeekSummary: () => weeklySummary,
    p2State: () => ({ goals: p2Goals }),
    escapeHtml: (value) =>
      String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"),
    money: (v) => `€${v}`,
    qs: () => null,
  };
  vm.createContext(context);
  vm.runInContext(
    [
      extractFunction("estadoSemanaCashAlerts"),
      extractFunction("estadoSemanaCashAlertsHtml"),
      extractFunction("estadoSemanaBudgetRhythmRowHtml"),
      extractFunction("estadoSemanaBudgetRhythmHtml"),
      extractFunction("estadoSemanaGoalDeadlines"),
      extractFunction("estadoSemanaGoalDeadlinesHtml"),
      extractFunction("cpx1WeeklyPriorityAction"),
      extractFunction("cpx1WeeklyPriorityHtml"),
      extractFunction("estadoSemanaPriorityHtml"),
      extractFunction("renderEstadoSemana"),
    ].join("\n"),
    context,
    { filename: "views/estado-semana.js#track3-cards" },
  );
  return context;
}

test("TRACK-3 · tarjeta de caja: sin motor E16 disponible, avisa en vez de fallar", () => {
  const context = cardSandbox({});
  assert.equal(context.estadoSemanaCashAlerts(), null);
  assert.match(context.estadoSemanaCashAlertsHtml(), /no está disponible todavía/);
});

test("TRACK-3 · tarjeta de caja: sin alertas, dice que no hay riesgos", () => {
  const context = cardSandbox({ e16: { buildReadModel: () => ({ alerts: { alerts: [] } }) }, p2Bridge: { e16Input: () => ({}) } });
  assert.match(context.estadoSemanaCashAlertsHtml(), /No hay riesgos/);
});

test("TRACK-3 · tarjeta de caja: muestra hasta 3 alertas y el recuento total", () => {
  const alerts = [1, 2, 3, 4].map((n) => ({ monthKey: `2026-0${n}`, message: `Riesgo ${n}` }));
  const context = cardSandbox({ e16: { buildReadModel: () => ({ alerts: { alerts } }) }, p2Bridge: { e16Input: () => ({}) } });
  const html = context.estadoSemanaCashAlertsHtml();
  assert.match(html, /Riesgo 1/);
  assert.match(html, /Riesgo 3/);
  assert.doesNotMatch(html, /Riesgo 4/, "solo se muestran las 3 primeras");
  assert.match(html, /4 alertas anticipadas en total/);
});

test("TRACK-3 · tarjeta de ritmo: sin presupuestos en ninguna cadencia, lo dice en las dos filas", () => {
  const context = cardSandbox({});
  const html = context.estadoSemanaBudgetRhythmHtml();
  assert.match(html, /Esta semana.*todavía no hay presupuestos semanales/s);
  assert.match(html, /Este mes.*todavía no hay presupuestos mensuales/s);
});

test("TRACK-3 · tarjeta de ritmo: refleja el estado real de cada cadencia por separado", () => {
  const context = cardSandbox({
    weeklySummary: { count: 2, totalBudgeted: 100, totalSpent: 90, status: "good", worstMessage: "" },
    monthlySummary: { count: 5, totalBudgeted: 900, totalSpent: 950, status: "danger", worstMessage: "comida: por encima del ritmo" },
  });
  const html = context.estadoSemanaBudgetRhythmHtml();
  assert.match(html, /€90 de €100/);
  assert.match(html, /€950 de €900/);
  assert.match(html, /Por encima del ritmo/);
  assert.match(html, /comida: por encima del ritmo/);
});

test("TRACK-3 · vencimientos de objetivos: sin motor E15, avisa en vez de fallar", () => {
  const context = cardSandbox({});
  assert.equal(context.estadoSemanaGoalDeadlines(), null);
  assert.match(context.estadoSemanaGoalDeadlinesHtml(), /no está disponible todavía/);
});

test("TRACK-3 · vencimientos de objetivos: sin ningún vencimiento próximo, lo dice explícitamente", () => {
  const context = cardSandbox({
    e15: { financialCalendar: () => ({ rows: [{ monthKey: "2026-09", label: "sep 2026", events: [{ type: "forecast" }] }] }) },
    p2Bridge: { goalPlanning: () => ({}) },
  });
  assert.match(context.estadoSemanaGoalDeadlinesHtml(), /Ningún objetivo vence/);
});

test("TRACK-3 · vencimientos de objetivos: extrae solo los eventos tipo \"goal\" de los próximos 6 meses", () => {
  const rows = Array.from({ length: 8 }, (_, i) => ({
    monthKey: `2026-${String(i + 1).padStart(2, "0")}`,
    label: `mes ${i + 1}`,
    events:
      i === 1
        ? [{ type: "goal", label: "Fecha objetivo: Vacaciones", amount: 400 }]
        : i === 7
          ? [{ type: "goal", label: "Fecha objetivo: Fuera de rango", amount: 999 }] // 8º mes: fuera de los 6 primeros
          : [{ type: "forecast", amount: 0 }],
  }));
  const context = cardSandbox({
    e15: { financialCalendar: () => ({ rows }) },
    p2Bridge: { goalPlanning: () => ({}) },
  });
  const deadlines = context.estadoSemanaGoalDeadlines();
  assert.equal(Array.from(deadlines).length, 1);
  const html = context.estadoSemanaGoalDeadlinesHtml();
  assert.match(html, /Vacaciones/);
  assert.doesNotMatch(html, /Fuera de rango/);
});

test("TRACK-3 · renderEstadoSemana no falla si el elemento raíz no existe todavía", () => {
  const context = cardSandbox({});
  assert.doesNotThrow(() => context.renderEstadoSemana());
});

test("TRACK-3 · renderEstadoSemana pinta las tres tarjetas dentro del elemento raíz", () => {
  const html = { innerHTML: "" };
  const context = cardSandbox({
    e16: { buildReadModel: () => ({ alerts: { alerts: [] } }) },
    p2Bridge: { e16Input: () => ({}), goalPlanning: () => ({}) },
    e15: { financialCalendar: () => ({ rows: [] }) },
  });
  context.qs = () => html;
  context.renderEstadoSemana();
  assert.match(html.innerHTML, /Empieza por aquí esta semana/);
  assert.match(html.innerHTML, /Alertas de caja anticipadas/);
  assert.match(html.innerHTML, /Ritmo de presupuesto/);
  assert.match(html.innerHTML, /próximos vencimientos/);
});

// ============================================================================
// Parte C: wiring — nav, chunk, dispatcher, lanzador y canario de publicación
// ============================================================================

test("TRACK-3 · la nueva pantalla está registrada en VIEW_CHUNKS, HEAVY_RENDER_VIEWS y el dispatcher", () => {
  assert.match(appSrc, /"estado-semana": \{ src: "views\/estado-semana\.js\?v=20260904a1", rootId: "estadoSemanaRoot" \}/);
  assert.match(appSrc, /"estado-semana",\n\]\);/);
  assert.match(appSrc, /case "estado-semana":\s*renderEstadoSemana\(\);/);
});

test("TRACK-3 · el enlace de navegación y la sección viven en index.html", () => {
  const html = read("index.html");
  assert.match(html, /<a href="#estado-semana" data-e17-group="analysis">Estado de la semana \(nuevo\)<\/a>/);
  assert.match(html, /<section class="[^"]*view-section" id="estado-semana">/);
  assert.match(html, /id="estadoSemanaRoot"/);
});

test("TRACK-3 · el lanzador (Buscar o abrir) encuentra la pantalla nueva", () => {
  const e17 = read("e17-experience.js");
  assert.match(e17, /\{ target: "estado-semana", label: "Estado de la semana \(nuevo\)"/);
  assert.match(e17, /"estado-semana": \["Para qué sirve"/);
});

test("TRACK-3 · los botones \"Ver ...\" de Estado de la semana navegan igual que el resto de la app", () => {
  assert.match(appSrc, /qs\("estadoSemanaRoot"\)\?\.addEventListener\("click", \(event\) => \{/);
});

test("TRACK-3 · canario de publicación: toda vista en VIEW_CHUNKS está en la lista de tools/build-public-site.mjs", () => {
  const chunkMatches = [...appSrc.matchAll(/src: "(views\/[^?"]+)\??[^"]*"/g)].map((m) => m[1]);
  assert.ok(chunkMatches.length >= 2, "debe haber al menos los chunks ya conocidos");
  const buildList = read("tools/build-public-site.mjs");
  for (const chunkSrc of new Set(chunkMatches)) {
    assert.ok(buildList.includes(`"${chunkSrc}"`), `${chunkSrc} está en VIEW_CHUNKS pero no en la lista de build-public-site.mjs — el sitio publicado la serviría con 404`);
  }
});

test("TRACK-3 · el chunk de estado-semana viaja versionado", () => {
  assert.match(appSrc, /views\/estado-semana\.js\?v=20260904a1/);
});
