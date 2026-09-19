const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const appSource = read("app.js");
const indexSource = read("index.html");
const shareSource = read("share.html");
const Share = require(path.join(root, "canonical-share-link.js"));

// MDX1 (Oleada 2 Bloque 3): vista educativa para hijos. Depende de A5-3 (invitación real de hogar,
// RGX1/RGX2) y A19-1 (enlace de solo lectura, redactado y caducable) — ambas ya reales, así que
// esta tarea es un tercer viewType más del mecanismo de A19-1, nunca un motor de compartición
// nuevo. Solo dos cifras redondas (colchón, patrimonio neto), ninguna cuenta ni movimiento.

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

test("redactKidsSummaryView · con las dos cifras, las redondea sin exponer nada más", () => {
  const result = Share.redactKidsSummaryView({ cushion: 1234.567, netWorth: 98765.4321 });
  assert.equal(result.schemaId, `${Share.SCHEMA_ID}/kids-summary-v1`);
  assert.equal(result.cushion, 1234.57);
  assert.equal(result.netWorth, 98765.43);
  assert.equal(Object.keys(result).sort().join(","), "cushion,generatedAt,netWorth,periodicHelp,projection,schemaId");
});

test("redactKidsSummaryView · sin patrimonio calculable, null explícito — nunca un cero inventado", () => {
  const result = Share.redactKidsSummaryView({ cushion: 500, netWorth: null });
  assert.equal(result.cushion, 500);
  assert.equal(result.netWorth, null);
});

// T13 (BACKLOG_CONTABILIDADCASA_2_0.md): dos campos opcionales más, ambos declarados por el hogar.

test("redactKidsSummaryView · sin periodicHelp/projection declarados, ambos quedan null — nunca inventados", () => {
  const result = Share.redactKidsSummaryView({ cushion: 500, netWorth: 1000 });
  assert.equal(result.periodicHelp, null);
  assert.equal(result.projection, null);
});

test("redactKidsSummaryView · periodicHelp declarado se redondea", () => {
  const result = Share.redactKidsSummaryView({ cushion: 500, netWorth: 1000, periodicHelp: 99.996 });
  assert.equal(result.periodicHelp, 100);
});

test("redactKidsSummaryView · projection no calculable (calculable:false) se redacta como null, nunca a medias", () => {
  const result = Share.redactKidsSummaryView({ cushion: 500, netWorth: 1000, projection: { calculable: false } });
  assert.equal(result.projection, null);
});

test("redactKidsSummaryView · projection calculable se redacta completa y redondeada", () => {
  const result = Share.redactKidsSummaryView({
    cushion: 500,
    netWorth: 1000,
    projection: { calculable: true, monthlyAmount: 100, annualReturnPct: 5.001, years: 10, totalContributed: 12000, projectedValue: 15528.227 },
  });
  assert.deepEqual(result.projection, { monthlyAmount: 100, annualReturnPct: 5, years: 10, totalContributed: 12000, projectedValue: 15528.23 });
});

test("VIEW_TYPES/buildSharePayload · kids-summary es una vista válida del mecanismo de A19-1", () => {
  assert.ok(Share.VIEW_TYPES.includes("kids-summary"));
  const payload = Share.buildSharePayload("kids-summary", { cushion: 100, netWorth: 200 });
  assert.equal(payload.cushion, 100);
  assert.equal(payload.netWorth, 200);
});

test("mdx1KidsSummarySource · lee el colchón de las cuentas y el patrimonio neto de lpNetWorthSnapshot (A14-2), sin motor nuevo", () => {
  const context = {
    accountBalancesFromState: () => ({ caixa: 1000, mediolanum: 500, total: 1500 }),
    lpNetWorthSnapshot: () => ({ calculable: true, netWorth: 42000 }),
    t13KidsSummaryExtras: () => ({ periodicHelp: null, projection: { calculable: false } }),
  };
  vm.createContext(context);
  vm.runInContext(extractFunction("mdx1KidsSummarySource"), context);
  const result = context.mdx1KidsSummarySource();
  assert.equal(result.cushion, 1500);
  assert.equal(result.netWorth, 42000);
});

test("mdx1KidsSummarySource · sin patrimonio calculable (sin activos declarados), netWorth null", () => {
  const context = {
    accountBalancesFromState: () => ({ total: 1500 }),
    lpNetWorthSnapshot: () => ({ calculable: false }),
    t13KidsSummaryExtras: () => ({ periodicHelp: null, projection: { calculable: false } }),
  };
  vm.createContext(context);
  vm.runInContext(extractFunction("mdx1KidsSummarySource"), context);
  assert.equal(context.mdx1KidsSummarySource().netWorth, null);
});

