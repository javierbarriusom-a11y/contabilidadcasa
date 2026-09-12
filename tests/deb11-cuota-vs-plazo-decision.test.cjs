const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const CushionEngine = require("../canonical-cushion.js");
const DebtComparator = require("../canonical-debt-comparator.js");

// DEB11 (Oleada 4, Bloque 6): dimensionOptimalPrepayment (DEB2) ya dice CUÁNTO amortizar de verdad
// (neto de comisión) del excedente que DLX2 destina a esta deuda, pero no si ese importe debería
// reducir cuota o plazo. Reutiliza tal cual amortizeReduceQuotaVsTerm (APX6) sobre el importe neto de
// DEB2 (no el importe bruto tecleado en AP1, que ya usa APX6 por su cuenta) y añade una preferencia
// declarada persistida (mismo patrón que DEB7) para que la elección quede explícita.

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

function extractDeb11Block() {
  const start = appSource.indexOf("const DEB11_PREFERENCE_LABEL");
  const endFn = extractFunction("deb11ReduceQuotaVsTermHtml");
  const end = appSource.indexOf(endFn) + endFn.length;
  return appSource.slice(start, end);
}

function sandbox({ debts = [], contracts = [], preference = "" } = {}) {
  const context = {
    window: { FinanceCanonicalCushion: CushionEngine, FinanceDebtComparator: DebtComparator },
    state: { deb11Preference: preference },
    document: { activeElement: null },
    domValues: { ap1DebtSelect: "", ap1PrepaymentPenaltyPct: "0", ap1DebtRate: "0" },
    qs: (id) => {
      if (id === "deb11PreferenceSelect") return { value: preference };
      if (id in context.domValues) return { value: context.domValues[id] };
      return null;
    },
    parseAmount: (value) => (value === "" || value === undefined ? NaN : Number(value)),
    money: (value) => `${Math.round(value)}€`,
    p2DebtRows: () => debts,
    debtContractSourceRows: () => contracts,
    saveScenarioSettings: () => {},
    handleAp1Compare: () => {},
  };
  vm.createContext(context);
  vm.runInContext(extractDeb11Block(), context);
  return context;
}

const DEBT = { id: "hipoteca", currentPrincipal: 10000 };
const CONTRACT = { id: "hipoteca", remainingInstallments: 24 };

test("deb11ReduceQuotaVsTermHtml · sin reparto hacia esta deuda (toDebt = 0), no hay nada que mostrar", () => {
  const ctx = sandbox({ debts: [DEBT], contracts: [CONTRACT] });
  ctx.domValues.ap1DebtSelect = "hipoteca";
  const html = ctx.deb11ReduceQuotaVsTermHtml({ calculable: true, toDebt: 0 });
  assert.equal(html, "");
});

test("deb11ReduceQuotaVsTermHtml · sin deuda seleccionada, no hay nada que mostrar", () => {
  const ctx = sandbox({ debts: [DEBT], contracts: [CONTRACT] });
  const html = ctx.deb11ReduceQuotaVsTermHtml({ calculable: true, toDebt: 2000 });
  assert.equal(html, "");
});

test("deb11ReduceQuotaVsTermHtml · con importe dimensionado, muestra ambas alternativas y avisa que falta declarar preferencia", () => {
  const ctx = sandbox({ debts: [DEBT], contracts: [CONTRACT] });
  ctx.domValues.ap1DebtSelect = "hipoteca";
  ctx.domValues.ap1DebtRate = "5";
  const html = ctx.deb11ReduceQuotaVsTermHtml({ calculable: true, toDebt: 2000 });
  assert.match(html, /Reducir cuota vs\. reducir plazo/);
  assert.match(html, /DEB11\/DEB2: 2000€/);
  assert.match(html, /Reducir cuota:/);
  assert.match(html, /Reducir plazo:/);
  assert.match(html, /Todavía no has declarado/);
  assert.doesNotMatch(html, /tu decisión declarada/);
});

test("deb11ReduceQuotaVsTermHtml · con preferencia declarada, la refleja junto a la opción elegida sin decidir por el hogar", () => {
  const ctx = sandbox({ debts: [DEBT], contracts: [CONTRACT], preference: "reducir-cuota" });
  ctx.domValues.ap1DebtSelect = "hipoteca";
  ctx.domValues.ap1DebtRate = "5";
  const html = ctx.deb11ReduceQuotaVsTermHtml({ calculable: true, toDebt: 2000 });
  assert.match(html, /Tu decisión declarada \(DEB11\): reducir cuota\./);
  const quotaLine = html.split("<li>")[1];
  assert.match(quotaLine, /tu decisión declarada/);
  const termLine = html.split("<li>")[2];
  assert.doesNotMatch(termLine, /tu decisión declarada/);
});

test("deb11ReduceQuotaVsTermHtml · descuenta la comisión de amortización anticipada del importe usado (reutiliza DEB2, no el importe bruto)", () => {
  const ctx = sandbox({ debts: [DEBT], contracts: [CONTRACT] });
  ctx.domValues.ap1DebtSelect = "hipoteca";
  ctx.domValues.ap1PrepaymentPenaltyPct = "2";
  const dimension = CushionEngine.dimensionOptimalPrepayment({ allocatedSurplus: 2000, remainingPrincipal: 10000, penaltyPct: 2 });
  const html = ctx.deb11ReduceQuotaVsTermHtml({ calculable: true, toDebt: 2000 });
  assert.match(html, new RegExp(`DEB11/DEB2: ${Math.round(dimension.amount)}€`));
  assert.notEqual(dimension.amount, 2000);
});

test("deb11Preference · sin ninguno de los dos valores válidos, se trata como sin decidir", () => {
  const ctx = sandbox({ preference: "cualquier-cosa" });
  assert.equal(ctx.deb11Preference(), "");
});

test("wiring: handleAp1Compare concatena deb11ReduceQuotaVsTermHtml(surplusAllocation) junto al resto de tarjetas DEB2/DEB10", () => {
  const start = appSource.indexOf("function handleAp1Compare(");
  const block = appSource.slice(start, appSource.indexOf("\n}\n", start) + 3);
  assert.match(block, /deb11ReduceQuotaVsTermHtml\(surplusAllocation\)/);
});

test("wiring: saveScenarioSettings persiste deb11Preference (sin decidir por defecto, nunca un valor asumido)", () => {
  const start = appSource.indexOf("function saveScenarioSettings(");
  const block = appSource.slice(start, start + 3200);
  assert.match(block, /deb11Preference: state\.deb11Preference === "reducir-cuota" \|\| state\.deb11Preference === "reducir-plazo" \? state\.deb11Preference : ""/);
});

test("wiring: el selector DEB11 dispara handleDeb11PreferenceChange, y la pantalla de Deuda lo sincroniza al abrirse", () => {
  assert.match(appSource, /qs\("deb11PreferenceSelect"\)\?\.addEventListener\("change", handleDeb11PreferenceChange\)/);
  const deudaSource = fs.readFileSync(path.join(__dirname, "..", "views", "deuda.js"), "utf8");
  assert.match(deudaSource, /syncDeb11PreferenceControl\(\);/);
});
