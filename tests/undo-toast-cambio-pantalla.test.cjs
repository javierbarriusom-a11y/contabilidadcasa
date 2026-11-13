const test = require("node:test");
const assert = require("node:assert/strict");
const { codigoApp } = require("./helpers/codigo-app.cjs");

// 13/11/2026, decisión del hogar: el aviso de «Deshacer» se cierra al cambiar de pantalla.
//
// Motivo: el aviso dura 10 s (DEX4) y flota sobre la parte baja. En el móvil seguía visible en la pantalla
// siguiente y tapaba sus botones: en la e2e «Ensayo del cierre» a 390 px, el toque en «Firmar cierre» caía en
// el aviso de la regla recién creada (6 de 10 pasadas). El «Deshacer» es de la pantalla que se deja.
//
// Todas las vías de navegación (menú, hash, `data-e17-target`, `navigateE17`) acaban en `setActiveView`, en
// los dos temas, así que basta con cerrarlo ahí, y solo cuando la pantalla cambia de verdad: repintar la misma
// pantalla no debe comerse el «Deshacer». La e2e del ensayo lo comprueba en el navegador.

const app = codigoApp();

function functionBody(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} existe en el código de la app`);
  const open = source.indexOf(") {\n", start) + 2; // el cuerpo, no los `{ }` de los parámetros por defecto
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    else if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(open, index + 1);
    }
  }
  throw new Error(`no se encuentra el final de ${name}`);
}

test("setActiveView cierra el «Deshacer» solo cuando la pantalla cambia", () => {
  const body = functionBody(app, "setActiveView");
  const calls = body.match(/hideUndoToast\(\)/g) || [];
  assert.equal(calls.length, 1, "una sola llamada a hideUndoToast en setActiveView");
  const line = body.split("\n").find((text) => text.includes("hideUndoToast()"));
  assert.match(line, /if \(viewChanged\) hideUndoToast\(\);/, "dentro de `if (viewChanged)`: repintar la misma pantalla no lo cierra");
});

test("hideUndoToast vacía la pila entera y cancela sus temporizadores", () => {
  const body = functionBody(app, "hideUndoToast");
  assert.match(body, /clearTimeout\(entry\.timer\)/);
  assert.match(body, /undoStack = \[\]/);
  assert.match(body, /renderUndoToast\(\)/);
});
