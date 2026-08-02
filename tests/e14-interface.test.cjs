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
