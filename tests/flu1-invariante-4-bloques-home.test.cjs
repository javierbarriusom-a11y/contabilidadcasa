const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const indexSource = fs.readFileSync(require.resolve("../index.html"), "utf8");

// FLU-1 (BACKLOG_CONTABILIDADCASA_3_0.md §2.4): OPT-8 fijó la regla de máximo 4 bloques en la zona
// principal de Home (cobertura + «el mes en una línea», en la misma fila; decisiones abiertas; KPIs
// principales) — tests/opt8-jerarquia-visual-hoy.test.cjs ya protege QUÉ cuatro bloques son (por
// id), pero nada protegía CUÁNTOS hay: ese test pasaría igual si una tarjeta nueva se añadiera sin
// querer a .home-primary-section, mientras siga incluyendo los cuatro ids de siempre. FLU-2
// (sesión 225) ya tuvo que razonar esto a mano para decidir dónde vivía su botón nuevo (fuera de
// .home-primary-section, en la cabecera) — este test convierte esa disciplina en un invariante que
// falla solo, sin depender de que quien añada la próxima tarjeta se acuerde de mirarlo.
//
// Un «bloque» es una tarjeta (.home-panel) o una rejilla de KPIs (.home-kpi-grid) — el mismo
// vocabulario que ya usa el comentario de OPT-8 en index.html. .home-layout es solo el envoltorio
// de fila que pone cobertura y «el mes en una línea» lado a lado; no cuenta como un bloque aparte,
// igual que el propio comentario de OPT-8 los trata como dos bloques en una fila, no como uno.

function homeSectionHtml() {
  const openTag = /<section[^>]*id="home"[^>]*>/.exec(indexSource);
  assert.ok(openTag, "No existe la sección #home");
  const start = openTag.index + openTag[0].length;
  const end = indexSource.indexOf('<section class="view-section widget-view"', start);
  return indexSource.slice(start, end);
}

function homePrimarySectionHtml() {
  const home = homeSectionHtml();
  const start = home.indexOf('<div class="home-primary-section">');
  const end = home.indexOf('<p class="e19-kpi-note home-secondary-label">');
  assert.ok(start >= 0 && end > start, "No existe .home-primary-section delimitada por la etiqueta de sección secundaria");
  return home.slice(start, end);
}

test("FLU-1 · .home-primary-section nunca supera los 4 bloques (regla de OPT-8, ahora invariante)", () => {
  const primary = homePrimarySectionHtml();
  const articles = (primary.match(/class="home-panel\b/g) || []).length;
  const grids = (primary.match(/class="home-kpi-grid"/g) || []).length;
  const total = articles + grids;
  assert.ok(
    total <= 4,
    `.home-primary-section tiene ${total} bloques (${articles} artículos + ${grids} rejillas de KPI) — el máximo de OPT-8/FLU-1 es 4. Si se añadió una tarjeta nueva a propósito, muévela a .home-secondary-section o retira otra para mantener el techo.`,
  );
});

test("FLU-1 · hoy hay exactamente 4 bloques: 3 artículos (cobertura, el mes en una línea, decisiones abiertas) + 1 rejilla de KPIs", () => {
  const primary = homePrimarySectionHtml();
  const articles = (primary.match(/class="home-panel\b/g) || []).length;
  const grids = (primary.match(/class="home-kpi-grid"/g) || []).length;
  assert.equal(articles, 3, "se esperaban 3 artículos (.home-panel) en la zona principal");
  assert.equal(grids, 1, "se esperaba 1 rejilla de KPIs (.home-kpi-grid) en la zona principal");
});

test("FLU-1 · .home-layout (la fila de cobertura + «el mes en una línea») no cuenta como un quinto bloque aparte", () => {
  const primary = homePrimarySectionHtml();
  assert.match(primary, /class="home-layout" data-meeting-step="2"/, "el envoltorio de fila debe seguir existiendo");
  // Vive fuera del recuento de .home-panel/.home-kpi-grid: es un contenedor de layout, no un bloque.
  assert.doesNotMatch(primary, /class="home-panel home-layout|class="home-kpi-grid home-layout/);
});
