const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// GOB20 (Oleada 4, Bloque 7, nace al partir GOB12 en sesión 185): hasta ahora el único lugar para
// declarar una caída temporal de ingreso era el Laboratorio de escenarios (E13), explícitamente de
// solo lectura — canonicalEngineInput() (la única puerta de entrada del ingreso planificado al
// motor real, canonical-engine.js lee month.income como baseIncome) no tenía ninguna capa de
// ajustes declarados. Esta tarea añade scenarioSettings.incomeAdjustments, restado del ingreso de
// cada mes justo en canonicalEngineInput() — con el array vacío (comportamiento por defecto) el
// resultado debe ser idéntico al de antes de esta tarea, verificado indirectamente por toda la
// suite existente (miles de tests que ya ejercitan computeCanonicalScenario/canonicalEngineInput
// sin declarar ningún ajuste).

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

function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function dateFromMonthKey(key) {
  const [year, month] = String(key || "").split("-").map(Number);
  return new Date(year, (month || 1) - 1, 1);
}

function monthDistance(fromDate, toDate) {
  return (toDate.getFullYear() - fromDate.getFullYear()) * 12 + (toDate.getMonth() - fromDate.getMonth());
}

function money(value) {
  return `${Number(value).toFixed(2)} €`;
}

function sandbox({ scenarioSettings = {}, noteEl = { innerHTML: "" }, fields = {} } = {}) {
  const recomputeCalls = [];
  const saveCalls = [];
  const renderNewLifeCalls = [];
  const fieldEls = {
    gob20AdjustmentLabel: { value: "" },
    gob20AdjustmentAmount: { value: "" },
    gob20AdjustmentMonth: { value: "" },
    gob20AdjustmentDuration: { value: "" },
    gob20AdjustmentStatus: { textContent: "" },
    gob20IncomeAdjustmentsList: noteEl,
    ...fields,
  };
  const context = {
    scenarioSettings,
    saveScenarioSettings: () => saveCalls.push(JSON.parse(JSON.stringify(scenarioSettings))),
    recomputeModelIfNeeded: (force) => recomputeCalls.push(force),
    renderNewLifeSimulation: (opts) => renderNewLifeCalls.push(opts),
    // ARQ-4 (sesión 236): renderNewLifeSimulation vive en views/new-life-simulation.js y sus llamadores
    // la protegen con viewChunkLoaded; aquí la pantalla se da por cargada, como al pulsar sus botones.
    viewChunkLoaded: (id) => id === "new-life-simulation",
    qs: (id) => fieldEls[id] || null,
    escapeHtml: (value) => String(value ?? ""),
    money,
    parseAmount: (value) => (value === "" || value === undefined || value === null ? NaN : Number(value)),
    round2,
    dateFromMonthKey,
    monthDistance,
    fieldEls,
    recomputeCalls,
    saveCalls,
    renderNewLifeCalls,
    noteEl,
  };
  vm.createContext(context);
  vm.runInContext(extractFunction("gob20IncomeAdjustments"), context);
  vm.runInContext(extractFunction("gob20IncomeAdjustmentForMonth"), context);
  vm.runInContext(extractFunction("saveGob20IncomeAdjustments"), context);
  vm.runInContext(extractFunction("addGob20IncomeAdjustment"), context);
  vm.runInContext(extractFunction("removeGob20IncomeAdjustment"), context);
  vm.runInContext(extractFunction("gob20IncomeAdjustmentsHtml"), context);
  vm.runInContext(extractFunction("renderGob20IncomeAdjustments"), context);
  return context;
}

test("gob20IncomeAdjustmentForMonth · sin ajustes declarados, 0 — comportamiento por defecto intacto", () => {
  const ctx = sandbox();
  assert.equal(ctx.gob20IncomeAdjustmentForMonth([], "2026-06"), 0);
});

test("gob20IncomeAdjustmentForMonth · mes antes del inicio declarado, 0", () => {
  const ctx = sandbox();
  const adjustments = [{ startMonthKey: "2026-06", duration: 3, monthlyAmount: 500 }];
  assert.equal(ctx.gob20IncomeAdjustmentForMonth(adjustments, "2026-05"), 0);
});

