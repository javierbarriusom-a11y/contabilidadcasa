const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");

// OPT-5 · Bloque 4: presupuesto de rendimiento real (Lighthouse CI) contra dist/, sustituyendo el
// umbral de peso de fichero de OPT-3. Estos tests son estáticos a propósito — lanzar Lighthouse de
// verdad necesita un Chromium instalado y un dist/ construido, y npm test tiene que seguir siendo
// rápido y sin dependencia de navegador (mismo motivo por el que test:visual/test:e2e/test:a11y-axe
// ya viven fuera de `npm test`). El recorrido real se comprobó a mano contra un dist/ de verdad
// antes de este commit.

test("package.json define test:performance-lh", () => {
  const pkg = JSON.parse(read("package.json"));
  assert.equal(pkg.scripts["test:performance-lh"], "node tools/check-lighthouse-budget.mjs");
  assert.ok(pkg.devDependencies["@lhci/cli"], "Falta @lhci/cli en devDependencies");
});

test(".lighthouserc.cjs define presupuestos reales de LCP, TBT y CLS contra dist/", () => {
  delete require.cache[require.resolve("../.lighthouserc.cjs")];
  const config = require("../.lighthouserc.cjs");
  assert.equal(config.ci.collect.staticDistDir, "dist");
  assert.deepEqual(config.ci.collect.url, ["/index.html"]);
  assert.ok(config.ci.collect.numberOfRuns >= 3, "Menos de 3 runs deja la mediana a merced de un arranque en frío");
  const assertions = config.ci.assert.assertions;
  assert.ok(assertions["largest-contentful-paint"], "Falta el presupuesto de LCP");
  assert.ok(assertions["total-blocking-time"], "Falta el presupuesto de TBT (proxy de laboratorio de INP)");
  assert.ok(assertions["cumulative-layout-shift"], "Falta el presupuesto de CLS");
  assert.equal(assertions["largest-contentful-paint"][0], "error");
  assert.equal(assertions["total-blocking-time"][0], "error");
  assert.equal(assertions["cumulative-layout-shift"][0], "error");
});

test("tools/check-lighthouse-budget.mjs exige dist/ construido y Chromium instalado antes de lanzar lhci", () => {
  const script = read("tools/check-lighthouse-budget.mjs");
  assert.match(script, /dist.*index\.html/);
  assert.match(script, /chromium\.executablePath\(\)/);
  assert.match(script, /lhci.*autorun/);
});

test("tools/check-performance.mjs ya no falla por peso de fichero — lo sustituye el presupuesto Lighthouse", () => {
  const script = read("tools/check-performance.mjs");
  assert.doesNotMatch(script, /assets > 5 \* 1024 \* 1024/);
  assert.match(script, /OPT-5/);
});

test("el pipeline de Pages instala Chromium y corre el presupuesto Lighthouse en cada PR", () => {
  const workflow = read(".github/workflows/pages.yml");
  const verifyStep = workflow.indexOf("npm run verify");
  const installStep = workflow.indexOf("playwright install");
  const lhStep = workflow.indexOf("test:performance-lh");
  assert.ok(verifyStep >= 0 && installStep > verifyStep, "El paso de Chromium debe ir después de npm run verify");
  assert.ok(lhStep > installStep, "El presupuesto Lighthouse debe correr después de instalar Chromium");
  assert.doesNotMatch(
    workflow.slice(0, lhStep),
    /if: github\.event_name != 'pull_request'/,
    "El presupuesto Lighthouse debe correr también en cada PR, no solo antes de desplegar",
  );
});

test(".lighthouseci/ (los informes de cada corrida) no se versiona", () => {
  assert.match(read(".gitignore"), /\.lighthouseci\//);
});
