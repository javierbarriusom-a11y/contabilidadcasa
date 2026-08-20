const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const html = read("index.html");
const app = read("app.js");
const experience = read("e17-experience.js");

// Bloque 5 del plan de cierre (docs/BACKLOG_NUEVE_PANTALLAS.md §7, 20 de agosto): E-14, A-12 y
// C-14 son tres tareas gemelas que retiran del menú avanzado y del lanzador las siete heredadas
// de simulación (Escenarios), visuales (Análisis) y de conciliación (Cierre) que el catálogo de
// Laboratorio (bloque 1, 19 de agosto) ya documenta con su propio botón «Abrir en solo lectura».
// D-14, la cuarta gemela (las tres heredadas de Deuda), se queda deliberadamente sin tocar: choca
// con T-4, bloqueada a propósito a la espera de datos de uso reales.
const E14_HASHES = ["new-life-simulation", "simulator", "new-life-definitive"];
const A12_HASHES = ["savings-plan", "cashflow"];
const C14_HASHES = ["data-audit", "reconciliation"];
const RETIRED_HASHES = [...E14_HASHES, ...A12_HASHES, ...C14_HASHES];
const D14_HASHES = ["debt-roadmap", "debt-liquidation-plan", "debt-control"];

test("Bloque 5 · las siete heredadas de E-14/A-12/C-14 salen del menú avanzado", () => {
  for (const hash of RETIRED_HASHES) {
    assert.doesNotMatch(html, new RegExp(`<a href="#${hash}" data-e17-group="legacy">`), `${hash} no debería tener enlace en Versiones anteriores`);
  }
});

test("Bloque 5 · las siete heredadas de E-14/A-12/C-14 salen del lanzador", () => {
  for (const hash of RETIRED_HASHES) {
    assert.doesNotMatch(experience, new RegExp(`target: "${hash}"`), `${hash} no debería tener entrada en el lanzador`);
  }
});

test("Bloque 5 · retirar del menú no borra las pantallas: siguen existiendo y renderizándose", () => {
  for (const hash of RETIRED_HASHES) {
    assert.match(html, new RegExp(`id="${hash}"[^>]*view-section|view-section[^>]*id="${hash}"`), `falta la vista ${hash}`);
    assert.match(app, new RegExp(`case "${hash}":`), `falta el render de ${hash}`);
  }
});

test("Bloque 5 · retirar del menú no toca ningún camino funcional suelto (mismo trato que V5-3/V2-8)", () => {
  // Escenarios (E-14): los enlaces de acción directa hacia Simulación nueva vida y Simulador se
  // quedan exactamente igual que antes de esta sesión.
  assert.match(app, /data-home-nav="new-life-simulation"/);
  assert.match(app, /<a href="#simulator" data-home-nav="simulator">/);
  // Análisis (A-12): el enlace desde el semáforo de ahorro y desde el peor mes de colchón.
  assert.match(app, /data-home-nav="savings-plan"/);
  assert.match(app, /data-home-nav="cashflow"/);
  // Cierre (C-14): la tarjeta «Comprobar», el siguiente paso sugerido y el destino por defecto de
  // las alertas, tal y como V5-3 los documentó ya intactos.
  assert.match(html, /data-home-nav="reconciliation"/);
  assert.match(app, /target = "reconciliation"/);
  assert.match(app, /button\.dataset\.alertTarget \|\| "data-audit"/);
});

test("Bloque 5 · el catálogo de Laboratorio sigue documentando las siete heredadas sin cambios", () => {
  const catalogSource = app.match(/const LABORATORIO_CATALOG = \[[\s\S]*?\n\];/)?.[0];
  assert.ok(catalogSource, "no se encontró LABORATORIO_CATALOG en app.js");
  const context = {};
  vm.createContext(context);
  vm.runInContext(`${catalogSource}\nthis.LABORATORIO_CATALOG = LABORATORIO_CATALOG;`, context);
  const byHash = Object.fromEntries(context.LABORATORIO_CATALOG.map((entry) => [entry.hash, entry]));
  for (const hash of RETIRED_HASHES) {
    assert.ok(byHash[hash], `falta ${hash} en LABORATORIO_CATALOG`);
    assert.notEqual(byHash[hash].veredicto, "descartada", `${hash} sigue siendo adoptada o sustituida, no descartada`);
  }
});

test("Bloque 5 · D-14 se queda sin tocar: las tres heredadas de Deuda siguen en menú y lanzador", () => {
  for (const hash of D14_HASHES) {
    assert.match(html, new RegExp(`<a href="#${hash}" data-e17-group="legacy">`), `D-14 no debería haber tocado ${hash}`);
    assert.match(experience, new RegExp(`target: "${hash}"[^}]*group: "legacy"`), `D-14 no debería haber tocado ${hash} en el lanzador`);
  }
});

test("Bloque 5 · visual-detail queda fuera de A-12 a propósito: su destino real es Plan y Registrar, no Análisis", () => {
  assert.match(html, /<a href="#visual-detail" data-e17-group="legacy">/);
  assert.match(experience, /target: "visual-detail"[^}]*group: "legacy"/);
});
