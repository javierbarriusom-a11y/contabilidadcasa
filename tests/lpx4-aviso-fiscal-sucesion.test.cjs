const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const IrpfEstimator = require("../canonical-irpf-estimator.js");

const root = path.resolve(__dirname, "..");
const appSource = fs.readFileSync(path.join(root, "app.js"), "utf8");
const indexSource = fs.readFileSync(path.join(root, "index.html"), "utf8");

// LPX4 (BACKLOG_SUCESION_Y_CONTINUIDAD.md): aviso temprano de coste fiscal por sucesión/donación.
// Reutiliza lpNetWorthSnapshot() (LPX1/LPX2) para la masa hereditaria y el mismo registro de escalas
// de A15-2 (irpfBracketScales/validateBracketScale/progressiveTax) con un kind nuevo ("succession")
// en vez de un registro propio — el hogar declara la escala YA aplicable a su caso concreto (grupo de
// parentesco, comunidad autónoma, patrimonio preexistente del heredero, todo ya incorporado), con la
// misma fuente completa que exige el resto del motor fiscal. Sin esa escala, nunca calcula ninguna
// cifra.

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
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

const COMPLETE_SOURCE = { title: "Agencia Tributaria", authority: "Declarado por el hogar", url: "https://sede.agenciatributaria.gob.es/x", checkedAt: "2026-09-16" };
const VALID_SCALE = { kind: "succession", brackets: [{ limit: 100000, rate: 5 }, { limit: null, rate: 10 }], source: COMPLETE_SOURCE };
const INCOMPLETE_SCALE = { kind: "succession", brackets: [{ limit: 100000, rate: 5 }, { limit: null, rate: 10 }], source: {} };

function sandbox({ netWorthSnapshot, successionScale, exemptAmount = 0 } = {}) {
  const context = {
    window: { FinanceCanonicalIrpfEstimator: IrpfEstimator },
    round2,
    state: { lpx4ExemptAmount: exemptAmount },
  };
  vm.createContext(context);
  // Stubs: aísla lpx4SuccessionTaxEstimate de lpNetWorthSnapshot/latestIrpfScale reales (ya
  // probados en sus propios tests) para probar solo la composición que hace LPX4.
  vm.runInContext(`function lpNetWorthSnapshot() { return ${JSON.stringify(netWorthSnapshot || { calculable: false })}; }`, context);
  vm.runInContext(`function latestIrpfScale(kind) { return kind === "succession" ? ${JSON.stringify(successionScale || null)} : null; }`, context);
  vm.runInContext(extractFunction("lpx4ExemptAmount"), context);
  vm.runInContext(extractFunction("lpx4SuccessionTaxEstimate"), context);
  return context;
}

test("lpx4ExemptAmount · sin declarar, es 0", () => {
  const ctx = sandbox({ exemptAmount: 0 });
  assert.equal(ctx.lpx4ExemptAmount(), 0);
});

test("lpx4ExemptAmount · un valor negativo nunca cuenta, queda en 0", () => {
  const ctx = sandbox({ exemptAmount: -500 });
  assert.equal(ctx.lpx4ExemptAmount(), 0);
});

test("lpx4ExemptAmount · un valor positivo declarado se conserva", () => {
  const ctx = sandbox({ exemptAmount: 15915 });
  assert.equal(ctx.lpx4ExemptAmount(), 15915);
});

test("lpx4SuccessionTaxEstimate · sin patrimonio calculable, no calcula nada", () => {
  const ctx = sandbox({ netWorthSnapshot: { calculable: false } });
  const result = ctx.lpx4SuccessionTaxEstimate();
  assert.equal(result.calculable, false);
  assert.equal(result.reason, "missing-net-worth");
});

test("lpx4SuccessionTaxEstimate · con patrimonio pero sin escala de sucesiones registrada, no calcula nada", () => {
  const ctx = sandbox({ netWorthSnapshot: { calculable: true, netWorth: 500000 } });
  const result = ctx.lpx4SuccessionTaxEstimate();
  assert.equal(result.calculable, false);
  assert.equal(result.reason, "missing-scale");
  assert.equal(result.netWorth, 500000);
});

test("lpx4SuccessionTaxEstimate · con escala sin fuente completa, no calcula nada (nunca una cifra sobre un tramo sin fuente)", () => {
  const ctx = sandbox({ netWorthSnapshot: { calculable: true, netWorth: 500000 }, successionScale: INCOMPLETE_SCALE });
  const result = ctx.lpx4SuccessionTaxEstimate();
  assert.equal(result.calculable, false);
  assert.equal(result.reason, "missing-scale");
  assert.ok(result.issues.includes("fuente-incompleta"));
});

