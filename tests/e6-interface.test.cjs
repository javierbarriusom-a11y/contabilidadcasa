const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

test("Hoy permite revisar, guardar y retirar el ajuste de cobertura", () => {
  ["e6CoveragePanel", "e6NextIncomeDate", "e6DailyOutflow", "e6CoverageReset"].forEach((id) => assert.match(html, new RegExp(`id="${id}"`)));
  assert.match(app, /scenarioSettings\.e6Coverage/);
  assert.match(app, /saveScenarioSettings\(\)/);
  assert.match(app, /coverageUntilNextIncome/);
});

test("Datos y auditoría expone calidad contractual y metadatos de KPI", () => {
  assert.match(html, /id="e6DebtQuality"/);
  assert.match(html, /id="e6KpiQuality"/);
  assert.match(app, /renderE6DebtQuality/);
  assert.match(app, /renderE6KpiQuality/);
  assert.match(app, /Fuente:.*confianza/s);
});

test("la recuperación busca más allá de una tanda reciente inválida", () => {
  assert.equal((app.match(/\.limit\(20\)/g) || []).length, 2);
});

test("una restauración remota confirmada retira la cola local que sustituye", () => {
  assert.match(app, /await ensureDurableOutbox\(\)\.remove\(durableOutboxId\(\)\)/);
  assert.match(app, /durableResumeRecord = null;\s+remoteSaveQueue\?\.reset\(\);/);
});
