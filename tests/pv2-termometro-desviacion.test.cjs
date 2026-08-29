const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const app = read("app.js");

// PV2 · Bloque 2: termómetro de desviación por partida. Visualiza lo que learnFromHistory() (E12b)
// ya calcula — antes solo se mostraba la primera partida en una línea de texto; ahora una barra por
// partida, coloreada por severidad (deviationSeverity, canonical-forecast.js).

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
    escapeHtml: (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])),
    money: (value) => `${Number(value).toFixed(2)} €`,
  };
  vm.createContext(context);
  vm.runInContext(extractFunction("deviationThermometerHtml"), context);
  return context;
}

test("deviationThermometerHtml · sin desviaciones, mensaje de historial insuficiente", () => {
  const context = sandbox();
  const html = context.deviationThermometerHtml([]);
  assert.match(html, /Sin partidas con historial conciliado suficiente/);
});

test("deviationThermometerHtml · una fila por cada partida del array, no solo la primera", () => {
  const context = sandbox();
  const html = context.deviationThermometerHtml([
    { label: "Nómina", averageDelta: 150, averagePlanned: 2000, severity: "low", sampleMonths: 2, confidence: "low" },
    { label: "Ocio", averageDelta: 50, averagePlanned: 100, severity: "high", sampleMonths: 2, confidence: "low" },
  ]);
  assert.match(html, /Nómina/);
  assert.match(html, /Ocio/);
  assert.equal((html.match(/pv2-thermometer-item/g) || []).length, 2);
});

test("deviationThermometerHtml · la severidad alta usa el pill danger y el ancho de la barra refleja el ratio", () => {
  const context = sandbox();
  const html = context.deviationThermometerHtml([
    { label: "Ocio", averageDelta: 50, averagePlanned: 100, severity: "high", sampleMonths: 2, confidence: "low" },
  ]);
  assert.match(html, /status-pill danger/);
  assert.match(html, /pv2-thermometer-fill high" style="width:50%"/);
});

test("deviationThermometerHtml · sin previsto medio, la barra queda a tope si hay desviación", () => {
  const context = sandbox();
  const html = context.deviationThermometerHtml([
    { label: "Extra", averageDelta: 30, averagePlanned: 0, severity: "high", sampleMonths: 1, confidence: "low" },
  ]);
  assert.match(html, /width:100%/);
});

test("la tarjeta de Análisis avanzado usa el termómetro por partida", () => {
  const start = app.indexOf('qs("e13AdvancedAnalysis").innerHTML');
  assert.ok(start >= 0, "No existe el render de e13AdvancedAnalysis en app.js");
  const end = app.indexOf(";\n", start);
  const body = app.slice(start, end);
  assert.match(body, /deviationThermometerHtml\(learning\.deviations\)/);
});
