const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// PVC1 (Oleada 3, Bloque 2) · indicador visible de recálculo. Alcance confirmado por VER-1: el
// forecast ya se repropaga a metas (E15) y presupuesto de riesgo (E16) sin abrir esas pantallas
// (recomputeModelIfNeeded() recalcula por firma en cada render() global) — esta tarea no construye
// ningún motor de cascada nuevo, solo hace visible cuándo ocurrió el último recálculo real.

const appSource = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const p2UiSource = fs.readFileSync(path.join(__dirname, "..", "p2-ui.js"), "utf8");

test("recomputeModelIfNeeded marca lastModelRecomputeAt solo cuando recalcula de verdad (no en cada llamada)", () => {
  const block = appSource.slice(appSource.indexOf("function recomputeModelIfNeeded("), appSource.indexOf("function recomputeModelIfNeeded(") + 900);
  const returnIndex = block.indexOf("return;");
  const markIndex = block.indexOf("lastModelRecomputeAt = new Date().toISOString();");
  assert.ok(returnIndex >= 0 && markIndex > returnIndex, "La marca debe quedar después del atajo por firma sin cambios, nunca antes");
});

test("FinanceP2Bridge expone lastModelRecomputeAt", () => {
  const block = appSource.slice(appSource.indexOf("window.FinanceP2Bridge = {"), appSource.indexOf("window.FinanceP2Bridge = {") + 400);
  assert.match(block, /lastModelRecomputeAt: \(\) => lastModelRecomputeAt/);
});

test("recomputedAgoHtml lee del puente P2, sin duplicar el cálculo del recompute", () => {
  const block = p2UiSource.slice(p2UiSource.indexOf("function recomputedAgoHtml("), p2UiSource.indexOf("function recomputedAgoHtml(") + 700);
  assert.match(block, /bridge\(\)\?\.lastModelRecomputeAt\?\.\(\)/);
  assert.match(block, /if \(!iso\) return "";/);
});

test("el panel de metas (E15) muestra el indicador de recálculo", () => {
  const block = p2UiSource.slice(p2UiSource.indexOf("function renderE15Planning("), p2UiSource.indexOf("function renderE15Planning(") + 2000);
  assert.match(block, /\$\{recomputedAgoHtml\(\)\}/);
});

test("el panel de seguimiento predictivo (E16) muestra el indicador de recálculo", () => {
  const block = p2UiSource.slice(p2UiSource.indexOf("function renderE16Monitoring("), p2UiSource.indexOf("function renderE16Monitoring(") + 1600);
  assert.match(block, /\$\{recomputedAgoHtml\(\)\}/);
});

test("no rompe cuando nunca se ha recalculado el modelo en la sesión (iso ausente)", () => {
  const block = p2UiSource.slice(p2UiSource.indexOf("function recomputedAgoHtml("), p2UiSource.indexOf("function recomputedAgoHtml(") + 700);
  // La guarda debe existir antes de tocar new Date(iso) para no lanzar con iso null/undefined.
  const guardIndex = block.indexOf('if (!iso) return "";');
  const dateUseIndex = block.indexOf("new Date(iso)");
  assert.ok(guardIndex >= 0 && guardIndex < dateUseIndex);
});
