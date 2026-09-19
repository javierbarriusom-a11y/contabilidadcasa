const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const IrpfEstimator = require("../canonical-irpf-estimator.js");

const root = path.resolve(__dirname, "..");
const appSource = fs.readFileSync(path.join(root, "app.js"), "utf8");
const indexSource = fs.readFileSync(path.join(root, "index.html"), "utf8");

// T13 (BACKLOG_CONTABILIDADCASA_2_0.md): comparador informativo "¿mejor donar ahora o dejarlo en
// herencia?". Reutiliza tal cual el motor de LPX4 (lpNetWorthSnapshot, la escala "succession" de
// A15-2 con fuente completa, lpx4ExemptAmount) — nunca un registro fiscal propio. "Donar ahora"
// aplica la escala al importe declarado; "dejarlo en herencia" es el coste marginal de ese importe
// dentro del patrimonio de hoy (quota(patrimonio) − quota(patrimonio − importe)), nunca una
// proyección inventada del patrimonio futuro.

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

function sandbox({ netWorthSnapshot, successionScale, exemptAmount = 0, donationAmount = 0 } = {}) {
  const context = {
    window: { FinanceCanonicalIrpfEstimator: IrpfEstimator },
    round2,
    state: { lpx4ExemptAmount: exemptAmount, t13DonationAmount: donationAmount },
  };
  vm.createContext(context);
  vm.runInContext(`function lpNetWorthSnapshot() { return ${JSON.stringify(netWorthSnapshot || { calculable: false })}; }`, context);
  vm.runInContext(`function latestIrpfScale(kind) { return kind === "succession" ? ${JSON.stringify(successionScale || null)} : null; }`, context);
  vm.runInContext(extractFunction("lpx4ExemptAmount"), context);
  vm.runInContext(extractFunction("t13DonationAmount"), context);
  vm.runInContext(extractFunction("t13DonationVsInheritanceEstimate"), context);
  return context;
}

test("t13DonationAmount · sin declarar, es 0", () => {
  const ctx = sandbox({ donationAmount: 0 });
  assert.equal(ctx.t13DonationAmount(), 0);
});

test("t13DonationAmount · un valor negativo nunca cuenta, queda en 0", () => {
  const ctx = sandbox({ donationAmount: -500 });
  assert.equal(ctx.t13DonationAmount(), 0);
});

test("t13DonationVsInheritanceEstimate · sin patrimonio calculable, no calcula nada", () => {
  const ctx = sandbox({ netWorthSnapshot: { calculable: false } });
  const result = ctx.t13DonationVsInheritanceEstimate();
  assert.equal(result.calculable, false);
  assert.equal(result.reason, "missing-net-worth");
});

test("t13DonationVsInheritanceEstimate · con patrimonio pero sin escala de sucesiones registrada, no calcula nada", () => {
  const ctx = sandbox({ netWorthSnapshot: { calculable: true, netWorth: 500000 } });
  const result = ctx.t13DonationVsInheritanceEstimate();
  assert.equal(result.calculable, false);
  assert.equal(result.reason, "missing-scale");
});

test("t13DonationVsInheritanceEstimate · con escala sin fuente completa, no calcula nada", () => {
  const ctx = sandbox({ netWorthSnapshot: { calculable: true, netWorth: 500000 }, successionScale: INCOMPLETE_SCALE });
  const result = ctx.t13DonationVsInheritanceEstimate();
  assert.equal(result.calculable, false);
  assert.equal(result.reason, "missing-scale");
});

test("t13DonationVsInheritanceEstimate · con escala válida pero sin importe declarado, no calcula nada", () => {
  const ctx = sandbox({ netWorthSnapshot: { calculable: true, netWorth: 500000 }, successionScale: VALID_SCALE, donationAmount: 0 });
  const result = ctx.t13DonationVsInheritanceEstimate();
  assert.equal(result.calculable, false);
  assert.equal(result.reason, "missing-amount");
});

test("t13DonationVsInheritanceEstimate · sin mínimo exento, dona ahora paga la escala completa sobre el importe", () => {
  const ctx = sandbox({ netWorthSnapshot: { calculable: true, netWorth: 500000 }, successionScale: VALID_SCALE, exemptAmount: 0, donationAmount: 150000 });
  const result = ctx.t13DonationVsInheritanceEstimate();
  assert.equal(result.calculable, true);
  // 100000*5% + 50000*10% = 5000 + 5000 = 10000
  assert.equal(result.donateNowQuota, 10000);
});

