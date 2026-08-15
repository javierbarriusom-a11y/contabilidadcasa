const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

// R-10 · Los hashes antiguos que Registrar ya cubre no se rompen: `#update-hub`, `#update-data`,
// `#datos-importar` y `#data-entry` redirigen a la pestaña equivalente de Registrar en vez de
// abrir la heredada. `#registrar-mes` queda deliberadamente fuera — la sesión de R-5 prometió en
// PROJECT_STATE.md que seguiría accesible desde «Herramientas avanzadas»; redirigirla ahora
// revertiría esa promesa sin consultarlo, así que se deja para una consulta explícita (con R-11).

function extractFunction(name) {
  let start = app.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `No existe la función ${name} en app.js`);
  if (start >= 6 && app.slice(start - 6, start) === "async ") start -= 6;
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

function extractConst(name) {
  const start = app.indexOf(`const ${name} = `);
  assert.ok(start >= 0, `No existe la constante ${name} en app.js`);
  const end = app.indexOf("\n};", start);
  assert.ok(end >= 0, `No se encontró el final de ${name}`);
  return app.slice(start, end + 3);
}

function sandboxHash(hash, extraViewSections = []) {
  const knownSections = new Set(["home", "registrar", "movements", ...extraViewSections]);
  const context = {
    window: { location: { hash } },
    document: {
      getElementById: (id) => (knownSections.has(id) ? { classList: { contains: () => true } } : null),
    },
  };
  vm.createContext(context);
  vm.runInContext(extractConst("REGISTRAR_LEGACY_HASH_TABS"), context);
  vm.runInContext(extractFunction("viewFromHash"), context);
  vm.runInContext(extractFunction("registrarTabFromHash"), context);
  return context;
}

const CASES = [
  ["#update-hub", "balances"],
  ["#update-data", "actuals"],
  ["#datos-importar", "import"],
  ["#data-entry", "batch"],
];

CASES.forEach(([hash, tab]) => {
  test(`R-10 · ${hash} redirige a Registrar, pestaña «${tab}»`, () => {
    const { viewFromHash, registrarTabFromHash } = sandboxHash(hash);
    assert.equal(viewFromHash(), "registrar");
    assert.equal(registrarTabFromHash(), tab);
  });
});

test("R-10 · #monthly-detail encadena update-data → Registrar (pestaña «actuals»), como ya alias-eaba antes a update-data", () => {
  const { viewFromHash, registrarTabFromHash } = sandboxHash("#monthly-detail", ["update-data"]);
  assert.equal(viewFromHash(), "registrar");
  assert.equal(registrarTabFromHash(), "actuals");
});

test("R-10 · #registrar-mes NO se redirige: sigue siendo su propio destino, tal y como se prometió en la sesión de R-5", () => {
  const { viewFromHash, registrarTabFromHash } = sandboxHash("#registrar-mes", ["registrar-mes"]);
  assert.equal(viewFromHash(), "registrar-mes");
  assert.equal(registrarTabFromHash(), null);
});

test("R-10 · #registrar (navegación normal, no heredada) no fuerza ninguna pestaña", () => {
  const { registrarTabFromHash } = sandboxHash("#registrar");
  assert.equal(registrarTabFromHash(), null);
});

test("R-10 · #home y #overview no se ven afectados por el mapa de redirecciones", () => {
  assert.equal(sandboxHash("#home").viewFromHash(), "home");
  assert.equal(sandboxHash("#overview").viewFromHash(), "home");
});

test("R-10 · setActiveView normaliza el id heredado explícito a «registrar» antes de nada más (cerrado del todo en R-11)", () => {
  const source = extractFunction("setActiveView");
  assert.match(source, /const explicitLegacyTab = REGISTRAR_LEGACY_HASH_TABS\[viewId\];\s*\n\s*if \(explicitLegacyTab\) viewId = "registrar";/);
});

test("R-10 · setActiveView selecciona la pestaña heredada tanto por hash como por id explícito", () => {
  const source = extractFunction("setActiveView");
  assert.match(
    source,
    /if \(viewId === "registrar"\) \{\s*const legacyTab = explicitLegacyTab \|\| registrarTabFromHash\(\);\s*if \(legacyTab && legacyTab !== registrarActiveTab\) setRegistrarTab\(legacyTab\);\s*\}/,
  );
});

test("R-10 · ninguna heredada perdió su código: las cinco pantallas siguen en index.html", () => {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  ["update-hub", "registrar-mes", "datos-importar", "update-data", "data-entry"].forEach((id) => {
    assert.match(html, new RegExp(`id="${id}"`), `#${id} debe seguir existiendo`);
  });
});
