// DEC-38 · paso 3 (21/11/2026): a 195 px (un móvil de 390 px con el zoom de la página al 200 %), Hoy y Movimientos. Solo CSS y solo
// por debajo de 260 px, salvo tres rejillas sin columnas que no dejaban estrechar la suya (minmax(0, 1fr)), que valen a cualquier
// ancho y no cambian nada a 260 px o más. El CI mira a 195 px las pantallas ya revisadas.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

test("DEC-38 · paso 3: el CI mira a 195 px las pantallas revisadas (Hoy, Movimientos, Plan, Cierre, Ajustes y Deuda)", () => {
  const tool = read("tools/check-mobile-overflow.mjs");
  assert.match(tool, /const WIDTHS = \[195, 260, 320, 360, 768, 1280\];/);
  assert.match(tool, /const REVISADAS_A_195 = new Set\(\["home", "movements", "plan", "cierre", "ajustes", "deuda-ruta", "deuda-comparar", "deuda-prestamo", "deuda-contratos", "deuda-simulador",\n/);
  // DEC-38 en Inversión y Escenarios (undécima §6, semana del 7/12): las nueve pantallas, medidas sin nada cortado a 195 px.
  for (const id of ["inversion-cartera", "inversion-rebalanceo", "inversion-fiscal", "inversion-jubilacion", "inversion-apalancamiento", "escenario-simular", "escenario-aplicar", "escenario-guardados", "escenario-comparar"]) {
    assert.ok(tool.slice(tool.indexOf("const REVISADAS_A_195"), tool.indexOf("]);", tool.indexOf("const REVISADAS_A_195"))).includes(`"${id}"`), id);
  }
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
  const at = css.indexOf("/* DEC-38 · paso 3 (21/11/2026)");
  assert.ok(at > 0);
  const bloque = css.slice(at, css.indexOf("/* DEC-38 · paso 3, tandas 3 a 5"));
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
  const base = styles.indexOf("/* DEC-38 · paso 3 (21/11/2026)");
  assert.ok(base > 0);
  assert.match(styles.slice(base), /main \{\n {4}padding-left: 8px;\n {4}padding-right: 8px;/, "menos margen a los lados de la pantalla");
  assert.match(styles.slice(base), /\.dex5-onboarding-actions \{\n {4}flex-wrap: wrap;/);
  const html = read("index.html");
  for (const file of ["styles.css", "tema-v2.css"]) assert.match(html, new RegExp(`${file.replace(".", "\\.")}\\?v=2026112(?:1(?:dec38d|areas|d658)|2und|5tred1|5tred2|5tre3c|5tred4|5tred4b|5tred5)`), file); // y a «areas» con Hoy por áreas; a «d658» con lo que traía #658 (el índice de Ajustes y la fila «Ahorro»)
});

// Tandas 3 a 5 (21/11/2026): Plan › Mes, Cierre, Ajustes, Deuda (Ruta, Comparar, Préstamo, Contratos y el simulador visual, el nuevo y el
// de siempre dentro de su iframe) y la cabecera del móvil, que a 195 px medía 117 de los 422 px de alto de la pantalla.
test("DEC-38 · paso 3, tandas 3 a 5: Plan, Cierre y el simulador nuevo se apilan por debajo de 260 px", () => {
  const css = read("tema-v2.css");
  const at = css.indexOf("/* DEC-38 · paso 3, tandas 3 a 5");
  assert.ok(at > 0);
  const bloque = css.slice(at);
  assert.match(bloque, /@media \(max-width: 259px\) \{/);
  assert.match(bloque, /\.plan-v2-leyenda \{\n {4}grid-template-columns: minmax\(0, 1fr\);/);
  assert.match(bloque, /tr\.plan-v2-financiaciones,\n {2}:root\[data-tema="v2"\] \.plan-v2-tabla tr\.plan-v2-ahorro-fila,\n {2}:root\[data-tema="v2"\] \.plan-v2-tabla tr\.plan-v2-fila,\n {2}:root\[data-tema="v2"\] \.plan-v2-tabla tr\.plan-v2-bloque \{\n {4}grid-template-columns: minmax\(0, 1fr\);/); // y la del ahorro, cada partida y cada bloque (21/11)
  assert.match(bloque, /\.cierre-v2-paso \{\n {4}grid-template-columns: minmax\(0, 1fr\);/, "el icono encima del texto");
  assert.match(bloque, /\.cierre-v2-lado \.e19-btn \{\n {4}white-space: normal;/, "«Firmar el cierre» cabe");
  assert.match(bloque, /\.sim-v2-cifras \{\n {4}grid-template-columns: minmax\(0, 1fr\);/, "las cuatro cifras del simulador, una debajo de otra");
  assert.match(bloque, /\.sim-v2-cuenta-cabeza \{\n {4}flex-wrap: wrap;/);
});

test("DEC-38 · paso 3, tandas 3 a 5: la cabecera del móvil, Ajustes y Deuda (en los dos temas)", () => {
  const styles = read("styles.css");
  const at = styles.indexOf("/* DEC-38 · paso 3, tandas 3 a 5");
  assert.ok(at > 0);
  const bloque = styles.slice(at);
  assert.match(bloque, /\.sidebar \.brand-block > div:not\(\.brand-mark\) \{\n {4}display: none;/, "solo «FC» y «Menú»");
  assert.match(bloque, /\.brand-mark \{\n {4}width: 34px;/);
  assert.match(bloque, /\.laboratorio-card-head,\n {2}\.panel-uso-cabecera \{\n {4}flex-wrap: wrap;/);
  // design-tokens.css y camino-deuda.css se cargan después: estas reglas necesitan más especificidad que las suyas.
  assert.match(bloque, /section\.e19-deuda-decidir \.deuda-decidir-strategy-grid \{\n {4}grid-template-columns: minmax\(0, 1fr\);/);
  assert.match(bloque, /main \.cam-heroes \{\n {4}grid-template-columns: minmax\(0, 1fr\);/);
  assert.match(bloque, /main \.deuda-flow-nav \{\n {4}flex-wrap: wrap;/);
});

test("DEC-38 · paso 3, tanda 5: el simulador de siempre (iframe) estrecha y cambia de versión", () => {
  const roadmap = read("debt-roadmap.html");
  assert.match(roadmap, /@media\(max-width:259px\)\{\.kpis,\.metric-grid,\.summary-cards,\.form,\.inline4,\.profile-grid,\.scenarios,\.compare-grid,\.kanban,\.two,\.forecast-grid,\.flow\{grid-template-columns:minmax\(0,1fr\)\}/);
  assert.match(roadmap, /\.card>table\{display:block;overflow-x:auto\}/, "la tabla del semáforo se desplaza dentro de su tarjeta");
  assert.ok(read("index.html").includes('src="debt-roadmap.html?v=20261121dec38d"'), "el iframe pide la versión nueva");
});

// 21/11/2026, lo que #659 no cubría: el índice de Ajustes (a 195 × 422 px medía 439 px y, fijo, tapaba la pantalla entera) y la
// fila «Ahorro» de Plan › Mes, como «Financiaciones» a cualquier ancho.
test("DEC-38 · el índice de Ajustes no va fijo por debajo de 260 px y la fila «Ahorro» va como «Financiaciones»", () => {
  const styles = read("styles.css");
  assert.match(styles.slice(styles.lastIndexOf("@media (max-width: 259px) {")), /main \.e19-ajustes-anchors \{\n {4}position: static;/);
  const css = read("tema-v2.css");
  assert.match(css, /:root\[data-tema="v2"\] \.plan-v2-financiaciones small,\n:root\[data-tema="v2"\] \.plan-v2-ahorro-fila small \{\n {2}display: block;/);
  assert.match(css, /\.plan-v2-tabla tr\.plan-v2-financiaciones,\n {2}:root\[data-tema="v2"\] \.plan-v2-tabla tr\.plan-v2-ahorro-fila \{\n {4}grid-template-columns: minmax\(0, 1fr\) auto auto;/);
});
