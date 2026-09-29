const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// Ola 1 · P2: SheetJS (882 KB) deja de cargarse al arrancar; xlsx-loader.js lo pide la primera vez que
// se importa un Excel o se exporta el informe. Se mantiene en la caché offline y en el build.

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");

function makeRoot() {
  const appended = [];
  const fakeRoot = {
    appended,
    document: {
      createElement: () => ({ remove() { this.removed = true; } }),
      head: { appendChild: (script) => appended.push(script) },
    },
  };
  return fakeRoot;
}

function freshLoader(fakeRoot) {
  delete require.cache[require.resolve("../xlsx-loader.js")];
  const factorySource = read("xlsx-loader.js");
  const module = { exports: {} };
  new Function("module", "globalThis", `${factorySource}`)(module, fakeRoot);
  return module.exports;
}

test("index.html ya no carga vendor/xlsx al arrancar, pero sí el cargador diferido", () => {
  const html = read("index.html");
  assert.doesNotMatch(html, /<script[^>]*src="vendor\/xlsx\.full\.min\.js/);
  assert.match(html, /<script defer src="xlsx-loader\.js\?v=[^"]+"><\/script>/);
});

test("el Service Worker y el build siguen incluyendo la librería (uso sin conexión) y el cargador", () => {
  const sw = read("service-worker.js");
  const build = read("tools/build-public-site.mjs");
  for (const entry of ["./vendor/xlsx.full.min.js", "./xlsx-loader.js"]) assert.ok(sw.includes(`"${entry}"`), `SHELL_URLS debe incluir ${entry}`);
  for (const entry of ["vendor/xlsx.full.min.js", "xlsx-loader.js"]) assert.ok(build.includes(`"${entry}"`), `build-public-site debe copiar ${entry}`);
});

test("si la librería ya está, ensureXlsx resuelve sin insertar ningún script", async () => {
  const fakeRoot = makeRoot();
  fakeRoot.XLSX = { read() {} };
  const loader = freshLoader(fakeRoot);
  assert.equal(await loader.ensureXlsx(), fakeRoot.XLSX);
  assert.equal(fakeRoot.appended.length, 0);
  assert.equal(await loader.xlsxReady(), true);
});

test("llamadas simultáneas comparten una sola descarga y resuelven al cargar", async () => {
  const fakeRoot = makeRoot();
  const loader = freshLoader(fakeRoot);
  const first = loader.ensureXlsx();
  const second = loader.ensureXlsx();
  assert.equal(fakeRoot.appended.length, 1, "un único <script> para todas las llamadas");
  assert.match(fakeRoot.appended[0].src, /^vendor\/xlsx\.full\.min\.js\?v=/);
  fakeRoot.XLSX = { read() {} };
  fakeRoot.appended[0].onload();
  assert.equal(await first, fakeRoot.XLSX);
  assert.equal(await second, fakeRoot.XLSX);
});

test("si la descarga falla, rechaza, xlsxReady devuelve false y se puede reintentar", async () => {
  const fakeRoot = makeRoot();
  const loader = freshLoader(fakeRoot);
  const failed = loader.ensureXlsx();
  fakeRoot.appended[0].onerror();
  await assert.rejects(failed, /No se pudo descargar/);
  assert.equal(fakeRoot.appended[0].removed, true);
  const readiness = loader.xlsxReady();
  assert.equal(fakeRoot.appended.length, 2, "el reintento inserta un script nuevo");
  fakeRoot.appended[1].onerror();
  assert.equal(await readiness, false);
  const retry = loader.ensureXlsx();
  fakeRoot.XLSX = { read() {} };
  fakeRoot.appended[2].onload();
  assert.equal(await retry, fakeRoot.XLSX);
});

test("un script que carga pero no deja window.XLSX utilizable se trata como fallo", async () => {
  const fakeRoot = makeRoot();
  const loader = freshLoader(fakeRoot);
  const attempt = loader.ensureXlsx();
  fakeRoot.appended[0].onload();
  await assert.rejects(attempt, /no se pudo inicializar/);
});

test("los tres importadores activos y la exportación esperan a la librería antes de usarla", () => {
  const app = read("app.js");
  assert.equal((app.match(/if \(!\(await window\.xlsxReady\(\)\)\) \{/g) || []).length, 3);
  assert.doesNotMatch(app, /dataset\.xlsxReady/, "el flag de arranque quedaría siempre en false y nadie lo lee");
  assert.match(read("p2-export.js"), /async downloadExcel\(model, fileName\) \{\s*[^\n]*\n\s*await root\.ensureXlsx\(\);\s*root\.XLSX\.writeFile/);
  assert.match(read("p2-ui.js"), /addEventListener\("click", async \(\) => \{[\s\S]{0,300}await root\.P2Export\.downloadExcel/);
});
