// 22/11/2026 (despliegues 1518 y 1521 en rojo, en Safari a 390 px): en el móvil la barra del navegador se esconde o aparece al
// desplazarse y Safari lanza «resize» cambiando solo el alto. La app repintaba entera la sección activa en cada uno: los plegables
// abiertos se cerraban y lo que se iba a tocar se movía. Ahora solo repinta si cambia el ancho.
const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const { codigoApp } = require("./helpers/codigo-app.cjs");

const app = codigoApp();

function extract(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `falta ${name}`);
  let depth = 0;
  for (let i = app.indexOf("{", start); i < app.length; i += 1) {
    if (app[i] === "{") depth += 1;
    if (app[i] === "}") { depth -= 1; if (depth === 0) return app.slice(start, i + 1); }
  }
  throw new Error(name);
}

test("solo un cambio de ancho repinta; el alto (la barra del navegador del móvil) no", () => {
  const sandbox = {};
  vm.runInNewContext(`let lastResizeWidth = 390; ${extract("resizeChangesLayout")}; this.f = resizeChangesLayout;`, sandbox);
  assert.equal(sandbox.f(390), false, "mismo ancho, otro alto: nada");
  assert.equal(sandbox.f(390), false);
  assert.equal(sandbox.f(1280), true, "girar o ensanchar: se repinta");
  assert.equal(sandbox.f(1280), false);
  assert.equal(sandbox.f(390), true);
});

test("el «resize» de la ventana pasa por el filtro antes de forzar el repintado", () => {
  assert.match(app, /window\.addEventListener\("resize", handleWindowResize\);/);
  const handler = extract("handleWindowResize");
  assert.match(handler, /^function handleWindowResize\(\) \{\n {2}if \(!resizeChangesLayout\(window\.innerWidth\)\) return;/);
  assert.match(handler, /scheduleActiveSectionRender\(viewFromHash\(\), \{ force: true \}\);/);
  assert.doesNotMatch(app, /window\.addEventListener\("resize", \(\) => \{\n {4}if \(renderFrame\)/);
});
