const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// DEB14 (Oleada 4, Bloque 6, DE-6, alcance reducido): distinto de DEB4 ("tu cálculo cambió") — esta
// tarea es "no has mirado el mercado". Cruza la deuda declarada como "Hipoteca" (campo de texto
// libre de un contrato, igual que DEB16 ya trató `type`) con el registro de ofertas externas de
// Deuda › Ruta (E14, normalizeOffer) que DEB4 nunca consulta. Sin motor nuevo.

const appSource = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const indexSource = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const inversionSource = fs.readFileSync(path.join(__dirname, "..", "views", "inversion.js"), "utf8");

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

function sandbox({ state = {}, contracts = [], offers = [], noteEl = { innerHTML: "" }, fieldEl = { value: "" } } = {}) {
  const saved = [];
  const context = {
    state,
    saveScenarioSettings: () => saved.push(JSON.parse(JSON.stringify(state))),
    debtContractSourceRows: () => contracts,
    e14bWorkspace: () => ({ offers }),
    document: { activeElement: null },
    qs: (id) => {
      if (id === "deb14MarketCheckAlert") return noteEl;
      if (id === "deb14MaxMonthsWithoutOffer") return fieldEl;
      return null;
    },
    escapeHtml: (value) => String(value ?? ""),
    saved,
    noteEl,
    fieldEl,
  };
  vm.createContext(context);
  vm.runInContext(extractFunction("monthDistance"), context);
  vm.runInContext(extractFunction("dateFromMonthKey"), context);
  vm.runInContext(extractFunction("positiveIntegerFromField"), context);
  vm.runInContext(extractFunction("deb14MortgageContracts"), context);
  vm.runInContext(extractFunction("deb14LatestOfferMonth"), context);
  vm.runInContext(extractFunction("deb14MaxMonthsWithoutOffer"), context);
  vm.runInContext(extractFunction("deb14MarketCheckFreshness"), context);
  vm.runInContext(extractFunction("deb14MarketCheckAlertHtml"), context);
  vm.runInContext(extractFunction("renderDeb14MarketCheckAlert"), context);
  vm.runInContext(extractFunction("handleDeb14MaxMonthsChange"), context);
  vm.runInContext(extractFunction("syncDeb14MaxMonthsControl"), context);
  return context;
}

const MORTGAGE = { id: "debt-mortgage", entity: "Hipoteca BancoX", type: "Hipoteca", paymentStatus: "active", currentPrincipal: 150000 };
const CARD = { id: "debt-card", entity: "Tarjeta", type: "Tarjeta", paymentStatus: "active", currentPrincipal: 1000 };

test("deb14MortgageContracts · filtra por tipo declarado 'Hipoteca' (sin distinguir mayúsculas), ignora otros tipos", () => {
  const ctx = sandbox({ contracts: [MORTGAGE, CARD, { ...MORTGAGE, id: "debt-2", type: "HIPOTECA VARIABLE" }] });
  const rows = ctx.deb14MortgageContracts();
  assert.equal(rows.length, 2);
  assert.ok(rows.every((row) => row.type.toLowerCase().includes("hipoteca")));
});

test("deb14MortgageContracts · ignora deudas no activas", () => {
  const ctx = sandbox({ contracts: [{ ...MORTGAGE, paymentStatus: "suspended" }] });
  assert.equal(ctx.deb14MortgageContracts().length, 0);
});

test("deb14LatestOfferMonth · sin ofertas registradas para ese contrato, null", () => {
  const ctx = sandbox({ offers: [{ contractId: "otro", receivedAt: "2026-01" }] });
  assert.equal(ctx.deb14LatestOfferMonth("debt-mortgage"), null);
});

test("deb14LatestOfferMonth · con varias ofertas, la más reciente", () => {
  const ctx = sandbox({
    offers: [
      { contractId: "debt-mortgage", receivedAt: "2025-03" },
      { contractId: "debt-mortgage", receivedAt: "2026-01" },
      { contractId: "debt-mortgage", receivedAt: "2025-11" },
    ],
  });
  assert.equal(ctx.deb14LatestOfferMonth("debt-mortgage"), "2026-01");
});

test("deb14MarketCheckFreshness · sin umbral declarado, no calculable (nunca inventa un umbral por defecto)", () => {
  const ctx = sandbox({ state: {}, contracts: [MORTGAGE] });
  assert.equal(ctx.deb14MarketCheckFreshness().calculable, false);
});

test("deb14MarketCheckFreshness · con umbral pero sin ninguna deuda declarada como hipoteca, no calculable", () => {
  const ctx = sandbox({ state: { deb14MaxMonthsWithoutOffer: 12 }, contracts: [CARD] });
  assert.equal(ctx.deb14MarketCheckFreshness().calculable, false);
});

test("deb14MarketCheckFreshness · hipoteca sin ninguna oferta registrada nunca, marcada como pendiente sin inventar meses", () => {
  const ctx = sandbox({ state: { deb14MaxMonthsWithoutOffer: 12 }, contracts: [MORTGAGE], offers: [] });
  const result = ctx.deb14MarketCheckFreshness();
  assert.equal(result.calculable, true);
  assert.equal(result.rows[0].neverCompared, true);
  assert.equal(result.rows[0].monthsSince, null);
  assert.equal(result.rows[0].overdue, true);
});