test("lpx4SuccessionTaxEstimate · con escala válida y sin mínimo exento declarado, la base es el patrimonio neto completo", () => {
  const ctx = sandbox({ netWorthSnapshot: { calculable: true, netWorth: 500000 }, successionScale: VALID_SCALE, exemptAmount: 0 });
  const result = ctx.lpx4SuccessionTaxEstimate();
  assert.equal(result.calculable, true);
  assert.equal(result.exemptAmount, 0);
  assert.equal(result.taxableBase, 500000);
  // 100000*5% + 400000*10% = 5000 + 40000 = 45000
  assert.equal(result.quota, 45000);
});

test("lpx4SuccessionTaxEstimate · el mínimo exento declarado se resta del patrimonio neto antes de aplicar la escala", () => {
  const ctx = sandbox({ netWorthSnapshot: { calculable: true, netWorth: 500000 }, successionScale: VALID_SCALE, exemptAmount: 200000 });
  const result = ctx.lpx4SuccessionTaxEstimate();
  assert.equal(result.calculable, true);
  assert.equal(result.exemptAmount, 200000);
  assert.equal(result.taxableBase, 300000);
  // 100000*5% + 200000*10% = 5000 + 20000 = 25000
  assert.equal(result.quota, 25000);
});

test("lpx4SuccessionTaxEstimate · un mínimo exento mayor que el patrimonio neto nunca da una base negativa", () => {
  const ctx = sandbox({ netWorthSnapshot: { calculable: true, netWorth: 100000 }, successionScale: VALID_SCALE, exemptAmount: 300000 });
  const result = ctx.lpx4SuccessionTaxEstimate();
  assert.equal(result.calculable, true);
  assert.equal(result.taxableBase, 0);
  assert.equal(result.quota, 0);
});

test("index.html: la tarjeta de aviso fiscal y el campo de mínimo exento existen", () => {
  assert.match(indexSource, /id="lpx4SuccessionTaxEstimate"/);
  assert.match(indexSource, /id="lpx4ExemptAmount"/);
  assert.match(indexSource, /<option value="succession">/);
});

test("app.js: la escala de sucesiones se registra con el mismo formulario que las de IRPF, sin registro propio", () => {
  assert.match(appSource, /kind === "succession" \? "succession" : "state"/);
  assert.match(appSource, /succession: "Escala de Sucesiones y Donaciones"/);
});

test("app.js: LPX4 reutiliza validateBracketScale/progressiveTax del motor fiscal (A15-2), sin escala nueva que inventar", () => {
  const block = extractFunction("lpx4SuccessionTaxEstimate");
  assert.match(block, /irpf\.validateBracketScale\(/);
  assert.match(block, /irpf\.progressiveTax\(/);
  assert.match(block, /latestIrpfScale\("succession"\)/);
});

test("app.js: renderLpx4SuccessionTaxEstimate nunca inventa una cifra sin escala calculable", () => {
  const block = extractFunction("renderLpx4SuccessionTaxEstimate");
  assert.match(block, /if \(!result\.calculable\)/);
  assert.match(block, /comunidad autónoma/);
});

test("app.js: registrar o quitar una escala de IRPF repinta también el aviso de LPX4", () => {
  const saveBlock = appSource.slice(appSource.indexOf("function saveIrpfBracketScaleFromControls("), appSource.indexOf("function saveIrpfBracketScaleFromControls(") + 900);
  assert.match(saveBlock, /renderLpx4SuccessionTaxEstimate\(\);/);
  const removeBlock = appSource.slice(appSource.indexOf('qs("irpfBracketScaleList")?.addEventListener("click"'), appSource.indexOf('qs("irpfBracketScaleList")?.addEventListener("click"') + 350);
  assert.match(removeBlock, /renderLpx4SuccessionTaxEstimate\(\);/);
});

test("app.js: el mínimo exento se persiste en scenarioSettings (mismo criterio que SP3/FC4, nunca solo en `state`)", () => {
  assert.match(appSource, /lpx4ExemptAmount: round2\(Math\.max\(0, Number\(state\.lpx4ExemptAmount \|\| 0\)\)\)/);
});

test("app.js: el campo de mínimo exento está cableado a su manejador de cambio", () => {
  assert.match(appSource, /qs\("lpx4ExemptAmount"\)\?\.addEventListener\("change", handleLpx4ExemptAmountChange\)/);
});

test("app.js: renderAjustes sincroniza el campo y repinta el aviso de LPX4 en el lote general", () => {
  const start = appSource.indexOf("renderLpx2NetWorthRunway();");
  const block = appSource.slice(start, start + 200);
  assert.match(block, /syncLpx4ExemptAmountControl\(\);/);
  assert.match(block, /renderLpx4SuccessionTaxEstimate\(\);/);
});
