/**
 * tests/ola-rend-1-secciones-ocultas.test.cjs
 *
 * Rendimiento (30/09/2026) — las pantallas nacen ocultas en el HTML, salvo Hoy.
 *
 * Antes, ninguna de las 59 secciones `view-section` llevaba `hidden` y el CSS tampoco las ocultaba: solo las
 * ocultaba `setActiveView` cuando `app.js` terminaba de arrancar. Durante toda la carga el navegador
 * maquetaba y pintaba las 59 a la vez (≈ 490 KB de HTML). Medido con la CPU frenada 4x y visita repetida:
 * contenido de Hoy a los 5,8-6,0 s antes y a los 3,6-3,7 s con las secciones ocultas de partida (−38 %);
 * primera visita 10,5-11,1 s → 8,8-9,1 s.
 *
 * Este test fija la regla para que no se pierda al añadir una pantalla nueva:
 *   - `#home` es la única sección visible de partida (es la vista por defecto de `viewFromHash`);
 *   - las otras 58 nacen con `hidden`, el mismo mecanismo que `setActiveView` ya usa para alternarlas.
 * Si algún día la vista por defecto cambia, este test obliga a cambiar las dos cosas a la vez.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

const sections = [...html.matchAll(/<section([^>]*\bview-section\b[^>]*)>/g)].map((match) => ({
  id: match[1].match(/\bid="([\w-]+)"/)?.[1],
  hidden: /\bhidden\b/.test(match[1]),
}));

test("solo #home nace visible; las demás pantallas nacen con `hidden`", () => {
  assert.ok(sections.length >= 59, `se esperaban al menos 59 pantallas y hay ${sections.length}`);
  for (const section of sections) assert.ok(section.id, "toda pantalla necesita un id");
  const visible = sections.filter((section) => !section.hidden).map((section) => section.id);
  assert.deepEqual(visible, ["home"], `nacen visibles: ${visible.join(", ")}`);
});

test("la pantalla visible de partida coincide con la vista por defecto de la app", () => {
  assert.match(app, /const id = \(window\.location\.hash \|\| "#home"\)|let id = \(window\.location\.hash \|\| "#home"\)/);
  assert.match(app, /classList\.contains\("view-section"\) \? id : "home"/);
});

test("`setActiveView` sigue alternando las pantallas con el mismo atributo `hidden`", () => {
  assert.match(app, /document\.querySelectorAll\("\.view-section"\)\.forEach\(\(section\) => \{\s*section\.hidden = section\.id !== viewId;/);
});
