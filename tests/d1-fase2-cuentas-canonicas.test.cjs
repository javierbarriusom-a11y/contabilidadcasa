const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const roadmap = fs.readFileSync(path.join(root, "debt-roadmap.html"), "utf8");

// D1 (Fase 2): generaliza el sandbox de deuda de 2 cuentas fijas (cb/bk, Entidad A/B) a N cuentas,
// alimentadas por cualquier otro contrato canónico real vivo (canonical-e14-debt-adapter.js,
// extraDebts). Entidad A/B mantienen su comportamiento y sus ids exactos — la paridad histórica de
// A9-8 (app.js: e14bLegacyParityConfig, que lee cb_strategy/bk_strategy del estado guardado) no se
// toca. Estos tests verifican solo la generalización estructural; el cálculo en sí (extra puntual,
// invariantes del motor) ya está cubierto en canonical-scenario-invariants.test.cjs y
// golden-debt-cases.test.cjs, que siguen aplicando sin cambios porque el motor ya era N-genérico.

function slice(markerStart, markerEnd, maxLen = 2000) {
  const start = roadmap.indexOf(markerStart);
  assert.ok(start >= 0, `no se encontró "${markerStart}"`);
  const end = markerEnd ? roadmap.indexOf(markerEnd, start) : start + maxLen;
  return roadmap.slice(start, end > start ? end : start + maxLen);
}

test("accountKey() genera una clave de campo segura a partir de cualquier id de contrato", () => {
  const block = slice("function accountKey(id)", "function escapeAttr");
  assert.match(block, /'acct_'\+String\(id\)\.replace\(\/\[\^a-zA-Z0-9_-\]\/g,'_'\)/);
});

test("renderDynamicAccountBlocks: crea un debt-block por cuenta, es idempotente y retira las que ya no están", () => {
  const block = slice("function renderDynamicAccountBlocks(list){", "\n}\n");
  assert.match(block, /container\.children.*node\.remove\(\)/s);
  assert.match(block, /if\(amountEl\)\{amountEl\.value=account\.currentPrincipal;return;\}/);
  assert.match(block, /readonly aria-readonly="true" class="canonical-field"/);
  assert.match(block, /updateStrategyFields\(key\)/);
});

test("currentConfig() sigue construyendo cb/bk exactamente igual y añade las cuentas dinámicas en cfg.extra", () => {
  const block = slice("function currentConfig()", "\n");
  assert.match(block, /cb:buildAccount\('cb'\),bk:buildAccount\('bk'\)/);
  assert.match(block, /extra:dynamicDebtAccounts\.map/);
});

test("accountEntries(): Entidad A y Entidad B siguen siendo los dos primeros índices, en ese orden", () => {
  const block = slice("function accountEntries(cfg)", "\n");
  assert.match(block, /\[\{key:'cb',label:'Entidad A',account:cfg\.cb\},\{key:'bk',label:'Entidad B',account:cfg\.bk\}/);
});

test("simulateScenario(): el total y la tabla se calculan sobre todas las cuentas (entries), no solo cb/bk", () => {
  const block = slice("function simulateScenario(cfg){const entries=accountEntries(cfg)", "\nfunction currentConfig");
  assert.match(block, /accounts:entries\.map\(\(e\)=>e\.account\)/);
  assert.match(block, /accountLabels:entries\.map\(\(e\)=>e\.label\)/);
  assert.match(block, /seriesCB:result\.rows\.map\(\(row\)=>row\.balances\[0\]\|\|0\)/);
  assert.match(block, /seriesBK:result\.rows\.map\(\(row\)=>row\.balances\[1\]\|\|0\)/);
});

test("renderForecast(): cabecera y filas de la tabla se generan a partir de accountLabels/perAccount, no de columnas fijas", () => {
  const block = slice("document.getElementById('forecastTableHead').innerHTML=", "renderBalanceChart(r,cfg.months)");
  assert.match(block, /r\.accountLabels\.map/);
  assert.match(block, /x\.perAccount\.map/);
});

test("collect() persiste los supuestos de las cuentas dinámicas pero nunca su importe canónico", () => {
  const collectStart = roadmap.indexOf("function collect()");
  const collectEnd = roadmap.indexOf("function applyCanonicalReadModel");
  const collectBody = roadmap.slice(collectStart, collectEnd);
  assert.match(collectBody, /dynamicDebtAccounts\.forEach/);
  const persistedFields = collectBody.match(/\['strategy','discount','start','lump','apr','term','finance_pct','extra','extra_month'\]/);
  assert.ok(persistedFields, "la lista de campos persistidos por cuenta dinámica no coincide con la esperada");
  assert.doesNotMatch(persistedFields[0], /amount/);
});

test("applyCanonicalReadModel(): lee extraDebts, actualiza el contador y dispara renderDynamicAccountBlocks antes de refreshAll", () => {
  const block = slice("dynamicDebtAccounts=Array.isArray(canonicalReadModel.extraDebts)", "refreshAll();}", 600);
  assert.match(block, /dynamicDebtAccounts=Array\.isArray\(canonicalReadModel\.extraDebts\)\?canonicalReadModel\.extraDebts:\[\]/);
  assert.match(block, /canonicalExtraCount/);
  assert.match(block, /renderDynamicAccountBlocks\(dynamicDebtAccounts\)/);
});

test("el listener de hydrate aplica primero el modelo canónico (crea los bloques) y luego restaura el estado guardado", () => {
  const block = slice("window.addEventListener('message',event=>{", "});", 1200);
  const canonicalIndex = block.indexOf("applyCanonicalReadModel(envelope.canonical)");
  const applyIndex = block.indexOf("apply(incoming)");
  assert.ok(canonicalIndex >= 0 && applyIndex >= 0 && canonicalIndex < applyIndex, "applyCanonicalReadModel debe ejecutarse antes que apply(incoming)");
});

test("index.html: el contenedor de cuentas dinámicas vive entre Entidad B y los parámetros del forecast", () => {
  const bkIndex = roadmap.indexOf("id=\"bk_extra_month\"");
  const dynamicIndex = roadmap.indexOf('id="dynamicDebtBlocks"');
  const paramsIndex = roadmap.indexOf("Parámetros del forecast");
  assert.ok(bkIndex < dynamicIndex && dynamicIndex < paramsIndex);
});

test("el panel de datos canónicos muestra cuántas deudas adicionales de Fase 2 se han incluido", () => {
  assert.match(roadmap, /id="canonicalExtraCount"/);
});
