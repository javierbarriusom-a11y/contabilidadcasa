const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// P11 (Horizonte 4 de BACKLOG_CONTABILIDADCASA_2_0.md): comparativa contra el mismo periodo del
// año anterior, por categoría — separa estacionalidad estructural (colegio, vacaciones...) de
// desviación real. Ningún motor nuevo: budgetExpenseTransactions() (ya usado por Presupuesto del
// mes/P8/revisión anual) da el gasto real de cada mes; el umbral es el mismo ya declarado en
// Ajustes (`partidaDeviationThreshold`, V6-2), no uno nuevo.

const appSource = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const analisisSource = fs.readFileSync(path.join(__dirname, "..", "views", "analisis.js"), "utf8");
const indexHtml = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

function extractFunction(name, source = appSource) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `No existe la función ${name}`);
  const parenStart = source.indexOf("(", start);
  let parenDepth = 0;
  let bodyStart = -1;
  for (let index = parenStart; index < source.length; index += 1) {
    if (source[index] === "(") parenDepth += 1;
    else if (source[index] === ")") {
      parenDepth -= 1;
      if (parenDepth === 0) { bodyStart = source.indexOf("{", index); break; }
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

function sandboxWith(names, extra = {}) {
  const context = { ...extra };
  vm.createContext(context);
  names.forEach((name) => vm.runInContext(extractFunction(name), context));
  return context;
}

function baseHelpers(extra = {}) {
  return {
    round2: (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100,
    money: (value) => `${Math.round(value)}€`,
    escapeHtml: (value) => String(value ?? ""),
    ledgerMonthLabel: (key) => `MES-${key}`,
    registrarMesSignedMoney: (value) => `${Number(value) > 0 ? "+" : ""}${Math.round(value)}€`,
    defaultBalanceDate: () => "2026-09-13",
    ...extra,
  };
}

function txn(category, month, amount) {
  return { category, month, amount };
}

// --- p11PriorYearMonthKey ----------------------------------------------------------------------

test("p11PriorYearMonthKey · resta un año manteniendo el mes", () => {
  const context = sandboxWith(["p11PriorYearMonthKey"], baseHelpers());
  assert.equal(context.p11PriorYearMonthKey("2026-09"), "2025-09");
});

test("p11PriorYearMonthKey · sin clave válida, cadena vacía", () => {
  const context = sandboxWith(["p11PriorYearMonthKey"], baseHelpers());
  assert.equal(context.p11PriorYearMonthKey("no-valido"), "");
  assert.equal(context.p11PriorYearMonthKey(""), "");
});

// --- p11YearOverYearCategoryComparison ----------------------------------------------------------

test("p11YearOverYearCategoryComparison · categoría estable (dentro del umbral) frente a categoría con desviación real", () => {
  const byCategory = new Map([
    ["colegio", [txn("colegio", "2026-09", -500), txn("colegio", "2025-09", -480)]],
    ["ocio", [txn("ocio", "2026-09", -300), txn("ocio", "2025-09", -100)]],
  ]);
  const context = sandboxWith(["p11PriorYearMonthKey", "p11CategoryExpenseTotal", "p11YearOverYearCategoryComparison"], baseHelpers({
    partidaDeviationThreshold: () => 10,
    budgetNegativeTransactionsByCategory: () => byCategory,
    budgetExpenseTransactions: (category, monthKey) => (byCategory.get(category) || []).filter((row) => row.month === monthKey),
  }));
  const rows = context.p11YearOverYearCategoryComparison("2026-09");
  const colegio = rows.find((row) => row.category === "colegio");
  const ocio = rows.find((row) => row.category === "ocio");
  assert.equal(colegio.hasPriorData, true);
  assert.equal(colegio.isRealDeviation, false);
  assert.equal(ocio.hasPriorData, true);
  assert.equal(ocio.isRealDeviation, true);
  // Ordenado por diferencia absoluta descendente: ocio (200) antes que colegio (20).
  assert.equal(rows[0].category, "ocio");
});

test("p11YearOverYearCategoryComparison · sin umbral configurado, no fabrica veredicto", () => {
  const byCategory = new Map([["ocio", [txn("ocio", "2026-09", -300), txn("ocio", "2025-09", -100)]]]);
  const context = sandboxWith(["p11PriorYearMonthKey", "p11CategoryExpenseTotal", "p11YearOverYearCategoryComparison"], baseHelpers({
    partidaDeviationThreshold: () => 0,
    budgetNegativeTransactionsByCategory: () => byCategory,
    budgetExpenseTransactions: (category, monthKey) => (byCategory.get(category) || []).filter((row) => row.month === monthKey),
  }));
  const rows = context.p11YearOverYearCategoryComparison("2026-09");
  assert.equal(rows[0].isRealDeviation, null);
});

test("p11YearOverYearCategoryComparison · categoría nueva sin gasto el año pasado no tiene veredicto de desviación", () => {
  const byCategory = new Map([["streaming-nuevo", [txn("streaming-nuevo", "2026-09", -15)]]]);
  const context = sandboxWith(["p11PriorYearMonthKey", "p11CategoryExpenseTotal", "p11YearOverYearCategoryComparison"], baseHelpers({
    partidaDeviationThreshold: () => 10,
    budgetNegativeTransactionsByCategory: () => byCategory,
    budgetExpenseTransactions: (category, monthKey) => (byCategory.get(category) || []).filter((row) => row.month === monthKey),
  }));
  const rows = context.p11YearOverYearCategoryComparison("2026-09");
  assert.equal(rows[0].hasPriorData, false);
  assert.equal(rows[0].isRealDeviation, null);
});

test("p11YearOverYearCategoryComparison · categoría sin gasto en ninguno de los dos meses no aparece", () => {
  const byCategory = new Map([["vacia", [txn("vacia", "2026-01", -50)]]]);
  const context = sandboxWith(["p11PriorYearMonthKey", "p11CategoryExpenseTotal", "p11YearOverYearCategoryComparison"], baseHelpers({
    partidaDeviationThreshold: () => 10,
    budgetNegativeTransactionsByCategory: () => byCategory,
    budgetExpenseTransactions: (category, monthKey) => (byCategory.get(category) || []).filter((row) => row.month === monthKey),
  }));
  const rows = context.p11YearOverYearCategoryComparison("2026-09");
  assert.equal(rows.length, 0);
});

// --- renderP11YearOverYearComparison ------------------------------------------------------------

test("renderP11YearOverYearComparison · sin filas, avisa en vez de pintar una tabla vacía", () => {
  const table = { innerHTML: "existing" };
  const note = { hidden: true, textContent: "" };
  const context = sandboxWith(
    ["p11PriorYearMonthKey", "p11CategoryExpenseTotal", "p11YearOverYearCategoryComparison", "p11YoyVerdictHtml", "renderP11YearOverYearComparison"],
    baseHelpers({
      partidaDeviationThreshold: () => 10,
      budgetNegativeTransactionsByCategory: () => new Map(),
      budgetExpenseTransactions: () => [],
      state: { balanceDate: "2026-09-13" },
      qs: (id) => ({ p11YoyComparisonTable: table, p11YoyComparisonNote: note }[id]),
    }),
  );
  context.renderP11YearOverYearComparison();
  assert.equal(table.innerHTML, "");
  assert.equal(note.hidden, false);
  assert.match(note.textContent, /Todavía no hay gasto registrado/);
});

test("renderP11YearOverYearComparison · con filas, pinta cabecera con los dos meses y las categorías", () => {
  const byCategory = new Map([
    ["colegio", [txn("colegio", "2026-09", -500), txn("colegio", "2025-09", -480)]],
    ["ocio", [txn("ocio", "2026-09", -300), txn("ocio", "2025-09", -100)]],
  ]);
  const table = { innerHTML: "" };
  const note = { hidden: true, textContent: "" };
  const context = sandboxWith(
    ["p11PriorYearMonthKey", "p11CategoryExpenseTotal", "p11YearOverYearCategoryComparison", "p11YoyVerdictHtml", "renderP11YearOverYearComparison"],
    baseHelpers({
      partidaDeviationThreshold: () => 10,
      budgetNegativeTransactionsByCategory: () => byCategory,
      budgetExpenseTransactions: (category, monthKey) => (byCategory.get(category) || []).filter((row) => row.month === monthKey),
      state: { balanceDate: "2026-09-13" },
      qs: (id) => ({ p11YoyComparisonTable: table, p11YoyComparisonNote: note }[id]),
    }),
  );
  context.renderP11YearOverYearComparison();
  assert.match(table.innerHTML, /MES-2026-09/);
  assert.match(table.innerHTML, /MES-2025-09/);
  assert.match(table.innerHTML, /ocio/);
  assert.match(table.innerHTML, /colegio/);
  assert.match(table.innerHTML, /Desviación real/);
  assert.match(table.innerHTML, /Estable \/ estacional/);
  assert.equal(note.hidden, true);
});

test("renderP11YearOverYearComparison · sin umbral configurado, avisa de que falta configurarlo", () => {
  const byCategory = new Map([["ocio", [txn("ocio", "2026-09", -300), txn("ocio", "2025-09", -100)]]]);
  const table = { innerHTML: "" };
  const note = { hidden: true, textContent: "" };
  const context = sandboxWith(
    ["p11PriorYearMonthKey", "p11CategoryExpenseTotal", "p11YearOverYearCategoryComparison", "p11YoyVerdictHtml", "renderP11YearOverYearComparison"],
    baseHelpers({
      partidaDeviationThreshold: () => 0,
      budgetNegativeTransactionsByCategory: () => byCategory,
      budgetExpenseTransactions: (category, monthKey) => (byCategory.get(category) || []).filter((row) => row.month === monthKey),
      state: { balanceDate: "2026-09-13" },
      qs: (id) => ({ p11YoyComparisonTable: table, p11YoyComparisonNote: note }[id]),
    }),
  );
  context.renderP11YearOverYearComparison();
  assert.equal(note.hidden, false);
  assert.match(note.textContent, /Configura el umbral de desviación por partida/);
});

// --- wiring ----------------------------------------------------------------------------------

test("wiring: views/analisis.js llama a renderP11YearOverYearComparison desde renderAnalisis", () => {
  const block = analisisSource.slice(analisisSource.indexOf("function renderAnalisis("));
  assert.match(block, /renderP11YearOverYearComparison\(\)/);
});

test("wiring: index.html declara la tabla y la nota dentro de la sección #analisis", () => {
  assert.match(indexHtml, /id="p11YoyComparisonTable"/);
  assert.match(indexHtml, /id="p11YoyComparisonNote"/);
  const sectionStart = indexHtml.indexOf('id="analisis"');
  const sectionEnd = indexHtml.indexOf("</section>", sectionStart);
  const tableIdx = indexHtml.indexOf('id="p11YoyComparisonTable"');
  assert.ok(sectionStart > 0 && tableIdx > sectionStart && tableIdx < sectionEnd, "La tabla debe vivir dentro de #analisis");
});
