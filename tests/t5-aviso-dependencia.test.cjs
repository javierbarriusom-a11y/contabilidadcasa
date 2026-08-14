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
  const start = app.indexOf(`const ${name} = `);
  assert.ok(start >= 0, `No existe la constante ${name}`);
  const end = app.indexOf("\n];", start);
  return app.slice(start, end + 3);
}

// DOM mínimo: una sección que sepa buscar dentro de sí, prepend y remove, que es todo lo que usa
// `renderScenarioDependencyNotice`.
function nodo(tag) {
  return {
    tagName: tag.toUpperCase(),
    className: "",
    children: [],
    attrs: {},
    textContent: "",
    setAttribute(name, value) { this.attrs[name] = value; },
    getAttribute(name) { return this.attrs[name]; },
    append(...items) { this.children.push(...items); },
    prepend(...items) { this.children.unshift(...items); },
    remove() { this.parent?.children.splice(this.parent.children.indexOf(this), 1); },
    querySelector(selector) {
      const busca = (node) => {
        for (const child of node.children) {
          const clave = selector.replace(/^\[|\]$/g, "");
          if (child.attrs[clave] !== undefined) return child;
          const found = busca(child);
          if (found) return found;
        }
        return null;
      };
      return busca(this);
    },
  };
}

function sandbox({ engine = {}, schema = {} } = {}) {
  const seccion = nodo("section");
  const anuncios = [];
  const context = {
    window: {
      FinanceCanonicalScenarioEngine: engine,
      FinanceCanonicalScenarioSchema: schema,
    },
    document: {
      getElementById: (id) => (id === "deuda-comparar" ? seccion : null),
      createElement: (tag) => nodo(tag),
    },
    announceStatus: (mensaje) => anuncios.push(mensaje),
  };
  vm.createContext(context);
  vm.runInContext(extractConst("ESCENARIO_MOTOR_DEPENDENCIES"), context);
  for (const fn of ["missingScenarioDependencies", "scenarioDependencyMessage", "renderScenarioDependencyNotice"]) {
    vm.runInContext(extractFunction(fn), context);
  }
  // `prepend` no enlaza padres por sí solo en este doble; se hace explícito para poder probar
  // `remove()` cuando la dependencia vuelve.
  const prependOriginal = seccion.prepend.bind(seccion);
  seccion.prepend = (...items) => {
    items.forEach((item) => { item.parent = seccion; });
    prependOriginal(...items);
  };
  return { context, seccion, anuncios };
}

test("T-5 · con todo cargado no se dice nada y no se ensucia la pantalla", () => {
  const { context, seccion } = sandbox();
  assert.equal(context.renderScenarioDependencyNotice("deuda-comparar"), false);
  assert.equal(seccion.children.length, 0);
});

test("T-5 · si falta el motor, la pantalla lo dice en vez de quedarse callada", () => {
  const { context, seccion, anuncios } = sandbox({ engine: null });
  assert.equal(context.renderScenarioDependencyNotice("deuda-comparar"), true);
  assert.equal(seccion.children.length, 1);
  const aviso = seccion.children[0];
  assert.equal(aviso.className, "e19-insight is-danger");
  assert.equal(aviso.getAttribute("role"), "status", "el aviso debe llegar también a un lector de pantalla");
  const texto = aviso.querySelector("[data-dependency-notice-text]").textContent;
  assert.match(texto, /canonical-scenario-engine\.js/);
  assert.match(texto, /no son ceros ni resultados/);
  assert.equal(anuncios.length, 1, "se anuncia una vez en la región viva");
});

test("T-5 · nombra las dos piezas cuando faltan las dos", () => {
  const { context, seccion } = sandbox({ engine: null, schema: null });
  context.renderScenarioDependencyNotice("deuda-comparar");
  const texto = seccion.children[0].querySelector("[data-dependency-notice-text]").textContent;
  assert.match(texto, /canonical-scenario-engine\.js ni canonical-scenario-schema\.js/);
});

test("T-5 · repintar no apila avisos", () => {
  const { context, seccion } = sandbox({ engine: null });
  context.renderScenarioDependencyNotice("deuda-comparar");
  context.renderScenarioDependencyNotice("deuda-comparar");
  context.renderScenarioDependencyNotice("deuda-comparar");
  assert.equal(seccion.children.length, 1);
});

test("T-5 · cuando la dependencia vuelve, el aviso se retira", () => {
  const { context, seccion } = sandbox({ engine: null });
  context.renderScenarioDependencyNotice("deuda-comparar");
  assert.equal(seccion.children.length, 1);
  context.window.FinanceCanonicalScenarioEngine = {};
  assert.equal(context.renderScenarioDependencyNotice("deuda-comparar"), false);
  assert.equal(seccion.children.length, 0);
});

test("T-5 · las cinco pantallas del motor avisan", () => {
  for (const view of ["escenario-simular", "escenario-aplicar", "escenario-guardados", "deuda-comparar", "deuda-ruta"]) {
    assert.ok(
      app.includes(`renderScenarioDependencyNotice("${view}")`),
      `${view} debería comprobar sus dependencias al pintarse`,
    );
  }
});

test("T-5 · sin esquema no se acepta la decisión en vez de aceptarla sin validar", () => {
  // Antes: `if (schema) schema.validateDecision(...)`. Sin esquema no se comprobaba nada y la
  // decisión entraba igual, que es peor que no poder añadirla.
  assert.ok(!app.includes('if (schema) schema.validateDecision'), "la validación no puede saltarse sola");
  assert.match(app, /if \(!schema\) \{\s*escenarioMotorShowFormErrors\(\[/);
  assert.match(app, /No se puede comprobar esta decisión/);
});

test("T-5 · el comparador no enseña 0,00 € cuando no ha calculado nada", () => {
  // Un cero se lee como respuesta; junto al aviso rojo sería además contradictorio.
  assert.match(app, /const calculado = !missingScenarioDependencies\(\)\.length;/);
  assert.match(app, /const cifra = \(value\) => \(calculado \? money\(value \?\? 0, true\) : "—"\);/);
  // V3-3 movió la etiqueta del coste a la definición de cada estrategia (`def.costeLabel`) y metió
  // `cifra` dentro de `kpi`, que además tapa las cifras de «Consolidar» cuando no hay oferta. Lo
  // que esta prueba vigila no es el texto de la etiqueta, sino que ninguna de las dos cifras se
  // imprima con `money` directamente, saltándose el modo degradado.
  assert.match(app, /const kpi = \(value\) => \(sinCalcular \? "—" : cifra\(value\)\);/);
  assert.match(app, /<strong>\$\{kpi\(entry\.costeTotal\)\}<\/strong>/);
  assert.match(app, /<span>Caja mínima<\/span><strong>\$\{kpi\(entry\.cajaMinima\)\}<\/strong>/);
});

test("T-5 · viaja en el shell offline versionado", () => {
  assert.match(worker, /20260814-f1a1/);
  assert.match(html, /app\.js\?v=20260814f1a1/);
});
