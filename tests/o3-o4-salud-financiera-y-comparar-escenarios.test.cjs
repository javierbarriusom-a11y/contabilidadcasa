/**
 * tests/o3-o4-salud-financiera-y-comparar-escenarios.test.cjs
 *
 * Ola 3 del plan de mejora post-E20 (ver BACKLOG.md §9 / artefacto "Revisión del Plan de Mejora"),
 * candidatas #3 y #4, 28/08/2026.
 *
 * #3 · "Puntuación única de salud financiera": no hay motor nuevo — homeHealthScore() combina los
 * mismos estados categóricos (good/warn/danger) que ya clasifica cada KPI de Hoy, incluida la
 * cobertura del fondo de emergencia (coverageStatus), que se calculaba pero no entraba en ningún
 * agregado (ni siquiera en el pill de homeOverallStatus). good=100/warn=50/danger=0, media simple.
 * Sin estados que combinar, no hay puntuación (null) — nunca un número inventado.
 *
 * #4 · "Comparar más de dos escenarios guardados": E-12 estaba fijo a un par (dos <select>) por la
 * UI, no por el motor — runEscenarioMotor()/escenarioMotorSummaryFor() ya eran genéricos por
 * escenario. Se sustituyen los dos selects por una lista de checkboxes
 * (escenarioMotorCompareCandidates() reutilizada tal cual) y la tabla acepta cualquier número de
 * columnas (escenarioMotorCompareTableHtml, ver también tests/e1-e1b-escenarios-tipos-nuevos.test.cjs
 * para el formateo de la tabla en sí).
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

function extractFunction(name) {
  let start = app.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `No existe la función ${name} en app.js`);
  let parenDepth = 0;
  let bodyStart = -1;
  for (let index = app.indexOf("(", start); index < app.length; index += 1) {
    if (app[index] === "(") parenDepth += 1;
    else if (app[index] === ")") {
      parenDepth -= 1;
      if (parenDepth === 0) {
        bodyStart = app.indexOf("{", index);
        break;
      }
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

function fakeEl(overrides = {}) {
  return { innerHTML: "", hidden: false, ...overrides };
}

// --- Parte A: homeHealthScore ---------------------------------------------------------------

test("#3 · homeHealthScore: todo en buen estado da 100", () => {
  const { homeHealthScore } = sandboxWith(["homeHealthScore"]);
  const health = homeHealthScore(["good", "good", "good"]);
  assert.equal(health.score, 100);
  assert.equal(health.good, 3);
  assert.equal(health.warn, 0);
  assert.equal(health.danger, 0);
});

test("#3 · homeHealthScore: todo en riesgo da 0", () => {
  const { homeHealthScore } = sandboxWith(["homeHealthScore"]);
  const health = homeHealthScore(["danger", "danger"]);
  assert.equal(health.score, 0);
  assert.equal(health.danger, 2);
});

test("#3 · homeHealthScore: mezcla de estados hace la media simple y cuenta cada tono", () => {
  const { homeHealthScore } = sandboxWith(["homeHealthScore"]);
  // good=100, warn=50, danger=0 → (100+100+50+50+50+0)/6 = 350/6 = 58.33 → redondeado 58.
  const health = homeHealthScore(["good", "good", "warn", "warn", "warn", "danger"]);
  assert.equal(health.score, 58);
  assert.equal(health.good, 2);
  assert.equal(health.warn, 3);
  assert.equal(health.danger, 1);
});

test("#3 · homeHealthScore: sin estados que combinar no fabrica una cifra, devuelve null", () => {
  const { homeHealthScore } = sandboxWith(["homeHealthScore"]);
  assert.equal(homeHealthScore([]), null);
  assert.equal(homeHealthScore(), null);
});

test("#3 · homeHealthScore: ignora valores que no son good/warn/danger", () => {
  const { homeHealthScore } = sandboxWith(["homeHealthScore"]);
  const health = homeHealthScore(["good", "good", "sin-datos", undefined]);
  assert.equal(health.score, 100);
  assert.equal(health.good + health.warn + health.danger, 2);
});

// --- Parte B: renderHomeHeaderMeta con el badge de salud -------------------------------------

test("#3 · renderHomeHeaderMeta pinta el badge de salud cuando se le pasa health", () => {
  const meta = fakeEl();
  const context = sandboxWith(["homeOverallStatus", "renderHomeHeaderMeta"], {
    qs: (id) => (id === "homeHeaderMeta" ? meta : null),
    HOME_MISSING_VALUE: "—",
  });
  context.renderHomeHeaderMeta({
    statuses: ["good"],
    health: { score: 82, good: 4, warn: 1, danger: 0 },
    asOf: "28/08/2026",
    source: "libro canónico calculado",
    guidance: "Sin decisiones pendientes.",
  });
  assert.match(meta.innerHTML, /Salud financiera: <strong>82\/100<\/strong>/);
  assert.match(meta.innerHTML, /4 en buen estado, 1 con aviso, 0 en riesgo, sobre 5 indicadores\./);
});

test("#3 · renderHomeHeaderMeta sin health no pinta ningún badge (compatibilidad hacia atrás)", () => {
  const meta = fakeEl();
  const context = sandboxWith(["homeOverallStatus", "renderHomeHeaderMeta"], {
    qs: (id) => (id === "homeHeaderMeta" ? meta : null),
    HOME_MISSING_VALUE: "—",
  });
  context.renderHomeHeaderMeta({ statuses: ["good"], asOf: "28/08/2026", source: "x", guidance: "y" });
  assert.ok(!meta.innerHTML.includes("Salud financiera"));
});

// --- Parte C: renderEscenarioComparar ---------------------------------------------------------

function comparadorSandbox({ candidates = [], selected = null, signature = "" } = {}) {
  const picker = fakeEl();
  const body = fakeEl();
  const empty = fakeEl({ hidden: true });
  const layout = fakeEl({ hidden: true });
  const els = { escenarioCompararPicker: picker, escenarioCompararBody: body, escenarioCompararEmpty: empty, escenarioCompararLayout: layout };
  const compareCalls = [];
  const context = sandboxWith(["renderEscenarioComparar"], {
    qs: (id) => els[id] || null,
    renderScenarioDependencyNotice: () => {},
    escenarioMotorCompareCandidates: () => candidates,
    escenarioMotorBaseInput: () => ({ months: 12 }),
    runEscenarioMotor: (baseInput, decisiones) => ({ decisiones }),
    escenarioMotorSummaryFor: (result) => ({ tag: result.decisiones }),
    escenarioMotorCompareTableHtml: (baseSummary, entries) => {
      compareCalls.push(entries.map((entry) => entry.nombre));
      return `<table data-entries="${entries.map((entry) => entry.nombre).join(",")}"></table>`;
    },
    escenarioCompararSelected: selected === null ? [] : selected,
    escenarioCompararSignature: signature,
  });
  return { context, picker, body, empty, layout, compareCalls };
}

test("#4 · con menos de dos candidatos, muestra el aviso de vacío y limpia todo", () => {
  const { context, picker, body, empty, layout } = comparadorSandbox({ candidates: [{ id: "a", nombre: "A" }] });
  context.renderEscenarioComparar();
  assert.equal(empty.hidden, false);
  assert.equal(layout.hidden, true);
  assert.equal(picker.innerHTML, "");
  assert.equal(body.innerHTML, "");
  assert.deepEqual([...context.escenarioCompararSelected], []);
});

test("#4 · con dos o más candidatos por primera vez, selecciona todos por defecto", () => {
  const candidates = [
    { id: "a", nombre: "Escenario A" },
    { id: "b", nombre: "Escenario B" },
    { id: "c", nombre: "Escenario C" },
  ];
  const { context, picker, body, empty, layout, compareCalls } = comparadorSandbox({ candidates });
  context.renderEscenarioComparar();
  assert.equal(empty.hidden, true);
  assert.equal(layout.hidden, false);
  assert.match(picker.innerHTML, /data-escenario-comparar-pick="a"[^>]*checked/);
  assert.match(picker.innerHTML, /data-escenario-comparar-pick="b"[^>]*checked/);
  assert.match(picker.innerHTML, /data-escenario-comparar-pick="c"[^>]*checked/);
  assert.deepEqual(compareCalls, [["Escenario A", "Escenario B", "Escenario C"]]);
  assert.match(body.innerHTML, /Escenario A,Escenario B,Escenario C/);
});

test("#4 · si el conjunto de candidatos no cambió, respeta una selección estrechada a mano", () => {
  const candidates = [
    { id: "a", nombre: "Escenario A" },
    { id: "b", nombre: "Escenario B" },
    { id: "c", nombre: "Escenario C" },
  ];
  const { context, picker, compareCalls } = comparadorSandbox({
    candidates,
    selected: ["a", "c"],
    signature: "a,b,c",
  });
  context.renderEscenarioComparar();
  assert.match(picker.innerHTML, /data-escenario-comparar-pick="a"[^>]*checked/);
  assert.match(picker.innerHTML, /data-escenario-comparar-pick="c"[^>]*checked/);
  assert.doesNotMatch(picker.innerHTML, /data-escenario-comparar-pick="b"[^>]*checked/);
  assert.deepEqual(compareCalls, [["Escenario A", "Escenario C"]]);
});

test("#4 · si el conjunto de candidatos cambió (uno nuevo guardado), la selección vuelve a «todos»", () => {
  const candidates = [
    { id: "a", nombre: "Escenario A" },
    { id: "b", nombre: "Escenario B" },
    { id: "nuevo", nombre: "Recién guardado" },
  ];
  const { context, compareCalls } = comparadorSandbox({
    candidates,
    selected: ["a"],
    signature: "a,b", // firma antigua, sin "nuevo"
  });
  context.renderEscenarioComparar();
  assert.deepEqual(compareCalls, [["Escenario A", "Escenario B", "Recién guardado"]]);
  assert.deepEqual([...context.escenarioCompararSelected], ["a", "b", "nuevo"]);
});

test("#4 · si se desmarcan todos, avisa en vez de pintar una tabla vacía y no llama al motor", () => {
  const candidates = [
    { id: "a", nombre: "Escenario A" },
    { id: "b", nombre: "Escenario B" },
  ];
  const { context, body, compareCalls } = comparadorSandbox({ candidates, selected: [], signature: "a,b" });
  context.renderEscenarioComparar();
  assert.match(body.innerHTML, /Marca al menos un escenario/);
  assert.deepEqual(compareCalls, []);
});

test("#4 · un solo escenario marcado sigue generando la comparativa (no exige exactamente dos)", () => {
  const candidates = [
    { id: "a", nombre: "Escenario A" },
    { id: "b", nombre: "Escenario B" },
  ];
  const { context, compareCalls } = comparadorSandbox({ candidates, selected: ["b"], signature: "a,b" });
  context.renderEscenarioComparar();
  assert.deepEqual(compareCalls, [["Escenario B"]]);
});

// --- Parte D: handleEscenarioCompararPick -------------------------------------------------------

test("#4 · handleEscenarioCompararPick marca un escenario y vuelve a renderizar", () => {
  const renders = [];
  const context = sandboxWith(["handleEscenarioCompararPick"], {
    escenarioCompararSelected: ["a"],
    renderEscenarioComparar: () => renders.push("render"),
  });
  context.handleEscenarioCompararPick({ checked: true, dataset: { escenarioCompararPick: "b" } });
  assert.deepEqual([...context.escenarioCompararSelected], ["a", "b"]);
  assert.deepEqual(renders, ["render"]);
});

test("#4 · handleEscenarioCompararPick no duplica un id ya marcado", () => {
  const context = sandboxWith(["handleEscenarioCompararPick"], {
    escenarioCompararSelected: ["a"],
    renderEscenarioComparar: () => {},
  });
  context.handleEscenarioCompararPick({ checked: true, dataset: { escenarioCompararPick: "a" } });
  assert.deepEqual([...context.escenarioCompararSelected], ["a"]);
});

test("#4 · handleEscenarioCompararPick desmarca quitando el id de la selección", () => {
  const context = sandboxWith(["handleEscenarioCompararPick"], {
    escenarioCompararSelected: ["a", "b"],
    renderEscenarioComparar: () => {},
  });
  context.handleEscenarioCompararPick({ checked: false, dataset: { escenarioCompararPick: "a" } });
  assert.deepEqual([...context.escenarioCompararSelected], ["b"]);
});

test("#4 · handleEscenarioCompararPick sin id en el dataset no hace nada", () => {
  const renders = [];
  const context = sandboxWith(["handleEscenarioCompararPick"], {
    escenarioCompararSelected: ["a"],
    renderEscenarioComparar: () => renders.push("render"),
  });
  context.handleEscenarioCompararPick({ checked: true, dataset: {} });
  assert.deepEqual([...context.escenarioCompararSelected], ["a"]);
  assert.deepEqual(renders, []);
});

// --- Parte E: wiring estático -------------------------------------------------------------------

test("#4 · index.html ya no tiene los dos <select> A/B fijos, tiene el picker de checkboxes", () => {
  assert.ok(!html.includes('id="escenarioCompararA"'), "el select A debe haber desaparecido");
  assert.ok(!html.includes('id="escenarioCompararB"'), "el select B debe haber desaparecido");
  assert.match(html, /<fieldset class="escenario-motor-compare-picker" id="escenarioCompararPicker"/);
});

test("#4 · el picker delega el cambio de checkbox a handleEscenarioCompararPick", () => {
  assert.match(
    app,
    /qs\("escenarioCompararPicker"\)\?\.addEventListener\("change", \(event\) => \{[\s\S]{0,160}handleEscenarioCompararPick\(checkbox\);/,
  );
});

test("#3 · renderHomeDashboard calcula homeHealthScore incluyendo coverageStatus, no solo los cinco del pill", () => {
  const source = extractFunction("renderHomeDashboard");
  assert.match(source, /homeHealthScore\(\[adjustedStatus, debtRatioStatus, freeCapacityStatus, reserveStatus, riskStatus, coverageStatus\]\)/);
});
