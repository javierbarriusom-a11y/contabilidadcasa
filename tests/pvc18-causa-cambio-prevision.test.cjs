const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// PVC18 (Oleada 4, Bloque 3): alcance reducido — PVC6 ya compara "qué preveíamos entonces" contra
// "qué prevemos ahora" con diffAssumptionSnapshots(); esta tarea solo etiqueta la CAUSA de ese
// cambio ya detectado (supuesto editado / dato nuevo / modelo recalibrado), leyendo piezas que ya
// existían (diffAssumptionSnapshots + el diario de PV5 + pv1AutoAdjustTransitionNote), sin motor
// de comparación nuevo. Las tres causas no son excluyentes entre sí.

const appSource = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");

function extractFunction(name) {
  const start = appSource.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `No existe la función ${name} en app.js`);
  const parenStart = appSource.indexOf("(", start);
  let parenDepth = 0;
  let bodyStart = -1;
  for (let index = parenStart; index < appSource.length; index += 1) {
    if (appSource[index] === "(") parenDepth += 1;
    else if (appSource[index] === ")") {
      parenDepth -= 1;
      if (parenDepth === 0) { bodyStart = appSource.indexOf("{", index); break; }
    }
  }
  assert.ok(bodyStart >= 0, `No se encontró el cuerpo de ${name}`);
  let depth = 0;
  for (let index = bodyStart; index < appSource.length; index += 1) {
    if (appSource[index] === "{") depth += 1;
    else if (appSource[index] === "}") {
      depth -= 1;
      if (depth === 0) return appSource.slice(start, index + 1);
    }
  }
  throw new Error(`La función ${name} no cierra sus llaves`);
}

function extractConst(name) {
  const start = appSource.indexOf(`const ${name} =`);
  assert.ok(start >= 0, `No existe la constante ${name} en app.js`);
  const end = appSource.indexOf("};", start) + 2;
  return appSource.slice(start, end);
}

function sandbox({ storage = {}, elements = {}, engine = null, canonicalScenarioResults = {} } = {}) {
  const store = { ...storage };
  const context = {
    storageGet: (key, fallback) => (key in store ? store[key] : fallback),
    storageSet: (key, value) => { store[key] = value; },
    storageKey: (key) => key,
    escapeHtml: (value) => String(value ?? ""),
    money: (value, precise) => (precise ? `${Number(value).toFixed(2)}€` : `${Math.round(Number(value))}€`),
    qs: (id) => elements[id] || null,
    canonicalScenarioResults,
    loadPvc6ForecastSnapshots: () => (storage.__pvc6Snapshots || []),
    window: { FinanceCanonicalForecast: engine },
  };
  vm.createContext(context);
  vm.runInContext(extractConst("PVC18_CAUSE_LABELS"), context);
  vm.runInContext(extractFunction("loadPv5Diary"), context);
  vm.runInContext(extractFunction("savePv5Diary"), context);
  vm.runInContext("const PV5_DIARY_MAX_ENTRIES = 200;", context);
  vm.runInContext(extractFunction("pv1AutoAdjustTransitionNote"), context);
  vm.runInContext(extractFunction("pvc18ChangeCauses"), context);
  vm.runInContext(extractFunction("pvc18CausesHtml"), context);
  vm.runInContext(extractFunction("pvc6DiffResultHtml"), context);
  vm.runInContext(extractFunction("handlePvc6SnapshotCompare"), context);
  return context;
}

function diaryEntry(overrides = {}) {
  return { id: "monthly-net-x", at: "2026-08-01T00:00:00.000Z", conceptId: "monthly-net", previousDelta: 20, newDelta: 30, previousConfidence: "media", newConfidence: "media", ...overrides };
}

test("pvc18ChangeCauses · sin diff calculable y sin diario, ninguna causa", () => {
  const ctx = sandbox();
  const causes = ctx.pvc18ChangeCauses({ calculable: false, changed: [] }, "2026-01-01T00:00:00.000Z");
  assert.deepEqual([...causes], []);
});

test("pvc18ChangeCauses · supuestos cambiados: 'supuesto-editado'", () => {
  const ctx = sandbox();
  const causes = ctx.pvc18ChangeCauses({ calculable: true, changed: [{ id: "incomeFactor" }] }, null);
  assert.deepEqual([...causes], ["supuesto-editado"]);
});

test("pvc18ChangeCauses · sin timestamp de referencia (snapshot sin closedAt), ignora el diario", () => {
  const ctx = sandbox({ storage: { "pv5-diary": JSON.stringify([diaryEntry()]) } });
  const causes = ctx.pvc18ChangeCauses({ calculable: true, changed: [] }, null);
  assert.deepEqual([...causes], []);
});

