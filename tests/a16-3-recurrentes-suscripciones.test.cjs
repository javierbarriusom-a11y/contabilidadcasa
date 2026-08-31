const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const app = read("app.js") + "\n" + read("views/analisis.js");
const html = read("index.html");
const Forecast = require("../canonical-forecast.js");

// A16-3 · Bloque 4: recurrentes/suscripciones detectadas en Análisis. Distinto de A-9 ("Qué se
// repite", que compara el peso de un concepto entre trimestres): esto busca cargos de importe
// exactamente igual repetidos varios meses (candidatos a suscripción), con su coste mensual y
// anualizado. Mismo movementMappingKey()/movementDisplayName() que ya usan A-9/M-7/M-8 — se prueban
// aquí de verdad (extraídas de app.js), no con un doble.

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

function sandbox() {
  const context = {
    escapeHtml: (v) => String(v ?? ""),
    money: (v) => `${Number(v || 0).toFixed(2)} €`,
    window: { FinanceCanonicalForecast: Forecast },
    ANALISIS_SUBSCRIPTION_CONFIDENCE_LABEL: { high: "alta", medium: "media", low: "baja" },
  };
  vm.createContext(context);
  ["movementKindFromAmount", "normalizedText", "movementMappingKey", "movementDisplayName", "analisisSubscriptionsResult", "analisisRenewalAdvisory", "analisisSubscriptionsHtml"]
    .forEach((name) => vm.runInContext(extractFunction(name), context));
  return context;
}

function tx(movement, amount, month, category = "Suscripciones", details = "") {
  return { movement, details, amount, month, category, date: `${month}-05` };
}

test("analisisSubscriptionsResult · un cargo repetido 3+ meses con el mismo concepto bancario se detecta", () => {
  const ctx = sandbox();
  const transactions = [
    tx("NETFLIX.COM", -12.99, "2026-05"),
    tx("NETFLIX.COM", -12.99, "2026-06"),
    tx("NETFLIX.COM", -12.99, "2026-07"),
    tx("NOMINA", 2000, "2026-07"), // ingreso, no cuenta
  ];
  const result = ctx.analisisSubscriptionsResult(transactions);
  assert.equal(result.detected.length, 1);
  assert.equal(result.detected[0].monthlyCost, 12.99);
  assert.equal(result.detected[0].annualCost, 155.88);
});

test("analisisSubscriptionsResult · movement + details distintos no se confunden (misma clave que A-9/M-7/M-8)", () => {
  const ctx = sandbox();
  const transactions = [
    tx("RECIBO", -9.99, "2026-05", "Suscripciones", ""),
    tx("RECIBO", -9.99, "2026-06", "Suscripciones", ""),
    tx("RECIBO", -9.99, "2026-07", "Suscripciones", ""),
  ];
  transactions[0].details = "SPOTIFY";
  transactions[1].details = "SPOTIFY";
  transactions[2].details = "GIMNASIO"; // mismo "movement" pero detalle distinto: otro concepto
  const result = ctx.analisisSubscriptionsResult(transactions);
  assert.equal(result.detected.length, 0); // ninguno llega a 3 meses por separado
});

test("analisisSubscriptionsHtml · sin detecciones, explica el mínimo de meses en vez de dejarlo en blanco", () => {
  const ctx = sandbox();
  const result = ctx.analisisSubscriptionsResult([]);
  const output = ctx.analisisSubscriptionsHtml(result);
  assert.match(output, /Sin cargos/);
  assert.match(output, /3 meses/);
});

test("analisisSubscriptionsHtml · con detecciones, muestra coste mensual, anualizado, meses vistos y confianza", () => {
  const ctx = sandbox();
  const transactions = ["2026-05", "2026-06", "2026-07"].map((month) => tx("NETFLIX.COM", -12.99, month));
  const output = ctx.analisisSubscriptionsHtml(ctx.analisisSubscriptionsResult(transactions));
  assert.match(output, /NETFLIX\.COM/);
  assert.match(output, /12\.99 €\/mes/);
  assert.match(output, /155\.88 €\/año/);
  assert.match(output, /visto 3 meses/);
  assert.match(output, /Total detectado/);
});

test("renderAnalisis pinta la tarjeta nueva, reutilizando baseData.transactions", () => {
  const source = extractFunction("renderAnalisis");
  assert.match(source, /analisisSubscriptionsResult\(baseData\?\.transactions \|\| \[\]\)/);
  assert.match(source, /qs\("analisisSubscriptions"\)/);
});

test("la tarjeta vive en la vista Análisis, junto a «Qué se repite»", () => {
  const anchor = html.indexOf('id="analisisRecurringNote"');
  assert.ok(anchor >= 0, "No existe la tarjeta de A-9 como referencia");
  const nearby = html.slice(anchor, anchor + 1200);
  assert.match(nearby, /id="analisisSubscriptions"/);
  assert.match(nearby, /Recurrentes y suscripciones detectadas/);
});

test("canonical-forecast.js (motor de detección) está versionado en index.html", () => {
  assert.match(html, /canonical-forecast\.js\?v=/);
});
