/**
 * tests/flu3-vista-movil-plan-ahorro.test.cjs
 *
 * FLU-3 (sesión 245): de las tres pestañas de Plan, «Ahorro y objetivos» era la única sin el mismo
 * tratamiento móvil que UX-B1 ya dio a Presupuesto del mes. «Mes» ya lo compartía (mismo código de
 * fila que Presupuesto); «Previsión» es una matriz ancha bloque × mes que no encaja en tarjetas — el
 * desplazamiento horizontal que ya tiene es el patrón correcto para ese tipo de dato. Misma técnica
 * que UX-B1: la fila se convierte en tarjeta con CSS puro (`@media (max-width: 640px)`), apoyada en
 * `data-label` en cada celda, sin reescribir savingsGoalRowHtml como una lista de tarjetas.
 *
 * - Parte A: savingsGoalRowHtml lleva los data-label correctos.
 * - Parte B: la regla CSS existe, apunta a la tabla correcta y no a otra.
 *
 * Sin bump de `?v=` en index.html a propósito (a diferencia de UX-B1): el invalidador real de
 * caché es `CACHE_NAME` en service-worker.js, reescrito en cada build (`tools/build-public-site.mjs`)
 * con `ignoreSearch: true` en el propio Service Worker — el `?v=` por fichero es solo caché HTTP
 * plana, best-effort, para quien nunca llegó a instalar el Service Worker.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const app = read("app.js");
const cssSrc = read("design-tokens.css");

function extractFunction(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `No existe la función ${name} en app.js`);
  let parenDepth = 0;
  let bodyStart = -1;
  for (let index = app.indexOf("(", start); index < app.length; index += 1) {
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

// ============================================================================
// Parte A: data-label en las celdas de la fila de un objetivo
// ============================================================================

function rowSandbox() {
  const context = {
    round2: (v) => Math.round(Number(v || 0) * 100) / 100,
    money: (v) => `€${v}`,
    escapeHtml: (value) =>
      String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"),
  };
  vm.createContext(context);
  vm.runInContext(extractFunction("savingsGoalRowHtml"), context);
  return context;
}

test("FLU-3 · cada celda de datos de la fila de un objetivo lleva su data-label", () => {
  const context = rowSandbox();
  const html = context.savingsGoalRowHtml({ id: "g1", label: "Coche", targetAmount: 5000 }, 0, 2, 1200);
  assert.match(html, /<td class="savings-goal-order" data-label="Prioridad">/);
  assert.match(html, /<td data-label="Destino"><input type="text"/);
  assert.match(html, /<td data-label="Importe objetivo"><input type="number"/);
  assert.match(html, /<td class="savings-goal-progress" data-label="Acumulado">/);
  // La última celda (botón «Eliminar») no lleva label: el botón ya se explica solo, mismo criterio
  // que UX-B1.
  assert.match(html, /<td><button type="button" class="e19-btn e19-btn-secondary savings-goal-btn is-danger"/);
});

// ============================================================================
// Parte B: la regla CSS existe y está bien acotada
// ============================================================================

test("FLU-3 · design-tokens.css define el layout de tarjeta para la tabla de objetivos de ahorro en móvil", () => {
  assert.match(cssSrc, /@media \(max-width: 640px\) \{[\s\S]*?\.e19-plan \.plan-savings-goals-table \{\s*min-width: 0;/);
  assert.match(cssSrc, /\.e19-plan \.plan-savings-goals-table thead \{\s*display: none;/);
  assert.match(cssSrc, /\.e19-plan \.plan-savings-goals-table td\[data-label\]::before \{/);
  assert.match(cssSrc, /\.e19-plan \.plan-savings-goals-table td input \{\s*max-width: 130px;/);
});

test("FLU-3 · la regla CSS no afecta a otras tablas de Plan (Mes o Previsión)", () => {
  const mediaStart = cssSrc.indexOf("@media (max-width: 640px) {\n  /* min-width: 0 anula");
  assert.ok(mediaStart >= 0);
  const mediaEnd = cssSrc.indexOf("\n}\n", mediaStart);
  const block = cssSrc.slice(mediaStart, mediaEnd);
  assert.doesNotMatch(block, /presupuesto-mes-primary-table|plan-prevision-table/);
});
