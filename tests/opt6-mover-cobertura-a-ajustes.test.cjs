const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

// OPT-6 · Bloque 2: el editor de cobertura aprendida (H-3b, fecha de próximo ingreso y gasto
// diario) era configuración puntual, no lectura diaria — no encajaba en «Hoy» (mockup 1a: «una
// lectura y tres decisiones»). Se traslada a Ajustes, manteniendo la misma lógica de
// guardado/reset; «Hoy» conserva solo la lectura (#e6CoveragePanel).

function sectionRange(id) {
  const openTag = new RegExp(`<section[^>]*id="${id}"[^>]*>`).exec(html);
  assert.ok(openTag, `No existe la sección #${id}`);
  const start = openTag.index + openTag[0].length;
  const end = html.indexOf("<section", start);
  assert.ok(end > start, `No se encontró el final de la sección #${id}`);
  return html.slice(start, end);
}

test("el editor de cobertura (formulario) vive en #ajustes, no en #home", () => {
  const home = sectionRange("home");
  const ajustes = sectionRange("ajustes");
  assert.doesNotMatch(home, /id="e6CoverageEditor"/, "el editor ya no debe estar en Hoy");
  assert.doesNotMatch(home, /id="e6CoverageForm"/);
  assert.match(ajustes, /id="e6CoverageEditor"/, "el editor debe vivir en Ajustes");
  assert.match(ajustes, /id="e6CoverageForm"/);
  assert.match(ajustes, /id="e6NextIncomeDate"/);
  assert.match(ajustes, /id="e6DailyOutflow"/);
  assert.match(ajustes, /id="e6CoverageReset"/);
  assert.match(ajustes, /id="e6CoverageSave"/);
});

test("la lectura de cobertura (#e6CoveragePanel) se queda en #home", () => {
  const home = sectionRange("home");
  const ajustes = sectionRange("ajustes");
  assert.match(home, /id="e6CoveragePanel"/, "la lectura sigue en Hoy");
  assert.doesNotMatch(ajustes, /id="e6CoveragePanel"/, "la lectura no se duplica en Ajustes");
});

test("renderAjustes rellena el editor de cobertura al entrar en Ajustes, no solo al pasar por Hoy", () => {
  const start = app.indexOf("function renderAjustes(");
  assert.ok(start >= 0, "No existe renderAjustes en app.js");
  const end = app.indexOf("\n}", start);
  const body = app.slice(start, end);
  assert.match(body, /renderE6Coverage\(\);/);
});

test("guardar y retirar el ajuste siguen usando la misma lógica de siempre (scenarioSettings.e6Coverage)", () => {
  assert.match(app, /function saveE6Coverage\(/);
  assert.match(app, /function resetE6Coverage\(/);
  assert.match(app, /scenarioSettings\.e6Coverage = \{/);
  assert.match(app, /qs\("e6CoverageForm"\)\?\.addEventListener\("submit", saveE6Coverage\)/);
  assert.match(app, /qs\("e6CoverageReset"\)\?\.addEventListener\("click", resetE6Coverage\)/);
});
