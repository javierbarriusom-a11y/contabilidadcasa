const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const app = read("app.js");
const html = read("index.html");
const HealthScore = require("../canonical-health-score.js");

// A16-1 · Bloque 4: puntuación compuesta de salud financiera. Complementa (no sustituye) el badge
// "Salud financiera: X/100" de la cabecera de Hoy, que ya existía (Ola 3 #3, homeHealthScore() —
// ver tests/o3-o4-salud-financiera-y-comparar-escenarios.test.cjs): ese es un promedio rápido de
// estados good/warn/danger sin nombre ni peso por componente. A16-1 pide justo lo que ese diseño
// declaró explícitamente que no construía: cinco componentes nombrados (colchón, ratio
// deuda/ingresos, cumplimiento de presupuesto, progreso de objetivos, frescura de datos), cada uno
// con su peso explícito — mismo patrón de transparencia que A2-6. Se añade como tarjeta nueva en vez
// de sustituir el badge existente para no tocar una pantalla en uso ni su test ya verificado.

function extractFunction(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `No existe la función ${name} en app.js`);
  const parenStart = app.indexOf("(", start);
  let parenDepth = 0;
  let bodyStart = -1;
  for (let index = parenStart; index < app.length; index += 1) {
    if (app[index] === "(") parenDepth += 1;
    else if (app[index] === ")") {
      parenDepth -= 1;
      if (parenDepth === 0) { bodyStart = app.indexOf("{", index); break; }
    }
  }
  assert.ok(bodyStart >= 0, `No se encontró el cuerpo de ${name}`);
  let depth = 0;
  for (let index = bodyStart; index < app.length; index += 1) {
    if (app[index] === "{") depth += 1;
    else if (app[index] === "}") {
      depth -= 1;
      if (depth === 0) return app.slice(start, index + 1);
    }
  }
  throw new Error(`La función ${name} no cierra sus llaves`);
}

function sandboxWith(names, extra = {}) {
  const context = { escapeHtml: (v) => String(v ?? ""), ...extra };
  vm.createContext(context);
  names.forEach((name) => vm.runInContext(extractFunction(name), context));
  return context;
}

// --- Parte A: canonical-health-score.js -----------------------------------------------------

test("compositeHealthScore · con los cinco componentes conocidos, media ponderada (pesos iguales)", () => {
  const result = HealthScore.compositeHealthScore({
    cushion: 1, debtRatio: 0.5, budgetCompliance: 1, goalsProgress: 0.5, dataFreshness: 1,
  });
  assert.equal(result.value, 80); // (100+50+100+50+100)/5
  assert.equal(result.complete, true);
  assert.deepEqual(result.missing, []);
  assert.equal(result.components.length, 5);
});

test("compositeHealthScore · un componente desconocido no cuenta como cero, se excluye y redistribuye su peso", () => {
  const result = HealthScore.compositeHealthScore({
    cushion: 1, debtRatio: 1, budgetCompliance: 1, goalsProgress: null, dataFreshness: 1,
  });
  assert.equal(result.value, 100); // los cuatro conocidos están todos a 1, sin objetivos no penaliza
  assert.equal(result.complete, false);
  assert.deepEqual(result.missing, ["goalsProgress"]);
});

test("compositeHealthScore · sin ningún componente conocido, no fabrica una cifra", () => {
  const result = HealthScore.compositeHealthScore({});
  assert.equal(result.value, null);
  assert.equal(result.complete, false);
  assert.equal(result.missing.length, 5);
});

test("compositeHealthScore · recorta valores fuera de 0-1 en vez de romper el cálculo", () => {
  const result = HealthScore.compositeHealthScore({
    cushion: 1.5, debtRatio: -0.3, budgetCompliance: 1, goalsProgress: 1, dataFreshness: 1,
  });
  const cushion = result.components.find((c) => c.id === "cushion");
  const debtRatio = result.components.find((c) => c.id === "debtRatio");
  assert.equal(cushion.score, 100);
  assert.equal(debtRatio.score, 0);
});

test("compositeHealthScore · cada componente declara su etiqueta y su peso", () => {
  const result = HealthScore.compositeHealthScore({ cushion: 1 });
  const cushion = result.components.find((c) => c.id === "cushion");
  assert.equal(cushion.label, "Colchón de liquidez");
  assert.equal(cushion.weight, 0.2);
});

// --- Parte B: homeHealthScoreComponents() (app.js) ------------------------------------------

function componentsSandbox(ctx, { budgetSummary = null, activeGoals = [], freshnessPercent = null } = {}) {
  const context = sandboxWith(["homeHealthScoreComponents"], {
    homeBudgetSummary: () => budgetSummary,
    dataFreshnessReport: () => (freshnessPercent === null ? null : { coveragePercent: freshnessPercent }),
    p2: { goals: activeGoals },
    window: { P2Domain: { goalSnapshot: (goal) => goal } },
  });
  return context.homeHealthScoreComponents(ctx);
}

test("homeHealthScoreComponents · colchón es la cobertura de caixa sobre la reserva protegida, capada en 1", () => {
  const result = componentsSandbox({ caixa: 3000, protectedReserve: 1000 });
  assert.equal(result.cushion, 1); // 3000/1000 = 3, capado a 1
});

test("homeHealthScoreComponents · sin reserva configurada, el colchón es desconocido, no cero", () => {
  const result = componentsSandbox({ caixa: 3000, protectedReserve: 0 });
  assert.equal(result.cushion, null);
});

test("homeHealthScoreComponents · ratio deuda/ingresos usa el umbral configurado en Ajustes › Alertas", () => {
  const result = componentsSandbox({ debtToIncomeRatio: 0.16, debtRatioDangerAt: 0.32 });
  assert.equal(result.debtRatio, 0.5); // a mitad del umbral de peligro
});

