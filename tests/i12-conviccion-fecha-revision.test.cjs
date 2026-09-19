const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const Portfolio = require("../canonical-portfolio.js");

// I12 (Contabilidadcasa 2.0): aviso de posición sin revisar en más de 12 meses, sobre la convicción
// ya declarada por posición (LEV6, convictionScore). Ningún motor nuevo: reutiliza tal cual
// rebalanceCalendarReviewStatus() (INV17) con un intervalo fijo de 12 meses.

const appSource = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");

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

test("canonical-portfolio.js: normalizePosition declara convictionReviewedAt, vacío sin declarar", () => {
  const withoutDate = Portfolio.normalizePosition({ label: "Fondo A", currentValue: 1000, convictionScore: 4 });
  assert.equal(withoutDate.convictionReviewedAt, "");
  const withDate = Portfolio.normalizePosition({ label: "Fondo B", currentValue: 1000, convictionScore: 3, convictionReviewedAt: "2026-01-15" });
  assert.equal(withDate.convictionReviewedAt, "2026-01-15");
});

function sandboxReviewHtml() {
  const context = {
    window: { FinanceCanonicalPortfolio: Portfolio },
    escapeHtml: (value) => String(value ?? ""),
  };
  vm.createContext(context);
  vm.runInContext(extractFunction("i12ConvictionReviewHtml"), context);
  return context;
}

test("i12ConvictionReviewHtml · sin convictionScore declarado, no muestra nada", () => {
  const ctx = sandboxReviewHtml();
  assert.equal(ctx.i12ConvictionReviewHtml({ convictionScore: null, convictionReviewedAt: "" }), "");
});

test("i12ConvictionReviewHtml · con convicción pero nunca revisada, avisa y ofrece marcarla", () => {
  const ctx = sandboxReviewHtml();
  const html = ctx.i12ConvictionReviewHtml({ id: "position-1", convictionScore: 4, convictionReviewedAt: "" });
  assert.match(html, /nunca confirmada/);
  assert.match(html, /data-iv1-position-mark-conviction-reviewed="position-1"/);
});

test("i12ConvictionReviewHtml · revisada hace más de 12 meses, avisa", () => {
  const ctx = sandboxReviewHtml();
  const thirteenMonthsAgo = new Date();
  thirteenMonthsAgo.setUTCMonth(thirteenMonthsAgo.getUTCMonth() - 13);
  const html = ctx.i12ConvictionReviewHtml({ id: "position-2", convictionScore: 2, convictionReviewedAt: thirteenMonthsAgo.toISOString().slice(0, 10) });
  assert.match(html, /sin revisar desde hace/);
});

test("i12ConvictionReviewHtml · revisada hace menos de 12 meses, no avisa", () => {
  const ctx = sandboxReviewHtml();
  const oneMonthAgo = new Date();
  oneMonthAgo.setUTCMonth(oneMonthAgo.getUTCMonth() - 1);
  const html = ctx.i12ConvictionReviewHtml({ id: "position-3", convictionScore: 5, convictionReviewedAt: oneMonthAgo.toISOString().slice(0, 10) });
  assert.doesNotMatch(html, /sin revisar desde hace/);
  assert.doesNotMatch(html, /nunca confirmada/);
  assert.match(html, /revisada hace/);
});

test("app.js: markIv1PositionConvictionReviewed actualiza solo convictionReviewedAt de la posición indicada", () => {
  const saved = {};
  const context = {
    iv1PositionsList: () => [
      { id: "position-1", label: "A", convictionScore: 3, convictionReviewedAt: "" },
      { id: "position-2", label: "B", convictionScore: 4, convictionReviewedAt: "2025-01-01" },
    ],
    saveIv1PositionsList: (next) => { saved.next = next; },
    renderIv1PositionList: () => { saved.rendered = true; },
    announceStatus: (message) => { saved.status = message; },
  };
  vm.createContext(context);
  vm.runInContext(extractFunction("markIv1PositionConvictionReviewed"), context);
  context.markIv1PositionConvictionReviewed("position-1");
  const today = new Date().toISOString().slice(0, 10);
  assert.equal(saved.next.find((p) => p.id === "position-1").convictionReviewedAt, today);
  assert.equal(saved.next.find((p) => p.id === "position-2").convictionReviewedAt, "2025-01-01", "no toca otras posiciones");
  assert.equal(saved.rendered, true);
  assert.ok(saved.status);
});

test("app.js: renderIv1PositionList llama a i12ConvictionReviewHtml sin sustituir el botón de quitar", () => {
  const block = appSource.slice(appSource.indexOf("function renderIv1PositionList("), appSource.indexOf("function renderIv1PositionList(") + 2200);
  assert.match(block, /i12ConvictionReviewHtml\(position\)/);
  assert.match(block, /data-iv1-position-remove="\$\{escapeHtml\(position\.id\)\}"/, "no debe sustituir el botón de quitar ya existente");
});
