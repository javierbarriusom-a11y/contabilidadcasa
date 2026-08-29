const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const app = read("app.js");
const html = read("index.html");
const css = read("styles.css");

// OPT-4 · Bloque 1: cobertura unitaria de los hallazgos de axe-core corregidos que no dependen de
// un navegador real (esos ya los cubre tests/opt4-axe-accessibility.spec.cjs, fuera de `npm test`).

function extractFunction(name) {
  const start = app.indexOf(`function ${name}(`);
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

function fakeElement({ scrollWidth = 100, clientWidth = 100 } = {}) {
  const attrs = {};
  return {
    scrollWidth,
    clientWidth,
    setAttribute: (key, value) => { attrs[key] = value; },
    getAttribute: (key) => attrs[key],
    hasAttribute: (key) => key in attrs,
    _attrs: attrs,
  };
}

test("axe: scrollable-region-focusable · markScrollableTableWraps marca tabindex solo en lo que desborda", () => {
  const overflowing = fakeElement({ scrollWidth: 900, clientWidth: 600 });
  const fitting = fakeElement({ scrollWidth: 600, clientWidth: 600 });
  const context = {
    document: {
      querySelectorAll: (selector) => {
        assert.equal(selector, ".table-wrap:not([tabindex])");
        return [overflowing, fitting];
      },
    },
  };
  vm.createContext(context);
  vm.runInContext(extractFunction("markScrollableTableWraps"), context);
  context.markScrollableTableWraps();
  assert.equal(overflowing._attrs.tabindex, "0");
  assert.equal(fitting._attrs.tabindex, undefined);
});

test("axe: scrollable-region-focusable · watchScrollableTableWraps observa mutaciones futuras y el resize", () => {
  assert.match(app, /function watchScrollableTableWraps\(\) \{\s*markScrollableTableWraps\(\);/);
  assert.match(app, /new MutationObserver\(\(\) => markScrollableTableWraps\(\)\)/);
  assert.match(app, /observer\.observe\(document\.body, \{ childList: true, subtree: true \}\)/);
  assert.match(app, /watchScrollableTableWraps\(\);\s*\n\s*render\(\);/);
});

test("axe: region · #topbarStatusStrip lleva role=\"region\" con nombre accesible", () => {
  assert.match(html, /<div class="topbar-status-strip" id="topbarStatusStrip" role="region" aria-label="[^"]+" hidden>/);
});

test("axe: color-contrast · el chip de guardado ya no baja el contraste por debajo de 4,5:1 en su peor variante", () => {
  assert.match(css, /\.durability-status small \{\s*font-size: 10\.5px;\s*opacity: 0\.9;/);
});

test("axe: aria-allowed-attr · ninguna pestaña de Deuda usa aria-selected fuera de un role=\"tab\" real", () => {
  const deuda = read("views/deuda.js");
  assert.doesNotMatch(deuda, /e19-registrar-tab[^`]*aria-selected/);
});
