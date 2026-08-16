const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const app = read("app.js");
const html = read("index.html");

// H-5 (auditoría del 15 de agosto, Prioridad 3) · el criterio pide que «el primer botón sea
// primario y navegue a vista y pestaña (01 abre Registrar › Importar extracto)». Dos gaps reales:
// homeDecisionCandidates no tenía ninguna candidata sobre movimientos sin incorporar (el ejemplo
// "01" del criterio), y ningún target navegaba más allá de la vista — REGISTRAR_LEGACY_HASH_TABS ya
// traduce una clave heredada a "registrar" + su pestaña dentro de setActiveView, pero el
// guardarraíl de cada manejador de data-home-nav (pensado para no pasarle basura a setActiveView)
// bloqueaba también esas claves legítimas antes de llegar ahí.

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
  const start = app.indexOf(`const ${name} =`);
  assert.ok(start >= 0, `No existe la constante ${name} en app.js`);
  let index = app.indexOf("=", start) + 1;
  while (!"([{".includes(app[index])) index += 1;
  let depth = 0;
  let inString = null;
  for (; index < app.length; index += 1) {
    const ch = app[index];
    if (inString) {
      if (ch === "\\") { index += 1; continue; }
      if (ch === inString) inString = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") { inString = ch; continue; }
    if ("([{".includes(ch)) depth += 1;
    else if (")]}".includes(ch)) {
      depth -= 1;
      if (depth === 0) {
        let end = index + 1;
        if (app[end] === ";") end += 1;
        return app.slice(start, end);
      }
    }
  }
  throw new Error(`No se pudo balancear la constante ${name}`);
}

function sandbox(names, extra = {}) {
  const context = { Object, Boolean, ...extra };
  vm.createContext(context);
  [extractConst("REGISTRAR_LEGACY_HASH_TABS"), ...names.map((name) => extractFunction(name))].forEach((source) => vm.runInContext(source, context));
  return context;
}

// --- homeImportSessionCandidate --------------------------------------------------------------

test("H-5 · sin sesión de importación abierta, no hay candidata", () => {
  const context = sandbox(["homeImportSessionCandidate"], { datosImportarSession: null, datosImportarCounters: () => ({}) });
  assert.equal(context.homeImportSessionCandidate(), null);
});

test("H-5 · con una sesión abierta, la candidata nombra el fichero y navega a Registrar › Importar extracto", () => {
  const context = sandbox(["homeImportSessionCandidate"], {
    datosImportarSession: { fileMeta: { fileName: "extracto-agosto.csv" }, rows: [1, 2, 3] },
    datosImportarCounters: () => ({ total: 3, pidenDecision: 2 }),
  });
  const candidate = context.homeImportSessionCandidate();
  assert.match(candidate.text, /extracto-agosto\.csv/);
  assert.match(candidate.text, /3 movimiento\(s\) cargados, 2 piden decisión/);
  assert.equal(candidate.target, "datos-importar");
  assert.equal(candidate.cta, "Continuar importación");
  assert.equal(candidate.status, "warn");
});

test("H-5 · sin decisiones pendientes en la sesión, el estado no alarma (neutral, no warn)", () => {
  const context = sandbox(["homeImportSessionCandidate"], {
    datosImportarSession: { fileMeta: { fileName: "extracto.csv" }, rows: [1] },
    datosImportarCounters: () => ({ total: 1, pidenDecision: 0 }),
  });
  assert.equal(context.homeImportSessionCandidate().status, "neutral");
});

// --- homeDecisionCandidates: la candidata de importación entra en juego -----------------------

test("H-5 · homeDecisionCandidates incluye la candidata de importación cuando existe", () => {
  const context = sandbox(["homeDecisionCandidates"], {
    homeImportSessionCandidate: () => ({ title: "Movimientos por incorporar", target: "datos-importar", cta: "Continuar importación", expiresAt: "" }),
    homeOpenOfferInsight: () => null,
    homeDebtReviewReminders: () => [],
    homeEscenarioReviewReminders: () => [],
    evaluatedUxAlerts: () => [],
    escenarioMotorMonthLabel: (v) => v,
    shortDate: (v) => v,
    debtTargetDisplayName: () => "",
    money: () => "",
  });
  const decisions = context.homeDecisionCandidates({ actionCenter: {}, offer: null, debtPriorities: [], loadedDecisions: [], debtRatioStatus: "good" });
  assert.equal(decisions.length, 1);
  assert.equal(decisions[0].title, "Movimientos por incorporar");
  assert.equal(decisions[0].target, "datos-importar");
});

test("H-5 · sin sesión de importación, homeDecisionCandidates no inventa ninguna candidata", () => {
  const context = sandbox(["homeDecisionCandidates"], {
    homeImportSessionCandidate: () => null,
    homeOpenOfferInsight: () => null,
    homeDebtReviewReminders: () => [],
    homeEscenarioReviewReminders: () => [],
    evaluatedUxAlerts: () => [],
    escenarioMotorMonthLabel: (v) => v,
    shortDate: (v) => v,
    debtTargetDisplayName: () => "",
    money: () => "",
  });
  const decisions = context.homeDecisionCandidates({ actionCenter: {}, offer: null, debtPriorities: [], loadedDecisions: [], debtRatioStatus: "good" });
  assert.equal(decisions.length, 0);
});

// --- homeNavTargetIsValid: acepta vistas reales y claves heredadas de Registrar ----------------

test("H-5 · homeNavTargetIsValid acepta una vista real", () => {
  const context = sandbox(["homeNavTargetIsValid"], {
    document: { getElementById: (id) => (id === "deuda-ruta" ? { classList: { contains: () => true } } : null) },
  });
  assert.equal(context.homeNavTargetIsValid("deuda-ruta"), true);
});

test("H-5 · homeNavTargetIsValid acepta una clave heredada de Registrar (datos-importar) aunque no sea una vista real", () => {
  const context = sandbox(["homeNavTargetIsValid"], {
    document: { getElementById: () => null },
  });
  assert.equal(context.homeNavTargetIsValid("datos-importar"), true);
  assert.equal(context.homeNavTargetIsValid("update-hub"), true);
  assert.equal(context.homeNavTargetIsValid("data-entry"), true);
});

test("H-5 · homeNavTargetIsValid rechaza un target vacío o inventado", () => {
  const context = sandbox(["homeNavTargetIsValid"], {
    document: { getElementById: () => null },
  });
  assert.equal(context.homeNavTargetIsValid(""), false);
  assert.equal(context.homeNavTargetIsValid(null), false);
  assert.equal(context.homeNavTargetIsValid("no-existe"), false);
});

// --- Cableado: el manejador de #home usa homeNavTargetIsValid, no el chequeo de vista-real a pelo ---

test("H-5 · el manejador de clics de #home usa homeNavTargetIsValid en vez del chequeo de vista-real directo", () => {
  const start = app.indexOf('qs("home")?.addEventListener("click"');
  assert.ok(start >= 0, "No se encontró el manejador de clics de #home");
  const snippet = app.slice(start, start + 400);
  assert.match(snippet, /homeNavTargetIsValid\(target\)/);
});

// --- index.html: el contenedor de decisiones vive dentro de #home -------------------------------

test("H-5 · index.html declara #homeActions dentro de la sección #home", () => {
  const start = html.indexOf('id="home"');
  assert.ok(start >= 0, "No se encontró la sección #home");
  // #home es la sección raíz de Hoy: basta con comprobar que #homeActions aparece razonablemente
  // cerca, antes de que el marcado pase a otra pantalla.
  assert.match(html.slice(start, start + 20000), /id="homeActions"/);
});
