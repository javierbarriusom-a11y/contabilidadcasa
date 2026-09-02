const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const p2ui = fs.readFileSync(path.join(root, "p2-ui.js"), "utf8");

// CP4 (BACKLOG_ULTIMATE_SEPTIEMBRE.md bloque 3, ampliación "copiloto proactivo" — sin documento de
// detalle propio, resumen en su Nota): "comparación automática de escenarios en la revisión
// mensual — extiende A10-5". Reutiliza el motor de tres escenarios del Laboratorio (E13,
// base/favorable/tensión), sin eventos manuales, sobre el forecast vigente.

function extractFunction(name, source) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `No existe la función ${name}`);
  let parenDepth = 0;
  let bodyStart = -1;
  for (let index = source.indexOf("(", start); index < source.length; index += 1) {
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
  throw new Error(`${name} no cierra sus llaves`);
}

function sandbox(names) {
  const fakeLab = {
    scenarios: [
      { id: "base", label: "Base", metrics: { minChecking: 500, negativeMonths: 0 } },
      { id: "favorable", label: "Favorable", metrics: { minChecking: 900, negativeMonths: 0 } },
      { id: "stress", label: "Tensión", metrics: { minChecking: -200, negativeMonths: 2 } },
    ],
  };
  const context = {
    root: { FinanceCanonicalE13: { buildLab: (forecast) => (forecast?.series?.length ? fakeLab : null) } },
    esc: (value) => String(value ?? ""),
    euro: (value) => `${Number(value).toFixed(2)} €`,
  };
  vm.createContext(context);
  vm.runInContext(names.map((name) => extractFunction(name, p2ui)).join("\n"), context);
  return context;
}

test("e15ScenarioComparison reutiliza buildLab (E13) sin eventos manuales, no un motor nuevo", () => {
  const context = sandbox(["e15ScenarioComparison"]);
  const forecast = { series: [{ monthKey: "2026-09" }], generatedAt: "2026-08-30" };
  const result = context.e15ScenarioComparison(forecast);
  assert.equal(result.length, 3);
  assert.deepEqual(result.map((item) => item.id), ["base", "favorable", "stress"]);
  assert.equal(result[2].minChecking, -200);
  assert.equal(result[2].negativeMonths, 2);
});

test("e15ScenarioComparison no rompe sin forecast suficiente", () => {
  const context = sandbox(["e15ScenarioComparison"]);
  assert.equal(context.e15ScenarioComparison(null), null);
  assert.equal(context.e15ScenarioComparison({ series: [] }), null);
});

test("e15ScenarioComparisonHtml pinta las tres lecturas con caja mínima y meses en negativo", () => {
  const context = sandbox(["e15ScenarioComparisonHtml"]);
  const html2 = context.e15ScenarioComparisonHtml([{ label: "Tensión", minChecking: -200, negativeMonths: 2 }]);
  assert.match(html2, /Tensión/);
  assert.match(html2, /2 mes\(es\) en negativo/);
});

test("registrar revisión guarda la fotografía de escenarios dentro del propio registro de A10-5", () => {
  const body = extractFunction("renderE15Planning", p2ui);
  assert.match(body, /const scenarioComparison = e15ScenarioComparison\(planning\.forecast\)/);
  assert.match(body, /scenarios: scenarioComparison/, "la revisión debe guardar la comparación, no solo mostrarla");
  assert.match(body, /notes: "Revisión E15"/, "el registro de A10-5 no cambia, solo se extiende");
});

test("la vista se pinta antes de registrar la revisión: la comparación es automática, no bajo pedido", () => {
  const body = extractFunction("renderE15Planning", p2ui);
  assert.match(body, /Comparación automática de escenarios \(CP4\)/);
});

test("p2-ui.js viaja versionado en el shell tras el cambio", () => {
  assert.match(html, /p2-ui\.js\?v=20260902cp1a1/);
});
