const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const indexSource = fs.readFileSync(path.join(root, "index.html"), "utf8");
const inversionSource = fs.readFileSync(path.join(root, "views/inversion.js"), "utf8");

// I13 (BACKLOG_CONTABILIDADCASA_2_0.md §2): comparador de destino para un ingreso extraordinario
// ajeno a la cartera — la otra mitad de lo que describió el hogar sobre I8 (sesión 217). AP1 ya
// compara amortizar/invertir y DLX2 ya reparte el importe entre colchón/deuda/inversión; la única
// pata que faltaba era "objetivo de ahorro" (P-13/P-16), aquí añadida como lectura aparte del
// comparador AP1 ya existente, sin pantalla ni motor financiero nuevo. Las funciones de cálculo
// viven en views/inversion.js, no en app.js (ARQ-4: código de esta pantalla, no un motor
// compartido) — handleAp1Compare (app.js) las llama con una comprobación typeof, por si se invoca
// antes de que ese fragmento lazy (VIEW_CHUNKS) haya cargado.

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `No existe la función ${name}`);
  let parenDepth = 0;
  let bodyStart = -1;
  for (let index = source.indexOf("(", start); index < source.length; index += 1) {
    if (source[index] === "(") parenDepth += 1;
    else if (source[index] === ")") {
      parenDepth -= 1;
      if (parenDepth === 0) {
        bodyStart = source.indexOf("{", index);
        break;
      }
    }
  }
  assert.ok(bodyStart >= 0, `No se encontró el cuerpo de ${name}`);
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

const combinedSource = `${app}\n${inversionSource}`;

function sandboxWith(names, extra = {}) {
  const context = {
    round2: (v) => Math.round((Number(v || 0) + Number.EPSILON) * 100) / 100,
    escapeHtml: (v) => String(v ?? ""),
    money: (v) => `${Number(v || 0).toFixed(2)} €`,
    ...extra,
  };
  vm.createContext(context);
  names.forEach((name) => vm.runInContext(extractFunction(combinedSource, name), context));
  return context;
}

// --- i13SavingsGoalImpact -------------------------------------------------------------------------

test("I13 · i13SavingsGoalImpact no es calculable sin importe o sin importe objetivo declarado", () => {
  const ctx = sandboxWith(["i13SavingsGoalImpact"]);
  assert.equal(ctx.i13SavingsGoalImpact({ amount: 0, targetAmount: 500, accumulated: 100 }).calculable, false);
  assert.equal(ctx.i13SavingsGoalImpact({ amount: 200, targetAmount: 0, accumulated: 0 }).calculable, false);
});

test("I13 · i13SavingsGoalImpact calcula lo que falta antes y después, sin completar el objetivo", () => {
  const ctx = sandboxWith(["i13SavingsGoalImpact"]);
  const result = ctx.i13SavingsGoalImpact({ amount: 300, targetAmount: 1000, accumulated: 200 });
  assert.equal(result.calculable, true);
  assert.equal(result.remainingBefore, 800);
  assert.equal(result.remainingAfter, 500);
  assert.equal(result.completed, false);
  assert.equal(result.leftover, 0);
});

test("I13 · i13SavingsGoalImpact marca el objetivo completado y declara el sobrante, sin perderlo", () => {
  const ctx = sandboxWith(["i13SavingsGoalImpact"]);
  const result = ctx.i13SavingsGoalImpact({ amount: 900, targetAmount: 1000, accumulated: 700 });
  assert.equal(result.remainingBefore, 300);
  assert.equal(result.remainingAfter, 0);
  assert.equal(result.completed, true);
  assert.equal(result.leftover, 600);
});

// --- i13SavingsGoalImpactHtml ----------------------------------------------------------------------

test("I13 · i13SavingsGoalImpactHtml no devuelve nada sin resultado calculable", () => {
  const ctx = sandboxWith(["i13SavingsGoalImpactHtml"]);
  assert.equal(ctx.i13SavingsGoalImpactHtml({ calculable: false }, "Coche"), "");
  assert.equal(ctx.i13SavingsGoalImpactHtml(null, "Coche"), "");
});

test("I13 · i13SavingsGoalImpactHtml dice cuánto queda antes y después, con el nombre del objetivo", () => {
  const ctx = sandboxWith(["i13SavingsGoalImpactHtml"]);
  const out = ctx.i13SavingsGoalImpactHtml({ calculable: true, amount: 300, remainingBefore: 800, remainingAfter: 500, completed: false, leftover: 0 }, "Coche");
  assert.match(out, /Coche/);
  assert.match(out, /800\.00 €/);
  assert.match(out, /500\.00 €/);
});

