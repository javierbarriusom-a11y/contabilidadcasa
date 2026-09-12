const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const DebtContracts = require("../canonical-debt-contracts.js");

// DEB10 (Oleada 4, Bloque 6): al amortizar, sugerir en el propio comparador AP1 qué deuda concreta
// tiene mayor coste real según fiscalAdjustedDebtPriority() (DEB5) — antes esa prioridad solo vivía,
// aislada, en Deuda › Contratos, sin cruzarse nunca con la deuda que el hogar elige a mano en
// #ap1DebtSelect (confirmado por VER-4, sesión 166b). Nunca preselecciona nada en silencio: solo
// avisa si la deuda #1 por TAE efectivo coincide o no con la seleccionada, dejando la elección final
// al hogar.

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

function sandbox(contracts) {
  const context = {
    window: { FinanceDebtContracts: DebtContracts },
    debtContractSourceRows: () => contracts,
    escapeHtml: (value) => String(value ?? ""),
  };
  vm.createContext(context);
  vm.runInContext(extractFunction("deb10PriorityHint"), context);
  return context;
}

const CONTRACTS = DebtContracts.normalizeContracts([
  { id: "hipoteca", entity: "Hipoteca con deducción", type: "Hipoteca", currentPrincipal: 150000, apr: 5, currentPayment: 700, fiscalDeductionPct: 80 },
  { id: "personal", entity: "Préstamo personal", type: "Préstamo", currentPrincipal: 8000, apr: 4, currentPayment: 250 },
]).contracts;

test("deb10PriorityHint · sin deudas activas con TAE, no hay nada que sugerir", () => {
  const ctx = sandbox([]);
  assert.equal(ctx.deb10PriorityHint(""), "");
});

test("deb10PriorityHint · con una sola deuda activa, no hay nada que priorizar frente a otra", () => {
  const ctx = sandbox([CONTRACTS[0]]);
  assert.equal(ctx.deb10PriorityHint("hipoteca"), "");
});

test("deb10PriorityHint · la deuda seleccionada coincide con la prioridad fiscal: lo confirma, no avisa", () => {
  const ctx = sandbox(CONTRACTS);
  // Con la deducción del 80%, el préstamo personal (TAE efectivo 4%) queda por delante de la
  // hipoteca (TAE efectivo 1%) — mismo caso ya probado en DEB5.
  const html = ctx.deb10PriorityHint("personal");
  assert.match(html, /Préstamo personal/);
  assert.doesNotMatch(html, /distinta a la seleccionada/);
});

test("deb10PriorityHint · la deuda seleccionada NO coincide con la prioridad fiscal: avisa sin preseleccionar nada", () => {
  const ctx = sandbox(CONTRACTS);
  const html = ctx.deb10PriorityHint("hipoteca");
  assert.match(html, /Préstamo personal/);
  assert.match(html, /distinta a la seleccionada/);
  assert.match(html, /La elección final sigue siendo tuya/);
});

test("deb10PriorityHint · sin id seleccionado todavía, sigue mostrando la sugerencia (aviso, nunca preselección)", () => {
  const ctx = sandbox(CONTRACTS);
  const html = ctx.deb10PriorityHint("");
  assert.match(html, /Préstamo personal/);
  assert.match(html, /distinta a la seleccionada/);
});

test("deb10PriorityHint reutiliza fiscalAdjustedDebtPriority (DEB5) sobre debtContractSourceRows, sin motor propio", () => {
  const block = appSource.slice(appSource.indexOf("function deb10PriorityHint("), appSource.indexOf("function deb10PriorityHint(") + 900);
  assert.match(block, /window\.FinanceDebtContracts/);
  assert.match(block, /fiscalAdjustedDebtPriority\(debtContractSourceRows\(\)\)/);
});

test("wiring: handleAp1Compare llama a deb10PriorityHint con la deuda seleccionada en #ap1DebtSelect", () => {
  const start = appSource.indexOf("function handleAp1Compare(");
  const block = appSource.slice(start, appSource.indexOf("\n}\n", start) + 3);
  assert.match(block, /deb10PriorityHint\(debtId\)/);
});
