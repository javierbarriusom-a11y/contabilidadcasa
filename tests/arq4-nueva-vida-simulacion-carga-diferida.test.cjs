const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const app = read("app.js");
const view = read("views/new-life-simulation.js");
const index = read("index.html");

// ARQ-4 (BACKLOG_CONTABILIDADCASA_3_0.md §2.2, segundo incremento, sesión 236): «Nueva vida» en modo
// simulación (`#new-life-simulation`) pasa a views/new-life-simulation.js con carga diferida. T14 la
// había dado por bloqueada de forma permanente porque renderNewLifeSimulation() se llamaba sin guarda
// desde tres manejadores GOB20/GOB12; el cruce contra el código mostró que esos controles viven dentro
// de la propia sección. Estos tests protegen las dos cosas: que siga siendo así y que las llamadas
// externas no puedan lanzar un ReferenceError aunque algún día se cableen desde otra pantalla.

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `No existe la función ${name}`);
  const bodyStart = source.indexOf("{", source.indexOf(") {", start));
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    else if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`La función ${name} no cierra sus llaves`);
}

const MOVED = [
  "renderNewLifeSimulation",
  "newLifeContext",
  "newLifeActionButton",
  "newLifePriorityDecision",
  "renderNewLifeHero",
  "renderNewLifeKpis",
  "renderNewLifeActions",
  "renderNewLifeFamilyStory",
  "renderNewLifeScenarios",
  "renderNewLifeDebtRoute",
  "renderNewLifeTimeline",
  "renderNewLifeDecisionNotes",
];

test("ARQ-4 · las funciones de la pantalla viven en views/new-life-simulation.js y ya no en app.js", () => {
  MOVED.forEach((name) => {
    assert.ok(!app.includes(`function ${name}(`), `${name} sigue definida en app.js`);
    assert.ok(view.includes(`function ${name}(`), `${name} falta en views/new-life-simulation.js`);
  });
  // Laboratorio E13, GOB20/GOB12 y el motor compartido se quedan en app.js (ver cabecera de la vista).
  ["renderE13ScenarioLab", "renderGob20IncomeAdjustments", "addGob20IncomeAdjustment", "gob12ApplyPackageToReal", "executiveAdvisorContext", "scheduleHeavyAdvisorRefresh"].forEach((name) => {
    assert.ok(app.includes(`function ${name}(`), `${name} debe seguir en app.js`);
    assert.ok(!view.includes(`function ${name}(`), `${name} no debe duplicarse en la vista`);
  });
});

test("ARQ-4 · ninguna función movida se usa desde app.js ni desde otra vista, salvo renderNewLifeSimulation", () => {
  const others = fs.readdirSync(path.join(root, "views"))
    .filter((name) => name.endsWith(".js") && name !== "new-life-simulation.js")
    .map((name) => read(`views/${name}`));
  const strip = (source) => source.split("\n").filter((line) => !line.trim().startsWith("//")).join("\n");
  MOVED.filter((name) => name !== "renderNewLifeSimulation").forEach((name) => {
    const pattern = new RegExp(`\\b${name}\\(`);
    assert.doesNotMatch(strip(app), pattern, `app.js llama a ${name}, que ahora vive en una vista diferida`);
    others.forEach((source) => assert.doesNotMatch(strip(source), pattern, `otra vista llama a ${name}`));
  });
});

test("ARQ-4 · todos los nodos que pinta la vista viven dentro de su sección", () => {
  const start = index.indexOf('<section class="new-life-simulation view-section" id="new-life-simulation">');
  assert.ok(start >= 0, "Falta la sección new-life-simulation en index.html");
  const end = index.indexOf("<section", start + 1);
  const section = index.slice(start, end);
  const targets = [...new Set([...view.matchAll(/qs\("([A-Za-z0-9]+)"\)/g)].map((match) => match[1]))];
  assert.ok(targets.length >= 8);
  targets.forEach((id) => assert.match(section, new RegExp(`id="${id}"`), `#${id} no está dentro de new-life-simulation`));
});

