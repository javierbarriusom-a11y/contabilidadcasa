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
  assert.equal(Object.keys(result).sort().join(","), "cushion,generatedAt,netWorth,schemaId");
});

test("redactKidsSummaryView · sin patrimonio calculable, null explícito — nunca un cero inventado", () => {
  const result = Share.redactKidsSummaryView({ cushion: 500, netWorth: null });
  assert.equal(result.cushion, 500);
  assert.equal(result.netWorth, null);
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
  };
  vm.createContext(context);
  vm.runInContext(extractFunction("mdx1KidsSummarySource"), context);
  assert.equal(context.mdx1KidsSummarySource().netWorth, null);
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
