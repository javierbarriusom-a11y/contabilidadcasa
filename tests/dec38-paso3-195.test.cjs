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
  assert.match(tool, /const REVISADAS_A_195 = new Set\(\["home", "movements", "plan", "cierre", "ajustes", "deuda-ruta", "deuda-comparar", "deuda-prestamo", "deuda-contratos"\]\);/, "tercera tanda: Plan y Cierre; cuarta: Ajustes y Deuda");
  assert.doesNotMatch(tool, /"deuda-simulador"/, "el simulador visual aún no: enseña el anterior en un iframe con su propia hoja");
  assert.match(tool, /if \(width === 195 && !REVISADAS_A_195\.has\(id\)\) continue;/, "a 195 px, solo las revisadas");
});

test("DEC-38 · paso 3: las rejillas sin columnas ya no impiden estrechar (titular de Hoy y tira de cobertura)", () => {
  const css = read("tema-v2.css");
  for (const sel of ["hoy-v2-hero-head", "cob-tira-tarjeta", "cob-tira-lista", "cob-tira-fila", "cierre-v2-lado"]) {
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
  // Tercera tanda: Plan › Mes (cada partida en una columna, el mes entero y la leyenda una por línea) y Cierre.
  assert.match(bloque, /\.plan-v2-tabla tr,\n {2}:root\[data-tema="v2"\] \.plan-v2-tabla tr\.plan-v2-financiaciones,\n {2}:root\[data-tema="v2"\] \.plan-v2-tabla tr\.plan-v2-ahorro-fila \{\n {4}grid-template-columns: minmax\(0, 1fr\);/);
  assert.match(bloque, /\.plan-v2-mes-pildora \{\n {4}flex: 1 1 100%;\n {4}order: -1;/);
  assert.match(bloque, /\.plan-v2-leyenda \{\n {4}grid-template-columns: minmax\(0, 1fr\);/);
  assert.match(bloque, /\.cierre-v2-guarda dl > div,\n {2}:root\[data-tema="v2"\] \.cierre-v2-eyebrow \{\n {4}flex-wrap: wrap;/);
  // La fila del ahorro, como Financiaciones a cualquier ancho (su explicación salía pegada al nombre).
  assert.match(css, /:root\[data-tema="v2"\] \.plan-v2-financiaciones small,\n:root\[data-tema="v2"\] \.plan-v2-ahorro-fila small \{\n {2}display: block;/);
  const styles = read("styles.css");
  const base = styles.lastIndexOf("@media (max-width: 259px) {");
  assert.ok(base > 0);
  assert.match(styles.slice(base), /main \{\n {4}padding-left: 8px;\n {4}padding-right: 8px;/, "menos margen a los lados de la pantalla");
  assert.match(styles.slice(base), /\.dex5-onboarding-actions \{\n {4}flex-wrap: wrap;/);
  const html = read("index.html");
  assert.ok(html.includes("styles.css?v=20261121dec38d"), "styles.css, a 20261121dec38d con la cuarta tanda");
  assert.ok(html.includes("tema-v2.css?v=20261121dec38d"), "tema-v2.css, a 20261121dec38d con la tercera tanda");
});

test("DEC-38 · paso 3, cuarta tanda: Ajustes y Deuda a 195 px", () => {
  const tokens = read("design-tokens.css");
  assert.match(tokens, /\.deuda-decidir-strategy-grid \{\n {2}display: grid;\n {2}grid-template-columns: repeat\(auto-fit, minmax\(min\(220px, 100%\), 1fr\)\);/, "las estrategias de Deuda › Comparar, en una columna que cabe");
  assert.match(read("camino-deuda.css"), /grid-template-columns: repeat\(auto-fit, minmax\(min\(190px, 100%\), 1fr\)\);/, "las cifras de Deuda › Ruta, igual");
  const at = tokens.lastIndexOf("@media (max-width: 259px) {");
  assert.ok(at > 0);
  const bloque = tokens.slice(at);
  assert.match(bloque, /\.deuda-flow-nav,\n {2}\.laboratorio-card-head,\n {2}\.e19-insight \{\n {4}flex-wrap: wrap;/);
  assert.match(bloque, /\.e19-ajustes-anchors \{\n {4}position: static;/, "el índice de Ajustes deja de tapar media pantalla");
  const styles = read("styles.css");
  assert.match(styles, /\.panel-uso-minutos \{\n {2}display: grid;\n {2}grid-template-columns: minmax\(0, 1fr\);/);
  assert.match(styles.slice(styles.lastIndexOf("@media (max-width: 259px) {")), /\.panel-uso-minutos-fila,\n {2}\.panel-uso-cabecera \{\n {4}flex-wrap: wrap;/);
  const html = read("index.html");
  for (const file of ["design-tokens.css", "camino-deuda.css"]) assert.ok(html.includes(`${file}?v=20261121dec38d`), file);
});