test("ARQ-4 · la pantalla está registrada como vista diferida, en el build publicado y en la caché offline", () => {
  assert.match(app, /"new-life-simulation": \{ src: "views\/new-life-simulation\.js\?v=[^"]+", rootId: "new-life-simulation" \}/);
  assert.match(read("tools/build-public-site.mjs"), /"views\/new-life-simulation\.js"/);
  assert.match(read("service-worker.js"), /"\.\/views\/new-life-simulation\.js"/);
  assert.match(app, /case "new-life-simulation":\s*\n\s*renderNewLifeSimulation\(\);/);
});

test("ARQ-4 · los controles que repintan la pantalla siguen dentro de ella (motivo del desbloqueo)", () => {
  const start = index.indexOf('id="new-life-simulation"');
  const end = index.indexOf('id="debt-roadmap"');
  ["gob20AdjustmentAdd", "gob12ApplyRealBtn", "gob20IncomeAdjustmentsList"].forEach((id) => {
    const at = index.indexOf(`id="${id}"`);
    assert.ok(at > start && at < end, `#${id} ha salido de new-life-simulation: revisa la guarda de sus llamadores`);
  });
  assert.match(app, /qs\("new-life-simulation"\)\?\.addEventListener\("click"/);
});

test("ARQ-4 · app.js nunca llama a renderNewLifeSimulation() sin garantizar que su fichero está cargado", () => {
  const lines = app.split("\n");
  lines.forEach((line, index) => {
    if (!/renderNewLifeSimulation\(/.test(line) || line.trim().startsWith("//")) return;
    const guarded = /viewChunkLoaded\("new-life-simulation"\)\) renderNewLifeSimulation\(/.test(line);
    const activeSection = /^\s*renderNewLifeSimulation\(\);$/.test(line) && /case "new-life-simulation":/.test(lines[index - 1]);
    // scheduleHeavyAdvisorRefresh: solo la programa la propia vista, y comprueba la vista activa.
    const heavyRefresh = /else if \(viewId === "new-life-simulation"\) renderNewLifeSimulation\(\{ forceHeavy: true \}\);/.test(line);
    assert.ok(guarded || activeSection || heavyRefresh, `Llamada sin guarda a renderNewLifeSimulation(): ${line.trim()}`);
  });
  const heavy = extractFunction(app, "scheduleHeavyAdvisorRefresh");
  assert.match(heavy, /viewFromHash\(\) !== viewId\) return;/);
  assert.ok(!/scheduleHeavyAdvisorRefresh\("new-life-simulation"\)/.test(app), "solo la vista debe programar su refresco pesado");
});

test("ARQ-4 · declarar una caída de ingreso sin el fichero cargado no lanza y conserva el guardado", () => {
  const calls = [];
  const fields = {
    gob20AdjustmentLabel: { value: "Reducción de jornada" },
    gob20AdjustmentAmount: { value: "300" },
    gob20AdjustmentMonth: { value: "2026-10" },
    gob20AdjustmentDuration: { value: "3" },
    gob20AdjustmentStatus: { textContent: "" },
  };
  const context = {
    qs: (id) => fields[id] || null,
    parseAmount: Number,
    gob20IncomeAdjustments: () => [],
    saveGob20IncomeAdjustments: (next) => calls.push(`save:${next.length}`),
    renderGob20IncomeAdjustments: () => calls.push("list"),
    viewChunkLoaded: () => false,
    Date,
  };
  vm.createContext(context);
  vm.runInContext(extractFunction(app, "addGob20IncomeAdjustment"), context);
  assert.doesNotThrow(() => context.addGob20IncomeAdjustment());
  assert.deepEqual(calls, ["save:1", "list"]);
  assert.match(fields.gob20AdjustmentStatus.textContent, /declarada/);
});
