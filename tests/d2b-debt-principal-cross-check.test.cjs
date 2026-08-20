const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

// D-2b · el capital que se corrige en Deuda › Contratos (D-2) y la "deuda viva global" que ya leen
// Hoy, Ruta y Comparar (homeDebtOutlook().pendingPrincipal) suman por caminos distintos: una
// reunificada cuenta con su propio capital declarado aquí, pero la cifra global la sustituye por el
// plan combinado sintético, fijado al capital que tenía cuando se reunificó. debtPrincipalCrossCheck
// resta ese hueco esperado antes de comparar, para que cualquier OTRA diferencia no se calle.

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

function sandboxWith(names, extra = {}) {
  const context = { ...extra };
  vm.createContext(context);
  vm.runInContext(names.map((name) => extractFunction(name)).join("\n"), context);
  return context;
}

const round2 = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
const sumRows = (rows, pick) => rows.reduce((sum, row) => sum + Number(pick(row) || 0), 0);

function sandboxCrossCheck({ contracts, pendingPrincipal, overrides = {} }) {
  return sandboxWith(["debtPrincipalCrossCheck"], {
    round2,
    sumRows,
    debtContractOverrides: overrides,
    debtContractSourceRows: () => contracts,
    debtPortfolioTotals: (rows) => ({ currentPrincipal: round2(sumRows(rows, (row) => row.currentPrincipal)) }),
    homeDebtOutlook: () => ({ pendingPrincipal }),
  });
}

// --- Sin deuda reunificada: declarado y global deben coincidir tal cual ------------------------

test("D-2b · sin reunificadas, cuadra cuando declarado y global coinciden", () => {
  const contracts = [
    { id: "debt-1", entity: "Entidad A", currentPrincipal: 6000, initialPrincipal: 8000, paymentStatus: "active" },
    { id: "debt-2", entity: "Entidad B", currentPrincipal: 3500, initialPrincipal: 3500, paymentStatus: "active" },
  ];
  const context = sandboxCrossCheck({ contracts, pendingPrincipal: 9500 });
  const check = context.debtPrincipalCrossCheck();
  assert.equal(check.declared, 9500);
  assert.equal(check.global, 9500);
  assert.equal(check.diff, 0);
  assert.equal(check.status, "cuadra");
  assert.deepEqual(check.overriddenReunified, []);
});

test("D-2b · sin reunificadas, descuadra si la cifra global no coincide con lo declarado", () => {
  const contracts = [{ id: "debt-1", entity: "Entidad A", currentPrincipal: 6000, initialPrincipal: 6000, paymentStatus: "active" }];
  const context = sandboxCrossCheck({ contracts, pendingPrincipal: 6500 });
  const check = context.debtPrincipalCrossCheck();
  assert.equal(check.diff, 500);
  assert.equal(check.status, "descuadra");
});

// --- Con deuda reunificada: la sustitución por capital inicial es el hueco esperado -------------

test("D-2b · una reunificada cuenta con su capital inicial en la global, y eso cuadra", () => {
  const contracts = [
    { id: "debt-1", entity: "Cetelem", currentPrincipal: 1200, initialPrincipal: 4000, paymentStatus: "reunified" },
    { id: "debt-2", entity: "Entidad B", currentPrincipal: 3500, initialPrincipal: 3500, paymentStatus: "active" },
  ];
  // Declarado: 1200 (reunificada) + 3500 = 4700. Global: sustituye la reunificada por su capital
  // inicial (4000) en vez del corregido (1200): 4000 + 3500 = 7500.
  const context = sandboxCrossCheck({ contracts, pendingPrincipal: 7500 });
  const check = context.debtPrincipalCrossCheck();
  assert.equal(check.declared, 4700);
  assert.equal(check.expectedGlobal, 7500);
  assert.equal(check.diff, 0);
  assert.equal(check.status, "cuadra");
});

test("D-2b · si la global no refleja ni siquiera la sustitución esperada, descuadra de verdad", () => {
  const contracts = [{ id: "debt-1", entity: "Cetelem", currentPrincipal: 1200, initialPrincipal: 4000, paymentStatus: "reunified" }];
  // expectedGlobal = 4000 (sustitución), pero la cifra global real llega distinta (p. ej. una
  // caché desincronizada) — no se calla como si el hueco de reunificación lo explicara todo.
  const context = sandboxCrossCheck({ contracts, pendingPrincipal: 4300 });
  const check = context.debtPrincipalCrossCheck();
  assert.equal(check.expectedGlobal, 4000);
  assert.equal(check.diff, 300);
  assert.equal(check.status, "descuadra");
});

// --- overriddenReunified: solo reunificadas con el capital corregido a mano ---------------------

