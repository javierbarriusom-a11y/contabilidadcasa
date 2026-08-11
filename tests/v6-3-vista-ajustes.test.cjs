const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const html = read("index.html");
const app = read("app.js");

// V6-3 · vista `#ajustes` que reúne cuentas, umbrales, partidas y exportación. No reimplementa
// esos editores: la reserva operativa se guarda de verdad aquí (V6-1 solo la alojaba en Cuadro de
// mandos hasta que existiera esta vista); el resto de tarjetas enlazan a donde ya se editan.

test("V6-3 · la vista existe con piel nueva y aparece antes de las heredadas", () => {
  assert.match(html, /<section class="e19-ajustes view-section" id="ajustes">/);
  const ajustes = html.indexOf('id="ajustes"');
  const legacyFirst = html.indexOf('id="visual-detail"');
  assert.ok(ajustes > 0 && ajustes < legacyFirst, "Ajustes debe aparecer entre las pantallas nuevas, antes de las heredadas");
});

test("V6-3 · se renderiza con su propio caso y título de vista", () => {
  assert.match(app, /case "ajustes":\s*renderAjustes\(\);/);
  assert.match(app, /ajustes: \{\s*eyebrow: "Ajustes"/);
  assert.match(app, /function renderAjustes\(\)/);
});

test("V6-3 · la reserva operativa se guarda desde aquí, ya no desde Cuadro de mandos", () => {
  assert.match(html, /id="ajustesReserve"/);
  assert.match(html, /id="ajustesReserveNote"/);
  assert.ok(!html.includes('id="cuadroMandosReserve"'), "el input editable ya no vive en Cuadro de mandos");
  assert.match(app, /qs\("ajustesReserve"\)\?\.addEventListener\("change", handleOperatingReserveChange\)/);
});

test("V6-3 · cada tarjeta lleva a donde ese dato se edita de verdad", () => {
  const routes = [
    ["Cuentas", "visual-detail"],
    ["Partidas", "visual-detail"],
    ["Umbrales de aviso", "alerts-center"],
    ["Exportar", "cashflow"],
  ];
  for (const [step, target] of routes) {
    assert.match(html, new RegExp(`<span class="e19-route-step">${step}[^<]*</span>`), `falta la tarjeta de ${step}`);
  }
  const ajustesGrid = html.slice(html.indexOf('id="ajustesRouteGrid"'), html.indexOf('id="ajustesRouteGrid"') + 3000);
  for (const [, target] of routes) {
    assert.match(ajustesGrid, new RegExp(`data-home-nav="${target}"`), `falta un botón hacia #${target}`);
  }
});

test("V6-3 · el clic en una tarjeta navega, igual que en Actualizar mis datos", () => {
  assert.match(app, /qs\("ajustes"\)\?\.addEventListener\("click", \(event\) => \{\s*const button = event\.target\.closest\("\[data-home-nav\]"\);/);
});

// V6-2 (10 de agosto de 2026) cierra los tres umbrales que esta prueba comprobaba como pendientes;
// solo V6-4 (exportación única) sigue sin construir, y la propia tarjeta lo dice.
test("V6-3 · documenta lo que queda pendiente en vez de fingir que ya está hecho", () => {
  assert.match(html, /Pendiente \(V6-4\)/);
  assert.ok(!html.includes("Pendiente (V6-2)"), "V6-2 ya está hecha: no debe seguir marcada como pendiente");
});

test("V6-3 · el lanzador encuentra Ajustes por su nombre, con guía propia", () => {
  const experience = read("e17-experience.js");
  assert.match(experience, /target: "ajustes", label: "Ajustes"/);
  assert.match(experience, /ajustes: \["Para qué sirve"/);
});
