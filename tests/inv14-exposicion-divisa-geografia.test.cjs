const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const Portfolio = require("../canonical-portfolio.js");

// INV14 (Oleada 4, Bloque 4): exposición por divisa y geografía, DECLARADA por posición — esta app
// no trae ningún dato de mercado sobre la composición real de un fondo/ETF (dependería de su
// cartera subyacente, que cambia sin avisar), así que se pregunta directamente. Sin declarar,
// "sin-declarar" es una categoría más, nunca se asume EUR/España por defecto.

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

test("canonical-portfolio.js: normalizePosition declara currency (mayúsculas) y region (lista cerrada), sin valores por defecto", () => {
  const withValues = Portfolio.normalizePosition({ label: "Fondo US", currentValue: 1000, currency: "usd", region: "estados-unidos" });
  assert.equal(withValues.currency, "USD");
  assert.equal(withValues.region, "estados-unidos");
  const withoutValues = Portfolio.normalizePosition({ label: "Fondo sin declarar", currentValue: 1000 });
  assert.equal(withoutValues.currency, "");
  assert.equal(withoutValues.region, "");
  const withInvalidRegion = Portfolio.normalizePosition({ label: "Fondo", currentValue: 1000, region: "marte" });
  assert.equal(withInvalidRegion.region, "");
});

test("currencyGeographyExposure · sin posiciones con valor, no calculable", () => {
  assert.equal(Portfolio.currencyGeographyExposure([]).calculable, false);
  assert.equal(Portfolio.currencyGeographyExposure([{ currentValue: 0 }]).calculable, false);
});

test("currencyGeographyExposure · agrupa por divisa y geografía declaradas, sin-declarar para lo que falta", () => {
  const result = Portfolio.currencyGeographyExposure([
    { currentValue: 6000, currency: "EUR", region: "espana" },
    { currentValue: 3000, currency: "USD", region: "estados-unidos" },
    { currentValue: 1000 },
  ]);
  assert.equal(result.calculable, true);
  assert.equal(result.totalValue, 10000);
  const eur = result.currencyRows.find((row) => row.key === "EUR");
  const usd = result.currencyRows.find((row) => row.key === "USD");
  const undeclaredCurrency = result.currencyRows.find((row) => row.key === "sin-declarar");
  assert.equal(eur.pct, 60);
  assert.equal(usd.pct, 30);
  assert.equal(undeclaredCurrency.pct, 10);
  const espana = result.regionRows.find((row) => row.key === "espana");
  assert.equal(espana.pct, 60);
});

test("currencyGeographyExposure · dominantCurrency/dominantRegion solo con 50%+ y nunca sobre sin-declarar", () => {
  const dominant = Portfolio.currencyGeographyExposure([
    { currentValue: 7000, currency: "EUR", region: "espana" },
    { currentValue: 3000 },
  ]);
  assert.equal(dominant.dominantCurrency.key, "EUR");
  assert.equal(dominant.dominantRegion.key, "espana");
  const noDominant = Portfolio.currencyGeographyExposure([
    { currentValue: 4000, currency: "EUR", region: "espana" },
    { currentValue: 6000 },
  ]);
  assert.equal(noDominant.dominantCurrency, null);
  assert.equal(noDominant.dominantRegion, null);
});

function extractConst(name) {
  const start = appSource.indexOf(`const ${name} =`);
  assert.ok(start >= 0, `No existe la constante ${name} en app.js`);
  const end = appSource.indexOf("};", start) + 2;
  return appSource.slice(start, end);
}

function sandbox({ rawPositions = [] } = {}) {
  const container = { innerHTML: "" };
  const context = {
    window: { FinanceCanonicalPortfolio: Portfolio },
    qs: (id) => (id === "inv14CurrencyGeographyExposure" ? container : null),
    iv1PositionsList: () => rawPositions,
    money: (value) => `${Math.round(value)}€`,
    escapeHtml: (value) => String(value ?? ""),
    container,
  };
  vm.createContext(context);
  vm.runInContext(extractConst("INV14_REGION_LABELS"), context);
  vm.runInContext(extractFunction("renderInv14CurrencyGeographyExposure"), context);
  return context;
}

test("renderInv14CurrencyGeographyExposure · sin posiciones, mensaje neutro", () => {
  const ctx = sandbox({ rawPositions: [] });
  ctx.renderInv14CurrencyGeographyExposure();
  assert.match(ctx.container.innerHTML, /Registra al menos una posición/);
});

test("renderInv14CurrencyGeographyExposure · con posiciones, muestra divisa y geografía declaradas", () => {
  const ctx = sandbox({ rawPositions: [
    { id: "p1", label: "Fondo A", currentValue: 5000, currency: "eur", region: "espana" },
    { id: "p2", label: "Fondo B", currentValue: 5000 },
  ] });
  ctx.renderInv14CurrencyGeographyExposure();
  assert.match(ctx.container.innerHTML, /EUR/);
  assert.match(ctx.container.innerHTML, /España/);
  assert.match(ctx.container.innerHTML, /Sin declarar/);
  assert.match(ctx.container.innerHTML, /declaradas por ti/);
});

test("index.html: campos de divisa y geografía al registrar una posición, y tarjeta INV14", () => {
  assert.match(indexSource, /id="iv1PositionCurrency"/);
  assert.match(indexSource, /id="iv1PositionRegion"/);
  assert.match(indexSource, /id="inv14CurrencyGeographyExposure"/);
});

test("app.js: saveIv1Position lee currency/region y guarda ambos en el registro", () => {
  const block = extractFunction("saveIv1Position");
  assert.match(block, /qs\("iv1PositionCurrency"\)\?\.value/);
  assert.match(block, /qs\("iv1PositionRegion"\)\?\.value/);
});

test("wiring: renderInv14CurrencyGeographyExposure se llama junto a renderInv16ConcentrationWarnings en cada mutación relevante", () => {
  const occurrences = appSource.split("renderInv16ConcentrationWarnings();\n  renderInv14CurrencyGeographyExposure();").length - 1;
  assert.ok(occurrences >= 7, `Se esperaban al menos 7 sitios, encontrados: ${occurrences}`);
});
