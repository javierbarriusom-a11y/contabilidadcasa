const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// GOB4 (Oleada 3, Bloque 3): vista por titular en hogar compartido. "Mis metas, mi deuda, mi
// aportación" separado de la vista agregada, sobre el mismo reparto por titular (javi/tere/hogar)
// que ya usan las metas (goal.owner) y la deuda (bridge().debts()/p2DebtRows, mismo campo `owner`
// que ya usa DEB1/AP5) — sin dato nuevo que declarar, solo un filtro de solo lectura.

const p2UiSource = fs.readFileSync(path.join(__dirname, "..", "p2-ui.js"), "utf8");

test("gob4MemberGoals filtra por goal.owner, sin motor propio", () => {
  const block = p2UiSource.slice(p2UiSource.indexOf("function gob4MemberGoals("), p2UiSource.indexOf("function gob4MemberGoals(") + 250);
  assert.match(block, /state\(\)\.goals\.filter\(\(goal\) => goal\.owner === owner\)/);
  assert.match(block, /domain\(\)\.goalSnapshot\(goal\)/);
});

test("gob4MemberDebts reutiliza bridge().debts() (mismo p2DebtRows que DEB1/AP5), sin motor propio", () => {
  const block = p2UiSource.slice(p2UiSource.indexOf("function gob4MemberDebts("), p2UiSource.indexOf("function gob4MemberDebts(") + 250);
  assert.match(block, /bridge\(\)\?\.debts\(\)/);
  assert.match(block, /row\.owner === owner/);
});

test("gob4MemberContribution suma las aportaciones reales de las metas ya filtradas, sin motor nuevo", () => {
  const block = p2UiSource.slice(p2UiSource.indexOf("function gob4MemberContribution("), p2UiSource.indexOf("function gob4MemberContribution(") + 300);
  assert.match(block, /goal\.contributions\.reduce\(/);
});

function gob4RenderFunctionBody() {
  const start = p2UiSource.indexOf("function renderGob4MemberView(");
  const end = p2UiSource.indexOf("\n  function renderBehavior(", start);
  return p2UiSource.slice(start, end);
}

test("renderGob4MemberView nunca incluye 'household' — es la vista de un titular en particular, no la agregada", () => {
  const block = gob4RenderFunctionBody();
  assert.match(block, /\["javi", "tere"\]/);
  assert.doesNotMatch(block, /"household"/);
});

test("renderGob4MemberView se monta en 'home', visible sin entrar en Ajustes", () => {
  const block = gob4RenderFunctionBody();
  assert.match(block, /mount\("home", "gob4-member-view"/);
});

test("cambiar el titular reconstruye el panel completo con el nuevo filtro", () => {
  const block = gob4RenderFunctionBody();
  assert.match(block, /gob4SelectedMember = event\.target\.value === "tere" \? "tere" : "javi";/);
  assert.match(block, /renderGob4MemberView\(\);/);
});

test("la vista se renderiza al entrar en 'home', junto al seguimiento predictivo (E16)", () => {
  assert.match(p2UiSource, /if \(viewId === "home"\) \{ renderE16Monitoring\(\); renderGob4MemberView\(\); \}/);
});
