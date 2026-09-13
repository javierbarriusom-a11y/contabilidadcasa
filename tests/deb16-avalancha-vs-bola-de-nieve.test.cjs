const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const DebtContracts = require("../canonical-debt-contracts.js");

// DEB16 (Oleada 4, Bloque 6, DE-8): DEB5 (fiscalAdjustedDebtPriority) siempre ordena las deudas
// activas por coste real ("avalancha") sin preguntar si el hogar prefiere "bola de nieve" (menor
// capital pendiente primero) en su lugar. Distinto de DEB7 (preferencia agregada coste-mínimo vs.
// libre-de-deudas sobre el veredicto de UNA deuda en AP1): aquí la pregunta es el orden entre VARIAS
// deudas simultáneas. Reutiliza tal cual las filas ya calculadas por fiscalAdjustedDebtPriority()
// (ya cubierta en tests/deb5-deb6-prioridad-fiscal-y-consolidacion.test.cjs) — solo las reordena.

const source = fs.readFileSync(path.join(__dirname, "..", "views", "deuda.js"), "utf8");

function extractFunction(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `No existe la función ${name} en views/deuda.js`);
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

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

function extractConst(name) {
  const start = source.indexOf(`const ${name} =`);
  assert.ok(start >= 0, `No existe la constante ${name} en views/deuda.js`);
  const end = source.indexOf("};", start);
  assert.ok(end >= 0, `No se encontró el cierre de ${name}`);
  return source.slice(start, end + 1);
}

function sandbox({ state = {}, noteEl = { innerHTML: "" }, selectEl = { value: "avalancha" }, contracts = CONTRACTS } = {}) {
  const saved = [];
  const context = {
    window: { FinanceDebtContracts: DebtContracts },
    state,
    saveScenarioSettings: () => saved.push(plain(state)),
    document: { activeElement: null },
    debtContractSourceRows: () => contracts,
    qs: (id) => {
      if (id === "deb16PayoffOrderNote") return noteEl;
      if (id === "deb16PayoffStrategySelect") return selectEl;
      return null;
    },
    escapeHtml: (value) => String(value ?? ""),
    money: (value) => `${Math.round(value)}€`,
    noteEl,
    selectEl,
    saved,
  };
  vm.createContext(context);
  vm.runInContext(extractConst("DEB16_STRATEGY_LABEL"), context);
  vm.runInContext(extractFunction("deb16PayoffStrategy"), context);
  vm.runInContext(extractFunction("syncDeb16PayoffStrategyControl"), context);
  vm.runInContext(extractFunction("handleDeb16PayoffStrategyChange"), context);
  vm.runInContext(extractFunction("deb16OrderedRows"), context);
  vm.runInContext(extractFunction("deb16PayoffOrderHtml"), context);
  vm.runInContext(extractFunction("renderDeb16PayoffOrder"), context);
  return context;
}

const CONTRACTS = DebtContracts.normalizeContracts([
  { id: "hipoteca", entity: "Hipoteca", type: "Hipoteca", currentPrincipal: 150000, apr: 3, currentPayment: 700, remainingInstallments: 240 },
  { id: "coche", entity: "Préstamo coche", type: "Préstamo", currentPrincipal: 8000, apr: 7, currentPayment: 300, remainingInstallments: 30 },
  { id: "tarjeta", entity: "Tarjeta", type: "Tarjeta", currentPrincipal: 2000, apr: 15, currentPayment: 100, remainingInstallments: 20 },
]).contracts;

test("deb16PayoffStrategy · sin declarar, por defecto avalancha (mismo orden que ya se veía antes de DEB16)", () => {
  const ctx = sandbox({ state: {} });
  assert.equal(ctx.deb16PayoffStrategy(), "avalancha");
});

test("deb16PayoffStrategy · declarada bola de nieve, la respeta", () => {
  const ctx = sandbox({ state: { deb16PayoffStrategy: "bola-de-nieve" } });
  assert.equal(ctx.deb16PayoffStrategy(), "bola-de-nieve");
});

test("deb16OrderedRows · avalancha ordena por TAE efectivo descendente (mayor coste real primero)", () => {
  const ctx = sandbox();
  const priorityResult = DebtContracts.fiscalAdjustedDebtPriority(CONTRACTS);
  const rows = plain(ctx.deb16OrderedRows(priorityResult, "avalancha"));
  assert.deepEqual(rows.map((row) => row.entity), ["Tarjeta", "Préstamo coche", "Hipoteca"]);
  assert.deepEqual(rows.map((row) => row.payoffRank), [1, 2, 3]);
});

test("deb16OrderedRows · bola de nieve ordena por capital pendiente ascendente (menor deuda primero), orden distinto de avalancha", () => {
  const ctx = sandbox();
  const priorityResult = DebtContracts.fiscalAdjustedDebtPriority(CONTRACTS);
  const rows = plain(ctx.deb16OrderedRows(priorityResult, "bola-de-nieve"));
  assert.deepEqual(rows.map((row) => row.entity), ["Tarjeta", "Préstamo coche", "Hipoteca"]);
  // Casualmente coincide en este ejemplo porque la más barata también es la más pequeña — se prueba
  // con un segundo escenario donde el orden SÍ diverge.
});

