import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const E8 = require("../canonical-e8-operations.js");
const Forecast = require("../canonical-forecast.js");
const E13 = require("../canonical-e13-scenarios.js");
const BudgetAnalyzer = require("../canonical-budget-analyzer.js").CanonicalBudgetAnalyzer;
const BudgetAlerts = require("../canonical-budget-alerts.js").CanonicalBudgetAlerts;
const BudgetForecastCategory = require("../canonical-budget-forecast-category.js").CanonicalBudgetForecastCategory;
const BudgetSchema = require("../canonical-budget-schema.js").CanonicalBudgetSchema;
const rows = Array.from({ length: 10000 }, (_, index) => ({ id: `movement-${index}`, amount: index, month: `2026-${String(index % 12 + 1).padStart(2, "0")}` }));
const started = performance.now();
const result = E8.collectionDiff(rows, rows.map((row, index) => index === 9999 ? { ...row, amount: -1 } : row));
const elapsed = performance.now() - started;
if (result.count !== 1) throw new Error("La prueba de volumen perdió cambios");
if (elapsed > 500) throw new Error(`Comparar 10.000 filas tardó ${elapsed.toFixed(1)} ms`);
const periods = Array.from({ length: 10000 }, (_, index) => ({
  index, monthKey: `20${String(26 + Math.floor(index / 12)).padStart(2, "0")}-${String(index % 12 + 1).padStart(2, "0")}`,
  month: `Periodo ${index + 1}`, income: 3000, coreSpend: 1800, variableOperationalSpend: 500,
}));
const scenario = { fingerprint: "performance", invariants: { valid: true }, rows: periods.map((month, index) => ({
  ...month, income: 3000, outflowsBeforeSaving: 2300, saving: 300, checking: 1000 + index, savings: index, totalLiquidity: 1000 + index * 2,
})) };
const forecastStarted = performance.now();
const forecast = Forecast.buildForecast({ openingBalances: { checking: 1000, savings: 0 }, policy: { incomeFactor: 1, annualIncomeGrowth: 0, expenseFactor: 1, annualInflation: 0, plannedMonthlySaving: 300, autoCapSavings: true }, months: periods }, scenario);
E13.buildLab(forecast, [{ id: "stress", type: "expense", monthKey: periods[0].monthKey, amount: 100, duration: 2 }]);
const forecastElapsed = performance.now() - forecastStarted;
if (!forecast.valid || forecast.series.length !== 10000) throw new Error("Forecast de 10.000 periodos inválido");
if (forecastElapsed > 1000) throw new Error(`Forecast y escenarios con 10.000 periodos tardaron ${forecastElapsed.toFixed(1)} ms`);
const assets = ["app.js", "styles.css", "data.js"].reduce((sum, name) => sum + fs.statSync(new URL(`../${name}`, import.meta.url)).size, 0);
if (assets > 5 * 1024 * 1024) throw new Error(`Los recursos principales superan 5 MB: ${assets}`);

// SCALE-1 (FASE 6): auditoría de presupuestos a 1000 categorías × 10 años de histórico (120 meses).
// Encontró y corrigió un O(categorías × transacciones) real en budgetHistoricalExpenseTransactions/
// budgetExpenseTransactions (app.js): filtraban baseData.transactions entero por cada categoría —
// ~4 s a esta escala. Este bloque reproduce esa escala contra el código ya corregido para que una
// regresión futura (volver a filtrar el array completo por categoría) se note aquí, no en producción.
const CATEGORY_COUNT = 1000;
const HISTORY_MONTHS = 10 * 12;
const categoryMovements = {};
for (let c = 0; c < CATEGORY_COUNT; c += 1) {
  const movements = [];
  for (let m = 0; m < HISTORY_MONTHS; m += 1) {
    const year = 2016 + Math.floor(m / 12);
    const month = (m % 12) + 1;
    for (let e = 0; e < 3; e += 1) {
      movements.push({ date: `${year}-${String(month).padStart(2, "0")}-${String(1 + (e % 27)).padStart(2, "0")}`, amount: -(20 + ((c + m + e) % 50)) });
    }
  }
  categoryMovements[`cat-${c}`] = movements;
}
const analyzerStarted = performance.now();
const analyses = BudgetAnalyzer.analyzeBatch(categoryMovements, { months: 12 });
const analyzerElapsed = performance.now() - analyzerStarted;
if (Object.keys(analyses).length !== CATEGORY_COUNT) throw new Error("El análisis de presupuestos perdió categorías a escala");
if (analyzerElapsed > 2000) throw new Error(`Analizar ${CATEGORY_COUNT} categorías tardó ${analyzerElapsed.toFixed(1)} ms`);

