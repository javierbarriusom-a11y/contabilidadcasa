/**
 * tests/uxb1-vista-movil-presupuesto.test.cjs
 *
 * UX-B1 (FASE 7): vista móvil de la tabla principal de Presupuesto del mes. El resto del shell ya
 * migró a un diseño mobile-first (U-3); esta tabla se quedó con `min-width: 720px` (7 columnas),
 * forzando desplazamiento horizontal en un móvil de 390px. Sin reescribir su HTML como una lista de
 * tarjetas — que duplicaría la lógica de `presupuestoMesRowHtml` — la fila se convierte en tarjeta
 * con CSS puro (`@media (max-width: 640px)`), apoyada en `data-label` en cada celda. Solo la tabla
 * principal (`.presupuesto-mes-primary-table`) cambia: las otras tablas de la pantalla, que
 * comparten la misma clase `.plan-mes-budget-table`, no llevan la clase nueva y no se ven afectadas.
 *
 * - Parte A: presupuestoMesRowHtml/presupuestoMesAddGoalRowHtml llevan los data-label correctos.
 * - Parte B: wiring estático — la tabla principal lleva la clase nueva y las demás no.
 * - Parte C: la regla CSS existe, apunta a la clase nueva y no a `.plan-mes-budget-table` a secas.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const appSrc = read("app.js");
const viewSrc = read("views/presupuesto-mes.js");
const cssSrc = read("design-tokens.css");
const app = appSrc + "\n" + viewSrc;

function extractFunction(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `No existe la función ${name} en app.js/views/presupuesto-mes.js`);
  let parenDepth = 0;
  let bodyStart = -1;
  for (let index = app.indexOf("(", start); index < app.length; index += 1) {
    if (app[index] === "(") parenDepth += 1;
    else if (app[index] === ")") {
      parenDepth -= 1;
      if (parenDepth === 0) {
        bodyStart = app.indexOf("{", index);
        break;
      }
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
// Parte A: data-label en las filas de la tabla principal
// ============================================================================

function rowSandbox() {
  const context = {
    budgetAlertForRow: () => ({ status: "on-track", metrics: { spent: 50, dayOfMonth: 10, daysInMonth: 30 } }),
    budgetProjection: () => ({ projected: 100, diff: 10 }),
    budgetRowDisplayLabel: (id) => id,
    presupuestoMesStatusPill: () => "<span>on-track</span>",
    money: (v) => `€${v}`,
    escapeHtml: (value) =>
      String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"),
  };
  vm.createContext(context);
  vm.runInContext(extractFunction("presupuestoMesRowHtml"), context, { filename: "views/presupuesto-mes.js#uxb1-row" });
  return context;
}

test("UX-B1 · cada celda de la fila principal lleva el data-label de su columna", () => {
  const context = rowSandbox();
  const html = context.presupuestoMesRowHtml({ categoryId: "comida", amountCap: 110, source: "manual" }, "2026-08");
  assert.match(html, /<td class="t" data-label="Categoría">/);
  assert.match(html, /<td data-label="Presupuesto">/);
  assert.match(html, /<td data-label="Gastado">/);
  assert.match(html, /<td data-label="Ritmo">/);
  assert.match(html, /<td data-label="Estado">/);
  assert.match(html, /<td class="negative" data-label="Proyección fin de mes">/);
  // La última celda (botón «Quitar») no lleva label: el botón ya se explica solo.
  assert.match(html, /<td><button type="button" class="registrar-actuals-plan-link"/);
});

test("UX-B1 · la fila de añadir objetivo también lleva data-label en sus dos celdas de datos", () => {
  const start = app.indexOf("function presupuestoMesAddGoalRowHtml");
  assert.ok(start >= 0);
  const body = app.slice(start, app.indexOf("\n}", start));
  assert.match(body, /<td class="t" data-label="Objetivo">/);
  assert.match(body, /<td data-label="Importe">/);
});

// ============================================================================
// Parte B: wiring estático — solo la tabla principal lleva la clase nueva
// ============================================================================

test("UX-B1 · la tabla principal de Presupuesto del mes lleva la clase presupuesto-mes-primary-table", () => {
  assert.match(
    viewSrc,
    /<table class="e19-table registrar-mes-table plan-mes-budget-table presupuesto-mes-primary-table">\s*<thead><tr><th>Categoría<\/th><th>Presupuesto<\/th><th>Gastado<\/th><th>Ritmo<\/th><th>Estado<\/th><th>Proyección fin de mes<\/th><th><\/th><\/tr><\/thead>/,
  );
});

test("UX-B1 · ninguna otra tabla de la pantalla lleva la clase presupuesto-mes-primary-table", () => {
  const matches = viewSrc.match(/class="[^"]*presupuesto-mes-primary-table[^"]*"/g) || [];
  assert.equal(matches.length, 1, "solo la tabla principal debe llevar la clase, para no arrastrar a las demás a la vista de tarjeta");
});

// ============================================================================
// Parte C: la regla CSS existe y está bien acotada
// ============================================================================

test("UX-B1 · design-tokens.css define el layout de tarjeta para la tabla principal en móvil", () => {
  assert.match(cssSrc, /@media \(max-width: 640px\) \{[\s\S]*?\.e19-plan-mes \.presupuesto-mes-primary-table \{[\s\S]*?min-width: 0;/);
  assert.match(cssSrc, /\.e19-plan-mes \.presupuesto-mes-primary-table thead \{\s*display: none;\s*\}/);
  assert.match(cssSrc, /\.e19-plan-mes \.presupuesto-mes-primary-table td\[data-label\]::before \{/);
});

test("UX-B1 · la regla CSS no afecta a `.plan-mes-budget-table` en general, solo a la clase nueva", () => {
  const mediaStart = cssSrc.indexOf("@media (max-width: 640px) {\n  .e19-plan-mes .presupuesto-mes-primary-table");
  assert.ok(mediaStart >= 0);
  const mediaEnd = cssSrc.indexOf("\n}\n", mediaStart);
  const block = cssSrc.slice(mediaStart, mediaEnd);
  assert.doesNotMatch(block, /plan-mes-budget-table/, "la regla debe ir siempre atada a .presupuesto-mes-primary-table, no a la clase compartida");
});

test("UX-B1 · index.html referencia la versión bumpeada de design-tokens.css", () => {
  const html = read("index.html");
  assert.match(html, /design-tokens\.css\?v=20260828k1/);
});
