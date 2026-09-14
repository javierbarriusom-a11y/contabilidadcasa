const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const app = read("app.js");
const html = read("index.html");
const Restructuring = require("../canonical-joint-restructuring.js");

// GOB19 (Oleada 4, Bloque 7, O-12): plantilla de separación patrimonial. Sin motor propio: combina la
// titularidad de deuda ya declarada (E14, p2State().ownership) con canonical-joint-restructuring.js
// (DI5) — llamado una vez por titular con su ingreso individual tras la separación, en vez de una sola
// vez con el ingreso conjunto — y el saldo pendiente de gastos compartidos que ya calcula A18
// (a18CurrentProposal). No reparte activos: A14 no declara titular por posición.

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

function extractConst(name) {
  const match = new RegExp(`const ${name} = (\\{[^;]*\\});`).exec(app);
  assert.ok(match, `No existe la constante ${name} en app.js`);
  return `const ${name} = ${match[1]};`;
}

function sandboxWith(names, extra = {}) {
  const context = {
    escapeHtml: (v) => String(v ?? ""),
    money: (v) => `${Number(v || 0).toFixed(2)} €`,
    parseAmount: (value) => { const n = Number(String(value ?? "").replace(",", ".")); return Number.isFinite(n) ? n : 0; },
    window: { FinanceCanonicalJointRestructuring: Restructuring, P2Domain: extra.P2Domain },
    ...extra,
  };
  vm.createContext(context);
  vm.runInContext(extractConst("GOB19_OWNER_LABELS"), context);
  vm.runInContext(extractConst("A18_OWNER_LABELS"), context);
  names.forEach((name) => vm.runInContext(extractFunction(name), context));
  return context;
}

function contractRow(overrides = {}) {
  return { id: "c1", entity: "Banco X", number: "n1", type: "Préstamo", paymentStatus: "active", currentPrincipal: 10000, apr: 10, remainingInstallments: 24, currentPayment: 461.45, ...overrides };
}

// --- gob19DebtsByOwner ---------------------------------------------------------------------------

test("gob19DebtsByOwner · agrupa la deuda activa por el titular ya declarado en p2State().ownership", () => {
  const ctx = sandboxWith(["di5RestructuringContracts", "gob19DebtsByOwner"], {
    debtContractSourceRows: () => [
      contractRow({ id: "c1" }),
      contractRow({ id: "c2", entity: "Banco Y" }),
      contractRow({ id: "c3", entity: "Banco Z" }),
    ],
    p2State: () => ({ ownership: { "debt|c1": "javi", "debt|c2": "tere" } }),
  });
  const grouped = ctx.gob19DebtsByOwner();
  assert.equal(grouped.javi.map((c) => c.id).join(","), "c1");
  assert.equal(grouped.tere.map((c) => c.id).join(","), "c2");
  assert.equal(grouped.household.map((c) => c.id).join(","), "c3");
});

test("gob19DebtsByOwner · sin titular declarado, cae a P2Domain.inferOwner y luego a household", () => {
  const ctx = sandboxWith(["di5RestructuringContracts", "gob19DebtsByOwner"], {
    debtContractSourceRows: () => [contractRow({ id: "c1", entity: "Nomina Tere" })],
    p2State: () => ({ ownership: {} }),
    P2Domain: { inferOwner: (label) => (/tere/i.test(label) ? "tere" : "household") },
  });
  const grouped = ctx.gob19DebtsByOwner();
  assert.equal(grouped.tere.map((c) => c.id).join(","), "c1");
  assert.equal(grouped.household.length, 0);
});

test("gob19DebtsByOwner · sin P2Domain ni ownership declarado, cae a household, nunca inventa un titular", () => {
  const ctx = sandboxWith(["di5RestructuringContracts", "gob19DebtsByOwner"], {
    debtContractSourceRows: () => [contractRow({ id: "c1" })],
    p2State: () => ({ ownership: {} }),
  });
  const grouped = ctx.gob19DebtsByOwner();
  assert.equal(grouped.household.map((c) => c.id).join(","), "c1");
});

