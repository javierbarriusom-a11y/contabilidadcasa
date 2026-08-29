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

// E-14/A-12 (bloque 5, 20 de agosto) retiran cuatro de estas cinco heredadas del menú avanzado y
// del lanzador — `visual-detail` es la única que se queda, porque su `dondeViveAhora` en el
// catálogo de Laboratorio es «Plan y Registrar», no Escenarios ni Análisis (fuera del alcance de
// las dos tareas). Ver tests/navigation-structure.test.cjs y v2-8 más abajo.
test("V2-8 · `visual-detail` sigue en Versiones anteriores; las otras cuatro ya no (E-14/A-12)", () => {
  assert.equal(groupOf("visual-detail"), "legacy", "visual-detail debería seguir relegada");
  for (const view of ["simulator", "savings-plan", "cashflow", "new-life-simulation"]) {
    assert.equal(groupOf(view), undefined, `E-14/A-12 retiran ${view} del menú avanzado`);
  }
});

test("V2-8 · `#forecast` no se relega: tiene la piel nueva, aunque T-1 le quite la pestaña principal", () => {
  // El backlog listaba `#forecast` entre las heredadas de Plan, pero su propio inventario lo cuenta
  // entre las pantallas con piel nueva. No se relega —sigue en el grupo «analysis», alcanzable
  // desde el menú avanzado—, aunque T-1 (turno posterior) le retira la pestaña principal «Prever»
  // porque Plan pasa a aterrizar en `#cuadro-mandos` (y, desde el 15 de agosto, en la nueva `#plan`,
  // que reutiliza el mismo motor). Relegarlo sí habría sido degradar una pantalla migrada; quitarle
  // solo la pestaña principal no lo es.
  assert.equal(groupOf("forecast"), "analysis");
  assert.match(html, /<section class="analytics-grid view-section e19-forecast" id="forecast">/);
  assert.ok(!html.includes('<a href="#forecast" class="nav-primary-link">'), "T-1 retira Prever como pestaña principal");
});

test("V2-8 · las pantallas nuevas de Plan se quedan donde estaban", () => {
  for (const view of ["cuadro-mandos", "cambios-pendientes", "mapa-calor", "prevision"]) {
    assert.equal(groupOf(view), "analysis", `${view} es de la vista nueva y no se toca`);
  }
  for (const view of ["escenario-simular", "escenario-guardados"]) {
    assert.equal(groupOf(view), "analysis", `${view} es de la vista nueva y no se toca`);
  }
});

test("V2-8 · relegar no desconecta: las rutas y los renders siguen en pie", () => {
  assert.match(html, /data-home-nav="visual-detail"/);
  assert.match(app, /data-home-nav="cashflow"/);
  assert.match(app, /data-home-nav="new-life-simulation"/);
  assert.match(app, /target = "visual-detail"/, "el siguiente paso sugerido todavía puede apuntar ahí");
  for (const view of ["visual-detail", "simulator", "savings-plan", "cashflow", "new-life-simulation"]) {
    assert.match(html, new RegExp(`id="${view}"[^>]*view-section|view-section[^>]*id="${view}"`), `falta la vista ${view}`);
    assert.match(app, new RegExp(`case "${view}":`), `falta el render de ${view}`);
  }
});

test("V2-8 · el lanzador conserva `visual-detail`; E-14/A-12 retiran las otras tres", () => {
  assert.match(experience, /target: "visual-detail"[^}]*group: "legacy"/);
  for (const view of ["simulator", "savings-plan", "cashflow", "new-life-simulation"]) {
    assert.doesNotMatch(experience, new RegExp(`target: "${view}"`), `E-14/A-12 deberían haber quitado ${view} del lanzador`);
  }
  // Y «Prever» sigue siendo una entrada normal, no relegada.
  assert.match(experience, /target: "forecast", label: "Prever", group: "analysis"/);
});

test("V2-8 · viaja en el shell offline versionado", () => {
  assert.match(worker, /20260821-d1a1/);
  assert.match(html, /app.js\?v=20260829n1/);
});
