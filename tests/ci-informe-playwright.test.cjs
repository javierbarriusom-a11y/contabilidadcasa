const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// P5 del cuestionario del rediseño (19/10/2026): el CI guarda las trazas y capturas de Playwright cuando
// una prueba en navegador falla, para que un fallo intermitente deje su causa a la vista.

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const workflow = read(".github/workflows/pages.yml");

test("el paso de subida existe, solo corre en fallo y sube test-results/", () => {
  const at = workflow.indexOf("Guardar trazas y capturas de Playwright");
  assert.ok(at > 0, "falta el paso que guarda las trazas");
  const step = workflow.slice(at, workflow.indexOf("- name:", at + 1));
  assert.match(step, /if: failure\(\)/);
  assert.match(step, /uses: actions\/upload-artifact@v\d+/);
  assert.match(step, /path: test-results\//);
  assert.match(step, /if-no-files-found: ignore/);
});

test("va después de todas las pruebas en navegador y antes de la medición informativa de WebKit", () => {
  const at = workflow.indexOf("Guardar trazas y capturas de Playwright");
  for (const script of ["test:mobile-overflow", "test:e2e", "test:a11y-axe", "test:perf-screens", "test:load-budget"]) {
    assert.ok(workflow.indexOf(`npm run ${script}`) < at, `${script} debe ir antes`);
  }
  assert.ok(at < workflow.indexOf("WebKit frente a Chromium"), "la de WebKit no bloquea: su fallo no debe disparar la subida");
});

test("Playwright conserva las trazas y capturas de lo que falla, que es lo que se sube", () => {
  const config = read("playwright.config.cjs");
  assert.match(config, /trace: "retain-on-failure"/);
  assert.match(config, /screenshot: "only-on-failure"/);
});

test("lo que vio Playwright al fallar también queda en el registro, por si el artefacto no se puede descargar", () => {
  const at = workflow.indexOf("Escribir en el registro lo que vio Playwright al fallar");
  assert.ok(at > workflow.indexOf("Guardar trazas y capturas de Playwright"), "va después de guardar el artefacto");
  assert.ok(at < workflow.indexOf("WebKit frente a Chromium"), "antes de la medición informativa, que no bloquea");
  const step = workflow.slice(at, workflow.indexOf("- name:", at + 1));
  assert.match(step, /if: failure\(\)/);
  assert.match(step, /find test-results -name error-context\.md/);
  assert.match(step, /head -c \d+/, "con tope por fichero");
  assert.match(step, /::group::/);
});

// 28/10/2026: las dos pruebas que fallan de vez en cuando en el CI y nunca en local (WP-40 en Chromium y el ensayo
// del cierre en WebKit) pulsan con tests/helpers/pulsar-o-explicar.cjs, que, si no puede, dice qué pasaba en la
// página (lo que se movía, lo que se repintaba, el foco, los diálogos y los últimos clics) en lugar de solo «timeout».
test("WP-40 y el ensayo del cierre pulsan con diagnóstico, sin reintentar ni esperar más", () => {
  const helper = read("tests/helpers/pulsar-o-explicar.cjs");
  assert.match(helper, /module\.exports = \{ pulsar, registrarEventos, diagnostico \}/);
  assert.doesNotMatch(helper, /retries|repeat|for \(let intento/, "el ayudante no reintenta: un fallo de verdad sigue fallando");
  const spec = read("tests/qa1-flujos-completos.spec.cjs");
  const wp40 = spec.slice(spec.indexOf('test.describe("WP-40 · conciliación con la CIRBE"'), spec.indexOf('test.describe("WP-41'));
  assert.equal((wp40.match(/await pulsar\(page, '#cirbeForm button\[type="submit"\]'\)/g) || []).length, 3);
  assert.doesNotMatch(wp40, /#cirbeForm button\[type="submit"\]'\)\.click\(\)/);
  const ensayo = spec.slice(spec.indexOf('test.describe("Ensayo del cierre de octubre'), spec.indexOf('test.describe("XDA-04 · periodo'));
  assert.match(ensayo, /await registrarEventos\(page\);\n\s+await v2\.locator\("\[data-imp-v2-importar\]"\)\.click\(\);\n\s+await pulsar\(page, "#operationConfirmSubmit"\);/);
});

// Decisión del hogar del 28/10/2026: un reintento solo para Safari y solo en el CI. Lo que pasa al reintentarlo no se esconde.
test("Safari reintenta una vez en el CI, Chromium no, y el intento fallido queda en el registro", () => {
  const config = read("playwright.config.cjs");
  assert.match(config, /retries: 0,/, "por defecto, ninguna prueba reintenta");
  const safari = config.slice(config.indexOf('{ name: "safari"'));
  assert.match(safari.slice(0, safari.indexOf("\n")), /retries: process\.env\.CI \? 1 : 0/);
  assert.equal((config.match(/retries:/g) || []).length, 2, "solo el proyecto safari cambia los reintentos");
  const at = workflow.indexOf("Instalar WebKit y probar las pantallas v2 en Safari");
  const step = workflow.slice(at, workflow.indexOf("- name:", at + 1));
  assert.match(step, /npm run test:safari\n/);
  assert.match(step, /::warning title=Safari intermitente::/);
  assert.match(step, /error-context\.md/);
});
