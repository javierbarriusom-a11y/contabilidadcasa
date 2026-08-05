const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const html = read("index.html");
const app = read("app.js");
const roadmap = read("debt-roadmap.html");
const worker = read("service-worker.js");

test("E14a carga y publica el adaptador antes de la aplicación", () => {
  assert.ok(html.indexOf("canonical-debt-contracts.js") < html.indexOf("canonical-e14-debt-adapter.js"));
  assert.ok(html.indexOf("canonical-e14-debt-adapter.js") < html.indexOf("app.js"));
  assert.match(worker, /canonical-e14-debt-adapter\.js/);
});

test("E14b carga el contrato de operaciones y mantiene el plan visual como compatibilidad", () => {
  assert.ok(html.indexOf("canonical-e14-operations.js") < html.indexOf("app.js"));
  assert.match(worker, /canonical-e14-operations\.js/);
  assert.match(html, /id="e14bSaveOffer"/);
  assert.match(html, /id="e14bApply"/);
  assert.match(html, /Plan visual anterior \(compatibilidad durante la migración\)/);
  assert.match(app, /E14DebtOperations\.optimize/);
  assert.match(app, /FinanceCanonicalE13\?\.buildLab/);
  assert.match(app, /requestOperationConfirmation\(\{/);
});

test("A9-8 extrae el motor histórico y bloquea retirar el iframe sin paridad", () => {
  assert.match(html, /legacy-debt-roadmap-engine\.js/);
  assert.match(html, /canonical-e14-parity\.js/);
  assert.match(worker, /legacy-debt-roadmap-engine\.js/);
  assert.match(worker, /canonical-e14-parity\.js/);
  assert.match(roadmap, /FinanceLegacyDebtRoadmapEngine/);
  assert.match(app, /renderE14bParity/);
  assert.match(app, /Alcance verificado: Entidad A\/B/);
  assert.match(roadmap, /notifyParent\(\);reportHeight\(\)/);
});

test("el puente entrega un sobre canónico de solo lectura al iframe", () => {
  assert.match(app, /E14DebtAdapter\?\.buildReadModel/);
  assert.match(app, /payload: \{ state: debtRoadmapState, canonical \}/);
  assert.match(roadmap, /Datos canónicos de solo lectura/);
  assert.match(roadmap, /canonicalReadModel\.canonicalValues/);
});

test("los campos canónicos no regresan en la escritura del plan visual", () => {
  const collectStart = roadmap.indexOf("function collect()");
  const collectEnd = roadmap.indexOf("function apply(d)", collectStart);
  const collectBody = roadmap.slice(collectStart, collectEnd);
  ["'liquidity'", "'monthly'", "'cb_amount'", "'bk_amount'", "'baseMonth'"].forEach((field) => {
    assert.doesNotMatch(collectBody, new RegExp(field));
  });
  assert.match(collectBody, /'tasks'|tasks:/);
  assert.match(collectBody, /'notes'/);
});

test("las copias antiguas siguen hidratándose y los campos ambiguos no se migran", () => {
  assert.match(roadmap, /envelope\.state.*\?envelope\.state:envelope/);
  assert.match(roadmap, /Sin migración automática/);
  assert.match(roadmap, /el\.tagName==='SELECT'\)el\.disabled=true/);
});
