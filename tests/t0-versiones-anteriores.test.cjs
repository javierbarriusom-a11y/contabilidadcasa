const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const app = read("app.js");
const html = read("index.html");
const worker = read("service-worker.js");

// Mismo método que en `tests/v6-reserva-operativa.test.cjs`: `app.js` es un script de navegador, así
// que las funciones se extraen por nombre balanceando llaves y se ejecutan sobre un DOM mínimo.
function extractFunction(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `No existe la función ${name} en app.js`);
  let depth = 0;
  for (let index = app.indexOf("{", start); index < app.length; index += 1) {
    if (app[index] === "{") depth += 1;
    else if (app[index] === "}") {
      depth -= 1;
      if (depth === 0) return app.slice(start, index + 1);
    }
  }
  throw new Error(`La función ${name} no cierra sus llaves`);
}

function extractConst(name) {
  const start = app.indexOf(`const ${name} =`);
  assert.ok(start >= 0, `No existe la constante ${name} en app.js`);
  return app.slice(start, app.indexOf("\n", start) + 1);
}

// --- DOM mínimo: encabezados y enlaces del menú avanzado, más las casillas de «Personalizar». ---

function link(group) {
  return { kind: "link", dataset: { e17Group: group }, hidden: false, hasAttribute: () => false };
}

function label(name) {
  return { kind: "label", dataset: { e17NavLabel: name }, hidden: false, hasAttribute: (attr) => attr === "data-e17-nav-label" };
}

function toggle(group) {
  const wrapper = { kind: "wrapper", hidden: false };
  return { kind: "input", dataset: { e17Preference: group }, checked: false, closest: () => wrapper, wrapper };
}

function buildDom({ nav, toggles }) {
  nav.forEach((node, index) => {
    node.nextElementSibling = nav[index + 1] || null;
  });
  const document = {
    querySelectorAll(selector) {
      if (selector === "[data-e17-group]") return nav.filter((node) => node.kind === "link");
      if (selector === "[data-e17-nav-label]") return nav.filter((node) => node.kind === "label");
      if (selector === "[data-e17-preference]") return toggles;
      const match = selector.match(/^\[data-e17-group="(.+)"\]$/);
      if (match) return nav.filter((node) => node.kind === "link" && node.dataset.e17Group === match[1]);
      throw new Error(`Selector no previsto en la prueba: ${selector}`);
    },
  };
  return document;
}

function sandbox(dom, stored = null) {
  const context = {
    document: dom,
    storageGet: (_key, fallback) => (stored === null ? fallback : stored),
    storageKey: (key) => key,
  };
  vm.createContext(context);
  vm.runInContext(
    [
      extractConst("E17_PREFERENCES_KEY"),
      extractConst("E17_DEFAULT_PREFERENCES"),
      extractFunction("e17Preferences"),
      extractFunction("e17LabelHasVisibleLinks"),
      extractFunction("e17GroupSize"),
      extractFunction("applyE17Preferences"),
    ].join("\n"),
    context,
    { filename: "app.js#t0-versiones-anteriores" },
  );
  return context;
}

test("T-0 · `legacy` nace visible, como el resto de grupos", () => {
  const context = sandbox(buildDom({ nav: [], toggles: [] }));
  assert.deepEqual({ ...context.e17Preferences() }, { analysis: true, assistants: true, data: true, legacy: true });
});

test("T-0 · una preferencia guardada sin `legacy` no lo apaga por omisión", () => {
  const context = sandbox(buildDom({ nav: [], toggles: [] }), JSON.stringify({ analysis: false }));
  const preferences = context.e17Preferences();
  assert.equal(preferences.analysis, false);
  assert.equal(preferences.legacy, true, "una copia anterior a T-0 no debe esconder las versiones anteriores");
});

test("T-0 · el encabezado «Versiones anteriores» no aparece mientras no haya nada relegado", () => {
  const legacyLabel = label("legacy");
  const datos = label("datos");
  const movimientos = link("data");
  const context = sandbox(
    buildDom({ nav: [datos, movimientos, legacyLabel], toggles: [toggle("data"), toggle("legacy")] }),
  );

  context.applyE17Preferences();

  assert.equal(datos.hidden, false, "«Datos» tiene un enlace visible");
  assert.equal(legacyLabel.hidden, true, "un encabezado sin enlaces debajo no dice nada");
});

test("T-0 · en cuanto se relega una pantalla, aparecen encabezado e interruptor", () => {
  const legacyLabel = label("legacy");
  const heredada = link("legacy");
  const interruptor = toggle("legacy");
  const context = sandbox(buildDom({ nav: [legacyLabel, heredada], toggles: [interruptor] }));

  context.applyE17Preferences();

  assert.equal(legacyLabel.hidden, false);
  assert.equal(heredada.hidden, false);
  assert.equal(interruptor.wrapper.hidden, false);
  assert.equal(interruptor.checked, true);
});

test("T-0 · apagar el grupo esconde sus enlaces y su encabezado, y volver a encenderlo los devuelve", () => {
  const legacyLabel = label("legacy");
  const heredada = link("legacy");
  const interruptor = toggle("legacy");
  const context = sandbox(buildDom({ nav: [legacyLabel, heredada], toggles: [interruptor] }));

  context.applyE17Preferences({ legacy: false });
  assert.equal(heredada.hidden, true);
  assert.equal(legacyLabel.hidden, true);
  assert.equal(interruptor.checked, false);
  assert.equal(interruptor.wrapper.hidden, false, "el interruptor sigue ahí: es el camino de vuelta");

  context.applyE17Preferences({ legacy: true });
  assert.equal(heredada.hidden, false);
  assert.equal(legacyLabel.hidden, false);
});

test("T-0 · apagar un grupo que ya existía tampoco deja su encabezado flotando", () => {
  const analizar = label("analizar");
  const proyeccion = link("analysis");
  const datos = label("datos");
  const movimientos = link("data");
  const context = sandbox(
    buildDom({ nav: [analizar, proyeccion, datos, movimientos], toggles: [toggle("analysis"), toggle("data")] }),
  );

  context.applyE17Preferences({ analysis: false, data: true });

  assert.equal(analizar.hidden, true);
  assert.equal(datos.hidden, false, "el resto del menú no se toca");
});

test("T-0 · el grupo, su encabezado y su interruptor están en el shell publicado", () => {
  assert.match(html, /data-e17-nav-label="legacy">Versiones anteriores</);
  assert.match(html, /data-e17-preference="legacy"/);
  for (const group of ["decidir", "analizar", "datos"]) {
    assert.match(html, new RegExp(`data-e17-nav-label="${group}"`), `falta el encabezado ${group}`);
  }
  assert.match(app, /E17_DEFAULT_PREFERENCES = \{ analysis: true, assistants: true, data: true, legacy: true \}/);
  assert.match(app, /const preferences = \{ \.\.\.E17_DEFAULT_PREFERENCES \}/);
  assert.match(worker, /20260814-f1a1/);
  assert.match(html, /app\.js\?v=20260814f1a1/);
});

test("T-0 · relegar no esconde una pantalla del lanzador: sigue siendo alcanzable", () => {
  const launcher = app.slice(app.indexOf("function renderE17Launcher"));
  const body = launcher.slice(0, launcher.indexOf("\n}"));
  assert.ok(!body.includes("e17Preferences"), "el lanzador no debe filtrar por las preferencias del menú");
  assert.match(body, /findTasks/);
});