test("gob19DebtsByOwner · solo deuda activa con cuota (mismo filtro que DI5), la liquidada no cuenta", () => {
  const ctx = sandboxWith(["di5RestructuringContracts", "gob19DebtsByOwner"], {
    debtContractSourceRows: () => [
      contractRow({ id: "c1" }),
      contractRow({ id: "c2", paymentStatus: "settled" }),
      contractRow({ id: "c3", currentPayment: 0 }),
    ],
    p2State: () => ({ ownership: { "debt|c1": "javi", "debt|c2": "javi", "debt|c3": "javi" } }),
  });
  const grouped = ctx.gob19DebtsByOwner();
  assert.equal(grouped.javi.map((c) => c.id).join(","), "c1");
});

// --- gob19RestructuringSectionHtml ---------------------------------------------------------------

test("gob19RestructuringSectionHtml · sin deuda asignada, lo dice sin pedir ingreso", () => {
  const ctx = sandboxWith(["gob19RestructuringSectionHtml"]);
  const result = ctx.gob19RestructuringSectionHtml("javi", 0, [], 0.32);
  assert.match(result, /Javi/);
  assert.match(result, /sin deuda propia asignada/);
});

test("gob19RestructuringSectionHtml · con deuda pero sin ingreso, pide el ingreso antes de comparar", () => {
  const ctx = sandboxWith(["gob19RestructuringSectionHtml"]);
  const contracts = [{ id: "c1", label: "Banco X", balance: 10000, rate: 10, monthsRemaining: 24, monthlyPayment: 461.45 }];
  const result = ctx.gob19RestructuringSectionHtml("tere", 0, contracts, 0.32);
  assert.match(result, /Tere/);
  assert.match(result, /indica su ingreso mensual tras la separación/);
  assert.match(result, /1 contrato/);
});

test("gob19RestructuringSectionHtml · cuota por debajo del ratio seguro, sin necesidad de reestructurar", () => {
  const ctx = sandboxWith(["gob19RestructuringSectionHtml"]);
  const contracts = [{ id: "c1", label: "Banco X", balance: 10000, rate: 10, monthsRemaining: 24, monthlyPayment: 461.45 }];
  const result = ctx.gob19RestructuringSectionHtml("javi", 4000, contracts, 0.32);
  assert.match(result, /Sin necesidad de reestructurar/);
});

test("gob19RestructuringSectionHtml · por encima del ratio, reutiliza jointRestructuringPlan (mismo motor que DI5) para proponer alargar plazo", () => {
  const ctx = sandboxWith(["gob19RestructuringSectionHtml"]);
  const contracts = [{ id: "c1", label: "Banco X", balance: 10000, rate: 10, monthsRemaining: 24, monthlyPayment: 461.45 }];
  const result = ctx.gob19RestructuringSectionHtml("javi", 1000, contracts, 0.32);
  assert.match(result, /Banco X/);
  assert.match(result, /alargar de 24 a 36 meses/);
});

// --- handleGob19SeparationTemplate ---------------------------------------------------------------

function noteSandbox(extra = {}) {
  const note = { innerHTML: "" };
  const incomeJavi = { value: extra.incomeJavi ?? "" };
  const incomeTere = { value: extra.incomeTere ?? "" };
  const ctx = sandboxWith(
    ["di5RestructuringContracts", "gob19DebtsByOwner", "gob19RestructuringSectionHtml", "handleGob19SeparationTemplate"],
    {
      qs: (id) => {
        if (id === "gob19SeparationNote") return note;
        if (id === "gob19IncomeJavi") return incomeJavi;
        if (id === "gob19IncomeTere") return incomeTere;
        return null;
      },
      debtContractSourceRows: extra.debtContractSourceRows || (() => []),
      p2State: extra.p2State || (() => ({ ownership: {} })),
      alertThresholdOverride: extra.alertThresholdOverride || (() => 32),
      a18CurrentProposal: extra.a18CurrentProposal || (() => ({ hasPendingBalance: false, entryIds: [] })),
    },
  );
  return { ctx, note };
}

