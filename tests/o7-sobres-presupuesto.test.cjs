/**
 * tests/o7-sobres-presupuesto.test.cjs
 *
 * #7 (plan de mejora post-E20, Ola 5): "presupuesto por sobres" — mover el sobrante ya disponible de
 * una categoría a otra del mismo mes, a media de mes, sin esperar al cierre. Confirmado como hueco
 * real (no existía en ningún otro rincón del código) tras verificar P-4. Reutiliza tal cual el único
 * camino de escritura de presupuestos ya existente (CanonicalBudgetSchema.upsert + saveBudgets, el
 * mismo de handleBudgetAmountChange/UX-B2/BUD-4) y el mismo cálculo de sobrante que ya usa la hucha
 * (budgetSurplusForRow/budgetSurplusEntries) — ningún motor nuevo.
 *
 * - Parte A: budgetEnvelopeTransferMaxAmount — tope real (sobrante menos un céntimo, nunca deja el
 *   presupuesto de origen en 0, que el esquema rechaza).
 * - Parte B: handleBudgetEnvelopeTransfer — cadena real: mueve, conserva el total, rechaza excesos,
 *   misma categoría, importe inválido; una sola persistencia por traspaso.
 * - Parte C: presupuestoMesEnvelopeHtml — sin sobrante o con una sola categoría presupuestada no
 *   aparece (hueco honesto); con sobrante y 2+ categorías, pinta ambos selects y el sobrante real.
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

const round2 = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

function baseContext({ budgetsData = [], spentByCategory = {} } = {}) {
  const announcements = [];
  const context = {
    budgets: budgetsData,
    window: { FinanceCanonicalBudgetSchema: { CanonicalBudgetSchema } },
    isGoalBudgetCategoryId: (categoryId) => typeof categoryId === "string" && categoryId.startsWith("goal:"),
    budgetAlertForRow: (budget) => ({ metrics: { spent: spentByCategory[budget.categoryId] || 0 } }),
    budgetRowDisplayLabel: (id) => id,
    money: (v) => `€${v}`,
    escapeHtml: (value) =>
      String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"),
    announceStatus: (msg) => announcements.push(msg),
    round2,
  };
  context.announcements = announcements;
  return context;
}

// ============================================================================
// Parte A: budgetEnvelopeTransferMaxAmount
// ============================================================================

function maxAmountSandbox(opts) {
  const context = baseContext(opts);
  vm.createContext(context);
  vm.runInContext(
    [extractFunction("categoryBudgetsForMonth"), extractFunction("budgetSurplusForRow"), extractFunction("budgetEnvelopeTransferMaxAmount")].join("\n"),
    context,
    { filename: "views/presupuesto-mes.js#o7-max" },
  );
  return context;
}

test("#7 · budgetEnvelopeTransferMaxAmount es el sobrante menos un céntimo (nunca deja el origen en 0)", () => {
  const budget = CanonicalBudgetSchema.create({ categoryId: "comida", monthYear: "2026-08", amountCap: 100, source: "manual" });
  const context = maxAmountSandbox({ budgetsData: [budget], spentByCategory: { comida: 0 } });
  assert.equal(context.budgetEnvelopeTransferMaxAmount("comida", "2026-08"), 99.99);
});

test("#7 · budgetEnvelopeTransferMaxAmount con gasto real limita al sobrante", () => {
  const budget = CanonicalBudgetSchema.create({ categoryId: "comida", monthYear: "2026-08", amountCap: 100, source: "manual" });
  const context = maxAmountSandbox({ budgetsData: [budget], spentByCategory: { comida: 40 } });
  assert.equal(context.budgetEnvelopeTransferMaxAmount("comida", "2026-08"), 60);
});

test("#7 · budgetEnvelopeTransferMaxAmount sin presupuesto en esa categoría/mes es 0", () => {
  const context = maxAmountSandbox({ budgetsData: [], spentByCategory: {} });
  assert.equal(context.budgetEnvelopeTransferMaxAmount("comida", "2026-08"), 0);
});

// ============================================================================
// Parte B: handleBudgetEnvelopeTransfer — cadena real
// ============================================================================

function transferSandbox(opts) {
  const saved = [];
  const rendered = [];
  const context = baseContext(opts);
  context.saveBudgets = () => saved.push(context.budgets.map((b) => ({ ...b })));
  context.renderPresupuestoMes = () => rendered.push(true);
  vm.createContext(context);
  vm.runInContext(
    [
      extractFunction("categoryBudgetsForMonth"),
      extractFunction("budgetSurplusForRow"),
      extractFunction("budgetEnvelopeTransferMaxAmount"),
      extractFunction("handleBudgetEnvelopeTransfer"),
    ].join("\n"),
    context,
    { filename: "views/presupuesto-mes.js#o7-transfer" },
  );
  return { context, saved, rendered };
}

function envelopeButton({ from, to, amount, monthKey = "2026-08" }) {
  const card = {
    querySelector: (sel) => {
      if (sel === "[data-presupuesto-mes-envelope-from]") return from === undefined ? null : { value: from };
      if (sel === "[data-presupuesto-mes-envelope-to]") return to === undefined ? null : { value: to };
      if (sel === "[data-presupuesto-mes-envelope-amount]") return { value: amount };
      return null;
    },
  };
  return { closest: () => card, dataset: { presupuestoMesEnvelopeMonth: monthKey } };
}

test("#7 · mueve el importe de origen a destino y persiste una sola vez", () => {
  const comida = CanonicalBudgetSchema.create({ categoryId: "comida", monthYear: "2026-08", amountCap: 100, source: "manual" });
  const ocio = CanonicalBudgetSchema.create({ categoryId: "ocio", monthYear: "2026-08", amountCap: 50, source: "manual" });
  const { context, saved, rendered } = transferSandbox({
    budgetsData: [comida, ocio],
    spentByCategory: { comida: 40, ocio: 10 },
  });
  context.handleBudgetEnvelopeTransfer(envelopeButton({ from: "comida", to: "ocio", amount: "30" }));
  const nextComida = context.budgets.find((b) => b.categoryId === "comida");
  const nextOcio = context.budgets.find((b) => b.categoryId === "ocio");
  assert.equal(nextComida.amountCap, 70);
  assert.equal(nextOcio.amountCap, 80);
  assert.equal(saved.length, 1, "una única persistencia por traspaso, no dos");
  assert.equal(rendered.length, 1);
  assert.match(context.announcements[0], /Movidos €30 de comida a ocio/);
});

test("#7 · conserva el total presupuestado entre origen y destino", () => {
  const comida = CanonicalBudgetSchema.create({ categoryId: "comida", monthYear: "2026-08", amountCap: 100, source: "manual" });
  const ocio = CanonicalBudgetSchema.create({ categoryId: "ocio", monthYear: "2026-08", amountCap: 50, source: "manual" });
  const totalBefore = comida.amountCap + ocio.amountCap;
  const { context } = transferSandbox({ budgetsData: [comida, ocio], spentByCategory: { comida: 0, ocio: 0 } });
  context.handleBudgetEnvelopeTransfer(envelopeButton({ from: "comida", to: "ocio", amount: "25" }));
  const totalAfter = context.budgets.reduce((sum, b) => sum + b.amountCap, 0);
  assert.equal(totalAfter, totalBefore);
});

test("#7 · no deja mover más de lo que sobra", () => {
  const comida = CanonicalBudgetSchema.create({ categoryId: "comida", monthYear: "2026-08", amountCap: 100, source: "manual" });
  const ocio = CanonicalBudgetSchema.create({ categoryId: "ocio", monthYear: "2026-08", amountCap: 50, source: "manual" });
  const { context, saved, rendered } = transferSandbox({
    budgetsData: [comida, ocio],
    spentByCategory: { comida: 40, ocio: 10 }, // sobrante comida = 60
  });
  context.handleBudgetEnvelopeTransfer(envelopeButton({ from: "comida", to: "ocio", amount: "61" }));
  assert.equal(context.budgets.find((b) => b.categoryId === "comida").amountCap, 100, "no cambia nada");
  assert.equal(saved.length, 0);
  assert.equal(rendered.length, 0);
  assert.match(context.announcements[0], /Como mucho puedes mover €60/);
});

test("#7 · rechaza mover a la misma categoría", () => {
  const comida = CanonicalBudgetSchema.create({ categoryId: "comida", monthYear: "2026-08", amountCap: 100, source: "manual" });
  const { context, saved } = transferSandbox({ budgetsData: [comida], spentByCategory: { comida: 0 } });
  context.handleBudgetEnvelopeTransfer(envelopeButton({ from: "comida", to: "comida", amount: "10" }));
  assert.equal(saved.length, 0);
  assert.match(context.announcements[0], /categorías distintas/);
});

test("#7 · rechaza un importe no numérico o menor/igual que 0", () => {
  const comida = CanonicalBudgetSchema.create({ categoryId: "comida", monthYear: "2026-08", amountCap: 100, source: "manual" });
  const ocio = CanonicalBudgetSchema.create({ categoryId: "ocio", monthYear: "2026-08", amountCap: 50, source: "manual" });
  const { context, saved } = transferSandbox({ budgetsData: [comida, ocio], spentByCategory: { comida: 0, ocio: 0 } });
  context.handleBudgetEnvelopeTransfer(envelopeButton({ from: "comida", to: "ocio", amount: "0" }));
  context.handleBudgetEnvelopeTransfer(envelopeButton({ from: "comida", to: "ocio", amount: "abc" }));
  assert.equal(saved.length, 0);
  assert.equal(context.announcements.length, 2);
  assert.match(context.announcements[0], /importe mayor que 0/);
});

test("#7 · sin categoría de origen o destino elegida, no hace nada", () => {
  const comida = CanonicalBudgetSchema.create({ categoryId: "comida", monthYear: "2026-08", amountCap: 100, source: "manual" });
  const { context, saved } = transferSandbox({ budgetsData: [comida], spentByCategory: { comida: 0 } });
  context.handleBudgetEnvelopeTransfer(envelopeButton({ from: undefined, to: "comida", amount: "10" }));
  assert.equal(saved.length, 0);
  assert.equal(context.announcements.length, 0, "sin datos suficientes para opinar, no anuncia nada");
});

test("#7 · se puede mover justo el tope calculado sin dejar el origen en 0", () => {
  const comida = CanonicalBudgetSchema.create({ categoryId: "comida", monthYear: "2026-08", amountCap: 100, source: "manual" });
  const ocio = CanonicalBudgetSchema.create({ categoryId: "ocio", monthYear: "2026-08", amountCap: 50, source: "manual" });
  const { context, saved } = transferSandbox({ budgetsData: [comida, ocio], spentByCategory: { comida: 0, ocio: 0 } });
  context.handleBudgetEnvelopeTransfer(envelopeButton({ from: "comida", to: "ocio", amount: "99.99" }));
  assert.equal(saved.length, 1);
  assert.equal(context.budgets.find((b) => b.categoryId === "comida").amountCap, 0.01);
});

// ============================================================================
// Parte C: presupuestoMesEnvelopeHtml
// ============================================================================

function envelopeHtmlSandbox(opts) {
  const context = baseContext(opts);
  vm.createContext(context);
  vm.runInContext(
    [
      extractFunction("categoryBudgetsForMonth"),
      extractFunction("budgetSurplusForRow"),
      extractFunction("budgetSurplusEntries"),
      extractFunction("presupuestoMesEnvelopeHtml"),
    ].join("\n"),
    context,
    { filename: "views/presupuesto-mes.js#o7-html" },
  );
  return context;
}

test("#7 · sin sobrante en ninguna categoría, la tarjeta no aparece", () => {
  const comida = CanonicalBudgetSchema.create({ categoryId: "comida", monthYear: "2026-08", amountCap: 100, source: "manual" });
  const ocio = CanonicalBudgetSchema.create({ categoryId: "ocio", monthYear: "2026-08", amountCap: 50, source: "manual" });
  const context = envelopeHtmlSandbox({ budgetsData: [comida, ocio], spentByCategory: { comida: 100, ocio: 50 } });
  assert.equal(context.presupuestoMesEnvelopeHtml("2026-08"), "");
});

test("#7 · con sobrante pero una sola categoría presupuestada, la tarjeta no aparece", () => {
  const comida = CanonicalBudgetSchema.create({ categoryId: "comida", monthYear: "2026-08", amountCap: 100, source: "manual" });
  const context = envelopeHtmlSandbox({ budgetsData: [comida], spentByCategory: { comida: 40 } });
  assert.equal(context.presupuestoMesEnvelopeHtml("2026-08"), "");
});

test("#7 · con sobrante y 2+ categorías, pinta los dos selects con el sobrante real", () => {
  const comida = CanonicalBudgetSchema.create({ categoryId: "comida", monthYear: "2026-08", amountCap: 100, source: "manual" });
  const ocio = CanonicalBudgetSchema.create({ categoryId: "ocio", monthYear: "2026-08", amountCap: 50, source: "manual" });
  const context = envelopeHtmlSandbox({ budgetsData: [comida, ocio], spentByCategory: { comida: 40, ocio: 50 } });
  const html = context.presupuestoMesEnvelopeHtml("2026-08");
  assert.match(html, /data-presupuesto-mes-envelope-from/);
  assert.match(html, /data-presupuesto-mes-envelope-to/);
  assert.match(html, /data-presupuesto-mes-envelope-submit/);
  assert.match(html, /comida · sobran €60/);
  assert.doesNotMatch(html, /ocio · sobran/, "ocio no tiene sobrante (gastado 50 de 50), no aparece como origen");
  assert.match(html, /<option value="ocio">ocio<\/option>/, "ocio sigue siendo un destino válido");
});

test("#7 · excluye presupuestos de objetivo tanto de origen como de destino", () => {
  const comida = CanonicalBudgetSchema.create({ categoryId: "comida", monthYear: "2026-08", amountCap: 100, source: "manual" });
  const goal = CanonicalBudgetSchema.create({ categoryId: "goal:g1", monthYear: "2026-08", amountCap: 200, source: "goal" });
  const context = envelopeHtmlSandbox({ budgetsData: [comida, goal], spentByCategory: { comida: 40, "goal:g1": 0 } });
  assert.equal(context.presupuestoMesEnvelopeHtml("2026-08"), "", "solo queda una categoría bancaria real, no hay dos entre las que mover");
});

// ============================================================================
// Parte D: wiring estático
// ============================================================================

test("#7 · el control de mover sobrante vive en el HTML de Presupuesto del mes", () => {
  assert.match(viewSrc, /data-presupuesto-mes-envelope-from/);
  assert.match(viewSrc, /data-presupuesto-mes-envelope-to/);
  assert.match(viewSrc, /data-presupuesto-mes-envelope-amount/);
  assert.match(viewSrc, /data-presupuesto-mes-envelope-submit/);
});

test("#7 · el listener de click de Presupuesto del mes llama a handleBudgetEnvelopeTransfer", () => {
  assert.match(appSrc, /data-presupuesto-mes-envelope-submit\]/);
  assert.match(appSrc, /handleBudgetEnvelopeTransfer\(envelopeButton\)/);
});
