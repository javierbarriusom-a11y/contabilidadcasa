const test = require("node:test");
const assert = require("node:assert/strict");

const Portfolio = require("../canonical-portfolio.js");

// LEV6 (Oleada 3, Bloque 4): plan de desapalancamiento con prioridad. Decisión del hogar (sesión
// 159): el tercer criterio ("mayor correlación con el resto del patrimonio", sin histórico real que
// lo sostenga) se sustituye por "misma clase de activo ya sobreexpuesta" — reutiliza
// rebalanceSuggestions (IV6) en vez de un motor de correlación nuevo. Prioridad: 1) sobreexpuesta
// primero, 2) menor coste fiscal, 3) menor convicción declarada.

test("deleveragingPriority · sin posiciones con valor positivo, no calculable", () => {
  const result = Portfolio.deleveragingPriority({ positions: [] });
  assert.equal(result.calculable, false);
});

test("deleveragingPriority · una posición sobreexpuesta (tipo por encima del objetivo) se prioriza sobre una que no lo está", () => {
  const positions = [
    { id: "p1", label: "Fondo A", type: "fondo", currentValue: 8000, gainLoss: 0 },
    { id: "p2", label: "Acción B", type: "accion", currentValue: 2000, gainLoss: 0 },
  ];
  const result = Portfolio.deleveragingPriority({
    positions,
    totalsByType: { fondo: 8000, accion: 2000 },
    totalValue: 10000,
    targets: { fondo: 50, accion: 50 },
  });
  assert.equal(result.calculable, true);
  assert.equal(result.rows[0].id, "p1");
  assert.equal(result.rows[0].overexposed, true);
  assert.equal(result.rows[0].priorityRank, 1);
  assert.equal(result.rows[1].overexposed, false);
});

test("deleveragingPriority · entre dos igualmente (no) sobreexpuestas, prioriza el menor coste fiscal", () => {
  const positions = [
    { id: "cara", label: "Con plusvalía grande", type: "fondo", currentValue: 5000, gainLoss: 4000 },
    { id: "barata", label: "Con plusvalía pequeña", type: "fondo", currentValue: 5000, gainLoss: 500 },
  ];
  const result = Portfolio.deleveragingPriority({
    positions,
    totalsByType: { fondo: 10000 },
    totalValue: 10000,
    targets: {},
    savingsTaxRatePct: 20,
  });
  assert.equal(result.rows[0].id, "barata");
  assert.equal(result.rows[0].taxCost, 100);
  assert.equal(result.rows[1].id, "cara");
  assert.equal(result.rows[1].taxCost, 800);
});

test("deleveragingPriority · una posición en pérdidas no paga coste fiscal (nunca negativo)", () => {
  const positions = [{ id: "p1", label: "En pérdidas", type: "fondo", currentValue: 3000, gainLoss: -1000 }];
  const result = Portfolio.deleveragingPriority({ positions, savingsTaxRatePct: 20 });
  assert.equal(result.rows[0].taxCost, 0);
});

test("deleveragingPriority · sin tipo del ahorro declarado, el coste fiscal se trata como 0 (nunca 'desconocido')", () => {
  const positions = [{ id: "p1", label: "Con plusvalía", type: "fondo", currentValue: 3000, gainLoss: 1000 }];
  const result = Portfolio.deleveragingPriority({ positions });
  assert.equal(result.rows[0].taxCost, 0);
});

test("deleveragingPriority · a igualdad de sobreexposición y coste fiscal, desempata por menor convicción declarada", () => {
  const positions = [
    { id: "alta-conviccion", label: "Alta convicción", type: "fondo", currentValue: 3000, gainLoss: 0, convictionScore: 5 },
    { id: "baja-conviccion", label: "Baja convicción", type: "fondo", currentValue: 3000, gainLoss: 0, convictionScore: 1 },
  ];
  const result = Portfolio.deleveragingPriority({ positions });
  assert.equal(result.rows[0].id, "baja-conviccion");
  assert.equal(result.rows[1].id, "alta-conviccion");
});

test("deleveragingPriority · una posición sin convicción declarada queda por detrás de las que sí la declaran, a igualdad de lo demás", () => {
  const positions = [
    { id: "sin-declarar", label: "Sin declarar", type: "fondo", currentValue: 3000, gainLoss: 0 },
    { id: "declarada", label: "Declarada", type: "fondo", currentValue: 3000, gainLoss: 0, convictionScore: 5 },
  ];
  const result = Portfolio.deleveragingPriority({ positions });
  assert.equal(result.rows[0].id, "declarada");
  assert.equal(result.rows[1].id, "sin-declarar");
  assert.equal(result.rows[1].convictionScore, null);
});

test("deleveragingPriority · ignora posiciones sin valor positivo", () => {
  const positions = [
    { id: "activa", label: "Activa", type: "fondo", currentValue: 1000, gainLoss: 0 },
    { id: "liquidada", label: "Liquidada", type: "fondo", currentValue: 0, gainLoss: 0 },
  ];
  const result = Portfolio.deleveragingPriority({ positions });
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].id, "activa");
});

