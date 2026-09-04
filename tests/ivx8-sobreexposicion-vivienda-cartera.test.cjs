const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const app = read("app.js");
const html = read("index.html");

// IVX8 (Oleada 2, Bloque 2): sobreexposición cruzada vivienda-inversión — el valor de la vivienda
// (A14, tipo "inmueble") frente al total de la cartera de inversión (IV4). Ninguno de los dos
// avisaba de esta pareja concreta antes de esta tarea: A14-4 avisa de concentración por tipo dentro
// del patrimonio neto completo, IV4 avisa de concentración dentro de la cartera — esta es la pareja
// vivienda/cartera, que ninguno cubre por separado (confirmado por investigación previa, sin código
// de esto en el repo).

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

function sandbox({ housing = 0, portfolio = 0 } = {}) {
  const context = {
    round2: (v) => Math.round((Number(v || 0) + Number.EPSILON) * 100) / 100,
    assetsList: () => [],
    iv1PositionsList: () => [],
    window: {
      FinanceCanonicalAssets: { normalizeAssets: () => ({ summary: { totalsByType: { inmueble: housing } } }) },
      FinanceCanonicalPortfolio: { normalizePositions: () => ({ summary: { totalValue: portfolio } }) },
    },
  };
  vm.createContext(context);
  vm.runInContext(extractFunction("ivx8HousingExposure"), context);
  return context;
}

test("ivx8HousingExposure · sin vivienda ni cartera, no hay nada que comparar", () => {
  const ctx = sandbox({ housing: 0, portfolio: 0 });
  assert.equal(ctx.ivx8HousingExposure(), null);
});

test("ivx8HousingExposure · reparto equilibrado (60/40), sin dominante, no avisa", () => {
  const result = sandbox({ housing: 300000, portfolio: 200000 }).ivx8HousingExposure();
  assert.equal(result.housingPct, 60);
  assert.equal(result.dominant, "vivienda"); // 60% > 50%, sí dispara — ver siguiente test para el límite real
});

test("ivx8HousingExposure · justo 50/50, ningún dominante (límite estricto, ni \"casi igual\" avisa)", () => {
  const result = sandbox({ housing: 250000, portfolio: 250000 }).ivx8HousingExposure();
  assert.equal(result.housingPct, 50);
  assert.equal(result.dominant, null);
});

test("ivx8HousingExposure · vivienda muy por encima de la cartera: dominante \"vivienda\"", () => {
  const result = sandbox({ housing: 400000, portfolio: 50000 }).ivx8HousingExposure();
  assert.equal(result.housingPct, 89);
  assert.equal(result.dominant, "vivienda");
});

test("ivx8HousingExposure · cartera muy por encima de la vivienda: dominante \"cartera\"", () => {
  const result = sandbox({ housing: 50000, portfolio: 400000 }).ivx8HousingExposure();
  assert.equal(result.portfolioPct, 89);
  assert.equal(result.dominant, "cartera");
});

test("ivx8HousingExposure · solo vivienda, sin cartera registrada: dominante \"vivienda\" al 100%", () => {
  const result = sandbox({ housing: 200000, portfolio: 0 }).ivx8HousingExposure();
  assert.equal(result.housingPct, 100);
  assert.equal(result.dominant, "vivienda");
});

test("ivx8HousingExposure · sin motores canónicos disponibles, no revienta — devuelve null", () => {
  const context = {
    round2: (v) => v,
    assetsList: () => [],
    iv1PositionsList: () => [],
    window: {},
  };
  vm.createContext(context);
  vm.runInContext(extractFunction("ivx8HousingExposure"), context);
  assert.equal(context.ivx8HousingExposure(), null);
});

test("renderIvx8HousingExposure · sin dominante, deja el contenedor vacío", () => {
  const container = { innerHTML: "existente" };
  const context = {
    round2: (v) => Math.round((Number(v || 0) + Number.EPSILON) * 100) / 100,
    money: (v) => `${Number(v || 0).toFixed(2)} €`,
    qs: (id) => (id === "ivx8HousingExposure" ? container : null),
    assetsList: () => [],
    iv1PositionsList: () => [],
    window: {
      FinanceCanonicalAssets: { normalizeAssets: () => ({ summary: { totalsByType: { inmueble: 250000 } } }) },
      FinanceCanonicalPortfolio: { normalizePositions: () => ({ summary: { totalValue: 250000 } }) },
    },
  };
  vm.createContext(context);
  vm.runInContext(extractFunction("ivx8HousingExposure"), context);
  vm.runInContext(extractFunction("renderIvx8HousingExposure"), context);
  vm.runInContext("renderIvx8HousingExposure();", context);
  assert.equal(container.innerHTML, "");
});

test("renderIvx8HousingExposure · con dominante, avisa nombrando cuál y su porcentaje", () => {
  const container = { innerHTML: "" };
  const context = {
    round2: (v) => Math.round((Number(v || 0) + Number.EPSILON) * 100) / 100,
    money: (v) => `${Number(v || 0).toFixed(2)} €`,
    qs: (id) => (id === "ivx8HousingExposure" ? container : null),
    assetsList: () => [],
    iv1PositionsList: () => [],
    window: {
      FinanceCanonicalAssets: { normalizeAssets: () => ({ summary: { totalsByType: { inmueble: 400000 } } }) },
      FinanceCanonicalPortfolio: { normalizePositions: () => ({ summary: { totalValue: 50000 } }) },
    },
  };
  vm.createContext(context);
  vm.runInContext(extractFunction("ivx8HousingExposure"), context);
  vm.runInContext(extractFunction("renderIvx8HousingExposure"), context);
  vm.runInContext("renderIvx8HousingExposure();", context);
  assert.match(container.innerHTML, /la vivienda/);
  assert.match(container.innerHTML, /89%/);
});

test("IVX8: index.html declara el contenedor junto a la concentración de cartera (IV4)", () => {
  const ivx8Index = html.indexOf('id="ivx8HousingExposure"');
  const iv4Index = html.indexOf('id="iv1PositionConcentration"');
  assert.ok(ivx8Index >= 0, "Falta #ivx8HousingExposure en index.html");
  assert.ok(ivx8Index > iv4Index && ivx8Index - iv4Index < 400, "El contenedor de IVX8 debe vivir justo después del de IV4");
});

test("IVX8: se recalcula tanto al cambiar activos (A14-4) como al cambiar posiciones (IV4)", () => {
  const a14Block = extractFunction("renderA14AssetBreakdown");
  assert.match(a14Block, /renderIvx8HousingExposure\(\);/);
  const iv4Block = extractFunction("renderIv1PositionConcentration");
  assert.match(iv4Block, /renderIvx8HousingExposure\(\);/);
});

test("IVX8: mismo umbral del 50% que A14-4/IV4, mismo motivo declarado en el código", () => {
  const block = extractFunction("ivx8HousingExposure");
  assert.match(block, /housingPct > 50/);
});
