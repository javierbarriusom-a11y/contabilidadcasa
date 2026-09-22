const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.resolve(__dirname, "../views/debt-liquidation-plan.js"), "utf8");

// Detectado al añadir el gate de ESLint (ARQ-2): cirbeReduction (dic 2025 → mayo 2026) se calculaba
// en renderDebtLiquidationPlan() pero nunca se mostraba en ningún sitio — el panel «Fuentes y
// presión» (debtPlanSources) ya mostraba los dos totales por separado (CIRBE dic 2025 / CIRBE mayo
// 2026) sin su diferencia. Se cierra mostrando la reducción junto a esos mismos dos totales, en vez
// de como una quinta tarjeta de KPI nueva (la cuadrícula de arriba está deliberadamente acotada a
// 4 tarjetas de decisión estratégica, no es un volcado de datos).

test("debtPlanSources muestra la reducción CIRBE calculada junto a los totales de dic 2025 y mayo 2026", () => {
  const block = source.slice(source.indexOf("qs(\"debtPlanSources\")"), source.indexOf("qs(\"debtPlanSources\")") + 800);
  assert.match(block, /CIRBE dic 2025/);
  assert.match(block, /CIRBE mayo 2026/);
  assert.match(block, /Reducción desde dic 2025: \$\{money\(cirbeReduction, true\)\}/);
});

test("cirbeReduction sigue siendo december2025.total menos may2026.total, sin motor nuevo", () => {
  assert.match(source, /const cirbeReduction = round2\(assumptions\.cirbe\.december2025\.total - assumptions\.cirbe\.may2026\.total\);/);
});
