const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { codigoApp, FICHEROS_APP } = require("./helpers/codigo-app.cjs");

// XGO-01 · PR-0 (sesión 328, 20/10/2026): las pruebas leen el código de la app con tests/helpers/codigo-app.cjs, no
// app.js a pelo, para que desalojar app.js no rompa pruebas cuya función solo ha cambiado de fichero. Ensayo antes de
// publicarlo: mover 8 funciones de Registrar a registrar-ui.js rompía 22 pruebas sin el ayudante y ninguna con él.

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");

// Pruebas que tratan app.js como fichero (su techo de líneas, su versión minificada): esas sí lo leen directamente.
const LEEN_APP_JS_COMO_FICHERO = new Set(["arq4-techo-app-js.test.cjs", "opt3-minify-dist.test.cjs"]);

test("ninguna prueba lee app.js con fs.readFileSync salvo las que lo tratan como fichero", () => {
  const lecturaDirecta = /readFileSync\(\s*(?:path\.(?:join|resolve)\([^)]*["']\.?\.?\/?app\.js["']\s*\)|require\.resolve\(\s*["']\.\.\/app\.js["']\s*\))/;
  const infractoras = fs
    .readdirSync(__dirname)
    .filter((name) => /\.test\.c?js$/.test(name) && !LEEN_APP_JS_COMO_FICHERO.has(name))
    .filter((name) => lecturaDirecta.test(read(path.join("tests", name))));
  assert.deepEqual(infractoras, [], "usa codigoApp() de tests/helpers/codigo-app.cjs");
});

test("los ficheros del código de la app existen y se cargan antes que app.js, en el mismo ámbito global", () => {
  assert.equal(FICHEROS_APP[0], "app.js", "app.js primero: las posiciones dentro de app.js no cambian");
  const html = read("index.html");
  const appAt = html.indexOf('<script defer src="app.js?v=');
  assert.ok(appAt > 0);
  FICHEROS_APP.slice(1).forEach((file) => {
    const at = html.indexOf(`<script defer src="${file}?v=`);
    assert.ok(at > 0 && at < appAt, `${file}: script clásico con defer, antes de app.js`);
    assert.doesNotMatch(read(file), /^\s*(?:import|export)\s/m, `${file}: script clásico, sin módulos ES`);
  });
});

test("codigoApp() es app.js seguido de los ficheros desalojados y de los que pida cada prueba", () => {
  const esperado = [...FICHEROS_APP, "views/cierre.js"].map(read).join("\n");
  assert.equal(codigoApp("views/cierre.js"), esperado);
  assert.ok(codigoApp().startsWith(read("app.js")));
});