test("t13DonationVsInheritanceEstimate · dejarlo en herencia es el coste marginal del importe sobre el patrimonio de hoy", () => {
  const ctx = sandbox({ netWorthSnapshot: { calculable: true, netWorth: 500000 }, successionScale: VALID_SCALE, exemptAmount: 0, donationAmount: 150000 });
  const result = ctx.t13DonationVsInheritanceEstimate();
  // quota(500000) = 100000*5% + 400000*10% = 45000; quota(350000) = 100000*5%+250000*10% = 30000
  // marginal = 45000 - 30000 = 15000
  assert.equal(result.leaveInInheritanceQuota, 15000);
  assert.equal(result.difference, result.donateNowQuota - result.leaveInInheritanceQuota);
});

test("t13DonationVsInheritanceEstimate · el mínimo exento declarado se aplica a ambas rutas", () => {
  const ctx = sandbox({ netWorthSnapshot: { calculable: true, netWorth: 500000 }, successionScale: VALID_SCALE, exemptAmount: 100000, donationAmount: 150000 });
  const result = ctx.t13DonationVsInheritanceEstimate();
  // donar ahora: base = 150000-100000 = 50000 -> 50000*5% = 2500
  assert.equal(result.donateNowQuota, 2500);
  // herencia: quota(400000)=100000*5%+300000*10%=35000; quota(250000)=100000*5%+150000*10%=20000 -> marginal 15000
  assert.equal(result.leaveInInheritanceQuota, 15000);
});

test("t13DonationVsInheritanceEstimate · un importe que supera el patrimonio nunca da una base negativa", () => {
  const ctx = sandbox({ netWorthSnapshot: { calculable: true, netWorth: 100000 }, successionScale: VALID_SCALE, exemptAmount: 0, donationAmount: 500000 });
  const result = ctx.t13DonationVsInheritanceEstimate();
  assert.equal(result.calculable, true);
  assert.ok(result.leaveInInheritanceQuota >= 0);
});

test("index.html: la tarjeta del comparador y el campo de importe existen", () => {
  assert.match(indexSource, /id="t13DonationVsInheritance"/);
  assert.match(indexSource, /id="t13DonationAmount"/);
});

test("app.js: t13DonationVsInheritanceEstimate reutiliza validateBracketScale/progressiveTax del motor fiscal (A15-2), sin escala nueva", () => {
  const block = extractFunction("t13DonationVsInheritanceEstimate");
  assert.match(block, /irpf\.validateBracketScale\(/);
  assert.match(block, /irpf\.progressiveTax\(/);
  assert.match(block, /latestIrpfScale\("succession"\)/);
});

test("app.js: renderT13DonationVsInheritance nunca inventa una cifra sin escala/importe calculable", () => {
  const block = extractFunction("renderT13DonationVsInheritance");
  assert.match(block, /if \(!result\.calculable\)/);
});

test("app.js: registrar o quitar una escala de IRPF repinta también el comparador de T13", () => {
  const saveBlock = appSource.slice(appSource.indexOf("function saveIrpfBracketScaleFromControls("), appSource.indexOf("function saveIrpfBracketScaleFromControls(") + 1000);
  assert.match(saveBlock, /renderT13DonationVsInheritance\(\);/);
  const removeBlock = appSource.slice(appSource.indexOf('qs("irpfBracketScaleList")?.addEventListener("click"'), appSource.indexOf('qs("irpfBracketScaleList")?.addEventListener("click"') + 400);
  assert.match(removeBlock, /renderT13DonationVsInheritance\(\);/);
});

test("app.js: el importe hipotético se persiste en scenarioSettings (mismo criterio que LPX4)", () => {
  assert.match(appSource, /t13DonationAmount: round2\(Math\.max\(0, Number\(state\.t13DonationAmount \|\| 0\)\)\)/);
});

test("app.js: el campo de importe está cableado a su manejador de cambio", () => {
  assert.match(appSource, /qs\("t13DonationAmount"\)\?\.addEventListener\("change", handleT13DonationAmountChange\)/);
});

test("app.js: renderAjustes sincroniza el campo y repinta el comparador de T13 en el lote general", () => {
  const start = appSource.indexOf("syncLpx4ExemptAmountControl();");
  const block = appSource.slice(start, start + 250);
  assert.match(block, /syncT13DonationAmountControl\(\);/);
  assert.match(block, /renderT13DonationVsInheritance\(\);/);
});
