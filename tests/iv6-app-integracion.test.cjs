const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const appSource = fs.readFileSync(require.resolve("../app.js"), "utf8");
const indexSource = fs.readFileSync(require.resolve("../index.html"), "utf8");

test("IV6: la tarjeta de Ajustes tiene los cinco campos de objetivo por tipo y el contenedor de rebalanceo", () => {
  ["iv6TargetFondo", "iv6TargetAccion", "iv6TargetEtf", "iv6TargetCripto", "iv6TargetOtro", "iv6RebalanceSummary"].forEach((id) => {
    assert.match(indexSource, new RegExp(`id="${id}"`));
  });
});

test("IV6: saveIv6Targets guarda solo los objetivos declarados (>0) en scenarioSettings.portfolioTargets", () => {
  const block = appSource.slice(appSource.indexOf("function saveIv6Targets"), appSource.indexOf("function saveIv6Targets") + 500);
  assert.match(block, /scenarioSettings\.portfolioTargets = targets;/);
  assert.match(block, /if \(value > 0\) targets\[type\] = value;/);
});

test("IV6: renderIv6Rebalance llama a engine.rebalanceSuggestions con los totales y objetivos", () => {
  const block = appSource.slice(appSource.indexOf("function renderIv6Rebalance"), appSource.indexOf("function renderIv6Rebalance") + 900);
  assert.match(block, /engine\.rebalanceSuggestions\(result\.summary\.totalsByType, result\.summary\.totalValue, targets\)/);
});

test("IV6: sin posiciones o sin objetivos, la tarjeta queda neutra sin romper el cálculo", () => {
  const block = appSource.slice(appSource.indexOf("function renderIv6Rebalance"), appSource.indexOf("function renderIv6Rebalance") + 900);
  assert.match(block, /Registra al menos una posición/);
  assert.match(block, /Fija al menos un objetivo por tipo/);
});