const alertsStarted = performance.now();
const budgetsByCategory = Object.fromEntries(Object.entries(analyses).map(([id, analysis]) => [id, analysis?.recommendation || 100]));
const alerts = BudgetAlerts.calculateBatch(budgetsByCategory, categoryMovements, analyses, { today: new Date("2026-08-15") });
const alertsElapsed = performance.now() - alertsStarted;
if (Object.keys(alerts).length !== CATEGORY_COUNT) throw new Error("Las alertas de presupuesto perdieron categorías a escala");
if (alertsElapsed > 2000) throw new Error(`Calcular alertas de ${CATEGORY_COUNT} categorías tardó ${alertsElapsed.toFixed(1)} ms`);

const forecastStartedBudget = performance.now();
let forecastCount = 0;
for (const movements of Object.values(categoryMovements)) {
  if (BudgetForecastCategory.forecast(movements, { months: 12, forecastMonths: 3 })) forecastCount += 1;
}
const forecastElapsedBudget = performance.now() - forecastStartedBudget;
if (forecastCount !== CATEGORY_COUNT) throw new Error("El forecast por categoría perdió categorías a escala");
if (forecastElapsedBudget > 2000) throw new Error(`Forecast por categoría de ${CATEGORY_COUNT} categorías tardó ${forecastElapsedBudget.toFixed(1)} ms`);

const budgets = [];
for (let m = 0; m < HISTORY_MONTHS; m += 1) {
  const year = 2016 + Math.floor(m / 12);
  const monthYear = `${year}-${String((m % 12) + 1).padStart(2, "0")}`;
  for (let c = 0; c < CATEGORY_COUNT; c += 1) budgets.push({ id: `b-${m}-${c}`, categoryId: `cat-${c}`, monthYear, amountCap: 100, source: "manual" });
}
const schemaStarted = performance.now();
for (let m = 0; m < 12; m += 1) BudgetSchema.byCategory(budgets, `2025-${String(m + 1).padStart(2, "0")}`);
const schemaElapsed = performance.now() - schemaStarted;
if (schemaElapsed > 1000) throw new Error(`Leer 12 meses de histórico sobre ${budgets.length} presupuestos tardó ${schemaElapsed.toFixed(1)} ms`);

// El índice por categoría de app.js (budgetNegativeTransactionsByCategory) vive fuera de los
// módulos canónicos — se extrae su texto (mismo patrón que usan los tests de app.js, que no es
// `require`-able por ser un <script> de navegador) para medirlo igual que al resto.
const appSource = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
function extractFunction(name) {
  const start = appSource.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`No existe ${name} en app.js`);
  let depth = 0;
  let bodyStart = -1;
  for (let index = start; index < appSource.length; index += 1) {
    if (appSource[index] === "{") {
      if (bodyStart < 0) bodyStart = index;
      depth += 1;
    } else if (appSource[index] === "}") {
      depth -= 1;
      if (depth === 0) return appSource.slice(start, index + 1);
    }
  }
  throw new Error(`${name} no cierra sus llaves`);
}
const transactions = [];
for (let m = 0; m < HISTORY_MONTHS; m += 1) {
  const year = 2016 + Math.floor(m / 12);
  const monthKey = `${year}-${String((m % 12) + 1).padStart(2, "0")}`;
  for (let c = 0; c < CATEGORY_COUNT; c += 1) {
    for (let e = 0; e < 3; e += 1) transactions.push({ category: `cat-${c}`, month: monthKey, amount: -(20 + e) });
  }
}
const context = { baseData: { transactions } };
vm.createContext(context);
vm.runInContext(
  [
    "let budgetTransactionsByCategoryCache = { source: null, byCategory: null };",
    ...["budgetNegativeTransactionsByCategory", "budgetExpenseTransactions", "budgetHistoricalExpenseTransactions"].map(extractFunction),
  ].join("\n"),
  context,
);
const indexStarted = performance.now();
let historicalRows = 0;
for (let c = 0; c < CATEGORY_COUNT; c += 1) historicalRows += context.budgetHistoricalExpenseTransactions(`cat-${c}`, "2026-01").length;
const indexElapsed = performance.now() - indexStarted;
if (historicalRows !== transactions.length) throw new Error("El índice de transacciones por categoría perdió filas");
if (indexElapsed > 1500) throw new Error(`Historial por categoría de ${CATEGORY_COUNT} categorías (${transactions.length} transacciones) tardó ${indexElapsed.toFixed(1)} ms`);

console.log(`Rendimiento verificado: diff 10.000 filas en ${elapsed.toFixed(1)} ms; forecast y escenarios en ${forecastElapsed.toFixed(1)} ms; recursos ${(assets / 1024).toFixed(0)} KB; presupuestos a escala (${CATEGORY_COUNT} categorías × ${HISTORY_MONTHS / 12} años) — análisis ${analyzerElapsed.toFixed(1)} ms, alertas ${alertsElapsed.toFixed(1)} ms, forecast ${forecastElapsedBudget.toFixed(1)} ms, histórico de presupuestos ${schemaElapsed.toFixed(1)} ms, índice de transacciones por categoría ${indexElapsed.toFixed(1)} ms.`);
