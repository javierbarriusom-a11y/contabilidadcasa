const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

// UX2 (BACKLOG_ULTIMATE_SEPTIEMBRE.md bloque 3, ampliación "experiencia" — sin documento de detalle
// propio, resumen en su Nota): "«dato real / simulación / decisión aplicada», siempre visible —
// lleva el rigor previsto/real/usado (A6/A3-8) al cromado de cada pantalla".

function extractConst(name) {
  const start = app.indexOf(`const ${name} =`);
  assert.ok(start >= 0, `No existe la constante ${name}`);
  const end = app.indexOf("\n};", start);
  assert.ok(end >= 0, `No se encontró el final de ${name}`);
  return app.slice(start, end + 3);
}

function extractFunction(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `No existe la función ${name}`);
  const end = app.indexOf("\nfunction ", start + 1);
  assert.ok(end > start);
  return app.slice(start, end);
}

test("el badge de cromado vive fuera de <main>, en el mismo topbar que el chip de sincronización", () => {
  const mainStart = html.indexOf('<main id="mainContent"');
  const badgeIndex = html.indexOf('id="dataNatureBadge"');
  assert.ok(badgeIndex > 0 && badgeIndex < mainStart, "el badge debe vivir en el topbar, antes de <main>");
  const durabilityIndex = html.indexOf('id="durabilityStatus"');
  assert.ok(badgeIndex < durabilityIndex, "el badge de UX2 va junto al chip de sincronización de A0-3");
});

test("viewDataNature clasifica explícitamente, sin heurística por nombre, y por defecto es \"real\"", () => {
  const context = {};
  vm.createContext(context);
  vm.runInContext([extractConst("UX2_VIEW_NATURE"), extractFunction("viewDataNature")].join("\n"), context);
  assert.equal(context.viewDataNature("home"), "real");
  assert.equal(context.viewDataNature("registrar"), "real");
  assert.equal(context.viewDataNature("cualquier-pantalla-nueva-sin-clasificar"), "real");
  assert.equal(context.viewDataNature("escenario-simular"), "simulation");
  assert.equal(context.viewDataNature("forecast"), "simulation");
  assert.equal(context.viewDataNature("escenario-aplicar"), "applied");
  assert.equal(context.viewDataNature("debt-roadmap"), "applied");
});

test("renderDataNatureBadge escribe la etiqueta y el tono correctos, sin clase extra para \"real\"", () => {
  const written = {};
  const context = {
    qs: () => ({ set className(value) { written.className = value; }, set textContent(value) { written.textContent = value; } }),
  };
  vm.createContext(context);
  vm.runInContext(
    [extractConst("UX2_VIEW_NATURE"), extractConst("UX2_NATURE_LABEL"), extractFunction("viewDataNature"), extractFunction("renderDataNatureBadge")].join("\n"),
    context,
  );
  context.renderDataNatureBadge("home");
  assert.equal(written.className, "data-nature-badge");
  assert.equal(written.textContent, "Dato real");
  context.renderDataNatureBadge("escenario-simular");
  assert.equal(written.className, "data-nature-badge data-nature-simulation");
  assert.equal(written.textContent, "Simulación");
  context.renderDataNatureBadge("escenario-aplicar");
  assert.equal(written.className, "data-nature-badge data-nature-applied");
  assert.equal(written.textContent, "Decisión aplicada");
});

test("setActiveView pinta el badge en cada cambio de vista, para las ~40 pantallas por igual", () => {
  const body = extractFunction("setActiveView");
  assert.match(body, /renderDataNatureBadge\(viewId\)/);
});

test("styles.css define los tres tonos del badge, mismo lenguaje visual que .durability-status", () => {
  const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
  assert.match(css, /\.data-nature-badge\s*\{/);
  assert.match(css, /\.data-nature-badge\.data-nature-simulation/);
  assert.match(css, /\.data-nature-badge\.data-nature-applied/);
});
