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

test("T-1 · las seis vistas son pestaña principal, con el destino correcto cada una", () => {
  const expected = [
    ["#home", "Hoy"],
    ["#plan", "Plan"],
    ["#deuda-ruta", "Deuda"],
    ["#update-hub", "Datos"],
    ["#cierre", "Cierre"],
    ["#ajustes", "Ajustes"],
  ];
  for (const [href] of expected) {
    assert.match(html, new RegExp(`<a href="${href.replace("#", "#")}" class="nav-primary-link( active)?">`), `${href} debe ser pestaña principal`);
  }
  const positions = expected.map(([href]) => html.indexOf(`href="${href}" class="nav-primary-link`));
  for (let index = 1; index < positions.length; index += 1) {
    assert.ok(positions[index - 1] < positions[index], "las seis vistas deben mantener el orden Hoy, Plan, Deuda, Datos, Cierre, Ajustes");
  }
  for (const [, label] of expected) {
    assert.match(html, new RegExp(`<span>${label}</span>`));
  }
});

test("T-1 · Prever y Decidir dejan de ser pestaña principal, sin desconectar sus pantallas", () => {
  assert.ok(!html.includes('<a href="#forecast" class="nav-primary-link">'));
  assert.ok(!html.includes('<a href="#new-life-definitive" class="nav-primary-link">'));
  // `#forecast` sigue con piel nueva y alcanzable desde el menú avanzado, sin relegar.
  assert.match(html, /<a href="#forecast" data-e17-group="analysis">Proyección<\/a>/);
  assert.match(html, /id="forecast"[^>]*view-section|view-section[^>]*id="forecast"/);
  assert.match(app, /case "forecast":/);
  // `#new-life-definitive` sí se releva: es la decimoctava y última heredada del inventario.
  assert.match(html, /<a href="#new-life-definitive" data-e17-group="legacy">/);
  assert.match(html, /id="new-life-definitive"[^>]*view-section|view-section[^>]*id="new-life-definitive"/);
  assert.match(app, /case "new-life-definitive":\s*renderNewLifeDefinitive\(\)/);
});

test("T-1 · el lanzador refleja el cambio: Ajustes es nueva, Decidir se releva", () => {
  assert.match(experience, /target: "ajustes", label: "Ajustes", group: "main"/);
  assert.match(experience, /target: "new-life-definitive"[^}]*group: "legacy"/);
  assert.ok(!/target: "new-life-definitive"[^}]*group: "main"/.test(experience), "Decidir ya no puede quedar como pestaña principal en el lanzador");
});

test("T-1 · viaja en el shell offline versionado", () => {
  const worker = read("service-worker.js");
  assert.match(worker, /20260814-f1a1/);
  assert.match(html, /app\.js\?v=20260814f1a1/);
  assert.match(html, /e17-experience\.js\?v=20260811t1a1/);
});
