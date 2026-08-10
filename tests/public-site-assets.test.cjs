const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const builder = fs.readFileSync(path.join(root, "tools/build-public-site.mjs"), "utf8");
const smoke = fs.readFileSync(path.join(root, "tools/smoke-public.mjs"), "utf8");

const localAssets = [...new Set(
  [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map((match) => match[1])
    .filter((url) => !/^(?:https?:|#|mailto:|data:)/.test(url))
    .map((url) => url.split("?")[0]),
)];

// El sitio publicado se construye copiando una lista escrita a mano en `tools/build-public-site.mjs`,
// y Pages despliega esa carpeta (`path: dist` en `.github/workflows/pages.yml`). Un script añadido al
// `index.html` y olvidado en la lista no rompe nada en local —donde se sirve el repositorio entero—
// y desaparece solo en producción. Le pasó a `canonical-scenario-engine.js` desde E20 hasta el 10 de
// agosto de 2026: el sitio publicado se quedó sin motor de escenarios y sin avisar.
test("todo lo que carga index.html se copia al sitio publicado", () => {
  const listed = new Set([...builder.matchAll(/^\s*"([^"]+)",$/gm)].map((match) => match[1]));
  const missing = localAssets.filter(
    (relative) => !listed.has(relative) && fs.existsSync(path.join(root, relative)),
  );
  assert.deepEqual(missing, [], `index.html carga recursos que no llegan a dist: ${missing.join(", ")}`);
});

test("el motor de escenarios de E20 viaja al sitio publicado", () => {
  // Explícito porque es el que faltaba, y porque sin él se caen en silencio el comparador de
  // estrategias, la ruta de deuda, el simulador y el KPI «Libre de deuda» de Hoy.
  for (const asset of ["canonical-scenario-schema.js", "canonical-scenario-engine.js"]) {
    assert.ok(localAssets.includes(asset), `index.html debería cargar ${asset}`);
    assert.ok(builder.includes(`"${asset}"`), `${asset} debería copiarse a dist`);
  }
});

test("la construcción falla si la lista se queda corta, en vez de publicar a medias", () => {
  assert.match(builder, /index\.html carga recursos que no se copian a dist/);
});

test("el smoke test pide todos los recursos del index publicado, no una muestra", () => {
  assert.match(smoke, /const referenced = \[\.\.\.new Set\(/);
  assert.match(smoke, /el index\.html lo carga pero no está en dist/);
});
