const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const html = read("index.html"); const app = read("app.js"); const p2 = read("p2-ui.js"); const schema = read("supabase_schema.sql");

test("E8 expone calidad, historial y presupuesto medible con semántica accesible", () => {
  assert.match(html, /id="e8QualityCenter"/);
  assert.match(html, /id="e8OperationalTimeline"/);
  assert.match(html, /id="e8PerformanceBudget"/);
  assert.match(app, /data-e8-quality-target/);
  assert.match(app, /setActiveView\(target, \{ focus: true \}\)/);
});

test("la restauración compara cuentas, movimientos, deuda, proyectos y ajustes", () => {
  assert.match(app, /compareVersions/);
  ["Cuentas", "Movimientos", "Deuda", "Proyectos", "Ajustes"].forEach((label) => assert.match(app, new RegExp(label)));
});

test("las alertas abren una revisión sin escribir", () => {
  assert.match(app, /data-alert-action="prepare"/);
  assert.match(app, /Ningún dato se ha modificado/);
});

test("los adjuntos remotos se cifran, limitan y permiten recuperación", () => {
  assert.match(p2, /P2PrivateStore\.encrypt/);
  assert.match(p2, /10 \* 1024 \* 1024/);
  assert.match(p2, /recuperable hasta/);
  assert.match(p2, /data-document-restore/);
  assert.match(p2, /Archivo descifrado y preparado/);
  assert.match(p2, /Confirmar recuperación 30 días/);
  assert.match(p2, /Confirmar borrado definitivo/);
  assert.match(schema, /finance-private-attachments/);
  assert.match(schema, /storage\.foldername/);
});
