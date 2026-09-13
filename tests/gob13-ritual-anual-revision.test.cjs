const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const PortfolioEngine = require("../canonical-portfolio.js");

// GOB13 (Oleada 4, Bloque 7): ritual anual de revisión guiada. Complementa, no repite, GOB6
// (checklist MENSUAL de cierre) — fuerza revisar en un solo sitio, UNA VEZ AL AÑO, tres cosas que
// hoy viven aisladas cada una en su propia pantalla: supuestos caducados (PVC15), ofertas de deuda
// sin comparar (DEB14) y desviación de cartera (INV17) — reutilizadas tal cual, sin motor propio.
// Se prueban las tres funciones de comprobación con resultados simulados de sus propios motores
// (igual que deb1VerdictChangeHtml/ap3ResultHtml ya se prueban con resultados simulados, sin repetir
// la cobertura de esos motores) salvo INV17, que usa el canonical-portfolio.js real porque es una
// función pura y sencilla de conducir con datos realistas.

const source = fs.readFileSync(path.join(__dirname, "..", "views", "cierre.js"), "utf8");

function extractFunction(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `No existe la función ${name} en views/cierre.js`);
  const parenStart = source.indexOf("(", start);
  let parenDepth = 0;
  let bodyStart = -1;
  for (let index = parenStart; index < source.length; index += 1) {
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
  throw new Error(`La función ${name} no cierra sus llaves`);
}

function sandbox({
  scenarioSettings = {},
  forecastExpired = [],
  deb14Result = { calculable: false },
  noteEl = { innerHTML: "" },
} = {}) {
  const announceCalls = [];
  const saveCalls = [];
  const context = {
    scenarioSettings,
    window: {
      FinanceCanonicalForecast: {
        buildAssumptionRegistry: () => ({ items: [] }),
        assumptionExpiryAlerts: () => ({ expired: forecastExpired }),
      },
      FinanceCanonicalPortfolio: PortfolioEngine,
    },
    assumptionRegistryInput: () => ({}),
    deb14MarketCheckFreshness: () => deb14Result,
    inv17RebalanceReviewIntervalMonths: () => 6,
    escapeHtml: (value) => String(value ?? ""),
    qs: (id) => (id === "gob13AnnualReviewNote" ? noteEl : null),
    saveScenarioSettings: () => saveCalls.push(JSON.parse(JSON.stringify(scenarioSettings))),
    announceStatus: (message) => announceCalls.push(message),
    noteEl,
    announceCalls,
    saveCalls,
  };
  vm.createContext(context);
  vm.runInContext(extractFunction("gob13AssumptionExpiryCheck"), context);
  vm.runInContext(extractFunction("gob13DebtOfferCheck"), context);
  vm.runInContext(extractFunction("gob13PortfolioDeviationCheck"), context);
  vm.runInContext(extractFunction("gob13AnnualReviewChecklist"), context);
  vm.runInContext(extractFunction("gob13AnnualReviewStatus"), context);
  vm.runInContext(extractFunction("gob13AnnualReviewHtml"), context);
  vm.runInContext(extractFunction("renderGob13AnnualReview"), context);
  vm.runInContext(extractFunction("markGob13AnnualReviewDone"), context);
  return context;
}

test("gob13AssumptionExpiryCheck · sin supuestos caducados (PVC15), cumplido", () => {
  const ctx = sandbox({ forecastExpired: [] });
  const check = ctx.gob13AssumptionExpiryCheck();
  assert.equal(check.met, true);
  assert.match(check.label, /al día/);
});

test("gob13AssumptionExpiryCheck · con supuestos caducados, no cumplido y cuenta cuántos", () => {
  const ctx = sandbox({ forecastExpired: [{ id: "incomeFactor" }, { id: "annualInflation" }] });
  const check = ctx.gob13AssumptionExpiryCheck();
  assert.equal(check.met, false);
  assert.match(check.label, /2 supuesto\(s\)/);
});

test("gob13DebtOfferCheck · sin umbral declarado en DEB14, ni cumplido ni incumplido (null)", () => {
  const ctx = sandbox({ deb14Result: { calculable: false } });
  const check = ctx.gob13DebtOfferCheck();
  assert.equal(check.met, null);
});

test("gob13DebtOfferCheck · sin ninguna deuda pendiente por comparar, cumplido", () => {
  const ctx = sandbox({ deb14Result: { calculable: true, rows: [{ overdue: false }] } });
  const check = ctx.gob13DebtOfferCheck();
  assert.equal(check.met, true);
});

test("gob13DebtOfferCheck · con al menos una deuda pendiente por comparar, no cumplido", () => {
  const ctx = sandbox({ deb14Result: { calculable: true, rows: [{ overdue: true }, { overdue: false }] } });
  const check = ctx.gob13DebtOfferCheck();
  assert.equal(check.met, false);
  assert.match(check.label, /1 deuda\(s\)/);
});

