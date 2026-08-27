/**
 * tests/track2-historial-cumplimiento.test.cjs
 *
 * TRACK-2 (FASE 7): historial de cumplimiento por categoría (racha on-track/overspend). Amplía la
 * tarjeta ya existente de GAME-1 ("Objetivos: meses seguidos dentro de presupuesto") en vez de crear
 * una tarjeta nueva que duplicaría el "Histórico de 12 meses" de S-3: la racha ACTUAL de GAME-1 ya
 * existía (`budgetComplianceStreak`), esta tarea añade la MEJOR racha histórica (un récord que no se
 * pierde solo porque la racha viva se rompa) y una secuencia visual compacta de cumplimiento de los
 * últimos 6 meses. Ninguna de las dos existía antes; GAME-1/GAME-2 no tenían tests dedicados, así que
 * este fichero también cubre `budgetComplianceStreak` (ya existente) como base.
 *
 * - Parte A: cadena real de cálculo — budgetLongestComplianceStreak/budgetComplianceHistorySequenceHtml
 *   sobre presupuestos y alertas sintéticos.
 * - Parte B: presupuestoMesGoalsHtml — la tabla ampliada a 4 columnas, motores mockeados en el límite.
 * - Parte C: wiring estático — versión del chunk.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const { CanonicalBudgetSchema } = require("../canonical-budget-schema.js");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const appSrc = read("app.js");
const viewSrc = read("views/presupuesto-mes.js");
const app = appSrc + "\n" + viewSrc;

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

// ============================================================================
// Parte A: cadena real de cálculo
// ============================================================================

// Presupuestos sintéticos mes a mes para "comida", con un `amountCap` fijo y un `spent` controlado
// por mes vía el mapa `spentByMonth` — evita reconstruir baseData.transactions/CanonicalBudgetAlerts
// completos para probar solo la mecánica de rachas (ya cubierta con datos reales en BUD-1/S-1).
function computationSandbox(spentByMonth, { amountCap = 100 } = {}) {
  const monthKeys = Object.keys(spentByMonth);
  const budgetsData = monthKeys.map((monthKey) => ({ categoryId: "comida", monthYear: monthKey, amountCap, source: "manual" }));
  const context = {
    budgets: budgetsData,
    window: { FinanceCanonicalBudgetSchema: { CanonicalBudgetSchema } },
    budgetAlertForRow: (budget, monthKey) => ({ metrics: { spent: spentByMonth[monthKey] } }),
    escapeHtml: (value) =>
      String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"),
    ledgerMonthLabel: (monthKey) => monthKey,
  };
  vm.createContext(context);
  vm.runInContext(
    [
      extractFunction("previousBudgetMonthKey"),
      extractFunction("recentBudgetMonthKeys"),
      extractFunction("budgetHistoryMonthKeys"),
      extractFunction("budgetComplianceStreak"),
      extractFunction("budgetLongestComplianceStreak"),
      extractFunction("budgetComplianceHistorySequenceHtml"),
    ].join("\n"),
    context,
    { filename: "app.js#track2-computation" },
  );
  return context;
}

test("TRACK-2 · budgetLongestComplianceStreak: sin presupuestos, 0", () => {
  const context = computationSandbox({});
  assert.equal(context.budgetLongestComplianceStreak("comida", "2026-07"), 0);
});

test("TRACK-2 · budgetLongestComplianceStreak: racha ininterrumpida coincide con budgetComplianceStreak", () => {
  const spentByMonth = { "2026-05": 50, "2026-06": 60, "2026-07": 70 }; // los tres dentro de 100
  const context = computationSandbox(spentByMonth);
  assert.equal(context.budgetComplianceStreak("comida", "2026-07"), 3);
  assert.equal(context.budgetLongestComplianceStreak("comida", "2026-07"), 3);
});

test("TRACK-2 · budgetLongestComplianceStreak: recuerda una racha mejor que ya se rompió, sin que la actual la borre", () => {
  // Ene-Abr dentro de presupuesto (racha de 4), Mayo sobregasto, Jun-Jul dentro (racha viva de 2).
  const spentByMonth = {
    "2026-01": 50,
    "2026-02": 50,
    "2026-03": 50,
    "2026-04": 50,
    "2026-05": 150, // sobregasto: rompe la racha
    "2026-06": 50,
    "2026-07": 50,
  };
  const context = computationSandbox(spentByMonth);
  assert.equal(context.budgetComplianceStreak("comida", "2026-07"), 2, "la racha actual solo ve junio y julio");
  assert.equal(context.budgetLongestComplianceStreak("comida", "2026-07"), 4, "la mejor racha sigue siendo la de enero-abril");
});

test("TRACK-2 · budgetLongestComplianceStreak se detiene en el primer mes sin presupuesto", () => {
  const spentByMonth = { "2026-06": 50, "2026-07": 50 }; // solo dos meses con presupuesto
  const context = computationSandbox(spentByMonth);
  assert.equal(context.budgetLongestComplianceStreak("comida", "2026-07"), 2);
});

test("TRACK-2 · budgetComplianceHistorySequenceHtml: ✓ dentro de presupuesto, ✗ sobregasto, · sin presupuesto", () => {
  const spentByMonth = { "2026-04": 50, "2026-05": 150, "2026-07": 50 }; // junio queda sin presupuesto
  const context = computationSandbox(spentByMonth);
  const html = context.budgetComplianceHistorySequenceHtml("comida", "2026-07", 4);
  // Orden cronológico: 2026-04 (✓), 2026-05 (✗), 2026-06 (·), 2026-07 (✓)
  assert.match(html, /e19-badge-success" title="2026-04: dentro de presupuesto">✓/);
  assert.match(html, /e19-badge-danger" title="2026-05: sobregasto">✗/);
  assert.match(html, /title="2026-06: sin presupuesto">·/);
  assert.match(html, /e19-badge-success" title="2026-07: dentro de presupuesto">✓/);
});

// ============================================================================
// Parte B: presupuestoMesGoalsHtml — tabla ampliada
// ============================================================================

function viewSandbox({ categoryBudgets = [], streak = 0, best = 0, history = "" } = {}) {
  const context = {
    categoryBudgetsForMonth: () => categoryBudgets,
    budgetComplianceStreak: () => streak,
    budgetLongestComplianceStreak: () => best,
    budgetComplianceHistorySequenceHtml: () => history,
    escapeHtml: (value) =>
      String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"),
  };
  vm.createContext(context);
  vm.runInContext(extractFunction("presupuestoMesGoalsHtml"), context, { filename: "app.js#track2-view" });
  return context;
}

test("TRACK-2 · presupuestoMesGoalsHtml sin presupuestos del mes no pinta nada", () => {
  const context = viewSandbox({ categoryBudgets: [] });
  assert.equal(context.presupuestoMesGoalsHtml("2026-07"), "");
});

test("TRACK-2 · presupuestoMesGoalsHtml pinta las cuatro columnas: racha actual, mejor racha e historial", () => {
  const context = viewSandbox({
    categoryBudgets: [{ categoryId: "comida", amountCap: 300 }],
    streak: 2,
    best: 5,
    history: "<span>✓</span>",
  });
  const html = context.presupuestoMesGoalsHtml("2026-07");
  assert.match(html, /<th>Categoría<\/th><th>Racha actual<\/th><th>Mejor racha<\/th><th>Últimos 6 meses<\/th>/);
  assert.match(html, /<td class="t">comida<\/td>/);
  assert.match(html, /<td>2 meses seguidos<\/td>/);
  assert.match(html, /<td>5 meses<\/td>/);
  assert.match(html, /<td><span>✓<\/span><\/td>/);
});

test("TRACK-2 · presupuestoMesGoalsHtml usa singular para racha/mejor racha de 1 mes", () => {
  const context = viewSandbox({ categoryBudgets: [{ categoryId: "ocio", amountCap: 100 }], streak: 1, best: 1 });
  const html = context.presupuestoMesGoalsHtml("2026-07");
  assert.match(html, /<td>1 mes seguido<\/td>/);
  assert.match(html, /<td>1 mes<\/td>/);
});

// ============================================================================
// Parte C: wiring estático
// ============================================================================

test("TRACK-2 · la versión del chunk de Presupuesto del mes está actualizada", () => {
  assert.match(appSrc, /views\/presupuesto-mes\.js\?v=20260827g1/);
});
