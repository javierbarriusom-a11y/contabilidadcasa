const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const Portfolio = require("../canonical-portfolio.js");

// INV20 (Oleada 4, Bloque 4): permite anular la liquidez inferida por tipo (INV7, liquidityLadder)
// con un valor declarado por posición — alcance reducido: INV7 ya clasifica cada posición por tipo
// en tres franjas (inmediata/corta/sin clasificar). Falta solo la anulación declarada cuando el
// tipo no refleja la liquidez real de una posición concreta, nunca un campo obligatorio nuevo.

const appSource = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const indexSource = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

function extractFunction(name) {
  const start = appSource.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `No existe la función ${name} en app.js`);
  const parenStart = appSource.indexOf("(", start);
  let parenDepth = 0;
  let bodyStart = -1;
  for (let index = parenStart; index < appSource.length; index += 1) {
    if (appSource[index] === "(") parenDepth += 1;
    else if (appSource[index] === ")") {
      parenDepth -= 1;
      if (parenDepth === 0) { bodyStart = appSource.indexOf("{", index); break; }
    }
  }
  assert.ok(bodyStart >= 0, `No se encontró el cuerpo de ${name}`);
  let depth = 0;
  for (let index = bodyStart; index < appSource.length; index += 1) {
    if (appSource[index] === "{") depth += 1;
    else if (appSource[index] === "}") {
      depth -= 1;
      if (depth === 0) return appSource.slice(start, index + 1);
    }
  }
  throw new Error(`La función ${name} no cierra sus llaves`);
}

test("canonical-portfolio.js: normalizePosition declara liquidityTierOverride solo con un valor de tramo válido, null si no", () => {
  assert.equal(Portfolio.normalizePosition({ label: "p", currentValue: 1, liquidityTierOverride: "corta" }).liquidityTierOverride, "corta");
  assert.equal(Portfolio.normalizePosition({ label: "p", currentValue: 1, liquidityTierOverride: "inmediata" }).liquidityTierOverride, "inmediata");
  assert.equal(Portfolio.normalizePosition({ label: "p", currentValue: 1 }).liquidityTierOverride, null);
  assert.equal(Portfolio.normalizePosition({ label: "p", currentValue: 1, liquidityTierOverride: "valor-invalido" }).liquidityTierOverride, null);
});

test("liquidityLadder · sin anulación, usa el tramo inferido por tipo (comportamiento previo a INV20, intacto)", () => {
  const ladder = Portfolio.liquidityLadder([{ type: "fondo", currentValue: 5000 }], 0);
  const corta = ladder.tiers.find((tier) => tier.tier === "corta");
  assert.equal(corta.value, 5000);
  assert.equal(corta.overriddenValue, 0);
});

test("liquidityLadder · con anulación declarada, el tramo elegido por el hogar manda sobre el inferido por tipo", () => {
  // Un fondo (tipo → "corta" por defecto) declarado por el hogar como "sin-clasificar" porque no es
  // tan líquido como el resto de fondos indexados de la cartera.
  const ladder = Portfolio.liquidityLadder([{ type: "fondo", currentValue: 5000, liquidityTierOverride: "sin-clasificar" }], 0);
  const corta = ladder.tiers.find((tier) => tier.tier === "corta");
  const sinClasificar = ladder.tiers.find((tier) => tier.tier === "sin-clasificar");
  assert.equal(corta.value, 0);
  assert.equal(sinClasificar.value, 5000);
  assert.equal(sinClasificar.overriddenValue, 5000);
});

test("liquidityLadder · mezcla de posiciones con y sin anulación, cada una por su propio criterio", () => {
  const ladder = Portfolio.liquidityLadder([
    { type: "accion", currentValue: 2000 }, // inmediata por tipo, sin anular
    { type: "fondo", currentValue: 3000, liquidityTierOverride: "inmediata" }, // fondo anulado a inmediata
    { type: "otro", currentValue: 1000 }, // sin-clasificar por tipo, sin anular
  ], 0);
  const inmediata = ladder.tiers.find((tier) => tier.tier === "inmediata");
  assert.equal(inmediata.value, 5000);
  assert.equal(inmediata.overriddenValue, 3000);
  const sinClasificar = ladder.tiers.find((tier) => tier.tier === "sin-clasificar");
  assert.equal(sinClasificar.value, 1000);
  assert.equal(sinClasificar.overriddenValue, 0);
});

function sandbox({ rawPositions = [], floor = 0 } = {}) {
  const container = { innerHTML: "" };
  const cushionEngine = { cushionFloor: () => ({ value: floor }) };
  const context = {
    window: { FinanceCanonicalPortfolio: Portfolio, FinanceCanonicalCushion: cushionEngine },
    qs: (id) => (id === "inv7LiquidityLadder" ? container : null),
    iv1PositionsList: () => rawPositions,
    money: (value) => `${Math.round(value)}€`,
    escapeHtml: (value) => String(value ?? ""),
    lastSimulation: null,
    cuadroMandosReserve: () => 0,
    container,
  };
  vm.createContext(context);
  vm.runInContext(extractFunction("renderInv7LiquidityLadder"), context);
  return context;
}

test("renderInv7LiquidityLadder · una anulación declarada se anota junto al tramo, sin sustituir el total", () => {
  const ctx = sandbox({ rawPositions: [{ id: "p1", label: "Fondo nicho", type: "fondo", currentValue: 5000, liquidityTierOverride: "sin-clasificar" }] });
  ctx.renderInv7LiquidityLadder();
  assert.match(ctx.container.innerHTML, /por anulación declarada/);
});

test("renderInv7LiquidityLadder · sin ninguna anulación, no aparece la nota (comportamiento previo intacto)", () => {
  const ctx = sandbox({ rawPositions: [{ id: "p1", label: "Fondo", type: "fondo", currentValue: 5000 }] });
  ctx.renderInv7LiquidityLadder();
  assert.doesNotMatch(ctx.container.innerHTML, /por anulación declarada/);
});

test("index.html: selector de anulación de liquidez al registrar una posición", () => {
  assert.match(indexSource, /id="iv1PositionLiquidityOverride"/);
});

test("app.js: saveIv1Position lee liquidityOverride y lo guarda como liquidityTierOverride", () => {
  const block = extractFunction("saveIv1Position");
  assert.match(block, /qs\("iv1PositionLiquidityOverride"\)\?\.value/);
  assert.match(block, /liquidityTierOverride: liquidityOverride/);
});