test("gob13PortfolioDeviationCheck · sin ninguna revisión de rebalanceo marcada nunca, no cumplido", () => {
  const ctx = sandbox({ scenarioSettings: {} });
  const check = ctx.gob13PortfolioDeviationCheck();
  assert.equal(check.met, false);
  assert.match(check.label, /Todavía no has marcado/);
});

test("gob13PortfolioDeviationCheck · revisión reciente dentro del intervalo declarado, cumplido", () => {
  const today = new Date().toISOString().slice(0, 10);
  const ctx = sandbox({ scenarioSettings: { inv17LastRebalanceReviewAt: today } });
  const check = ctx.gob13PortfolioDeviationCheck();
  assert.equal(check.met, true);
});

test("gob13AnnualReviewStatus · nunca marcado, no revisado y pendiente (usa la misma función genérica que INV17)", () => {
  const ctx = sandbox();
  const status = ctx.gob13AnnualReviewStatus();
  assert.equal(status.reviewed, false);
  assert.equal(status.due, true);
});

test("gob13AnnualReviewStatus · marcado hace un año exacto, ya toca repetirlo", () => {
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const ctx = sandbox({ scenarioSettings: { gob13LastAnnualReviewAt: oneYearAgo.toISOString().slice(0, 10) } });
  const status = ctx.gob13AnnualReviewStatus();
  assert.equal(status.reviewed, true);
  assert.equal(status.due, true);
});

test("gob13AnnualReviewStatus · marcado hace un mes, todavía dentro del año", () => {
  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
  const ctx = sandbox({ scenarioSettings: { gob13LastAnnualReviewAt: oneMonthAgo.toISOString().slice(0, 10) } });
  const status = ctx.gob13AnnualReviewStatus();
  assert.equal(status.reviewed, true);
  assert.equal(status.due, false);
});

test("gob13AnnualReviewHtml · lista los tres chequeos y el estado del propio ritual", () => {
  const ctx = sandbox({ forecastExpired: [], deb14Result: { calculable: false } });
  const html = ctx.gob13AnnualReviewHtml();
  assert.match(html, /PVC15/);
  assert.match(html, /DEB14/);
  assert.match(html, /INV17/);
  assert.match(html, /Todavía no has marcado ningún ritual anual/);
});

test("renderGob13AnnualReview · pinta el resultado en la nota", () => {
  const ctx = sandbox();
  ctx.renderGob13AnnualReview();
  assert.match(ctx.noteEl.innerHTML, /deuda-ruta-checklist/);
});

test("markGob13AnnualReviewDone · guarda la fecha de hoy, persiste, repinta y avisa", () => {
  const ctx = sandbox({ scenarioSettings: {} });
  ctx.markGob13AnnualReviewDone();
  assert.equal(ctx.scenarioSettings.gob13LastAnnualReviewAt, new Date().toISOString().slice(0, 10));
  assert.equal(ctx.saveCalls.length, 1);
  assert.equal(ctx.announceCalls.length, 1);
  assert.match(ctx.noteEl.innerHTML, /dentro del año/);
});

test("wiring: renderCierre() repinta GOB13 en cada render, con el mes abierto o cerrado", () => {
  const start = source.indexOf("function renderCierre(");
  const end = source.indexOf("\n}\n", start);
  const block = source.slice(start, end);
  assert.match(block, /renderGob13AnnualReview\(\);/);
  // Debe estar ANTES de la rama if (currentClosure) — visible en ambos estados, no solo uno.
  const callIdx = block.indexOf("renderGob13AnnualReview();");
  const branchIdx = block.indexOf("if (currentClosure)");
  assert.ok(callIdx > 0 && branchIdx > callIdx, "GOB13 debe repintarse antes de la rama abierto/cerrado");
});

test("wiring: app.js conecta el botón de marcar el ritual como hecho, dentro del delegado de clics de #cierre", () => {
  const appSource = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
  const start = appSource.indexOf('qs("cierre")?.addEventListener("click"');
  const end = appSource.indexOf("\n  });", start);
  const block = appSource.slice(start, end);
  assert.match(block, /data-gob13-mark-done/);
  assert.match(block, /markGob13AnnualReviewDone\(\)/);
});

test("wiring: index.html declara la tarjeta y el botón, dentro de la sección #cierre", () => {
  const indexSource = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  assert.match(indexSource, /id="gob13AnnualReviewNote"/);
  assert.match(indexSource, /data-gob13-mark-done/);
  const cierreStart = indexSource.indexOf('id="cierre"');
  const cierreEnd = indexSource.indexOf("</section>", cierreStart);
  const noteIdx = indexSource.indexOf('id="gob13AnnualReviewNote"');
  assert.ok(cierreStart > 0 && noteIdx > cierreStart && noteIdx < cierreEnd, "GOB13 debe vivir dentro de la sección #cierre");
});