test("D-2b · overriddenReunified solo incluye reunificadas con currentPrincipal editado a mano", () => {
  const contracts = [
    { id: "debt-1", entity: "Cetelem", currentPrincipal: 1200, initialPrincipal: 4000, paymentStatus: "reunified" },
    { id: "debt-2", entity: "Otra reunificada", currentPrincipal: 500, initialPrincipal: 500, paymentStatus: "reunified" },
    { id: "debt-3", entity: "Activa", currentPrincipal: 3500, initialPrincipal: 3500, paymentStatus: "active" },
  ];
  const overrides = {
    "debt-1": { currentPrincipal: 1200 },
    "debt-2": { apr: 9 },
    "debt-3": { currentPrincipal: 3500 },
  };
  const context = sandboxCrossCheck({ contracts, pendingPrincipal: 4000 + 500 + 3500, overrides });
  const check = context.debtPrincipalCrossCheck();
  assert.deepEqual(
    check.overriddenReunified.map((row) => row.id),
    ["debt-1"],
    "debt-2 no tiene corregido el capital (solo TAE) y debt-3 no es reunificada"
  );
});

// --- Pintado por fila: el aviso solo aparece en reunificadas con capital corregido ---------------

function sandboxRow() {
  const context = {
    escapeHtml: (value) => String(value ?? ""),
    round2,
  };
  vm.createContext(context);
  vm.runInContext(
    [extractFunction("deudaContratosStatusBadge"), extractFunction("deudaContratosQualityBadge"), extractFunction("deudaContratosRowHtml")].join("\n"),
    context
  );
  return context;
}

const baseQuality = { missing: [], confidence: "high" };

test("D-2b · el aviso «sin efecto en deuda global» solo aparece en reunificada con capital editado", () => {
  const context = sandboxRow();
  context.debtContractOverrides = { "debt-1": { currentPrincipal: 1200 } };
  const reunified = { id: "debt-1", entity: "Cetelem", type: "Plan reunificado", number: "", currentPrincipal: 1200, currentPayment: 0, apr: null, paymentStatus: "reunified", dataQuality: baseQuality };
  assert.match(context.deudaContratosRowHtml(reunified), /Sin efecto en deuda global/);
});

test("D-2b · sin corregir el capital, una reunificada no lleva el aviso aunque tenga otro override", () => {
  const context = sandboxRow();
  context.debtContractOverrides = { "debt-1": { apr: 9 } };
  const reunified = { id: "debt-1", entity: "Cetelem", type: "Plan reunificado", number: "", currentPrincipal: 1200, currentPayment: 0, apr: 9, paymentStatus: "reunified", dataQuality: baseQuality };
  assert.doesNotMatch(context.deudaContratosRowHtml(reunified), /Sin efecto en deuda global/);
});

test("D-2b · un contrato activo con el capital editado nunca lleva el aviso de reunificación", () => {
  const context = sandboxRow();
  context.debtContractOverrides = { "debt-1": { currentPrincipal: 5000 } };
  const active = { id: "debt-1", entity: "Entidad A", type: "Crédito", number: "", currentPrincipal: 5000, currentPayment: 180, apr: 12, paymentStatus: "active", dataQuality: baseQuality };
  assert.doesNotMatch(context.deudaContratosRowHtml(active), /Sin efecto en deuda global/);
});

// --- Pintado del cuadre: badge y nota de reunificadas editadas ----------------------------------

function sandboxHtml() {
  const context = { escapeHtml: (value) => String(value ?? ""), money: (value) => `${value} €` };
  vm.createContext(context);
  vm.runInContext(extractFunction("debtPrincipalCrossCheckHtml"), context);
  return context;
}

test("D-2b · debtPrincipalCrossCheckHtml pinta el badge de cuadra en verde y sin nota de reunificadas", () => {
  const context = sandboxHtml();
  const html = context.debtPrincipalCrossCheckHtml({ declared: 9500, global: 9500, diff: 0, status: "cuadra", overriddenReunified: [] });
  assert.match(html, /e19-badge-success">Cuadra/);
  assert.doesNotMatch(html, /reunificado\(s\) con el capital corregido/);
});

test("D-2b · debtPrincipalCrossCheckHtml pinta el badge de descuadra en rojo y lista las reunificadas editadas", () => {
  const context = sandboxHtml();
  const html = context.debtPrincipalCrossCheckHtml({
    declared: 4700,
    global: 4300,
    diff: -400,
    status: "descuadra",
    overriddenReunified: [{ entity: "Cetelem" }],
  });
  assert.match(html, /e19-badge-danger">Descuadra/);
  assert.match(html, /1 contrato\(s\) reunificado\(s\) con el capital corregido a mano.*Cetelem/s);
});
