const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const Portfolio = require("../canonical-portfolio.js");

// INV17 (Oleada 4, Bloque 4): revisión de rebalanceo por calendario — IV6/rebalanceSuggestions solo
// avisa cuando la desviación cruza el umbral de un salto; una cartera que se desalinea despacio
// puede tardar años en cruzarlo. Complementa, no sustituye, ese aviso con un recordatorio por
// tiempo transcurrido desde la última revisión CONFIRMADA por el hogar, nunca inferida.

const appSource = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const indexSource = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

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

test("rebalanceCalendarReviewStatus · sin ninguna revisión registrada, vencida desde el principio", () => {
  const status = Portfolio.rebalanceCalendarReviewStatus({ lastReviewedAt: "" });
  assert.equal(status.reviewed, false);
  assert.equal(status.due, true);
  assert.equal(status.monthsSinceReview, null);
});

test("rebalanceCalendarReviewStatus · revisión reciente dentro del intervalo, no vencida", () => {
  const status = Portfolio.rebalanceCalendarReviewStatus(
    { lastReviewedAt: "2026-06-01", intervalMonths: 6 },
    new Date("2026-08-01T00:00:00Z"),
  );
  assert.equal(status.reviewed, true);
  assert.equal(status.monthsSinceReview, 2);
  assert.equal(status.due, false);
});

test("rebalanceCalendarReviewStatus · revisión antigua fuera del intervalo, vencida", () => {
  const status = Portfolio.rebalanceCalendarReviewStatus(
    { lastReviewedAt: "2025-01-01", intervalMonths: 6 },
    new Date("2026-08-01T00:00:00Z"),
  );
  assert.equal(status.reviewed, true);
  assert.equal(status.due, true);
  assert.ok(status.monthsSinceReview >= 6);
});

test("rebalanceCalendarReviewStatus · un intervalo inválido o ausente cae al valor por defecto (6 meses)", () => {
  const status = Portfolio.rebalanceCalendarReviewStatus({ lastReviewedAt: "2026-01-01", intervalMonths: 0 }, new Date("2026-03-01T00:00:00Z"));
  assert.equal(status.intervalMonths, Portfolio.REBALANCE_CALENDAR_REVIEW_DEFAULT_MONTHS);
});

function sandbox({ intervalMonths, lastReviewedAt, activeElementIsInput = false } = {}) {
  const noteContainer = { innerHTML: "" };
  const intervalInput = { value: "" };
  const context = {
    window: { FinanceCanonicalPortfolio: Portfolio },
    scenarioSettings: { inv17RebalanceReviewIntervalMonths: intervalMonths, inv17LastRebalanceReviewAt: lastReviewedAt },
    qs: (id) => {
      if (id === "inv17RebalanceCalendarNote") return noteContainer;
      if (id === "inv17ReviewIntervalMonths") return intervalInput;
      return null;
    },
    document: { activeElement: activeElementIsInput ? intervalInput : null },
    announceStatus: () => {},
    saveScenarioSettings: () => {},
    parseAmount: (value) => (value === "" || value === undefined ? NaN : Number(value)),
    noteContainer,
    intervalInput,
  };
  vm.createContext(context);
  vm.runInContext(extractFunction("inv17RebalanceReviewIntervalMonths"), context);
  vm.runInContext(extractFunction("saveInv17RebalanceReviewInterval"), context);
  vm.runInContext(extractFunction("markInv17RebalanceReviewed"), context);
  vm.runInContext(extractFunction("renderInv17RebalanceCalendarReview"), context);
  return context;
}

test("renderInv17RebalanceCalendarReview · sin revisión registrada, avisa que hay que marcar la primera", () => {
  const ctx = sandbox({});
  ctx.renderInv17RebalanceCalendarReview();
  assert.match(ctx.noteContainer.innerHTML, /Todavía no has marcado ninguna revisión/);
});

test("renderInv17RebalanceCalendarReview · revisión muy antigua (fecha fija, siempre vencida), avisa aunque no haya cruzado ningún umbral", () => {
  const ctx = sandbox({ lastReviewedAt: "2000-01-01", intervalMonths: 6 });
  ctx.renderInv17RebalanceCalendarReview();
  assert.match(ctx.noteContainer.innerHTML, /toca revisar el reparto/);
});

test("markInv17RebalanceReviewed · guarda la fecha de hoy y vuelve a pintar la tarjeta", () => {
  const ctx = sandbox({});
  ctx.markInv17RebalanceReviewed();
  assert.ok(ctx.scenarioSettings.inv17LastRebalanceReviewAt);
  assert.match(ctx.noteContainer.innerHTML, /Última revisión hace 0 mes\(es\)/);
});

test("saveInv17RebalanceReviewInterval · guarda un intervalo positivo, borra uno inválido", () => {
  const ctx = sandbox({});
  ctx.intervalInput.value = "12";
  ctx.saveInv17RebalanceReviewInterval();
  assert.equal(ctx.scenarioSettings.inv17RebalanceReviewIntervalMonths, 12);
  ctx.intervalInput.value = "0";
  ctx.saveInv17RebalanceReviewInterval();
  assert.equal(ctx.scenarioSettings.inv17RebalanceReviewIntervalMonths, undefined);
});

test("index.html: intervalo de revisión, botón de marcar revisado y nota de INV17 en la tarjeta de rebalanceo", () => {
  assert.match(indexSource, /id="inv17ReviewIntervalMonths"/);
  assert.match(indexSource, /id="inv17MarkReviewed"/);
  assert.match(indexSource, /id="inv17RebalanceCalendarNote"/);
});

test("app.js: los listeners de INV17 están cableados", () => {
  assert.match(appSource, /qs\("inv17ReviewIntervalMonths"\)\?\.addEventListener\("change", saveInv17RebalanceReviewInterval\);/);
  assert.match(appSource, /qs\("inv17MarkReviewed"\)\?\.addEventListener\("click", markInv17RebalanceReviewed\);/);
});

test("wiring: renderInv17RebalanceCalendarReview se llama en el render central", () => {
  assert.match(appSource, /renderInv17RebalanceCalendarReview\(\);/);
});
