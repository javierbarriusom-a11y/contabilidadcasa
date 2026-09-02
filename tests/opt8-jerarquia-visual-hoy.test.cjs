const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const indexSource = fs.readFileSync(require.resolve("../index.html"), "utf8");
const stylesSource = fs.readFileSync(require.resolve("../styles.css"), "utf8");

// OPT-8 (BACKLOG_OPTIMIZACION.md, depende de OPT-6/OPT-7, ya construidas): "Hoy" tenía ~10 módulos
// con el mismo peso visual (.home-panel). Máximo 4 bloques en la zona principal, sin scroll en
// desktop: cobertura, "el mes en una línea", decisiones abiertas, KPIs principales — el resto
// (salud financiera, próximos hitos, banda de 12 meses, modo familiar, alertas) pasa a una segunda
// sección con scroll de página (no eliminado), con menos peso tipográfico usando los tokens E19 ya
// existentes.

function homeSectionHtml() {
  const openTag = /<section[^>]*id="home"[^>]*>/.exec(indexSource);
  assert.ok(openTag, "No existe la sección #home");
  const start = openTag.index + openTag[0].length;
  const end = indexSource.indexOf('<section class="view-section widget-view"', start);
  return indexSource.slice(start, end);
}

test("OPT-8: la zona principal (.home-primary-section) contiene exactamente cobertura, el mes en una línea, decisiones abiertas y KPIs", () => {
  const home = homeSectionHtml();
  const start = home.indexOf('<div class="home-primary-section">');
  const end = home.indexOf('<p class="e19-kpi-note home-secondary-label">');
  assert.ok(start >= 0 && end > start, "No existe .home-primary-section delimitada por la etiqueta de sección secundaria");
  const primary = home.slice(start, end);
  assert.match(primary, /id="e6CoveragePanel"/);
  assert.match(primary, /id="homeMonthGlance"/);
  assert.match(primary, /home-main-panel/);
  assert.match(primary, /<div class="home-kpi-grid" id="homeKpis" data-meeting-step="1"><\/div>/);
  // lo que NO debe estar en la zona principal (pasó a la de detalle)
  assert.doesNotMatch(primary, /id="homeHealthScoreCard"/);
  assert.doesNotMatch(primary, /Próximos hitos/);
  assert.doesNotMatch(primary, /id="homeMonthBand"/);
  assert.doesNotMatch(primary, /Modo familiar/);
  assert.doesNotMatch(primary, /Alertas configurables/);
});

test("OPT-8: la sección de detalle (.home-secondary-section) contiene salud financiera, próximos hitos, banda de 12 meses, modo familiar y alertas", () => {
  const home = homeSectionHtml();
  const start = home.indexOf('<div class="home-secondary-section">');
  assert.ok(start >= 0, "No existe .home-secondary-section");
  const secondary = home.slice(start);
  assert.match(secondary, /id="homeHealthScoreCard" hidden data-meeting-step="1"/);
  assert.match(secondary, /Próximos hitos/);
  assert.match(secondary, /id="homeMonthBand"/);
  assert.match(secondary, /Modo familiar/);
  assert.match(secondary, /Alertas configurables/);
});

test("OPT-8: sigue habiendo un bloque por cada paso del modo reunión (1-4), aunque ahora vivan en dos secciones", () => {
  const home = homeSectionHtml();
  ["1", "2", "3", "4"].forEach((step) => {
    assert.match(home, new RegExp(`data-meeting-step="${step}"`), `Falta un bloque con data-meeting-step="${step}"`);
  });
});

test("OPT-8: no se ha eliminado ningún bloque — los diez siguen presentes en #home", () => {
  const home = homeSectionHtml();
  [
    "homeBudgetGlance", "homeHealthScoreCard", "e6CoveragePanel", "homeMonthGlance", "home-main-panel",
    "homePriorities", "homeKpis", "homeMonthBand", "homeFamilySummary", "homeAlertSummary",
  ].forEach((needle) => {
    assert.match(home, new RegExp(needle), `Falta ${needle} en #home`);
  });
});

test("OPT-8: la sección de detalle usa los tokens E19 ya existentes para bajar el peso, sin inventar ninguno nuevo", () => {
  assert.match(stylesSource, /\.home-secondary-section \.module-heading h3 \{[^}]*var\(--e19-text-md/);
  assert.match(stylesSource, /\.home-secondary-section \.module-heading h3 \{[^}]*var\(--e19-muted/);
  assert.match(stylesSource, /\.home-secondary-section \.panel-kicker \{[^}]*var\(--e19-muted/);
});

test("OPT-8: ninguna sección introduce un scroll anidado (overflow propio) — el detalle usa el scroll de la página", () => {
  const rule = /\.home-secondary-section\s*\{[^}]*\}/.exec(stylesSource);
  assert.ok(rule, "No existe la regla .home-secondary-section");
  assert.doesNotMatch(rule[0], /overflow/);
  assert.doesNotMatch(rule[0], /max-height/);
});

test("styles.css está versionado en index.html", () => {
  assert.match(indexSource, /styles\.css\?v=/);
});
