/**
 * tests/uxb2-edicion-masiva.test.cjs
 *
 * UX-B2 (FASE 7): edición masiva ±X% de todo lo ya presupuestado este mes — útil tras una subida de
 * sueldo o un repunte de inflación, sin editar categoría por categoría. Reutiliza el mismo input de
 * ajuste porcentual de BUD-4 (mismo semántico ± %) y categoryBudgetsForMonth() (BUD-2, excluye
 * presupuestos de objetivo); solo ajusta lo que YA existe este mes, no crea presupuestos nuevos, y
 * conserva el `source` original de cada fila.
 *
 * - Parte A: handleBulkAdjustBudgets — cadena real sobre presupuestos sintéticos.
 * - Parte B: wiring estático — botón, listener de click, input reutilizado.
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
// Parte A: handleBulkAdjustBudgets — cadena real
// ============================================================================

function bulkSandbox({ budgetsData = [], monthKey = "2026-08", pctValue = "0" } = {}) {
  const saved = [];
  const rendered = [];
  const announced = [];
  const context = {
    budgets: budgetsData,
    window: { FinanceCanonicalBudgetSchema: { CanonicalBudgetSchema } },
    currentBudgetMonthKey: () => monthKey,
    isGoalBudgetCategoryId: (categoryId) => typeof categoryId === "string" && categoryId.startsWith("goal:"),
    saveBudgets: () => saved.push(context.budgets.map((b) => ({ ...b }))),
    renderPresupuestoMes: () => rendered.push(true),
    announceStatus: (message) => announced.push(message),
    round2: (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100,
  };
  vm.createContext(context);
  vm.runInContext(
    [extractFunction("categoryBudgetsForMonth"), extractFunction("handleBulkAdjustBudgets")].join("\n"),
    context,
    { filename: "app.js#uxb2-bulk" },
  );
  const button = { closest: () => ({ querySelector: () => ({ value: pctValue }) }) };
  return { context, saved, rendered, announced, button };
}

test("UX-B2 · un +10% multiplica por 1.1 cada presupuesto ya existente este mes", () => {
  const { context, saved, announced, button } = bulkSandbox({
    budgetsData: [
      { categoryId: "comida", monthYear: "2026-08", amountCap: 200, period: "monthly", source: "manual" },
      { categoryId: "ocio", monthYear: "2026-08", amountCap: 50, period: "monthly", source: "suggested" },
    ],
    pctValue: "10",
  });
  context.handleBulkAdjustBudgets(button);
  const comida = context.budgets.find((b) => b.categoryId === "comida");
  const ocio = context.budgets.find((b) => b.categoryId === "ocio");
  assert.equal(comida.amountCap, 220);
  assert.equal(ocio.amountCap, 55);
  assert.equal(saved.length, 1);
  assert.match(announced[0], /\+10% aplicado a 2 categorías/);
});

test("UX-B2 · el source original de cada fila se conserva tras el ajuste", () => {
  const { context, button } = bulkSandbox({
    budgetsData: [{ categoryId: "comida", monthYear: "2026-08", amountCap: 200, period: "monthly", source: "suggested" }],
    pctValue: "5",
  });
  context.handleBulkAdjustBudgets(button);
  assert.equal(context.budgets.find((b) => b.categoryId === "comida").source, "suggested");
});

test("UX-B2 · un ajuste negativo reduce el importe sin crear presupuestos nuevos", () => {
  const { context, button } = bulkSandbox({
    budgetsData: [{ categoryId: "comida", monthYear: "2026-08", amountCap: 200, period: "monthly", source: "manual" }],
    pctValue: "-20",
  });
  context.handleBulkAdjustBudgets(button);
  assert.equal(context.budgets.length, 1);
  assert.equal(context.budgets[0].amountCap, 160);
});

test("UX-B2 · un presupuesto de objetivo (goal:) no se toca, igual que BUD-4", () => {
  const { context, button } = bulkSandbox({
    budgetsData: [
      { categoryId: "comida", monthYear: "2026-08", amountCap: 200, period: "monthly", source: "manual" },
      { categoryId: "goal:vacaciones", monthYear: "2026-08", amountCap: 100, period: "monthly", source: "goal" },
    ],
    pctValue: "50",
  });
  context.handleBulkAdjustBudgets(button);
  assert.equal(context.budgets.find((b) => b.categoryId === "goal:vacaciones").amountCap, 100);
  assert.equal(context.budgets.find((b) => b.categoryId === "comida").amountCap, 300);
});

test("UX-B2 · sin presupuestos este mes, no guarda pero sí repinta y avisa", () => {
  const { context, saved, rendered, announced, button } = bulkSandbox({ budgetsData: [], pctValue: "10" });
  context.handleBulkAdjustBudgets(button);
  assert.equal(saved.length, 0);
  assert.equal(rendered.length, 1);
  assert.match(announced[0], /No hay presupuestos este mes/);
});

test("UX-B2 · un ajuste que dejaría el importe en 0 o negativo se omite (misma regla que BUD-4)", () => {
  const { context, button } = bulkSandbox({
    budgetsData: [{ categoryId: "comida", monthYear: "2026-08", amountCap: 200, period: "monthly", source: "manual" }],
    pctValue: "-100",
  });
  context.handleBulkAdjustBudgets(button);
  // amountCap habría quedado en 0: se descarta, el presupuesto original permanece intacto.
  assert.equal(context.budgets.find((b) => b.categoryId === "comida").amountCap, 200);
});

// ============================================================================
// Parte B: wiring estático
// ============================================================================

test("UX-B2 · el botón de ajuste masivo vive junto al de repetir mes anterior, reutilizando el mismo input", () => {
  assert.match(
    viewSrc,
    /data-presupuesto-mes-repeat>Repetir mes anterior ± %<\/button>\s*<button type="button" class="e19-btn e19-btn-secondary" data-presupuesto-mes-bulk-adjust>Aplicar ± % a todas<\/button>/,
  );
});

test("UX-B2 · el listener de click en presupuestoMesRoot despacha a handleBulkAdjustBudgets", () => {
  assert.match(appSrc, /data-presupuesto-mes-bulk-adjust[^\n]*\n\s*if \(bulkAdjustButton\) \{ handleBulkAdjustBudgets\(bulkAdjustButton\); return; \}/);
});

test('UX-B2 · "imported" también es una fuente válida en el esquema (necesaria para UX-B3)', () => {
  const valid = CanonicalBudgetSchema.validate({ categoryId: "comida", monthYear: "2026-08", amountCap: 100, source: "imported" });
  assert.ok(valid);
  assert.equal(valid.source, "imported");
});
