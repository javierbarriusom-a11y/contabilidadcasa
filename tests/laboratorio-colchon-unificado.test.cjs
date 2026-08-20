const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

// Laboratorio (decisión "destino de agentCaixaFloor", 20 de agosto de 2026): `agentCaixaFloor()`
// (colchón que leen Hoy, Registrar, Deuda · Ruta y Asesor de decisión) y la reserva operativa de
// Ajustes (`state.operatingReserve`, V6-1/V6-3) eran dos cifras completamente separadas que podían
// divergir sin que nadie lo notara — hallazgo de la propia sesión que investigó el destino de las
// heredadas de Deuda (ver `tests/l1-l10-fase7-laboratorio.test.cjs`, "el catálogo no repite el
// error de confundir..."). Estas pruebas cubren la unificación: `operatingReserve` manda cuando
// está configurado (> 0); si no, cada camino conserva exactamente el respaldo que ya tenía.

function extractFunction(name) {
  const start = app.indexOf(`function ${name}(`);
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

function extractConst(name) {
  const start = app.indexOf(`const ${name} `);
  assert.ok(start >= 0, `No existe la constante ${name} en app.js`);
  const end = app.indexOf(";\n", start);
  return app.slice(start, end + 1);
}

function sandboxWith(names, extra = {}) {
  const context = { ...extra };
  vm.createContext(context);
  vm.runInContext(extractConst("DEFAULT_AGENT_CAIXA_FLOOR"), context);
  names.forEach((name) => vm.runInContext(extractFunction(name), context));
  return context;
}

const round2 = (v) => Math.round((Number(v || 0) + Number.EPSILON) * 100) / 100;

// --- agentCaixaFloor: prioridad y respaldo ------------------------------------------------------

test("colchón unificado · sin operatingReserve configurado, usa el valor heredado de siempre", () => {
  const context = sandboxWith(["agentCaixaFloor", "savingsAgentSettings"], {
    round2,
    state: { operatingReserve: 0 },
    scenarioSettings: { savingsAgent: { caixaFloor: 3200 } },
  });
  assert.equal(context.agentCaixaFloor(), 3200);
});

test("colchón unificado · sin operatingReserve ni valor heredado, cae al default de 2.500", () => {
  const context = sandboxWith(["agentCaixaFloor", "savingsAgentSettings"], {
    round2,
    state: {},
    scenarioSettings: {},
  });
  assert.equal(context.agentCaixaFloor(), 2500);
});

test("colchón unificado · con operatingReserve configurado, manda sobre el valor heredado", () => {
  const context = sandboxWith(["agentCaixaFloor", "savingsAgentSettings"], {
    round2,
    state: { operatingReserve: 4000 },
    scenarioSettings: { savingsAgent: { caixaFloor: 3200 } },
  });
  assert.equal(context.agentCaixaFloor(), 4000, "Ajustes gana, no se queda con la cifra heredada");
});

test("colchón unificado · operatingReserve a 0 (sin configurar explícitamente) no cuenta como «manda»", () => {
  const context = sandboxWith(["agentCaixaFloor", "savingsAgentSettings"], {
    round2,
    state: { operatingReserve: 0 },
    scenarioSettings: { savingsAgent: { caixaFloor: 1800 } },
  });
  assert.equal(context.agentCaixaFloor(), 1800, "0 sigue significando «sin configurar», como en el resto de la app");
});

// --- setAgentCaixaFloor: escribir desde una heredada también fija operatingReserve --------------

function sandboxSetFloor(initialState = {}) {
  const saves = [];
  const context = sandboxWith(["setAgentCaixaFloor", "agentCaixaFloor", "savingsAgentSettings", "syncCaixaFloorControls", "syncOperatingReserveControl"], {
    round2,
    parseAmount: (v) => {
      const raw = String(v ?? "").trim();
      if (!raw) return null;
      const n = Number(raw.replace(",", "."));
      return Number.isFinite(n) ? n : null;
    },
    amountInputValue: (v) => (v === "" || v === null || v === undefined ? "" : String(round2(v))),
    state: initialState,
    scenarioSettings: {},
    savingsAgentPlanCache: { key: "", value: null },
    agentDebtOptimizationCache: { key: "", value: null },
    laboratorioWriteGuard: () => false,
    saveScenarioSettings: () => saves.push(true),
    qs: () => null,
  });
  return { context, getSaves: () => saves };
}

test("colchón unificado · editar el colchón desde una heredada actualiza también operatingReserve", () => {
  const { context, getSaves } = sandboxSetFloor({});
  context.setAgentCaixaFloor("3500");
  assert.equal(context.state.operatingReserve, 3500, "sin esto, el campo heredado parecería «no guardar» tras el siguiente render");
  assert.equal(context.agentCaixaFloor(), 3500);
  assert.equal(getSaves().length, 1);
});

test("colchón unificado · un valor vacío/ inválido en la heredada cae al default, no rompe operatingReserve", () => {
  const { context } = sandboxSetFloor({});
  context.setAgentCaixaFloor("");
  assert.equal(context.state.operatingReserve, 2500);
  assert.equal(context.agentCaixaFloor(), 2500);
});

test("colchón unificado · tras editar por una heredada, el mismo valor ya manda sobre uno heredado antiguo", () => {
  const { context } = sandboxSetFloor({ operatingReserve: 0 });
  // Simula que ya había un valor heredado antiguo distinto guardado antes de esta sesión.
  context.scenarioSettings.savingsAgent = { caixaFloor: 999 };
  context.setAgentCaixaFloor("3500");
  assert.equal(context.agentCaixaFloor(), 3500, "el valor recién editado gana, no el heredado viejo");
});

// --- syncCaixaFloorControls: los tres campos heredados reflejan el valor unificado ---------------

test("colchón unificado · syncCaixaFloorControls también refresca el campo de Ajustes", () => {
  assert.match(
    extractFunction("syncCaixaFloorControls"),
    /syncOperatingReserveControl\(\);/,
    "las tres heredadas y Ajustes deben mostrar siempre la misma cifra",
  );
});

// --- Cableado: la nota de Ajustes menciona los cuatro consumidores nuevos ------------------------

test("colchón unificado · la nota de Ajustes explica que también protege Hoy/Registrar/Ruta/Asesor", () => {
  const source = extractFunction("renderAjustesReserveNote");
  assert.match(source, /Asesor de decisión/);
  assert.match(source, /colchón CaixaBank/);
});
