const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const P = require("../canonical-portfolio.js");

// FIN-1 (BACKLOG_CONTABILIDADCASA_3_0.md §2.5): la auditoría previa encontró que DEB15
// (cancelación de deuda), AP3/AP4/AP6 (apalancamiento) e INV7 (escalera de liquidez) ya comparten
// exactamente el mismo guardarraíl — FinanceCanonicalCushion.cushionFloor(lastSimulation,
// cuadroMandosReserve()).value —, pero el rebalanceo de inversión (IV6) no consultaba ninguno: podía
// sugerir vender liquidez inmediata para comprar un tipo bloqueado (p. ej. plan de pensiones) sin
// avisar de que eso rompe la cobertura del colchón que INV7 (pestaña Inversión · Cartera) dice
// garantizada hoy. rebalanceLiquidityGuardrail() cierra ese hueco proyectando liquidityLadder()
// sobre la composición que dejaría la sugerencia de IV6, reutilizando el mismo motor de INV7 sin
// duplicarlo.

// --- rebalanceLiquidityGuardrail (motor puro) -----------------------------------------------------

test("rebalanceLiquidityGuardrail · sin sugerencias, el proyectado es idéntico al actual", () => {
  const totals = { accion: 1000, "plan-pension": 500 };
  const result = P.rebalanceLiquidityGuardrail(totals, [], 800);
  assert.deepEqual(result.projected.tiers, result.current.tiers);
  assert.equal(result.worsens, false);
});

test("rebalanceLiquidityGuardrail · las filas «ok» no mueven nada entre tramos", () => {
  const totals = { accion: 1000, "plan-pension": 500 };
  const suggestions = [
    { type: "accion", action: "ok", amount: 12 },
    { type: "plan-pension", action: "ok", amount: -12 },
  ];
  const result = P.rebalanceLiquidityGuardrail(totals, suggestions, 800);
  assert.deepEqual(result.projected.tiers, result.current.tiers);
});

test("rebalanceLiquidityGuardrail · vender de inmediata para comprar bloqueada puede romper la cobertura del colchón", () => {
  // Hoy: 1000 en acción (inmediata) cubre de sobra un colchón de 800.
  const totals = { accion: 1000 };
  // IV6 sugiere vender 900 de acción para comprar 900 de plan-pension (bloqueada).
  const suggestions = [
    { type: "accion", action: "vender", amount: -900 },
    { type: "plan-pension", action: "comprar", amount: 900 },
  ];
  const result = P.rebalanceLiquidityGuardrail(totals, suggestions, 800);
  assert.equal(result.current.floorCovered, true);
  assert.equal(result.projected.floorCovered, false);
  assert.equal(result.worsens, true);
});

test("rebalanceLiquidityGuardrail · un rebalanceo entre dos tipos igual de líquidos no empeora nada", () => {
  // acción y ETF son ambos "inmediata": mover dinero entre ellos no cambia la escalera.
  const totals = { accion: 1000, etf: 200 };
  const suggestions = [
    { type: "accion", action: "vender", amount: -300 },
    { type: "etf", action: "comprar", amount: 300 },
  ];
  const result = P.rebalanceLiquidityGuardrail(totals, suggestions, 800);
  assert.equal(result.worsens, false);
  assert.equal(result.projected.floorCovered, true);
});

test("rebalanceLiquidityGuardrail · si el colchón ya estaba descubierto antes del rebalanceo, no cuenta como algo que la sugerencia empeora", () => {
  const totals = { accion: 100 };
  const suggestions = [
    { type: "accion", action: "vender", amount: -50 },
    { type: "plan-pension", action: "comprar", amount: 50 },
  ];
  const result = P.rebalanceLiquidityGuardrail(totals, suggestions, 800);
  assert.equal(result.current.floorCovered, false);
  assert.equal(result.projected.floorCovered, false);
  assert.equal(result.worsens, false, "worsens solo marca un colchón que pasa de cubierto a no cubierto");
});

test("rebalanceLiquidityGuardrail · un tipo sin total previo (undefined) se trata como 0, sin lanzar", () => {
  const suggestions = [{ type: "plan-pension", action: "comprar", amount: 500 }];
  assert.doesNotThrow(() => P.rebalanceLiquidityGuardrail({}, suggestions, 800));
});

test("rebalanceLiquidityGuardrail · sugerencias nulas o mal formadas no rompen el cálculo", () => {
  const totals = { accion: 1000 };
  assert.doesNotThrow(() => P.rebalanceLiquidityGuardrail(totals, [null, undefined, {}], 800));
});

test("rebalanceLiquidityGuardrail está exportada", () => {
  assert.equal(typeof P.rebalanceLiquidityGuardrail, "function");
});

// --- Wiring: renderIv6Rebalance usa el mismo cushionFloor que DEB15/AP3/AP4/AP6/INV7 --------------

const appSource = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");

const SHARED_CUSHION_EXPRESSION = "cushionFloor(lastSimulation, cuadroMandosReserve())";

function renderIv6RebalanceBlock() {
  const start = appSource.indexOf("function renderIv6Rebalance(");
  assert.ok(start >= 0, "No existe renderIv6Rebalance");
  const end = appSource.indexOf("\nfunction ", start + 1);
  return appSource.slice(start, end);
}

test("FIN-1 · renderIv6Rebalance calcula el colchón con la misma expresión que ya usan DEB15/AP3/AP4/AP6/INV7", () => {
  const block = renderIv6RebalanceBlock();
  assert.match(block, new RegExp(SHARED_CUSHION_EXPRESSION.replace(/[.()]/g, "\\$&")));
  assert.match(block, /engine\.rebalanceLiquidityGuardrail\(result\.summary\.totalsByType, suggestions, floor\)/);
});

test("FIN-1 · el aviso de IV6 solo aparece cuando el guardarraíl marca «worsens»", () => {
  const block = renderIv6RebalanceBlock();
  assert.match(block, /if \(guardrail\.worsens\)/);
  assert.match(block, /dejaría de cubrir tu colchón mínimo/);
});

test("FIN-1 · sin FinanceCanonicalCushion cargado, renderIv6Rebalance no lanza (nunca bloquea la sugerencia)", () => {
  const block = renderIv6RebalanceBlock();
  assert.match(block, /if \(cushionEngine\) \{/, "el cálculo del guardarraíl debe quedar detrás de una guarda, no asumir que el motor está cargado");
});

test("FIN-1 · el guardarraíl único ya cubre cancelación de deuda, apalancamiento, INV7 y ahora también rebalanceo (IV6)", () => {
  const matches = appSource.match(new RegExp(SHARED_CUSHION_EXPRESSION.replace(/[.()]/g, "\\$&"), "g")) || [];
  // DEB15 (deb9Synthesize + handleAp1Compare, 5 llamadas), AP3 (ap3LeverageBarrierInput), AP6
  // (ap6SustainabilityInput), INV7 (renderInv7LiquidityLadder) e IV6 (renderIv6Rebalance, nuevo) —
  // más otros puntos ya existentes (Hoy, Registrar...). El número exacto no importa tanto como que
  // siga habiendo un número saneado de usos de la MISMA expresión, nunca una copia con drift.
  assert.ok(matches.length >= 10, `se esperaban al menos 10 usos de la misma expresión de colchón compartida, hay ${matches.length}`);
});
