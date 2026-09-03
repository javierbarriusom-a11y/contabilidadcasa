const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const ui = read("p2-ui.js");
const app = read("app.js");
const html = read("index.html");

// TT2 (BACKLOG_ULTIMATE_SEPTIEMBRE.md bloque 11 — "escalera de vencimientos para el exceso sobre el
// colchón"): depende de CP2 (el exceso ya identificado como dinero parado) y de TT1
// (cushionAccountSplit, sin pantalla propia hasta esta tarea). Junta ambas piezas en una sola foto:
// el reparto del colchón en sí (TT1) y la escalera de vencimientos del exceso (CP2 + motor nuevo en
// canonical-cushion.js). No pasa por CP3 (no es una recomendación del copiloto, es un reparto
// estructural, como el propio TT1).

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `No existe la función ${name}`);
  const parenStart = source.indexOf("(", start);
  let parenDepth = 0;
  let bodyStart = -1;
  for (let index = parenStart; index < source.length; index += 1) {
    if (source[index] === "(") parenDepth += 1;
    else if (source[index] === ")") {
      parenDepth -= 1;
      if (parenDepth === 0) { bodyStart = source.indexOf("{", index); break; }
    }
  }
  assert.ok(bodyStart >= 0, `No se encontró el cuerpo de ${name}`);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    else if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`La función ${name} no cierra sus llaves`);
}

function sandbox(maturityLadder) {
  const context = {
    root: { FinanceP2Bridge: { maturityLadder: () => maturityLadder } },
    esc: (value) => String(value ?? ""),
    euro: (value) => `${Number(value || 0).toFixed(2)} €`,
  };
  vm.createContext(context);
  vm.runInContext("const bridge = () => root.FinanceP2Bridge;", context);
  vm.runInContext(extractFunction(ui, "tt2MaturityLadderHtml"), context);
  return context;
}

test("tt2MaturityLadderHtml · sin colchón ni exceso, lo dice explícitamente, no deja la tarjeta en blanco", () => {
  const ctx = sandbox({
    idleAmount: 0,
    floor: 0,
    accountSplit: { total: 0, corriente: 0, remunerado: 0, instantAccessDays: 7 },
    ladder: { total: 0, rungCount: 4, intervalMonths: 3, rungs: [] },
  });
  const output = ctx.tt2MaturityLadderHtml();
  assert.match(output, /Sin colchón que repartir/);
  assert.match(output, /Sin exceso sobre el colchón que escalonar/);
});

test("tt2MaturityLadderHtml · con colchón, muestra el reparto de TT1 (corriente/remunerada)", () => {
  const ctx = sandbox({
    idleAmount: 0,
    floor: 3000,
    accountSplit: { total: 3000, corriente: 500, remunerado: 2500, instantAccessDays: 7 },
    ladder: { total: 0, rungCount: 4, intervalMonths: 3, rungs: [] },
  });
  const output = ctx.tt2MaturityLadderHtml();
  assert.match(output, /500\.00 €/);
  assert.match(output, /2500\.00 €/);
  assert.match(output, /acceso inmediato, 7 días/);
});

test("tt2MaturityLadderHtml · con exceso, pinta cada tramo de la escalera con su plazo", () => {
  const ctx = sandbox({
    idleAmount: 1000,
    floor: 3000,
    accountSplit: { total: 3000, corriente: 500, remunerado: 2500, instantAccessDays: 7 },
    ladder: {
      total: 1000,
      rungCount: 4,
      intervalMonths: 3,
      rungs: [
        { index: 1, months: 3, amount: 250 },
        { index: 2, months: 6, amount: 250 },
        { index: 3, months: 9, amount: 250 },
        { index: 4, months: 12, amount: 250 },
      ],
    },
  });
  const output = ctx.tt2MaturityLadderHtml();
  assert.match(output, /Tramo 1: 250\.00 € a 3 meses/);
  assert.match(output, /Tramo 4: 250\.00 € a 12 meses/);
});

test("tt2MaturityLadderHtml · sin datos del puente, no revienta: sección vacía", () => {
  const context = {
    root: { FinanceP2Bridge: { maturityLadder: () => null } },
    esc: (value) => String(value ?? ""),
    euro: (value) => `${Number(value || 0).toFixed(2)} €`,
  };
  vm.createContext(context);
  vm.runInContext("const bridge = () => root.FinanceP2Bridge;", context);
  vm.runInContext(extractFunction(ui, "tt2MaturityLadderHtml"), context);
  assert.equal(context.tt2MaturityLadderHtml(), "");
});

test("app.js: tt2MaturityLadderSummary reutiliza CP2 (idle) y TT1 (accountSplit), sin motor de rentabilidad nuevo", () => {
  const block = app.slice(app.indexOf("function tt2MaturityLadderSummary("), app.indexOf("function tt2MaturityLadderSummary(") + 700);
  assert.match(block, /cp2IdleCashSummary\(\)/);
  assert.match(block, /FinanceCanonicalCushion\.cushionAccountSplit\(/);
  assert.match(block, /FinanceCanonicalCushion\.cushionMaturityLadder\(/);
});

test("app.js: el puente expone maturityLadder para que p2-ui.js lo consuma", () => {
  assert.match(app, /maturityLadder: tt2MaturityLadderSummary,/);
});

test("p2-ui.js: renderE16Monitoring pinta la escalera de vencimientos (TT2) junto a CP2", () => {
  assert.match(ui, /Escalera de vencimientos \(TT2\)/);
  assert.match(ui, /tt2MaturityLadderHtml\(\)/);
});

test("p2-ui.js está versionado en index.html", () => {
  assert.match(html, /p2-ui\.js\?v=/);
});
