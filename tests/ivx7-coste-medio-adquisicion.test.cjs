const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

// IVX7 (Oleada 2 Bloque 2): coste medio de adquisición (DCA) visible. Depende de IV3 (aportaciones
// programadas, ya construidas). costBasis y quantity ya existían en cada posición normalizada
// (IV1/FC1); ivx7AverageCostLabel solo los divide y los pinta junto al precio actual por unidad.

function extractFunction(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `No existe la función ${name}`);
  const parenStart = app.indexOf("(", start);
  let parenDepth = 0;
  let bodyStart = -1;
  for (let index = parenStart; index < app.length; index += 1) {
    if (app[index] === "(") parenDepth += 1;
    else if (app[index] === ")") {
      parenDepth -= 1;
      if (parenDepth === 0) { bodyStart = app.indexOf("{", index); break; }
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

const vm = require("node:vm");

function sandbox() {
  const context = { money: (value) => `${Math.round(value * 100) / 100} €`, round2: (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100 };
  vm.createContext(context);
  vm.runInContext(extractFunction("ivx7AverageCostLabel"), context);
  return context;
}

test("ivx7AverageCostLabel · con unidades reales, muestra coste medio y precio actual por unidad", () => {
  const ctx = sandbox();
  const label = ctx.ivx7AverageCostLabel({ quantity: 10, costBasis: 1000, currentValue: 1500 });
  assert.match(label, /coste medio 100 €\/ud\./);
  assert.match(label, /precio actual 150 €\/ud\./);
});

test("ivx7AverageCostLabel · sin unidades (quantity 0), no divide por cero — no hay nada que mostrar", () => {
  const ctx = sandbox();
  assert.equal(ctx.ivx7AverageCostLabel({ quantity: 0, costBasis: 1000, currentValue: 1500 }), "");
});

test("ivx7AverageCostLabel · sin posición, no revienta — cadena vacía", () => {
  const ctx = sandbox();
  assert.equal(ctx.ivx7AverageCostLabel(null), "");
});

test("app.js: renderIv1PositionList añade la nota de coste medio a la línea de cada posición, sin sustituir el resto", () => {
  const block = app.slice(app.indexOf("function renderIv1PositionList("), app.indexOf("function renderIv1PositionList(") + 1400);
  assert.match(block, /ivx7AverageCostLabel\(position\)/);
  assert.match(block, /coste \$\{money\(position\.costBasis, true\)\}/, "no debe sustituir el coste total ya existente");
});
