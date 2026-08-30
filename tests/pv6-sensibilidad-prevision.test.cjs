const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const app = read("app.js");
const html = read("index.html");
const Sensitivity = require("../canonical-forecast-sensitivity.js");

// PV6 · Bloque 5: sensibilidad del veredicto de la previsión, junto a la banda de liquidez de
// Previsión. Reutiliza los mismos componentes que previsionMetric() ya calcula para el mes del
// punto delicado — sin recalcular el forecast.

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

function sandboxWith(names, extra = {}) {
  const context = {
    escapeHtml: (v) => String(v ?? ""),
    money: (v) => `${Number(v || 0).toFixed(2)} €`,
    window: { FinanceCanonicalForecastSensitivity: Sensitivity },
    ...extra,
  };
  vm.createContext(context);
  names.forEach((name) => vm.runInContext(extractFunction(name), context));
  return context;
}

function worstWith(row, adjustedMin) {
  return { item: { row }, metric: { adjustedMin } };
}

test("previsionSensitivityNote · en positivo, describe el margen antes de cruzar cero en ambos sentidos", () => {
  const note = { textContent: "" };
  const ctx = sandboxWith(["previsionSensitivityNote"], { qs: () => note });
  const row = { month: "sep 26", coreSpend: 1200, car: 0, refi: 0, projectOutflow: 0, endOfMonthOutflows: 0, prePayrollIncome: 500 };
  ctx.previsionSensitivityNote(worstWith(row, 300)); // base=1000, income=500, expense=1200
  assert.match(note.textContent, /sep 26/);
  assert.match(note.textContent, /aguanta caer hasta un 60%/);
  assert.match(note.textContent, /aguanta subir hasta un 25%/);
});

test("previsionSensitivityNote · en negativo, describe qué haría falta para recuperarse", () => {
  const note = { textContent: "" };
  const ctx = sandboxWith(["previsionSensitivityNote"], { qs: () => note });
  const row = { month: "oct 26", coreSpend: 2000, car: 0, refi: 0, projectOutflow: 0, endOfMonthOutflows: 0, prePayrollIncome: 500 };
  ctx.previsionSensitivityNote(worstWith(row, -500)); // base=1000, income=500, expense=2000
  assert.match(note.textContent, /necesitaría subir un 100%/);
  assert.match(note.textContent, /necesitaría bajar un 25%/);
});

test("previsionSensitivityNote · sin mes peor conocido, no rompe y deja la nota vacía", () => {
  const note = { textContent: "algo previo" };
  const ctx = sandboxWith(["previsionSensitivityNote"], { qs: () => note });
  ctx.previsionSensitivityNote(null);
  assert.equal(note.textContent, "");
});

test("renderPrevision llama a previsionSensitivityNote con el peor mes", () => {
  const body = extractFunction("renderPrevision");
  assert.match(body, /previsionSensitivityNote\(previsionWorstOf\(metrics\)\)/);
});

test("la nota vive junto a la banda de liquidez de Previsión", () => {
  const openTag = /<section[^>]*id="prevision"[^>]*>/.exec(html);
  assert.ok(openTag, "No existe la sección #prevision");
  const start = openTag.index + openTag[0].length;
  const end = html.indexOf("<section", start);
  const prevision = html.slice(start, end);
  assert.match(prevision, /id="previsionSensitivityNote"/);
});

test("el motor canónico está registrado en index.html y en la whitelist del sitio público", () => {
  assert.match(html, /canonical-forecast-sensitivity\.js\?v=/);
  const buildScript = read("tools/build-public-site.mjs");
  assert.match(buildScript, /"canonical-forecast-sensitivity\.js"/);
});
