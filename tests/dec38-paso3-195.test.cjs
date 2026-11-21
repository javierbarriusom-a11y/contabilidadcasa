// DEC-38 · paso 3 (21/11/2026): a 195 px (un móvil de 390 px con el zoom de la página al 200 %), Hoy y Movimientos. Solo CSS y solo
// por debajo de 260 px, salvo tres rejillas sin columnas que no dejaban estrechar la suya (minmax(0, 1fr)), que valen a cualquier
// ancho y no cambian nada a 260 px o más. El CI mira a 195 px las pantallas ya revisadas.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

test("DEC-38 · paso 3: el CI mira a 195 px las pantallas revisadas, empezando por Hoy y Movimientos", () => {
  const tool = read("tools/check-mobile-overflow.mjs");
  assert.match(tool, /const WIDTHS = \[195, 260, 320, 360, 768, 1280\];/);
  assert.match(tool, /const REVISADAS_A_195 = new Set\(\["home", "movements"\]\);/);
  assert.match(tool, /if \(width === 195 && !REVISADAS_A_195\.has\(id\)\) continue;/, "a 195 px, solo las revisadas");
});

test("DEC-38 · paso 3: las rejillas sin columnas ya no impiden estrechar (titular de Hoy y tira de cobertura)", () => {
  const css = read("tema-v2.css");
  for (const sel of ["hoy-v2-hero-head", "cob-tira-tarjeta", "cob-tira-lista", "cob-tira-fila"]) {
    assert.match(css, new RegExp(`:root\\[data-tema="v2"\\] \\.${sel} \\{\\n {2}display: grid;\\n {2}grid-template-columns: minmax\\(0, 1fr\\);`), sel);
  }
});

test("DEC-38 · paso 3: por debajo de 260 px, Hoy y Movimientos se apilan en vez de apretar el texto", () => {
  const css = read("tema-v2.css");
  const at = css.lastIndexOf("@media (max-width: 259px) {");
  assert.ok(at > 0);
  const bloque = css.slice(at);
  assert.match(bloque, /\.hoy-v2-figure \{\n {4}font-size: clamp\(28px, 15vw, 48px\);\n {4}overflow-wrap: anywhere;/, "la cifra de Hoy cabe y, si no, se parte");
  assert.match(bloque, /\.hoy-v2-stats \{\n {4}grid-template-columns: minmax\(0, 1fr\);/);
  assert.match(bloque, /\.hoy-v2-decision \{\n {4}grid-template-columns: minmax\(0, 1fr\);/, "el número y el nivel ya no roban columnas al texto");
  assert.match(bloque, /\.hoy-v2-decision > \.hoy-v2-level,\n {2}:root\[data-tema="v2"\] \.hoy-v2-decision > \.e19-btn,\n {2}:root\[data-tema="v2"\] \.hoy-v2-review \{\n {4}grid-column: 1;/);
  assert.match(bloque, /\.mov-v2-fila-bandeja > \.mov-v2-main \{\n {4}flex: 1 1 100%;/);
  assert.match(bloque, /\.mov-v2-fila > \.mov-v2-main \{\n {4}order: 2;\n {4}flex: 1 1 100%;/, "el concepto, a todo el ancho");
  assert.match(bloque, /\.mov-v2-title \{\n {4}font-size: 20px;/);
  // Segunda tanda: Previsión («Qué lo mueve») y Clasificar (el nombre del grupo y los botones, uno encima de otro).
  assert.match(bloque, /\.prev-v2-dia-item \{\n {4}flex-wrap: wrap;/);
  assert.match(bloque, /\.clas-v2-nombre,\n {2}:root\[data-tema="v2"\] \.clas-v2-nombre\.is-largo \{\n {4}font-size: 17px;/);
  assert.match(bloque, /\.clas-v2-botones > \.e19-btn \{\n {4}flex: 1 1 100%;/);
  assert.match(bloque, /\.clas-v2-botones > \.e19-btn-primary \{\n {4}order: -1;/, "«Aceptar y siguiente», arriba");
  const styles = read("styles.css");
  const base = styles.lastIndexOf("@media (max-width: 259px) {");
  assert.ok(base > 0);
  assert.match(styles.slice(base), /main \{\n {4}padding-left: 8px;\n {4}padding-right: 8px;/, "menos margen a los lados de la pantalla");
  assert.match(styles.slice(base), /\.dex5-onboarding-actions \{\n {4}flex-wrap: wrap;/);
  const html = read("index.html");
  for (const file of ["styles.css", "tema-v2.css"]) assert.ok(html.includes(`${file}?v=20261121dec38c`), file);
});