test("normalizePosition acepta convictionScore declarado, recortado a 1-5, null si no se declara", () => {
  const withScore = Portfolio.normalizePosition({ id: "p1", label: "A", currentValue: 1000, convictionScore: 8 });
  assert.equal(withScore.convictionScore, 5);
  const withoutScore = Portfolio.normalizePosition({ id: "p2", label: "B", currentValue: 1000 });
  assert.equal(withoutScore.convictionScore, null);
});

test("deleveragingPriority está exportado", () => {
  assert.equal(typeof Portfolio.deleveragingPriority, "function");
});

// --- Wiring ---

const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const appSource = fs.readFileSync(path.join(root, "app.js"), "utf8");
const indexSource = fs.readFileSync(path.join(root, "index.html"), "utf8");

test("wiring: el formulario de posiciones (IV1) tiene un campo de convicción", () => {
  assert.match(indexSource, /id="iv1PositionConvictionScore"/);
});

test("wiring: saveIv1Position guarda convictionScore en el registro de la posición", () => {
  const start = appSource.indexOf("function saveIv1Position(");
  const block = appSource.slice(start, start + 2400);
  assert.match(block, /iv1PositionConvictionScore/);
  assert.match(block, /convictionScore/);
});

test("wiring: renderLev6DeleveragingPriority usa deleveragingPriority, normalizePositions y el tipo del ahorro de FC4", () => {
  const start = appSource.indexOf("function renderLev6DeleveragingPriority(");
  assert.ok(start >= 0, "No existe renderLev6DeleveragingPriority");
  const block = appSource.slice(start, start + 1200);
  assert.match(block, /engine\.normalizePositions\(/);
  assert.match(block, /engine\.deleveragingPriority\(/);
  assert.match(block, /dividendSpanishSavingsRatePct\(\)/);
  assert.match(block, /iv6PortfolioTargets\(\)/);
});

// OPT-25 (fase 4, 11 sept. 2026): LEV6 se trasladó de Ajustes › Patrimonio e inversión a
// Herramientas avanzadas → Patrimonio e inversión (#herramientas-patrimonio); IV6 (objetivos de
// reparto) se queda en Ajustes. Ya no son adyacentes en el DOM ni viven en la misma pantalla, así
// que la tarjeta enlaza explícitamente a dónde se declaran los objetivos que consulta, en vez de
// depender de un orden de documento que ya no refleja la relación entre ambas.
test("wiring: la tarjeta de LEV6 vive en Herramientas avanzadas → Patrimonio e inversión y enlaza a los objetivos de reparto de IV6 en Ajustes (OPT-24: en su propia tarjeta de Herramientas, no fusionada con la de IV6)", () => {
  const patrimonioTools = /<section class="e19-asesor-decision view-section" id="herramientas-patrimonio">/.exec(indexSource);
  assert.ok(patrimonioTools, "No existe la sección herramientas-patrimonio");
  const start = patrimonioTools.index + patrimonioTools[0].length;
  const end = indexSource.indexOf("</section>", start);
  const herramientasPatrimonio = indexSource.slice(start, end);
  const lev6TitlePos = herramientasPatrimonio.indexOf("Al desapalancar, ¿qué vender primero?");
  const lev6Pos = herramientasPatrimonio.indexOf('id="lev6DeleveragingNote"');
  assert.ok(lev6TitlePos >= 0, "LEV6 debe vivir en Herramientas avanzadas → Patrimonio e inversión");
  assert.ok(lev6Pos > lev6TitlePos, "lev6DeleveragingNote debe vivir dentro de la tarjeta de LEV6");
  assert.match(herramientasPatrimonio.slice(lev6TitlePos, lev6Pos + 50), /objetivo de reparto declarado en.*Ajustes/);

  const ajustesGroup = /<div class="e19-ajustes-group" id="ajustes-patrimonio"[^>]*>/.exec(indexSource);
  assert.ok(ajustesGroup, "No existe el grupo ajustes-patrimonio");
  const ajustesStart = ajustesGroup.index + ajustesGroup[0].length;
  const ajustesEnd = indexSource.indexOf('<div class="e19-ajustes-group"', ajustesStart);
  assert.match(indexSource.slice(ajustesStart, ajustesEnd), /id="iv6RebalanceSummary"/, "IV6 debe seguir en Ajustes › Patrimonio e inversión");
});

test("wiring: renderLev6DeleveragingPriority se llama junto a renderIv6Rebalance en cada mutación relevante", () => {
  const occurrences = appSource.split("renderIv6Rebalance();\n  renderLev6DeleveragingPriority();").length - 1;
  assert.ok(occurrences >= 7, `Se esperaban al menos 7 sitios donde LEV6 se recalcula junto a IV6, encontrados: ${occurrences}`);
});
