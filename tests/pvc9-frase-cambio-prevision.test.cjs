const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const F = require("../canonical-forecast.js");

// PVC9 (Oleada 3, Bloque 5): combina el árbol causal de una cifra (PVX5) con el detector de cambio
// estructural (PVC3) en una frase — nunca inventa un "por qué" cuando PVC3 ya descartó el cambio
// como ruido o no hay muestra suficiente.

test("previsionChangeOneLiner · sin muestra suficiente, lo dice explícitamente", () => {
  const result = F.previsionChangeOneLiner(null, { reason: "insufficient-sample" });
  assert.match(result, /no hay suficientes meses/);
});

test("previsionChangeOneLiner · sin cambio estructural, nunca inventa un motivo", () => {
  const result = F.previsionChangeOneLiner({ calculable: true, label: "x", branches: [] }, { isStructural: false, reason: "within-band" });
  assert.match(result, /no muestra un cambio estructural sostenido/);
  assert.doesNotMatch(result, /componente que más pesa/);
});

test("previsionChangeOneLiner · cambio estructural sin árbol causal calculable, solo dice dirección y meses", () => {
  const result = F.previsionChangeOneLiner({ calculable: false }, { isStructural: true, direction: "up", requiredConsecutiveMonths: 3 });
  assert.match(result, /ha subido de forma sostenida en los últimos 3 meses seguidos\.$/);
});

test("previsionChangeOneLiner · cambio estructural con árbol causal, cita el componente que más pesa en euros", () => {
  const tree = {
    calculable: true,
    label: "Marzo 2026",
    branches: [
      { label: "Ingresos", leaves: [{ label: "Recurrente", amount: 50 }] },
      { label: "Salidas (antes de ahorro)", leaves: [{ label: "Ajuste manual", amount: -300 }, { label: "Deuda", amount: 100 }] },
    ],
  };
  const result = F.previsionChangeOneLiner(tree, { isStructural: true, direction: "down", requiredConsecutiveMonths: 3 });
  assert.match(result, /ha bajado de forma sostenida en los últimos 3 meses seguidos/);
  assert.match(result, /"Ajuste manual"/);
  assert.match(result, /Marzo 2026/);
});

test("previsionChangeOneLiner está exportada", () => {
  assert.equal(typeof F.previsionChangeOneLiner, "function");
});

// --- Wiring ---

const appSource = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const indexSource = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

test("wiring: la frase de PVC9 vive dentro de la tarjeta del árbol causal de PVX5", () => {
  const cardStart = indexSource.indexOf("Árbol causal de una cifra");
  const oneLinerPos = indexSource.indexOf('id="pvc9OneLiner"');
  const treePos = indexSource.indexOf('id="pvx5CausalTree"');
  assert.ok(cardStart >= 0 && oneLinerPos > cardStart && oneLinerPos < treePos, "pvc9OneLiner debe vivir en la misma tarjeta, antes del árbol");
});

test("wiring: renderPvx5CausalTree calcula la frase con el mismo tree y detectStructuralChange", () => {
  const start = appSource.indexOf("function renderPvx5CausalTree(");
  const block = appSource.slice(start, start + 1200);
  assert.match(block, /engine\.detectStructuralChange\(reconciledMonthlyNetHistory\(\)\)/);
  assert.match(block, /engine\.previsionChangeOneLiner\(tree, structuralChange\)/);
});