test("homeHealthScoreComponents · cumplimiento de presupuesto sale de homeBudgetSummary(), sin recalcular", () => {
  const result = componentsSandbox({}, { budgetSummary: { totalBudgeted: 800, totalSpent: 1000 } });
  assert.equal(result.budgetCompliance, 0.8);
});

test("homeHealthScoreComponents · sin gasto todavía este mes, cumplimiento pleno", () => {
  const result = componentsSandbox({}, { budgetSummary: { totalBudgeted: 800, totalSpent: 0 } });
  assert.equal(result.budgetCompliance, 1);
});

test("homeHealthScoreComponents · progreso de objetivos pondera por importe, solo objetivos activos", () => {
  const result = componentsSandbox({}, {
    activeGoals: [
      { status: "active", target: 1000, saved: 500 },
      { status: "active", target: 3000, saved: 3000 },
      { status: "completed", target: 500, saved: 0 },
    ],
  });
  assert.equal(result.goalsProgress, 0.875); // (500+3000) / (1000+3000)
});

test("homeHealthScoreComponents · sin objetivos activos, el progreso es desconocido, no cero", () => {
  const result = componentsSandbox({}, { activeGoals: [] });
  assert.equal(result.goalsProgress, null);
});

test("homeHealthScoreComponents · frescura de datos sale de dataFreshnessReport().coveragePercent", () => {
  const result = componentsSandbox({}, { freshnessPercent: 75 });
  assert.equal(result.dataFreshness, 0.75);
});

// --- Parte C: renderHomeHealthScoreCard() (app.js) ------------------------------------------

function cardSandbox() {
  const elements = {
    homeHealthScoreCard: { hidden: false },
    homeHealthScoreValue: { textContent: "" },
    homeHealthScoreBreakdown: { innerHTML: "" },
  };
  const context = sandboxWith(["renderHomeHealthScoreCard"], { qs: (id) => elements[id] || null });
  return { context, elements };
}

test("renderHomeHealthScoreCard · sin resultado o sin cifra, oculta la tarjeta", () => {
  const { context, elements } = cardSandbox();
  context.renderHomeHealthScoreCard(null);
  assert.equal(elements.homeHealthScoreCard.hidden, true);
  context.renderHomeHealthScoreCard({ value: null, components: [], complete: true, missing: [] });
  assert.equal(elements.homeHealthScoreCard.hidden, true);
});

test("renderHomeHealthScoreCard · con resultado, muestra la tarjeta, la cifra y cada componente con su peso", () => {
  const { context, elements } = cardSandbox();
  context.renderHomeHealthScoreCard({
    value: 80, complete: true, missing: [],
    components: [{ id: "cushion", label: "Colchón de liquidez", weight: 0.2, score: 100 }],
  });
  assert.equal(elements.homeHealthScoreCard.hidden, false);
  assert.equal(elements.homeHealthScoreValue.textContent, "80");
  assert.match(elements.homeHealthScoreBreakdown.innerHTML, /Colchón de liquidez/);
  assert.match(elements.homeHealthScoreBreakdown.innerHTML, /peso 20%/);
  assert.match(elements.homeHealthScoreBreakdown.innerHTML, /100\/100/);
});

test("renderHomeHealthScoreCard · puntuación parcial avisa cuántos componentes faltan", () => {
  const { context, elements } = cardSandbox();
  context.renderHomeHealthScoreCard({
    value: 80, complete: false, missing: ["goalsProgress"],
    components: [{ id: "cushion", label: "Colchón de liquidez", weight: 0.2, score: 100 }],
  });
  assert.match(elements.homeHealthScoreBreakdown.innerHTML, /Puntuación parcial/);
});

// --- Parte D: cableado en renderHomeDashboard() y en el documento ---------------------------

test("renderHomeDashboard calcula y pinta la puntuación compuesta reutilizando los locals ya calculados", () => {
  const source = extractFunction("renderHomeDashboard");
  assert.match(source, /homeHealthScoreComponents\(\{/);
  assert.match(source, /caixa: balances\.caixa, protectedReserve, debtToIncomeRatio: savings\.debtToIncomeRatio, debtRatioDangerAt/);
  assert.match(source, /renderHomeHealthScoreCard\(window\.FinanceCanonicalHealthScore\?\.compositeHealthScore\(compositeInputs\)\)/);
});

test("la tarjeta vive en #home, oculta por defecto", () => {
  const openTag = /<section[^>]*id="home"[^>]*>/.exec(html);
  assert.ok(openTag, "No existe la sección #home");
  const start = openTag.index + openTag[0].length;
  const end = html.indexOf("<section", start);
  const home = html.slice(start, end);
  assert.match(home, /id="homeHealthScoreCard"[^>]*hidden/);
  assert.match(home, /id="homeHealthScoreValue"/);
  assert.match(home, /id="homeHealthScoreBreakdown"/);
});

test("el motor canónico está registrado en index.html y en la whitelist del sitio público", () => {
  assert.match(html, /canonical-health-score\.js\?v=/);
  const buildScript = read("tools/build-public-site.mjs");
  assert.match(buildScript, /"canonical-health-score\.js"/);
});

test("homeHealthScore() (Ola 3 #3) sigue existiendo tal cual — A16-1 se añade, no lo sustituye", () => {
  assert.match(app, /function homeHealthScore\(statuses = \[\]\)/);
  assert.match(app, /health: homeHealthScore\(\[adjustedStatus, debtRatioStatus, freeCapacityStatus, reserveStatus, riskStatus, coverageStatus\]\)/);
});
