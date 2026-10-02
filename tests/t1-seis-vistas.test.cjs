const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const html = read("index.html");
const app = read("app.js");
const experience = read("e17-experience.js");

// T-1 · adoptar la navegación de seis vistas, con las heredadas relegadas y no retiradas.
// Sustituye los cuatro verbos (Hoy, Actualizar, Prever, Decidir) por las seis vistas del
// rediseño: Hoy, Plan, Deuda, Datos, Cierre y Ajustes.

// Ola 1 (entrega 1, 30 de septiembre de 2026): de las seis vistas de T-1, «Datos» (#update-hub) deja de
// ser entrada principal — desde R-10 redirige a Registrar, era la misma pantalla con dos entradas — y
// Cierre pasa a «Cada mes», junto a Plan. Las otras cuatro siguen siendo pestaña principal y el
// destino de `#update-hub` sigue existiendo (alias). Ningún #id cambia.
test("T-1 · las vistas de T-1 que siguen siendo pestaña principal conservan destino y orden (Datos ya es alias de Registrar)", () => {
  const expected = [
    ["#home", "Hoy"],
    ["#plan", "Plan"],
    ["#cierre", "Cierre"],
    ["#deuda-ruta", "Deuda"],
    ["#ajustes", "Ajustes"],
  ];
  for (const [href] of expected) {
    assert.match(html, new RegExp(`<a href="${href.replace("#", "#")}" class="nav-primary-link( active)?">`), `${href} debe ser pestaña principal`);
  }
  const positions = expected.map(([href]) => html.indexOf(`href="${href}" class="nav-primary-link`));
  for (let index = 1; index < positions.length; index += 1) {
    assert.ok(positions[index - 1] < positions[index], "las vistas deben mantener el orden Hoy, Plan, Cierre, Deuda, Ajustes");
  }
  for (const [, label] of expected) {
    assert.match(html, new RegExp(`<span>${label}</span>`));
  }
  assert.ok(!html.includes('<a href="#update-hub" class="nav-primary-link">'), "«Datos» ya no es entrada principal");
  assert.match(html, /id="update-hub"[^>]*view-section|view-section[^>]*id="update-hub"/, "el destino #update-hub sigue existiendo");
});

test("T-1 · Prever y Decidir dejan de ser pestaña principal, sin desconectar sus pantallas", () => {
  assert.ok(!html.includes('<a href="#forecast" class="nav-primary-link">'));
  assert.ok(!html.includes('<a href="#new-life-definitive" class="nav-primary-link">'));
  // `#forecast` sigue con piel nueva y alcanzable desde el menú avanzado, sin relegar.
  assert.match(html, /<a href="#forecast" data-e17-group="analysis">Proyección<\/a>/);
  assert.match(html, /id="forecast"[^>]*view-section|view-section[^>]*id="forecast"/);
  assert.match(app, /case "forecast":/);
  // `#new-life-definitive` se relevó como decimoctava y última heredada del inventario; E-14
  // (bloque 5, 20 de agosto) la retira del menú avanzado y del lanzador junto con las otras dos
  // heredadas de simulación — la pantalla sigue existiendo y renderizándose igual.
  assert.doesNotMatch(html, /<a href="#new-life-definitive" data-e17-group="legacy">/);
  assert.match(html, /id="new-life-definitive"[^>]*view-section|view-section[^>]*id="new-life-definitive"/);
  assert.match(app, /case "new-life-definitive":\s*renderNewLifeDefinitive\(\)/);
});

test("T-1 · el lanzador refleja el cambio: Ajustes es nueva, Decidir ya no está (E-14 la retira)", () => {
  assert.match(experience, /target: "ajustes", label: "Ajustes", group: "main"/);
  assert.doesNotMatch(experience, /target: "new-life-definitive"/);
});

test("T-1 · viaja en el shell offline versionado", () => {
  const worker = read("service-worker.js");
  assert.match(worker, /20260821-d1a1/);
  assert.match(html, /app.js\?v=20261002s4a1/);
  assert.match(html, /e17-experience\.js\?v=20260821d1a1/);
});