test("mdx1KidsSummarySource · delega periodicHelp/projection en t13KidsSummaryExtras(), sin recalcularlos", () => {
  const context = {
    accountBalancesFromState: () => ({ total: 1500 }),
    lpNetWorthSnapshot: () => ({ calculable: true, netWorth: 42000 }),
    t13KidsSummaryExtras: () => ({ periodicHelp: 50, projection: { calculable: true, monthlyAmount: 20 } }),
  };
  vm.createContext(context);
  vm.runInContext(extractFunction("mdx1KidsSummarySource"), context);
  const result = context.mdx1KidsSummarySource();
  assert.equal(result.periodicHelp, 50);
  assert.deepEqual(result.projection, { calculable: true, monthlyAmount: 20 });
});

// T13: proyección educativa de ahorro y sus dos funciones de composición.

function round2(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

test("t13ChildSavingsProjection · sin aportación mensual o sin años, no calcula nada", () => {
  const context = { round2 };
  vm.createContext(context);
  vm.runInContext(extractFunction("t13ChildSavingsProjection"), context);
  assert.equal(context.t13ChildSavingsProjection({ monthlyAmount: 0, annualReturnPct: 5, years: 10 }).calculable, false);
  assert.equal(context.t13ChildSavingsProjection({ monthlyAmount: 100, annualReturnPct: 5, years: 0 }).calculable, false);
  assert.equal(context.t13ChildSavingsProjection({}).calculable, false);
});

test("t13ChildSavingsProjection · con rentabilidad 0%, es una suma simple de aportaciones (sin interés compuesto que fabricar)", () => {
  const context = { round2 };
  vm.createContext(context);
  vm.runInContext(extractFunction("t13ChildSavingsProjection"), context);
  const result = context.t13ChildSavingsProjection({ monthlyAmount: 100, annualReturnPct: 0, years: 2 });
  assert.equal(result.calculable, true);
  assert.equal(result.totalContributed, 2400);
  assert.equal(result.projectedValue, 2400);
});

test("t13ChildSavingsProjection · con rentabilidad positiva, aplica anualidad compuesta mensual", () => {
  const context = { round2 };
  vm.createContext(context);
  vm.runInContext(extractFunction("t13ChildSavingsProjection"), context);
  const result = context.t13ChildSavingsProjection({ monthlyAmount: 100, annualReturnPct: 6, years: 1 });
  assert.equal(result.calculable, true);
  assert.equal(result.totalContributed, 1200);
  // FV = 100 * ((1.005^12 - 1) / 0.005) ≈ 1233.56
  assert.equal(result.projectedValue, 1233.56);
  assert.ok(result.projectedValue > result.totalContributed, "con rentabilidad positiva, el proyectado supera lo aportado");
});

test("t13KidsSummaryExtras · sin nada declarado por el hogar, periodicHelp null y projection no calculable", () => {
  const context = {
    state: {},
    t13ChildSavingsProjection: () => ({ calculable: false }),
  };
  vm.createContext(context);
  vm.runInContext(extractFunction("t13KidsSummaryExtras"), context);
  const result = context.t13KidsSummaryExtras();
  assert.equal(result.periodicHelp, null);
  assert.equal(result.projection.calculable, false);
});

test("t13KidsSummaryExtras · con ayuda periódica declarada, la pasa tal cual", () => {
  const context = {
    state: { t13PeriodicHelpAmount: 75 },
    t13ChildSavingsProjection: () => ({ calculable: false }),
  };
  vm.createContext(context);
  vm.runInContext(extractFunction("t13KidsSummaryExtras"), context);
  assert.equal(context.t13KidsSummaryExtras().periodicHelp, 75);
});

test("app.js: saveA19ShareLink usa mdx1KidsSummarySource() como origen de datos para la vista kids-summary", () => {
  const block = appSource.slice(appSource.indexOf("async function saveA19ShareLink("), appSource.indexOf("async function saveA19ShareLink(") + 1400);
  assert.match(block, /viewType === "kids-summary"\s*\n\s*\? mdx1KidsSummarySource\(\)/);
});

test("index.html: el selector de A19-1 ofrece la vista para hijos", () => {
  assert.match(indexSource, /<option value="kids-summary">Vista para hijos \(colchón y patrimonio\)<\/option>/);
});

test("share.html: renderKidsSummary existe, se despacha por schemaId y nunca expone cifras por debajo del nivel de colchón/patrimonio", () => {
  assert.match(shareSource, /function renderKidsSummary\(payload\)/);
  assert.match(shareSource, /endsWith\("\/kids-summary-v1"\)\) renderKidsSummary\(payload\)/);
  const fnStart = shareSource.indexOf("function renderKidsSummary(payload)");
  const fnEnd = shareSource.indexOf("\n  }", fnStart);
  const fnBody = shareSource.slice(fnStart, fnEnd);
  assert.match(fnBody, /payload\.cushion/);
  assert.match(fnBody, /payload\.netWorth/);
  assert.doesNotMatch(fnBody, /payload\.debts|payload\.months|movimiento/i);
});
