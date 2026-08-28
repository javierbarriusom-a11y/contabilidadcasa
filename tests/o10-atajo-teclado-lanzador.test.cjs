/**
 * tests/o10-atajo-teclado-lanzador.test.cjs
 *
 * #10/P-6 (Ola 4, plan de mejora post-E20 · 28/08/2026, ver BACKLOG.md §9): atajo de teclado
 * Cmd/Ctrl+K para el lanzador "Buscar o abrir" (E17). El catálogo y la búsqueda difusa ya existían
 * (`e17-experience.js`, `openE17Dialog("launcher")`, `data-e17-open="launcher"`); lo único nuevo es
 * el cableado del atajo dentro de `setupE17Experience()` — ningún motor ni diálogo nuevo.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const html = read("index.html");
const app = read("app.js");

function extractFunction(name) {
  let start = app.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `No existe la función ${name} en app.js`);
  let parenDepth = 0;
  let bodyStart = -1;
  for (let index = app.indexOf("(", start); index < app.length; index += 1) {
    if (app[index] === "(") parenDepth += 1;
    else if (app[index] === ")") {
      parenDepth -= 1;
      if (parenDepth === 0) {
        bodyStart = app.indexOf("{", index);
        break;
      }
    }
  }
  assert.ok(bodyStart >= 0, `No se encontró el cuerpo de ${name}`);
  let depth = 0;
  for (let index = bodyStart; index < app.length; index += 1) {
    if (app[index] === "{") depth += 1;
    else if (app[index] === "}") {
      depth -= 1;
      if (depth === 0) return app.slice(start, index + 1);
    }
  }
  throw new Error(`La función ${name} no cierra sus llaves`);
}

// Ejecuta setupE17Experience() de verdad en un sandbox con un `document` mínimo que solo captura
// los listeners registrados (nada de JSDOM: mismo límite que el resto de la suite). Devuelve el
// handler de "keydown" capturado, listo para invocar con eventos sintéticos.
function captureKeydownHandler({ dialogOpen = false } = {}) {
  const listeners = {};
  const openCalls = [];
  const context = {
    applyE17Preferences: () => {},
    qs: () => null,
    openE17Dialog: (kind) => openCalls.push(kind),
    document: {
      addEventListener: (type, handler) => { listeners[type] = handler; },
      querySelector: (selector) => (selector === "dialog[open]" && dialogOpen ? {} : null),
    },
  };
  vm.createContext(context);
  vm.runInContext(extractFunction("setupE17Experience"), context);
  context.setupE17Experience();
  assert.ok(typeof listeners.keydown === "function", "setupE17Experience debe registrar un listener de keydown");
  return { keydown: listeners.keydown, openCalls };
}

function fakeEvent({ key, metaKey = false, ctrlKey = false }) {
  const calls = [];
  return { event: { key, metaKey, ctrlKey, preventDefault: () => calls.push("preventDefault") }, calls };
}

test("#10/P-6 · Cmd+K (metaKey) abre el lanzador y evita el comportamiento por defecto", () => {
  const { keydown, openCalls } = captureKeydownHandler();
  const { event, calls } = fakeEvent({ key: "k", metaKey: true });
  keydown(event);
  assert.deepEqual(openCalls, ["launcher"]);
  assert.deepEqual(calls, ["preventDefault"]);
});

test("#10/P-6 · Ctrl+K (ctrlKey) también abre el lanzador", () => {
  const { keydown, openCalls } = captureKeydownHandler();
  const { event } = fakeEvent({ key: "K", ctrlKey: true });
  keydown(event);
  assert.deepEqual(openCalls, ["launcher"]);
});

test("#10/P-6 · sin Cmd/Ctrl no hace nada, aunque la tecla sea K", () => {
  const { keydown, openCalls } = captureKeydownHandler();
  const { event, calls } = fakeEvent({ key: "k" });
  keydown(event);
  assert.deepEqual(openCalls, []);
  assert.deepEqual(calls, []);
});

test("#10/P-6 · Cmd/Ctrl con otra tecla no hace nada", () => {
  const { keydown, openCalls } = captureKeydownHandler();
  const { event } = fakeEvent({ key: "j", metaKey: true });
  keydown(event);
  assert.deepEqual(openCalls, []);
});

test("#10/P-6 · con un <dialog> nativo ya abierto, no apila el lanzador encima", () => {
  const { keydown, openCalls } = captureKeydownHandler({ dialogOpen: true });
  const { event, calls } = fakeEvent({ key: "k", metaKey: true });
  keydown(event);
  assert.deepEqual(openCalls, []);
  assert.deepEqual(calls, [], "sin abrir el lanzador tampoco hace falta preventDefault");
});

// --- Wiring estático ------------------------------------------------------------------------------

test("#10/P-6 · el botón «Buscar o abrir» anuncia el atajo (title/aria-keyshortcuts)", () => {
  assert.match(
    html,
    /<button type="button" class="e17-nav-button" data-e17-open="launcher" title="Buscar o abrir \(Cmd\/Ctrl\+K\)" aria-keyshortcuts="Meta\+K Control\+K">Buscar o abrir<\/button>/,
  );
});

test("#10/P-6 · el listener vive en setupE17Experience, junto al resto del cableado de E17", () => {
  const source = extractFunction("setupE17Experience");
  assert.match(source, /document\.addEventListener\("keydown", \(event\) => \{/);
  assert.match(source, /openE17Dialog\("launcher"\);/);
});
