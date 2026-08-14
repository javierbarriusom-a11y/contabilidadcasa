const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const html = read("index.html");
const app = read("app.js");
const experience = read("e17-experience.js");
const worker = read("service-worker.js");

const navLinks = [...html.matchAll(/<a href="#([\w-]+)" data-e17-group="(\w+)">/g)].map((match) => ({
  view: match[1],
  group: match[2],
}));
const groupOf = (view) => navLinks.find((link) => link.view === view)?.group;

test("V5-3 · las tres pantallas de Cierre quedan en Versiones anteriores", () => {
  for (const view of ["reconciliation", "data-audit", "operations-manual"]) {
    assert.equal(groupOf(view), "legacy", `${view} debería estar relegada`);
  }
  assert.equal(groupOf("conciliar"), "data", "la conciliación nueva se queda en Datos");
});

test("V5-3 · relegar no desconecta ninguno de los tres caminos que llevaban ahí", () => {
  // El hub de Actualizar sigue teniendo su tarjeta «Comprobar» y su siguiente paso sugerido.
  assert.match(html, /data-home-nav="reconciliation"/);
  assert.match(app, /target = "reconciliation"/);
  // Las alertas siguen abriendo la auditoría cuando no declaran otro destino.
  assert.match(app, /button\.dataset\.alertTarget \|\| "data-audit"/);
  // Y las tres pantallas siguen existiendo y renderizándose.
  for (const view of ["reconciliation", "data-audit", "operations-manual"]) {
    assert.match(html, new RegExp(`id="${view}"[^>]*view-section|view-section[^>]*id="${view}"`), `falta la vista ${view}`);
  }
  assert.match(app, /case "data-audit":/);
  assert.match(app, /case "reconciliation":/);
});

test("V5-3 · la guía contextual de cada flujo no depende de la pantalla relegada", () => {
  // A13-6 puso una guía offline por flujo en un diálogo propio; «Guía operativa» como pantalla es
  // la versión anterior de eso, no su única vía.
  assert.match(html, /id="e17FlowGuideDialog"/);
  assert.match(app, /guideTopicFor\(activeViewId\)/);
});

test("V5-3 · el lanzador sigue ofreciendo Conciliar y Datos y auditoría", () => {
  assert.match(experience, /target: "reconciliation"[^}]*group: "legacy"/);
  assert.match(experience, /target: "data-audit"[^}]*group: "legacy"/);
  assert.match(experience, /target: "reconciliation"[^}]*keywords: "conciliacion extracto saldo diferencias"/);
});

test("V5-3 · viaja en el shell offline versionado", () => {
  assert.match(worker, /20260814-f1a1/);
  assert.match(html, /app\.js\?v=20260814f1a1/);
});
