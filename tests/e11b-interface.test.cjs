const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const html = read("index.html");
const app = read("app.js");
const worker = read("service-worker.js");
const state = read("state-contract.js");

test("E11b carga su contrato antes de la aplicación y funciona offline", () => {
  assert.ok(html.indexOf("canonical-e11b-inbox.js") < html.indexOf("app.js"));
  assert.match(worker, /canonical-e11b-inbox\.js/);
  assert.match(worker, /finanzas-casa-shell-20260814-f1a1/);
});

test("la bandeja común explica los cuatro pasos y puede desactivarse sin retirar flujos", () => {
  assert.match(html, /Bandeja previa común/);
  assert.match(html, /e19-stepper-badge">1<\/span>Origen[\s\S]*e19-stepper-badge">2<\/span>Columnas[\s\S]*e19-stepper-badge">3<\/span>Comparación[\s\S]*e19-stepper-badge">4<\/span>Confirmación/);
  assert.match(app, /function toggleE11bInbox/);
  assert.match(app, /Compatibilidad clásica activada/);
  assert.match(html, /excelDataFile/);
  assert.match(html, /batchDataInput/);
  assert.match(html, /movementExcelFile/);
});

test("CSV, Excel y extractos se preparan antes de escribir", () => {
  assert.match(app, /addE11bInboxItem\(\{ source: sourceLabel === "lote pegado"/);
  assert.match(app, /addE11bInboxItem\(\{ source: "excel-workbook"/);
  assert.match(app, /addE11bInboxItem\(\{ source: "bank-statement"/);
  assert.ok(app.indexOf("Vista previa · aún no se ha incorporado nada") < app.indexOf("function applyStagedMovementImport"));
  assert.match(app, /confirmMovementInbox/);
});

test("recibos, bandeja y compatibilidad sobreviven a copia y restauración", () => {
  assert.match(app, /dataInbox,/);
  assert.match(app, /updateReceipts,/);
  assert.match(app, /E11bInbox\.migratePayload/);
  assert.match(state, /"dataInbox", "updateReceipts"/);
  assert.match(state, /"debtRoadmapState", "e11b"/);
});

test("conciliación ofrece tareas seguras y la actualización muestra frescura", () => {
  assert.match(html, /Conciliación por tareas/);
  assert.match(app, /E11bInbox\.reconciliationTasks/);
  assert.match(html, /id="updateFreshness"/);
  assert.match(app, /E11bInbox\.freshness/);
});
