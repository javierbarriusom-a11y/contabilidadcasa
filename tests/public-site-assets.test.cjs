const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { execFileSync } = require("node:child_process");

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

// La caché del Service Worker (service-worker.js) solo se invalida en el navegador cuando el propio
// fichero cambia byte a byte. Del 14 al 19 de agosto de 2026 se desplegaron Registrar, Escenarios,
// Cierre, Análisis y Sobres sin que nadie tocara `CACHE_NAME` a mano: los navegadores que ya tenían
// el Service Worker instalado siguieron sirviendo en silencio el shell del 14 de agosto. La
// construcción ahora reescribe `CACHE_NAME` en cada build con una referencia de versión — esta
// prueba ejecuta el build de verdad y comprueba que el resultado publicado no es el fichero fuente
// tal cual, para que un futuro retroceso de esa lógica rompa `npm test`, no el sitio en producción.
test("build:site reescribe CACHE_NAME de service-worker.js en cada build, nunca lo deja fijo", () => {
  // OPT-6: destino propio, no `dist/` — node --test corre archivos en paralelo, y `dist/` también
  // lo escribe tests/opt3-minify-dist.test.cjs; sin aislar, el fs.rmSync de un proceso puede borrar
  // lo que el otro está leyendo a mitad de copia (visto en CI: ENOENT intermitente).
  const tempDist = fs.mkdtempSync(path.join(os.tmpdir(), "public-site-assets-dist-"));
  try {
    execFileSync(process.execPath, [path.join(root, "tools/build-public-site.mjs")], {
      cwd: root,
      stdio: "pipe",
      env: { ...process.env, BUILD_PUBLIC_SITE_DEST: tempDist },
    });
    const sourceWorker = fs.readFileSync(path.join(root, "service-worker.js"), "utf8");
    const distWorker = fs.readFileSync(path.join(tempDist, "service-worker.js"), "utf8");
    const sourceCacheName = sourceWorker.match(/const CACHE_NAME = "([^"]*)";/)?.[1];
    const distCacheName = distWorker.match(/const CACHE_NAME = "([^"]*)";/)?.[1];
    assert.ok(sourceCacheName, "service-worker.js debería declarar CACHE_NAME");
    assert.ok(distCacheName, "dist/service-worker.js debería declarar CACHE_NAME");
    assert.notEqual(distCacheName, sourceCacheName, "el build debe versionar CACHE_NAME, no copiarlo tal cual");
  } finally {
    fs.rmSync(tempDist, { recursive: true, force: true });
  }
});
