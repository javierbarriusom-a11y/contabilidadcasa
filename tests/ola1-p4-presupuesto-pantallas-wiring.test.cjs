const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// Ola 1 · P4: el presupuesto de rendimiento por pantalla solo protege si de verdad corre en el CI.
// Este test comprueba el cableado (proyecto de Playwright, script npm y paso de pages.yml) y que los
// topes no se han relajado en silencio: subirlos es una decisión, no un retoque.

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");

test("proyecto perf-screens, script npm y paso del workflow apuntan al mismo spec", () => {
  assert.match(read("playwright.config.cjs"), /name: "perf-screens", testMatch: "p4-presupuesto-pantallas\.spec\.cjs"/);
  assert.equal(JSON.parse(read("package.json")).scripts["test:perf-screens"], "playwright test --project=perf-screens");
  const workflow = read(".github/workflows/pages.yml");
  assert.match(workflow, /- run: npm run test:perf-screens/);
  assert.ok(
    workflow.indexOf("npx playwright install") < workflow.indexOf("npm run test:perf-screens"),
    "el paso de rendimiento por pantalla debe ir después de instalar Chromium",
  );
  assert.ok(workflow.indexOf("npm run test:perf-screens") < workflow.indexOf("upload-pages-artifact"), "debe ejecutarse antes de publicar");
  assert.ok(fs.existsSync(path.join(root, "tests/p4-presupuesto-pantallas.spec.cjs")));
});

test("los topes deterministas de llamadas siguen en el orden de magnitud medido tras P1", () => {
  const spec = read("tests/p4-presupuesto-pantallas.spec.cjs");
  const limits = Object.fromEntries([...spec.matchAll(/hash: "([^"]+)", maxMs: (\d+), counted: [^,]+, maxCalls: (\d+)/g)].map((m) => [m[1], { ms: Number(m[2]), calls: Number(m[3]) }]));
  assert.deepEqual(Object.keys(limits).sort(), ["debt-control", "deuda-comparar", "planificacion-partidas", "virtual-advisor"]);
  // Antes de P1 el Asesor virtual llegaba a 40.176 llamadas: cualquier tope por encima de 2.000 no lo vigilaría.
  assert.ok(limits["virtual-advisor"].calls <= 2000);
  assert.ok(limits["debt-control"].calls <= 1000);
  assert.ok(limits["deuda-comparar"].calls <= 4000);
  // Antes de la Ola 2, Planificación de partidas llegaba a 337.063 llamadas a actualAwareInfo.
  assert.ok(limits["planificacion-partidas"].calls <= 50000);
  for (const screen of Object.values(limits)) assert.ok(screen.ms <= 1500, "el tope de tiempo es una red de seguridad, no un permiso para volver a 1,5 s en pantallas ya optimizadas");
});