test("handleGob19SeparationTemplate · sin saldo pendiente, lo dice explícitamente", () => {
  const { ctx, note } = noteSandbox();
  ctx.handleGob19SeparationTemplate();
  assert.match(note.innerHTML, /Sin saldo pendiente de gastos compartidos/);
});

test("handleGob19SeparationTemplate · con saldo pendiente, avisa de liquidarlo antes de separar cuentas", () => {
  const { ctx, note } = noteSandbox({
    a18CurrentProposal: () => ({ hasPendingBalance: true, amount: 150, from: "tere", to: "javi", entryIds: ["e1"] }),
  });
  ctx.handleGob19SeparationTemplate();
  assert.match(note.innerHTML, /Antes de separar cuentas, liquida el saldo pendiente/);
  assert.match(note.innerHTML, /Tere debe a Javi/);
});

test("handleGob19SeparationTemplate · avisa de la deuda activa sin titular asignado (household), sin repartirla en silencio", () => {
  const { ctx, note } = noteSandbox({
    debtContractSourceRows: () => [contractRow({ id: "c1" }), contractRow({ id: "c2" })],
    p2State: () => ({ ownership: {} }),
  });
  ctx.handleGob19SeparationTemplate();
  assert.match(note.innerHTML, /2 deuda\(s\) activa\(s\) siguen a nombre de «Hogar»/);
});

test("handleGob19SeparationTemplate · reparte la deuda entre Javi y Tere según su titularidad y reestructura cada uno con su propio ingreso", () => {
  const { ctx, note } = noteSandbox({
    incomeJavi: "1000",
    incomeTere: "4000",
    debtContractSourceRows: () => [contractRow({ id: "c1" }), contractRow({ id: "c2", entity: "Banco Y" })],
    p2State: () => ({ ownership: { "debt|c1": "javi", "debt|c2": "tere" } }),
  });
  ctx.handleGob19SeparationTemplate();
  assert.match(note.innerHTML, /Javi.*alargar de 24 a 36 meses/s);
  assert.match(note.innerHTML, /Tere.*Sin necesidad de reestructurar/s);
});

test("no persiste nada en scenarioSettings: es una calculadora puntual, como DI5", () => {
  const body = extractFunction("handleGob19SeparationTemplate");
  assert.doesNotMatch(body, /saveScenarioSettings/);
});

// --- wiring ----------------------------------------------------------------------------------------

test("wiring: la tarjeta vive en #ajustes-hogar, junto a GOB10, con sus campos, botón y nota", () => {
  const openTag = /<div[^>]*class="e19-ajustes-group"[^>]*id="ajustes-hogar"[^>]*>/.exec(html);
  assert.ok(openTag, "No existe el grupo #ajustes-hogar");
  const start = openTag.index + openTag[0].length;
  const end = html.indexOf('id="ajustes-reserva"', start);
  const group = html.slice(start, end);
  assert.match(group, /Registro de decisiones con revisión programada/);
  const gob19Start = group.indexOf("Plantilla de separación patrimonial");
  assert.ok(gob19Start > group.indexOf("Registro de decisiones con revisión programada"), "GOB19 debe ir después de GOB10");
  const card = group.slice(gob19Start, gob19Start + 1600);
  assert.match(card, /id="gob19IncomeJavi"/);
  assert.match(card, /id="gob19IncomeTere"/);
  assert.match(card, /id="gob19SeparationCompare"/);
  assert.match(card, /id="gob19SeparationNote"/);
});

test("wiring: el botón está cableado y tiene ayuda contextual", () => {
  assert.match(app, /qs\("gob19SeparationCompare"\)\?\.addEventListener\("click", handleGob19SeparationTemplate\)/);
  assert.match(app, /qs\("gob19SeparationCompare"\)\?\.setAttribute\("data-help"/);
});