test("deb14MarketCheckFreshness · última oferta reciente, dentro del umbral, no está pendiente", () => {
  const now = new Date(2026, 5, 1);
  const ctx = sandbox({ state: { deb14MaxMonthsWithoutOffer: 12 }, contracts: [MORTGAGE], offers: [{ contractId: "debt-mortgage", receivedAt: "2026-03" }] });
  const result = ctx.deb14MarketCheckFreshness(now);
  assert.equal(result.rows[0].overdue, false);
  assert.equal(result.rows[0].monthsSince, 3);
});

test("deb14MarketCheckFreshness · última oferta antigua, supera el umbral declarado, pendiente", () => {
  const now = new Date(2026, 5, 1);
  const ctx = sandbox({ state: { deb14MaxMonthsWithoutOffer: 12 }, contracts: [MORTGAGE], offers: [{ contractId: "debt-mortgage", receivedAt: "2024-01" }] });
  const result = ctx.deb14MarketCheckFreshness(now);
  assert.equal(result.rows[0].overdue, true);
  assert.equal(result.rows[0].monthsSince, 29);
});

test("deb14MarketCheckAlertHtml · sin nada pendiente, mensaje positivo sin alarmar", () => {
  const ctx = sandbox();
  const html = ctx.deb14MarketCheckAlertHtml({ calculable: true, maxMonths: 12, rows: [{ entity: "Hipoteca BancoX", overdue: false }] });
  assert.match(html, /dentro de tu umbral/);
});

test("deb14MarketCheckAlertHtml · con una hipoteca nunca comparada, lo dice explícitamente sin inventar meses", () => {
  const ctx = sandbox();
  const html = ctx.deb14MarketCheckAlertHtml({ calculable: true, maxMonths: 12, rows: [{ entity: "Hipoteca BancoX", overdue: true, neverCompared: true }] });
  assert.match(html, /nunca has registrado/);
  assert.match(html, /Hipoteca BancoX/);
});

test("deb14MarketCheckAlertHtml · con una hipoteca pendiente por tiempo, nombra los meses y la última fecha", () => {
  const ctx = sandbox();
  const html = ctx.deb14MarketCheckAlertHtml({ calculable: true, maxMonths: 12, rows: [{ entity: "Hipoteca BancoX", overdue: true, neverCompared: false, monthsSince: 18, latest: "2024-12" }] });
  assert.match(html, /18 mes\(es\)/);
  assert.match(html, /2024-12/);
});

test("deb14MarketCheckAlertHtml · no calculable, no muestra nada", () => {
  const ctx = sandbox();
  assert.equal(ctx.deb14MarketCheckAlertHtml({ calculable: false }), "");
});

test("handleDeb14MaxMonthsChange · guarda el umbral declarado y repinta la alerta", () => {
  const ctx = sandbox({ state: {}, contracts: [MORTGAGE], offers: [] });
  ctx.handleDeb14MaxMonthsChange({ target: { value: "18" } });
  assert.equal(ctx.state.deb14MaxMonthsWithoutOffer, 18);
  assert.equal(ctx.saved.length, 1);
  assert.match(ctx.noteEl.innerHTML, /nunca has registrado/);
});

test("wiring: renderInversionApalancamiento() repinta DEB14 al entrar en la vista — misma lección de LEV10 (vista cargada de forma perezosa, no pasa por renderAjustes())", () => {
  const start = inversionSource.indexOf("function renderInversionApalancamiento(");
  const end = inversionSource.indexOf("\n}", start);
  const block = inversionSource.slice(start, end);
  assert.match(block, /syncDeb14MaxMonthsControl\(\);/);
  assert.match(block, /renderDeb14MarketCheckAlert\(\);/);
});

test("wiring: index.html declara el campo de umbral y la nota de alerta, después de la tarjeta de DEB4", () => {
  assert.match(indexSource, /id="deb14MaxMonthsWithoutOffer"/);
  assert.match(indexSource, /id="deb14MarketCheckAlert"/);
  const deb4Idx = indexSource.indexOf('id="deb4RadarAlert"');
  const deb14Idx = indexSource.indexOf('id="deb14MarketCheckAlert"');
  assert.ok(deb4Idx > 0 && deb14Idx > deb4Idx, "DEB14 debe estar después de la tarjeta de DEB4");
});

test("wiring: app.js conecta el cambio del campo a handleDeb14MaxMonthsChange", () => {
  assert.match(appSource, /qs\("deb14MaxMonthsWithoutOffer"\)\?\.addEventListener\("change", handleDeb14MaxMonthsChange\)/);
});

test("wiring: saveScenarioSettings() incluye deb14MaxMonthsWithoutOffer en su lista explícita de campos persistidos", () => {
  const start = appSource.indexOf("function saveScenarioSettings(");
  const end = appSource.indexOf("\n}", start);
  const block = appSource.slice(start, end);
  assert.match(block, /deb14MaxMonthsWithoutOffer: state\.deb14MaxMonthsWithoutOffer \? Math\.round\(Math\.max\(1, Math\.min\(120, Number\(state\.deb14MaxMonthsWithoutOffer\)\)\)\) : 0,/);
});
