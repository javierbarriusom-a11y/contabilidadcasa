const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

// CPX2 (Oleada 2 Bloque 3): modo segunda opinión para decisiones externas al plan (una oferta de
// coche, un préstamo que propone otra persona, un cambio de trabajo) — todavía no son un objeto
// formal de escenarioMotorDecisions, solo un impacto mensual en caja que comprobar antes de
// comprometerse. Reutiliza el plan base (A8-2, escenarioMotorBaseInput) y el mismo escenario de
// tensión de CP6 (escenarioMotorTensionInput) — nunca un motor de cálculo nuevo.

function extractFunction(name, source = app) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `No existe la función ${name}`);
  const parenStart = source.indexOf("(", start);
  let parenDepth = 0;
  let bodyStart = -1;
  for (let index = parenStart; index < source.length; index += 1) {
    if (source[index] === "(") parenDepth += 1;
    else if (source[index] === ")") {
      parenDepth -= 1;
      if (parenDepth === 0) { bodyStart = source.indexOf("{", index); break; }
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
  throw new Error(`${name} no cierra sus llaves`);
}

test("cpx2SecondOpinionInput · suma el impacto mensual a income de cada mes del horizonte, sin tocar el resto de campos", () => {
  const context = {
    round2: (value) => Math.round(value * 100) / 100,
    escenarioMotorBaseInput: () => ({
      policy: { incomeFactor: 1 },
      months: [{ monthKey: "2026-09", income: 2000, coreSpend: 1500 }, { monthKey: "2026-10", income: 2000, coreSpend: 1500 }],
    }),
  };
  vm.createContext(context);
  vm.runInContext(extractFunction("cpx2SecondOpinionInput"), context);
  const result = context.cpx2SecondOpinionInput(-300);
  assert.equal(result.months[0].income, 1700);
  assert.equal(result.months[1].income, 1700);
  assert.equal(result.months[0].coreSpend, 1500);
});

test("cpx2SecondOpinionResult · sin impacto (0 o vacío), no calculable — no se lanza el motor sin nada que comprobar", () => {
  const block = extractFunction("cpx2SecondOpinionResult");
  assert.match(block, /impact === 0/);
  assert.match(block, /calculable: false/);
});

test("cpx2SecondOpinionResult · pasa el input ajustado por el plan base (A8-2) y por el escenario de tensión de CP6", () => {
  const block = extractFunction("cpx2SecondOpinionResult");
  assert.match(block, /runEscenarioMotor\(adjustedInput, \[\], escenarioMotorGuardrailValue\)/);
  assert.match(block, /runEscenarioMotor\(escenarioMotorTensionInput\(adjustedInput\), \[\], escenarioMotorGuardrailValue\)/);
  assert.match(block, /escenarioMotorSummaryFor\(baseResult, adjustedInput\.months\)/);
  assert.match(block, /escenarioMotorSummaryFor\(tensionResult, adjustedInput\.months\)/);
});

test("cpx2SecondOpinionHtml · sin resultado calculable, pide el dato en vez de un veredicto vacío", () => {
  const context = { money: (value) => `${value} €`, escapeHtml: (v) => String(v ?? "") };
  vm.createContext(context);
  vm.runInContext(extractFunction("cpx2SecondOpinionHtml"), context);
  const result = context.cpx2SecondOpinionHtml({ calculable: false });
  assert.match(result, /Indica el impacto mensual en caja/);
});

test("cpx2SecondOpinionHtml · caja negativa bajo tensión, avisa de revisar antes de comprometerse", () => {
  const context = { money: (value) => `${value} €`, escapeHtml: (v) => String(v ?? "") };
  vm.createContext(context);
  vm.runInContext(extractFunction("cpx2SecondOpinionHtml"), context);
  const result = context.cpx2SecondOpinionHtml({
    calculable: true,
    baseSummary: { minimoLiquidez: 500 },
    tensionSummary: { minimoLiquidez: -200 },
  });
  assert.match(result, /bajaría de cero/);
  assert.match(result, /Revísalo antes de comprometerte/);
});

test("cpx2SecondOpinionHtml · caja positiva incluso bajo tensión, lo dice explícitamente y aclara que no es la app decidiendo", () => {
  const context = { money: (value) => `${value} €`, escapeHtml: (v) => String(v ?? "") };
  vm.createContext(context);
  vm.runInContext(extractFunction("cpx2SecondOpinionHtml"), context);
  const result = context.cpx2SecondOpinionHtml({
    calculable: true,
    baseSummary: { minimoLiquidez: 500 },
    tensionSummary: { minimoLiquidez: 100 },
  });
  assert.match(result, /se mantendría en positivo/);
  assert.match(result, /Segunda opinión, no una decisión tomada por la app/);
});

test("index.html: la tarjeta de segunda opinión tiene sus campos", () => {
  ["cpx2MonthlyImpact", "cpx2SecondOpinionRun", "cpx2SecondOpinionNote"].forEach((id) => {
    assert.match(html, new RegExp(`id="${id}"`), `Falta #${id} en la tarjeta de CPX2`);
  });
});

test("app.js: el botón está cableado", () => {
  assert.match(app, /qs\("cpx2SecondOpinionRun"\)\?\.addEventListener\("click", handleCpx2SecondOpinion\);/);
});
