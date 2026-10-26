const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// RD-WK (P14 del rediseño, 19/10/2026): las pruebas de las pantallas v2 a 390 px se repiten en WebKit, el motor del Safari
// del iPhone del hogar. Aquí, que el proyecto, la etiqueta y el paso del CI siguen puestos; el navegador solo corre en el CI.

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const workflow = read(".github/workflows/pages.yml");
const qa1 = read("tests/qa1-flujos-completos.spec.cjs");

test("el proyecto «safari» es WebKit con el iPhone 13 a 390×844 y solo coge las pruebas @safari de qa1", () => {
  const { projects } = require("../playwright.config.cjs");
  const safari = projects.find((p) => p.name === "safari");
  assert.ok(safari, "falta el proyecto safari");
  assert.equal(safari.testMatch, "qa1-flujos-completos.spec.cjs");
  assert.ok(safari.grep.test("algo @safari") && !safari.grep.test("algo"), "filtra por la etiqueta");
  assert.equal(safari.use.browserName, "webkit");
  assert.deepEqual(safari.use.viewport, { width: 390, height: 844 });
  assert.equal(safari.use.isMobile, true);
  assert.equal(safari.use.hasTouch, true);
  assert.match(read("package.json"), /"test:safari": "playwright test --project=safari"/);
});

test("el CI instala WebKit y corre test:safari, bloqueante y antes de guardar las trazas", () => {
  const at = workflow.indexOf("probar las pantallas v2 en Safari");
  assert.ok(at > 0, "falta el paso de Safari");
  const step = workflow.slice(at, workflow.indexOf("- name:", at + 1));
  assert.match(step, /npx playwright install --with-deps webkit/);
  assert.match(step, /npm run test:safari/);
  assert.doesNotMatch(step, /continue-on-error/, "bloquea como el resto de pruebas en navegador");
  assert.ok(workflow.indexOf("npm run test:e2e") < at, "después de las de Chromium");
  assert.ok(at < workflow.indexOf("Guardar trazas y capturas de Playwright"), "un fallo en Safari también deja sus trazas");
  assert.ok(at < workflow.indexOf("npm run measure:load-webkit"), "la medición informativa reutiliza el WebKit ya instalado");
});

test("las pantallas v2 llevan su prueba a 390 px en Safari, y el menú principal su barrido", () => {
  const conEtiqueta = (describe) => {
    const at = qa1.indexOf(`test.describe("${describe}"`);
    assert.ok(at >= 0, `falta «${describe}»`);
    const end = qa1.indexOf("\ntest.describe(", at + 1);
    return /tag: "@safari"|enSafari\(viewport\)|\["@safari"\]/.test(qa1.slice(at, end < 0 ? undefined : end));
  };
  for (const describe of [
    "Rediseño A4 · Movimientos v2",
    "Rediseño A4 · Importar v2",
    "XDA-02 · Importar en un toque",
    "Rediseño A5 · Clasificar por lotes",
    "XGO-03 · Funciones en prueba",
    "XDA-05 · Calibración de Clasificar",
    "Ensayo del cierre de octubre · importar, clasificar y llegar a firmar",
    "XDA-03 · texto de un PDF",
    "Hoy, cambio 1 · cobros y cargos esperados en la bandeja de Movimientos (v2)",
    "Hoy, cambio 2 · entrada al Repaso semanal (v2)",
    "Rediseño B5 · Repaso semanal",
    "RD-WK · el menú principal en el móvil",
  ]) {
    assert.ok(conEtiqueta(describe), `«${describe}» sin prueba @safari`);
  }
  assert.match(qa1, /const enSafari = \(viewport\) => \(\{ tag: viewport\.width === 390 \? \["@safari"\] : \[\] \}\);/, "en los dos anchos, solo el de 390");
});
