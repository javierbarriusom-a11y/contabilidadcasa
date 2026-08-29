const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const app = read("app.js");
const html = read("index.html");
const deuda = read("views/deuda.js");

// A16-5 · Bloque 2: avalancha (ataca primero el TAE más alto, matemáticamente óptima) y bola de
// nieve (ataca primero el saldo más pequeño, motivadora) ya se comparaban por separado, pestaña a
// pestaña — pero nada decía nunca, en euros, cuánto cuesta elegir la motivadora en vez de la
// óptima. debtStrategyMotivationalGap resta sus dos costeTotal ya calculados por
// debtStrategySummary, sin recalcular nada.

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

function sandboxWith(names, extra = {}) {
  const context = { round2: (v) => Math.round((Number(v) + Number.EPSILON) * 100) / 100, ...extra };
  vm.createContext(context);
  vm.runInContext(names.map((name) => extractFunction(name)).join("\n"), context);
  return context;
}

function gapSandbox(summaries) {
  return sandboxWith(["debtStrategyMotivationalGap"], {
    debtStrategySummary: (strategyId) => summaries[strategyId],
  });
}

test("bloquea cuando avalancha ya cuesta menos: la brecha es el extra de elegir bola de nieve", () => {
  const context = gapSandbox({
    avalancha: { total: 3, viable: true, costeTotal: 1000 },
    "bola-nieve": { total: 3, viable: true, costeTotal: 1250 },
  });
  const gap = context.debtStrategyMotivationalGap({}, 0);
  assert.equal(gap.optimalCost, 1000);
  assert.equal(gap.motivationalCost, 1250);
  assert.equal(gap.extraCost, 250);
});

test("con avalancha y bola de nieve en el mismo coste, la brecha es cero", () => {
  const context = gapSandbox({
    avalancha: { total: 2, viable: true, costeTotal: 800 },
    "bola-nieve": { total: 2, viable: true, costeTotal: 800 },
  });
  const gap = context.debtStrategyMotivationalGap({}, 0);
  assert.equal(gap.extraCost, 0);
});

test("no inventa una relación: si bola de nieve saliera más barata, lo dice tal cual (extraCost negativo)", () => {
  const context = gapSandbox({
    avalancha: { total: 2, viable: true, costeTotal: 900 },
    "bola-nieve": { total: 2, viable: true, costeTotal: 700 },
  });
  const gap = context.debtStrategyMotivationalGap({}, 0);
  assert.equal(gap.extraCost, -200);
});

test("sin decisiones en ninguna de las dos estrategias, no hay nada que comparar", () => {
  const context = gapSandbox({
    avalancha: { total: 0, viable: false, costeTotal: 0 },
    "bola-nieve": { total: 0, viable: false, costeTotal: 0 },
  });
  assert.equal(context.debtStrategyMotivationalGap({}, 0), null);
});

test("si avalancha no es viable en este horizonte, no hay comparación real que mostrar", () => {
  const context = gapSandbox({
    avalancha: { total: 3, viable: false, costeTotal: 500 },
    "bola-nieve": { total: 3, viable: true, costeTotal: 900 },
  });
  assert.equal(context.debtStrategyMotivationalGap({}, 0), null);
});

test("si bola de nieve no es viable en este horizonte, tampoco hay comparación real que mostrar", () => {
  const context = gapSandbox({
    avalancha: { total: 3, viable: true, costeTotal: 900 },
    "bola-nieve": { total: 3, viable: false, costeTotal: 500 },
  });
  assert.equal(context.debtStrategyMotivationalGap({}, 0), null);
});

function textSandbox() {
  return sandboxWith(["deudaRutaMotivationalGapText"], { money: (v) => `${Number(v).toFixed(2)} €` });
}

test("deudaRutaMotivationalGapText · sin brecha (null) no dice nada", () => {
  const context = textSandbox();
  assert.equal(context.deudaRutaMotivationalGapText(null), "");
});

test("deudaRutaMotivationalGapText · el caso esperado: bola de nieve cuesta más, lo dice explícitamente en euros", () => {
  const context = textSandbox();
  const text = context.deudaRutaMotivationalGapText({ optimalCost: 1000, motivationalCost: 1250, extraCost: 250 });
  assert.match(text, /Bola de nieve.*250\.00 €.*más/);
  assert.match(text, /Avalancha 1000\.00 €/);
  assert.match(text, /Bola de nieve 1250\.00 €/);
});

test("deudaRutaMotivationalGapText · empate: dice que cuestan lo mismo, no fabrica un extra falso", () => {
  const context = textSandbox();
  const text = context.deudaRutaMotivationalGapText({ optimalCost: 800, motivationalCost: 800, extraCost: 0 });
  assert.match(text, /cuestan lo mismo/);
});

test("deudaRutaMotivationalGapText · si bola de nieve saliera más barata, lo dice así, no al revés", () => {
  const context = textSandbox();
  const text = context.deudaRutaMotivationalGapText({ optimalCost: 900, motivationalCost: 700, extraCost: -200 });
  assert.match(text, /más barata que Avalancha/);
  assert.doesNotMatch(text, /costaría/);
});

test("el aviso vive en Deuda · Ruta, siempre visible (no solo con bola de nieve seleccionada)", () => {
  assert.match(html, /id="deudaRutaMotivationalGapNote"/);
  assert.match(deuda, /deudaRutaMotivationalGapText\(debtStrategyMotivationalGap\(baseInput, debtStrategyReserveValue\)\)/);
});
