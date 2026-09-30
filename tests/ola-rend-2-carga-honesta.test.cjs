/**
 * tests/ola-rend-2-carga-honesta.test.cjs
 *
 * Rendimiento (30/09/2026), opción «carga honesta» elegida por el hogar. Tres piezas que van juntas:
 *
 *   1. La cabecera nace en su estado final para Hoy (eyebrow oculto, <h1> solo para lectores de pantalla), de modo que
 *      `app.js` ya no la contrae al terminar de arrancar: adiós al salto de ~140 px (CLS 0,147 → ~0).
 *   2. La puerta de LCP de Lighthouse pasa de «error» a «warn» con el MISMO umbral: solo pasaba porque el titular
 *      provisional contaba como contenido pintado. CLS (0,1) y TBT siguen siendo «error».
 *   3. Una puerta nueva, `test:load-budget`, exige que Hoy tenga contenido en ≤ 5 s en visita repetida con la CPU 4x
 *      (mediana de tres visitas), y corre en cada PR después de instalar Chromium.
 *
 * Las dos primeras solo tienen sentido juntas con la tercera: si se quita la puerta nueva, el LCP deja de vigilarse.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const html = read("index.html");
const app = read("app.js");

test("la cabecera nace en su estado final para Hoy: eyebrow oculto y titular solo para lectores de pantalla", () => {
  assert.match(html, /<p class="eyebrow" id="viewEyebrow" hidden>/);
  assert.match(html, /<h1 id="viewTitle" tabindex="-1" class="sr-only">/);
});

test("`setActiveView` sigue mostrando eyebrow y titular en las pantallas sin cabecera propia", () => {
  // Si estas dos líneas cambian, las pantallas sin <h2> propio quedarían sin título visible.
  assert.match(app, /viewEyebrow\.hidden = hasOwnHeader;/);
  assert.match(app, /viewTitle\.classList\.toggle\("sr-only", hasOwnHeader \|\| Boolean\(document\.getElementById\(viewId\)\?\.querySelector\("h1, h2"\)\)\);/);
});

test("Lighthouse: LCP es aviso con el mismo umbral; CLS y TBT siguen siendo error", () => {
  delete require.cache[require.resolve("../.lighthouserc.cjs")];
  const assertions = require("../.lighthouserc.cjs").ci.assert.assertions;
  assert.deepEqual(assertions["largest-contentful-paint"], ["warn", { maxNumericValue: 4000 }]);
  assert.deepEqual(assertions["cumulative-layout-shift"], ["error", { maxNumericValue: 0.1 }]);
  assert.deepEqual(assertions["total-blocking-time"], ["error", { maxNumericValue: 5000 }]);
});

test("la puerta nueva existe, mide la mediana de visitas repetidas y falla por encima de 5000 ms", () => {
  const pkg = JSON.parse(read("package.json"));
  assert.equal(pkg.scripts["test:load-budget"], "node tools/measure-load.mjs --budget=5000");
  assert.equal(pkg.scripts["measure:load"], "node tools/measure-load.mjs");
  const tool = read("tools/measure-load.mjs");
  assert.match(tool, /const REPEATS = 3;/);
  assert.match(tool, /Number\(process\.env\.MEASURE_CPU \|\| 4\)/);
  assert.match(tool, /median\(values\)/);
  assert.match(tool, /if \(mid > budget\) failure = /);
  // Sin medida válida la puerta falla en vez de pasar en silencio.
  assert.match(tool, /values\.some\(\(value\) => value === null\)/);
  assert.match(tool, /if \(failure\) throw new Error\(failure\)/);
});

test("el pipeline ejecuta la puerta nueva en cada PR, después de instalar Chromium", () => {
  const workflow = read(".github/workflows/pages.yml");
  const install = workflow.indexOf("playwright install");
  const gate = workflow.indexOf("npm run test:load-budget");
  assert.ok(install >= 0 && gate > install, "test:load-budget debe ir después de instalar Chromium");
  assert.doesNotMatch(workflow.slice(0, gate), /if: github\.event_name != 'pull_request'/, "debe correr también en cada PR");
});
