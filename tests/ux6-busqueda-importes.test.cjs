const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const app = read("app.js");
const html = read("index.html");

// UX6 · Bloque 5: extiende el lanzador A12-3 para reconocer preguntas de importe, reutilizando la
// misma caja disponible y reserva protegida que ya calcula Hoy — sin motor nuevo.

function extractFunction(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `No existe la función ${name} en app.js`);
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

function extractConst(name) {
  const start = app.indexOf(`const ${name} =`);
  assert.ok(start >= 0, `No existe la constante ${name}`);
  const end = app.indexOf(";\n", start);
  return app.slice(start, end + 1);
}

function sandboxWith(names, extra = {}) {
  const context = {
    escapeHtml: (v) => String(v ?? ""),
    money: (v) => `${Number(v || 0).toFixed(2)} €`,
    round2: (v) => Math.round((Number(v || 0) + Number.EPSILON) * 100) / 100,
    ...extra,
  };
  vm.createContext(context);
  vm.runInContext(extractConst("UX6_AMOUNT_QUESTION_KEYWORDS"), context);
  vm.runInContext(extractFunction("normalizedText"), context);
  names.forEach((name) => vm.runInContext(extractFunction(name), context));
  return context;
}

test("e17ParseAmountQuery · un importe con € se reconoce sin necesitar palabra clave", () => {
  const ctx = sandboxWith(["e17ParseAmountQuery"]);
  assert.equal(ctx.e17ParseAmountQuery("300€"), 300);
  assert.equal(ctx.e17ParseAmountQuery("300 euros"), 300);
});

test("e17ParseAmountQuery · un importe con una palabra clave de pregunta se reconoce sin €", () => {
  const ctx = sandboxWith(["e17ParseAmountQuery"]);
  assert.equal(ctx.e17ParseAmountQuery("¿me puedo permitir 300?"), 300);
  assert.equal(ctx.e17ParseAmountQuery("cuánto me queda"), null); // sin número, no hay importe que responder
});

test("e17ParseAmountQuery · un número suelto sin € ni palabra clave no se interpreta como importe", () => {
  const ctx = sandboxWith(["e17ParseAmountQuery"]);
  assert.equal(ctx.e17ParseAmountQuery("12"), null); // podría ser un mes, una fecha...
  assert.equal(ctx.e17ParseAmountQuery("deuda"), null);
});

test("e17ParseAmountQuery · acepta coma decimal", () => {
  const ctx = sandboxWith(["e17ParseAmountQuery"]);
  assert.equal(ctx.e17ParseAmountQuery("125,50€"), 125.5);
});

test("e17AmountAnswerHtml · con margen suficiente, dice que sí y cuánto quedaría", () => {
  const ctx = sandboxWith(["e17AmountAnswerHtml"], {
    accountBalancesFromState: () => ({ caixa: 5000 }),
    agentCaixaFloor: () => 1000,
  });
  const html2 = ctx.e17AmountAnswerHtml(300);
  assert.match(html2, /Sí te lo puedes permitir/);
  assert.match(html2, /3700\.00/); // 5000 - 1000 - 300
});

test("e17AmountAnswerHtml · sin margen suficiente, dice que no y cuánto faltaría", () => {
  const ctx = sandboxWith(["e17AmountAnswerHtml"], {
    accountBalancesFromState: () => ({ caixa: 1200 }),
    agentCaixaFloor: () => 1000,
  });
  const html2 = ctx.e17AmountAnswerHtml(300);
  assert.match(html2, /No te lo puedes permitir/);
  assert.match(html2, /100\.00/); // faltarían 100 (disponible 200 - 300)
});

test("renderE17Launcher · con una pregunta de importe, antepone la respuesta a las tareas encontradas", () => {
  const results = { innerHTML: "" };
  const ctx = sandboxWith(["renderE17Launcher", "e17ParseAmountQuery", "e17AmountAnswerHtml"], {
    qs: (id) => (id === "e17LauncherResults" ? results : null),
    E17Experience: { findTasks: () => [] },
    accountBalancesFromState: () => ({ caixa: 5000 }),
    agentCaixaFloor: () => 1000,
  });
  ctx.renderE17Launcher("¿puedo gastar 300€?");
  assert.match(results.innerHTML, /Sí te lo puedes permitir/);
  assert.doesNotMatch(results.innerHTML, /No encuentro esa tarea/); // hay respuesta, no hace falta el vacío
});

test("renderE17Launcher · sin pregunta de importe, mantiene el comportamiento de siempre", () => {
  const results = { innerHTML: "" };
  const ctx = sandboxWith(["renderE17Launcher", "e17ParseAmountQuery", "e17AmountAnswerHtml"], {
    qs: (id) => (id === "e17LauncherResults" ? results : null),
    E17Experience: { findTasks: () => [] },
  });
  ctx.renderE17Launcher("algo que no existe");
  assert.match(results.innerHTML, /No encuentro esa tarea/);
});

test("el lanzador sigue definido y el motor de importes vive junto a él", () => {
  assert.match(app, /function renderE17Launcher/);
  assert.match(app, /function e17ParseAmountQuery/);
  assert.match(app, /function e17AmountAnswerHtml/);
});
