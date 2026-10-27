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