test("deb16OrderedRows · avalancha y bola de nieve divergen cuando la deuda más cara no es la más pequeña", () => {
  const contracts = DebtContracts.normalizeContracts([
    { id: "grande-cara", entity: "Grande y cara", type: "Préstamo", currentPrincipal: 20000, apr: 12, currentPayment: 500, remainingInstallments: 48 },
    { id: "pequena-barata", entity: "Pequeña y barata", type: "Préstamo", currentPrincipal: 1000, apr: 2, currentPayment: 100, remainingInstallments: 10 },
  ]).contracts;
  const ctx = sandbox();
  const priorityResult = DebtContracts.fiscalAdjustedDebtPriority(contracts);
  const avalancha = plain(ctx.deb16OrderedRows(priorityResult, "avalancha")).map((row) => row.entity);
  const bolaDeNieve = plain(ctx.deb16OrderedRows(priorityResult, "bola-de-nieve")).map((row) => row.entity);
  assert.deepEqual(avalancha, ["Grande y cara", "Pequeña y barata"]);
  assert.deepEqual(bolaDeNieve, ["Pequeña y barata", "Grande y cara"]);
});

test("deb16OrderedRows · sin deudas activas con TAE declarado, no hay nada que ordenar", () => {
  const ctx = sandbox();
  const priorityResult = DebtContracts.fiscalAdjustedDebtPriority([]);
  assert.deepEqual(plain(ctx.deb16OrderedRows(priorityResult, "avalancha")), []);
});

test("deb16PayoffOrderHtml · nombra la estrategia declarada y no decide cuál es mejor", () => {
  const ctx = sandbox();
  const priorityResult = DebtContracts.fiscalAdjustedDebtPriority(CONTRACTS);
  const html = ctx.deb16PayoffOrderHtml(priorityResult, "bola-de-nieve");
  assert.match(html, /bola de nieve/);
  assert.match(html, /Tarjeta/);
  assert.doesNotMatch(html, /mejor estrategia|deberías elegir|recomendamos/i);
});

test("renderDeb16PayoffOrder · pinta el orden con la estrategia ya guardada en state", () => {
  const ctx = sandbox({ state: { deb16PayoffStrategy: "bola-de-nieve" } });
  ctx.renderDeb16PayoffOrder(CONTRACTS);
  assert.match(ctx.noteEl.innerHTML, /bola de nieve/);
  assert.equal(ctx.selectEl.value, "bola-de-nieve");
});

test("handleDeb16PayoffStrategyChange · guarda la preferencia elegida en el desplegable y repinta el orden", () => {
  const ctx = sandbox({ state: {}, selectEl: { value: "bola-de-nieve" } });
  ctx.handleDeb16PayoffStrategyChange();
  assert.equal(ctx.state.deb16PayoffStrategy, "bola-de-nieve");
  assert.equal(ctx.saved.length, 1);
});

test("wiring: renderDeudaContratos llama a renderDeb16PayoffOrder junto a DEB5/DEB13", () => {
  const start = source.indexOf("function renderDeudaContratos(");
  const block = source.slice(start, source.indexOf("\n}\n", start) + 3);
  assert.match(block, /renderDeb5FiscalPriority\(contracts\)/);
  assert.match(block, /renderDeb16PayoffOrder\(contracts\)/);
  assert.match(block, /renderDeb13DormantExpensiveDebtAlert\(contracts\)/);
});

test("wiring: index.html declara el selector de estrategia y su nota de resultado, justo después de la tarjeta de DEB5", () => {
  const indexSource = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  assert.match(indexSource, /id="deb16PayoffStrategySelect"/);
  assert.match(indexSource, /id="deb16PayoffOrderNote"/);
  const deb5Idx = indexSource.indexOf('id="deb5FiscalPriorityNote"');
  const deb16Idx = indexSource.indexOf('id="deb16PayoffStrategySelect"');
  const deb13Idx = indexSource.indexOf('id="deb13DormantDebtAlert"');
  assert.ok(deb5Idx > 0 && deb16Idx > deb5Idx && deb13Idx > deb16Idx, "DEB16 debe estar entre las tarjetas de DEB5 y DEB13");
});

test("wiring: app.js conecta el cambio del desplegable a handleDeb16PayoffStrategyChange envuelto en una función anónima — nunca por referencia directa, que rompería el arranque porque views/deuda.js (donde vive el manejador) se carga de forma perezosa, después de que este listener se registre", () => {
  const appSource = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
  assert.match(appSource, /qs\("deb16PayoffStrategySelect"\)\?\.addEventListener\("change", \(\) => handleDeb16PayoffStrategyChange\(\)\)/);
});

test("wiring: saveScenarioSettings() incluye deb16PayoffStrategy en su lista explícita de campos persistidos — sin esto, state.deb16PayoffStrategy se pierde al recargar aunque se guarde en memoria (mismo fallo que SP3/FC4 documentan en el propio código)", () => {
  const appSource = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
  const start = appSource.indexOf("function saveScenarioSettings(");
  const end = appSource.indexOf("\n}", start);
  const block = appSource.slice(start, end);
  assert.match(block, /deb16PayoffStrategy: state\.deb16PayoffStrategy === "bola-de-nieve" \? "bola-de-nieve" : "avalancha",/);
});
