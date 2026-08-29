const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const app = read("app.js");
const html = read("index.html");

// A16-6 · Bloque 2: hitos y rachas en el historial de auditoría. Reutiliza monthClosures tal cual
// (mismo historial que ya lee latestMonthOperation/isMonthClosed en canonical-e5-operations.js), sin
// tabla ni estado nuevo — solo visualización en la pantalla de auditoría (Datos · Auditoría).

test("la tarjeta de hitos y rachas vive junto al historial operativo (Datos · Auditoría)", () => {
  assert.match(html, /id="a166MilestonesStreaks"/);
  const timelineIndex = html.indexOf('id="e8OperationalTimeline"');
  const milestonesIndex = html.indexOf('id="a166MilestonesStreaks"');
  assert.ok(timelineIndex >= 0 && milestonesIndex >= 0);
  assert.ok(Math.abs(milestonesIndex - timelineIndex) < 3000, "debe vivir en el mismo bloque audit-layout");
});

test("renderAuditMilestonesStreaks reutiliza monthClosures y auditMilestonesAndStreaks, sin datos nuevos", () => {
  const start = app.indexOf("function renderAuditMilestonesStreaks(");
  assert.ok(start >= 0, "No existe renderAuditMilestonesStreaks en app.js");
  const end = app.indexOf("\n}", start);
  const body = app.slice(start, end);
  assert.match(body, /FinanceCanonicalE5\?\.auditMilestonesAndStreaks\(monthClosures\)/);
});

test("renderE8AuditExtensions rellena la tarjeta de hitos y rachas", () => {
  const start = app.indexOf("function renderE8AuditExtensions(");
  assert.ok(start >= 0, "No existe renderE8AuditExtensions en app.js");
  const end = app.indexOf("\n}", start);
  const body = app.slice(start, end);
  assert.match(body, /renderAuditMilestonesStreaks\(\);/);
});
