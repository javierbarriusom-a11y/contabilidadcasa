import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const E8 = require("../canonical-e8-operations.js");
const Forecast = require("../canonical-forecast.js");
const E13 = require("../canonical-e13-scenarios.js");
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
console.log(`Rendimiento verificado: diff 10.000 filas en ${elapsed.toFixed(1)} ms; forecast y escenarios en ${forecastElapsed.toFixed(1)} ms; recursos ${(assets / 1024).toFixed(0)} KB.`);