test("gob20IncomeAdjustmentForMonth · mes de inicio exacto, aplica", () => {
  const ctx = sandbox();
  const adjustments = [{ startMonthKey: "2026-06", duration: 3, monthlyAmount: 500 }];
  assert.equal(ctx.gob20IncomeAdjustmentForMonth(adjustments, "2026-06"), 500);
});

test("gob20IncomeAdjustmentForMonth · último mes dentro de la duración, aplica; el siguiente ya no", () => {
  const ctx = sandbox();
  const adjustments = [{ startMonthKey: "2026-06", duration: 3, monthlyAmount: 500 }];
  assert.equal(ctx.gob20IncomeAdjustmentForMonth(adjustments, "2026-08"), 500);
  assert.equal(ctx.gob20IncomeAdjustmentForMonth(adjustments, "2026-09"), 0);
});

test("gob20IncomeAdjustmentForMonth · varios ajustes solapados en el mismo mes, se suman", () => {
  const ctx = sandbox();
  const adjustments = [
    { startMonthKey: "2026-06", duration: 6, monthlyAmount: 500 },
    { startMonthKey: "2026-07", duration: 2, monthlyAmount: 200 },
  ];
  assert.equal(ctx.gob20IncomeAdjustmentForMonth(adjustments, "2026-07"), 700);
});

test("gob20IncomeAdjustmentForMonth · mes objetivo inválido, 0 en vez de reventar", () => {
  const ctx = sandbox();
  const adjustments = [{ startMonthKey: "2026-06", duration: 3, monthlyAmount: 500 }];
  assert.equal(ctx.gob20IncomeAdjustmentForMonth(adjustments, ""), 0);
});

test("gob20IncomeAdjustmentForMonth · ajuste con fecha de inicio inválida se ignora, no rompe la suma", () => {
  const ctx = sandbox();
  const adjustments = [
    { startMonthKey: "", duration: 3, monthlyAmount: 500 },
    { startMonthKey: "2026-06", duration: 3, monthlyAmount: 300 },
  ];
  assert.equal(ctx.gob20IncomeAdjustmentForMonth(adjustments, "2026-06"), 300);
});

test("addGob20IncomeAdjustment · sin importe o sin mes, no declara nada y avisa", () => {
  const ctx = sandbox({ scenarioSettings: {} });
  ctx.fieldEls.gob20AdjustmentAmount.value = "";
  ctx.fieldEls.gob20AdjustmentMonth.value = "2026-06";
  ctx.addGob20IncomeAdjustment();
  assert.equal((ctx.scenarioSettings.incomeAdjustments || []).length, 0);
  assert.match(ctx.fieldEls.gob20AdjustmentStatus.textContent, /Indica el mes/);
});

test("addGob20IncomeAdjustment · con importe y mes, declara el ajuste, persiste y fuerza recálculo", () => {
  const ctx = sandbox({ scenarioSettings: {} });
  ctx.fieldEls.gob20AdjustmentLabel.value = "Reducción de jornada";
  ctx.fieldEls.gob20AdjustmentAmount.value = "600";
  ctx.fieldEls.gob20AdjustmentMonth.value = "2026-09";
  ctx.fieldEls.gob20AdjustmentDuration.value = "4";
  ctx.addGob20IncomeAdjustment();
  const saved = ctx.scenarioSettings.incomeAdjustments;
  assert.equal(saved.length, 1);
  assert.equal(saved[0].label, "Reducción de jornada");
  assert.equal(saved[0].monthlyAmount, 600);
  assert.equal(saved[0].startMonthKey, "2026-09");
  assert.equal(saved[0].duration, 4);
  assert.equal(ctx.saveCalls.length, 1);
  assert.deepEqual(ctx.recomputeCalls, [true]);
  assert.deepEqual(JSON.parse(JSON.stringify(ctx.renderNewLifeCalls)), [{ forceHeavy: true }]);
  assert.match(ctx.fieldEls.gob20AdjustmentStatus.textContent, /ya la refleja/);
});

test("removeGob20IncomeAdjustment · quita solo el ajuste indicado y fuerza recálculo", () => {
  const ctx = sandbox({ scenarioSettings: { incomeAdjustments: [{ id: "a", label: "A", monthlyAmount: 1, startMonthKey: "2026-01", duration: 1 }, { id: "b", label: "B", monthlyAmount: 2, startMonthKey: "2026-01", duration: 1 }] } });
  ctx.removeGob20IncomeAdjustment("a");
  assert.deepEqual(ctx.scenarioSettings.incomeAdjustments.map((item) => item.id), ["b"]);
  assert.deepEqual(ctx.recomputeCalls, [true]);
});

