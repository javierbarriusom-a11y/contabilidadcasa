const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { execFileSync } = require("node:child_process");

// OPT-3 · Bloque 1: `tools/build-public-site.mjs` copiaba los ficheros fuente tal cual a `dist/`, sin
// minificar — app.js pesaba 1,54 MB sin comprimir en cada visita. Minifica JS y CSS solo en la copia
// publicada, con esbuild, después de copiar y de la reescritura de CACHE_NAME.

const root = path.resolve(__dirname, "..");

// OPT-6: construye en un directorio temporal propio, no en `dist/` — `node --test` corre archivos
// de test en paralelo, y esta suite comparte máquina con `tests/public-site-assets.test.cjs`, que
// también invoca este mismo script de verdad. Sin aislar el destino, el `fs.rmSync` de un proceso
// puede borrar lo que el otro está leyendo a mitad de copia (visto en CI: ENOENT intermitente).
let distDir;
test.before(() => {
  distDir = fs.mkdtempSync(path.join(os.tmpdir(), "opt3-dist-"));
  execFileSync(process.execPath, [path.join(root, "tools/build-public-site.mjs")], {
    cwd: root,
    stdio: "pipe",
    env: { ...process.env, BUILD_PUBLIC_SITE_DEST: distDir },
  });
});
test.after(() => {
  if (distDir) fs.rmSync(distDir, { recursive: true, force: true });
});

test("build:site minifica JS y CSS en dist sin tocar el fuente del repositorio", () => {
  const sourceApp = fs.readFileSync(path.join(root, "app.js"), "utf8");
  const distApp = fs.readFileSync(path.join(distDir, "app.js"), "utf8");
  assert.notEqual(distApp, sourceApp, "dist/app.js debe ser el resultado minificado, no una copia literal");
  assert.ok(distApp.length < sourceApp.length * 0.8, "app.js minificado debería pesar sensiblemente menos que el fuente");

  const sourceCss = fs.readFileSync(path.join(root, "styles.css"), "utf8");
  const distCss = fs.readFileSync(path.join(distDir, "styles.css"), "utf8");
  assert.notEqual(distCss, sourceCss, "dist/styles.css debe ser el resultado minificado, no una copia literal");
  assert.ok(distCss.length < sourceCss.length * 0.9, "styles.css minificado debería pesar sensiblemente menos que el fuente");
});

test("build:site no minifica los .html publicados: mismo marcado que el fuente", () => {
  const sourceHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const distHtml = fs.readFileSync(path.join(distDir, "index.html"), "utf8");
  assert.equal(distHtml, sourceHtml, "index.html se copia tal cual: esbuild no minifica HTML y alterar el marcado publicado rompería test:smoke");
});

test("build:site no reminifica el vendor ya minificado de origen", () => {
  const sourceVendor = fs.readFileSync(path.join(root, "vendor/xlsx.full.min.js"), "utf8");
  const distVendor = fs.readFileSync(path.join(distDir, "vendor/xlsx.full.min.js"), "utf8");
  assert.equal(distVendor, sourceVendor, "vendor/xlsx.full.min.js ya llega minificado; no debe tocarse de nuevo");
});

test("build:site no minifica service-worker.js: CACHE_NAME debe seguir siendo legible byte a byte", () => {
  const distWorker = fs.readFileSync(path.join(distDir, "service-worker.js"), "utf8");
  assert.match(distWorker, /const CACHE_NAME = "[^"]+";\n/, "service-worker.js debe conservar formato legible en dist");
  assert.ok(distWorker.split("\n").length > 5, "service-worker.js sin minificar conserva sus saltos de línea");
});

test("el fuente del repositorio no cambia al construir el sitio publicado", () => {
  const before = fs.readFileSync(path.join(root, "app.js"), "utf8");
  const secondDist = fs.mkdtempSync(path.join(os.tmpdir(), "opt3-dist-"));
  try {
    execFileSync(process.execPath, [path.join(root, "tools/build-public-site.mjs")], {
      cwd: root,
      stdio: "pipe",
      env: { ...process.env, BUILD_PUBLIC_SITE_DEST: secondDist },
    });
    const after = fs.readFileSync(path.join(root, "app.js"), "utf8");
    assert.equal(after, before, "construir dist nunca debe modificar app.js en el repositorio");
  } finally {
    fs.rmSync(secondDist, { recursive: true, force: true });
  }
});
