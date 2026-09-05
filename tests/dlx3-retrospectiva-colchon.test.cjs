const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const app = read("app.js");
const html = read("index.html");

// DLX3 (Oleada 2 Bloque 4): retrospectiva "¿me habría quedado sin colchón?". Usa el mismo
// historial real conciliado que ya expone PVX1 (reconciledMonthlyNetHistory) y el suelo VIGENTE
// del colchón (mismo cushionFloor que ya usan DLX1/AP6) para reconstruir, hacia atrás desde la
// liquidez de hoy, si algún mes ya cerrado habría dejado la liquidez por debajo de ese suelo.

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
    DLX3_STATUS_CLASS: { negativo: "negative", ajustado: "warning", holgado: "positive" },
  };
  vm.createContext(context);
  vm.runInContext(extractFunction("dlx3RetrospectiveHtml"), context);
  return context;
}

test("dlx3RetrospectiveHtml · sin meses conciliados, mensaje explícito en vez de tabla vacía", () => {
  const context = sandbox();
  const result = context.dlx3RetrospectiveHtml({ calculable: false });
  assert.match(result, /Sin meses conciliados todavía/);
});

test("dlx3RetrospectiveHtml · una fila por mes, con el flujo real y la liquidez reconstruida", () => {
  const context = sandbox();
  const result = context.dlx3RetrospectiveHtml({
    calculable: true,
    floor: 2000,
    months: [
      { monthKey: "2026-02", netFlow: 1500, estimatedBalance: 3000, status: "holgado" },
      { monthKey: "2026-01", netFlow: -100, estimatedBalance: 1500, status: "ajustado" },
    ],
    breachCount: 1,
    worstMonth: { monthKey: "2026-01", estimatedBalance: 1500 },
  });
  assert.match(result, /2026-02/);
  assert.match(result, /2026-01/);
  assert.match(result, /3000\.00 €/);
  assert.match(result, /1500\.00 €/);
  assert.match(result, /En 1 de 2 mes\(es\)/);
});

test("dlx3RetrospectiveHtml · sin ninguna brecha, lo dice explícitamente en vez de omitir el resumen", () => {
  const context = sandbox();
  const result = context.dlx3RetrospectiveHtml({
    calculable: true,
    floor: 2000,
    months: [{ monthKey: "2026-01", netFlow: 100, estimatedBalance: 3000, status: "holgado" }],
    breachCount: 0,
    worstMonth: { monthKey: "2026-01", estimatedBalance: 3000 },
  });
  assert.match(result, /En ningún mes conciliado/);
});

test("dlx3RetrospectiveHtml · declara explícitamente que no reconstruye traspasos puntuales entre cuentas", () => {
  const context = sandbox();
  const result = context.dlx3RetrospectiveHtml({
    calculable: true,
    floor: 2000,
    months: [{ monthKey: "2026-01", netFlow: 100, estimatedBalance: 3000, status: "holgado" }],
    breachCount: 0,
    worstMonth: { monthKey: "2026-01", estimatedBalance: 3000 },
  });
  assert.match(result, /no reconstruye traspasos puntuales entre cuentas/);
});

test("index.html: la tarjeta de retrospectiva existe", () => {
  assert.match(html, /id="dlx3Retrospective"/);
  assert.match(html, /Retrospectiva: ¿me habría quedado sin colchón\?/);
});

test("app.js: renderDlx3Retrospective reutiliza reconciledMonthlyNetHistory y cushionRetrospective, y está cableado en el render central", () => {
  const block = extractFunction("renderDlx3Retrospective");
  assert.match(block, /reconciledMonthlyNetHistory\(\)/);
  assert.match(block, /cushionEngine\.cushionRetrospective\(/);
  assert.match(block, /floor: cushionEngine\.cushionFloor\(lastSimulation, cuadroMandosReserve\(\)\)\.value/);
  assert.match(app, /renderPvx1Backtest\(\);\s*\n\s*renderDlx3Retrospective\(\);/);
});