test("I13 · i13SavingsGoalImpactHtml declara el sobrante cuando el objetivo queda completado", () => {
  const ctx = sandboxWith(["i13SavingsGoalImpactHtml"]);
  const out = ctx.i13SavingsGoalImpactHtml({ calculable: true, amount: 900, remainingBefore: 300, remainingAfter: 0, completed: true, leftover: 600 }, "Fondo");
  assert.match(out, /lo completas/);
  assert.match(out, /Sobran 600\.00 €/);
});

// --- ap1SavingsGoalOptionsHtml ----------------------------------------------------------------------

test("I13 · ap1SavingsGoalOptionsHtml ofrece «Sin objetivo» y solo objetivos incompletos con importe declarado", () => {
  const ctx = sandboxWith(
    ["ap1SavingsGoalOptionsHtml", "savingsGoalsList", "savingsGoalsContributions"],
    {
      scenarioSettings: {
        savingsGoals: [
          { id: "g1", label: "Coche", targetAmount: 5000 },
          { id: "g2", label: "Ya completo", targetAmount: 500 },
          { id: "g3", label: "Sin importe", targetAmount: 0 },
        ],
      },
      monthClosures: [
        { status: "closed", monthKey: "2026-05", closedAt: "2026-06-01T00:00:00.000Z", envelopeSettlements: [{ rowKey: "x", destino: "objetivo:g2", saldo: 500 }] },
      ],
    },
  );
  const options = ctx.ap1SavingsGoalOptionsHtml();
  assert.match(options, /Sin objetivo/);
  assert.match(options, /Coche/);
  assert.doesNotMatch(options, /Ya completo/);
  assert.doesNotMatch(options, /Sin importe/);
});

// --- Cableado en la app -------------------------------------------------------------------------

test("I13 · el selector de objetivo vive en la tarjeta de AP1, junto al importe", () => {
  assert.match(indexSource, /id="ap1SavingsGoalSelect"/);
  const amountPos = indexSource.indexOf('id="ap1Amount"');
  const selectPos = indexSource.indexOf('id="ap1SavingsGoalSelect"');
  assert.ok(selectPos > amountPos && selectPos - amountPos < 800, "El selector de objetivo debe ir justo después del importe");
});

test("I13 · handleAp1Compare calcula el impacto en el objetivo elegido con el mismo importe declarado", () => {
  const block = app.slice(app.indexOf("function handleAp1Compare("), app.indexOf("function handleAp1Compare(") + 5300);
  assert.match(block, /qs\("ap1SavingsGoalSelect"\)\?\.value/);
  assert.match(block, /i13SavingsGoalImpact\(\{ amount, targetAmount: goal\.targetAmount/);
  assert.match(block, /goal \? i13SavingsGoalImpactHtml\(i13SavingsGoalImpact\(/);
});

test("I13 · sin objetivo elegido, i13SavingsGoalHtml queda vacío en vez de fabricar una lectura", () => {
  const block = app.slice(app.indexOf("function handleAp1Compare("), app.indexOf("function handleAp1Compare(") + 5300);
  assert.match(block, /const i13SavingsGoalHtml = .*\(\(goal\) => goal \? i13SavingsGoalImpactHtml/);
  assert.match(block, /savingsGoalsList\(\)\.find\(\(goal\) => goal\.id === \(qs\("ap1SavingsGoalSelect"\)\?\.value \|\| null\)\) \|\| null\)/);
  assert.match(block, /\+ i13SavingsGoalHtml;/);
});

test("I13 · las funciones de cálculo viven en views/inversion.js, no en app.js (ARQ-4)", () => {
  assert.doesNotMatch(app, /function i13SavingsGoalImpact\(/);
  assert.doesNotMatch(app, /function i13SavingsGoalImpactHtml\(/);
  assert.doesNotMatch(app, /function ap1SavingsGoalOptionsHtml\(/);
  assert.match(inversionSource, /function i13SavingsGoalImpact\(/);
  assert.match(inversionSource, /function i13SavingsGoalImpactHtml\(/);
  assert.match(inversionSource, /function ap1SavingsGoalOptionsHtml\(/);
});

test("I13 · el selector de objetivo se rellena al abrir Deuda › Apalancamiento, tras la cola de AP5", () => {
  assert.match(inversionSource, /renderAp5Queue\(\);\s*\n\s*renderAp1SavingsGoalOptions\(\);/);
});
