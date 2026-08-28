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

// C-14 (bloque 5, 20 de agosto) retira `reconciliation`/`data-audit` del menú avanzado y del
// lanzador: ya no quedan en «Versiones anteriores» como esta prueba documentaba en su día. Las
// dos secciones y todos sus caminos funcionales (tarjeta «Comprobar», siguiente paso sugerido,
// destino por defecto de las alertas) siguen intactos, igual que hacía V5-3 — el mismo trato que
// E-14/A-12 dieron a sus heredadas: solo se retiran las dos vías de descubrimiento, nada más.
test("V5-3 · operations-manual sigue en Versiones anteriores; reconciliation/data-audit ya no (C-14)", () => {
  assert.equal(groupOf("operations-manual"), "legacy", "operations-manual debería seguir relegada");
  assert.equal(groupOf("reconciliation"), undefined, "C-14 retira reconciliation del menú avanzado");
  assert.equal(groupOf("data-audit"), undefined, "C-14 retira data-audit del menú avanzado");
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

test("V5-3 · el lanzador ya no ofrece Conciliar ni Datos y auditoría (C-14)", () => {
  assert.doesNotMatch(experience, /target: "reconciliation"/);
  assert.doesNotMatch(experience, /target: "data-audit"/);
});

test("V5-3 · viaja en el shell offline versionado", () => {
  assert.match(worker, /20260821-d1a1/);
  assert.match(html, /app\.js\?v=20260828e1a1/);
});
