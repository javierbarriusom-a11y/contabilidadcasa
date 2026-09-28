const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const legacy = require(path.join(root, "legacy-debt-roadmap-engine.js"));
const html = fs.readFileSync(path.join(root, "debt-roadmap.html"), "utf8");

// D1 (Fase 1, sesión posterior a D6): el sandbox visual de deuda sigue siendo un negociación real
// (Entidad A / Entidad B), así que el hogar pidió ampliarlo en vez de retirarlo o generalizarlo ya:
// (1) una aportación extra puntual por cuenta, independiente de la estrategia elegida, y (2) poder
// comparar su propia configuración manual contra los tres perfiles automáticos A/B/C, no solo verla
// en el resumen aparte. Ambas viven enteras en debt-roadmap.html + legacy-debt-roadmap-engine.js,
// sin tocar app.js ni el puente canónico (eso es Fase 2/3, con su propia decisión y su propio ARQ-4).

function baseConfig(overrides = {}) {
  return {
    baseMonth: "2026-08",
    months: 24,
    capacity: 1000,
    accounts: [{ amount: 6000, strategy: "refi", discount: 0, start: 1, apr: 8, term: 24, financePct: 100, ...overrides }],
  };
}

test("extra puntual: reduce el saldo justo en el mes indicado, no antes ni después", () => {
  const sinExtra = legacy.simulate(baseConfig());
  const conExtra = legacy.simulate(baseConfig({ extra: 1000, extraMonth: 6 }));
  assert.equal(conExtra.rows[4].balances[0], sinExtra.rows[4].balances[0], "mes 5: el saldo no debe cambiar todavía");
  assert.ok(conExtra.rows[5].balances[0] < sinExtra.rows[5].balances[0] - 999, "mes 6: el saldo debe bajar en aproximadamente el importe extra");
});

test("extra puntual: sin declarar extra (0 por defecto) el resultado es idéntico al motor sin el campo", () => {
  const legacyShape = legacy.simulate(baseConfig());
  const explicitZero = legacy.simulate(baseConfig({ extra: 0, extraMonth: 1 }));
  assert.deepEqual(explicitZero.rows.map((r) => r.balances), legacyShape.rows.map((r) => r.balances));
  assert.equal(explicitZero.totalPaid, legacyShape.totalPaid);
  assert.equal(explicitZero.durationMonths, legacyShape.durationMonths);
});

test("extra puntual: nunca deja el saldo negativo si el extra supera lo que queda pendiente", () => {
  const result = legacy.simulate(baseConfig({ extra: 999999, extraMonth: 3 }));
  result.rows.forEach((row) => assert.ok(row.balances[0] >= 0, `saldo negativo en ${row.monthKey}`));
});

test("extra puntual: determinismo — dos ejecuciones con el mismo extra dan el mismo resultado", () => {
  const runA = legacy.simulate(baseConfig({ extra: 500, extraMonth: 4 }));
  const runB = legacy.simulate(baseConfig({ extra: 500, extraMonth: 4 }));
  assert.deepEqual(runA, runB);
});

test("extra puntual: monotonía (I-07) — aportar más extra nunca encarece el total ni retrasa el fin de la deuda", () => {
  const sinExtra = legacy.simulate(baseConfig());
  const conExtra = legacy.simulate(baseConfig({ extra: 1500, extraMonth: 8 }));
  assert.ok(conExtra.totalPaid <= sinExtra.totalPaid + 0.01, `totalPaid subió: ${conExtra.totalPaid} > ${sinExtra.totalPaid}`);
  assert.ok(conExtra.durationMonths <= sinExtra.durationMonths, `duración subió: ${conExtra.durationMonths} > ${sinExtra.durationMonths}`);
});

test("debt-roadmap.html: cada cuenta (Entidad A, Entidad B) tiene sus propios campos de aportación extra puntual", () => {
  assert.match(html, /id="cb_extra"/);
  assert.match(html, /id="cb_extra_month"/);
  assert.match(html, /id="bk_extra"/);
  assert.match(html, /id="bk_extra_month"/);
});

test("debt-roadmap.html: buildAccount(prefix) envía extra/extraMonth al motor", () => {
  const block = html.slice(html.indexOf("function buildAccount(prefix){return legacyDebtEngine"), html.indexOf("function buildAccount(prefix){return legacyDebtEngine") + 400);
  assert.match(block, /extra:num\(prefix\+'_extra'\)/);
  assert.match(block, /extraMonth:num\(prefix\+'_extra_month'\)/);
});

test("debt-roadmap.html: collect() persiste/exporta los cuatro campos nuevos de aportación extra", () => {
  const block = html.slice(html.indexOf("function collect()"), html.indexOf("function collect()") + 400);
  ["cb_extra", "cb_extra_month", "bk_extra", "bk_extra_month"].forEach((id) => {
    assert.match(block, new RegExp(`'${id}'`), `collect() no incluye ${id}`);
  });
});

test("debt-roadmap.html: el comparador de escenarios incluye una cuarta tarjeta con la configuración manual del usuario", () => {
  assert.match(html, /id="cardMine"/);
  assert.match(html, /id="scoreMine"/);
  assert.match(html, /id="listMine"/);
  assert.match(html, /Tu configuración actual/);
});

test("debt-roadmap.html: renderScenarioComparison calcula 'Mine' a partir de currentConfig(), no de un perfil preestablecido", () => {
  const block = html.slice(html.indexOf("function renderScenarioComparison()"), html.indexOf("function renderScenarioComparison()") + 700);
  assert.match(block, /Mine=simulateScenario\(currentConfig\(\)\)/);
  assert.match(block, /map=\{A,B,C,Mine\}/);
});

test("debt-roadmap.html: renderRecommendation sabe nombrar y explicar el caso en que gana 'Mine'", () => {
  const block = html.slice(html.indexOf("function renderRecommendation(best)"), html.indexOf("function renderRecommendation(best)") + 900);
  assert.match(block, /Mine:'Tu configuración actual'/);
});

test("debt-roadmap.html: la rejilla del comparador pasa a 4 columnas sin romper perfil/escenario (que siguen en 3)", () => {
  assert.match(html, /\.profile-grid,\.scenarios\{grid-template-columns:repeat\(3,1fr\)\}/);
  assert.match(html, /\.compare-grid\{grid-template-columns:repeat\(4,1fr\)\}/);
});