test("pvc18ChangeCauses · una entrada del diario posterior al cierre comparado: 'dato-nuevo'", () => {
  const ctx = sandbox({ storage: { "pv5-diary": JSON.stringify([diaryEntry({ at: "2026-09-01T00:00:00.000Z" })]) } });
  const causes = ctx.pvc18ChangeCauses({ calculable: true, changed: [] }, "2026-08-15T00:00:00.000Z");
  assert.deepEqual([...causes], ["dato-nuevo"]);
});

test("pvc18ChangeCauses · entrada del diario ANTES del cierre comparado no cuenta", () => {
  const ctx = sandbox({ storage: { "pv5-diary": JSON.stringify([diaryEntry({ at: "2026-07-01T00:00:00.000Z" })]) } });
  const causes = ctx.pvc18ChangeCauses({ calculable: true, changed: [] }, "2026-08-15T00:00:00.000Z");
  assert.deepEqual([...causes], []);
});

test("pvc18ChangeCauses · una entrada que cruza a confianza alta: 'dato-nuevo' Y 'modelo-recalibrado'", () => {
  const entry = diaryEntry({ at: "2026-09-01T00:00:00.000Z", previousConfidence: "media", newConfidence: "high" });
  const ctx = sandbox({ storage: { "pv5-diary": JSON.stringify([entry]) } });
  const causes = ctx.pvc18ChangeCauses({ calculable: true, changed: [] }, "2026-08-15T00:00:00.000Z");
  assert.deepEqual([...causes], ["dato-nuevo", "modelo-recalibrado"]);
});

test("pvc18ChangeCauses · las tres causas pueden darse a la vez", () => {
  const entry = diaryEntry({ at: "2026-09-01T00:00:00.000Z", previousConfidence: "media", newConfidence: "high" });
  const ctx = sandbox({ storage: { "pv5-diary": JSON.stringify([entry]) } });
  const causes = ctx.pvc18ChangeCauses({ calculable: true, changed: [{ id: "incomeFactor" }] }, "2026-08-15T00:00:00.000Z");
  assert.deepEqual([...causes], ["supuesto-editado", "dato-nuevo", "modelo-recalibrado"]);
});

test("pvc18CausesHtml · sin causas, cadena vacía (nunca inventa una causa)", () => {
  const ctx = sandbox();
  assert.equal(ctx.pvc18CausesHtml([]), "");
});

test("pvc18CausesHtml · lista las causas con sus etiquetas legibles", () => {
  const ctx = sandbox();
  const html = ctx.pvc18CausesHtml(["supuesto-editado", "dato-nuevo"]);
  assert.match(html, /supuesto editado a mano/);
  assert.match(html, /dato nuevo conciliado/);
});

test("pvc6DiffResultHtml · antepone la causa incluso cuando ningún supuesto cambió", () => {
  const ctx = sandbox();
  const html = ctx.pvc6DiffResultHtml({ calculable: true, changed: [], unchangedCount: 4 }, ["dato-nuevo"]);
  assert.match(html, /dato nuevo conciliado/);
  assert.match(html, /Ningún supuesto ha cambiado/);
});

test("pvc6DiffResultHtml · sin causas, no añade ninguna línea de causa", () => {
  const ctx = sandbox();
  const html = ctx.pvc6DiffResultHtml({ calculable: true, changed: [], unchangedCount: 4 }, []);
  assert.doesNotMatch(html, /Causa del cambio/);
});

test("handlePvc6SnapshotCompare · pasa el closedAt del snapshot a pvc18ChangeCauses", () => {
  const note = { innerHTML: "" };
  const engine = { diffAssumptionSnapshots: () => ({ calculable: true, changed: [{ id: "incomeFactor" }], unchangedCount: 3 }) };
  const entry = diaryEntry({ at: "2026-09-01T00:00:00.000Z" });
  const ctx = sandbox({
    elements: { pvc6SnapshotDiffNote: note, pvc6SnapshotSelect: { value: "2026-08" } },
    engine,
    storage: { __pvc6Snapshots: [{ monthKey: "2026-08", closedAt: "2026-08-15T00:00:00.000Z", assumptions: {} }], "pv5-diary": JSON.stringify([entry]) },
    canonicalScenarioResults: { base: { forecast: { assumptions: {} } } },
  });
  ctx.handlePvc6SnapshotCompare();
  assert.match(note.innerHTML, /supuesto editado a mano/);
  assert.match(note.innerHTML, /dato nuevo conciliado/);
});

test("wiring: handlePvc6SnapshotCompare sigue reutilizando diffAssumptionSnapshots y ahora también pvc18ChangeCauses", () => {
  const block = extractFunction("handlePvc6SnapshotCompare");
  assert.match(block, /diffAssumptionSnapshots\(/);
  assert.match(block, /pvc18ChangeCauses\(result, snapshot\.closedAt\)/);
});
