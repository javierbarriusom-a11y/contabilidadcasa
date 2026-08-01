const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const ui = fs.readFileSync(path.join(root, "p2-ui.js"), "utf8");
const worker = fs.readFileSync(path.join(root, "service-worker.js"), "utf8");

test("el shell carga y cachea los contratos E9 antes de mostrar colaboración", () => {
  assert.match(html, /canonical-e9-foundation\.js/);
  assert.match(html, /canonical-e9-household\.js/);
  assert.match(html, /canonical-e9-assistant\.js/);
  assert.match(html, /canonical-e9-actions\.js/);
  assert.match(html, /canonical-e9-notifications\.js/);
  assert.match(html, /canonical-e9-banking\.js/);
  assert.match(html, /canonical-e9-bank-import\.js/);
  assert.match(worker, /canonical-e9-foundation\.js/);
  assert.match(worker, /canonical-e9-household\.js/);
  assert.match(worker, /canonical-e9-assistant\.js/);
  assert.match(worker, /canonical-e9-actions\.js/);
  assert.match(worker, /canonical-e9-notifications\.js/);
  assert.match(worker, /canonical-e9-banking\.js/);
  assert.match(worker, /canonical-e9-bank-import\.js/);
});

test("la interfaz bancaria conserva desactivación y fallback manual", () => {
  assert.match(ui, /Sin cuentas conectadas/);
  assert.match(ui, /CSV, Excel y entrada manual siguen disponibles/);
  assert.doesNotMatch(ui, /data-e9-connect-bank|Conectar banco ahora/);
});

test("el centro de alertas distingue las pruebas locales del web push remoto", () => {
  assert.match(ui, /Web push remoto desactivado/);
  assert.match(ui, /Las pruebas del navegador son locales/);
});

test("el asistente visible se identifica como local y sin escrituras", () => {
  const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
  assert.match(html, /Asistente local del dashboard/);
  assert.match(app, /Asistente externo desactivado/);
  assert.match(app, /No modifica ningún dato/);
  assert.match(app, /borradores conversacionales remotos también permanecen desactivados/);
});

test("la interfaz declara la colaboración desactivada y no ofrece invitaciones prematuras", () => {
  assert.match(ui, /Sin invitaciones ni acceso remoto/);
  assert.match(ui, /No se ha compartido ningún dato/);
  assert.doesNotMatch(ui, /data-e9-send-invitation|Enviar invitación/);
});

test("E9 reúne sus dependencias externas en un estado gris no accionable", () => {
  assert.match(ui, /Pendientes de activación externa/);
  assert.match(ui, /Pendiente de activación/);
  assert.match(ui, /OpenAI API sin conectar/);
  assert.match(ui, /La publicación es segura con estos servicios desactivados/);
});
