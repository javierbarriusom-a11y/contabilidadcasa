/**
 * tests/bud4-repetir-presupuesto.test.cjs
 *
 * BUD-4 (FASE 7): plantilla "repetir presupuesto del mes anterior ± X%". Evita tener que pulsar
 * "Sugerir presupuestos" (recalcula desde cero contra el histórico) cada mes cuando lo único que se
 * quiere es partir de lo ya presupuestado. Sin motor nuevo: reutiliza categoryBudgetsForMonth()
 * (BUD-2, ya excluye los presupuestos de objetivo) y el mismo upsert/saveBudgets que "Sugerir".
 *
 * - Parte A: "repeated" es una fuente válida en el esquema (mismo patrón que "goal" de BUD-2).
 * - Parte B: handleRepeatPreviousMonthBudgets — cadena real sobre presupuestos sintéticos.
 * - Parte C: presupuestoMesRowHtml muestra la nota "repetido" para esta fuente.
 * - Parte D: wiring estático — control en el HTML, listener de click, versión de app.js.
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
// Parte A: "repeated" es una fuente válida en el esquema
// ============================================================================

test('BUD-4 · "repeated" es una fuente válida en el esquema de presupuestos', () => {
  const valid = CanonicalBudgetSchema.validate({ categoryId: "comida", monthYear: "2026-08", amountCap: 100, source: "repeated" });
  assert.ok(valid);
  assert.equal(valid.source, "repeated");
});

test("BUD-4 · una fuente desconocida sigue siendo inválida", () => {
  assert.equal(CanonicalBudgetSchema.validate({ categoryId: "comida", monthYear: "2026-08", amountCap: 100, source: "invento" }), null);
});

// ============================================================================
// Parte B: handleRepeatPreviousMonthBudgets — cadena real
// ============================================================================

function repeatSandbox({ budgetsData = [], monthKey = "2026-08", pctValue = "0" } = {}) {
  const saved = [];
  const rendered = [];
  const context = {
    budgets: budgetsData,
    window: { FinanceCanonicalBudgetSchema: { CanonicalBudgetSchema } },
    currentBudgetMonthKey: () => monthKey,
    isGoalBudgetCategoryId: (categoryId) => typeof categoryId === "string" && categoryId.startsWith("goal:"),
    saveBudgets: () => saved.push(context.budgets.map((b) => ({ ...b }))),
    renderPresupuestoMes: () => rendered.push(true),
    round2: (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100,
  };
  vm.createContext(context);
  vm.runInContext(
    [extractFunction("previousBudgetMonthKey"), extractFunction("categoryBudgetsForMonth"), extractFunction("handleRepeatPreviousMonthBudgets")].join(
      "\n",
    ),
    context,
    { filename: "app.js#bud4-repeat" },
  );
  const button = { closest: () => ({ querySelector: () => ({ value: pctValue }) }) };
  return { context, saved, rendered, button };
}

test("BUD-4 · sin presupuestos el mes anterior, no crea nada pero sí repinta", () => {
  const { context, saved, rendered, button } = repeatSandbox({ budgetsData: [] });
  context.handleRepeatPreviousMonthBudgets(button);
  assert.equal(context.budgets.length, 0);
  assert.equal(saved.length, 0, "sin cambios, no hace falta persistir");
  assert.equal(rendered.length, 1, "repinta siempre, para reflejar el estado tal cual queda");
});

test("BUD-4 · copia el presupuesto del mes anterior sin ajuste (0%)", () => {
  const previous = CanonicalBudgetSchema.create({ categoryId: "comida", monthYear: "2026-07", amountCap: 100, source: "manual" });
  const { context, saved, button } = repeatSandbox({ budgetsData: [previous], pctValue: "0" });
  context.handleRepeatPreviousMonthBudgets(button);
  const created = context.budgets.find((b) => b.monthYear === "2026-08" && b.categoryId === "comida");
  assert.ok(created, "debe crear el presupuesto de agosto");
  assert.equal(created.amountCap, 100);
  assert.equal(created.source, "repeated");
  assert.equal(saved.length, 1);
});

test("BUD-4 · aplica el ajuste porcentual indicado (+10% y -20%)", () => {
  const previous = CanonicalBudgetSchema.create({ categoryId: "comida", monthYear: "2026-07", amountCap: 100, source: "manual" });

  const up = repeatSandbox({ budgetsData: [previous], pctValue: "10" });
  up.context.handleRepeatPreviousMonthBudgets(up.button);
  assert.equal(up.context.budgets.find((b) => b.monthYear === "2026-08").amountCap, 110);

  const down = repeatSandbox({ budgetsData: [previous], pctValue: "-20" });
  down.context.handleRepeatPreviousMonthBudgets(down.button);
  assert.equal(down.context.budgets.find((b) => b.monthYear === "2026-08").amountCap, 80);
});

test("BUD-4 · no repite presupuestos de objetivo (categoryId \"goal:...\")", () => {
  const goalBudget = CanonicalBudgetSchema.create({ categoryId: "goal:g1", monthYear: "2026-07", amountCap: 50, source: "goal" });
  const { context, button } = repeatSandbox({ budgetsData: [goalBudget] });
  context.handleRepeatPreviousMonthBudgets(button);
  assert.equal(context.budgets.length, 1, "el objetivo no se toca, y no se crea nada nuevo para agosto");
});

test("BUD-4 · no duplica una categoría que ya tiene presupuesto este mes", () => {
  const previous = CanonicalBudgetSchema.create({ categoryId: "comida", monthYear: "2026-07", amountCap: 100, source: "manual" });
  const already = CanonicalBudgetSchema.create({ categoryId: "comida", monthYear: "2026-08", amountCap: 999, source: "manual" });
  const { context, saved, button } = repeatSandbox({ budgetsData: [previous, already] });
  context.handleRepeatPreviousMonthBudgets(button);
  const augustEntries = context.budgets.filter((b) => b.monthYear === "2026-08" && b.categoryId === "comida");
  assert.equal(augustEntries.length, 1);
  assert.equal(augustEntries[0].amountCap, 999, "el presupuesto ya existente de agosto no se sobrescribe");
  assert.equal(saved.length, 0);
});

test("BUD-4 · un ajuste que deja el importe en cero o negativo no crea el presupuesto", () => {
  const previous = CanonicalBudgetSchema.create({ categoryId: "comida", monthYear: "2026-07", amountCap: 100, source: "manual" });
  const { context, button } = repeatSandbox({ budgetsData: [previous], pctValue: "-100" });
  context.handleRepeatPreviousMonthBudgets(button);
  assert.equal(context.budgets.length, 1, "solo queda el presupuesto original de julio, no se crea el de agosto");
});

// ============================================================================
// Parte C: presupuestoMesRowHtml — nota "repetido"
// ============================================================================

function rowSandbox({ alert, projection }) {
  const context = {
    budgetAlertForRow: () => alert,
    budgetProjection: () => projection,
    budgetRowDisplayLabel: (id) => id,
    money: (v) => `€${v}`,
    escapeHtml: (value) =>
      String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"),
  };
  vm.createContext(context);
  vm.runInContext([extractFunction("presupuestoMesStatusPill"), extractFunction("presupuestoMesRowHtml")].join("\n"), context, {
    filename: "views/presupuesto-mes.js#bud4-row",
  });
  return context;
}

test('BUD-4 · presupuestoMesRowHtml marca "repetido" para un presupuesto repetido', () => {
  const context = rowSandbox({
    alert: { status: "on-track", metrics: { spent: 50, deviationPercent: 0 } },
    projection: { projected: 100, diff: 0 },
  });
  const html = context.presupuestoMesRowHtml({ categoryId: "comida", amountCap: 110, source: "repeated" }, "2026-08");
  assert.match(html, /<small class="note">repetido<\/small>/);
});

test("BUD-4 · presupuestoMesRowHtml no marca nada para un presupuesto manual", () => {
  const context = rowSandbox({
    alert: { status: "on-track", metrics: { spent: 50, deviationPercent: 0 } },
    projection: { projected: 100, diff: 0 },
  });
  const html = context.presupuestoMesRowHtml({ categoryId: "comida", amountCap: 110, source: "manual" }, "2026-08");
  assert.doesNotMatch(html, /<small class="note">repetido<\/small>/);
  assert.doesNotMatch(html, /<small class="note">sugerido<\/small>/);
});

// ============================================================================
// Parte D: wiring estático
// ============================================================================

test("BUD-4 · el control de repetir vive en el HTML de Presupuesto del mes", () => {
  assert.match(viewSrc, /data-presupuesto-mes-repeat-pct/);
  assert.match(viewSrc, /data-presupuesto-mes-repeat>Repetir mes anterior/);
});

test("BUD-4 · el listener de click de Presupuesto del mes llama a handleRepeatPreviousMonthBudgets", () => {
  assert.match(appSrc, /data-presupuesto-mes-repeat\]/);
  assert.match(appSrc, /handleRepeatPreviousMonthBudgets\(repeatButton\)/);
});