test("gob20IncomeAdjustmentsHtml · sin ajustes, mensaje neutro sin alarmar", () => {
  const ctx = sandbox();
  assert.match(ctx.gob20IncomeAdjustmentsHtml([]), /usa tu ingreso real tal cual/);
});

test("gob20IncomeAdjustmentsHtml · con ajustes, los nombra con su duración e importe", () => {
  const ctx = sandbox();
  const html = ctx.gob20IncomeAdjustmentsHtml([{ id: "a", label: "Reducción de jornada", monthlyAmount: 600, startMonthKey: "2026-09", duration: 4 }]);
  assert.match(html, /Reducción de jornada/);
  assert.match(html, /600\.00/);
  assert.match(html, /2026-09/);
  assert.match(html, /data-gob20-remove="a"/);
});

test("renderGob20IncomeAdjustments · pinta la lista actual de scenarioSettings", () => {
  const ctx = sandbox({ scenarioSettings: { incomeAdjustments: [{ id: "a", label: "X", monthlyAmount: 100, startMonthKey: "2026-01", duration: 1 }] } });
  ctx.renderGob20IncomeAdjustments();
  assert.match(ctx.noteEl.innerHTML, />X</);
});

test("wiring: canonicalEngineInput() resta gob20IncomeAdjustmentForMonth() del ingreso de cada mes, sin inventar un motor paralelo", () => {
  const start = appSource.indexOf("function canonicalEngineInput(");
  const end = appSource.indexOf("\n}\n", start);
  const block = appSource.slice(start, end);
  assert.match(block, /const incomeAdjustments = gob20IncomeAdjustments\(\);/);
  assert.match(block, /const incomeAdjustment = gob20IncomeAdjustmentForMonth\(incomeAdjustments, detail\.monthKey\);/);
  assert.match(block, /income: round2\(Math\.max\(0, detail\.income - incomeAdjustment\)\),/);
});

test("wiring: modelComputationSignature() incluye incomeAdjustments — si no, un cambio no dispararía el recálculo memoizado", () => {
  const start = appSource.indexOf("function modelComputationSignature(");
  const end = appSource.indexOf("\n}\n", start);
  const block = appSource.slice(start, end);
  assert.match(block, /incomeAdjustments: gob20IncomeAdjustments\(\),/);
});

test("wiring: index.html declara los campos y la lista de ajustes de ingreso, dentro de new-life-simulation, distinto del Laboratorio de escenarios de arriba", () => {
  const indexSource = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  ["gob20AdjustmentLabel", "gob20AdjustmentAmount", "gob20AdjustmentMonth", "gob20AdjustmentDuration", "gob20AdjustmentAdd", "gob20IncomeAdjustmentsList"].forEach((id) => {
    assert.match(indexSource, new RegExp(`id="${id}"`));
  });
  const sectionIdx = indexSource.indexOf('id="new-life-simulation"');
  const fieldIdx = indexSource.indexOf('id="gob20AdjustmentAdd"');
  const nextSectionIdx = indexSource.indexOf('id="debt-roadmap"');
  assert.ok(sectionIdx > 0 && fieldIdx > sectionIdx && fieldIdx < nextSectionIdx, "GOB20 debe vivir dentro de new-life-simulation");
});

test("wiring: app.js conecta el botón de declarar y el delegado de quitar, y renderNewLifeSimulation repinta la lista", () => {
  assert.match(appSource, /qs\("gob20AdjustmentAdd"\)\?\.addEventListener\("click", addGob20IncomeAdjustment\)/);
  assert.match(appSource, /data-gob20-remove/);
  // ARQ-4 (sesión 236): la pantalla vive en views/new-life-simulation.js, con carga diferida.
  const viewSource = fs.readFileSync(path.join(__dirname, "..", "views", "new-life-simulation.js"), "utf8");
  const start = viewSource.indexOf("function renderNewLifeSimulation(");
  assert.ok(start >= 0, "renderNewLifeSimulation debe vivir en views/new-life-simulation.js");
  const end = viewSource.indexOf("\n}", start);
  const block = viewSource.slice(start, end);
  assert.match(block, /renderGob20IncomeAdjustments\(\);/);
});
