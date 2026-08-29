const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const app = read("app.js");

// PV4 · Bloque 4: bandas de confianza sobre la liquidez proyectada, en la misma tarjeta donde ya
// vive el termómetro de desviación de PV2 (renderE13ScenarioLab, "Aprendizaje E12b") — mismos
// `forecast.series`/`learning` ya calculados ahí, ningún dato nuevo que traer.

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

function sandbox() {
  const context = {
    escapeHtml: (v) => String(v ?? ""),
    money: (v) => `${Number(v || 0).toFixed(2)} €`,
    PV4_CONFIDENCE_LABEL: { high: "alta", medium: "media", low: "baja" },
  };
  vm.createContext(context);
  vm.runInContext(extractFunction("pv4ConfidenceBandHtml"), context);
  return context;
}

function band(overrides = {}) {
  return { monthKey: "2026-09", label: "sep 26", center: 1000, low: 900, high: 1100, margin: 100, confidence: "high", sampleConcepts: 3, ...overrides };
}

test("pv4ConfidenceBandHtml · sin bandas, avisa en vez de dejarlo en blanco", () => {
  const ctx = sandbox();
  assert.match(ctx.pv4ConfidenceBandHtml([]), /Sin previsión disponible/);
});

test("pv4ConfidenceBandHtml · sin historial suficiente (sampleConcepts 0), lo dice explícitamente — no un margen inventado", () => {
  const ctx = sandbox();
  const output = ctx.pv4ConfidenceBandHtml([band({ margin: 0, low: 1000, high: 1000, sampleConcepts: 0, confidence: "low" })]);
  assert.match(output, /banda es de ancho cero, no un margen inventado/);
});

test("pv4ConfidenceBandHtml · con datos, pinta una columna por mes con su etiqueta y confianza", () => {
  const ctx = sandbox();
  const output = ctx.pv4ConfidenceBandHtml([band(), band({ monthKey: "2026-10", label: "oct 26" })]);
  assert.equal((output.match(/pv4-band-col/g) || []).length, 2);
  assert.match(output, /sep 26/);
  assert.match(output, /oct 26/);
  assert.match(output, /alta/);
});

test("renderE13ScenarioLab calcula las bandas sobre 12 meses de forecast.series y las pinta junto al termómetro", () => {
  const source = extractFunction("renderE13ScenarioLab");
  assert.match(source, /confidenceBands = window\.FinanceCanonicalForecast\.confidenceBands\(forecast\.series\.slice\(0, 12\), learning\)/);
  assert.match(source, /pv4ConfidenceBandHtml\(confidenceBands\)/);
});

test("el motor canónico (con confidenceBands) está versionado en index.html", () => {
  const html = read("index.html");
  assert.match(html, /canonical-forecast\.js\?v=/);
});
